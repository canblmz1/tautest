# Tautest 10/10 Açık Kaynak Büyüme Roadmap'i

Bu belge maintainer'lar ve AI coding agent'ları için hazırlanmış iç strateji dokümanıdır.
Public release sözü, resmi taahhüt veya marketing sayfası değildir.

## Kuzey Yıldızı

Tautest yeni bir mutation engine, generic test platformu, SaaS dashboard veya otomatik LLM test generator olmaya çalışmamalı.

En güçlü ürün yönü şudur:

> Tautest, değişen TypeScript kodu için PR mutation quality gate'tir.
> StrykerJS ile surviving mutant'ları bulur, sonra bunları insanlar ve coding agent'ları için aksiyona dönük test açıklarına çevirir.

Kısa konumlandırma:

> Patch coverage neyin çalıştığını gösterir. Tautest neyin hayatta kaldığını gösterir.

## Mevcut Durumun Dürüst Değerlendirmesi

Tautest faydalı bir araç, ama henüz kategori yaratan bir açık kaynak proje değil.

Mevcut güçlü taraflar:

- StrykerJS destekli mutation testing.
- Changed-line mutation scope.
- Markdown, JSON, terminal, GitHub comment, artifact ve job summary çıktıları.
- Claude Code, Cursor, Codex, OpenCode ve insanlar için deterministik fix prompt'ları.
- Local-first ve CI-friendly çalışma modeli.

Mevcut zayıf taraflar:

- Value proposition hâlâ biraz fazla "agent'lar için Stryker wrapper" gibi duyuluyor.
- Agent'lar zaten rapor okuyabiliyor; bu yüzden "AI-readable report" tek başına yeterince güçlü fark değil.
- En güçlü hikaye olan PR patch mutation quality henüz yeterince keskin değil.
- Surviving mutant'lar insan dilinde yeterince iyi açıklanmıyor.
- Demo ve onboarding hâlâ anında aha etkisi yaratacak kadar kolay değil.
- Monorepo desteği sınırlı.

Hedef durum:

- Tautest, değişen kodda mutation survival için Codecov patch coverage hissi vermeli.
- Bir PR reviewer raw Stryker çıktısını açmadan comment'ten test açığını anlayabilmeli.
- Bir AI agent geniş rapor dump'ı yerine küçük, deterministik, sadece-test görev paketi almalı.

## Faz 1: Patch Mutation Quality Etrafında Yeniden Konumlandırma

Amaç: Projenin 10 saniyede anlaşılmasını sağlamak.

Ana mesaj:

```text
Coverage değişen kodun çalıştığını gösterir.
Tautest, değişen davranış mutate edildiğinde testlerin gerçekten fail edip etmediğini kontrol eder.
```

Görevler:

- README dilini "patch mutation quality gate" etrafında güncelle.
- `docs/WHY_TAUTEST.md` dosyasını ekle.
- StrykerJS'ten farkı onunla rekabet etmeden açıkla.
- Coverage araçlarından farkı açıkla.
- Şu itiraza doğrudan cevap ver: "Agent'lar zaten rapor okuyabiliyor."

Kabul kriterleri:

- İlk kez gelen ziyaretçi Tautest'in mutation engine olmadığını anlamalı.
- İlk kez gelen ziyaretçi Tautest'in sadece AI prompt generator olmadığını anlamalı.
- Kategori net olmalı: changed-code mutation quality gate.

Önerilen metin:

```text
Mutation testing'i StrykerJS yapar.
Tautest, mutation testing'i değişen koda scope ederek ve survivor'ları review-ready test açıklarına çevirerek pull request'ler için pratik hale getirir.
```

## Faz 2: Aha Moment Demo'su Oluşturma

Amaç: Kullanıcıların entegrasyon yapmadan önce değeri görmesini sağlamak.

Görevler:

- `tautest demo` komutu veya dokümante edilmiş `npx tautest demo` akışı ekle.
- Normal testlerin geçtiği ama Tautest'in surviving boundary mutant yakaladığı demo fixture oluştur.
- Before/after akışını göster:
  - `npm test`: pass
  - `tautest`: mixed, bir boundary mutant survived
  - eksik test eklenir
  - `tautest`: strong, 100%
- Demo deterministik ve hızlı kalsın.
- README'ye demo akışını ve beklenen çıktıyı ekle.

Kabul kriterleri:

- Kullanıcı StrykerJS dokümanı okumadan ürünü anlayabilmeli.
- Demo iki dakikadan kısa sürmeli.
- Demo, coverage ile Tautest arasındaki farkı görünür yapmalı.

Örnek çıktı:

```text
Regular tests: PASS
Tautest: MIXED

src/discount.ts:2
age >= 65 survived as age > 65

Missing test gap:
Add a boundary test for age === 65.
```

