import { db } from "../../config/Database.js";

export const getDashboardData = async (req, res) => {
  try {
    // 1. Total Registered Students
    const [totalReg] = await db.query(`
      SELECT COUNT(*) AS total 
      FROM student
    `);

    // 2. Students who returned today
    // 1. Students who returned today (IN) based on movement creation
    const [todayIn] = await db.query(`
  SELECT COUNT(*) AS total
  FROM studentmovement
  WHERE in_time IS NOT NULL
    AND DATE(created_at) = CURDATE()
`);

    // 2. Students who went out today (OUT) based on movement creation
    const [todayOut] = await db.query(`
  SELECT COUNT(*) AS total
  FROM studentmovement
  WHERE DATE(created_at) = CURDATE()
`);

    // 2. Students OUT/IN based on studentmovement table (today)
    const [lifecycle] = await db.query(`
      SELECT 
        SUM(CASE WHEN sm.status = 'IN' THEN 1 ELSE 0 END) AS inCount,
        SUM(CASE WHEN sm.status = 'OUT' THEN 1 ELSE 0 END) AS outCount
      FROM studentmovement sm
      WHERE DATE(sm.out_time) = CURDATE()
    `);

    // 3. Still Outside
    const [stillOutside] = await db.query(`
  SELECT COUNT(*) AS total
  FROM studentmovement
  WHERE in_time IS NULL
`);

    // 4. Overdue Students
    const [overdue] = await db.query(`
 SELECT COUNT(*) AS total
FROM studentmovement sm
JOIN allowedtime atm ON sm.hostel_id = atm.hostel_id
WHERE sm.in_time IS NULL
  AND NOW() > CONCAT(DATE(sm.out_time), ' ', atm.expected_return_time);

`);

    const overdueStudents = overdue[0].total;

    // 5. Monthly Registration (Line Chart)
    const [monthly] = await db.query(`
      SELECT MONTH(createdat) AS month, COUNT(*) AS count
      FROM student
      GROUP BY MONTH(createdat)
    `);

    // 6. Current Outside Distribution (Day-wise)
    const [outsideDistribution] = await db.query(`
 SELECT
    SUM(CASE WHEN sm.in_time IS NOT NULL THEN 1 ELSE 0 END) AS inTimeCount,
    SUM(CASE WHEN sm.in_time IS NULL 
             AND TIMESTAMPDIFF(MINUTE, sm.out_time, NOW()) <= atm.maximum_delay
             THEN 1 ELSE 0 END) AS outTimeCount,
    SUM(CASE WHEN sm.in_time IS NULL 
             AND TIMESTAMPDIFF(MINUTE, sm.out_time, NOW()) > atm.maximum_delay
             THEN 1 ELSE 0 END) AS overdueCount
FROM studentmovement sm
JOIN allowedtime atm ON sm.hostel_id = atm.hostel_id;

`);

    const currentOutsideDistribution = {
      inTimeCount: outsideDistribution[0].inTimeCount,
      outTimeCount: outsideDistribution[0].outTimeCount,
      overdueCount: outsideDistribution[0].overdueCount,
    };

    // 7. Lifecycle Status (Day-wise & Month-wise)
    // Day-wise
    const [lifecycleDayWise] = await db.query(`
      SELECT status, COUNT(*) AS count
      FROM studentmovement
      WHERE DATE(out_time) = CURDATE()
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

    // Month-wise
    const [lifecycleMonthWise] = await db.query(`
      SELECT MONTH(out_time) AS month, status, COUNT(*) AS count
      FROM studentmovement
      WHERE MONTH(out_time) = MONTH(CURDATE())
      GROUP BY MONTH(out_time), status
    `);

    const lifecycleStatusMonthWise = lifecycleMonthWise.map((item) => ({
      month: item.month,
      status: item.status,
      count: item.count,
    }));

    // 8. Location Distribution
    const [locations] = await db.query(`
      SELECT 
        h.name AS name, 
        COUNT(s.memberid) AS count
      FROM hostel h
      LEFT JOIN student s 
            ON s.hostel_id = h.id
      GROUP BY h.id
    `);

    return res.json({
      status: true,
      issuccess: true,
      data: {
        inStudent: todayIn[0].total, // today IN
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
