'use strict';

/* =========================================================
   Treningsloggen – all data lagres lokalt på enheten
   ========================================================= */

const STORE_KEY = 'treningslogg.v1';

const CATEGORIES = ['Bein', 'Bryst', 'Rygg', 'Skuldre', 'Armer', 'Mage', 'Funksjonell styrketrening', 'Kondisjon', 'Annet'];

// Standardøvelser. Id-ene er stabile, slik at historikken følger med når navn/kategori endres.
// also: øvelsen vises også i disse mappene. measure: 'time' = holdes på tid (sek), 'distance' = vekt og lengde (m).
// Kondisjon: cfg sier hvilke verdier maskinen bruker (se exCfg).
const S = (id, name, cat, opt = {}) => ({ id, name, kind: 'strength', cat, ...opt });
const C = (id, name, cfg) => ({ id, name, kind: 'cardio', cat: 'Kondisjon', cfg });
const DEFAULT_EXERCISES = [
  S('knebøy', 'Knebøy', 'Bein'),
  S('beinpress', 'Beinpress', 'Bein'),
  S('utfall', 'Utfall', 'Bein'),
  S('bulgarsk', 'Bulgarsk splittknebøy', 'Bein'),
  S('marklöft', 'Markløft', 'Bein', { also: ['Rygg'] }),
  S('rumensk', 'Rumensk markløft', 'Bein'),
  S('legext', 'Leg extension', 'Bein'),
  S('legcurl', 'Leg curl', 'Bein'),
  S('tahev', 'Tåhev', 'Bein'),

  S('benkpress', 'Benkpress', 'Bryst'),
  S('skrabenk', 'Skråbenkpress', 'Bryst'),
  S('brystpress', 'Brystpress', 'Bryst'),
  S('hantelpress-bryst', 'Hantelpress (bryst)', 'Bryst'),
  S('flyes', 'Flyes', 'Bryst'),
  S('cablecross', 'Cable crossover', 'Bryst'),
  S('pushups', 'Push-ups', 'Bryst'),

  S('nedtrekk', 'Nedtrekk', 'Rygg'),
  S('pullups', 'Pull-ups/chins', 'Rygg'),
  S('roing', 'Sittende roing', 'Rygg'),
  S('stangroing', 'Stangroing', 'Rygg'),
  S('hantelroing', 'Hantelroing', 'Rygg'),
  S('facepull', 'Face pulls', 'Rygg', { also: ['Skuldre'] }),

  S('skulderpress', 'Skulderpress', 'Skuldre'),
  S('hantelpress-skulder', 'Hantelpress (skuldre)', 'Skuldre'),
  S('sidehev', 'Sidehev', 'Skuldre'),
  S('fronthev', 'Fronthev', 'Skuldre'),
  S('omvendtflyes', 'Omvendt flyes', 'Skuldre'),

  S('biceps', 'Bicepscurl', 'Armer'),
  S('hammer', 'Hammer curl', 'Armer'),
  S('preacher', 'Preacher curl', 'Armer'),
  S('triceps', 'Triceps pushdown', 'Armer'),
  S('franskpress', 'Franskpress', 'Armer'),
  S('dips', 'Dips', 'Armer'),
  S('overheadtri', 'Overhead triceps extension', 'Armer'),

  S('situps', 'Sit-ups', 'Mage'),
  S('crunches', 'Crunches', 'Mage'),
  S('cablecrunch', 'Cable crunch', 'Mage'),
  S('beinloft', 'Hengende beinhev', 'Mage'),
  S('kneeraises', 'Knee raises', 'Mage'),
  S('planke', 'Planke', 'Mage', { measure: 'time' }),
  S('russian', 'Russian twists', 'Mage'),
  S('abwheel', 'Ab wheel', 'Mage'),
  S('magemaskin', 'Magemaskin', 'Mage'),

  S('farmers', 'Farmers carry', 'Funksjonell styrketrening', { measure: 'distance' }),
  S('sledpush', 'Sled push', 'Funksjonell styrketrening', { measure: 'distance' }),
  S('sledpull', 'Sled pull', 'Funksjonell styrketrening', { measure: 'distance' }),

  C('mole', 'Tredemølle', { distance: true, unit: 'km', speed: 'kmh', fields: ['incline'], pace: true }),
  C('spinning', 'Spinningsykkel', { distance: true, unit: 'km', speed: 'kmh', fields: ['watt', 'level'] }),
  C('ergometer', 'Ergometersykkel', { distance: true, unit: 'km', speed: 'kmh', fields: ['watt', 'level'] }),
  C('airbike', 'AirBike', { distance: true, unit: 'km', speed: 'kmh', fields: ['watt', 'cadence', 'level'] }),
  C('romaskin', 'RoErg', { distance: true, unit: 'm', speed: 'pace500', fields: ['strokeRate', 'level'] }),
  C('skierg', 'SkiErg', { distance: true, unit: 'm', speed: 'pace500', fields: ['strokeRate', 'level'] }),
  C('crosstrainer', 'Crosstrainer', { distance: true, unit: 'km', speed: 'kmh', fields: ['level'] }),
  C('trappemaskin', 'Trappemaskin', { distance: true, unit: 'm', speed: 'none', fields: ['stepsPerMin', 'floors', 'elevation', 'level'] }),
];

const PURPOSES = [
  { k: 'endurance', l: 'Utholdenhet' },
  { k: 'interval', l: 'Kondisjon / intervall' },
  { k: 'threshold', l: 'Terskel' },
  { k: 'easy', l: 'Rolig / restitusjon' },
];
const purposeLabel = (k) => PURPOSES.find((p) => p.k === k)?.l || '';

// Valgfrie felt for kondisjonsøvelser. rate: kan registreres per segment/drag.
const CARDIO_FIELDS = {
  incline: { label: 'Stigning (%)', name: 'Stigning', unit: '%', d: 1, rate: true, text: (v) => `${fmtNum(v, 1)} % stigning` },
  level: { label: 'Motstand / nivå', name: 'Motstand / nivå', unit: 'nivå', d: 1, rate: true, text: (v) => `nivå ${fmtNum(v, 1)}` },
  strokeRate: { label: 'Tak per minutt', name: 'Tak per minutt', unit: 'tak/min', d: 0, rate: true, text: (v) => `${fmtNum(v, 0)} tak/min` },
  cadence: { label: 'Tråkk per minutt', name: 'Tråkk per minutt', unit: 'tråkk/min', d: 0, rate: true, text: (v) => `${fmtNum(v, 0)} tråkk/min` },
  watt: { label: 'Watt', name: 'Watt', unit: 'W', d: 0, rate: true, text: (v) => `${fmtNum(v, 0)} W` },
  stepsPerMin: { label: 'Steg per minutt', name: 'Steg per minutt', unit: 'steg/min', d: 0, rate: true, text: (v) => `${fmtNum(v, 0)} steg/min` },
  floors: { label: 'Etasjer', name: 'Etasjer', unit: 'etasjer', d: 0, rate: false, text: (v) => `${fmtNum(v, 0)} etasjer` },
  elevation: { label: 'Høydemeter', name: 'Høydemeter', unit: 'm', d: 0, rate: false, text: (v) => `${fmtNum(v, 0)} høydemeter` },
};
const RATE_FIELDS = Object.keys(CARDIO_FIELDS).filter((k) => CARDIO_FIELDS[k].rate);
const SPEED_TYPES = { kmh: 'km/t', pace500: 'min/500 m', none: 'Ingen fart' };

// Oppsettet for en kondisjonsøvelse: distanse (standardenhet), fartstype og ekstra felt
function exCfg(ex) {
  const c = ex.cfg || { fields: [ex.extra === 'incline' ? 'incline' : 'level'] };
  return {
    distance: c.distance !== false,
    unit: c.unit === 'm' ? 'm' : 'km',
    speed: SPEED_TYPES[c.speed] ? c.speed : 'kmh',
    // pace: vis og registrer tempo i min/km (løping); gjelder bare fart i km/t
    pace: c.pace === true && (SPEED_TYPES[c.speed] ? c.speed : 'kmh') === 'kmh',
    fields: (c.fields || []).filter((f) => CARDIO_FIELDS[f]),
  };
}
const unitOf = (en, cfg) => (en.distUnit === 'm' || en.distUnit === 'km' ? en.distUnit : cfg.unit);
function fmtDist(km, unit) {
  if (km == null) return '–';
  return unit === 'm' ? `${fmtNum(km * 1000, 0)} m` : `${fmtNum(km, 2)} km`;
}
// Distanse lagres alltid i km; vises i valgt enhet
const toUnit = (km, unit) => (km == null ? null : unit === 'm' ? Math.round(km * 10000) / 10 : km);
const fromUnit = (v, unit) => (v == null ? null : unit === 'm' ? v / 1000 : v);
// Fart lagres alltid i km/t; min/500 m regnes om (500 m på x sek = 1800/x km/t)
const paceSec = (kmh) => (kmh ? 1800 / kmh : null);
function fmtSpeed(kmh, cfg) {
  if (!kmh) return '–';
  return cfg.speed === 'pace500' ? `${fmtDuration(1800 / kmh)} /500 m` : `${fmtNum(kmh, 1)} km/t`;
}

const FEELINGS = [
  { v: 1, e: '😫', l: 'Tung' },
  { v: 2, e: '😕', l: 'Litt tung' },
  { v: 3, e: '😐', l: 'OK' },
  { v: 4, e: '😊', l: 'Bra' },
  { v: 5, e: '💪', l: 'Knall' },
];

const METRICS = {
  strength: [
    { k: 'tested', label: '1RM', unit: 'kg', d: 2, hint: 'Faktisk 1RM: tyngste godkjente løft i 1RM-test' },
    { k: 'repWeight', label: 'Vekt i reps-sett', unit: 'kg', d: 2, hint: 'Tyngste vekt brukt i reps-sett per økt' },
    { k: 'repsAt', label: 'Reps per vekt', unit: 'reps', d: 0 },
    { k: 'carryWeight', label: 'Vekt', unit: 'kg', d: 2, hint: 'Tyngste vekt per økt' },
    { k: 'maxMeters', label: 'Lengste drag', unit: 'm', d: 0, hint: 'Lengste sett i meter' },
    { k: 'totalMeters', label: 'Total lengde', unit: 'm', d: 0, hint: 'Sum av alle settene' },
    { k: 'maxSec', label: 'Lengste hold', unit: 'sek', d: 0, hint: 'Lengste sett på tid' },
    { k: 'totalSec', label: 'Total tid', unit: 'sek', d: 0, hint: 'Sum av alle settene' },
  ],
};

/* ---------- Helpers ---------- */
const $ = (s, r = document) => r.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const clone = (o) => JSON.parse(JSON.stringify(o));
const num = (v) => {
  if (v == null || v === '') return null;
  const n = parseFloat(String(v).replace(',', '.').replace(/\s/g, ''));
  return Number.isFinite(n) ? n : null;
};
const fmtNum = (n, d = 1) => (n == null || !Number.isFinite(n) ? '–' : n.toLocaleString('nb-NO', { maximumFractionDigits: d }));
const inputVal = (n) => (n == null ? '' : String(n).replace('.', ','));

function todayISO() {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 10);
}
const dateObj = (iso) => new Date(iso + 'T12:00:00');
const fmtDate = (iso, opts = { weekday: 'short', day: 'numeric', month: 'short' }) => dateObj(iso).toLocaleDateString('nb-NO', opts);
const fmtDateLong = (iso) => fmtDate(iso, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
function fmtDuration(sec) {
  if (sec == null) return '–';
  sec = Math.round(sec);
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
  const p = (x) => String(x).padStart(2, '0');
  return h ? `${h}:${p(m)}:${p(s)}` : `${m}:${p(s)}`;
}
function fmtPace(kmh) {
  if (!kmh) return null;
  const secPerKm = 3600 / kmh;
  return fmtDuration(secPerKm) + ' /km';
}
function weekStart(d) {
  const x = new Date(d); x.setHours(12, 0, 0, 0);
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7));
  return x;
}
function isoWeek(d) {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - day);
  const y0 = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  return Math.ceil(((t - y0) / 86400000 + 1) / 7);
}

/* ---------- Storage ---------- */
function defaultExercises() {
  return DEFAULT_EXERCISES.map((e, i) => ({ ...e, order: i }));
}
function load() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) return migrate(JSON.parse(raw));
  } catch (e) { console.error(e); }
  // Ny bruker: kjør samme migrering, slik at alle felt (mapper, favoritter, profil …) finnes
  return migrate({ version: 1, exercises: defaultExercises(), workouts: [], draft: null, deletedDefaults: [] });
}
function migrate(d) {
  d.exercises ||= [];
  d.workouts ||= [];
  d.deletedDefaults ||= [];
  d.folders ||= [];
  d.templates ||= [];
  d.profile ||= {};
  delete d.profile.weightKg; // vekt er fjernet fra profilen og skal ikke ligge lagret
  // Mappen het tidligere «Helkropp» og deretter «HIIT» (gjelder også egne øvelser)
  for (const e of d.exercises) if (e.cat === 'Helkropp' || e.cat === 'HIIT') e.cat = 'Funksjonell styrketrening';
  for (const e of defaultExercises()) {
    const cur = d.exercises.find((x) => x.id === e.id);
    if (cur) {
      // Hold standardøvelser oppdatert, med mindre brukeren har endret dem selv
      if (!cur.edited) Object.assign(cur, { name: e.name, cat: e.cat, also: e.also, measure: e.measure, timed: undefined, cfg: e.cfg });
      cur.order = e.order;
      continue;
    }
    if (d.deletedDefaults.includes(e.id)) continue;
    // Ikke lag duplikat hvis brukeren allerede har en egen øvelse med samme navn
    if (d.exercises.some((x) => x.name.toLowerCase() === e.name.toLowerCase())) continue;
    d.exercises.push(e);
  }
  const entries = [...d.workouts.flatMap((w) => w.entries), ...(d.draft?.entries || [])];
  // Egenlaget AirBike: tak per minutt → tråkk per minutt, og legg til watt
  for (const ex of d.exercises) {
    if (ex.id === 'airbike' || ex.kind !== 'cardio' || !/^air\s*bike$/i.test(ex.name.trim()) || ex.airbikeFixed) continue;
    const fields = ex.cfg?.fields || [];
    ex.cfg = { ...(ex.cfg || {}), fields: [...new Set(['watt', ...fields.map((f) => (f === 'strokeRate' ? 'cadence' : f))])] };
    ex.airbikeFixed = true;
    for (const en of entries.filter((x) => x.exerciseId === ex.id)) {
      for (const o of [en, ...(en.segments || []), ...(en.intervals || [])]) {
        if (o.strokeRate != null && o.cadence == null) o.cadence = o.strokeRate;
        delete o.strokeRate;
      }
    }
  }
  // Eldre versjoner lagret intervalldistanse i meter (distanceM)
  for (const en of entries) {
    for (const x of en.intervals || []) {
      if (x.distanceM != null && x.distanceKm == null) x.distanceKm = x.distanceM / 1000;
      delete x.distanceM;
    }
  }
  return d;
}
let db = load();
let saveTimer = null;
function save() {
  clearTimeout(saveTimer);
  try { localStorage.setItem(STORE_KEY, JSON.stringify(db)); }
  catch (e) { toast('Kunne ikke lagre – lagringsplassen kan være full'); }
}
const saveSoon = () => { clearTimeout(saveTimer); saveTimer = setTimeout(save, 300); };
window.addEventListener('pagehide', save);
document.addEventListener('visibilitychange', () => { if (document.hidden) save(); });

// Be nettleseren om å ikke slette dataene ved lite lagringsplass
if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});

/* ---------- Data queries ---------- */
const exById = (id) => db.exercises.find((e) => e.id === id) || { id, name: 'Ukjent øvelse', kind: 'strength', cat: 'Annet' };
const sortedWorkouts = () => [...db.workouts].sort((a, b) => (b.date.localeCompare(a.date)) || ((b.createdAt || 0) - (a.createdAt || 0)));

// Egne mapper for økter (f.eks. «Beindag», «Intervaller»). En økt kan ligge i én mappe.
const folderById = (id) => (id ? db.folders.find((f) => f.id === id) : null);
const sortedFolders = () => [...db.folders].sort((a, b) => a.name.localeCompare(b.name, 'nb'));

function strengthStats(entry) {
  if (entry.mode === 'max') {
    const att = (entry.attempts || []).filter((a) => a.weight > 0);
    if (!att.length) return null;
    const ok = att.filter((a) => a.ok);
    const tested = ok.length ? Math.max(...ok.map((a) => a.weight)) : null;
    return { tested, heaviest: tested, volume: null, maxReps: null, totalReps: ok.length, sets: att.length };
  }
  const sets = (entry.sets || []).filter(setDone);
  if (!sets.length) return null;
  const measure = exMeasure(exById(entry.exerciseId));
  if (measure === 'time') {
    const w = sets.map((s) => s.weight || 0);
    return { tested: null, heaviest: Math.max(...w) || null, volume: null, maxReps: null, totalReps: null,
      maxSec: Math.max(...sets.map((s) => s.sec || 0)) || null, totalSec: sets.reduce((a, s) => a + (s.sec || 0), 0) || null, sets: sets.length };
  }
  if (measure === 'distance') {
    const heaviest = Math.max(...sets.map((s) => s.weight || 0)) || null;
    return { tested: null, heaviest, carryWeight: heaviest, volume: null, maxReps: null, totalReps: null,
      maxMeters: Math.max(...sets.map((s) => s.meters || 0)) || null, totalMeters: sets.reduce((a, s) => a + (s.meters || 0), 0) || null, sets: sets.length };
  }
  let heaviest = null, volume = 0, maxReps = 0, totalReps = 0;
  for (const s of sets) {
    const w = s.weight || 0;
    totalReps += s.reps;
    maxReps = Math.max(maxReps, s.reps);
    volume += s.reps * w;
    if (w > 0) {
      heaviest = Math.max(heaviest ?? 0, w);
    }
  }
  return { tested: null, heaviest, repWeight: heaviest, volume: volume || null, maxReps, totalReps, sets: sets.length };
}
const isIntervalType = (purpose) => purpose === 'interval' || purpose === 'threshold';

// Fyller inn det som mangler av tid / distanse / fart for et segment eller drag
function resolvePart(timeSec, distKm, speed) {
  const t = timeSec > 0 ? timeSec : null, d = distKm > 0 ? distKm : null, v = speed > 0 ? speed : null;
  return {
    timeSec: t ?? (d && v ? (d / v) * 3600 : null),
    distanceKm: d ?? (t && v ? (v * t) / 3600 : null),
    speed: v ?? (t && d ? d / (t / 3600) : null),
  };
}
function sumParts(parts) {
  if (!parts.length) return null;
  const allT = parts.every((p) => p.timeSec), allD = parts.every((p) => p.distanceKm);
  const t = allT ? parts.reduce((a, p) => a + p.timeSec, 0) : null;
  const d = allD ? parts.reduce((a, p) => a + p.distanceKm, 0) : null;
  const speeds = parts.map((p) => p.speed || 0);
  return { timeSec: t, distanceKm: d, speed: t && d ? d / (t / 3600) : null, maxSpeed: Math.max(...speeds) || null, count: parts.length };
}
// Rate-felt (stigning, nivå, tak/min, steg/min) kan stå per segment/drag
function partRates(src) {
  const o = {};
  for (const k of RATE_FIELDS) o[k] = src[k] ?? null;
  return o;
}
// Segmenter med utregnede verdier (utholdenhet / rolig)
function resolvedSegments(en) {
  if (isIntervalType(en.purpose)) return [];
  return (en.segments || [])
    .map((s) => ({ ...resolvePart(s.timeSec, s.distanceKm, s.speedKmh), ...partRates(s) }))
    .filter((p) => p.timeSec || p.distanceKm);
}
function segTotals(en) {
  return sumParts(resolvedSegments(en));
}
// Intervaller (terskel / intervall): arbeidstid, distanse og fart i dragene + pauser
function intervalTotals(en) {
  if (!isIntervalType(en.purpose)) return null;
  const ivs = (en.intervals || []).filter((x) => x.timeSec > 0 || x.distanceKm > 0);
  if (!ivs.length) return null;
  const parts = ivs.map((x) => ({ ...resolvePart(x.timeSec, x.distanceKm, x.speedKmh), ...partRates(x) }));
  const sum = sumParts(parts);
  const restSec = ivs.slice(0, -1).reduce((a, x) => a + (x.restSec || 0), 0);
  return { ...sum, workSec: sum.timeSec, restSec, totalSec: sum.timeSec != null ? sum.timeSec + restSec : null, parts };
}
// Tidsvektet snitt av et felt over segmentene / dragene
function avgOver(parts, k) {
  const p = (parts || []).filter((x) => x[k] != null);
  if (!p.length) return null;
  const tw = p.every((x) => x.timeSec) ? p.reduce((a, x) => a + x.timeSec, 0) : 0;
  return tw ? p.reduce((a, x) => a + x[k] * x.timeSec, 0) / tw : p.reduce((a, x) => a + x[k], 0) / p.length;
}
function cardioStats(entry) {
  const iv = intervalTotals(entry);
  const segs = resolvedSegments(entry);
  const seg = sumParts(segs);
  const agg = iv || seg;
  const t = (iv ? iv.totalSec : entry.timeSec) || agg?.timeSec || null;
  // Distanse kan også regnes ut fra total tid og snittfart
  const dist = (iv ? null : entry.distanceKm) || agg?.distanceKm
    || (!iv && entry.timeSec && entry.speedKmh ? (entry.speedKmh * entry.timeSec) / 3600 : null) || null;
  // For intervaller er snittfarten farten i dragene (pauser teller ikke)
  const speed = iv ? iv.speed : entry.speedKmh || (t && dist ? dist / (t / 3600) : null) || seg?.speed || null;
  const parts = iv ? iv.parts : segs;
  const rate = (k) => (iv ? null : entry[k]) ?? avgOver(parts, k);
  const s = {
    timeMin: t ? t / 60 : null, timeSec: t, distanceKm: dist, speed, pace500: speed ? 1800 / speed : null, paceKm: speed ? 3600 / speed : null,
    maxSpeed: agg && agg.count > 1 ? agg.maxSpeed : null,
    avgHr: entry.avgHr || null, kcal: entry.kcal || null,
    ...Object.fromEntries(RATE_FIELDS.map((k) => [k, rate(k)])),
    floors: entry.floors || null, elevation: entry.elevation || null,
    intervals: iv ? iv.count : null,
  };
  return Object.values(s).some((v) => v != null) ? s : null;
}
const entryStats = (entry) => (exById(entry.exerciseId).kind === 'cardio' ? cardioStats(entry) : strengthStats(entry));

// Alle forekomster av en øvelse, eldst først
function historyFor(exId, excludeWorkoutId) {
  const out = [];
  for (const w of db.workouts) {
    if (w.id === excludeWorkoutId) continue;
    for (const en of w.entries) {
      if (en.exerciseId !== exId) continue;
      const st = entryStats(en);
      if (st) out.push({ w, en, st });
    }
  }
  out.sort((a, b) => a.w.date.localeCompare(b.w.date) || (a.w.createdAt || 0) - (b.w.createdAt || 0));
  return out;
}
function bestOf(hist, key, lower) {
  let best = null;
  for (const h of hist) {
    const v = h.st[key];
    if (v != null && (best == null || (lower ? v < best.v : v > best.v))) best = { v, h };
  }
  return best;
}

// Måltall for en kondisjonsøvelse, ut fra oppsettet
function cardioMetrics(ex) {
  const cfg = exCfg(ex);
  const m = [];
  if (cfg.distance) m.push(cfg.unit === 'm' ? { k: 'distanceKm', label: 'Distanse', unit: 'm', d: 0, scale: 1000 } : { k: 'distanceKm', label: 'Distanse', unit: 'km', d: 2 });
  m.push({ k: 'timeMin', label: 'Tid', unit: 'min', d: 1 });
  if (cfg.speed === 'kmh') {
    m.push({ k: 'speed', label: 'Snittfart', unit: 'km/t', d: 1 });
    m.push({ k: 'maxSpeed', label: 'Toppfart', unit: 'km/t', d: 1, hint: 'Raskeste segment / drag' });
    if (cfg.pace) m.splice(m.length - 1, 0, { k: 'paceKm', label: 'Snittempo', unit: '/km', fmt: fmtDuration, lower: true, hint: 'Minutter per kilometer – lavere er bedre' });
  } else if (cfg.speed === 'pace500') {
    m.push({ k: 'pace500', label: 'Snittempo', unit: '/500 m', fmt: fmtDuration, lower: true, hint: 'Lavere er bedre' });
  }
  for (const f of cfg.fields) m.push({ k: f, label: CARDIO_FIELDS[f].name, unit: CARDIO_FIELDS[f].unit, d: CARDIO_FIELDS[f].d });
  m.push({ k: 'avgHr', label: 'Snittpuls', unit: 'slag/min', d: 0 });
  return m;
}
const fmtMetric = (metric, raw) => (raw == null ? '–' : metric.fmt ? metric.fmt(raw) : fmtNum(raw * (metric.scale || 1), metric.d));

const setDone = (s) => (s.reps || 0) > 0 || (s.sec || 0) > 0 || (s.meters || 0) > 0;
// Hvordan en styrkeøvelse måles: 'reps' (vekt × reps), 'time' (sek) eller 'distance' (vekt × meter)
const exMeasure = (ex) => (ex.measure === 'time' || ex.measure === 'distance' ? ex.measure : ex.timed ? 'time' : 'reps');

