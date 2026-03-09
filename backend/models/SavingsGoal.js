const mongoose = require("mongoose");

const SavingsGoalSchema = new mongoose.Schema({

 title:{
  type:String,
  required:true
 },

 targetAmount:{
  type:Number,
  required:true
 },

 savedAmount:{
  type:Number,
  default:0
 }

});

module.exports = mongoose.model("SavingsGoal",SavingsGoalSchema);