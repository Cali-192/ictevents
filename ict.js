/* ═══════════════════════════════════════════════════════════════
   IT Events Hub Kosovo — Main Application Logic
   ═══════════════════════════════════════════════════════════════ */

'use strict';

/* ─── ADMIN PASSCODE ─── */
const ADMIN_PASSCODE = '1973';  

/* ─── INITIAL EVENT DATA ─── */
/* ─── FIREBASE & EMAILJS CONFIGURATION ─── */
const firebaseConfig = {
  apiKey: "AIzaSyDvbEPPmXSzel5RxdElWG-dPLalCI5ZsfY",
  authDomain: "it-events-kosovo.firebaseapp.com",
  databaseURL: "https://it-events-kosovo-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "it-events-kosovo",
  storageBucket: "it-events-kosovo.firebasestorage.app",
  messagingSenderId: "184421696954",
  appId: "1:184421696954:web:d1c1e4db3c00992bfd8983"
};

// Inicializimi i Firebase (Compat version)
firebase.initializeApp(firebaseConfig);
const database = firebase.database();

// Inicializimi i EmailJS
emailjs.init("sLcObY_Fg6HrOOkWX");

/* ─── APP STATE ─── */
const state = {
  events: [], 
  filters: {
    type: 'all',
    city: 'all',
    category: 'all',
    search: '',
  },
  viewMode: 'grid',
  adminVisible: false,
  adminAuthenticated: false,
};

/* ─── FIREBASE REALTIME LISTENER ─── */
// Ky funksion dëgjon Cloud-in dhe përditëson çdo pajisje në kohë reale
database.ref('events').on('value', (snapshot) => {
  const data = snapshot.val();
  if (data) {
    state.events = Object.keys(data).map(key => ({
      id: key, // Kjo është ID unike e Firebase (psh: -O5kL...)
      ...data[key]
    }));
  } else {
    state.events = [];
  }
  
  // Rifresko pamjen e faqes
  if (typeof renderEvents === 'function') renderEvents();
  if (typeof renderAdminTable === 'function') renderAdminTable();
  if (typeof updateStats === 'function') updateStats();
});

/* ─── CLOUD ACTIONS (Shtohen këtu) ─── */

// Funksioni për të aprovuar eventin në Cloud
function approveEvent(id) {
  database.ref('events/' + id).update({
    status: 'approved'
  }).then(() => {
    showToast('✅ Eventi u aprovua me sukses!', 'success');
  });
}

// Funksioni për të fshirë eventin nga Cloud
function deleteEvent(id) {
  if (confirm('A jeni i sigurt që dëshironi ta fshini këtë event?')) {
    database.ref('events/' + id).remove().then(() => {
      showToast('🗑️ Eventi u fshi nga sistemi.', 'info');
    });
  }
}

