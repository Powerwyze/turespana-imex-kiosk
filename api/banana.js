import {portraitStyle,portraitLikeness} from '../lib/portrait-style.js';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
/**
 * Turespaña · IMEX Las Vegas — activation poster generator
 *
 * POST multipart/form-data:
 *   image          jpeg blob (required)
 *   destinationId  canarias | barcelona | bilbao | madrid | andalucia | valencia
 *
 * OpenAI Image Edit first (guest photo + style-lock ref); Gemini fallback.
 *
 * STYLE LOCK: assets/portrait-style-reference.jpg
 *   Painted commercial tourism poster, retaining source facial geometry.
 *   Copy LOOK only. SWAP branding to Turespaña and Spain costumes.
 *
 * Env:
 *   OPENAI_API_KEY, OPENAI_IMAGE_MODEL, OPENAI_IMAGE_SIZE, OPENAI_IMAGE_QUALITY
 *   GEMINI_API_KEY
 */

const formidableModule = require("formidable");
const formidable = formidableModule.default || formidableModule;
const fs = require("node:fs");
const path = require("node:path");

const OPENAI_URL = "https://api.openai.com/v1/images/edits";
const GEMINI_MODEL = process.env.GEMINI_IMAGE_MODEL || "gemini-2.5-flash-image";
const STYLE_REF_PATH = path.join(process.cwd(), "assets", "portrait-style-reference.jpg");

function loadDestinations() {
  const p = path.join(process.cwd(), "public", "data", "destinations.json");
  const raw = JSON.parse(fs.readFileSync(p, "utf8"));
  return Array.isArray(raw.destinations) ? raw.destinations : [];
}

function loadStyleRef() {
  try {
    return fs.readFileSync(STYLE_REF_PATH);
  } catch (_) {
    return null;
  }
}

function buildPrompt(dest) {
  const label = dest?.label || "Spain";
  const costume = dest?.costumePrompt || `typical traditional costume associated with ${label}`;
  const scene = dest?.scenePrompt || "an iconic Spanish landmark composite at sunset";

  return [
    "TASK: Reimagine EVERY person in the FIRST input photo as a Turespaña IMEX Las Vegas activation poster. Match the LOOK of the STYLE REFERENCE image (second image when attached): a polished painted commercial tourism illustration — NOT a raw photobooth snapshot or kiosk UI chrome.",
    portraitStyle,
    `CLOTHING REFERENCE: Image 3 is a six-panel wardrobe reference ONLY. Use the ${dest.referencePanel} panel labelled ${dest.label}. Copy garment shapes, textile colours, embroidery and layering only. Ignore the reference models’ faces, bodies, skin, hair, poses and photorealistic finish. Do not add any of those people to the portrait. Image 1 remains the ONLY identity source and Image 2 remains the rendering-style reference. Translate the selected clothing into that same illustrated style.`,
    "STYLE REFERENCE IS LOOK-ONLY. Do NOT copy: Dominican Republic branding, Go Dominican Republic logo, Miami Marlins uniforms or wordmarks, baseball bats/gloves/caps, baseball stadium as the default setting, or Dominican Republic flag colors as the sky stroke. Do not invent other tourism boards or sports teams.",
    `DESTINATION: ${label}. Wardrobe and landmark must read clearly as ${label}.`,
    "GROUP HANDLING (CRITICAL): Count the people in the input photo. If there is 1 person, render a solo hero portrait. If there are 2–5 people, render ALL of them together. HARD CAP: never render more than 5 people. If the input shows more than 5, pick the 5 most prominent/centered subjects only. Every rendered person must correspond to a real person in the input. Do not invent extra people.",
    `WARDROBE (every person): ${costume}`,
    `SETTING: ${scene} Composite that landmark with a large textured oil-paint BRUSHSTROKE of the SPANISH FLAG sweeping the sky (red–gold–red, thick wet paint, NOT a flag on a pole, similar energy to the painted flag stroke in the style reference). Warm Iberian sunset plus dramatic highlight, cinematic tourism-poster depth.`,
    "POSTER TYPOGRAPHY (allowed in the generated image, commercial layout like the style ref): top-left TURESPAÑA wordmark in clean premium type (no Joan Miró artwork, no Sol de Miró sun drawing — that mark is copyrighted). Optional short destination name. Never include spain.info, any URL, website address, footer text, button or watermark. Remove such text from the reference. Do not add Dominican Republic, Marlins, baseball, or any other brand names.",
    "Color palette: Turespaña tourism energy — sun yellow, Spain red, landscape green, deep black — plus the Spanish flag red/gold sky stroke and fiery sunset oranges. Mood: joyful, welcoming, proud, cinematic, ready-to-travel.",
    "Composition: portrait 9:16 vertical. Solo: centered, waist-up, head fully visible. Group: shoulder-to-shoulder, no cropped faces. Subjects are the hero; landmark + flag stroke fill the sky behind them.",
    portraitLikeness,
    "CRITICAL FINISH: one cohesive illustrated poster, with source facial geometry preserved. Only destination and TURESPAÑA text; no websites. No people or features copied from the style reference.",
  ].join(" ");
}

