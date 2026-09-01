import {
  ArrowLeft,
  CalendarDays,
  Check,
  Clock3,
  Heart,
  HelpCircle,
  LayoutDashboard,
  MapPin,
  MoreHorizontal,
  Plus,
  Search,
  Settings,
  Users,
  X,
} from 'lucide-react';

import { requireConfiguredAdmin } from '@/app/cloudflare-access-auth';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ShareActions } from '@/components/share-actions';
import { getGuestResponses, getInvitationMetrics } from '@/lib/d1';

export const dynamic = 'force-dynamic';

const statusPresentation = {
  yes: {
    label: 'Katılıyor',
    className: 'bg-[#e3f1eb] text-[#286957]',
    icon: Check,
  },
  no: {
    label: 'Katılamıyor',
    className: 'bg-[#f7e7e4] text-[#9b4650]',
    icon: X,
  },
  maybe: {
    label: 'Henüz net değil',
    className: 'bg-[#efebf6] text-[#6d5a88]',
    icon: HelpCircle,
  },
  awaiting: {
    label: 'Yanıt bekleniyor',
    className: 'bg-[#f3eee9] text-[#756862]',
    icon: Clock3,
  },
};

export default async function InvitationsPage() {
  await requireConfiguredAdmin();
  const [metrics, guests] = await Promise.all([
    getInvitationMetrics('demo-wedding'),
    getGuestResponses('demo-wedding'),
  ]);
  const answered =
    metrics.attendingGuests + metrics.declinedGuests + metrics.maybeGuests;

  return (
    <main className="min-h-screen bg-[#f8f4ef] text-foreground lg:pl-[226px]">
      <aside className="fixed inset-y-0 left-0 hidden w-[226px] flex-col border-r border-[#eadfd8] bg-[#fffdfa] p-5 lg:flex">
        <a href="/" className="flex items-center gap-2.5 px-1">
          <span className="liquid-icon liquid-icon--brand size-9 rounded-xl">
            <Heart className="size-4 fill-current" />
          </span>
          <span className="font-heading text-xl font-semibold">davetly</span>
        </a>
        <nav className="mt-9 space-y-1 text-sm">
          <a href="/" className="nav-link">
            <LayoutDashboard />
            Ana sayfa
          </a>
          <a
            href="/davetiyeler"
            className="flex h-11 items-center gap-3 rounded-xl bg-[#f7ebe9] px-3 font-semibold text-primary"
          >
            <Heart className="size-[18px]" />
            Davetiyelerim
          </a>
          <a href="#guests" className="nav-link">
            <Users />
            Davetliler
          </a>
          <a href="#" className="nav-link">
            <Settings />
            Ayarlar
          </a>
        </nav>
        <div className="mt-auto rounded-2xl bg-[#f5eee9] p-4">
          <p className="text-xs font-semibold">Düğüne 12 gün kaldı</p>
          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white">
            <div className="h-full w-[61%] rounded-full bg-primary" />
          </div>
          <p className="mt-2 text-[10px] text-muted-foreground">
            Yanıt oranı %
            {metrics.invitedGuests
              ? Math.round((answered / metrics.invitedGuests) * 100)
              : 0}
          </p>
        </div>
      </aside>

      <header className="flex h-[72px] items-center border-b border-[#eadfd8] bg-[#fffdfa] px-4 sm:px-7">
        <a
          href="/"
          className="liquid-icon-button liquid-icon--neutral mr-3 size-11 rounded-[14px]"
          aria-label="Geri"
        >
          <ArrowLeft className="size-4" />
        </a>
        <div>
          <p className="text-sm font-semibold">Elif & Arda</p>
          <p className="text-[10px] text-muted-foreground">Düğün davetiyesi</p>
        </div>
        <Badge className="ml-3 bg-[#e2f0ea] text-[#246454]">Yayında</Badge>
        <div className="ml-auto flex items-center gap-2">
          <Button
            nativeButton={false}
            render={<a href="/olustur" />}
            variant="outline"
            className="hidden h-9 bg-white sm:inline-flex"
          >
            <Plus /> Yeni davetiye
          </Button>
          <span className="grid size-8 place-items-center rounded-full bg-[#e9d9d2] text-xs font-semibold">
            EA
          </span>
        </div>
      </header>

      <div className="mx-auto max-w-[1320px] px-4 pb-16 pt-6 sm:px-7 lg:pt-8">
        <div className="flex flex-col justify-between gap-4 xl:flex-row xl:items-end">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">
              Davetiye yönetimi
            </p>
            <h1 className="mt-2 font-invitation text-[32px] font-semibold tracking-[-0.035em]">
              Elif & Arda
            </h1>
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <CalendarDays className="size-3.5" />
                12 Eylül 2026 · 19:30
              </span>
              <span className="flex items-center gap-1.5">
                <MapPin className="size-3.5" />
                Liva Davet
              </span>
            </div>
          </div>
          <ShareActions
            slug="ahmet-zeynep-x7p92k"
            guests={guests.map((guest) => ({
              name: guest.name,
              status: guest.status ?? 'awaiting',
              partySize: guest.partySize,
              note: guest.note,
            }))}
          />
        </div>

        <div className="mt-7 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <Metric
            label="Davetli"
            value={metrics.invitedGuests}
            note="toplam kişi"
            tone="liquid-icon--rose"
            icon={Users}
          />
          <Metric
            label="Katılacak"
            value={metrics.attendingGuests}
            note={`${metrics.expectedAttendees} toplam kişi`}
            tone="liquid-icon--sage"
            icon={Check}
          />
          <Metric
            label="Katılamayacak"
            value={metrics.declinedGuests}
            note="yanıt verdi"
            tone="liquid-icon--rose"
            icon={X}
          />
          <Metric
            label="Henüz net değil"
            value={metrics.maybeGuests}
            note="karar bekliyor"
            tone="liquid-icon--violet"
            icon={HelpCircle}
          />
          <Metric
            label="Yanıt beklenen"
            value={metrics.awaitingResponse}
            note="hatırlatılabilir"
            tone="liquid-icon--neutral"
            icon={Clock3}
          />
        </div>

        <section
          id="guests"
          className="mt-6 overflow-hidden rounded-[20px] border border-[#eadfd8] bg-[#fffdfa] shadow-[0_12px_36px_rgba(70,45,38,.05)]"
        >
          <div className="flex flex-col gap-3 border-b border-[#eee5df] p-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="font-heading text-xl font-semibold">
                Davetli yanıtları
              </h2>
              <p className="mt-1 text-xs text-muted-foreground">
                Yanıtlar gönderildikçe bu liste otomatik güncellenir.
              </p>
            </div>
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <input
                aria-label="Davetli ara"
                placeholder="İsimle ara"
                className="h-10 w-full rounded-xl border border-[#e4d9d3] bg-white pl-10 pr-3 text-xs outline-none focus:border-[#bd858f]"
              />
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-xs">
              <thead className="bg-[#faf6f3] text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                <tr>
                  <th className="px-5 py-3">Davetli</th>
                  <th className="px-5 py-3">Katılım</th>
                  <th className="px-5 py-3">Kişi</th>
                  <th className="px-5 py-3">Not</th>
                  <th className="px-5 py-3">Yanıt tarihi</th>
                  <th className="w-14 px-3 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-[#f0e8e3]">
                {guests.map((guest) => {
                  const presentation =
                    statusPresentation[guest.status ?? 'awaiting'];
                  return (
                    <tr key={guest.id} className="hover:bg-[#fcf8f5]">
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <span className="grid size-8 place-items-center rounded-full bg-[#efe1db] text-[10px] font-bold text-[#7d544b]">
                            {initials(guest.name)}
                          </span>
                          <span className="font-semibold">{guest.name}</span>
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <Badge className={presentation.className}>
                          <presentation.icon className="size-3" />
                          {presentation.label}
                        </Badge>
                      </td>
                      <td className="px-5 py-4 font-semibold">
                        {guest.partySize || '—'}
                      </td>
                      <td className="max-w-[280px] truncate px-5 py-4 text-muted-foreground">
                        {guest.note || '—'}
                      </td>
                      <td className="px-5 py-4 text-muted-foreground">
                        {guest.respondedAt
                          ? new Date(
                              guest.respondedAt * 1000,
                            ).toLocaleDateString('tr-TR')
                          : '—'}
                      </td>
                      <td className="px-3 py-4">
                        <button
                          aria-label={`${guest.name} seçenekleri`}
                          className="liquid-icon-button liquid-icon--neutral liquid-icon--static size-11 rounded-[14px]"
                        >
                          <MoreHorizontal className="size-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </main>
  );
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toLocaleUpperCase('tr-TR'))
    .join('');
}

function Metric({
  label,
  value,
  note,
  tone,
  icon: Icon,
}: {
  label: string;
  value: number;
  note: string;
  tone: string;
  icon: typeof Users;
}) {
  return (
    <div className="rounded-2xl border border-[#eadfd8] bg-[#fffdfa] p-4">
      <div className="flex items-center justify-between">
        <span className={`liquid-icon size-10 rounded-xl ${tone}`}>
          <Icon className="size-4" />
        </span>
        <strong className="font-heading text-2xl font-semibold">{value}</strong>
      </div>
      <p className="mt-3 text-xs font-semibold">{label}</p>
      <p className="mt-1 text-[10px] text-muted-foreground">{note}</p>
    </div>
  );
}