## Faz 3: Mutant Explanation Engine Kurma

Amaç: Raw surviving mutant'ları faydalı review feedback'ine çevirmek.

Neden önemli:

Raw mutation raporları doğru olabilir ama çoğu zaman hemen aksiyona dönük değildir.
Proje, surviving mutant'ın muhtemelen ne anlama geldiğini açıklayabildiğinde çok daha değerli olur.

İlk açıklanacak mutant tipleri:

- `EqualityOperator`
- `ConditionalExpression`
- `BooleanLiteral`
- `ArithmeticOperator`
- `StringLiteral`
- `ArrayDeclaration`

Görevler:

- `packages/core` içinde structured explanation layer ekle.
- Yaygın Stryker mutant adlarını muhtemel test açıklarına map et.
- Original code, mutated code, explanation ve suggested test angle alanlarını üret.
- Explanation output için unit testler ekle.
- Açıklamaları Markdown report, GitHub comment, job summary ve fix prompt içinde kullan.

Kabul kriterleri:

- `age >= 65` mutant'ının `age > 65` olarak survive etmesi boundary-test explanation üretmeli.
- Raporlar raw Stryker context'i olmadan insan reviewer için faydalı olmalı.
- Prompt output, agent'lara production code değiştirmeden hangi test davranışını güçlendirmeleri gerektiğini söylemeli.

Örnek:

```text
Surviving mutant:
age >= 65 -> age > 65

Likely missing behavior:
The exact boundary value is not protected.

Suggested test:
Add a test for age === 65 and assert that the senior discount applies.
```

## Faz 4: PR Comment'i Quality Gate Seviyesine Taşıma

Amaç: GitHub PR feedback'inin polished review tool gibi hissettirmesi.

Görevler:

- "Patch Mutation Score" terminolojisini ekle.
- PR comment'i verdict odaklı yap:
  - Strong
  - Mixed
  - Weak
  - No changed source
- Threshold, score, killed, survived ve no-coverage sayılarını göster.
- En önemli surviving mutant'ları explanation ile göster.
- Raw data için collapsible details ekle.
- Artifact ve fix prompt linklerini göster.
- Mevcut comment mode'larını koru:
  - `never`
  - `changes`
  - `always`
- Gelecek modları değerlendir:
  - `summary`
  - `full`

Kabul kriterleri:

- Reviewer yalnızca PR comment'e bakarak ne yapacağını anlayabilmeli.
- Comment gate'in neden fail olduğunu açıklamalı.
- Comment PR gürültüsü yaratmayacak kadar kısa olmalı.

Örnek:

```text
Tautest Patch Mutation Gate: MIXED

Patch Mutation Score: 75.00%
Threshold: 80.00%

Blocking survivors:
1. src/discount.ts:2
   age >= 65 -> age > 65
   Missing boundary test for age === 65.
```

## Faz 5: Faydalı Dry-Run Preview Ekleme

Amaç: Tautest'in pahalı mutation testlerini çalıştırmadan önce ne yapacağını öngörülebilir hale getirmek.

Görevler:

- `tautest run --dry-run` çıktısını iyileştir.
- Changed production file'ları göster.
- Dahil edilen line range'leri göster.
- Excluded file'ları ve exclusion reason'ları göster.
- Scope size tahmini yap:
  - small
  - medium
  - large
- Çok fazla changed line veya file olan riskli PR'larda uyarı ver.

Kabul kriterleri:

- Kullanıcı Tautest'in neden bir dosyayı seçtiğini anlayabilmeli.
- Beklenmeyen mutation scope debug edilebilmeli.
- CI log'ları daha güvenilir hissettirmeli.

Örnek:

```text
Changed production files:
- src/discount.ts lines 2-4

Excluded:
- src/discount.test.ts: test file
- README.md: non-source file

Estimated mutation scope: small
```

## Faz 6: Monorepo Beta Ekleme

Amaç: Tautest'i modern TypeScript repo'ları için pratik hale getirmek.

Görevler:

- Git diff üzerinden changed package/workspace tespiti yap.
- `--workspace <name-or-path>` ekle.
- `--workspaces changed` ekle.
- Per-workspace config resolution destekle.
- Per-workspace report üret.
- GitHub Action matrix dokümanı ekle.
- pnpm workspace fixture testleri ekle.

Kabul kriterleri:

- pnpm monorepo yalnızca değişen package için Tautest çalıştırabilmeli.
- Raporlar workspace bilgisini göstermeli.
- Monorepo kullanıcıları basic kullanım için custom shell glue yazmak zorunda kalmamalı.

Örnek:

```bash
pnpm exec tautest run --workspaces changed --base origin/main
```

## Faz 7: Runtime ve Mutation Budget Ekleme

Amaç: Mutation testing'in CI'ı çok yavaşlatacağı korkusunu azaltmak.

