/* Personvern og kundestøtte – samme tekst i appen (#/personvern, #/kundestotte)
   og på nettsidene personvern.html og kundestotte.html, som App Store lenker til. */
window.LEGAL = (function () {
  var EMAIL = 'kontakt.treningsloggen@outlook.com';
  var mail = '<a href="mailto:' + EMAIL + '">' + EMAIL + '</a>';
  var UPDATED = '11. november 2026';
  return {
    email: EMAIL,
    eula: 'https://www.apple.com/legal/internet-services/itunes/dev/stdeula/',
    privacy:
      '<h2>Personvernerklæring</h2>' +
      '<p class="legal-date">Sist oppdatert ' + UPDATED + '</p>' +
      '<p><b>Kort fortalt:</b> Treningsloggen samler ikke inn opplysninger om deg. Alt du registrerer, lagres bare på din egen enhet.</p>' +
      '<h3>Hva som lagres, og hvor</h3>' +
      '<p>Øktene, øvelsene, profilen og innstillingene dine lagres lokalt på enheten. De sendes ikke til oss eller til noen andre. Vi har ingen server, og vi kan ikke se dataene dine.</p>' +
      '<p>På iPhone blir dataene med i enhetens vanlige sikkerhetskopi (iCloud eller datamaskin). Den styres av deg og Apple, og vi har ikke tilgang til den.</p>' +
      '<h3>Ingen sporing, analyse eller reklame</h3>' +
      '<p>Appen bruker ikke analyseverktøy, informasjonskapsler for sporing eller reklame, og deler ingen opplysninger med tredjeparter.</p>' +
      '<h3>Kjøp og abonnement</h3>' +
      '<p>Kjøp og abonnement håndteres av Apple gjennom App Store. Betalingsopplysningene dine behandles av Apple etter Apples personvernregler, og vi får ikke tilgang til dem.</p>' +
      '<h3>Filer du eksporterer</h3>' +
      '<p>Sikkerhetskopier og regneark du eksporterer, lagres eller deles der du selv velger. Etter det er det du som har kontroll over filene.</p>' +
      '<h3>Sletting</h3>' +
      '<p>Du kan slette alle data under Mer → Slett alle data. Sletter du appen, slettes også dataene på enheten.</p>' +
      '<h3>Dine rettigheter</h3>' +
      '<p>Siden vi ikke lagrer opplysninger om deg, har vi ingenting å utlevere, rette eller slette. Har du spørsmål om personvern, kan du kontakte oss på ' + mail + '. Du kan også klage til Datatilsynet.</p>' +
      '<h3>Endringer</h3>' +
      '<p>Endrer vi hvordan appen håndterer opplysninger, oppdaterer vi denne erklæringen og datoen øverst.</p>',
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