function setsSummary(sets, measure) {
  if (measure === 'distance') {
    const v = (sets || []).filter((s) => (s.meters || 0) > 0);
    if (!v.length) return '–';
    const w = (s) => (s.weight ? ` × ${fmtNum(s.weight, 2)} kg` : '');
    if (v.every((s) => s.meters === v[0].meters && s.weight === v[0].weight)) return `${v.length} × ${fmtNum(v[0].meters, 0)} m${w(v[0])}`;
    return v.map((s) => `${fmtNum(s.meters, 0)} m${w(s)}`).join(', ');
  }
  const timed = measure === 'time' || measure === true;
  if (timed) {
    const v = (sets || []).filter((s) => (s.sec || 0) > 0);
    if (!v.length) return '–';
    const w = (s) => (s.weight ? ` + ${fmtNum(s.weight, 2)} kg` : '');
    if (v.every((s) => s.sec === v[0].sec && s.weight === v[0].weight)) return `${v.length} × ${fmtDuration(v[0].sec)}${w(v[0])}`;
    return v.map((s) => fmtDuration(s.sec) + w(s)).join(', ');
  }
  const v = (sets || []).filter((s) => (s.reps || 0) > 0 || (s.weight || 0) > 0);
  if (!v.length) return '–';
  const anyW = v.some((s) => s.weight);
  const same = v.every((s) => s.reps === v[0].reps && s.weight === v[0].weight);
  if (same) {
    const s = v[0];
    return `${v.length} × ${s.reps ?? '?'}` + (anyW ? ` × ${fmtNum(s.weight, 2)} kg` : ' reps');
  }
  return v.map((s) => (anyW ? `${s.reps ?? '?'}×${fmtNum(s.weight || 0, 2)}` : `${s.reps ?? '?'}`)).join(', ') + (anyW ? ' kg' : ' reps');
}
function maxSummary(en) {
  const st = strengthStats(en);
  if (!st) return '–';
  return `1RM-test: ${st.tested ? `${fmtNum(st.tested, 2)} kg` : 'ingen godkjente løft'} (${st.sets} forsøk)`;
}
function intervalSummary(en, unit) {
  const ivs = (en.intervals || []).filter((x) => x.timeSec > 0 || x.distanceKm > 0);
  if (!ivs.length) return null;
  const same = (k) => ivs.every((x) => x[k] === ivs[0][k]);
  let s = `${ivs.length} × `;
  if (same('timeSec') && ivs[0].timeSec) s += fmtDuration(ivs[0].timeSec);
  else if (same('distanceKm') && ivs[0].distanceKm) s += fmtDist(ivs[0].distanceKm, unit);
  else s += 'drag';
  const rests = ivs.slice(0, -1).map((x) => x.restSec).filter(Boolean);
  if (rests.length && rests.every((r) => r === rests[0])) s += ` (pause ${fmtDuration(rests[0])})`;
  return s;
}
function cardioSummary(en, withPurpose = true) {
  const st = cardioStats(en);
  if (!st) return '–';
  const cfg = exCfg(exById(en.exerciseId));
  const unit = unitOf(en, cfg);
  const parts = [];
  if (withPurpose && en.purpose) parts.push(purposeLabel(en.purpose));
  const ivs = intervalTotals(en) ? intervalSummary(en, unit) : null;
  if (ivs) {
    parts.push(ivs);
    if (st.speed && cfg.speed !== 'none') parts.push(`snitt ${fmtSpeed(st.speed, cfg)}${cfg.pace ? ` (${fmtPace(st.speed)})` : ''} i dragene`);
    if (st.distanceKm && cfg.distance) parts.push(fmtDist(st.distanceKm, unit));
  } else {
    if (st.timeSec) parts.push(fmtDuration(st.timeSec));
    if (st.distanceKm && cfg.distance) parts.push(fmtDist(st.distanceKm, unit));
    if (st.speed && cfg.speed !== 'none') parts.push(fmtSpeed(st.speed, cfg));
    if (st.speed && cfg.pace) parts.push(fmtPace(st.speed));
  }
  for (const f of cfg.fields) if (st[f] != null) parts.push(CARDIO_FIELDS[f].text(st[f]));
  if (st.avgHr) parts.push(`puls ${fmtNum(st.avgHr, 0)}`);
  if (st.kcal) parts.push(`${fmtNum(st.kcal, 0)} kcal`);
  const seg = segTotals(en);
  if (seg && seg.count > 1) parts.push(`${seg.count} segmenter`);
  return parts.join(' · ');
}
function entrySummary(en) {
  if (exById(en.exerciseId).kind === 'cardio') return cardioSummary(en);
  return en.mode === 'max' ? maxSummary(en) : setsSummary(en.sets, exMeasure(exById(en.exerciseId)));
}

/* ---------- UI utils ---------- */
let toastTimer;
let toastAction = null;
function toast(msg, ms = 2400, action) {
  const t = $('#toast');
  t.textContent = msg;
  toastAction = action || null;
  if (action) {
    t.insertAdjacentHTML('beforeend', ` <button type="button" class="toast-btn" data-act="toast-action">${esc(action.label)}</button>`);
  }
  t.classList.toggle('has-action', !!action);
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.classList.remove('show'); toastAction = null; }, ms);
}
function openSheet(html) {
  const root = $('#sheet-root');
  root.innerHTML = `<div class="sheet-backdrop" data-act="close-sheet"></div><div class="sheet" role="dialog" aria-modal="true"><div class="grab"></div>${html}</div>`;
  root.classList.add('open');
  fitSheetToKeyboard();
}
function closeSheet() {
  const root = $('#sheet-root');
  root.classList.remove('open');
  root.innerHTML = '';
  // Lukkes en bekreftelse uten svar, regnes det som «Avbryt»
  if (confirmResolve) { const r = confirmResolve; confirmResolve = null; r(false); }
}

// Appens egen bekreftelsesboks. Nettleserens confirm() blokkeres i enkelte
// installerte apper og innebygde nettlesere, og svarer da «Avbryt» av seg selv.
let confirmResolve = null;
function askConfirm(text, { title = 'Er du sikker?', ok = 'OK', cancel = 'Avbryt', danger = false } = {}) {
  closeSheet();
  return new Promise((resolve) => {
    openSheet(`<h2${text ? "" : " style=\"margin-bottom:18px\""}>${esc(title)}</h2>
      ${text ? `<p style="white-space:pre-line;margin-bottom:16px">${esc(text)}</p>` : ""}
      <div class="btn-row">
        <button class="btn ghost" data-act="confirm-no">${esc(cancel)}</button>
        <button class="btn ${danger ? 'danger-solid' : 'primary'}" data-act="confirm-yes">${esc(ok)}</button>
      </div>`);
    confirmResolve = resolve;
  });
}
function answerConfirm(value) {
  const r = confirmResolve;
  confirmResolve = null;
  closeSheet();
  if (r) r(value);
}
const view = () => $('#view');
function setHeader(title, back, subtitle) {
  $('#title').textContent = title;
  const s = $('#subtitle');
  s.textContent = subtitle || '';
  s.hidden = !subtitle;
  const b = $('#back-btn');
  b.hidden = !back;
  b.onclick = back ? () => (location.hash = back) : null;
}
function greeting() {
  const h = new Date().getHours();
  const part = h < 5 ? 'God natt' : h < 10 ? 'God morgen' : h < 17 ? 'Hei' : 'God kveld';
  const name = db.profile?.name ? `, ${db.profile.name}` : '';
  const day = new Date().toLocaleDateString('nb-NO', { weekday: 'long', day: 'numeric', month: 'long' });
  return `${part}${name} · ${day}`;
}

// Bunnark følger den synlige delen av skjermen, slik at de løftes over tastaturet
// (iOS legger tastaturet over siden i stedet for å krympe den)
function fitSheetToKeyboard() {
  const vv = window.visualViewport;
  const root = document.getElementById('sheet-root');
  if (!vv || !root) return;
  const kb = Math.max(0, Math.round(window.innerHeight - vv.height - vv.offsetTop));
  root.style.setProperty('--kb', kb + 'px');
  root.style.setProperty('--vvh', Math.round(vv.height) + 'px');
  root.style.setProperty('--kb-pad', kb > 0 ? '0px' : 'env(safe-area-inset-bottom)');
  // Tastatur oppe: skjul menyen. Når det lukkes, ber vi Safari om å plassere faste
  // elementer på nytt – ellers kan menyen bli hengende forskjøvet til man scroller.
  const open = kb > 80;
  if (document.body.classList.contains('kb-open') && !open) {
    requestAnimationFrame(() => window.scrollTo(window.scrollX, window.scrollY));
  }
  document.body.classList.toggle('kb-open', open);
}
if (window.visualViewport) {
  visualViewport.addEventListener('resize', fitSheetToKeyboard);
  visualViewport.addEventListener('scroll', fitSheetToKeyboard);
}

// Topplinja blir glass når innholdet scrolles under den
const onScroll = () => document.body.classList.toggle('scrolled', window.scrollY > 6);
window.addEventListener('scroll', onScroll, { passive: true });

// Dråpen i menyen glir til valgt fane
function moveTabIndicator() {
  const tabs = [...document.querySelectorAll('.tabbar a')];
  const i = tabs.findIndex((a) => a.getAttribute('aria-current') === 'page');
  const ind = $('.tab-indicator');
  if (!ind) return;
  ind.style.opacity = i < 0 ? '0' : '1';
  if (i >= 0) ind.style.transform = `translateX(${i * 100}%)`;
}

// Utseende = farge × modus, lagres per enhet. Gradient-stilen er fast.
// Forhåndsvisningen i velgeren viser fargen i valgt modus.
const THEMES = [
  { id: 'orange', name: 'Oransje',
    dark: { bg: '#151515', card: '#2a2a2a', text: '#f1eee8', accent: '#ff6b1a' },
    light: { bg: '#f6f8fc', card: '#ffffff', text: '#111827', accent: '#c2410c' } },
  { id: 'blue', name: 'Lys blå',
    dark: { bg: '#151515', card: '#2a2a2a', text: '#f1eee8', accent: '#60a5fa' },
    light: { bg: '#f6f8fc', card: '#ffffff', text: '#111827', accent: '#2563eb' } },
  { id: 'mint', name: 'Mint',
    dark: { bg: '#0d1714', card: '#1c2824', text: '#f3f1e8', accent: '#62e6b5' },
    light: { bg: '#f6f8fc', card: '#ffffff', text: '#111827', accent: '#047857' } },
];
const MODES = [['dark', 'Mørk'], ['light', 'Lys'], ['auto', 'Automatisk']];
const currentTheme = () => (THEMES.some((t) => t.id === document.documentElement.dataset.theme) ? document.documentElement.dataset.theme : 'orange');
const shownMode = () => (document.documentElement.dataset.mode === 'light' ? 'light' : 'dark');
function savedMode() {
  try { const m = localStorage.getItem('treningslogg.mode'); if (MODES.some(([v]) => v === m)) return m; } catch {}
  return shownMode();
}
const themeName = () => {
  const mode = savedMode();
  return `${THEMES.find((t) => t.id === currentTheme()).name} · ${mode === 'auto' ? 'automatisk' : mode === 'light' ? 'lys' : 'mørk'}`;
};

function renderAppearance() {
  setHeader('Utseende', '#/mer');
  const shown = shownMode();
  view().innerHTML = `<h2 class="section-title" style="margin-top:8px">Farge</h2>
  <section class="card">
    <div class="theme-picker" role="group" aria-label="Farge">
      ${THEMES.map((t) => {
        const p = t[shown];
        return `<button type="button" class="theme-option" data-act="set-theme" data-v="${t.id}" aria-pressed="${currentTheme() === t.id}">
          <span class="theme-swatch" style="--p-bg:${p.bg};--p-card:${p.card};--p-text:${p.text};--p-accent:${p.accent}"><i></i><i></i><b></b></span>${t.name}</button>`;
      }).join('')}
    </div>
  </section>
  <h2 class="section-title">Modus</h2>
  <section class="card">
    <div class="seg-toggle three" role="group" aria-label="Modus">
      ${MODES.map(([v, l]) => `<button type="button" data-act="set-mode" data-v="${v}" aria-pressed="${savedMode() === v}">${l}</button>`).join('')}
    </div>
  </section>`;
}
// Stilvalget (gradient/glass/flat) fra en eldre versjon er fjernet – rydd bort innstillingen
try { localStorage.removeItem('treningslogg.style'); } catch {}

function setAppearance(theme, mode) {
  const t = THEMES.some((x) => x.id === theme) ? theme : 'orange';
  const m = MODES.some(([v]) => v === mode) ? mode : 'dark';
  try { localStorage.setItem('treningslogg.theme', t); localStorage.setItem('treningslogg.mode', m); } catch {}
  if (window.__applyAppearance) window.__applyAppearance(t, m);
  else { document.documentElement.dataset.theme = t; document.documentElement.dataset.mode = m === 'light' ? 'light' : 'dark'; }
}

/* =========================================================
   Router
   ========================================================= */
function route() {
  closeSheet();
  const parts = (location.hash.slice(2) || '').split('/').map(decodeURIComponent);
  const [page, arg] = parts;
  let tab = page || 'home';
  if (page === 'okt' && arg) tab = 'historikk';
  if (page === 'ovelser' || page === 'profil' || page === 'utseende') tab = 'mer';
  document.querySelectorAll('.tabbar a').forEach((a) => {
    if (a.dataset.tab === tab) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
  });
  $('.tabbar a[data-tab="okt"]').classList.toggle('has-dot', !!db.draft);
  moveTabIndicator();
  updateTimers();

  switch (page) {
    case 'okt': arg ? renderWorkoutDetail(arg) : renderEditor(); break;
    case 'historikk': renderHistory(); break;
    case 'statistikk': renderStats(arg); break;
    case 'mer': renderMore(); break;
    case 'ovelser': renderExercises(); break;
    case 'profil': renderProfile(); break;
    case 'utseende': renderAppearance(); break;
    case 'favoritt': renderTemplateEditor(arg); break;
    default: renderHome();
  }
  window.scrollTo(0, 0);
  onScroll();
}
window.addEventListener('hashchange', route);

/* =========================================================
   Hjem
   ========================================================= */
/* ---------- Ukemål ---------- */
// Antall økter i uka som starter med mandag d (lokal tid)
function workoutsInWeek(monday) {
  const start = isoDay(monday);
  const end = new Date(monday); end.setDate(end.getDate() + 7);
  const endIso = isoDay(end);
  return db.workouts.filter((w) => w.date >= start && w.date < endIso).length;
}
// Hvor mange uker på rad målet er nådd (denne uka teller med hvis den allerede er nådd)
function goalStreak(goal) {
  let streak = 0;
  const wk = weekStart(new Date());
  if (workoutsInWeek(wk) >= goal) streak++;
  for (let i = 1; i < 520; i++) {
    const d = new Date(wk); d.setDate(d.getDate() - 7 * i);
    if (workoutsInWeek(d) >= goal) streak++; else break;
  }
  return streak;
}
function weeklyGoalCard() {
  const goal = db.profile?.weeklyGoal;
  if (!goal) {
    return `<a class="card goal-card goal-empty" href="#/profil">
      <div><b>Sett et ukemål</b></div>
      <span class="goal-arrow" aria-hidden="true">›</span></a>`;
  }
  const done = workoutsInWeek(weekStart(new Date()));
  const pct = Math.min(100, (done / goal) * 100);
  const left = Math.max(0, goal - done);
  const dayIdx = (new Date().getDay() + 6) % 7; // 0 = mandag
  const daysLeft = 7 - dayIdx; // inkludert i dag
  const streak = goalStreak(goal);
  const name = db.profile?.name ? `, ${db.profile.name}` : '';
  let msg;
  if (done >= goal) msg = done > goal ? `Målet er nådd – og vel så det${name}! 🎉` : `Ukemålet er nådd${name}! 🎉`;
  else if (done === 0) msg = `Ny uke, nye muligheter${name}. Første økt venter! 💪`;
  else if (left === 1) msg = `Bare én økt igjen${name} – du er nesten i mål! 🔥`;
  else msg = `${left} økter igjen – du er godt i gang${name}! 💪`;
  // Én strek per økt i målet, slik at fremdriften kan telles
  const ticks = goal <= 14 ? Array.from({ length: goal - 1 }, (_, i) => `<span class="goal-tick" style="left:${((i + 1) / goal) * 100}%"></span>`).join('') : '';
  return `<section class="card goal-card${done >= goal ? ' goal-done' : ''}">
    <div class="goal-top">
      <div>
        <span class="goal-label">Ukemål</span>
        <div class="goal-count"><b>${done}</b> av ${goal} økter</div>
      </div>
      <div class="streak${streak ? '' : ' streak-zero'}" aria-label="${streak} ${streak === 1 ? 'uke' : 'uker'} på rad med nådd ukemål">
        <span class="streak-flame" aria-hidden="true">🔥</span>
        <div><b>${streak}</b><span>${streak === 1 ? 'uke' : 'uker'} på rad</span></div>
      </div>
    </div>
    <div class="goal-track" role="progressbar" aria-label="Økter denne uka" aria-valuemin="0" aria-valuemax="${goal}" aria-valuenow="${Math.min(done, goal)}">
      <div class="goal-fill" style="width:${pct}%"></div>${ticks}
    </div>
    <p class="goal-msg">${esc(msg)}</p>
    ${done >= goal ? '' : `<p class="small muted">${daysLeft} ${daysLeft === 1 ? 'dag' : 'dager'} igjen av uka</p>`}
  </section>`;
}

function renderHome() {
  setHeader('Treningsloggen', null, greeting());
  const ws = sortedWorkouts();
  const now = new Date();
  const wkStart = isoDay(weekStart(now));
  const monthPrefix = todayISO().slice(0, 7);
  const thisWeek = ws.filter((w) => w.date >= wkStart).length;
  const thisMonth = ws.filter((w) => w.date.startsWith(monthPrefix)).length;

  let html = '';
  if (db.draft) {
    const n = db.draft.entries.length;
    html += `<section class="card active-banner stack">
      <div><h2>${db.draft.id ? 'Du redigerer en økt' : 'Registrering pågår'}</h2>
      <p class="small muted">${fmtDate(db.draft.date)} · ${n} ${n === 1 ? 'øvelse' : 'øvelser'}${hasTimer(db.draft) ? ` · ⏱ <span data-timer>${fmtElapsed(elapsedMin(db.draft))}</span>` : ''}</p></div>
      <a class="btn primary block big" href="#/okt">Fortsett registreringen</a></section>`;
  } else {
    html += `<button class="btn primary block big" data-act="start-workout" style="margin-top:8px">+ Registrer økt</button>`;
  }

  html += weeklyGoalCard();

  html += `<div class="tiles">
    <div class="tile"><div class="v">${thisWeek}</div><div class="l">Denne uka</div></div>
    <div class="tile"><div class="v">${thisMonth}</div><div class="l">Denne måneden</div></div>
    <div class="tile"><div class="v">${ws.length}</div><div class="l">Totalt</div></div>
  </div>`;

  if (installPromptEvent) {
    html += `<button class="btn secondary block" data-act="install">Installer appen på enheten</button>`;
  } else if (isIOS() && !isStandalone()) {
    html += `<section class="card small"><b>Tips:</b> Trykk på <b>Del</b>-knappen i Safari og velg <b>«Legg til på Hjem-skjerm»</b> for å bruke Treningsloggen som en app.</section>`;
  }

  html += favoritesSection();

  html += `<h2 class="section-title">Siste økter</h2>`;
  if (!ws.length) {
    html += `<div class="empty"><svg viewBox="0 0 24 24"><path d="M3 10v4M6 7v10M18 7v10M21 10v4M6 12h12"/></svg>
      <p>Ingen økter registrert ennå.</p></div>`;
  } else {
    // Kun de fire siste, med et tydeligere fargepreg
    html += `<div class="recent-list">${ws.slice(0, 4).map((w) => workoutCard(w, { quickRepeat: true })).join('')}</div>`;
    html += `<a class="btn history-btn block" href="#/historikk">Se all historikk <span aria-hidden="true">›</span></a>`;
  }
  view().innerHTML = html;
}

/* =========================================================
   Favorittøkter – egne ferdige økter med valgte øvelser
   ========================================================= */
const templateById = (id) => db.templates.find((t) => t.id === id);
const templateExercises = (t) => t.exerciseIds.map((id) => db.exercises.find((e) => e.id === id)).filter(Boolean);

function favoritesSection() {
  const cards = db.templates.map((t) => {
    const exs = templateExercises(t);
    return `<div class="fav-card">
      <button type="button" class="fav-main" data-act="fav-start" data-id="${esc(t.id)}">
        <span class="fav-name">${esc(t.name)}</span>
        <span class="fav-meta">${exs.length} ${exs.length === 1 ? 'øvelse' : 'øvelser'}</span>
        <span class="fav-list">${esc(exs.slice(0, 3).map((e) => e.name).join(' · '))}${exs.length > 3 ? ' …' : ''}</span>
      </button>
      <button type="button" class="icon-btn fav-menu" data-act="fav-menu" data-id="${esc(t.id)}" aria-label="Valg for ${esc(t.name)}">
        <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><circle cx="5" cy="12" r="1.7" fill="currentColor"/><circle cx="12" cy="12" r="1.7" fill="currentColor"/><circle cx="19" cy="12" r="1.7" fill="currentColor"/></svg>
      </button>
    </div>`;
  }).join('');
  return `<div class="section-head">
      <h2 class="section-title">Mine favorittøkter</h2>
      <button type="button" class="add-round" data-act="tpl-new" aria-label="Ny favorittøkt" title="Ny favorittøkt">
        <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M12 5v14M5 12h14" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg>
      </button>
    </div>
    ${db.templates.length ? `<div class="fav-grid">${cards}</div>`
      : ''}`;
}

// Velg mellom vanlig økt og en favorittøkt når man trykker «Registrer økt»
function openStartChooser() {
  openSheet(`<h2>Registrer økt</h2>
    <div class="scroll">
      <button type="button" class="start-option" data-act="start-blank">
        <span class="start-icon" aria-hidden="true">＋</span>
        <span><b>Vanlig økt</b></span>
      </button>
      <p class="chip-label" style="margin-top:16px">Mine favorittøkter</p>
      ${db.templates.length
        ? db.templates.map((t) => {
          const exs = templateExercises(t);
          return `<button type="button" class="start-option" data-act="fav-start" data-id="${esc(t.id)}">
            <span class="start-icon fav" aria-hidden="true">★</span>
            <span><b>${esc(t.name)}</b><span class="small muted">${esc(exs.map((e) => e.name).join(' · ') || 'Ingen øvelser')}</span></span>
          </button>`;
        }).join('')
        : `<p class="small muted">Du har ingen favorittøkter ennå.</p>
           <button type="button" class="btn ghost block" style="margin-top:8px" data-act="tpl-new">+ Lag en favorittøkt</button>`}
    </div>`);
}

async function startFromTemplate(id) {
  const t = templateById(id);
  if (!t) return;
  if (db.draft && !(await askConfirm('Du har en økt som ikke er lagret. Vil du forkaste den og starte «' + t.name + '»?', { ok: 'Forkast og start', danger: true }))) return;
  db.draft = { ...newDraft(), templateId: t.id };
  db.draft.entries = templateExercises(t).map((e) => makeEntry(e.id));
  save();
  closeSheet();
  goToEditor();
  toast(`«${t.name}» er klar – ${db.draft.entries.length} øvelser`);
}

// Favorittøkten som lages/endres (holdes i minnet til den lagres)
let tplDraft = null;
function renderTemplateEditor(id) {
  if (id && id !== 'ny') {
    const t = templateById(id);
    if (!t) { location.hash = '#/'; return; }
    if (tplDraft?.id !== id) tplDraft = clone(t);
  } else if (!tplDraft || tplDraft.id) {
    tplDraft = { name: '', exerciseIds: [] };
  }
  const t = tplDraft;
  setHeader(t.id ? 'Endre favorittøkt' : 'Ny favorittøkt', '#/');
  t.exerciseIds = t.exerciseIds.filter((xid) => db.exercises.some((e) => e.id === xid));
  const exs = t.exerciseIds.map((xid) => db.exercises.find((e) => e.id === xid));
  view().innerHTML = `
    <section class="card"><label class="field">Navn<input data-tpl-name maxlength="40" value="${esc(t.name)}" placeholder="f.eks. Beindag, Push, Intervaller" autocomplete="off"></label></section>
    <h2 class="section-title">Øvelser · ${exs.length}</h2>
    ${exs.length
      ? `<section class="card tpl-list">${exs.map((e, i) => `<div class="tpl-row">
          <span class="set-no">${i + 1}</span>
          <span class="tpl-name">${esc(e.name)}<span class="small muted">${e.kind === 'cardio' ? 'Kondisjon' : 'Styrke'}</span></span>
          <button type="button" class="del-btn" data-act="tpl-move" data-i="${i}" data-d="-1" aria-label="Flytt opp" ${i ? '' : 'disabled'}>↑</button>
          <button type="button" class="del-btn" data-act="tpl-move" data-i="${i}" data-d="1" aria-label="Flytt ned" ${i < exs.length - 1 ? '' : 'disabled'}>↓</button>
          <button type="button" class="del-btn" data-act="tpl-remove" data-i="${i}" aria-label="Fjern ${esc(e.name)}">×</button>
        </div>`).join('')}</section>`
      : '<p class="small muted" style="margin:0 2px 10px">Ingen øvelser ennå.</p>'}
    <button class="btn secondary block big" data-act="tpl-add">+ Legg til øvelser</button>
    <button class="btn primary block big" style="margin-top:12px" data-act="tpl-save">Lagre favorittøkt</button>
    ${t.id ? `<button class="btn danger block btn-destructive" data-act="tpl-delete">Slett favorittøkt</button>` : ''}`;
}

// Escaper teksten og markerer søketreff med <mark>
function markMatch(text, q) {
  const s = String(text);
  const i = q ? s.toLowerCase().indexOf(q.toLowerCase()) : -1;
  if (i < 0) return esc(s);
  return esc(s.slice(0, i)) + '<mark>' + esc(s.slice(i, i + q.length)) + '</mark>' + esc(s.slice(i + q.length));
}
function workoutCard(w, opts = {}) {
  const names = w.entries.map((e) => exById(e.exerciseId).name + (e.mode === 'max' ? ' (1RM)' : ''));
  const feel = FEELINGS.find((f) => f.v === w.feeling);
  const meta = [];
  if (w.durationMin) meta.push(`⏱ ${fmtNum(w.durationMin, 0)} min`);
  if (feel) meta.push(`${feel.e} ${feel.l}`);
  if (w.note) meta.push('📝 Notat');
  const folderName = folderById(w.folderId)?.name;
  if (folderName && !opts.hideFolder) meta.push(`📁 ${folderName}`);
  return `<div class="wo-wrap"><a class="card wo-item" href="#/okt/${encodeURIComponent(w.id)}">
    <div class="date">${esc(fmtDate(w.date))}</div>
    <div class="ex">${names.length ? names.map((n) => markMatch(n, opts.highlight)).join(' · ') : 'Ingen øvelser'}</div>
    ${meta.length ? `<div class="meta">${meta.map((m) => `<span>${esc(m)}</span>`).join('')}</div>` : ''}
  </a>
  <button class="icon-btn wo-menu" data-act="wo-menu" data-id="${esc(w.id)}" aria-label="Valg for økta ${esc(fmtDate(w.date))}">
    <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><circle cx="5" cy="12" r="1.7" fill="currentColor"/><circle cx="12" cy="12" r="1.7" fill="currentColor"/><circle cx="19" cy="12" r="1.7" fill="currentColor"/></svg>
  </button>
  ${opts.quickRepeat ? `<button type="button" class="quick-repeat add-round" data-act="repeat-workout" data-id="${esc(w.id)}" aria-label="Gjenta økta fra ${esc(fmtDate(w.date))}" title="Gjenta økta">
    <svg viewBox="0 0 24 24" width="17" height="17" aria-hidden="true"><path d="M4 12a8 8 0 0 1 13.7-5.7L20 8.6M20 4v4.6h-4.6M20 12a8 8 0 0 1-13.7 5.7L4 15.4M4 20v-4.6h4.6" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>
  </button>` : ''}</div>`;
}

