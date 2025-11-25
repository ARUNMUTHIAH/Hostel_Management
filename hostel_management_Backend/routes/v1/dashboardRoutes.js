import express from "express";
import { getDashboardData } from "../../controllers/Dashboard/dashboardcontroller.js";
import { APIPermission, VerifyToken } from "../../middleware/authmiddleware.js";

const router = express.Router();

router.get("/", VerifyToken, getDashboardData);

export default router;
