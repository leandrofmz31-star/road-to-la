/*!
 * Road to LA — app.js
 * Cuenta regresiva, línea de tiempo, progreso y PWA. JavaScript nativo, sin librerías.
 */
(function () {
  'use strict';

  const DATA = globalThis.ROAD_TO_LA;
  if (!DATA) {
    document.documentElement.classList.add('no-data');
    return;
  }
  const { CONFIG, CATEGORIES, PHOTOS, TRIP_PLACES, notificationFor } = DATA;
  const DAYS = DATA.countdownDays;

  // ------------------------------------------------------------ utilidades
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const motion = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : { matches: false };
  const reduced = () => motion.matches;
  const pad = (n) => String(n).padStart(2, '0');
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const norm = (s) => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
  const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  const WEEKDAYS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
  const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
  const parseISO = (iso) => iso.split('-').map(Number);
  const dayIndex = (iso) => { const [y, m, d] = parseISO(iso); return Math.round(Date.UTC(y, m - 1, d) / 864e5); };
  const fmtLong = (iso) => { const [y, m, d] = parseISO(iso); return `${cap(WEEKDAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()])} ${d} de ${MONTHS[m - 1]}`; };
  const fmtShort = (iso) => { const [, m, d] = parseISO(iso); return `${d} de ${MONTHS[m - 1]}`; };
  const commonsURL = (file) => 'https://commons.wikimedia.org/wiki/Special:FilePath/' + encodeURIComponent(file) + '?width=1280';
  const commonsPage = (file) => 'https://commons.wikimedia.org/wiki/File:' + encodeURIComponent(file.replace(/ /g, '_'));
  const mapsURL = (q) => 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(q);
  const icon = (id) => `<svg class="i" aria-hidden="true"><use href="#i-${id}"/></svg>`;
  const dayByDate = (date) => DAYS.find((d) => d.date === date);
  const pageURL = () => location.origin + location.pathname;

  // ------------------------------------------------------------ tiempo (hora de Costa Rica)
  const dtfCache = {};
  function partsIn(tz, ms) {
    if (!(tz in dtfCache)) {
      try {
        dtfCache[tz] = new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' });
      } catch (e) { dtfCache[tz] = null; }
    }
    const dtf = dtfCache[tz];
    if (dtf && dtf.formatToParts) {
      try {
        const o = {};
        dtf.formatToParts(new Date(ms)).forEach((p) => { o[p.type] = p.value; });
        return { y: +o.year, m: +o.month, d: +o.day, h: (+o.hour) % 24, mi: +o.minute, s: +o.second };
      } catch (e) { /* respaldo abajo */ }
    }
    const off = tz === CONFIG.timeZone ? CONFIG.utcOffsetFallbackMinutes : -480;
    const t = new Date(ms + off * 6e4);
    return { y: t.getUTCFullYear(), m: t.getUTCMonth() + 1, d: t.getUTCDate(), h: t.getUTCHours(), mi: t.getUTCMinutes(), s: t.getUTCSeconds() };
  }
  const crParts = (ms) => partsIn(CONFIG.timeZone, ms);
  const isoOf = (p) => `${p.y}-${pad(p.m)}-${pad(p.d)}`;
  function zonedToUTC(iso, h = 0, mi = 0, s = 0) {
    const [y, m, d] = parseISO(iso);
    const target = Date.UTC(y, m - 1, d, h, mi, s);
    let guess = target;
    for (let i = 0; i < 3; i++) {
      const p = crParts(guess);
      const diff = Date.UTC(p.y, p.m - 1, p.d, p.h, p.mi, p.s) - target;
      if (!diff) break;
      guess -= diff;
    }
    return guess;
  }
  const START = CONFIG.startDate;
  const DEPART = CONFIG.departureDate;
  const START_MS = zonedToUTC(START);
  const DEPART_MS = zonedToUTC(DEPART);

  // ?preview=2026-10-30 o ?preview=2026-11-05T23:59:50 para probar otras fechas.
  let offset = 0;
  let previewing = '';
  try {
    const pv = new URLSearchParams(location.search).get('preview');
    if (pv && /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}(:\d{2})?)?$/.test(pv)) {
      const [dPart, tPart] = pv.split('T');
      let target;
      if (tPart) {
        const [h, mi, s] = tPart.split(':').map(Number);
        target = zonedToUTC(dPart, h, mi, s || 0);
      } else {
        const n = crParts(Date.now());
        target = zonedToUTC(dPart, n.h, n.mi, n.s);
      }
      if (Number.isFinite(target)) { offset = target - Date.now(); previewing = pv; }
    }
  } catch (e) { /* sin vista previa */ }
  const now = () => Date.now() + offset;

  function snapshot() {
    const ms = now();
    const p = crParts(ms);
    const today = isoOf(p);
    const ti = dayIndex(today);
    const daysLeft = dayIndex(DEPART) - ti;
    let phase = 'countdown';
    if (ti < dayIndex(START)) phase = 'before';
    else if (daysLeft === 1) phase = 'tomorrow';
    else if (daysLeft === 0) phase = 'theday';
    else if (daysLeft < 0) phase = 'after';
    return {
      ms, p, today, ti, daysLeft, phase,
      remaining: Math.max(0, DEPART_MS - ms),
      progress: Math.min(1, Math.max(0, (ms - START_MS) / (DEPART_MS - START_MS))),
      todayDay: dayByDate(today) || null,
    };
  }
  let snap = snapshot();
  function statusOf(day) {
    if (snap.phase === 'before') return 'locked';
    if (snap.phase === 'after') return 'past';
    const di = dayIndex(day.date);
    return di < snap.ti ? 'past' : di === snap.ti ? 'today' : 'locked';
  }

  // ------------------------------------------------------------ progreso guardado
  const KEY = 'roadToLA:v1';
  function loadStore() {
    try {
      const o = JSON.parse(localStorage.getItem(KEY) || 'null');
      if (!o || typeof o !== 'object') throw new Error('vacío');
      return {
        opened: o.opened || {},
        completed: o.completed || {},
        settings: Object.assign({ theme: 'night', sound: false, notify: false }, o.settings || {}),
        confetti: o.confetti || '',
      };
    } catch (e) {
      return { opened: {}, completed: {}, settings: { theme: 'night', sound: false, notify: false }, confetti: '' };
    }
  }
  let store = loadStore();
  function save() { try { localStorage.setItem(KEY, JSON.stringify(store)); } catch (e) { /* almacenamiento lleno o bloqueado */ } }

  const ui = { query: '', filter: 'all', pastOpen: false, open: new Set() };

  const el = {
    root: document.documentElement,
    hero: $('#home'), heroPhoto: $('.hero__photo'), heroPalms: $('.hero__palms'),
    marquee: $('#marquee'), mqTop: $('#mq-top'), mqMain: $('#mq-main'), mqBottom: $('#mq-bottom'),
    heroMsg: $('#hero-message'), heroTagline: $('#hero-tagline'), heroExtra: $('#hero-extra'), heroCta: $('#hero-cta'),
    flight: $('#flight'), flightLabel: $('#flight-label'),
    topbar: $('#topbar'), mini: $('#mini-count'), preview: $('#preview-pill'),
    strip: $('#filmstrip'), stats: $('#stats'), chips: $('#chips'), search: $('#search'), list: $('#day-list'), results: $('#results-status'),
    rail: $('#trip-rail'), laClock: $('#la-clock'),
    notifyStatus: $('#notify-status'), subscription: $('#subscription'), subscriptionJson: $('#subscription-json'),
    installBtn: $('#install-btn'), installDesc: $('#install-desc'), themeDesc: $('#theme-desc'),
    toast: $('#toast'),
  };

  // ------------------------------------------------------------ hero y marquesina
  let heroMode = '';
  const unitHTML = (u, label) => `<div class="mq-unit"><span class="tiles" data-u="${u}"></span><span class="mq-label">${label}</span></div>`;
  function buildMarqueeMain(mode) {
    let html = '';
    if (mode === 'count') {
      html = `<div class="mq-days"><span class="tiles" data-u="d"></span><span class="mq-label">Days</span></div>
        <div class="mq-clock">${unitHTML('h', 'Hrs')}<span class="mq-sep">:</span>${unitHTML('m', 'Min')}<span class="mq-sep">:</span>${unitHTML('s', 'Sec')}</div>`;
    } else if (mode === 'clock') {
      html = `<div class="mq-clock mq-clock--big">${unitHTML('h', 'Hrs')}<span class="mq-sep">:</span>${unitHTML('m', 'Min')}<span class="mq-sep">:</span>${unitHTML('s', 'Sec')}</div>`;
    } else if (mode === 'theday') {
      html = '<p class="mq-text">Road to LA<br>is over</p>';
    } else {
      html = '<p class="mq-text">Los Angeles</p>';
    }
    el.mqMain.innerHTML = html;
  }

  function renderHero() {
    const s = snap;
    const day = s.todayDay;
    const ms = day && day.milestone;
    const key = ms && s.phase === 'countdown' ? ms.key : '';
    el.hero.dataset.phase = s.phase;
    el.hero.dataset.milestone = key;
    el.marquee.dataset.milestone = ms ? ms.key : '';

    let top = 'Next stop: Los Angeles';
    let bottom = day ? `Now showing: ${day.title}` : '';
    let msg = '';
    let tagline = 'The countdown to California';
    let mode = 'count';
    if (s.phase === 'before') {
      top = 'Coming soon'; bottom = 'The road starts October 2';
      msg = 'La cuenta empieza el 2 de octubre. El primer día se abre a la medianoche, hora de Costa Rica.';
    } else if (s.phase === 'countdown' && ms) {
      top = ms.label; msg = ms.message;
    } else if (s.phase === 'tomorrow') {
      top = 'Tomorrow'; bottom = 'Los Angeles'; tagline = 'Los Angeles'; mode = 'clock';
      msg = ms ? ms.message : 'Mañana empieza el viaje.';
    } else if (s.phase === 'theday') {
      top = 'Today'; bottom = 'The adventure begins'; tagline = 'Welcome to Los Angeles'; mode = 'theday';
      msg = ms ? ms.message : 'Hoy es el día.';
    } else if (s.phase === 'after') {
      top = 'Now playing'; bottom = 'The adventure is on'; tagline = 'Los Angeles'; mode = 'after';
      msg = 'La cuenta terminó el 6 de noviembre de 2026. Los 36 días siguen aquí, abiertos, para revivirlos cuando quieras.';
    }
    el.mqTop.textContent = top;
    el.mqBottom.textContent = bottom;
    el.heroMsg.textContent = msg;
    el.heroTagline.textContent = tagline;
    if (mode !== heroMode) { buildMarqueeMain(mode); heroMode = mode; }

    const toDays = s.phase === 'before' || s.phase === 'after';
    el.heroCta.textContent = s.phase === 'before' ? 'Ver el camino' : s.phase === 'after' ? 'Revivir el camino' : 'Abrir el día de hoy';
    el.heroCta.dataset.action = toDays ? 'go-days' : 'open-today';

    if (s.phase === 'theday') {
      el.heroExtra.innerHTML = `<p class="hero__extra-title">Tu viaje empieza por aquí</p>
        <div class="hero__places">${TRIP_PLACES.map((p) => `<a class="place-chip" href="#place-${p.id}">${esc(p.name)}</a>`).join('')}</div>
        <button class="btn btn--small btn--ghost" type="button" data-action="confetti">Celebrar otra vez</button>`;
    } else if (s.phase === 'after') {
      const done = DAYS.filter((d) => store.completed[d.date]).length;
      el.heroExtra.innerHTML = `<p class="hero__extra-title">Completaste ${done} de ${DAYS.length} días del camino.</p>`;
    } else {
      el.heroExtra.innerHTML = '';
    }
    lastPct = -1;
    updateClock();
  }

  function setTiles(u, str) {
    const host = el.mqMain.querySelector(`[data-u="${u}"]`);
    if (!host) return;
    if (host.children.length !== str.length) {
      host.innerHTML = Array.from(str, (c) => `<span class="tile">${c}</span>`).join('');
      return;
    }
    Array.from(str).forEach((c, i) => {
      const t = host.children[i];
      if (t.textContent === c) return;
      t.textContent = c;
      if (!reduced() && !document.hidden && t.animate) {
        t.animate([{ transform: 'rotateX(-85deg)', opacity: 0.3 }, { transform: 'rotateX(0deg)', opacity: 1 }], { duration: 380, easing: 'cubic-bezier(.2,.8,.2,1)' });
      }
    });
  }

  let lastAria = '';
  let lastPct = -1;
  function updateClock() {
    const r = snap.remaining;
    const d = Math.floor(r / 864e5);
    const h = Math.floor(r / 36e5) % 24;
    const m = Math.floor(r / 6e4) % 60;
    const s = Math.floor(r / 1e3) % 60;
    if (heroMode === 'count') { setTiles('d', pad(d)); setTiles('h', pad(h)); setTiles('m', pad(m)); setTiles('s', pad(s)); }
    else if (heroMode === 'clock') { setTiles('h', pad(Math.floor(r / 36e5))); setTiles('m', pad(m)); setTiles('s', pad(s)); }

    const over = snap.phase === 'theday' || snap.phase === 'after';
    el.mini.textContent = over ? 'Los Angeles' : `${d}d ${pad(h)}:${pad(m)}:${pad(s)}`;
    const label = over ? 'La cuenta regresiva terminó: hoy es el viaje.' : `Faltan ${d} días, ${h} horas y ${m} minutos para el 6 de noviembre, a la medianoche de Costa Rica.`;
    if (label !== lastAria) { el.mqMain.setAttribute('aria-label', label); lastAria = label; }

    const pct = over ? 100 : Math.floor(snap.progress * 1000) / 10;
    if (pct !== lastPct) {
      lastPct = pct;
      const txt = (pct >= 100 ? '100' : pct.toFixed(1).replace('.', ',')) + ' %';
      el.flight.style.setProperty('--p', pct + '%');
      el.flight.setAttribute('aria-label', `Progreso del viaje: ${txt}`);
      el.flightLabel.innerHTML = `<b>${txt}</b> del camino recorrido`;
    }
  }

  // ------------------------------------------------------------ tira de película y estadísticas
  function renderFilmstrip() {
    el.strip.innerHTML = DAYS.map((d) => {
      const st = statusOf(d);
      const done = !!store.completed[d.date];
      const seen = !!store.opened[d.date];
      const cls = ['frame', `frame--${st}`, done ? 'is-done' : '', seen ? 'is-seen' : '', d.milestone ? 'is-milestone' : ''].filter(Boolean).join(' ');
      const label = `DAY ${d.dayNumber}, ${fmtLong(d.date)}${st === 'locked' ? ', bloqueado' : st === 'today' ? ', hoy' : ''}${done ? ', completado' : ''}`;
      return `<button type="button" class="${cls}" data-action="goto" data-date="${d.date}" aria-label="${esc(label)}"${st === 'today' ? ' aria-current="date"' : ''}><span aria-hidden="true">${d.dayNumber}</span></button>`;
    }).join('');
    const cur = el.strip.querySelector('.frame--today');
    if (cur) requestAnimationFrame(() => { el.strip.scrollLeft = cur.offsetLeft - el.strip.clientWidth / 2 + cur.offsetWidth / 2; });
  }

  function renderStats() {
    const unlocked = DAYS.filter((d) => statusOf(d) !== 'locked').length;
    const seen = DAYS.filter((d) => store.opened[d.date]).length;
    const done = DAYS.filter((d) => store.completed[d.date]).length;
    const showToday = snap.phase === 'countdown' || snap.phase === 'tomorrow' || snap.phase === 'theday';
    el.stats.innerHTML = `<p><b>${unlocked}</b> de ${DAYS.length} abiertos</p><p><b>${seen}</b> vistos</p><p><b>${done}</b> completados</p>`
      + (showToday ? '<button class="btn btn--small btn--ghost" type="button" data-action="open-today">Ir a hoy</button>' : '');
  }

  function renderChips() {
    const items = [['all', 'Todos']]
      .concat(Object.keys(CATEGORIES).map((k) => [k, CATEGORIES[k].label]))
      .concat([['pending', 'Pendientes'], ['done', 'Completados']]);
    el.chips.innerHTML = items.map(([k, label]) => {
      const isCat = Object.prototype.hasOwnProperty.call(CATEGORIES, k);
      return `<button type="button" class="chip" data-action="filter" data-filter="${k}"${isCat ? ` data-cat="${k}"` : ''} aria-pressed="${ui.filter === k}">${isCat ? icon(CATEGORIES[k].icon) : ''}${esc(label)}</button>`;
    }).join('');
  }

  // ------------------------------------------------------------ tarjetas
  function photoHTML(keys, loading) {
    const list = (keys || []).filter((k) => PHOTOS[k]);
    if (!list.length) return '';
    const ph = PHOTOS[list[0]];
    return `<img class="photo" src="${commonsURL(ph.file)}" alt="${esc(ph.alt)}" loading="${loading}" decoding="async" referrerpolicy="no-referrer" data-keys="${list.join(' ')}" data-i="0">`;
  }
  const sceneStyle = (scene) => `--scene:url('assets/scenes/${scene}.svg')`;

  function cardHTML(d) {
    const st = statusOf(d);
    if (st === 'locked') return lockedHTML(d);
    const isToday = st === 'today';
    const compact = !isToday;
    const open = ui.open.has(d.date);
    const done = !!store.completed[d.date];
    const seen = !!store.opened[d.date];
    const ms = d.milestone;
    const cls = ['day', compact ? 'day--compact' : 'day--feature', isToday ? 'day--today' : '', ms ? 'day--milestone' : '', open ? 'is-open' : '', done ? 'is-done' : '', seen ? 'is-seen' : ''].filter(Boolean).join(' ');
    return `<article class="${cls}" id="day-${d.date}" data-day="${d.date}" data-cat="${d.category}">
      <div class="day__media" style="${sceneStyle(d.scene)}">${photoHTML(d.image, isToday ? 'eager' : 'lazy')}${ms ? `<span class="day__ribbon" lang="en">${esc(ms.label)}</span>` : ''}${isToday ? '<span class="day__now">Hoy</span>' : ''}${done ? `<span class="day__check">${icon('check')}</span>` : ''}</div>
      <div class="day__body">
        <p class="day__meta"><span class="day__num" lang="en">Day ${d.dayNumber}</span><time datetime="${d.date}">${fmtLong(d.date)}</time></p>
        <h3 class="day__title">${esc(d.title)}</h3>
        <p class="day__theme">${esc(d.theme)}</p>
        <p class="day__song">${icon('note')}<span><strong>${esc(d.song)}</strong> — ${esc(d.artist)}</span></p>
      </div>
      <div class="day__bar">
        <button class="btn-expand" type="button" data-action="toggle" aria-expanded="${open}" aria-controls="panel-${d.date}" lang="en">${open ? 'Close' : 'Expand'}</button>
        <button class="btn-done" type="button" data-action="done" aria-pressed="${done}">${icon('check')}<span>${done ? 'Completado' : 'Marcar como completado'}</span></button>
      </div>
      <div class="day__panel" id="panel-${d.date}" role="region" aria-label="Detalles del DAY ${d.dayNumber}"${open ? '' : ' inert'}><div class="day__panel-inner">${open ? panelHTML(d, compact) : ''}</div></div>
    </article>`;
  }

  function lockedHTML(d) {
    const ms = d.milestone;
    const cat = CATEGORIES[d.category];
    const inDays = dayIndex(d.date) - snap.ti;
    const when = snap.phase === 'before' ? `Se abre el ${fmtShort(d.date)}` : inDays === 1 ? 'Se abre mañana' : `Se abre en ${inDays} días`;
    return `<article class="day day--locked${ms ? ' day--milestone' : ''}" id="day-${d.date}" data-day="${d.date}" data-cat="${d.category}" aria-label="${esc(`DAY ${d.dayNumber}, ${fmtLong(d.date)}. ${when}.`)}">
      <div class="day__lockart" style="${sceneStyle(d.scene)}">${icon('lock')}</div>
      <div class="day__body"><p class="day__meta"><span class="day__num" lang="en">Day ${d.dayNumber}</span><time datetime="${d.date}">${fmtLong(d.date)}</time></p><p class="day__when">${when}</p></div>
      ${ms ? `<span class="day__flag" lang="en">${esc(ms.label)}</span>` : `<span class="day__cat">${icon(cat.icon)}${esc(cat.label)}</span>`}
    </article>`;
  }

  const block = (label, body, mod) => `<section class="block block--${mod}"><h4 lang="en">${label}</h4>${body}</section>`;
  function creditHTML(d, host) {
    const key = host && host.dataset.photo;
    if (key && PHOTOS[key]) {
      const ph = PHOTOS[key];
      return `Foto: ${esc(ph.author)}${ph.license ? `, ${esc(ph.license)}` : ''}. <a href="${commonsPage(ph.file)}" target="_blank" rel="noopener">Ver en Wikimedia Commons</a>`;
    }
    return d.image && d.image.length ? 'La foto aparece cuando hay conexión; mientras tanto, ilustración original de Road to LA.' : 'Ilustración original de Road to LA.';
  }

  function panelHTML(d, compact) {
    const card = document.getElementById('day-' + d.date);
    const out = ['<div class="panel">'];
    if (compact) out.push(`<figure class="panel__media" style="${sceneStyle(d.scene)}">${photoHTML(d.image, 'lazy')}</figure>`);
    if (d.story) out.push(block('The Scene', `<p class="lede">${esc(d.story)}</p>`, 'scene'));
    out.push(block('The Story', `<p>${esc(d.description)}</p>`, 'story'));
    out.push(block('The Fact', `<p>${esc(d.fact)}</p>${d.factSource ? `<a class="src" href="${esc(d.factSource)}" target="_blank" rel="noopener">${icon('external')}Fuente: Wikipedia</a>` : d.factNote ? `<p class="src">${esc(d.factNote)}</p>` : ''}`, 'fact'));
    out.push(block('The Song', `<p class="song"><strong>${esc(d.song)}</strong><span>${esc(d.artist)}</span></p><p>${esc(d.songWhy)}</p>
      <div class="listen"><a class="btn-listen btn-listen--yt" href="${esc(d.youtubeUrl)}" target="_blank" rel="noopener" lang="en">${icon('play')}Listen on YouTube</a><a class="btn-listen btn-listen--sp" href="${esc(d.spotifyUrl)}" target="_blank" rel="noopener" lang="en">${icon('play')}Listen on Spotify</a></div>`, 'song'));
    out.push(block('The Place', `<p class="place"><strong>${esc(d.place.name)}</strong><span>${esc(d.place.area)}</span></p><p>${esc(d.place.note)}</p><a class="link" href="${mapsURL(d.place.query || d.place.name)}" target="_blank" rel="noopener">${icon('map')}Ver en el mapa</a>`, 'place'));
    if (d.movie) out.push(block('Movie Connection', `<p class="movie"><cite>${esc(d.movie.title)}</cite> <span>(${d.movie.year})</span></p><p>${esc(d.movie.note)}</p>`, 'movie'));
    if (d.list) out.push(block(esc(d.list.title), `<ol class="list">${d.list.items.map((i) => `<li>${esc(i)}</li>`).join('')}</ol>`, 'list'));
    out.push(block('Travel Tip', `<p>${esc(d.tip)}</p>`, 'tip'));
    out.push(block('Photo', `<p class="credit" data-credit>${creditHTML(d, card)}</p>`, 'photo'));
    out.push(`<div class="panel__foot"><button class="btn btn--small btn--ghost" type="button" data-action="share">${icon('share')}Compartir este día</button></div>`);
    out.push('</div>');
    return out.join('');
  }

  // ------------------------------------------------------------ lista
  const hayCache = new Map();
  function hay(d) {
    if (!hayCache.has(d.date)) {
      hayCache.set(d.date, norm([d.title, d.theme, d.description, d.story, d.song, d.artist, d.fact, d.songWhy, d.place.name, d.place.area, d.place.note,
        d.movie && d.movie.title, d.tip, CATEGORIES[d.category].label, 'day ' + d.dayNumber, fmtLong(d.date), d.list && d.list.items.join(' ')].filter(Boolean).join(' ')));
    }
    return hayCache.get(d.date);
  }
  function matches(d) {
    const st = statusOf(d);
    if (ui.filter === 'done' && !store.completed[d.date]) return false;
    if (ui.filter === 'pending' && (st === 'locked' || store.completed[d.date])) return false;
    if (CATEGORIES[ui.filter] && d.category !== ui.filter) return false;
    if (ui.query) return st !== 'locked' && hay(d).includes(norm(ui.query));
    return true;
  }

  function renderList() {
    const filtered = !!ui.query.trim() || ui.filter !== 'all';
    let html = '';
    if (!filtered) {
      const past = DAYS.filter((d) => statusOf(d) === 'past');
      const today = DAYS.find((d) => statusOf(d) === 'today');
      const future = DAYS.filter((d) => statusOf(d) === 'locked');
      if (past.length) {
        const open = ui.pastOpen || snap.phase === 'after';
        html += `<div class="road__group"><button class="group-toggle" type="button" data-action="toggle-past" aria-expanded="${open}" aria-controls="past-days">${icon('chevron')}<span>Ya recorridos</span><b>${past.length}</b></button>`
          + `<div class="road__past" id="past-days"${open ? '' : ' hidden'}>${open ? past.map(cardHTML).join('') : ''}</div></div>`;
      }
      if (today) html += '<p class="road__label" lang="en">Today’s experience</p>' + cardHTML(today);
      if (future.length) html += `<p class="road__label">${snap.phase === 'before' ? 'El camino' : 'Lo que falta'}</p>` + future.map(cardHTML).join('');
      el.results.textContent = '';
    } else {
      const res = DAYS.filter(matches);
      const lockedHidden = ui.query.trim() ? DAYS.filter((d) => statusOf(d) === 'locked').length : 0;
      const count = res.length ? `${res.length} ${res.length === 1 ? 'día' : 'días'}.` : 'Ningún día coincide. Prueba otra palabra o quita el filtro.';
      html += `<div class="road__results"><p>${count}${lockedHidden ? ` Los ${lockedHidden} días que faltan no entran en la búsqueda.` : ''}</p><button class="btn btn--small btn--ghost" type="button" data-action="clear-filters">Quitar filtros</button></div>`;
      html += res.map(cardHTML).join('');
      el.results.textContent = res.length ? `${res.length} días encontrados` : 'Ningún día coincide';
    }
    el.list.innerHTML = html;
  }

  // ------------------------------------------------------------ viaje
  function renderTrip() {
    el.rail.innerHTML = TRIP_PLACES.map((p) => {
      const d = dayByDate(p.day);
      const st = d ? statusOf(d) : 'locked';
      const dayLink = !d ? '' : st === 'locked'
        ? `<button class="link" type="button" data-action="goto" data-date="${d.date}">Su día llega el ${fmtShort(d.date)}</button>`
        : `<button class="link" type="button" data-action="goto-open" data-date="${d.date}">Ver el DAY ${d.dayNumber}</button>`;
      return `<article class="place-card" id="place-${p.id}" data-place="${p.id}">
        <div class="place-card__media" style="${sceneStyle(p.scene)}">${photoHTML(p.image, 'lazy')}</div>
        <div class="place-card__body">
          <p class="place-card__area">${esc(p.area)}</p>
          <h3 class="place-card__name">${esc(p.name)}</h3>
          <p>${esc(p.text)}</p>
          <p class="place-card__fact">${esc(p.fact)}</p>
          <div class="place-card__links">${dayLink}<a class="link" href="${mapsURL(p.maps)}" target="_blank" rel="noopener">${icon('map')}Mapa</a><a class="link" href="${esc(p.url)}" target="_blank" rel="noopener">${icon('external')}Sitio oficial</a></div>
          <p class="credit" data-credit></p>
        </div>
      </article>`;
    }).join('');
  }

  function updateLAClock() {
    const ms = now();
    const la = partsIn(CONFIG.destinationTimeZone, ms);
    const cr = crParts(ms);
    const diffH = Math.round((Date.UTC(cr.y, cr.m - 1, cr.d, cr.h, cr.mi) - Date.UTC(la.y, la.m - 1, la.d, la.h, la.mi)) / 36e5);
    const h12 = la.h % 12 || 12;
    const time = `${h12}:${pad(la.mi)} ${la.h < 12 ? 'a. m.' : 'p. m.'}`;
    el.laClock.textContent = diffH > 0 ? `${time}, ${diffH === 1 ? 'una hora' : `${diffH} horas`} menos que en Costa Rica` : time;
  }

  // ------------------------------------------------------------ acciones sobre días
  function toggleDay(date, force) {
    const card = document.getElementById('day-' + date);
    if (!card || card.classList.contains('day--locked')) return false;
    const d = dayByDate(date);
    const isOpen = card.classList.contains('is-open');
    const willOpen = typeof force === 'boolean' ? force : !isOpen;
    if (willOpen === isOpen) return true;
    const panel = card.querySelector('.day__panel');
    const inner = panel.firstElementChild;
    const btn = card.querySelector('[data-action="toggle"]');
    if (willOpen) {
      if (!inner.firstElementChild) inner.innerHTML = panelHTML(d, card.classList.contains('day--compact'));
      panel.removeAttribute('inert');
      void panel.offsetHeight;
      card.classList.add('is-open');
      ui.open.add(date);
      if (!store.opened[date] && !previewing) {
        store.opened[date] = Date.now();
        save();
        card.classList.add('is-seen');
        const fr = el.strip.querySelector(`[data-date="${date}"]`);
        if (fr) fr.classList.add('is-seen');
        renderStats();
      }
      play('open');
    } else {
      card.classList.remove('is-open');
      panel.setAttribute('inert', '');
      ui.open.delete(date);
      play('close');
    }
    btn.setAttribute('aria-expanded', String(willOpen));
    btn.textContent = willOpen ? 'Close' : 'Expand';
    return true;
  }

  function toggleDone(date) {
    const card = document.getElementById('day-' + date);
    const d = dayByDate(date);
    if (!card || !d) return;
    const done = !store.completed[date];
    if (done) store.completed[date] = Date.now(); else delete store.completed[date];
    save();
    card.classList.toggle('is-done', done);
    const btn = card.querySelector('[data-action="done"]');
    btn.setAttribute('aria-pressed', String(done));
    btn.querySelector('span').textContent = done ? 'Completado' : 'Marcar como completado';
    const media = card.querySelector('.day__media');
    const chk = media && media.querySelector('.day__check');
    if (done && media && !chk) media.insertAdjacentHTML('beforeend', `<span class="day__check">${icon('check')}</span>`);
    if (!done && chk) chk.remove();
    const fr = el.strip.querySelector(`[data-date="${date}"]`);
    if (fr) fr.classList.toggle('is-done', done);
    renderStats();
    play(done ? 'done' : 'tap');
    toast(done ? `DAY ${d.dayNumber} completado` : `DAY ${d.dayNumber} vuelve a pendiente`);
  }

  function scrollToEl(node) {
    if (node) node.scrollIntoView({ behavior: reduced() ? 'auto' : 'smooth', block: 'start' });
  }

  function goTo(date, opts) {
    const open = !!(opts && opts.open);
    const d = dayByDate(date);
    if (!d) return;
    const st = statusOf(d);
    let rerender = false;
    if (ui.query || ui.filter !== 'all') { ui.query = ''; ui.filter = 'all'; el.search.value = ''; renderChips(); rerender = true; }
    if (st === 'past' && !ui.pastOpen && snap.phase !== 'after') { ui.pastOpen = true; rerender = true; }
    if (rerender) renderList();
    const card = document.getElementById('day-' + date);
    if (!card) return;
    if (open && st !== 'locked') toggleDay(date, true);
    scrollToEl(card);
    if (st === 'locked') toast(`DAY ${d.dayNumber} se abre el ${fmtShort(d.date)}.`);
    card.classList.remove('is-flash');
    void card.offsetWidth;
    card.classList.add('is-flash');
  }

  function openToday() {
    const t = DAYS.find((d) => statusOf(d) === 'today');
    if (t) goTo(t.date, { open: true });
    else scrollToEl(document.getElementById('days'));
  }

  async function shareOrCopy(data) {
    try {
      if (navigator.share) { await navigator.share(data); return; }
    } catch (e) {
      if (e && e.name === 'AbortError') return;
    }
    try {
      await navigator.clipboard.writeText(`${data.text ? data.text + ' ' : ''}${data.url}`);
      toast('Enlace copiado');
    } catch (e) {
      toast('No se pudo copiar el enlace');
    }
  }
  function shareDay(date) {
    const d = dayByDate(date);
    shareOrCopy({ title: 'Road to LA', text: `DAY ${d.dayNumber}: ${d.title}. ${d.song} — ${d.artist}.`, url: `${pageURL()}#day-${date}` });
  }

  function resetProgress() {
    if (!window.confirm('¿Borrar los días vistos y completados de este dispositivo?')) return;
    store.opened = {};
    store.completed = {};
    store.confetti = '';
    save();
    ui.open.clear();
    renderAll();
    toast('Progreso borrado');
  }

  // ------------------------------------------------------------ fotos: carga, respaldos y créditos
  document.addEventListener('error', (e) => {
    const img = e.target;
    if (!(img instanceof HTMLImageElement) || !img.dataset.keys) return;
    const keys = img.dataset.keys.split(' ');
    const next = Number(img.dataset.i) + 1;
    if (next < keys.length && PHOTOS[keys[next]]) {
      img.dataset.i = String(next);
      img.alt = PHOTOS[keys[next]].alt;
      img.src = commonsURL(PHOTOS[keys[next]].file);
    } else {
      img.classList.add('is-failed');
    }
  }, true);
  document.addEventListener('load', (e) => {
    const img = e.target;
    if (!(img instanceof HTMLImageElement) || !img.dataset.keys) return;
    img.classList.add('is-loaded');
    const key = img.dataset.keys.split(' ')[Number(img.dataset.i)];
    const host = img.closest('.day, .place-card');
    if (!host || !PHOTOS[key]) return;
    host.dataset.photo = key;
    const credit = host.querySelector('[data-credit]');
    if (!credit) return;
    if (host.classList.contains('place-card')) {
      const ph = PHOTOS[key];
      credit.innerHTML = `Foto: ${esc(ph.author)}${ph.license ? `, ${esc(ph.license)}` : ''}. <a href="${commonsPage(ph.file)}" target="_blank" rel="noopener">Wikimedia Commons</a>`;
    } else {
      credit.innerHTML = creditHTML(dayByDate(host.dataset.day), host);
    }
  }, true);

  // ------------------------------------------------------------ tema y sonido
  function applyTheme() {
    const t = store.settings.theme === 'day' ? 'day' : 'night';
    el.root.dataset.theme = t;
    const meta = $('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', t === 'day' ? '#f6e7dc' : '#0a1030');
    $$('[data-action="theme"]').forEach((b) => {
      if (b.classList.contains('switch')) b.setAttribute('aria-checked', String(t === 'day'));
      else { b.setAttribute('aria-label', t === 'day' ? 'Cambiar a tema Noche' : 'Cambiar a tema Pacific Day'); b.innerHTML = icon(t === 'day' ? 'moon' : 'sun'); }
    });
    if (el.themeDesc) el.themeDesc.textContent = t === 'day' ? 'Pacific Day: claro, con cielo de costa.' : 'Noche: el tema original, azul medianoche.';
  }
  function applySound() {
    const on = !!store.settings.sound;
    $$('[data-action="sound"]').forEach((b) => {
      if (b.classList.contains('switch')) b.setAttribute('aria-checked', String(on));
      else { b.setAttribute('aria-pressed', String(on)); b.innerHTML = icon(on ? 'sound-on' : 'sound-off'); }
    });
  }
  let actx = null;
  function play(kind) {
    if (!store.settings.sound) return;
    try {
      actx = actx || new (window.AudioContext || window.webkitAudioContext)();
      if (actx.state === 'suspended') actx.resume();
      const notes = { open: [660, 880], close: [520], done: [784, 1047], tap: [620], celebrate: [523, 659, 784, 1047] }[kind] || [620];
      const t0 = actx.currentTime;
      notes.forEach((f, i) => {
        const o = actx.createOscillator();
        const g = actx.createGain();
        const t = t0 + i * 0.09;
        o.type = 'sine';
        o.frequency.value = f;
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(0.11, t + 0.015);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.24);
        o.connect(g).connect(actx.destination);
        o.start(t);
        o.stop(t + 0.26);
      });
    } catch (e) { /* audio no disponible */ }
  }

  // ------------------------------------------------------------ confeti (THE DAY)
  function confetti() {
    if (reduced()) return;
    const c = document.createElement('canvas');
    c.className = 'confetti';
    c.setAttribute('aria-hidden', 'true');
    document.body.appendChild(c);
    const ctx = c.getContext('2d');
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    c.width = window.innerWidth * dpr;
    c.height = window.innerHeight * dpr;
    const colors = ['#ffc24b', '#ff6b3d', '#ff2e88', '#fff4e4', '#5ec8ff'];
    const parts = Array.from({ length: 150 }, () => ({
      x: Math.random() * c.width, y: -Math.random() * c.height * 0.6,
      w: (5 + Math.random() * 6) * dpr, h: (8 + Math.random() * 8) * dpr,
      vx: (Math.random() - 0.5) * 2.2 * dpr, vy: (1.6 + Math.random() * 2.8) * dpr,
      r: Math.random() * Math.PI, vr: (Math.random() - 0.5) * 0.22, color: colors[(Math.random() * colors.length) | 0],
    }));
    const start = performance.now();
    function frame(t) {
      const age = t - start;
      ctx.clearRect(0, 0, c.width, c.height);
      parts.forEach((p) => {
        p.vy += 0.035 * dpr;
        p.x += p.vx + Math.sin(t / 380 + p.r) * 0.7 * dpr;
        p.y += p.vy;
        p.r += p.vr;
        ctx.save();
        ctx.globalAlpha = age > 3800 ? Math.max(0, 1 - (age - 3800) / 1400) : 1;
        ctx.translate(p.x, p.y);
        ctx.rotate(p.r);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        ctx.restore();
      });
      if (age < 5200) requestAnimationFrame(frame); else c.remove();
    }
    requestAnimationFrame(frame);
  }
  function maybeConfetti(force) {
    if (snap.phase !== 'theday') return;
    if (!force && store.confetti === snap.today) return;
    store.confetti = snap.today;
    if (!previewing) save();
    setTimeout(() => { confetti(); play('celebrate'); }, 700);
  }

  // ------------------------------------------------------------ notificaciones
  function setNotify(msg) { el.notifyStatus.textContent = msg; }
  async function swReady() {
    if (!('serviceWorker' in navigator)) return null;
    try {
      return await Promise.race([navigator.serviceWorker.ready, new Promise((r) => setTimeout(() => r(null), 4000))]);
    } catch (e) { return null; }
  }
  function b64urlToBytes(s) {
    const padding = '='.repeat((4 - (s.length % 4)) % 4);
    const bin = atob((s + padding).replace(/-/g, '+').replace(/_/g, '/'));
    return Uint8Array.from(bin, (ch) => ch.charCodeAt(0));
  }
  async function enableNotifications() {
    if (!('Notification' in window)) { setNotify('Este navegador no admite notificaciones.'); return; }
    let perm = Notification.permission;
    if (perm === 'default') { try { perm = await Notification.requestPermission(); } catch (e) { /* sin permiso */ } }
    if (perm !== 'granted') { setNotify('El permiso de notificaciones está bloqueado. Actívalo en la configuración del sitio en Chrome.'); return; }
    const reg = await swReady();
    if (!reg) { setNotify('Abre la app desde su enlace https para activar los recordatorios.'); return; }
    const notes = [];
    if (CONFIG.push.vapidPublicKey && reg.pushManager) {
      try {
        let sub = await reg.pushManager.getSubscription();
        if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64urlToBytes(CONFIG.push.vapidPublicKey) });
        el.subscriptionJson.value = JSON.stringify(sub);
        el.subscription.hidden = false;
        notes.push('Web Push activo: copia la suscripción de abajo y guárdala en GitHub.');
      } catch (err) {
        notes.push(`No se pudo activar Web Push (${(err && err.message) || err}).`);
      }
    }
    if ('periodicSync' in reg) {
      try {
        const st = await navigator.permissions.query({ name: 'periodic-background-sync' });
        if (st.state === 'granted') {
          await reg.periodicSync.register('road-to-la-daily', { minInterval: 12 * 3600 * 1000 });
          notes.push('Recordatorio local activo: Chrome lo muestra una vez al día, a partir de las 8:00 a. m., cuando el teléfono tiene conexión.');
        } else {
          notes.push('Para el recordatorio local, instala la app en la pantalla de inicio y vuelve a tocar “Activar recordatorio”.');
        }
      } catch (err) {
        notes.push('Este navegador no permite el recordatorio local.');
      }
    } else if (!CONFIG.push.vapidPublicKey) {
      notes.push('Este navegador no admite recordatorios locales. El README explica cómo activar Web Push gratis.');
    }
    store.settings.notify = true;
    save();
    setNotify(notes.join(' '));
  }
  async function testNotification() {
    if (!('Notification' in window)) { setNotify('Este navegador no admite notificaciones.'); return; }
    if (Notification.permission !== 'granted') {
      await enableNotifications();
      if (Notification.permission !== 'granted') return;
    }
    const reg = await swReady();
    const msg = notificationFor(snap.today) || { title: 'ROAD TO LA', body: 'Así se ve el recordatorio diario.', url: './#today' };
    const opts = { body: msg.body, icon: './assets/icons/icon-192.png', badge: './assets/icons/badge-96.png', tag: 'road-to-la-test', data: { url: msg.url } };
    try {
      if (reg) await reg.showNotification(msg.title, opts);
      else new Notification(msg.title, opts);
      setNotify('Notificación de prueba enviada.');
    } catch (e) {
      setNotify('No se pudo mostrar la notificación de prueba.');
    }
  }

  // ------------------------------------------------------------ instalación (PWA)
  let installEvt = null;
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    installEvt = e;
    el.installBtn.hidden = false;
  });
  window.addEventListener('appinstalled', () => {
    installEvt = null;
    el.installBtn.hidden = true;
    toast('Road to LA quedó instalada');
  });
  async function promptInstall() {
    if (!installEvt) return;
    installEvt.prompt();
    try { await installEvt.userChoice; } catch (e) { /* cancelado */ }
    installEvt = null;
    el.installBtn.hidden = true;
  }

  // ------------------------------------------------------------ avisos
  let toastTimer = 0;
  function toast(msg, action) {
    el.toast.innerHTML = `<span>${esc(msg)}</span>${action ? `<button type="button" class="toast__btn">${esc(action.label)}</button>` : ''}`;
    el.toast.hidden = false;
    requestAnimationFrame(() => el.toast.classList.add('is-on'));
    if (action) el.toast.querySelector('button').addEventListener('click', action.run, { once: true });
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      el.toast.classList.remove('is-on');
      setTimeout(() => { el.toast.hidden = true; }, 300);
    }, action ? 9000 : 2600);
  }

  // ------------------------------------------------------------ eventos
  document.addEventListener('click', (e) => {
    const a = e.target.closest('[data-action]');
    if (a) {
      const act = a.dataset.action;
      const card = a.closest('.day');
      switch (act) {
        case 'toggle': if (card) toggleDay(card.dataset.day); break;
        case 'done': if (card) toggleDone(card.dataset.day); break;
        case 'share': if (card) shareDay(card.dataset.day); break;
        case 'goto': goTo(a.dataset.date); break;
        case 'goto-open': goTo(a.dataset.date, { open: true }); break;
        case 'open-today': openToday(); break;
        case 'go-days': scrollToEl(document.getElementById('days')); break;
        case 'filter': ui.filter = a.dataset.filter; renderChips(); renderList(); play('tap'); break;
        case 'clear-filters': ui.filter = 'all'; ui.query = ''; el.search.value = ''; renderChips(); renderList(); break;
        case 'toggle-past': ui.pastOpen = !ui.pastOpen; renderList(); break;
        case 'theme': store.settings.theme = store.settings.theme === 'day' ? 'night' : 'day'; save(); applyTheme(); play('tap'); break;
        case 'sound': store.settings.sound = !store.settings.sound; save(); applySound(); play('tap'); break;
        case 'notify': enableNotifications(); break;
        case 'notify-test': testNotification(); break;
        case 'copy-subscription':
          navigator.clipboard.writeText(el.subscriptionJson.value).then(() => toast('Suscripción copiada'), () => { el.subscriptionJson.select(); toast('Selecciona y copia el texto'); });
          break;
        case 'install': promptInstall(); break;
        case 'share-app': shareOrCopy({ title: 'Road to LA', text: 'The countdown to California.', url: pageURL() }); break;
        case 'reset': resetProgress(); break;
        case 'confetti': confetti(); play('celebrate'); break;
        default: break;
      }
      return;
    }
    const link = e.target.closest('a[href^="#"]');
    if (!link) return;
    const id = link.getAttribute('href').slice(1);
    if (id === 'today') { e.preventDefault(); openToday(); }
    else if (/^day-\d{4}-\d{2}-\d{2}$/.test(id)) { e.preventDefault(); goTo(id.slice(4), { open: true }); }
  });

  let searchTimer = 0;
  el.search.addEventListener('input', () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => { ui.query = el.search.value; renderList(); }, 140);
  });

  // ------------------------------------------------------------ desplazamiento: barra, parallax, navegación
  const sections = ['home', 'days', 'trip', 'about'].map((id) => document.getElementById(id));
  let scrollQueued = false;
  let lastActive = '';
  function onScroll() {
    if (scrollQueued) return;
    scrollQueued = true;
    requestAnimationFrame(() => { scrollQueued = false; scrollUpdate(); });
  }
  function scrollUpdate() {
    const y = window.scrollY;
    const vh = window.innerHeight;
    const heroH = el.hero.offsetHeight;
    el.topbar.classList.toggle('is-solid', y > heroH - 90);
    el.hero.classList.toggle('is-offscreen', y > heroH);
    if (!reduced() && y < heroH) {
      if (el.heroPalms) el.heroPalms.style.transform = `translate3d(0, ${(y * 0.16).toFixed(1)}px, 0)`;
      const photo = $('.hero__photo');
      if (photo) photo.style.transform = `translate3d(0, ${(y * 0.32).toFixed(1)}px, 0) scale(1.08)`;
    }
    let active = 'home';
    sections.forEach((s) => { if (s && s.getBoundingClientRect().top <= vh * 0.35) active = s.id; });
    const todayCard = $('.day--today');
    if (todayCard) {
      const r = todayCard.getBoundingClientRect();
      if (r.top < vh * 0.55 && r.bottom > vh * 0.3) active = 'today';
    }
    if (active !== lastActive) {
      lastActive = active;
      $$('.dock a').forEach((a) => { if (a.dataset.nav === active) a.setAttribute('aria-current', 'true'); else a.removeAttribute('aria-current'); });
    }
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll, { passive: true });

  if ('IntersectionObserver' in window && !reduced()) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((en) => { if (en.isIntersecting) { en.target.classList.add('is-lit'); io.unobserve(en.target); } });
    }, { threshold: 0.6 });
    $$('.neon-title').forEach((t) => io.observe(t));
  } else {
    $$('.neon-title').forEach((t) => t.classList.add('is-lit'));
  }

  // ------------------------------------------------------------ reloj
  function renderAll() {
    renderHero();
    renderFilmstrip();
    renderStats();
    renderChips();
    renderList();
    renderTrip();
    updateLAClock();
  }
  let timer = 0;
  function schedule() {
    clearTimeout(timer);
    timer = setTimeout(tick, 1000 - (now() % 1000) + 15);
  }
  function tick() {
    const prev = snap;
    snap = snapshot();
    if (snap.today !== prev.today || snap.phase !== prev.phase) {
      renderAll();
      if (snap.phase === 'theday' && prev.phase !== 'theday') maybeConfetti(true);
      else if (snap.ti > prev.ti && snap.phase !== 'before') toast('Se abrió un día nuevo');
    } else {
      updateClock();
      if (snap.p.s === 0) updateLAClock();
    }
    schedule();
  }
  document.addEventListener('visibilitychange', () => { if (!document.hidden) tick(); });
  window.addEventListener('pageshow', (e) => { if (e.persisted) tick(); });

  function handleHash() {
    const h = decodeURIComponent(location.hash.slice(1));
    if (h === 'today') openToday();
    else if (/^day-\d{4}-\d{2}-\d{2}$/.test(h)) goTo(h.slice(4), { open: true });
    else if (/^place-/.test(h)) scrollToEl(document.getElementById(h));
  }

  // ------------------------------------------------------------ inicio
  applyTheme();
  applySound();
  renderAll();
  if (el.heroPhoto && el.heroPhoto.complete && el.heroPhoto.naturalWidth) el.heroPhoto.classList.add('is-loaded');
  if (previewing) {
    el.preview.hidden = false;
    el.preview.innerHTML = `Vista previa: ${esc(previewing.replace('T', ' '))} <a href="${esc(location.pathname)}">Salir</a>`;
  }
  const standalone = (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) || navigator.standalone;
  if (standalone) el.installDesc.textContent = 'Ya estás usando la app instalada. Funciona sin conexión.';
  else if (/iphone|ipad|ipod/i.test(navigator.userAgent)) el.installDesc.textContent = 'En iPhone: abre el menú Compartir de Safari y elige “Agregar a pantalla de inicio”.';
  if (store.settings.notify && 'Notification' in window && Notification.permission === 'granted') setNotify('Recordatorio activado en este dispositivo.');
  scrollUpdate();
  schedule();
  setTimeout(handleHash, 60);
  maybeConfetti(false);

  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1')) {
    const hadController = !!navigator.serviceWorker.controller;
    window.addEventListener('load', () => { navigator.serviceWorker.register('./sw.js').catch(() => {}); });
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!hadController) return;
      toast('Hay una versión nueva de Road to LA', { label: 'Actualizar', run: () => window.location.reload() });
    });
  }
})();
