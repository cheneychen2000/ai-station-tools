/** BreadcrumbList 结构化数据构建（全站唯一出口）。 */
import { SITE } from '../config';

export interface BreadcrumbItem { name: string; path: string }

export function breadcrumb(items: BreadcrumbItem[]): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((it, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: it.name,
      item: SITE + it.path
    }))
  };
}
