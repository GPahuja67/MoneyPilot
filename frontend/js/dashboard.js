/**
 * ╔══════════════════════════════════════╗
 * ║   MoneyPilot — app.js               ║
 * ║   Vanilla JS frontend logic         ║
 * ╚══════════════════════════════════════╝
 *
 * Connects to the Node/Express backend at BASE_URL.
 * All API calls use the native Fetch API.
 */

'use strict';

// ─────────────────────────────────────────────
// CONFIG
// ─────────────────────────────────────────────

/** Change this if your backend runs on a different port */
const BASE_URL = 'http://localhost:5000/api';

// ─────────────────────────────────────────────
// DOM REFERENCES
// ─────────────────────────────────────────────

const totalAmountEl   = document.getElementById('totalAmount');
const expenseCountEl  = document.getElementById('expenseCount');
const breakdownListEl = document.getElementById('breakdownList');
const addExpenseBtn   = document.getElementById('addExpenseBtn');
const formMessageEl   = document.getElementById('formMessage');
const loadingStateEl  = document.getElementById('loadingState');
const emptyStateEl    = document.getElementById('emptyState');
const tableWrapperEl  = document.getElementById('tableWrapper');
const tableBodyEl     = document.getElementById('expenseTableBody');
const toastEl         = document.getElementById('toast');
const statusDotEl     = document.getElementById('statusDot');
const searchInputEl   = document.getElementById('searchInput');
const filterCategoryEl= document.getElementById('filterCategory');

// Form inputs
const amountInput   = document.getElementById('amount');
const categoryInput = document.getElementById('category');
const noteInput     = document.getElementById('note');

// ─────────────────────────────────────────────
// STATE
// ─────────────────────────────────────────────

/** In-memory store for all fetched expenses */
let allExpenses = [];

// ─────────────────────────────────────────────
// UTILITY FUNCTIONS
// ─────────────────────────────────────────────

/**
 * Format a number as USD currency string.
 * @param {number} amount
 * @returns {string} e.g. "$12.50"
 */
function formatCurrency(amount) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount);
}

/**
 * Format an ISO date string to a human-readable short date.
 * @param {string} isoString
 * @returns {string} e.g. "Jun 12"
 */
