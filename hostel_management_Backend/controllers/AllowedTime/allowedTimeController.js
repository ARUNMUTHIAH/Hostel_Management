import { db } from "../../config/Database.js";
import { getCurrentISTTime } from "../../Utils/Datetime.js";
import { handleSequelizeError } from "../../config/validationCheck.js";

// -------------------------
// 1️⃣ ADD ALLOWED TIME
// -------------------------
export const AddAllowedTime = async (req, res) => {
  const QueryTime = await getCurrentISTTime();
  try {
    const table = req.params.table || "allowedtime";
    const bodydata = req.body.data || req.body;

    // Precheck validation
    const { columns, placeholders, values, error, statusCode } = req.precheck;

    if (error) {
      return res
        .status(statusCode || 400)
        .json({ status: false, message: error });
    }

    await db.query("START TRANSACTION");

    const trimmedValues = values.map((val, idx) => {
      if (typeof val === "string") return val.trim();
      return val;
    });

    const result = await db.query(
      `INSERT INTO ${table} (${columns.join(", ")}) VALUES (${placeholders})`,
      { replacements: trimmedValues }
    );

    const allowedTimeId = result[0];

    await db.query("COMMIT");

    return res.status(200).json({
      status: true,
      message: "Allowed Time added successfully.",
      data: { id: allowedTimeId },
    });
  } catch (error) {
    try {
      await db.query("ROLLBACK");
    } catch {
      console.log("rollback failed");
    }
    console.error("ADD_ALLOWED_TIME_ERROR:", error);
    const errorFetch = handleSequelizeError(error);
    return res
      .status(errorFetch?.statusCode || 500)
      .json({ status: errorFetch?.status, message: errorFetch?.message });
  }
};

// -------------------------
// 2️⃣ GET ALLOWED TIME (LIST or BY ID)
// -------------------------
export const GetAllowedTime = async (req, res) => {
  try {
    const table = req.params.table || "allowedtime";
    const id = req.query.id;
    const hostelId = req.query.hostel_id;

    let whereConditions = [];
    let whereParams = [];

    if (id) {
      whereConditions.push("id = ?");
      whereParams.push(id);
    }
    if (hostelId) {
      whereConditions.push("hostel_id = ?");
      whereParams.push(hostelId);
    }

    const whereClause =
      whereConditions.length > 0
        ? `WHERE ${whereConditions.join(" AND ")}`
        : "";

    const query = `
      SELECT 
        id, hostel_id, allowed_out_time, expected_return_time, 
        maximum_delay, sms_trigger_time, status, created_at, updated_at
      FROM ${table}
      ${whereClause}
    `;

    const [results] = await db.query(query, { replacements: whereParams });

    return res.status(200).json({
      status: true,
      count: results.length,
      data: id ? results[0] : results,
    });
  } catch (error) {
    console.error("GET_ALLOWED_TIME_ERROR:", error);
    return res.status(500).json({
      status: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

// -------------------------
// 3️⃣ UPDATE ALLOWED TIME
// -------------------------
export const UpdateAllowedTime = async (req, res) => {
  try {
    const table = req.params.table || "allowedtime";
    const id = req.params.id;
    const bodydata = req.body.data || req.body;

    if (!id)
      return res
        .status(400)
        .json({ status: false, message: "ID is required." });

    const columns = [
      "hostel_id",
      "allowed_out_time",
      "expected_return_time",
      "maximum_delay",
      "sms_trigger_time",
      "status",
    ];
    const setClause = columns
      .filter((col) => bodydata[col] !== undefined)
      .map((col) => `${col} = ?`)
      .join(", ");

    if (!setClause)
      return res
        .status(400)
        .json({ status: false, message: "No fields to update." });

    const values = columns
      .filter((col) => bodydata[col] !== undefined)
      .map((col) => bodydata[col]);

    await db.query("START TRANSACTION");
    await db.query(
      `UPDATE ${table} SET ${setClause}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      { replacements: [...values, id] }
    );
    await db.query("COMMIT");

    return res
      .status(200)
      .json({ status: true, message: "Allowed Time updated successfully." });
  } catch (error) {
    try {
      await db.query("ROLLBACK");
    } catch {
      console.log("rollback failed");
    }
    console.error("UPDATE_ALLOWED_TIME_ERROR:", error);
    const errorFetch = handleSequelizeError(error);
    return res
      .status(errorFetch?.statusCode || 500)
      .json({ status: errorFetch?.status, message: errorFetch?.message });
  }
};

// -------------------------
// 4️⃣ DELETE ALLOWED TIME
// -------------------------
export const DeleteAllowedTime = async (req, res) => {
  try {
    const table = req.params.table || "allowedtime";
    const id = req.params.id;

    if (!id)
      return res
        .status(400)
        .json({ status: false, message: "ID is required." });

    await db.query("START TRANSACTION");
    await db.query(`DELETE FROM ${table} WHERE id = ?`, { replacements: [id] });
    await db.query("COMMIT");

    return res
      .status(200)
      .json({ status: true, message: "Allowed Time deleted successfully." });
  } catch (error) {
    try {
      await db.query("ROLLBACK");
    } catch {
      console.log("rollback failed");
    }
    console.error("DELETE_ALLOWED_TIME_ERROR:", error);
    const errorFetch = handleSequelizeError(error);
    return res
      .status(errorFetch?.statusCode || 500)
      .json({ status: errorFetch?.status, message: errorFetch?.message });
  }
};
