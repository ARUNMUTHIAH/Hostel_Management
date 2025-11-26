import express from "express";
import { APIPermission, VerifyToken } from "../../middleware/authmiddleware.js";
import {
  getAssetDetails,
  assetLastTracking,
  visitorVehicleReports,
  getStudentDailyMovementReport,
  getStudentSummaryReport,
  getStudentsCurrentlyOutsideReport,
  getLateReturnReport,
  getStudentsCurrentlyInsideReport,
} from "../../controllers/Report/reportcontroller.js";

const router = express.Router();

router.post("/dailyInOutMovement", VerifyToken, getStudentDailyMovementReport);

router.post("/lateReturn", VerifyToken, getLateReturnReport);

router.post("/studentsOutside", VerifyToken, getStudentsCurrentlyOutsideReport);

router.post("/studentsInside", VerifyToken, getStudentsCurrentlyInsideReport);

router.post("/summaryReport", VerifyToken, getStudentSummaryReport);

export default router;