function setCors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
}

function fieldStr(fields, key) {
  const v = fields?.[key];
  if (Array.isArray(v)) return String(v[0] || "").trim();
  return String(v || "").trim();
}

async function openaiEdit({ apiKey, model, size, quality, prompt, fileBuffer, mimeType, filename, styleRefBuffer, costumeRefBuffer }) {
  const fd = new FormData();
  fd.append("model", model);
  fd.append("prompt", prompt);
  fd.append("size", size);
  fd.append("quality", quality);
  fd.append("n", "1");
  fd.append("image", new Blob([fileBuffer], { type: mimeType || "image/jpeg" }), filename || "input.jpg");
  if (styleRefBuffer) {
    fd.append("image", new Blob([styleRefBuffer], { type: "image/jpeg" }), "activation-style-ref.jpg");
  }

  fd.append("image", new Blob([costumeRefBuffer], {type:"image/jpeg"}), "destination-clothing-reference.jpg");
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), 280000);
  let openaiRes;
  try {
    openaiRes = await fetch(OPENAI_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}` },
      body: fd,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(t);
  }

  if (!openaiRes.ok) {
    const text = await openaiRes.text().catch(() => "");
    const err = new Error(`OpenAI HTTP ${openaiRes.status}: ${text.slice(0, 400)}`);
    err.status = openaiRes.status;
    throw err;
  }

  const data = await openaiRes.json();
  const item = data?.data?.[0];
  if (item?.b64_json) return Buffer.from(item.b64_json, "base64");
  if (item?.url) {
    const r = await fetch(item.url);
    return Buffer.from(await r.arrayBuffer());
  }
  throw new Error("No image data in OpenAI response");
}

async function geminiEdit({ apiKey, prompt, fileBuffer, mimeType, styleRefBuffer, costumeRefBuffer }) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(GEMINI_MODEL)}:generateContent`;
  const parts = [{ text: prompt }];
  parts.push({
    inlineData: {
      mimeType: mimeType || "image/jpeg",
      data: Buffer.from(fileBuffer).toString("base64"),
    },
  });
  if (styleRefBuffer) {
    parts.push({
      inlineData: {
        mimeType: "image/jpeg",
        data: Buffer.from(styleRefBuffer).toString("base64"),
      },
    });
  }
  parts.push({inlineData:{mimeType:"image/jpeg",data:Buffer.from(costumeRefBuffer).toString("base64")}});
  const body = {
    contents: [{ role: "user", parts }],
    generationConfig: { responseModalities: ["IMAGE"] },
  };

  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), 280000);
  let res;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(t);
  }

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    const err = new Error(`Gemini HTTP ${res.status}: ${text.slice(0, 400)}`);
    err.status = res.status;
    throw err;
  }

  const data = await res.json();
  const gparts = data?.candidates?.[0]?.content?.parts || [];
  for (const part of gparts) {
    const b64 = part.inlineData?.data || part.inline_data?.data;
    if (b64) return Buffer.from(b64, "base64");
  }
  const textParts = gparts.filter((p) => p.text).map((p) => p.text).join(" | ");
  throw new Error(`Gemini returned no image. ${textParts || "empty"}`.slice(0, 400));
}

