# Regional oil portraits and generation-time speech

The generator uses the supplied Velázquez reference, the regional clothing reference and the guest camera photo. The guest source controls identity and natural body proportions. Shared outfit rules select trousers for shirt/jacket/trouser or ambiguous source clothing, and a dress ensemble for a clear source dress/skirt or explicit single-guest choice. Unassigned voice preferences never apply to an entire group.

Guests can be off-center with natural chest-up or waist-up crops. Face likeness is the highest prompt priority; clothing, accessories, framing and background are best-effort guidance. Every completed render is returned directly, without a separate quality or subject-count classifier, rejection gate, or automatic regeneration. Provider failures and missing image data still return a retryable error rather than pretending a portrait was created.

## Fast interactive path

Rendering uses medium quality at 1024×1536 with the existing image model. Each request makes one image render within a 90-second deadline. No verification API call delays delivery. Responses and logs expose non-sensitive generation timings; the compatibility verification timing is zero.

## Lola during generation

Voice sessions receive an explicit instruction that countdown silence is over and Lola should speak. The touch flow preloads a fixed destination clip before capture and plays it as generation begins without opening a microphone session. The six English clips use the same Marin voice as Lola, cached in the function and CDN. If a clip is slow or unavailable, browser speech is used where supported. Playback never blocks image generation, and pending or playing speech stops on completion, failure, reset or navigation. Browsers that block audio expose the existing Tap to hear your host button.
