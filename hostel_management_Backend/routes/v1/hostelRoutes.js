import express from "express";
import bodyParser from "body-parser";
import { APIPermission, VerifyToken } from "../../middleware/authmiddleware.js";
import {
  GetCheckMiddleware,
  PrecheckMiddleware,
} from "../../middleware/precheck.js";
import {
  AddHostel,
  DeleteHostel,
  GetHostel,
  UpdateHostel,
} from "../../controllers/Hostel/hostelController.js";

const router = express.Router();
router.use(bodyParser.json());

const setUsersTable = (req, res, next) => {
  req.params.table = "hostel";
  next();
};

router.post("/", VerifyToken, setUsersTable, PrecheckMiddleware, (req, res) => {
  AddHostel(req, res);
});

router.get("/", VerifyToken, setUsersTable, GetCheckMiddleware, (req, res) => {
  GetHostel(req, res);
});

router.put(
  "/:id",
  VerifyToken,
  setUsersTable,
  PrecheckMiddleware,
  (req, res) => {
    UpdateHostel(req, res);
  }
);

router.delete("/:id", VerifyToken, setUsersTable, DeleteHostel);

export default router;
