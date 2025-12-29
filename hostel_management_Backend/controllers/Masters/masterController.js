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

    // ✅ Add prefix for department based on user's hostel
    if (gmaster_id == DEPT_GMASTER_ID) {
      // Get user's hostel_id from userhostelmap
      const [[userHostel]] = await db.query(
        `SELECT hostel_id FROM userhostelmap WHERE users_id = ?`,
        { replacements: [userId] }
      );

      if (userHostel?.hostel_id) {
        hostelId = userHostel.hostel_id;

        // Get hostel name
        const [[hostel]] = await db.query(
          `SELECT name FROM hostel WHERE id = ?`,
          { replacements: [hostelId] }
        );

        if (hostel?.name) {
          name = `${hostel.name} - ${name}`; // prepend hostel name
        }
      }
    }

    const trimmedName = capitalizeFirstLetter(name);

    await db.query("START TRANSACTION");

    // DUPLICATE CHECK (only for gmastervalue table)
    if (originaltable !== "permissions") {
      const [[dup]] = await db.query(
        `SELECT COUNT(*) AS count FROM gmastervalue WHERE gmaster_id = ? AND name = ?`,
        { replacements: [gmaster_id, trimmedName] }
      );
      if (dup.count > 0)
        throw new Error(`The value '${trimmedName}' already exists`);
    }

    // PERMISSIONS TABLE
    let finalColumns = [];
    let finalValues = [];

    if (originaltable === "permissions") {
      finalColumns = ["name", "permission_id", "modifiedby", "status"];
      finalValues = [
        trimmedName || null,
        bodydata.permission_id ?? null,
        userId ?? null,
        1,
      ];
    } else {
      // For other tables, use precheck columns/values
      finalColumns = [...req.precheck.columns];

      // ✅ Add hostel_id column for department
      if (
        gmaster_id == DEPT_GMASTER_ID &&
        !finalColumns.includes("hostel_id")
      ) {
        finalColumns.push("hostel_id");
      }

      finalValues = req.precheck.values.map((val, idx) =>
        finalColumns[idx] === "name" ? trimmedName : val
      );

      // ✅ Add hostel_id value if applicable
      if (gmaster_id == DEPT_GMASTER_ID) {
        finalValues.push(hostelId);
      }
    }

    // INSERT
    const placeholders = finalColumns.map(() => "?").join(", ");
    const [result] = await db.query(
      `INSERT INTO ${originaltable} (${finalColumns.join(
        ", "
      )}) VALUES (${placeholders})`,
      { replacements: finalValues }
    );

    await db.query("COMMIT");
    const insertedId = result;

    // WDMS SYNC (Department only)
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
          `INSERT INTO wdms_mapping (local_type, local_id, wdms_id) VALUES (?, ?, ?)`,

          { replacements: ["department", insertedId, wdmsRes.data.id] }
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

    // ✅ Restrict departments to user's hostel only
    if (
      tableName === "gmastervalue" &&
      req.query.gmaster_id == DEPT_GMASTER_ID
    ) {
      // Get user's hostel_id
      const [[userHostel]] = await db.query(
        `SELECT hostel_id FROM userhostelmap WHERE users_id = ?`,
        { replacements: [userId] }
      );

      if (userHostel?.hostel_id) {
        whereConditions.push(`hostel_id = ?`);
        whereParams.push(userHostel.hostel_id);
      }
    }

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

    // ✅ Remove hostel prefix for departments
    const resultData = CommonList.map((item) => {
      if (item.gmaster_id == DEPT_GMASTER_ID && item.name.includes(" - ")) {
        const parts = item.name.split(" - ");
        return {
          ...item,
          name: parts[parts.length - 1].trim(),
        };
      }
      return item;
    });

    return res.status(200).json({
      status: true,
      issuccess: true,
      count: total || 0,
      data: id ? resultData[0] : resultData,
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

    // ✅ Add prefix for department based on user's hostel
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

    // ✅ Optionally update hostel_id if department
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
        console.warn(
          "❌ WDMS Department Sync Failed:",
          err.response?.data || err.message
        );
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
                console.warn(`❌ WDMS delete failed`, err.message);
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
        /* ---- 1️⃣ DELETE FROM WDMS ---- */
        const token = await getEasyTimeToken(userId);

        for (const deptId of ids) {
          try {
            await axios.delete(
              `${EASYTIME_URL}/personnel/api/departments/${deptId}/`,
              { headers: { Authorization: `Token ${token}` } }
            );
          } catch (err) {
            console.warn(
              `❌ WDMS delete failed for department ${deptId}`,
              err.response?.data || err.message
            );
          }
        }

        /* ---- 2️⃣ DELETE FROM LOCAL DB ---- */
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
    console.error("❌ Delete error:", error);

    return res.status(500).json({
      status: false,
      error: "INTERNAL_SERVER_ERROR",
      message: `This value is already assigned to students and cannot be deleted`,
    });
  }
};