// Sletter en økt, med mulighet for å angre i noen sekunder
function deleteWorkout(id) {
  const idx = db.workouts.findIndex((w) => w.id === id);
  if (idx < 0) return;
  const [removed] = db.workouts.splice(idx, 1);
  save();
  closeSheet();
  if (location.hash.startsWith('#/okt/')) location.hash = '#/historikk'; else route();
  toast(`Økta ${fmtDate(removed.date, { day: 'numeric', month: 'short' })} er slettet`, 6000, {
    label: 'Angre',
    run: () => {
      db.workouts.splice(Math.min(idx, db.workouts.length), 0, removed);
      save();
      route();
      toast('Økta er gjenopprettet');
    },
  });
}

/* =========================================================
   Registrering av økt
   ========================================================= */
function draftFolderChips(d) {
  return `<button type="button" class="chip" data-act="draft-folder" data-v="" aria-pressed="${!folderById(d.folderId)}">Ingen</button>
    ${sortedFolders().map((f) => `<button type="button" class="chip" data-act="draft-folder" data-v="${esc(f.id)}" aria-pressed="${d.folderId === f.id}">📁 ${esc(f.name)}</button>`).join('')}
    <button type="button" class="chip chip-add" data-act="new-folder" data-ctx="draft">+ Ny mappe</button>`;
}

function newDraft() {
  return { date: todayISO(), startedAt: Date.now(), durationMode: 'timer', durationMin: null, feeling: null, note: '', folderId: null, entries: [] };
}

/* ---------- Tidtaker for økta ---------- */
// Tidtakeren gjelder nye økter (ikke redigering av gamle)
const hasTimer = (d) => !!(d && d.startedAt && !d.id);
const elapsedMin = (d) => Math.max(0, Math.floor((Date.now() - d.startedAt) / 60000));
function fmtElapsed(min) {
  if (min < 60) return `${min} min`;
  return `${Math.floor(min / 60)} t ${String(min % 60).padStart(2, '0')} min`;
}
const durationMode = (d) => (hasTimer(d) ? d.durationMode || (d.durationMin != null ? 'manual' : 'timer') : 'manual');
// Oppdaterer alle tidtakere på siden (kalles ved sidebytte og hvert 10. sekund)
function updateTimers() {
  const d = db.draft;
  const top = $('#top-timer');
  const onEditor = location.hash === '#/okt';
  if (top) top.hidden = !(onEditor && hasTimer(d));
  if (!hasTimer(d)) return;
  const text = fmtElapsed(elapsedMin(d));
  document.querySelectorAll('[data-timer]').forEach((el) => { if (el.textContent !== text) el.textContent = text; });
}
setInterval(updateTimers, 10000);
document.addEventListener('visibilitychange', () => { if (!document.hidden) updateTimers(); });

function durationBlock(d) {
  if (!hasTimer(d)) {
    return `<label class="field">Varighet for hele økta (minutter)<input inputmode="numeric" data-w="durationMin" value="${inputVal(d.durationMin)}" placeholder="f.eks. 60"></label>`;
  }
  const mode = durationMode(d);
  const started = new Date(d.startedAt).toLocaleTimeString('nb-NO', { hour: '2-digit', minute: '2-digit' });
  return `<div>
    <label class="field">Varighet for hele økta</label>
    <div class="seg-toggle" role="group" aria-label="Varighet">
      <button type="button" data-act="dur-mode" data-v="timer" aria-pressed="${mode === 'timer'}">Bruk tidtaker</button>
      <button type="button" data-act="dur-mode" data-v="manual" aria-pressed="${mode === 'manual'}">Egen tid</button>
    </div>
    ${mode === 'timer'
      ? `<div class="timer-row">
          <div><div class="timer-big" data-timer>${fmtElapsed(elapsedMin(d))}</div>
          <div class="small muted">Startet kl. ${started}</div></div>
          <button type="button" class="btn ghost sm" data-act="timer-reset">Start på nytt</button>
        </div>`
      : `<input inputmode="numeric" data-w="durationMin" value="${inputVal(d.durationMin)}" placeholder="Minutter, f.eks. 60" style="margin-top:10px" aria-label="Varighet i minutter">`}
  </div>`;
}
// Gå til registreringen. Står vi allerede på #/okt, kommer ingen hashchange – tegn på nytt selv
function goToEditor() {
  if (location.hash === '#/okt') route(); else location.hash = '#/okt';
}
function startWorkout() {
  db.draft = newDraft();
  save();
  goToEditor();
}

function renderEditor() {
  const d = db.draft;
  if (!d) {
    setHeader('Registrer økt');
    view().innerHTML = `<div class="empty"><svg viewBox="0 0 24 24"><path d="M3 10v4M6 7v10M18 7v10M21 10v4M6 12h12"/></svg>
      <p>Ingen økt under registrering.</p></div>
      <button class="btn primary block big" data-act="start-workout">+ Registrer økt</button>`;
    return;
  }
  const tpl = d.templateId && templateById(d.templateId);
  setHeader(d.id ? 'Rediger økt' : 'Registrer økt', null, tpl ? `⭐ ${tpl.name}` : '');


  let html = `<section class="card"><label class="field">Dato<input type="date" data-w="date" value="${esc(d.date)}" max="${todayISO()}"></label></section>`;


  html += d.entries.map((en, i) => entryCard(en, i)).join('');

  html += `<button class="btn secondary block big" data-act="add-ex">+ Legg til øvelse</button>`;

  html += `<section class="card stack" style="margin-top:20px">
    <h3>Hvordan føltes økta?</h3>
    <div class="feel" role="group" aria-label="Følelse">
      ${FEELINGS.map((f) => `<button type="button" data-act="feel" data-v="${f.v}" aria-pressed="${d.feeling === f.v}"><span class="e">${f.e}</span>${f.l}</button>`).join('')}
    </div>
    ${durationBlock(d)}
    <label class="field">Notat – hvordan kjentes kroppen?<textarea data-w="note" placeholder="Energi, søvn, smerter, hva gikk bra …">${esc(d.note)}</textarea></label>
  </section>

  <section class="card">
    <h3>Lagre i mappe</h3>
    <div class="chips" style="margin-top:10px" data-folder-chips>${draftFolderChips(d)}</div>
  </section>`;

  html += `<button class="btn primary block big" data-act="save-workout">Lagre økt</button>
    <button class="btn danger block btn-destructive" data-act="discard">${d.id ? 'Avbryt redigering' : 'Forkast økt'}</button>`;

  view().innerHTML = html;
}

const shortDate = (iso) => fmtDate(iso, { day: 'numeric', month: 'short' });

function entryCard(en, i) {
  const ex = exById(en.exerciseId);
  const hist = historyFor(ex.id, db.draft.id);
  const { prev, body } = ex.kind === 'cardio' ? cardioBody(en, i, ex, hist) : strengthBody(en, i, ex, hist);
  // Notatet fra siste gang øvelsen ble gjort, f.eks. «øk vekten neste gang»
  const last = hist[hist.length - 1];
  const lastNote = last?.en.note?.trim();
  const noteHtml = lastNote
    ? `<div class="last-note"><span class="last-note-label">📝 Notat fra sist · ${esc(shortDate(last.w.date))}</span>${esc(lastNote)}</div>`
    : '';
  return `<article class="card" id="entry-${i}">
    <div class="entry-head"><h3>${esc(ex.name)}</h3>
      <button class="icon-btn" style="margin:0 -8px 0 0" data-act="entry-menu" data-e="${i}" aria-label="Valg for ${esc(ex.name)}">
        <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><circle cx="5" cy="12" r="1.7" fill="currentColor"/><circle cx="12" cy="12" r="1.7" fill="currentColor"/><circle cx="19" cy="12" r="1.7" fill="currentColor"/></svg>
      </button></div>
    ${noteHtml}
    ${body.head || ''}
    <p class="prev">${prev}</p>
    ${body.main}
    <input class="entry-note" data-e="${i}" data-f="note" value="${esc(en.note || '')}" placeholder="Notat for øvelsen (valgfritt)">
  </article>`;
}

function strengthBody(en, i, ex, hist) {
  const mode = en.mode || 'reps';
  const same = hist.filter((h) => (h.en.mode || 'reps') === mode);
  const last = same[same.length - 1];
  const bestW = bestOf(hist, 'heaviest');
  const bestT = bestOf(hist, 'tested');

  if (exMeasure(ex) !== 'reps') return measureBody(en, i, hist, exMeasure(ex));
  const head = `<div class="seg-toggle" role="group" aria-label="Type trening">
    <button type="button" data-act="mode" data-e="${i}" data-v="reps" aria-pressed="${mode === 'reps'}">Repetisjoner</button>
    <button type="button" data-act="mode" data-e="${i}" data-v="max" aria-pressed="${mode === 'max'}">1RM-test (maks)</button>
  </div>`;

  let prev = last
    ? `Forrige gang (${esc(shortDate(last.w.date))}): <b>${esc(entrySummary(last.en))}</b>`
    : mode === 'max' ? 'Første 1RM-test i denne øvelsen 🎉' : hist.length ? '' : 'Første gang du logger denne øvelsen 🎉';

  let main;
  if (mode === 'max') {
    const recs = [];
    if (bestT) recs.push(`Testet 1RM: <b>${fmtNum(bestT.v, 2)} kg</b> (${esc(shortDate(bestT.h.w.date))})`);
    if (recs.length) prev += (prev ? '<br>' : '') + recs.join(' · ');
    const att = en.attempts || [];
    main = `<div class="sets">
      <div class="set-row att head"><span>#</span><span>kg</span><span>Resultat</span><span></span></div>
      ${att.map((a, j) => `<div class="set-row att">
          <span class="set-no">${j + 1}</span>
          <input inputmode="decimal" data-e="${i}" data-a="${j}" data-f="weight" value="${inputVal(a.weight)}" placeholder="kg" aria-label="Vekt forsøk ${j + 1}">
          <button type="button" class="ok-btn" data-act="toggle-ok" data-e="${i}" data-a="${j}" data-ok="${a.ok ? 'yes' : 'no'}">${a.ok ? '✓ Klarte' : '✗ Bommet'}</button>
          <button class="del-btn" data-act="del-attempt" data-e="${i}" data-a="${j}" aria-label="Slett forsøk ${j + 1}">×</button>
        </div>`).join('')}
    </div>
    <button class="btn ghost sm" style="margin-top:10px" data-act="add-attempt" data-e="${i}">+ Nytt forsøk</button>
    <p class="derived" data-derived="${i}">${maxDerived(en, bestT)}</p>`;
  } else {
    if (bestW) prev += (prev ? ' · ' : '') + `Rekord: <b>${fmtNum(bestW.v, 2)} kg</b>`;
    const lastSets = last ? last.en.sets.filter(setDone) : [];
    main = `<div class="sets">
      <div class="set-row head"><span>Sett</span><span>kg</span><span>Reps</span><span></span></div>
      ${(en.sets || []).map((s, j) => {
        const ls = lastSets[j] || lastSets[lastSets.length - 1];
        return `<div class="set-row">
          <span class="set-no">${j + 1}</span>
          <input inputmode="decimal" data-e="${i}" data-s="${j}" data-f="weight" value="${inputVal(s.weight)}" placeholder="${ls?.weight != null ? fmtNum(ls.weight, 2) : 'kg'}" aria-label="Vekt sett ${j + 1}">
          <input inputmode="numeric" data-e="${i}" data-s="${j}" data-f="reps" value="${inputVal(s.reps)}" placeholder="${ls?.reps ?? 'reps'}" aria-label="Reps sett ${j + 1}">
          <button class="del-btn" data-act="del-set" data-e="${i}" data-s="${j}" aria-label="Slett sett ${j + 1}">×</button>
        </div>`;
      }).join('')}
    </div>
    <div class="row" style="margin-top:10px">
      <button class="btn ghost sm" data-act="add-set" data-e="${i}">+ Legg til sett</button>
      ${last ? `<button class="btn ghost sm" data-act="fill-last" data-e="${i}">↺ Som sist</button>` : ''}
    </div>`;
  }
  return { prev, body: { head, main } };
}

// Øvelser som holdes på tid (f.eks. planke): sekunder per sett, valgfri ekstra vekt
// Øvelser som måles på tid (planke) eller vekt og lengde (farmers carry, sled push/pull)
function measureBody(en, i, hist, measure) {
  const isDist = measure === 'distance';
  const last = hist[hist.length - 1];
  let prev = last ? `Forrige gang (${esc(shortDate(last.w.date))}): <b>${esc(entrySummary(last.en))}</b>` : 'Første gang du logger denne øvelsen 🎉';
  if (isDist) {
    const bw = bestOf(hist, 'carryWeight'), bm = bestOf(hist, 'maxMeters');
    if (bw) prev += ` · Tyngste: <b>${fmtNum(bw.v, 2)} kg</b>`;
    if (bm) prev += ` · Lengste: <b>${fmtNum(bm.v, 0)} m</b>`;
  } else {
    const best = bestOf(hist, 'maxSec');
    if (best) prev += ` · Lengste: <b>${fmtDuration(best.v)}</b>`;
  }
  const lastSets = last ? last.en.sets.filter(setDone) : [];
  const f2 = isDist ? 'meters' : 'sec';
  const main = `<div class="sets">
      <div class="set-row head"><span>Sett</span><span>${isDist ? 'kg' : 'Ekstra kg'}</span><span>${isDist ? 'Meter' : 'Sek'}</span><span></span></div>
      ${(en.sets || []).map((s, j) => {
        const ls = lastSets[j] || lastSets[lastSets.length - 1];
        return `<div class="set-row">
          <span class="set-no">${j + 1}</span>
          <input inputmode="decimal" data-e="${i}" data-s="${j}" data-f="weight" value="${inputVal(s.weight)}" placeholder="${ls?.weight ? fmtNum(ls.weight, 2) : isDist ? 'kg' : '–'}" aria-label="Vekt sett ${j + 1}">
          <input inputmode="decimal" data-e="${i}" data-s="${j}" data-f="${f2}" value="${inputVal(s[f2])}" placeholder="${ls?.[f2] ?? (isDist ? 'm' : 'sek')}" aria-label="${isDist ? 'Meter' : 'Sekunder'} sett ${j + 1}">
          <button class="del-btn" data-act="del-set" data-e="${i}" data-s="${j}" aria-label="Slett sett ${j + 1}">×</button>
        </div>`;
      }).join('')}
    </div>
    <div class="row" style="margin-top:10px">
      <button class="btn ghost sm" data-act="add-set" data-e="${i}">+ Legg til sett</button>
      ${last ? `<button class="btn ghost sm" data-act="fill-last" data-e="${i}">↺ Som sist</button>` : ''}
    </div>`;
  return { prev, body: { head: '', main } };
}

function maxDerived(en, bestT) {
  const st = strengthStats({ ...en, mode: 'max' });
  if (!st || !st.tested) return '';
  let s = `Dagens 1RM: ${fmtNum(st.tested, 2)} kg`;
  if (bestT && st.tested > bestT.v) s += ` 🏆 ny rekord (+${fmtNum(st.tested - bestT.v, 2)} kg)`;
  return s;
}

// Tid som to felt (min + sek). key brukes som prefiks for data-f: <key>min / <key>sec
function timePair(key, sec, attrs, phSec) {
  const v = sec != null && sec > 0;
  return `<div class="time-inputs">
    <input inputmode="numeric" ${attrs} data-f="${key}min" value="${v ? Math.floor(sec / 60) : ''}" placeholder="${phSec ? Math.floor(phSec / 60) : 'min'}" aria-label="Minutter">
    <span class="muted">:</span>
    <input inputmode="numeric" ${attrs} data-f="${key}sec" value="${v ? String(Math.round(sec % 60)).padStart(2, '0') : ''}" placeholder="${phSec ? String(Math.round(phSec % 60)).padStart(2, '0') : 'sek'}" aria-label="Sekunder">
  </div>`;
}
const ph = (v, d = 1) => (v != null && v !== '' ? fmtNum(v, d) : '');

// Felles feltbyggere. attrs angir hvilken del (økta, segment, drag) feltet hører til.
function distField(attrs, km, phKm, unit, label = 'Distanse') {
  const d = unit === 'm' ? 0 : 2;
  return `<label class="field">${label} (${unit})<input inputmode="decimal" ${attrs} data-f="dist" value="${inputVal(toUnit(km, unit))}" placeholder="${ph(toUnit(phKm, unit), d)}"></label>`;
}
function speedField(attrs, kmh, phKmh, cfg, label) {
  if (cfg.speed === 'pace500') return `<div><label class="field">${label} (min/500 m)</label>${timePair('p', paceSec(kmh), attrs, paceSec(phKmh))}</div>`;
  if (cfg.speed !== 'kmh') return '';
  const kmhField = `<label class="field">${label.replace('tempo', 'fart').replace('Tempo', 'Fart')} (km/t)<input inputmode="decimal" ${attrs} data-f="speedKmh" value="${kmh ? inputVal(+kmh.toFixed(2)) : ''}" placeholder="${ph(phKmh)}"></label>`;
  if (!cfg.pace) return kmhField;
  // Løping: tempo i min/km som alternativ til km/t – feltene oppdaterer hverandre
  const paceLabel = /snitt/i.test(label) ? 'Snittempo' : 'Tempo';
  return kmhField + `<div><label class="field">${paceLabel} (min/km)</label>${timePair('q', kmh ? 3600 / kmh : null, attrs, phKmh ? 3600 / phKmh : null)}</div>`;
}
// Holder km/t- og min/km-feltene for samme del (økt, segment, drag) i takt
function syncSpeedInputs(scope, kmh, changed) {
  const q = (f) => document.querySelector(`${scope}[data-f="${f}"]`);
  if (changed !== 'speedKmh' && q('speedKmh')) q('speedKmh').value = kmh ? inputVal(+kmh.toFixed(2)) : '';
  if (changed !== 'q' && q('qmin')) {
    const s = kmh ? Math.round(3600 / kmh) : null;
    q('qmin').value = s ? Math.floor(s / 60) : '';
    q('qsec').value = s ? String(s % 60).padStart(2, '0') : '';
  }
}
function extraField(attrs, f, val, phVal) {
  const F = CARDIO_FIELDS[f];
  return `<label class="field">${F.label}<input inputmode="decimal" ${attrs} data-f="${f}" value="${inputVal(val)}" placeholder="${ph(phVal, F.d)}"></label>`;
}

// Viser verdier som regnes ut når to av tid / distanse / fart er fylt inn
function partHint(timeSec, distKm, kmh, cfg, unit) {
  const r = resolvePart(timeSec, distKm, cfg.speed === 'none' ? null : kmh);
  const out = [];
  if (!(timeSec > 0) && r.timeSec) out.push(fmtDuration(r.timeSec));
  if (cfg.distance && !(distKm > 0) && r.distanceKm) out.push(fmtDist(r.distanceKm, unit));
  if (cfg.speed !== 'none' && r.speed) {
    if (!(kmh > 0)) out.push(fmtSpeed(r.speed, cfg));
    if (cfg.pace) out.push(fmtPace(r.speed));
  }
  return out.length ? '= ' + out.join(' · ') : '';
}

function cardioBody(en, i, ex, hist) {
  const cfg = exCfg(ex);
  const unit = unitOf(en, cfg);
  const purpose = en.purpose || 'endurance';
  const same = hist.filter((h) => (h.en.purpose || 'endurance') === purpose);
  const last = same[same.length - 1];

  let head = `<p class="chip-label" style="margin-top:10px">Type økt</p>
  <div class="chips purpose" role="group" aria-label="Type økt">
    ${PURPOSES.map((p) => `<button type="button" class="chip" data-act="purpose" data-e="${i}" data-v="${p.k}" aria-pressed="${purpose === p.k}">${p.l}</button>`).join('')}
  </div>`;
  if (cfg.distance) {
    head += `<div class="unit-row"><span>Distanse i</span>
      <div class="seg-toggle mini" role="group" aria-label="Distanseenhet">
        <button type="button" data-act="dist-unit" data-e="${i}" data-v="m" aria-pressed="${unit === 'm'}">meter</button>
        <button type="button" data-act="dist-unit" data-e="${i}" data-v="km" aria-pressed="${unit === 'km'}">km</button>
      </div></div>`;
  }

  let prev = `Første ${esc(purposeLabel(purpose).toLowerCase())}-økt i denne øvelsen 🎉`;
  if (last) {
    prev = `Forrige gang (${esc(shortDate(last.w.date))}): <b>${esc(cardioSummary(last.en, false))}</b>`;
    if (isIntervalType(purpose) && cfg.speed !== 'none') {
      const b = bestOf(same, 'speed');
      if (b) prev += ` · Raskest: <b>${esc(fmtSpeed(b.v, cfg))}</b>`;
    } else if (cfg.distance) {
      const b = bestOf(same, 'distanceKm');
      if (b) prev += ` · Lengst: <b>${esc(fmtDist(b.v, unit))}</b>`;
    }
  }

  const main = isIntervalType(purpose) ? intervalForm(en, i, cfg, unit, last) : enduranceForm(en, i, cfg, unit, last);
  return { prev, body: { head, main } };
}

function enduranceForm(en, i, cfg, unit, last) {
  const lastSt = last ? cardioStats(last.en) : null;
  const a = `data-e="${i}"`;
  const segs = en.segments || [];
  const lastSegs = last?.en.segments || [];
  const rates = cfg.fields.filter((f) => CARDIO_FIELDS[f].rate);
  return `<div class="cardio-grid">
      <div><label class="field">Total tid (min:sek)</label>${timePair('t', en.timeSec, a, lastSt?.timeSec)}</div>
      ${cfg.distance ? distField(a, en.distanceKm, lastSt?.distanceKm, unit) : ''}
      ${speedField(a, en.speedKmh, lastSt?.speed, cfg, cfg.speed === 'pace500' ? 'Snittempo' : 'Snittfart')}
      ${cfg.fields.map((f) => extraField(a, f, en[f], lastSt?.[f])).join('')}
      <label class="field">Snittpuls<input inputmode="numeric" ${a} data-f="avgHr" value="${inputVal(en.avgHr)}" placeholder="${ph(lastSt?.avgHr, 0)}"></label>
    </div>

    <div class="subhead">Segmenter</div>
    ${segs.map((s, j) => {
      const l = lastSegs[j] || {};
      const sa = `data-e="${i}" data-g="${j}"`;
      return `<div class="part-card">
        <div class="part-head"><span class="set-no">${j + 1}</span><b>Segment ${j + 1}</b>
          <span class="part-hint" data-hint="${i}-g${j}">${partHint(s.timeSec, s.distanceKm, s.speedKmh, cfg, unit)}</span>
          <button class="del-btn" data-act="del-seg" data-e="${i}" data-g="${j}" aria-label="Slett segment ${j + 1}">×</button></div>
        <div class="part-grid">
          <label class="field">Tid (min)<input inputmode="decimal" ${sa} data-f="segmin" value="${s.timeSec != null ? inputVal(+(s.timeSec / 60).toFixed(2)) : ''}" placeholder="${l.timeSec ? fmtNum(l.timeSec / 60, 2) : ''}"></label>
          ${cfg.distance ? distField(sa, s.distanceKm, l.distanceKm, unit) : ''}
          ${speedField(sa, s.speedKmh, l.speedKmh, cfg, cfg.speed === 'pace500' ? 'Tempo' : 'Fart')}
          ${rates.map((f) => extraField(sa, f, s[f], l[f])).join('')}
        </div></div>`;
    }).join('')}
    <div class="row" style="margin-top:10px">
      <button class="btn ghost sm" data-act="add-seg" data-e="${i}">+ Legg til segment</button>
      ${last ? `<button class="btn ghost sm" data-act="fill-last" data-e="${i}">↺ Som sist</button>` : ''}
    </div>
    <p class="derived" data-derived="${i}">${derivedText(en)}</p>`;
}

function intervalForm(en, i, cfg, unit, last) {
  const ivs = en.intervals || [];
  const lastIvs = last?.en.intervals || [];
  const rates = cfg.fields.filter((f) => CARDIO_FIELDS[f].rate);
  return `<div class="iv-stepper">
      <span>Antall intervaller</span>
      <div class="stepper">
        <button type="button" data-act="iv-count" data-e="${i}" data-d="-1" aria-label="Ett intervall færre" ${ivs.length ? '' : 'disabled'}>−</button>
        <b>${ivs.length}</b>
        <button type="button" data-act="iv-count" data-e="${i}" data-d="1" aria-label="Ett intervall til">+</button>
      </div>
    </div>
    ${ivs.map((x, j) => {
      const l = lastIvs[j] || lastIvs[lastIvs.length - 1] || {};
      const xa = `data-e="${i}" data-iv="${j}"`;
      const isLast = j === ivs.length - 1;
      return `<div class="part-card iv-card">
        <div class="part-head"><span class="set-no">${j + 1}</span><b>Drag ${j + 1}</b>
          <span class="part-hint" data-hint="${i}-i${j}">${partHint(x.timeSec, x.distanceKm, x.speedKmh, cfg, unit)}</span>
          <button class="del-btn" data-act="del-iv" data-e="${i}" data-iv="${j}" aria-label="Slett drag ${j + 1}">×</button></div>
        <div class="part-grid">
          <div><label class="field">Tid (min:sek)</label>${timePair('t', x.timeSec, xa, l.timeSec)}</div>
          ${cfg.distance ? distField(xa, x.distanceKm, l.distanceKm, unit) : ''}
          ${speedField(xa, x.speedKmh, l.speedKmh, cfg, cfg.speed === 'pace500' ? 'Tempo' : 'Fart')}
          ${rates.map((f) => extraField(xa, f, x[f], l[f])).join('')}
          ${isLast ? '' : `<div class="wide"><label class="field">Pause etter drag ${j + 1} (min:sek)</label>${timePair('r', x.restSec, xa, l.restSec)}</div>`}
        </div></div>`;
    }).join('')}
    ${ivs.length > 1 ? `<button class="btn ghost sm" style="margin-top:10px" data-act="iv-copy" data-e="${i}">Kopier drag 1 til alle</button>` : ''}
    ${!ivs.length ? `<button class="btn secondary block" style="margin-top:10px" data-act="iv-count" data-e="${i}" data-d="1">+ Legg til første intervall</button>` : ''}
    <div class="cardio-grid" style="margin-top:14px">
      ${cfg.fields.filter((f) => !CARDIO_FIELDS[f].rate).map((f) => extraField(`data-e="${i}"`, f, en[f], last?.en[f])).join('')}
      <label class="field">Snittpuls<input inputmode="numeric" data-e="${i}" data-f="avgHr" value="${inputVal(en.avgHr)}" placeholder="${ph(last ? cardioStats(last.en)?.avgHr : null, 0)}"></label>
      ${last ? `<div style="align-self:end"><button class="btn ghost sm" data-act="fill-last" data-e="${i}">↺ Som sist</button></div>` : ''}
    </div>
    <p class="derived" data-derived="${i}">${derivedText(en)}</p>`;
}

