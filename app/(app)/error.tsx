"use client";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="card mx-auto max-w-lg p-6 text-center">
      <h1 className="mb-2 text-lg font-semibold">Something went wrong</h1>
      <p className="mb-4 text-sm text-muted">{error.digest ? `Reference: ${error.digest}` : error.message}</p>
      <button className="btn-primary" onClick={reset}>Try again</button>
    </div>
  );
}
