/** Skeleton shown while the gallery query streams in. */
export default function GalleryLoading() {
  return (
    <section className="mx-auto w-full max-w-5xl px-4 py-12 sm:py-16">
      <div className="h-9 w-56 animate-pulse rounded-lg bg-cocoa/10" aria-hidden />
      <div className="mt-4 h-5 w-80 max-w-full animate-pulse rounded bg-cocoa/10" aria-hidden />
      <div
        role="status"
        aria-label="Loading gallery"
        className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
      >
        {Array.from({ length: 6 }).map((_, index) => (
          <div
            key={index}
            className="h-64 animate-pulse rounded-2xl border border-cocoa/10 bg-vanilla/60"
            aria-hidden
          />
        ))}
        <span className="sr-only">Loading gallery…</span>
      </div>
    </section>
  );
}
