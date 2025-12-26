import axios from "axios";
import { db } from "../../config/Database.js";
import { getEasyTimeToken } from "../../Utils/easytime.js";
import { emitNewPunch } from "../../index.js";

const lastAcceptedPunch = {};

export async function syncMovement() {
  try {
    const devices = await db.query(
      `SELECT id, device_sn, server_ip, port, hostel_id
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
    const FIFTY_SEC_MS = 50 * 1000; // 50 seconds

    // Get student
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
      `SELECT created_at, status 
   FROM studentmovement 
   WHERE student_id = :sid 
   ORDER BY created_at DESC 
   LIMIT 1`,
      { replacements: { sid: student.id }, type: db.QueryTypes.SELECT }
    );

    if (lastMovement) {
      const lastTimeMs = new Date(lastMovement.created_at).getTime();
      const diff = punchTimeMs - lastTimeMs;

      // Log timestamps
      console.log(lastMovement, "lastMovementlastMovement");

      console.log(
        `🕒 Student ${student.id} | Last created_at: ${
          lastMovement.created_at
        } | Punch time: ${punch.punch_time} | Diff: ${diff / 1000} sec`
      );

      if (diff <= FIFTY_SEC_MS) {
        // diff < 0 (earlier) OR diff <= 50 seconds
        console.log(
          `⏱ Skipped punch for student ${student.id}, punch_time is before last movement or within 50 seconds`
        );
        return; // ✅ prevent insert
      }
    } else {
      console.log(
        `🕒 Student ${student.id} has no previous movement | Punch time: ${punch.punch_time} (${punchTimeMs})`
      );
    }

    // Determine IN/OUT
    let inTime = null;
    let outTime = null;
    let status = "";
    const deviceDirection = (device.device_direction || "BOTH")
      .trim()
      .toUpperCase();

    if (deviceDirection === "IN") {
      inTime = punch.punch_time;
      status = "IN";
    } else if (deviceDirection === "OUT") {
      outTime = punch.punch_time;
      status = "OUT";
    } else {
      if (!lastMovement || lastMovement.status === "OUT") {
        inTime = punch.punch_time;
        status = "IN";
      } else {
        outTime = punch.punch_time;
        status = "OUT";
      }
    }

    // Insert new movement
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
    emitNewPunch(result?.insertId || punch.id);
    console.log(
      `📡 SOCKET EMIT ID: ${
        result?.insertId || punch.id
      } | SAVED | ${status} | student=${student.id} | device=${
        device.device_sn
      }`
    );
  } catch (err) {
    console.error(`❌ Punch ${punch?.id} failed:`, err.message);
  }
}
