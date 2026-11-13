"use client";

/** Route error boundary — a failed gallery query must not blank the whole site. */
export default function GalleryError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <section className="mx-auto w-full max-w-5xl px-4 py-12 sm:py-16">
      <h1 className="font-display text-3xl font-bold text-cocoa">Cake gallery</h1>
      <p role="alert" className="mt-4 text-ink-muted">
        We couldn&apos;t load the gallery right now. Please try again.
      </p>
      <button
        type="button"
        onClick={reset}
        className="mt-6 inline-flex min-h-12 items-center rounded-full bg-strawberry px-6 py-3 font-semibold text-white transition hover:bg-strawberry-deep"
      >
        Try again
      </button>
      {error.digest && <p className="mt-4 text-xs text-ink-muted">Ref: {error.digest}</p>}
    </section>
  );
}
