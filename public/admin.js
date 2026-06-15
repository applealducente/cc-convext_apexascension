let CONTENT = null;
let ADMIN_PASSWORD = '';

const loginScreen = document.getElementById('loginScreen');
const dashboard = document.getElementById('dashboard');
const passwordInput = document.getElementById('passwordInput');
const loginBtn = document.getElementById('loginBtn');
const loginError = document.getElementById('loginError');
const saveStatus = document.getElementById('saveStatus');

// ---------- Login ----------
loginBtn.addEventListener('click', attemptLogin);
passwordInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') attemptLogin();
});

async function attemptLogin() {
  const password = passwordInput.value;
  loginError.textContent = '';

  try {
    const res = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    });
    const data = await res.json();

    if (!res.ok) {
      loginError.textContent = data.error || 'Incorrect password.';
      return;
    }

    ADMIN_PASSWORD = password;
    sessionStorage.setItem('phoenix-admin-pw', password);
    loginScreen.hidden = true;
    dashboard.hidden = false;
    loadContentForEditing();
  } catch (err) {
    loginError.textContent = 'Could not reach the server. Try again.';
  }
}

// Auto-login if password is already in session storage
const storedPw = sessionStorage.getItem('phoenix-admin-pw');
if (storedPw) {
  passwordInput.value = storedPw;
  attemptLogin();
}

// ---------- Logout ----------
document.getElementById('logoutBtn').addEventListener('click', () => {
  sessionStorage.removeItem('phoenix-admin-pw');
  ADMIN_PASSWORD = '';
  dashboard.hidden = true;
  loginScreen.hidden = false;
  passwordInput.value = '';
});

// ---------- Section nav ----------
document.querySelectorAll('.admin-section-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.admin-section-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.admin-section').forEach(s => s.classList.remove('active'));
    tab.classList.add('active');
    document.getElementById('section-' + tab.dataset.section).classList.add('active');
  });
});

// ---------- Load content ----------
async function loadContentForEditing() {
  try {
    const res = await fetch('/api/content');
    CONTENT = await res.json();
  } catch (err) {
    const res = await fetch('/content.json');
    CONTENT = await res.json();
  }
  renderTabsEditor();
  renderRatesEditor();
  renderToolbarEditor();
}

// ===================== TABS & SCRIPTS =====================

function renderTabsEditor() {
  const list = document.getElementById('tabsList');
  list.innerHTML = '';

  CONTENT.tabs.forEach((tab, index) => {
    const card = document.createElement('div');
    card.className = 'tab-card';

    card.innerHTML = `
      <div class="tab-card-header">
        <h3>Tab ${index + 1}</h3>
      </div>
      <div class="tab-card-fields">
        <div class="form-row">
          <label>Nav label (shown on the pill button)</label>
          <input type="text" class="tab-label" value="${escapeAttr(tab.label)}">
        </div>
        <div class="form-row">
          <label>Page title (shown at top of the tab)</label>
          <input type="text" class="tab-title" value="${escapeAttr(tab.title)}">
        </div>
      </div>
      <label>Script content (HTML)</label>
      <textarea class="html-editor tab-html">${escapeHtml(tab.html)}</textarea>
      <div class="tab-card-actions">
        <button class="move-up" type="button">Move up</button>
        <button class="move-down" type="button">Move down</button>
        <button class="danger delete-tab" type="button">Delete tab</button>
      </div>
    `;

    card.querySelector('.tab-label').addEventListener('input', (e) => {
      tab.label = e.target.value;
    });
    card.querySelector('.tab-title').addEventListener('input', (e) => {
      tab.title = e.target.value;
    });
    card.querySelector('.tab-html').addEventListener('input', (e) => {
      tab.html = e.target.value;
    });

    card.querySelector('.move-up').addEventListener('click', () => {
      if (index === 0) return;
      const tmp = CONTENT.tabs[index - 1];
      CONTENT.tabs[index - 1] = CONTENT.tabs[index];
      CONTENT.tabs[index] = tmp;
      renderTabsEditor();
    });
    card.querySelector('.move-down').addEventListener('click', () => {
      if (index === CONTENT.tabs.length - 1) return;
      const tmp = CONTENT.tabs[index + 1];
      CONTENT.tabs[index + 1] = CONTENT.tabs[index];
      CONTENT.tabs[index] = tmp;
      renderTabsEditor();
    });
    card.querySelector('.delete-tab').addEventListener('click', () => {
      if (!confirm('Delete this tab? This cannot be undone until you reset to defaults.')) return;
      CONTENT.tabs.splice(index, 1);
      renderTabsEditor();
    });

    list.appendChild(card);
  });
}

