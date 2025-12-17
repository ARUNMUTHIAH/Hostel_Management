import { connectToDevice } from "../services/zkDevice.js";
import db from "../db.js"; // your MySQL connection

export const syncAttendance = async () => {
  try {
    const zk = await connectToDevice();
    if (!zk) return console.log("❌ Device connection failed");

    const logs = await zk.getAttendances();
    if (!logs?.data?.length) return console.log("❌ No attendance logs found");

    for (const log of logs.data) {
      const studentId = log.uid; // student identifier from device
      const punchTime = log.timestamp; // punch timestamp
      const punchState = log.punch_state || log.type; // '0' for IN, '1' for OUT
      const terminalSn = log.terminal_sn || log.terminal_alias || null;
      const area = log.area_alias || null;

      // 1️⃣ Skip if punch_id already exists (to prevent duplicates)
      const [exists] = await db.query(
        `SELECT id FROM studentmovement WHERE punch_id = ?`,
        [log.id]
      );
      if (exists) continue;

      // 2️⃣ Insert each punch as a new row
      if (punchState === "0") {
        // IN punch
        await db.query(
          `INSERT INTO studentmovement 
            (student_id, hostel_id, in_time, status, punch_id, terminal_sn, area_alias, created_at) 
           VALUES (?, ?, ?, 'IN', ?, ?, ?, ?)`,
          [studentId, 1, punchTime, log.id, terminalSn, area, punchTime]
        );
      } else {
        // OUT punch
        await db.query(
          `INSERT INTO studentmovement 
            (student_id, hostel_id, out_time, status, punch_id, terminal_sn, area_alias, created_at) 
           VALUES (?, ?, ?, 'OUT', ?, ?, ?, ?)`,
          [studentId, 1, punchTime, log.id, terminalSn, area, punchTime]
        );
      }

      console.log(`✅ Punch inserted: ID ${log.id} for student ${studentId}`);
    }

    console.log("✔ Attendance sync completed");
  } catch (err) {
    console.error("❌ Attendance sync error:", err.message);
  }
};
