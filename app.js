/* ============================================================
   MOHABOXE — Application
   ============================================================ */
(() => {
"use strict";

/* ---------- Outils ---------- */
const $ = (s, r = document) => r.querySelector(s);
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const nf = (n, d = 0) => (Math.round(n * 10 ** d) / 10 ** d).toLocaleString("fr-BE", { maximumFractionDigits: d });
const norm = s => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

function iso(d) { return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); }
function parse(s) { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); }
function addDays(s, n) { const d = parse(s); d.setDate(d.getDate() + n); return iso(d); }
function diffDays(a, b) { return Math.round((parse(b) - parse(a)) / 86400000); }
function realToday() {
  const q = new URLSearchParams(location.search).get("date");
  return q && /^\d{4}-\d{2}-\d{2}$/.test(q) ? q : iso(new Date());
}
const fmtLong = s => parse(s).toLocaleDateString("fr-BE", { weekday: "long", day: "numeric", month: "long" });
const fmtShort = s => parse(s).toLocaleDateString("fr-BE", { day: "numeric", month: "short" });
const fmtFull = s => parse(s).toLocaleDateString("fr-BE", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
const mmss = s => Math.floor(s / 60) + ":" + String(Math.round(s % 60)).padStart(2, "0");
const ytUrl = q => "https://www.youtube.com/results?search_query=" + encodeURIComponent(q);
const UNIT = { kg: "kg", reps: "reps", s: "s", cm: "cm" };
const MEALS = { pdj: "Petit-déjeuner", dej: "Déjeuner", col: "Collation", din: "Dîner" };
const TOTAL_DAYS = diffDays(PLAN.start, PLAN.end) + 1;

/* ---------- Stockage ---------- */
const KEY = "mohaboxe_v1";
function defaultState() {
  return {
    v: 1,
    settings: { poidsDepart: PLAN.poidsDepart, poidsObjectif: PLAN.poidsObjectif },
    dayType: {}, lifts: {}, seance: {}, boxe: {}, food: {}, water: {}, weights: {},
    recents: [], trophies: {}, timerCfg: { r: 3, w: 180, rest: 60 }, lastExport: null
  };
}
function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return defaultState();
    const s = JSON.parse(raw);
    const d = defaultState();
    for (const k of Object.keys(d)) if (s[k] === undefined) s[k] = d[k];
    return s;
  } catch (e) { return defaultState(); }
}
let state = load();
function save() {
  try { localStorage.setItem(KEY, JSON.stringify(state)); }
  catch (e) { toast("Impossible d’enregistrer : mémoire du téléphone pleine ?"); }
}

/* ---------- Logique du programme ---------- */
function dayInfo(d) {
  const idx = diffDays(PLAN.start, d);
  const inChallenge = idx >= 0 && d <= PLAN.end;
  const week = idx >= 0 ? Math.floor(idx / 7) + 1 : 0;
  let phase = "fondation";
  if (idx >= 0) phase = PHASE_PAR_SEMAINE[Math.min(week, 14)] || "decharge";
  return { idx, inChallenge, week, phase, before: idx < 0, after: d > PLAN.end };
}
function plannedType(d) { return PLAN.onDays.includes(parse(d).getDay()) ? "ON" : "OFF"; }
function dayType(d) { return state.dayType[d] || plannedType(d); }
function mondayOf(d) { const wd = parse(d).getDay(); return addDays(d, -((wd + 6) % 7)); }
function sessionLetter(d) {
  if (dayType(d) !== "ON") return null;
  const mon = mondayOf(d);
  const ons = [];
  for (let i = 0; i < 7; i++) { const x = addDays(mon, i); if (dayType(x) === "ON") ons.push(x); }
  const i = ons.indexOf(d);
  return ["A", "B", "C"][i] || "X";
}
function sortedDates(obj) { return Object.keys(obj).sort(); }
function prevLift(id, d) {
  const ds = sortedDates(state.lifts).filter(x => x < d).reverse();
  for (const x of ds) { const v = state.lifts[x][id]; if (v != null) return { date: x, val: v }; }
  return null;
}
function bestBefore(id, d) {
  let b = null;
  for (const x of sortedDates(state.lifts)) { if (x >= d) break; const v = state.lifts[x][id]; if (v != null) b = b == null ? v : Math.max(b, v); }
  return b;
}
function isPR(id, d) {
  const ex = EXOS[id]; if (!ex || ex.unit === "s") return false;
  const v = state.lifts[d]?.[id]; if (v == null) return false;
  const b = bestBefore(id, d); return b != null && v > b;
}
function roundTo(v, ex) { const q = ex.step > 0 ? ex.step : 1; return Math.max(q, Math.round(v / q) * q); }
function suggest(id, d) {
  const ex = EXOS[id], ph = dayInfo(d).phase;
  if (ex.unit === "s") return { fondation: 15, force: 20, puissance: 25, decharge: 15 }[ph];
  const prev = prevLift(id, d);
  if (!prev) return roundTo(ex.base * PHASES[ph].mult, ex);
  const pph = dayInfo(prev.date).phase;
  let v = prev.val;
  if (ph === "decharge" && pph !== "decharge") v = v * 0.8;
  else if (ph !== "decharge" && pph === "decharge") v = v / 0.8;
  else if (ph !== "decharge") v = v + ex.step;
  return roundTo(v, ex);
}
function boxeProg(id, week) {
  const p = BOXE[id].prog; let cur = p[0];
  for (const x of p) if (week >= x.des) cur = x;
  return cur;
}
function boxeFor(d) {
  const t = dayType(d), L = sessionLetter(d);
  if (t === "ON") return L && BOXE_ON[L] ? BOXE_ON[L] : ["corde", "shadow", "footwork"];
  const i = dayInfo(d).idx, n = BOXE_OFF.length;
  return BOXE_OFF[((i % n) + n) % n];
}
function targets(d) { return PLAN.cibles[dayType(d)]; }
function foodTotals(d) {
  const t = { kcal: 0, p: 0, c: 0, f: 0 };
  for (const it of state.food[d] || []) { t.kcal += it.kcal; t.p += it.p; t.c += it.c; t.f += it.f; }
  return t;
}
function weightEntries() { return sortedDates(state.weights).map(d => ({ d, v: state.weights[d] })); }
function avg7(d) {
  const vals = []; for (let i = 0; i < 7; i++) { const v = state.weights[addDays(d, -i)]; if (v != null) vals.push(v); }
  return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
}

/* ---------- Points & trophées ---------- */
function gatherStats() {
  const s = { sessions: 0, pr: 0, waterDays: 0, kcalDays: 0, protDays: 0, corde: 0, boxeDone: 0, weights: 0, bestWeek: 0, lost: 0, reached: false };
  const weekCount = {};
  for (const [d, x] of Object.entries(state.seance)) if (x.done) { s.sessions++; const m = mondayOf(d); weekCount[m] = (weekCount[m] || 0) + 1; }
  s.bestWeek = Math.max(0, ...Object.values(weekCount));
  const best = {};
  for (const d of sortedDates(state.lifts)) for (const [id, v] of Object.entries(state.lifts[d])) {
    if (EXOS[id] && EXOS[id].unit !== "s" && best[id] != null && v > best[id]) s.pr++;
    best[id] = best[id] == null ? v : Math.max(best[id], v);
  }
  for (const v of Object.values(state.water)) if (v >= PLAN.eauVerres) s.waterDays++;
  for (const d of Object.keys(state.food)) {
    if (!(state.food[d] || []).length) continue;
    const t = foodTotals(d), c = targets(d);
    if (t.kcal >= c.kcal * 0.85 && t.kcal <= c.kcal * 1.1) s.kcalDays++;
    if (t.p >= c.p * 0.9) s.protDays++;
  }
  for (const x of Object.values(state.boxe)) { const ids = Object.keys(x).filter(k => x[k]); s.boxeDone += ids.length; if (x.corde) s.corde++; }
  const ws = weightEntries(); s.weights = ws.length;
  if (ws.length) { s.lost = state.settings.poidsDepart - ws[ws.length - 1].v; s.reached = ws[ws.length - 1].v <= state.settings.poidsObjectif; }
  return s;
}
const TROPHEES = [
  { id: "gong", ic: "🔔", nom: "Premier gong", d: "Terminer ta 1re séance", t: s => s.sessions >= 1 },
  { id: "record", ic: "🏅", nom: "Record !", d: "Battre un record perso", t: s => s.pr >= 1 },
  { id: "semaine", ic: "🔥", nom: "Semaine parfaite", d: "3 séances dans la semaine", t: s => s.bestWeek >= 3 },
  { id: "regulier", ic: "📅", nom: "Régulier", d: "10 séances terminées", t: s => s.sessions >= 10 },
  { id: "machine", ic: "⚙️", nom: "Machine", d: "30 séances terminées", t: s => s.sessions >= 30 },
  { id: "hydrate", ic: "💧", nom: "Hydraté", d: "7 jours à 2 L d’eau", t: s => s.waterDays >= 7 },
  { id: "assiette", ic: "🍽️", nom: "Assiette de champion", d: "7 jours dans la cible", t: s => s.kcalDays >= 7 },
  { id: "corde", ic: "🪢", nom: "Corde d’acier", d: "20 séances de corde", t: s => s.corde >= 20 },
  { id: "boxeur", ic: "🥊", nom: "Boxeur", d: "50 exercices de boxe", t: s => s.boxeDone >= 50 },
  { id: "pesees", ic: "📊", nom: "Suivi de pro", d: "14 pesées notées", t: s => s.weights >= 14 },
  { id: "moins5", ic: "⚖️", nom: "−5 kg", d: "5 kg de perdus", t: s => s.lost >= 5 },
  { id: "objectif", ic: "🏆", nom: "Objectif atteint", d: "Poids cible atteint", t: s => s.reached }
];
function computePoints() {
  const B = BAREME, t = { muscu: 0, boxe: 0, nutri: 0, suivi: 0, trophees: 0 };
  for (const x of Object.values(state.seance)) {
    if (x.warm) t.muscu += B.echauffement;
    if (x.stretch) t.muscu += B.etirements;
    if (x.done) t.muscu += B.seance;
  }
  const best = {};
  for (const d of sortedDates(state.lifts)) for (const [id, v] of Object.entries(state.lifts[d])) {
    t.muscu += B.exoLog;
    if (EXOS[id] && EXOS[id].unit !== "s" && best[id] != null && v > best[id]) t.muscu += B.record;
    best[id] = best[id] == null ? v : Math.max(best[id], v);
  }
  for (const [d, x] of Object.entries(state.boxe)) {
    const done = Object.keys(x).filter(k => x[k]);
    t.boxe += done.length * B.boxeExo;
    if (boxeFor(d).every(id => x[id])) t.boxe += B.boxeComplet;
  }
  for (const v of Object.values(state.water)) if (v >= PLAN.eauVerres) t.nutri += B.eau;
  for (const d of Object.keys(state.food)) {
    if (!(state.food[d] || []).length) continue;
    const f = foodTotals(d), c = targets(d);
    if (f.kcal >= c.kcal * 0.85 && f.kcal <= c.kcal * 1.1) t.nutri += B.kcalCible;
    if (f.p >= c.p * 0.9) t.nutri += B.proteines;
  }
  t.suivi = Object.keys(state.weights).length * B.pesee;
  const st = gatherStats();
  const got = TROPHEES.filter(x => x.t(st));
  t.trophees = got.length * B.trophee;
  const total = t.muscu + t.boxe + t.nutri + t.suivi + t.trophees;
  return { total, t, got: got.map(x => x.id) };
}
function gradeOf(p) {
  let g = GRADES[0], next = null;
  for (let i = 0; i < GRADES.length; i++) if (p >= GRADES[i].min) { g = GRADES[i]; next = GRADES[i + 1] || null; }
  return { g, next };
}
function updatePill() {
  const { total } = computePoints();
  $("#ppVal").textContent = nf(total) + " pts";
  $("#ppGrade").textContent = gradeOf(total).g.nom;
}
function commit(fn) {
  const before = computePoints();
  fn(); save();
  const after = computePoints();
  const diff = after.total - before.total;
  const fresh = after.got.filter(id => !before.got.includes(id));
  updatePill();
  if (fresh.length) {
    const tr = TROPHEES.find(x => x.id === fresh[0]);
    toast(`${tr.ic} Trophée débloqué : ${tr.nom} (+${BAREME.trophee} pts)`, true);
  } else if (diff > 0) toast(`+${diff} pts`, true);
  const gb = gradeOf(before.total).g, ga = gradeOf(after.total).g;
  if (ga.min > gb.min) setTimeout(() => toast(`🥊 Nouveau grade : ${ga.nom} !`, true), 1800);
}

