---
title: "LLM API 成本治理实战：从请求优化到预算监控"
description: "把成本从月底才知道变成每个请求都知道：请求级成本记录、按用户与接口归因、与账单对账、预算三档熔断、异常检测与按难度路由的完整治理闭环。"
publishedAt: "2026-10-31"
updatedAt: "2026-10-31"
category: "cost-optimization"
tags:
  - 成本治理
  - 预算监控
  - 可观测性
draft: true
indexable: true
translationKey: null
sources:
  - title: "DeepSeek API Docs · Context Caching（usage 字段与命中/未命中拆分）"
    url: "https://api-docs.deepseek.com/guides/kv_cache"
    accessedAt: "2026-10-31"
  - title: "DeepSeek API Docs · Models & Pricing（按模型计费与峰谷时段）"
    url: "https://api-docs.deepseek.com/quick_start/pricing"
    accessedAt: "2026-10-31"
  - title: "OpenTelemetry GenAI Semantic Conventions（独立仓库）"
    url: "https://github.com/open-telemetry/semantic-conventions-genai"
    accessedAt: "2026-10-31"
  - title: "MDN · 429 Too Many Requests"
    url: "https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Status/429"
    accessedAt: "2026-10-31"
---

成本治理和成本估算是两件事。估算回答"大概要花多少"，治理回答"现在是不是花多了、是谁花多的、要不要拦住"。前者做一次，后者要一直做。

上线前算过一遍的项目，账单仍然经常超预期，原因通常不是算错了公式，而是**假设会漂移**：请求形态变了、功能加了重试、模型换代涨价、免费额度用完。任何一项漂移，估算就失效，而你没有机制发现它。

这篇讲的是机制。计费口径本身（输入输出分价、分档、峰谷、读写费）在 [如何计算 LLM API 成本](/guides/llm-api-cost/) 里，按业务场景做月成本估算在 [场景成本案例](/guides/llm-api-cost-examples/) 里，本文一律不重复。

## 一、三个漂移源

**请求形态漂移。** 上线三个月后，产品加了一个"自动总结"功能，输入从 2K 变成 12K；三个版本前的一次 Prompt 改版把 few-shot 从 2 条加到 6 条。这些改动都不会触发任何告警，但它们让单次成本翻了几倍。

**重试与循环。** 网关重试、SDK 自动重试、Agent 的多步循环，让"业务调用一次"和"上游处理 N 次"之间出现缺口。账单按后者算，你的日志按前者记——两边永远对不上。

**价格与档位。** 厂商调价、模型换代、以及"某次请求刚好越过档位边界"，都会改变单位成本。如果你的成本计算里把单价写死成常量，这些变化全部不可见。

## 二、请求级成本记录：先记对，再谈优化

治理的起点是**每个上游调用一条记录**，且记录里必须包含"当时用的价格"。这一点经常被省略：只记 Token 数和金额，事后无法解释金额是怎么来的，也无法重算。

```ts
/** 单价快照：价格的生效区间要一起存，否则历史记录无法复算 */
export interface PriceSnapshot {
  modelId: string;
  effectiveFrom: string;   // YYYY-MM-DD
  currency: 'CNY' | 'USD';
  inputPerMTok: number;
  outputPerMTok: number;
  cacheReadPerMTok: number | null;
  cacheWritePerMTok: number | null;
  /** 输入长度分档；tiers 为空表示不分档 */
  tiers?: Array<{ upToInputTokens: number | null; inputPerMTok: number; outputPerMTok: number }>;
}

export interface CostRecord {
  requestId: string;
  ts: string;
  tenantId: string;
  userId: string;
  feature: string;        // 业务归因：chat / summarize / extract / agent-step
  endpoint: string;
  modelId: string;
  price: PriceSnapshot;   // 关键：把当时的价格随记录一起存
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
  attempts: number;       // 含重试的真实上游请求次数
  status: number;
  latencyMs: number;
  aborted: boolean;
}
```

