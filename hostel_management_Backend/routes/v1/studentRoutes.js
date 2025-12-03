import express from "express";
import bodyParser from "body-parser";
import { APIPermission, VerifyToken } from "../../middleware/authmiddleware.js";
import {
  PrecheckMiddleware,
  GetCheckMiddleware,
} from "../../middleware/precheck.js";

import multer from "multer";
import {
  CreateStudent,
  DeleteStudent,
  GetStudent,
  UpdateStudent,
  uploadFile,
} from "../../controllers/Student/studentController.js";
const upload = multer({
  dest: "uploads/",
  limits: {
    fileSize: 5242880,
  },
  fileFilter(req, file, cb) {
    if (!file.originalname.match(/\.(xlsx)$/)) {
      return cb(new Error("Please upload a excel file"));
    }
    cb(undefined, true);
  },
});

const router = express.Router();
router.use(bodyParser.json());

const setAssetTable = (req, res, next) => {
  req.params.table = "student";
  next();
};

router.post("/", VerifyToken, setAssetTable, PrecheckMiddleware, (req, res) => {
  CreateStudent(req, res);
});

router.get("/", VerifyToken, setAssetTable, GetCheckMiddleware, (req, res) => {
  GetStudent(req, res);
});

router.put(
  "/:id",
  VerifyToken,
  setAssetTable,
  PrecheckMiddleware,
  (req, res) => {
    UpdateStudent(req, res);
  }
);

router.delete("/:id", VerifyToken, setAssetTable, DeleteStudent);

router.post(
  "/bulk_student_upload",
  VerifyToken,
  setAssetTable,
  // APIPermission(19),
  upload.single("uploadfile"),
  uploadFile
);

router.post("/:studentId/enroll-fingerprint", VerifyToken, async (req, res) => {
  const { studentId } = req.params;
  const BRIDGE_URL = process.env.BRIDGE_URL || "http://127.0.0.1:3005";

  try {
    // 1️⃣ Verify student exists
    const [studentRows] = await db.query(
      "SELECT id, name FROM student WHERE id = ?",
      { replacements: [studentId] }
    );
    if (!studentRows.length)
      return res
        .status(404)
        .json({ status: false, message: "Student not found" });

    // 2️⃣ Call bridge service to start enrollment
    const response = await fetch(`${BRIDGE_URL}/enroll`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ studentId }),
    });

    if (!response.ok) {
      const text = await response.text();
      return res
        .status(500)
        .json({ status: false, message: "Bridge error: " + text });
    }

    const data = await response.json();
    return res.status(200).json({ status: true, bridgeResponse: data });
  } catch (err) {
    console.error("Enroll fingerprint error:", err);
    return res.status(500).json({ status: false, message: "Server error" });
  }
});

export default router;
