const facts={
 canarias:'The Canary Islands bring together volcanic landscapes, Atlantic beaches, and wonderful island traditions. Tenerife is home to Teide, Spain’s highest peak.',
 barcelona:'Barcelona brings art and architecture to life, from Gaudí’s Sagrada Família to the historic streets of the Gothic Quarter.',
 bilbao:'Bilbao pairs the Guggenheim Museum’s striking architecture with the historic Casco Viejo. Its local pintxos are another great way to explore Basque culture.',
 madrid:'Madrid is a wonderful place to explore art, from the Prado to the Reina Sofía. Retiro Park offers a peaceful break in the heart of the city.',
 andalucia:'Andalucía is full of remarkable heritage, from Granada’s Alhambra to Seville’s grand plazas. It is also one of the great homes of flamenco.',
 valencia:'Valencia combines the futuristic City of Arts and Sciences with a historic old town. It is also famous for paella and the beautiful Turia Gardens.'
};
export function generationLine(destination){
 return Object.hasOwn(facts,destination)?`I'm Lola, and your Spanish portrait is being created. ${facts[destination]} You can enter your name and email while you wait.`:null;
}
