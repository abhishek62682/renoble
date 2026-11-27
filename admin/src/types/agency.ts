export type Pagination = {
  total: number; page: number; limit: number; totalPages: number; hasNextPage: boolean; hasPrevPage: boolean;
};

export type ClientType = "lead" | "client";
export type ActivityType = "call" | "message" | "email" | "meeting" | "quotation" | "note";
export interface LeadActivity { _id: string; type: ActivityType; note: string; date: string; nextFollowUp?: string | null }
export const ACTIVITY_LABEL: Record<ActivityType, string> = {
  call: "Call", message: "Message / WhatsApp", email: "Email", meeting: "Meeting", quotation: "Quotation sent", note: "Note",
};
export interface Client {
  _id: string;
  type: ClientType;
  name: string;
  company?: string; // legacy; the business now lives on the project
  email: string;
  phone: string;
  address: string;
  notes: string;
  nextFollowUpDate: string | null;
  followUpNote: string;
  activities?: LeadActivity[];
  createdAt: string;
}

export type ProjectStatus = "awaiting_approval" | "awaiting_payment" | "ongoing" | "on_hold" | "completed" | "cancelled";
export type PricingType = "one_time" | "subscription";
export type Frequency = "monthly" | "quarterly" | "yearly";

export interface ProjectFinance {
  agreed: number; received: number; pendingRequested: number; remaining: number;
  paymentStatus: "unpaid" | "partial" | "paid" | "recurring" | "due";
}
export interface Project {
  _id: string;
  client: Pick<Client, "_id" | "name"> & Partial<Client>;
  name: string;
  businessName?: string;
  services?: string[];
  description: string;
  status: ProjectStatus;
  startDate: string | null;
  deadline: string | null;
  pricingType: PricingType;
  oneTime?: { totalPrice: number | null; advanceAmount: number };
  subscription?: { amount: number | null; advanceAmount?: number; frequency: Frequency | null; startDate: string | null; nextPaymentDate: string | null; stoppedAt?: string | null };
  finance?: ProjectFinance;
  invoiceParts?: { advance?: string; remaining?: string }; // ids of the 50% / balance invoices already made
  createdAt: string;
}

export type PaymentType = "advance" | "partial" | "final" | "subscription";
export type PaymentMethod = "upi" | "bank_transfer" | "cash" | "cheque" | "card" | "other";
export interface Payment {
  _id: string;
  project: { _id: string; name: string; pricingType?: PricingType } | string;
  client: { _id: string; name: string; company?: string } | string;
  amount: number;
  type: PaymentType;
  status: "pending" | "received" | "cancelled";
  dueDate: string | null;
  receivedDate: string | null;
  method: PaymentMethod | null;
  reference: string;
  note: string;
  createdAt: string;
}

export type DocKind = "quotation" | "invoice" | "receipt";
export interface Party { name: string; address: string; phone: string; email: string; website?: string }
export interface LineItem { _id?: string; title: string; description: string; qty: number; rate: number }
export interface DocumentRecord {
  _id: string;
  kind: DocKind;
  number: string;
  status: string;
  project: { _id: string; name: string } | string | null; // empty while a quotation is waiting for the client's yes
  client: { _id: string; name: string; company?: string } | string;
  payment: string | null;
  sourceQuotation: string | null;
  issueDate: string;
  dueDate: string | null;
  billedTo: Party;
  from: Party;
  items: LineItem[];
  taxPercent: number;
  advanceReceived: number;
  thankYou: string;
  terms: string;
  bank?: BankDetails & { show: boolean };
  paymentInfo?: { method?: string; reference?: string; receivedDate?: string };
  createdAt: string;
}

export interface Task {
  _id: string;
  project: { _id: string; name: string } | string;
  title: string;
  notes: string;
  assignee: "OWNER" | "DESIGNER";
  assignedTo?: { _id: string; username: string; role: "OWNER" | "DESIGNER" } | null; // the team member
  dueDate: string | null;
  status: "pending" | "completed";
}

