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
  catch { throw new Error(url.includes('prospeo.io') ? 'HomeScout could not connect to Prospeo. Check server network access and try again.' : url.includes('places.googleapis.com') ? 'HomeScout could not connect to Google Places. Check server network access and try again.' : url.includes('resend.com') ? 'HomeScout could not connect to Resend. Check server network access and try again.' : 'HomeScout could not connect to Foursquare. Check server network access and try again.'); }
  const raw = await r.text(); let data = {}; try { data = JSON.parse(raw); } catch {}
  if (!r.ok) {
    if (url.includes('prospeo.io') && data.error === true) {
      const code=String(data.error_code||'unknown').toUpperCase();
      if (['NO_RESULTS','NO_MATCH'].includes(code)) return data;
      const detail=data.filter_error || data.message || "Check API access and account limits.";
      const message=/RATE.?LIMIT/.test(code)?'Prospeo rate limit reached. Wait before trying another email lookup.':code==='INSUFFICIENT_CREDITS'?'Prospeo credits are exhausted. Check the account balance and plan.':"Prospeo API error ("+code+"): "+detail;
      const error=new Error(message);
      error.provider='prospeo'; error.providerStatus=r.status; error.providerCode=code;
      if (/RATE.?LIMIT/.test(code)) error.providerStatus=429;
      else if (code==='INSUFFICIENT_CREDITS') error.providerStatus=402;
      else if (code==='INVALID_API_KEY') error.providerStatus=401;
      else if (code==='PLAN_REQUIRED') error.providerStatus=403;
      else if (code==='INVALID_FILTERS') error.providerStatus=400;
      throw error;
    }
    if (url.includes('places.googleapis.com')) {
      const detail=data.error?.message||data.message||'';
      if(r.status===401) throw new Error('Google Places rejected the API key. Check GOOGLE_PLACES_API_KEY.');
      if(r.status===403) throw new Error('Google Places denied this request. Enable Places API (New) and billing for the Google Cloud project.');
      if(r.status===429) throw new Error('Google Places rate limit reached. Check your Google Cloud quota.');
      throw new Error(`Google Places API error (${r.status}): ${detail||'Check the request and API configuration.'}`);
    }
    if (r.status === 401 && url.includes('prospeo.io')) throw new Error('Prospeo rejected the request. Check PROSPEO_API_KEY in the server environment.');
    if (r.status === 403 && url.includes('prospeo.io')) throw new Error('Prospeo denied this API request. Check API access and plan eligibility.');
    if (r.status === 402 && url.includes('prospeo.io')) throw new Error('Prospeo requires available credits or a plan with API access. Check your Prospeo account.');
    if (r.status === 429 && url.includes('prospeo.io')) throw new Error('Prospeo rate limit reached. Wait before retrying.');
    if (r.status === 403 && url.includes('foursquare.com')) throw new Error('Foursquare denied this search (403). Check Places API access for this key.');
    if (r.status === 401 && url.includes('foursquare.com')) throw new Error('Foursquare rejected this key (401). Use a Service API Key from your Foursquare Developer Console.');
    if (r.status === 429 && url.includes('foursquare.com')) throw new Error('Foursquare returned 429: this key or project has reached its Places API usage limit. Check Foursquare API Usage; a new key may share the same project limit.');
    const detail = data.error?.message || data.message || data.error_description || '';
    throw new Error(detail || `Provider returned ${r.status}`);
  }
  return data;
}

let prospeoQueue=Promise.resolve();
let lastProspeoRequestAt=0;
function prospeoApi(url,init) {
  const task=prospeoQueue.then(async()=>{
    const configured=Number(process.env.PROSPEO_MIN_INTERVAL_MS);
    const minInterval=Number.isFinite(configured)&&configured>=1000?configured:3100;
    const wait=Math.max(0,lastProspeoRequestAt+minInterval-Date.now());
    if(wait) await new Promise(resolve=>setTimeout(resolve,wait));
    lastProspeoRequestAt=Date.now();
    return api(url,init);
  });
  prospeoQueue=task.catch(()=>{});
  return task;
}

const MULTI_PART_PUBLIC_SUFFIXES = new Set(['co.uk','org.uk','ac.uk','com.au','net.au','org.au','co.nz','co.in','co.jp','co.kr','com.br','com.mx','com.sg','com.tr','co.za']);
const HOSTED_SITE_SUFFIXES = ['wixsite.com','wordpress.com','blogspot.com','placeweb.site','myshopify.com','square.site','webflow.io','godaddysites.com','weebly.com','squarespace.com','jimdofree.com','sites.google.com','carrd.co','strikingly.com','site123.me','webnode.page','webnode.com','wix.com','ecwid.com'];
function normalizeBusinessDomain(input) {
  const value=String(input||'').trim();
  if(!value) return null;
  let hostname;
  try { hostname=new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(value)?value:`https://${value}`).hostname.toLowerCase().replace(/\.$/,''); }
  catch { return null; }
  hostname=hostname.replace(/^www\./,'');
  const labels=hostname.split('.');
  if(labels.length<2||labels.some(label=>!/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(label))) return null;
  const suffixTwo=labels.slice(-2).join('.');
  const rootLabelCount=MULTI_PART_PUBLIC_SUFFIXES.has(suffixTwo)?3:2;
  if(labels.length<rootLabelCount) return null;
  const domain=labels.slice(-rootLabelCount).join('.');
  const hostedSubdomain=HOSTED_SITE_SUFFIXES.some(suffix=>hostname.endsWith(`.${suffix}`));
  return {domain,hostedSubdomain};
}

