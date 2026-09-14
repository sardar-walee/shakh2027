import React, { useEffect, useMemo, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { supabase } from './supabase'
import { CarFront, ChefHat, ShoppingBasket, Shirt, Sparkles, Store, Shield, UserRound, Plus, LogOut, Wallet, LayoutDashboard, Ban, Trash2, CheckCircle2, Clock3, Bike, Menu, X } from 'lucide-react'
import './styles.css'

const sections = {
  restaurant: { label:'چێشتخانە', icon:ChefHat },
  supermarket: { label:'سوپەرمارکێت', icon:ShoppingBasket },
  clothing: { label:'جل و بەرگ', icon:Shirt },
  beauty: { label:'جوانکاری', icon:Sparkles },
  auto: { label:'ئۆتۆمبێل', icon:CarFront },
  captain: { label:'کاپتن', icon:Bike },
  customer: { label:'کڕیار', icon:UserRound },
  super_admin: { label:'سوپەر ئەدمین', icon:Shield },
}
const money = n => new Intl.NumberFormat('ku-IQ',{maximumFractionDigits:0}).format(Number(n||0)) + ' د.ع'
const roleLabel = r => sections[r]?.label || r

function App(){
  const [session,setSession]=useState(null)
  const [profile,setProfile]=useState(null)
  const [posts,setPosts]=useState([])
  const [orders,setOrders]=useState([])
  const [captains,setCaptains]=useState([])
  const [tab,setTab]=useState('home')
  const [loading,setLoading]=useState(true)
  const [authMode,setAuthMode]=useState('login')
  const [email,setEmail]=useState('')
  const [password,setPassword]=useState('')
  const [name,setName]=useState('')
  const [mobileOpen,setMobileOpen]=useState(false)
  const [notice,setNotice]=useState('')

  useEffect(()=>{
    supabase.auth.getSession().then(({data})=>{ setSession(data.session); if(!data.session) setLoading(false) })
    const {data:listener}=supabase.auth.onAuthStateChange((_e,s)=>{setSession(s); if(!s){setProfile(null);setLoading(false)}})
    return ()=>listener.subscription.unsubscribe()
  },[])
  useEffect(()=>{ if(session) loadProfile() },[session])

  async function loadProfile(){
    setLoading(true)
    let {data,error}=await supabase.from('profiles').select('*').eq('id',session.user.id).single()
    if(error){ setNotice(error.message); setLoading(false); return }
    setProfile(data)
    await Promise.all([loadPosts(),loadOrders(),loadCaptains()])
    setLoading(false)
  }
  async function loadPosts(){
    const {data}=await supabase.from('posts').select('*').order('created_at',{ascending:false}).limit(100)
    setPosts(data||[])
  }
  async function loadOrders(){
    const {data}=await supabase.from('orders').select('*').order('created_at',{ascending:false}).limit(100)
    setOrders(data||[])
  }
  async function loadCaptains(){
    const {data}=await supabase.from('captains').select('*').order('created_at',{ascending:false})
    setCaptains(data||[])
  }
  async function auth(e){
    e.preventDefault(); setNotice('')
    if(authMode==='signup'){
      const {error}=await supabase.auth.signUp({email,password,options:{data:{full_name:name}}})
      setNotice(error?error.message:'ئەکاونتەکەت دروست کرا. ئەگەر پێویست بوو ئیمەیڵەکەت پشتڕاست بکەرەوە.')
    }else{
      const {error}=await supabase.auth.signInWithPassword({email,password})
      if(error)setNotice(error.message)
    }
  }
  async function logout(){ await supabase.auth.signOut(); setTab('home') }

  if(!session) return <Auth authMode={authMode} setAuthMode={setAuthMode} email={email} setEmail={setEmail} password={password} setPassword={setPassword} name={name} setName={setName} auth={auth} notice={notice}/>
  if(loading || !profile) return <div className="splash"><div className="logoMark">ش</div><h1>شاخ</h1><p>دەستپێکردن...</p></div>

  const nav = profile.role==='super_admin'
    ? [['home','داشبۆرد',LayoutDashboard],['posts','پۆستەکان',Store],['finance','دارایی',Wallet],['captains','کاپتنەکان',Bike]]
    : [['home','داشبۆرد',LayoutDashboard],['posts','پۆستەکان',Store],['finance','دارایی',Wallet],['captains','کاپتنەکان',Bike]]
  return <div className="app">
    <header className="topbar">
      <button className="iconBtn mobileOnly" onClick={()=>setMobileOpen(!mobileOpen)}>{mobileOpen?<X/>:<Menu/>}</button>
      <div className="brand"><div className="logoMark">ش</div><div><b>شاخ</b><small>بازاڕ و گەیاندن</small></div></div>
      <div className="topUser"><span>{profile.full_name||session.user.email}</span><em>{roleLabel(profile.role)}</em><button className="iconBtn" onClick={logout}><LogOut/></button></div>
    </header>
    <div className="layout">
      <aside className={mobileOpen?'sidebar open':'sidebar'}>
        {nav.map(([id,label,Icon])=><button key={id} className={tab===id?'navItem active':'navItem'} onClick={()=>{setTab(id);setMobileOpen(false)}}><Icon/><span>{label}</span></button>)}
        <div className="sideCard"><b>ڕۆڵی ئێستا</b><strong>{roleLabel(profile.role)}</strong><small>دەتوانیت پۆست و کاپتن بەڕێوە ببەیت.</small></div>
      </aside>
      <main className="main">
        {notice && <div className="notice">{notice}<button onClick={()=>setNotice('')}>×</button></div>}
        {tab==='home' && <Dashboard profile={profile} posts={posts} orders={orders} captains={captains} setTab={setTab}/>}
        {tab==='posts' && <Posts profile={profile} posts={posts} reload={loadPosts} setNotice={setNotice}/>}
        {tab==='finance' && <Finance profile={profile} orders={orders}/>}
        {tab==='captains' && <Captains profile={profile} captains={captains} reload={loadCaptains} setNotice={setNotice}/>}
      </main>
    </div>
  </div>
}

function Auth({authMode,setAuthMode,email,setEmail,password,setPassword,name,setName,auth,notice}){
 return <div className="authPage"><div className="authGlow"></div><div className="authCard"><div className="brand center"><div className="logoMark">ش</div><div><b>شاخ</b><small>پلاتفۆرمی بازاڕ و گەیاندن</small></div></div><h2>{authMode==='login'?'بەخێربێیتەوە':'ئەکاونت دروست بکە'}</h2><p className="muted">بازاڕ، ئۆتۆمبێل، گەیاندن و دارایی لە یەک شوێن.</p><form onSubmit={auth}>{authMode==='signup'&&<input placeholder="ناوی تەواو" value={name} onChange={e=>setName(e.target.value)} required/>}<input type="email" placeholder="ئیمەیڵ" value={email} onChange={e=>setEmail(e.target.value)} required/><input type="password" placeholder="وشەی نهێنی" value={password} onChange={e=>setPassword(e.target.value)} required minLength="6"/><button className="primary wide">{authMode==='login'?'چوونەژوورەوە':'دروستکردنی ئەکاونت'}</button></form>{notice&&<div className="notice">{notice}</div>}<button className="linkBtn" onClick={()=>setAuthMode(authMode==='login'?'signup':'login')}>{authMode==='login'?'ئەکاونتت نییە؟ دروستی بکە':'پێشتر ئەکاونتت هەیە؟ بچۆ ژوورەوە'}</button></div></div>
}

function Dashboard({profile,posts,orders,captains,setTab}){
 const visible=profile.role==='super_admin'?posts:posts.filter(p=>p.author_id===profile.id)
 const published=visible.filter(p=>p.status==='published').length
 const pending=visible.filter(p=>p.status==='pending').length
 const revenue=orders.reduce((s,o)=>s+Number(o.platform_revenue||0),0)
 return <><div className="hero"><div><span className="eyebrow">DASHBOARD</span><h1>بەخێربێیت، {profile.full_name||'بەڕێز'} 👋</h1><p>هەموو کارەکانی {roleLabel(profile.role)} لە یەک داشبۆرد.</p></div><button className="primary" onClick={()=>setTab('posts')}><Plus/> پۆستی نوێ</button></div>
 <div className="stats"><Stat icon={Store} title="کۆی پۆست" value={visible.length}/><Stat icon={CheckCircle2} title="بڵاوکراوە" value={published}/><Stat icon={Clock3} title="لە چاوەڕوانیدا" value={pending}/><Stat icon={Wallet} title="داهاتی پلاتفۆرم" value={money(revenue)}/></div>
 <div className="grid2"><div className="panel"><div className="panelHead"><h3>دوایین پۆستەکان</h3><button className="textBtn" onClick={()=>setTab('posts')}>هەمووی</button></div>{visible.slice(0,5).map(p=><PostRow key={p.id} p={p}/>) || <Empty/>}</div><div className="panel"><div className="panelHead"><h3>کاپتنەکان</h3><button className="textBtn" onClick={()=>setTab('captains')}>بەڕێوەبردن</button></div>{captains.slice(0,5).map(c=><div className="miniRow" key={c.id}><div className="avatar"><Bike/></div><div><b>کاپتن</b><small>{c.vehicle||'ئۆتۆمبێل دیاری نەکراوە'}</small></div><span className={c.is_available?'dot good':'dot'}></span></div>)}</div></div></>
}
function Stat({icon:Icon,title,value}){return <div className="stat"><div className="statIcon"><Icon/></div><div><small>{title}</small><strong>{value}</strong></div></div>}
function PostRow({p}){return <div className="miniRow"><div className="thumb">{p.post_type==='car'?<CarFront/>:<Store/>}</div><div><b>{p.title}</b><small>{roleLabel(p.section)} · {money(p.price)}</small></div><span className={'status '+p.status}>{p.status==='published'?'بڵاوکراوە':p.status==='pending'?'چاوەڕوان':'بلاک'}</span></div>}
function Empty(){return <div className="empty">هیچ داتایەک نییە.</div>}

function Posts({profile,posts,reload,setNotice}){
 const [open,setOpen]=useState(false); const [form,setForm]=useState({title:'',description:'',price:'',post_type:'product',section:profile.role==='super_admin'?'auto':profile.role,car_make:'',car_model:'',car_year:'',car_mileage:'',car_location:''})
 const [filter,setFilter]=useState('all')
 const list=posts.filter(p=>(profile.role==='super_admin'||p.author_id===profile.id)&&(filter==='all'||p.status===filter))
 async function save(e){e.preventDefault();const payload={...form,author_id:profile.id,price:form.price?Number(form.price):null,car_year:form.car_year?Number(form.car_year):null,car_mileage:form.car_mileage?Number(form.car_mileage):null};const {error}=await supabase.from('posts').insert(payload);if(error)setNotice(error.message);else{setOpen(false);setForm({...form,title:'',description:'',price:'',car_make:'',car_model:'',car_year:'',car_mileage:'',car_location:''});reload()}}
 async function moderate(id,status){const {error}=await supabase.from('posts').update({status}).eq('id',id);if(error)setNotice(error.message);else reload()}
 async function remove(id){if(!confirm('ئەم پۆستە بسڕیتەوە؟'))return;const {error}=await supabase.from('posts').delete().eq('id',id);if(error)setNotice(error.message);else reload()}
 return <><div className="sectionHead"><div><h2>پۆستەکان</h2><p>پۆستەکانی بەشەکەت و ئۆتۆمبێلەکان بەڕێوە ببە.</p></div><button className="primary" onClick={()=>setOpen(true)}><Plus/> پۆستی نوێ</button></div>
 <div className="filters">{['all','published','pending','blacklisted'].map(x=><button className={filter===x?'chip active':'chip'} onClick={()=>setFilter(x)} key={x}>{x==='all'?'هەموو':x==='published'?'بڵاوکراوە':x==='pending'?'چاوەڕوان':'ڕەشکراوە'}</button>)}</div>
 <div className="postGrid">{list.map(p=><article className="postCard" key={p.id}><div className="postVisual">{p.post_type==='car'?<CarFront/>:<Store/>}<span className={'status '+p.status}>{p.status}</span></div><div className="postBody"><small>{roleLabel(p.section)}</small><h3>{p.title}</h3><p>{p.description||'بێ وەسف'}</p><strong>{money(p.price)}</strong><div className="actions">{profile.role==='super_admin'&&p.status!=='published'&&<button className="iconBtn goodBtn" title="بڵاوکردنەوە" onClick={()=>moderate(p.id,'published')}><CheckCircle2/></button>}{profile.role==='super_admin'&&p.status!=='blacklisted'&&<button className="iconBtn warnBtn" title="ڕەشکردنەوە" onClick={()=>moderate(p.id,'blacklisted')}><Ban/></button>}{profile.role==='super_admin'&&<button className="iconBtn dangerBtn" onClick={()=>remove(p.id)}><Trash2/></button>}</div></div></article>)}</div>
 {open&&<Modal title="پۆستی نوێ" close={()=>setOpen(false)}><form onSubmit={save} className="formGrid"><input className="full" placeholder="ناونیشانی پۆست" value={form.title} onChange={e=>setForm({...form,title:e.target.value})} required/><select value={form.post_type} onChange={e=>setForm({...form,post_type:e.target.value})}><option value="product">کاڵا / خزمەت</option><option value="car">ئۆتۆمبێل</option></select>{profile.role==='super_admin'?<select value={form.section} onChange={e=>setForm({...form,section:e.target.value})}>{Object.keys(sections).filter(x=>x!=='customer').map(x=><option key={x} value={x}>{roleLabel(x)}</option>)}</select>:<div className="readonly">{roleLabel(profile.role)}</div>}<input type="number" placeholder="نرخ (د.ع)" value={form.price} onChange={e=>setForm({...form,price:e.target.value})}/><input placeholder="وەسف" value={form.description} onChange={e=>setForm({...form,description:e.target.value})}/>{form.post_type==='car'&&<><input placeholder="مارک" value={form.car_make} onChange={e=>setForm({...form,car_make:e.target.value})}/><input placeholder="مۆدێل" value={form.car_model} onChange={e=>setForm({...form,car_model:e.target.value})}/><input type="number" placeholder="ساڵ" value={form.car_year} onChange={e=>setForm({...form,car_year:e.target.value})}/><input type="number" placeholder="کیلۆمەتر" value={form.car_mileage} onChange={e=>setForm({...form,car_mileage:e.target.value})}/><input className="full" placeholder="شوێن" value={form.car_location} onChange={e=>setForm({...form,car_location:e.target.value})}/></>}<button className="primary full">پۆست بکە</button></form></Modal>}
 </>}
function Modal({title,close,children}){return <div className="modalBack"><div className="modal"><div className="panelHead"><h3>{title}</h3><button className="iconBtn" onClick={close}><X/></button></div>{children}</div></div>}

function Captains({profile,captains,reload,setNotice}){
 const [open,setOpen]=useState(false); const [email,setEmail]=useState(''); const [password,setPassword]=useState(''); const [fullName,setFullName]=useState(''); const [vehicle,setVehicle]=useState(''); const [plate,setPlate]=useState('')
 async function create(e){e.preventDefault(); setNotice(''); const {data,error}=await supabase.auth.signUp({email,password,options:{data:{full_name:fullName,role:'captain'}}}); if(error){setNotice(error.message);return} if(data.user){await supabase.from('profiles').update({full_name:fullName,role:'captain',parent_id:profile.id}).eq('id',data.user.id);await supabase.from('captains').insert({profile_id:data.user.id,owner_id:profile.id,vehicle,plate_number:plate});} setOpen(false); reload()}
 const mine=captains.filter(c=>profile.role==='super_admin'||c.owner_id===profile.id)
 return <><div className="sectionHead"><div><h2>کاپتنەکان</h2><p>کاپتنی تایبەت بە کارەکەت دروست و بەڕێوەی ببە.</p></div>{profile.role!=='customer'&&<button className="primary" onClick={()=>setOpen(true)}><Plus/> کاپتنی نوێ</button>}</div><div className="panel"><div className="table">{mine.map(c=><div className="tableRow" key={c.id}><div className="avatar"><Bike/></div><div><b>{c.vehicle||'کاپتن'}</b><small>{c.plate_number||'پلاک دیاری نەکراوە'}</small></div><span className={c.is_available?'pill success':'pill'}>{c.is_available?'بەردەست':'نابەردەست'}</span></div>)}{!mine.length&&<Empty/>}</div></div>
 {open&&<Modal title="دروستکردنی کاپتن" close={()=>setOpen(false)}><form onSubmit={create} className="formGrid"><input className="full" placeholder="ناوی کاپتن" value={fullName} onChange={e=>setFullName(e.target.value)} required/><input type="email" placeholder="ئیمەیڵ" value={email} onChange={e=>setEmail(e.target.value)} required/><input type="password" minLength="6" placeholder="وشەی نهێنی" value={password} onChange={e=>setPassword(e.target.value)} required/><input placeholder="ئۆتۆمبێل" value={vehicle} onChange={e=>setVehicle(e.target.value)}/><input placeholder="ژمارەی پلاک" value={plate} onChange={e=>setPlate(e.target.value)}/><button className="primary full">دروستی بکە</button></form></Modal>}</>
}

function Finance({profile,orders}){
 const scope=profile.role==='super_admin'?orders:orders.filter(o=>o.merchant_id===profile.id||o.captain_id===profile.id||o.customer_id===profile.id)
 const goods=scope.reduce((s,o)=>s+Number(o.goods_amount||0),0), delivery=scope.reduce((s,o)=>s+Number(o.delivery_fee||0),0), platform=scope.reduce((s,o)=>s+Number(o.platform_revenue||0),0)
 return <><div className="sectionHead"><div><h2>دارایی و حسابداری</h2><p>ڕوونکردنەوەی پارەی کاڵا، گەیاندن و پلاتفۆرم.</p></div></div><div className="financeGrid"><FinanceCard title="پارەی کاڵا / دوکاندار" value={goods} icon={ShoppingBasket}/><FinanceCard title="پارەی گەیاندن / کاپتن" value={delivery} icon={Bike}/><FinanceCard title="پارەی پلاتفۆرمی شاخ" value={platform} icon={Wallet}/></div><div className="panel"><div className="panelHead"><h3>وردەکاری ئۆردەرەکان</h3></div><div className="table"><div className="tableHeader"><span>کۆد</span><span>کاڵا</span><span>گەیاندن</span><span>شاخ</span><span>کۆی گشتی</span></div>{scope.map(o=><div className="tableRow financeRow" key={o.id}><span>#{o.id.slice(0,7)}</span><span>{money(o.goods_amount)}</span><span>{money(o.delivery_fee)}</span><span>{money(o.platform_revenue)}</span><b>{money(o.total_amount)}</b></div>)}</div></div></>
}
function FinanceCard({title,value,icon:Icon}){return <div className="financeCard"><div className="statIcon"><Icon/></div><small>{title}</small><strong>{money(value)}</strong><span>لە کۆی ئۆردەرەکان</span></div>}

createRoot(document.getElementById('root')).render(<App/>)
