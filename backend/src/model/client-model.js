import { Schema, model } from "mongoose";

const activitySchema = new Schema({
  type: { type: String, enum: ["call", "message", "email", "meeting", "quotation", "note"], default: "note" },
  note: { type: String, trim: true, required: true, maxlength: 1000 },
  date: { type: Date, default: Date.now },
  nextFollowUp: { type: Date, default: null },
});

const clientSchema = new Schema(
  {
    type: { type: String, enum: ["lead", "client"], default: "lead", index: true },
    name: { type: String, required: [true, "Name is required"], trim: true, maxlength: 120 },
    company: { type: String, trim: true, default: "" },
    email: { type: String, trim: true, lowercase: true, default: "" },
    phone: { type: String, trim: true, default: "" },
    address: { type: String, trim: true, default: "" },
    notes: { type: String, trim: true, default: "" },
    nextFollowUpDate: { type: Date, default: null, index: true },
    followUpNote: { type: String, trim: true, default: "" },
    activities: { type: [activitySchema], default: [] }, // lead pipeline: what happened, when
    createdBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

export default model("Client", clientSchema);
