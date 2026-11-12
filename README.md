# F LINE Mimarlık & Mühendislik – web sitesi

Statik site: `index.html` + `app.js` + `a/` (görseller, derinlik haritaları, yazı tipleri). Ana sayfada derleme adımı ve dış
bağımlılık yok. Ayrı duran 3D prototip (`prototip/`) three.js kullanır.

## Dallar ve yayın

| Dal | Nereye yayınlanır | Durum |
| --- | --- | --- |
| `main` | Vercel (canlı) | Müşteriye gösterilen sürüm |
| `gh-pages` | GitHub Pages (canlı) | `main` ile aynı içerik |
| `dev` | Yalnızca önizleme | İnceleme bekleyen değişiklikler |

`dev` onaylanmadan `main` ve `gh-pages` dallarına aktarılmaz. Onaydan sonra: `main` ← `dev`, `gh-pages` ← `main`.

Yerelde bakmak için depo kökünde `python3 -m http.server 8000` çalıştırıp `http://localhost:8000/` adresini açın
(dosyayı çift tıklayarak açmak yetmez; görseller `fetch` ile yüklenir).

## Ne var

- **Kaydırma deneyimi (8 bölüm):** dış cephe → yaklaşım → giriş → salon → galeri → yatak odası → mühendislik → bütün.
  Her bölüm tek bir konsept fotoğrafıdır. Fotoğraftan çıkarılan derinlik haritası sayesinde kamera fotoğrafın içinde
  sınırlı ölçüde hareket eder (gerçek paralaks). Bölümler arası geçişler keskin kenarlı çizgi/açıklık maskeleridir;
  iki görsel hiçbir pikselde üst üste binmez. **Bu bir 3D gezinti değildir.**
  - Ekran fotoğraftan darsa (telefon, tablet, dar pencere) görsel yana sürüklenerek kadraj kaydırılır.
  - Bölüm çubuğundan uzak bir bölüme geçişte aradaki bölümler hızla geçilmez; kısa bir kararma ile kesme yapılır.
  - Düşük bellekli / veri tasarrufu açık cihazlarda hafif kademe çalışır: 1100 px görseller, daha az örnekleme,
    yalnızca ekrandaki bölüm ve komşuları yüklenir. `?lite` ile elle denenebilir.
- **Tasarım stüdyosu:** aynı kadrajın dört hazır malzeme ön ayarı (Orijinal, Modern Natural, Industrial Luxury,
  Contemporary Premium). Görseller piksel hizalıdır; "Orijinalle karşılaştır" kaydırıcısı bu yüzden çalışır.
  Seçim cihazda saklanır ve teklif talebine eklenir. Gerçek zamanlı 3D malzeme düzenleme değildir.
- **Kurumsal bölümler:** hizmetler, projeler, hakkımızda, iletişim.
- **3D prototip (`prototip/`):** aşağıya bakın. Ana sayfadan bağlantı verilmemiştir.

## İletişim formu

Form iki kipte çalışır; hangisinde olduğu `index.html` içindeki `<form id="form" data-endpoint="" data-key="">`
satırından belli olur.

- **`data-endpoint` boş (şu anki durum):** hiçbir veri gönderilmez. Alanlar doğrulanır, talep metni cihazda hazırlanır;
  ziyaretçi metni kopyalayıp Instagram mesajıyla iletir. Ekranda "gönderilmedi" yazar. Otomatik teslim **kapalıdır**.
- **`data-endpoint` dolu:** talep bu adrese JSON olarak POST edilir. "Talebiniz iletildi" yalnızca servis başarı
  yanıtı verdiğinde gösterilir; hata, ret ya da zaman aşımında "gönderilemedi" yazar ve elle iletim yolu açılır.
  Gönderim sırasında düğme kilitlenir; aynı talep ikinci kez gönderilmez. Gizli tuzak alan (`_gotcha`) botları eler.

Açmak için gerekenler: ofisin doğruladığı bir alıcı e-posta adresi ve o adrese bağlı bir form servisi hesabı.
- Formspree: `data-endpoint="https://formspree.io/f/FORM_KIMLIGI"`
- Web3Forms: `data-endpoint="https://api.web3forms.com/submit"` ve `data-key="ERISIM_ANAHTARI"`

Buraya yalnızca tarayıcıda görünmesi amaçlanan form kimliği / erişim anahtarı yazılır. SMTP parolası, API gizli
anahtarı gibi değerler bu depoya ve ön yüz koduna konmaz. Servis panelinde alan adı kısıtı ve spam koruması açılmalıdır.

## Görseller

