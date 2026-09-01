import {
  BarChart3, CheckCircle2, ChevronDown, CircleDollarSign, Clock3,
  Film, Heart, LayoutDashboard, LayoutTemplate, MoreHorizontal, Search,
  Settings, ShieldCheck, Sparkles, TicketPercent, TrendingUp, UserRound,
  Users,
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ActivationCodeIssuer } from '@/components/activation-code-issuer';
import { requireConfiguredAdmin } from '@/app/cloudflare-access-auth';

export const dynamic = 'force-dynamic';

const users = [
  { name: 'Elif Aydın', email: 'elif@ornek.com', plan: 'Plus', invites: 2, status: 'Aktif', joined: '28 Ağu 2026' },
  { name: 'Mert Kılıç', email: 'mert@ornek.com', plan: 'Başlangıç', invites: 1, status: 'Aktif', joined: '27 Ağu 2026' },
  { name: 'Zeynep Akın', email: 'zeynep@ornek.com', plan: 'Plus', invites: 4, status: 'Aktif', joined: '25 Ağu 2026' },
  { name: 'Caner Demir', email: 'caner@ornek.com', plan: 'Başlangıç', invites: 0, status: 'İncelemede', joined: '24 Ağu 2026' },
];

const jobs = [
  { title: 'Elif & Arda', type: '1080p · 42 sn', status: 'Sunuluyor', progress: 100, tone: 'bg-[#2e7a65]' },
  { title: 'Mina’nın 1. Yaşı', type: '1080p · 28 sn', status: 'Yükleniyor', progress: 68, tone: 'bg-[#bd7a37]' },
  { title: 'Nova Açılış', type: '720p · 36 sn', status: 'Yükleme bekliyor', progress: 12, tone: 'bg-[#7a6b96]' },
];

const nav = [
  { label: 'Genel bakış', icon: LayoutDashboard, active: true },
  { label: 'Kullanıcılar', icon: Users },
  { label: 'Davetiyeler', icon: Heart },
  { label: 'Şablonlar', icon: LayoutTemplate },
  { label: 'Video yüklemeleri', icon: Film, badge: '3' },
  { label: 'Siparişler', icon: CircleDollarSign },
  { label: 'Kampanyalar', icon: TicketPercent },
];

