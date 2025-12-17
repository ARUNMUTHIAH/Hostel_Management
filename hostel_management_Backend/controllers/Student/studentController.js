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

// export const CreateStudent = async (req, res) => {
//   const QueryTime = await getCurrentISTTime();
//   const EASYTIME_URL = process.env.EASYTIME_URL || "http://192.168.0.116:8000";

//   try {
//     const bodydata = req.body?.data || req.body;
//     const UserID = req.user?.userId || 0;

//     // Required arrays check
//     if (!bodydata?.product_types) {
//       return res.status(400).json({
//         status: false,
//         message: "Product types are required",
//       });
//     }

//     // Input validation
//     const validation = await validateStudentInput(bodydata, db);
//     if (validation.error) {
//       return res.status(validation.statusCode || 400).json({
//         status: false,
//         message: validation.message,
//       });
//     }

//     await db.query("START TRANSACTION");

//     // -------------------------------
//     // INSERT student into local DB
//     // -------------------------------
//     const replacements = [
//       bodydata.name ?? "",
//       bodydata.memberid?.trim() ?? "",
//       bodydata.mobile ?? "",
//       bodydata.email ?? null,
//       bodydata.address ?? null,
//       bodydata.remarks ?? null,
//       UserID,
//       bodydata.parentname ?? null,
//       bodydata.parentcontact ?? null,
//       bodydata.parentemail ?? null,
//       bodydata.expirydate ?? null,
//       bodydata.hostel_id ?? null,
//     ];

//     const [result] = await db.query(
//       `INSERT INTO student
//        (name, memberid, mobile, email, address, remarks, createdby, parentname, parentcontact, parentemail, expirydate, hostel_id)
//        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
//       { replacements, type: db.QueryTypes.INSERT }
//     );

//     // Reliable studentId retrieval
//     let studentId =
//       result?.insertId || (Array.isArray(result) ? result[0]?.insertId : null);
//     if (!studentId) {
//       const [idRows] = await db.query(`SELECT LAST_INSERT_ID() AS id`);
//       studentId = idRows?.[0]?.id;
//     }
//     if (!studentId) throw new Error("studentId not found after insert");

//     // -------------------------------
//     // Student GMaster mapping (locations)
//     // -------------------------------
//     await insertStudentGMasterMap(db, studentId, bodydata.locations || [], {
//       gender: bodydata.gender,
//       degree: bodydata.degree,
//       department: bodydata.department,
//     });

//     // -------------------------------
//     // Student log
//     // -------------------------------
//     const terminalId = os.hostname() || "DEFAULT";
//     await db.query(
//       `INSERT INTO studentlog (student_id, terminalid, transtime) VALUES (?, ?, NOW())`,
//       { replacements: [studentId, terminalId] }
//     );

//     // -------------------------------
//     // WDMS Employee Sync
//     // -------------------------------
//     try {
//       const token = await getEasyTimeToken();
//       const today = QueryTime.split(" ")[0]; // YYYY-MM-DD

//       // Department WDMS ID
//       const [deptRows] = await db.query(
//         "SELECT wdms_id FROM wdms_mapping WHERE local_type='department' AND local_id=?",
//         { replacements: [bodydata.department] }
//       );
//       const deptId = deptRows?.[0]?.wdms_id;
//       if (!deptId)
//         throw new Error(
//           `WDMS department ID not found for local_id=${bodydata.department}`
//         );

//       // Hostel WDMS area ID
//       const [areaRows] = await db.query(
//         "SELECT wdms_id FROM wdms_mapping WHERE local_type='area' AND local_id=?",
//         { replacements: [bodydata.hostel_id] }
//       );
//       const areaId = areaRows?.[0]?.wdms_id || 1; // default area if not found

//       // Payload for WDMS
//       const wdmsPayload = {
//         emp_code: bodydata.memberid?.trim(),
//         first_name: bodydata.name,
//         department: deptId,
//         position: 1,
//         area: [areaId],
//         hire_date: today,
//         gender: bodydata.gender === "Female" ? "F" : "M",
//         validity_start: today,
//         validity_end: bodydata.expirydate || "2099-12-31",
//         mobile: bodydata.mobile || "",
//         email: bodydata.email || "",
//         address: bodydata.address || "",
//         enable_att: true,
//         enable_overtime: true,
//         enable_holiday: true,
//       };

//       const wdmsRes = await axios.post(
//         `${EASYTIME_URL}/personnel/api/employees/`,
//         wdmsPayload,
//         {
//           headers: {
//             "Content-Type": "application/json",
//             Authorization: `Token ${token}`,
//           },
//         }
//       );

//       console.log("✔ Employee synced to Easy WDMS:", wdmsRes.data);

//       // Store WDMS mapping locally
//       await db.query(
//         "INSERT INTO wdms_mapping (local_type, local_id, wdms_id) VALUES (?, ?, ?)",
//         { replacements: ["employee", studentId, wdmsRes.data.id] }
//       );
//     } catch (err) {
//       console.error(
//         "❌ Failed syncing employee to Easy WDMS:",
//         err.response?.data || err.message
//       );
//     }

//     await db.query("COMMIT");

//     return res.status(200).json({
//       status: true,
//       message: "Student created successfully",
//       student_id: studentId,
//     });
//   } catch (error) {
//     console.error("CreateStudent Error:", error);
//     try {
//       await db.query("ROLLBACK");
//     } catch {}
//     const err = handleSequelizeError(error);
//     return res.status(err.statusCode || 500).json({
//       status: false,
//       message: err.message,
//     });
//   }
// };

