const isAdmin = new URLSearchParams(location.search).get("admin") === "1";

let tool="pan"
let currentIcon="city"

function setTool(t){ if(isAdmin) tool=t }
function setIcon(i){ if(isAdmin) currentIcon=i }

const maps={}

function createMap(canvasId,miniId,imageSrc,mapKey){

const canvas=document.getElementById(canvasId)
canvas.width = window.innerWidth * 0.9  // make map bigger
canvas.height = window.innerHeight * 0.8

const ctx=canvas.getContext("2d")
const mini=document.getElementById(miniId)
mini.width = canvas.width / 5
mini.height = canvas.height / 5
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
ctx.drawImage(img,0,0,canvas.width/zoom,canvas.height/zoom)

drawPolygons()
drawMarkers()
drawCurrentPoly()
ctx.restore()
drawMini()
}

function drawPolygons(){
polygons.forEach(p=>{
ctx.fillStyle = p.color || "#00ffff"
ctx.globalAlpha = 0.35
ctx.beginPath()
p.points.forEach((pt,i)=>{
if(i===0) ctx.moveTo(pt.x,pt.y)
else ctx.lineTo(pt.x,pt.y)
})
ctx.closePath()
ctx.fill()
ctx.globalAlpha = 1
ctx.strokeStyle = p.color || "#fff"
ctx.stroke()
if(p.name){
ctx.fillStyle="white"
ctx.font="16px Arial"
ctx.fillText(p.name,p.points[0].x,p.points[0].y)
}
})
}

function drawCurrentPoly(){
if(currentPoly.length===0) return
ctx.strokeStyle="yellow"
ctx.lineWidth=2
ctx.beginPath()
currentPoly.forEach((p,i)=>{
if(i===0) ctx.moveTo(p.x,p.y)
else ctx.lineTo(p.x,p.y)
})
ctx.stroke()
}

function drawMarkers(){
markers.forEach(m=>{
let icon="🏙"
if(m.icon==="city") icon="🏙"
if(m.icon==="fort") icon="🏰"
if(m.icon==="tower") icon="🏯"
if(m.icon==="house") icon="🏠"
if(m.icon==="battle") icon="⚔"
ctx.font="22px serif"
ctx.fillText(icon,m.x-10,m.y+8)
if(m.name){
ctx.font="13px Arial"
ctx.fillStyle="white"
ctx.fillText(m.name,m.x+12,m.y)
}
})
}

canvas.addEventListener("mousedown",e=>{
const rect=canvas.getBoundingClientRect()
const x=(e.clientX-rect.left-offsetX)/zoom
const y=(e.clientY-rect.top-offsetY)/zoom

if(isAdmin){
if(tool==="marker"){
const name=prompt("City / Location name")
const guild=prompt("Guild owner")
const status=prompt("Battle status")
markers.push({x,y,name,guild,status,icon:currentIcon})
save()
draw()
return
}
if(tool==="polygon"){
currentPoly.push({x,y})
draw()
return
}
}

dragging=true
startX=e.clientX
startY=e.clientY
})

canvas.addEventListener("dblclick",()=>{
if(!isAdmin) return
if(currentPoly.length>2){
const name=prompt("Territory name")
const color=document.getElementById("polyColor").value
polygons.push({points:[...currentPoly],name,color})
currentPoly=[]
save()
draw()
}
})

canvas.addEventListener("mousemove",e=>{
if(!dragging) return
offsetX += e.clientX-startX
offsetY += e.clientY-startY
startX=e.clientX
startY=e.clientY
draw()
})

canvas.addEventListener("mouseup",()=>dragging=false)

canvas.addEventListener("wheel",e=>{
e.preventDefault()
const scale = e.deltaY<0?1.12:0.88
const rect=canvas.getBoundingClientRect()
const mx=e.clientX-rect.left
const my=e.clientY-rect.top
const worldX=(mx-offsetX)/zoom
const worldY=(my-offsetY)/zoom
zoom*=scale
if(zoom<0.08) zoom=0.08
if(zoom>10) zoom=10
offsetX=mx - worldX*zoom
offsetY=my - worldY*zoom
draw()
})

canvas.addEventListener("click",e=>{
const rect=canvas.getBoundingClientRect()
const x=(e.clientX-rect.left-offsetX)/zoom
const y=(e.clientY-rect.top-offsetY)/zoom
markers.forEach(m=>{
const dist=Math.hypot(m.x-x,m.y-y)
if(dist<12) showCityPanel(m)
})
})

function showCityPanel(city){
let panel=document.getElementById("cityPanel")
if(!panel){
panel=document.createElement("div")
panel.id="cityPanel"
panel.style.position="fixed"
panel.style.right="30px"
panel.style.bottom="30px"
panel.style.background="#111"
panel.style.border="1px solid #444"
panel.style.padding="15px"
panel.style.width="260px"
panel.style.zIndex=9999
document.body.appendChild(panel)
}
panel.innerHTML=`<b>${city.name}</b><br><br>
Guild Owner: ${city.guild||"None"}<br>
Battle Status: ${city.status||"Peaceful"}`
}

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

function save(){ if(!isAdmin) return
fetch("/map-save.php",{
method:"POST",
headers:{'Content-Type':'application/json'},
body:JSON.stringify({map:mapKey,markers,polygons})
})
}

function loadFromServer(){
fetch("/map-data/"+mapKey+".json")
.then(r=>r.json())
.then(data=>{markers=data.markers||[];polygons=data.polygons||[];draw()})
.catch(()=>{})
}

}

function saveAll(){
if(!isAdmin) return
Object.keys(maps).forEach(k=>{
fetch("/map-save.php",{
method:"POST",
headers:{'Content-Type':'application/json'},
body:JSON.stringify(maps[k])
})
})
alert("Maps saved")
}
