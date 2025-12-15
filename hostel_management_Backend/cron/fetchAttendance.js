import { connectToDevice } from "../services/zkDeviceService.js";
import db from "../db.js"; // your database connection

export const fetchAttendance = async () => {
  try {
    const zk = await connectToDevice();
    if (!zk) return;

    const logs = await zk.getAttendances();

    for (const log of logs.data) {
      const userId = log?.uid;
      const punchTime = log?.timestamp;

      // Insert only new logs
      await db.query(
        "INSERT IGNORE INTO movements (student_id, punch_time) VALUES (?, ?)",
        [userId, punchTime]
      );
    }

    console.log("✔ Attendance synced from device");
  } catch (err) {
    console.error("❌ Attendance sync failed:", err);
  }
};
