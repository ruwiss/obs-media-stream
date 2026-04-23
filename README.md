# OBS Helper

Chrome üzerindeki resimleri veya videoları (canlı sekme yakalama ile) tek bir kısayolla doğrudan OBS'e aktarmanızı sağlayan araç.

## Kurulum

### 1. Masaüstü Uygulaması (Portable)
* Projenin sağ tarafındaki **[Releases (Son Sürüm)](https://github.com/ruwiss/obs-media-stream/releases/latest)** sayfasına gidin.
* İşletim sisteminize uygun olan Portable dosyasını (Windows için `.exe`, Mac/Linux için ilgili dosya) indirin.
* İndirdiğiniz dosyayı direkt çalıştırın. Kurulum gerektirmez.

### 2. Chrome Eklentisi
* Yine **[Releases](https://github.com/ruwiss/obs-media-stream/releases/latest)** sayfasından `obs-helper-extension.zip` dosyasını indirin.
* Chrome tarayıcınızda adres çubuğuna `chrome://extensions/` yazın ve eklentiler sayfasını açın.
* Sağ üst köşeden **"Geliştirici modu"**nu aktif edin.
* İndirdiğiniz zip dosyasını o alana sürükleyin, böylece eklentiyi kurmuş olacaksınız.

---

## Ayarlar ve OBS Bağlantısı

Sistemin çalışması için Masaüstü uygulamasının OBS ile iletişim kurabilmesi gerekir.

1. **OBS'yi Hazırlayın:**
   * OBS'de üst menüden `Araçlar > WebSocket Sunucu Ayarları`na girin, etkinleştirin ve "Bağlanma Bilgilerini Göster" butonuna tıklayarak ilgili bilgileri not edin.
   * OBS'de yansıtma yapmak istediğiniz bir **Sahne** oluşturun (örn: `Sahne`).
   * Bu sahnenin içine bir **Tarayıcı (Browser)** kaynağı ekleyin ve ismini belirleyin (örn: `HelperImage`). URL vs. girmenize gerek yoktur.

2. **Uygulama Ayarlarını Girin:**
   * İndirip çalıştırdığınız Masaüstü uygulaması sağ alt köşede (Sistem tepsisinde) yeşil bir ikon olarak belirecektir.
   * İkona sağ tıklayıp **Ayarlar** menüsünü açın.
   * Daha önce not ettiğiniz OBS WebSocket bilgilerinizi (IP: `WS://{IP:PORT}` ve Şifre) girin.
   * OBS'de oluşturduğunuz **Sahne Adı** ve **Tarayıcı Kaynağı Adı** bilgilerini yazıp **Kaydet**'e basın.

---

## Nasıl Kullanılır?

Ayarları tamamladıktan sonra kullanım çok basittir:

* **Resimler:** Tarayıcıda herhangi bir resme sağ tıklayıp **"OBS'de Göster (Resim)"** seçeneğine tıklayın.
* **Videolar:** YouTube veya herhangi bir sitede video izlerken klavyeden `Alt + S` kısayoluna basın ve sayfadaki videonun üzerine sol tıklayın. Video yüksek kalitede (1080p 60fps) canlı olarak OBS'ye yansıyacaktır. Yayını durdurmak için eklenti menüsünü veya tekrar kısayolu kullanabilirsiniz.
