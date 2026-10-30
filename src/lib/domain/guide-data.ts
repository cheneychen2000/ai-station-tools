/**
 * 指南页静态数据表的业务常量（场景假设、敏感性选样、工作流选样）与共享行构建器。
 * 常量与迁移前 render.mjs 内嵌值逐字一致；行构建与 pricing.mjs 公式一致（统一折算 CNY 升序、未核实置尾）。
 */
import { monthlyFull, toBase, modelCurrency } from './pricing';
import type { Model, FxFile } from '../data/schemas';

export interface GuideCostParams { calls: number; inTok: number; outTok: number; hit: number; off?: boolean }
export interface GuideCostRow {
  m: Model;
  cur: string;
  /** 折算 CNY；无法估算（档位费率未公开）为 null */
  cny: number | null;
  /** 官方原币月成本 */
  usd: number;
}

export function guideCostRows(models: Model[], fx: FxFile, params: GuideCostParams): GuideCostRow[] {
  return models.map(m => {
    const cur = modelCurrency(m);
    const v = monthlyFull(m, { off: params.off ?? true, hit: params.hit, calls: params.calls, inTok: params.inTok, outTok: params.outTok });
    const cny = Number.isNaN(v.t) ? null : toBase(v.t, cur, fx);
    return { m, cur, cny, usd: v.t };
  }).sort((x, y) => (x.cny == null ? 1 : y.cny == null ? -1 : x.cny - y.cny));
}

export interface GuideScenario {
  key: string;
  title: string;
  calls: number;
  inTok: number;
  outTok: number;
  hit: number;
  /** 受信任的静态 HTML 片段（含 <strong> 标注），组件以 set:html 输出 */
  why: string;
}

export const GUIDE_SCENARIOS: GuideScenario[] = [
  { key: 'chat', title: '场景一：聊天机器人 / 在线客服', calls: 2000, inTok: 1200, outTok: 300, hit: 0.4,
    why: '<strong>场景假设</strong>：单轮输入含系统提示词与近期历史（约 1,200 Token），回复简短（约 300 Token）；客服类应用调用高频，取日均 2,000 次。系统提示词稳定，缓存命中率取 40%。成本结构：调用次数是被放大器，轻量低价档优势明显。' },
  { key: 'rag', title: '场景二：RAG 知识库问答', calls: 300, inTok: 10000, outTok: 500, hit: 0.6,
    why: '<strong>场景假设</strong>：检索出的知识片段随提示词注入，单次输入约 10,000 Token；答案简短（约 500 Token）；日均 300 次问答。系统提示词与知识库前缀稳定，缓存命中率取 60%。成本结构：输入项占主导，缓存价与命中率是决定性变量。' },
  { key: 'agent', title: '场景三：编码 Agent', calls: 100, inTok: 6000, outTok: 1500, hit: 0.2,
    why: '<strong>场景假设</strong>：每次任务携带代码上下文与工具输出（约 6,000 Token），产出补丁与解释（约 1,500 Token）；日均 100 个任务。上下文随任务变化大，缓存命中率保守取 20%。成本结构：输出项权重高，输出单价差异直接拉开差距。' }
];

export const GUIDE_SCENARIOS_EN: GuideScenario[] = [
  { key: 'chat', title: 'Scenario 1: Chatbot / online customer service', calls: 2000, inTok: 1200, outTok: 300, hit: 0.4,
    why: '<strong>Scenario assumptions</strong>: each turn carries the system prompt and recent history (about 1,200 tokens), with short replies (about 300 tokens); customer-service apps are call-heavy, so 2,000 calls/day. The system prompt is stable, so the cache hit rate is 40%. Cost structure: call count is the amplifier — lightweight low-price tiers win.' },
  { key: 'rag', title: 'Scenario 2: RAG knowledge-base Q&A', calls: 300, inTok: 10000, outTok: 500, hit: 0.6,
    why: '<strong>Scenario assumptions</strong>: retrieved knowledge chunks are injected with the prompt, so each call inputs about 10,000 tokens; answers are short (about 500 tokens); 300 Q&A/day. The system prompt and knowledge-base prefix are stable, so the cache hit rate is 60%. Cost structure: input dominates — the cache price and hit rate are the decisive variables.' },
  { key: 'agent', title: 'Scenario 3: Coding agent', calls: 100, inTok: 6000, outTok: 1500, hit: 0.2,
    why: '<strong>Scenario assumptions</strong>: each task carries code context and tool output (about 6,000 tokens) and produces a patch plus explanation (about 1,500 tokens); 100 tasks/day. Context varies a lot between tasks, so the cache hit rate is conservatively 20%. Cost structure: output carries the weight — output unit prices separate the field.' }
];

export const CEX_SENS_MODELS = ['deepseek-v41-flash', 'glm-53', 'gpt-6-1-sol', 'minimax-m3'];
export const CEX_SENS_HITS = [0, 0.3, 0.6, 0.9];
export const WF_COST_MODELS = ['deepseek-v41-flash', 'glm-53-flash', 'gpt-6-luna', 'kimi-k3'];

/** 工具目录分组顺序与自研组标题（与迁移前 TOOL_ORDER/TOOL_TITLES 一致） */
export const TOOL_ORDER = ['自研', '对话', '绘图', '视频', '编程', '办公'];
export const TOOL_TITLES: Record<string, string> = { '自研': '本站自研工具' };
