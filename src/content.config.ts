/**
 * Content Collections：结构化内容的唯一加载入口。
 * 直接读取 public/assets/data/ 下的既有 JSON（文件同时作为公开 JSON 端点，URL 不变），
 * 不复制数据文件；Schema 在构建期硬校验，任何字段形态漂移都会中断构建。
 */
import { defineCollection } from 'astro:content';
import { file } from 'astro/loaders';
import { modelSchema, toolSchema, promptSchema } from './lib/data/schemas';

export const collections = {
  models: defineCollection({
    loader: file('public/assets/data/models.json'),
    schema: modelSchema
  }),
  tools: defineCollection({
    loader: file('public/assets/data/tools.json'),
    schema: toolSchema
  }),
  prompts: defineCollection({
    loader: file('public/assets/data/prompts.json'),
    schema: promptSchema
  })
};
