const fileInput = document.getElementById('fileInput');
const openBtn = document.getElementById('openBtn');
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d', {willReadFrequently:true});
const empty = document.getElementById('empty');
const thumbs = document.getElementById('thumbs');
const counter = document.getElementById('counter');
const statusEl = document.getElementById('status');
const stage = document.getElementById('stage');
const drop = document.getElementById('drop');

const stickerInput = document.getElementById('stickerInput');
const stickerSourceCanvas = document.getElementById('stickerSourceCanvas');
const stickerSourceCtx = stickerSourceCanvas.getContext('2d', {willReadFrequently:true});
const stickerSourceEmpty = document.getElementById('stickerSourceEmpty');
const stickerColor = document.getElementById('stickerColor');
const stickerTol = document.getElementById('stickerTol');
const stickersEl = document.getElementById('stickers');
const stickerEmpty = document.getElementById('stickerEmpty');
const stickerCount = document.getElementById('stickerCount');
const stickerModal = document.getElementById('stickerModal');
const openStickerModalBtn = document.getElementById('openStickerModalBtn');
const closeStickerModalBtn = document.getElementById('closeStickerModalBtn');
const selectedStickerBar = document.getElementById('selectedStickerBar');
const deleteStickerBtn = document.getElementById('deleteStickerBtn');
const openStickerFileBtn = document.getElementById('openStickerFileBtn');
const stickerImportStatus = document.getElementById('stickerImportStatus');

let items = [];
let index = -1;
let brushMode = 'none';
let drawing = false;
let originalImageData = null;

let stickerSourceOriginal = null;
let pickingStickerColor = false;
let activeStickerId = null;
let stickerLibrary = loadStickerLibrary();

function openStickerModal(){
  if(!stickerModal) return;
  stickerModal.classList.remove('hidden');
  stickerModal.setAttribute('aria-hidden','false');
}
function closeStickerModal(){
  if(!stickerModal) return;
  stickerModal.classList.add('hidden');
  stickerModal.setAttribute('aria-hidden','true');
  pickingStickerColor=false;
}
if(openStickerModalBtn) openStickerModalBtn.onclick=openStickerModal;
if(closeStickerModalBtn) closeStickerModalBtn.onclick=closeStickerModal;
document.querySelectorAll('[data-close-modal]').forEach(el=>el.onclick=closeStickerModal);


function setStatus(s){ statusEl.textContent = s; }
function current(){ return items[index]; }

openBtn.onclick = ()=> fileInput.click();
fileInput.onchange = e => addFiles([...e.target.files]);

['dragenter','dragover'].forEach(ev => stage.addEventListener(ev,e=>{e.preventDefault();drop.classList.add('on')}));
['dragleave','drop'].forEach(ev => stage.addEventListener(ev,e=>{e.preventDefault();drop.classList.remove('on')}));
stage.addEventListener('drop', e => addFiles([...e.dataTransfer.files].filter(f=>f.type.startsWith('image/'))));

function addFiles(files){
  files.forEach(file=>{
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = ()=>{
      items.push({file,url,img,history:[],savedData:null});
      renderThumbs();
      if(index<0) loadIndex(0);
    };
    img.src = url;
  });
  fileInput.value='';
}

function renderThumbs(){
  thumbs.innerHTML='';
  items.forEach((it,i)=>{
    const d=document.createElement('div');
    d.className='thumb'+(i===index?' active':'');
    d.onclick=()=>loadIndex(i);
    const im=document.createElement('img'); im.src=it.url;
    const meta=document.createElement('div'); meta.className='meta';
    meta.innerHTML='<div class="name">'+escapeHtml(it.file.name)+'</div><div class="size">'+it.img.naturalWidth+'×'+it.img.naturalHeight+'</div>';
    d.append(im,meta); thumbs.appendChild(d);
  });
}
function escapeHtml(s){return s.replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]))}

