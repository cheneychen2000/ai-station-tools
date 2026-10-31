/**
 * 联盟 CTA / 广告位标记的持久化与状态转换测试（不触碰 dist 正式配置，全部用夹具内存测试）。
 * 覆盖：candidate→active→paused→active（每次最多一个 CTA、标记不丢、连续构建不重复）；
 *      广告 disabled→enabled(仅本地测试 ID)→disabled（容器出现/消失、标记保留）。
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { DIST } from './lib/paths.mjs';
import { replacePlacementMarkers } from './lib/placement.mjs';
import { createReporter } from './lib/report.mjs';

const R = createReporter('test-placement-transitions');

/* 真实配置核验：Make 必须保持 candidate 且 referralUrl 为 null（不得生成虚构链接） */
const realPartners = JSON.parse(readFileSync(join(DIST, 'assets/data/partners.json'), 'utf8')).partners;
const realAds = JSON.parse(readFileSync(join(DIST, 'assets/data/ads.json'), 'utf8'));
const realMake = realPartners.find(p => p.partnerId === 'make');
R.check('真实配置：Make 保持 candidate 且 referralUrl=null', realMake && realMake.status === 'candidate' && realMake.referralUrl == null);
R.check('真实配置：广告 enabled=false 且 publisherId=null', realAds.enabled !== true && realAds.publisherId == null);
R.check('真实配置：ElevenLabs/Writesonic 均为 candidate', ['elevenlabs', 'writesonic'].every(id => {
  const p = realPartners.find(x => x.partnerId === id);
  return p && p.status === 'candidate' && p.referralUrl == null;
}));

/* 夹具 */
const PAGE = '<section>\n      <!-- AFFILIATE:make -->\n      <!-- ADSLOT:guide-mid -->\n    </section>';
const makeFixture = (status, referralUrl) => ({
  partnerId: 'make', name: 'Make', category: '自动化', officialUrl: 'https://www.make.com/',
  officialTermsUrl: 'https://www.make.com/en/affiliate', referralUrl: referralUrl || null, status,
  commissionTerms: null, lastVerifiedAt: '2026-10-28', verifiedBy: 'test', placements: ['guides/'],
  disclosureText: '推广合作：通过本站链接注册 Make，本站可能获得佣金。'
});
const TEST_PUB = 'ca-pub-1234567890123456'; /* 本地测试 ID，非真实账户 */
const adsFixture = (enabled) => ({ enabled, publisherId: enabled ? TEST_PUB : null, slots: { 'guide-mid': { format: 'auto' } } });
const ctaCount = html => (html.match(/class="affiliate-cta"/g) || []).length;
const slotCount = html => (html.match(/data-ad-slot=/g) || []).length;

/* candidate：无 CTA，标记保留 */
let html = replacePlacementMarkers(PAGE, [makeFixture('candidate')], adsFixture(false));
R.check('candidate：无 CTA、标记保留、无广告容器', ctaCount(html) === 0 && slotCount(html) === 0 &&
  html.includes('<!-- AFFILIATE:make:BEGIN -->') && html.includes('<!-- ADSLOT:guide-mid:BEGIN -->'));

/* active：恰好 1 个 CTA，sponsored+noopener+披露在旁，标记保留；二次构建不重复 */
html = replacePlacementMarkers(html, [makeFixture('active', 'https://www.make.com/ref/test?aff=1')], adsFixture(false));
R.check('active：恰好 1 个 CTA 且 rel/披露齐全、标记保留', ctaCount(html) === 1 &&
  html.includes('rel="sponsored nofollow noopener"') && html.includes('推广合作') &&
  html.includes('<!-- AFFILIATE:make:BEGIN -->'));
html = replacePlacementMarkers(html, [makeFixture('active', 'https://www.make.com/ref/test?aff=1')], adsFixture(false));
R.check('active 连续构建：仍恰好 1 个 CTA（无叠加）', ctaCount(html) === 1);

/* paused：CTA 移除、标记保留 */
html = replacePlacementMarkers(html, [makeFixture('paused', 'https://www.make.com/ref/test?aff=1')], adsFixture(false));
R.check('paused：CTA 消失、标记保留（可再次激活）', ctaCount(html) === 0 && html.includes('<!-- AFFILIATE:make:BEGIN -->'));

/* 再次 active：重新出现且仅 1 个 */
html = replacePlacementMarkers(html, [makeFixture('active', 'https://www.make.com/ref/test?aff=1')], adsFixture(false));
R.check('再次 active：CTA 恢复且仅 1 个', ctaCount(html) === 1);

/* 广告：disabled→enabled(测试 ID)→disabled */
html = replacePlacementMarkers(PAGE, [makeFixture('candidate')], adsFixture(true));
R.check('广告 enabled(测试 ID)：恰好 1 个容器、标记保留', slotCount(html) === 1 && html.includes('<!-- ADSLOT:guide-mid:BEGIN -->'));
html = replacePlacementMarkers(html, [makeFixture('candidate')], adsFixture(true));
R.check('广告连续构建：仍恰好 1 个容器（无叠加）', slotCount(html) === 1);
html = replacePlacementMarkers(html, [makeFixture('candidate')], adsFixture(false));
R.check('广告 disabled：容器消失、标记保留', slotCount(html) === 0 && html.includes('<!-- ADSLOT:guide-mid:BEGIN -->'));

/* 无效 Publisher ID 不得渲染容器 */
html = replacePlacementMarkers(PAGE, [makeFixture('candidate')], { enabled: true, publisherId: 'ca-pub-123', slots: { 'guide-mid': {} } });
R.check('非法 Publisher ID：不渲染容器', slotCount(html) === 0);

R.summary();