/// error and success message in proper sentence
// export const CreateStudent = async (req, res) => {
//   const QueryTime = await getCurrentISTTime();

//   const userId = req.user?.userId;
//   const roleId = req.user?.roleId;

//   const EASYTIME_URL = await getEASYTIMEURL(userId);

//   console.log(EASYTIME_URL, "EASYTIME_URL");

//   try {
//     const bodydata = req.body?.data || req.body;
//     const UserID = req.user?.userId || 0;

//     // =============================
//     // Block Name containing numbers
//     // =============================
//     if (!/^[A-Za-z ]+$/.test(bodydata.name)) {
//       return res.status(400).json({
//         status: false,
//         message: "Name must contain only alphabets",
//       });
//     }

//     // Required arrays validation
//     if (!bodydata?.product_types) {
//       return res.status(400).json({
//         status: false,
//         message: "Product types are required",
//       });
//     }

//     const validation = await validateStudentInput(bodydata, db);
//     if (validation.error) {
//       return res.status(validation.statusCode || 400).json({
//         status: false,
//         message: validation.message,
//       });
//     }

//     await db.query("START TRANSACTION");

//     // Insert Student in local DB
//     const replacements = [
//       bodydata.name ?? "",
//       bodydata.memberid?.trim() ?? "",
//       bodydata.mobile ?? "",
//       bodydata.email ?? null,
//       bodydata.address ?? null,
//       bodydata.remarks ?? null,
//       UserID,
//       bodydata.parentname ?? null,
//       bodydata.parentcontact ?? null,
//       bodydata.parentemail ?? null,
//       bodydata.expirydate ?? null,
//       bodydata.hostel_id ?? null,
//     ];

//     const [result] = await db.query(
//       `INSERT INTO student
//        (name, memberid, mobile, email, address, remarks, createdby, parentname, parentcontact, parentemail, expirydate, hostel_id)
//        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
//       { replacements, type: db.QueryTypes.INSERT }
//     );

//     let studentId = result?.insertId;
//     if (!studentId) {
//       const [idRows] = await db.query(`SELECT LAST_INSERT_ID() AS id`);
//       studentId = idRows?.[0]?.id;
//     }
//     if (!studentId) throw new Error("studentId not found after insert");

//     // Student GMaster locations map
//     await insertStudentGMasterMap(db, studentId, bodydata.locations || [], {
//       gender: bodydata.gender,
//       degree: bodydata.degree,
//       department: bodydata.department,
//     });

//     // Insert student log
//     const terminalId = os.hostname() || "DEFAULT";
//     await db.query(
//       `INSERT INTO studentlog (student_id, terminalid, transtime) VALUES (?, ?, NOW())`,
//       { replacements: [studentId, terminalId] }
//     );

//     // ==========================================
//     // WDMS SYNC (must be successful or rollback)
//     // ==========================================
//     try {
//       const token = await getEasyTimeToken(userId);
//       const today = QueryTime.split(" ")[0];

//       const [[{ wdms_id: deptId } = {}]] = await db.query(
//         "SELECT wdms_id FROM wdms_mapping WHERE local_type='department' AND local_id=?",
//         { replacements: [bodydata.department] }
//       );
//       if (!deptId) throw new Error("WDMS department ID missing");

//       const [[{ wdms_id: areaId } = {}]] = await db.query(
//         "SELECT wdms_id FROM wdms_mapping WHERE local_type='area' AND local_id=?",
//         { replacements: [bodydata.hostel_id] }
//       );

//       const wdmsPayload = {
//         emp_code: bodydata.memberid?.trim(),
//         first_name: bodydata.name,
//         department: deptId,
//         position: 1,
//         area: [areaId || 1],
//         hire_date: today,
//         gender: bodydata.gender === "Female" ? "F" : "M",
//         validity_start: today,
//         validity_end: bodydata.expirydate || "2099-12-31",
//         mobile: bodydata.mobile || "",
//         email: bodydata.email || "",
//         address: bodydata.address || "",
//         enable_att: true,
//         enable_overtime: true,
//         enable_holiday: true,
//       };

//       const wdmsRes = await axios.post(
//         `${EASYTIME_URL}/personnel/api/employees/`,
//         wdmsPayload,
//         {
//           headers: {
//             "Content-Type": "application/json",
//             Authorization: `Token ${token}`,
//           },
//         }
//       );

//       await db.query(
//         "INSERT INTO wdms_mapping (local_type, local_id, wdms_id) VALUES (?, ?, ?)",
//         { replacements: ["employee", studentId, wdmsRes.data.id] }
//       );

//       console.log("✔ WDMS synced successfully");
//     } catch (err) {
//       console.error("❌ WDMS Error:", err.response?.data || err.message);
//       await db.query("ROLLBACK"); // 🔥 undo local DB
//       return res.status(400).json({
//         status: false,
//         message: `WDMS Sync Failed: ${JSON.stringify(
//           err.response?.data || err.message
//         )}`,
//       });
//     }

//     // If reached here → All DB entries + WDMS success
//     await db.query("COMMIT");

//     return res.status(200).json({
//       status: true,
//       message: "Student created successfully",
//       student_id: studentId,
//     });
//   } catch (error) {
//     console.error("CreateStudent Error:", error);
//     try {
//       await db.query("ROLLBACK");
//     } catch {}
//     return res.status(500).json({
//       status: false,
//       message: error.message,
//     });
//   }
// };

