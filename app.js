/**
 * app.js — EcoGreen
 * All page logic: navigation, scanner, encyclopedia, waste map, eco badges.
 */

// ── State ──
// ── State ──
const S = {
  page: "scanner",
  cameraStream: null,
  facingMode: "environment",
  previewURL: null,
  lastResult: null,
  totalClassified: 0,
  history: [],
};
// ── Achievements ──
const ACHIEVEMENTS = [
  { id:"first_step", title:"First Step", desc:"Classify your first item", icon:"🌱", goal:1 },
  { id:"eco_warrior", title:"Eco Warrior", desc:"Classify 10 items", icon:"♻️", goal:10 },
  { id:"green_hero", title:"Green Hero", desc:"Classify 25 items", icon:"🌳", goal:25 },
  { id:"eco_master", title:"Eco Master", desc:"Classify 50 items", icon:"🏆", goal:50 },
];

// ── DOM ──
const $ = id => document.getElementById(id);

// ── Init ──
(async () => {
  $("yearFooter") && ($("yearFooter").textContent = new Date().getFullYear());
  loadStorage();
  setupFileInput();
  setupDragDrop();
  try { renderBadges(); } catch(e) { console.warn("renderBadges skipped:", e); }
  await initModel();
  renderEncyclopediaDefault();
})();

// ══ MODEL ══
async function initModel() {
  const ms = $("modelStatus");
  ms.innerHTML = `<div class="ms-spinner" id="msSpinner"></div><span id="msText">Loading AI model…</span>`;

  const result = await EcoModel.load((msg, pct) => {
    const t = $("msText"); if (t) t.textContent = msg + ` (${pct}%)`;
  });

  if (result.success) {
    ms.classList.add("ready");
    ms.innerHTML = `<span style="color:var(--green);font-size:.9rem">●</span> <span>AI Ready — ${result.mode === "custom" ? "Custom EcoGreen Model ✅" : "MobileNet Pretrained"}</span>`;
  } else {
    ms.classList.add("error");
    ms.innerHTML = `<span>⚠ Model failed: ${result.error}</span>`;
  }
}

// ══ NAVIGATION ══
function showPage(page) {
  S.page = page;
  document.querySelectorAll(".page").forEach(p => p.classList.remove("active") || p.classList.add("hidden"));
  document.querySelectorAll(".nav-link").forEach(a => a.classList.remove("active"));

  const pg = $(`page-${page}`);
  if (pg) { pg.classList.remove("hidden"); pg.classList.add("active"); }

  const link = document.querySelector(`[data-page="${page}"]`);
  if (link) link.classList.add("active");

  if (page !== "scanner") stopCamera();
}

// ══ SCAN TABS ══
function switchScanTab(tab) {
  $("tabUp").classList.toggle("active", tab==="upload");
  $("tabCam").classList.toggle("active", tab==="camera");
  $("panelUpload").classList.toggle("hidden", tab!=="upload");
  $("panelCamera").classList.toggle("hidden", tab!=="camera");
  if (tab === "camera") startCamera();
  else stopCamera();
}

// ══ FILE INPUT ══
function setupFileInput() {
  $("fileInput").addEventListener("change", e => {
    const f = e.target.files[0]; if (f) handleFile(f);
  });
}
function setupDragDrop() {
  const dz = $("dropzone");
  ["dragenter","dragover"].forEach(ev => dz.addEventListener(ev, e => { e.preventDefault(); dz.classList.add("drag-over"); }));
  ["dragleave","drop"].forEach(ev => dz.addEventListener(ev, e => { e.preventDefault(); dz.classList.remove("drag-over"); }));
  dz.addEventListener("drop", e => {
    const f = e.dataTransfer.files[0];
    if (f?.type.startsWith("image/")) handleFile(f);
    else toast("⚠ Images only");
  });
}
function handleFile(file) {
  if (!file.type.startsWith("image/")) { toast("⚠ Images only"); return; }
  const r = new FileReader();
  r.onload = e => {
    S.previewURL = e.target.result;
    $("previewImg").src = e.target.result;
    $("previewBox").classList.remove("hidden");
    $("dropzone").style.display = "none";
    $("nextPlaceholder").classList.add("hidden");
    $("resultBox").classList.add("hidden");
    S.lastResult = null;
  };
  r.readAsDataURL(file);
}

// ══ CAMERA ══
async function startCamera() {
  $("camErr").classList.add("hidden");
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: S.facingMode, width:{ideal:1280}, height:{ideal:960} }
    });
    S.cameraStream = stream;
    $("videoEl").srcObject = stream;
  } catch {
    $("camErr").classList.remove("hidden");
  }
}
function stopCamera() {
  if (S.cameraStream) {
    S.cameraStream.getTracks().forEach(t => t.stop());
    S.cameraStream = null;
    $("videoEl").srcObject = null;
  }
}
function flipCamera() {
  S.facingMode = S.facingMode === "environment" ? "user" : "environment";
  stopCamera(); startCamera();
}
function closeCamera() { stopCamera(); switchScanTab("upload"); }
function takeSnap() {
  const v = $("videoEl"), c = $("snapCanvas");
  if (!v.videoWidth) { toast("⚠ Camera not ready"); return; }
  c.width = v.videoWidth; c.height = v.videoHeight;
  c.getContext("2d").drawImage(v, 0, 0);
  c.toBlob(blob => { if (blob) { handleFile(blob); closeCamera(); } }, "image/jpeg", 0.92);
}

