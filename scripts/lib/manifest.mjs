/**
 * sitemap/lastmod/对比组合/索引规则唯一实现源 = src/lib/domain/manifest.ts（本文件 re-export）。
 *
 * lastmod 规则（禁止使用构建日期；核验时间 ≠ 内容更新时间）：
 *  - 模型详情页：该模型的 contentUpdatedAt
 *  - 对比页：参与对比两款模型 contentUpdatedAt 的较大者
 *  - 声明了 dependsOnModels / dependsOnTools 的手写页：手写日期与所依赖数据更新日的较大者
 *  - 仅核验而内容未变时不得更新 contentUpdatedAt / lastmod；无法确定时 lastmod = null（省略）
 *
 * 注意：loadJson/loadData 刻意保持 DIST 口径（检查脚本校验的是已发布产物，不是构建输入）。
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { DIST } from './paths.mjs';

export * from '../../src/lib/domain/manifest.ts';

export function loadJson(rel) {
  return JSON.parse(readFileSync(join(DIST, rel), 'utf8'));
}

export function loadData() {
  return {
    models: loadJson('assets/data/models.json'),
    tools: loadJson('assets/data/tools.json'),
    pagesMeta: loadJson('assets/data/pages.json'),
    fx: loadJson('assets/data/fx.json'),
    compares: loadJson('assets/data/compares.json')
  };
}
