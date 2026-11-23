import express from "express";
import { authenticate } from "../middlewares/authenticate.js";
import { changePassword, getProfile, login } from "../controller/auth-controller.js";

const router = express.Router();

router.post("/login", login);                                      // POST /api/auth/login
router.get("/", authenticate, getProfile);                         // GET  /api/profile
router.patch("/change-password", authenticate, changePassword);    // PATCH /api/profile/change-password

export default router;
