'use client';

import React, { useState, useEffect } from 'react';
import { api } from '../../../lib/api';

export default function TrackerTestPage() {
  const [visitorId, setVisitorId] = useState('');
  const [sessionId, setSessionId] = useState('');
  const [recentLeads, setRecentLeads] = useState<any[]>([]);
  const [loadingLeads, setLoadingLeads] = useState(false);
  
  // Custom event trigger form
  const [customEventType, setCustomEventType] = useState('BUTTON_CLICK');
  const [customEventData, setCustomEventData] = useState('{"pageSection": "hero", "color": "blue"}');

  // Identify form
  const [identifyEmail, setIdentifyEmail] = useState('');
  const [identifyTraits, setIdentifyTraits] = useState('{"preferredCourse": "Computer Science"}');

  // Test form fields
  const [testForm, setTestForm] = useState({
    name: '',
    email: '',
    phone: ''
  });

  const [message, setMessage] = useState('');

  const fetchRecentLeads = async () => {
    setLoadingLeads(true);
    try {
      const res = await api.get('/api/v1/leads');
      // Filter leads captured from the Website SDK tracker
      const websiteLeads = (res || [])
        .filter((l: any) => l.source === 'WEBSITE_SDK' || l.visitorId)
        .slice(0, 5);
      setRecentLeads(websiteLeads);
    } catch (err) {
      console.error('Failed to load recent auto-captured leads', err);
    } finally {
      setLoadingLeads(false);
    }
  };

  useEffect(() => {
    // 1. Asynchronously load the tracking SDK script
    const apiHost = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
    const script = document.createElement('script');
    script.src = `${apiHost}/sdk/metro-tracker.js`;
    script.async = true;
    script.onload = () => {
      if ((window as any).MetroTracker) {
        (window as any).MetroTracker.init({
          tenantId: 'studymetro-global',
          apiHost: apiHost
        });
        
        // Retrieve values created by SDK initialization
        setVisitorId(localStorage.getItem('sm_visitor_id') || 'Generating...');
        setSessionId(sessionStorage.getItem('sm_session_id') || 'Generating...');
      }
    };
    document.head.appendChild(script);

    fetchRecentLeads();

    return () => {
      document.head.removeChild(script);
    };
  }, []);

  const triggerCustomEvent = () => {
    try {
      const meta = JSON.parse(customEventData);
      if ((window as any).MetroTracker) {
        (window as any).MetroTracker.track(customEventType, meta);
        setMessage(`Success: Triggered custom event "${customEventType}" with data: ${customEventData}`);
      } else {
        setMessage('Error: MetroTracker script not loaded.');
      }
    } catch (err) {
      setMessage('Error: Invalid JSON metadata.');
    }
  };

  const triggerIdentify = () => {
    if (!identifyEmail) {
      setMessage('Error: Email is required to identify visitor.');
      return;
    }
    try {
      const traits = JSON.parse(identifyTraits);
      if ((window as any).MetroTracker) {
        (window as any).MetroTracker.identify(identifyEmail, traits);
        setMessage(`Success: Identified visitor as ${identifyEmail}`);
      } else {
        setMessage('Error: MetroTracker script not loaded.');
      }
    } catch (err) {
      setMessage('Error: Invalid traits JSON metadata.');
    }
  };

  const handleFormSubmitMock = (e: React.FormEvent) => {
    e.preventDefault();
    setMessage('Form submission intercepted! The SDK is capturing these input fields and sending them to POST /api/v1/tracker/form.');
    
    // Periodically refresh the recent leads table to show the auto-captured lead
    setTimeout(fetchRecentLeads, 1000);
    setTimeout(fetchRecentLeads, 3000);
  };

  return (
    <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '20px', paddingBottom: '60px' }}>
      <div>
        <h2 style={{ fontSize: '15px', fontWeight: 700 }}>🔌 Website Tracking & Ingestion SDK Tester</h2>
        <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
          Verify that the Vanilla Javascript SDK correctly tracks visitor sessions, intercepts forms, and creates leads automatically.
        </p>
      </div>

      {message && (
        <div style={{ padding: '10px 12px', backgroundColor: '#f0f7ff', border: '1px solid #bae6fd', borderRadius: '4px', fontSize: '12px', color: '#0369a1', fontWeight: 600 }}>
          💡 {message}
        </div>
      )}

      {/* Grid layout */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '20px' }}>
        
        {/* Card 1: Active Session Variables */}
        <div style={{ background: '#fff', border: '1px solid var(--border-color)', borderRadius: '4px', padding: '16px' }}>
          <h3 style={{ fontSize: '13px', fontWeight: 700, marginBottom: '12px', paddingBottom: '8px', borderBottom: '1px solid var(--border-color)' }}>
            🔑 Active Browser Session Context
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '12px' }}>
            <div>
              <strong>Visitor ID:</strong>
              <div style={{ fontFamily: 'monospace', background: '#f8fafc', padding: '6px', border: '1px solid var(--border-color)', borderRadius: '4px', marginTop: '4px', color: 'var(--primary-color)' }}>
                {visitorId || 'Loading script...'}
              </div>
            </div>
            <div>
              <strong>Session ID:</strong>
              <div style={{ fontFamily: 'monospace', background: '#f8fafc', padding: '6px', border: '1px solid var(--border-color)', borderRadius: '4px', marginTop: '4px', color: 'var(--primary-color)' }}>
                {sessionId || 'Loading script...'}
              </div>
            </div>
            <div style={{ color: 'var(--text-muted)', fontSize: '11px', marginTop: '4px' }}>
              These IDs are persisted inside the browser's <code>localStorage</code> and <code>sessionStorage</code> and automatically injected in every SDK request.
            </div>
          </div>
        </div>

        {/* Card 2: Form Capture Ingestion Mock */}
        <div style={{ background: '#fff', border: '1px solid var(--border-color)', borderRadius: '4px', padding: '16px' }}>
          <h3 style={{ fontSize: '13px', fontWeight: 700, marginBottom: '12px', paddingBottom: '8px', borderBottom: '1px solid var(--border-color)' }}>
            📝 Lead Capture HTML Contact Form
          </h3>
          
          <form onSubmit={handleFormSubmitMock} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div className="form-group">
              <label>Full Name</label>
              <input
                type="text"
                name="name"
                required
                placeholder="e.g. David Miller"
                className="form-control"
                value={testForm.name}
                onChange={e => setTestForm({ ...testForm, name: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label>Email Address</label>
              <input
                type="email"
                name="email"
                required
                placeholder="david@example.com"
                className="form-control"
                value={testForm.email}
                onChange={e => setTestForm({ ...testForm, email: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label>Phone Number</label>
              <input
                type="tel"
                name="phone"
                required
                placeholder="+14155552671"
                className="form-control"
                value={testForm.phone}
                onChange={e => setTestForm({ ...testForm, phone: e.target.value })}
              />
            </div>
            <button type="submit" className="btn btn-primary" style={{ marginTop: '8px', padding: '8px' }}>
              Submit Landing Page Form
            </button>
          </form>
        </div>

        {/* Card 3: Custom Tracking Events */}
        <div style={{ background: '#fff', border: '1px solid var(--border-color)', borderRadius: '4px', padding: '16px' }}>
          <h3 style={{ fontSize: '13px', fontWeight: 700, marginBottom: '12px', paddingBottom: '8px', borderBottom: '1px solid var(--border-color)' }}>
            ⚡ Trigger Tracking Events
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div className="form-group">
              <label>Event Type Name</label>
              <input
                type="text"
                className="form-control"
                value={customEventType}
                onChange={e => setCustomEventType(e.target.value)}
              />
            </div>
            <div className="form-group">
              <label>Payload Metadata (JSON)</label>
              <textarea
                className="form-control"
                rows={2}
                value={customEventData}
                onChange={e => setCustomEventData(e.target.value)}
              />
            </div>
            <button onClick={triggerCustomEvent} className="btn" style={{ padding: '8px' }}>
              Submit Event Ingest Request
            </button>
          </div>
        </div>

        {/* Card 4: Identify Visitor Traits */}
        <div style={{ background: '#fff', border: '1px solid var(--border-color)', borderRadius: '4px', padding: '16px' }}>
          <h3 style={{ fontSize: '13px', fontWeight: 700, marginBottom: '12px', paddingBottom: '8px', borderBottom: '1px solid var(--border-color)' }}>
            👤 Map Visitor Identity (Identify Traits)
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div className="form-group">
              <label>Target Identify Email</label>
              <input
                type="email"
                className="form-control"
                placeholder="david@example.com"
                value={identifyEmail}
                onChange={e => setIdentifyEmail(e.target.value)}
              />
            </div>
            <div className="form-group">
              <label>Identity Traits (JSON)</label>
              <textarea
                className="form-control"
                rows={2}
                value={identifyTraits}
                onChange={e => setIdentifyTraits(e.target.value)}
              />
            </div>
            <button onClick={triggerIdentify} className="btn" style={{ padding: '8px' }}>
              Submit Identify Ingest Request
            </button>
          </div>
        </div>

      </div>

      {/* Leads verification results */}
      <div style={{ background: '#fff', border: '1px solid var(--border-color)', borderRadius: '4px', padding: '16px', marginTop: '10px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', paddingBottom: '8px', borderBottom: '1px solid var(--border-color)' }}>
          <h3 style={{ fontSize: '13px', fontWeight: 700, margin: 0 }}>
            📡 Real-Time Auto-Captured Website Leads
          </h3>
          <button onClick={fetchRecentLeads} className="btn btn-sm" disabled={loadingLeads}>
            🔄 Refresh List
          </button>
        </div>

        <div className="table-container" style={{ margin: 0, border: 'none' }}>
          {loadingLeads && recentLeads.length === 0 ? (
            <div style={{ padding: '20px', textAlign: 'center', fontSize: '12px', color: 'var(--text-muted)' }}>
              Checking candidate records...
            </div>
          ) : recentLeads.length === 0 ? (
            <div style={{ padding: '20px', textAlign: 'center', fontSize: '12px', color: 'var(--text-muted)' }}>
              No website-captured leads yet. Submit the contact form above to capture a lead instantly!
            </div>
          ) : (
            <table className="dense-table" style={{ width: '100%' }}>
              <thead>
                <tr>
                  <th>Student Name</th>
                  <th>Email Address</th>
                  <th>Phone Number</th>
                  <th>Lead Ingress Source</th>
                  <th>Attributed Visitor ID</th>
                  <th>Capture Date</th>
                </tr>
              </thead>
              <tbody>
                {recentLeads.map((lead) => (
                  <tr key={lead.id}>
                    <td>
                      <a href={`/dashboard/leads/${lead.id}`} style={{ color: 'var(--primary-color)', fontWeight: 600, textDecoration: 'none' }}>
                        {lead.firstName} {lead.lastName || ''}
                      </a>
                    </td>
                    <td>{lead.email || '—'}</td>
                    <td>{lead.phone || '—'}</td>
                    <td>
                      <span className="badge badge-new" style={{ backgroundColor: '#f0fdf4', color: '#15803d', border: '1px solid #bbf7d0' }}>
                        {lead.source}
                      </span>
                    </td>
                    <td style={{ fontFamily: 'monospace', fontSize: '11px' }} title={lead.visitorId}>
                      {lead.visitorId ? `${lead.visitorId.slice(0, 8)}...` : '—'}
                    </td>
                    <td>{new Date(lead.createdAt).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

    </div>
  );
}
