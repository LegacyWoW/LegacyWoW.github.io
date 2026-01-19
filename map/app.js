// =======================================================
// LegacyWoW Interactive Map (Leaflet + Leaflet.draw)
// Layers: Alliance / Horde / Events / Neutral
// Marker icons: City, Raid, PvP, Quest, Event, Default
//
// Admin mode: /map.html?admin=1
// Loads:  /data/overlays.geojson
// Image:  /assets/worldmap.jpg
// =======================================================

const ADMIN = new URLSearchParams(window.location.search).get("admin") === "1";

// --- IMPORTANT: DO NOT CHANGE AFTER YOU START PLACING MARKERS ---
const IMAGE_HEIGHT = 1000;
const IMAGE_WIDTH  = 1800;

const IMAGE_URL = "/assets/worldmap.jpg";
const DATA_URL  = "/data/overlays.geojson";

// Inject marker CSS (keeps everything self-contained)
(function injectMarkerCSS(){
  const css = `
    .lw-marker{
      width: 30px;
      height: 30px;
      border-radius: 10px;
      display:flex;
      align-items:center;
      justify-content:center;
      font-size: 16px;
      font-weight: 900;
      box-shadow: 0 10px 22px rgba(0,0,0,.35);
      border: 2px solid rgba(255,255,255,.35);
      background: rgba(0,0,0,.55);
      user-select:none;
    }
    .lw-marker::after{ content: ""; }
  `;
  const style = document.createElement("style");
  style.textContent = css;
  document.head.appendChild(style);
})();

// Icon choices
const ICONS = {
  pin:  { label: "Default", emoji: "📍" },
  city: { label: "City",    emoji: "🏰" },
  raid: { label: "Raid",    emoji: "☠️" },
  pvp:  { label: "PvP",     emoji: "⚔️" },
  quest:{ label: "Quest",   emoji: "⭐" },
  event:{ label: "Event",   emoji: "🎉" }
};

// Layer categories
const CATEGORIES = [
  { key: "neutral", label: "Neutral" },
  { key: "alliance", label: "Alliance" },
  { key: "horde", label: "Horde" },
  { key: "events", label: "Events" }
];

// Create map (image coordinate space)
const map = L.map("map", {
  crs: L.CRS.Simple,
  minZoom: -2,
  maxZoom: 3,
  zoomControl: true,
  attributionControl: false
});

const bounds = [[0,0],[IMAGE_HEIGHT, IMAGE_WIDTH]];
map.fitBounds(bounds);
map.setMaxBounds(bounds);

// Add Azeroth image overlay
L.imageOverlay(IMAGE_URL, bounds).addTo(map);

// Layer groups (these are what you toggle)
const groups = {
  neutral: L.featureGroup().addTo(map),
  alliance: L.featureGroup().addTo(map),
  horde: L.featureGroup().addTo(map),
  events: L.featureGroup().addTo(map)
};

// Layer toggles UI
L.control.layers(
  null,
  {
    "Neutral": groups.neutral,
    "Alliance": groups.alliance,
    "Horde": groups.horde,
    "Events": groups.events
  },
  { collapsed: false }
).addTo(map);

// For Leaflet.draw editing, we keep a master collection
const drawnItems = new L.FeatureGroup().addTo(map);

// Add everything in groups into drawnItems too (so edit tool can manage all)
function addToCategory(layer, catKey){
  const key = groups[catKey] ? catKey : "neutral";
  groups[key].addLayer(layer);
  drawnItems.addLayer(layer);
}

// Remove from all category groups
function removeFromCategories(layer){
  Object.values(groups).forEach(g => g.removeLayer(layer));
}

// Determine category
function getCategory(layer){
  return (layer._lw?.category && groups[layer._lw.category]) ? layer._lw.category : "neutral";
}

// Apply polygon/circle style
function styleShape(layer){
  const color = layer._lw?.color || "#2ea8ff";
  if (layer.setStyle) {
    layer.setStyle({
      color,
      weight: 3,
      opacity: 0.9,
      fillColor: color,
      fillOpacity: 0.25
    });
  }
}

// Build a divIcon marker
function buildMarkerIcon(color, iconKey){
  const emoji = ICONS[iconKey]?.emoji || ICONS.pin.emoji;
  const html = `<div class="lw-marker" style="border-color:${color};">${emoji}</div>`;
  return L.divIcon({
    className: "", // prevent default styles
    html,
    iconSize: [30, 30],
    iconAnchor: [15, 15],
    popupAnchor: [0, -14]
  });
}

