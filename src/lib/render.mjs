/**
 * 页面片段渲染（HTML 字符串）：由旧 scripts/build.mjs 的模板函数机械搬迁而来。
 *
 * 为什么仍是返回 HTML 字符串的纯函数：
 *  - 迁移目标是"替换渲染层与路由"，正文/价格表/对比表的字节级行为必须保持不变（§9.5 产物对拍）；
 *  - Astro 页面通过 <Fragment set:html={...} /> 注入，组件化的是布局与路由，而不是重写正文模板。
 * 元数据（title/description/canonical/robots/JSON-LD/crumb/inlineScript）由这些函数一并返回，
 * 交给 Layout 组件统一输出 head（旧版 page() 的职责）。
 */
import { SITE, BRAND } from './paths.mjs';
import { SAMPLE_PARAMS as P, monthly, monthlyFull, monthlyBase, money, price, verdict, modelCurrency, fxEntry, toBase } from './pricing.mjs';
import { esc, safeUrl, jsStr } from './escape.mjs';
import { maxDate, isToolIndexable } from './manifest.mjs';
import { footerNavHtml } from './nav.mjs';
import { EN_MODELS } from './locales.mjs';
import { EN_VENDOR, EN_MODALITY, EN_FEATURE, EN_MODEL_COPY, EN_TOOL, EN_TOOL_CATEGORY, EN_TOOL_FREE, EN_TOOL_NAME, enTierDesc } from './i18n.mjs';
import { models, tools, compares, fx, pairs, enModelName, enSrcLabel, enVendorLabel, enToolName } from './site.mjs';

/* 英文汇率注释：与 fxNote 同一事实数据（fx.json），仅文案为英文 */
const enFxNote = cur => {
  const e = fxEntry(fx, cur);
  return e && e.rate > 0 && e.rateDate ? `1 ${cur} = ${e.rate} CNY, CFETS central parity rate ${e.rateDate}` : null;
};
const round2 = n => Math.round(n * 100) / 100;
const fxNote = cur => {
  const e = fxEntry(fx, cur);
  return e && e.rateDate ? `1 USD = ${e.rate} CNY（中国外汇交易中心中间价 ${e.rateDate}）` : null;
};

const ICON_YES = '<svg class="yn" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12.5l5 5L20 6.5" stroke="#0E8A5F" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const ICON_NO = '<svg class="yn" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" stroke="#B0523C" stroke-width="3" fill="none" stroke-linecap="round"/></svg>';

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

/* ---------- 英文站静态页脚：合规文字英文等价，"中文站"组保留中文信任页入口（含开发指南，N12b 覆盖） ---------- */
function footerHtmlEn(base) {
  const verified = maxDate(models.map(m => m.verifiedAt));
  const seen = new Set();
  const links = [];
  for (const m of models) {
    const u = safeUrl(m.sourceUrl);
    if (u && !seen.has(u)) {
      seen.add(u);
      links.push(`<a href="${esc(u)}" target="_blank" rel="noopener">${esc(enSrcLabel(m))}</a>`);
    }
  }
  return `<p>Price sources: ${links.join(' · ')}</p>
    <p>Most recent model price verification: <span class="num">${esc(verified)}</span> (each page shows its own verification date)</p>
    <p>Prices follow the vendors' official pages and do not constitute any purchase advice</p>
    <p>DeepSeek, GLM, Kimi, Qwen and other names and trademarks belong to their respective owners. This site is an independent third-party data compilation with no vendor affiliation.</p>
    <nav class="footer-nav" aria-label="Footer navigation">
      <p>Core tools: <a href="${base}en/">Home</a> · <a href="${base}en/cost/">Cost Calculator</a> · <a href="${base}en/models/glm-53-flash/">GLM-5.3-Flash</a></p>
      <p>Chinese site: <a href="${base}">Home</a> · <a href="${base}cost/">Cost Calculator</a> · <a href="${base}models/">Model Library</a> · <a href="${base}guides/">Guides</a> · <a href="${base}about/">About</a> · <a href="${base}pricing-methodology/">Pricing Methodology</a> · <a href="${base}privacy/">Privacy Policy</a> · <a href="${base}terms/">Terms of Use</a></p>
      <p><a href="https://github.com/cheneychen2000/ai-station-tools/issues" target="_blank" rel="noopener">Feedback on GitHub</a></p>
    </nav>
    <p>© 2026 ${BRAND} · Free · No sign-up · Runs entirely in your browser</p>`;
}

function tagsHtml(m) {
  const mods = (m.modalities || []).map(x => `<span class="tag tag-mod">${esc(x)}</span>`).join('');
  const feats = (m.features || []).map(x => `<span class="tag tag-feat">${esc(x)}</span>`).join('');
  return mods || feats ? `<span class="m-tags">${mods}${feats}</span>` : '';
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

  return {
    /* 可选单页 SEO 覆盖：models.json 中 seoTitle/seoDescription 仅对个别页面生效，缺省回退统一模板 */
    title: (typeof m.seoTitle === 'string' && m.seoTitle.trim()) ? m.seoTitle : `${m.name} 价格与参数档案 - ${m.vendor} | ${BRAND}`,
    desc: (typeof m.seoDescription === 'string' && m.seoDescription.trim()) ? m.seoDescription : `${m.name}（${m.vendor}）API 价格（${modelCurrency(m) === 'USD' ? '美元' : '人民币'}）：输入 ${price(m.priceIn, modelCurrency(m))}/输出 ${price(m.priceOut, modelCurrency(m))} 每百万Token，上下文 ${m.context}K，支持${modText}。数据核验于 ${m.verifiedAt}。`,
    canonicalPath: `/models/${m.id}/`,
    jsonld: [
      ld,
      breadcrumb([{ name: '首页', path: '/' }, { name: '模型库', path: '/models/' }, { name: m.name, path: `/models/${m.id}/` }])
    ],
    crumb: `/ <a href="../" style="color:inherit">模型库</a> / ${esc(m.name)}`,
    main,
    active: 'models',
    inlineScript: `  <script>window.track('model_view', { id: ${jsStr(m.id)} });</script>`
  };
}

function enPriceRows(m) {
  const cur = modelCurrency(m);
  const rows = [];
  if (m.priceTiers) {
    rows.push(['Input (cache miss)', m.priceTiers.map(t => `${esc(enTierDesc(t.desc))} ${t.unverified ? 'rate not published' : price(t.priceIn, cur)}`).join('　')]);
    rows.push(['Output', m.priceTiers.map(t => `${esc(enTierDesc(t.desc))} ${t.unverified ? 'rate not published' : price(t.priceOut, cur)}`).join('　')]);
    rows.push(['Cache hit', m.priceTiers.every(t => t.priceCacheHit == null) ? 'Not published' : m.priceTiers.map(t => t.priceCacheHit == null ? 'not published' : price(t.priceCacheHit, cur)).join('　')]);
    rows.push(['Tiered pricing', `${ICON_YES} Billed by input length; the cost calculator selects the tier automatically`]);
  } else if (m.peakOffpeak) {
    const p = m.peakOffpeak;
    rows.push(['Input (cache miss)', `Peak ${price(p.peakIn, cur)} / off-peak ${price(p.offIn, cur)}`]);
    rows.push(['Output', `Peak ${price(p.peakOut, cur)} / off-peak ${price(p.offOut, cur)}`]);
    rows.push(['Cache hit', `Peak ${price(p.peakCache, cur)} / off-peak ${price(p.offCache, cur)}`]);
    rows.push(['Time-based pricing', `${ICON_YES} Peak window: ${esc(EN_PEAK_WINDOW(p.peakWindow))}; all other times use the off-peak rate (about half of peak)`]);
  } else {
    rows.push(['Input (cache miss)', price(m.priceIn, cur)]);
    rows.push(['Output', price(m.priceOut, cur)]);
    rows.push(['Cache hit', m.priceCacheHit == null ? 'Not published' : price(m.priceCacheHit, cur)]);
    rows.push(['Time-based pricing', `${ICON_NO} Single price around the clock`]);
  }
  return rows;
}

/* 英文页模型字段翻译统一走 i18n.mjs（单一字典，禁止页面内散落条件判断） */
function tagsHtmlEn(m) {
  const mods = (m.modalities || []).map(x => `<span class="tag tag-mod">${esc(EN_MODALITY[x] || x)}</span>`).join('');
  const feats = (m.features || []).map(x => `<span class="tag tag-feat">${esc(EN_FEATURE[x] || x)}</span>`).join('');
  return mods || feats ? `<span class="m-tags">${mods}${feats}</span>` : '';
}

