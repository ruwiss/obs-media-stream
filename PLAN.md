# OBS Helper Chrome Eklentisi Planı

## Amaç
Chrome üzerinde görülen medyayı hızlı şekilde OBS içindeki belirli bir sahnede gösterebilen bir sistem kurmak.

## Ürün Yaklaşımı
İki farklı kullanım senaryosu birlikte desteklenecek:

1. Resimler için doğrudan sağ tık menüsü
2. Videolar ve karmaşık medya alanları için DOM picker

Bu yaklaşımın nedeni şudur:
- Resimler genelde doğrudan DOM üzerinden kolay seçilir.
- Videolarda özellikle YouTube gibi sitelerde gerçek medya URL'siyle çalışmak kırılgan olabilir.
- Bu yüzden videolarda URL yakalamaktan çok, sayfadaki hedef video alanını seçip onu canlı veya kontrollü şekilde OBS'ye aktarmak daha doğru olur.

## Önerilen Mimari
Sistem 3 ana parçadan oluşacak:

### 1. Chrome Extension
Sorumlulukları:
- Resimler için sağ tık menüsü sunmak
- Videolar için picker modunu başlatmak
- Kullanıcı ayarlarını saklamak
- Seçilen medya bilgisini yerel yardımcı servise göndermek

Ana bileşenler:
- `manifest.json`
- `background.js` veya `service_worker`
- `content.js`
- `picker.js`
- `options.html`
- `options.js`

### 2. Local Helper Service
Sorumlulukları:
- Chrome eklentisinden gelen medya bilgisini almak
- OBS WebSocket bağlantısını yönetmek
- Hedef sahne ve source kontrolünü yapmak
- Overlay içeriğini güncel tutmak

Önerilen teknoloji:
- Node.js
- Express
- obs-websocket-js

### 3. OBS Tarafı
Sorumlulukları:
- Belirlenen sahnede medya gösterimini yapmak
- Tek veya sınırlı sayıda source ile yönetilebilir yapı sağlamak

Önerilen kullanım:
- Resimler için gerekirse image source güncelleme
- Videolar ve canlı yansıtma için Browser Source tabanlı overlay

## Medya Stratejisi

### A. Resim Akışı
Kullanıcı bir görsele sağ tıklar.

Akış:
1. Sağ tık menüsünde `OBS'de göster` seçilir.
2. Eklenti görsel URL'sini ve sayfa bilgisini alır.
3. Yerel yardımcı servise gönderir.
4. Yardımcı servis OBS'de hedef sahneyi ve source'u günceller.
5. Görsel ilgili sahnede görünür.

Avantajlar:
- Hızlı
- Basit
- Kararlı

### B. Video / Karmaşık Medya Akışı
Kullanıcı picker modunu açar.

Akış:
1. Eklenti sayfada seçilebilir alanları vurgular.
2. Kullanıcı video veya medya kapsayıcısını seçer.
3. Eklenti seçilen DOM öğesini tanımlar.
4. İlk sürümde mümkünse doğrudan video elementi hedeflenir.
5. İleri sürümlerde sekme yakalama veya canlı yansıtma desteği eklenir.
6. Yardımcı servis OBS tarafında uygun overlay veya canlı source akışını açar.

Avantajlar:
- YouTube gibi sitelerde daha gerçekçi çözüm
- Kullanıcı neyi göstermek istiyorsa onu seçebilir
- Tek bir siteye özel kalmaz

## Neden Bu Model Seçildi
Tek bir yöntem tüm medya tiplerinde yeterince iyi çalışmaz.

Bu yüzden hibrit model seçildi:
- Resimler için sağ tık menüsü
- Videolar için picker

Bu sayede:
- Basit işler hızlı çözülür
- Zor medya senaryoları için esnek bir yol açılır
- Kullanıcı deneyimi daha doğal olur

## Sürüm Planı

## Sürüm 1 - Temel Çalışan Sistem
Hedef:
Resimleri sağ tıkla OBS'ye gönderebilen ve videolar için picker başlatabilen temel sistem.

İş kalemleri:
1. Chrome extension iskeletini oluştur
2. Sağ tık menüsünü ekle
3. Resim URL'si alma akışını yap
4. Yerel yardımcı servisi başlat
5. OBS WebSocket bağlantısını kur
6. Hedef sahne ve source ayarlarını ekle
7. Resmi OBS'de göster
8. Basit DOM picker arayüzünü oluştur
9. Seçilen öğe bilgisini loglayıp helper servise gönder

Teslim sonucu:
- Resimler çalışır
- Video picker arayüzü çalışır
- OBS bağlantı testi yapılabilir

## Sürüm 2 - Video Seçimi ve Overlay
Hedef:
Seçilen video alanını OBS'de daha kontrollü şekilde göstermek.

İş kalemleri:
1. Video elementi tespiti geliştir
2. Picker seçimini medya tipine göre sınıflandır
3. Overlay sayfası oluştur
4. Video gösterimi için Browser Source akışı kur
5. OBS'de source görünürlük kontrolü ekle
6. Gerekirse otomatik sahne geçişi ekle

Teslim sonucu:
- Kullanıcı video alanı seçebilir
- OBS bu içeriği overlay üzerinden gösterebilir

## Sürüm 3 - Canlı Sekme Yansıtma
Hedef:
YouTube gibi daha zor video senaryolarında canlı görüntü aktarımı.

İş kalemleri:
1. Tab capture yaklaşımını ekle
2. Canlı önizleme sayfası oluştur
3. OBS Browser Source ile canlı görüntü göster
4. Ses stratejisini belirle
5. Gecikme ve performans iyileştirmeleri yap

Teslim sonucu:
- Canlı oynayan sekme OBS'ye yansıtılabilir

## Teknik Riskler

### 1. Cross-origin ve güvenlik sınırlamaları
Bazı video elementleri doğrudan işlenemeyebilir.

### 2. DRM korumalı içerikler
Bazı platformlarda doğrudan capture mümkün olmayabilir.

### 3. Sayfaya göre değişen DOM yapıları
Her sitede picker mantığı aynı kararlılıkta çalışmayabilir.

### 4. OBS source türü seçimi
Bazı medya tipleri için image source, bazıları için browser source daha uygun olabilir.

## Karar Özeti
Bu proje için önerilen temel kararlar:
- Resimler: sağ tık menüsü ile hızlı gönderim
- Videolar: DOM picker ile seçim
- OBS kontrolü: WebSocket
- Gelişmiş video senaryoları: ilerleyen aşamada canlı sekme yansıtma

## İlk Uygulama Dosya Yapısı

```text
extension/
  manifest.json
  background.js
  content.js
  picker.js
  options.html
  options.js
helper/
  server.js
  obs.js
  media-store.js
  config.js
overlay/
  index.html
  overlay.js
  overlay.css
```

## Sonraki Adım
İlk kodlama aşamasında şu sırayla ilerlenmesi önerilir:
1. Extension iskeleti
2. Sağ tıkla resim gönderme
3. Helper servis ve OBS bağlantısı
4. Basit picker katmanı
5. Video/overlay akışı
