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
    renderAccountCards();
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

const ACCOUNTS_KEY = 'mp_accounts';

const ACCT_META = {
  bank:       { emoji: '🏦', label: 'Bank Account' },
  cash:       { emoji: '💵', label: 'Cash' },
  wallet:     { emoji: '👛', label: 'Wallet' },
  investment: { emoji: '📈', label: 'Investment' },
};

/** Load accounts from localStorage */
function loadAccounts() {
  try {
    return JSON.parse(localStorage.getItem(ACCOUNTS_KEY)) || getDefaultAccounts();
  } catch {
    return getDefaultAccounts();
  }
}

/** Save accounts array to localStorage */
function saveAccounts(accounts) {
  localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(accounts));
}

/** First-time default accounts */
function getDefaultAccounts() {
  return [
    { id: 'acc_cash',   name: 'Cash',       type: 'cash',   balance: 0 },
    { id: 'acc_bank',   name: 'Bank',        type: 'bank',   balance: 0 },
    { id: 'acc_wallet', name: 'Wallet',      type: 'wallet', balance: 0 },
  ];
}

/** Render the accounts grid */
function renderAccountCards() {
  const grid = document.getElementById('accountsGrid');
  if (!grid) return;

  const accounts = loadAccounts();

  if (!accounts.length) {
    grid.innerHTML = `
      <div class="accounts-empty">
        <span class="accounts-empty__icon">🏦</span>
        <p>No accounts yet. Add one using the form.</p>
      </div>`;
    return;
  }

  grid.innerHTML = accounts.map((a, idx) => {
    const meta = ACCT_META[a.type] || { emoji: '💳', label: a.type };
    return `
      <div class="acct-card acct-card--${a.type}" style="animation-delay:${idx * 60}ms">
        <span class="acct-card__emoji">${meta.emoji}</span>
        <p class="acct-card__name">${escHtml(a.name)}</p>
        <p class="acct-card__type">${meta.label}</p>
        <p class="acct-card__balance">${fmt(a.balance)}</p>
        <div class="acct-card__actions">
          <button class="btn-acct-del" data-id="${a.id}" aria-label="Delete ${escHtml(a.name)}">
            ✕ Remove
          </button>
        </div>
      </div>`;
  }).join('');

  // Delete listeners
  grid.querySelectorAll('.btn-acct-del').forEach(btn => {
    btn.addEventListener('click', () => {
      const accounts = loadAccounts().filter(a => a.id !== btn.dataset.id);
      saveAccounts(accounts);
      renderAccountCards();
    });
  });
}

/** Simple HTML escape */
function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/* Add Account form toggle */
document.getElementById('openAddAccount')?.addEventListener('click', () => {
  const panel = document.getElementById('addAccountPanel');
  panel?.classList.remove('hidden');
  document.getElementById('acctName')?.focus();
});

document.getElementById('cancelAccountBtn')?.addEventListener('click', () => {
  document.getElementById('addAccountPanel')?.classList.add('hidden');
  clearAccountForm();
});

document.getElementById('saveAccountBtn')?.addEventListener('click', () => {
  const name    = document.getElementById('acctName')?.value.trim();
  const type    = document.getElementById('acctType')?.value;
  const balance = parseFloat(document.getElementById('acctBalance')?.value) || 0;
  const msgEl   = document.getElementById('acctFormMessage');

  const showMsg = (text, cls = 'error') => {
    if (!msgEl) return;
    msgEl.textContent = text;
    msgEl.className   = `form-message form-message--${cls} form-message--show`;
    setTimeout(() => { msgEl.className = 'form-message'; msgEl.textContent = ''; }, 3000);
  };

  if (!name) { showMsg('Please enter an account name.'); return; }
  if (!type) { showMsg('Please select an account type.'); return; }

  const accounts = loadAccounts();
  accounts.push({
    id:      `acc_${Date.now()}`,
    name,
    type,
    balance,
  });
  saveAccounts(accounts);
  renderAccountCards();

  showMsg('Account added!', 'success');
  document.getElementById('addAccountPanel')?.classList.add('hidden');
  clearAccountForm();
});

function clearAccountForm() {
  ['acctName', 'acctType', 'acctBalance'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
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