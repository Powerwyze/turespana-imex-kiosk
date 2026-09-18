import {readFile} from 'node:fs/promises';
import {portraitStyle,portraitLikeness} from '../lib/portrait-style.js';
import { verifySubjects } from '../lib/subject-check.js';

const destinations=JSON.parse(await readFile(new URL('../public/data/destinations.json',import.meta.url),'utf8')).destinations;
const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;

function bytesToBase64(bytes) {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

function jsonResponse(body, status) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}

export async function POST(req) {
  try {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) return jsonResponse({ error: 'OPENAI_API_KEY is not configured on the server.' }, 500);

    const fd = await req.formData();
    const file = fd.get('image');
    const destinationId=fd.get('destinationId');
    const dest=destinations.find(d=>d.id===destinationId);
    if(!dest || fd.getAll('destinationId').length!==1)return jsonResponse({code:'INVALID_DESTINATION',error:'Choose one of the six Spanish destinations.'},400);
    const style = (fd.get('style') || '').toString().trim().slice(0, 600);
    // Old cached kiosk pages omit this field: safely default to one guest.
    const countField = fd.get('guestCount') ?? '1';
    if (fd.getAll('guestCount').length > 1 || typeof countField !== 'string' || !/^[123]$/.test(countField)) {
      return jsonResponse({ code: 'INVALID_GUEST_COUNT', error: 'Choose 1, 2, or 3 people.' }, 400);
    }
    const guestCount = Number(countField);
    // One total deadline covers reference, generation, and the verification gate.
    const signal = AbortSignal.any([req.signal, AbortSignal.timeout(175000)]);

    if (!file || typeof file.arrayBuffer !== 'function') {
      return jsonResponse({ error: 'Missing image.' }, 400);
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      return jsonResponse({ error: 'Image is too large.' }, 413);
    }

    const mimeType = file.type || 'image/jpeg';
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(mimeType) || !file.size) {
      return jsonResponse({ error: 'Please take a new photo.' }, 400);
    }
    const b64 = bytesToBase64(new Uint8Array(await file.arrayBuffer()));

    // Client-supplied style reference stays in the server bundle, not the public gallery.
    const referenceB64=(await readFile(process.cwd()+'/assets/portrait-style-reference.jpg')).toString('base64');
    const costumeB64=(await readFile(process.cwd()+'/assets/costume-reference.jpg')).toString('base64');
    const prompt = `Edit the supplied camera photo into one portrait-oriented illustrated commercial tourism poster for Turespaña, celebrating ${dest.label}.
INPUT ROLES: Image 1 is the actual guest camera photo and the ONLY source of people and identity. Image 2 is ONLY a rendering-style reference, never a source of facial features, bodies or identity. Remove ALL reference people completely, including their bodies, faces, uniforms and props. Do not copy reference text, brand logos or baseball imagery.
CLOTHING REFERENCE: Image 3 is a six-panel wardrobe reference ONLY. Use the ${dest.referencePanel} panel labelled ${dest.label}. Copy garment shapes, textile colours, embroidery and layering only. Ignore the reference models’ faces, bodies, skin, hair, poses and photorealistic finish. Do not add any of those people to the portrait. Image 1 remains the ONLY identity source and Image 2 remains the rendering-style reference. Translate the selected clothing into that same illustrated style.
MANDATORY: Exactly ${guestCount} real foreground guest(s), each once. Select the nearest clearly posing ${guestCount} guest(s) from Image 1. Preserve each guest's recognizable face, skin tone, hair and identity. Exclude background bystanders, people on screens, reflections, and extra or duplicated people. Never invent anyone to satisfy the count.
${portraitLikeness}
DESTINATION COSTUME: ${dest.costumePrompt}
DESTINATION SCENE: ${dest.scenePrompt}
STYLE: ${portraitStyle} Dramatic golden-hour lighting and painted clothing. A Spanish red-yellow-red painted flag stroke across the sky. The ONLY permitted text is the destination name ${dest.label} at the top and TURESPAÑA directly below it. No website address, URL, spain.info, footer text, button or watermark anywhere. Do not imitate protected logo artwork. No Flow lettering or lounge; no caricature distortion of faces. Portrait composition, guests as heroes, faces fully visible.
ANATOMY: Simple coherent anatomy, at most two arms and two hands per person, relaxed poses with hands below the crop when possible.
${style ? 'Optional visual request, subordinate to the destination, identity, count and brand rules: '+style : ''}
FINAL CHECK: Exactly ${guestCount} selected foreground guests from Image 1, no reference people or other people anywhere. Destination is ${dest.label}. No inventing or cloning guests. Preserve source facial geometry before applying any illustration style. No spain.info or other website text anywhere, even if present in either input image or requested in the optional style. Return one finished image.`;

    const payload = {
      model: process.env.OPENAI_IMAGE_MODEL || 'gpt-image-2',
      images: [
        { image_url: `data:${mimeType};base64,${b64}` },
        { image_url: `data:image/jpeg;base64,${referenceB64}` },
        { image_url: `data:image/jpeg;base64,${costumeB64}` },
      ],
      prompt,
      size: process.env.OPENAI_IMAGE_SIZE || '1024x1536',
      // Prioritize detailed source-preserving edits over the old fast/low-quality mode.
      // GPT Image 2 already processes inputs at high fidelity; input_fidelity is unsupported.
      quality: 'high',
      output_format: 'jpeg',
      n: 1,
    };

    const response = await fetch('https://api.openai.com/v1/images/edits', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
      signal,
    });

    const data = await response.json();
    if (!response.ok) {
      console.error('OpenAI image edit failed', { status: response.status });
      return jsonResponse({ error: 'Image generation failed. Please try again.' }, response.status);
    }

    const outputB64 = data?.data?.[0]?.b64_json;
    if (!outputB64) return jsonResponse({ error: 'No image returned from GPT Image 2.' }, 502);

    let approved;
    try {
      approved = await verifySubjects({
        apiKey, guestCount, signal,
        sourceUrl: `data:${mimeType};base64,${b64}`,
        outputUrl: `data:image/jpeg;base64,${outputB64}`,
      });
    } catch {
      // Never leak rejected/unverified bytes to the browser or email flow.
      console.warn('Turespana subject check unavailable');
      return jsonResponse({ code: 'SUBJECT_CHECK_UNAVAILABLE', error: 'We could not check the people in this picture. Your original photo is saved for retry.' }, 503);
    }
    if (!approved) {
      return jsonResponse({
        code: 'SUBJECT_COUNT_MISMATCH',
        error: 'The picture did not pass the guest check. Confirm the number of people, then try again or retake with your group closer.',
      }, 422);
    }

    const outputBinary = atob(outputB64);
    const outputBytes = new Uint8Array(outputBinary.length);
    for (let i = 0; i < outputBinary.length; i++) outputBytes[i] = outputBinary.charCodeAt(i);

    return new Response(outputBytes, {
      status: 200,
      headers: { 'Content-Type': 'image/jpeg', 'Cache-Control': 'no-store' },
    });
  } catch (error) {
    console.error('Unexpected image generation error', { name: error?.name });
    return jsonResponse({ error: 'Unexpected image generation error.' }, 500);
  }
}
