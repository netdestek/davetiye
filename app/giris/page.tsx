import { env } from 'cloudflare:workers';
import { CheckCircle2, Heart, ShieldCheck, Sparkles } from 'lucide-react';
import Link from 'next/link';
import { redirect } from 'next/navigation';

import { GoogleSignInButton } from '@/components/google-sign-in-button';
import { getCurrentUser } from '@/lib/user-auth';

export const dynamic = 'force-dynamic';

type LoginPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;
  const returnTo = params?.returnTo === '/olustur' ? '/olustur' : '/hesap';
  const user = await getCurrentUser();
  if (user) redirect(returnTo);

  const runtimeEnv = env as Cloudflare.Env & {
    GOOGLE_CLIENT_ID?: string;
    NEXT_PUBLIC_SITE_URL?: string;
  };
  const clientId = runtimeEnv.GOOGLE_CLIENT_ID?.trim() ?? '';
  const siteUrl =
    runtimeEnv.NEXT_PUBLIC_SITE_URL?.trim() || 'https://davetiye.netdestek.net';
  const loginUri = new URL('/api/auth/google', siteUrl).toString();
  const hasLoginError = typeof params?.error === 'string';

  return (
    <main className="relative grid min-h-screen overflow-hidden bg-[#fbf7f2] text-foreground lg:grid-cols-[minmax(0,1fr)_minmax(440px,.78fr)]">
      <div className="pointer-events-none absolute -left-24 -top-28 size-[430px] rounded-full bg-[#ead7d1]/60 blur-3xl" />
      <section className="relative flex min-h-screen items-center justify-center px-5 py-12 sm:px-8 lg:px-14">
        <div className="w-full max-w-[460px]">
          <Link
            href="/"
            className="inline-flex items-center gap-3"
            aria-label="Davetly ana sayfa"
          >
            <span className="liquid-icon liquid-icon--brand size-11 rounded-[15px]">
              <Heart className="size-5 fill-current" strokeWidth={1.8} />
            </span>
            <span className="font-heading text-[26px] font-semibold tracking-[-0.035em]">
              davetly
            </span>
          </Link>

          <div className="mt-12 sm:mt-16">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-primary">
              Hesabınıza giriş yapın
            </p>
            <h1 className="mt-3 font-heading text-[38px] font-semibold leading-[1.08] tracking-[-0.045em] sm:text-[46px]">
              Davetiyeleriniz kaldığınız yerden devam etsin.
            </h1>
            <p className="mt-5 max-w-[410px] text-[15px] leading-7 text-muted-foreground">
              Davetiyelerinizi oluşturmak, düzenlemek ve yanıtları takip etmek
              için Google hesabınızla güvenle devam edin.
            </p>
          </div>

          <div className="mt-9 rounded-[24px] border border-[#eadfd8] bg-white/90 p-5 shadow-[0_20px_60px_rgba(76,49,40,.08)] backdrop-blur sm:p-6">
            {hasLoginError && (
              <p
                role="alert"
                className="mb-4 rounded-2xl bg-[#f9e9e8] px-4 py-3 text-xs font-medium leading-5 text-[#963f4c]"
              >
                Giriş tamamlanamadı. Lütfen Google hesabınızı seçerek yeniden
                deneyin.
              </p>
            )}

            {clientId ? (
              <GoogleSignInButton
                clientId={clientId}
                loginUri={loginUri}
                returnTo={returnTo}
              />
            ) : (
              <div className="rounded-2xl border border-[#e8d5ce] bg-[#fff8f4] px-4 py-4">
                <p className="text-sm font-semibold text-[#7e3f4b]">
                  Google girişi henüz yapılandırılmadı.
                </p>
                <p className="mt-1 text-xs leading-5 text-[#806d67]">
                  Yönetici Google istemci kimliğini ekledikten sonra giriş
                  düğmesi burada görünecek.
                </p>
              </div>
            )}

            <div className="mt-5 flex items-start gap-2.5 text-[11px] leading-5 text-muted-foreground">
              <ShieldCheck className="mt-0.5 size-4 shrink-0 text-[#397462]" />
              <p>
                Şifreniz Davetly ile paylaşılmaz. Kimliğiniz Google tarafından
                doğrulanır.
              </p>
            </div>
          </div>

          <p className="mt-6 text-center text-[11px] leading-5 text-[#958984]">
            Devam ederek{' '}
            <Link
              href="/kosullar"
              className="font-semibold text-[#75404c] underline decoration-[#75404c]/25 underline-offset-4 hover:text-primary"
            >
              hizmet koşullarını
            </Link>{' '}
            ve{' '}
            <Link
              href="/gizlilik"
              className="font-semibold text-[#75404c] underline decoration-[#75404c]/25 underline-offset-4 hover:text-primary"
            >
              gizlilik politikasını
            </Link>{' '}
            kabul etmiş olursunuz.
          </p>
        </div>
      </section>

      <aside className="relative hidden min-h-screen overflow-hidden bg-[#263a35] p-12 text-white lg:flex lg:flex-col">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_75%_18%,rgba(234,190,177,.24),transparent_28%),radial-gradient(circle_at_10%_90%,rgba(165,80,96,.3),transparent_36%)]" />
        <div className="relative ml-auto flex items-center gap-2 rounded-full border border-white/15 bg-white/8 px-3 py-2 text-[11px] text-white/80 backdrop-blur">
          <ShieldCheck className="size-3.5 text-[#efc9ba]" /> Güvenli Google
          oturumu
        </div>
        <div className="relative my-auto max-w-[470px]">
          <span className="liquid-icon liquid-icon--on-dark size-12 rounded-2xl">
            <Sparkles className="size-5 text-[#efc9ba]" />
          </span>
          <blockquote className="mt-8 font-heading text-[38px] font-medium italic leading-[1.25] tracking-[-0.035em]">
            “En güzel gününüzü, size ait küçük bir hikâyeye dönüştürün.”
          </blockquote>
          <div className="mt-10 space-y-4 text-sm text-white/75">
            <p className="flex items-center gap-3">
              <CheckCircle2 className="size-[18px] text-[#efc9ba]" /> Hazır
              videolardan kolayca seçim yapın
            </p>
            <p className="flex items-center gap-3">
              <CheckCircle2 className="size-[18px] text-[#efc9ba]" />{' '}
              Davetiyenizi WhatsApp ile paylaşın
            </p>
            <p className="flex items-center gap-3">
              <CheckCircle2 className="size-[18px] text-[#efc9ba]" /> Katılım
              yanıtlarını tek yerden takip edin
            </p>
          </div>
        </div>
        <p className="relative text-xs text-white/45">
          © 2026 Davetly · netdestek.net
        </p>
      </aside>
    </main>
  );
}
