// ---------- Load content and render the page ----------
let CONTENT = null;

// ---------- Lock chain state ----------
// In-memory only: every page load/refresh starts locked again.
// Each confirmation also carries a timestamp and lapses after 30 minutes,
// so a long call without a refresh will still re-lock the chain.
const LOCK_TTL_MS = 30 * 60 * 1000; // 30 minutes

const LOCK_STAGES = [
  { gate: 'discovery', doneKey: 'phoenix-discovery-done', unlocks: ['sales-pitch'] },
  { gate: 'sales-pitch', doneKey: 'phoenix-salespitch-done', unlocks: ['booking'] },
];
const VERBATIM_ID = 'verbatim';
const VERBATIM_REQUIRES = ['phoenix-booking-done'];

// If an upstream step lapses, its downstream steps must be reconfirmed too.
const LOCK_DEPENDENTS = {
  'phoenix-discovery-done': ['phoenix-salespitch-done', 'phoenix-booking-done'],
  'phoenix-salespitch-done': ['phoenix-booking-done'],
};

// key -> timestamp (ms) when confirmed. Plain JS object, so it resets on every load.
const unlockTimes = {};

function markDone(key) { unlockTimes[key] = Date.now(); }

function isDone(key) {
  const t = unlockTimes[key];
  if (!t) return false;
  if (Date.now() - t >= LOCK_TTL_MS) { delete unlockTimes[key]; return false; }
  return true;
}

function cascadeExpiry() {
  // Drop downstream confirmations whenever their upstream step is no longer valid.
  Object.keys(LOCK_DEPENDENTS).forEach(parent => {
    if (!isDone(parent)) {
      LOCK_DEPENDENTS[parent].forEach(dep => { delete unlockTimes[dep]; });
    }
  });
}

function lockedTabIds() {
  cascadeExpiry();
  const locked = new Set();
  LOCK_STAGES.forEach(stage => {
    if (!isDone(stage.doneKey)) stage.unlocks.forEach(id => locked.add(id));
  });
  if (!VERBATIM_REQUIRES.every(isDone)) locked.add(VERBATIM_ID);
  return locked;
}

// Reassigned inside setupLockChainGates once the floating bars exist.
let evaluateLocks = function () {};

async function loadContent() {
  try {
    const res = await fetch('/api/content');
    CONTENT = await res.json();
  } catch (err) {
    console.error('Failed to load content from API, using bundled fallback.', err);
    const res = await fetch('/content.json');
    CONTENT = await res.json();
  }
  renderTabs();
  renderToolbar();
  populateCalculatorOptions();
  setupNotesAndModals();
  setupSearch();
}

function renderTabs() {
  const tabnav = document.getElementById('tabnav');
  const content = document.getElementById('content');
  const pageTitle = document.getElementById('pageTitle');

  tabnav.innerHTML = '';
  content.innerHTML = '';

  const locked = lockedTabIds();

  CONTENT.tabs.forEach((tab, index) => {
    const btn = document.createElement('button');
    btn.className = 'tab' + (index === 0 ? ' active' : '');
    btn.dataset.target = tab.id;
    btn.textContent = tab.label;

    if (locked.has(tab.id)) {
      btn.classList.add('tab-locked');
      btn.title = 'Complete the previous step first';
    }

    btn.addEventListener('click', () => {
      if (btn.classList.contains('tab-locked')) {
        flashLockNotice();
        return;
      }
      document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById('panel-' + tab.id).classList.add('active');
      pageTitle.textContent = tab.label;
      window.scrollTo({ top: 0, behavior: 'instant' });
      evaluateLocks();
    });
    tabnav.appendChild(btn);

    const section = document.createElement('section');
    section.className = 'panel' + (index === 0 ? ' active' : '');
    section.id = 'panel-' + tab.id;
    section.innerHTML = `<h1>${tab.title}</h1>${tab.html}`;
    setupAccordions(section);
    content.appendChild(section);
  });

  setupLockChainGates();

  if (CONTENT.tabs.length > 0) {
    pageTitle.textContent = CONTENT.tabs[0].label;
  }

  // Re-check periodically so unlocks expire after 30 minutes without needing a refresh.
  if (window.__lockTimer) clearInterval(window.__lockTimer);
  window.__lockTimer = setInterval(evaluateLocks, 30000);
}

