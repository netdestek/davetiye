'use client';

import { useEffect, useMemo, useState, type SyntheticEvent } from 'react';
import type { LucideIcon } from 'lucide-react';
import Link from 'next/link';
import {
  ArrowLeft, ArrowRight, CalendarDays, Check, CheckCircle2, Copy, Film,
  Heart, ImageIcon, KeyRound, Link2, LoaderCircle, MapPin, Play, Send, ShieldCheck,
  Sparkles, Upload, Users, WandSparkles,
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button, buttonVariants } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

const steps = [
  { label: 'Bilgiler', icon: CalendarDays },
  { label: 'Video', icon: Film },
  { label: 'Ön izle', icon: Sparkles },
];

const VIDEO_MAX_BYTES = 250 * 1024 * 1024;
const POSTER_MAX_BYTES = 10 * 1024 * 1024;
const DEFAULT_PART_SIZE = 8 * 1024 * 1024;
const VIDEO_TYPES = new Set(['video/mp4', 'video/webm']);
const POSTER_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const ACTIVATION_CODE_PATTERN = /^WED-[0-9A-HJKMNP-TV-Z]{4}-[0-9A-HJKMNP-TV-Z]{4}-[0-9A-HJKMNP-TV-Z]{4}$/;

type UploadKind = 'video' | 'poster';
type UploadedPart = { partNumber: number; etag: string };
type PublishResult = { url?: string; error?: string };

type InitiateResult = {
  key?: string;
  uploadId?: string;
  partSize?: number;
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

async function deleteCompletedUpload(key: string) {
  await fetch('/api/uploads', {
    method: 'DELETE',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ action: 'delete', key }),
  });
}

function contentTypeFor(file: File, kind: UploadKind) {
  if (file.type) return file.type;
  const extension = file.name.split('.').pop()?.toLocaleLowerCase('en-US');
  if (kind === 'video') return extension === 'webm' ? 'video/webm' : 'video/mp4';
  if (extension === 'png') return 'image/png';
  if (extension === 'webp') return 'image/webp';
  return 'image/jpeg';
}

async function uploadPartWithRetry(
  key: string,
  uploadId: string,
  partNumber: number,
  chunk: Blob,
) {
  const query = new URLSearchParams({ key, uploadId, partNumber: String(partNumber) });
  let lastError = 'Yükleme parçası gönderilemedi.';

  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const response = await fetch(`/api/uploads?${query.toString()}`, {
        method: 'PUT',
        headers: { 'content-type': 'application/octet-stream' },
        body: chunk,
      });
      const result = await readJson<UploadedPart & { error?: string }>(response);
      if (response.ok && result?.etag) return result;
      lastError = result?.error || lastError;
    } catch {
      lastError = 'Ağ bağlantısı nedeniyle yükleme parçası gönderilemedi.';
    }
    await new Promise((resolve) => window.setTimeout(resolve, 350 * (attempt + 1)));
  }

  throw new Error(lastError);
}