/* ---------- Toast ---------- */
let toastTimer;
function toast(msg, gold) {
  const el = $("#toast"); el.textContent = msg; el.className = "toast" + (gold ? " gold" : ""); el.hidden = false;
  clearTimeout(toastTimer); toastTimer = setTimeout(() => (el.hidden = true), 2200);
}

/* ---------- Navigation ---------- */
let today = realToday();
let cur = today;
let tab = sessionStorage.getItem("mb_tab") || "muscu";
let factShift = 0;

function setTab(t) {
  tab = t; sessionStorage.setItem("mb_tab", t);
  document.querySelectorAll(".tabbar button").forEach(b => b.classList.toggle("active", b.dataset.tab === t));
  render(); window.scrollTo(0, 0);
}
document.querySelectorAll(".tabbar button").forEach(b => b.addEventListener("click", () => setTab(b.dataset.tab)));
$("#dPrev").addEventListener("click", () => { cur = addDays(cur, -1); factShift = 0; render(); });
$("#dNext").addEventListener("click", () => { cur = addDays(cur, 1); factShift = 0; render(); });
$("#dToday").addEventListener("click", () => { cur = today; factShift = 0; render(); });
$("#pointsPill").addEventListener("click", () => { setTab("stats"); setTimeout(() => $("#pointsCard")?.scrollIntoView({ behavior: "smooth" }), 60); });

function renderDatebar() {
  const info = dayInfo(cur);
  const fl = fmtLong(cur); $("#dLabel").textContent = (cur === today ? "Aujourd’hui · " : "") + (cur === today ? fl : fl.charAt(0).toUpperCase() + fl.slice(1));
  let sub;
  if (info.before) sub = `J−${-info.idx} avant le début du challenge`;
  else if (info.after) sub = "Challenge terminé";
  else sub = `Jour ${info.idx + 1}/${TOTAL_DAYS} · Semaine ${info.week} · ${PHASES[info.phase].nom} · ${dayType(cur)}`;
  $("#dSub").textContent = sub;
  $("#dToday").hidden = cur === today;
}

function render() {
  today = realToday();
  renderDatebar(); updatePill();
  const v = $("#view");
  if (tab === "muscu") v.innerHTML = viewMuscu();
  else if (tab === "boxe") v.innerHTML = viewBoxe();
  else if (tab === "food") v.innerHTML = viewFood();
  else { v.innerHTML = viewStats(); drawStats(); }
}

/* ---------- Le saviez-vous ---------- */
function factCard(cats) {
  const list = FAITS.filter(f => cats.includes(f.cat));
  const n = list.length, base = diffDays("2026-01-01", cur) * 7 + cats.length;
  const f = list[(((base + factShift) % n) + n) % n];
  return `<div class="card fact">
    <div class="row between"><span class="eyebrow">💡 Le saviez-vous ? · ${esc(f.cat)}</span></div>
    <p>${esc(f.txt)}</p>
    <button class="btn sm ghost" data-act="factNext">Une autre anecdote ›</button>
  </div>`;
}

/* ---------- Bandeaux ---------- */
function banners() {
  const info = dayInfo(cur);
  if (info.before) return `<div class="banner"><b>Le combat commence dans ${-info.idx} jour${-info.idx > 1 ? "s" : ""}</b>
    <span class="muted small">Premier gong le ${fmtFull(PLAN.start)}. Tu peux déjà explorer l’appli, noter ton poids de départ et préparer tes repas.</span></div>`;
  if (info.after) return `<div class="banner"><b>Challenge terminé</b><span class="muted small">Retrouve tout ton parcours dans l’onglet Stats.</span></div>`;
  if (cur === PLAN.start) return `<div class="banner"><b>Jour 1 : premier gong !</b><span class="muted small">Pèse-toi ce matin, à jeun, et note ton poids dans Stats : c’est ta référence pour les 3 mois.</span></div>`;
  if (cur === PLAN.end) return `<div class="banner"><b>Jour du bilan</b><span class="muted small">Pèse-toi à jeun et compare avec le 5 octobre. Séance légère : savoure le chemin parcouru.</span></div>`;
  return "";
}

