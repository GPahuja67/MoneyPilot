/**
 * MoneyPilot — login.js
 * Handles login form submission, validation, JWT storage, and redirect.
 */

const API_BASE = "http://localhost:5000/api";

// ── DOM refs ────────────────────────────────────────────────────────────────
const form      = document.getElementById("loginForm");
const emailEl   = document.getElementById("email");
const passwordEl= document.getElementById("password");
const btn       = document.getElementById("loginBtn");
const alertBox  = document.getElementById("alert");
const pwToggle  = document.getElementById("pwToggle");

// ── Password visibility toggle ───────────────────────────────────────────────
pwToggle.addEventListener("click", () => {
  const isText = passwordEl.type === "text";
  passwordEl.type = isText ? "password" : "text";
  pwToggle.querySelector("svg").style.opacity = isText ? "1" : "0.5";
});

// ── Alert helpers ─────────────────────────────────────────────────────────────
function showAlert(message, type = "error") {
  alertBox.textContent = message;
  alertBox.className   = `alert ${type}`;
}

function hideAlert() {
  alertBox.className = "alert";
  alertBox.textContent = "";
}

// ── Validation ────────────────────────────────────────────────────────────────
function validate(email, password) {
  if (!email.trim()) {
    showAlert("Please enter your email address.");
    emailEl.focus();
    return false;
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    showAlert("Please enter a valid email address.");
    emailEl.focus();
    return false;
  }

  if (!password) {
    showAlert("Please enter your password.");
    passwordEl.focus();
    return false;
  }

  if (password.length < 6) {
    showAlert("Password must be at least 6 characters.");
    passwordEl.focus();
    return false;
  }

  return true;
}

// ── Loading state ─────────────────────────────────────────────────────────────
function setLoading(loading) {
  if (loading) {
    btn.classList.add("loading");
    btn.textContent = "Signing in…";
  } else {
    btn.classList.remove("loading");
    btn.innerHTML = '<span class="btn-shine"></span>Sign In';
  }
}

// ── Form submit ───────────────────────────────────────────────────────────────
form.addEventListener("submit", async (e) => {
  e.preventDefault();
  hideAlert();

  const email    = emailEl.value.trim();
  const password = passwordEl.value;

  if (!validate(email, password)) return;

  setLoading(true);

  try {
    const response = await fetch(`${API_BASE}/login`, {
      method : "POST",
      headers: { "Content-Type": "application/json" },
      body   : JSON.stringify({ email, password }),
    });

    const data = await response.json();

    if (!response.ok) {
      // Server returned an error (4xx / 5xx)
      const message =
        data.message || data.error || "Invalid credentials. Please try again.";
      showAlert(message);
      return;
    }

    // ── Success ──────────────────────────────────────────────────────────────
    const token = data.token;

    if (!token) {
      showAlert("Login succeeded but no token was returned. Please contact support.");
      return;
    }

    // Store token
    localStorage.setItem("mp_token", token);

    // Optionally persist email for "remember me"
    const remember = document.getElementById("remember").checked;
    if (remember) {
      localStorage.setItem("mp_remembered_email", email);
    } else {
      localStorage.removeItem("mp_remembered_email");
    }

    showAlert("Login successful! Redirecting…", "success");

    // Redirect to dashboard
    setTimeout(() => {
      window.location.href = "/dashboard";
    }, 600);

  } catch (err) {
    // Network error / server unreachable
    console.error("Login error:", err);
    showAlert("Unable to reach the server. Please check your connection.");
  } finally {
    setLoading(false);
  }
});

// ── Pre-fill remembered email on page load ───────────────────────────────────
window.addEventListener("DOMContentLoaded", () => {
  const saved = localStorage.getItem("mp_remembered_email");
  if (saved) {
    emailEl.value = saved;
    document.getElementById("remember").checked = true;
  }
});

// ── Redirect if already logged in ────────────────────────────────────────────
(function checkAuth() {
  const token = localStorage.getItem("mp_token");
  if (token) {
    window.location.href = "/dashboard";
  }
})();