/* Fusion Fit – app logic */
(function () {
  'use strict';
  const X = window.FF_EX, PR = window.FF_PROG, F = window.FFFigure;
  const STORE_KEY = 'fusionfit_state_v1';
  const PRICES = { monthly: 'R59.99', yearly: 'R449.99', yearlyPerMonth: 'R37.50', lifetime: 'R899.99', trialDays: 7 };
  const SUB_ID = 'fusionfit_pro', LIFE_ID = 'fusionfit_lifetime', PACKAGE = 'za.co.fusionlabs.fit';
  const HPN = window.HPNative || null;
  const TEST_BUILD = !!window.HP_EMBED || !!(HPN && HPN.isTestBuild && HPN.isTestBuild());
  const HAS_BILLING = !!(HPN && HPN.billingBuy);
  const APP_VERSION = (HPN && HPN.appVersion && HPN.appVersion()) || '1.0';
  const ICON = window.HP_ICON || 'icon.png';
  const EMERGENCY = '10177 (ambulance) or 112 from a cellphone';

  // ───────── State ─────────
  const defaults = () => ({ profile: null, active: null, done: {}, history: [], weights: [], tests: [], pro: { active: false, lifetime: false }, proTest: false, strokeOk: false });
  let S; try { S = Object.assign(defaults(), JSON.parse(localStorage.getItem(STORE_KEY) || '{}')); } catch (e) { S = defaults(); }
  const save = () => { try { localStorage.setItem(STORE_KEY, JSON.stringify(S)); } catch (e) { toast('Couldn’t save on this phone'); } };
  const isPro = () => !!((S.pro && (S.pro.active || S.pro.lifetime)) || (TEST_BUILD && S.proTest));

  // ───────── Helpers ─────────
  const $ = s => document.querySelector(s);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const mmss = s => { s = Math.max(0, Math.round(s)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };
  const dkey = d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  const today = () => dkey(new Date());
  function toast(m, ms) { const t = $('#toast'); t.textContent = m; t.hidden = false; clearTimeout(toast._t); toast._t = setTimeout(() => { t.hidden = true; }, ms || 2800); }
  function sheet(h) { const w = $('#sheet'); w.innerHTML = '<div class="sheet" role="dialog" aria-modal="true"><div class="grab"></div>' + h + '</div>'; w.hidden = false; }
  function closeSheet() { $('#sheet').hidden = true; $('#sheet').innerHTML = ''; }
  function askConfirm(msg, yes, cb) { askConfirm.cb = cb; sheet('<h2>' + esc(msg) + '</h2><div class="actions mt"><button class="btn ghost" data-act="closeSheet">Cancel</button><button class="btn danger" data-act="confirmYes">' + esc(yes) + '</button></div>'); }
  const fig = (id, cls) => '<svg class="fig ' + (cls || '') + '" data-ex="' + id + '" viewBox="0 0 200 200" role="img" aria-label="' + esc(X.BY[id] ? X.BY[id].name : '') + ' illustration">' + (X.BY[id] ? F.staticSvg(X.BY[id].pose, 0.5) : '') + '</svg>';
  const weightKg = () => (S.profile && +S.profile.weight) || 80;

  // ───────── Router ─────────
  const USE_HASH = !window.HP_EMBED; let ROUTE = '/home'; const STACK = [];
  const cur = () => USE_HASH ? (location.hash.replace(/^#/, '') || '/home') : ROUTE;
  function go(p) { if (USE_HASH) { if (location.hash === '#' + p) render(); else location.hash = p; return; } STACK.push(ROUTE); ROUTE = p; closeSheet(); render(); }
  function back() { if (USE_HASH) { if (history.length > 1) history.back(); else go('/home'); } else { ROUTE = STACK.pop() || '/home'; closeSheet(); render(); } }
  const topbar = (title, showBack, right) => '<div class="topbar">' + (showBack ? '<button class="iconbtn" data-act="back" aria-label="Back">←</button>' : '<img class="logo-sm" src="' + ICON + '" alt="">') + '<h1>' + esc(title) + '</h1>' + (right || '') + '</div>';
  const credit = () => '<footer class="credit">Created by <b>Fusion Labs</b></footer>';

  // ───────── Workout maths ─────────
  const workSecs = blk => { const e = X.BY[blk.ex]; const each = e && e.dose.each ? 2 : 1; return blk.secs ? blk.secs * each : (blk.reps || 10) * 3.2 * each; };
  function flatten(w, prog) {
    const steps = [];
    const push = (blk, label, roundInfo) => {
      const e = X.BY[blk.ex]; if (!e) return;
      for (let s = 1; s <= (blk.sets || 1); s++) {
        steps.push({ type: 'work', ex: blk.ex, reps: blk.reps, secs: blk.secs, each: !!e.dose.each, set: s, sets: blk.sets || 1, label, round: roundInfo });
        if (blk.rest) steps.push({ type: 'rest', secs: blk.rest });
      }
    };
    const warm = (prog && prog.warmup) || [], cool = (prog && prog.cooldown) || [];
    warm.forEach(blk => push(blk, 'Warm-up'));
    (w.blocks || []).forEach(blk => push(blk, 'Workout'));
    if (w.circuit) for (let r = 1; r <= w.circuit.rounds; r++) w.circuit.blocks.forEach(blk => push(Object.assign({}, blk, { sets: 1 }), 'Workout', r + '/' + w.circuit.rounds));
    cool.forEach(blk => push(blk, 'Cool-down'));
    while (steps.length && steps[steps.length - 1].type === 'rest') steps.pop();
    steps.forEach((st, i) => { if (st.type === 'rest') { const nx = steps.slice(i + 1).find(x => x.type === 'work'); st.next = nx; } });
    return steps;
  }
  function estimate(w, prog) {
    const steps = flatten(w, prog); let secs = 0, kcal = 0;
    steps.forEach(st => { const d = st.type === 'rest' ? st.secs : workSecs(st); secs += d; const met = st.type === 'rest' ? 1.5 : (X.BY[st.ex].met || 3); kcal += met * weightKg() * d / 3600; });
    return { mins: Math.round(secs / 60), kcal: Math.round(kcal), count: new Set(steps.filter(s => s.type === 'work').map(s => s.ex)).size };
  }
  const progById = id => PR.PROGRAMS.find(p => p.id === id);
  function sessionLocked(prog, week, day) { if (isPro()) return false; if (prog.stroke) return true; return week > 1; }
  function nextSession() {
    const a = S.active; if (!a) return null; const prog = progById(a.prog); if (!prog) return null;
    for (let w = 1; w <= prog.weeks; w++) { const list = prog.gen(w); for (let d = 0; d < list.length; d++) { if (!S.done[prog.id + ':' + w + ':' + d]) return { prog, week: w, day: d, w: list[d] }; } }
    return { prog, week: prog.weeks, day: 0, w: prog.gen(prog.weeks)[0], finished: true };
  }
  function streak() {
    const days = new Set(S.history.map(h => h.date)); let n = 0; const d = new Date();
    if (!days.has(dkey(d))) d.setDate(d.getDate() - 1);
    while (days.has(dkey(d))) { n++; d.setDate(d.getDate() - 1); }
    return n;
  }
  function weekStats() { const d = new Date(); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); const start = dkey(d); const h = S.history.filter(x => x.date >= start); return { count: h.length, mins: h.reduce((a, x) => a + x.mins, 0), kcal: h.reduce((a, x) => a + x.kcal, 0) }; }

  // ───────── Views ─────────
  const views = {};
  views.welcome = () => '<section class="ob welcome"><img class="logo-lg" src="' + ICON + '" alt="Fusion Fit logo"><h1>Fusion Fit</h1><div class="tag">Your personal trainer at home. No gym needed.</div>' +
    '<p>Get strong, lose weight and stay independent using what you already have: a chair, a wall, water bottles and a backpack.</p>' +
    '<div class="feat"><div><span>🎖️</span>Military Fit 50+: boot camp built for older men</div><div><span>🔥</span>Weight-loss and muscle-building programmes</div><div><span>❤️</span>Stroke Recovery at Home: gentle, supported exercises</div><div><span>🧍</span>Every exercise shows how to move and which muscles work</div></div>' +
    '<button class="btn block" data-act="startSetup">Get started</button><p class="credit-dark">Created by <b>Fusion Labs</b></p></section>';

  let D = null, setupStep = 1;
  const GOALS = [['military', '🎖️', 'Military-style fitness', 'Boot camp for men 50+'], ['weight', '🔥', 'Lose weight', 'Burn fat, feel lighter'], ['muscle', '💪', 'Build muscle', 'Get stronger at home'], ['stroke', '❤️', 'Recover after a stroke', 'Gentle, supported exercises'], ['active', '🚶', 'Stay active', 'Move more, feel better']];
  const PARQ = ['Has a doctor ever said you have a heart condition or high blood pressure?', 'Do you feel pain in your chest at rest, during daily activities or when you exercise?', 'Do you lose your balance because of dizziness, or have you lost consciousness in the last 12 months?', 'Have you been diagnosed with another long-term medical condition (such as diabetes or a stroke)?', 'Are you taking prescribed medicine for a long-term condition?', 'Do you have a bone, joint or muscle problem that could get worse with exercise?', 'Has a doctor ever said you should only exercise under medical supervision?'];
  views.setup = () => {
    D = D || Object.assign({ goal: '', name: '', age: '', sex: '', weight: '', height: '', level: 'beginner', parq: [] }, S.profile || {});
    const n = 3; const head = '<section class="ob"><div class="row"><button class="iconbtn" data-act="setupBack" aria-label="Back">←</button></div><div class="progress"><i style="width:' + (setupStep / n * 100) + '%"></i></div><div class="grow">';
    const foot = (lbl, dis) => '</div><div class="foot"><button class="btn block" data-act="setupNext"' + (dis ? ' disabled' : '') + '>' + lbl + '</button></div></section>';
    if (setupStep === 1) return head + '<h1>What’s your main goal?</h1>' + GOALS.map(g => '<button class="choice ' + (D.goal === g[0] ? 'on' : '') + '" data-act="setGoal" data-val="' + g[0] + '"><span class="ce">' + g[1] + '</span><span><b>' + g[2] + '</b><small>' + g[3] + '</small></span></button>').join('') + foot('Continue', !D.goal);
    if (setupStep === 2) return head + '<h1>About you</h1><p class="muted">Used to suggest a programme and estimate calories. Stored only on this phone.</p>' +
      '<label class="f" for="s-name">First name</label><input class="in" id="s-name" data-bind="name" value="' + esc(D.name) + '" autocomplete="given-name">' +
      '<div class="two"><div><label class="f" for="s-age">Age</label><input class="in" id="s-age" type="number" inputmode="numeric" data-bind="age" value="' + esc(D.age) + '"></div><div><label class="f" for="s-w">Weight (kg)</label><input class="in" id="s-w" type="number" inputmode="decimal" data-bind="weight" value="' + esc(D.weight) + '"></div></div>' +
      '<div class="two"><div><label class="f" for="s-h">Height (cm)</label><input class="in" id="s-h" type="number" inputmode="numeric" data-bind="height" value="' + esc(D.height) + '"></div><div><label class="f">Sex</label><div class="chips wrapc">' + [['male', 'Male'], ['female', 'Female']].map(o => '<button class="chip ' + (D.sex === o[0] ? 'on' : '') + '" data-act="setField" data-k="sex" data-val="' + o[0] + '">' + o[1] + '</button>').join('') + '</div></div></div>' +
      '<label class="f">Current fitness</label><div class="chips wrapc">' + [['beginner', 'Just starting'], ['regular', 'Exercise sometimes'], ['fit', 'Fit already']].map(o => '<button class="chip ' + (D.level === o[0] ? 'on' : '') + '" data-act="setField" data-k="level" data-val="' + o[0] + '">' + o[1] + '</button>').join('') + '</div>' + foot('Continue');
    const yes = D.parq.filter(Boolean).length;
    return head + '<h1>Quick health check</h1><p class="muted">Answer honestly. It helps keep you safe.</p>' + PARQ.map((q, i) => '<div class="card flat parq"><p>' + esc(q) + '</p><div class="chips"><button class="chip ' + (D.parq[i] === true ? 'warnon' : '') + '" data-act="parq" data-i="' + i + '" data-val="1">Yes</button><button class="chip ' + (D.parq[i] === false ? 'on' : '') + '" data-act="parq" data-i="' + i + '" data-val="0">No</button></div></div>').join('') +
      (yes ? '<div class="alert warn"><b>Please check with your doctor first.</b> You answered “yes” to ' + yes + ' question' + (yes > 1 ? 's' : '') + '. Exercise is very likely good for you, but ask your doctor or physiotherapist which activities are safe, and start with the gentlest options.</div>' : '') +
      foot(yes ? 'I understand, continue' : 'Finish', D.parq.filter(x => x != null).length < PARQ.length);
  };

  views.home = () => {
    const p = S.profile || {}; const h = new Date().getHours(); const greet = h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
    const nx = nextSession(); const ws = weekStats(); const st = streak();
    let card;
    if (nx) {
      const est = estimate(nx.w, nx.prog); const locked = sessionLocked(nx.prog, nx.week, nx.day);
      card = '<div class="card today"><span class="pill">' + nx.prog.icon + ' ' + esc(nx.prog.name) + ' · Week ' + nx.week + '</span><h2 class="mt">' + esc(nx.w.title) + '</h2><p class="muted small">' + esc(nx.w.note || '') + '</p><div class="meta"><span>⏱ ' + est.mins + ' min</span><span>🔥 ≈ ' + est.kcal + ' kcal</span><span>🏋️ ' + est.count + ' exercises</span></div>' +
        (nx.finished ? '<div class="alert ok mt">🏆 You’ve finished this programme! Repeat the last week or pick a new one.</div>' : '') +
        (locked ? '<a class="btn block mt" href="#/premium">🔒 Unlock with Pro</a>' : '<button class="btn block mt" data-act="openSession" data-p="' + nx.prog.id + '" data-w="' + nx.week + '" data-d="' + nx.day + '">▶ Start workout</button>') + '</div>';
    } else card = '<div class="card today"><h2>Choose a programme</h2><p class="muted">Pick a plan and Fusion Fit will tell you what to do each day.</p><a class="btn block" href="#/programs">See programmes</a></div>';
    return '<div class="hello"><div class="row"><div class="spacer"><p class="muted" style="margin:0">' + greet + (p.name ? ',' : '') + '</p><h1>' + esc(p.name || 'Welcome') + ' 💪</h1></div><a class="iconbtn" href="#/profile" aria-label="Profile and settings">⚙️</a></div>' + (isPro() ? '<span class="pill navy">★ Pro</span>' : '') + '</div>' +
      '<div class="wrap">' + card +
      '<div class="stats3"><div><b>' + st + '</b><span>Day streak</span></div><div><b>' + ws.count + '</b><span>Workouts this week</span></div><div><b>' + ws.kcal + '</b><span>kcal this week</span></div></div>' +
      '<div class="grid2 mt"><button class="tile2" data-act="quickSheet"><span>⚡</span><b>Quick workout</b><small>' + (isPro() ? 'Pick time & focus' : '🔒 Pro') + '</small></button><a class="tile2" href="#/test"><span>🎖️</span><b>Fitness test</b><small>Military-style check</small></a><a class="tile2" href="#/stroke"><span>❤️</span><b>Stroke recovery</b><small>Gentle home exercises</small></a><a class="tile2" href="#/exercises"><span>📚</span><b>Exercise library</b><small>' + X.EX.length + ' exercises</small></a></div>' +
      '<div class="card rg mt"><b>Train safely.</b> <span class="small">Warm up, go at your own pace, and stop if you feel chest pain, severe breathlessness, dizziness or sudden weakness. <button class="linkbtn small" data-act="safety">Safety tips</button></span></div>' +
      (isPro() ? '' : '<a class="card pro-card mt" href="#/premium"><h3>★ Go Pro</h3><p>All weeks of every programme, the full stroke recovery plan and quick workouts. From ' + PRICES.monthly + '/month, or ' + PRICES.lifetime + ' once.</p></a>') + '</div>';
  };

  views.programs = () => topbar('Programmes', false) + '<div class="wrap"><p class="muted">Pick one programme at a time. Each week gets a little harder.</p>' + PR.PROGRAMS.map(p => {
    const isAct = S.active && S.active.prog === p.id;
    return '<a class="card prog" href="#/program/' + p.id + '"><div class="row"><span class="pico">' + p.icon + '</span><div class="spacer"><h3>' + esc(p.name) + '</h3><span class="small muted">' + esc(p.tag) + ' · ' + p.weeks + ' weeks · ' + p.perWeek + '× a week</span></div>' + (isAct ? '<span class="pill">Active</span>' : '') + '</div><p class="small" style="margin:10px 0 0">' + esc(p.desc) + '</p></a>';
  }).join('') + '</div>';

  views.program = id => {
    const p = progById(id); if (!p) return views.programs(); const isAct = S.active && S.active.prog === id;
    let weeks = '';
    for (let w = 1; w <= p.weeks; w++) {
      const list = p.gen(w);
      weeks += '<div class="week"><h3>Week ' + w + (!isPro() && (w > 1 || p.stroke) ? ' <span class="small muted">🔒 Pro</span>' : '') + '</h3>' + list.map((s, d) => { const done = S.done[p.id + ':' + w + ':' + d]; const lk = sessionLocked(p, w, d); const est = estimate(s, p); return '<button class="sess ' + (done ? 'done' : '') + '" data-act="openSession" data-p="' + p.id + '" data-w="' + w + '" data-d="' + d + '"><span class="st">' + (done ? '✅' : lk ? '🔒' : (d + 1)) + '</span><span class="tx"><b>' + esc(s.title) + '</b><small>' + est.mins + ' min · ≈ ' + est.kcal + ' kcal</small></span><span>›</span></button>'; }).join('') + '</div>';
    }
    return topbar(p.name, true) + '<div class="wrap"><div class="card"><span class="pico big">' + p.icon + '</span><p>' + esc(p.desc) + '</p>' +
      (isAct ? '<div class="alert ok">This is your active programme.</div>' : '<button class="btn block" data-act="activate" data-p="' + p.id + '">Start this programme</button>') +
      (p.stroke ? '<p class="small muted mt">Free: the “Gentle start” routine in the Stroke tab. The full 6-week plan is part of Pro.</p>' : '<p class="small muted mt">Week 1 is free. Weeks 2–' + p.weeks + ' are part of Pro.</p>') + '</div>' + weeks + '</div>';
  };

  // Workout preview
  let SESSION = null;
  views.session = () => {
    if (!SESSION) return views.home(); const { w, prog } = SESSION; const est = estimate(w, prog);
    const list = (blks, label) => blks && blks.length ? '<h3 class="mt">' + label + '</h3>' + blks.map(blk => { const e = X.BY[blk.ex]; return '<a class="exrow" href="#/ex/' + blk.ex + '">' + fig(blk.ex, 'mini') + '<span class="tx"><b>' + esc(e.name) + '</b><small>' + (blk.sets > 1 ? blk.sets + ' × ' : '') + (blk.secs ? mmss(blk.secs) : blk.reps + ' reps') + (e.dose.each ? ' each side' : '') + '</small></span><span>›</span></a>'; }).join('') : '';
    return topbar(w.title, true) + '<div class="wrap"><div class="card"><p class="muted small" style="margin:0">' + esc(w.note || '') + '</p><div class="meta mt"><span>⏱ ' + est.mins + ' min</span><span>🔥 ≈ ' + est.kcal + ' kcal</span><span>🏋️ ' + est.count + ' exercises</span></div></div>' +
      list(prog && prog.warmup, '🔆 Warm-up') + list(w.blocks, '🏋️ Workout') + (w.circuit ? '<h3 class="mt">🔁 Circuit · ' + w.circuit.rounds + ' rounds</h3>' + list(w.circuit.blocks, '').replace('<h3 class="mt"></h3>', '') : '') + list(prog && prog.cooldown, '🧘 Cool-down') +
      '<button class="btn block mt" data-act="startPlayer">▶ Start workout</button>' + (prog && prog.stroke ? strokeSafetyNote() : '') + '</div>';
  };

  // ── Player ──
  let PLAY = null;
  const beepCtx = { ac: null };
  function beep(f, d) { try { beepCtx.ac = beepCtx.ac || new (window.AudioContext || window.webkitAudioContext)(); const ac = beepCtx.ac; const o = ac.createOscillator(); const g = ac.createGain(); o.frequency.value = f || 880; g.gain.value = 0.15; o.connect(g); g.connect(ac.destination); o.start(); g.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + (d || 0.15)); o.stop(ac.currentTime + (d || 0.15) + 0.02); } catch (e) { /* no audio */ } }
  function startPlayer() {
    const steps = flatten(SESSION.w, SESSION.prog); if (!steps.length) return;
    PLAY = { steps, i: 0, left: null, paused: false, started: Date.now(), activeSecs: 0, kcal: 0, timer: null };
    if (HPN && HPN.keepAwake) HPN.keepAwake(true);
    enterStep(); go('/play');
  }
  function enterStep() {
    const st = PLAY.steps[PLAY.i]; PLAY.left = st.type === 'rest' ? st.secs : (st.secs ? st.secs * (st.each ? 2 : 1) : null); PLAY.stepStart = Date.now();
    clearInterval(PLAY.timer);
    PLAY.timer = setInterval(tick, 1000);
  }
  function tick() {
    if (!PLAY || PLAY.paused) return; const st = PLAY.steps[PLAY.i];
    if (st.type === 'work') { PLAY.activeSecs++; PLAY.kcal += (X.BY[st.ex].met || 3) * weightKg() / 3600; } else PLAY.kcal += 1.5 * weightKg() / 3600;
    if (PLAY.left != null) { PLAY.left--; if (PLAY.left <= 3 && PLAY.left > 0) beep(660, 0.12); if (PLAY.left <= 0) { beep(990, 0.35); nextStep(); return; } }
    const el = $('#ptimer'); if (el) el.textContent = PLAY.left != null ? mmss(PLAY.left) : mmss((Date.now() - PLAY.stepStart) / 1000);
    const ring = $('#pring'); if (ring && PLAY.left != null) { const tot = st.type === 'rest' ? st.secs : st.secs * (st.each ? 2 : 1); ring.style.strokeDashoffset = String(283 * (1 - PLAY.left / tot)); }
  }
  function nextStep() { if (!PLAY) return; if (PLAY.i >= PLAY.steps.length - 1) { finishPlayer(); return; } PLAY.i++; enterStep(); render(); }
  function prevStep() { if (!PLAY || PLAY.i === 0) return; PLAY.i--; while (PLAY.i > 0 && PLAY.steps[PLAY.i].type === 'rest') PLAY.i--; enterStep(); render(); }
  function finishPlayer(early) {
    clearInterval(PLAY.timer); if (HPN && HPN.keepAwake) HPN.keepAwake(false);
    const mins = Math.max(1, Math.round((Date.now() - PLAY.started) / 60000));
    PLAY.summary = { mins, kcal: Math.round(PLAY.kcal), done: PLAY.steps.slice(0, PLAY.i + 1).filter(s => s.type === 'work').length, early: !!early };
    go('/done');
  }
  views.play = () => {
    if (!PLAY) return views.home(); const st = PLAY.steps[PLAY.i]; const total = PLAY.steps.filter(s => s.type === 'work').length; const idx = PLAY.steps.slice(0, PLAY.i + 1).filter(s => s.type === 'work').length;
    const bar = '<div class="pbar"><i style="width:' + (PLAY.i / (PLAY.steps.length - 1 || 1) * 100) + '%"></i></div>';
    if (st.type === 'rest') {
      const nx = st.next; const e = nx ? X.BY[nx.ex] : null;
      return '<section class="player rest">' + bar + '<div class="row"><button class="iconbtn" data-act="quitPlay" aria-label="End workout">✕</button><span class="spacer"></span><span class="pill">Rest</span></div>' +
        '<div class="center mt"><p class="muted">Rest and breathe</p><div class="ringwrap"><svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="45" class="rbg"/><circle id="pring" cx="50" cy="50" r="45" class="rfg" style="stroke-dashoffset:0"/></svg><b id="ptimer">' + mmss(PLAY.left) + '</b></div>' +
        '<div class="row center-row"><button class="btn ghost sm" data-act="addRest">+15 s</button><button class="btn sm" data-act="nextStep">Skip rest</button></div></div>' +
        (e ? '<div class="card mt"><p class="small muted" style="margin:0">Next up</p><div class="row">' + fig(nx.ex, 'mini') + '<div class="spacer"><b>' + esc(e.name) + '</b><br><span class="small muted">' + (nx.secs ? mmss(nx.secs) : nx.reps + ' reps') + (nx.each ? ' each side' : '') + '</span></div></div></div>' : '') + '</section>';
    }
    const e = X.BY[st.ex];
    return '<section class="player">' + bar + '<div class="row"><button class="iconbtn" data-act="quitPlay" aria-label="End workout">✕</button><span class="spacer"></span><span class="pill">' + esc(st.label) + (st.round ? ' · Round ' + st.round : '') + ' · ' + idx + '/' + total + '</span><span class="spacer"></span><button class="iconbtn" data-act="unwell" aria-label="I feel unwell">🆘</button></div>' +
      '<div class="pfig">' + fig(st.ex, 'big') + '</div><h2 class="center">' + esc(e.name) + '</h2>' +
      '<p class="center muted" style="margin:0">' + (st.sets > 1 ? 'Set ' + st.set + ' of ' + st.sets + ' · ' : '') + (st.secs ? (st.each ? mmss(st.secs) + ' each side' : (X.BY[st.ex].pose.hold ? 'Hold until the timer ends' : 'Keep going until the timer ends')) : st.reps + ' reps' + (st.each ? ' each side' : '')) + '</p>' +
      '<div class="center"><b class="ptime" id="ptimer">' + (PLAY.left != null ? mmss(PLAY.left) : '0:00') + '</b></div>' +
      '<div class="pcontrols"><button class="btn ghost" data-act="prevStep" aria-label="Previous">⏮</button><button class="btn ghost" data-act="pause">' + (PLAY.paused ? '▶ Resume' : '⏸ Pause') + '</button><button class="btn" data-act="nextStep">' + (st.secs ? 'Skip ⏭' : 'Done ✓') + '</button></div>' +
      '<details class="card mt"><summary><b>How to do it</b></summary><ol class="steps mt">' + e.how.map(x => '<li>' + esc(x) + '</li>').join('') + '</ol><p class="small"><b>Easier:</b> ' + esc(e.easier) + '</p></details></section>';
  };
  views.done = () => {
    const s = PLAY && PLAY.summary; if (!s) return views.home();
    return '<section class="ob done-screen"><div class="grow center"><div class="trophy">🏆</div><h1>' + (s.early ? 'Good effort!' : 'Workout complete!') + '</h1><p class="muted">' + esc(SESSION.w.title) + '</p>' +
      '<div class="stats3"><div><b>' + s.mins + '</b><span>minutes</span></div><div><b>' + s.kcal + '</b><span>kcal (estimate)</span></div><div><b>' + s.done + '</b><span>exercises</span></div></div>' +
      '<h3 class="mt">How did it feel?</h3><div class="chips" style="justify-content:center">' + [['easy', '😌 Easy'], ['good', '🙂 Just right'], ['hard', '😮‍💨 Hard']].map(o => '<button class="chip ' + (PLAY.feel === o[0] ? 'on' : '') + '" data-act="feel" data-val="' + o[0] + '">' + o[1] + '</button>').join('') + '</div>' +
      (PLAY.feel === 'hard' ? '<p class="small muted">Next time, try the easier versions or take longer rests. Progress comes from showing up.</p>' : PLAY.feel === 'easy' ? '<p class="small muted">Great! Try the harder versions next time.</p>' : '') + '</div>' +
      '<div class="foot"><button class="btn block" data-act="saveWorkout">Save & finish</button></div></section>';
  };

  // ── Stroke tab ──
  function strokeSafetyNote() { return '<div class="card rg mt"><b>⚠️ Stroke warning signs: BE FAST</b><p class="small" style="margin:6px 0">Balance loss · Eyes (sudden vision loss) · Face drooping · Arm weakness · Speech difficulty · Time: call ' + EMERGENCY + ' immediately.</p><p class="small" style="margin:0">Stop exercising and get help if you notice any of these.</p></div>'; }
  views.stroke = () => topbar('Stroke Recovery', false) + '<div class="wrap">' +
    '<div class="card stroke-hero"><h2>Exercise at home after a stroke</h2><p>Gentle, supported exercises using a chair, a counter, a towel and a broomstick, to help rebuild strength, balance and arm and hand control.</p></div>' +
    '<div class="alert info"><b>Please read:</b> Fusion Fit doesn’t replace rehabilitation. Ask your doctor or physiotherapist which exercises are right for you, and follow their advice if it differs from this app.</div>' +
    strokeSafetyNote() +
    '<h2 class="mt">Routines</h2>' + Object.values(PR.STROKE).map(r => { const lk = !r.free && !isPro(); const est = estimate(r, { warmup: [], cooldown: [] }); return '<button class="sess" data-act="strokeRoutine" data-id="' + r.id + '"><span class="st">' + (lk ? '🔒' : '❤️') + '</span><span class="tx"><b>' + esc(r.name) + (r.free ? ' <span class="pill" style="font-size:11px">Free</span>' : '') + '</b><small>' + esc(r.desc) + ' · ' + est.mins + ' min</small></span><span>›</span></button>'; }).join('') +
    '<a class="card prog mt" href="#/program/stroke"><div class="row"><span class="pico">📅</span><div class="spacer"><h3>6-week recovery plan</h3><span class="small muted">' + (isPro() ? 'A routine for each day, building up gradually' : '🔒 Pro: a routine for each day, building up gradually') + '</span></div></div></a>' +
    '<h2 class="mt">Tips for safe exercise</h2><div class="card"><ul class="checklist"><li>Always have a sturdy chair behind you when standing, and hold a counter.</li><li>Clear the floor of rugs and clutter. Wear flat, closed shoes.</li><li>Work the weaker side gently; the stronger side can help it.</li><li>Little and often is best: 10–20 minutes, most days.</li><li>Have someone nearby, especially for standing and stairs.</li><li>Stop if you feel pain, dizziness, chest discomfort or unusual tiredness.</li></ul></div>' +
    '<h2 class="mt">For family & carers</h2><div class="card"><p class="small" style="margin:0">Stand on the weaker side, ready to steady (not lift). Encourage, count reps out loud, and celebrate small wins. Keep a record in the Progress tab to share with the physiotherapist.</p></div></div>';

  // ── Exercise library ──
  let libCat = 'all', libMuscle = 'all';
  const CATS = [['all', 'All'], ['military', '🎖️ Military'], ['muscle', '💪 Strength'], ['weight', '🔥 Weight loss'], ['cardio', '❤️‍🔥 Cardio'], ['stroke', '🪑 Stroke (seated)'], ['stroke2', '🧍 Stroke (standing)'], ['warmup', '🔆 Warm-up'], ['cooldown', '🧘 Stretch']];
  views.exercises = () => {
    const list = X.EX.filter(e => (libCat === 'all' || e.cat.includes(libCat)) && (libMuscle === 'all' || e.primary.includes(libMuscle) || e.secondary.includes(libMuscle)));
    return topbar('Exercises', false) + '<div class="wrap"><div class="chips">' + CATS.map(c => '<button class="chip ' + (libCat === c[0] ? 'on' : '') + '" data-act="libCat" data-val="' + c[0] + '">' + c[1] + '</button>').join('') + '</div>' +
      '<label class="f" for="lib-m">Muscle group</label><select class="in" id="lib-m" data-act-change="libMuscle"><option value="all">All muscle groups</option>' + Object.entries(X.MUSCLE_NAMES).filter(([k]) => X.EX.some(e => e.primary.includes(k) || e.secondary.includes(k))).map(([k, v]) => '<option value="' + k + '"' + (libMuscle === k ? ' selected' : '') + '>' + v + '</option>').join('') + '</select>' +
      '<p class="small muted mt">' + list.length + ' exercises · tap one to see how</p><div class="exgrid">' + list.map(e => '<a class="excard" href="#/ex/' + e.id + '">' + fig(e.id) + '<b>' + esc(e.name) + '</b><small>' + e.primary.map(m => X.MUSCLE_NAMES[m]).join(', ') + '</small></a>').join('') + '</div></div>';
  };
  views.ex = id => {
    const e = X.BY[id]; if (!e) return views.exercises();
    const muscles = (arr, cls) => arr.map(m => '<span class="mtag ' + cls + '">' + X.MUSCLE_NAMES[m] + '</span>').join('');
    return topbar(e.name, true) + '<div class="wrap"><div class="card exhero">' + fig(e.id, 'big') + '</div>' +
      '<div class="meta"><span>' + (e.dose.secs ? '⏱ ' + mmss(e.dose.secs) : '🔁 ' + e.dose.reps + ' reps') + (e.dose.each ? ' each side' : '') + '</span>' + (e.seated ? '<span>🪑 Seated</span>' : '') + '<span>🔥 MET ' + e.met + '</span></div>' +
      '<div class="card"><h3>Muscles worked</h3><div class="row wrapr" style="align-items:flex-start"><div style="flex:1 1 180px">' + F.bodyMap(e.primary, e.secondary) + '</div><div style="flex:1 1 160px"><p class="small"><b>Main:</b><br>' + muscles(e.primary, 'p') + '</p>' + (e.secondary.length ? '<p class="small"><b>Also works:</b><br>' + muscles(e.secondary, 's') + '</p>' : '') + '</div></div><p class="small mt" style="margin-bottom:0"><b>How it helps:</b> ' + esc(e.why) + '</p></div>' +
      '<div class="card"><h3>What you need</h3><p style="margin:0">' + (e.equip.length ? e.equip.map(esc).join(' · ') : 'Nothing. Just you.') + '</p></div>' +
      '<div class="card"><h3>How to do it</h3><ol class="steps">' + e.how.map(x => '<li>' + esc(x) + '</li>').join('') + '</ol><h3>Form tips</h3><ul class="checklist">' + e.tips.map(x => '<li>' + esc(x) + '</li>').join('') + '</ul></div>' +
      '<div class="grid2"><div class="card flat"><b>🟢 Easier</b><p class="small" style="margin:6px 0 0">' + esc(e.easier) + '</p></div><div class="card flat"><b>🔴 Harder</b><p class="small" style="margin:6px 0 0">' + esc(e.harder) + '</p></div></div>' +
      (e.cat.includes('stroke') || e.cat.includes('stroke2') ? strokeSafetyNote() : '') +
      '<button class="btn block mt" data-act="tryEx" data-id="' + e.id + '">▶ Try it now</button></div>';
  };

  // ── Progress ──
  views.progress = () => {
    const ws = weekStats(); const total = S.history.length; const mins = S.history.reduce((a, x) => a + x.mins, 0);
    const wts = S.weights.slice(-20); let chart = '';
    if (wts.length >= 2) {
      const vals = wts.map(w => w.kg); const mn = Math.min.apply(null, vals) - 1, mx = Math.max.apply(null, vals) + 1;
      const pts = wts.map((w, i) => [10 + i * 280 / (wts.length - 1), 110 - (w.kg - mn) / (mx - mn) * 95]);
      chart = '<svg viewBox="0 0 300 125" class="wchart" role="img" aria-label="Weight over time"><line x1="10" y1="110" x2="290" y2="110" stroke="#E2E6EE"/><polyline points="' + pts.map(p => p.join(',')).join(' ') + '" fill="none" stroke="#2F7BFF" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"/>' + pts.map((p, i) => '<circle cx="' + p[0] + '" cy="' + p[1] + '" r="' + (i === pts.length - 1 ? 5 : 3) + '" fill="#2F7BFF"/>').join('') + '<text x="' + pts[pts.length - 1][0] + '" y="' + (pts[pts.length - 1][1] - 10) + '" text-anchor="end" font-size="12" font-weight="700" fill="#15243F">' + wts[wts.length - 1].kg + ' kg</text></svg>';
    }
    const best = id => { const r = S.tests.filter(t => t.id === id); if (!r.length) return '–'; const T = PR.TESTS.find(t => t.id === id); const v = r.map(x => x.value); return (T.higher ? Math.max.apply(null, v) : Math.min.apply(null, v)) + ' ' + T.unit; };
    return topbar('Progress', false) + '<div class="wrap"><div class="stats3"><div><b>' + streak() + '</b><span>Day streak</span></div><div><b>' + total + '</b><span>Workouts</span></div><div><b>' + Math.round(mins / 60 * 10) / 10 + '</b><span>Hours trained</span></div></div>' +
      '<div class="card mt"><div class="row"><h3 class="spacer" style="margin:0">Body weight</h3><button class="btn sm" data-act="logWeight">+ Log weight</button></div>' + (chart || '<p class="small muted mt">Log your weight once a week to see your trend.</p>') + (wts.length ? '<p class="small muted" style="margin:0">' + (wts.length >= 2 ? (wts[wts.length - 1].kg - wts[0].kg > 0 ? '+' : '') + (wts[wts.length - 1].kg - wts[0].kg).toFixed(1) + ' kg since ' + wts[0].date : 'Started at ' + wts[0].kg + ' kg') + '</p>' : '') + '</div>' +
      '<div class="card"><div class="row"><h3 class="spacer" style="margin:0">Fitness test</h3><a class="btn sm soft" href="#/test">Take test</a></div>' + PR.TESTS.map(t => '<div class="food-row"><span>' + esc(t.name) + '</span><b>' + best(t.id) + '</b></div>').join('') + '</div>' +
      '<h3 class="mt">Recent workouts</h3>' + (S.history.length ? S.history.slice(0, 15).map(h => '<div class="card flat hrow"><b>' + esc(h.title) + '</b><span class="small muted">' + h.date + ' · ' + h.mins + ' min · ≈ ' + h.kcal + ' kcal' + (h.feel ? ' · ' + { easy: '😌', good: '🙂', hard: '😮‍💨' }[h.feel] : '') + '</span></div>').join('') : '<div class="empty-state"><div class="big">🏁</div><p>Your first workout will show up here.</p></div>') +
      (ws.count ? '' : '') + '</div>';
  };

  // ── Fitness test ──
  let TEST = null;
  views.test = () => {
    return topbar('Fitness test', true) + '<div class="wrap"><p class="muted">A military-style check adapted for all ages. Retest every 4 weeks to see your progress. Warm up first.</p>' +
      PR.TESTS.map(t => '<div class="card"><div class="row">' + fig(t.ex, 'mini') + '<div class="spacer"><h3 style="margin:0">' + esc(t.name) + '</h3><span class="small muted">' + esc(t.note) + '</span></div></div><div class="row mt">' + (t.secs ? '<button class="btn sm soft" data-act="testTimer" data-id="' + t.id + '">⏱ ' + mmss(t.secs) + ' timer</button>' : '') + '<form class="row spacer" data-form="testResult" data-id="' + t.id + '"><input class="in" name="v" type="number" inputmode="decimal" step="any" min="0" placeholder="' + t.unit + '" aria-label="' + esc(t.name) + ' result" style="max-width:110px"><button class="btn sm">Save</button></form></div></div>').join('') +
      '<p class="disclaimer">Only test when you feel well. Skip any test that doesn’t feel safe for you.</p></div>';
  };
  function testTimer(id) {
    const t = PR.TESTS.find(x => x.id === id); let left = t.secs; beep(880, 0.3);
    sheet('<h2 class="center">' + esc(t.name) + '</h2><div class="ringwrap"><svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="45" class="rbg"/><circle id="tring" cx="50" cy="50" r="45" class="rfg"/></svg><b id="tleft">' + mmss(left) + '</b></div><p class="center muted">Count your reps. Enter the total when the timer ends.</p><button class="btn ghost block" data-act="stopTestTimer">Stop</button>');
    clearInterval(TEST); TEST = setInterval(() => { left--; const el = $('#tleft'); if (el) el.textContent = mmss(left); const r = $('#tring'); if (r) r.style.strokeDashoffset = String(283 * (1 - left / t.secs)); if (left <= 3 && left > 0) beep(660, 0.12); if (left <= 0) { clearInterval(TEST); beep(990, 0.5); closeSheet(); toast('Time! Enter your result.'); } }, 1000);
  }

  // ── Profile ──
  views.profile = () => {
    const p = S.profile || {}; const bmi = p.weight && p.height ? (p.weight / Math.pow(p.height / 100, 2)).toFixed(1) : null;
    return topbar('Profile & settings', true) + '<div class="wrap"><div class="card"><div class="food-row"><div><span class="small muted">Name</span><br><b>' + esc(p.name || 'Not set') + '</b></div><button class="storebtn" data-act="editProfile">Edit</button></div>' +
      '<div class="food-row"><div><span class="small muted">Goal</span><br><b>' + esc((GOALS.find(g => g[0] === p.goal) || ['', '', '–'])[2]) + '</b></div></div>' +
      '<div class="food-row"><div><span class="small muted">Body</span><br><b>' + [p.age && p.age + ' yrs', p.weight && p.weight + ' kg', p.height && p.height + ' cm', bmi && 'BMI ' + bmi].filter(Boolean).join(' · ') + '</b></div></div></div>' +
      '<a class="card pro-card" href="#/premium"><h3>' + (isPro() ? '★ Fusion Fit Pro is active' : '★ Go Pro') + '</h3><p>' + (isPro() ? (S.pro.lifetime ? 'Lifetime access. Thank you!' : S.pro.active ? 'Thanks for your support. Manage your subscription.' : 'Pro is switched on for testing.') : 'All programmes, the full stroke plan and quick workouts.') + '</p></a>' +
      (TEST_BUILD ? testSwitchHtml() : '') +
      '<div class="card rg"><h3>Safety</h3><p class="small">Fusion Fit gives general fitness guidance, not medical advice. If you have a medical condition, check with your doctor before starting. In an emergency call ' + EMERGENCY + '.</p><button class="btn soft block" data-act="redoParq">Redo health check</button></div>' +
      '<div class="card"><h3>Data</h3><p class="small muted">Everything is stored privately on this phone.</p><button class="btn danger block" data-act="reset">Reset app & delete my data</button></div>' +
      '<p class="disclaimer center">Fusion Fit v' + esc(APP_VERSION) + (TEST_BUILD ? ' (test build)' : '') + ' · by Fusion Labs</p></div>';
  };

  // ── Pro ──
  let BILL = { status: HAS_BILLING ? 'loading' : 'none', plans: [], lifePrice: '', busy: false };
  let premPlan = 'yearly'; let restoreReq = false;
  const periodText = p => ({ P1W: 'week', P1M: 'month', P3M: '3 months', P6M: '6 months', P1Y: 'year' }[p] || p);
  function trialText(p) { const m = /^P(\d+)([DWM])$/.exec(p || ''); if (!m) return ''; return m[2] === 'M' ? m[1] + '-month' : (+m[1] * (m[2] === 'W' ? 7 : 1)) + '-day'; }
  function planInfo() { const out = {}; (BILL.plans || []).forEach(pl => { const ph = pl.phases || []; const last = ph[ph.length - 1]; if (!last) return; const free = ph.find(x => x.micros === 0); const c = out[pl.basePlanId] || {}; if (!c.price || free) out[pl.basePlanId] = { price: last.price, period: periodText(last.period), micros: last.micros, trial: free ? trialText(free.period) : (c.trial || '') }; }); return out; }
  window.HPBilling = raw => {
    let e; try { e = typeof raw === 'string' ? JSON.parse(raw) : raw; } catch (x) { return; }
    if (e.type === 'plans') { BILL.status = 'ready'; BILL.plans = e.plans || []; }
    else if (e.type === 'lifetime') { BILL.lifePrice = e.price || ''; if (BILL.status !== 'ready') BILL.status = 'ready'; }
    else if (e.type === 'not_listed') { BILL.status = 'not_listed'; BILL.busy = false; }
    else if (e.type === 'cancelled') { BILL.busy = false; toast('Purchase cancelled'); }
    else if (e.type === 'error') { BILL.busy = false; if (e.where === 'unavailable') BILL.status = 'unavailable'; toast(e.message); }
    else if (e.type === 'entitlement') {
      const was = isPro(); const asked = restoreReq; restoreReq = false; BILL.busy = false;
      S.pro = { active: !!e.active, lifetime: !!e.lifetime, checkedAt: Date.now() }; save();
      if (e.pending) toast('Payment pending. Pro switches on once Google confirms it.');
      else if ((e.active || e.lifetime) && !was) toast('Welcome to Fusion Fit Pro ★');
      else if (asked) toast(e.active || e.lifetime ? 'Pro restored ★' : 'No purchase found');
    }
    if (/^\/(premium|profile|home|programs?|stroke)/.test(cur())) render();
  };
  function testSwitchHtml() { return '<div class="card test-card"><div class="row"><div class="spacer"><b>🧪 Turn on Pro for testing</b><br><span class="small muted">Only in test builds. Unlocks everything without paying. Play Store customers don’t see this.</span></div><button class="switch ' + (S.proTest ? 'on' : '') + '" role="switch" aria-checked="' + !!S.proTest + '" aria-label="Pro for testing" data-act="toggleProTest"><span></span></button></div></div>'; }
  views.premium = () => {
    const info = planInfo(); const m = info.monthly || { price: PRICES.monthly, period: 'month' }; const y = info.yearly || { price: PRICES.yearly, period: 'year', trial: PRICES.trialDays + '-day' }; const life = BILL.lifePrice || PRICES.lifetime;
    const saving = info.monthly && info.yearly && info.monthly.micros ? Math.round((1 - info.yearly.micros / (info.monthly.micros * 12)) * 100) : 37;
    let action;
    if (S.pro && S.pro.lifetime) action = '<div class="alert ok"><b>★ You have lifetime Pro.</b> Thank you!</div>';
    else if (S.pro && S.pro.active) action = '<div class="alert ok"><b>★ Pro subscription active.</b></div><a class="btn ghost block" href="https://play.google.com/store/account/subscriptions?sku=' + SUB_ID + '&package=' + PACKAGE + '">Manage or cancel subscription</a>';
    else if (HAS_BILLING && BILL.status === 'ready') { const sel = premPlan === 'monthly' ? m : premPlan === 'lifetime' ? null : y; action = '<button class="btn block" data-act="buyPro"' + (BILL.busy ? ' disabled' : '') + '>' + (premPlan === 'lifetime' ? 'Buy lifetime for ' + life : sel.trial ? 'Start ' + sel.trial + ' free trial' : 'Subscribe for ' + sel.price + '/' + sel.period) + '</button><p class="small muted center mt">' + (premPlan === 'lifetime' ? 'One payment. Pro forever, no subscription.' : (sel.trial ? 'Free for ' + sel.trial.replace('-', ' ') + 's, then ' : '') + sel.price + ' per ' + sel.period + '. Cancel anytime in Google Play.') + '</p>'; }
    else if (HAS_BILLING && BILL.status === 'loading') action = '<div class="center"><div class="spinner"></div><p class="small muted">Loading prices from Google Play…</p></div>';
    else action = '<div class="alert info"><b>Payments open when Fusion Fit is on Google Play.</b><br>' + (TEST_BUILD ? 'This is a test version, so use the switch below to try every Pro feature for free.' : 'Install Fusion Fit from the Google Play Store to buy Pro.') + '</div>';
    const opt = (k, title, sub, price) => '<button class="plan-opt ' + (premPlan === k ? 'on' : '') + '" data-act="premPlan" data-val="' + k + '"><span class="spacer"><b>' + title + '</b><br><span class="small muted">' + sub + '</span></span><span class="price-big">' + price + '</span></button>';
    const owned = S.pro && (S.pro.active || S.pro.lifetime);
    return topbar('Fusion Fit Pro', true) + '<div class="wrap"><div class="card center pro-hero"><img class="logo-sm" src="' + ICON + '" alt=""><h1 class="mt">Train without limits</h1><p>Every programme, every week, your whole recovery plan.</p></div>' +
      '<div class="card"><table class="compare"><thead><tr><th></th><th>Free</th><th>Pro</th></tr></thead><tbody>' + [['Exercise library with animations & muscle maps', '✓', '✓'], ['Fitness test & progress tracking', '✓', '✓'], ['Week 1 of every programme', '✓', '✓'], ['Stroke recovery: Gentle start', '✓', '✓'], ['All 8 weeks of Military Fit 50+', '–', '✓'], ['All weeks of Burn & Lose and Home Strength', '–', '✓'], ['Full 6-week stroke plan & all routines', '–', '✓'], ['Quick workout generator', '–', '✓']].map(r => '<tr><td>' + r[0] + '</td><td>' + r[1] + '</td><td><b>' + r[2] + '</b></td></tr>').join('') + '</tbody></table></div>' +
      (owned ? '' : opt('yearly', 'Yearly <span class="pill">Save ' + saving + '%</span>', y.price + ' a year · ' + PRICES.yearlyPerMonth + ' a month' + (y.trial ? ' · ' + y.trial + ' free trial' : ''), y.price) + opt('monthly', 'Monthly', 'Cancel anytime', m.price) + opt('lifetime', 'Lifetime <span class="pill">Pay once</span>', 'One payment, Pro forever', life)) +
      action + (HAS_BILLING ? '<button class="linkbtn block center mt" data-act="restorePro">Restore purchases</button>' : '') + (TEST_BUILD ? testSwitchHtml() : '') +
      '<p class="disclaimer">Payment is charged to your Google Play account. Subscriptions renew automatically unless cancelled at least 24 hours before the end of the period. Fusion Fit gives general fitness guidance, not medical advice.</p></div>';
  };

  // ───────── Sheets ─────────
  function safetySheet() { sheet('<h2>Train safely</h2><ul class="checklist"><li>Warm up first and cool down after.</li><li>Use sturdy furniture: chairs against a wall, counters that can’t move.</li><li>Breathe out during the effort; never hold your breath.</li><li>Mild muscle soreness the next day is normal. Sharp or joint pain is not.</li><li>Drink water and rest well between sessions.</li></ul><div class="alert warn"><b>Stop immediately and get help</b> if you have chest pain or pressure, severe breathlessness, dizziness or fainting, an irregular heartbeat, or sudden weakness, numbness, face drooping, or trouble speaking or seeing. Call ' + EMERGENCY + '.</div><button class="btn block" data-act="closeSheet">Got it</button>'); }
  function unwellSheet() { if (PLAY) PLAY.paused = true; sheet('<h2>🆘 Stop and rest</h2><p>Sit or lie down somewhere safe and breathe slowly.</p><div class="alert warn"><b>Call ' + EMERGENCY + ' now</b> if you have chest pain or pressure, severe breathlessness, fainting, or sudden weakness, numbness, face drooping, confusion, or trouble speaking or seeing.</div><p class="small">If you just feel tired or light-headed, rest for a few minutes and drink some water. It’s fine to end the workout early.</p><div class="actions"><button class="btn ghost" data-act="resumeAfterUnwell">I’m OK, continue</button><button class="btn danger" data-act="endEarly">End workout</button></div>'); }
  function quickSheet() {
    if (!isPro()) { go('/premium'); toast('Quick workouts are part of Pro'); return; }
    sheet('<h2>⚡ Quick workout</h2><label class="f">Time</label><div class="chips">' + [10, 15, 20, 30].map(m => '<button class="chip ' + (quickSheet.m === m ? 'on' : '') + '" data-act="qm" data-val="' + m + '">' + m + ' min</button>').join('') + '</div><label class="f">Focus</label><div class="chips wrapc">' + [['full', 'Full body'], ['legs', 'Legs'], ['upper', 'Upper body'], ['core', 'Core'], ['cardio', 'Cardio'], ['seated', 'Seated / gentle']].map(f => '<button class="chip ' + (quickSheet.f === f[0] ? 'on' : '') + '" data-act="qf" data-val="' + f[0] + '">' + f[1] + '</button>').join('') + '</div><button class="btn block mt" data-act="makeQuick">Create workout</button>');
  }
  quickSheet.m = 15; quickSheet.f = 'full';
  function strokeGate(cb) {
    if (S.strokeOk) { cb(); return; }
    strokeGate.cb = cb; strokeGate.checks = strokeGate.checks || [false, false, false];
    const items = ['My doctor or physiotherapist has said it’s safe for me to exercise.', 'I have a sturdy chair (and a counter for standing exercises), and someone nearby if I need help.', 'I know the stroke warning signs (BE FAST) and will stop and call ' + EMERGENCY + ' if they appear.'];
    sheet('<h2>Before you start</h2><p class="small muted">Please confirm each of these.</p>' + items.map((t, i) => '<label class="check-row"><input type="checkbox" data-act="gateCheck" data-i="' + i + '"' + (strokeGate.checks[i] ? ' checked' : '') + '> <span>' + esc(t) + '</span></label>').join('') + '<button class="btn block mt" data-act="gateOk"' + (strokeGate.checks.every(Boolean) ? '' : ' disabled') + '>Continue</button><button class="btn ghost block mt" data-act="closeSheet">Not now</button>');
  }

  // ───────── Render ─────────
  const TABS = ['home', 'programs', 'stroke', 'exercises', 'progress'];
  function render() {
    const raw = cur(); const [path] = raw.split('?'); const parts = path.split('/').filter(Boolean);
    let name = parts[0] || 'home'; const arg = parts[1];
    if (!S.profile && name !== 'setup') name = 'welcome';
    const fn = views[name] || views.home;
    const noTabs = ['welcome', 'setup', 'play', 'done'].includes(name);
    document.body.classList.toggle('no-tabs', noTabs);
    $('#tabbar').hidden = noTabs;
    const tabName = TABS.includes(name) ? name : name === 'program' || name === 'session' ? 'programs' : name === 'ex' || name === 'test' ? (name === 'test' ? 'progress' : 'exercises') : '';
    document.querySelectorAll('#tabbar a').forEach(a => a.classList.toggle('on', a.dataset.tab === tabName));
    F.stopAll();
    $('#app').innerHTML = fn(arg) + (['welcome', 'setup', 'play', 'done'].includes(name) ? '' : credit());
    F.animate($('#app'), id => X.BY[id] && X.BY[id].pose);
    if (render.last !== path) { window.scrollTo(0, 0); render.last = path; }
  }

  // ───────── Actions ─────────
  const A = {
    back, closeSheet, confirmYes() { const cb = askConfirm.cb; askConfirm.cb = null; closeSheet(); if (cb) cb(); },
    startSetup() { D = null; setupStep = 1; go('/setup'); render(); },
    setupBack() { if (setupStep > 1) { setupStep--; render(); } else if (S.profile) go('/profile'); else go('/welcome'); },
    setGoal(el) { D.goal = el.dataset.val; render(); },
    setField(el) { D[el.dataset.k] = el.dataset.val; render(); },
    parq(el) { D.parq[+el.dataset.i] = el.dataset.val === '1'; render(); },
    setupNext() {
      if (setupStep < 3) { setupStep++; render(); return; }
      const first = !S.profile; S.profile = Object.assign({}, D, { age: +D.age || null, weight: +D.weight || null, height: +D.height || null, parqFlag: D.parq.some(Boolean) });
      if (D.weight && !S.weights.length) S.weights.push({ date: today(), kg: +D.weight });
      if (first || !S.active) {
        const rec = D.goal === 'stroke' ? 'stroke' : D.goal === 'weight' ? 'burn' : D.goal === 'muscle' ? (+D.age >= 50 ? 'military' : 'strength') : D.goal === 'military' ? 'military' : (+D.age >= 50 ? 'military' : 'burn');
        S.active = { prog: rec, started: today() };
      }
      D = null; save(); go(S.profile.goal === 'stroke' ? '/stroke' : '/home'); render(); if (first) toast('You’re all set. Let’s train! 💪');
    },
    editProfile() { D = null; setupStep = 2; go('/setup'); render(); },
    redoParq() { D = null; setupStep = 3; go('/setup'); render(); },
    activate(el) { S.active = { prog: el.dataset.p, started: today() }; save(); toast('Programme started'); render(); },
    openSession(el) {
      const prog = progById(el.dataset.p); const w = +el.dataset.w, d = +el.dataset.d;
      if (sessionLocked(prog, w, d)) { go('/premium'); toast('This session is part of Pro'); return; }
      SESSION = { prog, week: w, day: d, w: prog.gen(w)[d], key: prog.id + ':' + w + ':' + d };
      const open = () => go('/session');
      if (prog.stroke) strokeGate(open); else open();
    },
    strokeRoutine(el) {
      const r = PR.STROKE[el.dataset.id]; if (!r.free && !isPro()) { go('/premium'); toast('This routine is part of Pro'); return; }
      const prog = progById('stroke'); SESSION = { prog: { warmup: prog.warmup, cooldown: prog.cooldown, stroke: true }, w: { title: r.name, note: r.desc, blocks: r.blocks }, key: null };
      strokeGate(() => go('/session'));
    },
    gateCheck(el) { strokeGate.checks[+el.dataset.i] = el.checked; const b = document.querySelector('[data-act="gateOk"]'); if (b) b.disabled = !strokeGate.checks.every(Boolean); },
    gateOk() { S.strokeOk = true; save(); closeSheet(); const cb = strokeGate.cb; strokeGate.cb = null; if (cb) cb(); },
    startPlayer() { startPlayer(); },
    nextStep() { nextStep(); }, prevStep() { prevStep(); },
    pause() { PLAY.paused = !PLAY.paused; render(); },
    addRest() { PLAY.left += 15; const el = $('#ptimer'); if (el) el.textContent = mmss(PLAY.left); },
    quitPlay() { PLAY.paused = true; askConfirm('End this workout?', 'End workout', () => finishPlayer(true)); },
    unwell() { unwellSheet(); },
    resumeAfterUnwell() { closeSheet(); if (PLAY) PLAY.paused = false; render(); },
    endEarly() { closeSheet(); finishPlayer(true); },
    feel(el) { PLAY.feel = el.dataset.val; render(); },
    saveWorkout() {
      const s = PLAY.summary; S.history.unshift({ date: today(), title: SESSION.w.title, mins: s.mins, kcal: s.kcal, feel: PLAY.feel || null });
      if (SESSION.key && !s.early) S.done[SESSION.key] = today();
      if (S.history.length > 300) S.history.length = 300;
      save(); PLAY = null; go('/home'); render(); toast('Workout saved 💪');
    },
    tryEx(el) { const e = X.BY[el.dataset.id]; SESSION = { prog: null, w: { title: e.name, blocks: [{ ex: e.id, sets: 1, reps: e.dose.reps, secs: e.dose.secs, rest: 0 }] }, key: null }; const go2 = () => startPlayer(); if (e.cat.includes('stroke') || e.cat.includes('stroke2')) strokeGate(go2); else go2(); },
    libCat(el) { libCat = el.dataset.val; render(); },
    logWeight() { sheet('<h2>Log your weight</h2><form data-form="weight"><label class="f" for="w-kg">Weight (kg)</label><input class="in" id="w-kg" name="kg" type="number" inputmode="decimal" step="0.1" min="30" max="300" required value="' + esc((S.weights[S.weights.length - 1] || {}).kg || '') + '"><button class="btn block mt">Save</button></form>'); },
    testTimer(el) { testTimer(el.dataset.id); },
    stopTestTimer() { clearInterval(TEST); closeSheet(); },
    safety() { safetySheet(); },
    quickSheet() { quickSheet(); },
    qm(el) { quickSheet.m = +el.dataset.val; quickSheet(); },
    qf(el) { quickSheet.f = el.dataset.val; quickSheet(); },
    makeQuick() { const w = PR.quick(quickSheet.f, quickSheet.m); SESSION = { prog: { warmup: quickSheet.f === 'seated' ? [] : [{ ex: 'march', sets: 1, secs: 60, rest: 10 }], cooldown: [{ ex: 'hamstretch', sets: 1, secs: 30, rest: 0 }] }, w, key: null }; closeSheet(); go('/session'); },
    premPlan(el) { premPlan = el.dataset.val; render(); },
    buyPro() { if (!HAS_BILLING) return; BILL.busy = true; render(); HPN.billingBuy(premPlan); setTimeout(() => { if (BILL.busy) { BILL.busy = false; render(); } }, 15000); },
    restorePro() { if (!HAS_BILLING) return; restoreReq = true; toast('Checking Google Play…'); HPN.billingRestore(); },
    toggleProTest() { S.proTest = !S.proTest; save(); render(); toast(S.proTest ? 'Pro switched on for testing ★' : 'Pro testing switched off'); },
    reset() { askConfirm('Delete all Fusion Fit data from this phone? This can’t be undone.', 'Delete everything', () => { try { localStorage.removeItem(STORE_KEY); } catch (e) { /* ignore */ } S = defaults(); STACK.length = 0; go('/welcome'); render(); }); },
  };
  document.addEventListener('click', e => {
    if (!USE_HASH) { const a = e.target.closest('a[href^="#/"]'); if (a) { e.preventDefault(); go(a.getAttribute('href').slice(1)); return; } }
    const el = e.target.closest('[data-act]'); if (!el) { if (e.target.id === 'sheet') closeSheet(); return; }
    const fn = A[el.dataset.act]; if (!fn) return;
    if (!(el.tagName === 'INPUT' && el.type === 'checkbox')) e.preventDefault();
    fn(el, e);
  });
  document.addEventListener('input', e => { const el = e.target; if (el.dataset.bind && D) D[el.dataset.bind] = el.value; });
  document.addEventListener('change', e => { const el = e.target; if (el.dataset.actChange === 'libMuscle') { libMuscle = el.value; render(); } });
  document.addEventListener('submit', e => {
    const f = e.target; const k = f.dataset.form; if (!k) return; e.preventDefault(); const fd = new FormData(f);
    if (k === 'weight') { const kg = Math.round(+fd.get('kg') * 10) / 10; if (kg > 0) { S.weights = S.weights.filter(w => w.date !== today()); S.weights.push({ date: today(), kg }); if (S.profile) S.profile.weight = kg; save(); closeSheet(); render(); toast('Weight saved'); } }
    if (k === 'testResult') { const v = +fd.get('v'); if (v >= 0 && fd.get('v') !== '') { S.tests.push({ id: f.dataset.id, value: v, date: today() }); save(); f.reset(); toast('Result saved ✓'); } }
  });
  if (USE_HASH) window.addEventListener('hashchange', () => { closeSheet(); render(); });
  document.addEventListener('visibilitychange', () => { if (document.hidden) F.stopAll(); else render(); });
  if (HAS_BILLING) { try { HPN.billingRefresh(); } catch (e) { BILL.status = 'unavailable'; } }
  render();
})();
