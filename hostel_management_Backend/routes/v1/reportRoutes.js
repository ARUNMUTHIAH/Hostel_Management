import express from "express";
import { APIPermission, VerifyToken } from "../../middleware/authmiddleware.js";
import {
  getStudentMovementReport,
  getStudentSummaryReport,
  getStudentsCurrentlyOutsideReport,
  getLateReturnReport,
  getStudentsCurrentlyInsideReport,
  getSmsLog,
} from "../../controllers/Report/reportcontroller.js";

const router = express.Router();

router.post("/inOutMovement", VerifyToken, getStudentMovementReport);

router.post("/lateReturn", VerifyToken, getLateReturnReport);

router.post("/studentsOutside", VerifyToken, getStudentsCurrentlyOutsideReport);

router.post("/studentsInside", VerifyToken, getStudentsCurrentlyInsideReport);

router.post("/summaryReport", VerifyToken, getStudentSummaryReport);

router.post("/smslog", VerifyToken, getSmsLog);

export default router;
