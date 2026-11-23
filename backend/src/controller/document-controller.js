import createHttpError from "http-errors";
import Document from "../model/document-model.js";
import Project from "../model/project-model.js";
import Payment from "../model/payment-model.js";
import Client from "../model/client-model.js";
import { nextSeq, peekSeq } from "../model/counter-model.js";
import { loadSettings } from "../model/settings-model.js";
import { oid, ok, paginationMeta, parsePaging } from "../utils/agency.js";

const PREFIX = { quotation: "QT", invoice: "INV", receipt: "RCT" };

// Running number per calendar year: INV-2026-001, INV-2026-002, … (restarts each 1 January)
const numberParts = (kind, date) => {
  const y = date.getFullYear();
  return { key: `${PREFIX[kind]}-${y}`, fmt: (seq) => `${PREFIX[kind]}-${y}-${String(seq).padStart(3, "0")}` };
};

const makeNumber = async (kind, date) => {
  const { key, fmt } = numberParts(kind, date);
  return fmt(await nextSeq(key));
};

// GET /documents/next-number?kind=invoice&date=2026-04-10 — the number the next save will get
export const nextNumber = async (req, res) => {
  const kind = ["quotation", "invoice", "receipt"].includes(req.query.kind) ? req.query.kind : "invoice";
  const date = req.query.date ? new Date(req.query.date) : new Date();
  const { key, fmt } = numberParts(kind, isNaN(date) ? new Date() : date);
  ok(res, { number: fmt(await peekSeq(key)) }, "Next number.");
};

const duplicate = (e, msg) => {
  if (e.code === 11000) throw createHttpError(409, msg);
  throw e;
};

const populate = (q) => q.populate("project", "name pricingType").populate("client", "name company");

// GET /documents?kind=&project=&status=&page=&limit=
export const listDocuments = async (req, res) => {
  const { page, limit, skip } = parsePaging(req);
  const filter = {};
  if (req.query.kind) filter.kind = req.query.kind;
  if (req.query.project) filter.project = oid(req.query.project);
  if (req.query.status) filter.status = req.query.status;
  const [data, total] = await Promise.all([
    populate(Document.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit)),
    Document.countDocuments(filter),
  ]);
  ok(res, data, "Documents fetched.", 200, { pagination: paginationMeta(total, page, limit) });
};

export const getDocument = async (req, res) => {
  const doc = await populate(Document.findById(oid(req.params.id)));
  if (!doc) throw createHttpError(404, "Document not found.");
  ok(res, doc, "Document fetched.");
};

// POST /documents — quotation or invoice (number is always assigned by the server)
export const createDocument = async (req, res) => {
  const { kind, project: projectId, client: clientId, payment: paymentId, ...rest } = req.body;
  if (kind !== "invoice") delete rest.part;
  if (kind === "invoice" && !projectId) throw createHttpError(422, "Select a project for the invoice.");
  const project = projectId ? await Project.findById(oid(projectId)) : null;
  if (projectId && !project) throw createHttpError(404, "Project not found.");
  const client = project ? { _id: project.client } : clientId ? await Client.findById(oid(clientId)).select("_id") : null;
  if (!client) throw createHttpError(404, "Select a client or lead for the quotation.");

  let payment = null;
  if (kind === "invoice" && paymentId) {
    payment = await Payment.findById(oid(paymentId));
    if (!payment || String(payment.project) !== String(project._id)) throw createHttpError(404, "Payment not found on this project.");
    if (payment.status !== "pending") throw createHttpError(409, "An invoice can only be raised for a pending payment request.");
    if (await Document.exists({ kind: "invoice", payment: payment._id })) throw createHttpError(409, "An invoice already exists for this payment.");
  }
  const issueDate = rest.issueDate;
  const doc = await Document.create({
    ...rest,
    kind,
    number: await makeNumber(kind, issueDate),
    status: "sent",
    project: project?._id ?? null,
    client: client._id,
    payment: payment?._id ?? null,
    advanceReceived: kind === "invoice" ? rest.advanceReceived : 0,
    createdBy: req.user._id,
  }).catch((e) => duplicate(e, "An invoice already exists for this payment."));
  ok(res, doc, `${kind === "invoice" ? "Invoice" : "Quotation"} saved.`, 201);
};