function setupLockChainGates() {
  // Remove any existing floating bars before re-creating (renderTabs can run more than once)
  document.querySelectorAll('.discovery-float-bar').forEach(el => el.remove());

  const gateLabels = {
    'discovery': 'discovery questions',
    'sales-pitch': 'the sales pitch',
    'booking': 'booking',
  };

  // One bar per gated step.
  const stageBars = LOCK_STAGES.map(stage => {
    const bar = document.createElement('div');
    bar.className = 'discovery-float-bar';
    bar.dataset.gate = stage.gate;
    document.body.appendChild(bar);
    return { gate: stage.gate, doneKey: stage.doneKey, bar };
  });

  // Booking feeds into unlocking Verbatim.
  const verbatimGates = ['booking'];
  const verbatimBars = verbatimGates.map((gateId, i) => {
    const bar = document.createElement('div');
    bar.className = 'discovery-float-bar';
    bar.dataset.gate = gateId;
    bar.dataset.verbatimStep = 'true';
    document.body.appendChild(bar);
    return { gate: gateId, doneKey: VERBATIM_REQUIRES[i], bar };
  });

  const allBars = stageBars.concat(verbatimBars);

  function renderBar(entry) {
    if (isDone(entry.doneKey)) {
      entry.bar.innerHTML = `<span class="discovery-float-done">&#10003; Confirmed</span>`;
      return;
    }
    const label = gateLabels[entry.gate] || entry.gate;
    entry.bar.innerHTML =
      `<span class="discovery-float-text">Finished with ${label}?</span>` +
      `<button class="discovery-float-btn" type="button">I've completed this step</button>`;
    entry.bar.querySelector('button').addEventListener('click', () => {
      markDone(entry.doneKey);
      evaluateLocks();
      // Collapse the bar shortly after confirming.
      setTimeout(evaluateLocks, 1600);
    });
  }

  evaluateLocks = function () {
    const locked = lockedTabIds();

    // Sync tab lock styling.
    CONTENT.tabs.forEach(tab => {
      const tabBtn = document.querySelector(`.tab[data-target="${tab.id}"]`);
      if (!tabBtn) return;
      if (locked.has(tab.id)) {
        tabBtn.classList.add('tab-locked');
        tabBtn.title = 'Complete the previous step first';
      } else {
        tabBtn.classList.remove('tab-locked');
        tabBtn.title = '';
      }
    });

    // Re-render any bar whose confirmed/not-confirmed state changed (e.g. after expiry).
    allBars.forEach(entry => {
      const showsConfirmed = entry.bar.querySelector('.discovery-float-done') !== null;
      if (showsConfirmed !== isDone(entry.doneKey)) renderBar(entry);
    });

    // Show a bar only while you're on its gate tab and it isn't yet confirmed.
    const activeTab = document.querySelector('.tab.active');
    const activeGate = activeTab ? activeTab.dataset.target : null;
    allBars.forEach(entry => {
      entry.bar.classList.toggle('visible', activeGate === entry.gate && !isDone(entry.doneKey));
    });

    // If the tab you're on just re-locked (30-min lapse), bounce back to the first tab.
    if (activeTab && locked.has(activeTab.dataset.target)) {
      const first = document.querySelector('.tab');
      if (first) first.click();
      flashLockNotice('That step locked again after 30 minutes \u2014 please reconfirm the earlier steps.');
    }
  };

  allBars.forEach(renderBar);
  evaluateLocks();
}


