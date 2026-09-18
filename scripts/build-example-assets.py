from PIL import Image
from pathlib import Path
out=Path('public/assets/examples');out.mkdir(parents=True,exist_ok=True)
for original in Path('assets/destination-examples-source').glob('*.png'):
    illustrated=Path('assets/destination-examples-illustrated')/(original.stem+'.jpg')
    source=illustrated if illustrated.exists() else original
    image=Image.open(source).convert('RGB');image.thumbnail((400,600))
    image.save(out/(source.stem+'.webp'),'WEBP',quality=86,method=6)
