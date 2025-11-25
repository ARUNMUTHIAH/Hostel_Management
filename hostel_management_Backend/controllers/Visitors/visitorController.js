import { db } from "../../config/Database.js";

// ✅ Get current IST DateTime
export const getCurrentISTDate = () => {
  const now = new Date();
  const istTime = new Date(now.getTime() + 5.5 * 60 * 60 * 1000);
  return istTime.toISOString().replace("T", " ").substring(0, 19);
};

// ✅ Add New Visitor Vehicle
export const addVisitorVehicle = async (req, res) => {
  try {
    const {
      vehicleno,
      drivername,
      mobile,
      company,
      purpose,
      visiting_person,
      location,
      rfid_tag,
      status,
      validity,
    } = req.body;

    // ✅ Required field validation
    if (
      !drivername ||
      !mobile ||
      !purpose ||
      !location ||
      !validity
      // !rfid_tag
    ) {
      return res.status(400).json({
        status: false,
        message: "Please fill all required fields",
      });
    }

    // ✅ RFID validation: must be exactly 24 characters
    if (rfid_tag.length !== 24) {
      return res.status(400).json({
        status: false,
        message: "RFID Tag must be exactly 24 characters long",
      });
    }

    // ✅ Vehicle number validation (Indian format e.g., TN10AB1234)
    if (vehicleno && !/^[A-Z]{2}\d{1,2}[A-Z]{1,2}\d{3,4}$/i.test(vehicleno)) {
      return res.status(400).json({
        status: false,
        message: "Invalid vehicle number format (e.g., TN10AB1234)",
      });
    }

    // ✅ Mobile number validation: must be 10 digits
    if (!/^\d{10}$/.test(mobile)) {
      return res.status(400).json({
        status: false,
        message: "Mobile number must be exactly 10 digits",
      });
    }

    // ✅ RFID tag re-use validation
    const [rfidCheck] = await db.query(
      `
      SELECT id, status 
      FROM visitor_vehicles
      WHERE rfid_tag = :rfid_tag
      ORDER BY id DESC
      LIMIT 1;
      `,
      { replacements: { rfid_tag } }
    );

    if (rfidCheck.length > 0 && rfidCheck[0].status !== "Out") {
      return res.status(400).json({
        status: false,
        message: `RFID tag "${rfid_tag}" is already assigned to another active visitor. Please check out that visitor before reassigning.`,
      });
    }

    const checkInTime = await getCurrentISTDate();
    const UserID = req.user.userId || req.user;

    // ✅ Insert into DB
    await db.query(
      `INSERT INTO visitor_vehicles 
        (visitor_name, vehicle_number, mobile, purpose, location_id, company, visiting_person, rfid_tag, check_in, expected_exit_time, status, created_by, created_at)
       VALUES (:visitor_name, :vehicle_number, :mobile, :purpose, :location_id, :company, :visiting_person, :rfid_tag, :check_in, :expected_exit_time, :status, :created_by, :created_at)`,
      {
        replacements: {
          visitor_name: drivername,
          vehicle_number: vehicleno || null,
          mobile,
          purpose,
          location_id: location,
          company: company || null,
          visiting_person: visiting_person || null,
          rfid_tag,
          check_in: checkInTime,
          expected_exit_time: validity,
          status: "In",
          created_by: UserID,
          created_at: checkInTime,
        },
      }
    );

    return res.status(200).json({
      status: true,
      message: "Visitor entry added successfully",
    });
  } catch (error) {
    console.error("❌ Error adding visitor entry:", error);
    res.status(500).json({
      status: false,
      message: "Internal Server Error",
      error: error.message,
    });
  }
};

// ✅ Get All Visitor Entries
export const getAllVisitors = async (req, res) => {
  try {
    const userId = req.user?.userId;
    const roleId = req.user?.roleId;

    if (!userId || !roleId) {
      return res.status(401).json({
        status: false,
        message: "Unauthorized - Missing user or role ID",
      });
    }

    console.log("🧩 Logged-in userId:", userId, "roleId:", roleId);

    // ✅ Step 1: Get role name
    const [roleData] = await db.query("SELECT name FROM roles WHERE id = ?", {
      replacements: [roleId],
      type: db.QueryTypes.SELECT,
    });

    const roleName = roleData?.name?.toLowerCase() || "";
    const isSuperAdmin =
      roleName === "superadmin" || roleName === "super admin";

    // ✅ Step 2: Build location filter if not superadmin
    let locationFilter = "";
    let replacements = [];

    if (!isSuperAdmin) {
      const [userLocations] = await db.query(
        `SELECT gmastervalue_id FROM userlocationmap WHERE users_id = ?`,
        { replacements: [userId] }
      );

      const mappedLocationIds = userLocations.map((row) => row.gmastervalue_id);

      if (mappedLocationIds.length > 0) {
        locationFilter = `WHERE v.location_id IN (${mappedLocationIds
          .map(() => "?")
          .join(",")})`;
        replacements = [...mappedLocationIds];
      } else {
        // If no mapped locations → return empty data
        return res.status(200).json({
          status: true,
          data: [],
          message: "No mapped locations found for this user",
        });
      }
    }

    // ✅ Step 3: Fetch visitors
    const [visitors] = await db.query(
      `
      SELECT * 
      FROM visitor_vehicles v
      ${locationFilter}
      ORDER BY v.id DESC;
    `,
      { replacements }
    );

    if (!visitors || visitors.length === 0) {
      return res.status(200).json({
        status: true,
        data: [],
      });
    }

    // ✅ Step 4: Fetch locations
    const [locations] = await db.query(`
      SELECT gv.id, gv.name, g.name AS type
      FROM gmastervalue gv
      JOIN gmaster g ON g.id = gv.gmaster_id
      WHERE g.name IN ('location', 'location1', 'location2');
    `);

    // ✅ Step 5: Merge visitor data with location names
    const visitorsWithLocations = visitors.map((visitor) => {
      const locationMatch = locations.find(
        (loc) =>
          loc.type === "location" &&
          Number(loc.id) === Number(visitor.location_id)
      );

      return {
        ...visitor,
        location_name: locationMatch ? locationMatch.name : null,
      };
    });

    // ✅ Step 6: Final response
    res.status(200).json({
      status: true,
      data: visitorsWithLocations,
    });
  } catch (error) {
    console.error("❌ Error fetching visitors:", error);
    res.status(500).json({
      status: false,
      message: "Internal Server Error",
      error: error.message,
    });
  }
};

// ✅ Visitor Checkout
export const visitorCheckOut = async (req, res) => {
  try {
    const { id } = req.params;
    const checkOutTime = await getCurrentISTDate();

    const [result] = await db.query(
      `UPDATE visitor_vehicles 
       SET check_out = ?, status = 'Out' 
       WHERE id = ?`,
      [checkOutTime, id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        status: false,
        message: "Visitor not found or already out",
      });
    }

    res.json({ status: true, message: "Visitor out successfully" });
  } catch (error) {
    console.error("❌ Error during checkout:", error);
    res.status(500).json({
      status: false,
      message: "Internal Server Error",
      error: error.message,
    });
  }
};
