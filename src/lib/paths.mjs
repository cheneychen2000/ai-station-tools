/**
 * 公共路径与站点常量（Astro 版）。
 * 与 scripts/lib/paths.mjs 的差异仅在于目录布局：构建期数据源从 dist/assets/data 改为
 * public/assets/data（同一份 JSON，被原样承接为公开资源，保证"模型事实数据只有一份"）。
 *
 * ROOT 必须基于进程工作目录而不是 import.meta.url：Astro 在 SSR 预渲染阶段会把 src/lib
 * 打进 <outDir>/.prerender/chunks/，用模块自身路径推导根目录会指到输出目录里。
 */
import { join } from 'node:path';
import { existsSync } from 'node:fs';

export const ROOT = process.cwd();
if (!existsSync(join(ROOT, 'astro.config.mjs'))) {
  throw new Error(`[paths] 请在项目根目录执行构建（当前 cwd=${ROOT}）`);
}
/** 静态资源根（原 dist/assets/**，URL 不变） */
export const PUBLIC_DIR = join(ROOT, 'public');
/** 构建期数据读取根目录：public/（loadData 传 'assets/data/xxx.json'，与旧版读 dist/ 同构） */
export const DATA = PUBLIC_DIR;
/** 构建输出目录（Astro outDir；检查脚本沿用旧命名 dist） */
export const DIST = join(ROOT, 'dist');
export const REPORTS = join(ROOT, 'reports');
export const SITE = 'https://www.reflex-hub.com';
export const BRAND = 'Reflex Hub';
