const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const path = require("path");

const expenseRoutes = require("./routes/expenseRoutes");
const authRoutes = require("./routes/authRoutes");

const app = express();   // ✅ create app first

// middleware
app.use(cors());
app.use(express.json());

// routes
app.use("/api", expenseRoutes);
app.use("/api", authRoutes);

// serve frontend
app.use(express.static(path.join(__dirname, "../frontend")));

// database connection
mongoose.connect("mongodb://127.0.0.1:27017/moneypilot")
.then(()=>console.log("MongoDB Connected"))
.catch(err=>console.log(err));

// open login page first
app.get("/", (req,res)=>{
    res.sendFile(path.join(__dirname,"../frontend/pages/login.html"));
});
app.get("/register", (req,res)=>{
res.sendFile(path.join(__dirname,"../frontend/pages/register.html"));
});

// start server
app.listen(5000, ()=>{
    console.log("Server running on port 5000");
});