export default async function handler(req, res) {
  setCors(res);
  if (req.method === "OPTIONS") { res.statusCode = 204; return res.end(); }
  if (req.method !== "POST") { res.statusCode = 405; return res.end("Method not allowed"); }

  const openaiKey = process.env.OPENAI_API_KEY;
  const geminiKey = process.env.GEMINI_API_KEY;
  if (!openaiKey && !geminiKey) {
    res.statusCode = 500;
    return res.end("Neither OPENAI_API_KEY nor GEMINI_API_KEY is configured");
  }

  const destinations = loadDestinations();
  const form = formidable({ multiples: false, maxFileSize: 25 * 1024 * 1024 });
  let fields, files;
  try {
    [fields, files] = await new Promise((resolve, reject) => {
      form.parse(req, (err, f, fl) => (err ? reject(err) : resolve([f, fl])));
    });
  } catch (e) {
    res.statusCode = 400;
    return res.end("Upload error: " + e.message);
  }

  const destinationId = fieldStr(fields, "destinationId") || fieldStr(fields, "destination");
  const dest = destinations.find((d) => d.id === destinationId);
  if (!dest) {
    res.statusCode = 400;
    return res.end("Unknown destinationId. Use canarias, barcelona, bilbao, madrid, andalucia, or valencia.");
  }

  const fileField = files?.image;
  const file = Array.isArray(fileField) ? fileField[0] : fileField;
  if (!file?.filepath) { res.statusCode = 400; return res.end("Missing image upload"); }

  let fileBuffer;
  try { fileBuffer = fs.readFileSync(file.filepath); }
  catch (e) { res.statusCode = 500; return res.end("Failed reading upload: " + e.message); }
  finally {
    try { fs.unlinkSync(file.filepath); } catch (_) {}
  }

  const prompt = buildPrompt(dest);
  const styleRefBuffer = loadStyleRef();
  const costumeRefBuffer=fs.readFileSync(path.join(process.cwd(),"assets","costume-reference.jpg"));
  const model = process.env.OPENAI_IMAGE_MODEL || "gpt-image-1";
  const size = process.env.OPENAI_IMAGE_SIZE || "1024x1536";
  const quality = "high";
  const mimeType = file.mimetype || "image/jpeg";

  let buf;
  let provider = "";
  const errors = [];

  if (openaiKey) {
    try {
      buf = await openaiEdit({
        apiKey: openaiKey,
        model,
        size,
        quality,
        prompt,
        fileBuffer,
        mimeType,
        filename: file.originalFilename || "input.jpg",
        styleRefBuffer,
        costumeRefBuffer,
      });
      provider = "openai";
    } catch (e) {
      errors.push(String(e.message || e));
      console.error("openai edit failed", e);
    }
  }

  if (!buf && geminiKey) {
    try {
      buf = await geminiEdit({
        apiKey: geminiKey,
        prompt,
        fileBuffer,
        mimeType,
        styleRefBuffer,
        costumeRefBuffer,
      });
      provider = "gemini";
    } catch (e) {
      errors.push(String(e.message || e));
      console.error("gemini edit failed", e);
    }
  }

  if (!buf) {
    res.statusCode = 502;
    res.setHeader("Content-Type", "application/json");
    return res.end(JSON.stringify({ error: "Image generation failed", detail: errors.join(" | ").slice(0, 800) }));
  }

  res.statusCode = 200;
  res.setHeader("Content-Type", "image/png");
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Turespana-Provider", provider);
  res.setHeader("X-Turespana-Destination", encodeURIComponent(dest.id));
  return res.end(buf);
};

export const config = {
  api: { bodyParser: false },
};
