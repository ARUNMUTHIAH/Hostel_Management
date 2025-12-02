import { db, performQuery } from "../../config/Database.js";
import os from "os";
import { getCurrentISTTime } from "../../Utils/Datetime.js";
import { handleSequelizeError } from "../../config/validationCheck.js";
import { validateStudentInput } from "./validateStudentInput.js";
import readXlsxFile from "read-excel-file/node";
import xlsx from "xlsx";

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

export const CreateStudent = async (req, res) => {
  const QueryTime = await getCurrentISTTime();

  try {
    const bodydata = req.body?.data || req.body;
    const UserID = req.user?.userId || 0;

    // Check mandatory arrays
    if (!bodydata?.locations || !bodydata?.product_types) {
      return res.status(400).json({
        status: false,
        message: !bodydata.locations
          ? "Locations are required"
          : "Product types are required",
      });
    }

    // Validation
    const validation = await validateStudentInput(bodydata, db);
    if (validation.error) {
      return res.status(validation.statusCode || 400).json({
        status: false,
        message: validation.message,
      });
    }

    await db.query("START TRANSACTION");

    // ------------------------------------------
    // CORRECT REPLACEMENTS (11 VALUES)
    // ------------------------------------------
    const replacements = [
      bodydata.name ?? "",
      bodydata.memberid?.trim() ?? "",
      bodydata.mobile ?? "",
      //   bodydata.alternate_mobile ?? null,
      bodydata.email ?? null,
      bodydata.address ?? null,
      bodydata.remarks ?? null,
      UserID, // createdby MUST BE INTEGER
      bodydata.parentname ?? null,
      bodydata.parentcontact ?? null,
      bodydata.parentemail ?? null,
      bodydata.expirydate ?? null,
      bodydata.hostel_id ?? null,
    ];

    const [rows] = await db.query(
      `INSERT INTO student
      (name, memberid, mobile, email, address, remarks, createdby, parentname, parentcontact, parentemail,expirydate,hostel_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?,?,?)`,
      { replacements }
    );

    // Fetch inserted ID
    let studentId = rows?.insertId;

    if (!studentId) {
      const [idRows] = await db.query(`SELECT LAST_INSERT_ID() AS id`);
      studentId = idRows?.[0]?.id;
    }

    if (!studentId) throw new Error("studentId not found after insert");

    // Insert mappings
    await insertStudentGMasterMap(db, studentId, bodydata.locations, {
      gender: bodydata.gender,
      degree: bodydata.degree,
      department: bodydata.department,
    });

    // Insert log
    const terminalId = os.hostname() || "DEFAULT";
    await db.query(
      `INSERT INTO studentlog (student_id, terminalid, transtime) VALUES (?, ?, NOW())`,
      { replacements: [studentId, terminalId] }
    );

    await db.query("COMMIT");

    return res.status(200).json({
      status: true,
      message: "Student created successfully",
      student_id: studentId,
    });
  } catch (error) {
    console.error("CreateStudent Error:", error);
    try {
      await db.query("ROLLBACK");
    } catch {}

    const err = handleSequelizeError(error);
    return res.status(err.statusCode || 500).json({
      status: false,
      message: err.message,
    });
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
      pageSize: usePagination ? pageSize : total, // if no pagination, pagesize = total
      page: usePagination ? Math.floor(offset / pageSize) + 1 : 1,
      data: id ? finalStudents[0] : finalStudents,
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

  try {
    const studentId = req.body?.id || req.params?.id;
    if (!studentId) throw new Error("Student ID required");

    const bodydata = req.body?.data || req.body;
    const UserID = req.user?.userId || 0;

    // Validate input
    const validation = await validateStudentInput(bodydata, db, "update");
    if (validation.error) {
      return res.status(validation.statusCode || 400).json({
        status: false,
        message: validation.message,
      });
    }

    await db.query("START TRANSACTION");

    // Update main student info
    const replacements = [
      bodydata.name ?? "",
      bodydata.memberid?.trim() ?? "",
      bodydata.mobile ?? "",
      bodydata.email ?? null,
      bodydata.parentemail ?? null,
      bodydata.address ?? null,
      bodydata.remarks ?? null,
      UserID,
      bodydata.parentname ?? null,
      bodydata.parentcontact ?? null,
      bodydata.expirydate ?? null,
      bodydata.hostel_id ?? null,
      studentId,
    ];

    const [result] = await db.query(
      `UPDATE student SET 
        name = ?, 
        memberid = ?, 
        mobile = ?, 
        email = ?, 
        address = ?, 
        remarks = ?, 
        updatedby = ?, 
        parentname = ?, 
        parentcontact = ?, 
        parentemail = ?,
        expirydate = ?, 
        hostel_id = ?
      WHERE id = ?`,
      { replacements }
    );

    if (!result || result.affectedRows === 0) {
      await db.query("ROLLBACK");
      return res
        .status(404)
        .json({ status: false, message: "Student not found" });
    }

    // Reset GMaster mappings
    await db.query("DELETE FROM studentgmastermap WHERE student_id = ?", {
      replacements: [studentId],
    });

    // Insert new mappings
    await insertStudentGMasterMap(db, studentId, bodydata.locations || [], {
      gender: bodydata.gender,
      degree: bodydata.degree,
      department: bodydata.department,
    });

    // Insert update log
    const terminalId = os.hostname() || "DEFAULT";
    await db.query(
      `INSERT INTO studentlog (student_id, terminalid, transtime) VALUES (?, ?, NOW())`,
      { replacements: [studentId, terminalId] }
    );

    await db.query("COMMIT");

    return res.status(200).json({
      status: true,
      message: "Student updated successfully",
      student_id: studentId,
    });
  } catch (error) {
    console.error("UpdateStudent Error:", error);
    try {
      await db.query("ROLLBACK");
    } catch (_) {}
    const err = handleSequelizeError(error);
    return res
      .status(err.statusCode || 500)
      .json({ status: false, message: err.message });
  }
};

export const DeleteStudent = async (req, res) => {
  try {
    const ids = req.params?.id;
    if (!ids) throw new Error("Student ID is required");

    // Convert "56,58" → [56, 58]
    const studentIds = ids
      .split(",")
      .map((id) => Number(id.trim()))
      .filter(Boolean);

    if (studentIds.length === 0)
      return res
        .status(400)
        .json({ status: false, message: "Invalid student IDs" });

    await db.query("START TRANSACTION");

    const terminalId = os.hostname() || "DEFAULT";

    // Insert logs for each student
    for (const id of studentIds) {
      await db.query(
        `INSERT INTO studentlog (student_id, terminalid, transtime) VALUES (?, ?, NOW())`,
        { replacements: [id, terminalId] }
      );
    }

    // Delete GMaster mappings
    await db.query(
      `DELETE FROM studentgmastermap WHERE student_id IN (${studentIds
        .map(() => "?")
        .join(",")})`,
      { replacements: studentIds }
    );

    // Delete students
    const [deleteResult] = await db.query(
      `DELETE FROM student WHERE id IN (${studentIds
        .map(() => "?")
        .join(",")})`,
      { replacements: studentIds }
    );

    await db.query("COMMIT");

    return res.json({
      status: true,
      message: `${studentIds.length} student(s) deleted permanently`,
      deleted_ids: studentIds,
    });
  } catch (error) {
    console.error("DeleteStudent Error:", error);
    try {
      await db.query("ROLLBACK");
    } catch (_) {}

    return res.status(500).json({ status: false, message: error.message });
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
      return res
        .status(400)
        .json({ status: false, message: "No file uploaded" });
    }

    const filePath = `./uploads/${req.file.filename}`;
    const rows = await readXlsxFile(filePath);

    if (!rows || rows.length <= 1) {
      return res
        .status(422)
        .json({ status: false, message: "Empty / invalid Excel file" });
    }

    const originalHeaders = rows[0];
    rows.shift(); // remove header row
    const failed = [];

    // ----------------------------
    // 🔥 PRELOAD LOOKUPS
    // ----------------------------
    const [gmasterValues] = await db.query(`
      SELECT gv.id, gv.name, gm.name AS type
      FROM gmastervalue gv
      JOIN gmaster gm ON gm.id = gv.gmaster_id
    `);

    const safeFetch = async (table, name) => {
      if (!name) return [];
      const nameStr = typeof name === "string" ? name.trim() : String(name);
      return safeQuery(
        `SELECT id FROM ${table} WHERE name = ?`,
        [nameStr],
        true
      );
    };

    const [hostels] = await db.query(`SELECT id, name FROM hostel`);

    const normalize = (v) => v?.toString()?.trim()?.toLowerCase() || "";

    const findValueId = (value, type) =>
      gmasterValues.find(
        (e) =>
          normalize(e.name) === normalize(value) &&
          normalize(e.type) === normalize(type)
      )?.id || null;

    const findHostelId = (value) =>
      hostels.find((h) => normalize(h.name) === normalize(value))?.id || null;

    // ----------------------------
    // 📅 DATE FORMAT
    // ----------------------------
    const convertDate = (d) => {
      if (!d) return null;
      if (d instanceof Date) {
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(
          2,
          "0"
        )}-${String(d.getDate()).padStart(2, "0")}`;
      }
      const [dd, mm, yyyy] = String(d).split("-");
      return `${yyyy}-${mm}-${dd}`;
    };

    // ----------------------------
    // 🔁 PROCESS ROWS
    // ----------------------------
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
        hostel_name, // ⬅ new header instead of hostel_id
        room, // ⬅ new header instead of location
        address,
        parentName,
        parentContact,
        parentEmail,
        remarks,
      ] = r;

      console.log(r, "erwrwqrqewr");

      const errors = [];

      const [dataLocation] = await Promise.all([
        safeFetch("gmastervalue", room),
      ]);

      if (!memberid) errors.push("Member ID missing");
      if (!name) errors.push("Name missing");
      if (!mobile) errors.push("Phone missing");
      if (!hostel_name) errors.push("Hostel missing");

      const depId = findValueId(department, "Department");
      const degId = findValueId(degree, "Degree");
      const genId = findValueId(gender, "Gender");
      const hostelId = findHostelId(hostel_name);

      if (!depId) errors.push(`Invalid Department: ${department}`);
      if (!degId) errors.push(`Invalid Degree: ${degree}`);
      if (!genId) errors.push(`Invalid Gender: ${gender}`);
      if (!hostelId) errors.push(`Invalid Hostel: ${hostel_name}`);

      if (!dataLocation.length) errors.push(`Invalid Room: ${room}`);

      if (errors.length) {
        failed.push({ row: i + 2, data: r, error: errors.join(", ") });
        continue;
      }

      // ----------------------------
      // 📌 PREPARE BODY FOR CreateStudent
      // ----------------------------
      const bodyMapped = {
        data: {
          memberid: String(memberid).trim(),
          name: String(name).trim(),
          mobile: String(mobile).trim(),
          email: email || null,
          expirydate: convertDate(expirydate),
          hostel_id: hostelId,
          address: `${address || ""}`.trim(),
          remarks: remarks || "",
          parentname: parentName || "",
          parentcontact: parentContact || "",
          parentemail: parentEmail || "",
          gender: genId,
          degree: degId,
          department: depId,

          // REQUIRED for CreateStudent
          locations: dataLocation.map((loc) => loc.id),
          product_types: [],
        },
      };

      // ----------------------------
      // 📌 CALL CreateStudent
      // ----------------------------
      try {
        const mockReq = { body: bodyMapped, user: req.user };
        const mockRes = {
          status: () => ({
            json: (obj) => {
              if (!obj.status)
                failed.push({ row: i + 2, data: r, error: obj.message });
            },
          }),
        };

        await CreateStudent(mockReq, mockRes);
      } catch (err) {
        failed.push({ row: i + 2, data: r, error: err.message });
      }
    }

    // ----------------------------
    // ⏳ EXPORT FAILED ROWS
    // ----------------------------
    if (failed.length) {
      const headers = [...originalHeaders, "Error", "Row"];
      const exportRows = failed.map((f) => [...f.data, f.error, f.row]);

      const sheet = xlsx.utils.aoa_to_sheet([headers, ...exportRows]);
      const wb = xlsx.utils.book_new();
      xlsx.utils.book_append_sheet(wb, sheet, "Failed");

      const buffer = xlsx.write(wb, { bookType: "xlsx", type: "buffer" });

      res.setHeader(
        "Content-Disposition",
        "attachment; filename=student_upload_errors.xlsx"
      );
      res.setHeader(
        "Content-Type",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      );
      return res.send(buffer);
    }

    return res.status(200).json({
      status: true,
      message: "Bulk upload completed successfully",
    });
  } catch (e) {
    console.error("❌ Bulk Upload ERROR:", e);
    res.status(500).json({ status: false, message: e.message });
  }
};
