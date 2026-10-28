/**
 * Reflex Hub · 静态页预生成脚本（Node ≥18，零依赖）
 * 读取 dist/assets/data/{models,tools,pages}.json → 生成模型详情页、对比页、工具详情页、
 * 并向手写页注入静态内容（模型卡片/工具分组/成本参考表/页脚）→ 生成 sitemap.xml
 * 运行：node scripts/build.mjs（幂等，产物与构建日期无关）
 */
import { readFileSync, writeFileSync, mkdirSync, readdirSync, rmSync, statSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { DIST, SITE, BRAND } from './lib/paths.mjs';
import { SAMPLE_PARAMS as P, monthly, monthlyBase, money, price, verdict, modelCurrency, fxEntry, toBase } from './lib/pricing.mjs';
import { esc, safeUrl, jsStr, jsonld } from './lib/escape.mjs';
import { loadData, maxDate, comparePairs, isToolIndexable, buildManifest } from './lib/manifest.mjs';
import { navHeaderHtml, footerNavHtml } from './lib/nav.mjs';

const { models, tools, pagesMeta, fx, compares } = loadData();
const round2 = n => Math.round(n * 100) / 100;
const fxNote = cur => {
  const e = fxEntry(fx, cur);
  return e && e.rateDate ? `1 USD = ${e.rate} CNY（中国外汇交易中心中间价 ${e.rateDate}）` : null;
};

/* 是/否图标（内联 SVG，替代 ✅/❌ emoji，跨设备渲染一致） */
const ICON_YES = '<svg class="yn" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12.5l5 5L20 6.5" stroke="#0E8A5F" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const ICON_NO = '<svg class="yn" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" stroke="#B0523C" stroke-width="3" fill="none" stroke-linecap="round"/></svg>';

/* ---------- 全站静态页脚（合规文字必须存在于原始 HTML，不得依赖 JS fetch） ---------- */
function footerHtml(base) {
  const verified = maxDate(models.map(m => m.verifiedAt));
  const seen = new Set();
  const links = [];
  for (const m of models) {
    const u = safeUrl(m.sourceUrl);
    if (u && !seen.has(u)) {
      seen.add(u);
      links.push(`<a href="${esc(u)}" target="_blank" rel="noopener">${esc(m.sourceName)}</a>`);
    }
  }
  return `<p>数据来源：${links.join(' · ')}</p>
    <p>模型价格最近核验日期：<span class="num">${esc(verified)}</span>（各模型、各工具的核验日期以对应页面标注为准）</p>
    <p>价格数据以厂商官方页面为准，不构成任何采购建议</p>
    <p>DeepSeek、GLM、Kimi、Qwen 等名称与商标归各厂商所有，本站为第三方数据整理，与厂商无隶属关系</p>
    ${footerNavHtml(base)}
    <p>© 2026 ${BRAND} · 免费 · 免注册 · 打开即用</p>`;
}

/* ---------- 共享模板 ---------- */
function tagsHtml(m) {
  const mods = (m.modalities || []).map(x => `<span class="tag tag-mod">${esc(x)}</span>`).join('');
  const feats = (m.features || []).map(x => `<span class="tag tag-feat">${esc(x)}</span>`).join('');
  return mods || feats ? `<span class="m-tags">${mods}${feats}</span>` : '';
}

function page({ depth, title, desc, canonicalPath, robots = null, jsonld: lds = [], crumb, main, inlineScript = '', active = null }) {
  const base = '../'.repeat(depth);
  const ld = lds
    .map(o => `  <script type="application/ld+json">\n${jsonld(o).split('\n').map(l => '  ' + l).join('\n')}\n  </script>`)
    .join('\n');
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${esc(title)}</title>
  <meta name="description" content="${esc(desc)}">
${robots ? `  <meta name="robots" content="${esc(robots)}">\n` : ''}  <link rel="canonical" href="${SITE}${canonicalPath}">
  <meta property="og:type" content="website">
  <meta property="og:site_name" content="${esc(BRAND)}">
  <meta property="og:title" content="${esc(title)}">
  <meta property="og:description" content="${esc(desc)}">
  <meta property="og:url" content="${SITE}${canonicalPath}">
  <meta property="og:image" content="${SITE}/assets/og-cover.png">
  <link rel="icon" href="/favicon.ico" sizes="any">
  <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png">
  <link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png">
  <link rel="apple-touch-icon" href="/apple-touch-icon.png">
  <link rel="manifest" href="/manifest.json">
  <link rel="stylesheet" href="${base}assets/style.css">
${ld}
</head>
<body>
  ${navHeaderHtml(base, active, crumb)}

  <main class="wrap" id="main">
${main}
  </main>

  <footer>
    <div class="wrap" id="site-footer">
    ${footerHtml(base)}
    </div>
  </footer>

  <script>window.ASSETS_BASE = '${base}assets';</script>
  <script src="${base}assets/app.js"></script>
${inlineScript}
</body>
</html>
`;
}

function writePage(relPath, html) {
  const p = join(DIST, relPath);
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, html, 'utf8');
}

function breadcrumb(items) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((it, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: it.name,
      item: SITE + it.path
    }))
  };
}

/* ---------- 模型详情页 ---------- */
function priceTable(m) {
  const cur = modelCurrency(m);
  const rows = [];
  if (m.priceTiers) {
    rows.push(['输入价（未命中）', m.priceTiers.map(t => `${esc(t.desc)} ${t.unverified ? '费率未公开' : price(t.priceIn, cur)}`).join('　')]);
    rows.push(['输出价', m.priceTiers.map(t => `${esc(t.desc)} ${t.unverified ? '费率未公开' : price(t.priceOut, cur)}`).join('　')]);
    rows.push(['缓存命中价', m.priceTiers.every(t => t.priceCacheHit == null) ? '未公开' : m.priceTiers.map(t => `${esc(t.desc)} ${price(t.priceCacheHit, cur)}`).join('　')]);
    rows.push(['分档规则', `${ICON_YES} 按输入长度分档，计算器按你的输入长度自动选档`]);
  } else if (m.peakOffpeak) {
    const p = m.peakOffpeak;
    rows.push(['输入价（未命中）', `高峰 ${price(p.peakIn, cur)} / 低谷 ${price(p.offIn, cur)}`]);
    rows.push(['输出价', `高峰 ${price(p.peakOut, cur)} / 低谷 ${price(p.offOut, cur)}`]);
    rows.push(['缓存命中价', `高峰 ${price(p.peakCache, cur)} / 低谷 ${price(p.offCache, cur)}`]);
    rows.push(['分时段', `${ICON_YES} 高峰时段 = ${esc(p.peakWindow)}，其余时间为低谷价`]);
  } else {
    rows.push(['输入价（未命中）', price(m.priceIn, cur)]);
    rows.push(['输出价', price(m.priceOut, cur)]);
    rows.push(['缓存命中价', price(m.priceCacheHit, cur)]);
    rows.push(['分时段', `${ICON_NO} 单一价格`]);
  }
  if (m.priceCacheWrite != null) rows.push(['缓存写入价', `${price(m.priceCacheWrite, cur)}（30 分钟 / 5 分钟档，未计入月成本估算）`]);
  if (cur === 'USD') {
    const note = fxNote('USD');
    rows.push(['计价币种', `美元（USD / 百万 Token）${note ? `；人民币折算参考：${esc(note)}` : '；参考汇率未核实，暂不提供折算'}`]);
  }
  return rows.map(r => `          <tr><th>${r[0]}</th><td class="num">${r[1]}</td></tr>`).join('\n');
}

function modelDetail(m) {
  const modText = (m.modalities || []).join('、');
  const featText = (m.features || []).join('、');
  const src = safeUrl(m.sourceUrl);
  const srcCell = src
    ? `<a href="${esc(src)}" target="_blank" rel="noopener">${esc(m.sourceName)}</a>`
    : esc(m.sourceName);
  const cur = modelCurrency(m);
  const curName = cur === 'USD' ? '美元' : '人民币';
  const lede = `${m.name} 是${m.vendor}推出的大模型，支持${modText}，上下文窗口 ${m.context}K。API 定价（${curName}刊例原价）：输入 ${price(m.priceIn, cur)}/百万Token、输出 ${price(m.priceOut, cur)}/百万Token${m.priceCacheHit != null ? `、缓存命中 ${price(m.priceCacheHit, cur)}` : ''}${m.peakOffpeak ? '，分时段定价（低谷价约为高峰一半）' : ''}。数据核验日期 ${m.verifiedAt}，来源可点击查验。`;
  const siblings = models.filter(x => x.vendor === m.vendor && x.id !== m.id);
  const siblingHtml = siblings.length
    ? `<p class="lib-meta">同厂商收录：${siblings.map(s => `<a href="../${esc(s.id)}/">${esc(s.name)}</a>`).join(' · ')}</p>`
    : '';
  /* 相关对比：同厂商兄弟 + compares.json allowlist 中含该模型的组合（每模型至多 4 条，重建不丢失） */
  const allow = (compares.extraPairs || [])
    .filter(([x, y]) => x === m.id || y === m.id)
    .slice(0, 4)
    .map(([x, y]) => {
      const [nx, ny] = [x, y].sort(); /* URL 必须 a<b 归一，与 comparePairs 生成路径一致 */
      const other = x === m.id ? y : x;
      const om = models.find(mm => mm.id === other);
      return om ? `<a href="../../compare/${esc(nx)}/${esc(ny)}/">${esc(m.name)} vs ${esc(om.name)}</a>` : '';
    }).filter(Boolean);
  const siblingLinks = siblings.map(s => {
    const [x, y] = [m.id, s.id].sort();
    return `<a href="../../compare/${esc(x)}/${esc(y)}/">${esc(m.name)} vs ${esc(s.name)}</a>`;
  });
  const allCmpLinks = [...new Set([...siblingLinks, ...allow])];
  const compareHtml = allCmpLinks.length
    ? `<p class="lib-meta">相关对比：${allCmpLinks.slice(0, 5).join(' · ')}</p>`
    : '';

  const main = `    <section class="hero" style="text-align:left;padding-bottom:0">
      <h1 style="font-size:26px">${esc(m.name)}</h1>
      <p class="tagline">${esc(m.vendor)} · ${esc(featText)}</p>
      ${tagsHtml(m)}
    </section>

    <p class="lede">${esc(lede)}</p>

    <section class="panel">
      <h2>价格（${cur === 'USD' ? '美元' : '人民币'} / 百万Token）</h2>
      <div class="table-scroll">
        <table class="spec">
          <tbody>
${priceTable(m)}
          </tbody>
        </table>
      </div>
    </section>

    <section class="panel">
      <h2>规格档案</h2>
      <div class="table-scroll">
        <table class="spec">
          <tbody>
            <tr><th>上下文窗口</th><td class="num">${m.context}K</td></tr>
            <tr><th>支持模态</th><td>${esc(modText)}</td></tr>
            <tr><th>特点</th><td>${esc(featText)}</td></tr>
            <tr><th>厂商 / 渠道</th><td>${esc(m.vendor)}</td></tr>
            <tr><th>数据来源</th><td>${srcCell}</td></tr>
            <tr><th>核验日期</th><td class="num">${esc(m.verifiedAt)}</td></tr>
          </tbody>
        </table>
      </div>
      ${siblingHtml}
      ${compareHtml}
    </section>

    <section class="panel">
      <h2>数据说明与使用限制</h2>
      <p class="s-hint" style="line-height:1.9">
        · 价格为厂商公开刊例原价（人民币 / 百万 Token），不含限时活动与套餐优惠，实际以官方页面与控制台为准；<br>
        · 成本估算结果不等同于服务商实际账单，不构成采购建议；本页不推断模型性能或质量排名；<br>
        · 厂商 / 渠道标注的是该价格的官方来源，不代表本站与厂商存在隶属或背书关系。${m.priceNote ? '<br>· ' + esc(m.priceNote) : ''}
      </p>
    </section>

    <div class="cta-row">
      <a class="btn btn-primary" href="../../cost/?models=${esc(m.id)}">在成本计算器中估算 →</a>
      <a class="btn btn-ghost" href="../../compare/?a=${esc(m.id)}">与其他模型对比 →</a>
      <a class="btn btn-ghost" href="../../models/">返回模型库</a>
    </div>`;

  const ld = {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: m.name,
    applicationCategory: 'DeveloperApplication',
    operatingSystem: 'API',
    description: lede,
    url: `${SITE}/models/${m.id}/`
  };
  if (src) ld.sameAs = src;
  /* 不输出 Offer：priceIn 是每百万 Token 的 API 计费单价，不是软件购买价格 */

  return page({
    depth: 2,
    title: `${m.name} 价格与参数档案 - ${m.vendor} | ${BRAND}`,
    desc: `${m.name}（${m.vendor}）API 价格（${modelCurrency(m) === 'USD' ? '美元' : '人民币'}）：输入 ${price(m.priceIn, modelCurrency(m))}/输出 ${price(m.priceOut, modelCurrency(m))} 每百万Token，上下文 ${m.context}K，支持${modText}。数据核验于 ${m.verifiedAt}。`,
    canonicalPath: `/models/${m.id}/`,
    jsonld: [
      ld,
      breadcrumb([{ name: '首页', path: '/' }, { name: '模型库', path: '/models/' }, { name: m.name, path: `/models/${m.id}/` }])
    ],
    crumb: `/ <a href="../" style="color:inherit">模型库</a> / ${esc(m.name)}`,
    main,
    active: 'models',
    inlineScript: `  <script>window.track('model_view', { id: ${jsStr(m.id)} });</script>`
  });
}

/* ---------- 对比页 ---------- */
function cellPrice(m, kind) {
  const cur = modelCurrency(m);
  if (m.priceTiers) {
    const key = kind === 'in' ? 'priceIn' : kind === 'out' ? 'priceOut' : 'priceCacheHit';
    if (kind === 'cache' && m.priceTiers.every(t => t.priceCacheHit == null)) return '未公开';
    return m.priceTiers.map(t => `${esc(t.desc)} ${t.unverified ? '未公开' : price(t[key], cur)}`).join('　');
  }
  if (m.peakOffpeak) {
    const p = m.peakOffpeak;
    if (kind === 'in') return `高峰 ${price(p.peakIn, cur)} / 低谷 ${price(p.offIn, cur)}`;
    if (kind === 'out') return `高峰 ${price(p.peakOut, cur)} / 低谷 ${price(p.offOut, cur)}`;
    return `高峰 ${price(p.peakCache, cur)} / 低谷 ${price(p.offCache, cur)}`;
  }
  if (kind === 'in') return price(m.priceIn, cur);
  if (kind === 'out') return price(m.priceOut, cur);
  return price(m.priceCacheHit, cur);
}

/* 示例月成本口径（错峰低谷价）下的单价，用于摘要区的事实性单价对比 */
function lowPrices(m) {
  return m.peakOffpeak
    ? { i: m.peakOffpeak.offIn, c: m.peakOffpeak.offCache, o: m.peakOffpeak.offOut }
    : { i: m.priceIn, c: m.priceCacheHit, o: m.priceOut };
}
const fmtDiff = n => '¥' + (Math.round(Math.abs(n) * 100) / 100);

function compareDetail(a, b) {
  const curA = modelCurrency(a), curB = modelCurrency(b);
  const mixed = curA !== curB;
  const ca = monthly(a), cb = monthly(b); /* 各自官方币种原价 */
  const ba = toBase(ca, curA, fx), bb = toBase(cb, curB, fx); /* 统一折算 CNY；汇率未核实为 null */
  const fxOk = ba != null && bb != null;
  const v = fxOk ? verdict(ba, bb) : 'na'; /* 'a' | 'b' | 'tie' | 'na'（无法统一折算时不标任何一方） */
  const cnyEst = (x, cur) => (cur === 'CNY' ? money(x, 'CNY') : toBase(x, cur, fx) != null ? `约 ${money(toBase(x, cur, fx))}` : '汇率未核实，无法折算');
  const rows = [
    ['厂商 / 渠道', esc(a.vendor), esc(b.vendor), false],
    ['上下文窗口', `${a.context}K`, `${b.context}K`, false],
    ['支持模态', esc((a.modalities || []).join('、')), esc((b.modalities || []).join('、')), false],
    ['特点', esc((a.features || []).join('、')), esc((b.features || []).join('、')), false],
    ['输入价（未命中）', cellPrice(a, 'in'), cellPrice(b, 'in'), false],
    ['输出价', cellPrice(a, 'out'), cellPrice(b, 'out'), false],
    ['缓存命中价', cellPrice(a, 'cache'), cellPrice(b, 'cache'), false],
    ['分时段', a.peakOffpeak ? `${ICON_YES} 低谷价约为高峰一半（高峰=${esc(a.peakOffpeak.peakWindow)}）` : ICON_NO, b.peakOffpeak ? `${ICON_YES} 低谷价约为高峰一半（高峰=${esc(b.peakOffpeak.peakWindow)}）` : ICON_NO, false],
    ['示例月成本*', `${money(ca, curA)}${mixed ? `<br><span class="lib-meta">${cnyEst(ca, curA)}</span>` : ''}${v === 'tie' ? '（持平）' : ''}`, `${money(cb, curB)}${mixed ? `<br><span class="lib-meta">${cnyEst(cb, curB)}</span>` : ''}${v === 'tie' ? '（持平）' : ''}`, true],
    ['数据来源', srcLink(a), srcLink(b), false],
    ['核验日期', esc(a.verifiedAt), esc(b.verifiedAt), false]
  ];
  const body = rows.map(r => {
    const ca2 = r[3] ? (v === 'a' ? ' class="win num"' : ' class="num"') : '';
    const cb2 = r[3] ? (v === 'b' ? ' class="win num"' : ' class="num"') : '';
    return `          <tr><th>${r[0]}</th><td${ca2}>${r[1]}</td><td${cb2}>${r[2]}</td></tr>`;
  }).join('\n');

  /* ---- 对比摘要：只写能从 models.json 数据直接推导、且口径明确的事实 ---- */
  const pa = lowPrices(a), pb = lowPrices(b);
  const sum = [];
  const fxDesc = mixed ? `；跨币种按参考汇率（${esc(fxNote('USD') || '未核实')}）统一折算为人民币后比较，折算值仅供参考` : '';
  if (!fxOk) {
    sum.push(`估算月成本：${esc(a.name)} ${money(ca, curA)} vs ${esc(b.name)} ${money(cb, curB)}——两者币种不同且参考汇率未核实，无法统一折算，不能直接比较成本。`);
  } else if (v === 'tie') {
    sum.push(`估算月成本持平：统一折算后两者均约 ${money(ba)}（展示精度 0.01 元内相同${mixed ? '，原价分别为 ' + money(ca, curA) + ' 与 ' + money(cb, curB) : ''}）。`);
    sum.push('成本比例：按该口径两者相同；该结论仅在当前刊例价、汇率与上述固定用量假设下成立。');
  } else {
    const cheaper = v === 'a' ? a : b;
    const dearer = v === 'a' ? b : a;
    const ct = v === 'a' ? ba : bb, dt = v === 'a' ? bb : ba; /* ct=便宜方成本, dt=贵方成本（CNY 折算口径） */
    sum.push(`估算月成本：统一折算后 ${esc(a.name)} ${money(ba)} vs ${esc(b.name)} ${money(bb)}（原价 ${money(ca, curA)} / ${money(cb, curB)}）——在该固定用量下 ${esc(cheaper.name)} 更低，相差 ${fmtDiff(Math.abs(ba - bb))}/月。`);
    sum.push(`成本比例：按该口径，${esc(dearer.name)} 的估算月成本约为 ${esc(cheaper.name)} 的 ${(dt / ct).toFixed(1)} 倍（${esc(cheaper.name)} 便宜约 ${((1 - ct / dt) * 100).toFixed(0)}%）。该比例只在当前刊例价、汇率与上述固定用量假设下成立，不代表模型能力、输出质量或综合性价比。`);
  }
  const unitRow = (label, x, y) => {
    const bx = toBase(x, curA, fx), by = toBase(y, curB, fx);
    if (bx == null || by == null) return `${label}：${esc(a.name)} ${price(x, curA)} vs ${esc(b.name)} ${price(y, curB)}（币种不同且汇率未核实，未做差额比较）。`;
    if (Math.abs(bx - by) < 0.005) return `${label}折算后持平：均约 ${money(bx)}（原价 ${price(x, curA)} / ${price(y, curB)}）。`;
    const lower = bx < by ? a : b;
    return `${label}：原价 ${price(x, curA)} vs ${price(y, curB)}，折算后 ${esc(lower.name)} 更低（差约 ${fmtDiff(bx - by)}/百万Token）。`;
  };
  sum.push(unitRow('输入单价（错峰低谷/单一价口径）', pa.i, pb.i));
  sum.push(unitRow('输出单价（错峰低谷/单一价口径）', pa.o, pb.o));
  const cacheNote = (m, c) => (c == null ? `${esc(m.name)} 未公开缓存价（估算时按未命中价计）` : `${esc(m.name)} ${price(c, modelCurrency(m))}`);
  sum.push(`缓存命中价（低谷口径）：${cacheNote(a, pa.c)}；${cacheNote(b, pb.c)}。`);
  if (mixed) sum.push(`币种说明：${esc(a.name)} 为 ${curA} 官方原价，${esc(b.name)} 为 ${curB} 官方原价；折算采用中国外汇交易中心中间价（见下），仅供参考。`);
  if (a.context === b.context) {
    sum.push(`上下文窗口相同：均为 ${a.context}K。`);
  } else {
    const bigger = a.context > b.context ? a : b;
    const smaller = a.context > b.context ? b : a;
    sum.push(`上下文窗口：${esc(a.name)} ${a.context}K vs ${esc(b.name)} ${b.context}K，${esc(bigger.name)} 为 ${esc(smaller.name)} 的 ${(bigger.context / smaller.context).toFixed(1)} 倍。`);
  }
  const modA = a.modalities || [], modB = b.modalities || [];
  const onlyA = modA.filter(x => !modB.includes(x)), onlyB = modB.filter(x => !modA.includes(x));
  if (!onlyA.length && !onlyB.length) {
    sum.push(`支持模态相同：${esc(modA.join('、'))}。`);
  } else {
    sum.push(`支持模态：${esc(a.name)}=${esc(modA.join('、'))}；${esc(b.name)}=${esc(modB.join('、'))}${onlyA.length ? `（${esc(a.name)} 多出 ${esc(onlyA.join('、'))}）` : ''}${onlyB.length ? `（${esc(b.name)} 多出 ${esc(onlyB.join('、'))}）` : ''}。`);
  }
  sum.push(`数据来源：${esc(a.sourceName)}（核验 ${esc(a.verifiedAt)}）、${esc(b.sourceName)}（核验 ${esc(b.verifiedAt)}）；计价单位：官方原币种 / 百万 Token（${esc(a.name)} ${curA === 'USD' ? '美元' : '人民币'}、${esc(b.name)} ${curB === 'USD' ? '美元' : '人民币'}${mixed ? '；跨币种按上方参考汇率折算为人民币估算，仅供参考' : ''}）。`);

  const main = `    <section class="hero" style="text-align:left;padding-bottom:0">
      <h1 style="font-size:26px">${esc(a.name)} <span style="color:var(--muted);font-weight:400">vs</span> ${esc(b.name)}</h1>
      <p class="tagline">${esc(a.vendor)} vs ${esc(b.vendor)} · 价格与规格逐项对比</p>
    </section>

    <p class="lede">${esc(a.name)}（${esc(a.vendor)}）与 ${esc(b.name)}（${esc(b.vendor)}）的逐项对比：输入/输出/缓存命中价格、分时段、上下文窗口、支持模态与固定参数示例月成本。绿色为该项更优。</p>

    <div class="table-scroll" style="margin-top:20px">
      <table class="spec wide">
        <thead>
          <tr><th>维度</th><th>${esc(a.name)}</th><th>${esc(b.name)}</th></tr>
        </thead>
        <tbody>
${body}
        </tbody>
      </table>
    </div>
    <p class="s-hint">* 示例月成本固定参数：日均 100 次调用 · 单次输入 2000 / 输出 800 Token · 错峰（低谷价）· 缓存命中率 30%，公式与默认值同 <a href="../../../cost/">成本计算器</a> 一致。美元模型按参考汇率统一折算为人民币后比较（折算见摘要）。两者成本在展示精度内相同时标记持平，不突出任何一方。</p>

    <section class="panel">
      <h2>对比摘要（固定用量口径）</h2>
      <ul style="font-size:14px;line-height:1.9;padding-left:20px;margin:0">
${sum.map(s => `        <li>${s}</li>`).join('\n')}
      </ul>
      <p class="s-hint" style="margin-top:10px">以上仅为公开价目在指定调用量、输入输出 Token 数、缓存假设与计费规则下的计算结果与数据对比，不代表模型能力、输出质量或综合性价比排名，不构成采购建议。</p>
    </section>

    <div class="cta-row">
      <a class="btn btn-primary" href="../../../cost/?models=${esc(a.id)},${esc(b.id)}" onclick="window.track('compare_to_cost', { a: ${jsStr(a.id)}, b: ${jsStr(b.id)} })">按你的用量精确算 →</a>
      <a class="btn btn-ghost" href="../../../models/${esc(a.id)}/">${esc(a.name)} 档案</a>
      <a class="btn btn-ghost" href="../../../models/${esc(b.id)}/">${esc(b.name)} 档案</a>
    </div>`;

  return page({
    depth: 3,
    title: `${a.name} vs ${b.name} 对比 - 价格/上下文/模态 | ${BRAND}`,
    desc: `${a.name}（${a.vendor}）与 ${b.name}（${b.vendor}）API 逐项对比：输入输出价格、缓存命中、分时段、上下文窗口、模态与示例月成本。`,
    canonicalPath: `/compare/${a.id}/${b.id}/`,
    jsonld: [
      breadcrumb([{ name: '首页', path: '/' }, { name: '模型对比', path: '/compare/' }, { name: `${a.name} vs ${b.name}`, path: `/compare/${a.id}/${b.id}/` }])
    ],
    crumb: `/ <a href="../../" style="color:inherit">模型对比</a> / ${esc(a.name)} vs ${esc(b.name)}`,
    main,
    active: 'compare',
    inlineScript: `  <script>window.track('compare_view', { a: ${jsStr(a.id)}, b: ${jsStr(b.id)} });</script>`
  });
}

function srcLink(m) {
  const u = safeUrl(m.sourceUrl);
  return u ? `<a href="${esc(u)}" target="_blank" rel="noopener">${esc(m.sourceName)}</a>` : esc(m.sourceName);
}

/* ---------- 工具详情页 ---------- */
function toolDetail(t) {
  const indexable = isToolIndexable(t);
  const u = safeUrl(t.url);
  const lede = `${t.name} 是一款${t.category}类 AI 工具——${t.tagline}。适用场景：${t.scene}。收费模式：${t.free}。信息核验日期 ${t.verifiedAt}，以官网实际为准。`;
  const related = tools.filter(x => x.category === t.category && x.id !== t.id).slice(0, 4);

  const ld = {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: t.name,
    applicationCategory: 'UtilitiesApplication',
    operatingSystem: 'Web',
    description: lede,
    url: `${SITE}/tools/${t.id}/`
  };
  if (u) ld.sameAs = u;
  /* 仅"免费"工具可准确表达 Offer price=0；免费增值/付费无法用单一价格准确表达时不输出 Offer */
  if (t.free === '免费') {
    ld.offers = { '@type': 'Offer', price: '0', priceCurrency: 'CNY', description: '免费使用' };
  }

  const main = `    <section class="hero" style="text-align:left;padding-bottom:0">
      <h1 style="font-size:26px">${esc(t.name)}<span class="free-badge free-${esc(t.free)}">${esc(t.free)}</span></h1>
      <p class="tagline">${esc(t.tagline)}</p>
    </section>

    <p class="lede">${esc(lede)}</p>

    <section class="panel">
      <h2>速览</h2>
      <div class="table-scroll">
        <table class="spec">
          <tbody>
            <tr><th>类别</th><td>${esc(t.category)}</td></tr>
            <tr><th>收费模式</th><td>${esc(t.free)}</td></tr>
            <tr><th>适用场景</th><td>${esc(t.scene)}</td></tr>
            <tr><th>官网</th><td>${u ? `<a href="${esc(u)}" target="_blank" rel="noopener">${esc(u)}</a>` : '未收录'}</td></tr>
            <tr><th>核验日期</th><td class="num">${esc(t.verifiedAt)}</td></tr>
          </tbody>
        </table>
      </div>
      ${related.length ? `<p class="lib-meta">同类工具：${related.map(r => `<a href="../${esc(r.id)}/">${esc(r.name)}</a>`).join(' · ')}</p>` : ''}
    </section>

    <div class="cta-row">
      ${u ? `<a class="btn btn-primary" href="${esc(u)}" target="_blank" rel="noopener" onclick="window.track('tool_outbound', { id: ${jsStr(t.id)} })">访问官网 →</a>` : ''}
      <a class="btn btn-ghost" href="../">返回工具库</a>
    </div>`;

  return page({
    depth: 2,
    title: `${t.name} - ${t.category}类 AI 工具介绍 | ${BRAND}`,
    desc: `${t.name}：${t.tagline}。适用场景：${t.scene}。收费模式：${t.free}。`,
    canonicalPath: `/tools/${t.id}/`,
    robots: indexable ? null : 'noindex,follow',
    jsonld: [ld, breadcrumb([{ name: '首页', path: '/' }, { name: '工具库', path: '/tools/' }, { name: t.name, path: `/tools/${t.id}/` }])],
    crumb: `/ <a href="../" style="color:inherit">工具库</a> / ${esc(t.name)}`,
    main,
    active: 'tools'
  });
}

/* 成本计算示例：与交互计算器/静态表同一公式（pricing.mjs），数据全部来自 models.json */
function costExampleHtml() {
  const m = models.find(x => x.peakOffpeak) || models[0];
  const b = m.peakOffpeak
    ? { i: m.peakOffpeak.offIn, c: m.peakOffpeak.offCache, o: m.peakOffpeak.offOut, label: '低谷价（错峰）' }
    : { i: m.priceIn, c: m.priceCacheHit, o: m.priceOut, label: '标准价' };
  const effIn = b.c == null ? b.i : P.hit * b.c + (1 - P.hit) * b.i;
  const inCost = P.calls * 30 * (P.inTok / 1e6) * effIn;
  const outCost = P.calls * 30 * (P.outTok / 1e6) * b.o;
  const cacheLine = b.c == null
    ? `该模型未公开缓存价，输入按未命中价 ${price(b.i)} 计。`
    : `输入有效单价 = 30% × ${price(b.c)}（缓存命中）+ 70% × ${price(b.i)}（未命中）= ${round2(effIn)} 元/百万 Token。`;
  return `      <div class="table-scroll">
        <table class="spec">
          <tbody>
            <tr><th>示例模型</th><td><a href="../models/${esc(m.id)}/">${esc(m.name)}</a>（${esc(m.vendor)}，${b.label}，数据核验 ${esc(m.verifiedAt)}，<a href="${esc(safeUrl(m.sourceUrl) || '#')}" target="_blank" rel="noopener">官方来源</a>）</td></tr>
            <tr><th>输入有效单价</th><td class="num">${cacheLine}</td></tr>
            <tr><th>输入成本</th><td class="num">${P.calls} 次 × 30 天 × (${P.inTok} ÷ 1,000,000) × ${round2(effIn)} = ${money(round2(inCost))}</td></tr>
            <tr><th>输出成本</th><td class="num">${P.calls} 次 × 30 天 × (${P.outTok} ÷ 1,000,000) × ${price(b.o)} = ${money(round2(outCost))}</td></tr>
            <tr><th>估算月成本</th><td class="num"><strong>${money(round2(inCost + outCost))}</strong>（示例仅为固定假设下的估算，不构成采购建议）</td></tr>
          </tbody>
        </table>
      </div>`;
}

/* 指南页算例：从 models.json 选数据完整（含公开缓存价、单一价）的模型，步骤与 pricing.mjs 公式一致 */
function guideExampleHtml() {
  const m = models.find(x => x.priceCacheHit != null && !x.peakOffpeak) || models[0];
  const src = safeUrl(m.sourceUrl);
  const effIn = P.hit * m.priceCacheHit + (1 - P.hit) * m.priceIn;
  const inCost = P.calls * 30 * (P.inTok / 1e6) * effIn;
  const outCost = P.calls * 30 * (P.outTok / 1e6) * m.priceOut;
  return `      <div class="table-scroll">
        <table class="spec">
          <tbody>
            <tr><th>模型与来源</th><td><a href="../../models/${esc(m.id)}/">${esc(m.name)}</a>（${esc(m.vendor)}），刊例原价：输入 ${price(m.priceIn)} / 输出 ${price(m.priceOut)} / 缓存命中 ${price(m.priceCacheHit)} 每百万 Token；<a href="${esc(src || '#')}" target="_blank" rel="noopener">官方来源</a>，核验日期 ${esc(m.verifiedAt)}</td></tr>
            <tr><th>第 1 步：输入有效单价</th><td class="num">30% × ${price(m.priceCacheHit)} + 70% × ${price(m.priceIn)} = ${round2(effIn)} 元/百万 Token</td></tr>
            <tr><th>第 2 步：输入成本</th><td class="num">100 次/天 × 30 天 × (2000 ÷ 1,000,000) × ${round2(effIn)} = ${money(round2(inCost))}</td></tr>
            <tr><th>第 3 步：输出成本</th><td class="num">100 次/天 × 30 天 × (800 ÷ 1,000,000) × ${price(m.priceOut)} = ${money(round2(outCost))}</td></tr>
            <tr><th>第 4 步：合计</th><td class="num"><strong>${money(round2(inCost + outCost))} / 月</strong>（刊例估算，不等于实际账单）</td></tr>
          </tbody>
        </table>
      </div>`;
}

/* ---------- 手写页静态内容注入 ---------- */
function injectRegion(relPath, startMark, endMark, content) {
  const p = join(DIST, relPath);
  const html = readFileSync(p, 'utf8');
  const s = html.indexOf(startMark);
  const e = html.indexOf(endMark);
  if (s < 0 || e < 0 || e < s) throw new Error(`标记缺失或顺序错误：${relPath} 缺少 ${startMark} / ${endMark}`);
  writeFileSync(p, html.slice(0, s + startMark.length) + '\n' + content + '\n      ' + html.slice(e), 'utf8');
}

function modelCardsHtml() {
  return models.map(m => {
    const cur = modelCurrency(m);
    const priceLine = m.priceTiers
      ? `${esc(m.priceTiers[0].desc)} 入${price(m.priceTiers[0].priceIn, cur)} / 出${price(m.priceTiers[0].priceOut, cur)} · 分档`
      : m.peakOffpeak
        ? `高峰 入${price(m.peakOffpeak.peakIn, cur)} / 出${price(m.peakOffpeak.peakOut, cur)} · 低谷半价`
        : `输入 ${price(m.priceIn, cur)} / 输出 ${price(m.priceOut, cur)}`;
    const cnyLine = cur === 'USD'
      ? `<p class="lib-meta">约 ¥${(m.priceIn * (fxEntry(fx, 'USD')?.rate || 0)).toFixed(2)} / ¥${(m.priceOut * (fxEntry(fx, 'USD')?.rate || 0)).toFixed(2)}（按中间价折算，仅供参考）</p>`
      : '';
    const costCny = monthlyBase(m, fx); /* 价格排序键：默认用量月成本统一折算 CNY，未核实不参与排序（空串） */
    return `      <a class="module-card active" href="${esc(m.id)}/" data-search="${esc(`${m.name} ${m.id} ${m.vendor}`.toLowerCase())}" data-vendor="${esc(m.vendor)}" data-cur="${cur}" data-cost="${costCny == null ? '' : costCny.toFixed(4)}" data-ctx="${m.context}" data-verified="${esc(m.verifiedAt)}">
        <h3>${esc(m.name)}</h3>
        <p>${esc(m.vendor)}</p>
        <p class="num">${priceLine}</p>
        ${cnyLine}
        <p class="lib-meta">上下文 ${m.context}K · ${m.peakOffpeak ? '分时段' : m.priceTiers ? '分档计价' : '单一价'} · ${cur === 'USD' ? '美元原价 · ' : ''}核验 ${esc(m.verifiedAt)}</p>
        <span class="go">查看档案 →</span>
      </a>`;
  }).join('\n');
}

const TOOL_ORDER = ['自研', '对话', '绘图', '视频', '编程', '办公'];
const TOOL_TITLES = { '自研': '本站自研工具' };
function toolGroupsHtml(pairsCount) {
  /* 自研工具 tagline 中的数量占位符由真实数据填充，杜绝硬编码旧值 */
  const fill = s => s.replace(/\{modelCount\}/g, String(models.length)).replace(/\{compareCount\}/g, String(pairsCount));
  const out = [];
  for (const cat of TOOL_ORDER) {
    const list = tools.filter(t => t.category === cat);
    if (!list.length) continue;
    out.push(`      <h2 class="group-title">${TOOL_TITLES[cat] || esc(cat)}</h2>\n      <div class="tool-grid">`);
    for (const t of list) {
      if (t.own) {
        out.push(`        <div class="result-card">
          <div class="r-head"><span class="r-name">${esc(t.name)}<span class="free-badge own-badge">自研</span></span></div>
          <p style="font-size:14px;margin-top:6px">${fill(esc(t.tagline))}</p>
          <p class="lib-meta">场景：${esc(t.scene)}</p>
          <div class="cta-row"><a class="btn btn-primary btn-s" href="${esc(t.url)}">立即使用 →</a></div>
        </div>`);
      } else {
        const u = safeUrl(t.url);
        out.push(`        <div class="result-card">
          <div class="r-head"><span class="r-name">${esc(t.name)}<span class="free-badge free-${esc(t.free)}">${esc(t.free)}</span></span></div>
          <p style="font-size:14px;margin-top:6px">${esc(t.tagline)}</p>
          <p class="lib-meta">场景：${esc(t.scene)} · 核验 ${esc(t.verifiedAt)}</p>
          <div class="cta-row"><a class="btn btn-ghost btn-s" href="${esc(t.id)}/">详情</a>${u ? `<a class="btn btn-primary btn-s" href="${esc(u)}" target="_blank" rel="noopener" data-tool="${esc(t.id)}">官网 →</a>` : ''}</div>
        </div>`);
      }
    }
    out.push('      </div>');
  }
  return out.join('\n');
}

/* 成本参考表：与交互计算器同一公式（scripts/lib/pricing.mjs monthly + SAMPLE_PARAMS） */
function costTableHtml() {
  const rows = models.map(m => {
    const cur = modelCurrency(m);
    const src = safeUrl(m.sourceUrl);
    const inCell = m.priceTiers ? m.priceTiers.map(t => `${esc(t.desc)} ${t.unverified ? '未公开' : price(t.priceIn, cur)}`).join('<br>') : m.peakOffpeak ? `高峰 ${price(m.peakOffpeak.peakIn, cur)}<br>低谷 ${price(m.peakOffpeak.offIn, cur)}` : price(m.priceIn, cur);
    const outCell = m.priceTiers ? m.priceTiers.map(t => `${esc(t.desc)} ${t.unverified ? '未公开' : price(t.priceOut, cur)}`).join('<br>') : m.peakOffpeak ? `高峰 ${price(m.peakOffpeak.peakOut, cur)}<br>低谷 ${price(m.peakOffpeak.offOut, cur)}` : price(m.priceOut, cur);
    const cacheRaw = m.peakOffpeak ? m.peakOffpeak.offCache : m.priceCacheHit;
    const cacheCell = cacheRaw == null ? '未公开' : (m.peakOffpeak ? `高峰 ${price(m.peakOffpeak.peakCache, cur)}<br>低谷 ${price(m.peakOffpeak.offCache, cur)}` : price(m.priceCacheHit, cur));
    const estCny = monthlyBase(m, fx);
    const estCell = estCny == null ? '该档位费率未公开，无法估算' : (cur === 'USD' ? `约 ${money(estCny)}` : money(estCny));
    return `          <tr><th><a href="../models/${esc(m.id)}/">${esc(m.name)}</a></th><td>${esc(m.vendor)}</td><td class="num">${inCell}</td><td class="num">${outCell}</td><td class="num">${cacheCell}</td><td class="num">${estCell}</td><td class="num">${esc(m.verifiedAt)}</td><td>${src ? `<a href="${esc(src)}" target="_blank" rel="noopener">${esc(m.sourceName)}</a>` : esc(m.sourceName)}</td></tr>`;
  }).join('\n');
  const usdNote = models.some(m => modelCurrency(m) === 'USD')
    ? `美元为官方原始币种；估算月成本按中国外汇交易中心中间价（${esc(fxNote('USD') || '汇率未核实')}）折算为人民币，仅供参考。`
    : '';
  return `      <div class="table-scroll">
        <table class="spec wide">
          <thead>
            <tr><th>模型</th><th>厂商 / 渠道</th><th>输入价<br>（刊例原价/百万Token）</th><th>输出价<br>（刊例原价/百万Token）</th><th>缓存命中价</th><th>估算月成本（元）</th><th>核验日期</th><th>官方价格来源</th></tr>
          </thead>
          <tbody>
${rows}
          </tbody>
        </table>
      </div>
      <p class="s-hint" style="margin-top:8px">缓存价未公开的模型按未命中价计（不假设缓存折扣）；分时段模型按低谷价计（与上方"错峰"开关一致）；分档模型按示例输入 2000 Token 落入的档位计价。估算月成本列与下方交互计算器使用完全相同的公式、默认参数与参考汇率。${usdNote}两款模型逐项对比请用 <a href="../compare/">模型对比</a>。</p>`;
}

/* ---------- 生成 ---------- */
/* 仅清理已下架模型/工具/组合的过期目录（保留手写的 index.html）；仍在清单内的目录直接覆盖写入，
   不做全量删除——构建幂等且减少无谓的删除操作 */
function pruneStale(dir, keep) {
  if (!existsSync(dir)) return;
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory() && !keep.has(name)) rmSync(p, { recursive: true, force: true });
  }
}

const pairs = comparePairs(models, compares.extraPairs || []);
pruneStale(join(DIST, 'models'), new Set(models.map(m => m.id)));
pruneStale(join(DIST, 'tools'), new Set(tools.filter(t => !t.own).map(t => t.id)));
pruneStale(join(DIST, 'compare'), new Set(pairs.map(([a]) => a)));

let count = 0;
for (const m of models) {
  writePage(`models/${m.id}/index.html`, modelDetail(m));
  count++;
}
for (const t of tools) {
  if (t.own) continue; /* 自研工具的"详情页"就是模块本身，不生成薄页 */
  writePage(`tools/${t.id}/index.html`, toolDetail(t));
  count++;
}

for (const [a, b] of pairs) {
  const ma = models.find(m => m.id === a), mb = models.find(m => m.id === b);
  writePage(`compare/${a}/${b}/index.html`, compareDetail(ma, mb));
  count++;
}
/* 有效组合清单：供 /compare/ 选择器校验，避免跳转到未生成的组合（仅 allowlist 组合有页面） */
writeFileSync(join(DIST, 'assets/data/compare-pairs.json'), JSON.stringify({
  description: '已生成的对比页组合清单（a<b 归一）。/compare/ 选择器仅允许跳转清单内组合；新增组合须登记 compares.json allowlist 并重新构建。',
  pairs
}, null, 1) + '\n', 'utf8');

/* 手写页静态注入：模型卡片 / 工具分组 / 成本参考表 / 全站页脚 */
injectRegion('models/index.html', '<!-- MODEL_CARDS_START -->', '<!-- MODEL_CARDS_END -->', modelCardsHtml());
injectRegion('tools/index.html', '<!-- TOOL_GROUPS_START -->', '<!-- TOOL_GROUPS_END -->', toolGroupsHtml(pairs.length));
injectRegion('cost/index.html', '<!-- COST_TABLE_START -->', '<!-- COST_TABLE_END -->', costTableHtml());
injectRegion('cost/index.html', '<!-- COST_EXAMPLE_START -->', '<!-- COST_EXAMPLE_END -->', costExampleHtml());
injectRegion('guides/llm-api-cost/index.html', '<!-- GUIDE_EXAMPLE_START -->', '<!-- GUIDE_EXAMPLE_END -->', guideExampleHtml());

/* 数据驱动的数量文案：全部来自构建时真实数据，禁止手写数量 */
injectRegion('compare/index.html', '<!-- CMP_STATS_START -->', '<!-- CMP_STATS_END -->',
  `<p class="s-hint">全部 ${pairs.length} 组对比（${models.length} 款模型两两全组合）均可通过上方选择器进入；每个对比页都有固定口径摘要与双向模型档案链接。</p>`);
injectRegion('index.html', '<!-- HOME_CMP_START -->', '<!-- HOME_CMP_END -->', `${pairs.length} 组`);
const sortFxNote = fxNote('USD');
injectRegion('models/index.html', '<!-- MODEL_TOOLBAR_META_START -->', '<!-- MODEL_TOOLBAR_META_END -->',
  `<p class="s-hint" style="margin:-6px 0 14px">价格排序按默认用量估算月成本（与成本计算器同口径）统一折算为人民币${sortFxNote ? `（${esc(sortFxNote)}，折算仅供参考）` : '（参考汇率未核实，美元模型不参与价格排序）'}；费率未核实的模型不参与价格排序。</p>`);

/* 统一全站导航：手写页与 404 经标记注入共享模板（生成页由 page() 直接输出） */
const NAV_PAGES = [
  ['index.html', '', 'home', ''],
  ['cost/index.html', '../', 'cost', '/ 成本计算器'],
  ['models/index.html', '../', 'models', '/ 模型库'],
  ['compare/index.html', '../', 'compare', '/ 模型对比'],
  ['quiz/index.html', '../', null, '/ 段位测试'],
  ['tools/index.html', '../', 'tools', '/ 工具库'],
  ['prompts/index.html', '../', 'prompts', '/ Prompt库'],
  ['about/index.html', '../', null, '/ 关于本站'],
  ['guides/llm-api-cost/index.html', '../../', 'cost', '/ <a href="../../cost/" style="color:inherit">成本计算器</a> / 计算指南'],
  ['404.html', '/', null, '']
];
for (const [rel, base, active, crumb] of NAV_PAGES) {
  injectRegion(rel, '<!-- NAV_START -->', '<!-- NAV_END -->', '  ' + navHeaderHtml(base, active, crumb));
}

const FOOTER_PAGES = [
  ['index.html', ''],
  ['cost/index.html', '../'],
  ['models/index.html', '../'],
  ['compare/index.html', '../'],
  ['quiz/index.html', '../'],
  ['tools/index.html', '../'],
  ['prompts/index.html', '../'],
  ['about/index.html', '../'],
  ['guides/llm-api-cost/index.html', '../../']
];
for (const [rel, base] of FOOTER_PAGES) {
  injectRegion(rel, '<!-- FOOTER_START -->', '<!-- FOOTER_END -->', '    ' + footerHtml(base));
}

/* ---------- sitemap（清单与 lastmod 规则见 scripts/lib/manifest.mjs；不使用构建日期） ---------- */
const entries = buildManifest({ models, tools, pagesMeta, compares });
const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries.map(e => e.lastmod
  ? `  <url>\n    <loc>${SITE}${e.path}</loc>\n    <lastmod>${e.lastmod}</lastmod>\n  </url>`
  : `  <url>\n    <loc>${SITE}${e.path}</loc>\n  </url>`).join('\n')}
</urlset>
`;
writeFileSync(join(DIST, 'sitemap.xml'), xml, 'utf8');

console.log(`build ok: ${models.length} model + ${pairs.length} compare + ${tools.filter(t => !t.own).length} tool = ${count} pages, sitemap ${entries.length} urls（lastmod 取数据/内容真实更新日期，与构建日期无关）`);
