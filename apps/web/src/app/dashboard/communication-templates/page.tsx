'use client';

import React, { useState, useEffect } from 'react';
import { api, apiFetch } from '../../../lib/api';

interface Template {
  id: string;
  name: string;
  channel: 'EMAIL' | 'WHATSAPP';
  subject: string | null;
  content: string;
  isActive: boolean;
  updatedAt: string;
}

const SUPPORTED_VARIABLES = [
  '{{name}}',
  '{{leadId}}',
  '{{documentList}}',
  '{{followupDate}}',
  '{{country}}',
  '{{course}}',
  '{{counsellor}}'
];

const PRESETS = [
  'WELCOME',
  'DOCUMENT_REQUEST',
  'FOLLOWUP_REMINDER',
  'APPLICATION_SUBMITTED',
  'OFFER_RECEIVED',
  'OFFER_ACCEPTED',
  'VISA_APPLIED',
  'VISA_APPROVED',
  'ENROLLMENT_COMPLETE'
];

export default function CommunicationTemplatesPage() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Form states
  const [showForm, setShowForm] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<Template | null>(null);
  const [formName, setFormName] = useState('WELCOME');
  const [customName, setCustomName] = useState('');
  const [formChannel, setFormChannel] = useState<'EMAIL' | 'WHATSAPP'>('EMAIL');
  const [formSubject, setFormSubject] = useState('');
  const [formContent, setFormContent] = useState('');
  const [formIsActive, setFormIsActive] = useState(true);

  // Preview state
  const [previewTemplate, setPreviewTemplate] = useState<Template | null>(null);

  const fetchTemplates = async () => {
    try {
      setLoading(true);
      const res = await api.get('/api/v1/communication/templates');
      if (Array.isArray(res)) {
        setTemplates(res);
      }
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Failed to load templates');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTemplates();
  }, []);

  const handleOpenCreate = () => {
    setEditingTemplate(null);
    setFormName('WELCOME');
    setCustomName('');
    setFormChannel('EMAIL');
    setFormSubject('');
    setFormContent('');
    setFormIsActive(true);
    setShowForm(true);
  };

  const handleOpenEdit = (t: Template) => {
    setEditingTemplate(t);
    if (PRESETS.includes(t.name)) {
      setFormName(t.name);
      setCustomName('');
    } else {
      setFormName('CUSTOM');
      setCustomName(t.name);
    }
    setFormChannel(t.channel);
    setFormSubject(t.subject || '');
    setFormContent(t.content);
    setFormIsActive(t.isActive);
    setShowForm(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const finalName = formName === 'CUSTOM' ? customName.trim() : formName;
    if (!finalName) {
      alert('Please specify a template name');
      return;
    }

    const payload = {
      name: finalName,
      channel: formChannel,
      subject: formChannel === 'EMAIL' ? formSubject : null,
      content: formContent,
      isActive: formIsActive
    };

    try {
      if (editingTemplate) {
        // Use PUT method via apiFetch
        await apiFetch(`/api/v1/communication/templates/${editingTemplate.id}`, {
          method: 'PUT',
          body: JSON.stringify(payload)
        });
      } else {
        await api.post('/api/v1/communication/templates', payload);
      }
      setShowForm(false);
      fetchTemplates();
    } catch (err: any) {
      alert(err.message || 'Failed to save template');
    }
  };

  const toggleStatus = async (t: Template) => {
    try {
      await apiFetch(`/api/v1/communication/templates/${t.id}`, {
        method: 'PUT',
        body: JSON.stringify({ isActive: !t.isActive })
      });
      fetchTemplates();
    } catch (err: any) {
      alert(err.message || 'Failed to update status');
    }
  };

  const renderPreviewContent = (template: Template) => {
    const mockData = {
      name: 'John Doe',
      leadId: 'lead-8b73f2a',
      documentList: '• Passport Bio Page\n• IELTS Test Report Form\n• Undergraduate Marksheets',
      followupDate: 'Thursday, June 25, 2026 at 3:00 PM',
      country: 'Canada',
      course: 'MSc Data Science',
      counsellor: 'Sarah SuperAdmin'
    };

    let body = template.content;
    body = body.replace(/\{\{name\}\}/g, mockData.name);
    body = body.replace(/\{\{leadId\}\}/g, mockData.leadId);
    body = body.replace(/\{\{documentList\}\}/g, mockData.documentList);
    body = body.replace(/\{\{followupDate\}\}/g, mockData.followupDate);
    body = body.replace(/\{\{country\}\}/g, mockData.country);
    body = body.replace(/\{\{course\}\}/g, mockData.course);
    body = body.replace(/\{\{counsellor\}\}/g, mockData.counsellor);

    return body;
  };

  const insertVariable = (variable: string) => {
    const textarea = document.getElementById('template-content-textarea') as HTMLTextAreaElement;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = textarea.value;
    const before = text.substring(0, start);
    const after = text.substring(end, text.length);

    setFormContent(before + variable + after);
    
    // Focus back and set cursor position after inserting
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + variable.length, start + variable.length);
    }, 50);
  };

  return (
    <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
      
      {/* Header section */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontSize: '20px', fontWeight: 700, margin: 0 }}>Communication Template Manager</h1>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: '4px 0 0 0' }}>
            Manage outbound system event templates for Email and WhatsApp integrations.
          </p>
        </div>
        <button onClick={handleOpenCreate} className="btn btn-primary" style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          ➕ Create Template
        </button>
      </div>

      {error && (
        <div style={{ padding: '12px 16px', backgroundColor: '#fef2f2', border: '1px solid #fee2e2', color: '#b91c1c', borderRadius: '6px', fontSize: '13px' }}>
          ⚠️ {error}
        </div>
      )}

      {/* Grid table */}
      <div className="table-container" style={{ margin: 0 }}>
        {loading ? (
          <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
            Loading templates...
          </div>
        ) : templates.length === 0 ? (
          <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
            No communication templates found. Set up your first template.
          </div>
        ) : (
          <table className="dense-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left', padding: '12px 16px' }}>Template Name</th>
                <th style={{ textAlign: 'left', padding: '12px 16px' }}>Channel</th>
                <th style={{ textAlign: 'left', padding: '12px 16px' }}>Subject</th>
                <th style={{ textAlign: 'left', padding: '12px 16px' }}>Status</th>
                <th style={{ textAlign: 'left', padding: '12px 16px' }}>Updated Date</th>
                <th style={{ textAlign: 'center', padding: '12px 16px', width: '220px' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {templates.map((t) => (
                <tr key={t.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                  <td style={{ padding: '12px 16px' }}>
                    <strong>{t.name}</strong>
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <span style={{
                      display: 'inline-flex',
                      padding: '2px 8px',
                      borderRadius: '4px',
                      fontSize: '11px',
                      fontWeight: 600,
                      backgroundColor: t.channel === 'EMAIL' ? '#e0f2fe' : '#dcfce7',
                      color: t.channel === 'EMAIL' ? '#0369a1' : '#15803d'
                    }}>
                      {t.channel}
                    </span>
                  </td>
                  <td style={{ padding: '12px 16px', color: t.subject ? 'inherit' : 'var(--text-muted)', fontSize: '13px' }}>
                    {t.subject || '—'}
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <button
                      onClick={() => toggleStatus(t)}
                      style={{
                        padding: '2px 8px',
                        borderRadius: '4px',
                        border: '1px solid',
                        fontSize: '11px',
                        fontWeight: 600,
                        cursor: 'pointer',
                        backgroundColor: t.isActive ? '#dcfce7' : '#f1f5f9',
                        color: t.isActive ? '#166534' : '#475569',
                        borderColor: t.isActive ? '#bbf7d0' : '#cbd5e1'
                      }}
                    >
                      {t.isActive ? 'Active' : 'Disabled'}
                    </button>
                  </td>
                  <td style={{ padding: '12px 16px', fontSize: '13px', color: 'var(--text-muted)' }}>
                    {new Date(t.updatedAt).toLocaleDateString()} {new Date(t.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </td>
                  <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                    <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                      <button onClick={() => handleOpenEdit(t)} className="btn btn-sm btn-outline-primary" style={{ padding: '4px 8px', fontSize: '11px' }}>
                        ✏️ Edit
                      </button>
                      <button onClick={() => setPreviewTemplate(t)} className="btn btn-sm btn-outline-success" style={{ padding: '4px 8px', fontSize: '11px' }}>
                        👁️ Preview
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Editor Modal */}
      {showForm && (
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
          zIndex: 1000,
          padding: '20px'
        }}>
          <div style={{
            backgroundColor: '#fff',
            borderRadius: '8px',
            width: '100%',
            maxWidth: '650px',
            maxHeight: '90vh',
            display: 'flex',
            flexDirection: 'column',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)'
          }}>
            <div style={{ padding: '18px 24px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: '16px', fontWeight: 700, margin: 0 }}>
                {editingTemplate ? 'Edit Communication Template' : 'Create Communication Template'}
              </h3>
              <button onClick={() => setShowForm(false)} style={{ border: 'none', background: 'transparent', fontSize: '20px', cursor: 'pointer', color: 'var(--text-muted)' }}>
                ✕
              </button>
            </div>

            <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '16px', padding: '24px', overflowY: 'auto' }}>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)' }}>Template Name</label>
                  <select
                    className="form-control"
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                  >
                    {PRESETS.map((p) => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                    <option value="CUSTOM">CUSTOM (Enter Name below)</option>
                  </select>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)' }}>Channel</label>
                  <select
                    className="form-control"
                    value={formChannel}
                    onChange={(e) => setFormChannel(e.target.value as any)}
                  >
                    <option value="EMAIL">EMAIL</option>
                    <option value="WHATSAPP">WHATSAPP</option>
                  </select>
                </div>
              </div>

              {formName === 'CUSTOM' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)' }}>Custom Template Name</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="e.g. MARKETING_PROMO"
                    value={customName}
                    onChange={(e) => setCustomName(e.target.value)}
                    required
                  />
                </div>
              )}

              {formChannel === 'EMAIL' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)' }}>Email Subject Line</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="e.g. Welcome to Study Metro!"
                    value={formSubject}
                    onChange={(e) => setFormSubject(e.target.value)}
                    required={formChannel === 'EMAIL'}
                  />
                </div>
              )}

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)' }}>Template Message Body</label>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Insert variables to make content dynamic</span>
                </div>

                {/* Variable short-tags bar */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', padding: '8px', backgroundColor: '#f8fafc', border: '1px solid var(--border-color)', borderRadius: '4px', marginBottom: '4px' }}>
                  {SUPPORTED_VARIABLES.map((v) => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => insertVariable(v)}
                      style={{
                        padding: '3px 8px',
                        fontSize: '11px',
                        border: '1px solid #cbd5e1',
                        borderRadius: '4px',
                        backgroundColor: '#fff',
                        cursor: 'pointer',
                        fontWeight: 500,
                        color: 'var(--primary-color)'
                      }}
                    >
                      {v}
                    </button>
                  ))}
                </div>

                <textarea
                  id="template-content-textarea"
                  className="form-control"
                  rows={8}
                  style={{ fontFamily: 'monospace', fontSize: '13px', lineHeight: '1.5' }}
                  placeholder="Dear {{name}}, Welcome to study abroad program in {{country}}..."
                  value={formContent}
                  onChange={(e) => setFormContent(e.target.value)}
                  required
                />
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
                <input
                  type="checkbox"
                  id="formIsActiveCheckbox"
                  checked={formIsActive}
                  onChange={(e) => setFormIsActive(e.target.checked)}
                />
                <label htmlFor="formIsActiveCheckbox" style={{ fontSize: '13px', fontWeight: 500, cursor: 'pointer' }}>
                  Enable this template immediately
                </label>
              </div>

              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '16px', borderTop: '1px solid var(--border-color)', paddingTop: '16px' }}>
                <button type="button" onClick={() => setShowForm(false)} className="btn btn-outline" style={{ padding: '8px 16px' }}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" style={{ padding: '8px 16px' }}>
                  {editingTemplate ? 'Update Template' : 'Create Template'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Preview Modal */}
      {previewTemplate && (
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
          zIndex: 1000,
          padding: '20px'
        }}>
          <div style={{
            backgroundColor: '#fff',
            borderRadius: '8px',
            width: '100%',
            maxWidth: '550px',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)'
          }}>
            <div style={{ padding: '18px 24px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: '15px', fontWeight: 700, margin: 0 }}>
                🔍 Live Template Preview ({previewTemplate.channel})
              </h3>
              <button onClick={() => setPreviewTemplate(null)} style={{ border: 'none', background: 'transparent', fontSize: '20px', cursor: 'pointer', color: 'var(--text-muted)' }}>
                ✕
              </button>
            </div>

            <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              
              {previewTemplate.channel === 'EMAIL' ? (
                // Email Client Box Mockup
                <div style={{ border: '1px solid #cbd5e1', borderRadius: '6px', overflow: 'hidden' }}>
                  <div style={{ backgroundColor: '#f1f5f9', padding: '12px', borderBottom: '1px solid #cbd5e1', fontSize: '12px', color: '#475569' }}>
                    <div><strong>To:</strong> John Doe &lt;john.doe@gmail.com&gt;</div>
                    <div style={{ marginTop: '4px' }}><strong>Subject:</strong> {previewTemplate.subject || 'No Subject'}</div>
                  </div>
                  <div style={{ padding: '20px', backgroundColor: '#fff', fontSize: '14px', lineHeight: '1.6', whiteSpace: 'pre-wrap', minHeight: '150px' }}>
                    {renderPreviewContent(previewTemplate)}
                  </div>
                </div>
              ) : (
                // WhatsApp Chat Box Mockup
                <div style={{ border: '1px solid #bbf7d0', borderRadius: '12px', overflow: 'hidden', maxWidth: '400px', margin: '0 auto', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}>
                  <div style={{ backgroundColor: '#075e54', padding: '12px', color: '#fff', fontSize: '13px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '18px' }}>💬</span> Study Metro Support
                  </div>
                  <div style={{ backgroundColor: '#ece5dd', padding: '20px', minHeight: '150px', backgroundImage: 'radial-gradient(#dfdcd6 1px, transparent 0)', backgroundSize: '12px 12px' }}>
                    <div style={{
                      backgroundColor: '#fff',
                      padding: '10px 14px',
                      borderRadius: '8px',
                      fontSize: '13px',
                      lineHeight: '1.5',
                      boxShadow: '0 1px 2px rgba(0,0,0,0.15)',
                      whiteSpace: 'pre-wrap',
                      maxWidth: '90%',
                      position: 'relative'
                    }}>
                      {renderPreviewContent(previewTemplate)}
                      <span style={{
                        fontSize: '9px',
                        color: 'var(--text-muted)',
                        display: 'block',
                        textAlign: 'right',
                        marginTop: '4px'
                      }}>
                        17:30
                      </span>
                    </div>
                  </div>
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '8px' }}>
                <button onClick={() => setPreviewTemplate(null)} className="btn btn-primary" style={{ padding: '8px 16px' }}>
                  Done
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
