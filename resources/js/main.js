const $=s=>document.querySelector(s);
const burger=$('.burger'),nav=$('#nav');
burger.onclick=()=>burger.setAttribute('aria-expanded',nav.classList.toggle('open'));
const say=(el,t,ok)=>{el.textContent=t;el.className='msg '+(ok?'ok':'err')};
// disables the submit button while a request is running
const run=async(form,fn)=>{const b=form.querySelector('button');b.disabled=true;try{await fn(form.elements)}finally{b.disabled=false}};
const pv=$('#profile-view');
if(pv){
  let rmail='';
  const show=id=>{['#f-reg','#f-login','#reset'].forEach(s=>$(s).hidden=s!==id);$('.tabs').hidden=id==='#reset';
    document.querySelectorAll('.tab').forEach(x=>x.classList.toggle('on',x.dataset.t===(id==='#f-login'?'login':'reg')))};
  const render=async()=>{
    const u=await DB.current();$('#auth').hidden=!!u;pv.hidden=!u;
    if(u){$('#p-name').textContent=u.name;$('#p-email').textContent=u.email;
      $('#p-date').textContent=new Date(u.created).toLocaleDateString('fa-IR');$('#f-name').elements.fullname.value=u.name}};
  document.querySelectorAll('.tab').forEach(t=>t.onclick=()=>show(t.dataset.t==='reg'?'#f-reg':'#f-login'));
  $('#f-reg').onsubmit=e=>{e.preventDefault();run(e.target,async f=>{
    const r=await DB.register(f.fullname.value,f.email.value,f.password.value);
    say($('#reg-msg'),r.m,r.ok);if(r.ok){e.target.reset();render()}})};
  $('#f-login').onsubmit=e=>{e.preventDefault();run(e.target,async f=>{
    const r=await DB.login(f.email.value,f.password.value);
    say($('#login-msg'),r.m,r.ok);if(r.ok){e.target.reset();render()}})};
  // password reset: request a code by email, then set a new password
  $('#forgot').onclick=()=>{show('#reset');$('#f-conf').hidden=true};
  document.querySelectorAll('.back').forEach(b=>b.onclick=()=>show('#f-login'));
  $('#f-req').onsubmit=e=>{e.preventDefault();run(e.target,async f=>{
    const r=await DB.requestReset(f.email.value);
    say($('#req-msg'),r.m,r.ok);if(r.ok){rmail=f.email.value;$('#f-conf').hidden=false}})};
  $('#f-conf').onsubmit=e=>{e.preventDefault();run(e.target,async f=>{
    const r=await DB.confirmReset(rmail,f.code.value,f.password.value);
    say($('#conf-msg'),r.m,r.ok);
    if(r.ok){e.target.reset();show('#f-login');say($('#login-msg'),r.m,true)}})};
  // account management
  $('#f-name').onsubmit=e=>{e.preventDefault();run(e.target,async f=>{
    const r=await DB.rename(f.fullname.value);say($('#name-msg'),r.m,r.ok);if(r.ok)render()})};
  $('#f-del').onsubmit=e=>{e.preventDefault();run(e.target,async f=>{
    if(!confirm('حساب شما برای همیشه حذف می‌شود. ادامه می‌دهید؟'))return;
    const r=await DB.deleteAccount(f.password.value);say($('#del-msg'),r.m,r.ok);
    if(r.ok){e.target.reset();await render();show('#f-login');say($('#login-msg'),r.m,true)}})};
  $('#logout').onclick=async()=>{await DB.logout();render()};
  render();
}
const cf=$('#f-contact');
if(cf)cf.onsubmit=e=>{e.preventDefault();run(e.target,async f=>{
  const r=await DB.addMessage({name:f.fullname.value,email:f.email.value,text:f.text.value});
  say($('#c-msg'),r.m,r.ok);if(r.ok)e.target.reset()})};
// announcement bar: rotating messages loaded from resources/database/announcements.json
const ann=$('#ann');
if(ann&&!sessionStorage.getItem('ann-x')){
  fetch('resources/database/announcements.json').then(r=>r.json()).then(list=>{
    const items=list.filter(a=>!a.until||new Date(a.until+'T23:59:59')>=new Date());
    if(!items.length)return;
    const p=ann.querySelector('p');let i=0,t;
    const draw=()=>{const a=items[i];p.textContent=a.text+' ';
      if(a.link){const l=document.createElement('a');l.href=a.link;l.textContent=a.label||'بیشتر';p.append(l)}};
    const next=()=>{p.classList.add('out');setTimeout(()=>{i=(i+1)%items.length;draw();p.classList.remove('out')},400)};
    const play=()=>{if(items.length>1)t=setInterval(next,8000)};
    draw();ann.hidden=false;play();
    ann.onmouseenter=()=>clearInterval(t);ann.onmouseleave=play;
  }).catch(()=>{});
  ann.querySelector('button').onclick=()=>{ann.hidden=true;sessionStorage.setItem('ann-x','1')};
}
// image slider (right-to-left): arrows, dots, swipe, autoplay that pauses on hover
const sl=$('.slider');
if(sl){
  const tr=sl.querySelector('.track'),n=tr.children.length,dots=sl.querySelector('.dots');let i=0,t;
  const go=k=>{i=(k+n)%n;tr.style.transform='translateX('+i*100+'%)';[...dots.children].forEach((d,x)=>d.classList.toggle('on',x===i))};
  for(let k=0;k<n;k++){const d=document.createElement('button');d.setAttribute('aria-label','تصویر '+(k+1));d.onclick=()=>go(k);dots.append(d)}
  const play=()=>{if(!matchMedia('(prefers-reduced-motion:reduce)').matches)t=setInterval(()=>go(i+1),5000)};
  sl.querySelector('.next').onclick=()=>go(i+1);sl.querySelector('.prev').onclick=()=>go(i-1);
  sl.onmouseenter=()=>clearInterval(t);sl.onmouseleave=play;
  let x0;sl.ontouchstart=e=>x0=e.touches[0].clientX;
  sl.ontouchend=e=>{const d=e.changedTouches[0].clientX-x0;if(Math.abs(d)>40)go(i+(d<0?1:-1))};
  go(0);play();
}
// footer badges: code pasted into resources/database/badges.html is loaded into every page (scripts are executed)
const bd=$('#badges');
if(bd)fetch('resources/database/badges.html').then(r=>r.ok?r.text():'').then(h=>{
  const tpl=document.createElement('template');tpl.innerHTML=h;
  if(!tpl.content.children.length){bd.parentElement.hidden=true;return}
  const scripts=[...tpl.content.querySelectorAll('script')];
  scripts.forEach(o=>o.remove());bd.append(tpl.content);
  scripts.forEach(o=>{const s=document.createElement('script');
    [...o.attributes].forEach(a=>s.setAttribute(a.name,a.value));s.textContent=o.textContent;bd.append(s)});
}).catch(()=>{bd.parentElement.hidden=true});
// enrollment page: show the chosen course
const ec=$('#enr-course');
if(ec){
  const t = {
    1:'علوم کامپیوتر',
    2:'شبکه‌های کامپیوتری',
    3:'زیرساخت کامپیوتر'
  }[new URLSearchParams(location.search).get('course')];
  if(typeof t==='string'){ec.textContent='دوره انتخاب‌شده: '+t;ec.hidden=false}
}
