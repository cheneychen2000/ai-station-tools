/**
 * 站点级共享状态：一次加载数据、一次构建路由映射，供全部页面与组件复用。
 * 与旧 scripts/build.mjs 顶部的数据装配逻辑等价（逻辑不改）。
 */
import { loadData, comparePairs } from './manifest.mjs';
import { buildRouteMap, validateRouteMap } from './locales.mjs';
import { EN_MODEL_NAME, EN_SOURCE, EN_VENDOR, EN_TOOL_NAME } from './i18n.mjs';

const data = loadData();
export const models = data.models;
export const tools = data.tools;
export const pagesMeta = data.pagesMeta;
export const fx = data.fx;
export const compares = data.compares;

/** 全部对比组合（a<b 归一；2026-10-28 起 17 款模型两两全组合 = 136 组） */
export const pairs = comparePairs(models, compares.extraPairs || []);

/** 全站语言 URL 唯一事实来源；任一校验失败直接中断构建 */
export const routeMap = validateRouteMap(buildRouteMap(pagesMeta, models, pairs, tools));

/* 英文展示辅助：事实字段保持原值，英文页统一经字典呈现（缺译已被 assertEnCoverage 拦截） */
export const enModelName = m => EN_MODEL_NAME[m.id] || m.name;
export const enSrcLabel = m => EN_SOURCE[m.sourceUrl] || m.sourceName;
export const enVendorLabel = m => EN_VENDOR[m.vendor] || m.vendor;
export const enToolName = t => EN_TOOL_NAME[t.id] || t.name;