/* ─── UTILITY FUNCTIONS (Të ruajtura saktësisht) ─── */
function formatDate(dateStr) {
  if (!dateStr) return 'TBD';
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('sq-AL', {
    weekday: 'short',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

function formatDateShort(dateStr) {
  if (!dateStr) return 'TBD';
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('sq-AL', { month: 'short', day: 'numeric', year: 'numeric' });
}

function getDaysUntil(dateStr) {
  if (!dateStr) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const event = new Date(dateStr + 'T00:00:00');
  const diff = Math.ceil((event - today) / (1000 * 60 * 60 * 24));
  return diff;
}

function getDaysLabel(dateStr) {
  const days = getDaysUntil(dateStr);
  if (days === null) return '';
  if (days < 0) return 'Përfundoi';
  if (days === 0) return 'Sot!';
  if (days === 1) return 'Nesër!';
  return `${days} ditë`;
}
function getCategoryIcon(cat) {
  const icons = {
    Dev: '💻',
    Cyber: '🔐',
    Design: '🎨',
    AI: '🤖',
    Business: '🚀',
  };
  return icons[cat] || '📅';
}

function getTypeIcon(type) {
  const icons = {
    'Konferencë': '🎤',
    'Meetup': '🤝',
    'Workshop': '🛠️',
    'Hackathon': '⚡',
    'Webinar': '💻',
  };
  return icons[type] || '📅';
}

function sanitize(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

/* ─── FILTER LOGIC ─── */
function getFilteredEvents() {
  return state.events.filter(ev => {
    if (ev.status === 'rejected') return false;

    const typeMatch = state.filters.type === 'all' || ev.type === state.filters.type;
    const cityMatch = state.filters.city === 'all' || ev.city === state.filters.city;
    const catMatch  = state.filters.category === 'all' || ev.category === state.filters.category;

    const q = state.filters.search.toLowerCase().trim();
    const searchMatch = !q ||
      ev.title.toLowerCase().includes(q) ||
      ev.description.toLowerCase().includes(q) ||
      ev.city.toLowerCase().includes(q) ||
      (ev.organizer || '').toLowerCase().includes(q) ||
      ev.category.toLowerCase().includes(q);

    return typeMatch && cityMatch && catMatch && searchMatch;
  });
}

/* ─── RENDER EVENT CARD ─── */
function renderCard(ev) {
  const days = getDaysUntil(ev.date);
  const daysLabel = getDaysLabel(ev.date);
  // Përmirësim: Kontrollojmë datën saktë për statusin "Përfundoi"
  const isPast = days !== null && days < 0;

  const catClass = `badge-cat-${ev.category}`;
  const featuredBadge = ev.featured
    ? `<span class="card-featured">⭐ Featured</span>`
    : '';

  const daysChip = daysLabel
    ? `<span class="meta-item" style="color:${isPast ? 'var(--text-muted)' : days <= 7 ? 'var(--orange)' : 'var(--cyan)'}">
         <span class="meta-icon">⏱️</span>${daysLabel}
       </span>`
    : '';

  // Show pending badge for non-approved events
  const pendingBadge = ev.status === 'pending'
    ? `<span class="badge" style="background:rgba(234,179,8,0.12);color:var(--yellow);border:1px solid rgba(234,179,8,0.2);">⏳ Në Pritje</span>`
    : '';

  return `
    <article class="event-card" data-id="${ev.id}" tabindex="0" role="button" aria-label="Shiko detajet e ${sanitize(ev.title)}">
      <div class="card-header">
        <div class="card-badges">
          <span class="badge badge-type">${getTypeIcon(ev.type)} ${sanitize(ev.type)}</span>
          <span class="badge ${catClass}">${getCategoryIcon(ev.category)} ${sanitize(ev.category)}</span>
          ${pendingBadge}
        </div>
        ${featuredBadge}
      </div>
      <div class="card-body">
        <h3 class="card-title">${sanitize(ev.title)}</h3>
        <p class="card-desc">${sanitize(ev.description)}</p>
        <div class="card-meta">
          <span class="meta-item">
            <span class="meta-icon">📅</span>
            ${formatDateShort(ev.date)}
          </span>
          <span class="meta-item">
            <span class="meta-icon">📍</span>
            ${sanitize(ev.city)}${ev.venue ? ' · ' + sanitize(ev.venue) : ''}
          </span>
          ${daysChip}
        </div>
      </div>
      <div class="card-footer">
        <div class="card-organizer">
          <span>Organizatori: </span>
          <strong>${sanitize(ev.organizer || 'N/A')}</strong>
        </div>
        <button class="btn-register" 
                data-id="${ev.id}" 
                ${isPast ? 'disabled style="opacity:0.5;cursor:not-allowed;"' : ''}>
          ${isPast ? 'Përfundoi' : 'Regjistrohu →'}
        </button>
      </div>
    </article>
  `;
}

/* ─── RENDER EVENTS GRID ─── */
function renderEvents() {
  const grid = document.getElementById('eventsGrid');
  const emptyState = document.getElementById('emptyState');
  const resultsCount = document.getElementById('resultsCount');

  const filtered = getFilteredEvents();

  // Sort: featured first, then by date ascending
  filtered.sort((a, b) => {
    if (a.featured && !b.featured) return -1;
    if (!a.featured && b.featured) return 1;
    return new Date(a.date) - new Date(b.date);
  });

  if (filtered.length === 0) {
    grid.innerHTML = '';
    emptyState.style.display = 'block';
    resultsCount.textContent = 'Nuk u gjetën evente';
  } else {
    emptyState.style.display = 'none';
    grid.innerHTML = filtered.map(renderCard).join('');
    resultsCount.textContent = `${filtered.length} event${filtered.length !== 1 ? 'e' : ''} gjetur`;
  }

  // Update hero stat
  const statEl = document.getElementById('statEvents');
  if (statEl) {
    animateNumber(statEl, parseInt(statEl.textContent) || 0, state.events.filter(e => e.status !== 'rejected').length, 600);
  }

  // Attach card click handlers
  grid.querySelectorAll('.event-card').forEach(card => {
    card.addEventListener('click', (e) => {
      if (e.target.classList.contains('btn-register')) return;
      const id = parseInt(card.dataset.id);
      openDetailModal(id);
    });
    card.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        const id = parseInt(card.dataset.id);
        openDetailModal(id);
      }
    });
  });

  // Attach register button handlers
  grid.querySelectorAll('.btn-register:not([disabled])').forEach(btn => {
    btn.onclick = (e) => {
      e.stopPropagation();
      
      // HIQET parseInt sepse ID e Firebase eshte String (tekst)
      const id = btn.dataset.id; 
      const ev = state.events.find(e => e.id === id);
      
      if (ev && ev.link) {
        // Sigurohemi që linku të hapet saktë
        window.open(ev.link, '_blank', 'noopener,noreferrer');
      } else {
        showToast('Linku i regjistrimit nuk është disponibël.', 'info');
      }
    };
  });
}

/* ─── ANIMATE NUMBER ─── */
function animateNumber(el, from, to, duration) {
  const start = performance.now();
  function update(now) {
    const elapsed = now - start;
    const progress = Math.min(elapsed / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3);
    el.textContent = Math.round(from + (to - from) * eased);
    if (progress < 1) requestAnimationFrame(update);
  }
  requestAnimationFrame(update);
}

/* ─── FILTER HANDLERS ─── */
function initFilters() {
  // Type filters
  document.getElementById('typeFilters').addEventListener('click', (e) => {
    const btn = e.target.closest('.filter-btn');
    if (!btn) return;
    document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    state.filters.type = btn.dataset.filter;
    renderEvents();
    updateActiveFilters();
  });

  // City filters
  document.getElementById('cityFilters').addEventListener('click', (e) => {
    const btn = e.target.closest('.city-btn');
    if (!btn) return;
    document.querySelectorAll('.city-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    state.filters.city = btn.dataset.city;
    renderEvents();
    updateActiveFilters();
  });

  // Category filters
  document.querySelectorAll('.cat-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.cat-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.filters.category = btn.dataset.cat;
      renderEvents();
      updateActiveFilters();
    });
  });

  // Search
  const searchInput = document.getElementById('searchInput');
  let searchTimeout;
  searchInput.addEventListener('input', () => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
      state.filters.search = searchInput.value;
      renderEvents();
      updateActiveFilters();
    }, 250);
  });

  // Clear filters button
  document.getElementById('clearFiltersBtn').addEventListener('click', clearAllFilters);
}