export const updateDocument = async (req, res) => {
  const doc = await Document.findById(oid(req.params.id));
  if (!doc) throw createHttpError(404, "Document not found.");
  if (doc.kind === "receipt") throw createHttpError(409, "Receipts can't be edited.");
  const { status, ...body } = req.body; // status changes go through /status
  doc.set(body);
  await doc.save();
  ok(res, doc, "Saved.");
};

export const setDocumentStatus = async (req, res) => {
  const allowed = {
    quotation: ["draft", "sent", "approved", "rejected"],
    invoice: ["draft", "sent"], // paid / partially paid is set automatically when a payment is confirmed
    receipt: ["issued"],
  };
  const doc = await Document.findById(oid(req.params.id));
  if (!doc) throw createHttpError(404, "Document not found.");
  if (!allowed[doc.kind].includes(req.body.status)) throw createHttpError(422, "Invalid status.");
  doc.status = req.body.status;
  await doc.save();
  ok(res, doc, "Status updated.");
};

export const deleteDocument = async (req, res) => {
  const doc = await Document.findById(oid(req.params.id));
  if (!doc) throw createHttpError(404, "Document not found.");
  if (doc.kind === "receipt") throw createHttpError(409, "Issued receipts can't be deleted.");
  await doc.deleteOne();
  ok(res, doc, "Deleted.");
};

// POST /documents/:id/convert — quotation → invoice (once)
export const convertQuotation = async (req, res) => {
  const q = await Document.findById(oid(req.params.id));
  if (!q || q.kind !== "quotation") throw createHttpError(404, "Quotation not found.");
  const existing = await Document.findOne({ sourceQuotation: q._id });
  if (existing) return ok(res, existing, "Already converted.");
  if (!q.project) throw createHttpError(409, "Create the project from this quotation first.");
  const issueDate = new Date();
  const due = new Date(issueDate);
  due.setDate(due.getDate() + 7);
  const invoice = await Document.create({
    ...q.toObject({ depopulate: true }),
    _id: undefined,
    createdAt: undefined,
    updatedAt: undefined,
    kind: "invoice",
    number: await makeNumber("invoice", issueDate),
    status: "sent",
    issueDate,
    dueDate: due,
    advanceReceived: 0,
    payment: null,
    sourceQuotation: q._id,
    thankYou: "Thank you for the business!",
    terms: "",
    createdBy: req.user._id,
  }).catch((e) => duplicate(e, "This quotation was already converted."));
  ok(res, invoice, "Invoice created from quotation.", 201);
};

// Builds (or returns the existing) receipt for a payment that is already confirmed as received.
const issueReceipt = async (payment, userId) => {
  const existing = await Document.findOne({ kind: "receipt", payment: payment._id });
  if (existing) return { doc: existing, created: false };

  const [project, client, biz] = await Promise.all([
    Project.findById(payment.project),
    Client.findById(payment.client),
    loadSettings(),
  ]);
  const issueDate = payment.receivedDate || new Date();
  const label = { advance: "Advance payment", partial: "Part payment", final: "Final payment", subscription: "Subscription payment" }[payment.type];

  const doc = await Document.create({
    kind: "receipt",
    number: await makeNumber("receipt", issueDate),
    status: "issued",
    project: project._id,
    client: client._id,
    payment: payment._id,
    issueDate,
    billedTo: { name: project.businessName || client.name, address: client.address, phone: client.phone, email: client.email },
    from: { name: biz.businessName, address: biz.address, phone: biz.phone, email: biz.email, website: biz.website },
    items: [{ title: project.services?.length ? project.services.join(", ") : project.name, description: label, qty: 1, rate: payment.amount }],
    taxPercent: 0,
    thankYou: "Thank you for your payment!",
    terms: "",
    paymentInfo: { method: payment.method, reference: payment.reference, receivedDate: payment.receivedDate },
    createdBy: userId,
  }).catch(async (e) => {
    if (e.code === 11000) return Document.findOne({ kind: "receipt", payment: payment._id });
    throw e;
  });
  return { doc, created: true };
};

