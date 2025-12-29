import { db, performQuery } from "../../config/Database.js";
import os from "os";
import { getCurrentISTTime } from "../../Utils/Datetime.js";
import { handleSequelizeError } from "../../config/validationCheck.js";
import { validateStudentInput } from "./validateStudentInput.js";
import readXlsxFile from "read-excel-file/node";
import xlsx from "xlsx";
import { getEasyTimeToken } from "../../Utils/easytime.js";
import axios from "axios";
import { getEASYTIMEURL } from "../../Utils/EASYTIME_URL.js";

export async function insertStudentGMasterMap(
  db,
  studentId,
  locations = [],
  gmasterFields = {}
) {
  if (!studentId) throw new Error("studentId is required");

  // Insert locations
  if (Array.isArray(locations)) {
    for (const loc of locations) {
      const gvalueId = typeof loc === "object" ? loc.id : loc;
      if (gvalueId != null) {
        await db.query(
          `INSERT INTO studentgmastermap (student_id, gmastervalue_id) VALUES (?, ?)`,
          { replacements: [studentId, gvalueId] }
        );
      }
    }
  }

  // Insert gender, degree, department
  const gmasterKeys = ["gender", "degree", "department"];
  for (const key of gmasterKeys) {
    const gvalueId = gmasterFields[key];
    if (gvalueId != null) {
      await db.query(
        `INSERT INTO studentgmastermap (student_id, gmastervalue_id) VALUES (?, ?)`,
        { replacements: [studentId, gvalueId] }
      );
    }
  }
}

