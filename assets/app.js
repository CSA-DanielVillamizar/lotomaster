/* LotoMaster · lógica de la página. Sin dependencias. */
(() => {
'use strict';
const PRICE_B = 6000, PRICE_R = 3000;
const COMB = 15401568;               // C(43,5) * 16
const P_JACK = 1 / COMB;
const PCT_OTHER = 0.1323;            // premios distintos al acumulado, % de lo vendido (plan de premios)
const DRAW_DAYS = [1, 3, 6];         // lunes, miércoles, sábado (getUTCDay)
const DRAW_HOUR = 23;                // 11:00 p. m. hora Colombia
const STORE = 'lotomaster.jugadas.v1';

const $ = s => document.querySelector(s);
const fmt = (x, d = 0) => x.toLocaleString('es-CO', {minimumFractionDigits: d, maximumFractionDigits: d});
const money = x => '$' + fmt(Math.round(x));
const pad = n => String(n).padStart(2, '0');
const MES = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
const DIA = ['domingo','lunes','martes','miércoles','jueves','viernes','sábado'];
const fdate = iso => { const [y, m, d] = iso.split('-').map(Number); return `${d} ${MES[m-1]} ${y}`; };
const ball = (n, cls = '') => `<span class="b ${cls}">${pad(n)}</span>`;
const esc = s => String(s).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));

let DRAWS = [], META = {}, current = [];

// ---------- fechas en hora de Colombia (UTC-5, sin horario de verano) ----------
function bogotaNow() { return new Date(Date.now() - 5 * 3600e3); } // campos UTC = hora local de Bogotá
function nextDrawISO() {
  const n = bogotaNow();
  const d = new Date(Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), n.getUTCDate()));
  if (!(DRAW_DAYS.includes(d.getUTCDay()) && n.getUTCHours() < DRAW_HOUR)) {
    do { d.setUTCDate(d.getUTCDate() + 1); } while (!DRAW_DAYS.includes(d.getUTCDay()));
  }
  return d.toISOString().slice(0, 10);
}
function dayName(iso) { return DIA[new Date(iso + 'T12:00:00Z').getUTCDay()]; }

// ---------- azar criptográfico ----------
function rnd(n) { const a = new Uint32Array(1); const lim = Math.floor(0x100000000 / n) * n; let x; do { crypto.getRandomValues(a); x = a[0]; } while (x >= lim); return x % n; }
function randomCombo() { const s = new Set(); while (s.size < 5) s.add(1 + rnd(43)); return [...s].sort((a, b) => a - b); }

// ---------- popularidad ----------
let PAST = new Set();
function popularity(nums) {
  const s = [...nums].sort((a, b) => a - b), issues = [];
  const high = s.filter(n => n > 31).length;
  if (high === 0) issues.push('Todos son ≤ 31: coincide con fechas de cumpleaños');
  else if (high === 1) issues.push('Solo un número mayor que 31');
  let run = 1, maxRun = 1;
  for (let i = 1; i < 5; i++) { run = s[i] === s[i-1] + 1 ? run + 1 : 1; maxRun = Math.max(maxRun, run); }
  if (maxRun >= 3) issues.push(`${maxRun} números consecutivos`);
  const d = s[1] - s[0];
  if (s.every((v, i) => i === 0 || v - s[i-1] === d)) issues.push('Progresión aritmética');
  if ([3, 5, 7].some(k => s.every(n => n % k === 0))) issues.push('Todos son múltiplos del mismo número');
  if (new Set(s.map(n => n % 10)).size <= 2) issues.push('Casi todos terminan en el mismo dígito');
  if (new Set(s.map(n => Math.floor((n - 1) / 10))).size === 1) issues.push('Todos en la misma decena');
  if (s.every(n => n <= 12)) issues.push('Todos ≤ 12: parecen meses');
  if (PAST.has(s.join('-'))) issues.push('Ya salió antes en Baloto o Revancha');
  const last = DRAWS.at(-1);
  if (last && s.filter(n => last.baloto.includes(n)).length >= 3) issues.push('Repite 3 o más números del último Baloto');
  return issues;
}
function popPill(issues) {
  return issues.length === 0 ? '<span class="pill ok">poco jugada</span>'
    : issues.length === 1 ? '<span class="pill warn">algo popular</span>' : '<span class="pill bad">muy popular</span>';
}