document.getElementById('addTabBtn').addEventListener('click', () => {
  const id = 'tab-' + Date.now();
  CONTENT.tabs.push({
    id,
    label: 'New Tab',
    title: 'New Tab',
    html: '<p class="hint">Add your script content here.</p>\n<div class="script-block">\n  <p>"Script text goes here."</p>\n</div>'
  });
  renderTabsEditor();
});

// ===================== CALCULATOR RATES =====================

function renderRatesEditor() {
  const rates = CONTENT.rates;

  document.getElementById('rate-etf').value = rates.etfRate;
  document.getElementById('rate-membership-discounted').value = rates.membershipDiscountedRate;
  document.getElementById('rate-discounted').value = rates.discountedRate;
  document.getElementById('rate-onetime').value = rates.oneTimeRate;
  document.getElementById('rate-trial').value = rates.trialRate;
  document.getElementById('rate-unavailable').value = (rates.discountedUnavailableHours || []).join(', ');

  renderKvList('vouchersList', rates.dhjVouchers, 'Hours', 'Voucher price ($)');
  renderKvList('nationalAvgList', rates.nationalAvg, 'Hours', 'National avg price ($)');
  renderSimpleList('membershipFeesList', rates.membershipFees, 'Fee ($/mo)');
  renderSimpleList('frequenciesList', rates.frequencies, 'Visits/month');
  renderSimpleList('commitmentTermsList', rates.commitmentTerms, 'Months');

  // Live-sync simple rate fields back into CONTENT on input
  document.getElementById('rate-etf').addEventListener('input', (e) => {
    rates.etfRate = parseFloat(e.target.value) || 0;
  });
  document.getElementById('rate-membership-discounted').addEventListener('input', (e) => {
    rates.membershipDiscountedRate = parseFloat(e.target.value) || 0;
  });
  document.getElementById('rate-discounted').addEventListener('input', (e) => {
    rates.discountedRate = parseFloat(e.target.value) || 0;
  });
  document.getElementById('rate-onetime').addEventListener('input', (e) => {
    rates.oneTimeRate = parseFloat(e.target.value) || 0;
  });
  document.getElementById('rate-trial').addEventListener('input', (e) => {
    rates.trialRate = parseFloat(e.target.value) || 0;
  });
  document.getElementById('rate-unavailable').addEventListener('input', (e) => {
    rates.discountedUnavailableHours = e.target.value
      .split(',')
      .map(s => parseFloat(s.trim()))
      .filter(n => !isNaN(n));
  });
}

function renderKvList(containerId, obj, keyLabel, valueLabel) {
  const container = document.getElementById(containerId);
  container.innerHTML = '';

  Object.keys(obj).forEach((key) => {
    const row = document.createElement('div');
    row.className = 'kv-row';
    row.innerHTML = `
      <input type="text" class="kv-key" placeholder="${keyLabel}" value="${escapeAttr(key)}">
      <input type="number" step="0.01" class="kv-value" placeholder="${valueLabel}" value="${obj[key]}">
      <button type="button">Remove</button>
    `;

    const keyInput = row.querySelector('.kv-key');
    const valueInput = row.querySelector('.kv-value');

    keyInput.addEventListener('change', () => {
      const newKey = keyInput.value.trim();
      const oldKey = key;
      if (newKey && newKey !== oldKey) {
        const val = obj[oldKey];
        delete obj[oldKey];
        obj[newKey] = val;
        renderRatesEditor();
      }
    });

    valueInput.addEventListener('input', () => {
      obj[key] = parseFloat(valueInput.value) || 0;
    });

    row.querySelector('button').addEventListener('click', () => {
      delete obj[key];
      renderRatesEditor();
    });

    container.appendChild(row);
  });
}

document.getElementById('addVoucherBtn').addEventListener('click', () => {
  const rates = CONTENT.rates;
  let newKey = 'new';
  let i = 1;
  while (rates.dhjVouchers[newKey] !== undefined) {
    newKey = 'new' + i;
    i++;
  }
  rates.dhjVouchers[newKey] = 0;
  renderRatesEditor();
});

