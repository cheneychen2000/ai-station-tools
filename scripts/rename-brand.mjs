import { readFileSync, writeFileSync } from 'node:fs';

const root = new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const files = [
  'PRD.md',
  'AI_CODING_PROMPTS.md',
  'dist/index.html',
  'dist/cost/index.html',
  'dist/404.html',
  'dist/assets/app.js',
];

for (const f of files) {
  const p = root + '/' + f;
  const before = readFileSync(p, 'utf8');
  const after = before.split('AI驿站工具箱').join('AI七号驿站');
  if (before !== after) {
    writeFileSync(p, after, 'utf8');
    const count = before.split('AI驿站工具箱').length - 1;
    console.log(`${f}: replaced ${count}`);
  } else {
    console.log(`${f}: no occurrence`);
  }
}
