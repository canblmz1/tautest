# Tautest kullanıcı doğrulaması ve büyüme yol haritası

Tarih: 22 Ekim 2026. İlk karar dönemi: 22 Ekim–21 Kasım. Mühendislik ve önceliklendirme sorumlusu: ana asistan. Karar: desteklenen dar akışta devam etmek ve yatırımı bağımsız kullanıcı faydasına bağlamak.

Tautest’in ürün hedefi, geliştiricinin kendi projesindeki bir test açığını anlayıp kapatması ve sonraki değişiklikte araca yeniden başvurmasıdır. Ana `tautest` paketinde kayan 30 günlük dönemde 200.000 indirme uzun vadeli hedeftir; bu hedef için henüz güvenilir bir tarih yoktur.

## Başlangıç durumu

| Ölçüm | 22 Ekim başlangıcı | Kaynak ve sınır |
| --- | --- | --- |
| Ana paket indirmesi | 1.558 / 30 gün | 22 Eylül–21 Ekim; sorgu 22 Ekim 18:41 UTC; npm Downloads API |
| İncelenen mevcut aday | 5 proje | Vimgym, TriAD, Sleepypod, Nodal ve Ledgr |
| Bu adaylarda bağımsız deneme | 0 doğrulanmış | Gerçek küresel kullanıcı sayısı bilinmiyor |
| Bakımcının doğruladığı fayda / test iyileştirme / tekrar kullanım | 0 / 0 / 0 doğrulanmış | Bizim pilot koşularımız bu sayılara dahil değil |
| Teknik kanıt | Vimgym’de davranış testi ve aynı mutantın doğrulanması | Eski rapordaki hedef; güncel PR kapsamı veya bağımsız kullanım kanıtı değil |

İlk kullanıcılar için tek paketli, desteklenen Node/Vitest projelerine odaklanılacak. İlk değer zinciri: **mevcut rapor veya küçük kaynak değişikliği → anlamlı bulgu → küçük davranış testi → aynı mutantı doğrulama → başka değişiklikte tekrar kullanım**.

## Aşamalar ve karar kapıları

| Dönem | Teslim | Geçiş ölçütü |
| --- | --- | --- |
| 22–24 Ekim | Tek desteklenen akış için temiz kurulum kontrolü, sürüm ayrımı ve pilot kayıt düzeni | Kurulum ve ilk rapor komutları yeniden üretilebilir; engeller adlarıyla kayıtlı |
| 25 Ekim–5 Kasım | Vimgym ve TriAD öncelikli bağımsız denemeler | En az 2 bakımcı kendi projesinde çalıştırır; en az 1’i anlamlı faydayı doğrular |
| 6–21 Kasım | İlk engellerin dar düzeltmeleri ve ikinci kullanım | En az 2 proje faydayı doğrular; en az 1 proje ayrı tarihte yeni değişiklikte tekrar kullanır |
| İlk kapı geçildikten sonra | İlk ürün doğrulaması | 5 bağımsız projede doğrulanmış fayda; bunlardan en az 3’ünde tekrar kullanım |
| Beş proje kapısı geçildikten sonra | Tekrarlanabilir edinim | 20 aktif bağımsız proje ve 4 haftalık tekrar kullanım/vazgeçme takibi |
| Edinim kanalı doğrulandıktan sonra | Ölçekleme | Tekrar kullanan proje getiren kanalı büyütmek; ana paketin 30 günlük indirmelerini 200.000 hedefine karşı izlemek |

Bu sayılar yatırım ve öğrenme eşikleridir. Bakımcıların denemesi veya bu sayılara belirli tarihte ulaşılması garanti edilmez. Sonraki aşamalar için tarih, önceki kapı geçilmeden sabitlenmez.

## İlk üç gün için işler

### R01 Sürüm ve ilk kurulum yolunu sabitle

Sorumlu: ana asistan. Bağımlılık: yok.

Yayımlanmış sürüm, güncel main ve varsa yayımlanmamış adayın SHA’sı ayrı kaydedilecek. #54’ün güncel commit ve kontrolleri yeniden okunacak; önceki commit’in yeşil sonucu yenisine taşınmayacak. Adaya ihtiyaç duyan deneme açıkça aday denemesi olarak etiketlenecek. Yayın bekletmesi korunacak.

README ve CLI örneklerindeki eski sürüm/pinler, desteklenen ilk kurulum yoluyla karşılaştırılacak. Kanıtlanan bir tutarsızlık varsa ayrı, küçük belge PR’ı hazırlanacak; sürüm yayınlanmış gibi gösterilmeyecek.