export const CreateStudent = async (req, res, options = {}) => {
  const isBulk = options.isBulk || false;
  const QueryTime = await getCurrentISTTime();

  try {
    const rows = isBulk ? req.body?.data || [] : [req.body?.data || req.body];
    const userId = req.user?.userId || 0;
    const EASYTIME_URL = await getEASYTIMEURL(userId);
    const token = await getEasyTimeToken(userId);

    const results = [];

    for (const bodydata of rows) {
      let studentId;
      try {
        if (!isBulk) await db.query("START TRANSACTION");

        // ================= Insert Student =================
        const [result] = await db.query(
          `INSERT INTO student
           (name, memberid, mobile, email, address, remarks, createdby,
            parentname, parentcontact, parentemail, expirydate, hostel_id, bio_triggered_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,?)`,
          {
            replacements: [
              bodydata.name,
              bodydata.memberid,
              bodydata.mobile,
              bodydata.email || null,
              bodydata.address || null,
              bodydata.remarks || null,
              userId,
              bodydata.parentname || null,
              bodydata.parentcontact || null,
              bodydata.parentemail || null,
              bodydata.expirydate || null,
              bodydata.hostel_id,
              null,
            ],
          }
        );

        studentId = result?.insertId;
        if (!studentId) {
          const [[row]] = await db.query("SELECT LAST_INSERT_ID() AS id");
          studentId = row?.id;
        }
        if (!studentId) throw new Error("STUDENT_INSERT_FAILED");

        // ================= GMaster Mapping =================
        await insertStudentGMasterMap(db, studentId, bodydata.locations || [], {
          gender: bodydata.gender,
          degree: bodydata.degree,
          department: bodydata.department,
        });

        // ================= Student Log =================
        const terminalId = os.hostname() || "DEFAULT";
        await db.query(
          `INSERT INTO studentlog (student_id, terminalid, transtime)
           VALUES (?, ?, NOW())`,
          { replacements: [studentId, terminalId] }
        );

        if (!isBulk) await db.query("COMMIT");
      } catch (dbError) {
        if (!isBulk) await db.query("ROLLBACK");
        results.push({
          success: false,
          error: dbError.message,
          student: bodydata,
        });
        continue;
      }

      // ================= WDMS Sync =================
      try {
        // hire_date = yesterday
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const hireDate = yesterday.toISOString().split("T")[0];

        const today = QueryTime.split(" ")[0];

        // Get department and area WDMS IDs
        const [[{ wdms_id: deptId } = {}]] = await db.query(
          "SELECT wdms_id FROM wdms_mapping WHERE local_type='department' AND local_id=?",
          { replacements: [bodydata.department] }
        );
        const [[{ wdms_id: areaId } = {}]] = await db.query(
          "SELECT wdms_id FROM wdms_mapping WHERE local_type='area' AND local_id=?",
          { replacements: [bodydata.hostel_id] }
        );

        if (!deptId) throw new Error("WDMS_DEPARTMENT_ID_MISSING");

        // Normalize gender
        let gender = "M";
        const rawGender = bodydata.gender;
        if (typeof rawGender === "string") {
          gender = rawGender.trim().toLowerCase().startsWith("f") ? "F" : "M";
        } else if (rawGender === 2 || rawGender === "2") gender = "F";
        else if (rawGender === 1 || rawGender === "1") gender = "M";

        // Normalize validity_end
        let validityEnd = "2099-12-31";
        if (bodydata.expirydate) {
          const dateObj = new Date(bodydata.expirydate);
          if (!isNaN(dateObj.getTime())) {
            const yyyy = dateObj.getFullYear();
            const mm = String(dateObj.getMonth() + 1).padStart(2, "0");
            const dd = String(dateObj.getDate()).padStart(2, "0");
            validityEnd = `${yyyy}-${mm}-${dd}`;
          }
        }

        // Ensure validity_end > today
        if (validityEnd <= today) {
          const d = new Date(today);
          d.setFullYear(d.getFullYear() + 1);
          const yyyy = d.getFullYear();
          const mm = String(d.getMonth() + 1).padStart(2, "0");
          const dd = String(d.getDate()).padStart(2, "0");
          validityEnd = `${yyyy}-${mm}-${dd}`;
        }

        const wdmsPayload = {
          emp_code: bodydata.memberid?.trim(),
          first_name: bodydata.name?.trim(),
          department: bodydata.department,
          position: 1,
          area: [bodydata.hostel_id || 1],
          hire_date: hireDate,
          gender: gender,
          validity_start: today,
          validity_end: validityEnd,
          mobile: bodydata.mobile?.trim() || "",
          email: bodydata.email?.trim() || "",
          address: bodydata.address?.trim() || "",
          enable_att: true,
          enable_overtime: true,
          enable_holiday: true,
        };

        const wdmsRes = await axios.post(
          `${EASYTIME_URL}/personnel/api/employees/`,
          wdmsPayload,
          {
            headers: {
              Authorization: `Token ${token}`,
              "Content-Type": "application/json",
            },
          }
        );

        await db.query(
          "INSERT INTO wdms_mapping (local_type, local_id, wdms_id) VALUES (?, ?, ?)",
          { replacements: ["employee", studentId, wdmsRes.data.id] }
        );

        results.push({ success: true, studentId });
      } catch (wdmsError) {
        console.error(
          "WDMS Sync Error for studentId",
          studentId,
          wdmsError.response?.data || wdmsError.message
        );
        results.push({
          success: false,
          studentId,
          error: wdmsError.response?.data || wdmsError.message,
        });
      }
    }

    // ================= Return Response =================
    if (!isBulk && res) {
      return res.status(200).json({
        status: true,
        message: "Student created successfully",
        student_id: results[0]?.studentId,
      });
    }

    return { status: true, results };
  } catch (error) {
    if (!isBulk) await db.query("ROLLBACK");
    if (!isBulk && res) {
      return res.status(500).json({
        status: false,
        error: error.message,
      });
    }
    return { status: false, error: error.message };
  }
};

