/* ================================================================
 *  Turespaña · IMEX Las Vegas — portrait kiosk
 *  Flow: pick 1 of 6 destinations → camera → newsletter email →
 *        AI costume poster → email + optional QR
 * ================================================================ */

const $  = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

const I18N = {
  en: {
    rotateTitle: "Please rotate to portrait",
    rotateSub: "This experience is designed for a 1080×1920 portrait kiosk.",
    heroTitle: "Pick a destination. Wear Spain.",
    heroLede: "Choose Andalucía, Madrid, Cataluña, País Vasco, Galicia, or Valencia. We’ll dress you for that destination and email your poster.",
    back: "← Destinations",
    hudPortrait: "PORTRAIT · 9:16",
    ctaTakePhoto: "Take My Photo",
    stepDest: "Pick",
    stepPhoto: "Photo",
    stepEmail: "Email",
    stepPortrait: "Portrait",
    footerEvent: "Turespaña · IMEX Las Vegas · Oct 13–15 2026",
    footerPowered: "Powered by <strong>PowerWyze</strong>",
    genPill: "Creating your poster · ~60s",
    emailTitle: "Get your portrait + newsletter",
    emailSub: "We’ll email your costume portrait and add you to the Turespaña newsletter.",
    emailNameLabel: "Name",
    emailEmailLabel: "Email",
    emailNamePh: "Your name",
    emailConsent: "Yes, send me Turespaña newsletters.",
    emailContinue: "Continue",
    emailErrName: "Please enter your name.",
    emailErrEmail: "Please enter a valid email.",
    emailErrConsent: "Newsletter opt-in is required to continue.",
    waitTitle: "Creating your Spain poster…",
    waitSub: "Hyper-real Spain poster · ~60 seconds",
    resTitle: "Your Spain poster is ready",
    resStatus: "Sent to your email",
    resSentTo: "✓ Sent to {email}",
    resSendFail: "Couldn't email {email}",
    resQr: "Scan to save on your phone",
    resCta: "Discover more at <strong>spain.info</strong>",
    resHint: "Tap anywhere to dismiss · auto-closes in <span id=\"resModalTimer\">20</span>s",
    chosen: "Costume · {label}",
  },
  es: {
    rotateTitle: "Gira a vertical",
    rotateSub: "Esta experiencia está diseñada para un kiosco vertical 1080×1920.",
    heroTitle: "Elige un destino. Ponte España.",
    heroLede: "Elige Andalucía, Madrid, Cataluña, País Vasco, Galicia o Valencia. Te vestimos para ese destino y te enviamos el cartel.",
    back: "← Destinos",
    hudPortrait: "VERTICAL · 9:16",
    ctaTakePhoto: "Toma mi foto",
    stepDest: "Elige",
    stepPhoto: "Foto",
    stepEmail: "Correo",
    stepPortrait: "Retrato",
    footerEvent: "Turespaña · IMEX Las Vegas · 13–15 oct 2026",
    footerPowered: "Hecho por <strong>PowerWyze</strong>",
    genPill: "Creando tu cartel · ~60s",
    emailTitle: "Retrato + boletín",
    emailSub: "Te enviamos el retrato y te apuntamos al boletín de Turespaña.",
    emailNameLabel: "Nombre",
    emailEmailLabel: "Correo",
    emailNamePh: "Tu nombre",
    emailConsent: "Sí, quiero el boletín de Turespaña.",
    emailContinue: "Continuar",
    emailErrName: "Pon tu nombre.",
    emailErrEmail: "Correo inválido.",
    emailErrConsent: "El boletín es necesario para continuar.",
    waitTitle: "Creando tu cartel de España…",
    waitSub: "Cartel hiperreal de España · ~60 segundos",
    resTitle: "Tu cartel de España está listo",
    resStatus: "Enviado a tu correo",
    resSentTo: "✓ Enviado a {email}",
    resSendFail: "No se pudo enviar a {email}",
    resQr: "Escanea para guardar en el móvil",
    resCta: "Descubre más en <strong>spain.info</strong>",
    resHint: "Toca para cerrar · se cierra en <span id=\"resModalTimer\">20</span>s",
    chosen: "Traje · {label}",
  },
};

