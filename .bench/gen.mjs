import fs from 'node:fs';
const T = String.fromCharCode(96);
let seed = 987654321;
function rnd(){ seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; }
const pick = a => a[Math.floor(rnd()*a.length)];
const HAN = Array.from('中文技术写作需要处理空格与标点全半角的问题排版规则细节很多并且要保证代码块安全边界清晰');
const cjk = n => { let s=''; for(let i=0;i<n;i++) s += HAN[Math.floor(rnd()*HAN.length)]; return s; };
const LATIN = ['Kubernetes','Docker','Rust','TypeScript','Vite','Nginx','PostgreSQL','Redis','gRPC','WebAssembly','React','Node.js','Linux','CPU','QPS','JWT'];
function para(){
  const n = 4 + Math.floor(rnd()*7);
  const out = [];
  for(let i=0;i<n;i++){
    const r = rnd();
    if(r<0.52) out.push(cjk(6+Math.floor(rnd()*20)));
    else if(r<0.72) out.push(pick(LATIN));
    else if(r<0.86) out.push(T + pick(LATIN).toLowerCase() + ' --flag' + T);
    else out.push((1+Math.floor(rnd()*900)) + pick(['%','ms','GB','个','倍','万']));
  }
  return out.join('') + pick(['。','。','。','；','！','？']);
}
function codeLines(n, lang){
  const out = [];
  for(let i=0;i<n;i++){
    const r = rnd();
    if(r<0.15) out.push('// ' + cjk(6+Math.floor(rnd()*14)));
    else if(r<0.25) out.push('');
    else if(r<0.4) out.push('  '.repeat(Math.floor(rnd()*3)) + 'if (' + pick(LATIN).toLowerCase().replace(/[^a-z]/g,'') + 'Count > ' + Math.floor(rnd()*100) + ') {');
    else out.push('  '.repeat(Math.floor(rnd()*3)) + 'const ' + pick(['value','result','cache','handler','client']).concat(String(Math.floor(rnd()*99))) + ' = ' + pick(['await fetch(url)','compute(input)','new Map()','config.get(key)','parse(text)']) + ';');
  }
  return out;
}
let body = [];
body.push('---');
body.push('title: \'中文技术文章示例\'');
body.push('date: 2026-01-01');
body.push('tags:');
body.push('  - kubernetes');
body.push('  - performance');
body.push('---');
body.push('');
let sec = 0;
while (body.join('\n').split('\n').length < 10000) {
  sec++;
  body.push('## ' + sec + ' 第' + sec + '节' + cjk(4+Math.floor(rnd()*8)));
  body.push('');
  for(let i=0;i<3;i++){ body.push(para()); body.push(''); }
  const kind = sec % 5;
  if(kind===0){
    const n = 10 + Math.floor(rnd()*15);
    for(let i=1;i<=n;i++) body.push(i + '. ' + cjk(5+Math.floor(rnd()*12)) + pick(LATIN) + cjk(3));
    body.push('');
  } else if(kind===1){
    const n = 120 + Math.floor(rnd()*180);
    body.push(T+T+T+'typescript');
    for(let i=0;i<n;i++) body.push(...codeLines(1,'ts'));
    body.push(T+T+T);
    body.push('');
  } else if(kind===2){
    const n = 5 + Math.floor(rnd()*10);
    for(let i=0;i<n;i++) body.push('- ' + cjk(4+Math.floor(rnd()*10)) + pick(LATIN) + cjk(2));
    body.push('');
  } else if(kind===3){
    const n = 20 + Math.floor(rnd()*40);
    body.push(T+T+T+'bash');
    for(let i=0;i<n;i++) body.push('$ ' + pick(['kubectl','docker','git','pnpm']) + ' ' + cjk(0) + pick(['get pods','build','status','run']) + ' ' + Math.floor(rnd()*999));
    body.push(T+T+T);
    body.push('');
  } else {
    body.push('| 参数 | 说明 | 默认值 |');
    body.push('| --- | --- | --- |');
    const n = 4 + Math.floor(rnd()*6);
    for(let i=0;i<n;i++) body.push('| ' + pick(LATIN) + ' | ' + cjk(5+Math.floor(rnd()*10)) + ' | ' + Math.floor(rnd()*1000) + ' |');
    body.push('');
  }
}
const doc = body.join('\n') + '\n';
fs.writeFileSync('.bench/fixture.md', doc);
const lines = doc.split('\n');
let inFence = false, fenceLines = 0, proseLines = 0, blank = 0;
for (const l of lines) {
  const t = l.trimStart();
  if (/^(\x60{3,}|~{3,})/.test(t)) { inFence = !inFence; fenceLines++; continue; }
  if (inFence) { fenceLines++; continue; }
  if (t === '') { blank++; continue; }
  proseLines++;
}
const cjkCount = (doc.match(/[\u4e00-\u9fff]/g) || []).length;
console.log(JSON.stringify({ bytes: Buffer.byteLength(doc), lines: lines.length, fenceLines, proseLines, blank, cjkCount }, null, 2));
