import {portraitStyle, portraitLikeness} from './portrait-style.js';

export const masterTransformationPrompt = `IDENTITY-PRESERVING SPANISH CULTURAL OIL PORTRAIT

IDENTITY IS THE HIGHEST PRIORITY. ${portraitLikeness}

${portraitStyle}

Hair: Apply the selected destination's traditional coiffure and required hair accessories while preserving the guest's hair color, facial geometry and natural hairline where visible. Keep faces recognizable. Do not copy a reference person's face.

Body and groups: Preserve natural body type, proportions and relative heights. Include every selected guest exactly once, with separate recognizable identities and coherent anatomy. Frame a full-body or three-quarter portrait so the regional outfit is clearly visible.

Dress each guest in the authentic selected regional ensemble, with its distinguishing fabrics, embroidery, layers, accessories and natural folds, all rendered in oils. Paint the selected Spanish destination as a recognizable setting with atmospheric depth and warm, controlled light. Keep the guest's source expression. Return a single coherent painting without lettering, logos or borders.`;

export function culturalPortraitPrompt(dest,{guestCount=1,style=''}={}){
  // Client styling can choose an ensemble, never override the server's painting style.
  const s=String(style).toLowerCase();
  const dress=/\b(dress|skirt|gown|vestido|falda)\b/.test(s);
  const trousers=/\b(trousers|pants|suit|pantalones)\b/.test(s);
  const outfit=dress&&!trousers?'Use the DRESS ensemble from image 2 for the guest(s) who requested it.':trousers&&!dress?'Use the TROUSER ensemble from image 2 for the guest(s) who requested it.':'Choose the reference dress or trouser ensemble that fits each guest’s presentation; keep one coherent outfit per person.';
  return `Transform the guest(s) from image 1 into a Velázquez-inspired Spanish Baroque oil painting wearing the regional clothing and standing in the setting of image 2.

${masterTransformationPrompt}

REGION FOR THIS TRANSFORMATION: ${dest.label}
Image 1 is the actual guest camera photo and the ONLY source of people and identity.
APPARENT AGE IS LOCKED TO IMAGE 1. Do not add wrinkles, grey hair or age details absent from the source; preserve age details already present. Use warm light and painterly shadows without distorting or obscuring the face.
Image 2 is ONE cropped regional example for ${dest.label}, not a collage. Remove ALL reference people completely; use only their clothing, accessories and setting.
Image 3 is the user-supplied Velázquez painting style reference. Use only the artwork's oil-paint technique, brushwork, lighting and palette. Ignore the phone screenshot interface, captions and margins. Do not copy the sitter's face, papal robes, hat, chair, age or expression.
${outfit}
REGIONAL CLOTHING DETAILS: ${dest.costumePrompt}
Reproduce the complete ensemble with its patterned skirt or trousers, bodice or waistcoat, shawl or jacket, sash and natural folds. Paint the fabric and embroidery; do not simplify an ornate outfit into a plain top.
Hair and face: preserve source facial geometry, expression and hair color, while applying the regional coiffure.
REGIONAL HAIR AND ACCESSORIES: ${dest.hairPrompt}
Choose the accessory rules for each guest's DRESS or TROUSER ensemble. Leave the eyes, nose, mouth and facial outline recognizable.
SETTING: Paint the recognizable local environment from image 2 with atmospheric depth, warm directional light and rich earth tones. Preserve recognizable landmarks; paint the background and guests consistently in the same oils.
COMPOSITION: One edge-to-edge OIL PAINTING. Show every guest from the top of their hair to BELOW THE KNEES, or full length, with the waist and substantial skirt/trouser length visible. Never deliver a headshot, chest-up or waist-up crop.
GUEST GROUP: Exactly ${guestCount} posed foreground guests from image 1, each once. Exclude background bystanders, reflections and people on screens. No invented companion from any reference.
OUTPUT: No text, no printed destination title, no TURESPAÑA lettering, no spain.info, no logos, no border, no blank margins, no poster or collage layout. The kiosk adds approved branding after verification.
FINAL CHECK: Exactly ${guestCount} guests, each once; recognizable source faces, correct regional coiffures and accessories, coherent anatomy, complete outfits shown below the knees, visible oil-paint brushwork and Velázquez-inspired lighting. Return only the finished painting.`;
}