const i18n = (() => {
  let current = (() => {
    try { return localStorage.getItem("turespana_lang") || "en"; } catch (_) { return "en"; }
  })();
  const listeners = new Set();

  function t(key) {
    const dict = I18N[current] || I18N.en;
    return Object.prototype.hasOwnProperty.call(dict, key) ? dict[key] : (I18N.en[key] || key);
  }
  function applyToDOM() {
    document.documentElement.setAttribute("lang", current);
    document.documentElement.setAttribute("data-lang", current);
    document.querySelectorAll("[data-i18n]").forEach((el) => {
      const key = el.getAttribute("data-i18n");
      if (!key) return;
      const val = t(key);
      if (el.getAttribute("data-i18n-html") === "true") el.innerHTML = val;
      else el.textContent = val;
    });
    document.querySelectorAll("[data-i18n-attr-placeholder]").forEach((el) => {
      el.setAttribute("placeholder", t(el.getAttribute("data-i18n-attr-placeholder")));
    });
    document.querySelectorAll("[data-lang-set]").forEach((btn) => {
      const isActive = btn.getAttribute("data-lang-set") === current;
      btn.classList.toggle("is-active", isActive);
      btn.setAttribute("aria-pressed", isActive ? "true" : "false");
    });
  }
  function set(lang) {
    if (lang !== "en" && lang !== "es") return;
    if (current === lang) return;
    current = lang;
    try { localStorage.setItem("turespana_lang", current); } catch (_) {}
    applyToDOM();
    listeners.forEach((fn) => { try { fn(current); } catch (_) {} });
  }
  function get() { return current; }
  function onChange(fn) { listeners.add(fn); return () => listeners.delete(fn); }
  function init() {
    applyToDOM();
    document.querySelectorAll("[data-lang-set]").forEach((btn) => {
      btn.addEventListener("click", () => set(btn.getAttribute("data-lang-set")));
    });
  }
  return { t, set, get, onChange, init };
})();

(function lockKiosk() {
  document.addEventListener("contextmenu", (e) => e.preventDefault(), { capture: true });
  const blockKeys = new Set(["t", "n", "w", "r", "p", "s", "u", "j", "h", "l", "o", "f"]);
  document.addEventListener("keydown", (e) => {
    const k = (e.key || "").toLowerCase();
    if ((e.ctrlKey || e.metaKey) && blockKeys.has(k)) { e.preventDefault(); e.stopPropagation(); }
    if (e.key === "F11" || e.key === "F5") e.preventDefault();
  }, { capture: true });
  document.addEventListener("dragstart", (e) => e.preventDefault());
  document.addEventListener("selectstart", (e) => {
    if (!e.target.closest("input, textarea, [contenteditable]")) e.preventDefault();
  });
  try { window.open = () => null; } catch (_) {}
  ["gesturestart", "gesturechange", "gestureend"].forEach((ev) =>
    document.addEventListener(ev, (e) => e.preventDefault())
  );
})();

const toaster = $("#toaster");
function toast(msg, { duration = 6000, kind = "info" } = {}) {
  if (!toaster) return;
  const el = document.createElement("div");
  el.className = `toast toast--${kind}`;
  el.innerHTML = msg;
  toaster.appendChild(el);
  requestAnimationFrame(() => el.classList.add("is-in"));
  setTimeout(() => {
    el.classList.remove("is-in");
    el.classList.add("is-out");
    setTimeout(() => el.remove(), 400);
  }, duration);
}
function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]));
}

let DESTINATIONS = [];
let selectedDest = null;

function destLabel(d) {
  if (!d) return "";
  return i18n.get() === "es" ? (d.labelEs || d.label) : d.label;
}