function snapshot(){
  if(index<0) return;
  const it=current();
  it.history.push(ctx.getImageData(0,0,canvas.width,canvas.height));
  if(it.history.length>20) it.history.shift();
}
function storeCurrent(){
  if(index<0 || !canvas.width) return;
  current().savedData = ctx.getImageData(0,0,canvas.width,canvas.height);
}
function loadIndex(i){
  if(i<0||i>=items.length) return;
  storeCurrent();
  index=i; const it=current();
  canvas.width=it.img.naturalWidth; canvas.height=it.img.naturalHeight;
  ctx.clearRect(0,0,canvas.width,canvas.height);
  if(it.savedData) ctx.putImageData(it.savedData,0,0);
  else ctx.drawImage(it.img,0,0);
  originalImageData = getOriginalData(it.img);
  empty.style.display='none';
  counter.textContent=(index+1)+' / '+items.length;
  renderThumbs();
  setStatus(it.file.name);
}
function getOriginalData(img){
  const c=document.createElement('canvas'); c.width=img.naturalWidth; c.height=img.naturalHeight;
  const x=c.getContext('2d'); x.drawImage(img,0,0); return x.getImageData(0,0,c.width,c.height);
}
function canvasPos(e){
  const r=canvas.getBoundingClientRect();
  return {x:(e.clientX-r.left)*(canvas.width/r.width), y:(e.clientY-r.top)*(canvas.height/r.height)};
}
function colorDist(r,g,b,t){ return Math.sqrt((r-t[0])**2+(g-t[1])**2+(b-t[2])**2); }
function hexToRgb(hex){ return [parseInt(hex.slice(1,3),16),parseInt(hex.slice(3,5),16),parseInt(hex.slice(5,7),16)]; }
function rgbToHex(r,g,b){ return '#'+[r,g,b].map(v=>v.toString(16).padStart(2,'0')).join(''); }

document.getElementById('prevBtn').onclick=()=>loadIndex(index-1);
document.getElementById('nextBtn').onclick=()=>loadIndex(index+1);

document.addEventListener('keydown',e=>{
  if(e.key==='ArrowLeft') loadIndex(index-1);
  if(e.key==='ArrowRight') loadIndex(index+1);
  if(e.key==='Escape'){
    if(stickerModal && !stickerModal.classList.contains('hidden')){
      closeStickerModal();
    }else{
      activeStickerId=null;
      pickingStickerColor=false;
      renderStickers();
      setStatus('선택 취소');
    }
  }
  if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='z'){e.preventDefault();undo();}
});

stickerInput.addEventListener('change', e=>{
  const file=e.target.files && e.target.files[0];
  if(!file) return;
  const url=URL.createObjectURL(file);
  const img=new Image();
  img.onload=()=>{
    stickerSourceCanvas.width=img.naturalWidth;
    stickerSourceCanvas.height=img.naturalHeight;
    stickerSourceCtx.clearRect(0,0,stickerSourceCanvas.width,stickerSourceCanvas.height);
    stickerSourceCtx.drawImage(img,0,0);
    stickerSourceOriginal=stickerSourceCtx.getImageData(0,0,stickerSourceCanvas.width,stickerSourceCanvas.height);
    stickerSourceEmpty.style.display='none';
    setStatus('외부 스티커 이미지 불러옴');
    URL.revokeObjectURL(url);
  };
  img.onerror=()=>{ setStatus('이미지를 불러오지 못했어요'); URL.revokeObjectURL(url); };
  img.src=url;
  stickerInput.value='';
});

document.getElementById('resetStickerSourceBtn').onclick=()=>{
  if(!stickerSourceOriginal) return;
  stickerSourceCtx.putImageData(stickerSourceOriginal,0,0);
  setStatus('스티커 소스 원본 복원');
};

document.getElementById('pickStickerColorBtn').onclick=()=>{
  if(!stickerSourceCanvas.width){setStatus('먼저 외부 이미지를 불러오세요');return;}
  pickingStickerColor=true;
  setStatus('스티커 이미지에서 원하는 색을 클릭하세요');
};

