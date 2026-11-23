import { loadSettings } from "../model/settings-model.js";
import { ok } from "../utils/agency.js";

// GET /settings
export const getSettings = async (req, res) => ok(res, await loadSettings(), "Settings fetched.");

// PUT /settings
export const saveSettings = async (req, res) => {
  const s = await loadSettings();
  s.set(req.body);
  await s.save();
  ok(res, s, "Settings saved.");
};
