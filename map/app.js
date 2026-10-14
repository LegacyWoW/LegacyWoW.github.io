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

// Admin editor is a floating panel outside Leaflet's popup pane. It opens near the clicked
// feature, can be moved anywhere on the page, and is recreated at the next feature's anchor.
let activeEditor = null;
function closeFloatingEditor(){ if(activeEditor){ activeEditor.remove(); activeEditor=null; } }
function openFloatingEditor(layer, html, clickPoint){
 closeFloatingEditor();
 const panel=document.createElement('section');
 panel.className='lw-floating-editor';
 panel.setAttribute('role','dialog'); panel.setAttribute('aria-label','Edit territory');
 panel.innerHTML=`<div class="lw-floating-head"><strong>Edit territory</strong><button type="button" class="lw-floating-close" aria-label="Close editor">×</button></div><div class="lw-floating-body">${html}</div><div class="lw-floating-resize-hint">Drag the header to move · resize from the lower-right corner</div>`;
 document.body.appendChild(panel); activeEditor=panel;
 const point=layer instanceof L.Marker ? map.latLngToContainerPoint(layer.getLatLng()) : map.latLngToContainerPoint(layer.getBounds ? layer.getBounds().getCenter() : map.getCenter());
 const mapRect=map.getContainer().getBoundingClientRect();
 // Prefer the exact mouse click position. Polygon bounds centers can be far from the
 // border/point the administrator actually clicked.
 const anchorX=clickPoint?.x ?? (mapRect.left+point.x);
 const anchorY=clickPoint?.y ?? (mapRect.top+point.y);
 const panelWidth=360, panelHeight=Math.min(600,window.innerHeight-32);
 let left=anchorX+18, top=anchorY-40;
 if(left+panelWidth>window.innerWidth-8) left=anchorX-panelWidth-18;
 if(top+panelHeight>window.innerHeight-8) top=window.innerHeight-panelHeight-8;
 panel.style.left=left+'px'; panel.style.top=top+'px';
 panel.querySelector('.lw-floating-close').addEventListener('click',closeFloatingEditor);
 const handle=panel.querySelector('.lw-floating-head'); let dragging=false, sx=0, sy=0, ox=0, oy=0, activePointer=null;
 // Listen on document during drag so movement continues even when the cursor leaves the header.
 handle.addEventListener('pointerdown',ev=>{if(ev.target.closest('button')||ev.button!==0)return;dragging=true;activePointer=ev.pointerId;sx=ev.clientX;sy=ev.clientY;const r=panel.getBoundingClientRect();ox=r.left;oy=r.top;panel.classList.add('is-dragging');ev.preventDefault();});
 const movePanel=ev=>{if(!dragging|| (activePointer!==null && ev.pointerId!==activePointer))return;panel.style.left=(ox+ev.clientX-sx)+'px';panel.style.top=(oy+ev.clientY-sy)+'px';};
 const stop=ev=>{if(!dragging)return;if(ev && activePointer!==null && ev.pointerId!==activePointer)return;dragging=false;activePointer=null;panel.classList.remove('is-dragging');};
 document.addEventListener('pointermove',movePanel);document.addEventListener('pointerup',stop);document.addEventListener('pointercancel',stop);
 return panel.querySelector('.lw-floating-body');
}
const groups={}; const drawnItems=new L.FeatureGroup().addTo(map); let allLayers=[]; let selectedLayer=null;
function esc(s){return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function safeColor(c){return /^#[0-9a-f]{6}$/i.test(c||'')?c:'#9aa7b5';}
function factionKey(name){return String(name||'Neutral').trim()||'Neutral';}
function factionColor(name){const f=factionKey(name).toLowerCase();if(f==='alliance')return '#2d8cff';if(f==='horde')return '#e44852';if(f==='neutral'||f==='unclaimed')return '#9aa7b5';return '#9aa7b5';}
function groupKey(name){return factionKey(name).toLowerCase();}
function getGroup(name){const key=groupKey(name);if(!groups[key])groups[key]=L.featureGroup().addTo(map);return groups[key];}
function meta(layer){layer._lw=layer._lw||{};const p=layer._lw;p.title=p.title||'Unnamed territory';p.owner=factionKey(p.owner||p.category||'Neutral');p.color=safeColor(p.color||factionColor(p.owner));p.status=STATUSES[p.status]?p.status:'controlled';p.type=TERRITORY_TYPES[p.type]?p.type:'territory';p.icon=ICONS[p.icon]?p.icon:(TYPE_ICON[p.type]||'territory');p.description=p.description||'';p.defense=clampRating(p.defense);p.attacker=p.attacker||'';p.attackerRating=clampRating(p.attackerRating);p.importance=p.importance||'';p.garrison=p.garrison||'';p.fortifications=p.fortifications||'';p.battleNotes=p.battleNotes||'';p.lastUpdated=p.lastUpdated||'';p.history=Array.isArray(p.history)?p.history:[];p.battleStart=p.battleStart||'';p.battleEnd=p.battleEnd||'';p.battleType=p.battleType||'';p.strategicNotes=p.strategicNotes||'';return p;}
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
 layer.on('click',(event)=>{
   if(selectedLayer && selectedLayer!==layer && !(selectedLayer instanceof L.Marker)) applyStyle(selectedLayer);
   selectedLayer=layer;
   if(layer instanceof L.Marker){layer.setZIndexOffset(1200);if(layer._icon)layer._icon.style.zIndex='1200';}
   else if(layer.setStyle)layer.setStyle({color:'#f6d477',weight:4,opacity:1,fillOpacity:.34});
   if(ADMIN){const oe=event?.originalEvent;attachEditor(layer,oe?{x:oe.clientX,y:oe.clientY}:null);}else{attachViewer(layer);updateDetails(layer);}
 });
}
function field(label,id,value,type='text',extra=''){return `<label for="${id}">${label}</label><input id="${id}" type="${type}" value="${esc(value)}" ${extra}>`;}
function attachEditor(layer, clickPoint){
 const p=meta(layer);
 const types=Object.entries(TERRITORY_TYPES).map(([k,v])=>`<option value="${k}" ${p.type===k?'selected':''}>${v}</option>`).join('');
 const statuses=Object.entries(STATUSES).map(([k,v])=>`<option value="${k}" ${p.status===k?'selected':''}>${v}</option>`).join('');
 const icons=Object.entries(ICONS).map(([k,v])=>`<option value="${k}" ${iconOf(layer)===k?'selected':''}>${v.emoji} ${v.label}</option>`).join('');
 const html=`<div class="edit-form">${field('Territory name','lw-title',p.title,'text','maxlength="100"')}${field('Faction / owner name (create any faction)','lw-owner',p.owner,'text','maxlength="80" placeholder="e.g. Alliance, Horde, Guild name"')}<label>Territory color</label><input id="lw-color" type="color" value="${p.color}"><label>Territory type</label><select id="lw-type">${types}</select><label>Map icon</label><select id="lw-icon">${icons}</select><label>Territory status</label><select id="lw-status">${statuses}</select>${field('Defense rating (any number)','lw-defense',p.defense,'number','step="any"')}<div id="siegeFields" style="display:${p.status==='attacked'||p.status==='contested'?'grid':'none'};gap:7px"><label for="lw-attacker">Attacker / attacking faction</label><input id="lw-attacker" value="${esc(p.attacker)}" maxlength="100" placeholder="Who is attacking?">${field('Attacker rating (any number)','lw-attackrating',p.attackerRating,'number','step="any"')}</div><label>Strategic importance</label><select id="lw-importance"><option value="" ${!p.importance?'selected':''}>Not specified</option>${['Low','Moderate','High','Critical'].map(v=>`<option ${p.importance===v?'selected':''}>${v}</option>`).join('')}</select>${field('Garrison strength (optional)','lw-garrison',p.garrison)}<label>Defensive fortifications (optional)</label><textarea id="lw-fortifications" maxlength="500">${esc(p.fortifications)}</textarea><label>Battle notes (optional)</label><textarea id="lw-battle-notes" maxlength="1000">${esc(p.battleNotes)}</textarea>${field('Last updated (optional)','lw-last-updated',p.lastUpdated)}${field('Battle / siege type (optional)','lw-battle-type',p.battleType)}${field('Battle start date (optional)','lw-battle-start',p.battleStart)}${field('Battle end date (optional)','lw-battle-end',p.battleEnd)}<label>Strategic notes (optional)</label><textarea id="lw-strategic-notes" maxlength="1000">${esc(p.strategicNotes)}</textarea><label>Chronicle entries (one per line: YYYY-MM-DD | Event title | Details)</label><textarea id="lw-history" maxlength="4000" placeholder="2026-10-13 | Siege begins | The attackers reached the outer gate.">${esc(p.history.map(h=>[h.date||'',h.title||'',h.details||''].join(' | ')).join('\n'))}</textarea><label>Information</label><textarea id="lw-description" maxlength="1000" placeholder="Optional details, defenses, history, siege notes">${esc(p.description)}</textarea><button class="btn" id="lw-save" type="button">Save territory</button><div class="statusline">Changes are local until you export and publish the GeoJSON.</div></div>`;
 const body=openFloatingEditor(layer,html,clickPoint);
 const status=body.querySelector('#lw-status');
 status.onchange=()=>{body.querySelector('#siegeFields').style.display=(status.value==='attacked'||status.value==='contested')?'grid':'none';};
 const typeSelect=body.querySelector('#lw-type'),iconSelect=body.querySelector('#lw-icon');
 typeSelect.onchange=()=>{if(typeSelect.value==='capital'&&iconSelect.value==='auto')iconSelect.value='factionCapital';};
 body.querySelector('#lw-save').onclick=()=>{
  const get=id=>body.querySelector('#'+id);
  p.title=get('lw-title').value.trim()||'Unnamed territory';p.owner=factionKey(get('lw-owner').value);
  const faction=factionProfiles[groupKey(p.owner)];p.color=safeColor(get('lw-color').value||(faction&&faction.color));p.type=get('lw-type').value;
  if(p.type==='capital'){const other=territoryLayers().find(l=>l!==layer&&meta(l).type==='capital'&&groupKey(meta(l).owner)===groupKey(p.owner));if(other&&!confirm('This faction already has a designated capital ('+meta(other).title+'). Keep both capitals?'))return;}
  p.icon=get('lw-icon').value;if(p.type==='capital'&&p.icon==='auto')p.icon='factionCapital';p.status=status.value;p.defense=clampRating(get('lw-defense').value);p.attacker=get('lw-attacker')?.value.trim()||'';p.attackerRating=clampRating(get('lw-attackrating')?.value);p.description=get('lw-description').value.trim();p.importance=get('lw-importance').value;p.garrison=get('lw-garrison').value.trim();p.fortifications=get('lw-fortifications').value.trim();p.battleNotes=get('lw-battle-notes').value.trim();p.lastUpdated=get('lw-last-updated').value.trim();p.battleType=get('lw-battle-type').value.trim();p.battleStart=get('lw-battle-start').value.trim();p.battleEnd=get('lw-battle-end').value.trim();p.strategicNotes=get('lw-strategic-notes').value.trim();
  p.history=get('lw-history').value.split('\n').map(line=>line.trim()).filter(Boolean).map(line=>{const parts=line.split('|').map(x=>x.trim());return {date:parts[0]||'',title:parts[1]||'Territory update',details:parts.slice(2).join(' | ')};});
  addToOwner(layer);attachClick(layer);attachViewer(layer);updateDetails(layer);renderLegend();refreshWarRoom();closeFloatingEditor();
 };
}
function loadFeature(layer,props,geom){const oldOwner=props.owner||props.category||'Neutral';layer._lw={title:props.title||(geom==='Point'?'Map marker':'Unnamed territory'),owner:factionKey(oldOwner),color:safeColor(props.color||factionColor(oldOwner)),status:STATUSES[props.status]?props.status:((String(oldOwner).toLowerCase()==='neutral')?'neutral':'controlled'),type:TERRITORY_TYPES[props.type]?props.type:(geom==='Point'?(props.icon==='city'?'city':props.icon==='fort'?'fort':'territory'):'territory'),icon:props.icon&&ICONS[props.icon]?props.icon:(props.icon==='city'?'capital':props.icon==='fort'?'fort':'auto'),description:props.description||'',defense:clampRating(props.defense),attacker:props.attacker||'',attackerRating:clampRating(props.attackerRating),importance:props.importance||'',garrison:props.garrison||'',fortifications:props.fortifications||'',battleNotes:props.battleNotes||'',lastUpdated:props.lastUpdated||'',history:Array.isArray(props.history)?props.history:[],battleStart:props.battleStart||'',battleEnd:props.battleEnd||'',battleType:props.battleType||'',strategicNotes:props.strategicNotes||''};addToOwner(layer);attachClick(layer);}


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


// Faction profiles are stored separately in /data/factions.json and exported by admins.
let factionProfiles = {};
let searchTerm='', typeFilter='', statusFilter='';
function factionRecord(name){
 const key=groupKey(name);
 if(!factionProfiles[key]) factionProfiles[key]={name:factionKey(name),color:factionColor(name),emblem:'⚔️',leader:'',capital:'',description:'',lore:''};
 return factionProfiles[key];
}
function territoryLayers(){return allLayers.filter(l=>!(l instanceof L.Marker));}
function matchesFilters(layer){
 const p=meta(layer),q=searchTerm.toLowerCase();
 const text=[p.title,p.owner,p.type,p.status,p.description,p.attacker,p.battleNotes].join(' ').toLowerCase();
 return (!q||text.includes(q))&&(!typeFilter||p.type===typeFilter)&&(!statusFilter||p.status===statusFilter);
}
function refreshWarRoom(){
 const regions=territoryLayers(),count=fn=>regions.filter(fn).length,set=(id,v)=>{const el=document.getElementById(id);if(el)el.textContent=String(v);};
 set('statTerritories',regions.length);set('statCapitals',count(l=>meta(l).type==='capital'));set('statAttacked',count(l=>meta(l).status==='attacked'));set('statContested',count(l=>meta(l).status==='contested'));
 renderFactionCards();renderChronicle();
 const list=document.getElementById('battleList');
 if(list){
   const active=regions.filter(l=>['attacked','contested'].includes(meta(l).status));
   list.innerHTML=active.length?active.map(l=>{const p=meta(l);return `<button class="battle-item" data-battle="${allLayers.indexOf(l)}"><strong>${p.status==='attacked'?'⚔️':'🛡️'} ${esc(p.title)}</strong><span>${esc(p.owner)} · ${esc(STATUSES[p.status])}${p.attacker?' · Attacker: '+esc(p.attacker):''}${p.battleStart?' · Since '+esc(p.battleStart):''}</span></button>`;}).join(''):'<div class="empty-note">No territories are currently marked contested or under attack.</div>';
   list.querySelectorAll('[data-battle]').forEach(b=>b.onclick=()=>focusLayer(allLayers[Number(b.dataset.battle)]));
 }
 const enabled=new Set([...document.querySelectorAll('[data-owner]')].filter(x=>x.checked).map(x=>x.dataset.owner));
 allLayers.forEach(l=>{const p=meta(l),g=getGroup(p.owner);if(matchesFilters(l)&&enabled.has(groupKey(p.owner))){if(!g.hasLayer(l))g.addLayer(l);}else g.removeLayer(l);});
}
function focusLayer(layer){
 if(!layer)return;
 const target=layer.getBounds?layer.getBounds().getCenter():layer.getLatLng();
 map.setView(target,Math.max(0,map.getZoom()));
 if(layer.fire)layer.fire('click');
}
function renderFactionCards(){
 const box=document.getElementById('factionCards');if(!box)return;
 const byOwner={};
 allLayers.forEach(l=>{const p=meta(l),k=groupKey(p.owner);if(!byOwner[k])byOwner[k]={name:p.owner,territories:[],attacked:0,contested:0,capitals:0,strongholds:0};const f=byOwner[k];if(!(l instanceof L.Marker)){f.territories.push(l);if(p.status==='attacked')f.attacked++;if(p.status==='contested')f.contested++;if(p.type==='capital')f.capitals++;if(['fort','city','guildhouse'].includes(p.type))f.strongholds++;}});
 const factions=Object.entries(byOwner).map(([k,v])=>({key:k,...v,profile:factionRecord(v.name)})).sort((a,b)=>b.territories.length-a.territories.length);
 box.innerHTML=factions.length?factions.map(f=>`<button class="faction-card" data-faction="${esc(f.key)}" style="--faction-color:${safeColor(f.profile.color)}"><div class="faction-card-head"><span class="faction-emblem">${esc(f.profile.emblem||'⚔️')}</span><span>${esc(f.profile.name||f.name)}</span></div><div class="faction-card-stats"><span>${f.territories.length} territories</span><span>${f.capitals} capitals</span><span>${f.strongholds} strongholds</span><span>${f.attacked} attacked</span></div>${f.profile.leader?`<div class="faction-description">Leader: ${esc(f.profile.leader)}</div>`:''}${f.profile.description?`<div class="faction-description">${esc(f.profile.description)}</div>`:''}</button>`).join(''):'<div class="empty-note">Faction cards appear when territories have owners.</div>';
 box.querySelectorAll('[data-faction]').forEach(btn=>btn.onclick=()=>{const key=btn.dataset.faction;const cb=document.querySelector(`[data-owner="${CSS.escape(key)}"]`);if(cb){document.querySelectorAll('[data-owner]').forEach(x=>x.checked=false);cb.checked=true;document.getElementById('showAllLayers').checked=false;refreshWarRoom();}});
}
function renderChronicle(){
 const box=document.getElementById('chronicleList');if(!box)return;
 const entries=[];
 allLayers.forEach(l=>{const p=meta(l);(p.history||[]).forEach(h=>entries.push({...h,territory:p.title,owner:p.owner,layer:l}));});
 entries.sort((a,b)=>(b.date||'').localeCompare(a.date||''));
 box.innerHTML=entries.length?entries.slice(0,12).map((e,i)=>`<button class="chronicle-item" data-chronicle="${i}" style="width:100%;text-align:left;color:inherit;cursor:pointer"><strong>${esc(e.title)} — ${esc(e.territory)}</strong><span>${esc(e.date)} · ${esc(e.owner)}</span>${e.details?`<div class="faction-description">${esc(e.details)}</div>`:''}</button>`).join(''):'<div class="empty-note">No chronicle entries recorded. Admins can add events in a territory editor.</div>';
 box.querySelectorAll('[data-chronicle]').forEach((btn,i)=>btn.onclick=()=>focusLayer(entries.sort((a,b)=>(b.date||'').localeCompare(a.date||''))[i].layer));
}
function setupWarRoomFilters(){
 const t=document.getElementById('typeFilter'),s=document.getElementById('statusFilter'),q=document.getElementById('territorySearch');
 if(t)t.innerHTML='<option value="">All territory types</option>'+Object.entries(TERRITORY_TYPES).map(([k,v])=>`<option value="${k}">${esc(v)}</option>`).join('');
 if(s)s.innerHTML='<option value="">All statuses</option>'+Object.entries(STATUSES).map(([k,v])=>`<option value="${k}">${esc(v)}</option>`).join('');
 if(q)q.oninput=()=>{searchTerm=q.value.trim();refreshWarRoom();};
 if(t)t.onchange=()=>{typeFilter=t.value;refreshWarRoom();};
 if(s)s.onchange=()=>{statusFilter=s.value;refreshWarRoom();};
 document.getElementById('clearFiltersBtn')?.addEventListener('click',()=>{searchTerm=typeFilter=statusFilter='';if(q)q.value='';if(t)t.value='';if(s)s.value='';document.querySelectorAll('[data-owner]').forEach(x=>x.checked=true);const a=document.getElementById('showAllLayers');if(a)a.checked=true;refreshWarRoom();});
 document.getElementById('focusCapitalsBtn')?.addEventListener('click',()=>{const caps=territoryLayers().filter(l=>meta(l).type==='capital');if(caps.length)focusLayer(caps[0]);else alert('No faction capitals have been designated yet.');});
}
function loadFactionProfiles(){
 return fetch('/data/factions.json',{cache:'no-store'}).then(r=>r.ok?r.json():{factions:[]}).then(data=>{factionProfiles={};(data.factions||[]).forEach(f=>{if(f&&f.name)factionProfiles[groupKey(f.name)]={name:f.name,color:safeColor(f.color),emblem:f.emblem||'⚔️',leader:f.leader||'',capital:f.capital||'',description:f.description||'',lore:f.lore||''};});}).catch(()=>{factionProfiles={};});
}
function exportFactionProfiles(){
 const data={factions:Object.values(factionProfiles)};
 const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='factions.json';a.click();URL.revokeObjectURL(url);
}
function manageFactions(){
 const existing=Object.values(factionProfiles);
 const modal=document.createElement('div');modal.className='admin-modal';
 const options=existing.map(f=>`<option value="${esc(f.name)}">${esc(f.name)}</option>`).join('');
 modal.innerHTML=`<div class="admin-modal-card"><h2>Faction Management</h2><p class="empty-note">Create faction profiles, set their colors and emblems, and add lore. Export factions.json and publish it with the map.</p><label>Choose existing faction or create new</label><select id="fm-existing"><option value="">— New faction —</option>${options}</select><label>Faction name</label><input id="fm-name" maxlength="80" placeholder="Faction name"><label>Faction color</label><input id="fm-color" type="color" value="#8da7c0"><label>Emblem (emoji)</label><input id="fm-emblem" maxlength="8" value="⚔️"><label>Leader / ruling guild</label><input id="fm-leader" maxlength="100"><label>Capital territory name</label><input id="fm-capital" maxlength="100"><label>Short description</label><textarea id="fm-description" maxlength="500"></textarea><label>Lore / faction background</label><textarea id="fm-lore" maxlength="2000"></textarea><div class="modal-actions"><button class="btn" id="fm-save">Save faction</button><button class="btn" id="fm-export">Export factions.json</button><button class="btn" id="fm-close">Close</button></div></div>`;
 document.body.appendChild(modal);
 const $=id=>modal.querySelector('#'+id);
 $('fm-existing').onchange=()=>{const f=factionProfiles[groupKey($('fm-existing').value)];$('fm-name').value=f?.name||'';$('fm-color').value=f?.color||'#8da7c0';$('fm-emblem').value=f?.emblem||'⚔️';$('fm-leader').value=f?.leader||'';$('fm-capital').value=f?.capital||'';$('fm-description').value=f?.description||'';$('fm-lore').value=f?.lore||'';};
 $('fm-save').onclick=()=>{const name=$('fm-name').value.trim();if(!name)return alert('Enter a faction name.');factionProfiles[groupKey(name)]={name,color:safeColor($('fm-color').value),emblem:$('fm-emblem').value.trim()||'⚔️',leader:$('fm-leader').value.trim(),capital:$('fm-capital').value.trim(),description:$('fm-description').value.trim(),lore:$('fm-lore').value.trim()};renderFactionCards();$('fm-existing').innerHTML='<option value="">— New faction —</option>'+Object.values(factionProfiles).map(f=>`<option value="${esc(f.name)}">${esc(f.name)}</option>`).join('');$('fm-existing').value=name;alert('Faction saved in this editing session. Export factions.json and publish it to make it public.');};
 $('fm-export').onclick=exportFactionProfiles;$('fm-close').onclick=()=>modal.remove();
}

function renderLegend(){const owners={};allLayers.forEach(l=>{const p=meta(l);owners[p.owner.toLowerCase()]={name:p.owner,color:p.color};});const filters=document.getElementById('layerFilters');if(!filters)return;filters.innerHTML='<label class="filter"><input type="checkbox" id="showAllLayers" checked> All territories</label>'+Object.values(owners).sort((a,b)=>a.name.localeCompare(b.name)).map(o=>`<label class="filter"><input type="checkbox" data-owner="${esc(o.name.toLowerCase())}" checked> <span class="swatch" style="color:${o.color};border-color:${o.color};background:${o.color}35"></span>${esc(o.name)}</label>`).join('');const allToggle=document.getElementById('showAllLayers');allToggle.onchange=e=>{document.querySelectorAll('[data-owner]').forEach(i=>{i.checked=e.target.checked;const g=groups[i.dataset.owner];if(g){if(i.checked)map.addLayer(g);else map.removeLayer(g);}});};document.querySelectorAll('[data-owner]').forEach(i=>i.onchange=()=>{const g=groups[i.dataset.owner];if(g){if(i.checked)map.addLayer(g);else map.removeLayer(g);}allToggle.checked=[...document.querySelectorAll('[data-owner]')].every(x=>x.checked);refreshWarRoom();});setupWarRoomFilters();refreshWarRoom();}
document.getElementById('manageFactionsBtn')?.addEventListener('click',manageFactions);document.getElementById('exportFactionsBtn')?.addEventListener('click',exportFactionProfiles);setupWarRoomFilters();loadFactionProfiles().then(()=>fetch(DATA_URL,{cache:'no-store'}).then(r=>{if(!r.ok)throw Error('Could not load territory data');return r.json();}).then(geo=>{if(!geo||!Array.isArray(geo.features))throw Error('Invalid GeoJSON');L.geoJSON(geo,{pointToLayer:(f,ll)=>L.marker(ll),onEachFeature:(f,layer)=>{loadFeature(layer,f.properties||{},f.geometry?.type);allLayers.push(layer);}});renderLegend();setupWarRoomFilters();refreshWarRoom();if(!allLayers.length&&ADMIN)document.getElementById('details').innerHTML='<div class="detail-name">Ready to map</div><div class="detail-copy">Use the drawing tools to add territories or markers.</div>';})).catch(err=>{console.error(err);document.getElementById('details').innerHTML='<div class="detail-name">Map data unavailable</div><div class="detail-copy">Could not load /data/overlays.geojson or faction data. Check the published files.</div>';});
if(ADMIN){const drawControl=new L.Control.Draw({edit:{featureGroup:drawnItems,remove:true},draw:{polygon:{allowIntersection:false,showArea:true},rectangle:true,circle:false,marker:true,polyline:false,circlemarker:false}});map.addControl(drawControl);map.on(L.Draw.Event.CREATED,e=>{const layer=e.layer;snapPolygonVertices(layer);layer._lw={title:layer instanceof L.Marker?'New marker':'New territory',owner:'Neutral',color:'#9aa7b5',status:'neutral',type:layer instanceof L.Marker?'landmark':'territory',icon:layer instanceof L.Marker?'auto':'territory',description:'',defense:0,attacker:'',attackerRating:0};addToOwner(layer);allLayers.push(layer);attachClick(layer);attachEditor(layer);renderLegend();refreshWarRoom();});map.on(L.Draw.Event.EDITED,e=>e.layers.eachLayer(l=>{snapPolygonVertices(l);applyStyle(l);attachClick(l);}));map.on(L.Draw.Event.DELETED,e=>{e.layers.eachLayer(l=>{Object.values(groups).forEach(g=>g.removeLayer(l));allLayers=allLayers.filter(x=>x!==l);});renderLegend();});}
document.getElementById('resetViewBtn')?.addEventListener('click',()=>map.fitBounds(bounds));document.getElementById('exportBtn')?.addEventListener('click',()=>{if(!ADMIN)return alert('Admin only.');const features=[];drawnItems.eachLayer(layer=>{const gj=layer.toGeoJSON(),p=meta(layer);gj.properties={title:p.title,owner:p.owner,color:p.color,category:p.owner.toLowerCase(),status:p.status,type:p.type,icon:p.icon,description:p.description,defense:p.defense,attacker:p.attacker,attackerRating:p.attackerRating,importance:p.importance,garrison:p.garrison,fortifications:p.fortifications,battleNotes:p.battleNotes,lastUpdated:p.lastUpdated,history:p.history,battleStart:p.battleStart,battleEnd:p.battleEnd,battleType:p.battleType,strategicNotes:p.strategicNotes};features.push(gj);});downloadJson({type:'FeatureCollection',features},'overlays.geojson');});document.getElementById('clearBtn')?.addEventListener('click',()=>{if(!ADMIN)return alert('Admin only.');if(!confirm('Remove all territories from this editing session? This does not change the published map until you export and replace overlays.geojson.'))return;Object.values(groups).forEach(g=>g.clearLayers());drawnItems.clearLayers();allLayers=[];renderLegend();refreshWarRoom();document.getElementById('details').innerHTML='<div class="detail-name">Map cleared</div><div class="detail-copy">Current editing session cleared only.</div>';});
function downloadJson(obj,filename){const blob=new Blob([JSON.stringify(obj,null,2)],{type:'application/geo+json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=filename;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);}