stickerSourceCanvas.addEventListener('click',e=>{
  if(!pickingStickerColor || !stickerSourceCanvas.width) return;
  const r=stickerSourceCanvas.getBoundingClientRect();
  const x=Math.max(0,Math.min(stickerSourceCanvas.width-1,Math.floor((e.clientX-r.left)*(stickerSourceCanvas.width/r.width))));
  const y=Math.max(0,Math.min(stickerSourceCanvas.height-1,Math.floor((e.clientY-r.top)*(stickerSourceCanvas.height/r.height))));
  const p=stickerSourceCtx.getImageData(x,y,1,1).data;
  stickerColor.value=rgbToHex(p[0],p[1],p[2]);
  pickingStickerColor=false;
  setStatus('선택 색: '+stickerColor.value);
});

function processStickerSource(mode){
  if(!stickerSourceCanvas.width){setStatus('먼저 외부 이미지를 불러오세요');return;}
  const target=hexToRgb(stickerColor.value);
  const tol=+stickerTol.value;
  const im=stickerSourceCtx.getImageData(0,0,stickerSourceCanvas.width,stickerSourceCanvas.height);
  const d=im.data;
  for(let i=0;i<d.length;i+=4){
    const dist=colorDist(d[i],d[i+1],d[i+2],target);
    if(mode==='keep'){
      if(dist>tol) d[i+3]=0;
      else d[i+3]=Math.round(255*(1-dist/tol));
    }else{
      if(dist<tol) d[i+3]=0;
      else if(dist<tol*1.6) d[i+3]=Math.min(d[i+3],Math.round(255*(dist-tol)/(tol*.6)));
    }
  }
  stickerSourceCtx.putImageData(im,0,0);
  setStatus(mode==='keep'?'선택 색만 남김':'선택 색 지움');
}
document.getElementById('keepStickerColorBtn').onclick=()=>processStickerSource('keep');
document.getElementById('removeStickerColorBtn').onclick=()=>processStickerSource('remove');

function trimTransparent(source){
  const sx=source.getContext('2d',{willReadFrequently:true});
  const im=sx.getImageData(0,0,source.width,source.height),d=im.data;
  let minX=source.width,minY=source.height,maxX=-1,maxY=-1;
  for(let y=0;y<source.height;y++)for(let x=0;x<source.width;x++){
    if(d[(y*source.width+x)*4+3]>5){
      if(x<minX)minX=x;if(y<minY)minY=y;if(x>maxX)maxX=x;if(y>maxY)maxY=y;
    }
  }
  if(maxX<minX)return null;
  const pad=6;
  minX=Math.max(0,minX-pad);minY=Math.max(0,minY-pad);
  maxX=Math.min(source.width-1,maxX+pad);maxY=Math.min(source.height-1,maxY+pad);
  const out=document.createElement('canvas');
  out.width=maxX-minX+1;out.height=maxY-minY+1;
  out.getContext('2d').drawImage(source,minX,minY,out.width,out.height,0,0,out.width,out.height);
  return out;
}
function whiteMask(source){
  const c=document.createElement('canvas');c.width=source.width;c.height=source.height;
  const cx=c.getContext('2d',{willReadFrequently:true});cx.drawImage(source,0,0);
  const im=cx.getImageData(0,0,c.width,c.height),d=im.data;
  for(let i=0;i<d.length;i+=4)if(d[i+3]){d[i]=255;d[i+1]=255;d[i+2]=255;}
  cx.putImageData(im,0,0);return c;
}
function buildStickerAsset(){
  const base=trimTransparent(stickerSourceCanvas);
  if(!base) return null;
  const outline=document.getElementById('stickerOutline').checked;
  const shadow=document.getElementById('stickerShadow').checked;
  if(!outline&&!shadow)return base;
  const pad=18;
  const out=document.createElement('canvas');out.width=base.width+pad*2;out.height=base.height+pad*2;
  const ox=out.getContext('2d');
  if(shadow){
    ox.save();ox.shadowColor='rgba(0,0,0,.28)';ox.shadowBlur=10;ox.shadowOffsetX=2;ox.shadowOffsetY=3;
    ox.drawImage(base,pad,pad);ox.restore();
  }
  if(outline){
    const mask=whiteMask(base);
    for(let dx=-4;dx<=4;dx++)for(let dy=-4;dy<=4;dy++){
      if(dx===0&&dy===0)continue;if(Math.sqrt(dx*dx+dy*dy)>4.5)continue;
      ox.drawImage(mask,pad+dx,pad+dy);
    }
  }
  ox.drawImage(base,pad,pad);
  return trimTransparent(out)||out;
}

