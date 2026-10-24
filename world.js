/* Train Loader — 3D world (three.js r128). Everything here is drawn from code: no external models or textures. */
(function(){
'use strict';
var T=THREE;
function srand(s){return function(){s=(s*1664525+1013904223)>>>0;return s/4294967296}}
function col(c){return new T.Color(c)}

/* ---------- shared materials ---------- */
var MAT={};
function M(key,make){return MAT[key]||(MAT[key]=make())}
function std(c,o){return new T.MeshStandardMaterial(Object.assign({color:c,roughness:.82,metalness:0},o||{}))}
function flat(c,o){return new T.MeshStandardMaterial(Object.assign({color:c,roughness:.9,metalness:0,flatShading:true},o||{}))}
var winMat=std('#2a3550',{emissive:'#ffcf7a',emissiveIntensity:0,roughness:.3});
var lampMat=std('#fff2c4',{emissive:'#ffd98a',emissiveIntensity:.2});
var goldMat=std('#ffc23a',{metalness:.75,roughness:.28,emissive:'#7a4a00',emissiveIntensity:.25});
var headMat=std('#fff6d6',{emissive:'#fff1c0',emissiveIntensity:.4});
var WALL='#efe3c8',DARK='#262a33',STONE='#d6d0c4';

/* ---------- textures from canvas ---------- */
function canvasTex(w,h,draw){var c=document.createElement('canvas');c.width=w;c.height=h;draw(c.getContext('2d'),w,h);var t=new T.CanvasTexture(c);t.anisotropy=4;return t}
var glowTex=canvasTex(64,64,function(x){var g=x.createRadialGradient(32,32,0,32,32,32);g.addColorStop(0,'rgba(255,255,255,1)');g.addColorStop(.25,'rgba(255,255,255,.55)');g.addColorStop(1,'rgba(255,255,255,0)');x.fillStyle=g;x.fillRect(0,0,64,64)});
var smokeTex=canvasTex(64,64,function(x){var g=x.createRadialGradient(32,32,2,32,32,30);g.addColorStop(0,'rgba(255,255,255,.9)');g.addColorStop(.6,'rgba(255,255,255,.35)');g.addColorStop(1,'rgba(255,255,255,0)');x.fillStyle=g;x.fillRect(0,0,64,64)});
function towerTextures(seed){var R=srand(seed),lit=[];var base=canvasTex(128,128,function(x){x.fillStyle='#ffffff';x.fillRect(0,0,128,128);for(var y=8;y<128;y+=16)for(var xx=6;xx<128;xx+=16){x.fillStyle='#55607a';x.fillRect(xx,y,9,10);lit.push([xx,y,R()])}});
  var em=canvasTex(128,128,function(x){x.fillStyle='#000';x.fillRect(0,0,128,128);lit.forEach(function(l){if(l[2]<.55){x.fillStyle=l[2]<.1?'#9fd4ff':'#ffd38a';x.fillRect(l[0],l[1],9,10)}})});
  [base,em].forEach(function(t){t.wrapS=t.wrapT=T.RepeatWrapping});return {map:base,em:em}}
var rippleTex=canvasTex(128,128,function(x){x.fillStyle='#ffffff';x.fillRect(0,0,128,128);var R=srand(7);for(var i=0;i<90;i++){x.fillStyle='rgba(170,215,255,'+(.25+R()*.35)+')';x.fillRect(R()*128,R()*128,10+R()*26,2)}});
rippleTex.wrapS=rippleTex.wrapT=T.RepeatWrapping;
var platTex=canvasTex(64,64,function(x){x.fillStyle='#d9d2c4';x.fillRect(0,0,64,64);x.strokeStyle='rgba(120,110,95,.35)';for(var i=0;i<=64;i+=16){x.beginPath();x.moveTo(i,0);x.lineTo(i,64);x.stroke();x.beginPath();x.moveTo(0,i);x.lineTo(64,i);x.stroke()}});
platTex.wrapS=platTex.wrapT=T.RepeatWrapping;

/* ---------- geometry helpers ---------- */
var G={box:new T.BoxGeometry(1,1,1),cyl:new T.CylinderGeometry(.5,.5,1,14),cyl8:new T.CylinderGeometry(.5,.5,1,8),sph:new T.SphereGeometry(.5,14,10),ico:new T.IcosahedronGeometry(1,1),cone:new T.ConeGeometry(1,1,7),pyr:new T.ConeGeometry(1,1,4)};
G.prism=(function(){var s=new T.Shape();s.moveTo(-.5,0);s.lineTo(.5,0);s.lineTo(0,1);s.lineTo(-.5,0);var g=new T.ExtrudeGeometry(s,{depth:1,bevelEnabled:false});g.translate(0,0,-.5);g.rotateY(Math.PI/2);return g})();
G.wheel=(function(){var g=new T.CylinderGeometry(.5,.5,.16,16);g.rotateX(Math.PI/2);return g})();
G.coin=new T.CylinderGeometry(.28,.28,.07,16);
function mesh(geo,mat,x,y,z,sx,sy,sz,parent,noShadow){var m=new T.Mesh(geo,mat);m.position.set(x||0,y||0,z||0);m.scale.set(sx||1,sy||1,sz||1);if(!noShadow){m.castShadow=true;m.receiveShadow=true}if(parent)parent.add(m);return m}
function glow(parent,x,y,z,s,c){var sp=new T.Sprite(new T.SpriteMaterial({map:glowTex,color:c||'#ffd98a',blending:T.AdditiveBlending,depthWrite:false,transparent:true,opacity:0}));sp.position.set(x,y,z);sp.scale.set(s,s,s);if(parent)parent.add(sp);GLOWS.push(sp);return sp}
var GLOWS=[];

/* ---------- path (rounded rectangle in XZ) ---------- */
function rrPath(x0,z0,x1,z1,r){var pts=[];function line(ax,az,bx,bz){var L=Math.hypot(bx-ax,bz-az),n=Math.max(1,Math.ceil(L/0.5));for(var i=0;i<n;i++)pts.push([ax+(bx-ax)*i/n,az+(bz-az)*i/n])}function arc(cx,cz,a0,a1){var n=Math.ceil(Math.abs(a1-a0)*r/0.5);for(var i=0;i<n;i++){var a=a0+(a1-a0)*i/n;pts.push([cx+Math.cos(a)*r,cz+Math.sin(a)*r])}}
  line(x0+r,z0,x1-r,z0);arc(x1-r,z0+r,-Math.PI/2,0);line(x1,z0+r,x1,z1-r);arc(x1-r,z1-r,0,Math.PI/2);line(x1-r,z1,x0+r,z1);arc(x0+r,z1-r,Math.PI/2,Math.PI);line(x0,z1-r,x0,z0+r);arc(x0+r,z0+r,Math.PI,Math.PI*1.5);
  var d=[0];for(var i=1;i<pts.length;i++)d.push(d[i-1]+Math.hypot(pts[i][0]-pts[i-1][0],pts[i][1]-pts[i-1][1]));var len=d[d.length-1]+Math.hypot(pts[0][0]-pts[pts.length-1][0],pts[0][1]-pts[pts.length-1][1]);
  return {pts:pts,d:d,len:len,x0:x0,z0:z0,x1:x1,z1:z1,r:r}}
function at(L,s){s=((s%L.len)+L.len)%L.len;var lo=0,hi=L.d.length-1;while(lo<hi){var m=(lo+hi+1)>>1;if(L.d[m]<=s)lo=m;else hi=m-1}var p=L.pts[lo],q=L.pts[(lo+1)%L.pts.length],seg=(lo+1<L.d.length?L.d[lo+1]:L.len)-L.d[lo],t=seg>0?(s-L.d[lo])/seg:0,tx=q[0]-p[0],tz=q[1]-p[1],tl=Math.hypot(tx,tz)||1;return {x:p[0]+tx*t,z:p[1]+tz*t,tx:tx/tl,tz:tz/tl}}
function dTop(L,x){return x-(L.x0+L.r)}
function dBot(L,x){var top=L.x1-L.x0-2*L.r,side=L.z1-L.z0-2*L.r,q=Math.PI*L.r/2;return top+q+side+q+((L.x1-L.r)-x)}
// ribbon along a loop with a cross-section profile [[offset,height],...]
function ribbon(L,profile,step,mat){var pos=[],idx=[],n=0,P=profile.length;for(var s=0;s<L.len;s+=step){var p=at(L,s),nx=-p.tz,nz=p.tx;profile.forEach(function(q){pos.push(p.x+nx*q[0],q[1],p.z+nz*q[0])});n++}
  for(var i=0;i<n;i++){var a=i*P,b=((i+1)%n)*P;for(var k=0;k<P-1;k++){idx.push(a+k,b+k,a+k+1,a+k+1,b+k,b+k+1)}}
  var g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(pos,3));g.setIndex(idx);g.computeVertexNormals();var m=new T.Mesh(g,mat);m.receiveShadow=true;m.castShadow=false;return m}

/* ---------- models ---------- */
function stationModel(o){ // o: {col, lv, sign, side}
  var g=new T.Group(),s=o.side,lv=o.lv||1,len=[0,12,16,20][lv],roof=std(o.col,{roughness:.7}),roofD=std(col(o.col).multiplyScalar(.7).getStyle(),{roughness:.7});
  var plat=std('#ffffff',{map:platTex.clone()});plat.map.repeat.set(len/2,1.3);plat.map.needsUpdate=true;
  mesh(G.box,plat,0,.375,s*3.15,len,.75,2.6,g);
  mesh(G.box,M('yel',function(){return std('#f1c232')}),0,.76,s*1.98,len,.03,.2,g,true);
  mesh(G.box,M('platEdge',function(){return std('#b9b1a2')}),0,.2,s*1.86,len,.4,.06,g,true);
  var bw=[0,6,10,12][lv],bh=[0,3.2,3.6,5.6][lv],bz=s*7.1,wall=M('wall',function(){return std(WALL)});
  mesh(G.box,wall,0,bh/2+.75,bz,bw,bh,5,g);
  mesh(G.box,M('plinth',function(){return std('#b8a98a')}),0,1.05,bz,bw+.2,.6,5.2,g);
  [-1,1].forEach(function(e){mesh(G.box,roofD,e*(bw/2-.1),bh/2+.75,bz,.35,bh,5.25,g)});
  mesh(G.box,roofD,0,bh+.75,bz,bw+.3,.3,5.3,g);
  var rh=[0,1.6,1.8,2.2][lv];mesh(G.prism,roof,0,bh+.9,bz,bw+.9,rh,5.9,g);
  // windows + door on both faces
  [1,-1].forEach(function(f){var fz=bz+f*2.52,cnt=Math.max(1,Math.floor((bw-1.5)/1.7));for(var i=0;i<cnt;i++){var wx=-(cnt-1)*.85+i*1.7;if(f===-s&&Math.abs(wx)<.9)continue;var rows=lv===3?2:1;for(var r=0;r<rows;r++){var wy=1.95+r*2.3;mesh(G.box,winMat,wx,wy,fz,.8,1.25,.08,g,true);mesh(G.box,M('frame',function(){return std('#ffffff')}),wx,wy+.72,fz,.95,.14,.1,g,true)}}
    if(f===-s){mesh(G.box,M('door',function(){return std('#5a3b28')}),0,1.75,fz,1.1,2,.1,g,true);mesh(G.box,winMat,0,3.05,fz,1.1,.4,.1,g,true)}});
  // clock tower (terminal)
  if(lv===3){var tw=mesh(G.box,wall,0,bh+3.2,bz,2.6,5,2.6,g);mesh(G.box,roofD,0,bh+5.8,bz,2.9,.3,2.9,g);var py=mesh(G.pyr,roof,0,bh+7.1,bz,2.2,2.4,2.2,g);py.rotation.y=Math.PI/4;
    [1,-1].forEach(function(f){var cf=mesh(G.cyl,M('clock',function(){return std('#fffaf0',{emissive:'#fff2c0',emissiveIntensity:.15})}),0,bh+4.3,bz+f*1.32,1.5,.08,1.5,g,true);cf.rotation.x=Math.PI/2;mesh(G.box,M('hand',function(){return std('#222')}),0,bh+4.55,bz+f*1.38,.08,.55,.04,g,true);mesh(G.box,M('hand',function(){return std('#222')}),.18,bh+4.3,bz+f*1.38,.4,.08,.04,g,true)});
    glow(g,0,bh+4.3,bz-s*1.6,3,'#fff2c0')}
  // canopy
  if(lv>=2){var cm=M('canopy',function(){return std('#3c4b55',{roughness:.6,metalness:.3})});mesh(G.box,cm,0,3.45,s*3.15,len-.6,.18,3.2,g);mesh(G.box,roof,0,3.3,s*1.6,len-.6,.35,.12,g);for(var cx=-len/2+1.4;cx<=len/2-1.3;cx+=3.2){mesh(G.cyl8,cm,cx,2.1,s*3.9,.18,2.7,.18,g)}}
  // lamps, benches, planters
  [-1,1].forEach(function(e){var lx=e*(len/2-.8);mesh(G.cyl8,M('post',function(){return std('#2b2f3a',{metalness:.4,roughness:.5})}),lx,2.05,s*4.0,.14,2.6,.14,g);mesh(G.sph,lampMat,lx,3.45,s*4.0,.42,.42,.42,g,true);glow(g,lx,3.45,s*4.0,3.2)});
  [-1,1].forEach(function(e){var bx=e*len/4;mesh(G.box,M('bench',function(){return std('#7a4b2a')}),bx,1.15,s*3.95,1.6,.12,.5,g);mesh(G.box,M('bench',function(){return std('#7a4b2a')}),bx,1.45,s*4.18,1.6,.5,.1,g);mesh(G.box,M('post',function(){return std('#2b2f3a')}),bx,.95,s*3.95,1.4,.35,.4,g)});
  for(var p=-bw/2+.6;p<bw/2;p+=1.3){mesh(G.box,M('planter',function(){return std('#8a6a4a')}),p,.95,bz-s*2.85,.9,.4,.5,g);mesh(G.ico,M('flower'+(Math.round(p*3)%3),function(){return flat(['#e0503c','#ffcf3a','#ff7aa8'][Math.abs(Math.round(p*3))%3])}),p,1.3,bz-s*2.85,.32,.25,.25,g)}
  // passengers waiting
  var PR=srand((o.col.charCodeAt(1)*97+lv*13)|0),shirts=['#e0503c','#4a7fd8','#f1c232','#4fb06a','#8a6ad8','#ffffff','#e86aa0','#2b2f3a'];for(var k=0;k<3+lv*2;k++){var px=(PR()-.5)*(len-3),pz=s*(2.6+PR()*1.2),pc=std(shirts[(PR()*shirts.length)|0]);mesh(G.cyl8,pc,px,1.2,pz,.38,.9,.38,g);mesh(G.sph,M('skin'+(k%3),function(){return std(['#f1c7a0','#c98d62','#8a5a3a'][k%3])}),px,1.82,pz,.36,.36,.36,g);mesh(G.cyl8,M('legs',function(){return std('#2b3448')}),px,.85,pz,.3,.3,.3,g,true)}
  // sign board
  var signMat=o.sign==='neon'?std(o.col,{emissive:o.col,emissiveIntensity:.9}):std('#1e2633');mesh(G.box,signMat,0,lv>=2?3.85:bh+.1,lv>=2?s*1.6:bz-s*2.6,3.4,.8,.12,g);
  if(o.sign==='neon')glow(g,0,lv>=2?3.85:bh+.1,lv>=2?s*1.4:bz-s*2.8,5,o.col);
  g.userData={labelY:bh+rh+(lv===3?6.5:2.2),labelZ:bz,coin:new T.Vector3(0,2,s*4.5),light:new T.Vector3(0,3.3,s*3.6)};
  return g}
function plotModel(side){var g=new T.Group(),s=side;mesh(G.box,M('dirt',function(){return std('#8a6a48')}),0,.08,s*6,14,.16,9,g);
  var fm=M('fence',function(){return std('#c9a878')});for(var x=-7;x<=7;x+=1.4){mesh(G.box,fm,x,.6,s*1.6,.14,1,.14,g);mesh(G.box,fm,x,.6,s*10.4,.14,1,.14,g)}for(var z=1.6;z<=10.4;z+=1.4){mesh(G.box,fm,-7,.6,s*z,.14,1,.14,g);mesh(G.box,fm,7,.6,s*z,.14,1,.14,g)}
  [[1.6],[10.4]].forEach(function(z){mesh(G.box,fm,0,.85,s*z[0],14,.1,.08,g,true)});
  mesh(G.cyl8,M('post',function(){return std('#2b2f3a')}),0,1.4,s*3,.14,2.4,.14,g);mesh(G.box,M('sale',function(){return std('#ffb547',{emissive:'#ffb547',emissiveIntensity:.15})}),0,2.5,s*3,2.6,1.1,.12,g);
  for(var i=0;i<5;i++)mesh(G.box,M('crate',function(){return std('#a8794a')}),-4+i*1.9,.55,s*(7+(i%2)),.9,.8,.9,g);
  g.userData={labelY:4,labelZ:s*6};return g}
function locoModel(c){var g=new T.Group(),body=std(c,{roughness:.45,metalness:.25}),blk=M('blk',function(){return std('#1d2028',{roughness:.5,metalness:.5})}),gold=M('trim',function(){return std('#e8b84a',{metalness:.8,roughness:.3})});
  mesh(G.box,blk,0,.75,0,4.2,.35,1.35,g);
  var boiler=mesh(G.cyl,body,.45,1.5,0,1.15,2.5,1.15,g);boiler.rotation.z=Math.PI/2;
  [-.4,.45,1.3].forEach(function(x){var b=mesh(G.cyl,gold,x,1.5,0,1.2,.1,1.2,g);b.rotation.z=Math.PI/2});
  var front=mesh(G.cyl,blk,1.75,1.5,0,1.1,.15,1.1,g);front.rotation.z=Math.PI/2;
  mesh(G.cyl,blk,1.25,2.35,0,.36,.8,.36,g);mesh(G.cyl,blk,1.25,2.8,0,.55,.18,.55,g);mesh(G.sph,gold,.35,2.12,0,.55,.45,.55,g);
  mesh(G.box,body,-1.25,1.75,0,1.4,1.55,1.5,g);mesh(G.box,blk,-1.25,2.6,0,1.65,.16,1.7,g);
  [1,-1].forEach(function(f){mesh(G.box,winMat,-1.2,2.05,f*.76,.8,.55,.04,g,true)});
  var cc=mesh(G.pyr,blk,2.05,.65,0,.75,.5,.75,g);cc.rotation.z=-Math.PI/2;cc.rotation.y=Math.PI/4;
  mesh(G.cyl,headMat,1.86,1.95,0,.32,.12,.32,g,true).rotation.z=Math.PI/2;
  var wheels=[];[[-1.25,.5],[.0,.5],[1.1,.32]].forEach(function(w){[1,-1].forEach(function(f){var wm=mesh(G.wheel,M('wheel',function(){return std('#b8322a',{roughness:.5,metalness:.3})}),w[0],w[1]+.08,f*.72,w[1]*2,w[1]*2,1,g);wheels.push([wm,w[1]])})});
  mesh(G.box,gold,-.1,.55,.78,2.6,.06,.05,g,true);mesh(G.box,gold,-.1,.55,-.78,2.6,.06,.05,g,true);
  var hl=glow(g,2.1,1.95,0,3.2,'#fff1c0');g.userData={len:4.4,wheels:wheels,stack:new T.Vector3(1.25,3.0,0),head:hl};return g}
function tenderModel(c){var g=new T.Group(),body=std(c,{roughness:.45,metalness:.25});mesh(G.box,M('blk',function(){return std('#1d2028')}),0,.75,0,2.6,.3,1.3,g);mesh(G.box,body,0,1.4,0,2.5,1,1.4,g);mesh(G.box,M('coal',function(){return flat('#15161a')}),0,1.95,0,2.2,.25,1.2,g);var wheels=[];[-.7,.7].forEach(function(x){[1,-1].forEach(function(f){wheels.push([mesh(G.wheel,M('wheelB',function(){return std('#2b2f3a',{metalness:.5})}),x,.4,f*.7,.64,.64,1,g),.32])})});g.userData={len:2.7,wheels:wheels};return g}
function hopperModel(){var g=new T.Group(),wood=M('hop',function(){return std('#8a5a32',{roughness:.8})}),blk=M('blk',function(){return std('#1d2028')});mesh(G.box,blk,0,.72,0,3.5,.3,1.3,g);
  mesh(G.box,wood,0,1.05,0,3.4,.35,1.45,g);[[0,1.55,.7,3.4,.75,.1],[0,1.55,-.7,3.4,.75,.1],[1.65,1.55,0,.1,.75,1.45],[-1.65,1.55,0,.1,.75,1.45]].forEach(function(p){mesh(G.box,wood,p[0],p[1],p[2],p[3],p[4],p[5],g)});
  for(var i=-1.4;i<=1.4;i+=.7)mesh(G.box,M('band',function(){return std('#3a3f4c',{metalness:.5})}),i,1.55,.76,.08,.8,.04,g,true);
  var pile=new T.Group();g.add(pile);var R=srand(Math.random()*1e6|0);for(var k=0;k<14;k++){var cn=mesh(G.coin,goldMat,(R()-.5)*2.6,1.35+R()*.45,(R()-.5)*.9,1,1,1,pile);cn.rotation.set(R()*.8,R()*3,R()*.8)}mesh(G.sph,goldMat,0,1.5,0,2.9,.7,1.05,pile);
  var wheels=[];[-1.1,1.1].forEach(function(x){[1,-1].forEach(function(f){wheels.push([mesh(G.wheel,M('wheelB',function(){return std('#2b2f3a',{metalness:.5})}),x,.4,f*.7,.64,.64,1,g),.32])})});g.userData={len:3.6,wheels:wheels,pile:pile};return g}

/* ---------- the world ---------- */
window.TLWorld=function(opt){
  var canvas=opt.canvas,labels=opt.labels,wrap=opt.wrap;
  var renderer=new T.WebGLRenderer({canvas:canvas,antialias:true,powerPreference:'high-performance'});
  var LOW=matchMedia('(pointer:coarse)').matches||innerWidth<800;renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,LOW?1.3:1.75));renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.2;renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFSoftShadowMap;
  var scene=new T.Scene(),camera=new T.PerspectiveCamera(36,1,1,2400);
  var controls=new T.OrbitControls(camera,canvas);controls.enableDamping=true;controls.dampingFactor=.07;controls.target.set(0,0,2);controls.minDistance=45;controls.maxDistance=210;controls.minPolarAngle=.35;controls.maxPolarAngle=1.22;controls.enablePan=false;controls.autoRotate=true;controls.autoRotateSpeed=.32;
  var idleT=0;controls.addEventListener('start',function(){controls.autoRotate=false;idleT=0});
  // sky dome
  var skyU={top:{value:col('#1f2a5a')},mid:{value:col('#ff9a6a')},bot:{value:col('#ffd1a8')}};
  var sky=new T.Mesh(new T.SphereGeometry(600,32,16),new T.ShaderMaterial({side:T.BackSide,depthWrite:false,uniforms:skyU,vertexShader:'varying vec3 vP;void main(){vP=normalize(position);gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',fragmentShader:'uniform vec3 top;uniform vec3 mid;uniform vec3 bot;varying vec3 vP;void main(){float h=vP.y;vec3 c=h>0.?mix(mid,top,smoothstep(0.,.55,h)):mix(mid,bot,smoothstep(0.,-.3,h));gl_FragColor=vec4(c,1.);}'}));scene.add(sky);
  var starG=new T.BufferGeometry(),sp=[],R0=srand(3);for(var i=0;i<900;i++){var a=R0()*Math.PI*2,e=R0()*.9+.08,r=560;sp.push(Math.cos(a)*Math.cos(e)*r,Math.sin(e)*r,Math.sin(a)*Math.cos(e)*r)}starG.setAttribute('position',new T.Float32BufferAttribute(sp,3));var stars=new T.Points(starG,new T.PointsMaterial({color:'#ffffff',size:1.6,sizeAttenuation:false,transparent:true,opacity:0,depthWrite:false,fog:false}));scene.add(stars);
  scene.fog=new T.Fog('#ffb58a',260,640);
  var hemi=new T.HemisphereLight('#ffe3c4','#3a4a2a',.55);scene.add(hemi);
  var sun=new T.DirectionalLight('#ffd2a0',1.7);sun.position.set(-70,60,40);sun.castShadow=true;sun.shadow.mapSize.set(LOW?1024:2048,LOW?1024:2048);var sc=sun.shadow.camera;sc.left=-95;sc.right=95;sc.top=75;sc.bottom=-75;sc.near=10;sc.far=260;sun.shadow.bias=-.0006;sun.shadow.normalBias=.4;scene.add(sun);scene.add(sun.target);
  var fill=new T.DirectionalLight('#9fb8ff',.25);fill.position.set(60,30,-50);scene.add(fill);
  var world=new T.Group();scene.add(world);var WATER=[],BLINK=[];

  /* --- board, ground, hills --- */
  var BW=170,BD=124;var gGeo=new T.PlaneGeometry(BW,BD,110,80);gGeo.rotateX(-Math.PI/2);var gp=gGeo.attributes.position,gcol=[],R=srand(11);
  function riverX(z){return 30+Math.sin(z*.07)*3.4}
  function groundY(x,z){if(Math.abs(x)>62||z>50){if(Math.abs(x-riverX(z))<9)return 0;return Math.max(0,(Math.sin(x*.09)+Math.cos(z*.11)+1.2))*Math.min(1,Math.max(Math.abs(x)-62,z-50,0)/10)*2.6}return 0}
  for(var i=0;i<gp.count;i++){var x=gp.getX(i),z=gp.getZ(i),edge=Math.max(Math.abs(x)/(BW/2),Math.abs(z)/(BD/2)),h=groundY(x,z);if(Math.abs(x-riverX(z))<5.2)h=-.6;gp.setY(i,h);
    var n=(Math.sin(x*.21+z*.13)+Math.sin(x*.07-z*.19))*.5+R()*.25,c=col(n>.45?'#6fae4f':n<-.35?'#4f8f3c':'#5f9f47');if(Math.abs(x-riverX(z))<6.2)c=col('#cdb27a');c.offsetHSL(0,0,h*.01);gcol.push(c.r,c.g,c.b)}
  gGeo.setAttribute('color',new T.Float32BufferAttribute(gcol,3));gGeo.computeVertexNormals();var ground=new T.Mesh(gGeo,new T.MeshStandardMaterial({vertexColors:true,roughness:.95}));ground.receiveShadow=true;world.add(ground);
  var side=std('#6b4a30',{roughness:1});mesh(G.box,side,0,-3.1,0,BW,6,BD,world).receiveShadow=false;mesh(G.box,std('#4e3624'),0,-6.4,0,BW+2,.8,BD+2,world);
  // grass rim strip so the board edge reads cleanly
  mesh(G.box,std('#5c9a46'),0,-.12,BD/2,BW,.3,.6,world,true);mesh(G.box,std('#5c9a46'),0,-.12,-BD/2,BW,.3,.6,world,true);
  // river
  (function(){var pos=[],uv=[],idx=[],n=0;for(var z=-BD/2;z<=BD/2;z+=1){var x=riverX(z);pos.push(x-4.8,-.05,z,x+4.8,-.05,z);uv.push(0,z/12,1,z/12);n++}for(var i=0;i<n-1;i++){var a=i*2;idx.push(a,a+2,a+1,a+1,a+2,a+3)}var g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(pos,3));g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));g.setIndex(idx);g.computeVertexNormals();
    var wm=std('#2f86d6',{roughness:.1,metalness:.2,map:rippleTex,transparent:true,opacity:.94,side:T.DoubleSide});var w=new T.Mesh(g,wm);w.receiveShadow=true;world.add(w);WATER.push(wm)})();

  /* --- tracks --- */
  var A=rrPath(-48,-26,48,26,12),B=rrPath(-22,-10,22,12,6);A.name='A';A.col='#ff8a3d';B.name='B';B.col='#3fd6c6';var LOOPS=[A,B];
  var ballastM=std('#9a948a',{roughness:1}),railM=std('#d9dde4',{metalness:.85,roughness:.3}),sleeperM=std('#6a4a32');
  LOOPS.forEach(function(L){world.add(ribbon(L,[[-1.9,.02],[-1.35,.34],[1.35,.34],[1.9,.02]],.5,ballastM));
    [-.72,.72].forEach(function(o){var r=ribbon(L,[[o-.09,.36],[o-.09,.52],[o+.09,.52],[o+.09,.36]],.5,railM);r.castShadow=true;world.add(r)});
    var n=Math.floor(L.len/.85),im=new T.InstancedMesh(G.box,sleeperM,n),m4=new T.Matrix4(),q=new T.Quaternion(),e=new T.Euler(),sc=new T.Vector3(.34,.14,2.3);for(var k=0;k<n;k++){var p=at(L,k*.85);e.set(0,-Math.atan2(p.tz,p.tx),0);q.setFromEuler(e);m4.compose(new T.Vector3(p.x,.38,p.z),q,sc);im.setMatrixAt(k,m4)}im.receiveShadow=true;world.add(im);
    // bridges where the loop crosses the river
    var inR=false,s0=0;for(var s=0;s<=L.len;s+=.5){var p=at(L,s),w=Math.abs(p.x-riverX(p.z))<6.2;if(w&&!inR){inR=true;s0=s}if(!w&&inR){inR=false;var pa=at(L,s0),pb=at(L,s),mx=(pa.x+pb.x)/2,mz=(pa.z+pb.z)/2,ln=Math.hypot(pb.x-pa.x,pb.z-pa.z)+1.5,ang=-Math.atan2(pb.z-pa.z,pb.x-pa.x);var br=new T.Group();br.position.set(mx,0,mz);br.rotation.y=ang;mesh(G.box,std('#7a6a58'),0,.1,0,ln,.5,4.6,br);[1,-1].forEach(function(f){mesh(G.box,std('#5a4a3a'),0,.9,f*2.25,ln,.12,.12,br);for(var x=-ln/2;x<=ln/2;x+=1.2)mesh(G.box,std('#5a4a3a'),x,.55,f*2.25,.12,.8,.12,br)});[-ln/4,ln/4].forEach(function(x){mesh(G.cyl8,std('#8a8478'),x,-1,0,1.3,2.2,1.3,br)});world.add(br)}}
  });
  // signals
  var SIGNALS=[];LOOPS.forEach(function(L){for(var k=0;k<4;k++){var p=at(L,L.len*(k/4+.06)),nx=-p.tz,nz=p.tx,g=new T.Group();g.position.set(p.x+nx*2.8,0,p.z+nz*2.8);mesh(G.cyl8,std('#2b2f3a'),0,1.6,0,.16,3.2,.16,g);mesh(G.box,std('#1a1d24'),0,3.3,0,.5,1.1,.4,g);var red=std('#ff3b3b',{emissive:'#ff3b3b',emissiveIntensity:.8}),grn=std('#4cff7a',{emissive:'#4cff7a',emissiveIntensity:.8});mesh(G.sph,red,0,3.55,.21,.22,.22,.22,g,true);mesh(G.sph,grn,0,3.05,.21,.22,.22,.22,g,true);glow(g,0,3.3,.3,1.4,k%2?'#ff6a6a':'#7dff9a');world.add(g)}});

  /* --- stations --- */
  var NAMES=[['Pumpville','#e0503c',2],['Bonding Curve Jct','#4a7fd8',3],['Degen Central','#e86aa0',2],['Rug Hollow','#4fb06a',1],['Moon Terminal','#8a6ad8',3]];
  var DEFS=[[A,'top',-20,0],[A,'top',8,1],[A,'bot',15,2],[B,'top',-4,3],[A,'bot',-8,4]];
  var PLOTDEFS=[[A,'bot',-29],[B,'bot',4]];
  var STATIONS=[],PLOTS=[],stGroup=new T.Group();world.add(stGroup);var STLIGHTS=[];
  function addStation(d,meta){var L=d[0],top=d[1]==='top',s=top?dTop(L,d[2]):dBot(L,d[2]),p=at(L,s),st=Object.assign({loop:L,s:s,x:p.x,z:p.z,side:top?-1:1,arr:0,fees:0},meta);var g=stationModel({col:st.col,lv:st.lv,sign:st.sign,side:st.side});g.position.set(p.x,0,p.z);g.traverse(function(o){o.userData.st=st});stGroup.add(g);st.g=g;var pl=new T.PointLight('#ffcf8a',0,26,2);pl.position.copy(g.userData.light).add(g.position);world.add(pl);STLIGHTS.push(pl);st.pl=pl;STATIONS.push(st);return st}
  DEFS.forEach(function(d,i){var n=NAMES[d[3]];addStation(d,{id:i,name:n[0],col:n[1],lv:n[2],owner:'sample'})});
  PLOTDEFS.forEach(function(d,i){var L=d[0],s=dBot(L,d[2]),p=at(L,s),g=plotModel(1);g.position.set(p.x,0,p.z);world.add(g);PLOTS.push({plot:i,loop:L,s:s,x:p.x,z:p.z,g:g,def:d})});
  var MINE=null;
  function setMine(my){if(MINE){stGroup.remove(MINE.g);world.remove(MINE.pl);STLIGHTS.splice(STLIGHTS.indexOf(MINE.pl),1);STATIONS.splice(STATIONS.indexOf(MINE),1);MINE=null}PLOTS.forEach(function(p){p.g.visible=true});
    if(my){var p=PLOTS[my.plot]||PLOTS[0];p.g.visible=false;MINE=addStation(p.def,{id:99,name:my.name,col:my.col,lv:my.lv,sign:my.sign,owner:'you',mine:true,arr:my.arr||0,fees:my.fees||0})}
    applyMode();buildLabels()}

  /* --- scenery: occupancy grid --- */
  var OX=BW/2,OZ=BD/2,occ=new Uint8Array(BW*BD);function mark(x0,z0,w,d){for(var z=Math.floor(z0+OZ);z<Math.ceil(z0+d+OZ);z++)for(var x=Math.floor(x0+OX);x<Math.ceil(x0+w+OX);x++)if(x>=0&&z>=0&&x<BW&&z<BD)occ[z*BW+x]=1}function free(x0,z0,w,d){for(var z=Math.floor(z0+OZ);z<Math.ceil(z0+d+OZ);z++)for(var x=Math.floor(x0+OX);x<Math.ceil(x0+w+OX);x++){if(x<2||z<2||x>=BW-2||z>=BD-2)return false;if(occ[z*BW+x])return false}return true}
  LOOPS.forEach(function(L){for(var s=0;s<L.len;s+=1){var p=at(L,s);mark(p.x-3.4,p.z-3.4,6.8,6.8)}});
  for(var z=-OZ;z<OZ;z++){var rx=riverX(z);mark(rx-7.5,z,15,1)}
  // road along the front with traffic
  var RZ=42;mark(-OX,RZ-4,BW,8);
  mesh(G.box,std('#3a3d45',{roughness:.95}),0,.06,RZ,BW-1,.12,5,world).castShadow=false;
  [-1,1].forEach(function(f){mesh(G.box,std('#c9c3b6'),0,.1,RZ+f*3.1,BW-1,.2,1.2,world).castShadow=false});
  var dash=new T.InstancedMesh(G.box,std('#f1e6c0'),Math.floor((BW-4)/4)),dm=new T.Matrix4();for(var k=0;k<dash.count;k++){dm.makeScale(1.6,.02,.16);dm.setPosition(-BW/2+3+k*4,.13,RZ);dash.setMatrixAt(k,dm)}world.add(dash);
  (function(){var rb=new T.Group(),rx=riverX(RZ);rb.position.set(rx,0,RZ);mesh(G.box,std('#8a8478'),0,.0,0,13,.6,7.6,rb);[1,-1].forEach(function(f){mesh(G.box,std('#b9b1a2'),0,.75,f*3.6,13,.5,.3,rb)});mesh(G.cyl8,std('#8a8478'),0,-1,0,1.6,2.4,1.6,rb);world.add(rb)})();
  for(var lx=-OX+8;lx<OX-4;lx+=14){if(Math.abs(lx-riverX(RZ))<7)continue;var lp=new T.Group();lp.position.set(lx,0,RZ+3.4);mesh(G.cyl8,std('#2b2f3a',{metalness:.4}),0,1.8,0,.14,3.6,.14,lp);mesh(G.box,std('#2b2f3a'),0,3.6,-.4,.2,.12,1,lp);mesh(G.sph,lampMat,0,3.5,-.85,.36,.22,.36,lp,true);glow(lp,0,3.4,-.9,3.4);world.add(lp)}
  var CARS=[],carCols=['#e0503c','#4a7fd8','#f1c232','#ffffff','#2b2f3a','#4fb06a','#ff8a3d','#8a6ad8'];for(var k=0;k<12;k++){var dir=k%2?1:-1,cg=new T.Group(),cb=std(carCols[k%carCols.length],{roughness:.35,metalness:.35});mesh(G.box,cb,0,.62,0,2.4,.6,1.15,cg);mesh(G.box,M('glass',function(){return std('#9fc4e8',{roughness:.1,metalness:.4,emissive:'#ffcf7a',emissiveIntensity:0})}),-.15,1.1,0,1.3,.45,1.05,cg);mesh(G.box,cb,-.15,1.36,0,1.25,.06,1.07,cg,true);[[.75,.55],[-.75,.55],[.75,-.55],[-.75,-.55]].forEach(function(w){mesh(G.wheel,M('tyre',function(){return std('#15161a')}),w[0],.3,w[1],.52,.52,1.2,cg,true)});mesh(G.box,headMat,1.21,.68,.38,.04,.14,.22,cg,true);mesh(G.box,headMat,1.21,.68,-.38,.04,.14,.22,cg,true);glow(cg,1.6,.7,0,2.6,'#fff1c0');mesh(G.box,M('tail',function(){return std('#ff3b3b',{emissive:'#ff3b3b',emissiveIntensity:.6})}),-1.21,.7,0,.04,.14,.9,cg,true);
    cg.rotation.y=dir>0?0:Math.PI;cg.position.set(-OX+(k/12)*BW,0,RZ+(dir>0?1.2:-1.2));cg.userData={dir:dir,v:4+Math.random()*3};world.add(cg);CARS.push(cg)}
  STATIONS.forEach(function(st){mark(st.x-11,st.side<0?st.z-12:st.z,22,12)});PLOTS.forEach(function(p){mark(p.x-8,p.z,16,12)});
  // park inside loop B: pond + fountain
  var park=new T.Group();world.add(park);mesh(G.cyl,std('#cfc6b4'),0,.1,1,11,.2,11,park);var pond=mesh(G.cyl,std('#3b8fd8',{roughness:.1,metalness:.2,map:rippleTex,transparent:true,opacity:.95}),0,.22,1,9.6,.06,9.6,park,true);WATER.push(pond.material);
  var rim=new T.Mesh(new T.TorusGeometry(4.9,.32,8,40),std('#d6d0c4'));rim.rotation.x=Math.PI/2;rim.position.set(0,.35,1);rim.castShadow=true;park.add(rim);
  mesh(G.cyl,std(STONE),0,.8,1,1.4,1.1,1.4,park);mesh(G.cyl,std(STONE),0,1.45,1,2.6,.22,2.6,park);mesh(G.cyl,std(STONE),0,1.9,1,.5,.9,.5,park);mesh(G.cyl,std(STONE),0,2.4,1,1.4,.16,1.4,park);
  var sprayG=new T.BufferGeometry(),spP=new Float32Array(240*3),spV=[];for(var i=0;i<240;i++){spV.push({t:Math.random()*1.4,a:Math.random()*6.28,v:.6+Math.random()*.7})}sprayG.setAttribute('position',new T.BufferAttribute(spP,3));var spray=new T.Points(sprayG,new T.PointsMaterial({color:'#d8f0ff',size:.22,transparent:true,opacity:.85,depthWrite:false}));park.add(spray);
  mark(-6.5,-5.5,13,13);
  // fields (left, inside loop A)
  var crops=[],FX0=-44,FX1=-27;for(var z=-14;z<=19;z+=1.6)for(var x=FX0;x<=FX1;x+=1.1)crops.push([x,z,Math.floor((z+14)/6.4)%3]);
  var cropIM=new T.InstancedMesh(G.box,flat('#ffffff'),crops.length),m4=new T.Matrix4(),q=new T.Quaternion(),cc=[col('#d9b442'),col('#9bc24a'),col('#e0903a')];crops.forEach(function(c,i){var h=.5+hashH(c[0],c[1])*.35;m4.compose(new T.Vector3(c[0],h/2,c[1]),q,new T.Vector3(.8,h,.95));cropIM.setMatrixAt(i,m4);cropIM.setColorAt(i,cc[c[2]])});cropIM.castShadow=true;cropIM.receiveShadow=true;world.add(cropIM);mark(FX0-1,-21,FX1-FX0+2,42);
  var barn=new T.Group();barn.position.set(-35.5,0,-18.4);mesh(G.box,std('#b8402e'),0,1.6,0,5,3.2,3.6,barn);mesh(G.prism,std('#eee6d8'),0,3.2,0,5.6,1.6,4.2,barn);mesh(G.box,std('#f3ead8'),0,1.3,1.82,1.6,2.2,.05,barn,true);world.add(barn);
  function hashH(a,b){var h=Math.sin(a*12.9898+b*78.233)*43758.5453;return h-Math.floor(h)}
  // city (back right) — towers with lit windows
  var TOWERS=[];var tt=towerTextures(21);var RC=srand(77);
  for(var tx=-6;tx<78;tx+=7.5+RC()*3){for(var tz=-60;tz<-36;tz+=8+RC()*3){var w=4.5+RC()*2.5,d=4.5+RC()*2.5,h=6+RC()*RC()*24+(tx>20?5:0);if(!free(tx-w/2,tz-d/2,w,d))continue;mark(tx-w/2-1,tz-d/2-1,w+2,d+2);
    var geo=new T.BoxGeometry(w,h,d),uv=geo.attributes.uv;for(var k=0;k<uv.count;k++){uv.setXY(k,uv.getX(k)*Math.max(w,d)/3.2,uv.getY(k)*h/3.2)}
    var shade=['#cfd6e4','#e6d9c6','#b9c4d8','#d9c2b0','#c4ccd6'][RC()*5|0];var mt=std(shade,{map:tt.map,emissiveMap:tt.em,emissive:'#ffd08a',emissiveIntensity:0,roughness:.65});TOWERS.push(mt);
    var tm=mesh(geo,mt,tx,h/2,tz,1,1,1,world);mesh(G.box,std('#59606e'),tx,h+.3,tz,w*.6,.6,d*.6,world);if(h>30){mesh(G.cyl8,std('#9aa3b2',{metalness:.6}),tx,h+3,tz,.15,5,.15,world);var bl=mesh(G.sph,std('#ff3b3b',{emissive:'#ff3b3b',emissiveIntensity:1}),tx,h+5.6,tz,.4,.4,.4,world,true);BLINK.push(bl)}}}
  // houses + trees (instanced)
  var HS=[],TS=[],RS=srand(99);
  for(var k=0;k<260;k++){var x=(RS()-.5)*(BW-10),z=(RS()-.5)*(BD-10),w=3+RS()*1.6,d=3+RS()*1.2;if(free(x-w/2-1,z-d/2-1,w+2,d+2)){HS.push([x,z,w,d,1.8+RS()*.8,RS()*6.28,RS()]);mark(x-w/2-1,z-d/2-1,w+2,d+2)}}
  for(var k=0;k<2600;k++){var x=(RS()-.5)*(BW-6),z=(RS()-.5)*(BD-6),r=.9+RS()*1.1;if(free(x-r,z-r,r*2,r*2)){TS.push([x,z,r,RS(),RS()]);mark(x-r+.4,z-r+.4,r*2-.8,r*2-.8)}}
  
  (function(){var body=new T.InstancedMesh(G.box,std('#ffffff'),HS.length),roof=new T.InstancedMesh(G.prism,flat('#ffffff'),HS.length),wins=new T.InstancedMesh(G.box,winMat,HS.length*2),m=new T.Matrix4(),q=new T.Quaternion(),e=new T.Euler();var walls=['#f1e6d2','#e8dcc6','#f4efe4','#e2d3bd'],roofs=['#c4513d','#b8402e','#5a6fa8','#3f7f6a','#8a5ca8','#d07a3a'];
    HS.forEach(function(h,i){var y=groundY(h[0],h[1]);e.set(0,h[5],0);q.setFromEuler(e);m.compose(new T.Vector3(h[0],y+h[4]/2,h[1]),q,new T.Vector3(h[2],h[4],h[3]));body.setMatrixAt(i,m);body.setColorAt(i,col(walls[i%4]));m.compose(new T.Vector3(h[0],y+h[4],h[1]),q,new T.Vector3(h[2]+.5,1.4,h[3]+.5));roof.setMatrixAt(i,m);roof.setColorAt(i,col(roofs[(h[6]*6)|0]));
      var fx=Math.sin(h[5])*0,fwd=new T.Vector3(0,0,h[3]/2+.03).applyEuler(e),fwd2=new T.Vector3(.7,0,-h[3]/2-.03).applyEuler(e);m.compose(new T.Vector3(h[0]+fwd.x,y+1,h[1]+fwd.z),q,new T.Vector3(.7,.7,.06));wins.setMatrixAt(i*2,m);m.compose(new T.Vector3(h[0]+fwd2.x,y+1,h[1]+fwd2.z),q,new T.Vector3(.7,.7,.06));wins.setMatrixAt(i*2+1,m)});
    [body,roof].forEach(function(o){o.castShadow=o.receiveShadow=true;world.add(o)});world.add(wins);
    var trunk=new T.InstancedMesh(G.cyl8,std('#6a4a30'),TS.length),crown=new T.InstancedMesh(G.ico,flat('#ffffff'),TS.length),pine=new T.InstancedMesh(G.cone,flat('#ffffff'),TS.length),greens=['#3f8a3e','#4f9a44','#2f7438','#5aa54c','#3a7f46'],autumn=['#e8b83a','#e08a3a','#d4c24a','#c8602e'];var pc=0;
    TS.forEach(function(t,i){var y=groundY(t[0],t[1]),r=t[2],isPine=t[3]<.28,aut=t[4]<.16;m.compose(new T.Vector3(t[0],y+r*.7,t[1]),q.set(0,0,0,1),new T.Vector3(.35*r,r*1.4,.35*r));trunk.setMatrixAt(i,m);
      if(isPine){m.compose(new T.Vector3(t[0],y+r*2.2,t[1]),q,new T.Vector3(r*1.1,r*3,r*1.1));pine.setMatrixAt(pc,m);pine.setColorAt(pc,col(greens[i%3+2]));pc++;m.makeScale(0,0,0);crown.setMatrixAt(i,m);crown.setColorAt(i,col('#000'))}
      else{e.set(t[3]*3,t[4]*3,0);q.setFromEuler(e);m.compose(new T.Vector3(t[0],y+r*1.9,t[1]),q,new T.Vector3(r*1.15,r,r*1.15));crown.setMatrixAt(i,m);crown.setColorAt(i,col(aut?autumn[i%4]:greens[i%5]));q.set(0,0,0,1)}});
    pine.count=pc;[trunk,crown,pine].forEach(function(o){o.castShadow=true;o.receiveShadow=true;world.add(o)})})();
  // clouds
  var CLOUDS=[];var cm=flat('#ffffff',{transparent:true,opacity:.95});for(var c=0;c<7;c++){var g=new T.Group(),Rc=srand(c*31+5);for(var k=0;k<6;k++){var s=2+Rc()*2.6;mesh(G.ico,cm,(Rc()-.5)*12,(Rc()-.2)*2.5,(Rc()-.5)*6,s,s*.7,s,g)}g.position.set((Rc()-.5)*240,58+Rc()*14,-30+(Rc()-.5)*120);g.userData.v=1.2+Rc()*1.6;world.add(g);CLOUDS.push(g)}

  /* --- trains --- */
  var TRAINS=[];function makeTrain(L,c,name,wagons,s){var t={loop:L,s:s,v:0,col:c,name:name,state:'run',dw:0,load:60+Math.random()*60,cars:[]};var loco=locoModel(c),ten=tenderModel(c);t.cars.push(loco,ten);for(var i=0;i<wagons;i++)t.cars.push(hopperModel());t.cars.forEach(function(g){world.add(g)});t.len=t.cars.reduce(function(a,g){return a+g.userData.len+.35},0);var pl=new T.PointLight('#ffe7b0',0,22,2);loco.add(pl);pl.position.set(3,2,0);t.pl=pl;TRAINS.push(t);return t}
  makeTrain(A,'#c8342a','Fee Express',3,0);makeTrain(A,'#2f5fbf','Night Haul',2,A.len*.52);makeTrain(B,'#1f9e8f','Park Shuttle',1,B.len*.3);
  function stopsOf(L){return STATIONS.filter(function(s){return s.loop===L}).sort(function(a,b){return a.s-b.s})}
  function stopAt(t,st){return st.s+t.len/2-2}
  function placeTrain(t){var off=0;t.cars.forEach(function(g){var L=g.userData.len,c=t.s-off-L/2,p=at(t.loop,c),pa=at(t.loop,c+L*.4),pb=at(t.loop,c-L*.4);g.position.set(p.x,0,p.z);g.rotation.y=-Math.atan2(pa.z-pb.z,pa.x-pb.x);off+=L+.35;g.userData.wheels.forEach(function(w){w[0].rotation.z-=t.v*DT/w[1]})});
    var fr=Math.max(.15,Math.min(1,t.load/120));t.cars.forEach(function(g){if(g.userData.pile)g.userData.pile.scale.set(1,fr,1)})}
  var DT=0;
  function trainTick(t,dt){var stops=stopsOf(t.loop),L=t.loop;if(t.state==='dwell'){t.dw-=dt;if(t.dw<=0){t.state='run';t.last=t.at}return}
    var next=null,dist=1e9;stops.forEach(function(st){var d=((stopAt(t,st)-t.s)%L.len+L.len)%L.len;if(st===t.last&&d>L.len-3)return;if(d<dist&&d>.05){dist=d;next=st}});t.next=next;t.dist=dist;
    var vmax=9.5,acc=3.2,vt=next?Math.min(vmax,Math.sqrt(2*acc*Math.max(0,dist-.1))+.25):vmax;if(t.v<vt)t.v=Math.min(vt,t.v+acc*dt);else t.v=Math.max(vt,t.v-acc*1.8*dt);t.s+=t.v*dt;
    if(next&&dist-t.v*dt<.15){t.s=stopAt(t,next);t.v=0;t.state='dwell';t.dw=3.2+Math.random()*1.6;t.at=next;drop(t,next)}}
  /* --- smoke + coins --- */
  var SMOKE=[];for(var i=0;i<70;i++){var s=new T.Sprite(new T.SpriteMaterial({map:smokeTex,color:'#f4f1ea',transparent:true,opacity:0,depthWrite:false}));s.visible=false;world.add(s);SMOKE.push({sp:s,t:9})}var smokeI=0;
  function puff(p){var o=SMOKE[smokeI++%SMOKE.length];o.sp.position.copy(p);o.t=0;o.sp.visible=true;o.vx=(Math.random()-.5)*.6;o.vz=(Math.random()-.5)*.6}
  var COINS=[];for(var i=0;i<60;i++){var cm2=mesh(G.coin,goldMat,0,0,0,1.6,1.6,1.6,world,true);cm2.visible=false;COINS.push({m:cm2,t:9})}var coinI=0;
  function drop(t,st){var amt=(0.6+Math.random()*1.4)*st.lv*(t.cars.length-1)/3;st.fees+=amt;st.arr++;t.load=Math.max(0,t.load-amt*6);if(t.load<20)t.load=70+Math.random()*60;
    var src=new T.Vector3();t.cars[2]?t.cars[2].getWorldPosition(src):t.cars[0].getWorldPosition(src);src.y=2.2;var dst=st.g.userData.coin.clone().add(st.g.position);
    for(var i=0;i<10;i++){var c=COINS[coinI++%COINS.length];c.t=-i*.07;c.a=src.clone().add(new T.Vector3((Math.random()-.5)*2,0,(Math.random()-.5)*.8));c.m.position.copy(c.a);c.m.visible=true;c.b=dst.clone().add(new T.Vector3((Math.random()-.5)*3,0,(Math.random()-.5)*1));c.h=3+Math.random()*2.5}
    if(opt.onDrop)opt.onDrop(st,amt)}

  /* --- labels (HTML, projected) --- */
  var LBL=[];function buildLabels(){labels.innerHTML='';LBL=[];STATIONS.forEach(function(st){var d=document.createElement('div');d.className='slab'+(st.mine?' mine':'');d.innerHTML='<i style="background:'+st.col+'"></i>'+st.name;d.addEventListener('click',function(e){e.stopPropagation();if(opt.onStation)opt.onStation(st)});labels.appendChild(d);LBL.push({el:d,p:new T.Vector3(st.x,st.g.userData.labelY,st.z+st.g.userData.labelZ),st:st})});
    PLOTS.forEach(function(p){if(!p.g.visible)return;var d=document.createElement('div');d.className='slab open';d.textContent='＋ open plot';d.addEventListener('click',function(e){e.stopPropagation();if(opt.onPlot)opt.onPlot(p.plot)});labels.appendChild(d);LBL.push({el:d,p:new T.Vector3(p.x,4.5,p.z+6)})})}
  var v3=new T.Vector3();function project(p){v3.copy(p).project(camera);return {x:(v3.x*.5+.5)*VW,y:(-v3.y*.5+.5)*VH,vis:v3.z<1}}
  function floatFee(st,amt){var p=project(new T.Vector3(st.x,st.g.userData.labelY-1,st.z+st.g.userData.labelZ));var f=document.createElement('div');f.className='fee';f.textContent='+'+amt.toFixed(2)+' $LOADER';f.style.left=p.x+'px';f.style.top=p.y+'px';labels.appendChild(f);setTimeout(function(){f.remove()},1700)}

  /* --- picking --- */
  var ray=new T.Raycaster(),mv=new T.Vector2(),down=null;canvas.addEventListener('pointerdown',function(e){down=[e.clientX,e.clientY]});canvas.addEventListener('pointerup',function(e){if(!down||Math.hypot(e.clientX-down[0],e.clientY-down[1])>6)return;var r=canvas.getBoundingClientRect();mv.set((e.clientX-r.left)/r.width*2-1,-(e.clientY-r.top)/r.height*2+1);ray.setFromCamera(mv,camera);var hit=ray.intersectObjects(stGroup.children,true)[0];if(hit&&hit.object.userData.st&&opt.onStation)opt.onStation(hit.object.userData.st);else if(opt.onEmpty)opt.onEmpty()});

  /* --- modes --- */
  var MODE='dusk';var MODES={
    day:{top:'#3f86dc',mid:'#a9d6ff',bot:'#e3f2ff',fog:'#bcdcf5',sun:'#fff0d0',si:1.9,sp:[-60,90,45],hemi:['#cfe6ff','#2f4a24',.36],exp:.98,win:0,lamp:0,glow:0,stars:0,st:0,tr:0,fill:.25,cloud:.95},
    dusk:{top:'#262a66',mid:'#ff8f63',bot:'#ffcf9f',fog:'#e09070',sun:'#ffad72',si:1.9,sp:[-90,34,30],hemi:['#ffc4a0','#33345a',.38],exp:1.3,win:.85,lamp:.9,glow:.55,stars:.15,st:1.1,tr:.8,fill:.3,cloud:.9},
    night:{top:'#050a1f',mid:'#14224a',bot:'#1d2d55',fog:'#0e1a36',sun:'#8fb0ff',si:.35,sp:[50,80,-30],hemi:['#3b4f8a','#0c1220',.32],exp:1.5,win:1.6,lamp:2.2,glow:1,stars:1,st:2.4,tr:2.2,fill:.1,cloud:.35}};
  function applyMode(){var m=MODES[MODE];skyU.top.value.set(m.top);skyU.mid.value.set(m.mid);skyU.bot.value.set(m.bot);scene.fog.color.set(m.fog);sun.color.set(m.sun);sun.intensity=m.si;sun.position.set(m.sp[0],m.sp[1],m.sp[2]);hemi.color.set(m.hemi[0]);hemi.groundColor.set(m.hemi[1]);hemi.intensity=m.hemi[2];fill.intensity=m.fill;renderer.toneMappingExposure=m.exp;
    winMat.emissiveIntensity=m.win;lampMat.emissiveIntensity=.2+m.lamp;headMat.emissiveIntensity=.4+m.lamp;TOWERS.forEach(function(t){t.emissiveIntensity=m.win*.9});GLOWS.forEach(function(g){g.material.opacity=m.glow*.85});stars.material.opacity=m.stars;STLIGHTS.forEach(function(l){l.intensity=m.st});TRAINS.forEach(function(t){t.pl.intensity=m.tr});cm.opacity=m.cloud}
  function setMode(m){MODE=m;applyMode()}

  /* --- size + loop --- */
  var VW=1,VH=1;function resize(){var r=wrap.getBoundingClientRect();VW=r.width;VH=r.height;renderer.setSize(VW,VH,false);canvas.style.width=VW+'px';canvas.style.height=VH+'px';camera.aspect=VW/VH;var k=camera.aspect<1?1.85:Math.max(1,1.55/camera.aspect);camera.fov=VW<700?44:36;camera.updateProjectionMatrix();var dist=(VW<700?122:122)*k;if(!resize.done){camera.position.set(-dist*.22,dist*.62,dist*.78);resize.done=1}controls.maxDistance=Math.max(210,dist*1.4);if(VW>1000)camera.setViewOffset(VW,VH,-VW*.15,-VH*.02,VW,VH);else camera.setViewOffset(VW,VH,0,VH*.2,VW,VH);controls.update()}
  addEventListener('resize',function(){clearTimeout(resize.t);resize.t=setTimeout(resize,120)});
  var running=true,last=performance.now();
  function frame(now){requestAnimationFrame(frame);var dt=Math.min(.05,(now-last)/1000);last=now;DT=dt;
    TRAINS.forEach(function(t){trainTick(t,dt)});
    if(!running)return;
    TRAINS.forEach(function(t){placeTrain(t);if(t.v>1.5&&Math.random()<dt*(4+t.v*.6)){var w=new T.Vector3();t.cars[0].localToWorld(w.copy(t.cars[0].userData.stack));puff(w)}});
    SMOKE.forEach(function(o){if(o.t>3)return;o.t+=dt;var k=o.t/3;o.sp.position.y+=dt*(1.8-k);o.sp.position.x+=o.vx*dt;o.sp.position.z+=o.vz*dt;var s=1+k*4;o.sp.scale.set(s,s,s);o.sp.material.opacity=(1-k)*.55*(MODE==='night'?.5:1);if(o.t>3)o.sp.visible=false});
    COINS.forEach(function(c){if(c.t>1.2||!c.m.visible)return;c.t+=dt;if(c.t<0)return;var k=Math.min(1,c.t/1.1);c.m.position.lerpVectors(c.a,c.b,k);c.m.position.y+=Math.sin(k*Math.PI)*c.h;c.m.rotation.x+=dt*9;c.m.rotation.z+=dt*5;if(k>=1)c.m.visible=false});
    var sa=sprayG.attributes.position.array;spV.forEach(function(p,i){p.t+=dt;if(p.t>1.4)p.t=0;var r=p.t*p.v*1.5;sa[i*3]=Math.cos(p.a)*r;sa[i*3+1]=2.6+p.t*3.2-p.t*p.t*3.6;sa[i*3+2]=1+Math.sin(p.a)*r});sprayG.attributes.position.needsUpdate=true;
    rippleTex.offset.y-=dt*.05;rippleTex.offset.x+=dt*.01;
    CARS.forEach(function(c){c.position.x+=c.userData.dir*c.userData.v*dt;if(c.position.x>OX-2)c.position.x=-OX+2;if(c.position.x<-OX+2)c.position.x=OX-2});
    CLOUDS.forEach(function(c){c.position.x+=c.userData.v*dt;if(c.position.x>130)c.position.x=-130});
    BLINK.forEach(function(b){b.visible=Math.sin(now*.004)>0});
    if(!controls.autoRotate){idleT+=dt;if(idleT>8)controls.autoRotate=true}
    controls.update();renderer.render(scene,camera);
    LBL.forEach(function(l){var p=project(l.p);l.el.style.transform='translate('+p.x.toFixed(1)+'px,'+p.y.toFixed(1)+'px) translate(-50%,-50%)';l.el.style.display=p.vis?'':'none'})}
  resize();applyMode();buildLabels();requestAnimationFrame(frame);
  return {setMode:setMode,setMine:setMine,stations:function(){return STATIONS},trains:function(){return TRAINS},stopsOf:stopsOf,floatFee:floatFee,setRunning:function(v){running=v},controls:controls,renderer:renderer,project:project}
};