function derivedText(en) {
  const cfg = exCfg(exById(en.exerciseId));
  const unit = unitOf(en, cfg);
  const iv = intervalTotals(en);
  if (iv) {
    const parts = [];
    if (iv.workSec) parts.push(`arbeid ${fmtDuration(iv.workSec)}`);
    if (iv.distanceKm && cfg.distance) parts.push(fmtDist(iv.distanceKm, unit));
    if (iv.speed && cfg.speed !== 'none') parts.push(`snitt ${fmtSpeed(iv.speed, cfg)} i dragene`);
    if (iv.restSec) parts.push(`pauser ${fmtDuration(iv.restSec)}`);
    if (iv.totalSec && iv.restSec) parts.push(`totalt ${fmtDuration(iv.totalSec)}`);
    return parts.length ? 'Beregnet: ' + parts.join(' · ') : '';
  }
  const st = cardioStats(en);
  if (!st) return '';
  const seg = segTotals(en);
  const parts = [];
  if (!en.timeSec && st.timeSec) parts.push(`tid ${fmtDuration(st.timeSec)}`);
  if (cfg.distance && !en.distanceKm && st.distanceKm) parts.push(fmtDist(st.distanceKm, unit));
  if (cfg.speed !== 'none') {
    if (!en.speedKmh && st.speed) parts.push(`${cfg.speed === 'pace500' ? 'snittempo' : 'snittfart'} ${fmtSpeed(st.speed, cfg)}`);
    if (seg?.maxSpeed && seg.count > 1) parts.push(`${cfg.speed === 'pace500' ? 'raskeste' : 'toppfart'} ${fmtSpeed(seg.maxSpeed, cfg)}`);
    if (cfg.pace && st.speed) parts.push(`tempo ${fmtPace(st.speed)}`);
  }
  return parts.length ? 'Beregnet: ' + parts.join(' · ') : '';
}

function blankCardio() {
  const o = { timeSec: null, distanceKm: null, speedKmh: null, avgHr: null, kcal: null, purpose: 'endurance', distUnit: null, segments: [], intervals: [] };
  for (const f of Object.keys(CARDIO_FIELDS)) o[f] = null;
  return o;
}
function blankPart() {
  const o = { timeSec: null, distanceKm: null, speedKmh: null };
  for (const f of RATE_FIELDS) o[f] = null;
  return o;
}
const blankInterval = () => ({ ...blankPart(), restSec: null });

// Legger til flere øvelser i økta på én gang (fra flervalg i øvelsesvelgeren)
function addExercisesToDraft(ids) {
  if (!ids.length) return;
  const first = db.draft.entries.length;
  for (const id of ids) db.draft.entries.push(makeEntry(id));
  save();
  closeSheet();
  renderEditor();
  const el = document.getElementById(`entry-${first}`);
  if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
}
function addExerciseToDraft(exId) {
  addExercisesToDraft([exId]);
}
function makeEntry(exId) {
  const ex = exById(exId);
  const entry = { id: uid(), exerciseId: exId, note: '' };
  const hist = historyFor(exId, db.draft.id);
  const last = hist[hist.length - 1];
  if (ex.kind === 'cardio') {
    Object.assign(entry, blankCardio(), { purpose: last?.en.purpose || 'endurance' });
    if (isIntervalType(entry.purpose)) entry.intervals = (last.en.intervals || [blankInterval()]).map(blankInterval);
  } else {
    // Antall sett som sist forrige reps-økt; verdiene fra forrige gang vises som hint
    const lastReps = [...hist].reverse().find((h) => (h.en.mode || 'reps') === 'reps');
    const n = lastReps ? Math.max(1, lastReps.en.sets.filter(setDone).length) : 3;
    entry.mode = 'reps';
    entry.sets = Array.from({ length: n }, () => ({ weight: null, reps: null }));
    entry.attempts = [];
  }
  return entry;
}

// Gjør en øvelse klar for lagring: fjerner tomme rader og data fra ubrukt modus
function cleanEntry(orig) {
  const en = clone(orig);
  const ex = exById(en.exerciseId);
  if (ex.kind === 'strength') {
    if (en.mode === 'max') {
      en.attempts = (en.attempts || []).filter((a) => a.weight > 0);
      delete en.sets;
      return en.attempts.length ? en : null;
    }
    en.mode = 'reps';
    en.sets = (en.sets || []).filter((s) => setDone(s) || (s.weight || 0) > 0);
    delete en.attempts;
    return en.sets.length ? en : null;
  }
  en.purpose ||= 'endurance';
  if (isIntervalType(en.purpose)) {
    // Intervalløkt: totalverdier og segmenter hører til utholdenhetsskjemaet
    en.intervals = (en.intervals || []).filter((x) => x.timeSec > 0 || x.distanceKm > 0 || x.speedKmh > 0);
    Object.assign(en, { segments: [], timeSec: null, distanceKm: null, speedKmh: null, incline: null, level: null });
  } else {
    en.segments = (en.segments || []).filter((s) => s.timeSec > 0 || s.distanceKm > 0 || s.speedKmh > 0);
    en.intervals = [];
  }
  return cardioStats(en) ? en : null;
}

