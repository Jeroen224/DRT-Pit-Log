/* Daems Racing Team · Pit Log
 * Tire pressures and kart setups, saved on the device, exportable to Excel.
 * Plain JavaScript, no build step, works offline once loaded.
 */
(function () {
  'use strict';

  const STORE_KEY = 'drt-pitlog-v1';
  const CORNERS = ['FL', 'FR', 'BL', 'BR'];
  const SESSIONS = ['Practice', 'Qualifying', 'Heat', 'Superheat', 'Final'];

  // ---------- State ----------
  function today() {
    const d = new Date();
    const p = (n) => String(n).padStart(2, '0');
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
  }
  function blankTires() {
    return { session: '', sessionNo: '', condition: '', rim: '', cold: { FL: '', FR: '', BL: '', BR: '' }, hot: { FL: '', FR: '', BL: '', BR: '' }, comment: '' };
  }
  function blankSetup() {
    return {
      sessionNo: '', category: '', categoryOther: '', engine: '', gearing: '', gearingOther: '', sprocket: '', carb: '', exhaust: '',
      rearHeight: '', rearWidth: '', axleType: '', axleLength: '', frontHeight: '', frontWidth: '', caster: '', casterOther: '',
      frontBar: '', frontBarOther: '', comment: ''
    };
  }
  const clone = (o) => JSON.parse(JSON.stringify(o));
  const filled = (v) => String(v == null ? '' : v).trim() !== '';

  function load() {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      if (!raw) return null;
      const s = JSON.parse(raw);
      s.tires = Object.assign(blankTires(), s.tires || {});
      s.setup = Object.assign(blankSetup(), s.setup || {});
      s.log = Array.isArray(s.log) ? s.log : [];
      return s;
    } catch (e) { return null; }
  }
  const state = load() || {
    screen: 'event',
    event: { driver: '', mechanic: '', date: today(), circuit: '' },
    tires: blankTires(),
    setup: blankSetup(),
    editingId: null,
    log: []
  };
  let confirmDelete = false;
  let confirmClear = false;

  function persist() {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch (e) { /* storage full or blocked */ }
  }

  // ---------- Helpers ----------
  function esc(v) {
    return String(v == null ? '' : v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function getPath(path) { return path.split('.').reduce((o, k) => (o == null ? o : o[k]), state); }
  function setPath(path, v) {
    const keys = path.split('.');
    let o = state;
    for (let i = 0; i < keys.length - 1; i++) o = o[keys[i]];
    o[keys[keys.length - 1]] = v;
  }
  // Pressures fill like a calculator: "14" -> 0.14, "145" -> 1.45. Stored with a dot, shown with a comma.
  function pressIn(text) {
    const digits = String(text).replace(/\D/g, '').replace(/^0+/, '').slice(0, 3);
    return digits ? (parseInt(digits, 10) / 100).toFixed(2) : '';
  }
  const pressShow = (v) => (v ? String(v).replace('.', ',') : '');
  const numIn = (v) => String(v).replace(',', '.').replace(/[^0-9.\-]/g, '');
  const intIn = (v) => String(v).replace(/\D/g, '').replace(/^0+/, '').slice(0, 2);
  function stamp() {
    const d = new Date();
    return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
  }
  function niceDate(iso) {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || '');
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return m ? m[3] + ' ' + months[Number(m[2]) - 1] + ' ' + m[1] : (iso || 'Date');
  }

  // The form for the next new entry, based on the last one saved:
  // tires keep the session type, setups keep every setting; both get session number + 1.
  function nextFrom(type) {
    const last = state.log.filter((x) => x.type === type).slice(-1)[0];
    const bump = (v) => { const n = parseInt(v, 10); return n ? String(Math.min(99, n + 1)) : ''; };
    if (type === 'tires') {
      const t = blankTires();
      if (last) { t.session = last.data.session; t.sessionNo = bump(last.data.sessionNo); }
      return t;
    }
    if (!last) return blankSetup();
    const s = Object.assign(blankSetup(), clone(last.data));
    s.sessionNo = bump(last.data.sessionNo);
    s.comment = '';
    return s;
  }

  // ---------- Validation ----------
  function canSave() {
    const sc = state.screen;
    if (sc === 'event') { const e = state.event; return filled(e.driver) && filled(e.mechanic) && filled(e.date) && filled(e.circuit); }
    if (sc === 'tires') { const t = state.tires; return filled(t.session) && filled(t.sessionNo) && filled(t.condition) && filled(t.rim) && CORNERS.every((c) => filled(t.cold[c])); }
    if (sc === 'setup') return filled(state.setup.category) && filled(state.setup.sessionNo);
    return false;
  }

  // ---------- Templates ----------
  const ICON = {
    back: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 18l-6-6 6-6"/></svg>',
    gauge: '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#0E1A3A" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="3.5"/><path d="M12 3v5.5M12 15.5V21M3 12h5.5M15.5 12H21"/></svg>',
    wrench: '<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14.7 6.3a4 4 0 0 0-5.4 5.2L3.5 17.3a1.8 1.8 0 0 0 2.5 2.5l5.8-5.8a4 4 0 0 0 5.2-5.4l-2.5 2.5-2.3-.4-.4-2.3z"/></svg>',
    pencil: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#5B6478" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="flex-shrink:0"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/></svg>',
    excel: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M14 3v6h6"/><path d="M9 13l6 6M15 13l-6 6"/></svg>',
    tick: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12l5 5L20 7"/></svg>'
  };

  const kicker = (text) => '<div class="kicker"><span class="bar-y"></span><span>' + esc(text) + '</span></div>';
  const secHead = (n, title, opts) => {
    opts = opts || {};
    const t = opts.forId ? '<label class="sec-title" for="' + opts.forId + '">' + esc(title) + '</label>' : '<h2 class="sec-title">' + esc(title) + '</h2>';
    return '<div class="sec-head">' + (n ? '<span class="num ' + (opts.numCls || '') + '">' + n + '</span>' : '') + t +
      (opts.aside ? '<span class="sec-aside">' + esc(opts.aside) + '</span>' : '') + '</div>';
  };
  function input(id, path, opts) {
    opts = opts || {};
    const v = opts.kind === 'press' ? pressShow(getPath(path)) : getPath(path);
    const cls = 'input' + (opts.hl ? ' hl' : '') + (opts.hl && filled(v) ? ' filled' : '');
    const mode = opts.kind === 'press' || opts.kind === 'int' ? 'numeric' : opts.kind === 'num' ? 'decimal' : '';
    return '<input class="' + cls + '" id="' + id + '" type="' + (opts.type || 'text') + '"' + (mode ? ' inputmode="' + mode + '"' : '') +
      ' autocomplete="off" placeholder="' + esc(opts.ph || '') + '" value="' + esc(v) + '" data-bind="' + path + '" data-kind="' + (opts.kind || 'text') + '"' +
      (opts.aria ? ' aria-label="' + esc(opts.aria) + '"' : '') + '>';
  }
  function field(label, id, path, opts) {
    opts = opts || {};
    const inner = opts.unit
      ? '<div class="with-unit">' + input(id, path, opts) + '<span class="unit">' + esc(opts.unit) + '</span></div>'
      : input(id, path, opts);
    return '<div class="field"><label class="lbl" for="' + id + '">' + esc(label) + '</label>' + inner + '</div>';
  }
  function choices(path, options, opts) {
    opts = opts || {};
    const cur = getPath(path);
    const style = opts.cols ? ' style="grid-template-columns: repeat(' + opts.cols + ', minmax(0, 1fr))"' : '';
    return '<div class="choices' + (opts.cols ? ' cols' : '') + '"' + style + (opts.label ? ' role="group" aria-label="' + esc(opts.label) + '"' : '') + '>' +
      options.map((o) => '<button type="button" class="choice' + (opts.tall ? ' tall' : '') + (cur === o ? ' on' : '') + '" aria-pressed="' + (cur === o) +
        '" data-pick="' + path + '" data-value="' + esc(o) + '">' + esc(o) + '</button>').join('') + '</div>';
  }
  function otherInput(path, cond, aria, ph) {
    return cond ? input(path.replace(/\./g, '-'), path, { aria: aria, ph: ph }) : '';
  }
  function stepper(group, n) {
    const id = group + '-sessno';
    return '<section class="card">' + secHead(n, 'Session number', { forId: id }) +
      '<div class="stepper">' +
      '<button type="button" class="step-btn" aria-label="Session number down" data-action="dec" data-group="' + group + '">−</button>' +
      input(id, group + '.sessionNo', { kind: 'int', hl: true, ph: 'e.g. 2' }) +
      '<button type="button" class="step-btn plus" aria-label="Session number up" data-action="inc" data-group="' + group + '">+</button>' +
      '</div></section>';
  }
  function pressures(which, n, title, aside, numCls) {
    return '<section class="card">' + secHead(n, title, { aside: aside, numCls: numCls }) +
      '<span class="axle-lbl">▲ FRONT</span><div class="grid2 press">' +
      CORNERS.map((c) => {
        const id = which + '-' + c;
        return '<div class="field"><label class="lbl" for="' + id + '">' + c + '</label>' +
          input(id, 'tires.' + which + '.' + c, { kind: 'press', hl: true, ph: '0,00' }) + '</div>';
      }).join('') +
      '</div><span class="axle-lbl">REAR</span></section>';
  }
  function entryList(title, items, emptyText, countLabel) {
    return '<div class="stack" style="gap:10px">' +
      '<div class="list-head"><span class="kicker"><span class="bar-y"></span></span><h2 class="sec-title">' + esc(title) + '</h2><span class="sec-aside">' + esc(countLabel) + '</span></div>' +
      (items.length ? items.map((it) =>
        '<button type="button" class="entry' + (it.editing ? ' editing' : '') + '" data-action="open" data-id="' + esc(it.id) + '">' +
        '<span class="tag ' + it.tagCls + '">' + it.tag + '</span>' +
        '<span class="entry-main"><span class="entry-title">' + esc(it.title) + '</span><span class="entry-sub">' + esc(it.sub) + '</span></span>' +
        '<span class="badge' + (it.badgeY ? ' y' : '') + '">' + esc(it.badge) + '</span>' + ICON.pencil + '</button>').join('')
        : '<div class="empty">' + esc(emptyText) + '</div>') +
      '</div>';
  }

  // ---------- Entry list data ----------
  const SETUP_FIELDS = [
    ['category', 'Category', 'categoryOther'], ['engine', 'Engine'], ['gearing', 'Gearing', 'gearingOther'], ['sprocket', 'Sprocket'],
    ['carb', 'Carb'], ['exhaust', 'Exhaust'], ['rearHeight', 'Rear height'], ['rearWidth', 'Rear width'], ['axleType', 'Axle'],
    ['axleLength', 'Axle length'], ['frontHeight', 'Front height'], ['frontWidth', 'Rings'], ['caster', 'Caster', 'casterOther'], ['frontBar', 'Front bar', 'frontBarOther']
  ];
  const fieldVal = (d, f) => (f[2] && d[f[0]] === 'Other' ? (d[f[2]] || 'Other') : (d[f[0]] || '—'));

  function tireItems() {
    return state.log.filter((x) => x.type === 'tires').slice().reverse().map((x) => {
      const d = x.data;
      const done = CORNERS.every((c) => filled(d.hot[c]));
      return {
        id: x.id, editing: x.id === state.editingId, tag: 'TP', tagCls: 'tp',
        title: d.session + (d.sessionNo ? ' ' + d.sessionNo : '') + ' · ' + d.condition,
        sub: (x.event && x.event.date !== state.event.date ? niceDate(x.event.date) + ' ' : '') + x.time + ' · Cold ' + CORNERS.map((k) => pressShow(d.cold[k])).join(' / ') + ' · Rim ' + d.rim + '°C',
        badge: done ? 'COMPLETE' : 'HOT PENDING', badgeY: !done
      };
    });
  }
  function setupItems() {
    const setups = state.log.filter((x) => x.type === 'setup');
    return setups.map((x, i) => {
      const d = x.data;
      const prev = i > 0 ? setups[i - 1].data : null;
      const changed = prev ? SETUP_FIELDS.filter((f) => fieldVal(d, f) !== fieldVal(prev, f)) : [];
      const when = (x.event && x.event.date !== state.event.date ? niceDate(x.event.date) + ' ' : '') + x.time;
      const sub = !prev ? when + ' · Baseline setup'
        : when + ' · ' + (changed.length ? 'Changed: ' + changed.map((f) => f[1] + ' ' + fieldVal(prev, f) + ' → ' + fieldVal(d, f)).join(', ') : 'No changes vs previous');
      return {
        id: x.id, editing: x.id === state.editingId, tag: 'SET', tagCls: 'set',
        title: 'Session ' + (d.sessionNo || '—') + ' · ' + fieldVal(d, SETUP_FIELDS[0]),
        sub: sub,
        badge: !prev ? 'BASE' : (changed.length ? changed.length + ' CHANGED' : 'SAME'), badgeY: !!(prev && changed.length)
      };
    }).reverse();
  }

  // ---------- Screens ----------
  function screenEvent() {
    return '<div class="stack-lg">' +
      '<div class="title-block">' + kicker('Step 1 · Event') + '<h1 class="big">New event</h1>' +
      '<p class="lead">Logged once and attached to every tire and setup entry for this event.</p></div>' +
      '<div class="card lg">' +
      field('Driver', 'ev-driver', 'event.driver', { ph: 'Driver name' }) +
      field('Mechanic', 'ev-mech', 'event.mechanic', { ph: 'Your name' }) +
      '<div class="grid2">' + field('Date', 'ev-date', 'event.date', { type: 'date' }) + field('Circuit', 'ev-circuit', 'event.circuit', { ph: 'e.g. Genk' }) + '</div>' +
      '</div></div>';
  }

  function screenMenu() {
    const e = state.event;
    const nT = state.log.filter((x) => x.type === 'tires').length;
    const nS = state.log.filter((x) => x.type === 'setup').length;
    return '<div class="stack-lg">' +
      '<div class="event-card"><div class="ring"></div>' +
      '<div style="display:flex;flex-direction:column;gap:4px"><span class="event-kicker">CURRENT EVENT</span>' +
      '<span class="event-driver">' + esc(e.driver || 'Driver') + '</span>' +
      '<span style="font-size:15px;font-weight:600">' + esc(e.circuit || 'Circuit') + ' · ' + esc(niceDate(e.date)) + '</span></div>' +
      '<div class="event-row"><span>Mechanic: <strong>' + esc(e.mechanic || '—') + '</strong></span>' +
      '<button type="button" class="btn-y" data-action="event">Edit</button></div></div>' +

      '<div class="stack" style="gap:12px">' + kicker('Step 2 · What are you logging?') +
      '<div class="tiles">' +
      '<button type="button" class="tile" data-action="tires"><span class="tile-icon" style="background:var(--yellow)">' + ICON.gauge + '</span>' +
      '<span><span class="tile-title">Tire pressures</span><span class="tile-sub">Cold &amp; hot, per session</span></span></button>' +
      '<button type="button" class="tile" data-action="setup"><span class="tile-icon" style="background:var(--blue)">' + ICON.wrench + '</span>' +
      '<span><span class="tile-title">Setup</span><span class="tile-sub">Engine, back end &amp; front end</span></span></button>' +
      '</div></div>' +

      '<div class="stack" style="gap:12px"><h2 style="margin:0;font-size:17px;font-weight:800">Logged</h2>' +
      '<div class="grid2">' +
      '<div class="stat"><span class="tag tp">TP</span><span><b>' + nT + '</b><small>tire entries</small></span></div>' +
      '<div class="stat"><span class="tag set">SET</span><span><b>' + nS + '</b><small>setups</small></span></div></div>' +
      (state.log.length
        ? '<button type="button" class="btn-outline" data-action="export">' + ICON.excel + 'Export to Excel (.xlsx)</button>' +
          '<p class="note" style="text-align:center">One sheet for tire pressures, one for setups. Entries are saved on this device.</p>' +
          '<div style="display:flex;justify-content:center"><button type="button" class="btn-text' + (confirmClear ? ' confirm' : '') + '" data-action="clear">' +
          (confirmClear ? 'Tap again to delete all entries' : 'Clear all entries…') + '</button></div>'
        : '<p class="note" style="text-align:center">Saved entries are listed at the bottom of the Tire pressures and Setup screens.</p>') +
      '</div></div>';
  }

  function screenTires() {
    const t = state.tires;
    const items = tireItems();
    return '<div class="stack">' +
      '<div class="title-block" style="padding-bottom:4px">' +
      kicker(state.editingId ? 'Edit entry · add hot pressures' : 'New entry · ' + (state.event.circuit || 'Tires')) +
      '<h1 class="big" style="font-size:38px">Tire pressures</h1></div>' +
      '<section class="card">' + secHead(1, 'Session') + choices('tires.session', SESSIONS, { label: 'Session' }) + '</section>' +
      stepper('tires', 2) +
      '<section class="card">' + secHead(3, 'Track condition') + choices('tires.condition', ['Dry', 'Wet'], { cols: 2, tall: true, label: 'Track condition' }) + '</section>' +
      '<section class="card">' + secHead(4, 'Rim temperature', { forId: 't-rim' }) +
      '<div class="with-unit">' + input('t-rim', 'tires.rim', { kind: 'num', ph: '0' }) + '<span class="unit">°C</span></div></section>' +
      pressures('cold', 5, 'Cold pressures', 'bar') +
      pressures('hot', 6, 'Hot pressures', 'bar · after session', 'y') +
      '<section class="card">' + secHead(7, 'Comments', { forId: 't-comment', aside: 'optional', numCls: 'soft' }) +
      '<textarea class="textarea" id="t-comment" rows="4" placeholder="Driver feedback, grip, wear, anything worth noting…" data-bind="tires.comment" data-kind="text">' + esc(t.comment) + '</textarea></section>' +
      entryList('Logged tire pressures', items, 'No tire pressures saved yet. Tap a saved entry to add hot pressures or change it.', items.length === 1 ? '1 entry' : items.length + ' entries') +
      '</div>';
  }

  function screenSetup() {
    const s = state.setup;
    const items = setupItems();
    const prefilled = !state.editingId && state.log.some((x) => x.type === 'setup');
    return '<div class="stack">' +
      '<div class="title-block" style="padding-bottom:4px">' +
      kicker(state.editingId ? 'Edit setup' : 'New setup · ' + (state.event.driver || 'Kart')) +
      '<h1 class="big" style="font-size:38px">Kart setup</h1>' +
      (prefilled ? '<p class="note">Filled in from your previous setup. Only change what\'s different.</p>' : '') + '</div>' +
      stepper('setup', '') +
      '<section class="card">' + secHead('', 'Category') + choices('setup.category', ['Mini', 'Junior', 'Senior', 'DD2', 'Other'], { label: 'Category' }) +
      otherInput('setup.categoryOther', s.category === 'Other', 'Other category', 'Category name') + '</section>' +

      '<section class="card" style="gap:16px">' + secHead(1, 'Engine') +
      field('Engine', 's-engine', 'setup.engine', { ph: 'Engine name / number' }) +
      '<div class="field"><span class="lbl">Gearing</span>' + choices('setup.gearing', ['11', '12', '13', 'Other'], { cols: 4, label: 'Gearing' }) +
      otherInput('setup.gearingOther', s.gearing === 'Other', 'Other gearing', 'Enter gearing') + '</div>' +
      field('Sprocket', 's-sprocket', 'setup.sprocket', { kind: 'num', ph: 'e.g. 80' }) +
      field('Carburettor', 's-carb', 'setup.carb', { ph: 'Carburettor name' }) +
      field('Exhaust', 's-exhaust', 'setup.exhaust', { ph: 'Exhaust name' }) + '</section>' +

      '<section class="card" style="gap:16px">' + secHead(2, 'Back end') +
      '<div class="field"><span class="lbl">Ride height</span>' + choices('setup.rearHeight', ['Low', 'Middle', 'High'], { cols: 3, label: 'Rear ride height' }) + '</div>' +
      '<div class="grid2">' + field('Rear width', 's-rwidth', 'setup.rearWidth', { kind: 'num', ph: '0', unit: 'cm' }) +
      field('Axle length', 's-alength', 'setup.axleLength', { kind: 'num', ph: '0', unit: 'cm' }) + '</div>' +
      field('Axle type', 's-axle', 'setup.axleType', { ph: 'e.g. medium / hard' }) + '</section>' +

      '<section class="card" style="gap:16px">' + secHead(3, 'Front end') +
      '<div class="field"><span class="lbl">Ride height</span>' + choices('setup.frontHeight', ['Low', 'Middle', 'High'], { cols: 3, label: 'Front ride height' }) + '</div>' +
      '<div class="field"><span class="lbl">Front width · rings</span>' + choices('setup.frontWidth', ['1', '2', '3', '4', '5', '6'], { cols: 6, label: 'Front width rings' }) + '</div>' +
      '<div class="field"><span class="lbl">Caster</span>' + choices('setup.caster', ['Standard', 'Half', 'Full', 'Other'], { cols: 4, label: 'Caster' }) +
      otherInput('setup.casterOther', s.caster === 'Other', 'Other caster', 'Enter caster setting') + '</div>' +
      '<div class="field"><span class="lbl">Front bar</span>' + choices('setup.frontBar', ['Standard', 'Chrome', 'Brown', 'Other'], { cols: 4, label: 'Front bar' }) +
      otherInput('setup.frontBarOther', s.frontBar === 'Other', 'Other front bar', 'Enter front bar') + '</div></section>' +

      '<section class="card">' + secHead(4, 'Comments', { forId: 's-comment', aside: 'optional', numCls: 'soft' }) +
      '<textarea class="textarea" id="s-comment" rows="4" placeholder="Why this change, driver feedback, balance…" data-bind="setup.comment" data-kind="text">' + esc(s.comment) + '</textarea></section>' +
      entryList('Logged setups', items, 'No setups saved yet. Each saved setup shows what changed compared to the one before.', items.length === 1 ? '1 setup' : items.length + ' setups') +
      '</div>';
  }

  function footer() {
    const sc = state.screen;
    if (sc === 'menu') return '';
    const label = sc === 'event' ? 'Save & continue →'
      : sc === 'tires' ? (state.editingId ? 'Update entry' : (CORNERS.every((c) => filled(state.tires.hot[c])) ? 'Save entry' : 'Save cold pressures'))
      : (state.editingId ? 'Update setup' : 'Save setup');
    const hint = sc === 'event' ? 'Fill in driver, mechanic, date and circuit'
      : sc === 'tires' ? 'Session, session number, track, rim temp and all four cold pressures are needed to save'
      : 'Session number and category are needed to save';
    const ok = canSave();
    return '<footer class="bar"><span class="bar-hint" id="bar-hint"' + (ok ? ' hidden' : '') + '>' + esc(hint) + '</span>' +
      '<div class="bar-row">' +
      (state.editingId && (sc === 'tires' || sc === 'setup')
        ? '<button type="button" class="btn-delete' + (confirmDelete ? ' confirm' : '') + '" data-action="delete">' + (confirmDelete ? 'Tap to confirm' : 'Delete') + '</button>' : '') +
      '<button type="button" class="btn-primary" id="btn-save" data-action="save"' + (ok ? '' : ' disabled') + '>' + esc(label) + '</button>' +
      '</div></footer>';
  }

  // ---------- Render ----------
  const app = document.getElementById('app');
  function render(keepScroll) {
    const prev = app.querySelector('.content');
    const top = keepScroll && prev ? prev.scrollTop : 0;
    const sc = state.screen;
    const body = sc === 'event' ? screenEvent() : sc === 'menu' ? screenMenu() : sc === 'tires' ? screenTires() : screenSetup();
    app.innerHTML =
      '<header class="top"><img src="logo.png" alt="Daems Racing" class="logo">' +
      (sc === 'tires' || sc === 'setup' ? '<button type="button" class="back" data-action="menu">' + ICON.back + 'Menu</button>' : '') +
      '</header><main class="content">' + body + '</main>' + footer();
    const c = app.querySelector('.content');
    if (c) c.scrollTop = top;
  }
  // Light update while typing: keep focus, just refresh the save button and highlights.
  function refreshLive(inputEl) {
    if (inputEl && inputEl.classList.contains('hl')) inputEl.classList.toggle('filled', filled(inputEl.value));
    const btn = document.getElementById('btn-save');
    const hint = document.getElementById('bar-hint');
    const ok = canSave();
    if (btn) {
      btn.disabled = !ok;
      if (state.screen === 'tires' && !state.editingId) btn.textContent = CORNERS.every((c) => filled(state.tires.hot[c])) ? 'Save entry' : 'Save cold pressures';
    }
    if (hint) hint.hidden = ok;
  }

  // ---------- Toast ----------
  const toastEl = document.getElementById('toast');
  let toastT;
  function toast(msg) {
    toastEl.innerHTML = '<span class="tick">' + ICON.tick + '</span><span>' + esc(msg) + '</span>';
    toastEl.hidden = false;
    clearTimeout(toastT);
    toastT = setTimeout(() => { toastEl.hidden = true; }, 2800);
  }

  // ---------- Actions ----------
  function go(screen, extra) {
    Object.assign(state, { screen: screen, editingId: null }, extra || {});
    confirmDelete = false; confirmClear = false;
    persist(); render();
  }
  function saveEntry() {
    const sc = state.screen;
    if (sc === 'event') { go('menu'); return; }
    const type = sc;
    const data = clone(state[type]);
    const evSnap = Object.assign({}, state.event);
    const wasEditing = !!state.editingId;
    if (wasEditing) {
      state.log = state.log.map((x) => (x.id === state.editingId ? Object.assign({}, x, { data: data, event: evSnap, time: stamp() }) : x));
    } else {
      state.log = state.log.concat([{ id: 'e' + Date.now(), type: type, data: data, event: evSnap, time: stamp() }]);
    }
    state[type] = nextFrom(type);
    state.editingId = null;
    confirmDelete = false;
    persist(); render();
    const nextNo = Math.min(99, (parseInt(data.sessionNo, 10) || 0) + 1);
    if (type === 'tires') {
      const label = data.session + (data.sessionNo ? ' ' + data.sessionNo : '');
      toast(wasEditing ? label + ' updated' : label + ' saved · ready for ' + data.session + ' ' + nextNo);
    } else {
      toast(wasEditing ? 'Setup session ' + data.sessionNo + ' updated' : 'Setup saved · session ' + nextNo + ' pre-filled');
    }
  }
  let delT, clearT;
  function deleteEntry() {
    if (!confirmDelete) {
      confirmDelete = true; render(true);
      clearTimeout(delT); delT = setTimeout(() => { confirmDelete = false; render(true); }, 3000);
      return;
    }
    clearTimeout(delT);
    const type = state.screen;
    state.log = state.log.filter((x) => x.id !== state.editingId);
    state[type] = nextFrom(type);
    state.editingId = null; confirmDelete = false;
    persist(); render();
    toast('Entry deleted');
  }
  function clearAll() {
    if (!confirmClear) {
      confirmClear = true; render(true);
      clearTimeout(clearT); clearT = setTimeout(() => { confirmClear = false; if (state.screen === 'menu') render(true); }, 3000);
      return;
    }
    clearTimeout(clearT);
    state.log = []; state.tires = blankTires(); state.setup = blankSetup(); state.editingId = null; confirmClear = false;
    persist(); render(true);
    toast('All entries cleared');
  }
  function openEntry(id) {
    const x = state.log.find((e) => e.id === id);
    if (!x) return;
    state[x.type] = Object.assign(x.type === 'tires' ? blankTires() : blankSetup(), clone(x.data));
    state.editingId = x.id; state.screen = x.type; confirmDelete = false;
    persist(); render();
  }
  function stepSession(group, dir) {
    const cur = parseInt(state[group].sessionNo, 10) || 0;
    state[group].sessionNo = dir > 0 ? String(Math.min(99, cur + 1)) : (cur > 1 ? String(cur - 1) : '');
    persist();
    const el = document.getElementById(group + '-sessno');
    if (el) { el.value = state[group].sessionNo; refreshLive(el); }
  }

  app.addEventListener('click', (ev) => {
    const pick = ev.target.closest('[data-pick]');
    if (pick) {
      const path = pick.getAttribute('data-pick');
      const val = pick.getAttribute('data-value');
      setPath(path, getPath(path) === val ? '' : val);
      persist(); render(true);
      return;
    }
    const btn = ev.target.closest('[data-action]');
    if (!btn) return;
    switch (btn.getAttribute('data-action')) {
      case 'menu': go('menu'); break;
      case 'event': go('event'); break;
      case 'tires': go('tires', { tires: nextFrom('tires') }); break;
      case 'setup': go('setup', { setup: nextFrom('setup') }); break;
      case 'save': if (canSave()) saveEntry(); break;
      case 'delete': deleteEntry(); break;
      case 'clear': clearAll(); break;
      case 'open': openEntry(btn.getAttribute('data-id')); break;
      case 'inc': stepSession(btn.getAttribute('data-group'), 1); break;
      case 'dec': stepSession(btn.getAttribute('data-group'), -1); break;
      case 'export': exportXlsx(); break;
    }
  });

  app.addEventListener('input', (ev) => {
    const el = ev.target;
    const path = el.getAttribute && el.getAttribute('data-bind');
    if (!path) return;
    const kind = el.getAttribute('data-kind');
    let v = el.value;
    if (kind === 'press') v = pressIn(v);
    else if (kind === 'num') v = numIn(v);
    else if (kind === 'int') v = intIn(v);
    setPath(path, v);
    const shown = kind === 'press' ? pressShow(v) : v;
    if (el.value !== shown) el.value = shown;
    persist();
    refreshLive(el);
  });

  // ---------- Excel export (.xlsx, built in the browser) ----------
  function xmlEsc(v) { return String(v == null ? '' : v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function colName(i) { let s = ''; i += 1; while (i > 0) { const m = (i - 1) % 26; s = String.fromCharCode(65 + m) + s; i = Math.floor((i - 1) / 26); } return s; }
  function sheetXml(header, rows) {
    const cell = (v, r, c, style) => {
      const ref = colName(c) + r;
      const sv = String(v == null ? '' : v).trim();
      if (sv !== '' && style !== 1 && /^-?\d+(\.\d+)?$/.test(sv)) return '<c r="' + ref + '"><v>' + sv + '</v></c>';
      return '<c r="' + ref + '" t="inlineStr"' + (style ? ' s="' + style + '"' : '') + '><is><t xml:space="preserve">' + xmlEsc(sv) + '</t></is></c>';
    };
    let xml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">';
    xml += '<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>';
    xml += '<cols><col min="1" max="' + header.length + '" width="15" customWidth="1"/></cols><sheetData>';
    xml += '<row r="1">' + header.map((h, c) => cell(h, 1, c, 1)).join('') + '</row>';
    rows.forEach((row, i) => { xml += '<row r="' + (i + 2) + '">' + row.map((v, c) => cell(v, i + 2, c, 0)).join('') + '</row>'; });
    return xml + '</sheetData></worksheet>';
  }
  let crcTable;
  function crc32(bytes) {
    if (!crcTable) {
      crcTable = [];
      for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; crcTable[n] = c >>> 0; }
    }
    let c = 0xFFFFFFFF;
    for (let i = 0; i < bytes.length; i++) c = crcTable[(c ^ bytes[i]) & 0xFF] ^ (c >>> 8);
    return (c ^ 0xFFFFFFFF) >>> 0;
  }
  function zip(files) {
    const enc = new TextEncoder();
    const parts = []; const central = []; let offset = 0;
    files.forEach((f) => {
      const name = enc.encode(f.name); const data = enc.encode(f.text);
      const crc = crc32(data); const size = data.length;
      const lh = new DataView(new ArrayBuffer(30));
      lh.setUint32(0, 0x04034b50, true); lh.setUint16(4, 20, true); lh.setUint16(6, 0, true); lh.setUint16(8, 0, true);
      lh.setUint16(10, 0, true); lh.setUint16(12, 0x21, true); lh.setUint32(14, crc, true); lh.setUint32(18, size, true);
      lh.setUint32(22, size, true); lh.setUint16(26, name.length, true); lh.setUint16(28, 0, true);
      parts.push(new Uint8Array(lh.buffer), name, data);
      const ch = new DataView(new ArrayBuffer(46));
      ch.setUint32(0, 0x02014b50, true); ch.setUint16(4, 20, true); ch.setUint16(6, 20, true); ch.setUint16(8, 0, true);
      ch.setUint16(10, 0, true); ch.setUint16(12, 0, true); ch.setUint16(14, 0x21, true); ch.setUint32(16, crc, true);
      ch.setUint32(20, size, true); ch.setUint32(24, size, true); ch.setUint16(28, name.length, true); ch.setUint16(30, 0, true);
      ch.setUint16(32, 0, true); ch.setUint16(34, 0, true); ch.setUint16(36, 0, true); ch.setUint32(38, 0, true); ch.setUint32(42, offset, true);
      central.push(new Uint8Array(ch.buffer), name);
      offset += 30 + name.length + size;
    });
    const cdSize = central.reduce((a, b) => a + b.length, 0);
    const end = new DataView(new ArrayBuffer(22));
    end.setUint32(0, 0x06054b50, true); end.setUint16(4, 0, true); end.setUint16(6, 0, true); end.setUint16(8, files.length, true);
    end.setUint16(10, files.length, true); end.setUint32(12, cdSize, true); end.setUint32(16, offset, true); end.setUint16(20, 0, true);
    return new Blob(parts.concat(central, [new Uint8Array(end.buffer)]), { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  }
  function buildXlsx(log) {
    const ev = (x) => x.event || {};
    const other = (v, o) => (v === 'Other' ? (o || 'Other') : v);
    const tireRows = log.filter((x) => x.type === 'tires').map((x) => {
      const d = x.data; const e = ev(x);
      return [e.date, e.circuit, e.driver, e.mechanic, x.time, d.session, d.sessionNo || '', d.condition, d.rim,
        d.cold.FL, d.cold.FR, d.cold.BL, d.cold.BR, d.hot.FL, d.hot.FR, d.hot.BL, d.hot.BR, d.comment || ''];
    });
    const setupRows = log.filter((x) => x.type === 'setup').map((x) => {
      const d = x.data; const e = ev(x);
      return [e.date, e.circuit, e.driver, e.mechanic, x.time, d.sessionNo || '', other(d.category, d.categoryOther), d.engine,
        other(d.gearing, d.gearingOther), d.sprocket, d.carb, d.exhaust, d.rearHeight, d.rearWidth, d.axleType, d.axleLength,
        d.frontHeight, d.frontWidth, other(d.caster, d.casterOther), other(d.frontBar, d.frontBarOther), d.comment || ''];
    });
    const base = ['Date', 'Circuit', 'Driver', 'Mechanic', 'Time saved'];
    const s1 = sheetXml(base.concat(['Session', 'Session no.', 'Track', 'Rim temp (°C)', 'Cold FL (bar)', 'Cold FR (bar)', 'Cold BL (bar)', 'Cold BR (bar)',
      'Hot FL (bar)', 'Hot FR (bar)', 'Hot BL (bar)', 'Hot BR (bar)', 'Comments']), tireRows);
    const s2 = sheetXml(base.concat(['Session no.', 'Category', 'Engine', 'Gearing', 'Sprocket', 'Carburettor', 'Exhaust', 'Rear ride height',
      'Rear width (cm)', 'Axle type', 'Axle length (cm)', 'Front ride height', 'Front width (rings)', 'Caster', 'Front bar', 'Comments']), setupRows);
    const NS = 'http://schemas.openxmlformats.org';
    const SM = 'application/vnd.openxmlformats-officedocument.spreadsheetml';
    return zip([
      { name: '[Content_Types].xml', text: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="' + NS + '/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="' + SM + '.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="' + SM + '.worksheet+xml"/><Override PartName="/xl/worksheets/sheet2.xml" ContentType="' + SM + '.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="' + SM + '.styles+xml"/></Types>' },
      { name: '_rels/.rels', text: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="' + NS + '/package/2006/relationships"><Relationship Id="rId1" Type="' + NS + '/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>' },
      { name: 'xl/workbook.xml', text: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="' + NS + '/spreadsheetml/2006/main" xmlns:r="' + NS + '/officeDocument/2006/relationships"><sheets><sheet name="Tire pressures" sheetId="1" r:id="rId1"/><sheet name="Setups" sheetId="2" r:id="rId2"/></sheets></workbook>' },
      { name: 'xl/_rels/workbook.xml.rels', text: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="' + NS + '/package/2006/relationships"><Relationship Id="rId1" Type="' + NS + '/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="' + NS + '/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet2.xml"/><Relationship Id="rId3" Type="' + NS + '/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>' },
      { name: 'xl/styles.xml', text: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="' + NS + '/spreadsheetml/2006/main"><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts><fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>' },
      { name: 'xl/worksheets/sheet1.xml', text: s1 },
      { name: 'xl/worksheets/sheet2.xml', text: s2 }
    ]);
  }
  function exportXlsx() {
    const safe = (v) => String(v || '').trim().replace(/[^A-Za-z0-9-]+/g, '_');
    const name = 'DaemsRacing_' + (safe(state.event.circuit) || 'Event') + '_' + (safe(state.event.date) || 'log') + '.xlsx';
    const url = URL.createObjectURL(buildXlsx(state.log));
    const a = document.createElement('a');
    a.href = url; a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
    toast('Excel file exported');
  }

  // Expose the builder for tests (node) without affecting the app.
  if (typeof window !== 'undefined') window.__drtBuildXlsx = buildXlsx;

  // ---------- Start ----------
  render();
  if ('serviceWorker' in navigator && location.protocol === 'https:') {
    window.addEventListener('load', () => { navigator.serviceWorker.register('sw.js').catch(() => {}); });
  }
})();
