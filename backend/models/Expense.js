const mongoose = require("mongoose");

const ExpenseSchema = new mongoose.Schema(
{
  amount: Number,
  category: String,
  note: String
},
{
  timestamps: true
}
);

module.exports = mongoose.model("Expense", ExpenseSchema);