export type BlogPostingSchema = {
  '@context': string;
  '@type': string;
  headline: string;
  description: string;
  datePublished: string;
  articleBody: string;
  image: string | string[];
  author: {
    '@type': string;
    name: string;
    url?: string;
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

export type HowToSchema = {
  '@context': string;
  '@type': string;
  name: string;
  description: string;
  totalTime: string;
  estimatedCost: {
    '@type': string;
    value: string;
    currency: string;
  };
  step: Array<{
    '@type': string;
    name: string;
    text: string;
  }>;
  tool: Array<{
    '@type': string;
    name: string;
  }>;
  supply: Array<{
    '@type': string;
    name: string;
  }>;
};

export type BlogPost = {
  slug: string;
  title: string;
  excerpt: string;
  publishedAt: string;
  heroImage: string;
  heroImageAlt: string;
  schema?: BlogPostingSchema;
  howToSchema?: HowToSchema;
};

export const blogPosts: BlogPost[] = [
  {
    slug: 'why-everyone-is-talking-about-lanceros',
    title: 'Why Everyone Is Talking About Lanceros (And You Should Too)',
    excerpt:
      "Discover why the Lancero vitola is the connoisseur's choice for concentrated flavor and how the Cavaro app helps you track these unique cigars.",
    publishedAt: '2026-07-10',
    heroImage: 'https://cdn.marblism.com/PR8j983N5ek.webp',
    heroImageAlt:
      'A minimalist vector illustration of a long, slender lancero cigar with a single trail of smoke rising from the ash.',
    schema: {
      '@context': 'https://schema.org',
      '@type': 'BlogPosting',
      headline: 'Why Everyone Is Talking About Lanceros (And You Should Too)',
      description:
        "Discover why the Lancero vitola is the connoisseur's choice for concentrated flavor and how the Cavaro app helps you track these unique cigars.",
      datePublished: '2026-07-10',
      articleBody:
        "You've likely seen them in the corner of your local humidor... The Lancero—a traditional Cuban vitola... understanding the Lancero isn't just about trying a new size; it's about unlocking a level of flavor precision... Use Cavaro to track your journey through this challenging but rewarding vitola...",
      image: 'https://cdn.marblism.com/PR8j983N5ek.webp',
      author: {
        '@type': 'Organization',
        name: 'Cavaro',
        url: 'https://cavaroapp.com',
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
  {
    slug: 'cigar-101-flavor-profiles',
    title: "Cigar 101: A Beginner's Guide to Mastering Flavor Profiles",
    excerpt:
      "Learn how taste and aroma combine to create a cigar's flavor profile, explore core flavor families, and use the rule of thirds to track your session.",
    publishedAt: '2026-07-07',
    heroImage: 'https://cdn.marblism.com/zHXmCctzUBk.webp',
    heroImageAlt:
      'Minimalist vector of a cigar with smoke positioned over the ash area on an ebony background',
    schema: {
      '@context': 'https://schema.org',
      '@type': 'BlogPosting',
      headline: "Cigar 101: A Beginner's Guide to Mastering Flavor Profiles",
      description:
        "A beginner's guide to understanding the taste and aroma of premium cigars, including flavor families and the three thirds of a smoke.",
      datePublished: '2026-07-07',
      articleBody:
        'Introduction to tasting cigars beyond smoking. Taste vs. aroma and how the palate develops. Core flavor families: Earthy/Woody, Spicy, Sweet, and Nutty. The rule of thirds across first, second, and final thirds. The retrohale technique for unlocking aroma. Mapping flavor with a flavor wheel. Using Cavaro to log sessions and track pairings. Conclusion and call to action.',
      image: [
        'https://cdn.marblism.com/zHXmCctzUBk.webp',
        'https://cdn.marblism.com/Xxy74RkRUdv.webp',
        'https://cdn.marblism.com/c2yDY435D2R.webp',
        'https://cdn.marblism.com/62VwShcWO2T.webp',
        'https://cdn.marblism.com/uXJK_SuXw5f.png',
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
    howToSchema: {
      '@context': 'https://schema.org',
      '@type': 'HowTo',
      name: 'How to Identify Cigar Flavor Profiles',
      description:
        "A beginner's guide to understanding the taste and aroma of premium cigars, including flavor families and the three thirds of a smoke.",
      totalTime: 'PT45M',
      estimatedCost: {
        '@type': 'MonetaryAmount',
        value: '10-30',
        currency: 'USD',
      },
      step: [
        {
          '@type': 'HowToStep',
          name: 'Understand Taste vs. Aroma',
          text: 'Recognize that the tongue only detects basic tastes; complex flavors like chocolate or cedar are detected through aroma in the nasal passages.',
        },
        {
          '@type': 'HowToStep',
          name: 'Identify Flavor Families',
          text: 'Categorize flavors into broad groups: Earthy/Woody, Spicy, Sweet, and Nutty.',
        },
        {
          '@type': 'HowToStep',
          name: 'Smoke in Thirds',
          text: 'Observe how the flavor changes from the first third (delicate) to the second third (balanced) and the final third (intense).',
        },
        {
          '@type': 'HowToStep',
          name: 'Perform a Retrohale',
          text: 'Exhale a small portion of the smoke through your nose to activate the olfactory receptors and detect subtle notes.',
        },
        {
          '@type': 'HowToStep',
          name: 'Log Your Session',
          text: 'Use an app like Cavaro to record tasting notes, strength profiles, and pairings for future reference.',
        },
      ],
      tool: [
        {
          '@type': 'HowToTool',
          name: 'Cavaro App',
        },
      ],
      supply: [
        {
          '@type': 'HowToSupply',
          name: 'Premium Cigar',
        },
        {
          '@type': 'HowToSupply',
          name: 'Cigar Cutter',
        },
        {
          '@type': 'HowToSupply',
          name: 'Lighter or Matches',
        },
      ],
    },
  },
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
