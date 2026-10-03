const express=require('express');
const http=require('http');
const {Server}=require('socket.io');
const path=require('path');
const crypto=require('crypto');
const {loadState,persistState,hasSupabase,DATA_FILE,TABLE}=require('./storage');
const app=express();
const server=http.createServer(app);
const io=new Server(server);
function teacherPin(){
  const pin = String(process.env.TEACHER_PIN || '').trim();
  console.log('TEACHER_PIN configurado:', pin.length > 0, 'longitud:', pin.length);
  return pin;
}
app.use(express.static(path.join(__dirname,'public')));

const MAX_PER_ROLE=5;
const DEN=[1000000,500000,100000,10000];
const state={
  scene:'madera',stage:'lobby',room:'',
  company:{name:'',ask:0,bills:{},equity:0},
  participants:{}, teams:{}, offers:[], events:[],
  evaluations:{group:{investors:null,entrepreneurs:null},individual:{}},
  rounds:[],currentRound:1,
  timer:{running:false,seconds:0}
};

const money=n=>Number(n||0);
const clean=b=>{const r={};DEN.forEach(d=>{r[d]=Math.max(0,Math.min(999,Math.floor(Number((b||{})[d])||0)))});return r;};
const billsSum=b=>{b=clean(b);return DEN.reduce((t,d)=>t+d*b[d],0);};
const now=()=>new Date().toLocaleTimeString('es-CL',{hour:'2-digit',minute:'2-digit',second:'2-digit'});
function publicState(){return JSON.parse(JSON.stringify(state));}
function stateFor(socket){
  const full=publicState();
  if(socket?.data?.teacher)return full;
  // Participantes reciben solo el estado necesario para jugar.
  delete full.evaluations;
  delete full.rounds;
  delete full.events;
  full.participants=Object.fromEntries(Object.entries(full.participants||{}).map(([id,p])=>[id,{id:p.id,name:p.name,role:p.role,slot:p.slot}]));
  return full;
}
function broadcast(){for(const socket of io.sockets.sockets.values())socket.emit('state',stateFor(socket));}
function save(){persistState(state);}
function teacherOnly(socket){if(socket.data.teacher)return true;socket.emit('errorMsg','Acceso reservado al panel del profesor.');return false;}
function pinMatches(input){
  const configured=teacherPin();
  if(!configured)return false;
  const a=Buffer.from(String(input||''));const b=Buffer.from(configured);
  return a.length===b.length && crypto.timingSafeEqual(a,b);
}
function log(type,data){state.events.unshift({id:Date.now()+Math.random(),type,data,at:now()});state.events=state.events.slice(0,120);}
function roleCount(role){return Object.values(state.participants).filter(p=>p.role===role).length;}
function nextSlot(role){return role==='investor'?`Inversionista ${roleCount(role)+1}`:`Emprendedor ${roleCount(role)+1}`;}
function timerTick(){if(!state.timer.running)return;if(state.timer.seconds<=0){state.timer.running=false;log('timer','Tiempo terminado');broadcast();return;}state.timer.seconds--;broadcast();}
setInterval(timerTick,1000);

