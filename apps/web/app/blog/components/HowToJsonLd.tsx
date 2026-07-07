import type { HowToSchema } from '../posts';

export function HowToJsonLd({ schema }: { schema: HowToSchema }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
}
