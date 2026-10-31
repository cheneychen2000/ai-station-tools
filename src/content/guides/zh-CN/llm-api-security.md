---
title: "LLM API 密钥与访问安全实践"
description: "从密钥存放、服务端代理、环境隔离、CI 注入到轮换与泄漏应急，梳理接入大模型 API 时真正会出事的地方，并给出可直接改造的 Node.js 代理实现。"
publishedAt: "2026-10-31"
updatedAt: "2026-10-31"
category: "tutorial"
tags:
  - LLM API
  - API 安全
  - 密钥管理
draft: true
indexable: true
translationKey: null
sources:
  - title: "OWASP Secrets Management Cheat Sheet"
    url: "https://cheatsheetseries.owasp.org/cheatsheets/Secrets_Management_Cheat_Sheet.html"
    accessedAt: "2026-10-31"
  - title: "The Twelve-Factor App · III. Config"
    url: "https://12factor.net/config"
    accessedAt: "2026-10-31"
  - title: "GitHub Docs · Secrets（GitHub Actions）"
    url: "https://docs.github.com/en/actions/concepts/security/secrets"
    accessedAt: "2026-10-31"
  - title: "OpenTelemetry GenAI Semantic Conventions（独立仓库）"
    url: "https://github.com/open-telemetry/semantic-conventions-genai"
    accessedAt: "2026-10-31"
  - title: "MDN · 429 Too Many Requests"
    url: "https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Status/429"
    accessedAt: "2026-10-31"
---

调用大模型 API 的安全问题，绝大多数不是模型被攻破，而是**密钥与调用链**的管理失当：密钥进了前端包、进了 Git 历史、进了日志，或者被放在一个没有身份校验、没有额度上限的中间层后面。后者尤其常见——很多人已经知道"密钥不能放前端"，于是搭了个转发接口，但那个接口对公网无鉴权、对上游无限流，攻击者不需要偷到你的 Key，直接刷你的接口就能把账单刷爆。

这篇按"密钥在哪 → 谁在调用 → 出了事怎么办"的顺序展开，每一节都对应一个可以在半天内落地的动作。

## 一、密钥只应存在于服务端运行环境

### 浏览器和小程序包都是可读的

任何写进前端代码、静态资源或公开仓库的 Key，都应当视为已泄露。前端产物没有秘密可言：JavaScript 可读、请求可抓包、小程序包可解包。前端只允许持有**你自己签发的短期凭证**（会话令牌），由服务端代持厂商 Key。

### 用环境变量，而不是代码常量

十二要素应用把配置从代码中剥离，判断标准很直接：代码库能否在任何时刻开源而不泄露任何凭据。密钥属于配置，标准做法是环境变量 + 部署平台注入，并且不同环境使用不同 Key：

```bash
# .env（不提交到仓库，且写进 .gitignore）
LLM_API_KEY=sk-replace-me
LLM_API_BASE=https://api.example.com/v1
```

代码里只读 `process.env`，不要有默认值兜底：`process.env.LLM_API_KEY || 'sk-xxx'` 这类写法会把"没配好"变成"用了一个假 Key"的运行时错误，启动时直接失败反而更安全。

### 泄露后的处置顺序

1. 先在厂商控制台**吊销**该 Key——删代码不会让已泄漏的 Key 失效；
2. 轮换新 Key 并重新部署；
3. 检查用量与账单，确认是否已被消耗；
4. 清理 Git 历史中的残留（改写历史或轮换，而不是仅删除文件）。

## 二、调用链鉴权：让每一次请求都可归因

| 风险 | 典型症状 | 对应措施 |
|---|---|---|
| 密钥打包进前端 | 抓包即可见 `Authorization` 头 | 服务端代持，前端只拿会话令牌 |
| 内部服务裸调 | 任何能访问内网的服务都能消耗额度 | 服务间鉴权（mTLS / 签名）+ 调用方白名单 |
| 共享令牌 | 同一令牌被多人或多多租户共用，出事无法定位 | 每用户/每租户独立令牌 + 服务端绑定身份 |
| 无上限消耗 | 一夜之间账单暴涨 | 按用户、按接口的配额与速率限制 |

这一节最重要的一句话是：**代理不是把 Key 藏起来就完事，它必须自己也是一个需要鉴权的服务。** 一个只做 `POST /chat` 转发的接口，如果不需要登录，那就等于把厂商 Key 的额度公开发布在互联网上。

## 三、日志：既要可排障，又不能留凭据