function clearAllFilters() {
  state.filters = { type: 'all', city: 'all', category: 'all', search: '' };
  document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
  document.querySelector('.filter-btn[data-filter="all"]').classList.add('active');
  document.querySelectorAll('.city-btn').forEach(b => b.classList.remove('active'));
  document.querySelector('.city-btn[data-city="all"]').classList.add('active');
  document.querySelectorAll('.cat-btn').forEach(b => b.classList.remove('active'));
  document.querySelector('.cat-btn[data-cat="all"]').classList.add('active');
  document.getElementById('searchInput').value = '';
  updateActiveFilters();
  renderEvents();
}

function updateActiveFilters() {
  const container = document.getElementById('activeFilters');
  const tags = [];

  if (state.filters.type !== 'all') {
    tags.push({ label: `Lloji: ${state.filters.type}`, key: 'type' });
  }
  if (state.filters.city !== 'all') {
    tags.push({ label: `Qyteti: ${state.filters.city}`, key: 'city' });
  }
  if (state.filters.category !== 'all') {
    tags.push({ label: `Kategoria: ${state.filters.category}`, key: 'category' });
  }
  if (state.filters.search) {
    tags.push({ label: `Kërkim: "${state.filters.search}"`, key: 'search' });
  }

  container.innerHTML = tags.map(t => `
    <span class="active-filter-tag">
      ${sanitize(t.label)}
      <button onclick="removeFilter('${t.key}')" aria-label="Hiq filtrin">×</button>
    </span>
  `).join('');
}

window.removeFilter = function(key) {
  if (key === 'type') {
    state.filters.type = 'all';
    document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
    document.querySelector('.filter-btn[data-filter="all"]').classList.add('active');
  } else if (key === 'city') {
    state.filters.city = 'all';
    document.querySelectorAll('.city-btn').forEach(b => b.classList.remove('active'));
    document.querySelector('.city-btn[data-city="all"]').classList.add('active');
  } else if (key === 'category') {
    state.filters.category = 'all';
    document.querySelectorAll('.cat-btn').forEach(b => b.classList.remove('active'));
    document.querySelector('.cat-btn[data-cat="all"]').classList.add('active');
  } else if (key === 'search') {
    state.filters.search = '';
    document.getElementById('searchInput').value = '';
  }
  updateActiveFilters();
  renderEvents();
};

/* ─── VIEW TOGGLE ─── */
function initViewToggle() {
  document.getElementById('gridViewBtn').addEventListener('click', () => {
    state.viewMode = 'grid';
    document.getElementById('eventsGrid').classList.remove('list-view');
    document.getElementById('gridViewBtn').classList.add('active');
    document.getElementById('listViewBtn').classList.remove('active');
  });

  document.getElementById('listViewBtn').addEventListener('click', () => {
    state.viewMode = 'list';
    document.getElementById('eventsGrid').classList.add('list-view');
    document.getElementById('listViewBtn').classList.add('active');
    document.getElementById('gridViewBtn').classList.remove('active');
  });
}

/* ─── MODAL LOGIC ─── */
function openModal(overlayId) {
  const overlay = document.getElementById(overlayId);
  overlay.classList.add('active');
  document.body.style.overflow = 'hidden';
  overlay.querySelector('.modal-close')?.focus();
}

function closeModal(overlayId) {
  const overlay = document.getElementById(overlayId);
  overlay.classList.remove('active');
  document.body.style.overflow = '';
}

function initModals() {
  // Open modal buttons
  document.getElementById('openModalBtn').addEventListener('click', () => openModal('modalOverlay'));
  document.getElementById('heroPostBtn').addEventListener('click', () => {
    document.getElementById('submit').scrollIntoView({ behavior: 'smooth' });
  });

  // Close buttons
  document.getElementById('modalClose').addEventListener('click', () => closeModal('modalOverlay'));
  document.getElementById('modalCancelBtn').addEventListener('click', () => closeModal('modalOverlay'));
  document.getElementById('detailModalClose').addEventListener('click', () => closeModal('detailModalOverlay'));

  // Close on overlay click
  document.getElementById('modalOverlay').addEventListener('click', (e) => {
    if (e.target === e.currentTarget) closeModal('modalOverlay');
  });
  document.getElementById('detailModalOverlay').addEventListener('click', (e) => {
    if (e.target === e.currentTarget) closeModal('detailModalOverlay');
  });

  // Close on Escape
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeModal('modalOverlay');
      closeModal('detailModalOverlay');
    }
  });
}

