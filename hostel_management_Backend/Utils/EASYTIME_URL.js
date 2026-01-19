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
