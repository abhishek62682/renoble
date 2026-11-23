import Client from "../model/client-model.js";
import Project from "../model/project-model.js";
import Payment from "../model/payment-model.js";
import Task from "../model/task-model.js";
import { financeTotals, isOwner, ok } from "../utils/agency.js";

const endOfToday = () => {
  const d = new Date();
  d.setHours(23, 59, 59, 999);
  return d;
};

// GET /reports/dashboard — designer receives work counts only (no money)
export const dashboard = async (req, res) => {
  const owner = isOwner(req);
  const count = (status) => Project.countDocuments({ status });
  const [active, awaitingApproval, completed, awaitingPayment] = await Promise.all([
    count("ongoing"),
    count("awaiting_approval"),
    count("completed"),
    count("awaiting_payment"),
  ]);
  const pendingTasks = await Task.countDocuments({ status: "pending", ...(owner ? {} : { $or: [{ assignedTo: req.user._id }, { assignedTo: null, assignee: "DESIGNER" }] }) });
  const data = { active, awaitingApproval, awaitingPayment, completed, pendingTasks };

  if (owner) {
    const end = endOfToday();
    const [followUps, followUpsDue, totals, recentPayments] = await Promise.all([
      Client.find({ nextFollowUpDate: { $ne: null, $lte: end } }).sort({ nextFollowUpDate: 1 }).limit(8),
      Client.countDocuments({ nextFollowUpDate: { $ne: null, $lte: end } }),
      financeTotals(),
      Payment.find({ status: "received" }).populate("project", "name businessName").populate("client", "name").sort({ receivedDate: -1 }).limit(5),
    ]);
    Object.assign(data, { followUps, followUpsDue, ...totals, recentPayments });
  }
  ok(res, data, "Dashboard fetched.");
};

// GET /reports/summary — simple totals (owner only)
export const summary = async (req, res) => {
  const [totals, byStatus, leads, clients] = await Promise.all([
    financeTotals(),
    Project.aggregate([{ $group: { _id: "$status", count: { $sum: 1 } } }]),
    Client.countDocuments({ type: "lead" }),
    Client.countDocuments({ type: "client" }),
  ]);
  // money received per month, last 6 months (months with nothing show 0)
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth() - 5, 1);
  const rows = await Payment.aggregate([
    { $match: { status: "received", receivedDate: { $gte: start } } },
    { $group: { _id: { $dateToString: { format: "%Y-%m", date: "$receivedDate" } }, total: { $sum: "$amount" } } },
  ]);
  const monthlyReceived = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - 5 + i, 1);
    const month = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    return { month, total: rows.find((r) => r._id === month)?.total ?? 0 };
  });
  const pendingRequests = await Payment.find({ status: "pending" })
    .populate("project", "name")
    .populate("client", "name company")
    .sort({ dueDate: 1 })
    .limit(20);
  ok(res, { ...totals, projectsByStatus: byStatus, monthlyReceived, leads, clients, pendingRequests }, "Report fetched.");
};
