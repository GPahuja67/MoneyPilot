const express = require("express");
const router = express.Router();
const Expense = require("../models/Expense");

// Add Expense
router.post("/add-expense", async (req, res) => {
    try {
        const { amount, category, note, date } = req.body;

        const newExpense = new Expense({
            amount,
            category,
            note,
            date
        });

        const savedExpense = await newExpense.save();
        res.status(201).json(savedExpense);

    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});


// Get All Expenses
router.get("/expenses", async (req, res) => {
    try {
        const expenses = await Expense.find().sort({ date: -1 });
        res.json(expenses);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});


// Delete Expense
router.delete("/expense/:id", async (req, res) => {
    try {
        await Expense.findByIdAndDelete(req.params.id);
        res.json({ message: "Expense deleted" });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

module.exports = router;