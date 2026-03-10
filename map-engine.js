let tool="marker"
function setTool(t){tool=t}

const maps={}

function createMap(canvasId,imageSrc,mapKey){

const canvas=document.getElementById(canvasId)
const ctx=canvas.getContext("2d")

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

const saved=localStorage.getItem("map_"+mapKey)

if(saved){
const data=JSON.parse(saved)
markers=data.markers||[]
polygons=data.polygons||[]
}

maps[canvasId]={markers,polygons}

img.onload=()=>draw()

function draw(){

ctx.clearRect(0,0,canvas.width,canvas.height)

ctx.save()
ctx.translate(offsetX,offsetY)
ctx.scale(zoom,zoom)

ctx.drawImage(img,0,0)

ctx.fillStyle="red"

markers.forEach(m=>{
ctx.beginPath()
ctx.arc(m.x,m.y,6,0,Math.PI*2)
ctx.fill()
})

ctx.strokeStyle="cyan"
ctx.lineWidth=2

polygons.forEach(p=>{
ctx.beginPath()
p.forEach((pt,i)=>{
if(i==0)ctx.moveTo(pt.x,pt.y)
else ctx.lineTo(pt.x,pt.y)
})
ctx.closePath()
ctx.stroke()
})

if(currentPoly.length>0){
ctx.beginPath()
currentPoly.forEach((pt,i)=>{
if(i==0)ctx.moveTo(pt.x,pt.y)
else ctx.lineTo(pt.x,pt.y)
})
ctx.stroke()
}

ctx.restore()
}

canvas.addEventListener("mousedown",e=>{

const rect=canvas.getBoundingClientRect()
const x=(e.clientX-rect.left-offsetX)/zoom
const y=(e.clientY-rect.top-offsetY)/zoom

if(tool==="marker"){

markers.push({x,y})
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
polygons.push([...currentPoly])
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

const zoomAmount=e.deltaY*-0.001
zoom+=zoomAmount

if(zoom<0.5)zoom=0.5
if(zoom>4)zoom=4

draw()

})

function save(){

localStorage.setItem("map_"+mapKey,JSON.stringify({
markers,
polygons
}))

}

}
