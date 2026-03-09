const mongoose = require("mongoose");

const TransactionSchema = new mongoose.Schema({

 amount: {
  type: Number,
  required: true
 },

 type: {
  type: String,
  enum: ["income","expense","saving"],
  required: true
 },

 category: {
  type: String,
  required: true
 },

 note: {
  type: String
 }

},{
 timestamps:true
});

module.exports = mongoose.model("Transaction",TransactionSchema);