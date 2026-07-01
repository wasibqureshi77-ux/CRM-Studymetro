'use client';

import React from 'react';
import Link from 'next/link';

export default function SmsTemplatesPage() {
  return (
    <div style={{ padding: '24px', maxWidth: '800px', margin: '0 auto', textAlign: 'center' }}>
      <div style={{ textAlign: 'left', marginBottom: '24px' }}>
        <Link href="/dashboard/communication-settings" style={{ fontSize: '13px', color: '#3b82f6', textDecoration: 'none' }}>
          ← Back to Settings
        </Link>
      </div>
      <div style={{
        padding: '60px 40px', backgroundColor: '#fff', border: '1px solid var(--border-color)',
        borderRadius: '8px', boxShadow: '0 4px 6px rgba(0,0,0,0.02)'
      }}>
        <span style={{ fontSize: '48px' }}>📱</span>
        <h1 style={{ fontSize: '24px', fontWeight: 800, marginTop: '16px', marginBottom: '8px' }}>SMS Templates (Coming Soon)</h1>
        <p style={{ fontSize: '14px', color: 'var(--text-muted)', maxWidth: '480px', margin: '0 auto 24px auto' }}>
          SMS integrations (e.g. Twilio, MSG91) are currently under development. Once released, you will be able to construct SMS templates here.
        </p>
        <Link href="/dashboard/communication-settings" style={{
          backgroundColor: '#3b82f6', color: '#fff', padding: '10px 20px', borderRadius: '6px',
          fontWeight: 600, fontSize: '13px', textDecoration: 'none', display: 'inline-block'
        }}>
          Return to Settings Hub
        </Link>
      </div>
    </div>
  );
}
