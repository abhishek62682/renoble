import createHttpError from "http-errors";
import Payment from "../model/payment-model.js";
import Project from "../model/project-model.js";
import Document from "../model/document-model.js";
import { addCycle, buildFinance, oid, ok, paginationMeta, parsePaging, round2 } from "../utils/agency.js";

const sumReceived = async (projectId) => {
  const rows = await Payment.find({ project: projectId, status: "received" }).select("amount");
  return rows.reduce((s, p) => s + p.amount, 0);
};

// GET /payments?status=&project=&page=&limit=
export const listPayments = async (req, res) => {
  const { page, limit, skip } = parsePaging(req);
  const filter = {};
  if (req.query.status) filter.status = req.query.status;
  if (req.query.project) filter.project = oid(req.query.project);
  const [data, total] = await Promise.all([
    Payment.find(filter)
      .populate("project", "name pricingType")
      .populate("client", "name company")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
    Payment.countDocuments(filter),
  ]);
  ok(res, data, "Payments fetched.", 200, { pagination: paginationMeta(total, page, limit) });
};

// POST /payments — records a payment REQUEST (pending). It is not money received yet.
export const createPayment = async (req, res) => {
  const project = await Project.findById(oid(req.body.project));
  if (!project) throw createHttpError(404, "Project not found.");
  if (project.status === "cancelled") throw createHttpError(409, "This project is cancelled.");

  const isSub = project.pricingType === "subscription";
  if (isSub && req.body.type !== "subscription")
    throw createHttpError(422, "Subscription projects only take subscription payments.");
  if (!isSub && req.body.type === "subscription")
    throw createHttpError(422, "This is a one-time project; choose advance, partial or final.");

  const amount = round2(req.body.amount);
  if (!isSub) {
    const received = await sumReceived(project._id);
    const remaining = round2(project.oneTime.totalPrice - received);
    if (amount > remaining) throw createHttpError(422, `Amount exceeds the remaining balance (₹${remaining}).`);
    if (req.body.type === "advance" && (await Payment.exists({ project: project._id, type: "advance", status: { $ne: "cancelled" } })))
      throw createHttpError(409, "An advance payment already exists for this project.");
  }

  // Duplicate guard: same open request (project + type + amount + due date)
  const dup = await Payment.exists({
    project: project._id,
    type: req.body.type,
    amount,
    status: "pending",
    dueDate: req.body.dueDate ?? null,
  });
  if (dup) throw createHttpError(409, "An identical pending payment request already exists.");

  const payment = await Payment.create({
    project: project._id,
    client: project.client,
    amount,
    type: req.body.type,
    dueDate: req.body.dueDate ?? null,
    note: req.body.note,
    createdBy: req.user._id,
  });
  ok(res, payment, "Payment request saved (not received yet).", 201);
};

// POST /payments/:id/confirm — the ONLY way a payment becomes "received".
export const confirmPayment = async (req, res) => {
  const existing = await Payment.findById(oid(req.params.id));
  if (!existing) throw createHttpError(404, "Payment not found.");
  if (existing.status === "received") throw createHttpError(409, "This payment is already confirmed.");
  if (existing.status === "cancelled") throw createHttpError(409, "This payment was cancelled.");

  const project = await Project.findById(existing.project);
  if (project.pricingType === "one_time") {
    const remaining = round2(project.oneTime.totalPrice - (await sumReceived(project._id)));
    if (existing.amount > remaining) throw createHttpError(422, `Amount exceeds the remaining balance (₹${remaining}).`);
  }

  // atomic: only flips if still pending, so double-clicks can't confirm twice
  const payment = await Payment.findOneAndUpdate(
    { _id: existing._id, status: "pending" },
    {
      status: "received",
      receivedDate: req.body.receivedDate ?? new Date(),
      method: req.body.method,
      reference: req.body.reference,
      confirmedBy: req.user._id,
      confirmedAt: new Date(),
    },
    { new: true, runValidators: true }
  ).catch((e) => {
    if (e.code === 11000) throw createHttpError(409, "That transaction reference is already recorded on this project.");
    throw e;
  });
  if (!payment) throw createHttpError(409, "This payment was already updated.");

  if (project.pricingType === "subscription" && project.subscription?.nextPaymentDate) {
    project.subscription.nextPaymentDate = addCycle(project.subscription.nextPaymentDate, project.subscription.frequency);
    await project.save();
  }
  // the invoice raised for this payment is now paid / partially paid
  const invoices = await Document.find({ kind: "invoice", payment: payment._id });
  const received = await sumReceived(project._id);
  for (const inv of invoices) {
    const sub = inv.items.reduce((s, i) => s + i.qty * i.rate, 0);
    const total = sub + (sub * (inv.taxPercent || 0)) / 100;
    inv.status = received >= total ? "paid" : "partially_paid";
    await inv.save();
  }
  ok(res, payment, "Payment confirmed.");
};

// DELETE /payments/:id — only pending requests can be removed
export const cancelPayment = async (req, res) => {
  const payment = await Payment.findOneAndDelete({ _id: oid(req.params.id), status: "pending" });
  if (!payment) throw createHttpError(409, "Only pending payment requests can be removed.");
  ok(res, payment, "Payment request removed.");
};

export { buildFinance };
