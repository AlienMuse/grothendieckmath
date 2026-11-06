// grothendieckmath.com: the one script of the site (no inline script; CSP script-src 'self'). Without it every page
// is complete: the hero shows its still, the notes are at the end of the chapter.
// ?sea=0..1 and ?t=seconds fix the sea and the time (the stills of the review, site/tools/shots.py).
const root = document.documentElement;
root.classList.replace('no-js', 'js');            // boot.js has done it; kept for safety
const q = new URLSearchParams(location.search);
const num = (k) => (q.has(k) && Number.isFinite(+q.get(k)) ? +q.get(k) : null);

function webgl2() {
  try { return !!document.createElement('canvas').getContext('webgl2'); } catch { return false; }
}

const stage = document.querySelector('.stage');
if (stage) {
  if (!webgl2()) root.classList.add('no-gl');
  else {
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    import('./hero.js').then(({ Hero }) => {
      try { window.__hero = new Hero(stage, { reduced, fixed: { sea: num('sea'), t: num('t') } }); }
      catch (e) { root.classList.add('no-gl'); console.error(e); }
    });
  }
}

// the title's entrance, a film title (site.css, "the title's entrance"): when the faces are ready, the title is cut
// into letters, each timed by its distance from the axis of its own line (so a title on two lines, on a phone, opens
// from the centre of each), and the subtitle into words; then .go. boot.js gives it 3 s at most.
const title = document.querySelector('.hero .title');
if (title && root.classList.contains('film')) {
  const sub = document.querySelector('.hero .sub');
  const begin = () => {
    if (root.classList.contains('go')) return;
    const text = title.textContent.trim();
    title.setAttribute('aria-label', text);
    title.dataset.text = text;
    const letters = document.createElement('span');
    letters.setAttribute('aria-hidden', 'true');
    for (const c of text) {
      if (c === ' ') { letters.append(' '); continue; }
      const s = document.createElement('span'); s.className = 'ch'; s.textContent = c; letters.append(s);
    }
    title.replaceChildren(letters);
    const spans = [...letters.querySelectorAll('.ch')];
    const rows = new Map();
    spans.forEach((s) => {
      const r = s.getBoundingClientRect(), k = Math.round(r.top);
      if (!rows.has(k)) rows.set(k, []);
      rows.get(k).push([s, r]);
    });
    [...rows.values()].forEach((row, line) => {
      const l = row[0][1].left, rr = row[row.length - 1][1].right, mid = (l + rr) / 2, half = Math.max(1, (rr - l) / 2);
      row.forEach(([s, r]) => s.style.setProperty('--d', (Math.abs(r.left + r.width / 2 - mid) / half * 0.62 + line * 0.18).toFixed(3)));
    });
    if (sub) {
      const words = sub.textContent.trim().split(/\s+/);
      sub.setAttribute('aria-label', words.join(' '));
      const w = document.createElement('span');
      w.setAttribute('aria-hidden', 'true');
      words.forEach((x, i) => {
        if (i) w.append(' ');
        const s = document.createElement('span'); s.className = 'w'; s.textContent = x; s.style.setProperty('--i', i); w.append(s);
      });
      sub.replaceChildren(w);
    }
    title.addEventListener('animationend', (e) => { if (e.animationName === 'film-glint') title.classList.add('done'); });
    setTimeout(() => title.classList.add('done'), 4200);
    requestAnimationFrame(() => root.classList.add('go'));
  };
  Promise.race([document.fonts ? document.fonts.ready : Promise.resolve(), new Promise((r) => setTimeout(r, 1400))])
    .then(begin);
}

// the hero's words leave as the sea rises (CSSOM, allowed by the CSP)
const hero = document.querySelector('.hero'), copy = document.querySelector('.hero-copy');
if (hero && copy && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
  const fade = () => {
    const r = hero.getBoundingClientRect();
    const s = Math.min(1, Math.max(0, -r.top / Math.max(1, r.height - innerHeight)));
    copy.style.opacity = String(Math.max(0, 1 - s * 1.6));
    copy.style.transform = `translateY(${-s * 6}vh)`;
  };
  addEventListener('scroll', fade, { passive: true });
  fade();
}

