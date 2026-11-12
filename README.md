# F LINE Mimarlık & Mühendislik – web sitesi

Statik site: `index.html` + `app.js` + `a/` (görseller, derinlik haritaları, yazı tipleri). Derleme adımı ve dış bağımlılık yok.

## Ne var

- **Kaydırma deneyimi (8 bölüm):** dış cephe → yaklaşım → giriş → salon → galeri → yatak odası → mühendislik → bütün.
  Her bölüm tek bir konsept fotoğrafıdır. Fotoğraftan çıkarılan derinlik haritası sayesinde kamera fotoğrafın içinde
  sınırlı ölçüde hareket eder (gerçek paralaks). Bölümler arası geçişler keskin kenarlı çizgi/açıklık maskeleridir;
  iki görsel hiçbir pikselde üst üste binmez. Bu bir 3D gezinti değildir.
- **Tasarım stüdyosu:** aynı kadrajın dört hazır malzeme ön ayarı (Orijinal, Modern Natural, Industrial Luxury,
  Contemporary Premium). Görseller piksel hizalıdır; "Orijinalle karşılaştır" kaydırıcısı bu yüzden çalışır.
  Gerçek zamanlı 3D model değildir.
- **Kurumsal bölümler:** hizmetler, projeler, hakkımızda, iletişim.

## Görseller

`asset-manifest.json` tek yetkili listedir: brief'teki görsel numarası → ZIP'teki dosya → sitedeki rol ve türevler.
ZIP'teki dosya numaraları brief'teki listeye göre bir kaymıştır (2.jpg = Görsel 1 … 1.jpg = Görsel 12); eşleme içeriğe
göre yapılmıştır. Kaynak görseller 2752×1536 pikseldir (4K değil).

Bir sahne görselini değiştirmek için: `a/sN.webp` (2752 px), `a/sN-1920.webp`, `a/sN-1100.webp` ve o görsele ait
derinlik haritası `a/dN.png` (1024×572, açık = yakın) birlikte yenilenmelidir.

## Bilinen sınırlar

- İletişim formu bir sunucuya bağlı değildir; talep metni kopyalanıp Instagram'dan iletilir.
- Telefon, e-posta, adres ve gerçek proje fotoğrafları ofisten gelince eklenecek.
- Sitedeki villa kavramsal bir çalışmadır; tamamlanmış bir F LINE projesi değildir.

## Yayın

`main` dalı Vercel'e, `gh-pages` dalı GitHub Pages'e yayınlanır. İki dal aynı içerikte tutulur.

Yazı tipleri: Fraunces, Hanken Grotesk, IBM Plex Mono (SIL OFL), `a/f/` altında.
Derinlik haritaları Depth Anything V2 ile üretilmiştir.

Tasarım: SYNCRO
