import { db } from "../../config/Database.js";
import { getCurrentISTTime } from "../../Utils/Datetime.js";
import { handleSequelizeError } from "../../config/validationCheck.js";
import { sendSms } from "../../Utils/SendSms.js";
import cron from "node-cron";

/**
 * Add SMS Configuration
 */
export const AddSmsConfiguration = async (req, res) => {
  try {
    const QueryTime = await getCurrentISTTime();
    const bodydata = req.body.data || req.body;

    // Validation
    if (!bodydata.hostel_id) {
      return res
        .status(400)
        .json({ status: false, message: "Hostel is required." });
    }
    if (!bodydata.sms_alert_type) {
      return res
        .status(400)
        .json({ status: false, message: "SMS Alert Type is required." });
    }

    const smsType = bodydata.sms_alert_type.toLowerCase();
    if (!["manual", "automatic"].includes(smsType)) {
      return res.status(400).json({
        status: false,
        message: "SMS Alert Type must be 'manual' or 'automatic'.",
      });
    }

    // Check if configuration already exists
    const existing = await db.query(
      "SELECT id FROM hostel_sms_config WHERE hostel_id = ?",
      { replacements: [bodydata.hostel_id], type: db.QueryTypes.SELECT }
    );
    if (existing.length > 0) {
      return res.status(400).json({
        status: false,
        message: "SMS configuration already exists for this hostel.",
      });
    }

    // Insert
    const result = await db.query(
      `INSERT INTO hostel_sms_config (hostel_id, sms_alert_type, created_at, updated_at)
       VALUES (?, ?, ?, ?)`,
      { replacements: [bodydata.hostel_id, smsType, QueryTime, QueryTime] }
    );

    return res.status(200).json({
      status: true,
      message: "SMS configuration added successfully.",
      data: { id: result[0] },
    });
  } catch (error) {
    console.error("ADD_SMS_CONFIGURATION_ERROR:", error);
    const errorFetch = handleSequelizeError(error);
    return res.status(errorFetch?.statusCode || 500).json({
      status: errorFetch?.status || false,
      message: errorFetch?.message || "Internal server error",
    });
  }
};

/**
 * Fetch all SMS Configurations
 */
