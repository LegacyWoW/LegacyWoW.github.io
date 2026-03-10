let tool="pan"
let currentIcon="city"

function setTool(t){tool=t}
function setIcon(i){currentIcon=i}

const maps={}

function createMap(canvasId,miniId,imageSrc,mapKey){

const canvas=document.getElementById(canvasId)
const ctx=canvas.getContext("2d")

const mini=document.getElementById(miniId)
const mctx=mini.getContext("2d")

const img=new Image()
img.src=imageSrc

let zoom=1
let offsetX=0
let offsetY=0

let dragging=false
let startX=0
let startY=0

let markers=[]
let polygons=[]
let currentPoly=[]

maps[mapKey]={markers,polygons}

loadFromServer()

img.onload=()=>draw()

function draw(){

ctx.clearRect(0,0,canvas.width,canvas.height)

ctx.save()

ctx.translate(offsetX,offsetY)
ctx.scale(zoom,zoom)

ctx.drawImage(img,0,0)

polygons.forEach(p=>{

ctx.fillStyle=p.color
ctx.strokeStyle=p.color

ctx.beginPath()

p.points.forEach((pt,i)=>{
if(i==0) ctx.moveTo(pt.x,pt.y)
else ctx.lineTo(pt.x,pt.y)
})

ctx.closePath()
ctx.globalAlpha=0.35
ctx.fill()

ctx.globalAlpha=1
ctx.stroke()

if(p.name){

const cx=p.points[0].x
const cy=p.points[0].y

ctx.fillStyle="white"
ctx.font="16px Arial"
ctx.fillText(p.name,cx,cy)

}

})

if(currentPoly.length>0){

ctx.strokeStyle="yellow"

ctx.beginPath()

currentPoly.forEach((pt,i)=>{
if(i==0)ctx.moveTo(pt.x,pt.y)
else ctx.lineTo(pt.x,pt.y)
})

ctx.stroke()

}

markers.forEach(m=>drawIcon(m))

ctx.restore()

drawMini()

}

function drawIcon(m){

let icon="🏰"

if(m.icon==="city") icon="🏙"
if(m.icon==="fort") icon="🏰"
if(m.icon==="tower") icon="🗼"
if(m.icon==="house") icon="🏠"
if(m.icon==="battle") icon="⚔"

ctx.font="22px serif"
ctx.fillText(icon,m.x-10,m.y+10)

if(m.name){

ctx.font="14px Arial"
ctx.fillStyle="white"
ctx.fillText(m.name,m.x+12,m.y)

}

}

canvas.addEventListener("mousedown",e=>{

const rect=canvas.getBoundingClientRect()

const x=(e.clientX-rect.left-offsetX)/zoom
const y=(e.clientY-rect.top-offsetY)/zoom

if(tool==="marker"){

const name=prompt("Marker name")

markers.push({x,y,name,icon:currentIcon})
save()

}

if(tool==="polygon"){

currentPoly.push({x,y})

}

if(tool==="pan"){

dragging=true
startX=e.clientX
startY=e.clientY

}

draw()

})

canvas.addEventListener("dblclick",()=>{

if(currentPoly.length>2){

const name=prompt("Territory name")
const color=document.getElementById("polyColor").value || "#00ffff"

polygons.push({
points:[...currentPoly],
name,
color
})

currentPoly=[]

save()

draw()

}

})

canvas.addEventListener("mousemove",e=>{

if(!dragging) return

offsetX+=e.clientX-startX
offsetY+=e.clientY-startY

startX=e.clientX
startY=e.clientY

draw()

})

canvas.addEventListener("mouseup",()=>dragging=false)

canvas.addEventListener("wheel",e=>{

e.preventDefault()

const zoomAmount=e.deltaY*-0.0015

zoom+=zoomAmount

if(zoom<0.15) zoom=0.15
if(zoom>8) zoom=8

draw()

})

function drawMini(){

mctx.clearRect(0,0,mini.width,mini.height)

mctx.drawImage(img,0,0,mini.width,mini.height)

const viewW=canvas.width/(img.width*zoom)*mini.width
const viewH=canvas.height/(img.height*zoom)*mini.height

const viewX=(-offsetX/(img.width*zoom))*mini.width
const viewY=(-offsetY/(img.height*zoom))*mini.height

mctx.strokeStyle="red"
mctx.strokeRect(viewX,viewY,viewW,viewH)

}

function save(){

fetch("/map-save.php",{
method:"POST",
headers:{'Content-Type':'application/json'},
body:JSON.stringify({
map:mapKey,
markers,
polygons
})
})

}

function loadFromServer(){

fetch("/map-data/"+mapKey+".json")
.then(r=>r.json())
.then(data=>{

markers=data.markers||[]
polygons=data.polygons||[]

draw()

})
.catch(()=>{})

}

}

function saveAll(){

Object.keys(maps).forEach(k=>{

fetch("/map-save.php",{
method:"POST",
headers:{'Content-Type':'application/json'},
body:JSON.stringify({
map:k,
markers:maps.markers,
polygons:maps.polygons
})
})

})

alert("Maps saved to server")

}
