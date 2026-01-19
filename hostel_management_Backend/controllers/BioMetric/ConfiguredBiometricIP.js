import axios from "axios";
import { db } from "../../config/Database.js";
import { getEasyTimeToken } from "../../Utils/easytime.js";

// Get all devices for a hostel
export const getDevicesByHostel = async (req, res) => {
  try {
    const { hostel_id } = req.params;
    const [rows] = await db.query(
      "SELECT * FROM biometric_devices WHERE hostel_id = ? ORDER BY id DESC",
      { replacements: [hostel_id] }
    );
    return res.json({ status: true, data: rows });
  } catch {
    return res
      .status(500)
      .json({ status: false, message: "Failed to fetch devices" });
  }
};

export const addDevice = async (req, res) => {
  try {
    const {
      hostel_id,
      server_ip,
      port,
      device_ip,
      device_name = "Biometric Device",
      is_registration_device = 0,
      is_attendance_device = 1,
      device_direction = "BOTH",
      biometric_type = "FINGER", // ✅ new field
    } = req.body;

    // 1️⃣ Validation
    if (!hostel_id || !server_ip || !port || !device_ip) {
      return res.status(400).json({
        status: false,
        error: "VALIDATION_ERROR",
        message: "hostel_id, server_ip, port, and device_ip are required",
      });
    }
    if (!["FINGER", "FACE", "BOTH"].includes(biometric_type)) {
      return res.status(400).json({
        status: false,
        error: "INVALID_BIOMETRIC_TYPE",
        message: "biometric_type must be FINGER, FACE, or BOTH",
      });
    }

    // 2️⃣ WDMS URL
    const EASYTIME_URL = `http://${server_ip}:${port}`;

    // 3️⃣ Get WDMS token
    const token = await getEasyTimeToken(null, EASYTIME_URL);

    // 4️⃣ Fetch terminals from WDMS
    const terminalRes = await axios.get(
      `${EASYTIME_URL}/iclock/api/terminals/`,
      { headers: { Authorization: `Token ${token}` } }
    );

    const matchedTerminal = terminalRes.data?.data?.find(
      (t) => t.ip_address === device_ip
    );

    if (!matchedTerminal) {
      return res.status(400).json({
        status: false,
        error: "DEVICE_NOT_FOUND",
        message: "Biometric device IP not found in WDMS",
      });
    }

    // ✅ CORRECT VALUES
    const terminal_id = matchedTerminal.id; // WDMS internal (optional)
    const device_sn = matchedTerminal.sn; // REAL serial number

    // 5️⃣ Prevent same device SN in multiple hostels
    const [existing] = await db.query(
      `SELECT hostel_id FROM biometric_devices
       WHERE device_sn = ? AND status = 'Active'`,
      { replacements: [device_sn] }
    );

    if (existing.length > 0) {
      return res.status(400).json({
        status: false,
        error: "DUPLICATE_DEVICE",
        message: `Device already assigned to another hostel`,
      });
    }

    // 6️⃣ Only ONE registration device per hostel
    if (Number(is_registration_device) === 1) {
      await db.query(
        `UPDATE biometric_devices
         SET is_registration_device = 0
         WHERE hostel_id = ?`,
        { replacements: [hostel_id] }
      );
    }

    const [result] = await db.query(
      `INSERT INTO biometric_devices
   (hostel_id, server_ip, port, device_ip, device_name,
    terminal_id, device_sn, status,
    is_registration_device, is_attendance_device, device_direction, biometric_type)
   VALUES (?, ?, ?, ?, ?, ?, ?, 'Active', ?, ?, ?, ?)`,
      {
        replacements: [
          hostel_id,
          server_ip,
          port,
          device_ip,
          device_name,
          terminal_id,
          device_sn,
          Number(is_registration_device),
          Number(is_attendance_device),
          device_direction,
          biometric_type,
        ],
      }
    );

    return res.status(200).json({
      status: true,
      error: null,
      message: "Device added successfully",
      data: {
        id: result.insertId,
        device_ip,
        device_sn,
        is_registration_device,
        is_attendance_device,
        device_direction,
      },
    });
  } catch (error) {
    console.error("Add Device Error:", error.response?.data || error.message);
    return res.status(500).json({
      status: false,
      error: "DEVICE_ADD_FAILED",
      message: error.message || "Failed to add device",
    });
  }
};