document.getElementById('addNationalAvgBtn').addEventListener('click', () => {
  const rates = CONTENT.rates;
  let newKey = 'new';
  let i = 1;
  while (rates.nationalAvg[newKey] !== undefined) {
    newKey = 'new' + i;
    i++;
  }
  rates.nationalAvg[newKey] = 0;
  renderRatesEditor();
});

function renderSimpleList(containerId, arr, valueLabel) {
  const container = document.getElementById(containerId);
  container.innerHTML = '';

  arr.forEach((val, index) => {
    const row = document.createElement('div');
    row.className = 'kv-row';
    row.innerHTML = `
      <input type="number" step="0.01" class="kv-value" placeholder="${valueLabel}" value="${val}" style="flex:1;">
      <button type="button">Remove</button>
    `;

    row.querySelector('.kv-value').addEventListener('input', (e) => {
      arr[index] = parseFloat(e.target.value) || 0;
    });

    row.querySelector('button').addEventListener('click', () => {
      arr.splice(index, 1);
      renderRatesEditor();
    });

    container.appendChild(row);
  });
}

document.getElementById('addMembershipFeeBtn').addEventListener('click', () => {
  CONTENT.rates.membershipFees.push(0);
  renderRatesEditor();
});
document.getElementById('addFrequencyBtn').addEventListener('click', () => {
  CONTENT.rates.frequencies.push(1);
  renderRatesEditor();
});
document.getElementById('addCommitmentTermBtn').addEventListener('click', () => {
  CONTENT.rates.commitmentTerms.push(1);
  renderRatesEditor();
});

// ===================== FOOTER BUTTONS (TOOLBAR) =====================

function renderToolbarEditor() {
  const container = document.getElementById('toolbarList');
  container.innerHTML = '';

  (CONTENT.toolbar || []).forEach((item, index) => {
    const row = document.createElement('div');
    row.className = 'toolbar-row';
    row.innerHTML = `
      <input type="text" class="tb-icon" placeholder="Icon" value="${escapeAttr(item.icon || '')}">
      <input type="text" class="tb-label" placeholder="Label / tooltip" value="${escapeAttr(item.label || '')}">
      <input type="text" class="tb-id" placeholder="Modal id (e.g. cleaningModal, notesModal)" value="${escapeAttr(item.id || '')}">
      <button type="button">Remove</button>
    `;

    row.querySelector('.tb-icon').addEventListener('input', (e) => { item.icon = e.target.value; });
    row.querySelector('.tb-label').addEventListener('input', (e) => { item.label = e.target.value; });
    row.querySelector('.tb-id').addEventListener('input', (e) => { item.id = e.target.value; });

    row.querySelector('button').addEventListener('click', () => {
      CONTENT.toolbar.splice(index, 1);
      renderToolbarEditor();
    });

    container.appendChild(row);
  });
}

document.getElementById('addToolbarBtn').addEventListener('click', () => {
  CONTENT.toolbar = CONTENT.toolbar || [];
  CONTENT.toolbar.push({ id: 'notesModal', label: 'New button', icon: '*' });
  renderToolbarEditor();
});

// ===================== SAVE / RESET =====================

document.getElementById('saveBtn').addEventListener('click', async () => {
  saveStatus.textContent = 'Saving...';

  try {
    const res = await fetch('/api/content', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: ADMIN_PASSWORD, content: CONTENT }),
    });
    const data = await res.json();

    if (!res.ok) {
      saveStatus.textContent = 'Error: ' + (data.error || 'failed to save');
      return;
    }

    saveStatus.textContent = 'Saved and live';
    setTimeout(() => { saveStatus.textContent = ''; }, 3000);
  } catch (err) {
    saveStatus.textContent = 'Error: could not reach server';
  }
});

document.getElementById('resetBtn').addEventListener('click', async () => {
  if (!confirm('Reset the live site to the default content from the repo? Any saved edits will be lost.')) return;

  saveStatus.textContent = 'Resetting...';

  try {
    const res = await fetch('/api/reset', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: ADMIN_PASSWORD }),
    });
    const data = await res.json();

    if (!res.ok) {
      saveStatus.textContent = 'Error: ' + (data.error || 'failed to reset');
      return;
    }

    saveStatus.textContent = 'Reset to defaults';
    loadContentForEditing();
    setTimeout(() => { saveStatus.textContent = ''; }, 3000);
  } catch (err) {
    saveStatus.textContent = 'Error: could not reach server';
  }
});

// ===================== Helpers =====================

function escapeHtml(str) {
  return (str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function escapeAttr(str) {
  return (str || '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