export const GetStudent = async (req, res) => {
  try {
    const id = req.query.id || null;
    const searchTerm = req.query.search || "";

    const {
      tableName,
      defaultSortField,
      sortField,
      sortOrder,
      usePagination,
      pageSize,
      offset,
    } = req.getcheck;

    const userId = req.user?.userId;
    const roleId = req.user?.roleId;

    if (!userId)
      return res.status(401).json({
        status: false,
        issuccess: false,
        message: "Unauthorized - Missing user ID",
      });

    // ROLE CHECK
    const [roleResult] = await db.query("SELECT name FROM roles WHERE id = ?", {
      replacements: [roleId],
    });

    const isSuperAdmin =
      roleResult && roleResult[0]?.name?.toLowerCase() === "superadmin";

    // WHERE CONDITION
    let where = [];
    let params = [];

    if (id) {
      where.push(`s.id = ?`);
      params.push(id);
    }

    if (searchTerm) {
      where.push(`(
        s.name LIKE ? OR
        s.memberid LIKE ? OR
        s.mobile LIKE ?
      )`);
      params.push(`%${searchTerm}%`, `%${searchTerm}%`, `%${searchTerm}%`);
    }

    // HOSTEL FILTER
    if (!isSuperAdmin) {
      const [mappedHostels] = await db.query(
        `SELECT hostel_id FROM userhostelmap WHERE users_id = ?`,
        { replacements: [userId] }
      );

      if (mappedHostels.length > 0) {
        const hostelIds = mappedHostels.map((h) => h.hostel_id).join(",");
        where.push(`s.hostel_id IN (${hostelIds})`);
      } else {
        return res.json({
          status: true,
          issuccess: true,
          count: 0,
          data: [],
          gmapvalues: {},
        });
      }
    }

    const whereClause = where.length ? `WHERE ${where.join(" AND ")}` : "";
    const safeSort = sortField || defaultSortField;
    const PageClause =
      usePagination == true ? `LIMIT ${pageSize} OFFSET ${offset}` : "";

    // MAIN QUERY
    const dataQuery = `
      SELECT DISTINCT s.*
      FROM ${tableName} s
      LEFT JOIN studentgmastermap sm ON sm.student_id = s.id
      ${whereClause}
      ORDER BY ${safeSort} ${sortOrder}
      ${PageClause}
    `;

    const [students] = await db.query(dataQuery, { replacements: params });

    // FETCH GMAPS
    const [gmaps] = await db.query(`
      SELECT gv.id, gv.name, gm.name AS type
      FROM gmastervalue gv
      JOIN gmaster gm ON gm.id = gv.gmaster_id
    `);

    const gmapvalues = {
      gender: gmaps.filter((x) => x.type === "gender"),
      degree: gmaps.filter((x) => x.type === "degree"),
      department: gmaps.filter((x) => x.type === "department"),
      location: gmaps.filter((x) => x.type === "location"),
    };

    if (!students || students.length === 0) {
      return res.json({
        status: true,
        issuccess: true,
        count: 0,
        data: id ? {} : [],
        gmapvalues,
      });
    }

    // MAP RELATION VALUES
    const finalStudents = await Promise.all(
      students.map(async (stu) => {
        const [stuGmaps] = await db.query(
          `
          SELECT gv.id, gv.name, gm.name AS type
          FROM studentgmastermap sm
          JOIN gmastervalue gv ON gv.id = sm.gmastervalue_id
          JOIN gmaster gm ON gm.id = gv.gmaster_id
          WHERE sm.student_id = ?
        `,
          { replacements: [stu.id] }
        );

        return {
          ...stu,
          gender: stuGmaps.find((x) => x.type === "gender")?.id || null,
          gender_name: stuGmaps.find((x) => x.type === "gender")?.name || null,
          degree: stuGmaps.find((x) => x.type === "degree")?.id || null,
          degree_name: stuGmaps.find((x) => x.type === "degree")?.name || null,
          department: stuGmaps.find((x) => x.type === "department")?.id || null,
          department_name:
            stuGmaps.find((x) => x.type === "department")?.name || null,
          locations: stuGmaps
            .filter(
              (x) =>
                x.type !== "gender" &&
                x.type !== "degree" &&
                x.type !== "department"
            )
            .map((x) => ({ id: x.id, name: x.name })),
        };
      })
    );

    // GET TOTAL COUNT
    const [[{ total }]] = await db.query(
      `
      SELECT COUNT(DISTINCT s.id) AS total
      FROM ${tableName} s
      ${whereClause}
    `,
      { replacements: params }
    );

    return res.json({
      status: true,
      issuccess: true,
      count: total,
      pageSize: usePagination ? pageSize : total,
      page: usePagination ? Math.floor(offset / pageSize) + 1 : 1,
      data: finalStudents, // ✅ FIXED
      gmapvalues,
    });
  } catch (err) {
    console.error("GetStudent Error:", err);
    return res.status(500).json({
      status: false,
      issuccess: false,
      message: "Internal server error",
    });
  }
};

