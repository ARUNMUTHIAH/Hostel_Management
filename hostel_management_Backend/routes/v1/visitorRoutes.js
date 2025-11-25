// visitorRoutes.js
import express from "express";
import bodyParser from "body-parser";
import { VerifyToken, APIPermission } from "../../middleware/authmiddleware.js";
import {
  addVisitorVehicle,
  getAllVisitors,
  visitorCheckOut,
} from "../../controllers/Visitors/visitorController.js";

const router = express.Router();
router.use(bodyParser.json());

// ✅ Get All Visitors
router.get("/visitorvehicle", VerifyToken, getAllVisitors);

// ✅ Add New Visitor Entry
router.post("/visitorvehicle", VerifyToken, addVisitorVehicle);

// ✅ Update (Check-Out Visitor)
router.put("/visitorvehicle/:id/checkout", VerifyToken, visitorCheckOut);

export default router;
