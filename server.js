const http = require('http');
const fs = require('fs');
const path = require('path');

const root = __dirname;
function loadEnv() {
  try {
    for (const line of fs.readFileSync(path.join(root, '.env'), 'utf8').split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^(['"])(.*)\1$/, '$2');
    }
  } catch {}
}
loadEnv();
const PORT = Number(process.env.PORT || 3000);
const mime = { '.html':'text/html; charset=utf-8', '.css':'text/css; charset=utf-8', '.js':'text/javascript; charset=utf-8', '.json':'application/json; charset=utf-8', '.svg':'image/svg+xml' };
let snovToken = '', snovTokenExpiresAt = 0;
function localCorsHeaders(origin) {
  if (!origin) return {};
  const configuredOrigins=(process.env.APP_ORIGIN||'').split(',').map(x=>x.trim()).filter(Boolean);
  let allowed = origin === 'null' || configuredOrigins.includes(origin);
  try { const u = new URL(origin); allowed ||= ['localhost','127.0.0.1','::1'].includes(u.hostname) && ['http:','https:'].includes(u.protocol); } catch {}
  return allowed ? { 'access-control-allow-origin':origin, 'vary':'Origin' } : {};
}
function json(req, res, status, data) { res.writeHead(status, { 'content-type':'application/json; charset=utf-8', 'cache-control':'no-store', ...localCorsHeaders(req.headers.origin) }); res.end(JSON.stringify(data)); }
function body(req) { return new Promise((resolve, reject) => { let raw=''; req.on('data', x => { raw += x; if(raw.length > 1e6) req.destroy(); }); req.on('end', () => { try { resolve(JSON.parse(raw || '{}')); } catch(e) { reject(e); } }); }); }
async function api(url, init) {
  let r;
  try { r = await fetch(url, init); }
  catch { throw new Error(url.includes('snov.io') ? 'HomeScout could not connect to Snov.io. Check server network access and try again.' : url.includes('resend.com') ? 'HomeScout could not connect to Resend. Check server network access and try again.' : 'HomeScout could not connect to Foursquare. Check server network access and try again.'); }
  const raw = await r.text(); let data = {}; try { data = JSON.parse(raw); } catch {}
  if (!r.ok) {
    if (r.status === 401 && url.includes('snov.io')) throw new Error('Snov.io rejected the API credentials. Check SNOV_API_USER_ID and SNOV_API_SECRET in .env.');
    if (r.status === 403 && url.includes('snov.io')) throw new Error('Snov.io denied this request. Check that API access is enabled for this account.');
    if (r.status === 429 && url.includes('snov.io')) throw new Error('Snov.io API rate limit reached. Wait a moment and retry.');
    if (r.status === 403 && url.includes('foursquare.com')) throw new Error('Foursquare denied this search (403). Check Places API access for this key.');
    if (r.status === 401 && url.includes('foursquare.com')) throw new Error('Foursquare rejected this key (401). Use a Service API Key from your Foursquare Developer Console.');
    if (r.status === 429 && url.includes('foursquare.com')) throw new Error('Foursquare returned 429: this key or project has reached its Places API usage limit. Check Foursquare API Usage; a new key may share the same project limit.');
    const detail = data.error?.message || data.message || data.error_description || '';
    throw new Error(detail || `Provider returned ${r.status}`);
  }
  return data;
}
async function getSnovAccessToken() {
  if (!process.env.SNOV_API_USER_ID || !process.env.SNOV_API_SECRET) throw new Error('Snov.io is not configured. Add SNOV_API_USER_ID and SNOV_API_SECRET to .env.');
  if (snovToken && snovTokenExpiresAt > Date.now() + 60000) return snovToken;
  const form = new URLSearchParams({grant_type:'client_credentials',client_id:process.env.SNOV_API_USER_ID,client_secret:process.env.SNOV_API_SECRET});
  const auth = await api('https://api.snov.io/v1/oauth/access_token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:form});
  if (!auth.access_token) throw new Error('Snov.io did not return an access token. Verify the API User ID and API Secret.');
  snovToken = auth.access_token;
  snovTokenExpiresAt = Date.now() + Number(auth.expires_in || 3600) * 1000;
  return snovToken;
}
async function pollSnovResult(url, token) {
  const target=new URL(url);
  if(target.origin!=='https://api.snov.io') throw new Error('Snov.io returned an invalid results URL.');
  let result={status:'in progress',data:[]};
  for(let i=0;i<10;i++){
    await new Promise(resolve=>setTimeout(resolve,i===0?250:800));
    result=await api(target.toString(),{headers:{'Authorization':`Bearer ${token}`}});
    if(result.status==='completed') break;
  }
  return result;
}
const server = http.createServer(async (req,res) => {
  const pathname = new URL(req.url, 'http://localhost').pathname;
  if (req.method === 'OPTIONS') { res.writeHead(204, {...localCorsHeaders(req.headers.origin),'access-control-allow-methods':'GET,POST,OPTIONS','access-control-allow-headers':'content-type'}); return res.end(); }
  if (pathname.startsWith('/api/')) {
    try {
      if (pathname === '/api/config' && req.method === 'GET') return json(req,res,200,{ foursquare:!!process.env.FOURSQUARE_API_KEY, snov:!!(process.env.SNOV_API_USER_ID && process.env.SNOV_API_SECRET), resend:!!(process.env.RESEND_API_KEY && process.env.SENDER_EMAIL && !process.env.SENDER_EMAIL.includes('your-verified-domain.com')), demo:!process.env.FOURSQUARE_API_KEY });
      if (pathname === '/api/search' && req.method === 'POST') {
        if (!process.env.FOURSQUARE_API_KEY) return json(req,res,503,{error:'Foursquare is not configured. Add FOURSQUARE_API_KEY to .env.'});
        const b = await body(req); const city = String(b.city || '').trim(); const category = String(b.category || 'home decor stores').trim();
        if (!city || city.length > 100) return json(req,res,400,{error:'Enter a US city.'});
        const categoryKey = category.toLowerCase();
        const searchText = categoryKey.includes('furniture') ? 'furniture' : categoryKey.includes('interior') ? 'interior design' : categoryKey.includes('gift') ? 'gift store' : 'home decor furniture';
        const query = new URLSearchParams({query:searchText,near:`${city}, United States`,limit:'25',fields:'fsq_place_id,name,location,website,tel,categories'});
        if (categoryKey.includes('gift')) query.set('fsq_category_ids','4bf58dd8d48988d128951735');
        else if (!categoryKey.includes('interior')) query.set('fsq_category_ids','4bf58dd8d48988d1f8941735');
        const result = await api(`https://places-api.foursquare.com/places/search?${query}`,{headers:{'Accept':'application/json','Authorization':`Bearer ${process.env.FOURSQUARE_API_KEY}`,'X-Places-Api-Version':'2025-06-17'}});

        const places = result.results || [];
        const relevant = places.filter(p => !/repair|home care|security|health|office/i.test([p.name,...(p.categories||[]).map(c=>c.name)].join(' ')));
        const prospects = relevant.map((p,i) => ({id:p.fsq_place_id || `foursquare-${i}`,name:p.name || 'Retailer',address:p.location?.formatted_address || [p.location?.locality,p.location?.region,p.location?.country].filter(Boolean).join(', ') || city,website:p.website || '',phone:p.tel || '',maps:'',type:(p.categories || []).map(c=>c.name).filter(Boolean).join(', ') || category,rating:null,reviews:0,domain:p.website || ''}));
        return json(req,res,200,{prospects});
      }      if (pathname === '/api/contacts' && req.method === 'POST') {
        const b=await body(req); const domain=String(b.domain || '').toLowerCase().replace(/^https?:\/\//,'').split('/')[0].replace(/^www\./,'');
        if (!/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(domain)) return json(req,res,400,{error:'This prospect has no valid website domain.'});
        const token=await getSnovAccessToken();
        const form=new URLSearchParams({domain,page:'1'});
        ['Buyer','Purchasing Manager','Merchandising Manager','Owner','Founder','President'].forEach(position=>form.append('positions[]',position));
        const started=await api('https://api.snov.io/v2/domain-search/prospects/start',{method:'POST',headers:{'Authorization':`Bearer ${token}`,'Content-Type':'application/x-www-form-urlencoded'},body:form});
        const prospectTask=started.meta?.task_hash;
        if(!prospectTask) throw new Error('Snov.io did not start a buyer search for this domain.');
        const prospects=await pollSnovResult(started.links?.result||`https://api.snov.io/v2/domain-search/prospects/result/${encodeURIComponent(prospectTask)}`,token);
        const candidates=Array.isArray(prospects.data)?prospects.data:[];
        const prospect=candidates.find(p=>p.search_emails_start);
        if(!prospect){
          if(prospects.status!=='completed') return json(req,res,200,{domain,emails:[],pending:true});
          const genericStart=await api('https://api.snov.io/v2/domain-search/domain-emails/start',{method:'POST',headers:{'Authorization':`Bearer ${token}`,'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({domain})});
          const genericTask=genericStart.meta?.task_hash;
          if(!genericTask) throw new Error('Snov.io did not start a company-email fallback search.');
          const generic=await pollSnovResult(genericStart.links?.result||`https://api.snov.io/v2/domain-search/domain-emails/result/${encodeURIComponent(genericTask)}`,token);
          const rows=Array.isArray(generic.data)?generic.data:(generic.data?.emails||[]);
          const emails=rows.map(x=>({email:x.email||x.value||'',firstName:'',lastName:'',position:'',type:'general',verification:x.smtp_status||x.verification||'unknown'})).filter(x=>x.email);
          return json(req,res,200,{domain,emails,pending:generic.status!=='completed',contactType:'general'});
        }
        const emailStartUrl=new URL(prospect.search_emails_start);
        if(emailStartUrl.origin!=='https://api.snov.io'||!emailStartUrl.pathname.startsWith('/v2/domain-search/prospects/search-emails/start/')) throw new Error('Snov.io returned an invalid prospect email lookup URL.');
        const emailStarted=await api(emailStartUrl.toString(),{method:'POST',headers:{'Authorization':`Bearer ${token}`,'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams()});
        const emailTask=emailStarted.meta?.task_hash;
        if(!emailTask) throw new Error('Snov.io did not start email enrichment for the matching buyer.');
        const enriched=await pollSnovResult(emailStarted.links?.result||`https://api.snov.io/v2/domain-search/prospects/search-emails/result/${encodeURIComponent(emailTask)}`,token);
        const rows=Array.isArray(enriched.data)?enriched.data:(enriched.data?.emails||[]);
        const emails=rows.map(x=>({email:x.email||x.value||'',firstName:prospect.first_name||'',lastName:prospect.last_name||'',position:prospect.position||'',type:'buyer',verification:x.smtp_status||x.verification||'unknown'})).filter(x=>x.email);
        return json(req,res,200,{domain,emails,pending:prospects.status!=='completed'||enriched.status!=='completed',contactType:'buyer'});
      }
      if (pathname === '/api/send' && req.method === 'POST') {
        if (!process.env.RESEND_API_KEY || !process.env.SENDER_EMAIL) return json(req,res,503,{error:'Resend is not configured. Add RESEND_API_KEY and SENDER_EMAIL to .env.'});
        const b=await body(req); const to=String(b.to || '').trim(), subject=String(b.subject || '').trim(), text=String(b.text || '').trim();
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to) || !subject || !text) return json(req,res,400,{error:'Add a valid recipient, subject, and message.'});
        if(subject.length>200 || text.length>10000) return json(req,res,400,{error:'Subject or message is too long.'});
        const result=await api('https://api.resend.com/emails',{method:'POST',headers:{'Authorization':`Bearer ${process.env.RESEND_API_KEY}`,'Content-Type':'application/json'},body:JSON.stringify({from:process.env.SENDER_EMAIL,to:[to],subject,text})});
        if (!result.id) throw new Error('Resend did not confirm the message. Check your Resend account and verified sender.');
        return json(req,res,200,{id:result.id,message:'Email accepted by Resend.'});
      }
      return json(req,res,404,{error:'API route not found.'});
    } catch(e) { const message=e.message === 'fetch failed' ? 'HomeScout could not reach the provider. Check server network access and restart the server.' : (e.message || 'API request failed.'); return json(req,res,502,{error:message}); }
  }
  let file = pathname === '/' ? 'index.html' : decodeURIComponent(pathname.slice(1));
  const target=path.resolve(root,file);
  if (!target.startsWith(root + path.sep) || !fs.existsSync(target) || fs.statSync(target).isDirectory()) { res.writeHead(404); return res.end('Not found'); }
  res.writeHead(200,{'content-type':mime[path.extname(target)] || 'application/octet-stream','x-content-type-options':'nosniff'}); fs.createReadStream(target).pipe(res);
});
server.listen(PORT,()=>console.log(`HomeScout running at http://localhost:${PORT}`));