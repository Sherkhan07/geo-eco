/* Geography: test section. Data: assets/test-data.js (window.GEO_TESTS). */
(function(){
"use strict";
var root=document.getElementById("quiz"),T=window.GEO_TESTS;
if(!root)return;
if(!T){root.innerHTML='<p class="empty-note">Тест сұрақтары жүктелмеді.</p>';return}
var L=["A","B","C","D","E"],KEY="geography-test-v1";
var esc=function(s){return String(s==null?"":s).replace(/[&<>"]/g,function(c){return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]})};
var store={};try{store=JSON.parse(localStorage.getItem(KEY)||"{}")||{}}catch(e){store={}}
function save(){try{localStorage.setItem(KEY,JSON.stringify(store))}catch(e){}}
var pick={grade:store.grade||"9",mode:store.mode||"practice",shuffle:!!store.shuffle};
var S=null; // session
var light=document.getElementById("qzLight"),lightImg=document.getElementById("qzLightImg");

function pct(a,b){return b?Math.round(a/b*100):0}
function shuffle(a){for(var i=a.length-1;i>0;i--){var j=Math.floor(Math.random()*(i+1)),t=a[i];a[i]=a[j];a[j]=t}return a}

/* ---------- start ---------- */
function renderStart(){
  S=null;
  var h='<div class="qz-start"><div class="qz-grades" role="radiogroup" aria-label="Сынып">';
  Object.keys(T).forEach(function(g){var t=T[g],r=store[g]&&store[g].last,best=store[g]&&store[g].best;
    h+='<button type="button" class="qz-grade" role="radio" aria-checked="'+(pick.grade===g)+'" data-g="'+g+'"><span class="qz-gnum">'+esc(g)+'</span><span class="qz-gtx"><b>'+esc(t.title)+'</b><span>'+t.items.length+" сұрақ</span>"+(r?'<em>Соңғы нәтиже: '+r.score+" / "+r.total+" ("+pct(r.score,r.total)+" %)"+(best!=null&&best>r.score?" · үздігі: "+best:"")+"</em>":"<em>Әлі тапсырылған жоқ</em>")+"</span></button>"});
  h+='</div><div class="qz-opts-row"><div><p class="eyebrow">Режим</p><div class="seg qz-seg" role="group" aria-label="Тест режимі">'
    +'<button type="button" data-m="practice" aria-pressed="'+(pick.mode==="practice")+'">Жаттығу</button><button type="button" data-m="exam" aria-pressed="'+(pick.mode==="exam")+'">Бақылау</button></div>'
    +'<p class="qz-hint">'+(pick.mode==="practice"?"Әр жауап бірден тексеріліп, түсініктемесі шығады.":"Жауаптар тест соңында ғана көрсетіледі.")+"</p></div>"
    +'<label class="qz-check"><input type="checkbox" id="qzShuffle"'+(pick.shuffle?" checked":"")+'> Сұрақтар ретін араластыру</label></div>'
    +'<div class="qz-go"><button type="button" class="btn btn-primary" id="qzStart">Тестті бастау →</button></div></div>';
  root.innerHTML=h;
  root.querySelectorAll(".qz-grade").forEach(function(b){b.addEventListener("click",function(){pick.grade=b.dataset.g;store.grade=pick.grade;save();renderStart()})});
  root.querySelectorAll(".qz-seg button").forEach(function(b){b.addEventListener("click",function(){pick.mode=b.dataset.m;store.mode=pick.mode;save();renderStart()})});
  document.getElementById("qzShuffle").addEventListener("change",function(e){pick.shuffle=e.target.checked;store.shuffle=pick.shuffle;save()});
  document.getElementById("qzStart").addEventListener("click",function(){start(pick.grade,null)});
}

function start(g,subset){
  var items=T[g].items,order=subset?subset.slice():items.map(function(_,i){return i});
  if(pick.shuffle)shuffle(order);
  S={g:g,mode:pick.mode,order:order,ans:{},cur:0,done:false,retry:!!subset,confirm:false};
  renderQ();root.scrollIntoView({block:"start"});
}

/* ---------- question ---------- */
function stateOf(pos){var i=S.order[pos],a=S.ans[i];if(a==null)return "";if(S.mode==="practice"||S.done)return a===T[S.g].items[i].a?"ok":"bad";return "done"}
function renderQ(){
  var items=T[S.g].items,n=S.order.length,i=S.order[S.cur],it=items[i],a=S.ans[i],reveal=a!=null&&(S.mode==="practice"||S.done);
  var answered=Object.keys(S.ans).length;
  var h='<div class="qz-card"><div class="qz-top"><span class="qz-count">Сұрақ <b>'+(S.cur+1)+"</b> / "+n+'</span><span class="qz-meta">'+esc(T[S.g].title)+" · "+(S.mode==="practice"?"Жаттығу":"Бақылау")+(S.retry?" · қателер":"")+(S.done?" · талдау":"")+'</span><button type="button" class="p-back" id="qzQuit">'+(S.done?"← Нәтижеге":"Тоқтату")+"</button></div>";
  h+='<div class="qz-bar" aria-hidden="true"><i style="width:'+(S.done?100:pct(answered,n))+'%"></i></div>';
  h+='<nav class="qz-dots" aria-label="Сұрақтар">'+S.order.map(function(_,p){var st=stateOf(p);return '<button type="button" data-p="'+p+'" class="'+st+(p===S.cur?" cur":"")+'" aria-label="'+(p+1)+"-сұрақ"+(st==="ok"?", дұрыс":st==="bad"?", қате":st==="done"?", жауап берілген":"")+'"'+(p===S.cur?' aria-current="step"':"")+">"+(p+1)+"</button>"}).join("")+"</nav>";
  if(it.c)h+='<p class="qz-ctx">'+esc(it.c)+"</p>";
  if(it.img)h+='<figure class="qz-fig"><button type="button" class="qz-zoom" data-src="'+esc(it.img)+'" aria-label="Суретті үлкейту"><img src="'+esc(it.img)+'" alt="'+(S.cur+1)+'-сұраққа арналған сурет" loading="lazy"></button><figcaption>Суретті үлкейту үшін басыңыз</figcaption></figure>';
  h+='<h3 class="qz-q" tabindex="-1">'+esc(it.q)+"</h3>";
  h+='<div class="qz-list" role="radiogroup" aria-label="Жауап нұсқалары">'+it.o.map(function(t,k){
    var cls="qz-opt";if(a===k)cls+=" sel";if(reveal){if(k===it.a)cls+=" right";else if(a===k)cls+=" wrong"}
    return '<button type="button" role="radio" aria-checked="'+(a===k)+'" class="'+cls+'" data-k="'+k+'"'+(reveal?" disabled":"")+'><b>'+L[k]+"</b><span>"+esc(t)+'</span><i aria-hidden="true"></i></button>'}).join("")+"</div>";
  h+='<div class="qz-fb" aria-live="polite">';
  if(reveal){var ok=a===it.a;h+='<p class="qz-verdict '+(ok?"ok":"bad")+'">'+(ok?"Дұрыс!":"Қате. Дұрыс жауабы: "+L[it.a]+") "+esc(it.o[it.a]))+"</p>"+(it.ex?'<p class="qz-ex"><b>Түсініктеме.</b> '+esc(it.ex)+"</p>":"")}
  h+="</div>";
  var last=S.cur===n-1;
  h+='<div class="qz-nav"><button type="button" class="btn btn-ghost" id="qzPrev"'+(S.cur===0?" disabled":"")+'>← Алдыңғы</button>';
  if(S.done)h+=last?'<button type="button" class="btn btn-primary" id="qzRes">Нәтижеге оралу</button>':'<button type="button" class="btn btn-primary" id="qzNext">Келесі →</button>';
  else{var left=n-answered;
    h+=(!last?'<button type="button" class="btn btn-primary" id="qzNext">Келесі →</button>':"")
      +'<button type="button" class="btn '+(last?"btn-primary":"btn-ghost")+'" id="qzFinish">'+(S.confirm?"Растау: "+left+" сұрақ жауапсыз":"Тестті аяқтау")+"</button>"}
  h+="</div></div>";
  root.innerHTML=h;
  root.querySelectorAll(".qz-opt").forEach(function(b){b.addEventListener("click",function(){choose(+b.dataset.k)})});
  root.querySelectorAll(".qz-dots button").forEach(function(b){b.addEventListener("click",function(){go(+b.dataset.p)})});
  var z=root.querySelector(".qz-zoom");if(z)z.addEventListener("click",function(){openLight(z.dataset.src)});
  bind("qzPrev",function(){go(S.cur-1)});bind("qzNext",function(){go(S.cur+1)});bind("qzRes",renderResult);
  bind("qzFinish",finish);bind("qzQuit",function(){if(S.done)renderResult();else renderStart()});
}
function bind(id,fn){var el=document.getElementById(id);if(el)el.addEventListener("click",fn)}
function focusQ(){var q=root.querySelector(".qz-q");if(q)q.focus({preventScroll:true})}
function go(p){if(p<0||p>=S.order.length)return;S.cur=p;S.confirm=false;renderQ();focusQ();var c=root.querySelector(".qz-card");if(c&&c.getBoundingClientRect().top<0)c.scrollIntoView({block:"start"})}
function choose(k){
  var i=S.order[S.cur];if(S.done)return;if(S.mode==="practice"&&S.ans[i]!=null)return;
  S.ans[i]=k;S.confirm=false;renderQ();
  var o=S.mode==="practice"?(document.getElementById("qzNext")||document.getElementById("qzFinish")):root.querySelector('.qz-opt[data-k="'+k+'"]');
  if(o)o.focus({preventScroll:true});
}
function finish(){
  var left=S.order.length-Object.keys(S.ans).length;
  if(left>0&&!S.confirm){S.confirm=true;renderQ();var f=document.getElementById("qzFinish");if(f)f.focus();return}
  S.done=true;S.confirm=false;
  var sc=score();
  if(!S.retry){var r=store[S.g]||{};r.last={score:sc,total:S.order.length,date:new Date().toISOString().slice(0,10)};r.best=Math.max(r.best||0,sc);store[S.g]=r;save()}
  renderResult();
}
function score(){var items=T[S.g].items,s=0;S.order.forEach(function(i){if(S.ans[i]===items[i].a)s++});return s}

/* ---------- result ---------- */
function renderResult(){
  var items=T[S.g].items,n=S.order.length,sc=score(),p=pct(sc,n);
  var msg=p>=85?"Өте жақсы нәтиже!":p>=65?"Жақсы нәтиже. Қателерді қарап шығыңыз.":p>=40?"Қайталайтын тақырыптар бар.":"Тақырыптарды қайталап, тестті қайта тапсырыңыз.";
  var wrong=S.order.filter(function(i){return S.ans[i]!==items[i].a});
  var h='<div class="qz-card qz-result"><div class="qz-score"><div class="qz-ring" style="--p:'+p+'"><b>'+p+'%</b></div><div><p class="eyebrow">'+esc(T[S.g].title)+(S.retry?" · қателерді қайта өту":"")+'</p><h3 class="qz-big">'+sc+" / "+n+" дұрыс</h3><p>"+esc(msg)+"</p></div></div>";
  h+='<div class="qz-nav">'+(wrong.length?'<button type="button" class="btn btn-primary" id="qzRetry">Қателерді қайта өту ('+wrong.length+")</button>":"")+'<button type="button" class="btn btn-ghost" id="qzAgain">Қайта бастау</button><button type="button" class="btn btn-ghost" id="qzHome">Басқа сынып</button></div>';
  h+='<h4 class="qz-rh">Жауаптарды талдау</h4><ol class="qz-review">';
  S.order.forEach(function(i,pos){var it=items[i],a=S.ans[i],ok=a===it.a;
    h+='<li class="'+(ok?"ok":"bad")+'"><button type="button" data-p="'+pos+'"><span class="qz-rn">'+(pos+1)+'</span><span class="qz-rt"><b>'+esc(it.q)+"</b><span>"+(a==null?"Жауап берілмеген":"Сіздің жауабыңыз: "+L[a]+") "+esc(it.o[a]))+(ok?"":" · Дұрыс жауабы: "+L[it.a]+") "+esc(it.o[it.a]))+'</span></span><span class="qz-rs" aria-label="'+(ok?"дұрыс":"қате")+'">'+(ok?"✓":"✗")+"</span></button></li>"});
  h+="</ol></div>";
  root.innerHTML=h;
  bind("qzRetry",function(){start(S.g,wrong)});bind("qzAgain",function(){start(S.g,null)});bind("qzHome",renderStart);
  root.querySelectorAll(".qz-review button").forEach(function(b){b.addEventListener("click",function(){S.cur=+b.dataset.p;renderQ();focusQ();root.scrollIntoView({block:"start"})})});
  var big=root.querySelector(".qz-big");if(big){big.tabIndex=-1;big.focus({preventScroll:true})}
  var card=root.querySelector(".qz-card");if(card&&card.getBoundingClientRect().top<0)card.scrollIntoView({block:"start"});
}

/* ---------- lightbox + keys ---------- */
function openLight(src){if(!light||!light.showModal){window.open(src,"_blank");return}lightImg.src=src;light.showModal()}
if(light){light.addEventListener("click",function(e){if(e.target===light||e.target.closest("[data-close]"))light.close()})}
document.addEventListener("keydown",function(e){
  if(!S||root.closest(".view").hidden||(light&&light.open))return;
  var t=e.target;if(t&&(t.tagName==="INPUT"||t.tagName==="TEXTAREA"||t.isContentEditable))return;
  if(e.metaKey||e.ctrlKey||e.altKey||!root.querySelector(".qz-q"))return;
  var k=e.key.toLowerCase(),idx="12345".indexOf(k);if(idx<0)idx="abcde".indexOf(k);
  var it=T[S.g].items[S.order[S.cur]];
  if(idx>=0&&idx<it.o.length){e.preventDefault();choose(idx)}
  else if(e.key==="ArrowRight"){e.preventDefault();go(S.cur+1)}
  else if(e.key==="ArrowLeft"){e.preventDefault();go(S.cur-1)}
});
renderStart();
})();
