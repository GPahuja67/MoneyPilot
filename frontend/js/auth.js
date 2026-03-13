/**
 * MoneyPilot — auth.js  (Unified)
 * ─────────────────────────────────
 * Handles both login + register on the single auth page.
 *
 * Sections:
 *   1. Config
 *   2. Canvas particle background
 *   3. Cursor spotlight
 *   4. Tab switcher
 *   5. Password eye toggles
 *   6. Password strength meter
 *   7. Form validation helpers
 *   8. Login form submit
 *   9. Register form submit
 *  10. Init
 *
 * Place at: frontend/js/auth.js
 * Also update login.html → <script src="../js/auth.js">
 *
 * OAuth routes (update to match your backend):
 *   GET /api/auth/google   → passport Google OAuth redirect
 *   GET /api/auth/github   → passport GitHub OAuth redirect
 */

'use strict';

/* ─────────────────────────────────────────────────────────────
   1. CONFIG
───────────────────────────────────────────────────────────── */
const API = 'http://localhost:5000/api';

/* ─────────────────────────────────────────────────────────────
   2. CANVAS PARTICLE BACKGROUND
   Draws slowly drifting gold/white dots connected by faint lines
───────────────────────────────────────────────────────────── */
function initCanvas() {
  const canvas = document.getElementById('bgCanvas');
  if (!canvas) return;

  const ctx = canvas.getContext('2d');
  let W, H, particles;

  const PARTICLE_COUNT = 55;
  const LINK_DIST      = 130;
  const GOLD_HEX       = '#c9a84c';
  const GOLD_RGB       = '201,168,76';

  function resize() {
    W = canvas.width  = window.innerWidth;
    H = canvas.height = window.innerHeight;
  }

  function makeParticle() {
    return {
      x:   Math.random() * W,
      y:   Math.random() * H,
      vx:  (Math.random() - 0.5) * 0.35,
      vy:  (Math.random() - 0.5) * 0.35,
      r:   Math.random() * 1.5 + 0.5,
      a:   Math.random() * 0.5 + 0.15,
      gold: Math.random() < 0.25,   // 25 % are gold, rest white
    };
  }

  function initParticles() {
    particles = Array.from({ length: PARTICLE_COUNT }, makeParticle);
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);

    // Draw links
    for (let i = 0; i < particles.length; i++) {
      for (let j = i + 1; j < particles.length; j++) {
        const p = particles[i], q = particles[j];
        const dx = p.x - q.x, dy = p.y - q.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < LINK_DIST) {
          const alpha = (1 - dist / LINK_DIST) * 0.12;
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(q.x, q.y);
          ctx.strokeStyle = `rgba(${p.gold || q.gold ? GOLD_RGB : '200,200,255'},${alpha})`;
          ctx.lineWidth = 0.8;
          ctx.stroke();
        }
      }
    }

    // Draw dots
    particles.forEach(p => {
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = p.gold
        ? `rgba(${GOLD_RGB},${p.a})`
        : `rgba(200,204,255,${p.a * 0.6})`;
      ctx.fill();

      // Move
      p.x += p.vx;
      p.y += p.vy;

      // Wrap edges
      if (p.x < -10) p.x = W + 10;
      if (p.x > W + 10) p.x = -10;
      if (p.y < -10) p.y = H + 10;
      if (p.y > H + 10) p.y = -10;
    });

    requestAnimationFrame(draw);
  }

  resize();
  initParticles();
  draw();
  window.addEventListener('resize', () => { resize(); initParticles(); });
}

/* ─────────────────────────────────────────────────────────────
   3. CURSOR SPOTLIGHT
───────────────────────────────────────────────────────────── */
function initCursorLight() {
  const light = document.getElementById('cursorLight');
  if (!light) return;

  document.addEventListener('mousemove', e => {
    light.style.left = e.clientX + 'px';
    light.style.top  = e.clientY + 'px';
  });
}

/* ─────────────────────────────────────────────────────────────
   4. TAB SWITCHER
   Slides the gold pill and swaps visible panels
───────────────────────────────────────────────────────────── */
function initTabs() {
  const tabLogin    = document.getElementById('tabLogin');
  const tabRegister = document.getElementById('tabRegister');
  const panelLogin  = document.getElementById('panelLogin');
  const panelReg    = document.getElementById('panelRegister');
  const slider      = document.getElementById('tabSlider');

  if (!tabLogin || !tabRegister) return;

  function showTab(which) {
    const isLogin = which === 'login';

    // Tabs
    tabLogin.classList.toggle('tab--active', isLogin);
    tabRegister.classList.toggle('tab--active', !isLogin);
    tabLogin.setAttribute('aria-selected', String(isLogin));
    tabRegister.setAttribute('aria-selected', String(!isLogin));

    // Slider
    slider?.classList.toggle('tab-slider--right', !isLogin);

    // Panels
    panelLogin?.classList.toggle('hidden', !isLogin);
    panelReg?.classList.toggle('hidden', isLogin);

    // Trigger stagger animations
    const activePanel = isLogin ? panelLogin : panelReg;
    if (activePanel) {
      activePanel.classList.remove('panel--visible');
      // Force reflow then re-add
      void activePanel.offsetWidth;
      activePanel.classList.add('panel--visible');
    }
  }

  tabLogin.addEventListener('click',    () => showTab('login'));
  tabRegister.addEventListener('click', () => showTab('register'));

  // Deep-link: if URL has #register open register tab
  if (window.location.hash === '#register') {
    showTab('register');
  } else {
    showTab('login');
  }
}

