---
title: "LLM API 接入完整指南：从 API Key 到生产部署"
description: "按真实接入顺序讲清大模型 API 的请求结构、SDK 与原生 HTTP 的取舍、超时与重试分层、流式响应解析，以及如何用 usage 字段把用量接进成本监控。"
publishedAt: "2026-10-31"
updatedAt: "2026-10-31"
category: "tutorial"
tags:
  - LLM API
  - 后端接入
  - 错误处理
draft: true
indexable: true
translationKey: null
sources:
  - title: "DeepSeek API Docs · Models & Pricing（Base URL、上下文与并发上限）"
    url: "https://api-docs.deepseek.com/quick_start/pricing"
    accessedAt: "2026-10-31"
  - title: "Node.js Documentation · Global objects（fetch 与 AbortSignal.timeout）"
    url: "https://nodejs.org/api/globals.html"
    accessedAt: "2026-10-31"
  - title: "MDN · 429 Too Many Requests"
    url: "https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Status/429"
    accessedAt: "2026-10-31"
  - title: "MDN · 503 Service Unavailable"
    url: "https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Status/503"
    accessedAt: "2026-10-31"
---

接入大模型 API 这件事，第一次跑通通常十分钟，真正花时间的是把它变成"半夜报警也不会慌"的线上依赖。这篇按开发者实际接入的顺序走一遍：先决定 Key 放在哪，再看请求长什么样，然后处理失败、流式与用量统计。文中代码用 Node 22 + TypeScript 写，只依赖内置模块，语法与类型经过编译校验，但没有对任何厂商端点做连通性测试——你接入时应先用最小请求打通，再照抄错误处理部分。

## 一、第一个决定：谁持有 Key

这个决定影响后面所有架构。三个选项：

| 形态 | 适用 | 代价 |
|---|---|---|
| 客户端直连厂商 | 只在你自己的机器上跑的内部脚本 | 一旦分发给他人就等于公开 Key |
| 服务端代理 | 网页、小程序、移动端、任何多用户产品 | 需要自己做鉴权、配额与转发 |
| 边缘函数代理 | 轻量、想省一台服务器 | 冷启动与超时上限、密钥分散在边缘环境 |

浏览器与小程序包都是可读的，前端产物里没有秘密。只要你的调用方不止你自己，第二个选项就是唯一合理选择。代理不是简单转发：它必须校验调用者身份、按用户限流、把用量记下来。这部分在《LLM API 密钥与访问安全实践》里给了完整实现，这里只强调一点——**代理存在的前提是它自己也是需要鉴权的服务**。

## 二、请求长什么样

绝大多数厂商现在都提供 OpenAI 兼容的 HTTP 形态：`POST {base_url}/chat/completions`，`Authorization: Bearer <key>`，body 里是 `model` + `messages` 数组。也有厂商同时提供 Anthropic 兼容入口，例如 DeepSeek 的官方文档给了两个 Base URL：`https://api.deepseek.com`（OpenAI 格式）与 `https://api.deepseek.com/anthropic`（Anthropic 格式），同一模型两种协议都能调。选择依据是你的工具链：已经在用某家 SDK 或某种消息结构，就走兼容的那条路，能省掉一层适配。

一个最小请求：

```bash
curl https://api.example.com/v1/chat/completions \
  -H "Authorization: Bearer $LLM_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "your-model-id",
    "messages": [
      { "role": "system", "content": "只输出 JSON，不要解释。" },
      { "role": "user", "content": "把下面这句话拆成字段：……" }
    ],
    "max_tokens": 512,
    "temperature": 0
  }'
```

三个容易踩的点：

**模型名不是品牌名。** 厂商的模型标识、版本后缀、别名各不相同，且会随版本迭代调整（DeepSeek 文档就明确保留旧模型名一段时间，请求会被路由到新版本并按新版本计价）。把模型名写进配置而不是硬编码在代码里，同时记录"什么时候用过哪个名字"，换版本时才有对照。

**`max_tokens` 是输出的硬上限，不是输入限制。** 不同厂商对它的字段名不一致（有的叫 `max_completion_tokens`），且上限受模型的最大输出规格约束。写成一个比模型上限还大的值通常会被拒绝或被静默截断，两种行为都不好排查，所以按官方文档给的区间取值。

