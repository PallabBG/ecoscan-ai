// app.js - Fixed Manual Logic & Logged Out UX
// At the top with Global Refs:
const fileInput = document.getElementById("fileInput");
const cameraInput = document.getElementById("cameraInput"); // <--- ADD THIS
const uploadBtn = document.getElementById("uploadBtn");
const analyzeBtn = document.getElementById("analyzeBtn");
const preview = document.getElementById("preview");
const resultContainer = document.getElementById("result");
const choicesContainer = document.getElementById("choicesContainer");
const findCentersBtn = document.getElementById("findCentersBtn");
const mapSection = document.getElementById("mapSection");

let selectedFile = null;
let lastScanData = null;
let map = null;
let markersLayer = null;

// --- Auth Helpers ---
function isLoggedIn() { return !!localStorage.getItem("token"); }
function getToken() { return localStorage.getItem("token"); }
function getUser() { 
  const u = localStorage.getItem("user");
  return u ? JSON.parse(u) : {};
}

// --- Menu Toggles ---
function toggleProfileMenu() {
  const m = document.getElementById("profileMenu");
  if(m) m.classList.toggle("hidden");
}
function toggleGuide() {
  const m = document.getElementById("guideModal");
  if(m) m.classList.toggle("hidden");
}
// --- ADD THESE NEW FUNCTIONS ---
function openUploadModal() {
  document.getElementById("uploadModal").classList.remove("hidden");
}

function closeUploadModal() {
  document.getElementById("uploadModal").classList.add("hidden");
}

function triggerCamera() {
  closeUploadModal();
  cameraInput.click(); 
}

function triggerGallery() {
  closeUploadModal();
  fileInput.click();   
}
// --- History Logic ---
function openHistory() {
  if (!isLoggedIn()) {
    alert("Please Login to view your History 🔒");
    return;
  }
  document.getElementById("historyModal").classList.remove("hidden");
  renderHistory();
}
function closeHistory() {
  document.getElementById("historyModal").classList.add("hidden");
}

function renderHistory() {
  const user = getUser();
  const list = document.getElementById("historyList");
  const history = user.history || [];

  if (history.length === 0) {
    list.innerHTML = "<p style='text-align:center;color:#999;padding:20px'>No scans yet. Start recycling! 🌱</p>";
    return;
  }

  const sorted = [...history].reverse(); 
  list.innerHTML = sorted.map(h => `
    <div class="history-item">
      <div>
        <div style="font-weight:600">${h.item}</div>
        <div class="h-date">${new Date(h.date).toLocaleDateString()} ${new Date(h.date).toLocaleTimeString()}</div>
      </div>
      <div class="h-cat">${h.category}</div>
    </div>
  `).join("");
}

// --- Leaderboard Logic ---
async function openLeaderboard() {
  if (!isLoggedIn()) {
    alert("Please Login to view the Leaderboard 🏆");
    return;
  }

  const modal = document.getElementById("leaderboardModal");
  if(modal) modal.classList.remove("hidden");
  
  const list = document.getElementById("leaderboardList");
  list.innerHTML = "<p>Loading...</p>";

  try {
    const res = await fetch(`${window.BACKEND_URL}/api/leaderboard`);
    let users = await res.json();
    users.sort((a,b) => b.ecoPoints - a.ecoPoints);
    
    const myName = getUser().name;
    
    list.innerHTML = users.map((u, i) => {
      const rankClass = i === 0 ? "rank-1" : i === 1 ? "rank-2" : i === 2 ? "rank-3" : "";
      const isMe = u.name === myName ? "current-user-highlight" : "";
      return `
        <div class="leaderboard-item ${isMe}">
          <div class="rank-info">
            <div class="rank-num ${rankClass}">${i + 1}</div>
            <span>${u.name} ${u.name === myName ? "(You)" : ""}</span>
          </div>
          <span class="l-points">${u.ecoPoints} pts</span>
        </div>
      `;
    }).join("");
  } catch (err) {
    list.innerHTML = "<p style='color:red'>Failed to load leaderboard.</p>";
  }
}

function closeLeaderboard() {
  document.getElementById("leaderboardModal").classList.add("hidden");
}

