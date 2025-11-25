import express from "express";
import bodyParser from "body-parser";
import { APIPermission, VerifyToken } from "../../middleware/authmiddleware.js";
import {
  PrecheckMiddleware,
  GetCheckMiddleware,
} from "../../middleware/precheck.js";

import multer from "multer";
import {
  CreateStudent,
  DeleteStudent,
  GetStudent,
  UpdateStudent,
} from "../../controllers/Student/studentController.js";
const upload = multer({
  dest: "uploads/",
  limits: {
    fileSize: 5242880,
  },
  fileFilter(req, file, cb) {
    if (!file.originalname.match(/\.(xlsx)$/)) {
      return cb(new Error("Please upload a excel file"));
    }
    cb(undefined, true);
  },
});

const router = express.Router();
router.use(bodyParser.json());

const setAssetTable = (req, res, next) => {
  req.params.table = "student";
  next();
};

router.post("/", VerifyToken, setAssetTable, PrecheckMiddleware, (req, res) => {
  CreateStudent(req, res);
});

router.get("/", VerifyToken, setAssetTable, GetCheckMiddleware, (req, res) => {
  GetStudent(req, res);
});

router.put(
  "/:id",
  VerifyToken,
  setAssetTable,
  PrecheckMiddleware,
  (req, res) => {
    UpdateStudent(req, res);
  }
);

router.delete("/:id", VerifyToken, setAssetTable, DeleteStudent);

export default router;
