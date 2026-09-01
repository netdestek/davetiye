'use client';

import { useEffect, useMemo, useState, type SyntheticEvent } from 'react';
import type { LucideIcon } from 'lucide-react';
import Link from 'next/link';
import {
  ArrowLeft, ArrowRight, CalendarDays, Check, CheckCircle2, Copy, Film,
  Heart, KeyRound, Link2, LoaderCircle, MapPin, Play, Send, ShieldCheck,
  Sparkles, Users, WandSparkles,
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button, buttonVariants } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  EVENT_TIME_ZONE,
  normalizeEventDateTime,
  parseStoredEventDateTime,
} from '@/lib/event-time';

const steps = [
  { label: 'Bilgiler', icon: CalendarDays },
  { label: 'Video', icon: Film },
  { label: 'Ön izle', icon: Sparkles },
];

const ACTIVATION_CODE_PATTERN = /^WED-[0-9A-HJKMNP-TV-Z]{4}-[0-9A-HJKMNP-TV-Z]{4}-[0-9A-HJKMNP-TV-Z]{4}$/;

type PublishResult = { url?: string; error?: string };

type CatalogVideo = {
  id: string;
  title: string;
  contentType: string;
  sizeBytes: number;
  previewUrl: string;
};

type VideoCatalogResult = {
  videos?: CatalogVideo[];
  error?: string;
};

type CodeValidationResult = {
  ok?: boolean;
  error?: string;
};

function formatActivationCode(value: string) {
  const characters = value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 15);
  const groups = [
    characters.slice(0, 3),
    characters.slice(3, 7),
    characters.slice(7, 11),
    characters.slice(11, 15),
  ].filter(Boolean);
  return groups.join('-');
}

function describeCodeValidationError(status: number, error?: string) {
  const detail = error?.toLocaleLowerCase('tr-TR') ?? '';
  if (status === 409 || /used|already|redeemed|consumed|kullanılmış|kullanıldı|kullanildi|tüket/.test(detail)) {
    return 'Bu kod daha önce kullanılmış. Her aktivasyon kodu yalnızca bir davetiye için geçerlidir.';
  }
  if (status === 400 || status === 404 || /invalid|not found|geçersiz|bulunam/.test(detail)) {
    return 'Bu aktivasyon kodu geçersiz. PDF dosyanızdaki kodu kontrol edip tekrar deneyin.';
  }
  return 'Kod şu anda doğrulanamadı. Lütfen PDF dosyanızdaki kodu kontrol edip tekrar deneyin.';
}

async function readJson<T>(response: Response): Promise<T | null> {
  try {
    return await response.json() as T;
  } catch {
    return null;
  }
}

