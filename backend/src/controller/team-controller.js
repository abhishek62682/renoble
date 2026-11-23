import createHttpError from "http-errors";
import User from "../model/user-model.js";
import Task from "../model/task-model.js";
import { oid, ok } from "../utils/agency.js";

// GET /team — everyone who can sign in (owner first)
export const listTeam = async (req, res) => {
  const users = await User.find().select("_id username email role createdAt").sort({ role: 1, createdAt: 1 });
  ok(res, users, "Team fetched.");
};

// POST /team — add a team member (they sign in with this email + password, and see only their own tasks)
export const addMember = async (req, res) => {
  const { username, email, password } = req.body;
  if (await User.exists({ email: email.toLowerCase() })) throw createHttpError(409, "Someone with this email already exists.");
  const user = await User.create({ username, email, password, role: "DESIGNER" });
  ok(res, { _id: user._id, username: user.username, email: user.email, role: user.role }, "Member added.", 201);
};

// DELETE /team/:id — removes a member's access; their open tasks stay, unassigned
export const removeMember = async (req, res) => {
  const user = await User.findById(oid(req.params.id));
  if (!user) throw createHttpError(404, "Member not found.");
  if (user.role === "OWNER") throw createHttpError(409, "The owner can't be removed.");
  await Task.updateMany({ assignedTo: user._id }, { assignedTo: null });
  await user.deleteOne();
  ok(res, { _id: user._id }, "Member removed.");
};
