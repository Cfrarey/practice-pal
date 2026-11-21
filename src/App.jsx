import React, { useEffect, useRef, useState } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY
  ? createClient(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY)
  : null;
const studentColumns = 'id,family_id,name,instrument,weekly_goal_minutes,created_at';
const sessionColumns = 'id,family_id,student_id,practice_date,minutes,category,focus,notes,created_at';
const instruments = ['Piano','Guitar','Violin','Viola','Cello','Flute','Clarinet','Saxophone','Trumpet','Trombone','French Horn','Drums','Percussion','Voice','Other'];
const categories = ['Other','Warm-up','Scales','Technique','Repertoire','Sight Reading','Ear Training','Performance Preparation'];
const palette = { navy:'#172554',blue:'#2563eb',purple:'#7c3aed',bg:'#f3f6ff',gray:'#64748b',border:'#e2e8f0',green:'#15803d',red:'#b91c1c' };
const style = {
  page:{minHeight:'100vh',background:palette.bg,color:palette.navy,fontFamily:'Arial,sans-serif',padding:'20px 14px',boxSizing:'border-box'},
  shell:{maxWidth:1100,margin:'0 auto'},
  card:{background:'#fff',border:`1px solid ${palette.border}`,borderRadius:18,padding:22,marginBottom:16},
  button:{background:palette.blue,color:'#fff',border:0,borderRadius:10,padding:'12px 18px',fontSize:15,fontWeight:700,cursor:'pointer'},
  secondary:{background:'#fff',color:palette.navy,border:`1px solid ${palette.border}`,borderRadius:10,padding:'11px 15px',cursor:'pointer'},
  input:{display:'block',width:'100%',boxSizing:'border-box',padding:12,marginTop:6,marginBottom:16,border:`1px solid ${palette.border}`,borderRadius:10,fontSize:16,background:'#fff'}
};
const blankStudent = {name:'',instrument:'',weekly_goal_minutes:'60'};
const blankEntry = {student_id:'',practice_date:'',minutes:'',category:'Other',focus:'',notes:''};
function localDate(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
}
function parseLocalDate(value) {
  const [y,m,d] = value.split('-').map(Number);
  return new Date(y,m-1,d);
}
function mondayOf(date = new Date()) {
  const d = new Date(date.getFullYear(),date.getMonth(),date.getDate());
  d.setDate(d.getDate() - (d.getDay()+6)%7);
  return d;
}
function sundayOf(monday) {
  const d = new Date(monday);
  d.setDate(d.getDate()+6);
  return d;
}
function formatDate(date) {return date.toLocaleDateString(undefined,{month:'short',day:'numeric',year:'numeric'});}
function formatClock(seconds) {
  const n = Math.max(0,Math.floor(seconds));
  const h=Math.floor(n/3600),m=Math.floor((n%3600)/60),s=n%60;
  const two = v => String(v).padStart(2,'0');
  return h ? `${two(h)}:${two(m)}:${two(s)}` : `${two(m)}:${two(s)}`;
}
function weeklyMinutes(sessions,studentId,monday) {
  const first=localDate(monday),last=localDate(sundayOf(monday));
  return sessions.filter(s=>s.student_id===studentId&&s.practice_date>=first&&s.practice_date<=last)
    .reduce((sum,s)=>sum+Number(s.minutes||0),0);
}
function Progress({value,goal}) {
  const pct=goal>0?Math.min(100,Math.round(value/goal*100)):0;
  return <div><div style={{display:'flex',justifyContent:'space-between',fontSize:13,marginBottom:8}}><span>{value} / {goal} minutes</span><strong>{pct}%</strong></div><div style={{height:11,borderRadius:20,background:palette.border,overflow:'hidden'}}><div style={{width:`${pct}%`,height:'100%',background:palette.purple}}/></div></div>;
}
function FormField({label,id,children}) {return <label htmlFor={id} style={{display:'block',fontWeight:600}}>{label}{children}</label>;}

