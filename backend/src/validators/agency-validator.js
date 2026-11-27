import { z } from "zod";

const str = (max = 500) => z.string().trim().max(max).optional().default("");
const ostr = (max = 500) => z.string().trim().max(max).optional();
const date = z.preprocess(
  (v) => (v === "" || v === undefined ? null : v),
  z.coerce.date({ message: "Invalid date" }).nullable()
);
const id = z.object({ id: z.string().min(1) });

export const clientBody = z.object({
  type: z.enum(["lead", "client"]).default("lead"),
  name: z.string().trim().min(2, "Name must be at least 2 characters").max(120),
  company: str(160),
  email: z.union([z.literal(""), z.string().trim().email("Invalid email")]).optional().default(""),
  phone: str(40),
  address: str(300),
  notes: str(2000),
  nextFollowUpDate: date.optional(),
  followUpNote: str(300),
});
export const createClientSchema = z.object({ body: clientBody });
export const updateClientSchema = z.object({
  body: z.object({
    type: z.enum(["lead", "client"]).optional(),
    name: z.string().trim().min(2, "Name must be at least 2 characters").max(120).optional(),
    company: ostr(160),
    email: z.union([z.literal(""), z.string().trim().email("Invalid email")]).optional(),
    phone: ostr(40),
    address: ostr(300),
    notes: ostr(2000),
    nextFollowUpDate: date.optional(),
    followUpNote: ostr(300),
  }),
  params: id,
});

export const addActivitySchema = z.object({
  body: z.object({
    type: z.enum(["call", "message", "email", "meeting", "quotation", "note"]).default("note"),
    note: z.string().trim().min(1, "Write what happened").max(1000),
    date,
    nextFollowUp: date.optional(),
  }),
  params: id,
});
export const deleteActivitySchema = z.object({ params: id.extend({ activityId: z.string().min(1) }) });

const projectBase = z.object({
  client: z.string().min(1, "Client is required"),
  name: z.string().trim().min(2, "Project name is required").max(160),
  businessName: str(160), // optional: unregistered clients have none; documents then use the client's name
  services: z.array(z.string().trim().min(1).max(60)).max(20).default([]),
  description: str(3000),
  status: z
    .enum(["awaiting_approval", "awaiting_payment", "ongoing", "on_hold", "completed", "cancelled"])
    .default("awaiting_approval"),
  startDate: date.optional(),
  deadline: date.optional(),
  pricingType: z.enum(["one_time", "subscription"]),
  oneTime: z
    .object({
      totalPrice: z.coerce.number().min(0).nullable().optional(),
      advanceAmount: z.coerce.number().min(0).optional().default(0),
    })
    .optional(),
  subscription: z
    .object({
      amount: z.coerce.number().min(0).nullable().optional(),
      advanceAmount: z.coerce.number().min(0).optional().default(0),
      frequency: z.enum(["monthly", "quarterly", "yearly"]).nullable().optional(),
      startDate: date.optional(),
      nextPaymentDate: date.optional(),
    })
    .optional(),
});

const pricingCheck = (b, ctx) => {
  if (b.pricingType === "one_time") {
    if (!(b.oneTime?.totalPrice > 0))
      ctx.addIssue({ code: "custom", path: ["oneTime", "totalPrice"], message: "Total price is required" });
    if (b.oneTime && b.oneTime.advanceAmount > (b.oneTime.totalPrice || 0))
      ctx.addIssue({ code: "custom", path: ["oneTime", "advanceAmount"], message: "Advance cannot exceed the total price" });
  } else {
    if (!(b.subscription?.amount > 0))
      ctx.addIssue({ code: "custom", path: ["subscription", "amount"], message: "Recurring amount is required" });
    if (!b.subscription?.frequency)
      ctx.addIssue({ code: "custom", path: ["subscription", "frequency"], message: "Billing frequency is required" });
    if (!b.subscription?.startDate)
      ctx.addIssue({ code: "custom", path: ["subscription", "startDate"], message: "Start date is required" });
    if (!b.subscription?.nextPaymentDate)
      ctx.addIssue({ code: "custom", path: ["subscription", "nextPaymentDate"], message: "Next payment date is required" });
  }
};
export const projectBody = projectBase.superRefine(pricingCheck);
export const createProjectSchema = z.object({ body: projectBody });
export const updateProjectSchema = z.object({ body: projectBody, params: id });
export const subscriptionStopSchema = z.object({ body: z.object({ stopped: z.boolean() }), params: id });
export const projectStatusSchema = z.object({
  body: z.object({
    status: z.enum(["awaiting_approval", "awaiting_payment", "ongoing", "on_hold", "completed", "cancelled"]),
  }),
  params: id,
});