function flashLockNotice(message) {
  const existing = document.getElementById('lockNotice');
  if (existing) existing.remove();

  const notice = document.createElement('div');
  notice.id = 'lockNotice';
  notice.className = 'lock-notice';
  notice.textContent = message || 'Complete the previous step first to unlock this tab.';
  document.body.appendChild(notice);

  setTimeout(() => {
    notice.classList.add('lock-notice-out');
    setTimeout(() => notice.remove(), 300);
  }, 2200);
}

// ---------- Accordions & tiles (objections, FAQs, value anchors) ----------
function escapeHtml(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// Panels that become click-to-reveal tile grids.
const TILE_PANEL_IDS = ['panel-value-statements', 'panel-onset-objections', 'panel-objections', 'panel-faqs', 'panel-sales-pitch'];
// Panels that become full-width click-to-reveal accordions (dropdowns).
const ACCORDION_PANEL_IDS = ['panel-verbatim'];

// Pull a title + body out of one item container, regardless of how it's marked up.
function extractItem(el) {
  const clone = el.cloneNode(true);
  let titleEl = clone.querySelector('h2, h3, h4, h5, h6') || clone.querySelector('strong, b');
  let titleHtml, bodyHtml;

  if (titleEl) {
    titleHtml = titleEl.innerHTML.trim();
    titleEl.remove();
    bodyHtml = clone.innerHTML.trim();
  } else {
    // No heading: use a short preview of the text as the label, full content as the body.
    const text = clone.textContent.trim().replace(/\s+/g, ' ');
    titleHtml = escapeHtml(text.length > 64 ? text.slice(0, 64).trim() + '\u2026' : text);
    bodyHtml = clone.innerHTML.trim();
  }
  if (!bodyHtml) bodyHtml = '<p class="accordion-empty">(no additional detail)</p>';
  return { el, titleHtml, bodyHtml };
}

// Find the repeating "items" inside a panel, trying several common structures.
function collectItems(panel) {
  // 1. Explicit value-list <li>
  let nodes = Array.from(panel.querySelectorAll('.value-list > li'));
  if (nodes.length) return nodes.map(extractItem);

  // 2. Explicit .objection / .faq blocks
  nodes = Array.from(panel.querySelectorAll('.objection, .faq'));
  if (nodes.length) return nodes.map(extractItem);

  // 3. Generic wrapper blocks: direct children that contain a heading or bold lead-in
  nodes = Array.from(panel.children).filter(ch =>
    ch.nodeType === 1 &&
    ch.tagName !== 'H1' &&
    !ch.classList.contains('hint') &&
    (ch.querySelector('h2, h3, h4, h5, h6') || ch.querySelector('strong, b'))
  );
  if (nodes.length) return nodes.map(extractItem);

  // 4. Flat pattern: headings sit directly in the panel; group each heading with the
  //    content that follows it until the next heading.
  const groups = [];
  let current = null;
  Array.from(panel.children).forEach(ch => {
    if (ch.tagName === 'H1' || (ch.classList && ch.classList.contains('hint'))) return;
    if (/^H[2-6]$/.test(ch.tagName)) {
      current = { heading: ch, nodes: [] };
      groups.push(current);
    } else if (current) {
      current.nodes.push(ch);
    }
  });
  if (groups.length) {
    return groups.map(g => {
      const wrap = document.createElement('div');
      g.heading.parentNode.insertBefore(wrap, g.heading);
      wrap.appendChild(g.heading);
      g.nodes.forEach(n => wrap.appendChild(n));
      return extractItem(wrap);
    });
  }

  return [];
}

function attachToggle(container, trigger) {
  const toggle = () => container.classList.toggle('open');
  trigger.addEventListener('click', toggle);
  trigger.addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); }
  });
}

