/**
 * MoneyPilot — register.js
 * Handles registration form submission, validation, password strength, and redirect.
 */

const API_BASE = "http://localhost:5000/api";

// ── DOM refs ──────────────────────────────────────────────────────────────────
const form           = document.getElementById("registerForm");
const nameEl         = document.getElementById("name");
const emailEl        = document.getElementById("email");
const passwordEl     = document.getElementById("password");
const confirmEl      = document.getElementById("confirmPassword");
const termsEl        = document.getElementById("terms");
const btn            = document.getElementById("registerBtn");
const alertBox       = document.getElementById("alert");
const pwToggle1      = document.getElementById("pwToggle1");
const pwToggle2      = document.getElementById("pwToggle2");
const bars           = [
  document.getElementById("bar1"),
  document.getElementById("bar2"),
  document.getElementById("bar3"),
  document.getElementById("bar4"),
];

// ── Password visibility toggles ───────────────────────────────────────────────
function makeToggle(btn, input) {
  btn.addEventListener("click", () => {
    const isText = input.type === "text";
    input.type = isText ? "password" : "text";
    btn.querySelector("svg").style.opacity = isText ? "1" : "0.5";
  });
}

makeToggle(pwToggle1, passwordEl);
makeToggle(pwToggle2, confirmEl);

// ── Password strength meter ───────────────────────────────────────────────────
function getStrength(pw) {
  let score = 0;
  if (pw.length >= 8)                    score++;
  if (pw.length >= 12)                   score++;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) score++;
  if (/[0-9]/.test(pw))                  score++;
  if (/[^A-Za-z0-9]/.test(pw))          score++;
  // Normalise to 0–4
  return Math.min(4, Math.max(0, Math.round(score * 0.8)));
}

const strengthClasses = ["", "weak", "fair", "good", "strong"];

passwordEl.addEventListener("input", () => {
  const strength = getStrength(passwordEl.value);
  bars.forEach((bar, i) => {
    bar.className = "pw-bar";
    if (i < strength) bar.classList.add(strengthClasses[strength]);
  });
});

// ── Alert helpers ─────────────────────────────────────────────────────────────
function showAlert(message, type = "error") {
  alertBox.textContent = message;
  alertBox.className   = `alert ${type}`;
}

function hideAlert() {
  alertBox.className   = "alert";
  alertBox.textContent = "";
}

// ── Input error highlighting ──────────────────────────────────────────────────
function markInvalid(el) {
  el.classList.add("invalid");
  el.addEventListener("input", () => el.classList.remove("invalid"), { once: true });
}

// ── Validation ────────────────────────────────────────────────────────────────
function validate(name, email, password, confirm) {
  // Name
  if (!name.trim()) {
    showAlert("Please enter your full name.");
    markInvalid(nameEl);
    nameEl.focus();
    return false;
  }

  if (name.trim().length < 2) {
    showAlert("Name must be at least 2 characters.");
    markInvalid(nameEl);
    nameEl.focus();
    return false;
  }

  // Email
  if (!email.trim()) {
    showAlert("Please enter your email address.");
    markInvalid(emailEl);
    emailEl.focus();
    return false;
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    showAlert("Please enter a valid email address.");
    markInvalid(emailEl);
    emailEl.focus();
    return false;
  }

  // Password
  if (!password) {
    showAlert("Please create a password.");
    markInvalid(passwordEl);
    passwordEl.focus();
    return false;
  }

  if (password.length < 8) {
    showAlert("Password must be at least 8 characters.");
    markInvalid(passwordEl);
    passwordEl.focus();
    return false;
  }

  // Confirm
  if (!confirm) {
    showAlert("Please confirm your password.");
    markInvalid(confirmEl);
    confirmEl.focus();
    return false;
  }

  if (password !== confirm) {
    showAlert("Passwords do not match.");
    markInvalid(confirmEl);
    confirmEl.focus();
    return false;
  }

  // Terms
  if (!termsEl.checked) {
    showAlert("Please accept the Terms of Service to continue.");
    return false;
  }

  return true;
}

// ── Loading state ─────────────────────────────────────────────────────────────
function setLoading(loading) {
  if (loading) {
    btn.classList.add("loading");
    btn.textContent = "Creating account…";
  } else {
    btn.classList.remove("loading");
    btn.innerHTML = '<span class="btn-shine"></span>Create Account';
  }
}

// ── Form submit ───────────────────────────────────────────────────────────────
form.addEventListener("submit", async (e) => {
  e.preventDefault();
  hideAlert();

  const name     = nameEl.value.trim();
  const email    = emailEl.value.trim();
  const password = passwordEl.value;
  const confirm  = confirmEl.value;

  if (!validate(name, email, password, confirm)) return;

  setLoading(true);

  try {
    const response = await fetch(`${API_BASE}/register`, {
      method : "POST",
      headers: { "Content-Type": "application/json" },
      body   : JSON.stringify({ name, email, password }),
    });

    const data = await response.json();

    if (!response.ok) {
      const message =
        data.message || data.error || "Registration failed. Please try again.";
      showAlert(message);
      return;
    }

    // ── Success ──────────────────────────────────────────────────────────────
    showAlert("Account created successfully! Redirecting to login…", "success");

    // Clear form
    form.reset();
    bars.forEach(b => (b.className = "pw-bar"));

    // Redirect to login
    setTimeout(() => {
      window.location.href = "/login";
    }, 1800);

  } catch (err) {
    console.error("Registration error:", err);
    showAlert("Unable to reach the server. Please check your connection.");
  } finally {
    setLoading(false);
  }
});

// ── Redirect if already logged in ────────────────────────────────────────────
(function checkAuth() {
  const token = localStorage.getItem("mp_token");
  if (token) {
    window.location.href = "/dashboard";
  }
})();