export const UpdateStudent = async (req, res) => {
  const QueryTime = await getCurrentISTTime();
  const userId = req.user?.userId;
  let transactionStarted = false;

  try {
    const studentId = req.body?.id || req.params?.id;
    if (!studentId) {
      return res.status(400).json({
        status: false,
        error: "STUDENT_ID_REQUIRED",
        message: "Student ID is required for update",
      });
    }

    const bodydata = req.body?.data || req.body;

    // 1️⃣ GET OLD STUDENT
    const [[oldStudent]] = await db.query(
      "SELECT hostel_id FROM student WHERE id = ?",
      { replacements: [studentId] }
    );

    if (!oldStudent) {
      return res.status(404).json({
        status: false,
        error: "STUDENT_NOT_FOUND",
        message: "Student not found",
      });
    }

    const oldHostelId = oldStudent.hostel_id;
    const newHostelId = bodydata.hostel_id;

    // 2️⃣ START TRANSACTION
    await db.query("START TRANSACTION");
    transactionStarted = true;

    // 3️⃣ UPDATE LOCAL STUDENT
    await db.query(
      `UPDATE student SET 
        name=?, memberid=?, mobile=?, email=?, address=?, remarks=?,
        parentname=?, parentcontact=?, parentemail=?, expirydate=?, hostel_id=?
       WHERE id=?`,
      {
        replacements: [
          bodydata.name,
          bodydata.memberid,
          bodydata.mobile,
          bodydata.email,
          bodydata.address,
          bodydata.remarks,
          bodydata.parentname,
          bodydata.parentcontact,
          bodydata.parentemail,
          bodydata.expirydate,
          newHostelId,
          studentId,
        ],
      }
    );

    // 4️⃣ WDMS SETUP
    let EASYTIME_URL = (await getEASYTIMEURL(userId)).replace(/\/+$/, "");
    const token = await getEasyTimeToken(userId);
    const today = QueryTime.split(" ")[0];

    console.log("succcess0");

    // 5️⃣ FETCH EMPLOYEE FROM WDMS using correct single-employee GET
    let employee;
    try {
      const empRes = await axios.get(
        `${EASYTIME_URL}/personnel/api/employees/${bodydata.memberid}/`,
        { headers: { Authorization: `Token ${token}` } }
      );
      employee = empRes.data; // ✅ full employee object
    } catch (err) {
      if (err.response?.status === 404) {
        throw new Error("WDMS_EMPLOYEE_NOT_FOUND");
      }
      throw err;
    }
    console.log("succcess1");
    const empCode = employee.emp_code;
    if (!empCode) throw new Error("WDMS_EMP_CODE_MISSING");

    // 6️⃣ AREA & DEPARTMENT MAPPING
    const [[areaRow]] = await db.query(
      "SELECT wdms_id FROM wdms_mapping WHERE local_type='area' AND local_id=?",
      { replacements: [newHostelId] }
    );
    const [[deptRow]] = await db.query(
      "SELECT wdms_id FROM wdms_mapping WHERE local_type='department' AND local_id=?",
      { replacements: [bodydata.department] }
    );

    if (!deptRow?.wdms_id) throw new Error("WDMS_DEPARTMENT_MAPPING_NOT_FOUND");
    if (!areaRow?.wdms_id) throw new Error("WDMS_AREA_MAPPING_NOT_FOUND");

    console.log("succcess2");
    // 7️⃣ UPDATE WDMS EMPLOYEE WITH PATCH
    const patchBody = {
      first_name: bodydata.name || employee.first_name,
      last_name: bodydata.last_name || employee.last_name || "",
      nickname: employee.nickname || "",
      mobile: bodydata.mobile || employee.mobile || "",
      email: bodydata.email || employee.email || "",
      hire_date: today,
      validity_start: today,
      validity_end:
        bodydata.expirydate || employee.validity_end || "2099-12-31",
      department: String(bodydata.department),
      position: employee.position?.id ? String(employee.position.id) : "1",
      area: [String(newHostelId)],
      enable_att: true,
      enable_overtime: true,
      enable_holiday: true,
    };

    console.log("succcess3");

    await axios.patch(
      `${EASYTIME_URL}/personnel/api/employees/${empCode}/`,
      patchBody,
      { headers: { Authorization: `Token ${token}` } }
    );
    console.log("succcess4");
    // 8️⃣ BIOMETRIC DEVICE SYNC
    if (oldHostelId !== newHostelId) {
      // Get old and new devices
      const [oldDevices] = await db.query(
        "SELECT device_sn FROM biometric_devices WHERE hostel_id=? AND status='Active'",
        { replacements: [oldHostelId] }
      );

      const [newDevices] = await db.query(
        "SELECT device_sn FROM biometric_devices WHERE hostel_id=? AND status='Active'",
        { replacements: [newHostelId] }
      );

      const syncURL = `${EASYTIME_URL}/iclock/api/terminals/sync_data_to_device/`;

      // Sync new hostel devices with fingerprint and employees
      if (newDevices.length) {
        await axios.post(
          syncURL,
          {
            device_sn: newDevices.map((d) => d.device_sn),
            emp_code: false,
            finger_print: true,
            face: false,
            finger_vein: false,
            palm: false,
            vl_face: false,
          },
          { headers: { Authorization: `Token ${token}` } }
        );
      }

      // Sync old hostel devices to remove fingerprint
      if (oldDevices.length) {
        await axios.post(
          syncURL,
          {
            device_sn: oldDevices.map((d) => d.device_sn),
            emp_code: false,
            finger_print: false,
            face: false,
            finger_vein: false,
            palm: false,
            vl_face: false,
          },
          { headers: { Authorization: `Token ${token}` } }
        );
      }
    }

    // 9️⃣ COMMIT TRANSACTION
    await db.query("COMMIT");

    return res.status(200).json({
      status: true,
      message: "Student updated successfully",
      student_id: studentId,
      hostel_changed: oldHostelId !== newHostelId,
    });
  } catch (error) {
    if (transactionStarted) await db.query("ROLLBACK");

    console.error("❌ UpdateStudent Error:", {
      message: error.message,
      wdms: error.response?.data,
    });

    if (error.code === "ER_DUP_ENTRY") {
      return res.status(409).json({
        status: false,
        error: "DUPLICATE_ENTRY",
        message: "Duplicate member ID or mobile number",
      });
    }

    if (error.response) {
      return res.status(error.response.status || 400).json({
        status: false,
        error: "WDMS_ERROR",
        message: error.response.data?.detail || "WDMS sync failed",
      });
    }

    return res.status(500).json({
      status: false,
      error: "INTERNAL_SERVER_ERROR",
      message: error.message || "Failed to update student",
    });
  }
};

