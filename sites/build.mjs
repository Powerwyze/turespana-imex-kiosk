import fs from 'node:fs';import path from 'node:path';
const types={'.jpg':'image/jpeg','.png':'image/png','.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json','.glb':'model/gltf-binary','.svg':'image/svg+xml','.webp':'image/webp','.woff2':'font/woff2'};
const assets={};
function walk(dir){for(const entry of fs.readdirSync(dir,{withFileTypes:true})){const p=path.join(dir,entry.name);if(entry.isDirectory())walk(p);else assets['/'+path.relative('assets',p).split(path.sep).join('/')]={type:types[path.extname(p)]||'application/octet-stream',data:fs.readFileSync(p).toString('base64')};}}
walk('assets');
fs.mkdirSync('dist/server',{recursive:true});fs.mkdirSync('dist/.openai',{recursive:true});
fs.writeFileSync('dist/server/index.js',fs.readFileSync('worker.mjs','utf8').replace('__ASSET_MAP__',JSON.stringify(assets)));
fs.copyFileSync('.openai/hosting.json','dist/.openai/hosting.json');
console.log('Built Sites kiosk with',Object.keys(assets).length,'local assets.');
