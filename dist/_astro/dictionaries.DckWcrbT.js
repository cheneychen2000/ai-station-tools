// src/lib/i18n/dictionaries.mjs
/**
* 语言文案层：事实数据（models.json，中文枚举值）→ 英文展示的唯一翻译来源。
*
* 边界：models.json 只存事实数据；本文件只存展示翻译；页面模板只引用字典，不散落条件判断。
* 构建期 assertEnCoverage 保证字典覆盖全部事实枚举，缺译直接终止构建（不静默生成中英混杂页面）。
* 浏览器端由 build.mjs 把本模块序列化为 dist/assets/labels-en.js（同一份数据，双端共享）。
*/
/** @type {Record<string, string>} */
var EN_VENDOR = {
	"DeepSeek": "DeepSeek",
	"腾讯云原厂直供": "Tencent Cloud (official direct)",
	"阿里云百炼·智谱直供": "Alibaba Cloud Model Studio · Zhipu (direct)",
	"阿里云百炼": "Alibaba Cloud Model Studio",
	"阿里云百炼（≤128K档）": "Alibaba Cloud Model Studio (≤128K tier)",
	"阿里云百炼（≤256K档，原价）": "Alibaba Cloud Model Studio (≤256K tier, list price)",
	"腾讯云": "Tencent Cloud",
	"MiniMax 稀宇科技": "MiniMax",
	"阿里云百炼·小米（≤256K档）": "Alibaba Cloud Model Studio · Xiaomi (≤256K tier)",
	"阿里云百炼·阶跃星辰": "Alibaba Cloud Model Studio · StepFun",
	"OpenAI": "OpenAI",
	"Anthropic": "Anthropic",
	"Google": "Google"
};
/** @type {Record<string, string>} */
var EN_MODALITY = {
	"文本": "Text",
	"图像理解": "Image understanding",
	"音频": "Audio",
	"视频理解": "Video understanding"
};
/** @type {Record<string, string>} */
var EN_FEATURE = {
	"低谷半价": "Half price off-peak",
	"批量跑批首选": "Best for batch jobs",
	"推理快": "Fast reasoning",
	"旗舰推理": "Flagship reasoning",
	"Agent强": "Strong agent skills",
	"工具调用强": "Strong tool calling",
	"轻量低价": "Lightweight, low cost",
	"仅思考模式": "Thinking-only mode",
	"超长上下文": "Ultra-long context",
	"长文档解析": "Long-document parsing",
	"均衡通用": "Balanced general use",
	"开源生态": "Open-source ecosystem",
	"限时8折": "Limited-time 20% off",
	"均衡主力": "Balanced workhorse",
	"最新轻量": "Latest lightweight",
	"1M长上下文": "1M-token context",
	"多模态": "Multimodal",
	"腾讯生态": "Tencent ecosystem",
	"最新旗舰": "Latest flagship",
	"双模式": "Dual mode",
	"小米开源": "Xiaomi open-source",
	"推理型": "Reasoning model",
	"低价轻量": "Low-cost, lightweight",
	"阶跃出品": "By StepFun",
	"大批量低价": "Low cost at scale",
	"高效轻量": "Efficient, lightweight",
	"复杂编码": "Complex coding",
	"智能体任务": "Agentic tasks",
	"子任务代理": "Subtask agent",
	"智能体编码": "Agentic coding",
	"海量轻任务": "High-volume light tasks",
	"翻译数据处理": "Translation & data processing"
};
/** @type {string[][]} */
var EN_TIER_DESC = [
	["输入", "Input"],
	["输出", "Output"],
	["提示", "Prompt"],
	["（长上下文）", " (long context)"]
];
export { EN_VENDOR as i, EN_MODALITY as n, EN_TIER_DESC as r, EN_FEATURE as t };
