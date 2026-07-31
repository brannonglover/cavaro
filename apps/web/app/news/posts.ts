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
    slug: 'la-flor-dominicana-now-in-cavaro',
    title: 'La Flor Dominicana Joins the Cavaro Catalog',
    excerpt:
      'Bold blends collectors love are now easier to find, track, and journal — LFD cigars are live in Cavaro.',
    publishedAt: '2026-07-31',
    heroImage: '/news/lfd-logo.png',
    heroImageAlt: 'La Flor Dominicana logo',
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