export const DeleteStudent = async (req, res) => {
  const t = await db.transaction();
  const userId = req.user?.userId;

  try {
    const { id } = req.params;
    if (!id) {
      return res.status(400).json({
        status: false,
        error: "STUDENT_ID_REQUIRED",
        message: "Student ID(s) required for deletion",
      });
    }

    const studentIds = id
      .split(",")
      .map((x) => Number(x.trim()))
      .filter(Boolean);

    if (studentIds.length === 0) {
      return res.status(400).json({
        status: false,
        error: "INVALID_STUDENT_IDS",
        message: "No valid student IDs provided",
      });
    }

    // ▪ Get student member IDs
    const [students] = await db.query(
      `SELECT id, memberid FROM student WHERE id IN (${studentIds
        .map(() => "?")
        .join(",")})`,
      { replacements: studentIds }
    );

    if (!students.length) {
      return res.status(404).json({
        status: false,
        error: "STUDENTS_NOT_FOUND",
        message: "No students found for the provided IDs",
      });
    }

    let wdmsDeleted = [];

    // ▪ DELETE IN WDMS FIRST
    try {
      const EASYTIME_URL = await getEASYTIMEURL(userId);
      const token = await getEasyTimeToken(userId);

      for (const student of students) {
        const empCode = student.memberid;
        if (!empCode) continue;

        let employeeList;

        console.log(empCode, "empCode");

        try {
          const getRes = await axios.get(
            `${EASYTIME_URL}/personnel/api/employees/?emp_code=${empCode}`,
            { headers: { Authorization: `Token ${token}` } }
          );

          console.log(getRes.data, "getRes");

          employeeList = getRes.data?.data ?? [];
        } catch (_) {}

        if (!employeeList?.length) continue;

        const wdmsId = employeeList[0].id;

        try {
          console.log(`${EASYTIME_URL}/personnel/api/employees/${empCode}/`);

          await axios.delete(
            `${EASYTIME_URL}/personnel/api/employees/${empCode}/`,
            { headers: { Authorization: `Token ${token}` } }
          );
          wdmsDeleted.push(empCode);
          console.log(`✔ WDMS employee deleted → ${empCode}`);
        } catch (err) {
          console.warn(
            `❌ WDMS delete failed for ${empCode}`,
            err.response?.data || err.message
          );
        }
      }
    } catch (err) {
      console.warn("❌ WDMS deletion encountered errors:", err.message);
    }

    // ▪ DELETE FROM LOCAL DATABASE
    await db.query(
      `DELETE FROM studentgmastermap WHERE student_id IN (${studentIds
        .map(() => "?")
        .join(",")})`,
      { replacements: studentIds, transaction: t }
    );

    await db.query(
      `DELETE FROM late_return_sms_log WHERE student_id IN (${studentIds
        .map(() => "?")
        .join(",")})`,
      { replacements: studentIds, transaction: t }
    );

    await db.query(
      `DELETE FROM wdms_mapping WHERE local_type='employee' AND local_id IN (${studentIds
        .map(() => "?")
        .join(",")})`,
      { replacements: studentIds, transaction: t }
    );

    await db.query(
      `DELETE FROM student WHERE id IN (${studentIds
        .map(() => "?")
        .join(",")})`,
      { replacements: studentIds, transaction: t }
    );

    await t.commit();
    console.log("✔ Local DB deletion success");

    return res.status(200).json({
      status: true,
      message: `${studentIds.length} student(s) deleted successfully`,
      deleted_ids: studentIds,
      wdms_deleted_emp_codes: wdmsDeleted,
    });
  } catch (error) {
    console.error("❌ DeleteStudent Error:", error);
    try {
      await t.rollback();
    } catch (_) {}
    return res.status(500).json({
      status: false,
      error: error.code || "INTERNAL_SERVER_ERROR",
      message:
        error.message || "An unexpected error occurred while deleting students",
    });
  }
};

