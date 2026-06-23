'use client';

import React, { useState, useEffect } from 'react';
import { api } from '../../../lib/api';

const PIPELINE_CONFIG: Record<string, { code: string; label: string; color: string }[]> = {
  STUDY_ABROAD: [
    { code: 'NEW_LEAD', label: 'New Lead', color: '#64748b' },
    { code: 'CONTACTED', label: 'Contacted', color: '#0ea5e9' },
    { code: 'COUNSELLING', label: 'Counselling', color: '#6366f1' },
    { code: 'DOCUMENTS_PENDING', label: 'Documents Pending', color: '#f59e0b' },
    { code: 'DOCUMENTS_RECEIVED', label: 'Documents Received', color: '#d97706' },
    { code: 'UNIVERSITY_APPLIED', label: 'University Applied', color: '#3b82f6' },
    { code: 'OFFER_LETTER', label: 'Offer Letter Received', color: '#ec4899' },
    { code: 'VISA_PROCESS', label: 'Visa Process', color: '#f43f5e' },
    { code: 'ADMISSION_CLOSED', label: 'Admission Closed', color: '#10b981' },
    { code: 'LOST', label: 'Lost / Not Interested', color: '#ef4444' },
  ],
  IELTS: [
    { code: 'NEW_LEAD', label: 'New Lead', color: '#64748b' },
    { code: 'CONTACTED', label: 'Contacted', color: '#0ea5e9' },
    { code: 'DEMO_CLASS', label: 'Demo Class', color: '#8b5cf6' },
    { code: 'ENROLLED', label: 'Enrolled', color: '#14b8a6' },
    { code: 'TRAINING', label: 'Training', color: '#6366f1' },
    { code: 'EXAM_BOOKED', label: 'Exam Booked', color: '#ec4899' },
    { code: 'COMPLETED', label: 'Completed', color: '#10b981' },
    { code: 'LOST', label: 'Lost / Not Interested', color: '#ef4444' },
  ],
  PTE: [
    { code: 'NEW_LEAD', label: 'New Lead', color: '#64748b' },
    { code: 'CONTACTED', label: 'Contacted', color: '#0ea5e9' },
    { code: 'DEMO_CLASS', label: 'Demo Class', color: '#8b5cf6' },
    { code: 'ENROLLED', label: 'Enrolled', color: '#14b8a6' },
    { code: 'TRAINING', label: 'Training', color: '#6366f1' },
    { code: 'EXAM_BOOKED', label: 'Exam Booked', color: '#ec4899' },
    { code: 'COMPLETED', label: 'Completed', color: '#10b981' },
    { code: 'LOST', label: 'Lost / Not Interested', color: '#ef4444' },
  ],
  ENGLISH_SPEAKING: [
    { code: 'NEW_LEAD', label: 'New Lead', color: '#64748b' },
    { code: 'CONTACTED', label: 'Contacted', color: '#0ea5e9' },
    { code: 'DEMO_CLASS', label: 'Demo Class', color: '#8b5cf6' },
    { code: 'ENROLLED', label: 'Enrolled', color: '#14b8a6' },
    { code: 'TRAINING', label: 'Training', color: '#6366f1' },
    { code: 'COMPLETED', label: 'Completed', color: '#10b981' },
    { code: 'LOST', label: 'Lost / Not Interested', color: '#ef4444' },
  ],
  COMPUTER_COURSE: [
    { code: 'NEW_LEAD', label: 'New Lead', color: '#64748b' },
    { code: 'CONTACTED', label: 'Contacted', color: '#0ea5e9' },
    { code: 'COUNSELLING', label: 'Counselling', color: '#6366f1' },
    { code: 'DEMO_SESSION', label: 'Demo Session', color: '#8b5cf6' },
    { code: 'ENROLLED', label: 'Enrolled', color: '#14b8a6' },
    { code: 'COURSE_ONGOING', label: 'Course Ongoing', color: '#a855f7' },
    { code: 'COMPLETED', label: 'Completed', color: '#10b981' },
    { code: 'LOST', label: 'Lost / Not Interested', color: '#ef4444' },
  ],
  DIGITAL_MARKETING: [
    { code: 'NEW_LEAD', label: 'New Lead', color: '#64748b' },
    { code: 'CONTACTED', label: 'Contacted', color: '#0ea5e9' },
    { code: 'COUNSELLING', label: 'Counselling', color: '#6366f1' },
    { code: 'DEMO_SESSION', label: 'Demo Session', color: '#8b5cf6' },
    { code: 'ENROLLED', label: 'Enrolled', color: '#14b8a6' },
    { code: 'COURSE_ONGOING', label: 'Course Ongoing', color: '#a855f7' },
    { code: 'COMPLETED', label: 'Completed', color: '#10b981' },
    { code: 'LOST', label: 'Lost / Not Interested', color: '#ef4444' },
  ],
  OTHER: [
    { code: 'NEW_LEAD', label: 'New Lead', color: '#64748b' },
    { code: 'CONTACTED', label: 'Contacted', color: '#0ea5e9' },
    { code: 'COUNSELLING', label: 'Counselling', color: '#6366f1' },
    { code: 'DEMO_SESSION', label: 'Demo Session', color: '#8b5cf6' },
    { code: 'ENROLLED', label: 'Enrolled', color: '#14b8a6' },
    { code: 'COURSE_ONGOING', label: 'Course Ongoing', color: '#a855f7' },
    { code: 'COMPLETED', label: 'Completed', color: '#10b981' },
    { code: 'LOST', label: 'Lost / Not Interested', color: '#ef4444' },
  ]
};