function buildAccordionItem(item) {
  const el = item.el;
  el.classList.add('accordion-item');
  el.dataset.accordion = 'on';
  el.innerHTML =
    `<div class="accordion-trigger" role="button" tabindex="0">` +
      `<span class="accordion-title">${item.titleHtml}</span>` +
      `<span class="accordion-chevron" aria-hidden="true">\u25BE</span>` +
    `</div>` +
    `<div class="accordion-body">${item.bodyHtml}</div>`;
  attachToggle(el, el.querySelector('.accordion-trigger'));
}

function buildTiles(panel, items) {
  const grid = document.createElement('div');
  grid.className = 'value-tiles';
  // Objections and FAQs have longer titles, so give them wider tiles (fewer per row).
  if (panel.id !== 'panel-value-statements') grid.classList.add('tiles-wide');

  items.forEach(item => {
    const tile = document.createElement('div');
    tile.className = 'value-tile accordion-item';
    tile.innerHTML =
      `<div class="accordion-trigger" role="button" tabindex="0">` +
        `<span class="accordion-title">${item.titleHtml}</span>` +
        `<span class="accordion-chevron" aria-hidden="true">\u25BE</span>` +
      `</div>` +
      `<div class="accordion-body">${item.bodyHtml}</div>`;
    attachToggle(tile, tile.querySelector('.accordion-trigger'));
    grid.appendChild(tile);
  });

  // Swap the original items out for the tile grid (keeping the intro hint in place).
  const ul = panel.querySelector('.value-list');
  if (ul) {
    ul.parentNode.replaceChild(grid, ul);
  } else if (items.length) {
    items[0].el.parentNode.insertBefore(grid, items[0].el);
    items.forEach(it => it.el.remove());
  }
}

function setupAccordions(panel) {
  if (panel.dataset.accordion === 'on') return;
  const isTile = TILE_PANEL_IDS.includes(panel.id);
  const isAccordion = ACCORDION_PANEL_IDS.includes(panel.id);
  if (!isTile && !isAccordion) return;

  const items = collectItems(panel);
  if (!items.length) return;
  panel.dataset.accordion = 'on';

  if (isTile) {
    buildTiles(panel, items);
  } else {
    items.forEach(buildAccordionItem);
  }
}

// ---------- Search ----------
function setupSearch() {
  const input = document.getElementById('searchInput');
  const results = document.getElementById('searchResults');

  if (!input || !results) return;

  input.addEventListener('input', () => {
    const query = input.value.trim().toLowerCase();

    if (query.length < 2) {
      results.classList.remove('open');
      results.innerHTML = '';
      return;
    }

    const matches = [];

    CONTENT.tabs.forEach(tab => {
      const plainText = tab.html.replace(/<[^>]*>/g, ' ');
      const haystacks = [
        { text: tab.title, isTitle: true },
        { text: plainText, isTitle: false },
      ];

      haystacks.forEach(h => {
        const lower = h.text.toLowerCase();
        const idx = lower.indexOf(query);
        if (idx !== -1 && matches.filter(m => m.tabId === tab.id).length < 2) {
          const start = Math.max(0, idx - 40);
          const end = Math.min(h.text.length, idx + query.length + 40);
          let snippet = h.text.slice(start, end).trim().replace(/\s+/g, ' ');
          if (start > 0) snippet = '...' + snippet;
          if (end < h.text.length) snippet = snippet + '...';

          matches.push({
            tabId: tab.id,
            tabLabel: tab.label,
            snippet,
            query,
          });
        }
      });
    });

    renderSearchResults(matches.slice(0, 8), query);
  });

  document.addEventListener('click', (e) => {
    if (!e.target.closest('.search-wrap')) {
      results.classList.remove('open');
    }
  });
}