为什么要存价格快照：三个月后你回看"11 月 3 日那次请求为什么贵了 3 倍"，只有当时的单价和档位在记录里，才答得出来。把它存在明细记录里会占空间，折中是存 `modelId + effectiveFrom` 引用一张价格表——但那张价格表必须**只追加不修改**。

成本计算本身很简单，难点在于把分档和缓存写对：

```ts
export interface Usage {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens?: number;
  cacheWriteTokens?: number;
}

/** 返回原币金额；分档按“整次请求”判定，不是按超出部分分段累加 */
export function costOf(price: PriceSnapshot, usage: Usage): number {
  const tier = price.tiers?.find(t => t.upToInputTokens === null || usage.inputTokens <= t.upToInputTokens) ?? price.tiers?.[0];
  const inputRate = tier?.inputPerMTok ?? price.inputPerMTok;
  const outputRate = tier?.outputPerMTok ?? price.outputPerMTok;

  const hit = usage.cacheReadTokens ?? 0;
  const wrote = usage.cacheWriteTokens ?? 0;
  const missInput = Math.max(0, usage.inputTokens - hit - wrote);

  const cacheReadRate = price.cacheReadPerMTok ?? inputRate;   // 未公开缓存价时按未命中计，绝不当 0
  const cacheWriteRate = price.cacheWritePerMTok ?? inputRate;

  const inputCost = (missInput * inputRate + hit * cacheReadRate + wrote * cacheWriteRate) / 1_000_000;
  const outputCost = (usage.outputTokens * outputRate) / 1_000_000;
  return inputCost + outputCost;
}
```

两处容易写错的地方：档位判定用的是**整次请求的输入长度**，越档后整次按高档算（不是超出部分才算高档）；未公开的缓存价必须回退到未命中价，按 0 计算会得出一个偏低的假成本，进而让所有优化决策建立在错误数据上。

## 三、归因：维度比精度重要

"这个月花了多少钱"没有行动价值，"哪个租户、哪个功能、哪个模型花的"才有。五个有用的归因维度：

| 维度 | 能回答的问题 | 注意 |
|---|---|---|
| 租户 / 用户 | 谁在消耗，定价与配额是否覆盖成本 | 用户数是高基数，别直接当指标标签 |
| 功能（feature） | 哪个功能在烧钱，值不值得保留 | 需要调用方显式传入，不能靠推断 |
| 模型 | 换模型的收益核算 | 同一请求重试跨模型时要分别记 |
| 接口 / 端点 | 哪个 API 被滥用或重试 | 与 feature 不一定一一对应 |
| 单次请求 | 长尾是谁（P99 成本请求） | 用来找异常，不用于长期趋势 |

高基数是最常见的实现错误：把 `userId` 直接打成时序数据库标签，几个月后指标基数爆炸，查询慢到不可用。正确做法是分两层——**明细表**（可含 userId，用于事后钻取与对账）与**聚合指标**（只按租户、功能、模型聚合，基数可控）。

## 四、和账单对账：差异只可能来自六处

每月做一次三方对账：**响应里的 usage 汇总**、**你自己算的成本**、**厂商账单**。三者不一致时，差异按下面的顺序排查，能覆盖绝大多数情况：

1. **未记录的上游调用**：重试、SDK 内部重试、运维手工调用、压测流量。特征是"账单 > 你的记录"，且差额平摊在所有模型上；
2. **失败但仍计费**：返回 4xx/超时，但上游已生成部分内容。特征是差额集中在错误率高的时段；
3. **缓存写入费**：部分厂商对写入缓存单独计价，而你的计算只算了读取；
4. **分档判定错误**：你把长请求按低档算了，或厂商按"提示 + 期望输出"判定档位，而你只看了实际输入；
5. **免费额度、资源包与折扣**：账单已经扣减，你的记录是刊例价。特征是"账单 < 你的记录"，差额与活动时间吻合；
6. **币种与汇率**：美元计价的模型，你按上月汇率折算，账单按结算日汇率。差额很小但会累月出现。