function modelDetailEn(m) {
  const meta = EN_MODEL_COPY[m.id];
  if (!meta) throw new Error(`EN_MODEL_COPY missing for ${m.id}`);
  const cur = modelCurrency(m);
  const curName = cur === 'USD' ? 'USD' : 'CNY';
  const modText = (m.modalities || []).map(x => EN_MODALITY[x] || x).join(', ');
  const featText = (m.features || []).map(x => EN_FEATURE[x] || x).join(', ');
  const src = safeUrl(m.sourceUrl);
  const srcCell = src
    ? `<a href="${esc(src)}" target="_blank" rel="noopener">${esc(enSrcLabel(m))}</a>`
    : esc(enSrcLabel(m));
  const effIn = m.priceCacheHit == null ? m.priceIn : P.hit * m.priceCacheHit + (1 - P.hit) * m.priceIn;
  const inCost = P.calls * 30 * (P.inTok / 1e6) * effIn;
  const outCost = P.calls * 30 * (P.outTok / 1e6) * m.priceOut;
  const total = Math.round((inCost + outCost) * 100) / 100;
  const title = `${enModelName(m)} API Pricing, Context Window and Specs | ${BRAND}`;
  const desc = `${enModelName(m)} (${meta.vendorEn}) API pricing: input ${price(m.priceIn, cur)}, output ${price(m.priceOut, cur)} per 1M tokens (${curName}), ${m.context}K context, modalities: ${modText}. Official source linked, verified ${m.verifiedAt}.`;

  const main = `    <section class="hero" style="text-align:left;padding-bottom:0">
      <h1 style="font-size:26px">${esc(enModelName(m))}</h1>
      <p class="tagline">${esc(meta.vendorEn)} · ${esc(featText)}</p>
      ${tagsHtmlEn(m)}
    </section>

    <p class="lede">${esc(meta.positioning)}</p>

    <section class="panel">
      <h2>API pricing (official list price, ${curName} per 1M tokens)</h2>
      <div class="table-scroll">
        <table class="spec">
          <tbody>
${enPriceRows(m).map(r => `          <tr><th>${r[0]}</th><td class="num">${r[1]}</td></tr>`).join('\n')}
            <tr><th>Billing currency</th><td class="num">${cur === 'USD' ? 'USD (US dollars)' : 'CNY (Chinese yuan)'} — the vendor\'s original billing currency, not converted</td></tr>
          </tbody>
        </table>
      </div>
    </section>

    <section class="panel">
      <h2>Specifications</h2>
      <div class="table-scroll">
        <table class="spec">
          <tbody>
            <tr><th>Context window</th><td class="num">${m.context}K tokens</td></tr>
            <tr><th>Modalities</th><td>${esc(modText)}</td></tr>
            <tr><th>Noted features</th><td>${esc(featText)}</td></tr>
            <tr><th>Vendor / channel</th><td>${esc(meta.vendorEn)}</td></tr>
            <tr><th>Price source</th><td>${srcCell}</td></tr>
            <tr><th>Verified</th><td class="num">${esc(m.verifiedAt)}</td></tr>
          </tbody>
        </table>
      </div>
    </section>

    <section class="panel">
      <h2>Site calculation: estimated monthly cost at default usage</h2>
      <p class="s-hint">Site calculation, not a vendor quote. Assumptions: ${P.calls} calls/day · ${P.inTok} input / ${P.outTok} output tokens per call · 30-day month · ${Math.round(P.hit * 100)}% cache hit rate${m.peakOffpeak ? ' · off-peak rates' : ''}. Same formula as the <a href="../../cost/">cost calculator</a>.</p>
      <div class="table-scroll">
        <table class="spec">
          <tbody>
            <tr><th>Effective input price</th><td class="num">${m.priceCacheHit == null ? `No published cache price; input billed at ${price(m.priceIn, cur)}` : `${Math.round(P.hit * 100)}% × ${price(m.priceCacheHit, cur)} (cache hit) + ${Math.round((1 - P.hit) * 100)}% × ${price(m.priceIn, cur)} (standard) = ${round2(effIn)} ${cur === 'USD' ? 'USD' : 'CNY'}/1M tokens`}</td></tr>
            <tr><th>Input cost</th><td class="num">${P.calls} × 30 × (${P.inTok} ÷ 1,000,000) × ${round2(effIn)} = ${money(round2(inCost), cur)}</td></tr>
            <tr><th>Output cost</th><td class="num">${P.calls} × 30 × (${P.outTok} ÷ 1,000,000) × ${price(m.priceOut, cur)} = ${money(round2(outCost), cur)}</td></tr>
            <tr><th>Estimated monthly cost</th><td class="num"><strong>${money(total, cur)}</strong></td></tr>
          </tbody>
        </table>
      </div>
    </section>

    <section class="panel">
      <h2>Notes and limitations</h2>
      <div style="font-size:14px;line-height:1.9">
        <p>· Prices are official published list prices per 1M tokens in the original billing currency (here CNY). Limited-time promotions, resource packs and subscription discounts are not included; the vendor's console prevails.</p>
        <p>· "Verified" is the date this page's figures were last checked against the official source linked above. Pricing changes over time — confirm on the source page before making decisions.</p>
        <p>· The monthly cost above is this site's own calculation under fixed usage assumptions. It is not a vendor quote and does not constitute purchase advice.</p>
        <p>· This page records no benchmark results and claims no leadership on any task. ${esc(meta.useNote)}</p>
      </div>
    </section>

    <div class="cta-row">
      <a class="btn btn-primary" href="../../cost/?models=${esc(m.id)}">Estimate it in the cost calculator →</a>
      <a class="btn btn-ghost" href="../../cost/">Cost calculator</a>
      <a class="btn btn-ghost" href="../../">English home</a>
    </div>`;

  return {
    active: 'models', /* 与 NAV_ITEMS.key 对齐（历史值 'model' 会导致英文导航无 active 高亮） */
    title,
    desc,
    canonicalPath: `/en/models/${m.id}/`,
    jsonld: [
      {
        '@context': 'https://schema.org',
        '@type': 'SoftwareApplication',
        name: enModelName(m),
        applicationCategory: 'DeveloperApplication',
        operatingSystem: 'API',
        inLanguage: 'en',
        description: desc,
        url: `${SITE}/en/models/${m.id}/`,
        sameAs: src || undefined
      },
      breadcrumb([{ name: 'English Home', path: '/en/' }, { name: enModelName(m), path: `/en/models/${m.id}/` }])
    ],
    crumb: `/ <a href="../../" style="color:inherit">English Home</a> / ${esc(enModelName(m))}`,
    main,
    inlineScript: `  <script>window.track('model_view', { id: ${jsStr(m.id)}, lang: 'en' });</script>`
  };
}

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

  return {
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
  };
}

/* 英文对比页：与 compareDetail 完全同一数据源、同一组合与同一公式（pricing.mjs），仅文案为英文 */
const EN_PEAK_WINDOW = s => s.replace(/工作日/g, 'Weekdays').replace(/、/g, ', ').replace(/与/g, ' & ');
function cellPriceEn(m, kind) {
  const cur = modelCurrency(m);
  if (m.priceTiers) {
    const key = kind === 'in' ? 'priceIn' : kind === 'out' ? 'priceOut' : 'priceCacheHit';
    if (kind === 'cache' && m.priceTiers.every(t => t.priceCacheHit == null)) return 'Not published';
    return m.priceTiers.map(t => `${esc(enTierDesc(t.desc))} ${t.unverified ? 'not published' : price(t[key], cur)}`).join('　');
  }
  if (m.peakOffpeak) {
    const p = m.peakOffpeak;
    if (kind === 'in') return `Peak ${price(p.peakIn, cur)} / off-peak ${price(p.offIn, cur)}`;
    if (kind === 'out') return `Peak ${price(p.peakOut, cur)} / off-peak ${price(p.offOut, cur)}`;
    return `Peak ${price(p.peakCache, cur)} / off-peak ${price(p.offCache, cur)}`;
  }
  if (kind === 'in') return price(m.priceIn, cur);
  if (kind === 'out') return price(m.priceOut, cur);
  return m.priceCacheHit == null ? 'Not published' : price(m.priceCacheHit, cur);
}

function srcLinkEn(m) {
  const u = safeUrl(m.sourceUrl);
  return u ? `<a href="${esc(u)}" target="_blank" rel="noopener">${esc(enSrcLabel(m))}</a>` : esc(enSrcLabel(m));
}