Kabul: bağımsız bir temiz dizinde gerçekten denenmiş kısa kurulum ve ilk rapor komutları; Node, pnpm, Vitest, Stryker core/runner ve Tautest sürümleri; beklenen çıktı ve elle müdahalelerin kaydı. Komutlar kullanıcı dosyalarını değiştirmeyecek. Tarihsel pilotun eski sürümü kanıt kaydında korunacak.

### R02 Kullanıcı kanıt kaydını aç

Sorumlu: ana asistan; ikinci ajan kayıt tutarlılığını inceleyebilir. Bağımlılık: yok; R01 ile paralel yürüyebilir.

Planlanan kayıt yeri: `docs/evidence/adoption/validation-ledger.json`. Her proje için repo, kaynak SHA’sı, sürüm, kurulum sonucu, ilk anlamlı sonuç süresi, bakımcı teyidi, test değişikliği, tekrar kullanım SHA/tarihi, engel ve kaynak bağlantısı tutulacak. Bilinmeyen alanlar açıkça bilinmiyor olarak kalacak.

Kabul: bizim denemelerimiz ile bakımcının kendi koşusu ayrı satır türlerinde; npm indirmeleri ayrı ölçümde. Örnek kayıtların hiçbiri kullanıcı sayısını artırmayacak. Varsayılan telemetri eklenmeyecek.

### R03 Vimgym ve TriAD teslimlerini kontrol et

Sorumlu: ana asistan. Bağımlılık: R01.

Vimgym’de mevcut raporun incelenmesi ve tek hedefin doğrulanması kullanılacak. Line 22 hedefinin eski rapor borcu olduğu korunacak; bunu güncel diff keşfi diye sunmayacağız. TriAD’de Address sınırı için yalnız ilgili unit test yolu kullanılacak; PostgreSQL/Redis entegrasyonları bu ilk pilota katılmayacak.

Kabul: her proje için sabit kaynak, mevcut testlerin başlangıç sonucu, küçük test patch’i, gerçek komutlar, beklenen çıktı ve sınırlamalar tek teslimde bulunur. Eski rapor yeni kaynakla sessizce eşleştirilmez. Projenin güncel hali kanıtla uyuşmazsa pilot güncellenir veya durdurulur.

## 5 Kasıma kadar bağımsız deneme

### R04 İlk iki bakımcı denemesini doğrula

Sorumlu: ana asistan; koşuyu bakımcı yapar. Bağımlılıklar: R02 ve R03.

Vimgym ve TriAD ilk sırada kalır. Mevcut davetler tekrarlanmaz. Yanıt veren bakımcıdan kendi projesindeki ilk komutu ve ilk sonuç veya hatayı paylaşması istenir; yalnız bizim onun yerine koşmamız benimseme sayılmaz.

İlk anlamlı sonuç için başlangıç ve bitiş zamanları, elle müdahaleler ve seçilen kapsam kaydedilir. Ölçülmeden hız veya kolaylık iddiası yazılmaz. Hata varsa zincirin koptuğu ilk adım mühendislik önceliği olur.

Kabul: bakımcının paylaştığı çıktı, public CI koşusu veya açık teyitle en az iki ayrı projenin kendi denemesi; en az bir bakımcının gerçek bir davranış açığını veya uygulanabilir test iyileştirmesini teyit etmesi.

### R05 Yanıtsızlıkta sınırlı ikinci turu aç

Sorumlu: kullanıcı araştırması ajanı; teknik doğrulama ana asistanda. Bağımlılık: R03 hazır ve ilk turda deneme için gönüllü bulunamamış olması.

28 Ekim kontrolünde mevcut adaylarda deneme ilerlemiyorsa en fazla üç yeni, ihtiyacı kanıtlanmış proje için uygunluk araştırılabilir. Güncel açık ihtiyaç, desteklenen ortam ve küçük yeniden üretilebilir örnek şarttır. Sayıyı doldurmak için zayıf aday eklenmez. Her dış temasın mevcut yetki kapsamı kontrol edilir; proje başına bir teknik davet sınırı korunur. Dış PR bu görevin parçası değildir.

Sleepypod yalnız rapor inceleme ihtiyacı için, Nodal yalnız geçerli normal test başlangıcı elde edilirse, Ledgr ise zaten giderilmiş test açığını yeni bulgu saymadan değerlendirilir. Yeni tarama, görüşme ve davet sayısı ürün başarısı değildir.

Kabul: uygun veya elenmiş her proje için tek gerekçe ve tek sonraki adım; yanıt gelmeme nedeni bakımcı söylemedikçe bilinmiyor.

### R06 İlk kullanım engelini küçük bir düzeltmeyle kapat