// --- Points Logic ---
async function addEcoPoints(points, itemData) {
  const token = getToken();
  if (!token) return;

  // 1. Optimistic Update
  const user = getUser();
  user.ecoPoints = (user.ecoPoints || 0) + points;
  user.scans = (user.scans || 0) + 1;
  
  if(!user.history) user.history = [];
  user.history.push({ 
    item: itemData.item, 
    category: itemData.category, 
    date: new Date() 
  });

  localStorage.setItem("user", JSON.stringify(user));
  updateUserUI(user);

  // 2. Sync
  try {
    const res = await fetch(`${window.BACKEND_URL}/api/points/add`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
      body: JSON.stringify({ points, item: itemData.item, category: itemData.category })
    });
    
    if(res.ok) {
      const data = await res.json();
      user.ecoPoints = data.ecoPoints;
      user.scans = data.scans;
      user.history = data.history;
      localStorage.setItem("user", JSON.stringify(user));
      updateUserUI(user);
    }
  } catch (e) { console.error("Sync error", e); }
}

function updateUserUI(user) {
  const headerPoints = document.getElementById("headerPoints");
  const profileCircle = document.getElementById("profileCircle");
  
  const dName = document.getElementById("dropdownName");
  const dEmail = document.getElementById("dropdownEmail");
  const dPoints = document.getElementById("dropdownPoints");
  const dScans = document.getElementById("dropdownScans");

  if (headerPoints) headerPoints.textContent = user.ecoPoints || 0;
  if (profileCircle) profileCircle.textContent = user.name ? user.name.charAt(0).toUpperCase() : "U";

  if (dName) dName.textContent = user.name;
  if (dEmail) dEmail.textContent = user.email;
  if (dPoints) dPoints.textContent = user.ecoPoints || 0;
  if (dScans) dScans.textContent = user.scans || 0;
}

// --- NEW: Fetch Latest Data from Backend (Sync) ---
async function fetchUserProfile() {
  const token = getToken();
  if (!token) return;

  try {
    const res = await fetch(`${window.BACKEND_URL}/api/auth/me`, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json"
      }
    });

    if (res.ok) {
      const user = await res.json();
      // ✅ Update LocalStorage with the fresh DB data
      localStorage.setItem("user", JSON.stringify(user));
      // ✅ Update UI immediately
      updateUserUI(user);
    }
  } catch (err) {
    console.error("Failed to sync user profile:", err);
  }
}

// --- Initialization ---
document.addEventListener("DOMContentLoaded", () => {
  const authActions = document.getElementById("authActions");
  const userActions = document.getElementById("userActions");
  
  // 1. Load initial view from LocalStorage (Fast)
  const user = getUser();

  if (isLoggedIn() && user.name) {
    if(authActions) authActions.classList.add("hidden");
    if(userActions) userActions.classList.remove("hidden");
    
    updateUserUI(user); // Show cached data first
    
    // 2. TRIGGER SYNC (Fixes the 0 issue)
    fetchUserProfile(); 

    // Welcome Bonus Check
    if ((user.ecoPoints === undefined || user.ecoPoints === 0) && (!user.history || user.history.length === 0)) {
       // Only trigger if we are sure it's a new user (optional: wait for sync)
       // You might want to move this inside fetchUserProfile to be safer
    }
  } else {
    if(userActions) userActions.classList.add("hidden");
    if(authActions) authActions.classList.remove("hidden");
  }
});
// --- CORE: AI Identification ---
// FIND THIS SECTION AND UPDATE IT:

// 1. CHANGE the uploadBtn listener to open the modal:
uploadBtn.addEventListener("click", openUploadModal); 

// 2. KEEP your existing fileInput listener:
fileInput.addEventListener("change", onFileSelected);

// 3. ADD this new listener for the camera:
cameraInput.addEventListener("change", onFileSelected);
analyzeBtn.addEventListener("click", analyze);
findCentersBtn.addEventListener("click", findNearbyCenters);

