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
    if (!file.originalname.match(/\.(xlsx)$/)) {
      return cb(new Error("Please upload a excel file"));
    }
    cb(undefined, true);
  },
});

import {
  CreateStudent,
  DeleteStudent,
  GetStudent,
  //  getAllDropdowns,
  //  getDropdownFromMaster,
  lastseen,
  productTypeFilter,
  UpdateStudent,
  uploadFile,
  writeStudentid,
} from "../../controllers/Asset/assetController.js";

const router = express.Router();
router.use(bodyParser.json());

const setAssetTable = (req, res, next) => {
  req.params.table = "asset";
  next();
};

router.post("/", VerifyToken, setAssetTable, PrecheckMiddleware, (req, res) => {
  CreateStudent(req, res);
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

router.get("/", VerifyToken, setAssetTable, GetCheckMiddleware, GetStudent);
router.delete("/:id", VerifyToken, setAssetTable, DeleteStudent);

router.post(
  "/bulk_asset_upload",
  VerifyToken,
  setAssetTable,
  // APIPermission(19),
  upload.single("uploadfile"),
  uploadFile
);

router.get(
  "/product_type_filter",
  VerifyToken,
  setAssetTable,
  productTypeFilter
);

router.post("/epc/update", VerifyToken, setAssetTable, writeStudentid);

router.post("/lastseen", VerifyToken, setAssetTable, lastseen);

// router.post('/:table', VerifyToken, PrecheckMiddleware, (req, res) => {
//   CreateAsset(req, res);
// });
// router.put('/:table/:id', VerifyToken, PrecheckMiddleware, (req, res) => {
//   UpdateAsset(req, res);
// });
// router.post('/:table/product_type', VerifyToken, getDropdownFromMaster);
// router.get('/:table/get_all_dropdowns', VerifyToken,getAllDropdowns);
// router.post('/:table/bulk_asset_upload', upload.single("uploadfile"), uploadFile);
// router.get('/:table/product_type_filter', VerifyToken, productTypeFilter);

// router.get('/location/:type', VerifyToken, getLocationByType);
// router.post("/epc/update", VerifyToken, writeAssetTid)
// router.post("/assets/upload",VerifyToken, lastseen)

export default router;
