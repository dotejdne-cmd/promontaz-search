/* ProMontaz – carousel hero karet v6.9.0 (z inline v6.8 v záhlaví Shoptetu).
   Bannery s alt "PMCARD | …" → řada karet 4:5. Kritické CSS (třída pmc-wait) + pojistka jsou inline v záhlaví.
   Zdroj: github.com/dotejdne-cmd/promontaz-search/assets/carousel – verze se nepřepisují, rollback = jiná verze v záhlaví. */
(function(){"use strict";

var P="PMCARD |",built=false,D=document.documentElement,mo=null;
if(window.__pmc)return;window.__pmc=1;
function fail(){if(!built){D.classList.add("pmc-fail");D.classList.remove("pmc-wait")}}
/* styly karet (dřív inline <style id="pm-carousel-v6-8-style">) – vloží se před stavbou, karty tak nikdy nejsou bez stylu */
var st=document.createElement("style");st.id="pm-carousel-style";st.textContent=".pm-card-carousel-v6{position:relative;width:100%;margin:10px auto 22px;overflow:visible;box-sizing:border-box}.pm-card-carousel-v6-track{display:flex;gap:20px;width:100%;padding:2px;overflow-x:auto;overflow-y:hidden;scroll-snap-type:x proximity;scroll-behavior:smooth;scrollbar-width:none;-webkit-overflow-scrolling:touch;box-sizing:border-box}.pm-card-carousel-v6-track::-webkit-scrollbar{display:none}.pm-card-carousel-v6-card{display:block;flex:0 0 calc((100% - 60px)/4);min-width:0;overflow:hidden;scroll-snap-align:start;border-radius:14px;background:#f1f2f3;box-shadow:0 6px 20px rgba(0,0,0,.12);text-decoration:none!important;transition:transform .18s ease,box-shadow .18s ease}.pm-card-carousel-v6-card:hover{transform:translateY(-3px);box-shadow:0 12px 28px rgba(0,0,0,.17)}.pm-card-carousel-v6-card:focus-visible{outline:3px solid #f2800f;outline-offset:3px}.pm-card-carousel-v6-card img{display:block;width:100%!important;max-width:none!important;height:auto!important;aspect-ratio:4/5;object-fit:cover;border:0;border-radius:14px;background:#f1f2f3;user-select:none;-webkit-user-select:none;-webkit-user-drag:none;pointer-events:none}.pm-card-carousel-v6-btn{position:absolute;z-index:5;top:50%;width:48px;height:48px;margin:0;padding:0;transform:translateY(-50%);border:0;border-radius:50%;background:#fff;color:#23282d;box-shadow:0 6px 20px rgba(0,0,0,.2);cursor:pointer;font:29px/48px Arial,sans-serif;text-align:center}.pm-card-carousel-v6-btn:hover{background:#f2800f;color:#fff}.pm-card-carousel-v6-prev{left:-24px}.pm-card-carousel-v6-next{right:-24px}.pm-card-carousel-v6-btn[disabled]{opacity:.3;cursor:default}.pm-carousel-native-hidden{display:none!important}@media(min-width:1280px){.pm-card-carousel-v6[data-count=\"2\"] .pm-card-carousel-v6-btn,.pm-card-carousel-v6[data-count=\"3\"] .pm-card-carousel-v6-btn,.pm-card-carousel-v6[data-count=\"4\"] .pm-card-carousel-v6-btn{display:none}}@media(max-width:1279px){.pm-card-carousel-v6-track{gap:18px}.pm-card-carousel-v6-card{flex-basis:calc((100% - 36px)/3)}}@media(max-width:991px){.pm-card-carousel-v6-track{gap:16px}.pm-card-carousel-v6-card{flex-basis:44%}.pm-card-carousel-v6-prev{left:-12px}.pm-card-carousel-v6-next{right:-12px}}@media(max-width:767px){.pm-card-carousel-v6{margin:6px 0 18px}.pm-card-carousel-v6-track{gap:12px;padding:2px 12px}.pm-card-carousel-v6-card{flex-basis:84%}.pm-card-carousel-v6-card,.pm-card-carousel-v6-card img{border-radius:11px}.pm-card-carousel-v6-btn{display:none}}@media(prefers-reduced-motion:reduce){.pm-card-carousel-v6-track{scroll-behavior:auto}.pm-card-carousel-v6-card{transition:none}}";(document.head||D).appendChild(st);

function url(a){
a=(a||"").toLowerCase();
if(a.includes("hydroizolace"))return"/hydroizolace-a-prisady/1k-polyuretanova-hydroizolace-final-13-kg-kbelik-bila/";
if(a.includes("elektro"))return"/elektromaterial/";
if(a.includes("nacenit"))return"/nacenit-material/";
if(a.includes("registrace"))return"/registrace/";
if(a.includes("spojovac"))return"/spojovaci-material/";
if(a.includes("chemie"))return"/stavebni-chemie/";
if(a.includes("drevo"))return"/drevo/";
if(a.includes("naradi"))return"/naradi/";
return"#"
}

function upd(t,p,n){
var m=Math.max(0,t.scrollWidth-t.clientWidth-2);
p.disabled=t.scrollLeft<=2;
n.disabled=t.scrollLeft>=m
}

function build(){
if(built||D.classList.contains("pmc-fail"))return true;

var nat=document.querySelector(".before-carousel1 .wide-carousel,.homepage-box .wide-carousel,.wide-carousel");
if(!nat)return false;

var seen={},items=[].slice.call(
nat.querySelectorAll(".carousel-inner>.item img")
).filter(function(i){
return((i.getAttribute("alt")||"").trim().indexOf(P)===0)
}).map(function(i){
var l=i.closest("a"),
h=l?l.getAttribute("href"):null,
a=(i.getAttribute("alt")||"").trim();
return{img:i,href:h,alt:a,key:(h||"")+"|"+a}
}).filter(function(x){
if(seen[x.key])return false;
seen[x.key]=1;
return true
}).slice(0,8);

if(items.length<4)return false;

var s=document.createElement("section"),
t=document.createElement("div"),
p=document.createElement("button"),
n=document.createElement("button");

s.className="pm-card-carousel-v6";
s.dataset.count=String(items.length);
s.setAttribute("aria-label","Doporučené nabídky ProMontáž");
t.className="pm-card-carousel-v6-track";

items.forEach(function(it,x){
var c=document.createElement("a"),
im=document.createElement("img"),
src=it.img.getAttribute("data-src")||
it.img.getAttribute("src")||
it.img.currentSrc;

if(!src)return;

c.className="pm-card-carousel-v6-card";
c.href=(it.href&&it.href.charAt(0)!=="#")?it.href:url(it.alt);

im.src=src;

var ss=it.img.getAttribute("data-srcset")||
it.img.getAttribute("srcset");

if(ss){
im.srcset=ss;
im.sizes=it.img.getAttribute("sizes")||
"(max-width:767px) 84vw,(max-width:991px) 44vw,(max-width:1279px) 33vw,25vw"
}

im.alt=it.alt.replace(P,"").trim();
/* 4:5 – bannery 1080x1350 */
im.width=1080;
im.height=1350;
im.decoding="async";
im.draggable=false;

if(x===0){
im.loading="eager";
im.fetchPriority="high"
}else{
im.loading="lazy";
im.fetchPriority="low"
}

c.appendChild(im);
t.appendChild(c)
});

if(!t.children.length)return false;

p.type=n.type="button";
p.className="pm-card-carousel-v6-btn pm-card-carousel-v6-prev";
n.className="pm-card-carousel-v6-btn pm-card-carousel-v6-next";

p.textContent="‹";
n.textContent="›";

p.setAttribute("aria-label","Předchozí");
n.setAttribute("aria-label","Další");

function step(){
var c=t.firstElementChild,
g=parseFloat(getComputedStyle(t).gap)||0;
return c?c.getBoundingClientRect().width+g:t.clientWidth*.8
}

p.onclick=function(){
t.scrollBy({left:-step(),behavior:"smooth"})
};

n.onclick=function(){
t.scrollBy({left:step(),behavior:"smooth"})
};

var raf=0;

t.addEventListener("scroll",function(){
if(raf)return;
raf=requestAnimationFrame(function(){
raf=0;
upd(t,p,n)
})
},{passive:true});

s.appendChild(t);
s.appendChild(p);
s.appendChild(n);

nat.parentNode.insertBefore(s,nat);

/* nativní Shoptet carousel schováme až po vytvoření nového */
nat.classList.add("pm-carousel-native-hidden");

built=true;

D.classList.add("pmc-ready");D.classList.remove("pmc-wait");

upd(t,p,n);

return true
}

function safe(){
try{return build()}catch(e){fail();return true}
}

/* v6.9: postavit hned, jak parser dočte nativní carousel (ne až po DOMContentLoaded) */
function early(){
var nat=document.querySelector(".wide-carousel"),
inn=nat&&nat.querySelector(".carousel-inner");
if(inn&&inn.nextElementSibling&&safe()&&mo){mo.disconnect();mo=null}
}

function start(){
if(mo){mo.disconnect();mo=null}
if(safe())return;

[80,180,350,700,1200,2000,3000].forEach(function(d){
setTimeout(function(){
if(!built)safe()
},d)
});

}

if(document.readyState==="loading"){
early();if(!built&&window.MutationObserver){mo=new MutationObserver(early);mo.observe(D,{childList:true,subtree:true})}
document.addEventListener("DOMContentLoaded",start,{once:true})
}else{
start()
}

})();
