import { fetchWithRetry } from './http.js';
import { absoluteSpringUrl } from './url.js';

export const SPRING_GUIDES_DATA_URL = 'https://spring.io/page-data/guides/page-data.json';

export interface SpringGuideEntry {
  type: 'spring-guide';
  title: string;
  description: string;
  category: string;
  url: string;
}

/**
 * Lists the spring.io guides, optionally filtered on category (case-insensitive substring).
 * The /guides page is rendered client-side (Gatsby): its HTML holds no guide links, the list
 * lives in the page-data JSON that the page itself loads. Entries without title or path are
 * skipped; an unexpected payload throws (callers must not cache it).
 */
export async function fetchSpringGuidesList(category?: string): Promise<SpringGuideEntry[]> {
  const response = await fetchWithRetry(SPRING_GUIDES_DATA_URL);

  if (!response.ok) {
    throw new Error('Unable to access Spring guides page');
  }

  let nodes: unknown;
  try {
    nodes = JSON.parse(await response.text())?.result?.data?.guides?.nodes;
  } catch {
    nodes = undefined;
  }
  if (!Array.isArray(nodes)) {
    throw new Error('Unexpected format of the Spring guides data (no guides list found)');
  }

  const guides: SpringGuideEntry[] = [];
  for (const node of nodes as any[]) {
    const title = typeof node?.title === 'string' ? node.title.trim() : '';
    const url = absoluteSpringUrl(typeof node?.path === 'string' ? node.path : undefined);
    if (!title || !url) continue;

    const categories: string[] = Array.isArray(node.category) ? node.category.map(String) : [];
    const guideCategory = categories.join(', ');
    if (category && !guideCategory.toLowerCase().includes(category.toLowerCase())) continue;

    guides.push({
      type: 'spring-guide',
      title,
      description: (typeof node.description === 'string' && node.description.trim()) || 'Spring guide',
      category: guideCategory || 'General',
      url,
    });
  }
  return guides;
}