function renderSearchResults(matches, query) {
  const results = document.getElementById('searchResults');

  if (matches.length === 0) {
    results.innerHTML = '<div class="search-no-results">No matches found.</div>';
    results.classList.add('open');
    return;
  }

  results.innerHTML = '';
  matches.forEach(m => {
    const item = document.createElement('div');
    item.className = 'search-result-item';

    const escapedSnippet = m.snippet
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
    const re = new RegExp(escapeRegExp(m.query), 'ig');
    const highlighted = escapedSnippet.replace(re, (match) => `<mark>${match}</mark>`);

    item.innerHTML = `
      <span class="search-result-tab">${m.tabLabel}</span>
      <span class="search-result-snippet">${highlighted}</span>
    `;

    item.addEventListener('click', () => {
      const tabBtn = document.querySelector(`.tab[data-target="${m.tabId}"]`);
      if (tabBtn) tabBtn.click();
      // Open any collapsed item in that tab that matches the search term.
      const panel = document.getElementById('panel-' + m.tabId);
      if (panel) {
        panel.querySelectorAll('.accordion-item').forEach(acc => {
          if (acc.textContent.toLowerCase().includes(m.query)) acc.classList.add('open');
        });
      }
      results.classList.remove('open');
      document.getElementById('searchInput').value = '';
    });

    results.appendChild(item);
  });

  results.classList.add('open');
}

function escapeRegExp(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function renderToolbar() {
  const toolbar = document.getElementById('toolbar');
  toolbar.innerHTML = '';

  (CONTENT.toolbar || []).forEach(item => {
    const btn = document.createElement('button');
    btn.className = 'toolbar-btn';
    btn.type = 'button';
    btn.title = item.label;
    btn.setAttribute('aria-label', item.label);

    const span = document.createElement('span');
    span.className = 'toolbar-icon';
    span.textContent = item.icon;
    btn.appendChild(span);

    if (item.id === 'notesModal') {
      btn.id = 'notesBtn';
    } else {
      btn.dataset.modal = item.id;
    }

    toolbar.appendChild(btn);
  });
}

// ---------- Modal open/close ----------
function setupNotesAndModals() {
  const modalTriggers = document.querySelectorAll('[data-modal]');
  const notesBtn = document.getElementById('notesBtn');
  const notesModal = document.getElementById('notesModal');

  function openModal(modal) {
    modal.classList.add('open');
  }

  function closeModal(modal) {
    modal.classList.remove('open');
  }

  modalTriggers.forEach(trigger => {
    trigger.addEventListener('click', () => {
      const modal = document.getElementById(trigger.dataset.modal);
      if (modal) openModal(modal);
    });
  });

  if (notesBtn) {
    notesBtn.addEventListener('click', () => openModal(notesModal));
  }

  document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) closeModal(overlay);
    });
    overlay.querySelectorAll('[data-close]').forEach(btn => {
      btn.addEventListener('click', () => closeModal(overlay));
    });
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      document.querySelectorAll('.modal-overlay.open').forEach(closeModal);
    }
  });

  // ---------- Notes (localStorage, per-device) ----------
  const notesArea = document.getElementById('notesArea');
  const notesStatus = document.getElementById('notesStatus');
  const notesSave = document.getElementById('notesSave');

  try {
    const saved = localStorage.getItem('phoenix-notes');
    if (saved) notesArea.value = saved;
  } catch (e) { /* ignore */ }

  notesSave.addEventListener('click', () => {
    try {
      localStorage.setItem('phoenix-notes', notesArea.value);
      notesStatus.textContent = 'Saved';
      setTimeout(() => { notesStatus.textContent = ''; }, 1500);
    } catch (e) {
      notesStatus.textContent = 'Could not save';
    }
  });
}

// ---------- Page load ----------
document.addEventListener('DOMContentLoaded', () => {
  loadContent();
});