export default function App() {
  const [session,setSession]=useState(null),[authLoading,setAuthLoading]=useState(true);
  const [email,setEmail]=useState(''),[password,setPassword]=useState(''),[authError,setAuthError]=useState('');
  const [familyId,setFamilyId]=useState(null),[familyLoading,setFamilyLoading]=useState(false),[familyError,setFamilyError]=useState('');
  const [students,setStudents]=useState([]),[sessions,setSessions]=useState([]),[dataLoading,setDataLoading]=useState(false);
  const [studentError,setStudentError]=useState(''),[sessionError,setSessionError]=useState(''),[notice,setNotice]=useState('');
  const [tab,setTab]=useState('dashboard'),[busy,setBusy]=useState(false);
  const [screen,setScreen]=useState(() => { try { return sessionStorage.getItem('practice_pal_roster') ? 'splash' : 'family-login'; } catch { return 'family-login'; } });
  const [transitioning,setTransitioning]=useState(false);
  const [studentForm,setStudentForm]=useState({...blankStudent}),[editingId,setEditingId]=useState(null),[formOpen,setFormOpen]=useState(false);
  const [manualOpen,setManualOpen]=useState(false),[entry,setEntry]=useState({...blankEntry,practice_date:localDate()});
  const [selectedStudentId,setSelectedStudentId]=useState(''),[timerMode,setTimerMode]=useState('up'),[targetMinutes,setTargetMinutes]=useState(15);
  const [timerStatus,setTimerStatus]=useState('idle'),[elapsedSeconds,setElapsedSeconds]=useState(0);
  const [category,setCategory]=useState('Other'),[focus,setFocus]=useState(''),[notes,setNotes]=useState('');
  const [pinStatus,setPinStatus]=useState({}),[pinValues,setPinValues]=useState({}),[pinBusy,setPinBusy]=useState(false);
  const [reportStudent,setReportStudent]=useState('all'),[reportMonday,setReportMonday]=useState(localDate(mondayOf()));
  const elapsedMs=useRef(0),startedAt=useRef(null),statusRef=useRef('idle'),secondsRef=useRef(0),savingRef=useRef(false),timerOwner=useRef(null);
  const userId=session?.user?.id??null;
  const thisMonday=mondayOf();
  const reportStart=parseLocalDate(reportMonday);
  const reportEnd=sundayOf(reportStart);
  const weekSessions=sessions.filter(s=>s.practice_date>=reportMonday&&s.practice_date<=localDate(reportEnd)&& (reportStudent==='all'||s.student_id===reportStudent));
  const reportStudents=students.filter(s=>reportStudent==='all'||s.id===reportStudent);
  const reportTotal=weekSessions.reduce((sum,s)=>sum+Number(s.minutes||0),0);
  const selectedStudent=students.find(s=>s.id===selectedStudentId);
  const selectedSessions=sessions.filter(s=>s.student_id===selectedStudentId);
  const totalGoal=students.reduce((sum,s)=>sum+Number(s.weekly_goal_minutes||0),0);
  const weeklyTotal=students.reduce((sum,s)=>sum+weeklyMinutes(sessions,s.id,thisMonday),0);
  const remaining=Math.max(0,targetMinutes*60-elapsedSeconds);
  const display=timerMode==='down'?formatClock(remaining):formatClock(elapsedSeconds);

  function setStatus(v){statusRef.current=v;setTimerStatus(v);}
  function resetClock(){elapsedMs.current=0;startedAt.current=null;secondsRef.current=0;setElapsedSeconds(0);timerOwner.current=null;setStatus('idle');}
  function hasUnsaved(){return statusRef.current!=='idle'&&(secondsRef.current>0||startedAt.current!==null);}

  useEffect(()=>{
    if(!supabase){setAuthError('Supabase environment variables are missing.');setAuthLoading(false);return;}
    let active=true;
    supabase.auth.getSession().then(({data,error})=>{if(!active)return;if(error)setAuthError(error.message);setSession(data.session);if(data.session&&!data.session.user?.is_anonymous)setScreen('parent-dashboard');setAuthLoading(false);});
    const {data:{subscription}}=supabase.auth.onAuthStateChange((_event,next)=>{if(active){setSession(next);setAuthLoading(false);}});
    return()=>{active=false;subscription.unsubscribe();};
  },[]);
  useEffect(()=>{
    setFamilyId(null);setFamilyError('');setStudents([]);setSessions([]);setSelectedStudentId('');setStudentError('');setSessionError('');setNotice('');setTab('dashboard');setFormOpen(false);setManualOpen(false);resetClock();
    if(!supabase||!userId||session?.user?.is_anonymous){setFamilyLoading(false);return;}
    let cancelled=false;setFamilyLoading(true);
    (async()=>{const {data,error}=await supabase.from('family_members').select('family_id').eq('user_id',userId);
      if(cancelled)return;
      if(error)setFamilyError(error.message);
      else if(data?.length!==1)setFamilyError('Expected exactly one family membership.');
      else setFamilyId(data[0].family_id);
      setFamilyLoading(false);
    })();
    return()=>{cancelled=true;};
  },[userId]);
  useEffect(()=>{
    if(!supabase||!familyId||!userId){setDataLoading(false);return;}
    let cancelled=false;setDataLoading(true);setStudentError('');setSessionError('');
    (async()=>{
      const [a,b]=await Promise.all([
        supabase.from('students').select(studentColumns).eq('family_id',familyId).order('name'),
        supabase.from('practice_sessions').select(sessionColumns).eq('family_id',familyId).order('practice_date',{ascending:false}).order('created_at',{ascending:false})
      ]);
      if(cancelled)return;
      if(a.error)setStudentError(a.error.message);else setStudents(a.data??[]);
      if(b.error)setSessionError(b.error.message);else setSessions(b.data??[]);
      setDataLoading(false);
    })();
    return()=>{cancelled=true;};
  },[userId,familyId]);
  useEffect(()=>{if(selectedStudentId&&!students.some(s=>s.id===selectedStudentId))setSelectedStudentId('');},[students,selectedStudentId]);
  useEffect(()=>{
    if(timerStatus!=='running')return;
    function tick(){if(startedAt.current===null)return;
      const ms=elapsedMs.current+Math.max(0,Date.now()-startedAt.current);
      if(timerMode==='down'&&ms>=targetMinutes*60000){elapsedMs.current=targetMinutes*60000;startedAt.current=null;secondsRef.current=targetMinutes*60;setElapsedSeconds(targetMinutes*60);setStatus('finished');return;}
      const secs=Math.floor(ms/1000);secondsRef.current=secs;setElapsedSeconds(secs);
    }
    tick();const interval=setInterval(tick,250);return()=>clearInterval(interval);
  },[timerStatus,timerMode,targetMinutes]);
  useEffect(()=>{
    const beforeUnload=e=>{if(hasUnsaved()){e.preventDefault();e.returnValue='';}};
    window.addEventListener('beforeunload',beforeUnload);return()=>window.removeEventListener('beforeunload',beforeUnload);
  },[]);

  async function refreshStudents(){const {data,error}=await supabase.from('students').select(studentColumns).eq('family_id',familyId).order('name');if(error){setStudentError(error.message);return false;}setStudents(data??[]);return true;}
  async function refreshSessions(){const {data,error}=await supabase.from('practice_sessions').select(sessionColumns).eq('family_id',familyId).order('practice_date',{ascending:false}).order('created_at',{ascending:false});if(error){setSessionError(error.message);return false;}setSessions(data??[]);return true;}
  // The first family sign-in identifies a family, captures a minimal roster, and
  // signs out immediately. The splash screen NEVER retains a parent auth session.
  async function signIn(e){
    e.preventDefault();if(!supabase||transitioning)return;
    setTransitioning(true);setAuthError('');
    try{
      const {data:login,error:loginError}=await supabase.auth.signInWithPassword({email,password});
      if(loginError)throw loginError;
      if(!login?.user||login.user.is_anonymous)throw new Error('A parent account is required.');
      const {data:members,error:memberError}=await supabase.from('family_members').select('family_id').eq('user_id',login.user.id);
      if(memberError)throw memberError;
      if(members?.length!==1)throw new Error('Expected exactly one family membership.');
      const {data:roster,error:rosterError}=await supabase.from('students').select('id,name,instrument').eq('family_id',members[0].family_id).order('name');
      if(rosterError)throw rosterError;
      sessionStorage.setItem('practice_pal_roster',JSON.stringify(roster??[]));
      const {error:logoutError}=await supabase.auth.signOut();
      if(logoutError)throw logoutError;
      setPassword('');setScreen('splash');
    }catch(error){setAuthError(error.message||String(error));
      // Do not leave a privileged parent session active after failed family setup.
      await supabase.auth.signOut();
    }finally{setTransitioning(false);}
  }
  async function unlockParent(e){
    e.preventDefault();if(!supabase||transitioning)return;
    setTransitioning(true);setAuthError('');
    const {data,error}=await supabase.auth.signInWithPassword({email,password});
    if(error){setAuthError(error.message);setTransitioning(false);return;}
    if(data?.user?.is_anonymous){await supabase.auth.signOut();setAuthError('Parent credentials required.');setTransitioning(false);return;}
    setPassword('');setScreen('parent-dashboard');setTransitioning(false);
  }
  async function signOut(){
    if(!supabase||savingRef.current||transitioning)return;
    if(hasUnsaved()&&!window.confirm('Discard unsaved practice time?'))return;
    setTransitioning(true);setAuthError('');
    const {error}=await supabase.auth.signOut();
    if(error)setAuthError(error.message);
    else{setPassword('');setScreen(sessionStorage.getItem('practice_pal_roster')?'splash':'family-login');}
    setTransitioning(false);
  }
  async function chooseMode(){
    if(!supabase||transitioning||savingRef.current)return;
    if(hasUnsaved()&&!window.confirm('Discard unsaved practice time and return to the welcome screen?'))return;
    setTransitioning(true);setAuthError('');
    if(students.length)sessionStorage.setItem('practice_pal_roster',JSON.stringify(students.map(s=>({id:s.id,name:s.name,instrument:s.instrument}))));
    const {error}=await supabase.auth.signOut();
    if(error)setAuthError(error.message);else{setPassword('');setScreen('splash');}
    setTransitioning(false);
  }
  function finishTimer(){if(!['running','paused'].includes(statusRef.current))return;if(statusRef.current==='running'){elapsedMs.current+=Math.max(0,Date.now()-startedAt.current);startedAt.current=null;}if(timerMode==='down')elapsedMs.current=Math.min(elapsedMs.current,targetMinutes*60000);secondsRef.current=Math.floor(elapsedMs.current/1000);setElapsedSeconds(secondsRef.current);setStatus('finished');}
  function resetTimer(){if(savingRef.current)return;if(hasUnsaved()&&!window.confirm('Discard unsaved practice time?'))return;resetClock();setCategory('Other');setFocus('');setNotes('');setSessionError('');}

  async function insertPractice(payload,source){
    if(!supabase||!familyId||savingRef.current)return false;
    savingRef.current=true;setBusy(true);setSessionError('');setNotice('');
    try{
      const {data,error}=await supabase.from('practice_sessions').insert(payload).select('id');
      if(error){setSessionError(error.message);return false;}
      if(data?.length!==1){setSessionError('Save could not be confirmed. Check the practice log before trying again.');return false;}
      if(source==='timer'){resetClock();setCategory('Other');setFocus('');setNotes('');}
      if(source==='manual'){setManualOpen(false);setEntry({...blankEntry,practice_date:localDate()});}
      setNotice(`🎉 ${payload.minutes} minute(s) saved to the practice log!`);
      await refreshSessions();return true;
    }finally{savingRef.current=false;setBusy(false);}
  }
  async function saveTimer(){
    if(statusRef.current!=='finished'||savingRef.current)return;
    if(timerOwner.current!==userId){setSessionError('Authentication changed. Sign in again.');return;}
    const student=students.find(s=>s.id===selectedStudentId&&s.family_id===familyId);
    if(!student){setSessionError('Select a valid family student.');return;}
    if(secondsRef.current<1){setSessionError('Practice for at least one second.');return;}
    await insertPractice({family_id:familyId,student_id:student.id,practice_date:localDate(),minutes:Math.ceil(secondsRef.current/60),category,focus:focus.trim()||null,notes:notes.trim()||null},'timer');
  }
  async function saveManual(e){
    e.preventDefault();if(savingRef.current)return;
    const student=students.find(s=>s.id===entry.student_id&&s.family_id===familyId);
    const minutes=Number(entry.minutes);
    if(!student){setSessionError('Choose a valid student.');return;}
    if(!Number.isSafeInteger(minutes)||minutes<1||minutes>1440){setSessionError('Enter 1 to 1,440 whole minutes.');return;}
    if(!/^\d{4}-\d{2}-\d{2}$/.test(entry.practice_date)||localDate(parseLocalDate(entry.practice_date))!==entry.practice_date||entry.practice_date>localDate()){
      setSessionError('Choose a valid practice date that is not in the future.');return;
    }
    await insertPractice({family_id:familyId,student_id:student.id,practice_date:entry.practice_date,minutes,category:entry.category,focus:entry.focus.trim()||null,notes:entry.notes.trim()||null},'manual');
  }
  function addStudent(){setEditingId(null);setStudentForm({...blankStudent});setFormOpen(true);setStudentError('');setTab('students');}
  function editStudent(student){setEditingId(student.id);setStudentForm({name:student.name??'',instrument:student.instrument??'',weekly_goal_minutes:String(student.weekly_goal_minutes??60)});setFormOpen(true);setStudentError('');setTab('students');}
  function cancelForm(){setEditingId(null);setStudentForm({...blankStudent});setFormOpen(false);}
  async function saveStudent(e){
    e.preventDefault();if(!supabase||!familyId||busy)return;
    const name=studentForm.name.trim(),instrument=studentForm.instrument.trim(),goal=Number(studentForm.weekly_goal_minutes);
    if(!name||!instrument||!String(studentForm.weekly_goal_minutes).trim()||!Number.isSafeInteger(goal)||goal<0||goal>10080){setStudentError('Enter a name, instrument and valid weekly goal.');return;}
    setBusy(true);setStudentError('');setNotice('');const wasEditing=Boolean(editingId);
    const payload={name,instrument,weekly_goal_minutes:goal};
    const result=editingId
      ?await supabase.from('students').update(payload).eq('id',editingId).eq('family_id',familyId).select('id')
      :await supabase.from('students').insert({...payload,family_id:familyId}).select('id');
    if(result.error)setStudentError(result.error.message);
    else if(result.data?.length!==1)setStudentError('Student change could not be confirmed.');
    else{cancelForm();if(await refreshStudents())setNotice(wasEditing?'Student updated.':'Student added.');}
    setBusy(false);
  }
  async function deleteStudent(student){
    if(!supabase||!familyId||busy)return;
    if(selectedStudentId===student.id&&hasUnsaved()){setStudentError('Finish or reset this student’s timer before deleting.');return;}
    if(!window.confirm(`Delete ${student.name}? Existing practice history may also be affected.`))return;
    setBusy(true);setStudentError('');setNotice('');
    const {data,error}=await supabase.from('students').delete().eq('id',student.id).eq('family_id',familyId).select('id');
    if(error)setStudentError(error.message);
    else if(data?.length!==1)setStudentError('Deletion could not be confirmed.');
    else{if(editingId===student.id)cancelForm();await refreshStudents();await refreshSessions();setNotice('Student deleted.');}
    setBusy(false);
  }
  function openManual(studentId='') {setEntry({...blankEntry,student_id:studentId||selectedStudentId||'',practice_date:localDate()});setManualOpen(true);setSessionError('');setTab('practice');}

  useEffect(()=>{
    if(!familyId||session?.user?.is_anonymous)return;
    let active=true;
    supabase.rpc('parent_student_pin_status').then(({data,error})=>{
      if(active&&!error)setPinStatus(Object.fromEntries((data||[]).map(x=>[x.student_id,x.has_pin])));
    });
    return()=>{active=false;};
  },[familyId,students,session?.user?.is_anonymous]);
  async function setStudentPin(student){
    const pin=pinValues[student.id]||'';
    if(!/^[0-9]{6}$/.test(pin)){setStudentError('Enter exactly six digits for the student PIN.');return;}
    setPinBusy(true);setStudentError('');
    const {error}=await supabase.rpc('parent_set_student_pin',{p_student_id:student.id,p_pin:pin});
    if(error)setStudentError(error.message);
    else {setPinValues(p=>({...p,[student.id]:''}));setPinStatus(p=>({...p,[student.id]:true}));setNotice(`PIN updated for ${student.name}.`);}
    setPinBusy(false);
  }
  async function enterStudentMode(){
    if(!supabase||transitioning)return;
    setTransitioning(true);setAuthError('');
    // Splash is accessible only after the parent session has been signed out.
    const {data:current}=await supabase.auth.getSession();
    if(current.session){setAuthError('Please sign out of Parent Mode before entering Student Mode.');setTransitioning(false);return;}
    const {error}=await supabase.auth.signInAnonymously();
    if(error)setAuthError('Enable Anonymous Sign-ins in Supabase Authentication: '+error.message);
    setTransitioning(false);
  }
  async function returnToParent(){
    if(!supabase||transitioning)return;
    setTransitioning(true);setAuthError('');
    const {error}=await supabase.auth.signOut();
    if(error)setAuthError(error.message);
    else{setPassword('');setScreen('splash');}
    setTransitioning(false);
  }

  function exportPdf(){
    // Browser-native PDF output: print dialog -> Save as PDF. No dependency or server required.
    if(dataLoading||studentError||sessionError){setNotice('Resolve data loading errors before exporting a report.');return;}
    const safe = value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
    const names=Object.fromEntries(students.map(s=>[s.id,s.name]));
    const days=['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];
    const rows=days.map((day,i)=>{
      const d=new Date(reportStart);d.setDate(d.getDate()+i);const date=localDate(d);
      const records=weekSessions.filter(s=>s.practice_date===date);
      const mins=records.reduce((sum,s)=>sum+Number(s.minutes||0),0);
      const details=records.map(s=>`${names[s.student_id]??'Student'}: ${s.category}${s.focus?' — '+s.focus:''}${s.notes?' ('+s.notes+')':''}`).join('; ');
      return `<tr><td>${day}<br><small>${safe(date)}</small></td><td>${mins||'—'}</td><td>${safe(details)||'—'}</td></tr>`;
    }).join('');
    const studentSummary=reportStudents.map(s=>`<tr><td>${safe(s.name)}</td><td>${safe(s.instrument)}</td><td>${weeklyMinutes(weekSessions,s.id,reportStart)}</td><td>${Number(s.weekly_goal_minutes)||0}</td></tr>`).join('');
    const html=`<!doctype html><html><head><meta charset="utf-8"><title>Practice Pal Weekly Report</title><style>
      @page{size:letter;margin:0.65in}body{font-family:Arial,sans-serif;color:#172554;font-size:11pt}h1{margin-bottom:3px;font-size:23pt}h2{font-size:13pt;margin-top:22px}p{margin:7px 0}.muted{color:#64748b}table{width:100%;border-collapse:collapse;margin-top:10px}th,td{border:1px solid #cbd5e1;padding:9px;text-align:left;vertical-align:top;overflow-wrap:anywhere}th{background:#eff6ff}small{color:#64748b}.signature{margin-top:38px;break-inside:avoid}.line{display:inline-block;border-bottom:1px solid #172554;width:62%;height:20px}.date-line{display:inline-block;border-bottom:1px solid #172554;width:25%;height:20px}tr{break-inside:avoid}button{margin:12px 0;padding:12px 18px;background:#2563eb;color:white;border:0;border-radius:8px;font-size:14px}@media print{button{display:none}}
      </style></head><body><h1>🎵 Practice Pal</h1><p class="muted">Weekly Practice Verification Report</p><p><strong>Week:</strong> ${safe(formatDate(reportStart))} – ${safe(formatDate(reportEnd))} (Monday–Sunday)</p><p><strong>Student:</strong> ${safe(reportStudent==='all'?'All family students':names[reportStudent]??'Selected student')}</p><p><strong>Total practice:</strong> ${reportTotal} minutes</p><h2>Student Summary</h2><table><thead><tr><th>Student</th><th>Instrument</th><th>Minutes Practiced</th><th>Weekly Goal</th></tr></thead><tbody>${studentSummary||'<tr><td colspan="4">No students</td></tr>'}</tbody></table><h2>Daily Practice Record</h2><table><thead><tr><th style="width:22%">Day</th><th style="width:14%">Minutes</th><th>Category, Focus &amp; Notes</th></tr></thead><tbody>${rows}</tbody></table><section class="signature"><h2>Parent / Guardian Verification</h2><p>I verify that the practice entries above accurately represent the student's practice for this week.</p><p>Parent / Guardian Signature: <span class="line"></span></p><p>Date: <span class="date-line"></span></p></section><button onclick="window.print()">Print / Save as PDF</button><script>window.addEventListener('load',()=>setTimeout(()=>window.print(),350));<\/script></body></html>`;
    const popup=window.open('','_blank');
    if(!popup){setNotice('Please allow pop-ups to export your weekly report.');return;}
    popup.document.open();popup.document.write(html);popup.document.close();
  }

  if(authLoading||transitioning)return <main style={style.page}>Preparing Practice Pal securely...</main>;
  if(session?.user?.is_anonymous)return <StudentPortal onReturn={returnToParent}/>;
  // An existing authenticated parent session may only open Parent Mode, never the splash.
  if(session&&screen!=='parent-dashboard')return <main style={style.page}><p>Securing your session...</p><button style={style.secondary} onClick={chooseMode}>Return to Welcome Screen (sign out)</button></main>;
  if(!session&&screen==='parent-dashboard')return <main style={style.page}><p>Parent session ended.</p><button style={style.button} onClick={()=>setScreen('parent-login')}>Parent Sign In</button></main>;
  if(!session&&screen==='splash')return <main style={{...style.page,display:'grid',placeItems:'center'}}>
    <section style={{...style.card,width:'100%',maxWidth:720,boxSizing:'border-box',textAlign:'center'}}>
      <div style={{fontSize:48}} aria-hidden="true">🎵</div><h1>Welcome to Practice Pal!</h1>
      <p style={{color:palette.gray}}>Who's using Practice Pal today?</p>
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(220px,1fr))',gap:16,margin:'24px 0'}}>
        <section style={{...style.card,border:`1px solid ${palette.border}`}}><div style={{fontSize:42}}>🎹</div><h2>I'm a Student</h2><p>Choose your profile and enter your PIN.</p><button type="button" style={{...style.button,width:'100%'}} onClick={enterStudentMode}>Student Practice</button></section>
        <section style={{...style.card,border:`1px solid ${palette.border}`}}><div style={{fontSize:42}}>🛡️</div><h2>I'm a Parent</h2><p>Parent password required for dashboard access.</p><button type="button" style={{...style.button,width:'100%'}} onClick={()=>{setAuthError('');setScreen('parent-login');}}>Unlock Parent Dashboard</button></section>
      </div>
      {authError&&<p role="alert" style={{color:palette.red}}>{authError}</p>}
      <button type="button" style={style.secondary} onClick={()=>{sessionStorage.removeItem('practice_pal_roster');setScreen('family-login');}}>Use a different family account</button>
    </section>
  </main>;
  if(!session)return <main style={{...style.page,display:'grid',placeItems:'center'}}><section style={{...style.card,width:'100%',maxWidth:420,boxSizing:'border-box'}}>
    <div style={{textAlign:'center'}}><div style={{fontSize:48}}>🎵</div><h1>Practice Pal</h1><p>{screen==='parent-login'?'Parent verification required':'Small practices. Big progress.'}</p></div>
    <form onSubmit={screen==='parent-login'?unlockParent:signIn}><h2>{screen==='parent-login'?'🔒 Parent Sign In':'Family Sign In'}</h2>
      <FormField label="Email" id="email"><input id="email" type="email" autoComplete="email" required style={style.input} value={email} onChange={e=>setEmail(e.target.value)}/></FormField>
      <FormField label="Password" id="password"><input id="password" type="password" autoComplete="current-password" required style={style.input} value={password} onChange={e=>setPassword(e.target.value)}/></FormField>
      <button type="submit" style={{...style.button,width:'100%'}}>{screen==='parent-login'?'Unlock Parent Dashboard':'Continue to Welcome Screen'}</button>
    </form>
    {authError&&<p role="alert" style={{color:palette.red}}>{authError}</p>}
    {screen==='parent-login'&&<button type="button" style={{...style.secondary,marginTop:12,width:'100%'}} onClick={()=>{setAuthError('');setPassword('');setScreen('splash');}}>Back to Welcome Screen</button>}
  </section></main>;

  return <main style={style.page}><div style={style.shell}>
    <header style={{display:'flex',justifyContent:'space-between',alignItems:'center',flexWrap:'wrap',gap:12,marginBottom:22}}><div><h1 style={{margin:'0 0 5px'}}>🎵 Practice Pal</h1><small style={{color:palette.gray}}>{session.user.email}</small></div><div style={{display:"flex",gap:8,flexWrap:"wrap"}}><button type="button" style={style.button} onClick={chooseMode}>🏠 Choose Mode</button><button type="button" style={style.secondary} onClick={signOut}>Sign Out</button></div></header>
    <nav aria-label="Main navigation" style={{display:'flex',gap:8,overflowX:'auto',paddingBottom:10,marginBottom:16}}>{[['dashboard','🏠 Dashboard'],['students','🎼 Students'],['practice','⏱️ Practice'],['progress','🏆 Progress']].map(([id,label])=><button key={id} type="button" aria-current={tab===id?'page':undefined} onClick={()=>setTab(id)} style={{...style.secondary,whiteSpace:'nowrap',fontWeight:700,background:tab===id?palette.navy:'#fff',color:tab===id?'#fff':palette.navy}}>{label}</button>)}</nav>
    {familyLoading?<div style={style.card}>Loading family...</div>:familyError?<p role="alert" style={{color:palette.red}}>{familyError}</p>:!familyId?<div style={style.card}>Waiting for family information...</div>:<>
      {notice&&<p role="status" style={{background:'#f0fdf4',color:palette.green,padding:14,borderRadius:10}}>{notice}</p>}
      {studentError&&<p role="alert" style={{background:'#fef2f2',color:palette.red,padding:14,borderRadius:10}}>Student: {studentError}</p>}
      {sessionError&&<p role="alert" style={{background:'#fef2f2',color:palette.red,padding:14,borderRadius:10}}>Practice log: {sessionError}</p>}
      {tab==='dashboard'&&<>
        <section style={{background:'linear-gradient(120deg,#2563eb,#7c3aed)',color:'#fff',padding:28,borderRadius:20,marginBottom:20}}><h2>Ready to make some music? 🎶</h2><p>Every practice brings you closer to your goals.</p><button type="button" style={style.secondary} onClick={()=>setTab('practice')}>⏱️ Start Practicing</button></section>
        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(180px,1fr))',gap:14}}>{[['👨‍👩‍👧‍👦','Students',students.length],['🎯','Weekly Goal',`${totalGoal} min`],['🎵','Practiced This Week',`${weeklyTotal} min`]].map(([icon,label,value])=><div key={label} style={style.card}><div style={{fontSize:26}}>{icon}</div><p style={{color:palette.gray}}>{label}</p><strong style={{fontSize:27}}>{value}</strong></div>)}</div>
        <section style={style.card}><h2>Your Musicians</h2>{dataLoading?<p>Loading students...</p>:students.length===0?<button type="button" style={style.button} onClick={addStudent}>+ Add Your First Student</button>:<div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(220px,1fr))',gap:14}}>{students.map(s=><div key={s.id} style={{background:palette.bg,padding:16,borderRadius:14}}><h3>🎵 {s.name}</h3><p style={{color:palette.gray}}>{s.instrument}</p><Progress value={weeklyMinutes(sessions,s.id,thisMonday)} goal={Number(s.weekly_goal_minutes)||0}/><button type="button" style={{...style.button,marginTop:14}} disabled={timerStatus!=='idle'} onClick={()=>{setSelectedStudentId(s.id);setTab('practice');}}>Start Practice</button></div>)}</div>}</section>
        <section style={style.card}><h2>📄 Weekly Practice Report</h2><p style={{color:palette.gray}}>Export a Monday–Sunday practice verification report with daily minutes, practice details, and a parent/guardian signature line.</p>
          <FormField label="Student" id="reportStudent"><select id="reportStudent" style={style.input} value={reportStudent} onChange={e=>setReportStudent(e.target.value)}><option value="all">All family students</option>{students.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></FormField>
          <FormField label="Week starting Monday" id="reportWeek"><input id="reportWeek" type="date" style={style.input} value={reportMonday} onChange={e=>{if(e.target.value)setReportMonday(localDate(mondayOf(parseLocalDate(e.target.value))));}}/></FormField>
          <p><strong>{formatDate(reportStart)} – {formatDate(reportEnd)}</strong> · {reportTotal} minutes</p><button type="button" style={style.button} disabled={dataLoading||!!studentError||!!sessionError} onClick={exportPdf}>📄 Export / Save as PDF</button><p style={{fontSize:12,color:palette.gray}}>Opens your browser's print window. Choose “Save as PDF” as the destination.</p>
        </section>
      </>}
      {tab==='students'&&<section style={style.card}><div style={{display:'flex',justifyContent:'space-between',alignItems:'center',flexWrap:'wrap',gap:12}}><h2>🎼 Student Profiles</h2>{!formOpen&&<button type="button" style={style.button} onClick={addStudent}>+ Add Student</button>}</div>
        {formOpen&&<form onSubmit={saveStudent} style={{background:palette.bg,padding:18,borderRadius:14,marginBottom:20}}><h3>{editingId?'Edit Student':'Add Student'}</h3><FormField label="Student Name" id="studentName"><input id="studentName" required maxLength={100} style={style.input} value={studentForm.name} onChange={e=>setStudentForm(p=>({...p,name:e.target.value}))}/></FormField><FormField label="Instrument" id="instrument"><select id="instrument" required style={style.input} value={studentForm.instrument} onChange={e=>setStudentForm(p=>({...p,instrument:e.target.value}))}><option value="">Select instrument</option>{instruments.map(i=><option key={i} value={i}>{i}</option>)}</select></FormField><FormField label="Weekly Goal (minutes)" id="goal"><input id="goal" type="number" min="0" max="10080" step="1" required style={style.input} value={studentForm.weekly_goal_minutes} onChange={e=>setStudentForm(p=>({...p,weekly_goal_minutes:e.target.value}))}/></FormField><div style={{display:'flex',gap:10,flexWrap:'wrap'}}><button type="submit" disabled={busy} style={style.button}>{busy?'Saving...':'Save Student'}</button><button type="button" disabled={busy} style={style.secondary} onClick={cancelForm}>Cancel</button></div></form>}
        {dataLoading&&<p>Loading students...</p>}{students.map(s=><div key={s.id} style={{borderTop:`1px solid ${palette.border}`,padding:'18px 0'}}><h3>🎵 {s.name}</h3><p>{s.instrument} · {s.weekly_goal_minutes} min/week</p><div style={{background:palette.bg,padding:12,borderRadius:10,marginBottom:12}}><strong>🔒 Student PIN: {pinStatus[s.id]?"Configured":"Not configured"}</strong><p style={{fontSize:12,color:palette.gray}}>Set or reset a six-digit PIN. Only the parent can change it.</p><div style={{display:"flex",gap:8,flexWrap:"wrap"}}><input aria-label={`New PIN for ${s.name}`} type="password" inputMode="numeric" pattern="[0-9]{6}" maxLength={6} autoComplete="off" placeholder="6-digit PIN" style={{...style.input,width:160,margin:0}} value={pinValues[s.id]||""} onChange={e=>setPinValues(p=>({...p,[s.id]:e.target.value.replace(/\D/g,"").slice(0,6)}))}/><button type="button" style={style.secondary} disabled={pinBusy||(pinValues[s.id]||"").length!==6} onClick={()=>setStudentPin(s)}>Save PIN</button></div></div><div style={{display:'flex',gap:10,flexWrap:'wrap'}}><button type="button" style={style.secondary} disabled={busy} onClick={()=>editStudent(s)}>Edit Profile</button><button type="button" style={{...style.secondary,color:palette.red}} disabled={busy} onClick={()=>deleteStudent(s)}>Delete</button></div></div>)}
      </section>}
      {tab==='practice'&&<>
        <section style={{...style.card,maxWidth:650,margin:'0 auto 20px'}}><h2>⏱️ Practice Timer</h2><FormField label="Select Musician" id="practiceStudent"><select id="practiceStudent" style={style.input} value={selectedStudentId} disabled={timerStatus!=='idle'} onChange={e=>setSelectedStudentId(e.target.value)}><option value="">Choose a student</option>{students.map(s=><option key={s.id} value={s.id}>{s.name} — {s.instrument}</option>)}</select></FormField>
          <div style={{display:'flex',gap:10,marginBottom:20}}>{[['up','Count Up'],['down','Countdown']].map(([value,label])=><button key={value} type="button" disabled={timerStatus!=='idle'} onClick={()=>{setTimerMode(value);resetClock();}} style={{...style.secondary,flex:1,fontWeight:700,background:timerMode===value?palette.navy:'#fff',color:timerMode===value?'#fff':palette.navy}}>{label}</button>)}</div>
          {timerMode==='down'&&<><FormField label="Countdown Duration (minutes)" id="duration"><input id="duration" type="number" min="1" max="240" step="1" style={style.input} disabled={timerStatus!=='idle'} value={targetMinutes} onChange={e=>{const n=Number(e.target.value);if(Number.isSafeInteger(n)&&n>=1&&n<=240)setTargetMinutes(n);}}/></FormField><div style={{display:'flex',gap:8,flexWrap:'wrap',marginBottom:18}}>{[5,10,15,20,30].map(n=><button key={n} type="button" disabled={timerStatus!=='idle'} style={style.secondary} onClick={()=>setTargetMinutes(n)}>{n} min</button>)}</div></>}
          <div style={{background:palette.bg,borderRadius:20,padding:'32px 12px',textAlign:'center',marginBottom:20}}><div style={{fontSize:'clamp(48px,10vw,76px)',fontWeight:800,fontVariantNumeric:'tabular-nums'}}>{display}</div><p style={{color:palette.gray}}>{timerMode==='down'?'Time Remaining':'Practice Time'}</p>{timerStatus==='finished'&&<h3 style={{color:palette.green}}>🎉 Great practice!</h3>}</div>
          <div style={{display:'flex',gap:10,justifyContent:'center',flexWrap:'wrap'}}>{timerStatus==='idle'&&<button type="button" style={style.button} onClick={startTimer}>▶ Start Practice</button>}{timerStatus==='running'&&<button type="button" style={style.button} onClick={pauseTimer}>⏸ Pause</button>}{timerStatus==='paused'&&<button type="button" style={style.button} onClick={resumeTimer}>▶ Resume</button>}{['running','paused'].includes(timerStatus)&&<button type="button" style={style.secondary} onClick={finishTimer}>■ Finish</button>}{timerStatus!=='idle'&&<button type="button" style={style.secondary} disabled={busy} onClick={resetTimer}>↻ Reset</button>}</div>
          {timerStatus==='finished'&&<div style={{marginTop:25,borderTop:`1px solid ${palette.border}`,paddingTop:20}}><h3>Save Practice Session</h3><p>Musician: <strong>{selectedStudent?.name}</strong></p><p>Actual time: <strong>{formatClock(elapsedSeconds)}</strong></p><FormField label="Practice Category" id="category"><select id="category" style={style.input} value={category} onChange={e=>setCategory(e.target.value)}>{categories.map(c=><option key={c} value={c}>{c}</option>)}</select></FormField><FormField label="What were you practicing?" id="focus"><input id="focus" style={style.input} maxLength={200} placeholder="Example: C major scale" value={focus} onChange={e=>setFocus(e.target.value)}/></FormField><FormField label="Other Notes" id="notes"><textarea id="notes" rows={3} maxLength={1000} style={style.input} placeholder="What went well? What needs work?" value={notes} onChange={e=>setNotes(e.target.value)}/></FormField><button type="button" style={{...style.button,width:'100%'}} disabled={busy} onClick={saveTimer}>{busy?'Saving...':'💾 Save to Practice Log'}</button></div>}
        </section>
        <section style={style.card}><div style={{display:'flex',justifyContent:'space-between',alignItems:'center',flexWrap:'wrap',gap:10}}><h2>➕ Manual Practice Entry</h2><button type="button" style={style.button} onClick={()=>{if(manualOpen)setManualOpen(false);else openManual();}}>{manualOpen?'Close Form':'+ Add Practice Time'}</button></div>
          {manualOpen&&<form onSubmit={saveManual} style={{background:palette.bg,padding:18,borderRadius:14}}><FormField label="Student" id="manualStudent"><select id="manualStudent" required style={style.input} value={entry.student_id} onChange={e=>setEntry(p=>({...p,student_id:e.target.value}))}><option value="">Choose a student</option>{students.map(s=><option key={s.id} value={s.id}>{s.name} — {s.instrument}</option>)}</select></FormField><FormField label="Practice Date" id="manualDate"><input id="manualDate" type="date" required max={localDate()} style={style.input} value={entry.practice_date} onChange={e=>setEntry(p=>({...p,practice_date:e.target.value}))}/></FormField><FormField label="Minutes Practiced" id="manualMinutes"><input id="manualMinutes" type="number" min="1" max="1440" step="1" required style={style.input} value={entry.minutes} onChange={e=>setEntry(p=>({...p,minutes:e.target.value}))}/></FormField><FormField label="Practice Category" id="manualCategory"><select id="manualCategory" style={style.input} value={entry.category} onChange={e=>setEntry(p=>({...p,category:e.target.value}))}>{categories.map(c=><option key={c} value={c}>{c}</option>)}</select></FormField><FormField label="What were you practicing?" id="manualFocus"><input id="manualFocus" style={style.input} maxLength={200} placeholder="Example: Concert piece, measures 12–24" value={entry.focus} onChange={e=>setEntry(p=>({...p,focus:e.target.value}))}/></FormField><FormField label="Other Notes" id="manualNotes"><textarea id="manualNotes" rows={3} maxLength={1000} style={style.input} placeholder="Optional notes" value={entry.notes} onChange={e=>setEntry(p=>({...p,notes:e.target.value}))}/></FormField><div style={{display:'flex',gap:10,flexWrap:'wrap'}}><button type="submit" disabled={busy} style={style.button}>{busy?'Saving...':'💾 Save Manual Entry'}</button><button type="button" disabled={busy} style={style.secondary} onClick={()=>setManualOpen(false)}>Cancel</button></div></form>}
        </section>
        <section style={style.card}><h2>📖 Practice Log</h2><p style={{color:palette.gray}}>Choose a student in the timer selector above to view their saved sessions.</p>{!selectedStudentId?<p>Select a student to see their history.</p>:selectedSessions.length===0?<p>No saved sessions yet.</p>:selectedSessions.map(s=><div key={s.id} style={{borderTop:`1px solid ${palette.border}`,padding:'14px 0'}}><strong>🎵 {s.minutes} minutes</strong><p style={{color:palette.gray,fontSize:13}}>{s.practice_date} · {s.category}</p>{s.focus&&<p><strong>Practiced:</strong> {s.focus}</p>}{s.notes&&<p><strong>Other Notes:</strong> {s.notes}</p>}</div>)}</section>
      </>}
      {tab==='progress'&&<section style={style.card}><h2>🏆 Weekly Progress</h2><p style={{color:palette.gray}}>Current week: {formatDate(thisMonday)} – {formatDate(sundayOf(thisMonday))}</p>{students.map(s=><div key={s.id} style={{padding:'18px 0',borderBottom:`1px solid ${palette.border}`}}><h3>{s.name}</h3><Progress value={weeklyMinutes(sessions,s.id,thisMonday)} goal={Number(s.weekly_goal_minutes)||0}/><button type="button" style={{...style.secondary,marginTop:12}} onClick={()=>openManual(s.id)}>+ Add Practice</button></div>)}{students.length===0&&<p>Add students to track progress.</p>}</section>}
    </>}
    <footer style={{textAlign:'center',marginTop:35,paddingBottom:20,color:palette.gray,fontSize:12}}>Practice Pal · Make every practice count.</footer>
  </div></main>;
}