export const CreateStudent = async (req, res) => {
  const QueryTime = await getCurrentISTTime();

  const userId = req.user?.userId;
  const roleId = req.user?.roleId;

  const EASYTIME_URL = await getEASYTIMEURL(userId);

  try {
    const bodydata = req.body?.data || req.body;
    const UserID = userId || 0;

    // ================================
    // Validate Name (Only Alphabets)
    // ================================
    if (!/^[A-Za-z ]+$/.test(bodydata.name)) {
      return res.status(400).json({
        status: false,
        error: "INVALID_NAME",
        message: "Name must contain only alphabets",
      });
    }

    // ================================
    // Required Arrays Validation
    // ================================
    if (!bodydata?.product_types) {
      return res.status(400).json({
        status: false,
        error: "MISSING_PRODUCT_TYPES",
        message: "Product types are required",
      });
    }

    // ================================
    // Input validation
    // ================================
    const validation = await validateStudentInput(bodydata, db);
    if (validation.error) {
      return res.status(validation.statusCode || 400).json({
        status: false,
        error: validation.errorCode || "VALIDATION_FAILED",
        message: validation.message,
      });
    }

    await db.query("START TRANSACTION");

    // ================================
    // Insert Student in local DB
    // ================================
    const replacements = [
      bodydata.name ?? "",
      bodydata.memberid?.trim() ?? "",
      bodydata.mobile ?? "",
      bodydata.email ?? null,
      bodydata.address ?? null,
      bodydata.remarks ?? null,
      UserID,
      bodydata.parentname ?? null,
      bodydata.parentcontact ?? null,
      bodydata.parentemail ?? null,
      bodydata.expirydate ?? null,
      bodydata.hostel_id ?? null,
      null, // ✅ bio_triggered_at, initially NULL
    ];

    const [result] = await db.query(
      `INSERT INTO student
       (name, memberid, mobile, email, address, remarks, createdby, parentname, parentcontact, parentemail, expirydate, hostel_id, bio_triggered_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      { replacements, type: db.QueryTypes.INSERT }
    );

    let studentId = result?.insertId;
    if (!studentId) {
      const [idRows] = await db.query(`SELECT LAST_INSERT_ID() AS id`);
      studentId = idRows?.[0]?.id;
    }

    if (!studentId) throw new Error("STUDENT_INSERT_FAILED");

    // ================================
    // Map Student to GMaster locations
    // ================================
    await insertStudentGMasterMap(db, studentId, bodydata.locations || [], {
      gender: bodydata.gender,
      degree: bodydata.degree,
      department: bodydata.department,
    });

    // ================================
    // Insert Student Log
    // ================================
    const terminalId = os.hostname() || "DEFAULT";
    await db.query(
      `INSERT INTO studentlog (student_id, terminalid, transtime) VALUES (?, ?, NOW())`,
      { replacements: [studentId, terminalId] }
    );

    // ================================
    // WDMS Sync (Rollback on Failure)
    // ================================
    try {
      const token = await getEasyTimeToken(userId);
      const today = QueryTime.split(" ")[0];

      const [[{ wdms_id: deptId } = {}]] = await db.query(
        "SELECT wdms_id FROM wdms_mapping WHERE local_type='department' AND local_id=?",
        { replacements: [bodydata.department] }
      );

      if (!deptId) throw new Error("WDMS_DEPARTMENT_ID_MISSING");

      const [[{ wdms_id: areaId } = {}]] = await db.query(
        "SELECT wdms_id FROM wdms_mapping WHERE local_type='area' AND local_id=?",
        { replacements: [bodydata.hostel_id] }
      );

      const wdmsPayload = {
        emp_code: bodydata.memberid?.trim(),
        first_name: bodydata.name,
        department: bodydata.department,
        position: 1,
        area: [bodydata.hostel_id || 1],
        hire_date: today,
        gender: bodydata.gender === "Female" ? "F" : "M",
        validity_start: today,
        validity_end: bodydata.expirydate || "2099-12-31",
        mobile: bodydata.mobile || "",
        email: bodydata.email || "",
        address: bodydata.address || "",
        enable_att: true,
        enable_overtime: true,
        enable_holiday: true,
      };

      const wdmsRes = await axios.post(
        `${EASYTIME_URL}/personnel/api/employees/`,
        wdmsPayload,
        {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Token ${token}`,
          },
        }
      );

      await db.query(
        "INSERT INTO wdms_mapping (local_type, local_id, wdms_id) VALUES (?, ?, ?)",
        { replacements: ["employee", studentId, wdmsRes.data.id] }
      );
    } catch (err) {
      await db.query("ROLLBACK");
      return res.status(400).json({
        status: false,
        error: "WDMS_SYNC_FAILED",
        message: `WDMS Sync Failed: ${JSON.stringify(
          err.response?.data || err.message
        )}`,
      });
    }

    // ================================
    // Commit Transaction
    // ================================
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
    return res.status(500).json({
      status: false,
      error: error.message || "INTERNAL_SERVER_ERROR",
      message: "An unexpected error occurred while creating the student",
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

// export const UpdateStudent = async (req, res) => {
//   const QueryTime = await getCurrentISTTime();

//   try {
//     const studentId = req.body?.id || req.params?.id;
//     if (!studentId) throw new Error("Student ID required");

//     const bodydata = req.body?.data || req.body;
//     const UserID = req.user?.userId || 0;

//     // Validate input
//     const validation = await validateStudentInput(bodydata, db, "update");
//     if (validation.error) {
//       return res.status(validation.statusCode || 400).json({
//         status: false,
//         message: validation.message,
//       });
//     }

//     await db.query("START TRANSACTION");

//     // Update main student info
//     const replacements = [
//       bodydata.name ?? "",
//       bodydata.memberid?.trim() ?? "",
//       bodydata.mobile ?? "",
//       bodydata.email ?? null,
//       bodydata.address ?? null,
//       bodydata.remarks ?? null,
//       UserID,
//       bodydata.parentname ?? null,
//       bodydata.parentcontact ?? null,
//       bodydata.parentemail ?? null,
//       bodydata.expirydate ?? null,
//       bodydata.hostel_id ?? null,
//       studentId,
//     ];

//     const [result] = await db.query(
//       `UPDATE student SET
//         name = ?,
//         memberid = ?,
//         mobile = ?,
//         email = ?,
//         address = ?,
//         remarks = ?,
//         updatedby = ?,
//         parentname = ?,
//         parentcontact = ?,
//         parentemail = ?,
//         expirydate = ?,
//         hostel_id = ?
//       WHERE id = ?`,
//       { replacements }
//     );

//     if (!result || result.affectedRows === 0) {
//       await db.query("ROLLBACK");
//       return res
//         .status(404)
//         .json({ status: false, message: "Student not found" });
//     }

//     // Reset GMaster mappings
//     await db.query("DELETE FROM studentgmastermap WHERE student_id = ?", {
//       replacements: [studentId],
//     });

//     // Insert new mappings
//     await insertStudentGMasterMap(db, studentId, bodydata.locations || [], {
//       gender: bodydata.gender,
//       degree: bodydata.degree,
//       department: bodydata.department,
//     });

//     // Insert update log
//     const terminalId = os.hostname() || "DEFAULT";
//     await db.query(
//       `INSERT INTO studentlog (student_id, terminalid, transtime) VALUES (?, ?, NOW())`,
//       { replacements: [studentId, terminalId] }
//     );

//     await db.query("COMMIT");

//     return res.status(200).json({
//       status: true,
//       message: "Student updated successfully",
//       student_id: studentId,
//     });
//   } catch (error) {
//     console.error("UpdateStudent Error:", error);
//     try {
//       await db.query("ROLLBACK");
//     } catch (_) {}
//     const err = handleSequelizeError(error);
//     return res
//       .status(err.statusCode || 500)
//       .json({ status: false, message: err.message });
//   }
// };

// export const DeleteStudent = async (req, res) => {
//   try {
//     const ids = req.params?.id;
//     if (!ids) throw new Error("Student ID is required");

//     // Convert "56,58" → [56, 58]
//     const studentIds = ids
//       .split(",")
//       .map((id) => Number(id.trim()))
//       .filter(Boolean);

//     if (studentIds.length === 0)
//       return res
//         .status(400)
//         .json({ status: false, message: "Invalid student IDs" });

//     await db.query("START TRANSACTION");

//     const terminalId = os.hostname() || "DEFAULT";

//     // Insert logs for each student
//     for (const id of studentIds) {
//       await db.query(
//         `INSERT INTO studentlog (student_id, terminalid, transtime) VALUES (?, ?, NOW())`,
//         { replacements: [id, terminalId] }
//       );
//     }

//     // Delete GMaster mappings
//     await db.query(
//       `DELETE FROM studentgmastermap WHERE student_id IN (${studentIds
//         .map(() => "?")
//         .join(",")})`,
//       { replacements: studentIds }
//     );

//     // Delete students
//     const [deleteResult] = await db.query(
//       `DELETE FROM student WHERE id IN (${studentIds
//         .map(() => "?")
//         .join(",")})`,
//       { replacements: studentIds }
//     );

//     await db.query("COMMIT");

//     return res.json({
//       status: true,
//       message: `${studentIds.length} student(s) deleted permanently`,
//       deleted_ids: studentIds,
//     });
//   } catch (error) {
//     console.error("DeleteStudent Error:", error);
//     try {
//       await db.query("ROLLBACK");
//     } catch (_) {}

//     return res.status(500).json({ status: false, message: error.message });
//   }
// };

// export const DeleteStudent = async (req, res) => {
//   const EASYTIME_URL = "http://192.168.0.116:8000";
//   const terminalId = os.hostname() || "DEFAULT";

//   const t = await db.transaction();

//   try {
//     const { id } = req.params;
//     const studentIds = id
//       .split(",")
//       .map((x) => Number(x.trim()))
//       .filter(Boolean);

//     if (studentIds.length === 0) {
//       return res
//         .status(400)
//         .json({ status: false, message: "Invalid student IDs" });
//     }

//     // 🔹 First get memberid from DB using student id
//     const [students] = await db.query(
//       `SELECT id, memberid FROM student WHERE id IN (${studentIds
//         .map(() => "?")
//         .join(",")})`,
//       { replacements: studentIds, transaction: t }
//     );

//     // 🟡 WDMS delete using memberid (FIRST STEP)
//     if (students.length > 0) {
//       try {
//         const token = await getEasyTimeToken();

//         for (const student of students) {
//           const empCode = student.memberid;
//           if (!empCode) {
//             console.warn(`⚠ No memberid found for student ${student.id}`);
//             continue;
//           }

//           try {
//             // 👉 Step 1: find WDMS employee ID using emp_code
//             const searchRes = await axios.get(
//               `${EASYTIME_URL}/personnel/api/employees/?emp_code=${empCode}`,
//               { headers: { Authorization: `Token ${token}` } }
//             );

//             if (!Array.isArray(searchRes.data) || searchRes.data.length === 0) {
//               console.warn(`⚠ WDMS employee not found for emp_code ${empCode}`);
//               continue;
//             }

//             const wdmsId = searchRes.data[0].id;

//             // 👉 Step 2: delete by that WDMS internal ID
//             await axios.delete(
//               `${EASYTIME_URL}/personnel/api/employees/${wdmsId}/`,
//               { headers: { Authorization: `Token ${token}` } }
//             );

//             console.log(
//               `✔ WDMS employee deleted → ${empCode} (WDMS ID: ${wdmsId})`
//             );
//           } catch (err) {
//             console.warn(
//               `❌ WDMS delete failed for ${empCode}`,
//               err.response?.data || err.message
//             );
//           }
//         }
//       } catch (err) {
//         console.error("❌ Failed to contact WDMS server:", err.message);
//       }
//     }

//     // 🟢 After WDMS deletion success/failure → continue local deletion inside transaction

//     // 1️⃣ Log deletion
//     for (const studentId of studentIds) {
//       await db.query(
//         `INSERT INTO studentlog (student_id, terminalid, transtime) VALUES (?, ?, NOW())`,
//         { replacements: [studentId, terminalId], transaction: t }
//       );
//     }

//     // 2️⃣ Delete dependent tables
//     await db.query(
//       `DELETE FROM studentgmastermap WHERE student_id IN (${studentIds
//         .map(() => "?")
//         .join(",")})`,
//       { replacements: studentIds, transaction: t }
//     );

//     await db.query(
//       `DELETE FROM late_return_sms_log WHERE student_id IN (${studentIds
//         .map(() => "?")
//         .join(",")})`,
//       { replacements: studentIds, transaction: t }
//     );

//     // 3️⃣ Delete student table
//     await db.query(
//       `DELETE FROM student WHERE id IN (${studentIds
//         .map(() => "?")
//         .join(",")})`,
//       { replacements: studentIds, transaction: t }
//     );

//     // 4️⃣ Remove WDMS local mapping
//     await db.query(
//       `DELETE FROM wdms_mapping WHERE local_type='employee' AND local_id IN (${studentIds
//         .map(() => "?")
//         .join(",")})`,
//       { replacements: studentIds, transaction: t }
//     );

//     await t.commit();
//     console.log("✔ Local deletion success for students:", studentIds);

//     return res.status(200).json({
//       status: true,
//       message: `${studentIds.length} student(s) deleted successfully`,
//       deleted_ids: studentIds,
//     });
//   } catch (error) {
//     console.error("DeleteStudent Error:", error);
//     try {
//       await t.rollback();
//     } catch (_) {}
//     return res.status(500).json({
//       status: false,
//       message: error.message,
//     });
//   }
// };

// export const DeleteStudent = async (req, res) => {
//   const EASYTIME_URL = "http://192.168.0.116:8000";
//   const terminalId = os.hostname() || "DEFAULT";

//   try {
//     const { id } = req.params;
//     const studentIds = id
//       .split(",")
//       .map((x) => Number(x.trim()))
//       .filter(Boolean);

//     if (studentIds.length === 0) {
//       return res
//         .status(400)
//         .json({ status: false, message: "Invalid student IDs" });
//     }

//     // 🔹 Get memberid using student ids
//     const [students] = await db.query(
//       `SELECT id, memberid FROM student WHERE id IN (${studentIds
//         .map(() => "?")
//         .join(",")})`,
//       { replacements: studentIds }
//     );

//     let wdmsDeleted = [];

//     // 🔥 WDMS deletion
//     if (students.length > 0) {
//       try {
//         const token = await getEasyTimeToken();

//         for (const student of students) {
//           const empCode = student.memberid;
//           if (!empCode) {
//             console.warn(`⚠ No memberid found for student ${student.id}`);
//             continue;
//           }

//           let employeeList;

//           // 🔍 Request employees by emp_code
//           try {
//             const getRes = await axios.get(
//               `${EASYTIME_URL}/personnel/api/employees/?emp_code=${empCode}`,
//               { headers: { Authorization: `Token ${token}` } }
//             );
//             employeeList = getRes.data?.data ?? [];
//           } catch (_) {}

//           if (!employeeList?.length) {
//             console.warn(`⚠ WDMS employee not found for emp_code ${empCode}`);
//             continue;
//           }

//           const wdmsId = employeeList[0].id; // WDMS unique primary key

//           // ❗ DELETE from WDMS using WDMS ID
//           try {
//             await axios.delete(
//               `${EASYTIME_URL}/personnel/api/employees/${wdmsId}/`,
//               { headers: { Authorization: `Token ${token}` } }
//             );
//             console.log(`✔ WDMS employee deleted → ${empCode}`);
//             wdmsDeleted.push(empCode);
//           } catch (err) {
//             console.warn(
//               `❌ WDMS delete failed for ${empCode}`,
//               err.response?.data || err.message
//             );
//           }
//         }
//       } catch (err) {
//         console.error("❌ WDMS server error:", err.message);
//       }
//     }

//     // ❗ Local DB deletions (currently disabled)
//     /*
//     // 1️⃣ Log deletion
//     for (const studentId of studentIds) {
//       await db.query(
//         `INSERT INTO studentlog (student_id, terminalid, transtime) VALUES (?, ?, NOW())`,
//         { replacements: [studentId, terminalId] }
//       );
//     }

//     // 2️⃣ Delete mappings
//     await db.query(
//       `DELETE FROM studentgmastermap WHERE student_id IN (${studentIds
//         .map(() => "?")
//         .join(",")})`,
//       { replacements: studentIds }
//     );

//     await db.query(
//       `DELETE FROM late_return_sms_log WHERE student_id IN (${studentIds
//         .map(() => "?")
//         .join(",")})`,
//       { replacements: studentIds }
//     );

//     // 3️⃣ Delete student table
//     await db.query(
//       `DELETE FROM student WHERE id IN (${studentIds
//         .map(() => "?")
//         .join(",")})`,
//       { replacements: studentIds }
//     );

//     // 4️⃣ Remove WDMS local mapping
//     await db.query(
//       `DELETE FROM wdms_mapping WHERE local_type='employee' AND local_id IN (${studentIds
//         .map(() => "?")
//         .join(",")})`,
//       { replacements: studentIds }
//     );
//     */

//     return res.status(200).json({
//       status: true,
//       message: "WDMS delete completed",
//       total_requested_ids: studentIds,
//       wdms_deleted_emp_codes: wdmsDeleted,
//     });
//   } catch (error) {
//     console.error("DeleteStudent Error:", error);
//     return res.status(500).json({
//       status: false,
//       message: error.message,
//     });
//   }
// };

//before error and success message format
// export const UpdateStudent = async (req, res) => {
//   const QueryTime = await getCurrentISTTime();
//   const userId = req.user?.userId;

//   try {
//     const studentId = req.body?.id || req.params?.id;
//     if (!studentId) throw new Error("Student ID required");

//     const bodydata = req.body?.data || req.body;

//     // ================= 1️⃣ GET OLD STUDENT DATA =================
//     const [[oldStudent]] = await db.query(
//       "SELECT hostel_id FROM student WHERE id = ?",
//       { replacements: [studentId] }
//     );

//     if (!oldStudent) {
//       return res
//         .status(404)
//         .json({ status: false, message: "Student not found" });
//     }

//     const oldHostelId = oldStudent.hostel_id;
//     const newHostelId = bodydata.hostel_id;

//     // ================= 2️⃣ UPDATE LOCAL STUDENT =================
//     await db.query("START TRANSACTION");

//     await db.query(
//       `UPDATE student SET
//         name = ?, memberid = ?, mobile = ?, email = ?, address = ?, remarks = ?,
//         parentname = ?, parentcontact = ?, parentemail = ?, expirydate = ?, hostel_id = ?
//        WHERE id = ?`,
//       {
//         replacements: [
//           bodydata.name,
//           bodydata.memberid,
//           bodydata.mobile,
//           bodydata.email,
//           bodydata.address,
//           bodydata.remarks,
//           bodydata.parentname,
//           bodydata.parentcontact,
//           bodydata.parentemail,
//           bodydata.expirydate,
//           newHostelId,
//           studentId,
//         ],
//       }
//     );

//     // ================= 3️⃣ UPDATE WDMS EMPLOYEE =================
//     const EASYTIME_URL = await getEASYTIMEURL(userId);
//     const token = await getEasyTimeToken(userId);
//     const today = QueryTime.split(" ")[0];

//     const empRes = await axios.get(
//       `${EASYTIME_URL}/personnel/api/employees/?search=${bodydata.memberid}`,
//       { headers: { Authorization: `Token ${token}` } }
//     );

//     if (!empRes.data?.data?.length) {
//       throw new Error("Employee not found in WDMS");
//     }

//     const wdmsEmployeeId = empRes.data.data[0].id;

//     const [[{ wdms_id: newAreaId } = {}]] = await db.query(
//       "SELECT wdms_id FROM wdms_mapping WHERE local_type='area' AND local_id=?",
//       { replacements: [newHostelId] }
//     );

//     await axios.put(
//       `${EASYTIME_URL}/personnel/api/employees/${wdmsEmployeeId}/`,
//       {
//         first_name: bodydata.name,
//         department: 1,
//         position: 1,
//         hire_date: today,
//         validity_start: today,
//         validity_end: bodydata.expirydate || "2099-12-31",
//         area: [newAreaId],
//       },
//       { headers: { Authorization: `Token ${token}` } }
//     );

//     console.log("✅ WDMS employee area updated");

//     // ================= 4️⃣ BIOMETRIC AREA TRANSFER =================
//     if (oldHostelId !== newHostelId) {
//       console.log(`🔄 Hostel changed: ${oldHostelId} → ${newHostelId}`);

//       // OLD AREA DEVICES
//       const [oldDevices] = await db.query(
//         `SELECT terminal_id, device_ip FROM biometric_devices
//          WHERE hostel_id = ? AND status = 'Active'`,
//         { replacements: [oldHostelId] }
//       );

//       // NEW AREA DEVICES
//       const [newDevices] = await db.query(
//         `SELECT terminal_id, device_ip FROM biometric_devices
//          WHERE hostel_id = ? AND status = 'Active'`,
//         { replacements: [newHostelId] }
//       );

//       const oldDeviceIds = oldDevices.map((d) => d.terminal_id);
//       const newDeviceIds = newDevices.map((d) => d.terminal_id);

//       // ✅ SYNC NEW AREA (ALLOW ACCESS)
//       if (newDeviceIds.length) {
//         await axios.post(
//           `${EASYTIME_URL}/iclock/api/terminals/sync_data_to_device/`,
//           {
//             devices: newDeviceIds,
//             employees: true,
//             finger_print: true,
//           },
//           { headers: { Authorization: `Token ${token}` } }
//         );

//         console.log(
//           "✅ Fingerprint synced to NEW area devices:",
//           newDevices.map((d) => d.device_ip)
//         );
//       }

//       // ❌ SYNC OLD AREA (REMOVE ACCESS)
//       if (oldDeviceIds.length) {
//         await axios.post(
//           `${EASYTIME_URL}/iclock/api/terminals/sync_data_to_device/`,
//           {
//             devices: oldDeviceIds,
//             employees: true,
//             finger_print: false,
//           },
//           { headers: { Authorization: `Token ${token}` } }
//         );

//         console.log(
//           "🚫 Fingerprint access removed from OLD area devices:",
//           oldDevices.map((d) => d.device_ip)
//         );
//       }
//     }

//     // ================= 5️⃣ COMMIT =================
//     await db.query("COMMIT");

//     return res.json({
//       status: true,
//       message: "Student updated and biometric access transferred successfully",
//     });
//   } catch (error) {
//     await db.query("ROLLBACK");
//     console.error("❌ UpdateStudent Error:", error.message);
//     return res.status(500).json({
//       status: false,
//       message: error.message,
//     });
//   }
// };

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

    // ================= 1️⃣ GET OLD STUDENT =================
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

    // ================= 2️⃣ START TRANSACTION =================
    await db.query("START TRANSACTION");
    transactionStarted = true;

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

    // ================= 3️⃣ WDMS LOOKUP =================
    const EASYTIME_URL = await getEASYTIMEURL(userId);
    const token = await getEasyTimeToken(userId);
    const today = QueryTime.split(" ")[0];

    const empRes = await axios.get(
      `${EASYTIME_URL}/personnel/api/employees/?search=${bodydata.memberid}`,
      { headers: { Authorization: `Token ${token}` } }
    );

    if (!empRes.data?.data?.length) {
      throw new Error("WDMS_EMPLOYEE_NOT_FOUND");
    }

    const employee = empRes.data.data[0];

    // 🔥 THIS IS THE KEY FIX
    const empCode = employee.emp_code;
    if (!empCode) {
      throw new Error("WDMS_EMP_CODE_MISSING");
    }

    // ================= 4️⃣ AREA MAPPING =================
    const [[areaRow]] = await db.query(
      "SELECT wdms_id FROM wdms_mapping WHERE local_type='area' AND local_id=?",
      { replacements: [newHostelId] }
    );
    const [[deptRow]] = await db.query(
      "SELECT wdms_id FROM wdms_mapping WHERE local_type='department' AND local_id=?",
      { replacements: [bodydata.department] }
    );

    if (!deptRow?.wdms_id) {
      throw new Error("WDMS_DEPARTMENT_MAPPING_NOT_FOUND");
    }

    if (!areaRow?.wdms_id) {
      throw new Error("WDMS_AREA_MAPPING_NOT_FOUND");
    }
    console.log(newHostelId, "newHostelId");

    // ================= 5️⃣ UPDATE WDMS EMPLOYEE =================
    await axios.put(
      `${EASYTIME_URL}/personnel/api/employees/${empCode}/`,
      {
        first_name: bodydata.name,
        mobile: bodydata.mobile || "",
        email: bodydata.email || "",
        hire_date: today,
        validity_start: today,
        validity_end: bodydata.expirydate || "2099-12-31",
        department: bodydata.department,
        position: 1,
        area: [String(newHostelId)],
        enable_att: true,
      },
      { headers: { Authorization: `Token ${token}` } }
    );

    // ================= 6️⃣ BIOMETRIC DEVICE SYNC =================
    if (oldHostelId !== newHostelId) {
      const [oldDevices] = await db.query(
        `SELECT terminal_id FROM biometric_devices
         WHERE hostel_id=? AND status='Active'`,
        { replacements: [oldHostelId] }
      );

      const [newDevices] = await db.query(
        `SELECT terminal_id FROM biometric_devices
         WHERE hostel_id=? AND status='Active'`,
        { replacements: [newHostelId] }
      );

      const syncURL = `${EASYTIME_URL}/iclock/api/terminals/sync_data_to_device`;

      if (newDevices.length) {
        await axios.post(
          syncURL,
          {
            devices: newDevices.map((d) => d.terminal_id),
            employees: true,
            finger_print: true,
          },
          { headers: { Authorization: `Token ${token}` } }
        );
      }

      if (oldDevices.length) {
        await axios.post(
          syncURL,
          {
            devices: oldDevices.map((d) => d.terminal_id),
            employees: true,
            finger_print: false,
          },
          { headers: { Authorization: `Token ${token}` } }
        );
      }
    }

    // ================= 7️⃣ COMMIT =================
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
      status: error.response?.status,
    });

    return res.status(500).json({
      status: false,
      error: error.message,
      message: "Failed to update student",
    });
  }
};