Sorumlu: ana asistan; bağımsız kod incelemesi diğer ajanda. Bağımlılık: R04 veya R05’te yeniden üretilebilir bir engel.

Öncelik sırası: yanlış/yanıltıcı sonuç, desteklenen ortamda kurulum, anlaşılmayan bulgu, doğrulama sorunu, sonra ölçülmüş çalışma maliyeti. Kanıtlanan Tautest hatası için başarısız regresyon, dar düzeltme, ilgili testler, paketlenmiş CLI kontrolü, Changeset ve son SHA CI takibi yapılır. Raporun skoru veya ham mutant durumu başarı göstermek için değiştirilmez.

Kabul: aynı bakımcı başlangıçta takıldığı adımı yeniden deneyebilir. Düzeltme sayısı fayda ölçümüne yazılmaz; bakımcının sonucu ayrı teyit edilir. Ürün hatası yoksa sırf PR açmak için kod değişmez.

## 21 Kasıma kadar fayda ve tekrar kullanım

### R07 İki projede faydayı doğrula

Sorumlu: ana asistan; teyit bakımcıda. Bağımlılık: bağımsız deneme.

Bir bulgu için özgün testlerin geçtiği, hedef mutantın gerçekten çalışıp yaşadığı, yeni davranış testinin özgün kodda geçtiği ve aynı replacement ile davranış assertion’ında başarısız olduğu gösterilir. Eşleştirme kaynak hash’i, dosya, konum, mutator ve replacement üzerinden yapılır. Derleme hatası veya timeout öldürme kanıtı değildir. NoCoverage durumunda önce seçim, yapılandırma ve coverage atfı kontrol edilir.

Kabul: iki bağımsız proje anlamlı faydayı kendi sonucu ile teyit eder. Varsa kabul edilen test değişikliği bağlantısı eklenir. Eşdeğer mutantın doğru ayrılması fayda olarak ayrıca anlatılabilir; test iyileştirmesi sayısına yazılmaz.

### R08 Yeni değişiklikte tekrar kullanım isteğini sınayarak ölç

Sorumlu: ana asistan; koşuyu bakımcı yapar. Bağımlılık: R07’de en az bir fayda.

Bakımcıya yeni bir kaynak veya test değişikliğinde mevcut akışı tekrar kullanma imkânı sunulur. Yeni tarih ve değişiklik SHA’sı kaydedilir. Aynı raporu iki kez analiz etmek veya bizim iki kez verify çalıştırmamız tekrar kullanım değildir. Projede yeni değişiklik fırsatı yoksa bunu terk etme diye sınıflandırmayız.

Kabul: en az bir bağımsız proje yeni değişiklikte tekrar kullanır; ikinci kullanımda kalan elle müdahaleler ve engeller kaydedilir.

### R09 21 Kasım yatırım kararını ver

Sorumlu: ana asistan. Bağımlılıklar: R04–R08 kayıtları.

İki projede fayda ve bir gerçek tekrar kullanım oluşursa beş fayda/üç tekrar hedefiyle devam edilir. Sonuç eksikse bilinmeyenler, bakımcı geri bildirimi ve ölçülen engeller ayrılır; hedefi tutturmak için bizim koşularımız kullanıcı sayısına eklenmez.

Bağımsız fayda veya tekrar kullanım oluşmamışsa aktif özellik yatırımını durdurup bakım moduna geçme kararı değerlendirilir. Bakımcılar mevcut Stryker akışına ek değer görmüyorsa veya desteklenen ilk değer adımı tekrar tekrar aşılamıyorsa arşiv önerisi hazırlanır. Sessizlik tek başına vazgeçme nedeni değildir; arşivleme otomatik yapılmaz.

## Kanıt sonrası büyüme

### R10 Beş fayda ve üç tekrar kullanım

Bağımlılık: R09 devam kapısı.

Başarılı kullanıcı tipine benzeyen projelere küçük gruplarla ilerlenir. Bakımcının izniyle bir gerçek vaka anlatılır: sorun, önceki test, mutant, test düzeltmesi, doğrulama ve sınırlamalar. Kalan ilk kullanım engelleri dışında özellik kapsamı genişletilmez.

Kabul: beş bağımsız projede doğrulanmış fayda; en az üçünün ayrı tarihte başka değişiklikte tekrar kullanımı. İşe yaramayan denemeler de kayıtta tutulur.

### R11 Yirmi aktif projede dört haftayı izle

Bağımlılık: R10.

