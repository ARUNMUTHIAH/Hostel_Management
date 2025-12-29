import { db, performQuery } from "../../config/Database.js";
import { getCurrentISTTime } from "../../Utils/Datetime.js";

export const getDropdownFromMaster = async (req, res) => {
  const QueryTime = await getCurrentISTTime();

  try {
    console.log("getDropdownFromMaster_initiated", QueryTime);
    const parentId = req.body.parent_id ?? null;
    if (parentId === "") {
      return res
        .status(400)
        .json({ status: false, message: `parent-id is required` });
    }

    if (parentId === null) {
      // Top level - use "name"
      const [results] = await db.query(
        `SELECT id, name FROM master WHERE parent_id IS NULL`,
        { replacements: [] }
      );

      return res.status(200).json({
        status: true,
        data: results,
      });
    } else {
      // Get items for this level
      const [items] = await db.query(
        `SELECT id, name, type FROM master WHERE parent_id = ?`,
        { replacements: [parentId] }
      );

      // Process each item to check if it has children
      const processedItems = await Promise.all(
        items.map(async (item) => {
          return {
            id: item.id,
            name: item.name,
            type: item.type,
          };
        })
      );

      console.log("getDropdownFromMaster_completed", QueryTime);

      return res.status(200).json({
        status: true,
        data: processedItems,
      });
    }
  } catch (error) {
    console.error("Dropdown fetch error:", error);
    console.log("getDropdownFromMaster_failed", QueryTime);

    res.status(500).json({
      status: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

export const getAllDropdowns = async (req, res) => {
  const QueryTime = await getCurrentISTTime();

  try {
    const userId = req.user?.userId;
    const roleId = req.user?.roleId;

    if (!userId || !roleId) {
      return res.status(401).json({
        status: false,
        message: "Unauthorized - Missing user or role ID",
      });
    }

    // ✅ Step 1: Get role name
    const [roleData] = await db.query("SELECT name FROM roles WHERE id = ?", {
      replacements: [roleId],
      type: db.QueryTypes.SELECT,
    });

    const roleName = roleData?.name?.toLowerCase() || "";
    const isSuperAdmin =
      roleName === "superadmin" || roleName === "super admin";

    // ✅ Step 2: Fetch gmaster list
    const [gmasters] = await db.query(`SELECT id, name FROM gmaster`);

    const result = {};

    // ✅ Step 3: Fetch gmastervalue for each gmaster
    for (const gmaster of gmasters) {
      let valuesQuery = `SELECT id, name, hostel_id, gmaster_id FROM gmastervalue WHERE gmaster_id = ? ORDER BY name ASC`;
      const replacements = [gmaster.id];

      const [values] = await db.query(valuesQuery, { replacements });

      let filteredValues = values;

      // ✅ For department, filter by user's hostel only
      if (gmaster.id === 8) {
        // assuming 8 is DEPT_GMASTER_ID
        const [[userHostel]] = await db.query(
          `SELECT hostel_id FROM userhostelmap WHERE users_id = ?`,
          { replacements: [userId] }
        );

        if (userHostel?.hostel_id) {
          filteredValues = values.filter(
            (item) => item.hostel_id === userHostel.hostel_id
          );
        } else {
          filteredValues = []; // No mapped hostel, empty department dropdown
        }

        // Remove hostel prefix for display
        filteredValues = filteredValues.map((item) => {
          if (item.name.includes(" - ")) {
            const parts = item.name.split(" - ");
            return {
              ...item,
              name: parts[parts.length - 1].trim(),
            };
          }
          return item;
        });
      }

      result[gmaster.name] = filteredValues;
    }

    // ✅ Step 4: Product Types (unchanged)
    const [allProductTypes] = await db.query(`
      SELECT id, name, parent_id 
      FROM master 
      WHERE parent_id IS NULL 
      ORDER BY name DESC
    `);
    result.product_types = allProductTypes;

    console.log("getAllDropdowns_completed", QueryTime);

    return res.status(200).json({
      status: true,
      data: result,
    });
  } catch (error) {
    console.error("Error fetching all dropdowns:", error);
    console.log("getAllDropdowns_failed", QueryTime);

    return res.status(500).json({
      status: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

export const getLocationByType = async (req, res) => {
  const { id } = req.query;
  const { type } = req.params;

  if (!id || !type) {
    return res.status(400).json({
      status: false,
      message: "Both 'id' and 'type' are required.",
    });
  }

  const gmasterTypeMap = {
    location1: 2,
    location2: 3,
  };

  const gmaster_id = gmasterTypeMap[type];

  if (!gmaster_id) {
    return res.status(400).json({
      status: false,
      message: "Invalid type. Use 'location1' or 'location2'.",
    });
  }

  try {
    const [assetIdRows] = await db.query(
      `SELECT asset_id FROM assetgmastermap WHERE gmastervalue_id = ?`,
      {
        replacements: [id],
      }
    );

    const assetIds = assetIdRows.map((row) => row.asset_id);

    if (assetIds.length === 0) {
      return res.status(200).json({
        status: true,
        issuccess: true,
        count: 0,
        data: [],
      });
    }

    const placeholders = assetIds.map(() => "?").join(", ");
    const [results] = await db.query(
      `
        SELECT DISTINCT gv.id, gv.name
        FROM assetgmastermap agm
        JOIN gmastervalue gv ON agm.gmastervalue_id = gv.id
        WHERE agm.asset_id IN (${placeholders})
        AND gv.gmaster_id = ?
        ORDER BY gv.id
      `,
      {
        replacements: [...assetIds, gmaster_id],
      }
    );

    return res.status(200).json({
      status: true,
      issuccess: true,
      count: results.length,
      data: results,
    });
  } catch (error) {
    console.error("Error fetching location info:", error);
    return res.status(500).json({
      status: false,
      message: "Internal server error",
    });
  }
};
