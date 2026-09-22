import { it } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
it('service worker never stores private routes; version activation removes old caches',async()=>{
 const handlers: Record<string,(event:unknown)=>void>={}
 const deleted:string[]=[];const stored:string[]=[]
 const context={URL,self:{location:{origin:'https://pwanova.example'},addEventListener:(name:string,fn:(event:unknown)=>void)=>{handlers[name]=fn},clients:{claim:()=>Promise.resolve()}},fetch:async()=>({ok:true}),caches:{keys:async()=>['pwanova-static-v1','pwanova-pages-v1','pwanova-static-v2-beta'],delete:async(key:string)=>{deleted.push(key)},open:async()=>({put:(key:string)=>stored.push(key)}),match:async()=>null}}
 runInNewContext(readFileSync(new URL('../public/sw.js',import.meta.url),'utf8'),context)
 for(const path of ['/api/events','/api/private','/auth/callback','/dashboard','/admin','/saved','/profile']){
  let response:Promise<unknown>|undefined
  handlers.fetch({request:{method:'GET',url:`https://pwanova.example${path}`,mode:'navigate'},respondWith:(p:Promise<unknown>)=>{response=p}})
  await response
 }
 assert.equal(stored.length,0)
 let activation:Promise<unknown>|undefined
 handlers.activate({waitUntil:(p:Promise<unknown>)=>{activation=p}});await activation
 assert.deepEqual(deleted,['pwanova-static-v1','pwanova-pages-v1'])
})
