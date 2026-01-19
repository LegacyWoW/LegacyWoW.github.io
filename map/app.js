// =======================================================
// LegacyWoW Interactive Azeroth Map (IMAGE-BASED)
// Admin mode: map.html?admin=1
// =======================================================

// ---- ADMIN MODE ----
const ADMIN = new URLSearchParams(window.location.search).get("admin") === "1";

// ---- MAP IMAGE CONFIG ----
// DO NOT CHANGE AFTER PLACING MARKERS
const IMAGE_HEIGHT = 1000;
const IMAGE_WIDTH  = 1800;

// ABSOLUTE PATHS (THIS FIXES THE BLACK MAP ISSUE)
const IMAGE_URL = "/assets/worldmap.jpg";
const DATA_URL  = "/data/overlays.geojson";

// ---- CREATE MAP ----
const map = L.map("map", {
  crs: L.CRS.Simple,
  minZoom: -2,
  maxZoom: 3,
  zoomControl: true,
  attributionControl: false
});

// Image bounds (pixel coordinate space)
const bounds = [[0, 0], [IMAGE_HEIGHT, IMAGE_WIDTH]];
map.fitBounds(bounds);
map.setMaxBounds(bounds);

// ---- ADD IMAGE OVERLAY (AZEROTH MAP) ----
L.imageOverlay(IMAGE_URL, bounds).addTo(map);

// ---- DRAWN ITEMS GROUP ----
const drawnItems = new L.FeatureGroup();
map.addLayer(drawnItems);

// ---- LOAD SAVED OVERLAYS ----
fetch(DATA_URL, { cache: "no-store" })
  .then(res => res.ok ? res.json() : null)
  .then(data => {
    if (!data || !data.features) return;

    L.geoJSON(data, {
      pointToLayer: (feature, latlng) => {
        const color = feature.properties?.color || "#2ea8ff";
        const title = feature.properties?.title || "Marker";
        return L.circleMarker(latlng, {
          radius: 7,
          color,
          fillColor: color,
          fillOpacity: 0.9,
          weight: 2
        }).bindPopup(`<b>${escapeHtml(title)}</b>`);
      },
      style: (feature) => {
        const color = feature.properties?.color || "#2ea8ff";
        return {
          color,
          weight: 3,
          opacity: 0.9,
          fillColor: color,
          fillOpacity: 0.25
        };
      },
      onEachFeature: (feature, layer) => {
        layer._lw = {
          title: feature.properties?.title || "",
          color: feature.properties?.color || "#2ea8ff"
        };
        if (layer._lw.title && layer.bindPopup) {
          layer.bindPopup(`<b>${escapeHtml(layer._lw.title)}</b>`);
        }
      }
    }).eachLayer(l => drawnItems.addLayer(l));
  })
  .catch(() => {});

// ---- ADMIN DRAW TOOLS ----
if (ADMIN) {
  const drawControl = new L.Control.Draw({
    edit: {
      featureGroup: drawnItems,
      remove: true
    },
    draw: {
      polygon: true,
      rectangle: true,
      circle: true,
      circlemarker: true,
      marker: true,
      polyline: false
    }
  });
  map.addControl(drawControl);

  map.on(L.Draw.Event.CREATED, (e) => {
    const layer = e.layer;
    layer._lw = {
      title: e.layerType === "marker" ? "New Marker" : "New Area",
      color: "#2ea8ff"
    };
    applyStyle(layer);
    attachEditPopup(layer);
    drawnItems.addLayer(layer);
  });

  map.on(L.Draw.Event.EDITED, (e) => {
    e.layers.eachLayer(layer => {
      applyStyle(layer);
      attachEditPopup(layer);
    });
  });
}

// ---- CLICK HANDLER ----
drawnItems.on("click", (e) => {
  if (ADMIN) attachEditPopup(e.layer);
});

// ---- EXPORT BUTTON ----
document.getElementById("exportBtn")?.addEventListener("click", () => {
  if (!ADMIN) return alert("Admin only. Use ?admin=1");

  const geojson = {
    type: "FeatureCollection",
    features: []
  };

  drawnItems.eachLayer(layer => {
    const gj = layer.toGeoJSON();
    gj.properties = {
      title: layer._lw?.title || "",
      color: layer._lw?.color || "#2ea8ff"
    };
    geojson.features.push(gj);
  });

  downloadJSON(geojson, "overlays.geojson");
});

// ---- CLEAR BUTTON ----
document.getElementById("clearBtn")?.addEventListener("click", () => {
  if (!ADMIN) return;
  if (confirm("Clear all shapes (local only)?")) {
    drawnItems.clearLayers();
  }
});

// ---- EDIT POPUP ----
function attachEditPopup(layer) {
  const title = layer._lw?.title || "";
  const color = layer._lw?.color || "#2ea8ff";

  const html = `
    <div style="min-width:220px">
      <b>Edit</b><br/><br/>
      <label>Name</label>
      <input id="lw_title" value="${escapeAttr(title)}"
        style="width:100%;margin:6px 0;padding:6px;border-radius:8px;border:1px solid #444;background:#111;color:#fff;" />
      <label>Color</label>
      <input id="lw_color" type="color" value="${color}"
        style="width:100%;height:36px;margin-top:6px;" />
      <button id="lw_save"
        style="margin-top:8px;width:100%;padding:8px;border-radius:8px;border:1px solid #555;background:#222;color:#fff;font-weight:bold;">
        Save
      </button>
    </div>
  `;

  layer.bindPopup(html).openPopup();

  layer.once("popupopen", () => {
    document.getElementById("lw_save")?.addEventListener("click", () => {
      layer._lw.title = document.getElementById("lw_title").value.trim();
      layer._lw.color = document.getElementById("lw_color").value;
      applyStyle(layer);
      layer.setPopupContent(`<b>${escapeHtml(layer._lw.title)}</b>`);
      layer.closePopup();
    });
  });
}

// ---- APPLY STYLE ----
function applyStyle(layer) {
  const color = layer._lw?.color || "#2ea8ff";
  if (layer.setStyle) {
    layer.setStyle({
      color,
      fillColor: color,
      fillOpacity: 0.25,
      opacity: 0.9,
      weight: 3
    });
  }
}

// ---- UTILITIES ----
function downloadJSON(obj, filename) {
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
    "&":"&amp;",
    "<":"&lt;",
    ">":"&gt;",
    "\"":"&quot;",
    "'":"&#39;"
  }[c]));
}
function escapeAttr(s){ return escapeHtml(s).replace(/"/g,"&quot;"); }
