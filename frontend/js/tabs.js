/**
 * ╔════════════════════════════════════════════════════════════╗
 * ║  MoneyPilot — tabs.js                                      ║
 * ║                                                            ║
 * ║  Responsibilities:                                         ║
 * ║   1. Tab switching (Dashboard / Analytics / Accounts)      ║
 * ║   2. Analytics insight cards                               ║
 * ║   3. Line chart (Income vs Expense trend)                  ║
 * ║   4. Accounts CRUD (localStorage)                          ║
 * ║   5. Dashboard insight banner                              ║
 * ║                                                            ║
 * ║  Depends on dashboard.js being loaded first for:           ║
 * ║    allTransactions, fmt, fmtDate, monthlyByType,           ║
 * ║    sumByType, categoryTotals, CHARTS, destroyChart,        ║
 * ║    TYPE, PIE_COLOURS                                       ║
 * ╚════════════════════════════════════════════════════════════╝
 */

'use strict';

/* ─────────────────────────────────────────────────────────────
   §A  TAB SWITCHING
───────────────────────────────────────────────────────────── */

/**
 * Switch visible tab.
 * Updates aria attributes, button states, and fires tab-specific
 * render functions only when their tab becomes active (lazy render).
 *
 * @param {string} targetId  — e.g. 'dashboard', 'analytics', 'accounts'
 */
function switchTab(targetId) {
  // Panels
  document.querySelectorAll('.tab-panel').forEach(panel => {
    panel.classList.toggle('tab-panel--active', panel.id === `tab-${targetId}`);
  });

  // Buttons
  document.querySelectorAll('.tab-btn').forEach(btn => {
    const active = btn.dataset.tab === targetId;
    btn.classList.toggle('tab-btn--active', active);
    btn.setAttribute('aria-selected', active ? 'true' : 'false');
  });

  // Tab-specific work
  if (targetId === 'analytics') {
    renderAnalyticsInsights();
    renderLineChart();
    // Re-draw pie + bar (they live in analytics tab in the new layout)
    if (typeof renderPieChart === 'function') renderPieChart();
    if (typeof renderBarChart === 'function') renderBarChart();
  }

  if (targetId === 'accounts') {
    refreshAccountsTab();
  }
}

/* Attach click listeners to all tab buttons */
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => switchTab(btn.dataset.tab));
});


/* ─────────────────────────────────────────────────────────────
   §B  ANALYTICS INSIGHT CARDS
───────────────────────────────────────────────────────────── */

function renderAnalyticsInsights() {
  renderTopCategory();
  renderMonthlyComparison();
  renderSavingsRate();
}

/** "Top Spending Category" card */
function renderTopCategory() {
  const el = document.getElementById('topCategory');
  if (!el) return;

  const { labels, values } = categoryTotals();
  if (!labels.length) { el.textContent = 'No expense data'; return; }

  const top = labels[0];
  const amt = values[0];
  el.innerHTML = `${top} &nbsp;<span style="color:var(--expense);font-size:0.9em">${fmt(amt)}</span>`;
}

/** "Monthly Spend vs Last Month" card */
function renderMonthlyComparison() {
  const el = document.getElementById('monthlyComparison');
  if (!el) return;

  // Current vs previous month expense
  const now       = new Date();
  const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const prev      = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastMonth = `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, '0')}`;

  const sum = key => allTransactions
    .filter(t => t.type === 'expense' && t.createdAt && t.createdAt.slice(0, 7) === key)
    .reduce((s, t) => s + (t.amount || 0), 0);

  const cur  = sum(thisMonth);
  const prev2 = sum(lastMonth);

  if (!prev2 && !cur) { el.textContent = 'Not enough data'; return; }
  if (!prev2)         { el.textContent = fmt(cur) + ' this month'; return; }

  const diff = cur - prev2;
  const pct  = ((Math.abs(diff) / prev2) * 100).toFixed(1);
  const sign = diff > 0 ? '↑' : '↓';
  const col  = diff > 0 ? 'var(--expense)' : 'var(--income)';
  el.innerHTML = `<span style="color:${col}">${sign} ${pct}%</span> vs last month`;
}