//before error and success message format
// export const DeleteStudent = async (req, res) => {
//   const t = await db.transaction();

//   const userId = req.user?.userId;
//   const roleId = req.user?.roleId;

//   const EASYTIME_URL = await getEASYTIMEURL(userId);

//   try {
//     const { id } = req.params;
//     const studentIds = id
//       .split(",")
//       .map((x) => Number(x.trim()))
//       .filter(Boolean);

//     if (studentIds.length === 0) {
//       return res
//         .status(400)
//         .json({ status: false, message: "Invalid student IDs" });
//     }

//     // ▪ Get student member IDs
//     const [students] = await db.query(
//       `SELECT id, memberid FROM student WHERE id IN (${studentIds
//         .map(() => "?")
//         .join(",")})`,
//       { replacements: studentIds }
//     );

//     let wdmsDeleted = [];

//     // ▪ DELETE IN WDMS FIRST
//     if (students.length > 0) {
//       try {
//         const token = await getEasyTimeToken(userId);

//         for (const student of students) {
//           const empCode = student.memberid;
//           if (!empCode) continue;

//           let employeeList;
//           try {
//             const getRes = await axios.get(
//               `${EASYTIME_URL}/personnel/api/employees/?emp_code=${empCode}`,
//               { headers: { Authorization: `Token ${token}` } }
//             );
//             employeeList = getRes.data?.data ?? [];
//           } catch (_) {}

