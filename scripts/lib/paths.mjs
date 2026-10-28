/** 公共路径与站点常量：所有脚本从本文件取仓库根目录，禁止硬编码本机绝对路径 */
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
export const DIST = join(ROOT, 'dist');
export const REPORTS = join(ROOT, 'reports');
export const SITE = 'https://www.reflex-hub.com';
export const BRAND = 'Reflex Hub';
