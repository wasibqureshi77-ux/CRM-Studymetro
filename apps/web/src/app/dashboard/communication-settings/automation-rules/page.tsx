'use client';

import React, { useState, useEffect } from 'react';
import { api } from '../../../../lib/api';
import Link from 'next/link';

interface EmailTemplate { id: string; name: string; category: string }
interface WhatsappTemplate { id: string; name: string; category: string }
interface SmsTemplate { id: string; name: string; category: string }

interface AutomationRule {
  id: string;
  name: string;
  trigger: string;
  channel: 'EMAIL' | 'WHATSAPP' | 'SMS';
  emailTemplateId?: string | null;
  whatsappTemplateId?: string | null;
  smsTemplateId?: string | null;
  delayType: 'IMMEDIATE' | 'DELAYED';
  delayDuration?: string | null;
  conditions?: Record<string, any> | null;
  enabled: boolean;
  emailTemplate?: EmailTemplate | null;
  whatsappTemplate?: WhatsappTemplate | null;
  smsTemplate?: SmsTemplate | null;
}

const TRIGGERS = ['LEAD_CREATED', 'DOCUMENT_PENDING', 'FOLLOWUP_REMINDER', 'VISA_APPROVED', 'OFFER_RECEIVED'];
const CHANNELS = ['EMAIL', 'WHATSAPP', 'SMS'];

