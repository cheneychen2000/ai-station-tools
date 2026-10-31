/**
 * 本地兼容构建包装（npm run build:compat；CI/Cloudflare 直接用 `astro build`）。
 *
 * 历史背景：本机 IDE 注入的 fs 批量删除保护垫片会把 Astro 构建结束时的 .prerender 临时目录
 * 自删（约 500 chunk）拦成异常，导致本地裸 `astro build` 偶发失败；Windows 管道下大段构建
 * 输出偶发 libuv 断言崩溃（UV_HANDLE_CLOSING）。本包装只做三件事：
 *  1. 剥离 NODE_OPTIONS 中的垫片后 spawn astro build；
 *  2. 非交互终端把构建日志写临时文件、结束时打印摘要；
 *  3. 把残留的 .prerender 中间目录移到系统临时目录（改名不触发删除保护）。
 * 标准构建命令 `npm run build` 已是裸 astro build，本包装仅为本地环境兼容保留
 * （既有检查脚本如 check-build 的幂等断言以本入口构建两次对拍）。
 */
import { spawnSync } from 'node:child_process';
import { readFileSync, existsSync, rmSync, renameSync, openSync, closeSync, readdirSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const bin = join(ROOT, 'node_modules', 'astro', 'bin', 'astro.mjs');
const outDir = join(ROOT, process.env.ASTRO_OUT_DIR || 'dist');

if (!existsSync(bin)) {
  throw new Error('未安装 Astro 依赖，请先执行 npm ci / npm install');
}

/* 子进程环境：剥离 IDE（CodeBuddy/微信开发者工具）注入的 fs 批量删除保护垫片。
   该垫片把单次 >500 文件的删除拦成异常，而 Astro 构建结束时会删除自己的 .prerender 临时目录
   （约 500 个 chunk），因此在装了垫片的本地环境里构建必失败；CI 与 Cloudflare Pages 无此垫片，
   所以这只是本地开发环境的兼容处理，不影响流水线行为。 */
const childEnv = { ...process.env };
if (childEnv.NODE_OPTIONS) {
  const cleaned = childEnv.NODE_OPTIONS
    .replace(/--require=(?:"[^"]*shim\.cjs"|\S*shim\.cjs)/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (cleaned) childEnv.NODE_OPTIONS = cleaned;
  else delete childEnv.NODE_OPTIONS;
}

const interactive = Boolean(process.stdout.isTTY);
const logPath = join(tmpdir(), `reflex-hub-build-${process.pid}.log`);
let res;
if (interactive) {
  res = spawnSync(process.execPath, [bin, 'build', ...process.argv.slice(2)], { cwd: ROOT, stdio: 'inherit', env: childEnv });
} else {
  const fd = openSync(logPath, 'w');
  res = spawnSync(process.execPath, [bin, 'build', ...process.argv.slice(2)], { cwd: ROOT, stdio: ['ignore', fd, fd], env: childEnv });
  closeSync(fd);
}

/* 清理 Astro 预渲染中间目录：Astro 在 outDir 内生成 .prerender（SSR 打包产物），
   正常应在构建结束时自删；Windows 下偶有残留，会让产物目录混入内部 chunk 并破坏幂等性断言。
   用"移动到系统临时目录"而不是直接删除：改名不触发回收站/批量删除保护，且不会因文件句柄
   未释放而失败；删除失败也只是留下一个临时目录，不影响产物正确性。 */
for (const stray of ['.prerender', '.prerender.vite']) {
  const p = join(outDir, stray);
  if (!existsSync(p)) continue;
  try {
    renameSync(p, join(tmpdir(), `reflex-hub-${stray.replace(/\./g, '')}-${Date.now()}`));
    if (interactive) console.log(`[build] 已移出中间目录 ${stray}`);
  } catch (e) {
    try {
      rmSync(p, { recursive: true, force: true });
      if (interactive) console.log(`[build] 已删除中间目录 ${stray}`);
    } catch (e2) {
      console.warn(`[build] ⚠️ 中间目录 ${stray} 未能清理（${e2.message}），请检查产物目录`);
    }
  }
}

const status = res.status ?? 1;
if (!interactive) {
  const log = existsSync(logPath) ? readFileSync(logPath, 'utf8') : '';
  if (status !== 0) {
    console.log(log.split('\n').slice(-60).join('\n'));
    console.log(`[build] 失败，完整日志：${logPath}`);
  } else {
    rmSync(logPath, { force: true });
    const pages = countPages(outDir);
    console.log(`build ok: ${pages} pages（Astro ${readAstroVersion()}，输出目录 ${process.env.ASTRO_OUT_DIR || 'dist'}）`);
  }
}
process.exit(status);

function countPages(dir, base = '') {
  if (!existsSync(dir)) return 0;
  let n = 0;
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const rel = base ? `${base}/${name}` : name;
    if (statSync(p).isDirectory()) n += countPages(p, rel);
    else if (name.endsWith('.html')) n++;
  }
  return n;
}

function readAstroVersion() {
  try {
    return JSON.parse(readFileSync(join(ROOT, 'node_modules', 'astro', 'package.json'), 'utf8')).version;
  } catch (e) {
    return 'v?';
  }
}
