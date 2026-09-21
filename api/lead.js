import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
/**
 * Turespaña · IMEX — newsletter lead capture (+ optional photo store for QR)
 *
 * POST JSON: { name, email, destinationId, destinationLabel, newsletter, photoId?, imageBase64?, mimeType? }
 *
 * Env: SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_BUCKET
 * If Supabase is missing, the lead is still accepted (email path is the source of truth)
 * and we return { ok: true, stored: false }.
 */

const { createClient } = require("@supabase/supabase-js");

function setCors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
}

async function readJson(req) {
  if (req.body && typeof req.body === "object") return req.body;
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

function supabaseClient() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

function randomId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export default async function handler(req, res) {
  setCors(res);
  if (req.method === "OPTIONS") { res.statusCode = 204; return res.end(); }
  if (req.method !== "POST") { res.statusCode = 405; return res.end("Method not allowed"); }

  let body;
  try { body = await readJson(req); }
  catch (e) { res.statusCode = 400; return res.end("Invalid JSON: " + e.message); }

  const {
    name,
    email,
    destinationId,
    destinationLabel,
    newsletter,
    imageBase64,
    mimeType,
  } = body || {};

  if (!isEmail(email)) { res.statusCode = 400; return res.end("Invalid email"); }

  const photoId = randomId();
  let publicUrl = null;
  let stored = false;
  const supabase = supabaseClient();
  const bucket = process.env.SUPABASE_BUCKET || "turespana-imex";

  if (supabase && imageBase64) {
    try {
      const buf = Buffer.from(imageBase64, "base64");
      const filename = `${photoId}.jpg`;
      const { error: upErr } = await supabase.storage
        .from(bucket)
        .upload(filename, buf, {
          contentType: mimeType || "image/jpeg",
          upsert: true,
        });
      if (upErr) throw upErr;
      const { data: pub } = supabase.storage.from(bucket).getPublicUrl(filename);
      publicUrl = (pub?.publicUrl || "").replace(/\?$/, "");
    } catch (e) {
      console.error("supabase upload skipped", e.message || e);
    }
  }

  if (supabase) {
    try {
      const row = {
        id: photoId,
        email: String(email).slice(0, 320),
        name: String(name || "").slice(0, 80),
        destination_id: String(destinationId || "").slice(0, 64),
        destination_label: String(destinationLabel || "").slice(0, 80),
        newsletter: newsletter !== false,
        public_url: publicUrl,
        source: "turespana-imex-kiosk",
        event: "IMEX Las Vegas · Oct 13–15 2026 · Hotel Mandalay",
      };
      const { error: insErr } = await supabase.from("turespana_leads").insert(row);
      if (insErr) throw insErr;
      stored = true;
    } catch (e) {
      console.error("supabase insert skipped", e.message || e);
    }
  }

  res.statusCode = 200;
  res.setHeader("Content-Type", "application/json");
  return res.end(JSON.stringify({
    ok: true,
    stored,
    photoId: (publicUrl || stored) ? photoId : null,
    publicUrl,
  }));
};