/* ---------- Vue : Musculation ---------- */
function viewMuscu() {
  const d = cur, info = dayInfo(d), type = dayType(d), L = sessionLetter(d);
  let h = banners();

  if (type === "OFF") {
    let next = null;
    for (let i = 1; i <= 7; i++) { const x = addDays(d, i); if (dayType(x) === "ON") { next = x; break; } }
    const nl = next ? sessionLetter(next) : null;
    h += `<div class="card hero">
      <span class="eyebrow">Jour OFF · récupération</span>
      <h1>Repos du guerrier</h1>
      <p>Les muscles se construisent pendant le repos. Aujourd’hui, pas de musculation :</p>
      <ul class="list">
        <li>15 min de <b>boxe douce</b> (onglet Boxe)</li>
        <li>30 à 45 min de marche, à ton rythme</li>
        <li>Au moins 7 heures de sommeil</li>
        <li>Tes 2 litres d’eau et tes 170 g de protéines</li>
      </ul>
      <div class="chips"><span class="chip off">JOUR OFF</span>${info.inChallenge ? `<span class="chip">Semaine ${info.week} · ${PHASES[info.phase].nom}</span>` : ""}</div>
    </div>`;
    if (next && nl && SEANCES[nl]) h += `<div class="card"><span class="eyebrow">Prochaine séance</span>
      <div class="card-title" style="margin-top:6px">${esc(fmtLong(next))} — Séance ${nl}</div>
      <p class="muted small" style="margin:0">${esc(SEANCES[nl].titre)} — ${esc(SEANCES[nl].description)}</p></div>`;
    h += `<div class="card"><div class="row"><div class="grow"><b>Séance décalée ?</b><div class="muted small">Si tu t’entraînes finalement aujourd’hui, passe la journée en ON : la séance et les objectifs caloriques s’adaptent.</div></div></div>
      <button class="btn block red" style="margin-top:12px" data-act="setON">Faire ma séance aujourd’hui</button></div>`;
    h += `<div class="card"><span class="eyebrow">Échauffement boxe douce</span><ul class="list">${ECHAUFFEMENT_BOXE.map(x => `<li>${esc(x)}</li>`).join("")}</ul>
      <button class="btn block" style="margin-top:12px" data-act="goTab" data-tab="boxe">🥊 Aller à la boxe douce</button></div>`;
    return h + factCard(["Histoire", "Champions", "Boxe"]);
  }

  if (!SEANCES[L]) {
    h += `<div class="card hero"><span class="eyebrow">Jour ON · séance bonus</span><h1>Tes 3 séances sont déjà prévues</h1>
      <p>Cette semaine compte déjà trois jours ON. Pour aujourd’hui : l’onglet Boxe (corde, shadow, jeu de jambes) ou 30 minutes de cardio doux. Pas de quatrième séance de musculation : la récupération fait partie du programme.</p>
      <div class="chips"><span class="chip on">JOUR ON</span></div>
      <button class="btn block" style="margin-top:14px" data-act="goTab" data-tab="boxe">🥊 Aller à la boxe</button></div>`;
    return h + factCard(["Histoire", "Champions", "Boxe"]);
  }

  const S = SEANCES[L], ph = info.phase, sc = state.seance[d] || {};
  const nbLogged = S.exos.filter(id => state.lifts[d]?.[id] != null).length;
  h += `<div class="card hero">
    <span class="eyebrow">Séance ${L} · ≈ 55 min, échauffement et étirements compris</span>
    <h1>${esc(S.titre)}</h1>
    <p>${esc(S.description)}</p>
    <div class="chips"><span class="chip on">JOUR ON</span><span class="chip">${info.inChallenge ? "Semaine " + info.week + " · " : ""}Phase ${PHASES[ph].nom}</span><span class="chip">${nbLogged}/${S.exos.length} exercices notés</span></div>
    <p class="small" style="margin-top:12px">${esc(PHASES[ph].texte)}</p>
  </div>`;

  h += checkCard("warm", "Échauffement · 8 à 10 min", "À faire avant la première charge", S.echauffement, sc.warm);

  S.exos.forEach((id, i) => {
    const ex = EXOS[id], val = state.lifts[d]?.[id], prev = prevLift(id, d), sug = suggest(id, d);
    const scheme = SCHEMAS[ph][ex.type], u = UNIT[ex.unit];
    const pr = isPR(id, d);
    h += `<div class="card exo ${val != null ? "logged" : ""}">
      ${pr ? `<span class="pr-badge">RECORD</span>` : ""}
      <div class="exo-head"><div class="exo-num">${i + 1}</div><div class="grow">
        <div class="exo-name">${esc(ex.nom)}</div><div class="exo-target">${esc(ex.cible)}</div></div></div>
      <div class="exo-scheme"><span class="chip gold">${esc(scheme)}</span><span class="chip">Repos ${mmss(REPOS[ex.type])}</span>${ex.note ? `<span class="chip">${esc(ex.note)}</span>` : ""}${ex.unit === "reps" ? `<span class="chip">note ta meilleure série</span>` : ""}</div>
      <p class="exo-tip">${esc(ex.conseil)}</p>
      <div class="exo-grid">
        <div class="stat-mini"><div class="k">Suggéré</div><div class="v">${nf(sug, 1)} <small>${u}</small></div></div>
        <div class="stat-mini"><div class="k">Précédent</div><div class="v">${prev ? nf(prev.val, 1) + ` <small>${u} · ${esc(fmtShort(prev.date))}</small>` : `— <small>1re fois</small>`}</div></div>
      </div>
      <div class="exo-actions">
        <label class="input-wrap"><input type="number" inputmode="decimal" step="0.5" min="0" data-lift="${id}" value="${val ?? ""}" placeholder="Réalisé"><span class="unit">${u}</span></label>
        <button class="btn sm" data-act="rest" data-sec="${REPOS[ex.type]}" data-name="${esc(ex.nom)}" aria-label="Minuteur de repos">⏱</button>
        <a class="btn sm yt" href="${ytUrl(ex.yt)}" target="_blank" rel="noopener">▶ Vidéo</a>
      </div>
    </div>`;
  });

  h += checkCard("stretch", "Étirements · 5 min", "Après la séance, en douceur, sans forcer", S.etirements, sc.stretch);
  h += `<button class="btn block ${sc.done ? "done" : "red"}" data-act="seanceDone" style="margin-bottom:12px">${sc.done ? "✓ Séance terminée — bravo !" : "🥊 J’ai terminé ma séance (+50 pts)"}</button>`;
  h += `<p class="muted small" style="margin:0 0 14px">Progression : si toutes les répétitions passent proprement, la charge suggérée augmente d’un cran à la séance suivante. Si ce n’est pas le cas, garde la même charge.</p>`;
  return h + factCard(["Histoire", "Champions", "Boxe"]);
}
function checkCard(key, title, sub, items, done) {
  return `<details class="card checkcard">
    <summary><button class="tick ${done ? "done" : ""}" data-act="check" data-key="${key}" aria-label="Marquer comme fait">✓</button>
      <div class="grow"><b>${esc(title)}</b><div class="muted small">${esc(sub)}</div></div><span class="chev">›</span></summary>
    <ul>${items.map(x => `<li>${esc(x)}</li>`).join("")}</ul>
  </details>`;
}

/* ---------- Vue : Boxe ---------- */
function viewBoxe() {
  const d = cur, info = dayInfo(d), type = dayType(d), L = sessionLetter(d);
  const week = Math.max(1, info.week || 1);
  const ids = boxeFor(d), done = state.boxe[d] || {};
  let h = banners();
  const on = type === "ON";
  h += `<div class="card hero">
    <span class="eyebrow">${on ? "Boxe · jour ON" : "Boxe douce · jour OFF"}</span>
    <h1>${on ? "Finisher boxe" : "Boxe douce"}</h1>
    <p>${on ? "2 exercices intenses, juste après la musculation (≈ 12 à 15 min) ou plus tard dans la journée."
            : "3 exercices à 50 % de l’intensité, chez toi, en 15 minutes environ : technique, équilibre et réflexes. Si tu es vraiment fatigué, le repos complet est aussi un entraînement."}</p>
    <div class="chips"><span class="chip ${on ? "on" : "off"}">JOUR ${type}</span><span class="chip">${ids.filter(i => done[i]).length}/${ids.length} faits</span></div>
  </div>`;
  h += `<div class="card"><span class="eyebrow">Échauffement</span>
    <ul class="list">${(on ? ["Tu sors de la musculation : 1 min de sautillements sur place suffit.", "Rotations des poignets et des épaules : 30 s."] : ECHAUFFEMENT_BOXE).map(x => `<li>${esc(x)}</li>`).join("")}</ul></div>`;

  ids.forEach(id => {
    const b = BOXE[id], p = boxeProg(id, week), isDone = !!done[id];
    const theme = id === "shadow" ? THEMES_SHADOW[(week - 1) % THEMES_SHADOW.length] : null;
    h += `<div class="card ${isDone ? "exo logged" : ""}">
      <div class="bx-head"><div class="grow"><div class="exo-name">${esc(b.nom)}</div><div class="exo-target">${esc(b.desc)}</div></div>
        <div class="bx-format">${p.r} × ${mmss(p.w)}</div></div>
      <div class="exo-scheme"><span class="chip">Repos ${mmss(p.rest)}</span>${on ? "" : `<span class="chip off">intensité 50 %</span>`}</div>
      ${theme ? `<p class="bx-theme">🎯 Thème de la semaine : ${esc(theme)}</p>` : ""}
      <p class="exo-tip" style="margin-top:10px">${esc(b.conseil)}</p>
      <div class="bx-actions">
        <button class="btn red" data-act="bxTimer" data-id="${id}">⏱ Minuteur</button>
        <a class="btn yt" href="${ytUrl(b.yt)}" target="_blank" rel="noopener">▶ Vidéo</a>
        <button class="btn ${isDone ? "done" : ""}" data-act="bxDone" data-id="${id}">${isDone ? "✓ Fait" : "Marquer fait"}</button>
      </div>
    </div>`;
  });

  const c = state.timerCfg;
  h += `<div class="card"><span class="eyebrow">Minuteur de rounds libre</span>
    <div class="preset-grid">
      <button class="btn sm" data-act="preset" data-r="3" data-w="180" data-rest="60">Amateur<br>3 × 3:00</button>
      <button class="btn sm" data-act="preset" data-r="6" data-w="120" data-rest="60">Endurance<br>6 × 2:00</button>
      <button class="btn sm" data-act="preset" data-r="8" data-w="20" data-rest="10">Tabata<br>8 × 0:20</button>
    </div>
    <div class="preset-grid">
      <div class="num-field"><label>Rounds</label><input type="number" inputmode="numeric" min="1" max="20" id="tcR" value="${c.r}"></div>
      <div class="num-field"><label>Travail (s)</label><input type="number" inputmode="numeric" min="5" max="600" id="tcW" value="${c.w}"></div>
      <div class="num-field"><label>Repos (s)</label><input type="number" inputmode="numeric" min="0" max="300" id="tcRest" value="${c.rest}"></div>
    </div>
    <button class="btn block red" style="margin-top:12px" data-act="freeTimer">🔔 Lancer</button></div>`;
  return h + factCard(["Boxe", "Champions", "Histoire"]);
}

