// cron/dashboardAllowedTimeCron.js
import cron from "node-cron";
import { emitNewPunch } from "../../index.js";
import { db } from "../../config/Database.js";

const dashboardEmitTracker = new Map();

cron.schedule("* * * * *", async () => {
  try {
    const currentIST = new Date(
      new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" })
    );

    const currentHHMM = currentIST.toTimeString().slice(0, 5);

    const [allowedTimes] = await db.query(`
      SELECT hostel_id, expected_return_time
      FROM allowedtime
      WHERE status = 'Active'
    `);

    for (const row of allowedTimes) {
      const expectedHHMM = row.expected_return_time.slice(0, 5);
      const emitKey = `${row.hostel_id}_${currentHHMM}`;

      if (expectedHHMM === currentHHMM && !dashboardEmitTracker.has(emitKey)) {
        dashboardEmitTracker.set(emitKey, Date.now());

        emitNewPunch({
          hostel_id: row.hostel_id,
          type: "dashboard_allowed_time_trigger",
        });

        console.log("⏰ dashboard_allowed_time_trigger emitted:", emitKey);

        setTimeout(() => {
          dashboardEmitTracker.delete(emitKey);
        }, 2 * 60 * 1000);
      }
    }
  } catch (err) {
    console.error("❌ Dashboard cron error:", err.message);
  }
});
