// Не знаю будет ли кто-то это зачем-то читать, но не кокайте кокшу, только бобылей!
// ГЛОБАЛЬНЫЕ ДАННЫЕ
let allMovies = [];
let currentSearch = '';
let currentSource = 'all';
let currentGenre = 'all';
let collections = {};

// НАСТРОЙКИ, ЧТОБЫ НЕ ЗАБЫТЬ, А ТО СТАРЫЙ УЖЕ
// Порог сворачивания ссылок:
// 0 — сворачивать всегда 
// 2 — сворачивать, если ссылок > 2 
// 999 — никогда не сворачивать
const COLLAPSE_THRESHOLD = 2;
// Сколько жанров показывать в карточке (остальные в +N )
const MAX_VISIBLE_GENRES = 2;

// ИНИЦИАЛИЗАЦИЯ-ИЯ-ИЯ-ИЯ
document.addEventListener('DOMContentLoaded', async () => {
  try {
    console.log('Начинаю загрузку movies.json...');
    const res = await fetch('movies.json');
    console.log('Статус ответа:', res.status);
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    }
    const text = await res.text();
    console.log('Первые 200 символов ответа:', text.substring(0, 200));
    const data = JSON.parse(text);
    console.log('JSON распарсен. Фильмов:', data.movies ? data.movies.length : 0);
    allMovies = data.movies || [];
    const lastModified = res.headers.get('Last-Modified');
    displayUpdatedDate(lastModified);
    buildCollections();
    render();
    populateGenreFilter();
  } catch (err) {
    console.error('Ошибка загрузки:', err);
    const statsEl = document.getElementById('stats');
    if (statsEl) {
      statsEl.innerHTML = `⚠️ Ошибка: ${escapeHtml(err.message)}`;
    }
  }
});

// ПОСТРОЕНИЕ КОЛЛЕКЦИЙ
function buildCollections() {
  collections = {};
  allMovies.forEach(m => {
    if (m.collection) {
      if (!collections[m.collection]) {
        collections[m.collection] = {
          title: m.collection,
          posterUrl: m.posterUrl,
          films: []
        };
      }
      collections[m.collection].films.push(m);
    }
  });
  Object.values(collections).forEach(c => {
    c.films.sort((a, b) => (a.year || 9999) - (b.year || 9999));
  });
}

// ФИЛЬТРЫ ПО ИСТОЧНИКУ И ЖАНРУ
function getUniqueGenres() {
  const genresSet = new Set();
  allMovies.forEach(m => {
    if (Array.isArray(m.genres)) {
      m.genres.forEach(g => {
        if (g) genresSet.add(g);
      });
    }
  });
  return Array.from(genresSet).sort((a, b) => a.localeCompare(b, 'ru'));
}
function populateGenreFilter() {
  const optionsContainer = document.getElementById('genreOptions');
  if (!optionsContainer) return;
    const genres = getUniqueGenres();
    const allOption = '<div class="select-option active" data-value="all">Все жанры</div>';
    const genreOptions = genres.map(g =>
    `<div class="select-option" data-value="${escapeAttr(g)}">${escapeHtml(capitalizeFirstLetter(g))}</div>`
  ).join('');
  optionsContainer.innerHTML = allOption + genreOptions;
}
function matchesFilters(film) {
  if (currentSearch) {
    const normalizedQuery = normalizeText(currentSearch);
    const titleMatch = normalizeText(film.title).includes(normalizedQuery);
    const originalMatch = normalizeText(film.titleOriginal || '').includes(normalizedQuery);
    if (!titleMatch && !originalMatch) return false;
  }
  if (currentSource === 'telegram') {
    if (normalizeLinks(film.links?.telegram).length === 0) return false;
  } else if (currentSource === 'boosty') {
    if (normalizeLinks(film.links?.boosty).length === 0) return false;
  }
  if (currentGenre !== 'all') {
    const genres = normalizeLinks(film.genres);
    if (!genres.includes(currentGenre)) return false;
  }
  return true;
}
function applyAllFilters() {
  const hasActiveFilters = currentSearch || currentSource !== 'all' || currentGenre !== 'all';
  if (!hasActiveFilters) {
    render();
    return;
  }
  const extractedFilms = [];
  const filteredCollections = Object.values(collections)
    .map(c => {
      let shouldShow = true; 
      if (currentSearch) {
        const normalizedQuery = normalizeText(currentSearch);
        const collectionMatch = normalizeText(c.title).includes(normalizedQuery);
        const filmsMatch = c.films.some(f =>
          normalizeText(f.title).includes(normalizedQuery) ||
          normalizeText(f.titleOriginal || '').includes(normalizedQuery)
        );
        shouldShow = collectionMatch || filmsMatch;
        if (filmsMatch) {
          const matchingFilms = c.films.filter(f =>
            normalizeText(f.title).includes(normalizedQuery) ||
            normalizeText(f.titleOriginal || '').includes(normalizedQuery)
          );
          matchingFilms.forEach(f => extractedFilms.push(f));
        }
      }
      return { collection: c, shouldShow };
    })
    .filter(item => item.shouldShow)
    .map(item => item.collection)
    .sort((a, b) => a.title.localeCompare(b.title, 'ru'));
  const standalone = allMovies
    .filter(m => !m.collection)
    .filter(matchesFilters)
    .sort((a, b) => a.title.localeCompare(b.title, 'ru'));
  const filteredExtracted = extractedFilms.filter(matchesFilters);
  const allMatchingFilms = [...standalone, ...filteredExtracted]
    .sort((a, b) => a.title.localeCompare(b.title, 'ru'));

  renderFiltered(allMatchingFilms, filteredCollections);
}