/* ---------- Vue : Alimentation ---------- */
function viewFood() {
  const d = cur, type = dayType(d), c = targets(d), t = foodTotals(d), w = state.water[d] || 0;
  const pct = c.kcal ? t.kcal / c.kcal : 0;
  const R = 56, C = 2 * Math.PI * R;
  const ringCol = pct > 1.1 ? "#ff6b6d" : pct >= 0.85 ? "#34c759" : "#f5b83d";
  const rest = c.kcal - t.kcal;
  const macro = (lab, v, tg, col) => {
    const p = tg ? v / tg : 0;
    return `<div class="macro"><div class="top"><span>${lab}</span><span><b>${nf(v)}</b> / ${tg} g · ${nf(p * 100)} %</span></div>
      <div class="bar"><i style="width:${clamp(p * 100, 0, 100)}%;background:${col}"></i></div></div>`;
  };
  let h = banners();
  h += `<div class="card"><div class="switch-row">
      <div class="grow"><b>Type de journée</b><div class="muted small">ON : ${nf(PLAN.cibles.ON.kcal)} kcal · OFF : ${nf(PLAN.cibles.OFF.kcal)} kcal.<br>Séance déplacée ? Bascule l’interrupteur.</div></div>
      <button class="switch ${type === "ON" ? "is-on" : ""}" data-act="toggleDay" role="switch" aria-checked="${type === "ON"}" aria-label="Basculer jour ON ou OFF">
        <span class="knob"></span><span class="lbl"><span>OFF</span><span>ON</span></span></button>
    </div>${state.dayType[d] ? `<div class="muted small" style="margin-top:8px">↺ Modifié à la main (prévu : ${plannedType(d)})</div>` : ""}</div>`;

  h += `<div class="card"><div class="ring-wrap">
      <div class="ring"><svg viewBox="0 0 132 132"><circle cx="66" cy="66" r="${R}" fill="none" stroke="#24242b" stroke-width="12"/>
        <circle cx="66" cy="66" r="${R}" fill="none" stroke="${ringCol}" stroke-width="12" stroke-linecap="round"
        stroke-dasharray="${C}" stroke-dashoffset="${C * (1 - clamp(pct, 0, 1))}" style="transition:stroke-dashoffset .5s"/></svg>
        <div class="center"><div class="big">${nf(t.kcal)}</div><div class="lab">/ ${nf(c.kcal)} kcal</div><div class="lab" style="color:${ringCol};font-weight:700">${nf(pct * 100)} %</div></div></div>
      <div class="macros">
        ${macro("Protéines", t.p, c.p, "#e5383b")}
        ${macro("Glucides", t.c, c.c, "#f5b83d")}
        ${macro("Lipides", t.f, c.f, "#3987e5")}
      </div></div>
      <div class="muted small" style="margin-top:10px;text-align:center">${rest >= 0 ? `Il te reste <b style="color:var(--text)">${nf(rest)} kcal</b> aujourd’hui` : `Dépassement de <b style="color:#ff6b6d">${nf(-rest)} kcal</b>`}</div>
    </div>`;

  h += `<div class="card"><div class="row between"><b>💧 Hydratation</b><span class="muted small"><b style="color:var(--text)">${nf(w * 0.25, 2)} L</b> / 2 L</span></div>
    <div class="water">${Array.from({ length: PLAN.eauVerres }, (_, i) => `<button class="glass ${i < w ? "full" : ""}" data-act="water" data-i="${i}" aria-label="Verre ${i + 1}"></button>`).join("")}</div>
    <div class="muted small" style="margin-top:6px">1 verre = 25 cl. Répartis-les dans la journée, pas tout le soir.</div></div>`;

  const items = state.food[d] || [];
  for (const [k, lab] of Object.entries(MEALS)) {
    const list = items.filter(x => x.meal === k);
    const kc = list.reduce((a, b) => a + b.kcal, 0);
    h += `<div class="card"><div class="meal-head"><h3>${lab}</h3><span class="muted small">${nf(kc)} kcal</span></div>
      ${list.length ? list.map(x => `<div class="food-item">
          <div class="fi-main" data-act="editFood" data-id="${x.id}"><div class="fi-name">${esc(x.nom)}</div>
          <div class="fi-sub">${x.g ? nf(x.g) + " g · " : ""}P ${nf(x.p)} · G ${nf(x.c)} · L ${nf(x.f)}</div></div>
          <div class="fi-kcal">${nf(x.kcal)}</div>
          <button class="icon-btn" data-act="delFood" data-id="${x.id}" aria-label="Supprimer">✕</button></div>`).join("")
        : `<div class="empty">Rien pour l’instant.</div>`}
      <button class="btn sm" style="margin-top:10px" data-act="addFood" data-meal="${k}">＋ Ajouter</button></div>`;
  }
  return h + factCard(["Alimentation"]);
}

/* ---------- Vue : Statistiques ---------- */
function viewStats() {
  const ws = weightEntries(), st = state.settings;
  const last = ws.length ? ws[ws.length - 1] : null;
  const a7 = last ? avg7(last.d) : null;
  const trend = trendPerWeek();
  let h = "";
  const wv = state.weights[cur];
  h += `<div class="card"><span class="eyebrow">Pesée du ${esc(fmtLong(cur))}</span>
    <div class="weight-form" style="margin-top:10px">
      <label class="input-wrap"><input type="number" inputmode="decimal" step="0.1" min="30" max="250" id="wIn" value="${wv ?? ""}" placeholder="Poids du jour"><span class="unit">kg</span></label>
      <button class="btn red" data-act="saveWeight">Enregistrer</button>
      ${wv != null ? `<button class="icon-btn" style="height:auto" data-act="delWeight" aria-label="Supprimer la pesée">✕</button>` : ""}
    </div>
    <div class="muted small" style="margin-top:8px">Le matin, à jeun, après être passé aux toilettes : toujours dans les mêmes conditions.</div></div>`;

  const lost = last ? st.poidsDepart - (a7 ?? last.v) : 0;
  const remain = last ? (a7 ?? last.v) - st.poidsObjectif : st.poidsDepart - st.poidsObjectif;
  h += `<div class="kpis">
    <div class="kpi"><div class="k">Poids actuel</div><div class="v">${last ? nf(a7 ?? last.v, 1) : "—"}<small>kg</small></div><div class="d">moyenne sur 7 jours</div></div>
    <div class="kpi"><div class="k">Perdu</div><div class="v">${last ? (lost >= 0 ? "−" : "+") + nf(Math.abs(lost), 1) : "—"}<small>kg</small></div><div class="d">depuis ${nf(st.poidsDepart, 1)} kg</div></div>
    <div class="kpi"><div class="k">Reste</div><div class="v">${last ? nf(Math.max(0, remain), 1) : nf(remain, 1)}<small>kg</small></div><div class="d">objectif ${nf(st.poidsObjectif, 1)} kg</div></div>
    <div class="kpi"><div class="k">Rythme</div><div class="v">${trend != null ? (trend <= 0 ? "−" : "+") + nf(Math.abs(trend), 2) : "—"}<small>kg/sem</small></div><div class="d">${trendNote(trend, a7 ?? last?.v)}</div></div>
  </div>`;

  h += `<div class="card"><div class="card-title">Évolution du poids</div>
    <div class="chart" id="chWeight"></div>
    <div class="legend"><span><i style="background:var(--blue)"></i>Moyenne 7 jours</span><span><i class="dot" style="background:var(--orange)"></i>Pesées</span><span><i class="dash"></i>Trajectoire idéale</span></div></div>`;

  const logged = Object.keys(EXOS).filter(id => Object.values(state.lifts).some(x => x[id] != null));
  const sel = sessionStorage.getItem("mb_lift") && logged.includes(sessionStorage.getItem("mb_lift")) ? sessionStorage.getItem("mb_lift") : logged[0];
  h += `<div class="card"><div class="card-title">Charges soulevées</div>
    ${logged.length ? `<select class="select" id="liftSel">${logged.map(id => `<option value="${id}" ${id === sel ? "selected" : ""}>${esc(EXOS[id].nom)}</option>`).join("")}</select>
    <div class="chart" id="chLift"></div>` : `<div class="empty">Note tes charges dans l’onglet Muscu : les courbes apparaîtront ici.</div>`}</div>`;

  h += `<div class="card"><div class="card-title">Calories · 14 derniers jours</div>
    <div class="chart" id="chKcal"></div>
    <div class="legend"><span><i style="background:var(--blue);height:8px;width:8px;border-radius:2px"></i>Calories consommées</span><span><i style="background:var(--text-2)"></i>Cible du jour (ON/OFF)</span></div></div>`;

  const P = computePoints(), { g, next } = gradeOf(P.total);
  const prog = next ? (P.total - g.min) / (next.min - g.min) : 1;
  h += `<div class="card" id="pointsCard"><div class="row between"><div><span class="eyebrow">Grade actuel</span><div class="card-title" style="font-size:30px;margin:2px 0 0;color:var(--gold)">${g.nom}</div></div>
      <div style="text-align:right"><div class="card-title" style="font-size:30px;margin:0">${nf(P.total)}</div><span class="muted small">points</span></div></div>
    <div class="grade-bar"><i style="width:${clamp(prog * 100, 2, 100)}%"></i></div>
    <div class="muted small">${next ? `Encore <b style="color:var(--text)">${nf(next.min - P.total)} pts</b> pour devenir ${next.nom}` : "Grade maximal atteint : respect."}</div>
    <div class="breakdown"><div><span>🏋️ Muscu</span><b>${nf(P.t.muscu)}</b></div><div><span>🥊 Boxe</span><b>${nf(P.t.boxe)}</b></div>
      <div><span>🍽️ Nutrition</span><b>${nf(P.t.nutri)}</b></div><div><span>⚖️ Pesées</span><b>${nf(P.t.suivi)}</b></div></div>
    <details style="margin-top:12px"><summary class="muted small" style="cursor:pointer">Comment gagner des points ?</summary>
      <ul class="list small">
        <li>Séance terminée : +${BAREME.seance} · exercice noté : +${BAREME.exoLog} · record perso : +${BAREME.record}</li>
        <li>Échauffement : +${BAREME.echauffement} · étirements : +${BAREME.etirements}</li>
        <li>Exercice de boxe : +${BAREME.boxeExo} · boxe du jour complète : +${BAREME.boxeComplet}</li>
        <li>2 L d’eau : +${BAREME.eau} · calories dans la cible (85 à 110 %) : +${BAREME.kcalCible} · protéines ≥ 90 % : +${BAREME.proteines}</li>
        <li>Pesée : +${BAREME.pesee} · trophée : +${BAREME.trophee}</li>
      </ul></details></div>`;

  h += `<div class="card"><div class="card-title">Trophées · ${P.got.length}/${TROPHEES.length}</div><div class="trophies">
    ${TROPHEES.map(x => `<div class="trophy ${P.got.includes(x.id) ? "got" : ""}"><div class="ic">${x.ic}</div><div class="n">${esc(x.nom)}</div><div class="d">${esc(x.d)}</div></div>`).join("")}</div></div>`;

  h += `<div class="card"><div class="card-title">Réglages & sauvegarde</div>
    <div class="form-grid">
      <div class="num-field"><label>Poids de départ (kg)</label><input type="number" step="0.1" id="setDep" value="${st.poidsDepart}"></div>
      <div class="num-field"><label>Poids objectif (kg)</label><input type="number" step="0.1" id="setObj" value="${st.poidsObjectif}"></div>
    </div>
    <button class="btn block" style="margin-top:10px" data-act="saveSettings">Enregistrer les réglages</button>
    <hr class="sep">
    <div class="muted small" style="margin-bottom:10px">Les données restent sur ce téléphone. Exporte une sauvegarde régulièrement (changement de téléphone, cache vidé…).<br>Dernière sauvegarde : <b style="color:var(--text)">${state.lastExport ? esc(fmtFull(state.lastExport)) : "jamais"}</b></div>
    <div class="row"><button class="btn grow" data-act="export">⬇️ Exporter</button><button class="btn grow" data-act="import">⬆️ Importer</button></div>
    <input type="file" id="importFile" accept="application/json,.json" hidden></div>`;
  return h;
}
function trendPerWeek() {
  const ws = weightEntries().filter(x => diffDays(x.d, cur) <= 21 && x.d <= cur);
  if (ws.length < 4) return null;
  const xs = ws.map(x => diffDays(ws[0].d, x.d)), ys = ws.map(x => x.v);
  const n = xs.length, mx = xs.reduce((a, b) => a + b) / n, my = ys.reduce((a, b) => a + b) / n;
  let num = 0, den = 0; for (let i = 0; i < n; i++) { num += (xs[i] - mx) * (ys[i] - my); den += (xs[i] - mx) ** 2; }
  return den ? (num / den) * 7 : null;
}
function trendNote(tr, w) {
  if (tr == null) return "4 pesées sur 3 semaines requises";
  if (tr >= 0) return "en hausse ou stable";
  const left = w - state.settings.poidsObjectif;
  if (left <= 0) return "objectif atteint !";
  const days = Math.round(left / (-tr / 7));
  return "objectif vers le " + fmtShort(addDays(cur, days));
}

