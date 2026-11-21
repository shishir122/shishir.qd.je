/* Shorts maker, an extra tab inside "Website control".
   1. Gemini reads the YouTube stream link and finds the best moments with times and captions.
   2. A small helper program on your own computer (shorts-server) downloads only those parts and builds the vertical videos. */
(function(){
const $=(s,r)=>(r||document).querySelector(s);
const esc=s=>String(s==null?'':s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const ls=(k,v)=>{try{if(v===undefined)return localStorage.getItem(k)||'';localStorage.setItem(k,v)}catch(e){}return ''};
const ytId=u=>{const m=String(u).match(/(?:v=|youtu\.be\/|\/live\/|\/shorts\/)([\w-]{11})/);return m?m[1]:''};
const tsec=t=>{t=String(t||'').trim();if(!t)return 0;return t.includes(':')?t.split(':').map(Number).reduce((a,b)=>a*60+b,0):(parseFloat(t)||0)};
const fmt=s=>{s=Math.max(0,Math.round(s));const z=n=>String(n).padStart(2,'0'),h=Math.floor(s/3600),m=Math.floor(s%3600/60);return(h?h+':'+z(m):m)+':'+z(s%60)};
const SL=[['fx','ফেসক্যাম: বাম-ডান',0,100,100],['fy','ফেসক্যাম: ওপর-নিচ',0,100,100],['fw','ফেসক্যাম: আকার',5,100,24],
 ['gx','গেমপ্লে: বাম-ডান',0,100,50],['gy','গেমপ্লে: ওপর-নিচ',0,100,0],['gw','গেমপ্লে: আকার',5,100,56],
 ['split','ফেসক্যামের উচ্চতা (%)',25,55,38],['csz','ক্যাপশনের আকার',40,110,72],['cpos','ক্যাপশনের অবস্থান',30,90,62]];
let clips=[],img=null;
const L=()=>{const o={};SL.forEach(([k])=>o[k]=+$('#sh_'+k).value);return o};
const region=(vw,vh,px,py,pw,ar)=>{let w=vw*pw/100,h=w/ar;if(h>vh){h=vh;w=h*ar}return{x:(vw-w)*px/100,y:(vh-h)*py/100,w,h}};
const geo=(vw,vh)=>{const l=L(),fh=Math.round(1920*l.split/100);return{l,fh,F:region(vw,vh,l.fx,l.fy,l.fw,1080/fh),G:region(vw,vh,l.gx,l.gy,l.gw,1080/(1920-fh))}};
const log=m=>{const e=$('#sh_log');if(e)e.textContent=m};

function open(){
 const d=$('#adm');if(!d)return;
 d.innerHTML=`<button class="ax" id="ac">Close &#10005;</button><h3>শর্ট বানানোর টুল</h3>
 <p class="am">লাইভ স্ট্রিমের লিংক দিন, Gemini সেরা মুহূর্ত খুঁজে সময় ও ক্যাপশন দেবে, তারপর আপনার কম্পিউটারের হেল্পার সেই অংশ নামিয়ে শর্ট বানাবে।</p>
 <div class="bt" style="margin:0 0 6px"><button class="btn" id="sh_back">&larr; Website control</button></div>
 <details open><summary>সেটআপ</summary>
  <label>Google AI Studio API key (শুধু এই ব্রাউজারে সেভ থাকে)</label><input id="sh_key" type="password" autocomplete="off" value="${esc(ls('sh_gk'))}">
  <label>Gemini মডেল</label><input id="sh_model" value="${esc(ls('sh_gm')||'gemini-2.5-flash')}">
  <label>হেল্পার প্রোগ্রামের ঠিকানা</label><input id="sh_srv" value="${esc(ls('sh_gs')||'http://127.0.0.1:8787')}">
  <div class="bt"><button class="btn" id="sh_test">হেল্পার চালু আছে কি না দেখুন</button></div>
 </details>
 <h3 style="font-size:19px;margin-top:20px">১. স্ট্রিম ও সময়</h3>
 <label>YouTube লাইভ (শেষ হয়ে যাওয়া) ভিডিওর লিংক</label><input id="sh_url" placeholder="https://www.youtube.com/watch?v=...">
 <div class="r2" style="display:grid;grid-template-columns:1fr 1fr;gap:10px"><div><label>কোন সময় থেকে (ঘণ্টা:মিনিট:সেকেন্ড)</label><input id="sh_from" value="0:00"></div><div><label>কোন সময় পর্যন্ত</label><input id="sh_to" value="30:00"></div></div>
 <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px"><div><label>কয়টি ক্লিপ</label><input id="sh_n" type="number" min="1" max="15" value="5"></div><div><label>সর্বনিম্ন সেকেন্ড</label><input id="sh_min" type="number" value="20"></div><div><label>সর্বোচ্চ সেকেন্ড</label><input id="sh_max" type="number" value="50"></div></div>
 <div class="bt"><button class="btn" id="sh_go" style="background:var(--y);color:var(--ink);border-color:var(--y)">Gemini দিয়ে ক্লিপ খুঁজুন</button></div>
 <h3 style="font-size:19px;margin-top:22px">২. লেআউট (উপরে ফেসক্যাম, নিচে গেমপ্লে)</h3>
 <div style="display:grid;grid-template-columns:minmax(0,1fr) 190px;gap:16px;align-items:start">
  <div><div style="position:relative;background:#000;border-radius:8px;overflow:hidden"><img id="sh_th" alt="" style="width:100%;display:block;min-height:120px"><div id="sh_bf" class="box" style="position:absolute;border:2px solid #ff5f78;pointer-events:none"></div><div id="sh_bg" style="position:absolute;border:2px solid #5be3a1;pointer-events:none"></div></div>
   <p class="am" style="margin-top:6px">লাল বক্স = ফেসক্যাম, সবুজ বক্স = গেমপ্লে (ভিডিওর থাম্বনেইলে দেখানো হচ্ছে)।</p>
   ${SL.map(([k,l,a,b,v])=>`<label>${l}</label><input type="range" id="sh_${k}" min="${a}" max="${b}" value="${v}">`).join('')}</div>
  <canvas id="sh_pv" width="270" height="480" style="width:190px;border-radius:8px;background:#000"></canvas>
 </div>
 <h3 style="font-size:19px;margin-top:22px">৩. পাওয়া ক্লিপ</h3><div id="sh_clips"><p class="am">এখনো কোনো ক্লিপ নেই।</p></div>
 <p id="sh_log" class="am" style="white-space:pre-wrap;margin-top:14px"></p>`;
 $('#ac').onclick=()=>d.close();$('#sh_back').onclick=()=>window.openSite&&window.openSite();
 $('#sh_test').onclick=test;$('#sh_go').onclick=analyze;
 $('#sh_url').oninput=loadThumb;
 SL.forEach(([k])=>$('#sh_'+k).oninput=paint);
 renderClips();paint();
}

function loadThumb(){
 const id=ytId($('#sh_url').value);if(!id){img=null;paint();return}
 const t=$('#sh_th'),try2=()=>{t.onerror=null;t.src='https://i.ytimg.com/vi/'+id+'/mqdefault.jpg'};
 t.onerror=try2;t.onload=()=>{img=t;paint()};t.src='https://i.ytimg.com/vi/'+id+'/maxresdefault.jpg';
}

function paint(){
 const vw=1920,vh=1080,g=geo(vw,vh),t=$('#sh_th'),s=t.clientWidth/vw;
 const put=(el,r)=>{el.style.left=r.x*s+'px';el.style.top=r.y*s+'px';el.style.width=r.w*s+'px';el.style.height=r.h*s+'px'};
 if(t.clientWidth){put($('#sh_bf'),g.F);put($('#sh_bg'),g.G)}
 const c=$('#sh_pv'),x=c.getContext('2d'),k=c.width/1080;
 x.fillStyle='#111';x.fillRect(0,0,c.width,c.height);
 if(img&&img.naturalWidth){const q=img.naturalWidth/vw;
  const dr=(r,y,h)=>x.drawImage(img,r.x*q,r.y*q,r.w*q,r.h*q,0,y*k,c.width,h*k);
  dr(g.F,0,g.fh);dr(g.G,g.fh,1920-g.fh)}
 x.fillStyle='#5b3df5';x.fillRect(0,g.fh*k-1,c.width,2);
 x.font='700 '+g.l.csz*k+'px "Hind Siliguri",sans-serif';x.textAlign='center';x.textBaseline='middle';x.lineJoin='round';
 x.lineWidth=g.l.csz*k/4;x.strokeStyle='#000';x.fillStyle='#fff';
 const y=c.height*g.l.cpos/100;x.strokeText('ক্যাপশন এখানে',c.width/2,y);x.fillText('ক্যাপশন এখানে',c.width/2,y);
}
addEventListener('resize',()=>{if($('#sh_pv'))paint()});

async function test(){
 const u=$('#sh_srv').value.trim().replace(/\/$/,'');ls('sh_gs',u);log('দেখা হচ্ছে...');
 try{const r=await fetch(u+'/health'),j=await r.json();log('হেল্পার চালু আছে। yt-dlp: '+(j.ytdlp?'আছে':'নেই')+', ffmpeg: '+(j.ffmpeg?'আছে':'নেই'))}
 catch(e){log('হেল্পারের সাথে যোগ হয়নি। shorts-server ফোল্ডারে গিয়ে "python server.py" চালান। (ব্রাউজার অনুমতি চাইলে Allow দিন।)')}
}

async function analyze(){
 const key=$('#sh_key').value.trim(),model=$('#sh_model').value.trim()||'gemini-2.5-flash',url=$('#sh_url').value.trim();
 if(!key)return log('আগে Gemini API key দিন।');if(!ytId(url))return log('সঠিক YouTube লিংক দিন।');
 ls('sh_gk',key);ls('sh_gm',model);
 const a=tsec($('#sh_from').value),b=tsec($('#sh_to').value),n=+$('#sh_n').value||5,mn=+$('#sh_min').value||20,mx=+$('#sh_max').value||50;
 if(b<=a)return log('শেষের সময় শুরুর পরে হতে হবে।');
 const btn=$('#sh_go');btn.disabled=true;log('Gemini ভিডিও দেখছে, কয়েক মিনিট লাগতে পারে...');
 const prompt=`You are a YouTube Shorts editor for a gaming streamer. Watch this live stream between ${fmt(a)} and ${fmt(b)} and pick the ${n} most engaging moments (funny reactions, clutch plays, big wins or fails, strong storytelling).
Rules:
- Each clip must be between ${mn} and ${mx} seconds long, starting and ending at natural sentence boundaries.
- "start" and "end" are in seconds from the very beginning of the whole video (not from ${fmt(a)}).
- "title" is a short catchy title in Bangla.
- "captions" is the speech of the clip in the language actually spoken (Bangla in Bangla script), split into short lines of at most 6 words. "s" and "e" are seconds from the START OF THE CLIP, and must match when the words are really said.
- Clips must not overlap.`;
 const body={contents:[{parts:[{fileData:{fileUri:url},videoMetadata:{startOffset:Math.floor(a)+'s',endOffset:Math.ceil(b)+'s'}},{text:prompt}]}],
  generationConfig:{temperature:.3,responseMimeType:'application/json',responseSchema:{type:'OBJECT',properties:{clips:{type:'ARRAY',items:{type:'OBJECT',properties:{title:{type:'STRING'},why:{type:'STRING'},start:{type:'NUMBER'},end:{type:'NUMBER'},captions:{type:'ARRAY',items:{type:'OBJECT',properties:{s:{type:'NUMBER'},e:{type:'NUMBER'},t:{type:'STRING'}},required:['s','e','t']}}},required:['title','start','end','captions']}}},required:['clips']}}};
 try{
  const r=await fetch('https://generativelanguage.googleapis.com/v1beta/models/'+encodeURIComponent(model)+':generateContent?key='+encodeURIComponent(key),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
  const j=await r.json();if(!r.ok)throw new Error((j.error&&j.error.message)||('HTTP '+r.status));
  const txt=((j.candidates&&j.candidates[0]&&j.candidates[0].content.parts)||[]).map(p=>p.text||'').join('').replace(/```json|```/g,'').trim();
  let list=(JSON.parse(txt).clips||[]).map(c=>({title:c.title||'ক্লিপ',why:c.why||'',start:+c.start||0,end:+c.end||0,caps:(c.captions||[]).map(x=>({s:+x.s||0,e:+x.e||0,t:x.t||''})),sel:true}));
  if(a>0&&list.length&&list.every(c=>c.end<=b-a+1))list.forEach(c=>{c.start+=a;c.end+=a});
  list=list.filter(c=>c.end>c.start);list.forEach(c=>{if(c.end-c.start>60)c.end=c.start+60});
  clips=list;renderClips();log(list.length?list.length+'টি ক্লিপ পাওয়া গেছে। সময় ও ক্যাপশন ঠিক করে "শর্ট তৈরি করুন" চাপুন।':'কোনো ক্লিপ পাওয়া যায়নি। সময়ের পরিসীমা বড় করে আবার চেষ্টা করুন।');
 }catch(e){log('Gemini ত্রুটি: '+(e.message||e)+'\n(লাইভ চলাকালীন ভিডিও পড়া যায় না, স্ট্রিম শেষ হওয়ার পর চেষ্টা করুন। ভিডিও Public বা Unlisted হতে হবে।)')}
 btn.disabled=false;
}

function renderClips(){
 const box=$('#sh_clips');if(!box)return;
 if(!clips.length){box.innerHTML='<p class="am">এখনো কোনো ক্লিপ নেই।</p>';return}
 box.innerHTML=clips.map((c,i)=>`<div class="it" style="display:block" data-i="${i}">
  <label style="display:flex;gap:8px;align-items:center;margin:0"><input type="checkbox" data-f="sel" style="width:auto"${c.sel?' checked':''}><b>${esc(c.title)}</b></label>
  ${c.why?`<p class="am" style="margin:4px 0 8px">${esc(c.why)}</p>`:''}
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px"><div><label>শুরু</label><input data-f="start" value="${fmt(c.start)}"></div><div><label>শেষ</label><input data-f="end" value="${fmt(c.end)}"></div></div>
  <label>ক্যাপশন (ক্লিপের শুরু থেকে সেকেন্ডে)</label>
  ${c.caps.map((x,j)=>`<div style="display:grid;grid-template-columns:64px 64px 1fr 36px;gap:6px;margin-bottom:6px" data-j="${j}"><input type="number" step="0.1" data-f="cs" value="${x.s}"><input type="number" step="0.1" data-f="ce" value="${x.e}"><input data-f="ct" value="${esc(x.t)}"><button class="btn" data-x="cd" style="padding:4px">×</button></div>`).join('')}
  <div class="bt" style="margin-top:8px"><button class="btn" data-x="ca">+ ক্যাপশন</button><button class="btn" data-x="r" style="background:var(--y);color:var(--ink);border-color:var(--y)">শর্ট তৈরি করুন</button></div>
  <div class="am" data-st style="margin:8px 0 0"></div></div>`).join('')+
  `<div class="bt"><button class="btn" id="sh_all" style="background:var(--y);color:var(--ink);border-color:var(--y)">টিক দেওয়া সবগুলো তৈরি করুন</button></div>`;
 box.oninput=e=>{const t=e.target,i=+t.closest('[data-i]').dataset.i,c=clips[i],j=t.closest('[data-j]');if(!t.dataset.f)return;
  if(t.dataset.f=='start')c.start=tsec(t.value);else if(t.dataset.f=='end')c.end=tsec(t.value);
  else if(j){const x=c.caps[+j.dataset.j];if(t.dataset.f=='cs')x.s=+t.value;else if(t.dataset.f=='ce')x.e=+t.value;else x.t=t.value}};
 box.onchange=e=>{const t=e.target;if(t.dataset.f=='sel')clips[+t.closest('[data-i]').dataset.i].sel=t.checked};
 box.onclick=e=>{const b=e.target.closest('[data-x]');if(!b)return;const w=b.closest('[data-i]'),i=+w.dataset.i,c=clips[i];
  if(b.dataset.x=='cd'){c.caps.splice(+b.closest('[data-j]').dataset.j,1);renderClips()}
  else if(b.dataset.x=='ca'){const l=c.caps.length?c.caps[c.caps.length-1].e:0;c.caps.push({s:l,e:l+2,t:''});renderClips()}
  else if(b.dataset.x=='r')render(i)};
 $('#sh_all').onclick=async()=>{for(let i=0;i<clips.length;i++)if(clips[i].sel)await render(i)};
}

async function render(i){
 const c=clips[i],w=document.querySelector('#sh_clips [data-i="'+i+'"] [data-st]'),srv=$('#sh_srv').value.trim().replace(/\/$/,'');ls('sh_gs',srv);
 if(c.end<=c.start){w.textContent='শেষের সময় শুরুর পরে হতে হবে।';return}
 w.textContent='ডাউনলোড ও এডিটিং চলছে... (কয়েক মিনিট লাগতে পারে)';
 try{
  const r=await fetch(srv+'/render',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({url:$('#sh_url').value.trim(),start:c.start,end:c.end,title:c.title,captions:c.caps.filter(x=>x.t.trim()),layout:L()})});
  const j=await r.json();if(!r.ok||!j.ok)throw new Error(j.error||('HTTP '+r.status));
  w.innerHTML='তৈরি হয়েছে: <a href="'+esc(srv+j.url)+'" target="_blank" style="color:var(--y)">ডাউনলোড ('+esc(j.file)+')</a>';
 }catch(e){w.textContent='ত্রুটি: '+(e.message||e)+' (হেল্পার চালু আছে কি?)'}
}

window.openShorts=open;
})();
