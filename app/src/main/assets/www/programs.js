/* Fusion Fit – training programmes
 * A workout is a list of blocks: { ex, sets, reps | secs, rest } plus optional circuit rounds.
 * Week 1 of every programme and the "Gentle start" stroke routine are free; the rest is Pro.
 */
(function (root) {
  'use strict';
  const b = (ex, sets, dose, rest) => Object.assign({ ex, sets, rest: rest == null ? 45 : rest }, typeof dose === 'number' ? { reps: dose } : dose);
  const secs = s => ({ secs: s });
  const WARMUP = [b('march', 1, secs(60), 10), b('armcircles', 1, secs(30), 10), b('hinge', 1, 8, 10), b('buttkicks', 1, secs(30), 15)];
  const WARMUP_GENTLE = [b('seatedmarch', 1, 10, 15), b('ankle', 1, 15, 15)];
  const COOLDOWN = [b('quadstretch', 1, secs(30), 5), b('hamstretch', 1, secs(30), 5), b('calfstretch', 1, secs(30), 5), b('chest', 1, secs(30), 5), b('childpose', 1, secs(30), 0)];
  const COOLDOWN_GENTLE = [b('hamstretch', 1, secs(30), 5)];

  // ── Military Fit 50+ (8 weeks, 3 sessions a week) ──
  function military(week) {
    const phase = week <= 2 ? 0 : week <= 5 ? 1 : 2; const step = week <= 2 ? week - 1 : week <= 5 ? week - 3 : week - 6;
    const P = ['Recruit', 'Soldier', 'Ranger'][phase];
    const A = [
      [b('chairsquat', 2, 10), b('counterpush', 2, 8 + step * 2), b('row', 2, 10), b('plank', 2, secs(20 + step * 5)), b('farmer', 2, secs(30))],
      [b('chairsquat', 3, 12), b('pushup', 3, 6 + step * 2), b('row', 3, 12), b('lunge', 2, 8), b('plank', 3, secs(30 + step * 5))],
      [b('chairsquat', 4, 15), b('pushup', 4, 10 + step * 2), b('row', 4, 12), b('dips', 3, 8 + step), b('plank', 3, secs(45 + step * 5))],
    ][phase];
    const B = [
      [b('ruck', 1, secs(600 + step * 300), 0), b('stepup', 2, 8), b('birddog', 2, 6)],
      [b('ruck', 1, secs(1500 + step * 300), 0), b('stepup', 3, 10), b('superman', 2, 10)],
      [b('ruck', 1, secs(2100 + step * 300), 0), b('stepup', 3, 12), b('superman', 3, 12)],
    ][phase];
    const C = [
      { rounds: 2 + step, blocks: [b('chairsquat', 1, 10, 15), b('counterpush', 1, 8, 15), b('march', 1, secs(30), 15), b('situp', 1, 10, 15), b('farmer', 1, secs(30), 60)] },
      { rounds: 3, blocks: [b('burpee', 1, 6 + step, 15), b('stepup', 1, 8, 15), b('shadowbox', 1, secs(30), 15), b('mountain', 1, secs(20), 15), b('flutter', 1, secs(20), 75)] },
      { rounds: 4, blocks: [b('burpee', 1, 8 + step, 15), b('lunge', 1, 8, 15), b('pushup', 1, 8, 15), b('mountain', 1, secs(30), 15), b('situp', 1, 15, 15), b('farmer', 1, secs(40), 75)] },
    ][phase];
    return [
      { title: P + ' strength', note: 'Strength day: slow, controlled reps.', blocks: A },
      { title: P + ' ruck march', note: 'Endurance day: march with a loaded backpack, then legs and back.', blocks: B },
      { title: P + ' boot camp circuit', note: 'Do the exercises back to back; rest after each round.', circuit: C },
    ];
  }

  // ── Burn & Lose (6 weeks, 4 sessions a week) ──
  function burn(week) {
    const r = Math.min(4, 2 + Math.floor((week - 1) / 2)); const s = 20 + (week - 1) * 5;
    return [
      { title: 'Fat-burn circuit', note: 'Keep moving: short rests, steady effort.', circuit: { rounds: r, blocks: [b('march', 1, secs(s + 10), 10), b('chairsquat', 1, 12, 10), b('shadowbox', 1, secs(s), 10), b('counterpush', 1, 10, 10), b('highknees', 1, secs(s), 10), b('deadbug', 1, 6, 60)] } },
      { title: 'Brisk walk', note: 'Walk at a pace where talking is possible but singing isn’t.', blocks: [b('walk', 1, secs(1200 + week * 180), 0)] },
      { title: 'Low-impact cardio', note: 'Easy on the knees, still hard on calories.', circuit: { rounds: r, blocks: [b('stepup', 1, 10, 10), b('mountain', 1, secs(s), 10), b('bridge', 1, 12, 10), b('buttkicks', 1, secs(s), 10), b('plank', 1, secs(s), 60)] } },
      { title: 'Long walk or ruck', note: 'Optional backpack for extra burn.', blocks: [b(week >= 3 ? 'ruck' : 'walk', 1, secs(1800 + week * 120), 0)] },
    ];
  }

  // ── Home Strength (8 weeks, push / pull / legs) ──
  function strength(week) {
    const sets = week <= 2 ? 3 : 4; const add = Math.floor((week - 1) / 2) * 2;
    return [
      { title: 'Push day', note: 'Chest, shoulders and triceps.', blocks: [b(week <= 2 ? 'counterpush' : 'pushup', sets, 8 + add, 60), b('press', sets, 10 + add, 60), b('dips', 3, 8 + add / 2, 60), b('plank', 3, secs(30 + add * 3), 45)] },
      { title: 'Pull day', note: 'Back, biceps and grip.', blocks: [b('row', sets, 10 + add, 60), b('towelrow', sets, 8 + add, 60), b('curl', 3, 12, 45), b('superman', 3, 10, 45), b('farmer', 2, secs(40), 60)] },
      { title: 'Leg day', note: 'Thighs, glutes and calves.', blocks: [b('chairsquat', sets, 12 + add, 60), b('lunge', 3, 8 + add / 2, 60), b('stepup', 3, 10, 60), b('bridge', 3, 12 + add, 45), b('heelraise', 3, 15, 30), b('wallsit', 2, secs(30 + add * 3), 60)] },
    ];
  }

  // ── Stroke recovery routines ──
  const STROKE = {
    gentle: { id: 'gentle', name: 'Gentle start (seated)', free: true, desc: 'Seated exercises to get moving safely. Good for the early days at home, or when you’re tired.',
      blocks: [b('seatedmarch', 2, 10, 30), b('ankle', 2, 15, 20), b('kneeext', 2, 8, 30), b('broomraise', 2, 8, 30), b('tableslide', 2, 10, 30), b('grip', 2, 10, 20), b('forwardreach', 2, 8, 30), b('hamstretch', 1, secs(30), 0)] },
    standing: { id: 'standing', name: 'Standing strength (with support)', desc: 'Leg strength and balance, always holding a counter with a chair behind you.',
      blocks: [b('sitstand', 2, 6, 60), b('heelraise', 2, 10, 45), b('kneeraise', 2, 6, 45), b('legback', 2, 6, 45), b('wallpush', 2, 8, 45), b('onelegstand', 2, secs(10), 45)] },
    hands: { id: 'hands', name: 'Arm & hand recovery', desc: 'Reach, grip and fine-motor practice for the weaker arm and hand.',
      blocks: [b('broomraise', 2, 10, 30), b('tableslide', 3, 10, 30), b('grip', 3, 10, 20), b('finger', 2, secs(120), 30), b('wallpush', 2, 8, 45)] },
    stairs: { id: 'stairs', name: 'Walking & stairs', desc: 'Practise steps and stairs with a rail. Have someone nearby.',
      blocks: [b('sitstand', 2, 8, 60), b('kneeraise', 2, 8, 45), b('stairstep', 2, 5, 60), b('walk', 1, secs(300), 60), b('calfstretch', 1, secs(30), 0)] },
  };
  function strokePlan(week) {
    const s = r => Object.assign({}, STROKE[r], { title: STROKE[r].name, note: STROKE[r].desc });
    if (week <= 2) return [s('gentle'), s('hands'), s('gentle')];
    if (week <= 4) return [s('gentle'), s('standing'), s('hands'), s('standing')];
    return [s('standing'), s('hands'), s('stairs'), s('standing'), s('hands')];
  }

  const PROGRAMS = [
    { id: 'military', name: 'Military Fit 50+', tag: 'Boot camp for men 50+', icon: '🎖️', weeks: 8, perWeek: 3, gen: military, warmup: WARMUP, cooldown: COOLDOWN,
      desc: 'Train like a soldier, safely. Eight weeks from Recruit to Ranger: strength days, ruck marches with a loaded backpack, and boot-camp circuits. Built for men over 50 who want to get strong, lean and fit using a chair, a wall and a backpack.', goals: ['military', 'muscle', 'weight'] },
    { id: 'burn', name: 'Burn & Lose', tag: 'Weight loss', icon: '🔥', weeks: 6, perWeek: 4, gen: burn, warmup: WARMUP, cooldown: COOLDOWN,
      desc: 'Low-impact fat-burning circuits and walking that get harder every two weeks. Easy on the joints, no jumping needed.', goals: ['weight'] },
    { id: 'strength', name: 'Home Strength', tag: 'Build muscle', icon: '💪', weeks: 8, perWeek: 3, gen: strength, warmup: WARMUP, cooldown: COOLDOWN,
      desc: 'Push, pull and leg days using backpacks, water bottles, towels, a chair and the stairs. Sets and reps increase as you get stronger.', goals: ['muscle'] },
    { id: 'stroke', name: 'Stroke Recovery at Home', tag: 'Gentle & supported', icon: '❤️', weeks: 6, perWeek: 4, gen: strokePlan, warmup: WARMUP_GENTLE, cooldown: COOLDOWN_GENTLE, stroke: true,
      desc: 'Seated and supported exercises for strength, balance, arm and hand control, using a chair, a counter, a towel and a broomstick. Always follow your doctor’s or physiotherapist’s advice.', goals: ['stroke'] },
  ];

  // ── Fitness test (military-style, adapted for older adults) ──
  const TESTS = [
    { id: 'pushups', name: 'Push-ups in 2 minutes', ex: 'pushup', unit: 'reps', secs: 120, higher: true, note: 'Use whichever version you can do with good form (floor, knees or counter) and use the same one each time.' },
    { id: 'sitstand', name: 'Chair stands in 30 seconds', ex: 'sitstand', unit: 'reps', secs: 30, higher: true, note: 'Arms crossed on your chest. Count full stands. Used by doctors to measure leg strength in older adults.' },
    { id: 'plank', name: 'Plank hold', ex: 'plank', unit: 'seconds', higher: true, note: 'Hold with good form as long as you can (up to 3 minutes).' },
    { id: 'walk', name: '1.6 km (1 mile) walk or run', ex: 'walk', unit: 'minutes', higher: false, note: 'Time yourself over 1.6 km on flat ground. Walk, jog or run.' },
  ];

  // ── Quick workout generator (Pro) ──
  const FOCUS = {
    full: ['chairsquat', 'counterpush', 'row', 'stepup', 'plank', 'press', 'bridge', 'mountain', 'deadbug', 'farmer'],
    legs: ['chairsquat', 'lunge', 'stepup', 'bridge', 'wallsit', 'heelraise'],
    upper: ['pushup', 'counterpush', 'row', 'press', 'curl', 'dips', 'towelrow'],
    core: ['plank', 'deadbug', 'birddog', 'situp', 'flutter', 'superman', 'mountain'],
    cardio: ['march', 'highknees', 'shadowbox', 'burpee', 'mountain', 'stepup', 'buttkicks'],
    seated: ['seatedmarch', 'kneeext', 'ankle', 'broomraise', 'tableslide', 'forwardreach', 'grip'],
  };
  function quick(focus, minutes, seed) {
    const pool = (FOCUS[focus] || FOCUS.full).slice(); let x = seed || Date.now();
    const rnd = () => { x = (x * 9301 + 49297) % 233280; return x / 233280; };
    pool.sort(() => rnd() - 0.5);
    const n = Math.max(3, Math.min(pool.length, Math.round(minutes / 4)));
    const rounds = Math.max(1, Math.round(minutes / (n * 1.3)));
    const gentle = focus === 'seated';
    return { title: minutes + '-min ' + { full: 'full body', legs: 'legs', upper: 'upper body', core: 'core', cardio: 'cardio', seated: 'seated' }[focus], note: 'Generated for you. Rest when you need to.',
      circuit: { rounds, blocks: pool.slice(0, n).map((id, i) => { const e = root.FF_EX.BY[id]; const dose = e.dose.secs ? { secs: Math.min(gentle ? 40 : 45, e.dose.secs) } : { reps: e.dose.reps }; return b(id, 1, dose, i === n - 1 ? 60 : (gentle ? 30 : 15)); }) } };
  }

  root.FF_PROG = { PROGRAMS, STROKE, TESTS, quick, FOCUS };
})(window);
