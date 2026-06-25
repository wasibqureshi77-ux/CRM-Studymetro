'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function EntryPage() {
  const router = useRouter();

  useEffect(() => {
    // If has student token in localStorage or cookie, go dashboard, else login
    const hasToken = typeof window !== 'undefined' && localStorage.getItem('student_token');
    if (hasToken) {
      router.push('/dashboard');
    } else {
      router.push('/login');
    }
  }, [router]);

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      height: '100vh',
      fontSize: '15px',
      color: 'var(--text-muted)'
    }}>
      Loading Student Portal...
    </div>
  );
}