// КАСТОМНЫЕ ДРОП(ДАУНЫ)
function initCustomSelects() {
  document.querySelectorAll('.select-toggle').forEach(toggle => {
    toggle.addEventListener('click', (e) => {
      e.stopPropagation();
      const select = toggle.closest('.custom-select');
      closeAllSelects(select);
      select.classList.toggle('open');
    });
  });
  document.addEventListener('click', (e) => {
    const option = e.target.closest('.select-option');
    if (option) {
      e.stopPropagation();
      const select = option.closest('.custom-select');
      selectOption(select, option);
      return;
    }
    if (!e.target.closest('.custom-select')) {
      closeAllSelects();
    }
  });
}
function selectOption(select, option) {
  const value = option.dataset.value;
  const filterType = select.dataset.filter;
  const valueSpan = select.querySelector('.select-value');
  select.querySelectorAll('.select-option').forEach(opt => {
    opt.classList.remove('active');
  });
  option.classList.add('active');
  valueSpan.textContent = option.textContent;
  select.classList.remove('open');
  if (filterType === 'source') {
    currentSource = value;
  } else if (filterType === 'genre') {
    currentGenre = value;
  }
  applyAllFilters();
}
function closeAllSelects(except = null) {
  document.querySelectorAll('.custom-select.open').forEach(select => {
    if (select !== except) {
      select.classList.remove('open');
    }
  });
}

// АЛФАВИТНЫЙ УКАЗАТЕЛЬ, АБВГДЕЙК-А - ЭТО ВЕСЁЛАЯ ИГРА
const RUSSIAN_ALPHABET = ['А', 'Б', 'В', 'Г', 'Д', 'Е', 'Ё', 'Ж', 'З', 'И', 'Й', 'К', 'Л', 'М', 'Н', 'О', 'П', 'Р', 'С', 'Т', 'У', 'Ф', 'Х', 'Ц', 'Ч', 'Ш', 'Щ', 'Ъ', 'Ы', 'Ь', 'Э', 'Ю', 'Я'];
const ENGLISH_ALPHABET = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z'];
const ALL_LETTERS = [...RUSSIAN_ALPHABET, ...ENGLISH_ALPHABET];
function getGroupKey(title) {
  if (!title) return '#';
  const firstChar = title.trim().charAt(0).toUpperCase();
  if (ALL_LETTERS.includes(firstChar)) {
    return firstChar;
  }
  return '#';
}
function groupFilmsByLetter(films) {
  const groups = {};
  films.forEach(film => {
    const key = getGroupKey(film.title);
    if (!groups[key]) {
      groups[key] = [];
    }
    groups[key].push(film);
  });
  const sortedKeys = Object.keys(groups).sort((a, b) => {
    if (a === '#') return -1;
    if (b === '#') return 1;
    return ALL_LETTERS.indexOf(a) - ALL_LETTERS.indexOf(b);
  });
  return sortedKeys.map(key => ({
    letter: key,
    films: groups[key].sort((a, b) => a.title.localeCompare(b.title, 'ru'))
  }));
}