io.on('connection',socket=>{
  socket.emit('state',stateFor(socket));

  socket.on('teacherLogin',p=>{
    const configured=teacherPin();
    if(!configured)return socket.emit('teacherLoginError','El acceso del profesor aún no está configurado. Define TEACHER_PIN en Render y vuelve a desplegar/reiniciar el servicio.');
    if(!pinMatches(p?.pin))return socket.emit('teacherLoginError','Código de profesor incorrecto.');
    socket.data.teacher=true;
    socket.data.role='teacher';
    socket.emit('teacherAuthenticated');
    socket.emit('state',stateFor(socket));
  });

  socket.on('register',p=>{
    if(socket.data.teacher)return socket.emit('errorMsg','La sesión del profesor no puede registrarse como participante.');
    const role=p.role==='investor'||p.role==='entrepreneur'?p.role:null;
    if(!role)return socket.emit('errorMsg','Selecciona un rol.');
    const name=String(p.name||'').trim().slice(0,80);
    if(!name)return socket.emit('errorMsg','Escribe tu nombre.');
    if(roleCount(role)>=MAX_PER_ROLE)return socket.emit('errorMsg',`Ya hay ${MAX_PER_ROLE} ${role==='investor'?'inversionistas':'emprendedores'} registrados.`);
    const id=socket.id;
    const slot=nextSlot(role);
    socket.data.role=role;
    const participant={id,name,role,slot,budget:role==='investor'?Math.max(0,money(p.budget)||20000000):0,style:role==='investor'?String(p.style||'Inversionista').slice(0,80):'',joinedAt:now(),socketId:socket.id};
    state.participants[id]=participant;
    if(role==='investor')state.teams[id]={id,name,role,budget:participant.budget,slot,style:participant.style};
    if(!state.room)state.room=String(p.room||'A').slice(0,20);
    if(role==='entrepreneur' && !state.company.name && p.companyName){
      state.company={name:String(p.companyName).slice(0,80),ask:billsSum(p.bills),bills:clean(p.bills),equity:Math.max(1,Math.min(100,money(p.equity)||20))};
      log('session',`Empresa creada: ${state.company.name}`);
      save();
    }
    log('participant',`${slot}: ${name}`);
    save();
    socket.emit('registered',participant);
    broadcast();
  });

  socket.on('setCompany',p=>{
    const part=state.participants[socket.id];
    if(!part||part.role!=='entrepreneur')return socket.emit('errorMsg','Debes estar registrado como emprendedor.');
    if(state.company.name)return socket.emit('errorMsg','La empresa ya fue configurada.');
    const name=String(p.name||'').trim().slice(0,80);const ask=billsSum(p.bills);const equity=Math.max(1,Math.min(100,money(p.equity)||20));
    if(!name||ask<=0)return socket.emit('errorMsg','Completa nombre y monto solicitado.');
    state.company={name,ask,bills:clean(p.bills),equity};log('session',`Empresa creada: ${name}`);save();broadcast();
  });

  socket.on('scene',v=>{if(!teacherOnly(socket))return;if(['madera','moderna','londres','clasica','galactica','rascacielos','shark'].includes(v)){state.scene=v;save();broadcast();}});
  socket.on('stage',s=>{if(!teacherOnly(socket))return;if(['lobby','pitch','questions','negotiation','result'].includes(s)){state.stage=s;log('stage',s);save();broadcast();}});

  socket.on('offer',p=>{
    const part=state.participants[socket.id];const team=part&&state.teams[part.id];
    if(!team)return;
    const amount=billsSum(p.bills),equity=money(p.equity);
    if(amount<=0||equity<=0)return;
    if(amount>team.budget)return socket.emit('errorMsg','Oferta superior al capital disponible.');
    const offer={id:Date.now()+Math.random(),investorId:part.id,investor:team.name,role:team.role,slot:team.slot,bills:clean(p.bills),amount,equity,condition:String(p.condition||'').slice(0,120),status:'active',at:now()};
    state.offers.forEach(o=>{if(o.investorId===part.id&&o.status==='active')o.status='replaced';});
    state.offers.unshift(offer);log('offer',offer);save();broadcast();
  });
  socket.on('withdraw',p=>{const o=state.offers.find(x=>x.id===p.id);if(o&&o.status==='active'&&o.investorId===socket.id){o.status='withdrawn';log('withdraw',o);save();broadcast();}});
  socket.on('accept',p=>{const part=state.participants[socket.id];if(!part||part.role!=='entrepreneur')return;const o=state.offers.find(x=>x.id===p.id);if(!o)return;state.offers.forEach(x=>{if(x.status==='active')x.status='closed';});o.status='accepted';state.stage='result';log('accepted',o);save();broadcast();});
  socket.on('timer',p=>{if(!teacherOnly(socket))return;state.timer.running=!!p.running;if(p.seconds!=null)state.timer.seconds=Math.max(0,Number(p.seconds)||0);save();broadcast();});

  socket.on('saveEvaluation',p=>{
    if(!teacherOnly(socket))return;
    const validGroup=p.scope==='group'&&(p.group==='investors'||p.group==='entrepreneurs');
    const validIndividual=p.scope==='individual'&&state.participants[p.participantId];
    if(!validGroup&&!validIndividual)return;
    const key=validGroup?p.group:p.participantId;
    state.evaluations[validGroup?'group':'individual'][key]={scores:p.scores||{},total:Number(p.total)||0,updatedAt:now()};
    log('evaluation',validGroup?`Evaluación grupal: ${p.group} (${Number(p.total)||0}/100)`: `Evaluación individual: ${state.participants[key].name} (${Number(p.total)||0}/100)`);
    save();
    broadcast();
  });

  socket.on('reset',()=>{
    if(!teacherOnly(socket))return;
    const hasRoundData=Object.keys(state.participants||{}).length||state.company?.name||state.evaluations?.group?.investors||state.evaluations?.group?.entrepreneurs||Object.keys(state.evaluations?.individual||{}).length;
    if(hasRoundData){
      const participants=Object.values(state.participants||{}).map(p=>({id:p.id,name:p.name,role:p.role,slot:p.slot,style:p.style||'',budget:p.budget||0}));
      state.rounds=Array.isArray(state.rounds)?state.rounds:[];
      state.rounds.push({number:Number(state.currentRound)||state.rounds.length+1,closedAt:new Date().toISOString(),company:JSON.parse(JSON.stringify(state.company||{})),participants,evaluations:JSON.parse(JSON.stringify(state.evaluations||{}))});
    }
    state.currentRound=(Number(state.currentRound)||1)+1;
    state.stage='lobby';state.offers=[];state.events=[];state.company={name:'',ask:0,bills:{},equity:0};state.participants={};state.teams={};state.evaluations={group:{investors:null,entrepreneurs:null},individual:{}};state.timer={running:false,seconds:0};
    save();broadcast();
  });
  socket.on('disconnect',()=>{ /* Conservamos el registro para que el profesor pueda evaluar. */ });
});

const PORT=process.env.PORT||3000;

async function start(){
  try{
    const saved=await loadState();
    if(saved){
      Object.assign(state,saved);
      if(!Array.isArray(state.rounds))state.rounds=[];
      if(!Number(state.currentRound))state.currentRound=state.rounds.length+1;
      if(!state.evaluations)state.evaluations={group:{investors:null,entrepreneurs:null},individual:{}};
      // Nunca reanudar un temporizador automáticamente después de un reinicio.
      state.timer={...(state.timer||{}),running:false};
      console.log(`[storage] Estado recuperado${hasSupabase?' desde Supabase':' desde '+DATA_FILE}.`);
    }else{
      console.log(`[storage] Sin estado previo. Las evaluaciones nuevas se guardarán${hasSupabase?' en Supabase':' en '+DATA_FILE}.`);
    }
  }catch(err){
    console.error('[storage] No se pudo recuperar el estado:',err.message);
  }
  server.listen(PORT,()=>console.log(`Shark Tank Aula en ${PORT}`));
}
start();
