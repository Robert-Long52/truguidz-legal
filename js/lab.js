/* The code lab (live ScentCone math tied to the Swift listing) and the architecture diagram. */
(function () {
  'use strict';
  var NS = 'http://www.w3.org/2000/svg';
  var POINTS = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
  function compass(d) { return POINTS[Math.round(((d % 360) + 360) % 360 / 22.5) % 16]; }
  function el(name, attrs) { var n = document.createElementNS(NS, name); for (var k in attrs) n.setAttribute(k, attrs[k]); return n; }

  /* ================= Code lab ================= */
  var svg = document.getElementById('cone-svg');
  if (svg) {
    var fromIn = document.getElementById('c-from'), spdIn = document.getElementById('c-speed');
    var fromOut = document.getElementById('c-from-out'), spdOut = document.getElementById('c-speed-out');
    var vCalm = document.getElementById('v-calm'), vDown = document.getElementById('v-down'), vLen = document.getElementById('v-len'), vHalf = document.getElementById('v-half');
    var code = document.getElementById('swift-code');
    var lines = code.querySelectorAll('.ln');

    function layout() {
      svg.innerHTML = '';
      // faint rings every 100 yd so the length reads as a distance
      [100, 200, 300, 400, 500].forEach(function (y) {
        svg.appendChild(el('circle', { cx: 150, cy: 150, r: y * 0.28, fill: 'none', stroke: 'currentColor', 'stroke-opacity': '0.12' }));
      });
      var poly = el('path', { id: 'cone-path', fill: 'currentColor', 'fill-opacity': '0.28', stroke: 'currentColor', 'stroke-width': '1.5', 'stroke-dasharray': '4 4' });
      var dot = el('circle', { cx: 150, cy: 150, r: 5.5, fill: 'currentColor' });
      var halo = el('circle', { cx: 150, cy: 150, r: 10, fill: 'currentColor', 'fill-opacity': '0.2' });
      var n = el('text', { x: 150, y: 14, 'text-anchor': 'middle', 'font-size': '11', fill: 'currentColor', 'fill-opacity': '0.6', 'font-family': 'Inter, sans-serif' });
      n.textContent = 'N';
      svg.appendChild(poly); svg.appendChild(halo); svg.appendChild(dot); svg.appendChild(n);
      svg.style.color = 'var(--accent)';
    }
    layout();

    function update() {
      var from = +fromIn.value, mph = +spdIn.value;
      // --- the Swift, line for line ---
      var isCalm = mph < 2;
      var downwind = (from + 180) % 360;
      var yards = isCalm ? 65 : Math.min(100 + 25 * mph, 500);
      var half = mph >= 12 ? 15 : 22.5;
      // --------------------------------
      var r = yards * 0.28, d = '';
      if (isCalm) {
        d = 'M ' + (150 - r) + ' 150 a ' + r + ' ' + r + ' 0 1 0 ' + (2 * r) + ' 0 a ' + r + ' ' + r + ' 0 1 0 ' + (-2 * r) + ' 0 Z';
      } else {
        d = 'M 150 150';
        for (var a = downwind - half; a <= downwind + half + 0.01; a += 3) {
          var rad = a * Math.PI / 180;
          d += ' L ' + (150 + Math.sin(rad) * r).toFixed(2) + ' ' + (150 - Math.cos(rad) * r).toFixed(2);
        }
        d += ' Z';
      }
      document.getElementById('cone-path').setAttribute('d', d);

      fromOut.textContent = compass(from) + ' ' + from + '°';
      spdOut.textContent = mph + ' mph';
      vCalm.textContent = isCalm ? 'true' : 'false';
      vDown.textContent = downwind + '°';
      vLen.textContent = Math.round(yards) + ' yd';
      vHalf.textContent = '±' + half + '°';

      // light up the branch of the Swift that is actually running right now
      var live = { calm: isCalm, moving: !isCalm, gust: mph >= 12, light: mph < 12 };
      code.querySelectorAll('[data-b]').forEach(function (s) { s.classList.toggle('live', !!live[s.dataset.b]); });
    }
    fromIn.addEventListener('input', update);
    spdIn.addEventListener('input', update);
    update();

    // hover or focus a value to find the code behind it
    function hl(rule, on) { lines.forEach(function (ln) { ln.classList.toggle('hl', on && ln.dataset.r === rule); }); }
    document.querySelectorAll('#cone-vals .row').forEach(function (row) {
      var rule = row.dataset.r;
      row.addEventListener('mouseenter', function () { hl(rule, true); });
      row.addEventListener('mouseleave', function () { hl(rule, false); });
      row.addEventListener('focus', function () { hl(rule, true); });
      row.addEventListener('blur', function () { hl(rule, false); });
      row.addEventListener('click', function () { hl(rule, true); var first = code.querySelector('.ln[data-r="' + rule + '"]'); if (first) first.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); });
    });
  }

  /* ================= Architecture diagram ================= */
  var arch = document.getElementById('arch-svg');
  if (arch) {
    var INFO = {
      supabase: {
        name: 'Supabase', kind: 'Shared backend',
        text: 'The backend behind both apps. One login works in TruHuntz and TruGuidz.',
        points: ['Sign-in and account data for both apps', 'Row Level Security keeps each person\'s data theirs', 'The same pattern TruKit packages for other builders']
      },
      truhuntz: {
        name: 'TruHuntz', kind: 'iOS app',
        text: 'Wind and scent-cone mapping for iPhone, built in SwiftUI.',
        points: ['Home-screen and lock-screen widgets via WidgetKit', 'Private pins with an optional account that backs them up', 'Uses the shared Supabase login']
      },
      truguidz: {
        name: 'TruGuidz', kind: 'iOS app',
        text: 'Connects explorers with real, local guides. Browse, book and pay in one place.',
        points: ['Verified guides and real reviews', 'Secure payments through Stripe', 'Same Supabase backend and login as TruHuntz']
      },
      portal: {
        name: 'Guide portal', kind: 'Web app',
        text: 'Guides can sign up in the app or on the web portal.',
        points: ['Runs on the same Supabase backend as the iOS app', 'Lives at guides.truguidz.com']
      },
      stripe: {
        name: 'Stripe', kind: 'Payments',
        text: 'Handles payments for TruGuidz bookings.',
        points: ['Secure card payments for explorers', 'Also one of the paywall options in TruKit']
      },
      trukit: {
        name: 'TruKit', kind: 'Starter kit',
        text: 'A SwiftUI + Supabase boilerplate for iOS, so other builders can skip the setup chores.',
        points: ['Email and Sign in with Apple auth with in-app account deletion', 'Paywall with Stripe, StoreKit 2 or RevenueCat behind one protocol', 'Real-time map, Row Level Security and four Edge Functions', 'Demo mode that runs the whole app before you connect a backend']
      }
    };
    var panel = document.getElementById('arch-panel');
    var nodes = arch.querySelectorAll('.node');
    var edges = arch.querySelectorAll('.edge');

    function show(id) {
      var info = INFO[id]; if (!info) return;
      nodes.forEach(function (n) { n.classList.toggle('on', n.dataset.id === id); });
      edges.forEach(function (e) { e.classList.toggle('on', e.dataset.a === id || e.dataset.b === id); });
      panel.innerHTML = '<div class="kind"></div><h3></h3><p></p><ul></ul>';
      panel.querySelector('.kind').textContent = info.kind;
      panel.querySelector('h3').textContent = info.name;
      panel.querySelector('p').textContent = info.text;
      var ul = panel.querySelector('ul');
      info.points.forEach(function (t) { var li = document.createElement('li'); li.textContent = t; ul.appendChild(li); });
    }
    nodes.forEach(function (n) {
      n.addEventListener('click', function () { show(n.dataset.id); });
      n.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); show(n.dataset.id); } });
    });
    show('supabase');
  }
})();
