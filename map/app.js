// LegacyWoW War Map — all territory information is maintained manually by administrators.
// Export the GeoJSON and replace /data/overlays.geojson to publish updates.
const ADMIN = new URLSearchParams(location.search).get('admin') === '1';
const IMAGE_HEIGHT=1000, IMAGE_WIDTH=1800, IMAGE_URL='/assets/worldmap.jpg', DATA_URL='/data/overlays.geojson';
const STATUSES={controlled:'Controlled',contested:'Contested',attacked:'Under siege / attack',neutral:'Unclaimed / neutral'};
const TERRITORY_TYPES={territory:'Territory',settlement:'Settlement',fort:'Fort',city:'City',capital:'Faction Capital',landmark:'Landmark',camp:'Camp',guildhouse:'Guildhouse'};
const ICONS={auto:{label:'Automatic by type',emoji:'🏴'},capital:{label:'City / Capital',emoji:'🏰'},factionCapital:{label:'Faction Capital',emoji:'👑'},fort:{label:'Fort / Castle',emoji:'🏯'},tower:{label:'Guard Tower',emoji:'🗼'},village:{label:'Village / Settlement',emoji:'🏘️'},guildhouse:{label:'Guildhouse',emoji:'🏠'},camp:{label:'Camp',emoji:'⛺'},landmark:{label:'Landmark',emoji:'🗿'},territory:{label:'Territory',emoji:'⚑'},pin:{label:'Pin',emoji:'📍'},battle:{label:'World Event — Clashing Swords',emoji:'⚔️'},skull:{label:'World Event — Skull',emoji:'💀'}};
const TYPE_ICON={territory:'territory',settlement:'village',fort:'fort',city:'capital',capital:'factionCapital',landmark:'landmark',camp:'camp',guildhouse:'guildhouse'};
const map=L.map('map',{crs:L.CRS.Simple,minZoom:-2,maxZoom:3,zoomControl:true,attributionControl:false});
const bounds=[[0,0],[IMAGE_HEIGHT,IMAGE_WIDTH]]; map.fitBounds(bounds);map.setMaxBounds(bounds);L.imageOverlay(IMAGE_URL,bounds).addTo(map);
const groups={}; const drawnItems=new L.FeatureGroup().addTo(map); let allLayers=[]; let selectedLayer=null;
function esc(s){return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function safeColor(c){return /^#[0-9a-f]{6}$/i.test(c||'')?c:'#9aa7b5';}
function factionKey(name){return String(name||'Neutral').trim()||'Neutral';}
function factionColor(name){const f=factionKey(name).toLowerCase();if(f==='alliance')return '#2d8cff';if(f==='horde')return '#e44852';if(f==='neutral'||f==='unclaimed')return '#9aa7b5';return '#9aa7b5';}
function groupKey(name){return factionKey(name).toLowerCase();}
function getGroup(name){const key=groupKey(name);if(!groups[key])groups[key]=L.featureGroup().addTo(map);return groups[key];}
function meta(layer){layer._lw=layer._lw||{};const p=layer._lw;p.title=p.title||'Unnamed territory';p.owner=factionKey(p.owner||p.category||'Neutral');p.color=safeColor(p.color||factionColor(p.owner));p.status=STATUSES[p.status]?p.status:'controlled';p.type=TERRITORY_TYPES[p.type]?p.type:'territory';p.icon=ICONS[p.icon]?p.icon:(TYPE_ICON[p.type]||'territory');p.description=p.description||'';p.defense=clampRating(p.defense);p.attacker=p.attacker||'';p.attackerRating=clampRating(p.attackerRating);p.importance=p.importance||'';p.garrison=p.garrison||'';p.fortifications=p.fortifications||'';p.battleNotes=p.battleNotes||'';p.lastUpdated=p.lastUpdated||'';return p;}
function clampRating(v){const n=Number(v);return Number.isFinite(n)?n:0;}
function colorOf(layer){const p=meta(layer);return (p.status==='contested'||p.status==='attacked')?'#f0b94e':p.color;}
function iconOf(layer){const p=meta(layer);return p.icon==='auto'?(TYPE_ICON[p.type]||'territory'):p.icon;}
function markerIcon(layer){const p=meta(layer),ic=ICONS[iconOf(layer)]||ICONS.territory,c=colorOf(layer);return L.divIcon({className:'lw-map-icon',html:`<div class="lw-marker" style="--marker-color:${c}">${ic.emoji}</div>`,iconSize:[36,36],iconAnchor:[18,18],popupAnchor:[0,-16]});}
function applyStyle(layer){
 const p=meta(layer),c=colorOf(layer);
 if(layer instanceof L.Marker){layer.setIcon(markerIcon(layer));return;}
 if(layer.setStyle)layer.setStyle({
   color:(p.status==='attacked'||p.status==='contested')?c:'#17212b',
   weight:(p.status==='attacked')?3.5:(p.status==='contested'?3:1.35),
   opacity:(p.status==='attacked'||p.status==='contested')?.98:.9,
   fillColor:c,
   fillOpacity:p.status==='attacked'?.32:p.status==='contested'?.29:.24,
   dashArray:p.status==='attacked'?'7 4':null,
   lineCap:'round',lineJoin:'round'
 });
}
function addToOwner(layer){const p=meta(layer);Object.values(groups).forEach(g=>g.removeLayer(layer));getGroup(p.owner).addLayer(layer);drawnItems.addLayer(layer);applyStyle(layer);}
function iconLabel(layer){const p=meta(layer);return (ICONS[iconOf(layer)]||ICONS.territory).emoji;}
function ratingText(v){return esc(v);}
function detailHTML(layer){const p=meta(layer),c=colorOf(layer),isSiege=p.status==='attacked'||p.status==='contested';let html=`<div class="detail-name">${iconLabel(layer)} ${esc(p.title)}</div><div class="badge" style="color:${c}">${esc(STATUSES[p.status])}</div><div class="detail-copy"><strong style="color:#d9e8f7">Type</strong><br>${esc(TERRITORY_TYPES[p.type])}<br><br><strong style="color:#d9e8f7">Controlled by</strong><br>${esc(p.owner)}<br><br><strong style="color:#d9e8f7">Defense rating</strong><br>${ratingText(p.defense)}`;
if(isSiege) html+=`<br><br><strong style="color:#d9e8f7">Attacker</strong><br>${esc(p.attacker)}<br><strong style="color:#d9e8f7">Attacker rating</strong><br>${ratingText(p.attackerRating)}`;
if(p.importance) html+=`<br><br><strong style="color:#d9e8f7">Strategic importance</strong><br>${esc(p.importance)}`;if(p.garrison) html+=`<br><br><strong style="color:#d9e8f7">Garrison strength</strong><br>${esc(p.garrison)}`;if(p.fortifications) html+=`<br><br><strong style="color:#d9e8f7">Defensive fortifications</strong><br>${esc(p.fortifications)}`;if(p.battleNotes) html+=`<br><br><strong style="color:#d9e8f7">Battle notes</strong><br>${esc(p.battleNotes)}`;if(p.lastUpdated) html+=`<br><br><strong style="color:#d9e8f7">Last updated</strong><br>${esc(p.lastUpdated)}`;if(p.description.trim()) html+=`<br><br><strong style="color:#d9e8f7">Information</strong><br>${esc(p.description)}`;
return html+'</div>';}
function updateDetails(layer){document.getElementById('details').innerHTML=detailHTML(layer);}
function attachViewer(layer){const p=meta(layer),isSiege=p.status==='attacked'||p.status==='contested';let html=`<div class="popup-title">${iconLabel(layer)} ${esc(p.title)}</div><div class="popup-meta" style="color:${colorOf(layer)}">${esc(p.owner)} · ${esc(TERRITORY_TYPES[p.type])} · ${esc(STATUSES[p.status])}</div><div class="popup-desc"><strong>Defense rating:</strong> ${ratingText(p.defense)}`;
if(isSiege) html+=`<br><strong>Attacker:</strong> ${esc(p.attacker)} · <strong>Attacker rating:</strong> ${ratingText(p.attackerRating)}`;
if(p.importance) html+=`<br><strong>Strategic importance:</strong> ${esc(p.importance)}`;if(p.garrison) html+=`<br><strong>Garrison:</strong> ${esc(p.garrison)}`;if(p.battleNotes) html+=`<br><br><strong>Battle notes</strong><br>${esc(p.battleNotes)}`;if(p.description.trim()) html+=`<br><br><strong>Information</strong><br>${esc(p.description)}`;
html+='</div>';layer.bindPopup(html,{className:'lw-dark-popup'});if(layer.setTooltipContent)layer.bindTooltip(`${iconLabel(layer)} ${esc(p.title)}`,{direction:'top',sticky:true,opacity:.96});}
function attachClick(layer){
 layer.off('click');
 layer.on('click',()=>{
   if(selectedLayer && selectedLayer!==layer && !(selectedLayer instanceof L.Marker)) applyStyle(selectedLayer);
   selectedLayer=layer;
   if(layer instanceof L.Marker){layer.setZIndexOffset(1200);if(layer._icon)layer._icon.style.zIndex='1200';}
   else if(layer.setStyle)layer.setStyle({color:'#f6d477',weight:4,opacity:1,fillOpacity:.34});
   if(ADMIN)attachEditor(layer);else{attachViewer(layer);updateDetails(layer);}
 });
}
function field(label,id,value,type='text',extra=''){return `<label for="${id}">${label}</label><input id="${id}" type="${type}" value="${esc(value)}" ${extra}>`;}
function attachEditor(layer){const p=meta(layer),isMarker=layer instanceof L.Marker;const types=Object.entries(TERRITORY_TYPES).map(([k,v])=>`<option value="${k}" ${p.type===k?'selected':''}>${v}</option>`).join('');const statuses=Object.entries(STATUSES).map(([k,v])=>`<option value="${k}" ${p.status===k?'selected':''}>${v}</option>`).join('');const icons=Object.entries(ICONS).map(([k,v])=>`<option value="${k}" ${iconOf(layer)===k?'selected':''}>${v.emoji} ${v.label}</option>`).join('');const html=`<div class="edit-form"><div class="popup-title">Edit territory</div>${field('Territory name','lw-title',p.title,'text','maxlength="100"')}${field('Faction / owner name (create any faction)','lw-owner',p.owner,'text','maxlength="80" placeholder="e.g. Alliance, Horde, Guild name"')}<label>Territory color</label><input id="lw-color" type="color" value="${p.color}"><label>Territory type</label><select id="lw-type">${types}</select><label>Map icon</label><select id="lw-icon">${icons}</select><label>Territory status</label><select id="lw-status">${statuses}</select>${field('Defense rating (any number)','lw-defense',p.defense,'number','step="any"')}<div id="siegeFields" style="display:${p.status==='attacked'||p.status==='contested'?'grid':'none'};gap:7px"><label for="lw-attacker">Attacker / attacking faction</label><input id="lw-attacker" value="${esc(p.attacker)}" maxlength="100" placeholder="Who is attacking?">${field('Attacker rating (any number)','lw-attackrating',p.attackerRating,'number','step="any"')}</div><label>Strategic importance</label><select id="lw-importance"><option value="" ${!p.importance?"selected":""}>Not specified</option>${["Low","Moderate","High","Critical"].map(v=>`<option ${p.importance===v?"selected":""}>${v}</option>`).join("")}</select>${field("Garrison strength (optional)","lw-garrison",p.garrison)}<label>Defensive fortifications (optional)</label><textarea id="lw-fortifications" maxlength="500">${esc(p.fortifications)}</textarea><label>Battle notes (optional)</label><textarea id="lw-battle-notes" maxlength="1000">${esc(p.battleNotes)}</textarea>${field("Last updated (optional)","lw-last-updated",p.lastUpdated)}<label>Information</label><textarea id="lw-description" maxlength="1000" placeholder="Optional details, defenses, history, siege notes">${esc(p.description)}</textarea><button class="btn" id="lw-save">Save territory</button><div class="statusline">Changes are local until you export and publish the GeoJSON.</div></div>`;layer.bindPopup(html,{minWidth:255,maxWidth:310}).openPopup();setTimeout(()=>{const status=document.getElementById('lw-status');if(!status)return;status.onchange=()=>{document.getElementById('siegeFields').style.display=(status.value==='attacked'||status.value==='contested')?'grid':'none';};const typeSelect=document.getElementById('lw-type'),iconSelect=document.getElementById('lw-icon');typeSelect.onchange=()=>{if(typeSelect.value==='capital'&&iconSelect.value==='auto')iconSelect.value='factionCapital';};document.getElementById('lw-save').onclick=()=>{p.title=document.getElementById('lw-title').value.trim()||'Unnamed territory';p.owner=factionKey(document.getElementById('lw-owner').value);p.color=safeColor(document.getElementById('lw-color').value);p.type=document.getElementById('lw-type').value;p.icon=document.getElementById('lw-icon').value;if(p.type==='capital'&&p.icon==='auto')p.icon='factionCapital';p.status=status.value;p.defense=clampRating(document.getElementById('lw-defense').value);p.attacker=document.getElementById('lw-attacker')?.value.trim()||'';p.attackerRating=clampRating(document.getElementById('lw-attackrating')?.value);p.description=document.getElementById('lw-description').value.trim();p.importance=document.getElementById('lw-importance').value;p.garrison=document.getElementById('lw-garrison').value.trim();p.fortifications=document.getElementById('lw-fortifications').value.trim();p.battleNotes=document.getElementById('lw-battle-notes').value.trim();p.lastUpdated=document.getElementById('lw-last-updated').value.trim();addToOwner(layer);attachClick(layer);attachViewer(layer);updateDetails(layer);renderLegend();refreshWarRoom();layer.closePopup();};},40);}
function loadFeature(layer,props,geom){const oldOwner=props.owner||props.category||'Neutral';layer._lw={title:props.title||(geom==='Point'?'Map marker':'Unnamed territory'),owner:factionKey(oldOwner),color:safeColor(props.color||factionColor(oldOwner)),status:STATUSES[props.status]?props.status:((String(oldOwner).toLowerCase()==='neutral')?'neutral':'controlled'),type:TERRITORY_TYPES[props.type]?props.type:(geom==='Point'?(props.icon==='city'?'city':props.icon==='fort'?'fort':'territory'):'territory'),icon:props.icon&&ICONS[props.icon]?props.icon:(props.icon==='city'?'capital':props.icon==='fort'?'fort':'auto'),description:props.description||'',defense:clampRating(props.defense),attacker:props.attacker||'',attackerRating:clampRating(props.attackerRating),importance:props.importance||'',garrison:props.garrison||'',fortifications:props.fortifications||'',battleNotes:props.battleNotes||'',lastUpdated:props.lastUpdated||''};addToOwner(layer);attachClick(layer);}

let searchTerm='', typeFilter='', statusFilter='';
function matchesFilters(layer){
 const p=meta(layer),q=searchTerm.toLowerCase();
 const text=[p.title,p.owner,p.type,p.status,p.description,p.attacker].join(' ').toLowerCase();
 return (!q||text.includes(q))&&(!typeFilter||p.type===typeFilter)&&(!statusFilter||p.status===statusFilter);
}
function refreshWarRoom(){
 const regions=allLayers.filter(l=>!(l instanceof L.Marker));
 const count=(fn)=>regions.filter(fn).length;
 const set=(id,v)=>{const el=document.getElementById(id);if(el)el.textContent=String(v);};
 set('statTerritories',regions.length);
 set('statCapitals',count(l=>meta(l).type==='capital'));
 set('statAttacked',count(l=>meta(l).status==='attacked'));
 set('statContested',count(l=>meta(l).status==='contested'));
 const list=document.getElementById('battleList');
 if(list){
   const active=regions.filter(l=>['attacked','contested'].includes(meta(l).status));
   list.innerHTML=active.length?active.map(l=>{const p=meta(l);return `<button class="battle-item" data-index="${allLayers.indexOf(l)}"><strong>${p.status==='attacked'?'⚔️':'🛡️'} ${esc(p.title)}</strong><span>${esc(p.owner)} · ${esc(STATUSES[p.status])}${p.attacker?' · Attacker: '+esc(p.attacker):''}</span></button>`;}).join(''):'<div class="empty-note">No territories are currently marked contested or under attack.</div>';
   list.querySelectorAll('[data-index]').forEach(b=>b.onclick=()=>{const l=allLayers[Number(b.dataset.index)];if(!l)return;map.setView(l.getBounds?l.getBounds().getCenter():l.getLatLng(),Math.max(0,map.getZoom()));l.fire('click');});
 }
 const enabled=new Set([...document.querySelectorAll('[data-owner]')].filter(x=>x.checked).map(x=>x.dataset.owner));
 allLayers.forEach(l=>{
   const p=meta(l),g=getGroup(p.owner);
   if(matchesFilters(l)&&enabled.has(p.owner.toLowerCase())){if(!g.hasLayer(l))g.addLayer(l);}
   else g.removeLayer(l);
 });
}
function setupWarRoomFilters(){
 const t=document.getElementById('typeFilter'),s=document.getElementById('statusFilter'),q=document.getElementById('territorySearch');
 if(t)t.innerHTML='<option value="">All territory types</option>'+Object.entries(TERRITORY_TYPES).map(([k,v])=>`<option value="${k}">${esc(v)}</option>`).join('');
 if(s)s.innerHTML='<option value="">All statuses</option>'+Object.entries(STATUSES).map(([k,v])=>`<option value="${k}">${esc(v)}</option>`).join('');
 if(q)q.oninput=()=>{searchTerm=q.value.trim();refreshWarRoom();};
 if(t)t.onchange=()=>{typeFilter=t.value;refreshWarRoom();};
 if(s)s.onchange=()=>{statusFilter=s.value;refreshWarRoom();};
}

function renderLegend(){const owners={};allLayers.forEach(l=>{const p=meta(l);owners[p.owner.toLowerCase()]={name:p.owner,color:p.color};});const filters=document.getElementById('layerFilters');if(!filters)return;filters.innerHTML='<label class="filter"><input type="checkbox" id="showAllLayers" checked> All territories</label>'+Object.values(owners).sort((a,b)=>a.name.localeCompare(b.name)).map(o=>`<label class="filter"><input type="checkbox" data-owner="${esc(o.name.toLowerCase())}" checked> <span class="swatch" style="color:${o.color};border-color:${o.color};background:${o.color}35"></span>${esc(o.name)}</label>`).join('');const allToggle=document.getElementById('showAllLayers');allToggle.onchange=e=>{document.querySelectorAll('[data-owner]').forEach(i=>{i.checked=e.target.checked;const g=groups[i.dataset.owner];if(g){if(i.checked)map.addLayer(g);else map.removeLayer(g);}});};document.querySelectorAll('[data-owner]').forEach(i=>i.onchange=()=>{const g=groups[i.dataset.owner];if(g){if(i.checked)map.addLayer(g);else map.removeLayer(g);}allToggle.checked=[...document.querySelectorAll('[data-owner]')].every(x=>x.checked);refreshWarRoom();});setupWarRoomFilters();refreshWarRoom();}
fetch(DATA_URL,{cache:'no-store'}).then(r=>{if(!r.ok)throw Error('Could not load territory data');return r.json();}).then(geo=>{if(!geo||!Array.isArray(geo.features))throw Error('Invalid GeoJSON');L.geoJSON(geo,{pointToLayer:(f,ll)=>L.marker(ll),onEachFeature:(f,layer)=>{loadFeature(layer,f.properties||{},f.geometry?.type);allLayers.push(layer);}});renderLegend();setupWarRoomFilters();refreshWarRoom();if(!allLayers.length&&ADMIN)document.getElementById('details').innerHTML='<div class="detail-name">Ready to map</div><div class="detail-copy">Use the drawing tools to add territories or markers.</div>';}).catch(err=>{console.error(err);document.getElementById('details').innerHTML='<div class="detail-name">Map data unavailable</div><div class="detail-copy">Could not load /data/overlays.geojson. Check that the file exists in the published site.</div>';});
if(ADMIN){const drawControl=new L.Control.Draw({edit:{featureGroup:drawnItems,remove:true},draw:{polygon:{allowIntersection:false,showArea:true},rectangle:true,circle:false,marker:true,polyline:false,circlemarker:false}});map.addControl(drawControl);map.on(L.Draw.Event.CREATED,e=>{const layer=e.layer;snapPolygonVertices(layer);layer._lw={title:layer instanceof L.Marker?'New marker':'New territory',owner:'Neutral',color:'#9aa7b5',status:'neutral',type:layer instanceof L.Marker?'landmark':'territory',icon:layer instanceof L.Marker?'auto':'territory',description:'',defense:0,attacker:'',attackerRating:0};addToOwner(layer);allLayers.push(layer);attachClick(layer);attachEditor(layer);renderLegend();refreshWarRoom();});map.on(L.Draw.Event.EDITED,e=>e.layers.eachLayer(l=>{snapPolygonVertices(l);applyStyle(l);attachClick(l);}));map.on(L.Draw.Event.DELETED,e=>{e.layers.eachLayer(l=>{Object.values(groups).forEach(g=>g.removeLayer(l));allLayers=allLayers.filter(x=>x!==l);});renderLegend();});}
document.getElementById('resetViewBtn')?.addEventListener('click',()=>map.fitBounds(bounds));document.getElementById('exportBtn')?.addEventListener('click',()=>{if(!ADMIN)return alert('Admin only.');const features=[];drawnItems.eachLayer(layer=>{const gj=layer.toGeoJSON(),p=meta(layer);gj.properties={title:p.title,owner:p.owner,color:p.color,category:p.owner.toLowerCase(),status:p.status,type:p.type,icon:p.icon,description:p.description,defense:p.defense,attacker:p.attacker,attackerRating:p.attackerRating,importance:p.importance,garrison:p.garrison,fortifications:p.fortifications,battleNotes:p.battleNotes,lastUpdated:p.lastUpdated};features.push(gj);});downloadJson({type:'FeatureCollection',features},'overlays.geojson');});document.getElementById('clearBtn')?.addEventListener('click',()=>{if(!ADMIN)return alert('Admin only.');if(!confirm('Remove all territories from this editing session? This does not change the published map until you export and replace overlays.geojson.'))return;Object.values(groups).forEach(g=>g.clearLayers());drawnItems.clearLayers();allLayers=[];renderLegend();refreshWarRoom();document.getElementById('details').innerHTML='<div class="detail-name">Map cleared</div><div class="detail-copy">Current editing session cleared only.</div>';});
function downloadJson(obj,filename){const blob=new Blob([JSON.stringify(obj,null,2)],{type:'application/geo+json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=filename;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);}
