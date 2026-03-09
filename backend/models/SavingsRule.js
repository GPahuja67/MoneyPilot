const mongoose = require("mongoose");

const SavingsRuleSchema = new mongoose.Schema({

 type:{
  type:String,
  enum:["fixed","percentage"]
 },

 value:{
  type:Number,
  required:true
 }

});

module.exports = mongoose.model("SavingsRule",SavingsRuleSchema);