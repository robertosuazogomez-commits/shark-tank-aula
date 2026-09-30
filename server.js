const express=require('express');
const http=require('http');
const {Server}=require('socket.io');
const path=require('path');
const app=express(); const server=http.createServer(app); const io=new Server(server);
app.use(express.static(path.join(__dirname,'public')));
const state={stage:'lobby',room:'',company:{name:'',ask:0,equity:0},teams:{},offers:[],events:[],timer:{running:false,seconds:0}};
const money=n=>Number(n||0);
const DEN=[1000000,500000,100000,10000];
const clean=b=>{const r={};DEN.forEach(d=>{r[d]=Math.max(0,Math.min(999,Math.floor(Number((b||{})[d])||0)))});return r;};
const billsSum=b=>{b=clean(b);return DEN.reduce((t,d)=>t+d*b[d],0);};
function publicState(){return JSON.parse(JSON.stringify(state));}
function broadcast(){io.emit('state',publicState());}
function log(type,data){state.events.unshift({id:Date.now()+Math.random(),type,data,at:new Date().toLocaleTimeString('es-CL',{hour:'2-digit',minute:'2-digit',second:'2-digit'})});state.events=state.events.slice(0,80);}
function timerTick(){if(!state.timer.running)return; if(state.timer.seconds<=0){state.timer.running=false;log('timer','Tiempo terminado');broadcast();return;} state.timer.seconds--; broadcast();}
setInterval(timerTick,1000);
io.on('connection',socket=>{
 socket.emit('state',publicState());
 socket.on('setSession',p=>{state.room=p.room||''; state.company={name:p.name||'',ask:billsSum(p.bills),bills:clean(p.bills),equity:money(p.equity)}; log('session',`Sala ${state.room}: ${state.company.name}`); broadcast();});
 socket.on('stage',s=>{state.stage=s; log('stage',s); broadcast();});
 socket.on('setTeam',p=>{state.teams[p.id]={id:p.id,name:p.name||`Equipo ${p.id}`,role:p.role||'investor',budget:money(p.budget)||20000000}; log('team',state.teams[p.id].name); broadcast();});
 socket.on('offer',p=>{
   const team=state.teams[p.investorId]; if(!team)return;
   const amount=billsSum(p.bills), equity=money(p.equity); if(amount<=0||equity<=0)return;
   if(amount>team.budget){socket.emit('errorMsg','Oferta superior al capital disponible.');return;}
   const offer={id:Date.now()+Math.random(),investorId:p.investorId,investor:team.name,role:team.role,bills:clean(p.bills),amount,equity,condition:(p.condition||'').slice(0,120),status:'active',at:new Date().toLocaleTimeString('es-CL',{hour:'2-digit',minute:'2-digit',second:'2-digit'})};
   state.offers.forEach(o=>{if(o.investorId===p.investorId&&o.status==='active')o.status='replaced';}); state.offers.unshift(offer); log('offer',offer); broadcast();
 });
 socket.on('withdraw',p=>{const o=state.offers.find(x=>x.id===p.id); if(o&&o.status==='active'){o.status='withdrawn';log('withdraw',o);broadcast();}});
 socket.on('accept',p=>{const o=state.offers.find(x=>x.id===p.id); if(!o)return; state.offers.forEach(x=>{if(x.status==='active')x.status='closed';});o.status='accepted';state.stage='result';log('accepted',o);broadcast();});
 socket.on('timer',p=>{state.timer.running=!!p.running; if(p.seconds!=null)state.timer.seconds=Number(p.seconds); broadcast();});
 socket.on('reset',()=>{state.stage='lobby';state.offers=[];state.events=[];state.company={name:'',ask:0,equity:0};state.timer={running:false,seconds:0};broadcast();});
});
const PORT=process.env.PORT||3000; server.listen(PORT,()=>console.log(`Shark Tank Aula v2 en ${PORT}`));
