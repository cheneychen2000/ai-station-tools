// 迁移回归入口（npm run check:migrate）：dist 产物与迁移前基线快照对拍
// （URL 集合 + 每页 SEO 语义 + 资产字节契约；基线采集见 scripts/snapshot-site.mjs capture）
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const res = spawnSync(process.execPath, [join(here, 'snapshot-site.mjs'), 'compare', join(here, '..', 'migration', 'baseline-snapshot.json')], { stdio: 'inherit' });
process.exit(res.status ?? 1);