// ---------- Calculator option population ----------
function populateCalculatorOptions() {
  const rates = CONTENT.rates;

  // DHJ Voucher hours dropdown
  const ccHours = document.getElementById('cc-hours');
  ccHours.innerHTML = '';
  Object.keys(rates.dhjVouchers).forEach((hrs, i) => {
    const opt = document.createElement('option');
    opt.value = hrs;
    opt.textContent = `${hrs} hours, pay $${rates.dhjVouchers[hrs]} today`;
    if (i === 2) opt.selected = true; // default to 4hrs (3rd item)
    ccHours.appendChild(opt);
  });

  // Membership fee dropdown (shared by DHJ and Negotiation)
  const ccMF = document.getElementById('cc-membership-fee');
  const negMF = document.getElementById('neg-mf');
  ccMF.innerHTML = '';
  negMF.innerHTML = '';
  rates.membershipFees.forEach((fee, i) => {
    const label = i === 0 ? `$${fee}/mo (standard)` : i === rates.membershipFees.length - 1 ? `$${fee}/mo (final negotiation)` : `$${fee}/mo`;
    [ccMF, negMF].forEach(select => {
      const opt = document.createElement('option');
      opt.value = fee;
      opt.textContent = label;
      if (i === 0) opt.selected = true;
      select.appendChild(opt);
    });
  });

  // Frequency dropdown
  const ccFreq = document.getElementById('cc-frequency');
  ccFreq.innerHTML = '';
  rates.frequencies.forEach((f, i) => {
    const opt = document.createElement('option');
    opt.value = f;
    opt.textContent = `${f}x / month`;
    if (i === 1) opt.selected = true; // default 2x
    ccFreq.appendChild(opt);
  });

  // ETF hours dropdown (reuse DHJ voucher hours)
  const etfHours = document.getElementById('etf-hours');
  etfHours.innerHTML = '';
  Object.keys(rates.dhjVouchers).forEach((hrs, i) => {
    const opt = document.createElement('option');
    opt.value = hrs;
    opt.textContent = `${hrs} hours`;
    if (i === 2) opt.selected = true;
    etfHours.appendChild(opt);
  });
  document.getElementById('etf-sub').textContent = `Early Termination Fee: $${rates.etfRate}/hr`;

  // Commitment term dropdown
  const negTerm = document.getElementById('neg-term');
  negTerm.innerHTML = '';
  rates.commitmentTerms.forEach((term, i) => {
    const opt = document.createElement('option');
    opt.value = term;
    let label = `${term} months`;
    if (i === 0) label += ' (standard)';
    if (i === rates.commitmentTerms.length - 1) label += ' (special case)';
    opt.textContent = label;
    if (i === 0) opt.selected = true;
    negTerm.appendChild(opt);
  });

  attachCalculatorHandlers();
}