//           if (!employeeList?.length) continue;

//           const wdmsId = employeeList[0].id;

//           try {
//             await axios.delete(
//               `${EASYTIME_URL}/personnel/api/employees/${wdmsId}/`,
//               { headers: { Authorization: `Token ${token}` } }
//             );
//             console.log(`✔ WDMS employee deleted → ${empCode}`);
//             wdmsDeleted.push(empCode);
//           } catch (err) {
//             console.warn(
//               `❌ WDMS delete failed for ${empCode}`,
//               err.response?.data || err.message
//             );
//           }
//         }
//       } catch (err) {
//         console.error("❌ WDMS server error:", err.message);
//       }
//     }

//     // ==========================================
//     // 🟢 LOCAL DATABASE DELETE (NO STUDENTLOG!)
//     // ==========================================

//     await db.query(
//       `DELETE FROM studentgmastermap WHERE student_id IN (${studentIds
//         .map(() => "?")
//         .join(",")})`,
//       { replacements: studentIds, transaction: t }
//     );

//     await db.query(
//       `DELETE FROM late_return_sms_log WHERE student_id IN (${studentIds
//         .map(() => "?")
//         .join(",")})`,
//       { replacements: studentIds, transaction: t }
//     );

//     await db.query(
//       `DELETE FROM wdms_mapping WHERE local_type='employee' AND local_id IN (${studentIds
//         .map(() => "?")
//         .join(",")})`,
//       { replacements: studentIds, transaction: t }
//     );

