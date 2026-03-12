/**
 * ╔═══════════════════════════════════════════════════════════════╗
 * ║  MoneyPilot — dashboard.js  ·  Version 3                     ║
 * ╠═══════════════════════════════════════════════════════════════╣
 * ║                                                               ║
 * ║  MODULE MAP                                                   ║
 * ║  ──────────────────────────────────────────────────────────  ║
 * ║   §1  Config & state                                         ║
 * ║   §2  Utilities                                              ║
 * ║   §3  API layer         (no changes — same 3 endpoints)      ║
 * ║   §4  Data aggregation  (pure functions, no DOM/fetch)       ║
 * ║   §5  KPI cards         (Total Income / Expenses / …)        ║
 * ║   §6  Sparklines        (mini Chart.js line charts)          ║
 * ║   §7  Recent panel      (latest 5 with colour coding)        ║
 * ║   §8  Pie chart         (category spending mix)              ║
 * ║   §9  Bar chart         (monthly grouped bars)               ║
 * ║  §10  Full table        (all transactions + filters)         ║
 * ║  §11  Form handler      (POST /api/add-transaction)          ║
 * ║  §12  Master render & init                                   ║
 * ║                                                               ║
 * ║  API CONTRACT (unchanged — do NOT edit these URLs)           ║
 * ║   GET    /api/transactions                                   ║
 * ║   POST   /api/add-transaction                                ║
 * ║   DELETE /api/transaction/:id                                ║
 * ╚═══════════════════════════════════════════════════════════════╝
 */

'use strict';

/* ───────────────────────────────────────────────────────────────
   §1  CONFIG & STATE
─────────────────────────────────────────────────────────────── */

/** Base URL of your Express backend. Change port if needed. */
const BASE_URL = 'http://localhost:5000/api';

/** Single in-memory store populated by loadTransactions(). */
let allTransactions = [];

/**
 * Chart instance registry.
 *
 * Every Chart.js instance must be destroyed before being recreated
 * on the same canvas, otherwise Chart.js throws:
 *   "Canvas is already in use. Chart with ID N must be destroyed…"
 *
 * Storing them here lets destroyChart(key) handle that safely.
 */
const CHARTS = {
  sparkIncome:  null,
  sparkExpense: null,
  sparkSaving:  null,
  sparkBalance: null,
  pie:          null,
  bar:          null,
};

/**
 * Design tokens for each transaction type.
 * Shared by KPI cards, sparklines, recent list, and table rows
 * so every element that references "income" uses the same green.
 */
const TYPE = {
  income: {
    solid:  '#0ecb81',
    dim:    'rgba(14,203,129,0.13)',
    border: 'rgba(14,203,129,0.55)',
    sign:   '+',
    label:  'Income',
  },
  expense: {
    solid:  '#f6475f',
    dim:    'rgba(246,71,95,0.13)',
    border: 'rgba(246,71,95,0.55)',
    sign:   '-',
    label:  'Expense',
  },
  saving: {
    solid:  '#4e8ef7',
    dim:    'rgba(78,142,247,0.13)',
    border: 'rgba(78,142,247,0.55)',
    sign:   '~',
    label:  'Saving',
  },
  balance: {
    solid:  '#f0b429',
    dim:    'rgba(240,180,41,0.13)',
    border: 'rgba(240,180,41,0.55)',
    sign:   '',
    label:  'Balance',
  },
};

/** Chart.js colour palette for pie slices */
const PIE_COLOURS = [
  '#f0b429','#0ecb81','#4e8ef7','#f6475f',
  '#a78bfa','#fb923c','#34d399','#f472b6',
];

/* ───────────────────────────────────────────────────────────────
   §2  UTILITIES
─────────────────────────────────────────────────────────────── */

/** Format number as "$1,234.56" */
const fmt = n =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n || 0);

/** "Jun 12" */
const fmtDate = iso =>
  iso ? new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '—';

/** "Jun 2024" — used as display label for monthly grouping */
const fmtMonth = iso =>
  new Date(iso).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });

