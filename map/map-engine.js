const maps={}

const icons={
city:"../assets/icons/city.png",
fort:"../assets/icons/fort.png",
tower:"../assets/icons/tower.png",
house:"../assets/icons/house.png",
battle:"../assets/icons/battle.png"
}

function initMap(canvasId,imgSrc,key,isAdmin,miniId){

const canvas=document.getElementById(canvasId)
const ctx=canvas.getContext("2d")

const mini=document.getElementById(miniId)
const mctx=mini.getContext("2d")

const img=new Image()
img.src=imgSrc

img.onload=()=>{

canvas.width=1000
canvas.height=1000

maps[key]={
canvas,ctx,img,
zoom:1,
offsetX:0,
offsetY:0,
drag:false,
markers:[],
polygons:[],
current:[],
tool:null,
color:"#ffff00",
icon:"city",
admin:isAdmin,
mini,mctx
}

drawMap(key)

canvas.addEventListener("wheel",e=>{

e.preventDefault()

if(e.deltaY<0) zoomMap(key,1.1)
else zoomMap(key,.9)

})

canvas.addEventListener("mousedown",e=>{
maps[key].drag=true
})

canvas.addEventListener("mouseup",e=>{
maps[key].drag=false
})

canvas.addEventListener("mousemove",e=>{

if(maps[key].drag){

maps[key].offsetX+=e.movementX
maps[key].offsetY+=e.movementY

drawMap(key)

}

})

if(isAdmin){

canvas.addEventListener("click",e=>handleClick(e,key))

}

}

}

function handleClick(e,key){

const map=maps[key]

const rect=map.canvas.getBoundingClientRect()

const x=(e.clientX-rect.left-map.offsetX)/map.zoom
const y=(e.clientY-rect.top-map.offsetY)/map.zoom

if(map.tool==="marker"){

map.markers.push({
x,y,
icon:map.icon,
name:"City",
owner:"Neutral",
battle:"Peace"
})

}

if(map.tool==="polygon"){

map.current.push({x,y})

}

drawMap(key)

}

function drawMap(key){

const map=maps[key]

map.ctx.clearRect(0,0,map.canvas.width,map.canvas.height)

map.ctx.save()

map.ctx.translate(map.offsetX,map.offsetY)
map.ctx.scale(map.zoom,map.zoom)

map.ctx.drawImage(map.img,0,0)

/* POLYGONS */

map.polygons.forEach(p=>{

map.ctx.beginPath()
map.ctx.moveTo(p.points[0].x,p.points[0].y)

for(let i=1;i<p.points.length;i++){

map.ctx.lineTo(p.points[i].x,p.points[i].y)

}

map.ctx.closePath()

map.ctx.globalAlpha=.35
map.ctx.fillStyle=p.color
map.ctx.fill()

map.ctx.globalAlpha=1
map.ctx.strokeStyle="white"
map.ctx.stroke()

})

/* MARKERS */

map.markers.forEach(m=>{

const icon=new Image()
icon.src=icons[m.icon]

map.ctx.drawImage(icon,m.x-12,m.y-12,24,24)

})

map.ctx.restore()

drawMini(key)

}

function drawMini(key){

const map=maps[key]

map.mctx.clearRect(0,0,200,200)

map.mctx.drawImage(map.img,0,0,200,200)

}

function setTool(tool,key){

maps[key].tool=tool

}

function setIcon(icon,key){

maps[key].icon=icon

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

function zoomMap(key,amount){

maps[key].zoom*=amount

drawMap(key)

}
