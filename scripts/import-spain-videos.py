import os, pathlib, urllib.request, zipfile, json, subprocess, tempfile, shutil, hashlib
from PIL import Image, ImageDraw
root=pathlib.Path.cwd()
out=root/'public/assets/spain-videos';out.mkdir(parents=True,exist_ok=True)
review=root/'artifacts/spain-videos';review.mkdir(parents=True,exist_ok=True)
url=os.environ['SPAIN_VIDEO_DOWNLOAD_URL']
with tempfile.TemporaryDirectory() as temp:
 temp=pathlib.Path(temp);archive=temp/'videos.zip'
 try:
  with urllib.request.urlopen(urllib.request.Request(url,headers={'User-Agent':'Mozilla/5.0'}),timeout=120) as r,archive.open('wb') as f:shutil.copyfileobj(r,f)
 except Exception:raise RuntimeError('The supplied transfer could not be downloaded; its private URL was not logged.') from None
 with zipfile.ZipFile(archive) as z:
  entries=sorted(n for n in z.namelist() if n.lower().endswith('.mp4') and not n.startswith('__MACOSX'))
  assert len(entries)==20, 'Expected the 20 supplied clips'
  clips=[];sheet=Image.new('RGB',(5*200,4*390),'#17212d');draw=ImageDraw.Draw(sheet)
  for i,name in enumerate(entries,1):
   src=temp/f'input-{i}.mp4';src.write_bytes(z.read(name))
   probe=json.loads(subprocess.check_output(['ffprobe','-v','error','-show_streams','-show_format','-of','json',str(src)]))
   video=next(s for s in probe['streams'] if s['codec_type']=='video')
   duration=float(probe['format']['duration']);assert video['height']>video['width'] and 8<=duration<=12
   target=out/f'spain-{i:02}.mp4'
   subprocess.run(['ffmpeg','-hide_banner','-loglevel','error','-y','-i',str(src),'-map','0:v:0','-an','-vf','scale=720:-2,setsar=1','-c:v','libx264','-preset','medium','-crf','24','-pix_fmt','yuv420p','-movflags','+faststart',str(target)],check=True)
   thumb=review/f'spain-{i:02}.jpg'
   subprocess.run(['ffmpeg','-hide_banner','-loglevel','error','-y','-ss','2','-i',str(target),'-frames:v','1','-vf','scale=180:-2',str(thumb)],check=True)
   encoded=json.loads(subprocess.check_output(['ffprobe','-v','error','-select_streams','v:0','-show_entries','stream=width,height','-of','json',str(target)]))['streams'][0]
   img=Image.open(thumb);x=((i-1)%5)*200;y=((i-1)//5)*390
   sheet.paste(img,(x+10,y));draw.text((x+10,y+img.height+8),f'{i:02} '+pathlib.Path(name).name[5:29],fill='white')
   clips.append({'src':'/assets/spain-videos/'+target.name,'originalName':pathlib.Path(name).name,'duration':round(duration,3),'width':encoded['width'],'height':encoded['height'],'bytes':target.stat().st_size,'sha256':hashlib.sha256(target.read_bytes()).hexdigest()})
  sheet.save(review/'contact-sheet.jpg',quality=90)
  manifest={'clips':clips,'source':'Supplied by Turespaña for the IMEX America kiosk, September 2026','muted':True}
  (out/'manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
  (review/'manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
  print(f'Prepared {len(clips)} vertical clips, {sum(c["bytes"] for c in clips)/1000000:.1f} MB total. No audio retained for homepage playback.')
