'use client';

import React, { useState, useEffect } from 'react';
import { api } from '../../../lib/api';
import io from 'socket.io-client';
import QRCode from 'qrcode';
import Link from 'next/link';

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

  // Portal branding states
  const [portalName, setPortalName] = useState('');
  const [logo, setLogo] = useState('');
  const [primaryColor, setPrimaryColor] = useState('#3b82f6');
  const [secondaryColor, setSecondaryColor] = useState('#1d4ed8');
  const [supportEmail, setSupportEmail] = useState('');
  const [supportPhone, setSupportPhone] = useState('');
  const [privacyPolicy, setPrivacyPolicy] = useState('');
  const [termsConditions, setTermsConditions] = useState('');
  const [footerText, setFooterText] = useState('');
  const [socialLinks, setSocialLinks] = useState({ facebook: '', twitter: '', instagram: '' });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [sendingTest, setSendingTest] = useState(false);
  const [showTestEmailModal, setShowTestEmailModal] = useState(false);
  const [testRecipient, setTestRecipient] = useState('');
  const [missingAutomations, setMissingAutomations] = useState(false);



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

      // Fetch branding portal settings
      const pSetting = await api.get('/api/v1/communication/settings/portal');
      if (pSetting) {
        setPortalName(pSetting.portalName || '');
        setLogo(pSetting.logo || '');
        setPrimaryColor(pSetting.primaryColor || '#3b82f6');
        setSecondaryColor(pSetting.secondaryColor || '#1d4ed8');
        setSupportEmail(pSetting.supportEmail || '');
        setSupportPhone(pSetting.supportPhone || '');
        setPrivacyPolicy(pSetting.privacyPolicy || '');
        setTermsConditions(pSetting.termsConditions || '');
        setFooterText(pSetting.footerText || '');
        setSocialLinks(pSetting.socialLinks || { facebook: '', twitter: '', instagram: '' });
      }

      // Fetch templates to check if default templates exist and are active
      try {
        const templates = await api.get('/api/v1/communication/templates');
        if (Array.isArray(templates)) {
          const hasWelcome = templates.some(t => t.name === 'WELCOME' && t.isActive);
          const hasDocRequest = templates.some(t => t.name === 'DOCUMENT_REQUEST' && t.isActive);
          const hasFollowup = templates.some(t => t.name === 'FOLLOWUP_REMINDER' && t.isActive);
          setMissingAutomations(!hasWelcome || !hasDocRequest || !hasFollowup);
        } else {
          setMissingAutomations(true);
        }
      } catch (tErr) {
        console.error('Failed to load templates check:', tErr);
        setMissingAutomations(true);
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

      // Save portal branding settings
      await api.post('/api/v1/communication/settings/portal', {
        portalName,
        logo,
        primaryColor,
        secondaryColor,
        supportEmail,
        supportPhone,
        privacyPolicy,
        termsConditions,
        footerText,
        socialLinks,
      });

      addToast('success', 'Configuration and Portal branding saved successfully!');
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
    <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '24px', maxWidth: '850px' }}>
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

      {/* Enterprise Communication Management Cards */}
      <div>
        <h2 style={{ fontSize: '11px', fontWeight: 700, margin: '0 0 12px 0', textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.05em' }}>
          Enterprise Communication Module
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
          <Link href="/dashboard/communication-settings/email-templates" style={{ textDecoration: 'none', color: 'inherit' }}>
            <div style={{
              backgroundColor: '#fff', border: '1px solid var(--border-color)', borderRadius: '6px', padding: '16px',
              cursor: 'pointer', transition: 'all 0.2s', display: 'flex', flexDirection: 'column', gap: '4px'
            }} onMouseEnter={(e) => e.currentTarget.style.borderColor = '#3b82f6'} onMouseLeave={(e) => e.currentTarget.style.borderColor = 'var(--border-color)'}>
              <span style={{ fontSize: '20px' }}>✉️</span>
              <div style={{ fontWeight: 700, fontSize: '13px' }}>Email Templates</div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Manage layout and versions.</div>
            </div>
          </Link>
          <Link href="/dashboard/communication-settings/whatsapp-templates" style={{ textDecoration: 'none', color: 'inherit' }}>
            <div style={{
              backgroundColor: '#fff', border: '1px solid var(--border-color)', borderRadius: '6px', padding: '16px',
              cursor: 'pointer', transition: 'all 0.2s', display: 'flex', flexDirection: 'column', gap: '4px'
            }} onMouseEnter={(e) => e.currentTarget.style.borderColor = '#25d366'} onMouseLeave={(e) => e.currentTarget.style.borderColor = 'var(--border-color)'}>
              <span style={{ fontSize: '20px' }}>💬</span>
              <div style={{ fontWeight: 700, fontSize: '13px' }}>WhatsApp Templates</div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Configure chat notifications.</div>
            </div>
          </Link>
          <Link href="/dashboard/communication-settings/sms-templates" style={{ textDecoration: 'none', color: 'inherit' }}>
            <div style={{
              backgroundColor: '#fff', border: '1px solid var(--border-color)', borderRadius: '6px', padding: '16px',
              cursor: 'pointer', transition: 'all 0.2s', display: 'flex', flexDirection: 'column', gap: '4px'
            }} onMouseEnter={(e) => e.currentTarget.style.borderColor = '#d97706'} onMouseLeave={(e) => e.currentTarget.style.borderColor = 'var(--border-color)'}>
              <span style={{ fontSize: '20px' }}>📱</span>
              <div style={{ fontWeight: 700, fontSize: '13px' }}>SMS Templates</div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Integrations and stub settings.</div>
            </div>
          </Link>
          <Link href="/dashboard/communication-settings/automation-rules" style={{ textDecoration: 'none', color: 'inherit', gridColumn: 'span 2' }}>
            <div style={{
              backgroundColor: '#fff', border: '1px solid var(--border-color)', borderRadius: '6px', padding: '16px',
              cursor: 'pointer', transition: 'all 0.2s', display: 'flex', flexDirection: 'column', gap: '4px'
            }} onMouseEnter={(e) => e.currentTarget.style.borderColor = '#7c3aed'} onMouseLeave={(e) => e.currentTarget.style.borderColor = 'var(--border-color)'}>
              <span style={{ fontSize: '20px' }}>⚙️</span>
              <div style={{ fontWeight: 700, fontSize: '13px' }}>Automation Rules</div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Map system hook triggers to template dispatches.</div>
            </div>
          </Link>
          <Link href="/dashboard/communication-settings/communication-logs" style={{ textDecoration: 'none', color: 'inherit' }}>
            <div style={{
              backgroundColor: '#fff', border: '1px solid var(--border-color)', borderRadius: '6px', padding: '16px',
              cursor: 'pointer', transition: 'all 0.2s', display: 'flex', flexDirection: 'column', gap: '4px'
            }} onMouseEnter={(e) => e.currentTarget.style.borderColor = '#06b6d4'} onMouseLeave={(e) => e.currentTarget.style.borderColor = 'var(--border-color)'}>
              <span style={{ fontSize: '20px' }}>📊</span>
              <div style={{ fontWeight: 700, fontSize: '13px' }}>Communication Logs</div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>View sent history and errors.</div>
            </div>
          </Link>
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

          {/* Dedicated WhatsApp Integration Section */}
          <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '16px', marginTop: '16px' }}>
            <h3 style={{ fontSize: '14px', fontWeight: 700, margin: '0 0 4px 0' }}>💬 WhatsApp Gateway Integration</h3>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '16px' }}>
              Connect self-hosted instances on your VPS using Baileys. Scan QR code to authenticate.
            </p>
            <WhatsappIntegrationSection addToast={addToast} missingAutomations={missingAutomations} />
          </div>

          {/* Student Portal Settings */}
          <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '16px', marginTop: '16px' }}>
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

          {/* Student Portal Branding Settings */}
          <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '16px', marginTop: '16px' }}>
            <h3 style={{ fontSize: '14px', fontWeight: 700, margin: '0 0 12px 0' }}>Student Portal Branding & Customization</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div className="form-group">
                <label>Portal Display Name</label>
                <input type="text" className="form-control" value={portalName} onChange={(e) => setPortalName(e.target.value)} />
              </div>
              <div className="form-group">
                <label>Logo Image URL</label>
                <input type="text" className="form-control" value={logo} onChange={(e) => setLogo(e.target.value)} placeholder="https://example.com/logo.png" />
              </div>
              <div className="form-group">
                <label>Primary Brand Color</label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input type="color" className="form-control" style={{ width: '45px', padding: 0 }} value={primaryColor} onChange={(e) => setPrimaryColor(e.target.value)} />
                  <input type="text" className="form-control" style={{ flex: 1 }} value={primaryColor} onChange={(e) => setPrimaryColor(e.target.value)} />
                </div>
              </div>
              <div className="form-group">
                <label>Secondary Accent Color</label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input type="color" className="form-control" style={{ width: '45px', padding: 0 }} value={secondaryColor} onChange={(e) => setSecondaryColor(e.target.value)} />
                  <input type="text" className="form-control" style={{ flex: 1 }} value={secondaryColor} onChange={(e) => setSecondaryColor(e.target.value)} />
                </div>
              </div>
              <div className="form-group">
                <label>Support Contact Email</label>
                <input type="email" className="form-control" value={supportEmail} onChange={(e) => setSupportEmail(e.target.value)} />
              </div>
              <div className="form-group">
                <label>Support Phone Number</label>
                <input type="text" className="form-control" value={supportPhone} onChange={(e) => setSupportPhone(e.target.value)} />
              </div>
              <div className="form-group" style={{ gridColumn: 'span 2' }}>
                <label>Footer Copyright / Text</label>
                <input type="text" className="form-control" value={footerText} onChange={(e) => setFooterText(e.target.value)} />
              </div>
              <div className="form-group">
                <label>Facebook URL</label>
                <input type="text" className="form-control" value={socialLinks.facebook || ''} onChange={(e) => setSocialLinks(prev => ({ ...prev, facebook: e.target.value }))} />
              </div>
              <div className="form-group">
                <label>Instagram URL</label>
                <input type="text" className="form-control" value={socialLinks.instagram || ''} onChange={(e) => setSocialLinks(prev => ({ ...prev, instagram: e.target.value }))} />
              </div>
              <div className="form-group" style={{ gridColumn: 'span 2' }}>
                <label>Privacy Policy Content</label>
                <textarea className="form-control" rows={3} value={privacyPolicy} onChange={(e) => setPrivacyPolicy(e.target.value)} />
              </div>
              <div className="form-group" style={{ gridColumn: 'span 2' }}>
                <label>Terms & Conditions Content</label>
                <textarea className="form-control" rows={3} value={termsConditions} onChange={(e) => setTermsConditions(e.target.value)} />
              </div>
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

