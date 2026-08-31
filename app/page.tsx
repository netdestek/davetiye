import {
  ArrowUpRight, CalendarDays, Check, ChevronRight, Clock3, Heart,
  HelpCircle, Home, LayoutTemplate, MapPin, MoreHorizontal, PartyPopper,
  Play, Plus, Search, Send, Settings, ShieldCheck, Sparkles, UserRound, Users, X,
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle,
} from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';

const stats = [
  { label: 'Davetiye açıldı', value: '112', note: '150 davetliden', icon: Send, tone: 'text-[#9f3d4c] bg-[#f8e9e8]' },
  { label: 'Katılacak', value: '78', note: '126 toplam kişi', icon: Check, tone: 'text-[#277061] bg-[#e0f0ea]' },
  { label: 'Katılamayacak', value: '14', note: '9 yeni yanıt', icon: X, tone: 'text-[#9a6034] bg-[#faecdc]' },
  { label: 'Yanıt bekleniyor', value: '58', note: '%39 beklemede', icon: Clock3, tone: 'text-[#62579b] bg-[#eeebf8]' },
];

const guests = [
  { initials: 'SY', name: 'Selin Yılmaz', time: '4 dk önce', count: 2, status: 'Katılıyor' },
  { initials: 'ME', name: 'Mert Erdem', time: '18 dk önce', count: 1, status: 'Katılıyor' },
  { initials: 'BA', name: 'Burcu Akın', time: '42 dk önce', count: 0, status: 'Katılamıyor' },
];

const nav = [
  { label: 'Ana sayfa', icon: Home, href: '/', active: true },
  { label: 'Davetiyelerim', icon: Heart, href: '/davetiyeler' },
  { label: 'Davetliler', icon: Users, href: '/davetiyeler#guests' },
  { label: 'Şablonlar', icon: LayoutTemplate, href: '/olustur' },
  { label: 'Admin demo', icon: ShieldCheck, href: '/admin' },
];

