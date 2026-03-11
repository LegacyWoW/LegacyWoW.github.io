// map-engine.js
// LegacyWoW interactive maps
// Correct zoom, pan, clicks, high-res scaling

const maps = {};

const markerIcons = {
  city: '/assets/icons/city.png',
  town: '/assets/icons/town.png',
  fort: '/assets/icons/fort.png',
  battle: '/assets/icons/battle.png',
  tower: '/assets/icons/tower.png'
};

function initMap(canvasId, imagePath, mapKey, isAdmin){
  const canvas = document.getElementById(canvasId);
  const ctx = canvas.getContext('2d');
  const img = new Image();
  img.src = imagePath;

  const map = maps[mapKey] = {
    canvas, ctx, img,
    zoom: 1,
    panX: 0,
    panY: 0,
    isDragging: false,
    dragStart: {x:0,y:0},
    tool: '',
    icon: 'city',
    color: '#ff0',
    markers: [],
    polygons: [],
    currentPolygon: []
  };

  // Mouse events
  canvas.addEventListener('mousedown', e=>{
    if(e.button !== 0) return;
    if(!isAdmin) return;
    map.isDragging = true;
    map.dragStart = {x:e.clientX - map.panX, y:e.clientY - map.panY};
  });
  canvas.addEventListener('mouseup', e=>{map.isDragging=false;});
  canvas.addEventListener('mousemove', e=>{
    if(map.isDragging){
      const speed = 2.5;
      map.panX = (e.clientX - map.dragStart.x) * speed;
      map.panY = (e.clientY - map.dragStart.y) * speed;
      drawMap(mapKey);
    }
  });

  canvas.addEventListener('wheel', e=>{
    e.preventDefault();
    const delta = e.deltaY<0 ? 1.1 : 0.9;
    const oldZoom = map.zoom;
    map.zoom *= delta;

    // limit zoom out
    const minZoom = Math.max(canvas.width / img.width, canvas.height / img.height);
    if(map.zoom < minZoom) map.zoom = minZoom;

    // zoom towards cursor
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    map.panX -= (mx - map.panX) * (map.zoom/oldZoom -1);
    map.panY -= (my - map.panY) * (map.zoom/oldZoom -1);

    drawMap(mapKey);
  });

  // Click handler
  canvas.addEventListener('click', e=>{
    if(!isAdmin) return;
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left - map.panX) / map.zoom;
    const y = (e.clientY - rect.top - map.panY) / map.zoom;

    if(map.tool === 'marker'){
      map.markers.push({x,y,icon: map.icon,name:''});
    } else if(map.tool === 'polygon'){
      map.currentPolygon.push({x,y});
    }
    drawMap(mapKey);
  });

  img.onload = ()=>drawMap(mapKey);
}

// Draw map at native resolution, zoom & pan applied in drawImage
function drawMap(mapKey){
  const map = maps[mapKey];
  const {ctx, canvas, img, zoom, panX, panY} = map;

  ctx.clearRect(0,0,canvas.width,canvas.height);

  ctx.save();
  ctx.setTransform(1,0,0,1,0,0); // reset transform

  // Draw image scaled properly
  ctx.drawImage(
    img,
    0,0,img.width,img.height,
    panX, panY, img.width*zoom, img.height*zoom
  );

  // Draw polygons
  map.polygons.forEach(p=>drawPolygon(ctx,p,zoom,panX,panY));
  if(map.currentPolygon.length>0){
    drawPolygon(ctx,{points:map.currentPolygon,color:map.color},zoom,panX,panY);
  }

  // Draw markers
  map.markers.forEach(m=>drawMarker(ctx,m,zoom,panX,panY));
  ctx.restore();
}

function drawPolygon(ctx, polygon, zoom, panX, panY){
  if(polygon.points.length===0) return;
  ctx.beginPath();
  polygon.points.forEach((pt,i)=>{
    const screenX = pt.x*zoom + panX;
    const screenY = pt.y*zoom + panY;
    if(i===0) ctx.moveTo(screenX,screenY);
    else ctx.lineTo(screenX,screenY);
    ctx.fillStyle = polygon.color;
    ctx.fillRect(screenX-4,screenY-4,8,8);
  });
  ctx.closePath();
  ctx.fillStyle = polygon.color+'88';
  ctx.fill();
  ctx.strokeStyle = '#fff';
  ctx.stroke();
}

function drawMarker(ctx, marker, zoom, panX, panY){
  const img = new Image();
  img.src = markerIcons[marker.icon];
  img.onload = ()=>{
    ctx.drawImage(img, marker.x*zoom + panX -16, marker.y*zoom + panY -16, 32,32);
  }
}

// Admin helpers
function setTool(tool,mapKey){ maps[mapKey].tool = tool; }
function setIcon(icon,mapKey){ maps[mapKey].icon = icon; }
function setColor(color,mapKey){ maps[mapKey].color = color; }
function finishPolygon(mapKey){
  const map = maps[mapKey];
  if(map.currentPolygon.length>2){
    map.polygons.push({points:map.currentPolygon.slice(),color:map.color});
    map.currentPolygon = [];
    drawMap(mapKey);
  }
}
function saveMap(mapKey){
  const map = maps[mapKey];
  localStorage.setItem(`legacywow_map_${mapKey}`,JSON.stringify({markers:map.markers,polygons:map.polygons}));
  alert('Map saved!');
}
