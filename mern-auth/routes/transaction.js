// routes/transactions.js
const express = require("express");
const Transaction = require("../models/Transaction");
const router = express.Router();

router.get("/", async (req, res) => {
  try {
    const items = await Transaction.find().sort({ createdAt: -1 }).limit(100);
    res.json(items);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch transactions" });
  }
});

module.exports = router;
