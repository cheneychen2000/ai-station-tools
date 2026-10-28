/** 全站 emoji 扫描：dist 下 html/js/css 不得出现 emoji（图标一律用内联 SVG 或 Canvas 手绘） */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

import { DIST } from './lib/paths.mjs';
/* 只匹配真正的 emoji（dingbats/表情符号/变体选择符）；→▾ 等普通文字符号不算 */
const EMOJI_RE = /[️\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}]/u;

function walk(dir) {
  let out = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out = out.concat(walk(p));
    else if (/\.(html|js|css)$/.test(name)) out.push(p);
  }
  return out;
}

let hits = 0;
for (const p of walk(DIST)) {
  const txt = readFileSync(p, 'utf8');
  const m = txt.match(EMOJI_RE);
  if (m) {
    console.log('EMOJI:', p.replace(DIST, ''), '→', JSON.stringify(m[0]));
    hits++;
  }
}
console.log(hits === 0 ? 'no emoji, all icons vectorized' : `${hits} file(s) still contain emoji`);
process.exit(hits ? 1 : 0);