// АЛФАВИТНАЯ НАВИГАЦИЯ
function scrollToLetter(letter) {
  const group = document.getElementById('letter-group-' + encodeURIComponent(letter));
  if (group) {
    group.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}
function renderAlphabetNav() {
  const nav = document.getElementById('alphabetNav');
  if (!nav) return;
  const allLetters = ['#', ...RUSSIAN_ALPHABET, ...ENGLISH_ALPHABET];
  const existingLetters = allLetters.filter(letter =>
    document.getElementById('letter-group-' + encodeURIComponent(letter))
  );
  if (existingLetters.length === 0) {
    nav.innerHTML = '';
    return;
  }
  nav.innerHTML = existingLetters.map(letter =>
    `<button class="alpha-btn" type="button" onclick="scrollToLetter('${letter}')">${letter}</button>`
  ).join('');
}

// ПРОВЕРКА ФИЛЬТРОВ
function matchesSourceAndGenre(film) {
  if (currentSource === 'telegram') {
    if (normalizeLinks(film.links?.telegram).length === 0) return false;
  } else if (currentSource === 'boosty') {
    if (normalizeLinks(film.links?.boosty).length === 0) return false;
  }
  if (currentGenre !== 'all') {
    if (!normalizeLinks(film.genres).includes(currentGenre)) return false;
  }
  return true;
}
function matchesAllFilters(film) {
  if (currentSearch) {
    const q = normalizeText(currentSearch);
    const titleMatch = normalizeText(film.title).includes(q);
    const originalMatch = normalizeText(film.titleOriginal || '').includes(q);
    if (!titleMatch && !originalMatch) return false;
  }
  return matchesSourceAndGenre(film);
}

// СБОР ЭЛЕМЕНТОВ
function collectionMatchesFilters(c) {
  if (currentGenre === 'all' && currentSource === 'all') return true;
  return c.films.some(f => matchesSourceAndGenre(f));
}
function collectItems() {
  const items = [];
  const normalizedQuery = currentSearch ? normalizeText(currentSearch) : '';
  Object.values(collections).forEach(c => {
    if (normalizedQuery) {
      const collectionMatch = normalizeText(c.title).includes(normalizedQuery);
      const matchingFilms = c.films.filter(f =>
        normalizeText(f.title).includes(normalizedQuery) ||
        normalizeText(f.titleOriginal || '').includes(normalizedQuery)
      );
      const filmsMatch = matchingFilms.length > 0;
      let filmsToExtract = [];
      if (collectionMatch) {
        filmsToExtract = c.films;
      } else if (filmsMatch) {
        filmsToExtract = matchingFilms;
      }
      filmsToExtract.forEach(f => {
        if (matchesSourceAndGenre(f)) {
          items.push({ type: 'movie', data: f, title: f.title });
        }
      });
    } else {
      if (collectionMatchesFilters(c)) {
        items.push({ type: 'collection', data: c, title: c.title });
      }
    }
  });
  allMovies.filter(m => !m.collection).forEach(m => {
    if (matchesAllFilters(m)) {
      items.push({ type: 'movie', data: m, title: m.title });
    }
  });
  return items;
}

// ГРУППИРОВКА И РЕНДЕР ЕДИНОЙ ЛЕНТЫ
function groupItemsByLetter(items) {
  const groups = {};
  items.forEach(item => {
    const key = getGroupKey(item.title);
    if (!groups[key]) groups[key] = [];
    groups[key].push(item);
  });
  const sortedKeys = Object.keys(groups).sort((a, b) => {
    if (a === '#') return -1;
    if (b === '#') return 1;
    return ALL_LETTERS.indexOf(a) - ALL_LETTERS.indexOf(b);
  });
  return sortedKeys.map(key => ({
    letter: key,
    items: groups[key].sort((a, b) => a.title.localeCompare(b.title, 'ru'))
  }));
}
function renderGroupedItems(items) {
  if (items.length === 0) {
  return `
    <div class="empty-message">
      <div>
         Ничего не найдено
        <div class="empty-hint">Попробуйте изменить запрос или сбросить фильтры</div>
      </div>
    </div>
  `;
}
  const groups = groupItemsByLetter(items);
  return groups.map(group => `
    <div class="letter-group" id="letter-group-${encodeURIComponent(group.letter)}">
      <h3 class="letter-header">${group.letter === '#' ? '#' : group.letter}</h3>
      <div class="grid">
        ${group.items.map(item =>
          item.type === 'collection'
            ? renderCollectionCard(item.data)
            : filmCard(item.data)
        ).join('')}
      </div>
    </div>
  `).join('');
}

// СТАТИСТИКА
function updateStats(items) {
  let moviesCount = 0;
  items.forEach(item => {
    if (item.type === 'movie') {
      moviesCount++;
    } else if (item.type === 'collection') {
      moviesCount += item.data.films.length;
    }
  });
  const statsEl = document.getElementById('stats');
  if (statsEl) {
    statsEl.innerHTML = `Всего на странице: <strong>${moviesCount}</strong> шт.`;
  }
}

// ФУНКЦИЯ РЕНДЕРА
function render() {
  const items = collectItems();
  document.getElementById('moviesGrid').innerHTML = renderGroupedItems(items);
  renderAlphabetNav();
  updateStats(items);
}
function applyAllFilters() {
  render();
}

// КАРТОЧКА ФИЛЬМА
function filmCard(m) {
  const genresHtml = renderGenres(m.genres);
  const linksData = {
    telegram: normalizeLinks(m.links?.telegram),
    boosty: normalizeLinks(m.links?.boosty)
  };
  const totalLinks = linksData.telegram.length + linksData.boosty.length;
  const linksSection = renderLinksSection(m, linksData, totalLinks);
  return `
    <div class="card">
      <div class="poster-wrap">
        <div class="poster-fallback">${escapeHtml(m.title)}</div>
        <img src="${m.posterUrl}" alt="${escapeAttr(m.title)}" loading="lazy"
             onerror="this.style.display='none'">
      </div>
      <div class="card-info">
        <h3>${escapeHtml(m.title)}</h3>
        <p class="meta">${m.year || '—'}</p>
        ${genresHtml}
        ${linksSection}
      </div>
    </div>
  `;
}

// ЖАНРЫ
function renderGenres(genres) {
  const list = normalizeLinks(genres);
  if (list.length === 0) {
    return '<div class="genres"></div>';
  }
  const visible = list.slice(0, MAX_VISIBLE_GENRES);
  const hidden = list.length - MAX_VISIBLE_GENRES;
  const tags = visible.map(g => `<span class="genre-tag">${escapeHtml(g)}</span>`).join('');
  const more = hidden > 0 ? `<span class="genre-tag more">+${hidden}</span>` : '';
  return `<div class="genres">${tags}${more}</div>`;
}

// СЕКЦИЯ ССЫЛОК 
function renderLinksSection(m, linksData, totalLinks) {
  if (totalLinks === 0) return '';
  const filmId = m.id || ('kp-' + (m.kinopoiskId || Math.random().toString(36).substr(2, 9)));
  const popoverId = 'popover-' + filmId;
  const hasBoth = linksData.telegram.length > 0 && linksData.boosty.length > 0;
  if (totalLinks > COLLAPSE_THRESHOLD) {
    const popoverClass = hasBoth ? 'links-popover two-cols' : 'links-popover';
    return `
      <div class="links-popover-wrap">
        <button class="links-toggle" onclick="toggleLinksPopover('${popoverId}', event)">
          🔗 Ссылки (${totalLinks})
        </button>
        <div class="${popoverClass}" id="${popoverId}">
          ${renderLinksColumns(linksData)}
        </div>
      </div>
    `;
  }
  const gridClass = hasBoth ? 'links-grid' : 'links-grid single';
  return `<div class="${gridClass}">${renderLinksColumns(linksData)}</div>`;
}

// КОЛОНКИ ССЫЛОК
function renderLinksColumns(linksData) {
  const tgHtml = linksData.telegram.length > 0
    ? `<div class="links-col">
         ${linksData.telegram.map((url, i) => `
           <a class="link-btn tg" href="${escapeAttr(url)}" target="_blank" rel="noopener">
             ${linksData.telegram.length > 1 ? 'Telegram ' + (i + 1) : 'Telegram'}
           </a>
         `).join('')}
       </div>`
    : '';
  const bsHtml = linksData.boosty.length > 0
    ? `<div class="links-col">
         ${linksData.boosty.map((url, i) => `
           <a class="link-btn boosty" href="${escapeAttr(url)}" target="_blank" rel="noopener">
             ${linksData.boosty.length > 1 ? 'Boosty ' + (i + 1) : 'Boosty'}
           </a>
         `).join('')}
       </div>`
    : '';
  return tgHtml + bsHtml;
}

// СВОРАЧИВАНИЕ / РАСКРЫТИЕ ССЫЛОК
function toggleLinksPopover(id, event) {
  event.stopPropagation();
  const popover = document.getElementById(id);
  if (!popover) return;
  const isOpen = popover.classList.contains('open');
  document.querySelectorAll('.links-popover.open').forEach(p => {
    if (p.id !== id) p.classList.remove('open');
  });
  popover.classList.toggle('open', !isOpen);
}
document.addEventListener('click', (e) => {
  if (!e.target.closest('.links-popover-wrap')) {
    document.querySelectorAll('.links-popover.open').forEach(p => {
      p.classList.remove('open');
    });
  }
});

// МОДАЛКА КОЛЛЕКЦИИ, САМ В ШОКЕ, ЧТО ЭТО ТАК НАЗЫВАЕТСЯ
function openCollection(title) {
  const c = collections[title];
  if (!c) return;
  const modalContent = document.querySelector('.modal-content');
  const modalGrid = document.getElementById('modalGrid');
  document.getElementById('modalTitle').textContent = c.title;
  modalGrid.innerHTML = c.films.map(filmCard).join('');
  const cardWidth = 215;
  const gap = 16;
  const padding = 48;
  const maxColsByScreen = Math.floor((window.innerWidth - 40) / (cardWidth + gap));
  const cols = Math.min(c.films.length, maxColsByScreen, 6);
  const width = cols * cardWidth + (cols - 1) * gap + padding;
  modalContent.style.width = width + 'px';
  modalGrid.style.gridTemplateColumns = `repeat(${cols}, ${cardWidth}px)`;
  document.getElementById('collectionModal').classList.add('open');
  document.body.style.overflow = 'hidden';
}
function closeModal() {
  const modal = document.getElementById('collectionModal');
  if (modal) {
    modal.classList.remove('open');
  }
  document.body.style.overflow = '';
}
document.addEventListener('click', (e) => {
  const modal = document.getElementById('collectionModal');
  if (modal && e.target === modal) {
    closeModal();
  }
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    closeModal();
  }
});