function StudentPortal({ onReturn }) {
  const [roster] = useState(() => {
    try { return JSON.parse(sessionStorage.getItem('practice_pal_roster') || '[]'); }
    catch { return []; }
  });
  const [studentId,setStudentId] = useState('');
  const [pin,setPin] = useState('');
  const [student,setStudent] = useState(null);
  const [sessions,setSessions] = useState([]);
  const [error,setError] = useState('');
  const [message,setMessage] = useState('');
  const [busy,setBusy] = useState(false);
  const [tab,setTab] = useState('practice');
  const [manualOpen,setManualOpen] = useState(false);
  const [entry,setEntry] = useState({...blankEntry,practice_date:localDate()});
  const [mode,setMode] = useState('up');
  const [target,setTarget] = useState(15);
  const [state,setState] = useState('idle');
  const [seconds,setSeconds] = useState(0);
  const [category,setCategory] = useState('Other');
  const [focus,setFocus] = useState('');
  const [notes,setNotes] = useState('');
  const accumulated = useRef(0);
  const started = useRef(null);
  const elapsed = useRef(0);
  const saving = useRef(false);

  async function loadStudent() {
    const {data,error:err} = await supabase.rpc('student_my_data');
    if (err) { setStudent(null); setError(err.message); return false; }
    setStudent(data.student);
    setSessions(data.sessions || []);
    setError('');
    return true;
  }
  useEffect(() => { loadStudent(); }, []);
  useEffect(() => {
    if(state !== 'running') return;
    const tick=()=>{
      if(started.current===null)return;
      const ms=accumulated.current+Date.now()-started.current;
      if(mode==='down'&&ms>=target*60000){
        accumulated.current=target*60000;started.current=null;
        elapsed.current=target*60;setSeconds(target*60);setState('finished');return;
      }
      elapsed.current=Math.floor(ms/1000);setSeconds(elapsed.current);
    };
    tick();const interval=setInterval(tick,250);return()=>clearInterval(interval);
  },[state,mode,target]);
  useEffect(()=>{
    const handler=e=>{if(state!=='idle'){e.preventDefault();e.returnValue='';}};
    window.addEventListener('beforeunload',handler);
    return()=>window.removeEventListener('beforeunload',handler);
  },[state]);
  function reset(){accumulated.current=0;started.current=null;elapsed.current=0;setSeconds(0);setState('idle');}
  function start(){setError('');setMessage('');reset();started.current=Date.now();setState('running');}
  function pause(){if(state!=='running')return;accumulated.current+=Date.now()-started.current;started.current=null;elapsed.current=Math.floor(accumulated.current/1000);setSeconds(elapsed.current);setState('paused');}
  function resume(){started.current=Date.now();setState('running');}
  function finish(){if(state==='running'){accumulated.current+=Date.now()-started.current;started.current=null;}
    if(mode==='down')accumulated.current=Math.min(accumulated.current,target*60000);
    elapsed.current=Math.floor(accumulated.current/1000);setSeconds(elapsed.current);setState('finished');}
  async function unlock(e){
    e.preventDefault();if(busy||!studentId||!/^[0-9]{6}$/.test(pin))return;
    setBusy(true);setError('');
    const {data,error:err}=await supabase.rpc('student_unlock',{p_student_id:studentId,p_pin:pin});
    setPin('');
    if(err)setError(err.message);
    else if(!data)setError('Incorrect PIN or temporarily locked. Try again later or ask a parent.');
    else await loadStudent();
    setBusy(false);
  }
  async function save(payload){
    if(saving.current)return;
    saving.current=true;setBusy(true);setError('');setMessage('');
    try {
      const {data,error:err}=await supabase.rpc('student_add_practice',{
        p_practice_date:payload.practice_date,p_minutes:payload.minutes,
        p_category:payload.category,p_focus:payload.focus||null,p_notes:payload.notes||null
      });
      if(err){setError(err.message);return;}
      if(!data){setError('Save not confirmed; check the log before trying again.');return;}
      reset();setManualOpen(false);setEntry({...blankEntry,practice_date:localDate()});
      setCategory('Other');setFocus('');setNotes('');
      setMessage(`${payload.minutes} minute(s) saved!`);
      await loadStudent();
    } finally {saving.current=false;setBusy(false);}
  }
  async function saveTimer(){
    if(state!=='finished'||seconds<1)return setError('Practice for at least one second.');
    await save({practice_date:localDate(),minutes:Math.ceil(seconds/60),category,focus:focus.trim(),notes:notes.trim()});
  }
  async function saveManual(e){
    e.preventDefault();const n=Number(entry.minutes);
    if(!Number.isSafeInteger(n)||n<1||n>1440)return setError('Minutes must be between 1 and 1440.');
    if(!/^\d{4}-\d{2}-\d{2}$/.test(entry.practice_date)||localDate(parseLocalDate(entry.practice_date))!==entry.practice_date||entry.practice_date>localDate())return setError('Invalid practice date.');
    await save({...entry,minutes:n});
  }
  const total=student?weeklyMinutes(sessions,student.id,mondayOf()):0;
  return <main style={style.page}><div style={{...style.shell,maxWidth:800}}>
    <header style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:12,flexWrap:'wrap'}}><h1>🎵 Practice Pal · Student Mode</h1><button style={style.secondary} onClick={()=>{if(state!=='idle'&&!window.confirm('Discard unsaved practice time?'))return;onReturn();}}>🔒 Parent Sign In</button></header>
    {error&&<p role="alert" style={{color:palette.red}}>{error}</p>}
    {message&&<p role="status" style={{color:palette.green}}>{message}</p>}
    {!student?<section style={style.card}><h2>Choose your profile and enter your PIN</h2><form onSubmit={unlock}>
      <FormField label="Musician" id="studentChoice"><select id="studentChoice" required style={style.input} value={studentId} onChange={e=>setStudentId(e.target.value)}><option value="">Select a student</option>{roster.map(s=><option key={s.id} value={s.id}>{s.name} · {s.instrument}</option>)}</select></FormField>
      <FormField label="6-digit PIN" id="studentPin"><input id="studentPin" type="password" inputMode="numeric" pattern="[0-9]{6}" maxLength={6} autoComplete="off" required style={style.input} value={pin} onChange={e=>setPin(e.target.value.replace(/\D/g,'').slice(0,6))}/></FormField>
      <button style={style.button} disabled={busy||!studentId||pin.length!==6}>{busy?'Checking...':'Unlock My Practice'}</button>
    </form><p style={{color:palette.gray}}>Ask a parent to set your PIN in Parent Mode first. After 5 incorrect attempts, this profile locks for 15 minutes.</p></section>:
    <><section style={{...style.card,background:'linear-gradient(120deg,#2563eb,#7c3aed)',color:'#fff'}}><h2>Hi, {student.name}! 🎶</h2><p>{student.instrument} · Weekly goal: {student.weekly_goal_minutes} minutes</p><Progress value={total} goal={student.weekly_goal_minutes}/></section>
    <nav style={{display:'flex',gap:8,marginBottom:16}}>{[['practice','⏱️ Practice'],['log','📖 My Log'],['progress','🏆 Progress']].map(([id,label])=><button key={id} style={{...style.secondary,background:tab===id?palette.navy:'#fff',color:tab===id?'#fff':palette.navy}} onClick={()=>setTab(id)}>{label}</button>)}</nav>
    {tab==='practice'&&<><section style={style.card}><h2>Practice Timer</h2><div style={{display:'flex',gap:8}}>{[['up','Count Up'],['down','Countdown']].map(([id,label])=><button key={id} style={{...style.secondary,background:mode===id?palette.navy:'#fff',color:mode===id?'#fff':palette.navy}} disabled={state!=='idle'} onClick={()=>setMode(id)}>{label}</button>)}</div>
      {mode==='down'&&<FormField label="Countdown minutes" id="studentTarget"><input id="studentTarget" type="number" min="1" max="240" style={style.input} value={target} disabled={state!=='idle'} onChange={e=>{const n=Number(e.target.value);if(Number.isInteger(n)&&n>=1&&n<=240)setTarget(n);}}/></FormField>}
      <div style={{textAlign:'center',fontSize:'clamp(48px,10vw,72px)',fontWeight:800,margin:'30px 0',fontVariantNumeric:'tabular-nums'}}>{formatClock(mode==='down'?Math.max(0,target*60-seconds):seconds)}</div>
      <div style={{display:'flex',gap:8,flexWrap:'wrap',justifyContent:'center'}}>{state==='idle'&&<button style={style.button} onClick={start}>▶ Start</button>}{state==='running'&&<button style={style.button} onClick={pause}>⏸ Pause</button>}{state==='paused'&&<button style={style.button} onClick={resume}>▶ Resume</button>}{['running','paused'].includes(state)&&<button style={style.secondary} onClick={finish}>■ Finish</button>}{state!=='idle'&&<button style={style.secondary} disabled={busy} onClick={()=>{if(window.confirm('Discard unsaved practice?'))reset();}}>↻ Reset</button>}</div>
      {state==='finished'&&<div style={{marginTop:24}}><h3>🎉 Great practice! Save your time</h3><FormField label="Category" id="studentCategory"><select id="studentCategory" style={style.input} value={category} onChange={e=>setCategory(e.target.value)}>{categories.map(c=><option key={c}>{c}</option>)}</select></FormField><FormField label="What were you practicing?" id="studentFocus"><input id="studentFocus" maxLength={200} style={style.input} value={focus} onChange={e=>setFocus(e.target.value)}/></FormField><FormField label="Other notes" id="studentNotes"><textarea id="studentNotes" maxLength={1000} style={style.input} value={notes} onChange={e=>setNotes(e.target.value)}/></FormField><button style={style.button} disabled={busy} onClick={saveTimer}>{busy?'Saving...':'💾 Save Practice'}</button></div>}
    </section><section style={style.card}><h2>Manual Practice Entry</h2><button style={style.secondary} onClick={()=>setManualOpen(v=>!v)}>{manualOpen?'Close Form':'+ Add Practice Time'}</button>{manualOpen&&<form onSubmit={saveManual}><FormField label="Date" id="studentDate"><input id="studentDate" type="date" required max={localDate()} style={style.input} value={entry.practice_date} onChange={e=>setEntry(p=>({...p,practice_date:e.target.value}))}/></FormField><FormField label="Minutes" id="studentMinutes"><input id="studentMinutes" type="number" required min="1" max="1440" style={style.input} value={entry.minutes} onChange={e=>setEntry(p=>({...p,minutes:e.target.value}))}/></FormField><FormField label="Category" id="studentManualCategory"><select id="studentManualCategory" style={style.input} value={entry.category} onChange={e=>setEntry(p=>({...p,category:e.target.value}))}>{categories.map(c=><option key={c}>{c}</option>)}</select></FormField><FormField label="What were you practicing?" id="studentManualFocus"><input id="studentManualFocus" maxLength={200} style={style.input} value={entry.focus} onChange={e=>setEntry(p=>({...p,focus:e.target.value}))}/></FormField><FormField label="Other notes" id="studentManualNotes"><textarea id="studentManualNotes" maxLength={1000} style={style.input} value={entry.notes} onChange={e=>setEntry(p=>({...p,notes:e.target.value}))}/></FormField><button style={style.button} disabled={busy}>{busy?'Saving...':'Save Manual Entry'}</button></form>}</section></>}
    {tab==='log'&&<section style={style.card}><h2>📖 {student.name}'s Practice Log</h2>{sessions.length===0?<p>No sessions yet.</p>:sessions.map(s=><div key={s.id} style={{borderTop:`1px solid ${palette.border}`,padding:'12px 0'}}><strong>{s.practice_date} · {s.minutes} minutes · {s.category}</strong>{s.focus&&<p>Practiced: {s.focus}</p>}{s.notes&&<p>Other notes: {s.notes}</p>}</div>)}</section>}
    {tab==='progress'&&<section style={style.card}><h2>🏆 Weekly Progress</h2><Progress value={total} goal={student.weekly_goal_minutes}/><p>Week of {formatDate(mondayOf())} – {formatDate(sundayOf(mondayOf()))}</p></section>}
    </>}
  </div></main>;
}
