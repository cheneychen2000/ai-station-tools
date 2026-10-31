/**
 * assets/data/content-manifest.json 静态端点：已发布 Markdown 文章清单（唯一真实来源仍是 frontmatter）。
 * 用途：
 *  - 检查脚本在不引入 YAML 解析依赖的前提下校验 sitemap / lastmod / 草稿排除 / 迁移增量（与 compare-pairs.json 同模式）；
 *  - 构建期确定性输出（按 path 排序），不含构建时间戳。
 * 草稿（draft=true）与开发预览内容不进本清单。
 */
import type { APIRoute } from 'astro';
import { buildArticleManifest } from '../../../lib/data/guides';

export const GET: APIRoute = async () => {
  const articles = await buildArticleManifest();
  const body = JSON.stringify({
    description: '已发布 Markdown 指南文章清单（构建期由 frontmatter 派生，禁止手改）：path=站内路由，lastmod=updatedAt，indexable=false 不进 sitemap，草稿不出现。',
    articles
  }, null, 1) + '\n';
  return new Response(body, { headers: { 'Content-Type': 'application/json; charset=utf-8' } });
};
