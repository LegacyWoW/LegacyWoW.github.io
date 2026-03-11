const maps = {};

const icons = {
  city: "../assets/icons/city.png",
  town: "../assets/icons/town.png",
  fort: "../assets/icons/fort.png",
  battle: "../assets/icons/battle.png",
  tower: "../assets/icons/tower.png"
};

function initMap(canvasId, imgSrc, key, isAdmin) {
  const canvas = document.getElementById(canvasId);
  const ctx = canvas.getContext("2d");
  const img = new Image();

  img.onload = () => {
    // Make canvas size match image exactly
    canvas.width = img.width;
    canvas.height = img.height;

    maps[key] = {
      canvas, ctx, img,
      zoom: 1, offsetX: 0, offsetY: 0,
      drag: false, dragStartX: 0, dragStartY: 0,
      markers: [], polygons: [], current: [],
      tool: null, icon: "city", color: "#ffff00",
      admin: isAdmin, selectedPolygon: null
    };

    drawMap(key);

    // Zoom with mouse wheel (centered)
    canvas.addEventListener("wheel", e => {
      e.preventDefault();
      const rect = canvas.getBoundingClientRect();
      const map = maps[key];
      const mouseX = (e.clientX - rect.left - map.offsetX) / map.zoom;
      const mouseY = (e.clientY - rect.top - map.offsetY) / map.zoom;

      const zoomFactor = 1.15;
      map.zoom *= e.deltaY < 0 ? zoomFactor : 1 / zoomFactor;

      // adjust offset so zoom centers on mouse
      map.offsetX = e.clientX - rect.left - mouseX * map.zoom;
      map.offsetY = e.clientY - rect.top - mouseY * map.zoom;

      drawMap(key);
    });

    // Drag panning
    canvas.addEventListener("mousedown", e => {
      maps[key].drag = true;
      maps[key].dragStartX = e.clientX;
      maps[key].dragStartY = e.clientY;
    });
    canvas.addEventListener("mouseup", () => maps[key].drag = false);
    canvas.addEventListener("mouseleave", () => maps[key].drag = false);
    canvas.addEventListener("mousemove", e => {
      const map = maps[key];
      if (!map.drag) return;
      const speed = 10;
      map.offsetX += (e.clientX - map.dragStartX) * speed;
      map.offsetY += (e.clientY - map.dragStartY) * speed;
      map.dragStartX = e.clientX;
      map.dragStartY = e.clientY;
      drawMap(key);
    });

    canvas.addEventListener("click", e => handleClick(e, key));
  };

  img.src = imgSrc;
}

function handleClick(e, key) {
  const map = maps[key];
  const rect = map.canvas.getBoundingClientRect();

  // Correct coordinates for CSS scaling
  const scaleX = map.canvas.width / rect.width;
  const scaleY = map.canvas.height / rect.height;
  const x = (e.clientX - rect.left) * scaleX - map.offsetX;
  const y = (e.clientY - rect.top) * scaleY - map.offsetY;

  if (map.tool === "polygon") {
    map.current.push({ x, y });
  }

  if (map.tool === "marker") {
    const name = prompt("Enter marker name:", "City");
    map.markers.push({
      x, y, type: map.icon, name,
      owner: "Neutral", influence: "0%", status: "Peace"
    });
  }

  checkCityClick(x, y, key);
  drawMap(key);
}