// Apply marker icon
function styleMarker(layer){
  const color = layer._lw?.color || "#2ea8ff";
  const iconKey = layer._lw?.icon || "pin";
  if (layer.setIcon) layer.setIcon(buildMarkerIcon(color, iconKey));
}

// Attach viewer popup
function attachViewerPopup(layer){
  const title = layer._lw?.title || (layer instanceof L.Marker ? "Marker" : "Area");
  if (layer.bindPopup) layer.bindPopup(`<b>${escapeHtml(title)}</b>`);
}

// Attach admin editor popup
function attachAdminPopup(layer){
  const props = layer._lw || {};
  const title = props.title || "";
  const color = props.color || "#2ea8ff";
  const category = props.category || "neutral";
  const iconKey = props.icon || "pin";
  const isMarker = layer instanceof L.Marker;

  const categoryOptions = CATEGORIES.map(c =>
    `<option value="${c.key}" ${c.key===category ? "selected" : ""}>${c.label}</option>`
  ).join("");

  const iconOptions = Object.entries(ICONS).map(([k,v]) =>
    `<option value="${k}" ${k===iconKey ? "selected" : ""}>${v.emoji} ${v.label}</option>`
  ).join("");

  const iconRow = isMarker ? `
    <label style="font-size:12px;opacity:.9;">Icon</label>
    <select id="lw_icon" style="width:100%;margin-top:6px;padding:8px;border-radius:10px;border:1px solid rgba(255,255,255,.18);background:rgba(0,0,0,.35);color:#fff;">
      ${iconOptions}
    </select>
  ` : "";

  const html = `
    <div style="min-width:240px">
      <div style="font-weight:900;margin-bottom:8px;">Edit</div>

      <label style="font-size:12px;opacity:.9;">Name</label>
      <input id="lw_title" value="${escapeAttr(title)}"
        style="width:100%;margin:6px 0 10px;padding:8px;border-radius:10px;border:1px solid rgba(255,255,255,.18);background:rgba(0,0,0,.35);color:#fff;" />

      <label style="font-size:12px;opacity:.9;">Category (Layer)</label>
      <select id="lw_category" style="width:100%;margin-top:6px;padding:8px;border-radius:10px;border:1px solid rgba(255,255,255,.18);background:rgba(0,0,0,.35);color:#fff;">
        ${categoryOptions}
      </select>

      <div style="height:10px"></div>

      <label style="font-size:12px;opacity:.9;">Color</label>
      <input id="lw_color" type="color" value="${escapeAttr(color)}"
        style="width:100%;height:40px;margin-top:6px;border-radius:10px;border:1px solid rgba(255,255,255,.18);background:rgba(0,0,0,.35);" />

      ${iconRow}

      <button id="lw_save"
        style="margin-top:10px;width:100%;padding:10px;border-radius:12px;border:1px solid rgba(255,255,255,.18);background:rgba(255,255,255,.08);color:#fff;font-weight:900;cursor:pointer;">
        Save
      </button>

      <div style="margin-top:8px;font-size:12px;opacity:.75;">
        Tip: Export GeoJSON when you’re done.
      </div>
    </div>
  `;

  layer.bindPopup(html).openPopup();

  layer.once("popupopen", () => {
    const titleEl = document.getElementById("lw_title");
    const catEl = document.getElementById("lw_category");
    const colorEl = document.getElementById("lw_color");
    const iconEl = document.getElementById("lw_icon");
    const saveEl = document.getElementById("lw_save");

    if (!saveEl) return;

    saveEl.addEventListener("click", () => {
      layer._lw = layer._lw || {};
      layer._lw.title = (titleEl?.value || "").trim();
      layer._lw.category = (catEl?.value || "neutral").trim();
      layer._lw.color = (colorEl?.value || "#2ea8ff").trim();

      if (layer instanceof L.Marker) {
        layer._lw.icon = (iconEl?.value || "pin").trim();
        styleMarker(layer);
      } else {
        styleShape(layer);
      }

      // Move between categories if needed
      removeFromCategories(layer);
      addToCategory(layer, layer._lw.category);

      attachViewerPopup(layer);
      layer.closePopup();
    });
  });
}

