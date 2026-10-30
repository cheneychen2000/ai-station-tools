/**
 * 语言文案层：事实数据（models.json，中文枚举值）→ 英文展示的唯一翻译来源。
 *
 * 边界：models.json 只存事实数据；本文件只存展示翻译；页面模板只引用字典，不散落条件判断。
 * 构建期 assertEnCoverage 保证字典覆盖全部事实枚举，缺译直接终止构建（不静默生成中英混杂页面）。
 * 浏览器端由 build.mjs 把本模块序列化为 dist/assets/labels-en.js（同一份数据，双端共享）。
 */

/* 厂商/渠道（models.json vendor 字段） */
/** @type {Record<string, string>} */
export const EN_VENDOR = {
  'DeepSeek': 'DeepSeek',
  '腾讯云原厂直供': 'Tencent Cloud (official direct)',
  '阿里云百炼·智谱直供': 'Alibaba Cloud Model Studio · Zhipu (direct)',
  '阿里云百炼': 'Alibaba Cloud Model Studio',
  '阿里云百炼（≤128K档）': 'Alibaba Cloud Model Studio (≤128K tier)',
  '阿里云百炼（≤256K档，原价）': 'Alibaba Cloud Model Studio (≤256K tier, list price)',
  '腾讯云': 'Tencent Cloud',
  'MiniMax 稀宇科技': 'MiniMax',
  '阿里云百炼·小米（≤256K档）': 'Alibaba Cloud Model Studio · Xiaomi (≤256K tier)',
  '阿里云百炼·阶跃星辰': 'Alibaba Cloud Model Studio · StepFun',
  'OpenAI': 'OpenAI',
  'Anthropic': 'Anthropic',
  'Google': 'Google'
};

/* 模态（models.json modalities 字段） */
/** @type {Record<string, string>} */
export const EN_MODALITY = {
  '文本': 'Text',
  '图像理解': 'Image understanding',
  '音频': 'Audio',
  '视频理解': 'Video understanding'
};

/* 能力标签（models.json features 字段，≤6 字短标签） */
/** @type {Record<string, string>} */
export const EN_FEATURE = {
  '低谷半价': 'Half price off-peak', '批量跑批首选': 'Best for batch jobs', '推理快': 'Fast reasoning',
  '旗舰推理': 'Flagship reasoning', 'Agent强': 'Strong agent skills', '工具调用强': 'Strong tool calling',
  '轻量低价': 'Lightweight, low cost', '仅思考模式': 'Thinking-only mode', '超长上下文': 'Ultra-long context',
  '长文档解析': 'Long-document parsing', '均衡通用': 'Balanced general use', '开源生态': 'Open-source ecosystem',
  '限时8折': 'Limited-time 20% off', '均衡主力': 'Balanced workhorse', '最新轻量': 'Latest lightweight',
  '1M长上下文': '1M-token context', '多模态': 'Multimodal', '腾讯生态': 'Tencent ecosystem',
  '最新旗舰': 'Latest flagship', '双模式': 'Dual mode', '小米开源': 'Xiaomi open-source', '推理型': 'Reasoning model',
  '低价轻量': 'Low-cost, lightweight', '阶跃出品': 'By StepFun', '大批量低价': 'Low cost at scale',
  '高效轻量': 'Efficient, lightweight', '复杂编码': 'Complex coding', '智能体任务': 'Agentic tasks',
  '子任务代理': 'Subtask agent', '智能体编码': 'Agentic coding', '海量轻任务': 'High-volume light tasks',
  '翻译数据处理': 'Translation & data processing'
};

/* 价档描述（models.json priceTiers[].desc 字段，按序替换） */
/** @type {string[][]} */
export const EN_TIER_DESC = [
  ['输入', 'Input'],
  ['输出', 'Output'],
  ['提示', 'Prompt'],
  ['（长上下文）', ' (long context)']
];

export function enTierDesc(s) {
  let out = s;
  for (const [zh, en] of EN_TIER_DESC) out = out.split(zh).join(en);
  return out;
}