function checkCityClick(x, y, key) {
  const panel = document.getElementById("cityPanel");
  const map = maps[key];
  let clicked = false;

  map.markers.forEach(m => {
    if (Math.hypot(m.x - x, m.y - y) < 20) {
      clicked = true;
      panel.style.display = "block";
      panel.innerHTML =
        "<b>" + m.name + "</b><br>" +
        "Owner: " + m.owner + "<br>" +
        "Influence: " + m.influence + "<br>" +
        "Status: " + m.status +
        "<br><button onclick='deleteMarker(\"" + key + "\"," + map.markers.indexOf(m) + ")'>Delete</button>";
    }
  });

  map.polygons.forEach((p, idx) => {
    // Simple bounding box click for polygon deletion
    const xs = p.points.map(pt => pt.x);
    const ys = p.points.map(pt => pt.y);
    const minX = Math.min(...xs), maxX = Math.max(...xs);
    const minY = Math.min(...ys), maxY = Math.max(...ys);
    if (x >= minX && x <= maxX && y >= minY && y <= maxY) {
      clicked = true;
      panel.style.display = "block";
      panel.innerHTML =
        "<b>Polygon</b><br>" +
        "Color: " + p.color +
        "<br><button onclick='deletePolygon(\"" + key + "\"," + idx + ")'>Delete</button>" +
        "<br><button onclick='renamePolygon(\"" + key + "\"," + idx + ")'>Rename</button>";
    }
  });

  if (!clicked) panel.style.display = "none";
}

function drawMap(key) {
  const map = maps[key];
  map.ctx.clearRect(0, 0, map.canvas.width, map.canvas.height);
  map.ctx.save();
  map.ctx.translate(map.offsetX, map.offsetY);
  map.ctx.scale(map.zoom, map.zoom);

  map.ctx.drawImage(map.img, 0, 0);

  // Draw polygons
  map.polygons.forEach(p => {
    map.ctx.beginPath();
    map.ctx.moveTo(p.points[0].x, p.points[0].y);
    for (let i = 1; i < p.points.length; i++) map.ctx.lineTo(p.points[i].x, p.points[i].y);
    map.ctx.closePath();
    map.ctx.fillStyle = p.color;
    map.ctx.globalAlpha = 0.35;
    map.ctx.fill();
    map.ctx.globalAlpha = 1;
    map.ctx.strokeStyle = "white";
    map.ctx.lineWidth = 2;
    map.ctx.stroke();

    // Draw points
    p.points.forEach(pt => {
      map.ctx.beginPath();
      map.ctx.arc(pt.x, pt.y, 10, 0, Math.PI * 2);
      map.ctx.fillStyle = "red";
      map.ctx.fill();
    });
  });

  // Draw current polygon being drawn
  if (map.current.length > 0) {
    map.ctx.beginPath();
    map.ctx.moveTo(map.current[0].x, map.current[0].y);
    for (let i = 1; i < map.current.length; i++) map.ctx.lineTo(map.current[i].x, map.current[i].y);
    map.ctx.strokeStyle = "yellow";
    map.ctx.lineWidth = 3;
    map.ctx.stroke();

    map.current.forEach(p => {
      map.ctx.beginPath();
      map.ctx.arc(p.x, p.y, 10, 0, Math.PI * 2);
      map.ctx.fillStyle = "red";
      map.ctx.fill();
    });
  }

  // Draw markers
  map.markers.forEach(m => {
    const icon = new Image();
    icon.src = icons[m.type];
    map.ctx.drawImage(icon, m.x - 16, m.y - 16, 32, 32);
  });

  map.ctx.restore();
}

// Polygon functions
function setTool(tool, key) { maps[key].tool = tool; }
function setIcon(icon, key) { maps[key].icon = icon; }
function setColor(color, key) { maps[key].color = color; }

function finishPolygon(key) {
  const map = maps[key];
  if (map.current.length > 2) {
    const name = prompt("Enter polygon name:", "Territory");
    map.polygons.push({ points: [...map.current], color: map.color, name });
    map.current = [];
    drawMap(key);
  }
}

function deleteMarker(key, index) {
  maps[key].markers.splice(index, 1);
  drawMap(key);
  document.getElementById("cityPanel").style.display = "none";
}

function deletePolygon(key, index) {
  maps[key].polygons.splice(index, 1);
  drawMap(key);
  document.getElementById("cityPanel").style.display = "none";
}

function renamePolygon(key, index) {
  const newName = prompt("Enter new polygon name:", maps[key].polygons[index].name);
  if (newName) maps[key].polygons[index].name = newName;
  drawMap(key);
}

function saveMap(key) {
  const data = JSON.stringify(maps[key], null, 2);
  const blob = new Blob([data], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = key + "_map.json";
  a.click();
}
