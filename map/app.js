// LegacyWoW Map (Leaflet + Leaflet.draw)
// Storage model: overlays are loaded from /data/overlays.geojson
// Admins can draw/edit locally then EXPORT GeoJSON and upload it to the repo.

const ADMIN = new URLSearchParams(location.search).get("admin") === "1";

// --- Map setup ---
// This uses an "image-like" map coordinate system by default (Simple CRS),
// which is PERFECT if you have a custom world map image.
// For now we create a placeholder "blank world" so everything works immediately.
// Later: swap to a custom image overlay (instructions below).

const map = L.map("map", {
  crs: L.CRS.Simple,
  minZoom: -2,
  maxZoom: 3,
  zoomControl: true
});

// Define a "world" bounds. Think of this as pixel space.
// You can change this when you add a real map image.
const bounds = [[0, 0], [1000, 1600]];
map.fitBounds(bounds);
map.setMaxBounds(bounds);

// Background layer (just a dark tile so it’s not empty)
const background = L.rectangle(bounds, {
  color: "transparent",
  fillColor: "#0f0f0f",
  fillOpacity: 1,
  interactive: false
}).addTo(map);

// --- Optional: Add a custom map image later ---
// 1) Upload: assets/worldmap.jpg
// 2) Uncomment these lines and adjust bounds to match the image aspect:
//
// const imageUrl = "assets/worldmap.jpg";
// const imageBounds = bounds;
// L.imageOverlay(imageUrl, imageBounds).addTo(map);

// --- Layer to hold drawings ---
const drawnItems = new L.FeatureGroup();
map.addLayer(drawnItems);

// --- Load existing overlays (GeoJSON) ---
fetch("data/overlays.geojson", { cache: "no-store" })
  .then(r => (r.ok ? r.json() : null))
  .then(geo => {
    if (!geo) return;
    L.geoJSON(geo, {
      pointToLayer: (feature, latlng) => {
        const color = feature?.properties?.color || "#2ea8ff";
        const title = feature?.properties?.title || "Marker";
        return L.circleMarker(latlng, {
          radius: 7,
          color,
          weight: 2,
          fillColor: color,
          fillOpacity: 0.9
        }).bindPopup(`<b>${escapeHtml(title)}</b>`);
      },
      style: (feature) => {
        const color = feature?.properties?.color || "#2ea8ff";
        return {
          color,
          weight: 3,
          opacity: 0.95,
          fillColor: color,
          fillOpacity: 0.25
        };
      },
      onEachFeature: (feature, layer) => {
        const title = feature?.properties?.title;
        if (title && layer && layer.bindPopup && feature.geometry.type !== "Point") {
          layer.bindPopup(`<b>${escapeHtml(title)}</b>`);
        }
        // Store properties on layer for editing
        layer._lwProps = {
          title: feature?.properties?.title || "",
          color: feature?.properties?.color || "#2ea8ff"
        };
      }
    }).eachLayer(l => drawnItems.addLayer(l));
  })
  .catch(() => { /* no overlays yet */ });

// --- Admin drawing tools ---
let drawControl = null;

if (ADMIN) {
  drawControl = new L.Control.Draw({
    edit: {
      featureGroup: drawnItems,
      remove: true
    },
    draw: {
      polygon: true,
      polyline: false,
      rectangle: true,
      circle: true,
      circlemarker: true,
      marker: true
    }
  });
  map.addControl(drawControl);

  map.on(L.Draw.Event.CREATED, (e) => {
    const layer = e.layer;

    // default properties
    layer._lwProps = {
      title: e.layerType === "marker" ? "New Marker" : "New Area",
      color: "#2ea8ff"
    };

    applyStyle(layer);
    attachEditPopup(layer);
    drawnItems.addLayer(layer);
  });

  map.on(L.Draw.Event.EDITED, (e) => {
    e.layers.eachLayer(layer => {
      // keep style + popup
      applyStyle(layer);
      attachEditPopup(layer);
    });
  });

  map.on(L.Draw.Event.DELETED, (e) => {
    // nothing needed
  });
}

// Always allow clicking existing shapes to view popup (viewer mode),
// but only allow editing popup controls in admin mode.
drawnItems.on("click", (e) => {
  const layer = e.layer;
  if (!layer) return;
  if (ADMIN) attachEditPopup(layer);
});

