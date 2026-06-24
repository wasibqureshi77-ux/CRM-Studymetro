'use client';

import React, { useState } from 'react';
import { useAuth } from '../../context/auth-context';
import { api } from '../../lib/api';

export default function LoginPage() {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      // Call NestJS Login API, passing the default tenant ID 'studymetro-global'
      const res = await api.post(
        '/api/v1/auth/login',
        { email, password },
        { tenantId: 'studymetro-global' }
      );

      if (res && res.accessToken) {
        login(res.accessToken, res.user, 'studymetro-global');
      } else {
        setError('Login failed: Token not returned');
      }
    } catch (err: any) {
      setError(err.message || 'Incorrect credentials.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <div className="login-header">
          <h2>Study Metro CRM</h2>
          <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
            Enter email and password to sign in
          </p>
        </div>

        {error && (
          <div
            style={{
              backgroundColor: '#fee2e2',
              color: '#991b1b',
              padding: '8px 12px',
              fontSize: '11px',
              borderRadius: '4px',
              marginBottom: '16px',
              border: '1px solid #fca5a5',
            }}
          >
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div className="form-group">
            <label htmlFor="email">Email Address</label>
            <input
              id="email"
              type="email"
              className="form-control"
              placeholder="name@studymetrojaipur.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={submitting}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              className="form-control"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={submitting}
              required
            />
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            style={{ marginTop: '8px', padding: '8px' }}
            disabled={submitting}
          >
            {submitting ? 'Authenticating...' : 'Sign In'}
          </button>
        </form>

        <div style={{ marginTop: '20px', textAlign: 'center', fontSize: '11px', color: 'var(--text-muted)' }}>
          System restricted to authorized personnel only. Row-level logical audits enabled.
        </div>
      </div>
    </div>
  );
}

