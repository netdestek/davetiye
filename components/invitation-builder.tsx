'use client';

import { useEffect, useState } from 'react';
import {
  ArrowLeft, ArrowRight, CalendarDays, Check, CheckCircle2, Clock3, Copy,
  FileAudio, Film, Heart, LayoutTemplate, Link2, LoaderCircle, MapPin,
  Music2, Palette, Play, Send, Sparkles, Upload, Users, WandSparkles,
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

const steps = [
  { label: 'Şablon', icon: LayoutTemplate },
  { label: 'Bilgiler', icon: CalendarDays },
  { label: 'Video & ses', icon: Film },
  { label: 'Ön izle', icon: Sparkles },
];

const templates = [
  { id: 'botanical', name: 'Botanik Akşam', colors: 'from-[#6d3041] via-[#403a3e] to-[#263f3a]', label: 'Popüler' },
  { id: 'ivory', name: 'Zamansız Krem', colors: 'from-[#eee2d5] via-[#f9f5ee] to-[#cdb4a4]', label: 'Sade' },
  { id: 'midnight', name: 'Gece Işıltısı', colors: 'from-[#202d3b] via-[#253951] to-[#9a7451]', label: 'Yeni' },
];

type PublishResult = { url?: string; error?: string };

export function InvitationBuilder({
  isSignedIn,
  displayName,
  signInPath,
}: {
  isSignedIn: boolean;
  displayName: string | null;
  signInPath: string;
}) {
  const [step, setStep] = useState(1);
  const [template, setTemplate] = useState('botanical');
  const [hostNames, setHostNames] = useState('Elif & Arda');
  const [eventAt, setEventAt] = useState('2026-09-12T19:30');
  const [venueName, setVenueName] = useState('Liva Davet');
  const [venueAddress, setVenueAddress] = useState('Polonezköy, Beykoz / İstanbul');
  const [description, setDescription] = useState('Bu güzel günümüzde sizi de aramızda görmekten mutluluk duyarız.');
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [videoUrl, setVideoUrl] = useState('');
  const [publishing, setPublishing] = useState(false);
  const [publishError, setPublishError] = useState('');
  const [shareUrl, setShareUrl] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!videoFile) { setVideoUrl(''); return; }
    const objectUrl = URL.createObjectURL(videoFile);
    setVideoUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [videoFile]);

  const selectedTemplate = templates.find((item) => item.id === template) ?? templates[0];

  async function upload(file: File | null) {
    if (!file) return undefined;
    const form = new FormData();
    form.append('file', file);
    const response = await fetch('/api/uploads', { method: 'POST', body: form });
    const result = await response.json() as { key?: string; error?: string };
    if (!response.ok || !result.key) throw new Error(result.error || 'Dosya yüklenemedi.');
    return result.key;
  }

  async function publish() {
    if (!isSignedIn) {
      setPublishError('Yayınlamak ve dosyaları güvenle saklamak için giriş yapmalısınız.');
      return;
    }
    setPublishing(true);
    setPublishError('');
    try {
      const [videoKey, audioKey] = await Promise.all([upload(videoFile), upload(audioFile)]);
      const response = await fetch('/api/invitations', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ hostNames, eventAt, venueName, venueAddress, description, videoKey, audioKey }),
      });
      const result = await response.json() as PublishResult;
      if (!response.ok || !result.url) throw new Error(result.error || 'Davetiye yayınlanamadı.');
      setShareUrl(result.url);
    } catch (cause) {
      setPublishError(cause instanceof Error ? cause.message : 'Bir sorun oluştu.');
    } finally {
      setPublishing(false);
    }
  }

  async function copyLink() {
    if (!shareUrl) return;
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  function goNext() {
    setPublishError('');
    if (step === 2 && (!hostNames.trim() || !eventAt)) {
      setPublishError('Etkinlik adı ve tarihi zorunludur.');
      return;
    }
    setStep((current) => Math.min(4, current + 1));
  }

  return (
    <main className="min-h-screen bg-[#f8f4ef] text-foreground">
      <header className="flex h-[72px] items-center border-b border-[#eadfd8] bg-[#fffdfa] px-4 sm:px-7">
        <a href="/" className="flex items-center gap-2.5" aria-label="Panele dön">
          <span className="grid size-9 place-items-center rounded-xl bg-primary text-white"><Heart className="size-4 fill-current" /></span>
          <span className="font-heading text-[21px] font-semibold">davetly</span>
        </a>
        <div className="ml-5 hidden h-7 w-px bg-[#eadfd8] sm:block" />
        <p className="ml-5 hidden text-sm font-medium text-[#665b57] sm:block">Yeni davetiye</p>
        <div className="ml-auto flex items-center gap-3">
          {isSignedIn ? (
            <Badge variant="secondary" className="bg-[#e4f0eb] text-[#2a6657]"><Check className="size-3" /> {displayName?.split(' ')[0] ?? 'Oturum açık'}</Badge>
          ) : (
            <a href={signInPath} target="_top" className="text-xs font-semibold text-primary">Giriş yap</a>
          )}
          <Button nativeButton={false} render={<a href="/" />} variant="outline" className="hidden h-9 sm:inline-flex"><ArrowLeft /> Panele dön</Button>
        </div>
      </header>

      <div className="border-b border-[#eadfd8] bg-white px-4 sm:px-7">
        <ol className="mx-auto flex h-[74px] max-w-[1020px] items-center justify-between" aria-label="Davetiye oluşturma adımları">
          {steps.map((item, index) => {
            const number = index + 1;
            const active = number === step;
            const complete = number < step;
            return (
              <li key={item.label} className={`flex items-center gap-2 ${number > 1 ? 'flex-1' : ''}`}>
                {number > 1 && <span className={`mx-2 hidden h-px flex-1 sm:block ${complete || active ? 'bg-[#c68a94]' : 'bg-[#e7dcd6]'}`} />}
                <button type="button" onClick={() => number <= step && setStep(number)} className="flex items-center gap-2" aria-current={active ? 'step' : undefined}>
                  <span className={`grid size-8 place-items-center rounded-full border text-xs font-semibold transition ${active ? 'border-primary bg-primary text-white' : complete ? 'border-[#b36a78] bg-[#f6e8e9] text-primary' : 'border-[#dfd4ce] bg-white text-[#978b87]'}`}>
                    {complete ? <Check className="size-4" /> : number}
                  </span>
                  <span className={`hidden text-xs font-semibold md:block ${active ? 'text-primary' : 'text-[#8a7e7a]'}`}>{item.label}</span>
                </button>
              </li>
            );
          })}
        </ol>
      </div>

      <div className="mx-auto grid max-w-[1220px] gap-6 px-4 py-6 sm:px-7 lg:grid-cols-[minmax(0,1fr)_390px] lg:py-9">
        <section className="rounded-[22px] border border-[#eadfd8] bg-[#fffdfa] p-5 shadow-[0_12px_38px_rgba(70,45,38,.06)] sm:p-7">
          {step === 1 && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">1. adım</p>
              <h1 className="mt-2 font-heading text-[29px] font-semibold tracking-[-0.03em]">Hikâyene yakışan şablonu seç</h1>
              <p className="mt-2 text-sm text-muted-foreground">Tüm metinleri, renkleri ve müziği sonraki adımlarda değiştirebilirsin.</p>
              <div className="mt-7 grid gap-4 sm:grid-cols-3">
                {templates.map((item) => (
                  <button key={item.id} type="button" onClick={() => setTemplate(item.id)} className={`overflow-hidden rounded-[18px] border-2 bg-white text-left transition hover:-translate-y-0.5 ${template === item.id ? 'border-primary shadow-[0_12px_30px_rgba(133,48,68,.12)]' : 'border-transparent ring-1 ring-[#e7dcd6]'}`}>
                    <div className={`relative aspect-[4/5] bg-gradient-to-br ${item.colors}`}>
                      <div className="absolute inset-0 grid place-items-center px-3 text-center"><div><p className="font-heading text-xl italic text-white/95">Elif & Arda</p><p className="mt-2 text-[8px] uppercase tracking-[0.22em] text-white/60">12 · 09 · 2026</p></div></div>
                      {template === item.id && <span className="absolute right-2 top-2 grid size-7 place-items-center rounded-full bg-white text-primary shadow"><Check className="size-4" /></span>}
                    </div>
                    <div className="flex items-center justify-between p-3"><span className="text-xs font-semibold">{item.name}</span><Badge variant="secondary" className="text-[9px]">{item.label}</Badge></div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {step === 2 && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">2. adım</p>
              <h1 className="mt-2 font-heading text-[29px] font-semibold tracking-[-0.03em]">Davetinin ayrıntılarını ekle</h1>
              <p className="mt-2 text-sm text-muted-foreground">Davetliler bu bilgileri videonun hemen altında görecek.</p>
              <div className="mt-7 grid gap-5 sm:grid-cols-2">
                <Field label="Etkinlik sahibi / başlık" icon={Users} wide><Input value={hostNames} onChange={(e) => setHostNames(e.target.value)} className="h-11 rounded-xl bg-white px-3" /></Field>
                <Field label="Tarih ve saat" icon={CalendarDays}><Input type="datetime-local" value={eventAt} onChange={(e) => setEventAt(e.target.value)} className="h-11 rounded-xl bg-white px-3" /></Field>
                <Field label="Mekân adı" icon={MapPin}><Input value={venueName} onChange={(e) => setVenueName(e.target.value)} className="h-11 rounded-xl bg-white px-3" /></Field>
                <Field label="Açık adres" icon={MapPin} wide><Input value={venueAddress} onChange={(e) => setVenueAddress(e.target.value)} className="h-11 rounded-xl bg-white px-3" /></Field>
                <Field label="Davet mesajı" icon={WandSparkles} wide><Textarea value={description} onChange={(e) => setDescription(e.target.value)} maxLength={300} className="min-h-28 resize-none rounded-xl bg-white px-3 py-3" /><p className="mt-1.5 text-right text-[10px] text-muted-foreground">{description.length}/300</p></Field>
              </div>
            </div>
          )}

          {step === 3 && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">3. adım</p>
              <h1 className="mt-2 font-heading text-[29px] font-semibold tracking-[-0.03em]">Videonu ve müziğini ekle</h1>
              <p className="mt-2 text-sm text-muted-foreground">Hazır şablonu kullanabilir veya kendi dosyalarını yükleyebilirsin.</p>
              <div className="mt-7 space-y-4">
                <UploadBox title="Davetiye videosu" description="MP4 veya WebM · En fazla 25 MB" icon={Film} file={videoFile} accept="video/mp4,video/webm" onFile={setVideoFile} />
                <UploadBox title="Müzik veya ses kaydı" description="MP3, M4A veya WAV · En fazla 25 MB" icon={FileAudio} file={audioFile} accept="audio/mpeg,audio/mp4,audio/wav" onFile={setAudioFile} />
              </div>
              <div className="mt-5 flex items-start gap-3 rounded-2xl bg-[#f1eee8] p-4 text-xs leading-5 text-[#6e645f]"><Clock3 className="mt-0.5 size-4 shrink-0 text-primary" /><p>Video, yayınlama sırasında güvenli depolamaya yüklenir. Üretim sürümünde FFmpeg iş kuyruğu metin ve sesi videoya arka planda işler; taslağın bu sırada kaybolmaz.</p></div>
            </div>
          )}

          {step === 4 && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">4. adım</p>
              <h1 className="mt-2 font-heading text-[29px] font-semibold tracking-[-0.03em]">Son bir kez kontrol et</h1>
              <p className="mt-2 text-sm text-muted-foreground">Hazır olduğunda yayınla; paylaşım bağlantın hemen oluşsun.</p>
              {!shareUrl ? (
                <div className="mt-7 space-y-3">
                  <ReviewRow icon={LayoutTemplate} label="Şablon" value={selectedTemplate.name} />
                  <ReviewRow icon={Users} label="Etkinlik" value={hostNames} />
                  <ReviewRow icon={CalendarDays} label="Tarih" value={new Date(eventAt).toLocaleString('tr-TR', { dateStyle: 'long', timeStyle: 'short' })} />
                  <ReviewRow icon={MapPin} label="Mekân" value={`${venueName} · ${venueAddress}`} />
                  <ReviewRow icon={Film} label="Medya" value={`${videoFile ? videoFile.name : 'Hazır şablon videosu'}${audioFile ? ` · ${audioFile.name}` : ''}`} />
                  {!isSignedIn && <div className="rounded-2xl border border-[#ead0ce] bg-[#fbefed] p-4 text-xs leading-5 text-[#79434b]">Davetiye verilerini ve dosyalarını yalnızca size ait tutabilmek için yayınlamadan önce <a href={signInPath} target="_top" className="font-bold underline underline-offset-2">giriş yapın</a>.</div>}
                  {publishError && <p className="rounded-xl bg-[#f9e9e8] px-3 py-2.5 text-xs font-medium text-[#963f4c]" role="alert">{publishError}</p>}
                  <Button onClick={publish} disabled={publishing} className="h-12 w-full rounded-xl text-sm shadow-[0_12px_28px_rgba(133,48,68,.2)]">
                    {publishing ? <><LoaderCircle className="animate-spin" /> Yükleniyor ve yayınlanıyor…</> : <><Sparkles /> Yayınla ve paylaş</>}
                  </Button>
                </div>
              ) : (
                <div className="mt-7 rounded-[22px] border border-[#cce0d8] bg-[#eff7f4] p-6 text-center">
                  <CheckCircle2 className="mx-auto size-11 text-[#2c705d]" />
                  <h2 className="mt-3 font-heading text-2xl font-semibold text-[#264a41]">Davetiye bağlantın hazır</h2>
                  <p className="mt-1 text-xs text-[#5d756e]">Bu bağlantıya sahip herkes davetiyeyi görüntüleyebilir.</p>
                  <div className="mt-5 flex items-center gap-2 rounded-xl border border-[#c9ddd5] bg-white p-2 pl-3 text-left"><Link2 className="size-4 shrink-0 text-[#48786b]" /><span className="min-w-0 flex-1 truncate text-xs">{shareUrl}</span><Button type="button" variant="secondary" size="sm" onClick={copyLink}>{copied ? <Check /> : <Copy />}{copied ? 'Kopyalandı' : 'Kopyala'}</Button></div>
                  <Button nativeButton={false} render={<a href={`https://wa.me/?text=${encodeURIComponent(`${hostNames} davetiyesini görüntülemek için: ${shareUrl}`)}`} target="_blank" rel="noreferrer" />} className="mt-3 h-11 w-full bg-[#257c5b] hover:bg-[#1f6a4e]"><Send /> WhatsApp&apos;ta paylaş</Button>
                </div>
              )}
            </div>
          )}

          {!shareUrl && (
            <div className="mt-8 flex items-center justify-between border-t border-[#eee5df] pt-5">
              <Button type="button" variant="ghost" disabled={step === 1} onClick={() => setStep((current) => Math.max(1, current - 1))}><ArrowLeft /> Geri</Button>
              {step < 4 && <Button type="button" className="h-10 px-4" onClick={goNext}>Devam et <ArrowRight /></Button>}
            </div>
          )}
        </section>

        <aside className="lg:sticky lg:top-6 lg:self-start">
          <div className="mb-3 flex items-center justify-between"><p className="text-xs font-semibold text-[#655a56]">Canlı ön izleme</p><Badge variant="outline" className="bg-white text-[10px]"><Palette className="size-3" /> {selectedTemplate.name}</Badge></div>
          <div className="mx-auto w-full max-w-[360px] rounded-[30px] border-[7px] border-[#2e2929] bg-[#2e2929] p-1 shadow-[0_28px_75px_rgba(40,29,28,.22)]">
            <div className={`relative aspect-[9/16] overflow-hidden rounded-[21px] bg-gradient-to-br ${selectedTemplate.colors} text-white`}>
              {videoUrl && <video src={videoUrl} muted loop autoPlay playsInline className="absolute inset-0 size-full object-cover opacity-65" />}
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_25%_15%,rgba(255,255,255,.18),transparent_24%),linear-gradient(to_top,rgba(25,20,21,.55),transparent_55%)]" />
              <div className="absolute left-1/2 top-3 h-4 w-16 -translate-x-1/2 rounded-full bg-black/65" />
              <div className="relative flex h-full flex-col items-center justify-center px-5 text-center">
                <button type="button" aria-label="Videoyu oynat" className="mb-5 grid size-12 place-items-center rounded-full border border-white/35 bg-white/12 backdrop-blur"><Play className="ml-0.5 size-4 fill-white" /></button>
                <p className="text-[9px] font-semibold uppercase tracking-[0.28em] text-white/65">Birlikte bir ömre</p>
                <h2 className="mt-3 font-heading text-[30px] font-medium italic leading-tight">{hostNames || 'İsimleriniz'}</h2>
                <p className="mt-3 text-[10px] tracking-[0.16em] text-white/70">{eventAt ? new Date(eventAt).toLocaleDateString('tr-TR') : 'Tarih'}</p>
              </div>
              <div className="absolute inset-x-4 bottom-4 rounded-2xl border border-white/15 bg-black/18 p-3 text-[9px] backdrop-blur-md"><div className="flex items-center gap-2"><MapPin className="size-3" /><span className="truncate">{venueName || 'Mekân adı'}</span></div>{audioFile && <div className="mt-1.5 flex items-center gap-2 text-white/65"><Music2 className="size-3" /><span className="truncate">{audioFile.name}</span></div>}</div>
            </div>
          </div>
        </aside>
      </div>
    </main>
  );
}

