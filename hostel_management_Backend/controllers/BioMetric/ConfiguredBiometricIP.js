import axios from "axios";
import { db } from "../../config/Database.js";
import { getEasyTimeToken } from "../../Utils/easytime.js";
import { resolveWdmsConnection } from "../../Utils/EASYTIME_URL.js";

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
      biometric_type = "FINGER",
      device_sn: providedDeviceSn,
      terminal_id: providedTerminalId,
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

    let terminal_id = providedTerminalId ?? null;
    let device_sn = providedDeviceSn?.trim() || null;
    const wdms = resolveWdmsConnection(server_ip, port);

    // Resolve terminal from WDMS unless serial number was supplied manually
    if (!device_sn) {
      const token = await getEasyTimeToken(null, wdms.url);

      const terminalRes = await axios.get(
        `${wdms.url}/iclock/api/terminals/`,
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

      terminal_id = matchedTerminal.id;
      device_sn = matchedTerminal.sn;
    }

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
          wdms.server_ip,
          wdms.port,
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
    const wdmsDetail =
      error.response?.data?.detail ||
      (Array.isArray(error.response?.data?.non_field_errors)
        ? error.response.data.non_field_errors.join("; ")
        : null) ||
      error.response?.data?.message ||
      (typeof error.response?.data === "string" ? error.response.data : null);

    console.error("Add Device Error:", error.response?.data || error.message);

    const isWdmsError =
      error.message?.includes("log in") ||
      error.message?.includes("credentials") ||
      Boolean(error.response);

    return res.status(isWdmsError ? 502 : 500).json({
      status: false,
      error: "DEVICE_ADD_FAILED",
      message:
        wdmsDetail ||
        error.message ||
        "Failed to add device",
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

    const existingDevice = rows[0];
    const wdms = resolveWdmsConnection(
      server_ip || existingDevice.server_ip,
      port || existingDevice.port
    );
    const resolvedServerIp = wdms.server_ip;
    const resolvedPort = wdms.port;
    const resolvedDeviceIp = device_ip || existingDevice.device_ip;
    const ipUnchanged = resolvedDeviceIp === existingDevice.device_ip;

    let terminal_id = existingDevice.terminal_id;
    let device_sn = existingDevice.device_sn;

    // Only re-validate against WDMS when the device IP changes
    if (!ipUnchanged) {
      const token = await getEasyTimeToken(null, wdms.url);

      const terminalRes = await axios.get(
        `${wdms.url}/iclock/api/terminals/`,
        { headers: { Authorization: `Token ${token}` } }
      );

      const matchedTerminal = terminalRes.data?.data?.find(
        (t) => t.ip_address === resolvedDeviceIp
      );

      if (!matchedTerminal) {
        return res.status(400).json({
          status: false,
          error: "DEVICE_NOT_FOUND",
          message: "Biometric device IP not found in WDMS",
        });
      }

      terminal_id = matchedTerminal.id;
      device_sn = matchedTerminal.sn;

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
          hostel_id ?? existingDevice.hostel_id,
          resolvedServerIp,
          resolvedPort,
          resolvedDeviceIp,
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
        device_ip: resolvedDeviceIp,
        device_sn,
        is_registration_device,
        is_attendance_device,
        device_direction,
        biometric_type,
      },
    });
  } catch (error) {
    const wdmsDetail =
      error.response?.data?.detail ||
      error.response?.data?.message ||
      (typeof error.response?.data === "string" ? error.response.data : null);

    console.error(
      "Update Device Error:",
      error.response?.data || error.message
    );

    const isWdmsError = Boolean(error.response) || error.message?.includes("EasyTime");
    return res.status(isWdmsError ? 502 : 500).json({
      status: false,
      error: "DEVICE_UPDATE_FAILED",
      message:
        wdmsDetail ||
        error.message ||
        "Failed to update device",
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