// the glass bar: darker over the black, lighter over the white page
const bar = document.querySelector('.bar');
if (bar) {
  const dark = [...document.querySelectorAll('[data-tone="dark"]')];
  const tone = () => {
    const y = bar.getBoundingClientRect().bottom - 1;
    const over = dark.some((s) => { const r = s.getBoundingClientRect(); return r.top <= y && r.bottom > y; });
    bar.classList.toggle('on-dark', over);
  };
  addEventListener('scroll', tone, { passive: true });
  addEventListener('resize', tone);
  tone();
}

// the menu on narrow screens: the navigation opens as a sheet of black glass under the bar
const menu = document.querySelector('.menu'), nav = document.querySelector('.nav');
if (bar && menu && nav) {
  const set = (open) => {
    bar.classList.toggle('open', open);
    nav.classList.toggle('glass', open);
    menu.setAttribute('aria-expanded', String(open));
  };
  menu.addEventListener('click', () => set(!bar.classList.contains('open')));
  nav.addEventListener('click', (e) => { if (e.target.closest('a')) set(false); });
  addEventListener('keydown', (e) => { if (e.key === 'Escape') set(false); });
  matchMedia('(min-width: 901px)').addEventListener('change', (m) => { if (m.matches) set(false); });
}

// the glass: a soft light on its upper surface follows the pointer (fine pointers only)
if (matchMedia('(pointer: fine)').matches && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
  document.addEventListener('pointermove', (e) => {
    const g = e.target.closest && e.target.closest('.glass');
    if (!g) return;
    const r = g.getBoundingClientRect();
    g.style.setProperty('--mx', `${((e.clientX - r.left) / r.width * 100).toFixed(1)}%`);
    g.style.setProperty('--my', `${((e.clientY - r.top) / r.height * 100 - 40).toFixed(1)}%`);
  }, { passive: true });
}

// reading: the progress hairline and the current section in the contents
const article = document.querySelector('article.chapter');
if (article) {
  const prog = document.querySelector('.progress i');
  const links = [...document.querySelectorAll('.toc a[href^="#"]')];
  const heads = links.map((a) => document.getElementById(decodeURIComponent(a.hash.slice(1)))).filter(Boolean);
  let queued = 0;
  const update = () => {
    queued = 0;
    const r = article.getBoundingClientRect();
    const p = Math.min(1, Math.max(0, -r.top / Math.max(1, r.height - innerHeight)));
    if (prog) prog.style.transform = `scaleX(${p})`;
    let cur = 0;
    heads.forEach((h, i) => { if (h.getBoundingClientRect().top < innerHeight * 0.3) cur = i; });
    links.forEach((a, i) => a.classList.toggle('on', i === cur));
  };
  addEventListener('scroll', () => { if (!queued) queued = requestAnimationFrame(update); }, { passive: true });
  update();
  // a note number opens its note in place on narrow screens
  document.addEventListener('click', (e) => {
    const ref = e.target.closest('a.fn');
    if (!ref || matchMedia('(min-width: 1240px)').matches) return;
    const sn = ref.nextElementSibling;
    if (sn && sn.classList.contains('sn')) {
      e.preventDefault();
      const open = !sn.classList.contains('open');
      sn.classList.toggle('open', open);
      sn.classList.toggle('glass', open);          // a note opened in place is a box: black glass
    }
  });
}

// sections appear as they enter (Apple's restraint: a short rise, once)
if ('IntersectionObserver' in window && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
  const io = new IntersectionObserver((es) => es.forEach((e) => {
    if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
  }), { rootMargin: '0px 0px -10% 0px' });
  document.querySelectorAll('.rise').forEach((el) => io.observe(el));
} else document.querySelectorAll('.rise').forEach((el) => el.classList.add('in'));

// the lists (bibliography, names, sources): typing filters the entries; a letter group with none left is hidden
document.querySelectorAll('input[data-filter]').forEach((input) => {
  const items = [...document.querySelectorAll(input.dataset.filter)];
  const fold = (s) => s.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const texts = items.map((el) => fold(el.textContent));
  const groups = [...new Set(items.map((el) => el.closest('.letter-group, .wgroup')).filter(Boolean))];
  let queued = 0;
  input.addEventListener('input', () => {
    if (queued) return;
    queued = requestAnimationFrame(() => {
      queued = 0;
      const words = fold(input.value).split(/\s+/).filter(Boolean);
      items.forEach((el, i) => { el.hidden = !words.every((w) => texts[i].includes(w)); });
      groups.forEach((g) => { g.hidden = !g.querySelector('.entry:not([hidden])'); });
    });
  });
});
