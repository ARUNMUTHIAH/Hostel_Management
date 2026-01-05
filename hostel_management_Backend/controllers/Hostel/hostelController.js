import { db } from "../../config/Database.js";
import { getCurrentISTTime, trimLetter } from "../../Utils/Datetime.js";
import { handleSequelizeError } from "../../config/validationCheck.js";
import { getEasyTimeToken } from "../../Utils/easytime.js";
import axios from "axios";
import { getEASYTIMEURL } from "../../Utils/EASYTIME_URL.js";

// -------------------------
// 1️⃣ ADD HOSTEL
// -------------------------
// export const AddHostel = async (req, res) => {
//   const QueryTime = await getCurrentISTTime();

//   try {
//     let table = req.params.table || "hostel";
//     let bodydata = req.body.data || req.body;

//     const { columns, placeholders, values, error, statusCode } = req.precheck;
//     if (error) {
//       return res
//         .status(statusCode || 400)
//         .json({ status: false, message: error });
//     }

//     // Required fields
//     if (!bodydata.name || bodydata.name.trim() === "") {
//       return res
//         .status(400)
//         .json({ status: false, message: "Hostel Name is required." });
//     }
//     if (!bodydata.address || bodydata.address.trim() === "") {
//       return res
//         .status(400)
//         .json({ status: false, message: "Address is required." });
//     }
//     if (!bodydata.warden_name || bodydata.warden_name.trim() === "") {
//       return res
//         .status(400)
//         .json({ status: false, message: "Warden Name is required." });
//     }
//     if (!bodydata.warden_contact || bodydata.warden_contact.trim() === "") {
//       return res
//         .status(400)
//         .json({ status: false, message: "Warden Contact is required." });
//     }
//     if (!bodydata.hostel_type || bodydata.hostel_type.trim() === "") {
//       return res
//         .status(400)
//         .json({ status: false, message: "Hostel Type is required." });
//     }

//     // Duplicate hostel check
//     const duplicateCheck = await db.query(
//       "SELECT id FROM hostel WHERE name = ?",
//       { replacements: [bodydata.name], type: db.QueryTypes.SELECT }
//     );
//     if (duplicateCheck.length > 0) {
//       return res
//         .status(400)
//         .json({ status: false, message: "Hostel Name already exists." });
//     }

//     // Prepare columns and values
//     const allowedFields = [
//       "name",
//       "address",
//       "warden_name",
//       "warden_contact",
//       "hostel_type",
//       "total_rooms",
//       "status",
//     ];

//     const insertColumns = [];
//     const insertPlaceholders = [];
//     const insertValues = [];

//     allowedFields.forEach((field) => {
//       if (bodydata[field] !== undefined && bodydata[field] !== "") {
//         let val = bodydata[field];

//         // Optional numeric field
//         if (field === "total_rooms") {
//           val = parseInt(val, 10);
//           if (isNaN(val) || val < 0) val = null;
//         }

//         // Status default
//         if (field === "status") {
//           if (!["Active", "Inactive"].includes(val)) val = "Active";
//         }

//         // Boolean fields conversion

//         insertColumns.push(field);
//         insertPlaceholders.push("?");
//         insertValues.push(typeof val === "string" ? val.trim() : val);
//       }
//     });
//     // Start transaction
//     await db.query("START TRANSACTION");

//     // Insert hostel
//     const HostelResult = await db.query(
//       `INSERT INTO ${table} (${insertColumns.join(
//         ", "
//       )}) VALUES (${insertPlaceholders.join(", ")})`,
//       { replacements: insertValues }
//     );
//     const hostelId = HostelResult[0];

//     await db.query("COMMIT");

//     return res.status(200).json({
//       status: true,
//       message: "Hostel added successfully.",
//       data: { hostel_id: hostelId },
//     });
//   } catch (error) {
//     try {
//       await db.query("ROLLBACK");
//     } catch {
//       console.log("rollback failed");
//     }
//     console.error("HOSTEL_ADD_ERROR:", error);
//     const errorFetch = handleSequelizeError(error);
//     return res
//       .status(errorFetch?.statusCode || 500)
//       .json({ status: errorFetch?.status, message: errorFetch?.message });
//   }
// };

