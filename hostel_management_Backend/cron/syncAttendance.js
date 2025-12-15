import { connectToDevice } from "../services/zkDevice.js";
import db from "../db.js"; // your MySQL connection file

export const syncAttendance = async () => {
  try {
    const zk = await connectToDevice();
    if (!zk) return;

    const logs = await zk.getAttendances();

    for (const log of logs.data) {
      const studentId = log.uid;
      const punchTime = log.timestamp;

      // Check last record of this student
      const [last] = await db.query(
        "SELECT status FROM studentmovement WHERE student_id = ? ORDER BY id DESC LIMIT 1",
        [studentId]
      );

      if (!last || last.status === "IN") {
        // New OUT punch
        await db.query(
          `INSERT INTO studentmovement (student_id, hostel_id, out_time, status) VALUES (?, ?, ?, 'OUT')`,
          [studentId, 1, punchTime] // replace hostel_id if dynamic
        );
      } else {
        // Student comes IN
        await db.query(
          `UPDATE studentmovement SET in_time = ?, status = 'IN' WHERE student_id = ? AND status = 'OUT' ORDER BY id DESC LIMIT 1`,
          [punchTime, studentId]
        );
      }
    }

    console.log("✔ Attendance synced");
  } catch (err) {
    console.log("❌ Attendance sync error:", err);
  }
};
