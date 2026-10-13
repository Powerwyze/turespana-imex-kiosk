export const masterTransformationPrompt = `IDENTITY IS THE HIGHEST PRIORITY.
Edit the supplied guest photograph by changing clothing and surroundings only. Treat each original face as protected photographic content, not a face to redesign. Preserve source facial geometry, eye shape and spacing, eyelids, eyebrows, nose, lips, cheeks, jawline, chin, ears, glasses, facial hair and distinctive marks. Preserve the source expression, mouth openness and smile. FRONT-FACING PORTRAIT: every guest faces the camera directly, with head upright and level, chin neutral and eyes looking into the lens. Gently correct a tilted or downward head angle without changing facial proportions or distinctive features. Do not invent a new smile. Keep the original apparent age, natural skin tone, skin texture, hairline and hair color. No beauty retouching, face slimming, wrinkle removal or addition, de-ageing, ageing, skin lightening, teeth replacement, invented smile, model-face substitution or facial reconstruction. A closed mouth stays closed. Do not improve attractiveness by changing the face.
The source face takes priority over every costume, pose, coiffure and composition instruction. Adapt the outfit and scene around the original head. Regional hair accessories may surround the head but must not alter its outline, hairline or facial proportions. Preserve natural body proportions and relative guest heights. Use clean high-resolution photographic detail: sharp eyes and facial edges, fine fabric detail, no film grain, sensor noise, speckling, crunchy sharpening or painterly texture. Preserve real skin texture and age; no beauty blur. Use crisp realistic photography, premium fabric detail, balanced natural daylight and a believable Spanish setting. Improve the scene lighting without repainting the face. Never borrow features from another person. When a face is unclear, do not invent a more detailed different face.`;

export function culturalPortraitPrompt(dest,{guestCount=1,style=''}={}){
 const s=String(style).toLowerCase();
 const dress=/\b(dress|skirt|gown|vestido|falda)\b/.test(s),trousers=/\b(trousers|pants|suit|pantalones)\b/.test(s);
 const outfit=dress&&!trousers?'Use the DRESS ensemble.':trousers&&!dress?'Use the TROUSER ensemble.':'Choose a coherent dress or trouser ensemble appropriate to each guest; honor their explicit preference.';
 const costume=dest.costumePrompt.replace(/Use the supplied [A-ZÁÍÉÓÚÑ ]+ clothing panel:/,'Regional garment design:');
 return `${masterTransformationPrompt}
Image 1 is the actual guest camera photo and the ONLY image input. No reference person is supplied. Preserve the original face rather than generating a lookalike.
REGION FOR THIS TRANSFORMATION: ${dest.label}
${outfit}
REGIONAL CLOTHING DETAILS: ${costume}
REGIONAL HAIR AND ACCESSORIES: ${dest.hairPrompt}
FACE PRIORITY: The facial features, expression and hairline remain unchanged even if regional styling must be adapted. Only adjust head orientation and gaze to face the camera straight on, with no downward tilt or sideways lean.
SETTING: ${dest.scenePrompt} Use bright balanced natural daylight and photographic depth, not poster styling.
COMPOSITION: A single edge-to-edge photograph, full-body or three-quarter. Extend the clothing and scene to show below the knees where feasible while preserving facial features and body proportions with upright camera-facing heads. Never deliver a headshot, chest-up or waist-up crop. Preserve coherent anatomy.
GUEST GROUP: Exactly ${guestCount} posed foreground guests from image 1, each once. Exclude background bystanders, reflections and people on screens. No invented companion.
OUTPUT: No text, no printed destination title, no TURESPAÑA lettering, no spain.info, no logos, no border, no blank margins, no poster or collage layout. The kiosk adds branding after verification.
FINAL CHECK: Exactly ${guestCount} guests; original facial features, expression, skin tone and apparent age unchanged; regional clothing and recognizable destination; realistic photography. Return only the photograph.`;
}
