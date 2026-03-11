const maps = {}

function initMap(canvasId,imgSrc,key,isAdmin){

const canvas=document.getElementById(canvasId)
const ctx=canvas.getContext("2d")

const img=new Image()

img.onload=()=>{

/* match canvas to real image size */

canvas.width=img.width
canvas.height=img.height

maps[key]={
canvas,
ctx,
img,
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
color:"#ffff00",
admin:isAdmin
}

drawMap(key)

/* mouse wheel zoom */

canvas.addEventListener("wheel",e=>{

e.preventDefault()

if(e.deltaY<0) maps[key].zoom*=1.1
else maps[key].zoom*=0.9

drawMap(key)

})

/* drag pan */

canvas.addEventListener("mousedown",e=>{

maps[key].drag=true
maps[key].dragStartX=e.clientX
maps[key].dragStartY=e.clientY

})

canvas.addEventListener("mouseup",()=>{

maps[key].drag=false

})

canvas.addEventListener("mousemove",e=>{

if(maps[key].drag){

maps[key].offsetX += e.clientX - maps[key].dragStartX
maps[key].offsetY += e.clientY - maps[key].dragStartY

maps[key].dragStartX = e.clientX
maps[key].dragStartY = e.clientY

drawMap(key)

}

})

if(isAdmin){

canvas.addEventListener("click",e=>handleClick(e,key))

}

}

/* load image AFTER handlers are defined */

img.src=imgSrc

}

/* EXISTING TERRITORIES */

map.polygons.forEach(poly=>{

map.ctx.beginPath()

map.ctx.moveTo(poly.points[0].x,poly.points[0].y)

for(let i=1;i<poly.points.length;i++){

map.ctx.lineTo(poly.points[i].x,poly.points[i].y)

}

map.ctx.closePath()

map.ctx.globalAlpha=.35
map.ctx.fillStyle=poly.color
map.ctx.fill()

map.ctx.globalAlpha=1
map.ctx.strokeStyle="white"
map.ctx.stroke()

})

/* CURRENT POLYGON PREVIEW */

if(map.current.length>0){

map.ctx.beginPath()

map.ctx.moveTo(map.current[0].x,map.current[0].y)

for(let i=1;i<map.current.length;i++){

map.ctx.lineTo(map.current[i].x,map.current[i].y)

}

/* DRAW POINTS */

map.current.forEach(p=>{

map.ctx.beginPath()
map.ctx.arc(p.x,p.y,4,0,Math.PI*2)
map.ctx.fillStyle="red"
map.ctx.fill()

})

map.ctx.strokeStyle="yellow"
map.ctx.stroke()

}

/* MARKERS */

map.markers.forEach(m=>{

map.ctx.beginPath()
map.ctx.arc(m.x,m.y,6,0,Math.PI*2)
map.ctx.fillStyle="white"
map.ctx.fill()

})

map.ctx.restore()

}

function setTool(tool,key){

maps[key].tool=tool

}

function setColor(color,key){

maps[key].color=color

}

function finishPolygon(key){

const map=maps[key]

if(map.current.length>2){

map.polygons.push({
points:[...map.current],
color:map.color
})

}

map.current=[]

drawMap(key)

}

/* SAVE */

function saveMap(key){

const data=JSON.stringify(maps[key].polygons,null,2)

const blob=new Blob([data],{type:"application/json"})

const a=document.createElement("a")

a.href=URL.createObjectURL(blob)
a.download=key+"_territories.json"

a.click()

}

/* BUTTON ZOOM */

function zoomMap(key,amount){

maps[key].zoom*=amount
drawMap(key)

}
