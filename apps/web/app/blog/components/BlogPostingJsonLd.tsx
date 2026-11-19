import type { BlogPostingSchema } from '../posts';

export function BlogPostingJsonLd({ schema }: { schema: BlogPostingSchema }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
}
