/* Renders data/github.json (home) and data/media.json (media page). Both files are refreshed by a scheduled GitHub Action. */
(function () {
  'use strict';
  function load(path) {
    return fetch(path, { cache: 'no-cache' }).then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); });
  }
  function ago(iso) {
    var s = (Date.now() - new Date(iso).getTime()) / 1000;
    if (!isFinite(s)) return '';
    var steps = [[60, 'second'], [60, 'minute'], [24, 'hour'], [7, 'day'], [4.35, 'week'], [12, 'month'], [Infinity, 'year']];
    var v = s, i = 0;
    for (; i < steps.length - 1 && v >= steps[i][0]; i++) v /= steps[i][0];
    v = Math.max(1, Math.round(v));
    var unit = i === 0 ? 'minute' : steps[i][1];
    if (i === 0) return 'just now';
    return v + ' ' + unit + (v === 1 ? '' : 's') + ' ago';
  }
  function fmtDate(iso) {
    var d = new Date(iso); if (isNaN(d)) return '';
    return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  }
  function text(tag, cls, t) { var n = document.createElement(tag); if (cls) n.className = cls; n.textContent = t; return n; }

  var COLORS = ['#7a5230', '#6b8f5e', '#c49a5a', '#8a7a62', '#4d6b4a', '#b5623f'];
  function colorFor(i) { return COLORS[i % COLORS.length]; }

  /* ---------------- GitHub (home page) ---------------- */
  var ghGrid = document.getElementById('gh-grid');
  if (ghGrid) {
    load('data/github.json').then(function (g) {
      var bar = document.getElementById('gh-langbar'), legend = document.getElementById('gh-legend');
      var langColor = {};
      g.languages.forEach(function (l, i) {
        langColor[l.name] = colorFor(i);
        var s = document.createElement('span'); s.style.flex = l.pct + ' 0 0'; s.style.background = colorFor(i); s.title = l.name + ' ' + l.pct + '%'; bar.appendChild(s);
        var li = document.createElement('li'); var dot = document.createElement('i'); dot.style.background = colorFor(i);
        li.appendChild(dot); li.appendChild(document.createTextNode(l.name + ' ' + Math.round(l.pct) + '%')); legend.appendChild(li);
      });

      // heat grid: 13 weeks, Sunday-first columns, ending today
      var heat = document.getElementById('gh-heat');
      var today = new Date(); today.setHours(0, 0, 0, 0);
      var start = new Date(today); start.setDate(start.getDate() - (13 * 7 - 1) - 0);
      start.setDate(start.getDate() - start.getDay());
      var max = 0; Object.keys(g.activity).forEach(function (k) { max = Math.max(max, g.activity[k]); });
      for (var d = new Date(start); d <= today; d.setDate(d.getDate() + 1)) {
        var key = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
        var n = g.activity[key] || 0, level = n === 0 ? 0 : Math.min(4, Math.ceil(n / Math.max(1, max) * 4));
        var cell = document.createElement('span'); cell.dataset.l = level; cell.title = key + ': ' + n + ' commit' + (n === 1 ? '' : 's'); heat.appendChild(cell);
      }
      heat.setAttribute('aria-label', g.commits_90d + ' public commits in the last 90 days');
      document.getElementById('gh-foot').textContent = g.commits_90d + ' public commit' + (g.commits_90d === 1 ? '' : 's') + ' in the last 90 days across ' + g.repo_count + ' public repositories. Private work is not counted. Updated ' + ago(g.updated) + '.';

      var ul = document.getElementById('gh-repos'); ul.innerHTML = '';
      g.repos.slice(0, 5).forEach(function (r) {
        var li = document.createElement('li');
        var a = text('a', 'name', r.name); a.href = r.url; a.target = '_blank'; a.rel = 'noopener';
        li.appendChild(a);
        if (r.description) li.appendChild(text('p', '', r.description));
        var meta = document.createElement('div'); meta.className = 'meta';
        if (r.language) { var sp = document.createElement('span'); var dot = document.createElement('i'); dot.style.background = langColor[r.language] || '#8a7a62'; sp.appendChild(dot); sp.appendChild(document.createTextNode(r.language)); meta.appendChild(sp); }
        if (r.stars) meta.appendChild(text('span', '', '★ ' + r.stars));
        meta.appendChild(text('span', '', 'Updated ' + ago(r.pushed_at)));
        li.appendChild(meta); ul.appendChild(li);
      });
    }).catch(function () {
      var ul = document.getElementById('gh-repos');
      ul.innerHTML = '<li class="muted">Live data is unavailable right now. See <a href="https://github.com/Robert-Long52" target="_blank" rel="noopener">github.com/Robert-Long52</a>.</li>';
    });
  }

  /* ---------------- Media page ---------------- */
  var yt = document.getElementById('yt-grid');
  if (yt) {
    load('data/media.json').then(function (m) {
      yt.innerHTML = '';
      if (!m.youtube.length) yt.appendChild(text('div', 'empty-card', 'Latest videos will appear here.'));
      m.youtube.forEach(function (v) {
        var a = document.createElement('a'); a.className = 'vcard'; a.href = v.url; a.target = '_blank'; a.rel = 'noopener';
        var th = document.createElement('div'); th.className = 'vthumb';
        if (v.thumb) { var img = document.createElement('img'); img.src = v.thumb; img.alt = ''; img.loading = 'lazy'; img.width = 320; img.height = 180; th.appendChild(img); }
        var pl = document.createElement('div'); pl.className = 'play'; pl.appendChild(document.createElement('i')); th.appendChild(pl);
        var body = document.createElement('div'); body.className = 'body';
        body.appendChild(text('h3', '', v.title));
        body.appendChild(text('time', '', fmtDate(v.published)));
        a.appendChild(th); a.appendChild(body); yt.appendChild(a);
      });

      var dv = document.getElementById('dev-list'); dv.innerHTML = '';
      if (!m.devto.length) dv.appendChild(text('div', 'empty-card', 'Posts will appear here.'));
      m.devto.forEach(function (p) {
        var a = document.createElement('a'); a.className = 'acard'; a.href = p.url; a.target = '_blank'; a.rel = 'noopener';
        a.appendChild(text('time', '', fmtDate(p.published) + (p.minutes ? ' · ' + p.minutes + ' min read' : '')));
        a.appendChild(text('h3', '', p.title));
        if (p.description) a.appendChild(text('p', '', p.description));
        if (p.tags && p.tags.length) { var t = document.createElement('div'); t.className = 'tags'; p.tags.slice(0, 4).forEach(function (x) { t.appendChild(text('span', '', '#' + x)); }); a.appendChild(t); }
        dv.appendChild(a);
      });

      var rd = document.getElementById('reddit-list'); rd.innerHTML = '';
      if (m.reddit && m.reddit.length) {
        m.reddit.forEach(function (p) {
          var a = document.createElement('a'); a.className = 'acard'; a.href = p.url; a.target = '_blank'; a.rel = 'noopener';
          a.appendChild(text('time', '', fmtDate(p.published) + (p.subreddit ? ' · ' + p.subreddit : '')));
          a.appendChild(text('h3', '', p.title));
          rd.appendChild(a);
        });
      } else {
        var c = document.createElement('div'); c.className = 'empty-card';
        c.innerHTML = '<b>Nothing here yet.</b> Reddit discussions will show up on this page once the account has started posting.';
        rd.appendChild(c);
      }
      var st = document.getElementById('stale'); if (st) st.textContent = 'Updated ' + ago(m.updated) + '. This page refreshes itself a few times a day.';
    }).catch(function () {
      yt.innerHTML = '<div class="empty-card">Latest uploads are unavailable right now. Watch on <a href="https://www.youtube.com/@TruOutdoorz" target="_blank" rel="noopener">YouTube</a> or read on <a href="https://dev.to/truoutdoorz" target="_blank" rel="noopener">Dev.to</a>.</div>';
    });
  }
})();