/** "2024-06" — sortable month key */
const monthKey = iso => {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

/** Show or hide an element via the .hidden class */
const setVisible = (el, v) => el && el.classList.toggle('hidden', !v);

/** Safely destroy a named Chart.js instance */
function destroyChart(key) {
  if (CHARTS[key]) { CHARTS[key].destroy(); CHARTS[key] = null; }
}

/** Show a toast notification */
function showToast(msg, type = 'success') {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.className = `toast toast--${type} toast--visible`;
  setTimeout(() => { el.className = 'toast'; }, 3000);
}

/** Show the inline form feedback message */
function showFormMsg(msg, type = 'success') {
  const el = document.getElementById('formMessage');
  el.textContent = msg;
  el.className = `form-message form-message--${type} form-message--show`;
  setTimeout(() => { el.className = 'form-message'; el.textContent = ''; }, 3200);
}

/** Toggle the header connection badge */
function setConnected(ok) {
  const pill = document.getElementById('statusPill');
  if (!pill) return;
  pill.classList.toggle('status-pill--offline', !ok);
  pill.querySelector('.status-label').textContent = ok ? 'Connected' : 'Offline';
}

/* ───────────────────────────────────────────────────────────────
   §3  API LAYER
   ─────────────────────────────────────────────────────────────
   These three functions are the ONLY place fetch() is called.
   All endpoints match the contract specified in the backend.
─────────────────────────────────────────────────────────────── */

/**
 * GET /api/transactions
 * Returns the full array of transaction documents from MongoDB.
 */
async function apiGetTransactions() {
  const res = await fetch(`${BASE_URL}/transactions`);
  if (!res.ok) throw new Error(`GET /transactions → HTTP ${res.status}`);
  return res.json();
}

/**
 * POST /api/add-transaction
 * @param {{ amount:number, type:string, category:string, note:string }} body
 */
async function apiAddTransaction(body) {
  const res = await fetch(`${BASE_URL}/add-transaction`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || `POST /add-transaction → HTTP ${res.status}`);
  }
  return res.json();
}

/**
 * DELETE /api/transaction/:id
 * @param {string} id  — MongoDB _id of the transaction to remove
 */
