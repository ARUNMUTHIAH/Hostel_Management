// import { db } from "../config/Database.js";

// export const getEASYTIMEURL = async (userId = null) => {
//   // ✅ 1. Use full URL from env if defined
//   if (process.env.WDMS_URL) return process.env.WDMS_URL;

//   let hostelId;

//   // 2. Get hostel mapped to user
//   if (userId) {
//     const mapped = await db.query(
//       "SELECT hostel_id FROM userhostelmap WHERE users_id = ? LIMIT 1",
//       { replacements: [userId], type: db.QueryTypes.SELECT }
//     );
//     if (mapped.length > 0) hostelId = mapped[0].hostel_id;
//   }

//   // 3. If no mapping → use first active hostel with a device
//   if (!hostelId) {
//     const defaultMap = await db.query(
//       "SELECT hostel_id FROM biometric_devices WHERE status = 'Active' ORDER BY id ASC LIMIT 1",
//       { type: db.QueryTypes.SELECT }
//     );
//     if (!defaultMap.length)
//       throw new Error("No active biometric devices found");
//     hostelId = defaultMap[0].hostel_id;
//   }

//   // 4. Fetch the latest active biometric device
//   const device = await db.query(
//     `SELECT server_ip, port
//      FROM biometric_devices
//      WHERE hostel_id = ? AND status = 'Active'
//      ORDER BY id DESC LIMIT 1`,
//     { replacements: [hostelId], type: db.QueryTypes.SELECT }
//   );

//   if (!device.length)
//     throw new Error("No active biometric device found for this hostel");

//   const serverIP = device[0].server_ip;
//   const port = device[0].port;

//   // ✅ Always use HTTP for internal access
//   const url = `http://${serverIP}:${port}`;
//   console.log(url, "EASYTIME_URL generated");
//   return url;
// };
// before that area restriction

//that superadmin can acces the all area not only mapped and multiple area access
// import { db } from "../config/Database.js";

// export const getEASYTIMEURL = async (userId = null) => {
//   // 1️⃣ Use full URL from env if defined
//   if (process.env.WDMS_URL) return process.env.WDMS_URL;

//   let hostelId;

//   // 2️⃣ Get hostel mapped to user
//   if (userId) {
//     const mapped = await db.query(
//       "SELECT hostel_id FROM userhostelmap WHERE users_id = ? LIMIT 1",
//       { replacements: [userId], type: db.QueryTypes.SELECT }
//     );
//     if (mapped.length > 0) hostelId = mapped[0].hostel_id;
//   }

//   // 3️⃣ If no mapping → use first active hostel with a device
//   if (!hostelId) {
//     const defaultMap = await db.query(
//       "SELECT hostel_id FROM biometric_devices WHERE LOWER(status) = 'active' ORDER BY id ASC LIMIT 1",
//       { type: db.QueryTypes.SELECT }
//     );
//     if (!defaultMap.length)
//       throw new Error("No active biometric devices found");
//     hostelId = defaultMap[0].hostel_id;
//   }

//   // 4️⃣ Fetch all active biometric devices for the hostel
//   const devices = await db.query(
//     `SELECT server_ip, port
//      FROM biometric_devices
//      WHERE hostel_id = ? AND LOWER(status) = 'active'
//      ORDER BY id ASC`,
//     { replacements: [hostelId], type: db.QueryTypes.SELECT }
//   );

//   if (!devices.length)
//     throw new Error("No active biometric device found for this hostel");

//   // 5️⃣ For backwards compatibility, return the first device URL as a string
//   const serverIP = devices[0].server_ip;
//   const port = devices[0].port;

//   const url = `http://${serverIP}:${port}`;
//   console.log(url, "EASYTIME_URL generated");

//   return url; // ✅ return string directly
// };

import { db } from "../config/Database.js";

export const getEASYTIMEURL = async (userId = null) => {
  // 1️⃣ Highest priority: ENV URL
  if (process.env.WDMS_URL) return process.env.WDMS_URL;

  if (!userId) {
    throw new Error("User ID is required to fetch biometric device URL");
  }

  // 2️⃣ Get user role by joining users → roles
  const [userRole] = await db.query(
    `
    SELECT r.name AS role_name
    FROM users u
    JOIN roles r ON r.id = u.role_id
    WHERE u.id = ?
    LIMIT 1
    `,
    { replacements: [userId] }
  );

  if (!userRole.length) {
    throw new Error("User role not found");
  }

  const isSuperAdmin = userRole[0].role_name?.toLowerCase() === "superadmin";

  let hostelIds = [];

  // 3️⃣ SUPERADMIN → all hostels with active biometric devices
  if (isSuperAdmin) {
    const hostels = await db.query(
      `
      SELECT DISTINCT hostel_id
      FROM biometric_devices
      WHERE LOWER(status) = 'active'
      `,
      { type: db.QueryTypes.SELECT }
    );

    if (!hostels.length) {
      throw new Error("No active biometric devices found");
    }

    hostelIds = hostels.map((h) => h.hostel_id);
  }
  // 4️⃣ NORMAL USER → only mapped hostels
  else {
    const mapped = await db.query(
      `
      SELECT hostel_id
      FROM userhostelmap
      WHERE users_id = ?
      `,
      {
        replacements: [userId],
        type: db.QueryTypes.SELECT,
      }
    );

    if (!mapped.length) {
      throw new Error("User is not mapped to any hostel");
    }

    hostelIds = mapped.map((h) => h.hostel_id);
  }

  // 5️⃣ Fetch active biometric devices for allowed hostels
  const placeholders = hostelIds.map(() => "?").join(",");

  const devices = await db.query(
    `
    SELECT server_ip, port, hostel_id
    FROM biometric_devices
    WHERE hostel_id IN (${placeholders})
      AND LOWER(status) = 'active'
    ORDER BY id ASC
    `,
    {
      replacements: hostelIds,
      type: db.QueryTypes.SELECT,
    }
  );

  if (!devices.length) {
    throw new Error("No active biometric device found for permitted hostels");
  }

  // 6️⃣ Backward compatibility → return first device URL
  const { server_ip, port } = devices[0];
  const url = `http://${server_ip}:${port}`;

  console.log(url, "EASYTIME_URL generated");

  return url;
};
