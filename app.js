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

let items = [];
let index = -1;
let brushMode = 'none';
let drawing = false;
let bgSample = [255,255,255];
let originalImageData = null;

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
    meta.innerHTML=`<div class="name">${escapeHtml(it.file.name)}</div><div class="size">${it.img.naturalWidth}×${it.img.naturalHeight}</div>`;
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
  counter.textContent=`${index+1} / ${items.length}`;
  renderThumbs();
  setStatus(`${it.file.name}`);
}
function getOriginalData(img){
  const c=document.createElement('canvas'); c.width=img.naturalWidth; c.height=img.naturalHeight;
  const x=c.getContext('2d'); x.drawImage(img,0,0); return x.getImageData(0,0,c.width,c.height);
}

document.getElementById('prevBtn').onclick=()=>loadIndex(index-1);
document.getElementById('nextBtn').onclick=()=>loadIndex(index+1);

document.addEventListener('keydown',e=>{
  if(e.key==='ArrowLeft') loadIndex(index-1);
  if(e.key==='ArrowRight') loadIndex(index+1);
  if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='z'){e.preventDefault();undo();}
});

function canvasPos(e){
  const r=canvas.getBoundingClientRect();
  return {x:(e.clientX-r.left)*(canvas.width/r.width), y:(e.clientY-r.top)*(canvas.height/r.height)};
}
function colorAt(p){
  const d=ctx.getImageData(Math.max(0,Math.min(canvas.width-1,p.x|0)),Math.max(0,Math.min(canvas.height-1,p.y|0)),1,1).data;
  return [d[0],d[1],d[2]];
}
function rgbToHex([r,g,b]){return '#'+[r,g,b].map(v=>v.toString(16).padStart(2,'0')).join('')}

let pickBg=false, sampleText=false;
document.getElementById('pickBgBtn').onclick=()=>{pickBg=true;sampleText=false;setStatus('캔버스에서 배경색을 클릭하세요')};
document.getElementById('sampleTextBtn').onclick=()=>{sampleText=true;pickBg=false;setStatus('캔버스에서 글씨색을 클릭하세요')};

canvas.addEventListener('click',e=>{
  if(index<0)return;
  const p=canvasPos(e);
  if(pickBg){ bgSample=colorAt(p); pickBg=false; setStatus(`배경색 샘플: ${rgbToHex(bgSample)}`);}
  else if(sampleText){ const c=colorAt(p); document.getElementById('textColor').value=rgbToHex(c); sampleText=false; setStatus(`글씨색 샘플: ${rgbToHex(c)}`);}
});

function colorDist(r,g,b, t){ return Math.sqrt((r-t[0])**2+(g-t[1])**2+(b-t[2])**2); }

document.getElementById('removeBgBtn').onclick=()=>{
  if(index<0)return; snapshot();
  const tol=+document.getElementById('bgTol').value;
  const im=ctx.getImageData(0,0,canvas.width,canvas.height), d=im.data;
  for(let i=0;i<d.length;i+=4){
    const dist=colorDist(d[i],d[i+1],d[i+2],bgSample);
    if(dist<tol){ d[i+3]=0; }
    else if(dist<tol*1.7){ d[i+3]=Math.min(d[i+3], Math.round(255*(dist-tol)/(tol*.7))); }
  }
  ctx.putImageData(im,0,0); storeCurrent(); setStatus('배경 제거 완료');
};

document.getElementById('extractTextBtn').onclick=()=>{
  if(index<0)return; snapshot();
  const hex=document.getElementById('textColor').value;
  const target=[parseInt(hex.slice(1,3),16),parseInt(hex.slice(3,5),16),parseInt(hex.slice(5,7),16)];
  const tol=+document.getElementById('textTol').value;
  const im=ctx.getImageData(0,0,canvas.width,canvas.height), d=im.data;
  for(let i=0;i<d.length;i+=4){
    const dist=colorDist(d[i],d[i+1],d[i+2],target);
    if(dist>tol) d[i+3]=0;
    else d[i+3]=Math.round(255*(1-dist/tol));
  }
  ctx.putImageData(im,0,0); storeCurrent(); setStatus('글씨 누끼 완료');
};

document.querySelectorAll('#brushModes button').forEach(b=>b.onclick=()=>{
  brushMode=b.dataset.mode;
  document.querySelectorAll('#brushModes button').forEach(x=>x.classList.toggle('active',x===b));
});

