import express from "express";
import { VerifyToken } from "../../middleware/authmiddleware.js";
import {
  addDevice,
  deleteDevice,
  getDevicesByHostel,
  updateDevice,
} from "../../controllers/BioMetric/ConfiguredBiometricIP.js";

const router = express.Router();

// Get all devices of a hostel
router.get("/devices/:hostel_id", VerifyToken, getDevicesByHostel);

// Add biometric device
router.post("/device", VerifyToken, addDevice);

// Update biometric device
router.put("/device/:id", VerifyToken, updateDevice);

// Delete biometric device
router.delete("/device/:id", VerifyToken, deleteDevice);

export default router;