// ---------- DHJ Voucher Calculator ----------
function attachCalculatorHandlers() {
  const rates = CONTENT.rates;

  document.getElementById('cc-calculate').addEventListener('click', () => {
    const hours = document.getElementById('cc-hours').value;
    const membershipFee = parseFloat(document.getElementById('cc-membership-fee').value);
    const frequency = parseInt(document.getElementById('cc-frequency').value, 10);

    const voucherPrice = rates.dhjVouchers[hours];
    const nationalAvg = rates.nationalAvg[hours];
    const etf = parseFloat(hours) * rates.etfRate;
    const membershipRate = rates.membershipDiscountedRate;

    const perVisitDiscounted = parseFloat(hours) * membershipRate;
    const monthlyCleaningCost = perVisitDiscounted * frequency;
    const monthlyTotal = monthlyCleaningCost + membershipFee;

    const resultBox = document.getElementById('cc-result');
    resultBox.innerHTML = `
      <p class="result-label">ForeverClean Quote</p>
      <div class="result-row"><span>First cleaning</span><span>${hours} hrs</span></div>
      <div class="result-row"><span>Regular price (national avg)</span><span>$${nationalAvg.toFixed(2)}</span></div>
      <div class="result-row total"><span>Pay today (first cleaning)</span><span>$${voucherPrice.toFixed(2)}</span></div>
      <div class="result-row"><span>Discounted rate after membership</span><span>$${membershipRate.toFixed(2)}/hr</span></div>
      <div class="result-row"><span>Cost per future visit</span><span>$${perVisitDiscounted.toFixed(2)}</span></div>
      <div class="result-row"><span>Visits per month</span><span>${frequency}x</span></div>
      <div class="result-row"><span>Membership fee</span><span>$${membershipFee.toFixed(2)}/mo</span></div>
      <div class="result-row total"><span>Estimated monthly total</span><span>$${monthlyTotal.toFixed(2)}</span></div>
      <div class="result-row"><span>ETF if cancelled early ($${rates.etfRate}/hr)</span><span>$${etf.toFixed(2)}</span></div>
    `;
  });

  // ---------- ETF Calculator ----------
  document.getElementById('etf-calculate').addEventListener('click', () => {
    const hours = parseFloat(document.getElementById('etf-hours').value);
    const etfAmount = hours * rates.etfRate;

    const resultBox = document.getElementById('etf-result');
    resultBox.innerHTML = `
      <p class="result-label">ETF Result</p>
      <div class="result-row"><span>First cleaning hours</span><span>${hours} hrs</span></div>
      <div class="result-row"><span>ETF rate</span><span>$${rates.etfRate.toFixed(2)}/hr</span></div>
      <div class="result-row total"><span>Early Termination Fee</span><span>$${etfAmount.toFixed(2)}</span></div>
    `;
  });

  // ---------- One-Time / Trial Calculator ----------
  document.getElementById('ot-calculate').addEventListener('click', () => {
    const hours = parseFloat(document.getElementById('ot-hours').value) || 0;

    const regularTotal = hours * rates.oneTimeRate;
    const trialTotal = hours * rates.trialRate;
    const discountedTotal = hours * rates.discountedRate;
    const discountAvailable = !rates.discountedUnavailableHours.includes(hours);

    const resultBox = document.getElementById('ot-result');
    let html = `
      <p class="result-label">Options for ${hours.toFixed(2)} hrs</p>
      <div class="ot-option">
        <span class="ot-label">Trial Cleaning: $${rates.trialRate.toFixed(2)}/hr (30-day trial)</span>
        <span class="ot-price">$${trialTotal.toFixed(2)}</span>
      </div>
      <div class="ot-option">
        <span class="ot-label">Regular Cleaning: $${rates.oneTimeRate.toFixed(2)}/hr (no commitment)</span>
        <span class="ot-price">$${regularTotal.toFixed(2)}</span>
      </div>
    `;

    if (discountAvailable) {
      html += `
      <div class="ot-option">
        <span class="ot-label">Regular Cleaning, Discounted: $${rates.discountedRate.toFixed(2)}/hr</span>
        <span class="ot-price">$${discountedTotal.toFixed(2)}</span>
      </div>
      `;
    } else {
      html += `<p class="result-placeholder" style="margin-top:8px;">Discounted rate ($${rates.discountedRate.toFixed(2)}/hr) not available at ${hours} hrs. Minimum 3 hrs.</p>`;
    }

    resultBox.innerHTML = html;
  });

  // ---------- Negotiation Calculator ----------
  document.getElementById('neg-calculate').addEventListener('click', () => {
    const membershipFee = parseFloat(document.getElementById('neg-mf').value) || 0;
    const term = parseInt(document.getElementById('neg-term').value, 10);

    const total = membershipFee * term;

    const resultBox = document.getElementById('neg-result');
    resultBox.innerHTML = `
      <p class="result-label">Negotiation Result</p>
      <div class="result-row"><span>Membership fee</span><span>$${membershipFee.toFixed(2)}/mo</span></div>
      <div class="result-row"><span>Commitment term</span><span>${term} months</span></div>
      <div class="result-row total"><span>Total over term</span><span>$${total.toFixed(2)}</span></div>
    `;
  });
}