function compareDetailEn(a, b) {
  const curA = modelCurrency(a), curB = modelCurrency(b);
  const mixed = curA !== curB;
  const ca = monthly(a), cb = monthly(b);
  const ba = toBase(ca, curA, fx), bb = toBase(cb, curB, fx);
  const fxOk = ba != null && bb != null;
  const v = fxOk ? verdict(ba, bb) : 'na';
  const cnyEst = (x, cur) => (cur === 'CNY' ? money(x, 'CNY') : toBase(x, cur, fx) != null ? `≈ ${money(toBase(x, cur, fx))}` : 'reference rate unverified; cannot convert');
  const rows = [
    ['Vendor / channel', esc(enVendorLabel(a)), esc(enVendorLabel(b)), false],
    ['Context window', `${a.context}K`, `${b.context}K`, false],
    ['Modalities', esc((a.modalities || []).map(x => EN_MODALITY[x] || x).join(', ')), esc((b.modalities || []).map(x => EN_MODALITY[x] || x).join(', ')), false],
    ['Features', esc((a.features || []).map(x => EN_FEATURE[x] || x).join(', ')), esc((b.features || []).map(x => EN_FEATURE[x] || x).join(', ')), false],
    ['Input (cache miss)', cellPriceEn(a, 'in'), cellPriceEn(b, 'in'), false],
    ['Output', cellPriceEn(a, 'out'), cellPriceEn(b, 'out'), false],
    ['Cache hit', cellPriceEn(a, 'cache'), cellPriceEn(b, 'cache'), false],
    ['Time-based pricing', a.peakOffpeak ? `${ICON_YES} Off-peak ≈ half of peak (peak=${esc(EN_PEAK_WINDOW(a.peakOffpeak.peakWindow))})` : ICON_NO, b.peakOffpeak ? `${ICON_YES} Off-peak ≈ half of peak (peak=${esc(EN_PEAK_WINDOW(b.peakOffpeak.peakWindow))})` : ICON_NO, false],
    ['Est. monthly cost*', `${money(ca, curA)}${mixed ? `<br><span class="lib-meta">${cnyEst(ca, curA)}</span>` : ''}${v === 'tie' ? ' (tied)' : ''}`, `${money(cb, curB)}${mixed ? `<br><span class="lib-meta">${cnyEst(cb, curB)}</span>` : ''}${v === 'tie' ? ' (tied)' : ''}`, true],
    ['Price source', srcLinkEn(a), srcLinkEn(b), false],
    ['Verified', esc(a.verifiedAt), esc(b.verifiedAt), false]
  ];
  const body = rows.map(r => {
    const ca2 = r[3] ? (v === 'a' ? ' class="win num"' : ' class="num"') : '';
    const cb2 = r[3] ? (v === 'b' ? ' class="win num"' : ' class="num"') : '';
    return `          <tr><th>${r[0]}</th><td${ca2}>${r[1]}</td><td${cb2}>${r[2]}</td></tr>`;
  }).join('\n');

  /* 对比摘要：只写能从 models.json 直接推导、且口径明确的事实（英文文案） */
  const pa = lowPrices(a), pb = lowPrices(b);
  const sum = [];
  const fxDesc = mixed ? `; cross-currency figures are converted to CNY (${esc(enFxNote('USD') || 'reference rate unverified')}) for comparison only` : '';
  if (!fxOk) {
    sum.push(`Estimated monthly cost: ${esc(enModelName(a))} ${money(ca, curA)} vs ${esc(enModelName(b))} ${money(cb, curB)} — the two are billed in different currencies and the reference rate is unverified, so they cannot be compared on one basis.`);
  } else if (v === 'tie') {
    sum.push(`Estimated monthly cost is tied: on a common CNY basis both come to about ${money(ba)} (identical within display precision${mixed ? `, list prices ${money(ca, curA)} and ${money(cb, curB)}` : ''}).`);
    sum.push('Cost ratio: equal under this basis; this conclusion holds only at the current list prices, reference rate and the fixed usage assumptions above.');
  } else {
    const cheaper = v === 'a' ? a : b;
    const dearer = v === 'a' ? b : a;
    const ct = v === 'a' ? ba : bb, dt = v === 'a' ? bb : ba;
    sum.push(`Estimated monthly cost: ${esc(enModelName(a))} ${money(ba)} vs ${esc(enModelName(b))} ${money(bb)} on a common CNY basis (list prices ${money(ca, curA)} / ${money(cb, curB)}) — at this fixed usage, ${esc(enModelName(cheaper))} is cheaper by ${fmtDiff(Math.abs(ba - bb))}/month.`);
    sum.push(`Cost ratio: under this basis, ${esc(enModelName(dearer))} costs about ${(dt / ct).toFixed(1)}× ${esc(enModelName(cheaper))} (${esc(enModelName(cheaper))} is ~${((1 - ct / dt) * 100).toFixed(0)}% cheaper). The ratio holds only at the current list prices, reference rate and fixed usage assumptions; it says nothing about capability, output quality or overall value.`);
  }
  const unitRow = (label, x, y) => {
    const bx = toBase(x, curA, fx), by = toBase(y, curB, fx);
    if (bx == null || by == null) return `${label}: ${esc(enModelName(a))} ${price(x, curA)} vs ${esc(enModelName(b))} ${price(y, curB)} (different currencies, reference rate unverified — no delta computed).`;
    if (Math.abs(bx - by) < 0.005) return `${label} tied after conversion: both ≈ ${money(bx)} (list prices ${price(x, curA)} / ${price(y, curB)}).`;
    const lower = bx < by ? a : b;
    return `${label}: list prices ${price(x, curA)} vs ${price(y, curB)}; after conversion ${esc(enModelName(lower))} is lower (by ≈ ${fmtDiff(bx - by)}/1M tokens).`;
  };
  sum.push(unitRow('Input unit price (off-peak / single-price basis)', pa.i, pb.i));
  sum.push(unitRow('Output unit price (off-peak / single-price basis)', pa.o, pb.o));
  const cacheNote = (m, c) => (c == null ? `${esc(enModelName(m))} publishes no cache price (estimated at the standard input price)` : `${esc(enModelName(m))} ${price(c, modelCurrency(m))}`);
  sum.push(`Cache-hit price (off-peak basis): ${cacheNote(a, pa.c)}; ${cacheNote(b, pb.c)}.`);
  if (mixed) sum.push(`Currencies: ${esc(enModelName(a))} is billed in ${curA}, ${esc(enModelName(b))} in ${curB}; conversion uses the CFETS central parity rate (see above) and is indicative only.`);
  if (a.context === b.context) {
    sum.push(`Context window: identical at ${a.context}K.`);
  } else {
    const bigger = a.context > b.context ? a : b;
    const smaller = a.context > b.context ? b : a;
    sum.push(`Context window: ${esc(enModelName(a))} ${a.context}K vs ${esc(enModelName(b))} ${b.context}K — ${esc(enModelName(bigger))} is ${(bigger.context / smaller.context).toFixed(1)}× ${esc(enModelName(smaller))}.`);
  }
  const modA = (a.modalities || []).map(x => EN_MODALITY[x] || x), modB = (b.modalities || []).map(x => EN_MODALITY[x] || x);
  const onlyA = a.modalities.filter(x => !b.modalities.includes(x)), onlyB = b.modalities.filter(x => !a.modalities.includes(x));
  if (!onlyA.length && !onlyB.length) {
    sum.push(`Modalities: identical — ${esc(modA.join(', '))}.`);
  } else {
    sum.push(`Modalities: ${esc(enModelName(a))}=${esc(modA.join(', '))}; ${esc(enModelName(b))}=${esc(modB.join(', '))}${onlyA.length ? ` (${esc(enModelName(a))} adds ${esc(onlyA.map(x => EN_MODALITY[x] || x).join(', '))})` : ''}${onlyB.length ? ` (${esc(enModelName(b))} adds ${esc(onlyB.map(x => EN_MODALITY[x] || x).join(', '))})` : ''}.`);
  }
  sum.push(`Price sources: ${esc(enSrcLabel(a))} (verified ${esc(a.verifiedAt)}), ${esc(enSrcLabel(b))} (verified ${esc(b.verifiedAt)}); unit: official list price per 1M tokens (${esc(enModelName(a))} in ${curA}, ${esc(enModelName(b))} in ${curB}${mixed ? '; cross-currency figures converted to CNY as noted above' : ''}).`);

  const main = `    <section class="hero" style="text-align:left;padding-bottom:0">
      <h1 style="font-size:26px">${esc(enModelName(a))} <span style="color:var(--muted);font-weight:400">vs</span> ${esc(enModelName(b))}</h1>
      <p class="tagline">${esc(enVendorLabel(a))} vs ${esc(enVendorLabel(b))} · prices and specs, line by line</p>
    </section>

    <p class="lede">${esc(enModelName(a))} (${esc(enVendorLabel(a))}) vs ${esc(enModelName(b))} (${esc(enVendorLabel(b))}), side by side: input/output/cache-hit prices, time-based pricing, context window, modalities and a fixed-assumption monthly cost. Green marks the better row.</p>

    <div class="table-scroll" style="margin-top:20px">
      <table class="spec wide">
        <thead>
          <tr><th>Dimension</th><th>${esc(enModelName(a))}</th><th>${esc(enModelName(b))}</th></tr>
        </thead>
        <tbody>
${body}
        </tbody>
      </table>
    </div>
    <p class="s-hint">* Fixed assumptions for the example monthly cost: 100 calls/day · 2,000 input / 800 output tokens per call · off-peak rates · 30% cache hit rate · 30-day month — the same formula and defaults as the <a href="../../../cost/">cost calculator</a>. USD models are converted to CNY at the reference rate for comparison (see summary). Costs within display precision are marked tied; neither side is favored.</p>

    <section class="panel">
      <h2>Comparison summary (fixed usage basis)</h2>
      <ul style="font-size:14px;line-height:1.9;padding-left:20px;margin:0">
${sum.map(s => `        <li>${s}</li>`).join('\n')}
      </ul>
      <p class="s-hint" style="margin-top:10px">These are computations from published list prices under fixed call volume, token usage, cache assumptions and billing rules. They are not rankings of capability, output quality or overall value, and do not constitute purchase advice.</p>
    </section>

    <div class="cta-row">
      <a class="btn btn-primary" href="../../../cost/?models=${esc(a.id)},${esc(b.id)}" onclick="window.track('compare_to_cost', { a: ${jsStr(a.id)}, b: ${jsStr(b.id)}, lang: 'en' })">Calculate with your own usage →</a>
      <a class="btn btn-ghost" href="../../../models/${esc(a.id)}/">${esc(enModelName(a))} profile</a>
      <a class="btn btn-ghost" href="../../../models/${esc(b.id)}/">${esc(enModelName(b))} profile</a>
    </div>`;

  return {
    active: 'compare',
    title: `${enModelName(a)} vs ${enModelName(b)} - Price, Context and Modality Comparison | ${BRAND}`,
    desc: `${enModelName(a)} (${enVendorLabel(a)}) vs ${enModelName(b)} (${enVendorLabel(b)}): API prices, cache hit, time-based pricing, context window, modalities and a fixed-assumption monthly cost, line by line.`,
    canonicalPath: `/en/compare/${a.id}/${b.id}/`,
    jsonld: [
      breadcrumb([{ name: 'Home', path: '/en/' }, { name: 'Model comparison', path: '/en/compare/' }, { name: `${enModelName(a)} vs ${enModelName(b)}`, path: `/en/compare/${a.id}/${b.id}/` }])
    ],
    crumb: `/ <a href="../../../compare/" style="color:inherit">Model comparison</a> / ${esc(enModelName(a))} vs ${esc(enModelName(b))}`,
    main,
    inlineScript: `  <script>window.track('compare_view', { a: ${jsStr(a.id)}, b: ${jsStr(b.id)}, lang: 'en' });</script>`
  };
}

