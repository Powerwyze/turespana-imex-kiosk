# Photo-first kiosk reliability

The live route uses `public/index.html` and `public/host.js`; `host.html` is kept identical. The authoritative sequence is: live viewfinder → seven-second capture → one/two/three/four people → destination → generation with contact entry → confirmed reveal and delivery. A provider error retains the captured source for an explicit retry.

## Capture and voice

`requestCapture` in `host.js` is the shared entry for the viewfinder button, local spoken readiness, delegated voice tools, and peace sign. It guards an in-progress capture, retained photo, session lifetime, email delivery, and explicit retake intent. `host-readiness.js` waits for a stable utterance before accepting an affirmative and immediately honors negative/wait phrases. Clear people counts and offered destination names are accepted locally only on their matching screens. Late delegated actions return the current state instead of starting duplicate work.

`HostVoiceSync` preserves actual audio/transcript activity across screen changes, so a quiet screen opens speech immediately. For active old speech it correlates the current state acknowledgment with transcript audio timestamps: a fresh utterance or recognized current-screen narration becomes audible without waiting for the entire response to finish. Explicit old-screen questions remain suppressed. A short pending cue is discarded when Lola already supplies the correct narration, avoiding duplicate questions. The countdown enforces muted host speech. It does not send undocumented cancellation events to the Live API. Sentry sessions allow a full reply window after the greeting, speech, and gesture loading; automatic host output is not visitor activity.

Peace recognition starts with the home camera, independent of the voice connection. Its gate tolerates brief missing samples and slower inference. Worker failures receive two delayed recovery attempts per armed visit, then leave the button and voice paths available. Leaving the capture-ready screen stops recognition.

## Captions and portraits

`HostCaptions` stays in one top bar for every phase. The stage starts below its reserved height, keeping the viewfinder, contact forms, keyboards and touch controls clear of the transcript. Both areas follow the visible viewport when a native keyboard opens. It displays complete two-line pages; streamed speech advances pages, recorded narration uses its decoded duration, and browser synthesis uses speech boundary events. Recorded timing is approximate, not word-level alignment.

The photographic generation remains one medium-quality image request with facial identity first and no aesthetic rejection loop. See `portrait-rendering.md` for the bounded local face-finishing worker. Finishing happens before branding; the same finished image is displayed and supplied to email delivery. Failed finishing returns the generated image.

## Verification

- `npm test`: state, request, caption paging, readiness/negation, duplicate action, gesture recovery, speech transition, retouch timeout/cancellation, consent and email tests.
- `node tests/kiosk-flow.e2e.mjs`: real browser UI/camera/countdown and local finishing, with voice transport, gesture inference, generation and email services intercepted. Exercises early/late contact confirmation, retries, resets and responsive layouts without sending email.
- `node tests/portrait-retouch-browser.mjs`: actual local face detector and pixel finishing, including no-face fallback. No image API request.
- `TURESPANA_HOST_PREVIEW_URL=... node tests/host-live.e2e.mjs`: optional real voice service test; image and email endpoints remain intercepted.
- `TURESPANA_HOST_PREVIEW_URL=... node tests/host-image-live.mjs`: optional single real generation followed by actual local finishing and branding; never sends email.

Browser logs identify action type/source/phase only. Do not log microphone transcripts, names, email addresses or portrait bytes. The automated browser cannot establish microphone sensitivity, room noise or camera visibility on the physical event kiosk; those remain hardware-specific checks.
