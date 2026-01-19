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

// export const handleAdd = async (req, res) => {
//   const QueryTime = await getCurrentISTTime();
//   const userId = req.user?.userId;

//   try {
//     const bodydata = req.body.data || req.body;
//     const { originaltable, error, statusCode } = req.precheck;

//     if (error) {
//       return res
//         .status(statusCode || 400)
//         .json({ status: false, message: error });
//     }

//     let { gmaster_id, name } = bodydata;
//     name = typeof name === "string" ? name.trim() : "";

//     let hostelId = null;

//     // ? Add prefix for department based on user's hostel
//     if (gmaster_id == DEPT_GMASTER_ID) {
//       // Get user's hostel_id from userhostelmap
//       const [[userHostel]] = await db.query(
//         `SELECT hostel_id FROM userhostelmap WHERE users_id = ?`,
//         { replacements: [userId] }
//       );

//       if (userHostel?.hostel_id) {
//         hostelId = userHostel.hostel_id;

//         // Get hostel name
//         const [[hostel]] = await db.query(
//           `SELECT name FROM hostel WHERE id = ?`,
//           { replacements: [hostelId] }
//         );

//         if (hostel?.name) {
//           name = `${hostel.name} - ${name}`; // prepend hostel name
//         }
//       }
//     }

//     const trimmedName = capitalizeFirstLetter(name);

//     await db.query("START TRANSACTION");

//     // DUPLICATE CHECK (only for gmastervalue table)
//     if (originaltable !== "permissions") {
//       const [[dup]] = await db.query(
//         `SELECT COUNT(*) AS count FROM gmastervalue WHERE gmaster_id = ? AND name = ?`,
//         { replacements: [gmaster_id, trimmedName] }
//       );
//       if (dup.count > 0)
//         throw new Error(`The value '${trimmedName}' already exists`);
//     }

//     // PERMISSIONS TABLE
//     let finalColumns = [];
//     let finalValues = [];

//     if (originaltable === "permissions") {
//       finalColumns = ["name", "permission_id", "modifiedby", "status"];
//       finalValues = [
//         trimmedName || null,
//         bodydata.permission_id ?? null,
//         userId ?? null,
//         1,
//       ];
//     } else {
//       // For other tables, use precheck columns/values
//       finalColumns = [...req.precheck.columns];

//       // ? Add hostel_id column for department
//       if (
//         gmaster_id == DEPT_GMASTER_ID &&
//         !finalColumns.includes("hostel_id")
//       ) {
//         finalColumns.push("hostel_id");
//       }

//       finalValues = req.precheck.values.map((val, idx) =>
//         finalColumns[idx] === "name" ? trimmedName : val
//       );

//       // ? Add hostel_id value if applicable
//       if (gmaster_id == DEPT_GMASTER_ID) {
//         finalValues.push(hostelId);
//       }
//     }

//     // INSERT
//     const placeholders = finalColumns.map(() => "?").join(", ");
//     const [result] = await db.query(
//       `INSERT INTO ${originaltable} (${finalColumns.join(
//         ", "
//       )}) VALUES (${placeholders})`,
//       { replacements: finalValues }
//     );

//     await db.query("COMMIT");
//     const insertedId = result;

//     // WDMS SYNC (Department only)
//     if (gmaster_id == DEPT_GMASTER_ID) {
//       try {
//         const token = await getEasyTimeToken(userId);
//         const payload = {
//           dept_code: insertedId,
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
//           `INSERT INTO wdms_mapping (local_type, local_id, wdms_id) VALUES (?, ?, ?)`,

//           { replacements: ["department", insertedId, wdmsRes.data.id] }
//         );
//       } catch (err) {
//         console.error(
//           "? WDMS Sync Failed:",
//           err.response?.data || err.message
//         );
//       }
//     }

//     return res.status(200).json({
//       status: true,
//       message: "Record added successfully.",
//       data: { id: insertedId },
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

