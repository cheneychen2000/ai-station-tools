/**
 * 文章代码示例验证：scripts/test-article-code.mjs（npm run check:article-code）
 *
 * 设计约束：**测试对象就是文章正文里的代码块本身**。本脚本在运行时从 Markdown 抽取
 * ```ts 代码块 → 用仓库已有的 typescript 做 strict 类型检查 → 转译并真实运行，
 * 因此正文改动会自动同步到测试，不存在"另写一套实现"的可能。
 *
 * 验证分层（三者严格区分，不得混为一谈）：
 *   [T] 类型层：tsc --strict 诊断必须为 0；
 *   [R] 运行层：本地 Mock Server + 独立子进程代理，真实 HTTP 往返断言；
 *   [N] 真实厂商 API：**不测试**（无密钥、不访问外网厂商端点）。
 *
 * 覆盖：TokenBucket 边界 / 身份认证 / 用户配额 / 并发限制 / 429 与 5xx /
 *       超时与有限重试 / SSE 分块解析 / usage 缺失 / 成本记账。
 *
 * 只依赖 Node 原生模块与项目已有 devDependency（typescript），不引入运行时依赖。
 */
import { createServer, request as httpRequest } from 'node:http';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { setTimeout as delay } from 'node:timers/promises';
import { ROOT } from './lib/paths.mjs';
import { createReporter } from './lib/report.mjs';

const R = createReporter('test-article-code');
const requireFromRoot = createRequire(join(ROOT, 'package.json'));
const ts = requireFromRoot('typescript');

/* ─────────────── 1. 从文章抽取代码（唯一事实源 = 正文） ─────────────── */
const ARTICLES = [
  'llm-api-security',
  'high-concurrency-llm-api',
  'llm-api-integration',
  'llm-api-cost-governance'
];
const GUIDE_DIR = join(ROOT, 'src/content/guides/zh-CN');
const FENCE = '```';
const BLOCK_RE = new RegExp(FENCE + 'ts\\n([\\s\\S]*?)' + FENCE, 'g');

const work = mkdtempSync(join(tmpdir(), 'reflex-article-code-'));
const modules = {};      // name -> 抽取后的 TS 源码（按文章顺序拼接）
const blockModules = {}; // 'security__1' 等：需要单独 require 的块（服务器程序不能与纯函数混在一起）
const tsFiles = [];

for (const name of ARTICLES) {
  const md = readFileSync(join(GUIDE_DIR, `${name}.md`), 'utf8');
  const blocks = [...md.matchAll(BLOCK_RE)].map(m => m[1]);
  if (!blocks.length) { R.fail(`${name}: 未抽取到 ts 代码块`, '正文代码块格式可能已改变'); continue; }
  modules[name] = blocks.join('\n\n');
  const file = join(work, `${name}.ts`);
  writeFileSync(file, modules[name], 'utf8');
  tsFiles.push(file);
  if (name === 'llm-api-security') {
    blocks.forEach((code, i) => {
      const key = `security__${i + 1}`;
      blockModules[key] = code;
      const f = join(work, `${key}.ts`);
      writeFileSync(f, code, 'utf8');
      tsFiles.push(f);
    });
  }
}
/* 4 篇文章按整篇拼接（4 个模块）+ 安全文章按块拆出 2 个（纯函数与服务器程序不能同进程加载）= 6 */
R.check('A0 四篇文章抽出可验证的 TypeScript 模块', tsFiles.length >= 6, `${tsFiles.length} 个模块`);

/* ─────────────── 2. [T] 类型层：strict 诊断必须为 0 ─────────────── */
const program = ts.createProgram(tsFiles, {
  strict: true,
  noEmit: true,
  target: ts.ScriptTarget.ES2022,
  module: ts.ModuleKind.CommonJS,
  moduleResolution: ts.ModuleResolutionKind.Node10,
  types: ['node'],
  typeRoots: [join(ROOT, 'node_modules/@types')],
  skipLibCheck: true
});
const errors = ts.getPreEmitDiagnostics(program).filter(d => d.category === ts.DiagnosticCategory.Error);
const formatDiag = d => {
  const msg = ts.flattenDiagnosticMessageText(d.messageText, ' ');
  if (!d.file) return msg;
  const { line } = d.file.getLineAndCharacterOfPosition(d.start || 0);
  return `${d.file.fileName.split(/[\\/]/).pop()}:${line + 1} ${msg}`;
};
R.check('[T] tsc --strict 诊断为 0', errors.length === 0, errors.slice(0, 5).map(formatDiag).join(' | '));

