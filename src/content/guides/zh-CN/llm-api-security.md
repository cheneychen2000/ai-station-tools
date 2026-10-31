---
title: "LLM API 密钥与访问安全实践"
description: "从密钥存放、调用链鉴权到日志与配额四条线，梳理接入大模型 API 时最常见的安全风险与可落地的防护措施。"
publishedAt: "2026-10-31"
updatedAt: "2026-10-31"
category: "tutorial"
tags:
  - LLM
  - API 安全
  - 密钥管理
draft: true
indexable: true
translationKey: null
author: "Reflex Hub 编辑部"
sources:
  - title: "OWASP Secrets Management Cheat Sheet"
    url: "https://cheatsheetseries.owasp.org/cheatsheets/Secrets_Management_Cheat_Sheet.html"
    accessedAt: "2026-10-31"
  - title: "The Twelve-Factor App · III. Config"
    url: "https://12factor.net/config"
    accessedAt: "2026-10-31"
---

调用大模型 API 的安全问题，绝大多数不是模型本身被攻破，而是**密钥与调用链**的管理失当：密钥进了前端包、进了 Git 历史、进了日志，或者被放在没有额度上限的中间层后面。这篇指南按"密钥 → 调用链 → 日志 → 配额"四条线给出可落地的做法。

## 一、密钥只应存在于服务端运行环境

### 不要把密钥下发到浏览器

任何写进前端代码、静态资源或公开仓库的 Key，都应视为已泄露。浏览器端只允许持有**短期、限权、可撤销**的凭证（例如你自己签发的会话令牌），由服务端代持模型厂商的 Key。

### 用环境变量而不是代码常量

十二要素应用把配置从代码中剥离，密钥属于配置。最小做法是环境变量 + 部署平台注入，且不同环境使用不同 Key：

```bash
# .env（不提交到仓库，且加入 .gitignore）
LLM_API_KEY=sk-xxxx
LLM_API_BASE=https://api.example.com/v1

# 启动时注入，代码里只读 process.env
node server.mjs
```

### 泄露后的处置顺序

1. 立即在厂商控制台**吊销**该 Key（不要只删代码）；
2. 轮换新 Key 并重新部署；
3. 检查用量与账单异常；
4. 清理 Git 历史中的残留（仅删除文件不改变历史提交内容）。

## 二、调用链鉴权：让每一次请求都可归因

| 风险 | 典型症状 | 对应措施 |
|---|---|---|
| 密钥被打包进前端 | 抓包即可见 `Authorization` 头 | 服务端代持，前端只拿会话令牌 |
| 内部服务裸调 | 任何能访问内网的服务都能消耗额度 | 服务间鉴权（mTLS / 签名）+ 调用方白名单 |
| 越权使用他人额度 | 同一令牌被多人共享 | 每用户独立令牌 + 服务端绑定用户身份 |
| 无上限消耗 | 一夜之间账单暴涨 | 按用户/按接口的配额与速率限制 |

## 三、日志：既要可排障，又不能留密钥

- 请求日志默认**脱敏**：`Authorization`、`api-key`、`cookie` 等头部不入日志；
- 记录调用元数据（用户、模型、输入输出 Token 数、耗时、状态码），不记录完整 Prompt 与响应正文；
- 日志落到第三方平台前再做一次过滤，避免"本地脱敏、远端泄露"。

### 一个最小的脱敏函数

```ts
const SENSITIVE = ['authorization', 'api-key', 'cookie', 'x-api-key'];

export function redactHeaders(headers: Record<string, string>): Record<string, string> {
  return Object.fromEntries(
    Object.entries(headers).map(([k, v]) => [k, SENSITIVE.includes(k.toLowerCase()) ? '[redacted]' : v])
  );
}
```

## 四、配额与熔断：把损失控制在可预期范围

1. 每个用户每日 Token 上限（按输入/输出分别计数）；
2. 每个接口的速率限制（防脚本刷量）；
3. 成本异常告警（当日消耗超过近 7 日均值的 N 倍即告警）；
4. 上游失败时的熔断与降级，避免重试放大成本。

## 五、上线前自查清单

- [ ] 仓库与前端产物中检索不到 `sk-`、`api_key=` 等模式；
- [ ] 生产 Key 与测试 Key 分离，且都存在于密钥管理系统或平台环境变量；
- [ ] 日志样本中确认无明文凭证；
- [ ] 配额与告警已配置并有值班接收人；
- [ ] 泄露应急预案（吊销 → 轮换 → 排查 → 清理）有明确责任人。

> 本页为内容体系示例文章（草稿），用于演示 Frontmatter、目录、表格、代码块与参考来源的写法；发布前请替换为经过核实的内容。
