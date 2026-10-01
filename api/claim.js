import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
/**
 * Turespaña · IMEX — QR claim lookup
 *
 * GET /api/claim?id=<photoId>
 * Returns { publicUrl } from Supabase (turespana_leads or storage).
 */

const { createClient } = require("@supabase/supabase-js");

function setCors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

export default async function handler(req, res) {
  setCors(res);
  if (req.method === "OPTIONS") { res.statusCode = 204; return res.end(); }
  if (req.method !== "GET") { res.statusCode = 405; return res.end("Method not allowed"); }

  const url = new URL(req.url, "http://localhost");
  const id = String(url.searchParams.get("id") || "").replace(/[^a-zA-Z0-9._-]/g, "").slice(0, 80);
  if (!id) { res.statusCode = 400; return res.end("Missing id"); }

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_ANON_KEY;
  const bucket = process.env.SUPABASE_BUCKET || "turespana-imex";
  if (!supabaseUrl || !supabaseKey) {
    res.statusCode = 503;
    res.setHeader("Content-Type", "application/json");
    return res.end(JSON.stringify({ error: "Photo claim storage not configured" }));
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    const { data, error } = await supabase
      .from("turespana_leads")
      .select("public_url,id")
      .eq("id", id)
      .maybeSingle();
    if (error) throw error;
    if (data?.public_url) {
      res.statusCode = 200;
      res.setHeader("Content-Type", "application/json");
      res.setHeader("Cache-Control", "no-store");
      return res.end(JSON.stringify({ ok: true, photoId: data.id, publicUrl: data.public_url }));
    }
  } catch (e) {
    console.error("claim table lookup", e.message || e);
  }

  const filename = `${id}.jpg`;
  const { data: pub } = supabase.storage.from(bucket).getPublicUrl(filename);
  const publicUrl = (pub?.publicUrl || "").replace(/\?$/, "");

  res.statusCode = 200;
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Cache-Control", "no-store");
  return res.end(JSON.stringify({ ok: true, photoId: id, publicUrl }));
};