function srcLink(m) {
  const u = safeUrl(m.sourceUrl);
  return u ? `<a href="${esc(u)}" target="_blank" rel="noopener">${esc(m.sourceName)}</a>` : esc(m.sourceName);
}

/* ---------- 工具详情页 ---------- */
/* 可选富内容：tools.json 中 detail 字段（带来源标注的独有小节），仅个别工具页配置；缺省输出空串，其他页零影响 */
function toolDetailRich(d) {
  const secs = (d.sections || []).map(s => `    <section class="panel">
      <h2>${esc(s.h)}</h2>
      <div style="font-size:14px;line-height:1.9">${esc(s.body).replace(/\n/g, '<br>')}</div>
    </section>`).join('\n');
  const srcs = (d.sources || []).map(s => {
    const u = safeUrl(s.url);
    return u ? `<a href="${esc(u)}" target="_blank" rel="noopener">${esc(s.label)}</a>（${esc(s.verifiedAt)} 核实）` : esc(s.label);
  }).join(' · ');
  return secs + (srcs ? `
    <section class="panel">
      <h2>信息来源与核验</h2>
      <p class="lib-meta">来源：${srcs}。工具功能与定价迭代较快，以官网实际为准。</p>
    </section>` : '');
}

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
${t.detail ? toolDetailRich(t.detail) : ''}
    <div class="cta-row">
      ${u ? `<a class="btn btn-primary" href="${esc(u)}" target="_blank" rel="noopener" onclick="window.track('tool_outbound', { id: ${jsStr(t.id)} })">访问官网 →</a>` : ''}
      <a class="btn btn-ghost" href="../">返回工具库</a>
    </div>`;

  return {
    title: `${t.name} - ${t.category}类 AI 工具介绍 | ${BRAND}`,
    desc: `${t.name}：${t.tagline}。适用场景：${t.scene}。收费模式：${t.free}。`,
    canonicalPath: `/tools/${t.id}/`,
    robots: indexable ? null : 'noindex,follow',
    jsonld: [ld, breadcrumb([{ name: '首页', path: '/' }, { name: '工具库', path: '/tools/' }, { name: t.name, path: `/tools/${t.id}/` }])],
    crumb: `/ <a href="../" style="color:inherit">工具库</a> / ${esc(t.name)}`,
    main,
    active: 'tools'
  };
}

/* ---------- 英文工具详情页：与 toolDetail 同一数据源与索引策略（noindex 原样保留，不放宽） ---------- */
function toolDetailEn(t) {
  const meta = EN_TOOL[t.id];
  if (!meta) throw new Error(`EN_TOOL missing for ${t.id}`);
  const indexable = isToolIndexable(t);
  const u = safeUrl(t.url);
  const lede = `${enToolName(t)} is a ${EN_TOOL_CATEGORY[t.category] || t.category} AI tool — ${meta.tagline}. Typical use: ${meta.scene}. Pricing model: ${EN_TOOL_FREE[t.free] || t.free}. Information verified ${t.verifiedAt}; check the official site for current details.`;
  const related = tools.filter(x => x.category === t.category && x.id !== t.id).slice(0, 4);

  const ld = {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: enToolName(t),
    applicationCategory: 'UtilitiesApplication',
    operatingSystem: 'Web',
    inLanguage: 'en',
    description: lede,
    url: `${SITE}/en/tools/${t.id}/`
  };
  if (u) ld.sameAs = u;
  if (t.free === '免费') {
    ld.offers = { '@type': 'Offer', price: '0', priceCurrency: 'CNY', description: 'Free to use' };
  }

  const main = `    <section class="hero" style="text-align:left;padding-bottom:0">
      <h1 style="font-size:26px">${esc(enToolName(t))}<span class="free-badge free-${esc(t.free)}">${esc(EN_TOOL_FREE[t.free] || t.free)}</span></h1>
      <p class="tagline">${esc(meta.tagline)}</p>
    </section>

    <p class="lede">${esc(lede)}</p>

    <section class="panel">
      <h2>At a glance</h2>
      <div class="table-scroll">
        <table class="spec">
          <tbody>
            <tr><th>Category</th><td>${esc(EN_TOOL_CATEGORY[t.category] || t.category)}</td></tr>
            <tr><th>Pricing model</th><td>${esc(EN_TOOL_FREE[t.free] || t.free)}</td></tr>
            <tr><th>Typical use</th><td>${esc(meta.scene)}</td></tr>
            <tr><th>Official site</th><td>${u ? `<a href="${esc(u)}" target="_blank" rel="noopener">${esc(u)}</a>` : 'Not listed'}</td></tr>
            <tr><th>Verified</th><td class="num">${esc(t.verifiedAt)}</td></tr>
          </tbody>
        </table>
      </div>
      ${related.length ? `<p class="lib-meta">Similar tools: ${related.map(r => `<a href="../${esc(r.id)}/">${esc(enToolName(r))}</a>`).join(' · ')}</p>` : ''}
    </section>
    <div class="cta-row">
      ${u ? `<a class="btn btn-primary" href="${esc(u)}" target="_blank" rel="noopener" onclick="window.track('tool_outbound', { id: ${jsStr(t.id)}, lang: 'en' })">Visit official site →</a>` : ''}
      <a class="btn btn-ghost" href="../">Back to tool directory</a>
    </div>`;

  return {
    active: 'tools',
    title: `${enToolName(t)} - ${EN_TOOL_CATEGORY[t.category] || t.category} AI Tool | ${BRAND}`,
    desc: `${enToolName(t)}: ${meta.tagline}. Typical use: ${meta.scene}. Pricing model: ${EN_TOOL_FREE[t.free] || t.free}.`,
    canonicalPath: `/en/tools/${t.id}/`,
    robots: indexable ? null : 'noindex,follow',
    jsonld: [ld, breadcrumb([{ name: 'Home', path: '/en/' }, { name: 'Tool directory', path: '/en/tools/' }, { name: enToolName(t), path: `/en/tools/${t.id}/` }])],
    crumb: `/ <a href="../" style="color:inherit">Tool directory</a> / ${esc(enToolName(t))}`,
    main
  };
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

/* 英文成本参考表：与 costTableHtml 同一公式与同一 models.json 数据源，仅表头/说明为英文（/en/cost/ 注入） */
function costTableHtmlEn() {
  const rows = models.map(m => {
    const cur = modelCurrency(m);
    const src = safeUrl(m.sourceUrl);
    const inCell = m.priceTiers ? m.priceTiers.map(t => `${esc(enTierDesc(t.desc))} ${t.unverified ? 'not published' : price(t.priceIn, cur)}`).join('<br>') : m.peakOffpeak ? `Peak ${price(m.peakOffpeak.peakIn, cur)}<br>Off-peak ${price(m.peakOffpeak.offIn, cur)}` : price(m.priceIn, cur);
    const outCell = m.priceTiers ? m.priceTiers.map(t => `${esc(enTierDesc(t.desc))} ${t.unverified ? 'not published' : price(t.priceOut, cur)}`).join('<br>') : m.peakOffpeak ? `Peak ${price(m.peakOffpeak.peakOut, cur)}<br>Off-peak ${price(m.peakOffpeak.offOut, cur)}` : price(m.priceOut, cur);
    const cacheRaw = m.peakOffpeak ? m.peakOffpeak.offCache : m.priceCacheHit;
    const cacheCell = cacheRaw == null ? 'Not published' : (m.peakOffpeak ? `Peak ${price(m.peakOffpeak.peakCache, cur)}<br>Off-peak ${price(m.peakOffpeak.offCache, cur)}` : price(m.priceCacheHit, cur));
    const estCny = monthlyBase(m, fx);
    const estCell = estCny == null ? 'Cannot estimate (tier rate not published)' : (cur === 'USD' ? `≈ ${money(estCny)}` : money(estCny));
    return `          <tr><th><a href="../models/${esc(m.id)}/">${esc(enModelName(m))}</a></th><td>${esc(enVendorLabel(m))}</td><td class="num">${inCell}</td><td class="num">${outCell}</td><td class="num">${cacheCell}</td><td class="num">${estCell}</td><td class="num">${esc(m.verifiedAt)}</td><td>${src ? `<a href="${esc(src)}" target="_blank" rel="noopener">${esc(enSrcLabel(m))}</a>` : esc(enSrcLabel(m))}</td></tr>`;
  }).join('\n');
  const usdNote = models.some(m => modelCurrency(m) === 'USD')
    ? `USD is the official billing currency for those models; estimated monthly costs are converted to CNY (${esc(enFxNote('USD') || 'reference rate unverified')}), indicative only.`
    : '';
  return `      <div class="table-scroll">
        <table class="spec wide">
          <thead>
            <tr><th>Model</th><th>Vendor / channel</th><th>Input price<br>(list price / 1M tokens)</th><th>Output price<br>(list price / 1M tokens)</th><th>Cache-hit price</th><th>Est. monthly cost (CNY)</th><th>Verified</th><th>Official price source</th></tr>
          </thead>
          <tbody>
