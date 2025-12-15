import express from "express";
import bodyParser from "body-parser";
import { APIPermission, VerifyToken } from "../../middleware/authmiddleware.js";
import {
  PrecheckMiddleware,
  GetCheckMiddleware,
} from "../../middleware/precheck.js";
import fetch from "node-fetch";
import multer from "multer";
import {
  checkFingerprintStatus,
  CreateStudent,
  DeleteStudent,
  GetStudent,
  triggerEnroll,
  UpdateStudent,
  uploadFile,
} from "../../controllers/Student/studentController.js";
import { db } from "../../config/Database.js";

const router = express.Router();
router.use(bodyParser.json());

const upload = multer({
  dest: "uploads/",
  limits: { fileSize: 5242880 },
  fileFilter(req, file, cb) {
    if (!file.originalname.match(/\.(xlsx)$/)) {
      return cb(new Error("Please upload a Excel file"));
    }
    cb(undefined, true);
  },
});

// Common prefill for table
const setAssetTable = (req, res, next) => {
  req.params.table = "student";
  next();
};

// Default Student CRUD API
router.post("/", VerifyToken, setAssetTable, PrecheckMiddleware, CreateStudent);
router.get("/", VerifyToken, setAssetTable, GetCheckMiddleware, GetStudent);
router.put(
  "/:id",
  VerifyToken,
  setAssetTable,
  PrecheckMiddleware,
  UpdateStudent
);
router.delete("/:id", VerifyToken, setAssetTable, DeleteStudent);
router.post(
  "/bulk_student_upload",
  VerifyToken,
  setAssetTable,
  upload.single("uploadfile"),
  uploadFile
);

router.post("/trigger-enroll/:id", VerifyToken, triggerEnroll);
router.get(
  "/fingerprint-status/:studentId",
  VerifyToken,
  checkFingerprintStatus
);

export default router;