export const createPaymentSchema = z.object({
  body: z.object({
    project: z.string().min(1, "Project is required"),
    amount: z.coerce.number().min(1, "Amount must be greater than 0"),
    type: z.enum(["advance", "partial", "final", "subscription"]),
    dueDate: date.optional(),
    note: str(500),
  }),
});
export const confirmPaymentSchema = z.object({
  body: z.object({
    receivedDate: date.optional(),
    method: z.enum(["upi", "bank_transfer", "cash", "cheque", "card", "other"], { message: "Select a payment method" }),
    reference: str(120),
  }),
  params: id,
});

const party = z.object({
  name: z.string().trim().max(160).default(""),
  address: z.string().trim().max(400).default(""),
  phone: z.string().trim().max(40).default(""),
  email: z.string().trim().max(160).default(""),
  website: z.string().trim().max(120).default(""),
});
export const docBody = z.object({
  issueDate: date,
  dueDate: date.optional(),
  billedTo: party,
  from: party,
  items: z
    .array(
      z.object({
        title: z.string().trim().min(1, "Item title is required").max(200),
        description: z.string().trim().max(500).default(""),
        qty: z.coerce.number().min(0),
        rate: z.coerce.number().min(0),
      })
    )
    .min(1, "Add at least one item"),
  taxPercent: z.coerce.number().min(0).max(100).default(0),
  advanceReceived: z.coerce.number().min(0).default(0),
  part: z.enum(["advance", "remaining"]).nullable().optional(),
  bank: z
    .object({
      show: z.boolean().default(false),
      accountName: z.string().trim().max(120).default(""),
      accountNumber: z.string().trim().max(40).default(""),
      ifsc: z.string().trim().max(20).default(""),
      branch: z.string().trim().max(120).default(""),
      upi: z.string().trim().max(80).default(""),
    })
    .optional(),
  thankYou: str(300),
  terms: str(500),
  status: z.string().optional(),
});
export const createDocSchema = z.object({
  body: docBody.extend({
    kind: z.enum(["quotation", "invoice"]),
    project: z.string().optional(), // invoices need one; a quotation can be for a client/lead instead
    client: z.string().optional(),
    payment: z.string().nullable().optional(),
  }),
});
export const updateDocSchema = z.object({ body: docBody, params: id });
export const createReceiptSchema = z.object({
  body: z.object({ payment: z.string().min(1, "Payment is required") }),
});

export const invoiceReceiptSchema = z.object({
  body: z.object({
    method: z.enum(["upi", "bank_transfer", "cash", "cheque", "card", "other"]).optional(),
    reference: str(80),
    receivedDate: date.optional(),
  }),
  params: id,
});

export const addMemberSchema = z.object({
  body: z.object({
    username: z.string().trim().min(2, "Name is required").max(60),
    email: z.string().trim().email("Invalid email"),
    password: z.string().min(8, "Password must be at least 8 characters").max(100),
  }),
});

export const createTaskSchema = z.object({
  body: z.object({
    project: z.string().min(1, "Project is required"),
    title: z.string().trim().min(2, "Title is required").max(200),
    notes: str(2000),
    assignedTo: z.string().min(1, "Choose who it is for"),
    dueDate: date.optional(),
  }),
});
export const updateTaskSchema = z.object({
  body: z.object({
    title: z.string().trim().min(2).max(200).optional(),
    notes: ostr(2000),
    assignedTo: z.string().min(1).optional(),
    dueDate: date.optional(),
    status: z.enum(["pending", "completed"]).optional(),
  }),
  params: id,
});

export const settingsSchema = z.object({
  body: z.object({
    businessName: z.string().trim().min(2, "Business name is required").max(160),
    address: z.string().trim().max(400).default(""),
    phone: z.string().trim().max(40).default(""),
    email: z.union([z.literal(""), z.string().trim().email("Invalid email")]).default(""),
    website: z.string().trim().max(120).default(""),
    bankAccountName: z.string().trim().max(120).default(""),
    bankAccountNumber: z.string().trim().max(40).default(""),
    bankIfsc: z.string().trim().max(20).default(""),
    bankBranch: z.string().trim().max(120).default(""),
    bankUpi: z.string().trim().max(80).default(""),
    panelColor: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Use a hex colour like #1a1a1a").default("#1a1a1a"),
    accentColor: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Use a hex colour like #7241fa").default("#7241fa"),
    taxPercent: z.coerce.number().min(0).max(100).default(0),
    invoiceDueDays: z.coerce.number().int().min(0).max(365).default(5),
    quotationValidDays: z.coerce.number().int().min(0).max(365).default(15),
    invoiceThankYou: z.string().trim().max(300).default(""),
    invoiceTerms: z.string().trim().max(500).default(""),
    quotationThankYou: z.string().trim().max(300).default(""),
    quotationTerms: z.string().trim().max(500).default(""),
    quotationSubscriptionTerms: z.string().trim().max(500).optional(),
  }),
});
