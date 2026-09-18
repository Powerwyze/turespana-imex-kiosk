# Illustrated portraits and source preservation

The camera image is first and the only source of people. The client-supplied commercial poster is second and supplies rendering style only. Explicit appearance constraints preserve facial geometry, expression, hair and distinctive details; costume rules cannot override them. Reference people and branding are excluded. The finish is deliberately illustrated, with painted shadows and clean contours, rather than the former photorealistic/beauty-retouch instructions.

Both portrait routes request high output quality. The voice camera requests 1920×1080 where supported, retains native dimensions and encodes at JPEG 0.96. These are ideal constraints, so lower-resolution cameras still work. Detector and greeting thumbnails remain small.

No promise of exact likeness: generative edits can still drift. This change improves source-preservation instructions and input detail; it does not add biometric identity verification. Existing count/foreground checks remain. No automatic paid regeneration.

API reference checked: https://developers.openai.com/api/docs/guides/image-prompting . GPT Image 2 processes input images at high fidelity by default; do not send unsupported input_fidelity.
