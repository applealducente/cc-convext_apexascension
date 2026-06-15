// ---------- Load content and render the page ----------
let CONTENT = null;

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
}

function renderTabs() {
  const tabnav = document.getElementById('tabnav');
  const content = document.getElementById('content');
  const pageTitle = document.getElementById('pageTitle');

  tabnav.innerHTML = '';
  content.innerHTML = '';

  CONTENT.tabs.forEach((tab, index) => {
    const btn = document.createElement('button');
    btn.className = 'tab' + (index === 0 ? ' active' : '');
    btn.dataset.target = tab.id;
    btn.textContent = tab.label;
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById('panel-' + tab.id).classList.add('active');
      pageTitle.textContent = tab.label;
      window.scrollTo({ top: 0, behavior: 'instant' });
    });
    tabnav.appendChild(btn);

    const section = document.createElement('section');
    section.className = 'panel' + (index === 0 ? ' active' : '');
    section.id = 'panel-' + tab.id;
    section.innerHTML = `<h1>${tab.title}</h1>${tab.html}`;
    content.appendChild(section);
  });

  if (CONTENT.tabs.length > 0) {
    pageTitle.textContent = CONTENT.tabs[0].label;
  }
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

// ---------- Menu / Admin buttons ----------
document.addEventListener('DOMContentLoaded', () => {
  const menuBtn = document.getElementById('menuBtn');
  const tabnav = document.getElementById('tabnav');

  if (menuBtn && tabnav) {
    menuBtn.addEventListener('click', () => {
      tabnav.classList.toggle('hidden-on-mobile');
    });
  }

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
    opt.textContent = `${hrs} hours, $${rates.dhjVouchers[hrs]} voucher`;
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
      <p class="result-label">DHJ Voucher Quote</p>
      <div class="result-row"><span>First cleaning</span><span>${hours} hrs</span></div>
      <div class="result-row"><span>Regular price (national avg)</span><span>$${nationalAvg.toFixed(2)}</span></div>
      <div class="result-row total"><span>Voucher price (first cleaning)</span><span>$${voucherPrice.toFixed(2)}</span></div>
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
