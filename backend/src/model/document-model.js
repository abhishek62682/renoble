import { Schema, model } from "mongoose";

const partySchema = new Schema(
  { name: String, address: String, phone: String, email: String, website: String },
  { _id: false }
);

const itemSchema = new Schema(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, trim: true, default: "" },
    qty: { type: Number, min: 0, default: 1 },
    rate: { type: Number, min: 0, default: 0 },
  },
  { _id: true }
);

const documentSchema = new Schema(
  {
    kind: { type: String, enum: ["quotation", "invoice", "receipt"], required: true, index: true },
    number: { type: String, required: true, unique: true },
    status: { type: String, default: "sent" },
    project: { type: Schema.Types.ObjectId, ref: "Project", default: null, index: true }, // a quotation can exist before any project: it is created once the client says yes
    client: { type: Schema.Types.ObjectId, ref: "Client", required: true },
    payment: { type: Schema.Types.ObjectId, ref: "Payment", default: null },
    part: { type: String, enum: ["advance", "remaining", null], default: null }, // invoice made from the projects list: 50% advance or balance
    sourceQuotation: { type: Schema.Types.ObjectId, ref: "Document", default: null },

    issueDate: { type: Date, required: true },
    dueDate: { type: Date, default: null }, // due date (invoice) / valid until (quotation)
    billedTo: partySchema,
    from: partySchema,
    items: { type: [itemSchema], default: [] },
    taxPercent: { type: Number, min: 0, max: 100, default: 0 },
    advanceReceived: { type: Number, min: 0, default: 0 },
    // Invoices: bank details printed at the bottom; editable per invoice, `show` switches the block on/off
    bank: {
      show: { type: Boolean, default: false },
      accountName: { type: String, default: "" },
      accountNumber: { type: String, default: "" },
      ifsc: { type: String, default: "" },
      branch: { type: String, default: "" },
      upi: { type: String, default: "" },
    },
    thankYou: { type: String, default: "" },
    terms: { type: String, default: "" },
    // Receipts only: snapshot of the confirmed payment
    paymentInfo: {
      method: String,
      reference: String,
      receivedDate: Date,
    },
    createdBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

// Duplicate protection: one receipt and one invoice per payment, one invoice per quotation.
documentSchema.index(
  { payment: 1, kind: 1 },
  { unique: true, partialFilterExpression: { payment: { $type: "objectId" }, kind: { $in: ["invoice", "receipt"] } } }
);
documentSchema.index(
  { sourceQuotation: 1 },
  { unique: true, partialFilterExpression: { sourceQuotation: { $type: "objectId" } } }
);

export default model("Document", documentSchema);
