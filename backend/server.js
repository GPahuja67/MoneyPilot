const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const path = require("path");

const expenseRoutes = require("./routes/expenseRoutes");
const authRoutes = require("./routes/authRoutes");

app.use("/api",authRoutes);
const app = express();

app.use(cors());
app.use(express.json());

// Serve frontend files
app.use(express.static(path.join(__dirname, "../frontend")));

mongoose.connect("mongodb://127.0.0.1:27017/moneypilot")
.then(()=>console.log("MongoDB Connected"))
.catch(err=>console.log(err));

app.use("/api", expenseRoutes);

// Open dashboard on localhost
app.get("/", (req,res)=>{
    res.sendFile(path.join(__dirname, "../frontend/pages/dashboard.html"));
});

app.listen(5000, ()=>{
    console.log("Server running on port 5000");
});