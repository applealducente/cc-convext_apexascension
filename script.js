// ---------- Tab nav switching ----------
const navItems = document.querySelectorAll('.tab[data-target]');
const panels = document.querySelectorAll('.panel');
const pageTitle = document.getElementById('pageTitle');

navItems.forEach(item => {
  item.addEventListener('click', () => {
    const target = item.dataset.target;

    navItems.forEach(n => n.classList.remove('active'));
    item.classList.add('active');

    panels.forEach(p => p.classList.toggle('active', p.id === target));

    pageTitle.textContent = item.textContent;

    window.scrollTo({ top: 0, behavior: 'instant' });
  });
});

// ---------- Modal open/close ----------
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

notesBtn.addEventListener('click', () => openModal(notesModal));

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

// ---------- Menu / Admin buttons (placeholder) ----------
const menuBtn = document.getElementById('menuBtn');
const adminBtn = document.getElementById('adminBtn');
const tabnav = document.getElementById('tabnav');

if (menuBtn && tabnav) {
  menuBtn.addEventListener('click', () => {
    tabnav.classList.toggle('hidden-on-mobile');
  });
}

if (adminBtn) {
  adminBtn.addEventListener('click', () => {
    alert('Admin tools are not yet set up for this guide.');
  });
}

// ---------- Pricing constants ----------
const ETF_RATE = 35; // $/hr, applies to DHJ Voucher offer
const DISCOUNTED_RATE = 57.75; // $/hr, Regular Cleaning Rate Discounted (25|25)
const ONE_TIME_RATE = 63; // $/hr, Regular Cleaning Rate (30|30)
const TRIAL_RATE = 52.5; // $/hr, Trial Cleaning Rate (20|20), 30-day trial

// Hours not available at the Discounted (25|25) tier
const DISCOUNTED_UNAVAILABLE_HOURS = [2, 2.5];

// DHJ Voucher pricing by hours
const DHJ_VOUCHERS = {
  2: 9,
  3: 19,
  4: 39,
  6: 79,
};

// National average reference price (approximate, for "regular price" framing)
const NATIONAL_AVG = {
  2: 150,
  3: 225,
  4: 300,
  6: 450,
};

// ---------- DHJ Voucher Calculator ----------
document.getElementById('cc-calculate').addEventListener('click', () => {
  const hours = parseInt(document.getElementById('cc-hours').value, 10);
  const membershipFee = parseInt(document.getElementById('cc-membership-fee').value, 10);
  const frequency = parseInt(document.getElementById('cc-frequency').value, 10);

  const voucherPrice = DHJ_VOUCHERS[hours];
  const nationalAvg = NATIONAL_AVG[hours];
  const etf = hours * ETF_RATE;
  const isDiscountUnavailable = DISCOUNTED_UNAVAILABLE_HOURS.includes(hours);

  const resultBox = document.getElementById('cc-result');

  if (isDiscountUnavailable) {
    resultBox.innerHTML = `
      <p class="result-label">DHJ Voucher Quote</p>
      <div class="result-row"><span>First cleaning</span><span>${hours} hrs</span></div>
      <div class="result-row"><span>Regular price (national avg)</span><span>$${nationalAvg.toFixed(2)}</span></div>
      <div class="result-row total"><span>Voucher price (first cleaning)</span><span>$${voucherPrice.toFixed(2)}</span></div>
      <div class="result-row"><span>ETF if cancelled early ($35/hr)</span><span>$${etf.toFixed(2)}</span></div>
      <p class="result-placeholder" style="margin-top:10px;">The $57.75/hr discounted rate isn't available at ${hours} hrs. Recommend 3 hrs or more for future cleanings, or quote a different duration.</p>
    `;
    return;
  }

  const perVisitDiscounted = hours * DISCOUNTED_RATE;
  const monthlyCleaningCost = perVisitDiscounted * frequency;
  const monthlyTotal = monthlyCleaningCost + membershipFee;

  resultBox.innerHTML = `
    <p class="result-label">DHJ Voucher Quote</p>
    <div class="result-row"><span>First cleaning</span><span>${hours} hrs</span></div>
    <div class="result-row"><span>Regular price (national avg)</span><span>$${nationalAvg.toFixed(2)}</span></div>
    <div class="result-row total"><span>Voucher price (first cleaning)</span><span>$${voucherPrice.toFixed(2)}</span></div>
    <div class="result-row"><span>Discounted rate after membership</span><span>$${DISCOUNTED_RATE.toFixed(2)}/hr</span></div>
    <div class="result-row"><span>Cost per future visit</span><span>$${perVisitDiscounted.toFixed(2)}</span></div>
    <div class="result-row"><span>Visits per month</span><span>${frequency}x</span></div>
    <div class="result-row"><span>Membership fee</span><span>$${membershipFee.toFixed(2)}/mo</span></div>
    <div class="result-row total"><span>Estimated monthly total</span><span>$${monthlyTotal.toFixed(2)}</span></div>
    <div class="result-row"><span>ETF if cancelled early ($35/hr)</span><span>$${etf.toFixed(2)}</span></div>
  `;
});

// ---------- ETF Calculator ----------
document.getElementById('etf-calculate').addEventListener('click', () => {
  const hours = parseInt(document.getElementById('etf-hours').value, 10);
  const etfAmount = hours * ETF_RATE;

  const resultBox = document.getElementById('etf-result');
  resultBox.innerHTML = `
    <p class="result-label">ETF Result</p>
    <div class="result-row"><span>First cleaning hours</span><span>${hours} hrs</span></div>
    <div class="result-row"><span>ETF rate</span><span>$${ETF_RATE.toFixed(2)}/hr</span></div>
    <div class="result-row total"><span>Early Termination Fee</span><span>$${etfAmount.toFixed(2)}</span></div>
  `;
});

// ---------- One-Time / Trial Calculator ----------
document.getElementById('ot-calculate').addEventListener('click', () => {
  const hours = parseFloat(document.getElementById('ot-hours').value) || 0;

  const regularTotal = hours * ONE_TIME_RATE;
  const trialTotal = hours * TRIAL_RATE;
  const discountedTotal = hours * DISCOUNTED_RATE;
  const discountAvailable = !DISCOUNTED_UNAVAILABLE_HOURS.includes(hours);

  const resultBox = document.getElementById('ot-result');
  let html = `
    <p class="result-label">Options for ${hours.toFixed(2)} hrs</p>
    <div class="ot-option">
      <span class="ot-label">Trial Cleaning: $${TRIAL_RATE.toFixed(2)}/hr (30-day trial)</span>
      <span class="ot-price">$${trialTotal.toFixed(2)}</span>
    </div>
    <div class="ot-option">
      <span class="ot-label">Regular Cleaning: $${ONE_TIME_RATE.toFixed(2)}/hr (no commitment)</span>
      <span class="ot-price">$${regularTotal.toFixed(2)}</span>
    </div>
  `;

  if (discountAvailable) {
    html += `
    <div class="ot-option">
      <span class="ot-label">Regular Cleaning, Discounted: $${DISCOUNTED_RATE.toFixed(2)}/hr</span>
      <span class="ot-price">$${discountedTotal.toFixed(2)}</span>
    </div>
    `;
  } else {
    html += `<p class="result-placeholder" style="margin-top:8px;">Discounted rate ($${DISCOUNTED_RATE.toFixed(2)}/hr) not available at ${hours} hrs. Minimum 3 hrs.</p>`;
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
