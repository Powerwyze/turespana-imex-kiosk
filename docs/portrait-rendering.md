# Regional photographic portraits and generation-time speech

The generator uses the regional clothing reference and the guest camera photo. Output is a realistic iPhone-style travel photograph with natural skin detail, daylight and color. The former painting reference is no longer sent to the image model. Regional references guide clothing and location only, even when those examples are painted. The guest source controls identity and natural body proportions. Shared outfit rules select trousers for shirt/jacket/trouser or ambiguous source clothing, and a dress ensemble for a clear source dress/skirt or explicit single-guest choice. Unassigned voice preferences never apply to an entire group.

Guests can be off-center with natural chest-up or waist-up crops. Face likeness is the highest prompt priority; clothing, accessories, framing and background are best-effort guidance. Every completed render is returned directly, without a separate quality or subject-count classifier, rejection gate, or automatic regeneration. Provider failures and missing image data still return a retryable error rather than pretending a portrait was created.

## Fast interactive path

Rendering uses medium quality at 1024×1536 with the existing image model. Each request makes one image render within a 90-second deadline. No verification API call delays delivery. Responses and logs expose non-sensitive generation timings; the compatibility verification timing is zero.

## Local face finishing

The v19 prompt gives recognizable facial geometry, a relaxed forehead, smooth under-eyes and forward gaze priority over clothing detail. The server still returns the generated image directly. Before branding/display/email, the voice kiosk now runs `portrait-retouch.js`: a separate browser worker detects up to four faces and blends smoothing only into feathered forehead/upper-cheek/under-eye skin masks. It gently reduces under-eye shadows. Eyes, eyebrows, nose, lips, facial hair and isolated dark beauty marks are protected; no facial coordinates or body proportions are warped. This is actual pixel processing, rather than another instruction to the image model.

`preloadPortraitRetouch()` loads in parallel with generation. `retouchPortrait(blob,{signal})` has a 2.5-second limit including any outstanding model load. Missing/failed face detection, unsupported browser features, loading failure or timeout returns the generated photo. Cancellation rejects with the caller's abort reason, and job IDs/worker epochs prevent old results from affecting later guests. A photo is never rejected or regenerated for cosmetic reasons. The branding step uses the finished bytes, so displayed and emailed photos share the same finish.

The model is the pinned MediaPipe Face Landmarker float16 version 1, downloaded from `https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task`, served locally as `/assets/face-landmarker.task`. SHA-256: `64184e229b263107bc2b804c6625db1341ff2bb731874b0bcc2fe6544e0bc9ff`. It reuses the existing locally hosted MediaPipe vision bundle/WASM. Face images and landmarks remain in the browser during finishing; no second image API request is made.

The filter reduces skin texture/creases, not underlying facial geometry. Deep folded brows must first be relaxed by generation; natural eyelid contours remain. Small/obscured faces may be skipped. Performance must be measured on the kiosk hardware: development Chromium checks took approximately 0.34 seconds for one generated face and 0.45 seconds for three faces after preloading. These are local measurements, not a device-independent guarantee.

`node tests/portrait-retouch-browser.mjs` starts a temporary local static server and exercises the actual model/filter on one face, three- and four-face canvas fixtures and a blank scene; it makes no paid API calls. It saves before/after evidence in `artifacts/`. The committed `tests/fixtures/portrait-face.jpg` is MediaPipe's public test portrait from `https://storage.googleapis.com/mediapipe-assets/portrait.jpg` (SHA-256 `a6f11efaa834706db23f275b6115058fa87fc7f14362681e6abe14e82749de3e`), not a visitor photo. `PORTRAIT_RETOUCH_TEST_URL`, `PORTRAIT_TEST_SOURCE`, and `PORTRAIT_TEST_OUTPUT` can select another reviewed deployment, local image, and artifact directory.

## Lola during generation

Voice sessions receive an explicit instruction that countdown silence is over and Lola should speak. The touch flow preloads a fixed destination clip before capture and plays it as generation begins without opening a microphone session. The six English clips use the same Marin voice as Lola, cached in the function and CDN. If a clip is slow or unavailable, browser speech is used where supported. Playback never blocks image generation, and pending or playing speech stops on completion, failure, reset or navigation. Browsers that block audio expose the existing Tap to hear your host button.