export default function ReportsPage() {
  const [leads, setLeads] = useState<any[]>([]);
  const [uniReports, setUniReports] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<string>('STUDY_ABROAD');
  const [errorMsg, setErrorMsg] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  const loadData = async () => {
    setLoading(true);
    try {
      const [leadsRes, uniReportsRes] = await Promise.all([
        api.get('/api/v1/leads'),
        api.get('/api/v1/applications/dashboard/reports').catch(() => null)
      ]);
      setLeads(leadsRes || []);
      setUniReports(uniReportsRes);
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

  const filteredLeads = leads.filter(l => {
    const matchesCategory = (l.leadCategory || 'STUDY_ABROAD') === selectedCategory;
    const fullName = `${l.firstName} ${l.lastName || ''}`.toLowerCase();
    return matchesCategory && fullName.includes(searchQuery.toLowerCase());
  });
  const totalLeads = filteredLeads.length;

  // 1. Monthly Leads Calculation
  const monthlyMap: Record<string, number> = {};
  filteredLeads.forEach((l) => {
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
  filteredLeads.forEach((l) => {
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
  filteredLeads.forEach((l) => {
    const country = l.studentProfile?.targetCountry || 'Not Specified';
    countryMap[country] = (countryMap[country] || 0) + 1;
  });
  const countryInterest = Object.entries(countryMap).map(([country, count]) => ({
    country,
    count,
    percentage: totalLeads > 0 ? ((count / totalLeads) * 100).toFixed(1) : '0'
  })).sort((a, b) => b.count - a.count);

  // 4. Conversion Funnel Calculation
  const funnelStages = PIPELINE_CONFIG[selectedCategory] || PIPELINE_CONFIG.STUDY_ABROAD;

  const funnelData = funnelStages.map((stage) => {
    const count = filteredLeads.filter((l) => 
      l.status === stage.code || (stage.code === 'ADMISSION_CLOSED' && l.status === 'ENROLLED')
    ).length;
    return {
      stage: stage.label,
      count,
      color: stage.color,
      percentage: totalLeads > 0 ? ((count / totalLeads) * 100).toFixed(1) : '0'
    };
  });

  return (
    <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '20px', paddingBottom: '50px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ fontSize: '15px', fontWeight: 700, margin: 0 }}>Study Metro CRM Operational Reports</h2>
          <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '4px 0 0 0' }}>
            High-density analytics compiled in real time from active candidate records. Total Leads in scope: <strong>{totalLeads}</strong>.
          </p>
        </div>

        {/* Search & Category selector filter */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <input
              type="text"
              placeholder="Search leads by name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                padding: '6px 12px',
                fontSize: '12px',
                borderRadius: '6px',
                border: '1px solid var(--border-color)',
                backgroundColor: '#fff',
                outline: 'none',
                width: '200px'
              }}
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  fontSize: '14px',
                  marginLeft: '-28px',
                  marginRight: '14px',
                  zIndex: 10
                }}
              >
                ✕
              </button>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <label style={{ fontSize: '12px', fontWeight: 600, color: '#475569' }}>Category View:</label>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              style={{
                padding: '6px 12px',
                fontSize: '12px',
                fontWeight: 600,
                borderRadius: '6px',
                border: '1px solid var(--border-color)',
                backgroundColor: '#fff',
                cursor: 'pointer'
              }}
            >
              <option value="STUDY_ABROAD">Study Abroad</option>
              <option value="IELTS">IELTS</option>
              <option value="PTE">PTE</option>
              <option value="ENGLISH_SPEAKING">English Speaking</option>
              <option value="COMPUTER_COURSE">Computer Course</option>
              <option value="DIGITAL_MARKETING">Digital Marketing</option>
              <option value="OTHER">Other</option>
            </select>
          </div>
        </div>
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

      {selectedCategory === 'STUDY_ABROAD' && uniReports && (
        <>
          <div style={{ borderTop: '1px solid var(--border-color)', marginTop: '20px', paddingTop: '20px' }}>
            <h3 style={{ fontSize: '15px', fontWeight: 700, margin: '0 0 4px 0' }}>🎓 University Admissions Analytics</h3>
            <p style={{ fontSize: '11px', color: 'var(--text-muted)', margin: '0 0 16px 0' }}>Detailed metrics regarding shortlist pipelines, offer conversions and visa success rates.</p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px' }}>
            {/* Conversion Metrics */}
            <div style={{ background: '#fff', border: '1px solid var(--border-color)', borderRadius: '4px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <h3 style={{ fontSize: '13px', fontWeight: 700, margin: 0, paddingBottom: '8px', borderBottom: '1px solid var(--border-color)' }}>
                🎯 Funnel Conversion Performance
              </h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div style={{ background: '#f0fdf4', padding: '16px', borderRadius: '4px', border: '1px solid #bbf7d0', textAlign: 'center' }}>
                  <div style={{ fontSize: '11px', color: '#166534', fontWeight: 700 }}>Offer Conversion Rate</div>
                  <div style={{ fontSize: '24px', fontWeight: 800, color: '#16a34a', marginTop: '6px' }}>{uniReports.offerConversionRate}%</div>
                  <div style={{ fontSize: '9px', color: '#15803d', marginTop: '4px' }}>Accepted / Total Received</div>
                </div>
                <div style={{ background: '#ecfdf5', padding: '16px', borderRadius: '4px', border: '1px solid #a7f3d0', textAlign: 'center' }}>
                  <div style={{ fontSize: '11px', color: '#065f46', fontWeight: 700 }}>Visa Approval Rate</div>
                  <div style={{ fontSize: '24px', fontWeight: 800, color: '#059669', marginTop: '6px' }}>{uniReports.visaApprovalRate}%</div>
                  <div style={{ fontSize: '9px', color: '#047857', marginTop: '4px' }}>Approved / Total Decisions</div>
                </div>
              </div>
            </div>

            {/* Top Universities */}
            <div style={{ background: '#fff', border: '1px solid var(--border-color)', borderRadius: '4px', padding: '16px' }}>
              <h3 style={{ fontSize: '13px', fontWeight: 700, marginBottom: '12px', paddingBottom: '8px', borderBottom: '1px solid var(--border-color)' }}>
                🏫 Top Shortlisted Universities
              </h3>
              <table className="dense-table" style={{ width: '100%' }}>
                <thead>
                  <tr>
                    <th>University</th>
                    <th style={{ width: '80px', textAlign: 'right' }}>Shortlists</th>
                  </tr>
                </thead>
                <tbody>
                  {uniReports.topUniversities?.map((u: any, idx: number) => (
                    <tr key={idx}>
                      <td><strong>{u.name}</strong></td>
                      <td style={{ textAlign: 'right', fontWeight: 600 }}>{u.count}</td>
                    </tr>
                  ))}
                  {(!uniReports.topUniversities || uniReports.topUniversities.length === 0) && (
                    <tr>
                      <td colSpan={2} style={{ textAlign: 'center', color: 'var(--text-muted)' }}>No data available</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Applications by Country */}
            <div style={{ background: '#fff', border: '1px solid var(--border-color)', borderRadius: '4px', padding: '16px' }}>
              <h3 style={{ fontSize: '13px', fontWeight: 700, marginBottom: '12px', paddingBottom: '8px', borderBottom: '1px solid var(--border-color)' }}>
                🗺️ Applications by Destination Country
              </h3>
              <table className="dense-table" style={{ width: '100%' }}>
                <thead>
                  <tr>
                    <th>Country</th>
                    <th style={{ width: '80px', textAlign: 'right' }}>Applications</th>
                  </tr>
                </thead>
                <tbody>
                  {uniReports.byCountry?.map((c: any, idx: number) => (
                    <tr key={idx}>
                      <td><strong>{c.name}</strong></td>
                      <td style={{ textAlign: 'right', fontWeight: 600 }}>{c.count}</td>
                    </tr>
                  ))}
                  {(!uniReports.byCountry || uniReports.byCountry.length === 0) && (
                    <tr>
                      <td colSpan={2} style={{ textAlign: 'center', color: 'var(--text-muted)' }}>No data available</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Applications by Intake */}
            <div style={{ background: '#fff', border: '1px solid var(--border-color)', borderRadius: '4px', padding: '16px' }}>
              <h3 style={{ fontSize: '13px', fontWeight: 700, marginBottom: '12px', paddingBottom: '8px', borderBottom: '1px solid var(--border-color)' }}>
                📅 Applications by Intake Period
              </h3>
              <table className="dense-table" style={{ width: '100%' }}>
                <thead>
                  <tr>
                    <th>Intake</th>
                    <th style={{ width: '80px', textAlign: 'right' }}>Applications</th>
                  </tr>
                </thead>
                <tbody>
                  {uniReports.byIntake?.map((i: any, idx: number) => (
                    <tr key={idx}>
                      <td><strong>{i.name}</strong></td>
                      <td style={{ textAlign: 'right', fontWeight: 600 }}>{i.count}</td>
                    </tr>
                  ))}
                  {(!uniReports.byIntake || uniReports.byIntake.length === 0) && (
                    <tr>
                      <td colSpan={2} style={{ textAlign: 'center', color: 'var(--text-muted)' }}>No data available</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

    </div>
  );
}
