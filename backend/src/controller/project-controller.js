import createHttpError from "http-errors";
import Client from "../model/client-model.js";
import Project from "../model/project-model.js";
import Payment from "../model/payment-model.js";
import Task from "../model/task-model.js";
import User from "../model/user-model.js";
import Document from "../model/document-model.js";
import { buildFinance, isOwner, oid, ok, paginationMeta, parsePaging, publicProject } from "../utils/agency.js";

const withFinance = async (projects, req) => {
  const ids = projects.map((p) => p._id);
  const payments = isOwner(req) ? await Payment.find({ project: { $in: ids } }) : [];
  // which of the two list-made invoices (50% advance / balance) already exist, and their ids
  const parts = isOwner(req) ? await Document.find({ project: { $in: ids }, kind: "invoice", part: { $ne: null } }, "project part") : [];
  return projects.map((p) => {
    const out = publicProject(p, buildFinance(p, payments.filter((x) => String(x.project) === String(p._id))), req);
    if (isOwner(req)) {
      out.invoiceParts = {};
      for (const d of parts) if (String(d.project) === String(p._id)) out.invoiceParts[d.part] = d._id;
    }
    return out;
  });
};

// GET /projects?status=&client=&page=&limit=
export const listProjects = async (req, res) => {
  const { page, limit, skip } = parsePaging(req);
  const filter = {};
  if (req.query.status) filter.status = req.query.status;
  if (req.query.client) filter.client = oid(req.query.client);
  const [rows, total] = await Promise.all([
    Project.find(filter).populate("client", "name company type").sort({ createdAt: -1 }).skip(skip).limit(limit),
    Project.countDocuments(filter),
  ]);
  ok(res, await withFinance(rows, req), "Projects fetched.", 200, { pagination: paginationMeta(total, page, limit) });
};

// GET /projects/:id — project + finance + payments + documents + tasks
export const getProject = async (req, res) => {
  const project = await Project.findById(oid(req.params.id)).populate("client");
  if (!project) throw createHttpError(404, "Project not found.");
  const [payments, documents, tasks] = await Promise.all([
    isOwner(req) ? Payment.find({ project: project._id }).sort({ createdAt: -1 }) : [],
    isOwner(req) ? Document.find({ project: project._id }).sort({ createdAt: -1 }) : [],
    Task.find({ project: project._id }).populate("assignedTo", "username role").sort({ status: -1, dueDate: 1 }),
  ]);
  const out = publicProject(project, buildFinance(project, payments), req);
  if (!isOwner(req) && out.client) out.client = { _id: out.client._id, name: out.client.name, company: out.client.company };
  ok(res, { project: out, payments, documents, tasks }, "Project fetched.");
};

export const createProject = async (req, res) => {
  const client = await Client.findById(oid(req.body.client));
  if (!client) throw createHttpError(404, "Client not found.");
  const body = shapePricing(req.body);
  const project = await Project.create({ ...body, createdBy: req.user._id });
  // a lead becomes a client once a project exists
  if (client.type === "lead") await Client.updateOne({ _id: client._id }, { type: "client" });
  ok(res, project, "Project created.", 201);
};

export const updateProject = async (req, res) => {
  const project = await Project.findById(oid(req.params.id));
  if (!project) throw createHttpError(404, "Project not found.");
  // pricing option cannot be switched once money has been recorded against it
  if (req.body.pricingType !== project.pricingType && (await Payment.exists({ project: project._id, status: "received" })))
    throw createHttpError(409, "Pricing option can't be changed after a payment has been received.");
  const stoppedAt = project.subscription?.stoppedAt ?? null; // editing the project never restarts a stopped subscription
  project.set(shapePricing(req.body));
  if (project.pricingType === "subscription") project.subscription.stoppedAt = stoppedAt;
  await project.save();
  ok(res, project, "Project updated.");
};

export const setProjectStatus = async (req, res) => {
  const project = await Project.findByIdAndUpdate(oid(req.params.id), { status: req.body.status }, { new: true });
  if (!project) throw createHttpError(404, "Project not found.");
  ok(res, project, "Status updated.");
};