// Ruller til den første øvelsen som mangler verdier og markerer de aktuelle kortene
function highlightEntries(indexes) {
  const cards = indexes.map((i) => document.getElementById(`entry-${i}`)).filter(Boolean);
  cards.forEach((c) => { c.classList.remove('needs-values'); void c.offsetWidth; c.classList.add('needs-values'); });
  cards[0]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

async function saveWorkout() {
  const d = db.draft;
  const cleaned = d.entries.map(cleanEntry);
  const entries = cleaned.filter(Boolean);
  // Øvelser uten verdier blir ikke lagret – si fra i stedet for å fjerne dem i stillhet
  const emptyIdx = cleaned.map((en, i) => (en ? -1 : i)).filter((i) => i >= 0);
  if (!entries.length) {
    toast(d.entries.length ? 'Ingen av øvelsene har verdier ennå' : 'Legg til minst én øvelse før du lagrer');
    if (emptyIdx.length) highlightEntries(emptyIdx);
    return;
  }
  const missingReps = entries.some((en) => en.sets && en.sets.some((s) => !setDone(s)));
  if (emptyIdx.length || missingReps) {
    const lines = [];
    if (emptyIdx.length) {
      lines.push(`${emptyIdx.length === 1 ? 'Denne øvelsen har' : 'Disse øvelsene har'} ingen verdier og blir ikke lagret:`);
      lines.push(...emptyIdx.map((i) => `• ${exById(d.entries[i].exerciseId).name}`));
    }
    if (missingReps) lines.push(`${emptyIdx.length ? '\n' : ''}Noen sett mangler antall reps.`);
    const ok = await askConfirm(lines.join('\n'), { title: 'Mangler verdier', ok: 'Lagre likevel', cancel: 'Gå tilbake' });
    if (!ok) {
      if (emptyIdx.length) highlightEntries(emptyIdx);
      return;
    }
  }

  // Finn nye rekorder før lagring
  const records = [];
  for (const en of entries) {
    const ex = exById(en.exerciseId);
    const hist = historyFor(ex.id, d.id);
    if (!hist.length) continue;
    const st = entryStats(en);
    if (!st) continue;
    const keys = ex.kind === 'cardio'
      ? [['distanceKm', 'distanse'], ['speed', 'fart'], ['maxSpeed', 'toppfart']].filter(([k]) => (k === 'distanceKm' ? exCfg(ex).distance : exCfg(ex).speed !== 'none'))
      : [['tested', '1RM'], ['repWeight', 'vekt']];
    for (const [k, l] of keys) {
      const b = bestOf(hist, k);
      if (st[k] != null && b && st[k] > b.v) { records.push(`${ex.name} (${l})`); break; }
    }
  }

  let durationMin = d.durationMin;
  if (durationMode(d) === 'timer') {
    // Tidtakeren – men ikke hvis den har stått på urimelig lenge (f.eks. glemt over natta)
    const m = Math.max(1, elapsedMin(d));
    durationMin = m <= 360 ? m : null;
  }
  if (durationMin == null) {
    // Ført inn i etterkant: bruk summen av kondisjonstid hvis det finnes
    const sec = entries.reduce((a, en) => a + (exById(en.exerciseId).kind === 'cardio' ? cardioStats(en)?.timeSec || 0 : 0), 0);
    if (sec) durationMin = Math.round(sec / 60);
  }

  const workout = {
    id: d.id || uid(),
    date: d.date || todayISO(),
    durationMin,
    feeling: d.feeling,
    note: (d.note || '').trim(),
    folderId: folderById(d.folderId) ? d.folderId : null,
    entries,
    createdAt: d.createdAt || Date.now(),
    updatedAt: Date.now(),
  };
  const idx = db.workouts.findIndex((w) => w.id === workout.id);
  if (idx >= 0) db.workouts[idx] = workout; else db.workouts.push(workout);
  db.draft = null;
  save();
  location.hash = `#/okt/${encodeURIComponent(workout.id)}`;
  const folderName = folderById(workout.folderId)?.name;
  const saved = folderName ? `Økta er lagret i «${folderName}» 👍` : 'Økta er lagret 👍';
  toast(records.length ? `🏆 Ny rekord: ${records.join(', ')}!` : saved, records.length ? 4000 : 2400);
}

/* ---------- Øvelsesvelger ---------- */
// Valgte øvelser i velgeren (i den rekkefølgen de ble valgt)
let pickerSel = [];
// target: 'draft' (økta som registreres) eller 'template' (favorittøkta som lages)
let pickerTarget = 'draft';
function openExercisePicker(keepSelection, target) {
  if (target) pickerTarget = target;
  if (!keepSelection) pickerSel = [];
  openSheet(`<h2>Legg til øvelser</h2>
    <input type="search" data-search placeholder="Søk eller skriv navn på ny øvelse" autocomplete="off">
    <div class="scroll" id="picker-list" style="margin-top:8px"></div>
    <div class="picker-footer"><button class="btn primary block big" data-act="picker-add"></button></div>`);
  renderPickerList('');
  updatePickerFooter();
}
function updatePickerFooter() {
  const btn = $('#sheet-root [data-act="picker-add"]');
  if (!btn) return;
  const n = pickerSel.length;
  btn.disabled = !n;
  btn.textContent = n ? `Legg til ${n} ${n === 1 ? 'øvelse' : 'øvelser'}` : 'Legg til';
}
function togglePick(id) {
  const i = pickerSel.indexOf(id);
  if (i >= 0) pickerSel.splice(i, 1); else pickerSel.push(id);
  // Samme øvelse kan stå i flere mapper – oppdater alle knappene
  document.querySelectorAll(`#picker-list [data-act="pick-ex"][data-id="${CSS.escape(id)}"]`)
    .forEach((b) => b.setAttribute('aria-pressed', pickerSel.includes(id)));
  updatePickerFooter();
}
// En øvelse hører til sin hovedkategori, og kan i tillegg vises i andre mapper (also)
const inCat = (e, cat, withAlso) => (e.cat || 'Annet') === cat || (withAlso && (e.also || []).includes(cat));
// Standardøvelser i fast rekkefølge (basisøvelser først), egne øvelser alfabetisk etterpå
const sortEx = (a, b) => (a.order ?? 999) - (b.order ?? 999) || a.name.localeCompare(b.name, 'nb');
// I en mappe: øvelser som hører hjemme der først, de som også vises der til slutt
const sortIn = (cat) => (a, b) => ((a.cat || 'Annet') !== cat) - ((b.cat || 'Annet') !== cat) || sortEx(a, b);

// Sammenleggbare mapper per kategori. Husker hvilke mapper som er åpne.
const openFolders = new Set(loadOpenFolders());
function loadOpenFolders() {
  try { return JSON.parse(localStorage.getItem('treningslogg.folders') || '[]'); } catch { return []; }
}
function folder(key, title, count, content, icon) {
  return `<details class="folder" data-folder="${esc(key)}" ${openFolders.has(key) ? 'open' : ''}>
    <summary>${icon ? `<span class="folder-icon" aria-hidden="true">${icon}</span>` : ''}<span class="folder-title">${esc(title)}</span><span class="folder-count">${count}</span><span class="chev" aria-hidden="true"></span></summary>
    <div class="folder-body">${content}</div>
  </details>`;
}
document.addEventListener('toggle', (ev) => {
  const d = ev.target;
  if (!d.matches || !d.matches('details[data-folder]')) return;
  if (d.open) openFolders.add(d.dataset.folder); else openFolders.delete(d.dataset.folder);
  try { localStorage.setItem('treningslogg.folders', JSON.stringify([...openFolders])); } catch {}
}, true);

function renderPickerList(q) {
  const list = $('#picker-list');
  if (!list) return;
  const query = q.trim().toLowerCase();
  // Mest brukte øverst
  const counts = {};
  for (const w of db.workouts) for (const e of w.entries) counts[e.exerciseId] = (counts[e.exerciseId] || 0) + 1;
  const inDraft = new Set(pickerTarget === 'template' ? tplDraft?.exerciseIds || [] : (db.draft?.entries || []).map((e) => e.exerciseId));
  const inLabel = pickerTarget === 'template' ? '(lagt til)' : '(i økta)';
  const visible = db.exercises.filter((e) => !e.hidden && (!query || e.name.toLowerCase().includes(query)));

  let html = '';
  if (query && !db.exercises.some((e) => e.name.toLowerCase() === query)) {
    html += `<button class="btn secondary block" style="margin:6px 0" data-act="new-ex" data-name="${esc(q.trim())}">+ Lag ny øvelse «${esc(q.trim())}»</button>`;
  }
  const opt = (e) => `<button class="ex-option pick" data-act="pick-ex" data-id="${esc(e.id)}" aria-pressed="${pickerSel.includes(e.id)}">
    <span class="pick-check" aria-hidden="true"></span>
    <span class="pick-name">${esc(e.name)}${inDraft.has(e.id) ? ` <span class="muted small">${inLabel}</span>` : ''}</span>
    <span class="kind">${e.kind === 'cardio' ? 'Kondisjon' : 'Styrke'}</span></button>`;

  const byCat = (cat, withAlso) => visible.filter((e) => inCat(e, cat, withAlso)).sort(sortIn(cat));
  if (query) {
    // Søk: vis treffene direkte, uten mapper
    for (const cat of CATEGORIES) {
      const items = byCat(cat);
      if (items.length) html += `<div class="ex-group">${cat}</div>` + items.map(opt).join('');
    }
  } else {
    const frequent = visible.filter((e) => counts[e.id]).sort((a, b) => counts[b.id] - counts[a.id]).slice(0, 6);
    if (frequent.length) html += folder('mest-brukt', 'Mest brukt', frequent.length, frequent.map(opt).join(''));
    for (const cat of CATEGORIES) {
      const items = byCat(cat, true);
      if (items.length) html += folder(cat, cat, items.length, items.map(opt).join(''));
    }
    if (!visible.length) html += `<p class="muted">Ingen øvelser.</p>`;
  }
  if (!query) html += `<button class="btn ghost block" style="margin-top:14px" data-act="new-ex" data-name="">+ Lag ny øvelse</button>`;
  list.innerHTML = html;
}
function openNewExerciseForm(name, onDone, existing) {
  const e = existing || { name, kind: 'strength', cat: 'Annet' };
  const cfg = exCfg(e.kind === 'cardio' ? e : { cfg: { distance: true, unit: 'km', speed: 'kmh', fields: [] } });
  const locked = existing && isUsed(existing.id);
  // Enkeltvalg: knappene setter et skjult felt med samme navn
  const choice = (field, value, opts) => `<div class="chips" style="margin-top:6px" data-choice="${field}">
      ${opts.map(([v, l]) => `<button type="button" class="chip" data-act="choice" data-v="${v}" aria-pressed="${String(value) === v}">${l}</button>`).join('')}
    </div><input type="hidden" name="${field}" value="${value}">`;
  openSheet(`<h2>${existing ? 'Endre øvelse' : 'Ny øvelse'}</h2>
    <div class="scroll">
    <form class="stack" data-form="exercise" data-id="${esc(existing?.id || '')}" data-then="${esc(onDone)}">
      <label class="field">Navn<input name="name" required value="${esc(e.name)}" placeholder="f.eks. Hip thrust" autocomplete="off"></label>
      <div><label class="field">Type</label>
        ${choice('kind', e.kind, [['strength', 'Styrke'], ['cardio', 'Kondisjon']])}
        ${locked ? '<p class="small muted" style="margin-top:6px">Typen kan ikke endres fordi øvelsen allerede er brukt.</p>' : ''}
      </div>

      <div data-show="strength" ${e.kind === 'strength' ? '' : 'hidden'}>
        <label class="field">Måles i</label>
        ${choice('measure', exMeasure(e), [['reps', 'Vekt og repetisjoner'], ['time', 'Tid (sek), f.eks. planke'], ['distance', 'Vekt og lengde (m), f.eks. sled push']])}
      </div>

      <div data-show="cardio" class="stack" ${e.kind === 'cardio' ? '' : 'hidden'}>
        <div><label class="field">Distanse</label>
          ${choice('distance', String(cfg.distance), [['true', 'Ja'], ['false', 'Nei']])}</div>
        <div data-show-dist ${cfg.distance ? '' : 'hidden'}><label class="field">Standard enhet for distanse</label>
          ${choice('unit', cfg.unit, [['m', 'Meter'], ['km', 'Kilometer']])}</div>
        <div><label class="field">Hastighet vises som</label>
          ${choice('speed', cfg.speed, Object.entries(SPEED_TYPES))}</div>
        <div data-show-pace ${cfg.speed === 'kmh' ? '' : 'hidden'}><label class="field">Tempo i min/km (løping)</label>
          ${choice('pace', String(cfg.pace), [['true', 'Ja'], ['false', 'Nei']])}</div>
        <div><label class="field">Andre verdier å registrere</label>
          <div class="chips" style="margin-top:6px" data-multi="fields">
            ${Object.entries(CARDIO_FIELDS).map(([k, F]) => `<button type="button" class="chip" data-act="toggle-field" data-v="${k}" aria-pressed="${cfg.fields.includes(k)}">${F.name}</button>`).join('')}
          </div>
          <input type="hidden" name="fields" value="${cfg.fields.join(',')}"></div>
      </div>

      <label class="field">Kategori<select name="cat">${CATEGORIES.map((c) => `<option ${c === e.cat ? 'selected' : ''}>${c}</option>`).join('')}</select></label>
      <button class="btn primary block big" type="submit">${existing ? 'Lagre' : 'Lag øvelse'}</button>
    </form></div>`);
  setTimeout(() => $('#sheet-root input[name="name"]')?.focus(), 50);
}
// Leser valgene i øvelsesskjemaet: tid/reps for styrke, oppsett for kondisjon
function formExerciseProps(form, kind) {
  const f = form.elements;
  if (kind === 'cardio') {
    return {
      timed: undefined,
      measure: undefined,
      extra: undefined,
      cfg: {
        distance: f.distance.value === 'true',
        unit: f.unit.value,
        speed: f.speed.value,
        pace: f.speed.value === 'kmh' && f.pace.value === 'true',
        fields: f.fields.value.split(',').filter((k) => CARDIO_FIELDS[k]),
      },
    };
  }
  return { measure: f.measure.value === 'reps' ? undefined : f.measure.value, timed: undefined, cfg: undefined, extra: undefined };
}
const isUsed = (exId) => db.workouts.some((w) => w.entries.some((e) => e.exerciseId === exId));

/* =========================================================
   Økt-detaljer
   ========================================================= */
function renderWorkoutDetail(id) {
  const w = db.workouts.find((x) => x.id === id);
  if (!w) { setHeader('Økt', '#/historikk'); view().innerHTML = `<div class="empty">Fant ikke økta.</div>`; return; }
  setHeader(fmtDate(w.date, { day: 'numeric', month: 'long' }), '#/historikk');
  const feel = FEELINGS.find((f) => f.v === w.feeling);

  let html = `<section class="card stack">
    <p class="muted small">${esc(fmtDateLong(w.date).replace(/^./, (c) => c.toUpperCase()))}</p>
    <div class="row" style="gap:16px;flex-wrap:wrap">
      ${w.durationMin ? `<span>⏱ ${fmtNum(w.durationMin, 0)} min</span>` : ''}
      ${feel ? `<span>${feel.e} ${feel.l}</span>` : ''}
      <span>${w.entries.length} ${w.entries.length === 1 ? 'øvelse' : 'øvelser'}</span>
    </div>
    <div class="row between folder-line">
      <span>${folderById(w.folderId) ? `📁 ${esc(folderById(w.folderId).name)}` : '<span class="muted">Ikke i noen mappe</span>'}</span>
      <button class="btn ghost sm" data-act="move-workout" data-id="${esc(w.id)}">${folderById(w.folderId) ? 'Flytt' : 'Legg i mappe'}</button>
    </div>
    ${w.note ? `<p style="white-space:pre-wrap">${esc(w.note)}</p>` : ''}
  </section>`;

  for (const en of w.entries) {
    const ex = exById(en.exerciseId);
    html += `<section class="card"><div class="entry-head"><h3>${esc(ex.name)}</h3>
      <a class="btn ghost sm" href="#/statistikk/${encodeURIComponent(ex.id)}">Fremgang</a></div>`;
    if (ex.kind === 'cardio') {
      if (en.purpose) html += `<span class="tag">${esc(purposeLabel(en.purpose))}</span>`;
      html += `<p style="margin-top:6px">${esc(cardioSummary(en, false))}</p>`;
      const st = cardioStats(en);
      const cfg = exCfg(ex);
      const unit = unitOf(en, cfg);
      if (st?.speed && cfg.speed === 'kmh') {
        const bits = [];
        if (cfg.pace) bits.push(`Snittempo ${fmtPace(st.speed)}`);
        if (st.maxSpeed && st.maxSpeed > st.speed + 0.05) bits.push(`toppfart ${fmtNum(st.maxSpeed, 1)} km/t${cfg.pace ? ` (${fmtPace(st.maxSpeed)})` : ''}`);
        if (bits.length) html += `<p class="small muted">${bits.join(' · ')}</p>`;
      }
      const iv = intervalTotals(en);
      const segs = resolvedSegments(en);
      const rates = cfg.fields.filter((f) => CARDIO_FIELDS[f].rate);
      const speedHead = cfg.speed === 'pace500' ? '/500 m' : 'km/t';
      const cols = (p, raw) => `${cfg.distance ? `<td class="num">${p.distanceKm ? fmtDist(p.distanceKm, unit) : '–'}</td>` : ''}${cfg.speed !== 'none' ? `<td class="num">${p.speed ? (cfg.speed === 'pace500' ? fmtDuration(paceSec(p.speed)) : fmtNum(p.speed, 1)) : '–'}${cfg.pace && p.speed ? `<div class="sub">${fmtPace(p.speed)}</div>` : ''}</td>` : ''}${rates.map((f) => `<td class="num">${fmtNum(raw[f], CARDIO_FIELDS[f].d)}</td>`).join('')}`;
      const heads = `${cfg.distance ? '<th class="num">Distanse</th>' : ''}${cfg.speed !== 'none' ? `<th class="num">${speedHead}</th>` : ''}${rates.map((f) => `<th class="num">${esc(CARDIO_FIELDS[f].unit)}</th>`).join('')}`;
      if (iv) {
        html += `<div class="subhead">Intervaller</div>
          <div class="table-scroll"><table class="data" style="margin-top:6px"><thead><tr><th>#</th><th class="num">Tid</th>${heads}<th class="num">Pause</th></tr></thead><tbody>
          ${en.intervals.map((x, j) => { const p = iv.parts[j]; return `<tr><td>${j + 1}</td><td class="num">${p.timeSec ? fmtDuration(p.timeSec) : '–'}</td>${cols(p, x)}<td class="num">${j < en.intervals.length - 1 && x.restSec ? fmtDuration(x.restSec) : '–'}</td></tr>`; }).join('')}
          </tbody></table></div>`;
      } else if (segs.length) {
        let acc = 0;
        html += `<div class="subhead">${cfg.speed === 'none' ? 'Segmenter' : 'Fartsprofil'}</div>
          ${cfg.speed === 'kmh' && segs.length > 1 && segs.every((s) => s.timeSec && s.speed) ? `<div class="chart-wrap" data-seg-chart="${esc(en.id)}"></div>` : ''}
          <div class="table-scroll"><table class="data" style="margin-top:6px"><thead><tr><th>#</th><th>Tid</th>${heads}</tr></thead><tbody>
          ${segs.map((s, j) => { const from = acc; acc += s.timeSec || 0; return `<tr><td>${j + 1}</td><td>${s.timeSec ? `${fmtDuration(from)}–${fmtDuration(acc)}` : '–'}</td>${cols(s, s)}</tr>`; }).join('')}
          </tbody></table></div>`;
      }
    } else if (en.mode === 'max') {
      const st = strengthStats(en);
      html += `<span class="tag">1RM-test</span>
        <table class="data" style="margin-top:8px"><thead><tr><th>Forsøk</th><th class="num">kg</th><th class="num">Resultat</th></tr></thead><tbody>
        ${en.attempts.map((a, j) => `<tr><td>${j + 1}</td><td class="num">${fmtNum(a.weight, 2)}</td><td class="num">${a.ok ? '✓ Klarte' : '✗ Bommet'}</td></tr>`).join('')}
      </tbody></table>`;
      if (st) html += `<p style="margin-top:8px"><b>1RM: ${st.tested ? fmtNum(st.tested, 2) + ' kg' : 'ingen godkjente løft'}</b></p>`;
    } else {
      const st = strengthStats(en);
      const measure = exMeasure(ex);
      const head2 = { reps: 'Reps', time: 'Tid', distance: 'Meter' }[measure];
      const val2 = (s) => (measure === 'time' ? (s.sec ? fmtDuration(s.sec) : '–') : measure === 'distance' ? (s.meters ? fmtNum(s.meters, 0) : '–') : s.reps ?? '–');
      html += `<table class="data" style="margin-top:8px"><thead><tr><th>Sett</th><th class="num">${measure === 'time' ? 'Ekstra kg' : 'kg'}</th><th class="num">${head2}</th></tr></thead><tbody>
        ${en.sets.map((s, j) => `<tr><td>${j + 1}</td><td class="num">${s.weight ? fmtNum(s.weight, 2) : '–'}</td><td class="num">${val2(s)}</td></tr>`).join('')}
      </tbody></table>`;
      if (st && measure === 'time') html += `<p class="small muted" style="margin-top:8px">Lengste hold ${fmtDuration(st.maxSec)} · totalt ${fmtDuration(st.totalSec)}</p>`;
      else if (st && measure === 'distance') html += `<p class="small muted" style="margin-top:8px">Totalt ${fmtNum(st.totalMeters, 0)} m${st.carryWeight ? ` · tyngste ${fmtNum(st.carryWeight, 2)} kg` : ''}</p>`;
      else if (st) html += `<p class="small muted" style="margin-top:8px">${st.volume ? `Volum ${fmtNum(st.volume, 0)} kg · ` : ''}${st.totalReps} reps totalt</p>`;
    }
    if (en.note) html += `<p class="small" style="margin-top:6px">📝 ${esc(en.note)}</p>`;
    html += `</section>`;
  }

  html += `<div class="btn-row" style="margin-top:16px">
    <button class="btn ghost" data-act="edit-workout" data-id="${esc(w.id)}">Rediger</button>
    <button class="btn ghost" data-act="repeat-workout" data-id="${esc(w.id)}">Gjenta økt</button>
  </div>
  <button class="btn danger block btn-destructive" data-act="delete-workout" data-id="${esc(w.id)}">Slett økt</button>`;
  view().innerHTML = html;
  for (const el of document.querySelectorAll('[data-seg-chart]')) {
    const en = w.entries.find((e) => e.id === el.dataset.segChart);
    if (en) drawSegChart(el, resolvedSegments(en), exCfg(exById(en.exerciseId)).fields.filter((f) => CARDIO_FIELDS[f].rate));
  }
}

// Fartsprofil: trappediagram med fart over tid
function drawSegChart(el, segs, rates) {
  const W = Math.max(260, el.clientWidth), H = 150, m = { t: 10, r: 8, b: 22, l: 34 };
  const iw = W - m.l - m.r, ih = H - m.t - m.b;
  const total = segs.reduce((a, s) => a + s.timeSec, 0);
  const speeds = segs.map((s) => s.speed);
  const ticks = niceTicks(Math.min(...speeds) * 0.9, Math.max(...speeds), 3);
  const y0 = ticks[0], y1 = ticks[ticks.length - 1];
  const X = (sec) => m.l + (sec / total) * iw;
  const Y = (v) => m.t + ih - ((v - y0) / (y1 - y0 || 1)) * ih;
  let acc = 0, d = '';
  const items = [];
  segs.forEach((s, j) => {
    const x0 = X(acc), x1 = X(acc + s.timeSec), y = Y(s.speed);
    d += `${j ? 'L' : 'M'}${x0.toFixed(1)},${y.toFixed(1)}H${x1.toFixed(1)}`;
    items.push({ x: (x0 + x1) / 2, y, tip: `<b>${fmtNum(s.speed, 1)} km/t</b><br>Segment ${j + 1}: ${fmtDuration(acc)}–${fmtDuration(acc + s.timeSec)}${rates.filter((f) => s[f] != null).map((f) => `<br>${CARDIO_FIELDS[f].name}: ${fmtNum(s[f], CARDIO_FIELDS[f].d)}`).join('')}` });
    acc += s.timeSec;
  });
  const area = `${d}V${m.t + ih}H${m.l}Z`;
  const xt = [0, total / 2, total];
  el.innerHTML = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Fart per segment">
    <g class="grid">${ticks.map((v) => `<line x1="${m.l}" x2="${W - m.r}" y1="${Y(v)}" y2="${Y(v)}"/>`).join('')}</g>
    <g class="axis">${ticks.map((v) => `<text x="${m.l - 6}" y="${Y(v) + 4}" text-anchor="end">${fmtNum(v, 1)}</text>`).join('')}
      ${xt.map((t, i) => `<text x="${X(t)}" y="${H - 5}" text-anchor="${['start', 'middle', 'end'][i]}">${fmtDuration(t)}</text>`).join('')}</g>
    <path class="series-area" d="${area}"/>
    <path class="series-line" d="${d}"/>
    <line class="crosshair" x1="0" x2="0" y1="${m.t}" y2="${m.t + ih}"/>
    <circle class="hover-dot" r="5" cx="0" cy="0"/>
    <rect x="${m.l}" y="0" width="${iw}" height="${H}" fill="transparent"/>
  </svg><div class="chart-tip"></div>`;
  attachHover(el, W, items, true);
}

/* =========================================================
   Historikk
   ========================================================= */
// Historikk: tidslinje («Alle økter») eller egne mapper, med søk og datofilter
const histUI = {
  mode: (() => { try { return localStorage.getItem('treningslogg.histmode') || 'folders'; } catch { return 'folders'; } })(),
  q: '',             // søk på øvelsesnavn
  dateMode: 'all',   // 'all' | 'day' | 'range'
  day: '', from: '', to: '',
  order: 'desc',     // 'desc' = nyeste først
  filterOpen: false, // datofilteret er sammenlagt til man trykker på kalenderikonet
};
const histFilterActive = () => !!histUI.q.trim() || (histUI.dateMode === 'day' && histUI.day) || (histUI.dateMode === 'range' && (histUI.from || histUI.to));

// Økter som passer søk og datofilter, sortert etter valgt rekkefølge
function filteredWorkouts() {
  const q = histUI.q.trim().toLowerCase();
  let ws = sortedWorkouts().filter((w) => {
    if (q && !w.entries.some((e) => exById(e.exerciseId).name.toLowerCase().includes(q))) return false;
    if (histUI.dateMode === 'day' && histUI.day && w.date !== histUI.day) return false;
    if (histUI.dateMode === 'range') {
      if (histUI.from && w.date < histUI.from) return false;
      if (histUI.to && w.date > histUI.to) return false;
    }
    return true;
  });
  if (histUI.order === 'asc') ws = ws.reverse();
  return ws;
}

/* ---------- Trend: økter per måned ---------- */
const TREND_MESSAGES = {
  up: [
    'Du har hatt en positiv trend i det siste – stå på! 💪',
    'Pilen peker oppover. Fortsett den gode flyten! 🚀',
    'Flere økter enn før – du er på riktig vei! 🔥',
    'Sterk utvikling den siste tiden. Hold trykket oppe!',
  ],
  flat: [
    'Du trener jevnt – fortsett slik! 👌',
    'Stødig og jevnt. Det er sånn fremgang bygges.',
    'Fin rytme i treningen. Bare fortsett! 💪',
    'Jevn innsats måned etter måned – godt jobba.',
  ],
  down: [
    'Du har trent litt mindre i det siste – lytt til kroppen. 🙏',
    'Litt roligere periode nå. Hvile er også en del av treningen.',
    'Færre økter enn før – ta det i ditt tempo og lytt til kroppen.',
    'Litt nedgang i det siste. Én økt om gangen, så er du i gang igjen.',
  ],
};
const TREND_LABELS = { up: '↗ Økende', flat: '→ Stabil', down: '↘ Synkende' };

// Månedene fra første måned med økter (maks de siste 6), med prognose for inneværende måned
function monthlyTrend() {
  const now = new Date();
  const months = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    months.push({ key, d, n: db.workouts.filter((w) => w.date.startsWith(key)).length });
  }
  const first = months.findIndex((m) => m.n > 0);
  if (first < 0) return null;
  const list = months.slice(first);
  if (list.length < 2) return null;
  // Inneværende måned er ikke ferdig: regn om etter dagene som har gått
  const cur = list[list.length - 1];
  const day = now.getDate();
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  cur.partial = true;
  cur.projected = cur.n * (daysInMonth / day);
  // Tidlig i måneden er prognosen usikker – da sammenlignes bare hele måneder
  const vals = list.map((m) => (m.partial ? m.projected : m.n));
  const useVals = day < 7 ? vals.slice(0, -1) : vals;
  if (useVals.length < 2) return { list, trend: 'flat' };
  const recent = useVals.slice(-2);
  const prior = useVals.slice(0, -2).slice(-3);
  const avg = (a) => a.reduce((s, v) => s + v, 0) / a.length;
  const [a, b] = prior.length ? [avg(recent), avg(prior)] : [useVals[useVals.length - 1], useVals[useVals.length - 2]];
  const ratio = b ? a / b : a > 0 ? 2 : 1;
  const trend = ratio >= 1.15 ? 'up' : ratio <= 0.85 ? 'down' : 'flat';
  return { list, trend };
}

let trendData = null;
function trendCard() {
  trendData = monthlyTrend();
  if (!trendData) return '';
  const { trend } = trendData;
  const msgs = TREND_MESSAGES[trend];
  const msg = msgs[Math.floor(Math.random() * msgs.length)];
  return `<section class="card trend-card trend-${trend}">
    <div class="row between">
      <span class="goal-label">Økter per måned</span>
      <span class="trend-pill">${TREND_LABELS[trend]}</span>
    </div>
    <div class="chart-wrap" id="trend-chart"></div>
    <p class="trend-msg">${esc(msg)}</p>
  </section>`;
}

function drawTrendChart() {
  const el = $('#trend-chart');
  if (!el || !trendData) return;
  const pts = trendData.list;
  const W = Math.max(260, el.clientWidth), H = 78, m = { t: 12, r: 10, b: 18, l: 10 };
  const iw = W - m.l - m.r, ih = H - m.t - m.b;
  const max = Math.max(1, ...pts.map((p) => p.n));
  const X = (i) => m.l + (pts.length === 1 ? iw / 2 : (i / (pts.length - 1)) * iw);
  const Y = (v) => m.t + ih - (v / max) * ih;
  const xy = pts.map((p, i) => [X(i), Y(p.n)]);
  // Hele måneder heltrukket, inneværende (ufullstendig) måned stiplet
  const solid = xy.slice(0, -1).map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`).join('');
  const [lx, ly] = xy[xy.length - 1], [px, py] = xy[xy.length - 2];
  const area = `M${xy[0][0]},${m.t + ih}` + xy.map(([x, y]) => `L${x.toFixed(1)},${y.toFixed(1)}`).join('') + `L${lx},${m.t + ih}Z`;
  const mon = (d) => d.toLocaleDateString('nb-NO', { month: 'short' }).replace('.', '');
  el.innerHTML = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Antall økter per måned: ${pts.map((p) => `${mon(p.d)} ${p.n}`).join(', ')}">
    <defs><linearGradient id="trend-fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" style="stop-color: var(--accent); stop-opacity: .28"/><stop offset="1" style="stop-color: var(--accent); stop-opacity: 0"/></linearGradient></defs>
    <path d="${area}" fill="url(#trend-fill)"/>
    ${solid ? `<path class="series-line" d="${solid}"/>` : ''}
    <path class="series-line" d="M${px},${py}L${lx},${ly}" style="stroke-dasharray: 4 4"/>
    ${xy.map(([x, y], i) => i === xy.length - 1
      ? `<circle cx="${x}" cy="${y}" r="4.5" class="trend-now"/>`
      : `<circle cx="${x}" cy="${y}" r="3.5" class="series-dot"/>`).join('')}
    <g class="axis">${pts.map((p, i) => `<text x="${X(i)}" y="${H - 3}" text-anchor="${i === 0 ? 'start' : i === pts.length - 1 ? 'end' : 'middle'}">${mon(p.d)}</text>`).join('')}</g>
    <line class="crosshair" x1="0" x2="0" y1="${m.t}" y2="${m.t + ih}"/>
    <circle class="hover-dot" r="5" cx="0" cy="0"/>
    <rect x="0" y="0" width="${W}" height="${H}" fill="transparent"/>
  </svg><div class="chart-tip"></div>`;
  attachHover(el, W, pts.map((p, i) => ({
    x: xy[i][0], y: xy[i][1],
    tip: `<b>${p.n} ${p.n === 1 ? 'økt' : 'økter'}</b><br>${esc(p.d.toLocaleDateString('nb-NO', { month: 'long', year: 'numeric' }))}${p.partial ? ' (hittil)' : ''}`,
  })), true);
}

function renderHistory() {
  setHeader('Historikk');
  const all = sortedWorkouts();
  if (!all.length && !db.folders.length) {
    view().innerHTML = `<div class="empty"><p>Ingen økter ennå.</p></div><button class="btn primary block big" data-act="start-workout">+ Registrer økt</button>`;
    return;
  }
  const mode = histUI.mode === 'all' ? 'all' : 'folders';
  let html = `<div class="seg-toggle" role="group" aria-label="Visning" style="margin-top:4px">
      <button type="button" data-act="hist-mode" data-v="folders" aria-pressed="${mode === 'folders'}">Mapper</button>
      <button type="button" data-act="hist-mode" data-v="all" aria-pressed="${mode === 'all'}">Alle økter</button>
    </div>`;
  html += trendCard();

  if (mode === 'folders') {
    // Mapper står alfabetisk; øktene i hver mappe nyeste først
    html += `<button class="btn ghost block" style="margin-top:12px" data-act="new-folder" data-ctx="history">+ Ny mappe</button>`;
    html += '<div class="folder-list">';
    for (const f of sortedFolders()) {
      const list = all.filter((w) => w.folderId === f.id);
      const body = `<div class="row folder-actions">
          <button class="btn ghost sm" data-act="rename-folder" data-id="${esc(f.id)}">Gi nytt navn</button>
          <button class="btn ghost sm danger" data-act="delete-folder" data-id="${esc(f.id)}">Slett mappe</button>
        </div>
        ${list.length ? list.map((w) => workoutCard(w, { hideFolder: true })).join('') : '<p class="small muted" style="padding:6px 0 12px">Ingen økter i denne mappa ennå.</p>'}`;
      html += folder('wf-' + f.id, f.name, list.length, body, '📁');
    }
    const loose = all.filter((w) => !folderById(w.folderId));
    if (loose.length) html += folder('wf-none', 'Uten mappe', loose.length, loose.map((w) => workoutCard(w)).join(''), '🗂️');
    html += '</div>';
    view().innerHTML = html;
    drawTrendChart();
    return;
  }

  // Alle økter: kompakt søk, datofilter (sammenleggbart) og rekkefølge
  const dm = histUI.dateMode;
  const dateOn = (dm === 'day' && histUI.day) || (dm === 'range' && (histUI.from || histUI.to));
  html += `<div class="hist-tools">
      <label class="hist-search">
        <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><circle cx="11" cy="11" r="6.5" fill="none" stroke="currentColor" stroke-width="2"/><path d="M16 16l4 4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
        <input type="search" data-hist-q value="${esc(histUI.q)}" placeholder="Søk etter øvelse" autocomplete="off" aria-label="Søk etter øvelse">
      </label>
      <button type="button" class="tool-btn" data-act="hist-filter-toggle" aria-pressed="${!!(histUI.filterOpen || dateOn)}" aria-label="Datofilter" title="Datofilter">
        <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><rect x="4" y="5" width="16" height="15" rx="3" fill="none" stroke="currentColor" stroke-width="2"/><path d="M4 10h16M9 3v4M15 3v4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
        ${dateOn ? '<span class="tool-dot" aria-hidden="true"></span>' : ''}
      </button>
      <button type="button" class="tool-btn" data-act="hist-order" aria-label="${histUI.order === 'desc' ? 'Nyeste først – trykk for eldste først' : 'Eldste først – trykk for nyeste først'}" title="${histUI.order === 'desc' ? 'Nyeste først' : 'Eldste først'}">
        <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="${histUI.order === 'desc' ? 'M8 4v16M8 20l-3-3M8 20l3-3M14 6h6M14 11h4M14 16h2' : 'M8 20V4M8 4L5 7M8 4l3 3M14 6h2M14 11h4M14 16h6'}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
      </button>
    </div>`;
  if (histUI.filterOpen || dateOn) {
    html += `<div class="hist-dates">
      <div class="seg-toggle three mini3" role="group" aria-label="Dato">
        <button type="button" data-act="hist-date" data-v="all" aria-pressed="${dm === 'all'}">Alle</button>
        <button type="button" data-act="hist-date" data-v="day" aria-pressed="${dm === 'day'}">Dato</button>
        <button type="button" data-act="hist-date" data-v="range" aria-pressed="${dm === 'range'}">Periode</button>
      </div>
      ${dm === 'day' ? `<input type="date" data-hist-f="day" value="${esc(histUI.day)}" max="${todayISO()}" aria-label="Dato">` : ''}
      ${dm === 'range' ? `<div class="cardio-grid" style="margin-top:0">
          <label class="field">Fra<input type="date" data-hist-f="from" value="${esc(histUI.from)}" max="${todayISO()}"></label>
          <label class="field">Til<input type="date" data-hist-f="to" value="${esc(histUI.to)}" max="${todayISO()}"></label>
        </div>` : ''}
    </div>`;
  }
  html += `<div class="hist-meta small muted"><span data-hist-count></span><button type="button" class="link-btn" data-act="hist-reset" data-hist-reset hidden>Nullstill</button></div>
    <div id="hist-results"></div>`;
  view().innerHTML = html;
  drawTrendChart();
  renderHistoryResults();
}

// Tegner bare resultatlista, slik at søkefeltet beholder fokus mens man skriver
function renderHistoryResults() {
  const box = $('#hist-results');
  if (!box) return;
  const ws = filteredWorkouts();
  const filtering = histFilterActive();
  const count = $('[data-hist-count]');
  if (count) count.textContent = filtering ? `${ws.length} ${ws.length === 1 ? 'økt' : 'økter'} funnet` : `${ws.length} ${ws.length === 1 ? 'økt' : 'økter'}`;
  const reset = $('[data-hist-reset]');
  if (reset) reset.hidden = !filtering;
  if (!ws.length) { box.innerHTML = `<div class="empty"><p>Ingen økter passer søket.</p></div>`; return; }
  const hl = histUI.q.trim();
  let html = '', month = '';
  for (const w of ws) {
    const m = w.date.slice(0, 7);
    if (m !== month) {
      month = m;
      const n = ws.filter((x) => x.date.startsWith(m)).length;
      const label = dateObj(m + '-01').toLocaleDateString('nb-NO', { month: 'long', year: 'numeric' });
      html += `<h2 class="section-title">${esc(label)} · ${n} ${n === 1 ? 'økt' : 'økter'}</h2>`;
    }
    html += workoutCard(w, { highlight: hl });
  }
  box.innerHTML = html;
}

function openFolderForm(ctx, existing) {
  openSheet(`<h2>${existing ? 'Gi mappa nytt navn' : 'Ny mappe'}</h2>
    <form class="stack" data-form="folder" data-ctx="${esc(ctx)}" data-id="${esc(existing?.id || '')}">
      <label class="field">Navn<input name="name" required maxlength="40" value="${esc(existing?.name || '')}" placeholder="f.eks. Beindag, Overkropp, Intervaller" autocomplete="off"></label>
      <button class="btn primary block big" type="submit">${existing ? 'Lagre' : 'Lag mappe'}</button>
    </form>`);
  setTimeout(() => $('#sheet-root input[name="name"]')?.focus(), 50);
}
function saveFolderForm(form, name, id) {
  if (db.folders.some((f) => f.name.toLowerCase() === name.toLowerCase() && f.id !== id)) {
    toast('Du har allerede en mappe med det navnet');
    return;
  }
  if (id) {
    folderById(id).name = name;
    save();
    closeSheet();
    route();
    return;
  }
  const f = { id: 'f-' + uid(), name, createdAt: Date.now() };
  db.folders.push(f);
  const ctx = form.dataset.ctx || '';
  if (ctx === 'draft' && db.draft) db.draft.folderId = f.id;
  if (ctx.startsWith('move:')) {
    const w = db.workouts.find((x) => x.id === ctx.slice(5));
    if (w) w.folderId = f.id;
  }
  save();
  closeSheet();
  if (ctx === 'draft') {
    const chips = document.querySelector('[data-folder-chips]');
    if (chips) chips.innerHTML = draftFolderChips(db.draft);
  } else {
    route();
  }
  toast(ctx.startsWith('move:') ? `Flyttet til «${name}»` : `Mappa «${name}» er laget`);
}
function openMoveSheet(workoutId) {
  const w = db.workouts.find((x) => x.id === workoutId);
  if (!w) return;
  openSheet(`<h2>Flytt til mappe</h2><div class="menu-list">
    <button data-act="move-to-folder" data-id="${esc(w.id)}" data-v="">${!folderById(w.folderId) ? '✓ ' : ''}Ingen mappe</button>
    ${sortedFolders().map((f) => `<button data-act="move-to-folder" data-id="${esc(w.id)}" data-v="${esc(f.id)}">${w.folderId === f.id ? '✓ ' : ''}📁 ${esc(f.name)}</button>`).join('')}
    <button data-act="new-folder" data-ctx="move:${esc(w.id)}">+ Ny mappe</button>
  </div>`);
}

/* =========================================================
   Statistikk
   ========================================================= */
const statsUI = { metric: {}, purpose: {}, weight: {}, period: 'month', dist: 'strength' };

/* =========================================================
   Statistikk – oversikt i kategorier
   ========================================================= */
const STATS_PERIODS = [
  { k: 'week', l: 'Siste uka', short: 'Uke', days: 7, prev: 'forrige uke' },
  { k: 'month', l: 'Siste måned', short: 'Måned', days: 30, prev: 'forrige måned' },
  { k: 'year', l: 'Siste år', short: 'År', days: 365, prev: 'forrige år' },
  { k: 'all', l: 'Siden start', short: 'Siden start', days: null },
];
// Rullerende periode som slutter i dag, og like lang periode rett før (til sammenligning)
function periodRange(k) {
  const p = STATS_PERIODS.find((x) => x.k === k) || STATS_PERIODS[1];
  if (!p.days) return { p, from: '', to: todayISO(), prevFrom: null, prevTo: null };
  const day = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return isoDay(d); };
  return { p, from: day(p.days - 1), to: todayISO(), prevFrom: day(2 * p.days - 1), prevTo: day(p.days) };
}
const workoutsBetween = (from, to) => db.workouts.filter((w) => (!from || w.date >= from) && w.date <= to);

// Alle rekorder, i den rekkefølgen de ble satt. En øvelse i en økt teller én gang,
// og bare når en tidligere beste verdi slås (første gang teller ikke).
function recordEvents() {
  const best = {}, events = [];
  const keysFor = (ex, en) => {
    if (ex.kind === 'cardio') {
      const cfg = exCfg(ex);
      return [cfg.distance && 'distanceKm', cfg.speed !== 'none' && 'speed'].filter(Boolean);
    }
    if (en.mode === 'max') return ['tested'];
    return { time: ['maxSec'], distance: ['carryWeight', 'maxMeters'] }[exMeasure(ex)] || ['repWeight'];
  };
  const ordered = [...db.workouts].sort((a, b) => a.date.localeCompare(b.date) || (a.createdAt || 0) - (b.createdAt || 0));
  for (const w of ordered) {
    for (const en of w.entries) {
      const ex = exById(en.exerciseId);
      const st = entryStats(en);
      if (!st) continue;
      let beat = false;
      for (const k of keysFor(ex, en)) {
        const v = st[k];
        if (v == null) continue;
        const id = `${ex.id}|${k}`;
        if (best[id] != null && v > best[id]) beat = true;
        if (best[id] == null || v > best[id]) best[id] = v;
      }
      if (beat) events.push({ date: w.date, exId: ex.id });
    }
  }
  return events;
}

/* ---------- Muskelgrupper ---------- */
const MUSCLES = [
  ['chest', 'Bryst'], ['shoulders', 'Skuldre'], ['biceps', 'Biceps'], ['triceps', 'Triceps'], ['forearms', 'Underarmer'],
  ['abs', 'Mage'], ['upperback', 'Øvre rygg'], ['lats', 'Latissimus'], ['lowerback', 'Nedre rygg'],
  ['glutes', 'Sete'], ['quads', 'Forside lår'], ['hamstrings', 'Bakside lår'], ['calves', 'Legger'],
];
const muscleName = (id) => (MUSCLES.find(([k]) => k === id) || [id, id])[1];
// Hvilke muskler hver standardøvelse trener: 1 = hovedmuskel, 0.5 = hjelpemuskel
const EX_MUSCLES = {
  'knebøy': { quads: 1, glutes: 1, hamstrings: 0.5, lowerback: 0.5 },
  beinpress: { quads: 1, glutes: 0.5 },
  utfall: { quads: 1, glutes: 1, hamstrings: 0.5 },
  bulgarsk: { quads: 1, glutes: 1 },
  'marklöft': { hamstrings: 1, glutes: 1, lowerback: 1, upperback: 0.5, forearms: 0.5 },
  rumensk: { hamstrings: 1, glutes: 1, lowerback: 0.5 },
  legext: { quads: 1 },
  legcurl: { hamstrings: 1 },
  tahev: { calves: 1 },
  benkpress: { chest: 1, triceps: 0.5, shoulders: 0.5 },
  skrabenk: { chest: 1, shoulders: 0.5, triceps: 0.5 },
  brystpress: { chest: 1, triceps: 0.5 },
  'hantelpress-bryst': { chest: 1, triceps: 0.5, shoulders: 0.5 },
  flyes: { chest: 1 },
  cablecross: { chest: 1 },
  pushups: { chest: 1, triceps: 0.5, shoulders: 0.5 },
  nedtrekk: { lats: 1, biceps: 0.5 },
  pullups: { lats: 1, biceps: 0.5, upperback: 0.5 },
  roing: { upperback: 1, lats: 1, biceps: 0.5 },
  stangroing: { upperback: 1, lats: 1, lowerback: 0.5, biceps: 0.5 },
  hantelroing: { lats: 1, upperback: 0.5, biceps: 0.5 },
  facepull: { shoulders: 1, upperback: 1 },
  skulderpress: { shoulders: 1, triceps: 0.5 },
  'hantelpress-skulder': { shoulders: 1, triceps: 0.5 },
  sidehev: { shoulders: 1 },
  fronthev: { shoulders: 1 },
  omvendtflyes: { shoulders: 1, upperback: 0.5 },
  biceps: { biceps: 1, forearms: 0.5 },
  hammer: { biceps: 1, forearms: 1 },
  preacher: { biceps: 1 },
  triceps: { triceps: 1 },
  franskpress: { triceps: 1 },
  dips: { triceps: 1, chest: 0.5, shoulders: 0.5 },
  overheadtri: { triceps: 1 },
  situps: { abs: 1 },
  crunches: { abs: 1 },
  cablecrunch: { abs: 1 },
  beinloft: { abs: 1 },
  kneeraises: { abs: 1 },
  planke: { abs: 1, lowerback: 0.5 },
  russian: { abs: 1 },
  abwheel: { abs: 1, lats: 0.5 },
  magemaskin: { abs: 1 },
  farmers: { forearms: 1, upperback: 1, glutes: 0.5, quads: 0.5, abs: 0.5 },
  sledpush: { quads: 1, glutes: 1, calves: 0.5 },
  sledpull: { hamstrings: 1, glutes: 1, upperback: 0.5 },
};
// Egne øvelser: muskler ut fra mappen de ligger i
const CAT_MUSCLES = {
  Bein: { quads: 1, glutes: 0.5, hamstrings: 0.5 },
  Bryst: { chest: 1, triceps: 0.5 },
  Rygg: { lats: 1, upperback: 0.5 },
  Skuldre: { shoulders: 1 },
  Armer: { biceps: 0.5, triceps: 0.5, forearms: 0.5 },
  Mage: { abs: 1 },
  'Funksjonell styrketrening': { quads: 0.5, glutes: 0.5, upperback: 0.5, abs: 0.5 },
};
const musclesFor = (ex) => EX_MUSCLES[ex.id] || CAT_MUSCLES[ex.cat] || {};

// Arbeidssett i en styrkeøvelse: fullførte sett (reps, tid eller lengde) eller forsøk i 1RM-test
function workSets(en) {
  if (en.mode === 'max') return (en.attempts || []).filter((a) => a.weight > 0).length;
  return (en.sets || []).filter(setDone).length;
}

// Treningsfordeling og muskelbelastning for en mengde økter
function distribution(ws) {
  const cats = {}, purposes = {}, muscles = {};
  for (const w of ws) {
    for (const en of w.entries) {
      const ex = exById(en.exerciseId);
      if (ex.kind === 'cardio') {
        const p = en.purpose || 'endurance';
        purposes[p] ||= { n: 0, sec: 0 };
        purposes[p].n++;
        purposes[p].sec += cardioStats(en)?.timeSec || 0;
        continue;
      }
      const sets = workSets(en);
      if (!sets) continue;
      const c = ex.cat || 'Annet';
      cats[c] ||= { sets: 0, ex: 0 };
      cats[c].sets += sets;
      cats[c].ex++;
      for (const [m, f] of Object.entries(musclesFor(ex))) muscles[m] = (muscles[m] || 0) + sets * f;
    }
  }
  return { cats, purposes, muscles };
}

function fmtMinutes(min) {
  if (!min) return '0 min';
  const h = Math.floor(min / 60), m = Math.round(min % 60);
  return h ? `${h} t${m ? ` ${m} min` : ''}` : `${m} min`;
}
// Endring mot forrige like periode, med pil og fortegn (aldri bare farge)
function deltaHtml(cur, prev, prevLabel, fmt = (v) => v) {
  if (prev == null) return '';
  const d = cur - prev;
  if (!d) return `<span class="delta flat">→ Likt som ${prevLabel}</span>`;
  const pct = prev ? ` (${d > 0 ? '+' : '−'}${Math.round((Math.abs(d) / prev) * 100)} %)` : '';
  return `<span class="delta ${d > 0 ? 'up' : 'down'}">${d > 0 ? '↑' : '↓'} ${d > 0 ? '+' : '−'}${fmt(Math.abs(d))}${pct} fra ${prevLabel}</span>`;
}

// Liggende stolper med verdien skrevet ut (én serie – ingen forklaring nødvendig)
function hbars(rows) {
  const max = Math.max(1, ...rows.map((r) => r.v));
  return `<div class="hbars">${rows.map((r) => `<div class="hbar-row">
      <span class="hbar-label">${esc(r.label)}</span>
      <span class="hbar-track"><span class="hbar-fill" style="width:${(r.v / max) * 100}%"></span></span>
      <span class="hbar-value">${esc(r.text)}</span>
    </div>`).join('')}</div>`;
}

function renderStatsOverview(used) {
  setHeader('Statistikk');
  if (!db.workouts.length) { view().innerHTML = `<div class="empty"><p>Ingen data ennå.</p></div>`; return; }
  const period = statsUI.period || 'month';
  const { p, from, to, prevFrom, prevTo } = periodRange(period);
  const cur = workoutsBetween(from, to);
  const prev = prevFrom ? workoutsBetween(prevFrom, prevTo) : null;
  const recs = recordEvents();
  const recIn = (a, b) => recs.filter((r) => (!a || r.date >= a) && r.date <= b).length;
  const mins = (ws) => ws.reduce((s, w) => s + (w.durationMin || 0), 0);

  let html = `<div class="seg-toggle four period-seg" role="group" aria-label="Periode">
    ${STATS_PERIODS.map((x) => `<button type="button" data-act="stats-period" data-v="${x.k}" aria-pressed="${x.k === period}">${x.short}</button>`).join('')}
  </div>`;

  // 1. Personlig prestasjon – nøkkeltall med endring mot forrige like periode
  const kpi = (label, value, delta) => `<div class="kpi-row"><div><div class="kpi-label">${label}</div>${delta}</div><div class="kpi-value">${value}</div></div>`;
  html += `<h2 class="section-title">Personlig prestasjon</h2>
  <section class="card kpi-card">
    ${kpi('Fullførte økter', cur.length, prev ? deltaHtml(cur.length, prev.length, p.prev) : '')}
    ${kpi('Treningstid', fmtMinutes(mins(cur)), prev ? deltaHtml(mins(cur), mins(prev), p.prev, fmtMinutes) : '')}
    ${kpi('Nye rekorder', recIn(from, to), prev ? deltaHtml(recIn(from, to), recIn(prevFrom, prevTo), p.prev) : '')}
  </section>
  <section class="card"><div class="chart-title">Økter per uke</div><div class="chart-sub">Siste 12 uker</div><div class="chart-wrap" id="week-chart"></div></section>`;
  // 2. Treningsfordeling
  const dist = distribution(cur);
  const mode = statsUI.dist === 'cardio' ? 'cardio' : 'strength';
  html += `<h2 class="section-title">Treningsfordeling</h2>
  <section class="card">
    <div class="seg-toggle" role="group" aria-label="Type trening" style="margin-top:0">
      <button type="button" data-act="stats-dist" data-v="strength" aria-pressed="${mode === 'strength'}">Styrke</button>
      <button type="button" data-act="stats-dist" data-v="cardio" aria-pressed="${mode === 'cardio'}">Kondisjon</button>
    </div>`;
  if (mode === 'strength') {
    const rows = CATEGORIES.filter((c) => c !== 'Kondisjon' && dist.cats[c])
      .map((c) => ({ label: c, v: dist.cats[c].sets, text: `${dist.cats[c].sets} sett · ${dist.cats[c].ex} øv.` }))
      .sort((a, b) => b.v - a.v);
    html += rows.length
      ? `<p class="chart-sub" style="margin:12px 0 2px">Arbeidssett og øvelser per muskelgruppe</p>${hbars(rows)}`
      : `<p class="small muted" style="margin-top:12px">Ingen styrkeøkter i perioden.</p>`;
  } else {
    const rows = PURPOSES.filter((x) => dist.purposes[x.k]).map((x) => {
      const d = dist.purposes[x.k];
      return { label: x.l, v: d.n, text: `${d.n} økt${d.n === 1 ? '' : 'er'}${d.sec ? ` · ${fmtMinutes(d.sec / 60)}` : ''}` };
    }).sort((a, b) => b.v - a.v);
    html += rows.length
      ? `<p class="chart-sub" style="margin:12px 0 2px">Antall økter og tid per type økt</p>${hbars(rows)}`
      : `<p class="small muted" style="margin-top:12px">Ingen kondisjonsøkter i perioden.</p>`;
  }
  html += `</section>`;

  // 3. Muskelgruppeanalyse
  const hasMuscles = Object.keys(dist.muscles).length > 0;
  html += `<h2 class="section-title">Muskelgruppeanalyse</h2>
  <section class="card muscle-card">
    ${bodyFigure(dist.muscles)}
    <div class="muscle-legend"><span>Mindre trent</span><span class="muscle-scale"></span><span>Mer trent</span></div>
    <p class="muscle-info" data-muscle-info>${hasMuscles ? 'Trykk på en muskel for å se antall sett.' : 'Ingen styrketrening i perioden.'}</p>
    <details class="table-toggle"><summary>Vis som tabell</summary>
      <table class="data"><thead><tr><th>Muskelgruppe</th><th class="num">Arbeidssett</th></tr></thead><tbody>
      ${MUSCLES.map(([k, n]) => ({ n, v: dist.muscles[k] || 0 })).sort((a, b) => b.v - a.v).map((r) => `<tr><td>${esc(r.n)}</td><td class="num">${fmtNum(r.v, 1)}</td></tr>`).join('')}
      </tbody></table></details>
  </section>`;

  // Fremgang per øvelse
  html += `<h2 class="section-title">Fremgang per øvelse</h2><section class="card" style="padding:4px 14px">`;
  const exs = [...used.keys()].map(exById).sort((a, b) => used.get(b.id) - used.get(a.id));
  html += exs.map((e) => {
    const hist = historyFor(e.id);
    const last = hist[hist.length - 1];
    return `<a class="ex-option" style="text-decoration:none;color:inherit" href="#/statistikk/${encodeURIComponent(e.id)}">
      <span>${esc(e.name)}<br><span class="small muted">${last ? esc(entrySummary(last.en)) : ''}</span></span>
      <span class="kind">${used.get(e.id)}×</span></a>`;
  }).join('');
  html += `</section>`;

  view().innerHTML = html;
  drawWeekChart($('#week-chart'));
}

/* ---------- Kroppsfigur forfra og bakfra ----------
   Hver muskel er en egen form med data-muscle. Fargen går fra lys (lite trent)
   til kraftig aksentfarge (mye trent), relativt til den mest trente muskelen. */
function bodyFigure(load) {
  const max = Math.max(0, ...Object.values(load));
  const fill = (m) => {
    const v = load[m] || 0;
    if (!v || !max) return '';
    const t = v / max;
    return ` style="fill: color-mix(in oklab, var(--accent) ${Math.round(22 + 78 * t)}%, white)"`;
  };
  const mus = (m, d) => `<path class="mus${load[m] ? ' on' : ''}" data-act="muscle" data-muscle="${m}" d="${d}"${fill(m)}/>`;
  // Speiler en form om midtlinja x = 60
  const mirror = (d) => d.replace(/(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/g, (_, x, y) => `${120 - x},${y}`);
  const pair = (m, d) => mus(m, d) + mus(m, mirror(d));
  const base = (d) => `<path class="body-base" d="${d}"/>`;
  const head = `<circle class="body-base" cx="60" cy="17" r="11"/>` + base('M54,27 L66,27 L67,35 L53,35 Z');
  // Hel silhuett (venstre halvdel + speilet høyre) under musklene, så mellomrommene får kroppens farge
  const SIL = 'M60,27 L54,27 L53,35 Q40,36 31,42 Q25,48 26,60 L24,84 Q21,96 22,106 Q22,116 27,117 Q32,116 32,108 L34,88 Q37,76 40,66 L43,60 Q44,80 45,100 Q42,108 43,116 L41,150 Q40,166 45,176 L44,200 Q44,214 45,224 Q43,230 51,231 Q57,231 56,224 L57,200 Q58,186 57,176 Q60,150 59,118 L60,114 Z';
  const silhouette = `<g class="body-sil">${base(SIL)}${base(mirror(SIL))}</g>`;
  const limbsBase = silhouette + base('M24,106 Q22,112 26,116 Q31,117 33,111 L32,104 Z') + base(mirror('M24,106 Q22,112 26,116 Q31,117 33,111 L32,104 Z'))
    + base('M45,224 Q43,230 51,231 Q57,231 56,224 Z') + base(mirror('M45,224 Q43,230 51,231 Q57,231 56,224 Z'));

  const front = head + limbsBase
    + pair('shoulders', 'M44,38 Q34,38 30,46 Q29,54 33,58 L42,52 Q46,45 50,41 Z')
    + pair('chest', 'M59,40 L50,41 Q44,46 43,54 Q45,62 52,64 Q57,64 59,61 Z')
    + pair('biceps', 'M31,59 Q27,66 28,76 Q31,82 35,80 Q38,72 40,63 L33,58 Z')
    + pair('forearms', 'M28,80 Q24,90 24,104 L32,105 Q36,94 36,82 Z')
    + mus('abs', 'M52,66 Q60,68 68,66 L69,98 Q60,106 51,98 Z')
    + pair('abs', 'M44,60 Q42,80 46,100 L50,98 L51,66 Z')
    + base('M46,100 Q60,112 74,100 L76,112 Q60,120 44,112 Z')
    + pair('quads', 'M44,113 Q39,140 45,168 Q51,173 57,168 Q60,142 58,118 Z')
    + base('M46,170 Q51,177 56,170 L56,176 Q51,180 46,176 Z') + base(mirror('M46,170 Q51,177 56,170 L56,176 Q51,180 46,176 Z'))
    + pair('calves', 'M46,179 Q44,200 47,222 L54,222 Q57,200 56,179 Z');

  const back = head + limbsBase
    + mus('upperback', 'M60,30 L48,38 Q46,44 50,48 L60,66 L70,48 Q74,44 72,38 Z')
    + pair('shoulders', 'M44,38 Q34,38 30,46 Q29,54 33,58 L42,52 Q45,45 48,40 Z')
    + pair('lats', 'M49,50 Q42,62 45,86 Q50,92 57,88 L59,68 Z')
    + mus('lowerback', 'M51,88 Q60,92 69,88 L70,102 Q60,106 50,102 Z')
    + pair('triceps', 'M31,59 Q27,66 28,76 Q31,82 35,80 Q38,72 40,63 L33,58 Z')
    + pair('forearms', 'M28,80 Q24,90 24,104 L32,105 Q36,94 36,82 Z')
    + pair('glutes', 'M45,103 Q42,116 47,124 Q54,127 59,121 L59,105 Q52,107 45,103 Z')
    + pair('hamstrings', 'M45,126 Q41,148 46,168 Q51,172 57,168 Q59,146 58,126 Q52,129 45,126 Z')
    + base('M46,170 Q51,177 56,170 L56,176 Q51,180 46,176 Z') + base(mirror('M46,170 Q51,177 56,170 L56,176 Q51,180 46,176 Z'))
    + pair('calves', 'M45,179 Q42,196 46,212 Q51,218 55,212 Q58,196 56,179 Z')
    + base('M47,213 L55,213 L55,222 L47,222 Z') + base(mirror('M47,213 L55,213 L55,222 L47,222 Z'));

  return `<div class="body-fig" role="img" aria-label="Muskelgrupper forfra og bakfra, farget etter hvor mye de er trent">
    <figure><svg viewBox="16 0 88 236">${front}</svg><figcaption>Forfra</figcaption></figure>
    <figure><svg viewBox="16 0 88 236">${back}</svg><figcaption>Bakfra</figcaption></figure>
  </div>`;
}

function renderStats(exId) {
  const used = new Map();
  for (const w of db.workouts) for (const e of w.entries) used.set(e.exerciseId, (used.get(e.exerciseId) || 0) + 1);

  if (!exId) { renderStatsOverview(used); return; }

  const ex = exById(exId);
  setHeader(ex.name, '#/statistikk');
  const allHist = historyFor(exId);
  if (!allHist.length) { view().innerHTML = `<div class="empty"><p>Ingen data for denne øvelsen ennå.</p></div>`; return; }

  // Kondisjon: sammenlign økter av samme type (utholdenhet, intervall …)
  let filterHtml = '';
  let hist = allHist;
  if (ex.kind === 'cardio') {
    const used = PURPOSES.filter((p) => allHist.some((h) => h.en.purpose === p.k));
    let pf = statsUI.purpose[exId] || 'all';
    if (pf !== 'all' && !used.some((p) => p.k === pf)) pf = 'all';
    if (used.length) {
      filterHtml = `<p class="chip-label">Type økt</p><div class="chips" role="group" aria-label="Type økt">
        <button class="chip" data-act="purpose-filter" data-ex="${esc(exId)}" data-v="all" aria-pressed="${pf === 'all'}">Alle økter</button>
        ${used.map((p) => `<button class="chip" data-act="purpose-filter" data-ex="${esc(exId)}" data-v="${p.k}" aria-pressed="${pf === p.k}">${p.l}</button>`).join('')}
      </div>`;
    }
    if (pf !== 'all') hist = allHist.filter((h) => h.en.purpose === pf);
  }
  const purposeFilter = ex.kind === 'cardio' ? statsUI.purpose[exId] || 'all' : null;

  // Styrke: reps per vekt – flest reps i ett sett med valgt vekt, per økt
  let weights = [], selWeight = null;
  if (ex.kind === 'strength' && exMeasure(ex) === 'reps') {
    const counts = new Map();
    for (const h of hist) {
      if ((h.en.mode || 'reps') !== 'reps') continue;
      for (const s of h.en.sets || []) if (s.reps > 0) counts.set(s.weight || 0, (counts.get(s.weight || 0) || 0) + 1);
    }
    weights = [...counts.keys()].sort((a, b) => a - b);
    if (weights.length) {
      selWeight = counts.has(statsUI.weight[exId]) ? statsUI.weight[exId]
        : [...counts.entries()].sort((a, b) => b[1] - a[1] || b[0] - a[0])[0][0]; // mest brukte vekt
      hist = hist.map((h) => {
        if ((h.en.mode || 'reps') !== 'reps') return h;
        const reps = (h.en.sets || []).filter((s) => s.reps > 0 && (s.weight || 0) === selWeight).map((s) => s.reps);
        return reps.length ? { ...h, st: { ...h.st, repsAt: Math.max(...reps) } } : h;
      });
    }
  }
  const weightLabel = (w) => (w ? `${fmtNum(w, 2)} kg` : 'Kroppsvekt');

  let metrics = (ex.kind === 'cardio' ? cardioMetrics(ex) : METRICS.strength).filter((m) => hist.some((h) => h.st[m.k] != null));
  // Utholdenhet og rolig: kun distanse og snittfart (eller snittempo) per økt
  if (purposeFilter === 'endurance' || purposeFilter === 'easy') metrics = metrics.filter((m) => ['distanceKm', 'speed', 'paceKm', 'pace500'].includes(m.k));
  if (!metrics.length) { view().innerHTML = filterHtml + `<div class="empty"><p>Ingen data å vise for dette utvalget.</p></div>`; return; }
  let mk = statsUI.metric[exId];
  if (!metrics.some((m) => m.k === mk)) mk = metrics[0]?.k;
  let metric = metrics.find((m) => m.k === mk);
  if (mk === 'repsAt') metric = { ...metric, hint: `Flest reps i ett sett med ${weightLabel(selWeight).toLowerCase()}` };

  let html = filterHtml + `<p class="chip-label">Vis</p><div class="chips" role="group" aria-label="Måltall">
    ${metrics.map((m) => `<button class="chip metric-chip" data-act="metric" data-ex="${esc(exId)}" data-k="${m.k}" aria-pressed="${m.k === mk}">${m.label}</button>`).join('')}
  </div>`;
  if (mk === 'repsAt') {
    html += `<p class="chip-label">Vekt</p><div class="chips" role="group" aria-label="Vekt">
      ${weights.map((w) => `<button class="chip" data-act="stats-weight" data-ex="${esc(exId)}" data-v="${w}" aria-pressed="${w === selWeight}">${weightLabel(w)}</button>`).join('')}
    </div>`;
  }

  const pts = hist.filter((h) => h.st[mk] != null);
  const first = pts[0], lastP = pts[pts.length - 1];
  const best = bestOf(pts, mk, metric.lower);
  const fm = (v) => fmtMetric(metric, v);
  const change = pts.length > 1 ? lastP.st[mk] - first.st[mk] : null;
  const pct = change != null && first.st[mk] ? (change / first.st[mk]) * 100 : null;

  html += `<section class="card">
    <div class="chart-title">${metric.label} (${metric.unit})</div>
    <div class="chart-sub">${metric.hint ? esc(metric.hint) + ' · ' : ''}${pts.length} ${pts.length === 1 ? 'registrering' : 'registreringer'}</div>
    <div class="chart-wrap" id="ex-chart"></div>
  </section>
  <div class="pr-tiles">
    <div class="tile"><div class="l">Beste</div><div class="v">${fm(best.v)} <span class="small muted">${metric.unit}</span></div><div class="l">${esc(fmtDate(best.h.w.date, { day: 'numeric', month: 'short', year: 'numeric' }))}</div></div>
    <div class="tile"><div class="l">Siste</div><div class="v">${fm(lastP.st[mk])} <span class="small muted">${metric.unit}</span></div><div class="l">${esc(fmtDate(lastP.w.date, { day: 'numeric', month: 'short', year: 'numeric' }))}</div></div>
    <div class="tile"><div class="l">Endring siden start</div><div class="v">${change == null ? '–' : (change > 0 ? '+' : change < 0 ? '−' : '') + fm(Math.abs(change))}</div><div class="l">${pct != null ? (pct > 0 ? '+' : '') + fmtNum(pct, 0) + ' %' : 'Trenger flere økter'}</div></div>
    <div class="tile"><div class="l">Antall økter</div><div class="v">${hist.length}</div><div class="l">Første: ${esc(fmtDate(hist[0].w.date, { day: 'numeric', month: 'short', year: 'numeric' }))}</div></div>
  </div>`;

  html += `<h2 class="section-title">Alle registreringer</h2><section class="card"><table class="data"><thead><tr><th>Dato</th><th>Detaljer</th><th class="num">${esc(metric.label)}</th></tr></thead><tbody>
    ${[...hist].reverse().map((h) => `<tr>
      <td><a href="#/okt/${encodeURIComponent(h.w.id)}" style="color:inherit">${esc(fmtDate(h.w.date, { day: 'numeric', month: 'short' }))}</a><div class="sub">${h.w.date.slice(0, 4)}</div></td>
      <td>${esc(entrySummary(h.en))}${h.en.note ? `<div class="sub">📝 ${esc(h.en.note)}</div>` : ''}</td>
      <td class="num">${h.st[mk] != null ? fm(h.st[mk]) : '–'}${best && h === best.h ? ' <span class="pr-tag">PR</span>' : ''}</td></tr>`).join('')}
  </tbody></table></section>`;

  view().innerHTML = html;
  drawLineChart($('#ex-chart'), pts.map((h) => ({
    t: dateObj(h.w.date).getTime(),
    y: h.st[mk] * (metric.scale || 1),
    pr: h === best.h,
    tip: `<b>${fm(h.st[mk])} ${metric.unit}</b><br>${esc(fmtDate(h.w.date, { day: 'numeric', month: 'short', year: 'numeric' }))}<br>${esc(entrySummary(h.en))}`,
  })), metric);
}

/* ---------- Diagrammer (ren SVG, fungerer offline) ---------- */
function niceTicks(min, max, count = 4) {
  if (min === max) { min -= Math.abs(min) * 0.1 || 1; max += Math.abs(max) * 0.1 || 1; }
  const step0 = (max - min) / count;
  const mag = 10 ** Math.floor(Math.log10(step0));
  const n = step0 / mag;
  const step = (n < 1.5 ? 1 : n < 3 ? 2 : n < 7 ? 5 : 10) * mag;
  const lo = Math.floor(min / step) * step, hi = Math.ceil(max / step) * step;
  const ticks = [];
  for (let v = lo; v <= hi + step / 2; v += step) ticks.push(+v.toFixed(10));
  return ticks;
}

function drawLineChart(el, pts, metric) {
  if (!el) return;
  const W = Math.max(280, el.clientWidth), H = 220, m = { t: 14, r: 14, b: 26, l: 40 };
  const iw = W - m.l - m.r, ih = H - m.t - m.b;
  let t0 = Math.min(...pts.map((p) => p.t)), t1 = Math.max(...pts.map((p) => p.t));
  if (t0 === t1) { t0 -= 7 * 864e5; t1 += 7 * 864e5; }
  const ys = pts.map((p) => p.y);
  const ticks = niceTicks(Math.min(...ys), Math.max(...ys));
  const y0 = ticks[0], y1 = ticks[ticks.length - 1];
  const X = (t) => m.l + ((t - t0) / (t1 - t0)) * iw;
  // Måltall der lavere er bedre (f.eks. min/500 m) tegnes med beste verdi øverst
  const Y = (v) => (metric.lower ? m.t + ((v - y0) / (y1 - y0 || 1)) * ih : m.t + ih - ((v - y0) / (y1 - y0 || 1)) * ih);

  const xt = [t0, (t0 + t1) / 2, t1];
  const dateLbl = (t) => new Date(t).toLocaleDateString('nb-NO', { day: 'numeric', month: 'short' });
  const path = pts.map((p, i) => `${i ? 'L' : 'M'}${X(p.t).toFixed(1)},${Y(p.y).toFixed(1)}`).join('');

  el.innerHTML = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(metric.label)} over tid">
    <g class="grid">${ticks.map((v) => `<line x1="${m.l}" x2="${W - m.r}" y1="${Y(v)}" y2="${Y(v)}"/>`).join('')}</g>
    <g class="axis">${ticks.map((v) => `<text x="${m.l - 8}" y="${Y(v) + 4}" text-anchor="end">${metric.fmt ? metric.fmt(v) : fmtNum(v, 1)}</text>`).join('')}
      ${xt.map((t, i) => `<text x="${X(t)}" y="${H - 6}" text-anchor="${['start', 'middle', 'end'][i]}">${dateLbl(t)}</text>`).join('')}</g>
    <line class="crosshair" x1="0" x2="0" y1="${m.t}" y2="${m.t + ih}"/>
    ${pts.length > 1 ? `<path class="series-line" d="${path}"/>` : ''}
    ${pts.map((p) => `<circle class="series-dot${p.pr ? ' pr' : ''}" cx="${X(p.t)}" cy="${Y(p.y)}" r="${p.pr ? 5 : 4}"/>`).join('')}
    <circle class="hover-dot" r="6" cx="0" cy="0"/>
    <rect x="${m.l - 10}" y="0" width="${iw + 20}" height="${H}" fill="transparent" class="hit"/>
  </svg><div class="chart-tip"></div>`;
  attachHover(el, W, pts.map((p) => ({ x: X(p.t), y: Y(p.y), tip: p.tip })), true);
}

