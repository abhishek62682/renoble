import { Schema, model } from "mongoose";

const taskSchema = new Schema(
  {
    project: { type: Schema.Types.ObjectId, ref: "Project", required: true, index: true },
    title: { type: String, required: [true, "Title is required"], trim: true, maxlength: 200 },
    notes: { type: String, trim: true, default: "" },
    assignee: { type: String, enum: ["OWNER", "DESIGNER"], required: true, index: true }, // role of the assigned person
    assignedTo: { type: Schema.Types.ObjectId, ref: "User", default: null, index: true }, // the team member; empty on older tasks
    dueDate: { type: Date, default: null },
    status: { type: String, enum: ["pending", "completed"], default: "pending", index: true },
    completedAt: { type: Date, default: null },
    createdBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

export default model("Task", taskSchema);
