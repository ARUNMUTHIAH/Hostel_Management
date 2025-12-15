import axios from "axios";
import { db } from "../../config/Database.js";
import { getEasyTimeToken } from "../../Utils/easytime.js";

export async function syncMovement() {
  try {
    // Get all active devices from DB
    const devices = await db.query(
      "SELECT id, server_ip, port FROM biometric_devices WHERE status = 'Active'",
      { type: db.QueryTypes.SELECT }
    );

    if (!devices.length) {
      console.log("❌ No biometric devices found");
      return;
    }

    for (const dev of devices) {
      const EASYTIME_URL = `http://${dev.server_ip}:${dev.port}`;
      console.log(`🔄 Syncing from ${EASYTIME_URL}`);

      let token = null;
      try {
        // Force login using this IP — pass URL manually
        token = await getEasyTimeToken(null, EASYTIME_URL);
      } catch (e) {
        console.log(`⚠ Token failed — Device offline: ${EASYTIME_URL}`);
        continue;
      }

      // Get last punch per device
      const tracker = await db.query(
        `SELECT last_punch_id FROM sync_tracker WHERE device_id = :did`,
        { replacements: { did: dev.id }, type: db.QueryTypes.SELECT }
      );
      let lastId = tracker?.[0]?.last_punch_id ?? 0;

      let pageUrl = `${EASYTIME_URL}/iclock/api/transactions/?page=1`;
      let newPunchFound = false;

      while (pageUrl) {
        const res = await axios.get(pageUrl, {
          headers: { Authorization: `Token ${token}` },
        });

        const logs = res.data?.data || [];
        const next = res.data?.next;

        const newLogs = logs.filter((l) => l.id > lastId);

        for (const log of newLogs) {
          const { id, emp_code, punch_time, punch_state, upload_time } = log;

          const [student] = await db.query(
            "SELECT id, hostel_id FROM student WHERE memberid = :code",
            { replacements: { code: emp_code }, type: db.QueryTypes.SELECT }
          );
          if (!student) continue;

          const [exists] = await db.query(
            "SELECT id FROM studentmovement WHERE punch_id = :pid",
            { replacements: { pid: id }, type: db.QueryTypes.SELECT }
          );
          if (exists) continue;

          const [lastMovement] = await db.query(
            `SELECT id, in_time, out_time
             FROM studentmovement WHERE student_id = :sid
             ORDER BY id DESC LIMIT 1`,
            { replacements: { sid: student.id }, type: db.QueryTypes.SELECT }
          );

          if (punch_state == "0") {
            // IN punch
            if (lastMovement && !lastMovement.in_time) {
              await db.query(
                `UPDATE studentmovement SET in_time = :t, status = 'IN', punch_id = :pid WHERE id = :mid`,
                {
                  replacements: {
                    t: punch_time,
                    pid: id,
                    mid: lastMovement.id,
                  },
                }
              );
            } else {
              await db.query(
                `INSERT INTO studentmovement (student_id, hostel_id, in_time, status, punch_id)
                 VALUES (:sid, :hid, :t, 'IN', :pid)`,
                {
                  replacements: {
                    sid: student.id,
                    hid: student.hostel_id,
                    t: punch_time,
                    pid: id,
                  },
                }
              );
            }
          } else {
            // OUT punch
            if (lastMovement && !lastMovement.out_time) {
              await db.query(
                `UPDATE studentmovement SET out_time = :t, status = 'OUT', punch_id = :pid WHERE id = :mid`,
                {
                  replacements: {
                    t: upload_time,
                    pid: id,
                    mid: lastMovement.id,
                  },
                }
              );
            } else {
              await db.query(
                `INSERT INTO studentmovement (student_id, hostel_id, out_time, status, punch_id)
                 VALUES (:sid, :hid, :t, 'OUT', :pid)`,
                {
                  replacements: {
                    sid: student.id,
                    hid: student.hostel_id,
                    t: punch_time,
                    pid: id,
                  },
                }
              );
            }
          }

          lastId = id;
          newPunchFound = true;

          // Update tracker by device
          await db.query(
            `INSERT INTO sync_tracker (device_id, last_punch_id)
             VALUES (:did, :pid)
             ON DUPLICATE KEY UPDATE last_punch_id = :pid`,
            { replacements: { did: dev.id, pid: id } }
          );
        }

        pageUrl = next;
      }

      if (!newPunchFound) console.log(`⏺ No new punches for ${EASYTIME_URL}`);
      else console.log(`✔ Sync completed for ${EASYTIME_URL}`);
    }
  } catch (err) {
    console.error("🔥 Sync Error:", err.message);
  }
}
