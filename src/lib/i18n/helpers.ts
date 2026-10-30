/**
 * 英文展示辅助：事实字段保持原值，英文页统一经字典呈现（缺译已被 assertEnCoverage 拦截）。
 * 字典本体在同目录 dictionaries.mjs（纯数据模块）。
 */
import { EN_MODEL_NAME, EN_SOURCE, EN_VENDOR, EN_TOOL_NAME } from './dictionaries.mjs';
import type { Model, Tool } from '../data/schemas';

export const enModelName = (m: Model): string => EN_MODEL_NAME[m.id] || m.name;
export const enSrcLabel = (m: Model): string => EN_SOURCE[m.sourceUrl] || m.sourceName;
export const enVendorLabel = (m: Model): string => EN_VENDOR[m.vendor] || m.vendor;
export const enToolName = (t: Tool): string => EN_TOOL_NAME[t.id] || t.name;
