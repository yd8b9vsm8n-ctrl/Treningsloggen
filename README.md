# Treningslogg

En app for å registrere treningsøkter på treningssenteret – styrke (vekt × reps) og
innendørs kondisjon (mølle, spinning, romaskin osv.) – med historikk og statistikk
over fremgangen din.

Appen er en **PWA** (installerbar nettapp): den legges på hjemskjermen som en vanlig
app, fungerer uten nett og lagrer alle data lokalt på telefonen.

## Funksjoner
- «Registrer økt» → legg til øvelser. Styrke føres gjerne inn sett for sett underveis;
  løping/sykling o.l. fylles inn etter økta
- Styrke: velg **Repetisjoner** (kg × reps per sett) eller **1RM-test** (forsøk med kg og
  klarte/bommet – tyngste godkjente løft blir testet 1RM)
- **Egne mapper for økter:** velg eller lag en mappe («Lagre i mappe») når du registrerer,
  f.eks. «Beindag» eller «Intervaller». Historikk har visningene «Mapper» og «Alle økter».
  Mapper kan gis nytt navn og slettes (øktene flyttes da til «Uten mappe»), og økter kan
  flyttes mellom mapper fra ⋯-menyen eller inne i økta
- Øvelsesvelgeren er delt i mapper (Mest brukt, Bein, Bryst, Rygg, Skuldre, Armer, Mage,
  Kondisjon, Annet) som åpnes ved behov; søk viser treff direkte
- Hver kondisjonsøvelse har sitt eget oppsett av verdier:
  - Tredemølle: km/t og stigning · Spinning- og ergometersykkel: km/t, watt og motstand/nivå
  - AirBike: km/t, watt, tråkk per minutt og nivå · Crosstrainer: km/t og motstand/nivå
  - SkiErg og RoErg: tempo i min/500 m, tak per minutt og motstand
  - Trappemaskin: steg per minutt, etasjer, høydemeter, distanse og nivå (ingen fart)
  - Distanse kan byttes mellom meter og km på hver økt
- Nye øvelser: velg styrke (vekt og reps, eller tid som planke) eller kondisjon med
  distanse ja/nei og standardenhet, fart som km/t / min/500 m / ingen, og valgfrie felt
  (stigning, motstand/nivå, tak/min, tråkk/min, watt, steg/min, etasjer, høydemeter)
- Kondisjon – skjemaet tilpasser seg type økt:
  - **Utholdenhet / Rolig:** total tid, distanse, snittfart, stigning eller nivå, snittpuls,
    pluss valgfrie **segmenter** (tid, distanse, fart, stigning/nivå). Fyll inn to av tid,
    distanse og fart – det tredje regnes ut. Vises med fartsprofil.
  - **Terskel / Kondisjon-intervall:** velg antall intervaller med − / +, før inn tid og/eller
    distanse, fart og stigning/nivå per drag, og pause mellom dragene. «Kopier drag 1 til
    alle» for like intervaller. Arbeidstid, distanse, snittfart i dragene og total tid regnes ut.
- «Forrige gang» og rekord vises på hver øvelse, og forrige verdier står som hint i feltene
- «↺ Som sist» fyller inn alt fra forrige gang med ett trykk
- Følelse etter økta (5 nivåer), varighet og notat – pluss notat per øvelse
- Varsel ved ny personlig rekord 🏆
- Statistikk per øvelse: estimert 1RM, tyngste vekt, volum, flest reps / distanse,
  tid, snittfart, puls – med graf og tabell
- Økter per uke (siste 12 uker)
- Egne øvelser, «Gjenta økt», redigering av gamle økter
- Eksport/import (JSON) og eksport til regneark (CSV)

## Teste lokalt på PC
```
powershell -ExecutionPolicy Bypass -File tools/serve.ps1
```
Åpne http://localhost:5510

## Få appen over på mobilen
Mobilen må hente appen fra en **https-adresse**. Enkleste gratis måte:

**GitHub Pages**
1. Lag en gratis konto på github.com og et nytt repository (f.eks. `treningslogg`).
2. Last opp alle filene i denne mappen (dra og slipp på «Add file → Upload files»).
3. Gå til *Settings → Pages*, velg branch `main` og mappe `/ (root)`, trykk Save.
4. Etter et minutt er appen på `https://<brukernavn>.github.io/treningslogg/`.

(Alternativ: **Netlify** – logg inn på app.netlify.com og dra mappen inn under «Deploy manually».)

**Installere på telefonen**
- **iPhone:** Åpne adressen i Safari → Del-knappen → «Legg til på Hjem-skjerm».
- **Android:** Åpne i Chrome → meny (⋮) → «Installer app» / «Legg til på startskjermen».

## Om dataene
- Alt lagres kun på enheten (localStorage). Ingen server, ingen konto.
- Installer appen på hjemskjermen – på iPhone kan Safari ellers slette data for
  nettsider som ikke har vært brukt på en stund.
- Ta jevnlig sikkerhetskopi under **Mer → Eksporter data**, spesielt før du bytter telefon.

## Oppdatere appen
Når du endrer filene: øk versjonsnummeret i `sw.js` (`treningslogg-v1` → `v2`) og last
opp på nytt. Appen henter ny versjon neste gang den åpnes med nett.

## Veien til offentlig publisering (senere)
- **Som nettapp:** allerede klar – bare del adressen.
- **Google Play:** kan pakkes med PWABuilder (pwabuilder.com) eller Capacitor.
  Krever utviklerkonto (engangsavgift).
- **App Store:** pakkes med Capacitor. Krever Mac med Xcode og Apple Developer-konto
  (årlig avgift).
- Før offentlig lansering bør man vurdere: skylagring/synk mellom enheter,
  personvernerklæring, og mer testing på ulike telefoner.

## Filer
| Fil | Innhold |
|---|---|
| `index.html` | Sideskall og navigasjon |
| `styles.css` | Utseende (lyst og mørkt tema) |
| `app.js` | All logikk: registrering, historikk, statistikk, lagring |
| `sw.js` | Service worker for offline-bruk |
| `manifest.webmanifest` | App-navn, ikon og farger for installasjon |
| `icons/` | App-ikoner (lages på nytt med `tools/make-icons.ps1`) |
