'use client';
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import { z } from 'zod';
import { adminSchema } from '@shop/contracts';
import { useResource } from '@/lib/use-resource';
import { request } from '@/lib/api';
import { Feedback } from '../feedback';
import { useState } from 'react';
export default function AdminShell({
  children,
}: {
  children: React.ReactNode;
}) {
  const path = usePathname();
  return path === '/admin/login' ? children : <AdminGate>{children}</AdminGate>;
}
function AdminGate({ children }: { children: React.ReactNode }) {
  const state = useResource('/admin/session', adminSchema);
  const router = useRouter();
  const [error, setError] = useState('');
  if (state.loading) {
    return <Feedback message="Checking your admin session…" />;
  }
  if (!state.data) {
    return (
      <div className="panel stack">
        <h1>Admin sign-in required</h1>
        <p>{state.error}</p>
        <Link className="btn-black" href="/admin/login">
          Sign in
        </Link>
      </div>
    );
  }
  return (
    <>
      <nav className="admin-nav" aria-label="Admin">
        <Link className="wordmark" href="/admin/products">
          Stockroom <span className="muted">Admin</span>
        </Link>
        <Link href="/admin/products">Products</Link>
        <Link href="/admin/imports">Import history</Link>
        <Link href="/admin/imports/new">Import CSV</Link>
        <span>{state.data.name}</span>
        <button
          className="btn-grey"
          onClick={async () => {
            try {
              await request('/admin/sign-out', z.undefined(), {
                method: 'POST',
              });
              router.push('/admin/login');
            } catch {
              setError('Could not sign out. Please try again.');
            }
          }}
        >
          Sign out
        </button>
      </nav>
      {error && <p role="alert">{error}</p>}
      {children}
    </>
  );
}
