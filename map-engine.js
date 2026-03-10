const maps = {};

function createMap(canvasId, miniId, imgSrc, mapKey) {
const canvas = document.getElementById(canvasId);
const mini = document.getElementById(miniId);
const ctx = canvas.getContext("2d");
const miniCtx = mini.getContext("2d");

```
const img = new Image();
img.src = imgSrc;

img.onload = () => {
    // Resize canvas to image dimensions if needed
    if(canvas.width !== img.width) canvas.width = img.width;
    if(canvas.height !== img.height) canvas.height = img.height;

    // Draw main map
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

    // Draw mini-map
    const miniScale = 0.25;
    mini.width = canvas.width * miniScale;
    mini.height = canvas.height * miniScale;
    miniCtx.drawImage(img, 0, 0, mini.width, mini.height);

    // Initialize map state
    maps[mapKey] = {
        canvas, ctx, img,
        mini, miniCtx,
        polygons: [],
        markers: [],
        tool: null,
        currentPolygon: [],
        currentColor: "#ffff00",
        currentIcon: "city"
    };

    // Attach event listeners for admin tools
    if(document.getElementById(mapKey + "Admin")?.style.display === "flex") {
        canvas.addEventListener("click", (e) => handleCanvasClick(mapKey, e));
    }
}
```

}

function setTool(tool) {
// Set tool for all maps
for(const key in maps) maps[key].tool = tool;
}

function setIcon(icon) {
for(const key in maps) maps[key].currentIcon = icon;
}

function handleCanvasClick(mapKey, e) {
const map = maps[mapKey];
const rect = map.canvas.getBoundingClientRect();
const x = e.clientX - rect.left;
const y = e.clientY - rect.top;

```
if(map.tool === "polygon") {
    map.currentPolygon.push({x,y});
    // If double-click, finish polygon
    if(map.currentPolygon.length > 2 && e.detail === 2){
        map.polygons.push({
            points: map.currentPolygon,
            color: map.currentColor
        });
        map.currentPolygon = [];
        redrawMap(mapKey);
    }
} else if(map.tool === "marker") {
    map.markers.push({
        x,y,
        icon: map.currentIcon,
        name: "New Marker"
    });
    redrawMap(mapKey);
}
```

}

function redrawMap(mapKey) {
const map = maps[mapKey];
const {ctx, img} = map;
ctx.clearRect(0,0,map.canvas.width,map.canvas.height);
ctx.drawImage(img, 0,0,map.canvas.width,map.canvas.height);

```
// Draw polygons
map.polygons.forEach(poly=>{
    ctx.beginPath();
    ctx.moveTo(poly.points[0].x, poly.points[0].y);
    for(let i=1;i<poly.points.length;i++){
        ctx.lineTo(poly.points[i].x, poly.points[i].y);
    }
    ctx.closePath();
    ctx.fillStyle = poly.color;
    ctx.globalAlpha = 0.5;
    ctx.fill();
    ctx.globalAlpha = 1.0;
    ctx.strokeStyle = "#fff";
    ctx.stroke();
});

// Draw markers
map.markers.forEach(marker=>{
    ctx.fillStyle = "#ff0";
    ctx.beginPath();
    ctx.arc(marker.x, marker.y, 10, 0, 2*Math.PI);
    ctx.fill();
    ctx.strokeStyle = "#000";
    ctx.stroke();
    ctx.fillStyle = "#000";
    ctx.fillText(marker.name, marker.x + 12, marker.y + 4);
});
```

}

function saveAll() {
console.log("Saving maps...", maps);
// Implement server-side save here
}
