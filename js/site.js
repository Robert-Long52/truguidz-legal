/* Shared behavior: dawn mode, nav highlight, reveals, timeline, command palette + terminal. No dependencies. */
(function () {
  'use strict';
  var root = document.documentElement;
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- Dawn mode ---------- */
  var dawnBtn = document.getElementById('dawn-toggle');
  function setDawn(on, save) {
    if (on) root.setAttribute('data-theme', 'dawn'); else root.removeAttribute('data-theme');
    if (dawnBtn) dawnBtn.setAttribute('aria-pressed', on ? 'true' : 'false');
    if (save) { try { localStorage.setItem('tru-theme', on ? 'dawn' : 'day'); } catch (e) {} }
    document.dispatchEvent(new CustomEvent('themechange'));
  }
  var isDawn = function () { return root.getAttribute('data-theme') === 'dawn'; };
  if (dawnBtn) {
    dawnBtn.setAttribute('aria-pressed', isDawn() ? 'true' : 'false');
    dawnBtn.addEventListener('click', function () { setDawn(!isDawn(), true); });
  }

  /* ---------- Reveal on scroll ---------- */
  var reveals = document.querySelectorAll('.reveal');
  if ('IntersectionObserver' in window && !reduceMotion) {
    var ro = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('in'); ro.unobserve(e.target); } });
    }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
    reveals.forEach(function (el) { ro.observe(el); });
  } else {
    reveals.forEach(function (el) { el.classList.add('in'); });
  }

  /* ---------- Current-section highlight ---------- */
  var secLinks = {};
  document.querySelectorAll('nav.top a[data-sec]').forEach(function (a) { secLinks[a.dataset.sec] = a; });
  var ids = Object.keys(secLinks);
  if (ids.length && 'IntersectionObserver' in window) {
    // Sections that don't have their own nav link map to the nearest one.
    var alias = { arch: 'how', github: 'how', timeline: 'about' };
    var current = null;
    var so = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        var key = alias[e.target.id] || e.target.id;
        if (secLinks[key] && key !== current) {
          if (current) secLinks[current].removeAttribute('aria-current');
          secLinks[key].setAttribute('aria-current', 'true');
          current = key;
        }
      });
    }, { rootMargin: '-45% 0px -50% 0px' });
    ['built', 'how', 'arch', 'github', 'timeline', 'hub', 'about'].forEach(function (id) {
      var el = document.getElementById(id); if (el) so.observe(el);
    });
  }

  /* ---------- Timeline progress ---------- */
  var tl = document.getElementById('tl');
  if (tl) {
    var items = tl.querySelectorAll('li');
    var ticking = false;
    var update = function () {
      ticking = false;
      var r = tl.getBoundingClientRect();
      var vh = window.innerHeight;
      var p = (vh * 0.6 - r.top) / r.height;
      p = Math.max(0, Math.min(1, p));
      tl.style.setProperty('--p', p.toFixed(3));
      items.forEach(function (li) {
        var lr = li.getBoundingClientRect();
        li.classList.toggle('on', lr.top < vh * 0.6);
      });
    };
    window.addEventListener('scroll', function () { if (!ticking) { ticking = true; requestAnimationFrame(update); } }, { passive: true });
    window.addEventListener('resize', update);
    update();
  }

  /* ---------- Command palette + terminal ---------- */
  var onHome = !!document.getElementById('built');
  var home = function (hash) { return onHome ? hash : '/' + hash; };
  var ITEMS = [
    { label: 'Software I\'ve built', kind: 'Section', href: home('#built') },
    { label: 'TruHuntz', kind: 'Project', href: home('#truhuntz') },
    { label: 'TruKit', kind: 'Project', href: home('#trukit') },
    { label: 'TruGuidz', kind: 'Project', href: home('#truguidz') },
    { label: 'How the scent cone works (the Swift)', kind: 'Section', href: home('#how') },
    { label: 'Architecture diagram', kind: 'Section', href: home('#arch') },
    { label: 'What\'s on GitHub', kind: 'Section', href: home('#github') },
    { label: 'Timeline', kind: 'Section', href: home('#timeline') },
    { label: 'Media: latest videos and writing', kind: 'Page', href: onHome ? 'media.html' : '/media.html' },
    { label: 'Elsewhere: social channels', kind: 'Section', href: home('#hub') },
    { label: 'About me', kind: 'Section', href: home('#about') },
    { label: 'YouTube', kind: 'Social', href: 'https://www.youtube.com/@TruOutdoorz', ext: true },
    { label: 'TikTok', kind: 'Social', href: 'https://www.tiktok.com/@truoutdoorz', ext: true },
    { label: 'X', kind: 'Social', href: 'https://x.com/TruOutdoorz', ext: true },
    { label: 'Dev.to', kind: 'Social', href: 'https://dev.to/truoutdoorz', ext: true },
    { label: 'GitHub', kind: 'Social', href: 'https://github.com/Robert-Long52', ext: true },
    { label: 'TruHuntz on the App Store', kind: 'Link', href: 'https://apps.apple.com/us/app/truhuntz/id6831245840', ext: true },
    { label: 'TruGuidz on the App Store', kind: 'Link', href: 'https://apps.apple.com/us/app/truguidz/id6804742143', ext: true },
    { label: 'TruKit on Gumroad', kind: 'Link', href: 'https://robertlong3.gumroad.com/l/TruKit', ext: true },
    { label: 'Support', kind: 'Page', href: onHome ? 'support.html' : '/support.html' },
    { label: 'Email me', kind: 'Contact', href: 'mailto:longrobert346@yahoo.com' },
    { label: 'Toggle dawn mode', kind: 'Action', run: function () { setDawn(!isDawn(), true); } },
    { label: 'Open the terminal', kind: 'Action', run: function () { openTerminal(); } }
  ];

  var dlg = document.createElement('dialog');
  dlg.id = 'palette';
  dlg.setAttribute('aria-label', 'Command palette');
  dlg.innerHTML =
    '<div id="pal-view">' +
    '<div class="pal-search"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>' +
    '<input id="pal-input" type="text" placeholder="Jump to a project, page or link…" autocomplete="off" spellcheck="false" role="combobox" aria-expanded="true" aria-controls="pal-list"></div>' +
    '<ul class="pal-list" id="pal-list" role="listbox"></ul>' +
    '<div class="pal-foot"><span><kbd>↑</kbd> <kbd>↓</kbd> to move &middot; <kbd>Enter</kbd> to go</span><span><kbd>Esc</kbd> to close</span></div>' +
    '</div>' +
    '<div id="term-view" hidden><div class="term" id="term" role="log" aria-live="polite"></div>' +
    '<div class="pal-foot"><span>Type <b>help</b>. Everything here is also on the page.</span><span><kbd>Esc</kbd> to close</span></div></div>';
  document.body.appendChild(dlg);

  var input = dlg.querySelector('#pal-input');
  var list = dlg.querySelector('#pal-list');
  var palView = dlg.querySelector('#pal-view');
  var termView = dlg.querySelector('#term-view');
  var term = dlg.querySelector('#term');
  var sel = 0, shown = [];

  function render() {
    var q = input.value.trim().toLowerCase();
    shown = ITEMS.filter(function (it) { return !q || (it.label + ' ' + it.kind).toLowerCase().indexOf(q) !== -1; });
    sel = Math.min(sel, Math.max(0, shown.length - 1));
    list.innerHTML = '';
    if (!shown.length) { var li = document.createElement('li'); li.textContent = 'Nothing matches “' + input.value + '”'; li.style.cursor = 'default'; list.appendChild(li); return; }
    shown.forEach(function (it, i) {
      var li = document.createElement('li');
      li.setAttribute('role', 'option');
      li.setAttribute('aria-selected', i === sel ? 'true' : 'false');
      li.innerHTML = '<span></span><small></small>';
      li.firstChild.textContent = it.label;
      li.lastChild.textContent = it.kind;
      li.addEventListener('mousemove', function () { if (sel !== i) { sel = i; mark(); } });
      li.addEventListener('click', function () { go(it); });
      list.appendChild(li);
    });
  }
  function mark() {
    Array.prototype.forEach.call(list.children, function (li, i) { li.setAttribute('aria-selected', i === sel ? 'true' : 'false'); });
    var cur = list.children[sel]; if (cur && cur.scrollIntoView) cur.scrollIntoView({ block: 'nearest' });
  }
  function go(it) {
    dlg.close();
    if (it.run) { it.run(); return; }
    if (it.ext) window.open(it.href, '_blank', 'noopener');
    else window.location.href = it.href;
  }
  function openPalette() {
    palView.hidden = false; termView.hidden = true;
    input.value = ''; sel = 0; render();
    if (!dlg.open) dlg.showModal();
    input.focus();
  }
  input.addEventListener('input', function () { sel = 0; render(); });
  input.addEventListener('keydown', function (e) {
    if (e.key === 'ArrowDown') { e.preventDefault(); sel = Math.min(sel + 1, shown.length - 1); mark(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); sel = Math.max(sel - 1, 0); mark(); }
    else if (e.key === 'Enter' && shown[sel]) { e.preventDefault(); go(shown[sel]); }
  });
  dlg.addEventListener('click', function (e) { if (e.target === dlg) dlg.close(); });

  /* ----- terminal ----- */
  var termReady = false, hist = [], hi = 0;
  function say(html) { var p = document.createElement('div'); p.className = 'out'; p.innerHTML = html; term.insertBefore(p, term.querySelector('.prompt')); term.scrollTop = term.scrollHeight; }
  function esc(s) { return s.replace(/[&<>]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]; }); }
  var COMMANDS = {
    help: function () { return 'Commands: <b>about</b>, <b>projects</b>, <b>socials</b>, <b>media</b>, <b>contact</b>, <b>ls</b>, <b>whoami</b>, <b>theme dawn|day</b>, <b>open &lt;name&gt;</b>, <b>clear</b>, <b>exit</b>'; },
    whoami: function () { return 'Robert Long. Computer science at Penn State. One developer, building in public.'; },
    about: function () { return 'I build at the intersection of native mobile apps and industrial automation and software engineering, and I make the outdoors apps I want to use myself.'; },
    projects: function () { return '<b>TruHuntz</b>  wind and scent-cone mapping for iPhone\n<b>TruGuidz</b>  book local outdoor guides\n<b>TruKit</b>    SwiftUI + Supabase starter kit'; },
    ls: function () { return 'about/  projects/  socials/  media/  contact'; },
    socials: function () { return 'YouTube  <a href="https://www.youtube.com/@TruOutdoorz" target="_blank" rel="noopener">@TruOutdoorz</a>\nTikTok   <a href="https://www.tiktok.com/@truoutdoorz" target="_blank" rel="noopener">@truoutdoorz</a>\nX        <a href="https://x.com/TruOutdoorz" target="_blank" rel="noopener">@TruOutdoorz</a>\nDev.to   <a href="https://dev.to/truoutdoorz" target="_blank" rel="noopener">truoutdoorz</a>\nGitHub   <a href="https://github.com/Robert-Long52" target="_blank" rel="noopener">Robert-Long52</a>'; },
    media: function () { return 'Latest uploads: <a href="' + (onHome ? 'media.html' : '/media.html') + '">media page</a>'; },
    contact: function () { return '<a href="mailto:longrobert346@yahoo.com">longrobert346@yahoo.com</a>'; },
    clear: function () { Array.prototype.slice.call(term.querySelectorAll('.out')).forEach(function (n) { n.remove(); }); return null; },
    exit: function () { dlg.close(); return null; }
  };
  var OPEN = { truhuntz: home('#truhuntz'), trukit: home('#trukit'), truguidz: home('#truguidz'), media: onHome ? 'media.html' : '/media.html', about: home('#about'), github: 'https://github.com/Robert-Long52' };
  function run(cmd) {
    var parts = cmd.trim().split(/\s+/), name = (parts[0] || '').toLowerCase(), arg = (parts[1] || '').toLowerCase();
    if (!name) return null;
    if (name === 'theme') { if (arg === 'dawn') { setDawn(true, true); return 'dawn mode on'; } if (arg === 'day') { setDawn(false, true); return 'dawn mode off'; } return 'usage: theme dawn|day'; }
    if (name === 'open') { var t = OPEN[arg]; if (!t) return 'open what? try: ' + Object.keys(OPEN).join(', '); dlg.close(); if (/^https?:/.test(t)) window.open(t, '_blank', 'noopener'); else window.location.href = t; return null; }
    if (name === 'sudo' && /hire/i.test(cmd)) return 'Permission granted. Email is under <b>contact</b>.';
    if (COMMANDS[name]) return COMMANDS[name]();
    return 'command not found: ' + esc(name) + '. Try <b>help</b>.';
  }
  function openTerminal() {
    palView.hidden = true; termView.hidden = false;
    if (!termReady) {
      term.innerHTML = '<div class="prompt"><span>$</span><input id="term-input" type="text" autocomplete="off" spellcheck="false" aria-label="Terminal command"></div>';
      var ti = term.querySelector('#term-input');
      say('<b>TruOutdoorz shell</b>  type <b>help</b> to see what you can do');
      ti.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') {
          var v = ti.value; ti.value = '';
          if (v.trim()) { hist.push(v); hi = hist.length; }
          say('<b>$ ' + esc(v) + '</b>');
          var out = run(v); if (out) say(out);
        } else if (e.key === 'ArrowUp') { e.preventDefault(); if (hi > 0) { hi--; ti.value = hist[hi]; } }
        else if (e.key === 'ArrowDown') { e.preventDefault(); if (hi < hist.length - 1) { hi++; ti.value = hist[hi]; } else { hi = hist.length; ti.value = ''; } }
      });
      termReady = true;
    }
    if (!dlg.open) dlg.showModal();
    term.querySelector('#term-input').focus();
  }
  term.addEventListener('click', function () { var ti = term.querySelector('#term-input'); if (ti) ti.focus(); });

  function typing(e) {
    var t = e.target, tag = t && t.tagName;
    return t && (t.isContentEditable || tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT');
  }
  document.addEventListener('keydown', function (e) {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); if (dlg.open) dlg.close(); else openPalette(); return; }
    if (e.key === '/' && !typing(e) && !dlg.open) { e.preventDefault(); openPalette(); return; }
    if ((e.key === '~' || e.key === '`') && !typing(e) && !dlg.open) { e.preventDefault(); openTerminal(); }
  });
  var pbtn = document.getElementById('open-palette');
  if (pbtn) pbtn.addEventListener('click', openPalette);
})();