/* ---------- Graphiques (SVG) ---------- */
function niceTicks(min, max, count = 4) {
  const span = max - min || 1, raw = span / count;
  const steps = [0.5, 1, 2, 2.5, 5, 10, 20, 25, 50, 100, 200, 250, 500, 1000];
  const step = steps.find(s => s >= raw) || raw;
  const lo = Math.floor(min / step) * step, hi = Math.ceil(max / step) * step;
  const ticks = []; for (let v = lo; v <= hi + 1e-9; v += step) ticks.push(+v.toFixed(2));
  return { lo, hi, ticks };
}
function chart(el, o) {
  if (!el) return;
  const W = Math.max(280, el.clientWidth || 320), H = o.h || 210;
  const pl = 40, pr = 12, pt = 12, pb = 26, iw = W - pl - pr, ih = H - pt - pb;
  const { lo, hi, ticks } = niceTicks(o.yMin, o.yMax);
  const X = x => pl + (o.xMax === o.xMin ? iw / 2 : ((x - o.xMin) / (o.xMax - o.xMin)) * iw);
  const Y = y => pt + ih - ((y - lo) / (hi - lo || 1)) * ih;
  let s = `<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="${esc(o.label)}">`;
  for (const t of ticks) s += `<line x1="${pl}" x2="${W - pr}" y1="${Y(t)}" y2="${Y(t)}" stroke="#2a2a31" stroke-width="1"/>
    <text x="${pl - 6}" y="${Y(t) + 4}" fill="#8b8b96" font-size="11" text-anchor="end">${nf(t, 1)}</text>`;
  for (const xt of o.xTicks || []) s += `<text x="${X(xt.x)}" y="${H - 7}" fill="#8b8b96" font-size="11" text-anchor="middle">${esc(xt.l)}</text>`;
  for (const r of o.refs || []) {
    if (r.type === "seg") s += `<line x1="${X(r.x1)}" y1="${Y(r.y1)}" x2="${X(r.x2)}" y2="${Y(r.y2)}" stroke="#8b8b96" stroke-width="1.5" stroke-dasharray="5 4"/>`;
    else { s += `<line x1="${pl}" x2="${W - pr}" y1="${Y(r.y)}" y2="${Y(r.y)}" stroke="#b4b4bd" stroke-width="1"/>
      <text x="${W - pr}" y="${Y(r.y) - 5}" fill="#b4b4bd" font-size="11" text-anchor="end">${esc(r.label)}</text>`; }
  }
  if (o.bars) {
    const bw = Math.max(6, (iw / (o.xMax - o.xMin + 1)) * 0.58);
    for (const b of o.bars) {
      if (b.y > 0) {
        const y0 = Y(Math.max(lo, 0)), y1 = Y(b.y), hgt = Math.max(2, y0 - y1);
        s += `<rect x="${X(b.x) - bw / 2}" y="${y0 - hgt}" width="${bw}" height="${hgt}" rx="4" fill="${o.barColor}"/>`;
        if (hgt > 6) s += `<rect x="${X(b.x) - bw / 2}" y="${y0 - 4}" width="${bw}" height="4" fill="${o.barColor}"/>`;
      }
      if (b.t) s += `<line x1="${X(b.x) - bw / 2 - 3}" x2="${X(b.x) + bw / 2 + 3}" y1="${Y(b.t)}" y2="${Y(b.t)}" stroke="#d4d4da" stroke-width="2" stroke-linecap="round"/>`;
    }
  }
  for (const se of o.series || []) {
    const pts = se.pts;
    if (se.kind === "line" && pts.length > 1) s += `<path d="${pts.map((p, i) => (i ? "L" : "M") + X(p.x).toFixed(1) + " " + Y(p.y).toFixed(1)).join(" ")}" fill="none" stroke="${se.color}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>`;
    if (se.kind === "dots" || (se.kind === "line" && se.markers) || (se.kind === "line" && pts.length === 1))
      for (const p of pts) s += `<circle cx="${X(p.x)}" cy="${Y(p.y)}" r="4" fill="${se.color}" stroke="#1b1b20" stroke-width="2"/>`;
  }
  s += `<line id="xh" x1="0" x2="0" y1="${pt}" y2="${pt + ih}" stroke="#b4b4bd" stroke-width="1" opacity="0"/>`;
  s += `<rect x="${pl}" y="${pt}" width="${iw}" height="${ih}" fill="transparent" class="hit"/></svg><div class="tip" hidden></div>`;
  el.innerHTML = s;
  const svg = el.querySelector("svg"), tip = el.querySelector(".tip"), xh = el.querySelector("#xh");
  const xs = [...new Set(o.hoverXs)].sort((a, b) => a - b);
  if (!xs.length) return;
  const move = ev => {
    const r = svg.getBoundingClientRect();
    const px = (ev.clientX - r.left) * (W / r.width);
    const xv = o.xMin + ((px - pl) / iw) * (o.xMax - o.xMin);
    let best = xs[0]; for (const x of xs) if (Math.abs(x - xv) < Math.abs(best - xv)) best = x;
    const html = o.tip(best); if (!html) return;
    xh.setAttribute("x1", X(best)); xh.setAttribute("x2", X(best)); xh.setAttribute("opacity", ".5");
    tip.innerHTML = html; tip.hidden = false;
    const sx = X(best) * (r.width / W), tw = tip.offsetWidth;
    tip.style.left = clamp(sx - tw / 2, 0, r.width - tw) + "px"; tip.style.top = "-8px";
  };
  const leave = () => { tip.hidden = true; xh.setAttribute("opacity", "0"); };
  svg.addEventListener("pointermove", move); svg.addEventListener("pointerdown", move); svg.addEventListener("pointerleave", leave);
}
function drawStats() {
  const st = state.settings, ws = weightEntries();
  // Poids
  const first = ws.length && ws[0].d < PLAN.start ? ws[0].d : PLAN.start;
  const xMax = diffDays(first, PLAN.end);
  const avg = ws.map(w => ({ x: diffDays(first, w.d), y: avg7(w.d), d: w.d }));
  const dots = ws.map(w => ({ x: diffDays(first, w.d), y: w.v, d: w.d }));
  const allY = [st.poidsDepart, st.poidsObjectif, ...ws.map(w => w.v)];
  const xTicks = [];
  const m0 = parse(first); m0.setDate(1);
  for (let m = new Date(m0); iso(m) <= PLAN.end; m.setMonth(m.getMonth() + 1)) { const s = iso(m); if (s >= first) xTicks.push({ x: diffDays(first, s), l: m.toLocaleDateString("fr-BE", { month: "short" }) }); }
  const xs0 = diffDays(first, PLAN.start);
  chart($("#chWeight"), {
    label: "Évolution du poids", xMin: 0, xMax, yMin: Math.min(...allY) - 1, yMax: Math.max(...allY) + 1, xTicks,
    refs: [{ type: "seg", x1: xs0, y1: st.poidsDepart, x2: diffDays(first, PLAN.end), y2: st.poidsObjectif }, { y: st.poidsObjectif, label: "Objectif " + nf(st.poidsObjectif, 1) + " kg" }],
    series: [{ kind: "dots", color: "#d95926", pts: dots }, { kind: "line", color: "#3987e5", pts: avg }],
    hoverXs: dots.map(p => p.x),
    tip: x => { const p = dots.find(q => q.x === x); if (!p) return ""; const a = avg7(p.d);
      return `<b>${esc(fmtLong(p.d))}</b><span class="sw" style="background:#d95926"></span>Pesée ${nf(p.y, 1)} kg<br><span class="sw" style="background:#3987e5"></span>Moyenne 7 j ${nf(a, 1)} kg`; }
  });
  if (!ws.length) $("#chWeight").insertAdjacentHTML("beforeend", `<div class="empty">Ta première pesée apparaîtra ici, face à la trajectoire idéale.</div>`);

  // Charges
  const sel = $("#liftSel");
  if (sel) {
    const id = sel.value, ex = EXOS[id];
    const pts = sortedDates(state.lifts).filter(d => state.lifts[d][id] != null).map((d, i) => ({ x: i, y: state.lifts[d][id], d }));
    const ys = pts.map(p => p.y);
    chart($("#chLift"), {
      label: ex.nom, xMin: 0, xMax: Math.max(1, pts.length - 1), yMin: Math.min(...ys) * 0.9, yMax: Math.max(...ys) * 1.05, h: 190,
      xTicks: pts.length <= 8 ? pts.map(p => ({ x: p.x, l: fmtShort(p.d) })) : [pts[0], pts[Math.floor(pts.length / 2)], pts[pts.length - 1]].map(p => ({ x: p.x, l: fmtShort(p.d) })),
      series: [{ kind: "line", markers: true, color: "#3987e5", pts }],
      hoverXs: pts.map(p => p.x),
      tip: x => { const p = pts.find(q => q.x === x); return p ? `<b>${esc(fmtLong(p.d))}</b>${nf(p.y, 1)} ${UNIT[ex.unit]}${isPR(id, p.d) ? " · 🏅 record" : ""}` : ""; }
    });
  }

  // Calories
  const days = Array.from({ length: 14 }, (_, i) => addDays(cur, i - 13));
  const bars = days.map((d, i) => ({ x: i, y: foodTotals(d).kcal, t: targets(d).kcal, d }));
  chart($("#chKcal"), {
    label: "Calories des 14 derniers jours", xMin: 0, xMax: 13, yMin: 0, yMax: Math.max(2600, ...bars.map(b => b.y)) , h: 190,
    xTicks: [0, 4, 9, 13].map(i => ({ x: i, l: fmtShort(days[i]) })), bars, barColor: "#3987e5",
    hoverXs: bars.map(b => b.x),
    tip: x => { const b = bars[x]; const f = foodTotals(b.d);
      return `<b>${esc(fmtLong(b.d))} · ${dayType(b.d)}</b>${nf(b.y)} / ${nf(b.t)} kcal<br>P ${nf(f.p)} g · G ${nf(f.c)} g · L ${nf(f.f)} g`; }
  });
}
let resizeT;
window.addEventListener("resize", () => { clearTimeout(resizeT); resizeT = setTimeout(() => { if (tab === "stats") drawStats(); }, 200); });