// Load overlays
fetch(DATA_URL, { cache: "no-store" })
  .then(r => (r.ok ? r.json() : null))
  .then(geo => {
    if (!geo || !geo.features) return;

    L.geoJSON(geo, {
      pointToLayer: (feature, latlng) => {
        const props = feature.properties || {};
        const color = props.color || "#2ea8ff";
        const iconKey = props.icon || "pin";

        // Use divIcon markers (icons!)
        const m = L.marker(latlng, { icon: buildMarkerIcon(color, iconKey) });
        m._lw = {
          title: props.title || "Marker",
          color,
          category: props.category || "neutral",
          icon: iconKey
        };
        attachViewerPopup(m);
        return m;
      },
      style: (feature) => {
        const props = feature.properties || {};
        const color = props.color || "#2ea8ff";
        return { color, weight: 3, opacity: 0.9, fillColor: color, fillOpacity: 0.25 };
      },
      onEachFeature: (feature, layer) => {
        // Non-point features arrive here
        if (feature.geometry.type !== "Point") {
          const props = feature.properties || {};
          layer._lw = {
            title: props.title || "Area",
            color: props.color || "#2ea8ff",
            category: props.category || "neutral"
          };
          styleShape(layer);
          attachViewerPopup(layer);
        }
      }
    }).eachLayer(layer => {
      const cat = getCategory(layer);
      addToCategory(layer, cat);
    });
  })
  .catch(() => { /* ok if empty */ });

// Admin draw tools
if (ADMIN) {
  const drawControl = new L.Control.Draw({
    edit: { featureGroup: drawnItems, remove: true },
    draw: {
      polygon: true,
      rectangle: true,
      circle: true,
      marker: true,
      // keep it simple: icons are handled on markers
      polyline: false,
      circlemarker: false
    }
  });
  map.addControl(drawControl);

  map.on(L.Draw.Event.CREATED, (e) => {
    const layer = e.layer;

    // Defaults
    layer._lw = {
      title: (e.layerType === "marker") ? "New Marker" : "New Area",
      color: "#2ea8ff",
      category: "neutral",
      icon: "pin"
    };

    if (layer instanceof L.Marker) {
      styleMarker(layer);
    } else {
      styleShape(layer);
    }

    attachViewerPopup(layer);
    addToCategory(layer, layer._lw.category);

    // Immediately open editor popup so admin can set fields
    attachAdminPopup(layer);
  });

  map.on(L.Draw.Event.EDITED, (e) => {
    e.layers.eachLayer(layer => {
      // Keep style and popups
      if (layer instanceof L.Marker) styleMarker(layer);
      else styleShape(layer);
      attachViewerPopup(layer);
    });
  });

  map.on(L.Draw.Event.DELETED, () => {});
}

// Clicking shapes: viewer sees popup; admin gets editor
Object.values(groups).forEach(g => {
  g.on("click", (e) => {
    const layer = e.layer;
    if (!layer) return;
    if (ADMIN) attachAdminPopup(layer);
    else attachViewerPopup(layer);
  });
});

// UI buttons
const exportBtn = document.getElementById("exportBtn");
const clearBtn = document.getElementById("clearBtn");
const toggleHelpBtn = document.getElementById("toggleHelpBtn");
const helpBox = document.getElementById("helpBox");

toggleHelpBtn?.addEventListener("click", () => {
  helpBox.style.display = (helpBox.style.display === "none") ? "block" : "none";
});

exportBtn?.addEventListener("click", () => {
  if (!ADMIN) return alert("Export is admin-only. Open: map.html?admin=1");

  const features = [];
  drawnItems.eachLayer(layer => {
    const gj = layer.toGeoJSON();
    gj.properties = {
      title: layer._lw?.title || "",
      color: layer._lw?.color || "#2ea8ff",
      category: layer._lw?.category || "neutral",
      icon: (layer instanceof L.Marker) ? (layer._lw?.icon || "pin") : undefined
    };
    // remove undefined props for cleanliness
    Object.keys(gj.properties).forEach(k => gj.properties[k] === undefined && delete gj.properties[k]);
    features.push(gj);
  });

  downloadJson({ type:"FeatureCollection", features }, "overlays.geojson");
});

clearBtn?.addEventListener("click", () => {
  if (!ADMIN) return alert("Clear is admin-only. Open: map.html?admin=1");
  if (!confirm("Clear all shapes from the map (local only)?")) return;

  // Clear all groups + master
  Object.values(groups).forEach(g => g.clearLayers());
  drawnItems.clearLayers();
});

// Helpers
function downloadJson(obj, filename) {
  const blob = new Blob([JSON.stringify(obj, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[c]));
}
function escapeAttr(s) {
  return escapeHtml(s).replace(/"/g, "&quot;");
}
