export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-[390px] flex-1 flex-col justify-center px-6 py-16">
      <p className="text-ink-muted text-[14px] tracking-[0.08em]">Chorus</p>
      <h1 className="mt-6 font-display text-[40px] leading-[1.08] text-ink">
        Everyone signs the card.
        <span className="block text-ink-secondary italic">This one, they hear.</span>
      </h1>
      <p className="mt-6 text-[17px] leading-relaxed text-ink-secondary">
        If someone sent you a link, open it from that message. It takes you
        straight to the right place.
      </p>
    </main>
  );
}
