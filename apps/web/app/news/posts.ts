export type NewsPost = {
  slug: string;
  title: string;
  excerpt: string;
  publishedAt: string;
  heroImage?: string;
  heroImageAlt?: string;
};

/**
 * To add an announcement:
 * 1. Add an entry below (newest first)
 * 2. Create app/news/posts/<slug>.tsx with the body
 * 3. Register it in app/news/post-content.ts
 */
export const newsPosts: NewsPost[] = [
  {
    slug: 'welcome-to-cavaro-news',
    title: 'Welcome to Cavaro News',
    excerpt:
      'Product updates, feature launches, and announcements from the Cavaro team — right here.',
    publishedAt: '2026-07-31',
  },
];

export function getNewsPost(slug: string): NewsPost | undefined {
  return newsPosts.find((post) => post.slug === slug);
}

export function getLatestNews(limit = 3): NewsPost[] {
  return [...newsPosts]
    .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt))
    .slice(0, limit);
}