async function safeQuery(query, params, single = false) {
  try {
    if (!params || params.some((p) => typeof p === "undefined")) {
      throw new Error(`Invalid query parameters: ${JSON.stringify(params)}`);
    }
    const result = await performQuery(query, params, single);
    return result;
  } catch (err) {
    console.error("safeQuery error:", err.message);
    return [];
  }
}

export const uploadFile = async (req, res) => {
  try {
    console.log("========== 📤 BULK STUDENT UPLOAD START ==========");

    if (!req.file?.filename) {
      return res.status(400).json({
        status: false,
        message: "No file uploaded",
      });
    }

    const rows = await readXlsxFile(`./uploads/${req.file.filename}`);
    if (!rows || rows.length <= 1) {
      return res.status(422).json({
        status: false,
        message: "Empty / invalid Excel file",
      });
    }

    const headers = rows.shift();
    const failed = [];

    /* ---------------- MASTER LOOKUPS ---------------- */
    const gmasterValues = await db.query(
      `
      SELECT gv.id, gv.name, gm.name AS type
      FROM gmastervalue gv
      JOIN gmaster gm ON gm.id = gv.gmaster_id
      `,
      { type: db.QueryTypes.SELECT }
    );

    const hostels = await db.query(`SELECT id, name FROM hostel`, {
      type: db.QueryTypes.SELECT,
    });

    /* ✅ FIXED HERE */
    const mobiles = await db.query(
      `SELECT mobile FROM student WHERE mobile IS NOT NULL`,
      { type: db.QueryTypes.SELECT }
    );

    const mobileSet = new Set(mobiles.map((m) => String(m.mobile)));

    const normalize = (v) => v?.toString().trim().toLowerCase() || "";

    const findValueId = (value, type) => {
      if (!value) return null;
      const excelVal = normalize(value);

      const found = gmasterValues.find((e) => {
        if (normalize(e.type) !== normalize(type)) return false;
        const dbVal = normalize(e.name).split("-").pop().trim();
        return dbVal === excelVal;
      });

      return found?.id || null;
    };

    const findHostelId = (name) =>
      hostels.find((h) => normalize(h.name) === normalize(name))?.id || null;

    const isValidMobile = (m) => /^[6-9]\d{9}$/.test(String(m).trim());
    const isValidEmail = (e) =>
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(e).trim());

    /* ---------------- PROCESS ROWS ---------------- */
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      if (!r || r.every((c) => !c)) continue;

      const [
        sno,
        memberid,
        name,
        department,
        degree,
        mobile,
        email,
        expirydate,
        gender,
        hostelName,
        room,
        address,
        parentName,
        parentEmail,
        parentContact,
        remarks,
      ] = r;

      const errors = [];

      if (!memberid) errors.push("Member ID required");
      if (!name) errors.push("Name required");
      if (!mobile) errors.push("Mobile required");
      if (!hostelName) errors.push("Hostel required");

      if (mobile && !isValidMobile(mobile))
        errors.push("Invalid mobile number");

      if (mobile && mobileSet.has(String(mobile)))
        errors.push("Duplicate mobile number");

      if (email && !isValidEmail(email)) errors.push("Invalid email format");

      const depId = findValueId(department, "department");
      const degId = findValueId(degree, "degree");
      const genId = findValueId(gender, "gender");
      const hostelId = findHostelId(hostelName);

      if (!depId) errors.push(`Invalid Department: ${department}`);
      if (!degId) errors.push(`Invalid Degree: ${degree}`);
      if (!genId) errors.push(`Invalid Gender: ${gender}`);
      if (!hostelId) errors.push(`Invalid Hostel: ${hostelName}`);

      const roomNormalized = room != null ? String(room).trim() : "";

      const roomRow = await db.query(
        `
        SELECT gv.id
        FROM gmastervalue gv
        JOIN gmaster gm ON gv.gmaster_id = gm.id
        WHERE gv.name = :room
          AND gm.name LIKE 'location%'
        `,
        {
          replacements: { room: roomNormalized },
          type: db.QueryTypes.SELECT,
        }
      );

      if (!roomRow.length) {
        errors.push(`Invalid Room: ${room}`);
      }

      if (errors.length) {
        failed.push({ row: i + 2, data: r, error: errors.join(", ") });
        continue;
      }

      const bodyMapped = {
        data: {
          memberid: String(memberid).trim(),
          name: String(name).trim(),
          mobile: String(mobile).trim(),
          email: email || null,
          expirydate,
          hostel_id: hostelId,
          address: address || null,
          remarks: remarks || null,
          parentname: parentName || null,
          parentemail: parentEmail || null,
          parentcontact: parentContact || null,
          gender: genId,
          degree: degId,
          department: depId,
          locations: [roomRow[0].id],
          product_types: [],
        },
      };

      await CreateStudent(
        { body: bodyMapped, user: req.user },
        {
          status: () => ({ json: () => {} }),
        }
      );

      mobileSet.add(String(mobile));
    }

    if (failed.length) {
      const sheet = xlsx.utils.aoa_to_sheet([
        [...headers, "Error", "Row"],
        ...failed.map((f) => [...f.data, f.error, f.row]),
      ]);

      const wb = xlsx.utils.book_new();
      xlsx.utils.book_append_sheet(wb, sheet, "Failed");

      return res.send(xlsx.write(wb, { bookType: "xlsx", type: "buffer" }));
    }

    return res.json({
      status: true,
      message: "Bulk upload completed successfully",
    });
  } catch (e) {
    console.error("❌ Bulk upload error:", e);
    return res.status(500).json({ status: false, message: e.message });
  }
};

