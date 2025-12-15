// Import necessary modules
import express from "express";
import multer from "multer";
import AuthRoutes from "./v1/authRoutes.js";
import masterRoutes from "./v1/masterRoutes.js";
import assetRoutes from "./v1/assetRoutes.js";
import usersRoutes from "./v1/usersRoutes.js";
import roleRoutes from "./v1/roleRoutes.js";
import productTypeRoutes from "./v1/productTypeRoutes.js";
import dashboardRoutes from "./v1/dashboardRoutes.js";
import reportRoutes from "./v1/reportRoutes.js";
import dropdownRoutes from "./v1/dropdownRoutes.js";
import hostelRoutes from "./v1/hostelRoutes.js";
import allowedTimeRoutes from "./v1/allowedTimeRoutes.js";
import studentRoutes from "./v1/studentRoutes.js";
import smsConfigurationRoutes from "./v1/smsConfigurationRoutes.js";
import cron from "node-cron";
import { syncMovement } from "../controllers/BioMetric/SyncMovement.js";
import biometricRoutes from "./v1/biometricConfigRoutes.js";

const router = express.Router();

router.use("/v1/auth", AuthRoutes);
router.use("/v1/dashboard", dashboardRoutes);
router.use("/v1/student", studentRoutes);
router.use("/v1/users", usersRoutes);
router.use("/v1/hostel", hostelRoutes);
router.use("/v1/smsconfiguration", smsConfigurationRoutes);
router.use("/v1/allowedtime", allowedTimeRoutes);
router.use("/v1/roles", roleRoutes);
router.use("/v1/master", productTypeRoutes);
router.use("/v1/report", reportRoutes);
router.use("/v1/dropdown", dropdownRoutes);
router.use("/v1/biometric", biometricRoutes);
router.use("/v1", masterRoutes);

cron.schedule("*/1 * * * *", () => {
  console.log("Auto sync triggered");
  syncMovement();
});

export default router;
