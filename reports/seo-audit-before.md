# SEO / GEO 审计报告（修改前基线）

日期：2026-10-28
仓库：`C:\Users\cc\WebProjects\ai-station-tools`（master 分支，与 origin/master 同步；工作区既有未提交改动：`.gitignore` 增加 `*提示词.md`，以及本次任务首次基线构建导致的 `dist/sitemap.xml` lastmod 刷新）
站点：https://www.reflex-hub.com （AI七号驿站 / Reflex-Hub）

## 1. 实际架构确认（以代码为准）

- 纯静态零框架：手写 HTML/CSS/JS，`dist/` 既是源文件目录也是部署目录（Cloudflare Pages 输出目录）。
- `scripts/build.mjs`：读取 `dist/assets/data/models.json`（12 款模型）与 `tools.json`（17 条：5 自研 + 12 外部），生成 12 模型详情页 + 66 对比页 + 12 工具详情页 + `sitemap.xml`（98 条 URL）。生成前清理 `dist/models/`、`dist/compare/`、`dist/tools/` 的子目录（保留各目录手写的 `index.html`）。
- 校验脚本 5 个：`check-build.mjs`（B1~B9）、`selftest.mjs`（T1~T11）、`check-inline-js.mjs`、`check-emoji.mjs`、`check-domain.mjs`；另有 `check-brand.mjs`。
- `dist/assets/app.js`：`track()` 埋点占位（无后端）+ CF Analytics 占位加载器（`CF_ANALYTICS_TOKEN` 为空，符合决策）+ 页脚渲染（fetch models.json）。
- 无 `package.json`、无 `src/`、零依赖。README 与代码一致（README 称 98 个 URL，与实际构建输出一致）。

## 2. 基线测试结果（全部实际运行）

| 命令 | 结果 |
|---|---|
| `node scripts/build.mjs` | 成功：12 model + 66 compare + 12 tool = 90 页，sitemap 98 urls |
| `node scripts/check-build.mjs` | 退出码 0；B1~B9 全部打印 true |
| `node scripts/selftest.mjs` | 退出码 0；T1~T11 全部打印 true |
| `node scripts/check-inline-js.mjs` | 退出码 0；181 个内联脚本块，0 失败 |
| `node scripts/check-emoji.mjs` | 退出码 0；无 emoji |
| `node scripts/check-domain.mjs` | 退出码 0；canonical 98 + og:url 98 + sitemap 98 域名全部一致 |

## 3. 确认存在的问题（按提示词章节）

### P0 工程可靠性
1. **硬编码 Windows 路径**：`check-build.mjs`、`check-domain.mjs`、`check-inline-js.mjs`、`check-emoji.mjs`、`check-brand.mjs` 均写死 `C:/Users/cc/WebProjects/ai-station-tools`（check-brand 还用了 cmd `dir /S /B`，仅 Windows 可跑）。
2. **检查只打印不拦截**：`check-build.mjs` 全部检查只 `console.log` 布尔值，失败仍退出码 0（实测：脚本无 `process.exit` 非零路径）；`selftest.mjs` 同样全部打印布尔值，T4/T9 虽有 FAIL 打印但不影响退出码。`check-domain.mjs` / `check-inline-js.mjs` / `check-emoji.mjs` 有真实退出码。
3. **脆弱硬编码测试**：B5/B5b/B9 写死模型 ID `glm-53-flash` 与固定 pair `glm-53-flash/qwen38-flash`；B4 用固定公式 `2+1+N+1+PAIRS+1+1+T+1+1` 计 sitemap 数量，页面增减会误报。
4. **HTML 插值未转义**：`build.mjs` 模板字符串直接插值模型/工具数据到 title、meta description、og 标签、crumb、正文；外部 URL（sourceUrl、tool.url）无协议校验；JSON-LD 用 `JSON.stringify` 序列化但未防 `</script>` 提前闭合（当前数据干净，属机制缺失而非现役漏洞）。
5. **对比页平局逻辑错误**：`build.mjs` `compareDetail()` 用 `ca <= cb`，成本相同时仍把 A 标记为胜出（`class="win"`）。

### P0 客户端渲染依赖
6. `/models/`：`#modelList` 初始为空，fetch models.json 后 JS 建卡，初始 HTML 无任何模型内容。
7. `/tools/`：`#toolGroups` 初始为空，同样纯 CSR。
8. `/cost/`：模型选择网格与结果区纯 CSR，无静态成本参考内容。
9. 页脚（全站）：`#site-footer` 为空 div，核验日期与来源链接依赖 app.js fetch models.json；JSON 加载失败时缺核验日期与全部来源链接。

### P0 sitemap
10. `build.mjs` 用构建当天日期作为全部 98 条 URL 的 `lastmod`（实测：基线运行后全站 lastmod 从 2026-09-19 被刷为 2026-10-28），无语义、制造虚假更新信号。

### P1 结构化数据
11. 模型详情页 `SoftwareApplication.offers.price` = 输入价（每百万 Token 计费单价），把 API 计费单价错误表示为软件购买价格（实测 glm-53-flash 页 `"price": "0.8"`）。
12. 工具详情页非"付费"工具一律 `Offer price=0`，把 freemium（免费增值）错误表示为完全免费。
13. `/cost/` 有 `FAQPage` JSON-LD（3 条问答），但页面正文不存在对应的可见问答内容。

### P1 索引策略
14. 12 个第三方工具详情页内容仅为 标语+分类+场景+收费模式+官网链接+核验日期（薄页），当前全部可索引且全部进入 sitemap，无审核机制。
15. 无对比页逐页审计记录；无工具页索引审核记录。

### P1 其他
16. `robots.txt` 已放行 Googlebot/Bingbot/百度/GPTBot/OAI-SearchBot/ClaudeBot/PerplexityBot/Bytespider/Google-Extended；训练与搜索用途未分开注释说明。
17. `_headers`：data 5min / assets 1h / HTML 1h + 安全头，基本合理；待评估项见修改后报告。
18. 无联盟营销数据结构。
19. 页脚合规文字（免责声明/商标声明/关于本站）同样依赖 JS fetch 失败兜底路径才出现（tail 在 catch 中才有，成功路径拼在后面——实际两条路径都含 tail，但核验日期+来源在失败时丢失）。

## 4. 确认的既有优点（保留）

- canonical/og:url/sitemap/robots 域名全站统一（check-domain 实测 0 违规）。
- 对比页 URL 归一（a<b 排序，66 页全检通过）。
- 价格为 models.json 唯一数据源，cost 页脚本无价格字面量（T3b）。
- 构建幂等（B1 两次构建 hash 相同）。
- QR 生成器有往返 ECC 校验（T10）；题库/公式/数据完整性有测试。
- 404 页已 `noindex` 且不在 sitemap。
- emoji 全站清零有强制检查。

## 5. 检查范围

- 实际检查文件：`dist/` 99 个 HTML（1 首页 + 1 404 + 8 手写模块页 + 12 模型详情 + 66 对比 + 12 工具详情中抽查与全检结合）、4 个 JSON 数据文件、3 个 JS、robots.txt、sitemap.xml、_headers、8 个脚本、README。
- 未执行（环境限制）：Google Rich Results Test、Schema.org Validator、Search Console 数据、真实爬虫访问日志——本报告不包含任何排名/搜索量/收录断言。
