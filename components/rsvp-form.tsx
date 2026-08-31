'use client';

import { useState } from 'react';
import { Check, HelpCircle, Minus, Plus, Send, X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

type Status = 'yes' | 'no' | 'maybe';

const choices: Array<{ value: Status; label: string; icon: typeof Check; tone: string }> = [
  { value: 'yes', label: 'Katılacağım', icon: Check, tone: 'data-[selected=true]:border-[#3a806e] data-[selected=true]:bg-[#e8f3ef] data-[selected=true]:text-[#245e50]' },
  { value: 'no', label: 'Katılamayacağım', icon: X, tone: 'data-[selected=true]:border-[#a5505b] data-[selected=true]:bg-[#f8e9e9] data-[selected=true]:text-[#8c3947]' },
  { value: 'maybe', label: 'Henüz net değil', icon: HelpCircle, tone: 'data-[selected=true]:border-[#8b79a9] data-[selected=true]:bg-[#f1edf7] data-[selected=true]:text-[#665482]' },
];

export function RsvpForm({ slug }: { slug: string }) {
  const [status, setStatus] = useState<Status>('yes');
  const [partySize, setPartySize] = useState(2);
  const [name, setName] = useState('');
  const [note, setNote] = useState('');
  const [state, setState] = useState<'idle' | 'sending' | 'success'>('idle');
  const [error, setError] = useState('');

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setState('sending');
    setError('');
    try {
      const response = await fetch('/api/rsvp', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ slug, name, status, partySize, note }),
      });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error || 'Yanıt kaydedilemedi.');
      setState('success');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Bir sorun oluştu.');
      setState('idle');
    }
  }

  if (state === 'success') {
    return (
      <div className="rounded-[24px] border border-[#cfe3db] bg-[#eff7f4] px-6 py-8 text-center shadow-[0_16px_45px_rgba(42,92,75,.08)]" role="status">
        <span className="mx-auto grid size-12 place-items-center rounded-full bg-[#2d6f5d] text-white"><Check className="size-6" /></span>
        <h2 className="mt-4 font-heading text-2xl font-semibold text-[#23473e]">Yanıtınız kaydedildi</h2>
        <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-[#557069]">Bizi haberdar ettiğiniz için teşekkür ederiz. Yanıtınızı değiştirmek isterseniz bu sayfayı yeniden kullanabilirsiniz.</p>
        <Button type="button" variant="outline" className="mt-5 h-10 border-[#c5dbd3] bg-white" onClick={() => setState('idle')}>Yanıtımı güncelle</Button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="rounded-[24px] border border-[#eadfd8] bg-[#fffdfa] p-5 shadow-[0_20px_55px_rgba(70,45,38,.09)] sm:p-7">
      <div className="text-center">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">Lütfen yanıtlayın</p>
        <h2 className="mt-2 font-heading text-[27px] font-semibold tracking-[-0.02em]">Bu güzel günümüzde siz de var mısınız?</h2>
      </div>

      <div className="mt-6 grid gap-2.5 sm:grid-cols-3">
        {choices.map((choice) => (
          <button
            key={choice.value}
            type="button"
            data-selected={status === choice.value}
            onClick={() => setStatus(choice.value)}
            className={`flex min-h-20 flex-col items-center justify-center gap-2 rounded-2xl border border-[#e8dfda] bg-white px-3 text-xs font-semibold text-[#746a67] transition hover:border-[#d8c8c1] ${choice.tone}`}
            aria-pressed={status === choice.value}
          >
            <choice.icon className="size-5" />{choice.label}
          </button>
        ))}
      </div>

      <div className="mt-5">
        <label htmlFor="guest-name" className="text-xs font-semibold text-[#554c49]">Adınız ve soyadınız</label>
        <Input id="guest-name" value={name} onChange={(event) => setName(event.target.value)} placeholder="Örn. Ayşe Yılmaz" autoComplete="name" required className="mt-2 h-11 rounded-xl bg-white px-3" />
      </div>

      {status === 'yes' && (
        <div className="mt-5 flex items-center justify-between rounded-2xl border border-[#e8dfda] bg-white px-4 py-3">
          <div><p className="text-xs font-semibold text-[#554c49]">Toplam kaç kişi geleceksiniz?</p><p className="mt-0.5 text-[11px] text-muted-foreground">Siz dahil</p></div>
          <div className="flex items-center gap-3">
            <button type="button" onClick={() => setPartySize(Math.max(1, partySize - 1))} aria-label="Kişi sayısını azalt" className="grid size-9 place-items-center rounded-full border border-[#e6dad4] hover:bg-muted"><Minus className="size-4" /></button>
            <output className="w-5 text-center font-heading text-xl font-semibold" aria-live="polite">{partySize}</output>
            <button type="button" onClick={() => setPartySize(Math.min(20, partySize + 1))} aria-label="Kişi sayısını artır" className="grid size-9 place-items-center rounded-full border border-[#e6dad4] hover:bg-muted"><Plus className="size-4" /></button>
          </div>
        </div>
      )}

      <div className="mt-5">
        <label htmlFor="guest-note" className="text-xs font-semibold text-[#554c49]">Ev sahibine notunuz <span className="font-normal text-muted-foreground">(isteğe bağlı)</span></label>
        <Textarea id="guest-note" value={note} onChange={(event) => setNote(event.target.value)} placeholder="Mutluluklar dileriz..." maxLength={500} className="mt-2 min-h-24 resize-none rounded-xl bg-white px-3 py-3" />
      </div>

      {error && <p className="mt-4 rounded-xl bg-[#f9e9e8] px-3 py-2 text-xs font-medium text-[#963f4c]" role="alert">{error}</p>}
      <Button type="submit" disabled={state === 'sending'} className="mt-5 h-12 w-full rounded-xl text-[14px] shadow-[0_10px_25px_rgba(133,48,68,.18)]">
        {state === 'sending' ? 'Kaydediliyor…' : <><Send data-icon="inline-start" /> Yanıtımı gönder</>}
      </Button>
      <p className="mt-3 text-center text-[10px] leading-4 text-muted-foreground">Yanıtınız yalnızca davetiye sahibiyle paylaşılır.</p>
    </form>
  );
}
