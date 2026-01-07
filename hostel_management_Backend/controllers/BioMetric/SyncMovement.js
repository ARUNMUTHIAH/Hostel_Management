import axios from "axios";
import { db } from "../../config/Database.js";
import { getEasyTimeToken } from "../../Utils/easytime.js";
import { emitNewPunch } from "../../index.js";

export async function syncMovement() {
  try {
    const devices = await db.query(
      `SELECT id, device_sn, server_ip, port, hostel_id,device_direction
       FROM biometric_devices
       WHERE status = 'Active'`,
      { type: db.QueryTypes.SELECT }
    );

    if (!devices.length) {
      console.log("❌ No active devices");
      return;
    }

    for (const device of devices) {
      const EASYTIME_URL = `http://${device.server_ip}:${device.port}`;

      let token;
      try {
        token = await getEasyTimeToken(null, EASYTIME_URL);
      } catch {
        console.log(`⚠ Token failed for ${device.device_sn}`);
        continue;
      }

      let page = 1;
      let hasNext = true;

      while (hasNext) {
        try {
          const res = await axios.get(
            `${EASYTIME_URL}/iclock/api/transactions/?page=${page}`,
            { headers: { Authorization: `Token ${token}` } }
          );

          const punches = res.data?.data || [];

          for (const punch of punches) {
            if (punch.terminal_sn !== device.device_sn) {
              continue; // 🚫 skip punches from other devices
            }

            await savePunch(punch, device);
          }

          if (res.data?.next) {
            page++;
          } else {
            hasNext = false;
          }
        } catch (err) {
          console.error(
            `❌ ${device.device_sn} page ${page} failed`,
            err.message
          );
          hasNext = false;
        }
      }
      // 5️⃣ Log new punch and emit to frontend
    }
  } catch (err) {
    console.error("🔥 Global Sync Error:", err.message);
  }
}
export async function savePunch(punch, device) {
  try {
    if (!punch.punch_time || !punch.emp_code) return;

    const punchTimeMs = new Date(punch.punch_time).getTime();
    const TEN_SEC_MS = 10 * 1000;

    const [student] = await db.query(
      `SELECT id, hostel_id FROM student WHERE memberid = :code`,
      { replacements: { code: punch.emp_code }, type: db.QueryTypes.SELECT }
    );
    if (!student) return;

    // Skip if punch already exists
    const [exists] = await db.query(
      `SELECT id FROM studentmovement WHERE punch_id = :pid`,
      { replacements: { pid: punch.id }, type: db.QueryTypes.SELECT }
    );
    if (exists) return;

    const [lastMovement] = await db.query(
      `SELECT 
        COALESCE(in_time, out_time) AS last_punch_time,
        status
       FROM studentmovement
       WHERE student_id = :sid
       ORDER BY COALESCE(in_time, out_time) DESC
       LIMIT 1`,
      { replacements: { sid: student.id }, type: db.QueryTypes.SELECT }
    );

    let inTime = null;
    let outTime = null;
    let status = "";

    const direction = (device.device_direction || "").toUpperCase();

    // ✅ FIRST PUNCH HANDLING (FIXED)
    if (!lastMovement || !lastMovement.last_punch_time) {
      outTime = punch.punch_time;
      status = "OUT";
    } else {
      const lastTimeMs = new Date(lastMovement.last_punch_time).getTime();
      const diff = punchTimeMs - lastTimeMs;

      // Skip old / duplicate / too-fast punches
      if (diff <= 0 || diff <= TEN_SEC_MS) return;

      if (direction === "IN") {
        inTime = punch.punch_time;
        status = "IN";
      } else if (direction === "OUT") {
        outTime = punch.punch_time;
        status = "OUT";
      } else {
        // BOTH device → toggle
        status = lastMovement.status === "OUT" ? "IN" : "OUT";
        if (status === "IN") inTime = punch.punch_time;
        else outTime = punch.punch_time;
      }
    }

    const [result] = await db.query(
      `INSERT INTO studentmovement
       (student_id, hostel_id, in_time, out_time, status, punch_id, terminal_sn, area_alias, created_at)
       VALUES (:sid, :hid, :inTime, :outTime, :status, :pid, :sn, :area, :created)`,
      {
        replacements: {
          sid: student.id,
          hid: student.hostel_id,
          inTime,
          outTime,
          status,
          pid: punch.id,
          sn: punch.terminal_sn,
          area: punch.area_alias,
          created: punch.upload_time || punch.punch_time,
        },
      }
    );

    // Emit
    emitNewPunch({ movementId: result.insertId, type: "movement" });
    console.log(
      `SOCKET EMIT ID: ${
        result?.insertId || punch.id
      } | SAVED | ${status} | student=${student.id} | device=${
        device.device_sn
      }`
    );
  } catch (err) {
    console.error(`âŒ Punch ${punch?.id} failed:`, err.message);
  }
}
