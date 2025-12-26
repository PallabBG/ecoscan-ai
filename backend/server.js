// server.js - backend for EcoScan AI (auth, points, stats, places)
const express = require("express");
const multer = require("multer");
require("dotenv").config();
const fetch = global.fetch || require('node-fetch');
const mongoose = require("mongoose");
const app = express();
const cors = require("cors");

// IMPORTANT: handle preflight
app.use(cors({
  origin: ["http://127.0.0.1:5500", "http://localhost:5500"],
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"]
}));


const PORT = process.env.PORT || 5000;
app.use(express.json());
const upload = multer();
const authRoutes = require("./routes/authRoutes");
app.use("/api/auth", authRoutes);

const pointsRoutes = require("./routes/pointsRoutes");

app.use("/api/points", pointsRoutes);


mongoose.connect(process.env.MONGO_URI, {
  serverSelectionTimeoutMS: 10000
})
.then(() => console.log("✅ MongoDB connected"))
.catch(err => console.error("❌ MongoDB connection error:", err));

// routes
app.use("/api/auth", authRoutes);

app.get("/", (req, res) => {
  res.send("EcoScan backend running");
});
// ... existing imports ...
const User = require("./models/User"); // Ensure User model is imported

// ... existing code ...

// ✅ NEW: Real-time Leaderboard Endpoint
app.get("/api/leaderboard", async (req, res) => {
  try {
    // Get top 10 users sorted by points (descending)
    const users = await User.find({}, "name ecoPoints").sort({ ecoPoints: -1 }).limit(10);
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch leaderboard" });
  }
});

// ... app.listen ...
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
//
// Simple in-memory stores (demo). Replace with DB in production.
//
const users = {}; // { email: { password, points, scans } }
let totalScans = 0;


// Places: Overpass (OpenStreetMap)
app.get("/api/places", async (req, res) => {
  console.log("📍 /api/places called:", req.query);
  try {
    const { lat, lng } = req.query;
    if (!lat || !lng) return res.status(400).json({ error: "lat,lng required" });

    const radius = 5000;
    const clat = parseFloat(lat), clng = parseFloat(lng);

    const overpassQuery = `
[out:json][timeout:60];
(
  node(around:${radius},${clat},${clng})["amenity"="recycling"];
  node(around:${radius},${clat},${clng})["recycling"~".+"];
  node(around:${radius},${clat},${clng})["amenity"="waste_disposal"];
  way(around:${radius},${clat},${clng})["amenity"="recycling"];
  way(around:${radius},${clat},${clng})["recycling"~".+"];
  relation(around:${radius},${clat},${clng})["amenity"="recycling"];
);
out center 20;
`;

    const response = await fetch("https://overpass-api.de/api/interpreter", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: `data=${encodeURIComponent(overpassQuery)}`
    });

    if (!response.ok) {
      const txt = await response.text().catch(()=>"");
      console.error("Overpass failed", response.status, txt);
      return res.status(500).json({ error: "places lookup failed" });
    }

    const json = await response.json();
    const places = (json.elements || []).slice(0, 15).map(el => {
      const latRes = el.lat ?? el.center?.lat;
      const lonRes = el.lon ?? el.center?.lon;
      if (!latRes || !lonRes) return null;
      const name = (el.tags && (el.tags.name || el.tags.operator)) || "Recycling / disposal";
      const address = el.tags && (el.tags["addr:full"] || el.tags["addr:street"] || el.tags["addr:city"]) || "";
      return {
        id: el.id,
        name,
        address,
        location: { lat: latRes, lng: lonRes },
        tags: el.tags || {},
        mapsLink: `https://www.openstreetmap.org/?mlat=${latRes}&mlon=${lonRes}#map=18/${latRes}/${lonRes}`
      };
    }).filter(Boolean);

    return res.json(places);
  } catch (err) {
    console.error("Places error:", err);
    return res.status(500).json({ error: "failed to fetch places" });
  }
});
