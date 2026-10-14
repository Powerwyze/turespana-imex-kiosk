// Match each guest's visible presentation independently; reference couples are not a template for the group.
export function outfitSelectionPrompt(style='',guestCount=1){
  const request=String(style).toLowerCase().replace(/[’]/g,"'");
  const clauses=request.split(/[,\.!?;\n]|\bbut\b|\bpero\b/);
  const choices=new Set(),avoided=new Set();
  for(const clause of clauses){
    // Keep a declined garment out of the explicit choice, even in mixed clauses.
    const target=/\b(no|not|never|without|avoid|don't|do not|sin|nunca)\b/.test(clause)?avoided:choices;
    if(/\b(dress|dresses|skirt|skirts|gown|vestido|vestidos|falda|faldas)\b/.test(clause))target.add('DRESS');
    if(/\b(trousers|pants|suit|pantalones)\b/.test(clause))target.add('TROUSER');
  }
  const available=[...choices].filter(choice=>!avoided.has(choice));
  const singleChoice=available.length===1?available[0]:choices.size===0&&avoided.size===1?(avoided.has('DRESS')?'TROUSER':'DRESS'):null;
  const explicit=guestCount===1&&singleChoice?`EXPLICIT OUTFIT CHOICE: Use the ${singleChoice} ensemble from image 2 for this guest.`:'';
  return `OUTFIT SELECTION: ${explicit}
PERSON-BY-PERSON WARDROBE: Match each guest separately to their own visible presentation in image 1. Preserve feminine presentation with the women's regional DRESS ensemble and masculine presentation with the men's regional TROUSER ensemble, unless that guest explicitly requests another garment. A woman's everyday shirt, T-shirt, blazer, jeans or trousers must NOT automatically select the men's outfit. A request for trousers changes the garment, not the person's presentation: adapt the tailoring and accessories appropriately. Do not claim or change anyone's gender identity. When presentation is genuinely unclear, keep the visible source styling with neutral regional details instead of assigning a male or female role by default.
GROUPS ARE NOT REFERENCE COUPLES: Image 2 supplies clothing designs, never the group's gender mix, roles or left/right outfit positions. For two women, give BOTH guests women's regional outfits; for two men, give BOTH guests men's regional outfits. The same outfit family may be repeated for any number of guests. Never force one dress and one trouser outfit, alternate outfits by position, or turn one guest into the reference man or woman to complete a couple. Apply the same independent matching to three or four guests. Keep every clothing assignment attached to that guest's own face and body, without swapping guests or changing their proportions.
Explicit garment choice overrides the default only for the guest who made it. Do not apply an unassigned voice preference to the whole group. Use accessories that match each guest's selected styling; do not transfer another guest's hat, veil, flowers or coiffure. Adapt the regional outfit to the guest; never copy the reference model's body or pose.`;
}