/* ─────────────────────────────────────────────────────────────
   5. PASSWORD EYE TOGGLES
───────────────────────────────────────────────────────────── */
function initEyeToggle(btnId, inputId) {
  const btn   = document.getElementById(btnId);
  const input = document.getElementById(inputId);
  if (!btn || !input) return;

  btn.addEventListener('click', () => {
    const hidden = input.type === 'password';
    input.type = hidden ? 'text' : 'password';
    btn.querySelector('.eye--open')?.classList.toggle('hidden', hidden);
    btn.querySelector('.eye--closed')?.classList.toggle('hidden', !hidden);
    btn.setAttribute('aria-label', hidden ? 'Hide password' : 'Show password');
  });
}

/* ─────────────────────────────────────────────────────────────
   6. PASSWORD STRENGTH METER
───────────────────────────────────────────────────────────── */
function initStrengthMeter(inputId, rowId, fillId, wordId) {
  const input = document.getElementById(inputId);
  const row   = document.getElementById(rowId);
  const fill  = document.getElementById(fillId);
  const word  = document.getElementById(wordId);
  if (!input || !row) return;

  const LEVELS = [
    { cls: '',      label: '' },
    { cls: 'str-1', label: 'Weak' },
    { cls: 'str-2', label: 'Fair' },
    { cls: 'str-3', label: 'Good' },
    { cls: 'str-4', label: 'Strong' },
  ];

  input.addEventListener('input', () => {
    const v = input.value;
    if (!v) { row.className = 'strength-row'; if (word) word.textContent = ''; return; }

    let score = 0;
    if (v.length >= 8)                        score++;
    if (v.length >= 12)                       score++;
    if (/[A-Z]/.test(v) && /[a-z]/.test(v))  score++;
    if (/[0-9]/.test(v))                      score++;
    if (/[^A-Za-z0-9]/.test(v))              score++;
    score = Math.min(4, score);

    const lvl = LEVELS[score];
    row.className = `strength-row ${lvl.cls}`;
    if (word) word.textContent = lvl.label;
  });
}

/* ─────────────────────────────────────────────────────────────
   7. VALIDATION HELPERS
───────────────────────────────────────────────────────────── */
const $ = id => document.getElementById(id);
const isEmail  = v => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());

function markError(inputEl, errorEl, msg) {
  inputEl?.classList.add('input--error');
  if (errorEl) errorEl.textContent = msg;
  errorEl?.classList.remove('hidden');
}
function clearErr(inputEl, errorEl) {
  inputEl?.classList.remove('input--error');
  errorEl?.classList.add('hidden');
}
const show = el => el?.classList.remove('hidden');
const hide = el => el?.classList.add('hidden');

function setLoading(btnId, loading) {
  const btn     = $(btnId);
  if (!btn) return;
  btn.disabled  = loading;
  const label   = btn.querySelector('.btn-label');
  const spinner = btn.querySelector('.btn-spinner');
  const arrow   = btn.querySelector('.btn-arrow');
  if (loading) { label && hide(label); arrow && hide(arrow); spinner && show(spinner); }
  else         { label && show(label); arrow && show(arrow); spinner && hide(spinner); }
}

