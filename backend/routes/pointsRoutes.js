const express = require("express");
const router = express.Router();
const User = require("../models/User");
const authMiddleware = require("../middleware/authMiddleware");

// Add eco points + Update History
router.post("/add", authMiddleware, async (req, res) => {
  try {
    const { points, item, category } = req.body; // ✅ Accepting item details

    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    // Update Stats
    user.ecoPoints += points;
    user.scans += 1; // ✅ Increment Scan Count
    
    // Add to History if item is provided (skip for welcome bonus)
    if (item) {
      user.history.push({ item, category });
    }

    await user.save();

    res.json({
      message: "Points added",
      ecoPoints: user.ecoPoints,
      scans: user.scans,
      history: user.history
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to add points" });
  }
});

module.exports = router;