${rows}
          </tbody>
        </table>
      </div>
      <p class="s-hint" style="margin-top:8px">Models without a published cache price are estimated at the standard input price (no cache discount assumed); time-based priced models use the off-peak rate (matching the "Off-peak" toggle above); tiered models are priced at the tier an example input of 2,000 tokens falls into. The estimate column uses exactly the same formula, default parameters and reference rate as the interactive calculator below. ${usdNote} For a two-model, line-by-line comparison use the <a href="../compare/">model comparison</a>.</p>`;
}

/* 英文算例：与 costExampleHtml 同一公式、同一示例模型（/en/cost/ 注入） */
function costExampleHtmlEn() {
  const m = models.find(x => x.peakOffpeak) || models[0];
  const b = m.peakOffpeak
    ? { i: m.peakOffpeak.offIn, c: m.peakOffpeak.offCache, o: m.peakOffpeak.offOut, label: 'off-peak rate' }
    : { i: m.priceIn, c: m.priceCacheHit, o: m.priceOut, label: 'standard rate' };
  const effIn = b.c == null ? b.i : P.hit * b.c + (1 - P.hit) * b.i;
  const inCost = P.calls * 30 * (P.inTok / 1e6) * effIn;
  const outCost = P.calls * 30 * (P.outTok / 1e6) * b.o;
  const cacheLine = b.c == null
    ? `This model has no published cache price; input is billed at ${price(b.i)}.`
    : `Effective input price = 30% × ${price(b.c)} (cache hit) + 70% × ${price(b.i)} (standard) = ${round2(effIn)} CNY/1M tokens.`;
  return `      <div class="table-scroll">
        <table class="spec">
          <tbody>
            <tr><th>Example model</th><td><a href="../models/${esc(m.id)}/">${esc(enModelName(m))}</a> (${esc(enVendorLabel(m))}, ${b.label}, verified ${esc(m.verifiedAt)}, <a href="${esc(safeUrl(m.sourceUrl) || '#')}" target="_blank" rel="noopener">official source</a>)</td></tr>
            <tr><th>Effective input price</th><td class="num">${cacheLine}</td></tr>
            <tr><th>Input cost</th><td class="num">${P.calls} × 30 × (${P.inTok} ÷ 1,000,000) × ${round2(effIn)} = ${money(round2(inCost))}</td></tr>
            <tr><th>Output cost</th><td class="num">${P.calls} × 30 × (${P.outTok} ÷ 1,000,000) × ${price(b.o)} = ${money(round2(outCost))}</td></tr>
            <tr><th>Estimated monthly cost</th><td class="num"><strong>${money(round2(inCost + outCost))}</strong> (a fixed-assumption estimate, not purchase advice)</td></tr>
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
            <tr><th>模型与来源</th><td><a href="../../models/${esc(m.id)}/">${esc(enModelName(m))}</a>（${esc(m.vendor)}），刊例原价：输入 ${price(m.priceIn)} / 输出 ${price(m.priceOut)} / 缓存命中 ${price(m.priceCacheHit)} 每百万 Token；<a href="${esc(src || '#')}" target="_blank" rel="noopener">官方来源</a>，核验日期 ${esc(m.verifiedAt)}</td></tr>
            <tr><th>第 1 步：输入有效单价</th><td class="num">30% × ${price(m.priceCacheHit)} + 70% × ${price(m.priceIn)} = ${round2(effIn)} 元/百万 Token</td></tr>
            <tr><th>第 2 步：输入成本</th><td class="num">100 次/天 × 30 天 × (2000 ÷ 1,000,000) × ${round2(effIn)} = ${money(round2(inCost))}</td></tr>
            <tr><th>第 3 步：输出成本</th><td class="num">100 次/天 × 30 天 × (800 ÷ 1,000,000) × ${price(m.priceOut)} = ${money(round2(outCost))}</td></tr>
            <tr><th>第 4 步：合计</th><td class="num"><strong>${money(round2(inCost + outCost))} / 月</strong>（刊例估算，不等于实际账单）</td></tr>
          </tbody>
        </table>
      </div>`;
}

/* 指南《定价比较》用：官方原币单价三列（分档/分时段/单一价同口径） */
function guidePriceCells(m) {
  const cur = modelCurrency(m);
  if (m.priceTiers) {
    return {
      in: m.priceTiers.map(t => `${esc(t.desc)} ${t.unverified ? '未公开' : price(t.priceIn, cur)}`).join('<br>'),
      out: m.priceTiers.map(t => `${esc(t.desc)} ${t.unverified ? '未公开' : price(t.priceOut, cur)}`).join('<br>'),
      cache: m.priceTiers.every(t => t.priceCacheHit == null) ? '未公开' : m.priceTiers.map(t => price(t.priceCacheHit, cur)).join('<br>')
    };
  }
  if (m.peakOffpeak) {
    const p = m.peakOffpeak;
    return {
      in: `高峰 ${price(p.peakIn, cur)}<br>低谷 ${price(p.offIn, cur)}`,
      out: `高峰 ${price(p.peakOut, cur)}<br>低谷 ${price(p.offOut, cur)}`,
      cache: `高峰 ${price(p.peakCache, cur)}<br>低谷 ${price(p.offCache, cur)}`
    };
  }
  return { in: price(m.priceIn, cur), out: price(m.priceOut, cur), cache: price(m.priceCacheHit, cur) };
}

/* 指南《定价比较》静态表：固定默认假设下全模型估算月成本，统一折算 CNY 升序；原价保留官方币种 */
function pcompTableHtml() {
  const rows = models.map(m => {
    const cur = modelCurrency(m);
    const v = monthlyFull(m, { off: true, hit: P.hit, calls: P.calls, inTok: P.inTok, outTok: P.outTok });
    const cny = Number.isNaN(v.t) ? null : toBase(v.t, cur, fx);
    return { m, cur, cny, usd: v.t, cells: guidePriceCells(m) };
  }).sort((a, b) => (a.cny == null ? 1 : b.cny == null ? -1 : a.cny - b.cny));
  const body = rows.map(r => `          <tr><th><a href="../../models/${esc(r.m.id)}/">${esc(enModelName(r.m))}</a></th><td>${esc(r.m.vendor)}</td><td class="num">${r.cells.in}</td><td class="num">${r.cells.out}</td><td class="num">${r.cells.cache}</td><td class="num">${r.m.context}K</td><td class="num">${r.cny == null ? '该档位费率未公开' : (r.cur === 'USD' ? `约 ${money(r.cny)}<br><span class="lib-meta">原价 ${money(r.usd, 'USD')}</span>` : money(r.cny))}</td><td class="num">${esc(r.m.verifiedAt)}</td></tr>`).join('\n');
  return `      <div class="table-scroll">
        <table class="spec wide">
          <thead>
            <tr><th>模型</th><th>厂商 / 渠道</th><th>输入价<br>（刊例原价/百万Token）</th><th>输出价<br>（刊例原价/百万Token）</th><th>缓存命中价</th><th>上下文</th><th>估算月成本<br>（人民币折算）</th><th>核验日期</th></tr>
          </thead>
          <tbody>
