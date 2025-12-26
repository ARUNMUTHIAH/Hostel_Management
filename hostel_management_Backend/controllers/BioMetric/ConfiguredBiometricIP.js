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

/**
 * Add a new biometric device for a hostel
 * One hostel can have multiple devices
 * Same device cannot be assigned to another hostel
 */

//before error and success message format
// export const addDevice = async (req, res) => {
//   try {
//     const {
//       hostel_id,
//       server_ip,
//       port,
//       device_ip,
//       device_name = "Biometric Device",
//       is_registration_device = 0,
//       is_attendance_device = 1,
//       device_direction = "BOTH", // 👈 NEW (dummy use)
//     } = req.body;

//     // 1️⃣ Validation
//     if (!hostel_id || !server_ip || !port || !device_ip) {
//       return res.status(400).json({
//         status: false,
//         message: "hostel_id, server_ip, port, device_ip are required",
//       });
//     }

//     // 2️⃣ WDMS URL
//     const EASYTIME_URL = `http://${server_ip}:${port}`;

//     // 3️⃣ Get WDMS token
//     const token = await getEasyTimeToken(null, EASYTIME_URL);

//     // 4️⃣ Fetch terminals from WDMS
//     const terminalRes = await axios.get(
//       `${EASYTIME_URL}/iclock/api/terminals/`,
//       { headers: { Authorization: `Token ${token}` } }
//     );

//     const matchedTerminal = terminalRes.data?.data?.find(
//       (t) => t.ip_address === device_ip
//     );

//     if (!matchedTerminal) {
//       return res.status(400).json({
//         status: false,
//         message: "Biometric device IP not found in WDMS",
//       });
//     }

//     const terminal_id = matchedTerminal.id;

//     // 5️⃣ Prevent same terminal in multiple hostels
//     const [existing] = await db.query(
//       `SELECT hostel_id FROM biometric_devices
//        WHERE terminal_id = ? AND status = 'Active'`,
//       { replacements: [terminal_id] }
//     );

//     if (existing.length > 0) {
//       return res.status(400).json({
//         status: false,
//         message: `Device already assigned to hostel ${existing[0].hostel_id}`,
//       });
//     }

//     // 6️⃣ Only ONE registration device per hostel
//     if (Number(is_registration_device) === 1) {
//       await db.query(
//         `UPDATE biometric_devices
//          SET is_registration_device = 0
//          WHERE hostel_id = ?`,
//         { replacements: [hostel_id] }
//       );
//     }

//     // 7️⃣ Insert device
//     const [result] = await db.query(
//       `INSERT INTO biometric_devices
//        (hostel_id, server_ip, port, device_ip, device_name,
//         terminal_id, status,
//         is_registration_device, is_attendance_device, device_direction)
//        VALUES (?, ?, ?, ?, ?, ?, 'Active', ?, ?, ?)`,
//       {
//         replacements: [
//           hostel_id,
//           server_ip,
//           port,
//           device_ip,
//           device_name,
//           terminal_id,
//           Number(is_registration_device),
//           Number(is_attendance_device),
//           device_direction,
//         ],
//       }
//     );

//     return res.json({
//       status: true,
//       message: "Device added successfully",
//       data: {
//         id: result.insertId,
//         device_ip,
//         is_registration_device,
//         is_attendance_device,
//         device_direction,
//       },
//     });
//   } catch (error) {
//     console.error("Add Device Error:", error.response?.data || error.message);
//     return res.status(500).json({
//       status: false,
//       message: "Failed to add device",
//     });
//   }
// };

// Update biometric device

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
    } = req.body;

    // 1️⃣ Validation
    if (!hostel_id || !server_ip || !port || !device_ip) {
      return res.status(400).json({
        status: false,
        error: "VALIDATION_ERROR",
        message: "hostel_id, server_ip, port, and device_ip are required",
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

    // 7️⃣ Insert device (✅ device_sn stored)
    const [result] = await db.query(
      `INSERT INTO biometric_devices
       (hostel_id, server_ip, port, device_ip, device_name,
        terminal_id, device_sn, status,
        is_registration_device, is_attendance_device, device_direction)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'Active', ?, ?, ?)`,
      {
        replacements: [
          hostel_id,
          server_ip,
          port,
          device_ip,
          device_name,
          terminal_id, // optional
          device_sn, // ✅ IMPORTANT
          Number(is_registration_device),
          Number(is_attendance_device),
          device_direction,
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

//before error and success message format
// export const updateDevice = async (req, res) => {
//   try {
//     const { id } = req.params;
//     const { server_ip, device_name, port } = req.body;
//     await db.query(
//       "UPDATE biometric_devices SET server_ip = ?, device_name = ?, port = ? WHERE id = ?",
//       { replacements: [server_ip, device_name, port, id] }
//     );
//     return res.json({ status: true, message: "Device updated successfully" });
//   } catch {
//     return res
//       .status(500)
//       .json({ status: false, message: "Failed to update device" });
//   }
// };

// Delete biometric device

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
    } = req.body;

    // 1️⃣ Check if device exists
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

    // 2️⃣ WDMS URL
    const EASYTIME_URL = `http://${server_ip}:${port}`;

    // 3️⃣ Get WDMS token
    const token = await getEasyTimeToken(null, EASYTIME_URL);

    // 4️⃣ Fetch terminals from WDMS
    const terminalRes = await axios.get(
      `${EASYTIME_URL}/iclock/api/terminals/`,
      {
        headers: { Authorization: `Token ${token}` },
      }
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

    // 5️⃣ Prevent same device SN in other hostels
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

    // 6️⃣ Only ONE registration device per hostel
    if (Number(is_registration_device) === 1 && hostel_id) {
      await db.query(
        `UPDATE biometric_devices 
         SET is_registration_device = 0
         WHERE hostel_id = ? AND id != ?`,
        { replacements: [hostel_id, id] }
      );
    }

    // 7️⃣ Update device including terminal_id & device_sn
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
        device_direction = ?
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

//before error and success message format

// export const deleteDevice = async (req, res) => {
//   try {
//     const { id } = req.params;
//     await db.query("DELETE FROM biometric_devices WHERE id = ?", {
//       replacements: [id],
//     });
//     return res.json({ status: true, message: "Device deleted successfully" });
//   } catch {
//     return res
//       .status(500)
//       .json({ status: false, message: "Failed to delete device" });
//   }
// };

export const deleteDevice = async (req, res) => {
  try {
    const { id } = req.params;

    await db.query("DELETE FROM biometric_devices WHERE id = ?", {
      replacements: [id],
    });

    return res.status(200).json({
      status: true,
      error: null,
      message: "Device deleted successfully",
      data: { id },
    });
  } catch (error) {
    console.error("Delete Device Error:", error.message || error);

    return res.status(500).json({
      status: false,
      error: "DEVICE_DELETE_FAILED",
      message: error.message || "Failed to delete device",
    });
  }
};