function Field({ label, icon: Icon, wide, children }: { label: string; icon: typeof Users; wide?: boolean; children: React.ReactNode }) {
  return <label className={wide ? 'sm:col-span-2' : ''}><span className="mb-2 flex items-center gap-2 text-xs font-semibold text-[#554c49]"><Icon className="size-3.5 text-primary" />{label}</span>{children}</label>;
}

function UploadBox({ title, description, icon: Icon, file, accept, onFile }: { title: string; description: string; icon: typeof Film; file: File | null; accept: string; onFile: (file: File | null) => void }) {
  return (
    <label className={`flex cursor-pointer items-center gap-4 rounded-2xl border border-dashed p-5 transition hover:border-[#bf8891] hover:bg-[#fcf7f5] ${file ? 'border-[#8bb3a7] bg-[#f1f7f4]' : 'border-[#d9cac3] bg-white'}`}>
      <span className={`grid size-12 shrink-0 place-items-center rounded-2xl ${file ? 'bg-[#dcece6] text-[#2c6b5a]' : 'bg-[#f6ebe8] text-primary'}`}>{file ? <Check className="size-5" /> : <Icon className="size-5" />}</span>
      <span className="min-w-0 flex-1"><span className="block text-sm font-semibold">{title}</span><span className="mt-1 block truncate text-xs text-muted-foreground">{file ? file.name : description}</span></span>
      <span className="hidden items-center gap-1.5 rounded-lg border border-[#dfd2cc] bg-white px-3 py-2 text-xs font-semibold sm:flex"><Upload className="size-3.5" /> Seç</span>
      <input type="file" accept={accept} className="sr-only" onChange={(event) => onFile(event.target.files?.[0] ?? null)} />
    </label>
  );
}

function ReviewRow({ icon: Icon, label, value }: { icon: typeof Users; label: string; value: string }) {
  return <div className="flex items-start gap-3 rounded-2xl border border-[#eadfd8] bg-white p-4"><span className="grid size-9 shrink-0 place-items-center rounded-xl bg-[#f6ebe8] text-primary"><Icon className="size-4" /></span><div className="min-w-0"><p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">{label}</p><p className="mt-1 text-sm font-semibold leading-5">{value}</p></div></div>;
}