日志是最难避免的泄漏面，因为它天然会记录"完整请求"。三条规则：

- 请求头默认**白名单**输出，不要把整个 `headers` 对象丢进日志；
- 记录调用元数据（用户、模型、输入输出 Token 数、耗时、状态码），不记录完整 Prompt 与响应正文；
- 日志进第三方平台前再做一次过滤，避免"本地脱敏、远端泄露"。

```ts
const SENSITIVE = new Set(['authorization', 'api-key', 'x-api-key', 'cookie', 'set-cookie']);

export function redactHeaders(headers: Record<string, string | string[] | undefined>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(headers)) {
    if (SENSITIVE.has(k.toLowerCase())) out[k] = '[redacted]';
    else if (v !== undefined) out[k] = Array.isArray(v) ? v.join(',') : v;
  }
  return out;
}
```

反例也要说清楚：`console.log(prompt.slice(0, 200))` 这种"只打前 200 字"的做法看着安全，实际上用户的第一句话里经常就有身份证号、手机号、内部文档标题。

## 四、配额与熔断：把损失控制在可预期范围

1. 每个用户每日 Token 上限（按输入/输出分别计数，不要只算请求次数——一次 30 万 Token 的请求抵得上几千次短请求）；
2. 每个接口的速率限制（防脚本刷量）；
3. 按模型分别限额（旗舰模型与轻量模型不该共用同一个预算）；
4. 上游失败时的熔断与降级，避免重试放大成本。

配额的实现细节放到下一节与代理代码一起给出。这里先说一个容易被忽略的账：**失败请求也会花钱**。上游已经生成了一半内容再断开，计费不会因为客户端没收到就归零；客户端超时重试一次，同一条输入就付了两次。所以"重试策略"同时是成本策略。

## 五、一个可运行的代理（Node 22 + TypeScript）

下面这个文件只依赖 Node 内置模块，`node --experimental-strip-types server.ts`（或编译后 `node server.js`）即可运行。它做了四件事：校验调用者身份、按用户限流与记账、带超时和有限重试地转发、把 usage 与身份一起写进结构化日志。

