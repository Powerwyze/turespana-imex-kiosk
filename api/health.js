/**
 * Health — reports which env NAMES are present. Never returns values.
 */

const NAMES = [
  "OPENAI_API_KEY",
  "OPENAI_IMAGE_MODEL",
  "OPENAI_IMAGE_SIZE",
  "OPENAI_IMAGE_QUALITY",
  "GEMINI_API_KEY",
  "GMAIL_USER",
  "GOOGLE_APP_PASSWORD",
  "WYZER_GMAIL_USER",
  "WYZER_APP_PASSWORD",
  "FROM_NAME",
  "SUPABASE_URL",
  "SUPABASE_ANON_KEY",
  "SUPABASE_BUCKET",
];

module.exports = async function handler(req, res) {
  if (req.method === "OPTIONS") { res.statusCode = 204; return res.end(); }
  const present = {};
  for (const name of NAMES) present[name] = Boolean(process.env[name]);
  res.statusCode = 200;
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Cache-Control", "no-store");
  return res.end(JSON.stringify({
    ok: true,
    service: "turespana-imex-kiosk",
    env: present,
  }));
};