function formatDate(isoString) {
  if (!isoString) return '—';
  const d = new Date(isoString);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

/**
 * Show a toast notification.
 * @param {string} message
 * @param {'success'|'error'} type
 */
function showToast(message, type = 'success') {
  toastEl.textContent = message;
  toastEl.className = `toast toast--${type} toast--visible`;
  setTimeout(() => {
    toastEl.className = 'toast';
  }, 3000);
}

/**
 * Show or hide elements using a CSS class.
 * @param {HTMLElement} el
 * @param {boolean} visible
 */
function setVisible(el, visible) {
  el.classList.toggle('hidden', !visible);
}

/**
 * Display an inline form message (success/error).
 * @param {string} message
 * @param {'success'|'error'} type
 */
function showFormMessage(message, type = 'success') {
  formMessageEl.textContent = message;
  formMessageEl.className = `form-message form-message--${type} form-message--visible`;
  setTimeout(() => {
    formMessageEl.className = 'form-message';
    formMessageEl.textContent = '';
  }, 3000);
}

/**
 * Set the backend connection indicator dot.
 * @param {boolean} online
 */
function setStatus(online) {
  statusDotEl.classList.toggle('status-dot--online', online);
  statusDotEl.classList.toggle('status-dot--offline', !online);
  statusDotEl.title = online ? 'Backend connected' : 'Backend unreachable';
}

// ─────────────────────────────────────────────
// API CALLS
// ─────────────────────────────────────────────

/**
 * GET /api/expenses
 * Fetches all expenses from the backend.
 * @returns {Promise<Array>}
 */
async function fetchExpenses() {
  const res = await fetch(`${BASE_URL}/expenses`);
  if (!res.ok) throw new Error(`Server error: ${res.status}`);
  return res.json();
}

/**
 * POST /api/add-expense
 * Sends a new expense to the backend.
 * @param {{ amount: number, category: string, note: string }} data
 * @returns {Promise<Object>} The created expense document
 */
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

/**
 * DELETE /api/expense/:id
 * Deletes an expense by ID.
 * @param {string} id
 * @returns {Promise<void>}
 */
async function deleteExpense(id) {
  const res = await fetch(`${BASE_URL}/expense/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error(`Server error: ${res.status}`);
}

// ─────────────────────────────────────────────
// RENDER FUNCTIONS
// ─────────────────────────────────────────────

/**
 * Compute and render the total spending amount + count badge.
 * @param {Array} expenses
 */
function renderTotals(expenses) {
  const total = expenses.reduce((sum, e) => sum + (e.amount || 0), 0);
  totalAmountEl.textContent = formatCurrency(total);
  expenseCountEl.textContent = `${expenses.length} transaction${expenses.length !== 1 ? 's' : ''}`;
}

/**
 * Compute and render the per-category spending breakdown.
 * @param {Array} expenses
 */
function renderBreakdown(expenses) {
  // Group totals by category
  const map = {};
  expenses.forEach(e => {
    const cat = e.category || 'Other';
    map[cat] = (map[cat] || 0) + (e.amount || 0);
  });

  const entries = Object.entries(map).sort((a, b) => b[1] - a[1]);

  if (entries.length === 0) {
    breakdownListEl.innerHTML = '<li class="breakdown-empty">No data yet</li>';
    return;
  }

  const maxVal = entries[0][1];

  breakdownListEl.innerHTML = entries.map(([cat, total]) => {
    const pct = Math.round((total / maxVal) * 100);
    return `
      <li class="breakdown-item">
        <span class="breakdown-cat">${cat}</span>
        <div class="breakdown-bar-wrap">
          <div class="breakdown-bar" style="width: ${pct}%"></div>
        </div>
        <span class="breakdown-val">${formatCurrency(total)}</span>
      </li>
    `;
  }).join('');
}

/**
 * Filter expenses based on current search text and category filter.
 * @returns {Array} Filtered subset of allExpenses
 */
function getFilteredExpenses() {
  const query = searchInputEl.value.trim().toLowerCase();
  const catFilter = filterCategoryEl.value;

  return allExpenses.filter(e => {
    const matchCat  = !catFilter || e.category === catFilter;
    const matchText = !query
      || (e.note     && e.note.toLowerCase().includes(query))
      || (e.category && e.category.toLowerCase().includes(query));
    return matchCat && matchText;
  });
}

/**
 * Render the expense table rows.
 * Handles empty / filtered-empty states.
 * @param {Array} expenses
 */
function renderTable(expenses) {
  // Show/hide sections
  setVisible(loadingStateEl, false);

  if (expenses.length === 0 && allExpenses.length === 0) {
    // No data at all
    setVisible(emptyStateEl, true);
    setVisible(tableWrapperEl, false);
    return;
  }

  setVisible(emptyStateEl, false);
  setVisible(tableWrapperEl, true);

  if (expenses.length === 0) {
    // Data exists but filter returned nothing
    tableBodyEl.innerHTML = `
      <tr>
        <td colspan="5" class="table-empty-row">
          No expenses match your filter.
        </td>
      </tr>
    `;
    return;
  }

  // Sort newest first (by createdAt or _id timestamp)
  const sorted = [...expenses].sort((a, b) => {
    const dateA = new Date(a.createdAt || 0);
    const dateB = new Date(b.createdAt || 0);
    return dateB - dateA;
  });

  tableBodyEl.innerHTML = sorted.map((expense, i) => `
    <tr class="table-row" style="animation-delay: ${i * 40}ms">
      <td class="col-date">${formatDate(expense.createdAt)}</td>
      <td>
        <span class="category-badge">${expense.category || 'Other'}</span>
      </td>
      <td class="col-note">${expense.note || '<span class="muted">—</span>'}</td>
      <td class="col-amount">${formatCurrency(expense.amount)}</td>
      <td class="col-action">
        <button
          class="btn-delete"
          data-id="${expense._id}"
          aria-label="Delete expense"
          title="Delete"
        >✕</button>
      </td>
    </tr>
  `).join('');

  // Attach delete listeners to each button
  tableBodyEl.querySelectorAll('.btn-delete').forEach(btn => {
    btn.addEventListener('click', handleDelete);
  });
}

/**
 * Master render: re-renders totals, breakdown, and filtered table.
 */
function renderAll() {
  const filtered = getFilteredExpenses();
  renderTotals(allExpenses);       // totals always use unfiltered data
  renderBreakdown(allExpenses);    // breakdown always uses unfiltered data
  renderTable(filtered);           // table respects current filters
}

// ─────────────────────────────────────────────
// EVENT HANDLERS
// ─────────────────────────────────────────────

/**
 * Handle "Add Expense" button click.
 * Validates inputs, calls API, refreshes list.
 */
async function handleAddExpense() {
  const amount   = parseFloat(amountInput.value);
  const category = categoryInput.value.trim();
  const note     = noteInput.value.trim();

  // Client-side validation
  if (!amount || amount <= 0) {
    showFormMessage('Please enter a valid amount.', 'error');
    amountInput.focus();
    return;
  }
  if (!category) {
    showFormMessage('Please select a category.', 'error');
    categoryInput.focus();
    return;
  }

  // Disable button while loading
  addExpenseBtn.disabled = true;
  addExpenseBtn.querySelector('.btn-text').textContent = 'Saving…';

  try {
    await createExpense({ amount, category, note });
    showToast('Expense added ✦', 'success');
    showFormMessage('Expense saved!', 'success');

    // Clear form
    amountInput.value   = '';
    categoryInput.value = '';
    noteInput.value     = '';

    // Refresh list
    await loadExpenses();
  } catch (err) {
    console.error('Add expense failed:', err);
    showToast('Failed to add expense.', 'error');
    showFormMessage(err.message || 'Something went wrong.', 'error');
  } finally {
    addExpenseBtn.disabled = false;
    addExpenseBtn.querySelector('.btn-text').textContent = 'Add Expense';
  }
}

/**
 * Handle delete button click on a table row.
 * @param {MouseEvent} e
 */
async function handleDelete(e) {
  const btn = e.currentTarget;
  const id  = btn.dataset.id;
  if (!id) return;

  // Optimistic UI: fade the row out immediately
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

// ─────────────────────────────────────────────
// DATA LOADING
// ─────────────────────────────────────────────

/**
 * Load expenses from the backend, update state, re-render.
 */
async function loadExpenses() {
  try {
    allExpenses = await fetchExpenses();
    setStatus(true);
    renderAll();
  } catch (err) {
    console.error('Failed to load expenses:', err);
    setStatus(false);
    setVisible(loadingStateEl, false);
    setVisible(emptyStateEl, true);
    showToast('Could not reach backend.', 'error');
  }
}

// ─────────────────────────────────────────────
// INIT
// ─────────────────────────────────────────────

/**
 * Bootstrap the application.
 */
function init() {
  // Wire up primary action
  addExpenseBtn.addEventListener('click', handleAddExpense);

  // Allow Enter key in note field to submit
  noteInput.addEventListener('keydown', e => {
    if (e.key === 'Enter') handleAddExpense();
  });

  // Live filter on search / category change
  searchInputEl.addEventListener('input', renderAll);
  filterCategoryEl.addEventListener('change', renderAll);

  // Initial data load
  loadExpenses();
}

// Run after DOM is ready
document.addEventListener('DOMContentLoaded', init);