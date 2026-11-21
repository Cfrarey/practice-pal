
import React, { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

const supabase =
  supabaseUrl && supabaseKey
    ? createClient(supabaseUrl, supabaseKey)
    : null;

export default function App() {
  const [session, setSession] = useState(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!supabase) {
      setMessage('Supabase connection is not configured.');
      setLoading(false);
      return;
    }

    supabase.auth.getSession().then(({ data, error }) => {
      if (error) setMessage(error.message);
      setSession(data.session);
      setLoading(false);
    });

    const { data: { subscription } } =
      supabase.auth.onAuthStateChange((_event, newSession) => {
        setSession(newSession);
      });

    return () => subscription.unsubscribe();
  }, []);

  async function signIn(event) {
    event.preventDefault();
    if (!supabase) return;

    setLoading(true);
    setMessage('');

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    if (error) setMessage(error.message);
    setLoading(false);
  }

  async function signOut() {
    setMessage('');
    const { error } = await supabase.auth.signOut();
    if (error) setMessage(error.message);
  }

  const styles = {
    page: {
      minHeight: '100vh',
      display: 'grid',
      placeItems: 'center',
      background: '#f0f5ff',
      fontFamily: 'Arial, sans-serif',
      padding: '20px'
    },
    card: {
      background: 'white',
      padding: '32px',
      borderRadius: '18px',
      width: '100%',
      maxWidth: '400px',
      boxSizing: 'border-box',
      boxShadow: '0 8px 30px rgba(0,0,0,0.08)'
    },
    input: {
      width: '100%',
      padding: '12px',
      marginBottom: '14px',
      border: '1px solid #ccc',
      borderRadius: '8px',
      boxSizing: 'border-box'
    },
    button: {
      width: '100%',
      padding: '13px',
      border: 'none',
      borderRadius: '8px',
      background: '#2563eb',
      color: 'white',
      cursor: 'pointer',
      fontSize: '16px'
    }
  };

  return (
    <main style={styles.page}>
      <section style={styles.card}>
        <h1 style={{ textAlign: 'center' }}>
          🎵 Practice Pal
        </h1>
        <p style={{ textAlign: 'center', color: '#555' }}>
          Make every practice count.
        </p>

        {loading ? (
          <p>Loading...</p>
        ) : session ? (
          <>
            <h2>Welcome back!</h2>
            <p>Signed in as:</p>
            <p><strong>{session.user.email}</strong></p>
            <p>Your family dashboard is coming next.</p>
            <button style={styles.button} onClick={signOut}>
              Sign Out
            </button>
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
              onChange={e => setEmail(e.target.value)}
            />

            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              required
              autoComplete="current-password"
              style={styles.input}
              value={password}
              onChange={e => setPassword(e.target.value)}
            />

            <button style={styles.button} type="submit">
              Sign In
            </button>
          </form>
        )}

        {message && (
          <p role="alert" style={{ color: '#b91c1c' }}>
            {message}
          </p>
        )}
      </section>
    </main>
  );
}
