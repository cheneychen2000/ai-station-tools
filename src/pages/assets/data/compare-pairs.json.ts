/**
 * assets/data/compare-pairs.json 静态端点：已生成的对比页组合清单（a<b 归一）。
 * /compare/ 选择器仅允许跳转清单内组合；清单由当前 models.json 全组合推导（唯一事实源）。
 */
import type { APIRoute } from 'astro';
import { getSiteData } from '../../../lib/data';

export const GET: APIRoute = async () => {
  const { pairs } = await getSiteData();
  const body = JSON.stringify({
    description: '已生成的对比页组合清单（a<b 归一）。/compare/ 选择器仅允许跳转清单内组合；新增组合须登记 compares.json allowlist 并重新构建。',
    pairs
  }, null, 1) + '\n';
  return new Response(body, { headers: { 'Content-Type': 'application/json; charset=utf-8' } });
};
