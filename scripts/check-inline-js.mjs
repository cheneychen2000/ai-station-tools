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
