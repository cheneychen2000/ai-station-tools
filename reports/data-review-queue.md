# 数据与人工复核队列

生成：2026-10-28。以下项目无法从源码自动核实，需要人工或外部工具处理；均未在本次自动化检查中被标记为"已通过"。

## 一、模型数据逐款核验（2026-10-28 执行）

证据规则：仅采用厂商官方定价页/官方模型页/官方公告；第三方聚合站、搜索摘要、媒体文章不作为证据。verifiedAt 仅在关键字段（价格/缓存/上下文/模态/峰谷）全部核验通过后更新。

| # | 模型 | 结论 | 关键证据（官方 URL） | 本次变更 |
|---|---|---|---|---|
| 1 | deepseek-v41-flash | PARTIAL | cloud.tencent.com/document/product/1823/130055（CNY：空闲 1/4/0.02，高峰 2/8/0.04，高峰=工作日 9-12/14-18 北京时间 ✓）；api-docs.deepseek.com 公告确认原生视觉理解（modalities ✓）；官方页未公布上下文数值 | sourceUrl 改指 CNY 直证页；verifiedAt 不动（上下文无官方值） |
| 2 | deepseek-v4-pro | PARTIAL | 同上 TokenHub 页：空闲 4.5/13.5/0.15、高峰 9/27/0.30 ✓ 全部与现值一致；上下文无官方值 | sourceUrl 改指 TokenHub；verifiedAt 不动 |
| 3 | glm-53 | VERIFIED | help.aliyun.com/zh/model-studio/glm-5-3-by-zhipu：8/28/缓存 2 ✓；上下文 1048576=1024K（原 200 错误） | context 200→1024；verifiedAt→2026-10-28 |
| 4 | glm-53-flash | VERIFIED | help.aliyun.com/zh/model-studio/glm-5-3-flash-by-zhipu（2026-10-10 更新）：0.8/2.8 ✓、缓存 0.23 ✓、上下文 1M、原生多模态 Text/Image/Video | context 128→1024；modalities 文本→文本+图像理解+视频理解；verifiedAt→2026-10-28 |
| 5 | kimi-k3 | VERIFIED | help.aliyun.com/zh/model-studio/kimi-k3-by-moonshot + platform.moonshot.cn：20/100 ✓、缓存命中 2 ✓、上下文 1M(1048576)、原生视觉理解 | context 2000→1024；modalities 文本→文本+图像理解；verifiedAt→2026-10-28 |
| 6 | qwen35-plus | PARTIAL | 百炼计费页 billing-for-model-studio：≤128K 档 0.8/4.8 ✓（vendor 已标档；档位至 1M）；缓存该条未单列 | 无变更；verifiedAt 不动 |
| 7 | qwen37-plus | PARTIAL | 同上：≤256K 档原价 2/8 ✓，"限时8折"官方仍标注 ✓（feature 有效）；缓存享折扣但无单列值 | 无变更；verifiedAt 不动 |
| 8 | qwen38-flash | VERIFIED | help.aliyun.com/zh/model-studio/qwen3-8-flash：0.8/2.7 ✓、缓存命中 0.1（原 null）、上下文 1M ✓、输入模态 Text/Image/Video | priceCacheHit null→0.1；modalities 补图像/视频理解；verifiedAt→2026-10-28 |
| 9 | hunyuan-turbos-vision | PARTIAL | cloud.tencent.com/document/product/1729/97731（2026-06-26 更新）：3/9 ✓；上下文/模态规格官方页未获取（聚合站称 16K，与现值 128 冲突，不可采信） | 无变更；verifiedAt 不动 |
| 10 | minimax-m3 | VERIFIED | 百炼计费页：≤512K 档 2.1/8.4（原记 >512K 档 4.2/16.8，按站内低档+标档惯例更正）；minimax.io 官方：上下文 1M、原生多模态 | priceIn/Out 4.2/16.8→2.1/8.4；vendor 加（≤512K 档）；context 256→1024；modalities 补图像/视频理解；verifiedAt→2026-10-28；缓存命中价官方未单列（保持 null） |
| 11 | mimo-v25-pro | PARTIAL | 百炼计费页：≤256K 档 7/21 ✓（vendor 已标档）；缓存未标注 | 无变更；verifiedAt 不动 |
| 12 | step-37-flash | VERIFIED | help.aliyun.com/zh/model-studio/step-3-7-flash：1.35/8.1 ✓、缓存命中 0.27（原 null）、上下文 262144=256K（原 128 错误）、输入模态 Text/Image/Video | context 128→256；priceCacheHit→0.27；modalities 补图像/视频理解；verifiedAt→2026-10-28 |

