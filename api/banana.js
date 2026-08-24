/**
 * Turespaña · IMEX Las Vegas — destination costume portrait painter
 *
 * POST multipart/form-data:
 *   image          jpeg blob (required)
 *   destinationId  one of destination-1 … destination-6 (required)
 *
 * OpenAI Image Edit first; Gemini 2.5 Flash Image fallback.
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

function loadDestinations() {
  const p = path.join(process.cwd(), "public", "data", "destinations.json");
  const raw = JSON.parse(fs.readFileSync(p, "utf8"));
  return Array.isArray(raw.destinations) ? raw.destinations : [];
}

function buildPrompt(dest) {
  const label = dest?.label || "Destination";
  const costume = dest?.costumePrompt || `typical traditional costume associated with ${label}`;
  const scene = dest?.scenePrompt || "a painterly Spanish travel-poster landscape";

  return [
    "Reimagine EVERY person visible in the input photo as a premium Turespaña travel-poster portrait for an IMEX Las Vegas activation.",
    `DESTINATION SLOT: "${label}". This label may still be a placeholder (e.g. Destination 1). Do NOT invent or print an official Spanish region, city, or destination name on the image.`,
    "GROUP HANDLING (CRITICAL): Count the people in the input photo. If there is 1 person, render a solo hero portrait. If there are 2–5 people, render ALL of them together. HARD CAP: never render more than 5 people. If the input shows more than 5, pick the 5 most prominent/centered subjects only. Every rendered person must correspond to a real person in the input. Do not invent extra people.",
    "Render style: hyper-detailed editorial illustration with rich painterly brushwork — premium Spain tourism poster art. Photo-realistic faces are allowed only if they match the same cohesive illustrated treatment as bodies and background (NO photo-head-on-painted-body).",
    `WARDROBE (apply to EVERY person rendered): ${costume}. Tasteful, brand-safe, never sexualized. Preserve each person's gender presentation. Traditional costume should read clearly as Spanish regional dress without naming a real region in text.`,
    `SETTING: ${scene}. Warm Iberian light, travel-magazine composition.`,
    "Color palette inspired by Spain tourism brand colors (not a logo recreation): sun yellow, passion red, landscape green, and deep black, with warm stone and sky.",
    "Mood: joyful, welcoming, proud, cinematic, ready-to-travel.",
    "Composition: portrait 9:16 vertical. Solo: centered, upper body and head fully visible. Group: shoulder-to-shoulder, no cropped faces. Leave clean negative space in the lower portion for overlay text added separately.",
    "IDENTITY LOCK (CRITICAL): for each person rendered, keep that person's face shape, hair color and style, skin tone, ethnicity, age, gender presentation, and overall identity clearly recognizable. Do not swap, merge, or generify faces.",
    "NO TEXT in the painting itself — no logos, no destination names, no city names, no watermarks, no overlaid words. The Sol de Miró artwork is copyrighted: do NOT reproduce Joan Miró's sun logo or his lettering.",
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

async function openaiEdit({ apiKey, model, size, quality, prompt, fileBuffer, mimeType, filename }) {
  const fd = new FormData();
  fd.append("model", model);
  fd.append("prompt", prompt);
  fd.append("size", size);
  fd.append("quality", quality);
  fd.append("n", "1");
  fd.append("image", new Blob([fileBuffer], { type: mimeType || "image/jpeg" }), filename || "input.jpg");

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

async function geminiEdit({ apiKey, prompt, fileBuffer, mimeType }) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(GEMINI_MODEL)}:generateContent`;
  const body = {
    contents: [
      {
        role: "user",
        parts: [
          { text: prompt },
          {
            inlineData: {
              mimeType: mimeType || "image/jpeg",
              data: Buffer.from(fileBuffer).toString("base64"),
            },
          },
        ],
      },
    ],
    generationConfig: {
      responseModalities: ["IMAGE"],
    },
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
  const parts = data?.candidates?.[0]?.content?.parts || [];
  for (const part of parts) {
    const b64 = part.inlineData?.data || part.inline_data?.data;
    if (b64) return Buffer.from(b64, "base64");
  }
  const textParts = parts.filter((p) => p.text).map((p) => p.text).join(" | ");
  throw new Error(`Gemini returned no image. ${textParts || "empty"}`.slice(0, 400));
}

module.exports = async function handler(req, res) {
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
    return res.end("Unknown destinationId. Use destination-1 … destination-6 (or a renamed id in public/data/destinations.json).");
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
  const model = process.env.OPENAI_IMAGE_MODEL || "gpt-image-1";
  const size = process.env.OPENAI_IMAGE_SIZE || "1024x1536";
  const quality = process.env.OPENAI_IMAGE_QUALITY || "high";
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

module.exports.config = {
  api: { bodyParser: false },
};
