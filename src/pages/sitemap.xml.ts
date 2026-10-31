/**
 * sitemap.xml 静态端点：URL 集合与 lastmod 规则唯一来自 domain/manifest 的 buildManifest
 * （模型页跟随 contentUpdatedAt、对比页取两模型较大者、依赖页取手写日期与依赖数据较大者；
 *  Markdown 文章取 frontmatter 的 updatedAt；
 *  noindex 页面与草稿不进清单；不确定更新时间的页面省略 lastmod——禁止使用构建日期）。
 */
import type { APIRoute } from 'astro';
import { getModels, getTools, getPagesMeta, getCompares } from '../lib/data';
import { buildArticleManifest } from '../lib/data/guides';
import { buildManifest } from '../lib/domain/manifest';
import { SITE } from '../lib/config';

export const GET: APIRoute = async () => {
  const [models, tools, articleManifest] = await Promise.all([getModels(), getTools(), buildArticleManifest()]);
  const articles = articleManifest
    .filter(a => a.indexable)
    .map(a => ({ path: a.path, lastmod: a.lastmod }));
  const entries = buildManifest({ models, tools, pagesMeta: getPagesMeta(), compares: getCompares(), articles });
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries.map(e => e.lastmod
          ? `  <url>\n    <loc>${SITE}${e.path}</loc>\n    <lastmod>${e.lastmod}</lastmod>\n  </url>`
          : `  <url>\n    <loc>${SITE}${e.path}</loc>\n  </url>`).join('\n')}
</urlset>
`;
  return new Response(xml, { headers: { 'Content-Type': 'application/xml; charset=utf-8' } });
};
