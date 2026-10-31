/**
 * 全站导航配置（唯一事实来源；纯数据模块，无 HTML 生成）。
 * 组件（components/common/SiteHeader/SiteFooter）与检查脚本（scripts/check-nav.mjs）都从这里读取：
 * 新增/改名/改序导航项只改本文件。
 */

/**
 * 主导航项（顺序即全站展示顺序；品牌链接承担"首页"入口）。
 * 中英两站都从这一份数组渲染：labelEn/pathEn 与 label/path 必须成对填写，
 * 少了任何一侧都会被 scripts/check-nav.mjs 的 N0 断言拦下。
 */
export const NAV_ITEMS = [
  { key: 'cost', label: '成本计算器', labelEn: 'Cost Calculator', path: 'cost/', pathEn: 'en/cost/' },
  { key: 'models', label: '模型库', labelEn: 'Model Library', path: 'models/', pathEn: 'en/models/' },
  { key: 'compare', label: '模型对比', labelEn: 'Model Comparison', path: 'compare/', pathEn: 'en/compare/' },
  { key: 'guides', label: '开发指南', labelEn: 'Developer Guide', path: 'guides/', pathEn: 'en/guides/' },
  { key: 'tools', label: 'AI 工具目录', labelEn: 'AI Tools Directory', path: 'tools/', pathEn: 'en/tools/' },
  { key: 'prompts', label: 'Prompt 资源', labelEn: 'Prompt Resources', path: 'prompts/', pathEn: 'en/prompts/' }
];

/** 页脚"核心工具"额外收录（不在主导航，避免过多项） */
export const FOOTER_EXTRA = [
  { key: 'quiz', label: 'AI 认知测试', path: 'quiz/' },
  { key: 'guides', label: '计算指南', path: 'guides/' }
];

/** 页脚"站点信息"信任页面 */
export const FOOTER_INFO = [
  { label: '关于本站', path: 'about/' },
  { label: '定价方法论', path: 'pricing-methodology/' },
  { label: '隐私政策', path: 'privacy/' },
  { label: '联盟推广披露', path: 'affiliate-disclosure/' },
  { label: '使用条款', path: 'terms/' }
];
