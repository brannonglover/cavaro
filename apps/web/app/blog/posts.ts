export type BlogPost = {
  slug: string;
  title: string;
  excerpt: string;
  publishedAt: string;
  heroImage: string;
  heroImageAlt: string;
};

export const blogPosts: BlogPost[] = [
  {
    slug: '7-mistakes-cigar-tasting-notes',
    title: "7 Mistakes You're Making With Your Cigar Tasting Notes (And How to Fix Them)",
    excerpt:
      'Refining your tasting notes is about becoming a better companion to your own palate. Here are seven common mistakes and the precise steps to fix them.',
    publishedAt: '2026-07-07',
    heroImage: 'https://cdn.marblism.com/KWKc4HP13vA.webp',
    heroImageAlt:
      'A sophisticated cigar lounge scene featuring a premium cigar on a crystal ashtray, set against an ebony background with gold accents.',
  },
];

export function getBlogPost(slug: string): BlogPost | undefined {
  return blogPosts.find((post) => post.slug === slug);
}
