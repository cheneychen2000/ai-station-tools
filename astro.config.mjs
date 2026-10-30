// @ts-check
import { defineConfig } from 'astro/config';
import postBuild from './src/integrations/post-build.mjs';

/**
 * Reflex Hub · Astro 静态站配置
 *
 * 迁移约束（见 Astro迁移提示词.md）：
 *  - 纯静态输出（output: 'static'），不引入 SSR / Cloudflare adapter；
 *  - trailingSlash: 'always' + build.format: 'directory'：保持现有目录式 URL（/models/glm-53/）不变；
 *  - compressHTML: false：不让构建器重排/压缩 HTML，正文与既有检查断言以接近原产物的形态输出；
 *  - site 固定 https://www.reflex-hub.com（canonical / hreflang / sitemap / JSON-LD 的绝对 URL 来源）；
 *  - outDir 默认 dist（Cloudflare Pages 直发目录）；本地双目录对拍时可临时用 ASTRO_OUT_DIR=dist-astro。
 */
export default defineConfig({
  site: 'https://www.reflex-hub.com',
  base: '/',
  output: 'static',
  trailingSlash: 'always',
  outDir: process.env.ASTRO_OUT_DIR || './dist',
  publicDir: './public',
  compressHTML: false,
  build: {
    format: 'directory',
    inlineStylesheets: 'never'
  },
  devToolbar: { enabled: false },
  integrations: [postBuild()]
});
