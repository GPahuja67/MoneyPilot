const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const path = require("path");

const expenseRoutes = require("./routes/expenseRoutes");
const authRoutes = require("./routes/authRoutes");

const app = express();

/* ─────────────────────────────
   MIDDLEWARE
───────────────────────────── */

app.use(cors());
app.use(express.json());

/* ─────────────────────────────
   API ROUTES
───────────────────────────── */

app.use("/api", expenseRoutes);
app.use("/api", authRoutes);

/* ─────────────────────────────
   STATIC FRONTEND
───────────────────────────── */

app.use(express.static(path.join(__dirname, "../frontend")));

/* ─────────────────────────────
   PAGE ROUTES
───────────────────────────── */

// default → login
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "../frontend/pages/login.html"));
});

// login page
app.get("/login", (req, res) => {
  res.sendFile(path.join(__dirname, "../frontend/pages/login.html"));
});

// register page
app.get("/register", (req, res) => {
  res.sendFile(path.join(__dirname, "../frontend/pages/register.html"));
});

// dashboard page
app.get("/dashboard", (req, res) => {
  res.sendFile(path.join(__dirname, "../frontend/pages/dashboard.html"));
});

/* ─────────────────────────────
   DATABASE
───────────────────────────── */

mongoose.connect("mongodb://127.0.0.1:27017/moneypilot")
.then(() => {
  console.log("✅ MongoDB Connected");
})
.catch(err => {
  console.error("❌ MongoDB connection error:", err);
});

/* ─────────────────────────────
   SERVER
───────────────────────────── */

const PORT = 5000;

app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});