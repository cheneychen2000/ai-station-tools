import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import vm from 'node:vm';

import { DIST } from './lib/paths.mjs';
function walk(dir) {
  let out = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out = out.concat(walk(p));
    else if (name.endsWith('.html') || name.endsWith('.js')) out.push(p);
  }
  return out;
}

let fail = 0, checked = 0;
for (const p of walk(DIST)) {
  /* _astro/ 是 Vite 打包产物（ES module，经 <script type=module> 加载）：
     vm.Script 按经典脚本解析会误报 import 语句，故跳过——其语法由构建器保证。
     页面内联经典脚本块与 public/assets 下的经典 JS 仍全量校验。 */
  if (p.includes('_astro')) continue;
  const txt = readFileSync(p, 'utf8');
  const blocks = [];
  if (p.endsWith('.js')) {
    blocks.push(txt);
  } else {
    const re = /<script>([\s\S]*?)<\/script>/g;
    let m;
    while ((m = re.exec(txt))) blocks.push(m[1]);
  }
  for (const code of blocks) {
    checked++;
    try { new vm.Script(code); } catch (e) {
      console.log('SYNTAX FAIL:', p, '-', e.message);
      fail++;
    }
  }
}
console.log(`checked ${checked} inline script blocks, fail ${fail}`);
process.exit(fail ? 1 : 0);
