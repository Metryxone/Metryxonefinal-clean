const BASE='http://localhost:8080';
const rint=(a,b)=>a+Math.floor(Math.random()*(b-a+1));
let ok=0,fail=0;
for(let i=0;i<15;i++){
  const st=await fetch(`${BASE}/api/capadex/session/start`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({concern_name:'exam stress',user_age:rint(15,22),guest_email:`mxrt_topup_${i}@example.com`})});
  if(!st.ok){fail++;continue;}
  const s=await st.json();const sid=s.session_id;const items=s.questions||[];
  if(!sid||!items.length){fail++;continue;}
  const responses=items.map(q=>({item_id:q.id,response_value:rint(1,5),response_time_ms:rint(1500,9000)}));
  const r=await fetch(`${BASE}/api/capadex/session/${sid}/respond`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({responses})});
  if(!r.ok){fail++;continue;}
  const c=await fetch(`${BASE}/api/capadex/session/${sid}/complete`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({})});
  if(c.ok)ok++;else fail++;
}
console.log('topup ok',ok,'fail',fail);
