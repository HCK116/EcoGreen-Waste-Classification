/**
 * model.js — EcoGreen
 * TensorFlow.js MobileNet waste classifier.
 * Set USE_CUSTOM_MODEL=true and point CUSTOM_MODEL_PATH to your trained model.
 */
const EcoModel = (() => {
  const USE_CUSTOM_MODEL  = false;
  const CUSTOM_MODEL_PATH = "./model/model.json";
  const INPUT_SIZE = 224;

  const LABELS = {
    organic: {
      label:"Organic Waste", emoji:"🍃", kategori:"Organic",
      daur_ulang:"No (compostable)", bahaya:"Safe",
      bin:"🟢 Green Bin",
      badge_color:"#166534", badge_bg:"#dcfce7",
      tips:"Organic waste can be composted into fertilizer. Keep it separate from other waste and bring it to your nearest composting facility. Never burn organic waste as it produces harmful gases.",
      fakta:"1 kg of organic waste can produce compost to fertilize 2m² of garden soil! 🌱",
      recycle_steps:[
        { icon:"🗂️", title:"Separate", desc:"Separate from plastic & other waste" },
        { icon:"🪣", title:"Collect", desc:"Place in green bin or compost bin" },
        { icon:"🌿", title:"Compost", desc:"Mix with dry leaves, let decompose 2-4 weeks" },
        { icon:"🌱", title:"Use", desc:"Apply compost as natural fertilizer for plants" }
      ]
    },
    recyclable: {
      label:"Recyclable Waste", emoji:"♻️", kategori:"Recyclable",
      daur_ulang:"Yes ✅", bahaya:"Low",
      bin:"🟡 Yellow Bin",
      badge_color:"#0d9488", badge_bg:"#ccfbf1",
      tips:"Rinse before disposal to avoid contaminating other recyclables. Collect and bring to your nearest trash bank (Bank Sampah) to be processed.",
      fakta:"Recycling 1 plastic bottle saves enough energy to power a 60W bulb for 6 hours! 💡",
      recycle_steps:[
        { icon:"🚿", title:"Clean", desc:"Rinse & remove food residue first" },
        { icon:"🗜️", title:"Compress", desc:"Flatten or crush to save space" },
        { icon:"📦", title:"Sort", desc:"Group by type: plastic, paper, metal, glass" },
        { icon:"🏦", title:"Drop Off", desc:"Bring to nearest Bank Sampah or recycling point" }
      ]
    }
  };

  const KEYWORD_MAP = {
    organic: ["banana","apple","orange","broccoli","carrot","hot dog","pizza","donut","cake","sandwich","food","fruit","vegetable","leaf","plant","mushroom","egg","bread","meat","fish","corn","salad","herb","flower","grass","wood"],
    recyclable: ["bottle","can","cup","plastic","metal","glass","aluminum","tin","container","box","bag","wrapper","cardboard","newspaper","jug","bowl","tray","foil","wire","jar","carton","wine glass","beer glass"]
  };

  let _mobilenet = null, _customModel = null, _ready = false, _mode = "pretrained";

  async function load(onProgress) {
    try {
      onProgress?.("Loading TensorFlow.js…", 20);
      if (typeof tf === "undefined") throw new Error("TF.js not loaded");
      if (USE_CUSTOM_MODEL) {
        onProgress?.("Loading custom EcoGreen model…", 40);
        _customModel = await tf.loadLayersModel(CUSTOM_MODEL_PATH);
        _mode = "custom";
      } else {
        onProgress?.("Loading MobileNet model…", 40);
        _mobilenet = await mobilenet.load({ version: 2, alpha: 1.0 });
        _mode = "pretrained";
      }
      _ready = true;
      onProgress?.("Model ready!", 100);
      return { success: true, mode: _mode };
    } catch(e) {
      return { success: false, error: e.message };
    }
  }

  async function classify(imgEl) {
    if (!_ready) return { success: false, error: "Model not ready" };
    try {
      return _mode === "custom" ? await _classifyCustom(imgEl) : await _classifyPretrained(imgEl);
    } catch(e) {
      return { success: false, error: e.message };
    }
  }

  async function _classifyPretrained(imgEl) {
    const preds = await _mobilenet.classify(imgEl, 10);
    let oScore = 0, rScore = 0;
    for (const p of preds) {
      const n = p.className.toLowerCase(), prob = p.probability;
      if (KEYWORD_MAP.organic.some(k => n.includes(k)))    oScore += prob;
      if (KEYWORD_MAP.recyclable.some(k => n.includes(k))) rScore += prob;
    }
    if (oScore === 0 && rScore === 0) {
      const top = preds[0]?.className?.toLowerCase() || "";
      const hint = ["wrap","pack","container","box","can","bag","bottle","plastic","glass","metal","foil","cup","tube"].some(k => top.includes(k));
      rScore = hint ? 0.6 : 0.3; oScore = hint ? 0.3 : 0.6;
    }
    const total = oScore + rScore || 1;
    const oPct = Math.round(oScore/total*100), rPct = 100 - oPct;
    const winner = oScore >= rScore ? "organic" : "recyclable";
    return { success:true, class:winner, confidence: winner==="organic"?oPct:rPct, organic_pct:oPct, recycle_pct:rPct, raw_top:preds[0]?.className||"—", ...LABELS[winner] };
  }

  async function _classifyCustom(imgEl) {
    const t = tf.browser.fromPixels(imgEl).resizeBilinear([INPUT_SIZE,INPUT_SIZE]).toFloat().div(255).expandDims(0);
    const out = _customModel.predict(t);
    const probs = await out.data();
    t.dispose(); out.dispose();
    const oPct = Math.round(probs[0]*100), rPct = Math.round(probs[1]*100);
    const winner = probs[0] >= probs[1] ? "organic" : "recyclable";
    return { success:true, class:winner, confidence:Math.round(Math.max(...probs)*100), organic_pct:oPct, recycle_pct:rPct, ...LABELS[winner] };
  }

  return { load, classify, isReady:()=>_ready, mode:()=>_mode, LABELS };
})();