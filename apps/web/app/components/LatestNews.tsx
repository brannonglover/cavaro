import Link from 'next/link';
import { getLatestNews } from '../news/posts';

function formatDate(dateString: string) {
  return new Date(`${dateString}T12:00:00`).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

export function LatestNews() {
  const posts = getLatestNews(3);

  if (posts.length === 0) {
    return null;
  }

  return (
    <section className="px-6 pb-16">
      <div className="mx-auto max-w-3xl">
        <div className="flex items-end justify-between gap-4">
          <h2 className="font-sans text-2xl font-semibold text-humidor-cream sm:text-3xl">
            Latest News
          </h2>
          <Link
            href="/news"
            className="shrink-0 text-sm font-medium text-humidor-primary transition-colors hover:text-humidor-primary-light"
          >
            View all →
          </Link>
        </div>

        <ul className="mt-8 divide-y divide-humidor-border border-y border-humidor-border">
          {posts.map((post) => (
            <li key={post.slug}>
              <Link
                href={`/news/${post.slug}`}
                className="group flex flex-col gap-1 py-5 transition-colors sm:flex-row sm:items-baseline sm:gap-6"
              >
                <time
                  dateTime={post.publishedAt}
                  className="shrink-0 text-sm font-medium text-humidor-primary sm:w-36"
                >
                  {formatDate(post.publishedAt)}
                </time>
                <div className="min-w-0 flex-1">
                  <h3 className="font-sans text-lg font-semibold text-humidor-cream transition-colors group-hover:text-humidor-primary">
                    {post.title}
                  </h3>
                  <p className="mt-1 text-sm leading-relaxed text-humidor-muted line-clamp-2">
                    {post.excerpt}
                  </p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
