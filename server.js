const http = require('http');
const fs = require('fs');
const path = require('path');

const projectRoot = __dirname;
const root = path.join(projectRoot, 'public');
function loadEnv() {
  for (const envFile of [path.join(projectRoot, '.env'), path.join(projectRoot, 'outputs', 'homescout', '.env')]) {
    try {
      for (const line of fs.readFileSync(envFile, 'utf8').split(/\r?\n/)) {
        const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
        if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^(['"])(.*)\1$/, '$2');
      }
    } catch {}
  }
}
loadEnv();
const PORT = Number(process.env.PORT || 3000);
const mime = { '.html':'text/html; charset=utf-8', '.css':'text/css; charset=utf-8', '.js':'text/javascript; charset=utf-8', '.json':'application/json; charset=utf-8', '.svg':'image/svg+xml' };
function localCorsHeaders(origin) {
  if (!origin) return {};
  const configuredOrigins=(process.env.APP_ORIGIN||'').split(',').map(x=>x.trim()).filter(Boolean);
  let allowed = origin === 'null' || configuredOrigins.includes(origin);
  try { const u = new URL(origin); allowed ||= ['localhost','127.0.0.1','::1'].includes(u.hostname) && ['http:','https:'].includes(u.protocol); } catch {}
  return allowed ? { 'access-control-allow-origin':origin, 'vary':'Origin' } : {};
}
function json(req, res, status, data) { res.writeHead(status, { 'content-type':'application/json; charset=utf-8', 'cache-control':'no-store', ...localCorsHeaders(req.headers.origin) }); res.end(JSON.stringify(data)); }
function body(req) {
  if (req.body && typeof req.body === 'object') return Promise.resolve(req.body);
  return new Promise((resolve, reject) => { let raw=''; req.on('data', x => { raw += x; if(raw.length > 1e6) req.destroy(); }); req.on('end', () => { try { resolve(JSON.parse(raw || '{}')); } catch(e) { reject(e); } }); });
}
async function api(url, init) {
  let r;
  try { r = await fetch(url, init); }
  catch { throw new Error(url.includes('api.apollo.io') ? 'HomeScout could not connect to Apollo. Check server network access and try again.' : url.includes('resend.com') ? 'HomeScout could not connect to Resend. Check server network access and try again.' : 'HomeScout could not connect to Foursquare. Check server network access and try again.'); }
  const raw = await r.text(); let data = {}; try { data = JSON.parse(raw); } catch {}
  if (!r.ok) {
    if (url.includes('api.apollo.io') && r.status === 401) throw new Error('Apollo rejected APOLLO_API_KEY. Set a valid key in the server environment.');
    if (url.includes('api.apollo.io') && r.status === 403) throw new Error('Apollo denied this endpoint. Check API access for People API Search and People Enrichment and your Apollo plan.');
    if (url.includes('api.apollo.io') && r.status === 429) throw new Error('Apollo API rate limit reached. Wait a moment before trying this lookup again.');
    if (r.status === 403 && url.includes('foursquare.com')) throw new Error('Foursquare denied this search (403). Check Places API access for this key.');
    if (r.status === 401 && url.includes('foursquare.com')) throw new Error('Foursquare rejected this key (401). Use a Service API Key from your Foursquare Developer Console.');
    if (r.status === 429 && url.includes('foursquare.com')) throw new Error('Foursquare returned 429: this key or project has reached its Places API usage limit. Check Foursquare API Usage; a new key may share the same project limit.');
    const detail = data.error?.message || data.message || data.error_description || '';
    throw new Error(detail || `Provider returned ${r.status}`);
  }
  return data;
}
async function handleRequest(req,res) {
  const pathname = new URL(req.url, 'http://localhost').pathname;
  if (req.method === 'OPTIONS') { res.writeHead(204, {...localCorsHeaders(req.headers.origin),'access-control-allow-methods':'GET,POST,OPTIONS','access-control-allow-headers':'content-type'}); return res.end(); }
  if (pathname.startsWith('/api/')) {
    try {
      if (pathname === '/api/config' && req.method === 'GET') return json(req,res,200,{ foursquare:!!process.env.FOURSQUARE_API_KEY, apollo:!!process.env.APOLLO_API_KEY, resend:false, demo:!process.env.FOURSQUARE_API_KEY });
      if (pathname === '/api/search' && req.method === 'POST') {
        if (!process.env.FOURSQUARE_API_KEY) return json(req,res,503,{error:'Foursquare is not configured. Add FOURSQUARE_API_KEY to .env.'});
        const b = await body(req); const city = String(b.city || '').trim(); const productCategory=String(b.productCategory||'Votive candle holders').trim(); const buyerType=String(b.buyerType||'votive candle holders').trim();
        if (!city || city.length > 100) return json(req,res,400,{error:'Enter a US city.'});
        if(productCategory.length>100||buyerType.length>100) return json(req,res,400,{error:'Choose a valid product category and buyer keyword.'});
        const searchText = `${buyerType} ${productCategory}`;
        const query = new URLSearchParams({query:searchText,near:`${city}, Alaska, United States`,limit:'50',fields:'fsq_place_id,name,location,website,tel,categories'});
        const result = await api(`https://places-api.foursquare.com/places/search?${query}`,{headers:{'Accept':'application/json','Authorization':`Bearer ${process.env.FOURSQUARE_API_KEY}`,'X-Places-Api-Version':'2025-06-17'}});

        const places = result.results || [];
        const relevant = places.filter(p => !/repair|home care|security|health|office/i.test([p.name,...(p.categories||[]).map(c=>c.name)].join(' ')));
        const prospects = relevant.map((p,i) => ({id:p.fsq_place_id || `foursquare-${i}`,name:p.name || 'Retailer',address:p.location?.formatted_address || [p.location?.locality,p.location?.region,p.location?.country].filter(Boolean).join(', ') || city,website:p.website || '',phone:p.tel || '',maps:'',type:(p.categories || []).map(c=>c.name).filter(Boolean).join(', ') || buyerType,rating:null,reviews:0,domain:p.website || ''}));
        return json(req,res,200,{prospects});
      }      if (pathname === '/api/contacts' && req.method === 'POST') {
        const b=await body(req);
        const domain=String(b.domain||'').toLowerCase().replace(/^https?:\/\//,'').split('/')[0].replace(/^www\./,'');
        const company=String(b.company||'').trim().slice(0,160);
        if(!/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(domain)) return json(req,res,400,{error:'This prospect has no valid website domain.'});
        if(!process.env.APOLLO_API_KEY) return json(req,res,503,{error:'Apollo is not configured. Add APOLLO_API_KEY to the server environment.'});
        const headers={'accept':'application/json','content-type':'application/json','cache-control':'no-cache','x-api-key':process.env.APOLLO_API_KEY};
        const params=new URLSearchParams();
        params.append('q_organization_domains_list[]',domain);
        ['Retail Buyer','Purchasing Manager','Merchandising Manager','Buyer','Category Manager','Owner','Founder','President','Store Manager','General Manager'].forEach(title=>params.append('person_titles[]',title));
        ['owner','founder','c_suite','vp','director','manager'].forEach(level=>params.append('person_seniorities[]',level));
        params.set('include_similar_titles','true'); params.set('per_page','5'); params.set('page','1');
        const search=await api('https://api.apollo.io/api/v1/mixed_people/api_search?'+params.toString(),{method:'POST',headers});
        const candidates=(Array.isArray(search.people)?search.people:[]).slice(0,3),emails=[];
        for(const candidate of candidates){
          const name=String(candidate.name||[candidate.first_name,candidate.last_name].filter(Boolean).join(' ')).trim();
          if(!name) continue;
          const matchParams=new URLSearchParams({name,domain,reveal_personal_emails:'false',reveal_phone_number:'false'});
          if(company) matchParams.set('organization_name',company);
          const match=await api('https://api.apollo.io/api/v1/people/match?'+matchParams.toString(),{method:'POST',headers});
          const person=match.person||{},email=String(person.email||'').trim();
          if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||/^email_not_unlocked@/i.test(email)) continue;
          emails.push({email,firstName:person.first_name||candidate.first_name||'',lastName:person.last_name||candidate.last_name||'',position:person.title||candidate.title||'',type:'buyer',verification:person.email_status||'unknown'});
        }
        return json(req,res,200,{domain,emails:[...new Map(emails.map(x=>[x.email.toLowerCase(),x])).values()],pending:false,contactType:'buyer'});
      }
      if (pathname === '/api/send' && req.method === 'POST') {
        return json(req,res,403,{error:'Direct sending to buyer-finder contacts is disabled. Resend prohibits unsolicited cold outreach. Use the one-to-one email draft only for recipients who agreed to hear from you.'});
      }
      return json(req,res,404,{error:'API route not found.'});
    } catch(e) { const message=e.message === 'fetch failed' ? 'HomeScout could not reach the provider. Check server network access and restart the server.' : (e.message || 'API request failed.'); const status=/rate limit reached/i.test(message)?429:/Apollo rejected/i.test(message)?401:/Apollo denied/i.test(message)?403:/Apollo is not configured/i.test(message)?503:502; console.error('[api] request failed',{route:pathname,status,message}); return json(req,res,status,{error:message}); }
  }
  let file = pathname === '/' ? 'index.html' : decodeURIComponent(pathname.slice(1));
  const target=path.resolve(root,file);
  if (!target.startsWith(root + path.sep) || !fs.existsSync(target) || fs.statSync(target).isDirectory()) { res.writeHead(404); return res.end('Not found'); }
  res.writeHead(200,{'content-type':mime[path.extname(target)] || 'application/octet-stream','x-content-type-options':'nosniff'}); fs.createReadStream(target).pipe(res);
}

const server = http.createServer(handleRequest);
module.exports = { handleRequest };
if (require.main === module) server.listen(PORT,()=>console.log(`HomeScout running at http://localhost:${PORT}`));






