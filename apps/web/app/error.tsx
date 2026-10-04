"use client";

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="error-page">
      <p className="eyebrow">Local corpus error</p>
      <h1>The study workspace could not be loaded.</h1>
      <p>Run the documented corpus import, then try again.</p>
      <button type="button" onClick={reset}>Try again</button>
    </main>
  );
}