${body}
          </tbody>
        </table>
      </div>
      <p class="s-hint">假设：日均 ${P.calls} 次 · 单次输入 ${P.inTok} / 输出 ${P.outTok} Token · 错峰低谷价 · 缓存命中率 ${P.hit * 100}% · 每月 30 天；美元模型按参考汇率（${esc(fxNote('USD') || '未核实')}）折算。估算仅为刊例口径，不构成采购建议。</p>`;
}

/* 指南《场景成本案例》静态内容：三组场景假设 × 全模型估算表（公式与交互计算器一致） */
const GUIDE_SCENARIOS = [
  { key: 'chat', title: '场景一：聊天机器人 / 在线客服', calls: 2000, inTok: 1200, outTok: 300, hit: 0.4,
    why: '<strong>场景假设</strong>：单轮输入含系统提示词与近期历史（约 1,200 Token），回复简短（约 300 Token）；客服类应用调用高频，取日均 2,000 次。系统提示词稳定，缓存命中率取 40%。成本结构：调用次数是被放大器，轻量低价档优势明显。' },
  { key: 'rag', title: '场景二：RAG 知识库问答', calls: 300, inTok: 10000, outTok: 500, hit: 0.6,
    why: '<strong>场景假设</strong>：检索出的知识片段随提示词注入，单次输入约 10,000 Token；答案简短（约 500 Token）；日均 300 次问答。系统提示词与知识库前缀稳定，缓存命中率取 60%。成本结构：输入项占主导，缓存价与命中率是决定性变量。' },
  { key: 'agent', title: '场景三：编码 Agent', calls: 100, inTok: 6000, outTok: 1500, hit: 0.2,
    why: '<strong>场景假设</strong>：每次任务携带代码上下文与工具输出（约 6,000 Token），产出补丁与解释（约 1,500 Token）；日均 100 个任务。上下文随任务变化大，缓存命中率保守取 20%。成本结构：输出项权重高，输出单价差异直接拉开差距。' }
];
function cexScenariosHtml() {
  return GUIDE_SCENARIOS.map(s => {
    const rows = models.map(m => {
      const cur = modelCurrency(m);
      const v = monthlyFull(m, { off: true, hit: s.hit, calls: s.calls, inTok: s.inTok, outTok: s.outTok });
      const cny = Number.isNaN(v.t) ? null : toBase(v.t, cur, fx);
      return { m, cur, cny, usd: v.t };
    }).sort((a, b) => (a.cny == null ? 1 : b.cny == null ? -1 : a.cny - b.cny));
    const body = rows.map(r => `          <tr><th><a href="../../models/${esc(r.m.id)}/">${esc(enModelName(r.m))}</a></th><td>${esc(r.m.vendor)}</td><td class="num">${r.cny == null ? '该档位费率未公开，无法估算' : (r.cur === 'USD' ? `约 ${money(r.cny)}<br><span class="lib-meta">原价 ${money(r.usd, 'USD')}</span>` : money(r.cny))}</td><td class="num">${esc(r.m.verifiedAt)}</td></tr>`).join('\n');
    return `      <h2 id="scene-${s.key}">${s.title}</h2>
      <p style="font-size:14px;line-height:1.9">${s.why}</p>
      <p class="s-hint">计算假设：日均 ${s.calls} 次 · 单次输入 ${s.inTok} / 输出 ${s.outTok} Token · 缓存命中率 ${s.hit * 100}% · 错峰低谷价 · 每月 30 天。月成本 = 调用 × 30 ×（输入 ÷ 1,000,000 × 有效输入价 + 输出 ÷ 1,000,000 × 输出单价）；分档模型按 ${s.inTok} Token 自动选档，未公开费率的档位如实标注无法估算。</p>
      <div class="table-scroll">
        <table class="spec wide">
          <thead>
            <tr><th>模型</th><th>厂商 / 渠道</th><th>估算月成本（人民币折算）</th><th>核验日期</th></tr>
          </thead>
          <tbody>
${body}
          </tbody>
        </table>
      </div>`;
  }).join('\n');
}

/* 指南《场景成本案例》敏感性示例：固定 RAG 场景假设，仅调整缓存命中率（示例假设，非行业统计） */
const CEX_SENS_MODELS = ['deepseek-v41-flash', 'glm-53', 'gpt-6-1-sol', 'minimax-m3'];
const CEX_SENS_HITS = [0, 0.3, 0.6, 0.9];
function cexSensitivityHtml() {
  const rag = GUIDE_SCENARIOS[1];
  const rows = CEX_SENS_MODELS.map(id => {
    const m = models.find(x => x.id === id);
    if (!m) return '';
    const cur = modelCurrency(m);
    const cells = CEX_SENS_HITS.map(h => {
      const v = monthlyFull(m, { off: true, hit: h, calls: rag.calls, inTok: rag.inTok, outTok: rag.outTok });
      if (Number.isNaN(v.t)) return '<td class="num">无法估算</td>';
      const cny = toBase(v.t, cur, fx);
      return cur === 'USD'
        ? `<td class="num">约 ${money(cny)}<br><span class="lib-meta">${money(v.t, 'USD')}</span></td>`
        : `<td class="num">${money(v.t)}</td>`;
    }).join('');
    const first = monthlyFull(m, { off: true, hit: 0, calls: rag.calls, inTok: rag.inTok, outTok: rag.outTok });
    const last = monthlyFull(m, { off: true, hit: 0.9, calls: rag.calls, inTok: rag.inTok, outTok: rag.outTok });
    const drop = Number.isNaN(first.t) || Number.isNaN(last.t) || first.t === 0 ? null : (1 - last.t / first.t) * 100;
    return `          <tr><th><a href="../../models/${esc(m.id)}/">${esc(enModelName(m))}</a>${m.priceCacheHit == null && !m.peakOffpeak ? '<br><span class="lib-meta">未公开缓存价</span>' : ''}</th>${cells}<td class="num">${drop == null ? '—' : `约降 ${drop.toFixed(0)}%`}</td><td class="num">${esc(m.verifiedAt)}</td></tr>`;
  }).join('\n');
  return `      <div class="table-scroll">
        <table class="spec wide">
          <thead>
            <tr><th>模型</th><th>命中率 0%</th><th>命中率 30%</th><th>命中率 60%</th><th>命中率 90%</th><th>0% → 90% 降幅</th><th>核验日期</th></tr>
          </thead>
          <tbody>
${rows}
          </tbody>
        </table>
      </div>
      <p class="s-hint">读表：缓存价越低的模型（如 DeepSeek V4.1 Flash 低谷缓存价 ¥0.02/百万），命中率提升带来的降幅越大；未公开缓存价的模型（如 MiniMax M3）输入按未命中价计，命中率变化不改变估算——这正是"先确认官方是否公开缓存价"的价值。美元模型保留 $ 原价并按参考汇率（${esc(fxNote('USD') || '未核实')}）折算。</p>`;
}

/* 指南《Make 工作流》成本表：每次运行 1 次模型调用（2000/800、命中 30%、错峰）的每千次运行成本 */
const WF_COST_MODELS = ['deepseek-v41-flash', 'glm-53-flash', 'gpt-6-luna', 'kimi-k3'];
function wfCostHtml() {
  const rows = WF_COST_MODELS.map(id => models.find(m => m.id === id)).filter(Boolean).map(m => {
    const cur = modelCurrency(m);
    const v = monthlyFull(m, { off: true, hit: 0.3, calls: 1000, inTok: 2000, outTok: 800 });
    const per1k = v.t / 30; /* monthlyFull 按 30 天计：calls=1000/天 → 除 30 得每千次 */
    const cny = toBase(per1k, cur, fx);
    const cell = cur === 'USD' ? `约 ${money(cny)}<br><span class="lib-meta">${money(per1k, 'USD')}</span>` : money(per1k);
    return `          <tr><th><a href="../../models/${esc(m.id)}/">${esc(enModelName(m))}</a></th><td>${esc(m.vendor)}</td><td class="num">输入 ${price(m.priceIn, cur)} / 输出 ${price(m.priceOut, cur)}${m.priceCacheHit != null ? ` / 缓存 ${price(m.priceCacheHit, cur)}` : ' / 缓存未公开'}</td><td class="num">${cell}</td><td class="num">${esc(m.verifiedAt)}</td></tr>`;
  }).join('\n');
  return `      <div class="table-scroll">
        <table class="spec wide">
          <thead>
            <tr><th>模型</th><th>厂商 / 渠道</th><th>刊例原价（每百万 Token）</th><th>每 1,000 次运行（人民币折算）</th><th>核验日期</th></tr>
          </thead>
          <tbody>
