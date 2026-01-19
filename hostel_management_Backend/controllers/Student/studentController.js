import { db, performQuery } from "../../config/Database.js";
import os from "os";
import { getCurrentISTTime } from "../../Utils/Datetime.js";
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

  const rows = isBulk ? req.body?.data || [] : [req.body?.data || req.body];
  const userId = req.user?.userId || 0;

  const EASYTIME_URL = await getEASYTIMEURL(userId);
  const token = await getEasyTimeToken(userId);

  const results = [];
  const wdmsCreatedIds = []; // track wdms ids for rollback

  try {
    if (isBulk) await db.query("START TRANSACTION"); // start bulk transaction

    for (const bodydata of rows) {
      let studentId = null;
      let wdmsEmployeeId = null;

      try {
        const nameRegex = /^[A-Za-z\s]+$/; // only letters and spaces
        if (!bodydata.name || !nameRegex.test(bodydata.name.trim())) {
          throw new Error(
            "Invalid student name. Only alphabets and spaces are allowed."
          );
        }
        // ================= WDMS Sync =================
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const hireDate = yesterday.toISOString().split("T")[0];
        const today = QueryTime.split(" ")[0];

        // department WDMS ID
        const [[{ wdms_id: deptId } = {}]] = await db.query(
          "SELECT wdms_id FROM wdms_mapping WHERE local_type='department' AND local_id=?",
          { replacements: [bodydata.department] }
        );
        if (!deptId) throw new Error("WDMS_DEPARTMENT_ID_MISSING");

        // Gender normalization
        let gender = "M";
        const rawGender = bodydata.gender;
        if (typeof rawGender === "string")
          gender = rawGender.trim().toLowerCase().startsWith("f") ? "F" : "M";
        else if (rawGender == 2) gender = "F";
        else if (rawGender == 1) gender = "M";

        // Validity end date
        let validityEnd = "2099-12-31";
        if (bodydata.expirydate) {
          const d = new Date(bodydata.expirydate);
          if (!isNaN(d.getTime())) validityEnd = d.toISOString().split("T")[0];
        }
        if (validityEnd <= today) {
          const d = new Date(today);
          d.setFullYear(d.getFullYear() + 1);
          validityEnd = d.toISOString().split("T")[0];
        }

        const wdmsPayload = {
          emp_code: bodydata.memberid?.trim(),
          first_name: bodydata.name?.trim(),
          department: bodydata.department,
          position: 1,
          area: [bodydata.hostel_id || 1],
          hire_date: hireDate,
          gender,
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

        wdmsEmployeeId = wdmsRes?.data?.id;
        if (!wdmsEmployeeId) throw new Error("WDMS_INSERT_FAILED");
        wdmsCreatedIds.push(wdmsEmployeeId);

        // ================= Local DB Insert =================
        const [result] = await db.query(
          `INSERT INTO student
           (name, memberid, mobile, email, address, remarks, createdby,
            parentname, parentcontact, parentemail, expirydate, hostel_id, bio_triggered_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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

        studentId =
          result?.insertId ||
          (await db.query("SELECT LAST_INSERT_ID() AS id"))[0][0].id;
        if (!studentId) throw new Error("STUDENT_INSERT_FAILED");

        await insertStudentGMasterMap(db, studentId, bodydata.locations || [], {
          gender: bodydata.gender,
          degree: bodydata.degree,
          department: bodydata.department,
        });

        const terminalId = os.hostname() || "DEFAULT";
        await db.query(
          `INSERT INTO studentlog (student_id, terminalid, transtime) VALUES (?, ?, NOW())`,
          { replacements: [studentId, terminalId] }
        );

        await db.query(
          "INSERT INTO wdms_mapping (local_type, local_id, wdms_id) VALUES (?, ?, ?)",
          { replacements: ["employee", studentId, wdmsEmployeeId] }
        );

        results.push({ success: true, studentId });
      } catch (error) {
        // Rollback bulk DB and WDMS
        if (isBulk) await db.query("ROLLBACK");

        // Delete current and previous WDMS employees
        for (const id of wdmsCreatedIds) {
          try {
            await axios.delete(
              `${EASYTIME_URL}/personnel/api/employees/${id}/`,
              {
                headers: { Authorization: `Token ${token}` },
              }
            );
          } catch {}
        }

        results.push({
          success: false,
          error: error.response?.data || error.message,
          student: bodydata,
        });

        break; // stop bulk insert on first failure
      }
    }

    if (isBulk && results.every((r) => r.success)) await db.query("COMMIT");

    // ================= Return Response =================
    if (!isBulk && res) {
      const successRow = results.find((r) => r.success);

      if (!successRow) {
        const firstError = results[0]?.error;

        let errorMessage = "Student creation failed";

        // ✅ Convert WDMS error object → clean string
        if (firstError && typeof firstError === "object") {
          const key = Object.keys(firstError)[0]; // emp_code
          const value = firstError[key]?.[0]; // Enter a valid value.
          if (key && value) {
            errorMessage = `${key}: ${value}`;
          }
        } else if (typeof firstError === "string") {
          errorMessage = firstError;
        }

        return res.status(400).json({
          status: false,
          message: errorMessage, // ✅ clean message only
        });
      }

      return res.status(200).json({
        status: true,
        message: "Student created successfully",
        student_id: successRow.studentId,
      });
    }

    if (isBulk) {
      const successCount = results.filter((r) => r.success).length;
      return successCount === results.length
        ? { status: true, message: "Bulk upload successful", results }
        : {
            status: false,
            message: "Bulk upload failed. No partial insert allowed.",
            results,
          };
    }

    return { status: true, results };
  } catch (error) {
    if (isBulk) await db.query("ROLLBACK");
    if (!isBulk && res)
      return res.status(500).json({ status: false, error: error.message });
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
    s.mobile LIKE ? OR
    s.parentcontact LIKE ? OR
    s.parentemail LIKE ?
  )`);

      params.push(
        `%${searchTerm}%`,
        `%${searchTerm}%`,
        `%${searchTerm}%`,
        `%${searchTerm}%`,
        `%${searchTerm}%`
      );
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

    const [bioDevices] = await db.query(`
  SELECT hostel_id, biometric_type
  FROM biometric_devices
  WHERE status = 'Active'
    AND is_registration_device = 1
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

    const hostelBioMap = {};

    bioDevices.forEach((d) => {
      if (!hostelBioMap[d.hostel_id]) {
        hostelBioMap[d.hostel_id] = new Set();
      }

      if (d.biometric_type === "BOTH") {
        hostelBioMap[d.hostel_id].add("FINGER");
        hostelBioMap[d.hostel_id].add("FACE");
      } else {
        hostelBioMap[d.hostel_id].add(d.biometric_type);
      }
    });

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
          available_biometrics: Array.from(hostelBioMap[stu.hostel_id] || []),
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
      data: finalStudents, // ? FIXED
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
  let transaction;

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

    // 1?? GET OLD STUDENT
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

    // 2?? START TRANSACTION
    transaction = await db.transaction();

    // 3?? UPDATE LOCAL STUDENT
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
        transaction,
      }
    );

    // 4?? WDMS SETUP
    const EASYTIME_URL = (await getEASYTIMEURL(userId)).replace(/\/+$/, "");
    const token = await getEasyTimeToken(userId);
    const today = QueryTime.split(" ")[0];

    // 5?? FETCH EMPLOYEE FROM WDMS
    let employee;
    try {
      const empRes = await axios.get(
        `${EASYTIME_URL}/personnel/api/employees/${bodydata.memberid}/`,
        { headers: { Authorization: `Token ${token}` } }
      );
      employee = empRes.data;
    } catch (err) {
      if (err.response?.status === 404)
        throw new Error("WDMS_EMPLOYEE_NOT_FOUND");
      throw err;
    }

    const empCode = employee.emp_code;
    if (!empCode) throw new Error("WDMS_EMP_CODE_MISSING");

    // 6?? AREA & DEPARTMENT MAPPING
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

    // 7?? UPDATE WDMS EMPLOYEE
    const patchBody = {
      first_name: bodydata.name || employee.first_name,
      last_name: bodydata.last_name || employee.last_name || "",
      nickname: employee.nickname || "",
      mobile: bodydata.mobile || employee.mobile || "",
      email: bodydata.email || employee.email || "",
      hire_date: employee.hire_date,
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

    await axios.patch(
      `${EASYTIME_URL}/personnel/api/employees/${empCode}/`,
      patchBody,
      { headers: { Authorization: `Token ${token}` } }
    );

    // 8?? BIOMETRIC DEVICE SYNC
    if (oldHostelId !== newHostelId) {
      const [oldDevices] = await db.query(
        "SELECT device_sn FROM biometric_devices WHERE hostel_id=? AND status='Active'",
        { replacements: [oldHostelId] }
      );
      const [newDevices] = await db.query(
        "SELECT device_sn FROM biometric_devices WHERE hostel_id=? AND status='Active'",
        { replacements: [newHostelId] }
      );

      const syncURL = `${EASYTIME_URL}/iclock/api/terminals/sync_data_to_device/`;

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

    // 9?? COMMIT TRANSACTION
    await transaction.commit();

    return res.status(200).json({
      status: true,
      message: "Student updated successfully",
      student_id: studentId,
      hostel_changed: oldHostelId !== newHostelId,
    });
  } catch (error) {
    if (transaction) await transaction.rollback();

    console.error("? UpdateStudent Error:", {
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

    // ? Get student member IDs
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

    // ? DELETE IN WDMS FIRST
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
          console.log(`? WDMS employee deleted ? ${empCode}`);
        } catch (err) {
          console.warn(
            `? WDMS delete failed for ${empCode}`,
            err.response?.data || err.message
          );
        }
      }
    } catch (err) {
      console.warn("? WDMS deletion encountered errors:", err.message);
    }

    // ? DELETE FROM LOCAL DATABASE
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
    console.log("? Local DB deletion success");

    return res.status(200).json({
      status: true,
      message: `${studentIds.length} student(s) deleted successfully`,
      deleted_ids: studentIds,
      wdms_deleted_emp_codes: wdmsDeleted,
    });
  } catch (error) {
    console.error("? DeleteStudent Error:", error);
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

export const uploadFile = async (req, res) => {
  try {
    console.log("========== ?? BULK STUDENT UPLOAD START ==========");

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
      SELECT gv.id, gv.name, gv.hostel_id, gm.name AS type
      FROM gmastervalue gv
      JOIN gmaster gm ON gm.id = gv.gmaster_id
      `,
      { type: db.QueryTypes.SELECT }
    );

    const hostels = await db.query(`SELECT id, name FROM hostel`, {
      type: db.QueryTypes.SELECT,
    });

    const memberIds = await db.query(
      `SELECT memberid FROM student WHERE memberid IS NOT NULL`,
      { type: db.QueryTypes.SELECT }
    );

    const memberIdSet = new Set(
      memberIds.map((m) => String(m.memberid).trim())
    );

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

    /* 🔥 ONLY CHANGE STARTS HERE */
    const findDepartmentId = (department, institute, hostelId) => {
      if (!department || !institute || !hostelId) return null;

      // LOG 1: Excel department value
      console.log("📥 Excel Department:", department);

      const dept = normalize(department);
      const inst = normalize(institute);

      const prefixedDept1 = `${inst} - ${dept}`;
      const prefixedDept2 = `${inst}-${dept}`;

      // LOG 2: After prefix added (before DB check)
      console.log("🔗 Prefixed Department for DB check:", {
        prefixedDept1,
        prefixedDept2,
        hostelId,
      });

      const found = gmasterValues.find((e) => {
        if (normalize(e.type) !== "department") return false;
        if (Number(e.hostel_id) !== Number(hostelId)) return false;

        const dbName = normalize(e.name);
        return dbName === prefixedDept1 || dbName === prefixedDept2;
      });

      // LOG 3: Match result
      console.log(
        found
          ? `✅ Department matched: ${found.name}`
          : "❌ Department not found"
      );

      return found?.id || null;
    };
    /* 🔥 ONLY CHANGE ENDS HERE */

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
        institute,
        room,
        address,
        parentName,
        parentEmail,
        parentContact,
        remarks,
      ] = r;

      const errors = [];

      if (!memberid) errors.push("Member ID required");
      if (memberid && memberIdSet.has(String(memberid).trim())) {
        errors.push("Duplicate Member ID");
      }

      const emails = await db.query(
        `SELECT email FROM student WHERE email IS NOT NULL`,
        { type: db.QueryTypes.SELECT }
      );

      const emailSet = new Set(
        emails.map((e) => String(e.email).trim().toLowerCase())
      );

      if (!name) errors.push("Name required");
      if (!mobile) errors.push("Mobile required");
      if (!institute) errors.push("Institute required");

      if (mobile && !isValidMobile(mobile))
        errors.push("Invalid mobile number");

      if (mobile && mobileSet.has(String(mobile)))
        errors.push("Duplicate mobile number");

      if (email && !isValidEmail(email)) errors.push("Invalid email format");

      if (email && emailSet.has(String(email).trim().toLowerCase())) {
        errors.push("Duplicate Email");
      }

      const hostelId = findHostelId(institute);

      const depId = findDepartmentId(department, institute, hostelId);
      const degId = findValueId(degree, "degree");
      const genId = findValueId(gender, "gender");

      if (!depId)
        errors.push(
          `Invalid Department '${department}' for Institute '${institute}'`
        );
      if (!degId) errors.push(`Invalid Degree: ${degree}`);
      if (!genId) errors.push(`Invalid Gender: ${gender}`);
      if (!hostelId) errors.push(`Invalid Institute: ${institute}`);

      if (expirydate) {
        const today = new Date();
        const expDate = new Date(expirydate);
        expDate.setHours(0, 0, 0, 0);
        today.setHours(0, 0, 0, 0);
        if (expDate < today) errors.push("Expiry date cannot be in the past");
      }

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
    console.error("? Bulk upload error:", e);
    return res.status(500).json({ status: false, message: e.message });
  }
};

//finger print entrollment trigger
// export const triggerEnroll = async (req, res) => {
//   try {
//     const studentId = req.params.id;
//     const userId = req.user?.userId;

//     const EASYTIME_URL = await getEASYTIMEURL(userId);
//     const token = await getEasyTimeToken(null, EASYTIME_URL);

//     const [[student]] = await db.query(
//       "SELECT id, memberid, name, hostel_id FROM student WHERE id = ?",
//       { replacements: [studentId] }
//     );

//     if (!student) {
//       return res.status(404).json({
//         status: false,
//         message: "Student not found",
//       });
//     }

//     // Save enroll start time
//     await db.query(
//       "UPDATE student SET bio_enroll_started_at = NOW() WHERE id = ?",
//       { replacements: [studentId] }
//     );

//     // Get employee from EasyTime
//     const empRes = await axios.get(`${EASYTIME_URL}/personnel/api/employees/`, {
//       headers: { Authorization: `Token ${token}` },
//       params: { emp_code: student.memberid },
//     });

//     const employee = empRes.data?.data?.[0];
//     if (!employee) {
//       return res.status(404).json({
//         status: false,
//         message: "Employee not found in WDMS",
//       });
//     }

//     // Get registration device
//     const [registrationDevices] = await db.query(
//       `
//       SELECT device_sn
//       FROM biometric_devices
//       WHERE hostel_id = ?
//         AND is_registration_device = 1
//         AND status = 'Active'
//       `,
//       { replacements: [student.hostel_id] }
//     );

//     if (!registrationDevices.length) {
//       return res.status(400).json({
//         status: false,
//         message: "No registration device mapped for this area",
//       });
//     }

//     const deviceSN = registrationDevices[0].device_sn;

//     // Delete old fingerprint (update case)
//     const oldBioRes = await axios.get(`${EASYTIME_URL}/iclock/api/biodatas/`, {
//       headers: { Authorization: `Token ${token}` },
//       params: { employee: employee.id, bio_type: 1, page_size: 100 },
//     });

//     const oldBios = oldBioRes.data?.data || [];
//     for (const bio of oldBios) {
//       try {
//         await axios.delete(`${EASYTIME_URL}/iclock/api/biodatas/${bio.id}/`, {
//           headers: { Authorization: `Token ${token}` },
//         });
//       } catch (e) {
//         console.error(
//           `Failed to delete old bio ${bio.id}`,
//           e.response?.data || e.message
//         );
//       }
//     }

//     // Trigger enrollment
//     await axios.post(
//       `${EASYTIME_URL}/iclock/api/terminals/enroll_remotely/`,
//       {
//         device_sn: deviceSN,
//         emp_code: student.memberid,
//         bio_type: 1,
//         finger: 0,
//       },
//       { headers: { Authorization: `Token ${token}` } }
//     );

//     // Sync to area devices
//     const [areaDevices] = await db.query(
//       `
//       SELECT device_sn
//       FROM biometric_devices
//       WHERE hostel_id = ?
//         AND status = 'Active'
//       `,
//       { replacements: [student.hostel_id] }
//     );

//     await axios.post(
//       `${EASYTIME_URL}/iclock/api/terminals/sync_data_to_device/`,
//       {
//         device_sn: areaDevices.map((d) => d.device_sn),
//         employees: true,
//         finger_print: true,
//       },
//       { headers: { Authorization: `Token ${token}` } }
//     );

//     return res.json({
//       status: true,
//       device_online: true,
//       message: `Enrollment triggered for ${student.name}. Place finger on device.`,
//       area: student.hostel_id,
//     });
//   } catch (err) {
//     console.error("triggerEnroll error:", err.response?.data || err.message);
//     return res.status(500).json({
//       status: false,
//       message: "Failed to trigger fingerprint enrollment",
//     });
//   }
// };

// export const checkFingerprintStatus = async (req, res) => {
//   try {
//     const { studentId } = req.params;
//     const userId = req.user?.userId;

//     const EASYTIME_URL = await getEASYTIMEURL(userId);
//     const token = await getEasyTimeToken(null, EASYTIME_URL);

//     // 1️⃣ Get student
//     const [[student]] = await db.query(
//       `
//       SELECT memberid, bio_enroll_started_at
//       FROM student
//       WHERE id = ?
//       `,
//       { replacements: [studentId] }
//     );

//     if (!student || !student.bio_enroll_started_at) {
//       return res.json({
//         status: true,
//         fingerprint_enrolled: false,
//         phase: "WAITING_FOR_TRIGGER",
//       });
//     }

//     const triggerTime = new Date(student.bio_enroll_started_at);

//     // 2️⃣ Get employee
//     const empRes = await axios.get(`${EASYTIME_URL}/personnel/api/employees/`, {
//       headers: { Authorization: `Token ${token}` },
//       params: { emp_code: student.memberid },
//     });

//     const employee = empRes.data?.data?.[0];
//     if (!employee) {
//       return res.json({
//         status: true,
//         fingerprint_enrolled: false,
//         phase: "EMPLOYEE_NOT_FOUND",
//       });
//     }

//     // 3️⃣ Poll for new fingerprint (after deletion if any)
//     let retries = 10;
//     let bio = null;
//     while (retries > 0 && !bio) {
//       const bioRes = await axios.get(`${EASYTIME_URL}/iclock/api/biodatas/`, {
//         headers: { Authorization: `Token ${token}` },
//         params: {
//           employee: employee.id,
//           bio_type: 1,
//           ordering: "-update_time",
//           page_size: 1,
//         },
//       });
//       bio = bioRes.data?.data?.[0] || null;

//       // Check if uploaded after trigger
//       if (bio && new Date(bio.update_time) <= triggerTime) {
//         bio = null;
//       }

//       if (!bio) {
//         await new Promise((r) => setTimeout(r, 3000)); // wait 3 sec
//         retries--;
//       }
//     }

//     if (!bio) {
//       return res.json({
//         status: true,
//         fingerprint_enrolled: false,
//         phase: "WAITING_FOR_FINGER",
//       });
//     }

//     // 4️⃣ Update student record
//     await db.query(
//       `
//       UPDATE student
//       SET bio_triggered_at = ?,
//           bio_enroll_started_at = NULL
//       WHERE id = ?
//       `,
//       { replacements: [bio.update_time, studentId] }
//     );

//     return res.json({
//       status: true,
//       fingerprint_enrolled: true,
//       phase: "ENROLLED",
//       enrolled_at: bio.update_time,
//     });
//   } catch (err) {
//     console.error(
//       "checkFingerprintStatus error:",
//       err.response?.data || err.message
//     );
//     return res.status(500).json({
//       status: false,
//       message: "Failed to check fingerprint status",
//     });
//   }
// };
//before face device

export const triggerEnroll = async (req, res) => {
  try {
    const studentId = req.params.id;
    const userId = req.user?.userId;

    // 👉 NEW (default fingerprint)
    const bio_type = Number(req.body.bio_type || 1); // 1=fingerprint, 2=face

    const EASYTIME_URL = await getEASYTIMEURL(userId);
    const token = await getEasyTimeToken(null, EASYTIME_URL);

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

    // Save enroll start time
    await db.query(
      "UPDATE student SET bio_enroll_started_at = NOW() WHERE id = ?",
      { replacements: [studentId] }
    );

    // Get employee
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

    // Get registration device
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

    const deviceSN = registrationDevices[0].device_sn;

    // Delete old biometrics (finger OR face)
    const oldBioRes = await axios.get(`${EASYTIME_URL}/iclock/api/biodatas/`, {
      headers: { Authorization: `Token ${token}` },
      params: {
        employee: employee.id,
        bio_type,
        page_size: 100,
      },
    });

    const oldBios = oldBioRes.data?.data || [];
    for (const bio of oldBios) {
      try {
        await axios.delete(`${EASYTIME_URL}/iclock/api/biodatas/${bio.id}/`, {
          headers: { Authorization: `Token ${token}` },
        });
      } catch (e) {
        console.error(`Failed to delete old bio ${bio.id}`, e.message);
      }
    }

    // Trigger enrollment
    await axios.post(
      `${EASYTIME_URL}/iclock/api/terminals/enroll_remotely/`,
      {
        device_sn: deviceSN,
        emp_code: student.memberid,
        bio_type, // 👈 fingerprint OR face
        finger: bio_type === 1 ? 0 : undefined,
      },
      { headers: { Authorization: `Token ${token}` } }
    );

    // Sync devices
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
        finger_print: bio_type === 1,
        face: bio_type === 2,
      },
      { headers: { Authorization: `Token ${token}` } }
    );

    return res.json({
      status: true,
      device_online: true,
      bio_type,
      message:
        bio_type === 1
          ? `Fingerprint enrollment triggered for ${student.name}`
          : `Face enrollment triggered for ${student.name}`,
    });
  } catch (err) {
    console.error("triggerEnroll error:", err.response?.data || err.message);
    return res.status(500).json({
      status: false,
      message: "Failed to trigger biometric enrollment",
    });
  }
};