function onFileSelected(e){
  const f = e.target.files?.[0];
  if(!f) return;
  selectedFile = f;
  
  const reader = new FileReader();
  reader.onload = () => {
    preview.innerHTML = `<img src="${reader.result}" style="width:100%;height:100%;object-fit:cover;border-radius:8px" />`;
    analyzeBtn.disabled = false;
    resultContainer.innerHTML = "<span>Ready to identify — click Identify</span>";
    choicesContainer.classList.add("hidden");
    if(findCentersBtn) findCentersBtn.style.display = "none";
  };
  reader.readAsDataURL(f);
}

async function analyze(){
  if(!selectedFile){ alert("Choose a photo first."); return; }
  
  resultContainer.innerHTML = "🔍 Identifying (via Secure Backend)...";
  const base64 = await toBase64(selectedFile);

  try {
    // Call YOUR backend, not Google directly
    const res = await fetch(`${window.BACKEND_URL}/api/analyze`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ imageBase64: base64 }),
    });

    const data = await res.json();
    if(data.error) throw new Error(data.error);

    // Parse logic (same as before)
    const text = extractTextFromGeminiResponse(data);
    if(!text) throw new Error("No text returned from AI");

    const cleaned = text.replace(/```json/g, "").replace(/```/g, "").trim();
    let parsed;
    try { parsed = JSON.parse(cleaned); } catch (err){ throw new Error("AI response not valid JSON"); }

    lastScanData = {
      item: parsed.item || "Unknown item",
      category: parsed.category || "Landfill",
      instruction: parsed.instruction || "Dispose carefully.",
      source: "gemini-vision"
    };

    renderResult(lastScanData);
    if(findCentersBtn) findCentersBtn.style.display = "inline-block";

    if (isLoggedIn()) {
      addEcoPoints(5, lastScanData);
    }

  } catch (err) {
    console.error("Analyze failed:", err);
    resultContainer.innerHTML = "⚠️ AI failed. Trying manual mode.";
    showConfirmationChoices(selectedFile);
  }
}

// --- HELPERS ---
function extractTextFromGeminiResponse(data){
  try {
    if(data.candidates && data.candidates[0].content && data.candidates[0].content.parts){
      return data.candidates[0].content.parts[0].text;
    }
  } catch(e){}
  return null;
}

function toBase64(file){ 
  return new Promise((resolve,reject)=>{ 
    const r=new FileReader(); r.onload=()=> resolve(r.result.split(",")[1]); r.onerror=reject; r.readAsDataURL(file); 
  }); 
}

function renderResult(data){
  // Check Login for message
  const pointsMsg = isLoggedIn() 
    ? `<div style="margin-top:8px;font-size:12px;color:#10b981; text-align:right; font-weight:bold;">+5 Pts added! 🎉</div>`
    : `<div style="margin-top:8px;font-size:12px;color:#f59e0b; text-align:right; font-style:italic;">Login to save points! 🔒</div>`;

  resultContainer.innerHTML = `
    <div class="result-title">🧾 ${escapeHtml(data.item)}</div>
    <ul class="result-list">
      <li><strong>Category:</strong> ${escapeHtml(data.category)}</li>
      <li><strong>Bin:</strong> ${getBinFromCategory(data.category)}</li>
      <li><strong>Action:</strong> ${escapeHtml(data.instruction)}</li>
    </ul>
    ${pointsMsg}
  `;
}

function getBinFromCategory(cat){
  const c = (cat||"").toLowerCase();
  if(c.includes("recycl")) return "Blue Bin 🟦";
  if(c.includes("compost")) return "Green Bin 🟩";
  if(c.includes("e-waste")) return "Red Bin 🟥 (E-waste)";
  return "Red Bin 🟥";
}

function escapeHtml(s){ 
  if(!s) return ""; 
  return String(s).replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;"); 
}

// --- FIXED MANUAL FALLBACK ---
function showConfirmationChoices(file){
  choicesContainer.innerHTML = "";
  choicesContainer.classList.remove("hidden");

  const options = [
    {id:"plastic", label:"Plastic"},
    {id:"food", label:"Food"},
    {id:"ewaste", label:"E-waste"},
    {id:"other", label:"Other"}
  ];

  options.forEach(opt=>{
    const btn = document.createElement("button");
    btn.className = "choice-btn";
    btn.textContent = opt.label;
    
    btn.onclick = () => {
      // ✅ FIX: Use helper to get correct category
      const mapping = mapManualCategory(opt.id);
      
      lastScanData = { 
        item: opt.label, 
        category: mapping.category, 
        instruction: mapping.instruction 
      };
      
      renderResult(lastScanData);
      choicesContainer.classList.add("hidden");
      if(findCentersBtn) findCentersBtn.style.display = "inline-block";
      
      if(isLoggedIn()) addEcoPoints(5, lastScanData);
    };
    choicesContainer.appendChild(btn);
  });
}

