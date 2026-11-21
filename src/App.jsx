
import React, { useEffect, useRef, useState } from "react";
import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const supabase = url && key ? createClient(url, key) : null;

const studentColumns =
  "id,family_id,name,instrument,weekly_goal_minutes,created_at";
const sessionColumns =
  "id,family_id,student_id,practice_date,minutes,category,focus,notes,created_at";

const instruments = [
  "Piano", "Guitar", "Violin", "Viola", "Cello",
  "Flute", "Clarinet", "Saxophone", "Trumpet",
  "Trombone", "French Horn", "Drums",
  "Percussion", "Voice", "Other"
];

const categories = [
  "Other", "Warm-up", "Scales", "Technique",
  "Repertoire", "Sight Reading", "Ear Training",
  "Performance Preparation"
];

const blankStudent = {
  name: "",
  instrument: "",
  weekly_goal_minutes: "60"
};

const C = {
  navy: "#172554",
  blue: "#2563eb",
  purple: "#7c3aed",
  bg: "#f3f6ff",
  gray: "#64748b",
  border: "#e2e8f0",
  green: "#15803d",
  red: "#b91c1c"
};

const S = {
  page: {
    minHeight: "100vh",
    background: C.bg,
    color: C.navy,
    fontFamily: "Arial, sans-serif",
    padding: "20px 14px",
    boxSizing: "border-box"
  },
  shell: { maxWidth: 1050, margin: "0 auto" },
  card: {
    background: "#fff",
    border: `1px solid ${C.border}`,
    borderRadius: 18,
    padding: 22,
    marginBottom: 16
  },
  primary: {
    background: C.blue,
    color: "#fff",
    border: 0,
    borderRadius: 10,
    padding: "12px 18px",
    fontSize: 15,
    fontWeight: 700,
    cursor: "pointer"
  },
  secondary: {
    background: "#fff",
    color: C.navy,
    border: `1px solid ${C.border}`,
    borderRadius: 10,
    padding: "11px 15px",
    cursor: "pointer"
  },
  input: {
    display: "block",
    width: "100%",
    boxSizing: "border-box",
    padding: 12,
    marginTop: 6,
    marginBottom: 16,
    border: `1px solid ${C.border}`,
    borderRadius: 10,
    fontSize: 16,
    background: "#fff"
  }
};

function formatTime(seconds) {
  const n = Math.max(0, Math.floor(seconds));
  const h = Math.floor(n / 3600);
  const m = Math.floor((n % 3600) / 60);
  const s = n % 60;
  const two = v => String(v).padStart(2, "0");
  return h
    ? `${two(h)}:${two(m)}:${two(s)}`
    : `${two(m)}:${two(s)}`;
}

function localDate(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function weekStart() {
  const now = new Date();
  const offset = (now.getDay() + 6) % 7;
  const start = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() - offset
  );
  return localDate(start);
}

function weeklyMinutes(sessions, studentId) {
  const start = weekStart();
  const today = localDate();

  return sessions
    .filter(item =>
      item.student_id === studentId &&
      item.practice_date >= start &&
      item.practice_date <= today
    )
    .reduce((sum, item) => sum + Number(item.minutes || 0), 0);
}

function Progress({ value, goal }) {
  const percent = goal > 0
    ? Math.min(100, Math.round(value / goal * 100))
    : 0;

  return (
    <div>
      <div style={{
        display: "flex",
        justifyContent: "space-between",
        marginBottom: 8,
        fontSize: 13
      }}>
        <span>{value} / {goal} minutes</span>
        <strong>{percent}%</strong>
      </div>
      <div style={{
        height: 11,
        borderRadius: 20,
        background: C.border,
        overflow: "hidden"
      }}>
        <div style={{
          width: `${percent}%`,
          height: "100%",
          background: C.purple
        }} />
      </div>
    </div>
  );
}

