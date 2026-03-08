/**
 * ╔══════════════════════════════════════════════╗
 * ║  MoneyPilot — dashboard.js  (Version 2)      ║
 * ║                                              ║
 * ║  Modules:                                    ║
 * ║   1. CONFIG & STATE                          ║
 * ║   2. UTILITIES                               ║
 * ║   3. API LAYER        (unchanged from V1)    ║
 * ║   4. SUMMARY CARDS    (V2 feature)           ║
 * ║   5. PIE CHART        (V2 feature)           ║
 * ║   6. BAR CHART        (V2 feature)           ║
 * ║   7. TABLE RENDERER   (V1, extended)         ║
 * ║   8. EVENT HANDLERS                          ║
 * ║   9. BOOTSTRAP / INIT                        ║
 * ╚══════════════════════════════════════════════╝
 */

'use strict';

/* ─────────────────────────────────────────────────
   1. CONFIG & STATE
───────────────────────────────────────────────── */

const BASE_URL = 'http://localhost:5000/api';

/**
 * Chart.js palette — gold-adjacent tones that match
 * the dark luxury theme defined in style.css
 */
const CHART_PALETTE = [
  '#c9a84c', // gold
  '#4caf87', // green
  '#5b8dee', // blue
  '#e07b5c', // terracotta
  '#9b6fe0', // violet
  '#e0c45c', // yellow-gold
  '#5cb8e0', // sky
  '#e05c8a', // rose
];

/** Global in-memory store for all fetched expenses */
let allExpenses = [];

/** Chart.js instance references — kept so we can destroy before re-render */
let pieChartInstance = null;
let barChartInstance = null;

/* ─────────────────────────────────────────────────
   2. UTILITIES
───────────────────────────────────────────────── */

/** Format a number as USD currency string. */
function formatCurrency(amount) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency', currency: 'USD',
  }).format(amount);
}

/** Format an ISO date string to "Jun 12" form. */
function formatDate(isoString) {
  if (!isoString) return '—';
  return new Date(isoString).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric',
  });
}

/**
 * Format an ISO date string to "Jun 2024" (for monthly grouping labels).
 * @param {string} isoString
 */
function formatMonthLabel(isoString) {
  return new Date(isoString).toLocaleDateString('en-US', {
    month: 'short', year: 'numeric',
  });
}

/** Toggle a CSS `hidden` class. */
function setVisible(el, visible) {
  el.classList.toggle('hidden', !visible);
}

/** Show a toast notification (success | error). */
function showToast(message, type = 'success') {
  const el = document.getElementById('toast');
  el.textContent = message;
  el.className = `toast toast--${type} toast--visible`;
  setTimeout(() => { el.className = 'toast'; }, 3000);
}

/** Show inline form feedback. */
function showFormMessage(message, type = 'success') {
  const el = document.getElementById('formMessage');
  el.textContent = message;
  el.className = `form-message form-message--${type} form-message--visible`;
  setTimeout(() => {
    el.className = 'form-message';
    el.textContent = '';
  }, 3000);
}

/** Update the backend status indicator dot. */
function setStatus(online) {
  const dot = document.getElementById('statusDot');
  dot.classList.toggle('status-dot--online',  online);
  dot.classList.toggle('status-dot--offline', !online);
  dot.title = online ? 'Backend connected' : 'Backend unreachable';
}

/**
 * Group an array of expenses by a key function, summing amounts.
 * @param {Array}    expenses
 * @param {Function} keyFn   — (expense) => string
 * @returns {{ labels: string[], totals: number[] }}
 */
function groupBySum(expenses, keyFn) {
  const map = new Map();
  expenses.forEach(e => {
    const key = keyFn(e);
    map.set(key, (map.get(key) || 0) + (e.amount || 0));
  });
  const labels = [...map.keys()];
  const totals  = labels.map(l => map.get(l));
  return { labels, totals };
}

/* ─────────────────────────────────────────────────
   3. API LAYER  (unchanged from V1)
───────────────────────────────────────────────── */

