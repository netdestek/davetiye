import { env } from 'cloudflare:workers';
import {
  CalendarDays,
  CheckCircle2,
  Clock3,
  Heart,
  LogOut,
  MapPin,
  Plus,
  ShieldCheck,
  Sparkles,
  Users,
} from 'lucide-react';
import Link from 'next/link';
import { redirect } from 'next/navigation';

import { Badge } from '@/components/ui/badge';
import { Button, buttonVariants } from '@/components/ui/button';
import { ensureDatabase } from '@/lib/d1';
import { getCurrentUser, type AuthUser } from '@/lib/user-auth';

export const dynamic = 'force-dynamic';

type UserInvitation = {
  id: string;
  title: string;
  host_names: string;
  event_at: string;
  venue_name: string | null;
  status: 'draft' | 'published' | 'archived';
  updated_at: number;
  invited_guests: number;
  answered_guests: number;
};

async function requirePageUser(): Promise<AuthUser> {
  const user = await getCurrentUser();
  if (!user) redirect('/giris');
  return user;
}

async function getUserInvitations(userId: string) {
  await ensureDatabase();
  const result = await env.DB.prepare(`SELECT
      i.id, i.title, i.host_names, i.event_at, i.venue_name, i.status, i.updated_at,
      COUNT(g.id) AS invited_guests,
      COALESCE(SUM(CASE WHEN r.guest_id IS NOT NULL THEN 1 ELSE 0 END), 0) AS answered_guests
    FROM invitations i
    LEFT JOIN guests g ON g.invitation_id = i.id
    LEFT JOIN rsvps r ON r.guest_id = g.id
    WHERE i.owner_user_id = ?
    GROUP BY i.id
    ORDER BY i.updated_at DESC
    LIMIT 50`)
    .bind(userId)
    .all<UserInvitation>();
  return result.results;
}