`asset-manifest.json` tek yetkili listedir: brief'teki görsel numarası → ZIP'teki dosya → sitedeki rol ve türevler.
ZIP'teki dosya numaraları brief'teki listeye göre bir kaymıştır (2.jpg = Görsel 1 … 1.jpg = Görsel 12); eşleme içeriğe
göre yapılmıştır. Kaynak görseller 2752×1536 pikseldir (4K değil); büyütme (upscale) yapılmamıştır.

Sıkıştırma kaynaklara karşı ölçülmüştür: sahne görselleri 37,9–40,0 dB PSNR (2752 px) ve 36,9–39,6 dB (1920 px),
ön ayar görselleri 38,4–38,9 dB. Türetirken keskinleştirme, renk değişikliği ya da kırpma uygulanmaz.

Bir sahne görselini değiştirmek için: `a/sN.webp` (2752 px), `a/sN-1920.webp`, `a/sN-1100.webp` ve o görsele ait
derinlik haritası `a/dN.png` (1024×572, açık = yakın) birlikte yenilenmelidir.

## 3D prototip

`prototip/index.html` · kaynak `prototip/src/main.js` · derlenmiş `prototip/proto.js`

Konsept villanın gerçek geometriyle kurulmuş sade bir kütle modelidir: dış kütleler, kuzey giriş, duvarlar ve
açıklıklar, döşemeler, çatı, camlar, salon, merdiven, üst galeri, ebeveyn yatak odası. Kamera modelin içinde
tek bir eğri üzerinde gerçekten yol alır (güney havuz cephesi → doğudan dolaşıp kuzey giriş → hol → salon → merdiven →
galeri → koridor → yatak odası); bakış yönü ayrı bir eğriden okunur ve yumuşatılarak uygulanır.

Fotogerçekçi değildir: yüzeyler düz maket malzemesidir, ölçüler görsellerden tahmin edilmiştir. Bu yüzden fotoğrafik
anlatımın yerine konmamış, ayrı ve etiketli bırakılmıştır.

Derleme: `npm i three esbuild` sonrasında
`npx esbuild prototip/src/main.js --bundle --minify --format=iife --target=es2019 --outfile=prototip/proto.js`

### Fotogerçekçi 3D gezinti için gerekenler

Depoda, ZIP'te ve çalışma ortamında hazır bir mimari model yoktur; modelleme/render aracı (Blender vb.) da yoktur.
Aşağıdakiler sağlanmadan fotoğraf kalitesinde gerçek zamanlı 3D üretilemez:

1. **Tek ve tutarlı mimari model** – Revit, ArchiCAD, SketchUp ya da Blender'dan IFC / FBX / glTF. Ölçülü plan, kesit
   ve cephelerle. Mevcut 12 görsel aynı yapıyı her açıdan tutarlı göstermiyor (dış cephe ve kesitte dış merdiven,
   salonda iç merdiven; kesit ve genel görünüm aynı kadraj değil); model bu çelişkileri karara bağlamalıdır.
   Ofis 3D modelleme hizmeti verdiği için en doğru kaynak, F LINE'ın gerçek bir projesinin modelidir.
2. **PBR malzeme setleri** (albedo, normal, roughness; 2K–4K): cephe taşı, ahşap çıta, koyu bronz doğrama, zemin
   kaplamaları, havuz; dört ön ayar için dört taş + dört ahşap seti.
3. **Işık** – bir render motorunda (Cycles, V-Ray, Corona) fırınlanmış ışık haritaları ve gün batımı HDRI'si;
   ya da aynı kamera yolundan render edilmiş kare dizisi (bölüm başına 120–180 kare, en az 2560×1440).
   Kare dizisi, fotoğraf kalitesini web'e en güvenli taşıyan yoldur.
4. **Mobilya ve peyzaj modelleri** (lisanslı).
5. **Web'e hazırlık** – glTF + Draco/Meshopt, KTX2 dokular, mobil için sadeleştirilmiş kopya. Prototipteki kamera
   yolu, kaydırma eşlemesi ve bölüm arayüzü bu modelle aynen kullanılabilir.

## Bilinen sınırlar

- Otomatik form teslimi kapalı (doğrulanmış alıcı / form servisi yok).
- Telefon, e-posta, adres ve gerçek proje fotoğrafları ofisten gelince eklenecek. KVKK aydınlatma metni ofisten
  gelmelidir; form bir servise bağlanmadan önce eklenmelidir.
- Sitedeki villa kavramsal bir çalışmadır; tamamlanmış bir F LINE projesi değildir.
- Ana deneyim fotoğraf tabanlıdır; kamera yalnızca her fotoğrafın içinde sınırlı hareket eder.

Yazı tipleri: Fraunces, Hanken Grotesk, IBM Plex Mono (SIL OFL), `a/f/` altında.
Derinlik haritaları Depth Anything V2 ile üretilmiştir. 3D prototip: three.js (MIT).

Tasarım: SYNCRO