/** "Savings Rate" card */
function renderSavingsRate() {
  const el = document.getElementById('savingsRate');
  if (!el) return;

  const income  = sumByType('income');
  const saving  = sumByType('saving');

  if (!income) { el.textContent = 'No income data'; return; }
  const rate = ((saving / income) * 100).toFixed(1);
  const col  = rate >= 20 ? 'var(--income)' : rate >= 10 ? 'var(--gold)' : 'var(--expense)';
  el.innerHTML = `<span style="color:${col}">${rate}%</span> of income`;
}


/* ─────────────────────────────────────────────────────────────
   §C  LINE CHART — Income vs Expense over months
───────────────────────────────────────────────────────────── */

function renderLineChart() {
  destroyChart('line');
  const canvas = document.getElementById('lineChart');
  const empty  = document.getElementById('lineEmpty');
  if (!canvas) return;

  const incT = monthlyByType('income');
  const expT = monthlyByType('expense');

  // Union of all month labels
  const allLabels = [...new Set([...incT.labels, ...expT.labels])]
    .sort((a, b) => new Date('1 ' + a) - new Date('1 ' + b));

  if (!allLabels.length) {
    if (canvas) canvas.classList.add('hidden');
    if (empty)  empty.classList.remove('hidden');
    return;
  }
  if (canvas) canvas.classList.remove('hidden');
  if (empty)  empty.classList.add('hidden');

  const align = trend => {
    const m = new Map(trend.labels.map((l, i) => [l, trend.values[i]]));
    return allLabels.map(l => m.get(l) || 0);
  };

  CHARTS['line'] = new Chart(canvas, {
    type: 'line',
    data: {
      labels: allLabels,
      datasets: [
        {
          label: 'Income',
          data:  align(incT),
          borderColor:     TYPE.income.solid,
          backgroundColor: TYPE.income.dim,
          borderWidth: 2,
          tension: 0.4,
          fill: true,
          pointRadius: 3,
          pointHoverRadius: 6,
          pointBackgroundColor: TYPE.income.solid,
        },
        {
          label: 'Expenses',
          data:  align(expT),
          borderColor:     TYPE.expense.solid,
          backgroundColor: TYPE.expense.dim,
          borderWidth: 2,
          tension: 0.4,
          fill: true,
          pointRadius: 3,
          pointHoverRadius: 6,
          pointBackgroundColor: TYPE.expense.solid,
        },
      ],
    },
    options: {
      responsive:          true,
      maintainAspectRatio: false,
      animation:           { duration: 600, easing: 'easeInOutCubic' },
      plugins: {
        legend: {
          position: 'top', align: 'end',
          labels: {
            color: '#8b8fa8',
            font:  { family: "'Instrument Sans'", size: 11 },
            padding: 16,
            usePointStyle: true,
            pointStyleWidth: 7,
          },
        },
        tooltip: {
          backgroundColor: '#1a1d27',
          titleColor:      '#e2e4f0',
          bodyColor:       '#8b8fa8',
          borderColor:     'rgba(255,255,255,0.07)',
          borderWidth:     1,
          padding:         12,
          callbacks: { label: ctx => ` ${fmt(ctx.parsed.y)}` },
        },
      },
      scales: {
        x: {
          grid:   { color: 'rgba(255,255,255,0.04)' },
          ticks:  { color: '#6b6f85', font: { size: 11, family: "'Instrument Sans'" } },
          border: { color: 'transparent' },
        },
        y: {
          grid:   { color: 'rgba(255,255,255,0.04)' },
          ticks:  { color: '#6b6f85', font: { size: 11, family: "'Instrument Sans'" }, callback: v => `$${v}` },
          border: { color: 'transparent' },
          beginAtZero: true,
        },
      },
    },
  });
}

/* Register line chart in CHARTS registry (dashboard.js already has the others) */
if (typeof CHARTS !== 'undefined') {
  CHARTS['line'] = null;
}


/* ─────────────────────────────────────────────────────────────
   §D  DASHBOARD INSIGHT BANNER
───────────────────────────────────────────────────────────── */

/**
 * Show a contextual insight at the top of the Dashboard tab.
 * Runs after allTransactions is populated.
 */