**兼容不等于等价。** OpenAI 兼容层通常只覆盖 `messages` 与少量参数，厂商自有的能力（思考模式开关、前缀续写、缓存控制、结构化输出格式）往往在兼容层里不存在或语义不同。用到这些能力时，回到该厂商的原生协议。

## 三、SDK 还是原生 HTTP

这不该按个人偏好决定，看三件事：

| 判断维度 | 选官方 SDK | 选原生 HTTP |
|---|---|---|
| 接口变化频率 | 高，且希望由 SDK 跟进 | 低，或你只需要 `chat/completions` 一个端点 |
| 可观测性 | SDK 内部重试可能让日志缺一层 | 每次请求你都能决定记什么 |
| 依赖与体积 | 可接受多一个依赖 | 边缘函数、冷启动敏感场景 |
| 流式解析 | SDK 已封装 SSE 与取消 | 需要自己处理分块边界 |

经验做法是**用原生 HTTP 包一层薄客户端**：请求形状、超时、重试、日志这四件事自己掌控，SDK 只在你需要复杂能力（多模态上传、批量任务、工具执行回传）时才引入。反过来，如果你的团队没人维护这层薄客户端，SDK 的默认行为（自动重试、默认超时）比自己随手写的 `fetch` 更安全。

这里有一个容易被忽略的成本问题：**SDK 的自动重试会放大账单**。一次失败重试意味着输入 Token 被计费两次（若上游已经生成又被断开，输出也可能计费）。所以不管用 SDK 还是 HTTP，都要能明确回答"这个客户端最多会发几次请求"。

## 四、一个带错误分诊的最小客户端

下面这段代码把"能重试"和"不能重试"分开，这是接入阶段最有价值的一步。TypeScript 5.9 + @types/node 24 下 `tsc --strict` 通过。