function renderDestGrid() {
  const grid = $("#destGrid");
  if (!grid) return;
  grid.innerHTML = "";
  DESTINATIONS.forEach((d, idx) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "dest-tile";
    btn.style.setProperty("--tile-accent", d.accent || "#FFEA00");
    btn.setAttribute("role", "listitem");
    const note = i18n.get() === "es" ? (d.tileNoteEs || d.tileNote) : d.tileNote;
    btn.innerHTML = `
      <span class="dest-tile__num">0${idx + 1}</span>
      <span class="dest-tile__label">${escapeHtml(destLabel(d))}</span>
      ${note ? `<span class="dest-tile__note">${escapeHtml(note)}</span>` : ""}
    `;
    btn.addEventListener("click", () => selectDestination(d));
    grid.appendChild(btn);
  });
}

function showScreen(id) {
  $$(".screen").forEach((el) => {
    const on = el.id === id;
    if (!on && el.contains(document.activeElement)) {
      try { document.activeElement.blur(); } catch (_) {}
    }
    el.classList.toggle("is-active", on);
    el.hidden = !on;
    el.setAttribute("aria-hidden", on ? "false" : "true");
  });
}

function selectDestination(d) {
  selectedDest = d;
  $$(".dest-tile").forEach((el) => el.classList.remove("is-selected"));
  const chip = $("#chosenChip");
  if (chip) chip.textContent = i18n.t("chosen").replace("{label}", destLabel(d));
  showScreen("screenBooth");
  booth.start();
}

i18n.onChange(() => {
  renderDestGrid();
  if (selectedDest) {
    const chip = $("#chosenChip");
    if (chip) chip.textContent = i18n.t("chosen").replace("{label}", destLabel(selectedDest));
  }
});

const emailModal = (() => {
  const modal = $("#emailModal");
  const nameInput = $("#nameModalInput");
  const emailInput = $("#emailModalInput");
  const consent = $("#newsletterCheck");
  const errEl = $("#emailModalErr");
  const okBtn = $("#emailModalOk");
  let resolver = null;
  const isValidEmail = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);

  function open() {
    return new Promise((res) => {
      resolver = res;
      nameInput.value = "";
      emailInput.value = "";
      if (consent) consent.checked = true;
      errEl.textContent = "";
      modal.classList.add("is-open");
      modal.setAttribute("aria-hidden", "false");
      setTimeout(() => nameInput.focus(), 30);
    });
  }
  function close(value) {
    modal.classList.remove("is-open");
    modal.setAttribute("aria-hidden", "true");
    const r = resolver; resolver = null;
    r && r(value);
  }
  okBtn.addEventListener("click", () => {
    const name = (nameInput.value || "").trim();
    const email = (emailInput.value || "").trim();
    if (!name) { errEl.textContent = i18n.t("emailErrName"); nameInput.focus(); return; }
    if (!isValidEmail(email)) { errEl.textContent = i18n.t("emailErrEmail"); emailInput.focus(); return; }
    if (consent && !consent.checked) { errEl.textContent = i18n.t("emailErrConsent"); return; }
    close({ name, email, newsletter: true });
  });
  [nameInput, emailInput].forEach((inp) => {
    inp.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        if (inp === nameInput) emailInput.focus();
        else okBtn.click();
      }
    });
  });
  return { open };
})();

const waitModal = (() => {
  const modal = $("#waitModal");
  let isOpen = false;
  function show() {
    if (isOpen) return;
    isOpen = true;
    modal.classList.add("is-open");
    modal.setAttribute("aria-hidden", "false");
  }
  function hide() {
    if (!isOpen) return;
    isOpen = false;
    modal.classList.remove("is-open");
    modal.setAttribute("aria-hidden", "true");
  }
  return { show, hide };
})();

