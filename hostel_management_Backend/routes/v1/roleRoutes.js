// userRoutes.js
import express from "express";
import bodyParser from "body-parser";
import { APIPermission, VerifyToken } from "../../middleware/authmiddleware.js";
import {
  PrecheckMiddleware,
  GetCheckMiddleware,
} from "../../middleware/precheck.js";
import {
  AddRole,
  DeleteRole,
  GetRoles,
  UpdateRole,
} from "../../controllers/Roles/rolesController.js";

const router = express.Router();
router.use(bodyParser.json());

const setRolesTable = (req, res, next) => {
  req.params.table = "roles";
  next();
};

// router.post('/:table', VerifyToken, PrecheckMiddleware, (req, res) => {
//   AddRole(req, res);
// });
// router.put('/:table/:id', VerifyToken, PrecheckMiddleware, (req, res) => {
//   UpdateRole(req, res);
// });

router.post("/", VerifyToken, setRolesTable, PrecheckMiddleware, (req, res) => {
  AddRole(req, res);
});
router.put(
  "/:id",
  VerifyToken,
  setRolesTable,
  PrecheckMiddleware,
  (req, res) => {
    UpdateRole(req, res);
  }
);
router.get("/", VerifyToken, setRolesTable, GetCheckMiddleware, (req, res) => {
  GetRoles(req, res);
});

router.delete(
  "/:id",
  VerifyToken,
  setRolesTable,

  DeleteRole
);

export default router;