// ---------- generador ----------
function generate(k) {
  const out = [], usedSB = new Set();
  for (let i = 0; i < k; i++) {
    let c, tries = 0;
    do { c = randomCombo(); tries++; }
    while ((popularity(c).length || out.some(o => o.nums.filter(n => c.includes(n)).length > 2)) && tries < 20000);
    let sb; do { sb = 1 + rnd(16); } while (usedSB.has(sb) && usedSB.size < 16);
    usedSB.add(sb);
    out.push({nums: c, sb});
  }
  return out;
}
function renderCombos() {
  $('#combos').innerHTML = current.map((c, i) =>
    `<div class="combo"><span class="idx">${i + 1}</span><div class="balls">${c.nums.map(n => ball(n)).join('')}<span class="plus">+</span>${ball(c.sb, 'sb')}</div></div>`).join('');
  const n = current.length;
  $('#cost').textContent = `Costo: ${money(n * PRICE_B)} solo Baloto · ${money(n * (PRICE_B + PRICE_R))} con Revancha`;
}
function comboText() { return current.map(c => c.nums.map(pad).join(' ') + ' + ' + pad(c.sb)).join('\n'); }

// ---------- premios ----------
function prize(hits, sbHit) {
  if (hits === 5 && sbHit) return {t: 'ACUMULADO', cls: 'ok'};
  if (hits === 5) return {t: '5 aciertos', cls: 'ok'};
  if (hits === 4) return {t: sbHit ? '4 + superbalota' : '4 aciertos', cls: 'ok'};
  if (hits === 3) return {t: sbHit ? '3 + superbalota' : '3 aciertos', cls: 'ok'};
  if (hits === 2 && sbHit) return {t: '2 + superbalota', cls: 'ok'};
  if (sbHit) return {t: 'reembolso', cls: 'warn'};
  return null;
}
function scoreAgainst(nums, sb, draw, rev) {
  const win = rev ? draw.revancha : draw.baloto, wsb = rev ? draw.rsb : draw.sb;
  if (!win) return null;
  const hits = nums.filter(n => win.includes(n)).length;
  return {hits, sbHit: sb === wsb, prize: prize(hits, sb === wsb)};
}
function resultLine(r, label) {
  if (!r) return `<span class="muted">${label}: sin dato</span>`;
  return `${label}: <b>${r.hits}</b>${r.sbHit ? ' + SB' : ''} ${r.prize ? `<span class="pill ${r.prize.cls}">${r.prize.t}</span>` : '<span class="muted">sin premio</span>'}`;
}

// ---------- entrada de tiquetes ----------
function parseTicket(raw) {
  const [a, b] = raw.split('+');
  const nums = (a.match(/\d+/g) || []).map(Number);
  const sb = b ? Number((b.match(/\d+/) || [NaN])[0]) : (nums.length === 6 ? nums.pop() : NaN);
  if (nums.length !== 5 || new Set(nums).size !== 5 || nums.some(n => n < 1 || n > 43)) return {err: 'Escribe 5 números distintos del 1 al 43 y la superbalota, por ejemplo: 3 11 24 36 42 + 9'};
  if (!(sb >= 1 && sb <= 16)) return {err: 'Falta la superbalota (1 a 16), después de un +.'};
  return {nums: nums.sort((x, y) => x - y), sb};
}

// ---------- valor esperado ----------
function ev(jackpot, price, bets, tax) {
  const lam = bets * P_JACK, share = lam > 0 ? (1 - Math.exp(-lam)) / lam : 1;
  const evJ = jackpot * (1 - tax) * share * P_JACK, evO = price * PCT_OTHER;
  return {total: evJ + evO, ratio: (evJ + evO) / price, pShare: 1 - Math.exp(-lam)};
}
function renderEV() {
  const tax = Math.min(.9, Math.max(0, (+$('#s-tax').value || 0) / 100));
  const jb = META.acumulado_baloto, jr = META.acumulado_revancha;
  const set = (id, jp, price, bets) => {
    if (!jp) { $(id).textContent = 'sin dato'; return null; }
    const e = ev(jp, price, bets, tax);
    $(id).textContent = `${fmt(e.ratio * 100)} %`;
    $(id + '-bar').style.width = Math.min(100, e.ratio * 100) + '%';
    return e;
  };
  const eb = set('#ev-b', jb, PRICE_B, +$('#s-bets').value || 236000);
  const er = set('#ev-r', jr, PRICE_R, +$('#s-rbets').value || 150000);
  if (!eb) { $('#ev-note').textContent = 'Aún no hay acumulado para calcular.'; return; }
  const verdict = eb.ratio >= .9 ? 'un sorteo de los que más devuelven' : eb.ratio >= .7 ? 'un valor intermedio' : 'un valor bajo; los acumulados altos devuelven más';
  $('#ev-note').innerHTML = `De cada ${money(PRICE_B)} en Baloto vuelven en promedio <b>${money(eb.total)}</b>` +
    (er ? ` y de cada ${money(PRICE_R)} en Revancha, <b>${money(er.total)}</b>` : '') +
    `. Hoy es ${verdict}. Ninguna apuesta supera el 100 % salvo con acumulados de más de unos $100.000 millones.`;
}