/* ---------- Événements de la vue ---------- */
$("#view").addEventListener("click", e => {
  const el = e.target.closest("[data-act]"); if (!el) return;
  const act = el.dataset.act, d = cur;
  switch (act) {
    case "check": {
      e.preventDefault(); e.stopPropagation();
      const k = el.dataset.key;
      commit(() => { const s = state.seance[d] || (state.seance[d] = {}); s[k] = !s[k]; });
      render(); break;
    }
    case "seanceDone": commit(() => { const s = state.seance[d] || (state.seance[d] = {}); s.done = !s.done; }); render(); break;
    case "goTab": setTab(el.dataset.tab); break;
    case "setON": commit(() => setDayType(d, "ON")); render(); window.scrollTo(0, 0); break;
    case "factNext": factShift++; render(); break;
    case "rest": openTimer({ title: "Repos · " + el.dataset.name, rounds: 1, work: 0, rest: +el.dataset.sec, restOnly: true }); break;
    case "bxTimer": {
      const id = el.dataset.id, p = boxeProg(id, Math.max(1, dayInfo(d).week || 1));
      openTimer({ title: BOXE[id].nom, rounds: p.r, work: p.w, rest: p.rest, onDone: () => { commit(() => { const b = state.boxe[d] || (state.boxe[d] = {}); b[id] = true; }); render(); } });
      break;
    }
    case "bxDone": { const id = el.dataset.id; commit(() => { const b = state.boxe[d] || (state.boxe[d] = {}); b[id] = !b[id]; }); render(); break; }
    case "preset": $("#tcR").value = el.dataset.r; $("#tcW").value = el.dataset.w; $("#tcRest").value = el.dataset.rest; break;
    case "freeTimer": {
      const r = clamp(+$("#tcR").value || 3, 1, 20), w = clamp(+$("#tcW").value || 180, 5, 600), rs = clamp(+$("#tcRest").value || 0, 0, 300);
      state.timerCfg = { r, w, rest: rs }; save();
      openTimer({ title: "Minuteur de rounds", rounds: r, work: w, rest: rs }); break;
    }
    case "toggleDay": commit(() => setDayType(d, dayType(d) === "ON" ? "OFF" : "ON")); render(); break;
    case "water": { const i = +el.dataset.i, w = state.water[d] || 0; commit(() => { state.water[d] = w === i + 1 ? i : i + 1; }); render(); break; }
    case "addFood": openAdd(el.dataset.meal); break;
    case "editFood": openEdit(el.dataset.id); break;
    case "delFood": commit(() => { state.food[d] = (state.food[d] || []).filter(x => x.id !== el.dataset.id); }); render(); break;
    case "saveWeight": {
      const v = parseFloat(String($("#wIn").value).replace(",", "."));
      if (!(v > 30 && v < 250)) { toast("Entre un poids valide"); break; }
      commit(() => { state.weights[d] = Math.round(v * 10) / 10; }); render(); break;
    }
    case "delWeight": commit(() => { delete state.weights[d]; }); render(); break;
    case "saveSettings": {
      const a = parseFloat($("#setDep").value), b = parseFloat($("#setObj").value);
      if (!(a > 30 && b > 30)) { toast("Valeurs invalides"); break; }
      commit(() => { state.settings.poidsDepart = a; state.settings.poidsObjectif = b; }); render(); toast("Réglages enregistrés"); break;
    }
    case "export": exportData(); break;
    case "import": $("#importFile").click(); break;
  }
});
$("#view").addEventListener("change", e => {
  const t = e.target;
  if (t.dataset.lift) {
    const v = parseFloat(String(t.value).replace(",", "."));
    commit(() => {
      const L = state.lifts[cur] || (state.lifts[cur] = {});
      if (isNaN(v) || v < 0) delete L[t.dataset.lift]; else L[t.dataset.lift] = v;
      if (!Object.keys(L).length) delete state.lifts[cur];
    });
    const y = window.scrollY; render(); window.scrollTo(0, y);
  } else if (t.id === "liftSel") { sessionStorage.setItem("mb_lift", t.value); drawStats(); }
  else if (t.id === "importFile") importData(t.files[0]);
});
function setDayType(d, v) { if (v === plannedType(d)) delete state.dayType[d]; else state.dayType[d] = v; }

/* ---------- Sauvegarde ---------- */
function exportData() {
  state.lastExport = today; save();
  const blob = new Blob([JSON.stringify(state, null, 1)], { type: "application/json" });
  const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `mohaboxe-sauvegarde-${today}.json`;
  document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  toast("Sauvegarde exportée"); render();
}
function importData(file) {
  if (!file) return;
  const r = new FileReader();
  r.onload = () => {
    try {
      const s = JSON.parse(r.result);
      if (!s || s.v !== 1 || typeof s.lifts !== "object") throw new Error();
      if (!confirm("Remplacer toutes les données actuelles par cette sauvegarde ?")) return;
      const d = defaultState(); for (const k of Object.keys(d)) if (s[k] === undefined) s[k] = d[k];
      state = s; save(); render(); toast("Sauvegarde restaurée");
    } catch (e) { toast("Ce fichier n’est pas une sauvegarde Mohaboxe"); }
  };
  r.readAsText(file);
}

/* ---------- Feuille modale ---------- */
function openSheet(html) {
  $("#sheet").innerHTML = `<div class="grab"></div>` + html; $("#sheet").hidden = false; $("#sheetBg").hidden = false;
  document.body.style.overflow = "hidden";
}
function closeSheet() {
  stopScan(); $("#sheet").hidden = true; $("#sheetBg").hidden = true; document.body.style.overflow = "";
}
$("#sheetBg").addEventListener("click", closeSheet);

