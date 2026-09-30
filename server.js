const express=require('express');const http=require('http');const{Server}=require('socket.io');const path=require('path');
const app=express(),server=http.createServer(app),io=new Server(server);app.use(express.static(path.join(__dirname,'public')));
const fresh=()=>({stage:'lobby',round:1,room:'',company:{name:'',ask:0,equity:0},teams:{},offers:[],events:[],timer:{running:false,seconds:0},screenClear:false});
const state=fresh();const money=n=>Number(n||0);const publicState=()=>JSON.parse(JSON.stringify(state));const broadcast=()=>io.emit('state',publicState());
function log(type,data){state.events.unshift({id:Date.now()+Math.random(),type,data,at:new Date().toLocaleTimeString('es-CL',{hour:'2-digit',minute:'2-digit',second:'2-digit'})});state.events=state.events.slice(0,80)}
function resetRound(){state.stage='lobby';state.offers=[];state.events=[];state.company={name:'',ask:0,equity:0};state.timer={running:false,seconds:0};state.screenClear=false}
function timerTick(){if(!state.timer.running)return;if(state.timer.seconds<=0){state.timer.running=false;log('Tiempo terminado','');broadcast();return}state.timer.seconds--;broadcast()}
setInterval(timerTick,1000);
io.on('connection',socket=>{
 socket.emit('state',publicState());
 socket.on('setSession',p=>{state.room=p.room||state.room;state.company={name:p.name||'',ask:money(p.ask),equity:money(p.equity)};state.screenClear=false;log('Emprendimiento',state.company.name);broadcast()});
 socket.on('stage',s=>{if(['pitch','questions','negotiation','result'].includes(s)){state.stage=s;state.screenClear=false;log('Etapa',s);broadcast()}});
 socket.on('setTeam',p=>{state.teams[p.id]={id:p.id,name:p.name||`Equipo ${p.id}`,role:p.role||'investor',budget:money(p.budget)||100};log('Inversionista',state.teams[p.id].name);broadcast()});
 socket.on('offer',p=>{if(state.screenClear){socket.emit('errorMsg','El profesor ha limpiado la pantalla. Espera la nueva acción.');return}const team=state.teams[p.investorId];if(!team)return;const amount=money(p.amount),equity=money(p.equity);if(amount<=0||equity<=0)return;if(amount>team.budget){socket.emit('errorMsg','Oferta superior al capital disponible.');return}state.offers.forEach(o=>{if(o.investorId===p.investorId&&o.status==='active')o.status='replaced'});const offer={id:Date.now()+Math.random(),investorId:p.investorId,investor:team.name,amount,equity,condition:(p.condition||'').slice(0,120),status:'active',at:new Date().toLocaleTimeString('es-CL',{hour:'2-digit',minute:'2-digit',second:'2-digit'})};state.offers.unshift(offer);log('Oferta',offer.investor+' — $'+offer.amount+' M');broadcast()});
 socket.on('withdraw',p=>{const o=state.offers.find(x=>x.id===p.id);if(o&&o.status==='active'){o.status='withdrawn';log('Oferta retirada',o.investor);broadcast()}});
 socket.on('accept',p=>{const o=state.offers.find(x=>x.id===p.id);if(!o)return;state.offers.forEach(x=>{if(x.status==='active')x.status='closed'});o.status='accepted';state.stage='result';log('Oferta aceptada',o.investor);broadcast()});
 socket.on('round',dir=>{let r=Math.max(1,Math.min(99,state.round+Number(dir||0)));if(r!==state.round){state.round=r;resetRound();log('Cambio de ronda','Ronda '+r);broadcast()}});
 socket.on('clearScreen',()=>{state.screenClear=true;state.timer.running=false;log('Pantalla','Limpiada por el profesor');broadcast()});
 socket.on('resetRound',()=>{resetRound();log('Ronda','Reiniciada');broadcast()});
 socket.on('resetAll',()=>{Object.assign(state,fresh());broadcast()});
 socket.on('timer',p=>{state.timer.running=!!p.running;if(p.seconds!=null)state.timer.seconds=Math.max(0,Number(p.seconds));broadcast()});
});
const PORT=process.env.PORT||3000;server.listen(PORT,()=>console.log(`Shark Tank Aula funcionando en ${PORT}`));
