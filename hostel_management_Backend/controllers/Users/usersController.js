import { db, performQuery } from "../../config/Database.js";
import {
  getCurrentISTTime,
  capitalizeFirstLetter,
  trimLetter,
} from "../../Utils/Datetime.js";
import { handleSequelizeError } from "../../config/validationCheck.js";

// async function UserErrorFunc(bodydata, db) {
//   try {

//     if (bodydata?.location != undefined) {
//       const ids = bodydata.location.join(',');
//       const [[CheckLocation]] = await db.query(
//         `SELECT id FROM gmastervalue WHERE id IN (?) AND gmaster_id = 1 `,
//         { replacements: [ids] }
//       );
//       console.log('CheckLocation', CheckLocation);

//       if (!CheckLocation) {
//         return { error: true, status: false, statusCode: 400, message: `Invalid location values` };
//       }
//     }
//     return { error: false };

//   } catch (err) {
//     return { error: true, statusCode: 500, message: 'Validation failed', detail: err.message };
//   }
// };
async function UserErrorFunc(bodydata, db, isSuperAdmin = false) {
  try {
    // ✅ 1. Skip validation if explicitly passed SuperAdmin
    if (isSuperAdmin) {
      console.log("🟢 Skipping validation — SuperAdmin confirmed externally");
      return { error: false, isSuperAdmin: true };
    }

    let roleName = null;

    // ✅ 2. Detect role from DB if role_id is provided
    if (bodydata?.role_id) {
      const [[roleRow]] = await db.query(
        `SELECT name FROM gmastervalue WHERE id = ? AND gmaster_id = 2`,
        { replacements: [bodydata.role_id] }
      );

      roleName = roleRow?.name?.replace(/[\s_]/g, "").toLowerCase();
    }

    const isDetectedSuperAdmin = roleName === "superadmin";

    // ✅ 3. If location field not in request — skip
    if (!("location" in bodydata)) {
      return { error: false, isSuperAdmin: isDetectedSuperAdmin };
    }

    // ✅ 4. If SuperAdmin role → allow empty location
    if (isDetectedSuperAdmin) {
      console.log("🟢 SuperAdmin role detected — empty location allowed");
      return { error: false, isSuperAdmin: true };
    }

    // ✅ 5. For non-superadmin → location required
    if (!Array.isArray(bodydata.location) || bodydata.location.length === 0) {
      return {
        error: true,
        status: false,
        statusCode: 400,
        message: "Location cannot be empty for non-SuperAdmin users.",
      };
    }

    // ✅ 6. Validate provided locations exist
    const ids = bodydata.location.join(",");
    const [CheckLocations] = await db.query(
      `SELECT id FROM gmastervalue WHERE id IN (${ids}) AND gmaster_id = 1`
    );

    if (!CheckLocations || CheckLocations.length === 0) {
      return {
        error: true,
        status: false,
        statusCode: 400,
        message: "Invalid location values.",
      };
    }

    return { error: false, isSuperAdmin: false };
  } catch (err) {
    console.error("❌ UserErrorFunc Error:", err);
    return {
      error: true,
      statusCode: 500,
      message: "Validation failed",
      detail: err.message,
    };
  }
}

