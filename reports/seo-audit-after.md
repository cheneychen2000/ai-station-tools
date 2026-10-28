# SEO / GEO 审计报告（修改后）

日期：2026-10-28
仓库：`C:\Users\cc\WebProjects\ai-station-tools`（master 分支；未执行 git push / 生产部署 / DNS / Cloudflare 控制台任何操作）
修改前问题清单见 `reports/seo-audit-before.md`。

## 1. 修改总览

| 阶段 | 内容 | 状态 |
|---|---|---|
| A 工程可靠性 | 公共路径模块、统一断言报告器、转义/URL/JSON-LD 安全、对比页平局逻辑 | 完成 |
| B 静态内容 | /models/、/tools/ 卡片构建期静态化；/cost/ 静态成本参考表 + 可见 FAQ；sitemap 真实 lastmod | 完成 |
| C 索引策略 | 66 对比页逐页审计（全保留索引）；12 第三方工具薄页 noindex,follow + 移出 sitemap | 完成 |
| D GEO 与合规 | 页脚全静态；robots 保留原策略并记录依据；缓存策略评审（未改）；联盟 schema 预留 | 完成 |
| E 验收 | 构建 + 11 个检查/审计脚本全部零失败（97 项断言 + 66 页逐页审计） | 完成 |

## 2. 具体修改

### 2.1 工程可靠性（P0）
- 新增 `scripts/lib/paths.mjs`（仓库根/dist/reports/SITE/BRAND 唯一来源）、`pricing.mjs`（月成本公式与 /cost 计算器**唯一公式来源**）、`escape.mjs`（esc/safeUrl/jsStr/jsonld）、`report.mjs`（PASS/FAIL/WARN/NOT RUN 四态报告器，FAIL 即 `process.exitCode=1`）。
- `check-build.mjs` 全面重写：B1~B15 共 26 项真实断言（原 9 项只打印布尔值）。
- `selftest.mjs` 重写：T1~T11 共 32 项断言（原版本全部布尔打印无退出码）。
- 5 个脚本（check-domain/check-inline-js/check-emoji/check-brand + check-build）删除硬编码 `C:/Users/cc/...`，全部从脚本位置推导仓库根，任意 cwd/其他机器可复现。
- 脆弱测试修正：B5/B5b 动态取样（不再写死 glm-53-flash/qwen38-flash）；B4 改用共享页面清单计数（`scripts/lib/manifest.mjs`）；T3 去掉写死的统一核验日期，改为合法日期格式断言；幂等测试保留。
- 转义机制：build.mjs 所有动态插值（title/description/og/正文/链接）经 `esc()`；外部 URL 经 `safeUrl()` 仅放行 http/https（拦截 `javascript:`）；JSON-LD 经 `JSON.stringify + <转义` 防 `</script>` 闭合（B14 三项断言）。

### 2.2 对比页平局逻辑（P0）
- `verdict()`：展示精度（0.01 元，EPS=0.005）内相同 → 持平，两侧均不标 win 并显示"（持平）"；摘要区明确"持平"结论。
- /cost 交互计算器同口径：全部相同 → "估算月成本持平"；部分并列 → 双双标"并列最低/最便宜"；原"性价比首选"badge 改为事实口径"该用量下成本最低"（不再暗示质量结论）。

### 2.3 结构化数据准确性（P1）
- 模型详情页移除 `SoftwareApplication.offers`（输入单价≠软件购买价，保留 name/vendor/url/sameAs 官方来源/描述/面包屑）。
- 工具详情页仅"免费"工具输出 `Offer price=0`；freemium/付费不再被错误表示为免费。
- /cost 新增与 FAQPage JSON-LD 完全一致的**可见**常见问题区（B15 断言）。

### 2.4 静态内容（P0）
- `/models/`：卡片由 build.mjs 注入 `MODEL_CARDS_START/END` 标记区，原始 HTML 直接含 12 款模型名称/厂商/价格摘要/上下文/核验日期/详情链接；删除客户端 fetch 建卡脚本。
- `/tools/`：分组卡片注入 `TOOL_GROUPS_START/END`（自研置顶、"本站自研工具"分组保留），`data-tool` 标记保留仅用于埋点委托；自研卡片仍链功能页、外部卡片仍链详情+官网。
- `/cost/`：交互控件附近新增"默认用量下的模型月成本参考"静态表（模型/厂商/输入价/输出价/缓存价/估算月成本/核验日期/官方来源链接 + 完整口径说明），公式与交互计算器同源（`pricing.mjs`），缓存价未公开按未命中价计。
- 全站页脚静态化：`FOOTER_START/END` 标记区由 build.mjs 注入（来源链接、最近核验日期摘要并注明"以对应页面标注为准"、免责声明、商标声明、关于本站）；`app.js` 的 fetch 页脚渲染删除，JSON 加载失败不再影响页脚。