Görevler:

- `--max-mutants <number>` ekle.
- `--time-budget <duration>` ekle.
- `--max-files <number>` davranışını iyileştir.
- `--fail-fast-survivor` seçeneğini değerlendir.
- Partial run olduğunda bunu açıkça raporla.
- Partial run'ları dürüst tut; full quality kanıtı gibi gösterme.

Kabul kriterleri:

- Küçük PR'lar hızlı çalışabilmeli.
- Büyük PR'lar faydalı feedback ile graceful şekilde sonuçlanmalı.
- Kullanıcılar Tautest'i sınırsız CI runtime korkusu olmadan benimseyebilmeli.

Örnek:

```bash
tautest run --base origin/main --max-mutants 30 --time-budget 5m
```

## Faz 8: Machine-Readable Output'u Stabilize Etme

Amaç: Tautest'i agent'lar, CI sistemleri ve gelecek entegrasyonlar için güvenilir hale getirmek.

Görevler:

- `report.json` içine `schemaVersion` ekle.
- `docs/report.schema.json` yayınla.
- Stable ve experimental field'ları dokümante et.
- Schema validation testleri ekle.
- GitHub Action output'larını genişlet:
  - verdict
  - score
  - threshold
  - killed
  - survived
  - noCoverage
  - report path
  - prompt path

Kabul kriterleri:

- AI agent'lar ve external tool'lar stable JSON contract'a güvenebilmeli.
- Breaking report değişiklikleri schema version update gerektirmeli.
- GitHub Action başka workflow step'leriyle compose edilebilmeli.

## Faz 9: Agent Workflow Pack'leri Oluşturma

Amaç: "Agent'lar rapor okuyabiliyor" itirazını raw rapordan daha iyi görev paketleriyle anlamsız hale getirmek.

Görevler:

- Prompt style'ları koru:
  - `codex`
  - `claude-code`
  - `cursor`
  - `opencode`
  - `agent`
  - `human`
- Targeted prompt generation ekle:

```bash
tautest prompt --target survivor:1 --style codex
```

- Prompt section'ları ekle:
  - test-only contract
  - target survivor
  - suspected missing behavior
  - files to inspect
  - verification commands
  - explicit non-goals

Kabul kriterleri:

- Agent'lar full mutation report yerine küçük bir görev almalı.
- Prompt production-code değişikliğini caydırmalı.
- Prompt generic coding agent'a yapıştırıldığında bile faydalı olmalı.

## Faz 10: GitHub Action'ı Marketplace-Grade Yapma

Amaç: CI kullanıcıları için adoption friction'ı azaltmak.

Görevler:

- Dependency'ler tamamen desteklediğinde action runtime'ı Node 24'e taşı.
- Monorepo path kafa karıştırmaya devam ederse standalone action repository seçeneğini değerlendir.
- Action dokümanlarını iyileştir:
  - Vitest
  - Jest
  - pnpm monorepo
  - fork PR safe mode
  - no-comment mode
  - threshold tuning
- Action smoke testlerini genişlet:
  - comment skipped
  - comment updated
  - fork-safe permissions
  - artifact upload
  - cache restore/save logging

Kabul kriterleri:

- Kullanıcı workflow'u copy-paste edebilmeli ve local package build etmek zorunda kalmamalı.
- GitHub Marketplace sunumu güvenilir görünmeli.
- Security ve permission tradeoff'ları açık olmalı.

## Faz 11: Trust ve Safety'yi Güçlendirme

Amaç: Ekiplerin Tautest'i CI'da çalıştırırken rahat hissetmesini sağlamak.

Görevler:

- Tautest'in diske tam olarak ne yazdığını dokümante et.
- Tautest'in LLM API çağırmadığını dokümante et.
- Report ve prompt output path handling'i harden et.
- Comment ve summary Markdown'ını sanitize et.
- Fork PR safety dokümanı ekle.
- Dependency review/audit notları ekle.
- Malicious filename ve mutant text için security testleri ekle.

Kabul kriterleri:

- Kullanıcı default durumda repo dışına hangi verinin çıktığını bilmeli: CI'da GitHub comment/artifact dışında hiçbir şey.
- PR comment'leri Markdown injection'a dayanıklı olmalı.
- Output path'ler beklenen dizinlerin dışına kaçamamalı.

## Faz 12: Launch ve Dağıtım

Amaç: Projeyi keşfedilebilir ve kolay açıklanabilir yapmak.

Görevler:

- Launch copy'yi patch mutation quality etrafında yeniden yaz.
- Kısa demo GIF ve terminal transcript oluştur.
- Karşılaştırma dokümanları yaz:
  - Tautest vs StrykerJS
  - Tautest vs coverage
  - Tautest vs Codecov patch coverage
  - Tautest vs AI test generators
