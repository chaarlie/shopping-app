'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { adminSchema, signInSchema } from '@shop/contracts';
import { errorMessage, request } from '@/lib/api';
export default function LoginForm() {
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  return (
    <form
      className="panel stack login-form"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError('');
        try {
          const form = new FormData(e.currentTarget);
          const input = signInSchema.parse({
            email: form.get('email'),
            password: form.get('password'),
          });
          await request('/admin/sign-in', adminSchema, {
            method: 'POST',
            body: JSON.stringify(input),
          });
          router.push('/admin/products');
          router.refresh();
        } catch (cause) {
          setError(errorMessage(cause));
        } finally {
          setBusy(false);
        }
      }}
    >
      <h1>Welcome back.</h1>
      <p>Sign in to manage the Stockroom catalog.</p>
      <label>
        Email
        <input
          type="email"
          name="email"
          autoComplete="username"
          required
          maxLength={254}
        />
      </label>
      <label>
        Password
        <input
          type="password"
          name="password"
          autoComplete="current-password"
          required
          maxLength={256}
        />
      </label>
      {error && <p role="alert">{error}</p>}
      <button className="btn-black" disabled={busy}>
        {busy ? 'Signing in…' : 'Sign in'}
      </button>
    </form>
  );
}