document.getElementById('saveStickerBtn').onclick=()=>{
  if(!stickerSourceCanvas.width){setStatus('먼저 외부 이미지를 불러오세요');return;}
  const built=buildStickerAsset();
  if(!built){setStatus('남아 있는 픽셀이 없어요');return;}
  const dataUrl=built.toDataURL('image/png');
  const sticker={id:(crypto.randomUUID?crypto.randomUUID():String(Date.now()+Math.random())),dataUrl,createdAt:Date.now()};
  stickerLibrary.unshift(sticker);
  stickerLibrary=stickerLibrary.slice(0,60);
  saveStickerLibrary();
  activeStickerId=sticker.id;
  renderStickers();
  closeStickerModal();
  setStatus('스티커 저장 완료. 메인 사진 위를 클릭하면 붙어요');
};

function loadStickerLibrary(){
  try{const raw=localStorage.getItem('tiny-photo-editor-stickers-v3');const arr=raw?JSON.parse(raw):[];return Array.isArray(arr)?arr:[]}
  catch{return[]}
}
function saveStickerLibrary(){
  try{localStorage.setItem('tiny-photo-editor-stickers-v3',JSON.stringify(stickerLibrary))}
  catch{setStatus('스티커 저장 공간이 부족합니다')}
}
function renderStickers(){
  stickersEl.innerHTML='';
  if(stickerCount) stickerCount.textContent=stickerLibrary.length;
  if(selectedStickerBar){
    selectedStickerBar.textContent=activeStickerId
      ? '선택됨 · 가운데 사진을 클릭해서 붙이기'
      : '선택된 스티커 없음';
  }
  stickerEmpty.style.display=stickerLibrary.length?'none':'block';
  stickerLibrary.forEach(st=>{
    const card=document.createElement('div');
    card.className='sticker-card'+(st.id===activeStickerId?' active':'');
    card.onclick=()=>{
      activeStickerId=st.id;brushMode='none';
      document.querySelectorAll('#brushModes button').forEach(x=>x.classList.toggle('active',x.dataset.mode==='none'));
      renderStickers();setStatus('스티커 선택됨');
    };
    const img=document.createElement('img');img.src=st.dataUrl;
    const del=document.createElement('button');del.className='sticker-delete';del.textContent='×';
    del.onclick=e=>{e.stopPropagation();stickerLibrary=stickerLibrary.filter(x=>x.id!==st.id);if(activeStickerId===st.id)activeStickerId=null;saveStickerLibrary();renderStickers();};
    card.append(img,del);stickersEl.appendChild(card);
  });
}
renderStickers();

document.getElementById('stopStickerBtn').onclick=()=>{activeStickerId=null;renderStickers();setStatus('스티커 선택 해제')};
if(deleteStickerBtn) deleteStickerBtn.onclick=()=>{
  if(!activeStickerId){ setStatus('삭제할 스티커를 먼저 선택하세요'); return; }
  stickerLibrary=stickerLibrary.filter(x=>x.id!==activeStickerId);
  activeStickerId=null;
  saveStickerLibrary();
  renderStickers();
  setStatus('스티커 삭제');
};

function placeSticker(id,p){
  const st=stickerLibrary.find(x=>x.id===id);if(!st||index<0)return;
  const img=new Image();
  img.onload=()=>{
    snapshot();
    const scale=+document.getElementById('stickerSize').value/100;
    const opacity=+document.getElementById('stickerOpacity').value/100;
    const w=img.width*scale,h=img.height*scale;
    ctx.save();ctx.globalAlpha=opacity;ctx.drawImage(img,p.x-w/2,p.y-h/2,w,h);ctx.restore();
    storeCurrent();setStatus('스티커 붙임');
  };
  img.src=st.dataUrl;
}

