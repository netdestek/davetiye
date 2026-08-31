import { Heart } from 'lucide-react';

export default function InvitationNotFound() {
  return (
    <main className="grid min-h-screen place-items-center bg-[#f7f1eb] px-5 text-center">
      <div>
        <span className="mx-auto grid size-12 place-items-center rounded-2xl bg-primary text-white"><Heart className="size-5 fill-current" /></span>
        <h1 className="mt-5 font-heading text-3xl font-semibold">Bu davetiye bulunamadı</h1>
        <p className="mt-2 text-sm text-muted-foreground">Bağlantı hatalı, süresi dolmuş veya davetiye yayından kaldırılmış olabilir.</p>
        <a href="/" className="mt-5 inline-flex h-10 items-center rounded-xl bg-primary px-4 text-sm font-semibold text-white">Davetly&apos;ye dön</a>
      </div>
    </main>
  );
}