/* 转译为 CJS 后真实 require（Node 无法直接执行参数属性等非可擦除语法） */
const transpile = code => ts.transpileModule(code, {
  compilerOptions: {
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.CommonJS,
    esModuleInterop: true
  }
}).outputText;

const load = (name, code) => {
  const file = join(work, `${name}.cjs`);
  writeFileSync(file, transpile(code), 'utf8');
  return requireFromRoot(file);
};

let gov, conc, integ, secPure;
try {
  gov = load('governance', modules['llm-api-cost-governance']);
  conc = load('concurrency', modules['high-concurrency-llm-api']);
  integ = load('integration', modules['llm-api-integration']);
  /* 安全文章块 1 是纯函数（脱敏），块 2 是会 listen 的服务器 → 后者作为子进程运行 */
  secPure = load('security_pure', blockModules['security__1']);
  writeFileSync(join(work, 'proxy.cjs'), transpile(blockModules['security__2']), 'utf8');
} catch (e) {
  R.fail('A1 文章代码可转译并加载', e.message);
  R.summary();
  process.exit(1);
}
R.pass('A1 文章代码可转译并加载为可执行模块');

/* ─────────────── 3. Mock 上游（进程内） ─────────────── */
const mock = { mode: 'ok', hits: 0, auth: [], streamPrev: 0 };
const mockServer = createServer((req, res) => {
  let body = '';
  req.on('data', c => { body += c; });
  req.on('end', async () => {
    mock.hits++;
    mock.auth.push(req.headers.authorization || '');
    const mode = mock.mode;
    if (mode === 'hang') { setTimeout(() => res.destroy(), 3000); return; }
    if (mode === 'rate429') { res.writeHead(429, { 'retry-after': '0', 'content-type': 'application/json' }); return res.end('{"error":"rate"}'); }
    if (mode === 'rate429once' && mock.hits === 1) { res.writeHead(429, { 'retry-after': '0', 'content-type': 'application/json' }); return res.end('{"error":"rate"}'); }
    if (mode === 'err500') { res.writeHead(500); return res.end('{"error":"boom"}'); }
    if (mode === 'err500once' && mock.hits === 1) { res.writeHead(500); return res.end('{"error":"boom"}'); }
    if (mode === 'auth401') { res.writeHead(401); return res.end('{"error":"unauthorized"}'); }

    if (mode === 'stream') {
      res.writeHead(200, { 'content-type': 'text/event-stream' });
      const payload =
        'data: {"choices":[{"delta":{"content":"你"}}]}\n\n' +
        'data: {"choices":[{"delta":{"content":"好"}}]}\n\n' +
        'data: {"choices":[{"delta":{}}],"usage":{"prompt_tokens":9,"completion_tokens":4}}\n\n' +
        'data: [DONE]\n\n';
      /* 故意切在事件中间，检验正文里"保留残余缓冲"的解析逻辑 */
      for (const cut of [7, 23, 41, 60, payload.length]) {
        res.write(payload.slice(mock.streamPrev, cut));
        mock.streamPrev = cut;
        await delay(3);
      }
      mock.streamPrev = 0;
      return res.end();
    }
    const usage = mode === 'ok-no-usage' ? '' : ',"usage":{"prompt_tokens":12,"completion_tokens":7}';
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(`{"choices":[{"message":{"content":"pong"}}]${usage}}`);
  });
});
await new Promise(r => mockServer.listen(0, '127.0.0.1', r));
const MOCK_BASE = `http://127.0.0.1:${mockServer.address().port}/v1`;
const reset = (mode) => { mock.mode = mode; mock.hits = 0; mock.auth = []; mock.streamPrev = 0; };

