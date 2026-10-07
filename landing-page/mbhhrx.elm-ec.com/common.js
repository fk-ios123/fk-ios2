const {copy:AK_COPY,names:AK_NAMES,codes:AK_CODES}=window.AK_I18N;
let akLanguage="en";
const akLanguageBox=document.querySelector(".language"),akTrigger=document.querySelector(".language-trigger"),akMenu=document.querySelector(".language-menu");
function akCloseMenu(){akMenu.hidden=true;akTrigger.setAttribute("aria-expanded","false")}
function akRender(code){
  akLanguage=AK_COPY[code]?code:"en";const text=AK_COPY[akLanguage];document.documentElement.lang=akLanguage;document.documentElement.dir=akLanguage==="ar"?"rtl":"ltr";
  document.querySelectorAll("[data-t]").forEach(element=>{if(text[element.dataset.t])element.textContent=text[element.dataset.t]});document.querySelector(".language-code").textContent=AK_CODES[akLanguage];
  document.querySelectorAll("[data-lang]").forEach(button=>button.setAttribute("aria-current",String(button.dataset.lang===akLanguage)));document.title=`${text.heroTitle} | AirdropKart guide`;
  const url=new URL(location.href);url.searchParams.set("lang",akLanguage);history.replaceState({},"",url);document.dispatchEvent(new CustomEvent("ak:language",{detail:{language:akLanguage,text}}))
}
akTrigger.addEventListener("click",event=>{event.stopPropagation();const opening=akMenu.hidden;akMenu.hidden=!opening;akTrigger.setAttribute("aria-expanded",String(opening))});
document.querySelectorAll("[data-lang]").forEach(button=>button.addEventListener("click",()=>{akRender(button.dataset.lang);akCloseMenu()}));document.addEventListener("click",event=>{if(!akLanguageBox.contains(event.target))akCloseMenu()});document.addEventListener("keydown",event=>{if(event.key==="Escape")akCloseMenu()});
const akObserver=new IntersectionObserver(entries=>entries.forEach(entry=>{if(entry.isIntersecting)entry.target.classList.add("show")}),{threshold:.12});document.querySelectorAll(".reveal").forEach(element=>akObserver.observe(element));
akRender(new URLSearchParams(location.search).get("lang")||"en");
