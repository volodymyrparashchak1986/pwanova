import assert from 'node:assert/strict'
import { it } from 'node:test'
import { readFileSync, readdirSync } from 'node:fs'
import { PGlite } from '@electric-sql/pglite'
it('upgrades the existing seeded schema without losing reviews, ratings or origins',async()=>{
 const db=new PGlite()
 const root=new URL('../',import.meta.url)
 const read=(path:string)=>readFileSync(new URL(path,root),'utf8')
 try {
  await db.exec(read('tests/supabase-prelude.sql'))
  const migrations=readdirSync(new URL('supabase/migrations/',root)).sort()
  for(const m of migrations.slice(0,-1))await db.exec(read(`supabase/migrations/${m}`))
  await db.exec(read('supabase/seed.sql'))
  const before=(await db.query('select (select count(*) from apps) apps,(select count(*) from reviews) reviews,(select count(*) from ratings) ratings')).rows[0]
  await db.exec("alter table reviews disable trigger reviews_sync_rating; update reviews set rating=1 where id='50000000-0000-4000-8000-000000000001'; alter table reviews enable trigger reviews_sync_rating;")
  await db.exec(read(`supabase/migrations/${migrations.at(-1)}`))
  const after=(await db.query('select (select count(*) from apps) apps,(select count(*) from reviews) reviews,(select count(*) from ratings) ratings')).rows[0]
  assert.deepEqual(after,before)
  assert.equal((await db.query('select 1 from reviews v join ratings r using(app_id,user_id) where v.rating is distinct from r.rating')).rows.length,0)
  assert.equal((await db.query<{n:number}>('select count(*)::int n from apps_public')).rows[0].n,15)
 }finally{await db.close()}
})
