const isAdmin = new URLSearchParams(location.search).get("admin") === "1";

const maps = {};
let currentTool = "pan";
let currentIcon = "city";

function setTool(tool) { if (isAdmin) currentTool = tool; }
function setIcon(icon) { if (isAdmin) currentIcon = icon; }

function createMap(canvasId, miniId, imageSrc, mapKey) {
const canvas = document.getElementById(canvasId);
const ctx = canvas.getContext("2d");

```
const mini = document.getElementById(miniId);
const mctx = mini.getContext("2d");

const img = new Image();
img.src = imageSrc;

// OG zoom/pan
let scale = 1;
let offsetX = 0;
let offsetY = 0;

let dragging = false;
let startX = 0;
let startY = 0;

let markers = [];
let polygons = [];
let currentPoly = [];

maps[mapKey] = { markers, polygons };

loadFromServer();

img.onload = () => draw();

function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    ctx.translate(offsetX, offsetY);
    ctx.scale(scale, scale);
    ctx.drawImage(img, 0, 0, img.width, img.height);

    drawPolygons();
    drawMarkers();
    drawCurrentPoly();
    ctx.restore();

    drawMini();
}

function drawPolygons() {
    polygons.forEach(p => {
        ctx.fillStyle = p.color || "rgba(200,200,200,0.35)";
        ctx.beginPath();
        p.points.forEach((pt, i) => i === 0 ? ctx.moveTo(pt.x, pt.y) : ctx.lineTo(pt.x, pt.y));
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = p.color || "#fff";
        ctx.stroke();

        if (p.name) {
            ctx.fillStyle = "white";
            ctx.font = "16px Arial";
            ctx.fillText(p.name, p.points[0].x, p.points[0].y);
        }
    });
}

function drawCurrentPoly() {
    if (currentPoly.length === 0) return;
    ctx.strokeStyle = "yellow";
    ctx.lineWidth = 2;
    ctx.beginPath();
    currentPoly.forEach((pt, i) => i === 0 ? ctx.moveTo(pt.x, pt.y) : ctx.lineTo(pt.x, pt.y));
    ctx.stroke();
}

function drawMarkers() {
    markers.forEach(m => {
        let icon = "🏙";
        if (m.icon === "fort") icon = "🏰";
        if (m.icon === "tower") icon = "🏯";
        if (m.icon === "house") icon = "🏠";
        if (m.icon === "battle") icon = "⚔";

        ctx.font = "22px serif";
        ctx.fillText(icon, m.x - 10, m.y + 8);

        if (m.name) {
            ctx.font = "13px Arial";
            ctx.fillStyle = "white";
            ctx.fillText(m.name, m.x + 12, m.y);
        }
    });
}

canvas.addEventListener("mousedown", e => {
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left - offsetX) / scale;
    const y = (e.clientY - rect.top - offsetY) / scale;

    if (isAdmin) {
        if (currentTool === "marker") {
            const name = prompt("City / Location name");
            const guild = prompt("Guild owner");
            const status = prompt("Battle status");
            markers.push({ x, y, name, guild, status, icon: currentIcon });
            save();
            draw();
            return;
        }

        if (currentTool === "polygon") {
            currentPoly.push({ x, y });
            draw();
            return;
        }
    }

    dragging = true;
    startX = e.clientX;
    startY = e.clientY;
});

canvas.addEventListener("dblclick", () => {
    if (!isAdmin) return;
    if (currentPoly.length > 2) {
        const name = prompt("Territory name");
        const color = document.getElementById("polyColor").value;
        polygons.push({ points: [...currentPoly], name, color });
        currentPoly = [];
        save();
        draw();
    }
});

canvas.addEventListener("mousemove", e => {
    if (!dragging) return;
    offsetX += e.clientX - startX;
    offsetY += e.clientY - startY;
    startX = e.clientX;
    startY = e.clientY;
    draw();
});

canvas.addEventListener("mouseup", () => dragging = false);

// OG-style pointer zoom (zoom centered at cursor)
canvas.addEventListener("wheel", e => {
    e.preventDefault();
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const wx = (mx - offsetX) / scale;
    const wy = (my - offsetY) / scale;
    const factor = e.deltaY < 0 ? 1.15 : 0.85;
    scale *= factor;
    if (scale < 0.1) scale = 0.1;
    if (scale > 10) scale = 10;
    offsetX = mx - wx * scale;
    offsetY = my - wy * scale;
    draw();
});

// click markers for info
canvas.addEventListener("click", e => {
    if (isAdmin) return; 
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left - offsetX) / scale;
    const y = (e.clientY - rect.top - offsetY) / scale;
    markers.forEach(m => {
        if (Math.hypot(m.x - x, m.y - y) < 12) showCityPanel(m);
    });
});

function showCityPanel(city) {
    let panel = document.getElementById("cityPanel");
    if (!panel) {
        panel = document.createElement("div");
        panel.id = "cityPanel";
        panel.style.position = "fixed";
        panel.style.right = "30px";
        panel.style.bottom = "30px";
        panel.style.background = "#111";
        panel.style.border = "1px solid #444";
        panel.style.padding = "15px";
        panel.style.width = "260px";
        panel.style.zIndex = 9999;
        document.body.appendChild(panel);
    }
    panel.innerHTML = `
        <b>${city.name}</b><br><br>
        Guild Owner: ${city.guild || "None"}<br>
        Battle Status: ${city.status || "Peaceful"}
    `;
}

function drawMini() {
    mctx.clearRect(0, 0, mini.width, mini.height);
    mctx.drawImage(img, 0, 0, mini.width, mini.height);
    const vw = canvas.width / (img.width * scale) * mini.width;
    const vh = canvas.height / (img.height * scale) * mini.height;
    const vx = (-offsetX / (img.width * scale)) * mini.width;
    const vy = (-offsetY / (img.height * scale)) * mini.height;
    mctx.strokeStyle = "red";
    mctx.strokeRect(vx, vy, vw, vh);
}

function save() { if (!isAdmin) return;
    fetch("/map-save.php", {
        method: "POST",
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ map: mapKey, markers, polygons })
    });
}

function loadFromServer() {
    fetch("/map-data/" + mapKey + ".json")
        .then(r => r.json())
        .then(data => { markers = data.markers || []; polygons = data.polygons || []; draw(); })
        .catch(() => { });
}
```

}

function saveAll() { if (!isAdmin) return;
Object.keys(maps).forEach(k => {
fetch("/map-save.php", {
method: "POST",
headers: { 'Content-Type': 'application/json' },
body: JSON.stringify(maps[k])
});
});
alert("Maps saved");
}