// En økt regnes som styrke eller kondisjon etter hva flest av øvelsene er (likt = styrke)
function workoutKind(w) {
  const cardio = w.entries.filter((e) => exById(e.exerciseId).kind === 'cardio').length;
  return cardio > w.entries.length - cardio ? 'cardio' : 'strength';
}

// Økter per uke, stablet: styrke (nederst) og kondisjon (øverst) i samme søyle
function drawWeekChart(el) {
  if (!el) return;
  const weeks = [];
  const cur = weekStart(new Date());
  for (let i = 11; i >= 0; i--) {
    const s = new Date(cur); s.setDate(s.getDate() - i * 7);
    const e = new Date(s); e.setDate(e.getDate() + 7);
    const ws = db.workouts.filter((w) => w.date >= isoDay(s) && w.date < isoDay(e));
    const strength = ws.filter((w) => workoutKind(w) === 'strength').length;
    weeks.push({ s, n: ws.length, strength, cardio: ws.length - strength, mins: ws.reduce((a, w) => a + (w.durationMin || 0), 0) });
  }
  const totS = weeks.reduce((a, w) => a + w.strength, 0), totC = weeks.reduce((a, w) => a + w.cardio, 0);

  const W = Math.max(280, el.clientWidth), H = 170, m = { t: 12, r: 6, b: 24, l: 26 };
  const iw = W - m.l - m.r, ih = H - m.t - m.b;
  const maxN = Math.max(3, ...weeks.map((w) => w.n));
  const ticks = niceTicks(0, maxN, 3).filter((v) => Number.isInteger(v));
  const top = ticks[ticks.length - 1];
  const slot = iw / weeks.length, bw = Math.max(6, slot - 4);
  const Y = (v) => m.t + ih - (v / top) * ih;
  const GAP = 2; // flate mellom segmentene i samme søyle

  // Rektangel med avrundede hjørner kun øverst (den øverste delen av søylen)
  const seg = (cls, x, y, w, h, rounded) => {
    if (h <= 0) return '';
    if (!rounded) return `<rect class="${cls}" x="${x}" y="${y}" width="${w}" height="${h}"/>`;
    const r = Math.min(4, w / 2, h);
    return `<path class="${cls}" d="M${x},${y + h}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h}Z"/>`;
  };
  const bars = weeks.map((w, i) => {
    const x = m.l + i * slot + (slot - bw) / 2;
    const yS = Y(w.strength), hS = m.t + ih - yS;
    const yT = Y(w.n), hC = yS - yT - (w.strength && w.cardio ? GAP : 0);
    return seg('bar-strength', x, yS, bw, hS, !w.cardio) + seg('bar-cardio', x, yT, bw, hC, true);
  }).join('');

  el.innerHTML = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Antall styrke- og kondisjonsøkter per uke siste 12 uker">
    <g class="grid">${ticks.map((v) => `<line x1="${m.l}" x2="${W - m.r}" y1="${Y(v)}" y2="${Y(v)}"/>`).join('')}</g>
    <g class="axis">${ticks.map((v) => `<text x="${m.l - 6}" y="${Y(v) + 4}" text-anchor="end">${v}</text>`).join('')}
      ${weeks.map((w, i) => (i % 2 === 1 || weeks.length < 8) ? `<text x="${m.l + i * slot + slot / 2}" y="${H - 6}" text-anchor="middle">${isoWeek(w.s)}</text>` : '').join('')}</g>
    <line class="crosshair" x1="0" x2="0" y1="${m.t}" y2="${m.t + ih}" style="display:none"/>
    ${bars}
    <line class="baseline" x1="${m.l}" x2="${W - m.r}" y1="${m.t + ih}" y2="${m.t + ih}"/>
    <rect x="${m.l}" y="0" width="${iw}" height="${H}" fill="transparent" class="hit"/>
  </svg><div class="chart-tip"></div>`;

  // Forklaring over diagrammet, og tabell som alternativ til fargene
  el.insertAdjacentHTML('afterbegin', `<div class="legend">
    <span><i class="sw sw-strength"></i>Styrke <b>${totS}</b></span>
    <span><i class="sw sw-cardio"></i>Kondisjon <b>${totC}</b></span>
  </div>`);
  el.insertAdjacentHTML('beforeend', `
    <details class="table-toggle"><summary>Vis som tabell</summary>
      <table class="data"><thead><tr><th>Uke</th><th class="num">Styrke</th><th class="num">Kondisjon</th><th class="num">Totalt</th></tr></thead><tbody>
      ${[...weeks].reverse().map((w) => `<tr><td>${isoWeek(w.s)}</td><td class="num">${w.strength}</td><td class="num">${w.cardio}</td><td class="num">${w.n}</td></tr>`).join('')}
      </tbody></table></details>`);
  attachHover(el, W, weeks.map((w, i) => ({
    x: m.l + i * slot + slot / 2, y: Y(w.n),
    tip: `<b>Uke ${isoWeek(w.s)}: ${w.n} ${w.n === 1 ? 'økt' : 'økter'}</b><br><i class="sw sw-strength"></i>${w.strength} styrke · <i class="sw sw-cardio"></i>${w.cardio} kondisjon${w.mins ? `<br>${w.mins} min totalt` : ''}`,
  })), false);
}

function attachHover(wrap, W, items, showDot) {
  const svg = wrap.querySelector('svg'), tip = wrap.querySelector('.chart-tip');
  const cross = svg.querySelector('.crosshair'), dot = svg.querySelector('.hover-dot');
  const show = (ev) => {
    const r = svg.getBoundingClientRect();
    const sx = ((ev.clientX - r.left) / r.width) * W;
    let best = items[0], bd = Infinity;
    for (const it of items) { const d = Math.abs(it.x - sx); if (d < bd) { bd = d; best = it; } }
    if (!best) return;
    wrap.classList.add('hovering');
    cross.setAttribute('x1', best.x); cross.setAttribute('x2', best.x);
    if (dot && showDot) { dot.setAttribute('cx', best.x); dot.setAttribute('cy', best.y); }
    tip.innerHTML = best.tip;
    const scale = r.width / W;
    const px = best.x * scale, py = best.y * scale;
    const tw = tip.offsetWidth, th = tip.offsetHeight;
    let left = px - tw / 2;
    left = Math.max(0, Math.min(left, r.width - tw));
    const oy = svg.offsetTop; // grafen kan ligge under en forklaring
    let top = oy + py - th - 12;
    if (top < 0) top = oy + py + 14;
    tip.style.left = left + 'px';
    tip.style.top = top + 'px';
  };
  const hide = () => wrap.classList.remove('hovering');
  svg.addEventListener('pointermove', show);
  svg.addEventListener('pointerdown', show);
  svg.addEventListener('pointerleave', hide);
}

let resizeTimer;
window.addEventListener('resize', () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => { if (location.hash.startsWith('#/statistikk')) route(); }, 200);
});

/* =========================================================
   Mer / innstillinger
   ========================================================= */
/* =========================================================
   Profil
   ========================================================= */
const GENDERS = [['female', 'Kvinne'], ['male', 'Mann'], ['other', 'Annet'], ['', 'Vil ikke oppgi']];

function profileSummary() {
  const p = db.profile || {};
  const parts = [];
  if (p.name) parts.push(p.name);
  if (p.weeklyGoal) parts.push(`mål ${p.weeklyGoal}/uke`);
  return parts.join(' · ') || 'Ikke satt opp';
}

function renderProfile() {
  setHeader('Profil', '#/mer');
  const p = db.profile || {};
  const goal = p.weeklyGoal || 0;
  view().innerHTML = `
    <form class="stack" data-form="profile" onsubmit="return false">
      <section class="card stack">
        <h3>Om deg</h3>
        <label class="field">Navn<input name="name" maxlength="40" value="${esc(p.name || '')}" placeholder="Hva vil du kalles?" autocomplete="given-name"></label>
        <div><label class="field">Kjønn</label>
          <div class="chips" style="margin-top:6px" data-choice="gender">
            ${GENDERS.map(([v, l]) => `<button type="button" class="chip" data-act="choice" data-v="${v}" aria-pressed="${(p.gender || '') === v}">${l}</button>`).join('')}
          </div>
          <input type="hidden" name="gender" value="${esc(p.gender || '')}">
        </div>
        <div class="cardio-grid" style="margin-top:0">
          <label class="field">Alder (år)<input name="age" inputmode="numeric" value="${inputVal(p.age)}" placeholder="–"></label>
        </div>
      </section>

      <section class="card stack">
        <h3>Ukemål</h3>
        <div class="iv-stepper" style="margin-top:0">
          <span>Økter per uke</span>
          <div class="stepper">
            <button type="button" data-act="goal-step" data-d="-1" aria-label="Færre økter">−</button>
            <b data-goal-value>${goal || 'Av'}</b>
            <button type="button" data-act="goal-step" data-d="1" aria-label="Flere økter">+</button>
          </div>
        </div>
        <input type="hidden" name="weeklyGoal" value="${goal}">
      </section>

      <button type="button" class="btn primary block big" data-act="save-profile">Lagre profil</button>
    </form>`;
}

function renderMore() {
  setHeader('Mer');
  const bytes = new Blob([localStorage.getItem(STORE_KEY) || '']).size;
  view().innerHTML = `
    <section class="card" style="padding:4px 14px">
      <a class="ex-option" style="text-decoration:none;color:inherit" href="#/profil"><span>Profil</span><span class="kind">${esc(profileSummary())} ›</span></a>
      <a class="ex-option" style="text-decoration:none;color:inherit" href="#/ovelser"><span>Øvelser</span><span class="kind">${db.exercises.filter((e) => !e.hidden).length} ›</span></a>
      <a class="ex-option" style="text-decoration:none;color:inherit" href="#/utseende"><span>Utseende</span><span class="kind">${esc(themeName())} ›</span></a>
    </section>

    <h2 class="section-title">Sikkerhetskopi</h2>
    <section class="card stack">
      <button class="btn primary block" data-act="export">Eksporter data (.json)</button>
      <label class="btn ghost block" style="cursor:pointer">Importer fra fil
        <input type="file" accept="application/json,.json" data-import hidden></label>
      <button class="btn ghost block" data-act="export-csv">Eksporter som regneark (.csv)</button>
      <p class="small muted">${db.workouts.length} økter · ${fmtNum(bytes / 1024, 0)} kB brukt</p>
    </section>

    ${installPromptEvent ? `<button class="btn secondary block" data-act="install">Installer appen</button>` : ''}

    <h2 class="section-title">Faresone</h2>
    <section class="card"><button class="btn danger block btn-destructive" style="margin-top:0" data-act="wipe">Slett alle data</button></section>
    <p class="small muted" style="text-align:center;margin-top:18px">Treningsloggen · versjon 2.6</p>`;
}

function renderExercises() {
  setHeader('Øvelser', '#/mer');
  let html = `<button class="btn primary block" style="margin-top:8px" data-act="new-ex-settings">+ Ny øvelse</button>`;
  for (const cat of CATEGORIES) {
    const items = db.exercises.filter((e) => inCat(e, cat, true)).sort(sortIn(cat));
    if (!items.length) continue;
    html += folder('innst-' + cat, cat, items.length, items.map((e) => `<button class="ex-option" data-act="ex-menu" data-id="${esc(e.id)}">
      <span${e.hidden ? ' class="muted"' : ''}>${esc(e.name)}${e.hidden ? ' (skjult)' : ''}</span><span class="kind">${e.kind === 'cardio' ? 'Kondisjon' : 'Styrke'}</span></button>`).join(''));
  }
  view().innerHTML = `<div class="folder-list">${html}</div>`;
}

async function exportData() {
  const data = JSON.stringify({ app: 'treningslogg', exportedAt: new Date().toISOString(), ...db }, null, 2);
  const name = `treningsloggen-${todayISO()}.json`;
  shareOrDownload(new Blob([data], { type: 'application/json' }), name);
}
// Velg datointervall før eksport til regneark
const isoDay = (d) => { const x = new Date(d); x.setMinutes(x.getMinutes() - x.getTimezoneOffset()); return x.toISOString().slice(0, 10); };
const csvCount = (from, to) => db.workouts.filter((w) => (!from || w.date >= from) && (!to || w.date <= to)).length;
function csvRangeValues() {
  const f = $('#sheet-root form[data-form="csv"]');
  return { from: f?.elements.from.value || '', to: f?.elements.to.value || '' };
}
function csvPresets() {
  const now = new Date();
  const ws = sortedWorkouts();
  const first = ws.length ? ws[ws.length - 1].date : todayISO();
  const daysAgo = (n) => { const d = new Date(now); d.setDate(d.getDate() - n); return isoDay(d); };
  return {
    '30d': ['Siste 30 dager', daysAgo(29), todayISO()],
    '90d': ['Siste 3 måneder', daysAgo(90), todayISO()],
    month: ['Denne måneden', todayISO().slice(0, 8) + '01', todayISO()],
    year: ['I år', `${now.getFullYear()}-01-01`, todayISO()],
    all: ['Alt', first, todayISO()],
  };
}
function openCsvExport() {
  if (!db.workouts.length) { toast('Ingen økter å eksportere ennå'); return; }
  const p = csvPresets();
  openSheet(`<h2>Eksporter som regneark</h2>
    <form class="stack" data-form="csv" onsubmit="return false">
      <div class="chips">${Object.entries(p).map(([k, [l]]) => `<button type="button" class="chip" data-act="csv-range" data-v="${k}" aria-pressed="${k === 'all'}">${l}</button>`).join('')}</div>
      <div class="cardio-grid" style="margin-top:0">
        <label class="field">Fra<input type="date" name="from" value="${p.all[1]}" max="${todayISO()}"></label>
        <label class="field">Til<input type="date" name="to" value="${p.all[2]}" max="${todayISO()}"></label>
      </div>
      <p class="small" data-csv-count></p>
      <button type="button" class="btn primary block big" data-act="csv-go">Eksporter</button>
    </form>`);
  updateCsvCount();
}
function setCsvRange(key) {
  const f = $('#sheet-root form[data-form="csv"]');
  const [, from, to] = csvPresets()[key];
  f.elements.from.value = from;
  f.elements.to.value = to;
  f.querySelectorAll('[data-act="csv-range"]').forEach((b) => b.setAttribute('aria-pressed', b.dataset.v === key));
  updateCsvCount();
}
function updateCsvCount() {
  const { from, to } = csvRangeValues();
  const out = $('#sheet-root [data-csv-count]');
  const btn = $('#sheet-root [data-act="csv-go"]');
  if (!out) return;
  if (from && to && from > to) {
    out.textContent = '«Fra» må være før «Til».';
    btn.disabled = true;
    return;
  }
  const n = csvCount(from, to);
  out.innerHTML = n ? `<b>${n}</b> ${n === 1 ? 'økt' : 'økter'} blir med i fila.` : 'Ingen økter i denne perioden.';
  btn.disabled = !n;
  btn.textContent = n ? `Eksporter ${n} ${n === 1 ? 'økt' : 'økter'}` : 'Eksporter';
}
// Manuell endring av datoene: oppdater telling og fjern markering av hurtigvalg
document.addEventListener('change', (ev) => {
  if (!ev.target.closest('form[data-form="csv"]')) return;
  ev.target.closest('form').querySelectorAll('[data-act="csv-range"]').forEach((b) => b.setAttribute('aria-pressed', 'false'));
  updateCsvCount();
});

function exportCsv(from, to) {
  // Én rad per sett / forsøk / segment / drag. Kolonner: [nøkkel, overskrift]
  const cols = [
    ['date', 'Dato'], ['folder', 'Mappe'], ['ex', 'Øvelse'], ['type', 'Type'], ['mode', 'Modus / formål'], ['part', 'Sett / segment'],
    ['weight', 'Vekt (kg)'], ['reps', 'Reps'], ['meters', 'Lengde (m)'], ['ok', 'Klarte'], ['sec', 'Tid (sek)'], ['rest', 'Pause (sek)'],
    ['km', 'Distanse (km)'], ['kmh', 'Fart (km/t)'], ['paceKm', 'Tempo (min/km)'], ['pace', 'Tempo (sek/500 m)'],
    ...Object.entries(CARDIO_FIELDS).map(([k, F]) => [k, F.label]),
    ['hr', 'Snittpuls'], ['kcal', 'Kcal'], ['note', 'Øvelsesnotat'], ['feel', 'Følelse'], ['wnote', 'Øktnotat'],
  ];
  const rows = [cols.map((c) => c[1])];
  const r2 = (v, d) => (v == null || !Number.isFinite(v) ? '' : +v.toFixed(d));
  const inRange = (w) => (!from || w.date >= from) && (!to || w.date <= to);
  for (const w of [...sortedWorkouts()].reverse().filter(inRange)) {
    for (const en of w.entries) {
      const ex = exById(en.exerciseId);
      const base = { date: w.date, folder: folderById(w.folderId)?.name || '', ex: ex.name, feel: w.feeling ?? '', wnote: w.note || '' };
      const push = (o) => rows.push(cols.map(([k]) => o[k] ?? ''));
      if (ex.kind === 'cardio') {
        const st = cardioStats(en) || {};
        const p = purposeLabel(en.purpose);
        const paceOf = (kmh) => (exCfg(ex).pace && kmh ? fmtDuration(3600 / kmh) : '');
        const fields = (src) => Object.fromEntries(Object.keys(CARDIO_FIELDS).map((k) => [k, r2(src[k], 1)]));
        push({ ...base, type: 'Kondisjon', mode: p, part: 'Totalt', sec: r2(st.timeSec, 0), km: r2(st.distanceKm, 3), kmh: r2(st.speed, 2), paceKm: paceOf(st.speed), pace: r2(st.pace500, 1), ...fields(st), hr: en.avgHr ?? '', kcal: en.kcal ?? '', note: en.note || '' });
        resolvedSegments(en).forEach((s, j) => push({ ...base, type: 'Kondisjon', mode: p, part: `Segment ${j + 1}`, sec: r2(s.timeSec, 0), km: r2(s.distanceKm, 3), kmh: r2(s.speed, 2), paceKm: paceOf(s.speed), pace: r2(paceSec(s.speed), 1), ...fields(s) }));
        const iv = intervalTotals(en);
        if (iv) en.intervals.forEach((x, j) => {
          const r = iv.parts[j];
          push({ ...base, type: 'Kondisjon', mode: p, part: `Drag ${j + 1}`, sec: r2(r.timeSec, 0), rest: j < en.intervals.length - 1 ? x.restSec ?? '' : '', km: r2(r.distanceKm, 3), kmh: r2(r.speed, 2), paceKm: paceOf(r.speed), pace: r2(paceSec(r.speed), 1), ...fields(x) });
        });
      } else if (en.mode === 'max') {
        en.attempts.forEach((a, j) => push({ ...base, type: 'Styrke', mode: '1RM-test', part: j + 1, weight: a.weight ?? '', reps: 1, ok: a.ok ? 'Ja' : 'Nei', note: en.note || '' }));
      } else {
        en.sets.forEach((s, j) => push({ ...base, type: 'Styrke', mode: { time: 'Tid', distance: 'Lengde' }[exMeasure(ex)] || 'Repetisjoner', part: j + 1, weight: s.weight ?? '', reps: s.reps ?? '', sec: s.sec ?? '', meters: s.meters ?? '', note: en.note || '' }));
      }
    }
  }
  const csv = '﻿' + rows.map((r) => r.map((c) => {
    const s = String(c).replace('.', ',');
    return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  }).join(';')).join('\n');
  const range = from || to ? `${from || "start"}_til_${to || todayISO()}` : todayISO();
  shareOrDownload(new Blob([csv], { type: "text/csv" }), `treningsloggen-${range}.csv`);
}
async function shareOrDownload(blob, name) {
  const file = new File([blob], name, { type: blob.type });
  if (navigator.canShare && navigator.canShare({ files: [file] }) && /Android|iPhone|iPad/i.test(navigator.userAgent)) {
    try { await navigator.share({ files: [file], title: name }); return; } catch (e) { if (e.name === 'AbortError') return; }
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  toast('Fila er lastet ned');
}
function importData(file) {
  const reader = new FileReader();
  reader.onload = async () => {
    try {
      const d = JSON.parse(reader.result);
      if (!Array.isArray(d.workouts) || !Array.isArray(d.exercises)) throw new Error('format');
      const mode = db.workouts.length
        ? await askConfirm(`Fila inneholder ${d.workouts.length} økter. De blir slått sammen med øktene du har fra før.`, { title: 'Importere økter?', ok: 'Importer' })
        : true;
      if (!mode) return;
      const exIds = new Set(db.exercises.map((e) => e.id));
      for (const e of d.exercises) if (!exIds.has(e.id)) db.exercises.push(e);
      for (const f of d.folders || []) if (!folderById(f.id)) db.folders.push(f);
      for (const t of d.templates || []) if (!templateById(t.id)) db.templates.push(t);
      if (d.profile && !Object.values(db.profile || {}).some(Boolean)) db.profile = d.profile;
      const wIds = new Map(db.workouts.map((w, i) => [w.id, i]));
      let added = 0;
      for (const w of d.workouts) {
        if (wIds.has(w.id)) db.workouts[wIds.get(w.id)] = w; else { db.workouts.push(w); added++; }
      }
      db = migrate(db);
      save();
      toast(`Importert: ${added} nye økter`);
      route();
    } catch (e) {
      toast('Kunne ikke lese fila – er det en eksport fra Treningsloggen?');
    }
  };
  reader.readAsText(file);
}

/* =========================================================
   Hendelser
   ========================================================= */
const actions = {
  'start-workout': () => {
    if (db.draft) { goToEditor(); return; }
    openStartChooser();
  },
  'start-blank': () => { closeSheet(); startWorkout(); },
  'fav-start': (el) => startFromTemplate(el.dataset.id),
  'fav-menu': (el) => {
    const t = templateById(el.dataset.id);
    if (!t) return;
    openSheet(`<h2>${esc(t.name)}</h2><div class="menu-list">
      <button data-act="fav-start" data-id="${esc(t.id)}">Start økt</button>
      <button data-act="tpl-edit" data-id="${esc(t.id)}">Endre navn og øvelser</button>
      <button class="danger" data-act="tpl-delete" data-id="${esc(t.id)}">Slett favorittøkt</button>
    </div>`);
  },
  'tpl-new': () => {
    tplDraft = { name: '', exerciseIds: [] };
    closeSheet();
    if (location.hash === '#/favoritt/ny') route(); else location.hash = '#/favoritt/ny';
  },
  'tpl-edit': (el) => { tplDraft = null; location.hash = `#/favoritt/${encodeURIComponent(el.dataset.id)}`; },
  'tpl-add': () => openExercisePicker(false, 'template'),
  'tpl-move': (el) => {
    const a = tplDraft.exerciseIds, i = +el.dataset.i, j = i + +el.dataset.d;
    [a[i], a[j]] = [a[j], a[i]];
    renderTemplateEditor(tplDraft.id || 'ny');
  },
  'tpl-remove': (el) => {
    tplDraft.exerciseIds.splice(+el.dataset.i, 1);
    renderTemplateEditor(tplDraft.id || 'ny');
  },
  'tpl-save': () => {
    const t = tplDraft;
    t.name = (t.name || '').trim();
    if (!t.name) { toast('Gi favorittøkta et navn'); $('[data-tpl-name]')?.focus(); return; }
    if (!t.exerciseIds.length) { toast('Legg til minst én øvelse'); return; }
    if (db.templates.some((x) => x.name.toLowerCase() === t.name.toLowerCase() && x.id !== t.id)) { toast('Du har allerede en favorittøkt med det navnet'); return; }
    if (t.id) Object.assign(templateById(t.id), { name: t.name, exerciseIds: [...t.exerciseIds], updatedAt: Date.now() });
    else db.templates.push({ id: 't-' + uid(), name: t.name, exerciseIds: [...t.exerciseIds], createdAt: Date.now() });
    save();
    tplDraft = null;
    location.hash = '#/';
    toast(`Favorittøkta «${t.name}» er lagret ⭐`);
  },
  'tpl-delete': async (el) => {
    const t = templateById(el.dataset.id || tplDraft?.id);
    if (!t) return;
    if (!(await askConfirm('Øktene du allerede har registrert, blir ikke påvirket.', { title: `Slette «${t.name}»?`, ok: 'Slett', danger: true }))) return;
    db.templates = db.templates.filter((x) => x.id !== t.id);
    save();
    tplDraft = null;
    if (location.hash.startsWith('#/favoritt')) location.hash = '#/'; else route();
    toast(`«${t.name}» er slettet`);
  },
  'save-as-template': (el) => {
    const w = db.workouts.find((x) => x.id === el.dataset.id);
    if (!w) return;
    tplDraft = { name: '', exerciseIds: [...new Set(w.entries.map((e) => e.exerciseId))] };
    closeSheet();
    location.hash = '#/favoritt/ny';
    toast('Gi favorittøkta et navn og lagre');
  },
  'add-ex': () => openExercisePicker(false, 'draft'),
  'close-sheet': closeSheet,
  'pick-ex': (el) => togglePick(el.dataset.id),
  'picker-add': () => {
    if (pickerTarget === 'template' && tplDraft) {
      tplDraft.exerciseIds.push(...pickerSel.filter((id) => !tplDraft.exerciseIds.includes(id)));
      closeSheet();
      renderTemplateEditor(tplDraft.id || 'ny');
      return;
    }
    addExercisesToDraft([...pickerSel]);
  },
  'new-ex': (el) => openNewExerciseForm(el.dataset.name, 'picker'),
  'new-ex-settings': () => openNewExerciseForm('', 'settings'),
  choice: (el) => {
    const form = el.closest('form');
    const group = el.closest('[data-choice]');
    const field = group.dataset.choice;
    if (field === 'kind' && form.dataset.id && isUsed(form.dataset.id)) return;
    group.querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', b === el));
    form.elements[field].value = el.dataset.v;
    if (field === 'kind') {
      if (el.dataset.v === 'cardio') form.elements.cat.value = 'Kondisjon';
      else if (form.elements.cat.value === 'Kondisjon') form.elements.cat.value = 'Annet';
      form.querySelectorAll('[data-show]').forEach((s) => { s.hidden = s.dataset.show !== el.dataset.v; });
    }
    if (field === 'distance') form.querySelector('[data-show-dist]').hidden = el.dataset.v !== 'true';
    if (field === 'speed') form.querySelector('[data-show-pace]').hidden = el.dataset.v !== 'kmh';
  },
  'toggle-field': (el) => {
    const form = el.closest('form');
    el.setAttribute('aria-pressed', el.getAttribute('aria-pressed') !== 'true');
    form.elements.fields.value = [...el.parentElement.querySelectorAll('[aria-pressed="true"]')].map((b) => b.dataset.v).join(',');
  },
  'dist-unit': (el) => {
    db.draft.entries[+el.dataset.e].distUnit = el.dataset.v;
    save();
    renderEditor();
  },
  'add-set': (el) => {
    const en = db.draft.entries[+el.dataset.e];
    const last = en.sets[en.sets.length - 1];
    en.sets.push(last ? { ...last } : { weight: null, reps: null });
    save();
    renderEditor();
    const rows = document.querySelectorAll(`#entry-${el.dataset.e} .set-row:not(.head) input[data-f="reps"]`);
    rows[rows.length - 1]?.focus({ preventScroll: false });
  },
  'fill-last': (el) => {
    const i = +el.dataset.e;
    const en = db.draft.entries[i];
    const hist = historyFor(en.exerciseId, db.draft.id);
    if (exById(en.exerciseId).kind === 'strength') {
      const last = [...hist].reverse().find((h) => (h.en.mode || 'reps') === 'reps');
      if (!last) return;
      en.sets = last.en.sets.filter(setDone).map((s) => ({ weight: s.weight, reps: s.reps ?? null, sec: s.sec ?? null, meters: s.meters ?? null }));
    } else {
      const p = en.purpose || 'endurance';
      const same = hist.filter((h) => (h.en.purpose || 'endurance') === p);
      const last = same[same.length - 1];
      if (!last) return;
      for (const k of ['timeSec', 'distanceKm', 'speedKmh', 'distUnit', ...Object.keys(CARDIO_FIELDS)]) en[k] = last.en[k] ?? null;
      en.segments = clone(last.en.segments || []);
      en.intervals = clone(last.en.intervals || []);
    }
    save();
    renderEditor();
    toast('Fylt inn verdiene fra forrige gang – juster det som er annerledes');
  },
  mode: (el) => {
    const en = db.draft.entries[+el.dataset.e];
    en.mode = el.dataset.v;
    en.sets ||= [];
    en.attempts ||= [];
    if (en.mode === 'max' && !en.attempts.length) en.attempts.push({ weight: null, ok: true });
    if (en.mode === 'reps' && !en.sets.length) en.sets.push({ weight: null, reps: null });
    save();
    renderEditor();
  },
  'add-attempt': (el) => {
    const en = db.draft.entries[+el.dataset.e];
    const last = en.attempts[en.attempts.length - 1];
    // Neste forsøk: +2,5 kg etter et godkjent løft, samme vekt etter bom
    const w = last?.weight ? last.weight + (last.ok ? 2.5 : 0) : null;
    en.attempts.push({ weight: w, ok: true });
    save();
    renderEditor();
    const inputs = document.querySelectorAll(`#entry-${el.dataset.e} input[data-a]`);
    inputs[inputs.length - 1]?.focus();
  },
  'toggle-ok': (el) => {
    const a = db.draft.entries[+el.dataset.e].attempts[+el.dataset.a];
    a.ok = !a.ok;
    save();
    renderEditor();
  },
  'del-attempt': (el) => {
    db.draft.entries[+el.dataset.e].attempts.splice(+el.dataset.a, 1);
    save();
    renderEditor();
  },
  purpose: (el) => {
    const en = db.draft.entries[+el.dataset.e];
    en.purpose = el.dataset.v;
    en.segments ||= [];
    en.intervals ||= [];
    // Ny intervalløkt: start med samme antall drag som sist
    if (isIntervalType(en.purpose) && !en.intervals.length) {
      const hist = historyFor(en.exerciseId, db.draft.id).filter((h) => h.en.purpose === en.purpose);
      const n = hist.length ? (hist[hist.length - 1].en.intervals || []).length : 4;
      en.intervals = Array.from({ length: Math.max(1, n) }, blankInterval);
    }
    save();
    renderEditor();
  },
  'iv-count': (el) => {
    const en = db.draft.entries[+el.dataset.e];
    en.intervals ||= [];
    if (+el.dataset.d > 0) {
      const last = en.intervals[en.intervals.length - 1];
      en.intervals.push(last ? { ...last } : blankInterval());
    } else {
      en.intervals.pop();
    }
    save();
    renderEditor();
  },
  'del-iv': (el) => {
    db.draft.entries[+el.dataset.e].intervals.splice(+el.dataset.iv, 1);
    save();
    renderEditor();
  },
  'iv-copy': (el) => {
    const en = db.draft.entries[+el.dataset.e];
    const first = en.intervals[0];
    en.intervals = en.intervals.map(() => ({ ...first }));
    save();
    renderEditor();
    toast(`Drag 1 er kopiert til alle ${en.intervals.length} intervallene`);
  },
  'add-seg': (el) => {
    const en = db.draft.entries[+el.dataset.e];
    en.segments ||= [];
    const last = en.segments[en.segments.length - 1];
    en.segments.push(last ? { ...last } : blankPart());
    save();
    renderEditor();
    const inputs = document.querySelectorAll(`#entry-${el.dataset.e} input[data-g][data-f="segmin"]`);
    inputs[inputs.length - 1]?.focus();
  },
  'del-seg': (el) => {
    db.draft.entries[+el.dataset.e].segments.splice(+el.dataset.g, 1);
    save();
    renderEditor();
  },
  'del-set': (el) => {
    const en = db.draft.entries[+el.dataset.e];
    en.sets.splice(+el.dataset.s, 1);
    save();
    renderEditor();
  },
  'entry-menu': (el) => {
    const i = +el.dataset.e;
    const ex = exById(db.draft.entries[i].exerciseId);
    openSheet(`<h2>${esc(ex.name)}</h2><div class="menu-list">
      ${i > 0 ? `<button data-act="move-entry" data-e="${i}" data-dir="-1">Flytt opp</button>` : ''}
      ${i < db.draft.entries.length - 1 ? `<button data-act="move-entry" data-e="${i}" data-dir="1">Flytt ned</button>` : ''}
      <button data-act="stats-from-editor" data-id="${esc(ex.id)}">Se fremgang</button>
      <button class="danger" data-act="remove-entry" data-e="${i}">Fjern fra økta</button>
    </div>`);
  },
  'move-entry': (el) => {
    const i = +el.dataset.e, j = i + +el.dataset.dir;
    const arr = db.draft.entries;
    [arr[i], arr[j]] = [arr[j], arr[i]];
    save(); closeSheet(); renderEditor();
  },
  'remove-entry': (el) => {
    db.draft.entries.splice(+el.dataset.e, 1);
    save(); closeSheet(); renderEditor();
  },
  'stats-from-editor': (el) => { location.hash = `#/statistikk/${encodeURIComponent(el.dataset.id)}`; },
  feel: (el) => {
    const v = +el.dataset.v;
    db.draft.feeling = db.draft.feeling === v ? null : v;
    el.parentElement.querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', +b.dataset.v === db.draft.feeling));
    save();
  },
  'save-workout': saveWorkout,
  'confirm-yes': () => answerConfirm(true),
  'confirm-no': () => answerConfirm(false),
  discard: async () => {
    // Spør først, og la brukeren angre i noen sekunder etterpå
    const draft = db.draft;
    if (!draft) return;
    const ok = await askConfirm('', {
      title: draft.id ? 'Sikker på at du vil forkaste endringene?' : 'Sikker på at du vil forkaste økta?', ok: 'Ja', cancel: 'Nei', danger: true });
    if (!ok) return;
    db.draft = null;
    save();
    location.hash = draft.id ? `#/okt/${encodeURIComponent(draft.id)}` : '#/';
    toast(draft.id ? 'Endringene er forkastet' : 'Økta er forkastet', 6000, {
      label: 'Angre',
      run: () => {
        db.draft = draft;
        save();
        goToEditor();
        toast('Økta er hentet tilbake');
      },
    });
  },
  'edit-workout': async (el) => {
    if (db.draft && !(await askConfirm('Du har en økt som ikke er lagret. Vil du forkaste den og redigere denne?', { ok: 'Forkast og rediger', danger: true }))) return;
    const w = db.workouts.find((x) => x.id === el.dataset.id);
    db.draft = clone(w);
    save();
    goToEditor();
  },
  'repeat-workout': async (el) => {
    if (db.draft && !(await askConfirm('Du har en økt som ikke er lagret. Vil du forkaste den og starte en ny?', { ok: 'Forkast og start ny', danger: true }))) return;
    const w = db.workouts.find((x) => x.id === el.dataset.id);
    db.draft = { ...newDraft(), folderId: folderById(w.folderId) ? w.folderId : null };
    for (const en of w.entries) {
      const ex = exById(en.exerciseId);
      const n = { id: uid(), exerciseId: en.exerciseId, note: '' };
      if (ex.kind === 'cardio') Object.assign(n, blankCardio(), { purpose: en.purpose || 'endurance', intervals: (en.intervals || []).map(blankInterval) });
      else if (en.mode === 'max') Object.assign(n, { mode: 'max', sets: [], attempts: [] });
      else Object.assign(n, { mode: 'reps', sets: en.sets.map(() => ({ weight: null, reps: null })), attempts: [] });
      db.draft.entries.push(n);
    }
    save();
    goToEditor();
    toast('Samme øvelser som sist – verdiene fra forrige gang vises som hint');
  },
  'delete-workout': async (el) => {
    if (!(await askConfirm('', { title: 'Sikker på at du vil slette økta?', ok: 'Ja', cancel: 'Nei', danger: true }))) return;
    deleteWorkout(el.dataset.id);
  },
  'toast-action': () => {
    const a = toastAction;
    toastAction = null;
    $('#toast').classList.remove('show');
    if (a) a.run();
  },
  'wo-menu': (el) => {
    const w = db.workouts.find((x) => x.id === el.dataset.id);
    if (!w) return;
    const names = w.entries.map((e) => exById(e.exerciseId).name).join(', ');
    openSheet(`<h2>${esc(fmtDateLong(w.date).replace(/^./, (c) => c.toUpperCase()))}</h2>
      <p class="small muted" style="margin:-4px 0 8px">${esc(names)}</p>
      <div class="menu-list">
        <button data-act="open-workout" data-id="${esc(w.id)}">Åpne</button>
        <button data-act="edit-workout" data-id="${esc(w.id)}">Rediger</button>
        <button data-act="repeat-workout" data-id="${esc(w.id)}">Gjenta økt</button>
        <button data-act="move-workout" data-id="${esc(w.id)}">Flytt til mappe${folderById(w.folderId) ? ` (nå: ${esc(folderById(w.folderId).name)})` : ''}</button>
        <button data-act="save-as-template" data-id="${esc(w.id)}">⭐ Lagre som favorittøkt</button>
        <button class="danger" data-act="delete-workout" data-id="${esc(w.id)}">Slett økt</button>
      </div>`);
  },
  'set-theme': (el) => { setAppearance(el.dataset.v, savedMode()); renderAppearance(); },
  'set-mode': (el) => { setAppearance(currentTheme(), el.dataset.v); renderAppearance(); },
  'dur-mode': (el) => {
    db.draft.durationMode = el.dataset.v;
    save();
    const block = el.closest('.card');
    renderEditor();
    block && document.querySelector('[data-act="dur-mode"]')?.scrollIntoView({ block: 'center' });
  },
  'timer-reset': async () => {
    if (!(await askConfirm('Tidtakeren starter på 0 igjen fra nå.', { title: 'Start tidtakeren på nytt?', ok: 'Start på nytt' }))) return;
    db.draft.startedAt = Date.now();
    save();
    renderEditor();
    document.querySelector('[data-act="dur-mode"]')?.scrollIntoView({ block: 'center' });
    updateTimers();
  },
  'goal-step': (el) => {
    const form = el.closest('form');
    const v = Math.max(0, Math.min(21, (+form.elements.weeklyGoal.value || 0) + +el.dataset.d));
    form.elements.weeklyGoal.value = v;
    form.querySelector('[data-goal-value]').textContent = v || 'Av';
  },
  'save-profile': (el) => {
    const f = el.closest('form').elements;
    const age = num(f.age.value);
    if (age != null && (age < 5 || age > 120)) { toast('Sjekk alderen – den ser ikke riktig ut'); return; }
    db.profile = {
      ...db.profile,
      name: f.name.value.trim(),
      gender: f.gender.value,
      age: age != null ? Math.round(age) : null,
      weeklyGoal: +f.weeklyGoal.value || null,
      updatedAt: Date.now(),
    };
    save();
    location.hash = '#/';
    toast(db.profile.weeklyGoal ? `Profilen er lagret – ukemål: ${db.profile.weeklyGoal} økter` : 'Profilen er lagret');
  },
  'draft-folder': (el) => {
    if (!db.draft) return;
    db.draft.folderId = el.dataset.v || null;
    save();
    el.parentElement.innerHTML = draftFolderChips(db.draft);
  },
  'new-folder': (el) => openFolderForm(el.dataset.ctx),
  'hist-date': (el) => { histUI.dateMode = el.dataset.v; histUI.filterOpen = true; renderHistory(); },
  'hist-filter-toggle': () => {
    const dateOn = (histUI.dateMode === 'day' && histUI.day) || (histUI.dateMode === 'range' && (histUI.from || histUI.to));
    // Lukker man filteret mens det er i bruk, nullstilles datoene
    if ((histUI.filterOpen || dateOn)) Object.assign(histUI, { filterOpen: false, dateMode: 'all', day: '', from: '', to: '' });
    else histUI.filterOpen = true;
    renderHistory();
  },
  'hist-order': () => { histUI.order = histUI.order === 'desc' ? 'asc' : 'desc'; renderHistory(); },
  'hist-reset': () => { Object.assign(histUI, { q: '', dateMode: 'all', day: '', from: '', to: '', filterOpen: false }); renderHistory(); },
  'hist-mode': (el) => {
    histUI.mode = el.dataset.v;
    try { localStorage.setItem('treningslogg.histmode', histUI.mode); } catch {}
    renderHistory();
  },
  'rename-folder': (el) => openFolderForm('history', folderById(el.dataset.id)),
  'delete-folder': async (el) => {
    const f = folderById(el.dataset.id);
    if (!f) return;
    const n = db.workouts.filter((w) => w.folderId === f.id).length;
    const text = n ? `${n} ${n === 1 ? 'økt' : 'økter'} i mappa blir ikke slettet, men flyttes til «Uten mappe».` : 'Mappa er tom.';
    if (!(await askConfirm(text, { title: `Slette mappa «${f.name}»?`, ok: 'Slett mappe', danger: true }))) return;
    db.folders = db.folders.filter((x) => x.id !== f.id);
    for (const w of db.workouts) if (w.folderId === f.id) w.folderId = null;
    if (db.draft?.folderId === f.id) db.draft.folderId = null;
    save();
    route();
    toast(`Mappa «${f.name}» er slettet`);
  },
  'move-workout': (el) => openMoveSheet(el.dataset.id),
  'move-to-folder': (el) => {
    const w = db.workouts.find((x) => x.id === el.dataset.id);
    if (!w) return;
    w.folderId = el.dataset.v || null;
    save();
    closeSheet();
    route();
    toast(w.folderId ? `Flyttet til «${folderById(w.folderId).name}»` : 'Økta ligger nå uten mappe');
  },
  'open-workout': (el) => { location.hash = `#/okt/${encodeURIComponent(el.dataset.id)}`; },
  metric: (el) => { statsUI.metric[el.dataset.ex] = el.dataset.k; renderStats(el.dataset.ex); },
  'stats-period': (el) => { statsUI.period = el.dataset.v; const y = window.scrollY; renderStats(); window.scrollTo(0, y); },
  'stats-dist': (el) => { statsUI.dist = el.dataset.v; const y = window.scrollY; renderStats(); window.scrollTo(0, y); },
  muscle: (el) => {
    const m = el.dataset.muscle;
    document.querySelectorAll('.body-fig .mus.sel').forEach((p) => p.classList.remove('sel'));
    document.querySelectorAll(`.body-fig [data-muscle="${m}"]`).forEach((p) => p.classList.add('sel'));
    const { from, to } = periodRange(statsUI.period || 'month');
    const v = distribution(workoutsBetween(from, to)).muscles[m] || 0;
    const info = $('[data-muscle-info]');
    if (info) info.innerHTML = `<b>${esc(muscleName(m))}</b> · ${v ? `${fmtNum(v, 1)} arbeidssett` : 'ikke trent i perioden'}`;
  },
  'purpose-filter': (el) => { statsUI.purpose[el.dataset.ex] = el.dataset.v; renderStats(el.dataset.ex); },
  'stats-weight': (el) => { statsUI.weight[el.dataset.ex] = +el.dataset.v; renderStats(el.dataset.ex); },
  'ex-menu': (el) => {
    const e = exById(el.dataset.id);
    const used = isUsed(e.id);
    openSheet(`<h2>${esc(e.name)}</h2><div class="menu-list">
      <button data-act="edit-ex" data-id="${esc(e.id)}">Endre navn / kategori</button>
      <button data-act="toggle-hide-ex" data-id="${esc(e.id)}">${e.hidden ? 'Vis i øvelsesvelgeren' : 'Skjul fra øvelsesvelgeren'}</button>
      ${used ? `<button data-act="stats-from-editor" data-id="${esc(e.id)}">Se fremgang</button>` : `<button class="danger" data-act="delete-ex" data-id="${esc(e.id)}">Slett øvelse</button>`}
    </div>${used ? '<p class="small muted" style="margin-top:10px">Øvelser som er brukt i økter kan skjules, men ikke slettes.</p>' : ''}`);
  },
  'edit-ex': (el) => openNewExerciseForm('', 'settings', exById(el.dataset.id)),
  'toggle-hide-ex': (el) => {
    const e = db.exercises.find((x) => x.id === el.dataset.id);
    e.hidden = !e.hidden;
    save(); closeSheet(); renderExercises();
  },
  'delete-ex': (el) => {
    const id = el.dataset.id;
    if (DEFAULT_EXERCISES.some((d) => d.id === id)) db.deletedDefaults.push(id);
    db.exercises = db.exercises.filter((x) => x.id !== id);
    save(); closeSheet(); renderExercises();
  },
  export: exportData,
  'export-csv': openCsvExport,
  'csv-range': (el) => setCsvRange(el.dataset.v),
  'csv-go': () => {
    const { from, to } = csvRangeValues();
    if (!csvCount(from, to)) return;
    closeSheet();
    exportCsv(from, to);
  },
  wipe: async () => {
    if (!(await askConfirm('Alle økter og egne øvelser blir slettet. Dette kan ikke angres.\nTa gjerne en eksport først.', { title: 'Slette alle data?', ok: 'Fortsett', danger: true }))) return;
    if (!(await askConfirm('Siste sjanse – alt blir borte for godt.', { title: 'Er du helt sikker?', ok: 'Slett alt', danger: true }))) return;
    localStorage.removeItem(STORE_KEY);
    db = load();
    save();
    location.hash = '#/';
    route();
    toast('Alle data er slettet');
  },
  install: async () => {
    if (!installPromptEvent) return;
    installPromptEvent.prompt();
    await installPromptEvent.userChoice.catch(() => {});
    installPromptEvent = null;
    route();
  },
};