// ══ CLASSIFY ══
async function classify() {
  if (!S.previewURL) { toast("⚠ Please upload an image first"); return; }
  if (!EcoModel.isReady()) { toast("⏳ Model still loading…"); return; }

  $("nextPlaceholder").classList.add("hidden");
  $("resultBox").classList.remove("hidden");
  $("resultLoading").classList.remove("hidden");
  $("resultContent").style.display = "none";

  await waitImg($("previewImg"));
  const r = await EcoModel.classify($("previewImg"));
  $("resultLoading").classList.add("hidden");

  if (!r.success) { toast("❌ " + r.error); $("resultBox").classList.add("hidden"); return; }

  S.lastResult = r;
  renderResult(r);
}

function waitImg(img) {
  return new Promise(resolve => {
    if (img.complete && img.naturalWidth) { resolve(); return; }
    img.onload = resolve; setTimeout(resolve, 1500);
  });
}

function renderResult(r) {
  $("rEmoji").textContent      = r.emoji;
  $("rEmoji").style.background = r.badge_bg;
  $("rTitle").textContent      = r.label;

  const pill = $("rBadgePill");
  pill.textContent       = r.kategori;
  pill.style.background  = r.badge_bg;
  pill.style.color       = r.badge_color;

  // bars animate
  $("barOrg").style.width = "0%";
  $("barRec").style.width = "0%";
  requestAnimationFrame(() => requestAnimationFrame(() => {
    $("barOrg").style.width = r.organic_pct + "%";
    $("barRec").style.width = r.recycle_pct + "%";
    $("pOrg").textContent   = r.organic_pct + "%";
    $("pRec").textContent   = r.recycle_pct + "%";
  }));

  $("rDisposal").textContent   = r.bin;
  $("rBin").textContent        = r.bin;
  $("rRecyclable").textContent = r.daur_ulang;
  $("rHazard").textContent     = r.bahaya;
  $("rTip").innerHTML          = `<strong>💡 Disposal Tip</strong> ${r.tips}`;

  // Recycle steps
  const stepsEl = $("rRecycleSteps");
  if (stepsEl && r.recycle_steps) {
    stepsEl.innerHTML = `
      <div class="recycle-steps-title">🔄 How to Recycle / Dispose</div>
      <div class="recycle-steps-grid">
        ${r.recycle_steps.map((s, i) => `
          <div class="recycle-step">
            <div class="recycle-step-num">${i+1}</div>
            <div class="recycle-step-icon">${s.icon}</div>
            <div class="recycle-step-info">
              <strong>${s.title}</strong>
              <span>${s.desc}</span>
            </div>
          </div>`).join("")}
      </div>
      <div class="recycle-fact">💡 <em>${r.fakta}</em></div>
    `;
    stepsEl.style.display = "";
  }

  $("resultContent").style.display = "";
}

function clearScan() {
  S.previewURL = null; S.lastResult = null;
  $("previewImg").src = "";
  $("fileInput").value = "";
  $("previewBox").classList.add("hidden");
  $("dropzone").style.display = "";
  $("resultBox").classList.add("hidden");
  $("nextPlaceholder").classList.remove("hidden");
}

// ══ SAVE BADGE ══
function saveBadge() {
  if (!S.lastResult) { toast("⚠ No result to save"); return; }
  S.totalClassified++;
  S.history.unshift({ ...S.lastResult, thumb: S.previewURL, date: new Date().toISOString() });
  if (S.history.length > 50) S.history.pop();
  saveStorage();
  renderBadges();
  toast("✅ Saved to Eco Badges!");
}