/* 英文模型详情页正文（页面级文案；事实数据仍读 models.json；不含任何性能/排名声称） */
const EDITOR_NOTE = 'Editor\'s note: this page records official pricing and specifications only and makes no quality or performance ranking claims. Evaluate output quality on your own workloads before committing.';
/** @type {Record<string, { vendorEn: string, vendorZhNote: string, positioning: string, useNote: string }>} */
export const EN_MODEL_COPY = {
  'glm-53-flash': {
    vendorEn: 'Alibaba Cloud Model Studio (Bailian) · Zhipu (direct)',
    vendorZhNote: '阿里云百炼·智谱直供',
    positioning: 'GLM-5.3-Flash is the lightweight, low-cost tier of Zhipu\'s GLM-5.3 family, served on Alibaba Cloud Model Studio (Bailian). It is a multimodal understanding model with a 1M-token context window, priced per 1M tokens in CNY.',
    useNote: 'Editor\'s note: with a 1M-token context and per-million-token CNY pricing, it is a candidate worth testing for high-volume text workloads with occasional image or video input. Evaluate output quality on your own data before committing; this page makes no quality or performance ranking claims.'
  },
  'deepseek-v41-flash': {
    vendorEn: 'DeepSeek (via Tencent Cloud TokenHub)',
    vendorZhNote: 'DeepSeek（腾讯云 TokenHub 渠道）',
    positioning: 'DeepSeek V4.1 Flash is a lightweight, fast model in the DeepSeek V4.1 series, offered through Tencent Cloud TokenHub. It supports text and image understanding with a 1000K context window, and uses time-based pricing: the off-peak rate is about half the peak rate.',
    useNote: EDITOR_NOTE
  },
  'deepseek-v4-pro': {
    vendorEn: 'Tencent Cloud (official direct)',
    vendorZhNote: '腾讯云原厂直供',
    positioning: 'DeepSeek V4 Pro (0813) is the flagship reasoning model in the DeepSeek V4 series, served directly by Tencent Cloud. It is a text model with a 1000K context window, using time-based pricing with an off-peak rate of about half the peak rate.',
    useNote: EDITOR_NOTE
  },
  'glm-53': {
    vendorEn: 'Alibaba Cloud Model Studio (Bailian) · Zhipu (direct)',
    vendorZhNote: '阿里云百炼·智谱直供',
    positioning: 'GLM-5.3 is Zhipu\'s flagship reasoning model, served on Alibaba Cloud Model Studio (Bailian). It is a text model with strong tool-calling support and a 1024K context window, priced per 1M tokens in CNY.',
    useNote: EDITOR_NOTE
  },
  'kimi-k3': {
    vendorEn: 'Alibaba Cloud Model Studio (Bailian) · Moonshot',
    vendorZhNote: '阿里云百炼',
    positioning: 'Kimi K3 is Moonshot AI\'s model, served on Alibaba Cloud Model Studio (Bailian). It focuses on ultra-long context and long-document parsing, supports text and image understanding, and has a 1024K context window.',
    useNote: EDITOR_NOTE
  },
  'qwen35-plus': {
    vendorEn: 'Alibaba Cloud Model Studio (≤128K tier)',
    vendorZhNote: '阿里云百炼（≤128K档）',
    positioning: 'Qwen3.5-Plus is a balanced general-purpose model on Alibaba Cloud Model Studio, listed at the ≤128K input tier. It is a text model with a 1000K context window, priced per 1M tokens in CNY.',
    useNote: EDITOR_NOTE
  },
  'qwen37-plus': {
    vendorEn: 'Alibaba Cloud Model Studio (≤256K tier, list price)',
    vendorZhNote: '阿里云百炼（≤256K档，原价）',
    positioning: 'Qwen3.7-Plus is a balanced workhorse model on Alibaba Cloud Model Studio, listed at the ≤256K input tier. It is a text model with a 1000K context window. The vendor lists a limited-time 20% discount on the official pricing page; this site records the list price and notes the promotion without assuming an end date.',
    useNote: EDITOR_NOTE
  },
  'qwen38-flash': {
    vendorEn: 'Alibaba Cloud Model Studio (Bailian)',
    vendorZhNote: '阿里云百炼',
    positioning: 'Qwen3.8-Flash is the latest lightweight model in Alibaba\'s Qwen3 series on Alibaba Cloud Model Studio. It supports text, image and video understanding with a 1000K (1M-token) context window, priced per 1M tokens in CNY.',
    useNote: EDITOR_NOTE
  },
  'hunyuan-turbos-vision': {
    vendorEn: 'Tencent Cloud',
    vendorZhNote: '腾讯云',
    positioning: 'Hunyuan TurboS Vision is Tencent Cloud\'s multimodal model with image understanding. It is a text + image model with a 128K context window, priced per 1M tokens in CNY.',
    useNote: EDITOR_NOTE
  },
  'minimax-m3': {
    vendorEn: 'MiniMax',
    vendorZhNote: 'MiniMax 稀宇科技',
    positioning: 'MiniMax M3 is MiniMax\'s latest flagship model with dual modes. It supports text, image and video understanding with a 1024K context window, and is billed in input-length tiers: a lower tier for inputs ≤512K and a higher tier above 512K.',
    useNote: EDITOR_NOTE
  },
  'mimo-v25-pro': {
    vendorEn: 'Alibaba Cloud Model Studio · Xiaomi (≤256K tier)',
    vendorZhNote: '阿里云百炼·小米（≤256K档）',
    positioning: 'MiMo V2.5 Pro is Xiaomi\'s open-source reasoning model, served on Alibaba Cloud Model Studio at the ≤256K input tier. It is a text model with a 1000K context window, priced per 1M tokens in CNY.',
    useNote: EDITOR_NOTE
  },
  'step-37-flash': {
    vendorEn: 'Alibaba Cloud Model Studio (Bailian) · StepFun',
    vendorZhNote: '阿里云百炼·阶跃星辰',
    positioning: 'Step 3.7 Flash is StepFun\'s low-cost lightweight model on Alibaba Cloud Model Studio. It supports text, image and video understanding with a 256K context window, priced per 1M tokens in CNY.',
    useNote: EDITOR_NOTE
  },
  'gpt-6-luna': {
    vendorEn: 'OpenAI',
    vendorZhNote: 'OpenAI',
    positioning: 'GPT-6 Luna is OpenAI\'s high-volume, low-cost model. It supports text and image understanding with a 1050K context window, billed in USD per 1M tokens with input-length tiers (≤272K and a long-context tier whose rates are not yet published).',
    useNote: EDITOR_NOTE
  },
  'gpt-6-1-sol': {
    vendorEn: 'OpenAI',
    vendorZhNote: 'OpenAI',
    positioning: 'GPT-6.1 Sol is OpenAI\'s model positioned for complex coding and agentic tasks. It supports text and image understanding with a 1050K context window, billed in USD per 1M tokens with input-length tiers (≤272K and a long-context tier whose rates are not yet published).',
    useNote: EDITOR_NOTE
  },
  'claude-haiku-5-5': {
    vendorEn: 'Anthropic',
    vendorZhNote: 'Anthropic',
    positioning: 'Claude Haiku 5.5 is Anthropic\'s low-cost, lightweight model for high-volume tasks and subtask agents. It supports text and image understanding with a 1024K context window, billed in USD per 1M tokens with prompt-length tiers (≤100K and >100K).',
    useNote: EDITOR_NOTE
  },
  'claude-sonnet-5-5': {
    vendorEn: 'Anthropic',
    vendorZhNote: 'Anthropic',
    positioning: 'Claude Sonnet 5.5 is Anthropic\'s balanced workhorse model for agentic coding and general use. It supports text and image understanding with a 1024K context window, billed in USD per 1M tokens.',
    useNote: EDITOR_NOTE
  },
  'gemini-3-1-flash-lite': {
    vendorEn: 'Google',
    vendorZhNote: 'Google',
    positioning: 'Gemini 3.1 Flash-Lite is Google\'s model for high-volume light tasks such as translation and data processing. It supports text, image and video understanding with a 1024K context window, billed in USD per 1M tokens.',
    useNote: EDITOR_NOTE
  }
};

