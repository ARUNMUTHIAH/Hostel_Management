import express from "express";
import { APIPermission, VerifyToken } from "../../middleware/authmiddleware.js";
import {
  getAllDropdowns,
  getDropdownFromMaster,
  getLocationByType,
} from "../../controllers/Dropdowns/dropdownController.js";

const router = express.Router();

router.post("/product_type", VerifyToken, getDropdownFromMaster);

router.get("/get_all_dropdowns", VerifyToken, getAllDropdowns);

router.get("/masters/:type", VerifyToken, (req, res) => {
  getLocationByType(req, res);
});

export default router;
