'use client';

import React, { useState, useEffect } from 'react';
import { api } from '../../lib/api';
import { useAuth } from '../../context/auth-context';

export default function DashboardPage() {
  const { user } = useAuth();
  const [leads, setLeads] = useState<any[]>([]);
  const [followups, setFollowups] = useState<any[]>([]);
  const [activities, setActivities] = useState<any[]>([]);
  const [expiringDocs, setExpiringDocs] = useState<any[]>([]);
  const [pendingVerificationCount, setPendingVerificationCount] = useState(0);
  const [loading, setLoading] = useState(true);

  // Modal display states
  const [showNewLeadModal, setShowNewLeadModal] = useState(false);
  const [showFollowupModal, setShowFollowupModal] = useState(false);

  // Modal form states
  const [leadForm, setLeadForm] = useState({
    firstName: '',
    lastName: '',
    phone: '',
    email: '',
    country: '',
    course: '',
    intake: '',
    source: 'MANUAL',
    leadCategory: 'STUDY_ABROAD'
  });

  const [followupForm, setFollowupForm] = useState({
    leadId: '',
    followupDate: '',
    notes: ''
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const loadData = async () => {
    try {
      const [leadsData, followupsData, activitiesData, expiringData, allDocs] = await Promise.all([
        api.get('/api/v1/leads'),
        api.get('/api/v1/followups'),
        api.get('/api/v1/leads/meta/activities'),
        api.get('/api/v1/documents/expiring?days=90'),
        api.get('/api/v1/documents')
      ]);
      setLeads(leadsData || []);
      setFollowups(followupsData || []);
      setActivities(activitiesData || []);
      setExpiringDocs(expiringData || []);

      // Filter documents where status is UPLOADED (Pending counselor verification)
      const pendingCount = (allDocs || []).filter((d: any) => d.status === 'UPLOADED').length;
      setPendingVerificationCount(pendingCount);
    } catch (err) {
      console.error('Failed to load dashboard data', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleLeadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!leadForm.firstName || !leadForm.phone) {
      setErrorMsg('Name and Phone are required fields.');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg('');
    try {
      await api.post('/api/v1/leads', {
        firstName: leadForm.firstName,
        lastName: leadForm.lastName,
        phone: leadForm.phone,
        email: leadForm.email,
        source: leadForm.source,
        leadCategory: leadForm.leadCategory,
        studentProfile: {
          targetCountry: leadForm.country,
          targetCourse: leadForm.course,
          intake: leadForm.intake
        }
      });
      setShowNewLeadModal(false);
      setLeadForm({
        firstName: '',
        lastName: '',
        phone: '',
        email: '',
        country: '',
        course: '',
        intake: '',
        source: 'MANUAL',
        leadCategory: 'STUDY_ABROAD'
      });
      await loadData();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to create lead.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleFollowupSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!followupForm.leadId || !followupForm.followupDate) {
      setErrorMsg('Please select a student and followup date.');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg('');
    try {
      await api.post('/api/v1/followups', {
        leadId: followupForm.leadId,
        followupDate: new Date(followupForm.followupDate).toISOString(),
        notes: followupForm.notes
      });
      setShowFollowupModal(false);
      setFollowupForm({ leadId: '', followupDate: '', notes: '' });
      await loadData();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to schedule followup.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div style={{ padding: '20px', fontWeight: 600 }}>
        Loading Study Metro CRM dashboard metrics...
      </div>
    );
  }

  // Calculate Metrics
  const studyAbroadCount = leads.filter(l => (l.leadCategory || 'STUDY_ABROAD') === 'STUDY_ABROAD').length;
  const ieltsCount = leads.filter(l => l.leadCategory === 'IELTS').length;
  const pteCount = leads.filter(l => l.leadCategory === 'PTE').length;
  const englishSpeakingCount = leads.filter(l => l.leadCategory === 'ENGLISH_SPEAKING').length;
  const computerCourseCount = leads.filter(l => l.leadCategory === 'COMPUTER_COURSE' || l.leadCategory === 'DIGITAL_MARKETING').length;

  const admissionReadyCount = leads.filter(l => (l.readinessScore ?? 0) >= 80).length;
  const needsAttentionCount = leads.filter(l => (l.readinessScore ?? 0) < 80).length;

  const upcomingFollowups = followups
    .filter(f => f.status === 'SCHEDULED' && new Date(f.followupDate) >= new Date())
    .sort((a, b) => new Date(a.followupDate).getTime() - new Date(b.followupDate).getTime());

  return (
    <div style={{ paddingBottom: '40px' }}>
      {/* Top Banner & Quick Actions */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', borderBottom: '1px solid var(--border-color)', background: '#fff', gap: '16px' }}>
        <div>
          <h2 style={{ fontSize: '15px', fontWeight: 700 }}>Study Metro CRM Dashboard</h2>
          <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Welcome back, {user?.firstName}. Managing single organization operations.</p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button onClick={() => { setErrorMsg(''); setShowNewLeadModal(true); }} className="btn btn-primary">
            ➕ New Lead
          </button>
          <button onClick={() => { setErrorMsg(''); setShowFollowupModal(true); }} className="btn">
            📅 Schedule Followup
          </button>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <section className="dashboard-grid" style={{ gridTemplateColumns: 'repeat(5, 1fr)' }}>
        <div className="kpi-card" style={{ borderLeft: '3px solid #3b82f6' }}>
          <div className="kpi-label">Study Abroad</div>
          <div className="kpi-value">{studyAbroadCount}</div>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>Leads registered</div>
        </div>

        <div className="kpi-card" style={{ borderLeft: '3px solid #8b5cf6' }}>
          <div className="kpi-label">IELTS / PTE</div>
          <div className="kpi-value">{ieltsCount + pteCount}</div>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>Coaching leads</div>
        </div>

        <div className="kpi-card" style={{ borderLeft: '3px solid #14b8a6' }}>
          <div className="kpi-label">English Speaking</div>
          <div className="kpi-value">{englishSpeakingCount}</div>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>Speaking leads</div>
        </div>

        <div className="kpi-card" style={{ borderLeft: '3px solid #f59e0b' }}>
          <div className="kpi-label">Pending Verification</div>
          <div className="kpi-value" style={{ color: '#d97706' }}>{pendingVerificationCount}</div>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>Docs awaiting review</div>
        </div>

        <div className="kpi-card" style={{ borderLeft: '3px solid #ef4444' }}>
          <div className="kpi-label">Expiring Documents</div>
          <div className="kpi-value" style={{ color: '#dc2626' }}>{expiringDocs.length}</div>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>Expiry within 90 days</div>
        </div>
      </section>

      {/* Compliance / Readiness score overview banner */}
      <section style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', padding: '0 20px', marginTop: '10px' }}>
        <div style={{ padding: '16px', background: '#ecfdf5', border: '1px solid #a7f3d0', borderRadius: '4px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h4 style={{ margin: 0, fontSize: '13px', color: '#065f46', fontWeight: 700 }}>Admission Ready Candidates</h4>
            <p style={{ margin: '4px 0 0 0', fontSize: '11px', color: '#047857' }}>Students with &ge; 80% documents uploaded and verified</p>
          </div>
          <span style={{ fontSize: '24px', fontWeight: 800, color: '#059669' }}>{admissionReadyCount}</span>
        </div>

        <div style={{ padding: '16px', background: '#fffbeb', border: '1px solid #fef3c7', borderRadius: '4px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h4 style={{ margin: 0, fontSize: '13px', color: '#92400e', fontWeight: 700 }}>Needs Document Attention</h4>
            <p style={{ margin: '4px 0 0 0', fontSize: '11px', color: '#b45309' }}>Students with incomplete required credentials</p>
          </div>
          <span style={{ fontSize: '24px', fontWeight: 800, color: '#d97706' }}>{needsAttentionCount}</span>
        </div>
      </section>

      {/* Split Columns */}
      <div style={{ display: 'flex', padding: '0 20px', gap: '20px', marginTop: '20px', flexWrap: 'wrap' }}>
        
        {/* Column 1: Expiring Documents soon list */}
        <div style={{ flex: 1, minWidth: '300px', background: '#fff', border: '1px solid var(--border-color)', borderRadius: '4px', padding: '16px' }}>
          <h3 style={{ fontSize: '13px', fontWeight: 700, marginBottom: '12px', paddingBottom: '8px', borderBottom: '1px solid var(--border-color)' }}>
            ⚠️ Documents Expiring Soon (90 Days)
          </h3>
          {expiringDocs.length === 0 ? (
            <div style={{ padding: '20px', color: 'var(--text-muted)', textAlign: 'center', fontSize: '12px' }}>
              No document expirations detected in the next 90 days.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {expiringDocs.map((doc) => (
                <div key={doc.id} style={{ padding: '10px', background: '#fff2f2', border: '1px solid #fca5a5', borderRadius: '4px', fontSize: '12px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 600 }}>
                    <a href={`/dashboard/leads/${doc.lead?.id}`} style={{ color: 'var(--primary-color)', textDecoration: 'none' }}>
                      {doc.lead?.firstName} {doc.lead?.lastName || ''}
                    </a>
                    <span style={{ color: '#dc2626', fontSize: '11px' }}>
                      Expires: {new Date(doc.expiryDate).toLocaleDateString()}
                    </span>
                  </div>
                  <div style={{ fontSize: '11px', color: '#7f1d1d', marginTop: '2px' }}>
                    Document Type: <strong>{doc.documentType}</strong>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Column 2: Upcoming Followups */}
        <div style={{ flex: 1, minWidth: '300px', background: '#fff', border: '1px solid var(--border-color)', borderRadius: '4px', padding: '16px' }}>
          <h3 style={{ fontSize: '13px', fontWeight: 700, marginBottom: '12px', paddingBottom: '8px', borderBottom: '1px solid var(--border-color)' }}>
            📅 Upcoming Followups
          </h3>
          {upcomingFollowups.length === 0 ? (
            <div style={{ padding: '20px', color: 'var(--text-muted)', textAlign: 'center', fontSize: '12px' }}>
              No upcoming scheduled followups.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {upcomingFollowups.slice(0, 5).map((f) => (
                <div key={f.id} style={{ padding: '10px', background: '#f8fafc', border: '1px solid var(--border-color)', borderRadius: '4px', fontSize: '12px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 600 }}>
                    <a href={`/dashboard/leads/${f.lead?.id}`} style={{ color: 'var(--primary-color)', textDecoration: 'none' }}>
                      {f.lead?.firstName} {f.lead?.lastName || ''}
                    </a>
                    <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                      {new Date(f.followupDate).toLocaleString()}
                    </span>
                  </div>
                  {f.notes && (
                    <div style={{ marginTop: '4px', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                      Notes: {f.notes}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Column 3: Recent Activities */}
        <div style={{ flex: 1, minWidth: '300px', background: '#fff', border: '1px solid var(--border-color)', borderRadius: '4px', padding: '16px' }}>
          <h3 style={{ fontSize: '13px', fontWeight: 700, marginBottom: '12px', paddingBottom: '8px', borderBottom: '1px solid var(--border-color)' }}>
            📞 Recent Lead Activities
          </h3>
          {activities.length === 0 ? (
            <div style={{ padding: '20px', color: 'var(--text-muted)', textAlign: 'center', fontSize: '12px' }}>
              No recent activity recorded.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {activities.slice(0, 5).map((act) => (
                <div key={act.id} style={{ padding: '10px', background: '#f8fafc', border: '1px solid var(--border-color)', borderRadius: '4px', fontSize: '12px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <strong style={{ color: '#334155' }}>{act.type.replace(/_/g, ' ')}</strong>
                    <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                      {new Date(act.createdAt).toLocaleString()}
                    </span>
                  </div>
                  <div style={{ color: 'var(--text-muted)', marginTop: '2px' }}>
                    {act.description}
                  </div>
                  {act.lead && (
                    <div style={{ fontSize: '10px', marginTop: '4px', color: 'var(--primary-color)' }}>
                      Student: <a href={`/dashboard/leads/${act.lead.id}`} style={{ color: 'inherit', textDecoration: 'none', fontWeight: 600 }}>{act.lead.firstName} {act.lead.lastName || ''}</a>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

      </div>

      {/* ================= MODALS ================= */}

      {/* 1. New Lead Modal */}
      {showNewLeadModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <form onSubmit={handleLeadSubmit} style={{ backgroundColor: '#fff', borderRadius: '4px', border: '1px solid var(--border-color)', padding: '20px', width: '460px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <h3 style={{ fontSize: '14px', fontWeight: 700, margin: 0, borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>➕ Create New Lead</h3>
            
            {errorMsg && <div style={{ color: 'var(--danger-color)', fontSize: '11px', fontWeight: 600 }}>{errorMsg}</div>}
            
            <div style={{ display: 'flex', gap: '10px' }}>
              <div className="form-group" style={{ flex: 1 }}>
                <label>First Name *</label>
                <input type="text" className="form-control" required value={leadForm.firstName} onChange={e => setLeadForm({ ...leadForm, firstName: e.target.value })} />
              </div>
              <div className="form-group" style={{ flex: 1 }}>
                <label>Last Name</label>
                <input type="text" className="form-control" value={leadForm.lastName} onChange={e => setLeadForm({ ...leadForm, lastName: e.target.value })} />
              </div>
            </div>

            <div style={{ display: 'flex', gap: '10px' }}>
              <div className="form-group" style={{ flex: 1 }}>
                <label>Phone *</label>
                <input type="text" className="form-control" required placeholder="+12345..." value={leadForm.phone} onChange={e => setLeadForm({ ...leadForm, phone: e.target.value })} />
              </div>
              <div className="form-group" style={{ flex: 1 }}>
                <label>Email</label>
                <input type="email" className="form-control" value={leadForm.email} onChange={e => setLeadForm({ ...leadForm, email: e.target.value })} />
              </div>
            </div>

            <div style={{ display: 'flex', gap: '10px' }}>
              <div className="form-group" style={{ flex: 1 }}>
                <label>Lead Category</label>
                <select className="form-control" value={leadForm.leadCategory} onChange={e => setLeadForm({ ...leadForm, leadCategory: e.target.value })}>
                  <option value="STUDY_ABROAD">Study Abroad</option>
                  <option value="IELTS">IELTS</option>
                  <option value="PTE">PTE</option>
                  <option value="ENGLISH_SPEAKING">English Speaking</option>
                  <option value="COMPUTER_COURSE">Computer Course</option>
                  <option value="DIGITAL_MARKETING">Digital Marketing</option>
                  <option value="OTHER">Other</option>
                </select>
              </div>
              <div className="form-group" style={{ flex: 1 }}>
                <label>Lead Source</label>
                <select className="form-control" value={leadForm.source} onChange={e => setLeadForm({ ...leadForm, source: e.target.value })}>
                  <option value="MANUAL">Manual</option>
                  <option value="WEBSITE_SDK">Website SDK</option>
                  <option value="WHATSAPP">WhatsApp</option>
                  <option value="TELEPHONY">Telephony</option>
                  <option value="FACEBOOK_ADS">Facebook Ads</option>
                </select>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '10px' }}>
              <div className="form-group" style={{ flex: 1 }}>
                <label>Country</label>
                <input type="text" className="form-control" placeholder="e.g. USA" value={leadForm.country} onChange={e => setLeadForm({ ...leadForm, country: e.target.value })} />
              </div>
              <div className="form-group" style={{ flex: 1 }}>
                <label>Course</label>
                <input type="text" className="form-control" placeholder="e.g. MS CS" value={leadForm.course} onChange={e => setLeadForm({ ...leadForm, course: e.target.value })} />
              </div>
            </div>

            <div className="form-group">
              <label>Intake</label>
              <input type="text" className="form-control" placeholder="e.g. Fall 2026" value={leadForm.intake} onChange={e => setLeadForm({ ...leadForm, intake: e.target.value })} />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '12px' }}>
              <button type="button" className="btn" disabled={isSubmitting} onClick={() => setShowNewLeadModal(false)}>Cancel</button>
              <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
                {isSubmitting ? 'Saving...' : 'Save Lead'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* 2. Schedule Followup Modal */}
      {showFollowupModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <form onSubmit={handleFollowupSubmit} style={{ backgroundColor: '#fff', borderRadius: '4px', border: '1px solid var(--border-color)', padding: '20px', width: '420px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <h3 style={{ fontSize: '14px', fontWeight: 700, margin: 0, borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>📅 Schedule Followup</h3>
            
            {errorMsg && <div style={{ color: 'var(--danger-color)', fontSize: '11px', fontWeight: 600 }}>{errorMsg}</div>}
            
            <div className="form-group">
              <label>Select Student *</label>
              <select className="form-control" required value={followupForm.leadId} onChange={e => setFollowupForm({ ...followupForm, leadId: e.target.value })}>
                <option value="">-- Choose Candidate --</option>
                {leads.map(l => (
                  <option key={l.id} value={l.id}>
                    {l.firstName} {l.lastName || ''} ({l.phone || 'No phone'})
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label>Date and Time *</label>
              <input type="datetime-local" className="form-control" required value={followupForm.followupDate} onChange={e => setFollowupForm({ ...followupForm, followupDate: e.target.value })} />
            </div>

            <div className="form-group">
              <label>Agenda / Followup Notes</label>
              <textarea className="form-control" rows={3} placeholder="What needs to be discussed..." value={followupForm.notes} onChange={e => setFollowupForm({ ...followupForm, notes: e.target.value })} />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '12px' }}>
              <button type="button" className="btn" disabled={isSubmitting} onClick={() => setShowFollowupModal(false)}>Cancel</button>
              <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
                {isSubmitting ? 'Scheduling...' : 'Schedule'}
              </button>
            </div>
          </form>
        </div>
      )}

    </div>
  );
}