/* ---------- 工具目录（tools.json 展示字段的英文翻译；事实字段仍以 tools.json 为准） ---------- */
/** @type {Record<string, string>} */
export const EN_TOOL_CATEGORY = { '自研': 'In-house tools', '对话': 'Chat', '绘图': 'Image', '视频': 'Video', '编程': 'Coding', '办公': 'Office' };
/* 工具名称英文（产品惯用英文名；含中文名第三方工具：豆包/即梦/可灵/通义灵码/讯飞听见） */
/** @type {Record<string, string>} */
export const EN_TOOL_NAME = {
  'own-cost': 'Cost Calculator', 'own-models': 'Model Library', 'own-compare': 'Model Comparison', 'own-quiz': 'Rank Test', 'own-prompts': 'Prompt Library',
  'doubao': 'Doubao', 'jimeng': 'Jimeng', 'kling': 'Kling AI', 'tongyi-lingma': 'Tongyi Lingma', 'iflyrec': 'iFLYREC'
};
/** @type {Record<string, string>} */
export const EN_TOOL_FREE = { '免费': 'Free', 'freemium': 'Freemium', '付费': 'Paid' };
/** @type {Record<string, { tagline: string, scene: string }>} */
export const EN_TOOL = {
  'own-cost': { tagline: 'Compare monthly API costs across 17 LLMs, with off-peak and cache weighting', scene: 'Estimate your monthly model API cost and find the cheapest option' },
  'own-models': { tagline: 'Context windows, modalities and price profiles of 17 mainstream models', scene: 'Check specs and prices before choosing a model, with verifiable sources' },
  'own-compare': { tagline: 'Two models compared line by line across 11 dimensions, 136 pairs', scene: 'Head-to-head comparison when deciding between two candidates' },
  'own-quiz': { tagline: '12 questions from general knowledge to pro, with a shareable result poster', scene: 'Test your AI literacy and share the result poster' },
  'own-prompts': { tagline: 'Ready-to-copy Chinese prompt templates for common scenarios', scene: 'Apply directly to writing, translation, coding and summarization tasks' },
  'deepseek-chat': { tagline: 'DeepSeek\'s official chat assistant, known for reasoning', scene: 'Daily Q&A, logical reasoning, code and math problem solving' },
  'kimi': { tagline: 'By Moonshot AI; a benchmark for ultra-long text handling', scene: 'Long-document reading, paper and report analysis, multi-file Q&A' },
  'doubao': { tagline: 'ByteDance\'s all-round assistant with strong voice and multimodal experience', scene: 'Daily conversational Q&A, voice interaction, image understanding' },
  'jimeng': { tagline: 'CapCut\'s AI creation platform with reliable Chinese poster generation', scene: 'Posters, covers and e-commerce visuals' },
  'midjourney': { tagline: 'The AI image tool with an artistic ceiling', scene: 'Concept design, illustration and stylized art' },
  'kling': { tagline: 'Kuaishou\'s video generation with natural human motion', scene: 'Text-to-video, image-to-video and short-video material' },
  'sora': { tagline: 'OpenAI\'s video generation model, strong at long-shot storytelling', scene: 'High-quality text-to-video and creative shorts' },
  'cursor': { tagline: 'The AI-native code editor defining conversational programming', scene: 'Full-stack development, refactoring and cross-file changes' },
  'github-copilot': { tagline: 'The established player for in-IDE code completion', scene: 'Inline completion, unit test generation and boilerplate' },
  'tongyi-lingma': { tagline: 'Alibaba Cloud\'s free AI coding assistant, friendly to Chinese comments', scene: 'Code completion, comment generation and Chinese technical Q&A' },
  'iflyrec': { tagline: 'iFLYTEK\'s AI meeting assistant with real-time transcription and summaries', scene: 'Meeting transcription, minutes and to-do extraction' },
  'wps-ai': { tagline: 'WPS Office\'s built-in AI for documents, spreadsheets and slides', scene: 'Document drafting, table analysis and presentation generation' }
};

