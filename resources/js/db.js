/* Data layer backed by Google Sheets through an Apps Script web app.
   Paste your deployed web app URL (ends with /exec) below. */
const API='PASTE_YOUR_WEB_APP_URL_HERE';
const DB={
  T:'danesh_token',
  async call(body){
    try{
      // text/plain avoids a CORS preflight, which Apps Script does not answer
      const r=await fetch(API,{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify(body)});
      return await r.json();
    }catch(e){return{ok:false,net:true,m:'ارتباط با سرور برقرار نشد. دوباره تلاش کنید.'}}
  },
  async register(name,email,password){const r=await this.call({action:'register',name,email,password});if(r.ok)localStorage.setItem(this.T,r.token);return r},
  async login(email,password){const r=await this.call({action:'login',email,password});if(r.ok)localStorage.setItem(this.T,r.token);return r},
  async current(){
    const t=localStorage.getItem(this.T);if(!t)return null;
    const r=await this.call({action:'me',token:t});
    if(r.ok)return r.user;
    if(!r.net)localStorage.removeItem(this.T);
    return null;
  },
  async logout(){const t=localStorage.getItem(this.T);localStorage.removeItem(this.T);if(t)await this.call({action:'logout',token:t})},
  addMessage(m){return this.call({action:'contact',...m})},
  requestReset(email){return this.call({action:'reset_request',email})},
  confirmReset(email,code,password){return this.call({action:'reset_confirm',email,code,password})},
  rename(name){return this.call({action:'rename',token:localStorage.getItem(this.T),name})},
  async deleteAccount(password){const r=await this.call({action:'delete',token:localStorage.getItem(this.T),password});if(r.ok)localStorage.removeItem(this.T);return r}
};