// ПОИСК
function normalizeText(text) {
  if (!text) return '';
  return text
    .toLowerCase()
    .replace(/[^а-яёa-z0-9\s]/gi, '') 
    .replace(/\s+/g, ' ')
    .trim();
}
function applySearch(query) {
  const normalizedQuery = normalizeText(query);
  if (!normalizedQuery) {
    render();
    return;
  }
  const extractedFilms = [];
  const filteredCollections = Object.values(collections)
    .map(c => {
      const collectionMatch = normalizeText(c.title).includes(normalizedQuery);
      const matchingFilms = c.films.filter(f => 
        normalizeText(f.title).includes(normalizedQuery)
      );
      const filmsMatch = matchingFilms.length > 0;
      if (filmsMatch) {
        matchingFilms.forEach(f => extractedFilms.push(f));
      }

      return {
        collection: c,
        shouldShow: collectionMatch || filmsMatch
      };
    })
    .filter(item => item.shouldShow)
    .map(item => item.collection)
    .sort((a, b) => a.title.localeCompare(b.title, 'ru'));
  const standalone = allMovies
    .filter(m => !m.collection)
    .filter(m => normalizeText(m.title).includes(normalizedQuery))
    .sort((a, b) => a.title.localeCompare(b.title, 'ru'));
  const allMatchingFilms = [...standalone, ...extractedFilms]
    .sort((a, b) => a.title.localeCompare(b.title, 'ru'));

  renderFiltered(allMatchingFilms, filteredCollections);
}
function renderCollectionCard(c) {
  const genresHtml = renderGenres(getCollectionGenres(c));
  const countText = getFilmsCountText(c.films.length);
  return `<div class="card collection-card" onclick="openCollection('${escapeAttr(c.title)}')">
    <div class="poster-wrap">
      <div class="poster-fallback">${escapeHtml(c.title)}</div>
      <img src="${c.posterUrl}" alt="${escapeAttr(c.title)}" loading="lazy" onerror="this.style.display='none'">
      <span class="badge">${c.films.length}</span>
      <div class="stacked-posters">
        ${c.films.slice(0, 3).map(f => `<img src="${f.posterUrl}" alt="" onerror="this.style.display='none'">`).join('')}
      </div>
    </div>
    <div class="card-info">
      <h3>${escapeHtml(c.title)}</h3>
      <p class="meta">${countText}</p>
      ${genresHtml}
    </div>
  </div>`;
}
function clearSearch() {
  const input = document.getElementById('searchInput');
  input.value = '';
  currentSearch = '';
  applyAllFilters();
  input.focus();
}
document.addEventListener('DOMContentLoaded', () => {
  const searchInput = document.getElementById('searchInput');
  const searchClear = document.getElementById('searchClear');
  if (searchInput) {
    searchInput.addEventListener('input', () => {
      currentSearch = searchInput.value;
      applyAllFilters();
    });
  }
  if (searchClear) {
    searchClear.addEventListener('click', () => {
      searchInput.value = '';
      currentSearch = '';
      applyAllFilters();
      searchInput.focus();
    });
  }
  initCustomSelects();
});

