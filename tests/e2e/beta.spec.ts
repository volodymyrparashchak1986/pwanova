import { test, expect, type BrowserContext } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'
import { createServerClient } from '@supabase/ssr'
import { randomUUID } from 'node:crypto'
test.describe.configure({mode:'serial'})
const url=process.env.NEXT_PUBLIC_SUPABASE_URL!
const anon=process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const admin=createClient(url,process.env.SUPABASE_SERVICE_ROLE_KEY!,{auth:{persistSession:false}})
const run=randomUUID().slice(0,8)
const slug=`beta-browser-${run}`
const password=randomUUID()
const users: Record<string,{id:string;email:string}>={}
let appId=''
async function login(context:BrowserContext,who:string){
 const collected: {name:string;value:string}[]=[]
 const client=createServerClient(url,anon,{cookies:{getAll:()=>[],setAll:cookies=>{collected.push(...cookies)}}})
 const {error}=await client.auth.signInWithPassword({email:users[who].email,password})
 expect(error).toBeNull()
 await context.addCookies(collected.map(c=>({name:c.name,value:c.value,domain:'localhost',path:'/',sameSite:'Lax' as const,httpOnly:false,secure:false})))
}
test.beforeAll(async()=>{
 for(const role of ['userA','userB','ownerA','ownerB','admin']){
  const email=`beta-${role.toLowerCase()}-${run}@example.com`
  const {data,error}=await admin.auth.admin.createUser({email,password,email_confirm:true,user_metadata:{user_name:`${role.toLowerCase()}-${run}`}})
  expect(error).toBeNull();users[role]={id:data.user!.id,email}
 }
 await admin.from('profiles').update({role:'admin'}).eq('id',users.admin.id)
 const {data,error}=await admin.from('apps').insert({developer_id:users.ownerA.id,name:'Beta Browser App',slug,url:'https://beta-browser.example/',domain:'beta-browser.example',tagline:'Local end-to-end fixture',status:'published',ownership_status:'verified_owner'}).select('id').single()
 expect(error).toBeNull();appId=data!.id
})
test.afterAll(async()=>{
 await admin.from('apps').delete().eq('id',appId)
 for(const u of Object.values(users)){
  await admin.from('apps').delete().eq('developer_id',u.id)
  await admin.auth.admin.deleteUser(u.id)
 }
})
test('guest discovery, install guidance, outbound target and review draft survive auth',async({page,context})=>{
 await page.goto('/explore?q=Beta%20Browser')
 await expect(page.getByText('Beta Browser App').first()).toBeVisible()
 await page.goto(`/apps/${slug}`)
 await expect(page.getByText('No ratings yet').first()).toBeVisible()
 await expect(page.locator('a[href="https://beta-browser.example/"]').first()).toHaveAttribute('href','https://beta-browser.example/')
 await page.evaluate(()=>{const event=new Event('beforeinstallprompt');Object.assign(event,{prompt:()=>{throw new Error('Must not install PWANova')}});window.dispatchEvent(event)})
 await page.goto(`/apps/${slug}#install`)
 await expect(page.getByRole('dialog')).toBeVisible()
 await expect(page.getByRole('dialog')).toContainText('beta-browser.example')
 await expect(page.getByRole('dialog')).toContainText('own site, not on PWANova')
 await context.route('https://beta-browser.example/**',r=>r.fulfill({body:'External app fixture'}))
 const popupPromise=page.waitForEvent('popup')
 await page.getByRole('button',{name:'Open beta-browser.example'}).click()
 const popup=await popupPromise;await popup.waitForLoadState();expect(popup.url()).toBe('https://beta-browser.example/');await popup.close()
 await page.getByRole('button',{name:'Done',exact:true}).click()
 await page.getByRole('button',{name:'Write a review',exact:true}).click()
 await page.getByRole('radiogroup',{name:'Rating',exact:true}).getByRole('radio',{name:'4 stars',exact:true}).click()
 await page.getByPlaceholder('Title (optional)').fill('Draft from guest')
 await page.getByPlaceholder('What do you like? What could be better?').fill('A useful app. Please improve keyboard shortcuts.')
 await page.getByRole('button',{name:'Sign in to post'}).click()
 await expect(page).toHaveURL(/sign-in\?next=/)
 const returnPath=new URL(page.url()).searchParams.get('next')!
 await login(context,'userA')
 await page.goto(returnPath)
 await expect(page.getByPlaceholder('Title (optional)')).toHaveValue('Draft from guest')
 await page.getByRole('button',{name:'Post review',exact:true}).click()
 await expect(page.getByText('Review posted.',{exact:true})).toBeVisible()
 await page.reload()
 await expect(page.getByText('Draft from guest',{exact:true})).toBeVisible()
 await page.getByRole('button',{name:'Save',exact:true}).click()
 await expect(page.getByText('Saved to your apps',{exact:true})).toBeVisible()
 await page.reload()
 await expect(page.getByRole('button',{name:'Saved',exact:true})).toHaveAttribute('aria-pressed','true')
 await page.goto('/saved');await expect(page.getByText('Beta Browser App').first()).toBeVisible()
})
test('owner response, user edit and independent rating/review removal persist across sessions',async({page,context})=>{
 await login(context,'ownerA');await page.goto(`/apps/${slug}`)
 await expect(page.getByText("You can't rate your own app.")).toBeVisible()
 await page.getByRole('button',{name:'Respond',exact:true}).click()
 await page.getByPlaceholder('Write a public response').fill('Thanks. Keyboard shortcuts are on our roadmap.')
 await page.getByRole('button',{name:'Post response'}).click()
 await expect(page.getByText('Developer Response',{exact:false})).toBeVisible()
 await context.clearCookies();await login(context,'userA');await page.reload()
 await page.getByRole('button',{name:'Edit your review'}).click()
 await page.getByPlaceholder('Title (optional)').fill('Updated experience')
 await page.getByRole('button',{name:'Save changes',exact:true}).click()
 await expect(page.getByText('Review updated.',{exact:true})).toBeVisible()
 await page.getByRole('radiogroup',{name:'Your rating',exact:true}).getByRole('radio',{name:'2 stars'}).click()
 await expect.poll(async()=>{const {data}=await admin.from('reviews').select('rating').eq('app_id',appId).single();return data?.rating}).toBe(2)
 await page.getByRole('button',{name:'Remove rating (keep review text)'}).click()
 await expect(page.getByText('Rating removed. Your review text is unchanged.',{exact:true})).toBeVisible()
 await page.reload();await expect(page.getByText('Updated experience',{exact:true})).toBeVisible()
 await expect(page.getByText('No ratings yet').first()).toBeVisible()
 await page.getByRole('button',{name:'Edit your review'}).click()
 await page.getByRole('button',{name:'Delete review text'}).click()
 await expect(page.getByText('Review text deleted. Your rating is unchanged.',{exact:true})).toBeVisible()
 await page.reload();await expect(page.getByText('Updated experience',{exact:true})).toHaveCount(0)
 await page.request.post('/auth/sign-out');await page.goto('/dashboard')
 await expect(page.getByText('Sign in to see how your apps are performing.')).toBeVisible()
})
test('developer submits, sees pending claim, invalid verification fails; admin publishes',async({page,context})=>{
 await login(context,'ownerB');await page.goto('/ship')
 await page.getByPlaceholder('https://your-app.vercel.app').fill(`https://submission-${run}.example/`)
 await page.getByRole('button',{name:'Analyze App'}).click()
 await page.getByLabel('App name',{exact:true}).fill(`Beta Submitted ${run}`)
 await page.getByLabel('Tagline',{exact:false}).fill('A real database submission from the UI')
 await page.getByRole('button',{name:'Ship Your App',exact:true}).click()
 await expect(page).toHaveURL(/\/claim$/)
 await expect(page.getByText('This listing is awaiting moderation.',{exact:false})).toBeVisible()
 await page.getByRole('button',{name:'Verify ownership',exact:true}).click()
 await expect(page.getByRole('alert')).toBeVisible()
 const {data:app}=await admin.from('apps').select('id,slug,status').eq('developer_id',users.ownerB.id).single()
 expect(app?.status).toBe('pending')
 await context.clearCookies();await login(context,'admin');await page.goto('/admin')
 const row=page.locator('li, tr, article').filter({hasText:`Beta Submitted ${run}`}).first()
 // Use the real admin server action, with its transactional audit entry.
 await row.getByRole('button',{name:'Approve',exact:true}).click()
 await expect.poll(async()=>{const {data}=await admin.from('apps').select('status').eq('id',app!.id).single();return data?.status}).toBe('published')
 await context.clearCookies();await page.goto(`/apps/${app!.slug}`);await expect(page.getByRole('heading',{name:`Beta Submitted ${run}`,exact:true})).toBeVisible()
})
test('partner API and badge immediately revoke visibility on suspension',async({request,page})=>{
 let response=await request.get(`/api/public/apps/by-domain?id=${appId}`);expect(response.status()).toBe(200)
 const data=await response.json();expect(data.id).toBe(appId);expect(data.rating).toBeNull();expect(data.ratingsCount).toBe(0)
 expect(JSON.stringify(data)).not.toMatch(/token|user_id|email|developer_id/)
 expect(response.headers()['cache-control']).toContain('no-store')
 const badge=await request.get(`/api/badge/${slug}`);expect(badge.status()).toBe(200);expect(await badge.text()).toContain('View on PWANova')
 await page.goto('/partners');await expect(page.getByRole('button',{name:'Copy snippet'}).first()).toBeVisible()
 await admin.from('apps').update({status:'suspended'}).eq('id',appId)
 for(const path of [`/api/public/apps/by-domain?id=${appId}`,`/api/badge/${slug}`,`/embed/app/${slug}`,`/apps/${slug}`]){response=await request.get(path);expect(response.status(),path).toBe(404)}
 await admin.from('apps').update({status:'published'}).eq('id',appId)
})
test('narrow mobile viewport, install modal and review keyboard area have no overflow',async({page})=>{
 await page.setViewportSize({width:375,height:667});await page.goto(`/apps/${slug}#install`)
 await expect(page.getByRole('dialog')).toBeVisible()
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBeTruthy()
 await page.getByRole('button',{name:'Done',exact:true}).click()
 await page.getByRole('button',{name:'Write a review',exact:true}).click()
 await page.getByPlaceholder('What do you like? What could be better?').focus()
 await page.setViewportSize({width:375,height:350})
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBeTruthy()
 await page.screenshot({path:'test-results/mobile-review.png',fullPage:true})
})

