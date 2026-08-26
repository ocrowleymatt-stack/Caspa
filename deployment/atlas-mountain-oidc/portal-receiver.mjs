import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';

const HOST='127.0.0.1';
const PORT=3017;
const DEPLOY_PATH='/__portal_deploy/v1';
const HEALTH_PATH='/health';
const MAX_BODY=20*1024*1024;
const ISSUER='https://token.actions.githubusercontent.com';
const JWKS_URL=`${ISSUER}/.well-known/jwks`;
const AUDIENCE='ocrowley-portal-deploy';
const REPOSITORY='ocrowleymatt-stack/ocrowley-evidence-portal';
const REPOSITORY_ID='1261391891';
const OWNER_ID='274130919';
const REF='refs/heads/main';
const WORKFLOW_REF='ocrowleymatt-stack/ocrowley-evidence-portal/.github/workflows/deploy-hetzner.yml@refs/heads/main';
const WORKFLOW_NAME='Deploy Evidence Portal to Hetzner';
const ROOT='/root/PortalDeploy';
const USED_JTI_FILE=`${ROOT}/used-jti.json`;
const INBOX=`${ROOT}/inbox`;
const RUNNER=`${ROOT}/portal-deploy-runner.sh`;
let cache={expires:0,keys:[]};

function b64url(v){let s=String(v||'').replace(/-/g,'+').replace(/_/g,'/');while(s.length%4)s+='=';return Buffer.from(s,'base64')}
function part(v){return JSON.parse(b64url(v).toString('utf8'))}
async function jwks(){if(cache.expires>Date.now()&&cache.keys.length)return cache.keys;const c=new AbortController();const t=setTimeout(()=>c.abort(),5000);try{const r=await fetch(JWKS_URL,{signal:c.signal,headers:{'User-Agent':'PortalDeploy/1.0'}});if(!r.ok)throw new Error(`jwks_http_${r.status}`);const d=await r.json();if(!Array.isArray(d.keys)||!d.keys.length)throw new Error('jwks_empty');cache={expires:Date.now()+600000,keys:d.keys};return d.keys}finally{clearTimeout(t)}}
async function verify(token){const p=String(token||'').split('.');if(p.length!==3)throw new Error('jwt_shape');const h=part(p[0]),c=part(p[1]);if(h.alg!=='RS256'||!h.kid)throw new Error('jwt_header');const k=(await jwks()).find(x=>x.kid===h.kid&&x.kty==='RSA');if(!k)throw new Error('jwt_kid');const key=crypto.createPublicKey({key:k,format:'jwk'});if(!crypto.verify('RSA-SHA256',Buffer.from(`${p[0]}.${p[1]}`),key,b64url(p[2])))throw new Error('jwt_signature');const now=Math.floor(Date.now()/1000);const aud=c.aud===AUDIENCE||(Array.isArray(c.aud)&&c.aud.includes(AUDIENCE));if(c.iss!==ISSUER)throw new Error('claim_iss');if(!aud)throw new Error('claim_aud');if(Number(c.exp)<now-15)throw new Error('claim_exp');if(Number(c.iat)>now+30)throw new Error('claim_iat');if(c.repository!==REPOSITORY)throw new Error('claim_repository');if(String(c.repository_id)!==REPOSITORY_ID)throw new Error('claim_repository_id');if(String(c.repository_owner_id)!==OWNER_ID)throw new Error('claim_owner_id');if(c.repository_visibility!=='private')throw new Error('claim_visibility');if(c.ref!==REF||c.ref_type!=='branch')throw new Error('claim_ref');if(c.workflow_ref!==WORKFLOW_REF)throw new Error('claim_workflow_ref');if(c.workflow!==WORKFLOW_NAME)throw new Error('claim_workflow');if(!['push','workflow_dispatch'].includes(c.event_name))throw new Error('claim_event');if(!/^[0-9a-f]{40}$/i.test(String(c.sha||'')))throw new Error('claim_sha');if(!c.jti||String(c.jti).length<16)throw new Error('claim_jti');return c}
function consume(jti,exp){const now=Math.floor(Date.now()/1000);let a=[];try{a=JSON.parse(fs.readFileSync(USED_JTI_FILE,'utf8'))}catch{}if(!Array.isArray(a))a=[];a=a.filter(x=>x&&Number(x.exp)>now);if(a.some(x=>x.jti===jti))throw new Error('jwt_replay');a.push({jti,exp:Number(exp)});fs.writeFileSync(USED_JTI_FILE,JSON.stringify(a),{mode:0o600})}
function send(res,status,data){const b=Buffer.from(JSON.stringify(data));res.writeHead(status,{'Content-Type':'application/json','Content-Length':String(b.length),'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(b)}
function body(req){return new Promise((resolve,reject)=>{const a=[];let n=0;req.on('data',c=>{n+=c.length;if(n>MAX_BODY){reject(new Error('body_too_large'));req.destroy();return}a.push(c)});req.on('end',()=>resolve(Buffer.concat(a)));req.on('error',reject)})}
fs.mkdirSync(INBOX,{recursive:true,mode:0o700});
const server=http.createServer(async(req,res)=>{try{if(req.method==='GET'&&req.url===HEALTH_PATH)return send(res,200,{ok:true,service:'PortalDeployReceiver',version:'1.0.0'});if(req.url!==DEPLOY_PATH)return send(res,404,{ok:false,error:'not_found'});if(req.method!=='POST')return send(res,405,{ok:false,error:'method_not_allowed'});if(!String(req.headers['content-type']||'').toLowerCase().startsWith('application/json'))return send(res,415,{ok:false,error:'content_type'});const auth=String(req.headers.authorization||'');if(!auth.startsWith('Bearer '))return send(res,401,{ok:false,error:'missing_bearer'});const claims=await verify(auth.slice(7));consume(String(claims.jti),Number(claims.exp));const payload=JSON.parse((await body(req)).toString('utf8'));const sha=String(payload.sha||'');if(sha!==String(claims.sha))throw new Error('payload_sha_mismatch');const archive=Buffer.from(String(payload.archiveB64||''),'base64');if(!archive.length||archive.length>14*1024*1024)throw new Error('archive_size');const hash=String(payload.archiveSha256||'').toLowerCase();if(!/^[0-9a-f]{64}$/.test(hash)||crypto.createHash('sha256').update(archive).digest('hex')!==hash)throw new Error('archive_hash');const archivePath=path.join(INBOX,`${sha}.tgz`);fs.writeFileSync(archivePath,archive,{mode:0o600});const r=spawnSync(RUNNER,[sha,archivePath,String(claims.run_id||'unknown')],{encoding:'utf8',timeout:480000,maxBuffer:4*1024*1024,env:{PATH:process.env.PATH||'/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin'}});if(r.error)throw new Error(`deploy_spawn:${r.error.message}`);if(r.status===75)return send(res,409,{ok:false,error:'deploy_busy',deployedSha:sha});if(r.status!==0)return send(res,500,{ok:false,error:'deploy_failed',status:r.status,stdout:String(r.stdout||'').slice(-16000),stderr:String(r.stderr||'').slice(-16000)});return send(res,200,{ok:true,deployedSha:sha,stdout:String(r.stdout||'').slice(-16000)})}catch(e){const m=String(e?.message||'request_failed');const auth=m.startsWith('jwt_')||m.startsWith('claim_');console.error(new Date().toISOString(),e?.stack||e);return send(res,auth?401:400,{ok:false,error:m})}});
server.headersTimeout=10000;server.requestTimeout=540000;server.listen(PORT,HOST,()=>console.log(`Portal deploy receiver listening on ${HOST}:${PORT}`));