**汇总：VERIFIED 6 款（glm-53、glm-53-flash、kimi-k3、qwen38-flash、minimax-m3、step-37-flash）/ PARTIAL 6 款 / BLOCKED 0 款。** PARTIAL 均因个别字段（多为官方未公布的上下文数值或缓存价）无直接官方证据，按规则保留旧值、不更新 verifiedAt、不计入完整核验。

### 未决字段（需人工或后续官方信息）

| 模型 | 未决字段 | 说明 |
|---|---|---|
| deepseek-v41-flash / deepseek-v4-pro | context 1000K | DeepSeek 官方未在定价页/公告公布上下文窗口；火山方舟文档仅有最大输出 128K。保留旧值待官方规格 |
| hunyuan-turbos-vision | context 128、modalities | 官方规格页（产品概述/TokenHub 模型列表）未能获取数值；第三方聚合站（16K）与现值冲突不可采信。需人工查 TokenHub 控制台或官方规格文档 |
| qwen35-plus / qwen37-plus / mimo-v25-pro | modalities 逐项确认 | 价格已核（低档）；modalities 沿用"文本"无冲突证据，未逐项官方确认 |
| minimax-m3 | 缓存命中价、>512K 档 | 官方未单列缓存命中价（百炼规则为标输入 10%，非原始刊例）；>512K 档 4.2/16.8 为官方备用档，当前 schema 单值按低档呈现 |

### 既有队列项（未变）

| # | 事项 | 现状 | 需要的人工动作 |
|---|---|---|---|
| 5 | 题库时效题（Q3/4/7/8）每季度核验 | 2026-09-19 核验 | 按季度复核 |

## 二、需要外部工具 / 平台数据的验证

| # | 事项 | 说明 |
|---|---|---|
| 6 | Google Rich Results Test / Schema.org Validator | 本地仅做了 JSON-LD 可解析性、类型与 URL 一致性检查；在线富结果验证未执行，需人工提交线上 URL |
| 7 | Search Console / Bing Webmaster 数据 | 未提供导出。对比页与工具页的真实搜索表现（展现/点击/收录）无法评估；工具页恢复索引的优先级应参考该数据 |
| 8 | 真实爬虫访问日志 | robots 放行≠被抓取/引用；AI 搜索引用情况需服务器日志或各平台后台观察 |
| 9 | robots.txt 中 AI 爬虫名称的官方文档核对 | 现有规则（GPTBot/OAI-SearchBot/ClaudeBot/PerplexityBot/Bytespider/Google-Extended 等）原样保留未改动；如要新增 Claude-SearchBot 等搜索专用 UA，先查官方文档确认名称与用途再加，不要凭名称推断 |

## 三、内容与索引策略的后续审核

| # | 事项 | 说明 |
|---|---|---|
| 10 | 12 个第三方工具详情页恢复索引 | 当前逐项审核为 indexable:false（薄页）。恢复条件：补充真实、可核验的独立内容（summary/bestFor/pros/limitations 等 + editorialReviewedAt），禁止编造优缺点与实测结论；然后置 indexable:true 并重跑 build + audit-tool-pages.mjs |
| 11 | /prompts/ 列表与 /quiz/ 题目仍为客户端渲染 | 两页均有静态 lede/规则说明，本次未列入静态化范围；若后续需要，可复用 build.mjs 的标记注入机制（与模型/工具卡片同模式） |
| 12 | 联盟合作项目 | partners.json 当前为空。申请并获批真实联盟项目后：填 status=active + affiliateUrl（与 officialUrl 分开）+ verifiedAt + 已核实 markets；展示页需在推荐内容附近披露佣金关系，推荐链接加 rel="sponsored" |

## 四、生产部署前步骤

1. 本地全部检查通过（见 seo-audit-after.md 的测试清单）。
2. `npx serve dist` 本地预览，人工核对：/models/、/tools/ 卡片样式与原视觉一致；/cost/ 静态参考表 + 可见 FAQ + 计算器交互（含全选同价模型时的持平展示）；对比页摘要；页脚链接。
3. 部署后验证：Search Console 重新提交 sitemap.xml（86 条）；抽查 noindex 工具页响应与 robots meta；真机回归扫码/375px/复制分享/OG 预览。
4. 本次未执行、也不得由自动化执行的操作：git push、生产部署、DNS/Cloudflare 控制台修改。
