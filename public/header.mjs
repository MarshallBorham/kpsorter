import { toHtmlElement } from './toHtmlElement.mjs';

const links = [
  { href: 'home.html', text: 'Find Players' },
  { href: 'watchlist.html', text: 'Watchlist' },
  { href: 'index.html', text: 'Logout' },
];

function createHeader() {
  const navLinksHtml = links.map(({ href, text }) =>
    `<a href="${href}" class="nav-link">${text}</a>`
  ).join('');

  const fragment = toHtmlElement(`
    <header class="header">
      <div class="header-content">
        <a href="home.html" class="logo">Player Finder</a>
        <div class="header-right">
          <nav class="nav" aria-label="Main navigation">
            ${navLinksHtml}
          </nav>
          <div class="header-controls">
            <label>
              <input type="checkbox" autocomplete="off" />
              Dark mode
            </label>
            <button class="menu-btn">Menu</button>
          </div>
        </div>
      </div>
    </header>
  `);

  const header = fragment.firstElementChild;

  // Mark the current page's link as active
  header.querySelectorAll('.nav-link').forEach(link => {
    if (window.location.pathname.endsWith(link.getAttribute('href'))) {
      link.classList.add('active');
    }
  });

  return header;
}

document.body.prepend(createHeader());

const menuBtn = document.querySelector('.menu-btn');
const nav = document.querySelector('.nav');

menuBtn.addEventListener('click', () => {
  nav.classList.toggle('open');
});

const darkModeCheckbox = document.querySelector('input[type="checkbox"]');

if (localStorage.getItem('darkMode') === 'true') {
  document.body.classList.add('dark-mode');
  darkModeCheckbox.checked = true;
}

darkModeCheckbox.addEventListener('change', () => {
  document.body.classList.toggle('dark-mode');
  localStorage.setItem('darkMode', darkModeCheckbox.checked);
});

document.body.addEventListener('click', (event) => {
  const header = document.querySelector('.header');
  if (!header.contains(event.target)) {
    nav.classList.remove('open');
  }
});