把这六类做成固定的核对清单，比每月从零排查高效得多。第一类最值得开工单：如果"重试造成的浪费"占总成本 15% 以上，修好它比换模型收益更大。

## 五、预算：三档而不是一刀切

"超预算就拒绝服务"在生产上通常不可接受——用户会投诉，而且往往在最不该拒绝的时候（月末流量高峰）触发。可行的做法是三档阶梯：

| 档位 | 触发 | 动作 |
|---|---|---|
| 预警 | 达到预算 80% | 通知负责人 + 打点，不改变行为 |
| 降级 | 达到预算 100% | 切到更便宜的模型、关掉非核心功能（自动摘要、扩写）、缩短最大输出 |
| 拒绝 | 达到预算 150% 或触发硬上限 | 拒绝新请求，返回明确提示 |

降级这一档是整套机制的支点：它让系统在超支时仍然可用，只是体验降一档。没有降级能力的团队，最终只能在"继续烧钱"和"直接宕机"之间二选一。

预算的作用域要分三层，任一命中即触发：

- **用户/租户级**：防止单个用户刷爆。这是最常见的需求，也最容易做（每请求检查一次计数器）；
- **接口级**：防止某个高成本接口被滥用，尤其是开放给别人调用的接口；
- **全局级**：最后一道保险，按日与按月各设一个。

实现上有一个必踩的坑：计数必须**原子**。多实例部署时用 `GET` 再 `SET` 会丢计数，导致实际消耗远超预算；用 Redis 的原子自增（`INCRBY`）或数据库的条件更新（`UPDATE ... WHERE used < limit`）。

## 六、异常检测：用"同期的自己"当基线

绝对阈值不好用（业务在增长，阈值得跟着调），相对基线更稳：**和上周同一天、同一小时的中位数比**。

```ts
export interface DailyCostPoint { date: string; cost: number }

/** 返回当天的异常倍数；样本不足时返回 null，不做判断 */
export function anomalyRatio(today: number, baseline: number[]): number | null {
  if (baseline.length < 7) return null;
  const sorted = [...baseline].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const median = sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
  if (median <= 0) return null;              // 基线为 0 时任何倍数都无意义
  return today / median;
}
```

三个实用规则：

- **倍数阈值分级**：2 倍记入日报，5 倍触发告警，10 倍进入应急流程。分级的目的是避免"每次都告警、最后没人看"；
- **同时看总量与单量**：总量涨可能只是用户涨了；**单位成本**（每千次请求、每活跃用户）涨才是真正的效率退化。两个指标一起看，才能区分"业务增长"与"效率下降"；
- **按维度下钻**：全局 2 倍通常来自某一个租户或某一个功能。检测到异常后自动拉 top-5 贡献者，比看总量曲线有用得多。

## 七、按难度路由：成本与质量必须联合评估

把请求分成"简单 / 一般 / 复杂"三档，简单档走便宜模型、复杂档走旗舰模型，是成本治理里收益最直接的手段之一。但这条路有两个失败模式：

**失败模式一：分类器错了，答案质量崩了。** 用关键词或长度做分类都很脆弱（"帮我写一封投诉信"字很短但很难）。可行的做法是用小模型做一次低成本分类，或者在调用前用几个信号（是否带附件、是否需要多步、输出长度要求）综合判断。

**失败模式二：没有质量兜底。** 路由决策不能只有"成本更低了"这一个指标。至少要有一个回退通道：简单档的回答如果命中质量检查（格式不合法、拒绝回答、空结果），自动升级到高档重试一次。升级本身的成本是可控的，而"用户拿到坏答案"的成本不可控。

一个必须接受的事实是：**路由会把评估复杂度成倍提高**，因为你现在有两套质量分布。如果团队还没有质量测试集，先别上路由——先建立"这批请求对不对"的判定能力，再谈分级。

## 八、无效重试与 Agent 循环

