import { db } from "../../config/Database.js";

export const getDashboardData = async (req, res) => {
  const userId = req.user?.userId;
  const roleId = req.user?.roleId;

  try {
    if (!userId) {
      return res.status(401).json({
        status: false,
        issuccess: false,
        message: "Unauthorized - Missing user ID",
      });
    }

    // ROLE CHECK
    const [roleResult] = await db.query("SELECT name FROM roles WHERE id = ?", {
      replacements: [roleId],
    });
    const isSuperAdmin =
      roleResult && roleResult[0]?.name?.toLowerCase() === "superadmin";

    let hostelIds = [];

    // 🔥 If not superadmin, get mapped hostels for user
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

      hostelIds = mappedHostels.map((h) => h.hostel_id);
    }

    // Superadmin sees all → keep hostelIds empty
    const hostelInClause =
      hostelIds.length > 0 ? hostelIds.join(",") : "SELECT id FROM hostel";

    const [totalReg] = await db.query(`
      SELECT COUNT(*) AS total 
      FROM student
      WHERE hostel_id IN (${hostelInClause})
    `);

    const [todayIn] = await db.query(`
      SELECT COUNT(*) AS total
      FROM studentmovement
      WHERE in_time IS NOT NULL
      AND DATE(created_at) = CURDATE()
      AND hostel_id IN (${hostelInClause})
    `);

    const [todayOut] = await db.query(`
      SELECT COUNT(*) AS total
      FROM studentmovement
      WHERE DATE(created_at) = CURDATE()
      AND hostel_id IN (${hostelInClause})
    `);

    const [stillOutside] = await db.query(`
      SELECT COUNT(*) AS total
      FROM studentmovement
      WHERE in_time IS NULL
      AND hostel_id IN (${hostelInClause})
    `);

    const now = new Date();
    const istOffset = 5.5 * 60; // IST offset
    const istTimeObj = new Date(now.getTime() + istOffset * 60 * 1000);
    const istDatetime = istTimeObj
      .toISOString()
      .replace("T", " ")
      .split(".")[0]; // 'YYYY-MM-DD HH:MM:SS'

    const [overdue] = await db.query(
      `
  SELECT COUNT(*) AS total
  FROM studentmovement sm
  JOIN allowedtime atm ON sm.hostel_id = atm.hostel_id AND atm.status = 'Active'
  WHERE sm.in_time IS NULL
    AND DATE(sm.out_time) = CURDATE()
    AND STR_TO_DATE(CONCAT(DATE(sm.out_time), ' ', atm.expected_return_time), '%Y-%m-%d %H:%i:%s') < ?
    AND sm.hostel_id IN (${hostelInClause})
`,
      { replacements: [istDatetime] }
    );

    const overdueStudents = overdue[0].total;

    const [monthly] = await db.query(`
      SELECT MONTH(createdat) AS month, COUNT(*) AS count
      FROM student
      WHERE hostel_id IN (${hostelInClause})
      GROUP BY MONTH(createdat)
    `);
    // Fetch currently outside students (same as report)
    const [outsideStudents] = await db.query(`
  SELECT 
    sm.out_time,
    atm.expected_return_time
  FROM studentmovement sm
  JOIN allowedtime atm ON sm.hostel_id = atm.hostel_id
  WHERE sm.in_time IS NULL
  AND sm.hostel_id IN (${hostelInClause})
`);

    let onTimeCount = 0;
    let nearOverdueCount = 0;
    let overdueCount = 0;

    const nearOverdueThreshold = 10; // same logic as report

    outsideStudents.forEach((std) => {
      const outTime = new Date(std.out_time);
      const expectedDt = new Date(
        `${std.out_time.toISOString().slice(0, 10)} ${std.expected_return_time}`
      );

      const diffMinutes = Math.floor((expectedDt - now) / 60000);

      if (diffMinutes < 0) {
        overdueCount++;
      } else if (diffMinutes <= nearOverdueThreshold) {
        nearOverdueCount++;
      } else {
        onTimeCount++;
      }
    });

    const currentOutsideDistribution = {
      onTimeCount,
      nearOverdueCount,
      overdueCount,
    };

    const [lifecycleDayWise] = await db.query(`
      SELECT status, COUNT(*) AS count
      FROM studentmovement
      WHERE DATE(out_time) = CURDATE()
      AND hostel_id IN (${hostelInClause})
      GROUP BY status
    `);

    const lifecycleStatusDayWise = [
      {
        label: "IN",
        value: lifecycleDayWise.find((x) => x.status === "IN")?.count || 0,
      },
      {
        label: "OUT",
        value: lifecycleDayWise.find((x) => x.status === "OUT")?.count || 0,
      },
    ];

    const [lifecycleMonthWise] = await db.query(`
      SELECT MONTH(out_time) AS month, status, COUNT(*) AS count
      FROM studentmovement
      WHERE MONTH(out_time) = MONTH(CURDATE())
      AND hostel_id IN (${hostelInClause})
      GROUP BY MONTH(out_time), status
    `);

    const lifecycleStatusMonthWise = lifecycleMonthWise.map((item) => ({
      month: item.month,
      status: item.status,
      count: item.count,
    }));

    const [locations] = await db.query(`
      SELECT h.name AS name, COUNT(s.memberid) AS count
      FROM hostel h
      LEFT JOIN student s ON s.hostel_id = h.id
      WHERE h.id IN (${hostelInClause})
      GROUP BY h.id
    `);

    return res.json({
      status: true,
      issuccess: true,
      data: {
        inStudent: todayIn[0].total,
        outStudent: todayOut[0].total,
        totalRegisteredStudent: totalReg[0].total,
        studentStillOutside: stillOutside[0].total,
        OverdueStudentsOutside: overdueStudents,
        currentOutsideDistribution,
        lifecycleStatus: {
          dayWise: lifecycleStatusDayWise,
          monthWise: lifecycleStatusMonthWise,
        },
        monthlyDistribution: monthly,
        locationDistribution: locations,
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