export const GetSmsConfiguration = async (req, res) => {
  try {
    const userId = req.user?.userId;
    const roleId = req.user?.roleId;

    if (!userId) {
      return res.status(401).json({
        status: false,
        message: "Unauthorized - Missing user ID",
      });
    }

    // Check if superadmin
    const [roleResult] = await db.query("SELECT name FROM roles WHERE id = ?", {
      replacements: [roleId],
    });
    const isSuperAdmin =
      roleResult && roleResult[0]?.name?.toLowerCase() === "superadmin";

    const id = req.query.id; // optional: fetch specific config
    const searchTerm = req.query.search || "";

    // Pagination
    const page = parseInt(req.query.page) || 1;
    const pageSize = parseInt(req.query.pageSize) || 20;
    const offset = (page - 1) * pageSize;

    let whereConditions = [];
    let queryParams = [];

    if (id) {
      whereConditions.push("hsc.id = ?");
      queryParams.push(id);
    }
    if (searchTerm) {
      whereConditions.push("h.name LIKE ?");
      queryParams.push(`%${searchTerm}%`);
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
        whereConditions.push(`hsc.hostel_id IN (${placeholders})`);
        queryParams.push(...hostelIds);
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

    // Count total records
    const [[{ total }]] = await db.query(
      `SELECT COUNT(*) as total
       FROM hostel_sms_config hsc
       JOIN hostel h ON h.id = hsc.hostel_id
       ${whereClause}`,
      { replacements: queryParams }
    );

    // Fetch SMS configuration with hostel name
    const [results] = await db.query(
      `SELECT 
         hsc.id,
         hsc.hostel_id,
         h.name AS name,
         hsc.sms_alert_type,
         hsc.created_at,
         hsc.updated_at
       FROM hostel_sms_config hsc
       JOIN hostel h ON h.id = hsc.hostel_id
       ${whereClause}
       ORDER BY hsc.id DESC
       LIMIT ? OFFSET ?`,
      { replacements: [...queryParams, pageSize, offset] }
    );

    return res.status(200).json({
      status: true,
      issuccess: true,
      count: total,
      data: id ? results[0] : results,
    });
  } catch (error) {
    console.error("GET_SMS_CONFIGURATION_ERROR:", error);
    const errorFetch = handleSequelizeError(error);
    return res.status(errorFetch?.statusCode || 500).json({
      status: errorFetch?.status || false,
      issuccess: false,
      message: errorFetch?.message || "Internal server error",
    });
  }
};

/**
 * Update SMS Configuration
 */
export const UpdateSmsConfiguration = async (req, res) => {
  try {
    const QueryTime = await getCurrentISTTime();
    const { id } = req.params;
    const bodydata = req.body.data || req.body;

    if (!id) {
      return res
        .status(400)
        .json({ status: false, message: "Configuration ID is required." });
    }

    // Build the fields to update dynamically
    const fieldsToUpdate = {};

    if (bodydata.sms_alert_type) {
      const smsType = bodydata.sms_alert_type.toLowerCase();
      if (!["manual", "automatic"].includes(smsType)) {
        return res.status(400).json({
          status: false,
          message: "SMS Alert Type must be 'manual' or 'automatic'.",
        });
      }
      fieldsToUpdate.sms_alert_type = smsType;
    }

    if (bodydata.hostel_id) {
      fieldsToUpdate.hostel_id = bodydata.hostel_id;
    }

    if (Object.keys(fieldsToUpdate).length === 0) {
      return res.status(400).json({
        status: false,
        message: "No valid fields provided to update.",
      });
    }

    fieldsToUpdate.updated_at = QueryTime;

    // Construct SET clause dynamically
    const setClause = Object.keys(fieldsToUpdate)
      .map((key) => `${key} = :${key}`)
      .join(", ");

    // Execute the update
    const [result] = await db.query(
      `UPDATE hostel_sms_config SET ${setClause} WHERE id = :id`,
      { replacements: { ...fieldsToUpdate, id } }
    );

    // Check if any row was affected
    if (result?.affectedRows === 0) {
      return res.status(404).json({
        status: false,
        message: "SMS configuration not found or already updated.",
      });
    }

    return res.status(200).json({
      status: true,
      message: "SMS configuration updated successfully.",
    });
  } catch (error) {
    console.error("UPDATE_SMS_CONFIGURATION_ERROR:", error);
    const errorFetch = handleSequelizeError(error);
    return res.status(errorFetch?.statusCode || 500).json({
      status: errorFetch?.status || false,
      message: errorFetch?.message || "Internal server error",
    });
  }
};

export const DeleteSmsConfiguration = async (req, res) => {
  const QueryTime = await getCurrentISTTime();

  try {
    const table = "hostel_sms_config";
    const idParam = req.params.id;

    if (!idParam) {
      return res
        .status(400)
        .json({ status: false, message: "ID(s) required." });
    }

    // Parse IDs
    const ids = idParam
      .split(",")
      .map((id) => parseInt(id, 10))
      .filter((id) => !isNaN(id));

    if (ids.length === 0) {
      return res
        .status(400)
        .json({ status: false, message: "No valid IDs provided." });
    }

    // Whitelist allowed tables to prevent SQL injection
    const allowedTables = ["hostel_sms_config", "hostel"];
    if (!allowedTables.includes(table)) {
      return res.status(400).json({
        status: false,
        message: `Deletion not allowed on table: ${table}`,
      });
    }

    // Start transaction
    await db.query("START TRANSACTION");

    const [result] = await db.query(`DELETE FROM ${table} WHERE id IN (:ids)`, {
      replacements: { ids },
    });

    await db.query("COMMIT");

    return res.status(200).json({
      status: true,
      message: `${table} record(s) with ID(s) ${ids.join(
        ", "
      )} deleted successfully.`,
    });
  } catch (error) {
    try {
      await db.query("ROLLBACK");
    } catch {
      console.log("Rollback failed");
    }

    console.error("DELETE_CONFIGURATION_ERROR:", error);
    const errorFetch = handleSequelizeError(error);
    return res.status(errorFetch?.statusCode || 500).json({
      status: errorFetch?.status || false,
      message: errorFetch?.message || "Internal server error",
    });
  }
};

export const getSmsApproval = async (req, res) => {
  const userId = req.user?.userId;
  const roleId = req.user?.roleId;

  try {
    if (!userId) {
      return res.status(401).json({
        status: false,
        message: "Unauthorized - Missing user ID",
      });
    }

    // Check if superadmin
    const [roleResult] = await db.query("SELECT name FROM roles WHERE id = ?", {
      replacements: [roleId],
    });
    const isSuperAdmin =
      roleResult && roleResult[0]?.name?.toLowerCase() === "superadmin";

    let hostelFilter = "";
    let queryReplacements = []; // <-- define replacements here

    if (!isSuperAdmin) {
      // For non-superadmin, filter by mapped hostels
      const [mappedHostels] = await db.query(
        `SELECT hostel_id FROM userhostelmap WHERE users_id = ?`,
        { replacements: [userId] }
      );

      if (mappedHostels.length > 0) {
        const hostelIds = mappedHostels.map((h) => h.hostel_id);
        const placeholders = hostelIds.map(() => "?").join(",");
        hostelFilter = `AND sm.hostel_id IN (${placeholders})`;
        queryReplacements = hostelIds; // <-- use this in the final query
      } else {
        // No mapped hostels, return empty
        return res.status(200).json({ status: true, count: 0, data: [] });
      }
    }

    // Prepare final query
    const [rows] = await db.query(
      `
      SELECT
        sm.id AS student_movement_id,
        s.name,
        s.memberid,
        s.parentcontact,
        h.name AS hostel,
        DATE_FORMAT(sm.out_time, "%Y-%m-%d %h:%i %p") AS out_time
      FROM studentmovement sm
      JOIN student s ON sm.student_id = s.id
      JOIN hostel h ON sm.hostel_id = h.id
      JOIN allowedtime at ON sm.hostel_id = at.hostel_id
      WHERE 
        sm.status = 'OUT'
        ${hostelFilter}
        AND (
          TIME(NOW()) > at.expected_return_time
          OR DATE(sm.out_time) < CURDATE()
        )
      ORDER BY sm.out_time DESC
    `,
      { replacements: queryReplacements }
    );

    return res.status(200).json({
      status: true,
      count: rows.length,
      data: rows,
    });
  } catch (error) {
    console.error("GET_SMS_APPROVAL_ERROR:", error);
    return res.status(500).json({
      status: false,
      message: "Something went wrong",
      error: error.message,
    });
  }
};

export const sendLateReturnSms = async (req, res) => {
  try {
    const { student_ids = [] } = req.body;

    if (student_ids.length === 0) {
      return res
        .status(400)
        .json({ status: false, message: "No students selected" });
    }

    // Fetch parent contact & student details
    const [students] = await db.query(
      `SELECT id, name, memberid, parent_contact
       FROM student
       WHERE id IN (?)`,
      [student_ids]
    );

    if (students.length === 0) {
      return res
        .status(404)
        .json({ status: false, message: "Students not found" });
    }

    let successCount = 0;

    for (const student of students) {
      const smsMsg = `Dear Parent, your ward ${student.name} (Member ID: ${student.memberid}) returned late to hostel today.`;
      const sent = await sendSms(student.parent_contact, smsMsg);

      if (sent) successCount++;
    }

    return res.json({
      status: true,
      message: `SMS sent successfully to ${successCount} parents`,
    });
  } catch (error) {
    console.error("Late Return SMS Error:", error);
    return res
      .status(500)
      .json({ status: false, message: "Internal Server Error" });
  }
};

cron.schedule("*/5 * * * *", async () => {
  console.log("Running automatic late return SMS check...");

  try {
    const [students] = await db.query(`
      SELECT sm.id AS movement_id, s.id AS student_id, s.name, s.memberid, s.parentcontact, h.id AS hostel_id, hsc.sms_alert_type
      FROM studentmovement sm
      JOIN student s ON sm.student_id = s.id
      JOIN hostel h ON sm.hostel_id = h.id
      JOIN allowedtime at ON sm.hostel_id = at.hostel_id
      JOIN hostel_sms_config hsc ON h.id = hsc.hostel_id
      WHERE sm.status = 'OUT'
        AND (TIME(NOW()) > at.expected_return_time OR DATE(sm.out_time) < CURDATE())
        AND hsc.sms_alert_type = 'automatic'
    `);

    for (const student of students) {
      const smsMsg = `Dear Parent, your ward ${student.name} (Member ID: ${student.memberid}) returned late to hostel today.`;
      await sendSms(student.parent_contact, smsMsg);
    }
  } catch (error) {
    console.error("Automatic SMS Cron Error:", error);
  }
});
