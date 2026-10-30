/**
 * Prompt 库双语正文专项检查：
 *  - P1：12 个 ID 完整且顺序稳定，prompt 为 {zh, en} 结构，双语正文均非空且够长
 *  - P2：中文正文含汉字、英文正文零汉字（防止中英错位/串台），且两版互不相同
 *  - P3：id/title/scene/tags 与既有双语 UI（labels-en.js 的 promptTitle/promptScene/promptTag）一一对应
 *  - P4：中文页读 prompt.zh、英文页读 prompt.en；英文页不得再裸用 p.prompt
 *  - P5：dist 与 public 的 prompts.json 逐字节一致（构建拷贝无漂移）
 * 运行：node scripts/check-prompts.mjs（在 build 之后执行）
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { DIST, ROOT } from './lib/paths.mjs';
import { createReporter } from './lib/report.mjs';

const R = createReporter('check-prompts');

const EXPECT_IDS = ['polish-article', 'wechat-opener', 'translate-en', 'code-review', 'explain-code',
  'meeting-summary', 'article-summary', 'feynman', 'exam-quiz', 'weekly-report', 'email-reply', 'short-video-script'];

const pub = JSON.parse(readFileSync(join(ROOT, 'public/assets/data/prompts.json'), 'utf8'));
const dist = JSON.parse(readFileSync(join(DIST, 'assets/data/prompts.json'), 'utf8'));

const idsBad = [];
if (pub.length !== 12) idsBad.push(`条数 ${pub.length}（应 12）`);
EXPECT_IDS.forEach((id, i) => { if (pub[i].id !== id) idsBad.push(`第 ${i + 1} 项是 ${pub[i].id}（应 ${id}）`); });
R.check('P1 12 个 ID 完整、顺序稳定，无新增/删除/合并', idsBad.length === 0, idsBad.join(' | ') || EXPECT_IDS.join(', '));

const cjk = s => /[\u4e00-\u9fff]/.test(s);
const bodyBad = [];
for (const p of pub) {
  const keys = Object.keys(p.prompt || {}).sort();
  if (keys.join(',') !== 'en,zh') { bodyBad.push(`${p.id}：prompt 键为 ${keys.join(',')}`); continue; }
  if (p.prompt.zh.length < 200) bodyBad.push(`${p.id}：中文正文仅 ${p.prompt.zh.length} 字`);
  if (p.prompt.en.length < 200) bodyBad.push(`${p.id}：英文正文仅 ${p.prompt.en.length} 字`);
  if (!cjk(p.prompt.zh)) bodyBad.push(`${p.id}：中文正文不含汉字（疑似串台）`);
  if (cjk(p.prompt.en)) bodyBad.push(`${p.id}：英文正文含汉字（疑似串台）`);
  if (p.prompt.zh === p.prompt.en) bodyBad.push(`${p.id}：双语正文相同`);
}
R.check(`P2 12 条正文双语结构完整：${pub.length} 条 zh/en 均 >200 字符、中文含汉字/英文零汉字、两版不同`,
  bodyBad.length === 0, bodyBad.slice(0, 6).join(' | ') || '全部合规');

/* P3：既有双语 UI 的标题/场景/标签映射仍覆盖全部条目（本次只改 prompt 字段，不动它们） */
const labels = readFileSync(join(DIST, 'assets/labels-en.js'), 'utf8');
const LABEL_BLOCKS = ['promptTitle', 'promptScene', 'promptTag'];
const uiBad = [];
for (const block of LABEL_BLOCKS) {
  const m = labels.match(new RegExp(`"?${block}"?\\s*[:=]\\s*\\{([\\s\\S]*?)\\}`));
  if (!m) { uiBad.push(`labels-en.js 缺 ${block}`); continue; }
  const src = m[1];
  const targets = block === 'promptTitle' ? pub.map(p => p.id) : block === 'promptScene' ? pub.map(p => p.scene) : pub.flatMap(p => p.tags);
  for (const t of new Set(targets)) {
    if (!src.includes(JSON.stringify(t))) uiBad.push(`${block} 缺「${t}」`);
  }
}
R.check('P3 标题/场景/标签的既有双语 UI 映射完整（本次未改动，防回归）', uiBad.length === 0, uiBad.slice(0, 6).join(' | ') || '全部覆盖');

const zhPage = readFileSync(join(DIST, 'prompts/index.html'), 'utf8');
const enPage = readFileSync(join(DIST, 'en/prompts/index.html'), 'utf8');
const pageBad = [];
const readCount = (html, needle) => (html.match(new RegExp(needle, 'g')) || []).length;
if (readCount(zhPage, 'p\\.prompt\\.zh') !== 2) pageBad.push(`中文页 p.prompt.zh 出现 ${readCount(zhPage, 'p\\.prompt\\.zh')} 次（应 2）`);
if (readCount(enPage, 'p\\.prompt\\.en') !== 2) pageBad.push(`英文页 p.prompt.en 出现 ${readCount(enPage, 'p\\.prompt\\.en')} 次（应 2）`);
if (readCount(enPage, 'p\\.prompt(?!\\.)') !== 0) pageBad.push('英文页仍存在裸用 p.prompt（会读到对象而不是字符串）');
if (readCount(zhPage, 'p\\.prompt\\.en') !== 0) pageBad.push('中文页引用了 p.prompt.en');
if (readCount(enPage, 'p\\.prompt\\.zh') !== 0) pageBad.push('英文页引用了 p.prompt.zh');
if (!zhPage.includes('prompts.json') || !enPage.includes('prompts.json')) pageBad.push('页面未引用 prompts.json');
R.check('P4 中文页读 prompt.zh / 英文页读 prompt.en（渲染 + 复制各 1 次），且无裸用 p.prompt',
  pageBad.length === 0, pageBad.slice(0, 6).join(' | ') || '全部合规');

const same = readFileSync(join(ROOT, 'public/assets/data/prompts.json')).equals(readFileSync(join(DIST, 'assets/data/prompts.json')));
R.check('P5 dist 与 public 的 prompts.json 逐字节一致', same, same ? '一致' : '构建拷贝漂移！');

R.summary();
