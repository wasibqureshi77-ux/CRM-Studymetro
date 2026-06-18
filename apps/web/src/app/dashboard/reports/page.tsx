'use client';

import React, { useState, useEffect } from 'react';
import { api } from '../../../lib/api';

export default function ReportsPage() {
  const [leads, setLeads] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await api.get('/api/v1/leads');
      setLeads(res || []);
    } catch (err: any) {
      console.error('Failed to load leads for reports', err);
      setErrorMsg(err.message || 'Failed to load report data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  if (loading) {
    return (
      <div style={{ padding: '20px', fontWeight: 600 }}>
        Querying candidate database for analytical report compilation...
      </div>
    );
  }

  const totalLeads = leads.length;

  // 1. Monthly Leads Calculation
  const monthlyMap: Record<string, number> = {};
  leads.forEach((l) => {
    const d = new Date(l.createdAt);
    const label = d.toLocaleString('default', { month: 'long', year: 'numeric' });
    monthlyMap[label] = (monthlyMap[label] || 0) + 1;
  });
  const monthlyLeads = Object.entries(monthlyMap).map(([month, count]) => ({
    month,
    count,
    percentage: totalLeads > 0 ? ((count / totalLeads) * 100).toFixed(1) : '0'
  }));

  // 2. Lead Sources Calculation
  const sourcesMap: Record<string, number> = {};
  leads.forEach((l) => {
    const src = l.source || 'MANUAL';
    sourcesMap[src] = (sourcesMap[src] || 0) + 1;
  });
  const leadSources = Object.entries(sourcesMap).map(([source, count]) => ({
    source: source.replace(/_/g, ' '),
    count,
    percentage: totalLeads > 0 ? ((count / totalLeads) * 100).toFixed(1) : '0'
  })).sort((a, b) => b.count - a.count);

  // 3. Country Interest Calculation
  const countryMap: Record<string, number> = {};
  leads.forEach((l) => {
    const country = l.studentProfile?.targetCountry || 'Not Specified';
    countryMap[country] = (countryMap[country] || 0) + 1;
  });
  const countryInterest = Object.entries(countryMap).map(([country, count]) => ({
    country,
    count,
    percentage: totalLeads > 0 ? ((count / totalLeads) * 100).toFixed(1) : '0'
  })).sort((a, b) => b.count - a.count);

  // 4. Conversion Funnel Calculation
  const funnelStages = [
    { label: 'New Lead', status: 'NEW', color: '#3b82f6' },
    { label: 'Contacted', status: 'CONTACTED', color: '#f59e0b' },
    { label: 'Counselling', status: 'COUNSELLING', color: '#8b5cf6' },
    { label: 'Country Selection', status: 'COUNTRY_SELECTION', color: '#6366f1' },
    { label: 'University Shortlisting', status: 'UNIVERSITY_SHORTLISTING', color: '#ec4899' },
    { label: 'Application Submitted', status: 'APPLICATION_SUBMITTED', color: '#06b6d4' },
    { label: 'Offer Received', status: 'OFFER_LETTER_RECEIVED', color: '#14b8a6' },
    { label: 'Visa Processing', status: 'VISA_PROCESSING', color: '#f43f5e' },
    { label: 'Enrolled', status: 'ENROLLED', color: '#10b981' }
  ];

  const funnelData = funnelStages.map((stage) => {
    const count = leads.filter((l) => l.status === stage.status).length;
    return {
      stage: stage.label,
      count,
      color: stage.color,
      percentage: totalLeads > 0 ? ((count / totalLeads) * 100).toFixed(1) : '0'
    };
  });

  return (
    <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '20px', paddingBottom: '50px' }}>
      <div>
        <h2 style={{ fontSize: '15px', fontWeight: 700 }}>Study Metro CRM Operational Reports</h2>
        <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
          High-density analytics compiled in real time from active candidate records. Total Leads in scope: <strong>{totalLeads}</strong>.
        </p>
      </div>

      {errorMsg && (
        <div style={{ backgroundColor: '#fee2e2', color: '#991b1b', border: '1px solid #fca5a5', padding: '8px 12px', borderRadius: '4px', fontSize: '11px' }}>
          ⚠️ {errorMsg}
        </div>
      )}

      {/* Reports Grid (2x2 Layout) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(450px, 1fr))', gap: '20px' }}>
        
        {/* Card 1: Monthly Leads Ingress */}
        <div style={{ background: '#fff', border: '1px solid var(--border-color)', borderRadius: '4px', padding: '16px' }}>
          <h3 style={{ fontSize: '13px', fontWeight: 700, marginBottom: '12px', paddingBottom: '8px', borderBottom: '1px solid var(--border-color)' }}>
            📈 Monthly Lead Registration Ingress
          </h3>
          <div className="table-container" style={{ margin: 0, border: 'none' }}>
            <table className="dense-table" style={{ width: '100%' }}>
              <thead>
                <tr>
                  <th>Month & Year</th>
                  <th style={{ width: '80px', textAlign: 'right' }}>Total</th>
                  <th style={{ width: '220px' }}>Contribution</th>
                </tr>
              </thead>
              <tbody>
                {monthlyLeads.map((m, idx) => (
                  <tr key={idx}>
                    <td><strong>{m.month}</strong></td>
                    <td style={{ textAlign: 'right', fontWeight: 600 }}>{m.count}</td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div style={{ flex: 1, backgroundColor: '#f1f5f9', height: '6px', borderRadius: '2px' }}>
                          <div style={{ width: `${m.percentage}%`, backgroundColor: '#3b82f6', height: '100%', borderRadius: '2px' }}></div>
                        </div>
                        <span style={{ fontSize: '11px', color: 'var(--text-muted)', width: '35px', textAlign: 'right' }}>{m.percentage}%</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Card 2: Lead Sources Distribution */}
        <div style={{ background: '#fff', border: '1px solid var(--border-color)', borderRadius: '4px', padding: '16px' }}>
          <h3 style={{ fontSize: '13px', fontWeight: 700, marginBottom: '12px', paddingBottom: '8px', borderBottom: '1px solid var(--border-color)' }}>
            📣 Lead Sources Distribution
          </h3>
          <div className="table-container" style={{ margin: 0, border: 'none' }}>
            <table className="dense-table" style={{ width: '100%' }}>
              <thead>
                <tr>
                  <th>Ingress Channel</th>
                  <th style={{ width: '80px', textAlign: 'right' }}>Total</th>
                  <th style={{ width: '220px' }}>Contribution</th>
                </tr>
              </thead>
              <tbody>
                {leadSources.map((s, idx) => (
                  <tr key={idx}>
                    <td><strong>{s.source}</strong></td>
                    <td style={{ textAlign: 'right', fontWeight: 600 }}>{s.count}</td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div style={{ flex: 1, backgroundColor: '#f1f5f9', height: '6px', borderRadius: '2px' }}>
                          <div style={{ width: `${s.percentage}%`, backgroundColor: '#f59e0b', height: '100%', borderRadius: '2px' }}></div>
                        </div>
                        <span style={{ fontSize: '11px', color: 'var(--text-muted)', width: '35px', textAlign: 'right' }}>{s.percentage}%</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Card 3: Country Interest Profile */}
        <div style={{ background: '#fff', border: '1px solid var(--border-color)', borderRadius: '4px', padding: '16px' }}>
          <h3 style={{ fontSize: '13px', fontWeight: 700, marginBottom: '12px', paddingBottom: '8px', borderBottom: '1px solid var(--border-color)' }}>
            🌍 Destination Country Interest Profile
          </h3>
          <div className="table-container" style={{ margin: 0, border: 'none', maxHeight: '250px', overflowY: 'auto' }}>
            <table className="dense-table" style={{ width: '100%' }}>
              <thead>
                <tr>
                  <th>Destination Country</th>
                  <th style={{ width: '80px', textAlign: 'right' }}>Total</th>
                  <th style={{ width: '220px' }}>Contribution</th>
                </tr>
              </thead>
              <tbody>
                {countryInterest.map((c, idx) => (
                  <tr key={idx}>
                    <td><strong>{c.country}</strong></td>
                    <td style={{ textAlign: 'right', fontWeight: 600 }}>{c.count}</td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div style={{ flex: 1, backgroundColor: '#f1f5f9', height: '6px', borderRadius: '2px' }}>
                          <div style={{ width: `${c.percentage}%`, backgroundColor: '#10b981', height: '100%', borderRadius: '2px' }}></div>
                        </div>
                        <span style={{ fontSize: '11px', color: 'var(--text-muted)', width: '35px', textAlign: 'right' }}>{c.percentage}%</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Card 4: Lead Conversion Funnel */}
        <div style={{ background: '#fff', border: '1px solid var(--border-color)', borderRadius: '4px', padding: '16px' }}>
          <h3 style={{ fontSize: '13px', fontWeight: 700, marginBottom: '12px', paddingBottom: '8px', borderBottom: '1px solid var(--border-color)' }}>
            📊 Pipeline Lead Conversion Funnel
          </h3>
          <div className="table-container" style={{ margin: 0, border: 'none' }}>
            <table className="dense-table" style={{ width: '100%' }}>
              <thead>
                <tr>
                  <th>Funnel Stage</th>
                  <th style={{ width: '80px', textAlign: 'right' }}>Total</th>
                  <th style={{ width: '220px' }}>Conversion Ratio</th>
                </tr>
              </thead>
              <tbody>
                {funnelData.map((f, idx) => (
                  <tr key={idx}>
                    <td>
                      <span className="badge" style={{ backgroundColor: '#f1f5f9', color: '#1e293b', border: '1px solid var(--border-color)' }}>
                        {f.stage}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: 600 }}>{f.count}</td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div style={{ flex: 1, backgroundColor: '#f1f5f9', height: '6px', borderRadius: '2px' }}>
                          <div style={{ width: `${f.percentage}%`, backgroundColor: f.color, height: '100%', borderRadius: '2px' }}></div>
                        </div>
                        <span style={{ fontSize: '11px', color: 'var(--text-muted)', width: '35px', textAlign: 'right' }}>{f.percentage}%</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  );
}