// POST /documents/:id/project — the client said yes: turn the quotation into a project
// (client, business, services and price come from the quotation; a lead becomes a client).
export const projectFromQuotation = async (req, res) => {
  const q = await Document.findById(oid(req.params.id));
  if (!q || q.kind !== "quotation") throw createHttpError(404, "Quotation not found.");
  if (q.project) return ok(res, await Project.findById(q.project), "Project already created.");

  const client = await Client.findById(q.client);
  if (!client) throw createHttpError(404, "Client not found.");
  const services = [...new Set(q.items.map((i) => i.title.trim()).filter(Boolean))];
  const subtotal = q.items.reduce((sum, i) => sum + i.qty * i.rate, 0);
  const business = q.billedTo?.name && q.billedTo.name !== client.name ? q.billedTo.name : "";
  const project = await Project.create({
    client: client._id,
    name: [business || client.name, services.join(", ")].filter(Boolean).join(" – ") || "Project",
    businessName: business,
    services,
    status: "awaiting_payment",
    pricingType: "one_time",
    oneTime: { totalPrice: Math.round(subtotal * 100) / 100, advanceAmount: 0 },
    createdBy: req.user._id,
  });
  if (client.type === "lead") await Client.updateOne({ _id: client._id }, { type: "client", nextFollowUpDate: null, followUpNote: "" });
  q.project = project._id;
  q.status = "approved";
  await q.save();
  ok(res, project, "Project created.", 201);
};

// POST /documents/receipts — ONLY for a payment that has been confirmed as received
export const createReceipt = async (req, res) => {
  const payment = await Payment.findById(oid(req.body.payment));
  if (!payment) throw createHttpError(404, "Payment not found.");
  if (payment.status !== "received")
    throw createHttpError(409, "A receipt can only be issued after the payment is confirmed as received.");
  const { doc, created } = await issueReceipt(payment, req.user._id);
  ok(res, doc, created ? "Receipt issued." : "Receipt already issued.", created ? 201 : 200);
};

// POST /documents/:id/receipt — from the invoices list. Records that the invoice's money was received
// (method/date required the first time), marks the invoice paid and issues the receipt. Safe to call again:
// an invoice that already has a receipt just returns it.
export const receiptForInvoice = async (req, res) => {
  const inv = await Document.findById(oid(req.params.id));
  if (!inv || inv.kind !== "invoice") throw createHttpError(404, "Invoice not found.");

  let payment = inv.payment ? await Payment.findById(inv.payment) : null;
  if (payment?.status === "received") {
    const { doc } = await issueReceipt(payment, req.user._id);
    return ok(res, doc, "Receipt ready.");
  }

  const { method, reference, receivedDate } = req.body;
  if (!method) throw createHttpError(422, "Select how the money was received.");

  const project = await Project.findById(inv.project);
  const subtotal = inv.items.reduce((sum, i) => sum + i.qty * i.rate, 0);
  const due = Math.max(subtotal + (subtotal * (inv.taxPercent || 0)) / 100 - (inv.advanceReceived || 0), 0);
  const amount = Math.round(due * 100) / 100;
  if (amount < 1) throw createHttpError(422, "This invoice has nothing due.");

  const received = (await Payment.find({ project: project._id, status: "received" }).select("amount")).reduce((sum, p) => sum + p.amount, 0);
  if (project.pricingType === "one_time") {
    const remaining = Math.round(((project.oneTime?.totalPrice ?? 0) - received) * 100) / 100;
    if (amount > remaining) throw createHttpError(422, `Amount exceeds the remaining balance (₹${remaining}).`);
  }

  const fields = { status: "received", method, reference: reference || "", receivedDate: receivedDate ?? new Date(), confirmedBy: req.user._id, confirmedAt: new Date() };
  if (payment) {
    payment = await Payment.findOneAndUpdate({ _id: payment._id, status: "pending" }, fields, { new: true, runValidators: true });
    if (!payment) throw createHttpError(409, "This payment was already updated.");
  } else {
    const isSub = project.pricingType === "subscription";
    const hasAdvance = await Payment.exists({ project: project._id, type: "advance", status: { $ne: "cancelled" } });
    const type = isSub ? "subscription" : inv.part === "advance" && !hasAdvance ? "advance" : received + amount >= (project.oneTime?.totalPrice ?? 0) ? "final" : "partial";
    payment = await Payment.create({ project: project._id, client: project.client, amount, type, ...fields, createdBy: req.user._id })
      .catch((e) => { if (e.code === 11000) throw createHttpError(409, "That transaction reference is already recorded on this project."); throw e; });
    inv.payment = payment._id;
  }
  inv.status = "paid";
  await inv.save();
  const { doc } = await issueReceipt(payment, req.user._id);
  ok(res, doc, "Receipt issued.", 201);
};
