'use client';

import React, { useState, useEffect } from 'react';
import { api } from '../../../../lib/api';
import Link from 'next/link';

interface WhatsappTemplateVersion {
  id: string;
  version: number;
  body: string;
  createdAt: string;
}

interface WhatsappTemplate {
  id: string;
  name: string;
  body: string;
  category: string;
  isActive: boolean;
  version: number;
  updatedAt: string;
  versions: WhatsappTemplateVersion[];
}

const CATEGORIES = ['Lead', 'Admissions', 'Visa', 'Documents', 'Payment', 'Portal', 'Marketing', 'Follow-up', 'Custom'];
const VARIABLES = ['studentName', 'leadNumber', 'country', 'course', 'intake', 'assignedCounsellor', 'brochureLink', 'portalLink', 'offerLetter', 'visaStatus', 'paymentLink', 'today'];

export default function WhatsappTemplatesPage() {
  const [templates, setTemplates] = useState<WhatsappTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [toasts, setToasts] = useState<Array<{ id: string; type: 'success' | 'error'; message: string }>>([]);

  // Editor Modal States
  const [showEditor, setShowEditor] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<WhatsappTemplate | null>(null);
  const [name, setName] = useState('');
  const [body, setBody] = useState('');
  const [category, setCategory] = useState('Custom');
  const [isActive, setIsActive] = useState(true);

  // Test Send Modal States
  const [showTestModal, setShowTestModal] = useState(false);
  const [testTemplate, setTestTemplate] = useState<WhatsappTemplate | null>(null);
  const [testRecipient, setTestRecipient] = useState('');
  const [sendingTest, setSendingTest] = useState(false);

  // Version History Modal
  const [showVersionModal, setShowVersionModal] = useState(false);
  const [selectedTemplateForVer, setSelectedTemplateForVer] = useState<WhatsappTemplate | null>(null);

  const addToast = (type: 'success' | 'error', message: string) => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, type, message }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 4000);
  };

  const fetchTemplates = async () => {
    try {
      setLoading(true);
      const res = await api.get('/api/v1/communication/templates/whatsapp');
      if (Array.isArray(res)) setTemplates(res);
    } catch (err: any) {
      addToast('error', err.message || 'Failed to load WhatsApp templates');
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
    setBody('');
    setCategory('Custom');
    setIsActive(true);
    setShowEditor(true);
  };

  const handleOpenEdit = (t: WhatsappTemplate) => {
    setEditingTemplate(t);
    setName(t.name);
    setBody(t.body);
    setCategory(t.category);
    setIsActive(t.isActive);
    setShowEditor(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !body) {
      addToast('error', 'Please fill in all required fields');
      return;
    }

    try {
      if (editingTemplate) {
        await api.put(`/api/v1/communication/templates/whatsapp/${editingTemplate.id}`, {
          name, body, message: body, category, isActive
        });
        addToast('success', 'WhatsApp template updated successfully');
      } else {
        await api.post('/api/v1/communication/templates/whatsapp', {
          name, body, message: body, category, isActive
        });
        addToast('success', 'WhatsApp template created successfully');
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
      await api.delete(`/api/v1/communication/templates/whatsapp/${id}`);
      addToast('success', 'Template deleted successfully');
      fetchTemplates();
    } catch (err: any) {
      addToast('error', err.message || 'Failed to delete template');
    }
  };

  const handleClone = async (id: string) => {
    try {
      await api.post(`/api/v1/communication/templates/whatsapp/${id}/clone`);
      addToast('success', 'Template cloned successfully');
      fetchTemplates();
    } catch (err: any) {
      addToast('error', err.message || 'Failed to clone template');
    }
  };

  const handleToggleActive = async (t: WhatsappTemplate) => {
    try {
      await api.put(`/api/v1/communication/templates/whatsapp/${t.id}`, {
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
      addToast('error', 'Please enter a recipient phone number');
      return;
    }
    try {
      setSendingTest(true);
      await api.post('/api/v1/communication/test-send', {
        channel: 'WHATSAPP',
        recipient: testRecipient,
        message: testTemplate?.body || ''
      });
      addToast('success', 'Test WhatsApp message enqueued successfully!');
      setShowTestModal(false);
      setTestRecipient('');
    } catch (err: any) {
      addToast('error', err.message || 'Failed to send test WhatsApp message');
    } finally {
      setSendingTest(false);
    }
  };

  const handleRestoreVersion = async (versionId: string) => {
    if (!selectedTemplateForVer) return;
    try {
      await api.post(`/api/v1/communication/templates/whatsapp/${selectedTemplateForVer.id}/versions/${versionId}/restore`);
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
    const matchesSearch = t.name.toLowerCase().includes(search.toLowerCase()) || t.body.toLowerCase().includes(search.toLowerCase());
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
          <h1 style={{ fontSize: '24px', fontWeight: 800, margin: '8px 0 0 0' }}>💬 WhatsApp Template Manager</h1>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: '4px 0 0 0' }}>
            Draft dynamic outbound WhatsApp text templates, monitor character counts, and send direct test notifications.
          </p>
        </div>
        <button onClick={handleOpenCreate} style={{
          backgroundColor: '#25d366', color: '#fff', border: 'none', borderRadius: '6px',
          padding: '10px 16px', fontWeight: 600, cursor: 'pointer', fontSize: '13px'
        }}>
          + Create WhatsApp Template
        </button>
      </div>

      {/* Filters bar */}
      <div style={{ display: 'flex', gap: '16px', marginBottom: '20px' }}>
        <input
          type="text"
          placeholder="Search template name or body content..."
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
          No WhatsApp templates found. Click "+ Create WhatsApp Template" to create one.
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
                    backgroundColor: '#e8f5e9', color: '#2e7d32', padding: '2px 8px', borderRadius: '4px'
                  }}>{t.category}</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>v{t.version}</span>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer', fontSize: '12px' }}>
                      <input type="checkbox" checked={t.isActive} onChange={() => handleToggleActive(t)} />
                      {t.isActive ? 'Active' : 'Inactive'}
                    </label>
                  </div>
                </div>
                <h3 style={{ margin: '0 0 8px 0', fontSize: '16px', fontWeight: 700 }}>{t.name}</h3>
                <p style={{
                  fontSize: '13px', color: 'var(--text-muted)', whiteSpace: 'pre-wrap',
                  maxHeight: '120px', overflowY: 'hidden', borderLeft: '3px solid #25d366',
                  paddingLeft: '8px', margin: 0
                }}>{t.body.substring(0, 150)}{t.body.length > 150 ? '...' : ''}</p>
              </div>

              <div style={{ display: 'flex', gap: '8px', marginTop: '16px', borderTop: '1px solid var(--border-color)', paddingTop: '12px' }}>
                <button onClick={() => handleOpenEdit(t)} style={{ padding: '6px 12px', borderRadius: '4px', border: '1px solid var(--border-color)', background: '#fff', fontSize: '12px', cursor: 'pointer' }}>Edit</button>
                <button onClick={() => handleClone(t.id)} style={{ padding: '6px 12px', borderRadius: '4px', border: '1px solid var(--border-color)', background: '#fff', fontSize: '12px', cursor: 'pointer' }}>Clone</button>
                <button onClick={() => { setTestTemplate(t); setShowTestModal(true); }} style={{ padding: '6px 12px', borderRadius: '4px', border: '1px solid #25d366', color: '#25d366', background: '#fff', fontSize: '12px', cursor: 'pointer', fontWeight: 600 }}>Test Send</button>
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
              {editingTemplate ? `Edit WhatsApp Template: ${editingTemplate.name}` : 'Create WhatsApp Template'}
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
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                  <label style={{ fontSize: '12px', fontWeight: 600 }}>Message Body</label>
                  <span style={{ fontSize: '12px', color: body.length > 1000 ? '#ef4444' : '#10b981', fontWeight: 600 }}>
                    {body.length} Characters
                  </span>
                </div>
                <textarea value={body} onChange={(e) => setBody(e.target.value)} required style={{ width: '100%', height: '180px', padding: '8px', border: '1px solid var(--border-color)', borderRadius: '4px', fontFamily: 'monospace', fontSize: '13px' }} placeholder="Write WhatsApp message body..." />
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
              <div style={{ border: '1px solid var(--border-color)', borderRadius: '6px', padding: '16px', background: '#e5ddd5', backgroundImage: 'url(https://user-images.githubusercontent.com/15075759/28719144-86dc0f70-73b1-11e7-911d-60d70fcded21.png)' }}>
                <h4 style={{ margin: '0 0 8px 0', fontSize: '12px', fontWeight: 700, color: '#075e54' }}>WhatsApp Message Bubble Preview</h4>
                <div style={{
                  backgroundColor: '#dcf8c6', padding: '10px 14px', borderRadius: '8px',
                  boxShadow: '0 1px 0.5px rgba(0,0,0,0.13)', fontSize: '13px', maxWidth: '350px',
                  whiteSpace: 'pre-wrap', color: '#303030'
                }}>
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
                <button type="submit" style={{ padding: '8px 16px', border: 'none', background: '#25d366', color: '#fff', borderRadius: '4px', cursor: 'pointer', fontWeight: 600 }}>Save Template</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Test Send Modal */}
      {showTestModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}>
          <div style={{ backgroundColor: '#fff', padding: '24px', borderRadius: '8px', width: '90%', maxWidth: '450px' }}>
            <h2 style={{ margin: '0 0 16px 0', fontSize: '18px', fontWeight: 700 }}>Test Send WhatsApp Template</h2>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '16px' }}>
              Dispatch an isolated test notification message using your connected Baileys VPS gateway.
            </p>
            <form onSubmit={handleTestSend} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>Recipient Mobile Number (With country code)</label>
                <input type="text" value={testRecipient} onChange={(e) => setTestRecipient(e.target.value)} required style={{ width: '100%', padding: '8px', border: '1px solid var(--border-color)', borderRadius: '4px' }} placeholder="e.g. 919998887770" />
              </div>
              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                <button type="button" onClick={() => setShowTestModal(false)} style={{ padding: '8px 16px', border: '1px solid var(--border-color)', background: '#fff', borderRadius: '4px', cursor: 'pointer' }}>Cancel</button>
                <button type="submit" disabled={sendingTest} style={{ padding: '8px 16px', border: 'none', background: '#25d366', color: '#fff', borderRadius: '4px', cursor: 'pointer', fontWeight: 600 }}>
                  {sendingTest ? 'Sending...' : 'Send Test WhatsApp'}
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
                      <div style={{ fontSize: '12px', marginTop: '4px', fontStyle: 'italic', whiteSpace: 'pre-wrap' }}>{ver.body.substring(0, 100)}...</div>
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