//before deparment inserting in both db

export const handleAdd = async (req, res) => {
  const QueryTime = await getCurrentISTTime();
  const userId = req.user?.userId;

  try {
    const bodydata = req.body.data || req.body;
    const { originaltable, error, statusCode } = req.precheck;

    if (error) {
      return res
        .status(statusCode || 400)
        .json({ status: false, message: error });
    }

    let { gmaster_id, name } = bodydata;
    name = typeof name === "string" ? name.trim() : "";

    let hostelId = null;

    // Add prefix for department based on user's hostel
    if (gmaster_id == DEPT_GMASTER_ID) {
      const [[userHostel]] = await db.query(
        `SELECT hostel_id FROM userhostelmap WHERE users_id = ?`,
        { replacements: [userId] }
      );

      if (userHostel?.hostel_id) {
        hostelId = userHostel.hostel_id;

        const [[hostel]] = await db.query(
          `SELECT name FROM hostel WHERE id = ?`,
          { replacements: [hostelId] }
        );

        if (hostel?.name) {
          name = `${hostel.name} - ${name}`;
        }
      }
    }

    const trimmedName = capitalizeFirstLetter(name);

    await db.query("START TRANSACTION");

    // DUPLICATE CHECK (except permissions and sidebar)
    if (originaltable !== "permissions" && originaltable !== "sidebar") {
      const [[dup]] = await db.query(
        `SELECT COUNT(*) AS count FROM gmastervalue WHERE gmaster_id = ? AND name = ?`,
        { replacements: [gmaster_id, trimmedName] }
      );
      if (dup.count > 0) {
        throw new Error(`The value '${trimmedName}' already exists`);
      }
    }

    let finalColumns = [];
    let finalValues = [];

    if (originaltable === "permissions") {
      finalColumns = ["name", "permission_id", "modifiedby", "status"];
      finalValues = [
        trimmedName ?? null,
        bodydata.permission_id ?? null,
        userId ?? null,
        1,
      ];
    } else if (originaltable === "sidebar") {
      // Sidebar requires all mandatory columns
      finalColumns = [
        "name",
        "icon",
        "path",
        "parent_permission",
        "permission",
        "status",
        "createdat",
        "createdby",
        "lastmodifiedat",
        "lastmodifiedby",
      ];

      finalValues = finalColumns.map((col) => {
        switch (col) {
          case "name":
            return bodydata.name ?? trimmedName ?? null;
          case "icon":
            return bodydata.icon ?? bodydata.name ?? null;
          case "path":
            return bodydata.path ?? null;
          case "parent_permission":
            return bodydata.parent_permission ?? null;
          case "permission":
            return bodydata.permission ?? null;
          case "status":
            return bodydata.status ?? 1;
          case "createdat":
            return bodydata.createdat ?? new Date();
          case "createdby":
            return bodydata.createdby ?? userId ?? null;
          case "lastmodifiedat":
            return bodydata.lastmodifiedat ?? new Date();
          case "lastmodifiedby":
            return bodydata.lastmodifiedby ?? userId ?? null;
          default:
            return null;
        }
      });
    } else {
      // Generic gmaster table
      finalColumns = [...(req.precheck?.columns || Object.keys(bodydata))];

      if (
        gmaster_id == DEPT_GMASTER_ID &&
        !finalColumns.includes("hostel_id")
      ) {
        finalColumns.push("hostel_id");
      }

      finalValues = finalColumns.map((col) => {
        if (col === "name") return trimmedName ?? null;
        if (col === "hostel_id") return hostelId ?? null;
        return bodydata[col] ?? null;
      });
    }

    // DEBUG: ensure columns & values match
    if (finalColumns.length !== finalValues.length) {
      console.error("COLUMN/VALUE MISMATCH", finalColumns, finalValues);
      throw new Error("Column and value count mismatch. Cannot insert.");
    }

    // LOCAL DB INSERT
    const placeholders = finalColumns.map(() => "?").join(", ");
    const [insertResult] = await db.query(
      `INSERT INTO ${originaltable} (${finalColumns.join(
        ", "
      )}) VALUES (${placeholders})`,
      { replacements: finalValues }
    );

    const insertedId = insertResult;

    // WDMS SYNC (DEPARTMENT)
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

        if (!wdmsRes?.data?.id) {
          throw new Error("WDMS returned no department ID");
        }

        await db.query(
          `INSERT INTO wdms_mapping (local_type, local_id, wdms_id) VALUES (?, ?, ?)`,
          {
            replacements: ["department", insertedId, wdmsRes.data.id],
          }
        );
      } catch (err) {
        await db.query("ROLLBACK");

        const errorMessage =
          err.response?.data?.message ||
          err.response?.data?.error ||
          err.message ||
          "WDMS sync failed";

        console.error("? WDMS Sync Failed:", errorMessage);

        return res.status(500).json({
          status: false,
          message: errorMessage,
        });
      }
    }

    await db.query("COMMIT");

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

    if (tableName === "gmastervalue" && req.query.gmaster_id) {
      whereConditions.push(`gmaster_id = ?`);
      whereParams.push(req.query.gmaster_id);
    }

    // Fix allowedtime id ambiguity
    if (id) {
      if (tableName === "allowedtime") {
        whereConditions.push(`at.id = ?`);
      } else {
        whereConditions.push(`id = ?`);
      }
      whereParams.push(id);
    }

    /* ---------------- SEARCH LOGIC ---------------- */
    if (searchTerm) {
      if (
        table !== "department" &&
        !(
          tableName === "gmastervalue" &&
          req.query.gmaster_id == DEPT_GMASTER_ID
        )
      ) {
        if (
          tableName === "gmastervalue" ||
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
    }

    /* ---------------- USER-SPECIFIC HOSTEL LOGIC ---------------- */
    if (tableName === "allowedtime" && roleId !== 1) {
      // If normal user, fetch only user's mapped hostel
      const [[userHostel]] = await db.query(
        `
        SELECT h.id, h.name
        FROM userhostelmap uhm
        JOIN hostel h ON h.id = uhm.hostel_id
        WHERE uhm.users_id = ?
        `,
        { replacements: [userId] }
      );

      if (userHostel?.id) {
        whereConditions.push(`at.hostel_id = ?`);
        whereParams.push(userHostel.id);
      } else {
        // If user has no hostel mapping, return empty
        return res.status(200).json({
          status: true,
          issuccess: true,
          count: 0,
          data: [],
        });
      }
    }

    const PageClause = usePagination
      ? `LIMIT ${pageSize} OFFSET ${offset}`
      : ``;

    const ORDER_BY_MAP = {
      allowedtime: "at.id",
      users: "Username",
      roles: "role_name",
      hostel: "name",
      department: "name",
      gmastervalue: "name",
    };

    const orderByColumn = ORDER_BY_MAP[tableName] || "id";

    /* ---------------- DATA QUERY ---------------- */
    let dataQuery = "";

    if (tableName === "allowedtime") {
      dataQuery = `
        SELECT 
          at.id,
          at.allowed_out_time,
          at.expected_return_time,
          at.hostel_id,
          h.name AS hostel_name
        FROM allowedtime at
        LEFT JOIN hostel h ON h.id = at.hostel_id
      `;
    } else {
      dataQuery = `SELECT * FROM ${tableName}`;
    }

    if (whereConditions.length > 0) {
      dataQuery += ` WHERE ${whereConditions.join(" AND ")}`;
    }

    dataQuery += ` ORDER BY ${orderByColumn} ASC ${PageClause}`;

    const [CommonList] = await db.query(dataQuery, {
      replacements: whereParams,
    });

    /* ---------------- COUNT QUERY ---------------- */
    let total = 0;
    if (tableName === "allowedtime") {
      const [[countResult]] = await db.query(
        `SELECT COUNT(*) as total
         FROM allowedtime at
         LEFT JOIN hostel h ON h.id = at.hostel_id
         ${
           whereConditions.length > 0
             ? "WHERE " + whereConditions.join(" AND ")
             : ""
         }
        `,
        { replacements: whereParams }
      );
      total = countResult.total || 0;
    } else {
      const [[countResult]] = await db.query(
        `SELECT COUNT(*) as total FROM ${tableName} ${
          whereConditions.length > 0
            ? "WHERE " + whereConditions.join(" AND ")
            : ""
        }`,
        { replacements: whereParams }
      );
      total = countResult.total || 0;
    }

    /* ---------------- FINAL DATA MAPPING ---------------- */
    const resultData = CommonList.map((item) => {
      if (item.gmaster_id == DEPT_GMASTER_ID && item.name.includes(" - ")) {
        const parts = item.name.split(" - ");
        return { ...item, name: parts[parts.length - 1].trim() };
      }
      return item;
    });

    return res.status(200).json({
      status: true,
      issuccess: true,
      count: total,
      data: id ? resultData[0] : resultData,
    });
  } catch (error) {
    console.error("? Error in handleGet:", error);
    return res.status(500).json({
      status: false,
      issuccess: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

export const handleUpdate = async (req, res) => {
  const QueryTime = await getCurrentISTTime();
  const userId = req.user?.userId;
  const roleId = req.user?.roleId;

  if (!userId || !roleId) {
    return res.status(401).json({
      status: false,
      message: "Unauthorized",
    });
  }

  const EASYTIME_URL = await getEASYTIMEURL(userId);

  try {
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

    /* ================= PRECHECK ================= */
    if (error) {
      return res.status(statusCode || 400).json({
        status: false,
        error: "PRECHECK_FAILED",
        message: error,
      });
    }

    let { gmaster_id, name } = bodydata;
    name = typeof name === "string" ? name.trim() : "";

    let hostelId = null;

    // ? Add prefix for department based on user's hostel
    if (gmaster_id == DEPT_GMASTER_ID) {
      const [[userHostel]] = await db.query(
        `SELECT hostel_id FROM userhostelmap WHERE users_id = ?`,
        { replacements: [userId] }
      );

      if (userHostel?.hostel_id) {
        hostelId = userHostel.hostel_id;

        const [[hostel]] = await db.query(
          `SELECT name FROM hostel WHERE id = ?`,
          { replacements: [hostelId] }
        );

        if (hostel?.name) {
          name = `${hostel.name} - ${name}`;
        }
      }
    }

    const trimmedName = capitalizeFirstLetter(name);

    /* ================= DUPLICATE CHECK ================= */
    if (originaltable === "gmastervalue" && trimmedName && gmaster_id) {
      const [[duplicateCheck]] = await db.query(
        `
        SELECT COUNT(*) AS count
        FROM gmastervalue
        WHERE gmaster_id = ?
          AND name = ?
          AND id != ?
        `,
        { replacements: [gmaster_id, trimmedName, id] }
      );

      if (duplicateCheck.count > 0) {
        return res.status(409).json({
          status: false,
          error: "DUPLICATE_RECORD",
          message: `The value '${trimmedName}' already exists.`,
        });
      }
    }

    /* ================= FORMAT VALUES ================= */
    const formattedValues = values.map((val, idx) => {
      const colName = placeholders[idx].split("=")[0].trim();
      if (colName === "name" && typeof val === "string") {
        return trimmedName;
      }
      return val;
    });

    // ? Optionally update hostel_id if department
    if (
      gmaster_id == DEPT_GMASTER_ID &&
      hostelId !== null &&
      !placeholders.includes("hostel_id = ?")
    ) {
      placeholders.push("hostel_id = ?");
      formattedValues.push(hostelId);
    }

    /* ================= DB UPDATE ================= */
    await db.query("START TRANSACTION");

    if (placeholders?.length) {
      await db.query(
        `
        UPDATE ${originaltable}
        SET ${placeholders.join(", ")}
        WHERE ${primaryKey} = ?
        `,
        { replacements: [...formattedValues, id] }
      );
    }

    await db.query("COMMIT");

    /* ================= WDMS SYNC (DEPARTMENT ONLY) ================= */
    if (gmaster_id == DEPT_GMASTER_ID) {
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
        }
      } catch (err) {
        const message =
          err.response?.data?.message ||
          err.response?.data?.error ||
          err.message ||
          "WDMS department sync failed";

        // ? RETURN error to frontend (do NOT just warn)
        return res.status(500).json({
          status: false,
          error: "WDMS_SYNC_FAILED",
          message,
        });
      }
    }

    /* ================= RESPONSE ================= */
    return res.status(200).json({
      status: true,
      message: "Record updated successfully",
      data: { id },
    });
  } catch (error) {
    try {
      await db.query("ROLLBACK");
    } catch {}

    return res.status(500).json({
      status: false,
      message: error.message || "Internal server error",
    });
  }
};

export const handleDelete = async (req, res) => {
  try {
    /* ---------- NORMALIZE PARAMS ---------- */
    const table = String(req.params.table || "")
      .trim()
      .toLowerCase();
    const idParam = req.params.id;
    const userId = req.user?.userId;

    const EASYTIME_URL = await getEASYTIMEURL(userId);

    const ids = idParam
      .split(",")
      .map((x) => Number(x.trim()))
      .filter((x) => Number.isInteger(x));

    if (ids.length === 0) {
      return res.status(400).json({
        status: false,
        error: "INVALID_IDS",
        message: "No valid IDs provided for deletion",
      });
    }

    /* ======================================================
       ================= STUDENT DELETE =====================
       ====================================================== */
    if (table === "student") {
      const placeholders = ids.map(() => "?").join(",");

      await db.query("START TRANSACTION");

      try {
        const [wdmsData] = await db.query(
          `SELECT memberid AS wdms_key 
           FROM student 
           WHERE id IN (${placeholders})`,
          { replacements: ids }
        );

        await db.query(
          `DELETE FROM studentgmastermap 
           WHERE student_id IN (${placeholders})`,
          { replacements: ids }
        );

        await db.query(
          `DELETE FROM student 
           WHERE id IN (${placeholders})`,
          { replacements: ids }
        );

        await db.query(
          `DELETE FROM wdms_mapping 
           WHERE local_type = ? 
           AND local_id IN (${placeholders})`,
          { replacements: ["employee", ...ids] }
        );

        await db.query("COMMIT");

        if (wdmsData.length > 0) {
          try {
            const token = await getEasyTimeToken(userId);
            for (const row of wdmsData) {
              try {
                await axios.delete(
                  `${EASYTIME_URL}/personnel/api/employees/${row.wdms_key}/`,
                  { headers: { Authorization: `Token ${token}` } }
                );
              } catch (err) {
                console.warn(`? WDMS delete failed`, err.message);
              }
            }
          } catch {}
        }

        return res.status(200).json({
          status: true,
          issuccess: true,
          message: "Record deleted successfully",
          data: { deleted_ids: ids },
        });
      } catch (error) {
        await db.query("ROLLBACK");

        if (error?.code === "ER_ROW_IS_REFERENCED_2" || error?.errno === 1451) {
          return res.status(409).json({
            status: false,
            error: "DEPENDENCY_EXISTS",
            message: "Student is already assigned and cannot be deleted",
          });
        }

        throw error;
      }
    }

    /* ======================================================
       ========== DEPARTMENT DELETE (WDMS + LOCAL) ==========
       ====================================================== */
    if (table === "department" || table === "departments") {
      const placeholders = ids.map(() => "?").join(",");

      try {
        /* ---- 1?? DELETE FROM WDMS ---- */
        const token = await getEasyTimeToken(userId);

        for (const deptId of ids) {
          try {
            await axios.delete(
              `${EASYTIME_URL}/personnel/api/departments/${deptId}/`,
              { headers: { Authorization: `Token ${token}` } }
            );
          } catch (err) {
            console.warn(
              `? WDMS delete failed for department ${deptId}`,
              err.response?.data || err.message
            );
          }
        }

        /* ---- 2?? DELETE FROM LOCAL DB ---- */
        try {
          await db.query(
            `DELETE FROM gmastervalue 
             WHERE gmaster_id = (
               SELECT id FROM gmaster WHERE LOWER(name) = 'department'
             )
             AND id IN (${placeholders})`,
            { replacements: ids }
          );
        } catch (error) {
          if (
            error?.code === "ER_ROW_IS_REFERENCED_2" ||
            error?.errno === 1451 ||
            error?.message?.includes("studentgmastermap")
          ) {
            return res.status(409).json({
              status: false,
              error: "VALUE_IN_USE",
              message:
                "This department is already assigned to students and cannot be deleted",
            });
          }

          throw error;
        }

        return res.status(200).json({
          status: true,
          issuccess: true,
          message: "Record deleted successfully",
          data: { deleted_ids: ids },
        });
      } catch (error) {
        return res.status(500).json({
          status: false,
          error: "DEPARTMENT_DELETE_FAILED",
          message: "Failed to delete department",
        });
      }
    }

    /* ======================================================
       ========== PERMISSIONS DELETE ========================
       ====================================================== */
    if (table === "permissions") {
      const placeholders = ids.map(() => "?").join(",");

      try {
        await db.query(
          `DELETE FROM permissions WHERE id IN (${placeholders})`,
          { replacements: ids }
        );

        return res.status(200).json({
          status: true,
          issuccess: true,
          message: "Record deleted successfully",
          data: { deleted_ids: ids },
        });
      } catch (error) {
        if (error?.code === "ER_ROW_IS_REFERENCED_2" || error?.errno === 1451) {
          return res.status(409).json({
            status: false,
            error: "VALUE_IN_USE",
            message:
              "This permission is already assigned and cannot be deleted",
          });
        }

        throw error;
      }
    }

    /* ======================================================
       ========= OTHER GMASTER VALUES DELETE ================
       ====================================================== */
    const [gmasterRow] = await db.query(
      `SELECT id FROM gmaster WHERE LOWER(name) = ?`,
      { replacements: [table] }
    );

    if (gmasterRow.length > 0) {
      const gmasterId = gmasterRow[0].id;
      const placeholders = ids.map(() => "?").join(",");

      try {
        await db.query(
          `DELETE FROM gmastervalue 
           WHERE gmaster_id = ? 
           AND id IN (${placeholders})`,
          { replacements: [gmasterId, ...ids] }
        );

        return res.status(200).json({
          status: true,
          issuccess: true,
          message: `Record deleted successfully`,
          data: { deleted_ids: ids },
        });
      } catch (error) {
        if (error?.code === "ER_ROW_IS_REFERENCED_2" || error?.errno === 1451) {
          return res.status(409).json({
            status: false,
            error: "VALUE_IN_USE",
            message: `This ${table} value is already assigned to students and cannot be deleted`,
          });
        }

        throw error;
      }
    }

    /* ---------------- INVALID TABLE ---------------- */
    return res.status(400).json({
      status: false,
      error: "INVALID_TABLE",
      message: `Invalid table: ${table}`,
    });
  } catch (error) {
    console.error("? Delete error:", error);

    return res.status(500).json({
      status: false,
      error: "INTERNAL_SERVER_ERROR",
      message: `This value is already assigned to students and cannot be deleted`,
    });
  }
};