export default async function AdminPage() {
  await requireConfiguredAdmin();

  return (
    <main className="min-h-screen bg-[#f5f6f8] text-[#25282b] lg:pl-[238px]">
      <aside className="fixed inset-y-0 left-0 hidden w-[238px] flex-col bg-[#182522] px-4 py-5 text-[#d8e2df] lg:flex">
        <a href="/" className="flex items-center gap-2.5 px-2"><span className="grid size-9 place-items-center rounded-xl bg-[#a84c5e] text-white"><Heart className="size-4 fill-current" /></span><span className="font-heading text-xl font-semibold text-white">davetly</span><Badge className="ml-auto bg-white/10 text-[9px] text-white">ADMIN</Badge></a>
        <nav className="mt-9 space-y-1" aria-label="Admin menüsü">
          {nav.map((item) => <a key={item.label} href="#" className={`flex h-10 items-center gap-3 rounded-xl px-3 text-[13px] font-medium transition ${item.active ? 'bg-white/10 text-white' : 'text-[#9fb0ab] hover:bg-white/5 hover:text-white'}`}><item.icon className="size-[17px]" />{item.label}{item.badge && <span className="ml-auto rounded-full bg-[#a84c5e] px-1.5 py-0.5 text-[9px] text-white">{item.badge}</span>}</a>)}
        </nav>
        <div className="mt-auto border-t border-white/10 pt-4"><a href="#" className="flex h-10 items-center gap-3 rounded-xl px-3 text-[13px] text-[#9fb0ab] hover:bg-white/5 hover:text-white"><Settings className="size-[17px]" />Sistem ayarları</a><div className="mt-3 flex items-center gap-3 rounded-xl bg-white/5 p-3"><span className="grid size-8 place-items-center rounded-full bg-[#ca7180] text-[10px] font-bold text-white">MK</span><div className="min-w-0"><p className="truncate text-xs font-semibold text-white">Mert Kaya</p><p className="text-[9px] text-[#91a39e]">Süper yönetici</p></div><ChevronDown className="ml-auto size-3" /></div></div>
      </aside>

      <header className="flex h-[70px] items-center border-b border-[#e2e5e8] bg-white px-4 sm:px-7">
        <div className="flex items-center gap-2 lg:hidden"><span className="grid size-9 place-items-center rounded-xl bg-[#182522] text-white"><ShieldCheck className="size-4" /></span><strong className="text-sm">Admin</strong></div>
        <div className="relative hidden w-full max-w-[360px] lg:block"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#8a9296]" /><input aria-label="Yönetim panelinde ara" placeholder="Kullanıcı, davetiye veya sipariş ara" className="h-10 w-full rounded-xl border border-[#dfe3e6] bg-[#f9fafb] pl-10 pr-3 text-xs outline-none focus:border-[#a6b5b1]" /></div>
        <div className="ml-auto flex items-center gap-3"><span className="hidden items-center gap-1.5 rounded-full bg-[#e7f3ee] px-3 py-1.5 text-[10px] font-semibold text-[#2d6d5b] sm:flex"><span className="size-1.5 rounded-full bg-[#2d8c6f]" /> Sistem sağlıklı</span><button aria-label="Profil" className="grid size-9 place-items-center rounded-full bg-[#e8e2de] text-xs font-semibold"><UserRound className="size-4" /></button></div>
      </header>

      <div className="mx-auto max-w-[1440px] px-4 pb-14 pt-7 sm:px-7">
        <div className="flex items-end justify-between"><div><p className="text-xs font-semibold text-[#a24b5b]">31 Ağustos 2026</p><h1 className="mt-1 text-[26px] font-bold tracking-[-0.025em]">Genel bakış</h1><p className="mt-1 text-xs text-[#737b7f]">Davetly&apos;de bugün neler oluyor?</p></div><Button variant="outline" className="hidden h-9 bg-white sm:inline-flex"><BarChart3 /> Raporu indir</Button></div>

        <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <AdminMetric label="Toplam kullanıcı" value="2.842" note="bu ay +184" icon={Users} tone="bg-[#e6eff7] text-[#3d6d96]" />
          <AdminMetric label="Yayındaki davetiye" value="1.126" note="bugün +23" icon={Heart} tone="bg-[#f6e7ea] text-[#a0495b]" />
          <AdminMetric label="Aylık gelir" value="₺184,6K" note="geçen aya göre %12" icon={CircleDollarSign} tone="bg-[#e3f1eb] text-[#2d735f]" />
          <AdminMetric label="Saklanan video" value="1.126" note="bugün +23 yükleme" icon={Film} tone="bg-[#f6ecdd] text-[#9a6733]" />
        </div>

        <ActivationCodeIssuer />

        <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1.4fr)_minmax(330px,.72fr)]">
          <section className="rounded-2xl border border-[#e1e5e8] bg-white p-5 shadow-[0_8px_28px_rgba(27,37,34,.04)]">
            <div className="flex items-start justify-between"><div><h2 className="text-sm font-bold">Platform büyümesi</h2><p className="mt-1 text-[11px] text-[#7c8589]">Son 7 günde yeni davetiye ve yanıtlar</p></div><Badge variant="outline" className="text-[9px]">Son 7 gün</Badge></div>
            <div className="mt-6 flex h-[170px] items-end gap-3 border-b border-[#e5e8ea] px-2">
              {[42, 56, 48, 72, 64, 83, 92].map((height) => <div key={height} className="flex h-full flex-1 items-end justify-center gap-1"><div className="w-[38%] rounded-t bg-[#b76372]" style={{ height: `${height}%` }} /><div className="w-[38%] rounded-t bg-[#cadbd5]" style={{ height: `${Math.max(24, height - 18)}%` }} /></div>)}
            </div>
            <div className="mt-2 grid grid-cols-7 text-center text-[9px] text-[#899195]">{['Pzt','Sal','Çar','Per','Cum','Cmt','Paz'].map((day) => <span key={day}>{day}</span>)}</div>
            <div className="mt-5 flex gap-5 text-[10px] text-[#687175]"><span className="flex items-center gap-1.5"><i className="size-2 rounded-full bg-[#b76372]" /> Yeni davetiye</span><span className="flex items-center gap-1.5"><i className="size-2 rounded-full bg-[#cadbd5]" /> RSVP yanıtı</span><span className="ml-auto flex items-center gap-1 text-[#2e765f]"><TrendingUp className="size-3" /> %18 büyüme</span></div>
          </section>

          <section className="rounded-2xl border border-[#e1e5e8] bg-white p-5 shadow-[0_8px_28px_rgba(27,37,34,.04)]">
            <div className="flex items-start justify-between"><div><h2 className="text-sm font-bold">Video yükleme ve sunum</h2><p className="mt-1 text-[11px] text-[#7c8589]">Hazır videoların depolama ve yayın durumu</p></div><a href="#" className="text-[10px] font-semibold text-[#a24b5b]">Tümünü gör</a></div>
            <div className="mt-5 space-y-5">{jobs.map((job) => <div key={job.title}><div className="flex items-start gap-3"><span className="grid size-9 shrink-0 place-items-center rounded-xl bg-[#f0f2f3] text-[#53615d]"><Film className="size-4" /></span><div className="min-w-0 flex-1"><div className="flex justify-between gap-2"><p className="truncate text-xs font-semibold">{job.title}</p><span className="text-[9px] font-semibold text-[#6b7477]">{job.status}</span></div><p className="mt-0.5 text-[9px] text-[#92999c]">{job.type}</p><div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[#edf0f1]"><div className={`h-full rounded-full ${job.tone}`} style={{ width: `${job.progress}%` }} /></div></div></div></div>)}</div>
          </section>
        </div>

        <section className="mt-5 overflow-hidden rounded-2xl border border-[#e1e5e8] bg-white shadow-[0_8px_28px_rgba(27,37,34,.04)]">
          <div className="flex items-center justify-between border-b border-[#e8ebed] px-5 py-4"><div><h2 className="text-sm font-bold">Yeni kullanıcılar</h2><p className="mt-1 text-[10px] text-[#7f878b]">Son kayıt olan hesaplar</p></div><Button variant="outline" size="sm">Tüm kullanıcılar</Button></div>
          <div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left text-xs"><thead className="bg-[#f8f9fa] text-[9px] font-semibold uppercase tracking-[0.08em] text-[#899195]"><tr><th className="px-5 py-3">Kullanıcı</th><th className="px-5 py-3">Paket</th><th className="px-5 py-3">Davetiye</th><th className="px-5 py-3">Durum</th><th className="px-5 py-3">Kayıt</th><th className="w-12 px-3" /></tr></thead><tbody className="divide-y divide-[#edf0f1]">{users.map((user) => <tr key={user.email} className="hover:bg-[#fafbfb]"><td className="px-5 py-3.5"><div className="flex items-center gap-3"><span className="grid size-8 place-items-center rounded-full bg-[#eee5e1] text-[9px] font-bold text-[#78534d]">{user.name.split(' ').map((part) => part[0]).join('')}</span><div><p className="text-xs font-semibold">{user.name}</p><p className="text-[9px] text-[#8d9598]">{user.email}</p></div></div></td><td className="px-5 py-3.5"><Badge variant="secondary" className={user.plan === 'Plus' ? 'bg-[#f5e6ea] text-[#9c4657]' : 'bg-[#eef0f1] text-[#687276]'}>{user.plan === 'Plus' && <Sparkles className="size-3" />}{user.plan}</Badge></td><td className="px-5 py-3.5 font-semibold">{user.invites}</td><td className="px-5 py-3.5"><span className={`inline-flex items-center gap-1.5 ${user.status === 'Aktif' ? 'text-[#2f745f]' : 'text-[#9b6632]'}`}>{user.status === 'Aktif' ? <CheckCircle2 className="size-3.5" /> : <Clock3 className="size-3.5" />}{user.status}</span></td><td className="px-5 py-3.5 text-[#7f878b]">{user.joined}</td><td className="px-3"><button aria-label={`${user.name} işlemleri`} className="grid size-8 place-items-center rounded-lg hover:bg-[#f1f3f4]"><MoreHorizontal className="size-4" /></button></td></tr>)}</tbody></table></div>
        </section>
      </div>
    </main>
  );
}

function AdminMetric({ label, value, note, icon: Icon, tone }: { label: string; value: string; note: string; icon: typeof Users; tone: string }) {
  return <div className="rounded-2xl border border-[#e1e5e8] bg-white p-4 shadow-[0_8px_25px_rgba(27,37,34,.035)]"><div className="flex items-start justify-between"><span className={`grid size-9 place-items-center rounded-xl ${tone}`}><Icon className="size-[17px]" /></span><Badge variant="secondary" className="bg-[#edf4f1] text-[9px] text-[#37725f]">Canlı</Badge></div><strong className="mt-4 block text-[24px] font-bold tracking-[-0.03em]">{value}</strong><p className="mt-1 text-[11px] font-semibold">{label}</p><p className="mt-1 text-[9px] text-[#8a9296]">{note}</p></div>;
}
