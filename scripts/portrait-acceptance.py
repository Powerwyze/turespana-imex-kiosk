"""Two deliberate live edits. No automatic paid retries. Photos stay out of source."""
import os,io,base64,json,urllib.request,urllib.error,urllib.parse
from pathlib import Path
from PIL import Image
origin=os.environ["PORTRAIT_TEST_ENDPOINT"].rstrip("/")
u=urllib.parse.urlparse(origin)
if u.scheme!="https" or not (u.hostname or "").startswith("turespana-imex-kiosk") or not u.hostname.endswith(".vercel.app"):
    raise ValueError("Use the intended kiosk's staged Vercel origin")
out=Path("artifacts");out.mkdir(exist_ok=True)
packed="".join(os.environ.get("PORTRAIT_SOURCE_"+str(i),"") for i in range(1,5))
if not packed:raise ValueError("Supplied reference screenshot not configured")
# The user's screenshot contains the original selfie at its upper left.
# Extract only that selfie; the desired output below is never sent as identity.
im=Image.open(io.BytesIO(base64.b64decode(packed))).convert("RGB")
w,h=im.size
selfie=im.crop((round(w*234/749),round(h*22/1280),round(w*474/749),round(h*259/1280)))
buf=io.BytesIO();selfie.save(buf,format="JPEG",quality=96)
sources=[("supplied-selfie",buf.getvalue(),"dress"),("camera-fixture",Path("tests/fixtures/sentry-person.jpg").read_bytes(),"trousers")]
failures=[]
for name,data,style in sources:
    boundary="----PowerWyzePortraitAcceptance"
    fields={"destinationId":"barcelona","guestCount":"1","style":style}
    body=b""
    for k,v in fields.items():body+=("--"+boundary+'\r\nContent-Disposition: form-data; name="'+k+'"\r\n\r\n'+v+'\r\n').encode()
    body+=("--"+boundary+'\r\nContent-Disposition: form-data; name="image"; filename="guest.jpg"\r\nContent-Type: image/jpeg\r\n\r\n').encode()+data+("\r\n--"+boundary+"--\r\n").encode()
    req=urllib.request.Request(origin+"/api/host-photo",data=body,headers={"Content-Type":"multipart/form-data; boundary="+boundary,"Origin":"https://turespana-imex-kiosk.powerwyze-2010.chatgpt.site"})
    try:
        with urllib.request.urlopen(req,timeout=195) as r:
            assert r.headers.get("X-Portrait-Pipeline")=="regional-photo-v2"
            assert r.headers.get("X-Image-Model")=="gpt-image-2.5-flare"
            image=r.read();result=Image.open(io.BytesIO(image));result.verify()
            (out/("portrait-"+name+".jpg")).write_bytes(image)
            (out/("portrait-"+name+"-source.jpg")).write_bytes(data)
            print(name+": generated, decoded, and passed the independent outfit/framing/guest gate",flush=True)
    except urllib.error.HTTPError as e:
        msg=e.read().decode()[:800];print(name+": "+str(e.code)+" "+msg,flush=True);failures.append(name)
if failures:raise RuntimeError("Portrait acceptance failed: "+", ".join(failures))