// ✅ NEW HELPER FOR MANUAL MAPPING
function mapManualCategory(type) {
  if (type === "plastic") return { category: "Recyclable", instruction: "Rinse and place in Blue Bin." };
  if (type === "food") return { category: "Compost", instruction: "Place in Green Bin." };
  if (type === "ewaste") return { category: "E-waste", instruction: "Drop off at E-waste center." };
  return { category: "Landfill", instruction: "Dispose in Red Bin." };
}

// Map Logic
async function findNearbyCenters(){
  if(!lastScanData){ alert("Identify item first."); return; }
  
  const resultBox = document.getElementById("result");
  // Remove old status if exists
  const oldStatus = document.getElementById("places-status");
  if(oldStatus) oldStatus.remove();

  // Show Loading Status
  const status = document.createElement("div");
  status.id = "places-status";
  status.style.marginTop = "10px";
  status.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Finding nearby centers...`;
  resultBox.appendChild(status);

  if(!navigator.geolocation){
    status.textContent = "❌ Geolocation is disabled.";
    return;
  }

  navigator.geolocation.getCurrentPosition(async (pos) => {
    try {
      const lat = pos.coords.latitude;
      const lng = pos.coords.longitude;
      
      const res = await fetch(`${window.BACKEND_URL}/api/places?lat=${lat}&lng=${lng}`);
      const places = await res.json();
      
      status.remove(); // Remove loading text
      renderPlaces(places, lat, lng);
      
    } catch (e) {
      console.error(e);
      status.textContent = "❌ Failed to connect to map server.";
    }
  }, (err) => {
    status.textContent = "❌ Location permission denied.";
  });
}

function renderPlaces(places, lat, lng){
  const mapSection = document.getElementById("mapSection");
  mapSection.classList.remove("hidden"); // Force show container
  
  // CASE 1: No Places Found
  if (!places || places.length === 0) {
    // Destroy map if it exists so it doesn't overlap text
    if(map) { map.remove(); map = null; }
    
    mapSection.innerHTML = `
      <div style="background:#f1f5f9; padding:20px; border-radius:12px; text-align:center; color:#64748b;">
        <i class="fa-solid fa-map-location-dot" style="font-size:30px; margin-bottom:10px; display:block;"></i>
        <strong>No centers found nearby.</strong>
        <p style="font-size:12px; margin:5px 0 0;">Try searching your local municipal website.</p>
      </div>
    `;
    return;
  }

  // CASE 2: Places Found -> Render Map
  // Reset HTML in case "No centers" was previously shown
  if(!document.getElementById("map")) {
     mapSection.innerHTML = '<div id="map" style="height:300px; width:100%;"></div>';
  }

  // Initialize Map
  if(!map){ 
    map = L.map("map").setView([lat, lng], 13); 
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '© OpenStreetMap'
    }).addTo(map); 
    markersLayer = L.layerGroup().addTo(map); 
  } else { 
    markersLayer.clearLayers(); 
    map.invalidateSize(); // Fix gray map glitch
  }
  
  // Add User Marker
  L.marker([lat, lng]).addTo(markersLayer).bindPopup("<b>You are here</b>").openPopup();
  
  // Add Place Markers
  places.forEach(p => { 
    if(p.location) {
      L.marker([p.location.lat, p.location.lng])
       .addTo(markersLayer)
       .bindPopup(`<b>${p.name}</b><br>${p.address || ''}`); 
    }
  });
  
  // Fit map to show all markers
  const group = new L.featureGroup(places.map(p => L.marker([p.location.lat, p.location.lng])));
  group.addLayer(L.marker([lat, lng])); // Include user
  map.fitBounds(group.getBounds().pad(0.2));
}

function logout() {
  localStorage.removeItem("token");
  localStorage.removeItem("user");
  window.location.reload();
}