//     await db.query(
//       `DELETE FROM student WHERE id IN (${studentIds
//         .map(() => "?")
//         .join(",")})`,
//       { replacements: studentIds, transaction: t }
//     );

//     await t.commit();
//     console.log("✔ Local DB deletion success");

//     return res.status(200).json({
//       status: true,
//       message: `${studentIds.length} student(s) deleted successfully`,
//       wdms_deleted_emp_codes: wdmsDeleted,
//       deleted_ids: studentIds,
//     });
//   } catch (error) {
//     console.error("DeleteStudent Error:", error);
//     try {
//       await t.rollback();
//     } catch (_) {}
//     return res.status(500).json({
//       status: false,
//       message: error.message,
//     });
//   }
// };

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
        parentEmail,
        parentContact,
        remarks,
      ] = r;

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
          parentemail: parentEmail || "",
          parentcontact: parentContact || "",
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

//before that area restriction
// export const triggerEnroll = async (req, res) => {
//   try {
//     const studentId = req.params.id;

//     const userId = req.user?.userId;
//     const token = await getEasyTimeToken(userId);

//     const EASYTIME_URL = await getEASYTIMEURL(userId);

//     // 1️⃣ Fetch student from DB
//     const [[student]] = await db.query(
//       "SELECT memberid, name FROM student WHERE id = ?",
//       { replacements: [studentId] }
//     );