/** GET /api/expenses */
async function fetchExpenses() {
  const res = await fetch(`${BASE_URL}/expenses`);
  if (!res.ok) throw new Error(`Server error: ${res.status}`);
  return res.json();
}

/** POST /api/add-expense */
async function createExpense(data) {
  const res = await fetch(`${BASE_URL}/add-expense`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || `Server error: ${res.status}`);
  }
  return res.json();
}

/** DELETE /api/expense/:id */
async function deleteExpense(id) {
  const res = await fetch(`${BASE_URL}/expense/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error(`Server error: ${res.status}`);
}

/* ─────────────────────────────────────────────────
   4. SUMMARY CARDS  (V2)
───────────────────────────────────────────────── */

/**
 * Render all three summary cards from the full unfiltered expense list.
 * - Total Spent
 * - Transaction count
 * - Top category (by total spend)
 */
function renderSummaryCards(expenses) {
  // Total
  const total = expenses.reduce((s, e) => s + (e.amount || 0), 0);
  document.getElementById('totalAmount').textContent  = formatCurrency(total);
  document.getElementById('txnCount').textContent     = `${expenses.length} transaction${expenses.length !== 1 ? 's' : ''}`;
  document.getElementById('txnCountBig').textContent  = expenses.length;

  // Top Category
  if (expenses.length === 0) {
    document.getElementById('topCategory').textContent    = '—';
    document.getElementById('topCategoryAmt').textContent = '$0.00 spent';
    return;
  }

  const { labels, totals } = groupBySum(expenses, e => e.category || 'Other');
  const maxIdx = totals.indexOf(Math.max(...totals));

  document.getElementById('topCategory').textContent    = labels[maxIdx];
  document.getElementById('topCategoryAmt').textContent = `${formatCurrency(totals[maxIdx])} spent`;
}

/* ─────────────────────────────────────────────────
   5. PIE CHART  (V2)
───────────────────────────────────────────────── */

/**
 * Render (or re-render) the category spending donut/pie chart.
 * Destroys previous Chart.js instance to avoid canvas re-use errors.
 * @param {Array} expenses — unfiltered full list
 */
function renderPieChart(expenses) {
  const canvas  = document.getElementById('pieChart');
  const emptyEl = document.getElementById('pieEmpty');

  if (pieChartInstance) {
    pieChartInstance.destroy();
    pieChartInstance = null;
  }

  if (expenses.length === 0) {
    setVisible(canvas, false);
    setVisible(emptyEl, true);
    return;
  }

  setVisible(canvas, true);
  setVisible(emptyEl, false);

  // Aggregate by category
  const { labels, totals } = groupBySum(expenses, e => e.category || 'Other');

  pieChartInstance = new Chart(canvas, {
    type: 'doughnut',
    data: {
      labels,
      datasets: [{
        data: totals,
        backgroundColor: CHART_PALETTE.slice(0, labels.length),
        borderColor: 'transparent',
        hoverOffset: 8,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      cutout: '62%',
      plugins: {
        legend: {
          position: 'bottom',
          labels: {
            color: '#9295a8',
            font: { family: "'DM Sans', sans-serif", size: 12 },
            padding: 16,
            usePointStyle: true,
            pointStyleWidth: 8,
          },
        },
        tooltip: {
          backgroundColor: '#1c1f2b',
          titleColor: '#e8e9f0',
          bodyColor: '#9295a8',
          borderColor: 'rgba(255,255,255,0.07)',
          borderWidth: 1,
          padding: 12,
          callbacks: {
            label: ctx => ` ${formatCurrency(ctx.parsed)}`,
          },
        },
      },
    },
  });
}

/* ─────────────────────────────────────────────────
   6. BAR CHART  (V2)
───────────────────────────────────────────────── */

/**
 * Render (or re-render) the monthly spending bar chart.
 * Groups expenses by "Mon YYYY" strings, sorted chronologically.
 * @param {Array} expenses — unfiltered full list
 */
function renderBarChart(expenses) {
  const canvas  = document.getElementById('barChart');
  const emptyEl = document.getElementById('barEmpty');

  if (barChartInstance) {
    barChartInstance.destroy();
    barChartInstance = null;
  }

  if (expenses.length === 0) {
    setVisible(canvas, false);
    setVisible(emptyEl, true);
    return;
  }

  setVisible(canvas, true);
  setVisible(emptyEl, false);

  // Group by "Mon YYYY", sorting entries chronologically
  const map = new Map();
  expenses.forEach(e => {
    const d = new Date(e.createdAt || Date.now());
    // Use sortable key (YYYY-MM) for ordering, display label separately
    const sortKey    = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const displayKey = formatMonthLabel(e.createdAt || new Date().toISOString());
    if (!map.has(sortKey)) map.set(sortKey, { label: displayKey, total: 0 });
    map.get(sortKey).total += (e.amount || 0);
  });

  // Sort by sortKey (chronological)
  const sorted = [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  const labels = sorted.map(([, v]) => v.label);
  const totals = sorted.map(([, v]) => v.total);

  barChartInstance = new Chart(canvas, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'Spending',
        data: totals,
        backgroundColor: 'rgba(201,168,76,0.25)',
        borderColor: '#c9a84c',
        borderWidth: 2,
        borderRadius: 6,
        borderSkipped: false,
        hoverBackgroundColor: 'rgba(201,168,76,0.45)',
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: '#1c1f2b',
          titleColor: '#e8e9f0',
          bodyColor: '#9295a8',
          borderColor: 'rgba(255,255,255,0.07)',
          borderWidth: 1,
          padding: 12,
          callbacks: {
            label: ctx => ` ${formatCurrency(ctx.parsed.y)}`,
          },
        },
      },
      scales: {
        x: {
          grid: { color: 'rgba(255,255,255,0.04)' },
          ticks: {
            color: '#6b6f82',
            font: { family: "'DM Sans', sans-serif", size: 11 },
          },
          border: { color: 'transparent' },
        },
        y: {
          grid: { color: 'rgba(255,255,255,0.04)' },
          ticks: {
            color: '#6b6f82',
            font: { family: "'DM Sans', sans-serif", size: 11 },
            callback: v => `$${v}`,
          },
          border: { color: 'transparent' },
          beginAtZero: true,
        },
      },
    },
  });
}

/* ─────────────────────────────────────────────────
   7. TABLE RENDERER  (V1 logic, V2 integrated)
───────────────────────────────────────────────── */

/** Return expenses filtered by current search text + category dropdown. */
function getFilteredExpenses() {
  const query     = document.getElementById('searchInput').value.trim().toLowerCase();
  const catFilter = document.getElementById('filterCategory').value;

  return allExpenses.filter(e => {
    const matchCat  = !catFilter || e.category === catFilter;
    const matchText = !query
      || (e.note     && e.note.toLowerCase().includes(query))
      || (e.category && e.category.toLowerCase().includes(query));
    return matchCat && matchText;
  });
}

/** Render the expense table rows. */
function renderTable(expenses) {
  setVisible(document.getElementById('loadingState'), false);

  if (expenses.length === 0 && allExpenses.length === 0) {
    setVisible(document.getElementById('emptyState'),   true);
    setVisible(document.getElementById('tableWrapper'), false);
    return;
  }

  setVisible(document.getElementById('emptyState'),   false);
  setVisible(document.getElementById('tableWrapper'), true);

  const tbody = document.getElementById('expenseTableBody');

  if (expenses.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="5" class="table-empty-row">
          No expenses match your filter.
        </td>
      </tr>`;
    return;
  }

  // Sort newest first
  const sorted = [...expenses].sort((a, b) =>
    new Date(b.createdAt || 0) - new Date(a.createdAt || 0)
  );

  tbody.innerHTML = sorted.map((expense, i) => `
    <tr class="table-row" style="animation-delay:${i * 35}ms">
      <td class="col-date">${formatDate(expense.createdAt)}</td>
      <td><span class="category-badge">${expense.category || 'Other'}</span></td>
      <td class="col-note">${expense.note || '<span class="muted">—</span>'}</td>
      <td class="col-amount">${formatCurrency(expense.amount)}</td>
      <td class="col-action">
        <button class="btn-delete" data-id="${expense._id}"
                aria-label="Delete expense" title="Delete">✕</button>
      </td>
    </tr>
  `).join('');

  tbody.querySelectorAll('.btn-delete').forEach(btn =>
    btn.addEventListener('click', handleDelete)
  );
}

