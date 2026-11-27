import createHttpError from "http-errors";
import mongoose from "mongoose";
import Payment from "../model/payment-model.js";
import Project from "../model/project-model.js";

export const round2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;

export const oid = (id) => {
  if (!mongoose.isValidObjectId(id)) throw createHttpError(400, "Invalid id.");
  return id;
};

export const isOwner = (req) => req.user?.role === "OWNER";

export const ok = (res, data, message = "OK", status = 200, extra = {}) =>
  res.status(status).json({ success: true, message, data, ...extra });

export const parsePaging = (req, max = 100) => {
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const limit = Math.min(max, Math.max(1, parseInt(req.query.limit) || 10));
  return { page, limit, skip: (page - 1) * limit };
};

export const paginationMeta = (total, page, limit) => {
  const totalPages = Math.max(1, Math.ceil(total / limit));
  return { total, page, limit, totalPages, hasNextPage: page < totalPages, hasPrevPage: page > 1 };
};

/** Money summary for a single project. Progress status and payment status stay separate. */
export const buildFinance = (project, payments) => {
  const received = round2(payments.filter((p) => p.status === "received").reduce((s, p) => s + p.amount, 0));
  const pendingRequested = round2(payments.filter((p) => p.status === "pending").reduce((s, p) => s + p.amount, 0));

  if (project.pricingType === "one_time") {
    const agreed = round2(project.oneTime?.totalPrice || 0);
    const remaining = round2(Math.max(agreed - received, 0));
    const paymentStatus = received <= 0 ? "unpaid" : remaining <= 0 ? "paid" : "partial";
    return { agreed, received, pendingRequested, remaining, paymentStatus };
  }
  // subscription: recurring, so "agreed" is the per-cycle amount
  return {
    agreed: round2(project.subscription?.amount || 0),
    received,
    pendingRequested,
    remaining: pendingRequested,
    paymentStatus: pendingRequested > 0 ? "due" : "recurring",
  };
};

/** Strip money details for users who are not the owner (designer). */
export const publicProject = (project, finance, req) => {
  const obj = project.toObject ? project.toObject() : project;
  if (isOwner(req)) return { ...obj, finance };
  delete obj.oneTime;
  delete obj.subscription;
  return obj;
};

export const addCycle = (date, frequency) => {
  const d = new Date(date);
  const months = frequency === "yearly" ? 12 : frequency === "quarterly" ? 3 : 1;
  d.setMonth(d.getMonth() + months);
  return d;
};

/** Cross-project money totals used by dashboard and reports. */
export const financeTotals = async () => {
  const [projects, payments] = await Promise.all([
    Project.find({ status: { $ne: "cancelled" } }).select("pricingType oneTime subscription"),
    Payment.find({ status: { $in: ["received", "pending"] } }).select("project amount status"),
  ]);
  const byProject = new Map();
  for (const p of payments) {
    const k = String(p.project);
    if (!byProject.has(k)) byProject.set(k, []);
    byProject.get(k).push(p);
  }

  let projectValue = 0;
  let recurringPerMonth = 0;
  let pendingAmount = 0;
  for (const pr of projects) {
    const f = buildFinance(pr, byProject.get(String(pr._id)) || []);
    if (pr.pricingType === "one_time") {
      projectValue += f.agreed;
      pendingAmount += f.remaining;
    } else {
      const div = pr.subscription?.frequency === "yearly" ? 12 : pr.subscription?.frequency === "quarterly" ? 3 : 1;
      if (!pr.subscription?.stoppedAt) recurringPerMonth += f.agreed / div; // stopped subscriptions bring no more money
      pendingAmount += f.pendingRequested; // but what was already requested is still owed
    }
  }
  const receivedAmount = payments.filter((p) => p.status === "received").reduce((s, p) => s + p.amount, 0);
  return {
    projectValue: round2(projectValue),
    recurringPerMonth: round2(recurringPerMonth),
    receivedAmount: round2(receivedAmount),
    pendingAmount: round2(pendingAmount),
  };
};