function post(port, path, { token, body = '{}', timeoutMs = 8000 } = {}) {
  return new Promise((resolve, reject) => {
    const req = httpRequest({
      host: '127.0.0.1', port, path, method: 'POST',
      headers: {
        'content-type': 'application/json',
        'content-length': Buffer.byteLength(body),
        ...(token ? { authorization: `Bearer ${token}` } : {})
      }
    }, res => {
      let data = '';
      res.on('data', c => { data += c; });
      res.on('end', () => resolve({ status: res.statusCode, body: data }));
    });
    req.setTimeout(timeoutMs, () => req.destroy(new Error('client timeout')));
    req.on('error', reject);
    req.end(body);
  });
}

/* ─────────────── 4. [R] 运行层断言 ─────────────── */

/* 4.1 TokenBucket 边界（正文 high-concurrency：take(n) 与容量约束） */
console.log('\n# TokenBucket 边界');
{
  const bucket = new conc.TokenBucket(10, 10);
  const wait0 = await bucket.take(10);
  R.check('[R] 桶内令牌足够时立即放行（等待 0ms）', wait0 === 0);
  const t0 = Date.now();
  const waited = await bucket.take(5);
  const elapsed = Date.now() - t0;
  R.check('[R] 令牌不足时按补充速率等待（5 个 @10/s ≈ 500ms）', waited >= 400 && elapsed >= 400, `waited=${waited}ms elapsed=${elapsed}ms`);
  let rangeErr = null;
  try { await new conc.TokenBucket(3, 10).take(5); } catch (e) { rangeErr = e; }
  R.check('[R] 单次请求超过桶容量时快速失败（而非死循环）', rangeErr instanceof RangeError, String(rangeErr));
}

/* 4.2 并发闸门（Semaphore） */
console.log('\n# 并发闸门');
{
  const gate = new conc.Semaphore(2);
  let inflight = 0, maxInflight = 0;
  await Promise.all(Array.from({ length: 8 }, async () => {
    await gate.acquire();
    inflight++; maxInflight = Math.max(maxInflight, inflight);
    await delay(20);
    inflight--; gate.release();
  }));
  R.check('[R] 在途请求被限制在并发上限内', maxInflight <= 2, `maxInflight=${maxInflight}`);
  R.check('[R] 全部完成后 in-flight 归零（名额释放无泄漏）', gate.inflight === 0, `inflight=${gate.inflight}`);
}

/* 4.3 重试策略（withRetry：可重试分类 / 上限 / 预算） */
console.log('\n# 有限重试');
{
  let calls = 0;
  const okResult = await conc.withRetry(async () => {
    calls++;
    if (calls < 3) throw Object.assign(new Error('429'), { code: 429 });
    return 'ok';
  }, { isRetryable: e => e.code === 429, baseMs: 5, maxAttempts: 5 });
  R.check('[R] 可重试错误重试后成功', okResult === 'ok' && calls === 3, `calls=${calls}`);

  calls = 0;
  let thrown = null;
  try {
    await conc.withRetry(async () => { calls++; throw Object.assign(new Error('400'), { code: 400 }); },
      { isRetryable: e => e.code === 429, baseMs: 5, maxAttempts: 5 });
  } catch (e) { thrown = e; }
  R.check('[R] 不可重试错误只发一次请求', calls === 1 && thrown?.code === 400, `calls=${calls}`);

  calls = 0; thrown = null;
  try {
    await conc.withRetry(async () => { calls++; throw Object.assign(new Error('500'), { code: 500 }); },
      { isRetryable: e => e.code === 500, baseMs: 5, maxAttempts: 3 });
  } catch (e) { thrown = e; }
  R.check('[R] 重试次数上限生效（恰好 maxAttempts 次）', calls === 3 && thrown?.code === 500, `calls=${calls}`);

  calls = 0; thrown = null;
  try {
    await conc.withRetry(async () => { calls++; throw Object.assign(new Error('500'), { code: 500 }); },
      { isRetryable: e => e.code === 500, baseMs: 200, maxAttempts: 10, budgetMs: 250 });
  } catch (e) { thrown = e; }
  R.check('[R] 总时长预算耗尽时提前放弃', calls < 10 && thrown?.code === 500, `calls=${calls}`);
}

