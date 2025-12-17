// import { db, performQuery } from "../../config/Database.js";
// import {
//   formatDateTimeToYYYYMMDDHHMMSS,
//   formatDateToYYYYMMDD,
//   getCurrentISTTime,
//   getCurrentISTDate,
//   capitalizeFirstLetter,
// } from "../../Utils/Datetime.js";
// import { master_configuration } from "../../config/master_config.js";
// import { handleSequelizeError } from "../../config/validationCheck.js";

// const MASTER_CONFIG = master_configuration();

// export const handleAdd = async (req, res) => {
//   const QueryTime = await getCurrentISTTime();
//   console.log("Current IST Time:", QueryTime);

//   try {
//     console.log("handle_ADD_TRY", QueryTime);
//     let bodydata = req.body.data || req.body;

//     const { originaltable, columns, placeholders, values, error, statusCode } =
//       req.precheck;
//     console.log("resultError", error);
//     console.log("originaltablemasters", originaltable);

//     if (error) {
//       return res
//         .status(statusCode || 400)
//         .json({ status: false, message: error });
//     }

//     const { gmaster_id, name } = bodydata;
//     const trimmedName = typeof name === "string" ? name.trim() : "";

//     if (trimmedName && gmaster_id) {
//       const [[duplicateCheck]] = await db.query(
//         `SELECT COUNT(*) as count FROM gmastervalue WHERE gmaster_id = ? AND name = ?`,
//         { replacements: [gmaster_id, trimmedName] }
//       );
//       console.log("duplicateCheck", duplicateCheck);

//       if (duplicateCheck.count > 0) {
//         console.log("Duplicate found from Precheck");
//         return res.status(409).json({
//           status: false,
//           message: `The value '${trimmedName}' already exists under this master.`,
//         });
//       }
//     }

//     await db.query("START TRANSACTION");

//     const trimmedValues = values.map((val, idx) => {
//       if (columns[idx] === "name" && typeof val === "string") {
//         // return val.trim();
//         return capitalizeFirstLetter(val);
//       }
//       return val;
//     });

//     await db.query(
//       `INSERT INTO ${originaltable} (${columns.join(
//         ", "
//       )}) VALUES (${placeholders})`,
//       { replacements: trimmedValues }
//     );
//     await db.query("COMMIT");
//     res
//       .status(200)
//       .json({ status: true, message: `Record added successfully.` });
//   } catch (error) {
//     try {
//       await db.query("ROLLBACK");
//     } catch {
//       console.log("rollback fails");
//     }

//     console.error("Error in handleAdd:", error);
//     console.log("handle_ADD_Catch", QueryTime);
//     const errorFetch = handleSequelizeError(error);
//     const status_code = errorFetch?.statusCode || 500;
//     const error_message = errorFetch?.message;
//     const error_status = errorFetch?.status;

//     res.status(status_code).json({
//       status: error_status,
//       message: error_message,
//     });
//   }
// };

import axios from "axios";
import { db, performQuery } from "../../config/Database.js";
import {
  getCurrentISTTime,
  capitalizeFirstLetter,
} from "../../Utils/Datetime.js";
import { master_configuration } from "../../config/master_config.js";
import { handleSequelizeError } from "../../config/validationCheck.js";
import { getEasyTimeToken } from "../../Utils/easytime.js";
import { getEASYTIMEURL } from "../../Utils/EASYTIME_URL.js";

const MASTER_CONFIG = master_configuration();
const DEPT_GMASTER_ID = 8;

//before error and success message format
// export const handleAdd = async (req, res) => {
//   const QueryTime = await getCurrentISTTime();
//   const userId = req.user?.userId;

//   try {
//     const bodydata = req.body.data || req.body;
//     const { originaltable, columns, values, error, statusCode } = req.precheck;

//     if (error) {
//       return res
//         .status(statusCode || 400)
//         .json({ status: false, message: error });
//     }

//     const { gmaster_id, name } = bodydata;

//     const trimmedName =
//       typeof name === "string" ? capitalizeFirstLetter(name.trim()) : "";

//     // 🔹 Fetch hostel mapping
//     const [hostelRows] = await db.query(
//       `SELECT hostel_id FROM userhostelmap WHERE users_id = ?`,
//       { replacements: [userId] }
//     );

//     if (!hostelRows.length) {
//       return res.status(400).json({
//         status: false,
//         message: "User does not have any hostel mapping.",
//       });
//     }

//     // 🔹 Start transaction ONCE
//     await db.query("START TRANSACTION");

//     let insertedIDs = [];

//     for (const row of hostelRows) {
//       const hostelId = row.hostel_id;

//       // 🔹 Duplicate check per hostel
//       const [[dup]] = await db.query(
//         `SELECT COUNT(*) AS count
//          FROM gmastervalue
//          WHERE gmaster_id = ? AND name = ? AND hostel_id = ?`,
//         { replacements: [gmaster_id, trimmedName, hostelId] }
//       );

