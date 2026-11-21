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

  if(authLoading)return <main style={style.page}>Loading Practice Pal...</main>;
  if(!session)return <main style={{...style.page,display:'grid',placeItems:'center'}}><section style={{...style.card,width:'100%',maxWidth:420,boxSizing:'border-box'}}><div style={{textAlign:'center'}}><div style={{fontSize:48}}>🎵</div><h1>Practice Pal</h1><p>Small practices. Big progress.</p></div><form onSubmit={signIn}><h2>Family Sign In</h2><FormField label="Email" id="email"><input id="email" type="email" autoComplete="email" required style={style.input} value={email} onChange={e=>setEmail(e.target.value)}/></FormField><FormField label="Password" id="password"><input id="password" type="password" autoComplete="current-password" required style={style.input} value={password} onChange={e=>setPassword(e.target.value)}/></FormField><button type="submit" style={{...style.button,width:'100%'}}>Sign In</button></form>{authError&&<p role="alert" style={{color:palette.red}}>{authError}</p>}</section></main>;

  return <main style={style.page}><div style={style.shell}>
    <header style={{display:'flex',justifyContent:'space-between',alignItems:'center',flexWrap:'wrap',gap:12,marginBottom:22}}><div><h1 style={{margin:'0 0 5px'}}>🎵 Practice Pal</h1><small style={{color:palette.gray}}>{session.user.email}</small></div><button type="button" style={style.secondary} onClick={signOut}>Sign Out</button></header>
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
        {dataLoading&&<p>Loading students...</p>}{students.map(s=><div key={s.id} style={{borderTop:`1px solid ${palette.border}`,padding:'18px 0'}}><h3>🎵 {s.name}</h3><p>{s.instrument} · {s.weekly_goal_minutes} min/week</p><div style={{display:'flex',gap:10,flexWrap:'wrap'}}><button type="button" style={style.secondary} disabled={busy} onClick={()=>editStudent(s)}>Edit Profile</button><button type="button" style={{...style.secondary,color:palette.red}} disabled={busy} onClick={()=>deleteStudent(s)}>Delete</button></div></div>)}
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