async function apiDeleteTransaction(id) {
  const res = await fetch(`${BASE_URL}/transaction/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error(`DELETE /transaction/${id} → HTTP ${res.status}`);
}

/* ───────────────────────────────────────────────────────────────
   §4  DATA AGGREGATION
   ─────────────────────────────────────────────────────────────
   Pure functions that derive chart/card data from allTransactions.
   No DOM, no fetch — easy to unit-test in isolation.
─────────────────────────────────────────────────────────────── */

/**
 * Sum the amounts for every transaction of a given type.
 * @param {'income'|'expense'|'saving'} type
 * @returns {number}
 */
function sumByType(type) {
  return allTransactions
    .filter(t => t.type === type)
    .reduce((s, t) => s + (t.amount || 0), 0);
}

/**
 * Group transactions by calendar month for a given type, returning
 * chronologically sorted labels and summed values.
 *
 * Used by:  drawSparkline()  (values only)
 *           renderBarChart() (labels + values for 3 types merged)
 *
 * @param {'income'|'expense'|'saving'} type
 * @param {number} [limit=8]  — return only the most recent N months
 * @returns {{ labels: string[], values: number[] }}
 */
function monthlyByType(type, limit = 8) {
  const map = new Map();
  allTransactions
    .filter(t => t.type === type && t.createdAt)
    .forEach(t => {
      const k = monthKey(t.createdAt);
      if (!map.has(k)) map.set(k, { label: fmtMonth(t.createdAt), total: 0 });
      map.get(k).total += (t.amount || 0);
    });

  const sorted = [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  const slice  = limit ? sorted.slice(-limit) : sorted;
  return { labels: slice.map(([, v]) => v.label), values: slice.map(([, v]) => v.total) };
}

/**
 * Compute a running cumulative balance per month.
 * balance[m] = Σ(income) − Σ(expense) − Σ(saving) up to month m.
 *
 * @param {number} [limit=8]
 * @returns {{ labels: string[], values: number[] }}
 */
function monthlyBalance(limit = 8) {
  const allKeys = new Set(
    allTransactions.filter(t => t.createdAt).map(t => monthKey(t.createdAt))
  );
  const sorted = [...allKeys].sort();

  const inc = monthlyByType('income', 0);
  const exp = monthlyByType('expense', 0);
  const sav = monthlyByType('saving', 0);

  const toMap = trend => new Map(trend.labels.map((l, i) => [l, trend.values[i]]));
  const iMap  = toMap(inc), eMap = toMap(exp), sMap = toMap(sav);

  let running = 0;
  const labels = [], values = [];
  sorted.forEach(k => {
    const lbl = fmtMonth(k + '-01');
    running += (iMap.get(lbl) || 0) - (eMap.get(lbl) || 0) - (sMap.get(lbl) || 0);
    labels.push(lbl);
    values.push(running);
  });

  return { labels: labels.slice(-limit), values: values.slice(-limit) };
}

/**
 * Group EXPENSE transactions by category, sorted by total descending.
 * Used by the pie chart.
 *
 * @returns {{ labels: string[], values: number[] }}
 */
function categoryTotals() {
  const map = new Map();
  allTransactions
    .filter(t => t.type === 'expense')
    .forEach(t => {
      const c = t.category || 'Other';
      map.set(c, (map.get(c) || 0) + (t.amount || 0));
    });
  const sorted = [...map.entries()].sort((a, b) => b[1] - a[1]);
  return { labels: sorted.map(([k]) => k), values: sorted.map(([, v]) => v) };
}

/**
 * Calculate the % change in a type's total between
 * the last 30 days and the 30 days before that.
 *
 * Returns: { pct: string, dir: 'up'|'down'|'flat' }
 */
function delta30d(type) {
  const now = Date.now(), day30 = 30 * 864e5;
  const sum = (lo, hi) => allTransactions
    .filter(t => {
      const age = now - new Date(t.createdAt).getTime();
      return t.type === type && age >= lo && age < hi;
    })
    .reduce((s, t) => s + (t.amount || 0), 0);

  const cur  = sum(0, day30);
  const prev = sum(day30, day30 * 2);
  if (!prev) return { pct: '—', dir: 'flat' };
  const p = ((cur - prev) / prev) * 100;
  return { pct: Math.abs(p).toFixed(1) + '%', dir: p > 0 ? 'up' : p < 0 ? 'down' : 'flat' };
}

/* ───────────────────────────────────────────────────────────────
   §5  KPI SUMMARY CARDS
   ─────────────────────────────────────────────────────────────
   WHERE TO PLACE IN HTML:
     <section class="kpi-grid"> … </section>
     The four article.kpi-card elements already exist in dashboard.html.

   This function simply sets textContent on existing ids.
   It does NOT create DOM nodes.
─────────────────────────────────────────────────────────────── */

/**
 * Render all four KPI card values and delta badges.
 * Reads allTransactions; no fetch needed.
 */
function renderKpiCards() {
  const income  = sumByType('income');
  const expense = sumByType('expense');
  const saving  = sumByType('saving');
  const balance = income - expense - saving;

  // Amounts
  setText('kpiIncome',  fmt(income));
  setText('kpiExpense', fmt(expense));
  setText('kpiSaving',  fmt(saving));

  const balEl = document.getElementById('kpiBalance');
  if (balEl) {
    balEl.textContent = fmt(balance);
    balEl.style.color = balance >= 0 ? TYPE.income.solid : TYPE.expense.solid;
  }

  // Delta badges — helper sets text + CSS modifier class
  setDeltaBadge('incomeDelta',  delta30d('income'));
  setDeltaBadge('expenseDelta', delta30d('expense'), /* invert= */ true);
  setDeltaBadge('savingDelta',  delta30d('saving'));

  const bdEl = document.getElementById('balanceDelta');
  if (bdEl) {
    bdEl.textContent = 'income − exp − sav';
    bdEl.className   = 'kpi-badge kpi-badge--balance';
  }
}

/** Set textContent on an element by id (null-safe) */
function setText(id, text) {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
}

/**
 * Update a delta badge element.
 * @param {string}  id        — element id
 * @param {{ pct, dir }}      — from delta30d()
 * @param {boolean} invert    — true for expense: "down" = good
 */
function setDeltaBadge(id, { pct, dir }, invert = false) {
  const el = document.getElementById(id);
  if (!el) return;
  if (dir === 'flat') { el.textContent = '— no change'; return; }
  const good   = invert ? dir === 'down' : dir === 'up';
  const arrow  = dir === 'up' ? '↑' : '↓';
  el.textContent = `${arrow} ${pct} vs 30d`;
  el.className   = `kpi-badge kpi-badge--${good ? 'good' : 'bad'}`;
}

/* ───────────────────────────────────────────────────────────────
   §6  SPARKLINE CHARTS
   ─────────────────────────────────────────────────────────────
   WHERE TO PLACE IN HTML:
     Inside each .kpi-card, a <div class="kpi-spark"> wraps a
     <canvas id="sparkIncome"> (and similarly for expense/saving/balance).
     The div gives Chart.js a fixed-height container.

   Each sparkline:
     • Is a Chart.js "line" chart
     • Has NO axes, NO grid, NO legend, NO labels
     • Uses a gradient fill for visual richness
     • Supports hover tooltips (formatted as currency)

   Key technical detail:
     destroyChart(key) must be called before Chart() to avoid
     "Canvas already in use" errors on re-render.
─────────────────────────────────────────────────────────────── */

/**
 * Shared Chart.js options object for all four sparklines.
 * Strips all decorative chrome — only the trend shape is visible.
 *
 * @param {object} color — one of TYPE.income / TYPE.expense / …
 */
function makeSparkOptions(color) {
  return {
    responsive:          true,
    maintainAspectRatio: false,
    animation:           { duration: 700, easing: 'easeInOutCubic' },
    plugins: {
      legend:  { display: false },
      tooltip: {
        enabled:         true,
        backgroundColor: '#1a1d27',
        titleColor:      '#e2e4f0',
        bodyColor:       '#8b8fa8',
        borderColor:     'rgba(255,255,255,0.07)',
        borderWidth:     1,
        padding:         8,
        callbacks: {
          title: () => '',
          label: ctx => ` ${fmt(ctx.parsed.y)}`,
        },
      },
    },
    scales: {
      x: { display: false },
      y: { display: false, beginAtZero: false },
    },
    elements: {
      line: {
        borderWidth: 2,
        tension:     0.42,   // slight smoothing
      },
      point: {
        radius:            0,
        hoverRadius:       4,
        hitRadius:         16,
        backgroundColor:   color.solid,
        borderColor:       '#0d0f18',
        hoverBorderWidth:  2,
      },
    },
    layout: { padding: { top: 2, bottom: 2, left: 0, right: 0 } },
  };
}

/**
 * Draw (or redraw) a single sparkline.
 *
 * @param {string}   key      — key in CHARTS registry
 * @param {string}   canvasId — id of the <canvas> element
 * @param {number[]} values   — monthly totals (from monthlyByType)
 * @param {object}   color    — from TYPE.*
 */
function drawSparkline(key, canvasId, values, color) {
  destroyChart(key);
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;

  /*
   * Pad to at least 6 points for a readable curve.
   * Slice to the last 6 months so all sparklines have the same density.
   */
  const data = values.length < 2
    ? new Array(6).fill(0).map((_, i) => (values[i] || 0))
    : values.slice(-6);

  CHARTS[key] = new Chart(canvas, {
    type: 'line',
    data: {
      labels: data.map((_, i) => i),  // invisible x-axis labels
      datasets: [{
        data,
        borderColor: color.solid,

        /*
         * Gradient fill: opaque at top → transparent at bottom.
         * The callback receives { chart } so we can build the gradient
         * after Chart.js has computed the chartArea dimensions.
         */
        backgroundColor(ctx) {
          const { chart }  = ctx;
          const { ctx: c, chartArea } = chart;
          if (!chartArea) return color.dim;
          const grad = c.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
          grad.addColorStop(0,   color.border);
          grad.addColorStop(0.7, color.dim);
          grad.addColorStop(1,   'rgba(0,0,0,0)');
          return grad;
        },
        fill: true,
      }],
    },
    options: makeSparkOptions(color),
  });
}

/**
 * Render all four sparklines from current allTransactions data.
 * Called as part of renderAll().
 */
function renderSparklines() {
  drawSparkline('sparkIncome',  'sparkIncome',  monthlyByType('income').values,  TYPE.income);
  drawSparkline('sparkExpense', 'sparkExpense', monthlyByType('expense').values, TYPE.expense);
  drawSparkline('sparkSaving',  'sparkSaving',  monthlyByType('saving').values,  TYPE.saving);
  drawSparkline('sparkBalance', 'sparkBalance', monthlyBalance().values,         TYPE.balance);
}

/* ───────────────────────────────────────────────────────────────
   §7  RECENT TRANSACTIONS PANEL
   ─────────────────────────────────────────────────────────────
   WHERE TO PLACE IN HTML:
     <div class="panel panel--recent">
       <ul class="recent-list" id="recentList"></ul>
       <p class="recent-empty hidden" id="recentEmpty">…</p>
     </div>

   Shows the 5 most recent transactions, sorted by createdAt desc.
   Each row is colour-coded via a CSS modifier class:
     .recent-item--income  → teal
     .recent-item--expense → red
     .recent-item--saving  → blue

   No extra API call — reads allTransactions (already fetched).
─────────────────────────────────────────────────────────────── */

/**
 * Render the "Recent Transactions" panel.
 * Relies entirely on allTransactions — zero additional fetches.
 */
function renderRecentTransactions() {
  const list    = document.getElementById('recentList');
  const empty   = document.getElementById('recentEmpty');
  const loader  = document.getElementById('recentLoader');

  setVisible(loader, false);
  if (!list) return;

  if (allTransactions.length === 0) {
    list.innerHTML = '';
    setVisible(empty, true);
    return;
  }
  setVisible(empty, false);

  // Sort newest first → take 5
  const recent = [...allTransactions]
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, 5);

  list.innerHTML = recent.map((t, i) => {
    const meta    = TYPE[t.type] || { label: t.type, sign: '', solid: '#888' };
    const amount  = `${meta.sign}${fmt(t.amount)}`;
    const typeKey = t.type || 'other';

    return `
      <li class="recent-item recent-item--${typeKey}"
          style="animation-delay:${i * 60}ms"
          role="listitem">

        <!-- Coloured type indicator circle -->
        <span class="recent-dot recent-dot--${typeKey}" aria-hidden="true">
          ${meta.sign || '·'}
        </span>

        <!-- Transaction info -->
        <div class="recent-info">
          <span class="recent-category">${t.category || 'Uncategorised'}</span>
          <span class="recent-note">${t.note || '—'}</span>
        </div>

        <!-- Amount + date -->
        <div class="recent-right">
          <span class="recent-amount recent-amount--${typeKey}">${amount}</span>
          <span class="recent-date">${fmtDate(t.createdAt)}</span>
        </div>

      </li>`;
  }).join('');
}

/* ───────────────────────────────────────────────────────────────
   §8  PIE CHART  —  Category Spending Mix
─────────────────────────────────────────────────────────────── */

function renderPieChart() {
  destroyChart('pie');
  const canvas = document.getElementById('pieChart');
  const empty  = document.getElementById('pieEmpty');
  if (!canvas) return;

  const { labels, values } = categoryTotals();

  if (!values.length) {
    setVisible(canvas, false);
    setVisible(empty,  true);
    return;
  }
  setVisible(canvas, true);
  setVisible(empty,  false);

  CHARTS.pie = new Chart(canvas, {
    type: 'doughnut',
    data: {
      labels,
      datasets: [{
        data:            values,
        backgroundColor: PIE_COLOURS.slice(0, labels.length),
        borderColor:     'transparent',
        hoverOffset:     10,
      }],
    },
    options: {
      responsive:          true,
      maintainAspectRatio: true,
      cutout:              '58%',
      plugins: {
        legend: {
          position: 'bottom',
          labels: {
            color:           '#8b8fa8',
            font:            { family: "'Instrument Sans', sans-serif", size: 11 },
            padding:         14,
            usePointStyle:   true,
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
          callbacks: { label: ctx => ` ${fmt(ctx.parsed)}` },
        },
      },
    },
  });
}

/* ───────────────────────────────────────────────────────────────
   §9  BAR CHART  —  Monthly Activity (grouped bars)
─────────────────────────────────────────────────────────────── */

function renderBarChart() {
  destroyChart('bar');
  const canvas = document.getElementById('barChart');
  const empty  = document.getElementById('barEmpty');
  if (!canvas) return;

  const incT = monthlyByType('income');
  const expT = monthlyByType('expense');
  const savT = monthlyByType('saving');

  // Union of all months across types, sorted chronologically
  const allLabels = [...new Set([...incT.labels, ...expT.labels, ...savT.labels])]
    .sort((a, b) => new Date('1 ' + a) - new Date('1 ' + b));

  if (!allLabels.length) {
    setVisible(canvas, false);
    setVisible(empty,  true);
    return;
  }
  setVisible(canvas, true);
  setVisible(empty,  false);

  /** Fill missing months with 0 */
  const align = trend => {
    const m = new Map(trend.labels.map((l, i) => [l, trend.values[i]]));
    return allLabels.map(l => m.get(l) || 0);
  };

  CHARTS.bar = new Chart(canvas, {
    type: 'bar',
    data: {
      labels: allLabels,
      datasets: [
        { label: 'Income',   data: align(incT), backgroundColor: TYPE.income.dim,  borderColor: TYPE.income.solid,  borderWidth: 2, borderRadius: 5, borderSkipped: false },
        { label: 'Expenses', data: align(expT), backgroundColor: TYPE.expense.dim, borderColor: TYPE.expense.solid, borderWidth: 2, borderRadius: 5, borderSkipped: false },
        { label: 'Savings',  data: align(savT), backgroundColor: TYPE.saving.dim,  borderColor: TYPE.saving.solid,  borderWidth: 2, borderRadius: 5, borderSkipped: false },
      ],
    },
    options: {
      responsive:          true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'top', align: 'end',
          labels: { color: '#8b8fa8', font: { family: "'Instrument Sans'", size: 11 }, padding: 16, usePointStyle: true, pointStyleWidth: 7 },
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
        x: { grid: { color: 'rgba(255,255,255,0.04)' }, ticks: { color: '#6b6f85', font: { size: 11, family: "'Instrument Sans'" } }, border: { color: 'transparent' } },
        y: { grid: { color: 'rgba(255,255,255,0.04)' }, ticks: { color: '#6b6f85', font: { size: 11, family: "'Instrument Sans'" }, callback: v => `$${v}` }, border: { color: 'transparent' }, beginAtZero: true },
      },
    },
  });
}

/* ───────────────────────────────────────────────────────────────
  §10  FULL TRANSACTION TABLE
─────────────────────────────────────────────────────────────── */

/** Return allTransactions filtered by current search + dropdowns */
function filtered() {
  const q   = (document.getElementById('searchInput')?.value   || '').trim().toLowerCase();
  const typ = (document.getElementById('filterType')?.value    || '');
  const cat = (document.getElementById('filterCategory')?.value || '');
  return allTransactions.filter(t =>
    (!typ  || t.type     === typ)  &&
    (!cat  || t.category === cat)  &&
    (!q    || [t.note, t.category, t.type].some(s => s?.toLowerCase().includes(q)))
  );
}

function renderTable() {
  const loading = document.getElementById('loadingState');
  const empty   = document.getElementById('emptyState');
  const wrapper = document.getElementById('tableWrapper');
  const tbody   = document.getElementById('txnBody');

  setVisible(loading, false);

  if (!allTransactions.length) {
    setVisible(empty, true); setVisible(wrapper, false); return;
  }
  setVisible(empty, false); setVisible(wrapper, true);

  const rows = filtered().sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  if (!rows.length) {
    tbody.innerHTML = `<tr><td colspan="6" class="table-empty-cell">No transactions match the filter.</td></tr>`;
    return;
  }

  tbody.innerHTML = rows.map((t, i) => {
    const meta = TYPE[t.type] || { label: t.type, sign: '', solid: '#888' };
    return `
      <tr class="txn-row txn-row--${t.type}" style="animation-delay:${i*28}ms">
        <td class="td-date">${fmtDate(t.createdAt)}</td>
        <td><span class="type-pill type-pill--${t.type}">${meta.label}</span></td>
        <td><span class="cat-tag">${t.category || '—'}</span></td>
        <td class="td-note">${t.note || '<span class="muted">—</span>'}</td>
        <td class="td-amount amount--${t.type}">${meta.sign}${fmt(t.amount)}</td>
        <td class="td-action">
          <button class="btn-del" data-id="${t._id}" aria-label="Delete transaction">✕</button>
        </td>
      </tr>`;
  }).join('');

  tbody.querySelectorAll('.btn-del').forEach(b => b.addEventListener('click', handleDelete));
}

/* ───────────────────────────────────────────────────────────────
  §11  FORM HANDLER
─────────────────────────────────────────────────────────────── */

async function handleAdd() {
  const amount   = parseFloat(document.getElementById('amount')?.value);
  const type     = document.getElementById('txnType')?.value.trim();
  const category = document.getElementById('category')?.value.trim();
  const note     = document.getElementById('note')?.value.trim();

  if (!amount || amount <= 0) { showFormMsg('Enter a valid amount.',         'error'); return; }
  if (!type)                  { showFormMsg('Select a transaction type.',     'error'); return; }
  if (!category)              { showFormMsg('Select a category.',             'error'); return; }

  const btn  = document.getElementById('addTxnBtn');
  const span = btn?.querySelector('.btn-text');
  if (btn) btn.disabled = true;
  if (span) span.textContent = 'Saving…';

  try {
    await apiAddTransaction({ amount, type, category, note });
    showToast('Transaction saved ✓');
    showFormMsg('Saved!');
    ['amount', 'txnType', 'category', 'note'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.value = '';
    });
    await loadTransactions();
  } catch (err) {
    console.error(err);
    showToast(err.message || 'Could not save.', 'error');
    showFormMsg(err.message || 'Something went wrong.', 'error');
  } finally {
    if (btn)  btn.disabled       = false;
    if (span) span.textContent   = 'Add Transaction';
  }
}

async function handleDelete(e) {
  const btn = e.currentTarget;
  const id  = btn.dataset.id;
  if (!id) return;

  const row = btn.closest('tr');
  row?.classList.add('row-exit');        // fade-out animation via CSS

  try {
    await apiDeleteTransaction(id);
    showToast('Deleted.');
    await loadTransactions();
  } catch (err) {
    console.error(err);
    row?.classList.remove('row-exit');
    showToast('Could not delete.', 'error');
  }
}

/* ───────────────────────────────────────────────────────────────
  §12  MASTER RENDER & INIT
─────────────────────────────────────────────────────────────── */

/**
 * Re-render every UI section from the current allTransactions state.
 * Called after every successful load/add/delete.
 */
function renderAll() {
  renderKpiCards();            // §5
  renderSparklines();          // §6
  renderRecentTransactions();  // §7
  renderPieChart();            // §8
  renderBarChart();            // §9
  renderTable();               // §10
}

/** Fetch all transactions, update state, re-render everything */
async function loadTransactions() {
  try {
    allTransactions = await apiGetTransactions();
    setConnected(true);
    renderAll();
  } catch (err) {
    console.error('loadTransactions failed:', err);
    setConnected(false);
    setVisible(document.getElementById('loadingState'), false);
    setVisible(document.getElementById('emptyState'),   true);
    showToast('Cannot reach backend.', 'error');
  }
}

function init() {
  // Set today's date in header
  const dateEl = document.getElementById('headerDate');
  if (dateEl) {
    dateEl.textContent = new Date().toLocaleDateString('en-US', {
      weekday: 'short', month: 'long', day: 'numeric',
    });
  }

  // Form
  document.getElementById('addTxnBtn')
    ?.addEventListener('click', handleAdd);
  document.getElementById('note')
    ?.addEventListener('keydown', e => { if (e.key === 'Enter') handleAdd(); });

  // Live filters
  ['searchInput', 'filterType', 'filterCategory'].forEach(id => {
    const el = document.getElementById(id);
    el?.addEventListener('input',  renderTable);
    el?.addEventListener('change', renderTable);
  });

  // "View all" → smooth scroll to table
  document.getElementById('viewAllBtn')
    ?.addEventListener('click', () => {
      document.getElementById('fullTableSection')
        ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });

  loadTransactions();
}

document.addEventListener('DOMContentLoaded', init);