'use client';

import React, { useState, useEffect } from 'react';
import { api } from '../../../../lib/api';
import Link from 'next/link';

interface EmailTemplateVersion {
  id: string;
  version: number;
  subject: string;
  body: string;
  createdAt: string;
}

interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  body: string;
  category: string;
  isActive: boolean;
  version: number;
  updatedAt: string;
  versions: EmailTemplateVersion[];
}

const CATEGORIES = ['Lead', 'Admissions', 'Visa', 'Documents', 'Payment', 'Portal', 'Marketing', 'Follow-up', 'Custom'];
const VARIABLES = ['studentName', 'leadNumber', 'country', 'course', 'intake', 'assignedCounsellor', 'brochureLink', 'portalLink', 'offerLetter', 'visaStatus', 'paymentLink', 'today'];

export default function EmailTemplatesPage() {
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [toasts, setToasts] = useState<Array<{ id: string; type: 'success' | 'error'; message: string }>>([]);

  // Editor Modal States
  const [showEditor, setShowEditor] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<EmailTemplate | null>(null);
  const [name, setName] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [category, setCategory] = useState('Custom');
  const [isActive, setIsActive] = useState(true);

  // Test Send Modal States
  const [showTestModal, setShowTestModal] = useState(false);
  const [testTemplate, setTestTemplate] = useState<EmailTemplate | null>(null);
  const [testRecipient, setTestRecipient] = useState('');
  const [sendingTest, setSendingTest] = useState(false);

  // Version History Modal
  const [showVersionModal, setShowVersionModal] = useState(false);
  const [selectedTemplateForVer, setSelectedTemplateForVer] = useState<EmailTemplate | null>(null);

  const addToast = (type: 'success' | 'error', message: string) => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, type, message }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 4000);
  };

  const fetchTemplates = async () => {
    try {
      setLoading(true);
      const res = await api.get('/api/v1/communication/templates/email');
      if (Array.isArray(res)) setTemplates(res);
    } catch (err: any) {
      addToast('error', err.message || 'Failed to load email templates');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTemplates();
  }, []);

  const handleOpenCreate = () => {
    setEditingTemplate(null);
    setName('');
    setSubject('');
    setBody('');
    setCategory('Custom');
    setIsActive(true);
    setShowEditor(true);
  };

  const handleOpenEdit = (t: EmailTemplate) => {
    setEditingTemplate(t);
    setName(t.name);
    setSubject(t.subject);
    setBody(t.body);
    setCategory(t.category);
    setIsActive(t.isActive);
    setShowEditor(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !body || !subject) {
      addToast('error', 'Please fill in all required fields');
      return;
    }

    try {
      if (editingTemplate) {
        await api.put(`/api/v1/communication/templates/email/${editingTemplate.id}`, {
          name, subject, body, category, isActive
        });
        addToast('success', 'Email template updated successfully');
      } else {
        await api.post('/api/v1/communication/templates/email', {
          name, subject, body, category, isActive
        });
        addToast('success', 'Email template created successfully');
      }
      setShowEditor(false);
      fetchTemplates();
    } catch (err: any) {
      addToast('error', err.message || 'Failed to save template');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this template?')) return;
    try {
      await api.delete(`/api/v1/communication/templates/email/${id}`);
      addToast('success', 'Template deleted successfully');
      fetchTemplates();
    } catch (err: any) {
      addToast('error', err.message || 'Failed to delete template');
    }
  };

  const handleClone = async (id: string) => {
    try {
      await api.post(`/api/v1/communication/templates/email/${id}/clone`);
      addToast('success', 'Template cloned successfully');
      fetchTemplates();
    } catch (err: any) {
      addToast('error', err.message || 'Failed to clone template');
    }
  };

  const handleToggleActive = async (t: EmailTemplate) => {
    try {
      await api.put(`/api/v1/communication/templates/email/${t.id}`, {
        ...t,
        isActive: !t.isActive
      });
      addToast('success', `Template ${!t.isActive ? 'enabled' : 'disabled'} successfully`);
      fetchTemplates();
    } catch (err: any) {
      addToast('error', err.message || 'Failed to toggle status');
    }
  };

  const handleTestSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!testRecipient) {
      addToast('error', 'Please enter a recipient email');
      return;
    }
    try {
      setSendingTest(true);
      await api.post('/api/v1/communication/test-send', {
        channel: 'EMAIL',
        recipient: testRecipient,
        subject: testTemplate?.subject || 'Test Send',
        message: testTemplate?.body || ''
      });
      addToast('success', 'Test email dispatched successfully!');
      setShowTestModal(false);
      setTestRecipient('');
    } catch (err: any) {
      addToast('error', err.message || 'Failed to send test email');
    } finally {
      setSendingTest(false);
    }
  };

  const handleRestoreVersion = async (versionId: string) => {
    if (!selectedTemplateForVer) return;
    try {
      await api.post(`/api/v1/communication/templates/email/${selectedTemplateForVer.id}/versions/${versionId}/restore`);
      addToast('success', 'Template version restored successfully');
      setShowVersionModal(false);
      fetchTemplates();
    } catch (err: any) {
      addToast('error', err.message || 'Failed to restore version');
    }
  };

  const insertVariable = (variable: string) => {
    setBody((prev) => prev + ` {{${variable}}}`);
  };

  const filteredTemplates = templates.filter((t) => {
    const matchesSearch = t.name.toLowerCase().includes(search.toLowerCase()) || t.subject.toLowerCase().includes(search.toLowerCase());
    const matchesCategory = categoryFilter ? t.category === categoryFilter : true;
    return matchesSearch && matchesCategory;
  });

  return (
    <div style={{ padding: '24px', maxWidth: '1200px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <Link href="/dashboard/communication-settings" style={{ fontSize: '13px', color: '#3b82f6', textDecoration: 'none' }}>
            ← Back to Settings
          </Link>
          <h1 style={{ fontSize: '24px', fontWeight: 800, margin: '8px 0 0 0' }}>✉️ Email Template Manager</h1>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: '4px 0 0 0' }}>
            Configure and draft dynamic outbound HTML/text email templates for automated and counsellor workflows.
          </p>
        </div>
        <button onClick={handleOpenCreate} style={{
          backgroundColor: '#3b82f6', color: '#fff', border: 'none', borderRadius: '6px',
          padding: '10px 16px', fontWeight: 600, cursor: 'pointer', fontSize: '13px'
        }}>
          + Create Email Template
        </button>
      </div>

      {/* Filters bar */}
      <div style={{ display: 'flex', gap: '16px', marginBottom: '20px' }}>
        <input
          type="text"
          placeholder="Search template name or subject..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{
            flex: 1, padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--border-color)',
            fontSize: '13px'
          }}
        />
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          style={{
            padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--border-color)',
            fontSize: '13px', minWidth: '180px'
          }}
        >
          <option value="">All Categories</option>
          {CATEGORIES.map((cat) => (
            <option key={cat} value={cat}>{cat}</option>
          ))}
        </select>
      </div>

      {/* Template Grid */}
      {loading ? (
        <div style={{ padding: '40px', textAlign: 'center', fontWeight: 600 }}>Loading templates...</div>
      ) : filteredTemplates.length === 0 ? (
        <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)', border: '1px dashed var(--border-color)', borderRadius: '8px' }}>
          No email templates found. Click "+ Create Email Template" to create one.
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
          {filteredTemplates.map((t) => (
            <div key={t.id} style={{
              backgroundColor: '#fff', border: '1px solid var(--border-color)', borderRadius: '8px',
              padding: '20px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between'
            }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                  <span style={{
                    fontSize: '11px', fontWeight: 700, textTransform: 'uppercase',
                    backgroundColor: '#eff6ff', color: '#1e40af', padding: '2px 8px', borderRadius: '4px'
                  }}>{t.category}</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>v{t.version}</span>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer', fontSize: '12px' }}>
                      <input type="checkbox" checked={t.isActive} onChange={() => handleToggleActive(t)} />
                      {t.isActive ? 'Active' : 'Inactive'}
                    </label>
                  </div>
                </div>
                <h3 style={{ margin: '0 0 6px 0', fontSize: '16px', fontWeight: 700 }}>{t.name}</h3>
                <div style={{ fontSize: '13px', fontWeight: 600, color: '#4b5563', marginBottom: '8px' }}>
                  Subject: {t.subject}
                </div>
                <p style={{
                  fontSize: '13px', color: 'var(--text-muted)', whiteSpace: 'pre-wrap',
                  maxHeight: '120px', overflowY: 'hidden', borderLeft: '3px solid var(--border-color)',
                  paddingLeft: '8px', margin: 0
                }}>{t.body.substring(0, 150)}{t.body.length > 150 ? '...' : ''}</p>
              </div>

              <div style={{ display: 'flex', gap: '8px', marginTop: '16px', borderTop: '1px solid var(--border-color)', paddingTop: '12px' }}>
                <button onClick={() => handleOpenEdit(t)} style={{ padding: '6px 12px', borderRadius: '4px', border: '1px solid var(--border-color)', background: '#fff', fontSize: '12px', cursor: 'pointer' }}>Edit</button>
                <button onClick={() => handleClone(t.id)} style={{ padding: '6px 12px', borderRadius: '4px', border: '1px solid var(--border-color)', background: '#fff', fontSize: '12px', cursor: 'pointer' }}>Clone</button>
                <button onClick={() => { setTestTemplate(t); setShowTestModal(true); }} style={{ padding: '6px 12px', borderRadius: '4px', border: '1px solid #10b981', color: '#10b981', background: '#fff', fontSize: '12px', cursor: 'pointer', fontWeight: 600 }}>Test Send</button>
                <button onClick={() => { setSelectedTemplateForVer(t); setShowVersionModal(true); }} style={{ padding: '6px 12px', borderRadius: '4px', border: '1px solid var(--border-color)', background: '#fff', fontSize: '12px', cursor: 'pointer' }}>Revisions ({t.versions?.length || 0})</button>
                <button onClick={() => handleDelete(t.id)} style={{ marginLeft: 'auto', padding: '6px 12px', borderRadius: '4px', border: 'none', background: '#fef2f2', color: '#dc2626', fontSize: '12px', cursor: 'pointer' }}>Delete</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Editor Modal */}
      {showEditor && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}>
          <div style={{ backgroundColor: '#fff', padding: '24px', borderRadius: '8px', width: '90%', maxWidth: '850px', maxHeight: '90%', overflowY: 'auto' }}>
            <h2 style={{ margin: '0 0 16px 0', fontSize: '18px', fontWeight: 700 }}>
              {editingTemplate ? `Edit Email Template: ${editingTemplate.name}` : 'Create Email Template'}
            </h2>
            <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>Template Name (Unique)</label>
                  <input type="text" value={name} onChange={(e) => setName(e.target.value)} required style={{ width: '100%', padding: '8px', border: '1px solid var(--border-color)', borderRadius: '4px' }} placeholder="e.g. WELCOME_BROCHURE" />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>Template Category</label>
                  <select value={category} onChange={(e) => setCategory(e.target.value)} style={{ width: '100%', padding: '8px', border: '1px solid var(--border-color)', borderRadius: '4px' }}>
                    {CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>Email Subject line</label>
                <input type="text" value={subject} onChange={(e) => setSubject(e.target.value)} required style={{ width: '100%', padding: '8px', border: '1px solid var(--border-color)', borderRadius: '4px' }} placeholder="e.g. Welcome to Study Metro!" />
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                  <label style={{ fontSize: '12px', fontWeight: 600 }}>Email Body content</label>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Variables replace dynamically during dispatch</span>
                </div>
                <textarea value={body} onChange={(e) => setBody(e.target.value)} required style={{ width: '100%', height: '180px', padding: '8px', border: '1px solid var(--border-color)', borderRadius: '4px', fontFamily: 'monospace', fontSize: '13px' }} placeholder="Write body..." />
              </div>

              {/* Dynamic Variables Pill Helper */}
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '6px' }}>Supported Placeholders (Click to Insert)</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                  {VARIABLES.map((v) => (
                    <button key={v} type="button" onClick={() => insertVariable(v)} style={{
                      padding: '4px 8px', borderRadius: '4px', border: '1px solid var(--border-color)',
                      background: '#f9fafb', fontSize: '11px', cursor: 'pointer', fontWeight: 500
                    }}>
                      {`{{${v}}}`}
                    </button>
                  ))}
                </div>
              </div>

              {/* Live Preview */}
              <div style={{ border: '1px solid var(--border-color)', borderRadius: '6px', padding: '16px', background: '#fafafa' }}>
                <h4 style={{ margin: '0 0 8px 0', fontSize: '13px', fontWeight: 700 }}>Live Compile Preview</h4>
                <div style={{ fontSize: '12px', borderBottom: '1px solid var(--border-color)', paddingBottom: '6px', marginBottom: '6px' }}>
                  <strong>Subject:</strong> {subject}
                </div>
                <div style={{ fontSize: '12px', whiteSpace: 'pre-wrap', color: '#374151' }}>
                  {body
                    .replace(/{{studentName}}/g, 'Wasib Qureshi')
                    .replace(/{{leadNumber}}/g, 'SM-9801')
                    .replace(/{{country}}/g, 'Germany')
                    .replace(/{{course}}/g, 'Masters in CS')
                    .replace(/{{brochureLink}}/g, 'https://studymetrojaipur.com/brochure/view/test-token')
                    .replace(/{{portalLink}}/g, 'https://crm.studymetrojaipur.com/student/login')
                  }
                </div>
              </div>

              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '8px' }}>
                <button type="button" onClick={() => setShowEditor(false)} style={{ padding: '8px 16px', border: '1px solid var(--border-color)', background: '#fff', borderRadius: '4px', cursor: 'pointer' }}>Cancel</button>
                <button type="submit" style={{ padding: '8px 16px', border: 'none', background: '#3b82f6', color: '#fff', borderRadius: '4px', cursor: 'pointer', fontWeight: 600 }}>Save Template</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Test Send Modal */}
      {showTestModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}>
          <div style={{ backgroundColor: '#fff', padding: '24px', borderRadius: '8px', width: '90%', maxWidth: '450px' }}>
            <h2 style={{ margin: '0 0 16px 0', fontSize: '18px', fontWeight: 700 }}>Test Send Email Template</h2>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '16px' }}>
              Dispatch an isolated test email immediately to verify layout and delivery.
            </p>
            <form onSubmit={handleTestSend} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>Recipient Email Address</label>
                <input type="email" value={testRecipient} onChange={(e) => setTestRecipient(e.target.value)} required style={{ width: '100%', padding: '8px', border: '1px solid var(--border-color)', borderRadius: '4px' }} placeholder="e.g. test@example.com" />
              </div>
              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                <button type="button" onClick={() => setShowTestModal(false)} style={{ padding: '8px 16px', border: '1px solid var(--border-color)', background: '#fff', borderRadius: '4px', cursor: 'pointer' }}>Cancel</button>
                <button type="submit" disabled={sendingTest} style={{ padding: '8px 16px', border: 'none', background: '#10b981', color: '#fff', borderRadius: '4px', cursor: 'pointer', fontWeight: 600 }}>
                  {sendingTest ? 'Sending...' : 'Send Test'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Version History Modal */}
      {showVersionModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}>
          <div style={{ backgroundColor: '#fff', padding: '24px', borderRadius: '8px', width: '90%', maxWidth: '600px', maxHeight: '80%', overflowY: 'auto' }}>
            <h2 style={{ margin: '0 0 8px 0', fontSize: '18px', fontWeight: 700 }}>Revision History</h2>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '16px' }}>
              Rollback or snapshot restore previously saved versions of this template.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {selectedTemplateForVer?.versions?.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '20px', color: 'var(--text-muted)' }}>No historical versions saved.</div>
              ) : (
                selectedTemplateForVer?.versions?.map((ver) => (
                  <div key={ver.id} style={{ border: '1px solid var(--border-color)', borderRadius: '6px', padding: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '13px' }}>Version v{ver.version}</div>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{new Date(ver.createdAt).toLocaleString()}</div>
                      <div style={{ fontSize: '12px', marginTop: '4px', fontStyle: 'italic' }}>Subject: {ver.subject}</div>
                    </div>
                    <button onClick={() => handleRestoreVersion(ver.id)} style={{
                      padding: '4px 10px', borderRadius: '4px', border: '1px solid #3b82f6',
                      color: '#3b82f6', background: '#fff', fontSize: '12px', cursor: 'pointer', fontWeight: 600
                    }}>
                      Restore This Version
                    </button>
                  </div>
                ))
              )}
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '20px' }}>
              <button type="button" onClick={() => setShowVersionModal(false)} style={{ padding: '8px 16px', border: '1px solid var(--border-color)', background: '#fff', borderRadius: '4px', cursor: 'pointer' }}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* Toasts Panel */}
      <div style={{ position: 'fixed', bottom: '20px', right: '20px', display: 'flex', flexDirection: 'column', gap: '10px', zIndex: 9999 }}>
        {toasts.map((t) => (
          <div key={t.id} style={{
            padding: '12px 16px', borderRadius: '6px', color: '#fff',
            backgroundColor: t.type === 'success' ? '#10b981' : '#ef4444',
            boxShadow: '0 4px 6px rgba(0,0,0,0.1)', fontSize: '13px', fontWeight: 500
          }}>
            {t.message}
          </div>
        ))}
      </div>
    </div>
  );
}