export const triggerEnroll = async (req, res) => {
  try {
    const studentId = req.params.id;
    const userId = req.user?.userId;

    const EASYTIME_URL = await getEASYTIMEURL(userId);
    const token = await getEasyTimeToken(null, EASYTIME_URL);

    // 1️⃣ Student
    const [[student]] = await db.query(
      "SELECT id, memberid, name, hostel_id FROM student WHERE id = ?",
      { replacements: [studentId] }
    );

    if (!student) {
      return res.status(404).json({
        status: false,
        message: "Student not found",
      });
    }

    // 2️⃣ Employee
    const empRes = await axios.get(`${EASYTIME_URL}/personnel/api/employees/`, {
      headers: { Authorization: `Token ${token}` },
      params: { emp_code: student.memberid },
    });

    const employee = empRes.data?.data?.[0];
    if (!employee) {
      return res.status(404).json({
        status: false,
        message: "Employee not found in WDMS",
      });
    }

    // 3️⃣ Save trigger time
    await db.query("UPDATE student SET bio_triggered_at = NOW() WHERE id = ?", {
      replacements: [studentId],
    });

    // 4️⃣ Registration device (✅ FIXED)
    const [registrationDevices] = await db.query(
      `
      SELECT device_sn
      FROM biometric_devices
      WHERE hostel_id = ?
        AND is_registration_device = 1
        AND status = 'Active'
      `,
      { replacements: [student.hostel_id] }
    );

    if (!registrationDevices.length) {
      return res.status(400).json({
        status: false,
        message: "No registration device mapped for this area",
      });
    }

    // 5️⃣ Trigger enrollment (✅ FIXED)
    await axios.post(
      `${EASYTIME_URL}/iclock/api/terminals/enroll_remotely/`,
      {
        device_sn: registrationDevices[0].device_sn,
        emp_code: student.memberid,
        bio_type: 1,
        finger: 0,
      },
      { headers: { Authorization: `Token ${token}` } }
    );

    // 6️⃣ Sync fingerprint (✅ FIXED)
    const [areaDevices] = await db.query(
      `
      SELECT device_sn
      FROM biometric_devices
      WHERE hostel_id = ?
        AND status = 'Active'
      `,
      { replacements: [student.hostel_id] }
    );

    await axios.post(
      `${EASYTIME_URL}/iclock/api/terminals/sync_data_to_device/`,
      {
        device_sn: areaDevices.map((d) => d.device_sn),
        employees: true,
        finger_print: true,
      },
      { headers: { Authorization: `Token ${token}` } }
    );

    return res.json({
      status: true,
      message: `Enrollment triggered for ${student.name}. Place finger on device.`,
      area: student.hostel_id,
    });
  } catch (err) {
    console.error("triggerEnroll error:", err.response?.data || err.message);
    return res.status(500).json({
      status: false,
      message: "Failed to trigger fingerprint enrollment",
    });
  }
};

