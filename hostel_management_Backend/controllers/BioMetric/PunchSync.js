import axios from "axios";
import dotenv from "dotenv";
import sequelize from "../config/db.js";

dotenv.config();

let lastPunchId = 0; // global variable

// 1) Get last punch id from DB (only once at start)
export const getLastPunchFromDB = async () => {
  try {
    const [result] = await sequelize.query(
      `SELECT punch_id FROM last_punch ORDER BY id DESC LIMIT 1`
    );
    if (result.length > 0) lastPunchId = result[0].punch_id;
    console.log("Last Punch ID at Startup:", lastPunchId);
  } catch (error) {
    console.error("❌ Error fetching last punch ID:", error.message);
  }
};

// 2) Save last punch id in DB
const saveLastPunchInDB = async (punchId) => {
  await sequelize.query(`INSERT INTO last_punch (punch_id) VALUES (:punchId)`, {
    replacements: { punchId },
  });
  lastPunchId = punchId;
};

// 3) Main sync function
export const syncPunchLogs = async () => {
  try {
    const punchUrl = `${process.env.PUNCH_API}/api/attlog?last_id=${lastPunchId}`;
    const response = await axios.get(punchUrl);
    const logs = response.data?.data || [];

    if (logs.length === 0) return;

    console.log(`🔔 New Logs Received: ${logs.length}`);
    // console.log(logs);  // REMOVE this if DB becomes large

    for (const punch of logs) {
      await sequelize.query(
        `INSERT INTO punch_logs (
            id, emp_code, punch_time, punch_state, verify_type, work_code,
            terminal_sn, terminal_alias, area_alias, longitude, latitude,
            gps_location, mobile, source, purpose, crc, is_attendance,
            reserved, upload_time, sync_status, sync_time, temperature,
            mask_flag, company, emp, terminal
        )
        VALUES (
            :id, :emp_code, :punch_time, :punch_state, :verify_type, :work_code,
            :terminal_sn, :terminal_alias, :area_alias, :longitude, :latitude,
            :gps_location, :mobile, :source, :purpose, :crc, :is_attendance,
            :reserved, :upload_time, :sync_status, :sync_time, :temperature,
            :mask_flag, :company, :emp, :terminal
        )`,
        { replacements: punch }
      );
    }

    const maxPunchId = logs[logs.length - 1].id;
    await saveLastPunchInDB(maxPunchId);
    console.log("✔ Sync Completed. Updated Last Punch ID:", maxPunchId);
  } catch (error) {
    console.error("❌ Error syncing punch logs:", error.message);
  }
};