export const AddHostel = async (req, res) => {
  const QueryTime = await getCurrentISTTime();
  const userId = req.user?.userId;

  try {
    let table = req.params.table || "hostel";
    let bodydata = req.body.data || req.body;

    const { error, statusCode } = req.precheck;
    if (error) {
      return res
        .status(statusCode || 400)
        .json({ status: false, message: error });
    }

    // ------------------------
    // REQUIRED FIELDS CHECK
    // (ONLY NAME & ADDRESS)
    // ------------------------
    const requiredFields = [
      "name",
      "address",
      "warden_name",
      "warden_contact",
      "hostel_type",
    ];

    for (const field of requiredFields) {
      if (!bodydata[field] || bodydata[field].trim() === "") {
        return res
          .status(400)
          .json({ status: false, message: `${field} is required.` });
      }
    }

    // ------------------------
    // DUPLICATE HOSTEL CHECK
    // ------------------------
    const duplicateCheck = await db.query(
      "SELECT id FROM hostel WHERE name = ?",
      { replacements: [bodydata.name], type: db.QueryTypes.SELECT }
    );

    if (duplicateCheck.length > 0) {
      return res.status(400).json({
        status: false,
        message: "Hostel Name already exists.",
      });
    }

    // ------------------------
    // PREPARE INSERT DATA
    // ------------------------
    const allowedFields = [
      "name",
      "address",
      "warden_name",
      "warden_contact",
      "hostel_type",
      "total_rooms",
      "status",
    ];

    const insertColumns = [];
    const insertPlaceholders = [];
    const insertValues = [];

    allowedFields.forEach((field) => {
      if (bodydata[field] !== undefined && bodydata[field] !== "") {
        let val = bodydata[field];

        if (field === "total_rooms") {
          val = parseInt(val, 10) || null;
        }

        if (field === "status" && !["Active", "Inactive"].includes(val)) {
          val = "Active";
        }

        insertColumns.push(field);
        insertPlaceholders.push("?");
        insertValues.push(typeof val === "string" ? val.trim() : val);
      }
    });

    // ------------------------
    // START TRANSACTION
    // ------------------------
    await db.query("START TRANSACTION");

    // ------------------------
    // INSERT HOSTEL
    // ------------------------
    const [HostelResult] = await db.query(
      `INSERT INTO ${table} (${insertColumns.join(
        ", "
      )}) VALUES (${insertPlaceholders.join(", ")})`,
      { replacements: insertValues }
    );

    const hostelId = HostelResult;
    const EASYTIME_URL = await getEASYTIMEURL(userId);

    await db.query("COMMIT");

    // ======================================================
    // 🔔 AUTO CREATE SMS CONFIG (DEFAULT = AUTOMATIC)
    // ======================================================
    try {
      const [smsConfigCheck] = await db.query(
        "SELECT 1 FROM hostel_sms_config WHERE hostel_id = ? LIMIT 1",
        { replacements: [hostelId] }
      );

      if (!smsConfigCheck.length) {
        await db.query(
          `INSERT INTO hostel_sms_config
           (hostel_id, sms_alert_type, created_at, updated_at)
           VALUES (?, ?, ?, ?)`,
          { replacements: [hostelId, "automatic", QueryTime, QueryTime] }
        );
      }
    } catch (err) {
      console.error("❌ Failed to auto-create SMS configuration:", err.message);
    }

    // ======================================================
    // 🔥 WDMS AREA SYNC (UNCHANGED)
    // ======================================================
    try {
      const token = await getEasyTimeToken(userId);
      const areaName = bodydata.name.trim();
      const areaCode = `${hostelId}`;

      const wdmsResGet = await axios.get(
        `${EASYTIME_URL}/personnel/api/areas/?area_code=${areaCode}`,
        { headers: { Authorization: `Token ${token}` } }
      );

      const existingArea = wdmsResGet.data.data?.[0];

      if (existingArea) {
        const [mappingCheck] = await db.query(
          "SELECT 1 FROM wdms_mapping WHERE local_type=? AND local_id=? LIMIT 1",
          { replacements: ["area", hostelId] }
        );

        if (!mappingCheck.length) {
          await db.query(
            "INSERT INTO wdms_mapping (local_type, local_id, wdms_id) VALUES (?, ?, ?)",
            { replacements: ["area", hostelId, existingArea.id] }
          );
        }
      } else {
        const payload = {
          area_code: areaCode,
          area_name: areaName,
          parent_area: null,
        };

        const wdmsRes = await axios.post(
          `${EASYTIME_URL}/personnel/api/areas/`,
          payload,
          {
            headers: {
              Authorization: `Token ${token}`,
              "Content-Type": "application/json",
            },
          }
        );

        await db.query(
          "INSERT INTO wdms_mapping (local_type, local_id, wdms_id) VALUES (?, ?, ?)",
          { replacements: ["area", hostelId, wdmsRes.data.id] }
        );
      }
    } catch (err) {
      console.error(
        "❌ WDMS Area Sync Failed:",
        err.response?.data || err.message
      );
    }

    return res.status(200).json({
      status: true,
      message: "Hostel added successfully.",
      data: { hostel_id: hostelId },
    });
  } catch (error) {
    try {
      await db.query("ROLLBACK");
    } catch {}

    console.error("HOSTEL_ADD_ERROR:", error);
    const errorFetch = handleSequelizeError(error);

    return res.status(errorFetch?.statusCode || 500).json({
      status: errorFetch?.status || false,
      message: errorFetch?.message || "Internal server error",
    });
  }
};