//       if (dup.count > 0) {
//         throw new Error(
//           `The value '${trimmedName}' already exists for hostel ${hostelId}`
//         );
//       }

//       const finalColumns = [...columns, "hostel_id"];
//       const finalValues = [
//         ...values.map((val, idx) =>
//           columns[idx] === "name" ? trimmedName : val
//         ),
//         hostelId,
//       ];

//       const placeholders = finalColumns.map(() => "?").join(", ");

//       const [result] = await db.query(
//         `INSERT INTO ${originaltable} (${finalColumns.join(", ")})
//          VALUES (${placeholders})`,
//         { replacements: finalValues }
//       );

//       insertedIDs.push({ id: result, hostel_id: hostelId });
//     }

//     // 🔹 Commit DB changes
//     await db.query("COMMIT");
//     // 🔹 WDMS sync only once
//     if (gmaster_id == DEPT_GMASTER_ID && insertedIDs.length) {
//       try {
//         const token = await getEasyTimeToken(userId);
//         const first = insertedIDs[0];
//         const payload = {
//           dept_code: first.id,
//           dept_name: trimmedName,
//           parent_dept: null,
//         };

//         const wdmsRes = await axios.post(
//           `${await getEASYTIMEURL(userId)}/personnel/api/departments/`,
//           payload,
//           {
//             headers: {
//               Authorization: `Token ${token}`,
//               "Content-Type": "application/json",
//             },
//           }
//         );

//         await db.query(
//           `INSERT INTO wdms_mapping (local_type, local_id, wdms_id)
//            VALUES (?, ?, ?)`,
//           {
//             replacements: ["department", first.id, wdmsRes.data.id],
//           }
//         );
//       } catch (err) {
//         console.error(
//           "❌ WDMS Sync Failed:",
//           err.response?.data || err.message
//         );
//       }
//     }

//     return res.status(200).json({
//       status: true,
//       message: "Record added successfully.",
//       data: insertedIDs,
//     });
//   } catch (error) {
//     await db.query("ROLLBACK");
//     console.error("HANDLE_ADD_ERROR:", error.message);

//     return res.status(500).json({
//       status: false,
//       message: error.message || "Internal server error",
//     });
//   }
// };

export const handleAdd = async (req, res) => {
  const QueryTime = await getCurrentISTTime();
  const userId = req.user?.userId;

  try {
    const bodydata = req.body.data || req.body;
    const { originaltable, columns, values, error, statusCode } = req.precheck;

    if (error) {
      return res
        .status(statusCode || 400)
        .json({ status: false, message: error });
    }

    const { gmaster_id, name } = bodydata;

    const trimmedName =
      typeof name === "string" ? capitalizeFirstLetter(name.trim()) : "";

    await db.query("START TRANSACTION");

    // 🔹 GLOBAL duplicate check (NO hostel)
    const [[dup]] = await db.query(
      `SELECT COUNT(*) AS count
       FROM gmastervalue
       WHERE gmaster_id = ? AND name = ?`,
      { replacements: [gmaster_id, trimmedName] }
    );

    if (dup.count > 0) {
      throw new Error(`The value '${trimmedName}' already exists`);
    }

    const finalValues = values.map((val, idx) =>
      columns[idx] === "name" ? trimmedName : val
    );

    const placeholders = columns.map(() => "?").join(", ");

    const [result] = await db.query(
      `INSERT INTO ${originaltable} (${columns.join(", ")})
       VALUES (${placeholders})`,
      { replacements: finalValues }
    );

    await db.query("COMMIT");

    const insertedId = result;

    // 🔹 WDMS sync (Department only)
    if (gmaster_id == DEPT_GMASTER_ID) {
      try {
        const token = await getEasyTimeToken(userId);

        const payload = {
          dept_code: insertedId,
          dept_name: trimmedName,
          parent_dept: null,
        };

        const wdmsRes = await axios.post(
          `${await getEASYTIMEURL(userId)}/personnel/api/departments/`,
          payload,
          {
            headers: {
              Authorization: `Token ${token}`,
              "Content-Type": "application/json",
            },
          }
        );

        await db.query(
          `INSERT INTO wdms_mapping (local_type, local_id, wdms_id)
           VALUES (?, ?, ?)`,
          {
            replacements: ["department", insertedId, wdmsRes.data.id],
          }
        );
      } catch (err) {
        console.error(
          "❌ WDMS Sync Failed:",
          err.response?.data || err.message
        );
      }
    }

    return res.status(200).json({
      status: true,
      message: "Record added successfully.",
      data: { id: insertedId },
    });
  } catch (error) {
    await db.query("ROLLBACK");
    console.error("HANDLE_ADD_ERROR:", error.message);

    return res.status(500).json({
      status: false,
      message: error.message || "Internal server error",
    });
  }
};

