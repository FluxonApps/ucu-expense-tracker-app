import Image from "next/image";
import Link from "next/link";

function MoneyBagMark() {
  return (
    <svg
      aria-hidden="true"
      className="h-28 w-28 opacity-90 sm:h-36 sm:w-36"
      fill="none"
      viewBox="0 0 128 128"
    >
      <path
        d="M45 27c6 5 12 8 19 8s13-3 19-8"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="8"
      />
      <path
        d="M43 43c-7 7-11 17-11 30 0 27 12 38 32 38s32-11 32-38c0-13-4-23-11-30"
        stroke="currentColor"
        strokeLinejoin="round"
        strokeWidth="8"
      />
      <path
        d="M51 43h26"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="8"
      />
      <path
        d="M58 59c2-3 5-4 9-4 6 0 11 4 11 10 0 7-6 9-12 11-5 2-9 4-9 10 0 6 5 10 12 10 4 0 8-1 11-5M67 49v55"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="7"
      />
    </svg>
  );
}

function LoginButton({ className = "" }: { className?: string }) {
  return (
    <Link
      href="/login"
      className={`inline-flex items-center justify-center rounded-full border-2 border-[#2f82d5] bg-white px-8 py-3.5 text-lg font-bold text-[#071629] shadow-[0_8px_24px_rgba(255,255,255,0.15)] transition-transform hover:scale-[1.03] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[#071629] active:scale-[0.98] ${className}`}
    >
      Log in / Sign up
    </Link>
  );
}

export default function Home() {
  return (
    <main className="landing-font min-h-screen overflow-x-hidden bg-[#071629] text-white">
      <header className="mx-auto flex max-w-[1600px] items-center justify-between px-6 py-6 sm:px-10 lg:px-16">
        <span className="text-2xl font-bold tracking-tight">Spendly</span>
        <LoginButton className="hidden px-6 py-2.5 text-base sm:inline-flex" />
      </header>

      <section className="mx-auto grid max-w-[1600px] gap-10 px-6 pb-20 pt-5 sm:px-10 lg:grid-cols-[0.85fr_1.15fr] lg:gap-12 lg:px-16 lg:pb-28">
        <div className="flex flex-col">
          <h1 className="max-w-xl text-5xl font-normal leading-[1.05] tracking-tight sm:text-6xl lg:text-7xl">
            Handle numbers,
            <br />
            <span className="text-[#4d9ce8]">love life</span>
          </h1>

          <div className="relative mx-auto mt-10 w-full max-w-[475px] overflow-hidden rounded-[36px] bg-[#347fc3] p-4 shadow-[0_20px_50px_rgba(0,0,0,0.18)] sm:mt-16 sm:rounded-[48px] sm:p-7 lg:mx-0">
            <Image
              src="/landing/transactions-preview.png"
              alt="Spendly transactions screen"
              width={820}
              height={916}
              className="block h-auto w-full rounded-[22px] object-cover object-top sm:rounded-[32px]"
            />
          </div>
        </div>

        <div className="flex min-w-0 flex-col justify-between gap-12 lg:pt-2">
          <div className="rounded-[34px] bg-[#347fc3] p-4 sm:rounded-[48px] sm:p-7">
            <Image
              src="/landing/dashboard-preview.png"
              alt="Spendly dashboard preview"
              width={1388}
              height={732}
              className="block h-auto w-full rounded-[20px] object-cover sm:rounded-[28px]"
            />
          </div>

          <div className="flex flex-col items-start justify-between gap-8 px-1 sm:flex-row sm:items-end sm:px-5 lg:px-8">
            <div>
              <p className="text-4xl font-normal tracking-tight sm:text-5xl">
                It&apos;s all about <span className="text-[#4d9ce8]">Spendly</span>
              </p>
              <div className="mt-7">
                <LoginButton />
              </div>
            </div>
            <div className="mr-4 text-[#168be6] sm:mr-0">
              <MoneyBagMark />
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