### 2.5 sitemap 真实时间（P0）
- 新增 `dist/assets/data/pages.json`：手写页 `contentUpdatedAt` 元数据（初始值取各页 git 最后内容提交日期，修改正文时手动维护）。
- lastmod 规则（`manifest.mjs`，check-sitemap-lastmod S9 逐条断言）：模型详情=该模型 verifiedAt；对比页=两模型 verifiedAt 较大者；/cost/、/models/、/tools/（声明依赖数据）=手写日期与数据 verifiedAt 较大者；其余手写页=pages.json 日期；**构建日期不再出现在任何 lastmod**；连跑构建产物逐字节不变（B1）。
- sitemap 98 → 86 条：12 个第三方工具薄页移出（见 2.6）；URL 去重、域名规范、页面真实存在、noindex 排除均有断言。

### 2.6 索引策略（P1）
- 66 对比页逐页审计（`reports/compare-page-audit.md`）：硬指标全过（标题/描述/H1 含正确比较对象、canonical a<b 归一自引用、示例成本与公式一致、官方来源、固定参数说明、摘要、双向内链、无异常 noindex、平局不误标）；处置：全部保留索引——理由为两两存在可核验的真实数据差异（价格/上下文/模态），且页面提供参数表+可复核成本结论+来源，能支持比较决策。**未**批量 noindex、**未**统一 canonical 到 /compare/、未虚构搜索量。
- 12 个第三方工具详情页（`reports/tool-page-audit.md`）：当前内容仅 标语+分类+场景+收费模式+官网链接+核验日期（目录级薄页），逐项审核结论 `indexable:false` 显式写入 tools.json → 页面输出 `noindex,follow`、移出 sitemap、保留 canonical 自引用与用户访问/内链；不删除 URL。恢复索引条件：补充真实可核验独立内容（summary/bestFor/pros/limitations/pricingUrl/editorialReviewedAt）后置 `indexable:true` 重跑 build；禁止编造评测内容。
- 自研工具 5 个不生成薄详情页（功能模块页本身即内容页，正常索引）。
- 对比页内容增强：每页新增"对比摘要（固定用量口径）"（月成本差额与更低方/持平、低谷口径输入输出单价差、缓存价口径说明、上下文倍率、模态差异、来源与核验日期）+ 固定口径声明（不代表能力/质量/性价比排名，不构成采购建议）。全部为 models.json 可直接推导的事实，未机械堆砌同构 SEO 文案。

### 2.7 GEO 与合规（P1）
- robots.txt：**原样保留**（Googlebot/Bingbot/百度/GPTBot/OAI-SearchBot/ClaudeBot/PerplexityBot/Bytespider/Google-Extended 放行策略未动）；搜索检索与训练用途的区分说明与"新增搜索专用 UA 前先核官方文档"列入 `data-review-queue.md`。未新增 llms.txt（sitemap+静态 HTML 已能完整表达站点信息，无额外维护收益）。
- 关键页面正文（/cost/、/models/、对比页、模型详情）现在全部存在于原始 HTML，含完整口径、来源与边界说明，可直接被搜索与 AI 抓取引用。
- `_headers` 评审结论（未修改）：data 5min / assets+HTML 1h + nosniff/Referrer-Policy/X-Frame-Options 保持合理。当前价格类内容已全部静态进 HTML，数据 JSON 仅服务交互功能（计算器/选择器/测验），两者由同一次 build 产出并一起部署，5min 数据缓存不会造成"新 HTML 读旧数据"的持久不一致；浏览器加载旧 JS + 新 HTML 的窗口已被 1h HTML 缓存同步覆盖。保留观察项见队列。
- 联盟营销：`dist/assets/data/partners.json` 建立 schema（id/name/category/officialUrl/pricingUrl/affiliateUrl/markets/status/verifiedAt，当前为空，无虚构合作项目）；`check-affiliates.mjs` 强制校验（ID 唯一、状态枚举、candidate 不得填 affiliateUrl、官方与联盟链接分离、无秘密字段）；披露与 `rel="sponsored"` 的页面规则已写入 README，正式接入时执行。