export const updateDevice = async (req, res) => {
  try {
    const { id } = req.params;

    const {
      hostel_id,
      server_ip,
      port,
      device_ip,
      device_name = "Biometric Device",
      is_registration_device = 0,
      is_attendance_device = 1,
      device_direction = "BOTH",
      biometric_type = "FINGER",
    } = req.body;

    const [rows] = await db.query(
      "SELECT * FROM biometric_devices WHERE id = ?",
      { replacements: [id] }
    );

    if (!rows.length) {
      return res.status(404).json({
        status: false,
        error: "NOT_FOUND",
        message: "Device not found",
      });
    }

    const EASYTIME_URL = `http://${server_ip}:${port}`;
    const token = await getEasyTimeToken(null, EASYTIME_URL);

    const terminalRes = await axios.get(
      `${EASYTIME_URL}/iclock/api/terminals/`,
      { headers: { Authorization: `Token ${token}` } }
    );

    const matchedTerminal = terminalRes.data?.data?.find(
      (t) => t.ip_address === device_ip
    );

    if (!matchedTerminal) {
      return res.status(400).json({
        status: false,
        error: "DEVICE_NOT_FOUND",
        message: "Biometric device IP not found in WDMS",
      });
    }

    const terminal_id = matchedTerminal.id;
    const device_sn = matchedTerminal.sn;

    const [existing] = await db.query(
      `SELECT hostel_id FROM biometric_devices
       WHERE device_sn = ? AND status = 'Active' AND id != ?`,
      { replacements: [device_sn, id] }
    );

    if (existing.length > 0) {
      return res.status(400).json({
        status: false,
        error: "DUPLICATE_DEVICE",
        message: "Device already assigned to another hostel",
      });
    }

    if (Number(is_registration_device) === 1 && hostel_id) {
      await db.query(
        `UPDATE biometric_devices 
         SET is_registration_device = 0
         WHERE hostel_id = ? AND id != ?`,
        { replacements: [hostel_id, id] }
      );
    }

    await db.query(
      `UPDATE biometric_devices SET
        hostel_id = ?,
        server_ip = ?,
        port = ?,
        device_ip = ?,
        device_name = ?,
        terminal_id = ?,
        device_sn = ?,
        is_registration_device = ?,
        is_attendance_device = ?,
        device_direction = ?,
        biometric_type = ?
       WHERE id = ?`,
      {
        replacements: [
          hostel_id,
          server_ip,
          port,
          device_ip,
          device_name,
          terminal_id,
          device_sn,
          Number(is_registration_device),
          Number(is_attendance_device),
          device_direction,
          biometric_type,
          id,
        ],
      }
    );

    return res.status(200).json({
      status: true,
      error: null,
      message: "Device updated successfully",
      data: {
        id,
        device_ip,
        device_sn,
        is_registration_device,
        is_attendance_device,
        device_direction,
        biometric_type,
      },
    });
  } catch (error) {
    console.error(
      "Update Device Error:",
      error.response?.data || error.message
    );
    return res.status(500).json({
      status: false,
      error: "DEVICE_UPDATE_FAILED",
      message: error.message || "Failed to update device",
    });
  }
};

// export const deleteDevice = async (req, res) => {
//   try {
//     const { id } = req.params;

//     await db.query("DELETE FROM biometric_devices WHERE id = ?", {
//       replacements: [id],
//     });

//     return res.status(200).json({
//       status: true,
//       error: null,
//       message: "Device deleted successfully",
//       data: { id },
//     });
//   } catch (error) {
//     console.error("Delete Device Error:", error.message || error);

//     return res.status(500).json({
//       status: false,
//       error: "DEVICE_DELETE_FAILED",
//       message: error.message || "Failed to delete device",
//     });
//   }
// };
//before face device

export const deleteDevice = async (req, res) => {
  const transaction = await db.transaction();

  try {
    const { id } = req.params;

    if (!id) {
      await transaction.rollback();
      return res.status(400).json({
        status: false,
        error: "DEVICE_ID_REQUIRED",
        message: "Device ID is required",
      });
    }

    // Check if device exists
    const [existing] = await db.query(
      "SELECT * FROM biometric_devices WHERE id = ?",
      {
        replacements: [id],
        transaction,
      }
    );

    if (!existing || existing.length === 0) {
      await transaction.rollback();
      return res.status(404).json({
        status: false,
        error: "DEVICE_NOT_FOUND",
        message: "Device not found",
      });
    }

    // DELETE
    await db.query("DELETE FROM biometric_devices WHERE id = ?", {
      replacements: [id],
      transaction,
    });

    await transaction.commit();

    return res.status(200).json({
      status: true,
      error: null,
      message: "Device deleted successfully",
      data: { id },
    });
  } catch (error) {
    await transaction.rollback();

    console.error("Delete Device Error:", error.message || error);

    return res.status(500).json({
      status: false,
      error: "DEVICE_DELETE_FAILED",
      message: error.message || "Failed to delete device",
    });
  }
};