export default function HomePage() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[252px] flex-col border-r border-[#eadfd9] bg-[#fffdfa] px-5 py-6 lg:flex">
        <a href="/" className="flex items-center gap-3 px-2" aria-label="Davetly ana sayfa">
          <span className="grid size-10 place-items-center rounded-[14px] bg-primary text-primary-foreground shadow-[0_8px_24px_rgba(133,43,61,.18)]">
            <Heart className="size-[19px] fill-current" strokeWidth={1.8} />
          </span>
          <span className="font-heading text-[23px] font-semibold tracking-[-0.03em]">davetly</span>
        </a>

        <nav className="mt-10 space-y-1" aria-label="Ana menü">
          {nav.map((item) => (
            <a
              key={item.label}
              href={item.href}
              className={`flex h-11 items-center gap-3 rounded-xl px-3 text-[14px] font-medium transition-colors ${
                item.active ? 'bg-[#f7ebe9] text-primary' : 'text-[#756b68] hover:bg-[#f8f3ef] hover:text-foreground'
              }`}
            >
              <item.icon className="size-[18px]" strokeWidth={item.active ? 2.2 : 1.8} />
              {item.label}
            </a>
          ))}
        </nav>

        <div className="mt-8 px-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-[#a69b97]">Hesap</div>
        <nav className="mt-2 space-y-1" aria-label="Hesap menüsü">
          <a href="#" className="nav-link"><Settings />Ayarlar</a>
          <a href="#" className="nav-link"><HelpCircle />Yardım merkezi</a>
        </nav>

        <Card className="mt-auto gap-0 border-0 bg-[#2e3d39] py-0 text-white ring-0 shadow-none">
          <CardContent className="p-4">
            <div className="mb-3 flex items-center gap-2 text-xs font-medium text-[#dce7e2]">
              <Sparkles className="size-4 text-[#efc783]" /> Davetly Plus
            </div>
            <p className="text-sm font-medium leading-5">Daha çok davetli, daha çok şablon.</p>
            <button className="mt-3 text-xs font-semibold text-[#efc783]">Paketi keşfet →</button>
          </CardContent>
        </Card>
      </aside>

      <section className="min-h-screen lg:pl-[252px]">
        <header className="sticky top-0 z-20 flex h-[76px] items-center justify-between border-b border-[#eee5df] bg-background/90 px-5 backdrop-blur-xl sm:px-8 lg:px-10">
          <div className="flex items-center gap-3 lg:hidden">
            <span className="grid size-9 place-items-center rounded-xl bg-primary text-primary-foreground"><Heart className="size-4 fill-current" /></span>
            <span className="font-heading text-xl font-semibold">davetly</span>
          </div>
          <div className="relative hidden w-full max-w-[320px] md:block">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <input aria-label="Davetiyelerde ara" placeholder="Davetiye veya davetli ara" className="h-10 w-full rounded-xl border border-[#e7ddd7] bg-white pl-10 pr-3 text-sm outline-none transition focus:border-[#c89da2] focus:ring-4 focus:ring-[#a94e5e]/8" />
          </div>
          <div className="ml-auto flex items-center gap-2 sm:gap-3">
            <Button nativeButton={false} render={<a href="/olustur" />} className="h-10 rounded-xl bg-primary px-3.5 shadow-[0_8px_22px_rgba(133,43,61,.16)] hover:bg-[#733044] sm:px-4">
              <Plus data-icon="inline-start" /> <span className="hidden sm:inline">Yeni davetiye</span><span className="sm:hidden">Oluştur</span>
            </Button>
            <button aria-label="Profil menüsü" className="flex items-center gap-2 rounded-xl p-1.5 hover:bg-muted">
              <span className="grid size-8 place-items-center rounded-full bg-[#e4d5ce] text-xs font-semibold text-[#755951]">EA</span>
              <ChevronRight className="hidden size-4 text-muted-foreground sm:block" />
            </button>
          </div>
        </header>

        <div className="mx-auto max-w-[1380px] px-5 pb-24 pt-7 sm:px-8 lg:px-10 lg:pb-10 lg:pt-9">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
            <div>
              <p className="mb-1 text-sm font-medium text-primary">Pazartesi, 31 Ağustos</p>
              <h1 className="font-heading text-[31px] font-semibold leading-tight tracking-[-0.035em] sm:text-[38px]">Hoş geldin, Elif <span aria-hidden="true">👋</span></h1>
              <p className="mt-2 text-[14px] text-muted-foreground">Davetinin son durumuna birlikte bakalım.</p>
            </div>
            <a href="/davet/ahmet-zeynep-x7p92k" className="group inline-flex items-center gap-2 text-sm font-semibold text-primary">
              Davetli sayfasını görüntüle <ArrowUpRight className="size-4 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
            </a>
          </div>

          <div className="mt-7 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {stats.map((stat) => (
              <Card key={stat.label} className="gap-0 border-0 bg-card py-0 ring-[#eee3dd] transition-transform hover:-translate-y-0.5">
                <CardContent className="flex items-start gap-4 p-4 sm:p-5">
                  <span className={`grid size-10 shrink-0 place-items-center rounded-xl ${stat.tone}`}><stat.icon className="size-[18px]" strokeWidth={2} /></span>
                  <div className="min-w-0">
                    <p className="text-[13px] font-medium text-muted-foreground">{stat.label}</p>
                    <div className="mt-1 flex items-baseline gap-2">
                      <strong className="font-heading text-[28px] font-semibold leading-none tracking-[-0.03em]">{stat.value}</strong>
                      <span className="truncate text-[11px] text-[#9e938f]">{stat.note}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1.45fr)_minmax(330px,.75fr)]">
            <Card className="gap-0 border-0 bg-card py-0 ring-[#eee3dd]">
              <CardHeader className="border-b border-[#f0e8e3] px-5 py-4 sm:px-6">
                <CardTitle className="font-heading text-[19px] font-semibold">Aktif davetiyen</CardTitle>
                <CardDescription>12 Eylül&apos;deki düğün davetin</CardDescription>
                <CardAction><Button variant="ghost" size="icon" aria-label="Daha fazla seçenek"><MoreHorizontal /></Button></CardAction>
              </CardHeader>
              <CardContent className="p-5 sm:p-6">
                <div className="grid gap-6 md:grid-cols-[230px_1fr]">
                  <div className="invitation-preview relative min-h-[246px] overflow-hidden rounded-[20px] p-5 text-white shadow-[0_18px_45px_rgba(75,36,44,.18)]">
                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_15%_18%,rgba(255,255,255,.22),transparent_24%),linear-gradient(155deg,transparent_42%,rgba(255,255,255,.08)_42%)]" />
                    <div className="relative flex h-full flex-col items-center justify-center text-center">
                      <span className="mb-3 grid size-10 place-items-center rounded-full border border-white/35 bg-white/10 backdrop-blur"><Play className="ml-0.5 size-4 fill-white" /></span>
                      <p className="text-[10px] font-medium uppercase tracking-[0.25em] text-white/70">Birlikte bir ömre</p>
                      <p className="mt-2 font-heading text-[27px] font-medium italic leading-none">Elif <span className="text-[#eec6bb]">&</span> Arda</p>
                      <p className="mt-3 text-[11px] text-white/75">12 · 09 · 2026</p>
                    </div>
                    <Badge className="absolute left-3 top-3 bg-white/15 text-white backdrop-blur">Yayında</Badge>
                  </div>

                  <div className="flex min-w-0 flex-col">
                    <div className="flex items-start justify-between gap-3">
                      <div><h2 className="font-heading text-[24px] font-semibold tracking-[-0.02em]">Elif & Arda</h2><p className="mt-1 text-sm text-muted-foreground">Düğün davetiyesi</p></div>
                      <Badge variant="secondary" className="bg-[#e2f0ea] text-[#226454]">Yayında</Badge>
                    </div>
                    <div className="mt-5 space-y-3 text-[13px]">
                      <div className="flex items-center gap-3"><CalendarDays className="size-4 text-primary" />12 Eylül 2026, Cumartesi · 19:30</div>
                      <div className="flex items-center gap-3"><MapPin className="size-4 text-primary" />Liva Davet, İstanbul</div>
                      <div className="flex items-center gap-3"><Users className="size-4 text-primary" />150 davetli eklendi</div>
                    </div>
                    <div className="mt-6">
                      <div className="mb-2 flex items-center justify-between text-xs"><span className="font-medium">Yanıt oranı</span><span className="font-semibold text-primary">%61</span></div>
                      <Progress value={61} className="[&_[data-slot=progress-track]]:h-2 [&_[data-slot=progress-track]]:bg-[#f1e8e4] [&_[data-slot=progress-indicator]]:bg-primary" />
                    </div>
                    <div className="mt-auto flex flex-wrap gap-2 pt-6">
                      <Button nativeButton={false} render={<a href="/davetiyeler" />} className="h-9 px-3.5">Davetiyeyi yönet</Button>
                      <Button nativeButton={false} render={<a href="/davet/ahmet-zeynep-x7p92k" />} variant="outline" className="h-9 px-3.5">Ön izleme</Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="gap-0 border-0 bg-card py-0 ring-[#eee3dd]">
              <CardHeader className="border-b border-[#f0e8e3] px-5 py-4">
                <CardTitle className="font-heading text-[19px] font-semibold">Son yanıtlar</CardTitle>
                <CardDescription>Davetlilerinden gelen yeni haberler</CardDescription>
                <CardAction><a href="/davetiyeler#guests" className="text-xs font-semibold text-primary">Tümü</a></CardAction>
              </CardHeader>
              <CardContent className="px-5 py-2">
                <div className="divide-y divide-[#f1e9e5]">
                  {guests.map((guest) => (
                    <div key={guest.name} className="flex items-center gap-3 py-4">
                      <span className="grid size-9 shrink-0 place-items-center rounded-full bg-[#f0e2dc] text-[11px] font-bold text-[#80534b]">{guest.initials}</span>
                      <div className="min-w-0 flex-1"><p className="truncate text-[13px] font-semibold">{guest.name}</p><p className="mt-0.5 text-[11px] text-muted-foreground">{guest.time} · {guest.count || '—'} kişi</p></div>
                      <Badge variant="secondary" className={guest.count ? 'bg-[#e3f1eb] text-[#286957]' : 'bg-[#f7e7e4] text-[#9b4650]'}>{guest.status}</Badge>
                    </div>
                  ))}
                </div>
                <a href="/davetiyeler#guests" className="mb-3 mt-1 flex w-full items-center justify-center gap-1.5 rounded-xl bg-[#faf5f2] py-2.5 text-xs font-semibold text-[#74645f] hover:bg-[#f5ede9]">Tüm davetlileri gör <ChevronRight className="size-3.5" /></a>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      <nav className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-4 border-t border-[#e8dcd6] bg-[#fffdfa]/95 px-2 pb-[max(8px,env(safe-area-inset-bottom))] pt-2 backdrop-blur-xl lg:hidden" aria-label="Mobil menü">
        <a href="/" className="mobile-nav text-primary"><Home /><span>Ana sayfa</span></a>
        <a href="/davetiyeler" className="mobile-nav"><Heart /><span>Davetler</span></a>
        <a href="/olustur" className="mobile-nav"><PartyPopper /><span>Oluştur</span></a>
        <a href="#" className="mobile-nav"><UserRound /><span>Hesabım</span></a>
      </nav>
    </main>
  );
}
