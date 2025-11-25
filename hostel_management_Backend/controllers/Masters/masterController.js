import { db, performQuery } from "../../config/Database.js";
import {
  formatDateTimeToYYYYMMDDHHMMSS,
  formatDateToYYYYMMDD,
  getCurrentISTTime,
  getCurrentISTDate,
  capitalizeFirstLetter,
} from "../../Utils/Datetime.js";
import { master_configuration } from "../../config/master_config.js";
import { handleSequelizeError } from "../../config/validationCheck.js";

const MASTER_CONFIG = master_configuration();

export const handleAdd = async (req, res) => {
  const QueryTime = await getCurrentISTTime();
  console.log("Current IST Time:", QueryTime);

  try {
    console.log("handle_ADD_TRY", QueryTime);
    let bodydata = req.body.data || req.body;

    const { originaltable, columns, placeholders, values, error, statusCode } =
      req.precheck;
    console.log("resultError", error);
    console.log("originaltablemasters", originaltable);

    if (error) {
      return res
        .status(statusCode || 400)
        .json({ status: false, message: error });
    }

    const { gmaster_id, name } = bodydata;
    const trimmedName = typeof name === "string" ? name.trim() : "";

    if (trimmedName && gmaster_id) {
      const [[duplicateCheck]] = await db.query(
        `SELECT COUNT(*) as count FROM gmastervalue WHERE gmaster_id = ? AND name = ?`,
        { replacements: [gmaster_id, trimmedName] }
      );
      console.log("duplicateCheck", duplicateCheck);

      if (duplicateCheck.count > 0) {
        console.log("Duplicate found from Precheck");
        return res.status(409).json({
          status: false,
          message: `The value '${trimmedName}' already exists under this master.`,
        });
      }
    }

    await db.query("START TRANSACTION");

    const trimmedValues = values.map((val, idx) => {
      if (columns[idx] === "name" && typeof val === "string") {
        // return val.trim();
        return capitalizeFirstLetter(val);
      }
      return val;
    });

    await db.query(
      `INSERT INTO ${originaltable} (${columns.join(
        ", "
      )}) VALUES (${placeholders})`,
      { replacements: trimmedValues }
    );
    await db.query("COMMIT");
    res
      .status(200)
      .json({ status: true, message: `Record added successfully.` });
  } catch (error) {
    try {
      await db.query("ROLLBACK");
    } catch {
      console.log("rollback fails");
    }

    console.error("Error in handleAdd:", error);
    console.log("handle_ADD_Catch", QueryTime);
    const errorFetch = handleSequelizeError(error);
    const status_code = errorFetch?.statusCode || 500;
    const error_message = errorFetch?.message;
    const error_status = errorFetch?.status;

    res.status(status_code).json({
      status: error_status,
      message: error_message,
    });
  }
};