export const GetHostel = async (req, res) => {
  const QueryTime = await getCurrentISTTime();

  try {
    const table = req.params.table || "hostel";
    const id = req.query.id;
    const searchTerm = req.query.search || "";

    const { tableName, primaryKeyField, usePagination, pageSize, offset } =
      req.getcheck;

    const userId = req.user?.userId;
    const roleId = req.user?.roleId;

    if (!userId) {
      return res.status(401).json({
        status: false,
        message: "Unauthorized - Missing user ID",
      });
    }

    // 🔐 ROLE CHECK
    const [roleResult] = await db.query("SELECT name FROM roles WHERE id = ?", {
      replacements: [roleId],
    });

    const isSuperAdmin = roleResult?.[0]?.name?.toLowerCase() === "superadmin";

    let whereConditions = [];
    let whereParams = [];

    if (id) {
      whereConditions.push(`${primaryKeyField} = ?`);
      whereParams.push(id);
    }

    if (searchTerm) {
      whereConditions.push(`name LIKE ?`);
      whereParams.push(`%${searchTerm}%`);
    }

    // 🔒 HOSTEL RESTRICTION ONLY FOR NON-SUPERADMIN
    if (!isSuperAdmin) {
      const [mappedHostels] = await db.query(
        `SELECT hostel_id FROM userhostelmap WHERE users_id = ?`,
        { replacements: [userId] }
      );

      if (mappedHostels.length > 0) {
        const hostelIds = mappedHostels.map((h) => h.hostel_id);
        const placeholders = hostelIds.map(() => "?").join(",");

        whereConditions.push(`${primaryKeyField} IN (${placeholders})`);
        whereParams.push(...hostelIds);
      } else {
        return res.status(200).json({
          status: true,
          issuccess: true,
          count: 0,
          data: [],
        });
      }
    }

    const whereClause =
      whereConditions.length > 0
        ? `WHERE ${whereConditions.join(" AND ")}`
        : "";

    const pageClause =
      usePagination === true ? `LIMIT ${pageSize} OFFSET ${offset}` : "";

    // 🔢 COUNT
    const [[{ total }]] = await db.query(
      `SELECT COUNT(*) as total FROM ${tableName} ${whereClause}`,
      { replacements: whereParams }
    );

    // 📦 DATA
    const query = `
      SELECT 
        id,
        name,
        address,
        warden_name,
        warden_contact,
        hostel_type,
        total_rooms,
        status,
        created_at,
        updated_at
      FROM ${tableName}
      ${whereClause}
      ${pageClause}
    `;

    const [results] = await db.query(query, {
      replacements: whereParams,
    });

    return res.status(200).json({
      status: true,
      issuccess: true,
      count: total,
      data: id ? results[0] : results,
    });
  } catch (error) {
    console.error("Error in GetHostel:", error);
    return res.status(500).json({
      status: false,
      issuccess: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

// -------------------------
// 3️⃣ GET HOSTEL BY ID
// -------------------------
export const GetHostelById = async (req, res) => {
  try {
    const table = req.params.table || "hostel";
    const id = req.params.id;

    if (!id)
      return res
        .status(400)
        .json({ status: false, message: "Hostel ID is required." });

    const [result] = await db.query(
      `SELECT 
        id,
        name,
        address,
        warden_name,
        warden_contact,
        hostel_type,
        total_rooms,
        status,
        created_at,
        updated_at
      FROM ${table} WHERE id = ?`,
      { replacements: [id] }
    );

    if (!result || result.length === 0)
      return res
        .status(404)
        .json({ status: false, message: "Hostel not found." });

    return res.status(200).json({ status: true, data: result[0] });
  } catch (error) {
    console.error("Error in GetHostelById:", error);
    res.status(500).json({
      status: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

// -------------------------
// 4️⃣ UPDATE HOSTEL
// -------------------------
export const UpdateHostel = async (req, res) => {
  const transaction = await db.transaction();

  const userId = req.user?.userId;
  const roleId = req.user?.roleId;

  const EASYTIME_URL = await getEASYTIMEURL(userId);

  try {
    const id = req.params.id;
    const body = req.body.data || req.body;

    if (!id)
      return res
        .status(400)
        .json({ status: false, message: "Hostel ID is required." });

    if (!body || Object.keys(body).length === 0)
      return res
        .status(400)
        .json({ status: false, message: "No data provided for update." });

    // Validate warden contact
    if (
      body.warden_contact !== undefined &&
      !/^\d{10}$/.test(body.warden_contact)
    ) {
      return res.status(400).json({
        status: false,
        message: "Warden Contact must be a 10-digit number",
      });
    }

    // Validate total rooms
    if (body.total_rooms !== undefined) {
      if (body.total_rooms === "" || body.total_rooms == null) {
        body.total_rooms = null;
      } else {
        const rooms = parseInt(body.total_rooms, 10);
        if (isNaN(rooms) || rooms < 0) {
          return res.status(400).json({
            status: false,
            message: "Total rooms must be a non-negative integer",
          });
        }
        body.total_rooms = rooms;
      }
    }

    const allowedFields = [
      "name",
      "address",
      "warden_name",
      "warden_contact",
      "hostel_type",
      "total_rooms",
      "status",
    ];

    const updateColumns = [];
    const updateValues = [];

    allowedFields.forEach((field) => {
      if (body[field] !== undefined) {
        let val = body[field];
        if (typeof val === "string") val = val.trim();
        updateColumns.push(`${field} = ?`);
        updateValues.push(val);
      }
    });

    if (updateColumns.length === 0) {
      return res.status(400).json({
        status: false,
        message: "No valid fields to update.",
      });
    }

    // 🔹 Local DB update
    await db.query(
      `UPDATE hostel SET ${updateColumns.join(", ")} WHERE id = ?`,
      { replacements: [...updateValues, id], transaction }
    );

    // ------------------------
    // 🔥 WDMS AREA SYNC (Safe Update)
    // ------------------------
    try {
      const token = await getEasyTimeToken(userId);

      // ✅ Fetch WDMS ID from mapping table
      const [mappingRows] = await db.query(
        `SELECT wdms_id FROM wdms_mapping WHERE local_type='area' AND local_id = ?`,
        { replacements: [id] }
      );

      if (mappingRows.length === 0) {
        console.log("⚠ WDMS Area mapping not found for Hostel ID:", id);
      } else {
        const wdmsId = mappingRows[0].wdms_id;
        console.log(wdmsId, "wdmsId");

        console.log(id, "id");

        const payload = {
          area_name: body.name?.trim() || undefined,
          parent_area: null,
        };

        await axios.put(`${EASYTIME_URL}/personnel/api/areas/${id}/`, payload, {
          headers: {
            Authorization: `Token ${token}`,
            "Content-Type": "application/json",
          },
        });

        console.log(
          "✔ WDMS Area Updated for Hostel:",
          body.name,
          "WDMS ID:",
          id
        );
      }
    } catch (err) {
      console.error(
        "❌ WDMS Area Update Failed:",
        err.response?.data || err.message
      );
      // WDMS failure should not block local DB update
    }

    await transaction.commit();

    return res.json({
      status: true,
      message: "Hostel updated successfully.",
    });
  } catch (error) {
    await transaction.rollback().catch(() => {});
    console.error("HOSTEL_UPDATE_ERROR:", error);
    return res.status(500).json({ status: false, message: error.message });
  }
};

export const DeleteHostel = async (req, res) => {
  const QueryTime = await getCurrentISTTime();
  const userId = req.user?.userId;

  try {
    const table = req.params.table || "hostel";
    const idParam = req.params.id;

    if (!idParam) {
      return res.status(400).json({
        status: false,
        error: "HOSTEL_ID_REQUIRED",
        message: "Hostel are required for deletion.",
      });
    }

    // Parse IDs
    const ids = idParam
      .split(",")
      .map((id) => parseInt(id, 10))
      .filter((id) => !isNaN(id));

    if (ids.length === 0) {
      return res.status(400).json({
        status: false,
        error: "INVALID_HOSTEL_IDS",
        message: "No valid Hostel IDs provided.",
      });
    }

    // Fetch WDMS IDs before deleting locally
    const [wdmsAreas] = await db.query(
      `SELECT wdms_id FROM wdms_mapping WHERE local_type='area' AND local_id IN (${ids
        .map(() => "?")
        .join(",")})`,
      { replacements: ids }
    );

    // Start transaction
    await db.query("START TRANSACTION");

    // Delete local hostels
    await db.query(
      `DELETE FROM ${table} WHERE id IN (${ids.map(() => "?").join(",")})`,
      { replacements: ids }
    );

    // Delete local WDMS mappings
    await db.query(
      `DELETE FROM wdms_mapping WHERE local_type='area' AND local_id IN (${ids
        .map(() => "?")
        .join(",")})`,
      { replacements: ids }
    );

    await db.query("COMMIT");
    console.log("✔ Hostels deleted successfully.");

    // DELETE FROM WDMS
    if (wdmsAreas.length > 0) {
      try {
        const EASYTIME_URL = await getEASYTIMEURL(userId);
        const token = await getEasyTimeToken(userId);

        for (const hostelId of ids) {
          try {
            await axios.delete(
              `${EASYTIME_URL}/personnel/api/areas/${hostelId}/`,
              {
                headers: { Authorization: `Token ${token}` },
              }
            );
          } catch (err) {
            console.warn(
              `❌ WDMS delete failed for a hostel`,
              err.response?.data || err.message
            );
          }
        }
      } catch (err) {
        console.error("❌ Failed to contact WDMS server:", err.message);
      }
    }

    return res.status(200).json({
      status: true,
      message: `Hostel deleted successfully.`,
      // IDs are not exposed
      deleted_ids: undefined,
      wdms_deleted_ids: undefined,
    });
  } catch (error) {
    try {
      await db.query("ROLLBACK");
    } catch {
      console.log("❌ Rollback failed");
    }

    console.error("HOSTEL_DELETE_ERROR:", error);

    return res.status(500).json({
      status: false,
      error: error.code || "INTERNAL_SERVER_ERROR",
      message:
        error.message || "An unexpected error occurred while deleting hostels.",
    });
  }
};
