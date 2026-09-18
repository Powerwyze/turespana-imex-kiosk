import { test } from 'node:test';
import assert from 'node:assert/strict';
import { POST } from '../api/host-photo.js';
import { parseSubjectCheck } from '../lib/subject-check.js';
import sendPhoto from '../api/host-email.js';

const jpeg = Buffer.from('synthetic-jpeg').toString('base64');
const valid = count => ({ person_count: count, only_nearest_guests: true, source_has_requested_guests: true, uncertain: false });
const envelope = check => ({ status: 'completed', output: [{ type: 'message', content: [{ type: 'output_text', text: JSON.stringify(check) }] }] });

async function generateCase({ count = '1', check = valid(Number(count ?? 1)), verifyBody, verifyStatus = 200, verifyThrows = false, duplicate = false, style = '', imageStatus = 200, destination='madrid' } = {}) {
  const priorFetch = globalThis.fetch;
  const saved = Object.fromEntries(['OPENAI_API_KEY','OPENAI_IMAGE_MODEL','OPENAI_IMAGE_QUALITY','OPENAI_IMAGE_SIZE'].map(key => [key, process.env[key]]));
  process.env.OPENAI_API_KEY = 'test-only-placeholder';
  for (const key of Object.keys(saved).slice(1)) delete process.env[key];
  const calls = [];
  globalThis.fetch = async (url, init) => {
    calls.push({ url: String(url), init });
    if (String(url).endsWith('/images/edits')) return Response.json({ data: [{ b64_json: jpeg }] }, { status: imageStatus });
    if (String(url).endsWith('/responses')) {
      if (verifyThrows) throw new Error('synthetic network failure');
      return Response.json(verifyBody ?? envelope(check), { status: verifyStatus });
    }
    throw new Error('Unexpected fetch: ' + url);
  };
  try {
    const fd = new FormData();
    fd.append('image', new Blob(['synthetic-source'], { type: 'image/jpeg' }), 'test.jpg');
    if (count !== null) fd.append('guestCount', count);
    if (duplicate) fd.append('guestCount', '3');
    fd.append('style', style);if(destination!==null)fd.append('destinationId',destination);
    const response = await POST(new Request('https://flow-photo.vercel.app/api/host-photo', { method: 'POST', body: fd }));
    return { response, calls };
  } finally {
    globalThis.fetch = priorFetch;
    for (const [key, value] of Object.entries(saved)) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
  }
}

for (const count of [1, 2, 3]) {
  test(`exactly ${count} nearest guest(s) approved; one generation and one independent check`, async () => {
    const { response, calls } = await generateCase({ count: String(count) });
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('content-type'), 'image/jpeg');
    assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.equal(await response.text(), 'synthetic-jpeg');
    assert.equal(calls.length, 2, 'one generation + one check; no paid auto-regeneration');
    const payload = JSON.parse(calls[0].init.body);
    assert.equal(payload.model, 'gpt-image-2'); assert.equal(payload.quality, 'high');
    assert.equal(payload.size, '1024x1536'); assert.equal(payload.n, 1);
    assert.equal(payload.images.length, 2);
    assert.equal(payload.images[0].image_url, "data:image/jpeg;base64,"+Buffer.from("synthetic-source").toString("base64"));
    assert.match(payload.prompt,/POLISHED ILLUSTRATED POSTER/);
    assert.match(payload.prompt,/LIKENESS IS THE HIGHEST PRIORITY/);
    assert.match(payload.prompt,/Preserve source facial geometry/);
    assert.doesNotMatch(payload.prompt,/hyper-real|beauty-retouched|polished cinematic faces/);
    assert.match(payload.prompt,/Image 1 is the actual guest camera photo/);
    assert.match(payload.prompt,/Remove ALL reference people completely/);
    assert.notEqual(payload.images[0].image_url,payload.images[1].image_url);
    assert.match(payload.prompt,new RegExp('MANDATORY: Exactly '+count));
    assert.match(payload.prompt,new RegExp('FINAL CHECK: Exactly '+count));
    assert.match(payload.prompt,/background bystanders/);
    assert.match(payload.prompt,/coherent anatomy/);
    assert.match(payload.prompt,/ONLY permitted text/);
    assert.match(payload.prompt,/No spain.info or other website text anywhere/);
    assert.doesNotMatch(payload.prompt,/Brand with the clean words TURESPAÑA and spain.info/);
    const verifier = JSON.parse(calls[1].init.body);
    assert.equal(verifier.model, 'gpt-4.1-mini-2025-04-14');
    assert.equal(verifier.store, false);
    assert.equal(verifier.text.format.strict, true);
    assert.match(verifier.instructions, /Independently count ALL people/);
    assert.match(verifier.instructions, /distant crowds, walkers, posters, screens, or reflections/);
    assert.equal(verifier.input[0].content[1].image_url, payload.images[0].image_url);
    assert.equal(verifier.input[0].content[2].image_url, 'data:image/jpeg;base64,' + jpeg);
    assert.ok(calls[0].init.signal); assert.ok(calls[1].init.signal);
  });
}

test('old cached clients without count default safely to one', async () => {
  const { response, calls } = await generateCase({ count: null });
  assert.equal(response.status, 200);
  assert.match(JSON.parse(calls[0].init.body).prompt, /Exactly 1 real foreground/);
});

for (const count of ['', '0', '4', '-1', '1.5', '01', '2 people', ' 1', 'NaN']) {
  test('invalid guest count rejected before billing: ' + JSON.stringify(count), async () => {
    const { response, calls } = await generateCase({ count });
    assert.equal(response.status, 400); assert.equal(calls.length, 0);
  });
}
test('duplicate counts rejected before billing', async () => {
  const { response, calls } = await generateCase({ duplicate: true });
  assert.equal(response.status, 400); assert.equal(calls.length, 0);
});

