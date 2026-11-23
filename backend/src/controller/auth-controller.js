import createHttpError from "http-errors";
import User from "../model/user-model.js";

// Simple in-memory brute-force guard: 8 failed attempts per email+IP per 15 minutes.
const attempts = new Map();
const WINDOW = 15 * 60 * 1000;
const tooMany = (key) => {
  const now = Date.now();
  const list = (attempts.get(key) ?? []).filter((t) => now - t < WINDOW);
  attempts.set(key, list);
  return list.length >= 8;
};
const fail = (key) => attempts.set(key, [...(attempts.get(key) ?? []), Date.now()]);

// POST /api/auth/login
export const login = async (req, res) => {
  const email = String(req.body?.email ?? "").trim().toLowerCase();
  const password = String(req.body?.password ?? "");
  if (!email || !password) throw createHttpError(422, "Email and password are required.");

  const key = `${email}|${req.ip}`;
  if (tooMany(key)) throw createHttpError(429, "Too many attempts. Try again in a few minutes.");

  const user = await User.findOne({ email }).select("+password");
  if (!user || !(await user.comparePassword(password))) {
    fail(key);
    throw createHttpError(401, "Invalid email or password.");
  }
  attempts.delete(key);
  res.json({ success: true, message: "Signed in.", data: { token: user.generateJWT(), role: user.role } });
};

// GET /api/profile
export const getProfile = async (req, res) => {
  const u = req.user;
  res.json({ success: true, message: "OK", data: { id: u._id, username: u.username, email: u.email, profileImage: null, isVerified: true, role: u.role } });
};

// PATCH /api/profile/change-password
export const changePassword = async (req, res) => {
  const { currentPassword, newPassword } = req.body ?? {};
  if (typeof newPassword !== "string" || newPassword.length < 8) throw createHttpError(422, "New password must be at least 8 characters.");
  const user = await User.findById(req.user._id).select("+password");
  if (!(await user.comparePassword(String(currentPassword ?? "")))) throw createHttpError(401, "Current password is incorrect.");
  user.password = newPassword;
  await user.save();
  res.json({ success: true, message: "Password changed.", data: null });
};