/* ─── DETAIL MODAL ─── */
function openDetailModal(id) {
  const ev = state.events.find(e => e.id === id);
  if (!ev) return;

  const days = getDaysUntil(ev.date);
  const isPast = days !== null && days < 0;
  const daysLabel = getDaysLabel(ev.date);

  document.getElementById('detailModalTitle').textContent = ev.title;

  document.getElementById('detailModalBody').innerHTML = `
    <div class="detail-hero">
      <div class="detail-badges">
        <span class="badge badge-type">${getTypeIcon(ev.type)} ${sanitize(ev.type)}</span>
        <span class="badge badge-cat-${ev.category}">${getCategoryIcon(ev.category)} ${sanitize(ev.category)}</span>
        ${ev.featured ? '<span class="card-featured">⭐ Featured</span>' : ''}
        ${ev.status === 'pending' ? '<span class="badge" style="background:rgba(234,179,8,0.12);color:var(--yellow);border:1px solid rgba(234,179,8,0.2);">⏳ Në Pritje</span>' : ''}
        ${daysLabel ? `<span class="badge" style="background:rgba(0,212,255,0.1);color:var(--cyan);border:1px solid rgba(0,212,255,0.2);">⏱️ ${sanitize(daysLabel)}</span>` : ''}
      </div>
      <h2 class="detail-title">${sanitize(ev.title)}</h2>
    </div>

    <div class="detail-meta">
      <div class="detail-meta-item">
        <span class="detail-meta-icon">📅</span>
        <div>
          <div class="detail-meta-label">Data</div>
          <div class="detail-meta-value">${formatDate(ev.date)}</div>
        </div>
      </div>
      <div class="detail-meta-item">
        <span class="detail-meta-icon">📍</span>
        <div>
          <div class="detail-meta-label">Vendndodhja</div>
          <div class="detail-meta-value">${sanitize(ev.city)}${ev.venue ? ' · ' + sanitize(ev.venue) : ''}</div>
        </div>
      </div>
      <div class="detail-meta-item">
        <span class="detail-meta-icon">🏷️</span>
        <div>
          <div class="detail-meta-label">Lloji</div>
          <div class="detail-meta-value">${sanitize(ev.type)}</div>
        </div>
      </div>
      <div class="detail-meta-item">
        <span class="detail-meta-icon">👤</span>
        <div>
          <div class="detail-meta-label">Organizatori</div>
          <div class="detail-meta-value">${sanitize(ev.organizer || 'N/A')}</div>
        </div>
      </div>
    </div>

    <p class="detail-desc">${sanitize(ev.description)}</p>

    <div class="detail-actions">
      ${!isPast && ev.link
        ? `<a href="${sanitize(ev.link)}" target="_blank" rel="noopener" class="btn-primary btn-lg">🎟️ Regjistrohu Tani</a>`
        : isPast
          ? `<button class="btn-ghost btn-lg" disabled style="opacity:0.5;cursor:not-allowed;">Ky event ka përfunduar</button>`
          : `<button class="btn-ghost btn-lg" disabled>Linku nuk është disponibël</button>`
      }
      <button class="btn-ghost btn-lg" onclick="closeModal('detailModalOverlay')">Mbyll</button>
    </div>
  `;

  openModal('detailModalOverlay');
}

/* ─── FORM SUBMISSION ─── */
function collectFormData(prefix) {
  const get = (id) => document.getElementById(id)?.value?.trim() || '';
  
  // Rregullim: Sigurohemi që prefix-i të jetë saktë për t'u përputhur me HTML-në tuaj
  // Nëse është forma në faqe, prefix është 'event' (p.sh. eventName)
  // Nëse është modali, prefix është 'mEvent' (p.sh. mEventName)
  
  return {
    title:       get(`${prefix}Name`),
    date:        get(`${prefix}Date`),
    city:        get(`${prefix}City`),
    type:        get(`${prefix}Type`),
    category:    get(`${prefix}Category`),
    venue:       get(`${prefix}Venue`),
    description: get(`${prefix}Desc`),
    link:        get(`${prefix}Link`),
    organizer:   get(`${prefix}Organizer`),
  };
}

function validateForm(data, prefix) {
  const errors = {};
  if (!data.title)       errors.title = 'Emri i eventit është i detyrueshëm.';
  if (!data.date)        errors.date = 'Data është e detyrueshme.';
  if (!data.city)        errors.city = 'Qyteti është i detyrueshëm.';
  if (!data.type)        errors.type = 'Lloji është i detyrueshëm.';
  if (!data.category)    errors.category = 'Kategoria është e detyrueshme.';
  if (!data.description) errors.description = 'Përshkrimi është i detyrueshëm.';

  // Hartëzimi i fushave për të gjetur elementet në HTML
  const fieldMapping = {
    title: 'Name',
    date: 'Date',
    city: 'City',
    type: 'Type',
    category: 'Category',
    description: 'Desc'
  };

  let hasErrors = false;
  
  // Shfaq gabimet për secilën fushë
  Object.keys(fieldMapping).forEach(key => {
    const fieldId = `${prefix}${fieldMapping[key]}`;
    const errEl = document.getElementById(`${fieldId}Error`);
    const inputEl = document.getElementById(fieldId);

    if (errors[key]) {
      if (errEl) errEl.textContent = errors[key];
      if (inputEl) inputEl.classList.add('error');
      hasErrors = true;
    } else {
      if (errEl) errEl.textContent = '';
      if (inputEl) inputEl.classList.remove('error');
    }
  });

  return !hasErrors;
}