/* 4.4 接入客户端：正常 / 429 / 5xx / 超时 / usage 缺失 / SSE */
console.log('\n# 接入客户端（chat / streamChat）');
{
  reset('ok');
  const normal = await integ.chat({ model: 'm', messages: [{ role: 'user', content: 'ping' }] }, { baseUrl: MOCK_BASE, apiKey: 'k' });
  R.check('[R] 正常请求返回文本与 usage', normal.text === 'pong' && normal.usage.input === 12 && normal.usage.output === 7, JSON.stringify(normal));

  reset('ok-no-usage');
  const noUsage = await integ.chat({ model: 'm', messages: [] }, { baseUrl: MOCK_BASE, apiKey: 'k' });
  R.check('[R] usage 缺失时回退 0/0 且不产生 NaN', noUsage.usage.input === 0 && noUsage.usage.output === 0 && Number.isFinite(noUsage.usage.input + noUsage.usage.output), JSON.stringify(noUsage.usage));

  reset('auth401');
  let err = null;
  try { await integ.chat({ model: 'm', messages: [] }, { baseUrl: MOCK_BASE, apiKey: 'k' }); } catch (e) { err = e; }
  R.check('[R] 401 归类为 auth 且不重试（只发 1 次）', err?.kind === 'auth' && err?.retryable === false && mock.hits === 1, `${err?.kind} hits=${mock.hits}`);

  reset('rate429once');
  const after429 = await integ.chat({ model: 'm', messages: [] }, { baseUrl: MOCK_BASE, apiKey: 'k', maxAttempts: 3 });
  R.check('[R] 上游 429 后重试成功', after429.text === 'pong' && mock.hits === 2, `hits=${mock.hits}`);

  reset('err500once');
  const after500 = await integ.chat({ model: 'm', messages: [] }, { baseUrl: MOCK_BASE, apiKey: 'k', maxAttempts: 3 });
  R.check('[R] 上游 5xx 后重试成功', after500.text === 'pong' && mock.hits === 2, `hits=${mock.hits}`);

  reset('err500');
  err = null;
  try { await integ.chat({ model: 'm', messages: [] }, { baseUrl: MOCK_BASE, apiKey: 'k', maxAttempts: 3 }); } catch (e) { err = e; }
  R.check('[R] 持续 5xx：达到上限后抛出 server', err?.kind === 'server' && mock.hits === 3, `${err?.kind} hits=${mock.hits}`);

  reset('hang');
  err = null;
  try { await integ.chat({ model: 'm', messages: [] }, { baseUrl: MOCK_BASE, apiKey: 'k', maxAttempts: 2, timeoutMs: 300 }); } catch (e) { err = e; }
  R.check('[R] 上游挂起触发超时并归类为 timeout', err?.kind === 'timeout' && mock.hits === 2, `${err?.kind} hits=${mock.hits}`);

  err = null;
  try { await integ.chat({ model: 'm', messages: [] }, { baseUrl: 'http://127.0.0.1:1/v1', apiKey: 'k', maxAttempts: 1, timeoutMs: 500 }); } catch (e) { err = e; }
  R.check('[R] 连接失败归类为 network', err?.kind === 'network', String(err?.kind));

  reset('stream');
  const deltas = [];
  let streamUsage = null;
  for await (const chunk of integ.streamChat({ model: 'm', messages: [] }, { baseUrl: MOCK_BASE, apiKey: 'k' })) {
    if (chunk.delta) deltas.push(chunk.delta);
    if (chunk.usage) streamUsage = chunk.usage;
  }
  R.check('[R] SSE 跨分块边界仍能完整还原文本', deltas.join('') === '你好', deltas.join(''));
  R.check('[R] SSE 末帧 usage 被捕获', streamUsage?.input === 9 && streamUsage?.output === 4, JSON.stringify(streamUsage));

  reset('auth401');
  err = null;
  try { await integ.streamChat({ model: 'm', messages: [] }, { baseUrl: MOCK_BASE, apiKey: 'k' }).next(); } catch (e) { err = e; }
  R.check('[R] SSE 非 2xx 抛错（不静默返回空流）', err?.kind === 'auth', String(err?.kind));
}

