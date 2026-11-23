import { Schema, model } from "mongoose";

const counterSchema = new Schema({
  key: { type: String, required: true, unique: true },
  seq: { type: Number, default: 0 },
});

const Counter = model("Counter", counterSchema);

/** Atomic, gap-free-ish sequence per key (used for document numbers). */
export const nextSeq = async (key) => {
  const c = await Counter.findOneAndUpdate(
    { key },
    { $inc: { seq: 1 } },
    { upsert: true, new: true }
  );
  return c.seq;
};

export default Counter;

/** Next value without consuming it (used to show the upcoming document number in the editor). */
export const peekSeq = async (key) => ((await Counter.findOne({ key }))?.seq ?? 0) + 1;