/* ─────────────────────────────────────────────────────────────
   8. LOGIN FORM
───────────────────────────────────────────────────────────── */
function initLoginForm() {
  const form    = $('loginForm');
  if (!form) return;

  const emailIn = $('loginEmail');
  const pwdIn   = $('loginPassword');
  const emailEr = $('loginEmailErr');
  const pwdEr   = $('loginPwdErr');
  const errBan  = $('loginError');
  const errMsg  = $('loginErrorMsg');

  // Live clear errors
  emailIn?.addEventListener('input', () => clearErr(emailIn, emailEr));
  pwdIn?.addEventListener('input',   () => clearErr(pwdIn, pwdEr));

  form.addEventListener('submit', async e => {
    e.preventDefault();
    hide(errBan);

    let valid = true;

    if (!isEmail(emailIn?.value || '')) {
      markError(emailIn, emailEr, 'Enter a valid email address.'); valid = false;
    } else { clearErr(emailIn, emailEr); }

    if (!pwdIn?.value) {
      markError(pwdIn, pwdEr, 'Password is required.'); valid = false;
    } else { clearErr(pwdIn, pwdEr); }

    if (!valid) return;

    setLoading('loginBtn', true);

    try {
      const res  = await fetch(`${API}/auth/login`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ email: emailIn.value.trim(), password: pwdIn.value }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        if (errMsg) errMsg.textContent = data.message || 'Invalid email or password.';
        show(errBan);
        errBan?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        return;
      }

      // Store JWT
      const token = data.token || data.accessToken;
      if (token) {
        const storage = $('rememberMe')?.checked ? localStorage : sessionStorage;
        storage.setItem('mp_token', token);
        if (data.user) storage.setItem('mp_user', JSON.stringify(data.user));
      }

      window.location.href = 'dashboard.html';

    } catch {
      if (errMsg) errMsg.textContent = 'Cannot reach the server. Please try again.';
      show(errBan);
    } finally {
      setLoading('loginBtn', false);
    }
  });
}

/* ─────────────────────────────────────────────────────────────
   9. REGISTER FORM
───────────────────────────────────────────────────────────── */
function initRegisterForm() {
  const form = $('registerForm');
  if (!form) return;

  const nameIn  = $('regName');
  const emailIn = $('regEmail');
  const pwdIn   = $('regPassword');
  const confIn  = $('regConfirm');
  const terms   = $('agreeTerms');

  const nameEr  = $('regNameErr');
  const emailEr = $('regEmailErr');
  const pwdEr   = $('regPwdErr');
  const confEr  = $('regConfirmErr');
  const errBan  = $('registerError');
  const errMsg  = $('registerErrorMsg');
  const okBan   = $('registerSuccess');

  // Live clear errors
  nameIn?.addEventListener('input',  () => clearErr(nameIn,  nameEr));
  emailIn?.addEventListener('input', () => clearErr(emailIn, emailEr));
  pwdIn?.addEventListener('input',   () => clearErr(pwdIn,   pwdEr));
  confIn?.addEventListener('input',  () => clearErr(confIn,  confEr));

  form.addEventListener('submit', async e => {
    e.preventDefault();
    hide(errBan); hide(okBan);

    let valid = true;

    if (!nameIn?.value.trim() || nameIn.value.trim().length < 2) {
      markError(nameIn, nameEr, 'Please enter your full name.'); valid = false;
    } else { clearErr(nameIn, nameEr); }

    if (!isEmail(emailIn?.value || '')) {
      markError(emailIn, emailEr, 'Enter a valid email address.'); valid = false;
    } else { clearErr(emailIn, emailEr); }

    if (!pwdIn?.value || pwdIn.value.length < 8) {
      markError(pwdIn, pwdEr, 'Password must be at least 8 characters.'); valid = false;
    } else { clearErr(pwdIn, pwdEr); }

    if (confIn?.value !== pwdIn?.value) {
      markError(confIn, confEr, "Passwords don't match."); valid = false;
    } else { clearErr(confIn, confEr); }

    if (!terms?.checked) { valid = false; }

    if (!valid) return;

    setLoading('registerBtn', true);

    try {
      const res  = await fetch(`${API}/auth/register`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          name:     nameIn.value.trim(),
          email:    emailIn.value.trim(),
          password: pwdIn.value,
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        if (errMsg) errMsg.textContent = data.message || 'Registration failed.';
        show(errBan);
        errBan?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        return;
      }

      show(okBan);
      form.reset();

      const token = data.token || data.accessToken;
      if (token) {
        sessionStorage.setItem('mp_token', token);
        if (data.user) sessionStorage.setItem('mp_user', JSON.stringify(data.user));
      }

      setTimeout(() => {
        window.location.href = data.redirectTo || 'dashboard.html';
      }, 1600);

    } catch {
      if (errMsg) errMsg.textContent = 'Cannot reach the server. Please try again.';
      show(errBan);
    } finally {
      setLoading('registerBtn', false);
    }
  });
}

/* ─────────────────────────────────────────────────────────────
   10. INIT
───────────────────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
  initCanvas();
  initCursorLight();
  initTabs();

  // Eye toggles
  initEyeToggle('loginEyeBtn',  'loginPassword');
  initEyeToggle('regEyeBtn',    'regPassword');

  // Strength meter
  initStrengthMeter('regPassword', 'strengthRow', 'strengthFill', 'strengthWord');

  // Forms
  initLoginForm();
  initRegisterForm();
});