function renderQr(url) {
  const wrap = $("#resQrWrap");
  const el = $("#resQr");
  if (!wrap || !el) return;
  el.innerHTML = "";
  if (!url || typeof window.qrcode !== "function") {
    wrap.hidden = true;
    return;
  }
  try {
    const qr = window.qrcode(0, "M");
    qr.addData(url);
    qr.make();
    el.innerHTML = qr.createSvgTag({ cellSize: 8, margin: 2, scalable: true });
    const svgEl = el.querySelector("svg");
    if (svgEl) {
      svgEl.setAttribute("width", "100%");
      svgEl.setAttribute("height", "100%");
      svgEl.querySelectorAll("rect").forEach((r, i) => {
        if (i === 0) r.setAttribute("fill", "#FFF8E7");
        else r.setAttribute("fill", "#1B161C");
      });
    }
    wrap.hidden = false;
  } catch (e) {
    wrap.hidden = true;
  }
}

const booth = (() => {
  const cam = $("#boothCam");
  const canvas = $("#boothCanvas");
  const captureBtn = $("#boothCapture");
  const countdown = $("#boothCountdown");
  const flashEl = $("#boothFlash");
  const genPill = $("#genPill");
  const resModal = $("#resModal");
  const resModalImg = $("#resModalImg");
  const resModalStatus = $("#resModalStatus");
  const RESULT_HOLD_MS = 20000;
  let resAutoCloseTimer = null;
  let resCountdownTimer = null;
  const boothQueueEl = $("#boothQueue");
  const jobs = new Map();
  let nextJobId = 1;
  const errEl = $("#boothErr");
  let stream = null, facing = "user";

  function showGenPill(on) {
    if (!genPill) return;
    genPill.classList.toggle("is-active", !!on);
    genPill.setAttribute("aria-hidden", on ? "false" : "true");
  }
  function renderQueue() {
    if (!boothQueueEl) return;
    const inflight = Array.from(jobs.values()).filter((j) =>
      j.status === "generating" || j.status === "sending"
    ).length;
    if (inflight === 0) {
      boothQueueEl.style.display = "none";
      boothQueueEl.textContent = "";
    } else {
      boothQueueEl.textContent = inflight === 1
        ? "✦ Creating your poster…"
        : `✦ ${inflight} posters in progress…`;
      boothQueueEl.style.display = "inline-flex";
    }
    showGenPill(inflight > 0);
  }
  const showErr = (m) => { errEl.textContent = m; errEl.style.display = "block"; };
  const clearErr = () => { errEl.textContent = ""; errEl.style.display = "none"; };
  const safeName = (e) => e.trim().toLowerCase().replace(/[^a-z0-9@._-]/g, "_").replace(/@/g, "_at_");

  async function stopCam() {
    if (stream) { stream.getTracks().forEach((t) => t.stop()); stream = null; }
  }
  function videoReady(timeoutMs = 600) {
    return new Promise((res) => {
      const t0 = Date.now();
      const tick = () => {
        if (cam.videoWidth > 0 && cam.videoHeight > 0) return res(true);
        if (Date.now() - t0 > timeoutMs) return res(false);
        requestAnimationFrame(tick);
      };
      tick();
    });
  }
  async function start() {
    try {
      clearErr();
      await stopCam();
      const altFacing = facing === "user" ? "environment" : "user";
      const tries = [
        { video: true, audio: false },
        { video: { facingMode: facing }, audio: false },
        { video: { facingMode: altFacing }, audio: false },
      ];
      let booted = false, lastErr;
      for (const c of tries) {
        try {
          stream = await navigator.mediaDevices.getUserMedia(c);
          cam.srcObject = stream;
          cam.muted = true;
          cam.setAttribute("playsinline", "");
          cam.play().catch(() => {});
          const ok = await videoReady(600);
          if (ok) {
            booted = true;
            if (c.video && c.video.facingMode) facing = c.video.facingMode;
            break;
          }
          await stopCam();
        } catch (e) { lastErr = e; }
      }
      if (!booted) throw lastErr || new Error("Unable to access camera");
    } catch (e) {
      showErr(`Camera unavailable. ${e.message ? "(" + e.message + ")" : ""} Tap to try again.`);
    }
  }

  async function runCountdown(seconds = 5) {
    countdown.style.display = "flex";
    for (let i = seconds; i >= 1; i--) {
      countdown.textContent = i;
      await new Promise((r) => setTimeout(r, 1000));
    }
    countdown.textContent = "☀";
    await new Promise((r) => setTimeout(r, 240));
    countdown.style.display = "none";
  }
  function flash() {
    flashEl.classList.add("on");
    setTimeout(() => flashEl.classList.remove("on"), 170);
  }
  function captureFrame() {
    return new Promise((resolve, reject) => {
      if (!cam.videoWidth || !cam.videoHeight) return reject(new Error("Camera is not ready yet."));
      canvas.width = cam.videoWidth;
      canvas.height = cam.videoHeight;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(cam, 0, 0, canvas.width, canvas.height);
      canvas.toBlob((blob) => {
        if (!blob) return reject(new Error("Capture failed."));
        resolve(blob);
      }, "image/jpeg", 0.95);
    });
  }

  async function watermark(blob, dest) {
    const img = await createImageBitmap(blob);
    const c = document.createElement("canvas");
    c.width = img.width;
    c.height = img.height;
    const ctx = c.getContext("2d");
    ctx.drawImage(img, 0, 0);
    const W = c.width, H = c.height;
    const scale = W / 1024;
    const pad = 28 * scale;
    const veilH = 220 * scale;
    const grad = ctx.createLinearGradient(0, H - veilH, 0, H);
    grad.addColorStop(0, "rgba(0,0,0,0)");
    grad.addColorStop(1, "rgba(27,22,28,0.72)");
    ctx.fillStyle = grad;
    ctx.fillRect(0, H - veilH, W, veilH);

    ctx.save();
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
    ctx.shadowColor = "rgba(0,0,0,0.55)";
    ctx.shadowBlur = 8 * scale;
    ctx.fillStyle = "#FFEA00";
    ctx.font = `700 ${Math.round(28 * scale)}px Oswald, sans-serif`;
    ctx.fillText("TURESPAÑA", pad, H - pad - 52 * scale);
    ctx.fillStyle = "#FFFFFF";
    ctx.font = `600 ${Math.round(42 * scale)}px Fraunces, Georgia, serif`;
    ctx.fillText(destLabel(dest) || "Spain", pad, H - pad - 14 * scale);
    ctx.fillStyle = "#C8C0A8";
    ctx.font = `500 ${Math.round(20 * scale)}px Inter, sans-serif`;
        ctx.fillText("spain.info  ·  IMEX Las Vegas  ·  Oct 13–15 2026", pad, H - pad + 10 * scale);
    ctx.restore();
    return new Promise((res) => c.toBlob((b) => res(b), "image/jpeg", 0.95));
  }

  async function compress(blob) {
    const img = await createImageBitmap(blob);
    const c = document.createElement("canvas");
    const ctx = c.getContext("2d");
    const max = 1024;
    const s = Math.min(1, max / Math.max(img.width, img.height));
    c.width = Math.max(1, Math.round(img.width * s));
    c.height = Math.max(1, Math.round(img.height * s));
    ctx.drawImage(img, 0, 0, c.width, c.height);
    const toBlob = (q) => new Promise((r) => c.toBlob(r, "image/jpeg", q));
    const b64FromBlob = async (b) => {
      const arr = await b.arrayBuffer();
      let bin = ""; const bytes = new Uint8Array(arr);
      for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
      return btoa(bin);
    };
    let q = 0.85, o = await toBlob(q), b64 = await b64FromBlob(o);
    while (b64.length > 240000 && q > 0.4) { q -= 0.1; o = await toBlob(q); b64 = await b64FromBlob(o); }
    return { b64, mimeType: "image/jpeg" };
  }

  async function startGeneration(job) {
    job.status = "generating";
    renderQueue();
    try {
      const fd = new FormData();
      fd.append("image", job.blob, `job-${job.id}.jpg`);
      fd.append("destinationId", job.dest.id);
      const r = await fetch("/api/banana", { method: "POST", body: fd });
      if (!r.ok) {
        const ctype = r.headers.get("content-type") || "";
        let msg = `HTTP ${r.status}`;
        if (ctype.includes("application/json")) {
          try { const j = await r.json(); msg = j.error || j.detail || msg; } catch (_) {}
        } else if (r.status === 504 || r.status === 408) msg = "Painting took too long.";
        else if (r.status >= 500) msg = "Painting service is busy.";
        throw new Error(msg);
      }
      const rawBlob = await r.blob();
      let generatedBlob;
      try { generatedBlob = await watermark(rawBlob, job.dest); }
      catch (_) { generatedBlob = rawBlob; }
      job.generatedBlob = generatedBlob;
      job.status = "ready";
    } catch (e) {
      job.status = "error";
      job.error = e.message;
      toast(`Couldn't paint portrait: ${escapeHtml(e.message)}`, { kind: "error", duration: 8000 });
    }
    renderQueue();
    if (job.onReady) job.onReady();
  }

  async function sendEmail(job, name, email) {
    job.status = "sending";
    renderQueue();
    try {
      const { b64, mimeType } = await compress(job.generatedBlob);
      const r = await fetch("/api/send-photo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          email,
          destinationId: job.dest.id,
          destinationLabel: destLabel(job.dest),
          filename: safeName(email) + "-turespana-portrait.jpg",
          mimeType: mimeType || "image/jpeg",
          imageBase64: b64,
        }),
      });
      if (!r.ok) throw new Error(await r.text() || `HTTP ${r.status}`);
      toast(`✦ <strong>Sent!</strong><br><span class="toast__sub">${escapeHtml(email)}</span>`, { kind: "success", duration: 6000 });
      return { sent: true, b64, mimeType };
    } catch (e) {
      toast(`Couldn't email ${escapeHtml(email)}: ${escapeHtml(e.message)}`, { kind: "error", duration: 9000 });
      const { b64, mimeType } = await compress(job.generatedBlob).catch(() => ({ b64: null, mimeType: "image/jpeg" }));
      return { sent: false, b64, mimeType };
    } finally {
      job.status = "done";
      renderQueue();
    }
  }

  async function storeLead(job, creds, imageBase64, mimeType) {
    try {
      const r = await fetch("/api/lead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: creds.name,
          email: creds.email,
          destinationId: job.dest.id,
          destinationLabel: destLabel(job.dest),
          newsletter: true,
          imageBase64,
          mimeType,
        }),
      });
      if (!r.ok) return null;
      return await r.json();
    } catch (_) {
      return null;
    }
  }

  function clearResTimers() {
    if (resAutoCloseTimer) { clearTimeout(resAutoCloseTimer); resAutoCloseTimer = null; }
    if (resCountdownTimer) { clearInterval(resCountdownTimer); resCountdownTimer = null; }
  }
  function resetToDestinations() {
    closeResModal();
    selectedDest = null;
    showScreen("screenDest");
    stopCam();
  }
  function closeResModal() {
    resModal.classList.remove("is-open");
    resModal.setAttribute("aria-hidden", "true");
    clearResTimers();
  }
  function showResult({ blob, email, sent, claimUrl }) {
    resModalImg.src = URL.createObjectURL(blob);
    if (sent) {
      resModalStatus.textContent = i18n.t("resSentTo").replace("{email}", email);
      resModalStatus.classList.remove("is-error");
    } else {
      resModalStatus.textContent = i18n.t("resSendFail").replace("{email}", email || "");
      resModalStatus.classList.add("is-error");
    }
    renderQr(claimUrl);

    let secs = Math.ceil(RESULT_HOLD_MS / 1000);
    const timerEl = () => document.querySelector("#resModalTimer");
    if (timerEl()) timerEl().textContent = String(secs);
    resCountdownTimer = setInterval(() => {
      secs -= 1;
      if (secs <= 0) { clearInterval(resCountdownTimer); resCountdownTimer = null; return; }
      if (timerEl()) timerEl().textContent = String(secs);
    }, 1000);

    resModal.classList.add("is-open");
    resModal.setAttribute("aria-hidden", "false");
    resAutoCloseTimer = setTimeout(resetToDestinations, RESULT_HOLD_MS);
  }

  let captureLock = false;
  async function captureFlow() {
    if (captureLock) return;
    if (!selectedDest) return;
    captureLock = true;
    clearErr();
    try {
      await runCountdown(5);
      flash();
      const blob = await captureFrame();
      const id = nextJobId++;
      const job = { id, blob, dest: selectedDest, status: "queued", generatedBlob: null, onReady: null };
      jobs.set(id, job);
      startGeneration(job);

      const creds = await emailModal.open();
      if (!creds) {
        await waitForJob(job);
        if (job.generatedBlob) showResult({ blob: job.generatedBlob, email: "", sent: false });
        jobs.delete(id);
        return;
      }

      const stillGenerating = job.status !== "ready" && job.status !== "error";
      if (stillGenerating) waitModal.show();
      try { await waitForJob(job); }
      finally { waitModal.hide(); }

      if (!job.generatedBlob) {
        toast("Portrait painting failed. Please try again.", { kind: "error", duration: 7000 });
        jobs.delete(id);
        return;
      }

      const mail = await sendEmail(job, creds.name, creds.email);
      const lead = await storeLead(job, creds, mail.b64, mail.mimeType);
      const claimUrl = lead?.photoId
        ? `${window.location.origin}/claim?id=${encodeURIComponent(lead.photoId)}`
        : (lead?.publicUrl || null);
      showResult({ blob: job.generatedBlob, email: creds.email, sent: mail.sent, claimUrl });
      jobs.delete(id);
    } catch (e) {
      showErr(e.message || "Capture failed.");
    } finally {
      captureLock = false;
    }
  }

  function waitForJob(job) {
    return new Promise((resolve) => {
      if (job.status === "ready" || job.status === "error") return resolve();
      job.onReady = () => resolve();
    });
  }

  captureBtn.addEventListener("click", captureFlow);
  resModal.addEventListener("click", () => resetToDestinations());
  $("#boothBack")?.addEventListener("click", () => {
    selectedDest = null;
    showScreen("screenDest");
    stopCam();
  });

  return { start, stop: stopCam };
})();

