import type { Metadata } from 'next';
import { CalendarDays, Heart, MapPin, Navigation } from 'lucide-react';
import { notFound } from 'next/navigation';

import { RsvpForm } from '@/components/rsvp-form';
import { getPublicInvitation } from '@/lib/d1';
import { EVENT_TIME_ZONE, parseStoredEventDateTime } from '@/lib/event-time';

export const dynamic = 'force-dynamic';

type PageProps = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const invitation = await getPublicInvitation(slug);
  if (!invitation) return { title: 'Davetiye bulunamadı — Davetly' };
  const description = `${invitation.hostNames} sizi ${invitation.venueName} davetine bekliyor.`;
  return {
    title: `${invitation.hostNames} — Dijital Davetiye`,
    description,
    openGraph: { title: invitation.hostNames, description, images: [] },
    twitter: { card: 'summary', title: invitation.hostNames, description, images: [] },
  };
}

export default async function InvitationPage({ params }: PageProps) {
  const { slug } = await params;
  const invitation = await getPublicInvitation(slug);
  if (!invitation) notFound();

  const eventDate = parseStoredEventDateTime(invitation.eventAt);
  if (!eventDate) notFound();
  const daysLeft = Math.max(0, Math.ceil((eventDate.getTime() - Date.now()) / 86_400_000));
  const dateLabel = new Intl.DateTimeFormat('tr-TR', {
    day: 'numeric', month: 'long', year: 'numeric', weekday: 'long', timeZone: EVENT_TIME_ZONE,
  }).format(eventDate);
  const timeLabel = new Intl.DateTimeFormat('tr-TR', {
    hour: '2-digit', minute: '2-digit', timeZone: EVENT_TIME_ZONE,
  }).format(eventDate);

  return (
    <main className="min-h-screen bg-[#f7f1eb] text-[#332925]">
      <div className="pointer-events-none fixed inset-0 opacity-[.28] [background-image:radial-gradient(#ab8a7d_0.65px,transparent_0.65px)] [background-size:14px_14px]" />

      <header className="relative z-10 flex h-16 items-center justify-center">
        <a href="/" className="flex items-center gap-2" aria-label="Davetly">
          <span className="liquid-icon liquid-icon--brand size-8 rounded-xl"><Heart className="size-3.5 fill-current" /></span>
          <span className="font-heading text-xl font-semibold">davetly</span>
        </a>
      </header>

      <section className="relative z-10 mx-auto max-w-[780px] px-4 pb-16 sm:px-6">
        <div className="overflow-hidden rounded-[28px] bg-[#412f35] shadow-[0_28px_80px_rgba(65,42,43,.19)]">
          <div className="relative aspect-[16/10] min-h-[270px] overflow-hidden sm:aspect-[16/9]">
            {invitation.videoKey ? (
              // Uploaded invitations do not currently store a captions asset.
              // eslint-disable-next-line jsx-a11y/media-has-caption
              <video
                className="absolute inset-0 size-full bg-black object-contain"
                controls
                playsInline
                preload="metadata"
                poster={invitation.posterKey ? `/api/media/${encodeURIComponent(slug)}/poster` : undefined}
              >
                <source src={`/api/media/${encodeURIComponent(slug)}/video`} />
                Tarayıcınız video oynatmayı desteklemiyor.
              </video>
            ) : (
              <>
                <img src="/og.png" alt="Davetly dijital davetiye ön izlemesi" className="absolute inset-0 size-full object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-[#2d2025]/75 via-[#2d2025]/15 to-transparent" />
                <div className="absolute inset-x-0 bottom-0 p-6 text-white sm:p-9">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-white/75">{invitation.title}</p>
                  <h1 className="mt-2 font-heading text-[37px] font-medium italic leading-none tracking-[-0.035em] sm:text-[52px]">{invitation.hostNames}</h1>
                </div>
              </>
            )}
          </div>
        </div>

        <div className="mx-auto -mt-1 max-w-[680px] rounded-b-[28px] border-x border-b border-[#e3d6ce] bg-[#fffdfa] px-5 pb-7 pt-8 text-center shadow-[0_18px_60px_rgba(60,40,34,.08)] sm:px-9">
          <p className="mx-auto max-w-md font-heading text-[22px] italic leading-8 text-[#56413a]">“{invitation.description}”</p>
          <div className="mx-auto my-6 h-px w-16 bg-[#d7b8ab]" />
          <div className="grid gap-3 text-left sm:grid-cols-2">
            <div className="flex items-start gap-3 rounded-2xl bg-[#faf5f1] p-4">
              <span className="liquid-icon liquid-icon--rose size-9 shrink-0 rounded-xl"><CalendarDays className="size-4" /></span>
              <div><p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">Tarih & saat</p><p className="mt-1 text-[13px] font-semibold capitalize">{dateLabel}</p><p className="text-xs text-muted-foreground">Saat {timeLabel}</p></div>
            </div>
            <div className="flex items-start gap-3 rounded-2xl bg-[#faf5f1] p-4">
              <span className="liquid-icon liquid-icon--sage size-9 shrink-0 rounded-xl"><MapPin className="size-4" /></span>
              <div><p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">Mekân</p><p className="mt-1 text-[13px] font-semibold">{invitation.venueName}</p><p className="text-xs text-muted-foreground">{invitation.venueAddress}</p></div>
            </div>
          </div>
          <a href={invitation.mapUrl} target="_blank" rel="noreferrer" className="mt-4 inline-flex h-10 items-center gap-2 rounded-xl border border-[#e3d6ce] bg-white px-4 text-xs font-semibold text-[#5f4c46] hover:bg-[#faf6f3]">
            <Navigation className="size-3.5" /> Yol tarifi al
          </a>
        </div>

        <div className="my-8 grid grid-cols-[1fr_auto_1fr] items-center gap-4">
          <div className="h-px bg-[#dfd1ca]" />
          <div className="text-center"><strong className="font-heading text-[32px] font-semibold text-primary">{daysLeft}</strong><p className="-mt-1 text-[9px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">gün kaldı</p></div>
          <div className="h-px bg-[#dfd1ca]" />
        </div>

        <RsvpForm slug={slug} />
      </section>

      <footer className="relative z-10 border-t border-[#e4d8d1] py-7 text-center text-[11px] text-muted-foreground">Sevgiyle hazırlandı · <a href="/" className="font-semibold text-primary">Davetly</a></footer>
    </main>
  );
}