test('new account registers through the email UI and returns to the requested action',async({page,request})=>{
 const email=`beta-signup-${run}@example.com`
 try {
  await page.goto('/sign-in?next=%2Fdashboard')
  await page.getByPlaceholder('you@example.com').fill(email)
  await page.getByRole('button',{name:'Email me a magic link'}).click()
  await expect(page.getByRole('status')).toContainText('magic link')
  let messageId=''
  await expect.poll(async()=>{
   const inbox=await (await request.get('http://127.0.0.1:55324/api/v1/messages')).json()
   const message=inbox.messages?.find((m:{ID:string;To:{Address:string}[]})=>m.To.some(t=>t.Address===email))
   messageId=message?.ID ?? '';return Boolean(messageId)
  }).toBeTruthy()
  const message=await (await request.get(`http://127.0.0.1:55324/api/v1/message/${messageId}`)).json()
  const link=(message.HTML as string).match(/href="([^"]*\/auth\/v1\/verify[^"]*)"/)?.[1].replaceAll('&amp;','&')
  if(!link) throw new Error('Local verification email has no auth link')
  await page.goto(link)
  await page.waitForURL(u=>u.pathname==='/dashboard')
  await expect(page.getByRole('heading',{name:'Dashboard',exact:true})).toBeVisible()
  await page.reload();await expect(page.getByRole('heading',{name:'Dashboard',exact:true})).toBeVisible()
  const {data}=await admin.auth.admin.listUsers({perPage:1000})
  const user=data.users.find(u=>u.email===email)
  expect(Boolean(user)).toBeTruthy()
  const profile=(await admin.from('profiles').select('role,is_verified').eq('id',user!.id).single()).data
  expect(profile).toEqual({role:'user',is_verified:false})
 } finally {
  const {data}=await admin.auth.admin.listUsers({perPage:1000})
  const user=data.users.find(u=>u.email===email)
  if(user) await admin.auth.admin.deleteUser(user.id)
 }
})

