const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  ecoPoints: { type: Number, default: 0 },
  scans: { type: Number, default: 0 }, // ✅ Added Scan Count
  history: [ // ✅ Added History Array
    {
      item: String,
      category: String,
      date: { type: Date, default: Date.now }
    }
  ],
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model("User", userSchema);