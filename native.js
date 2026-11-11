/* Treningsloggen – bare i iOS-appen (Capacitor). I nettleseren gjør fila ingenting.
   - Speiler dataene fra localStorage til en fil i appens egen lagring, som iOS ikke rydder bort.
   - Hvis iOS likevel har tømt localStorage, hentes dataene tilbake fra fila ved oppstart.
   - Deler eksportfiler med iOS sitt delingsark. */
(function () {
  var cap = window.Capacitor;
  if (!cap || !cap.isNativePlatform || !cap.isNativePlatform()) return;
  // Uten bundler hentes pluginene fra den globale Capacitor-broen
  var plugin = function (name) { return (cap.Plugins && cap.Plugins[name]) || (cap.registerPlugin && cap.registerPlugin(name)); };
  var FS = plugin('Filesystem'), Share = plugin('Share');
  var FILE = 'treningslogg-data.json', TMP = 'treningslogg-data.tmp';
  var PREFIX = 'treningslogg.', MAIN = 'treningslogg.v1';
  var ready = false, pending = false, writing = false;

  function snapshot() {
    var out = {};
    for (var i = 0; i < localStorage.length; i++) {
      var k = localStorage.key(i);
      if (k && k.indexOf(PREFIX) === 0) out[k] = localStorage.getItem(k);
    }
    return out;
  }

  // Skriv til en midlertidig fil først og bytt navn, så fila aldri blir halvskrevet
  function write() {
    if (!FS) return;
    if (!ready) { pending = true; return; }
    if (writing) { pending = true; return; }
    writing = true; pending = false;
    var data = JSON.stringify({ savedAt: Date.now(), keys: snapshot() });
    FS.writeFile({ path: TMP, data: data, directory: 'DATA', encoding: 'utf8' })
      .then(function () { return FS.rename({ from: TMP, to: FILE, directory: 'DATA', toDirectory: 'DATA' }); })
      .catch(function (e) { console.error('Kunne ikke lagre sikkerhetskopi', e); })
      .then(function () { writing = false; if (pending) write(); });
  }

  // Ved oppstart: tom localStorage, men fila finnes → legg dataene tilbake og start på nytt
  function restore() {
    if (!FS) { ready = true; return; }
    FS.readFile({ path: FILE, directory: 'DATA', encoding: 'utf8' })
      .then(function (r) {
        var saved = JSON.parse(r.data);
        if (!localStorage.getItem(MAIN) && saved && saved.keys && saved.keys[MAIN]) {
          // Appen må ikke lagre sin tomme tilstand over dataene idet siden lastes på nytt
          window.nativeApp.blockSave = true;
          Object.keys(saved.keys).forEach(function (k) { localStorage.setItem(k, saved.keys[k]); });
          location.reload();
          return;
        }
        ready = true;
        if (pending) write();
      })
      .catch(function () { ready = true; if (pending) write(); });
  }

  function shareFile(blob, name) {
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onload = function () { resolve(String(reader.result).split(',')[1]); };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    }).then(function (base64) {
      return FS.writeFile({ path: name, data: base64, directory: 'CACHE' });
    }).then(function (res) {
      return Share.share({ title: name, files: [res.uri] });
    });
  }

  // Statuslinja (klokke, batteri) får lys tekst i mørk modus og mørk tekst i lys modus
  var StatusBar = plugin('StatusBar');
  function syncStatusBar() {
    if (StatusBar) StatusBar.setStyle({ style: document.documentElement.dataset.mode === 'light' ? 'LIGHT' : 'DARK' }).catch(function () {});
  }
  syncStatusBar();
  new MutationObserver(syncStatusBar).observe(document.documentElement, { attributes: true, attributeFilter: ['data-mode'] });

  window.nativeApp = { afterSave: write, shareFile: shareFile, keyboardOpen: false };

  // Appen krymper over tastaturet (resize: native), så siden ikke kan skyves opp.
  // Da merker ikke visualViewport tastaturet, så menyen skjules ut fra tastaturets egne hendelser.
  var Keyboard = plugin('Keyboard');
  if (Keyboard && Keyboard.addListener) {
    var setKb = function (open) { window.nativeApp.keyboardOpen = open; if (window.fitSheetToKeyboard) window.fitSheetToKeyboard(); };
    Keyboard.addListener('keyboardWillShow', function () { setKb(true); });
    Keyboard.addListener('keyboardWillHide', function () { setKb(false); });
  }
  document.addEventListener('visibilitychange', function () { if (document.hidden) write(); });
  restore();
})();