test('registered referral is measured once, unknown ref stays unofficial, launch history survives',async({request})=>{
 const ref=`board-${run}`
 const {data:partner,error:partnerError}=await admin.from('partners').insert({name:'Fictional local launch board',slug:ref,referral_code:ref,status:'active'}).select('id').single()
 expect(partnerError).toBeNull()
 try {
  const {data:app,error}=await admin.from('apps').insert({developer_id:users.ownerA.id,name:'Referral test app',slug:`ref-${run}`,url:`https://ref-${run}.example/`,domain:`ref-${run}.example`,status:'published'}).select('id,slug').single()
  expect(error).toBeNull()
  await admin.from('app_sources').insert({app_id:app!.id,source_name:'Original launch board',source_type:'launched_on'})
  await request.get(`/apps/${app!.slug}?ref=${ref}`,{headers:{'next-router-prefetch':'1'}})
  expect((await admin.from('app_events').select('id').eq('app_id',app!.id)).data?.length).toBe(0)
  const event={appId:app!.id,type:'view'}
  expect((await request.post('/api/events',{data:event,headers:{origin:'http://localhost:3000'}})).status()).toBe(204)
  await request.post('/api/events',{data:event,headers:{origin:'http://localhost:3000'}})
  const events=(await admin.from('app_events').select('partner_id,source').eq('app_id',app!.id).eq('event_type','view')).data!
  expect(events).toEqual([{partner_id:partner!.id,source:'partner'}])
  await request.get(`/apps/${app!.slug}?ref=unregistered-${run}`)
  await request.post('/api/events',{data:{appId:app!.id,type:'open_app'},headers:{origin:'http://localhost:3000'}})
  expect((await admin.from('app_events').select('partner_id').eq('app_id',app!.id).eq('event_type','open_app').single()).data?.partner_id).toBeNull()
  expect((await admin.from('app_sources').select('source_name').eq('app_id',app!.id).single()).data?.source_name).toBe('Original launch board')
 } finally { await admin.from('partners').delete().eq('id',partner!.id) }
})