function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function addEvent(data) {
  // Rregullimi i linkut: Nëse përdoruesi harron http/https, ia shtojmë ne
  let formattedLink = data.link ? data.link.trim() : "";
  if (formattedLink && !/^https?:\/\//i.test(formattedLink)) {
    formattedLink = 'https://' + formattedLink;
  }

  // 1. Përgatitja e objektit për Cloud
  const newEvent = {
    title: data.title,
    date: data.date,
    city: data.city,
    type: data.type,
    category: data.category,
    venue: data.venue || "",
    description: data.description,
    link: formattedLink,
    organizer: data.organizer || "I paemërtuar",
    featured: false,
    status: 'pending', // Do të presë aprovimin tënd
    createdAt: new Date().toISOString()
  };

  // 2. Ruajtja në Firebase
  const newEventRef = database.ref('events').push();
  
  return newEventRef.set(newEvent)
    .then(() => {
      console.log("Eventi u ruajt në Firebase!");

      // 3. Dërgimi i Email-it njoftues
      return emailjs.send("service_wonix4j", "template_f3qtgii", {
        event_name: newEvent.title,
        event_city: newEvent.city,
        event_date: newEvent.date,
        event_organizer: newEvent.organizer,
        event_desc: newEvent.description,
        event_link: newEvent.link
      });
    })
    .then((response) => {
      console.log("Emaili u dërgua me sukses!", response.status);
      if (typeof showToast === 'function') {
        showToast('✅ Sukses! Eventi do të shfaqet pasi të aprovohet.', 'success');
      } else {
        alert('✅ Sukses! Eventi do të shfaqet pasi të aprovohet.');
      }
      // Reseto formën pas suksesit
      resetForm('addEventForm'); // Sigurohu që ID e formës të jetë e saktë
    })
    .catch((error) => {
      console.error("Gabim gjatë procesit:", error);
      if (typeof showToast === 'function') {
        showToast('❌ Ndodhi një gabim teknik.', 'error');
      } else {
        alert('❌ Ndodhi një gabim teknik.');
      }
    });
}

function resetForm(formId) {
  const form = document.getElementById(formId);
  if (form) {
    form.reset();
    form.querySelectorAll('.form-input').forEach(el => el.classList.remove('error'));
    form.querySelectorAll('.form-error').forEach(el => el.textContent = '');
  }
}
/* ─── SECTION FORM (Forma poshtë në faqe) ─── */
function initSectionForm() {
  const form = document.getElementById('submitEventForm');
  if (!form) return;

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const data = collectFormData('event'); // Përdor 'event' si prefix
    if (!validateForm(data, 'event')) return;

    const btnText   = form.querySelector('.btn-text');
    const btnLoader = form.querySelector('.btn-loader');
    const submitBtn = form.querySelector('[type="submit"]');

    submitBtn.disabled = true;
    if (btnText)   btnText.style.display   = 'none';
    if (btnLoader) btnLoader.style.display = 'inline';

    setTimeout(() => {
      addEvent(data);
      resetForm('submitEventForm');
      submitBtn.disabled = false;
      if (btnText)   btnText.style.display   = 'inline';
      if (btnLoader) btnLoader.style.display = 'none';
      showToast('✅ Eventi u dërgua me sukses dhe po pret aprovimin!', 'success');
      document.getElementById('events')?.scrollIntoView({ behavior: 'smooth' });
    }, 1200);
  });
}

/* ─── MODAL FORM (Dritarja +Posto Event) ─── */
function initModalForm() {
  const form = document.getElementById('modalEventForm');
  if (!form) return;

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const data = collectFormData('mEvent'); // Përdor 'mEvent' si prefix

    // Përdorim validateForm edhe këtu që të shfaqen gabimet e kuqe brenda modalit
    if (!validateForm(data, 'mEvent')) {
      showToast('⚠️ Ju lutem plotësoni të gjitha fushat e detyrueshme.', 'error');
      return;
    }

    const submitBtn = form.querySelector('[type="submit"]');
    submitBtn.disabled = true;
    const originalText = submitBtn.textContent;
    submitBtn.textContent = 'Duke publikuar...';

    setTimeout(() => {
      addEvent(data);
      resetForm('modalEventForm');
      if (typeof closeModal === 'function') {
        closeModal('modalOverlay');
      } else {
        document.getElementById('modalOverlay').style.display = 'none';
      }
      submitBtn.disabled = false;
      submitBtn.textContent = originalText;
      showToast('✅ Eventi u dërgua me sukses dhe po pret aprovimin!', 'success');
    }, 1000);
  });
}

/* ─── ADMIN PANEL — PASSCODE PROTECTION ─── */
function showAdminAccessDenied() {
  // Create a styled overlay alert instead of browser alert()
  const existing = document.getElementById('adminAccessAlert');
  if (existing) existing.remove();

  const alert = document.createElement('div');
  alert.id = 'adminAccessAlert';
  alert.style.cssText = `
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    z-index: 9999;
    background: #0f0f18;
    border: 1px solid rgba(248,113,113,0.4);
    border-radius: 16px;
    padding: 32px 40px;
    text-align: center;
    box-shadow: 0 20px 60px rgba(0,0,0,0.7), 0 0 40px rgba(248,113,113,0.15);
    max-width: 400px;
    width: 90%;
    animation: fadeInUp 0.3s ease;
  `;
  alert.innerHTML = `
    <div style="font-size:2.5rem;margin-bottom:16px;">🔒</div>
    <h3 style="font-size:1.1rem;font-weight:700;color:#f87171;margin-bottom:10px;">Qasje e Mohuar!</h3>
    <p style="font-size:0.9rem;color:#a0a0b0;line-height:1.6;margin-bottom:24px;">
      Vetëm administratori mund të hyjë këtu.
    </p>
    <button id="adminAlertClose" style="
      padding:10px 28px;
      background:linear-gradient(135deg,#f87171,#dc2626);
      color:#fff;
      font-weight:700;
      font-size:0.9rem;
      border-radius:10px;
      border:none;
      cursor:pointer;
    ">Mbyll</button>
  `;

  // Backdrop
  const backdrop = document.createElement('div');
  backdrop.id = 'adminAccessBackdrop';
  backdrop.style.cssText = `
    position: fixed;
    inset: 0;
    z-index: 9998;
    background: rgba(0,0,0,0.7);
    backdrop-filter: blur(4px);
  `;

  document.body.appendChild(backdrop);
  document.body.appendChild(alert);

  const close = () => {
    alert.remove();
    backdrop.remove();
  };

  document.getElementById('adminAlertClose').addEventListener('click', close);
  backdrop.addEventListener('click', close);
}