export default async function AccountPage() {
  const user = await requirePageUser();
  const invitations = await getUserInvitations(user.id);
  const publishedCount = invitations.filter(
    (invitation) => invitation.status === 'published',
  ).length;
  const invitedCount = invitations.reduce(
    (total, invitation) => total + Number(invitation.invited_guests),
    0,
  );
  const displayName = user.displayName || user.email.split('@')[0];
  const firstName = displayName.split(/\s+/)[0];

  return (
    <main className="min-h-screen bg-[#f8f4ef] text-foreground">
      <header className="border-b border-[#eadfd8] bg-[#fffdfa]/95 backdrop-blur">
        <div className="mx-auto flex h-[74px] max-w-[1180px] items-center px-5 sm:px-8">
          <Link
            href="/hesap"
            className="flex items-center gap-2.5"
            aria-label="Davetly hesabım"
          >
            <span className="grid size-10 place-items-center rounded-[14px] bg-primary text-white shadow-[0_8px_22px_rgba(133,43,61,.18)]">
              <Heart className="size-[18px] fill-current" />
            </span>
            <span className="font-heading text-[23px] font-semibold tracking-[-0.03em]">
              davetly
            </span>
          </Link>
          <div className="ml-auto flex items-center gap-2 sm:gap-3">
            {user.role === 'admin' && (
              <Link
                href="/admin"
                className={buttonVariants({
                  variant: 'outline',
                  className: 'hidden h-10 bg-white sm:inline-flex',
                })}
              >
                <ShieldCheck /> Admin
              </Link>
            )}
            <Link
              href="/olustur"
              className={buttonVariants({
                className: 'h-10 rounded-xl px-3.5 sm:px-4',
              })}
            >
              <Plus /> <span className="hidden sm:inline">Yeni davetiye</span>
              <span className="sm:hidden">Oluştur</span>
            </Link>
            <form action="/api/auth/logout" method="post">
              <Button
                type="submit"
                variant="ghost"
                size="icon"
                aria-label="Çıkış yap"
              >
                <LogOut />
              </Button>
            </form>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-[1180px] px-5 pb-16 pt-8 sm:px-8 sm:pt-11">
        <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-primary">
              Hesabım
            </p>
            <h1 className="mt-2 font-heading text-[34px] font-semibold leading-tight tracking-[-0.04em] sm:text-[42px]">
              Hoş geldin, {firstName} <span aria-hidden="true">👋</span>
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Davetiyelerinizi ve gelen yanıtları buradan takip edebilirsiniz.
            </p>
          </div>
          <div className="flex items-center gap-3 rounded-2xl border border-[#e9ded8] bg-[#fffdfa] px-4 py-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-full bg-[#eadbd5] text-xs font-bold text-[#765149]">
              {initials(displayName)}
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{displayName}</p>
              <p className="truncate text-[11px] text-muted-foreground">
                {user.email}
              </p>
            </div>
          </div>
        </div>

        <section className="mt-8 grid gap-3 sm:grid-cols-3">
          <SummaryCard
            icon={Heart}
            label="Toplam davetiye"
            value={invitations.length}
            tone="bg-[#f7e8e7] text-[#944353]"
          />
          <SummaryCard
            icon={CheckCircle2}
            label="Yayındaki davetiye"
            value={publishedCount}
            tone="bg-[#e3f1eb] text-[#2d705e]"
          />
          <SummaryCard
            icon={Users}
            label="Toplam davetli"
            value={invitedCount}
            tone="bg-[#eeeaf5] text-[#6a5a87]"
          />
        </section>

        <section className="mt-6 overflow-hidden rounded-[22px] border border-[#eadfd8] bg-[#fffdfa] shadow-[0_14px_40px_rgba(70,45,38,.05)]">
          <div className="flex items-center justify-between gap-4 border-b border-[#eee5df] px-5 py-5 sm:px-6">
            <div>
              <h2 className="font-heading text-[21px] font-semibold">
                Davetiyelerim
              </h2>
              <p className="mt-1 text-xs text-muted-foreground">
                Size ait davetiyeler
              </p>
            </div>
            {invitations.length > 0 && (
              <Badge
                variant="secondary"
                className="bg-[#f3ece8] text-[#76635c]"
              >
                {invitations.length} davetiye
              </Badge>
            )}
          </div>

          {invitations.length === 0 ? (
            <div className="flex flex-col items-center px-5 py-16 text-center">
              <span className="grid size-14 place-items-center rounded-2xl bg-[#f5e8e5] text-primary">
                <Sparkles className="size-6" />
              </span>
              <h3 className="mt-5 font-heading text-2xl font-semibold">
                İlk davetiyenizi oluşturalım
              </h3>
              <p className="mt-2 max-w-[430px] text-sm leading-6 text-muted-foreground">
                Hazır videolardan birini seçip etkinlik bilgilerinizi ekleyerek
                birkaç adımda paylaşmaya başlayın.
              </p>
              <Link
                href="/olustur"
                className={buttonVariants({ className: 'mt-6 rounded-xl' })}
              >
                <Plus /> Davetiye oluştur
              </Link>
            </div>
          ) : (
            <div className="divide-y divide-[#f0e8e3]">
              {invitations.map((invitation) => {
                const eventDate = formatEventDate(invitation.event_at);
                const answerRate = invitation.invited_guests
                  ? Math.round(
                      (Number(invitation.answered_guests) /
                        Number(invitation.invited_guests)) *
                        100,
                    )
                  : 0;
                return (
                  <article
                    key={invitation.id}
                    className="group px-5 py-5 transition-colors hover:bg-[#fcf8f5] sm:px-6"
                  >
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                      <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-[#f4e7e3] text-primary">
                        <Heart className="size-5" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="truncate font-heading text-xl font-semibold">
                            {invitation.host_names}
                          </h3>
                          <StatusBadge status={invitation.status} />
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {invitation.title}
                        </p>
                        <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-[11px] text-[#786c67]">
                          <span className="flex items-center gap-1.5">
                            <CalendarDays className="size-3.5 text-primary" />
                            {eventDate}
                          </span>
                          {invitation.venue_name && (
                            <span className="flex items-center gap-1.5">
                              <MapPin className="size-3.5 text-primary" />
                              {invitation.venue_name}
                            </span>
                          )}
                          <span className="flex items-center gap-1.5">
                            <Users className="size-3.5 text-primary" />
                            {invitation.invited_guests} davetli · %{answerRate}{' '}
                            yanıt
                          </span>
                        </div>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toLocaleUpperCase('tr-TR'))
    .join('');
}

function formatEventDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('tr-TR', {
    dateStyle: 'long',
    timeStyle: 'short',
    timeZone: 'Europe/Istanbul',
  }).format(date);
}

function StatusBadge({ status }: { status: UserInvitation['status'] }) {
  if (status === 'published')
    return (
      <Badge className="bg-[#e2f0ea] text-[#246454]">
        <CheckCircle2 className="size-3" /> Yayında
      </Badge>
    );
  if (status === 'archived')
    return (
      <Badge variant="secondary" className="bg-[#eeeae7] text-[#746762]">
        Arşivde
      </Badge>
    );
  return (
    <Badge variant="secondary" className="bg-[#f5eadb] text-[#946331]">
      <Clock3 className="size-3" /> Taslak
    </Badge>
  );
}

function SummaryCard({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: typeof Heart;
  label: string;
  value: number;
  tone: string;
}) {
  return (
    <div className="rounded-2xl border border-[#eadfd8] bg-[#fffdfa] p-5 shadow-[0_8px_28px_rgba(70,45,38,.035)]">
      <div className="flex items-center justify-between">
        <span className={`grid size-10 place-items-center rounded-xl ${tone}`}>
          <Icon className="size-[18px]" />
        </span>
        <strong className="font-heading text-[30px] font-semibold tracking-[-0.04em]">
          {value}
        </strong>
      </div>
      <p className="mt-4 text-xs font-semibold text-[#655b57]">{label}</p>
    </div>
  );
}