/* ---------- Prompt 库英文标题字典（提示词本体保持中文，不翻译内容资产；标题英文化便于浏览） ---------- */
/** @type {Record<string, string>} */
export const EN_PROMPT_TITLE = {
  'polish-article': 'Article polish (keep your style)',
  'wechat-opener': 'WeChat article opener, 3 options',
  'translate-en': 'Idiomatic Chinese-to-English translation (two versions)',
  'code-review': 'Strict code review',
  'explain-code': 'Explain code to a beginner',
  'meeting-summary': 'Meeting notes cleanup',
  'article-summary': 'Long-read quick summary',
  'feynman': 'Explain a concept, Feynman-style',
  'exam-quiz': 'Quiz generator on any topic',
  'weekly-report': 'Turn work logs into a weekly report',
  'email-reply': 'Professional email reply',
  'short-video-script': '60-second short video script'
};

/* ---------- Prompt 库英文场景/标签字典（提示词本体保持中文，不翻译内容资产） ---------- */
/** @type {Record<string, string>} */
export const EN_PROMPT_SCENE = { '写作': 'Writing', '翻译': 'Translation', '编程': 'Coding', '总结': 'Summarization', '学习': 'Learning', '办公': 'Office', '创作': 'Creation' };
/** @type {Record<string, string>} */
export const EN_PROMPT_TAG = { '写作': 'writing', '润色': 'polish', '公众号': 'WeChat article', '翻译': 'translation', '编程': 'coding', '代码审查': 'code review', '学习': 'learning', '总结': 'summary', '办公': 'office', '阅读': 'reading', '自测': 'self-quiz', '周报': 'weekly report', '邮件': 'email', '创作': 'creation', '短视频': 'short video' };

