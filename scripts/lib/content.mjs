/**
 * 检查脚本侧的文章清单读取（Phase 3）。
 * 唯一真实来源是 Markdown frontmatter；检查脚本不解析 YAML，而是读取构建期产物
 * dist/assets/data/content-manifest.json（由 src/pages/assets/data/content-manifest.json.ts 生成）。
 */
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { DIST } from './paths.mjs';

/** 已发布文章清单（生产构建产物） */
export function loadArticles() {
  const file = join(DIST, 'assets/data/content-manifest.json');
  if (!existsSync(file)) return [];
  try {
    return JSON.parse(readFileSync(file, 'utf8')).articles || [];
  } catch {
    return [];
  }
}

/** 供 buildRouteMap 的文章路由输入（按 translationKey 合并中英） */
export function articleRouteInputs() {
  return loadArticles().map(a => ({
    lang: a.lang,
    slug: a.slug,
    path: a.path,
    indexable: a.indexable,
    translationKey: a.translationKey
  }));
}

/** 供 buildManifest 的文章条目（默认只取 indexable） */
export function articleManifestEntries({ indexableOnly = true } = {}) {
  return loadArticles()
    .filter(a => !indexableOnly || a.indexable)
    .map(a => ({ path: a.path, lastmod: a.lastmod }));
}