// --- UI buttons ---
const exportBtn = document.getElementById("exportBtn");
const clearBtn = document.getElementById("clearBtn");
const toggleHelpBtn = document.getElementById("toggleHelpBtn");
const helpBox = document.getElementById("helpBox");

toggleHelpBtn.addEventListener("click", () => {
  helpBox.style.display = helpBox.style.display === "none" ? "block" : "none";
});

exportBtn.addEventListener("click", () => {
  if (!ADMIN) {
    alert("Export is admin-only. Open: map.html?admin=1");
    return;
  }
  const geojson = featureGroupToGeoJSON(drawnItems);
  downloadJson(geojson, "overlays.geojson");
});

clearBtn.addEventListener("click", () => {
  if (!ADMIN) {
    alert("Clear is admin-only. Open: map.html?admin=1");
    return;
  }
  if (!confirm("Clear all shapes from the map (local only)?")) return;
  drawnItems.clearLayers();
});

// --- Helpers ---
function attachEditPopup(layer) {
  const props = layer._lwProps || { title: "", color: "#2ea8ff" };

  if (!ADMIN) {
    // viewer popup
    const title = props.title || (layer instanceof L.Marker ? "Marker" : "Area");
    if (layer.bindPopup) layer.bindPopup(`<b>${escapeHtml(title)}</b>`);
    return;
  }

  const title = props.title || "";
  const color = props.color || "#2ea8ff";

  const html = `
    <div style="min-width:220px">
      <div style="font-weight:900;margin-bottom:8px;">Edit</div>
      <label style="font-size:12px;opacity:.9;">Name</label>
      <input id="lw_title" value="${escapeAttr(title)}"
        style="width:100%;margin:6px 0 10px;padding:8px;border-radius:10px;border:1px solid rgba(255,255,255,.18);background:rgba(0,0,0,.35);color:#fff;" />
      <label style="font-size:12px;opacity:.9;">Color</label>
      <input id="lw_color" type="color" value="${escapeAttr(color)}"
        style="width:100%;height:40px;margin-top:6px;border-radius:10px;border:1px solid rgba(255,255,255,.18);background:rgba(0,0,0,.35);" />
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

  // Hook save button when popup opens
  layer.once("popupopen", () => {
    const titleEl = document.getElementById("lw_title");
    const colorEl = document.getElementById("lw_color");
    const saveEl = document.getElementById("lw_save");

    if (!saveEl) return;
    saveEl.addEventListener("click", () => {
      layer._lwProps = layer._lwProps || {};
      layer._lwProps.title = (titleEl?.value || "").trim();
      layer._lwProps.color = (colorEl?.value || "#2ea8ff").trim();

      applyStyle(layer);

      const finalTitle = layer._lwProps.title || (layer instanceof L.Marker ? "Marker" : "Area");
      if (layer.bindPopup) layer.setPopupContent(`<b>${escapeHtml(finalTitle)}</b>`);
      layer.closePopup();
    });
  });
}

function applyStyle(layer) {
  const props = layer._lwProps || {};
  const color = props.color || "#2ea8ff";

  // Markers/circlemarkers
  if (layer instanceof L.CircleMarker) {
    layer.setStyle({
      color,
      fillColor: color,
      fillOpacity: 0.9
    });
  }

  // Polygons/rectangles/circles
  if (layer.setStyle) {
    layer.setStyle({
      color,
      weight: 3,
      opacity: 0.95,
      fillColor: color,
      fillOpacity: 0.25
    });
  }

  // Standard marker icon fallback (Leaflet default). Leave as-is.
}

function featureGroupToGeoJSON(group) {
  const features = [];

  group.eachLayer(layer => {
    const props = layer._lwProps || {};
    const title = props.title || "";
    const color = props.color || "#2ea8ff";

    // Convert layer to geojson
    const gj = layer.toGeoJSON();

    // Attach properties (title + color)
    gj.properties = {
      title,
      color
    };

    // For circles, Leaflet stores as Point; radius not preserved by default.
    // We store radius in properties so you can rehydrate later if desired.
    if (layer instanceof L.Circle) {
      gj.properties.radius = layer.getRadius();
    }

    features.push(gj);
  });

  return {
    type: "FeatureCollection",
    features
  };
}

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