function renderInsightBanner() {
  const el = document.getElementById('insightText');
  if (!el) return;

  const income  = sumByType('income');
  const expense = sumByType('expense');
  const saving  = sumByType('saving');
  const balance = income - expense - saving;

  if (!income && !expense) {
    el.innerHTML = 'Welcome! Add your first transaction to get started.';
    return;
  }

  // Pick most relevant insight
  const { labels: catLabels, values: catValues } = categoryTotals();
  const topCat = catLabels[0];
  const topAmt = catValues[0];

  const now       = new Date();
  const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const prev      = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastMonth = `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, '0')}`;

  const monthExpense = key => allTransactions
    .filter(t => t.type === 'expense' && t.createdAt && t.createdAt.slice(0, 7) === key)
    .reduce((s, t) => s + (t.amount || 0), 0);

  const cur  = monthExpense(thisMonth);
  const prv  = monthExpense(lastMonth);
  const diff = cur - prv;

  let msg = '';

  if (prv && Math.abs(diff) > 1) {
    const dir  = diff > 0 ? 'more' : 'less';
    const col  = diff > 0 ? 'var(--expense)' : 'var(--income)';
    msg = `You spent <strong style="color:${col}">${fmt(Math.abs(diff))} ${dir}</strong> than last month.`;
  } else if (topCat) {
    msg = `Your biggest spend category is <strong>${topCat}</strong> at <strong style="color:var(--expense)">${fmt(topAmt)}</strong>.`;
  } else if (balance >= 0) {
    msg = `Your current balance is <strong style="color:var(--income)">${fmt(balance)}</strong>. Keep it up!`;
  } else {
    msg = `Your expenses exceed income by <strong style="color:var(--expense)">${fmt(Math.abs(balance))}</strong>. Consider reviewing your spending.`;
  }

  el.innerHTML = msg;
}


/* ─────────────────────────────────────────────────────────────
   §E  ACCOUNTS (localStorage-backed)
───────────────────────────────────────────────────────────── */

const ACCOUNTS_KEY      = 'mp_accounts';
const TRANSFER_LOG_KEY  = 'mp_transfer_log';

const ACCT_META = {
  bank:       { emoji: '🏦', label: 'Bank Account',  color: '#4e8ef7', colorDim: 'rgba(78,142,247,0.08)'  },
  cash:       { emoji: '💵', label: 'Cash',           color: '#0ecb81', colorDim: 'rgba(14,203,129,0.08)' },
  wallet:     { emoji: '👛', label: 'Wallet',         color: '#f0b429', colorDim: 'rgba(240,180,41,0.08)' },
  investment: { emoji: '📈', label: 'Investment',     color: '#a78bfa', colorDim: 'rgba(167,139,250,0.08)'},
};

/* ── State ── */
let acctViewMode = 'grid'; // 'grid' | 'list'

/* ── Storage helpers ── */
function loadAccounts() {
  try { return JSON.parse(localStorage.getItem(ACCOUNTS_KEY)) || getDefaultAccounts(); }
  catch { return getDefaultAccounts(); }
}
function saveAccounts(arr) { localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(arr)); }

function loadTransferLog() {
  try { return JSON.parse(localStorage.getItem(TRANSFER_LOG_KEY)) || []; }
  catch { return []; }
}
function saveTransferLog(arr) { localStorage.setItem(TRANSFER_LOG_KEY, JSON.stringify(arr)); }

function getDefaultAccounts() {
  return [
    { id: 'acc_cash',   name: 'Cash',   type: 'cash',   balance: 0, color: '#0ecb81' },
    { id: 'acc_bank',   name: 'Bank',   type: 'bank',   balance: 0, color: '#4e8ef7' },
    { id: 'acc_wallet', name: 'Wallet', type: 'wallet', balance: 0, color: '#f0b429' },
  ];
}

function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/* ── Net Worth Hero ── */
function renderNetworthHero() {
  const accounts = loadAccounts();
  const total    = accounts.reduce((s, a) => s + (a.balance || 0), 0);
  const count    = accounts.length;

  const totalEl = document.getElementById('networthTotal');
  const countEl = document.getElementById('networthCount');
  if (totalEl) totalEl.textContent = fmt(total);
  if (countEl) countEl.textContent = count;

  // Proportional bars
  const barsEl = document.getElementById('networthBars');
  if (!barsEl) return;

  if (!accounts.length || total === 0) {
    barsEl.innerHTML = '<p style="font-size:0.78rem;color:var(--text-muted)">No accounts yet</p>';
    return;
  }

  barsEl.innerHTML = accounts.map(a => {
    const meta = ACCT_META[a.type] || { color: '#888' };
    const color = a.color || meta.color;
    const pct   = total > 0 ? Math.max(2, (a.balance / total) * 100) : 0;
    return `
      <div class="nw-bar-row">
        <span class="nw-bar-label">${escHtml(a.name)}</span>
        <div class="nw-bar-track">
          <div class="nw-bar-fill" style="width:${pct.toFixed(1)}%;background:${color}"></div>
        </div>
        <span class="nw-bar-amount">${fmt(a.balance)}</span>
      </div>`;
  }).join('');
}