/** Stop (or resume) a subscription. Stopped: no next payment, no new subscription requests, not counted as recurring. */
export const setSubscriptionStopped = async (req, res) => {
  const project = await Project.findById(oid(req.params.id));
  if (!project) throw createHttpError(404, "Project not found.");
  if (project.pricingType !== "subscription") throw createHttpError(422, "Only subscription projects can be stopped.");
  project.subscription.stoppedAt = req.body.stopped ? new Date() : null;
  await project.save();
  ok(res, project, req.body.stopped ? "Subscription stopped." : "Subscription resumed.");
};

export const deleteProject = async (req, res) => {
  const id = oid(req.params.id);
  if (await Payment.exists({ project: id, status: "received" }))
    throw createHttpError(409, "This project has received payments, so it can't be deleted. Mark it cancelled instead.");
  await Promise.all([Task.deleteMany({ project: id }), Payment.deleteMany({ project: id }), Document.deleteMany({ project: id })]);
  const project = await Project.findByIdAndDelete(id);
  if (!project) throw createHttpError(404, "Project not found.");
  ok(res, project, "Deleted.");
};

/** Keep exactly one pricing option on the saved document. */
function shapePricing(body) {
  const out = { ...body };
  if (out.pricingType === "one_time") out.subscription = { amount: null, advanceAmount: 0, frequency: null, startDate: null, nextPaymentDate: null, stoppedAt: null };
  else out.oneTime = { totalPrice: null, advanceAmount: 0 };
  return out;
}

// ── Tasks ───────────────────────────────────────────────────────────────────
// GET /tasks?assignee=&status=&project=   (designer is always limited to own tasks)
// A designer sees tasks assigned to them, plus older tasks that were only marked "designer".
const mine = (req) => ({ $or: [{ assignedTo: req.user._id }, { assignedTo: null, assignee: "DESIGNER" }] });
const canTouch = (req, task) => isOwner(req) || (task.assignedTo ? String(task.assignedTo) === String(req.user._id) : task.assignee === "DESIGNER");

export const listTasks = async (req, res) => {
  const filter = {};
  if (req.query.project) filter.project = oid(req.query.project);
  if (req.query.status) filter.status = req.query.status;
  if (!isOwner(req)) Object.assign(filter, mine(req));
  else if (req.query.assignedTo) filter.assignedTo = oid(req.query.assignedTo);
  const data = await Task.find(filter).populate("project", "name").populate("assignedTo", "username role").sort({ status: -1, dueDate: 1, createdAt: -1 });
  ok(res, data, "Tasks fetched.");
};

export const createTask = async (req, res) => {
  if (!(await Project.exists({ _id: oid(req.body.project) }))) throw createHttpError(404, "Project not found.");
  const { assignedTo, ...rest } = req.body;
  // owner can give a task to anyone on the team; a designer can only create tasks for themselves
  const person = isOwner(req) ? await User.findById(oid(assignedTo)).select("role") : { _id: req.user._id, role: req.user.role };
  if (!person) throw createHttpError(404, "Team member not found.");
  const task = await Task.create({ ...rest, assignedTo: person._id, assignee: person.role, createdBy: req.user._id });
  ok(res, await task.populate("assignedTo", "username role"), "Task added.", 201);
};

export const updateTask = async (req, res) => {
  const task = await Task.findById(oid(req.params.id));
  if (!task) throw createHttpError(404, "Task not found.");
  if (!canTouch(req, task)) throw createHttpError(403, "Not your task.");
  const { assignedTo, ...body } = req.body;
  if (assignedTo && isOwner(req)) {
    const person = await User.findById(oid(assignedTo)).select("role");
    if (!person) throw createHttpError(404, "Team member not found.");
    body.assignedTo = person._id;
    body.assignee = person.role;
  }
  if (body.status) body.completedAt = body.status === "completed" ? new Date() : null;
  task.set(body);
  await task.save();
  ok(res, await task.populate("assignedTo", "username role"), "Task updated.");
};

export const deleteTask = async (req, res) => {
  const task = await Task.findById(oid(req.params.id));
  if (!task) throw createHttpError(404, "Task not found.");
  if (!canTouch(req, task)) throw createHttpError(403, "Not your task.");
  await task.deleteOne();
  ok(res, task, "Deleted.");
};