```ts
type LLMErrorKind = 'auth' | 'param' | 'rate_limit' | 'server' | 'timeout' | 'network';

export class LLMError extends Error {
  constructor(readonly kind: LLMErrorKind, message: string, readonly status?: number) {
    super(message);
    this.name = 'LLMError';
  }
  /** 只有限流、上游 5xx、超时和网络抖动值得重试 */
  get retryable(): boolean {
    return this.kind === 'rate_limit' || this.kind === 'server' || this.kind === 'timeout' || this.kind === 'network';
  }
}

export interface ChatRequest {
  model: string;
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>;
  max_tokens?: number;
  temperature?: number;
}

function classify(status: number): LLMErrorKind {
  if (status === 401 || status === 403) return 'auth';
  if (status === 429) return 'rate_limit';
  if (status >= 500) return 'server';
  return 'param';
}

const sleep = (ms: number) => new Promise<void>(r => setTimeout(r, ms));

/** 满抖动退避：避免多个 worker 在同一时刻同时重试 */
function backoffMs(attempt: number, base = 500, cap = 8000): number {
  const ceiling = Math.min(cap, base * 2 ** attempt);
  return Math.floor(Math.random() * ceiling);
}

export async function chat(
  req: ChatRequest,
  opts: { baseUrl: string; apiKey: string; timeoutMs?: number; maxAttempts?: number }
): Promise<{ text: string; usage: { input: number; output: number } }> {
  const { baseUrl, apiKey, timeoutMs = 60_000, maxAttempts = 3 } = opts;
  let lastError: LLMError | null = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const res = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${apiKey}` },
        body: JSON.stringify(req),
        signal: AbortSignal.timeout(timeoutMs)
      });

      if (!res.ok) {
        const kind = classify(res.status);
        const detail = (await res.text()).slice(0, 500);
        const retryAfter = Number(res.headers.get('retry-after') ?? '0');
        const err = new LLMError(kind, `HTTP ${res.status}: ${detail}`, res.status);
        if (kind === 'rate_limit' && retryAfter > 0) await sleep(retryAfter * 1000);
        else if (err.retryable && attempt < maxAttempts) await sleep(backoffMs(attempt));
        else throw err;
        lastError = err;
        continue;
      }

      const data = (await res.json()) as {
        choices: Array<{ message: { content: string } }>;
        usage?: { prompt_tokens?: number; completion_tokens?: number };
      };
      return {
        text: data.choices[0]?.message.content ?? '',
        usage: { input: data.usage?.prompt_tokens ?? 0, output: data.usage?.completion_tokens ?? 0 }
      };
    } catch (e) {
      if (e instanceof LLMError) throw e;
      const name = (e as Error).name;
      const kind: LLMErrorKind = name === 'TimeoutError' || name === 'AbortError' ? 'timeout' : 'network';
      lastError = new LLMError(kind, (e as Error).message);
      if (attempt < maxAttempts) await sleep(backoffMs(attempt));
    }
  }
  throw lastError ?? new LLMError('network', 'unknown failure');
}
```

几个设计取舍值得说明。`retry-after` 优先于本地退避：上游明确告诉你等多久，就按它说的等，自己算的指数往往更短、会继续撞墙。满抖动（`Math.random() * ceiling`）而不是固定间隔，是为了避免几十个 worker 在同一毫秒集体重试、把限流撞成雪崩。`maxAttempts = 3` 是个成本与可用性的折中：一次成功率为 p 的调用，最多 3 次的期望请求数是 `1 + (1-p) + (1-p)²`，当 p 掉到 0.5 时期望值是 1.75，账单同比例上涨——所以重试次数是与预算耦合的参数，不是越大越好。

## 五、流式响应：SSE 与 usage 的时机

流式输出改善的是首字延迟体验，但它让"什么时候能拿到用量"变得更晚：多数实现把 usage 放在最后一个数据块（或在请求里要求包含用量时才返回）。这意味着**连接中断的请求可能拿不到 usage**，而你已经被计费。所以流式路径必须自己兜底记账：记录请求侧估算的输入 Token 数，作为无 usage 时的替代值。

```ts
export async function* streamChat(
  req: ChatRequest,
  opts: { baseUrl: string; apiKey: string; signal?: AbortSignal }
): AsyncGenerator<{ delta: string; usage?: { input: number; output: number } }> {
  const res = await fetch(`${opts.baseUrl}/chat/completions`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${opts.apiKey}` },
    body: JSON.stringify({ ...req, stream: true }),
    signal: opts.signal ?? AbortSignal.timeout(120_000)
  });
  if (!res.ok || !res.body) throw new LLMError(classify(res.status), `HTTP ${res.status}`, res.status);

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    // SSE 事件以空行分隔；分块边界可能正好切在事件中间，必须保留残余
    let sep = buffer.indexOf('\n\n');
    while (sep !== -1) {
      const raw = buffer.slice(0, sep);
      buffer = buffer.slice(sep + 2);
      sep = buffer.indexOf('\n\n');

      for (const line of raw.split('\n')) {
        if (!line.startsWith('data:')) continue;
        const payload = line.slice(5).trim();
        if (payload === '[DONE]') return;
        const obj = JSON.parse(payload) as {
          choices?: Array<{ delta?: { content?: string } }>;
          usage?: { prompt_tokens?: number; completion_tokens?: number };
        };
        const delta = obj.choices?.[0]?.delta?.content ?? '';
        if (obj.usage) {
          yield { delta, usage: { input: obj.usage.prompt_tokens ?? 0, output: obj.usage.completion_tokens ?? 0 } };
        } else if (delta) {
          yield { delta };
        }
      }
    }
  }
}
```

这段解析里最容易写错的是**分块边界**：网络一次给你的可能是半个事件，也可能是两个半事件。用 `\n\n` 切分并保留残余缓冲是必须的，直接对每次 `read()` 的字符串做 `split('\n\n')` 会在长响应里随机丢块。

流式还有一个成本陷阱：用户看到前两行就关掉页面，服务端如果不取消上游请求，模型会继续生成到 `max_tokens`，你为一段没人看的内容付全价。正确的做法是把客户端断开事件接到同一个 `AbortSignal` 上（第六节）。

## 六、超时与取消：分成三层设

只设一个"总超时"是不够的，实际需要三层：

| 层 | 含义 | 典型取值依据 |
|---|---|---|
| 连接 / 首字节 | 上游接受请求并开始响应 | 你要等多久才认为"卡住了" |
| 空闲 | 流式场景下两个数据块之间的最长间隔 | 大于上游 P99 的块间隔 |
| 总时长 | 一次调用从发出到结束 | 业务可接受的最长等待 |

`AbortSignal.timeout(ms)` 只能表达总时长；流式场景的空闲超时要自己实现：每次收到数据就重置一个定时器，超时则 abort。取消的传播方向也要清楚——**客户端断开 → 服务端 abort → 上游收到断开**，链条上任何一环缺失，钱就白花。

## 七、错误码分诊表

| 状态 | 含义 | 正确反应 |
|---|---|---|
| 400 / 422 | 参数、消息格式、超出模型限制 | 不重试，记录请求体特征（脱敏）后修代码 |
| 401 / 403 | Key 无效、无权限、被禁用 | 不重试，立即告警——通常是配置或轮换出错 |
| 402 / 余额不足类 | 账户额度耗尽 | 不重试，告警，切备用通道 |
| 413 | 请求体过大 | 不重试，切分输入 |
| 429 | 限流 | 读 `Retry-After`，等待后重试，并调低并发 |
| 500 / 502 / 503 / 504 | 上游故障或过载 | 指数退避重试，连续多次则熔断 |

429 与 503 的语义差别值得记住：429 是"你太快了"，503 是"我暂时不可用"。前者应该降低自己的发送速率，后者应该切换到备用供应商或排队等待。把两者都当成"等 1 秒重试"是最常见也最贵的写法。

## 八、把 usage 接进成本监控

接入完成、跑通之后，第二件事是让"每个请求花了多少钱"可查。最小实现是把 usage 与身份、模型、耗时写成结构化日志：

```ts
export interface CostRecord {
  ts: string;
  userId: string;
  feature: string;       // 业务归因：chat / summarize / ocr-fixup
  model: string;
  inputTokens: number;
  outputTokens: number;
  cachedInputTokens?: number;
  attempts: number;      // 含重试的真实请求次数
  ms: number;
}
```

有了这张表，月度成本就不再需要"日均次数 × 单次假设"来猜。公式与单价口径见 [《如何计算 LLM API 成本》](/guides/llm-api-cost/)，代入自己的实测参数用 [成本计算器](/cost/) 复算；模型单价与核验日期在 [模型库](/models/) 各档案页。

`attempts` 这个字段容易被省掉，但它决定了你的账能不能对上：账单按"上游实际处理的请求"计费，而不是按"业务发起的一次调用"计费。两者之差就是重试带来的浪费，通常也是最先值得优化的那部分。

## 九、三套环境配置

开发、测试、生产用不同的 Key、不同的模型、不同的超时，且都有各自的配额上限。判断标准很简单：**本地误跑一个循环，不应该影响到线上预算**。配置从环境变量读（十二要素应用的基本原则），代码里不写默认 Key；缺配置时启动即失败，比运行到第一个请求才报错好得多。

模型名与价格同样应该来自配置而不是硬编码：模型会换代、价格会调整，硬编码意味着每次都要发版。

## 十、上线前检查清单

- [ ] Key 只存在于服务端环境变量或密钥管理系统，前端产物中检索不到；
- [ ] 代理接口有身份校验，未认证返回 401；
- [ ] 超时分成连接、空闲、总时长三层，流式路径有取消传播；
- [ ] 重试只覆盖 429 / 5xx / 超时 / 网络，`Retry-After` 优先于本地退避；
- [ ] 重试有次数上限，且这个上限与预算一起评审过；
- [ ] 日志记录 usage 与 attempts，不记录完整 prompt 与响应正文；
- [ ] 模型名、Base URL、超时、重试次数都在配置里，换模型不发版；
- [ ] 有一个"最小可用请求"的冒烟脚本，部署后先跑它。

前十节里最容易被跳过的是第七节的错误分诊和第八节的 usage 记账。前者的代价是线上排障时间，后者的代价是你永远说不清钱花在哪——而后者往往是下一次预算评审里最先被问到的问题。
