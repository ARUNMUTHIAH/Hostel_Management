// userRoutes.js
import express from "express";
import bodyParser from "body-parser";
import { APIPermission, VerifyToken } from "../../middleware/authmiddleware.js";
import {
  PrecheckMiddleware,
  GetCheckMiddleware,
} from "../../middleware/precheck.js";

import {
  AddUser,
  DeleteUser,
  GetUsers,
  UpdateUser,
} from "../../controllers/Users/usersController.js";

const router = express.Router();
router.use(bodyParser.json());

const setUsersTable = (req, res, next) => {
  req.params.table = "users";
  next();
};

// router.post('/', VerifyToken, PrecheckMiddleware, (req, res) => {
//   AddUser(req, res);
// });
// router.put('/:id', VerifyToken, PrecheckMiddleware, (req, res) => {
//   UpdateUser(req, res);
// });

router.post("/", VerifyToken, setUsersTable, PrecheckMiddleware, (req, res) => {
  AddUser(req, res);
});

router.put(
  "/:id",
  VerifyToken,
  setUsersTable,
  PrecheckMiddleware,
  (req, res) => {
    UpdateUser(req, res);
  }
);

router.get("/", VerifyToken, setUsersTable, GetCheckMiddleware, (req, res) => {
  GetUsers(req, res);
});

router.delete("/:id", VerifyToken, setUsersTable, DeleteUser);

export default router;
