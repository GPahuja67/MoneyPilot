const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// MongoDB Connection
mongoose.connect("mongodb://127.0.0.1:27017/moneypilot")
.then(() => console.log("MongoDB Connected"))
.catch((err) => console.log(err));


// Test Route
app.get("/", (req, res) => {
    res.send("MoneyPilot Backend Running");
});

// Server
const PORT = 5000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});