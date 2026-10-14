import {portraitStyle, portraitLikeness} from './portrait-style.js';
import {outfitSelectionPrompt} from './portrait-outfit.js';

export const masterTransformationPrompt = `IDENTITY-PRESERVING SPANISH CULTURAL PHOTO

${portraitLikeness}

${portraitStyle}

FORWARD-FACING POSE: Every guest faces forward with an upright head and eyes looking directly into the camera, even if their source head or gaze is turned, lowered or in profile. Naturally align head, neck and shoulders. Reconstruct the frontal view from that guest's own features. Change pose and facial tension intentionally; preserve source facial geometry and natural mouth expression.

BODY AND GROUPS: Preserve head-to-body scale, neck, shoulder width, torso, limbs, natural build and relative heights. Fit the regional outfit to each guest's body, never paste a head onto a reference body or change physique to suit clothing. Use coherent anatomy. Prefer a closer portrait when source body details are missing. Natural upper-body, waist-up and three-quarter crops are welcome. Show each selected guest exactly once with a recognizable face.

Compose a real photographed Spanish destination with flattering daylight and natural depth. Clothing, accessories, framing and background are best-effort guidance, not acceptance requirements. Simplify them when needed to preserve recognizable faces and a smooth photographic finish.`;

export function culturalPortraitPrompt(dest,{guestCount=1,style=''}={}){
  return `Create one realistic iPhone-quality travel photograph from the supplied images.

${masterTransformationPrompt}

Image 1 is the actual guest camera photo and the ONLY source of people and identity.
Image 2 is ONE cropped regional example for ${dest.label}. Remove ALL reference people completely; use only their clothing, accessories and setting. Recreate these photographically even if an example is painted.
${outfitSelectionPrompt(style,guestCount)}
Each guest's independently selected outfit takes precedence over conflicting reference positions or details below. Both clothing families are reusable designs, not a requirement to include one of each.
REGIONAL CLOTHING DETAILS: ${dest.costumePrompt}
REGIONAL HAIR AND ACCESSORIES: ${dest.hairPrompt}
Preserve hair color and natural hairline where visible; keep eyes, nose, mouth and facial outline recognizable.
SETTING: ${dest.scenePrompt}
COMPOSITION: Guests do not need to be centered. Keep them mostly in frame; chest-up, waist-up or fuller crops are fine. Do not widen the photo only to show shoes or a complete outfit. Show useful clothing detail without sacrificing faces.
GUEST GROUP: Exactly ${guestCount} posed foreground guests from image 1, each once. Exclude background bystanders, reflections and people on screens. No invented companion.
OUTPUT: No text, no printed destination title, no TURESPAÑA lettering, no spain.info, no logos, no borders or blank margins. The kiosk adds approved branding after generation.
FINAL PRIORITY: Every guest faces forward and looks directly at the camera, with their own recognizable face, relaxed brows, a smooth forehead and rested, smooth under-eyes without bags or crow's feet. Preserve face structure and sharp features; smooth the skin instead of copying source wrinkles. Produce your best completed photograph with the available source.`;
}