function showAdminPasscodePrompt(onSuccess) {
  const existing = document.getElementById('adminPasscodeModal');
  if (existing) existing.remove();
  const existingBd = document.getElementById('adminPasscodeBackdrop');
  if (existingBd) existingBd.remove();

  const backdrop = document.createElement('div');
  backdrop.id = 'adminPasscodeBackdrop';
  backdrop.style.cssText = `
    position: fixed;
    inset: 0;
    z-index: 9998;
    background: rgba(0,0,0,0.75);
    backdrop-filter: blur(6px);
  `;

  const modal = document.createElement('div');
  modal.id = 'adminPasscodeModal';
  modal.style.cssText = `
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    z-index: 9999;
    background: #0f0f18;
    border: 1px solid rgba(0,212,255,0.25);
    border-radius: 20px;
    padding: 36px 40px;
    text-align: center;
    box-shadow: 0 20px 60px rgba(0,0,0,0.7), 0 0 40px rgba(0,212,255,0.1);
    max-width: 380px;
    width: 90%;
    animation: fadeInUp 0.3s ease;
  `;
  modal.innerHTML = `
    <div style="font-size:2.5rem;margin-bottom:16px;">🔐</div>
    <h3 style="font-size:1.15rem;font-weight:700;color:#f0f0f0;margin-bottom:8px;">Admin Panel</h3>
    <p style="font-size:0.85rem;color:#a0a0b0;margin-bottom:24px;">Shkruaj kodin e aksesit për të vazhduar.</p>
    <input
      type="password"
      id="adminPasscodeInput"
      placeholder="Kodi i aksesit..."
      style="
        width:100%;
        padding:12px 16px;
        background:rgba(255,255,255,0.05);
        border:1px solid rgba(255,255,255,0.1);
        border-radius:10px;
        color:#f0f0f0;
        font-size:1rem;
        outline:none;
        text-align:center;
        letter-spacing:0.2em;
        margin-bottom:8px;
        transition:border-color 0.15s;
      "
      autocomplete="off"
    />
    <p id="adminPasscodeError" style="font-size:0.78rem;color:#f87171;min-height:20px;margin-bottom:16px;"></p>
    <div style="display:flex;gap:12px;justify-content:center;">
      <button id="adminPasscodeCancel" style="
        padding:10px 24px;
        background:rgba(255,255,255,0.05);
        color:#a0a0b0;
        font-weight:600;
        font-size:0.9rem;
        border-radius:10px;
        border:1px solid rgba(255,255,255,0.1);
        cursor:pointer;
      ">Anulo</button>
      <button id="adminPasscodeSubmit" style="
        padding:10px 28px;
        background:linear-gradient(135deg,#00d4ff,#0099cc);
        color:#000;
        font-weight:700;
        font-size:0.9rem;
        border-radius:10px;
        border:none;
        cursor:pointer;
      ">Hyr →</button>
    </div>
  `;

  document.body.appendChild(backdrop);
  document.body.appendChild(modal);

  const input = document.getElementById('adminPasscodeInput');
  const errorEl = document.getElementById('adminPasscodeError');
  input.focus();

  const closePrompt = () => {
    modal.remove();
    backdrop.remove();
  };

  const trySubmit = () => {
    const entered = input.value.trim();
    if (entered === ADMIN_PASSCODE) {
      closePrompt();
      onSuccess();
    } else {
      errorEl.textContent = 'Kodi i gabuar. Provo përsëri.';
      input.style.borderColor = '#f87171';
      input.value = '';
      input.focus();
      setTimeout(() => {
        errorEl.textContent = '';
        input.style.borderColor = 'rgba(255,255,255,0.1)';
      }, 2500);
    }
  };

  document.getElementById('adminPasscodeSubmit').addEventListener('click', trySubmit);
  document.getElementById('adminPasscodeCancel').addEventListener('click', closePrompt);
  backdrop.addEventListener('click', closePrompt);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') trySubmit();
    if (e.key === 'Escape') closePrompt();
  });
}

function initAdminPanel() {
  const toggleBtn = document.getElementById('adminToggleBtn');
  const panel     = document.getElementById('adminPanel');

  toggleBtn.addEventListener('click', () => {
    // If already visible, just close it
    if (state.adminVisible) {
      state.adminVisible = false;
      state.adminAuthenticated = false;
      panel.style.display = 'none';
      toggleBtn.textContent = 'Admin Panel';
      return;
    }

    // If already authenticated this session, open directly
    if (state.adminAuthenticated) {
      openAdminPanel();
      return;
    }

    // Otherwise prompt for passcode
    showAdminPasscodePrompt(() => {
      state.adminAuthenticated = true;
      openAdminPanel();
    });
  });
}

