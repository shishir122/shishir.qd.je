/* Shorts maker, an extra tab inside "Website control".
   Gemini finds the best moments and writes the captions; the vertical video is built in this browser; YouTube upload goes through a Supabase function. */
(function(){
if(location.hash=='#yt-connected'){try{window.opener&&window.opener.postMessage('yt-connected','*')}catch(e){}if(window.opener){window.close()}else{history.replaceState(null,'',location.pathname+location.search)}}
const $=(s,r)=>(r||document).querySelector(s);
const esc=s=>String(s==null?'':s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const ls=(k,v)=>{try{if(v===undefined)return localStorage.getItem(k)||'';localStorage.setItem(k,v)}catch(e){}return ''};
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const ytId=u=>{const m=String(u).match(/(?:v=|youtu\.be\/|\/live\/|\/shorts\/)([\w-]{11})/);return m?m[1]:''};
const tsec=t=>{t=String(t||'').trim();if(!t)return 0;return t.includes(':')?t.split(':').map(Number).reduce((a,b)=>a*60+b,0):(parseFloat(t)||0)};
const fmt=s=>{s=Math.max(0,Math.round(s));const z=n=>String(n).padStart(2,'0'),h=Math.floor(s/3600),m=Math.floor(s%3600/60);return(h?h+':'+z(m):m)+':'+z(s%60)};
const GB='https://generativelanguage.googleapis.com';
const SL=[['fx','ফেসক্যাম: বাম-ডান',0,100,100],['fy','ফেসক্যাম: ওপর-নিচ',0,100,100],['fw','ফেসক্যাম: আকার',5,100,24],
 ['gx','গেমপ্লে: বাম-ডান',0,100,50],['gy','গেমপ্লে: ওপর-নিচ',0,100,0],['gw','গেমপ্লে: আকার',5,100,56],
 ['split','ফেসক্যামের উচ্চতা (%)',25,55,38],['csz','ক্যাপশনের আকার',40,110,72],['cpos','ক্যাপশনের অবস্থান',30,90,62]];
let clips=[],src={type:'url',file:null,hid:null,gem:null};
const L=()=>{const o={};SL.forEach(([k])=>o[k]=+$('#sh_'+k).value);return o};
const region=(vw,vh,px,py,pw,ar)=>{let w=vw*pw/100,h=w/ar;if(h>vh){h=vh;w=h*ar}return{x:(vw-w)*px/100,y:(vh-h)*py/100,w,h}};
const geo=(vw,vh)=>{const l=L(),fh=Math.round(1920*l.split/100);return{l,fh,F:region(vw,vh,l.fx,l.fy,l.fw,1080/fh),G:region(vw,vh,l.gx,l.gy,l.gw,1080/(1920-fh))}};
const log=m=>{const e=$('#sh_log');if(e)e.textContent=m};
const chip=(id,ok,t)=>{const e=$('#'+id);if(e){e.textContent=(ok?'✔ ':'✖ ')+t;e.style.color=ok?'#5be3a1':'#ff8a9a'}};
const frame=()=>src.type=='file'?$('#sh_vid'):$('#sh_th');
const dims=()=>{const f=frame();if(f){const w=f.videoWidth||f.naturalWidth,h=f.videoHeight||f.naturalHeight;if(w&&h)return[w,h]}return[1920,1080]};

function open(){
 const d=$('#adm');if(!d)return;
 d.style.width='min(1180px,96vw)';
 if(!d._sh){d._sh=1;d.addEventListener('close',()=>{d.style.width=''});
  d.addEventListener('dragover',e=>{if($('#sh_drop'))e.preventDefault()});
  d.addEventListener('drop',e=>{if(!$('#sh_drop'))return;const f=e.dataTransfer&&e.dataTransfer.files&&e.dataTransfer.files[0];if(f){e.preventDefault();if(/^video\//.test(f.type)||/\.(mp4|mkv|mov|webm|avi)$/i.test(f.name))setFile(f);else log('এটি ভিডিও ফাইল নয়।')}})}
 d.innerHTML=`<style>.shg{display:grid;grid-template-columns:minmax(0,1fr) 400px;gap:22px;align-items:start}.shr{position:sticky;top:0}
 @media(max-width:900px){.shg{grid-template-columns:1fr}.shr{position:static}}
 .shb{position:absolute;border:2px solid;font:700 12px sans-serif;padding:1px 4px;cursor:move;touch-action:none;box-sizing:border-box}.shb i{position:absolute;right:-1px;bottom:-1px;width:16px;height:16px;background:currentColor;cursor:nwse-resize}
 .shdz{border:2px dashed var(--ln);border-radius:10px;padding:16px;text-align:center;color:var(--mu);cursor:pointer;margin-top:10px}.shdz.on{border-color:var(--y);color:var(--tx)}
 .shh{cursor:grab;user-select:none;padding:0 8px;color:var(--mu)}.shov{outline:2px dashed var(--y)}.shc{font-size:13px;margin-left:10px}</style>
 <button class="ax" id="ac">Close &#10005;</button><h3>শর্ট বানানোর টুল</h3>
 <p class="am">লিংক বা ভিডিও ফাইল দিন, Gemini সেরা মুহূর্ত খুঁজবে, তারপর এই ব্রাউজারেই শর্ট বানাবে ও YouTube-এ দেবে (কিছু ইনস্টল করতে হবে না)। সবকিছু টেনে (drag করে) সাজানো যায়।</p>
 <div class="bt" style="margin:0 0 6px"><button class="btn" id="sh_back">&larr; Website control</button></div>
 <div class="shg"><div>
 <details open><summary>সেটআপ <span class="shc" id="sh_c1"></span></summary>
  <label>Google AI Studio API key (শুধু এই ব্রাউজারে সেভ থাকে)</label><input id="sh_key" type="password" autocomplete="off" value="${esc(ls('sh_gk'))}">
  <label>Gemini মডেল (চাইলে তালিকা থেকে বেছে নিন)</label><input id="sh_model" list="sh_models" value="${esc(ls('sh_gm')||'gemini-2.5-flash')}"><datalist id="sh_models"></datalist>
  <div class="bt"><button class="btn" id="sh_tk">Key যাচাই ও মডেল তালিকা আনুন</button></div>
  <h4 style="margin:18px 0 6px">YouTube</h4>
  <div class="bt" style="margin-top:0"><button class="btn" id="sh_ytc">YouTube চ্যানেল যুক্ত করুন</button><button class="btn" id="sh_ytd">বিচ্ছিন্ন করুন</button><span class="shc" id="sh_c3"></span></div>
  <label>আপলোডের ধরন</label><select id="sh_priv"><option value="private">Private (শুধু আমি দেখব)</option><option value="unlisted">Unlisted (লিংক থাকলে দেখা যাবে)</option><option value="public">Public (সবার জন্য)</option></select>
  <label style="display:flex;gap:8px;align-items:center"><input type="checkbox" id="sh_auto" style="width:auto"> শর্ট তৈরি হলেই অটো YouTube-এ আপলোড করুন</label>
 </details>
 <h3 style="font-size:19px;margin-top:20px">১. ভিডিও ও সময়</h3>
 <label>YouTube লিংক (লিংক এখানে টেনে ছেড়ে দিলেও হবে)</label><input id="sh_url" placeholder="https://www.youtube.com/watch?v=...">
 <div class="shdz" id="sh_drop">অথবা ভিডিও ফাইল এখানে টেনে ছেড়ে দিন (বা ক্লিক করুন)<input type="file" id="sh_file" accept="video/*" hidden><div id="sh_fn" style="margin-top:6px;color:var(--tx)"></div></div>
 <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px"><div><label>শুরু (ঘণ্টা:মিনিট:সেকেন্ড)</label><input id="sh_from" value="0:00"></div><div><label>শেষ</label><input id="sh_to" value="30:00"></div></div>
 <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px"><div><label>কয়টি ক্লিপ</label><input id="sh_n" type="number" min="1" max="15" value="5"></div><div><label>সর্বনিম্ন সেকেন্ড</label><input id="sh_min" type="number" value="20"></div><div><label>সর্বোচ্চ সেকেন্ড</label><input id="sh_max" type="number" value="50"></div></div>
 <label>ক্যাপশন ও টাইটেলের ভাষা</label><select id="sh_lang"><option value="Bangla">বাংলা</option><option value="English">English</option></select>
 <div class="bt"><button class="btn" id="sh_go" style="background:var(--y);color:var(--ink);border-color:var(--y)">Gemini দিয়ে ক্লিপ খুঁজুন</button></div>
 <h3 style="font-size:19px;margin-top:22px">২. পাওয়া ক্লিপ (ক্লিপ ধরে টেনে ক্রম বদলানো যায়)</h3><div id="sh_clips"></div>
 <p id="sh_log" class="am" style="white-space:pre-wrap;margin-top:14px"></p></div>
 <div class="shr"><h3 style="font-size:19px">৩. লেআউট: বক্স টেনে সরান, কোণা টেনে আকার বদলান</h3>
  <div id="sh_stage" style="position:relative;background:#000;border-radius:8px;overflow:hidden;touch-action:none"><img id="sh_th" alt="" style="width:100%;display:block;min-height:110px"><video id="sh_vid" muted playsinline style="width:100%;display:none"></video>
   <div id="sh_bf" class="shb" style="border-color:#ff5f78;color:#ff5f78">ফেসক্যাম<i data-h="1"></i></div><div id="sh_bg" class="shb" style="border-color:#5be3a1;color:#5be3a1">গেমপ্লে<i data-h="1"></i></div></div>
  <input type="range" id="sh_scrub" min="0" max="100" value="0" style="display:none;margin-top:8px" aria-label="ফ্রেম বেছে নিন">
  <div style="display:grid;grid-template-columns:minmax(0,1fr) 150px;gap:12px;margin-top:10px;align-items:start"><div>
   ${SL.slice(6).map(([k,l,a,b,v])=>`<label>${l}</label><input type="range" id="sh_${k}" min="${a}" max="${b}" value="${v}">`).join('')}
   <details style="margin-top:10px"><summary>বক্সের সূক্ষ্ম মান</summary>${SL.slice(0,6).map(([k,l,a,b,v])=>`<label>${l}</label><input type="range" id="sh_${k}" min="${a}" max="${b}" value="${v}">`).join('')}</details></div>
  <canvas id="sh_pv" width="270" height="480" style="width:150px;border-radius:8px;background:#000"></canvas></div></div></div>`;
 $('#ac').onclick=()=>d.close();
 $('#sh_back').onclick=()=>{d.style.width='';window.openSite&&window.openSite()};
 $('#sh_tk').onclick=checkKey;$('#sh_go').onclick=analyze;
 $('#sh_url').oninput=()=>{src={type:'url',file:null,hid:null,gem:null};$('#sh_fn').textContent='';$('#sh_vid').style.display='none';$('#sh_scrub').style.display='none';$('#sh_th').style.display='block';loadThumb()};
 const dz=$('#sh_drop');dz.onclick=()=>$('#sh_file').click();$('#sh_file').onchange=e=>e.target.files[0]&&setFile(e.target.files[0]);
 dz.ondragenter=dz.ondragover=()=>dz.classList.add('on');dz.ondragleave=dz.ondrop=()=>dz.classList.remove('on');
 SL.forEach(([k])=>$('#sh_'+k).oninput=paint);
 drag($('#sh_bf'),'f');drag($('#sh_bg'),'g');
 $('#sh_scrub').oninput=e=>{$('#sh_vid').currentTime=+e.target.value};$('#sh_vid').onseeked=paint;
 $('#sh_lang').value=ls('sh_gl')||'Bangla';$('#sh_lang').onchange=e=>ls('sh_gl',e.target.value);$('#sh_ytc').onclick=ytConnect;$('#sh_ytd').onclick=ytDisconnect;$('#sh_priv').value=ls('sh_gp')||'private';$('#sh_priv').onchange=e=>ls('sh_gp',e.target.value);
 renderClips();paint();ytStatus(true);if(ls('sh_gk'))chip('sh_c1',1,'key সেভ আছে');
}

function loadThumb(){
 const id=ytId($('#sh_url').value),t=$('#sh_th');if(!id){paint();return}
 t.onerror=()=>{t.onerror=null;t.src='https://i.ytimg.com/vi/'+id+'/mqdefault.jpg'};t.onload=paint;t.src='https://i.ytimg.com/vi/'+id+'/maxresdefault.jpg';
}

function setFile(f){
 src={type:'file',file:f,hid:null,gem:null};$('#sh_url').value='';$('#sh_fn').textContent=f.name+' ('+Math.round(f.size/1048576)+' MB)';
 const v=$('#sh_vid');v.src=URL.createObjectURL(f);$('#sh_th').style.display='none';v.style.display='block';
 v.onloadedmetadata=()=>{const s=$('#sh_scrub');s.max=Math.floor(v.duration);s.style.display='block';$('#sh_to').value=fmt(v.duration);v.currentTime=Math.min(5,v.duration/2);paint()};
 log('ভিডিও পাওয়া গেছে। নিচের স্লাইডার দিয়ে ফ্রেম বেছে বক্স ঠিক করুন।');
}

function paint(){
 const f=frame();if(!f)return;const [vw,vh]=dims(),g=geo(vw,vh),s=f.clientWidth/vw;
 const put=(el,r)=>{el.style.left=r.x*s+'px';el.style.top=r.y*s+'px';el.style.width=r.w*s+'px';el.style.height=r.h*s+'px'};
 if(f.clientWidth){put($('#sh_bf'),g.F);put($('#sh_bg'),g.G)}
 const c=$('#sh_pv'),x=c.getContext('2d'),k=c.width/1080;
 x.fillStyle='#111';x.fillRect(0,0,c.width,c.height);
 const ready=f.videoWidth?f.readyState>=2:f.naturalWidth>0;
 if(ready){const dr=(r,y,h)=>x.drawImage(f,r.x,r.y,r.w,r.h,0,y*k,c.width,h*k);dr(g.F,0,g.fh);dr(g.G,g.fh,1920-g.fh)}
 x.fillStyle='#5b3df5';x.fillRect(0,g.fh*k-1,c.width,2);
 x.font='700 '+g.l.csz*k+'px "Hind Siliguri",sans-serif';x.textAlign='center';x.textBaseline='middle';x.lineJoin='round';
 x.lineWidth=g.l.csz*k/4;x.strokeStyle='#000';x.fillStyle='#fff';
 const y=c.height*g.l.cpos/100;x.strokeText('ক্যাপশন এখানে',c.width/2,y);x.fillText('ক্যাপশন এখানে',c.width/2,y);
}
addEventListener('resize',()=>{if($('#sh_pv'))paint()});

/* drag a box to move it, drag its corner to resize it */
function drag(el,k){
 el.onpointerdown=e=>{e.preventDefault();el.setPointerCapture(e.pointerId);
  const [vw,vh]=dims(),f=frame(),s=f.clientWidth/vw,g=geo(vw,vh),r0=k=='f'?g.F:g.G,rs=!!e.target.dataset.h,x0=e.clientX,y0=e.clientY;
  const set=(id,v)=>{$('#sh_'+k+id).value=Math.max(0,Math.min(100,v))};
  el.onpointermove=ev=>{const dx=(ev.clientX-x0)/s,dy=(ev.clientY-y0)/s;
   if(rs)set('w',Math.max(5,(r0.w+dx)/vw*100));
   else{if(vw>r0.w)set('x',(r0.x+dx)/(vw-r0.w)*100);if(vh>r0.h)set('y',(r0.y+dy)/(vh-r0.h)*100)}
   paint()};
  el.onpointerup=el.onpointercancel=()=>{el.onpointermove=null}};
}

async function checkKey(){
 const key=$('#sh_key').value.trim();if(!key)return log('আগে API key দিন।');ls('sh_gk',key);log('Key যাচাই হচ্ছে...');
 try{const r=await fetch(GB+'/v1beta/models?pageSize=200&key='+encodeURIComponent(key)),j=await r.json();
  if(!r.ok)throw new Error((j.error&&j.error.message)||('HTTP '+r.status));
  const ms=(j.models||[]).filter(m=>/gemini/i.test(m.name)&&(m.supportedGenerationMethods||[]).includes('generateContent')).map(m=>m.name.replace('models/',''));
  $('#sh_models').innerHTML=ms.map(m=>'<option value="'+esc(m)+'">').join('');chip('sh_c1',1,'key ঠিক আছে');log('Key ঠিক আছে। '+ms.length+'টি মডেল পাওয়া গেছে, মডেলের ঘরে ক্লিক করে বেছে নিন।')}
 catch(e){chip('sh_c1',0,'key কাজ করছে না');log('Key ত্রুটি: '+(e.message||e))}
}

async function geminiUpload(f,key){
 if(src.gem)return src.gem;log('ভিডিও Gemini-তে আপলোড হচ্ছে (বড় ফাইলে সময় লাগে)...');
 const s=await fetch(GB+'/upload/v1beta/files?key='+encodeURIComponent(key),{method:'POST',headers:{'X-Goog-Upload-Protocol':'resumable','X-Goog-Upload-Command':'start','X-Goog-Upload-Header-Content-Length':String(f.size),'X-Goog-Upload-Header-Content-Type':f.type||'video/mp4','Content-Type':'application/json'},body:JSON.stringify({file:{display_name:f.name}})});
 const up=s.headers.get('x-goog-upload-url');if(!up)throw new Error('আপলোড শুরু করা যায়নি (HTTP '+s.status+')');
 const r=await fetch(up,{method:'POST',headers:{'X-Goog-Upload-Offset':'0','X-Goog-Upload-Command':'upload, finalize'},body:f});
 let file=(await r.json()).file;if(!file)throw new Error('আপলোড শেষ হয়নি');
 for(let n=0;n<180&&file.state!=='ACTIVE';n++){if(file.state==='FAILED')throw new Error('Gemini ভিডিওটি প্রসেস করতে পারেনি');log('Gemini ভিডিও প্রসেস করছে...');await sleep(5000);file=await(await fetch(GB+'/v1beta/'+file.name+'?key='+encodeURIComponent(key))).json()}
 if(file.state!=='ACTIVE')throw new Error('প্রসেস হতে বেশি সময় লাগছে, পরে আবার চেষ্টা করুন');
 return src.gem={uri:file.uri,mime:file.mimeType||f.type||'video/mp4'};
}

async function analyze(){
 const key=$('#sh_key').value.trim(),model=$('#sh_model').value.trim()||'gemini-2.5-flash',url=$('#sh_url').value.trim();
 if(!key)return log('আগে Gemini API key দিন।');
 if(src.type=='url'&&!ytId(url))return log('YouTube লিংক দিন, অথবা ভিডিও ফাইল টেনে ছেড়ে দিন।');
 ls('sh_gk',key);ls('sh_gm',model);const LANG=$('#sh_lang').value;ls('sh_gl',LANG);
 const a=tsec($('#sh_from').value),b=tsec($('#sh_to').value),n=+$('#sh_n').value||5,mn=+$('#sh_min').value||20,mx=+$('#sh_max').value||50;
 if(b<=a)return log('শেষের সময় শুরুর পরে হতে হবে।');
 const btn=$('#sh_go');btn.disabled=true;
 try{
  let part;
  if(src.type=='file'){const g=await geminiUpload(src.file,key);part={fileData:{mimeType:g.mime,fileUri:g.uri},videoMetadata:{startOffset:Math.floor(a)+'s',endOffset:Math.ceil(b)+'s'}}}
  else part={fileData:{fileUri:url},videoMetadata:{startOffset:Math.floor(a)+'s',endOffset:Math.ceil(b)+'s'}};
  log('Gemini ভিডিও দেখছে, কয়েক মিনিট লাগতে পারে...');
  const prompt=`You are a YouTube Shorts editor for a gaming streamer. Watch this live stream between ${fmt(a)} and ${fmt(b)} and pick the ${n} most engaging moments (funny reactions, clutch plays, big wins or fails, strong storytelling).
Rules:
- Each clip must be between ${mn} and ${mx} seconds long, starting and ending at natural sentence boundaries.
- "start" and "end" are in seconds from the very beginning of the whole video (not from ${fmt(a)}).
- "title" is a short catchy title written in ${LANG}.
- "captions" is the speech of the clip written in ${LANG} (if the words are spoken in another language, translate them naturally${LANG=='Bangla'?', using Bangla script':''}), split into short lines of at most 6 words. "s" and "e" are seconds from the START OF THE CLIP, and must match when the words are really said.
- \"post\" is a ready-to-publish viral social media caption written in ${LANG} (Shorts/Reels/TikTok): a strong hook in the first line, 1-2 short lines, a few fitting emojis, then 4-6 relevant hashtags. No thumbnail text.
- Clips must not overlap.`;
  const body={contents:[{parts:[part,{text:prompt}]}],
   generationConfig:{temperature:.3,responseMimeType:'application/json',responseSchema:{type:'OBJECT',properties:{clips:{type:'ARRAY',items:{type:'OBJECT',properties:{title:{type:'STRING'},post:{type:'STRING'},why:{type:'STRING'},start:{type:'NUMBER'},end:{type:'NUMBER'},captions:{type:'ARRAY',items:{type:'OBJECT',properties:{s:{type:'NUMBER'},e:{type:'NUMBER'},t:{type:'STRING'}},required:['s','e','t']}}},required:['title','start','end','captions']}}},required:['clips']}}};
  const r=await fetch(GB+'/v1beta/models/'+encodeURIComponent(model)+':generateContent?key='+encodeURIComponent(key),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
  const j=await r.json();if(!r.ok)throw new Error((j.error&&j.error.message)||('HTTP '+r.status));
  const txt=((j.candidates&&j.candidates[0]&&j.candidates[0].content.parts)||[]).map(p=>p.text||'').join('').replace(/```json|```/g,'').trim();
  let list=(JSON.parse(txt).clips||[]).map(c=>({title:c.title||'ক্লিপ',post:c.post||'',why:c.why||'',start:+c.start||0,end:+c.end||0,caps:(c.captions||[]).map(x=>({s:+x.s||0,e:+x.e||0,t:x.t||''})),sel:true}));
  if(a>0&&list.length&&list.every(c=>c.end<=b-a+1))list.forEach(c=>{c.start+=a;c.end+=a});
  list=list.filter(c=>c.end>c.start);list.forEach(c=>{if(c.end-c.start>60)c.end=c.start+60});
  clips=list;renderClips();chip('sh_c1',1,'key ঠিক আছে');
  log(list.length?list.length+'টি ক্লিপ পাওয়া গেছে। সময় ও ক্যাপশন ঠিক করে "শর্ট তৈরি করুন" চাপুন।':'কোনো ক্লিপ পাওয়া যায়নি। সময়ের পরিসীমা বড় করে আবার চেষ্টা করুন।');
 }catch(e){chip('sh_c1',0,'ত্রুটি');log('Gemini ত্রুটি: '+(e.message||e)+(src.type=='url'?'\n(লাইভ চলাকালীন ভিডিও পড়া যায় না, স্ট্রিম শেষ হওয়ার পর চেষ্টা করুন। ভিডিও Public বা Unlisted হতে হবে।)':''))}
 btn.disabled=false;
}

function renderClips(){
 const box=$('#sh_clips');if(!box)return;
 if(!clips.length){box.innerHTML='<p class="am">এখনো কোনো ক্লিপ নেই।</p>';return}
 box.innerHTML=clips.map((c,i)=>`<div class="it" style="display:block" data-i="${i}">
  <div style="display:flex;align-items:center;gap:6px"><span class="shh" title="ধরে টানুন">&#8942;&#8942;</span><label style="display:flex;gap:8px;align-items:center;margin:0;flex:1"><input type="checkbox" data-f="sel" style="width:auto"${c.sel?' checked':''}><b>${esc(c.title)}</b>${c.segUrl?'<span class="shc" style="color:#5be3a1">&#10004; নামানো হয়েছে</span>':''}</label>${src.type=='file'?'<button class="btn" data-x="seek" style="padding:4px 10px">ফ্রেম দেখুন</button>':''}</div>
  ${c.why?`<p class="am" style="margin:4px 0 8px">${esc(c.why)}</p>`:''}
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px"><div><label>শুরু</label><input data-f="start" value="${fmt(c.start)}"></div><div><label>শেষ</label><input data-f="end" value="${fmt(c.end)}"></div></div>
  <label>ভাইরাল পোস্ট ক্যাপশন (Gemini লিখেছে, চাইলে বদলান)</label><textarea data-f="post" rows="4" style="width:100%">${esc(c.post||'')}</textarea><div class="bt" style="margin:6px 0 10px"><button class="btn" data-x="cp" style="padding:4px 10px">কপি করুন</button></div>
  <label>ভিডিওর ভেতরের সাবটাইটেল (ক্লিপের শুরু থেকে সেকেন্ডে)</label>
  ${c.caps.map((x,j)=>`<div style="display:grid;grid-template-columns:64px 64px 1fr 36px;gap:6px;margin-bottom:6px" data-j="${j}"><input type="number" step="0.1" data-f="cs" value="${x.s}"><input type="number" step="0.1" data-f="ce" value="${x.e}"><input data-f="ct" value="${esc(x.t)}"><button class="btn" data-x="cd" style="padding:4px">×</button></div>`).join('')}
  <div class="bt" style="margin-top:8px"><button class="btn" data-x="ca">+ ক্যাপশন</button><button class="btn" data-x="r" style="background:var(--y);color:var(--ink);border-color:var(--y)">শর্ট তৈরি করুন</button></div>
  <div class="am" data-st style="margin:8px 0 0">${stHtml(c)}</div></div>`).join('')+
  (src.type=='url'&&clips.length?'<div class="bt"><button class="btn" id="sh_dl" style="background:var(--y);color:var(--ink);border-color:var(--y)">টিক দেওয়া ক্লিপ সার্ভারে নামান (YouTube থেকে)</button></div><p class="am">সার্ভারে নামলে ক্লিপের পাশে সবুজ ✔ আসবে, তখন "শর্ট তৈরি করুন" চাপুন।</p>':'')+
  `<div class="bt"><button class="btn" id="sh_all" style="background:var(--y);color:var(--ink);border-color:var(--y)">টিক দেওয়া সবগুলো তৈরি করুন</button></div>`;
 let from=-1;
 box.onmousedown=e=>{if(e.target.classList.contains('shh'))e.target.closest('.it').draggable=true};
 box.ondragstart=e=>{const w=e.target.closest&&e.target.closest('.it');if(!w)return;from=+w.dataset.i;e.dataTransfer.effectAllowed='move';e.dataTransfer.setData('text/plain','clip')};
 box.ondragover=e=>{const w=e.target.closest&&e.target.closest('.it');if(w&&from>-1){e.preventDefault();e.stopPropagation();box.querySelectorAll('.shov').forEach(x=>x.classList.remove('shov'));w.classList.add('shov')}};
 box.ondrop=e=>{const w=e.target.closest&&e.target.closest('.it');if(w&&from>-1){e.preventDefault();e.stopPropagation();const to=+w.dataset.i,m=clips.splice(from,1)[0];clips.splice(to,0,m);from=-1;renderClips()}};
 box.ondragend=()=>{from=-1;box.querySelectorAll('.it').forEach(x=>{x.draggable=false;x.classList.remove('shov')})};
 box.oninput=e=>{const t=e.target,w=t.closest('[data-i]');if(!w||!t.dataset.f)return;const c=clips[+w.dataset.i],j=t.closest('[data-j]');
  if(t.dataset.f=='post')c.post=t.value;else if(t.dataset.f=='start')c.start=tsec(t.value);else if(t.dataset.f=='end')c.end=tsec(t.value);
  else if(j){const x=c.caps[+j.dataset.j];if(t.dataset.f=='cs')x.s=+t.value;else if(t.dataset.f=='ce')x.e=+t.value;else x.t=t.value}};
 box.onchange=e=>{const t=e.target;if(t.dataset.f=='sel')clips[+t.closest('[data-i]').dataset.i].sel=t.checked};
 box.onclick=e=>{const b=e.target.closest('[data-x]');if(!b)return;const w=b.closest('[data-i]'),i=+w.dataset.i,c=clips[i];
  if(b.dataset.x=='cd'){c.caps.splice(+b.closest('[data-j]').dataset.j,1);renderClips()}
  else if(b.dataset.x=='ca'){const l=c.caps.length?c.caps[c.caps.length-1].e:0;c.caps.push({s:l,e:l+2,t:''});renderClips()}
  else if(b.dataset.x=='cp'){navigator.clipboard&&navigator.clipboard.writeText(c.post||'').then(()=>{b.textContent='কপি হয়েছে ✔'},()=>{b.textContent='কপি হয়নি'})}
  else if(b.dataset.x=='yt')ytUpload(c)
  else if(b.dataset.x=='seek'){const v=$('#sh_vid');v.currentTime=c.start;$('#sh_scrub').value=c.start}
  else if(b.dataset.x=='r')render(i)};
 if($('#sh_dl'))$('#sh_dl').onclick=dlClips;
 $('#sh_all').onclick=async()=>{for(let i=0;i<clips.length;i++)if(clips[i].sel)await render(i)};
}

const SBU=()=>(window.SHCFG&&window.SHCFG.url)||'',SBK=()=>(window.SHCFG&&window.SHCFG.key)||'';
const tok=()=>{try{const o=JSON.parse(sessionStorage.getItem('sh_tok')||'null');return o&&o.exp>Date.now()?o.t:''}catch(e){return ''}};
const stEl=c=>document.querySelector('#sh_clips [data-i="'+clips.indexOf(c)+'"] [data-st]');
const upd=c=>{const e=stEl(c);if(e)e.innerHTML=stHtml(c)};
const say=(c,m)=>{const e=stEl(c);if(e)e.textContent=m};
function stHtml(c){if(!c.file)return '';
 return 'তৈরি হয়েছে: <a href="'+esc(c.out)+'" download="'+esc(c.file)+'" style="color:var(--y)">ডাউনলোড ('+esc(c.file)+')</a> <button class="btn" data-x="yt" style="padding:4px 10px;margin-left:8px">'+(c.yt?'আবার আপলোড':'YouTube-এ আপলোড')+'</button>'
 +(c.yt?' <a href="https://youtu.be/'+esc(c.yt)+'" target="_blank" style="color:#5be3a1">&#10004; YouTube-এ আছে ('+esc(c.ytp||'')+')</a>':'')}

async function ytCall(action,extra,fn){
 const t=tok();if(!t)throw new Error('আগে Website control-এ অ্যাডমিন হিসেবে লগইন করুন');
 const r=await fetch(SBU()+'/functions/v1/'+(fn||'youtube'),{method:'POST',headers:{apikey:SBK(),Authorization:'Bearer '+t,'Content-Type':'application/json'},body:JSON.stringify(Object.assign({action},extra||{}))});
 const j=await r.json().catch(()=>({}));if(!r.ok||j.error)throw new Error(j.error||('Supabase function ত্রুটি, HTTP '+r.status+' (function deploy করা আছে কি?)'));return j}

async function ytStatus(quiet){
 try{const j=await ytCall('status');if(j.connected){chip('sh_c3',1,'YouTube: '+(j.channel||'যুক্ত'));return true}chip('sh_c3',0,'YouTube যুক্ত নয়');return false}
 catch(e){chip('sh_c3',0,'YouTube চেক হয়নি');if(!quiet)log('YouTube: '+(e.message||e));return false}
}

async function ytConnect(){
 try{log('Google লগইন উইন্ডো খোলা হচ্ছে...');const j=await ytCall('auth_url',{ret:location.origin+location.pathname});
  const w=window.open(j.url,'ytauth','width=520,height=700');if(!w)return log('পপআপ ব্লক হয়েছে। ব্রাউজারে এই সাইটের জন্য পপআপ Allow করে আবার চাপুন।');
  log('খোলা উইন্ডোতে আপনার YouTube চ্যানেলের Google অ্যাকাউন্ট বেছে Allow দিন...');
  for(let n=0;n<90;n++){await sleep(2000);if(await ytStatus(true)){log('YouTube চ্যানেল যুক্ত হয়েছে।');return}}
  log('সময় শেষ। আবার চেষ্টা করুন।')}
 catch(e){log('YouTube ত্রুটি: '+(e.message||e))}
}

async function ytDisconnect(){
 try{await ytCall('disconnect');chip('sh_c3',0,'YouTube যুক্ত নয়');log('YouTube বিচ্ছিন্ন করা হয়েছে।')}catch(e){log('YouTube ত্রুটি: '+(e.message||e))}
}

async function dlClips(){
 const sel=clips.filter(c=>c.sel),url=$('#sh_url').value.trim();
 if(!sel.length)return log('কোনো ক্লিপে টিক দেওয়া নেই।');if(!ytId(url))return log('ওপরে YouTube লিংক দিন।');
 const b=$('#sh_dl');if(b)b.disabled=true;
 try{log('সার্ভারে কাজ জমা দেওয়া হচ্ছে...');
  const items=sel.map(c=>({start:Math.max(0,Math.floor(c.start)-2),end:Math.ceil(c.end)+2}));
  const j=await ytCall('start',{url,items},'clips'),t0=Date.now();
  for(;;){await sleep(5000);
   const r=await fetch(SBU()+'/rest/v1/clip_jobs?id=eq.'+j.job_id+'&select=status,message,files',{headers:{apikey:SBK(),Authorization:'Bearer '+tok()}}),a=await r.json(),x=a&&a[0];
   if(!x){if(Date.now()-t0>60000)throw new Error('কাজের খবর পাওয়া যাচ্ছে না (setup.sql চালানো হয়েছে কি?)');continue}
   if(x.status=='failed')throw new Error(x.message||'সার্ভারে কাজ ব্যর্থ হয়েছে');
   if(x.status=='done'){(x.files||[]).forEach(f=>{const c=sel[f.i];if(c){c.segUrl=f.url;c.segBlob=null;c.segStart=items[f.i].start}});renderClips();log('ক্লিপগুলো সার্ভারে নেমেছে। এখন "শর্ট তৈরি করুন" চাপুন।');break}
   log('সার্ভারে কাজ চলছে: '+(x.message||x.status)+' ('+Math.round((Date.now()-t0)/1000)+' সেকেন্ড)');
   if(Date.now()-t0>2400000)throw new Error('অনেক সময় লাগছে, GitHub-এর Actions পেজে দেখুন।')}}
 catch(e){log('সার্ভার ত্রুটি: '+(e.message||e))}
 if($('#sh_dl'))$('#sh_dl').disabled=false;
}

const wait=(el,ev)=>new Promise((res,rej)=>{el.addEventListener(ev,res,{once:true});el.addEventListener('error',()=>rej(new Error('ভিডিও লোড হয়নি')),{once:true})});
function drawCap(x,W,text,cy,size){
 x.font='700 '+size+'px "Noto Sans Bengali","Nirmala UI","Hind Siliguri","Segoe UI",Arial,sans-serif';x.textAlign='center';x.textBaseline='middle';x.lineJoin='round';
 x.lineWidth=Math.max(4,size/5);x.strokeStyle='#000';x.fillStyle='#fff';
 const words=String(text).split(/\s+/).filter(Boolean),lines=[];let cur='';
 for(const w of words){const t=cur?cur+' '+w:w;if(x.measureText(t).width>W*.88&&cur){lines.push(cur);cur=w}else cur=t}if(cur)lines.push(cur);
 const lh=size*1.25,y0=cy-(lines.length-1)*lh/2;
 lines.forEach((l,i)=>{x.strokeText(l,W/2,y0+i*lh);x.fillText(l,W/2,y0+i*lh)});
}

/* Builds the vertical short inside the browser: plays the clip, draws it on a 1080x1920 canvas, records canvas + sound. */
async function render(i){
 const c=clips[i];
 if(src.type!='file'&&!c.segUrl){say(c,'আগে নিচের "সার্ভারে নামান" বাটন চাপুন, অথবা ভিডিও ফাইল টেনে ছেড়ে দিন।');return}
 if(c.end<=c.start){say(c,'শেষের সময় শুরুর পরে হতে হবে।');return}
 if(!window.MediaRecorder){say(c,'এই ব্রাউজারে হবে না। Chrome বা Edge ব্যবহার করুন।');return}
 let off=0;const v=document.createElement('video'),AC=window.AudioContext||window.webkitAudioContext,ac=new AC();
 try{
  let vs;if(src.type=='file')vs=URL.createObjectURL(src.file);
  else{say(c,'সার্ভার থেকে ক্লিপ আনা হচ্ছে...');if(!c.segBlob){const r=await fetch(c.segUrl);if(!r.ok)throw new Error('সার্ভার থেকে ক্লিপ আনা যায়নি (HTTP '+r.status+')');c.segBlob=await r.blob()}vs=URL.createObjectURL(c.segBlob);off=c.segStart||0}
  v.src=vs;v.playsInline=true;v.preload='auto';say(c,'ভিডিও লোড হচ্ছে...');
  await wait(v,'loadedmetadata');
  const st=Math.max(0,Math.min(c.start-off,v.duration-1)),en=Math.min(c.end-off,v.duration),g=geo(v.videoWidth,v.videoHeight);
  const cv=document.createElement('canvas');cv.width=1080;cv.height=1920;const x=cv.getContext('2d');
  const ms=cv.captureStream(30),dest=ac.createMediaStreamDestination();ac.createMediaElementSource(v).connect(dest);
  dest.stream.getAudioTracks().forEach(t=>ms.addTrack(t));
  const mt=['video/mp4;codecs=avc1,mp4a.40.2','video/mp4','video/webm;codecs=vp9,opus','video/webm;codecs=vp8,opus','video/webm'].find(m=>MediaRecorder.isTypeSupported(m))||'';
  const rec=new MediaRecorder(ms,Object.assign({videoBitsPerSecond:8000000,audioBitsPerSecond:160000},mt?{mimeType:mt}:{}));
  const parts=[];rec.ondataavailable=e=>{if(e.data&&e.data.size)parts.push(e.data)};
  const stopped=new Promise(r=>rec.onstop=r);
  const sk=wait(v,'seeked');v.currentTime=st;await sk;await ac.resume();
  const draw=()=>{x.fillStyle='#111';x.fillRect(0,0,1080,1920);
   x.drawImage(v,g.F.x,g.F.y,g.F.w,g.F.h,0,0,1080,g.fh);x.drawImage(v,g.G.x,g.G.y,g.G.w,g.G.h,0,g.fh,1080,1920-g.fh);
   const t=v.currentTime-st,cp=c.caps.find(k=>t>=k.s&&t<k.e&&String(k.t).trim());if(cp)drawCap(x,1080,cp.t,1920*g.l.cpos/100,g.l.csz)};
  draw();rec.start(1000);await v.play();
  const t0=performance.now();let lastMsg=0;
  await new Promise(res=>{const tick=()=>{draw();const now=performance.now();
   if(now-lastMsg>500){lastMsg=now;say(c,'রেকর্ড হচ্ছে... '+Math.round(v.currentTime-st)+' / '+Math.round(en-st)+' সেকেন্ড (এই ট্যাব খোলা ও সামনে রাখুন)')}
   if(v.currentTime>=en||v.ended||now-t0>(en-st)*3000+15000)res();else requestAnimationFrame(tick)};requestAnimationFrame(tick)});
  v.pause();rec.stop();await stopped;
  const type=(mt||'video/webm').split(';')[0];
  c.blob=new Blob(parts,{type});c.file='short_'+(i+1)+'_'+Date.now().toString(36)+'.'+(type.includes('mp4')?'mp4':'webm');
  if(c.out)URL.revokeObjectURL(c.out);c.out=URL.createObjectURL(c.blob);
  upd(c);await saveHist(c);
  if($('#sh_auto').checked)await ytUpload(c);
 }catch(e){say(c,'ত্রুটি: '+(e.message||e))}
 finally{try{v.pause();URL.revokeObjectURL(v.src)}catch(_){}try{ac.close()}catch(_){}}
}

const yerr=(txt,status)=>{try{const e=JSON.parse(txt).error,w=(e.errors||[{}])[0].reason;if(w=='quotaExceeded')return 'YouTube-এর আজকের কোটা শেষ, কাল আবার চেষ্টা করুন।';return 'YouTube: '+e.message+(w?' ('+w+')':'')}catch(_){return 'YouTube ত্রুটি, HTTP '+status}};

async function ytUpload(c){
 if(!c.blob)return;
 try{say(c,'YouTube-এর অনুমতি নেওয়া হচ্ছে...');const t=await ytCall('token'),priv=$('#sh_priv').value,type=(c.blob.type||'video/webm').split(';')[0];
  let desc=String(c.post||'').replace(/[<>]/g,'').trim();if(!/#shorts/i.test(c.title+' '+desc))desc=(desc+'\n\n#Shorts').trim();
  const tags=[...new Set((desc.match(/#[\p{L}\p{N}_]+/gu)||[]).map(z=>z.slice(1)))].slice(0,12);
  const meta={snippet:{title:String(c.title||'Short').replace(/[<>]/g,'').slice(0,100),description:desc.slice(0,4800),tags,categoryId:'20'},status:{privacyStatus:priv,selfDeclaredMadeForKids:false}};
  const init=await fetch('https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status',{method:'POST',headers:{Authorization:'Bearer '+t.access_token,'Content-Type':'application/json; charset=UTF-8','X-Upload-Content-Length':String(c.blob.size),'X-Upload-Content-Type':type},body:JSON.stringify(meta)});
  if(!init.ok)throw new Error(yerr(await init.text(),init.status));
  const loc=init.headers.get('Location');if(!loc)throw new Error('YouTube আপলোড লিংক পাওয়া যায়নি');
  const id=await new Promise((res,rej)=>{const x=new XMLHttpRequest();x.open('PUT',loc);x.setRequestHeader('Content-Type',type);
   x.upload.onprogress=e=>{if(e.lengthComputable)say(c,'YouTube-এ আপলোড হচ্ছে... '+Math.round(e.loaded/e.total*100)+'%')};
   x.onload=()=>{if(x.status<300){try{res(JSON.parse(x.responseText).id)}catch(e){rej(new Error('YouTube-এর উত্তর বোঝা যায়নি'))}}else rej(new Error(yerr(x.responseText,x.status)))};
   x.onerror=()=>rej(new Error('নেটওয়ার্ক ত্রুটি, আবার চেষ্টা করুন'));x.send(c.blob)});
  c.yt=id;c.ytp=priv;upd(c);await saveHist(c)}
 catch(e){say(c,'YouTube ত্রুটি: '+(e.message||e));setTimeout(()=>upd(c),8000)}
}

async function saveHist(c){
 try{const t=tok();if(!t||!SBU())return;
  const row={title:c.title,post:c.post||'',src:src.type=='url'?$('#sh_url').value.trim():(src.file&&src.file.name)||'',start_s:c.start,end_s:c.end,file:c.file||'',yt_id:c.yt||null,privacy:c.ytp||null};
  const h={apikey:SBK(),Authorization:'Bearer '+t,'Content-Type':'application/json'};
  if(c.hid)await fetch(SBU()+'/rest/v1/shorts_history?id=eq.'+c.hid,{method:'PATCH',headers:h,body:JSON.stringify(row)});
  else{const r=await fetch(SBU()+'/rest/v1/shorts_history',{method:'POST',headers:Object.assign({Prefer:'return=representation'},h),body:JSON.stringify(row)});const j=await r.json();if(j&&j[0])c.hid=j[0].id}}
 catch(e){}
}

window.openShorts=open;
})();
