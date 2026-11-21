
import React, { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

const supabase =
  supabaseUrl && supabaseKey
    ? createClient(supabaseUrl, supabaseKey)
    : null;

const emptyStudent = {
  name: '',
  instrument: '',
  weekly_goal: '60'
};

const instruments = [
  'Piano',
  'Guitar',
  'Violin',
  'Viola',
  'Cello',
  'Flute',
  'Clarinet',
  'Saxophone',
  'Trumpet',
  'Trombone',
  'French Horn',
  'Percussion',
  'Voice',
  'Other'
];

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
  const [studentsLoading, setStudentsLoading] = useState(false);
  const [studentError, setStudentError] = useState('');
  const [studentMessage, setStudentMessage] = useState('');

  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [studentForm, setStudentForm] = useState(emptyStudent);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  // Initialize authentication.
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
      (_event, newSession) => {
        if (!active) return;
        setSession(newSession);
        setAuthLoading(false);
      }
    );

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  // Load the signed-in user's family.
  useEffect(() => {
    const userId = session?.user?.id;

    setFamilyId(null);
    setFamilyError('');
    setStudents([]);
    setStudentError('');
    setStudentMessage('');
    setFormOpen(false);
    setEditingId(null);
    setStudentForm({ ...emptyStudent });

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
      } else if (!data || data.length === 0) {
        setFamilyError(
          'No family membership was found for this account.'
        );
      } else if (data.length > 1) {
        setFamilyError(
          'Multiple family memberships found. Please contact support.'
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
  }, [session?.user?.id]);

  // Load students belonging to the active family.
  useEffect(() => {
    if (!supabase || !session?.user?.id || !familyId) {
      setStudents([]);
      setStudentsLoading(false);
      return;
    }

    let cancelled = false;
    setStudentsLoading(true);
    setStudentError('');

    async function loadStudents() {
      const { data, error } = await supabase
        .from('students')
        .select(
          'id, family_id, name, instrument, weekly_goal, created_at'
        )
        .eq('family_id', familyId)
        .order('name', { ascending: true });

      if (cancelled) return;

      if (error) {
        setStudentError(error.message);
      } else {
        setStudents(data ?? []);
      }

      setStudentsLoading(false);
    }

    loadStudents();

    return () => {
      cancelled = true;
    };
  }, [familyId, session?.user?.id]);

  async function refreshStudents(activeFamilyId) {
    const { data, error } = await supabase
      .from('students')
      .select(
        'id, family_id, name, instrument, weekly_goal, created_at'
      )
      .eq('family_id', activeFamilyId)
      .order('name', { ascending: true });

    if (error) {
      setStudentError(error.message);
      return false;
    }

    setStudents(data ?? []);
    return true;
  }

  async function signIn(event) {
    event.preventDefault();

    if (!supabase) return;

    setAuthLoading(true);
    setAuthError('');

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    if (error) setAuthError(error.message);

    setAuthLoading(false);
  }

  async function signOut() {
    if (!supabase) return;

    setAuthError('');

    const { error } = await supabase.auth.signOut();

    if (error) setAuthError(error.message);
  }

  function startAdding() {
    setEditingId(null);
    setStudentForm({ ...emptyStudent });
    setStudentError('');
    setStudentMessage('');
    setFormOpen(true);
  }

  function startEditing(student) {
    setEditingId(student.id);

    setStudentForm({
      name: student.name ?? '',
      instrument: student.instrument ?? '',
      weekly_goal: String(student.weekly_goal ?? 60)
    });

    setStudentError('');
    setStudentMessage('');
    setFormOpen(true);
  }

  function cancelForm() {
    setFormOpen(false);
    setEditingId(null);
    setStudentForm({ ...emptyStudent });
  }

  function updateForm(field, value) {
    setStudentForm(previous => ({
      ...previous,
      [field]: value
    }));
  }

  async function saveStudent(event) {
    event.preventDefault();

    if (!supabase || !familyId || saving) return;

    const name = studentForm.name.trim();
    const instrument = studentForm.instrument.trim();
    const goalText = String(studentForm.weekly_goal).trim();
    const goal = Number(goalText);

    if (!name) {
      setStudentError('Please enter a student name.');
      return;
    }

    if (!instrument) {
      setStudentError('Please select an instrument.');
      return;
    }

    if (
      !goalText ||
      !Number.isSafeInteger(goal) ||
      goal < 0 ||
      goal > 10080
    ) {
      setStudentError(
        'Enter a weekly goal between 0 and 10,080 minutes.'
      );
      return;
    }

    setSaving(true);
    setStudentError('');
    setStudentMessage('');

    const studentData = {
      name,
      instrument,
      weekly_goal: goal
    };

    let result;

    if (editingId) {
      result = await supabase
        .from('students')
        .update(studentData)
        .eq('id', editingId)
        .eq('family_id', familyId)
        .select('id');
    } else {
      result = await supabase
        .from('students')
        .insert({
          ...studentData,
          family_id: familyId
        })
        .select('id');
    }

    if (result.error) {
      setStudentError(result.error.message);
      setSaving(false);
      return;
    }

    if (!result.data || result.data.length !== 1) {
      setStudentError(
        'The change could not be confirmed. Please check permissions.'
      );
      setSaving(false);
      return;
    }

    const wasEditing = Boolean(editingId);

    cancelForm();

    const refreshed = await refreshStudents(familyId);

    if (refreshed) {
      setStudentMessage(
        wasEditing
          ? 'Student profile updated successfully.'
          : 'Student profile added successfully.'
      );
    }

    setSaving(false);
  }

  async function deleteStudent(student) {
    if (!supabase || !familyId || deletingId) return;

    const confirmed = window.confirm(
      `Delete ${student.name}'s student profile? ` +
      'This action cannot be undone.'
    );

    if (!confirmed) return;

    setDeletingId(student.id);
    setStudentError('');
    setStudentMessage('');

    const { data, error } = await supabase
      .from('students')
      .delete()
      .eq('id', student.id)
      .eq('family_id', familyId)
      .select('id');

    if (error) {
      setStudentError(error.message);
    } else if (!data || data.length !== 1) {
      setStudentError(
        'The deletion could not be confirmed. Please check permissions.'
      );
    } else {
      if (editingId === student.id) cancelForm();

      const refreshed = await refreshStudents(familyId);

      if (refreshed) {
        setStudentMessage('Student profile deleted.');
      }
    }

    setDeletingId(null);
  }

  const styles = {
    page: {
      minHeight: '100vh',
      background: '#f0f5ff',
      fontFamily: 'Arial, sans-serif',
      padding: '24px 16px',
      boxSizing: 'border-box'
    },
    card: {
      background: '#ffffff',
      padding: '24px',
      borderRadius: '18px',
      width: '100%',
      maxWidth: '700px',
      margin: '0 auto',
      boxSizing: 'border-box',
      boxShadow: '0 8px 30px rgba(0,0,0,0.08)'
    },
    header: {
      textAlign: 'center',
      marginBottom: '24px'
    },
    panel: {
      background: '#f0f5ff',
      borderRadius: '12px',
      padding: '18px',
      marginBottom: '20px'
    },
    input: {
      width: '100%',
      padding: '12px',
      marginTop: '6px',
      marginBottom: '16px',
      border: '1px solid #cbd5e1',
      borderRadius: '8px',
      boxSizing: 'border-box',
      fontSize: '16px'
    },
    button: {
      padding: '12px 18px',
      border: 'none',
      borderRadius: '8px',
      background: '#2563eb',
      color: 'white',
      cursor: 'pointer',
      fontSize: '15px',
      fontWeight: 'bold'
    },
    secondaryButton: {
      padding: '10px 14px',
      border: '1px solid #cbd5e1',
      borderRadius: '8px',
      background: 'white',
      color: '#1e293b',
      cursor: 'pointer'
    },
    dangerButton: {
      padding: '10px 14px',
      border: '1px solid #fecaca',
      borderRadius: '8px',
      background: '#fff1f2',
      color: '#b91c1c',
      cursor: 'pointer'
    },
    studentCard: {
      border: '1px solid #e2e8f0',
      borderRadius: '12px',
      padding: '16px',
      marginBottom: '12px',
      background: 'white'
    },
    error: {
      color: '#b91c1c',
      background: '#fef2f2',
      padding: '12px',
      borderRadius: '8px'
    },
    success: {
      color: '#166534',
      background: '#f0fdf4',
      padding: '12px',
      borderRadius: '8px'
    }
  };

  return (
    <main style={styles.page}>
      <section style={styles.card}>
        <header style={styles.header}>
          <h1>🎵 Practice Pal</h1>
          <p style={{ color: '#64748b' }}>
            Make every practice count.
          </p>
        </header>

        {authLoading ? (
          <p>Loading...</p>
        ) : session ? (
          <>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '12px',
              marginBottom: '20px'
            }}>
              <div>
                <h2 style={{ marginBottom: '4px' }}>
                  Family Dashboard
                </h2>
                <small>{session.user.email}</small>
              </div>

              <button
                type="button"
                style={styles.secondaryButton}
                onClick={signOut}
              >
                Sign Out
              </button>
            </div>

            {familyLoading ? (
              <p>Loading your family...</p>
            ) : familyError ? (
              <p style={styles.error}>{familyError}</p>
            ) : !familyId ? (
              <p>Waiting for family information...</p>
            ) : (
              <>
                <div style={styles.panel}>
                  <h3 style={{ marginTop: 0 }}>
                    🏠 Your Family
                  </h3>
                  <p>
                    Manage student profiles and weekly
                    music practice goals.
                  </p>
                </div>

                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: '12px',
                  flexWrap: 'wrap',
                  marginBottom: '16px'
                }}>
                  <h3 style={{ margin: 0 }}>
                    🎼 Students ({students.length})
                  </h3>

                  {!formOpen && (
                    <button
                      type="button"
                      style={styles.button}
                      onClick={startAdding}
                    >
                      + Add Student
                    </button>
                  )}
                </div>

                {studentError && (
                  <p role="alert" style={styles.error}>
                    {studentError}
                  </p>
                )}

                {studentMessage && (
                  <p role="status" style={styles.success}>
                    {studentMessage}
                  </p>
                )}

                {formOpen && (
                  <form
                    onSubmit={saveStudent}
                    style={styles.panel}
                  >
                    <h3 style={{ marginTop: 0 }}>
                      {editingId
                        ? 'Edit Student Profile'
                        : 'Add Student Profile'}
                    </h3>

                    <label htmlFor="studentName">
                      Student Name
                    </label>
                    <input
                      id="studentName"
                      type="text"
                      required
                      maxLength={100}
                      style={styles.input}
                      placeholder="Enter student name"
                      value={studentForm.name}
                      onChange={event =>
                        updateForm(
                          'name',
                          event.target.value
                        )
                      }
                    />

                    <label htmlFor="instrument">
                      Instrument
                    </label>
                    <select
                      id="instrument"
                      required
                      style={styles.input}
                      value={studentForm.instrument}
                      onChange={event =>
                        updateForm(
                          'instrument',
                          event.target.value
                        )
                      }
                    >
                      <option value="">
                        Select an instrument
                      </option>

                      {instruments.map(instrument => (
                        <option
                          key={instrument}
                          value={instrument}
                        >
                          {instrument}
                        </option>
                      ))}
                    </select>

                    <label htmlFor="weeklyGoal">
                      Weekly Practice Goal (minutes)
                    </label>
                    <input
                      id="weeklyGoal"
                      type="number"
                      min="0"
                      max="10080"
                      step="1"
                      required
                      style={styles.input}
                      value={studentForm.weekly_goal}
                      onChange={event =>
                        updateForm(
                          'weekly_goal',
                          event.target.value
                        )
                      }
                    />

                    <div style={{
                      display: 'flex',
                      gap: '10px',
                      flexWrap: 'wrap'
                    }}>
                      <button
                        type="submit"
                        style={styles.button}
                        disabled={saving}
                      >
                        {saving
                          ? 'Saving...'
                          : editingId
                            ? 'Save Changes'
                            : 'Add Student'}
                      </button>

                      <button
                        type="button"
                        style={styles.secondaryButton}
                        onClick={cancelForm}
                        disabled={saving}
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                )}

                {studentsLoading ? (
                  <p>Loading students...</p>
                ) : students.length === 0 ? (
                  <div style={styles.panel}>
                    <p>
                      No student profiles yet.
                    </p>
                    <p>
                      Select <strong>+ Add Student</strong>
                      {' '}to create your first profile.
                    </p>
                  </div>
                ) : (
                  <div>
                    {students.map(student => (
                      <article
                        key={student.id}
                        style={styles.studentCard}
                      >
                        <h3 style={{ marginTop: 0 }}>
                          🎵 {student.name}
                        </h3>

                        <p>
                          <strong>Instrument:</strong>{' '}
                          {student.instrument || 'Not set'}
                        </p>

                        <p>
                          <strong>Weekly Goal:</strong>{' '}
                          {student.weekly_goal ?? 0}
                          {' '}minutes
                        </p>

                        <div style={{
                          display: 'flex',
                          gap: '10px',
                          flexWrap: 'wrap'
                        }}>
                          <button
                            type="button"
                            style={styles.secondaryButton}
                            onClick={() =>
                              startEditing(student)
                            }
                          >
                            Edit Profile
                          </button>

                          <button
                            type="button"
                            style={styles.dangerButton}
                            disabled={
                              deletingId === student.id
                            }
                            onClick={() =>
                              deleteStudent(student)
                            }
                          >
                            {deletingId === student.id
                              ? 'Deleting...'
                              : 'Delete'}
                          </button>
                        </div>
                      </article>
                    ))}
                  </div>
                )}
              </>
            )}
          </>
        ) : (
          <form onSubmit={signIn}>
            <h2>Family Sign In</h2>

            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              required
              autoComplete="email"
              style={styles.input}
              value={email}
              onChange={event =>
                setEmail(event.target.value)
              }
            />

            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              required
              autoComplete="current-password"
              style={styles.input}
              value={password}
              onChange={event =>
                setPassword(event.target.value)
              }
            />

            <button
              type="submit"
              style={{
                ...styles.button,
                width: '100%'
              }}
            >
              Sign In
            </button>
          </form>
        )}

        {authError && (
          <p role="alert" style={styles.error}>
            {authError}
          </p>
        )}
      </section>
    </main>
  );
}
