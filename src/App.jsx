
import React, { useEffect, useRef, useState } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

const supabase = supabaseUrl && supabaseKey
  ? createClient(supabaseUrl, supabaseKey)
  : null;

const STUDENT_COLUMNS =
  'id, family_id, name, instrument, weekly_goal_minutes, created_at';

const SESSION_COLUMNS =
  'id, student_id, family_id, duration_minutes, notes, created_at';

const instruments = [
  'Piano', 'Guitar', 'Violin', 'Viola', 'Cello',
  'Flute', 'Clarinet', 'Saxophone', 'Trumpet',
  'Trombone', 'French Horn', 'Drums',
  'Percussion', 'Voice', 'Other'
];

const emptyStudent = {
  name: '',
  instrument: '',
  weekly_goal_minutes: '60'
};

const theme = {
  navy: '#172554',
  blue: '#2563eb',
  purple: '#7c3aed',
  background: '#f3f6ff',
  muted: '#64748b',
  border: '#e2e8f0',
  green: '#15803d',
  red: '#b91c1c'
};

const css = {
  page: {
    minHeight: '100vh',
    background: theme.background,
    color: theme.navy,
    fontFamily: 'Arial, sans-serif',
    padding: '20px 14px',
    boxSizing: 'border-box'
  },
  shell: {
    maxWidth: 1050,
    margin: '0 auto'
  },
  card: {
    background: '#fff',
    border: `1px solid ${theme.border}`,
    borderRadius: 18,
    padding: 22,
    boxShadow: '0 4px 20px rgba(23,37,84,.05)'
  },
  button: {
    background: theme.blue,
    color: '#fff',
    border: 0,
    borderRadius: 10,
    padding: '12px 18px',
    fontSize: 15,
    fontWeight: 700,
    cursor: 'pointer'
  },
  secondary: {
    background: '#fff',
    color: theme.navy,
    border: `1px solid ${theme.border}`,
    borderRadius: 10,
    padding: '11px 15px',
    cursor: 'pointer'
  },
  input: {
    display: 'block',
    width: '100%',
    boxSizing: 'border-box',
    padding: 12,
    marginTop: 6,
    marginBottom: 16,
    border: `1px solid ${theme.border}`,
    borderRadius: 10,
    fontSize: 16,
    background: '#fff'
  }
};

function formatTime(seconds) {
  const total = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const remaining = total % 60;

  const two = number => String(number).padStart(2, '0');

  return hours > 0
    ? `${two(hours)}:${two(minutes)}:${two(remaining)}`
    : `${two(minutes)}:${two(remaining)}`;
}

function getWeekStart() {
  const now = new Date();
  const day = now.getDay();
  const offset = (day + 6) % 7;

  const start = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() - offset
  );

  return start;
}

function minutesForStudent(sessions, studentId) {
  const start = getWeekStart();

  return sessions
    .filter(session =>
      session.student_id === studentId &&
      new Date(session.created_at) >= start
    )
    .reduce(
      (total, session) =>
        total + (Number(session.duration_minutes) || 0),
      0
    );
}

function ProgressBar({ value, goal }) {
  const percentage = goal > 0
    ? Math.min(100, Math.round(value / goal * 100))
    : 0;

  return (
    <div>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        fontSize: 13,
        marginBottom: 8
      }}>
        <span>{value} / {goal} minutes</span>
        <strong>{percentage}%</strong>
      </div>

      <div style={{
        height: 10,
        borderRadius: 20,
        background: '#e2e8f0',
        overflow: 'hidden'
      }}>
        <div style={{
          width: `${percentage}%`,
          height: '100%',
          background: theme.purple,
          borderRadius: 20
        }} />
      </div>
    </div>
  );
}

