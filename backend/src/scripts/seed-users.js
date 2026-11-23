// Creates (or resets the password of) the two sign-ins from the SEED_* env values.
import mongoose from "mongoose";
import User from "../model/user-model.js";

const people = [
  { role: "OWNER", username: process.env.SEED_OWNER_NAME, email: process.env.SEED_OWNER_EMAIL, password: process.env.SEED_OWNER_PASSWORD },
  { role: "DESIGNER", username: process.env.SEED_DESIGNER_NAME, email: process.env.SEED_DESIGNER_EMAIL, password: process.env.SEED_DESIGNER_PASSWORD },
];

await mongoose.connect(process.env.MONGO_CONNECTION_STRING);
for (const p of people) {
  if (!p.email || !p.password || p.password.length < 8) { console.log(`Skipped ${p.role}: set SEED_${p.role}_EMAIL / _PASSWORD (8+ chars)`); continue; }
  const user = (await User.findOne({ email: p.email.toLowerCase() })) ?? new User({ email: p.email });
  Object.assign(user, { username: p.username || p.role, role: p.role, password: p.password });
  await user.save();
  console.log(`${p.role} ready: ${p.email}`);
}
await mongoose.disconnect();