export const checkFingerprintStatus = async (req, res) => {
  try {
    const { studentId } = req.params;
    const userId = req.user?.userId;

    const EASYTIME_URL = await getEASYTIMEURL(userId);
    const token = await getEasyTimeToken(null, EASYTIME_URL);

    // 1️⃣ Student
    const [[student]] = await db.query(
      "SELECT memberid, bio_triggered_at FROM student WHERE id = ?",
      { replacements: [studentId] }
    );

    if (!student || !student.bio_triggered_at) {
      return res.json({
        status: true,
        fingerprint_enrolled: false,
        phase: "WAITING_FOR_TRIGGER",
      });
    }

    const triggerTime = new Date(student.bio_triggered_at);

    // 2️⃣ Employee
    const empRes = await axios.get(`${EASYTIME_URL}/personnel/api/employees/`, {
      headers: { Authorization: `Token ${token}` },
      params: { emp_code: student.memberid },
    });

    const employee = empRes.data?.data?.[0];
    if (!employee) {
      return res.json({
        status: true,
        fingerprint_enrolled: false,
        phase: "EMPLOYEE_NOT_FOUND",
      });
    }

    // 🔥 3️⃣ Biodatas = ONLY SOURCE OF TRUTH
    const bioRes = await axios.get(`${EASYTIME_URL}/iclock/api/biodatas/`, {
      headers: { Authorization: `Token ${token}` },
      params: {
        employee: employee.id,
        bio_type: 1,
        ordering: "-update_time",
        page_size: 1,
      },
    });

    const bio = bioRes.data?.data?.[0];
    if (!bio) {
      return res.json({
        status: true,
        fingerprint_enrolled: false,
        phase: "NO_BIODATA_YET",
      });
    }

    const bioTime = new Date(bio.update_time);

    // ✅ STRICT CHECK (NO WINDOW, NO GUESSING)
    if (bioTime > triggerTime) {
      return res.json({
        status: true,
        fingerprint_enrolled: true,
        phase: "ENROLLED",
        enrolled_at: bio.update_time,
      });
    }

    return res.json({
      status: true,
      fingerprint_enrolled: false,
      phase: "OLD_FINGERPRINT",
    });
  } catch (err) {
    console.error(
      "checkFingerprintStatus error:",
      err.response?.data || err.message
    );
    return res.status(500).json({
      status: false,
      message: "Failed to check fingerprint status",
    });
  }
};
