'use client';

import { useCallback, useEffect, useRef, useState, type SyntheticEvent } from 'react';
import {
  Archive,
  CheckCircle2,
  Film,
  LoaderCircle,
  PlayCircle,
  RefreshCw,
  Upload,
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

const MAX_BYTES = 250 * 1024 * 1024;
const VIDEO_TYPES = new Set(['video/mp4', 'video/webm']);

type VideoStatus = 'draft' | 'published' | 'archived';

type AdminVideo = {
  id: string;
  title: string;
  contentType: string;
  sizeBytes: number;
  status: VideoStatus;
  createdAt: number;
  previewUrl: string;
};

type ApiResult = {
  ok?: boolean;
  error?: string;
  videos?: AdminVideo[];
  videoId?: string;
  key?: string;
  uploadId?: string;
  partSize?: number;
  partNumber?: number;
  etag?: string;
};

type UploadedPart = { partNumber: number; etag: string };

async function readJson(response: Response): Promise<ApiResult | null> {
  try {
    return await response.json() as ApiResult;
  } catch {
    return null;
  }
}

function contentTypeFor(file: File) {
  if (VIDEO_TYPES.has(file.type)) return file.type;
  const extension = file.name.toLowerCase().split('.').pop();
  if (extension === 'mp4') return 'video/mp4';
  if (extension === 'webm') return 'video/webm';
  return '';
}

function formatBytes(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(bytes < 10 * 1024 * 1024 ? 1 : 0)} MB`;
}

function formatDate(epoch: number) {
  return new Intl.DateTimeFormat('tr-TR', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(epoch * 1000));
}

function statusLabel(status: VideoStatus) {
  if (status === 'published') return 'Kullanıcılara açık';
  if (status === 'archived') return 'Arşivlendi';
  return 'Yükleme tamamlanmadı';
}

async function uploadPart(
  filePart: Blob,
  key: string,
  uploadId: string,
  partNumber: number,
): Promise<UploadedPart> {
  const query = new URLSearchParams({ key, uploadId, partNumber: String(partNumber) });
  let lastError = 'Video parçası yüklenemedi.';

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const response = await fetch(`/api/admin/videos?${query}`, {
        method: 'PUT',
        body: filePart,
      });
      const result = await readJson(response);
      if (response.ok && result?.partNumber && result.etag) {
        return { partNumber: result.partNumber, etag: result.etag };
      }
      lastError = result?.error || lastError;
    } catch {
      lastError = 'Sunucuyla bağlantı kurulamadı.';
    }
  }

  throw new Error(lastError);
}

export function AdminVideoLibrary() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [videos, setVideos] = useState<AdminVideo[]>([]);
  const [title, setTitle] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [changingId, setChangingId] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const loadVideos = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch('/api/admin/videos', { cache: 'no-store' });
      const result = await readJson(response);
      if (!response.ok || !result?.videos) {
        setError(result?.error || 'Video kütüphanesi yüklenemedi.');
        return;
      }
      setVideos(result.videos);
    } catch {
      setError('Video kütüphanesine bağlanılamadı.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadVideos();
  }, [loadVideos]);

  async function submitVideo(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    const cleanTitle = title.trim();
    const contentType = file ? contentTypeFor(file) : '';
    setError('');
    setSuccess('');

    if (cleanTitle.length < 2 || cleanTitle.length > 120) {
      setError('Video başlığı 2–120 karakter arasında olmalıdır.');
      return;
    }
    if (!file || !contentType) {
      setError('Lütfen MP4 veya WebM biçiminde bir video seçin.');
      return;
    }
    if (file.size <= 0 || file.size > MAX_BYTES) {
      setError('Video boyutu 250 MB’tan küçük olmalıdır.');
      return;
    }

    setUploading(true);
    setProgress(2);
    try {
      const initiateResponse = await fetch('/api/admin/videos', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          action: 'initiate',
          title: cleanTitle,
          fileName: file.name,
          contentType,
          size: file.size,
        }),
      });
      const initiated = await readJson(initiateResponse);
      if (!initiateResponse.ok || !initiated?.videoId || !initiated.key ||
          !initiated.uploadId || !initiated.partSize) {
        throw new Error(initiated?.error || 'Video yüklemesi başlatılamadı.');
      }

      const partCount = Math.ceil(file.size / initiated.partSize);
      const parts: UploadedPart[] = [];
      for (let index = 0; index < partCount; index += 1) {
        const start = index * initiated.partSize;
        const end = Math.min(start + initiated.partSize, file.size);
        parts.push(await uploadPart(
          file.slice(start, end, contentType),
          initiated.key,
          initiated.uploadId,
          index + 1,
        ));
        setProgress(Math.round(5 + ((index + 1) / partCount) * 88));
      }

      const completeResponse = await fetch('/api/admin/videos', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          action: 'complete',
          videoId: initiated.videoId,
          key: initiated.key,
          uploadId: initiated.uploadId,
          parts,
        }),
      });
      const completed = await readJson(completeResponse);
      if (!completeResponse.ok || !completed?.ok) {
        throw new Error(completed?.error || 'Video yüklemesi tamamlanamadı.');
      }

      setProgress(100);
      setTitle('');
      setFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      setSuccess('Video yayınlandı. Kullanıcılar artık davetiyelerinde bu videoyu seçebilir.');
      await loadVideos();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Video yüklenemedi.');
    } finally {
      setUploading(false);
    }
  }

  async function changeStatus(videoId: string, status: 'published' | 'archived') {
    setChangingId(videoId);
    setError('');
    setSuccess('');
    try {
      const response = await fetch('/api/admin/videos', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ videoId, status }),
      });
      const result = await readJson(response);
      if (!response.ok || !result?.ok) {
        setError(result?.error || 'Video durumu değiştirilemedi.');
        return;
      }
      setSuccess(status === 'published'
        ? 'Video yeniden yayınlandı ve kullanıcı seçimlerine açıldı.'
        : 'Video arşivlendi. Yeni davetiyelerde artık gösterilmeyecek.');
      await loadVideos();
    } catch {
      setError('Sunucuyla bağlantı kurulamadı.');
    } finally {
      setChangingId('');
    }
  }

  const publishedCount = videos.filter((video) => video.status === 'published').length;

  return (
    <section className="mt-5 rounded-2xl border border-[#e1e5e8] bg-white p-5 shadow-[0_8px_28px_rgba(27,37,34,.04)]">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
        <div>
          <Badge variant="secondary" className="bg-[#e7f3ee] text-[#2d6d5b]">
            <Film className="size-3" /> Video kütüphanesi
          </Badge>
          <h2 className="mt-3 text-sm font-bold">Davetiyelerde kullanılacak videolar</h2>
          <p className="mt-1 max-w-2xl text-[11px] leading-5 text-[#737b7f]">
            Videoyu yalnızca yöneticiler yükleyebilir. Yayındaki videolar, davetiye oluşturan kullanıcıların seçim ekranında görünür.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-semibold text-[#66716e]">{publishedCount} yayında</span>
          <Button type="button" variant="outline" size="sm" disabled={loading || uploading} onClick={() => void loadVideos()}>
            <RefreshCw className={loading ? 'animate-spin' : ''} /> Yenile
          </Button>
        </div>
      </div>

      <form className="mt-5 grid gap-3 rounded-2xl border border-[#e4e8e7] bg-[#f8faf9] p-4 lg:grid-cols-[minmax(180px,.65fr)_minmax(230px,1fr)_auto]" onSubmit={submitVideo} noValidate>
        <div className="grid gap-1.5">
          <label htmlFor="admin-video-title" className="text-[10px] font-semibold text-[#687276]">Video başlığı</label>
          <Input
            id="admin-video-title"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            maxLength={120}
            placeholder="Örn. Zarif düğün videosu"
            disabled={uploading}
            className="h-10 rounded-xl bg-white text-xs"
          />
        </div>
        <div className="grid gap-1.5">
          <label htmlFor="admin-video-file" className="text-[10px] font-semibold text-[#687276]">MP4 veya WebM dosyası <span className="font-normal text-[#949c9f]">(en fazla 250 MB)</span></label>
          <Input
            ref={fileInputRef}
            id="admin-video-file"
            type="file"
            accept="video/mp4,video/webm,.mp4,.webm"
            disabled={uploading}
            onChange={(event) => setFile(event.target.files?.[0] ?? null)}
            className="h-10 rounded-xl bg-white py-1.5 text-xs file:mr-3 file:rounded-lg file:border-0 file:bg-[#edf3f1] file:px-3 file:py-1 file:text-[10px] file:font-semibold file:text-[#365e53]"
          />
        </div>
        <Button type="submit" disabled={uploading} className="h-10 self-end rounded-xl px-4 text-xs">
          {uploading ? <><LoaderCircle className="animate-spin" /> Yükleniyor</> : <><Upload /> Videoyu yükle</>}
        </Button>

        {uploading && (
          <div className="lg:col-span-3">
            <div className="mb-1.5 flex items-center justify-between text-[10px] font-semibold text-[#596662]">
              <span>Video güvenli depolamaya aktarılıyor</span><span>%{progress}</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-[#e1e7e5]" role="progressbar" aria-label="Video yükleme ilerlemesi" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress}>
              <div className="h-full rounded-full bg-[#2e7a65] transition-[width]" style={{ width: `${progress}%` }} />
            </div>
            <p className="mt-1.5 text-[9px] text-[#818b87]">Bu ekranı yükleme tamamlanana kadar kapatmayın.</p>
          </div>
        )}
      </form>

      {error && <p role="alert" className="mt-4 rounded-xl bg-[#f9e9e8] px-3 py-2.5 text-xs font-medium text-[#963f4c]">{error}</p>}
      {success && <p role="status" className="mt-4 flex items-center gap-2 rounded-xl bg-[#eaf5f0] px-3 py-2.5 text-xs font-medium text-[#2f6f5c]"><CheckCircle2 className="size-4" />{success}</p>}

      <div className="mt-5">
        {loading ? (
          <div className="grid min-h-32 place-items-center rounded-2xl border border-dashed border-[#dce2e0] text-xs text-[#78827f]"><span><LoaderCircle className="mr-2 inline size-4 animate-spin" />Videolar yükleniyor</span></div>
        ) : videos.length === 0 ? (
          <div className="grid min-h-36 place-items-center rounded-2xl border border-dashed border-[#dce2e0] bg-[#fbfcfc] px-5 text-center">
            <div><span className="liquid-icon liquid-icon--neutral mx-auto size-12 rounded-2xl"><Film className="size-5" /></span><p className="mt-3 text-xs font-semibold">Henüz video yok</p><p className="mt-1 text-[10px] text-[#828b8e]">İlk videoyu yukarıdaki alandan yüklediğinizde kullanıcılar seçmeye başlayabilir.</p></div>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {videos.map((video) => (
              <article key={video.id} className="overflow-hidden rounded-2xl border border-[#e1e5e8] bg-white">
                <div className="relative aspect-video bg-[#17221f]">
                  {video.status === 'draft' ? (
                    <div className="grid h-full place-items-center text-center text-[#becbc7]"><div><span className="liquid-icon liquid-icon--on-dark mx-auto size-12 rounded-2xl"><PlayCircle className="size-6" /></span><p className="mt-3 text-[10px]">Yükleme tamamlanmadı</p></div></div>
                  ) : (
                    <video src={video.previewUrl} controls preload="metadata" playsInline className="h-full w-full object-contain">Tarayıcınız video önizlemesini desteklemiyor.</video>
                  )}
                </div>
                <div className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0"><h3 className="truncate text-xs font-bold" title={video.title}>{video.title}</h3><p className="mt-1 text-[9px] text-[#8a9296]">{formatBytes(video.sizeBytes)} · {formatDate(video.createdAt)}</p></div>
                    <Badge variant="secondary" className={video.status === 'published' ? 'bg-[#e7f3ee] text-[#2d6d5b]' : video.status === 'archived' ? 'bg-[#edf0f1] text-[#687276]' : 'bg-[#f6ecdd] text-[#94612f]'}>{statusLabel(video.status)}</Badge>
                  </div>
                  <div className="mt-4 flex justify-end">
                    {video.status === 'published' ? (
                      <Button type="button" variant="outline" size="sm" disabled={changingId === video.id || uploading} onClick={() => void changeStatus(video.id, 'archived')}>
                        {changingId === video.id ? <LoaderCircle className="animate-spin" /> : <Archive />} Arşivle
                      </Button>
                    ) : video.status === 'archived' ? (
                      <Button type="button" size="sm" disabled={changingId === video.id || uploading} onClick={() => void changeStatus(video.id, 'published')}>
                        {changingId === video.id ? <LoaderCircle className="animate-spin" /> : <CheckCircle2 />} Yeniden yayınla
                      </Button>
                    ) : (
                      <Button type="button" variant="outline" size="sm" disabled={changingId === video.id || uploading} onClick={() => void changeStatus(video.id, 'archived')}>
                        {changingId === video.id ? <LoaderCircle className="animate-spin" /> : <Archive />} Taslağı arşivle
                      </Button>
                    )}
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