async function uploadFile(
  file: File,
  kind: UploadKind,
  onProgress: (percent: number) => void,
) {
  const contentType = contentTypeFor(file, kind);
  const initiateResponse = await fetch('/api/uploads', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      action: 'initiate',
      kind,
      fileName: file.name,
      contentType,
      size: file.size,
    }),
  });
  const initiated = await readJson<InitiateResult>(initiateResponse);
  if (!initiateResponse.ok || !initiated?.key || !initiated.uploadId) {
    throw new Error(initiated?.error || 'Yükleme başlatılamadı.');
  }

  const key = initiated.key;
  const uploadId = initiated.uploadId;
  const partSize = initiated.partSize || DEFAULT_PART_SIZE;
  const partCount = Math.ceil(file.size / partSize);
  const uploadedParts: UploadedPart[] = [];
  let nextPartIndex = 0;
  let completedBytes = 0;

  try {
    async function worker() {
      while (nextPartIndex < partCount) {
        const index = nextPartIndex;
        nextPartIndex += 1;
        const start = index * partSize;
        const end = Math.min(file.size, start + partSize);
        const chunk = file.slice(start, end);
        const part = await uploadPartWithRetry(key, uploadId, index + 1, chunk);
        uploadedParts.push(part);
        completedBytes += chunk.size;
        onProgress(Math.min(99, Math.round((completedBytes / file.size) * 100)));
      }
    }

    await Promise.all(
      Array.from({ length: Math.min(3, partCount) }, () => worker()),
    );

    const completeResponse = await fetch('/api/uploads', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'complete', key, uploadId, parts: uploadedParts }),
    });
    const completed = await readJson<{ key?: string; error?: string }>(completeResponse);
    if (!completeResponse.ok || !completed?.key) {
      throw new Error(completed?.error || 'Yükleme tamamlanamadı.');
    }
    onProgress(100);
    return completed.key;
  } catch (error) {
    await fetch('/api/uploads', {
      method: 'DELETE',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ key, uploadId }),
    }).catch(() => undefined);
    throw error;
  }
}

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
  const [hostNames, setHostNames] = useState('Elif & Arda');
  const [eventAt, setEventAt] = useState('2026-09-12T19:30');
  const [venueName, setVenueName] = useState('Liva Davet');
  const [venueAddress, setVenueAddress] = useState('Polonezköy, Beykoz / İstanbul');
  const [description, setDescription] = useState('Bu güzel günümüzde sizi de aramızda görmekten mutluluk duyarız.');
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [posterFile, setPosterFile] = useState<File | null>(null);
  const [publishing, setPublishing] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [publishError, setPublishError] = useState('');
  const [shareUrl, setShareUrl] = useState('');
  const [copied, setCopied] = useState(false);
  const [activationCode, setActivationCode] = useState('');
  const [activationApproved, setActivationApproved] = useState(false);
  const [validatingCode, setValidatingCode] = useState(false);
  const [activationError, setActivationError] = useState('');

  const videoUrl = useMemo(() => videoFile ? URL.createObjectURL(videoFile) : '', [videoFile]);
  const posterUrl = useMemo(() => posterFile ? URL.createObjectURL(posterFile) : '', [posterFile]);

  useEffect(() => () => {
    if (videoUrl) URL.revokeObjectURL(videoUrl);
  }, [videoUrl]);

  useEffect(() => () => {
    if (posterUrl) URL.revokeObjectURL(posterUrl);
  }, [posterUrl]);

  function chooseVideo(file: File | null) {
    setPublishError('');
    if (!file) { setVideoFile(null); return; }
    const contentType = contentTypeFor(file, 'video');
    if (!VIDEO_TYPES.has(contentType)) {
      setVideoFile(null);
      setPublishError('Lütfen MP4 veya WebM biçiminde hazır bir video seçin.');
      return;
    }
    if (file.size <= 0) {
      setVideoFile(null);
      setPublishError('Boş bir video dosyası yüklenemez.');
      return;
    }
    if (file.size > VIDEO_MAX_BYTES) {
      setVideoFile(null);
      setPublishError('Video en fazla 250 MB olabilir.');
      return;
    }
    setVideoFile(file);
  }

  function choosePoster(file: File | null) {
    setPublishError('');
    if (!file) { setPosterFile(null); return; }
    const contentType = contentTypeFor(file, 'poster');
    if (!POSTER_TYPES.has(contentType)) {
      setPosterFile(null);
      setPublishError('Kapak görseli JPG, PNG veya WebP biçiminde olmalıdır.');
      return;
    }
    if (file.size <= 0) {
      setPosterFile(null);
      setPublishError('Boş bir kapak görseli yüklenemez.');
      return;
    }
    if (file.size > POSTER_MAX_BYTES) {
      setPosterFile(null);
      setPublishError('Kapak görseli en fazla 10 MB olabilir.');
      return;
    }
    setPosterFile(file);
  }

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
    if (!videoFile) {
      setPublishError('Yayınlamadan önce hazır videonuzu yükleyin.');
      return;
    }

    setPublishing(true);
    setUploadProgress(0);
    setPublishError('');
    const completedKeys: string[] = [];
    let safeToDeleteUploads = true;
    try {
      const videoWeight = posterFile ? 90 : 100;
      const videoKey = await uploadFile(
        videoFile,
        'video',
        (progress) => setUploadProgress(Math.round((progress * videoWeight) / 100)),
      );
      completedKeys.push(videoKey);
      const posterKey = posterFile
        ? await uploadFile(
            posterFile,
            'poster',
            (progress) => setUploadProgress(90 + Math.round(progress / 10)),
          )
        : undefined;
      if (posterKey) completedKeys.push(posterKey);

      let response: Response;
      try {
        safeToDeleteUploads = false;
        response = await fetch('/api/invitations/create', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            hostNames,
            eventAt,
            venueName,
            venueAddress,
            description,
            videoKey,
            posterKey,
          }),
        });
      } catch {
        throw new Error('Davetiye yayınlandı mı doğrulanamadı. Yüklenen dosyalar korundu; tekrar denemeden önce davetiyelerinizi kontrol edin.');
      }
      const result = await readJson<PublishResult>(response);
      if (!response.ok || !result?.url) {
        safeToDeleteUploads = true;
        throw new Error(result?.error || 'Davetiye yayınlanamadı.');
      }
      setUploadProgress(100);
      setShareUrl(result.url);
    } catch (cause) {
      if (safeToDeleteUploads && completedKeys.length) {
        await Promise.all(completedKeys.map((key) => deleteCompletedUpload(key).catch(() => undefined)));
      }
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
      const validDate = eventAt && !Number.isNaN(Date.parse(eventAt));
      if (hostNames.trim().length < 2 || hostNames.trim().length > 120 || !validDate ||
          venueName.trim().length < 2 || venueName.trim().length > 160 ||
          venueAddress.trim().length > 300 || description.trim().length > 300) {
        setPublishError('Etkinlik adı, tarihi ve mekân bilgilerini kontrol edin.');
        return;
      }
    }
    if (step === 2 && !videoFile) {
      setPublishError('Devam etmek için hazır davetiye videonuzu seçin.');
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
          {isSignedIn ? (
            <Badge variant="secondary" className="bg-[#e4f0eb] text-[#2a6657]"><Check className="size-3" /> {displayName?.split(' ')[0] ?? 'Oturum açık'}</Badge>
          ) : (
            <a href={signInPath} target="_top" className="text-xs font-semibold text-primary">Giriş yap</a>
          )}
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
              <h1 className="mt-2 font-heading text-[29px] font-semibold tracking-[-0.03em]">Hazır videonu yükle</h1>
              <p className="mt-2 text-sm text-muted-foreground">Video olduğu gibi yayınlanır; Davetly videonun görüntüsünü veya sesini değiştirmez.</p>
              <div className="mt-7 space-y-4">
                <UploadBox
                  title="Davetiye videosu"
                  description="MP4 önerilir · En fazla 250 MB"
                  icon={Film}
                  file={videoFile}
                  accept="video/mp4,video/webm,.mp4,.webm"
                  required
                  onFile={chooseVideo}
                />
                <UploadBox
                  title="Kapak görseli"
                  description="İsteğe bağlı · JPG, PNG veya WebP · En fazla 10 MB"
                  icon={ImageIcon}
                  file={posterFile}
                  accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
                  onFile={choosePoster}
                />
              </div>
              <div className="mt-5 flex items-start gap-3 rounded-2xl bg-[#edf4f1] p-4 text-xs leading-5 text-[#526a63]"><ShieldCheck className="mt-0.5 size-4 shrink-0 text-[#2d6c5b]" /><p>Dosya küçük parçalara bölünerek güvenli biçimde R2 depolamaya aktarılır. Bağlantı kesilen bir parça otomatik yeniden denenir; videonun tamamı uygulama belleğine alınmaz.</p></div>
              {publishError && <p className="mt-4 rounded-xl bg-[#f9e9e8] px-3 py-2.5 text-xs font-medium text-[#963f4c]" role="alert">{publishError}</p>}
            </div>
          )}

          {step === 3 && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">3. adım</p>
              <h1 className="mt-2 font-heading text-[29px] font-semibold tracking-[-0.03em]">Son bir kez kontrol et</h1>
              <p className="mt-2 text-sm text-muted-foreground">Hazır olduğunda videonu yükle, davetiyeyi yayınla ve paylaşım bağlantını oluştur.</p>
              {!shareUrl ? (
                <div className="mt-7 space-y-3">
                  <ReviewRow icon={Users} label="Etkinlik" value={hostNames} />
                  <ReviewRow icon={CalendarDays} label="Tarih" value={new Date(eventAt).toLocaleString('tr-TR', { dateStyle: 'long', timeStyle: 'short' })} />
                  <ReviewRow icon={MapPin} label="Mekân" value={`${venueName} · ${venueAddress}`} />
                  <ReviewRow icon={Film} label="Hazır video" value={`${videoFile?.name ?? 'Video seçilmedi'} · ${videoFile ? formatBytes(videoFile.size) : '—'}`} />
                  {posterFile && <ReviewRow icon={ImageIcon} label="Kapak görseli" value={`${posterFile.name} · ${formatBytes(posterFile.size)}`} />}
                  {publishing && (
                    <div className="rounded-2xl border border-[#d8e5df] bg-[#f4f8f6] p-4">
                      <div className="flex items-center justify-between text-xs"><span className="font-semibold">Video R2’ye yükleniyor</span><span className="font-bold text-[#2c6c5a]">%{uploadProgress}</span></div>
                      <div className="mt-3 h-2 overflow-hidden rounded-full bg-[#dfeae6]"><div className="h-full rounded-full bg-[#347763] transition-[width] duration-300" style={{ width: `${uploadProgress}%` }} /></div>
                    </div>
                  )}
                  {publishError && <p className="rounded-xl bg-[#f9e9e8] px-3 py-2.5 text-xs font-medium text-[#963f4c]" role="alert">{publishError}</p>}
                  <Button onClick={publish} disabled={publishing} className="h-12 w-full rounded-xl text-sm shadow-[0_12px_28px_rgba(133,48,68,.2)]">
                    {publishing ? <><LoaderCircle className="animate-spin" /> Yükleniyor · %{uploadProgress}</> : <><Sparkles /> Videoyu yükle ve yayınla</>}
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
              {videoUrl ? (
                <video key={videoUrl} src={videoUrl} poster={posterUrl || undefined} muted loop autoPlay playsInline className="absolute inset-0 size-full object-cover" />
              ) : posterUrl ? (
                // Blob-backed local previews cannot use the framework image optimizer.
                // eslint-disable-next-line next/no-img-element
                <img src={posterUrl} alt="Seçilen video kapağı" className="absolute inset-0 size-full object-cover" />
              ) : null}
              <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-transparent to-black/10" />
              <div className="absolute left-1/2 top-3 h-4 w-16 -translate-x-1/2 rounded-full bg-black/65" />
              {!videoUrl && <div className="absolute inset-0 grid place-items-center text-center"><div><span className="mx-auto grid size-14 place-items-center rounded-full border border-white/30 bg-white/10"><Upload className="size-5" /></span><p className="mt-3 text-xs font-semibold">Hazır videonu seç</p><p className="mt-1 text-[9px] text-white/60">MP4 veya WebM</p></div></div>}
              {videoUrl && <span className="absolute left-1/2 top-1/2 grid size-12 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border border-white/35 bg-black/15 backdrop-blur"><Play className="ml-0.5 size-4 fill-white" /></span>}
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

function UploadBox({ title, description, icon: Icon, file, accept, required, onFile }: { title: string; description: string; icon: LucideIcon; file: File | null; accept: string; required?: boolean; onFile: (file: File | null) => void }) {
  return (
    <label className={`flex cursor-pointer items-center gap-4 rounded-2xl border border-dashed p-5 transition hover:border-[#bf8891] hover:bg-[#fcf7f5] ${file ? 'border-[#8bb3a7] bg-[#f1f7f4]' : 'border-[#d9cac3] bg-white'}`}>
      <span className={`grid size-12 shrink-0 place-items-center rounded-2xl ${file ? 'bg-[#dcece6] text-[#2c6b5a]' : 'bg-[#f6ebe8] text-primary'}`}>{file ? <Check className="size-5" /> : <Icon className="size-5" />}</span>
      <span className="min-w-0 flex-1"><span className="flex items-center gap-2 text-sm font-semibold">{title}{required && <span className="text-[9px] uppercase tracking-[0.08em] text-primary">Zorunlu</span>}</span><span className="mt-1 block truncate text-xs text-muted-foreground">{file ? `${file.name} · ${formatBytes(file.size)}` : description}</span></span>
      <span className="hidden items-center gap-1.5 rounded-lg border border-[#dfd2cc] bg-white px-3 py-2 text-xs font-semibold sm:flex"><Upload className="size-3.5" /> Seç</span>
      <input type="file" accept={accept} className="sr-only" onChange={(event) => onFile(event.target.files?.[0] ?? null)} />
    </label>
  );
}

function ReviewRow({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: string }) {
  return <div className="flex items-start gap-3 rounded-2xl border border-[#eadfd8] bg-white p-4"><span className="grid size-9 shrink-0 place-items-center rounded-xl bg-[#f6ebe8] text-primary"><Icon className="size-4" /></span><div className="min-w-0"><p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">{label}</p><p className="mt-1 break-words text-sm font-semibold leading-5">{value}</p></div></div>;
}

function formatBytes(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / 1024 / 1024).toLocaleString('tr-TR', { maximumFractionDigits: 1 })} MB`;
}
