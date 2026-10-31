/* Shows the signed-in customer email (or a Sign in link) on every page. Account page keeps its own header. */
(function(){
  if(/account\.html$/i.test(location.pathname)||document.getElementById('shsn'))return;
  var s=null;try{s=JSON.parse(localStorage.getItem('sh_cs')||'null')}catch(e){}
  var email=s&&s.user&&s.user.email?String(s.user.email):'';
  var st=document.createElement('style');
  st.textContent='#shsn{position:fixed;right:14px;bottom:14px;z-index:60;display:flex;align-items:center;gap:8px;max-width:calc(100vw - 28px);padding:8px 14px;border-radius:999px;background:rgba(20,22,32,.92);border:1px solid rgba(255,210,63,.45);color:#f2f3f7;font:600 13px/1.2 system-ui,-apple-system,Segoe UI,sans-serif;text-decoration:none;box-shadow:0 6px 22px rgba(0,0,0,.35);backdrop-filter:blur(8px)}#shsn:hover{border-color:#ffd23f}#shsn i{width:8px;height:8px;border-radius:50%;background:'+(email?'#3ddc97':'#8a8fa3')+';flex:none}#shsn span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}@media print{#shsn{display:none}}';
  document.head.appendChild(st);
  var a=document.createElement('a');a.id='shsn';a.href='account.html';
  a.title=email?'Signed in as '+email+' - open my account':'Sign in to your account';
  var d=document.createElement('i'),t=document.createElement('span');
  t.textContent=email?email:'Sign in';
  a.appendChild(d);a.appendChild(t);document.body.appendChild(a);
})();
