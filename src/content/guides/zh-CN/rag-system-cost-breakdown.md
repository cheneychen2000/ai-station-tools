---
title: "RAG 系统的真实成本构成：从 Embedding 到在线推理"
description: "把 RAG 的成本拆成一次性、周期性、离线增量与在线边际四层，给出可复核的量化公式与算例，并说明查询量变化时成本结构如何翻转。"
publishedAt: "2026-10-31"
updatedAt: "2026-10-31"
category: "case-study"
tags:
  - RAG
  - 成本估算
  - 向量检索
draft: true
indexable: true
translationKey: null
sources:
  - title: "pgvector · 官方仓库 README（HNSW 参数、构建内存与索引维护）"
    url: "https://github.com/pgvector/pgvector"
    accessedAt: "2026-10-31"
  - title: "DeepSeek API Docs · Models & Pricing（上下文长度与并发上限）"
    url: "https://api-docs.deepseek.com/quick_start/pricing"
    accessedAt: "2026-10-31"
---

"RAG 很便宜"这个印象通常来自一张算错的账：只算了在线推理的 Token，没算索引构建、向量存储、增量更新和运维。真实项目里，一个日查询几百次的知识库问答，**最大的支出往往不是模型，而是那套必须一直开着的向量库和检索服务**。

这篇不重复"某模型每次问答多少钱"。那种算法在 [场景成本案例](/guides/llm-api-cost-examples/) 里已经有了，它的视角是单次请求的 Token。这里把镜头拉远，看一个 RAG 系统完整的支出结构。

## 一、两条链路，四层成本

RAG 系统的支出分布在两条链路上：离线索引链路和在线查询链路。它们的时间尺度完全不同——索引是按周甚至按季度的大额一次性投入，查询是每秒都在发生的边际支出。

<figure style="margin:18px 0">
  <svg viewBox="0 0 700 280" role="img" aria-label="RAG 系统：离线索引链路与在线查询链路" style="width:100%;height:auto">
    <defs>
      <marker id="ragArrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
        <path d="M 0 0 L 10 5 L 0 10 z" fill="#8A93A5"></path>
      </marker>
    </defs>
    <text x="10" y="12" font-size="12" fill="#8A93A5">离线索引链路</text>
    <rect x="10" y="20" width="150" height="46" rx="8" fill="#F1F4F9" stroke="#C9D2E0"></rect>
    <text x="85" y="48" text-anchor="middle" font-size="13" fill="#2A3242">文档源</text>
    <line x1="164" y1="43" x2="186" y2="43" stroke="#8A93A5" stroke-width="1.5" marker-end="url(#ragArrow)"></line>
    <rect x="190" y="20" width="140" height="46" rx="8" fill="#F1F4F9" stroke="#C9D2E0"></rect>
    <text x="260" y="48" text-anchor="middle" font-size="13" fill="#2A3242">解析 / 切分</text>
    <line x1="334" y1="43" x2="356" y2="43" stroke="#8A93A5" stroke-width="1.5" marker-end="url(#ragArrow)"></line>
    <rect x="360" y="20" width="150" height="46" rx="8" fill="#F1F4F9" stroke="#C9D2E0"></rect>
    <text x="435" y="48" text-anchor="middle" font-size="13" fill="#2A3242">Embedding（批量）</text>
    <line x1="435" y1="68" x2="435" y2="92" stroke="#8A93A5" stroke-width="1.5" marker-end="url(#ragArrow)"></line>
    <rect x="190" y="96" width="320" height="46" rx="8" fill="#EDF1F8" stroke="#C9D2E0"></rect>
    <text x="350" y="124" text-anchor="middle" font-size="13" fill="#2A3242">向量库 + 元数据（HNSW 索引）</text>
    <text x="10" y="172" font-size="12" fill="#8A93A5">在线查询链路</text>
    <rect x="10" y="180" width="110" height="46" rx="8" fill="#F1F4F9" stroke="#C9D2E0"></rect>
    <text x="65" y="208" text-anchor="middle" font-size="13" fill="#2A3242">用户查询</text>
    <line x1="124" y1="203" x2="146" y2="203" stroke="#8A93A5" stroke-width="1.5" marker-end="url(#ragArrow)"></line>
    <rect x="150" y="180" width="130" height="46" rx="8" fill="#F1F4F9" stroke="#C9D2E0"></rect>
    <text x="215" y="208" text-anchor="middle" font-size="13" fill="#2A3242">Query Embedding</text>
    <line x1="284" y1="203" x2="306" y2="203" stroke="#8A93A5" stroke-width="1.5" marker-end="url(#ragArrow)"></line>
    <rect x="310" y="180" width="110" height="46" rx="8" fill="#F1F4F9" stroke="#C9D2E0"></rect>
    <text x="365" y="208" text-anchor="middle" font-size="13" fill="#2A3242">检索 / 过滤</text>
    <line x1="424" y1="203" x2="446" y2="203" stroke="#8A93A5" stroke-width="1.5" marker-end="url(#ragArrow)"></line>
    <rect x="450" y="180" width="95" height="46" rx="8" fill="#F1F4F9" stroke="#C9D2E0"></rect>
    <text x="497" y="208" text-anchor="middle" font-size="13" fill="#2A3242">Rerank</text>
    <line x1="549" y1="203" x2="571" y2="203" stroke="#8A93A5" stroke-width="1.5" marker-end="url(#ragArrow)"></line>
    <rect x="575" y="180" width="115" height="46" rx="8" fill="#F1F4F9" stroke="#C9D2E0"></rect>
    <text x="632" y="208" text-anchor="middle" font-size="13" fill="#2A3242">LLM 生成</text>
    <line x1="365" y1="142" x2="365" y2="176" stroke="#8A93A5" stroke-width="1.5" marker-end="url(#ragArrow)"></line>
  </svg>
  <figcaption style="font-size:12px;color:#8A93A5;margin-top:6px">离线链路按批次运行，在线链路每次查询都走一遍；成本叠加在同一个账上。</figcaption>
