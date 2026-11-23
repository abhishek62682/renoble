import { Schema, model } from "mongoose";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { config } from "../config/config.js";

const userSchema = new Schema(
  {
    username: { type: String, required: true, trim: true, minlength: 2, maxlength: 60 },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true, minlength: 8, select: false },
    // OWNER sees everything; DESIGNER sees projects (no pricing) and their own tasks.
    role: { type: String, enum: ["OWNER", "DESIGNER"], required: true },
  },
  { timestamps: true }
);

userSchema.pre("save", async function () {
  if (!this.isModified("password")) return;
  this.password = await bcrypt.hash(this.password, 12);
});

userSchema.methods.comparePassword = function (candidate) {
  return bcrypt.compare(candidate, this.password);
};

userSchema.methods.generateJWT = function () {
  return jwt.sign({ sub: this._id, email: this.email, role: this.role }, config.jwtSecret, { expiresIn: "7d" });
};

export default model("User", userSchema);
