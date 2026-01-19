import axios from "axios";
import { db } from "../../config/Database.js";
import { getEasyTimeToken } from "../../Utils/easytime.js";
import { getEASYTIMEURL } from "../../Utils/EASYTIME_URL.js";
import dayjs from "dayjs";

/* ==================== EASYTIME TERMINALS FETCH ==================== */
const fetchEasyTimeDevices = async (userId) => {
  try {
    const token = await getEasyTimeToken(userId);
    const EASYTIME_URL = await getEASYTIMEURL(userId);

    const response = await axios.get(`${EASYTIME_URL}/iclock/api/terminals/`, {
      headers: {
        Authorization: `Token ${token}`,
      },
    });

    return response.data?.data || [];
  } catch (err) {
    console.error("EasyTime terminal fetch failed:", err.message);
    return []; // fail-safe
  }
};

export const getDashboardData = async (req, res) => {
  const userId = req.user?.userId;
  const roleId = req.user?.roleId;
  const selectedHostelId = req.query.hostel_id; // hostel filter from frontend

  try {
    if (!userId) {
      return res.status(401).json({
        status: false,
        issuccess: false,
        message: "Unauthorized - Missing user ID",
      });
    }

    // ==================== ROLE CHECK ====================
    const [roleResult] = await db.query("SELECT name FROM roles WHERE id = ?", {
      replacements: [roleId],
    });
    const isSuperAdmin =
      roleResult && roleResult[0]?.name?.toLowerCase() === "superadmin";

    // ==================== HOSTEL FILTER ====================
    let hostelIds = [];

    if (!isSuperAdmin) {
      const [mappedHostels] = await db.query(
        `SELECT hostel_id FROM userhostelmap WHERE users_id = ?`,
        { replacements: [userId] }
      );

      if (mappedHostels.length === 0) {
        return res.json({
          status: true,
          issuccess: true,
          message: "No hostel mapped to this user",
          data: {},
        });
      }

      const mappedIds = mappedHostels.map((h) => h.hostel_id);

      if (selectedHostelId) {
        if (!mappedIds.includes(Number(selectedHostelId))) {
          return res.status(403).json({
            status: false,
            message: "Unauthorized hostel access",
          });
        }
        hostelIds = [selectedHostelId];
      } else {
        hostelIds = mappedIds;
      }
    } else {
      hostelIds = selectedHostelId ? [selectedHostelId] : [];
    }

    const hostelInClause =
      hostelIds.length > 0
        ? `IN (${hostelIds.join(",")})`
        : "IN (SELECT id FROM hostel)";

    // ==================== STUDENT EXISTENCE CHECK ====================
    const [[studentCount]] = await db.query(`
      SELECT COUNT(*) AS total FROM student
      ${selectedHostelId ? "WHERE hostel_id = " + selectedHostelId : ""}
    `);

    const validStudentsExist = studentCount.total > 0;

    // ==================== CARDS ====================
    const [[totalReg]] = await db.query(`
      SELECT COUNT(*) AS total 
      FROM student
      WHERE hostel_id ${hostelInClause}
    `);

    const [[todayIn]] = await db.query(`
      SELECT COUNT(*) AS total
      FROM studentmovement sm
      INNER JOIN student s ON s.id = sm.student_id
      WHERE sm.in_time IS NOT NULL
        AND DATE(sm.in_time) = CURDATE()
        AND sm.hostel_id ${hostelInClause}
    `);

    const [[todayOut]] = await db.query(`
      SELECT COUNT(*) AS total
      FROM studentmovement sm
      INNER JOIN student s ON s.id = sm.student_id
      WHERE sm.out_time IS NOT NULL
        AND DATE(sm.out_time) = CURDATE()
        AND sm.hostel_id ${hostelInClause}
    `);

    const [[stillOutside]] = await db.query(`
      SELECT COUNT(*) AS total
      FROM studentmovement sm
      INNER JOIN student s ON s.id = sm.student_id
      JOIN (
          SELECT student_id, MAX(created_at) AS latest_created
          FROM studentmovement
          GROUP BY student_id
      ) AS latest
        ON latest.student_id = sm.student_id
       AND latest.latest_created = sm.created_at
      WHERE sm.out_time IS NOT NULL
        AND sm.in_time IS NULL
        AND DATE(sm.out_time) = CURDATE()
        AND sm.hostel_id ${hostelInClause}
    `);

    // ==================== OVERDUE ====================
    const now = new Date();
    const istOffset = 5.5 * 60;
    const istTimeObj = new Date(now.getTime() + istOffset * 60000);
    const istDatetime = istTimeObj
      .toISOString()
      .replace("T", " ")
      .split(".")[0];

    const [[overdue]] = await db.query(
      `
      SELECT COUNT(*) AS total
      FROM studentmovement sm
      INNER JOIN student s ON s.id = sm.student_id
      JOIN allowedtime atm
        ON sm.hostel_id = atm.hostel_id
       AND atm.status = 'Active'
      JOIN (
          SELECT student_id, MAX(created_at) AS latest_created
          FROM studentmovement
          GROUP BY student_id
      ) AS latest
        ON latest.student_id = sm.student_id
       AND latest.latest_created = sm.created_at
      WHERE sm.out_time IS NOT NULL
        AND sm.in_time IS NULL
        AND DATE(sm.out_time) = CURDATE()
        AND STR_TO_DATE(
          CONCAT(DATE(sm.out_time), ' ', atm.expected_return_time),
          '%Y-%m-%d %H:%i:%s'
        ) < ?
        AND sm.hostel_id ${hostelInClause}
    `,
      { replacements: [istDatetime] }
    );

    // ==================== OUTSIDE DISTRIBUTION ====================
    let onTimeCount = 0;
    let nearOverdueCount = 0;
    let overdueCount = 0;

    if (validStudentsExist) {
      const [outsideStudents] = await db.query(`
        SELECT sm.out_time, atm.expected_return_time
        FROM studentmovement sm
        INNER JOIN student s ON s.id = sm.student_id
        JOIN allowedtime atm ON sm.hostel_id = atm.hostel_id
        JOIN (
            SELECT student_id, MAX(created_at) AS latest_created
            FROM studentmovement
            GROUP BY student_id
        ) AS latest
          ON latest.student_id = sm.student_id
         AND latest.latest_created = sm.created_at
        WHERE sm.out_time IS NOT NULL
          AND sm.in_time IS NULL
          AND sm.hostel_id ${hostelInClause}
      `);

      const nearOverdueThreshold = 10;

      outsideStudents.forEach((std) => {
        const expectedDt = new Date(
          `${std.out_time.toISOString().slice(0, 10)} ${
            std.expected_return_time
          }`
        );

        const diffMinutes = Math.floor((expectedDt - now) / 60000);

        if (diffMinutes < 0) overdueCount++;
        else if (diffMinutes <= nearOverdueThreshold) nearOverdueCount++;
        else onTimeCount++;
      });
    } else {
      overdueCount = 0;
      nearOverdueCount = 0;
      onTimeCount = 0;
    }

    // ==================== LIFECYCLE ====================
    const [[dayIn]] = await db.query(`
  SELECT COUNT(*) AS total
  FROM studentmovement sm
  INNER JOIN student s ON s.id = sm.student_id
  WHERE sm.in_time IS NOT NULL
    AND sm.out_time IS NULL
    AND DATE(sm.in_time) = CURDATE()
    AND sm.hostel_id ${hostelInClause}
`);

    const [[dayOut]] = await db.query(`
  SELECT COUNT(*) AS total
  FROM studentmovement sm
  INNER JOIN student s ON s.id = sm.student_id
  WHERE sm.out_time IS NOT NULL
    AND sm.in_time IS NULL
    AND DATE(sm.out_time) = CURDATE()
    AND sm.hostel_id ${hostelInClause}
`);

    const lifecycleStatusDayWise = [
      { label: "IN", value: validStudentsExist ? dayIn.total : 0 },
      { label: "OUT", value: validStudentsExist ? dayOut.total : 0 },
    ];

    // ==================== MONTHLY LIFECYCLE ====================
    let lifecycleStatusMonthWise = [];

    if (validStudentsExist) {
      const [monthInData] = await db.query(`
    SELECT MONTH(sm.in_time) AS month, COUNT(*) AS inCount
    FROM studentmovement sm
    WHERE sm.in_time IS NOT NULL
      AND sm.hostel_id ${hostelInClause}
      AND YEAR(sm.in_time) = YEAR(CURDATE())
    GROUP BY MONTH(sm.in_time)
  `);

      const [monthOutData] = await db.query(`
    SELECT MONTH(sm.out_time) AS month, COUNT(*) AS outCount
    FROM studentmovement sm
    WHERE sm.out_time IS NOT NULL
      AND sm.hostel_id ${hostelInClause}
      AND YEAR(sm.out_time) = YEAR(CURDATE())
    GROUP BY MONTH(sm.out_time)
  `);

      // Prepare array for all 12 months
      lifecycleStatusMonthWise = Array.from({ length: 12 }, (_, i) => {
        const monthNumber = i + 1;
        const inRecord = monthInData.find((m) => m.month === monthNumber);
        const outRecord = monthOutData.find((m) => m.month === monthNumber);
        return {
          month: monthNumber,
          IN: inRecord ? inRecord.inCount : 0,
          OUT: outRecord ? outRecord.outCount : 0,
        };
      });
    }

    const [monthly] = await db.query(
      `SELECT MONTH(createdat) AS month, COUNT(*) AS count
       FROM student
       WHERE hostel_id ${hostelInClause}
       GROUP BY MONTH(createdat)`
    );

    const [locations] = await db.query(
      `SELECT h.name, COUNT(s.id) AS count
           FROM hostel h
           LEFT JOIN student s ON s.hostel_id = h.id
           WHERE h.id ${hostelInClause}
           GROUP BY h.id`
    );

    // ==================== MAPPED HOSTELS ====================
    let mappedHostelList = [];
    if (isSuperAdmin) {
      const [allHostels] = await db.query(`
        SELECT id, name AS hostel_name
        FROM hostel
      `);
      mappedHostelList = allHostels;
    } else {
      const [userHostels] = await db.query(
        `
        SELECT h.id, h.name AS hostel_name
        FROM hostel h
        INNER JOIN userhostelmap uhm ON uhm.hostel_id = h.id
        WHERE uhm.users_id = ?
      `,
        { replacements: [userId] }
      );
      mappedHostelList = userHostels;
    }

    /* ==================== EASYTIME DEVICES ==================== */
    const easyTimeDevices = await fetchEasyTimeDevices(userId);

    console.log("EasyTime Devices:", easyTimeDevices);

    const [allDevices] = await db.query(
      `
  SELECT 
    id,
    device_ip,
    device_name,
    hostel_id,
    last_activity
  FROM biometric_devices
  ${hostelIds.length ? `WHERE hostel_id IN (${hostelIds.join(",")})` : ""}
  `
    );

    const HEARTBEAT_SECONDS = 180;

    const biometricDevices = allDevices.map((dbDevice) => {
      const easyDevice = easyTimeDevices.find(
        (ed) => ed.ip_address === dbDevice.device_ip
      );

      let power_status = "Disconnected";

      if (easyDevice?.last_activity) {
        const now = dayjs();
        const last = dayjs(easyDevice.last_activity);

        const diffSeconds = now.diff(last, "second");

        if (diffSeconds <= HEARTBEAT_SECONDS) {
          power_status = "Connected";
        }
      }

      return {
        ...dbDevice,
        power_status,
        last_activity: easyDevice?.last_activity || dbDevice.last_activity,
      };
    });

    // ==================== FINAL RESPONSE ====================
    return res.json({
      status: true,
      issuccess: true,
      data: {
        inStudent: todayIn.total,
        outStudent: todayOut.total,
        totalRegisteredStudent: totalReg.total,
        studentStillOutside: stillOutside.total,
        OverdueStudentsOutside: validStudentsExist ? overdue.total : 0,
        currentOutsideDistribution: {
          onTimeCount,
          nearOverdueCount,
          overdueCount,
        },
        lifecycleStatus: {
          dayWise: lifecycleStatusDayWise,
          monthWise: lifecycleStatusMonthWise,
        },
        monthlyDistribution: monthly,
        locationDistribution: locations,
        mappedHostels: mappedHostelList,
        biometricDevices,
      },
    });
  } catch (err) {
    console.log(err);
    return res.status(500).json({
      status: false,
      issuccess: false,
      message: "Dashboard error",
      error: err.message,
    });
  }
};
