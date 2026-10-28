# 数据与人工复核队列

生成：2026-10-28。以下项目无法从源码自动核实，需要人工或外部工具处理；均未在本次自动化检查中被标记为"已通过"。

## 一、数据内容复核

| # | 事项 | 现状 | 需要的人工动作 |
|---|---|---|---|
| 1 | 全部 12 款模型 verifiedAt=2026-09-18 | 价格核验已超过一个月 | 按官方定价页重新核验价格/上下文/模态，更新 models.json 的 verifiedAt 后重跑 build |
| 2 | Kimi K3 上下文 2000K | README 已记录为待确认 | 查官方文档确认 |
| 3 | 混元 TurboS Vision / MiniMax M3 / Step 3.7 Flash 上下文为保守值 | README 已记录为待确认 | 查官方文档确认后更新 |
| 4 | qwen37-plus 特点含"限时8折" | 限时优惠信息有时效 | 复核活动是否仍有效，过期则改 features |
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
