import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
/**
 * Turespaña · IMEX — photo email delivery
 *
 * POST JSON: { name, email, destinationId, destinationLabel, filename, mimeType, imageBase64 }
 *
 * Env:
 *   WYZER_APP_PASSWORD / GOOGLE_APP_PASSWORD
 *   WYZER_GMAIL_USER / GMAIL_USER
 *   FROM_NAME  default: "Turespaña"
 */

const nodemailer = require("nodemailer");

function setCors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
}

async function readJson(req) {
  return new Promise((resolve, reject) => {
    let raw = "";
    req.setEncoding("utf8");
    req.on("data", (c) => {
      raw += c;
      if (raw.length > 12 * 1024 * 1024) reject(new Error("Payload too large"));
    });
    req.on("end", () => {
      try { resolve(JSON.parse(raw || "{}")); }
      catch (e) { reject(e); }
    });
    req.on("error", reject);
  });
}

const isEmail = (s) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s || "");
const esc = (s) => String(s || "").replace(/[&<>"']/g, (c) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
}[c]));

export default async function handler(req, res) {
  setCors(res);
  if (req.method === "OPTIONS") { res.statusCode = 204; return res.end(); }
  if (req.method !== "POST") { res.statusCode = 405; return res.end("Method not allowed"); }

  let body;
  try { body = await readJson(req); }
  catch (e) { res.statusCode = 400; return res.end("Invalid JSON: " + e.message); }

  const { name, email, destinationLabel, filename, mimeType, imageBase64 } = body || {};
  if (!isEmail(email)) { res.statusCode = 400; return res.end("Invalid email"); }
  if (!imageBase64) { res.statusCode = 400; return res.end("Missing imageBase64"); }

  const pass = process.env.WYZER_APP_PASSWORD || process.env.GOOGLE_APP_PASSWORD;
  if (!pass) { res.statusCode = 500; return res.end("App password not configured (WYZER_APP_PASSWORD)"); }

  const user = process.env.WYZER_GMAIL_USER
    || process.env.GMAIL_USER
    || "wyzer@powerwyze.com";
  const fromName = process.env.FROM_NAME || "Turespaña";
  const destLabel = String(destinationLabel || "Spain").slice(0, 80);
  const greetName = name ? esc(name) : "friend";

  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: { user, pass },
  });

  const safeFilename = String(filename || "turespana-portrait.jpg")
    .replace(/[^a-z0-9@._-]/gi, "_")
    .slice(0, 200);

  const html = `<!doctype html><html><body style="margin:0;padding:0;font-family:'Inter',Helvetica,Arial,sans-serif;background:#1B161C;color:#FFFFFF">
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#1B161C;padding:32px 16px">
      <tr><td align="center">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" style="max-width:600px;width:100%;background:linear-gradient(180deg,#2A2428 0%,#1B161C 100%);border:1px solid rgba(255,234,0,0.28);border-radius:20px;overflow:hidden;color:#FFFFFF">
          <tr><td style="padding:28px 32px 18px;text-align:center;border-bottom:1px solid rgba(255,255,255,0.10)">
            <div style="font-family:Georgia,'Times New Roman',serif;font-size:13px;letter-spacing:0.28em;color:#FFEA00;font-weight:700;text-transform:uppercase">Turespaña</div>
            <div style="font-family:Georgia,'Times New Roman',serif;font-size:28px;font-weight:700;color:#FFFFFF;margin-top:6px;line-height:1.1">Spain is waiting</div>
            <div style="margin-top:10px;font-size:11px;letter-spacing:0.22em;color:#C8C0A8;text-transform:uppercase">IMEX Las Vegas · Oct 13–15 2026 · Hotel Mandalay</div>
          </td></tr>
          <tr><td style="padding:26px 32px 8px;text-align:center">
            <h1 style="margin:0 0 8px;font-size:26px;font-weight:700;color:#FFFFFF;line-height:1.15">Hola, ${greetName}</h1>
            <p style="margin:0 0 14px;font-size:15px;line-height:1.55;color:#E8E0CC">
              Your Spain portrait is attached.<br/>
              <em style="color:#C8C0A8">Tu retrato de España está adjunto.</em>
            </p>
            <p style="margin:0 0 8px;font-size:13px;letter-spacing:0.12em;text-transform:uppercase;color:#E42719">${esc(destLabel)}</p>
          </td></tr>
          <tr><td style="padding:12px 32px 6px">
            <div style="background:rgba(255,234,0,0.08);border:1px solid rgba(255,234,0,0.4);border-radius:14px;padding:18px 20px;text-align:center">
              <div style="font-size:11px;letter-spacing:0.22em;text-transform:uppercase;color:#FFEA00;font-weight:700;margin-bottom:8px">Newsletter · Boletín</div>
              <p style="margin:0;font-size:14px;line-height:1.5;color:#FFFFFF">
                You're on the Turespaña newsletter list from the IMEX Las Vegas booth.<br/>
                <em style="color:#C8C0A8">Te has suscrito al boletín de Turespaña en IMEX Las Vegas.</em>
              </p>
            </div>
          </td></tr>
          <tr><td style="padding:18px 32px 6px">
            <div style="background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.12);border-radius:14px;padding:18px 20px;text-align:center">
              <p style="margin:0 0 14px;font-size:14px;color:#FFFFFF;line-height:1.5">
                Plan the trip: <a href="https://www.spain.info/en/" style="color:#FFEA00;text-decoration:none">spain.info</a>
              </p>
            </div>
          </td></tr>
          <tr><td style="padding:22px 32px 26px;border-top:1px solid rgba(255,255,255,0.10);text-align:center;font-size:11px;color:#C8C0A8;line-height:1.6">
            Turespaña · IMEX Las Vegas · Oct 13–15 2026 · Hotel Mandalay<br/>
            Painted by <strong style="color:#FFFFFF">PowerWyze</strong><br/>
            <span style="color:#8A8274;font-size:10px">You're receiving this because you snapped a portrait at the Turespaña IMEX booth and opted into the newsletter. Reply to unsubscribe.</span>
          </td></tr>
        </table>
      </td></tr>
    </table>
  </body></html>`;

  const text = [
    `Hola, ${name || "friend"}`,
    "",
    "Your Spain portrait is attached.",
    "Tu retrato de España está adjunto.",
    "",
    destLabel ? `Destination: ${destLabel}` : "",
    "",
    "You're on the Turespaña newsletter list from the IMEX Las Vegas booth.",
    "https://www.spain.info/en/",
    "",
    "— Turespaña · IMEX Las Vegas · Painted by PowerWyze",
  ].filter((line) => line !== undefined).join("\n");

  try {
    await transporter.sendMail({
      from: { name: fromName, address: user },
      sender: { name: fromName, address: user },
      replyTo: { name: fromName, address: user },
      to: email,
      subject: "Your Spain portrait · Turespaña at IMEX",
      text,
      html,
      attachments: [{
        filename: safeFilename,
        content: Buffer.from(imageBase64, "base64"),
        contentType: mimeType || "image/jpeg",
      }],
    });
  } catch (e) {
    console.error("smtp error", e);
    res.statusCode = 502;
    return res.end("SMTP error: " + e.message);
  }

  res.statusCode = 200;
  res.setHeader("Content-Type", "application/json");
  return res.end(JSON.stringify({ ok: true }));
};
