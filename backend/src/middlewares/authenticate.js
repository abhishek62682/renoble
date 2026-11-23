import createHttpError from "http-errors";
import jwt from "jsonwebtoken";
import { config } from "../config/config.js";
import User from "../model/user-model.js";

export const authenticate = async (req, res, next) => {
  const header = req.header("Authorization");
  if (!header?.startsWith("Bearer ")) return next(createHttpError(401, "Authorization token is required."));
  try {
    const decoded = jwt.verify(header.split(" ")[1], config.jwtSecret);
    const user = await User.findById(decoded.sub).select("_id username email role");
    if (!user) return next(createHttpError(401, "User not found."));
    req.user = { _id: user._id, username: user.username, email: user.email, role: user.role };
    next();
  } catch (err) {
    next(createHttpError(401, err.name === "TokenExpiredError" ? "Session expired. Please sign in again." : "Invalid token."));
  }
};

export const authorizeRole = (...roles) => (req, res, next) =>
  roles.includes(req.user?.role) ? next() : next(createHttpError(403, `Access denied. Required role: ${roles.join(" or ")}`));