// ---------- secciones ----------
function renderHeader() {
  const nd = nextDrawISO();
  $('#next-date').textContent = `${dayName(nd)} ${fdate(nd)} · 11:00 p. m.`;
  const fresh = META.acumulado_para === nd;
  const jp = v => v ? `$${fmt(v / 1e9, 1)} mil mill.` : 'sin dato';
  $('#jp-b').textContent = jp(META.acumulado_baloto) + (fresh || !META.acumulado_baloto ? '' : '*');
  $('#jp-r').textContent = jp(META.acumulado_revancha) + (fresh || !META.acumulado_revancha ? '' : '*');
}
function renderLast() {
  const d = DRAWS.at(-1); if (!d) return;
  $('#last').innerHTML = `<p class="small muted">Sorteo ${d.sorteo ?? ''} · ${dayName(d.fecha)} ${fdate(d.fecha)}</p>
  <div class="res">
    <div class="res-row"><span class="tag">BALOTO</span><div class="balls">${d.baloto.map(n => ball(n, 'sm')).join('')}${ball(d.sb, 'sb sm')}</div></div>
    ${d.revancha ? `<div class="res-row"><span class="tag">REVANCHA</span><div class="balls">${d.revancha.map(n => ball(n, 'sm')).join('')}${ball(d.rsb, 'rv sm')}</div></div>` : ''}
  </div>`;
}
function checkTicket() {
  const raw = $('#chk-in').value.trim(); const out = $('#chk-out');
  if (!raw) { out.innerHTML = ''; return; }
  const t = parseTicket(raw); if (t.err) { out.innerHTML = `<p style="color:var(--bad)">${t.err}</p>`; return; }
  const d = DRAWS.at(-1);
  out.innerHTML = `<p class="mt">${resultLine(scoreAgainst(t.nums, t.sb, d, false), 'Baloto')}</p><p>${resultLine(scoreAgainst(t.nums, t.sb, d, true), 'Revancha')}</p>`;
}
function historyCheck() {
  const raw = $('#hist-in').value.trim(); const out = $('#hist-out');
  if (!raw) { out.innerHTML = ''; return; }
  const t = parseTicket(raw); if (t.err) { out.innerHTML = `<p style="color:var(--bad)">${t.err}</p>`; return; }
  const cnt = {b: [0,0,0,0,0,0], r: [0,0,0,0,0,0]}; let won = 0, best = null;
  DRAWS.forEach(d => ['b', 'r'].forEach(k => {
    const r = scoreAgainst(t.nums, t.sb, d, k === 'r'); if (!r) return;
    cnt[k][r.hits]++; if (r.prize && r.prize.t !== 'reembolso') won++;
    if (!best || r.hits > best.hits || (r.hits === best.hits && r.sbHit && !best.sbHit)) best = {...r, d, k};
  }));
  const issues = popularity(t.nums);
  out.innerHTML = `<div class="kv">
    <span>Popularidad estimada</span><b>${popPill(issues)}</b>
    <span>Sorteos revisados (Baloto + Revancha)</span><b>${fmt(DRAWS.length * 2)}</b>
    <span>Veces con 5 aciertos</span><b>${cnt.b[5] + cnt.r[5]}</b>
    <span>Veces con 4 aciertos</span><b>${cnt.b[4] + cnt.r[4]}</b>
    <span>Veces con 3 aciertos</span><b>${cnt.b[3] + cnt.r[3]}</b>
    <span>Veces con algún premio (sin reembolsos)</span><b>${won}</b>
    <span>Mejor resultado</span><b>${best.hits}${best.sbHit ? ' + SB' : ''} · ${best.k === 'b' ? 'Baloto' : 'Revancha'} ${fdate(best.d.fecha)}</b>
  </div>
  ${issues.length ? '<ul>' + issues.map(i => `<li>${esc(i)}</li>`).join('') + '</ul>' : ''}
  <p class="muted mt">Que una combinación haya salido mucho o poco no cambia su probabilidad futura: sigue siendo 1 en ${fmt(COMB)}.</p>`;
}

