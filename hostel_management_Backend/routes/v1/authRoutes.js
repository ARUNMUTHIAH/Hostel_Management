import express from "express";
import bodyParser from 'body-parser';
import { VerifyToken } from '../../middleware/authmiddleware.js';

import { login } from "../../controllers/Auth/authController.js";

const router = express.Router();

// Public route (no authentication)
router.post('/login', login);

// Protected route example (uses the VerifyToken middleware)
router.get('/protected-endpoint', VerifyToken, (req, res) => {
  res.json({ message: 'This is a protected route' });
});
export default router;

