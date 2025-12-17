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

  function formatDateTime(date) {
    if (!date) return "-";
    const d = new Date(date);
    const day = String(d.getDate()).padStart(2, "0");
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const year = d.getFullYear();
    const hours = d.getHours() % 12 || 12;
    const minutes = String(d.getMinutes()).padStart(2, "0");
    const ampm = d.getHours() >= 12 ? "PM" : "AM";
    return `${day}-${month}-${year} ${hours}:${minutes} ${ampm}`;
  }

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
      // allowed_out_time: formatValue(item.allowed_out_time),
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
      overdue_status: formatValue(item.overdue_status),
      minutes_overdue: formatValue(item.overdue_minutes),
    }));
  } else if (title === "CurrentInsideReport") {
    formattedResults = results.map((item, i) => {
      console.log(item, "item");
      return {
        sno: i + 1,
        memberid: formatValue(item.memberid),
        name: formatValue(item.name),
        hostel: formatValue(item.hostel),
        in_time: formatValue(item.in_time),
        expected_return_time: formatValue(item.expected_return_time),
      };
    });
  } else if (title === "SmsLogReport") {
    formattedResults = results.map((item, i) => ({
      sno: i + 1,
      student_name: formatValue(item.student_name),
      hostel_name: formatValue(item.hostel_name),
      sms_status: formatValue(item.sms_status),
      sms_sent_at: item.sms_sent_at
        ? new Date(item.sms_sent_at)
            .toISOString()
            .replace("T", " ")
            .split(".")[0]
        : null,
      created_by: formatValue(item.created_by),
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
      <th>Overdue Status</th>
      <th>Minutes Overdue</th>
    </tr>`;

      tableRows = rows
        .map((item, i) => {
          console.log(item, "item");

          return `
    <tr>
      <td>${i + 1 + index * chunkSize}</td>
      <td>${item.memberid}</td>
      <td>${item.name}</td>
      <td>${item.hostel}</td>
      <td>${item.out_time}</td>
      <td>${item.overdue_status}</td>
      <td>${item.minutes_overdue}</td>
    </tr>`;
        })
        .join("");
    } else if (title === "CurrentInsideReport") {
      reportTitle = "Students Currently Inside Report";
      tableHeaders = `
    <tr>
      <th>S.No</th>
      <th>Member ID</th>
      <th>Name</th>
      <th>Hostel</th>
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
      <td>${item.in_time}</td>
    </tr>`
        )
        .join("");
    } else if (title === "SmsLogReport") {
      reportTitle = "SMS Log Report";
      tableHeaders = `
  <tr>
    <th>S.No</th>
    <th>Student Name</th>
    <th>Hostel</th>
    <th>SMS Status</th>
    <th>SMS Sent At</th>
    <th>Created By</th>
  </tr>`;

      tableRows = rows
        .map(
          (item, i) => `
  <tr>
    <td>${i + 1 + index * chunkSize}</td>
    <td>${item.student_name}</td>
    <td>${item.hostel_name}</td>
    <td>${item.sms_status}</td>
    <td>${formatDateTime(item.sms_sent_at)}</td>
    <td>${item.created_by}</td>
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
      // "Allowed Out Time": formatValue(item.allowed_out_time),
      // "Expected Return": formatValue(item.expected_return_time),
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
      overdue_status: formatValue(item.overdue_status),
      overdue_minutes: formatValue(item.overdue_minutes),
    }));
  } else if (title === "CurrentInsideReport") {
    selectedFields = results.map((item, i) => ({
      "S.No": i + 1,
      "Member ID": formatValue(item.memberid),
      Name: formatValue(item.name),
      Hostel: formatValue(item.hostel),
      "Out Time": formatValue(item.out_time),
    }));
  } else if (title === "SmsLogReport") {
    selectedFields = results.map((item, i) => ({
      "S.No": i + 1,
      "Student Name": formatValue(item.student_name),
      Hostel: formatValue(item.hostel_name),
      "SMS Status": formatValue(item.sms_status),
      "SMS Sent At": item.sms_sent_at
        ? new Date(item.sms_sent_at)
            .toISOString()
            .replace("T", " ")
            .split(".")[0]
        : null,
      "Created By": formatValue(item.created_by),
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

export const getStudentMovementReport = async (req, res) => {
  try {
    const {
      fromDate,
      toDate,
      pagesize = 10,
      page = 1,
      type,
    } = { ...req.query, ...req.body };

    if (!fromDate || !toDate) {
      return res.status(400).json({
        status: false,
        message: "fromDate and toDate are required",
      });
    }

    const pageSize = parseInt(pagesize);
    const offset = (page - 1) * pageSize;

    // 🔹 FETCH RAW DATA
    const rows = await db.query(
      `
      SELECT 
        sm.student_id,
        s.memberid,
        s.name,
        h.name AS hostel,
        sm.in_time,
        sm.out_time,
        sm.created_at,
        at.allowed_out_time,
        at.expected_return_time
      FROM studentmovement sm
      JOIN student s ON s.id = sm.student_id
      JOIN hostel h ON h.id = sm.hostel_id
      LEFT JOIN allowedtime at ON at.hostel_id = sm.hostel_id
      WHERE DATE(sm.created_at) BETWEEN ? AND ?
      ORDER BY sm.student_id, sm.created_at ASC
      `,
      {
        replacements: [fromDate, toDate],
        type: db.QueryTypes.SELECT,
      }
    );

    // 🔹 HELPERS
    const formatDateTime = (dt) => {
      if (!dt) return "-";
      return new Date(dt).toLocaleString("en-IN", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: true,
      });
    };

    const calculateOverdue = (inTime, expected) => {
      if (!inTime || !expected) return "00:00:00";

      const inDt = new Date(inTime);
      const [h, m, s] = expected.split(":").map(Number);

      const exp = new Date(
        inDt.getFullYear(),
        inDt.getMonth(),
        inDt.getDate(),
        h,
        m,
        s
      );

      const diff = inDt - exp;
      if (diff <= 0) return "00:00:00";

      const hrs = Math.floor(diff / 3600000);
      const mins = Math.floor((diff % 3600000) / 60000);
      const secs = Math.floor((diff % 60000) / 1000);

      return `${String(hrs).padStart(2, "0")}:${String(mins).padStart(
        2,
        "0"
      )}:${String(secs).padStart(2, "0")}`;
    };

    // 🔥 CORE LOGIC: STUDENT-WISE PAIRING
    const studentMap = new Map();
    const finalResults = [];

    for (const row of rows) {
      const sid = row.student_id;

      if (!studentMap.has(sid)) studentMap.set(sid, null);

      const openEntry = studentMap.get(sid);

      // 🟢 IN
      if (row.in_time && !row.out_time) {
        if (openEntry) {
          finalResults.push({
            ...openEntry,
            out_time: "-",
            status: "Inside",
          });
        }

        studentMap.set(sid, {
          student_id: row.student_id,
          memberid: row.memberid,
          name: row.name,
          hostel: row.hostel,
          in_time: formatDateTime(row.in_time),
          out_time: "-",
          created_at: row.created_at,
          allowed_out_time: row.allowed_out_time,
          expected_return_time: row.expected_return_time,
          overdue: calculateOverdue(row.in_time, row.expected_return_time),
          status: "Inside",
        });
      }

      // 🔴 OUT
      else if (!row.in_time && row.out_time) {
        if (openEntry) {
          openEntry.out_time = formatDateTime(row.out_time);
          openEntry.status = "Inside";
          finalResults.push(openEntry);
          studentMap.set(sid, null);
        } else {
          finalResults.push({
            student_id: row.student_id,
            memberid: row.memberid,
            name: row.name,
            hostel: row.hostel,
            in_time: "-",
            out_time: formatDateTime(row.out_time),
            created_at: row.created_at,
            allowed_out_time: row.allowed_out_time,
            expected_return_time: row.expected_return_time,
            overdue: null,
            status: "Outside",
          });
        }
      }
    }

    // 🔚 CLOSE REMAINING OPEN INS
    for (const openEntry of studentMap.values()) {
      if (openEntry) finalResults.push(openEntry);
    }

    // 🔹 EXPORT (PDF / EXCEL)
    if (type === "pdf" || type === "excel") {
      const title = "StudentMovementReport";

      if (type === "pdf") {
        const outputPath = await generatePDF(req, finalResults, title);
        return res.download(outputPath, `${title}.pdf`);
      }

      if (type === "excel") {
        const buffer = generateExcel(finalResults, title);
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

    // 🔹 PAGINATION (NORMAL API)
    const paginatedResults = finalResults.slice(offset, offset + pageSize);

    return res.json({
      status: true,
      page: Number(page),
      pageSize,
      count: finalResults.length,
      data: paginatedResults,
    });
  } catch (error) {
    console.error("Movement Error:", error);
    return res.status(500).json({
      status: false,
      message: error.message,
    });
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

    // 🔹 Build WHERE clause and replacements
    let where = `1=1`;
    const replacements = [];

    if (location) {
      where += ` AND sm.hostel_id = ?`;
      replacements.push(location);
    } else if (!isSuperAdmin && mappedHostels.length > 0) {
      const placeholders = mappedHostels.map(() => "?").join(",");
      where += ` AND sm.hostel_id IN (${placeholders})`;
      replacements.push(...mappedHostels);
    }

    // 🔹 Main query: get latest punch per student and only OUT
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
      JOIN (
        SELECT student_id, MAX(created_at) AS latest_created
        FROM studentmovement
        GROUP BY student_id
      ) AS latest ON latest.student_id = sm.student_id AND latest.latest_created = sm.created_at
      WHERE sm.out_time IS NOT NULL AND sm.in_time IS NULL
        AND ${where}
      ORDER BY sm.out_time ASC
      LIMIT ? OFFSET ?
    `;

    // Add pagination
    replacements.push(Number(pageSize), Number(offset));

    const results = await db.query(query, {
      replacements,
      type: db.QueryTypes.SELECT,
    });

    // 🔹 Count total outside students
    const countQuery = `
      SELECT COUNT(*) AS total
      FROM studentmovement sm
      JOIN (
        SELECT student_id, MAX(created_at) AS latest_created
        FROM studentmovement
        GROUP BY student_id
      ) AS latest ON latest.student_id = sm.student_id AND latest.latest_created = sm.created_at
      WHERE sm.out_time IS NOT NULL AND sm.in_time IS NULL
        AND ${where}
    `;

    const countRes = await db.query(countQuery, {
      replacements,
      type: db.QueryTypes.SELECT,
    });

    const count = countRes[0]?.total || 0;

    // 🔹 Format results
    const now = new Date();
    const nearOverdueThreshold = 10;

    const formatMySQLDateTime = (dt) => {
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
    };

    const formattedResults = results.map((r, idx) => {
      const expectedDt = new Date(r.expected_dt);
      const diffMinutes = Math.floor((expectedDt - now) / 60000);

      let overdue_status = "On Time";
      let overdue_minutes = "-";

      if (diffMinutes < 0) {
        overdue_status = "Overdue";
        const mins = Math.abs(diffMinutes);
        const hrs = Math.floor(mins / 60);
        overdue_minutes = `${hrs > 0 ? hrs + " Hr " : ""}${mins % 60} Min`;
      } else if (diffMinutes <= nearOverdueThreshold) {
        overdue_status = "Near Overdue";
      }

      return {
        sno: offset + idx + 1,
        memberid: r.memberid,
        name: r.name,
        hostel: r.hostel || "-",
        out_time: formatMySQLDateTime(new Date(r.out_time)),
        expected_return_time: r.expected_return_time,
        overdue_status,
        overdue_minutes,
      };
    });

    const title = "CurrentOutsideReport";

    // 🔹 EXPORT PDF / Excel
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

    // 🔹 Default JSON response
    return res.json({
      status: true,
      page: Number(page),
      pageSize: Number(pageSize),
      count,
      data: formattedResults,
    });
  } catch (error) {
    console.error("Current Outside Error:", error);
    return res.status(500).json({
      status: false,
      message: error.message,
    });
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

    // Get user mapped hostels if not superadmin
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

    // Build WHERE clause for hostels
    let where = "1=1";
    const replacements = [];

    if (location) {
      where += " AND sm.hostel_id = ?";
      replacements.push(location);
    } else if (!isSuperAdmin && mappedHostels.length > 0) {
      const placeholders = mappedHostels.map(() => "?").join(",");
      where += ` AND sm.hostel_id IN (${placeholders})`;
      replacements.push(...mappedHostels);
    }

    // Main query: get latest punch per student where latest status = IN
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
      JOIN (
        SELECT student_id, MAX(created_at) AS latest_created
        FROM studentmovement
        GROUP BY student_id
      ) AS latest ON latest.student_id = sm.student_id AND latest.latest_created = sm.created_at
      WHERE sm.in_time IS NOT NULL AND sm.out_time IS NULL
        AND ${where}
      ORDER BY sm.in_time DESC
      LIMIT ? OFFSET ?
    `;

    replacements.push(Number(pageSize), Number(offset));

    const results = await db.query(query, {
      replacements,
      type: db.QueryTypes.SELECT,
    });

    // Count total
    const countQuery = `
      SELECT COUNT(*) AS total
      FROM studentmovement sm
      JOIN (
        SELECT student_id, MAX(created_at) AS latest_created
        FROM studentmovement
        GROUP BY student_id
      ) AS latest ON latest.student_id = sm.student_id AND latest.latest_created = sm.created_at
      WHERE sm.in_time IS NOT NULL AND sm.out_time IS NULL
        AND ${where}
    `;

    const totalRows = await db.query(countQuery, {
      replacements,
      type: db.QueryTypes.SELECT,
    });
    const count = totalRows[0]?.total || 0;

    // Format date
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

    // Format results
    const formattedResults = results.map((r, idx) => ({
      sno: offset + idx + 1,
      memberid: r.memberid,
      name: r.name,
      hostel: r.hostel || "-",
      out_time: formatMySQLDateTime(r.out_time),
      in_time: formatMySQLDateTime(r.in_time),
    }));

    const title = "CurrentInsideReport";

    // Export PDF / Excel
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

    // JSON response
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
      hostel,
      sms_status,
      sms_sent_at,
      created_by,
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

    // 🔥 Mapped hostels (if not superadmin)
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
    // FILTERS
    // -------------------------------------
    let where = "1=1";
    const replacements = [];

    if (fromDate && toDate) {
      where += " AND DATE(lrsl.sms_sent_at) BETWEEN ? AND ?";
      replacements.push(fromDate, toDate);
    }
    if (studentId) {
      where += " AND s.id = ?";
      replacements.push(studentId);
    }
    if (student_name) {
      where += " AND s.name LIKE ?";
      replacements.push(`%${student_name}%`);
    }
    if (sms_status) {
      where += " AND lrsl.status = ?";
      replacements.push(sms_status);
    }
    if (sms_sent_at) {
      where += " AND DATE(lrsl.sms_sent_at) = ?";
      replacements.push(sms_sent_at);
    }
    if (created_by) {
      where += " AND lrsl.created_by = ?";
      replacements.push(created_by);
    }

    if (hostel) {
      where += " AND lrsl.hostel_id = ?";
      replacements.push(hostel);
    } else if (!isSuperAdmin && mappedHostels.length > 0) {
      const inClause = mappedHostels.join(",");
      where += ` AND lrsl.hostel_id IN (${inClause})`;
    }

    // -------------------------------------
    // MAIN QUERY
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
      WHERE ${where}
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
    const totalCount = await db.query(countQuery, {
      replacements,
      type: db.QueryTypes.SELECT,
    });
    const count = totalCount[0]?.total || 0;

    // -------------------------------------
    // EXPORT
    // -------------------------------------
    if (type === "pdf" || type === "excel") {
      const title = "SmsLogReport";
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
    // RESPONSE
    // -------------------------------------
    return res.json({
      status: true,
      page: pageNumber,
      pageSize,
      count,
      data: results.map((r, idx) => ({
        sno: offset + idx + 1,
        ...r,
        sms_sent_at: r.sms_sent_at
          ? new Date(r.sms_sent_at)
              .toISOString()
              .replace("T", " ")
              .split(".")[0]
          : null,
      })),
    });
  } catch (error) {
    console.error("SMS Log Error:", error);
    return res.status(500).json({ status: false, message: error.message });
  }
};