document.querySelectorAll('#brushModes button').forEach(b=>b.onclick=()=>{
  brushMode=b.dataset.mode;activeStickerId=null;renderStickers();
  document.querySelectorAll('#brushModes button').forEach(x=>x.classList.toggle('active',x===b));
});

canvas.addEventListener('pointerdown',e=>{
  if(index<0)return;
  if(activeStickerId){placeSticker(activeStickerId,canvasPos(e));return;}
  if(brushMode==='none')return;
  drawing=true;canvas.setPointerCapture(e.pointerId);snapshot();paint(e);
});
canvas.addEventListener('pointermove',e=>{if(drawing)paint(e)});
canvas.addEventListener('pointerup',()=>{drawing=false;storeCurrent()});
canvas.addEventListener('pointercancel',()=>{drawing=false;storeCurrent()});

function paint(e){
  const p=canvasPos(e);
  const size=+document.getElementById('brushSize').value;
  const power=+document.getElementById('brushPower').value/100;
  ctx.save();
  if(brushMode==='erase'){
    ctx.globalCompositeOperation='destination-out';ctx.globalAlpha=power;ctx.beginPath();ctx.arc(p.x,p.y,size/2,0,Math.PI*2);ctx.fill();
  }else if(brushMode==='restore'){
    const temp=document.createElement('canvas');temp.width=canvas.width;temp.height=canvas.height;temp.getContext('2d').putImageData(originalImageData,0,0);
    ctx.globalAlpha=power;ctx.beginPath();ctx.arc(p.x,p.y,size/2,0,Math.PI*2);ctx.clip();ctx.drawImage(temp,0,0);
  }else if(brushMode==='glow'){
    ctx.globalCompositeOperation='screen';ctx.globalAlpha=power*.35;
    const g=ctx.createRadialGradient(p.x,p.y,0,p.x,p.y,size/1.4);g.addColorStop(0,'rgba(255,255,255,1)');g.addColorStop(1,'rgba(255,255,255,0)');
    ctx.fillStyle=g;ctx.beginPath();ctx.arc(p.x,p.y,size/1.4,0,Math.PI*2);ctx.fill();
  }else if(brushMode==='sparkle'){
    ctx.globalCompositeOperation='screen';ctx.globalAlpha=power;ctx.strokeStyle='white';ctx.lineWidth=Math.max(1,size/12);
    const r=size/2;ctx.beginPath();ctx.moveTo(p.x-r,p.y);ctx.lineTo(p.x+r,p.y);ctx.moveTo(p.x,p.y-r);ctx.lineTo(p.x,p.y+r);ctx.stroke();
  }else if(brushMode==='blur'){
    const r=size/2,x=Math.max(0,p.x-r),y=Math.max(0,p.y-r),w=Math.min(size,canvas.width-x),h=Math.min(size,canvas.height-y);
    if(w>1&&h>1){const tmp=document.createElement('canvas');tmp.width=w;tmp.height=h;const tx=tmp.getContext('2d');tx.filter='blur('+Math.max(2,size/8)+'px)';tx.drawImage(canvas,x,y,w,h,0,0,w,h);ctx.globalAlpha=power;ctx.drawImage(tmp,x,y);}
  }
  ctx.restore();
}

function undo(){
  if(index<0)return;const h=current().history;if(!h.length)return;
  ctx.putImageData(h.pop(),0,0);storeCurrent();setStatus('실행 취소');
}
document.getElementById('undoBtn').onclick=undo;
document.getElementById('resetBtn').onclick=()=>{
  if(index<0)return;snapshot();ctx.clearRect(0,0,canvas.width,canvas.height);ctx.drawImage(current().img,0,0);storeCurrent();setStatus('원본 복원');
};

document.getElementById('saveBtn').onclick=()=>{
  if(index<0)return;storeCurrent();
  canvas.toBlob(blob=>{
    const a=document.createElement('a');const base=current().file.name.replace(/\.[^.]+$/,'');
    a.href=URL.createObjectURL(blob);a.download=base+'_edited.png';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);
    setStatus('PNG 저장 완료');if(index<items.length-1)loadIndex(index+1);
  },'image/png');
};