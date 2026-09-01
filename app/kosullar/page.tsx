import type { Metadata } from 'next';

import { LegalPage } from '@/components/legal-page';

export const metadata: Metadata = {
  title: 'Hizmet Koşulları — Davetly',
  description: 'Davetly hizmetini kullanırken geçerli olan temel koşullar.',
};

export default function TermsPage() {
  return (
    <LegalPage
      eyebrow="Kullanım"
      title="Hizmet Koşulları"
      description="Davetly hesabı açarak veya hizmeti kullanarak aşağıdaki koşulları kabul etmiş olursunuz."
      updatedAt="1 Eylül 2026"
      sections={[
        {
          title: 'Hizmetin kapsamı',
          content: (
            <p>
              Davetly; yöneticinin yayımladığı videolar arasından seçim yaparak
              dijital davetiye oluşturmanıza, davetiyeyi paylaşmanıza ve katılım
              yanıtlarını takip etmenize yardımcı olur. Özellikler zaman içinde
              geliştirilebilir veya değiştirilebilir.
            </p>
          ),
        },
        {
          title: 'Hesap ve erişim güvenliği',
          content: (
            <p>
              Google hesabınızla giriş yaparken doğru ve size ait bir hesap
              kullanmalısınız. Hesabınız üzerinden gerçekleşen işlemlerden siz
              sorumlusunuz. Yetkisiz erişim şüphesi oluşursa bizimle iletişime
              geçmelisiniz.
            </p>
          ),
        },
        {
          title: 'İçerik ve paylaşım sorumluluğu',
          content: (
            <>
              <p>
                Davetiyeye eklediğiniz metin, kişi ve etkinlik bilgilerinin
                doğru ve hukuka uygun olmasından siz sorumlusunuz. Başkalarının
                kişisel bilgilerini eklemeden veya paylaşmadan önce gerekli izni
                almalısınız.
              </p>
              <p>
                Davetiye bağlantısı kendisine ulaşan kişiler tarafından
                görüntülenebilir. Bağlantıyı yalnızca erişmesini istediğiniz
                kişilerle paylaşmalısınız.
              </p>
            </>
          ),
        },
        {
          title: 'Kabul edilemez kullanım',
          content: (
            <p>
              Hizmeti yasa dışı, yanıltıcı, zararlı veya taciz edici içerik
              için; güvenlik önlemlerini aşmak, başkalarının hesabına erişmek,
              sistemi bozmak ya da aşırı yük oluşturmak amacıyla
              kullanamazsınız. Bu tür kullanımlarda içeriği kaldırabilir veya
              erişimi sınırlandırabiliriz.
            </p>
          ),
        },
        {
          title: 'Hizmetin kullanılabilirliği',
          content: (
            <p>
              Hizmeti güvenilir biçimde sunmak için çalışırız; ancak bakım,
              güvenlik, altyapı veya kontrolümüz dışındaki nedenlerle kesintiler
              yaşanabilir. Planlı önemli değişiklikleri uygun olduğunda
              duyururuz.
            </p>
          ),
        },
        {
          title: 'Fikri mülkiyet',
          content: (
            <p>
              Davetly markası, arayüzü ve yöneticinin sunduğu video içerikleri
              üzerindeki haklar ilgili hak sahiplerine aittir. Hizmet size bu
              içerikleri yalnızca Davetly davetiyesi oluşturmak ve paylaşmak
              için sınırlı bir kullanım hakkı verir.
            </p>
          ),
        },
        {
          title: 'Değişiklikler ve sona erme',
          content: (
            <p>
              Bu koşullar hizmetteki veya yasal gerekliliklerdeki değişikliklere
              göre güncellenebilir. Güncel sürüm bu sayfada yayımlanır.
              Koşullara aykırı veya güvenliği tehdit eden kullanımda erişimi
              askıya alabilir ya da sonlandırabiliriz.
            </p>
          ),
        },
      ]}
    />
  );
}
