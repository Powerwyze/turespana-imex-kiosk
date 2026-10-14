import {portraitStyle, portraitLikeness} from './portrait-style.js';
import {outfitSelectionPrompt} from './portrait-outfit.js';

export const masterTransformationPrompt = `IDENTITY-PRESERVING SPANISH CULTURAL PHOTO

IDENTITY IS THE HIGHEST PRIORITY. ${portraitLikeness}

${portraitStyle}

FORWARD-FACING POSE: Every guest faces the camera with their head upright, face shown front-on and eyes looking directly into the lens. Turn the head and naturally align the neck, shoulders and torso toward the camera even when the source person is looking sideways, down or away. Preserve each person's recognizable features and body proportions through this pose change. In group photos, apply this to every person separately. Off-center placement is fine; sideways faces and averted gazes are not the requested pose. This instruction takes precedence over preserving source pose or gaze and over poses in regional examples.

Hair: Apply the selected destination's traditional coiffure and required hair accessories while preserving the guest's hair color, facial geometry and natural hairline where visible. Keep faces recognizable. Do not copy a reference person's face.

Body and groups: Preserve the actual guest’s body from image 1, including head-to-body scale, neck length and width, shoulder width, torso length, chest, waist, hips, limb proportions, natural build and relative heights. Fit the costume to that body. Do not paste the guest’s head onto a reference model’s body, shrink the head, enlarge the head, narrow the shoulders, cinch the waist, add a bust or change the guest’s physique to fit a costume. Respect natural perspective and fabric volume. When the source body is cropped, preserve the visible proportions and use a natural continuation; prefer a closer portrait crop over inventing a dramatically different full body. Include every selected guest exactly once, with separate recognizable identities and coherent anatomy. Compose a comfortable portrait with each guest mostly in frame and their face recognizable. Off-center, upper-body, waist-up and three-quarter compositions are all welcome; show as much regional clothing as naturally fits.

Dress each guest in the authentic selected regional ensemble, with its distinguishing fabrics, embroidery, layers, accessories and natural folds, all rendered with natural photographic detail. Show the selected Spanish destination as a recognizable real setting with natural daylight and believable depth. Keep the guest's natural mouth expression while directing their face and eyes toward the camera. Return a single realistic photograph without lettering, logos or borders.`;

export function culturalPortraitPrompt(dest,{guestCount=1,style=''}={}){
  const outfit=outfitSelectionPrompt(style,guestCount);
  return `Transform the guest(s) from image 1 into a realistic iPhone-quality travel photograph wearing the regional clothing and standing in the setting of image 2.

${masterTransformationPrompt}

REGION FOR THIS TRANSFORMATION: ${dest.label}
Image 1 is the actual guest camera photo and the ONLY source of people and identity.
Preserve the person’s recognizable identity from image 1 while applying the requested beauty retouching. Remove wrinkles, crow’s feet and under-eye bags, including any already visible in the source. Smooth hands and arms and remove prominent veins. Do not add grey hair or change facial geometry. Use natural light and realistic shadows without distorting or obscuring the face.
Image 2 is ONE cropped regional example for ${dest.label}, not a collage. Remove ALL reference people completely; use only their clothing, accessories and setting.
${outfit}
The selected ensemble takes precedence over any conflicting dress or trouser details in the regional descriptions below.
REGIONAL CLOTHING DETAILS: ${dest.costumePrompt}
Reproduce the complete ensemble with its patterned skirt or trousers, bodice or waistcoat, shawl or jacket, sash and natural folds. Photograph the fabric and embroidery; do not simplify an ornate outfit into a plain top.
Hair and face: preserve source facial geometry, natural mouth expression and hair color, while applying the regional coiffure.
REGIONAL HAIR AND ACCESSORIES: ${dest.hairPrompt}
Choose the accessory rules for each guest's DRESS or TROUSER ensemble. Leave the eyes, nose, mouth and facial outline recognizable.
SETTING: Recreate the recognizable local environment from image 2 as a real photographed place with natural daylight and realistic color. Preserve recognizable landmarks and consistent photographic lighting for the background and guests.
COMPOSITION: One edge-to-edge REALISTIC PHOTOGRAPH. Guests do not need to be centered. Keep each guest mostly in frame with a recognizable face and a useful amount of their upper body visible. Natural off-center, chest-up, waist-up, three-quarter and full-length crops are all acceptable. Hands, feet, lower legs, small parts of hair or shoulders may fall outside the image. Do not force a wider crop or reposition a guest merely to show the complete outfit.
GUEST GROUP: Exactly ${guestCount} posed foreground guests from image 1, each once. Exclude background bystanders, reflections and people on screens. No invented companion from any reference.
OUTPUT: No text, no printed destination title, no TURESPAÑA lettering, no spain.info, no logos, no border, no blank margins, no poster or collage layout. The kiosk adds approved branding after generation.
FINAL PRIORITY: Every guest faces forward and looks directly at the camera. Keep each source face recognizable in the realistic iPhone-photo style, with smooth, evenly lit under-eyes, no bags or crow’s feet, and a fresh, rested finish. Preserve identity through facial structure, not source wrinkles or shadows. Apply this finish equally to every guest and never add adult age details to children. Clothing, accessories, framing and background are best-effort guidance, not acceptance requirements. Simplify those details when needed to preserve facial likeness and natural body proportions. Produce your best completed portrait with the available source photo. Return only the finished photograph.`;
}
