'use client';

import React, { useState, useEffect } from 'react';
import { api } from '../../../lib/api';

export default function CommunicationSettingsPage() {
  const [host, setHost] = useState('');
  const [port, setPort] = useState(587);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [senderEmail, setSenderEmail] = useState('');
  const [senderName, setSenderName] = useState('');
  const [encryption, setEncryption] = useState('TLS');
  const [enabled, setEnabled] = useState(true);
  
  const [emailEnabled, setEmailEnabled] = useState(true);
  const [whatsappEnabled, setWhatsappEnabled] = useState(false);

  // Student Portal switches
  const [studentPortalLoginEnabled, setStudentPortalLoginEnabled] = useState(true);
  const [studentMagicLinkEnabled, setStudentMagicLinkEnabled] = useState(true);
  const [studentEmailOtpEnabled, setStudentEmailOtpEnabled] = useState(true);
  const [studentSmsOtpEnabled, setStudentSmsOtpEnabled] = useState(false);
  const [studentWhatsappOtpEnabled, setStudentWhatsappOtpEnabled] = useState(false);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [sendingTest, setSendingTest] = useState(false);
  const [showTestEmailModal, setShowTestEmailModal] = useState(false);
  const [testRecipient, setTestRecipient] = useState('');

  const [toasts, setToasts] = useState<{ id: string; type: 'success' | 'error'; message: string }[]>([]);

  const addToast = (type: 'success' | 'error', message: string) => {
    const id = Math.random().toString(36).substr(2, 9);
    setToasts((prev) => [...prev, { id, type, message }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  };

  const fetchSettings = async () => {
    try {
      setLoading(true);
      const res = await api.get('/api/v1/communication/settings');
      if (res) {
        setHost(res.host || '');
        setPort(res.port || 587);
        setUsername(res.username || '');
        setPassword(res.password || '********'); // masked password from API response
        setSenderEmail(res.senderEmail || '');
        setSenderName(res.senderName || '');
        setEncryption(res.encryption || 'TLS');
        setEnabled(res.enabled !== undefined ? res.enabled : true);
        setEmailEnabled(res.emailEnabled !== undefined ? res.emailEnabled : true);
        setWhatsappEnabled(res.whatsappEnabled !== undefined ? res.whatsappEnabled : false);
        setStudentPortalLoginEnabled(res.studentPortalLoginEnabled !== undefined ? res.studentPortalLoginEnabled : true);
        setStudentMagicLinkEnabled(res.studentMagicLinkEnabled !== undefined ? res.studentMagicLinkEnabled : true);
        setStudentEmailOtpEnabled(res.studentEmailOtpEnabled !== undefined ? res.studentEmailOtpEnabled : true);
        setStudentSmsOtpEnabled(res.studentSmsOtpEnabled !== undefined ? res.studentSmsOtpEnabled : false);
        setStudentWhatsappOtpEnabled(res.studentWhatsappOtpEnabled !== undefined ? res.studentWhatsappOtpEnabled : false);
      }
    } catch (err: any) {
      console.error('Failed to load settings', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post('/api/v1/communication/settings', {
        host,
        port: Number(port),
        username,
        password,
        senderEmail,
        senderName,
        encryption,
        enabled,
        emailEnabled,
        whatsappEnabled,
        studentPortalLoginEnabled,
        studentMagicLinkEnabled,
        studentEmailOtpEnabled,
        studentSmsOtpEnabled,
        studentWhatsappOtpEnabled,
      });
      addToast('success', 'SMTP & Channel Configuration saved successfully!');
      fetchSettings();
    } catch (err: any) {
      addToast('error', err.message || 'Failed to save configuration');
    } finally {
      setSaving(false);
    }
  };

  const handleTestConnection = async () => {
    setTesting(true);
    try {
      await api.post('/api/v1/communication/settings/test-connection', {
        host,
        port: Number(port),
        username,
        password,
        encryption
      });
      addToast('success', 'SMTP Connection verified successfully!');
    } catch (err: any) {
      addToast('error', err.message || 'SMTP Connection failed');
    } finally {
      setTesting(false);
    }
  };

  const handleSendTestEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!testRecipient.trim()) {
      alert('Please enter a recipient email address');
      return;
    }
    setSendingTest(true);
    try {
      await api.post('/api/v1/communication/settings/test-email', {
        host,
        port: Number(port),
        username,
        password,
        encryption,
        senderEmail,
        senderName,
        testRecipient
      });
      addToast('success', `Test email dispatched to ${testRecipient}`);
      setShowTestEmailModal(false);
      setTestRecipient('');
    } catch (err: any) {
      addToast('error', err.message || 'Failed to send test email');
    } finally {
      setSendingTest(false);
    }
  };

  if (loading) {
    return (
      <div style={{ padding: '24px', fontWeight: 600 }}>
        Loading SMTP Configuration settings...
      </div>
    );
  }

  return (
    <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '24px', maxWidth: '750px' }}>
      <div>
        <h1 style={{ fontSize: '20px', fontWeight: 700, margin: 0 }}>Communication Hub Settings</h1>
        <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: '4px 0 0 0' }}>
          Configure connection credentials and controls for your communication channels.
        </p>
      </div>

      {/* Communication Channel Status Widgets */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
        <div style={{
          backgroundColor: '#fff',
          border: '1px solid var(--border-color)',
          borderRadius: '6px',
          padding: '16px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>Email Status</div>
            <div style={{ fontSize: '18px', fontWeight: 700, marginTop: '4px', color: emailEnabled ? '#10b981' : '#ef4444' }}>
              {emailEnabled ? 'Enabled' : 'Disabled'}
            </div>
          </div>
          <span style={{ fontSize: '24px' }}>✉️</span>
        </div>

        <div style={{
          backgroundColor: '#fff',
          border: '1px solid var(--border-color)',
          borderRadius: '6px',
          padding: '16px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>WhatsApp Status</div>
            <div style={{ fontSize: '18px', fontWeight: 700, marginTop: '4px', color: whatsappEnabled ? '#10b981' : '#ef4444' }}>
              {whatsappEnabled ? 'Enabled' : 'Disabled'}
            </div>
          </div>
          <span style={{ fontSize: '24px' }}>💬</span>
        </div>
      </div>

      <div style={{ backgroundColor: '#fff', border: '1px solid var(--border-color)', borderRadius: '6px', padding: '24px' }}>
        <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '16px' }}>
            <div className="form-group" style={{ margin: 0 }}>
              <label>SMTP Host Server Address</label>
              <input
                type="text"
                className="form-control"
                placeholder="e.g. smtp.hostinger.com"
                value={host}
                onChange={(e) => setHost(e.target.value)}
                required
              />
            </div>

            <div className="form-group" style={{ margin: 0 }}>
              <label>SMTP Port</label>
              <input
                type="number"
                className="form-control"
                placeholder="e.g. 587"
                value={port}
                onChange={(e) => setPort(Number(e.target.value))}
                required
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div className="form-group" style={{ margin: 0 }}>
              <label>SMTP Username / Login Account</label>
              <input
                type="email"
                className="form-control"
                placeholder="e.g. info@studymetrojaipur.com"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
              />
            </div>

            <div className="form-group" style={{ margin: 0 }}>
              <label>SMTP Password</label>
              <input
                type="password"
                className="form-control"
                placeholder="Enter password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div className="form-group" style={{ margin: 0 }}>
              <label>Sender Email (From Email)</label>
              <input
                type="email"
                className="form-control"
                placeholder="e.g. info@studymetrojaipur.com"
                value={senderEmail}
                onChange={(e) => setSenderEmail(e.target.value)}
                required
              />
            </div>

            <div className="form-group" style={{ margin: 0 }}>
              <label>Sender Name (Display Name)</label>
              <input
                type="text"
                className="form-control"
                placeholder="e.g. Study Metro Admissions"
                value={senderName}
                onChange={(e) => setSenderName(e.target.value)}
                required
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div className="form-group" style={{ margin: 0 }}>
              <label>Encryption Connection Protocol</label>
              <select
                className="form-control"
                value={encryption}
                onChange={(e) => setEncryption(e.target.value)}
              >
                <option value="TLS">STARTTLS (Port 587)</option>
                <option value="SSL">SSL / SMTPS (Port 465)</option>
                <option value="NONE">Unencrypted (Port 25)</option>
              </select>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', height: '100%', paddingTop: '18px' }}>
              <input
                type="checkbox"
                id="smtpEnabledCheckbox"
                checked={enabled}
                onChange={(e) => setEnabled(e.target.checked)}
              />
              <label htmlFor="smtpEnabledCheckbox" style={{ fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>
                Enable SMTP Outgoing Email delivery
              </label>
            </div>
          </div>

          {/* Channel Toggle Switches */}
          <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '16px', marginTop: '8px' }}>
            <h3 style={{ fontSize: '14px', fontWeight: 700, margin: '0 0 12px 0' }}>Channel Enable/Disable Controls</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <input
                    type="checkbox"
                    id="emailEnabledCheckbox"
                    checked={emailEnabled}
                    onChange={(e) => setEmailEnabled(e.target.checked)}
                  />
                  <label htmlFor="emailEnabledCheckbox" style={{ fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>
                    Email Communications
                  </label>
                </div>
                <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '0 0 0 22px' }}>
                  When disabled, no email communications should be queued or sent.
                </p>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <input
                    type="checkbox"
                    id="whatsappEnabledCheckbox"
                    checked={whatsappEnabled}
                    onChange={(e) => setWhatsappEnabled(e.target.checked)}
                  />
                  <label htmlFor="whatsappEnabledCheckbox" style={{ fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>
                    WhatsApp Communications
                  </label>
                </div>
                <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '0 0 0 22px' }}>
                  When disabled, WhatsApp communications should not enter the communication queue.
                </p>
              </div>
            </div>
          </div>

          {/* Student Portal Settings */}
          <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '16px', marginTop: '8px' }}>
            <h3 style={{ fontSize: '14px', fontWeight: 700, margin: '0 0 12px 0' }}>Student Portal Identity Management</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <input
                  type="checkbox"
                  id="studentPortalLoginEnabledCheckbox"
                  checked={studentPortalLoginEnabled}
                  onChange={(e) => setStudentPortalLoginEnabled(e.target.checked)}
                />
                <label htmlFor="studentPortalLoginEnabledCheckbox" style={{ fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>
                  Enable Student Portal Login
                </label>
              </div>

              {studentPortalLoginEnabled && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginLeft: '22px', borderLeft: '2px solid var(--border-color)', paddingLeft: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <input
                      type="checkbox"
                      id="studentMagicLinkEnabledCheckbox"
                      checked={studentMagicLinkEnabled}
                      onChange={(e) => setStudentMagicLinkEnabled(e.target.checked)}
                    />
                    <label htmlFor="studentMagicLinkEnabledCheckbox" style={{ fontSize: '12px', fontWeight: 500, cursor: 'pointer' }}>
                      Enable Magic Link (15m expiry)
                    </label>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <input
                      type="checkbox"
                      id="studentEmailOtpEnabledCheckbox"
                      checked={studentEmailOtpEnabled}
                      onChange={(e) => setStudentEmailOtpEnabled(e.target.checked)}
                    />
                    <label htmlFor="studentEmailOtpEnabledCheckbox" style={{ fontSize: '12px', fontWeight: 500, cursor: 'pointer' }}>
                      Enable Email OTP (6-digit, 5m expiry)
                    </label>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <input
                      type="checkbox"
                      id="studentSmsOtpEnabledCheckbox"
                      checked={studentSmsOtpEnabled}
                      onChange={(e) => setStudentSmsOtpEnabled(e.target.checked)}
                    />
                    <label htmlFor="studentSmsOtpEnabledCheckbox" style={{ fontSize: '12px', fontWeight: 500, cursor: 'pointer' }}>
                      Enable SMS OTP (Architecture only)
                    </label>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <input
                      type="checkbox"
                      id="studentWhatsappOtpEnabledCheckbox"
                      checked={studentWhatsappOtpEnabled}
                      onChange={(e) => setStudentWhatsappOtpEnabled(e.target.checked)}
                    />
                    <label htmlFor="studentWhatsappOtpEnabledCheckbox" style={{ fontSize: '12px', fontWeight: 500, cursor: 'pointer' }}>
                      Enable WhatsApp OTP (Architecture only)
                    </label>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div style={{ display: 'flex', gap: '12px', marginTop: '16px', borderTop: '1px solid var(--border-color)', paddingTop: '16px' }}>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Saving...' : '💾 Save Settings'}
            </button>
            <button type="button" className="btn btn-outline" onClick={handleTestConnection} disabled={testing}>
              {testing ? 'Testing...' : '⚡ Test Connection'}
            </button>
            <button type="button" className="btn btn-outline" onClick={() => setShowTestEmailModal(true)}>
              ✉️ Send Test Email
            </button>
          </div>

        </form>
      </div>

      {/* Test Email Popup Modal */}
      {showTestEmailModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div style={{ backgroundColor: '#fff', borderRadius: '6px', width: '400px', padding: '24px', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }}>
            <h3 style={{ fontSize: '14px', fontWeight: 700, margin: '0 0 12px 0' }}>Send Test Outbound Email</h3>
            <form onSubmit={handleSendTestEmail} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div className="form-group" style={{ margin: 0 }}>
                <label>Recipient Email Address</label>
                <input
                  type="email"
                  className="form-control"
                  placeholder="e.g. developer@studymetrojaipur.com"
                  value={testRecipient}
                  onChange={(e) => setTestRecipient(e.target.value)}
                  required
                />
              </div>
              <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '8px' }}>
                <button type="button" className="btn" onClick={() => setShowTestEmailModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={sendingTest}>
                  {sendingTest ? 'Sending...' : 'Send Test'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Toast Alert panel */}
      <div style={{ position: 'fixed', bottom: '20px', right: '20px', display: 'flex', flexDirection: 'column', gap: '10px', zIndex: 9999 }}>
        {toasts.map((t) => (
          <div key={t.id} style={{
            padding: '12px 16px',
            borderRadius: '6px',
            color: '#fff',
            backgroundColor: t.type === 'success' ? '#10b981' : '#ef4444',
            boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
            fontSize: '13px',
            fontWeight: 500,
            minWidth: '250px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}>
            <span>{t.type === 'success' ? '✓' : '⚠️'} {t.message}</span>
            <button onClick={() => setToasts(prev => prev.filter(item => item.id !== t.id))} style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', fontSize: '14px', marginLeft: '10px' }}>×</button>
          </div>
        ))}
      </div>

    </div>
  );
}
