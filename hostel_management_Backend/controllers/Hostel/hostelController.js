import { db } from "../../config/Database.js";
import { getCurrentISTTime, trimLetter } from "../../Utils/Datetime.js";
import { handleSequelizeError } from "../../config/validationCheck.js";

// -------------------------
// 1️⃣ ADD HOSTEL
// -------------------------
export const AddHostel = async (req, res) => {
  const QueryTime = await getCurrentISTTime();

  try {
    let table = req.params.table || "hostel";
    let bodydata = req.body.data || req.body;

    const { columns, placeholders, values, error, statusCode } = req.precheck;
    if (error) {
      return res
        .status(statusCode || 400)
        .json({ status: false, message: error });
    }

    // Required fields
    if (!bodydata.name || bodydata.name.trim() === "") {
      return res
        .status(400)
        .json({ status: false, message: "Hostel Name is required." });
    }
    if (!bodydata.address || bodydata.address.trim() === "") {
      return res
        .status(400)
        .json({ status: false, message: "Address is required." });
    }
    if (!bodydata.warden_name || bodydata.warden_name.trim() === "") {
      return res
        .status(400)
        .json({ status: false, message: "Warden Name is required." });
    }
    if (!bodydata.warden_contact || bodydata.warden_contact.trim() === "") {
      return res
        .status(400)
        .json({ status: false, message: "Warden Contact is required." });
    }
    if (!bodydata.hostel_type || bodydata.hostel_type.trim() === "") {
      return res
        .status(400)
        .json({ status: false, message: "Hostel Type is required." });
    }

    // Duplicate hostel check
    const duplicateCheck = await db.query(
      "SELECT id FROM hostel WHERE name = ?",
      { replacements: [bodydata.name], type: db.QueryTypes.SELECT }
    );
    if (duplicateCheck.length > 0) {
      return res
        .status(400)
        .json({ status: false, message: "Hostel Name already exists." });
    }

    // Prepare columns and values
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

        // Optional numeric field
        if (field === "total_rooms") {
          val = parseInt(val, 10);
          if (isNaN(val) || val < 0) val = null;
        }

        // Status default
        if (field === "status") {
          if (!["Active", "Inactive"].includes(val)) val = "Active";
        }

        // Boolean fields conversion

        insertColumns.push(field);
        insertPlaceholders.push("?");
        insertValues.push(typeof val === "string" ? val.trim() : val);
      }
    });
    // Start transaction
    await db.query("START TRANSACTION");

    // Insert hostel
    const HostelResult = await db.query(
      `INSERT INTO ${table} (${insertColumns.join(
        ", "
      )}) VALUES (${insertPlaceholders.join(", ")})`,
      { replacements: insertValues }
    );
    const hostelId = HostelResult[0];

    await db.query("COMMIT");

    return res.status(200).json({
      status: true,
      message: "Hostel added successfully.",
      data: { hostel_id: hostelId },
    });
  } catch (error) {
    try {
      await db.query("ROLLBACK");
    } catch {
      console.log("rollback failed");
    }
    console.error("HOSTEL_ADD_ERROR:", error);
    const errorFetch = handleSequelizeError(error);
    return res
      .status(errorFetch?.statusCode || 500)
      .json({ status: errorFetch?.status, message: errorFetch?.message });
  }
};

// -------------------------
// 2️⃣ GET HOSTEL (All or Search)
// -------------------------
export const GetHostel = async (req, res) => {
  const QueryTime = await getCurrentISTTime();

  try {
    const table = req.params.table || "hostel";
    const id = req.query.id;
    const searchTerm = req.query.search || "";

    const {
      tableName,
      primaryKeyField,
      usePagination,
      page,
      pageSize,
      offset,
    } = req.getcheck;

    const userId = req.user?.userId;
    const roleId = req.user?.roleId;

    if (!userId) {
      return res.status(401).json({
        status: false,
        message: "Unauthorized - Missing user ID",
      });
    }

    // ROLE CHECK
    const [roleResult] = await db.query("SELECT name FROM roles WHERE id = ?", {
      replacements: [roleId],
    });
    const isSuperAdmin =
      roleResult && roleResult[0]?.name?.toLowerCase() === "superadmin";

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

    // HOSTEL FILTER BASED ON USER ROLE
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
        // User has no mapped hostels → return empty
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
    const PageClause =
      usePagination === true ? `LIMIT ${pageSize} OFFSET ${offset}` : "";

    // Count total records
    const [[{ total }]] = await db.query(
      `SELECT COUNT(*) as total FROM ${tableName} ${whereClause}`,
      { replacements: whereParams }
    );

    // Fetch data with all relevant fields
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
      ${PageClause}
    `;

    const [results] = await db.query(query, { replacements: whereParams });

    return res.status(200).json({
      status: true,
      issuccess: true,
      count: total,
      data: id ? results[0] : results,
    });
  } catch (error) {
    console.error("Error in GetHostel:", error);
    res.status(500).json({
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

    // Validate warden contact if provided
    if (body.warden_contact !== undefined) {
      if (!/^\d{10}$/.test(body.warden_contact)) {
        return res.status(400).json({
          status: false,
          message: "Warden Contact must be a 10-digit number",
        });
      }
    }

    // Validate and normalize total_rooms
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

    // Allowed fields including booleans
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

        // Convert boolean-like fields to 0/1

        // Trim strings
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

    await db.query("START TRANSACTION");

    await db.query(
      `UPDATE hostel SET ${updateColumns.join(", ")} WHERE id = ?`,
      { replacements: [...updateValues, id] }
    );

    await db.query("COMMIT");

    return res.json({
      status: true,
      message: "Hostel updated successfully.",
    });
  } catch (error) {
    await db.query("ROLLBACK").catch(() => {});
    console.error("HOSTEL_UPDATE_ERROR:", error);
    return res.status(500).json({ status: false, message: error.message });
  }
};

export const DeleteHostel = async (req, res) => {
  const QueryTime = await getCurrentISTTime();

  try {
    const table = req.params.table || "hostel";
    const idParam = req.params.id;

    if (!idParam) {
      return res
        .status(400)
        .json({ status: false, message: "Hostel ID(s) required." });
    }

    // Parse IDs
    const ids = idParam
      .split(",")
      .map((id) => parseInt(id, 10))
      .filter((id) => !isNaN(id));

    if (ids.length === 0) {
      return res
        .status(400)
        .json({ status: false, message: "No valid Hostel IDs provided." });
    }

    await db.query("START TRANSACTION");

    // Delete hostels
    await db.query(`DELETE FROM ${table} WHERE id IN (:ids)`, {
      replacements: { ids },
    });

    await db.query("COMMIT");

    return res.status(200).json({
      status: true,
      message: `Hostel(s) with ID(s) ${ids.join(", ")} deleted successfully.`,
    });
  } catch (error) {
    try {
      await db.query("ROLLBACK");
    } catch {
      console.log("rollback failed");
    }

    console.error("HOSTEL_DELETE_ERROR:", error);
    const errorFetch = handleSequelizeError(error);
    return res.status(errorFetch?.statusCode || 500).json({
      status: errorFetch?.status,
      message: errorFetch?.message || "Internal server error",
    });
  }
};