/* ---------- 认知测试英文题库（事实与中文题库一致；dim/hard/answer 对齐 quiz.json） ---------- */
export const QUIZ_EN = {
  dims: [
    { key: 'concept', label: 'Concepts' },
    { key: 'price', label: 'Pricing' },
    { key: 'boundary', label: 'Limits' },
    { key: 'industry', label: 'Industry' },
    { key: 'practice', label: 'Practice' },
    { key: 'safety', label: 'Safety' }
  ],
  tiers: [
    { min: 12, name: 'Pro 9-dan', comment: 'A perfect score — even the quiz author nods.' },
    { min: 11, name: 'Pro 3-dan', comment: 'This question bank is barely a challenge anymore.' },
    { min: 10, name: 'Pro 1-dan', comment: 'Ahead of 90% of readers; you can teach your colleagues.' },
    { min: 9, name: 'Amateur 5-dan', comment: 'AI already has a desk in your workflow.' },
    { min: 8, name: 'Amateur 4-dan', comment: 'Clear on pricing and limits — AI can\'t fool you easily.' },
    { min: 6, name: 'Amateur 3-dan', comment: 'Your prompts have real structure; fundamentals solid.' },
    { min: 4, name: 'Amateur 2-dan', comment: 'You know where it shines and where it fails.' },
    { min: 2, name: 'Amateur 1-dan', comment: 'You\'ve started searching with AI — first step taken.' },
    { min: 0, name: 'Outsider', comment: 'It\'s windy outside the AI gate — come in and sit down.' }
  ],
  weakLinks: {
    price: { href: '../cost/', text: 'Brush up in the cost calculator →' },
    industry: { href: '../models/', text: 'Brush up in the model library →' },
    practice: { href: '../prompts/', text: 'Brush up in the prompt library →' },
    concept: { href: '../about/', text: 'Read the data & methodology notes →' },
    boundary: { href: '../about/', text: 'Read the data & methodology notes →' },
    safety: { href: '../about/', text: 'Read the data & methodology notes →' }
  },
  ui: {
    progress: function (i, n) { return 'Question ' + i + ' / ' + n; },
    correct: 'Correct', wrong: 'Incorrect', next: 'Next question', result: 'See results',
    score: function (s, n) { return 'Score ' + s + ' / ' + n; },
    percentile: function (p) { return 'Better than ' + p + '% of readers (estimated from a reference model)'; },
    copyDone: 'Copied — paste it anywhere', copyBtn: 'Copy result text', copyFail: 'Copy failed, take a screenshot',
    posterTitle: 'AI Literacy Rank Test', posterSub: '12 questions · six dimensions · instant explanations',
    posterScan: 'Scan to test your rank', posterNote: 'For fun only',
    share: function (tier, p) { return 'My AI literacy rank is "' + tier + '", better than ' + p + '% of readers. Beat that → reflex-hub.com/en/quiz'; },
    start: 'Start the test', loading: 'Loading questions…', loadFail: 'Failed to load questions — please refresh'
  },
  bank: [
    { dim: 'concept', hard: false, q: 'In LLM chat, what does the "context window" refer to?',
      options: ['The monitoring range of a camera', 'The amount of conversation the model can "remember" and process at once', 'The size of a phone screen', 'How many books were used in training'], answer: 1,
      explain: 'The window is the maximum number of tokens the model can process in one pass; earlier content beyond the window is either truncated or patched by external memory — which is why it "forgets" in long conversations.' },
    { dim: 'concept', hard: true, q: 'When AI confidently invents facts that don\'t exist, the industry calls it "hallucination". What is the main cause?',
      options: ['Random errors programmers left in on purpose', 'Network packet loss', 'A model is essentially "predicting the next word" — it generates the text that most looks like an answer instead of looking anything up', 'The user\'s question is too short'], answer: 2,
      explain: 'A large model is a probability generator, not a database: it optimizes for "sounds right", not "is true". Asking it for sources on important facts is the only self-defense.' },
    { dim: 'price', hard: false, q: 'In 2026, roughly what does it cost to generate 1 million output tokens (about a full novel) with a mainstream Chinese LLM API?',
      options: ['A few CNY to around one hundred', 'Over ten thousand CNY', 'Completely free, unlimited', 'Per-call billing at 1M tokens each'], answer: 0,
      explain: 'Flagship output prices cluster around 10–100 CNY per million tokens (GLM-5.3 is 28, Kimi K3 is 100), and lightweight models go as low as ~3 — "APIs are expensive" is outdated.' },
    { dim: 'price', hard: true, q: 'True or false: in the 2026 Chinese API market, the same model can cost about half as much for batch jobs at night versus peak daytime hours.',
      options: ['True: vendors like DeepSeek use peak/off-peak pricing, off-peak being about half of peak', 'False: APIs cost the same around the clock'], answer: 0,
      explain: 'DeepSeek defines peak (weekdays 9:00–12:00, 14:00–18:00) and off-peak windows with a 2× gap; moving batch work off-peak plus using cache is the fastest cost cut — estimate it at reflex-hub.com/en/cost.' },
    { dim: 'boundary', hard: false, q: 'Which of these is least reliable for a 2026 large model?',
      options: ['Translating a paragraph of Chinese into English', 'Writing a polite complaint email', 'Multi-digit multiplication and division with a guaranteed zero error rate', 'Summarizing the central idea of a paper'], answer: 2,
      explain: 'Language is its strength; pure arithmetic can produce plausible-looking wrong answers — use a calculator or code for that, and let AI call the tools.' },
    { dim: 'boundary', hard: true, q: 'True or false: the more reference material you give AI, the more accurate its answer necessarily becomes.',
      options: ['True: feed it enough and the answer is naturally right', 'False: too much material drowns the point'], answer: 1,
      explain: 'Overstuffing buries the key points — models attend least to the middle of long context ("lost in the middle"), and irrelevant material skews the answer; precise beats plentiful.' },
    { dim: 'industry', hard: false, q: 'Which Chinese large model, among the highest daily token volumes in 2026, is also deeply integrated into car cockpits?',
      options: ['ERNIE Bot (Baidu)', 'Doubao (ByteDance)', 'Siri (Apple)', 'Tmall Genie'], answer: 1,
      explain: 'Doubao surpassed 180 trillion daily tokens by June, and on Sep 17 its cockpit assistant launched, running in 7+ million vehicles.' },
    { dim: 'industry', hard: true, q: 'In 2026, which best describes how Chinese AI companies source training/inference compute?',
      options: ['All NVIDIA, no alternative', 'Already 100% domestic chips', 'Mainly CPU training', 'A mix of NVIDIA and domestic chips (Ascend, Cambricon, etc.), with the domestic share rising'], answer: 3,
      explain: 'Under export controls, "mixed + self-developed" is the norm — Ascend 960 is official and ByteDance and others push self-designed chips, but the NVIDIA installed base is still the mainstay; "all on one side" is never the full story.' },
    { dim: 'practice', hard: false, q: 'To get AI to draft your weekly report, which approach yields the most usable output?',
      options: ['Just say "write my weekly report"', 'List the 3 things you did as raw facts and attach your company\'s report format for it to organize', 'Let it imagine what you did this week', 'Run 5 AIs in parallel and vote'], answer: 1,
      explain: 'AI has writing skill but not your facts — you supply the facts and the format, it supplies the structure. A one-line handoff question only earns correct nonsense.' },
    { dim: 'practice', hard: true, q: 'For "the latest" information (today\'s news, current prices), the most reliable approach is?',
      options: ['Ask directly — it knows everything', 'A pricier model will definitely know', 'Use a web-search / RAG mode and ask for sources', 'Repeat the question 10 times for weight'], answer: 2,
      explain: 'Model knowledge has a training cutoff; "new" information must come from retrieval. Treat an unsourced "latest" answer as fiction by default.' },
    { dim: 'safety', hard: false, q: 'You get a voice call from your "daughter" asking to borrow money for an emergency, and the voice sounds exactly right. What is the first step?',
      options: ['Wire the money first — family matters', 'Chat about family trivia to confirm on the call', 'Forward the recording to friends for help', 'Hang up, call back on the number you have saved or verify via video / a shared codeword'], answer: 3,
      explain: 'AI voice cloning works from 3 seconds of sample — "sounds like her" is no longer proof of identity; hanging up and calling back on a number you saved is the only reliable verification.' },
    { dim: 'safety', hard: true, q: 'What is the biggest risk of pasting your company\'s unreleased contract into a public AI assistant?',
      options: ['Slow answers', 'Sensitive information may be retained or used for training, causing a leak', 'AI will sign contracts for the company', 'No risk — it\'s all encrypted'], answer: 1,
      explain: 'Public AI services have widely differing data policies; pasting unredacted contract or customer data may take it out of your control. Use private deployment or no-retention contracted services for sensitive work, or redact first.' }
  ]
};

