/* Fusion Fit – exercise illustrations
 * 1) An animated side-view figure posed by joint angles (two key poses, eased back and forth),
 *    with household props (chair, wall, counter, stairs, backpack, bottles, towel, broomstick).
 * 2) A front/back body map that highlights the muscles an exercise works.
 * Angles: limbs use absolute angles in degrees, 0 = pointing straight down, 90 = pointing forward
 * (to the right), 180 = straight up, negative = pointing backward. Torso: 0 = upright, 90 = lying
 * with head forward (right), -90 = lying with head backward (left).
 */
(function (root) {
  'use strict';
  const L = { torso: 46, neck: 7, head: 10, upper: 24, fore: 22, thigh: 31, shin: 30, foot: 10 };
  const GROUND = 186;
  const COL = { ink: '#15243F', far: '#8FA0BB', hl: '#2F7BFF', hlFar: '#9CC3FF', prop: '#C9D2E0', propDark: '#9AA8BE', skin: '#15243F' };
  const rad = d => d * Math.PI / 180;
  const limbDir = a => [Math.sin(rad(a)), Math.cos(rad(a))];
  const upDir = t => [Math.sin(rad(t)), -Math.cos(rad(t))];
  const add = (p, d, len) => [p[0] + d[0] * len, p[1] + d[1] * len];
  const lerp = (a, b, k) => a + (b - a) * k;

  // Two-link inverse kinematics: limb spec {to:[x,y], flip} → absolute angles
  function ik(base, target, a, b, bendForward) {
    let dx = target[0] - base[0], dy = target[1] - base[1]; let d = Math.hypot(dx, dy) || 0.001;
    const dc = Math.min(a + b - 0.01, Math.max(Math.abs(a - b) + 0.01, d));
    const theta = Math.atan2(dx, dy) * 180 / Math.PI;
    const alpha = Math.acos(Math.max(-1, Math.min(1, (a * a + dc * dc - b * b) / (2 * a * dc)))) * 180 / Math.PI;
    const first = bendForward ? theta + alpha : theta - alpha;
    const e = add(base, limbDir(first), a);
    const second = Math.atan2(target[0] - e[0], target[1] - e[1]) * 180 / Math.PI;
    return [first, second];
  }
  // Converts hand/foot targets into joint angles so poses can be mixed smoothly
  function normalize(P) {
    if (P._n) return P._n;
    const hip = P.hip; const sh = add(hip, upDir(P.t || 0), L.torso);
    const arms = (P.arms || [[0, 0]]).map(x => { if (!x || Array.isArray(x)) return x; const [u, f] = ik(sh, x.to, L.upper, L.fore, !!x.flip); return [u, f - u]; });
    const legs = (P.legs || [[0, 0]]).map(x => { if (!x || Array.isArray(x)) return x; const [t, s2] = ik(hip, x.to, L.thigh, L.shin, !x.flip); return [t, t - s2, x.ft == null ? 90 : x.ft]; });
    P._n = { hip, t: P.t || 0, head: P.head || 0, arms, legs };
    return P._n;
  }

  function joints(P) {
    const hip = P.hip; const ud = upDir(P.t || 0);
    const sh = add(hip, ud, L.torso);
    const neck = add(sh, upDir((P.t || 0) + (P.head || 0)), L.neck);
    const head = add(neck, upDir((P.t || 0) + (P.head || 0)), L.head);
    const arm = ([ua, eb]) => { const el = add(sh, limbDir(ua), L.upper); const wr = add(el, limbDir(ua + eb), L.fore); return [sh, el, wr]; };
    const leg = ([th, kn, ft]) => { const kneeP = add(hip, limbDir(th), L.thigh); const an = add(kneeP, limbDir(th - kn), L.shin); const toe = add(an, limbDir(ft == null ? 90 : ft), L.foot); return [hip, kneeP, an, toe]; };
    return { hip, sh, neck, head, armN: arm(P.arms[0]), armF: arm(P.arms[1] || P.arms[0]), legN: leg(P.legs[0]), legF: leg(P.legs[1] || P.legs[0]) };
  }
  function mix(A, B, k) {
    const m = (x, y) => Array.isArray(x) ? x.map((v, i) => m(v, y[i])) : (x == null ? x : lerp(x, y == null ? x : y, k));
    return { hip: m(A.hip, B.hip), t: lerp(A.t || 0, B.t == null ? (A.t || 0) : B.t, k), head: lerp(A.head || 0, B.head == null ? (A.head || 0) : B.head, k), arms: m(A.arms, B.arms || A.arms), legs: m(A.legs, B.legs || A.legs) };
  }
  const pl = pts => pts.map(p => p[0].toFixed(1) + ',' + p[1].toFixed(1)).join(' ');
  const line = (pts, color, w) => '<polyline points="' + pl(pts) + '" fill="none" stroke="' + color + '" stroke-width="' + w + '" stroke-linecap="round" stroke-linejoin="round"/>';

  // Household props drawn behind or in front of the figure
  function propSvg(p, J) {
    const c = COL.prop, d = COL.propDark;
    switch (p.type) {
      case 'floor': return '<rect x="8" y="' + GROUND + '" width="184" height="5" rx="2.5" fill="' + d + '" opacity=".35"/>';
      case 'mat': return '<rect x="' + (p.x || 30) + '" y="' + (GROUND - 3) + '" width="' + (p.w || 140) + '" height="5" rx="2.5" fill="#7FB1FF" opacity=".55"/>';
      case 'chair': { const x = p.x || 60, s = p.seat || 142, w = 36; const back = p.back !== false; return '<g fill="none" stroke="' + d + '" stroke-width="4" stroke-linecap="round"><line x1="' + x + '" y1="' + s + '" x2="' + (x + w) + '" y2="' + s + '"/><line x1="' + (x + 3) + '" y1="' + s + '" x2="' + (x + 3) + '" y2="' + GROUND + '"/><line x1="' + (x + w - 3) + '" y1="' + s + '" x2="' + (x + w - 3) + '" y2="' + GROUND + '"/>' + (back ? '<line x1="' + (p.backRight ? x + w : x) + '" y1="' + s + '" x2="' + (p.backRight ? x + w : x) + '" y2="' + (s - 42) + '"/>' : '') + '</g>';
      }
      case 'wall': return '<rect x="' + p.x + '" y="20" width="8" height="' + (GROUND - 20) + '" fill="' + c + '"/>';
      case 'counter': return '<g fill="' + c + '"><rect x="' + p.x + '" y="' + (p.y || 112) + '" width="' + (p.w || 34) + '" height="7" rx="2"/><rect x="' + (p.x + 4) + '" y="' + ((p.y || 112) + 7) + '" width="' + ((p.w || 34) - 8) + '" height="' + (GROUND - (p.y || 112) - 7) + '" fill="' + d + '" opacity=".35"/></g>';
      case 'table': return '<g stroke="' + d + '" stroke-width="4" stroke-linecap="round"><line x1="' + p.x + '" y1="' + (p.y || 130) + '" x2="' + (p.x + (p.w || 70)) + '" y2="' + (p.y || 130) + '"/><line x1="' + (p.x + (p.w || 70) - 4) + '" y1="' + (p.y || 130) + '" x2="' + (p.x + (p.w || 70) - 4) + '" y2="' + GROUND + '"/></g>';
      case 'step': return '<rect x="' + p.x + '" y="' + (GROUND - (p.h || 18)) + '" width="' + (p.w || 60) + '" height="' + (p.h || 18) + '" fill="' + c + '" rx="2"/>';
      case 'stairs': return '<path d="M' + p.x + ' ' + GROUND + 'v-18h34v-18h34v-18h40v54z" fill="' + c + '"/>';
      case 'door': return '<rect x="' + p.x + '" y="30" width="7" height="' + (GROUND - 30) + '" fill="' + d + '"/>';
      case 'backpack': { const ud = upDir(J.t || 0); const mid = add(J.hip, ud, 28); const n = [-ud[1], ud[0]]; const bx = mid[0] - n[0] * 9, by = mid[1] - n[1] * 9; return '<rect x="' + (bx - 8) + '" y="' + (by - 13) + '" width="16" height="26" rx="5" fill="#5D7FB0" transform="rotate(' + (J.t || 0) + ' ' + bx + ' ' + by + ')"/>'; }
      case 'bottle': case 'bag': { const w = J.armN[2]; return p.type === 'bottle' ? '<rect x="' + (w[0] - 3.5) + '" y="' + (w[1] - 9) + '" width="7" height="18" rx="2" fill="#4FB2FF"/>' : '<path d="M' + (w[0] - 9) + ' ' + (w[1] + 4) + 'h18l-2 18h-14z" fill="#5D7FB0"/><line x1="' + w[0] + '" y1="' + w[1] + '" x2="' + w[0] + '" y2="' + (w[1] + 5) + '" stroke="#5D7FB0" stroke-width="2"/>'; }
      case 'broom': { const a = J.armN[2], b = J.armF[2]; const dx = b[0] - a[0], dy = b[1] - a[1]; const len = Math.hypot(dx, dy) || 1; const ux = dx / len || 1, uy = dy / len; return '<line x1="' + (a[0] - ux * 14) + '" y1="' + (a[1] - uy * 14) + '" x2="' + (b[0] + ux * 30) + '" y2="' + (b[1] + uy * 30) + '" stroke="#B9895B" stroke-width="3.5" stroke-linecap="round"/>'; }
      case 'towel': { const a = J.armN[2], b = J.armF[2]; return '<path d="M' + a[0] + ' ' + a[1] + 'Q' + ((a[0] + b[0]) / 2) + ' ' + (Math.max(a[1], b[1]) + 8) + ' ' + b[0] + ' ' + b[1] + '" stroke="#F4AC3D" stroke-width="5" fill="none" stroke-linecap="round"/>'; }
      case 'ball': { const w = J.armN[2]; return '<circle cx="' + w[0] + '" cy="' + w[1] + '" r="5" fill="#F4AC3D"/>'; }
      default: return '';
    }
  }
  const FRONT_PROPS = { bottle: 1, bag: 1, broom: 1, towel: 1, ball: 1 };

  function figureSvg(P, hl, props) {
    const J = joints(P); hl = hl || [];
    const isHl = part => hl.includes(part);
    const W = 9, Wf = 8;
    let s = '';
    (props || []).filter(p => !FRONT_PROPS[p.type]).forEach(p => { s += propSvg(p, Object.assign({ t: P.t }, J)); });
    // far side limbs (lighter)
    s += line(J.legF.slice(0, 3), isHl('legs') ? COL.hlFar : COL.far, Wf) + line(J.legF.slice(2), isHl('legs') ? COL.hlFar : COL.far, 6);
    s += line(J.armF, isHl('arms') ? COL.hlFar : COL.far, 7);
    // torso & head
    s += line([J.hip, J.sh], isHl('torso') ? COL.hl : COL.ink, 13);
    s += line([J.sh, J.neck], COL.ink, 7);
    s += '<circle cx="' + J.head[0].toFixed(1) + '" cy="' + J.head[1].toFixed(1) + '" r="' + L.head + '" fill="' + COL.ink + '"/>';
    // near side limbs
    s += line(J.legN.slice(0, 3), isHl('legs') ? COL.hl : COL.ink, W) + line(J.legN.slice(2), isHl('legs') ? COL.hl : COL.ink, 6.5);
    s += line(J.armN, isHl('arms') ? COL.hl : COL.ink, 7.5);
    (props || []).filter(p => FRONT_PROPS[p.type]).forEach(p => { s += propSvg(p, Object.assign({ t: P.t }, J)); });
    return s;
  }

  // Animates every .fig[data-ex] element on screen. Returns a stop function.
  let animating = [];
  function animate(container, getPose) {
    stopAll();
    const els = Array.from((container || document).querySelectorAll('svg.fig[data-ex]'));
    if (!els.length) return;
    const reduce = root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let raf = 0; const t0 = performance.now();
    const frame = now => {
      els.forEach(el => {
        const pose = getPose(el.dataset.ex); if (!pose) return;
        const period = (pose.period || 2.6) * 1000; const ph = ((now - t0) % period) / period;
        let k = pose.hold ? 0.5 + 0.03 * Math.sin(ph * Math.PI * 2) : 0.5 - 0.5 * Math.cos(ph * Math.PI * 2);
        if (reduce) k = pose.hold ? 0.5 : 1;
        const P = pose.b ? mix(normalize(pose.a), normalize(pose.b), pose.hold ? 0 : k) : normalize(pose.a);
        el.innerHTML = '<rect x="8" y="' + GROUND + '" width="184" height="4" rx="2" fill="#9AA8BE" opacity=".3"/>' + figureSvg(P, pose.hl, pose.props);
      });
      if (!reduce) raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    animating.push(() => cancelAnimationFrame(raf));
  }
  function stopAll() { animating.forEach(f => f()); animating = []; }
  function staticSvg(pose, k) {
    const P = pose.b ? mix(normalize(pose.a), normalize(pose.b), k == null ? 1 : k) : normalize(pose.a);
    return '<rect x="8" y="' + GROUND + '" width="184" height="4" rx="2" fill="#9AA8BE" opacity=".3"/>' + figureSvg(P, pose.hl, pose.props);
  }

  // ── Body map ──
  const SIL = '#E3E8F0';
  const FRONT = {
    shoulders: [['e', 29, 46, 7, 6], ['e', 71, 46, 7, 6]], chest: [['e', 42, 55, 8.5, 6.5], ['e', 58, 55, 8.5, 6.5]],
    biceps: [['e', 25, 64, 4.5, 9], ['e', 75, 64, 4.5, 9]], forearms: [['e', 21, 87, 3.8, 10], ['e', 79, 87, 3.8, 10]],
    abs: [['r', 44, 64, 12, 30, 4]], obliques: [['e', 38.5, 80, 3.5, 10], ['e', 61.5, 80, 3.5, 10]],
    hipflexors: [['e', 43, 100, 4.5, 5], ['e', 57, 100, 4.5, 5]], quads: [['e', 42.5, 123, 6.5, 19], ['e', 57.5, 123, 6.5, 19]],
    adductors: [['e', 47.5, 117, 2.5, 11], ['e', 52.5, 117, 2.5, 11]], shins: [['e', 42.5, 163, 3.5, 13], ['e', 57.5, 163, 3.5, 13]],
    neck: [['e', 50, 36, 5, 4]], grip: [['e', 19, 101, 3.5, 4], ['e', 81, 101, 3.5, 4]],
  };
  const BACK = {
    traps: [['p', '42,38 58,38 54,52 46,52']], shoulders: [['e', 29, 46, 7, 6], ['e', 71, 46, 7, 6]],
    lats: [['e', 39, 64, 7, 12], ['e', 61, 64, 7, 12]], triceps: [['e', 25, 64, 4.5, 9], ['e', 75, 64, 4.5, 9]],
    lowerback: [['e', 50, 87, 7, 7]], glutes: [['e', 43.5, 104, 7.5, 8], ['e', 56.5, 104, 7.5, 8]],
    hamstrings: [['e', 42.5, 128, 6, 15], ['e', 57.5, 128, 6, 15]], calves: [['e', 42.5, 159, 4.8, 11], ['e', 57.5, 159, 4.8, 11]],
    forearms: [['e', 21, 87, 3.8, 10], ['e', 79, 87, 3.8, 10]],
  };
  const silhouette = '<g fill="' + SIL + '"><circle cx="50" cy="20" r="11"/><rect x="45" y="29" width="10" height="9" rx="3"/><path d="M30 40 Q50 34 70 40 L66 96 Q50 104 34 96 Z"/><rect x="18" y="42" width="11" height="58" rx="5.5"/><rect x="71" y="42" width="11" height="58" rx="5.5"/><path d="M34 94 Q50 102 66 94 L64 180 L52 180 L50 118 L48 180 L36 180 Z"/></g>';
  function shapes(def, names, color) {
    return names.map(n => (def[n] || []).map(s => s[0] === 'e' ? '<ellipse cx="' + s[1] + '" cy="' + s[2] + '" rx="' + s[3] + '" ry="' + s[4] + '" fill="' + color + '"/>' : s[0] === 'r' ? '<rect x="' + s[1] + '" y="' + s[2] + '" width="' + s[3] + '" height="' + s[4] + '" rx="' + s[5] + '" fill="' + color + '"/>' : '<polygon points="' + s[1] + '" fill="' + color + '"/>').join('')).join('');
  }
  function bodyMap(primary, secondary) {
    const all = n => Object.keys(n);
    const side = (def, label, x) => '<g transform="translate(' + x + ',0)">' + silhouette + shapes(def, all(def), '#D2DAE6') + shapes(def, (secondary || []).filter(n => def[n]), '#9CC3FF') + shapes(def, (primary || []).filter(n => def[n]), '#2F7BFF') + '<text x="50" y="196" text-anchor="middle" font-size="9" font-weight="700" fill="#5A6472">' + label + '</text></g>';
    return '<svg viewBox="0 0 210 200" class="bodymap" role="img" aria-label="Muscles worked">' + side(FRONT, 'FRONT', 0) + side(BACK, 'BACK', 110) + '</svg>';
  }

  root.FFFigure = { animate, stopAll, staticSvg, bodyMap, figureSvg, mix, normalize, GROUND };
})(window);
