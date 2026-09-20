# Regional photograph pipeline v2
Both image routes use lib/portrait-pipeline.js: original full-resolution guest capture + ONE cropped destination reference. Region references are extracted remotely from the supplied sheet by scripts/prepare-region-references.py.

The user master prompt is retained. The region module asks for detailed complete outfits, below-knee framing, original face/hair and bright photographic surroundings. No generated poster layout. Only explicit wardrobe/accessory choices can modify the fixed photographic task. Result controls occupy their own screen area.

Model: GPT Image 2.5 Flare, xhigh, 1024x1536. OPENAI_API_KEY is required. No provider fallback or environment model override. An independent three-image quality gate checks count, visible face/hair consistency, outfit match, framing, photographic appearance and no poster layout. This is probabilistic visual checking, not a biometric identity guarantee.

No rejected bytes reach the browser/email. No automatic paid retry. Original source remains session-only for visitor-requested retry; reset/end/inactivity clears it. Requests retain a 175-second budget, no-store and approved Sites CORS. X-Portrait-Pipeline and X-Image-Model identify the active route.
