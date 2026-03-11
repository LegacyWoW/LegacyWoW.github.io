const maps={}

const icons={
city:"../assets/icons/city.png",
town:"../assets/icons/town.png",
fort:"../assets/icons/fort.png",
battle:"../assets/icons/battle.png",
tower:"../assets/icons/tower.png"
}

function initMap(canvasId,imgSrc,key,isAdmin){
const canvas=document.getElementById(canvasId)
const ctx=canvas.getContext("2d")
const img=new Image()

img.onload=()=>{
canvas.width=img.width
canvas.height=img.height

maps[key]={
canvas,ctx,img,
zoom:1,
offsetX:0,
offsetY:0,
drag:false,
dragStartX:0,
dragStartY:0,
markers:[],
polygons:[],
current:[],
tool:null,
icon:"city",
color:"#ffff00",
admin:isAdmin,
selectedPolygon:null
}

drawMap(key)

// mouse wheel zoom
canvas.addEventListener("wheel",e=>{
e.preventDefault()
const scaleFactor = 1.1
if(e.deltaY<0) maps[key].zoom*=scaleFactor
else maps[key].zoom/=scaleFactor
drawMap(key)
})

// drag pan
canvas.addEventListener("mousedown",e=>{
maps[key].drag=true
maps[key].dragStartX=e.clientX
maps[key].dragStartY=e.clientY
})
canvas.addEventListener("mouseup",()=>maps[key].drag=false)
canvas.addEventListener("mousemove",e=>{
if(maps[key].drag){
const speed=2 // increase drag speed
maps[key].offsetX+=(e.clientX-maps[key].dragStartX)*speed
maps[key].offsetY+=(e.clientY-maps[key].dragStartY)*speed
maps[key].dragStartX=e.clientX
maps[key].dragStartY=e.clientY
drawMap(key)
}
})

// click handling
canvas.addEventListener("click",e=>handleClick(e,key))
}

function handleClick(e,key){
const map=maps[key]
const rect=map.canvas.getBoundingClientRect()
const x=(e.clientX-rect.left-map.offsetX)/map.zoom
const y=(e.clientY-rect.top-map.offsetY)/map.zoom

if(map.tool==="polygon"){
map.current.push({x,y})
}

if(map.tool==="marker"){
map.markers.push({x,y,type:map.icon,name:"City",owner:"Neutral",influence:"0%",status:"Peace"})
}

checkCityClick(x,y,key)
drawMap(key)
}

function checkCityClick(x,y,key){
const panel=document.getElementById("cityPanel")
const map=maps[key]
map.markers.forEach(m=>{
const dx=m.x-x
const dy=m.y-y
if(Math.sqrt(dx*dx+dy*dy)<20){
panel.style.display="block"
panel.innerHTML=
"<b>"+m.name+"</b><br>"+
"Owner: "+m.owner+"<br>"+
"Influence: "+m.influence+"<br>"+
"Status: "+m.status
}
})
}

function drawMap(key){
const map=maps[key]
map.ctx.clearRect(0,0,map.canvas.width,map.canvas.height)
map.ctx.save()
map.ctx.translate(map.offsetX,map.offsetY)
map.ctx.scale(map.zoom,map.zoom)

// draw map
map.ctx.drawImage(map.img,0,0)

// draw polygons
map.polygons.forEach(p=>{
map.ctx.beginPath()
map.ctx.moveTo(p.points[0].x,p.points[0].y)
for(let i=1;i<p.points.length;i++) map.ctx.lineTo(p.points[i].x,p.points[i].y)
map.ctx.closePath()
map.ctx.globalAlpha=.35
map.ctx.fillStyle=p.color
map.ctx.fill()
map.ctx.globalAlpha=1
map.ctx.strokeStyle="white"
map.ctx.lineWidth=2
map.ctx.stroke()
})

// polygon points preview
map.current.forEach(p=>{
map.ctx.beginPath()
map.ctx.arc(p.x,p.y,10,0,Math.PI*2)
map.ctx.fillStyle="red"
map.ctx.fill()
})

// preview connecting lines
if(map.current.length>1){
map.ctx.beginPath()
map.ctx.moveTo(map.current[0].x,map.current[0].y)
for(let i=1;i<map.current.length;i++) map.ctx.lineTo(map.current[i].x,map.current[i].y)
map.ctx.strokeStyle="yellow"
map.ctx.lineWidth=3
map.ctx.stroke()
}

// draw markers
map.markers.forEach(m=>{
const icon=new Image()
icon.src=icons[m.type]
map.ctx.drawImage(icon,m.x-16,m.y-16,32,32)
})

map.ctx.restore()
}

// polygon tool functions
function setTool(tool,key){maps[key].tool=tool}
function setIcon(icon,key){maps[key].icon=icon}
function setColor(color,key){maps[key].color=color}

function finishPolygon(key){
const map=maps[key]
if(map.current.length>2){
map.polygons.push({points:[...map.current],color:map.color})
map.current=[]
drawMap(key)
}
}

// polygon editing (click polygon to select, then move points)
function selectPolygon(key,x,y){
const map=maps[key]
map.selectedPolygon=null
map.polygons.forEach(p=>{
p.points.forEach(pt=>{
if(Math.hypot(pt.x-x,pt.y-y)<10) map.selectedPolygon=p
})
})
}

function saveMap(key){
const data=JSON.stringify(maps[key],null,2)
const blob=new Blob([data],{type:"application/json"})
const a=document.createElement("a")
a.href=URL.createObjectURL(blob)
a.download=key+"_map.json"
a.click()
}
