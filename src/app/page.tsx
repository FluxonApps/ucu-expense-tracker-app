import Image from "next/image";
import Link from "next/link";

const testimonials = [
  {
    name: "Sofia K.",
    review: "Spendly made it easy to see where my money goes without making budgeting feel like work.",
  },
  {
    name: "Andrii M.",
    review: "I finally keep all of my cards and currencies in one clear place. Simple and genuinely useful.",
  },
  {
    name: "Olena P.",
    review: "The dashboard gives me the full picture in seconds. It is the first tracker I actually use daily.",
  },
];

export default function Home() {
  return (
    <main className="min-h-screen bg-background text-foreground landing-font selection:bg-muted">
      <div className="mx-auto flex min-h-screen max-w-6xl flex-col justify-between px-4 py-8 sm:px-6 lg:px-8 space-y-16">

        {/* Header */}
        <header className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="relative flex h-9 w-9 items-center justify-center overflow-hidden rounded-lg bg-white shadow-sm">
              <Image
                src="/logo.png"
                alt="Spendly Logo"
                width={36}
                height={36}
                className="h-full w-full object-cover scale-[1.35]"
              />
            </div>
            <span className="text-2xl font-bold tracking-tight">Spendly</span>
          </div>
          <Link
            href="/login"
            className="inline-flex h-10 items-center justify-center rounded-lg bg-secondary px-5 text-sm font-medium text-secondary-foreground hover:bg-secondary/80 transition-colors"
          >
            Log in
          </Link>
        </header>

        {/* Hero Section */}
        <section className="flex flex-col items-center text-center space-y-7 pt-4">
          <h1 className="max-w-3xl text-4xl font-semibold tracking-tight sm:text-6xl sm:leading-[1.1]">
            Handle numbers, <br />
            <span className="text-white font-semibold">love life</span>
          </h1>
          <p className="max-w-xl text-muted-foreground text-base sm:text-lg">
            Track expenses, currencies, and budget goals in one clear place.
          </p>

          {/* Gradient Border Button with White Background */}
          <div className="pt-3">
            <div className="inline-block rounded-full p-[2px] bg-gradient-to-r from-sky-300 via-purple-300 to-pink-300 shadow-lg shadow-purple-500/10 transition-transform duration-200 hover:scale-105 active:scale-95">
              <Link
                href="/login"
                className="inline-flex h-14 items-center justify-center rounded-full bg-white px-10 text-xl font-bold text-zinc-950 transition-colors hover:bg-zinc-100"
              >
                Get started
              </Link>
            </div>
          </div>
        </section>

        {/* Product Previews Gallery */}
        <section className="grid gap-6 md:grid-cols-12 items-stretch">
          {/* Mobile App Preview Wrapper */}
          <div className="md:col-span-4 rounded-3xl border border-border/40 bg-zinc-900/60 p-4 sm:p-6 shadow-sm flex items-center justify-center overflow-hidden">
            <div className="relative w-full max-w-[280px] overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-b from-slate-800 to-zinc-900 p-2">
              <Image
                src="/landing/transactions-preview.png"
                alt="Spendly mobile view"
                width={820}
                height={916}
                className="h-auto w-full rounded-xl object-cover transition-transform duration-500 hover:scale-[1.02]"
                priority
              />
            </div>
          </div>

          {/* Desktop Dashboard Preview Wrapper */}
          <div className="md:col-span-8 rounded-3xl border border-border/40 bg-zinc-900/60 p-4 sm:p-6 shadow-sm flex items-center justify-center overflow-hidden">
            <div className="relative w-full overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-b from-slate-800 to-zinc-900 p-2">
              <Image
                src="/landing/dashboard-preview.png"
                alt="Spendly dashboard view"
                width={1388}
                height={732}
                className="h-auto w-full rounded-xl object-cover transition-transform duration-500 hover:scale-[1.02]"
                priority
              />
            </div>
          </div>
        </section>

        {/* Testimonials */}
        <section className="space-y-6">
          <h2 className="text-2xl font-semibold tracking-tight text-center sm:text-left">
            What people say about <span className="text-muted-foreground">Spendly</span>
          </h2>
          <div className="grid gap-4 md:grid-cols-3">
            {testimonials.map((item) => (
              <figure
                key={item.name}
                className="flex flex-col justify-between rounded-2xl border border-border/40 bg-card p-6 shadow-sm"
              >
                <blockquote className="text-sm leading-relaxed text-muted-foreground">
                  “{item.review}”
                </blockquote>
                <figcaption className="mt-6 text-xs font-semibold text-foreground">
                  {item.name}
                </figcaption>
              </figure>
            ))}
          </div>
        </section>

        {/* Footer */}
        <footer className="border-t border-border/40 pt-6 pb-4 flex flex-col sm:flex-row items-center justify-between text-xs text-muted-foreground gap-4">
          <p>© {new Date().getFullYear()} Spendly. All rights reserved.</p>
          <div className="flex items-center gap-4">
            <Link href="/login" className="hover:text-foreground transition-colors">
              Log in / Sign up
            </Link>
          </div>
        </footer>

      </div>
    </main>
  );
}
