import { Schema, model } from "mongoose";

export const PROJECT_STATUSES = [
  "awaiting_approval",
  "awaiting_payment",
  "ongoing",
  "on_hold",
  "completed",
  "cancelled",
];

const projectSchema = new Schema(
  {
    client: { type: Schema.Types.ObjectId, ref: "Client", required: true, index: true },
    name: { type: String, required: [true, "Project name is required"], trim: true, maxlength: 160 },
    businessName: { type: String, trim: true, default: "" }, // the business this project is for
    services: { type: [String], default: [] }, // e.g. Logo Branding, App Development
    description: { type: String, trim: true, default: "" },
    status: { type: String, enum: PROJECT_STATUSES, default: "awaiting_approval", index: true },
    startDate: { type: Date, default: null },
    deadline: { type: Date, default: null },

    // Exactly ONE pricing option per project.
    pricingType: { type: String, enum: ["one_time", "subscription"], required: true },
    oneTime: {
      totalPrice: { type: Number, min: 0, default: null },
      advanceAmount: { type: Number, min: 0, default: 0 }, // agreed advance (actual money lives in Payments)
    },
    subscription: {
      amount: { type: Number, min: 0, default: null },
      frequency: { type: String, enum: ["monthly", "quarterly", "yearly"], default: null },
      startDate: { type: Date, default: null },
      nextPaymentDate: { type: Date, default: null },
    },
    createdBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

export default model("Project", projectSchema);
