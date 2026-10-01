"""Extract the client's six panels without their printed headings. Run only on the cloud runner."""
from pathlib import Path
from PIL import Image
import json
src=Path("public/assets/examples/regional-clothing.jpg")
im=Image.open(src).convert("RGB")
out=Path("assets/region-references");out.mkdir(parents=True,exist_ok=True)
names=["canarias","barcelona","bilbao","madrid","andalucia","valencia"]
manifest={}
for i,name in enumerate(names):
    col=i%3; row=i//3; w,h=im.size
    # Exclude separators and headings, retain the complete reference outfits.
    box=(round(col*w/3)+3,round(h*(.05 if row==0 else .54)),round((col+1)*w/3)-3,round(h*(.487 if row==0 else 1))-3)
    panel=im.crop(box)
    panel.save(out/(name+".jpg"),quality=96,subsampling=0)
    manifest[name]={"source":str(src),"crop":list(box),"width":panel.width,"height":panel.height}
(out/"manifest.json").write_text(json.dumps(manifest,indent=2)+"\n")