/* ---------- small 3D preview for the station builder ---------- */
window.TLPreview=function(canvas){var r=new T.WebGLRenderer({canvas:canvas,antialias:true,alpha:true});r.setPixelRatio(Math.min(window.devicePixelRatio||1,2));r.toneMapping=T.ACESFilmicToneMapping;r.toneMappingExposure=1.25;r.shadowMap.enabled=true;r.shadowMap.type=T.PCFSoftShadowMap;
  var sc=new T.Scene(),cam=new T.PerspectiveCamera(32,2,1,300);sc.add(new T.HemisphereLight('#ffe9d0','#3a4a3a',.7));var sun=new T.DirectionalLight('#ffd6a8',1.6);sun.position.set(-20,30,25);sun.castShadow=true;sun.shadow.mapSize.set(1024,1024);var s=sun.shadow.camera;s.left=-20;s.right=20;s.top=20;s.bottom=-20;sc.add(sun);
  var base=new T.Mesh(new T.CylinderGeometry(17,17,1.2,48),std('#6aa952'));base.position.y=-.6;base.receiveShadow=true;sc.add(base);var edge=new T.Mesh(new T.CylinderGeometry(17.1,17.4,2.4,48),std('#6b4a30'));edge.position.y=-1.9;sc.add(edge);
  mesh(G.box,std('#9a948a'),0,.17,-3,32,.34,3.2,sc);[-.72,.72].forEach(function(o){mesh(G.box,std('#d9dde4',{metalness:.85,roughness:.3}),0,.44,-3+o,32,.16,.18,sc)});
  for(var x=-16;x<=16;x+=.85)mesh(G.box,std('#6a4a32'),x,.38,-3,.34,.14,2.3,sc);
  var grp=null;var t0=performance.now();
  function set(o){if(grp)sc.remove(grp);grp=stationModel({col:o.col,lv:o.lv,sign:o.sign,side:1});grp.position.set(0,0,-3);sc.add(grp);winMat.emissiveIntensity=Math.max(winMat.emissiveIntensity,.0)}
  function size(){var w=canvas.clientWidth||400,h=canvas.clientHeight||200;r.setSize(w,h,false);cam.aspect=w/h;cam.updateProjectionMatrix()}
  addEventListener('resize',size);size();
  var vis=true;if('IntersectionObserver' in window)new IntersectionObserver(function(e){vis=e[0].isIntersecting}).observe(canvas);
  (function loop(now){requestAnimationFrame(loop);if(!vis)return;var a=(now-t0)*.00022+.5;cam.position.set(Math.sin(a)*31,17,Math.cos(a)*31+3);cam.lookAt(0,3,3);r.render(sc,cam)})(performance.now());
  return {set:set}};
})();
