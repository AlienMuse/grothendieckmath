// grothendieckmath.com: before the first paint (a classic script in the head, CSP script-src 'self'). Script is on,
// so the hero's still yields to the canvas; and unless motion is reduced, the title waits for its entrance (main.js).
(function (d) {
  d.className = d.className.replace('no-js', 'js');
  if (window.matchMedia && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
    d.classList.add('film');
    setTimeout(function () { d.classList.add('go'); }, 3000);    // never wait longer for the title
  }
})(document.documentElement);