/* 模型名称的英文展示名（事实数据 name 保持原文；仅名称含中文的型号在此登记，英文品牌惯例写法） */
/** @type {Record<string, string>} */
export const EN_MODEL_NAME = {
  'hunyuan-turbos-vision': 'Hunyuan TurboS Vision',
  'mimo-v25-pro': 'Xiaomi MiMo V2.5 Pro'
};

/* 价格来源链接的英文展示名（按 sourceUrl 唯一确定；事实数据中的 sourceName 仍为中文，英文页经此字典呈现） */
/** @type {Record<string, string>} */
export const EN_SOURCE = {
  'https://cloud.tencent.com/document/product/1823/130055': 'Tencent Cloud TokenHub pricing',
  'https://help.aliyun.com/zh/model-studio/glm-5-3-by-zhipu': 'Alibaba Cloud Model Studio — GLM-5.3 model page',
  'https://help.aliyun.com/zh/model-studio/glm-5-3-flash-by-zhipu': 'Alibaba Cloud Model Studio — GLM-5.3-Flash model page',
  'https://help.aliyun.com/zh/model-studio/kimi-k3-by-moonshot': 'Alibaba Cloud Model Studio — Kimi K3 model page',
  'https://help.aliyun.com/zh/model-studio/models': 'Alibaba Cloud Model Studio pricing',
  'https://help.aliyun.com/zh/model-studio/qwen3-8-flash': 'Alibaba Cloud Model Studio — Qwen3.8-Flash model page',
  'https://cloud.tencent.com/document/product/1729/97731': 'Tencent Cloud Hunyuan billing',
  'https://help.aliyun.com/zh/model-studio/billing-for-model-studio': 'Alibaba Cloud Model Studio billing',
  'https://help.aliyun.com/zh/model-studio/step-3-7-flash': 'Alibaba Cloud Model Studio — Step 3.7 Flash model page',
  'https://platform.openai.com/docs/pricing': 'OpenAI API pricing',
  'https://docs.anthropic.com/en/docs/about-claude/pricing': 'Anthropic official pricing',
  'https://ai.google.dev/gemini-api/docs/pricing': 'Google AI pricing'
};

/** 字典覆盖校验：事实数据里的每个枚举值都必须有英文翻译，缺失即构建失败 */
export function assertEnCoverage(models) {
  const missing = [];
  for (const m of models) {
    if (!EN_VENDOR[m.vendor]) missing.push(`vendor: ${m.vendor}`);
    if (!EN_SOURCE[m.sourceUrl]) missing.push(`source: ${m.sourceUrl} (${m.sourceName})`);
    for (const x of m.modalities || []) if (!EN_MODALITY[x]) missing.push(`modality: ${x}`);
    for (const x of m.features || []) if (!EN_FEATURE[x]) missing.push(`feature: ${x}`);
    for (const t of m.priceTiers || []) {
      const translated = enTierDesc(t.desc || '');
      if (/[一-鿿]/.test(translated)) missing.push(`tierDesc: ${t.desc}`);
    }
  }
  if (missing.length) throw new Error('英文字典覆盖缺失（请先补 i18n.mjs 翻译再构建）：\n  - ' + missing.join('\n  - '));
}