export interface TeamMember { _id: string; username: string; email: string; role: "OWNER" | "DESIGNER" }

// ── labels ──────────────────────────────────────────────────────────────────
export const PROJECT_STATUS_LABEL: Record<ProjectStatus, string> = {
  awaiting_approval: "Awaiting Approval",
  awaiting_payment: "Awaiting Payment",
  ongoing: "Ongoing",
  on_hold: "On Hold",
  completed: "Completed",
  cancelled: "Cancelled",
};
export const PAYMENT_TYPE_LABEL: Record<PaymentType, string> = {
  advance: "Advance", partial: "Partial", final: "Final balance", subscription: "Subscription",
};
export const METHOD_LABEL: Record<PaymentMethod, string> = {
  upi: "UPI", bank_transfer: "Bank transfer", cash: "Cash", cheque: "Cheque", card: "Card", other: "Other",
};
export const KIND_LABEL: Record<DocKind, string> = { quotation: "Quotation", invoice: "Invoice", receipt: "Receipt" };
export const KIND_PATH = { quotation: "/dashboard/quotations", invoice: "/dashboard/invoices" } as const;

// ── helpers ─────────────────────────────────────────────────────────────────
export function calcTotals(d: Pick<DocumentRecord, "items" | "taxPercent" | "advanceReceived" | "kind">) {
  const subtotal = d.items.reduce((s, i) => s + (Number(i.qty) || 0) * (Number(i.rate) || 0), 0);
  const tax = (subtotal * (Number(d.taxPercent) || 0)) / 100;
  const total = subtotal + tax;
  const advance = d.kind === "invoice" ? Number(d.advanceReceived) || 0 : 0;
  return { subtotal, tax, total, advance, due: Math.max(total - advance, 0) };
}

export const formatINR = (n: number | null | undefined) =>
  "₹" + (n ?? 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const formatDate = (iso?: string | null) => {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short" }) + ", " + d.getFullYear();
};

/** yyyy-mm-dd for <input type="date"> (local day, not UTC-shifted) */
export const toInputDate = (iso?: string | null) => {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

export const nameOf = (v: { name: string } | string | undefined | null) =>
  !v ? "—" : typeof v === "string" ? v : v.name;
export const idOf = (v: { _id: string } | string) => (typeof v === "string" ? v : v._id);

/** Quotations/invoices open in the editor, receipts in the read-only viewer. */
export const docPath = (d: Pick<DocumentRecord, "_id" | "kind">) =>
  d.kind === "receipt" ? `/dashboard/receipts/${d._id}` : `${KIND_PATH[d.kind]}/${d._id}/edit`;

/** Leads and clients share one section and one detail page. */
export const clientPath = (c: { _id: string; type?: ClientType }) => `/dashboard/clients/${c._id}`;

export const SERVICE_OPTIONS = [
  "Website Development", "Website Redesign", "App Development", "Custom Software",
  "Logo & Branding", "Business Email Setup Cost (Optional)",
];

/** Quotation/invoice line suggestions: the project services plus a few that are only billed, never a project. */
export const DOCUMENT_SERVICE_OPTIONS = [...SERVICE_OPTIONS, "Domain", "Hosting"];

/** Printed at the bottom of invoices. */
export interface BankDetails { accountName: string; accountNumber: string; ifsc: string; branch: string; upi: string }

export interface BusinessSettings {
  businessName: string; address: string; phone: string; email: string; website: string;
  bankAccountName: string; bankAccountNumber: string; bankIfsc: string; bankBranch: string; bankUpi: string;
  panelColor: string; accentColor: string;
  taxPercent: number; invoiceDueDays: number; quotationValidDays: number;
  invoiceThankYou: string; invoiceTerms: string; quotationThankYou: string; quotationTerms: string; quotationSubscriptionTerms: string;
}
