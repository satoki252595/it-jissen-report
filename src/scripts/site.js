const root = document.documentElement;
const themeButton = document.querySelector('#theme-toggle');

function effectiveTheme() {
  const stored = root.getAttribute('data-theme');
  if (stored === 'light' || stored === 'dark') return stored;
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function syncTheme() {
  if (!themeButton) return;
  const dark = effectiveTheme() === 'dark';
  themeButton.setAttribute('aria-label', dark ? 'ライトモードに切り替え' : 'ダークモードに切り替え');
}

themeButton?.addEventListener('click', () => {
  const next = effectiveTheme() === 'dark' ? 'light' : 'dark';
  root.setAttribute('data-theme', next);
  try {
    localStorage.setItem('theme', next);
  } catch {
    /* private mode */
  }
  syncTheme();
});

window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
  if (!root.getAttribute('data-theme')) syncTheme();
});

syncTheme();

let lastY = window.scrollY;
window.addEventListener(
  'scroll',
  () => {
    const y = window.scrollY;
    const hide = y > lastY && y > 64;
    root.classList.toggle('header-hidden', hide);
    lastY = y;
  },
  { passive: true },
);

const tocLinks = [...document.querySelectorAll('.toc a')];
const tocMap = new Map();
for (const link of tocLinks) {
  const id = decodeURIComponent((link.getAttribute('href') || '').replace(/^#/, ''));
  const target = id ? document.getElementById(id) : null;
  if (target) tocMap.set(target, [...(tocMap.get(target) || []), link]);
}

if (tocMap.size > 0) {
  const observer = new IntersectionObserver(
    (entries) => {
      const visible = entries.filter((entry) => entry.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
      if (!visible) return;
      for (const link of tocLinks) link.removeAttribute('aria-current');
      for (const link of tocMap.get(visible.target) || []) link.setAttribute('aria-current', 'true');
    },
    { rootMargin: '-80px 0px -65% 0px', threshold: [0, 1] },
  );
  for (const target of tocMap.keys()) observer.observe(target);
}

const copyStatus = document.querySelector('#copy-status');
document.addEventListener('click', async (event) => {
  const button = event.target.closest('[data-copy]');
  if (!button) return;
  const pre = button.closest('.code-block')?.querySelector('pre');
  const text = pre?.innerText || '';
  try {
    await navigator.clipboard.writeText(text);
    button.textContent = 'コピーしました';
    if (copyStatus) copyStatus.textContent = 'コードをコピーしました';
    window.setTimeout(() => {
      button.textContent = 'コピー';
    }, 1500);
  } catch {
    if (copyStatus) copyStatus.textContent = 'コピーできませんでした';
  }
});

const searchData = document.querySelector('#search-data');
const searchInput = document.querySelector('#search-q');
const searchList = document.querySelector('#search-list');
if (searchData && searchInput && searchList) {
  const items = JSON.parse(searchData.textContent || '[]');
  const params = new URLSearchParams(window.location.search);
  if (params.get('q')) searchInput.value = params.get('q');
  const render = () => {
    const query = searchInput.value.trim().toLowerCase();
    const matched = items.filter((item) => !query || item.text.includes(query));
    const nodes = matched.map((item) => {
      const li = document.createElement('li');
      const link = document.createElement('a');
      link.className = 'issue-row';
      link.href = item.href;
      const date = document.createElement('span');
      date.className = 'issue-row-date';
      const day = document.createElement('span');
      day.className = 'issue-row-day';
      day.textContent = item.short;
      const meta = document.createElement('span');
      meta.className = 'issue-row-meta';
      meta.textContent = `第${item.number}号 · ${item.weekday}`;
      date.append(day, meta);
      const body = document.createElement('span');
      body.className = 'issue-row-body';
      const title = document.createElement('span');
      title.className = 'issue-row-title';
      title.textContent = item.titleText;
      body.append(title);
      link.append(date, body);
      li.append(link);
      return li;
    });
    searchList.replaceChildren(...nodes);
    const empty = document.querySelector('#search-empty');
    if (empty) empty.hidden = matched.length !== 0;
  };
  searchInput.addEventListener('input', render);
  render();
}
