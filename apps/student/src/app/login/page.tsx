'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

import { api } from '../../lib/api';

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  
  const [email, setEmail] = useState('');
  const [step, setStep] = useState(1); // 1: Email, 2: Method Select, 3: OTP Verification, 4: Magic link sent
  const [availableMethods, setAvailableMethods] = useState<string[]>([]);
  const [selectedMethod, setSelectedMethod] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Handle direct magic link tokens in URL
  useEffect(() => {
    const token = searchParams.get('token');
    if (token) {
      handleVerifyMagicToken(token);
    }
  }, [searchParams]);

  const handleVerifyMagicToken = async (token: string) => {
    setLoading(true);
    setError('');
    try {
      const data = await api.post('/api/v1/student-portal/auth/verify-otp', { token });
      localStorage.setItem('student_token', data.token);
      localStorage.setItem('student_user', JSON.stringify(data.student));
      router.push('/dashboard');
    } catch (err: any) {
      setError(err.message || 'Invalid or expired magic link');
      setStep(1);
    } finally {
      setLoading(false);
    }
  };

  const handleCheckEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setLoading(true);
    setError('');
    try {
      const data = await api.post('/api/v1/student-portal/auth/check-email', { email: email.trim() });
      
      if (!data.exists) {
        throw new Error('Access denied. No active student account associated with this email address.');
      }

      // Convert methods object to array of strings for UI
      const methodsArray: string[] = [];
      if (data.methods) {
        if (data.methods.magicLink) methodsArray.push('magic_link');
        if (data.methods.emailOtp) methodsArray.push('email_otp');
        if (data.methods.smsOtp) methodsArray.push('sms_otp');
        if (data.methods.whatsappOtp) methodsArray.push('whatsapp_otp');
      }

      setAvailableMethods(methodsArray);
      if (methodsArray.length > 0) {
        setSelectedMethod(methodsArray[0]);
      }
      setStep(2);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSendOtp = async () => {
    setLoading(true);
    setError('');
    try {
      await api.post('/api/v1/student-portal/auth/send-otp', { email: email.trim(), method: selectedMethod });

      if (selectedMethod === 'magic_link') {
        setStep(4);
      } else {
        setStep(3);
        setSuccessMsg(`A verification code was sent via ${selectedMethod.replace('_', ' ').toUpperCase()}`);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otpCode.trim()) return;
    setLoading(true);
    setError('');
    try {
      const data = await api.post('/api/v1/student-portal/auth/verify-otp', { email: email.trim(), code: otpCode.trim() });
      localStorage.setItem('student_token', data.token);
      localStorage.setItem('student_user', JSON.stringify(data.student));
      router.push('/dashboard');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh',
      padding: '24px',
      background: 'radial-gradient(circle at 50% 50%, #111827 0%, #030712 100%)',
    }}>
      {/* Glow Effect */}
      <div style={{
        position: 'absolute',
        width: '350px',
        height: '350px',
        borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(59, 130, 246, 0.12) 0%, transparent 70%)',
        filter: 'blur(40px)',
        zIndex: 0,
      }}></div>

      <div style={{
        width: '100%',
        maxWidth: '430px',
        backgroundColor: 'var(--bg-glass)',
        backdropFilter: 'blur(16px)',
        border: '1px solid var(--border-glass)',
        borderRadius: '16px',
        padding: '36px',
        boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.37)',
        zIndex: 1,
      }}>
        {/* Brand */}
        <div style={{ textAlign: 'center', marginBottom: '28px' }}>
          <span style={{ fontSize: '32px' }}>🎓</span>
          <h1 style={{ fontSize: '24px', color: '#fff', marginTop: '12px', letterSpacing: '-0.025em' }}>Study Metro</h1>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '4px' }}>Student Application Dashboard</p>
        </div>

        {error && (
          <div style={{
            backgroundColor: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid rgba(239, 68, 68, 0.25)',
            color: '#fca5a5',
            padding: '12px 14px',
            borderRadius: '8px',
            fontSize: '13px',
            marginBottom: '20px',
            lineHeight: '1.4',
          }}>
            ⚠️ {error}
          </div>
        )}

        {successMsg && (
          <div style={{
            backgroundColor: 'rgba(16, 185, 129, 0.1)',
            border: '1px solid rgba(16, 185, 129, 0.25)',
            color: '#a7f3d0',
            padding: '12px 14px',
            borderRadius: '8px',
            fontSize: '13px',
            marginBottom: '20px',
            lineHeight: '1.4',
          }}>
            ✓ {successMsg}
          </div>
        )}

        {/* Step 1: Input Email */}
        {step === 1 && (
          <form onSubmit={handleCheckEmail} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-main)' }}>Student Email Address</label>
              <input
                type="email"
                required
                placeholder="e.g. student@gmail.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  borderRadius: '8px',
                  border: '1px solid var(--border-glass)',
                  backgroundColor: 'rgba(255, 255, 255, 0.03)',
                  color: '#fff',
                  fontSize: '14px',
                  outline: 'none',
                  transition: 'border 0.2s',
                }}
                onFocus={(e) => e.target.style.borderColor = 'var(--primary)'}
                onBlur={(e) => e.target.style.borderColor = 'var(--border-glass)'}
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              style={{
                width: '100%',
                padding: '12px',
                borderRadius: '8px',
                border: 'none',
                backgroundColor: 'var(--primary)',
                color: '#fff',
                fontWeight: 600,
                fontSize: '14px',
                cursor: 'pointer',
                transition: 'background-color 0.2s',
              }}
            >
              {loading ? 'Validating Account...' : 'Continue'}
            </button>
          </form>
        )}

        {/* Step 2: Method Select */}
        {step === 2 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
              Choose a verification method to access your student account:
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {availableMethods.map((method) => (
                <label
                  key={method}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    padding: '14px',
                    borderRadius: '8px',
                    border: '1px solid ' + (selectedMethod === method ? 'var(--primary)' : 'var(--border-glass)'),
                    backgroundColor: selectedMethod === method ? 'rgba(59, 130, 246, 0.05)' : 'rgba(255, 255, 255, 0.02)',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                  }}
                >
                  <input
                    type="radio"
                    name="loginMethod"
                    checked={selectedMethod === method}
                    onChange={() => setSelectedMethod(method)}
                    style={{ cursor: 'pointer' }}
                  />
                  <span style={{ display: 'block' }}>
                    <span style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#fff' }}>
                      {method === 'magic_link' && '🔗 Magic Login Link'}
                      {method === 'email_otp' && '✉️ Email One-Time Password'}
                      {method === 'sms_otp' && '📱 SMS Verification Code'}
                      {method === 'whatsapp_otp' && '💬 WhatsApp Verification Code'}
                    </span>
                    <span style={{ display: 'block', fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                      {method === 'magic_link' && 'One-click sign-in sent directly to inbox'}
                      {method === 'email_otp' && '6-digit code sent to your email'}
                      {method === 'sms_otp' && 'Code sent via cellular SMS (Arch)'}
                      {method === 'whatsapp_otp' && 'Code sent via WhatsApp ping (Arch)'}
                    </span>
                  </span>
                </label>
              ))}
            </div>

            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                onClick={() => setStep(1)}
                style={{
                  flex: 1,
                  padding: '11px',
                  borderRadius: '8px',
                  border: '1px solid var(--border-glass)',
                  backgroundColor: 'transparent',
                  color: 'var(--text-main)',
                  cursor: 'pointer',
                  fontSize: '13px',
                }}
              >
                Back
              </button>
              <button
                onClick={handleSendOtp}
                disabled={loading}
                style={{
                  flex: 2,
                  padding: '11px',
                  borderRadius: '8px',
                  border: 'none',
                  backgroundColor: 'var(--primary)',
                  color: '#fff',
                  fontWeight: 600,
                  cursor: 'pointer',
                  fontSize: '13px',
                }}
              >
                {loading ? 'Sending code...' : 'Send Verification'}
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Enter OTP */}
        {step === 3 && (
          <form onSubmit={handleVerifyOtp} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '13px', fontWeight: 600, color: '#fff' }}>Enter 6-Digit Code</label>
              <input
                type="text"
                required
                maxLength={6}
                placeholder="0 0 0 0 0 0"
                value={otpCode}
                onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
                style={{
                  width: '100%',
                  padding: '12px',
                  borderRadius: '8px',
                  border: '1px solid var(--border-glass)',
                  backgroundColor: 'rgba(255, 255, 255, 0.03)',
                  color: '#fff',
                  fontSize: '18px',
                  fontWeight: '700',
                  textAlign: 'center',
                  letterSpacing: '8px',
                  outline: 'none',
                }}
              />
            </div>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                type="button"
                onClick={() => setStep(2)}
                style={{
                  flex: 1,
                  padding: '11px',
                  borderRadius: '8px',
                  border: '1px solid var(--border-glass)',
                  backgroundColor: 'transparent',
                  color: 'var(--text-main)',
                  cursor: 'pointer',
                  fontSize: '13px',
                }}
              >
                Back
              </button>
              <button
                type="submit"
                disabled={loading}
                style={{
                  flex: 2,
                  padding: '11px',
                  borderRadius: '8px',
                  border: 'none',
                  backgroundColor: 'var(--primary)',
                  color: '#fff',
                  fontWeight: 600,
                  cursor: 'pointer',
                  fontSize: '13px',
                }}
              >
                {loading ? 'Verifying...' : 'Verify & Log In'}
              </button>
            </div>
          </form>
        )}

        {/* Step 4: Magic link confirmation */}
        {step === 4 && (
          <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <span style={{ fontSize: '36px' }}>✉️</span>
            <div>
              <h2 style={{ fontSize: '18px', color: '#fff' }}>Check your email</h2>
              <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '6px', lineHeight: '1.4' }}>
                We have dispatched a magic login link to <strong>{email}</strong>. Please check your inbox and click the link to gain access.
              </p>
            </div>
            <button
              onClick={() => setStep(1)}
              style={{
                marginTop: '12px',
                padding: '11px',
                borderRadius: '8px',
                border: '1px solid var(--border-glass)',
                backgroundColor: 'transparent',
                color: 'var(--text-main)',
                cursor: 'pointer',
                fontSize: '13px',
              }}
            >
              Return to Login Screen
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div>Loading login context...</div>}>
      <LoginContent />
    </Suspense>
  );
}
