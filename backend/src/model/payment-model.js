import { Schema, model } from "mongoose";

const paymentSchema = new Schema(
  {
    project: { type: Schema.Types.ObjectId, ref: "Project", required: true, index: true },
    client: { type: Schema.Types.ObjectId, ref: "Client", required: true },
    amount: { type: Number, required: true, min: [1, "Amount must be greater than 0"] },
    type: { type: String, enum: ["advance", "partial", "final", "subscription"], required: true },
    // pending = requested/expected, NOT received. Only confirm() moves it to received.
    status: { type: String, enum: ["pending", "received", "cancelled"], default: "pending", index: true },
    dueDate: { type: Date, default: null },
    receivedDate: { type: Date, default: null },
    method: { type: String, enum: ["upi", "bank_transfer", "cash", "cheque", "card", "other", null], default: null },
    reference: { type: String, trim: true, default: "" }, // txn / UTR / cheque no.
    note: { type: String, trim: true, default: "" },
    confirmedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    confirmedAt: { type: Date, default: null },
    createdBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

// Same transaction reference cannot be recorded twice on a project.
paymentSchema.index(
  { project: 1, reference: 1 },
  { unique: true, partialFilterExpression: { reference: { $type: "string", $gt: "" } } }
);

export default model("Payment", paymentSchema);