function openAdminPanel() {
  const panel     = document.getElementById('adminPanel');
  const toggleBtn = document.getElementById('adminToggleBtn');

  state.adminVisible = true;
  panel.style.display = 'block';
  toggleBtn.textContent = '✕ Mbyll Admin';
  panel.scrollIntoView({ behavior: 'smooth' });
  renderAdminTable();
  updateAdminStats();
}

/* ─── ADMIN PANEL RENDERING ─── */
function renderAdminTable() {
  const tbody = document.getElementById('adminTableBody');
  if (!tbody) return;

  if (state.events.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8" style="text-align:center;color:var(--text-muted);padding:32px;">Nuk ka evente.</td></tr>`;
    return;
  }

  tbody.innerHTML = state.events.map(ev => `
    <tr>
      <td style="font-family:var(--font-mono);color:var(--text-muted);font-size:0.75rem;">#${ev.id.substring(0, 6)}...</td>
      <td style="color:var(--text-primary);font-weight:600;max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${sanitize(ev.title)}">${sanitize(ev.title)}</td>
      <td>${formatDateShort(ev.date)}</td>
      <td>${sanitize(ev.city)}</td>
      <td>${sanitize(ev.type)}</td>
      <td><span class="badge badge-cat-${ev.category}">${getCategoryIcon(ev.category)} ${sanitize(ev.category)}</span></td>
      <td><span class="status-badge status-${ev.status}">${getStatusLabel(ev.status)}</span></td>
      <td>
        <div class="admin-actions">
          ${ev.status !== 'approved'
            ? `<button class="admin-btn admin-btn-approve" onclick="adminAction('${ev.id}','approve')">✓ Aprovo</button>`
            : `<button class="admin-btn admin-btn-reject" onclick="adminAction('${ev.id}','reject')">✗ Refuzo</button>`
          }
          <button class="admin-btn admin-btn-delete" onclick="adminAction('${ev.id}','delete')">🗑</button>
        </div>
      </td>
    </tr>
  `).join('');
}

function getStatusLabel(status) {
  const labels = { approved: '✓ Aprovuar', pending: '⏳ Në Pritje', rejected: '✗ Refuzuar' };
  return labels[status] || status;
}

/* ─── ADMIN ACTIONS (CONNECTED TO FIREBASE) ─── */
window.adminAction = function(id, action) {
  // Gjejmë eventin në state-in lokal për të marrë titullin (për toast)
  const ev = state.events.find(e => e.id === id);
  if (!ev) return;

  const eventRef = database.ref('events/' + id);

  if (action === 'approve') {
    eventRef.update({ status: 'approved' })
      .then(() => showToast(`✅ Eventi "${ev.title}" u aprovua.`, 'success'))
      .catch(err => console.error("Gabim:", err));

  } else if (action === 'reject') {
    eventRef.update({ status: 'rejected' })
      .then(() => showToast(`❌ Eventi "${ev.title}" u refuzua.`, 'error'))
      .catch(err => console.error("Gabim:", err));

  } else if (action === 'delete') {
    if (confirm(`A jeni i sigurt që dëshironi ta fshini "${ev.title}"?`)) {
      eventRef.remove()
        .then(() => showToast(`🗑️ Eventi "${ev.title}" u fshi.`, 'info'))
        .catch(err => console.error("Gabim:", err));
    }
  }
  
  // Shënim: Nuk kemi nevojë për renderAdminTable() apo saveToStorage() këtu!
  // Pse? Sepse database.ref('events').on('value', ...) që kemi bërë më lart 
  // do ta detektojë ndryshimin në Cloud dhe do ta rifreskojë tabelën automatikisht.
};

function updateAdminStats() {
  const total    = state.events.length;
  const approved = state.events.filter(e => e.status === 'approved').length;
  const pending  = state.events.filter(e => e.status === 'pending').length;

  const setEl = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
  setEl('adminTotalEvents', total);
  setEl('adminApproved',    approved);
  setEl('adminPending',     pending);
}

/* ─── TOAST NOTIFICATIONS ─── */
function showToast(message, type = 'info') {
  const container = document.getElementById('toastContainer');
  const icons = { success: '✅', error: '❌', info: 'ℹ️' };

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `<span class="toast-icon">${icons[type]}</span><span>${sanitize(message)}</span>`;

  container.appendChild(toast);

  setTimeout(() => {
    toast.style.animation = 'slideInRight 0.3s ease reverse';
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

/* ─── NAVBAR SCROLL EFFECT ─── */
function initNavbar() {
  const navbar = document.getElementById('navbar');
  window.addEventListener('scroll', () => {
    navbar.classList.toggle('scrolled', window.scrollY > 50);
  }, { passive: true });

  // Hamburger menu
  const hamburger  = document.getElementById('hamburger');
  const navLinks   = document.querySelector('.nav-links');
  const navActions = document.querySelector('.nav-actions');

  hamburger.addEventListener('click', () => {
    navLinks.classList.toggle('open');
    navActions.classList.toggle('open');
  });

  // Close menu on link click
  document.querySelectorAll('.nav-link').forEach(link => {
    link.addEventListener('click', () => {
      navLinks.classList.remove('open');
      navActions.classList.remove('open');
    });
  });
}

/* ─── INTERSECTION OBSERVER (Scroll Animations) ─── */
function initScrollAnimations() {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.style.opacity    = '1';
        entry.target.style.transform  = 'translateY(0)';
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.1, rootMargin: '0px 0px -50px 0px' });

  document.querySelectorAll('.section-header, .submit-wrapper, .about-grid, .admin-header').forEach(el => {
    el.style.opacity    = '0';
    el.style.transform  = 'translateY(30px)';
    el.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
    observer.observe(el);
  });
}

/* ─── MAP CITY CLICK ─── */
function initMapCities() {
  document.querySelectorAll('.map-city').forEach(city => {
    city.addEventListener('click', () => {
      const cityName = city.dataset.city;
      state.filters.city = cityName;
      document.querySelectorAll('.city-btn').forEach(b => b.classList.remove('active'));
      const btn = document.querySelector(`.city-btn[data-city="${cityName}"]`);
      if (btn) btn.classList.add('active');
      updateActiveFilters();
      renderEvents();
      document.getElementById('events').scrollIntoView({ behavior: 'smooth' });
      showToast(`📍 Filtruar sipas qytetit: ${cityName}`, 'info');
    });
  });
}

/* ─── KEYBOARD SHORTCUTS ─── */
function initKeyboardShortcuts() {
  document.addEventListener('keydown', (e) => {
    // Ctrl/Cmd + K → focus search
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
      e.preventDefault();
      document.getElementById('searchInput').focus();
    }
    // Ctrl/Cmd + N → open modal
    if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
      e.preventDefault();
      openModal('modalOverlay');
    }
  });
}

