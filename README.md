# Reflex Hub

**大模型 API 成本与模型选型工具**

Reflex Hub 为开发者与 AI 应用构建者提供免费的模型成本估算、公开价格查询和模型比较工具，帮助你在选择 AI 服务前了解费用、参数差异与使用限制。

**🌐 [访问 Reflex Hub 官网](https://www.reflex-hub.com/)**

免费使用 · 无需注册 · 数据来源可查

## 核心功能

### API 成本计算器

根据调用量、输入输出 Token、缓存命中率及计费时段等条件，估算不同模型的月度调用费用。

[打开成本计算器](https://www.reflex-hub.com/cost/)

### 模型资料库

查看模型的公开价格、上下文窗口、支持模态、主要特点和官方数据来源。

[浏览模型库](https://www.reflex-hub.com/models/)

### 模型对比

对比两款模型的公开参数与估算成本，了解它们的差异，辅助技术选型。

[开始比较模型](https://www.reflex-hub.com/compare/)

### 更多实用工具

- [AI 工具目录](https://www.reflex-hub.com/tools/)：发现不同场景下的 AI 应用。
- [Prompt 资源库](https://www.reflex-hub.com/prompts/)：查找并复制常用提示词。
- [AI 认知测试](https://www.reflex-hub.com/quiz/)：通过互动测试了解自己的 AI 知识水平。

## 我们重视数据的准确性

模型价格、参数和服务能力可能随时间变化。Reflex Hub 尽可能提供官方来源链接与数据核验日期，方便用户自行确认。

- **来源透明：** 重要模型数据尽可能对应厂商公开资料。
- **口径明确：** 成本估算会说明调用量、Token 用量与其他计算假设。
- **不确定性透明：** 未公开或无法可靠核实的数据不会被当作确定事实。
- **独立整理：** 收录第三方模型或工具不代表获得其官方背书。

计算结果仅供参考，不等于服务商实际账单，也不构成采购建议。对于生产环境或商业采购，请以服务商当前的正式价格、合同与服务条款为准。

## 适合哪些人？

Reflex Hub 主要面向：

- 正在选择大模型 API 的开发者。
- 需要估算模型调用成本的独立开发者与小型团队。
- 希望比较不同模型参数和使用限制的 AI 应用构建者。
- 需要快速查找 AI 工具与提示词的用户。

## 产品独立性与商业关系

Reflex Hub 独立维护，不代表任何模型厂商或第三方工具供应商。第三方产品名称与商标归各自所有者所有。

如果未来部分页面包含联盟推广或赞助链接，我们会在相应推荐内容附近明确说明商业关系。推荐内容应尽可能提供有助于决策的资料，并区分官方信息、可核验事实和编辑判断。

## 反馈与数据纠错

发现模型价格、参数、官方来源或计算结果存在问题，欢迎通过 GitHub Issues 提交反馈。

**[报告问题或提交数据纠错](https://github.com/cheneychen2000/ai-station-tools/issues)**

建议提供对应页面 URL、问题描述以及可核验的官方来源。请勿在公开 Issue 中提交 API 密钥、账号凭证或其他敏感信息。

## 项目说明

Reflex Hub 使用静态网页技术构建，并托管于 Cloudflare（Workers Static Assets，`wrangler deploy` 发布 `./dist`）。项目包含模型资料、互动计算工具和相关辅助资源。

### 技术栈与本地开发

站点使用 **Astro 7（静态输出）** 构建，页面为纯静态 HTML，交互是原生 TypeScript 经 Vite 打包的 Vanilla JS（不引入任何前端 UI 框架）。

```bash
npm ci                 # 安装依赖（Node ≥ 22.23.4）
npm run dev            # 本地预览（Astro dev server）
npm run build          # 标准构建（astro build → dist/）
npm run build:compat   # 本地兼容构建（带 IDE 垫片剥离与中间目录清理的包装）
npm run check          # 全量检查（构建 + 20 个检查/审计脚本）
npm run check:migrate  # 迁移回归：dist 与迁移前基线快照对拍（URL/SEO/资产契约）
npm run check:types    # astro check（TypeScript 零错误零警告）
npm run check:unit     # pricing 公式对拍单测（TS 实现 vs 检查脚本副本）
```

目录约定（Astro 原生架构）：

- `src/pages/`：页面路由 + 动态路由（`[id]`/`[a]/[b]`）+ 静态端点（`sitemap.xml.ts`、`assets/**` 派生资产）；
- `src/layouts/SiteLayout.astro`：统一 HTML 布局（head/导航/页脚/脚本位），SEO 经 `src/components/seo/`（SEOHead/JsonLd/Breadcrumbs）；
- `src/components/`：可复用 UI（common/model/compare/cost/tools/prompts/guide/placements/seo）；
- `src/content.config.ts` + `src/lib/data/`：Content Collections（models/tools/prompts，直接读取 `public/assets/data/*.json`）与统一数据访问层（Zod Schema 校验）；
- `src/lib/domain/`：纯业务逻辑（pricing 成本公式、manifest sitemap 规则、compare/model/tool 视图构建）；
- `src/lib/i18n/`：英文字典、语言路由映射（hreflang/语言切换唯一事实源）；
- `src/scripts/`：浏览器端 TypeScript 模块（app/cost-calculator/model-filter/compare/prompts/tools），Vite 打包为 `/_astro/*.js`；
- `src/styles/global.css`：全站样式（构建期打包，URL 由检查脚本定位）；
- `public/`：原样承接数据 JSON、favicon、`_headers`、`robots.txt` 与独立运行库（cost-core.js/qr.js/quiz.js，固定 URL 契约）；
- `dist/`：构建输出（Workers Static Assets 发布目录，当前随源码提交，切换为纯 CI 构建发布后可移出版本控制）；
- `migration/baseline-snapshot.json`：迁移前基线快照（URL + 每页 SEO 语义 + 资产哈希，`check:migrate` 对拍）。

模型价格、参数等事实数据只有一份：`public/assets/data/models.json`（Content Collection 构建期读取，同时作为公开 JSON 端点对外提供）。

部署：先 `npm run build` 让检查全绿，再 `npx wrangler deploy`（`wrangler.jsonc` 的 `assets.directory` 指向 `./dist`，404 由 `not_found_handling: "404-page"` 处理）。

仓库中的代码与网站部署内容并不等同于保密数据存储。不要将 API 密钥、账号凭证、私人合同或其他敏感信息提交到公开仓库或部署目录。

如仓库提供明确的许可证，请以该许可证规定的使用权限为准。公开可查看代码本身不代表自动获得无限制的复制、修改和再分发授权。

## English

Reflex Hub provides free tools for LLM API cost estimation, model pricing lookup, and model comparison. It emphasizes transparent sources, explicit calculation assumptions, and practical developer decision-making.

No account is required.

**Website:** https://www.reflex-hub.com/
