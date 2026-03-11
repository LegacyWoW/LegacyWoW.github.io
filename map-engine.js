const maps = {}

const icons={
city:"../assets/icons/city.png",
fort:"../assets/icons/fort.png",
tower:"../assets/icons/tower.png",
house:"../assets/icons/house.png",
battle:"../assets/icons/battle.png"
}

function initMap(canvasId,imgSrc,key,isAdmin){

const canvas=document.getElementById(canvasId)
const ctx=canvas.getContext("2d")

const img=new Image()
img.src=imgSrc

img.onload=()=>{

canvas.width=900
canvas.height=900

maps[key]={
canvas,
ctx,
img,
zoom:1,
markers:[],
polygons:[],
current:[],
tool:null,
color:"#ffff00",
icon:"city",
admin:isAdmin
}

drawMap(key)

if(isAdmin){

canvas.addEventListener("click",e=>{

const rect=canvas.getBoundingClientRect()

const x=(e.clientX-rect.left)/maps[key].zoom
const y=(e.clientY-rect.top)/maps[key].zoom

if(maps[key].tool==="marker"){

maps[key].markers.push({x,y,icon:maps[key].icon})

}

if(maps[key].tool==="polygon"){

maps[key].current.push({x,y})

}

drawMap(key)

})

}

}

}

function drawMap(key){

const map=maps[key]

map.ctx.clearRect(0,0,map.canvas.width,map.canvas.height)

map.ctx.save()
map.ctx.scale(map.zoom,map.zoom)

map.ctx.drawImage(map.img,0,0)

map.polygons.forEach(p=>{

map.ctx.beginPath()

map.ctx.moveTo(p.points[0].x,p.points[0].y)

for(let i=1;i<p.points.length;i++){

map.ctx.lineTo(p.points[i].x,p.points[i].y)

}

map.ctx.closePath()

map.ctx.globalAlpha=.4
map.ctx.fillStyle=p.color
map.ctx.fill()

map.ctx.globalAlpha=1
map.ctx.strokeStyle="white"
map.ctx.stroke()

})

map.markers.forEach(m=>{

const icon=new Image()
icon.src=icons[m.icon]

map.ctx.drawImage(icon,m.x-12,m.y-12,24,24)

})

map.ctx.restore()

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