Aktif proje, son 28 gün içinde kendi kaynak/test değişikliği üzerinde anlamlı Tautest kullanımını kanıtlayan bağımsız projedir. Yalnız paketi kurmak, CI’ın bağımlılığı indirmesi veya otomatik örnek koşu yeterli değildir. Haftalık kayıtlar; tekrar kullanım, vazgeçme nedeni, yeni değişiklik fırsatı ve destek ihtiyacını ayırır.

Kabul: yirmi aktif proje, dört haftalık takip ve hangi edinim yolunun tekrar kullanan proje getirdiğinin gösterilmesi. Eksik veri oranı da raporlanır.

### R12 İndirme hedefine kanıtlı kanallarla ilerle

Bağımlılık: R11.

Üç kanal küçük deneylerle karşılaştırılır: ihtiyacı olan projelerde teknik yardım, bakımcı tarafından doğrulanmış vaka anlatımı ve mevcut topluluk/araç dokümanlarındaki uygun yönlendirmeler. Her kanalda aday → kendi denemesi → fayda → tekrar kullanım sayıları ve harcanan destek süresi izlenir. Kaynağı bilinmeyen kullanım bilinmiyor olarak kalır; varsayılan telemetri kurulmaz.

Tekrar kullanan proje getiren kanal büyütülür. README, CI tarifi ve ilk kullanım yolu gerçek başarısızlıklara göre iyileştirilir. Ücretli tanıtım bu planın başlangıç kapsamına dahil değildir. Yalnız ana `tautest` paketinin kayan 30 günlük indirmeleri ölçülür; core ile toplanmaz ve kullanıcı sayısı olarak sunulmaz. 200.000’e ulaşma takvimi ancak kanal ve tekrar kullanım verisi oluştuğunda tahmin edilir.

## Bakım ve çalışma düzeni

Ana asistan öncelik seçer, engeli yeniden üretir, küçük PR hazırlar, son commit CI’ını izler ve kullanıcı kanıt kaydını günceller. İki ajan kullanılırsa biri kullanıcı/kanıt araştırmasını, diğeri bağımsız teknik incelemeyi yürütür. Değişikliği hazırlayan ile bağımsız inceleyen aynı ajan olmaz.

Kod değişikliğinde ilgili regresyonlara ek olarak repo kurallarındaki `pnpm lint`, `pnpm typecheck`, `pnpm test` ve `pnpm build` çalıştırılır. Ortam hataları başlangıç sonuçlarından ayrılır. CI sonuçları son commit’e ait olmalıdır. Sürüm hizalama ve Changeset kuralı korunur; yeni bağımlılık ve geniş refactor için ölçülmüş kullanıcı gerekçesi aranır.

Haftalık rapor altı şeyi içerir: çözülen kullanıcı sorunu, test/PR/CI durumu, nitelikli adaylar, bağımsız kullanım kanıtı, ilk büyük engel ve sonraki tek görev. İndirme verisinde kaynak, sorgu zamanı ve tarih aralığı bulunur. Bakım sırasında yalnız desteklenen yoldaki doğruluk, kurulum ve kaynak israfı sorunları öncelik alır; yeni dil, dashboard, otomatik test yazarı ve genel monorepo genişlemesi dondurulur.

Yayın, deploy, ücretli işlem ve arşivleme için mevcut yetki sınırları korunur. Bu yol haritası bunlar için yeni onay oluşturmaz.

22 Ekim ek yetki: kullanıcı, kontrolleri ve bağımsız incelemesi tamamlanan ürün/belge PR'larının merge kararını ana asistana devretti. Sürüm PR'ını birleştirmenin otomatik npm yayını doğurduğu durumda ayrıca geçerli yayın yetkisi kontrol edilir. Güncel yürütme kaydı [kullanıcı doğrulama ilerlemesinde](evidence/adoption/validation-progress.md) tutulur; geçmiş kontrol kayıtları tarihleriyle korunur.

## Kaynaklar

- [22 Ekim kullanıcı kanıt kaydı](evidence/adoption/validation-ledger.json)
- [Ana paket 30 günlük npm verisi](https://api.npmjs.org/downloads/point/2026-09-22:2026-10-21/tautest)
- [Vimgym sabit teknik pilotu](https://github.com/canblmz1/tautest/tree/fd1b777868e945070df0ed7fc6bbcd27bc1f9521/docs/evidence/adoption/vimsplain/pilot-2026-10-21)
- [TriAD ihtiyacı](https://github.com/Thang4869/TriAD-Backend/issues/145)
- [Stryker incremental çalışma sınırı](https://github.com/stryker-mutator/stryker-js/blob/master/docs/incremental.md)
- [Sürüm adayı 54](https://github.com/canblmz1/tautest/pull/54)
