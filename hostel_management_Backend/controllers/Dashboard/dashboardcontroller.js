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

    const hostelInClause =
      hostelIds.length > 0
        ? `IN (${hostelIds.join(",")})`
        : "IN (SELECT id FROM hostel)";

    // ========================= CARDS =========================

    const [[totalReg]] = await db.query(`
      SELECT COUNT(*) AS total 
      FROM student
      WHERE hostel_id ${hostelInClause}
    `);

    const [[todayIn]] = await db.query(`
      SELECT COUNT(*) AS total
      FROM studentmovement
      WHERE in_time IS NOT NULL
        AND DATE(in_time) = CURDATE()
        AND hostel_id ${hostelInClause}
    `);

    const [[todayOut]] = await db.query(`
      SELECT COUNT(*) AS total
      FROM studentmovement
      WHERE out_time IS NOT NULL
        AND DATE(out_time) = CURDATE()
        AND hostel_id ${hostelInClause}
    `);

    const [[stillOutside]] = await db.query(`
  SELECT COUNT(*) AS total
  FROM studentmovement sm
  JOIN (
      SELECT student_id, MAX(created_at) AS latest_created
      FROM studentmovement
      GROUP BY student_id
  ) AS latest ON latest.student_id = sm.student_id AND latest.latest_created = sm.created_at
  WHERE sm.out_time IS NOT NULL
    AND sm.in_time IS NULL
    AND sm.hostel_id ${hostelInClause}
`);

    // ========================= OVERDUE =========================

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
  JOIN allowedtime atm
    ON sm.hostel_id = atm.hostel_id
   AND atm.status = 'Active'
  JOIN (
      SELECT student_id, MAX(created_at) AS latest_created
      FROM studentmovement
      GROUP BY student_id
  ) AS latest ON latest.student_id = sm.student_id AND latest.latest_created = sm.created_at
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

    // ========================= OUTSIDE DISTRIBUTION (Latest Punch Based) =========================

    const [outsideStudents] = await db.query(`
  SELECT sm.out_time, atm.expected_return_time
  FROM studentmovement sm
  JOIN allowedtime atm ON sm.hostel_id = atm.hostel_id
  JOIN (
      SELECT student_id, MAX(created_at) AS latest_created
      FROM studentmovement
      GROUP BY student_id
  ) AS latest ON latest.student_id = sm.student_id AND latest.latest_created = sm.created_at
  WHERE sm.out_time IS NOT NULL
    AND sm.in_time IS NULL
    AND sm.hostel_id ${hostelInClause}
`);

    let onTimeCount = 0;
    let nearOverdueCount = 0;
    let overdueCount = 0;
    const nearOverdueThreshold = 10;

    outsideStudents.forEach((std) => {
      const expectedDt = new Date(
        `${std.out_time.toISOString().slice(0, 10)} ${std.expected_return_time}`
      );

      const diffMinutes = Math.floor((expectedDt - now) / 60000);

      if (diffMinutes < 0) overdueCount++;
      else if (diffMinutes <= nearOverdueThreshold) nearOverdueCount++;
      else onTimeCount++;
    });

    // ========================= LIFECYCLE (FIXED) =========================

    // DAY WISE
    const [[dayIn]] = await db.query(`
      SELECT COUNT(*) AS total
      FROM studentmovement
      WHERE in_time IS NOT NULL
        AND out_time IS NULL
        AND DATE(in_time) = CURDATE()
        AND hostel_id ${hostelInClause}
    `);

    const [[dayOut]] = await db.query(`
      SELECT COUNT(*) AS total
      FROM studentmovement
      WHERE out_time IS NOT NULL
        AND in_time IS NULL
        AND DATE(out_time) = CURDATE()
        AND hostel_id ${hostelInClause}
    `);

    const lifecycleStatusDayWise = [
      { label: "IN", value: dayIn.total },
      { label: "OUT", value: dayOut.total },
    ];

    // MONTH WISE
    const [monthWiseRaw] = await db.query(`
      SELECT MONTH(dt) AS month, type AS status, COUNT(*) AS count
      FROM (
        SELECT in_time AS dt, 'IN' AS type, hostel_id
        FROM studentmovement
        WHERE in_time IS NOT NULL AND out_time IS NULL

        UNION ALL

        SELECT out_time AS dt, 'OUT' AS type, hostel_id
        FROM studentmovement
        WHERE out_time IS NOT NULL AND in_time IS NULL
      ) x
      WHERE MONTH(dt) = MONTH(CURDATE())
        AND hostel_id ${hostelInClause}
      GROUP BY MONTH(dt), type
    `);

    const lifecycleStatusMonthWise = monthWiseRaw.map((r) => ({
      month: r.month,
      status: r.status,
      count: r.count,
    }));

    // ========================= OTHER =========================

    const [monthly] = await db.query(`
      SELECT MONTH(createdat) AS month, COUNT(*) AS count
      FROM student
      WHERE hostel_id ${hostelInClause}
      GROUP BY MONTH(createdat)
    `);

    const [locations] = await db.query(`
      SELECT h.name AS name, COUNT(s.memberid) AS count
      FROM hostel h
      LEFT JOIN student s ON s.hostel_id = h.id
      WHERE h.id ${hostelInClause}
      GROUP BY h.id
    `);

    // ========================= RESPONSE =========================

    return res.json({
      status: true,
      issuccess: true,
      data: {
        inStudent: todayIn.total,
        outStudent: todayOut.total,
        totalRegisteredStudent: totalReg.total,
        studentStillOutside: stillOutside.total,
        OverdueStudentsOutside: overdue.total,
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
