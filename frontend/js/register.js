/**
 * MoneyPilot — register.js
 * ──────────────────────────
 * Handles:
 *   • Client-side validation (name, email, password, confirm, terms)
 *   • Password strength meter
 *   • POST /api/auth/register
 *   • Loading / success / error states
 *   • Password visibility toggle
 *
 * Place this file at: frontend/js/register.js
 */

'use strict';

const REGISTER_ENDPOINT = 'http://localhost:5000/api/register';

/* ── DOM refs ─────────────────────────────────────────────── */
const form         = document.getElementById('registerForm');
const nameInput    = document.getElementById('regName');
const emailInput   = document.getElementById('regEmail');
const pwdInput     = document.getElementById('regPassword');
const confirmInput = document.getElementById('regConfirm');
const termsCheck   = document.getElementById('agreeTerms');

const nameErr    = document.getElementById('regNameErr');
const emailErr   = document.getElementById('regEmailErr');
const pwdErr     = document.getElementById('regPwdErr');
const confirmErr = document.getElementById('regConfirmErr');
const termsErr   = document.getElementById('termsError');

const errBanner  = document.getElementById('registerError');
const errMsg     = document.getElementById('registerErrorMsg');
const successBanner = document.getElementById('registerSuccess');

const registerBtn = document.getElementById('registerBtn');
const btnText     = registerBtn?.querySelector('.btn-auth__text');
const btnSpinner  = registerBtn?.querySelector('.btn-auth__spinner');
const btnArrow    = registerBtn?.querySelector('.btn-auth__arrow');

const toggleBtn  = document.getElementById('regEyeBtn');

const strengthMeter = document.getElementById('strengthMeter');
const strengthBar   = document.getElementById('strengthBar');
const strengthLabel = document.getElementById('strengthLabel');

/* ── Utilities ────────────────────────────────────────────── */
const show = el => el?.classList.remove('hidden');
const hide = el => el?.classList.add('hidden');

function setError(input, errorEl, message) {
  input?.classList.add('field-input--error');
  if (errorEl) errorEl.textContent = message;
  show(errorEl);
}
function clearError(input, errorEl) {
  input?.classList.remove('field-input--error');
  hide(errorEl);
}

function setLoading(loading) {
  if (!registerBtn) return;
  registerBtn.disabled = loading;
  if (loading) { hide(btnText); hide(btnArrow); show(btnSpinner); }
  else         { show(btnText); show(btnArrow); hide(btnSpinner); }
}

const isValidEmail = v => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());

/* ── Password strength ────────────────────────────────────── */
/**
 * Scores a password from 0-4 and updates the strength meter UI.
 * Returns the score for use in validation.
 */
function evaluateStrength(pwd) {
  if (!pwd) {
    strengthMeter.className = 'strength-meter';
    strengthLabel.textContent = '';
    return 0;
  }

  let score = 0;
  if (pwd.length >= 8)                score++;
  if (pwd.length >= 12)               score++;
  if (/[A-Z]/.test(pwd) && /[a-z]/.test(pwd)) score++;
  if (/[0-9]/.test(pwd))              score++;
  if (/[^A-Za-z0-9]/.test(pwd))      score++;

  // Map score → level
  const levels = [
    null,
    { cls: 'strength--weak',   label: 'Weak' },
    { cls: 'strength--fair',   label: 'Fair' },
    { cls: 'strength--good',   label: 'Good' },
    { cls: 'strength--strong', label: 'Strong' },
    { cls: 'strength--strong', label: 'Strong' },
  ];
  const level = levels[Math.min(score, 4)];
  strengthMeter.className = `strength-meter ${level.cls}`;
  strengthLabel.textContent = level.label;

  return score;
}

pwdInput?.addEventListener('input', () => evaluateStrength(pwdInput.value));

/* ── Password toggle ──────────────────────────────────────── */
toggleBtn?.addEventListener('click', () => {
  const isHidden = pwdInput.type === 'password';
  pwdInput.type  = isHidden ? 'text' : 'password';
  toggleBtn.querySelector('.eye-icon--show')?.classList.toggle('hidden', isHidden);
  toggleBtn.querySelector('.eye-icon--hide')?.classList.toggle('hidden', !isHidden);
  toggleBtn.setAttribute('aria-label', isHidden ? 'Hide password' : 'Show password');
});

/* ── Clear errors on input ────────────────────────────────── */
nameInput?.addEventListener('input',    () => clearError(nameInput, nameErr));
emailInput?.addEventListener('input',   () => clearError(emailInput, emailErr));
pwdInput?.addEventListener('input',     () => clearError(pwdInput, pwdErr));
confirmInput?.addEventListener('input', () => clearError(confirmInput, confirmErr));
termsCheck?.addEventListener('change',  () => hide(termsErr));

/* ── Full validation ──────────────────────────────────────── */
function validate() {
  let valid = true;

  // Name
  if (!nameInput.value.trim() || nameInput.value.trim().length < 2) {
    setError(nameInput, nameErr, 'Please enter your full name.');
    valid = false;
  } else { clearError(nameInput, nameErr); }

  // Email
  if (!isValidEmail(emailInput.value)) {
    setError(emailInput, emailErr, 'Please enter a valid email address.');
    valid = false;
  } else { clearError(emailInput, emailErr); }

  // Password
  if (pwdInput.value.length < 8) {
    setError(pwdInput, pwdErr, 'Password must be at least 8 characters.');
    valid = false;
  } else { clearError(pwdInput, pwdErr); }

  // Confirm
  if (confirmInput.value !== pwdInput.value) {
    setError(confirmInput, confirmErr, 'Passwords do not match.');
    valid = false;
  } else { clearError(confirmInput, confirmErr); }

  // Terms
  if (!termsCheck.checked) {
    show(termsErr);
    valid = false;
  } else { hide(termsErr); }

  return valid;
}

/* ── Form submit ──────────────────────────────────────────── */
form?.addEventListener('submit', async e => {
  e.preventDefault();
  hide(errBanner);
  hide(successBanner);

  if (!validate()) return;

  setLoading(true);

  try {
    const res = await fetch(REGISTER_ENDPOINT, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name:     nameInput.value.trim(),
        email:    emailInput.value.trim(),
        password: pwdInput.value,
      }),
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      errMsg.textContent = data.message || 'Registration failed. Please try again.';
      show(errBanner);
      errBanner.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      return;
    }

    /* Success */
    show(successBanner);
    form.reset();
    evaluateStrength('');

    /* Persist token if returned immediately */
    const token = data.token || data.accessToken;
    if (token) {
      sessionStorage.setItem('mp_token', token);
      if (data.user) sessionStorage.setItem('mp_user', JSON.stringify(data.user));
    }

    /* Redirect after a short delay so user sees the success banner */
    setTimeout(() => {
      window.location.href = data.redirectTo || 'dashboard.html';
    }, 1800);

  } catch (err) {
    console.error('Register error:', err);
    errMsg.textContent = 'Cannot reach the server. Please check your connection.';
    show(errBanner);
  } finally {
    setLoading(false);
  }
});