/* 4.5 成本记账（costOf / anomalyRatio） */
console.log('\n# 成本记账');
{
  const price = { modelId: 'm', effectiveFrom: '2026-10-31', currency: 'CNY', inputPerMTok: 2, outputPerMTok: 8, cacheReadPerMTok: 0.1, cacheWritePerMTok: 2.5 };
  R.check('[R] 常规成本 = 输入 + 输出', Math.abs(gov.costOf(price, { inputTokens: 1e6, outputTokens: 1e6 }) - 10) < 1e-9);
  R.check('[R] 缓存命中按命中价计费', Math.abs(gov.costOf(price, { inputTokens: 1e6, outputTokens: 1e6, cacheReadTokens: 1e6 }) - 8.1) < 1e-9);
  R.check('[R] 缓存写入按写入价计费', Math.abs(gov.costOf(price, { inputTokens: 1e6, outputTokens: 0, cacheWriteTokens: 1e6 }) - 2.5) < 1e-9);
  const noCachePrice = { ...price, cacheReadPerMTok: null, cacheWritePerMTok: null };
  R.check('[R] 缓存价未公开时回退未命中价（不是 0）', Math.abs(gov.costOf(noCachePrice, { inputTokens: 1e6, outputTokens: 0, cacheReadTokens: 1e6 }) - 2) < 1e-9);
  const tiered = {
    modelId: 't', effectiveFrom: '2026-10-31', currency: 'CNY', inputPerMTok: 2.1, outputPerMTok: 8.4,
    cacheReadPerMTok: null, cacheWritePerMTok: null,
    tiers: [{ upToInputTokens: 524288, inputPerMTok: 2.1, outputPerMTok: 8.4 }, { upToInputTokens: null, inputPerMTok: 4.2, outputPerMTok: 16.8 }]
  };
  R.check('[R] 恰好等于档位边界仍用低档', Math.abs(gov.costOf(tiered, { inputTokens: 524288, outputTokens: 1e6 }) - (524288 * 2.1 / 1e6 + 8.4)) < 1e-9);
  R.check('[R] 越过边界后整次请求按高档计', Math.abs(gov.costOf(tiered, { inputTokens: 524289, outputTokens: 1e6 }) - (524289 * 4.2 / 1e6 + 16.8)) < 1e-9);
  R.check('[R] usage 字段缺失不产生 NaN', Number.isFinite(gov.costOf(price, { inputTokens: 1e6, outputTokens: 1e6, cacheReadTokens: undefined })));
  R.check('[R] 异常检测：样本不足返回 null', gov.anomalyRatio(100, [1, 2, 3]) === null);
  R.check('[R] 异常检测：基线中位数为 0 返回 null', gov.anomalyRatio(100, [0, 0, 0, 0, 0, 0, 0]) === null);
  R.check('[R] 异常检测：偶数样本取中位均值', gov.anomalyRatio(9, [1, 2, 3, 4, 5, 6, 7, 8]) === 2);
}

