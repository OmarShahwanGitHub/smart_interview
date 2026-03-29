import Link from "next/link";
import { ArrowRight, ShieldCheck, Sparkles } from "lucide-react";
import { PageTransition } from "@/components/page-transition";
import { ThemeToggle } from "@/components/theme-toggle";

export const dynamic = "force-dynamic";

const highlights = [
  "Resume-based technical and behavioral prompts",
  "Voice coaching with multilingual support",
  "ASL-friendly practice flows for accessibility",
];

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="relative min-h-screen overflow-hidden">
      <div className="relative mx-auto flex min-h-screen w-full max-w-7xl flex-col px-6 py-6 sm:px-8 lg:px-10">
        <header className="flex items-center justify-between border-b border-border/70 pb-6">
          <Link href="/" className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-border/70 bg-card/80">
              <Sparkles className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-lg font-semibold tracking-tight text-foreground">
                smart interview
              </p>
              <p className="text-sm text-muted-foreground">AI prep that feels like the real thing.</p>
            </div>
          </Link>

          <div className="flex items-center gap-3">
            <ThemeToggle />
            <Link
              href="/"
              className="inline-flex items-center gap-2 text-sm text-muted-foreground transition hover:text-foreground"
            >
              Back to home <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </header>

        <PageTransition className="grid flex-1 items-center gap-10 py-10 lg:grid-cols-[minmax(0,1fr)_440px] lg:gap-16">
          <section className="max-w-2xl space-y-8">
            <div className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-card/70 px-4 py-2 text-sm text-foreground/80">
              <ShieldCheck className="h-4 w-4 text-primary" />
              Secure sign in for your private practice history
            </div>

            <div className="space-y-4">
              <h1 className="max-w-xl text-4xl font-semibold tracking-[-0.04em] text-foreground sm:text-5xl lg:text-6xl">
                Step into the same interface you&apos;ll use to train, screen, and rehearse.
              </h1>
              <p className="max-w-xl text-lg leading-8 text-muted-foreground">
                Every flow shares the same cleaner studio layout, with a quick theme
                switch and clearer progression from sign in to mock session.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              {highlights.map((item) => (
                <div
                  key={item}
                  className="panel-soft rounded-[24px] p-4 text-sm leading-6 text-muted-foreground"
                >
                  {item}
                </div>
              ))}
            </div>
          </section>

          <section>{children}</section>
        </PageTransition>
      </div>
    </div>
  );
}
