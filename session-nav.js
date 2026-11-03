/* Shows the signed-in customer email (or a Sign in link) on every page, with a Sign out button.
   v2: reads the session the account page really saves ({at, rt, exp, email, name}); the old version looked for s.user.email
   and so always showed "Sign in". The account page keeps its own header. */
(function(){
  if(/account\.html$/i.test(location.pathname)||document.getElementById('shsn'))return;
  var s=null;try{s=JSON.parse(localStorage.getItem('sh_cs')||'null')}catch(e){}
  var email=s?String(s.email||(s.user&&s.user.email)||''):'';
  if(s&&!email&&(s.at||s.access_token))email='Signed in';
  var st=document.createElement('style');
  st.textContent='#shsn{position:fixed;right:14px;bottom:14px;z-index:60;display:flex;align-items:center;gap:6px;max-width:calc(100vw - 28px);padding:6px 8px 6px 14px;border-radius:999px;background:rgba(20,22,32,.92);border:1px solid rgba(255,210,63,.45);color:#f2f3f7;font:600 13px/1.2 system-ui,-apple-system,Segoe UI,sans-serif;box-shadow:0 6px 22px rgba(0,0,0,.35);backdrop-filter:blur(8px)}#shsn:hover{border-color:#ffd23f}#shsn a{display:flex;align-items:center;gap:8px;color:inherit;text-decoration:none;min-width:0;padding:2px 0}#shsn i{width:8px;height:8px;border-radius:50%;background:'+(email?'#3ddc97':'#8a8fa3')+';flex:none}#shsn span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}#shsn button{flex:none;cursor:pointer;border:1px solid rgba(255,255,255,.22);background:transparent;color:#f2f3f7;border-radius:999px;padding:4px 10px;font:600 12px/1 system-ui,-apple-system,Segoe UI,sans-serif}#shsn button:hover{border-color:#ff6961;color:#ff6961}@media print{#shsn{display:none}}';
  document.head.appendChild(st);
  var box=document.createElement('div');box.id='shsn';
  var a=document.createElement('a');a.href='account.html';
  a.title=email?'Signed in as '+email+' - open my account':'Sign in to your account';
  var d=document.createElement('i'),t=document.createElement('span');
  t.textContent=email?email:'Sign in';
  a.appendChild(d);a.appendChild(t);box.appendChild(a);
  if(email){
    var b=document.createElement('button');b.type='button';b.textContent='Sign out';b.title='Sign out of your account';
    b.onclick=function(){try{localStorage.removeItem('sh_cs')}catch(e){}location.reload()};
    box.appendChild(b);
  }
  document.body.appendChild(box);
})();
