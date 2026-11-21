
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

  // Family dashboard state
  const [familyMembers, setFamilyMembers] = useState([]);
  const [familyLoading, setFamilyLoading] = useState(false);
  const [familyError, setFamilyError] = useState('');

  // Temporary security test state
  const [securityResults, setSecurityResults] = useState(null);

  // Load family memberships
  useEffect(() => {
    if (!supabase || !session?.user?.id) {
      setFamilyMembers([]);
      setFamilyError('');
      setFamilyLoading(false);
      return;
    }

    let cancelled = false;
    const userId = session.user.id;

    async function loadFamily() {
      setFamilyMembers([]);
      setFamilyError('');
      setFamilyLoading(true);

      const { data, error } = await supabase
        .from('family_members')
        .select('*')
        .eq('user_id', userId);

      if (cancelled) return;

      if (error) {
        setFamilyError(error.message);
      } else {
        setFamilyMembers(data ?? []);
      }

      setFamilyLoading(false);
    }

    loadFamily();

    return () => {
      cancelled = true;
    };
  }, [session?.user?.id]);

  // Temporary authenticated API security test
  useEffect(() => {
    if (!supabase || !session?.user?.id) {
      setSecurityResults(null);
      return;
    }

    let cancelled = false;
    setSecurityResults(null);

    async function testFamilySecurity() {
      const { data, error } = await supabase
        .from('families')
        .select('id');

      if (cancelled) return;

      setSecurityResults({
        count: data?.length ?? 0,
        error: error?.message ?? null
      });
    }

    testFamilySecurity();

    return () => {
      cancelled = true;
    };
  }, [session?.user?.id]);

  // Initialize Supabase authentication
  useEffect(() => {
    if (!supabase) {
      setMessage('Supabase connection is not configured.');
      setLoading(false);
      return;
    }

    supabase.auth.getSession().then(({ data, error }) => {
      if (error) {
        setMessage(error.message);
      }

      setSession(data.session);
      setLoading(false);
    });

    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange(
      (_event, newSession) => {
        setSession(newSession);
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  // Sign in
  async function signIn(event) {
    event.preventDefault();

    if (!supabase) return;

    setLoading(true);
    setMessage('');

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    if (error) {
      setMessage(error.message);
    }

    setLoading(false);
  }

  // Sign out
  async function signOut() {
    setMessage('');

    const { error } = await supabase.auth.signOut();

    if (error) {
      setMessage(error.message);
    }
  }

  // Application styles
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
            <p>
              <strong>{session.user.email}</strong>
            </p>

            {/* Family Dashboard */}
            <div
              style={{
                background: '#f0f5ff',
                padding: '16px',
                borderRadius: '12px',
                marginBottom: '20px'
              }}
            >
              <h3>🏠 Your Family Dashboard</h3>

              {familyLoading ? (
                <p>Loading family information...</p>
              ) : familyError ? (
                <p style={{ color: '#b91c1c' }}>
                  Family lookup error: {familyError}
                </p>
              ) : (
                <>
                  <p>
                    Family memberships found:{' '}
                    {familyMembers.length}
                  </p>

                  <p>
                    {familyMembers.length === 0
                      ? 'No family membership found.'
                      : 'Family membership lookup completed successfully.'}
                  </p>
                </>
              )}
            </div>

            {/* Temporary Security Test */}
            <div
              style={{
                marginTop: '20px',
                marginBottom: '20px',
                padding: '15px',
                border: '1px solid #ccc',
                borderRadius: '8px'
              }}
            >
              <h3>🔒 Security Test (Temporary)</h3>

              {securityResults === null ? (
                <p>
                  Checking authenticated family access...
                </p>
              ) : securityResults.error ? (
                <p style={{ color: '#b91c1c' }}>
                  Security test error:{' '}
                  {securityResults.error}
                </p>
              ) : (
                <p>
                  Families visible through authenticated API:{' '}
                  <strong>
                    {securityResults.count}
                  </strong>
                </p>
              )}
            </div>

            {/* Sign Out */}
            <button
              style={styles.button}
              onClick={signOut}
            >
              Sign Out
            </button>
          </>
        ) : (
          <form onSubmit={signIn}>
            <h2>Family Sign In</h2>

            <label htmlFor="email">
              Email
            </label>

            <input
              id="email"
              type="email"
              required
              autoComplete="email"
              style={styles.input}
              value={email}
              onChange={e => setEmail(e.target.value)}
            />

            <label htmlFor="password">
              Password
            </label>

            <input
              id="password"
              type="password"
              required
              autoComplete="current-password"
              style={styles.input}
              value={password}
              onChange={e => setPassword(e.target.value)}
            />

            <button
              style={styles.button}
              type="submit"
            >
              Sign In
            </button>
          </form>
        )}

        {message && (
          <p
            role="alert"
            style={{ color: '#b91c1c' }}
          >
            {message}
          </p>
        )}

      </section>
    </main>
  );
}
