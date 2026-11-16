/* Geography: interactive globe (physical, political, economic maps). Needs three.js r128 + OrbitControls. */
(function(){
"use strict";
var view=document.getElementById("view-karta");
if(!view)return;
var $=function(id){return document.getElementById(id)};
var reduced=window.matchMedia&&matchMedia("(prefers-reduced-motion: reduce)").matches;
var esc=function(s){return String(s==null?"":s).replace(/[&<>"]/g,function(c){return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]})};
function num(v,d){var s=Math.abs(Number(v)).toFixed(d||0).split(".");return (v<0?"−":"")+s[0].replace(/\B(?=(\d{3})+(?!\d))/g," ")+(s[1]?","+s[1]:"")}

var stage=$("glbStage"),gview=$("glbView"),panel=$("glbPanel"),legend=$("glbLegend"),labels=$("glbLabels"),tip=$("glbTip"),statusEl=$("glbStatus");
var started=false;
function setStatus(t){statusEl.textContent=t||"";statusEl.hidden=!t}
function loadScript(src){return new Promise(function(res,rej){var s=document.createElement("script");s.src=src;s.onload=res;s.onerror=function(){rej(new Error(src))};document.head.appendChild(s)})}
function ensure(){
  if(started||view.hidden)return;started=true;setStatus("Глобус жүктелуде…");
  var jobs=[];if(!window.GEO_DATA)jobs.push(loadScript("assets/map-data.js"));if(!window.GEO_PHYS)jobs.push(loadScript("assets/map-physical.js"));
  Promise.all(jobs).then(function(){var f=document.fonts&&document.fonts.load?document.fonts.load('700 30px "Golos Text"',"ҚазақстанӘҒҢӨҰҮІ"):Promise.resolve();return f.catch(function(){})}).then(init).catch(function(e){setStatus("Карта ашылмады: файлдар жүктелмеді. Интернет байланысын тексеріп, бетті жаңартыңыз.");console.error(e)});
}
new MutationObserver(ensure).observe(view,{attributes:true,attributeFilter:["hidden"]});
window.addEventListener("hashchange",function(){setTimeout(ensure,0)});
ensure();

function init(){
  if(!window.THREE||!THREE.OrbitControls){setStatus("3D кітапхана жүктелмеді. Интернет байланысын тексеріңіз.");return}
  var D=window.GEO_DATA,TYPES=window.GEO_TYPES||{},PHYS=window.GEO_PHYS_OBJECTS||[],ECON=window.GEO_ECON_OBJECTS||[],NOTES=window.GEO_ECON_NOTES||{},SHORT=window.GEO_SHORT||{};

  /* ---------- data ---------- */
  function decode(str){
    return str.split("|").map(function(poly){return poly.split(";").map(function(r){
      var a=r.split(","),n=a.length,out=new Float32Array(n),x=0,y=0;
      for(var i=0;i<n;i+=2){x+=+a[i];y+=+a[i+1];out[i]=x/100;out[i+1]=y/100}return out})})}
  var C=D.countries,byK={};
  C.forEach(function(c){
    c.polys=decode(c.g);delete c.g;byK[c.k]=c;
    var b=[999,999,-999,-999];c.polys.forEach(function(p){var r=p[0];for(var i=0;i<r.length;i+=2){if(r[i]<b[0])b[0]=r[i];if(r[i]>b[2])b[2]=r[i];if(r[i+1]<b[1])b[1]=r[i+1];if(r[i+1]>b[3])b[3]=r[i+1]}});c.bb=b});
  var LAKES=D.lakes.map(decode);
  function rankBy(f){var s=C.filter(function(c){return c.sov&&c[f]}).sort(function(a,b){return b[f]-a[f]});s.forEach(function(c,i){c["rk_"+f]=i+1});return s.length}
  var nSov=rankBy("area");rankBy("pop");rankBy("gdp");
  var wg=0,wp=0;C.forEach(function(c){if(c.sov&&c.gdp&&c.pop){wg+=c.gdp*1e9;wp+=c.pop}});var WORLD_PC=wg/wp;
  [PHYS,ECON].forEach(function(list){list.forEach(function(o){o.vec=ll2v(o.p[0],o.p[1])})});

  function inRing(x,y,r){var c=false;for(var i=0,j=r.length-2;i<r.length;j=i,i+=2){var xi=r[i],yi=r[i+1],xj=r[j],yj=r[j+1];if((yi>y)!==(yj>y)&&x<(xj-xi)*(y-yi)/(yj-yi)+xi)c=!c}return c}
  function countryAt(lon,lat){
    for(var k=0;k<C.length;k++){var c=C[k],b=c.bb;if(lon<b[0]||lon>b[2]||lat<b[1]||lat>b[3])continue;
      for(var p=0;p<c.polys.length;p++){var P=c.polys[p];if(inRing(lon,lat,P[0])){var hole=false;for(var h=1;h<P.length;h++)if(inRing(lon,lat,P[h])){hole=true;break}if(!hole)return c}}}
    var best=null,bd=2.2;C.forEach(function(c){if(!c.tiny)return;var dx=(c.lx-lon)*Math.cos(lat*Math.PI/180),dy=c.ly-lat,d=Math.sqrt(dx*dx+dy*dy);if(d<bd){bd=d;best=c}});
    return best}

  /* ---------- geometry helpers ---------- */
  function ll2v(lat,lon){var th=(90-lat)*Math.PI/180,ph=(lon+180)*Math.PI/180;return new THREE.Vector3(-Math.cos(ph)*Math.sin(th),Math.cos(th),Math.sin(ph)*Math.sin(th))}
  function v2ll(v){var n=v.clone().normalize(),lat=Math.asin(Math.max(-1,Math.min(1,n.y)))*180/Math.PI,ph=Math.atan2(n.z,-n.x);if(ph<0)ph+=2*Math.PI;return [lat,ph*180/Math.PI-180]}

  /* ---------- renderer ---------- */
  var canvas=$("glbCanvas"),renderer;
  try{renderer=new THREE.WebGLRenderer({canvas:canvas,antialias:true,alpha:true})}catch(e){setStatus("Бұл браузерде 3D глобус ашылмады (WebGL қолжетімсіз).");return}
  renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,2));renderer.setClearColor(0,0);
  var maxTex=renderer.capabilities.maxTextureSize||4096,small=Math.min(screen.width,screen.height)<700;
  var TW=(maxTex>=4096&&!small)?4096:2048,TH=TW/2,OW=2048,OH=1024;
  var scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(32,1,0.05,100);
  scene.add(new THREE.AmbientLight(0xffffff,0.8));
  var dl=new THREE.DirectionalLight(0xffffff,0.32);dl.position.set(-1.5,1.2,2);camera.add(dl);scene.add(camera);

  var baseCv=document.createElement("canvas");baseCv.width=TW;baseCv.height=TH;var bctx=baseCv.getContext("2d");
  var baseTex=new THREE.CanvasTexture(baseCv);baseTex.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());
  var ovCv=document.createElement("canvas");ovCv.width=OW;ovCv.height=OH;var octx=ovCv.getContext("2d");
  var ovTex=new THREE.CanvasTexture(ovCv);
  var globe=new THREE.Mesh(new THREE.SphereGeometry(1,128,96),new THREE.MeshLambertMaterial({map:baseTex}));scene.add(globe);
  var over=new THREE.Mesh(new THREE.SphereGeometry(1.0015,128,96),new THREE.MeshBasicMaterial({map:ovTex,transparent:true,depthWrite:false}));scene.add(over);
  var atm=new THREE.Mesh(new THREE.SphereGeometry(1.14,64,48),new THREE.ShaderMaterial({
    vertexShader:"varying vec3 vN;void main(){vN=normalize(normalMatrix*normal);gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}",
    fragmentShader:"varying vec3 vN;void main(){float i=pow(max(0.0,0.72-dot(vN,vec3(0.0,0.0,1.0))),2.4);gl_FragColor=vec4(0.42,0.68,1.0,1.0)*i;}",
    side:THREE.BackSide,blending:THREE.AdditiveBlending,transparent:true,depthWrite:false}));scene.add(atm);

  var physImg=new Image(),physReady=false;physImg.onload=function(){physReady=true;if(mode==="phys")drawBase()};physImg.src=window.GEO_PHYS;

  /* ---------- texture drawing ---------- */
  var POL=["#f3d39b","#c5e2a8","#f4b8ac","#b5d0ee","#efe08e","#d4c0ea","#f6c3d8"],KZ_COL="#7fcde0";
  var INC_COL={1:"#f2b77f",2:"#f1dd8e",3:"#a8d38b",4:"#3f9a6e"},NODATA="#d6d9d6";
  function X(lon,w){return (lon+180)/360*w}function Y(lat,h){return (90-lat)/180*h}
  function pathPolys(ctx,polys,w,h){ctx.beginPath();polys.forEach(function(P){P.forEach(function(r){ctx.moveTo(X(r[0],w),Y(r[1],h));for(var i=2;i<r.length;i+=2)ctx.lineTo(X(r[i],w),Y(r[i+1],h));ctx.closePath()})})}
  function fillFor(c){
    if(mode==="eco")return c.inc?INC_COL[c.inc]:NODATA;
    if(c.k==="KAZ")return KZ_COL;if(c.k==="ATA")return "#eef2f5";return POL[((c.mc||1)-1)%POL.length]}
  function graticule(ctx,w,h,col){
    ctx.save();ctx.strokeStyle=col;ctx.lineWidth=Math.max(1,w/4096*1.4);ctx.globalAlpha=0.38;ctx.beginPath();
    for(var lo=-180;lo<=180;lo+=15){ctx.moveTo(X(lo,w),0);ctx.lineTo(X(lo,w),h)}
    for(var la=-75;la<=75;la+=15){ctx.moveTo(0,Y(la,h));ctx.lineTo(w,Y(la,h))}ctx.stroke();
    ctx.globalAlpha=0.7;ctx.lineWidth=Math.max(1.4,w/4096*2.2);ctx.beginPath();ctx.moveTo(0,Y(0,h));ctx.lineTo(w,Y(0,h));ctx.stroke();
    ctx.setLineDash([w/180,w/260]);ctx.globalAlpha=0.55;ctx.lineWidth=Math.max(1,w/4096*1.6);ctx.beginPath();
    [23.44,-23.44,66.56,-66.56].forEach(function(la){ctx.moveTo(0,Y(la,h));ctx.lineTo(w,Y(la,h))});ctx.stroke();ctx.restore()}
  function countryLabels(ctx,w,h){
    var s=w/4096,placed=[];
    var list=C.filter(function(c){var nm=c.k in SHORT?SHORT[c.k]:c.n;return nm&&(c.lr<=4||(c.lr<=5&&c.area>90000))&&c.k!=="ATA"}).sort(function(a,b){return a.lr-b.lr||b.area-a.area});
    ctx.save();ctx.textAlign="center";ctx.textBaseline="middle";ctx.lineJoin="round";
    list.forEach(function(c){
      var nm=c.k in SHORT?SHORT[c.k]:c.n,size=({2:38,3:31,4:25,5:21})[c.lr]||21;size*=s;
      var sx=1/Math.max(0.34,Math.cos(c.ly*Math.PI/180));
      ctx.font="700 "+size+'px "Golos Text",system-ui,sans-serif';
      var tw=ctx.measureText(nm).width*sx,x=X(c.lx,w),y=Y(c.ly,h),r=[x-tw/2-2,y-size*0.6,x+tw/2+2,y+size*0.6];
      for(var i=0;i<placed.length;i++){var q=placed[i];if(r[0]<q[2]&&r[2]>q[0]&&r[1]<q[3]&&r[3]>q[1])return}
      placed.push(r);ctx.save();ctx.translate(x,y);ctx.scale(sx,1);
      ctx.lineWidth=size*0.22;ctx.strokeStyle="rgba(255,255,255,.85)";ctx.strokeText(nm,0,0);ctx.fillStyle="#2a2722";ctx.fillText(nm,0,0);ctx.restore()});
    ctx.restore()}
  function drawBase(){
    var w=TW,h=TH,ctx=bctx,s=w/4096;ctx.clearRect(0,0,w,h);
    if(mode==="phys"){
      if(physReady)ctx.drawImage(physImg,0,0,w,h);else{ctx.fillStyle="#6aa3d6";ctx.fillRect(0,0,w,h)}
      ctx.strokeStyle="rgba(70,38,28,.42)";ctx.lineWidth=1.3*s;ctx.lineJoin="round";
      C.forEach(function(c){if(c.k==="ATA")return;pathPolys(ctx,c.polys,w,h);ctx.stroke()});
      graticule(ctx,w,h,"#ffffff");
    }else{
      ctx.fillStyle=mode==="eco"?"#c7dbe8":"#b8d8ee";ctx.fillRect(0,0,w,h);
      C.forEach(function(c){pathPolys(ctx,c.polys,w,h);ctx.fillStyle=fillFor(c);ctx.fill("evenodd")});
      ctx.fillStyle=mode==="eco"?"#c7dbe8":"#b8d8ee";LAKES.forEach(function(L){pathPolys(ctx,L,w,h);ctx.fill("evenodd")});
      ctx.strokeStyle="rgba(40,36,32,.6)";ctx.lineWidth=1.5*s;ctx.lineJoin="round";
      C.forEach(function(c){pathPolys(ctx,c.polys,w,h);ctx.stroke()});
      C.forEach(function(c){if(!c.tiny)return;ctx.beginPath();ctx.arc(X(c.lx,w),Y(c.ly,h),5.5*s,0,Math.PI*2);ctx.fillStyle=fillFor(c);ctx.fill();ctx.lineWidth=1.6*s;ctx.stroke()});
      graticule(ctx,w,h,"#ffffff");countryLabels(ctx,w,h);
    }
    baseTex.needsUpdate=true;dirty=true}
  function drawOverlay(){
    var ctx=octx,w=OW,h=OH;ctx.clearRect(0,0,w,h);
    if(mode!=="phys"){
      if(hover&&hover!==sel.c){pathPolys(ctx,hover.polys,w,h);ctx.fillStyle="rgba(255,255,255,.28)";ctx.fill("evenodd");ctx.strokeStyle="rgba(20,20,20,.55)";ctx.lineWidth=1.4;ctx.stroke()}
      if(sel.c){pathPolys(ctx,sel.c.polys,w,h);ctx.fillStyle="rgba(255,196,0,.5)";ctx.fill("evenodd");ctx.lineJoin="round";ctx.strokeStyle="#fff";ctx.lineWidth=4;ctx.stroke();ctx.strokeStyle="#c2410c";ctx.lineWidth=2;ctx.stroke();
        if(sel.c.tiny){ctx.beginPath();ctx.arc(X(sel.c.lx,w),Y(sel.c.ly,h),7,0,Math.PI*2);ctx.strokeStyle="#c2410c";ctx.lineWidth=2.5;ctx.stroke()}}
    }
    ovTex.needsUpdate=true;dirty=true}

  /* ---------- camera + controls ---------- */
  var controls=new THREE.OrbitControls(camera,canvas);
  controls.enablePan=false;controls.enableDamping=true;controls.dampingFactor=0.09;controls.minDistance=1.35;controls.maxDistance=7;controls.zoomSpeed=0.8;
  controls.autoRotate=!reduced;controls.autoRotateSpeed=0.35;
  var W=1,H=1,offX=0,dirty=true,tween=null,userMoved=false;
  function panelOverlay(){return window.innerWidth>900}
  function fitDist(){var fv=camera.fov*Math.PI/180,vis=W-(panelOverlay()?panel.offsetWidth+28:0),fh=2*Math.atan(Math.tan(fv/2)*vis/H),half=Math.min(fv,fh)/2*0.86;return Math.min(6,Math.max(1.6,1/Math.sin(half)))}
  function resize(){
    W=Math.max(1,gview.clientWidth);H=Math.max(1,gview.clientHeight);renderer.setSize(W,H,false);camera.aspect=W/H;
    offX=panelOverlay()?(panel.offsetWidth+14)/2:0;
    if(offX)camera.setViewOffset(W,H,offX,0,W,H);else camera.clearViewOffset();camera.updateProjectionMatrix();dirty=true}
  new ResizeObserver(resize).observe(gview);resize();
  var start=ll2v(40,64).multiplyScalar(fitDist());camera.position.copy(start);controls.update();
  controls.addEventListener("start",function(){controls.autoRotate=false;userMoved=true;tween=null});
  function ease(k){return k<.5?4*k*k*k:1-Math.pow(-2*k+2,3)/2}
  function flyTo(lat,lon,dist,dur){
    var d0=camera.position.length(),d1=dist||Math.min(d0,Math.max(1.9,fitDist()*0.8));
    var from=camera.position.clone().normalize(),to=ll2v(lat,lon),q=new THREE.Quaternion().setFromUnitVectors(from,to);
    controls.autoRotate=false;tween={t0:performance.now(),dur:reduced?1:(dur||1100),from:from,q:q,d0:d0,d1:d1}}
  function zoomBy(f){var d=camera.position.length(),d1=Math.max(controls.minDistance,Math.min(controls.maxDistance,d*f));controls.autoRotate=false;tween={t0:performance.now(),dur:reduced?1:380,from:camera.position.clone().normalize(),q:new THREE.Quaternion(),d0:d,d1:d1}}

  /* ---------- markers ---------- */
  var markers=[],labelsDirty=true;
  function buildMarkers(){
    labels.innerHTML="";markers=[];
    var list=mode==="phys"?PHYS:mode==="eco"?ECON:[];
    list.forEach(function(o){var T=TYPES[o.t]||{c:"#555",s:"•",l:""};
      var w=document.createElement("div");w.className="gpin";w.style.setProperty("--c",T.c);w.style.visibility="hidden";
      w.innerHTML='<button type="button" aria-label="'+esc(o.n+" — "+T.l)+'"><span class="gdot" aria-hidden="true">'+T.s+'</span><span class="gtx">'+esc(o.n)+'</span></button>';
      w.firstChild.addEventListener("click",function(e){e.stopPropagation();selectObj(o,true)});
      labels.appendChild(w);markers.push({o:o,el:w,tx:w.querySelector(".gtx"),tw:0,on:false,vis:false,nl:null})});
    labelsDirty=true;dirty=true}
  var v3=new THREE.Vector3(),camDir=new THREE.Vector3();
  function placeMarkers(){
    if(!markers.length)return;var d=camera.position.length();camDir.copy(camera.position).normalize();var lim=1/d+0.03,vis=[];
    var rpx=(H/2)/Math.tan(camera.fov*Math.PI/360)/Math.sqrt(Math.max(0.01,d*d-1)),near=rpx>=430;
    markers.forEach(function(m){var show=m.o.vec.dot(camDir)>lim&&(near||m.o.r<2||m.on);
      if(show!==m.vis){m.el.style.visibility=show?"":"hidden";m.vis=show}
      if(!show)return;v3.copy(m.o.vec).multiplyScalar(1.003).project(camera);
      var x=(v3.x+1)/2*W,y=(1-v3.y)/2*H;m.x=x;m.y=y;m.el.style.transform="translate3d("+x.toFixed(1)+"px,"+y.toFixed(1)+"px,0)";vis.push(m)});
    var placed=vis.map(function(m){return [m.x-10,m.y-10,m.x+10,m.y+10,m]});
    vis.sort(function(a,b){return (b.on-a.on)||(a.o.r-b.o.r)});
    vis.forEach(function(m){if(!m.tw)m.tw=m.tx.offsetWidth||m.o.n.length*7+12;
      var flip=m.x+16+m.tw>W-6&&m.x-16-m.tw>=6,r=flip?[m.x-16-m.tw,m.y-11,m.x-11,m.y+11]:[m.x+11,m.y-11,m.x+16+m.tw,m.y+11],hide=false;
      if(!m.on)for(var i=0;i<placed.length;i++){var q=placed[i];if(q[4]===m)continue;if(r[0]<q[2]&&r[2]>q[0]&&r[1]<q[3]&&r[3]>q[1]){hide=true;break}}
      if(!hide)placed.push(r);if(hide!==m.nl){m.el.classList.toggle("nl",hide);m.nl=hide}
      if(flip!==m.lf){m.el.classList.toggle("lf",flip);m.lf=flip}});
  }

  /* ---------- selection + panel ---------- */
  var mode="phys",sel={c:null,o:null},hover=null;
  var MODE_INFO={
    phys:{t:"Физикалық карта",l:"Жер бедері биіктік белдеулерімен боялған: жасыл — ойпаттар мен жазықтар, сары мен қоңыр — қыраттар мен таулар, көк — мұхит. Белгіні басып, тау, өзен, көл, шөл немесе мұхит туралы ақпарат алыңыз."},
    pol:{t:"Саяси карта",l:"Әлемнің мемлекеттері мен тәуелді аумақтары. Елді басыңыз: астанасы, аумағы, халқы, тілі, ақша бірлігі мен көршілері шығады."},
    eco:{t:"Экономикалық карта",l:"Елдер Дүниежүзілік банктің табыс топтары бойынша боялған. Белгішелер — кен орындары, өнеркәсіп орталықтары, порттар мен каналдар. Елді немесе белгіні басыңыз."}};
  function dlRow(k,v){return v==null||v===""?"":"<div><dt>"+esc(k)+"</dt><dd>"+v+"</dd></div>"}
  function modeSwitchBtns(){return '<div class="g-switch">'+(mode!=="pol"?'<button type="button" class="p-step" data-go="pol">Саяси деректері</button>':"")+(mode!=="eco"?'<button type="button" class="p-step" data-go="eco">Экономикасы</button>':"")+"</div>"}
  function panelDefault(){
    var I=MODE_INFO[mode],h='<p class="eyebrow">Глобус · '+esc(I.t.split(" ")[0])+'</p><h3 class="p-title" tabindex="-1">'+esc(I.t)+'</h3><p class="p-lead">'+esc(I.l)+"</p>";
    h+='<label class="g-search"><span class="sr">Іздеу</span><input type="search" id="glbSearch" list="glbList" placeholder="'+(mode==="phys"?"Нысанды іздеу…":mode==="pol"?"Елді іздеу…":"Ел немесе нысан…")+'" autocomplete="off"></label>';
    if(mode==="pol"){
      var kz=byK.KAZ;h+='<p class="eyebrow">Жылдам таңдау</p><div class="gchips">'+["KAZ"].concat(kz.nb||[]).concat(["USA","JPN","BRA","AUS","EGY","DEU"]).map(function(k){var c=byK[k];return c?'<button type="button" class="gchip" data-k="'+k+'">'+esc(c.n)+"</button>":""}).join("")+"</div>";
    }else{
      var list=mode==="phys"?PHYS:ECON,groups={};list.forEach(function(o,i){(groups[o.t]=groups[o.t]||[]).push(i)});
      Object.keys(groups).forEach(function(t){var T=TYPES[t]||{};h+='<p class="eyebrow g-grp">'+esc(T.l||t)+'</p><ul class="t-index">'+groups[t].map(function(i){var o=list[i];return '<li><button type="button" class="t-row" data-o="'+i+'"><span class="gdot sm" style="--c:'+T.c+'" aria-hidden="true">'+T.s+'</span><span><span class="t-name">'+esc(o.n)+'</span><span class="t-where">'+esc(o.f[0]?o.f[0][1]:"")+"</span></span></button></li>"}).join("")+"</ul>"});
    }
    panel.innerHTML=h;fillList()}
  function fillList(){var dlist=$("glbList");if(!dlist)return;var names=[];
    if(mode!=="phys")C.forEach(function(c){if(c.k!=="ATA"||mode==="pol")names.push(c.n)});
    (mode==="phys"?PHYS:mode==="eco"?ECON:[]).forEach(function(o){names.push(o.n)});
    names.sort(function(a,b){return a.localeCompare(b,"kk")});dlist.innerHTML=names.map(function(n){return '<option value="'+esc(n)+'">'}).join("")}
  function back(){return '<div class="p-nav"><button type="button" class="p-back" data-back>← '+esc(MODE_INFO[mode].t)+"</button></div>"}
  function panelCountry(c){
    var h=back(),dens=c.pop&&c.area?c.pop/c.area:null;
    h+='<p class="eyebrow">'+esc(c.sov?"Мемлекет":"Аумақ")+" · "+esc(c.sub||c.cont||"")+'</p><h3 class="p-title" tabindex="-1">'+esc(c.n)+"</h3>";
    if(c.dep&&byK[c.dep])h+='<p class="p-lead">Тәуелді аумақ: <button type="button" class="link-btn" data-k="'+c.dep+'">'+esc(byK[c.dep].n)+"</button></p>";
    h+='<dl class="p-dl">'+dlRow("Астанасы",esc(c.cap))+dlRow("Дүние бөлігі",esc(c.cont))
      +dlRow("Аумағы",c.area?num(c.area)+" км²"+(c.rk_area?' <span class="g-rk">әлемде '+c.rk_area+"-орын</span>":""):"")
      +dlRow("Халқы",c.pop?num(c.pop/1e6,c.pop<1e6?2:1)+" млн адам ("+esc(c.popY)+")"+(c.rk_pop?' <span class="g-rk">әлемде '+c.rk_pop+"-орын</span>":""):"")
      +dlRow("Халық тығыздығы",dens?num(dens,dens<10?1:0)+" адам/км²":"")
      +dlRow("Тілдері",esc(c.lang))+dlRow("Ақша бірлігі",esc(c.cur))
      +dlRow("Мұхитқа шығуы",c.sov?(c.ll?"Жоқ — мұхитқа тікелей шыға алмайтын ел":"Бар"):"")
      +dlRow("БҰҰ мүшесі",c.sov?(c.un?"Иә":"Жоқ"):"");
    if(c.nb&&c.nb.length)h+="<div><dt>Шекаралас елдер ("+c.nb.length+')</dt><dd class="gchips">'+c.nb.map(function(k){return '<button type="button" class="gchip" data-k="'+k+'">'+esc(byK[k].n)+"</button>"}).join("")+"</dd></div>";
    h+="</dl>";if(c.note)h+='<p class="g-note">'+esc(c.note)+"</p>";
    h+=modeSwitchBtns();panel.innerHTML=h}
  var INC_L={1:"Төмен табысты",2:"Орташадан төмен табысты",3:"Орташадан жоғары табысты",4:"Жоғары табысты"};
  var ECO_L={g7:"Дамыған ел, «Үлкен жетілік» (G7) мүшесі",dev:"Дамыған ел",bric:"Дамушы нарық, БРИКС негізін қалаған ел",mikt:"Дамушы нарық (MIKT тобы)",g20:"Дамушы нарық, G20 мүшесі",devg:"Дамушы ел",ldc:"Ең аз дамыған ел"};
  function panelEcon(c){
    var h=back();h+='<p class="eyebrow">Экономика · '+esc(c.sub||c.cont||"")+'</p><h3 class="p-title" tabindex="-1">'+esc(c.n)+"</h3>";
    h+='<dl class="p-dl">'+dlRow("ЖІӨ",c.gdp?(c.gdp>=1000?num(c.gdp/1000,2)+" трлн $":num(c.gdp,c.gdp<10?2:1)+" млрд $")+" ("+esc(c.gdpY)+")"+(c.rk_gdp?' <span class="g-rk">әлемде '+c.rk_gdp+"-орын</span>":""):"Дерек жоқ")
      +dlRow("Жан басына шаққандағы ЖІӨ",c.pc?num(c.pc)+" $":"")
      +dlRow("Табыс тобы",c.inc?'<span class="g-sw" style="background:'+INC_COL[c.inc]+'"></span>'+INC_L[c.inc]:"")
      +dlRow("Даму деңгейі",c.eco&&c.sov?esc(ECO_L[c.eco]):"")+"</dl>";
    if(c.pc){var mx=Math.max(c.pc,WORLD_PC)*1.15,lim=Math.min(1,c.pc/mx);
      h+='<div class="g-cmp"><div class="g-cmp-h"><span>Жан басына ЖІӨ</span><span>әлемдік орташа ≈ '+num(Math.round(WORLD_PC/100)*100)+' $</span></div><div class="g-track"><i style="width:'+(lim*100).toFixed(1)+'%"></i><b style="left:'+(WORLD_PC/mx*100).toFixed(1)+'%"></b></div></div>'}
    if(NOTES[c.k])h+='<p class="g-note"><b>Шаруашылығы.</b> '+esc(NOTES[c.k])+"</p>";
    h+='<p class="dc-meta">Дереккөз: Дүниежүзілік банк (ЖІӨ — ағымдағы АҚШ долларымен).</p>'+modeSwitchBtns();panel.innerHTML=h}
  function panelObj(o){
    var T=TYPES[o.t]||{},h=back();
    h+='<p class="eyebrow"><span class="gdot sm" style="--c:'+T.c+'" aria-hidden="true">'+T.s+"</span> "+esc(T.l||"")+'</p><h3 class="p-title" tabindex="-1">'+esc(o.n)+"</h3>";
    h+='<dl class="p-dl">'+o.f.map(function(r){return dlRow(r[0],esc(r[1]))}).join("")+dlRow("Координаттары",num(Math.abs(o.p[0]),1)+"° "+(o.p[0]>=0?"с.е.":"о.е.")+", "+num(Math.abs(o.p[1]),1)+"° "+(o.p[1]>=0?"ш.б.":"б.б."))+"</dl>";
    h+='<p class="g-desc">'+esc(o.d)+"</p>";panel.innerHTML=h}
  function focusTitle(){var t=panel.querySelector(".p-title");if(t&&panel.contains(document.activeElement)===false&&window.innerWidth>900)t.focus({preventScroll:true})}
  function selectCountry(c,fly){
    if(!c)return;sel={c:c,o:null};markers.forEach(function(m){if(m.on){m.on=false;m.el.classList.remove("on")}});
    if(mode==="phys"){setMode("pol",true)}
    drawOverlay();if(mode==="eco")panelEcon(c);else panelCountry(c);
    if(fly){var b=c.bb,ext=Math.max((b[2]-b[0])*Math.cos(c.ly*Math.PI/180),b[3]-b[1]);flyTo(c.ly,c.lx,Math.max(1.9,fitDist()*Math.min(1,0.62+ext/220)))}labelsDirty=true;focusTitle()}
  function selectObj(o,fly){
    sel={c:null,o:o};markers.forEach(function(m){var on=m.o===o;if(on!==m.on){m.on=on;m.el.classList.toggle("on",on)}});
    drawOverlay();panelObj(o);if(fly)flyTo(o.p[0],o.p[1],null);labelsDirty=true;focusTitle()}
  function clearSel(){sel={c:null,o:null};markers.forEach(function(m){if(m.on){m.on=false;m.el.classList.remove("on")}});drawOverlay();panelDefault();labelsDirty=true}

  panel.addEventListener("click",function(e){
    var b=e.target.closest("button");if(!b)return;
    if(b.hasAttribute("data-back")){clearSel();return}
    if(b.dataset.k){selectCountry(byK[b.dataset.k],true);return}
    if(b.dataset.o!=null){selectObj((mode==="phys"?PHYS:ECON)[+b.dataset.o],true);return}
    if(b.dataset.go){var c=sel.c;setMode(b.dataset.go);if(c)selectCountry(c,false)}});
  panel.addEventListener("change",function(e){if(e.target.id!=="glbSearch")return;search(e.target.value)});
  panel.addEventListener("keydown",function(e){if(e.target.id==="glbSearch"&&e.key==="Enter"){e.preventDefault();search(e.target.value)}});
  function search(q){q=(q||"").trim().toLowerCase();if(!q)return;
    var objs=mode==="phys"?PHYS:mode==="eco"?ECON:[];
    var o=objs.find(function(x){return x.n.toLowerCase()===q})||null,c=mode!=="phys"?C.find(function(x){return x.n.toLowerCase()===q}):null;
    if(!o&&!c){o=objs.find(function(x){return x.n.toLowerCase().indexOf(q)===0})||null;if(!o&&mode!=="phys")c=C.find(function(x){return x.n.toLowerCase().indexOf(q)===0})||C.find(function(x){return x.n.toLowerCase().indexOf(q)>=0})||null;if(!o&&!c)o=objs.find(function(x){return x.n.toLowerCase().indexOf(q)>=0})||null}
    if(o)selectObj(o,true);else if(c)selectCountry(c,true)}

  /* ---------- legend ---------- */
  function drawLegend(){
    var h="";
    if(mode==="phys"){
      h='<div class="lg-title">Биіктік, м</div><div class="lg-bar g-hyp"></div><div class="lg-ticks"><span style="left:0">0</span><span style="left:22%">200</span><span style="left:40%">1000</span><span style="left:62%">2000</span><span style="left:82%">4000</span><span style="left:100%">6000+</span></div><div class="lg-title" style="margin-top:4px">Мұхит тереңдігі</div><div class="lg-bar g-dep"></div><div class="lg-ticks"><span style="left:0">қайраң</span><span style="left:100%">терең</span></div>';
    }else if(mode==="pol"){
      h='<div class="lg-title">Саяси карта</div><ul class="g-lg"><li><i style="background:'+KZ_COL+'"></i>Қазақстан</li><li><i class="g-multi"></i>Басқа елдер</li><li><i class="g-line"></i>Мемлекеттік шекара</li><li><i class="g-eq"></i>Экватор, тропиктер</li></ul>';
    }else{
      h='<div class="lg-title">Табыс тобы (Дүниежүзілік банк)</div><ul class="g-lg">'+[4,3,2,1].map(function(k){return '<li><i style="background:'+INC_COL[k]+'"></i>'+INC_L[k]+"</li>"}).join("")+'<li><i style="background:'+NODATA+'"></i>Дерек жоқ</li></ul>';
    }
    legend.innerHTML=h}

  function setMode(m,keepSel){
    if(m===mode&&!keepSel)return;mode=m;
    [].forEach.call(document.querySelectorAll("#glbModes button"),function(b){b.setAttribute("aria-pressed",String(b.dataset.mode===m))});
    hover=null;tip.hidden=true;canvas.style.cursor="";
    if(sel.o&&((m==="phys")!==(PHYS.indexOf(sel.o)>=0)||m==="pol"))sel.o=null;
    if(m==="phys")sel.c=null;
    drawBase();buildMarkers();drawOverlay();drawLegend();
    if(!keepSel){if(sel.c)(m==="eco"?panelEcon:panelCountry)(sel.c);else if(sel.o){markers.forEach(function(x){if(x.o===sel.o){x.on=true;x.el.classList.add("on")}});panelObj(sel.o)}else panelDefault()}}
  [].forEach.call(document.querySelectorAll("#glbModes button"),function(b){b.addEventListener("click",function(){setMode(b.dataset.mode)})});
  $("glbHome").addEventListener("click",function(){clearSel();flyTo(40,64,fitDist())});
  $("glbZoomIn").addEventListener("click",function(){zoomBy(0.75)});
  $("glbZoomOut").addEventListener("click",function(){zoomBy(1.33)});

  /* ---------- picking ---------- */
  var ray=new THREE.Raycaster(),ndc=new THREE.Vector2(),down=null;
  function hitLL(ev){var r=canvas.getBoundingClientRect();ndc.set((ev.clientX-r.left)/r.width*2-1,-((ev.clientY-r.top)/r.height)*2+1);ray.setFromCamera(ndc,camera);var hit=ray.intersectObject(globe)[0];return hit?v2ll(hit.point):null}
  canvas.addEventListener("pointerdown",function(e){down={x:e.clientX,y:e.clientY,t:performance.now()}});
  canvas.addEventListener("pointerup",function(e){
    if(!down)return;var moved=Math.hypot(e.clientX-down.x,e.clientY-down.y),dt=performance.now()-down.t;down=null;if(moved>6||dt>700)return;
    var ll=hitLL(e);if(!ll){return}
    if(mode==="phys"){var c0=countryAt(ll[1],ll[0]);if(c0){showTip(e,c0.n);clearTimeout(tipT);tipT=setTimeout(function(){tip.hidden=true},1800)}return}
    var c=countryAt(ll[1],ll[0]);if(c)selectCountry(c,false);else clearSel()});
  var pend=null,tipT=0;
  canvas.addEventListener("pointermove",function(e){if(e.pointerType!=="mouse"||e.buttons)return;pend=e});
  canvas.addEventListener("pointerleave",function(){pend=null;tip.hidden=true;if(hover){hover=null;drawOverlay()}});
  function showTip(e,text){var r=gview.getBoundingClientRect();tip.textContent=text;tip.hidden=false;tip.style.transform="translate("+Math.min(e.clientX-r.left+14,W-tip.offsetWidth-8)+"px,"+(e.clientY-r.top+14)+"px)"}
  function doHover(){var e=pend;pend=null;if(!e)return;var ll=hitLL(e);var c=ll&&mode!=="phys"?countryAt(ll[1],ll[0]):null;
    if(c){showTip(e,c.n);canvas.style.cursor="pointer"}else{tip.hidden=true;canvas.style.cursor=""}
    if(c!==hover){hover=c;drawOverlay()}}

  /* ---------- loop ---------- */
  var visible=true;new IntersectionObserver(function(es){visible=es[0].isIntersecting}).observe(stage);
  var lastPos=new THREE.Vector3();
  function frame(now){
    requestAnimationFrame(frame);
    if(!visible||document.hidden||view.hidden)return;
    if(tween){var k=Math.min(1,(now-tween.t0)/tween.dur),e=ease(k),q=new THREE.Quaternion().slerp(tween.q,e),dir=tween.from.clone().applyQuaternion(q);
      camera.position.copy(dir.multiplyScalar(tween.d0+(tween.d1-tween.d0)*e));if(k>=1)tween=null;dirty=true}
    var d=camera.position.length();controls.rotateSpeed=Math.max(0.06,Math.min(0.8,(d-1)*0.32));
    var ch=controls.update();if(pend)doHover();
    if(ch||dirty||!lastPos.equals(camera.position)){lastPos.copy(camera.position);renderer.render(scene,camera);placeMarkers();dirty=false}
    else if(labelsDirty){placeMarkers()}
    labelsDirty=false}
  drawBase();buildMarkers();drawOverlay();drawLegend();panelDefault();
  setStatus("");labels.classList.add("ready");resize();
  requestAnimationFrame(frame);
  window.geoGlobe={select:function(k){selectCountry(byK[k],true)},mode:setMode};
}
})();
