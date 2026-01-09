const mongoose = require("mongoose");

const TransactionSchema = new mongoose.Schema({
  paymentID: { type: String, index: true, unique: true },
  orderID: Number,
  amount: Number,
  orderId: String,
  amount: Number, // in paise 
  currency: String, // INR 
  status: String, // created | success | failed 
  method: String, // card, upi, netbanking... 
  email: String, 
  contact: String,
},
{ timestamps: true }
    );

    module.exports = mongoose.model("Transaction", TransactionSchema);