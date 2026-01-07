import { master_configuration } from "../config/master_config.js";
import { db } from "../config/Database.js";
import { getCurrentISTDate } from "../Utils/Datetime.js";

const MASTER_CONFIG = master_configuration();

// export const PrecheckMiddleware = async (req, res, next) => {
//   try {
//     console.log("Pre_check_middleware_triggered");

//     const QueryDate = await getCurrentISTDate();

//     let table = req.params?.table;
//     let bodydata = req.body?.data || req.body;
//     const id = req.params.id;
//     const userId = req.user.userId;

//     console.log("bodyPrecheck", bodydata);
//     console.log("Requested Table:", table);

//     if (!bodydata)
//       return res.status(400).json({
//         status: false,
//         message: "No data provided",
//       });

//     // ------------------------------------------------------------------
//     // 🔍 1. Resolve master configs or fallback to gmaster
//     // ------------------------------------------------------------------
//     if (!MASTER_CONFIG[table]) {
//       const [[gmaster]] = await db.query(
//         `SELECT id FROM gmaster WHERE name = ?`,
//         { replacements: [table] }
//       );

//       if (gmaster?.id) {
//         bodydata.gmaster_id = gmaster.id;
//         table = "gmastervalue";
//       } else {
//         return res
//           .status(400)
//           .json({ status: false, message: `Invalid table '${table}'` });
//       }
//     }

//     const config = MASTER_CONFIG[table];
//     const configFields = config.fields;
//     const primaryKey = config.primaryKey || "id";

//     console.log("Resolved Table:", table);

//     // ------------------------------------------------------------------
//     // 🔍 2. Required field validation
//     // ------------------------------------------------------------------
//     for (const field of configFields) {
//       const value = bodydata[field.name];

//       // CREATE → Required
//       if (!id && field.required && (value === "" || value == null)) {
//         return res.status(400).json({
//           status: false,
//           message: `${field.name} is required.`,
//         });
//       }

//       // UPDATE → Cannot edit fields
//       if (id && field.edit === 0 && value !== undefined) {
//         return res.status(400).json({
//           status: false,
//           message: `${field.name} cannot be edited.`,
//         });
//       }

//       // Custom validator
//       if (field.validate && value != null) {
//         const validationError = field.validate(value);
//         if (validationError)
//           return res.status(400).json({
//             status: false,
//             message: validationError,
//           });
//       }
//     }

//     // ------------------------------------------------------------------
//     // 🔍 3. Unique field validation
//     // ------------------------------------------------------------------
//     const uniqueFields = configFields.filter(
//       (f) => f.unique && bodydata[f.name]
//     );

//     for (const field of uniqueFields) {
//       const columnName = field.name;
//       const valueToCheck = String(bodydata[columnName]).trim();

//       const [[existing]] = await db.query(
//         `
//         SELECT COUNT(*) AS count
//         FROM ${config.table}
//         WHERE ${columnName} = ?
//         ${id ? `AND ${primaryKey} != ?` : ""}
//         `,
//         id ? [valueToCheck, id] : [valueToCheck]
//       );

//       if (existing.count > 0) {
//         return res.status(409).json({
//           status: false,
//           message: `${columnName} '${valueToCheck}' already exists.`,
//         });
//       }
//     }

//     // ------------------------------------------------------------------
//     // 🔄 4. Transform data if needed
//     // ------------------------------------------------------------------
//     let insertData = { ...bodydata };
//     if (config.transform) {
//       insertData = await config.transform(insertData);
//     }

//     // ------------------------------------------------------------------
//     // 🏗 5. Prepare INSERT or UPDATE query
//     // ------------------------------------------------------------------
//     let placeholders, values, columns;

//     if (id) {
//       // UPDATE
//       const updatableFields = configFields.filter(
//         (f) => f.name !== primaryKey && insertData[f.name] !== undefined
//       );

//       placeholders = updatableFields.map((f) => `${f.name} = ?`);
//       values = updatableFields.map((f) => insertData[f.name]);
//     } else {
//       // INSERT
//       columns = configFields
//         .filter((f) => insertData[f.name] !== undefined)
//         .map((f) => f.name);

//       placeholders = columns.map(() => "?").join(", ");
//       values = columns.map((col) => insertData[col]);
//     }

//     // ------------------------------------------------------------------
//     // 📦 6. Attach to req
//     // ------------------------------------------------------------------
//     req.precheck = {
//       table,
//       columns,
//       placeholders,
//       values,
//       primaryKey,
//       originaltable: table,
//     };

//     next();
//   } catch (err) {
//     console.error("Precheck Error:", err);
//     res.status(500).json({
//       status: false,
//       message: err.message,
//     });
//   }
// };

