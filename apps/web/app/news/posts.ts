export type NewsHeroLogo = {
  src: string;
  alt: string;
};

export type NewsPost = {
  slug: string;
  title: string;
  excerpt: string;
  publishedAt: string;
  heroImage?: string;
  heroImageAlt?: string;
  heroCollage?: NewsHeroLogo[];
};

/**
 * To add an announcement:
 * 1. Add an entry below (newest first)
 * 2. Create app/news/posts/<slug>.tsx with the body
 * 3. Register it in app/news/post-content.ts
 */
export const newsPosts: NewsPost[] = [
  {
    slug: 'eight-brands-join-cavaro',
    title: 'Eight Iconic Brands Join the Cavaro Catalog',
    excerpt:
      'Arturo Fuente, Padrón, Davidoff, My Father, Oliva, Perdomo, AJ Fernandez, and Plasencia — over 700 new cigars are live in Cavaro.',
    publishedAt: '2026-08-24',
    heroImage: '/news/eight-brands-collage.png',
    heroImageAlt:
      'Arturo Fuente, Padrón, Davidoff, My Father, Oliva, Perdomo, AJ Fernandez, and Plasencia logos',
    heroCollage: [
      { src: '/news/logos/arturo-fuente.png', alt: 'Arturo Fuente' },
      { src: '/news/logos/padron.png', alt: 'Padrón' },
      { src: '/news/logos/davidoff.svg', alt: 'Davidoff' },
      { src: '/news/logos/my-father.png', alt: 'My Father' },
      { src: '/news/logos/oliva.png', alt: 'Oliva' },
      { src: '/news/logos/perdomo.png', alt: 'Perdomo' },
      { src: '/news/logos/aj-fernandez.png', alt: 'AJ Fernandez' },
      { src: '/news/logos/plasencia.svg', alt: 'Plasencia' },
    ],
  },
  {
    slug: 'rocky-patel-now-in-cavaro',
    title: 'Rocky Patel Joins the Cavaro Catalog',
    excerpt:
      'One of premium cigar’s most recognized names is now easier to find, track, and journal — Rocky Patel is live in Cavaro.',
    publishedAt: '2026-08-07',
    heroImage: '/news/rocky-patel-logo.png',
    heroImageAlt: 'Rocky Patel logo',
  },
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
