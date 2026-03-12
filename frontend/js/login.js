/**
 * MoneyPilot — login.js
 * ─────────────────────
 * Handles:
 *   • Client-side validation
 *   • POST /api/auth/login
 *   • Loading / error states
 *   • Password visibility toggle
 *
 * Place this file at: frontend/js/login.js
 */

'use strict';

const LOGIN_ENDPOINT = 'http://localhost:5000/api/auth/login';

/* ── DOM refs ─────────────────────────────────────────────── */
const form        = document.getElementById('loginForm');
const emailInput  = document.getElementById('loginEmail');
const pwdInput    = document.getElementById('loginPassword');
const emailErr    = document.getElementById('emailError');
const pwdErr      = document.getElementById('passwordError');
const loginErrBanner = document.getElementById('loginError');
const loginErrMsg    = document.getElementById('loginErrorMsg');
const loginBtn    = document.getElementById('loginBtn');
const btnText     = loginBtn?.querySelector('.btn-auth__text');
const btnSpinner  = loginBtn?.querySelector('.btn-auth__spinner');
const btnArrow    = loginBtn?.querySelector('.btn-auth__arrow');
const toggleBtn   = document.getElementById('toggleLoginPwd');

/* ── Utilities ────────────────────────────────────────────── */
const show  = el => el?.classList.remove('hidden');
const hide  = el => el?.classList.add('hidden');

function setError(input, errorEl, message) {
  input.classList.add('field-input--error');
  errorEl.textContent = message;
  show(errorEl);
}
function clearError(input, errorEl) {
  input.classList.remove('field-input--error');
  hide(errorEl);
}

function setLoading(loading) {
  loginBtn.disabled = loading;
  if (loading) {
    hide(btnText);
    hide(btnArrow);
    show(btnSpinner);
  } else {
    show(btnText);
    show(btnArrow);
    hide(btnSpinner);
  }
}

/* ── Validation ───────────────────────────────────────────── */
function validateEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

function validate() {
  let valid = true;

  if (!emailInput.value.trim() || !validateEmail(emailInput.value)) {
    setError(emailInput, emailErr, 'Please enter a valid email address.');
    valid = false;
  } else {
    clearError(emailInput, emailErr);
  }

  if (!pwdInput.value) {
    setError(pwdInput, pwdErr, 'Password is required.');
    valid = false;
  } else {
    clearError(pwdInput, pwdErr);
  }

  return valid;
}

/* ── Clear field errors on input ──────────────────────────── */
emailInput?.addEventListener('input', () => clearError(emailInput, emailErr));
pwdInput?.addEventListener('input',   () => clearError(pwdInput, pwdErr));

/* ── Password toggle ──────────────────────────────────────── */
toggleBtn?.addEventListener('click', () => {
  const isHidden = pwdInput.type === 'password';
  pwdInput.type  = isHidden ? 'text' : 'password';
  toggleBtn.querySelector('.eye-icon--show')?.classList.toggle('hidden', isHidden);
  toggleBtn.querySelector('.eye-icon--hide')?.classList.toggle('hidden', !isHidden);
  toggleBtn.setAttribute('aria-label', isHidden ? 'Hide password' : 'Show password');
});

/* ── Form submit ──────────────────────────────────────────── */
form?.addEventListener('submit', async e => {
  e.preventDefault();
  hide(loginErrBanner);

  if (!validate()) return;

  setLoading(true);

  try {
    const res = await fetch(LOGIN_ENDPOINT, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email:    emailInput.value.trim(),
        password: pwdInput.value,
      }),
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      loginErrMsg.textContent = data.message || 'Invalid email or password.';
      show(loginErrBanner);
      loginErrBanner.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      return;
    }

    /* Success — persist token and redirect */
    const token = data.token || data.accessToken;
    if (token) {
      const storage = document.getElementById('rememberMe')?.checked
        ? localStorage
        : sessionStorage;
      storage.setItem('mp_token', token);
      if (data.user) storage.setItem('mp_user', JSON.stringify(data.user));
    }

    /* Redirect to dashboard */
    window.location.href = 'dashboard.html';

  } catch (err) {
    console.error('Login error:', err);
    loginErrMsg.textContent = 'Cannot reach the server. Please try again.';
    show(loginErrBanner);
  } finally {
    setLoading(false);
  }
});