canvas.addEventListener('pointerdown',e=>{
  if(index<0||brushMode==='none'||pickBg||sampleText)return;
  drawing=true; canvas.setPointerCapture(e.pointerId); snapshot(); paint(e);
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
    ctx.globalCompositeOperation='destination-out';
    ctx.globalAlpha=power;
    ctx.beginPath();ctx.arc(p.x,p.y,size/2,0,Math.PI*2);ctx.fill();
  } else if(brushMode==='restore'){
    ctx.globalCompositeOperation='source-over';
    ctx.globalAlpha=power;
    const r=size/2, sx=Math.max(0,p.x-r), sy=Math.max(0,p.y-r), sw=Math.min(size,canvas.width-sx), sh=Math.min(size,canvas.height-sy);
    if(sw>0&&sh>0){
      const temp=document.createElement('canvas');temp.width=canvas.width;temp.height=canvas.height;
      temp.getContext('2d').putImageData(originalImageData,0,0);
      ctx.save(); ctx.beginPath();ctx.arc(p.x,p.y,r,0,Math.PI*2);ctx.clip();ctx.drawImage(temp,0,0);ctx.restore();
    }
  } else if(brushMode==='glow'){
    ctx.globalCompositeOperation='screen';
    ctx.globalAlpha=power*.35;
    const g=ctx.createRadialGradient(p.x,p.y,0,p.x,p.y,size/1.4);
    g.addColorStop(0,'rgba(255,255,255,1)'); g.addColorStop(1,'rgba(255,255,255,0)');
    ctx.fillStyle=g;ctx.beginPath();ctx.arc(p.x,p.y,size/1.4,0,Math.PI*2);ctx.fill();
  } else if(brushMode==='sparkle'){
    ctx.globalCompositeOperation='screen';
    ctx.globalAlpha=power;
    ctx.strokeStyle='white';ctx.lineWidth=Math.max(1,size/12);
    const r=size/2;
    ctx.beginPath();ctx.moveTo(p.x-r,p.y);ctx.lineTo(p.x+r,p.y);ctx.moveTo(p.x,p.y-r);ctx.lineTo(p.x,p.y+r);ctx.stroke();
    ctx.globalAlpha=power*.6;
    ctx.beginPath();ctx.moveTo(p.x-r*.6,p.y-r*.6);ctx.lineTo(p.x+r*.6,p.y+r*.6);ctx.moveTo(p.x+r*.6,p.y-r*.6);ctx.lineTo(p.x-r*.6,p.y+r*.6);ctx.stroke();
  } else if(brushMode==='blur'){
    const r=size/2, x=Math.max(0,p.x-r), y=Math.max(0,p.y-r), w=Math.min(size,canvas.width-x), h=Math.min(size,canvas.height-y);
    if(w>1&&h>1){
      const tmp=document.createElement('canvas');tmp.width=w;tmp.height=h;
      const tx=tmp.getContext('2d');tx.filter=`blur(${Math.max(2,size/8)}px)`;tx.drawImage(canvas,x,y,w,h,0,0,w,h);
      ctx.globalAlpha=power;ctx.drawImage(tmp,x,y);
    }
  }
  ctx.restore();
}

function undo(){
  if(index<0)return; const h=current().history; if(!h.length)return;
  const d=h.pop(); ctx.putImageData(d,0,0);storeCurrent();setStatus('실행 취소');
}
document.getElementById('undoBtn').onclick=undo;
document.getElementById('resetBtn').onclick=()=>{
  if(index<0)return; snapshot(); ctx.clearRect(0,0,canvas.width,canvas.height);ctx.drawImage(current().img,0,0);storeCurrent();setStatus('원본 복원');
};

document.getElementById('saveBtn').onclick=()=>{
  if(index<0)return;
  storeCurrent();
  canvas.toBlob(blob=>{
    const a=document.createElement('a');
    const base=current().file.name.replace(/\.[^.]+$/,'');
    a.href=URL.createObjectURL(blob);a.download=base+'_edited.png';a.click();
    setTimeout(()=>URL.revokeObjectURL(a.href),1000);
    setStatus('PNG 저장 완료');
    if(index<items.length-1) loadIndex(index+1);
  },'image/png');
};