/* ── Summary Strip (type totals) ── */
function renderSummaryStrip() {
  const el = document.getElementById('acctSummaryStrip');
  if (!el) return;

  const types = ['bank', 'cash', 'wallet', 'investment'];
  const accounts = loadAccounts();

  el.innerHTML = types.map(t => {
    const meta  = ACCT_META[t];
    const total = accounts.filter(a => a.type === t).reduce((s, a) => s + (a.balance || 0), 0);
    return `
      <div class="acct-summary-chip">
        <span class="acct-summary-chip__emoji">${meta.emoji}</span>
        <div class="acct-summary-chip__info">
          <span class="acct-summary-chip__label">${meta.label}</span>
          <span class="acct-summary-chip__val">${fmt(total)}</span>
        </div>
      </div>`;
  }).join('');
}

/* ── Account Cards ── */
function renderAccountCards() {
  const grid = document.getElementById('accountsGrid');
  if (!grid) return;

  const accounts = loadAccounts();

  // Apply view mode
  grid.className = `accounts-grid${acctViewMode === 'list' ? ' accounts-grid--list' : ''}`;

  if (!accounts.length) {
    grid.innerHTML = `
      <div class="accounts-empty">
        <span class="accounts-empty__icon">🏦</span>
        <p class="accounts-empty__title">No accounts yet</p>
        <p>Click "Add Account" to get started</p>
      </div>`;
    renderNetworthHero();
    renderSummaryStrip();
    populateTransferSelects();
    return;
  }

  grid.innerHTML = accounts.map((a, idx) => {
    const meta     = ACCT_META[a.type] || { emoji: '💳', label: a.type, color: '#888', colorDim: 'rgba(136,136,136,0.08)' };
    const color    = a.color || meta.color;
    const colorDim = hexToRgba(color, 0.08);
    return `
      <div class="acct-card" style="--acct-color:${color};--acct-color-dim:${colorDim};animation-delay:${idx * 60}ms">
        <div class="acct-card__header">
          <div class="acct-card__emoji-wrap">${meta.emoji}</div>
          <button class="acct-card__menu-btn btn-acct-del" data-id="${a.id}" title="Remove account">✕</button>
        </div>
        <p class="acct-card__name">${escHtml(a.name)}</p>
        <span class="acct-card__type-badge">${meta.label}</span>
        <p class="acct-card__balance">${fmt(a.balance)}</p>
        <p class="acct-card__balance-label">Current Balance</p>
        <div class="acct-card__footer">
          <button class="acct-card__action-btn btn-acct-topup" data-id="${a.id}">＋ Top Up</button>
          <button class="acct-card__action-btn btn-acct-withdraw" data-id="${a.id}">－ Withdraw</button>
          <button class="acct-card__action-btn acct-card__action-btn--danger btn-acct-del" data-id="${a.id}">✕</button>
        </div>
      </div>`;
  }).join('');

  // Delete
  grid.querySelectorAll('.btn-acct-del').forEach(btn => {
    btn.addEventListener('click', () => {
      const updated = loadAccounts().filter(a => a.id !== btn.dataset.id);
      saveAccounts(updated);
      refreshAccountsTab();
    });
  });

  // Top Up
  grid.querySelectorAll('.btn-acct-topup').forEach(btn => {
    btn.addEventListener('click', () => promptAdjustBalance(btn.dataset.id, 'topup'));
  });

  // Withdraw
  grid.querySelectorAll('.btn-acct-withdraw').forEach(btn => {
    btn.addEventListener('click', () => promptAdjustBalance(btn.dataset.id, 'withdraw'));
  });

  renderNetworthHero();
  renderSummaryStrip();
  populateTransferSelects();
}