export const handleGet = async (req, res) => {
  const QueryTime = await getCurrentISTTime();
  console.log("Current IST Time:", QueryTime);
  console.log("handleGet_initiated", QueryTime);

  try {
    const table = req.params.table;
    const id = req.query.id;
    const searchTerm = req.query.search || "";
    const { tableName } = req.getcheck;

    const userId = req.user?.userId;
    const roleId = req.user?.roleId;

    if (!userId || !roleId) {
      return res.status(401).json({
        status: false,
        issuccess: false,
        message: "Unauthorized - Missing user or role ID",
      });
    }

    // Pagination
    const usePagination =
      req.query.page !== undefined ||
      req.query.pageSize !== undefined ||
      req.query.pagesize !== undefined;

    const page = parseInt(req.query.page) || 1;
    const pageSize = parseInt(
      req.query.pageSize || req.query.pagesize || "10",
      10
    );
    const offset = (page - 1) * pageSize;

    let whereConditions = [];
    let whereParams = [];

    // Base filter for gmastervalue
    if (tableName === "gmastervalue" && req.query.gmaster_id) {
      whereConditions.push(`gmaster_id = ?`);
      whereParams.push(req.query.gmaster_id);
    }

    // ID filter
    if (id) {
      whereConditions.push(`id = ?`);
      whereParams.push(id);
    }

    // Search filter
    if (searchTerm) {
      if (
        table === "gmastervalue" ||
        [
          "location",
          "location1",
          "location2",
          "brand",
          "tagtype",
          "status",
          "vendors",
        ].includes(table)
      ) {
        whereConditions.push(`name LIKE ?`);
        whereParams.push(`%${searchTerm}%`);
      } else {
        const searchableFields = MASTER_CONFIG[table]?.fields
          ?.filter((field) => field.type === "string")
          ?.map((field) => field.name);

        if (searchableFields?.length > 0) {
          const searchParts = searchableFields.map(
            (field) => `${field} LIKE ?`
          );
          whereConditions.push(`(${searchParts.join(" OR ")})`);
          whereParams.push(...searchableFields.map(() => `%${searchTerm}%`));
        }
      }
    }

    // ❌ REMOVED: Department (gmaster_id = 8) hostel-based restriction
    // All users can now view all department data

    // Pagination clause
    const PageClause =
      usePagination === true ? `LIMIT ${pageSize} OFFSET ${offset}` : ``;

    // Build final SELECT query
    let dataQuery = `SELECT * FROM ${tableName}`;
    if (whereConditions.length > 0) {
      dataQuery += ` WHERE ${whereConditions.join(" AND ")}`;
    }
    dataQuery += ` ORDER BY name ASC ${PageClause}`;

    const [CommonList] = await db.query(dataQuery, {
      replacements: whereParams,
    });

    // Count query
    const [[{ total }]] = await db.query(
      `SELECT COUNT(*) as total FROM ${tableName} ${
        whereConditions.length > 0
          ? "WHERE " + whereConditions.join(" AND ")
          : ""
      }`,
      { replacements: whereParams }
    );

    return res.status(200).json({
      status: true,
      issuccess: true,
      count: total || 0,
      data: id ? CommonList[0] : CommonList,
    });
  } catch (error) {
    console.error("❌ Error in handleGet:", error);
    return res.status(500).json({
      status: false,
      issuccess: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

//before error and success message format
// export const handleUpdate = async (req, res) => {
//   const QueryTime = await getCurrentISTTime();
//   console.log("Current IST Time:", QueryTime);

//   const userId = req.user?.userId;
//   const roleId = req.user?.roleId;

//   const EASYTIME_URL = await getEASYTIMEURL(userId);

//   try {
//     console.log("handled_updated_initiated", QueryTime);

//     const bodydata = req.body.data || req.body;
//     const id = req.params.id;

//     const {
//       originaltable,
//       placeholders,
//       values,
//       error,
//       statusCode,
//       primaryKey,
//     } = req.precheck;

//     if (error) {
//       return res
//         .status(statusCode || 400)
//         .json({ status: false, message: error });
//     }

//     const { gmaster_id, name } = bodydata;
//     const trimmedName = typeof name === "string" ? name.trim() : "";

//     // Duplicate validation for master values
//     if (trimmedName && gmaster_id) {
//       const [[duplicateCheck]] = await db.query(
//         `SELECT COUNT(*) as count FROM gmastervalue WHERE gmaster_id = ? AND name = ? AND id != ?`,
//         { replacements: [gmaster_id, trimmedName, id] }
//       );
//       if (duplicateCheck.count > 0) {
//         return res.status(409).json({
//           status: false,
//           message: `The value '${trimmedName}' already exists under this master.`,
//         });
//       }
//     }

//     const trimmedValues = values.map((val, idx) => {
//       const colName = placeholders[idx].split("=")[0].trim();
//       if (colName === "name" && typeof val === "string") {
//         return capitalizeFirstLetter(val);
//       }
//       return val;
//     });

//     // ------------------ DB UPDATE ------------------
//     await db.query("START TRANSACTION");

//     if (placeholders?.length !== 0) {
//       await db.query(
//         `UPDATE ${originaltable} SET ${placeholders.join(
//           ", "
//         )} WHERE ${primaryKey} = ?`,
//         { replacements: [...trimmedValues, id] }
//       );
//     }

//     await db.query("COMMIT");
//     console.log("✔ Local DB update committed");

//     // ================= WDMS DEPARTMENT SYNC =================
//     // ================= WDMS DEPARTMENT SYNC =================
//     if (gmaster_id == DEPT_GMASTER_ID) {
//       console.log("🔄 Department WDMS Sync Started");

//       try {
//         const [mappingRows] = await db.query(
//           `SELECT wdms_id FROM wdms_mapping WHERE local_type = ? AND local_id = ? LIMIT 1`,
//           { replacements: ["department", id] }
//         );

//         const wdmsId = mappingRows?.length ? mappingRows[0].wdms_id : null;
//         const token = await getEasyTimeToken(userId);

//         const headers = {
//           Authorization: `Token ${token}`,
//           "Content-Type": "application/json",
//         };

//         // WDMS expects dept_code + dept_name + parent_dept
//         const updateData = {
//           dept_code: id, // IMPORTANT: dept_code = local DB id
//           dept_name: trimmedName,
//           parent_dept: null,
//         };

//         if (wdmsId) {
//           console.log("🔁 Updating WDMS department:", id);

//           await axios.put(
//             `${EASYTIME_URL}/personnel/api/departments/${id}/`,
//             updateData,
//             { headers }
//           );

//           console.log("✔ WDMS Department Updated");
//         } else {
//           console.log("➕ Inserting new WDMS department");

//           const inserted = await axios.post(
//             `${EASYTIME_URL}/personnel/api/departments/`,
//             updateData,
//             { headers }
//           );

//           const newWdmsId = inserted?.data?.id;
//           if (!newWdmsId) throw new Error("WDMS Insert did not return ID");

//           await db.query(
//             `INSERT INTO wdms_mapping (wdms_id, local_id, local_type)
//          VALUES (?, ?, 'department')`,
//             { replacements: [newWdmsId, id] }
//           );

//           console.log("✔ WDMS Department Inserted & Mapping Added");
//         }
//       } catch (err) {
//         console.error(
//           "❌ WDMS Department Sync Failed:",
//           err.response?.data || err.message
//         );
//       }
//     }

//     // ================= RESPONSE ====================
//     res.status(200).json({
//       issuccess: true,
//       status: true,
//       message: `Record updated successfully.`,
//     });
//   } catch (error) {
//     try {
//       await db.query("ROLLBACK");
//     } catch {}
//     console.log("handled_updated_failed", QueryTime);

//     const errorFetch = handleSequelizeError(error);
//     res.status(errorFetch?.statusCode || 500).json({
//       status: errorFetch?.status,
//       message: errorFetch?.message,
//     });
//   }
// };

export const handleUpdate = async (req, res) => {
  const QueryTime = await getCurrentISTTime();
  console.log("Current IST Time:", QueryTime);

  const userId = req.user?.userId;
  const roleId = req.user?.roleId;

  const EASYTIME_URL = await getEASYTIMEURL(userId);

  try {
    console.log("handled_updated_initiated", QueryTime);

    const bodydata = req.body.data || req.body;
    const id = req.params.id;

    const {
      originaltable,
      placeholders,
      values,
      error,
      statusCode,
      primaryKey,
    } = req.precheck;

    if (error) {
      return res
        .status(statusCode || 400)
        .json({ status: false, error: "PRECHECK_FAILED", message: error });
    }

    const { gmaster_id, name } = bodydata;
    const trimmedName = typeof name === "string" ? name.trim() : "";

    // Duplicate validation for master values
    if (trimmedName && gmaster_id) {
      const [[duplicateCheck]] = await db.query(
        `SELECT COUNT(*) as count FROM gmastervalue WHERE gmaster_id = ? AND name = ? AND id != ?`,
        { replacements: [gmaster_id, trimmedName, id] }
      );
      if (duplicateCheck.count > 0) {
        return res.status(409).json({
          status: false,
          error: "DUPLICATE_RECORD",
          message: `The value '${trimmedName}' already exists under this master.`,
        });
      }
    }

    const trimmedValues = values.map((val, idx) => {
      const colName = placeholders[idx].split("=")[0].trim();
      if (colName === "name" && typeof val === "string") {
        return capitalizeFirstLetter(val);
      }
      return val;
    });

    // ------------------ DB UPDATE ------------------
    await db.query("START TRANSACTION");

    if (placeholders?.length !== 0) {
      await db.query(
        `UPDATE ${originaltable} SET ${placeholders.join(
          ", "
        )} WHERE ${primaryKey} = ?`,
        { replacements: [...trimmedValues, id] }
      );
    }

    await db.query("COMMIT");
    console.log("✔ Local DB update committed");

    // ================= WDMS DEPARTMENT SYNC =================
    if (gmaster_id == DEPT_GMASTER_ID) {
      console.log("🔄 Department WDMS Sync Started");

      try {
        const [mappingRows] = await db.query(
          `SELECT wdms_id FROM wdms_mapping WHERE local_type = ? AND local_id = ? LIMIT 1`,
          { replacements: ["department", id] }
        );

        const wdmsId = mappingRows?.length ? mappingRows[0].wdms_id : null;
        const token = await getEasyTimeToken(userId);

        const headers = {
          Authorization: `Token ${token}`,
          "Content-Type": "application/json",
        };

        const updateData = {
          dept_code: id,
          dept_name: trimmedName,
          parent_dept: null,
        };

        if (wdmsId) {
          await axios.put(
            `${EASYTIME_URL}/personnel/api/departments/${id}/`,
            updateData,
            { headers }
          );
          console.log("✔ WDMS Department Updated");
        } else {
          const inserted = await axios.post(
            `${EASYTIME_URL}/personnel/api/departments/`,
            updateData,
            { headers }
          );

          const newWdmsId = inserted?.data?.id;
          if (!newWdmsId) throw new Error("WDMS Insert did not return ID");

          await db.query(
            `INSERT INTO wdms_mapping (wdms_id, local_id, local_type)
             VALUES (?, ?, 'department')`,
            { replacements: [newWdmsId, id] }
          );

          console.log("✔ WDMS Department Inserted & Mapping Added");
        }
      } catch (err) {
        console.warn(
          "❌ WDMS Department Sync Failed:",
          err.response?.data || err.message
        );
      }
    }

    // ================= RESPONSE ====================
    return res.status(200).json({
      status: true,
      error: null,
      message: "Record updated successfully",
      data: { id },
    });
  } catch (error) {
    try {
      await db.query("ROLLBACK");
    } catch {}

    console.log("handled_updated_failed", QueryTime);

    return res.status(500).json({
      status: false,
      error: error.code || "INTERNAL_SERVER_ERROR",
      message:
        error.message ||
        "An unexpected error occurred while updating the record.",
    });
  }
};

// export const handleDelete = async (req, res) => {
//   const { table, id } = req.params;
//   const EASYTIME_URL = process.env.EASYTIME_URL || "http://192.168.0.116:8000";

//   const ids = id
//     .split(",")
//     .map((x) => Number(x.trim()))
//     .filter(Boolean);
//   if (ids.length === 0) {
//     return res.status(400).json({ status: false, message: "Invalid IDs" });
//   }

//   let localTable = "";
//   let pk = "id";
//   let wdmsType = "";
//   let wdmsDeleteURL = "";
//   let dependencyTable = "";

//   /* ------------ TABLE MAPPING -------------- */
//   if (table === "student") {
//     localTable = "student";
//     wdmsType = "employee";
//     wdmsDeleteURL = `${EASYTIME_URL}/personnel/api/employees/`; // delete using memberid
//     dependencyTable = "studentgmastermap";
//   } else if (table === "department") {
//     localTable = "gmastervalue"; // DEPT stored here
//     wdmsType = "department";
//     wdmsDeleteURL = `${EASYTIME_URL}/personnel/api/departments/`;
//   } else {
//     return res.status(400).json({ status: false, message: "Invalid table" });
//   }

//   const placeholders = ids.map(() => "?").join(",");

//   try {
//     /* -------- FIRST FETCH WDMS ID BEFORE DELETE -------- */
//     let wdmsData = [];
//     if (table === "student") {
//       [wdmsData] = await db.query(
//         `SELECT s.memberid AS wdms_key
//          FROM student s
//          WHERE s.id IN (${placeholders})`,
//         { replacements: ids }
//       );
//     } else if (table === "department") {
//       [wdmsData] = await db.query(
//         `SELECT name AS wdms_key
//          FROM gmastervalue
//          WHERE id IN (${placeholders})`,
//         { replacements: ids }
//       );
//     }

//     /* -------- LOCAL DELETE START -------- */
//     await db.query("START TRANSACTION");

//     if (dependencyTable) {
//       await db.query(
//         `DELETE FROM ${dependencyTable} WHERE student_id IN (${placeholders})`,
//         { replacements: ids }
//       );
//     }

//     await db.query(
//       `DELETE FROM ${localTable} WHERE ${pk} IN (${placeholders})`,
//       { replacements: ids }
//     );

//     await db.query(
//       `DELETE FROM wdms_mapping WHERE local_type=? AND local_id IN (${placeholders})`,
//       { replacements: [wdmsType, ...ids] }
//     );

//     await db.query("COMMIT");
//     console.log("✔ Local deletion success:", ids);

//     /* -------- WDMS DELETE AFTER LOCAL SUCCESS -------- */
//     if (wdmsData.length > 0) {
//       try {
//         const token = await getEasyTimeToken();

//         for (const row of wdmsData) {
//           try {
//             await axios.delete(`${wdmsDeleteURL}${row.wdms_key}/`, {
//               headers: { Authorization: `Token ${token}` },
//             });
//             console.log(`✔ WDMS DELETE SUCCESS → ${row.wdms_key}`);
//           } catch (e) {
//             console.log(
//               `❌ WDMS DELETE FAILED → ${row.wdms_key}`,
//               e.response?.data || e.message
//             );
//           }
//         }
//       } catch (err) {
//         console.log("❌ WDMS Connection Failed:", err.message);
//       }
//     }

//     res.status(200).json({
//       status: true,
//       issuccess: true,
//       deleted: ids,
//       message: "Record(s) deleted successfully",
//     });
//   } catch (error) {
//     try {
//       await db.query("ROLLBACK");
//     } catch {}
//     console.error("Delete error:", error);
//     res
//       .status(500)
//       .json({ status: false, issuccess: false, message: error.message });
//   }
// };

/// this is not working in new server wdms db not deleting
// export const handleDelete = async (req, res) => {
//   const { table, id } = req.params;

//   const userId = req.user?.userId;
//   const roleId = req.user?.roleId;

//   const EASYTIME_URL = await getEASYTIMEURL(userId);

//   const ids = id
//     .split(",")
//     .map((x) => Number(x.trim()))
//     .filter(Boolean);

//   if (ids.length === 0) {
//     return res.status(400).json({ status: false, message: "Invalid IDs" });
//   }

//   let localTable = "";
//   let pk = "id";
//   let wdmsType = "";
//   let dependencyTable = "";

//   /* ------------ TABLE MAPPING -------------- */
//   if (table === "student") {
//     localTable = "student";
//     wdmsType = "employee";
//     dependencyTable = "studentgmastermap";
//   } else if (table === "department") {
//     localTable = "gmastervalue"; // DEPT stored here
//     wdmsType = "department";
//   } else {
//     return res.status(400).json({ status: false, message: "Invalid table" });
//   }

//   const placeholders = ids.map(() => "?").join(",");

//   try {
//     /* -------- START TRANSACTION -------- */
//     await db.query("START TRANSACTION");

//     /* -------- FETCH WDMS INFO BEFORE DELETE -------- */
//     let wdmsData = [];

//     if (table === "student") {
//       [wdmsData] = await db.query(
//         `SELECT memberid AS wdms_key FROM student WHERE id IN (${placeholders})`,
//         { replacements: ids }
//       );
//     } else if (table === "department") {
//       [wdmsData] = await db.query(
//         `SELECT id AS local_id, name AS dept_name FROM gmastervalue WHERE id IN (${placeholders})`,
//         { replacements: ids }
//       );
//     }

//     /* -------- DELETE DEPENDENT LOCAL RECORDS -------- */
//     if (dependencyTable) {
//       await db.query(
//         `DELETE FROM ${dependencyTable} WHERE student_id IN (${placeholders})`,
//         { replacements: ids }
//       );
//     }

//     /* -------- DELETE LOCAL RECORD -------- */
//     await db.query(
//       `DELETE FROM ${localTable} WHERE ${pk} IN (${placeholders})`,
//       { replacements: ids }
//     );

//     /* -------- DELETE LOCAL WDMS MAPPING -------- */
//     await db.query(
//       `DELETE FROM wdms_mapping WHERE local_type=? AND local_id IN (${placeholders})`,
//       { replacements: [wdmsType, ...ids] }
//     );

//     await db.query("COMMIT");
//     console.log("✔ Local deletion success:", ids);

//     /* -------- WDMS DELETE AFTER LOCAL SUCCESS -------- */
//     if (wdmsData.length > 0) {
//       try {
//         const token = await getEasyTimeToken(userId);

//         for (const row of wdmsData) {
//           if (table === "student") {
//             // DELETE student using memberid
//             try {
//               await axios.delete(
//                 `${EASYTIME_URL}/personnel/api/employees/${row.wdms_key}/`,
//                 {
//                   headers: { Authorization: `Token ${token}` },
//                 }
//               );
//               console.log(
//                 `✔ WDMS employee deletedfdsafsfasfasfsa → ${row.wdms_key}`
//               );
//             } catch (err) {
//               console.warn(
//                 `❌ WDMS delete failedfdsfsfasdsf for ${row.wdms_key}`,
//                 err.response?.data || err.message
//               );
//             }
//           } else if (table === "department") {
//             console.log("🔍 WDMS DELETE → EASYTIME_URL:", EASYTIME_URL);

//             // Get WDMS department id first using dept_code

//             try {
//               const { data } = await axios.get(
//                 `${EASYTIME_URL}/personnel/api/departments/`,
//                 {
//                   headers: { Authorization: `Token ${token}` },
//                   params: { dept_code: row.local_id },
//                 }
//               );

//               if (data?.data?.length > 0) {
//                 const wdmsId = data.data[0].id;
//                 console.log(
//                   "🔍 WDMS DELETE REQUEST:",
//                   `${EASYTIME_URL}/personnel/api/departments/${129}/`
//                 );

//                 console.log(wdmsId, "wdmsIdddddddddddddd");

//                 await axios.delete(
//                   `${EASYTIME_URL}/personnel/api/departments/${129}/`,
//                   {
//                     headers: { Authorization: `Token ${token}` },
//                   }
//                 );
//                 console.log(`✔ WDMS department deleted → ${wdmsId}`);
//               } else {
//                 console.warn(
//                   `❌ WDMS department not found for local ID ${row.local_id}`
//                 );
//               }
//             } catch (err) {
//               console.warn(
//                 `❌ WDMS delete failed for department local ID ${row.local_id}`,
//                 err.response?.data || err.message
//               );
//             }
//           }
//         }
//       } catch (err) {
//         console.error("❌ WDMS connection failed:", err.message);
//       }
//     }

//     return res.status(200).json({
//       status: true,
//       issuccess: true,
//       deleted: ids,
//       message: "Record(s) deleted successfully",
//     });
//   } catch (error) {
//     try {
//       await db.query("ROLLBACK");
//     } catch (_) {}
//     console.error("Delete error:", error);
//     return res.status(500).json({
//       status: false,
//       issuccess: false,
//       message: error.message,
//     });
//   }
// };

//before error and success message format
// export const handleDelete = async (req, res) => {
//   const { table, id } = req.params;

//   const userId = req.user?.userId;

//   const EASYTIME_URL = await getEASYTIMEURL(userId);

//   const ids = id
//     .split(",")
//     .map((x) => Number(x.trim()))
//     .filter(Boolean);

//   if (ids.length === 0) {
//     return res.status(400).json({ status: false, message: "Invalid IDs" });
//   }

//   let localTable = "";
//   let pk = "id";
//   let wdmsType = "";
//   let dependencyTable = "";

//   /* ------------ TABLE MAPPING -------------- */
//   if (table === "student") {
//     localTable = "student";
//     wdmsType = "employee";
//     dependencyTable = "studentgmastermap";
//   } else if (table === "department") {
//     localTable = "gmastervalue"; // DEPT stored here
//     wdmsType = "department";
//   } else {
//     return res.status(400).json({ status: false, message: "Invalid table" });
//   }

//   const placeholders = ids.map(() => "?").join(",");

//   try {
//     /* -------- START TRANSACTION -------- */
//     await db.query("START TRANSACTION");

//     /* -------- FETCH WDMS INFO BEFORE DELETE -------- */
//     let wdmsData = [];

//     if (table === "student") {
//       [wdmsData] = await db.query(
//         `SELECT memberid AS wdms_key FROM student WHERE id IN (${placeholders})`,
//         { replacements: ids }
//       );
//     } else if (table === "department") {
//       [wdmsData] = await db.query(
//         `SELECT id AS local_id, name AS dept_name FROM gmastervalue WHERE id IN (${placeholders})`,
//         { replacements: ids }
//       );
//     }

//     /* -------- DELETE DEPENDENT LOCAL RECORDS -------- */
//     if (dependencyTable) {
//       await db.query(
//         `DELETE FROM ${dependencyTable} WHERE student_id IN (${placeholders})`,
//         { replacements: ids }
//       );
//     }

//     /* -------- DELETE LOCAL MAIN RECORD -------- */
//     await db.query(
//       `DELETE FROM ${localTable} WHERE ${pk} IN (${placeholders})`,
//       { replacements: ids }
//     );

//     /* -------- DELETE WDMS MAPPING LOCALLY -------- */
//     await db.query(
//       `DELETE FROM wdms_mapping WHERE local_type=? AND local_id IN (${placeholders})`,
//       { replacements: [wdmsType, ...ids] }
//     );

//     await db.query("COMMIT");
//     console.log("✔ Local deletion success:", ids);

//     /* -------- WDMS DELETE AFTER LOCAL SUCCESS -------- */
//     if (wdmsData.length > 0) {
//       try {
//         const token = await getEasyTimeToken(userId);

//         console.log("🔍 WDMS DELETE → EASYTIME_URL:", EASYTIME_URL);

//         for (const row of wdmsData) {
//           /* ------------------ STUDENT DELETE ------------------ */
//           if (table === "student") {
//             try {
//               const url = `${EASYTIME_URL}/personnel/api/employees/${row.wdms_key}/`;

//               console.log("🔍 WDMS DELETE REQUEST:", url);

//               await axios.delete(url, {
//                 headers: { Authorization: `Token ${token}` },
//               });

//               console.log(`✔ WDMS employee deleted → ${row.wdms_key}`);
//             } catch (err) {
//               console.warn(
//                 `❌ WDMS delete failed for student ${row.wdms_key}`,
//                 err.response?.data || err.message
//               );
//             }
//           } else if (table === "department") {
//             console.log("🔍 WDMS DELETE → EASYTIME_URL:", EASYTIME_URL);

//             try {
//               // DELETE directly using dept_code (not WDMS ID)
//               const deptCode = row.local_id; // or row.dept_code if available

//               console.log(
//                 "🔍 WDMS DEPARTMENT DELETE URL:",
//                 `${EASYTIME_URL}/personnel/api/departments/${ids}/`
//               );

//               const response = await axios.delete(
//                 `${EASYTIME_URL}/personnel/api/departments/${ids}/`,
//                 {
//                   headers: { Authorization: `Token ${token}` },
//                 }
//               );

//               console.log(`✔ WDMS department deleted → ${deptCode}`);
//             } catch (err) {
//               console.warn(
//                 `❌ WDMS delete failed for department local ID ${row.local_id}`,
//                 err.response?.data || err.message
//               );
//             }
//           }
//         }
//       } catch (err) {
//         console.error("❌ WDMS connection failed:", err.message);
//       }
//     }

//     return res.status(200).json({
//       status: true,
//       issuccess: true,
//       deleted: ids,
//       message: "Record(s) deleted successfully",
//     });
//   } catch (error) {
//     try {
//       await db.query("ROLLBACK");
//     } catch (_) {}

//     console.error("Delete error:", error);

//     return res.status(500).json({
//       status: false,
//       issuccess: false,
//       message: error.message,
//     });
//   }
// };

export const handleDelete = async (req, res) => {
  const { table, id } = req.params;

  const userId = req.user?.userId;

  const EASYTIME_URL = await getEASYTIMEURL(userId);

  const ids = id
    .split(",")
    .map((x) => Number(x.trim()))
    .filter(Boolean);

  if (ids.length === 0) {
    return res.status(400).json({
      status: false,
      error: "INVALID_IDS",
      message: "No valid IDs provided for deletion",
    });
  }

  let localTable = "";
  let pk = "id";
  let wdmsType = "";
  let dependencyTable = "";

  /* ------------ TABLE MAPPING -------------- */
  if (table === "student") {
    localTable = "student";
    wdmsType = "employee";
    dependencyTable = "studentgmastermap";
  } else if (table === "department") {
    localTable = "gmastervalue"; // DEPT stored here
    wdmsType = "department";
  } else {
    return res.status(400).json({
      status: false,
      error: "INVALID_TABLE",
      message: "The specified table is invalid",
    });
  }

  const placeholders = ids.map(() => "?").join(",");

  try {
    /* -------- START TRANSACTION -------- */
    await db.query("START TRANSACTION");

    /* -------- FETCH WDMS INFO BEFORE DELETE -------- */
    let wdmsData = [];

    if (table === "student") {
      [wdmsData] = await db.query(
        `SELECT memberid AS wdms_key FROM student WHERE id IN (${placeholders})`,
        { replacements: ids }
      );
    } else if (table === "department") {
      [wdmsData] = await db.query(
        `SELECT id AS local_id, name AS dept_name FROM gmastervalue WHERE id IN (${placeholders})`,
        { replacements: ids }
      );
    }

    /* -------- DELETE DEPENDENT LOCAL RECORDS -------- */
    if (dependencyTable) {
      await db.query(
        `DELETE FROM ${dependencyTable} WHERE student_id IN (${placeholders})`,
        { replacements: ids }
      );
    }

    /* -------- DELETE LOCAL MAIN RECORD -------- */
    await db.query(
      `DELETE FROM ${localTable} WHERE ${pk} IN (${placeholders})`,
      { replacements: ids }
    );

    /* -------- DELETE WDMS MAPPING LOCALLY -------- */
    await db.query(
      `DELETE FROM wdms_mapping WHERE local_type=? AND local_id IN (${placeholders})`,
      { replacements: [wdmsType, ...ids] }
    );

    await db.query("COMMIT");
    console.log("✔ Local deletion success:", ids);

    /* -------- WDMS DELETE AFTER LOCAL SUCCESS -------- */
    if (wdmsData.length > 0) {
      try {
        const token = await getEasyTimeToken(userId);

        for (const row of wdmsData) {
          if (table === "student") {
            try {
              await axios.delete(
                `${EASYTIME_URL}/personnel/api/employees/${row.wdms_key}/`,
                { headers: { Authorization: `Token ${token}` } }
              );
              console.log(`✔ WDMS employee deleted → ${row.wdms_key}`);
            } catch (err) {
              console.warn(
                `❌ WDMS delete failed for student ${row.wdms_key}`,
                err.response?.data || err.message
              );
            }
          } else if (table === "department") {
            try {
              await axios.delete(
                `${EASYTIME_URL}/personnel/api/departments/${ids}/`,
                { headers: { Authorization: `Token ${token}` } }
              );
              console.log(`✔ WDMS department deleted → ${row.local_id}`);
            } catch (err) {
              console.warn(
                `❌ WDMS delete failed for department local ID ${row.local_id}`,
                err.response?.data || err.message
              );
            }
          }
        }
      } catch (err) {
        console.error("❌ WDMS connection failed:", err.message);
      }
    }

    return res.status(200).json({
      status: true,
      error: null,
      issuccess: true,
      message: `Record(s) deleted successfully`,
      data: { deleted_ids: ids },
    });
  } catch (error) {
    try {
      await db.query("ROLLBACK");
    } catch (_) {}

    console.error("Delete error:", error);

    return res.status(500).json({
      status: false,
      error: error.code || "INTERNAL_SERVER_ERROR",
      issuccess: false,
      message:
        error.message ||
        "An unexpected error occurred while deleting the record",
    });
  }
};
