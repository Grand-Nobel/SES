// src/app/(public)/login/page.tsx
"use client"; // Login pages typically involve client-side interactions

import React, { useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';

const LoginPage = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      console.log('Attempting sign-in with NextAuth credentials...');
      const result = await signIn('credentials', {
        redirect: false, // Do not redirect, handle response manually
        email,
        password,
      });

      if (result?.error) {
        console.error('NextAuth signIn error:', result.error);
        throw new Error(result.error);
      }

      console.log('NextAuth signIn successful, checking auth state...');
      router.push('/dashboard');
    } catch (err: any) {
      console.error('Login process failed:', err); // More detailed error log
      setError(err.message || 'An unexpected error occurred during login. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: '400px', margin: '50px auto', padding: '20px', border: '1px solid #ccc', borderRadius: '8px' }}>
      <h2>Login</h2>
      <form onSubmit={handleLogin}>
        <div>
          <label htmlFor="email">Email:</label>
          <input
            type="email"
            id="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            style={{ width: '100%', padding: '8px', marginBottom: '10px' }}
          />
        </div>
        <div>
          <label htmlFor="password">Password:</label>
          <input
            type="password"
            id="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            style={{ width: '100%', padding: '8px', marginBottom: '20px' }}
          />
        </div>
        {error && <p style={{ color: 'red' }}>{error}</p>}
        <button type="submit" disabled={loading} style={{ padding: '10px 15px' }}>
          {loading ? 'Logging in...' : 'Login'}
        </button>
      </form>
      <p style={{marginTop: "20px"}}>
        Note: For local development, ensure your NextAuth.js credentials provider is correctly configured and users exist in your database.
      </p>
    </div>
  );
};

export default LoginPage;
