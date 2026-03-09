const express = require("express");
const router = express.Router();

const Transaction = require("../models/transaction");


// Add Transaction (income / expense / saving)

router.post("/add-transaction", async (req,res)=>{

 try{

  const {amount,type,category,note} = req.body;

  const transaction = new Transaction({
   amount,
   type,
   category,
   note
  });

  const savedTransaction = await transaction.save();

  res.json(savedTransaction);

 }catch(err){

  res.status(500).json({message:err.message});

 }

});



// Get All Transactions

router.get("/transactions", async (req, res) => {

    try {

        const transactions = await Transaction.find().sort({ createdAt: -1 });

        res.json(transactions);

    } catch (error) {

        res.status(500).json({ message: error.message });

    }

});



// Delete Transaction

router.delete("/transaction/:id", async (req, res) => {

    try {

        await Transaction.findByIdAndDelete(req.params.id);

        res.json({ message: "Transaction deleted" });

    } catch (error) {

        res.status(500).json({ message: error.message });

    }

});



// Finance Summary API

router.get("/finance-summary", async (req,res)=>{

 try{

  const transactions = await Transaction.find();

  const income = transactions
   .filter(t=>t.type==="income")
   .reduce((sum,t)=>sum+t.amount,0);

  const expenses = transactions
   .filter(t=>t.type==="expense")
   .reduce((sum,t)=>sum+t.amount,0);

  const savings = transactions
   .filter(t=>t.type==="saving")
   .reduce((sum,t)=>sum+t.amount,0);

  const balance = income - expenses - savings;

  res.json({
   income,
   expenses,
   savings,
   balance
  });

 }catch(err){

  res.status(500).json({message:err.message});

 }

});


module.exports = router;