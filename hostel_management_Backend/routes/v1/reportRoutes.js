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
} from "../../controllers/Report/reportcontroller.js";

const router = express.Router();

// Reports routes
router.post("/vehicledetails", VerifyToken, getAssetDetails);
router.post("/lastvehicletracking", VerifyToken, assetLastTracking);

router.post("/visitorreport", VerifyToken, visitorVehicleReports);

router.post("/dailyInOutMovement", VerifyToken, getStudentDailyMovementReport);

router.post("/lateReturn", VerifyToken, getLateReturnReport);

router.post("/studentsOutside", VerifyToken, getStudentsCurrentlyOutsideReport);

router.post("/summaryReport", VerifyToken, getStudentSummaryReport);
export default router;
