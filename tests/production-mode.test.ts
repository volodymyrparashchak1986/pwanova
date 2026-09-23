import { it } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { readJsonBody } from '../src/lib/security/json-body'
it('production without credentials never substitutes fabricated backend data',()=>{
 const output=execFileSync(process.execPath,['--conditions=react-server','--import','tsx','-e',`(async()=>{const d=require('./src/lib/data/index.ts');console.log(JSON.stringify({apps:await d.getApps(),app:await d.getAppBySlug('metro-fit'),dashboard:await d.getDashboard()}))})()`],{cwd:new URL('../',import.meta.url),env:{...process.env,NODE_ENV:'production',DEMO_MODE:'false',SHOW_DEMO_DATA:'false',NEXT_PUBLIC_SUPABASE_URL:'',NEXT_PUBLIC_SUPABASE_ANON_KEY:''},encoding:'utf8'})
 const result=JSON.parse(output)
 assert.deepEqual(result.apps,[]);assert.equal(result.app,null);assert.equal(result.dashboard.totals.views,0)
})
it('anonymous JSON input is bounded before parsing, including chunked bodies',async()=>{
 assert.deepEqual(await readJsonBody(new Request('https://example.com',{method:'POST',body:'{"ok":true}'})),{ok:true})
 await assert.rejects(readJsonBody(new Request('https://example.com',{method:'POST',body:'x'.repeat(5000)})),/too large/)
 assert.equal(await readJsonBody(new Request('https://example.com',{method:'POST',body:'invalid'})),null)
})