/* ---------- Ajout d’aliment ---------- */
let add = null;
function openAdd(meal) { add = { meal, mode: "search", q: "", results: [], product: null, qty: 100, loading: false, msg: "" }; renderAdd(); }
function localMatches(q) {
  const nq = norm(q).trim();
  const pool = [...state.recents.map(r => ({ ...r, recent: true })), ...ALIMENTS.map(a => ({ ...a, local: true }))];
  const seen = new Set(), out = [];
  for (const p of pool) {
    const key = norm(p.nom + "|" + (p.marque || ""));
    if (seen.has(key)) continue;
    if (!nq ? p.recent : norm(p.nom + " " + (p.marque || "")).includes(nq)) { seen.add(key); out.push(p); }
  }
  return out.slice(0, nq ? 25 : 10);
}
function resultRow(p, i) {
  return `<button class="result" data-pick="${i}">${p.img ? `<img src="${esc(p.img)}" alt="" loading="lazy">` : ""}
    <div class="r-main"><div class="r-name">${esc(p.nom)}</div><div class="r-sub">${p.marque ? esc(p.marque) + " · " : ""}${nf(p.kcal)} kcal · P ${nf(p.p, 1)} · G ${nf(p.c, 1)} · L ${nf(p.f, 1)} /100 g</div></div></button>`;
}
function renderAdd() {
  const a = add;
  const seg = `<div class="seg">${[["search", "🔎 Rechercher"], ["scan", "▦ Scanner"], ["manual", "✎ Manuel"]].map(([m, l]) =>
    `<button data-mode="${m}" class="${a.mode === m || (a.mode === "qty" && m === a.from) ? "active" : ""}">${l}</button>`).join("")}</div>`;
  let body = "";
  if (a.mode === "search") {
    a.results = localMatches(a.q);
    body = `<input class="field" id="fq" placeholder="Poulet, skyr, riz, une marque…" value="${esc(a.q)}" autocomplete="off">
      <div id="fres">${resultsHtml()}</div>`;
  } else if (a.mode === "scan") {
    body = `<div class="scan-box"><video id="scanVideo" playsinline muted></video><div class="frame"></div></div>
      <p class="muted small" id="scanMsg" style="text-align:center">${esc(a.msg || "Place le code-barres dans le cadre rouge.")}</p>
      <div class="row"><input class="field grow" id="eanIn" inputmode="numeric" placeholder="…ou tape le code EAN"><button class="btn red" data-sheet="ean">OK</button></div>`;
  } else if (a.mode === "manual") {
    body = `<p class="muted small" style="margin-top:0">Valeurs pour la portion que tu as mangée.</p>
      <input class="field" id="mNom" placeholder="Nom (ex. : sandwich de la cantine)">
      <div class="form-grid" style="margin-top:8px">
        <div class="num-field"><label>Calories</label><input type="number" inputmode="decimal" id="mK"></div>
        <div class="num-field"><label>Protéines (g)</label><input type="number" inputmode="decimal" id="mP"></div>
        <div class="num-field"><label>Glucides (g)</label><input type="number" inputmode="decimal" id="mC"></div>
        <div class="num-field"><label>Lipides (g)</label><input type="number" inputmode="decimal" id="mF"></div>
      </div>
      <button class="btn block red" style="margin-top:12px" data-sheet="manualAdd">Ajouter</button>`;
  } else if (a.mode === "qty") {
    const p = a.product;
    body = `<button class="btn sm ghost" data-sheet="back">‹ Retour</button>
      <div class="result" style="margin-top:8px">${p.img ? `<img src="${esc(p.img)}" alt="">` : ""}<div class="r-main"><div class="r-name">${esc(p.nom)}</div>
        <div class="r-sub">${p.marque ? esc(p.marque) + " · " : ""}pour 100 g : ${nf(p.kcal)} kcal · P ${nf(p.p, 1)} · G ${nf(p.c, 1)} · L ${nf(p.f, 1)}</div></div></div>
      <div class="qty-row"><label class="input-wrap"><input type="number" inputmode="decimal" id="qIn" value="${a.qty}" min="1"><span class="unit">g</span></label></div>
      <div class="qty-presets">${[...new Set([p.portion, 30, 50, 100, 150, 200, 250].filter(Boolean))].map(g => `<button class="btn sm" data-sheet="qp" data-g="${g}">${g} g${g === p.portion ? " (portion)" : ""}</button>`).join("")}</div>
      <div class="macro-preview" id="qPrev">${qtyPreview()}</div>
      <button class="btn block red" data-sheet="qtyAdd">Ajouter au ${esc(MEALS[a.meal].toLowerCase())}</button>`;
  }
  openSheet(`<h2>Ajouter · ${esc(MEALS[a.meal])}</h2>${seg}${body}`);
  if (a.mode === "search") { const i = $("#fq"); i.focus(); i.setSelectionRange(i.value.length, i.value.length); }
  if (a.mode === "scan") startScan();
}
function resultsHtml() {
  const a = add, q = a.q.trim();
  let h = "";
  if (!q && a.results.length) h += `<div class="sub-title">Récents</div>`;
  if (!q && !a.results.length) h += `<div class="sub-title">Aliments courants</div>`;
  const list = !q && !a.results.length ? (a.results = ALIMENTS.slice(0, 12).map(x => ({ ...x, local: true }))) : a.results;
  h += list.map(resultRow).join("");
  if (q) {
    h += `<button class="btn block" style="margin-top:12px" data-sheet="offSearch">🌍 Chercher « ${esc(q)} » sur Open Food Facts</button>`;
    if (a.loading) h += `<div class="spinner"></div>`;
    if (a.msg) h += `<p class="muted small" style="text-align:center">${esc(a.msg)}</p>`;
    if (a.off && a.off.length) { h += `<div class="sub-title">Open Food Facts</div>` + a.off.map((p, i) => resultRow(p, "o" + i)).join(""); }
  }
  return h;
}
function qtyPreview() {
  const p = add.product, g = add.qty || 0, k = g / 100;
  return `<div><b>${nf(p.kcal * k)}</b><span>kcal</span></div><div><b>${nf(p.p * k, 1)}</b><span>protéines</span></div><div><b>${nf(p.c * k, 1)}</b><span>glucides</span></div><div><b>${nf(p.f * k, 1)}</b><span>lipides</span></div>`;
}
$("#sheet").addEventListener("input", e => {
  if (!add) return;
  if (e.target.id === "fq") { add.q = e.target.value; add.off = null; add.msg = ""; add.results = localMatches(add.q); $("#fres").innerHTML = resultsHtml(); }
  if (e.target.id === "qIn") { add.qty = parseFloat(e.target.value) || 0; $("#qPrev").innerHTML = qtyPreview(); }
  if (e.target.id === "eqIn") { const it = editItem(); if (it) $("#qPrev").innerHTML = editPreview(it, parseFloat(e.target.value) || 0); }
});
$("#sheet").addEventListener("keydown", e => {
  if (e.key === "Enter" && e.target.id === "fq" && add.q.trim()) offSearch();
  if (e.key === "Enter" && e.target.id === "eanIn") lookupEAN(e.target.value.trim());
});
$("#sheet").addEventListener("click", e => {
  const m = e.target.closest("[data-mode]");
  if (m && add) { stopScan(); add.mode = m.dataset.mode; add.msg = ""; renderAdd(); return; }
  const pk = e.target.closest("[data-pick]");
  if (pk && add) {
    const k = pk.dataset.pick;
    const p = k[0] === "o" ? add.off[+k.slice(1)] : add.results[+k];
    add.from = add.mode; add.product = p; add.qty = p.portion || 100; add.mode = "qty"; renderAdd(); return;
  }
  const b = e.target.closest("[data-sheet]"); if (!b) return;
  const act = b.dataset.sheet;
  if (act === "back") { add.mode = add.from || "search"; renderAdd(); }
  else if (act === "qp") { add.qty = +b.dataset.g; $("#qIn").value = add.qty; $("#qPrev").innerHTML = qtyPreview(); }
  else if (act === "qtyAdd") addProduct(add.product, add.qty);
  else if (act === "offSearch") offSearch();
  else if (act === "ean") lookupEAN($("#eanIn").value.trim());
  else if (act === "manualAdd") {
    const nom = $("#mNom").value.trim() || "Ajout rapide";
    const n = id => parseFloat(String($(id).value).replace(",", ".")) || 0;
    const it = { id: uid(), meal: add.meal, nom, g: null, kcal: n("#mK"), p: n("#mP"), c: n("#mC"), f: n("#mF"), per: null };
    if (!it.kcal && (it.p || it.c || it.f)) it.kcal = it.p * 4 + it.c * 4 + it.f * 9;
    if (!it.kcal) { toast("Indique au moins les calories"); return; }
    commit(() => { (state.food[cur] || (state.food[cur] = [])).push(it); });
    closeSheet(); render();
  }
  else if (act === "saveEdit") {
    const it = editItem(), g = parseFloat($("#eqIn").value);
    if (it && g > 0) commit(() => { Object.assign(it, macrosFor(it.per, g), { g }); });
    closeSheet(); render();
  }
  else if (act === "delEdit") { const id = editId; commit(() => { state.food[cur] = (state.food[cur] || []).filter(x => x.id !== id); }); closeSheet(); render(); }
  else if (act === "close") closeSheet();
});
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
function macrosFor(per, g) { const k = g / 100; return { kcal: per.kcal * k, p: per.p * k, c: per.c * k, f: per.f * k }; }
function addProduct(p, g) {
  if (!(g > 0)) { toast("Indique une quantité"); return; }
  const per = { kcal: p.kcal, p: p.p, c: p.c, f: p.f };
  const it = { id: uid(), meal: add.meal, nom: p.nom, marque: p.marque || "", g, ...macrosFor(per, g), per };
  commit(() => {
    (state.food[cur] || (state.food[cur] = [])).push(it);
    const rec = { nom: p.nom, marque: p.marque || "", kcal: p.kcal, p: p.p, c: p.c, f: p.f, portion: p.portion || null, img: p.img || null, code: p.code || null };
    state.recents = [rec, ...state.recents.filter(r => !(r.nom === rec.nom && (r.marque || "") === rec.marque))].slice(0, 30);
  });
  closeSheet(); render();
}
let editId = null;
function editItem() { return (state.food[cur] || []).find(x => x.id === editId); }
function editPreview(it, g) { const m = macrosFor(it.per, g); return `<div><b>${nf(m.kcal)}</b><span>kcal</span></div><div><b>${nf(m.p, 1)}</b><span>protéines</span></div><div><b>${nf(m.c, 1)}</b><span>glucides</span></div><div><b>${nf(m.f, 1)}</b><span>lipides</span></div>`; }
function openEdit(id) {
  editId = id; add = null; const it = editItem(); if (!it) return;
  let body;
  if (it.per) body = `<div class="qty-row"><label class="input-wrap"><input type="number" inputmode="decimal" id="eqIn" value="${it.g}" min="1"><span class="unit">g</span></label></div>
    <div class="macro-preview" id="qPrev">${editPreview(it, it.g)}</div>
    <button class="btn block red" data-sheet="saveEdit">Enregistrer</button>`;
  else body = `<p class="muted">Ajout manuel : ${nf(it.kcal)} kcal · P ${nf(it.p)} · G ${nf(it.c)} · L ${nf(it.f)}</p>`;
  openSheet(`<h2>${esc(it.nom)}</h2><p class="muted small" style="margin-top:-6px">${esc(MEALS[it.meal])}${it.marque ? " · " + esc(it.marque) : ""}</p>${body}
    <button class="btn block" style="margin-top:8px" data-sheet="delEdit">🗑 Supprimer</button>`);
}

/* ---------- Open Food Facts ---------- */
const OFF_FIELDS = "code,product_name,product_name_fr,brands,nutriments,serving_quantity,image_front_small_url";
function fromOFF(p) {
  if (!p) return null;
  const n = p.nutriments || {};
  let kcal = n["energy-kcal_100g"];
  if (kcal == null && n["energy_100g"] != null) kcal = n["energy_100g"] / 4.184;
  if (kcal == null) return null;
  const num = v => (v == null || isNaN(+v) ? 0 : +v);
  const sq = parseFloat(p.serving_quantity);
  return {
    nom: (p.product_name_fr || p.product_name || "Produit sans nom").trim(), marque: (p.brands || "").split(",")[0].trim(),
    kcal: num(kcal), p: num(n.proteins_100g), c: num(n.carbohydrates_100g), f: num(n.fat_100g),
    portion: sq > 0 && sq < 2000 ? Math.round(sq) : null, img: p.image_front_small_url || null, code: p.code || null
  };
}
async function offSearch() {
  const q = add.q.trim(); if (!q) return;
  add.loading = true; add.msg = ""; add.off = null; $("#fres").innerHTML = resultsHtml();
  try {
    const url = `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(q)}&search_simple=1&action=process&json=1&page_size=24&sort_by=unique_scans_n&fields=${OFF_FIELDS}`;
    const r = await fetch(url); if (!r.ok) throw new Error();
    const j = await r.json();
    add.off = (j.products || []).map(fromOFF).filter(Boolean);
    add.msg = add.off.length ? "" : "Aucun produit trouvé avec des valeurs nutritionnelles.";
  } catch (e) { add.msg = "Open Food Facts ne répond pas (connexion ?). Réessaie ou utilise l’ajout manuel."; }
  add.loading = false;
  if (add.mode === "search" && $("#fres")) $("#fres").innerHTML = resultsHtml();
}
async function lookupEAN(code) {
  code = String(code || "").replace(/\D/g, "");
  if (code.length < 8) { toast("Code-barres incomplet"); return; }
  stopScan();
  const cached = state.recents.find(r => r.code === code);
  if (cached) { add.from = "scan"; add.product = cached; add.qty = cached.portion || 100; add.mode = "qty"; renderAdd(); return; }
  setScanMsg("Recherche du produit " + code + "…");
  try {
    const r = await fetch(`https://world.openfoodfacts.org/api/v2/product/${code}.json?fields=${OFF_FIELDS}`);
    const j = await r.json();
    const p = j.status === 1 ? fromOFF(j.product) : null;
    if (!p) {
      add.msg = j.status === 1 ? "Produit trouvé, mais sans valeurs nutritionnelles. Utilise l’ajout manuel." : `Produit ${code} inconnu d’Open Food Facts. Utilise l’ajout manuel.`;
      add.mode = "scan"; renderAdd(); stopScan(); setScanMsg(add.msg); return;
    }
    add.from = "scan"; add.product = p; add.qty = p.portion || 100; add.mode = "qty"; renderAdd();
  } catch (e) { setScanMsg("Pas de connexion à Open Food Facts. Réessaie plus tard."); }
}
function setScanMsg(t) { const m = $("#scanMsg"); if (m) m.textContent = t; }