export const PrecheckMiddleware = async (req, res, next) => {
  try {
    let table = req.params?.table;
    let bodydata = req.body?.data || req.body;
    const id = req.params.id;

    if (!bodydata)
      return res.status(400).json({
        status: false,
        message: "No data provided",
      });

    // ------------------------------------------------------------------
    // 🔍 1. Resolve master configs OR fallback to gmaster
    // ------------------------------------------------------------------
    if (!MASTER_CONFIG[table]) {
      const [rows] = await db.query(
        `SELECT id FROM gmaster WHERE name = ?`,
        { replacements: [table] } // ✅ FIXED
      );

      const gmaster = rows[0];

      if (gmaster?.id) {
        bodydata.gmaster_id = gmaster.id;
        table = "gmastervalue";
      } else {
        return res.status(400).json({
          status: false,
          message: `Invalid table '${table}'`,
        });
      }
    }

    const config = MASTER_CONFIG[table];
    const configFields = config.fields;
    const primaryKey = config.primaryKey || "id";

    console.log("Resolved Table:", table);

    // ------------------------------------------------------------------
    // 🔍 2. Required Fields + No-Edit Fields + Custom Validators
    // ------------------------------------------------------------------
    for (const field of configFields) {
      const value = bodydata[field.name];

      // CREATE → required fields
      if (!id && field.required && (value === "" || value == null)) {
        return res.status(400).json({
          status: false,
          message: `${field.name} is required.`,
        });
      }

      // UPDATE → fields not allowed to edit
      if (id && field.edit === 0 && value !== undefined) {
        return res.status(400).json({
          status: false,
          message: `${field.name} cannot be edited.`,
        });
      }

      // Custom validator
      if (field.validate && value != null) {
        const validationError = field.validate(value);
        if (validationError) {
          return res.status(400).json({
            status: false,
            message: validationError,
          });
        }
      }
    }

    // ------------------------------------------------------------------
    // 🔍 3. UNIQUE FIELD VALIDATION
    // ------------------------------------------------------------------
    const uniqueFields = configFields.filter(
      (f) => f.unique && bodydata[f.name]
    );

    for (const field of uniqueFields) {
      const columnName = field.name;
      const valueToCheck = String(bodydata[columnName]).trim();

      let sql = `SELECT COUNT(*) AS count FROM ${config.table} WHERE ${columnName} = ?`;
      let params = [valueToCheck];

      if (id) {
        sql += ` AND ${primaryKey} != ?`;
        params.push(id);
      }

      const [rows] = await db.query(sql, { replacements: params });
      const count = rows[0]?.count || 0;

      if (count > 0) {
        // If the duplicate field is hostel_id, customize message
        let fieldMessage = columnName;
        if (columnName === "hostel_id") {
          fieldMessage = "hostel";
        }

        return res.status(409).json({
          status: false,
          message: `${fieldMessage} already exists.`,
        });
      }
    }

    // ------------------------------------------------------------------
    // 🔄 4. Transform data if needed
    // ------------------------------------------------------------------
    let insertData = { ...bodydata };
    if (config.transform) {
      insertData = await config.transform(insertData);
    }

    // ------------------------------------------------------------------
    // 🏗 5. Build INSERT / UPDATE Query Variables
    // ------------------------------------------------------------------
    let placeholders, values, columns;

    if (id) {
      // UPDATE — include only fields with values
      const updatableFields = configFields.filter(
        (f) => f.name !== primaryKey && insertData[f.name] !== undefined
      );

      placeholders = updatableFields.map((f) => `${f.name} = ?`);
      values = updatableFields.map((f) => insertData[f.name]);
    } else {
      // INSERT — include only fields present in request
      columns = configFields
        .filter((f) => insertData[f.name] !== undefined)
        .map((f) => f.name);

      placeholders = columns.map(() => "?").join(", ");
      values = columns.map((col) => insertData[col]);
    }

    // ------------------------------------------------------------------
    // 📦 6. Attach to req for next controller
    // ------------------------------------------------------------------
    req.precheck = {
      table: config.table,
      columns,
      placeholders,
      values,
      primaryKey,
      originaltable: table,
    };

    next();
  } catch (err) {
    console.error("Precheck Error:", err);
    res.status(500).json({
      status: false,
      message: err.message,
    });
  }
};

export const GetCheckMiddleware = async (req, res, next) => {
  try {
    let table = req.params.table;

    console.log("table", table);

    if (!MASTER_CONFIG[table] && table !== "gmastervalue") {
      const [[gmasterRow]] = await db.query(
        `SELECT id FROM gmaster WHERE name = ?`,
        { replacements: [table] }
      );

      if (gmasterRow && gmasterRow.id) {
        req.query.gmaster_id = gmasterRow.id;
        table = "gmastervalue";
      } else {
        return res
          .status(400)
          .json({ status: false, message: "Invalid table name" });
      }
    }
    if (parseInt(req.query.page) === 0) {
      return res.status(200).json({
        status: true,
        issuccess: true,
        count: 0,
        data: {},
      });
    }

    const tableName = MASTER_CONFIG[table].table;
    const primaryKeyField = MASTER_CONFIG[table].primaryKey || "id";
    const defaultSortField = primaryKeyField;
    const sortField = req.query.sortField || defaultSortField;
    const sortOrder =
      req.query.sortOrder && req.query.sortOrder.toLowerCase() === "desc"
        ? "DESC"
        : "ASC";
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

    console.log(
      `Pagination parameters: usePagination=${usePagination}, page=${page}, pageSize=${pageSize}, offset=${offset}`
    );
    console.log(`Raw query parameters:`, req.query);

    req.getcheck = {
      tableName,
      primaryKeyField,
      defaultSortField,
      sortField,
      sortOrder,
      usePagination,
      page,
      pageSize,
      offset,
    };
    next();
  } catch (err) {
    console.error("Precheck message:", err);
    res.status(500).json({ status: false, message: err.message });
  }
};