/* ── Balance Adjust (inline prompt) ── */
function promptAdjustBalance(id, mode) {
  const accounts = loadAccounts();
  const acct     = accounts.find(a => a.id === id);
  if (!acct) return;

  const label  = mode === 'topup' ? 'Top up' : 'Withdraw';
  const rawAmt = window.prompt(`${label} amount for "${acct.name}" ($):`, '');
  const amt    = parseFloat(rawAmt);

  if (!rawAmt || isNaN(amt) || amt <= 0) return;

  if (mode === 'topup') {
    acct.balance = (acct.balance || 0) + amt;
  } else {
    const newBal = (acct.balance || 0) - amt;
    if (newBal < 0) {
      showToast('Insufficient balance.', 'error');
      return;
    }
    acct.balance = newBal;
  }

  saveAccounts(accounts);
  showToast(`${label} of ${fmt(amt)} applied ✓`);
  refreshAccountsTab();
}

/* ── Transfer Selects ── */
function populateTransferSelects() {
  const accounts = loadAccounts();
  const opts     = ['<option value="">Select account</option>',
    ...accounts.map(a => `<option value="${a.id}">${escHtml(a.name)} (${fmt(a.balance)})</option>`)
  ].join('');

  const from = document.getElementById('transferFrom');
  const to   = document.getElementById('transferTo');
  if (from) from.innerHTML = opts;
  if (to)   to.innerHTML   = opts;
}

/* ── Transfer Log ── */
function renderTransferLog() {
  const list  = document.getElementById('transferLogList');
  const empty = document.getElementById('transferLogEmpty');
  if (!list) return;

  const log = loadTransferLog();

  if (!log.length) {
    list.innerHTML = '';
    empty?.classList.remove('hidden');
    return;
  }
  empty?.classList.add('hidden');

  list.innerHTML = [...log].reverse().slice(0, 10).map((entry, i) => `
    <li class="transfer-log-item" style="animation-delay:${i * 40}ms">
      <span class="transfer-log-arrow">→</span>
      <div class="transfer-log-desc">
        <span class="transfer-log-route">${escHtml(entry.fromName)} → ${escHtml(entry.toName)}</span>
        <span class="transfer-log-date">${entry.date}</span>
      </div>
      <span class="transfer-log-amount">${fmt(entry.amount)}</span>
    </li>`).join('');
}

/* ── Do Transfer ── */
document.getElementById('doTransferBtn')?.addEventListener('click', () => {
  const fromId = document.getElementById('transferFrom')?.value;
  const toId   = document.getElementById('transferTo')?.value;
  const amount = parseFloat(document.getElementById('transferAmount')?.value);
  const msgEl  = document.getElementById('transferMessage');

  const showMsg = (text, cls = 'error') => {
    if (!msgEl) return;
    msgEl.textContent = text;
    msgEl.className   = `form-message form-message--${cls} form-message--show`;
    setTimeout(() => { msgEl.className = 'form-message'; msgEl.textContent = ''; }, 3000);
  };

  if (!fromId)          { showMsg('Select a source account.'); return; }
  if (!toId)            { showMsg('Select a destination account.'); return; }
  if (fromId === toId)  { showMsg('Cannot transfer to the same account.'); return; }
  if (!amount || amount <= 0) { showMsg('Enter a valid amount.'); return; }

  const accounts = loadAccounts();
  const from     = accounts.find(a => a.id === fromId);
  const to       = accounts.find(a => a.id === toId);
  if (!from || !to) return;

  if ((from.balance || 0) < amount) { showMsg('Insufficient balance in source account.'); return; }

  from.balance = (from.balance || 0) - amount;
  to.balance   = (to.balance   || 0) + amount;
  saveAccounts(accounts);

  // Log
  const log = loadTransferLog();
  log.push({
    fromName: from.name,
    toName:   to.name,
    amount,
    date: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
  });
  saveTransferLog(log);

  showMsg('Transfer successful!', 'success');
  showToast(`Transferred ${fmt(amount)} → ${to.name} ✓`);
  document.getElementById('transferAmount').value = '';
  refreshAccountsTab();
});

/* ── Swap transfer selects ── */
document.getElementById('swapTransferBtn')?.addEventListener('click', () => {
  const from = document.getElementById('transferFrom');
  const to   = document.getElementById('transferTo');
  if (!from || !to) return;
  const tmp = from.value;
  from.value = to.value;
  to.value   = tmp;
});

/* ── Clear transfer log ── */
document.getElementById('clearTransferLog')?.addEventListener('click', () => {
  if (!confirm('Clear all transfer history?')) return;
  saveTransferLog([]);
  renderTransferLog();
});

