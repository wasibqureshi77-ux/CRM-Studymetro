'use client';

import React, { useState, useEffect, useRef } from 'react';
import { api } from '../../../lib/api';

export default function TrackerTestPage() {
  const [visitorId, setVisitorId] = useState('');
  const [sessionId, setSessionId] = useState('');
  const [sdkLoaded, setSdkLoaded] = useState(false);
  const [recentLeads, setRecentLeads] = useState<any[]>([]);
  const [loadingLeads, setLoadingLeads] = useState(false);
  const [message, setMessage] = useState('');
  const [activeFormTab, setActiveFormTab] = useState<'contact' | 'consult' | 'admission' | 'custom'>('contact');

  // Verification checks state
  const [verificationReport, setVerificationReport] = useState({
    sdkLoaded: false,
    visitorIdGenerated: false,
    sessionIdGenerated: false,
    formIntercepted: false,
    leadCreated: false,
    crmRecordVisible: false,
    lastCapturedEmail: '',
    lastCapturedLeadId: ''
  });

  const fetchRecentLeads = async () => {
    setLoadingLeads(true);
    try {
      const res = await api.get('/api/v1/leads');
      // Filter leads captured from the Website SDK tracker
      const websiteLeads = (res || [])
        .filter((l: any) => l.source === 'WEBSITE_SDK' || l.visitorId)
        .slice(0, 5);
      setRecentLeads(websiteLeads);
      
      // Update verification report if we have a match
      if (verificationReport.lastCapturedEmail) {
        const matchedLead = websiteLeads.find(
          (l: any) => l.email?.toLowerCase() === verificationReport.lastCapturedEmail.toLowerCase()
        );
        if (matchedLead) {
          setVerificationReport(prev => ({
            ...prev,
            leadCreated: true,
            crmRecordVisible: true,
            lastCapturedLeadId: matchedLead.id
          }));
        }
      }
    } catch (err) {
      console.error('Failed to load recent auto-captured leads', err);
    } finally {
      setLoadingLeads(false);
    }
  };

  useEffect(() => {
    // 1. Asynchronously load the tracking SDK script
    const apiHost = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
    
    // Clean up any existing SDK script first
    const existingScript = document.querySelector(`script[src*="metro-tracker.js"]`);
    if (existingScript) {
      document.head.removeChild(existingScript);
    }

    const script = document.createElement('script');
    script.src = `${apiHost}/sdk/metro-tracker.js`;
    script.async = true;
    script.onload = () => {
      if ((window as any).MetroTracker) {
        (window as any).MetroTracker.init({
          tenantId: 'studymetro-global',
          apiHost: apiHost
        });
        
        const visId = localStorage.getItem('sm_visitor_id') || '';
        const sessId = sessionStorage.getItem('sm_session_id') || '';
        
        setVisitorId(visId);
        setSessionId(sessId);
        setSdkLoaded(true);

        setVerificationReport(prev => ({
          ...prev,
          sdkLoaded: true,
          visitorIdGenerated: !!visId,
          sessionIdGenerated: !!sessId
        }));
      }
    };
    document.head.appendChild(script);

    fetchRecentLeads();

    return () => {
      if (document.head.contains(script)) {
        document.head.removeChild(script);
      }
    };
  }, []);

  // Update check status when lastCapturedEmail changes or list reloads
  useEffect(() => {
    if (verificationReport.lastCapturedEmail) {
      const matchedLead = recentLeads.find(
        (l: any) => l.email?.toLowerCase() === verificationReport.lastCapturedEmail.toLowerCase()
      );
      if (matchedLead) {
        setVerificationReport(prev => ({
          ...prev,
          leadCreated: true,
          crmRecordVisible: true,
          lastCapturedLeadId: matchedLead.id
        }));
      }
    }
  }, [recentLeads, verificationReport.lastCapturedEmail]);

  const handleFormSubmission = (e: React.FormEvent<HTMLFormElement>, formType: string) => {
    e.preventDefault();
    
    const formData = new FormData(e.currentTarget);
    const email = formData.get('email') as string;
    const name = formData.get('name') as string;

    setMessage(`Success: Form "${formType}" submit event triggered! The SDK should now intercept and upload candidate details.`);
    
    setVerificationReport(prev => ({
      ...prev,
      formIntercepted: true,
      lastCapturedEmail: email || ''
    }));

    // Trigger reload of leads
    setTimeout(fetchRecentLeads, 1000);
    setTimeout(fetchRecentLeads, 3500);
  };

  return (
    <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '24px', maxWidth: '1400px', margin: '0 auto' }}>
      
      {/* Page Header */}
      <div style={{ background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)', padding: '24px', borderRadius: '12px', color: '#fff', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }}>
        <h1 style={{ fontSize: '20px', fontWeight: 800, margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
          🔌 Production Lead Capture SDK Verification Bed
        </h1>
        <p style={{ fontSize: '13px', color: '#94a3b8', marginTop: '6px', maxWidth: '800px' }}>
          Form interception and CRM integration testing module. Verify session attributes, intercept Contact, Consultation, Admission and data-metro-capture forms, and check real-time pipeline visibility.
        </p>
      </div>

      {message && (
        <div style={{ padding: '12px 16px', backgroundColor: '#ecfdf5', border: '1px solid #a7f3d0', borderRadius: '8px', fontSize: '13px', color: '#065f46', fontWeight: 600 }}>
          ⚡ {message}
        </div>
      )}

      {/* Grid Layout */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(450px, 1fr))', gap: '24px' }}>
        
        {/* Left Hand Card Column: Context & Form Testing */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          {/* Card 1: Browser Session Context */}
          <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
            <h3 style={{ fontSize: '14px', fontWeight: 700, margin: '0 0 16px 0', borderBottom: '1px solid #f1f5f9', paddingBottom: '12px', color: '#1e293b', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              🔑 Browser Context Values
              <span style={{ fontSize: '11px', color: sdkLoaded ? '#10b981' : '#ef4444', backgroundColor: sdkLoaded ? '#ecfdf5' : '#fef2f2', padding: '2px 8px', borderRadius: '12px', fontWeight: 600 }}>
                {sdkLoaded ? 'SDK Active' : 'Loading SDK...'}
              </span>
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '12px' }}>
              <div>
                <strong style={{ color: '#64748b' }}>Attributed Visitor ID (Persistent):</strong>
                <div style={{ fontFamily: 'monospace', background: '#f8fafc', padding: '8px 12px', border: '1px solid #e2e8f0', borderRadius: '6px', marginTop: '4px', color: '#0f172a', fontSize: '12px', wordBreak: 'break-all' }}>
                  {visitorId || 'Generating...'}
                </div>
              </div>
              <div>
                <strong style={{ color: '#64748b' }}>Active Session ID (Transient):</strong>
                <div style={{ fontFamily: 'monospace', background: '#f8fafc', padding: '8px 12px', border: '1px solid #e2e8f0', borderRadius: '6px', marginTop: '4px', color: '#0f172a', fontSize: '12px', wordBreak: 'break-all' }}>
                  {sessionId || 'Generating...'}
                </div>
              </div>
            </div>
          </div>

          {/* Card 2: Interactive Ingestion Form Bed */}
          <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
            <h3 style={{ fontSize: '14px', fontWeight: 700, margin: '0 0 16px 0', borderBottom: '1px solid #f1f5f9', paddingBottom: '12px', color: '#1e293b' }}>
              📝 Form Capture Test Beds
            </h3>
            
            {/* Form Selection Tabs */}
            <div style={{ display: 'flex', gap: '4px', background: '#f8fafc', padding: '4px', borderRadius: '8px', marginBottom: '16px' }}>
              <button 
                type="button" 
                onClick={() => setActiveFormTab('contact')}
                style={{ flex: 1, padding: '8px 4px', fontSize: '11px', border: 'none', background: activeFormTab === 'contact' ? '#fff' : 'transparent', color: '#0f172a', fontWeight: 600, borderRadius: '6px', cursor: 'pointer', boxShadow: activeFormTab === 'contact' ? '0 1px 3px rgba(0,0,0,0.05)' : 'none' }}>
                Contact Form
              </button>
              <button 
                type="button" 
                onClick={() => setActiveFormTab('consult')}
                style={{ flex: 1, padding: '8px 4px', fontSize: '11px', border: 'none', background: activeFormTab === 'consult' ? '#fff' : 'transparent', color: '#0f172a', fontWeight: 600, borderRadius: '6px', cursor: 'pointer', boxShadow: activeFormTab === 'consult' ? '0 1px 3px rgba(0,0,0,0.05)' : 'none' }}>
                Consultation
              </button>
              <button 
                type="button" 
                onClick={() => setActiveFormTab('admission')}
                style={{ flex: 1, padding: '8px 4px', fontSize: '11px', border: 'none', background: activeFormTab === 'admission' ? '#fff' : 'transparent', color: '#0f172a', fontWeight: 600, borderRadius: '6px', cursor: 'pointer', boxShadow: activeFormTab === 'admission' ? '0 1px 3px rgba(0,0,0,0.05)' : 'none' }}>
                Admission
              </button>
              <button 
                type="button" 
                onClick={() => setActiveFormTab('custom')}
                style={{ flex: 1, padding: '8px 4px', fontSize: '11px', border: 'none', background: activeFormTab === 'custom' ? '#fff' : 'transparent', color: '#0f172a', fontWeight: 600, borderRadius: '6px', cursor: 'pointer', boxShadow: activeFormTab === 'custom' ? '0 1px 3px rgba(0,0,0,0.05)' : 'none' }}>
                data-metro
              </button>
            </div>

            {/* Contact Form */}
            {activeFormTab === 'contact' && (
              <form id="contact-form" onSubmit={(e) => handleFormSubmission(e, 'Contact Form')} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ fontSize: '11px', color: '#64748b', background: '#f8fafc', padding: '6px 12px', borderRadius: '6px', borderLeft: '3px solid #3b82f6' }}>
                  Targeted by ID: <code>id="contact-form"</code>
                </div>
                {renderFormFields()}
              </form>
            )}

            {/* Consultation Form */}
            {activeFormTab === 'consult' && (
              <form id="consultation-form" onSubmit={(e) => handleFormSubmission(e, 'Consultation Form')} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ fontSize: '11px', color: '#64748b', background: '#f8fafc', padding: '6px 12px', borderRadius: '6px', borderLeft: '3px solid #3b82f6' }}>
                  Targeted by ID: <code>id="consultation-form"</code>
                </div>
                {renderFormFields()}
              </form>
            )}

            {/* Admission Form */}
            {activeFormTab === 'admission' && (
              <form id="admission-form" onSubmit={(e) => handleFormSubmission(e, 'Admission Form')} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ fontSize: '11px', color: '#64748b', background: '#f8fafc', padding: '6px 12px', borderRadius: '6px', borderLeft: '3px solid #3b82f6' }}>
                  Targeted by ID: <code>id="admission-form"</code>
                </div>
                {renderFormFields()}
              </form>
            )}

            {/* Custom Attribute Form */}
            {activeFormTab === 'custom' && (
              <form data-metro-capture="true" onSubmit={(e) => handleFormSubmission(e, 'data-metro-capture Form')} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ fontSize: '11px', color: '#64748b', background: '#f8fafc', padding: '6px 12px', borderRadius: '6px', borderLeft: '3px solid #3b82f6' }}>
                  Targeted by Attribute: <code>data-metro-capture="true"</code>
                </div>
                {renderFormFields()}
              </form>
            )}

          </div>

        </div>

        {/* Right Hand Card Column: Verification Report & Results */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          {/* Card 3: Runtime Verification Report Console */}
          <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '12px', padding: '20px', color: '#f8fafc', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }}>
            <h3 style={{ fontSize: '14px', fontWeight: 700, margin: '0 0 16px 0', borderBottom: '1px solid #334155', paddingBottom: '12px', color: '#f1f5f9' }}>
              📊 Runtime Verification Report
            </h3>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '13px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>SDK script loaded:</span>
                <span style={{ fontWeight: 600, color: verificationReport.sdkLoaded ? '#34d399' : '#f87171' }}>
                  {verificationReport.sdkLoaded ? '✓ PASSED' : '✗ PENDING'}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>Visitor ID generated:</span>
                <span style={{ fontWeight: 600, color: verificationReport.visitorIdGenerated ? '#34d399' : '#f87171' }}>
                  {verificationReport.visitorIdGenerated ? '✓ PASSED' : '✗ PENDING'}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>Session ID generated:</span>
                <span style={{ fontWeight: 600, color: verificationReport.sessionIdGenerated ? '#34d399' : '#f87171' }}>
                  {verificationReport.sessionIdGenerated ? '✓ PASSED' : '✗ PENDING'}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>Form submission intercepted:</span>
                <span style={{ fontWeight: 600, color: verificationReport.formIntercepted ? '#34d399' : '#f87171' }}>
                  {verificationReport.formIntercepted ? '✓ PASSED' : '✗ PENDING'}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>Lead created in CRM DB:</span>
                <span style={{ fontWeight: 600, color: verificationReport.leadCreated ? '#34d399' : '#f87171' }}>
                  {verificationReport.leadCreated ? '✓ PASSED' : '✗ PENDING'}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>CRM record visibility verification:</span>
                <span style={{ fontWeight: 600, color: verificationReport.crmRecordVisible ? '#34d399' : '#f87171' }}>
                  {verificationReport.crmRecordVisible ? '✓ PASSED' : '✗ PENDING'}
                </span>
              </div>

              {verificationReport.lastCapturedEmail && (
                <div style={{ background: '#334155', padding: '12px', borderRadius: '8px', marginTop: '8px', borderLeft: '4px solid #10b981' }}>
                  <div style={{ fontWeight: 600, fontSize: '11px', color: '#94a3b8', textTransform: 'uppercase' }}>Attribution Verification Link</div>
                  <div style={{ fontSize: '12px', marginTop: '4px', wordBreak: 'break-all' }}>
                    <strong>Captured Email:</strong> {verificationReport.lastCapturedEmail}
                  </div>
                  {verificationReport.lastCapturedLeadId && (
                    <div style={{ fontSize: '12px', marginTop: '4px' }}>
                      <strong>Lead Profile ID:</strong>{' '}
                      <a href={`/dashboard/leads/${verificationReport.lastCapturedLeadId}`} style={{ color: '#38bdf8', textDecoration: 'none', fontWeight: 600 }}>
                        {verificationReport.lastCapturedLeadId} →
                      </a>
                    </div>
                  )}
                </div>
              )}

            </div>
          </div>

          {/* Card 4: Leads Ledger results */}
          <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '1px solid #f1f5f9', paddingBottom: '12px' }}>
              <h3 style={{ fontSize: '14px', fontWeight: 700, margin: 0, color: '#1e293b' }}>
                📡 Live SDK Lead Ingestion Logs
              </h3>
              <button 
                onClick={fetchRecentLeads} 
                className="btn btn-sm" 
                disabled={loadingLeads}
                style={{ fontSize: '11px', cursor: 'pointer', background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '6px', padding: '4px 10px', fontWeight: 600 }}>
                {loadingLeads ? 'Updating...' : '🔄 Refresh'}
              </button>
            </div>

            <div style={{ overflowX: 'auto' }}>
              {recentLeads.length === 0 ? (
                <div style={{ padding: '20px', textAlign: 'center', fontSize: '12px', color: '#64748b' }}>
                  No lead captured from website yet. Submit a test form on the left side to register candidate.
                </div>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px', textAlign: 'left' }}>
                  <thead>
                    <tr style={{ color: '#64748b', borderBottom: '1px solid #f1f5f9' }}>
                      <th style={{ padding: '8px 4px' }}>Candidate</th>
                      <th style={{ padding: '8px 4px' }}>Country</th>
                      <th style={{ padding: '8px 4px' }}>Course</th>
                      <th style={{ padding: '8px 4px' }}>Intake</th>
                      <th style={{ padding: '8px 4px' }}>Source</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentLeads.map((lead) => (
                      <tr key={lead.id} style={{ borderBottom: '1px solid #f8fafc' }}>
                        <td style={{ padding: '8px 4px' }}>
                          <a href={`/dashboard/leads/${lead.id}`} style={{ color: '#3b82f6', fontWeight: 600, textDecoration: 'none' }}>
                            {lead.firstName} {lead.lastName || ''}
                          </a>
                          <div style={{ color: '#64748b', fontSize: '10px' }}>{lead.email}</div>
                        </td>
                        <td style={{ padding: '8px 4px' }}>{lead.studentProfile?.targetCountry || '—'}</td>
                        <td style={{ padding: '8px 4px' }}>{lead.studentProfile?.targetCourse || '—'}</td>
                        <td style={{ padding: '8px 4px' }}>{lead.studentProfile?.intake || '—'}</td>
                        <td style={{ padding: '8px 4px' }}>
                          <span style={{ backgroundColor: '#f0fdf4', color: '#166534', border: '1px solid #bbf7d0', padding: '2px 6px', borderRadius: '4px', fontWeight: 600 }}>
                            {lead.source}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>

        </div>

      </div>

    </div>
  );

  function renderFormFields() {
    return (
      <>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
          <div className="form-group">
            <label style={{ fontSize: '11px', fontWeight: 600, color: '#475569', marginBottom: '4px', display: 'block' }}>Full Name</label>
            <input
              type="text"
              name="name"
              required
              placeholder="e.g. James Smith"
              className="form-control"
              style={{ fontSize: '12px', padding: '8px', border: '1px solid #cbd5e1', borderRadius: '6px', width: '100%' }}
            />
          </div>
          <div className="form-group">
            <label style={{ fontSize: '11px', fontWeight: 600, color: '#475569', marginBottom: '4px', display: 'block' }}>Email Address</label>
            <input
              type="email"
              name="email"
              required
              placeholder="james@example.com"
              className="form-control"
              style={{ fontSize: '12px', padding: '8px', border: '1px solid #cbd5e1', borderRadius: '6px', width: '100%' }}
            />
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
          <div className="form-group">
            <label style={{ fontSize: '11px', fontWeight: 600, color: '#475569', marginBottom: '4px', display: 'block' }}>Phone Number</label>
            <input
              type="tel"
              name="phone"
              required
              placeholder="+14155558832"
              className="form-control"
              style={{ fontSize: '12px', padding: '8px', border: '1px solid #cbd5e1', borderRadius: '6px', width: '100%' }}
            />
          </div>
          <div className="form-group">
            <label style={{ fontSize: '11px', fontWeight: 600, color: '#475569', marginBottom: '4px', display: 'block' }}>Target Country</label>
            <input
              type="text"
              name="country"
              required
              placeholder="e.g. Canada"
              className="form-control"
              style={{ fontSize: '12px', padding: '8px', border: '1px solid #cbd5e1', borderRadius: '6px', width: '100%' }}
            />
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
          <div className="form-group">
            <label style={{ fontSize: '11px', fontWeight: 600, color: '#475569', marginBottom: '4px', display: 'block' }}>Target Course</label>
            <input
              type="text"
              name="course"
              required
              placeholder="e.g. Master in CS"
              className="form-control"
              style={{ fontSize: '12px', padding: '8px', border: '1px solid #cbd5e1', borderRadius: '6px', width: '100%' }}
            />
          </div>
          <div className="form-group">
            <label style={{ fontSize: '11px', fontWeight: 600, color: '#475569', marginBottom: '4px', display: 'block' }}>Intake Period</label>
            <input
              type="text"
              name="intake"
              required
              placeholder="e.g. Fall 2026"
              className="form-control"
              style={{ fontSize: '12px', padding: '8px', border: '1px solid #cbd5e1', borderRadius: '6px', width: '100%' }}
            />
          </div>
        </div>

        <button 
          type="submit" 
          className="btn btn-primary" 
          style={{ marginTop: '8px', padding: '10px', fontSize: '13px', fontWeight: 600, cursor: 'pointer', background: '#3b82f6', color: '#fff', border: 'none', borderRadius: '6px' }}>
          Submit to Verify Interception SDK
        </button>
      </>
    );
  }
}
