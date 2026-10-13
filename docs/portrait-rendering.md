# Velázquez-inspired regional oil portraits

New guest portraits use the supplied Portrait of Pope Innocent X reference for Spanish Baroque oil-paint technique, visible brushwork, warm light, deep shadows and crimson/ochre/ivory tones. The screenshot UI and the sitter's identity, age, clothing and pose are explicitly excluded.

Image 1 supplies guest identity, image 2 supplies the selected regional clothing and destination, and image 3 supplies painting style. Both voice and classic generators use the shared prompt. Regional coiffures, costume details and three-quarter or full-body framing remain required.

The independent checker accepts painterly interpretation while retaining subject-count, likeness, age, wardrobe, hairstyle and framing checks. Its legacy `photographic` field now measures the oil-paint style, and correction retries reinforce that same style. The reference is included in both Vercel image functions.

The homepage examples remain the existing previews. Generative constraints and visual consistency checks cannot guarantee exact likeness.

## Relaxed acceptance

Guests may be off-center, with natural chest-up or waist-up crops. Their faces and a useful portion of their upper bodies should remain visible; full-body or below-knee framing is optional. The host no longer asks guests to center themselves. Costume, accessory and layout observations are advisory. The legacy `photographic` check measures basic usability only, never exact brushwork or resemblance to the reference style. Subject count, recognizable likeness and basic visibility remain required.

## Outfit choice and body proportions

Generation and verification share the same outfit selection rules. Source shirts, jackets, suits, shorts and trousers map to the regional trouser ensemble; clearly visible dresses or skirts map to the dress ensemble. Ambiguous clothing defaults to trousers. Explicit single-guest choices override this; unassigned group requests do not change everyone. No gender inference is used. Negated dress requests never select a dress.

Two required checks now protect outfit choice and source body proportions. Wrong dress/trouser assignment, borrowed reference-model bodies and obvious head/body, shoulder, waist or build distortions trigger correction from the original source and are withheld if correction fails. Small costume differences and relaxed off-center cropping remain accepted. These are generative constraints and visual checks, not an absolute guarantee against errors.

## Interactive generation latency

The kiosk uses high image quality at 1024×1536 instead of extra-high, preserving the image model and all likeness, outfit-choice and body-proportion checks. It makes at most two image attempts (one correction) within a shared 180-second deadline; a correction starts only within the first 90 seconds. Failed portraits are still withheld. Successful responses include aggregate generation, verification and total Server-Timing durations, and each attempt logs non-sensitive timings for latency diagnosis.