// ---------- mis jugadas (localStorage) ----------
function loadMine() { try { return JSON.parse(localStorage.getItem(STORE)) || []; } catch { return []; } }
function saveMine(list) { try { localStorage.setItem(STORE, JSON.stringify(list)); return true; } catch { return false; } }
function renderMine() {
  const list = loadMine(); const box = $('#mine');
  if (!list.length) { box.innerHTML = '<p class="small muted">Todavía no has guardado jugadas. Genera una combinación y pulsa "Guardar en mis jugadas".</p>'; return; }
  const byDate = Object.fromEntries(DRAWS.map(d => [d.fecha, d]));
  box.innerHTML = list.slice().reverse().map(j => {
    const d = byDate[j.fecha];
    const res = d ? `${resultLine(scoreAgainst(j.nums, j.sb, d, false), 'Baloto')} · ${resultLine(scoreAgainst(j.nums, j.sb, d, true), 'Revancha')}` : '<span class="pill warn">pendiente</span>';
    const win = d ? d.baloto : [];
    return `<div class="mine-item"><div><div class="balls">${j.nums.map(n => ball(n, 'sm' + (win.includes(n) ? ' hit' : ''))).join('')}${ball(j.sb, 'sb sm')}</div>
      <div class="meta mt">Sorteo del ${dayName(j.fecha)} ${fdate(j.fecha)} · ${res}</div></div>
      <button class="x" type="button" data-id="${esc(j.id)}" aria-label="Quitar jugada">✕</button></div>`;
  }).join('');
}
function toast(msg) { const t = document.createElement('div'); t.className = 'toast'; t.setAttribute('role', 'status'); t.textContent = msg; document.body.appendChild(t); setTimeout(() => t.remove(), 2200); }

// ---------- arranque ----------
async function load() {
  const bust = '?v=' + Math.floor(Date.now() / 600000);
  const [d, m] = await Promise.all([
    fetch('data/draws.json' + bust).then(r => r.json()),
    fetch('data/meta.json' + bust).then(r => r.json()).catch(() => ({})),
  ]);
  DRAWS = d; META = m;
  PAST = new Set(); DRAWS.forEach(x => { PAST.add(x.baloto.join('-')); if (x.revancha) PAST.add(x.revancha.join('-')); });
}
function wire() {
  $('#btn-gen').addEventListener('click', () => { current = generate(+$('#n-combos').value); renderCombos(); });
  $('#n-combos').addEventListener('change', () => { current = generate(+$('#n-combos').value); renderCombos(); });
  $('#btn-copy').addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(comboText()); toast('Combinaciones copiadas'); }
    catch { toast('No se pudo copiar; selecciona los números a mano'); }
  });
  $('#btn-save').addEventListener('click', () => {
    const fecha = nextDrawISO(), list = loadMine();
    current.forEach(c => list.push({id: Date.now().toString(36) + rnd(1e6), fecha, nums: c.nums, sb: c.sb}));
    toast(saveMine(list) ? `Guardadas para el sorteo del ${fdate(fecha)}` : 'Este navegador no permite guardar');
    renderMine();
  });
  $('#mine').addEventListener('click', e => {
    const id = e.target.closest('button[data-id]')?.dataset.id; if (!id) return;
    saveMine(loadMine().filter(j => j.id !== id)); renderMine();
  });
  $('#btn-clear').addEventListener('click', () => {
    const have = new Set(DRAWS.map(d => d.fecha));
    saveMine(loadMine().filter(j => !have.has(j.fecha))); renderMine(); toast('Jugadas revisadas borradas');
  });
  ['#s-bets', '#s-rbets', '#s-tax'].forEach(id => $(id).addEventListener('input', renderEV));
  $('#chk-in').addEventListener('input', checkTicket);
  $('#hist-in').addEventListener('input', historyCheck);
}
async function main() {
  wire();
  try { await load(); }
  catch (e) { $('#data-status').textContent = 'No se pudieron cargar los resultados. Recarga la página.'; return; }
  renderHeader(); renderLast(); renderEV(); renderMine();
  current = generate(+$('#n-combos').value); renderCombos();
  const nd = nextDrawISO();
  $('#data-status').textContent = `Datos: ${fmt(DRAWS.length)} sorteos hasta el ${fdate(DRAWS.at(-1).fecha)}. Actualizado ${META.actualizado ? META.actualizado.replace('T', ' ').slice(0, 16) : ''}.` +
    (META.acumulado_para && META.acumulado_para !== nd ? ' * Acumulado del sorteo anterior; se actualiza tras el próximo resultado.' : '');
}
main();
})();