/* ─── HERO POST BUTTON ─── */
function initHeroButtons() {
  document.getElementById('heroPostBtn')?.addEventListener('click', () => {
    document.getElementById('submit').scrollIntoView({ behavior: 'smooth' });
  });
}

/* ─── INIT ─── */
document.addEventListener('DOMContentLoaded', () => {
  renderEvents();
  initFilters();
  initViewToggle();
  initModals();
  initSectionForm();
  initModalForm();
  initAdminPanel();
  initNavbar();
  initScrollAnimations();
  initMapCities();
  initKeyboardShortcuts();
  initHeroButtons();

  // Animate hero stat on load
  const statEl = document.getElementById('statEvents');
  if (statEl) {
    animateNumber(statEl, 0, state.events.filter(e => e.status !== 'rejected').length, 1200);
  }

  console.log('%c IT Events Hub Kosovo ', 'background:#00d4ff;color:#000;font-weight:bold;padding:4px 8px;border-radius:4px;');
  console.log('%c Keyboard shortcuts: Ctrl+K (search), Ctrl+N (new event) ', 'color:#a855f7;');
});
// --- KONFIGURIMI PËRFUNDIMTAR I EMAILJS ---

// 1. Inicializimi me Public Key-in tënd
emailjs.init("sLcObY_Fg6HrOOkWX");

// 2. Kapja e dërgimit të formës
document.getElementById('submitEventForm').addEventListener('submit', function(e) {
    e.preventDefault(); // Ndalon rifreskimin e faqes që të kryhet dërgimi

    // Shfaq një mesazh që dërgimi po procesohet (opsionale)
    const submitBtn = document.getElementById('submitBtn');
    if(submitBtn) submitBtn.innerText = "Duke u dërguar...";

    // 3. Mbledhja e të dhënave nga fushat e formës
    const eventParams = {
        event_name: document.getElementById('eventName').value,
        event_city: document.getElementById('eventCity').value,
        event_date: document.getElementById('eventDate').value,
        event_organizer: document.getElementById('eventOrganizer').value || "I paemërtuar",
        event_desc: document.getElementById('eventDesc').value
    };

    // 4. Dërgimi i email-it njoftues
    // Service ID: service_wonix4j | Template ID: template_f3qtgii
    emailjs.send("service_wonix4j", "template_f3qtgii", eventParams)
        .then(function(response) {
            console.log('Sukses!', response.status, response.text);
            alert("Njoftimi u dërgua me sukses! Eventi do të shfaqet pasi të aprovohet nga Ensar Gashi.");
            
            // Këtu vazhdon logjika jote për ruajtjen në LocalStorage
            // Nëse dëshiron që forma të pastrohet:
            document.getElementById('submitEventForm').reset();
            if(submitBtn) submitBtn.innerText = "🚀 Publiko Eventin";
            
        }, function(error) {
            console.log('Gabim gjatë dërgimit:', error);
            alert("Ndodhi një gabim teknik. Ju lutem provoni përsëri.");
            if(submitBtn) submitBtn.innerText = "🚀 Publiko Eventin";
        });
});

// SHTOJE KËTË NË FUND FARE TË ict.js
document.addEventListener('click', function(e) {
    // Kontrollojmë nëse klikimi u bë mbi butonin Regjistrohu
    if (e.target && e.target.classList.contains('btn-register')) {
        e.preventDefault();
        e.stopPropagation();

        const eventId = e.target.getAttribute('data-id');
        
        // Kërkojmë eventin në listen globale 'state.events'
        const ev = state.events.find(item => item.id === eventId);

        if (ev && ev.link) {
            let url = ev.link.trim();
            // Shtojmë https:// nëse mungon
            if (!/^https?:\/\//i.test(url)) {
                url = 'https://' + url;
            }
            window.open(url, '_blank', 'noopener,noreferrer');
        } else {
            // Nëse nuk ka link, përdorim funksionin tënd showToast
            if (typeof showToast === 'function') {
                showToast('Linku i regjistrimit nuk është i disponueshëm.', 'info');
            } else {
                alert('Linku i regjistrimit nuk është i disponueshëm.');
            }
        }
    }
});