/* ─────────────────────────────────────────────────
   MASTER RENDER
   Called after every data change — updates all
   UI sections from the current allExpenses state.
───────────────────────────────────────────────── */
function renderAll() {
  const filtered = getFilteredExpenses();
  // Summary cards & charts always use the full unfiltered list
  renderSummaryCards(allExpenses);
  renderPieChart(allExpenses);
  renderBarChart(allExpenses);
  // Table respects active filters
  renderTable(filtered);
}

/* ─────────────────────────────────────────────────
   8. EVENT HANDLERS
───────────────────────────────────────────────── */

/** Handle "Add Expense" click. */
async function handleAddExpense() {
  const amount   = parseFloat(document.getElementById('amount').value);
  const category = document.getElementById('category').value.trim();
  const note     = document.getElementById('note').value.trim();

  // Validate
  if (!amount || amount <= 0) {
    showFormMessage('Please enter a valid amount.', 'error');
    document.getElementById('amount').focus();
    return;
  }
  if (!category) {
    showFormMessage('Please select a category.', 'error');
    document.getElementById('category').focus();
    return;
  }

  const btn      = document.getElementById('addExpenseBtn');
  const btnText  = btn.querySelector('.btn-text');
  btn.disabled   = true;
  btnText.textContent = 'Saving…';

  try {
    await createExpense({ amount, category, note });
    showToast('Expense added ✦', 'success');
    showFormMessage('Expense saved!', 'success');

    // Reset form
    document.getElementById('amount').value   = '';
    document.getElementById('category').value = '';
    document.getElementById('note').value     = '';

    await loadExpenses();
  } catch (err) {
    console.error('Add expense failed:', err);
    showToast('Failed to add expense.', 'error');
    showFormMessage(err.message || 'Something went wrong.', 'error');
  } finally {
    btn.disabled        = false;
    btnText.textContent = 'Add Expense';
  }
}

