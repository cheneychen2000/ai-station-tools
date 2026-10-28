# 工具详情页索引审核报告

生成：2026-10-28，由 scripts/audit-tool-pages.mjs 对 dist/ 实际页面与 tools.json 逐条核验（可重复执行）。

## 审核规则

- 自研工具（own:true，5 个）：不生成独立详情页，其功能模块页（/cost/、/models/、/compare/、/quiz/、/prompts/）具备真实可用功能与方法说明，正常索引。
- 第三方工具详情页（12 个）：当前内容仅为 标语 + 分类 + 适用场景 + 收费模式 + 官网链接 + 核验日期，属目录级信息，无独立评测价值 → 逐项审核结论均为 `indexable: false`（已显式写入 tools.json），页面输出 `noindex,follow` 并从 sitemap 移除。
- 不删除 URL、不隐藏入口：页面仍可通过 /tools/ 工具库正常访问，canonical 保持自引用（不指向无关页面）。
- 恢复索引条件：为该工具补充真实、经核验的独立内容（如 summary / bestFor / notFor / pros / limitations / pricingUrl / editorialReviewedAt 等）后，将 tools.json 中该项 indexable 置为 true 并重跑 build + 全部检查。禁止凭空编造优缺点、实测结果或评价。

## 逐页审核结果

| # | 工具 | URL | 独立扩充内容 | robots | sitemap | 处置 |
|---|---|---|---|---|---|---|
| 1 | DeepSeek | https://www.reflex-hub.com/tools/deepseek-chat/ | 无（仅目录级字段） | noindex,follow | 排除 | 不开放索引（薄页，保留用户访问） |
| 2 | Kimi | https://www.reflex-hub.com/tools/kimi/ | 无（仅目录级字段） | noindex,follow | 排除 | 不开放索引（薄页，保留用户访问） |
| 3 | 豆包 | https://www.reflex-hub.com/tools/doubao/ | 无（仅目录级字段） | noindex,follow | 排除 | 不开放索引（薄页，保留用户访问） |
| 4 | 即梦 AI | https://www.reflex-hub.com/tools/jimeng/ | 无（仅目录级字段） | noindex,follow | 排除 | 不开放索引（薄页，保留用户访问） |
| 5 | Midjourney | https://www.reflex-hub.com/tools/midjourney/ | 无（仅目录级字段） | noindex,follow | 排除 | 不开放索引（薄页，保留用户访问） |
| 6 | 可灵 AI | https://www.reflex-hub.com/tools/kling/ | 无（仅目录级字段） | noindex,follow | 排除 | 不开放索引（薄页，保留用户访问） |
| 7 | Sora | https://www.reflex-hub.com/tools/sora/ | 无（仅目录级字段） | noindex,follow | 排除 | 不开放索引（薄页，保留用户访问） |
| 8 | Cursor | https://www.reflex-hub.com/tools/cursor/ | 无（仅目录级字段） | noindex,follow | 排除 | 不开放索引（薄页，保留用户访问） |
| 9 | GitHub Copilot | https://www.reflex-hub.com/tools/github-copilot/ | 无（仅目录级字段） | noindex,follow | 排除 | 不开放索引（薄页，保留用户访问） |
| 10 | 通义灵码 | https://www.reflex-hub.com/tools/tongyi-lingma/ | 无（仅目录级字段） | noindex,follow | 排除 | 不开放索引（薄页，保留用户访问） |
| 11 | WPS AI | https://www.reflex-hub.com/tools/wps-ai/ | 无（仅目录级字段） | noindex,follow | 排除 | 不开放索引（薄页，保留用户访问） |
| 12 | 讯飞听见 | https://www.reflex-hub.com/tools/iflyrec/ | 无（仅目录级字段） | noindex,follow | 排除 | 不开放索引（薄页，保留用户访问） |

## 汇总

- 第三方详情页 12 个：noindex 12 / 可索引 0。
- 自研工具 5 个：无独立详情页，功能模块页正常索引。
- 审核异常 0 项。