/* 4.6 安全代理（子进程 + 真实 HTTP）：身份认证 / 配额 / 429 / 5xx / 超时 / 并发 / 释放 */
console.log('\n# 安全代理（独立进程）');
{
  R.check('[R] 日志脱敏：敏感头被替换、普通头保留',
    (() => {
      const out = secPure.redactHeaders({ Authorization: 'Bearer sk-real', 'Content-Type': 'application/json', cookie: 'a=b', 'X-Api-Key': 'sk-2' });
      return out.Authorization === '[redacted]' && out.cookie === '[redacted]' && out['X-Api-Key'] === '[redacted]' && out['Content-Type'] === 'application/json';
    })());

  /* 测试专用垫片：把 AbortSignal.timeout 上限压到 600ms（文章里是 60s），不修改正文代码 */
  const shim = join(work, 'limit-timeout.cjs');
  writeFileSync(shim, [
    'const orig = AbortSignal.timeout.bind(AbortSignal);',
    'AbortSignal.timeout = ms => orig(Math.min(ms, 600));',
    ''
  ].join('\n'), 'utf8');

  const children = [];
  const freePort = () => new Promise(resolve => {
    const s = createServer();
    s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => resolve(p)); });
  });

  async function startProxy({ quota }) {
    const port = await freePort();
    const child = spawn(process.execPath, ['--require', shim, join(work, 'proxy.cjs')], {
      cwd: ROOT,
      env: { ...process.env, LLM_API_BASE: MOCK_BASE, LLM_API_KEY: 'upstream-key', SESSION_SECRET: 's', PORT: String(port), DAILY_TOKEN_QUOTA: String(quota) },
      stdio: ['ignore', 'pipe', 'pipe']
    });
    let log = '';
    child.stdout.on('data', d => { log += d; });
    child.stderr.on('data', d => { log += d; });
    children.push(child);
    for (let i = 0; i < 100; i++) {
      try { await post(port, '/api/chat', {}); break; } catch { await delay(40); }
    }
    return { port, log: () => log };
  }

  try {
    /* 身份认证 + 上游异常 + 超时 + 并发 + 释放（大配额进程） */
    reset('ok');
    const big = await startProxy({ quota: 1_000_000 });
    const noToken = await post(big.port, '/api/chat', {});
    R.check('[R] 无令牌 → 401', noToken.status === 401, String(noToken.status));
    R.check('[R] 未认证请求不会消耗上游额度', mock.hits === 0, `hits=${mock.hits}`);
    const badToken = await post(big.port, '/api/chat', { token: 'no-signature-part' });
    R.check('[R] 令牌格式非法 → 401', badToken.status === 401, String(badToken.status));
    reset('ok');
    const good = await post(big.port, '/api/chat', { token: 'user-1.sig' });
    R.check('[R] 认证通过 → 转发上游并回传 body', good.status === 200 && good.body.includes('pong'), `${good.status}`);
    R.check('[R] 上游收到的是服务端持有的 Key', mock.auth.at(-1) === 'Bearer upstream-key', String(mock.auth.at(-1)));

    reset('rate429');
    const p429 = await post(big.port, '/api/chat', { token: 'user-2.sig' });
    R.check('[R] 上游持续 429 → 重试一次后回传 429', p429.status === 429 && mock.hits === 2, `${p429.status} hits=${mock.hits}`);

    reset('err500');
    const p500 = await post(big.port, '/api/chat', { token: 'user-2.sig' });
    R.check('[R] 上游持续 5xx → 重试一次后回传 5xx', p500.status === 500 && mock.hits === 2, `${p500.status} hits=${mock.hits}`);

    reset('hang');
    const timedOut = await post(big.port, '/api/chat', { token: 'user-3.sig' }, { timeoutMs: 6000 });
    R.check('[R] 上游挂起 → 代理超时后返回 502', timedOut.status === 502, String(timedOut.status));

    reset('hang');
    const burst = await Promise.all(Array.from({ length: 6 }, () => post(big.port, '/api/chat', { token: 'user-4.sig' }, { timeoutMs: 6000 })));
    R.check('[R] 并发闸门：6 个并发中至少 1 个被拒绝', burst.filter(r => r.status === 429).length >= 1, burst.map(r => r.status).join(','));
    R.check('[R] 并发拒绝给出明确原因', burst.some(r => r.body.includes('concurrent')), burst.map(r => r.body).join('|').slice(0, 60));

    reset('ok');
    const afterBurst = await post(big.port, '/api/chat', { token: 'user-4.sig' });
    R.check('[R] 超时/拒绝之后槽位释放，仍可正常服务', afterBurst.status === 200, String(afterBurst.status));

    /* 用户配额（小配额进程：单次 usage 19 > 1） */
    reset('ok');
    const small = await startProxy({ quota: 1 });
    const first = await post(small.port, '/api/chat', { token: 'user-q.sig' });
    const second = await post(small.port, '/api/chat', { token: 'user-q.sig' });
    R.check('[R] 配额耗尽后返回 429', first.status === 200 && second.status === 429, `${first.status}/${second.status}`);
    R.check('[R] 配额拦截发生在上游调用之前', mock.hits === 1, `hits=${mock.hits}`);
    const otherUser = await post(small.port, '/api/chat', { token: 'user-r.sig' });
    R.check('[R] 配额按用户隔离', otherUser.status === 200, String(otherUser.status));
  } finally {
    for (const c of children) c.kill();
  }
}

/* ─────────────── 5. 收尾 ─────────────── */
mockServer.close();
mockServer.closeAllConnections();
try { rmSync(work, { recursive: true, force: true }); } catch { /* 临时目录清理失败不影响结论 */ }
R.pass('[N] 真实厂商 API 未测试（无密钥、不访问外网；本脚本仅验证 [T] 类型层与 [R] 运行层）');
R.summary();