//     if (!student) {
//       return res.status(404).json({
//         status: false,
//         message: "Student not found",
//       });
//     }

//     // 2️⃣ Get API Token

//     // 3️⃣ Fetch employee info from WDMS using memberid as emp_code
//     const empRes = await axios.get(`${EASYTIME_URL}/personnel/api/employees/`, {
//       headers: { Authorization: `Token ${token}` },
//       params: { emp_code: student.memberid },
//     });

//     const employeeData = empRes.data.data?.[0];

//     if (!employeeData) {
//       return res.status(404).json({
//         status: false,
//         message: `Employee not found in WDMS for emp_code=${student.memberid}`,
//       });
//     }

//     console.log("✅ Employee data:", employeeData);

//     // 4️⃣ Fetch all biometric terminals
//     const terminalsRes = await axios.get(
//       `${EASYTIME_URL}/iclock/api/terminals/`,
//       {
//         headers: { Authorization: `Token ${token}` },
//       }
//     );

//     const terminals = terminalsRes.data.data || [];
//     const deviceIds = terminals.map((d) => d.id);

//     if (!deviceIds.length) {
//       return res.status(400).json({
//         status: false,
//         message: "No biometric terminals found",
//       });
//     }

//     console.log("✅ Terminal IDs:", deviceIds);

//     // 5️⃣ Trigger remote fingerprint enrollment
//     // bio_type: 2 (fingerprint), finger: 0 (Right thumb)
//     const enrollRes = await axios.post(
//       `${EASYTIME_URL}/iclock/api/terminals/enroll_remotely/`,
//       {
//         devices: deviceIds,
//         bio_type: 1,
//         employee: employeeData.id, // Use employee ID, not emp_code
//         finger: 0,
//       },
//       {
//         headers: {
//           Authorization: `Token ${token}`,
//           "Content-Type": "application/json",
//         },
//       }
//     );

//     console.log("✅ Enrollment response:", enrollRes.data);

//     return res.json({
//       status: true,
//       message: `Enrollment triggered for ${student.name}. Place finger on device.`,
//       employee: employeeData,
//       devices: deviceIds,
//       enroll_response: enrollRes.data,
//     });
//   } catch (err) {
//     console.error("Enrollment Error:", err.response?.data || err.message);
//     return res.status(500).json({
//       status: false,
//       message:
//         err.response?.data?.detail ||
//         "Unable to trigger fingerprint enrollment",
//     });
//   }
// };

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