export default function App() {
  const [session, setSession] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authError, setAuthError] = useState("");

  const [familyId, setFamilyId] = useState(null);
  const [familyLoading, setFamilyLoading] = useState(false);
  const [familyError, setFamilyError] = useState("");

  const [students, setStudents] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [dataLoading, setDataLoading] = useState(false);
  const [studentError, setStudentError] = useState("");
  const [sessionError, setSessionError] = useState("");
  const [notice, setNotice] = useState("");
  const [tab, setTab] = useState("dashboard");

  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [studentForm, setStudentForm] = useState({
    ...blankStudent
  });
  const [busy, setBusy] = useState(false);

  const [selectedStudentId, setSelectedStudentId] = useState("");
  const [timerMode, setTimerMode] = useState("up");
  const [targetMinutes, setTargetMinutes] = useState(15);
  const [timerStatus, setTimerStatus] = useState("idle");
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [category, setCategory] = useState("Other");
  const [focus, setFocus] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const elapsedMsRef = useRef(0);
  const startedAtRef = useRef(null);
  const statusRef = useRef("idle");
  const elapsedRef = useRef(0);
  const savingRef = useRef(false);
  const timerOwnerRef = useRef(null);

  const userId = session?.user?.id ?? null;

  function status(value) {
    statusRef.current = value;
    setTimerStatus(value);
  }

  function resetClock() {
    elapsedMsRef.current = 0;
    startedAtRef.current = null;
    elapsedRef.current = 0;
    setElapsedSeconds(0);
    status("idle");
    timerOwnerRef.current = null;
  }

  function hasUnsavedTimer() {
    return statusRef.current !== "idle" &&
      (elapsedRef.current > 0 ||
        startedAtRef.current !== null);
  }

  useEffect(() => {
    if (!supabase) {
      setAuthError("Supabase environment variables are missing.");
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

    const { data: { subscription } } =
      supabase.auth.onAuthStateChange((_event, next) => {
        if (!active) return;
        setSession(next);
        setAuthLoading(false);
      });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    setFamilyId(null);
    setFamilyError("");
    setStudents([]);
    setSessions([]);
    setSelectedStudentId("");
    setStudentError("");
    setSessionError("");
    setNotice("");
    setTab("dashboard");
    setFormOpen(false);
    resetClock();

    if (!supabase || !userId) {
      setFamilyLoading(false);
      return;
    }

    let cancelled = false;
    setFamilyLoading(true);

    async function loadFamily() {
      const { data, error } = await supabase
        .from("family_members")
        .select("family_id")
        .eq("user_id", userId);

      if (cancelled) return;

      if (error) {
        setFamilyError(error.message);
      } else if (data?.length !== 1) {
        setFamilyError(
          "Expected exactly one family membership."
        );
      } else {
        setFamilyId(data[0].family_id);
      }

      setFamilyLoading(false);
    }

    loadFamily();
    return () => { cancelled = true; };
  }, [userId]);

  useEffect(() => {
    if (!supabase || !userId || !familyId) {
      setDataLoading(false);
      return;
    }

    let cancelled = false;
    setDataLoading(true);
    setStudentError("");
    setSessionError("");

    async function loadData() {
      const [a, b] = await Promise.all([
        supabase.from("students")
          .select(studentColumns)
          .eq("family_id", familyId)
          .order("name"),
        supabase.from("practice_sessions")
          .select(sessionColumns)
          .eq("family_id", familyId)
          .order("practice_date", { ascending: false })
          .order("created_at", { ascending: false })
      ]);

      if (cancelled) return;

      if (a.error) setStudentError(a.error.message);
      else setStudents(a.data ?? []);

      if (b.error) setSessionError(b.error.message);
      else setSessions(b.data ?? []);

      setDataLoading(false);
    }

    loadData();
    return () => { cancelled = true; };
  }, [userId, familyId]);

  useEffect(() => {
    if (
      selectedStudentId &&
      !students.some(s => s.id === selectedStudentId)
    ) {
      setSelectedStudentId("");
    }
  }, [students, selectedStudentId]);

  useEffect(() => {
    if (timerStatus !== "running") return;

    function tick() {
      if (startedAtRef.current === null) return;

      const ms = elapsedMsRef.current +
        Math.max(0, Date.now() - startedAtRef.current);

      const limit = targetMinutes * 60000;

      if (timerMode === "down" && ms >= limit) {
        elapsedMsRef.current = limit;
        startedAtRef.current = null;
        elapsedRef.current = targetMinutes * 60;
        setElapsedSeconds(targetMinutes * 60);
        status("finished");
        return;
      }

      const seconds = Math.floor(ms / 1000);
      elapsedRef.current = seconds;
      setElapsedSeconds(seconds);
    }

    tick();
    const id = setInterval(tick, 250);
    return () => clearInterval(id);
  }, [timerStatus, timerMode, targetMinutes]);

  useEffect(() => {
    function beforeUnload(event) {
      if (!hasUnsavedTimer()) return;
      event.preventDefault();
      event.returnValue = "";
    }

    window.addEventListener("beforeunload", beforeUnload);
    return () =>
      window.removeEventListener("beforeunload", beforeUnload);
  }, []);

  function startTimer() {
    if (!selectedStudentId) {
      setSessionError("Please select a student first.");
      return;
    }

    if (statusRef.current !== "idle") return;

    setSessionError("");
    setNotice("");
    elapsedMsRef.current = 0;
    elapsedRef.current = 0;
    startedAtRef.current = Date.now();
    timerOwnerRef.current = userId;
    setElapsedSeconds(0);
    status("running");
  }

  function pauseTimer() {
    if (statusRef.current !== "running") return;

    elapsedMsRef.current +=
      Math.max(0, Date.now() - startedAtRef.current);
    startedAtRef.current = null;

    const seconds = Math.floor(elapsedMsRef.current / 1000);
    elapsedRef.current = seconds;
    setElapsedSeconds(seconds);
    status("paused");
  }

  function resumeTimer() {
    if (statusRef.current !== "paused") return;
    startedAtRef.current = Date.now();
    status("running");
  }

  function finishTimer() {
    if (!["running", "paused"].includes(statusRef.current))
      return;

    if (statusRef.current === "running") {
      elapsedMsRef.current +=
        Math.max(0, Date.now() - startedAtRef.current);
      startedAtRef.current = null;
    }

    if (timerMode === "down") {
      elapsedMsRef.current = Math.min(
        elapsedMsRef.current,
        targetMinutes * 60000
      );
    }

    const seconds = Math.floor(elapsedMsRef.current / 1000);
    elapsedRef.current = seconds;
    setElapsedSeconds(seconds);
    status("finished");
  }

  function resetTimer() {
    if (savingRef.current) return;

    if (
      hasUnsavedTimer() &&
      !window.confirm("Discard this unsaved practice session?")
    ) return;

    resetClock();
    setFocus("");
    setNotes("");
    setCategory("Other");
    setSessionError("");
  }

  async function refreshStudents() {
    const { data, error } = await supabase
      .from("students")
      .select(studentColumns)
      .eq("family_id", familyId)
      .order("name");

    if (error) {
      setStudentError(error.message);
      return false;
    }
    setStudents(data ?? []);
    return true;
  }

  async function refreshSessions() {
    const { data, error } = await supabase
      .from("practice_sessions")
      .select(sessionColumns)
      .eq("family_id", familyId)
      .order("practice_date", { ascending: false })
      .order("created_at", { ascending: false });

    if (error) {
      setSessionError(error.message);
      return false;
    }

    setSessions(data ?? []);
    return true;
  }

  async function savePractice() {
    if (
      !supabase || !familyId ||
      !selectedStudentId || savingRef.current ||
      statusRef.current !== "finished"
    ) return;

    if (timerOwnerRef.current !== userId) {
      setSessionError("Session ownership changed. Please sign in again.");
      return;
    }

    const student = students.find(
      s => s.id === selectedStudentId &&
        s.family_id === familyId
    );

    if (!student) {
      setSessionError("Select a valid family student.");
      return;
    }

    const seconds = elapsedRef.current;

    if (seconds < 1) {
      setSessionError("Practice for at least one second.");
      return;
    }

    // The existing database stores whole minutes.
    // A partial minute is rounded up when saved.
    const minutes = Math.ceil(seconds / 60);

    savingRef.current = true;
    setSaving(true);
    setSessionError("");
    setNotice("");

    const { data, error } = await supabase
      .from("practice_sessions")
      .insert({
        family_id: familyId,
        student_id: selectedStudentId,
        practice_date: localDate(),
        minutes,
        category,
        focus: focus.trim() || null,
        notes: notes.trim() || null
      })
      .select("id");

    if (error) {
      setSessionError(error.message);
    } else if (data?.length !== 1) {
      setSessionError(
        "The save could not be confirmed. Check the log before retrying."
      );
      // Avoid treating an uncertain response as a confirmed save.
    } else {
      resetClock();
      setFocus("");
      setNotes("");
      setCategory("Other");
      setNotice(
        `🎉 ${minutes} minute(s) saved to ${student.name}'s practice log!`
      );
      await refreshSessions();
    }

    savingRef.current = false;
    setSaving(false);
  }

  async function signIn(event) {
    event.preventDefault();
    if (!supabase) return;

    setAuthLoading(true);
    setAuthError("");

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    if (error) setAuthError(error.message);
    setAuthLoading(false);
  }

  async function signOut() {
    if (!supabase) return;

    if (
      hasUnsavedTimer() &&
      !window.confirm(
        "Sign out and discard your unsaved practice time?"
      )
    ) return;

    const { error } = await supabase.auth.signOut();
    if (error) setAuthError(error.message);
  }

  function addStudent() {
    setEditingId(null);
    setStudentForm({ ...blankStudent });
    setFormOpen(true);
    setStudentError("");
    setTab("students");
  }

  function editStudent(student) {
    setEditingId(student.id);
    setStudentForm({
      name: student.name ?? "",
      instrument: student.instrument ?? "",
      weekly_goal_minutes: String(
        student.weekly_goal_minutes ?? 60
      )
    });
    setFormOpen(true);
    setStudentError("");
    setTab("students");
  }

  function cancelForm() {
    setEditingId(null);
    setStudentForm({ ...blankStudent });
    setFormOpen(false);
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
      !name || !instrument || !goalText ||
      !Number.isSafeInteger(goal) ||
      goal < 0 || goal > 10080
    ) {
      setStudentError(
        "Enter a name, instrument, and valid weekly goal."
      );
      return;
    }

    setBusy(true);
    setStudentError("");
    setNotice("");

    const payload = {
      name,
      instrument,
      weekly_goal_minutes: goal
    };

    const wasEditing = Boolean(editingId);

    const result = editingId
      ? await supabase.from("students")
          .update(payload)
          .eq("id", editingId)
          .eq("family_id", familyId)
          .select("id")
      : await supabase.from("students")
          .insert({ ...payload, family_id: familyId })
          .select("id");

    if (result.error) {
      setStudentError(result.error.message);
    } else if (result.data?.length !== 1) {
      setStudentError("Student change could not be confirmed.");
    } else {
      cancelForm();
      if (await refreshStudents()) {
        setNotice(
          wasEditing ? "Student updated." : "Student added."
        );
      }
    }

    setBusy(false);
  }

  async function deleteStudent(student) {
    if (!supabase || !familyId || busy) return;

    if (
      selectedStudentId === student.id &&
      hasUnsavedTimer()
    ) {
      setStudentError(
        "Finish or reset this student's timer before deleting."
      );
      return;
    }

    if (!window.confirm(
      `Delete ${student.name}? Related practice history may be affected.`
    )) return;

    setBusy(true);
    setStudentError("");
    setNotice("");

    const { data, error } = await supabase
      .from("students")
      .delete()
      .eq("id", student.id)
      .eq("family_id", familyId)
      .select("id");

    if (error) {
      setStudentError(error.message);
    } else if (data?.length !== 1) {
      setStudentError("Deletion could not be confirmed.");
    } else {
      if (editingId === student.id) cancelForm();
      if (await refreshStudents()) {
        setNotice("Student deleted.");
        await refreshSessions();
      }
    }

    setBusy(false);
  }

  const totalGoal = students.reduce(
    (sum, s) => sum + Number(s.weekly_goal_minutes || 0),
    0
  );

  const weeklyTotal = students.reduce(
    (sum, s) => sum + weeklyMinutes(sessions, s.id),
    0
  );

  const selectedStudent = students.find(
    s => s.id === selectedStudentId
  );

  const studentSessions = sessions.filter(
    s => s.student_id === selectedStudentId
  );

  const remainingSeconds = Math.max(
    0,
    targetMinutes * 60 - elapsedSeconds
  );

  const timerDisplay = timerMode === "down"
    ? formatTime(remainingSeconds)
    : formatTime(elapsedSeconds);

  const nav = [
    ["dashboard", "🏠 Dashboard"],
    ["students", "🎼 Students"],
    ["practice", "⏱️ Practice"],
    ["progress", "🏆 Progress"]
  ];

  if (authLoading) {
    return <main style={S.page}>Loading Practice Pal...</main>;
  }

  if (!session) {
    return (
      <main style={{
        ...S.page,
        display: "grid",
        placeItems: "center"
      }}>
        <section style={{
          ...S.card,
          width: "100%",
          maxWidth: 420,
          boxSizing: "border-box"
        }}>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 48 }}>🎵</div>
            <h1>Practice Pal</h1>
            <p style={{ color: C.gray }}>
              Small practices. Big progress.
            </p>
          </div>

          <form onSubmit={signIn}>
            <h2>Family Sign In</h2>

            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              required
              autoComplete="email"
              style={S.input}
              value={email}
              onChange={e => setEmail(e.target.value)}
            />

            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              required
              autoComplete="current-password"
              style={S.input}
              value={password}
              onChange={e => setPassword(e.target.value)}
            />

            <button type="submit" style={{
              ...S.primary,
              width: "100%"
            }}>
              Sign In
            </button>
          </form>

          {authError && (
            <p role="alert" style={{ color: C.red }}>
              {authError}
            </p>
          )}
        </section>
      </main>
    );
  }

  return (
    <main style={S.page}>
      <div style={S.shell}>
        <header style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 12,
          marginBottom: 22
        }}>
          <div>
            <h1 style={{ margin: "0 0 5px" }}>
              🎵 Practice Pal
            </h1>
            <small style={{ color: C.gray }}>
              {session.user.email}
            </small>
          </div>

          <button
            type="button"
            style={S.secondary}
            onClick={signOut}
          >
            Sign Out
          </button>
        </header>

        <nav aria-label="Main navigation" style={{
          display: "flex",
          gap: 8,
          overflowX: "auto",
          paddingBottom: 10,
          marginBottom: 16
        }}>
          {nav.map(([id, label]) => (
            <button
              key={id}
              type="button"
              aria-current={tab === id ? "page" : undefined}
              onClick={() => setTab(id)}
              style={{
                ...S.secondary,
                whiteSpace: "nowrap",
                fontWeight: 700,
                background: tab === id ? C.navy : "#fff",
                color: tab === id ? "#fff" : C.navy
              }}
            >
              {label}
            </button>
          ))}
        </nav>

        {familyLoading ? (
          <div style={S.card}>Loading family...</div>
        ) : familyError ? (
          <p role="alert" style={{ color: C.red }}>
            {familyError}
          </p>
        ) : !familyId ? (
          <div style={S.card}>
            Waiting for family information...
          </div>
        ) : (
          <>
            {notice && (
              <p role="status" style={{
                background: "#f0fdf4",
                color: C.green,
                padding: 14,
                borderRadius: 10
              }}>
                {notice}
              </p>
            )}

            {studentError && (
              <p role="alert" style={{
                color: C.red,
                padding: 10
              }}>
                {studentError}
              </p>
            )}

            {sessionError && (
              <p role="alert" style={{
                background: "#fef2f2",
                color: C.red,
                padding: 14,
                borderRadius: 10
              }}>
                Practice log: {sessionError}
              </p>
            )}

            {tab === "dashboard" && (
              <>
                <section style={{
                  background:
                    "linear-gradient(120deg,#2563eb,#7c3aed)",
                  color: "#fff",
                  padding: 28,
                  borderRadius: 20,
                  marginBottom: 20
                }}>
                  <h2>Ready to make some music? 🎶</h2>
                  <p>
                    Every practice brings you closer to your goals.
                  </p>
                  <button
                    type="button"
                    style={S.secondary}
                    onClick={() => setTab("practice")}
                  >
                    ⏱️ Start Practicing
                  </button>
                </section>

                <div style={{
                  display: "grid",
                  gridTemplateColumns:
                    "repeat(auto-fit,minmax(180px,1fr))",
                  gap: 14
                }}>
                  {[
                    ["👨‍👩‍👧‍👦", "Students", students.length],
                    ["🎯", "Weekly Goal", `${totalGoal} min`],
                    ["🎵", "Practiced This Week",
                      `${weeklyTotal} min`]
                  ].map(([icon, label, value]) => (
                    <div key={label} style={S.card}>
                      <div style={{ fontSize: 26 }}>{icon}</div>
                      <p style={{ color: C.gray }}>{label}</p>
                      <strong style={{ fontSize: 27 }}>
                        {value}
                      </strong>
                    </div>
                  ))}
                </div>

                <section style={S.card}>
                  <h2>Your Musicians</h2>

                  {dataLoading ? (
                    <p>Loading students...</p>
                  ) : students.length === 0 ? (
                    <button
                      type="button"
                      style={S.primary}
                      onClick={addStudent}
                    >
                      + Add Your First Student
                    </button>
                  ) : (
                    <div style={{
                      display: "grid",
                      gridTemplateColumns:
                        "repeat(auto-fit,minmax(220px,1fr))",
                      gap: 14
                    }}>
                      {students.map(student => (
                        <div key={student.id} style={{
                          background: C.bg,
                          padding: 16,
                          borderRadius: 14
                        }}>
                          <h3>🎵 {student.name}</h3>
                          <p style={{ color: C.gray }}>
                            {student.instrument}
                          </p>

                          <Progress
                            value={weeklyMinutes(
                              sessions,
                              student.id
                            )}
                            goal={
                              student.weekly_goal_minutes || 0
                            }
                          />

                          <button
                            type="button"
                            style={{
                              ...S.primary,
                              marginTop: 14
                            }}
                            disabled={timerStatus !== "idle"}
                            onClick={() => {
                              setSelectedStudentId(student.id);
                              setTab("practice");
                            }}
                          >
                            Start Practice
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </section>
              </>
            )}

            {tab === "students" && (
              <section style={S.card}>
                <div style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  flexWrap: "wrap",
                  gap: 12
                }}>
                  <h2>🎼 Student Profiles</h2>
                  {!formOpen && (
                    <button
                      type="button"
                      style={S.primary}
                      onClick={addStudent}
                    >
                      + Add Student
                    </button>
                  )}
                </div>

                {formOpen && (
                  <form onSubmit={saveStudent} style={{
                    background: C.bg,
                    padding: 18,
                    borderRadius: 14,
                    marginBottom: 20
                  }}>
                    <h3>
                      {editingId ? "Edit Student" : "Add Student"}
                    </h3>

                    <label htmlFor="studentName">
                      Student Name
                    </label>
                    <input
                      id="studentName"
                      required
                      maxLength={100}
                      style={S.input}
                      value={studentForm.name}
                      onChange={e => setStudentForm(p => ({
                        ...p,
                        name: e.target.value
                      }))}
                    />

                    <label htmlFor="instrument">
                      Instrument
                    </label>
                    <select
                      id="instrument"
                      required
                      style={S.input}
                      value={studentForm.instrument}
                      onChange={e => setStudentForm(p => ({
                        ...p,
                        instrument: e.target.value
                      }))}
                    >
                      <option value="">Select instrument</option>
                      {instruments.map(item => (
                        <option key={item} value={item}>
                          {item}
                        </option>
                      ))}
                    </select>

                    <label htmlFor="goal">
                      Weekly Goal (minutes)
                    </label>
                    <input
                      id="goal"
                      type="number"
                      min="0"
                      max="10080"
                      step="1"
                      required
                      style={S.input}
                      value={studentForm.weekly_goal_minutes}
                      onChange={e => setStudentForm(p => ({
                        ...p,
                        weekly_goal_minutes: e.target.value
                      }))}
                    />

                    <div style={{
                      display: "flex",
                      gap: 10,
                      flexWrap: "wrap"
                    }}>
                      <button
                        type="submit"
                        disabled={busy}
                        style={S.primary}
                      >
                        {busy ? "Saving..." : "Save Student"}
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        style={S.secondary}
                        onClick={cancelForm}
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                )}

                {dataLoading && <p>Loading students...</p>}

                {students.map(student => (
                  <div key={student.id} style={{
                    borderTop: `1px solid ${C.border}`,
                    padding: "18px 0"
                  }}>
                    <h3>🎵 {student.name}</h3>
                    <p>
                      {student.instrument} ·{" "}
                      {student.weekly_goal_minutes} min/week
                    </p>

                    <div style={{
                      display: "flex",
                      gap: 10,
                      flexWrap: "wrap"
                    }}>
                      <button
                        type="button"
                        style={S.secondary}
                        disabled={busy}
                        onClick={() => editStudent(student)}
                      >
                        Edit Profile
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        style={{
                          ...S.secondary,
                          color: C.red
                        }}
                        onClick={() => deleteStudent(student)}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </section>
            )}

            {tab === "practice" && (
              <>
                <section style={{
                  ...S.card,
                  maxWidth: 650,
                  margin: "0 auto 20px"
                }}>
                  <h2>⏱️ Practice Timer</h2>

                  <label htmlFor="practiceStudent">
                    Select Musician
                  </label>
                  <select
                    id="practiceStudent"
                    style={S.input}
                    value={selectedStudentId}
                    disabled={timerStatus !== "idle"}
                    onChange={e =>
                      setSelectedStudentId(e.target.value)
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
                    display: "flex",
                    gap: 10,
                    marginBottom: 20
                  }}>
                    {[
                      ["up", "Count Up"],
                      ["down", "Countdown"]
                    ].map(([value, label]) => (
                      <button
                        key={value}
                        type="button"
                        disabled={timerStatus !== "idle"}
                        onClick={() => {
                          setTimerMode(value);
                          resetClock();
                        }}
                        style={{
                          ...S.secondary,
                          flex: 1,
                          fontWeight: 700,
                          background:
                            timerMode === value ? C.navy : "#fff",
                          color:
                            timerMode === value ? "#fff" : C.navy
                        }}
                      >
                        {label}
                      </button>
                    ))}
                  </div>

                  {timerMode === "down" && (
                    <>
                      <label htmlFor="duration">
                        Countdown Duration (minutes)
                      </label>
                      <input
                        id="duration"
                        type="number"
                        min="1"
                        max="240"
                        step="1"
                        style={S.input}
                        disabled={timerStatus !== "idle"}
                        value={targetMinutes}
                        onChange={e => {
                          const n = Number(e.target.value);
                          if (
                            Number.isSafeInteger(n) &&
                            n >= 1 && n <= 240
                          ) setTargetMinutes(n);
                        }}
                      />

                      <div style={{
                        display: "flex",
                        gap: 8,
                        flexWrap: "wrap",
                        marginBottom: 18
                      }}>
                        {[5, 10, 15, 20, 30].map(n => (
                          <button
                            key={n}
                            type="button"
                            disabled={timerStatus !== "idle"}
                            style={S.secondary}
                            onClick={() => setTargetMinutes(n)}
                          >
                            {n} min
                          </button>
                        ))}
                      </div>
                    </>
                  )}

                  <div style={{
                    background: C.bg,
                    borderRadius: 20,
                    padding: "32px 12px",
                    textAlign: "center",
                    marginBottom: 20
                  }}>
                    <div style={{
                      fontSize: "clamp(48px,10vw,76px)",
                      fontWeight: 800,
                      fontVariantNumeric: "tabular-nums"
                    }}>
                      {timerDisplay}
                    </div>

                    <p style={{ color: C.gray }}>
                      {timerMode === "down"
                        ? "Time Remaining"
                        : "Practice Time"}
                    </p>

                    {timerStatus === "finished" && (
                      <h3 style={{ color: C.green }}>
                        🎉 Great practice!
                      </h3>
                    )}
                  </div>

                  <div style={{
                    display: "flex",
                    gap: 10,
                    justifyContent: "center",
                    flexWrap: "wrap"
                  }}>
                    {timerStatus === "idle" && (
                      <button
                        type="button"
                        style={S.primary}
                        onClick={startTimer}
                      >
                        ▶ Start Practice
                      </button>
                    )}

                    {timerStatus === "running" && (
                      <button
                        type="button"
                        style={S.primary}
                        onClick={pauseTimer}
                      >
                        ⏸ Pause
                      </button>
                    )}

                    {timerStatus === "paused" && (
                      <button
                        type="button"
                        style={S.primary}
                        onClick={resumeTimer}
                      >
                        ▶ Resume
                      </button>
                    )}

                    {["running", "paused"].includes(
                      timerStatus
                    ) && (
                      <button
                        type="button"
                        style={S.secondary}
                        onClick={finishTimer}
                      >
                        ■ Finish
                      </button>
                    )}

                    {timerStatus !== "idle" && (
                      <button
                        type="button"
                        style={S.secondary}
                        disabled={saving}
                        onClick={resetTimer}
                      >
                        ↻ Reset
                      </button>
                    )}
                  </div>

                  {timerStatus === "finished" && (
                    <div style={{
                      marginTop: 25,
                      borderTop: `1px solid ${C.border}`,
                      paddingTop: 20
                    }}>
                      <h3>Save Practice Session</h3>

                      <p>
                        Musician:{" "}
                        <strong>{selectedStudent?.name}</strong>
                      </p>
                      <p>
                        Actual time:{" "}
                        <strong>
                          {formatTime(elapsedSeconds)}
                        </strong>
                      </p>

                      <label htmlFor="category">
                        Practice Category
                      </label>
                      <select
                        id="category"
                        style={S.input}
                        value={category}
                        onChange={e =>
                          setCategory(e.target.value)
                        }
                      >
                        {categories.map(item => (
                          <option key={item} value={item}>
                            {item}
                          </option>
                        ))}
                      </select>

                      <label htmlFor="focus">
                        What did you work on?
                      </label>
                      <input
                        id="focus"
                        style={S.input}
                        maxLength={200}
                        placeholder="Example: C major scale"
                        value={focus}
                        onChange={e => setFocus(e.target.value)}
                      />

                      <label htmlFor="notes">
                        Practice Notes (optional)
                      </label>
                      <textarea
                        id="notes"
                        rows={3}
                        maxLength={1000}
                        style={S.input}
                        placeholder="What went well today?"
                        value={notes}
                        onChange={e => setNotes(e.target.value)}
                      />

                      <button
                        type="button"
                        style={{
                          ...S.primary,
                          width: "100%"
                        }}
                        disabled={saving}
                        onClick={savePractice}
                      >
                        {saving
                          ? "Saving..."
                          : "💾 Save to Practice Log"}
                      </button>
                    </div>
                  )}
                </section>

                <section style={S.card}>
                  <h2>📖 Practice Log</h2>

                  {!selectedStudentId ? (
                    <p>Select a student to see their history.</p>
                  ) : studentSessions.length === 0 ? (
                    <p>No saved practice sessions yet.</p>
                  ) : (
                    studentSessions.map(item => (
                      <div key={item.id} style={{
                        borderTop: `1px solid ${C.border}`,
                        padding: "14px 0"
                      }}>
                        <strong>
                          🎵 {item.minutes} minutes
                        </strong>
                        <p style={{
                          color: C.gray,
                          fontSize: 13
                        }}>
                          {item.practice_date} · {item.category}
                        </p>
                        {item.focus && (
                          <p><strong>Focus:</strong> {item.focus}</p>
                        )}
                        {item.notes && (
                          <p><strong>Notes:</strong> {item.notes}</p>
                        )}
                      </div>
                    ))
                  )}
                </section>
              </>
            )}

            {tab === "progress" && (
              <section style={S.card}>
                <h2>🏆 Weekly Progress</h2>
                <p style={{ color: C.gray }}>
                  Practice totals for the current week,
                  beginning Monday.
                </p>

                {students.map(student => (
                  <div key={student.id} style={{
                    padding: "18px 0",
                    borderBottom: `1px solid ${C.border}`
                  }}>
                    <h3>{student.name}</h3>
                    <Progress
                      value={weeklyMinutes(
                        sessions,
                        student.id
                      )}
                      goal={
                        student.weekly_goal_minutes || 0
                      }
                    />
                  </div>
                ))}

                {students.length === 0 && (
                  <p>Add students to track their progress.</p>
                )}
              </section>
            )}
          </>
        )}

        <footer style={{
          textAlign: "center",
          marginTop: 35,
          paddingBottom: 20,
          color: C.gray,
          fontSize: 12
        }}>
          Practice Pal · Make every practice count.
        </footer>
      </div>
    </main>
  );
}
