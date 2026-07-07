import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { BlogPostingJsonLd } from '../components/BlogPostingJsonLd';
import { SiteFooter } from '../components/SiteFooter';
import { postContent } from '../post-content';
import { blogPosts, getBlogPost } from '../posts';

type BlogPostPageProps = {
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
  return blogPosts.map((post) => ({ slug: post.slug }));
}

export async function generateMetadata({ params }: BlogPostPageProps): Promise<Metadata> {
  const { slug } = await params;
  const post = getBlogPost(slug);

  if (!post) {
    return {
      title: 'Post Not Found — Cavaro',
    };
  }

  return {
    title: `${post.title} — Cavaro Blog`,
    description: post.schema?.description ?? post.excerpt,
    openGraph: {
      title: post.title,
      description: post.schema?.description ?? post.excerpt,
      images: [{ url: post.heroImage, alt: post.heroImageAlt }],
    },
  };
}

export default async function BlogPostPage({ params }: BlogPostPageProps) {
  const { slug } = await params;
  const post = getBlogPost(slug);
  const Content = postContent[slug];

  if (!post || !Content) {
    notFound();
  }

  return (
    <main className="min-h-screen">
      {post.schema && <BlogPostingJsonLd schema={post.schema} />}
      <section className="relative overflow-hidden px-6 pt-10 pb-8 sm:pt-14">
        <div className="absolute inset-0 bg-gradient-to-b from-humidor-primary/5 to-transparent" />
        <div className="relative mx-auto max-w-3xl">
          <Link
            href="/blog"
            className="text-sm font-medium text-humidor-primary transition-colors hover:text-humidor-primary-light"
          >
            ← Back to Blog
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

      <section className="px-6 pb-24">
        <Content />
      </section>

      <SiteFooter />
    </main>
  );
}