- Şeffaf Reddit/Hacker News tarzı açıklama paylaş:
  - StrykerJS'i kabul et ve credit ver
  - agent'ların rapor okuyabildiğini kabul et
  - workflow, scoping ve actionability farkını açıkla
- Issue template'leri ekle:
  - runner support
  - monorepo support
  - false positive / confusing mutant
  - docs example request

Kabul kriterleri:

- Proje skeptical comment'lere savunmaya geçmeden cevap verebilmeli.
- Dokümanlar kullanıcı sormadan bariz itirazları cevaplamalı.
- Yeni kullanıcı Tautest'in kendisine uygun olup olmadığını anlayabilmeli.

## Başarı Metrikleri

Adoption metrikleri:

- İlk faydalı local run süresi 5 dakikanın altında.
- İlk GitHub Action PR comment süresi 10 dakikanın altında.
- Demo completion rate.
- GitHub star ve npm download ikincil metriklerdir; ana metrik değildir.

Quality metrikleri:

- En az bir explained surviving mutant içeren run oranı.
- Aksiyona dönük output veren PR comment oranı.
- False-positive veya confusing explanation raporları.
- Example project'lerde median runtime.

Maintenance metrikleri:

- Core workflow'a yeni LLM API dependency eklenmemesi.
- Custom mutation engine scope creep olmaması.
- CI'ın makul runtime budget içinde kalması.
- Release workflow'un yeşil ve rerunnable kalması.

## Tautest'in Dönüşmemesi Gereken Şeyler

- StrykerJS replacement.
- Generic test platformu.
- Local/CI workflow mükemmel olmadan SaaS dashboard.
- Generic AI test generator.
- Kullanıcının kodunu gizlice LLM API'larına gönderen araç.
- Coverage replacement.
- TypeScript/Vitest/Jest çok iyi olmadan multi-language framework.

## Öncelik Sırası

Sadece beş şey yapılabilecekse şunlar yapılmalı:

1. Mutant explanation engine.
2. Patch Mutation Score positioning.
3. Demo command.
4. PR comment 2.0.
5. Monorepo beta.

Tautest'i "faydalı wrapper" seviyesinden "ciddi PR quality tool" seviyesine taşıma ihtimali en yüksek değişiklikler bunlardır.

## Önerilen İlk Implementation Batch'i

Batch 1 küçük ama yüksek etkili olmalı:

1. `docs/WHY_TAUTEST.md` ekle.
2. README positioning'i patch mutation quality etrafında güncelle.
3. `EqualityOperator` için explanation output ekle.
4. Boundary mutant gösteren bir demo fixture ekle.
5. PR comment copy'sinde "Patch Mutation Score" dilini kullan.

Batch 1 kabul kriterleri:

- Büyük mimari rewrite yok.
- Mevcut CLI davranışı compatible kalır.
- İlk explanation case'i testlerle kaplanır.
- README, Reddit itirazına temiz cevap verebilir.

## Reddit İtirazına Cevap

İtiraz:

```text
How is this different from all the other mutation testing tools?
Pretty sure agents can read the reports?
```

En iyi cevap:

```text
Fair point. Tautest is not trying to be a new mutation engine or claim that agents cannot read mutation reports.

StrykerJS does the mutation testing. Tautest sits around it and focuses on pull requests: it maps the git diff to changed source lines, runs Stryker on that smaller mutation scope, extracts the surviving mutants, and turns them into PR-friendly Markdown/JSON, GitHub comments, job summaries, artifacts, and an AI/human test-fix prompt.

So the value is not "agents cannot read reports." They can. The value is giving them a small, deterministic task packet: these changed lines survived mutation, here is the exact missing behavior, strengthen tests only, do not change production code, then rerun the suite.

If you already run Stryker on every PR and your agents reliably parse the reports and turn them into good test-only fixes, Tautest may not add much. It is mainly for teams that want mutation testing to become a changed-code PR quality gate with lower setup and review friction.
```

Türkçe iç yorum:

```text
Buradaki strateji savunmaya geçmek değil.
"Evet, agent'lar rapor okuyabilir" diyerek başlamak daha güçlü.
Sonra farkı mutation engine değil, PR workflow/scoping/actionability olarak konumlandırmak gerekir.
```

## Nihai Ürün Şekli

Tautest 10/10 olduğunda şu işi tutarlı şekilde yapabilmeli:

1. PR'a bak.
2. Değişen production behavior'ı tespit et.
3. StrykerJS'i yalnızca önemli scope üzerinde çalıştır.
4. Surviving mutant'ları insan dilinde açıkla.
5. Review kalitesinde PR comment'i gönder.
6. AI agent veya insan için küçük, sadece-test görev paketi üret.
7. Eklenen testlerin mutant'ı gerçekten öldürdüğünü doğrula.

Ürün budur.
