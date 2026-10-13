// Shared by generation and verification; never choose clothing from inferred gender.
export function outfitSelectionPrompt(style='',guestCount=1){
  const request=String(style).toLowerCase().replace(/[’]/g,"'");
  const clauses=request.split(/[.!?;\n]|\bbut\b|\bpero\b/);
  const choices=new Set();
  for(const clause of clauses){
    // A negated request must never become positive just because it names a garment.
    if(/\b(no|not|never|without|avoid|don't|do not|sin|nunca)\b/.test(clause))continue;
    if(/\b(dress|skirt|gown|vestido|falda)\b/.test(clause))choices.add('DRESS');
    if(/\b(trousers|pants|suit|pantalones)\b/.test(clause))choices.add('TROUSER');
  }
  const singleChoice=choices.size===1?[...choices][0]:null;
  const explicit=guestCount===1&&singleChoice?`EXPLICIT OUTFIT CHOICE: Use the ${singleChoice} ensemble from image 2 for this guest.`:'';
  return `OUTFIT SELECTION: ${explicit}
For each guest without an unambiguous explicit choice, follow their visible source clothing: a shirt, T-shirt, jacket, suit, shorts or trousers uses the regional TROUSER ensemble; a clearly visible dress or skirt uses the regional DRESS ensemble. If clothing is cropped, ambiguous or uninformative, default to the TROUSER ensemble. Never put a shirt-and-trouser guest into a dress just because the regional reference features one. Do not infer gender identity or use facial hair, facial features or body shape to choose an outfit. Explicit choice overrides source clothing only for the guest who made it. In groups, choose separately for each person from their source clothing; do not apply an unassigned voice preference to the whole group.
Use only the matching ensemble's hair accessories. A TROUSER ensemble must not acquire the dress ensemble's bodice, skirt, veil, flowers or coiffure. Adapt the regional outfit to the guest; never copy the reference model's body or pose.`;
}
