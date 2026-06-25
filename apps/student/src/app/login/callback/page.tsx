'use client';

import { useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

function CallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const token = searchParams.get('token');
    if (token) {
      router.replace(`/login?token=${token}`);
    } else {
      router.replace('/login');
    }
  }, [router, searchParams]);

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      height: '100vh',
      color: 'var(--text-muted)'
    }}>
      Verifying login token...
    </div>
  );
}

export default function LoginCallbackPage() {
  return (
    <Suspense fallback={<div>Loading token validation...</div>}>
      <CallbackContent />
    </Suspense>
  );
}
