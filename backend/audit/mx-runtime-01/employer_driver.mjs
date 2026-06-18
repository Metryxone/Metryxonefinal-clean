const BASE='http://localhost:8080';
const pc=(sc)=>!sc?'':sc.split(',').map(c=>c.split(';')[0].trim()).filter(c=>c.includes('=')).join('; ');
const rint=(a,b)=>a+Math.floor(Math.random()*(b-a+1));
const skills=[['python','sql'],['java','spring'],['react','node'],['design','figma']];
const stats={register:false,orgActivated:false,candidatesAdded:0,searches:0,searchResultsTotal:0,analytics:false};

// 1. register employer user
const email='mxrt_employer_01@example.com';
let r=await fetch(`${BASE}/api/register`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:email,email,password:'DemoSeed123!',fullName:'MX Demo Employer',role:'employer'})});
if(r.status===400)r=await fetch(`${BASE}/api/login`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:email,password:'DemoSeed123!'})});
const cookie=pc(r.headers.get('set-cookie'));
stats.register=r.ok||!!cookie;
const H={'Content-Type':'application/json','Cookie':cookie};

// 2. activate employer org
let er=await fetch(`${BASE}/api/employer/register`,{method:'POST',headers:H,body:JSON.stringify({companyName:'[DEMO] MX Talent Co'})});
const ej=await er.json().catch(()=>({}));
stats.orgActivated=er.ok&&ej.success;

// 3. populate candidate pool with demo candidates (real endpoint)
for(let i=1;i<=8;i++){
  const cr=await fetch(`${BASE}/api/employer/candidates`,{method:'POST',headers:H,body:JSON.stringify({
    name:`MX Demo Talent ${i}`,email:`mxrt_cand_${String(i).padStart(3,'0')}@example.com`,
    location:'Bengaluru',currentRole:'Analyst',experience:`${rint(1,6)} yrs`,
    skills:skills[i%skills.length],education:'BTech',stage:'Applied',source:'Demo Seed'})});
  if(cr.ok)stats.candidatesAdded++;
}

// 4. run 10 employer SEARCH operations over the candidate pool
for(let i=0;i<10;i++){
  const s=await fetch(`${BASE}/api/employer/candidates`,{headers:H});
  if(s.ok){stats.searches++;const arr=await s.json().catch(()=>[]);stats.searchResultsTotal+=Array.isArray(arr)?arr.length:0;}
}
// bonus: analytics read (employer intelligence operation)
const an=await fetch(`${BASE}/api/employer/analytics`,{headers:H});
stats.analytics=an.ok;

console.log('EMPLOYER '+JSON.stringify(stats));