function WhatsappIntegrationSection({ addToast, missingAutomations }: { addToast: (type: 'success' | 'error', message: string) => void; missingAutomations: boolean }) {
  const [instances, setInstances] = useState<any[]>([]);
  const [newInstanceName, setNewInstanceName] = useState('');
  const [loading, setLoading] = useState(true);
  const [qrCodeMap, setQrCodeMap] = useState<Record<string, string>>({});

  useEffect(() => {
    fetchInstances();

    const socket = io('/whatsapp', {
      transports: ['websocket'],
      query: { tenantId: 'studymetro-global' },
    });

    socket.on('whatsapp_status', (data: { instanceId: string; status: string; qr?: string; phoneNumber?: string; displayName?: string }) => {
      setInstances((prev) =>
        prev.map((inst) => {
          if (inst.id === data.instanceId) {
            return {
              ...inst,
              status: data.status,
              phoneNumber: data.phoneNumber !== undefined ? data.phoneNumber : inst.phoneNumber,
              displayName: data.displayName !== undefined ? data.displayName : inst.displayName,
            };
          }
          return inst;
        })
      );

      if (data.qr) {
        setQrCodeMap((prev) => ({ ...prev, [data.instanceId]: data.qr! }));
      } else if (data.status === 'CONNECTED' || data.status === 'DISCONNECTED') {
        setQrCodeMap((prev) => {
          const next = { ...prev };
          delete next[data.instanceId];
          return next;
        });
      }
    });

    // Auto refresh every 5 seconds until connection becomes open
    const pollInterval = setInterval(() => {
      console.log("Polling instance statuses...");
      fetchInstancesSilently();
    }, 5000);

    return () => {
      socket.disconnect();
      clearInterval(pollInterval);
    };
  }, []);

  const fetchInstancesSilently = async () => {
    try {
      const res = await api.get('/api/v1/whatsapp/instances');
      setInstances(res || []);
    } catch (err) {
      console.error("Status polling failed", err);
    }
  };

  const fetchInstances = async () => {
    try {
      setLoading(true);
      const res = await api.get('/api/v1/whatsapp/instances');
      setInstances(res || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateInstance = async (e: React.FormEvent) => {
    e.preventDefault();
    e.stopPropagation();
    console.log('Connect Button Clicked. Name:', newInstanceName);
    console.log('Sending request to POST /api/v1/whatsapp/connect...');
    
    try {
      const res = await api.post('/api/v1/whatsapp/connect', { instanceName: newInstanceName });
      console.log('Response received from connect API. Result:', res);
      console.log('Instance ID:', res?.id);
      
      setInstances((prev) => [...prev, res]);
      setNewInstanceName('');
      addToast('success', 'Instance registered. Connection initializing...');
      
      // Start polling status immediately or socket connection is handling it
      fetchInstances();
    } catch (err: any) {
      console.error('Error connecting WhatsApp instance:', err);
      addToast('error', err.message || 'Failed to register instance');
    }
  };

  const handleLogout = async (id: string) => {
    try {
      console.log('Logging out instance ID:', id);
      await api.post(`/api/v1/whatsapp/logout/${id}`);
      addToast('success', 'Instance disconnected and session deleted.');
      fetchInstances();
    } catch (err: any) {
      console.error('Logout error:', err);
      addToast('error', err.message || 'Logout failed');
    }
  };

  const handleReconnect = async (id: string, name: string) => {
    try {
      console.log('Reconnecting instance ID:', id, 'Name:', name);
      await api.post('/api/v1/whatsapp/connect', { instanceName: name });
      addToast('success', 'Reconnection initialized.');
    } catch (err: any) {
      console.error('Reconnect error:', err);
      addToast('error', err.message || 'Reconnection failed');
    }
  };

  const handleSeedDefaults = async () => {
    try {
      console.log('Requesting default template seed...');
      await api.post('/api/v1/whatsapp/seed-defaults');
      addToast('success', 'Default templates & automations seeded successfully!');
    } catch (err: any) {
      console.error('Seed error:', err);
      addToast('error', err.message || 'Failed to seed templates');
    }
  };

  if (loading) return <div style={{ fontSize: '12px' }}>Loading WhatsApp instances...</div>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Missing Automations warning and seed buttons */}
      {missingAutomations && (
        <div style={{ padding: '12px', background: '#fffbeb', border: '1px solid #fef3c7', borderRadius: '6px', fontSize: '12px', color: '#b45309' }}>
          <strong>⚠️ Missing Automations Warning:</strong> If default templates or triggers (LEAD_CREATED, DOCUMENT_PENDING, FOLLOWUP_REMINDER) are missing, automations will fail.
          <div style={{ marginTop: '8px' }}>
            <button type="button" className="btn btn-xs" style={{ backgroundColor: '#d97706', color: '#fff' }} onClick={handleSeedDefaults}>
              ⚡ Create Default Templates & Automations
            </button>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', gap: '8px' }}>
        <input
          type="text"
          className="form-control"
          placeholder="Friendly instance name (e.g. Dubai Support)"
          value={newInstanceName}
          onChange={(e) => setNewInstanceName(e.target.value)}
        />
        <button
          type="button"
          onClick={(e) => handleCreateInstance(e as any)}
          className="btn btn-primary"
          style={{ whiteSpace: 'nowrap' }}
        >
          Connect
        </button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {instances.map((inst) => {
          const isConnected = inst.status === 'CONNECTED';
          return (
            <div key={inst.id} style={{ padding: '16px', border: '1px solid var(--border-color)', borderRadius: '8px', background: '#f8fafc', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                  <div style={{
                    width: '40px',
                    height: '40px',
                    borderRadius: '50%',
                    background: '#e2e8f0',
                    backgroundImage: inst.profilePicture ? `url(${inst.profilePicture})` : 'none',
                    backgroundSize: 'cover',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '18px'
                  }}>
                    {!inst.profilePicture && '📱'}
                  </div>
                  <div>
                    <strong style={{ fontSize: '14px' }}>{inst.instanceName}</strong>
                    <div style={{ fontSize: '12px', color: isConnected ? '#10b981' : '#64748b', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px' }}>
                      <span>{isConnected ? '🟢 Connected' : `⚪ ${inst.status}`}</span>
                      {inst.displayName && <span>• {inst.displayName}</span>}
                    </div>
                  </div>
                </div>
                
                <div style={{ display: 'flex', gap: '6px' }}>
                  {!isConnected && (
                    <button type="button" className="btn btn-xs" onClick={async () => {
                      console.log("Requesting QR code fallback for instance ID:", inst.id);
                      try {
                        const res = await api.get(`/api/v1/whatsapp/qr/${inst.id}`);
                        console.log("QR received via fallback API:", res);
                        if (res?.qr) {
                          setQrCodeMap(prev => ({ ...prev, [inst.id]: res.qr }));
                        } else {
                          addToast('error', 'No QR generated yet. Try again in a moment.');
                        }
                      } catch (err: any) {
                        addToast('error', err.message || 'Failed to fetch QR');
                      }
                    }}>
                      📸 Generate / Scan QR
                    </button>
                  )}
                  <button type="button" className="btn btn-xs" onClick={() => handleReconnect(inst.id, inst.instanceName)}>
                    Reconnect
                  </button>
                  <button type="button" className="btn btn-xs btn-danger" onClick={() => handleLogout(inst.id)}>
                    Logout / Delete
                  </button>
                </div>
              </div>

              {/* Show details for connected device */}
              {isConnected && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', background: '#fff', padding: '12px', borderRadius: '6px', border: '1px solid #e2e8f0', fontSize: '12px' }}>
                  <div><strong>Phone Number:</strong> {inst.phoneNumber ? `+${inst.phoneNumber}` : 'Unassigned'}</div>
                  <div><strong>Display Name:</strong> {inst.displayName || 'Support Bot'}</div>
                  <div><strong>Connection Time:</strong> {inst.connectedAt ? new Date(inst.connectedAt).toLocaleString() : 'Just Now'}</div>
                  <div><strong>Last Sync:</strong> {inst.updatedAt ? new Date(inst.updatedAt).toLocaleString() : 'Never'}</div>
                </div>
              )}

              {/* Hide QR component automatically if active connection becomes connected */}
              {!isConnected && qrCodeMap[inst.id] && (
                <div style={{ marginTop: '10px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                  <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)' }}>Scan device linkage QR code:</div>
                  <div style={{ padding: '12px', background: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px', display: 'flex', justifyContent: 'center' }}>
                    <QRCodeRenderer text={qrCodeMap[inst.id]} />
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function QRCodeRenderer({ text }: { text: string }) {
  const [imgUrl, setImgUrl] = useState<string>('');

  useEffect(() => {
    if (!text) return;
    QRCode.toDataURL(text, { width: 260, margin: 2 }, (err, url) => {
      if (err) {
        console.error("Failed to generate QR data URL:", err);
        return;
      }
      setImgUrl(url);
    });
  }, [text]);

  const handleDownload = () => {
    if (!imgUrl) return;
    const link = document.createElement('a');
    link.href = imgUrl;
    link.download = 'whatsapp-connect-qr.png';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (!imgUrl) {
    return <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Generating QR Canvas...</span>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', padding: '16px', background: '#fff', borderRadius: '8px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }}>
      <img
        src={imgUrl}
        alt="WhatsApp Scan QR"
        style={{ width: '260px', height: '260px', display: 'block' }}
      />
      <button
        type="button"
        className="btn btn-xs btn-outline"
        onClick={handleDownload}
        style={{ width: '100%' }}
      >
        📥 Download QR
      </button>
    </div>
  );
}


