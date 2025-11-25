import { db, performQuery } from "../../config/Database.js";
import readXlsxFile from "read-excel-file/node";
import xlsx from "xlsx";
import os from "os";
import {
  formatDateTimeToYYYYMMDDHHMMSS,
  formatDateToYYYYMMDD,
  getCurrentISTTime,
  getCurrentISTDate,
} from "../../Utils/Datetime.js";
import { master_configuration } from "../../config/master_config.js";
import { validateLocationLevels } from "../../config/validationCheck.js";
import { handleSequelizeError } from "../../config/validationCheck.js";
import { PrecheckMiddleware } from "../../middleware/precheck.js";

const MASTER_CONFIG = master_configuration();

async function validateStudentInput(bodydata, db) {
  try {
    const QueryDate = await getCurrentISTDate();

    const existingProductTypeData = bodydata?.product_types;
    const existingLocData = bodydata?.locations;

    console.log("existingLocDataTT", existingLocData);
    console.log("existingProductTypeDataTT", existingProductTypeData);

    const idChecks = [];
    if (bodydata?.brand) idChecks.push({ id: bodydata?.brand, gmaster_id: 4 });
    if (bodydata?.tagtype)
      idChecks.push({ id: bodydata?.tagtype, gmaster_id: 6 });
    if (bodydata?.vendors)
      idChecks.push({ id: bodydata?.vendors, gmaster_id: 7 });

    let CheckBrand, CheckTagType, CheckVendors;

    if (idChecks.length > 0) {
      const ids = idChecks.map((i) => i.id);
      const [results] = await db.query(
        `SELECT id, gmaster_id FROM gmastervalue WHERE id IN (?) AND gmaster_id IN (4, 6, 7)`,
        { replacements: [ids] }
      );

      for (const row of results) {
        if (row.gmaster_id === 4) CheckBrand = row;
        if (row.gmaster_id === 6) CheckTagType = row;
        if (row.gmaster_id === 7) CheckVendors = row;
      }
    }

    const invalidFields = [];
    if (bodydata?.brand && !CheckBrand) invalidFields.push("brand");
    if (bodydata?.tagtype && !CheckTagType) invalidFields.push("tagtype");
    if (bodydata?.vendors && !CheckVendors) invalidFields.push("vendor");

    if (invalidFields.length > 0) {
      return {
        error: true,
        statusCode: 400,
        message: `Invalid ${invalidFields.join(", ")}`,
      };
    }

    if (Array.isArray(existingProductTypeData)) {
      const GetProductType = existingProductTypeData.map((i) => i.id);

      const [[CheckParentProduct]] = await db.query(
        `SELECT id FROM master WHERE id = ? AND parent_id IS NULL`,
        { replacements: [existingProductTypeData[0]?.id] }
      );

      const [result] = await db.query(`SELECT id FROM master WHERE id IN (?)`, {
        replacements: [GetProductType],
      });

      const foundIds = result.map((row) => row.id);
      const allExist = GetProductType.every((id) => foundIds.includes(id));

      if (!allExist || !CheckParentProduct) {
        return {
          error: true,
          statusCode: 400,
          message: !CheckParentProduct
            ? `Invalid parent product type`
            : `Invalid product type`,
        };
      }
    }

    if (existingLocData) {
      if (!Array.isArray(existingLocData)) {
        return {
          error: true,
          statusCode: 400,
          message: `location must be array`,
        };
      }
      const isValid = await validateLocationLevels(
        existingLocData,
        [1, 2, 3],
        db
      );
      console.log("existingLocData_length", existingLocData.length);

      if (!isValid || existingLocData.length > 3) {
        return {
          error: true,
          statusCode: 400,
          message: `Invalid location values`,
        };
      }
    }

    if (bodydata?.year_of_purchase && bodydata?.year_of_purchase > QueryDate) {
      return res.status(400).json({
        status: false,
        message: `Year of purchase cannot be a future date.`,
      });
    }

    return { error: false };
  } catch (err) {
    return { error: true, statusCode: 500, message: err.message };
  }
}
export async function insertStudentMasterMap(db, assetId, productTypes = []) {
  for (const master of productTypes) {
    const gmastervalueId =
      typeof master === "object" && master !== null ? master.id : master;
    const gmasterValue = master?.value || null;

    if (!gmastervalueId) continue;

    const [masterRow] = await db.query(
      "SELECT type FROM master WHERE id = ? LIMIT 1",
      { replacements: [gmastervalueId], type: db.QueryTypes.SELECT }
    );

    if (!masterRow) {
      console.warn(`Master ID ${gmastervalueId} not found`);
      continue;
    }

    const { type } = masterRow;
    let finalValue = type === "V" ? gmasterValue : null;

    const thisQuery = `INSERT INTO assetmastermap (asset_id, master_id, value) VALUES (?, ?, ?)`;
    const values = [assetId, gmastervalueId, finalValue];
    await db.query(thisQuery, { replacements: values });

    const [mastervalueid] = await db.query(
      "SELECT type, id FROM master WHERE parent_id = ? LIMIT 1",
      { replacements: [gmastervalueId], type: db.QueryTypes.SELECT }
    );

    if (gmasterValue !== null && mastervalueid?.type) {
      let finalValue = mastervalueid?.type === "V" ? gmasterValue : null;
      const thisQuery = `INSERT INTO assetmastermap (asset_id, master_id, value) VALUES (?, ?, ?)`;
      const values = [assetId, mastervalueid?.id, finalValue];
      await db.query(thisQuery, { replacements: values });
    }
  }
}
export async function insertStudentGMasterMap(
  db,
  assetId,
  locations = [],
  gmasterFields = {}
) {
  for (const loc of locations) {
    const gvalueId = typeof loc === "object" ? loc.id : loc;
    if (gvalueId) {
      await db.query(
        `INSERT INTO assetgmastermap (asset_id, gmastervalue_id) VALUES (?, ?)`,
        { replacements: [assetId, gvalueId] }
      );
    }
  }

  for (const fieldKey of ["brand", "tagtype", "vendors"]) {
    const value = gmasterFields[fieldKey];
    if (value) {
      await db.query(
        `INSERT INTO assetgmastermap (asset_id, gmastervalue_id) VALUES (?, ?)`,
        { replacements: [assetId, value] }
      );
    }
  }
}