export function InvitationBuilder() {
  const [step, setStep] = useState(1);
  const [hostNames, setHostNames] = useState('Elif & Arda');
  const [eventAt, setEventAt] = useState('2026-09-12T19:30');
  const [venueName, setVenueName] = useState('Liva Davet');
  const [venueAddress, setVenueAddress] = useState('Polonezköy, Beykoz / İstanbul');
  const [description, setDescription] = useState('Bu güzel günümüzde sizi de aramızda görmekten mutluluk duyarız.');
  const [videos, setVideos] = useState<CatalogVideo[]>([]);
  const [selectedVideoId, setSelectedVideoId] = useState('');
  const [videosLoading, setVideosLoading] = useState(false);
  const [videosError, setVideosError] = useState('');
  const [catalogRequest, setCatalogRequest] = useState(0);
  const [publishing, setPublishing] = useState(false);
  const [publishError, setPublishError] = useState('');
  const [shareUrl, setShareUrl] = useState('');
  const [copied, setCopied] = useState(false);
  const [activationCode, setActivationCode] = useState('');
  const [activationApproved, setActivationApproved] = useState(false);
  const [validatingCode, setValidatingCode] = useState(false);
  const [activationError, setActivationError] = useState('');

  const selectedVideo = useMemo(
    () => videos.find((video) => video.id === selectedVideoId) ?? null,
    [selectedVideoId, videos],
  );
  const eventPreviewLabel = useMemo(() => {
    const date = parseStoredEventDateTime(eventAt);
    return date
      ? new Intl.DateTimeFormat('tr-TR', {
          dateStyle: 'long', timeStyle: 'short', timeZone: EVENT_TIME_ZONE,
        }).format(date)
      : 'Geçersiz tarih';
  }, [eventAt]);

  useEffect(() => {
    if (!activationApproved) return;
    let cancelled = false;
    setVideosLoading(true);
    setVideosError('');

    fetch('/api/videos', { cache: 'no-store' })
      .then(async (response) => {
        const result = await readJson<VideoCatalogResult>(response);
        if (!response.ok || !result?.videos) {
          throw new Error(result?.error || 'Video listesi alınamadı.');
        }
        if (cancelled) return;
        setVideos(result.videos);
        setSelectedVideoId((current) => (
          current && result.videos?.some((video) => video.id === current)
            ? current
            : result.videos?.[0]?.id ?? ''
        ));
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setVideos([]);
          setSelectedVideoId('');
          setVideosError(error instanceof Error ? error.message : 'Video listesi alınamadı.');
        }
      })
      .finally(() => {
        if (!cancelled) setVideosLoading(false);
      });

    return () => { cancelled = true; };
  }, [activationApproved, catalogRequest]);

  function updateActivationCode(value: string) {
    setActivationCode(formatActivationCode(value));
    setActivationError('');
  }

  async function validateActivationCode(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    const code = formatActivationCode(activationCode);
    setActivationCode(code);
    setActivationError('');

    if (!ACTIVATION_CODE_PATTERN.test(code)) {
      setActivationError('Lütfen PDF dosyanızdaki kodu WED-XXXX-XXXX-XXXX biçiminde girin.');
      return;
    }

    setValidatingCode(true);
    try {
      const response = await fetch('/api/codes/validate', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ code }),
      });
      const result = await readJson<CodeValidationResult>(response);

      if (!response.ok || !result?.ok) {
        setActivationError(describeCodeValidationError(response.status, result?.error));
        return;
      }

      // The server keeps the opaque activation lease in an HttpOnly cookie.
      setActivationApproved(true);
    } catch {
      setActivationError('Kod doğrulanırken bağlantı kurulamadı. Lütfen tekrar deneyin.');
    } finally {
      setValidatingCode(false);
    }
  }

  async function publish() {
    if (!activationApproved) {
      setPublishError('Davetiyeyi oluşturmadan önce aktivasyon kodunuzu doğrulayın.');
      return;
    }
    if (!selectedVideoId) {
      setPublishError('Yayınlamadan önce listeden bir video seçin.');
      return;
    }

    setPublishing(true);
    setPublishError('');
    try {
      let response: Response;
      try {
        response = await fetch('/api/invitations', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            hostNames,
            eventAt,
            venueName,
            venueAddress,
            description,
            videoId: selectedVideoId,
          }),
        });
      } catch {
        throw new Error('Davetiye yayınlandı mı doğrulanamadı. Tekrar denemeden önce davetiyelerinizi kontrol edin.');
      }
      const result = await readJson<PublishResult>(response);
      if (!response.ok || !result?.url) {
        throw new Error(result?.error || 'Davetiye yayınlanamadı.');
      }
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
    if (step === 1) {
      const validDate = Boolean(normalizeEventDateTime(eventAt));
      if (hostNames.trim().length < 2 || hostNames.trim().length > 120 || !validDate ||
          venueName.trim().length < 2 || venueName.trim().length > 160 ||
          venueAddress.trim().length > 300 || description.trim().length > 300) {
        setPublishError('Etkinlik adı, tarihi ve mekân bilgilerini kontrol edin.');
        return;
      }
    }
    if (step === 2 && !selectedVideoId) {
      setPublishError('Devam etmek için listeden bir davetiye videosu seçin.');
      return;
    }
    setStep((current) => Math.min(3, current + 1));
  }

  return (
    <main className="min-h-screen bg-[#f8f4ef] text-foreground">
      <header className="flex h-[72px] items-center border-b border-[#eadfd8] bg-[#fffdfa] px-4 sm:px-7">
        <Link href="/" className="flex items-center gap-2.5" aria-label="Panele dön">
          <span className="grid size-9 place-items-center rounded-xl bg-primary text-white"><Heart className="size-4 fill-current" /></span>
          <span className="font-heading text-[21px] font-semibold">davetly</span>
        </Link>
        <div className="ml-5 hidden h-7 w-px bg-[#eadfd8] sm:block" />
        <p className="ml-5 hidden text-sm font-medium text-[#665b57] sm:block">Yeni davetiye</p>
        <div className="ml-auto flex items-center gap-3">
          {activationApproved && <Badge variant="secondary" className="hidden bg-[#e4f0eb] text-[#2a6657] sm:inline-flex"><ShieldCheck className="size-3" /> Kod onaylandı</Badge>}
          <Link href="/" className={buttonVariants({ variant: 'outline', className: 'hidden h-9 sm:inline-flex' })}><ArrowLeft /> Panele dön</Link>
        </div>
      </header>

      {!activationApproved ? (
        <ActivationCodeGate
          code={activationCode}
          error={activationError}
          isValidating={validatingCode}
          onCodeChange={updateActivationCode}
          onSubmit={validateActivationCode}
        />
      ) : (
        <>
      <div className="border-b border-[#eadfd8] bg-white px-4 sm:px-7">
        <ol className="mx-auto flex h-[74px] max-w-[760px] items-center justify-between" aria-label="Davetiye oluşturma adımları">
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
                  <span className={`hidden text-xs font-semibold sm:block ${active ? 'text-primary' : 'text-[#8a7e7a]'}`}>{item.label}</span>
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
              <h1 className="mt-2 font-heading text-[29px] font-semibold tracking-[-0.03em]">Davetinin ayrıntılarını ekle</h1>
              <p className="mt-2 text-sm text-muted-foreground">Davetliler bu bilgileri videonun hemen altında görecek.</p>
              <div className="mt-7 grid gap-5 sm:grid-cols-2">
                <Field label="Etkinlik sahibi / başlık" icon={Users} wide><Input value={hostNames} maxLength={120} onChange={(event) => setHostNames(event.target.value)} className="h-11 rounded-xl bg-white px-3" /></Field>
                <Field label="Tarih ve saat" icon={CalendarDays}><Input type="datetime-local" value={eventAt} onChange={(event) => setEventAt(event.target.value)} className="h-11 rounded-xl bg-white px-3" /></Field>
                <Field label="Mekân adı" icon={MapPin}><Input value={venueName} maxLength={160} onChange={(event) => setVenueName(event.target.value)} className="h-11 rounded-xl bg-white px-3" /></Field>
                <Field label="Açık adres" icon={MapPin} wide><Input value={venueAddress} maxLength={300} onChange={(event) => setVenueAddress(event.target.value)} className="h-11 rounded-xl bg-white px-3" /></Field>
                <Field label="Davet mesajı" icon={WandSparkles} wide><Textarea value={description} onChange={(event) => setDescription(event.target.value)} maxLength={300} className="min-h-28 resize-none rounded-xl bg-white px-3 py-3" /><p className="mt-1.5 text-right text-[10px] text-muted-foreground">{description.length}/300</p></Field>
              </div>
            </div>
          )}

          {step === 2 && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">2. adım</p>
              <h1 className="mt-2 font-heading text-[29px] font-semibold tracking-[-0.03em]">Davetiye videonu seç</h1>
              <p className="mt-2 text-sm text-muted-foreground">Yönetici tarafından hazırlanan videolardan birini seç. Seçimin canlı ön izlemede hemen görünür.</p>
              <div className="mt-7">
                {videosLoading ? (
                  <div className="flex min-h-40 items-center justify-center rounded-2xl border border-[#eadfd8] bg-white text-sm text-muted-foreground">
                    <LoaderCircle className="mr-2 size-4 animate-spin" /> Videolar yükleniyor
                  </div>
                ) : videosError ? (
                  <div className="rounded-2xl border border-[#efd2d0] bg-[#fdf3f2] p-5 text-center">
                    <p className="text-sm font-semibold text-[#963f4c]">{videosError}</p>
                    <Button type="button" variant="outline" size="sm" className="mt-3" onClick={() => setCatalogRequest((current) => current + 1)}>Tekrar dene</Button>
                  </div>
                ) : videos.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-[#d9cac3] bg-white p-7 text-center">
                    <span className="mx-auto grid size-12 place-items-center rounded-2xl bg-[#f6ebe8] text-primary"><Film className="size-5" /></span>
                    <p className="mt-3 text-sm font-semibold">Henüz seçilebilir video yok</p>
                    <p className="mt-1 text-xs leading-5 text-muted-foreground">Yönetici yeni bir video yayınladığında burada görünecek.</p>
                  </div>
                ) : (
                  <div className="grid gap-4 sm:grid-cols-2">
                    {videos.map((video) => {
                      const selected = video.id === selectedVideoId;
                      return (
                        <button
                          key={video.id}
                          type="button"
                          aria-pressed={selected}
                          onClick={() => { setSelectedVideoId(video.id); setPublishError(''); }}
                          className={`overflow-hidden rounded-2xl border bg-white text-left transition ${selected ? 'border-primary ring-2 ring-primary/15' : 'border-[#eadfd8] hover:border-[#caa0a7]'}`}
                        >
                          <span className="relative block aspect-video overflow-hidden bg-[#30282a]">
                            <video src={video.previewUrl} preload="metadata" muted playsInline className="size-full object-cover" />
                            <span className={`absolute right-3 top-3 grid size-7 place-items-center rounded-full border ${selected ? 'border-primary bg-primary text-white' : 'border-white/60 bg-black/30 text-transparent'}`}><Check className="size-4" /></span>
                            <span className="absolute left-3 top-3 rounded-full bg-black/50 px-2 py-1 text-[9px] font-semibold uppercase tracking-[0.08em] text-white">Hazır video</span>
                          </span>
                          <span className="flex items-center justify-between gap-3 p-4">
                            <span className="min-w-0 truncate text-sm font-semibold">{video.title}</span>
                            <span className="shrink-0 text-[10px] text-muted-foreground">{formatBytes(video.sizeBytes)}</span>
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
              <div className="mt-5 flex items-start gap-3 rounded-2xl bg-[#edf4f1] p-4 text-xs leading-5 text-[#526a63]"><ShieldCheck className="mt-0.5 size-4 shrink-0 text-[#2d6c5b]" /><p>Videolar yalnızca yönetici tarafından eklenir ve yayınlanır. Siz dosya yüklemeden güvenli katalogdan seçim yaparsınız.</p></div>
              {publishError && <p className="mt-4 rounded-xl bg-[#f9e9e8] px-3 py-2.5 text-xs font-medium text-[#963f4c]" role="alert">{publishError}</p>}
            </div>
          )}

          {step === 3 && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">3. adım</p>
              <h1 className="mt-2 font-heading text-[29px] font-semibold tracking-[-0.03em]">Son bir kez kontrol et</h1>
              <p className="mt-2 text-sm text-muted-foreground">Hazır olduğunda davetiyeyi yayınla ve paylaşım bağlantını oluştur.</p>
              {!shareUrl ? (
                <div className="mt-7 space-y-3">
                  <ReviewRow icon={Users} label="Etkinlik" value={hostNames} />
                  <ReviewRow icon={CalendarDays} label="Tarih" value={eventPreviewLabel} />
                  <ReviewRow icon={MapPin} label="Mekân" value={`${venueName} · ${venueAddress}`} />
                  <ReviewRow icon={Film} label="Hazır video" value={selectedVideo ? `${selectedVideo.title} · ${formatBytes(selectedVideo.sizeBytes)}` : 'Video seçilmedi'} />
                  {publishError && <p className="rounded-xl bg-[#f9e9e8] px-3 py-2.5 text-xs font-medium text-[#963f4c]" role="alert">{publishError}</p>}
                  <Button onClick={publish} disabled={publishing} className="h-12 w-full rounded-xl text-sm shadow-[0_12px_28px_rgba(133,48,68,.2)]">
                    {publishing ? <><LoaderCircle className="animate-spin" /> Davetiye yayınlanıyor</> : <><Sparkles /> Davetiyeyi yayınla</>}
                  </Button>
                </div>
              ) : (
                <div className="mt-7 rounded-[22px] border border-[#cce0d8] bg-[#eff7f4] p-6 text-center">
                  <CheckCircle2 className="mx-auto size-11 text-[#2c705d]" />
                  <h2 className="mt-3 font-heading text-2xl font-semibold text-[#264a41]">Davetiye bağlantın hazır</h2>
                  <p className="mt-1 text-xs text-[#5d756e]">Bu bağlantıya sahip herkes videolu davetiyeyi görüntüleyebilir.</p>
                  <div className="mt-5 flex items-center gap-2 rounded-xl border border-[#c9ddd5] bg-white p-2 pl-3 text-left"><Link2 className="size-4 shrink-0 text-[#48786b]" /><span className="min-w-0 flex-1 truncate text-xs">{shareUrl}</span><Button type="button" variant="secondary" size="sm" onClick={copyLink}>{copied ? <Check /> : <Copy />}{copied ? 'Kopyalandı' : 'Kopyala'}</Button></div>
                  <a href={`https://wa.me/?text=${encodeURIComponent(`${hostNames} davetiyesini görüntülemek için: ${shareUrl}`)}`} target="_blank" rel="noreferrer" className={buttonVariants({ className: 'mt-3 h-11 w-full bg-[#257c5b] hover:bg-[#1f6a4e]' })}><Send /> WhatsApp&apos;ta paylaş</a>
                </div>
              )}
            </div>
          )}

          {!shareUrl && (
            <div className="mt-8 flex items-center justify-between border-t border-[#eee5df] pt-5">
              <Button type="button" variant="ghost" disabled={step === 1 || publishing} onClick={() => setStep((current) => Math.max(1, current - 1))}><ArrowLeft /> Geri</Button>
              {step < 3 && <Button type="button" className="h-10 px-4" onClick={goNext}>Devam et <ArrowRight /></Button>}
            </div>
          )}
        </section>

        <aside className="lg:sticky lg:top-6 lg:self-start">
          <div className="mb-3 flex items-center justify-between"><p className="text-xs font-semibold text-[#655a56]">Canlı ön izleme</p><Badge variant="outline" className="bg-white text-[10px]"><Film className="size-3" /> Hazır video</Badge></div>
          <div className="mx-auto w-full max-w-[360px] rounded-[30px] border-[7px] border-[#2e2929] bg-[#2e2929] p-1 shadow-[0_28px_75px_rgba(40,29,28,.22)]">
            <div className="relative aspect-[9/16] overflow-hidden rounded-[21px] bg-gradient-to-br from-[#6d3041] via-[#403a3e] to-[#263f3a] text-white">
              {selectedVideo && (
                <video key={selectedVideo.previewUrl} src={selectedVideo.previewUrl} muted loop autoPlay playsInline className="absolute inset-0 size-full object-cover" />
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-transparent to-black/10" />
              <div className="absolute left-1/2 top-3 h-4 w-16 -translate-x-1/2 rounded-full bg-black/65" />
              {!selectedVideo && <div className="absolute inset-0 grid place-items-center text-center"><div><span className="mx-auto grid size-14 place-items-center rounded-full border border-white/30 bg-white/10"><Film className="size-5" /></span><p className="mt-3 text-xs font-semibold">Katalogdan video seç</p><p className="mt-1 text-[9px] text-white/60">Yönetici videoları</p></div></div>}
              {selectedVideo && <span className="absolute left-1/2 top-1/2 grid size-12 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border border-white/35 bg-black/15 backdrop-blur"><Play className="ml-0.5 size-4 fill-white" /></span>}
              <div className="absolute inset-x-4 bottom-4 rounded-2xl border border-white/15 bg-black/25 p-3 backdrop-blur-md"><p className="font-heading text-lg italic">{hostNames || 'İsimleriniz'}</p><div className="mt-1.5 flex items-center gap-2 text-[9px] text-white/75"><MapPin className="size-3" /><span className="truncate">{venueName || 'Mekân adı'}</span></div></div>
            </div>
          </div>
        </aside>
      </div>
        </>
      )}
    </main>
  );
}

function ActivationCodeGate({
  code,
  error,
  isValidating,
  onCodeChange,
  onSubmit,
}: {
  code: string;
  error: string;
  isValidating: boolean;
  onCodeChange: (value: string) => void;
  onSubmit: (event: SyntheticEvent<HTMLFormElement>) => void;
}) {
  const isComplete = ACTIVATION_CODE_PATTERN.test(code);
  const describedBy = error ? 'activation-code-hint activation-code-error' : 'activation-code-hint';

  return (
    <section className="mx-auto grid max-w-[1000px] gap-8 px-4 py-10 sm:px-7 sm:py-16 lg:grid-cols-[minmax(0,1fr)_330px] lg:items-center">
      <div className="rounded-[26px] border border-[#eadfd8] bg-[#fffdfa] p-6 shadow-[0_16px_48px_rgba(70,45,38,.07)] sm:p-9">
        <Badge variant="secondary" className="bg-[#f6ebe8] text-primary"><KeyRound className="size-3.5" /> PDF aktivasyonu</Badge>
        <h1 className="mt-5 font-heading text-[32px] font-semibold tracking-[-0.035em] sm:text-[38px]">Aktivasyon kodunu gir</h1>
        <p className="mt-3 max-w-[590px] text-sm leading-6 text-muted-foreground">Size teslim edilen PDF dosyasındaki kodu girin. Kod onaylandıktan sonra bir adet kişiselleştirilmiş dijital davetiye oluşturabilirsiniz.</p>

        <form className="mt-8 max-w-[570px]" onSubmit={onSubmit} noValidate>
          <label htmlFor="activation-code" className="block text-sm font-semibold text-[#554c49]">Aktivasyon kodu</label>
          <Input
            id="activation-code"
            value={code}
            onChange={(event) => onCodeChange(event.target.value)}
            placeholder="WED-8F3K-92MX-Q7LP"
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            inputMode="text"
            maxLength={18}
            aria-invalid={Boolean(error)}
            aria-describedby={describedBy}
            className="mt-2 h-12 rounded-xl border-[#d9cac3] bg-white px-4 font-mono text-base font-semibold tracking-[0.08em] uppercase sm:text-lg"
          />
          <p id="activation-code-hint" className="mt-2 text-xs leading-5 text-muted-foreground">Kod biçimi: WED-XXXX-XXXX-XXXX</p>
          {error && <p id="activation-code-error" role="alert" className="mt-3 rounded-xl bg-[#f9e9e8] px-3 py-2.5 text-xs font-medium leading-5 text-[#963f4c]">{error}</p>}
          <Button type="submit" disabled={isValidating || !isComplete} className="mt-5 h-12 min-w-48 rounded-xl px-5 text-sm">
            {isValidating ? <><LoaderCircle className="animate-spin" /> Kod doğrulanıyor</> : <><ShieldCheck /> Kodu doğrula</>}
          </Button>
        </form>
      </div>

      <aside className="rounded-[24px] border border-[#d7e5df] bg-[#eff7f4] p-6 text-[#36594e]">
        <span className="grid size-11 place-items-center rounded-2xl bg-white text-[#2c705d] shadow-sm"><ShieldCheck className="size-5" /></span>
        <h2 className="mt-5 font-heading text-2xl font-semibold">Tek davetiye hakkı</h2>
        <p className="mt-2 text-sm leading-6 text-[#58746b]">Kodunuz, davetiye başarıyla yayınlanana kadar kullanılmamış sayılır. Yayınlama tamamlandıktan sonra aynı kod yeniden kullanılamaz.</p>
        <div className="mt-5 border-t border-[#d5e5de] pt-4 text-xs leading-5 text-[#58746b]">PDF dosyanızdaki kodu kopyalayıp buraya yapıştırabilirsiniz; biçimi otomatik düzenlenir.</div>
      </aside>
    </section>
  );
}

function Field({ label, icon: Icon, wide, children }: { label: string; icon: LucideIcon; wide?: boolean; children: React.ReactNode }) {
  return <label className={wide ? 'sm:col-span-2' : ''}><span className="mb-2 flex items-center gap-2 text-xs font-semibold text-[#554c49]"><Icon className="size-3.5 text-primary" />{label}</span>{children}</label>;
}

function ReviewRow({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: string }) {
  return <div className="flex items-start gap-3 rounded-2xl border border-[#eadfd8] bg-white p-4"><span className="grid size-9 shrink-0 place-items-center rounded-xl bg-[#f6ebe8] text-primary"><Icon className="size-4" /></span><div className="min-w-0"><p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">{label}</p><p className="mt-1 break-words text-sm font-semibold leading-5">{value}</p></div></div>;
}

function formatBytes(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / 1024 / 1024).toLocaleString('tr-TR', { maximumFractionDigits: 1 })} MB`;
}
