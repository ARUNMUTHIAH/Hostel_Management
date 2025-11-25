import express from "express";
import bodyParser from "body-parser";
import { APIPermission, VerifyToken } from "../../middleware/authmiddleware.js";
import {
  PrecheckMiddleware,
  GetCheckMiddleware,
} from "../../middleware/precheck.js";
import {
  AddAllowedTime,
  DeleteAllowedTime,
  UpdateAllowedTime,
  //   GetAllowedTimeById,
  GetAllowedTime,
} from "../../controllers/AllowedTime/allowedTimeController.js";

const router = express.Router();
router.use(bodyParser.json());

const setUsersTable = (req, res, next) => {
  req.params.table = "allowedtime";
  next();
};

router.post("/", VerifyToken, setUsersTable, PrecheckMiddleware, (req, res) => {
  AddAllowedTime(req, res);
});

router.put(
  "/:id",
  VerifyToken,
  setUsersTable,
  PrecheckMiddleware,
  (req, res) => {
    UpdateAllowedTime(req, res);
  }
);

router.get("/", VerifyToken, setUsersTable, GetCheckMiddleware, (req, res) => {
  GetAllowedTime(req, res);
});

router.delete("/:id", VerifyToken, setUsersTable, DeleteAllowedTime);

export default router;