export const checkFingerprintStatus = async (req, res) => {
  try {
    const { studentId } = req.params;
    const userId = req.user?.userId;

    // 👉 NEW
    const bio_type = Number(req.query.bio_type || 1);

    const EASYTIME_URL = await getEASYTIMEURL(userId);
    const token = await getEasyTimeToken(null, EASYTIME_URL);

    const [[student]] = await db.query(
      `
      SELECT memberid, bio_enroll_started_at
      FROM student
      WHERE id = ?
      `,
      { replacements: [studentId] }
    );

    if (!student || !student.bio_enroll_started_at) {
      return res.json({
        status: true,
        biometric_enrolled: false,
        phase: "WAITING_FOR_TRIGGER",
      });
    }

    const triggerTime = new Date(student.bio_enroll_started_at);

    const empRes = await axios.get(`${EASYTIME_URL}/personnel/api/employees/`, {
      headers: { Authorization: `Token ${token}` },
      params: { emp_code: student.memberid },
    });

    const employee = empRes.data?.data?.[0];
    if (!employee) {
      return res.json({
        status: true,
        biometric_enrolled: false,
        phase: "EMPLOYEE_NOT_FOUND",
      });
    }

    let retries = 10;
    let bio = null;

    while (retries > 0 && !bio) {
      const bioRes = await axios.get(`${EASYTIME_URL}/iclock/api/biodatas/`, {
        headers: { Authorization: `Token ${token}` },
        params: {
          employee: employee.id,
          bio_type,
          ordering: "-update_time",
          page_size: 1,
        },
      });

      bio = bioRes.data?.data?.[0] || null;

      if (bio && new Date(bio.update_time) <= triggerTime) {
        bio = null;
      }

      if (!bio) {
        await new Promise((r) => setTimeout(r, 3000));
        retries--;
      }
    }

    if (!bio) {
      return res.json({
        status: true,
        biometric_enrolled: false,
        phase: "WAITING_FOR_BIOMETRIC",
      });
    }

    await db.query(
      `
      UPDATE student
      SET bio_triggered_at = ?,
          bio_enroll_started_at = NULL
      WHERE id = ?
      `,
      { replacements: [bio.update_time, studentId] }
    );

    return res.json({
      status: true,
      biometric_enrolled: true,
      bio_type,
      phase: "ENROLLED",
      enrolled_at: bio.update_time,
    });
  } catch (err) {
    console.error("checkFingerprintStatus error:", err.message);
    return res.status(500).json({
      status: false,
      message: "Failed to check biometric status",
    });
  }
};