</figure>

按这条链路，成本可以分成四层，每层的驱动因素完全不同：

| 层次 | 具体项目 | 驱动因素 | 发生频率 |
|---|---|---|---|
| 一次性 / 初始化 | 全量解析、首次 Embedding、索引构建、评测集建设 | 语料总 Token 数、chunk 策略 | 项目启动与重大改版 |
| 周期性基础设施 | 向量库实例、存储、备份、检索服务、监控 | 向量规模、可用性要求 | 每月固定 |
| 离线增量 | 新增与更新文档的解析、Embedding、索引写入与重建 | 更新频率、变更比例 | 每日或每周 |
| 在线边际 | 查询 Embedding、检索、Rerank、LLM 输入输出 | 查询量、Top-K、输入长度 | 每次请求 |

## 二、先把量算出来，再谈钱

成本失控的项目，通常不是单价选错了，而是**不知道自己有多少 chunk**。以下四个量必须先用算的方式确定，再谈价格：

```
chunk 数      = ⌈单篇 Token 数 / (chunk 大小 − 重叠)⌉ × 文档数
向量原始体积  = chunk 数 × 维度 × 4 字节（float32）
在线输入 Token = 检索条数 × 每条平均 Token + 系统提示 + 用户问题
月输入 Token   = 日均查询 × 30 × 在线输入 Token
```

举个可复核的例子。以下参数全部是**示例假设**，不是任何真实客户的统计：

- 文档 20,000 篇，平均每篇 1,800 Token；
- chunk 大小 500 Token，重叠 50 Token，即有效步长 450；
- 每篇 chunk 数 = ⌈1800 / 450⌉ = 4，总 chunk 数 = 80,000；
- 向量维度 1024，float32，单条 4 KB → 原始向量 80,000 × 4 KB = **320 MB**；
- 在线：日均 5,000 次查询，检索 Top-50 后 Rerank 取 Top-8，系统提示 300 Token，问题 50 Token，每条命中片段平均 500 Token；
- 在线单次输入 = 8 × 500 + 300 + 50 = **4,350 Token**，输出按 350 Token 计。

把 Token 量算成"每千次查询"的消耗，价格就变成一个乘数，换任何模型都能立刻重算：

| 项目 | 每 1,000 次查询 | 每月（5,000 次/日 × 30 天 = 150,000 次） |
|---|---|---|
| 在线输入 Token | 4.35 M | 652.5 M |
| 在线输出 Token | 0.35 M | 52.5 M |
| 查询 Embedding（按每次 20 Token） | 0.02 M | 3 M |
| Rerank 候选（50 条 × 500 Token） | 25 M | 3,750 M |

月列 = 每千次列 × 150，别把 150,000 次看成 150 千次以外的量级——这是手算时最常见的 5 倍误差来源。

这张表里最容易被忽略的是最后一行：**Rerank 的候选量约为最终喂给模型内容的 5~6 倍**（25 M 对 4.35 M）。它的成本取决于你用的是独立的 rerank 接口（通常按"查询 + 文档"的 Token 或按次计费）还是用 LLM 二次打分（那就是纯 LLM 调用，且延迟叠加）。把 Top-50 降到 Top-20，检索侧的候选成本直接砍掉 60%，而召回损失往往小于 2~3 个百分点——这类取舍比换模型更有效。

代价格时用 [模型库](/models/) 各模型档案里的核验价（每百万 Token），或直接在 [成本计算器](/cost/) 里填 4.35 M 输入 / 0.35 M 输出 × 查询量，得到该模型下的在线月成本。本文不列单价表，因为价格会变，而 Token 量不会。

## 三、索引不是免费的：HNSW 的内存与构建时间

向量体积只是硬盘上的数，索引才是真正吃资源和时间的地方。以 pgvector 的官方文档为参考（下述参数与行为均在 2026-10-31 核验）：