/* ── Add Account Form ── */
let selectedColor = '#0ecb81';

// Type pills
document.querySelectorAll('.acct-type-pill').forEach(pill => {
  pill.addEventListener('click', () => {
    document.querySelectorAll('.acct-type-pill').forEach(p => p.classList.remove('acct-type-pill--active'));
    pill.classList.add('acct-type-pill--active');
    document.getElementById('acctType').value = pill.dataset.type;

    // Auto-set colour to match type default
    const meta = ACCT_META[pill.dataset.type];
    if (meta) {
      selectedColor = meta.color;
      document.getElementById('acctColor').value = selectedColor;
      document.querySelectorAll('.acct-color-dot').forEach(d => {
        d.classList.toggle('acct-color-dot--active', d.dataset.color === selectedColor);
      });
    }
  });
});

// Colour dots
document.querySelectorAll('.acct-color-dot').forEach(dot => {
  dot.addEventListener('click', () => {
    document.querySelectorAll('.acct-color-dot').forEach(d => d.classList.remove('acct-color-dot--active'));
    dot.classList.add('acct-color-dot--active');
    selectedColor = dot.dataset.color;
    document.getElementById('acctColor').value = selectedColor;
  });
});

// Open / close
document.getElementById('openAddAccount')?.addEventListener('click', () => {
  document.getElementById('addAccountPanel')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  document.getElementById('acctName')?.focus();
});

document.getElementById('cancelAccountBtn')?.addEventListener('click', clearAccountForm);

// Save
document.getElementById('saveAccountBtn')?.addEventListener('click', () => {
  const name    = document.getElementById('acctName')?.value.trim();
  const type    = document.getElementById('acctType')?.value;
  const balance = parseFloat(document.getElementById('acctBalance')?.value) || 0;
  const color   = document.getElementById('acctColor')?.value || '#0ecb81';
  const msgEl   = document.getElementById('acctFormMessage');

  const showMsg = (text, cls = 'error') => {
    if (!msgEl) return;
    msgEl.textContent = text;
    msgEl.className   = `form-message form-message--${cls} form-message--show`;
    setTimeout(() => { msgEl.className = 'form-message'; msgEl.textContent = ''; }, 3000);
  };

  if (!name) { showMsg('Enter an account name.'); return; }
  if (!type) { showMsg('Select an account type.'); return; }

  const accounts = loadAccounts();
  accounts.push({ id: `acc_${Date.now()}`, name, type, balance, color });
  saveAccounts(accounts);
  showMsg('Account added!', 'success');
  showToast(`"${name}" account created ✓`);
  clearAccountForm();
  refreshAccountsTab();
});

function clearAccountForm() {
  ['acctName', 'acctBalance'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  document.getElementById('acctType').value = '';
  document.querySelectorAll('.acct-type-pill').forEach(p => p.classList.remove('acct-type-pill--active'));
}

/* ── View toggle ── */
document.querySelectorAll('.acct-view-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.acct-view-btn').forEach(b => b.classList.remove('acct-view-btn--active'));
    btn.classList.add('acct-view-btn--active');
    acctViewMode = btn.dataset.view;
    renderAccountCards();
  });
});

/* ── Master refresh for accounts tab ── */
function refreshAccountsTab() {
  renderAccountCards();
  renderTransferLog();
}

/* ── Hex → rgba helper ── */
function hexToRgba(hex, alpha) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}


/* ─────────────────────────────────────────────────────────────
   §F  HOOK INTO DASHBOARD.JS RENDER CYCLE
───────────────────────────────────────────────────────────── */

/**
 * Patch renderAll() (defined in dashboard.js) so that whenever
 * transactions are reloaded, the insight banner and analytics
 * data update automatically — without touching dashboard.js.
 *
 * We wrap the original function rather than replacing it.
 */
(function patchRenderAll() {
  const original = window.renderAll;
  if (typeof original !== 'function') {
    // dashboard.js may not have run yet; defer
    document.addEventListener('DOMContentLoaded', patchRenderAll);
    return;
  }
  window.renderAll = function () {
    original();
    renderInsightBanner();

    // If analytics tab is currently active, refresh it too
    if (document.getElementById('tab-analytics')?.classList.contains('tab-panel--active')) {
      renderAnalyticsInsights();
      renderLineChart();
    }
  };
})();