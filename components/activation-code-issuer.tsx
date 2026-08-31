'use client';

import { useState, type SyntheticEvent } from 'react';
import { Check, Copy, KeyRound, LoaderCircle, ShieldCheck } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

type IssueResult = {
  ok?: boolean;
  code?: string;
  orderReference?: string;
  templateId?: string | null;
  error?: string;
};

async function readJson(response: Response): Promise<IssueResult | null> {
  try {
    return await response.json() as IssueResult;
  } catch {
    return null;
  }
}

export function ActivationCodeIssuer() {
  const [orderReference, setOrderReference] = useState('');
  const [templateId, setTemplateId] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [issuing, setIssuing] = useState(false);
  const [copied, setCopied] = useState(false);

  async function issueCode(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    const cleanReference = orderReference.trim();
    const cleanTemplate = templateId.trim();
    setError('');
    setCode('');

    if (cleanReference.length < 2 || cleanReference.length > 120 || cleanTemplate.length > 100) {
      setError('Sipariş referansını ve şablon bilgisini kontrol edin.');
      return;
    }

    setIssuing(true);
    try {
      const response = await fetch('/api/codes/issue', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ orderReference: cleanReference, templateId: cleanTemplate || undefined }),
      });
      const result = await readJson(response);
      if (!response.ok || !result?.ok || !result.code) {
        setError(result?.error || 'Aktivasyon kodu oluşturulamadı.');
        return;
      }
      setCode(result.code);
    } catch {
      setError('Bağlantı kurulamadı. Lütfen tekrar deneyin.');
    } finally {
      setIssuing(false);
    }
  }

  async function copyCode() {
    if (!code) return;
    await navigator.clipboard.writeText(code);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  return (
    <section className="mt-5 rounded-2xl border border-[#e1e5e8] bg-white p-5 shadow-[0_8px_28px_rgba(27,37,34,.04)]">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
        <div>
          <Badge variant="secondary" className="bg-[#f6e7ea] text-[#9c4657]"><KeyRound className="size-3" /> Kod yönetimi</Badge>
          <h2 className="mt-3 text-sm font-bold">PDF için tek kullanımlık kod oluştur</h2>
          <p className="mt-1 max-w-2xl text-[11px] leading-5 text-[#737b7f]">Her sipariş için yalnızca bir kod üretin ve PDF hazırlanırken bu kodu ekleyin. Kod veritabanında özetlenmiş biçimde saklanır ve güvenlik için yalnızca bu ekranda bir kez gösterilir.</p>
        </div>
        <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold text-[#2d6d5b]"><ShieldCheck className="size-3.5" /> Yönetici yetkisi gerekir</span>
      </div>

      <form className="mt-5 grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]" onSubmit={issueCode} noValidate>
        <div className="grid gap-1.5">
          <label htmlFor="activation-order-reference" className="text-[10px] font-semibold text-[#687276]">Sipariş referansı</label>
          <Input id="activation-order-reference" value={orderReference} onChange={(event) => setOrderReference(event.target.value)} maxLength={120} placeholder="SIP-123456" className="h-10 rounded-xl text-xs" />
        </div>
        <div className="grid gap-1.5">
          <label htmlFor="activation-template-id" className="text-[10px] font-semibold text-[#687276]">Şablon kimliği <span className="font-normal text-[#9ba2a5]">(isteğe bağlı)</span></label>
          <Input id="activation-template-id" value={templateId} onChange={(event) => setTemplateId(event.target.value)} maxLength={100} placeholder="wedding-classic" className="h-10 rounded-xl text-xs" />
        </div>
        <Button type="submit" disabled={issuing} className="h-10 self-end rounded-xl px-4 text-xs">{issuing ? <><LoaderCircle className="animate-spin" /> Oluşturuluyor</> : <><KeyRound /> Kod oluştur</>}</Button>
      </form>

      {error && <p role="alert" className="mt-4 rounded-xl bg-[#f9e9e8] px-3 py-2.5 text-xs font-medium text-[#963f4c]">{error}</p>}
      {code && (
        <div className="mt-4 flex flex-col gap-3 rounded-xl border border-[#cce0d8] bg-[#eff7f4] p-4 sm:flex-row sm:items-center sm:justify-between">
          <div><p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[#58746b]">PDF’e eklenecek aktivasyon kodu</p><code className="mt-1 block font-mono text-lg font-bold tracking-[0.11em] text-[#28594b]">{code}</code></div>
          <Button type="button" variant="secondary" size="sm" onClick={copyCode} className="self-start bg-white text-[#36594e] sm:self-auto">{copied ? <Check /> : <Copy />}{copied ? 'Kopyalandı' : 'Kodu kopyala'}</Button>
        </div>
      )}
    </section>
  );
}
