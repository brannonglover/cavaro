export type BlogPostingSchema = {
  '@context': string;
  '@type': string;
  headline: string;
  description: string;
  datePublished: string;
  articleBody: string;
  image: string[];
  author: {
    '@type': string;
    name: string;
  };
  publisher: {
    '@type': string;
    name: string;
    logo: {
      '@type': string;
      url: string;
    };
  };
};

export type BlogPost = {
  slug: string;
  title: string;
  excerpt: string;
  publishedAt: string;
  heroImage: string;
  heroImageAlt: string;
  schema?: BlogPostingSchema;
};

export const blogPosts: BlogPost[] = [
  {
    slug: '7-mistakes-cigar-tasting-notes',
    title: "7 Mistakes You're Making With Your Cigar Tasting Notes (And How to Fix Them)",
    excerpt:
      'Learn the 7 most common mistakes cigar enthusiasts make when taking tasting notes and how to fix them using structured logging and professional techniques.',
    publishedAt: '2026-07-07',
    heroImage: 'https://cdn.marblism.com/KWKc4HP13vA.webp',
    heroImageAlt:
      'A sophisticated cigar lounge scene featuring a premium cigar on a crystal ashtray, set against an ebony background with gold accents.',
    schema: {
      '@context': 'https://schema.org',
      '@type': 'BlogPosting',
      headline: "7 Mistakes You're Making With Your Cigar Tasting Notes (And How to Fix Them)",
      description:
        'Learn the 7 most common mistakes cigar enthusiasts make when taking tasting notes and how to fix them using structured logging and professional techniques.',
      datePublished: '2026-07-07',
      articleBody:
        'Introduction to the ritual of cigar smoking and the importance of tasting notes. 1. Chasing the Professional Palate: Trust your own tongue. 2. Treating the Smoke as a Static Event: Use the rule of thirds. 3. Confusing Strength with Body: Technical definitions. 4. Smoking at Racing Speed: The 60-second rule. 5. Neglecting the Retrohale: Unlocking aroma. 6. Using Vague Descriptors: Use a flavor hierarchy. 7. Forgetting the Pairing: AI-powered pairing recommendations. Conclusion and call to action for the Cavaro app.',
      image: [
        'https://cdn.marblism.com/KWKc4HP13vA.webp',
        'https://cdn.marblism.com/YFTUzADVjob.webp',
        'https://cdn.marblism.com/O6Y0Cp-0dzA.webp',
        'https://cdn.marblism.com/HImoIMMQ3dt.webp',
      ],
      author: {
        '@type': 'Organization',
        name: 'Cavaro',
      },
      publisher: {
        '@type': 'Organization',
        name: 'Cavaro',
        logo: {
          '@type': 'ImageObject',
          url: 'https://cavaroapp.com/logo.png',
        },
      },
    },
  },
];

export function getBlogPost(slug: string): BlogPost | undefined {
  return blogPosts.find((post) => post.slug === slug);
}