export default function App() {
  const [session, setSession] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState('');

  const [familyId, setFamilyId] = useState(null);
  const [familyLoading, setFamilyLoading] = useState(false);
  const [familyError, setFamilyError] = useState('');

  const [students, setStudents] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [dataLoading, setDataLoading] = useState(false);
  const [studentError, setStudentError] = useState('');
  const [sessionError, setSessionError] = useState('');
  const [notice, setNotice] = useState('');

  const [tab, setTab] = useState('dashboard');

  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [studentForm, setStudentForm] = useState({
    ...emptyStudent
  });
  const [busy, setBusy] = useState(false);

  // Timer settings and state.
  const [selectedStudentId, setSelectedStudentId] =
    useState('');
  const [timerMode, setTimerMode] = useState('up');
  const [targetMinutes, setTargetMinutes] = useState(15);
  const [timerStatus, setTimerStatus] = useState('idle');
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [notes, setNotes] = useState('');
  const [savingSession, setSavingSession] = useState(false);

  // Timer uses wall-clock timestamps rather than
  // counting setInterval calls.
  const accumulatedMs = useRef(0);
  const startedAtMs = useRef(null);
  const timerStatusRef = useRef('idle');
  const timerModeRef = useRef('up');
  const targetMinutesRef = useRef(15);
  const elapsedRef = useRef(0);
  const savingRef = useRef(false);

  const userId = session?.user?.id ?? null;

  function setStatus(value) {
    timerStatusRef.current = value;
    setTimerStatus(value);
  }

  function resetTimerState() {
    accumulatedMs.current = 0;
    startedAtMs.current = null;
    elapsedRef.current = 0;
    setElapsedSeconds(0);
    setStatus('idle');
  }

  useEffect(() => {
    if (!supabase) {
      setAuthError('Supabase connection is not configured.');
      setAuthLoading(false);
      return;
    }

    let active = true;

    supabase.auth.getSession().then(({ data, error }) => {
      if (!active) return;
      if (error) setAuthError(error.message);
      setSession(data.session);
      setAuthLoading(false);
    });

    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange(
      (_event, nextSession) => {
        if (!active) return;
        setSession(nextSession);
        setAuthLoading(false);
      }
    );

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    setFamilyId(null);
    setFamilyError('');
    setStudents([]);
    setSessions([]);
    setStudentError('');
    setSessionError('');
    setNotice('');
    setTab('dashboard');
    setSelectedStudentId('');
    resetTimerState();

    if (!supabase || !userId) {
      setFamilyLoading(false);
      return;
    }

    let cancelled = false;
    setFamilyLoading(true);

    async function loadFamily() {
      const { data, error } = await supabase
        .from('family_members')
        .select('family_id')
        .eq('user_id', userId);

      if (cancelled) return;

      if (error) {
        setFamilyError(error.message);
      } else if (data?.length !== 1) {
        setFamilyError(
          'Expected exactly one family membership.'
        );
      } else {
        setFamilyId(data[0].family_id);
      }

      setFamilyLoading(false);
    }

    loadFamily();

    return () => {
      cancelled = true;
    };
  }, [userId]);

  useEffect(() => {
    if (!supabase || !userId || !familyId) {
      setStudents([]);
      setSessions([]);
      setDataLoading(false);
      return;
    }

    let cancelled = false;
    setDataLoading(true);

    async function loadData() {
      const [studentResult, sessionResult] =
        await Promise.all([
          supabase
            .from('students')
            .select(STUDENT_COLUMNS)
            .eq('family_id', familyId)
            .order('name'),

          supabase
            .from('practice_sessions')
            .select(SESSION_COLUMNS)
            .eq('family_id', familyId)
            .order('created_at', { ascending: false })
        ]);

      if (cancelled) return;

      if (studentResult.error) {
        setStudentError(studentResult.error.message);
      } else {
        setStudents(studentResult.data ?? []);
      }

      if (sessionResult.error) {
        setSessionError(sessionResult.error.message);
      } else {
        setSessions(sessionResult.data ?? []);
      }

      setDataLoading(false);
    }

    loadData();

    return () => {
      cancelled = true;
    };
  }, [userId, familyId]);

  useEffect(() => {
    if (
      selectedStudentId &&
      !students.some(student =>
        student.id === selectedStudentId
      )
    ) {
      setSelectedStudentId('');
    }
  }, [students, selectedStudentId]);

  // Update the timer display while running.
  useEffect(() => {
    if (timerStatus !== 'running') return;

    const interval = setInterval(() => {
      if (startedAtMs.current === null) return;

      const milliseconds =
        accumulatedMs.current +
        (Date.now() - startedAtMs.current);

      const seconds = Math.floor(milliseconds / 1000);

      if (
        timerModeRef.current === 'down' &&
        milliseconds >= targetMinutesRef.current * 60000
      ) {
        const targetSeconds =
          targetMinutesRef.current * 60;

        accumulatedMs.current =
          targetSeconds * 1000;
        startedAtMs.current = null;
        elapsedRef.current = targetSeconds;
        setElapsedSeconds(targetSeconds);
        setStatus('finished');
        return;
      }

      elapsedRef.current = seconds;
      setElapsedSeconds(seconds);
    }, 250);

    return () => clearInterval(interval);
  }, [timerStatus]);

  function startTimer() {
    if (!selectedStudentId) {
      setSessionError('Select a student first.');
      return;
    }

    if (timerStatusRef.current !== 'idle') return;

    setSessionError('');
    setNotice('');
    accumulatedMs.current = 0;
    startedAtMs.current = Date.now();
    elapsedRef.current = 0;
    setElapsedSeconds(0);
    setStatus('running');
  }

  function pauseTimer() {
    if (timerStatusRef.current !== 'running') return;

    const now = Date.now();
    accumulatedMs.current +=
      now - startedAtMs.current;
    startedAtMs.current = null;

    const seconds = Math.floor(
      accumulatedMs.current / 1000
    );

    elapsedRef.current = seconds;
    setElapsedSeconds(seconds);
    setStatus('paused');
  }

  function resumeTimer() {
    if (timerStatusRef.current !== 'paused') return;

    startedAtMs.current = Date.now();
    setStatus('running');
  }

  function finishTimer() {
    if (timerStatusRef.current === 'running') {
      const now = Date.now();

      accumulatedMs.current +=
        now - startedAtMs.current;

      startedAtMs.current = null;
    }

    if (
      timerStatusRef.current !== 'running' &&
      timerStatusRef.current !== 'paused'
    ) {
      return;
    }

    const seconds = Math.floor(
      accumulatedMs.current / 1000
    );

    const finalSeconds =
      timerModeRef.current === 'down'
        ? Math.min(
            seconds,
            targetMinutesRef.current * 60
          )
        : seconds;

    elapsedRef.current = finalSeconds;
    setElapsedSeconds(finalSeconds);
    setStatus('finished');
  }

  function resetTimer() {
    if (
      elapsedRef.current > 0 &&
      !window.confirm(
        'Discard the current unsaved practice time?'
      )
    ) {
      return;
    }

    resetTimerState();
    setNotes('');
    setSessionError('');
  }

  function changeTimerMode(value) {
    if (timerStatusRef.current !== 'idle') return;
    timerModeRef.current = value;
    setTimerMode(value);
    resetTimerState();
  }

  function changeTargetMinutes(value) {
    if (timerStatusRef.current !== 'idle') return;

    const parsed = Number(value);

    if (
      Number.isSafeInteger(parsed) &&
      parsed >= 1 &&
      parsed <= 240
    ) {
      targetMinutesRef.current = parsed;
      setTargetMinutes(parsed);
    }
  }

  function changeSelectedStudent(value) {
    if (timerStatusRef.current !== 'idle') return;
    setSelectedStudentId(value);
  }

  async function refreshStudents() {
    const { data, error } = await supabase
      .from('students')
      .select(STUDENT_COLUMNS)
      .eq('family_id', familyId)
      .order('name');

    if (error) {
      setStudentError(error.message);
      return false;
    }

    setStudents(data ?? []);
    return true;
  }

  async function refreshSessions() {
    const { data, error } = await supabase
      .from('practice_sessions')
      .select(SESSION_COLUMNS)
      .eq('family_id', familyId)
      .order('created_at', { ascending: false });

    if (error) {
      setSessionError(error.message);
      return false;
    }

    setSessions(data ?? []);
    return true;
  }

  async function savePractice() {
    if (
      !supabase ||
      !familyId ||
      !selectedStudentId ||
      savingRef.current
    ) return;

    if (timerStatusRef.current !== 'finished') {
      setSessionError(
        'Finish the timer before saving.'
      );
      return;
    }

    const durationMinutes = Math.ceil(
      elapsedRef.current / 60
    );

    if (durationMinutes < 1) {
      setSessionError(
        'Practice for at least one second before saving.'
      );
      return;
    }

    if (!students.some(student =>
      student.id === selectedStudentId
    )) {
      setSessionError('Select a valid family student.');
      return;
    }

    savingRef.current = true;
    setSavingSession(true);
    setSessionError('');
    setNotice('');

    const { data, error } = await supabase
      .from('practice_sessions')
      .insert({
        family_id: familyId,
        student_id: selectedStudentId,
        duration_minutes: durationMinutes,
        notes: notes.trim() || null
      })
      .select('id');

    if (error) {
      setSessionError(error.message);
    } else if (data?.length !== 1) {
      setSessionError(
        'The practice session could not be confirmed.'
      );
    } else {
      const refreshed = await refreshSessions();

      if (refreshed) {
        resetTimerState();
        setNotes('');
        setNotice(
          `${durationMinutes} minute(s) saved to the practice log!`
        );
      } else {
        // The insert succeeded, so do not offer a
        // second save that could create a duplicate.
        resetTimerState();
        setNotes('');
        setNotice(
          'Practice saved, but the log could not refresh.'
        );
      }
    }

    savingRef.current = false;
    setSavingSession(false);
  }

  async function signIn(event) {
    event.preventDefault();
    if (!supabase) return;

    setAuthLoading(true);
    setAuthError('');

    const { error } =
      await supabase.auth.signInWithPassword({
        email,
        password
      });

    if (error) setAuthError(error.message);
    setAuthLoading(false);
  }

  async function signOut() {
    if (!supabase) return;

    if (
      elapsedRef.current > 0 &&
      timerStatusRef.current !== 'idle' &&
      !window.confirm(
        'Sign out and discard unsaved practice time?'
      )
    ) return;

    setAuthError('');

    const { error } = await supabase.auth.signOut();

    if (error) setAuthError(error.message);
  }

  function addStudent() {
    setEditingId(null);
    setStudentForm({ ...emptyStudent });
    setFormOpen(true);
    setTab('students');
    setStudentError('');
  }

  function editStudent(student) {
    setEditingId(student.id);
    setStudentForm({
      name: student.name ?? '',
      instrument: student.instrument ?? '',
      weekly_goal_minutes: String(
        student.weekly_goal_minutes ?? 60
      )
    });
    setFormOpen(true);
    setTab('students');
    setStudentError('');
  }

  function cancelForm() {
    setFormOpen(false);
    setEditingId(null);
    setStudentForm({ ...emptyStudent });
  }

  async function saveStudent(event) {
    event.preventDefault();

    if (!supabase || !familyId || busy) return;

    const name = studentForm.name.trim();
    const instrument = studentForm.instrument.trim();
    const goalText = String(
      studentForm.weekly_goal_minutes
    ).trim();
    const goal = Number(goalText);

    if (
      !name ||
      !instrument ||
      !goalText ||
      !Number.isSafeInteger(goal) ||
      goal < 0 ||
      goal > 10080
    ) {
      setStudentError(
        'Enter a name, instrument, and valid weekly goal.'
      );
      return;
    }

    setBusy(true);
    setStudentError('');
    setNotice('');

    const payload = {
      name,
      instrument,
      weekly_goal_minutes: goal
    };

    const result = editingId
      ? await supabase
          .from('students')
          .update(payload)
          .eq('id', editingId)
          .eq('family_id', familyId)
          .select('id')
      : await supabase
          .from('students')
          .insert({
            ...payload,
            family_id: familyId
          })
          .select('id');

    if (result.error) {
      setStudentError(result.error.message);
    } else if (result.data?.length !== 1) {
      setStudentError(
        'The student change could not be confirmed.'
      );
    } else {
      cancelForm();

      if (await refreshStudents()) {
        setNotice(
          editingId
            ? 'Student updated.'
            : 'Student added.'
        );
      }
    }

    setBusy(false);
  }

  async function deleteStudent(student) {
    if (!supabase || !familyId || busy) return;

    if (!window.confirm(
      `Delete ${student.name}? This cannot be undone. ` +
      'Associated practice history may be affected.'
    )) return;

    setBusy(true);
    setStudentError('');
    setNotice('');

    const { data, error } = await supabase
      .from('students')
      .delete()
      .eq('id', student.id)
      .eq('family_id', familyId)
      .select('id');

    if (error) {
      setStudentError(error.message);
    } else if (data?.length !== 1) {
      setStudentError('Deletion could not be confirmed.');
    } else {
      if (editingId === student.id) cancelForm();

      if (await refreshStudents()) {
        setNotice('Student deleted.');
      }
    }

    setBusy(false);
  }

  const totalGoal = students.reduce(
    (sum, student) =>
      sum + (Number(student.weekly_goal_minutes) || 0),
    0
  );

  const weeklyTotal = students.reduce(
    (sum, student) =>
      sum + minutesForStudent(sessions, student.id),
    0
  );

  const selectedStudent = students.find(
    student => student.id === selectedStudentId
  );

  const remainingSeconds = Math.max(
    0,
    targetMinutes * 60 - elapsedSeconds
  );

  const timerDisplay = timerMode === 'down'
    ? formatTime(remainingSeconds)
    : formatTime(elapsedSeconds);

  const tabs = [
    ['dashboard', '🏠 Dashboard'],
    ['students', '🎼 Students'],
    ['practice', '⏱️ Practice'],
    ['progress', '🏆 Progress']
  ];

  if (authLoading) {
    return (
      <main style={css.page}>
        <p>Loading Practice Pal...</p>
      </main>
    );
  }

  if (!session) {
    return (
      <main style={{
        ...css.page,
        display: 'grid',
        placeItems: 'center'
      }}>
        <section style={{
          ...css.card,
          width: '100%',
          maxWidth: 420,
          boxSizing: 'border-box'
        }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 48 }}>🎵</div>
            <h1>Practice Pal</h1>
            <p>Small practices. Big progress.</p>
          </div>

          <form onSubmit={signIn}>
            <h2>Family Sign In</h2>

            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              required
              style={css.input}
              value={email}
              onChange={event =>
                setEmail(event.target.value)
              }
            />

            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              required
              style={css.input}
              value={password}
              onChange={event =>
                setPassword(event.target.value)
              }
            />

            <button
              type="submit"
              style={{ ...css.button, width: '100%' }}
            >
              Sign In
            </button>
          </form>

          {authError && (
            <p role="alert" style={{
              color: theme.red
            }}>
              {authError}
            </p>
          )}
        </section>
      </main>
    );
  }

  return (
    <main style={css.page}>
      <div style={css.shell}>
        <header style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 12,
          marginBottom: 20
        }}>
          <div>
            <h1 style={{ marginBottom: 4 }}>
              🎵 Practice Pal
            </h1>
            <small style={{ color: theme.muted }}>
              {session.user.email}
            </small>
          </div>

          <button
            type="button"
            style={css.secondary}
            onClick={signOut}
          >
            Sign Out
          </button>
        </header>

        <nav
          aria-label="Main navigation"
          style={{
            display: 'flex',
            gap: 8,
            overflowX: 'auto',
            marginBottom: 22,
            paddingBottom: 8
          }}
        >
          {tabs.map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              aria-current={
                tab === id ? 'page' : undefined
              }
              style={{
                ...css.secondary,
                whiteSpace: 'nowrap',
                fontWeight: 700,
                background:
                  tab === id ? theme.navy : '#fff',
                color:
                  tab === id ? '#fff' : theme.navy
              }}
            >
              {label}
            </button>
          ))}
        </nav>

        {familyLoading ? (
          <div style={css.card}>Loading family...</div>
        ) : familyError ? (
          <p role="alert" style={{ color: theme.red }}>
            {familyError}
          </p>
        ) : !familyId ? (
          <div style={css.card}>
            Waiting for family information...
          </div>
        ) : (
          <>
            {notice && (
              <p role="status" style={{
                padding: 14,
                background: '#f0fdf4',
                color: theme.green,
                borderRadius: 10
              }}>
                {notice}
              </p>
            )}

            {studentError && (
              <p role="alert" style={{ color: theme.red }}>
                {studentError}
              </p>
            )}

            {sessionError && (
              <p role="alert" style={{
                padding: 14,
                background: '#fef2f2',
                color: theme.red,
                borderRadius: 10
              }}>
                Practice log: {sessionError}
              </p>
            )}

            {tab === 'dashboard' && (
              <>
                <section style={{
                  background:
                    'linear-gradient(120deg,#2563eb,#7c3aed)',
                  color: '#fff',
                  borderRadius: 20,
                  padding: 28,
                  marginBottom: 20
                }}>
                  <h2>Ready to make some music? 🎶</h2>
                  <p>
                    Every practice brings you closer
                    to your goals.
                  </p>
                  <button
                    type="button"
                    style={css.secondary}
                    onClick={() => setTab('practice')}
                  >
                    ⏱️ Start Practicing
                  </button>
                </section>

                <div style={{
                  display: 'grid',
                  gridTemplateColumns:
                    'repeat(auto-fit,minmax(180px,1fr))',
                  gap: 14,
                  marginBottom: 20
                }}>
                  {[
                    ['👨‍👩‍👧‍👦', 'Students', students.length],
                    ['🎯', 'Weekly Goal', `${totalGoal} min`],
                    ['🎵', 'Practiced This Week',
                      `${weeklyTotal} min`]
                  ].map(([icon, label, value]) => (
                    <div key={label} style={css.card}>
                      <div style={{ fontSize: 26 }}>{icon}</div>
                      <p style={{ color: theme.muted }}>
                        {label}
                      </p>
                      <strong style={{ fontSize: 27 }}>
                        {value}
                      </strong>
                    </div>
                  ))}
                </div>

                <section style={css.card}>
                  <h2>Your Musicians</h2>

                  {dataLoading ? (
                    <p>Loading students...</p>
                  ) : students.length === 0 ? (
                    <p>Add your first musician to begin.</p>
                  ) : (
                    <div style={{
                      display: 'grid',
                      gridTemplateColumns:
                        'repeat(auto-fit,minmax(220px,1fr))',
                      gap: 14
                    }}>
                      {students.map(student => {
                        const practiced = minutesForStudent(
                          sessions,
                          student.id
                        );

                        return (
                          <div
                            key={student.id}
                            style={{
                              background: theme.background,
                              padding: 16,
                              borderRadius: 14
                            }}
                          >
                            <h3>🎵 {student.name}</h3>
                            <p>{student.instrument}</p>

                            <ProgressBar
                              value={practiced}
                              goal={
                                student.weekly_goal_minutes || 0
                              }
                            />

                            <button
                              type="button"
                              style={{
                                ...css.button,
                                marginTop: 14
                              }}
                              disabled={
                                timerStatus !== 'idle'
                              }
                              onClick={() => {
                                setSelectedStudentId(student.id);
                                setTab('practice');
                              }}
                            >
                              Practice
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </section>
              </>
            )}

            {tab === 'students' && (
              <section style={css.card}>
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: 12
                }}>
                  <h2>🎼 Student Profiles</h2>
                  {!formOpen && (
                    <button
                      type="button"
                      style={css.button}
                      onClick={addStudent}
                    >
                      + Add Student
                    </button>
                  )}
                </div>

                {formOpen && (
                  <form
                    onSubmit={saveStudent}
                    style={{
                      background: theme.background,
                      padding: 18,
                      borderRadius: 14,
                      marginBottom: 20
                    }}
                  >
                    <h3>
                      {editingId
                        ? 'Edit Student'
                        : 'Add Student'}
                    </h3>

                    <label htmlFor="studentName">
                      Student Name
                    </label>
                    <input
                      id="studentName"
                      required
                      maxLength={100}
                      style={css.input}
                      value={studentForm.name}
                      onChange={event =>
                        setStudentForm(previous => ({
                          ...previous,
                          name: event.target.value
                        }))
                      }
                    />

                    <label htmlFor="instrument">
                      Instrument
                    </label>
                    <select
                      id="instrument"
                      required
                      style={css.input}
                      value={studentForm.instrument}
                      onChange={event =>
                        setStudentForm(previous => ({
                          ...previous,
                          instrument: event.target.value
                        }))
                      }
                    >
                      <option value="">Select instrument</option>
                      {instruments.map(item => (
                        <option key={item} value={item}>
                          {item}
                        </option>
                      ))}
                    </select>

                    <label htmlFor="weeklyGoal">
                      Weekly Goal (minutes)
                    </label>
                    <input
                      id="weeklyGoal"
                      type="number"
                      min="0"
                      max="10080"
                      step="1"
                      required
                      style={css.input}
                      value={
                        studentForm.weekly_goal_minutes
                      }
                      onChange={event =>
                        setStudentForm(previous => ({
                          ...previous,
                          weekly_goal_minutes:
                            event.target.value
                        }))
                      }
                    />

                    <div style={{
                      display: 'flex',
                      gap: 10,
                      flexWrap: 'wrap'
                    }}>
                      <button
                        type="submit"
                        style={css.button}
                        disabled={busy}
                      >
                        {busy ? 'Saving...' : 'Save Student'}
                      </button>

                      <button
                        type="button"
                        style={css.secondary}
                        disabled={busy}
                        onClick={cancelForm}
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                )}

                {students.map(student => (
                  <div
                    key={student.id}
                    style={{
                      borderTop: `1px solid ${theme.border}`,
                      padding: '18px 0'
                    }}
                  >
                    <h3>🎵 {student.name}</h3>
                    <p>
                      {student.instrument} ·{' '}
                      {student.weekly_goal_minutes} min/week
                    </p>

                    <div style={{
                      display: 'flex',
                      gap: 10,
                      flexWrap: 'wrap'
                    }}>
                      <button
                        type="button"
                        style={css.secondary}
                        disabled={busy}
                        onClick={() => editStudent(student)}
                      >
                        Edit Profile
                      </button>

                      <button
                        type="button"
                        style={{
                          ...css.secondary,
                          color: theme.red
                        }}
                        disabled={busy}
                        onClick={() => deleteStudent(student)}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </section>
            )}

            {tab === 'practice' && (
              <div style={{
                display: 'grid',
                gap: 20
              }}>
                <section style={{
                  ...css.card,
                  maxWidth: 650,
                  width: '100%',
                  margin: '0 auto',
                  boxSizing: 'border-box'
                }}>
                  <h2>⏱️ Practice Timer</h2>

                  <label htmlFor="practiceStudent">
                    Select Musician
                  </label>
                  <select
                    id="practiceStudent"
                    style={css.input}
                    value={selectedStudentId}
                    disabled={timerStatus !== 'idle'}
                    onChange={event =>
                      changeSelectedStudent(event.target.value)
                    }
                  >
                    <option value="">Choose a student</option>
                    {students.map(student => (
                      <option
                        key={student.id}
                        value={student.id}
                      >
                        {student.name} — {student.instrument}
                      </option>
                    ))}
                  </select>

                  <div style={{
                    display: 'flex',
                    gap: 10,
                    marginBottom: 20
                  }}>
                    {[
                      ['up', 'Count Up'],
                      ['down', 'Countdown']
                    ].map(([value, label]) => (
                      <button
                        key={value}
                        type="button"
                        disabled={timerStatus !== 'idle'}
                        onClick={() => changeTimerMode(value)}
                        style={{
                          ...css.secondary,
                          flex: 1,
                          fontWeight: 700,
                          background:
                            timerMode === value
                              ? theme.navy
                              : '#fff',
                          color:
                            timerMode === value
                              ? '#fff'
                              : theme.navy
                        }}
                      >
                        {label}
                      </button>
                    ))}
                  </div>

                  {timerMode === 'down' && (
                    <div>
                      <label htmlFor="duration">
                        Countdown Duration (minutes)
                      </label>
                      <input
                        id="duration"
                        type="number"
                        min="1"
                        max="240"
                        step="1"
                        style={css.input}
                        disabled={timerStatus !== 'idle'}
                        value={targetMinutes}
                        onChange={event =>
                          changeTargetMinutes(event.target.value)
                        }
                      />

                      <div style={{
                        display: 'flex',
                        gap: 8,
                        flexWrap: 'wrap',
                        marginBottom: 18
                      }}>
                        {[5, 10, 15, 20, 30].map(value => (
                          <button
                            key={value}
                            type="button"
                            style={css.secondary}
                            disabled={timerStatus !== 'idle'}
                            onClick={() =>
                              changeTargetMinutes(value)
                            }
                          >
                            {value} min
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  <div style={{
                    background: theme.background,
                    borderRadius: 20,
                    padding: '32px 12px',
                    textAlign: 'center',
                    marginBottom: 20
                  }}>
                    <div style={{
                      fontSize: 'clamp(48px,10vw,76px)',
                      fontWeight: 800,
                      fontVariantNumeric: 'tabular-nums',
                      letterSpacing: 2
                    }}>
                      {timerDisplay}
                    </div>

                    <p style={{ color: theme.muted }}>
                      {timerMode === 'down'
                        ? 'Time Remaining'
                        : 'Practice Time'}
                    </p>

                    {timerStatus === 'finished' && (
                      <h3 style={{ color: theme.green }}>
                        🎉 Great practice!
                      </h3>
                    )}
                  </div>

                  <div style={{
                    display: 'flex',
                    gap: 10,
                    justifyContent: 'center',
                    flexWrap: 'wrap'
                  }}>
                    {timerStatus === 'idle' && (
                      <button
                        type="button"
                        style={css.button}
                        onClick={startTimer}
                      >
                        ▶ Start Practice
                      </button>
                    )}

                    {timerStatus === 'running' && (
                      <button
                        type="button"
                        style={css.button}
                        onClick={pauseTimer}
                      >
                        ⏸ Pause
                      </button>
                    )}

                    {timerStatus === 'paused' && (
                      <button
                        type="button"
                        style={css.button}
                        onClick={resumeTimer}
                      >
                        ▶ Resume
                      </button>
                    )}

                    {['running', 'paused'].includes(
                      timerStatus
                    ) && (
                      <button
                        type="button"
                        style={css.secondary}
                        onClick={finishTimer}
                      >
                        ■ Finish
                      </button>
                    )}

                    {timerStatus !== 'idle' && (
                      <button
                        type="button"
                        style={css.secondary}
                        disabled={savingSession}
                        onClick={resetTimer}
                      >
                        ↻ Reset
                      </button>
                    )}
                  </div>

                  {timerStatus === 'finished' && (
                    <div style={{
                      marginTop: 25,
                      borderTop: `1px solid ${theme.border}`,
                      paddingTop: 20
                    }}>
                      <h3>Save Practice Session</h3>

                      <p>
                        Student:{' '}
                        <strong>
                          {selectedStudent?.name}
                        </strong>
                      </p>

                      <p>
                        Actual practice:{' '}
                        <strong>
                          {formatTime(elapsedSeconds)}
                        </strong>
                      </p>

                      <label htmlFor="notes">
                        Practice Notes (optional)
                      </label>
                      <textarea
                        id="notes"
                        rows={3}
                        maxLength={1000}
                        style={css.input}
                        placeholder="What did you practice today?"
                        value={notes}
                        onChange={event =>
                          setNotes(event.target.value)
                        }
                      />

                      <button
                        type="button"
                        style={{
                          ...css.button,
                          width: '100%'
                        }}
                        disabled={savingSession}
                        onClick={savePractice}
                      >
                        {savingSession
                          ? 'Saving...'
                          : '💾 Save to Practice Log'}
                      </button>
                    </div>
                  )}
                </section>

                <section style={css.card}>
                  <h2>📖 Practice Log</h2>

                  {!selectedStudentId ? (
                    <p>Select a student to view their log.</p>
                  ) : sessions.filter(item =>
                    item.student_id === selectedStudentId
                  ).length === 0 ? (
                    <p>No saved sessions yet.</p>
                  ) : (
                    sessions
                      .filter(item =>
                        item.student_id === selectedStudentId
                      )
                      .map(item => (
                        <div
                          key={item.id}
                          style={{
                            borderTop:
                              `1px solid ${theme.border}`,
                            padding: '14px 0'
                          }}
                        >
                          <strong>
                            {item.duration_minutes} minutes
                          </strong>
                          <p style={{
                            color: theme.muted,
                            fontSize: 13
                          }}>
                            {new Date(
                              item.created_at
                            ).toLocaleString()}
                          </p>
                          {item.notes && (
                            <p>{item.notes}</p>
                          )}
                        </div>
                      ))
                  )}
                </section>
              </div>
            )}

            {tab === 'progress' && (
              <section style={css.card}>
                <h2>🏆 Weekly Progress</h2>
                <p style={{ color: theme.muted }}>
                  Track each student's progress toward
                  their weekly practice goal.
                </p>

                {students.map(student => (
                  <div
                    key={student.id}
                    style={{
                      padding: '18px 0',
                      borderBottom:
                        `1px solid ${theme.border}`
                    }}
                  >
                    <h3>{student.name}</h3>

                    <ProgressBar
                      value={minutesForStudent(
                        sessions,
                        student.id
                      )}
                      goal={
                        student.weekly_goal_minutes || 0
                      }
                    />
                  </div>
                ))}
              </section>
            )}
          </>
        )}

        <footer style={{
          textAlign: 'center',
          marginTop: 35,
          paddingBottom: 20,
          color: theme.muted,
          fontSize: 12
        }}>
          Practice Pal · Make every practice count.
        </footer>
      </div>
    </main>
  );
}
