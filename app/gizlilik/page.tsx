import type { Metadata } from 'next';

import { LegalPage } from '@/components/legal-page';

export const metadata: Metadata = {
  title: 'Gizlilik Politikası — Davetly',
  description: 'Davetly hizmetinin kişisel verileri nasıl işlediğini öğrenin.',
};

export default function PrivacyPage() {
  return (
    <LegalPage
      eyebrow="Gizlilik"
      title="Gizlilik Politikası"
      description="Davetly’yi kullanırken hangi bilgilerin işlendiğini, bunları neden kullandığımızı ve seçimlerinizi açık bir dille anlatıyoruz."
      updatedAt="1 Eylül 2026"
      sections={[
        {
          title: 'Topladığımız bilgiler',
          content: (
            <>
              <p>
                Google ile giriş yaptığınızda Google hesabınızdan doğrulanmış
                e-posta adresinizi, görünen adınızı ve hesabınıza ait benzersiz
                kimlik bilgisini alırız. Google parolanızı görmez veya
                saklamayız.
              </p>
              <p>
                Davetiye oluştururken girdiğiniz etkinlik başlığı, ev sahibi
                adları, tarih, saat, mekân, açıklama ve seçtiğiniz video gibi
                içerikleri işleriz. Davetliler katılım formunu kullandığında ad,
                katılım durumu, kişi sayısı ve isteğe bağlı not bilgisi
                kaydedilir.
              </p>
            </>
          ),
        },
        {
          title: 'Bilgileri nasıl kullanıyoruz?',
          content: (
            <>
              <p>
                Bilgileri hesabınızı oluşturmak ve güvenli tutmak,
                davetiyelerinizi hazırlamak ve paylaşmak, katılım yanıtlarını
                göstermek, kötüye kullanımı önlemek ve hizmetin çalışmasını
                sağlamak için kullanırız.
              </p>
              <p>
                Kişisel verilerinizi satmayız. Veriler yalnızca hizmeti sunmak
                için gerekli olduğu ölçüde barındırma ve kimlik doğrulama
                sağlayıcılarıyla işlenebilir. Google ile giriş, Google’ın kendi
                gizlilik koşullarına da tabidir.
              </p>
            </>
          ),
        },
        {
          title: 'Çerezler ve oturum güvenliği',
          content: (
            <p>
              Girişinizi sürdürmek ve yetkisiz erişimi önlemek için güvenli,
              yalnızca HTTP üzerinden erişilebilen oturum çerezleri kullanırız.
              Bu çerezler reklam veya kullanıcılar arası takip amacıyla
              kullanılmaz.
            </p>
          ),
        },
        {
          title: 'Saklama, paylaşım ve güvenlik',
          content: (
            <>
              <p>
                Hesap, davetiye ve yanıt bilgilerini hizmeti sunmak, yasal
                yükümlülükleri yerine getirmek ve güvenliği korumak için gerekli
                olduğu süre boyunca saklarız. Davetiye bağlantısını
                paylaştığınız kişiler, bağlantıda yayımlanan etkinlik
                bilgilerini görebilir.
              </p>
              <p>
                Erişim kontrolleri, şifrelenmiş bağlantılar ve sınırlı yetkili
                yönetici erişimi gibi teknik ve idari önlemler uygularız.
                Bununla birlikte hiçbir internet hizmeti mutlak güvenlik
                garantisi veremez.
              </p>
            </>
          ),
        },
        {
          title: 'Haklarınız ve tercihleriniz',
          content: (
            <p>
              Kişisel verilerinize erişme, düzeltme veya silme talebinde
              bulunabilirsiniz. Hesap ve davetiye verilerinizle ilgili bir talep
              iletirken, güvenliğiniz için hesabın size ait olduğunu
              doğrulamamız gerekebilir.
            </p>
          ),
        },
        {
          title: 'Politika değişiklikleri',
          content: (
            <p>
              Bu politika hizmetteki veya yasal gerekliliklerdeki değişikliklere
              göre güncellenebilir. Güncel sürüm ve yürürlük tarihi her zaman bu
              sayfada yayımlanır.
            </p>
          ),
        },
      ]}
    />
  );
}
