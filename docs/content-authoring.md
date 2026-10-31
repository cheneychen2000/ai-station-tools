# 内容创作规范（Markdown 指南文章）

本文件面向内容作者。新增一篇指南/教程/案例/分析，**只需要新增一个 Markdown 文件并填好 Frontmatter**——路由、布局、SEO、hreflang、目录、指南首页收录、sitemap 全部自动生成，不需要写 Astro 页面，也不需要登记 `pages.json`。

- 中文目录：`src/content/guides/zh-CN/`
- 英文目录：`src/content/guides/en/`
- 文件名即 URL：`llm-api-caching.md` → `/guides/llm-api-caching/`（英文 → `/en/guides/llm-api-caching/`）

## 1. Frontmatter 字段

| 字段 | 必填 | 说明 |
|---|---|---|
| `title` | ✅ | 文章标题（非空）。页面 `<title>` 自动拼为 `标题 \| Reflex Hub` |
| `description` | ✅ | SEO 描述（非空），同时显示在卡片与页头 |
| `publishedAt` | ✅ | 发布日期 `YYYY-MM-DD` |
| `updatedAt` | ✅ | 内容最后实质更新时间，不得早于 `publishedAt`；**sitemap lastmod 直接取它** |
| `category` | ✅ | 分类 ID：`guide` / `tutorial` / `case-study` / `analysis` / `cost-optimization` / `model-selection` |
| `tags` | ✅ | 标签数组（字符串），用于卡片与首页主题标签 |
| `draft` | ✅ | `true` = 草稿：仅开发预览可见，生产构建不生成页面、不进 sitemap |
| `indexable` | ✅ | `false` = 输出 `noindex,follow` 且不进 sitemap（适合内部/实验内容） |
| `author` | ⬜ | 作者名；不填则不输出作者，**不会伪造作者** |
| `translationKey` | ⬜ | 中英对应标识（小写英文/数字/连字符）。两篇同 key 才输出双向 hreflang；未翻译前**不要**填或填 `null` |
| `cover` | ⬜ | `{ src, alt }`，`src` 必须是站内本地路径（`/assets/…` 或 `/images/…`，扩展名 png/jpg/webp/avif） |
| `relatedArticles` | ⬜ | 相关文章的 slug 数组（同语言）；只显示真实存在且已发布的，其余静默忽略 |
| `sources` | ⬜ | 参考资料数组：`{ title, url, accessedAt? }`；`url` 必须是合法 http/https |

文件名规则：只允许**小写英文、数字、连字符**（`^[a-z0-9]+(-[a-z0-9]+)*$`），不允许空格、中文、路径分隔符；`index` 为保留字。违规会在构建时报错。

## 2. 新增中文文章

在 `src/content/guides/zh-CN/` 新建 `your-article-name.md`：

```yaml
---
title: "LLM API 安全实践指南"
description: "介绍 LLM API 接入过程中的密钥保护、数据传输和权限管理。"
publishedAt: "2026-10-31"
updatedAt: "2026-10-31"
category: "tutorial"
tags:
  - LLM
  - API 安全
draft: true
indexable: true
translationKey: null
sources:
  - title: "OWASP Secrets Management Cheat Sheet"
    url: "https://cheatsheetseries.owasp.org/cheatsheets/Secrets_Management_Cheat_Sheet.html"
    accessedAt: "2026-10-31"
---

## 第一节

正文用标准 Markdown：## / ### 自动生成目录（H2 一级、H3 二级，中文标题锚点稳定），
表格、代码块、引用都会被正文样式覆盖。
```

参考完整示例：`src/content/guides/zh-CN/llm-api-security.md`（draft=true，不进生产构建）。

## 3. 新增英文文章

在 `src/content/guides/en/` 新建对应文件，**填入与中文文章相同的 `translationKey`**：

- 两边都有、且都 `draft: false` → 两页互相输出 `hreflang`（zh-CN / en 各一条），语言切换器可直达；
- 只有一边 → 不输出任何 hreflang、不伪造另一语言 URL；
- 翻译未完成时：英文文件可以不存在，或保留 `draft: true`、`translationKey: null`。

## 4. 发布流程

1. 创建 Markdown，填 Frontmatter（先 `draft: true`）；
2. 写正文：H2/H3 结构清晰，需要时加表格/代码/成本算例；
3. 补 `sources`：只写真实、可访问、与正文对应的来源，禁止编造；
4. 本地预览：`npm run dev` → 打开 `http://localhost:4321/guides/<slug>/`（草稿在 dev 可见）；
5. 内容定稿后把 `draft` 改为 `false`，并确认 `updatedAt` 是本次实质修改日期；
6. 本地跑完整检查：`npm run check`（含类型、内容、路由、SEO、sitemap、草稿排除）；
7. 提交 Pull Request，合并到 `master`；
8. 合并后由 Cloudflare 的构建/发布流程执行 `npm run build` 并发布 `./dist`；需要手动发布时，本地 `npm run build` 后执行 `npx wrangler deploy`。

## 5. 内容质量规范

鼓励：

- 明确的问题与可执行的解决方案；
- 真实案例、可复算的成本算例（引用站点成本计算器的口径）；
- 官方来源（厂商文档、定价页、规范），并在 `sources` 中标注访问日期；
- 与站内其他文章/工具的内链（`relatedArticles` 或正文相对链接）。

禁止：

- 为增加页面数量而批量生产低质量文章；
- 重复已有文章、与现有指南内容高度重叠；
- 编造数据、价格、来源或访问日期；
- 发布未经核实的模型价格（模型价格唯一事实源是 `public/assets/data/models.json`）；
- 关键词堆砌、无实质信息的 SEO 填充内容。

## 6. 常见构建错误

| 报错 | 原因与处理 |
|---|---|
| `title 不能为空` / `description 不能为空` | Frontmatter 缺失或空白 |
| `updatedAt 不能早于 publishedAt` | 日期写反，修正日期 |
| `必须是合法的 http/https URL` | `sources[].url` 不是合法链接 |
| `封面必须是 /assets/ 或 /images/ 下的本地图片路径` | `cover.src` 写成了外链或相对路径 |
| `translationKey 只允许小写英文/数字/连字符` | key 含大写/空格/中文 |
| `文件名不符合 slug 规范` | 文件名含中文/空格/大写，或放进了子目录 |
| `与已有静态页面路径冲突` | slug 与既有 Astro 指南页同名，换一个 slug |
| `同语言 translationKey 重复` | 同语言有两篇用了同一个 key |

## 7. 检查项速查

`npm run check` 会先构建、再串行执行全部静态检查，其中与内容直接相关的：

- `check-content`：清单结构、路由生成、草稿排除、sitemap/lastmod、canonical/robots/hreflang、目录锚点、来源与相关文章链接、首页收录、全站静态资源 404；
- `check-sitemap-lastmod`：sitemap 与清单逐条一致（含文章 updatedAt）；
- `check-i18n` / `check-en-pages`：中英路由、hreflang 与 canonical 一致性。