async function handleRequest(req,res) {
  const pathname = new URL(req.url, 'http://localhost').pathname;
  if (req.method === 'OPTIONS') { res.writeHead(204, {...localCorsHeaders(req.headers.origin),'access-control-allow-methods':'GET,POST,OPTIONS','access-control-allow-headers':'content-type'}); return res.end(); }
  if (pathname.startsWith('/api/')) {
    try {
      if (pathname === '/api/config' && req.method === 'GET') return json(req,res,200,{ foursquare:!!process.env.FOURSQUARE_API_KEY, google:!!process.env.GOOGLE_PLACES_API_KEY, prospeo:!!process.env.PROSPEO_API_KEY, resend:false, demo:!(process.env.FOURSQUARE_API_KEY||process.env.GOOGLE_PLACES_API_KEY) });
      if (pathname === '/api/search' && req.method === 'POST') {
        if (!process.env.FOURSQUARE_API_KEY && !process.env.GOOGLE_PLACES_API_KEY) return json(req,res,503,{error:'Buyer search is not configured. Add FOURSQUARE_API_KEY or GOOGLE_PLACES_API_KEY to the server environment.'});
        const b=await body(req),city=String(b.city||'').trim(),productCategory=String(b.productCategory||'Votive candle holders').trim(),buyerType=String(b.buyerType||'votive candle holders').trim();
        if(!city||city.length>100) return json(req,res,400,{error:'Enter an Alaska city.'});
        if(productCategory.length>100||buyerType.length>100) return json(req,res,400,{error:'Choose a valid product category and buyer keyword.'});
        const searchText=`${buyerType} ${productCategory}`;
        const jobs=[];
        if(process.env.FOURSQUARE_API_KEY) jobs.push((async()=>{
          const query=new URLSearchParams({query:searchText,near:`${city}, Alaska, United States`,limit:'50',fields:'fsq_place_id,name,location,website,tel,categories'});
          const result=await api(`https://places-api.foursquare.com/places/search?${query}`,{headers:{'Accept':'application/json','Authorization':`Bearer ${process.env.FOURSQUARE_API_KEY}`,'X-Places-Api-Version':'2025-06-17'}});
          return (result.results||[]).filter(p=>!/repair|home care|security|health|office/i.test([p.name,...(p.categories||[]).map(c=>c.name)].join(' '))).map((p,i)=>({id:p.fsq_place_id||`foursquare-${i}`,name:p.name||'Retailer',address:p.location?.formatted_address||[p.location?.locality,p.location?.region,p.location?.country].filter(Boolean).join(', ')||city,website:p.website||'',phone:p.tel||'',maps:'',type:(p.categories||[]).map(c=>c.name).filter(Boolean).join(', ')||buyerType,rating:null,reviews:0,domain:p.website||''}));
        })());
        if(process.env.GOOGLE_PLACES_API_KEY) jobs.push((async()=>{
          const result=await api('https://places.googleapis.com/v1/places:searchText',{method:'POST',headers:{'Content-Type':'application/json','X-Goog-Api-Key':process.env.GOOGLE_PLACES_API_KEY,'X-Goog-FieldMask':'places.id,places.displayName,places.formattedAddress,places.websiteUri,places.nationalPhoneNumber,places.types'},body:JSON.stringify({textQuery:`${searchText} in ${city}, Alaska, United States`,pageSize:20,regionCode:'US',languageCode:'en'})});
          return (result.places||[]).map((p,i)=>({id:`google-${p.id||i}`,name:p.displayName?.text||'Retailer',address:p.formattedAddress||`${city}, Alaska, United States`,website:p.websiteUri||'',phone:p.nationalPhoneNumber||'',maps:'',type:(p.types||[]).map(t=>t.replace(/_/g,' ')).join(', ')||buyerType,rating:null,reviews:0,domain:p.websiteUri||''}));
        })());
        const settled=await Promise.allSettled(jobs),warnings=[],all=[];
        for(const result of settled){if(result.status==='fulfilled')all.push(...result.value);else warnings.push(result.reason?.message||'A search provider failed.')}
        if(!all.length&&warnings.length) throw new Error(warnings.join('; '));
        const merged=new Map();
        for(const p of all){
          const normalized=normalizeBusinessDomain(p.website),domain=normalized&&!normalized.hostedSubdomain?normalized.domain:'';
          const key=domain||`${String(p.name||'').toLowerCase().trim()}|${String(p.address||'').toLowerCase().trim()}`;
          const current=merged.get(key);
          if(!current) merged.set(key,p);
          else {if(!current.website&&p.website)current.website=p.website;if(!current.phone&&p.phone)current.phone=p.phone;if((!current.type||current.type==='Retail prospect')&&p.type)current.type=p.type;}
        }
        return json(req,res,200,{prospects:[...merged.values()],warnings});
      }
      if (pathname === '/api/contacts' && req.method === 'POST') {
        if (!process.env.PROSPEO_API_KEY) return json(req,res,503,{error:'Prospeo is not configured. Add PROSPEO_API_KEY as a server-side environment variable, then redeploy.'});
        const b=await body(req),normalized=normalizeBusinessDomain(b.domain),domain=normalized?.domain;
        if (!domain) return json(req,res,400,{error:'This prospect has no valid website domain.'});
        if (normalized.hostedSubdomain) return json(req,res,200,{domain,emails:[],pending:false,contactType:'buyer',reason:'Prospeo cannot search this hosted-site subdomain. Use the business’s own domain if available.'});
        const headers={'Content-Type':'application/json','Accept':'application/json','X-KEY':process.env.PROSPEO_API_KEY};
        // Avoid over-filtering by title: small shops often do not publish buyer titles.
        const search=await prospeoApi('https://api.prospeo.io/search-person',{method:'POST',headers,body:JSON.stringify({page:1,filters:{company:{websites:{include:[domain]}},person_contact_details:{email:['VERIFIED']},max_person_per_company:3}})});
        const rows=(search.results||[]).map(row=>({person:row.person||{},company:row.company||{}})).filter(row=>row.person.person_id);
        const candidates=rows.filter(row=>row.person.email?.status==='VERIFIED').slice(0,3);
        if(!candidates.length) return json(req,res,200,{domain,emails:[],pending:false,contactType:'buyer',searched:rows.length,reason:rows.length?'Prospeo returned people for this domain, but none had a verified work email.':'Prospeo has no verified-email people linked to this root domain. Check that the buyer website is their own domain; Prospeo cannot match hosted-site subdomains.'});
        const emails=[];
        for(const row of candidates) {
          const person=row.person,companyWebsite=row.company.website||domain;
          const enriched=await prospeoApi('https://api.prospeo.io/enrich-person',{method:'POST',headers,body:JSON.stringify({only_verified_email:true,data:{person_id:person.person_id,company_website:companyWebsite}})});
          const contact=enriched.person||{},email=contact.email?.revealed?contact.email.email:'';
          if(email&&!emails.some(item=>item.email.toLowerCase()===email.toLowerCase())) emails.push({email,firstName:contact.first_name||person.first_name||'',lastName:contact.last_name||person.last_name||'',position:contact.current_job_title||person.current_job_title||'',type:'buyer',verification:contact.email.status||'unknown'});
        }
        return json(req,res,200,{domain,emails,pending:false,contactType:'buyer',searched:rows.length,checked:candidates.length,reason:emails.length?'':`Prospeo found ${candidates.length} verified-email profiles at this domain, but enrichment did not reveal an address. Check Prospeo plan/credits or the returned company domain.`});
      }
      if (pathname === '/api/send' && req.method === 'POST') {
        return json(req,res,403,{error:'Direct sending to buyer-finder contacts is disabled. Resend prohibits unsolicited cold outreach. Use the one-to-one email draft only for recipients who agreed to hear from you.'});
      }
      return json(req,res,404,{error:'API route not found.'});
    } catch(e) {
      const message=e.message==='fetch failed'?'HomeScout could not reach the provider. Check server network access and restart the server.':(e.message||'API request failed.');
      const status=e.providerStatus||(/rate.?limit/i.test(message)?429:/available credits|insufficient credits/i.test(message)?402:/Google Places rejected the API key|Prospeo rejected the request|INVALID_API_KEY|API key/i.test(message)?401:/Google Places denied|denied this API request|plan required|PLAN_REQUIRED/i.test(message)?403:/invalid[_ ]filters|INVALID_FILTERS/i.test(message)?400:502);
      console.error('[api] request failed',{route:pathname,status,message});
      return json(req,res,status,{error:message});
    }
  }
  let file = pathname === '/' ? 'index.html' : decodeURIComponent(pathname.slice(1));
  const target=path.resolve(root,file);
  if (!target.startsWith(root + path.sep) || !fs.existsSync(target) || fs.statSync(target).isDirectory()) { res.writeHead(404); return res.end('Not found'); }
  res.writeHead(200,{'content-type':mime[path.extname(target)] || 'application/octet-stream','x-content-type-options':'nosniff'}); fs.createReadStream(target).pipe(res);
}

const server = http.createServer(handleRequest);
module.exports = { handleRequest };
if (require.main === module) server.listen(PORT,()=>console.log(`HomeScout running at http://localhost:${PORT}`));






