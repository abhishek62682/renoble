import { Schema, model } from "mongoose";

// One document holding the business's own details and document defaults.
const settingsSchema = new Schema(
  {
    key: { type: String, default: "main", unique: true },
    businessName: { type: String, trim: true, default: "Renoble" },
    address: { type: String, trim: true, default: "" },
    phone: { type: String, trim: true, default: "" },
    email: { type: String, trim: true, default: "" },
    website: { type: String, trim: true, default: "renoble.agency" },
    // bank details printed at the bottom of invoices
    bankAccountName: { type: String, trim: true, default: "" },
    bankAccountNumber: { type: String, trim: true, default: "" },
    bankIfsc: { type: String, trim: true, uppercase: true, default: "" },
    bankBranch: { type: String, trim: true, default: "" },
    bankUpi: { type: String, trim: true, default: "" },
    panelColor: { type: String, default: "#1a1a1a" }, // background of the preview panel
    accentColor: { type: String, default: "#7241fa" }, // highlight colour on quotations / invoices / receipts
    taxPercent: { type: Number, min: 0, max: 100, default: 0 },
    invoiceDueDays: { type: Number, min: 0, max: 365, default: 7 },
    quotationValidDays: { type: Number, min: 0, max: 365, default: 15 },
    invoiceThankYou: { type: String, default: "Thank you for the business!" },
    invoiceTerms: { type: String, default: "" },
    quotationThankYou: { type: String, default: "Thank you for considering Renoble!" },
    quotationSubscriptionTerms: { type: String, default: "• Monthly recurring payment.\n• Minimum subscription period: 6 months.\n• Hosting and maintenance included throughout the subscription.\n• Payment is due at the beginning of each billing cycle." },
    quotationTerms: { type: String, default: "Payment: 50% advance to start work, remaining 50% on completion.\nIf any third-party service changes its price or policy, the extra cost is paid by the client." },
  },
  { timestamps: true }
);

const Settings = model("Settings", settingsSchema);

export const loadSettings = async () => (await Settings.findOne({ key: "main" })) ?? new Settings({ key: "main" });
export default Settings;