${rows}
          </tbody>
        </table>
      </div>
      <p class="s-hint">口径：每次运行 = 1 次模型调用（输入 2,000 / 输出 800 Token · 缓存命中率 30% · 错峰低谷价）；美元模型按参考汇率（${esc(fxNote('USD') || '未核实')}）折算，仅供参考。每日运行 N 次的月成本 = 表中值 × N ÷ 1,000。官方未公开缓存价的模型按未命中价计。</p>`;
}

/* ---------- 英文指南数据表：与中文表同一 models.json + pricing.mjs 公式，仅表头/说明为英文 ---------- */
function guideExampleHtmlEn() {
  const m = models.find(x => x.priceCacheHit != null && !x.peakOffpeak) || models[0];
  const src = safeUrl(m.sourceUrl);
  const effIn = P.hit * m.priceCacheHit + (1 - P.hit) * m.priceIn;
  const inCost = P.calls * 30 * (P.inTok / 1e6) * effIn;
  const outCost = P.calls * 30 * (P.outTok / 1e6) * m.priceOut;
  return `      <div class="table-scroll">
        <table class="spec">
          <tbody>
            <tr><th>Model & source</th><td><a href="../../models/${esc(m.id)}/">${esc(enModelName(m))}</a> (${esc(enVendorLabel(m))}), list prices: input ${price(m.priceIn)} / output ${price(m.priceOut)} / cache hit ${price(m.priceCacheHit)} per 1M tokens; <a href="${esc(src || '#')}" target="_blank" rel="noopener">official source</a>, verified ${esc(m.verifiedAt)}</td></tr>
            <tr><th>Step 1: effective input price</th><td class="num">30% × ${price(m.priceCacheHit)} + 70% × ${price(m.priceIn)} = ${round2(effIn)} CNY/1M tokens</td></tr>
            <tr><th>Step 2: input cost</th><td class="num">100 calls/day × 30 days × (2000 ÷ 1,000,000) × ${round2(effIn)} = ${money(round2(inCost))}</td></tr>
            <tr><th>Step 3: output cost</th><td class="num">100 calls/day × 30 days × (800 ÷ 1,000,000) × ${price(m.priceOut)} = ${money(round2(outCost))}</td></tr>
            <tr><th>Step 4: total</th><td class="num"><strong>${money(round2(inCost + outCost))} / month</strong> (list-price estimate, not an actual invoice)</td></tr>
          </tbody>
        </table>
      </div>`;
}

function pcompTableHtmlEn() {
  const rows = models.map(m => {
    const cur = modelCurrency(m);
    const v = monthlyFull(m, { off: true, hit: P.hit, calls: P.calls, inTok: P.inTok, outTok: P.outTok });
    const cny = Number.isNaN(v.t) ? null : toBase(v.t, cur, fx);
    const cells = {
      in: m.priceTiers ? m.priceTiers.map(t => `${esc(enTierDesc(t.desc))} ${t.unverified ? 'not published' : price(t.priceIn, cur)}`).join('<br>') : m.peakOffpeak ? `Peak ${price(m.peakOffpeak.peakIn, cur)}<br>Off-peak ${price(m.peakOffpeak.offIn, cur)}` : price(m.priceIn, cur),
      out: m.priceTiers ? m.priceTiers.map(t => `${esc(enTierDesc(t.desc))} ${t.unverified ? 'not published' : price(t.priceOut, cur)}`).join('<br>') : m.peakOffpeak ? `Peak ${price(m.peakOffpeak.peakOut, cur)}<br>Off-peak ${price(m.peakOffpeak.offOut, cur)}` : price(m.priceOut, cur),
      cache: m.priceTiers ? (m.priceTiers.every(t => t.priceCacheHit == null) ? 'Not published' : m.priceTiers.map(t => t.priceCacheHit == null ? 'not published' : price(t.priceCacheHit, cur)).join('<br>')) : m.peakOffpeak ? `Peak ${price(m.peakOffpeak.peakCache, cur)}<br>Off-peak ${price(m.peakOffpeak.offCache, cur)}` : (m.priceCacheHit == null ? 'Not published' : price(m.priceCacheHit, cur))
    };
    return { m, cur, cny, usd: v.t, cells };
  }).sort((a, b) => (a.cny == null ? 1 : b.cny == null ? -1 : a.cny - b.cny));
  const body = rows.map(r => `          <tr><th><a href="../../models/${esc(r.m.id)}/">${esc(enModelName(r.m))}</a></th><td>${esc(EN_VENDOR[r.m.vendor] || r.m.vendor)}</td><td class="num">${r.cells.in}</td><td class="num">${r.cells.out}</td><td class="num">${r.cells.cache}</td><td class="num">${r.m.context}K</td><td class="num">${r.cny == null ? 'Cannot estimate (tier rate not published)' : (r.cur === 'USD' ? `≈ ${money(r.cny)}<br><span class="lib-meta">list price ${money(r.usd, 'USD')}</span>` : money(r.cny))}</td><td class="num">${esc(r.m.verifiedAt)}</td></tr>`).join('\n');
  return `      <div class="table-scroll">
        <table class="spec wide">
          <thead>
            <tr><th>Model</th><th>Vendor / channel</th><th>Input price<br>(list price / 1M tokens)</th><th>Output price<br>(list price / 1M tokens)</th><th>Cache-hit price</th><th>Context</th><th>Est. monthly cost<br>(CNY-converted)</th><th>Verified</th></tr>
          </thead>
          <tbody>
${body}
          </tbody>
        </table>
      </div>
      <p class="s-hint">Assumptions: ${P.calls} calls/day · ${P.inTok} input / ${P.outTok} output tokens per call · off-peak rates · ${P.hit * 100}% cache hit rate · 30-day month; USD models converted at ${esc(enFxNote('USD') || 'a reference rate (unverified)')}. Estimates use list prices only and do not constitute purchase advice.</p>`;
}

/* 英文场景假设（与 GUIDE_SCENARIOS 同参数，仅文案为英文） */
const GUIDE_SCENARIOS_EN = [
  { key: 'chat', title: 'Scenario 1: Chatbot / online customer service', calls: 2000, inTok: 1200, outTok: 300, hit: 0.4,
    why: '<strong>Scenario assumptions</strong>: each turn carries the system prompt and recent history (about 1,200 tokens), with short replies (about 300 tokens); customer-service apps are call-heavy, so 2,000 calls/day. The system prompt is stable, so the cache hit rate is 40%. Cost structure: call count is the amplifier — lightweight low-price tiers win.' },
  { key: 'rag', title: 'Scenario 2: RAG knowledge-base Q&A', calls: 300, inTok: 10000, outTok: 500, hit: 0.6,
    why: '<strong>Scenario assumptions</strong>: retrieved knowledge chunks are injected with the prompt, so each call inputs about 10,000 tokens; answers are short (about 500 tokens); 300 Q&A/day. The system prompt and knowledge-base prefix are stable, so the cache hit rate is 60%. Cost structure: input dominates — the cache price and hit rate are the decisive variables.' },
  { key: 'agent', title: 'Scenario 3: Coding agent', calls: 100, inTok: 6000, outTok: 1500, hit: 0.2,
    why: '<strong>Scenario assumptions</strong>: each task carries code context and tool output (about 6,000 tokens) and produces a patch plus explanation (about 1,500 tokens); 100 tasks/day. Context varies a lot between tasks, so the cache hit rate is conservatively 20%. Cost structure: output carries the weight — output unit prices separate the field.' }
];
function cexScenariosHtmlEn() {
  return GUIDE_SCENARIOS_EN.map(s => {
    const rows = models.map(m => {
      const cur = modelCurrency(m);
      const v = monthlyFull(m, { off: true, hit: s.hit, calls: s.calls, inTok: s.inTok, outTok: s.outTok });
      const cny = Number.isNaN(v.t) ? null : toBase(v.t, cur, fx);
      return { m, cur, cny, usd: v.t };
    }).sort((a, b) => (a.cny == null ? 1 : b.cny == null ? -1 : a.cny - b.cny));
    const body = rows.map(r => `          <tr><th><a href="../../models/${esc(r.m.id)}/">${esc(enModelName(r.m))}</a></th><td>${esc(EN_VENDOR[r.m.vendor] || r.m.vendor)}</td><td class="num">${r.cny == null ? 'Cannot estimate (tier rate not published)' : (r.cur === 'USD' ? `≈ ${money(r.cny)}<br><span class="lib-meta">list price ${money(r.usd, 'USD')}</span>` : money(r.cny))}</td><td class="num">${esc(r.m.verifiedAt)}</td></tr>`).join('\n');
    return `      <h2 id="scene-${s.key}">${s.title}</h2>
      <p style="font-size:14px;line-height:1.9">${s.why}</p>
      <p class="s-hint">Assumptions: ${s.calls} calls/day · ${s.inTok} input / ${s.outTok} output tokens per call · ${s.hit * 100}% cache hit rate · off-peak rates · 30-day month. Monthly cost = calls × 30 × (input ÷ 1,000,000 × effective input price + output ÷ 1,000,000 × output price); tiered models pick the tier by the ${s.inTok}-token input, and tiers with unpublished rates are honestly marked "cannot estimate".</p>
      <div class="table-scroll">
        <table class="spec wide">
          <thead>
            <tr><th>Model</th><th>Vendor / channel</th><th>Est. monthly cost (CNY-converted)</th><th>Verified</th></tr>
          </thead>
          <tbody>
${body}
          </tbody>
        </table>
      </div>`;
  }).join('\n');
}

function cexSensitivityHtmlEn() {
  const rag = GUIDE_SCENARIOS_EN[1];
  const rows = CEX_SENS_MODELS.map(id => {
    const m = models.find(x => x.id === id);
    if (!m) return '';
    const cur = modelCurrency(m);
    const cells = CEX_SENS_HITS.map(h => {
      const v = monthlyFull(m, { off: true, hit: h, calls: rag.calls, inTok: rag.inTok, outTok: rag.outTok });
      if (Number.isNaN(v.t)) return '<td class="num">Cannot estimate</td>';
      const cny = toBase(v.t, cur, fx);
      return cur === 'USD'
        ? `<td class="num">≈ ${money(cny)}<br><span class="lib-meta">${money(v.t, 'USD')}</span></td>`
        : `<td class="num">${money(v.t)}</td>`;
    }).join('');
    const first = monthlyFull(m, { off: true, hit: 0, calls: rag.calls, inTok: rag.inTok, outTok: rag.outTok });
    const last = monthlyFull(m, { off: true, hit: 0.9, calls: rag.calls, inTok: rag.inTok, outTok: rag.outTok });
    const drop = Number.isNaN(first.t) || Number.isNaN(last.t) || first.t === 0 ? null : (1 - last.t / first.t) * 100;
    return `          <tr><th><a href="../../models/${esc(m.id)}/">${esc(enModelName(m))}</a>${m.priceCacheHit == null && !m.peakOffpeak ? '<br><span class="lib-meta">no published cache price</span>' : ''}</th>${cells}<td class="num">${drop == null ? '—' : `≈ −${drop.toFixed(0)}%`}</td><td class="num">${esc(m.verifiedAt)}</td></tr>`;
  }).join('\n');
  return `      <div class="table-scroll">
        <table class="spec wide">
          <thead>
            <tr><th>Model</th><th>Hit rate 0%</th><th>Hit rate 30%</th><th>Hit rate 60%</th><th>Hit rate 90%</th><th>Drop 0% → 90%</th><th>Verified</th></tr>
          </thead>
          <tbody>
${rows}
          </tbody>
        </table>
      </div>
      <p class="s-hint">Reading the table: the lower a model's cache price (e.g. DeepSeek V4.1 Flash off-peak cache price ¥0.02/1M), the bigger the drop as hit rate rises. Models without a published cache price (e.g. MiniMax M3) are billed at the standard input price, so hit rate changes nothing — which is exactly why "check whether the vendor publishes a cache price" matters. USD models keep their $ list price and are converted at ${esc(enFxNote('USD') || 'a reference rate (unverified)')}.</p>`;
}

