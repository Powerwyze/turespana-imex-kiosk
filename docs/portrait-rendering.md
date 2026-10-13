# Regional oil portraits and generation-time speech

The generator uses the supplied Velázquez reference, the regional clothing reference and the guest camera photo. The guest source controls identity and natural body proportions. Shared outfit rules select trousers for shirt/jacket/trouser or ambiguous source clothing, and a dress ensemble for a clear source dress/skirt or explicit single-guest choice. Unassigned voice preferences never apply to an entire group.

Guests can be off-center with natural chest-up or waist-up crops. Fine costume, accessory and art-style differences do not cause rejection. One independent check compares only the source and result, retaining guest count, recognizable likeness, correct outfit category, body proportions, visibility and basic usability. Its legacy `photographic` flag measures usability, not exact painting style. Visual checks cannot guarantee perfect results.

## Fast interactive path

Rendering uses medium quality at 1024×1536 with the existing image model. Each request makes one image render and one compact verification request within a shared 90-second deadline. It never automatically regenerates a failed portrait; a guest can choose Retry. Responses and logs expose non-sensitive generation and verification timings.

## Lola during generation

Voice sessions receive an explicit instruction that countdown silence is over and Lola should speak. The touch flow preloads a fixed destination clip before capture and plays it as generation begins without opening a microphone session. The six English clips use the same Marin voice as Lola, cached in the function and CDN. If a clip is slow or unavailable, browser speech is used where supported. Playback never blocks image generation, and pending or playing speech stops on completion, failure, reset or navigation. Browsers that block audio expose the existing Tap to hear your host button.
