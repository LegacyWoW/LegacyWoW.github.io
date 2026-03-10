const maps = {};
const icons = {
    city:"/assets/icons/city.png",
    fort:"/assets/icons/fort.png",
    tower:"/assets/icons/tower.png",
    house:"/assets/icons/house.png",
    battle:"/assets/icons/battle.png"
};

function initMap(canvasId,imgSrc,mapKey){
    const canvas = document.getElementById(canvasId);
    const ctx = canvas.getContext("2d");

    const img = new Image();
    img.src = imgSrc;

    img.onload = () => {
        // Max canvas size
        const maxW = 1200, maxH = 800;
        const scale = Math.min(maxW/img.width, maxH/img.height);

        canvas.width = img.width*scale;
        canvas.height = img.height*scale;

        maps[mapKey] = {
            canvas, ctx, img, scale,
            polygons:[], markers:[], currentPolygon:[],
            tool:null, currentColor:"#ffff00", currentIcon:"city"
        };

        drawMap(mapKey);

        canvas.addEventListener("click",(e)=>{
            const adminDiv = document.getElementById(mapKey+"Admin");
            if(adminDiv && adminDiv.style.display==="flex"){
                handleClick(mapKey,e);
            }
        });
    };
}

function setTool(tool,mapKey){ maps[mapKey].tool = tool; }
function setIcon(icon,mapKey){ maps[mapKey].currentIcon = icon; }

function handleClick(mapKey,e){
    const map = maps[mapKey];
    const rect = map.canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left)/map.scale;
    const y = (e.clientY - rect.top)/map.scale;

    if(map.tool==="polygon"){
        map.currentPolygon.push({x,y});
        if(e.detail===2 && map.currentPolygon.length>2){
            map.polygons.push({points:map.currentPolygon,color:map.currentColor});
            map.currentPolygon=[];
        }
    } else if(map.tool==="marker"){
        map.markers.push({x,y,icon:map.currentIcon,name:"New Marker"});
    }

    drawMap(mapKey);
}

function drawMap(mapKey){
    const map = maps[mapKey];
    map.ctx.clearRect(0,0,map.canvas.width,map.canvas.height);
    map.ctx.drawImage(map.img,0,0,map.canvas.width,map.canvas.height);

    // Polygons
    map.polygons.forEach(poly=>{
        map.ctx.beginPath();
        map.ctx.moveTo(poly.points[0].x*map.scale,poly.points[0].y*map.scale);
        for(let i=1;i<poly.points.length;i++){
            map.ctx.lineTo(poly.points[i].x*map.scale,poly.points[i].y*map.scale);
        }
        map.ctx.closePath();
        map.ctx.fillStyle = poly.color;
        map.ctx.globalAlpha = 0.5;
        map.ctx.fill();
        map.ctx.globalAlpha = 1.0;
        map.ctx.strokeStyle = "#fff";
        map.ctx.stroke();
    });

    // Markers
    map.markers.forEach(marker=>{
        const ic = new Image();
        ic.src = icons[marker.icon];
        ic.onload = ()=>{ map.ctx.drawImage(ic,marker.x*map.scale-12,marker.y*map.scale-12,24,24); }
        map.ctx.fillStyle="#fff";
        map.ctx.fillText(marker.name,marker.x*map.scale+12,marker.y*map.scale+4);
    });
}

function saveAll(){ console.log("Save maps to server...",maps); }
