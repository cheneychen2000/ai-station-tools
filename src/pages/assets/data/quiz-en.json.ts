/** assets/data/quiz-en.json 静态端点：英文题库（i18n 字典 QUIZ_EN.bank 序列化，与中文题库同构）。 */
import type { APIRoute } from 'astro';
import { QUIZ_EN } from '../../../lib/i18n/dictionaries.mjs';

export const GET: APIRoute = () => {
  const body = JSON.stringify(QUIZ_EN.bank.map(({ dim, hard, q, options, answer, explain }) => ({ dim, hard, q, options, answer, explain })), null, 1) + '\n';
  return new Response(body, { headers: { 'Content-Type': 'application/json; charset=utf-8' } });
};
