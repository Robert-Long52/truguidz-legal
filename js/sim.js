/* Hero: a stand on a contour map, scent drifting downwind. The cone uses the same rules as ScentCone.swift. */
(function () {
  'use strict';
  var cv = document.getElementById('sim');
  if (!cv || !cv.getContext) return;
  var ctx = cv.getContext('2d');
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  var dirIn = document.getElementById('wind-dir'), spdIn = document.getElementById('wind-spd');
  var dirOut = document.getElementById('wind-dir-out'), spdOut = document.getElementById('wind-spd-out');
  var readout = document.getElementById('sim-readout'), hint = document.getElementById('sim-hint');

  var state = { from: +dirIn.value, speed: +spdIn.value };
  var W = 0, H = 0, dpr = 1, ppy = 1, cx = 0, cy = 0;
  var bg = document.createElement('canvas');
  var parts = [];
  var running = true, last = 0, dragging = false;

  var POINTS = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
  function compass(d) { return POINTS[Math.round(((d % 360) + 360) % 360 / 22.5) % 16]; }

  // The same rules as ScentCone.swift.
  function cone(from, mph) {
    var calm = mph < 2;
    return {
      calm: calm,
      down: (from + 180) % 360,
      yards: calm ? 65 : Math.min(100 + 25 * mph, 500),
      half: mph >= 12 ? 15 : 22.5
    };
  }
  function vec(bearingDeg) { var r = bearingDeg * Math.PI / 180; return { x: Math.sin(r), y: -Math.cos(r) }; }

  /* ---- contour backdrop (marching squares over a sum-of-sines height field) ---- */
  function height(x, y) {
    return Math.sin(x * 0.011 + 1.3) * 0.9 + Math.sin(y * 0.014 - 0.4) * 0.8 +
           Math.sin((x + y) * 0.0075 + 2.1) * 1.1 + Math.sin(Math.hypot(x - 90, y - 330) * 0.013) * 0.9 +
           Math.sin(x * 0.027 - y * 0.019) * 0.28;
  }
  function buildContours() {
    bg.width = Math.round(W * dpr); bg.height = Math.round(H * dpr);
    var g = bg.getContext('2d');
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, W, H);
    var step = 11, cols = Math.ceil(W / step) + 1, rows = Math.ceil(H / step) + 1;
    var f = [];
    for (var j = 0; j < rows; j++) { f[j] = []; for (var i = 0; i < cols; i++) f[j][i] = height(i * step, j * step); }
    var levels = []; for (var l = -3; l <= 3; l += 0.42) levels.push(l);
    levels.forEach(function (t, li) {
      g.beginPath();
      for (var j2 = 0; j2 < rows - 1; j2++) for (var i2 = 0; i2 < cols - 1; i2++) {
        var tl = f[j2][i2], tr = f[j2][i2 + 1], br = f[j2 + 1][i2 + 1], bl = f[j2 + 1][i2];
        var c = (tl > t ? 8 : 0) | (tr > t ? 4 : 0) | (br > t ? 2 : 0) | (bl > t ? 1 : 0);
        if (c === 0 || c === 15) continue;
        var x0 = i2 * step, y0 = j2 * step;
        var E = [
          [x0 + step * (t - tl) / (tr - tl), y0],
          [x0 + step, y0 + step * (t - tr) / (br - tr)],
          [x0 + step * (t - bl) / (br - bl), y0 + step],
          [x0, y0 + step * (t - tl) / (bl - tl)]
        ];
        var T = { 1: [[3, 2]], 2: [[2, 1]], 3: [[3, 1]], 4: [[0, 1]], 5: [[0, 3], [1, 2]], 6: [[0, 2]], 7: [[0, 3]], 8: [[0, 3]], 9: [[0, 2]], 10: [[0, 1], [2, 3]], 11: [[0, 1]], 12: [[3, 1]], 13: [[1, 2]], 14: [[2, 3]] }[c];
        T.forEach(function (s) { g.moveTo(E[s[0]][0], E[s[0]][1]); g.lineTo(E[s[1]][0], E[s[1]][1]); });
      }
      g.strokeStyle = li % 3 === 0 ? 'rgba(244,239,226,0.17)' : 'rgba(244,239,226,0.075)';
      g.lineWidth = li % 3 === 0 ? 1.1 : 0.8;
      g.stroke();
    });
  }

  function resize() {
    var r = cv.getBoundingClientRect();
    if (!r.width) return;
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = r.width; H = r.height;
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    cx = W * 0.5; cy = H * 0.5;
    ppy = Math.min(W, H) * 0.44 / 500;   // pixels per yard so a 500 yd plume fits
    buildContours();
    draw(0);
  }

  function accent() { return document.documentElement.getAttribute('data-theme') === 'dawn' ? [227, 121, 79] : [211, 168, 108]; }
  function rgba(c, a) { return 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + a + ')'; }

  /* ---- particles ---- */
  function spawn() {
    var k = cone(state.from, state.speed), life = 2.1 + Math.random() * 1.4;
    var bearing = k.calm ? Math.random() * 360 : k.down + (Math.random() * 2 - 1) * k.half * 0.92;
    var v = vec(bearing), dist = k.yards * ppy * (0.55 + Math.random() * 0.45);
    parts.push({ x: cx, y: cy, vx: v.x * dist / life, vy: v.y * dist / life, age: 0, life: life, r: 1.2 + Math.random() * 1.9, w: Math.random() * 6.28 });
  }
  function step(dt) {
    var rate = state.speed < 2 ? 36 : 56;
    var n = rate * dt + Math.random();
    for (var i = 0; i < n && parts.length < 320; i++) spawn();
    for (var p = parts.length - 1; p >= 0; p--) {
      var q = parts[p];
      q.age += dt; q.w += dt * 3;
      if (q.age >= q.life) { parts.splice(p, 1); continue; }
      q.x += q.vx * dt + Math.cos(q.w) * 0.22;
      q.y += q.vy * dt + Math.sin(q.w) * 0.22;
    }
  }

  function draw(dt) {
    ctx.clearRect(0, 0, W, H);
    ctx.drawImage(bg, 0, 0, W, H);
    var a = accent(), k = cone(state.from, state.speed), len = k.yards * ppy;

    // cone
    ctx.beginPath();
    if (k.calm) {
      ctx.arc(cx, cy, len, 0, Math.PI * 2);
    } else {
      ctx.moveTo(cx, cy);
      for (var d = -k.half; d <= k.half + 0.01; d += 3) { var v = vec(k.down + d); ctx.lineTo(cx + v.x * len, cy + v.y * len); }
      ctx.closePath();
    }
    var grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, len);
    grad.addColorStop(0, rgba(a, 0.34)); grad.addColorStop(1, rgba(a, 0.05));
    ctx.fillStyle = grad; ctx.fill();
    ctx.setLineDash([5, 5]); ctx.lineWidth = 1.2; ctx.strokeStyle = rgba(a, 0.7); ctx.stroke(); ctx.setLineDash([]);

    // particles
    for (var i = 0; i < parts.length; i++) {
      var q = parts[i], t = q.age / q.life;
      ctx.globalAlpha = Math.pow(1 - t, 1.3) * 0.85;
      ctx.fillStyle = 'rgb(' + a[0] + ',' + a[1] + ',' + a[2] + ')';
      ctx.beginPath(); ctx.arc(q.x, q.y, q.r * (1 + t * 0.6), 0, 6.283); ctx.fill();
    }
    ctx.globalAlpha = 1;

    // wind arrow on the "from" side, pointing at the stand (also the drag handle)
    var fv = vec(state.from), R = Math.min(W, H) * 0.42, ax = cx + fv.x * R, ay = cy + fv.y * R;
    var tipx = cx + fv.x * (R - 46), tipy = cy + fv.y * (R - 46);
    ctx.strokeStyle = rgba([244, 239, 226], 0.85); ctx.fillStyle = rgba([244, 239, 226], 0.85); ctx.lineWidth = 2; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(tipx, tipy); ctx.stroke();
    var ang = Math.atan2(tipy - ay, tipx - ax);
    ctx.beginPath(); ctx.moveTo(tipx, tipy);
    ctx.lineTo(tipx - 10 * Math.cos(ang - 0.45), tipy - 10 * Math.sin(ang - 0.45));
    ctx.lineTo(tipx - 10 * Math.cos(ang + 0.45), tipy - 10 * Math.sin(ang + 0.45)); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.arc(ax, ay, 6, 0, 6.283); ctx.fillStyle = 'rgb(' + a[0] + ',' + a[1] + ',' + a[2] + ')'; ctx.fill();
    ctx.lineWidth = 2; ctx.strokeStyle = '#14170f'; ctx.stroke();
    ctx.font = '600 11px Inter, sans-serif'; ctx.fillStyle = rgba([244, 239, 226], 0.8); ctx.textAlign = 'center';
    ctx.fillText(compass(state.from), ax + fv.x * 18, ay + fv.y * 18 + 4);

    // stand pin
    ctx.beginPath(); ctx.arc(cx, cy, 11, 0, 6.283); ctx.fillStyle = rgba(a, 0.22); ctx.fill();
    ctx.beginPath(); ctx.arc(cx, cy, 6, 0, 6.283); ctx.fillStyle = 'rgb(' + a[0] + ',' + a[1] + ',' + a[2] + ')'; ctx.fill();
    ctx.lineWidth = 2; ctx.strokeStyle = '#14170f'; ctx.stroke();
    ctx.fillStyle = rgba([244, 239, 226], 0.9); ctx.font = '600 11px Inter, sans-serif'; ctx.textAlign = 'left';
    ctx.fillText('Stand', cx + 14, cy - 10);
  }

  function frame(ts) {
    if (!running) return;
    var dt = Math.min((ts - last) / 1000 || 0.016, 0.05); last = ts;
    step(dt); draw(dt);
    requestAnimationFrame(frame);
  }

  /* ---- state + UI ---- */
  function sync(fromInputs) {
    state.from = ((state.from % 360) + 360) % 360;
    if (!fromInputs) { dirIn.value = Math.round(state.from) % 360; }
    dirOut.textContent = ' ' + compass(state.from) + ' ' + Math.round(state.from) + '°';
    spdOut.textContent = ' ' + state.speed + ' mph';
    var k = cone(state.from, state.speed);
    readout.innerHTML = k.calm
      ? '<b>Calm.</b> Under 2 mph there is no steady wind to carry scent, so TruHuntz shows a small all-round area of about <b>' + k.yards + ' yd</b>.'
      : 'Scent drifts toward the <b>' + compass(k.down) + '</b>, up to about <b>' + Math.round(k.yards) + ' yd</b>, spread <b>±' + k.half + '°</b>.';
    if (reduce) draw(0);
  }
  dirIn.addEventListener('input', function () { state.from = +dirIn.value; sync(true); });
  spdIn.addEventListener('input', function () { state.speed = +spdIn.value; sync(true); });

  function pointer(e) {
    var r = cv.getBoundingClientRect();
    var dx = e.clientX - r.left - cx, dy = e.clientY - r.top - cy;
    if (Math.hypot(dx, dy) < 12) return;
    state.from = (Math.atan2(dx, -dy) * 180 / Math.PI + 360) % 360;
    sync(false);
  }
  cv.addEventListener('pointerdown', function (e) { dragging = true; cv.classList.add('drag'); cv.setPointerCapture(e.pointerId); hint.classList.add('gone'); pointer(e); });
  cv.addEventListener('pointermove', function (e) { if (dragging) pointer(e); });
  function end() { dragging = false; cv.classList.remove('drag'); }
  cv.addEventListener('pointerup', end); cv.addEventListener('pointercancel', end);

  if ('ResizeObserver' in window) new ResizeObserver(resize).observe(cv); else window.addEventListener('resize', resize);
  document.addEventListener('themechange', function () { draw(0); });

  // Pause when scrolled away or the tab is hidden.
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (es) {
      var vis = es[0].isIntersecting;
      if (vis && !running && !reduce) { running = true; last = performance.now(); requestAnimationFrame(frame); }
      else if (!vis) running = false;
    }).observe(cv);
  }
  document.addEventListener('visibilitychange', function () { if (document.hidden) running = false; else if (!reduce) { running = true; last = performance.now(); requestAnimationFrame(frame); } });

  sync(false);
  resize();
  if (reduce) { running = false; } else { requestAnimationFrame(frame); }
})();