/** Handle delete button on a table row. */
async function handleDelete(e) {
  const btn = e.currentTarget;
  const id  = btn.dataset.id;
  if (!id) return;

  // Optimistic UI fade
  const row = btn.closest('tr');
  row.classList.add('row--deleting');

  try {
    await deleteExpense(id);
    showToast('Expense removed.', 'success');
    await loadExpenses();
  } catch (err) {
    console.error('Delete failed:', err);
    row.classList.remove('row--deleting');
    showToast('Could not delete expense.', 'error');
  }
}

/* ─────────────────────────────────────────────────
   9. DATA LOADING & BOOTSTRAP
───────────────────────────────────────────────── */

/** Fetch all expenses, update state, re-render everything. */
async function loadExpenses() {
  try {
    allExpenses = await fetchExpenses();
    setStatus(true);
    renderAll();
  } catch (err) {
    console.error('Failed to load expenses:', err);
    setStatus(false);
    setVisible(document.getElementById('loadingState'), false);
    setVisible(document.getElementById('emptyState'),   true);
    showToast('Could not reach backend.', 'error');
  }
}

/** Wire up all event listeners and kick off initial data load. */
function init() {
  document.getElementById('addExpenseBtn')
    .addEventListener('click', handleAddExpense);

  // Enter key in note field submits the form
  document.getElementById('note')
    .addEventListener('keydown', e => { if (e.key === 'Enter') handleAddExpense(); });

  // Live filter listeners
  document.getElementById('searchInput')
    .addEventListener('input', renderAll);

  document.getElementById('filterCategory')
    .addEventListener('change', renderAll);

  loadExpenses();
}

document.addEventListener('DOMContentLoaded', init);