function wfCostHtmlEn() {
  const rows = WF_COST_MODELS.map(id => models.find(m => m.id === id)).filter(Boolean).map(m => {
    const cur = modelCurrency(m);
    const v = monthlyFull(m, { off: true, hit: 0.3, calls: 1000, inTok: 2000, outTok: 800 });
    const per1k = v.t / 30;
    const cny = toBase(per1k, cur, fx);
    const cell = cur === 'USD' ? `≈ ${money(cny)}<br><span class="lib-meta">${money(per1k, 'USD')}</span>` : money(per1k);
    return `          <tr><th><a href="../../models/${esc(m.id)}/">${esc(enModelName(m))}</a></th><td>${esc(enVendorLabel(m))}</td><td class="num">Input ${price(m.priceIn, cur)} / Output ${price(m.priceOut, cur)}${m.priceCacheHit != null ? ` / Cache ${price(m.priceCacheHit, cur)}` : ' / Cache not published'}</td><td class="num">${cell}</td><td class="num">${esc(m.verifiedAt)}</td></tr>`;
  }).join('\n');
  return `      <div class="table-scroll">
        <table class="spec wide">
          <thead>
            <tr><th>Model</th><th>Vendor / channel</th><th>List price (per 1M tokens)</th><th>Per 1,000 runs (CNY-converted)</th><th>Verified</th></tr>
          </thead>
          <tbody>
${rows}
          </tbody>
        </table>
      </div>
      <p class="s-hint">Basis: each run = 1 model call (2,000 input / 800 output tokens · 30% cache hit rate · off-peak rates); USD models converted at ${esc(enFxNote('USD') || 'a reference rate (unverified)')}, indicative only. Monthly cost for N runs/day = table value × N ÷ 1,000. Models without a published cache price are billed at the standard input price.</p>`;
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

/* 英文模型卡片（/en/models/ 注入）：与 modelCardsHtml 同一数据源；已翻译模型链英文详情，未翻译链中文详情并明示 */
function modelCardsHtmlEn() {
  return models.map(m => {
    const cur = modelCurrency(m);
    const vendorEn = EN_VENDOR[m.vendor] || m.vendor;
    const priceLine = m.priceTiers
      ? `${esc(enTierDesc(m.priceTiers[0].desc))} In ${price(m.priceTiers[0].priceIn, cur)} / Out ${price(m.priceTiers[0].priceOut, cur)} · tiered`
      : m.peakOffpeak
        ? `Peak In ${price(m.peakOffpeak.peakIn, cur)} / Out ${price(m.peakOffpeak.peakOut, cur)} · off-peak ≈ half`
        : `Input ${price(m.priceIn, cur)} / Output ${price(m.priceOut, cur)}`;
    const cnyLine = cur === 'USD'
      ? `<p class="lib-meta">≈ ¥${(m.priceIn * (fxEntry(fx, 'USD')?.rate || 0)).toFixed(2)} / ¥${(m.priceOut * (fxEntry(fx, 'USD')?.rate || 0)).toFixed(2)} (CFETS central parity, indicative only)</p>`
      : '';
    const costCny = monthlyBase(m, fx);
    const hasEn = EN_MODELS.includes(m.id);
    const href = hasEn ? `${m.id}/` : `../../models/${m.id}/`;
    return `      <a class="module-card active" href="${esc(href)}" data-search="${esc(`${m.name} ${m.id} ${m.vendor} ${vendorEn}`.toLowerCase())}" data-vendor="${esc(vendorEn)}" data-cur="${cur}" data-cost="${costCny == null ? '' : costCny.toFixed(4)}" data-ctx="${m.context}" data-verified="${esc(m.verifiedAt)}">
        <h3>${esc(enModelName(m))}</h3>
        <p>${esc(vendorEn)}</p>
        <p class="num">${priceLine}</p>
        ${cnyLine}
        <p class="lib-meta">Context ${m.context}K · ${m.peakOffpeak ? 'time-based' : m.priceTiers ? 'tiered' : 'single price'} · ${cur === 'USD' ? 'USD list price · ' : ''}verified ${esc(m.verifiedAt)}</p>
        <span class="go">${hasEn ? 'View profile →' : 'View profile (中文) →'}</span>
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

/* 英文工具分组（/en/tools/ 注入）：与 toolGroupsHtml 同一数据源，展示字段走 i18n 字典 */
function toolGroupsHtmlEn(pairsCount) {
  const fill = s => s.replace(/\{modelCount\}/g, String(models.length)).replace(/\{compareCount\}/g, String(pairsCount));
  const out = [];
  for (const cat of TOOL_ORDER) {
    const list = tools.filter(t => t.category === cat);
    if (!list.length) continue;
    out.push(`      <h2 class="group-title">${esc(EN_TOOL_CATEGORY[cat] || cat)}</h2>\n      <div class="tool-grid">`);
    for (const t of list) {
      const meta = EN_TOOL[t.id];
      if (!meta) throw new Error(`EN_TOOL missing for ${t.id}`);
      if (t.own) {
        out.push(`        <div class="result-card">
          <div class="r-head"><span class="r-name">${esc(EN_TOOL_NAME[t.id] || t.name)}<span class="free-badge own-badge">In-house</span></span></div>
          <p style="font-size:14px;margin-top:6px">${fill(esc(meta.tagline))}</p>
          <p class="lib-meta">Use case: ${esc(meta.scene)}</p>
          <div class="cta-row"><a class="btn btn-primary btn-s" href="/en${esc(t.url)}">Open tool →</a></div>
        </div>`);
      } else {
        const u = safeUrl(t.url);
        out.push(`        <div class="result-card">
          <div class="r-head"><span class="r-name">${esc(enToolName(t))}<span class="free-badge free-${esc(t.free)}">${esc(EN_TOOL_FREE[t.free] || t.free)}</span></span></div>
          <p style="font-size:14px;margin-top:6px">${esc(meta.tagline)}</p>
          <p class="lib-meta">Use case: ${esc(meta.scene)} · verified ${esc(t.verifiedAt)}</p>
          <div class="cta-row"><a class="btn btn-ghost btn-s" href="${esc(t.id)}/">Details</a>${u ? `<a class="btn btn-primary btn-s" href="${esc(u)}" target="_blank" rel="noopener" data-tool="${esc(t.id)}">Official site →</a>` : ''}</div>
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

/* ---------- 内联注入片段（旧 injectRegion 参数中直接拼接的字符串，抽成函数） ---------- */
/* 首页"模型对比"卡片的组合数量文案 */
function homeCmpHtml() {
  return `${pairs.length} 组`;
}

/* 对比目录页的统计脚注（数量来自构建时真实数据，禁止手写） */
function cmpStatsHtml() {
  return `<p class="s-hint">全部 ${pairs.length} 组对比（${models.length} 款模型两两全组合）均可通过上方选择器进入；每个对比页都有固定口径摘要与双向模型档案链接。</p>`;
}

function cmpStatsHtmlEn() {
  return `<p class="s-hint">All ${pairs.length} pairs (every combination of ${models.length} models) are reachable from the selector above; each comparison page has a fixed-basis summary and links to both model profiles.</p>`;
}

/* 模型目录排序口径说明（汇率注记取自 fx.json 同一事实数据） */
function modelToolbarMetaHtml() {
  const note = fxNote('USD');
  return `<p class="s-hint" style="margin:-6px 0 14px">价格排序按默认用量估算月成本（与成本计算器同口径）统一折算为人民币${note ? `（${esc(note)}，折算仅供参考）` : '（参考汇率未核实，美元模型不参与价格排序）'}；费率未核实的模型不参与价格排序。</p>`;
}

function modelToolbarMetaHtmlEn() {
  const note = enFxNote('USD');
  return `<p class="s-hint" style="margin:-6px 0 14px">Price sorting converts each model's estimated monthly cost at default usage (same basis as the cost calculator) to CNY${note ? ` (${esc(note)}, indicative only)` : ' (reference rate unverified)'}; models with unverified rates are excluded from price sorting.</p>`;
}

export { round2, fxNote, enFxNote, ICON_YES, ICON_NO, tagsHtml, footerHtml, footerHtmlEn, breadcrumb, priceTable, modelDetail, enPriceRows, tagsHtmlEn, modelDetailEn, cellPrice, lowPrices, fmtDiff, compareDetail, EN_PEAK_WINDOW, cellPriceEn, srcLinkEn, compareDetailEn, srcLink, toolDetailRich, toolDetail, toolDetailEn, costExampleHtml, costTableHtmlEn, costExampleHtmlEn, guideExampleHtml, guidePriceCells, pcompTableHtml, GUIDE_SCENARIOS, cexScenariosHtml, CEX_SENS_MODELS, CEX_SENS_HITS, cexSensitivityHtml, WF_COST_MODELS, wfCostHtml, guideExampleHtmlEn, pcompTableHtmlEn, GUIDE_SCENARIOS_EN, cexScenariosHtmlEn, cexSensitivityHtmlEn, wfCostHtmlEn, modelCardsHtml, modelCardsHtmlEn, TOOL_ORDER, TOOL_TITLES, toolGroupsHtml, toolGroupsHtmlEn, costTableHtml, homeCmpHtml, cmpStatsHtml, cmpStatsHtmlEn, modelToolbarMetaHtml, modelToolbarMetaHtmlEn };
