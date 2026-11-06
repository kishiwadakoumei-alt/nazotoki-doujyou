import {execFileSync} from 'node:child_process';
import {mkdirSync,rmSync,readdirSync,readFileSync,writeFileSync,copyFileSync,existsSync} from 'node:fs';
import {join,dirname,resolve,relative} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const docs=join(root,'docs');
rmSync(docs,{recursive:true,force:true});
mkdirSync(docs,{recursive:true});
// The project needs only TypeScript, installed via npm install or provided globally.
const tsc=process.platform==='win32'?'tsc.cmd':'tsc';
execFileSync(tsc,['--project',join(root,'tsconfig.pages.json')],{cwd:root,stdio:'inherit'});
function processDirectory(dir){
  for(const e of readdirSync(dir,{withFileTypes:true})){
    const f=join(dir,e.name);
    if(e.isDirectory()){processDirectory(f);continue;}
    if(!f.endsWith('.js'))continue;
    let code=readFileSync(f,'utf8');
    code=code.replace(/^import\s+['"]\.\/style\.css['"];?\s*$/gm,'');
    code=code.replace(/(\bfrom\s*['"])(\.{1,2}\/[^'"\n]+)(['"])/g, (_full,start,p,end)=>start+(p.endsWith('.js')?p:existsSync(resolve(dirname(f),p,'index.js'))?p+'/index.js':p+'.js')+end);
    code=code.replace(/(\bimport\s*\(\s*['"])(\.{1,2}\/[^'"\n]+)(['"]\s*\))/g, (_full,start,p,end)=>start+(p.endsWith('.js')?p:existsSync(resolve(dirname(f),p,'index.js'))?p+'/index.js':p+'.js')+end);
    writeFileSync(f,code);
  }
}
processDirectory(join(docs,'assets'));
copyFileSync(join(root,'src/style.css'),join(docs,'assets/style.css'));
copyFileSync(join(root,'public/favicon.svg'),join(docs,'favicon.svg'));
const page=readFileSync(join(root,'index.html'),'utf8')
  .replace('<script type="module" src="/src/main.ts"></script>','<script type="module" src="./assets/main.js"></script>')
  .replace('</head>','<link rel="stylesheet" href="./assets/style.css" /></head>');
writeFileSync(join(docs,'index.html'),page);
writeFileSync(join(docs,'.nojekyll'),'');
console.log(`GitHub Pages ready: ${relative(root,docs)}/index.html`);
