# 内容系统设计说明（Markdown 指南）

## 1. 集合与数据源

| 集合 | 数据源 | Schema |
|---|---|---|
| `models` / `tools` / `prompts` | `public/assets/data/{models,tools,prompts}.json`（file loader，不复制文件） | `modelSchema` / `toolSchema` / `promptSchema` |
| `guidesZh` | `src/content/guides/zh-CN/**/*.md`（glob loader） | `guideSchema` |
| `guidesEn` | `src/content/guides/en/**/*.md`（glob loader） | `guideSchema` |

- 事实源唯一：模型价格等仍只有 `public/assets/data/models.json` 一份；文章元数据唯一来源是 frontmatter，**不登记 pages.json**。
- Schema 在 `src/lib/data/schemas.ts`（`astro/zod`），构建期硬校验。

## 2. 数据访问层

`src/lib/data/index.ts`：`getModels/getTools/getPrompts`（按 JSON 文件顺序还原）、`getPagesMeta/getCompares/getFx/...`、
`getSiteData()`（构建进程内缓存，返回 models/tools/pagesMeta/fx/compares/pairs/articles/routeMap）。

`src/lib/data/guides.ts`：
`getVisibleArticles`（生产过滤草稿）、`getPublishedArticles`、`getArticle`、`getTranslation`、`getRelatedArticles`、
`validateGuides`（冲突检测）、`buildArticleManifest`；排序确定性 = `publishedAt` 降序 → `slug` 升序。

草稿判定用 `import.meta.env.MODE !== 'production'`（dev 可见 / 生产不输出），避免受外部 `NODE_ENV` 干扰。

## 3. 路由与 SEO

- 路由：`src/pages/guides/[slug]/index.astro` → `/guides/{slug}/`；`src/pages/en/guides/[slug]/index.astro` → `/en/guides/{slug}/`（`getStaticPaths`）。
- 冲突检测（构建期抛错）：slug 正则、保留字 `index`、与 `pages.json` 静态指南路径冲突、同语言 `translationKey` 重复。
- SEO：复用 `SiteLayout` + `components/seo/{SEOHead,JsonLd,Breadcrumbs}.astro`；
  canonical 按真实路径自引用；`indexable=false` → `noindex,follow` 且不进 sitemap；
  hreflang 由 `routeMap` 按 `translationKey` 合并派生（无对应语言则零输出）；
  JSON-LD = `TechArticle`/`Article` + `BreadcrumbList`（无 `author` 时不输出作者）。
- 目录：`render()` 返回的 headings（H2/H3）→ `ArticleTOC`，锚点 id 与正文同源，天然一致。

## 4. 组件

```
src/components/guide/
├── ArticleHeader.astro   # H1 + 摘要 + 元信息 + 可选封面
├── ArticleMeta.astro     # 发布/更新/作者/分类/标签
├── ArticleTOC.astro      # 目录（仅 H2/H3，空则不渲染）
├── ArticleBody.astro     # Markdown 正文容器（<Content /> 插槽）
├── ArticleSources.astro  # 参考资料（rel=noopener）
├── ArticleRelated.astro  # 相关文章（仅真实存在且已发布）
└── ArticleCard.astro     # 指南首页卡片
```

## 5. 与 sitemap / 路由映射的衔接

- `buildRouteMap(pagesMeta, models, compares, tools, articles)`：同 `translationKey` 的中英两篇合并为一条路由记录；验证器要求"至少一种语言路由"。
- `buildManifest({...data, articles})`：只追加已发布且 `indexable` 的文章，`lastmod = updatedAt`（禁止构建日期）。
- `src/pages/assets/data/content-manifest.json.ts`：构建期产出已发布文章清单（path/lastmod/category/indexable/translationKey），供检查脚本在无 YAML 依赖下校验 sitemap、lastmod、草稿排除与增量页面。

## 6. 检查覆盖

- `scripts/check-content.mjs`：清单结构、中英路由、草稿排除、无清单外页面、sitemap 收录与 lastmod、canonical/robots、hreflang 配对、目录锚点、来源与站内链接可达、指南首页收录、全站本地资源 404。
- `check-sitemap-lastmod` S8/S9、`check-build` B4 均按"含文章"的清单计算；
- 页面索引策略、双语一致性由 `check-i18n` / `check-en-pages` 覆盖。
