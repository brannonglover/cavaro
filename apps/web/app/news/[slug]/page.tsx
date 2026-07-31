import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { SiteFooter } from '../../blog/components/SiteFooter';
import { newsContent } from '../post-content';
import { getNewsPost, newsPosts } from '../posts';

type NewsPostPageProps = {
  params: Promise<{ slug: string }>;
};

function formatDate(dateString: string) {
  return new Date(`${dateString}T12:00:00`).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

export async function generateStaticParams() {
  return newsPosts.map((post) => ({ slug: post.slug }));
}

export async function generateMetadata({ params }: NewsPostPageProps): Promise<Metadata> {
  const { slug } = await params;
  const post = getNewsPost(slug);

  if (!post) {
    return {
      title: 'Post Not Found — Cavaro',
    };
  }

  return {
    title: `${post.title} — Cavaro News`,
    description: post.excerpt,
    openGraph: {
      title: post.title,
      description: post.excerpt,
      ...(post.heroImage
        ? { images: [{ url: post.heroImage, alt: post.heroImageAlt ?? post.title }] }
        : {}),
    },
  };
}

export default async function NewsPostPage({ params }: NewsPostPageProps) {
  const { slug } = await params;
  const post = getNewsPost(slug);
  const Content = newsContent[slug];

  if (!post || !Content) {
    notFound();
  }

  return (
    <main className="min-h-screen">
      <section className="relative overflow-hidden px-6 pt-10 pb-8 sm:pt-14">
        <div className="absolute inset-0 bg-gradient-to-b from-humidor-primary/5 to-transparent" />
        <div className="relative mx-auto max-w-3xl">
          <Link
            href="/news"
            className="text-sm font-medium text-humidor-primary transition-colors hover:text-humidor-primary-light"
          >
            ← Back to News
          </Link>
          <time
            dateTime={post.publishedAt}
            className="mt-6 block text-sm font-medium text-humidor-primary"
          >
            {formatDate(post.publishedAt)}
          </time>
          <h1 className="mt-3 font-sans text-3xl font-semibold leading-tight text-humidor-cream sm:text-4xl">
            {post.title}
          </h1>
        </div>
      </section>

      {post.heroImage && (
        <section className="px-6 pb-8">
          <div className="mx-auto max-w-3xl">
            <img
              src={post.heroImage}
              alt={post.heroImageAlt ?? ''}
              className="w-full rounded-xl border border-humidor-border"
            />
          </div>
        </section>
      )}

      <section className="px-6 pb-24">
        <Content />
      </section>

      <SiteFooter />
    </main>
  );
}
