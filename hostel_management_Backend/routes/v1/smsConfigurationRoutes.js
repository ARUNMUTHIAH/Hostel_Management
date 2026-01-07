import express from "express";
import bodyParser from "body-parser";
import { APIPermission, VerifyToken } from "../../middleware/authmiddleware.js";
import {
  GetCheckMiddleware,
  PrecheckMiddleware,
} from "../../middleware/precheck.js";
import {
  AddSmsConfiguration,
  DeleteSmsConfiguration,
  getAllStudentsForSms,
  getSmsApproval,
  GetSmsConfiguration,
  sendCustomSmsToSelectedStudents,
  sendLateReturnSms,
  UpdateSmsConfiguration,
} from "../../controllers/sms/smsController.js";

const router = express.Router();
router.use(bodyParser.json());

const setUsersTable = (req, res, next) => {
  req.params.table = "smsconfiguration";
  next();
};

router.post("/", VerifyToken, setUsersTable, PrecheckMiddleware, (req, res) => {
  AddSmsConfiguration(req, res);
});

router.get("/", VerifyToken, setUsersTable, GetCheckMiddleware, (req, res) => {
  GetSmsConfiguration(req, res);
});

router.put(
  "/:id",
  VerifyToken,
  setUsersTable,
  PrecheckMiddleware,
  (req, res) => {
    UpdateSmsConfiguration(req, res);
  }
);

router.delete("/:id", VerifyToken, setUsersTable, DeleteSmsConfiguration);

router.get(
  "/smsapproval",
  VerifyToken,
  setUsersTable,
  GetCheckMiddleware,
  (req, res) => {
    getSmsApproval(req, res);
  }
);

router.post(
  "/sendLateReturnSms",
  VerifyToken,
  setUsersTable,
  GetCheckMiddleware,
  (req, res) => {
    sendLateReturnSms(req, res);
  }
);
router.get(
  "/bulksmsapproval", // GET: list all students
  VerifyToken,
  setUsersTable,
  GetCheckMiddleware,
  getAllStudentsForSms
);

router.post(
  "/bulksmsapproval/send", // POST: send custom SMS
  VerifyToken,
  setUsersTable,
  GetCheckMiddleware,
  sendCustomSmsToSelectedStudents
);
export default router;
