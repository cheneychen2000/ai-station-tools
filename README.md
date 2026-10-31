# Reflex Hub

**大模型 API 成本与模型选型工具**

Reflex Hub 是一个给开发者和 AI 应用构建者用的小工具站：估算大模型 API 的调用成本、查公开价格与参数、比较候选模型，顺便整理日常会用到的 AI 工具和提示词。

免费使用，无需注册。价格与规格尽量附上官方来源，方便你自己核对一遍。

**🌐 [访问 Reflex Hub](https://www.reflex-hub.com/)**

## 站内能做什么

**成本计算器** — 按调用量、输入输出 Token、缓存命中率与计费时段，估算不同模型的月度费用。
[打开计算器](https://www.reflex-hub.com/cost/)

**模型库** — 看公开单价、上下文窗口、支持模态与官方数据来源，每条都标了核验日期。
[浏览模型库](https://www.reflex-hub.com/models/)

**模型对比** — 两款候选并排看价格、规格与估算成本，辅助技术选型。
[开始比较](https://www.reflex-hub.com/compare/)

**更多工具** — [AI 工具目录](https://www.reflex-hub.com/tools/)、[Prompt 资源库](https://www.reflex-hub.com/prompts/)、[AI 认知测试](https://www.reflex-hub.com/quiz/)。

## 数据与口径

模型价格、参数与服务能力会变，所以我们尽量把判断依据摊开：

- **来源可查**：重要数据尽量对应厂商公开资料，并标注核验日期。
- **口径写明**：成本估算会说明调用量、Token 用量与其他假设，你可以逐项改。
- **不确定就标不确定**：未公开或无法可靠核实的数据不会被当成确定事实。
- **独立整理**：收录某个模型或工具，不代表它获得官方背书。

计算结果仅供参考，不等于服务商实际账单，也不构成采购建议。生产环境或商业采购请以服务商当前的正式价格、合同与条款为准。

## 适合谁

正在选大模型 API 的开发者；需要估算调用成本的独立开发者与小团队；想比较参数差异与使用限制的 AI 应用构建者；以及需要快速找工具、找提示词的用户。

## 独立性

Reflex Hub 独立维护，不代表任何模型厂商或第三方工具供应商。第三方产品名称与商标归各自所有者所有。站内判断以可核验的官方信息与公开参数为基础，编辑结论与外部关系无关。

## 项目说明

站点是纯静态输出，托管在 Cloudflare（Workers Static Assets）。技术栈为 Astro 静态构建 + 原生 TypeScript，不引入前端 UI 框架。

```bash
npm ci                 # 安装依赖（Node 22+）
npm run dev            # 本地预览
npm run build          # 构建到 dist/
npm run build:compat   # 本地兼容构建（剥离 IDE 垫片并清理中间目录）
npm run check          # 构建 + 全部静态检查
npm run check:types    # 类型检查
npm run check:content  # Markdown 内容体系检查
```

### 内容更新

指南类文章用 Markdown 维护：新建 `src/content/guides/zh-CN/<slug>.md`（英文对应 `src/content/guides/en/<slug>.md`），填好 frontmatter 即可，路由、页面结构、SEO、目录与 sitemap 自动生成。`draft: true` 的文章只在本地可见，不会进入生产构建。

字段说明、写作规范与常见报错见 [`docs/content-authoring.md`](docs/content-authoring.md)，内容体系的设计取舍见 [`docs/content-system-design.md`](docs/content-system-design.md)。

含数据表的复杂指南页仍以 Astro 页面维护，两类内容共用同一套布局与 SEO 规范。

### 目录速览

- `src/pages/`：页面路由与静态端点（sitemap、派生数据）
- `src/layouts/`、`src/components/`：布局、SEO 与可复用组件
- `src/lib/`：数据访问、成本公式与 sitemap 规则等业务逻辑、语言映射
- `src/content/`：Markdown 文章
- `public/`：图标、数据 JSON、`robots.txt`、`_headers` 与独立运行库
- `dist/`：构建产物，不入库，由构建流程生成

模型价格与参数只有一份事实来源：`public/assets/data/models.json`。

部署走 Cloudflare 的构建/发布流程：构建 `npm run build`，产物目录与 404 处理由 `wrangler.jsonc` 指定。

仓库未附开源许可证：代码公开可见，不代表获得复制、修改与再分发授权。不要把 API 密钥、账号凭证或私人合同提交到仓库与部署目录。

## 反馈

价格、参数、来源或计算结果有问题，欢迎提 Issue：[github.com/cheneychen2000/ai-station-tools/issues](https://github.com/cheneychen2000/ai-station-tools/issues)。请附上页面 URL 与可核验的官方来源；不要在公开 Issue 里贴 API 密钥或其他敏感信息。

## English

Reflex Hub is a free toolkit for developers working with LLM APIs: estimate monthly cost, look up public pricing and model specs, and compare candidates. Sources are linked, assumptions are stated, and unknown values are marked as unknown rather than guessed.

No account required. **Website:** https://www.reflex-hub.com/