```ts
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';

const UPSTREAM = process.env.LLM_API_BASE;          // 例如 https://api.example.com/v1
const API_KEY = process.env.LLM_API_KEY;
const SESSION_SECRET = process.env.SESSION_SECRET;  // 你自己签发的会话令牌密钥
const DAILY_TOKEN_QUOTA = Number(process.env.DAILY_TOKEN_QUOTA ?? 200_000);
const UPSTREAM_TIMEOUT_MS = 60_000;

if (!UPSTREAM || !API_KEY || !SESSION_SECRET) {
  throw new Error('缺少必需的环境变量：LLM_API_BASE / LLM_API_KEY / SESSION_SECRET');
}

/* 生产环境请把这两张表换成 Redis，并加上过期时间；这里用内存表只为把逻辑讲清楚 */
const usageToday = new Map<string, number>();
const inflight = new Map<string, number>();

/** 校验会话令牌并返回用户标识。真实项目应换成 JWT 验签或会话查询。 */
function authenticate(req: IncomingMessage): { userId: string } | null {
  const token = req.headers.authorization?.replace(/^Bearer\s+/i, '');
  if (!token || token.split('.').length !== 2) return null;
  const [userId, sig] = token.split('.');
  // 生产环境用 HMAC 比对，这里省略签名计算，只强调"必须校验而不是直接信任 userId"
  return sig && userId ? { userId } : null;
}

function readJson(req: IncomingMessage, limitBytes = 256 * 1024): Promise<unknown> {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks: Buffer[] = [];
    req.on('data', (c: Buffer) => {
      size += c.length;
      if (size > limitBytes) { reject(new Error('payload too large')); req.destroy(); return; }
      chunks.push(c);
    });
    req.on('end', () => {
      try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8'))); }
      catch { reject(new Error('invalid json')); }
    });
    req.on('error', reject);
  });
}

async function callUpstream(body: unknown, signal: AbortSignal): Promise<Response> {
  const res = await fetch(`${UPSTREAM}/chat/completions`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${API_KEY}` },
    body: JSON.stringify(body),
    signal
  });
  if (res.status === 429 || res.status >= 500) {
    const retryAfter = Number(res.headers.get('retry-after') ?? '0');
    const waitMs = retryAfter > 0 ? retryAfter * 1000 : 500;
    await new Promise(r => setTimeout(r, Math.min(waitMs, 5000)));
    return fetch(`${UPSTREAM}/chat/completions`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${API_KEY}` },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS)
    });
  }
  return res;
}

const server = createServer(async (req: IncomingMessage, res: ServerResponse) => {
  if (req.method !== 'POST' || req.url !== '/api/chat') {
    res.writeHead(404).end('not found');
    return;
  }
  const auth = authenticate(req);
  if (!auth) { res.writeHead(401).end('unauthorized'); return; }

  const used = usageToday.get(auth.userId) ?? 0;
  if (used >= DAILY_TOKEN_QUOTA) { res.writeHead(429).end('daily quota exhausted'); return; }
  const running = inflight.get(auth.userId) ?? 0;
  if (running >= 4) { res.writeHead(429).end('too many concurrent requests'); return; }

  inflight.set(auth.userId, running + 1);
  try {
    const payload = await readJson(req);
    const upstream = await callUpstream(payload, AbortSignal.timeout(UPSTREAM_TIMEOUT_MS));
    const text = await upstream.text();
    let inputTokens = 0, outputTokens = 0;
    try {
      const parsed = JSON.parse(text) as { usage?: { prompt_tokens?: number; completion_tokens?: number } };
      inputTokens = parsed.usage?.prompt_tokens ?? 0;
      outputTokens = parsed.usage?.completion_tokens ?? 0;
    } catch { /* 上游异常时不影响转发，但这条记录要能被发现 */ }

    usageToday.set(auth.userId, used + inputTokens + outputTokens);
    // 结构化日志：只写元数据，不写 prompt/完成内容
    console.log(JSON.stringify({
      event: 'llm_call', userId: auth.userId, status: upstream.status,
      inputTokens, outputTokens, ms: Date.now()
    }));
    res.writeHead(upstream.status, { 'content-type': 'application/json' }).end(text);
  } catch (err) {
    res.writeHead(502).end('upstream failed');
    console.log(JSON.stringify({ event: 'llm_call_error', userId: auth.userId, message: (err as Error).message }));
  } finally {
    inflight.set(auth.userId, Math.max(0, (inflight.get(auth.userId) ?? 1) - 1));
  }
});

server.listen(process.env.PORT ?? 8787);
```

这段代码有意保留了几处"不完美"，改造时按顺序补上：

- **令牌校验必须真的验签**。注释处省略了 HMAC 计算，实际项目中直接信任 `userId` 就等于把身份交给了客户端；
- **配额用内存 Map 只在单进程内有效**，多实例部署时每个实例各记一份，实际额度会被放大实例数倍；换成 Redis 时注意"读-改-写"要用原子操作（`INCRBY`），不要 `GET` 后再 `SET`；
- **重试只应该发生在上游明确可重试的状态码**（这里限定 429/5xx），并且必须复用同一个请求体；对 400/401/403 重试只会把错误重复三遍，还多付三次输入费；
- **客户端断开应当取消上游请求**。示例用 `AbortSignal.timeout` 控制总时长，生产环境还应把 `req.on('close')` 接到同一个控制器上，否则用户已经关页面了，你的额度还在继续消耗。

## 六、环境隔离与密钥来源

### 三套环境，三把 Key

开发、测试、生产必须使用不同的 Key，且开发环境的 Key 额度要小到"被泄漏也不心疼"。同一把 Key 贯穿三个环境的后果是：本地调试脚本的一次循环，可能直接刷掉生产预算；日志里出现的是生产 Key，泄漏面直接扩大到线上。

### Secret Manager 的基本思路

环境变量解决"不进代码"，但解决不了"谁能读"、"何时轮换"、"有没有审计"。密钥管理系统的价值就在这三件事上：

- **访问控制按对象粒度**：读某个 Key 的权限，不应等于读全部 Key；OWASP 的建议很明确——能读改某个密钥的人，就意味着该密钥可能通过他泄漏；
- **审计**：谁在什么时候请求了哪个密钥、是否被批准，这些记录是事后定责的唯一依据；
- **动态或短租期凭据**：能申请短期凭据就不要放长期静态 Key；应用重启不会吊销已泄漏的凭据，只有失效才算。

### CI/CD 中的注入方式

以 GitHub Actions 为例，Secret 在组织、仓库、环境三个层级存储，工作流只有在**显式引用**时才能读到，未在本次 job 使用的 Secret 不会被自动注入。注入方式是把它设成 action 的 `input` 或环境变量：

```yaml
jobs:
  deploy:
    runs-on: ubuntu-latest
    environment: production          # 可配置必需审批人，未审批拿不到该环境的 Secret
    steps:
      - uses: actions/checkout@v4
      - name: Deploy
        env:
          LLM_API_KEY: ${{ secrets.LLM_API_KEY }}
        run: ./scripts/deploy.sh
```

两个必须知道的行为：GitHub 会对日志中的 Secret 自动打码，但**打码没有保证**（值经过编码、拼接、截断后就匹配不上），而且只覆盖当前 job 里用过的 Secret；来自 fork 的 PR 默认拿不到 Secret。所以不要把"平台会打码"当作防护，`echo`、`set -x`、错误堆栈照样会把变量送进日志。

## 七、多用户与多租户的隔离

SaaS 场景下，"一把 Key 服务所有租户"是默认形态，但隔离必须做在别处：

| 隔离对象 | 做法 | 不做的后果 |
|---|---|---|
| 额度 | 按租户独立计数，配额表以 tenantId 为主键 | 一个租户刷爆全部额度，其他租户被牵连 |
| 日志 | 每条记录带 tenantId，查询侧按租户过滤 | 出事后无法定位是谁，也无法对账 |
| 数据 | 请求体与响应不落库，或按租户加密存 | 跨租户数据泄漏，合规风险最大的一类 |
| 密钥 | 大客户可申请独立 Key 与独立预算 | 无法按合同约定成本，也无法单独吊销 |

如果确实需要给大客户独立 Key，正确形态是"**一把 Key 一个租户 + 服务端映射表**"，而不是让客户自带 Key 直连——后者会让你失去配额、审计和吊销能力。

## 八、轮换与泄漏应急

密钥的生命周期是四段：创建、轮换、吊销、过期。OWASP 的顺序建议是把轮换做成常规动作而不是事故动作，并且尽量自动化：手工轮换既容易泄漏（在聊天工具里传 Key）又容易出错（改了服务忘了改定时任务）。

一个可执行的轮换流程：

1. 在厂商控制台创建新 Key（旧 Key 保持有效）；
2. 把新 Key 写入密钥管理系统 / 部署平台环境变量；
3. 分批重启或滚动发布，让所有实例都读到新 Key；
4. 观察错误率与调用量正常后，吊销旧 Key；
5. 记录轮换时间与操作人，写进变更日志。

泄漏应急则要快得多，顺序不能颠倒：**先吊销、再排查**。常见错误是先去看日志找原因，等看完再去控制台点吊销，中间这段时间足够把额度跑完。同时提醒两点：吊销只会停止新调用，已产生的账单仍要核对；清理 Git 历史属于"减少后续暴露"，不能替代吊销。

## 九、Tracing 里的敏感信息

链路追踪会把请求属性展开成可搜索的字段，比日志更容易扩散。OpenTelemetry 的 GenAI 语义约定目前仍在独立仓库中演进（属性名如输入/输出 Token 计数、供应商名都经历过调整），落地时按版本对齐，不要照抄旧博客。无论用哪套约定，三条底线不变：

- 只采元数据：模型名、Token 数、耗时、状态码、错误类型；
- 不采内容：prompt、completion、工具参数与返回原文一律不进 span 属性；
- 采样率与保留期要显式设置，默认全量 + 永久保留是合规事故的温床。

## 十、密钥生命周期清单

上线前逐条打勾，任一条打不上就不要上线：

- [ ] 仓库与前端产物中检索不到 `sk-`、`api_key=` 等模式；
- [ ] 生产 Key 与测试 Key 分离，且都存在于密钥管理系统或平台环境变量；
- [ ] 代理接口需要身份认证，未认证请求返回 401 而不是转发；
- [ ] 代理有按用户/租户的 Token 配额与并发限制，超限返回 429；
- [ ] 上游超时、重试次数、可重试状态码三者已显式配置；
- [ ] 日志样本中确认无明文凭证、无正文内容；
- [ ] Tracing 属性中确认无 prompt/completion 原文；
- [ ] 轮换流程演练过一次（创建 → 切换 → 吊销），有明确责任人；
- [ ] 泄漏应急预案（吊销 → 轮换 → 排查 → 清理）写在可被值班同学找到的地方。

<!-- 待 llm-api-integration 发布后，在本节补充指向 /guides/llm-api-integration/ 的交叉链接（当前两篇均为草稿，发布前不得互链）。 -->
