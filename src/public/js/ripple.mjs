document.addEventListener("DOMContentLoaded",()=>{
  const els=[...document.querySelectorAll("button,input[type=submit],select")];
  els.forEach(el=>{
    el.addEventListener("click",function(e){
      const r=document.createElement("span");
      const rect=this.getBoundingClientRect();
      const d=Math.max(rect.width,rect.height);
      r.style.cssText=`width:${d}px;height:${d}px;left:${e.clientX-rect.left-d/2}px;top:${e.clientY-rect.top-d/2}px`;
      r.classList.add("ripple");
      this.appendChild(r);
      setTimeout(()=>r.remove(),600);
    });
  });
});