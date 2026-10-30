/**
 * assets/labels-en.js 静态端点：英文展示字典的浏览器运行时版本，
 * 由 i18n 字典模块序列化生成（唯一翻译来源，禁止手改）。
 */
import type { APIRoute } from 'astro';
import { EN_VENDOR, EN_MODALITY, EN_FEATURE, EN_TIER_DESC, EN_PROMPT_SCENE, EN_PROMPT_TAG, EN_PROMPT_TITLE } from '../../lib/i18n/dictionaries.mjs';

export const GET: APIRoute = () => {
  const body = `/* 自动生成：src/lib/i18n.mjs 序列化，构建期写入，禁止手改 */\nwindow.EnLabels = ${JSON.stringify({ vendor: EN_VENDOR, modality: EN_MODALITY, feature: EN_FEATURE, tierDesc: EN_TIER_DESC.map(x => [...x]), promptScene: EN_PROMPT_SCENE, promptTag: EN_PROMPT_TAG, promptTitle: EN_PROMPT_TITLE })};\n`;
  return new Response(body, { headers: { 'Content-Type': 'application/javascript; charset=utf-8' } });
};