// ✅ Add User
export const AddUser = async (req, res) => {
  const QueryTime = await getCurrentISTTime();
  console.log("Current IST Time:", QueryTime);

  try {
    console.log("handle_ADD_TRY", QueryTime);
    let table = req.params.table || "users";
    let bodydata = req.body.data || req.body;

    const { columns, placeholders, values, error, statusCode } = req.precheck;
    console.log("resultError", error);

    if (error) {
      return res
        .status(statusCode || 400)
        .json({ status: false, message: error });
    }

    const roleId = bodydata.role_id;

    // ✅ Fetch role name based on role_id
    const [roleResult] = await db.query("SELECT name FROM roles WHERE id = ?", {
      replacements: [roleId],
      type: db.QueryTypes.SELECT,
    });

    const isSuperAdmin =
      roleResult?.name?.toLowerCase().trim() === "superadmin";

    // ✅ Location validation only for non-SuperAdmins
    if (!isSuperAdmin) {
      if (
        !Array.isArray(bodydata?.location) ||
        bodydata.location.length === 0
      ) {
        return res.status(400).json({
          status: false,
          message: `Location is mandatory for non-SuperAdmin users.`,
        });
      }
    } else {
      // if SuperAdmin, just ensure location is an empty array (not required)
      bodydata.location = [];
    }

    const errorCheck = await UserErrorFunc(bodydata, db, isSuperAdmin);

    console.log("errorCheck", errorCheck);

    if (errorCheck.error) {
      return res.status(errorCheck.statusCode).json({
        status: false,
        message: errorCheck.message,
      });
    }

    await db.query("START TRANSACTION");

    const trimmedValues = values.map((val, idx) => {
      if (columns[idx] === "username" && typeof val === "string") {
        return trimLetter(val);
      }
      return val;
    });

    const UserResult = await db.query(
      `INSERT INTO ${table} (${columns.join(", ")}) VALUES (${placeholders})`,
      { replacements: trimmedValues }
    );

    console.log("MainUsr", UserResult);

    const userId = UserResult[0];

    // ✅ Only map locations if not SuperAdmin
    if (!isSuperAdmin && Array.isArray(bodydata.location)) {
      for (let i = 0; i < bodydata.location.length; i++) {
        await db.query(
          `INSERT INTO userlocationmap (users_id, gmastervalue_id) VALUES (?, ?)`,
          { replacements: [userId, bodydata.location[i]] }
        );
      }
    }

    console.log(`Mapped users ${userId} to locations ${bodydata.location}`);
    console.log("users_add_completed", QueryTime);

    await db.query("COMMIT");
    res
      .status(200)
      .json({ status: true, message: `Users added successfully.` });
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

// ✅ Update User
export const UpdateUser = async (req, res) => {
  const QueryTime = await getCurrentISTTime();
  console.log("Current IST Time:", QueryTime);

  try {
    const table = req.params.table || "users";
    const bodydata = req.body.data || req.body;
    const id = req.params.id;

    const { placeholders, values, error, statusCode } = req.precheck;

    if (error) {
      return res
        .status(statusCode || 400)
        .json({ status: false, message: error });
    }

    // ✅ STEP 1: Get correct role_id (from body or DB)
    let roleId = bodydata.role_id;
    console.log("1️⃣ role_id from body:", roleId);

    if (!roleId) {
      const [existingUser] = await db.query(
        `SELECT role_id FROM ${table} WHERE id = ?`,
        { replacements: [id] }
      );
      roleId = existingUser?.[0]?.role_id;
    }
    console.log("2️⃣ final role_id:", roleId);

    // ✅ STEP 2: Fetch role name properly
    const [roleRows] = await db.query(
      `SELECT id, name FROM gmastervalue WHERE id = ?`,
      { replacements: [roleId] }
    );

    if (!roleRows.length) {
      console.log("⚠️ Role not found in gmastervalue for id:", roleId);
    } else {
      console.log("✅ Role found:", roleRows[0]);
    }

    const roleName = roleRows?.[0]?.name?.trim()?.toLowerCase() || "";
    const isSuperAdmin =
      roleName === "superadmin" ||
      roleName === "super admin" ||
      roleName === "super_admin" ||
      Number(roleId) === 94; // ✅ fallback for SuperAdmin ID

    console.log("🧩 Role detected:", roleName || "(none)");
    console.log("🟢 IsSuperAdmin:", isSuperAdmin);

    // ✅ STEP 3: Validate location only for NON-superadmins
    if (!isSuperAdmin) {
      if ("location" in bodydata) {
        if (
          !Array.isArray(bodydata.location) ||
          bodydata.location.length === 0
        ) {
          return res.status(400).json({
            status: false,
            message: "Location is mandatory for non-SuperAdmin users.",
          });
        }
      }
    } else {
      console.log("🟢 Skipping location validation for SuperAdmin");
      // Force empty array for safety
      bodydata.location = [];
    }

    // ✅ STEP 4: Common user validation (skip strict checks for SuperAdmin)
    const errorCheck = await UserErrorFunc(bodydata, db, isSuperAdmin);
    console.log("errorCheck", errorCheck);

    if (errorCheck.error) {
      return res
        .status(errorCheck.statusCode || 400)
        .json({ status: false, message: errorCheck.message });
    }

    // ✅ STEP 5: Prepare trimmed update values
    const trimmedValues = values.map((val, idx) => {
      const colName = placeholders[idx].split("=")[0].trim();
      if (colName === "username" && typeof val === "string") {
        return val.trim();
      }
      return val;
    });

    await db.query("START TRANSACTION");

    // ✅ STEP 6: Update user record
    if (placeholders.length > 0) {
      await db.query(
        `UPDATE ${table} SET ${placeholders.join(", ")} WHERE id = ?`,
        { replacements: [...trimmedValues, id] }
      );
    }

    // ✅ STEP 7: Handle location mappings
    if (isSuperAdmin) {
      // 🧹 If SuperAdmin — remove all existing location mappings
      console.log("🧹 Removing all location mappings for SuperAdmin user:", id);
      await db.query(`DELETE FROM userlocationmap WHERE users_id = ?`, {
        replacements: [id],
      });
    } else if ("location" in bodydata) {
      // 🗺️ If non-SuperAdmin — update location mapping normally
      await db.query(`DELETE FROM userlocationmap WHERE users_id = ?`, {
        replacements: [id],
      });

      if (Array.isArray(bodydata.location) && bodydata.location.length > 0) {
        for (const locId of bodydata.location) {
          await db.query(
            `INSERT INTO userlocationmap (users_id, gmastervalue_id) VALUES (?, ?)`,
            { replacements: [id, locId] }
          );
        }
      }
    }

    await db.query("COMMIT");

    return res.status(200).json({
      issuccess: true,
      status: true,
      message: "User updated successfully.",
    });
  } catch (error) {
    try {
      await db.query("ROLLBACK");
    } catch {
      console.log("rollback fails");
    }

    console.error("❌ Error in UpdateUser:", error);
    return res.status(500).json({ status: false, message: error.message });
  }
};

export const GetUsers = async (req, res) => {
  const QueryTime = await getCurrentISTTime();
  console.log("Current IST Time:", QueryTime);
  console.log("handled_get_initiated", QueryTime);

  try {
    let table = req.params.table;
    const id = req.query.id;
    const searchTerm = req.query.search || "";

    const {
      tableName,
      primaryKeyField,
      defaultSortField,
      sortField,
      sortOrder,
      usePagination,
      page,
      pageSize,
      offset,
    } = req.getcheck;
    console.log("resultError", req.precheck);

    let whereConditions = [];
    let whereParams = [];

    const PageClause =
      usePagination == true ? `LIMIT ${pageSize} OFFSET ${offset} ` : ``;
    console.log("PageClause", PageClause);

    if (id) {
      whereConditions.push(`${primaryKeyField} = ?`);
      whereParams.push(id);
    }
    if (searchTerm) {
      whereConditions.push(`username LIKE ?`);
      whereParams.push(`%${searchTerm}%`);
    }

    const whereClause =
      whereConditions.length > 0
        ? `WHERE ${whereConditions.join(" AND ")}`
        : "";
    const [[{ total }]] = await db.query(
      `SELECT COUNT(*) as total FROM ${tableName} ${whereClause}`,
      { replacements: whereParams }
    );

    let query = `
        SELECT 
          u.id, 
          u.username, 
          u.role_id, 
          u.password, 
          u.email, 
          u.mobileno, 
          u.status,
          GROUP_CONCAT(DISTINCT gv.id) AS location
        FROM ${tableName} u
        LEFT JOIN userlocationmap ulm ON ulm.users_id = u.id
        LEFT JOIN gmastervalue gv ON ulm.gmastervalue_id = gv.id
        ${whereClause.replace(/id = /g, "u.id = ")}
        GROUP BY u.id
        ${PageClause} `;

    const [results] = await db.query(query, { replacements: whereParams });
    const formattedResults = results.map((user) => ({
      ...user,
      location: user.location ? user.location.split(",").map(Number) : [],
    }));

    return res.status(200).json({
      status: true,
      issuccess: true,
      count: total,
      data: id ? formattedResults[0] : formattedResults,
    });
  } catch (error) {
    console.error("Error in handleGet:", error);
    res.status(500).json({
      status: false,
      issuccess: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};
export const DeleteUser = async (req, res) => {
  const QueryTime = await getCurrentISTTime();
  console.log("Current IST Time:", QueryTime);

  try {
    console.log("handle_delete_initiated", QueryTime);

    const idParam = req.params.id;
    const idArray = idParam
      .split(",")
      .map((id) => parseInt(id.trim(), 10))
      .filter(Number.isInteger);

    if (!Array.isArray(idArray) || idArray.length === 0) {
      return res.status(400).json({
        status: false,
        issuccess: false,
        message: "Invalid 'id' array provided",
        id: req.params.id,
      });
    }

    const placeholders = idArray.map(() => "?").join(", ");

    const [result] = await db.query(
      `DELETE FROM users WHERE id IN (${placeholders})`,
      { replacements: idArray }
    );

    if (!result || result.affectedRows === 0) {
      return res.status(500).json({
        status: false,
        issuccess: false,
        message: "No matching records found.",
      });
    }

    return res.status(200).json({
      status: true,
      issuccess: true,
      message: "Users deleted successfully.",
      deletedCount: result.affectedRows,
    });
  } catch (error) {
    console.log("handle_delete_failed", QueryTime);

    const errorFetch = handleSequelizeError(error);
    const status_code = errorFetch?.statusCode || 500;
    const error_message = errorFetch?.message;
    const error_status = errorFetch?.status;

    res.status(status_code).json({
      status: error_status,
      message: error_message,
    });

    return res.status(status_code).json({
      status: error_status,
      message: error_message,
      issuccess: false,
      id: req.params.id,
    });
  }
};
