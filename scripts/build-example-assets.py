from PIL import Image
from pathlib import Path
import json
out=Path('public/assets/examples');out.mkdir(parents=True,exist_ok=True)
catalog=json.loads(Path('public/data/destinations.json').read_text())['destinations']
for destination in catalog:
    source=Path('assets/destination-examples-illustrated')/(destination['id']+'.jpg')
    image=Image.open(source).convert('RGB');image.thumbnail((400,600))
    image.save(out/(destination['id']+'.webp'),'WEBP',quality=86,method=6)