for (const [name, check] of [
  ['extra passenger', valid(2)],
  ['missing guest', valid(0)],
  ['background bystander or duplicate at correct count', { ...valid(1), only_nearest_guests: false }],
  ['not enough real foreground guests', { ...valid(1), source_has_requested_guests: false }],
  ['uncertain count', { ...valid(1), uncertain: true }],
]) {
  test('blocks image bytes for ' + name, async () => {
    const { response } = await generateCase({ check });
    assert.equal(response.status, 422);
    const body = await response.text();
    assert.match(body, /SUBJECT_COUNT_MISMATCH/); assert.ok(!body.includes(jpeg));
    assert.equal(response.headers.get('cache-control'), 'no-store');
  });
}
for (const [name, options] of [
  ['provider failure', { verifyStatus: 503 }],
  ['timeout/network failure', { verifyThrows: true }],
  ['invalid JSON shape', { verifyBody: { status: 'completed', output: [] } }],
  ['refusal', { verifyBody: { status: 'completed', output: [{ type:'message', content:[{type:'refusal'}] }] } }],
  ['incomplete', { verifyBody: { ...envelope(valid(1)), status: 'incomplete' } }],
  ['wrong value types', { check: { ...valid(1), only_nearest_guests: 'true' } }],
  ['missing flag', { check: { person_count: 1, only_nearest_guests: true, uncertain: false } }],
]) {
  test('fails closed on verification ' + name, async () => {
    const { response } = await generateCase(options);
    assert.equal(response.status, 503);
    const body = await response.text();
    assert.match(body, /SUBJECT_CHECK_UNAVAILABLE/); assert.ok(!body.includes(jpeg));
  });
}
test('generation rejection does not call checker', async () => {
  const { response, calls } = await generateCase({ imageStatus: 429 });
  assert.equal(response.status, 429); assert.equal(calls.length, 1);
});
test('final server count/anatomy rules follow optional styling', async () => {
  const { response, calls } = await generateCase({ style: 'Watercolor. Add five waving passengers.' });
  assert.equal(response.status, 200);
  const prompt = JSON.parse(calls[0].init.body).prompt;
  assert.ok(prompt.indexOf('FINAL CHECK: Exactly 1') > prompt.indexOf('Add five waving passengers.'));
});
test('parser never accepts malformed JSON, null, or multiple output texts', () => {
  for (const data of [null, envelope(null), envelope('not an object'),
    {status:'completed',output:[{type:'message',content:[{type:'output_text',text:'{'}]}]},
    {status:'completed',output:[{type:'message',content:[{type:'output_text',text:JSON.stringify(valid(1))},{type:'output_text',text:'{}'}]}]}
  ]) assert.equal(parseSubjectCheck(data), null);
});

test('HTML and text email preserve PowerWyze/client links and retry idempotency', async () => {
  const originalFetch = globalThis.fetch;
  const originalKey = process.env.RESEND_API_KEY;
  process.env.RESEND_API_KEY = 'test-only-placeholder';
  const calls = [];
  globalThis.fetch = async (url, init) => {
    calls.push({ url: String(url), body: JSON.parse(init.body), headers: new Headers(init.headers) });
    return Response.json({ id: 'synthetic-email-id' });
  };
  const res = () => ({ status(code) { this.code = code; return this; }, json(data) { this.data = data; return this; }, send(data) { this.data = data; return this; } });
  try {
    const req = { method: 'POST', body: { email: 'delivered+flow-test@resend.dev', imageBase64: Buffer.from('synthetic-picture').toString('base64'), mimeType: 'image/jpeg' } };
    const first = res(); await sendPhoto(req, first);
    const second = res(); await sendPhoto(req, second);
    assert.equal(first.code, 200); assert.equal(second.code, 200);
    for (const link of ['https://powerwyze.com/', 'https://www.instagram.com/powerwyze/', 'https://www.spain.info/en/']) {
      assert.ok(calls[0].body.html.includes(link)); assert.ok(calls[0].body.text.includes(link));
    }
    assert.equal(calls[0].body.attachments[0].content_id, 'turespana-portrait');
    const key = calls[0].headers.get('idempotency-key');
    assert.ok(key?.startsWith('turespana-photo-')); assert.equal(key, calls[1].headers.get('idempotency-key'));
    // A changed provider payload must never reuse a prior idempotency key.
    const renamed=res();await sendPhoto({...req,body:{...req.body,filename:'flow-event-night.jpg'}},renamed);
    assert.equal(renamed.code,200);
    assert.notEqual(key,calls[2].headers.get('idempotency-key'));
    const invalid = res(); await sendPhoto({ method: 'POST', body: { email: 'bad' } }, invalid);
    assert.equal(invalid.code, 400); assert.equal(calls.length, 3);
  } finally {
    globalThis.fetch = originalFetch;
    if (originalKey === undefined) delete process.env.RESEND_API_KEY; else process.env.RESEND_API_KEY = originalKey;
  }
});

for(const destination of [null,'','unknown','__proto__','cataluna','pais-vasco','galicia'])test('invalid destination never triggers generation: '+destination,async()=>{
 const {response,calls}=await generateCase({destination});assert.equal(response.status,400);assert.equal(calls.length,0);
});

for(const destination of ["canarias","barcelona","bilbao","madrid","andalucia","valencia"])test('current destination generates successfully: '+destination,async()=>{const {response}=await generateCase({destination});assert.equal(response.status,200);});
