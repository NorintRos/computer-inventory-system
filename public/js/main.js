/* global window, document */

const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

if (!prefersReducedMotion) {
  document.querySelectorAll('[data-count]').forEach((el) => {
    const countElement = el;
    const target = +el.dataset.count;
    if (!target) return;
    let n = 0;
    const step = Math.ceil(target / 20);
    const t = setInterval(() => {
      n = Math.min(n + step, target);
      countElement.textContent = n;
      if (n >= target) clearInterval(t);
    }, 30);
  });
}

const navbar = document.querySelector('.navbar');
const navbarToggle = document.querySelector('.navbar-toggle');
const navbarMenu = document.querySelector('#primary-navigation');

if (navbar && navbarToggle && navbarMenu) {
  navbarToggle.addEventListener('click', () => {
    const isOpen = navbar.classList.toggle('is-open');
    navbarToggle.setAttribute('aria-expanded', String(isOpen));
  });

  navbarMenu.addEventListener('click', (event) => {
    if (event.target.closest('a')) {
      navbar.classList.remove('is-open');
      navbarToggle.setAttribute('aria-expanded', 'false');
    }
  });
}

document.addEventListener('keydown', (event) => {
  if (
    event.key === 'Escape' &&
    navbar &&
    navbarToggle &&
    navbar.classList.contains('is-open')
  ) {
    navbar.classList.remove('is-open');
    navbarToggle.setAttribute('aria-expanded', 'false');
    navbarToggle.focus();
  }
});
