/* Personvern og kundestøtte – samme tekst i appen (#/personvern, #/kundestotte)
   og på nettsidene personvern.html og kundestotte.html, som App Store lenker til. */
window.LEGAL = (function () {
  var EMAIL = 'kontakt.treningsloggen@outlook.com';
  var mail = '<a href="mailto:' + EMAIL + '">' + EMAIL + '</a>';
  var UPDATED = '22. november 2026';
  return {
    email: EMAIL,
    eula: 'https://www.apple.com/legal/internet-services/itunes/dev/stdeula/',
    privacy:
      '<h2>Personvernerklæring</h2>' +
      '<p class="legal-date">Sist oppdatert ' + UPDATED + '</p>' +
      '<p><b>Sammendrag:</b> Treningsloggen samler ikke inn personopplysninger. Alle opplysninger du registrerer i appen, lagres utelukkende lokalt på din egen enhet.</p>' +
      '<h3>1. Hvilke opplysninger som behandles, og hvor de lagres</h3>' +
      '<p>Treningsøkter, øvelser, profilopplysninger og innstillinger du legger inn i appen, lagres lokalt på enheten. Opplysningene overføres ikke til oss eller til andre. Treningsloggen benytter ingen egen server, og vi har ikke tilgang til dataene dine.</p>' +
      '<p>På iPhone inngår appens data i enhetens ordinære sikkerhetskopi (iCloud eller datamaskin). Sikkerhetskopien administreres av deg og Apple, og vi har ikke tilgang til den.</p>' +
      '<h3>2. Sporing, analyse og markedsføring</h3>' +
      '<p>Appen benytter ikke analyseverktøy, informasjonskapsler for sporing eller annonser, og ingen opplysninger deles med tredjeparter.</p>' +
      '<h3>3. Kjøp og abonnement</h3>' +
      '<p>Kjøp og abonnement gjennomføres og administreres av Apple via App Store. Betalingsopplysninger behandles av Apple i samsvar med Apples personvernerklæring, og vi mottar ikke disse opplysningene.</p>' +
      '<h3>4. Eksporterte filer</h3>' +
      '<p>Sikkerhetskopier og regneark du eksporterer fra appen, lagres eller deles på det stedet du selv velger. Etter eksport er det du som har kontroll over filene og ansvar for hvordan de oppbevares.</p>' +
      '<h3>5. Sletting av data</h3>' +
      '<p>Du kan når som helst slette alle data under Mer → Slett alle data. Dersom appen avinstalleres, slettes også alle data som er lagret i appen på enheten.</p>' +
      '<h3>6. Dine rettigheter</h3>' +
      '<p>Personvernregelverket gir deg rett til innsyn i, retting av og sletting av personopplysninger. Ettersom vi ikke lagrer opplysninger om deg, har vi ingen opplysninger å utlevere, rette eller slette. Henvendelser om personvern kan rettes til ' + mail + '. Du har også rett til å klage til Datatilsynet.</p>' +
      '<h3>7. Endringer i personvernerklæringen</h3>' +
      '<p>Dersom vi endrer hvordan appen behandler opplysninger, vil denne erklæringen bli oppdatert, og datoen øverst vil bli endret tilsvarende.</p>',
    support:
      '<h2>Hjelp og kundestøtte</h2>' +
      '<p>Har du spørsmål, funnet en feil eller har forslag til forbedringer? Send en e-post til ' + mail + ', så svarer vi så snart vi kan.</p>' +
      '<h3>Hvordan tar jeg vare på dataene mine?</h3>' +
      '<p>Dataene lagres på enheten og blir med i iPhonens vanlige sikkerhetskopi. Du kan også ta en egen sikkerhetskopi under Mer → Ta sikkerhetskopi.</p>' +
      '<h3>Hvordan flytter jeg til en ny telefon?</h3>' +
      '<p>Overfører du fra den gamle telefonen eller gjenoppretter fra en sikkerhetskopi, blir dataene med. Alternativt tar du en sikkerhetskopi på den gamle telefonen og henter den inn under Mer → Hent fra sikkerhetskopi på den nye.</p>' +
      '<h3>Hvordan sier jeg opp abonnementet?</h3>' +
      '<p>Abonnementet administreres av Apple. Gå til Innstillinger på iPhone → navnet ditt → Abonnementer → Treningsloggen. Oppsigelsen gjelder fra slutten av perioden du har betalt for.</p>' +
      '<h3>Jeg har byttet telefon og abonnementet mangler</h3>' +
      '<p>Bruk «Gjenopprett kjøp» i appen, logget inn med samme Apple-ID som du kjøpte abonnementet med.</p>' +
      '<h3>Viktig å vite</h3>' +
      '<p>Treningsloggen er et verktøy for å registrere og følge med på egen trening. Appen gir ikke medisinske råd. Snakk med lege eller annet helsepersonell hvis du er usikker på om en type trening passer for deg.</p>',
  };
})();
