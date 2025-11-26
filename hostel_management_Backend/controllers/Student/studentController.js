import { db } from "../../config/Database.js";
import os from "os";
import { getCurrentISTTime } from "../../Utils/Datetime.js";
import { handleSequelizeError } from "../../config/validationCheck.js";
import { validateStudentInput } from "./validateStudentInput.js";

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
      bodydata.expirydate ?? null,
      bodydata.hostel_id ?? null,
    ];

    const [rows] = await db.query(
      `INSERT INTO student
      (name, memberid, mobile, email, address, remarks, createdby, parentname, parentcontact, expirydate,hostel_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?,?)`,
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

    // LOCATION FILTER
    if (!isSuperAdmin) {
      const [userLocations] = await db.query(
        "SELECT gmastervalue_id FROM userlocationmap WHERE users_id = ?",
        { replacements: [userId] }
      );

      if (userLocations.length > 0) {
        const locIds = userLocations.map((l) => l.gmastervalue_id).join(",");
        where.push(`
          s.id IN (
            SELECT sm.student_id
            FROM studentgmastermap sm
            WHERE sm.gmastervalue_id IN (${locIds})
          )
        `);
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

    // NO STUDENT FOUND
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

    // COUNT
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
    const studentId = req.params?.id;
    if (!studentId) throw new Error("Student ID is required");

    // Check student exists
    const exists = await db.query(
      "SELECT id FROM student WHERE id = ? LIMIT 1",
      {
        replacements: [studentId],
        type: db.QueryTypes.SELECT,
      }
    );
    if (!exists || exists.length === 0)
      return res
        .status(404)
        .json({ status: false, message: "Student not found" });

    const terminalId = os.hostname() || "DEFAULT";

    await db.query("START TRANSACTION");

    // Insert log before deletion
    await db.query(
      `INSERT INTO studentlog (student_id, terminalid, transtime) VALUES (?, ?, NOW())`,
      { replacements: [studentId, terminalId] }
    );

    // Delete GMaster mappings
    await db.query("DELETE FROM studentgmastermap WHERE student_id = ?", {
      replacements: [studentId],
    });

    // Delete student
    await db.query("DELETE FROM student WHERE id = ?", {
      replacements: [studentId],
    });

    await db.query("COMMIT");

    return res.json({ status: true, message: "Student deleted permanently" });
  } catch (error) {
    console.error("DeleteStudent Error:", error);
    try {
      await db.query("ROLLBACK");
    } catch (_) {}
    return res.status(500).json({ status: false, message: error.message });
  }
};