async function boot() {
  i18n.init();
  try {
    const r = await fetch("/data/destinations.json", { cache: "no-store" });
    const json = await r.json();
    DESTINATIONS = Array.isArray(json.destinations) ? json.destinations : [];
  } catch (e) {
    DESTINATIONS = [
      { id: "andalucia", label: "Andalucía", labelEs: "Andalucía", tileNote: "Feria & flamenco", accent: "#E42719" },
      { id: "madrid", label: "Madrid", labelEs: "Madrid", tileNote: "Capital chic", accent: "#FFEA00" },
      { id: "cataluna", label: "Cataluña", labelEs: "Cataluña", tileNote: "Mediterráneo", accent: "#7CB165" },
      { id: "pais-vasco", label: "País Vasco", labelEs: "País Vasco", tileNote: "Costa vasca", accent: "#1B161C" },
      { id: "galicia", label: "Galicia", labelEs: "Galicia", tileNote: "Atlantic green", accent: "#7CB165" },
      { id: "valencia", label: "Valencia", labelEs: "Valencia", tileNote: "Fallas & light", accent: "#C45C26" },
    ];
  }
  renderDestGrid();
  showScreen("screenDest");

  (function attachOSKWhenReady(tries) {
    if (window.OSK && typeof window.OSK.attach === "function") {
      window.OSK.attach({
        targets: ["#nameModalInput", "#emailModalInput"],
        lang: i18n.get(),
        onSubmit: () => document.getElementById("emailModalOk")?.click(),
      });
      i18n.onChange(() => window.OSK.setLang && window.OSK.setLang(i18n.get()));
      return;
    }
    if (tries > 0) setTimeout(() => attachOSKWhenReady(tries - 1), 80);
  })(40);
}

if (document.readyState !== "loading") boot();
else window.addEventListener("DOMContentLoaded", boot);
window.addEventListener("pagehide", () => booth.stop());
