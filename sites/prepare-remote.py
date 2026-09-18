import os,json,subprocess,pathlib,shutil
repo=pathlib.Path.cwd();stage=pathlib.Path(os.environ['RUNNER_TEMP'])/'turespana-sites';cred=json.loads(os.environ['SITES_SOURCE']);token=cred['token'];header='Authorization: Bearer '+token
stage.mkdir(exist_ok=True)
def git(*args,auth=False,check=True):return subprocess.run(['git']+(['-c','http.extraHeader='+header] if auth else [])+list(args),cwd=stage,check=check,stdout=subprocess.PIPE,stderr=subprocess.PIPE)
git('init','-b',cred['branch']);git('remote','add','origin',cred['remote_url'])
refs=git('ls-remote','origin','refs/heads/'+cred['branch'],auth=True)
if refs.stdout.strip():
 git('fetch','origin',cred['branch'],auth=True);git('checkout','-B',cred['branch'],'FETCH_HEAD')
for p in stage.iterdir():
 if p.name!='.git':shutil.rmtree(p) if p.is_dir() else p.unlink()
shutil.copytree(repo/'sites',stage,dirs_exist_ok=True,ignore=shutil.ignore_patterns('tools','prepare-remote.py'))
assets=stage/'assets';assets.mkdir(exist_ok=True)
public=repo/'public'
selected=[p for p in public.iterdir() if p.suffix in ['.js','.html','.css']]
selected+=list((public/'data').glob('*.json'))
selected+=[public/'assets'/p for p in ['spain-sun.glb','spain-sun-fallback.svg']]
selected+=list((public/'assets/examples').glob('*.webp'))
for p in selected:
 target=assets/p.relative_to(public);target.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(p,target)
subprocess.run(['node','build.mjs'],cwd=stage,check=True);subprocess.run(['node','--check','dist/server/index.js'],cwd=stage,check=True);subprocess.run(['node','verify.mjs'],cwd=stage,check=True)
git('config','user.name','PowerWyze Sites');git('config','user.email','actions@users.noreply.github.com');git('add','.');git('commit','-m','Publish tested Blender sun kiosk on Sites')
r=git('push','origin','HEAD:'+cred['branch'],auth=True,check=False)
if r.returncode:raise RuntimeError('Sites source push failed; credentials were not logged')
sha=git('rev-parse','--verify','HEAD').stdout.decode().strip();(repo/'sites-source-sha.txt').write_text(sha+'\n');print('Pushed Sites source:',sha)