### 2.8 其他
- 全站标题唯一（99 页断言）；canonical 全部自引用且域名一致（URL 解析比对 origin，`www.reflex-hub.com.evil.example` 类前缀欺骗无法通过）；内部链接/外链/本地图片 0 死链。
- 模型详情页新增同厂商"相关对比"直达链接（有意义的两两互链，未机械堆砌）。
- compare 选择器保留交互 + 新增 noscript 降级说明（模型库/成本计算器入口）。

## 3. 验收测试结果（全部实际运行，2026-10-28）

| 脚本 | 结果 | 断言数 |
|---|---|---|
| build.mjs + check-build.mjs | 0 退出码 | 26 PASS / 0 FAIL |
| selftest.mjs | 0 退出码 | 32 PASS / 0 FAIL |
| check-inline-js.mjs | 0 退出码 | 180 脚本块 0 失败 |
| check-emoji.mjs | 0 退出码 | 0 emoji |
| check-domain.mjs | 0 退出码 | 4 PASS |
| check-brand.mjs | 0 退出码 | 6 PASS |
| check-sitemap-lastmod.mjs | 0 退出码 | 10 PASS |
| check-seo-pages.mjs | 0 退出码 | 10 PASS |
| check-affiliates.mjs | 0 退出码 | 3 PASS / 1 NOT RUN（无合作项目，如实标记） |
| audit-compare-pages.mjs | 0 退出码 | 66/66 硬指标通过 |
| audit-tool-pages.mjs | 0 退出码 | 12/12 索引状态一致 |

另验证（回归）：成本计算器错峰 2 倍关系、命中率 0=未命中价、QR 结构/往返/确定性、题库 schema/段位边界、quiz/prompts 等原有功能全部通过。`track()` 仍是无后端占位（dataLayer），未宣称为已实现统计。

## 4. 交付物清单

- 修改：scripts/{build,check-build,check-domain,check-inline-js,check-emoji,check-brand,selftest}.mjs、dist/{index,cost/index,models/index,compare/index,quiz/index,tools/index,prompts/index,about/index}.html、dist/assets/app.js、dist/assets/data/tools.json、README.md，及全部 90 个生成页。
- 新增：scripts/lib/{paths,pricing,escape,report,manifest}.mjs、scripts/{check-sitemap-lastmod,check-seo-pages,check-affiliates,audit-compare-pages,audit-tool-pages}.mjs、dist/assets/data/{pages.json,partners.json}。
- 报告：reports/{seo-audit-before.md, seo-audit-after.md（本文件）, compare-page-audit.md, tool-page-audit.md, data-review-queue.md}。

## 5. 未完成的人工验证（详见 data-review-queue.md）

1. 在线结构化数据验证（Google Rich Results Test / Schema.org Validator）——本地无外部工具，未执行。
2. Search Console 数据未提供——对比页真实搜索表现无法评估，本报告不含任何排名/搜索量断言。
3. 模型价格复核（全部 verifiedAt=2026-09-18，已超一个月）+ Kimi/混元/M3/Step 上下文待确认项。
4. robots.txt 新增搜索专用 UA（如 Claude-SearchBot）前需人工核对官方文档。
5. 部署前本地预览人工核对视觉与交互；部署后 Search Console 重提 sitemap（86 条）+ 真机回归。

## 6. 生产部署前步骤

1. `npx serve dist` 人工核对（模型/工具卡片样式、成本表、FAQ、对比摘要、页脚、计算器持平展示）。
2. 全部 11 个检查脚本在干净环境重跑（已在 Windows/PowerShell 全绿；脚本零硬编码路径，Linux/macOS/CI 可复现）。
3. git commit + 部署（用户操作，本次未执行）。注意部署后 `dist/_headers`、`robots.txt`、sitemap 由 git 仓库直接发布。
4. 部署后：Search Console 提交 sitemap、抽查 noindex 工具页 meta、真机回归清单（data-review-queue §四）。
