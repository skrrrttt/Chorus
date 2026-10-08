export default function NotFound() {
  return (
    <main className="mx-auto flex w-full max-w-[390px] flex-1 flex-col justify-center px-6 py-16">
      <p className="text-ink-muted text-[14px] tracking-[0.08em]">Chorus</p>
      <h1 className="mt-6 font-display text-[40px] leading-[1.08] text-ink">
        We couldn&rsquo;t find that one.
      </h1>
      <p className="mt-6 text-[17px] leading-relaxed text-ink-secondary">
        Check the link you were sent, or ask whoever shared it to send it again.
      </p>
    </main>
  );
}
