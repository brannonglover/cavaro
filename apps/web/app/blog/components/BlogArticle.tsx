import type { ReactNode } from 'react';

export function BlogArticle({ children }: { children: ReactNode }) {
  return (
    <article
      className={[
        'mx-auto max-w-3xl',
        'text-lg leading-relaxed text-humidor-muted',
        '[&_h1]:mb-6 [&_h1]:font-sans [&_h1]:text-3xl [&_h1]:font-semibold [&_h1]:leading-tight [&_h1]:text-humidor-cream sm:[&_h1]:text-4xl',
        '[&_h2]:mb-4 [&_h2]:mt-10 [&_h2]:font-sans [&_h2]:text-2xl [&_h2]:font-semibold [&_h2]:text-humidor-cream',
        '[&_h3]:mb-3 [&_h3]:mt-8 [&_h3]:font-sans [&_h3]:text-xl [&_h3]:font-semibold [&_h3]:text-humidor-cream',
        '[&_ol]:mb-4 [&_ol]:list-decimal [&_ol]:space-y-2 [&_ol]:pl-6',
        '[&_p]:mb-4',
        '[&_strong]:font-semibold [&_strong]:text-humidor-cream',
        '[&_a]:text-humidor-primary [&_a]:underline [&_a]:underline-offset-2 hover:[&_a]:text-humidor-primary-light',
        '[&_ul]:mb-4 [&_ul]:list-disc [&_ul]:space-y-2 [&_ul]:pl-6',
        '[&_li]:pl-1',
        '[&_hr]:my-10 [&_hr]:border-humidor-border',
        '[&_img]:my-8 [&_img]:w-full [&_img]:rounded-xl [&_img]:border [&_img]:border-humidor-border',
      ].join(' ')}
    >
      {children}
    </article>
  );
}
