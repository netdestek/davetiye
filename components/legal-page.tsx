import { ArrowLeft, Heart, Mail, ShieldCheck } from 'lucide-react';
import Link from 'next/link';
import type { ReactNode } from 'react';

type LegalSection = {
  title: string;
  content: ReactNode;
};

type LegalPageProps = {
  eyebrow: string;
  title: string;
  description: string;
  updatedAt: string;
  sections: LegalSection[];
};

export function LegalPage({
  eyebrow,
  title,
  description,
  updatedAt,
  sections,
}: LegalPageProps) {
  return (
    <main className="relative min-h-screen overflow-hidden bg-[#fbf7f2] px-5 py-8 text-foreground sm:px-8 sm:py-12">
      <div className="pointer-events-none absolute -left-32 -top-32 size-[420px] rounded-full bg-[#ead7d1]/60 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-32 -right-24 size-[360px] rounded-full bg-[#dce7df]/70 blur-3xl" />

      <div className="relative mx-auto w-full max-w-3xl">
        <header className="flex items-center justify-between gap-4">
          <Link
            href="/"
            className="inline-flex items-center gap-3 rounded-2xl focus-visible:outline-2 focus-visible:outline-offset-4"
            aria-label="Davetly ana sayfa"
          >
            <span className="liquid-icon liquid-icon--brand size-11 rounded-[15px]">
              <Heart className="size-5 fill-current" strokeWidth={1.8} />
            </span>
            <span className="font-heading text-2xl font-semibold tracking-[-0.035em]">
              davetly
            </span>
          </Link>
          <Link
            href="/giris"
            className="inline-flex min-h-11 items-center gap-2 rounded-full border border-[#e5d9d2] bg-white/80 px-4 text-sm font-semibold text-[#6f3a47] shadow-sm backdrop-blur transition-colors hover:bg-white focus-visible:outline-2 focus-visible:outline-offset-2"
          >
            <ArrowLeft className="size-4" /> Girişe dön
          </Link>
        </header>

        <article className="mt-10 rounded-[30px] border border-[#e8ddd7] bg-white/90 px-6 py-8 shadow-[0_24px_80px_rgba(76,49,40,.08)] backdrop-blur sm:px-10 sm:py-11">
          <div className="flex items-center gap-3">
            <span className="liquid-icon size-10 rounded-[14px]">
              <ShieldCheck className="size-[18px]" />
            </span>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-primary">
              {eyebrow}
            </p>
          </div>
          <h1 className="mt-5 font-heading text-[36px] font-semibold leading-tight tracking-[-0.04em] sm:text-[46px]">
            {title}
          </h1>
          <p className="mt-4 max-w-2xl text-[15px] leading-7 text-muted-foreground">
            {description}
          </p>
          <p className="mt-3 text-xs text-[#958984]">
            Son güncelleme: {updatedAt}
          </p>

          <div className="mt-9 space-y-8 border-t border-[#eee4df] pt-8">
            {sections.map((section) => (
              <section key={section.title}>
                <h2 className="font-heading text-2xl font-semibold tracking-[-0.025em]">
                  {section.title}
                </h2>
                <div className="mt-3 space-y-3 text-sm leading-7 text-[#655b57]">
                  {section.content}
                </div>
              </section>
            ))}
          </div>

          <div className="mt-10 flex items-start gap-3 rounded-2xl border border-[#e6ddd6] bg-[#faf5f1] p-4 text-sm text-[#655b57]">
            <Mail className="mt-1 size-4 shrink-0 text-primary" />
            <p>
              Sorularınız ve talepleriniz için{' '}
              <a
                className="font-semibold text-primary underline decoration-primary/30 underline-offset-4"
                href="mailto:netdestek@gmail.com"
              >
                netdestek@gmail.com
              </a>{' '}
              adresinden bize ulaşabilirsiniz.
            </p>
          </div>
        </article>

        <footer className="flex flex-wrap items-center justify-between gap-3 px-2 py-6 text-xs text-[#8f827c]">
          <p>© 2026 Davetly · netdestek.net</p>
          <nav
            className="flex items-center gap-4"
            aria-label="Yasal bağlantılar"
          >
            <Link className="hover:text-primary" href="/gizlilik">
              Gizlilik
            </Link>
            <Link className="hover:text-primary" href="/kosullar">
              Koşullar
            </Link>
          </nav>
        </footer>
      </div>
    </main>
  );
}
