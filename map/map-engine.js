// map-engine.js
// LegacyWoW interactive maps
// Admin-only editing, polygons, markers, zoom, drag

// Store map data
const maps = {};

// Default marker icons
const markerIcons = {
  city: '/assets/icons/city.png',
  town: '/assets/icons/town.png',
  fort: '/assets/icons/fort.png',
  battle: '/assets/icons/battle.png',
  tower: '/assets/icons/tower.png'
};

// Initialize a map
function initMap(canvasId, imagePath, mapKey, isAdmin) {
  const canvas = document.getElementById(canvasId);
  const ctx = canvas.getContext('2d');
  const img = new Image();
  img.src = imagePath;

  maps[mapKey] = {
    canvas, ctx, img,
    scale: 1,
    panX: 0,
    panY: 0,
    isDragging: false,
    dragStart: {x:0,y:0},
    tool: '', // 'marker' or 'polygon'
    icon: 'city',
    color: '#ff0',
    markers: [],
    polygons: [],
    currentPolygon: []
  };

  const map = maps[mapKey];

  // Mouse events
  canvas.addEventListener('mousedown', e => {
    if(e.button !== 0) return;
    if(!isAdmin) return;
    map.isDragging = true;
    map.dragStart = {x: e.clientX - map.panX, y: e.clientY - map.panY};
  });

  canvas.addEventListener('mouseup', e => {
    map.isDragging = false;
  });

  canvas.addEventListener('mousemove', e => {
    if(map.isDragging){
      const speed = 1.5; // adjust drag speed
      map.panX = (e.clientX - map.dragStart.x) * speed;
      map.panY = (e.clientY - map.dragStart.y) * speed;
      drawMap(mapKey);
    }
  });

  // Mouse wheel zoom
  canvas.addEventListener('wheel', e => {
    e.preventDefault();
    const delta = e.deltaY < 0 ? 1.1 : 0.9;
    const oldScale = map.scale;
    map.scale *= delta;

    // Prevent zooming out past container
    const maxScale = Math.min(canvas.width / img.width, canvas.height / img.height);
    if(map.scale < maxScale) map.scale = maxScale;

    // Adjust pan so zoom focuses on cursor
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    map.panX -= (mx - map.panX) * (map.scale/oldScale -1);
    map.panY -= (my - map.panY) * (map.scale/oldScale -1);

    drawMap(mapKey);
  });

  // Click for marker/polygon
  canvas.addEventListener('click', e => {
    if(!isAdmin) return;

    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left - map.panX) / map.scale;
    const y = (e.clientY - rect.top - map.panY) / map.scale;

    if(map.tool === 'marker'){
      map.markers.push({x, y, icon: map.icon, name: ''});
    }
    if(map.tool === 'polygon'){
      map.currentPolygon.push({x, y});
    }
    drawMap(mapKey);
  });

  img.onload = () => drawMap(mapKey);
}

// Draw a map
function drawMap(mapKey){
  const map = maps[mapKey];
  const {ctx, canvas, img} = map;
  ctx.clearRect(0,0,canvas.width,canvas.height);

  ctx.save();
  ctx.translate(map.panX,map.panY);
  ctx.scale(map.scale,map.scale);
  ctx.drawImage(img,0,0);
  
  // Draw polygons
  map.polygons.forEach(p => drawPolygon(ctx,p));
  if(map.currentPolygon.length > 0){
    drawPolygon(ctx,{points: map.currentPolygon,color: map.color});
  }

  // Draw markers
  map.markers.forEach(m => drawMarker(ctx,m));
  ctx.restore();
}

// Draw polygon with points
function drawPolygon(ctx, polygon){
  if(polygon.points.length === 0) return;
  ctx.beginPath();
  polygon.points.forEach((pt,i)=>{
    if(i===0) ctx.moveTo(pt.x,pt.y);
    else ctx.lineTo(pt.x,pt.y);
    // draw visible point
    ctx.fillStyle = polygon.color;
    ctx.fillRect(pt.x-4,pt.y-4,8,8);
  });
  ctx.closePath();
  ctx.fillStyle = polygon.color + '88';
  ctx.fill();
  ctx.strokeStyle = '#fff';
  ctx.stroke();
}

// Draw marker
function drawMarker(ctx, marker){
  const img = new Image();
  img.src = markerIcons[marker.icon];
  img.onload = ()=>{
    ctx.drawImage(img, marker.x-16, marker.y-16, 32, 32);
  }
}

// Admin tools
function setTool(tool,mapKey){ maps[mapKey].tool = tool; }
function setIcon(icon,mapKey){ maps[mapKey].icon = icon; }
function setColor(color,mapKey){ maps[mapKey].color = color; }

// Finish polygon
function finishPolygon(mapKey){
  const map = maps[mapKey];
  if(map.currentPolygon.length>2){
    map.polygons.push({points: map.currentPolygon.slice(), color: map.color});
    map.currentPolygon = [];
    drawMap(mapKey);
  }
}

// Save map data (to server)
function saveMap(mapKey){
  const map = maps[mapKey];
  // example: save to localStorage for now
  localStorage.setItem(`legacywow_map_${mapKey}`,JSON.stringify({markers: map.markers, polygons: map.polygons}));
  alert('Map saved!');
}