export default function AutomationRulesPage() {
  const [rules, setRules] = useState<AutomationRule[]>([]);
  const [emailTemplates, setEmailTemplates] = useState<EmailTemplate[]>([]);
  const [whatsappTemplates, setWhatsappTemplates] = useState<WhatsappTemplate[]>([]);
  const [smsTemplates, setSmsTemplates] = useState<SmsTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [toasts, setToasts] = useState<Array<{ id: string; type: 'success' | 'error'; message: string }>>([]);

  // Editor Modal States
  const [showEditor, setShowEditor] = useState(false);
  const [editingRule, setEditingRule] = useState<AutomationRule | null>(null);
  const [name, setName] = useState('');
  const [trigger, setTrigger] = useState('LEAD_CREATED');
  const [channel, setChannel] = useState<'EMAIL' | 'WHATSAPP' | 'SMS'>('EMAIL');
  const [emailTemplateId, setEmailTemplateId] = useState('');
  const [whatsappTemplateId, setWhatsappTemplateId] = useState('');
  const [smsTemplateId, setSmsTemplateId] = useState('');
  const [delayType, setDelayType] = useState<'IMMEDIATE' | 'DELAYED'>('IMMEDIATE');
  const [delayDuration, setDelayDuration] = useState('');
  const [countryCondition, setCountryCondition] = useState('');
  const [enabled, setEnabled] = useState(true);

  const addToast = (type: 'success' | 'error', message: string) => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, type, message }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 4000);
  };

  const fetchData = async () => {
    try {
      setLoading(true);
      const [rulesRes, emailRes, waRes, smsRes] = await Promise.all([
        api.get('/api/v1/communication/autos'),
        api.get('/api/v1/communication/templates/email'),
        api.get('/api/v1/communication/templates/whatsapp'),
        api.get('/api/v1/communication/templates/sms')
      ]);

      if (Array.isArray(rulesRes)) setRules(rulesRes);
      if (Array.isArray(emailRes)) setEmailTemplates(emailRes);
      if (Array.isArray(waRes)) setWhatsappTemplates(waRes);
      if (Array.isArray(smsRes)) setSmsTemplates(smsRes);
    } catch (err: any) {
      addToast('error', err.message || 'Failed to load automation configurations');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleOpenCreate = () => {
    setEditingRule(null);
    setName('');
    setTrigger('LEAD_CREATED');
    setChannel('EMAIL');
    setEmailTemplateId(emailTemplates[0]?.id || '');
    setWhatsappTemplateId(whatsappTemplates[0]?.id || '');
    setSmsTemplateId(smsTemplates[0]?.id || '');
    setDelayType('IMMEDIATE');
    setDelayDuration('');
    setCountryCondition('');
    setEnabled(true);
    setShowEditor(true);
  };

  const handleOpenEdit = (r: AutomationRule) => {
    setEditingRule(r);
    setName(r.name);
    setTrigger(r.trigger);
    setChannel(r.channel);
    setEmailTemplateId(r.emailTemplateId || '');
    setWhatsappTemplateId(r.whatsappTemplateId || '');
    setSmsTemplateId(r.smsTemplateId || '');
    setDelayType(r.delayType);
    setDelayDuration(r.delayDuration || '');
    setCountryCondition(r.conditions?.preferredCountry || r.conditions?.country || '');
    setEnabled(r.enabled);
    setShowEditor(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name) {
      addToast('error', 'Rule Name is required');
      return;
    }

    const conditions = countryCondition ? { preferredCountry: countryCondition } : null;
    const payload = {
      id: editingRule?.id,
      name,
      trigger,
      channel,
      emailTemplateId: channel === 'EMAIL' ? emailTemplateId : null,
      whatsappTemplateId: channel === 'WHATSAPP' ? whatsappTemplateId : null,
      smsTemplateId: channel === 'SMS' ? smsTemplateId : null,
      delayType,
      delayDuration: delayType === 'DELAYED' ? delayDuration : null,
      conditions,
      enabled
    };

    try {
      await api.post('/api/v1/communication/autos', payload);
      addToast('success', editingRule ? 'Automation rule updated' : 'Automation rule created');
      setShowEditor(false);
      fetchData();
    } catch (err: any) {
      addToast('error', err.message || 'Failed to save automation rule');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this rule?')) return;
    try {
      await api.delete(`/api/v1/communication/autos/${id}`);
      addToast('success', 'Automation rule deleted');
      fetchData();
    } catch (err: any) {
      addToast('error', err.message || 'Failed to delete rule');
    }
  };

  const handleClone = async (id: string) => {
    try {
      await api.post(`/api/v1/communication/autos/${id}/clone`);
      addToast('success', 'Automation rule duplicated successfully');
      fetchData();
    } catch (err: any) {
      addToast('error', err.message || 'Failed to clone rule');
    }
  };

  const handleToggleRule = async (r: AutomationRule) => {
    try {
      await api.patch(`/api/v1/communication/autos/${r.id}`, {
        ...r,
        enabled: !r.enabled
      });
      addToast('success', `Rule ${!r.enabled ? 'enabled' : 'disabled'} successfully`);
      fetchData();
    } catch (err: any) {
      addToast('error', err.message || 'Failed to toggle status');
    }
  };

  return (
    <div style={{ padding: '24px', maxWidth: '1200px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <Link href="/dashboard/communication-settings" style={{ fontSize: '13px', color: '#3b82f6', textDecoration: 'none' }}>
            ← Back to Settings
          </Link>
          <h1 style={{ fontSize: '24px', fontWeight: 800, margin: '8px 0 0 0' }}>⚙️ Automation Rules Engine</h1>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: '4px 0 0 0' }}>
            Map lifecycle event triggers (e.g. Lead Ingested, Document Uploaded) to specific communication templates, conditions, and delays.
          </p>
        </div>
        <button onClick={handleOpenCreate} style={{
          backgroundColor: '#3b82f6', color: '#fff', border: 'none', borderRadius: '6px',
          padding: '10px 16px', fontWeight: 600, cursor: 'pointer', fontSize: '13px'
        }}>
          + Add Automation Rule
        </button>
      </div>

      {/* Rules list */}
      {loading ? (
        <div style={{ padding: '40px', textAlign: 'center', fontWeight: 600 }}>Loading configurations...</div>
      ) : rules.length === 0 ? (
        <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)', border: '1px dashed var(--border-color)', borderRadius: '8px' }}>
          No active automation rules defined. Click "+ Add Automation Rule" to begin.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {rules.map((r) => {
            let tmplName = 'No Template Linked';
            if (r.channel === 'EMAIL' && r.emailTemplate) tmplName = r.emailTemplate.name;
            else if (r.channel === 'WHATSAPP' && r.whatsappTemplate) tmplName = r.whatsappTemplate.name;
            else if (r.channel === 'SMS' && r.smsTemplate) tmplName = r.smsTemplate.name;

            const targetCountry = r.conditions?.preferredCountry || r.conditions?.country || null;

            return (
              <div key={r.id} style={{
                backgroundColor: '#fff', border: '1px solid var(--border-color)', borderRadius: '8px',
                padding: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center'
              }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                    <span style={{
                      fontSize: '10px', fontWeight: 700, textTransform: 'uppercase',
                      backgroundColor: '#f3f4f6', color: '#1f2937', padding: '2px 6px', borderRadius: '4px'
                    }}>{r.trigger}</span>
                    <span style={{
                      fontSize: '10px', fontWeight: 700, textTransform: 'uppercase',
                      backgroundColor: r.channel === 'WHATSAPP' ? '#e8f5e9' : '#eff6ff',
                      color: r.channel === 'WHATSAPP' ? '#2e7d32' : '#1e40af',
                      padding: '2px 6px', borderRadius: '4px'
                    }}>{r.channel}</span>
                    {r.delayType === 'DELAYED' && (
                      <span style={{ fontSize: '11px', color: '#d97706', fontWeight: 600 }}>⏱️ Delayed: {r.delayDuration}</span>
                    )}
                    {targetCountry && (
                      <span style={{ fontSize: '11px', color: '#7c3aed', fontWeight: 600 }}>🌍 Country: {targetCountry}</span>
                    )}
                  </div>
                  <h3 style={{ margin: '0 0 4px 0', fontSize: '15px', fontWeight: 700 }}>{r.name}</h3>
                  <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                    Linked Template: <strong style={{ color: '#111827' }}>{tmplName}</strong>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '13px', fontWeight: 500 }}>
                    <input type="checkbox" checked={r.enabled} onChange={() => handleToggleRule(r)} />
                    {r.enabled ? 'Enabled' : 'Disabled'}
                  </label>
                  <button onClick={() => handleOpenEdit(r)} style={{ padding: '5px 10px', borderRadius: '4px', border: '1px solid var(--border-color)', background: '#fff', fontSize: '12px', cursor: 'pointer' }}>Edit</button>
                  <button onClick={() => handleClone(r.id)} style={{ padding: '5px 10px', borderRadius: '4px', border: '1px solid var(--border-color)', background: '#fff', fontSize: '12px', cursor: 'pointer' }}>Clone</button>
                  <button onClick={() => handleDelete(r.id)} style={{ padding: '5px 10px', borderRadius: '4px', border: 'none', background: '#fef2f2', color: '#dc2626', fontSize: '12px', cursor: 'pointer' }}>Delete</button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Editor Modal */}
      {showEditor && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}>
          <div style={{ backgroundColor: '#fff', padding: '24px', borderRadius: '8px', width: '90%', maxWidth: '600px', maxHeight: '90%', overflowY: 'auto' }}>
            <h2 style={{ margin: '0 0 16px 0', fontSize: '18px', fontWeight: 700 }}>
              {editingRule ? `Edit Automation: ${editingRule.name}` : 'Add Automation Rule'}
            </h2>
            <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>Rule Descriptive Name</label>
                <input type="text" value={name} onChange={(e) => setName(e.target.value)} required style={{ width: '100%', padding: '8px', border: '1px solid var(--border-color)', borderRadius: '4px' }} placeholder="e.g. Welcome Brochure WhatsApp Dispatch" />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>Event Trigger Hook</label>
                  <select value={trigger} onChange={(e) => setTrigger(e.target.value)} style={{ width: '100%', padding: '8px', border: '1px solid var(--border-color)', borderRadius: '4px' }}>
                    {TRIGGERS.map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>Dispatch Channel</label>
                  <select value={channel} onChange={(e) => setChannel(e.target.value as any)} style={{ width: '100%', padding: '8px', border: '1px solid var(--border-color)', borderRadius: '4px' }}>
                    {CHANNELS.map((ch) => (
                      <option key={ch} value={ch}>{ch}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Conditional Template Dropdowns */}
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>Select Matched Template</label>
                {channel === 'EMAIL' && (
                  <select value={emailTemplateId} onChange={(e) => setEmailTemplateId(e.target.value)} required style={{ width: '100%', padding: '8px', border: '1px solid var(--border-color)', borderRadius: '4px' }}>
                    <option value="">-- Choose Email Template --</option>
                    {emailTemplates.map((t) => (
                      <option key={t.id} value={t.id}>{t.name} ({t.category})</option>
                    ))}
                  </select>
                )}
                {channel === 'WHATSAPP' && (
                  <select value={whatsappTemplateId} onChange={(e) => setWhatsappTemplateId(e.target.value)} required style={{ width: '100%', padding: '8px', border: '1px solid var(--border-color)', borderRadius: '4px' }}>
                    <option value="">-- Choose WhatsApp Template --</option>
                    {whatsappTemplates.map((t) => (
                      <option key={t.id} value={t.id}>{t.name} ({t.category})</option>
                    ))}
                  </select>
                )}
                {channel === 'SMS' && (
                  <select value={smsTemplateId} onChange={(e) => setSmsTemplateId(e.target.value)} required style={{ width: '100%', padding: '8px', border: '1px solid var(--border-color)', borderRadius: '4px' }}>
                    <option value="">-- Choose SMS Template --</option>
                    {smsTemplates.map((t) => (
                      <option key={t.id} value={t.id}>{t.name} ({t.category})</option>
                    ))}
                  </select>
                )}
              </div>

              {/* Conditional Delay Duration */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>Delay Execution Type</label>
                  <select value={delayType} onChange={(e) => setDelayType(e.target.value as any)} style={{ width: '100%', padding: '8px', border: '1px solid var(--border-color)', borderRadius: '4px' }}>
                    <option value="IMMEDIATE">Immediate Dispatch</option>
                    <option value="DELAYED">Delayed Duration</option>
                  </select>
                </div>
                {delayType === 'DELAYED' && (
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>Delay Offset (duration)</label>
                    <input type="text" value={delayDuration} onChange={(e) => setDelayDuration(e.target.value)} required style={{ width: '100%', padding: '8px', border: '1px solid var(--border-color)', borderRadius: '4px' }} placeholder="e.g. 5m, 1h, 1d" />
                  </div>
                )}
              </div>

              {/* Condition Rule Builder (Preferred Country Filter) */}
              <div style={{ border: '1px solid var(--border-color)', borderRadius: '6px', padding: '12px', background: '#f9fafb' }}>
                <h4 style={{ margin: '0 0 6px 0', fontSize: '12px', fontWeight: 700 }}>Filter Rules / Targeting Conditions</h4>
                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, marginBottom: '4px' }}>Only send if Lead Preferred Destination matches (optional)</label>
                  <input type="text" value={countryCondition} onChange={(e) => setCountryCondition(e.target.value)} style={{ width: '100%', padding: '6px 8px', border: '1px solid var(--border-color)', borderRadius: '4px', fontSize: '12px' }} placeholder="e.g. Canada, Germany" />
                </div>
              </div>

              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <input type="checkbox" id="ruleEnabledBox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
                <label htmlFor="ruleEnabledBox" style={{ fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>Activate this automation rule</label>
              </div>

              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '8px' }}>
                <button type="button" onClick={() => setShowEditor(false)} style={{ padding: '8px 16px', border: '1px solid var(--border-color)', background: '#fff', borderRadius: '4px', cursor: 'pointer' }}>Cancel</button>
                <button type="submit" style={{ padding: '8px 16px', border: 'none', background: '#3b82f6', color: '#fff', borderRadius: '4px', cursor: 'pointer', fontWeight: 600 }}>Save Rule</button>
              </div>
            </form>
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
