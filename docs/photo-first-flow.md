# Photo-first kiosk flow

The homepage opens a live camera preview (subject to browser camera permission), with Take a picture and Talk to Lola. Capture runs a seven-second countdown, then saves the source locally. No generation request starts until the visitor chooses one, two or three people and a destination. Selecting a destination starts one render from the saved source and opens the existing contact form. Lola speaks during generation; confirmation and email delivery are unchanged.

Tap-to-start voice visitors hear Lola introduce the photo, then the camera countdown starts. Camera-sentry visitors are invited and must agree before capture. The host resumes after capture to ask group size, then destination. Retake clears both choices; Retry reuses the captured source and choices. Reset or cancellation invalidates pending work and clears private photo state. Camera permission denial keeps a visible preview panel with an instruction to allow access and retry.