export const handleGet = async (req, res) => {
  const QueryTime = await getCurrentISTTime();
  console.log("Current IST Time:", QueryTime);
  console.log("handled_get_initiated", QueryTime);

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

    // ✅ Get role name from roles table
    const [roleResult] = await db.query("SELECT name FROM roles WHERE id = ?", {
      replacements: [roleId],
    });

    const roleName = roleResult?.[0]?.name?.toLowerCase() || "";
    const isSuperAdmin =
      roleName === "superadmin" || roleName === "super admin";

    if (parseInt(req.query.page) === 0) {
      return res.status(200).json({
        status: true,
        issuccess: true,
        count: 0,
        data: {},
      });
    }

    // ✅ Pagination
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

    // ✅ Base filter for gmastervalue
    if (tableName === "gmastervalue" && req.query.gmaster_id) {
      whereConditions.push(`gmaster_id = ?`);
      whereParams.push(req.query.gmaster_id);
    }

    // ✅ Restrict non-superadmins to their mapped locations
    if (tableName === "gmastervalue" && req.query.gmaster_id && !isSuperAdmin) {
      const [gmasterCheck] = await db.query(
        `SELECT name FROM gmaster WHERE id = ?`,
        { replacements: [req.query.gmaster_id] }
      );

      const gmasterName = gmasterCheck?.[0]?.name?.toLowerCase() || "";

      if (["location", "location1", "location2"].includes(gmasterName)) {
        // ✅ Fetch mapped location IDs
        const [userLocations] = await db.query(
          `SELECT gmastervalue_id FROM userlocationmap WHERE users_id = ?`,
          { replacements: [userId] }
        );

        const mappedIds = userLocations.map((row) => row.gmastervalue_id);

        if (mappedIds.length > 0) {
          whereConditions.push(`id IN (${mappedIds.map(() => "?").join(",")})`);
          whereParams.push(...mappedIds);
        } else {
          // No mapped locations → empty response
          return res.status(200).json({
            status: true,
            issuccess: true,
            count: 0,
            data: [],
          });
        }
      }
    }

    // ✅ Apply filters for ID
    if (id) {
      whereConditions.push(`id = ?`);
      whereParams.push(id);
    }

    // ✅ Apply filters for search
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

    const PageClause =
      usePagination === true ? `LIMIT ${pageSize} OFFSET ${offset}` : ``;

    // ✅ Build final query
    let dataQuery = `SELECT * FROM ${tableName}`;
    if (whereConditions.length > 0) {
      dataQuery += ` WHERE ${whereConditions.join(" AND ")}`;
    }
    dataQuery += ` ORDER BY name ASC ${PageClause}`;

    const [CommonList] = await db.query(dataQuery, {
      replacements: whereParams,
    });

    // ✅ Count for pagination
    const [[{ total }]] = await db.query(
      `SELECT COUNT(*) as total FROM ${tableName} ${
        whereConditions.length > 0
          ? "WHERE " + whereConditions.join(" AND ")
          : ""
      }`,
      { replacements: whereParams }
    );

    // ✅ Final response
    if (!CommonList || CommonList.length === 0) {
      return res.status(200).json({
        status: true,
        issuccess: true,
        count: 0,
        data: [],
      });
    }

    return res.status(200).json({
      status: true,
      issuccess: true,
      count: total,
      data: id ? CommonList[0] : CommonList,
    });
  } catch (error) {
    console.error("❌ Error in handleGet:", error);
    res.status(500).json({
      status: false,
      issuccess: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

// export const handleGet = async (req, res) => {
//   const QueryTime = await getCurrentISTTime();
//   console.log("Current IST Time:", QueryTime);
//   console.log("handled_get_initiated", QueryTime);

//   try {
//     let table = req.params.table;
//     const id = req.query.id;
//     const searchTerm = req.query.search || "";
//     const { tableName } = req.getcheck;

//     if (parseInt(req.query.page) === 0) {
//       return res.status(200).json({
//         status: true,
//         issuccess: true,
//         count: 0,
//         data: {},
//       });
//     }

//     // const tableName_1 = tableName;
//     // const primaryKeyField = MASTER_CONFIG[table].primaryKey || 'id';
//     // const defaultSortField = primaryKeyField;
//     // const sortField = req.query.sortField || defaultSortField;
//     // const sortOrder = req.query.sortOrder && req.query.sortOrder.toLowerCase() === 'desc' ? 'DESC' : 'ASC';
//     const usePagination =
//       req.query.page !== undefined ||
//       req.query.pageSize !== undefined ||
//       req.query.pagesize !== undefined;
//     const page = parseInt(req.query.page) || 1;
//     const pageSize = parseInt(
//       req.query.pageSize || req.query.pagesize || "10",
//       10
//     );
//     const offset = (page - 1) * pageSize;

//     console.log(
//       `Pagination parameters: usePagination=${usePagination}, page=${page}, pageSize=${pageSize}, offset=${offset}`
//     );
//     console.log(`Raw query parameters:`, req.query);

//     let whereConditions = [];
//     let whereParams = [];

//     if (tableName === "gmastervalue" && req.query.gmaster_id) {
//       whereConditions.push(`gmaster_id = ?`);
//       whereParams.push(req.query.gmaster_id);
//     }

//     const PageClause =
//       usePagination == true ? `LIMIT ${pageSize} OFFSET ${offset} ` : ``;
//     console.log("PageClause", PageClause);

//     if (id) {
//       whereConditions.push(`id = ?`);
//       whereParams.push(id);
//     }
//     if (searchTerm) {
//       if (
//         table === "gmastervalue" ||
//         [
//           "location",
//           "location1",
//           "location2",
//           "brand",
//           "tagtype",
//           "status",
//           "vendors",
//         ].includes(req.params.table)
//       ) {
//         whereConditions.push(`name LIKE ?`);
//         whereParams.push(`%${searchTerm}%`);
//       } else {
//         const searchableFields = MASTER_CONFIG[table]?.fields
//           .filter((field) => field.type === "string")
//           .map((field) => field.name);

//         if (searchableFields?.length > 0) {
//           const searchParts = searchableFields.map(
//             (field) => `${field} LIKE ?`
//           );
//           whereConditions.push(`(${searchParts.join(" OR ")})`);
//           whereParams.push(...searchableFields.map(() => `%${searchTerm}%`));
//         }
//       }
//     }

//     let dataQuery = `
//       SELECT * FROM ${tableName}`;
//     if (whereConditions.length > 0) {
//       dataQuery += ` WHERE ${whereConditions.join(" AND ")}`;
//     }
//     dataQuery += ` ORDER BY name ASC `;
//     dataQuery += ` ${PageClause}`;

//     const [CommonList] = await db.query(dataQuery, {
//       replacements: whereParams,
//     });
//     console.log("CommonListrr", CommonList);

//     const [[{ total }]] = await db.query(
//       `SELECT COUNT(*) as total FROM ${tableName} ${
//         whereConditions.length > 0
//           ? "WHERE " + whereConditions.join(" AND ")
//           : ""
//       }`,
//       { replacements: whereParams }
//     );

//     if (!CommonList || CommonList.length === 0) {
//       return res.status(200).json({
//         status: true,
//         issuccess: true,
//         count: 0,
//         data: [],
//       });
//     }
//     return res.status(200).json({
//       status: true,
//       issuccess: true,
//       count: total,
//       data: id ? CommonList[0] : CommonList,
//     });
//   } catch (error) {
//     console.error("Error in handleGet:", error);
//     res.status(500).json({
//       status: false,
//       issuccess: false,
//       message: "Internal server error",
//       error: error.message,
//     });
//   }
// };
export const handleUpdate = async (req, res) => {
  const QueryTime = await getCurrentISTTime();
  console.log("Current IST Time:", QueryTime);

  console.log("handled_updated_initiated", QueryTime);

  try {
    console.log("handled_updated_initiated1111", QueryTime);

    const bodydata = req.body.data || req.body;

    console.log(" Update body received:", req.body);
    console.log(" Parsed update data:", bodydata);
    const id = req.params.id;

    const {
      originaltable,
      placeholders,
      values,
      error,
      statusCode,
      primaryKey,
    } = req.precheck;
    console.log("resultError", error);
    console.log("originaltableupdate", originaltable);

    if (error) {
      return res
        .status(statusCode || 400)
        .json({ status: false, message: error });
    }

    const { gmaster_id, name } = bodydata;
    const trimmedName = typeof name === "string" ? name.trim() : "";

    if (trimmedName && gmaster_id) {
      const [[duplicateCheck]] = await db.query(
        `SELECT COUNT(*) as count FROM gmastervalue WHERE gmaster_id = ? AND name = ? AND id != ? `,
        { replacements: [gmaster_id, trimmedName, id] }
      );
      console.log("duplicateCheck", duplicateCheck);

      if (duplicateCheck.count > 0) {
        console.log("Duplicate found from Precheck");
        return res.status(409).json({
          status: false,
          message: `The value '${trimmedName}' already exists under this master.`,
        });
      }
    }

    const trimmedValues = values.map((val, idx) => {
      const colName = placeholders[idx].split("=")[0].trim();
      if (colName === "name" && typeof val === "string") {
        // return val.trim();
        return capitalizeFirstLetter(val);
      }
      return val;
    });

    await db.query("START TRANSACTION");
    if (placeholders?.length != 0) {
      await db.query(
        `UPDATE ${originaltable} SET ${placeholders.join(
          ", "
        )} WHERE ${primaryKey} = ?`,
        { replacements: [...trimmedValues, id] }
      );
    }
    await db.query("COMMIT");

    res.status(200).json({
      issuccess: true,
      status: true,
      message: `Record updated successfully.`,
    });
  } catch (error) {
    try {
      await db.query("ROLLBACK");
    } catch {
      console.log("rollback fails");
    }
    console.error(error);
    console.log("handled_updated_failed", QueryTime);

    const errorFetch = handleSequelizeError(error);
    const status_code = errorFetch?.statusCode || 500;
    const error_message = errorFetch?.message;
    const error_status = errorFetch?.status;

    res.status(status_code).json({
      status: error_status,
      message: error_message,
    });
  }
};
export const handleDelete = async (req, res) => {
  const QueryTime = await getCurrentISTTime();
  console.log("Current IST Time:", QueryTime);

  try {
    console.log("handle_delete_initiated", QueryTime);

    let table = req.params.table || "master";

    const idParam = req.params.id;
    let ids = [];

    if (idParam && idParam.includes(",")) {
      ids = idParam.split(",").map((id) => id.trim());
      console.log(`>>>> Parsed multiple IDs for deletion: ${ids.join(", ")}`);
    } else if (idParam) {
      ids = [idParam];
    }

    if (!MASTER_CONFIG[table] && table !== "gmastervalue") {
      const [[gmasterRow]] = await db.query(
        `SELECT id FROM gmaster WHERE name = ?`,
        { replacements: [table] }
      );

      if (gmasterRow && gmasterRow.id) {
        table = "gmastervalue";

        if (ids.length > 1) {
          const [valueRecords] = await db.query(
            `SELECT id FROM gmastervalue WHERE id IN (?) AND gmaster_id = ?`,
            { replacements: [ids, gmasterRow.id] }
          );

          if (valueRecords.length !== ids.length) {
            return res.status(404).json({
              status: false,
              message: `One or more ${req.params.table} records not found or don't belong to this category`,
            });
          }
        } else {
          const [[valueRecord]] = await db.query(
            `SELECT * FROM gmastervalue WHERE id = ? AND gmaster_id = ?`,
            { replacements: [ids[0], gmasterRow.id] }
          );

          if (!valueRecord) {
            return res.status(404).json({
              status: false,
              message: `No ${req.params.table} record with ID ${ids[0]} found`,
            });
          }
        }
      } else {
        return res
          .status(400)
          .json({ status: false, message: "Invalid table name" });
      }
    }

    const tableName = MASTER_CONFIG[table].table;

    const primaryKeyField = MASTER_CONFIG[table].primaryKey || "id";

    const placeholders = ids.map(() => "?").join(",");
    const selectQuery = `SELECT ${primaryKeyField} FROM ${tableName} WHERE ${primaryKeyField} IN (${placeholders})`;

    const [checkResults] = await db.query(selectQuery, {
      replacements: ids,
    });

    if (!checkResults || checkResults.length !== ids.length) {
      const foundIds = checkResults.map((record) => record[primaryKeyField]);
      const missingIds = ids.filter((id) => !foundIds.includes(id));

      return res.status(404).json({
        status: false,
        issuccess: false,
        message: `Some records not found in ${tableName}: ${missingIds.join(
          ", "
        )}`,
      });
    }

    const deleteQuery = `DELETE FROM ${tableName} WHERE ${primaryKeyField} IN (${placeholders})`;
    console.log("Executing delete query:", deleteQuery);

    const [result] = await db.query(deleteQuery, {
      replacements: ids,
    });

    console.log("Delete result:", result);

    if (!result || result.affectedRows === 0) {
      return res.status(500).json({
        status: false,
        issuccess: false,
        message: "Delete operation failed",
      });
    }

    res.status(200).json({
      status: true,
      issuccess: true,
      deletedId: ids.join(","),
      message: `Records deleted successfully.`,
    });
  } catch (error) {
    console.log("handle_delete_failed", QueryTime);
    console.error("Delete operation error:", error);
    console.error("Error stack:", error.stack);

    const errorFetch = handleSequelizeError(error);
    const status_code = errorFetch?.statusCode || 500;
    const error_message = errorFetch?.message;
    const error_status = errorFetch?.status;

    res.status(status_code).json({
      status: error_status,
      issuccess: false,
      message: error_message,
    });
  }
};
