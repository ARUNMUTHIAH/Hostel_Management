import { db } from "../../config/Database.js";
import puppeteer from "puppeteer";
import xlsx from "xlsx";
import path from "path";
import { fileURLToPath } from "url";
import { getCurrentISTTime, getCurrentISTDate } from "../../Utils/Datetime.js";
import { Cluster } from "puppeteer-cluster";
import { PDFDocument, degrees } from "pdf-lib";
import fs from "fs";
import moment from "moment-timezone";

export async function generatePDF(req, results, title) {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const chunkSize = 1000;
  const outputPath = path.join(__dirname, `${title}.pdf`);

  console.log(`========== 📄 Generating ${title} ==========`);

  const formatValue = (val) =>
    val === null || val === undefined || val === "" || val === "N/A"
      ? "-"
      : val;

  // ==========================================
  // 📊 Format results (Based on Report Type)
  // ==========================================
  let formattedResults = [];

  if (title === "StudentSummaryReport") {
    formattedResults = results.map((item, i) => ({
      sno: i + 1,
      memberid: formatValue(item.memberid),
      name: formatValue(item.name),
      mobile: formatValue(item.mobile),
      email: formatValue(item.email),
      parentname: formatValue(item.parentname),
      parentcontact: formatValue(item.parentcontact),
      expirydate: formatValue(item.expirydate),
      total_movements: formatValue(item.total_movements),
      total_outside: formatValue(item.total_outside),
      total_late: formatValue(item.total_late),
      total_returned: formatValue(item.total_returned),
    }));
  }

  // ==========================================
  // 🟦 Student Movement Report
  // ==========================================
  else if (title === "StudentMovementReport") {
    formattedResults = results.map((item, i) => ({
      sno: i + 1,
      memberid: formatValue(item.memberid),
      name: formatValue(item.name),
      hostel: formatValue(item.hostel),
      out_time: formatValue(item.out_time),
      in_time: formatValue(item.in_time),
      allowed_out_time: formatValue(item.allowed_out_time),
      expected_return_time: formatValue(item.expected_return_time),
      minutes_late: formatValue(item.minutes_late),
      status: formatValue(item.status),
    }));
  } else if (title === "LateReturnReport") {
    formattedResults = results.map((item, i) => ({
      sno: i + 1,
      memberid: formatValue(item.memberid),
      name: formatValue(item.name),
      hostel: formatValue(item.hostel),
      out_time: formatValue(item.out_time),
      in_time: formatValue(item.in_time),
    }));
  } else if (title === "CurrentOutsideReport") {
    formattedResults = results.map((item, i) => ({
      sno: i + 1,
      memberid: formatValue(item.memberid),
      name: formatValue(item.name),
      hostel: formatValue(item.hostel),
      out_time: formatValue(item.out_time),
      expected_return_time: formatValue(item.expected_return_time),
    }));
  } else if (title === "CurrentInsideReport") {
    formattedResults = results.map((item, i) => ({
      sno: i + 1,
      memberid: formatValue(item.memberid),
      name: formatValue(item.name),
      hostel: formatValue(item.hostel),
      out_time: formatValue(item.out_time),
      expected_return_time: formatValue(item.expected_return_time),
    }));
  }

  // ==========================================
  // 🔹 Split into chunks (for large data sets)
  // ==========================================
  const chunks = [];
  for (let i = 0; i < formattedResults.length; i += chunkSize) {
    chunks.push(formattedResults.slice(i, i + chunkSize));
  }

  const cluster = await Cluster.launch({
    concurrency: Cluster.CONCURRENCY_CONTEXT,
    maxConcurrency: 4,
    puppeteerOptions: {
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    },
  });

  const pdfPaths = [];

  await cluster.task(async ({ page, data }) => {
    const { rows, index } = data;
    const generatedOn = new Date().toLocaleString("en-IN", {
      timeZone: "Asia/Kolkata",
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

    let reportTitle = "";
    let tableHeaders = "";
    let tableRows = "";

    if (title === "StudentSummaryReport") {
      reportTitle = "Student Summary Report";

      tableHeaders = `
    <tr>
      <th>S.No</th>
      <th>Member ID</th>
      <th>Name</th>
      <th>Mobile</th>
      <th>Email</th>
      <th>Parent Name</th>
      <th>Parent Contact</th>
      <th>Expiry Date</th>
      <th>Total Movements</th>
      <th>Total Outside</th>
      <th>Total Returned</th>
    </tr>`;

      tableRows = rows
        .map(
          (item, i) => `
    <tr>
      <td>${i + 1 + index * chunkSize}</td>
      <td>${item.memberid}</td>
      <td>${item.name}</td>
      <td>${item.mobile}</td>
      <td>${item.email}</td>
      <td>${item.parentname}</td>
      <td>${item.parentcontact}</td>
      <td>${item.expirydate}</td>
      <td>${item.total_movements}</td>
      <td>${item.total_outside}</td>
      <td>${item.total_returned}</td>
    </tr>`
        )
        .join("");
    }

    if (title === "StudentMovementReport") {
      reportTitle = "Student Movement Report";
      tableHeaders = `
    <tr>
      <th>S.No</th>
      <th>Member ID</th>
      <th>Name</th>
      <th>Hostel</th>
      <th>Out Time</th>
      <th>In Time</th>
      <th>Allowed Out</th>
      <th>Expected Return</th>
      <th>Status</th>
    </tr>`;

      tableRows = rows
        .map(
          (item, i) => `
    <tr>
      <td>${i + 1 + index * chunkSize}</td>
      <td>${item.memberid}</td>
      <td>${item.name}</td>
      <td>${item.hostel}</td>
      <td>${item.out_time}</td>
      <td>${item.in_time}</td>
      <td>${item.allowed_out_time}</td>
      <td>${item.expected_return_time}</td>
      <td>${item.status}</td>
    </tr>`
        )
        .join("");
    } else if (title === "LateReturnReport") {
      reportTitle = "Late Return Report";
      tableHeaders = `
    <tr>
      <th>S.No</th>
      <th>Member ID</th>
      <th>Name</th>
      <th>Hostel</th>
      <th>Out Time</th>
      <th>In Time</th>
    </tr>`;

      tableRows = rows
        .map(
          (item, i) => `
    <tr>
      <td>${i + 1 + index * chunkSize}</td>
      <td>${item.memberid}</td>
      <td>${item.name}</td>
      <td>${item.hostel}</td>
      <td>${item.out_time}</td>
      <td>${item.in_time}</td>
    </tr>`
        )
        .join("");
    } else if (title === "CurrentOutsideReport") {
      reportTitle = "Students Currently Outside Report";
      tableHeaders = `
    <tr>
      <th>S.No</th>
      <th>Member ID</th>
      <th>Name</th>
      <th>Hostel</th>
      <th>Out Time</th>
    </tr>`;

      tableRows = rows
        .map(
          (item, i) => `
    <tr>
      <td>${i + 1 + index * chunkSize}</td>
      <td>${item.memberid}</td>
      <td>${item.name}</td>
      <td>${item.hostel}</td>
      <td>${item.out_time}</td>
    </tr>`
        )
        .join("");
    } else if (title === "CurrentInsideReport") {
      reportTitle = "Students Currently Outside Report";
      tableHeaders = `
    <tr>
      <th>S.No</th>
      <th>Member ID</th>
      <th>Name</th>
      <th>Hostel</th>
      <th>Out Time</th>
    </tr>`;

      tableRows = rows
        .map(
          (item, i) => `
    <tr>
      <td>${i + 1 + index * chunkSize}</td>
      <td>${item.memberid}</td>
      <td>${item.name}</td>
      <td>${item.hostel}</td>
      <td>${item.out_time}</td>
    </tr>`
        )
        .join("");
    }

    const html = `
      <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; padding: 20px; }
            h1 { text-align: center; margin-bottom: 0; }
            .sub { text-align: center; color: #555; font-size: 12px; margin-top: 4px; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; }
            th, td { border: 1px solid #ccc; padding: 6px; font-size: 11px; text-align: center; }
            th { background-color: #f2f2f2; font-weight: bold; }
            td { word-break: break-word; }
          </style>
        </head>
        <body>
          <h1>${reportTitle}</h1>
          <div class="sub">Generated on ${generatedOn}</div>
          <table>
            <thead>${tableHeaders}</thead>
            <tbody>${tableRows}</tbody>
          </table>
        </body>
      </html>`;

    await page.setContent(html, { waitUntil: "load" });
    const pdfPath = path.join(__dirname, `${title}_part_${index + 1}.pdf`);
    await page.pdf({ path: pdfPath, format: "A4", printBackground: true });
    pdfPaths.push(pdfPath);
  });

  chunks.forEach((rows, index) => cluster.queue({ rows, index }));

  await cluster.idle();
  await cluster.close();

  // ==========================================
  // 📚 Merge All Parts
  // ==========================================
  const mergedPdf = await PDFDocument.create();
  for (const pdfPath of pdfPaths) {
    const pdfBytes = fs.readFileSync(pdfPath);
    const pdf = await PDFDocument.load(pdfBytes);
    const copiedPages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
    copiedPages.forEach((page) => mergedPdf.addPage(page));
  }

  fs.writeFileSync(outputPath, await mergedPdf.save());
  pdfPaths.forEach((f) => fs.unlinkSync(f));

  console.log(`✅ PDF generated successfully: ${outputPath}`);
  return outputPath;
}

export function generateExcel(results, title) {
  const formatValue = (val) =>
    val === null || val === undefined || val === "" || val === "N/A"
      ? "-"
      : val;

  let selectedFields = [];

  // ---------------------------------------------------------
  // 🟦 Student Summary Report (MATCH PDF)
  // ---------------------------------------------------------
  if (title === "StudentSummaryReport") {
    selectedFields = results.map((item, i) => ({
      "S.No": i + 1,
      "Member ID": formatValue(item.memberid),
      Name: formatValue(item.name),
      Mobile: formatValue(item.mobile),
      Email: formatValue(item.email),
      "Parent Name": formatValue(item.parentname),
      "Parent Contact": formatValue(item.parentcontact),
      "Expiry Date": formatValue(item.expirydate),
      "Total Movements": formatValue(item.total_movements),
      "Currently Outside": formatValue(item.total_outside),
      "Returned Count": formatValue(item.total_returned),
    }));
  }

  // ---------------------------------------------------------
  // 🟦 Student Movement Report (MATCH PDF)
  // ---------------------------------------------------------
  else if (title === "StudentMovementReport") {
    selectedFields = results.map((item, i) => ({
      "S.No": i + 1,
      "Member ID": formatValue(item.memberid),
      Name: formatValue(item.name),
      Hostel: formatValue(item.hostel),
      "Out Time": formatValue(item.out_time),
      "In Time": formatValue(item.in_time),
      "Allowed Out Time": formatValue(item.allowed_out_time),
      "Expected Return": formatValue(item.expected_return_time),
      Status: formatValue(item.status),
    }));
  }

  // ---------------------------------------------------------
  // 🟥 Late Return Report (MATCH PDF)
  // ---------------------------------------------------------
  else if (title === "LateReturnReport") {
    selectedFields = results.map((item, i) => ({
      "S.No": i + 1,
      "Member ID": formatValue(item.memberid),
      Name: formatValue(item.name),
      Hostel: formatValue(item.hostel),
      "Out Time": formatValue(item.out_time),
      "In Time": formatValue(item.in_time),
    }));
  }

  // ---------------------------------------------------------
  // 🟧 Current Outside Report (MATCH PDF)
  // ---------------------------------------------------------
  else if (title === "CurrentOutsideReport") {
    selectedFields = results.map((item, i) => ({
      "S.No": i + 1,
      "Member ID": formatValue(item.memberid),
      Name: formatValue(item.name),
      Hostel: formatValue(item.hostel),
      "Out Time": formatValue(item.out_time),
    }));
  } else if (title === "CurrentInsideReport") {
    selectedFields = results.map((item, i) => ({
      "S.No": i + 1,
      "Member ID": formatValue(item.memberid),
      Name: formatValue(item.name),
      Hostel: formatValue(item.hostel),
      "Out Time": formatValue(item.out_time),
    }));
  }

  // ---------------------------------------------------------
  // 📘 Generate Excel
  // ---------------------------------------------------------
  const workbook = xlsx.utils.book_new();
  const worksheet = xlsx.utils.json_to_sheet(selectedFields);

  xlsx.utils.book_append_sheet(workbook, worksheet, title);

  return xlsx.write(workbook, { bookType: "xlsx", type: "buffer" });
}

export const getAssetDetails = async (req, res) => {
  try {
    const params = { ...req.query, ...req.body };

    const {
      fromDate,
      toDate,
      vehiclenumber = "",
      vehiclerfid = "",
      location = "",
      location1 = "",
      user = "",
      status = "",
      product_types = [],
      type,
      page,
      pagesize,
    } = params;

    const userId = req.user?.userId;
    const roleId = req.user?.roleId;

    if (!userId) {
      return res.status(401).json({
        status: false,
        message: "Unauthorized - Missing user ID",
      });
    }

    // ✅ Check user role
    const [roleResult] = await db.query("SELECT name FROM roles WHERE id = ?", {
      replacements: [roleId],
      type: db.QueryTypes.SELECT,
    });

    const isSuperAdmin = roleResult?.name?.toLowerCase() === "superadmin";

    // ✅ Pagination
    const pageSize = parseInt(pagesize) || 10;
    const currentPage = parseInt(page) || 1;
    const offset = (currentPage - 1) * pageSize;

    // ✅ Date validation
    const QueryDate = await getCurrentISTDate();
    if (fromDate > QueryDate || toDate > QueryDate || fromDate > toDate) {
      return res.status(400).json({
        status: false,
        message: "Date cannot be a future or invalid range.",
      });
    }

    let locationIds = [];
    let assetIds = [];

    // ✅ If not SuperAdmin, apply location-based restriction
    if (!isSuperAdmin) {
      const userLocations = await db.query(
        "SELECT gmastervalue_id FROM userlocationmap WHERE users_id = ?",
        {
          replacements: [userId],
          type: db.QueryTypes.SELECT,
        }
      );

      if (!userLocations.length) {
        return res.status(200).json({
          status: true,
          count: 0,
          page: currentPage,
          pageSize,
          data: [],
        });
      }

      locationIds = userLocations.map((loc) => loc.gmastervalue_id);
      const placeholders = locationIds.map(() => "?").join(",");

      const allowedAssets = await db.query(
        `
        SELECT DISTINCT agm.asset_id
        FROM assetgmastermap agm
        WHERE agm.gmastervalue_id IN (${placeholders})
        `,
        { replacements: locationIds, type: db.QueryTypes.SELECT }
      );

      assetIds = allowedAssets.map((a) => a.asset_id);

      if (!assetIds.length) {
        return res.status(200).json({
          status: true,
          count: 0,
          page: currentPage,
          pageSize,
          data: [],
        });
      }
    }

    // ✅ Base where clause
    let whereClause = "1=1";
    const replacements = [];

    // 🔹 Apply asset filtering only if not SuperAdmin
    if (!isSuperAdmin) {
      const assetPlaceholders = assetIds.map(() => "?").join(",");
      whereClause = `a.id IN (${assetPlaceholders})`;
      replacements.push(...assetIds);
    }

    // 🔹 Date filters
    if (fromDate && toDate) {
      whereClause += ` AND DATE_FORMAT(a.createdat, '%Y-%m-%d') BETWEEN ? AND ?`;
      replacements.push(fromDate, toDate);
    } else if (fromDate) {
      whereClause += ` AND DATE_FORMAT(a.createdat, '%Y-%m-%d') >= ?`;
      replacements.push(fromDate);
    } else if (toDate) {
      whereClause += ` AND DATE_FORMAT(a.createdat, '%Y-%m-%d') <= ?`;
      replacements.push(toDate);
    }

    // 🔹 Vehicle number filter
    if (vehiclenumber) {
      whereClause += ` AND a.vehiclenumber LIKE ?`;
      replacements.push(`%${vehiclenumber}%`);
    }

    // 🔹 Vehicle RFID filter
    if (vehiclerfid) {
      whereClause += ` AND a.vehiclerfid LIKE ?`;
      replacements.push(`%${vehiclerfid}%`);
    }

    // 🔹 Status filter
    if (status) {
      whereClause += ` AND a.status = ?`;
      replacements.push(status);
    }

    // 🔹 User filter
    if (user) {
      whereClause += ` AND a.createdby = ?`;
      replacements.push(user);
    }

    // 🔹 Location filters
    if (location) {
      whereClause += " AND gv_loc1.id = ?";
      replacements.push(location);
    }
    if (location1) {
      whereClause += " AND gv_loc2.id = ?";
      replacements.push(location1);
    }

    // 🔹 Product type filter
    if (Array.isArray(product_types) && product_types.length > 0) {
      const productTypeIds = product_types.map((pt) => pt.id);
      const placeholdersPT = productTypeIds.map(() => "?").join(",");
      whereClause += `
        AND a.id IN (
          SELECT asset_id FROM assetmastermap
          WHERE master_id = 1 AND value IN (${placeholdersPT})
        )`;
      replacements.push(...productTypeIds);
    }

    // ✅ Joins
    const QueryJoins = `
      LEFT JOIN users u ON a.createdby = u.id
      LEFT JOIN (SELECT * FROM assetgmastermap WHERE gmastervalue_id IN 
          (SELECT id FROM gmastervalue WHERE gmaster_id = 1)
      ) agm_loc1 ON agm_loc1.asset_id = a.id
      LEFT JOIN gmastervalue gv_loc1 ON gv_loc1.id = agm_loc1.gmastervalue_id
      LEFT JOIN (SELECT * FROM assetgmastermap WHERE gmastervalue_id IN 
          (SELECT id FROM gmastervalue WHERE gmaster_id = 2)
      ) agm_loc2 ON agm_loc2.asset_id = a.id
      LEFT JOIN gmastervalue gv_loc2 ON gv_loc2.id = agm_loc2.gmastervalue_id
      LEFT JOIN assetmastermap pm ON a.id = pm.asset_id
      LEFT JOIN master m1 ON pm.master_id = m1.id
    `;

    const baseQuery = `
      SELECT 
        a.id, 
        a.vehiclenumber, 
        a.vehiclerfid,
        DATE_FORMAT(a.createdat, '%Y-%m-%d %H:%i:%s') AS createdat,
        CASE WHEN a.status = 1 THEN 'Active' ELSE 'Inactive' END AS status,
        gv_loc1.name AS location,
        gv_loc2.name AS location1,
        u.username AS username,
        GROUP_CONCAT(DISTINCT m1.name SEPARATOR ', ') AS product_types
      FROM asset a
      ${QueryJoins}
      WHERE ${whereClause}
      GROUP BY a.id
      ORDER BY a.id ASC
    `;

    const countQuery = `
      SELECT a.id as total
      FROM asset a
      ${QueryJoins}
      WHERE ${whereClause}
      GROUP BY a.id
    `;

    const countResult = await db.query(countQuery, { replacements });
    const total = countResult?.[0]?.length || countResult.length || 0;

    let results;
    if (type === "pdf" || type === "excel" || !pagesize) {
      results = await db.query(baseQuery, {
        replacements,
        type: db.QueryTypes.SELECT,
      });
    } else {
      results = await db.query(`${baseQuery} LIMIT ? OFFSET ?`, {
        replacements: [...replacements, pageSize, offset],
        type: db.QueryTypes.SELECT,
      });
    }

    const title = "Vehicle_Management_Report";

    // ✅ PDF & Excel export
    if (type === "pdf") {
      const outputPath = await generatePDF(req, results, title);
      return res.download(outputPath, `${title}.pdf`);
    } else if (type === "excel") {
      const buffer = generateExcel(results, title);
      res.setHeader(
        "Content-Disposition",
        `attachment; filename=${title}.xlsx`
      );
      res.setHeader(
        "Content-Type",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      );
      return res.send(buffer);
    }

    // ✅ JSON Response
    return res.status(200).json({
      status: true,
      count: total,
      page: currentPage,
      pageSize,
      data: results,
    });
  } catch (error) {
    console.error("Error generating asset details report:", error);
    return res.status(500).json({
      status: false,
      message: error.message || "Error generating asset details report",
      error: error.message,
    });
  }
};

export const assetLastTracking = async (req, res) => {
  try {
    const {
      fromDate,
      toDate,
      vehiclenumber,
      vehiclerfid,
      location,
      place,
      gate,
      status,
      movement_type,
      pagesize,
      page,
      type,
    } = req.query;

    const userId = req.user?.userId;
    const roleId = req.user?.roleId;

    if (!userId) {
      return res.status(401).json({
        status: false,
        message: "Unauthorized - Missing user ID",
      });
    }

    // ✅ Get current date and validate range
    const QueryDate = await getCurrentISTDate();
    if (fromDate > QueryDate || toDate > QueryDate || fromDate > toDate) {
      return res.status(400).json({
        status: false,
        message: "Invalid date range (future date not allowed).",
      });
    }

    // ✅ Check user role
    const [roleResult] = await db.query("SELECT name FROM roles WHERE id = ?", {
      replacements: [roleId],
      type: db.QueryTypes.SELECT,
    });

    const isSuperAdmin = roleResult?.name?.toLowerCase() === "superadmin";

    let assetIds = [];
    let whereClause = "1=1";
    const replacements = [];

    if (!isSuperAdmin) {
      const [mappedLocations] = await db.query(
        `SELECT gmastervalue_id FROM userlocationmap WHERE users_id = ?`,
        { replacements: [userId] }
      );

      const locationIds = mappedLocations.map((row) => row.gmastervalue_id);

      if (!locationIds.length) {
        return res.status(200).json({
          status: true,
          count: 0,
          data: [],
          message: "No mapped locations found for this user",
        });
      }

      // ✅ Directly filter vehicle_movement by location_id
      whereClause += ` AND vm.location_id IN (${locationIds
        .map(() => "?")
        .join(",")})`;
      replacements.push(...locationIds);
    }

    // ✅ Common filters
    if (fromDate && toDate) {
      whereClause += ` AND DATE(vm.transtime) BETWEEN ? AND ?`;
      replacements.push(fromDate, toDate);
    } else if (fromDate) {
      whereClause += ` AND DATE(vm.transtime) >= ?`;
      replacements.push(fromDate);
    } else if (toDate) {
      whereClause += ` AND DATE(vm.transtime) <= ?`;
      replacements.push(toDate);
    }

    if (vehiclenumber) {
      whereClause += ` AND LOWER(vm.vehiclenumber) LIKE ?`;
      replacements.push(`%${vehiclenumber.toLowerCase()}%`);
    }

    if (vehiclerfid) {
      whereClause += ` AND LOWER(vm.vehiclerfid) LIKE ?`;
      replacements.push(`%${vehiclerfid.toLowerCase()}%`);
    }

    if (location) {
      whereClause += ` AND vm.location_id = ?`;
      replacements.push(location);
    }

    if (place) {
      whereClause += ` AND vm.place_id = ?`;
      replacements.push(place);
    }

    if (gate) {
      whereClause += ` AND vm.gate_id = ?`;
      replacements.push(gate);
    }

    if (status) {
      whereClause += ` AND vm.status = ?`;
      replacements.push(status);
    }

    if (movement_type) {
      whereClause += ` AND vm.movement_type = ?`;
      replacements.push(movement_type);
    }

    // ✅ Joins
    const QueryJoins = `
      LEFT JOIN gmastervalue gloc ON gloc.id = vm.location_id
      LEFT JOIN gmastervalue ggate ON ggate.id = vm.gate_id
      LEFT JOIN gmastervalue gplace ON gplace.id = vm.place_id
      LEFT JOIN users u ON u.id = vm.createdby
    `;

    // ✅ Main query
    const baseQuery = `
      SELECT 
        vm.id,
        vm.vehicle_id,
        vm.vehiclenumber,
        vm.vehiclerfid,
        gloc.name AS location,
        ggate.name AS location1,
        gplace.name AS place,
        vm.movement_type AS status,
        DATE_FORMAT(vm.transtime, '%Y-%m-%d %H:%i:%s') AS transtime,
        u.username AS createdby,
        vm.remarks
      FROM vehicle_movement vm
      ${QueryJoins}
      WHERE ${whereClause}
      ORDER BY vm.transtime DESC
    `;

    // ✅ Count query
    const countQuery = `
      SELECT COUNT(*) AS total
      FROM vehicle_movement vm
      ${QueryJoins}
      WHERE ${whereClause}
    `;

    // ✅ Execute count
    const [countResult] = await db.query(countQuery, { replacements });
    const totalCount = countResult[0]?.total || 0;

    // ✅ Pagination
    const pageInt = parseInt(page) || 1;
    const limitInt = parseInt(pagesize) || 10;
    const offset = (pageInt - 1) * limitInt;

    let results;
    if (type === "pdf" || type === "excel" || !pagesize) {
      [results] = await db.query(baseQuery, { replacements });
    } else {
      [results] = await db.query(`${baseQuery} LIMIT ? OFFSET ?`, {
        replacements: [...replacements, limitInt, offset],
      });
    }

    const title = "Vehicle_Movement_Report";

    // ✅ PDF Export
    if (type === "pdf") {
      const outputPath = await generatePDF(req, results, title);
      return res.download(outputPath, `${title}.pdf`);
    }

    // ✅ Excel Export
    if (type === "excel") {
      const buffer = generateExcel(results, title);
      res.setHeader(
        "Content-Disposition",
        `attachment; filename=${title}.xlsx`
      );
      res.setHeader(
        "Content-Type",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      );
      return res.send(buffer);
    }

    // ✅ JSON response
    return res.status(200).json({
      status: true,
      count: totalCount,
      page: pageInt,
      pageSize: limitInt,
      data: results,
    });
  } catch (error) {
    console.error("Error generating vehicle movement report:", error);
    return res.status(500).json({
      status: false,
      message: "Error generating vehicle movement report",
      error: error.message,
    });
  }
};

// common for all without their location value all value show

// export const assetLastTracking = async (req, res) => {
//   try {
//     const {
//       fromDate,
//       toDate,
//       vehiclenumber,
//       vehiclerfid,
//       location,
//       place,
//       gate,
//       user,
//       status,
//       movement_type,
//       pagesize,
//       page,
//       type,
//     } = req.query;

//     const QueryDate = await getCurrentISTDate();

//     // ✅ Date validation
//     if (fromDate > QueryDate || toDate > QueryDate || fromDate > toDate) {
//       return res.status(400).json({
//         status: false,
//         message: "Invalid date range (future date not allowed).",
//       });
//     }

//     let whereClause = "1=1";
//     const replacements = [];

//     // ✅ Date filters
//     if (fromDate && toDate) {
//       whereClause += ` AND DATE(vm.transtime) BETWEEN ? AND ?`;
//       replacements.push(fromDate, toDate);
//     } else if (fromDate) {
//       whereClause += ` AND DATE(vm.transtime) >= ?`;
//       replacements.push(fromDate);
//     } else if (toDate) {
//       whereClause += ` AND DATE(vm.transtime) <= ?`;
//       replacements.push(toDate);
//     }

//     // ✅ Dynamic filters
//     if (vehiclenumber) {
//       whereClause += ` AND LOWER(vm.vehiclenumber) LIKE ?`;
//       replacements.push(`%${vehiclenumber.toLowerCase()}%`);
//     }

//     if (vehiclerfid) {
//       whereClause += ` AND LOWER(vm.vehiclerfid) LIKE ?`;
//       replacements.push(`%${vehiclerfid.toLowerCase()}%`);
//     }

//     if (location) {
//       whereClause += ` AND vm.location_id = ?`;
//       replacements.push(location);
//     }

//     if (place) {
//       whereClause += ` AND vm.place_id = ?`;
//       replacements.push(place);
//     }

//     if (gate) {
//       whereClause += ` AND vm.gate_id = ?`;
//       replacements.push(gate);
//     }

//     if (user) {
//       whereClause += ` AND vm.createdby = ?`;
//       replacements.push(user);
//     }

//     if (status) {
//       whereClause += ` AND vm.status = ?`;
//       replacements.push(status);
//     }

//     if (movement_type) {
//       whereClause += ` AND vm.movement_type = ?`;
//       replacements.push(movement_type);
//     }

//     // ✅ Joins without hardcoding gmaster_id
//     const QueryJoins = `
//   LEFT JOIN gmastervalue gloc ON gloc.gmaster_id = vm.location_id
//   LEFT JOIN gmastervalue ggate ON ggate.gmaster_id = vm.gate_id
//   LEFT JOIN gmastervalue gplace ON gplace.gmaster_id = vm.place_id
//   LEFT JOIN users u ON u.id = vm.createdby
//   LEFT JOIN asset a ON a.id = vm.vehicle_id
// `;

//     const baseQuery = `
//   SELECT
//     vm.id,
//     vm.vehicle_id,
//     vm.vehiclenumber AS vehiclenumber,
//     vm.vehiclerfid,
//     gloc.name AS location,              -- ✅ Location Name
//     ggate.name AS location1,            -- ✅ Gate Name renamed as 'location1'
//     vm.movement_type,
//     vm.movement_type AS status,         -- ✅ Added movement_type as status
//     DATE_FORMAT(vm.transtime, '%Y-%m-%d %H:%i:%s') AS transtime,
//     u.username AS createdby,
//     vm.remarks
//   FROM vehicle_movement vm
//   ${QueryJoins}
//   WHERE ${whereClause}
//   GROUP BY vm.id
//   ORDER BY vm.transtime DESC
// `;

//     // ✅ Count query
//     const countQuery = `
//       SELECT COUNT(*) AS total
//       FROM vehicle_movement vm
//       ${QueryJoins}
//       WHERE ${whereClause}
//     `;

//     // ✅ Execute count query
//     const [countResult] = await db.query(countQuery, { replacements });
//     const totalCount = countResult[0]?.total || 0;

//     // ✅ Fetch paginated or full data
//     let results;
//     if (type === "pdf" || type === "excel" || !pagesize) {
//       [results] = await db.query(baseQuery, { replacements });
//     } else {
//       const pageInt = parseInt(page) || 1;
//       const limitInt = parseInt(pagesize) || 10;
//       const offset = (pageInt - 1) * limitInt;
//       [results] = await db.query(`${baseQuery} LIMIT ? OFFSET ?`, {
//         replacements: [...replacements, limitInt, offset],
//       });
//     }

//     const title = "Vehicle_Tracking_Report";

//     // ✅ Export as PDF
//     if (type === "pdf") {
//       try {
//         const outputPath = await generatePDF(req, results, title);
//         return res.download(
//           outputPath,
//           "Vehicle_Movement_Report.pdf",
//           (err) => {
//             if (err) {
//               console.error("PDF download error:", err);
//               return res.status(500).json({
//                 status: false,
//                 message: "Error downloading PDF",
//               });
//             }
//           }
//         );
//       } catch (error) {
//         console.error("Error generating PDF:", error);
//         return res.status(500).json({
//           status: false,
//           message: "Error generating PDF",
//           error: error.message,
//         });
//       }
//     }

//     // ✅ Export as Excel
//     if (type === "excel") {
//       try {
//         const buffer = generateExcel(results, title);
//         res.setHeader(
//           "Content-Disposition",
//           "attachment; filename=vehicle_movement_report.xlsx"
//         );
//         res.setHeader(
//           "Content-Type",
//           "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
//         );
//         return res.send(buffer);
//       } catch (error) {
//         console.error("Excel generation error:", error);
//         return res.status(500).json({
//           status: false,
//           message: "Failed to generate Excel report",
//           error: error.message,
//         });
//       }
//     }

//     // ✅ Default JSON Response
//     return res.status(200).json({
//       status: true,
//       count: totalCount,
//       page: parseInt(page) || 1,
//       pageSize: parseInt(pagesize) || 10,
//       data: results,
//     });
//   } catch (error) {
//     console.error("Error generating vehicle movement report:", error);
//     return res.status(500).json({
//       status: false,
//       message: "Error generating vehicle movement report",
//       error: error.message,
//     });
//   }
// };

export const visitorVehicleReports = async (req, res) => {
  try {
    const {
      fromDate,
      toDate,
      check_in,
      check_out,
      visitor_name,
      vehicle_number,
      mobile,
      company,
      location_id,
      status,
      rfid_tag,
      pagesize,
      page,
      type,
    } = req.query;

    const userId = req.user?.userId;
    const roleId = req.user?.roleId;

    if (!userId || !roleId) {
      return res.status(401).json({
        status: false,
        message: "Unauthorized - Missing user or role ID",
      });
    }

    console.log("🧩 Logged-in userId:", userId, "roleId:", roleId);

    // ✅ Step 1: Get role name from roles table
    const [roleData] = await db.query("SELECT name FROM roles WHERE id = ?", {
      replacements: [roleId],
      type: db.QueryTypes.SELECT,
    });

    const roleName = roleData?.name?.toLowerCase() || "";

    // ✅ Filters
    const filters = [];
    const values = [];

    const isDateOnly = (val) => /^\d{4}-\d{2}-\d{2}$/.test(val);

    // 🗓 From–To Date (Check-In)
    if (fromDate && toDate) {
      let fromValue = fromDate;
      let toValue = toDate;
      if (isDateOnly(fromDate)) fromValue = `${fromDate} 00:00:00`;
      if (isDateOnly(toDate)) toValue = `${toDate} 23:59:59`;
      filters.push(`v.check_in BETWEEN ? AND ?`);
      values.push(fromValue, toValue);
    }

    // 🕓 Check-In / Check-Out Range
    if (check_in && check_out) {
      let fromValue = check_in;
      let toValue = check_out;
      if (isDateOnly(check_in)) fromValue = `${check_in} 00:00:00`;
      if (isDateOnly(check_out)) toValue = `${check_out} 23:59:59`;
      filters.push(
        `(v.check_in BETWEEN ? AND ? OR v.check_out BETWEEN ? AND ?)`
      );
      values.push(fromValue, toValue, fromValue, toValue);
    }

    // 👤 Other Filters
    if (visitor_name) {
      filters.push(`LOWER(v.visitor_name) LIKE LOWER(?)`);
      values.push(`%${visitor_name}%`);
    }
    if (vehicle_number) {
      filters.push(`LOWER(v.vehicle_number) LIKE LOWER(?)`);
      values.push(`%${vehicle_number}%`);
    }
    if (mobile) {
      filters.push(`v.mobile LIKE ?`);
      values.push(`%${mobile}%`);
    }
    if (company) {
      filters.push(`LOWER(v.company) LIKE LOWER(?)`);
      values.push(`%${company}%`);
    }
    if (location_id) {
      filters.push(`v.location_id = ?`);
      values.push(location_id);
    }
    if (status) {
      filters.push(`v.status = ?`);
      values.push(status);
    }
    if (rfid_tag) {
      filters.push(`v.rfid_tag LIKE ?`);
      values.push(`%${rfid_tag}%`);
    }

    // ✅ Apply location-based restriction (only if not super admin) const isSuperAdmin =
    const isSuperAdmin =
      roleName === "superadmin" || roleName === "super admin";
    if (!isSuperAdmin) {
      const [userLocations] = await db.query(
        `SELECT gmastervalue_id FROM userlocationmap WHERE users_id = ?`,
        { replacements: [userId] }
      );

      const mappedLocationIds = userLocations.map((row) => row.gmastervalue_id);

      if (mappedLocationIds.length > 0) {
        filters.push(
          `v.location_id IN (${mappedLocationIds.map(() => "?").join(",")})`
        );
        values.push(...mappedLocationIds);
      } else {
        // If no mapped locations, return empty result
        return res.status(200).json({
          status: true,
          count: 0,
          page: 1,
          pageSize: parseInt(pagesize) || 10,
          data: [],
        });
      }
    }

    const whereClause = filters.length ? `WHERE ${filters.join(" AND ")}` : "";
    const orderBy = `ORDER BY v.check_in DESC`;

    // ✅ Count query
    const countQuery = `
      SELECT COUNT(*) AS total
      FROM visitor_vehicles v
      ${whereClause}
    `;
    const [countResult] = await db.query(countQuery, { replacements: values });
    const totalCount = countResult?.[0]?.total || 0;

    // ✅ Pagination
    const pageInt = parseInt(page) || 1;
    const limitInt = parseInt(pagesize) || 10;
    const offset = (pageInt - 1) * limitInt;

    // ✅ Main query
    const baseQuery = `
      SELECT
        v.id AS visitor_vehicle_id,
        v.visitor_name,
        v.vehicle_number,
        v.mobile,
        v.purpose,
        v.company,
        v.visiting_person,
        v.rfid_tag,
        v.status,
        v.check_in,
        v.expected_exit_time,
        v.check_out,
        gloc.name AS location_name
      FROM visitor_vehicles v
      LEFT JOIN gmastervalue gloc ON gloc.id = v.location_id
      ${whereClause}
      ${orderBy}
    `;

    let results;
    if (type === "pdf" || type === "excel" || !pagesize) {
      [results] = await db.query(baseQuery, { replacements: values });
    } else {
      [results] = await db.query(`${baseQuery} LIMIT ? OFFSET ?`, {
        replacements: [...values, limitInt, offset],
      });
    }

    // ✅ Export
    const title = "Visitor_Report";
    if (type === "pdf") {
      const outputPath = await generatePDF(req, results, title);
      return res.download(outputPath, `${title}.pdf`);
    }
    if (type === "excel") {
      const buffer = generateExcel(results, title);
      res.setHeader(
        "Content-Disposition",
        `attachment; filename=${title}.xlsx`
      );
      res.setHeader(
        "Content-Type",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      );
      return res.send(buffer);
    }

    // ✅ Final JSON response
    return res.status(200).json({
      status: true,
      count: totalCount,
      page: pageInt,
      pageSize: limitInt,
      data: results,
    });
  } catch (error) {
    console.error("❌ Error fetching visitor vehicle reports:", error);
    return res.status(500).json({
      status: false,
      message: "Error fetching visitor vehicle reports",
      error: error.message,
    });
  }
};

// common for all without their location value all value show

// export const visitorVehicleReports = async (req, res) => {
//   try {
//     const {
//       fromDate,
//       toDate,
//       check_in,
//       check_out,
//       visitor_name,
//       vehicle_number,
//       mobile,
//       company,
//       location_id,
//       status,
//       rfid_tag,
//       pagesize = 10,
//       page = 1,
//       type, // 👈 added to detect PDF/Excel export
//     } = req.query;

//     const offset = (page - 1) * pagesize;
//     const filters = [];
//     const values = [];

//     // ✅ Detect date-only (YYYY-MM-DD)
//     const isDateOnly = (val) => /^\d{4}-\d{2}-\d{2}$/.test(val);

//     // 🗓 From–To Date
//     if (fromDate && toDate) {
//       let fromValue = fromDate;
//       let toValue = toDate;
//       if (isDateOnly(fromDate)) fromValue = `${fromDate} 00:00:00`;
//       if (isDateOnly(toDate)) toValue = `${toDate} 23:59:59`;
//       filters.push(`v.check_in BETWEEN ? AND ?`);
//       values.push(fromValue, toValue);
//     }

//     // 🕓 Check-In / Check-Out Range
//     if (check_in && check_out) {
//       let fromValue = check_in;
//       let toValue = check_out;
//       if (isDateOnly(check_in)) fromValue = `${check_in} 00:00:00`;
//       if (isDateOnly(check_out)) toValue = `${check_out} 23:59:59`;
//       filters.push(
//         `(v.check_in BETWEEN ? AND ? OR v.check_out BETWEEN ? AND ?)`
//       );
//       values.push(fromValue, toValue, fromValue, toValue);
//     }

//     // 👤 Filters
//     if (visitor_name) {
//       filters.push(`LOWER(v.visitor_name) LIKE LOWER(?)`);
//       values.push(`%${visitor_name}%`);
//     }
//     if (vehicle_number) {
//       filters.push(`LOWER(v.vehicle_number) LIKE LOWER(?)`);
//       values.push(`%${vehicle_number}%`);
//     }
//     if (mobile) {
//       filters.push(`v.mobile LIKE ?`);
//       values.push(`%${mobile}%`);
//     }
//     if (company) {
//       filters.push(`LOWER(v.company) LIKE LOWER(?)`);
//       values.push(`%${company}%`);
//     }

//     if (location_id) {
//       filters.push(`v.location_id = ?`);
//       values.push(location_id);
//     }
//     if (status) {
//       filters.push(`v.status = ?`);
//       values.push(status);
//     }
//     if (rfid_tag) {
//       filters.push(`v.rfid_tag LIKE ?`);
//       values.push(`%${rfid_tag}%`);
//     }

//     const whereClause = filters.length ? `WHERE ${filters.join(" AND ")}` : "";

//     // 🧮 Count query
//     const countQuery = `SELECT COUNT(*) AS count FROM visitor_vehicles v ${whereClause}`;
//     const [countResult] = await db.query(countQuery, {
//       replacements: values,
//       type: db.QueryTypes.SELECT,
//     });
//     const totalCount = countResult?.count || 0;

//     // 📋 Data query
//     const dataQuery = `
//       SELECT
//         v.id,
//         v.visitor_name,
//         v.vehicle_number,
//         v.mobile,
//         v.company,
//         v.rfid_tag,
//         v.status,
//         DATE_FORMAT(v.check_in, '%Y-%m-%d %H:%i:%s') AS check_in,
//         DATE_FORMAT(v.expected_exit_time, '%Y-%m-%d %H:%i:%s') AS expected_exit_time,
//         DATE_FORMAT(v.check_out, '%Y-%m-%d %H:%i:%s') AS check_out,
//         gv.name AS location_name
//       FROM visitor_vehicles v
//       LEFT JOIN gmastervalue gv ON v.location_id = gv.id
//       ${whereClause}
//       ORDER BY v.check_in DESC
//       ${type === "pdf" || type === "excel" ? "" : "LIMIT ? OFFSET ?"}
//     `;

//     const replacements =
//       type === "pdf" || type === "excel"
//         ? values
//         : [...values, +pagesize, +offset];

//     const data = await db.query(dataQuery, {
//       replacements,
//       type: db.QueryTypes.SELECT,
//     });

//     const title = "Visitor_Report";

//     // ============================================================
//     // 🧾 Export as PDF
//     // ============================================================
//     if (type === "pdf") {
//       const formattedData = data.map((item, i) => {
//         return {
//           sno: i + 1,
//           visitor_name: item.visitor_name || "-",
//           vehicle_number: item.vehicle_number || "-",
//           mobile: item.mobile || "-",
//           company: item.company || "-",
//           location_name: item.location_name || "-",
//           rfid_tag: item.rfid_tag || "-",
//           check_in: item.check_in || "-",
//           expected_exit_time: item.expected_exit_time || "-",
//           check_out: item.check_out || "-",
//           status: item.status,
//         };
//       });

//       const pdfPath = await generatePDF(req, formattedData, title);
//       return res.download(pdfPath, `${title}.pdf`, (err) => {
//         if (err) {
//           console.error("PDF download error:", err);
//           res.status(500).json({
//             status: false,
//             message: "Error downloading PDF",
//           });
//         }
//       });
//     }

//     // ============================================================
//     // 📘 Export as Excel
//     // ============================================================
//     if (type === "excel") {
//       const formattedData = data.map((item, i) => ({
//         sno: i + 1,
//         visitor_name: item.visitor_name || "-",
//         vehicle_number: item.vehicle_number || "-",
//         mobile: item.mobile || "-",
//         company: item.company || "-",
//         location_name: item.location_name || "-",
//         rfid_tag: item.rfid_tag || "-",
//         check_in: item.check_in || "-",
//         expected_exit_time: item.expected_exit_time || "-",
//         check_out: item.check_out || "-",
//         status: item.status,
//       }));

//       const buffer = generateExcel(formattedData, title);
//       res.setHeader(
//         "Content-Disposition",
//         `attachment; filename=${title}.xlsx`
//       );
//       res.setHeader(
//         "Content-Type",
//         "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
//       );
//       return res.send(buffer);
//     }

//     // ============================================================
//     // 🔹 Default JSON Response
//     // ============================================================
//     return res.status(200).json({
//       status: true,
//       count: totalCount,
//       page: +page,
//       pageSize: +pagesize,
//       data,
//     });
//   } catch (err) {
//     console.error("❌ Error fetching visitor vehicle reports:", err);
//     res.status(500).json({
//       status: false,
//       message: "Internal server error",
//       data: [],
//     });
//   }
// };

export const getStudentMovementReport = async (req, res) => {
  try {
    const {
      fromDate,
      toDate,
      memberid = "",
      location = "",
      pagesize = 10,
      page = 1,
      type,
    } = { ...req.query, ...req.body };

    const userId = req.user?.userId;
    const roleId = req.user?.roleId;

    if (!fromDate || !toDate) {
      return res.status(400).json({
        status: false,
        message: "fromDate and toDate are required",
      });
    }

    if (!userId) {
      return res.status(401).json({
        status: false,
        message: "Unauthorized - Missing user ID",
      });
    }

    // ROLE CHECK
    const [roleResult] = await db.query("SELECT name FROM roles WHERE id = ?", {
      replacements: [roleId],
    });
    const isSuperAdmin =
      roleResult && roleResult[0]?.name?.toLowerCase() === "superadmin";

    // 🔥 Get user mapped hostels if not superadmin
    let mappedHostels = [];
    if (!isSuperAdmin) {
      const [hostels] = await db.query(
        `SELECT hostel_id FROM userhostelmap WHERE users_id = ?`,
        { replacements: [userId] }
      );
      if (!hostels || hostels.length === 0) {
        return res.json({
          status: true,
          count: 0,
          data: [],
          message: "No hostel mapped to this user",
        });
      }
      mappedHostels = hostels.map((h) => h.hostel_id);
    }

    const pageSize = parseInt(pagesize);
    const offset = (page - 1) * pageSize;

    // Base WHERE clause
    let where = "DATE(sm.out_time) BETWEEN ? AND ?";
    const replacements = [fromDate, toDate];

    // Filter by location
    if (location) {
      where += " AND sm.hostel_id = ?";
      replacements.push(location);
    } else if (!isSuperAdmin) {
      const inClause = mappedHostels.join(",");
      where += ` AND sm.hostel_id IN (${inClause})`;
    }

    if (memberid) {
      where += " AND s.memberid LIKE ?";
      replacements.push(`%${memberid}%`);
    }

    const baseQuery = `
      SELECT 
        s.memberid,
        s.name,
        h.name AS hostel,
        sm.out_time,
        sm.in_time,
        sm.created_at,
        at.allowed_out_time,
        at.expected_return_time,
        TIMESTAMPDIFF(MINUTE, at.expected_return_time, sm.in_time) AS minutes_late,
        CASE 
          WHEN sm.in_time IS NULL THEN 'Outside'
          WHEN sm.in_time > at.expected_return_time THEN 'Late'
          ELSE 'Inside'
        END AS status
      FROM studentmovement sm
      JOIN student s ON sm.student_id = s.id
      JOIN hostel h ON sm.hostel_id = h.id
      JOIN allowedtime at ON at.hostel_id = sm.hostel_id
      WHERE ${where}
      ORDER BY sm.out_time ASC
    `;

    const paginatedQuery = `${baseQuery} LIMIT ? OFFSET ?`;
    const results = await db.query(paginatedQuery, {
      replacements: [...replacements, pageSize, offset],
      type: db.QueryTypes.SELECT,
    });

    // Format MySQL datetime
    const formatMySQLDateTime = (dt) => {
      if (!dt) return null;
      const str = new Date(dt).toISOString().slice(0, 19).replace("T", " ");
      const [datePart, timePart] = str.split(" ");
      const [yyyy, mm, dd] = datePart.split("-");
      let [hh, min, sec] = timePart.split(":").map(Number);
      const ampm = hh >= 12 ? "PM" : "AM";
      hh = hh % 12 || 12;
      return `${dd}/${mm}/${yyyy} ${String(hh).padStart(2, "0")}:${String(
        min
      ).padStart(2, "0")}:${String(sec).padStart(2, "0")} ${ampm}`;
    };

    const calculateOverdue = (row) => {
      if (!row.in_time || !row.expected_return_time) return null;

      const inTime = new Date(row.in_time);

      const [expH, expM, expS] = row.expected_return_time
        .split(":")
        .map(Number);

      const expectedReturn = new Date(
        inTime.getFullYear(),
        inTime.getMonth(),
        inTime.getDate(),
        expH,
        expM,
        expS
      );

      let diffMs = inTime - expectedReturn;
      if (diffMs <= 0) return "00:00:00";

      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
      const diffHrs = Math.floor(
        (diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)
      );
      const diffMin = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
      const diffSec = Math.floor((diffMs % (1000 * 60)) / 1000);

      const timePart = `${String(diffHrs).padStart(2, "0")}:${String(
        diffMin
      ).padStart(2, "0")}:${String(diffSec).padStart(2, "0")}`;

      return diffDays > 0 ? `${diffDays} day(s) ${timePart}` : timePart;
    };

    const formattedResults = results.map((row) => ({
      ...row,
      out_time: formatMySQLDateTime(row.out_time),
      in_time: formatMySQLDateTime(row.in_time),
      overdue: calculateOverdue(row),
    }));

    // Export logic
    if (type === "pdf" || type === "excel") {
      const fullResults = await db.query(baseQuery, {
        replacements,
        type: db.QueryTypes.SELECT,
      });
      const fullFormattedResults = fullResults.map((row) => ({
        ...row,
        out_time: formatMySQLDateTime(row.out_time),
        in_time: formatMySQLDateTime(row.in_time),
        overdue: calculateOverdue(row),
      }));

      const title = "StudentMovementReport";
      if (type === "pdf") {
        const outputPath = await generatePDF(req, fullFormattedResults, title);
        return res.download(outputPath, `${title}.pdf`);
      }
      if (type === "excel") {
        const buffer = generateExcel(fullFormattedResults, title);
        res.setHeader(
          "Content-Disposition",
          `attachment; filename=${title}.xlsx`
        );
        res.setHeader(
          "Content-Type",
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        );
        return res.send(buffer);
      }
    }

    // Count total records
    const countQuery = `
      SELECT COUNT(*) AS total
      FROM studentmovement sm
      JOIN student s ON sm.student_id = s.id
      WHERE ${where}
    `;
    const [[{ total }]] = await db.query(countQuery, { replacements });

    return res.json({
      status: true,
      page: parseInt(page),
      pageSize,
      count: total,
      data: formattedResults,
    });
  } catch (error) {
    console.error("Movement Error:", error);
    return res.status(500).json({ status: false, message: error.message });
  }
};

export const getLateReturnReport = async (req, res) => {
  try {
    const {
      fromDate,
      toDate,
      memberid = "",
      name = "",
      out_time = "",
      in_time = "",
      location = "",
      page = 1,
      pageSize = 10,
      type,
    } = { ...req.query, ...req.body };

    if (!fromDate || !toDate) {
      return res
        .status(400)
        .json({ status: false, message: "fromDate and toDate required" });
    }

    const offset = (page - 1) * pageSize;

    const query = `
     SELECT 
  s.memberid,
  s.name,
  h.name AS hostel,
  sm.out_time,
  sm.in_time,
  at.expected_return_time,
  CONCAT(DATE(sm.out_time), ' ', at.expected_return_time) AS expected_return_datetime,

  TIMESTAMPDIFF(
    MINUTE, 
    CONCAT(DATE(sm.out_time), ' ', at.expected_return_time),
    sm.in_time
  ) AS delay

FROM studentmovement sm
JOIN student s ON sm.student_id = s.id
JOIN hostel h ON sm.hostel_id = h.id
JOIN allowedtime at ON at.hostel_id = sm.hostel_id
WHERE 
  sm.status = 'IN'
  AND DATE(sm.created_at) BETWEEN ? AND ?
  AND sm.in_time > CONCAT(DATE(sm.out_time), ' ', at.expected_return_time)   -- returned late
  AND (s.memberid = ? OR ? = '')
  AND (s.name LIKE CONCAT('%', ?, '%') OR ? = '')
  AND (sm.out_time LIKE CONCAT('%', ?, '%') OR ? = '')
  AND (sm.in_time LIKE CONCAT('%', ?, '%') OR ? = '')
  AND (h.id = ? OR ? = '')
ORDER BY delay DESC
LIMIT ? OFFSET ?;

    `;

    const replacements = [
      fromDate,
      toDate,
      memberid,
      memberid,
      name,
      name,
      out_time,
      out_time,
      in_time,
      in_time,
      location,
      location,
      Number(pageSize),
      Number(offset),
    ];

    const results = await db.query(query, {
      replacements,
      type: db.QueryTypes.SELECT,
    });

    // Count total
    const countQuery = `
      SELECT COUNT(*) AS total FROM (
        SELECT
          CASE
            WHEN sm.in_time IS NULL AND NOW() > CONCAT(DATE(sm.out_time), ' ', at.expected_return_time) THEN 'Late'
            WHEN sm.in_time IS NOT NULL AND sm.in_time > CONCAT(DATE(sm.out_time), ' ', at.expected_return_time) THEN 'Late'
            ELSE 'On Time'
          END AS status
        FROM studentmovement sm
        JOIN allowedtime at ON at.hostel_id = sm.hostel_id
        WHERE DATE(sm.created_at) BETWEEN ? AND ?
        HAVING status = 'Late'
      ) AS temp
    `;

    const countRes = await db.query(countQuery, {
      replacements: [fromDate, toDate],
      type: db.QueryTypes.SELECT,
    });

    const totalCount = countRes[0]?.total || 0;

    const formatMySQLDateTime = (dt) =>
      dt ? dt.toISOString().slice(0, 19).replace("T", " ") : "-";

    const formattedResults = results.map((r, idx) => ({
      sno: offset + idx + 1,
      memberid: r.memberid,
      name: r.name,
      hostel: r.hostel,
      out_time: formatMySQLDateTime(r.out_time),
      in_time: formatMySQLDateTime(r.in_time),
      expected_return_time: r.expected_return_time,
      delay_minutes: r.delay,
      status: r.status,
    }));

    const title = "LateReturnReport";
    if (type === "pdf")
      return res.download(
        await generatePDF(req, formattedResults, title),
        `${title}.pdf`
      );
    if (type === "excel") {
      const buffer = generateExcel(formattedResults, title);
      res.setHeader(
        "Content-Disposition",
        `attachment; filename=${title}.xlsx`
      );
      res.setHeader(
        "Content-Type",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      );
      return res.send(buffer);
    }

    return res.json({
      status: true,
      page: Number(page),
      pageSize: Number(pageSize),
      count: totalCount,
      data: formattedResults,
    });
  } catch (error) {
    console.error("Late Return Error:", error);
    return res.status(500).json({ status: false, message: error.message });
  }
};

export const getStudentsCurrentlyOutsideReport = async (req, res) => {
  try {
    const {
      location = "",
      page = 1,
      pageSize = 10,
      type,
    } = {
      ...req.query,
      ...req.body,
    };

    const userId = req.user?.userId;
    const roleId = req.user?.roleId;

    if (!userId) {
      return res.status(401).json({
        status: false,
        message: "Unauthorized - Missing user ID",
      });
    }

    // ROLE CHECK
    const [roleResult] = await db.query("SELECT name FROM roles WHERE id = ?", {
      replacements: [roleId],
    });
    const isSuperAdmin =
      roleResult && roleResult[0]?.name?.toLowerCase() === "superadmin";

    // 🔥 Get user mapped hostels if not superadmin
    let mappedHostels = [];
    if (!isSuperAdmin) {
      const [hostels] = await db.query(
        `SELECT hostel_id FROM userhostelmap WHERE users_id = ?`,
        { replacements: [userId] }
      );
      if (hostels.length === 0) {
        return res.json({
          status: true,
          count: 0,
          data: [],
          message: "No hostel mapped to this user",
        });
      }
      mappedHostels = hostels.map((h) => h.hostel_id);
    }

    const offset = (page - 1) * pageSize;

    // Base WHERE clause
    let where = "sm.status = 'OUT'";
    const replacements = [];

    if (location) {
      where += " AND sm.hostel_id = ?";
      replacements.push(location);
    } else if (!isSuperAdmin) {
      // restrict to mapped hostels
      const inClause = mappedHostels.join(",");
      where += ` AND sm.hostel_id IN (${inClause})`;
    }

    const query = `
      SELECT 
        s.memberid,
        s.name,
        h.name AS hostel,
        sm.out_time,
        at.allowed_out_time,
        at.expected_return_time,
        CONCAT(DATE(sm.out_time), ' ', at.expected_return_time) AS expected_dt
      FROM studentmovement sm
      JOIN student s ON sm.student_id = s.id
      JOIN hostel h ON sm.hostel_id = h.id
      LEFT JOIN allowedtime at ON at.hostel_id = sm.hostel_id
      WHERE ${where}
      ORDER BY sm.out_time ASC
      LIMIT ? OFFSET ?
    `;

    const results = await db.query(query, {
      replacements: [...replacements, pageSize, offset],
      type: db.QueryTypes.SELECT,
    });

    const countQuery = `
      SELECT COUNT(*) AS total
      FROM studentmovement sm
      JOIN student s ON sm.student_id = s.id
      LEFT JOIN allowedtime at ON at.hostel_id = sm.hostel_id
      WHERE ${where}
    `;

    const totalRows = await db.query(countQuery, {
      replacements,
      type: db.QueryTypes.SELECT,
    });
    const count = totalRows[0]?.total || 0;

    const now = new Date();

    const formattedResults = results.map((r, idx) => {
      const outTime = new Date(r.out_time);
      const expectedDt = new Date(r.expected_dt);

      let status = "On Time";
      let overdueMinutes = 0;
      const nearOverdueThreshold = 10; // last 10 min

      const diffMinutes = Math.floor((expectedDt - now) / 60000);

      if (diffMinutes < 0) {
        status = "Overdue";
        overdueMinutes = Math.abs(diffMinutes);
      } else if (diffMinutes <= nearOverdueThreshold) {
        status = "Near Overdue";
      }

      const hrs = Math.floor(overdueMinutes / 60);
      const mins = overdueMinutes % 60;
      const overdueStr =
        status === "Overdue"
          ? `${hrs > 0 ? hrs + " Hr " : ""}${mins} Min`
          : "-";

      function formatMySQLDateTime(dt) {
        if (!dt) return "-";
        const str = dt.toISOString().slice(0, 19).replace("T", " ");
        const [datePart, timePart] = str.split(" ");
        const [yyyy, mm, dd] = datePart.split("-");
        let [hh, min, sec] = timePart.split(":").map(Number);
        const ampm = hh >= 12 ? "PM" : "AM";
        hh = hh % 12 || 12;
        return `${dd}/${mm}/${yyyy} ${String(hh).padStart(2, "0")}:${String(
          min
        ).padStart(2, "0")}:${String(sec).padStart(2, "0")} ${ampm}`;
      }

      return {
        sno: offset + idx + 1,
        memberid: r.memberid,
        name: r.name,
        hostel: r.hostel || "-",
        out_time: formatMySQLDateTime(outTime),
        expected_return_time: r.expected_return_time,
        overdue_status: status,
        overdue_minutes: overdueStr,
      };
    });

    const title = "CurrentOutsideReport";

    if (type === "pdf") {
      const outputPath = await generatePDF(req, formattedResults, title);
      return res.download(outputPath, `${title}.pdf`);
    }

    if (type === "excel") {
      const buffer = generateExcel(formattedResults, title);
      res.setHeader(
        "Content-Disposition",
        `attachment; filename=${title}.xlsx`
      );
      res.setHeader(
        "Content-Type",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      );
      return res.send(buffer);
    }

    return res.json({
      status: true,
      page: Number(page),
      pageSize: Number(pageSize),
      count,
      data: formattedResults,
    });
  } catch (error) {
    console.error("Current Outside Error:", error);
    return res.status(500).json({ status: false, message: error.message });
  }
};

export const getStudentsCurrentlyInsideReport = async (req, res) => {
  try {
    const {
      location = "",
      page = 1,
      pageSize = 10,
      type,
    } = {
      ...req.query,
      ...req.body,
    };

    const userId = req.user?.userId;
    const roleId = req.user?.roleId;

    if (!userId) {
      return res.status(401).json({
        status: false,
        message: "Unauthorized - Missing user ID",
      });
    }

    // ROLE CHECK
    const [roleResult] = await db.query("SELECT name FROM roles WHERE id = ?", {
      replacements: [roleId],
    });
    const isSuperAdmin =
      roleResult && roleResult[0]?.name?.toLowerCase() === "superadmin";

    // 🔥 Get user mapped hostels if not superadmin
    let mappedHostels = [];
    if (!isSuperAdmin) {
      const [hostels] = await db.query(
        `SELECT hostel_id FROM userhostelmap WHERE users_id = ?`,
        { replacements: [userId] }
      );
      if (hostels.length === 0) {
        return res.json({
          status: true,
          count: 0,
          data: [],
          message: "No hostel mapped to this user",
        });
      }
      mappedHostels = hostels.map((h) => h.hostel_id);
    }

    const offset = (page - 1) * pageSize;

    // BASE WHERE
    let where = "sm.status = 'IN'";
    const replacements = [];

    if (location) {
      where += " AND sm.hostel_id = ?";
      replacements.push(location);
    } else if (!isSuperAdmin) {
      // restrict to mapped hostels
      const inClause = mappedHostels.join(",");
      where += ` AND sm.hostel_id IN (${inClause})`;
    }

    // ------------------------------------
    // MAIN QUERY
    // ------------------------------------
    const query = `
      SELECT 
        s.memberid,
        s.name,
        h.name AS hostel,
        sm.out_time,
        sm.in_time
      FROM studentmovement sm
      JOIN student s ON sm.student_id = s.id
      JOIN hostel h ON sm.hostel_id = h.id
      WHERE ${where}
      ORDER BY sm.in_time DESC
      LIMIT ? OFFSET ?
    `;

    const results = await db.query(query, {
      replacements: [...replacements, pageSize, offset],
      type: db.QueryTypes.SELECT,
    });

    // ------------------------------------
    // COUNT QUERY
    // ------------------------------------
    const countQuery = `
      SELECT COUNT(*) AS total
      FROM studentmovement sm
      WHERE ${where}
    `;
    const totalRows = await db.query(countQuery, {
      replacements,
      type: db.QueryTypes.SELECT,
    });
    const count = totalRows[0]?.total || 0;

    // ------------------------------------
    // TIME FORMATTER
    // ------------------------------------
    function formatMySQLDateTime(dt) {
      if (!dt) return "-";

      const str = dt.toISOString().slice(0, 19).replace("T", " ");
      const [datePart, timePart] = str.split(" ");
      const [yyyy, mm, dd] = datePart.split("-");
      let [hh, min, sec] = timePart.split(":").map(Number);

      const ampm = hh >= 12 ? "PM" : "AM";
      hh = hh % 12 || 12;

      return `${dd}/${mm}/${yyyy} ${String(hh).padStart(2, "0")}:${String(
        min
      ).padStart(2, "0")}:${String(sec).padStart(2, "0")} ${ampm}`;
    }

    // ------------------------------------
    // FINAL RESULT
    // ------------------------------------
    const formattedResults = results.map((r, idx) => ({
      sno: offset + idx + 1,
      memberid: r.memberid,
      name: r.name,
      hostel: r.hostel || "-",
      out_time: formatMySQLDateTime(r.out_time),
      in_time: formatMySQLDateTime(r.in_time),
    }));

    // ------------------------------------
    // EXPORT
    // ------------------------------------
    const title = "CurrentInsideReport";

    if (type === "pdf") {
      const outputPath = await generatePDF(req, formattedResults, title);
      return res.download(outputPath, `${title}.pdf`);
    }
    if (type === "excel") {
      const buffer = generateExcel(formattedResults, title);
      res.setHeader(
        "Content-Disposition",
        `attachment; filename=${title}.xlsx`
      );
      res.setHeader(
        "Content-Type",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      );
      return res.send(buffer);
    }

    // ------------------------------------
    // RESPONSE
    // ------------------------------------
    return res.json({
      status: true,
      page: Number(page),
      pageSize: Number(pageSize),
      count,
      data: formattedResults,
    });
  } catch (error) {
    console.error("Current Inside Error:", error);
    return res.status(500).json({ status: false, message: error.message });
  }
};

export const getStudentSummaryReport = async (req, res) => {
  try {
    const {
      fromDate,
      toDate,
      memberid,
      name,
      mobile,
      email,
      expirydate,
      location,
      pagesize = 10,
      page = 1,
      type,
    } = { ...req.query, ...req.body };

    const userId = req.user?.userId;
    const roleId = req.user?.roleId;

    if (!userId) {
      return res.status(401).json({
        status: false,
        message: "Unauthorized - Missing user ID",
      });
    }

    // ROLE CHECK
    const [roleResult] = await db.query("SELECT name FROM roles WHERE id = ?", {
      replacements: [roleId],
    });
    const isSuperAdmin =
      roleResult && roleResult[0]?.name?.toLowerCase() === "superadmin";

    // 🔥 Get mapped hostels if not superadmin
    let mappedHostels = [];
    if (!isSuperAdmin) {
      const [hostels] = await db.query(
        `SELECT hostel_id FROM userhostelmap WHERE users_id = ?`,
        { replacements: [userId] }
      );
      if (hostels.length === 0) {
        return res.json({
          status: true,
          count: 0,
          data: [],
          message: "No hostel mapped to this user",
        });
      }
      mappedHostels = hostels.map((h) => h.hostel_id);
    }

    const pageSize = parseInt(pagesize, 10) || 10;
    const pageNumber = parseInt(page, 10) || 1;
    const offset = (pageNumber - 1) * pageSize;

    // -------------------------------------
    // BUILD WHERE CONDITIONS
    // -------------------------------------
    let where = "1=1";
    const replacements = [];

    if (fromDate && toDate) {
      where += " AND DATE(createdat) BETWEEN ? AND ?";
      replacements.push(fromDate, toDate);
    }
    if (memberid) {
      where += " AND memberid LIKE ?";
      replacements.push(`%${memberid}%`);
    }
    if (name) {
      where += " AND name LIKE ?";
      replacements.push(`%${name}%`);
    }
    if (mobile) {
      where += " AND mobile LIKE ?";
      replacements.push(`%${mobile}%`);
    }
    if (email) {
      where += " AND email LIKE ?";
      replacements.push(`%${email}%`);
    }
    if (expirydate) {
      where += " AND expirydate = ?";
      replacements.push(expirydate);
    }

    // 🔥 Handle location / mapped hostels
    if (location) {
      where += " AND hostel_id = ?";
      replacements.push(location);
    } else if (!isSuperAdmin && mappedHostels.length > 0) {
      const inClause = mappedHostels.join(",");
      where += ` AND hostel_id IN (${inClause})`;
    }

    // -------------------------------------
    // MAIN QUERY - fetch only student table
    // -------------------------------------
    const query = `
      SELECT 
        id,
        memberid,
        name,
        hostel_id,
        mobile,
        email,
        address,
        parentname,
        parentcontact,
        remarks,
        expirydate,
        status,
        createdby,
        createdat,
        updatedby,
        updatedat
      FROM student
      WHERE ${where.replace(/^1=1 AND /, "")}
      ORDER BY memberid ASC
      LIMIT ? OFFSET ?
    `;

    const results = await db.query(query, {
      replacements: [...replacements, pageSize, offset],
      type: db.QueryTypes.SELECT,
    });

    // -------------------------------------
    // COUNT QUERY (TOTAL STUDENTS)
    // -------------------------------------
    const countQuery = `
      SELECT COUNT(*) AS total 
      FROM student
      WHERE ${where.replace(/^1=1 AND /, "")}
    `;
    const totalCount = await db.query(countQuery, {
      replacements,
      type: db.QueryTypes.SELECT,
    });
    const count = totalCount[0]?.total || 0;

    // -------------------------------------
    // EXPORT (PDF / EXCEL)
    // -------------------------------------
    if (type === "pdf" || type === "excel") {
      const title = "StudentSummaryReport";
      if (type === "pdf") {
        const outputPath = await generatePDF(req, results, title);
        return res.download(outputPath, `${title}.pdf`);
      }
      if (type === "excel") {
        const buffer = generateExcel(results, title);
        res.setHeader(
          "Content-Disposition",
          `attachment; filename=${title}.xlsx`
        );
        res.setHeader(
          "Content-Type",
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        );
        return res.send(buffer);
      }
    }

    // -------------------------------------
    // JSON RESPONSE
    // -------------------------------------
    return res.json({
      status: true,
      page: pageNumber,
      pageSize,
      count,
      data: results,
    });
  } catch (error) {
    console.error("Summary Report Error:", error);
    return res.status(500).json({ status: false, message: error.message });
  }
};

export const getSmsLog = async (req, res) => {
  try {
    const {
      fromDate,
      toDate,
      studentId,
      student_name,
      hostelId,
      sms_sent_at,
      sms_status,
      created_by,
      page = 1,
      pageSize = 10,
    } = { ...req.query, ...req.body };

    const userId = req.user?.userId;
    const roleId = req.user?.roleId;

    if (!userId) {
      return res.status(401).json({
        status: false,
        message: "Unauthorized - Missing user ID",
      });
    }

    // ROLE CHECK
    const [roleResult] = await db.query("SELECT name FROM roles WHERE id = ?", {
      replacements: [roleId],
    });
    const isSuperAdmin =
      roleResult && roleResult[0]?.name?.toLowerCase() === "superadmin";

    // 🔥 Get mapped hostels if not superadmin
    let mappedHostels = [];
    if (!isSuperAdmin) {
      const [hostels] = await db.query(
        `SELECT hostel_id FROM userhostelmap WHERE users_id = ?`,
        { replacements: [userId] }
      );
      if (hostels.length === 0) {
        return res.json({
          status: true,
          count: 0,
          data: [],
          message: "No hostel mapped to this user",
        });
      }
      mappedHostels = hostels.map((h) => h.hostel_id);
    }

    const offset = (page - 1) * pageSize;
    let where = "1=1";
    const replacements = [];

    // -------------------------------------
    // FILTERS
    // -------------------------------------
    if (fromDate && toDate) {
      where += " AND DATE(lrsl.sms_sent_at) BETWEEN ? AND ?";
      replacements.push(fromDate, toDate);
    }

    if (studentId) {
      where += " AND s.id = ?";
      replacements.push(studentId);
    }

    if (hostelId) {
      where += " AND h.id = ?";
      replacements.push(hostelId);
    } else if (!isSuperAdmin && mappedHostels.length > 0) {
      const inClause = mappedHostels.join(",");
      where += ` AND h.id IN (${inClause})`;
    }

    if (created_by) {
      where += " AND lrsl.created_by = ?";
      replacements.push(created_by);
    }

    // -------------------------------------
    // MAIN QUERY
    // Map created_by to student name if exists, otherwise fallback to users.username
    // -------------------------------------
    const query = `
      SELECT 
        lrsl.id AS log_id,
        s.id AS student_id,
        s.name AS student_name,
        h.id AS hostel_id,
        h.name AS hostel_name,
        lrsl.status AS sms_status,
        lrsl.sms_sent_at,
        COALESCE(st.name, u.username) AS created_by
      FROM late_return_sms_log lrsl
      JOIN student s ON lrsl.student_id = s.id
      JOIN hostel h ON lrsl.hostel_id = h.id
      LEFT JOIN student st ON lrsl.created_by = st.id
      LEFT JOIN users u ON lrsl.created_by = u.id
      WHERE ${where.replace(/^1=1 AND /, "")}
      ORDER BY lrsl.sms_sent_at DESC
      LIMIT ? OFFSET ?
    `;

    const results = await db.query(query, {
      replacements: [...replacements, pageSize, offset],
      type: db.QueryTypes.SELECT,
    });

    // -------------------------------------
    // COUNT QUERY
    // -------------------------------------
    const countQuery = `
      SELECT COUNT(*) AS total
      FROM late_return_sms_log lrsl
      JOIN student s ON lrsl.student_id = s.id
      JOIN hostel h ON lrsl.hostel_id = h.id
      WHERE ${where.replace(/^1=1 AND /, "")}
    `;

    const totalRows = await db.query(countQuery, {
      replacements,
      type: db.QueryTypes.SELECT,
    });
    const count = totalRows[0]?.total || 0;

    // -------------------------------------
    // EXPORT (PDF / EXCEL)
    // -------------------------------------
    const title = "SmsLogReport";

    if (req.body.type === "pdf") {
      const outputPath = await generatePDF(req, results, title);
      return res.download(outputPath, `${title}.pdf`);
    }
    if (req.body.type === "excel") {
      const buffer = generateExcel(results, title);
      res.setHeader(
        "Content-Disposition",
        `attachment; filename=${title}.xlsx`
      );
      res.setHeader(
        "Content-Type",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      );
      return res.send(buffer);
    }

    // -------------------------------------
    // JSON RESPONSE
    // -------------------------------------
    return res.json({
      status: true,
      page: Number(page),
      pageSize: Number(pageSize),
      count,
      data: results.map((r, idx) => ({
        sno: offset + idx + 1,
        log_id: r.log_id,
        student_id: r.student_id,
        student_name: r.student_name,
        hostel_id: r.hostel_id,
        hostel_name: r.hostel_name,
        sms_status: r.sms_status,
        sms_sent_at: r.sms_sent_at,
        created_by: r.created_by || null,
      })),
    });
  } catch (error) {
    console.error("SMS Log Error:", error);
    return res.status(500).json({ status: false, message: error.message });
  }
};
