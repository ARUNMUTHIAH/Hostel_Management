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
    const MIN_MS = 60 * 1000;

    const [student] = await db.query(
      `SELECT id, hostel_id FROM student WHERE memberid = :code`,
      { replacements: { code: punch.emp_code }, type: db.QueryTypes.SELECT }
    );
    if (!student) return;

    const [exists] = await db.query(
      `SELECT id FROM studentmovement WHERE punch_id = :pid`,
      { replacements: { pid: punch.id }, type: db.QueryTypes.SELECT }
    );
    if (exists) return;

    const last = lastAcceptedPunch[student.id];

    if (
      last &&
      last.terminal_sn === punch.terminal_sn &&
      punchTimeMs - last.time <= MIN_MS
    ) {
      return;
    }

    const [lastMovement] = await db.query(
      `SELECT id, status FROM studentmovement
       WHERE student_id = :sid
       ORDER BY id DESC LIMIT 1`,
      { replacements: { sid: student.id }, type: db.QueryTypes.SELECT }
    );

    let inTime = null;
    let outTime = null;
    let status = "";

    /* =====================================================
       🔥 FINAL DEVICE DIRECTION FIX
    ===================================================== */

    const deviceDirection = (device.device_direction || "BOTH")
      .trim()
      .toUpperCase();

    if (deviceDirection === "IN") {
      // ✅ FORCE IN
      inTime = punch.punch_time;
      status = "IN";
    } else if (deviceDirection === "OUT") {
      // ✅ FORCE OUT
      outTime = punch.punch_time;
      status = "OUT";
    } else {
      // 🔁 BOTH — your existing logic (unchanged)
      if (!lastMovement) {
        outTime = punch.punch_time;
        status = "OUT";
      } else if (lastMovement.status === "OUT") {
        inTime = punch.punch_time;
        status = "IN";
      } else {
        outTime = punch.punch_time;
        status = "OUT";
      }
    }

    const [_, meta] = await db.query(
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

    const insertId = meta;

    emitNewPunch(insertId);
    console.log("📡 SOCKET EMIT ID:", insertId);

    console.log(
      `✅ SAVED | ${status} | student=${student.id} | device=${device.device_sn}`
    );
  } catch (err) {
    console.error(`❌ Punch ${punch?.id} failed:`, err.message);
  }
}
