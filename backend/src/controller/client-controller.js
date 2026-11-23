import createHttpError from "http-errors";
import Client from "../model/client-model.js";
import Project from "../model/project-model.js";
import Payment from "../model/payment-model.js";
import { buildFinance, oid, ok, paginationMeta, parsePaging } from "../utils/agency.js";

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// GET /clients?type=lead|client&search=&followUp=due&page=&limit=
export const listClients = async (req, res) => {
  const { page, limit, skip } = parsePaging(req);
  const filter = {};
  if (["lead", "client"].includes(req.query.type)) filter.type = req.query.type;
  if (req.query.search) {
    const re = new RegExp(escapeRe(String(req.query.search)), "i");
    filter.$or = [{ name: re }, { company: re }, { email: re }, { phone: re }];
  }
  if (req.query.followUp === "due") {
    const end = new Date();
    end.setHours(23, 59, 59, 999);
    filter.nextFollowUpDate = { $ne: null, $lte: end };
  }
  const [data, total] = await Promise.all([
    Client.find(filter).sort({ nextFollowUpDate: 1, createdAt: -1 }).skip(skip).limit(limit),
    Client.countDocuments(filter),
  ]);
  ok(res, data, "Clients fetched.", 200, { pagination: paginationMeta(total, page, limit) });
};

// GET /clients/:id  — client + projects + payment history
export const getClient = async (req, res) => {
  const client = await Client.findById(oid(req.params.id));
  if (!client) throw createHttpError(404, "Client not found.");
  const [projects, payments] = await Promise.all([
    Project.find({ client: client._id }).sort({ createdAt: -1 }),
    Payment.find({ client: client._id }).populate("project", "name").sort({ createdAt: -1 }),
  ]);
  const projectsOut = projects.map((p) => ({
    ...p.toObject(),
    finance: buildFinance(p, payments.filter((x) => String(x.project._id) === String(p._id))),
  }));
  ok(res, { client, projects: projectsOut, payments }, "Client fetched.");
};

export const createClient = async (req, res) => {
  const client = await Client.create({ ...req.body, createdBy: req.user._id });
  ok(res, client, "Saved.", 201);
};

export const updateClient = async (req, res) => {
  const client = await Client.findByIdAndUpdate(oid(req.params.id), req.body, { new: true, runValidators: true });
  if (!client) throw createHttpError(404, "Client not found.");
  ok(res, client, "Updated.");
};

// POST /clients/:id/activities — log a contact, with an optional next follow-up date
export const addActivity = async (req, res) => {
  const { type, note, date, nextFollowUp } = req.body;
  const client = await Client.findById(oid(req.params.id));
  if (!client) throw createHttpError(404, "Lead not found.");
  client.activities.push({ type, note, date: date ?? new Date(), nextFollowUp: nextFollowUp ?? null });
  await client.save();
  ok(res, client, "Saved.", 201);
};

// DELETE /clients/:id/activities/:activityId
export const deleteActivity = async (req, res) => {
  const client = await Client.findById(oid(req.params.id));
  if (!client) throw createHttpError(404, "Lead not found.");
  client.activities.pull({ _id: oid(req.params.activityId) });
  await client.save();
  ok(res, client, "Removed.");
};

export const deleteClient = async (req, res) => {
  const id = oid(req.params.id);
  if (await Project.exists({ client: id }))
    throw createHttpError(409, "This client has projects. Remove or reassign them first.");
  const client = await Client.findByIdAndDelete(id);
  if (!client) throw createHttpError(404, "Client not found.");
  ok(res, client, "Deleted.");
};
