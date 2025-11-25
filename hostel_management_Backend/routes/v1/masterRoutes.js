// userRoutes.js
import express from "express";
import bodyParser from "body-parser";
import { APIPermission, VerifyToken } from "../../middleware/authmiddleware.js";
import {
  PrecheckMiddleware,
  GetCheckMiddleware,
} from "../../middleware/precheck.js";

import multer from "multer";
const upload = multer({
  dest: "uploads/",
  limits: {
    fileSize: 5242880,
  },
  fileFilter(req, file, cb) {
    if (!file.originalname.match(/\.(jpg|jpeg|pdf|xlsx|png)$/)) {
      return cb(new Error("Please upload a Image"));
    }
    cb(undefined, true);
  },
});

import {
  handleAdd,
  handleGet,
  handleUpdate,
  handleDelete,
  // getLocationByType
} from "../../controllers/Masters/masterController.js";

const router = express.Router();
router.use(bodyParser.json());

router.post("/:table", VerifyToken, PrecheckMiddleware, (req, res) => {
  handleAdd(req, res);
});

router.get("/:table", VerifyToken, GetCheckMiddleware, (req, res) => {
  handleGet(req, res);
});

router.put("/:table/:id", VerifyToken, PrecheckMiddleware, (req, res) => {
  handleUpdate(req, res);
});

router.delete("/:table/:id", VerifyToken, (req, res) => {
  handleDelete(req, res);
});

// router.get('/masters/:type', VerifyToken, APIPermission('get_location_type'), (req, res) => {
//   getLocationByType(req, res);
// });

export default router;