/* ---------- Scanner de code-barres ---------- */
let scan = { stream: null, timer: null, reader: null, active: false };
async function startScan() {
  const video = $("#scanVideo"); if (!video) return;
  if (!navigator.mediaDevices?.getUserMedia) { setScanMsg("Caméra indisponible : tape le code ci-dessous."); return; }
  scan.active = true;
  try {
    if ("BarcodeDetector" in window) {
      let formats = ["ean_13", "ean_8", "upc_a", "upc_e"];
      try { const sup = await BarcodeDetector.getSupportedFormats(); formats = formats.filter(f => sup.includes(f)); } catch (e) {}
      if (!formats.length) throw new Error("nofmt");
      const det = new BarcodeDetector({ formats });
      scan.stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" } }, audio: false });
      if (!scan.active) return stopScan();
      video.srcObject = scan.stream; await video.play();
      const loop = async () => {
        if (!scan.active) return;
        try { const codes = await det.detect(video); if (codes.length) { beep(); lookupEAN(codes[0].rawValue); return; } } catch (e) {}
        scan.timer = setTimeout(loop, 220);
      };
      loop();
    } else {
      await loadZXing();
      if (!scan.active) return;
      const hints = new Map();
      hints.set(ZXing.DecodeHintType.POSSIBLE_FORMATS, [ZXing.BarcodeFormat.EAN_13, ZXing.BarcodeFormat.EAN_8, ZXing.BarcodeFormat.UPC_A, ZXing.BarcodeFormat.UPC_E]);
      scan.reader = new ZXing.BrowserMultiFormatReader(hints);
      await scan.reader.decodeFromConstraints({ video: { facingMode: { ideal: "environment" } } }, video, res => {
        if (res && scan.active) { beep(); lookupEAN(res.getText()); }
      });
    }
  } catch (e) {
    setScanMsg(e && e.name === "NotAllowedError" ? "Accès à la caméra refusé : autorise-le dans les réglages, ou tape le code." : "Scanner indisponible sur cet appareil : tape le code ci-dessous.");
  }
}
function stopScan() {
  scan.active = false; clearTimeout(scan.timer);
  if (scan.reader) { try { scan.reader.reset(); } catch (e) {} scan.reader = null; }
  if (scan.stream) { scan.stream.getTracks().forEach(t => t.stop()); scan.stream = null; }
}
let zxingP = null;
function loadZXing() {
  if (window.ZXing) return Promise.resolve();
  return zxingP || (zxingP = new Promise((res, rej) => {
    const s = document.createElement("script"); s.src = "https://unpkg.com/@zxing/library@0.21.3/umd/index.min.js";
    s.onload = res; s.onerror = () => { zxingP = null; rej(new Error("zxing")); }; document.head.appendChild(s);
  }));
}

/* ---------- Sons ---------- */
let actx = null;
function audio() { if (!actx) { try { actx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) {} } if (actx?.state === "suspended") actx.resume(); return actx; }
function tone(freq, start, dur, vol = 0.35, type = "sine") {
  const a = audio(); if (!a) return;
  const o = a.createOscillator(), g = a.createGain();
  o.type = type; o.frequency.value = freq; o.connect(g); g.connect(a.destination);
  const t = a.currentTime + start;
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.start(t); o.stop(t + dur + 0.05);
}
function bell(n = 1) { for (let i = 0; i < n; i++) { tone(1320, i * 0.38, 1.1, 0.3); tone(2640, i * 0.38, 0.6, 0.12); tone(660, i * 0.38, 1.2, 0.15); } }
function beep() { tone(1500, 0, 0.12, 0.25, "square"); }
function clap() { for (let i = 0; i < 3; i++) tone(2000, i * 0.16, 0.07, 0.25, "square"); }
function buzz(p) { try { navigator.vibrate?.(p); } catch (e) {} }

/* ---------- Minuteur ---------- */
let T = null;
function openTimer(o) {
  audio();
  const steps = [];
  if (!o.restOnly) steps.push({ kind: "prep", dur: 5, round: 1 });
  for (let r = 1; r <= o.rounds; r++) {
    if (o.work > 0) steps.push({ kind: "work", dur: o.work, round: r });
    if (o.rest > 0 && (r < o.rounds || o.restOnly)) steps.push({ kind: "rest", dur: o.rest, round: r });
  }
  T = { o, steps, i: -1, end: 0, left: 0, paused: false, iv: null, warned: false, lastSec: null, lock: null };
  $("#timer").hidden = false; document.body.style.overflow = "hidden";
  try { navigator.wakeLock?.request("screen").then(l => (T && (T.lock = l))).catch(() => {}); } catch (e) {}
  nextStep();
  T.iv = setInterval(tick, 200);
}
function nextStep() {
  T.i++; T.warned = false; T.lastSec = null;
  if (T.i >= T.steps.length) return finishTimer();
  const s = T.steps[T.i]; T.end = Date.now() + s.dur * 1000; T.paused = false;
  if (s.kind === "work") { bell(3); buzz([300, 120, 300]); }
  else if (s.kind === "rest") { bell(1); buzz(400); }
  paintTimer();
}
function tick() {
  if (!T || T.paused || T.i >= T.steps.length) return;
  const s = T.steps[T.i], left = Math.max(0, (T.end - Date.now()) / 1000);
  T.left = left;
  const sec = Math.ceil(left);
  if (s.kind === "work" && s.dur >= 30 && sec === 10 && !T.warned) { T.warned = true; clap(); }
  if ((s.kind === "rest" || s.kind === "prep") && sec <= 3 && sec > 0 && T.lastSec !== sec) { T.lastSec = sec; beep(); }
  if (left <= 0) return nextStep();
  paintTimer();
}
function paintTimer() {
  const el = $("#timer"), s = T.steps[T.i], o = T.o;
  const left = T.paused ? T.left : Math.max(0, (T.end - Date.now()) / 1000);
  const lab = { prep: "PRÊT ?", work: "BOXE !", rest: "REPOS" }[s.kind];
  const labRestOnly = o.restOnly ? "REPOS" : lab;
  el.className = "timer " + s.kind;
  el.innerHTML = `<div><div class="t-title">${esc(o.title)}</div><div class="t-round">${o.restOnly ? "Récupère avant la série suivante" : `Round ${s.round} / ${o.rounds}`}</div></div>
    <div><div class="t-phase">${labRestOnly}</div><div class="t-time">${mmss(Math.ceil(left))}</div></div>
    <div class="t-bar"><i style="width:${(1 - left / s.dur) * 100}%"></i></div>
    <div class="t-btns"><button class="btn" data-t="stop">Arrêter</button><button class="btn" data-t="skip">Passer</button><button class="btn red" data-t="pause">${T.paused ? "Reprendre" : "Pause"}</button></div>`;
}
function finishTimer() {
  clearInterval(T.iv); bell(2); buzz([500, 150, 500]);
  const o = T.o, el = $("#timer");
  el.className = "timer prep";
  el.innerHTML = `<div><div class="t-title">${esc(o.title)}</div></div>
    <div><div class="t-phase">${o.restOnly ? "C’EST REPARTI" : "TERMINÉ !"}</div><div class="t-time" style="font-size:90px">${o.restOnly ? "💪" : "🥊"}</div></div><div></div>
    <div class="t-btns">${o.onDone ? `<button class="btn red" data-t="done">✓ Marquer comme fait</button>` : ""}<button class="btn" data-t="close">Fermer</button></div>`;
}
function closeTimer() {
  if (T) { clearInterval(T.iv); try { T.lock?.release(); } catch (e) {} }
  T = null; $("#timer").hidden = true; document.body.style.overflow = "";
}
$("#timer").addEventListener("click", e => {
  const b = e.target.closest("[data-t]"); if (!b || !T) return;
  const a = b.dataset.t;
  if (a === "pause") {
    if (T.paused) { T.end = Date.now() + T.left * 1000; T.paused = false; }
    else { T.left = Math.max(0, (T.end - Date.now()) / 1000); T.paused = true; }
    paintTimer();
  } else if (a === "skip") nextStep();
  else if (a === "stop" || a === "close") closeTimer();
  else if (a === "done") { const f = T.o.onDone; closeTimer(); f && f(); }
});
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible" && T && !T.lock) { try { navigator.wakeLock?.request("screen").then(l => T && (T.lock = l)).catch(() => {}); } catch (e) {} }
  if (document.visibilityState === "visible") { const t = realToday(); if (t !== today) { if (cur === today) cur = t; today = t; render(); } }
});

/* ---------- Démarrage ---------- */
document.querySelectorAll(".tabbar button").forEach(b => b.classList.toggle("active", b.dataset.tab === tab));
render();
})();
