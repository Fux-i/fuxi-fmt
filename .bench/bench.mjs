import fs from 'node:fs';
import { performance } from 'node:perf_hooks';
import MarkdownIt from 'markdown-it';
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkStringify from 'remark-stringify';
import * as prettier from 'prettier';

const file = process.argv[2] || '.bench/fixture.md';
const src = fs.readFileSync(file, 'utf8');
const MB = Buffer.byteLength(src) / 1048576;
console.log('=== ' + file + ' : ' + Buffer.byteLength(src) + ' bytes, ' + src.split('\n').length + ' lines (' + MB.toFixed(2) + ' MB) ===');

function report(label, best) {
  console.log(label.padEnd(44) + ' best ' + best.toFixed(1).padStart(8) + ' ms   ' + (MB / (best / 1000)).toFixed(2) + ' MB/s');
}
function bench(label, fn, runs = 5) {
  try { fn(); } catch (e) { console.log(label + '  ERROR: ' + e.message); return; }
  const t = [];
  for (let i = 0; i < runs; i++) { const s = performance.now(); fn(); t.push(performance.now() - s); }
  report(label, Math.min(...t));
}
async function benchAsync(label, fn, runs = 3) {
  try { await fn(); } catch (e) { console.log(label + '  ERROR: ' + e.message); return; }
  const t = [];
  for (let i = 0; i < runs; i++) { const s = performance.now(); await fn(); t.push(performance.now() - s); }
  report(label, Math.min(...t));
}

const md = new MarkdownIt();
bench('markdown-it parse', () => md.parse(src, {}));
bench('remark (micromark) parse -> mdast', () => unified().use(remarkParse).parse(src));
const proc = unified().use(remarkParse).use(remarkStringify);
bench('remark parse + stringify (round trip)', () => proc.stringify(proc.parse(src)));

const onePass = new RegExp('([\\p{Script=Han}])([A-Za-z0-9])', 'gu');
bench('1 CJK-spacing regex pass', () => src.replace(onePass, '$1 $2'));
const passes = Array.from({ length: 20 }, () => new RegExp('([\\p{Script=Han}])([A-Za-z0-9])', 'gu'));
bench('20 sequential CJK regex passes', () => { let s = src; for (const p of passes) s = s.replace(p, '$1 $2'); return s; });

await benchAsync('prettier.format (markdown)', () => prettier.format(src, { parser: 'markdown' }));
await benchAsync('prettier.format (markdown, proseWrap never)', () => prettier.format(src, { parser: 'markdown', proseWrap: 'never' }));
