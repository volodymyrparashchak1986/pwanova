import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { Response, fetch as transport } from 'undici'
import { fetchWithPolicy, safeFetch } from '../src/lib/security/ssrf'
import { isPrivateIp, parsePublicUrl, canonicalAppUrl } from '../src/lib/url'
import { safeNext } from '../src/lib/safe-next'
const fake = (fn: () => Response) => (async () => fn()) as typeof transport

describe('SSRF network policy', () => {
 it('blocks IPv4 mapped and expanded IPv6 plus reserved addresses', () => {
  for (const ip of ['::ffff:7f00:1','0:0:0:0:0:0:0:1','::ffff:169.254.169.254','fd00::1','fe80::1','2001:db8::1','2002:7f00:1::','127.1.2.3','169.254.169.254','100.64.0.1']) assert.equal(isPrivateIp(ip), true, ip)
  assert.equal(isPrivateIp('2606:4700:4700::1111'),false)
  assert.equal(isPrivateIp('8.8.8.8'),false)
  for (const url of ['https://[::ffff:7f00:1]','http://2130706433','https://a.example:80','http://a.example:443','ftp://a.example']) assert.throws(()=>parsePublicUrl(url))
 })
 it('rejects local DNS names and private redirects before another request',async()=>{
  await assert.rejects(safeFetch('http://127.0.0.1'),/Private/)
  let calls=0
  await assert.rejects(fetchWithPolicy('https://public.example',{},fake(()=>{calls++;return new Response('',{status:302,headers:{location:'http://169.254.169.254/latest/meta-data'}})})),/Private/)
  assert.equal(calls,1)
 })
 it('ownership disallows even public cross-origin redirects',async()=>{
  await assert.rejects(fetchWithPolicy('https://public.example',{maxRedirects:0},fake(()=>new Response('',{status:302,headers:{location:'https://attacker.example/token'}}))),/Redirects/)
 })
 it('oversized responses fail instead of accepting truncated tokens',async()=>{
  await assert.rejects(fetchWithPolicy('https://public.example',{maxBytes:4},fake(()=>new Response('0123456789'))),/size limit/)
 })
 it('does not send cookies or credentials and shares a timeout across redirects',async()=>{
  const signals: unknown[]=[]
  const f=(async(_url:unknown,opts:Parameters<typeof transport>[1])=>{
   signals.push(opts?.signal)
   const headers=opts?.headers as Record<string,string>
   assert.equal(headers.cookie,undefined);assert.equal(headers.authorization,undefined)
   assert.equal(opts?.redirect,'manual')
   return signals.length===1 ? new Response('',{status:302,headers:{location:'https://other.example/'}}) : new Response('ok')
  }) as typeof transport
  const response=await fetchWithPolicy('https://public.example',{},f)
  assert.equal(response.body,'ok'); assert.equal(signals[0],signals[1])
 })
 it('canonical identity and redirects retain only intended values',()=>{
  assert.equal(canonicalAppUrl('https://Example.com/tool/?x=1#y'),'https://example.com/tool')
  for(const bad of ['//evil.example','/\\evil.example','/%2f%2fevil.example','/\tevil.example']) assert.equal(safeNext(bad),'/')
  assert.equal(safeNext('/apps/example#reviews'),'/apps/example#reviews')
 })
})

it('the real socket DNS lookup rejects private and mixed public/private answers',async()=>{
 const {default:dns}=await import('node:dns')
 const {mock}=await import('node:test')
 for(const addresses of [[{address:'127.0.0.1',family:4}],[{address:'8.8.8.8',family:4},{address:'::ffff:7f00:1',family:6}]]){
  let called=false
  const lookup=mock.method(dns,'lookup',((_host:unknown,_opts:unknown,callback:(error:null,addresses:unknown)=>void)=>{called=true;callback(null,addresses)}) as typeof dns.lookup)
  try {
   await assert.rejects(safeFetch('https://dns-guard.example/',{timeoutMs:1000}),error=>String((error as Error & {cause?:Error}).cause?.message).includes('private address'))
   assert.equal(called,true)
  }finally{lookup.mock.restore()}
 }
})

it('ownership requires HTTPS and refuses methods not offered in the beta',async()=>{
 const {verifyOwnership}=await import('../src/lib/verification')
 assert.equal((await verifyOwnership('http://public.example/','public.example','token','well_known')).ok,false)
 assert.equal((await verifyOwnership('https://public.example/','public.example','token','dns_txt')).ok,false)
})
it('public metadata URLs cannot carry embedded credentials',async()=>{
 const {cleanHttpUrl}=await import('../src/lib/security/sanitize')
 assert.equal(cleanHttpUrl('https://user:password@example.com/manifest.json'),null)
})
