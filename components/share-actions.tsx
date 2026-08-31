'use client';

import { useState } from 'react';
import { Check, Copy, Download, Send } from 'lucide-react';

import { Button } from '@/components/ui/button';

type ExportGuest = { name: string; status: string; partySize: number; note: string };

export function ShareActions({ slug, guests }: { slug: string; guests: ExportGuest[] }) {
  const [copied, setCopied] = useState(false);

  function invitationUrl() {
    return `${window.location.origin}/davet/${slug}`;
  }

  async function copy() {
    await navigator.clipboard.writeText(invitationUrl());
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  function share() {
    const message = `Elif ve Arda'nın düğün davetiyesini görüntülemek için: ${invitationUrl()}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, '_blank', 'noopener,noreferrer');
  }

  function exportCsv() {
    const statusLabel: Record<string, string> = { yes: 'Katılacak', no: 'Katılamayacak', maybe: 'Henüz net değil', awaiting: 'Yanıt bekleniyor' };
    const escape = (value: string | number) => `"${String(value).replace(/"/g, '""')}"`;
    const rows = [
      ['İsim', 'Katılım durumu', 'Kişi sayısı', 'Not'],
      ...guests.map((guest) => [guest.name, statusLabel[guest.status] ?? guest.status, guest.partySize, guest.note]),
    ];
    const csv = '\ufeff' + rows.map((row) => row.map(escape).join(';')).join('\r\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = 'elif-arda-davetli-listesi.csv';
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="flex flex-wrap gap-2">
      <Button type="button" onClick={share} className="h-10 bg-[#267a5b] hover:bg-[#1f674d]"><Send /> WhatsApp&apos;ta paylaş</Button>
      <Button type="button" onClick={copy} variant="outline" className="h-10 bg-white">{copied ? <Check /> : <Copy />}{copied ? 'Kopyalandı' : 'Linki kopyala'}</Button>
      <Button type="button" onClick={exportCsv} variant="outline" className="h-10 bg-white"><Download /> Excel&apos;e aktar</Button>
    </div>
  );
}