这两件事在成本上等价：都在为同一段内容重复付费。

**重试侧**：给每个请求记 `attempts`，并设两个上限——单请求最多 N 次；全局重试率不超过 X%（比如 10%）。后者一旦突破，说明问题不是瞬时抖动，继续重试只会放大损失，此时应当降级或拒绝。

**Agent 侧**：`max_steps` 是必需品，另外两个信号值得监测——**平均步数**与**步数分布的长尾**。平均步数上升往往意味着提示词退化或工具变差；长尾（少数任务跑几十步）通常是循环，靠"连续相同工具调用"或"工具返回内容重复"检测。

去重也能省一笔：对规范化后的 Prompt 取哈希，短时间内相同哈希直接复用结果。规范化要做的事包括去掉时间戳、稳定工具定义顺序、统一空白——这三件事同时也是让前缀缓存生效的前提，两个收益可以叠加。

## 九、Dashboard 该显示什么

指标体系按三个时间粒度组织，比堆一屏曲线有用：

| 粒度 | 指标 | 用途 |
|---|---|---|
| 日 | 总成本、单位成本、请求数、错误率、重试率 | 发现异常 |
| 周 | 按租户/功能/模型拆分的成本、缓存命中率、P95 延迟 | 定位来源 |
| 月 | 成本与业务量比值、超额租户数、模型组合变化 | 决策与定价 |

三条设计原则：单位成本比总量更重要；每个指标都要能下钻到维度；同一个指标的口径（是否含重试、是否含缓存写、按刊例还是按实付）在页面上写清楚，否则两个人看同一张图会得出相反结论。

链路追踪上，OpenTelemetry 的 GenAI 语义约定仍在演进（已迁至独立仓库维护，属性名如 Token 用量、供应商名都调整过），落地时按版本对齐，并且**只采元数据不采正文**——把 Prompt 打进 span 属性，等于把成本系统变成泄漏源。

## 十、从开发环境到生产环境的治理流程

治理不是上线后才开始的事，四个环节都要有动作：

**开发阶段。** 本地跑批量任务时用独立的低额度 Key；把单次请求的成本打进开发日志，让"这次改动变贵了"在开发时就被看见。

**评审阶段。** 涉及 Prompt 或模型的改动，在 PR 里附一句"单次成本变化"（改前/改后各一个数）。这一条比任何规范都有效，因为它把成本变成和性能、测试一样的评审项。

**上线阶段。** 新功能默认带预算上限与降级开关；灰度期单独看这个功能的单位成本。

**运行阶段。** 每月做一次对账（第四节）与一次价格核对（厂商调价后回填价格表），每季度复核一次模型组合——不是"越换越便宜"，而是"当前组合是否仍匹配实际请求形态"。

## 十一、治理清单

- [ ] 每个上游调用有一条成本记录，含价格快照与 attempts；
- [ ] 明细表可按租户、功能、模型、接口钻取，聚合指标不含高基数标签；
- [ ] 每月对账，六类差异有固定排查顺序；
- [ ] 用户/接口/全局三层预算，都有原子计数实现；
- [ ] 预算有三档动作，降级档真的能降（有可切换的便宜模型与非核心功能开关）；
- [ ] 异常检测用同期中位数做基线，倍数阈值分级；
- [ ] 单位成本（每千次请求 / 每活跃用户 / 每任务）在 Dashboard 首屏；
- [ ] 重试有次数与比例双上限，Agent 有 max_steps 与循环检测；
- [ ] Prompt 或模型改动的 PR 附成本变化；
- [ ] 价格表只追加不修改，调价后有回填流程。

这张清单里最容易只做一半的是"预算"——很多团队做了告警，却没做降级，于是告警响了也只能看着。真正让成本可控的是降级能力：它把"超支"从一个事故变成一次体验降档。

<!-- 待 prompt-caching-optimization 与 agent-api-cost-estimation 发布后，在第八节补站内链接（当前均为草稿，发布前不得互链）。 -->