export const CreateStudent = async (req, res) => {
  const QueryTime = await getCurrentISTTime();

  try {
    const bodydata = req.body?.data || req.body;
    const UserID = req.user.userId || req.user;

    const existingProductTypeData = bodydata?.product_types;
    const existingLocData = bodydata?.locations;

    if (!existingProductTypeData || !existingLocData) {
      return res.status(400).json({
        status: false,
        message: !existingLocData
          ? "Locations required"
          : !existingProductTypeData
          ? "Product types required"
          : "Fields required",
      });
    }

    const errorCheck = await validateStudentInput(bodydata, db);

    if (errorCheck.error) {
      return res.status(errorCheck.statusCode).json({
        status: false,
        message: errorCheck.message,
      });
    }

    await db.query("START TRANSACTION");

    // ✅ --- ASSET INSERT SECTION START ---
    const replacements = [
      bodydata?.vehiclenumber ?? "",
      bodydata?.vehiclerfid ?? "",
      bodydata?.remarks ?? "",
      bodydata?.status ?? "1",
      UserID ?? 0,
      QueryTime,
    ];

    if (
      !Array.isArray(replacements) ||
      replacements.some((v) => v === undefined)
    ) {
      console.error("❌ Invalid replacements for asset insert:", replacements);
      return res.status(500).json({
        status: false,
        message: "DB insertion failed: Missing or invalid replacements array",
      });
    }

    const MainAsset = await db.query(
      `INSERT INTO asset (vehiclenumber, vehiclerfid, remarks, status, createdby, createdat)
   VALUES (?, ?, ?, ?, ?, ?)`,
      { replacements }
    );
    // ✅ --- ASSET INSERT SECTION END ---

    const assetId = MainAsset[0];

    // for (const master of bodydata?.product_types) {
    //   const gmastervalueId = typeof master === 'object' && master !== null ? master.id : master;
    //   const gmasterValue = master.value || null;

    //   if (!gmastervalueId) continue;

    //   const [masterRow] = await db.query(
    //     'SELECT type FROM master WHERE id = ? LIMIT 1',
    //     { replacements: [gmastervalueId], type: db.QueryTypes.SELECT }
    //   );

    //   if (!masterRow) {
    //     console.warn(`Master ID ${gmastervalueId} not found`);
    //     continue;
    //   }
    //   const { type } = masterRow;
    //   let finalValue = null;
    //   if (type === 'V') {
    //     finalValue = gmasterValue;
    //   }

    //   const thisQuery = `INSERT INTO assetmastermap (asset_id, master_id, value) VALUES (?, ?, ?)`;
    //   const values = [assetId, gmastervalueId, finalValue];
    //   await performQuery(thisQuery, values, false);
    // }

    // for (const locId of bodydata?.locations) {
    //   await db.query(
    //     `INSERT INTO assetgmastermap (asset_id, gmastervalue_id) VALUES (?, ?)`,
    //     { replacements: [assetId, locId] }
    //   );
    // }

    // const gmasterFields = ['brand', 'tagtype', 'vendors'];
    // for (const field of gmasterFields) {
    //   const value = bodydata?.[field];
    //   if (value) {
    //     await db.query(
    //       `INSERT INTO assetgmastermap (asset_id, gmastervalue_id) VALUES (?, ?)`,
    //       { replacements: [assetId, value] }
    //     );
    //   }
    // }

    await insertStudentMasterMap(db, assetId, bodydata?.product_types);
    await insertStudentGMasterMap(db, assetId, bodydata?.locations, {
      brand: bodydata?.brand,
      tagtype: bodydata?.tagtype,
      vendors: bodydata?.vendors,
    });
    const terminalId = os.hostname();

    await db.query(
      `INSERT INTO assetlog (assetid,terminalid,transtime) VALUES (?, ?, NOW())`,
      { replacements: [assetId, terminalId || "DEFAULT"] }
    );
    await db.query("COMMIT");
    res
      .status(200)
      .json({ status: true, message: `Vehicle added successfully.` });
  } catch (error) {
    try {
      await db.query("ROLLBACK");
    } catch {
      console.log("rollback fails");
    }

    const errorFetch = handleSequelizeError(error);
    const status_code = errorFetch?.statusCode || 500;
    const error_message = errorFetch?.message;
    const error_status = errorFetch?.status;

    res.status(status_code).json({
      status: error_status,
      message: error_message,
    });
  }
};
export const UpdateStudent = async (req, res) => {
  const QueryTime = await getCurrentISTTime();
  try {
    const bodydata = req.body.data || req.body;

    const id = req.params.id;

    const { placeholders, values, error, statusCode } = req.precheck;

    if (error) {
      return res
        .status(statusCode || 400)
        .json({ status: false, message: error });
    }
    console.log("updated_asset_initiated", QueryTime);

    const errorCheck = await validateStudentInput(bodydata, db);
    if (errorCheck.error) {
      return res.status(errorCheck.statusCode).json({
        status: false,
        message: errorCheck.message,
      });
    }
    await db.query("START TRANSACTION");

    if (placeholders?.length !== 0) {
      placeholders.push("lastmodifiedat = ?", "lastmodifiedby = ?");
      values.push(new Date(), req.user.userId);
      values.push(id);

      await db.query(
        `UPDATE asset SET ${placeholders.join(", ")} WHERE id = ?`,
        { replacements: values }
      );
    }

    await db.query(`DELETE FROM assetmastermap WHERE asset_id = ?`, {
      replacements: [id],
    });
    await db.query(`DELETE FROM assetgmastermap WHERE asset_id = ?`, {
      replacements: [id],
    });

    await insertStudentMasterMap(db, id, bodydata?.product_types);
    await insertStudentGMasterMap(db, id, bodydata?.locations, {
      brand: bodydata?.brand,
      tagtype: bodydata?.tagtype,
      vendors: bodydata?.vendors,
    });

    console.log("updated_asset_completed", QueryTime);
    await db.query("COMMIT");

    res.status(200).json({
      issuccess: true,
      status: true,
      message: `Asset updated successfully.`,
    });
  } catch (error) {
    try {
      await db.query("ROLLBACK");
    } catch {
      console.log("rollback fails");
    }
    console.error(error);
    console.log("handled_updated_failed", QueryTime);

    const errorFetch = handleSequelizeError(error);
    const status_code = errorFetch?.statusCode || 500;
    const error_message = errorFetch?.message;
    const error_status = errorFetch?.status;

    res.status(status_code).json({
      status: error_status,
      message: error_message,
    });
  }
};
export const GetStudent = async (req, res) => {
  const QueryTime = await getCurrentISTTime();
  console.log("Current IST Time:", QueryTime);
  console.log("handled_get_initiated", QueryTime);

  try {
    const table = req.params.table;
    const id = req.query.id;
    const assetid = req.query.assetid;
    const searchTerm = req.query.search || "";

    const {
      tableName,
      primaryKeyField,
      defaultSortField,
      sortField,
      sortOrder,
      usePagination,
      page,
      pageSize,
      offset,
    } = req.getcheck;

    const userId = req.user?.userId;
    const roleId = req.user?.roleId;

    if (!userId) {
      return res.status(401).json({
        status: false,
        message: "Unauthorized - Missing user ID",
      });
    }

    // ✅ Check user role name from DB
    const [roleResult] = await db.query("SELECT name FROM roles WHERE id = ?", {
      replacements: [roleId],
    });

    const isSuperAdmin =
      roleResult && roleResult[0]?.name?.toLowerCase() === "superadmin";

    let whereConditions = [];
    let whereParams = [];

    const PageClause =
      usePagination == true ? `LIMIT ${pageSize} OFFSET ${offset}` : "";

    const sortFieldExists = MASTER_CONFIG[table].fields.some(
      (field) => field.name === sortField
    );
    const safeSort = sortFieldExists ? sortField : defaultSortField;

    if (id) {
      whereConditions.push(`a.id = ?`);
      whereParams.push(id);
    }
    if (assetid) {
      whereConditions.push(`a.vehiclenumber = ?`);
      whereParams.push(assetid);
    }

    if (searchTerm) {
      whereConditions.push(`(
        a.vehiclenumber LIKE ? OR 
        m.name LIKE ? OR 
        gv.name LIKE ?
      )`);
      whereParams.push(`%${searchTerm}%`, `%${searchTerm}%`, `%${searchTerm}%`);
    }

    // ✅ Apply location restriction only if not superadmin
    if (!isSuperAdmin) {
      const [userLocations] = await db.query(
        "SELECT gmastervalue_id FROM userlocationmap WHERE users_id = ?",
        { replacements: [userId] }
      );

      if (userLocations.length > 0) {
        const locationIds = userLocations.map((loc) => loc.gmastervalue_id);

        whereConditions.push(`
          a.id IN (
            SELECT agm.asset_id
            FROM assetgmastermap agm
            WHERE agm.gmastervalue_id IN (${locationIds.join(",")})
          )
        `);
      } else {
        // If user has no mapped locations, return empty response
        return res.status(200).json({
          status: true,
          issuccess: true,
          count: 0,
          data: [],
        });
      }
    }

    const whereClause =
      whereConditions.length > 0
        ? `WHERE ${whereConditions.join(" AND ")}`
        : "";

    const dataQuery = `
      SELECT DISTINCT a.* 
      FROM ${tableName} a
      LEFT JOIN assetmastermap amm ON amm.asset_id = a.id
      LEFT JOIN master m ON amm.master_id = m.id
      LEFT JOIN assetgmastermap agm ON agm.asset_id = a.id
      LEFT JOIN gmastervalue gv ON agm.gmastervalue_id = gv.id
      ${whereClause}
      ORDER BY ${safeSort} ${sortOrder}
      ${PageClause}
    `;

    const [assetResults] = await db.query(dataQuery, {
      replacements: whereParams,
    });

    if (!assetResults || assetResults.length === 0) {
      return res.status(200).json({
        status: true,
        issuccess: true,
        count: 0,
        data: [],
      });
    }

    const assetsWithRelations = await Promise.all(
      assetResults.map(async (asset) => {
        const [productTypes] = await db.query(
          `WITH RECURSIVE product_tree AS (
            SELECT m.id, m.name, m.type, m.parent_id, GROUP_CONCAT(am.value) AS asset_value
            FROM master m
            INNER JOIN assetmastermap am ON am.master_id = m.id
            WHERE am.asset_id = ?
            GROUP BY m.id, m.name, m.type, m.parent_id
            UNION ALL
            SELECT m2.id, m2.name, m2.type, m2.parent_id, pt.asset_value
            FROM master m2
            INNER JOIN product_tree pt ON pt.parent_id = m2.id
          )
          SELECT id, name, parent_id, type, GROUP_CONCAT(asset_value) AS asset_value
          FROM product_tree
          GROUP BY id, name, parent_id, type`,
          { replacements: [asset.id] }
        );

        const buildHierarchy = (items, parentId = null) =>
          items
            .filter((item) => item.parent_id === parentId)
            .map((item) => ({
              id: item.id,
              name: item.name,
              type: item.type,
              value: item.type == "C" ? "" : item.asset_value,
              children: buildHierarchy(items, item.id),
            }));

        const [locations] = await db.query(
          `SELECT gv.id, gv.name, g.name as type 
          FROM gmastervalue gv
          JOIN assetgmastermap agm ON gv.id = agm.gmastervalue_id
          JOIN gmaster g ON gv.gmaster_id = g.id
          WHERE agm.asset_id = ?`,
          { replacements: [asset.id] }
        );

        return {
          ...asset,
          product_types: buildHierarchy(productTypes),
          brand: locations.find((loc) => loc.type === "brand")?.id || null,
          brand_name:
            locations.find((loc) => loc.type === "brand")?.name || null,
          tagtype: locations.find((loc) => loc.type === "tagtype")?.id || null,
          vendors: locations.find((loc) => loc.type === "vendors")?.id || null,
          locations:
            locations
              .filter(
                (location) =>
                  location.type !== "brand" &&
                  location.type !== "tagtype" &&
                  location.type !== "vendors"
              )
              .map(({ type, ...rest }) => rest) || [],
        };
      })
    );

    const [[{ total }]] = await db.query(
      `SELECT COUNT(DISTINCT a.id) as total 
      FROM ${tableName} a
      LEFT JOIN assetmastermap amm ON amm.asset_id = a.id
      LEFT JOIN master m ON amm.master_id = m.id
      LEFT JOIN assetgmastermap agm ON agm.asset_id = a.id
      LEFT JOIN gmastervalue gv ON agm.gmastervalue_id = gv.id
      ${whereClause}`,
      { replacements: whereParams }
    );

    return res.status(200).json({
      status: true,
      issuccess: true,
      count: total,
      data: id || assetid ? assetsWithRelations[0] : assetsWithRelations,
    });
  } catch (error) {
    console.error("Error in GetAsset:", error);
    res.status(500).json({
      status: false,
      issuccess: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

// export const GetAsset = async (req, res) => {
//   const QueryTime = await getCurrentISTTime();
//   console.log("Current IST Time:", QueryTime);
//   console.log("handled_get_initiated", QueryTime);

//   try {
//     let table = req.params.table;
//     const id = req.query.id;
//     const assetid = req.query.assetid;
//     const searchTerm = req.query.search || "";

//     const {
//       tableName,
//       primaryKeyField,
//       defaultSortField,
//       sortField,
//       sortOrder,
//       usePagination,
//       page,
//       pageSize,
//       offset,
//     } = req.getcheck;
//     console.log("resultError", req.precheck);

//     let whereConditions = [];
//     let whereParams = [];

//     const PageClause =
//       usePagination == true ? `LIMIT ${pageSize} OFFSET ${offset} ` : ``;
//     console.log("PageClause", PageClause);

//     const sortFieldExists = MASTER_CONFIG[table].fields.some(
//       (field) => field.name === sortField
//     );
//     const safeSort = sortFieldExists ? sortField : defaultSortField;

//     if (id) {
//       whereConditions.push(`a.id = ?`);
//       whereParams.push(id);
//     }
//     if (assetid) {
//       whereConditions.push(`a.vehiclenumber = ?`);
//       whereParams.push(assetid);
//     }
//     // if (searchTerm) {
//     //   whereConditions.push(`assetid LIKE ?`);
//     //   whereParams.push(`%${searchTerm}%`);
//     // }
//     if (searchTerm) {
//       whereConditions.push(`(
//         a.vehiclenumber LIKE ? OR
//         m.name LIKE ? OR
//         gv.name LIKE ?
//       )`);
//       whereParams.push(`%${searchTerm}%`, `%${searchTerm}%`, `%${searchTerm}%`);
//     }

//     const whereClause =
//       whereConditions.length > 0
//         ? `WHERE ${whereConditions.join(" AND ")}`
//         : "";
//     // let dataQuery = `
//     //   SELECT a.* FROM ${tableName} a
//     //   ${whereClause}
//     //   ORDER BY ${safeSort} ${sortOrder}
//     //   ${PageClause}
//     //   `;
//     let dataQuery = `
//       SELECT DISTINCT a.*
//       FROM ${tableName} a
//       LEFT JOIN assetmastermap amm ON amm.asset_id = a.id
//       LEFT JOIN master m ON amm.master_id = m.id
//       LEFT JOIN assetgmastermap agm ON agm.asset_id = a.id
//       LEFT JOIN gmastervalue gv ON agm.gmastervalue_id = gv.id
//       ${whereClause}
//       ORDER BY ${safeSort} ${sortOrder}
//       ${PageClause} `;

//     const [assetResults] = await db.query(dataQuery, {
//       replacements: whereParams,
//     });
//     console.log("assetResultsrr", assetResults);

//     if (!assetResults || assetResults.length === 0) {
//       return res.status(200).json({
//         status: true,
//         issuccess: true,
//         count: 0,
//         data: [],
//       });
//     }

//     const assetsWithRelations = await Promise.all(
//       assetResults.map(async (asset) => {
//         const [productTypes] = await db.query(
//           `WITH RECURSIVE product_tree AS (
//           SELECT
//               m.id,
//               m.name,
//               m.type,
//               m.parent_id,
//               GROUP_CONCAT(am.value) AS asset_value
//           FROM master m
//           INNER JOIN assetmastermap am ON am.master_id = m.id
//           WHERE am.asset_id = ?
//           GROUP BY m.id, m.name, m.type, m.parent_id

//           UNION ALL

//           SELECT
//               m2.id,
//               m2.name,
//               m2.type,
//               m2.parent_id,
//               pt.asset_value
//           FROM master m2
//           INNER JOIN product_tree pt ON pt.parent_id = m2.id
//       )
//       SELECT
//         id, name, parent_id, type,
//         GROUP_CONCAT(asset_value) AS asset_value
//       FROM product_tree
//       GROUP BY id, name, parent_id, type `,

//           { replacements: [asset.id] }
//         );
//         const buildHierarchy = (items, parentId = null) => {
//           return items
//             .filter((item) => item.parent_id === parentId)
//             .map((item) => ({
//               id: item.id,
//               name: item.name,
//               type: item.type,
//               // ...(item.value !== '0' && item.value !== 0 && { value: item.value }),
//               // value: (item.asset_value === 0 || item.asset_value === '0') ? '' : item.asset_value,
//               value: item.type == "C" ? "" : item.asset_value,
//               children: buildHierarchy(items, item.id),
//             }));
//         };
//         const [locations] = await db.query(
//           `SELECT gv.id, gv.name, g.name as type
//           FROM gmastervalue gv
//           JOIN assetgmastermap agm ON gv.id = agm.gmastervalue_id
//           JOIN gmaster g ON gv.gmaster_id = g.id
//           WHERE agm.asset_id = ? `,
//           { replacements: [asset.id] }
//         );
//         return {
//           ...asset,
//           product_types: buildHierarchy(productTypes),
//           brand: locations.find((loc) => loc.type === "brand")?.id || null,
//           brand_name:
//             locations.find((loc) => loc.type === "brand")?.name || null,
//           tagtype: locations.find((loc) => loc.type === "tagtype")?.id || null,
//           vendors: locations.find((loc) => loc.type === "vendors")?.id || null,
//           locations:
//             locations
//               .filter(
//                 (location) =>
//                   location.type !== "brand" &&
//                   location.type !== "tagtype" &&
//                   location.type !== "vendors"
//               )
//               .map(({ type, ...rest }) => rest) || [],
//         };
//       })
//     );

//     const cleanedResults = assetsWithRelations;
//     // const startIndex = (page - 1) * pageSize;
//     // const paginatedResults = cleanedResults.slice(startIndex, startIndex + pageSize);

//     // const [[{ total }]] = await db.query(
//     //   `SELECT COUNT(*) as total FROM ${tableName} a ${whereConditions.length > 0 ? 'WHERE ' + whereConditions.join(' AND ') : ''}`,
//     //   { replacements: whereParams }
//     // );

//     const [[{ total }]] = await db.query(
//       `SELECT COUNT(DISTINCT a.id) as total
//       FROM ${tableName} a
//       LEFT JOIN assetmastermap amm ON amm.asset_id = a.id
//       LEFT JOIN master m ON amm.master_id = m.id
//       LEFT JOIN assetgmastermap agm ON agm.asset_id = a.id
//       LEFT JOIN gmastervalue gv ON agm.gmastervalue_id = gv.id
//       ${
//         whereConditions.length > 0
//           ? "WHERE " + whereConditions.join(" AND ")
//           : ""
//       }`,
//       { replacements: whereParams }
//     );

//     return res.status(200).json({
//       status: true,
//       issuccess: true,
//       count: total,
//       data: id || assetid ? cleanedResults[0] : cleanedResults,
//     });
//   } catch (error) {
//     console.error("Error in handleGet:", error);
//     res.status(500).json({
//       status: false,
//       issuccess: false,
//       message: "Internal server error",
//       error: error.message,
//     });
//   }
// };
export const DeleteStudent = async (req, res) => {
  const QueryTime = await getCurrentISTTime();
  console.log("Current IST Time:", QueryTime);

  try {
    console.log("handle_delete_initiated", QueryTime);

    const idParam = req.params.id;
    const idArray = idParam
      .split(",")
      .map((id) => parseInt(id.trim(), 10))
      .filter(Number.isInteger);

    if (!Array.isArray(idArray) || idArray.length === 0) {
      return res.status(400).json({
        status: false,
        issuccess: false,
        message: "Invalid 'id' array provided",
        id: req.params.id,
      });
    }

    const placeholders = idArray.map(() => "?").join(", ");
    await db.query("START TRANSACTION");

    const [result] = await db.query(
      `DELETE FROM asset WHERE id IN (${placeholders})`,
      { replacements: idArray }
    );

    if (!result || result.affectedRows === 0) {
      return res.status(500).json({
        status: false,
        issuccess: false,
        message: "No matching records found.",
      });
    }
    await db.query("COMMIT");

    return res.status(200).json({
      status: true,
      issuccess: true,
      message: "Students deleted successfully.",
      deletedCount: result.affectedRows,
    });
  } catch (error) {
    console.log("handle_delete_failed", QueryTime);
    try {
      await db.query("ROLLBACK");
    } catch {
      console.log("rollback fails");
    }

    const errorFetch = handleSequelizeError(error);
    const status_code = errorFetch?.statusCode || 500;
    const error_message = errorFetch?.message;
    const error_status = errorFetch?.status;

    res.status(status_code).json({
      status: error_status,
      message: error_message,
    });

    return res.status(status_code).json({
      status: error_status,
      message: error_message,
      issuccess: false,
      id: req.params.id,
    });
  }
};
export const productTypeFilter = async (req, res) => {
  try {
    const filters = req.query;

    let thisQuery = `
    SELECT ast.id as id, ast.assetid as assetid
    FROM asset AS ast
    LEFT JOIN assetgmastermap AS agm ON ast.id = agm.asset_id
    LEFT JOIN assetmastermap AS amm ON ast.id = amm.asset_id
    WHERE ast.id IS NOT NULL `;

    const params = [];
    const masterIds = [];
    if (filters?.category) masterIds.push(filters.category);
    // if (filters?.subcategory) masterIds.push(filters.subcategory)

    const locationIds = [];
    if (filters?.location) locationIds.push(filters.location);
    if (filters?.location1) locationIds.push(filters.location1);
    if (filters?.location2) locationIds.push(filters.location2);

    if (masterIds.length > 0) {
      thisQuery += ` AND amm.master_id IN (${masterIds
        .map(() => "?")
        .join(",")}) `;
      params.push(...masterIds);
    }

    if (locationIds.length > 0) {
      thisQuery += ` AND agm.gmastervalue_id IN (${locationIds
        .map(() => "?")
        .join(",")}) `;
      params.push(...locationIds);
    }

    thisQuery += ` GROUP BY ast.id `;

    if (masterIds.length > 0) {
      thisQuery += ` HAVING COUNT(DISTINCT amm.master_id) = ${masterIds.length} `;
      if (locationIds.length > 0) {
        thisQuery += ` AND COUNT(DISTINCT agm.gmastervalue_id) = ${locationIds.length} `;
      }
    } else if (locationIds.length > 0) {
      thisQuery += ` HAVING COUNT(DISTINCT agm.gmastervalue_id) = ${locationIds.length} `;
    }

    const data = await performQuery(thisQuery, params, true);

    const isValidLocationFilter = filters?.location2
      ? filters?.location1 && filters?.location
        ? true
        : false
      : filters?.location1
      ? filters?.location
        ? true
        : false
      : filters?.location
      ? true
      : false;

    const isValidPTFilter = filters?.subcategory
      ? filters?.category
        ? true
        : false
      : true;

    console.log("isValidPTFilter", isValidPTFilter);
    console.log("isValidLocationFilter", isValidLocationFilter);
    console.log("!filters?.category", filters?.category);
    console.log("!filters?.location1", filters?.location1);

    res.status(200).json({
      status: true,
      message: "success",
      assets:
        isValidPTFilter == false &&
        isValidLocationFilter == false &&
        filters.category == undefined
          ? []
          : data,
    });
  } catch (error) {
    return res.status(500).json({ status: false, message: error?.message });
  }
};

function formatDate1(value) {
  if (!value) return "";

  if (value instanceof Date && !isNaN(value.getTime())) {
    return value.toISOString().split("T")[0];
  }

  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}T/.test(value)) {
    return value.split("T")[0];
  }

  if (!isNaN(value) && Number(value) > 59) {
    const excelEpoch = new Date(1899, 11, 30);
    const date = new Date(excelEpoch.getTime() + Number(value) * 86400000);
    return date.toISOString().split("T")[0];
  }

  const parsed = new Date(value);
  if (isNaN(parsed.getTime())) return "";
  return parsed.toISOString().split("T")[0];
}
function formatDate(value) {
  if (!value) return null;

  if (typeof value === "number") {
    const excelStartDate = new Date(Date.UTC(1899, 11, 30));
    if (value < 60) {
      value -= 1;
    }
    excelStartDate.setUTCDate(excelStartDate.getUTCDate() + value);
    return excelStartDate.toISOString().split("T")[0];
  }
  const date = new Date(value);
  if (!isNaN(date)) {
    return date.toISOString().split("T")[0];
  }
  return null;
}
function normalizeRow(row, HeadersCheck) {
  console.log("HeadersCheck11", HeadersCheck);
  console.log("Total Rows", row);
  console.log("Total_Rows", `${row[11]}`);
  if (HeadersCheck == true) {
    return {
      location1: `${row[1]}`?.trim(),
      location2: `${row[2]}`?.trim(),
      location3: `${row[3]}`?.trim(),
      category: `${row[4]}`?.trim(),
      product_type: `${row[5]}`?.trim(),
      sub_category: `${row[6]}`?.trim(),
      brand: `${row[7]}`?.trim(),
      quantity: parseInt(row[8]) || 0,
      amcstatus: `${row[9]}`.trim(),
      price: parseFloat(row[10]) || 0,
      year_of_purchase: formatDate(row[11]),
      assetrfid: `${row[12]}`.trim(),
      assetid: `${row[13]}`.trim(),
      status: `${row[14]}`.trim().toLowerCase() === "working" ? 1 : 0,
      remarks: `${row[15]}`.trim(),
      tagtype: `${row[16]}`?.trim(),
      vendors: `${row[17]}`?.trim(),
      format: "detailed",
    };
  } else {
    return {
      product_types: row[1]?.split(",").map((s) => s.trim()) || [],
      locations: row[2]?.split(",").map((s) => s.trim()) || [],
      brand: row[3]?.trim(),
      quantity: parseInt(row[4]) || 0,
      amcstatus: `${row[5]}`.trim(),
      price: parseFloat(row[6]) || 0,
      year_of_purchase: formatDate(row[7]),
      assetrfid: `${row[8]}`.trim(),
      assetid: `${row[9]}`.trim(),
      status: `${row[10]}`.trim().toLowerCase() === "working" ? 1 : 0,
      remarks: `${row[11]}`.trim(),
      tagtype: row[12]?.trim(),
      vendors: row[13]?.trim(),
      format: "simple",
    };
  }
}
async function safeQuery(query, params, single = false) {
  try {
    if (!params || params.some((p) => typeof p === "undefined")) {
      throw new Error(`Invalid query parameters: ${JSON.stringify(params)}`);
    }
    const result = await performQuery(query, params, single);
    return result;
  } catch (err) {
    console.error("safeQuery error:", err.message);
    return [];
  }
}
// export const uploadFile = async (req, res) => {
//   try {
//     const QueryDate = await getCurrentISTDate();
//     const rows = await readXlsxFile(`./uploads/${req.file.filename}`);
//     if (!rows || rows.length <= 1) {
//       return res
//         .status(422)
//         .json({ status: false, message: "Empty Excel file." });
//     }

//     const originalHeaders = rows[0].map((h) =>
//       typeof h === "string" ? h.trim() : h
//     );
//     const isCenterMode = originalHeaders.some((h) => /^center(s)?$/i.test(h));
//     const requiredHeaders = isCenterMode ? ["Center"] : ["product_types"];
//     const missingHeaders = requiredHeaders.filter(
//       (h) => !originalHeaders.includes(h)
//     );

//     if (missingHeaders.length) {
//       return res.status(422).json({
//         status: false,
//         message: `Invalid Excel file: Missing headers - ${missingHeaders.join(
//           ", "
//         )}.`,
//       });
//     }

//     const fetchIdByName = async (table, name, extraWhere = "") =>
//       name?.trim()
//         ? safeQuery(
//             `SELECT id FROM ${table} WHERE name = ? ${extraWhere}`,
//             [name.trim()],
//             true
//           )
//         : [];

//     const fetchMultipleByName = async (table, names, extraWhere = "") =>
//       names?.length
//         ? performQuery(
//             `SELECT id, name FROM ${table} WHERE name IN (?) ${extraWhere}`,
//             [names],
//             true
//           )
//         : [];

//     const failedRecords = [];
//     const pushFailed = (row, index, message) =>
//       failedRecords.push({
//         data: row,
//         error: message,
//         rowIndex: index + 2,
//       });

//     rows.shift();

//     for (let i = 0; i < rows.length; i++) {
//       const row = rows[i];
//       if (!row || row.every((cell) => cell == null || `${cell}`.trim() === ""))
//         continue;

//       const errors = [];
//       const normalized = normalizeRow(row, isCenterMode);
//       let locations = [];
//       let product_types = [];

//       try {
//         if (
//           normalized.year_of_purchase == "" ||
//           normalized.year_of_purchase == null
//         ) {
//           errors.push(`Year of purchase is required`);
//           pushFailed(row, i, errors.join(", "));
//           continue;
//         }
//         if (normalized.year_of_purchase > QueryDate) {
//           errors.push(`Year of purchase cannot be a future date`);
//           pushFailed(row, i, errors.join(", "));
//           continue;
//         }
//         if (normalized.price < 0 || normalized.price == 0) {
//           errors.push(`Invalid price`);
//           pushFailed(row, i, errors.join(", "));
//           continue;
//         }
//         if (!normalized.assetid || normalized.assetid === "null") {
//           errors.push(`Asset-ID is required`);
//           pushFailed(row, i, errors.join(", "));
//           continue;
//         }
//         if (normalized.format === "detailed") {
//           const [dataL1, dataL2, dataL3] = await Promise.all([
//             fetchIdByName("gmastervalue", normalized.location1),
//             fetchIdByName("gmastervalue", normalized.location2),
//             fetchIdByName("gmastervalue", normalized.location3),
//           ]);
//           if (normalized.location1?.trim() && !dataL1.length)
//             errors.push(`Invalid Center: ${normalized.location1}`);
//           if (normalized.location2?.trim() && !dataL2.length)
//             errors.push(`Invalid Floor: ${normalized.location2}`);
//           if (normalized.location3?.trim() && !dataL3.length)
//             errors.push(`Invalid Room No: ${normalized.location3}`);
//           locations = [dataL1[0]?.id, dataL2[0]?.id, dataL3[0]?.id].filter(
//             Boolean
//           );

//           let subCategoryName = "",
//             subCategoryValue = "";
//           if (
//             normalized.sub_category?.trim() &&
//             normalized.sub_category.trim().toLowerCase() !== "null"
//           ) {
//             [subCategoryName, subCategoryValue = ""] = normalized.sub_category
//               .trim()
//               .split("-")
//               .map((s) => s.trim());
//           }

//           const [dataCat, dataPT, dataSub] = await Promise.all([
//             fetchIdByName("master", normalized.category),
//             fetchIdByName("master", normalized.product_type),
//             fetchIdByName("master", subCategoryName),
//           ]);
//           if (normalized.category?.trim() && !dataCat.length)
//             errors.push(`Invalid Category: ${normalized.category}`);
//           if (normalized.product_type?.trim() && !dataPT.length)
//             errors.push(`Invalid Product Type: ${normalized.product_type}`);
//           if (subCategoryName && !dataSub.length)
//             errors.push(`Invalid Sub Category: ${normalized.sub_category}`);

//           product_types = [
//             { id: dataCat[0]?.id, name: normalized.category },
//             { id: dataPT[0]?.id, name: normalized.product_type },
//             {
//               id: dataSub[0]?.id,
//               name: subCategoryName,
//               value: subCategoryValue,
//             },
//           ].filter((pt) => pt.id);
//         } else {
//           const dataLocations = await fetchMultipleByName(
//             "gmastervalue",
//             normalized.locations
//           );
//           const invalidLocs =
//             normalized.locations?.filter((name) =>
//               dataLocations.some(
//                 (l) => l.name.toLowerCase() === name.toLowerCase()
//               )
//             ) || [];
//           console.log("invalidLocs.length", invalidLocs.length);
//           console.log("invalidLocs.length", invalidLocs);
//           console.log("dataLocations", dataLocations);
//           console.log("normalized.locations", normalized.locations);

//           if (invalidLocs.length == 0)
//             errors.push(`Invalid locations: ${invalidLocs.join(", ")}`);
//           locations = dataLocations.map((l) => l.id);

//           // const dataPTs = await fetchMultipleByName('master', normalized.product_types);
//           // const invalidPTs = normalized.product_types?.filter(name => !dataPTs.some(pt => pt.name === name)) || [];
//           console.log("normalized_product_type123", normalized.product_types);

//           let firstWord = normalized.product_types[0];
//           console.log("firstWord", firstWord);

//           const dataPTs = await fetchMultipleByName(
//             "master",
//             firstWord,
//             "AND parent_id IS NULL"
//           );
//           console.log("dataPTs1", dataPTs);

//           const invalidPTs =
//             [firstWord]?.filter((name) =>
//               dataPTs.some((pt) => pt.name.toLowerCase() === name.toLowerCase())
//             ) || [];
//           console.log("invalidPTs", invalidPTs);

//           // if (invalidPTs.length == 0) {
//           //   console.log(`Invalid parent product types`);

//           //   errors.push(`Invalid parent product types`);
//           //   pushFailed(row, i, errors.join(', '));
//           //   continue;
//           // }
//           if (invalidPTs.length == 0)
//             errors.push(
//               `Invalid parent product types: ${invalidPTs.join(", ")}`
//             );
//           product_types = dataPTs;
//         }

//         const [dataBrand, dataTag, dataVendors] = await Promise.all([
//           fetchIdByName("gmastervalue", normalized.brand, "AND gmaster_id = 4"),
//           fetchIdByName(
//             "gmastervalue",
//             normalized.tagtype,
//             "AND gmaster_id = 6"
//           ),
//           fetchIdByName(
//             "gmastervalue",
//             normalized.vendors,
//             "AND gmaster_id = 7"
//           ),
//         ]);

//         console.log("dataBrand", dataBrand.length);
//         console.log("dataTag", dataTag.length);
//         console.log("dataVendors", dataVendors.length);

//         if (dataBrand && dataBrand.length == 0)
//           errors.push(`Invalid brand: ${normalized.brand}`);
//         if (dataTag.length == 0)
//           errors.push(`Invalid tagtype: ${normalized.tagtype}`);
//         if (dataVendors.length == 0)
//           errors.push(`Invalid vendors: ${normalized.vendors}`);

//         // const invalidPTs = normalized.product_types?.filter(name => !dataPTs.some(pt => pt.name.toLowerCase() === name.toLowerCase())) || [];
//         // console.log('normalized.product_types',normalized.product_type);
//         // console.log('invalidPTs',invalidPTs);
//         // console.log('invalidPTs_length',invalidPTs?.length);

//         // if (invalidPTs.length != 0) errors.push(`Invalid parent product types: ${invalidPTs.join(', ')}`);
//         // product_types = dataPTs;

//         const dataPTs = await fetchMultipleByName(
//           "master",
//           normalized.product_type,
//           "AND parent_id IS NULL"
//         );
//         console.log("dataPTs1", dataPTs);

//         const invalidPTs =
//           [normalized.product_type]?.filter((name) =>
//             dataPTs.some((pt) => pt.name.toLowerCase() === name.toLowerCase())
//           ) || [];
//         if (invalidPTs.length > 0) {
//           errors.push(`Invalid parent product types`);
//           pushFailed(row, i, errors.join(", "));
//           continue;
//         }
//         console.log("normalized.year_of_purchase", normalized.year_of_purchase);
//         // if (normalized.year_of_purchase && normalized.year_of_purchase > QueryDate) {
//         //   errors.push(`Year of purchase cannot be a future date`);
//         //   pushFailed(row, i, errors.join(', '));
//         //   continue;
//         // }
//         if (errors.length) {
//           pushFailed(row, i, errors.join(", "));
//           continue;
//         }

//         const mappedBody = {
//           "s.no": i + 1,
//           locations,
//           product_types,
//           brand: dataBrand[0]?.id,
//           quantity: normalized.quantity,
//           amcstatus: normalized.amcstatus,
//           price: normalized.price,
//           year_of_purchase: normalized.year_of_purchase,
//           assetrfid: normalized.assetrfid,
//           assetid: normalized.assetid,
//           status: normalized.status,
//           remarks: normalized.remarks,
//           tagtype: dataTag[0]?.id,
//           vendors: dataVendors[0]?.id,
//         };

//         let errorOutput = null;
//         const mockRes = {
//           status: () => ({
//             json: (obj) => {
//               if (!obj.status) errorOutput = { ...obj, row: i + 2 };
//             },
//           }),
//         };
//         const mockReq = {
//           body: { data: mappedBody },
//           params: { table: "asset" },
//           user: req.user.userId,
//         };
//         await PrecheckMiddleware(mockReq, mockRes, () => {});
//         if (errorOutput) {
//           pushFailed(row, i, errorOutput.message || "Validation failed");
//           continue;
//         }

//         await CreateAsset(mockReq, mockRes);
//       } catch (err) {
//         pushFailed(row, i, err.message || "Error in asset creation");
//       }
//     }
//     console.log("failedRecords", failedRecords);
//     if (failedRecords.length) {
//       const headers = [...originalHeaders, "Error", "Row"];
//       const exportRows = failedRecords.map((fr) => [
//         ...fr.data,
//         fr.error,
//         fr.rowIndex,
//       ]);
//       const exportData = [headers, ...exportRows];

//       const worksheet = xlsx.utils.aoa_to_sheet(exportData);
//       const workbook = xlsx.utils.book_new();
//       xlsx.utils.book_append_sheet(workbook, worksheet, "Failed Records");
//       const buffer = xlsx.write(workbook, { bookType: "xlsx", type: "buffer" });

//       res.setHeader(
//         "Content-Disposition",
//         "attachment; filename=bulk_upload_errors.xlsx"
//       );
//       res.setHeader(
//         "Content-Type",
//         "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
//       );
//       return res.send(buffer);
//     }

//     return res.status(200).json({
//       status: true,
//       message: "Bulk asset upload completed successfully.",
//     });
//   } catch (error) {
//     console.error("Bulk Upload Error:", error);
//     return res.status(500).json({
//       status: false,
//       message:
//         error.message || "An unexpected error occurred during bulk upload.",
//     });
//   }
// };

export const uploadFile = async (req, res) => {
  try {
    console.log("========== 📤 BULK UPLOAD START ==========");

    const QueryDate = await getCurrentISTDate();
    console.log("📅 Current IST Date:", QueryDate);

    if (!req.file?.filename) {
      return res.status(400).json({
        status: false,
        message: "No file uploaded.",
      });
    }

    const filePath = `./uploads/${req.file.filename}`;
    const rows = await readXlsxFile(filePath);
    console.log("📊 Rows read:", rows?.length || 0);

    if (!rows || rows.length <= 1) {
      return res.status(422).json({
        status: false,
        message: "Empty or invalid Excel file.",
      });
    }

    const originalHeaders = rows[0].map((h) =>
      typeof h === "string" ? h.trim() : h
    );
    const normalizedHeaders = originalHeaders.map((h) =>
      typeof h === "string" ? h.toLowerCase().replace(/\s+/g, "_").trim() : h
    );

    const requiredHeaders = [
      "s.no",
      "location",
      "gate",
      "product_type",
      "vehicle_number",
      "vehicle_rfid",
      "vehicle_status",
      "remark",
    ];

    const missingHeaders = requiredHeaders.filter(
      (h) => !normalizedHeaders.includes(h.toLowerCase())
    );

    if (missingHeaders.length) {
      return res.status(422).json({
        status: false,
        message: `Missing required headers: ${missingHeaders.join(", ")}`,
      });
    }

    rows.shift(); // remove headers
    const failedRecords = [];

    // ✅ FIXED safeFetch
    const safeFetch = async (table, name) => {
      if (!name) return [];
      const nameStr = typeof name === "string" ? name.trim() : String(name);
      return safeQuery(
        `SELECT id FROM ${table} WHERE name = ?`,
        [nameStr],
        true
      );
    };

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      if (!row || row.every((cell) => !cell || `${cell}`.trim() === ""))
        continue;

      const [
        s_no,
        location,
        gate,
        product_type,
        vehicle_number,
        vehicle_rfid,
        vehicle_status,
        remark,
      ] = row;

      const errors = [];

      if (!location) errors.push("Location missing");
      if (!gate) errors.push("Gate missing");
      if (!product_type) errors.push("Product Type missing");
      if (!vehicle_number) errors.push("Vehicle Number missing");
      if (!vehicle_rfid) errors.push("Vehicle RFID missing");

      if (errors.length) {
        failedRecords.push({
          rowIndex: i + 2,
          data: row,
          error: errors.join(", "),
        });
        continue;
      }

      const [dataLocation, dataGate, dataPT] = await Promise.all([
        safeFetch("gmastervalue", location),
        safeFetch("gmastervalue", gate),
        safeFetch("master", product_type),
      ]);

      if (!dataLocation.length) errors.push(`Invalid Location: ${location}`);
      if (!dataGate.length) errors.push(`Invalid Gate: ${gate}`);
      if (!dataPT.length) errors.push(`Invalid Product Type: ${product_type}`);

      if (errors.length) {
        failedRecords.push({
          rowIndex: i + 2,
          data: row,
          error: errors.join(", "),
        });
        continue;
      }

      // const mappedBody = {
      //   vehiclenumber: vehicle_number?.toString().trim(),
      //   vehiclerfid: vehicle_rfid?.toString().trim(),
      //   remarks: remark?.toString().trim() || "",
      //   status: vehicle_status?.toString().trim() || "1",
      //   product_types: [dataPT[0]?.id],
      //   locations: [dataLocation[0]?.id],
      //   gate: dataGate[0]?.id,
      // };

      const mappedBody = {
        vehiclenumber: String(vehicle_number).trim(),
        vehiclerfid: String(vehicle_rfid).trim(),
        remarks: remark ? String(remark).trim() : "",
        status: vehicle_status?.toLowerCase() === "active" ? "1" : "0",
        product_types: dataPT.map((pt) => ({ id: pt.id })),
        locations: dataLocation.map((loc) => loc.id),
        gate: dataGate[0]?.id || null,
      };

      console.log("🧩 Mapped Body:", mappedBody);

      try {
        const mockReq = {
          body: { data: mappedBody },
          params: { table: "asset" },
          user: req.user,
        };
        const mockRes = {
          status: (code) => ({
            json: (obj) => {
              if (!obj.status) {
                failedRecords.push({
                  rowIndex: i + 2,
                  data: row,
                  error: obj.message || "Insert failed",
                });
              }
            },
          }),
        };

        await CreateStudent(mockReq, mockRes);
        console.log(`✅ Row ${i + 2} inserted successfully`);
      } catch (err) {
        failedRecords.push({
          rowIndex: i + 2,
          data: row,
          error: err.message || "Insert error",
        });
      }
    }

    // 🔁 Handle failed records
    if (failedRecords.length) {
      const headers = [...originalHeaders, "Error", "Row"];
      const exportRows = failedRecords.map((r) => [
        ...r.data,
        r.error,
        r.rowIndex,
      ]);
      const sheet = xlsx.utils.aoa_to_sheet([headers, ...exportRows]);
      const book = xlsx.utils.book_new();
      xlsx.utils.book_append_sheet(book, sheet, "Failed");

      const buffer = xlsx.write(book, { type: "buffer", bookType: "xlsx" });

      res.setHeader(
        "Content-Disposition",
        "attachment; filename=bulk_upload_errors.xlsx"
      );
      res.setHeader(
        "Content-Type",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      );
      return res.send(buffer);
    }

    res.status(200).json({
      status: true,
      message: "Bulk vehicle upload completed successfully.",
    });
  } catch (err) {
    console.error("❌ Bulk Upload Error:", err);
    res.status(500).json({
      status: false,
      message: err.message || "Unexpected error during bulk upload.",
    });
  }
};

export const writeStudentid = async (req, res) => {
  const { assetid, assetrfid, time } = req.body;
  const convertedTime = formatDateTimeToYYYYMMDDHHMMSS(time);
  console.log("timeeeee", convertedTime);

  if (!assetid || !assetrfid) {
    return res.status(400).json({
      status: false,
      message: "Both assetid and assetrfid are required",
    });
  }

  try {
    const [[currentAsset]] = await db.query(
      `SELECT id, assetrfid FROM asset WHERE assetid = ?`,
      { replacements: [assetid] }
    );
    console.log("currentAssetttt", currentAsset);

    if (!currentAsset) {
      return res
        .status(404)
        .json({ status: false, message: "Asset not found" });
    }

    if (currentAsset.assetrfid === assetrfid) {
      return res.status(200).json({
        status: true,
        message: "Asset RFID already present for this asset. No update needed.",
      });
    }

    await db.query("START TRANSACTION");

    const [conflicts] = await db.query(
      `SELECT id FROM asset WHERE assetrfid = ? AND assetid != ?`,
      { replacements: [assetrfid, assetid] }
    );

    for (const conflict of conflicts) {
      await db.query(`UPDATE asset SET assetrfid = NULL WHERE id = ?`, {
        replacements: [conflict.id],
      });
    }

    await db.query(`UPDATE asset SET assetrfid = ? WHERE id = ?`, {
      replacements: [assetrfid, currentAsset.id],
    });

    const terminalId = os.hostname();
    await db.query(
      `INSERT INTO assetlog (assetid, terminalid, transtime) VALUES (?, ?, ?)`,
      { replacements: [assetid, terminalId || "DEFAULT", convertedTime] }
    );

    await db.query("COMMIT");

    return res.status(200).json({
      status: true,
      message: "Asset RFID updated successfully",
    });
  } catch (err) {
    try {
      await db.query("ROLLBACK");
    } catch {
      console.log("rollback fails");
    }
    console.error("Error writing assetrfid:", err.message);
    return res
      .status(500)
      .json({ status: false, message: "Internal server error" });
  }
};

export const lastseen = async (req, res) => {
  try {
    const allData = req.body.data;
    const userId = req.user.userId;
    console.log("userrrrr", userId);

    if (!Array.isArray(allData) || allData.length === 0) {
      return res.status(400).json({
        status: false,
        message: "No data provided",
      });
    }

    const successAssets = [];
    const failedAssets = [];

    for (const item of allData) {
      const assetid = item.assetId;
      const found_time = item.found_time;

      console.log("found_timeee", found_time);

      //const convertedTime = new Date(found_time).toISOString().slice(0, 19).replace('T', ' ');
      // const convertedTime = formatDateTimeToYYYYMMDDHHMMSS(found_time);
      const convertedTime = found_time;
      console.log("convertedTimeee", convertedTime);

      const [getid] = await db.query(`SELECT id FROM asset WHERE assetid = ?`, {
        replacements: [assetid],
      });

      const NewID = getid[0]?.id;

      if (!NewID) {
        failedAssets.push(assetid);
        continue;
      }

      const [alreadyexists] = await db.query(
        `SELECT asset_id FROM findasset WHERE asset_id = ?`,
        { replacements: [NewID] }
      );

      await db.query("START TRANSACTION");

      try {
        if (alreadyexists.length > 0) {
          await db.query(
            `UPDATE findasset SET transtime = ?, user_id = ? WHERE asset_id = ?`,
            { replacements: [convertedTime, userId, NewID] }
          );
        } else {
          await db.query(
            `INSERT INTO findasset (asset_id , user_id , transtime) VALUES (?, ?, ?)`,
            { replacements: [NewID, userId, convertedTime] }
          );
        }

        await db.query("COMMIT");
        successAssets.push(assetid);
      } catch (innerError) {
        try {
          await db.query("ROLLBACK");
        } catch {
          console.log("rollback fails");
        }
        failedAssets.push(assetid);
        console.error("Transaction error for asset:", assetid, innerError);
      }
    }

    return res.status(200).json({
      status: failedAssets.length === 0,
      message:
        failedAssets.length === 0
          ? "All last seen times updated successfully"
          : "Some assets failed to update",
      successAssets,
      failedAssets,
    });
  } catch (error) {
    try {
      await db.query("ROLLBACK");
    } catch {
      console.log("rollback fails");
    }
    console.error("Error in lastseen:", error);
    return res.status(500).json({
      status: false,
      message: "Internal server error",
    });
  }
};

// Bulk Upload back-up Code
// export const uploadFileWithoutQueryMerge = async (req, res) => {
//   try {
//     const rows = await readXlsxFile(`./uploads/${req.file.filename}`);
//     if (!rows || rows.length === 0 || rows.length <= 1) { return res.status(422).json({ status: false, message: 'Empty Excel file.'});
//     }

//     const headers = rows[0].map(h => (typeof h === 'string' ? h.trim() : h));
//     const HeadersCheck = headers.includes('Center') || headers.includes('centers');
//     const requiredHeaders = HeadersCheck ? ['Center'] : ['product_types'];
//     const missingHeaders = requiredHeaders.filter(h => !headers.includes(h));

//     if (missingHeaders.length > 0) {
//       return res.status(422).json({
//         status: false,
//         message: `Invalid Excel file: Missing headers - ${missingHeaders.join(', ')}.`
//       });
//     }

//     const mapRowToHeaders = (row, extras = {}) => {
//       const obj = {};
//       headers.forEach((header, index) => {
//         obj[header] = row[index] ?? '';
//       });
//       return { ...obj, ...extras };
//     };

//     rows.shift();
//     const failedRecords = [];

//     const pushFailed = (row, i, message) => {
//       failedRecords.push(
//         mapRowToHeaders(row, {
//           Error: message || 'Validation failed',
//           Row: i + 2
//         })
//       );
//     };

//     for (let i = 0; i < rows.length; i++) {
//       const row = rows[i];
//       if (!row || row.every(cell => cell == null || `${cell}`.trim() === '')) continue;

//       const rowErrors = [];
//       const normalized = normalizeRow(row, HeadersCheck);
//       let mappedBody = {};

//       try {
//         let locations = [];
//         let product_types = [];

//         if (normalized.format === 'detailed') {
//           const [dataL1, dataL2, dataL3] = await Promise.all([
//             normalized.location1?.trim() ? safeQuery(`SELECT id FROM gmastervalue WHERE name = ?`, [normalized.location1], true) : [],
//             normalized.location2?.trim() ? safeQuery(`SELECT id FROM gmastervalue WHERE name = ?`, [normalized.location2], true) : [],
//             normalized.location3?.trim() ? safeQuery(`SELECT id FROM gmastervalue WHERE name = ?`, [normalized.location3], true) : []
//           ]);

//           if (normalized.location1?.trim() && dataL1.length === 0) rowErrors.push(`Invalid Center: ${normalized.location1}`);
//           if (normalized.location2?.trim() && dataL2.length === 0) rowErrors.push(`Invalid Floor: ${normalized.location2}`);
//           if (normalized.location3?.trim() && dataL3.length === 0) rowErrors.push(`Invalid Room No: ${normalized.location3}`);

//           locations = [dataL1[0]?.id, dataL2[0]?.id, dataL3[0]?.id].filter(Boolean);

//           let subCategoryName = '';
//           let subCategoryValue = '';
//           if (normalized.sub_category?.trim().toLowerCase() !== 'null' && normalized.sub_category?.trim() !== '') {
//             const parts = normalized.sub_category.trim().split('-');
//             subCategoryName = parts[0]?.trim() || '';
//             subCategoryValue = parts[1]?.trim() || '';
//           }

//           const [dataCat, dataPT, dataSub] = await Promise.all([
//           normalized.category?.trim() ? safeQuery(`SELECT id FROM master WHERE name = ?`, [normalized.category], true) : [],
//           normalized.product_type?.trim() ? safeQuery(`SELECT id FROM master WHERE name = ?`, [normalized.product_type], true) : [],
//           normalized.sub_category?.trim() ? safeQuery(`SELECT id FROM master WHERE name = ?`, [subCategoryName], true) : [],
//           // (normalized.sub_category?.trim().toLowerCase() !== 'null' && normalized.sub_category?.trim() !== '')
//           //   ? safeQuery(`SELECT id FROM master WHERE name = ?`, [subCategoryName], true)
//           //   : []
//           ]);

//           if (normalized.category?.trim() && dataCat.length === 0) rowErrors.push(`Invalid Category: ${normalized.category}`);
//           if (normalized.product_type?.trim() && dataPT.length === 0) rowErrors.push(`Invalid Product Type: ${normalized.product_type}`);
//           if (!normalized.sub_category?.trim() && dataSub.length === 0) rowErrors.push(`Invalid Sub Category: ${normalized.sub_category}`);

//           product_types = [
//             { id: dataCat[0]?.id, name: normalized.category },
//             { id: dataPT[0]?.id, name: normalized.product_type },
//             { id: dataSub[0]?.id, name: subCategoryName, value: subCategoryValue  }
//           ].filter(pt => pt.id !== undefined);

//         } else {
//           if (normalized.locations?.length > 0) {
//             const dataLocations = await performQuery(
//               `SELECT id, name FROM gmastervalue WHERE name IN (?)`,
//               [normalized.locations],
//               true
//             );

//             const orderedLocations = normalized.locations.map(name => {
//               const loc = dataLocations.find(l => l.name === name);
//               return loc ? { id: loc.id, name: loc.name } : null;
//             });

//             const invalidLocations = orderedLocations
//               .map((item, index) => (item ? null : normalized.locations[index]))
//               .filter(Boolean);

//             if (invalidLocations.length > 0) {
//               rowErrors.push(`Invalid locations: ${invalidLocations.join(', ')}`);
//             }

//             locations = orderedLocations.map(item => item?.id).filter(Boolean);
//           }

//           if (normalized.product_types?.length > 0) {
//             const dataPTs = await performQuery(
//               `SELECT id, name FROM master WHERE name IN (?)`,
//               [normalized.product_types],
//               true
//             );
//             const foundPTNames = dataPTs.map(pt => pt.name);
//             const invalidPTs = normalized.product_types.filter(pt => !foundPTNames.includes(pt));

//             if (invalidPTs.length > 0) {
//               rowErrors.push(`Invalid product types: ${invalidPTs.join(', ')}`);
//             }

//             product_types = dataPTs;
//           }
//         }

//         const [dataBrand, dataTag] = await Promise.all([
//           normalized.brand?.trim() ? safeQuery(`SELECT id FROM gmastervalue WHERE name = ? AND gmaster_id = 4`, [normalized.brand], true) : [],
//           normalized.tagtype?.trim() ? safeQuery(`SELECT id FROM gmastervalue WHERE name = ? AND gmaster_id = 6`, [normalized.tagtype], true) : []
//         ]);

//         if (normalized.brand?.trim() && (!dataBrand || dataBrand.length === 0)) {
//           rowErrors.push(`Invalid brand: ${normalized.brand}`);
//         }

//         if (normalized.tagtype?.trim() && (!dataTag || dataTag.length === 0)) {
//           rowErrors.push(`Invalid tagtype: ${normalized.tagtype}`);
//         }

//         if (rowErrors.length > 0) {
//           pushFailed(row, i, rowErrors.join(', '));
//           continue;
//         }

//         if (normalized.year_of_purchase && `${normalized.year_of_purchase}`.length === 4) {
//           normalized.year_of_purchase = `${normalized.year_of_purchase}-01-01`;
//         }

//         mappedBody = {
//           "s.no": i + 1,
//           locations,
//           product_types,
//           brand: dataBrand[0]?.id,
//           quantity: normalized.quantity,
//           amcstatus: normalized.amcstatus,
//           price: normalized.price,
//           year_of_purchase: normalized.year_of_purchase,
//           assetrfid: normalized.assetrfid,
//           assetid: normalized.assetid,
//           status: normalized.status,
//           remarks: normalized.remarks,
//           tagtype: dataTag[0]?.id
//         };

//         let errorOutput = null;
//         const mockRes = {
//           status: () => ({
//             json: (obj) => {
//               if (!obj.status) {
//                 errorOutput = { ...obj, row: i + 2 };
//               }
//             }
//           })
//         };

//         const mockReq = {
//           body: { data: mappedBody },
//           params: { table: 'asset' },
//           user: req.user.userId
//         };

//         await PrecheckMiddleware(mockReq, mockRes, () => {});

//         if (errorOutput) {
//           pushFailed(row, i, errorOutput.message || 'Validation failed');
//           continue;
//         }
//           console.log('mockReq',mockReq?.body?.data);
//         await CreateAsset(mockReq, mockRes);

//       } catch (err) {
//         pushFailed(row, i, err.message || 'Error in asset creation');
//       }
//     }

//     if (failedRecords.length > 0) {
//       const worksheet = xlsx.utils.json_to_sheet(failedRecords);
//       const workbook = xlsx.utils.book_new();
//       xlsx.utils.book_append_sheet(workbook, worksheet, 'Failed Records');
//       const buffer = xlsx.write(workbook, { bookType: 'xlsx', type: 'buffer' });

//       res.setHeader('Content-Disposition', 'attachment; filename=bulk_upload_errors.xlsx');
//       res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
//       return res.send(buffer);
//     }

//     return res.status(200).json({
//       status: true,
//       message: 'Bulk asset upload completed successfully.'
//     });

//   } catch (error) {
//     console.error('Bulk Upload Error:', error);
//     return res.status(500).json({
//       status: false,
//       message: error.message || 'An unexpected error occurred during bulk upload.'
//     });
//   }
// };