function renderBadges() {
  if (!$("sbNum")) return;
  const n = S.totalClassified;
  $("sbNum").textContent      = n;
  $("sbCo2").textContent      = (n * 0.5).toFixed(1) + " kg";
  $("sbTrees").textContent    = Math.floor(n / 10);
  $("sbRecycled").textContent = (n * 0.3).toFixed(1) + " kg";

  // Milestone
  const next = ACHIEVEMENTS.find(a => n < a.goal);
  if (next) {
    $("milestoneText").textContent = `${next.goal - n} more item${next.goal - n !== 1 ? "s" : ""} to unlock "${next.title}" badge!`;
  } else {
    $("milestoneText").textContent = "🏆 You've unlocked all badges! Amazing!";
  }

  const el = $("achievements");
  el.innerHTML = ACHIEVEMENTS.map(a => {
    const done = n >= a.goal;
    const prog = Math.min(n, a.goal);
    return `
      <div class="achieve-item ${done ? "unlocked" : "locked"}">
        <div class="achieve-icon">${a.icon}</div>
        <div class="achieve-info">
          <strong>${a.title}</strong>
          <p>${a.desc}</p>
        </div>
        ${done
          ? `<svg class="achieve-badge-icon" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" fill="#dcfce7" stroke="#16a34a" stroke-width="1.5"/><path d="M7 12l4 4 6-7" stroke="#16a34a" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`
          : `<div class="achieve-progress">
               <div class="achieve-progress-bar"><div class="achieve-progress-fill" style="width:${(prog/a.goal*100).toFixed(0)}%"></div></div>
               <small>${prog} / ${a.goal}</small>
             </div>`
        }
      </div>`;
  }).join("");
}

function shareProgress() {
  const text = `🌿 I've classified ${S.totalClassified} waste item${S.totalClassified !== 1 ? "s" : ""} with EcoGreen! Join me in keeping our planet clean. #EcoGreen #WasteManagement`;
  if (navigator.share) {
    navigator.share({ title:"EcoGreen Progress", text }).catch(() => {});
  } else {
    navigator.clipboard?.writeText(text);
    toast("📋 Progress copied to clipboard!");
  }
}

// ══ ENCYCLOPEDIA ══
const ENC_DATA = [
  { name:"Plastic Bottle",   emoji:"🍶", type:"recyclable", desc:"PET plastic, widely recyclable" },
  { name:"Food Scraps",      emoji:"🥗", type:"organic",    desc:"Vegetable peels, fruit waste" },
  { name:"Cardboard Box",    emoji:"📦", type:"recyclable", desc:"Corrugated paper, recyclable" },
  { name:"Banana Peel",      emoji:"🍌", type:"organic",    desc:"Organic, great for composting" },
  { name:"Aluminum Can",     emoji:"🥫", type:"recyclable", desc:"Metal, 100% recyclable" },
  { name:"Newspaper",        emoji:"📰", type:"recyclable", desc:"Paper, recyclable if clean" },
  { name:"Apple Core",       emoji:"🍎", type:"organic",    desc:"Organic, compostable" },
  { name:"Glass Jar",        emoji:"🫙", type:"recyclable", desc:"Glass, recyclable" },
  { name:"Egg Shells",       emoji:"🥚", type:"organic",    desc:"Great compost material" },
  { name:"Plastic Bag",      emoji:"🛍️", type:"recyclable", desc:"LDPE plastic, check local rules" },
  { name:"Coffee Grounds",   emoji:"☕", type:"organic",    desc:"Organic, excellent compost" },
  { name:"Steel Can",        emoji:"🪣", type:"recyclable", desc:"Ferrous metal, recyclable" },
];

function renderEncyclopediaDefault() {
  renderEncItems(ENC_DATA);
}

function searchEncyclopedia() {
  const q = $("encSearch").value.toLowerCase().trim();
  const filtered = q ? ENC_DATA.filter(i => i.name.toLowerCase().includes(q) || i.desc.toLowerCase().includes(q)) : ENC_DATA;
  renderEncItems(filtered);
}

function renderEncItems(items) {
  const el = $("encResults");
  if (!items.length) { el.innerHTML = `<div style="text-align:center;color:var(--text-3);padding:2rem;font-size:.875rem">No results found</div>`; return; }
  el.innerHTML = items.map(i => {
    const isRec = i.type === "recyclable";
    return `
      <div class="enc-item">
        <div class="enc-emoji">${i.emoji}</div>
        <div class="enc-info"><strong>${i.name}</strong><span>${i.desc}</span></div>
        <span class="enc-badge" style="background:${isRec?"var(--teal-bg)":"var(--green-bg)"};color:${isRec?"var(--teal)":"var(--green)"}">
          ${isRec ? "Recyclable" : "Organic"}
        </span>
      </div>`;
  }).join("");
}

// ══ WASTE MAP ══
function selectBank(el, name, dist, addr, hours) {
  document.querySelectorAll(".bank-item").forEach(b => b.classList.remove("active-bank"));
  el.classList.add("active-bank");
  $("bdName").textContent  = name;
  $("bdAddr").textContent  = `📍 ${addr}`;
  $("bdHours").textContent = `🕐 ${hours}`;
  $("bankDetail").classList.remove("hidden");
}

// ══ STORAGE ══
function saveStorage() {
  localStorage.setItem("eco_total", S.totalClassified);
  localStorage.setItem("eco_history", JSON.stringify(S.history.slice(0,30)));
}
function loadStorage() {
  S.totalClassified = parseInt(localStorage.getItem("eco_total") || "0");
  try { S.history = JSON.parse(localStorage.getItem("eco_history") || "[]"); } catch { S.history = []; }
}

// ══ TOAST ══
let _tt;
function toast(msg, dur = 3000) {
  const t = $("toast");
  t.textContent = msg; t.classList.remove("hidden");
  clearTimeout(_tt); _tt = setTimeout(() => t.classList.add("hidden"), dur);
}