// НАВЕРХ
const scrollTopBtn = document.getElementById('scrollTopBtn');
if (scrollTopBtn) {
  scrollTopBtn.addEventListener('click', () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
}

// ВСЯКОЕ, ТУДЫМ-СЮДЫМ
function displayUpdatedDate(lastModified) {
  const el = document.getElementById('updatedDate');
  if (!el) return;
  if (!lastModified) {
    el.style.display = 'none';
    return;
  }
  const date = new Date(lastModified);
  if (isNaN(date.getTime())) {
    el.style.display = 'none';
    return;
  }
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  el.textContent = `Обновлено: ${day}.${month}.${year} • ${hours}:${minutes}`;
}
function normalizeLinks(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value.filter(Boolean);
  if (typeof value === 'string' && value.trim()) return [value.trim()];
  return [];
}
function capitalizeFirstLetter(str) {
  if (!str) return str;
  return str.charAt(0).toUpperCase() + str.slice(1);
}
function getCollectionGenres(c) {
  const genresSet = new Set();
  c.films.forEach(f => {
    if (Array.isArray(f.genres)) {
      f.genres.forEach(g => {
        if (g) genresSet.add(g);
      });
    }
  });
  return Array.from(genresSet).sort((a, b) => a.localeCompare(b, 'ru'));
}
function getFilmsCountText(n) {
  const lastTwo = n % 100;
  if (lastTwo >= 11 && lastTwo <= 14) return `${n} фильмов`;
  const last = n % 10;
  if (last === 1) return `${n} фильм`;
  if (last >= 2 && last <= 4) return `${n} фильма`;
  return `${n} фильмов`;
}
function escapeHtml(s) {
  if (s === null || s === undefined) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
function escapeAttr(s) {
  return escapeHtml(s);
}