- HNSW 构建的是多层图，查询性能优于 IVFFlat，但**构建更慢、占用内存更多**；它不需要训练，可以在空表上直接建索引；
- `m`（每层最大连接数，默认 16）与 `ef_construction`（构建时的候选集大小，默认 64）显著影响构建时间；文档建议在没有召回问题前先用默认值；
- 当图能完全放进 `maintenance_work_mem` 时构建会明显加速，放不下时会给出提示并显著变慢；同时官方明确提醒不要把这个值调到耗尽服务器内存；
- 查询侧 `hnsw.ef_search`（默认 40）控制召回与速度的权衡；带过滤条件的查询在近似索引扫描之后才过滤，结果可能偏少，0.8.0 起提供迭代扫描缓解。

把这几条翻译成成本语言：**索引构建是一次性的 CPU 与内存支出**，如果向量规模大到图放不进内存，构建时间会从分钟级变成小时级，而这段时间里机器不能干别的；**索引维护是持续支出**，删除与更新文档会留下需要清理的条目，官方文档也提到 HNSW 的 vacuum 可能较慢，可以先重建再清理。对高频更新的知识库（比如每天同步的工单系统），这部分成本经常被漏掉。

## 四、更新频率如何主导总成本

继续用上面的示例参数，叠加一个增量场景：每天新增 300 篇文档。

- 每天新增 chunk 数 = 300 × 4 = 1,200；
- 每天增量 Embedding Token = 1,200 × 500 = 0.6 M；
- 每月 = 18 M Token。

对比在线 LLM 输入 652.5 M/月，增量索引只占约 2.8%。这也解释了一个常见误判：**在查询量足够大的系统里，Embedding 不是主要成本**；但如果你的日均查询只有 100 次（月在线输入约 13 M），同样的 18 M 增量索引就会超过在线推理，成为第一大头。

| 日均查询量 | 成本主导项 | 该优化什么 |
|---|---|---|
| 100 次以下 | 周期性基础设施（向量库实例、检索服务） | 用托管服务或直接跑在现有 PG 上，别为小流量上专用集群 |
| 数百到数千次 | 在线输入 Token 与 Rerank | Top-K 与 chunk 大小、缓存命中率、模型选择 |
| 万次以上 | 在线 Token 总量 + 检索延迟 | 语义缓存、批处理、分层模型（便宜模型先筛） |
| 文档高频更新 | 增量索引与索引维护 | 变更检测（只重新处理改动部分）、批量合并写入 |

最后一行值得展开：**"每天全量重建索引"是最常见的成本事故**。正确做法是做内容指纹（URL + 内容哈希），只对变更的文档重新切分与 Embedding，删除的文档走标记 + 定期物理清理，避免索引无限膨胀。

## 五、在线侧还能压的三处

**其一，减少进入 Prompt 的 Token，而不是减少检索条数。** 把 Top-8 每条 500 Token 改成 Top-8 每条 300 Token（更好的切分粒度、去掉重复导航与页脚），输入直接降 40%，效果比换便宜模型更确定。

**其二，让稳定部分命中缓存。** 系统提示 + 固定的指令模板放在最前面，命中后这部分按缓存价计费。注意：检索出来的文档片段每次不同，它天然不会被缓存，所以可优化的只有系统提示与模板。缓存的收益条件（前缀多大、复用多少次才回本）是独立话题，本文不展开。

**其三，把"检索不到"的情况挡在模型之外。** 检索结果为空或相关度极低时，直接返回"没有找到相关资料"，而不是让模型拿一段空上下文自由发挥——一次生成一次计费，还容易编。

## 六、什么时候不该做 RAG

- **语料小到能整段放进上下文**：几千 Token 的说明文档，直接塞进去比维护一套检索链路便宜得多，也更准。判断标准是"总 Token 数 × 每次请求"与"检索工程的人力 + 基础设施成本"的比较。
- **查询量极低**：每月几十次查询，向量库的固定成本会远高于 Token 支出。
- **问题需要精确计算或全量聚合**：RAG 擅长"找出相关段落"，不擅长"统计所有订单金额"。这类需求该走数据库查询。
- **文档更新极其频繁**：如果知识每分钟都在变，索引永远追不上，考虑直接查源系统。

## 七、和相邻文章的分工

- 单次请求的 Token 成本、缓存命中率的敏感性分析：[场景成本案例](/guides/llm-api-cost-examples/)；
- 价格与档位的横向比较：[定价比较指南](/guides/llm-api-pricing-comparison/)；
- 计费口径（输入输出分价、分档、峰谷与读写费）：[如何计算 LLM API 成本](/guides/llm-api-cost/)；
- 让 Agent 自己调检索工具时的成本结构（步数增长、工具费、循环）：那属于另一个话题，本文不涉及。

<!-- 待 prompt-caching-optimization 与 agent-api-cost-estimation 发布后，在第七节补两条站内链接（当前三篇均为草稿，发布前不得互链）。 -->

一个可执行的收尾动作：把本文第二节的两张表换成你自己系统的真实参数（文档数、chunk 大小、Top-K、日均查询），算出"每千次查询 Token 量"，再把价格当变量。这样做完，你会发现 RAG 的成本控制点基本都在参数上，而不在选哪家模型上。
