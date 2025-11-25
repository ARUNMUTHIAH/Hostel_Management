import express from "express";
import bodyParser from "body-parser";
import { APIPermission, VerifyToken } from "../../middleware/authmiddleware.js";
import {
  UpdateProductType,
  GetProductType,
} from "../../controllers/ProductType/productTypeController.js";
import {
  PrecheckMiddleware,
  GetCheckMiddleware,
} from "../../middleware/precheck.js";

const router = express.Router();
router.use(bodyParser.json());

const setMasterTable = (req, res, next) => {
  req.params.table = "master";
  next();
};

router.put("/", VerifyToken, (req, res) => {
  UpdateProductType(req, res);
});

router.get(
  "/",
  VerifyToken,
  setMasterTable,

  GetCheckMiddleware,
  GetProductType
);

export default router;
