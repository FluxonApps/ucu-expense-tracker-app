import Image from "next/image";
import Link from "next/link";

function MoneyBagMark() {
  return (
    <svg
      aria-hidden="true"
      className="h-28 w-28 opacity-90 sm:h-36 sm:w-36 text-emerald-400"
      fill="none"
      viewBox="0 0 128 128"
    >
      <path d="M43 23c4 9 12 14 21 14s17-5 21-14" stroke="currentColor" strokeLinecap="round" strokeWidth="8" />
      <path d="M48 40h32" stroke="currentColor" strokeLinecap="round" strokeWidth="8" />
      <path
        d="M46 41c-10 10-14 22-14 37 0 24 12 34 32 34s32-10 32-34c0-15-4-27-14-37"
        stroke="currentColor"
        strokeLinejoin="round"
        strokeWidth="8"
      />
      <text
        x="64"
        y="94"
        fill="currentColor"
        fontFamily="Arial, sans-serif"
        fontSize="52"
        fontWeight="700"
        textAnchor="middle"
      >
        $
      </text>
    </svg>
  );
}

const testimonials = [
  {
    name: "Sofia K.",
    review: "Spendly made it easy to see where my money goes without making budgeting feel like work.",
    color: "text-emerald-400",
  },
  {
    name: "Andrii M.",
    review: "I finally keep all of my cards and currencies in one clear place. Simple and genuinely useful.",
    color: "text-rose-400",
  },
  {
    name: "Olena P.",
    review: "The dashboard gives me the full picture in seconds. It is the first tracker I actually use daily.",
    color: "text-emerald-400",
  },
];

function LoginButton({ className = "" }: { className?: string }) {
  return (
    <Link
      href="/login"
      className={`inline-flex items-center justify-center rounded-full border-2 border-emerald-500 bg-white px-8 py-3.5 text-lg font-bold text-black shadow-[0_8px_24px_rgba(16,185,129,0.2)] transition-all hover:scale-[1.03] hover:bg-neutral-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2 focus-visible:ring-offset-black active:scale-[0.98] ${className}`}
    >
      Log in / Sign up
    </Link>
  );
}

export default function Home() {
  return (
    <main className="landing-font min-h-screen overflow-x-hidden bg-black text-white flex flex-col items-center">
      <div className="mx-auto w-full max-w-7xl">
        <section className="grid w-full gap-8 px-6 pb-20 pt-12 sm:px-10 sm:pt-16 lg:grid-cols-[0.9fr_1.1fr] lg:gap-6 lg:px-14 lg:pb-28">
          <div className="flex flex-col">
            <h1 className="max-w-xl text-5xl font-normal leading-[1.05] tracking-tight sm:text-6xl lg:text-7xl">
              Handle numbers,
              <br />
              <span className="bg-gradient-to-r from-emerald-400 to-emerald-500 bg-clip-text text-transparent font-medium">
                love life
              </span>
            </h1>

            {/* Мокап 1: Накладаємо чисто зелений шар через mix-blend-color */}
            <div className="relative mx-auto mt-10 w-full max-w-[600px] overflow-hidden rounded-[36px] bg-neutral-900 p-1 border border-neutral-800 shadow-[0_20px_50px_rgba(0,0,0,0.5)] sm:mt-16 sm:rounded-[48px] sm:p-2 lg:mx-0">
              <div className="relative overflow-hidden rounded-[34px] bg-neutral-950 border border-emerald-500/20">
                <Image
                  src="/landing/transactions-preview.png"
                  alt="Spendly transactions screen"
                  width={820}
                  height={916}
                  sizes="(min-width: 1024px) 600px, 90vw"
                  className="block h-auto w-full rounded-[22px] object-cover object-top sm:rounded-[32px]"
                />
                {/* Зелений шар для заміни синього фону */}
                <div className="absolute inset-0 bg-emerald-500 mix-blend-hue pointer-events-none" />
              </div>
            </div>
          </div>

          <div className="flex min-w-0 flex-col justify-between gap-12 lg:pt-2">
            {/* Мокап 2: Накладаємо чисто червоний/рожевий шар */}
            <div className="rounded-[34px] bg-gradient-to-br from-neutral-800 to-neutral-900 p-1 border border-neutral-800 shadow-[0_20px_50px_rgba(0,0,0,0.5)] sm:rounded-[48px] sm:p-2">
              <div className="relative overflow-hidden rounded-[32px] bg-neutral-950 p-3 sm:rounded-[44px] sm:p-5 border border-rose-500/20">
                <Image
                  src="/landing/dashboard-preview.png"
                  alt="Spendly dashboard preview"
                  width={1388}
                  height={732}
                  sizes="(min-width: 1024px) 58vw, 100vw"
                  className="block h-auto w-full rounded-[20px] object-cover sm:rounded-[28px] border border-neutral-800"
                />
                {/* Червоний шар для заміни синього фону */}
                <div className="absolute inset-0 bg-rose-500 mix-blend-hue pointer-events-none" />
              </div>
            </div>

            <div className="flex flex-col items-start justify-between gap-8 px-1 sm:flex-row sm:items-end sm:px-5 lg:px-8">
              <div>
                <p className="text-4xl font-normal tracking-tight sm:text-5xl">
                  It&apos;s all about <span className="text-rose-500 font-medium">Spendly</span>
                </p>
                <div className="mt-7">
                  <LoginButton />
                </div>
              </div>
              <div className="mr-4 sm:mr-0">
                <MoneyBagMark />
              </div>
            </div>
          </div>
        </section>

        <section className="w-full px-6 pb-20 sm:px-10 lg:px-14 lg:pb-28" aria-labelledby="testimonials-title">
          <h2 id="testimonials-title" className="text-3xl font-normal tracking-tight sm:text-4xl">
            What people say about <span className="text-emerald-400 font-medium">Spendly</span>
          </h2>
          <div className="mt-8 grid gap-5 md:grid-cols-3">
            {testimonials.map((testimonial) => (
              <figure
                key={testimonial.name}
                className="flex min-h-52 flex-col justify-between rounded-[28px] border border-neutral-800 bg-neutral-900/80 p-7 shadow-[0_16px_34px_rgba(0,0,0,0.4)] backdrop-blur-sm transition-all hover:border-neutral-700"
              >
                <blockquote className="text-xl leading-relaxed text-neutral-200">
                  “{testimonial.review}”
                </blockquote>
                <figcaption className={`mt-7 text-lg font-bold ${testimonial.color}`}>
                  {testimonial.name}
                </figcaption>
              </figure>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