document.addEventListener('click', (ev) => {
  const el = ev.target.closest('[data-act]');
  if (!el) return;
  const fn = actions[el.dataset.act];
  if (fn) { ev.preventDefault(); fn(el); }
});

document.addEventListener('input', (ev) => {
  const t = ev.target;
  if (t.matches('[data-search]')) { renderPickerList(t.value); return; }
  if (t.matches('[data-tpl-name]')) { if (tplDraft) tplDraft.name = t.value; return; }
  if (t.matches('[data-hist-q]')) { histUI.q = t.value; renderHistoryResults(); return; }
  const d = db.draft;
  if (!d) return;
  if (t.dataset.w) {
    const k = t.dataset.w;
    d[k] = k === 'date' || k === 'note' ? t.value : num(t.value);
    saveSoon();
    return;
  }
  if (t.dataset.e == null || !t.dataset.f) return;
  const en = d.entries[+t.dataset.e];
  if (!en) return;
  const f = t.dataset.f;
  if (t.dataset.s != null) {
    const v = num(t.value);
    en.sets[+t.dataset.s][f] = f === 'reps' && v != null ? Math.round(v) : v;
  } else if (t.dataset.a != null) {
    en.attempts[+t.dataset.a].weight = num(t.value);
  } else if (f === 'note') {
    en.note = t.value;
  } else {
    // Kondisjon: økta selv, et segment (data-g) eller et drag (data-iv)
    const g = t.dataset.g, iv = t.dataset.iv;
    const obj = g != null ? en.segments[+g] : iv != null ? en.intervals[+iv] : en;
    const cfg = exCfg(exById(en.exerciseId));
    const unit = unitOf(en, cfg);
    const scope = `input[data-e="${t.dataset.e}"]${g != null ? `[data-g="${g}"]` : iv != null ? `[data-iv="${iv}"]` : ':not([data-g]):not([data-iv])'}`;
    const pair = (key) => {
      const mn = num(document.querySelector(`${scope}[data-f="${key}min"]`)?.value);
      const sc = num(document.querySelector(`${scope}[data-f="${key}sec"]`)?.value);
      return mn == null && sc == null ? null : Math.round((mn || 0) * 60 + (sc || 0));
    };
    const pm = f.match(/^(t|r|p|q)(min|sec)$/);
    if (pm && pm[1] === 't') obj.timeSec = pair('t');
    else if (pm && pm[1] === 'r') obj.restSec = pair('r');
    else if (pm && pm[1] === 'p') { const s = pair('p'); obj.speedKmh = s ? 1800 / s : null; }
    else if (pm && pm[1] === 'q') { const s = pair('q'); obj.speedKmh = s ? 3600 / s : null; }
    else if (f === 'segmin') { const v = num(t.value); obj.timeSec = v == null ? null : Math.round(v * 60); }
    else if (f === 'dist') obj.distanceKm = fromUnit(num(t.value), unit);
    else obj[f] = num(t.value);
    if (cfg.pace && (f === 'speedKmh' || (pm && pm[1] === 'q'))) syncSpeedInputs(scope, obj.speedKmh, f === 'speedKmh' ? 'speedKmh' : 'q');
    if (obj !== en) {
      const h = document.querySelector(`[data-hint="${t.dataset.e}-${g != null ? 'g' + g : 'i' + iv}"]`);
      if (h) h.textContent = partHint(obj.timeSec, obj.distanceKm, obj.speedKmh, cfg, unit);
    }
  }
  const der = document.querySelector(`[data-derived="${t.dataset.e}"]`);
  if (der) {
    if (en.mode === 'max') der.textContent = maxDerived(en, bestOf(historyFor(en.exerciseId, d.id), 'tested'));
    else if (!en.sets) der.textContent = derivedText(en);
  }
  saveSoon();
});

// Enter i et sett-felt hopper til neste felt
document.addEventListener('keydown', (ev) => {
  if (ev.key !== 'Enter' || !ev.target.matches('#view input[data-f]')) return;
  ev.preventDefault();
  const inputs = [...document.querySelectorAll('#view input[data-f]')];
  const i = inputs.indexOf(ev.target);
  if (inputs[i + 1]) inputs[i + 1].focus(); else ev.target.blur();
});

document.addEventListener('change', (ev) => {
  if (ev.target.matches('[data-hist-f]')) { histUI[ev.target.dataset.histF] = ev.target.value; renderHistory(); return; }
  if (ev.target.matches('[data-import]') && ev.target.files[0]) importData(ev.target.files[0]);
});

document.addEventListener('submit', (ev) => {
  const form = ev.target;
  if (form.dataset.form !== 'exercise' && form.dataset.form !== 'folder') return;
  ev.preventDefault();
  const name = form.elements.name.value.trim();
  if (!name) return;
  const id = form.dataset.id;
  if (form.dataset.form === 'folder') { saveFolderForm(form, name, id); return; }
  const dupe = db.exercises.find((e) => e.name.toLowerCase() === name.toLowerCase() && e.id !== id);
  if (dupe) { toast('Det finnes allerede en øvelse med det navnet'); return; }
  if (id) {
    const e = db.exercises.find((x) => x.id === id);
    e.name = name;
    e.cat = form.elements.cat.value;
    if (!isUsed(id)) e.kind = form.elements.kind.value;
    Object.assign(e, formExerciseProps(form, e.kind));
    e.edited = true;
    save(); closeSheet(); renderExercises();
    return;
  }
  const ex = { id: 'c-' + uid(), name, kind: form.elements.kind.value, cat: form.elements.cat.value, custom: true };
  Object.assign(ex, formExerciseProps(form, ex.kind));
  db.exercises.push(ex);
  save();
  if (form.dataset.then === 'picker') {
    // Ny øvelse fra velgeren: marker den som valgt og gå tilbake til velgeren
    if (!pickerSel.includes(ex.id)) pickerSel.push(ex.id);
    openExercisePicker(true);
    toast(`«${ex.name}» er laget og valgt`);
  }
  else { closeSheet(); renderExercises(); }
});

document.addEventListener('keydown', (ev) => { if (ev.key === 'Escape') closeSheet(); });

/* ---------- Installasjon / offline ---------- */
let installPromptEvent = null;
const isIOS = () => /iPhone|iPad|iPod/i.test(navigator.userAgent);
const isStandalone = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  installPromptEvent = e;
  if (!location.hash || location.hash === '#/' || location.hash === '#/mer') route();
});
if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
}

route();

// Fjern introskjermen når uttoningen er ferdig (reserve etter 4 sek)
(() => {
  const splash = document.getElementById('splash');
  if (!splash) return;
  const remove = () => splash.remove();
  splash.addEventListener('animationend', (e) => { if (e.animationName === 'splash-out') remove(); });
  splash.addEventListener('click', () => { splash.style.transition = 'opacity .2s'; splash.style.opacity = '0'; setTimeout(remove, 200); });
  setTimeout(remove, 4000);
})();
