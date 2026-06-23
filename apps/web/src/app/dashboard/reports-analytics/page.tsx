'use client';

import React, { useState, useEffect } from 'react';
import { api } from '../../../lib/api';

type TabType = 'overview' | 'sources' | 'countries' | 'followups' | 'documents' | 'comms' | 'brochures' | 'funnel' | 'revenue' | 'counsellors';

export default function ReportsAnalyticsPage() {
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  
  // Date filter state
  const [filterType, setFilterType] = useState<'today' | '7days' | '30days' | 'month' | 'custom'>('30days');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');

  // Loaded analytics data states
  const [summary, setSummary] = useState<any>(null);
  const [sources, setSources] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [countries, setCountries] = useState<any[]>([]);
  const [followups, setFollowups] = useState<any>(null);
  const [documents, setDocuments] = useState<any>(null);
  const [comms, setComms] = useState<any>(null);
  const [brochures, setBrochures] = useState<any>(null);
  const [funnel, setFunnel] = useState<any[]>([]);
  const [revenue, setRevenue] = useState<any>(null);
  const [counsellors, setCounsellors] = useState<any[]>([]);
  const [leadAging, setLeadAging] = useState<any[]>([]);

  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [toasts, setToasts] = useState<{ id: string; type: 'success' | 'error'; message: string }[]>([]);

  const addToast = (type: 'success' | 'error', message: string) => {
    const id = Math.random().toString(36).substr(2, 9);
    setToasts((prev) => [...prev, { id, type, message }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  };

  // Helper to compute date range parameters
  const getDateRange = () => {
    const end = new Date();
    const start = new Date();
    
    if (filterType === 'today') {
      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);
    } else if (filterType === '7days') {
      start.setDate(end.getDate() - 7);
    } else if (filterType === '30days') {
      start.setDate(end.getDate() - 30);
    } else if (filterType === 'month') {
      start.setDate(1);
      start.setHours(0, 0, 0, 0);
    } else if (filterType === 'custom') {
      return {
        startDate: customStart ? new Date(customStart).toISOString() : undefined,
        endDate: customEnd ? new Date(customEnd).toISOString() : undefined
      };
    }

    return {
      startDate: start.toISOString(),
      endDate: end.toISOString()
    };
  };

  // On-demand data loader based on active tab
  const fetchActiveTabMetrics = async () => {
    const range = getDateRange();
    const query = new URLSearchParams();
    if (range.startDate) query.append('startDate', range.startDate);
    if (range.endDate) query.append('endDate', range.endDate);
    const queryString = query.toString() ? `?${query.toString()}` : '';

    setLoading(true);
    try {
      if (activeTab === 'overview') {
        const [sumData, agingData] = await Promise.all([
          api.get(`/api/v1/analytics/summary${queryString}`),
          api.get(`/api/v1/analytics/lead-aging${queryString}`)
        ]);
        setSummary(sumData);
        setLeadAging(agingData || []);
      } else if (activeTab === 'sources') {
        const [srcData, catData] = await Promise.all([
          api.get(`/api/v1/analytics/lead-sources${queryString}`),
          api.get(`/api/v1/analytics/categories${queryString}`)
        ]);
        setSources(srcData || []);
        setCategories(catData || []);
      } else if (activeTab === 'countries') {
        const data = await api.get(`/api/v1/analytics/countries${queryString}`);
        setCountries(data || []);
      } else if (activeTab === 'followups') {
        const data = await api.get(`/api/v1/analytics/followups${queryString}`);
        setFollowups(data);
      } else if (activeTab === 'documents') {
        const data = await api.get(`/api/v1/analytics/documents${queryString}`);
        setDocuments(data);
      } else if (activeTab === 'comms') {
        const data = await api.get(`/api/v1/analytics/communications${queryString}`);
        setComms(data);
      } else if (activeTab === 'brochures') {
        const data = await api.get(`/api/v1/analytics/brochures${queryString}`);
        setBrochures(data);
      } else if (activeTab === 'funnel') {
        const data = await api.get(`/api/v1/analytics/funnel${queryString}`);
        setFunnel(data || []);
      } else if (activeTab === 'revenue') {
        const data = await api.get(`/api/v1/analytics/revenue${queryString}`);
        setRevenue(data);
      } else if (activeTab === 'counsellors') {
        const data = await api.get(`/api/v1/analytics/counsellors${queryString}`);
        setCounsellors(data || []);
      }
    } catch (err: any) {
      console.error(err);
      addToast('error', 'Failed to retrieve analytics metrics.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchActiveTabMetrics();
  }, [activeTab, filterType, customStart, customEnd]);

  // Server-Side Export Trigger
  const handleExport = async (format: 'csv' | 'excel' | 'pdf') => {
    const range = getDateRange();
    setExporting(true);
    try {
      const res = await api.post(`/api/v1/analytics/exports/${activeTab}`, {
        format,
        startDate: range.startDate,
        endDate: range.endDate
      });

      if (res && res.downloadUrl) {
        addToast('success', `${format.toUpperCase()} export generated! Downloading file...`);
        // Trigger file download stream
        window.location.href = res.downloadUrl;
      }
    } catch (err: any) {
      console.error(err);
      addToast('error', err.message || 'Export compilation failed');
    } finally {
      setExporting(false);
    }
  };

  return (
    <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Header and Controls */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ fontSize: '20px', fontWeight: 700, margin: 0 }}>Reports & Business Intelligence</h1>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: '4px 0 0 0' }}>
            Compiled aggregations and candidate progression rates in real-time.
          </p>
        </div>

        {/* Date Filter Panel */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          <select
            className="form-control"
            value={filterType}
            onChange={(e) => setFilterType(e.target.value as any)}
            style={{ width: '150px' }}
          >
            <option value="today">Today</option>
            <option value="7days">Last 7 Days</option>
            <option value="30days">Last 30 Days</option>
            <option value="month">This Month</option>
            <option value="custom">Custom Range</option>
          </select>

          {filterType === 'custom' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <input
                type="date"
                className="form-control"
                value={customStart}
                onChange={(e) => setCustomStart(e.target.value)}
                style={{ width: '135px', padding: '6px' }}
              />
              <span style={{ fontSize: '12px' }}>to</span>
              <input
                type="date"
                className="form-control"
                value={customEnd}
                onChange={(e) => setCustomEnd(e.target.value)}
                style={{ width: '135px', padding: '6px' }}
              />
            </div>
          )}

          {/* Export options */}
          <div style={{ display: 'inline-flex', gap: '6px' }}>
            <button className="btn btn-outline btn-sm" onClick={() => handleExport('csv')} disabled={exporting}>
              📤 CSV
            </button>
            <button className="btn btn-outline btn-sm" onClick={() => handleExport('excel')} disabled={exporting}>
              📊 Excel
            </button>
            <button className="btn btn-outline btn-sm" onClick={() => handleExport('pdf')} disabled={exporting}>
              📄 PDF
            </button>
          </div>
        </div>
      </div>

      {/* Tabs list */}
      <div style={{ display: 'flex', gap: '4px', borderBottom: '1px solid var(--border-color)', overflowX: 'auto', paddingBottom: '4px' }}>
        {[
          { id: 'overview', label: '📊 Summary' },
          { id: 'sources', label: '🔌 Sources & Course' },
          { id: 'countries', label: '🌐 Countries' },
          { id: 'followups', label: '📅 Followups' },
          { id: 'documents', label: '📄 Documents' },
          { id: 'comms', label: '💬 Comms' },
          { id: 'brochures', label: '📚 Brochures' },
          { id: 'funnel', label: '⏳ Funnel' },
          { id: 'revenue', label: '💰 Revenue' },
          { id: 'counsellors', label: '🧑‍💼 Counsellors' }
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id as TabType)}
            style={{
              padding: '8px 16px',
              border: 'none',
              background: 'none',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              borderBottom: activeTab === t.id ? '2px solid var(--primary-color)' : 'none',
              color: activeTab === t.id ? 'var(--primary-color)' : 'var(--text-muted)'
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Loading state indicator */}
      {loading ? (
        <div style={{ padding: '40px', textAlign: 'center', fontWeight: 600, color: 'var(--text-muted)' }}>
          Compiling aggregate data from database...
        </div>
      ) : (
        <div style={{ minHeight: '400px' }}>
          
          {/* Summary Tab */}
          {activeTab === 'overview' && summary && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              {/* Executive Summary Cards */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '16px' }}>
                {[
                  { label: 'Total Leads', val: summary.totalLeads, color: '#3b82f6', icon: '👥' },
                  { label: 'Active Leads', val: summary.activeLeads, color: '#0ea5e9', icon: '⚡' },
                  { label: 'Converted Leads', val: summary.convertedLeads, color: '#10b981', icon: '🏆' },
                  { label: 'Applications Sent', val: summary.applications, color: '#6366f1', icon: '🎓' },
                  { label: 'Visa Approved', val: summary.visaApproved, color: '#14b8a6', icon: '✈️' },
                  { label: 'Pending Docs', val: summary.documentsPending, color: '#f59e0b', icon: '📄' },
                  { label: 'Today\'s Followups', val: summary.followupsDueToday, color: '#ec4899', icon: '📅' },
                  { label: 'Emails Dispatched', val: summary.emailsSent, color: '#8b5cf6', icon: '✉️' },
                  { label: 'Brochures Sent', val: summary.brochuresSent, color: '#f43f5e', icon: '📚' }
                ].map((card, idx) => (
                  <div key={idx} style={{
                    padding: '16px',
                    backgroundColor: '#fff',
                    border: '1px solid var(--border-color)',
                    borderRadius: '6px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}>
                    <div>
                      <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{card.label}</span>
                      <div style={{ fontSize: '20px', fontWeight: 700, marginTop: '4px', color: card.color }}>
                        {card.val}
                      </div>
                    </div>
                    <span style={{ fontSize: '24px' }}>{card.icon}</span>
                  </div>
                ))}
              </div>

              {/* Lead Aging report */}
              <div style={{ backgroundColor: '#fff', border: '1px solid var(--border-color)', borderRadius: '6px', padding: '20px' }}>
                <h3 style={{ fontSize: '14px', fontWeight: 700, margin: '0 0 12px 0' }}>⏳ Lead Aging & Neglect analysis</h3>
                <div style={{ overflowX: 'auto' }}>
                  <table className="table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--border-color)', backgroundColor: '#f8fafc' }}>
                        <th style={{ padding: '10px 12px', fontSize: '12px', color: 'var(--text-muted)' }}>Age Bracket</th>
                        <th style={{ padding: '10px 12px', fontSize: '12px', color: 'var(--text-muted)' }}>Lead Count</th>
                        <th style={{ padding: '10px 12px', fontSize: '12px', color: 'var(--text-muted)' }}>Pending Followups</th>
                        <th style={{ padding: '10px 12px', fontSize: '12px', color: 'var(--text-muted)' }}>Overdue Followups</th>
                      </tr>
                    </thead>
                    <tbody>
                      {leadAging.map((age, idx) => (
                        <tr key={idx} style={{ borderBottom: '1px solid var(--border-color)' }}>
                          <td style={{ padding: '10px 12px', fontSize: '13px', fontWeight: 600 }}>{age.range}</td>
                          <td style={{ padding: '10px 12px', fontSize: '13px' }}>{age.count}</td>
                          <td style={{ padding: '10px 12px', fontSize: '13px' }}>{age.pending}</td>
                          <td style={{ padding: '10px 12px', fontSize: '13px', color: age.overdue > 0 ? '#ef4444' : 'inherit', fontWeight: age.overdue > 0 ? 600 : 'normal' }}>
                            {age.overdue}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* Sources and Categories Tab */}
          {activeTab === 'sources' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', minWidth: 0 }}>
              
              {/* Lead sources list */}
              <div style={{ backgroundColor: '#fff', border: '1px solid var(--border-color)', borderRadius: '6px', padding: '20px' }}>
                <h3 style={{ fontSize: '14px', fontWeight: 700, margin: '0 0 12px 0' }}>🔌 Lead Acquisition Channels</h3>
                <table className="table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--border-color)' }}>
                      <th style={{ padding: '8px', fontSize: '12px', color: 'var(--text-muted)' }}>Source</th>
                      <th style={{ padding: '8px', fontSize: '12px', color: 'var(--text-muted)' }}>Leads</th>
                      <th style={{ padding: '8px', fontSize: '12px', color: 'var(--text-muted)' }}>Conversion %</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sources.map((s, idx) => (
                      <tr key={idx} style={{ borderBottom: '1px solid var(--border-color)' }}>
                        <td style={{ padding: '8px', fontSize: '13px', fontWeight: 600 }}>{s.source}</td>
                        <td style={{ padding: '8px', fontSize: '13px' }}>{s.count}</td>
                        <td style={{ padding: '8px', fontSize: '13px' }}>{s.conversionRate}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Categories list */}
              <div style={{ backgroundColor: '#fff', border: '1px solid var(--border-color)', borderRadius: '6px', padding: '20px' }}>
                <h3 style={{ fontSize: '14px', fontWeight: 700, margin: '0 0 12px 0' }}>🎓 Course & Category Performance</h3>
                <table className="table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--border-color)' }}>
                      <th style={{ padding: '8px', fontSize: '12px', color: 'var(--text-muted)' }}>Category</th>
                      <th style={{ padding: '8px', fontSize: '12px', color: 'var(--text-muted)' }}>Leads</th>
                      <th style={{ padding: '8px', fontSize: '12px', color: 'var(--text-muted)' }}>Conversion %</th>
                      <th style={{ padding: '8px', fontSize: '12px', color: 'var(--text-muted)' }}>Revenue-Ready</th>
                    </tr>
                  </thead>
                  <tbody>
                    {categories.map((c, idx) => (
                      <tr key={idx} style={{ borderBottom: '1px solid var(--border-color)' }}>
                        <td style={{ padding: '8px', fontSize: '13px', fontWeight: 600 }}>{c.category}</td>
                        <td style={{ padding: '8px', fontSize: '13px' }}>{c.count}</td>
                        <td style={{ padding: '8px', fontSize: '13px' }}>{c.conversionRate}%</td>
                        <td style={{ padding: '8px', fontSize: '13px' }}>{c.revenueReadyLeads}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Countries Tab */}
          {activeTab === 'countries' && (
            <div style={{ backgroundColor: '#fff', border: '1px solid var(--border-color)', borderRadius: '6px', padding: '20px' }}>
              <h3 style={{ fontSize: '14px', fontWeight: 700, margin: '0 0 12px 0' }}>🌐 Target Country Metrics (Study Abroad)</h3>
              <table className="table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--border-color)' }}>
                    <th style={{ padding: '10px', fontSize: '12px', color: 'var(--text-muted)' }}>Country</th>
                    <th style={{ padding: '10px', fontSize: '12px', color: 'var(--text-muted)' }}>Interested Leads</th>
                    <th style={{ padding: '10px', fontSize: '12px', color: 'var(--text-muted)' }}>Applications</th>
                    <th style={{ padding: '10px', fontSize: '12px', color: 'var(--text-muted)' }}>Offer Letters</th>
                    <th style={{ padding: '10px', fontSize: '12px', color: 'var(--text-muted)' }}>Visa Grants</th>
                  </tr>
                </thead>
                <tbody>
                  {countries.length === 0 ? (
                    <tr>
                      <td colSpan={5} style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)' }}>
                        No country interest metrics logged in this date range.
                      </td>
                    </tr>
                  ) : (
                    countries.map((c, idx) => (
                      <tr key={idx} style={{ borderBottom: '1px solid var(--border-color)' }}>
                        <td style={{ padding: '10px', fontSize: '13px', fontWeight: 600 }}>{c.country}</td>
                        <td style={{ padding: '10px', fontSize: '13px' }}>{c.totalInterested}</td>
                        <td style={{ padding: '10px', fontSize: '13px' }}>{c.applications}</td>
                        <td style={{ padding: '10px', fontSize: '13px' }}>{c.offers}</td>
                        <td style={{ padding: '10px', fontSize: '13px', color: '#10b981', fontWeight: 600 }}>{c.visas}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* Followups Tab */}
          {activeTab === 'followups' && followups && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
              <div style={{ backgroundColor: '#fff', border: '1px solid var(--border-color)', borderRadius: '6px', padding: '20px' }}>
                <h3 style={{ fontSize: '14px', fontWeight: 700, margin: '0 0 16px 0' }}>📅 Follow-up Status Breakout</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {[
                    { label: 'Scheduled / Pending', count: followups.scheduled, color: '#3b82f6' },
                    { label: 'Completed successfully', count: followups.completed, color: '#10b981' },
                    { label: 'Cancelled / Missed', count: followups.missed, color: '#94a3b8' },
                    { label: 'Overdue (Past Date)', count: followups.overdue, color: '#ef4444' }
                  ].map((item, idx) => (
                    <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '8px', borderBottom: '1px solid var(--background-light)' }}>
                      <span style={{ fontSize: '13px', fontWeight: 600 }}>{item.label}</span>
                      <span style={{ fontSize: '13px', fontWeight: 700, color: item.color }}>{item.count}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* SVG Charts visual representation */}
              <div style={{ backgroundColor: '#fff', border: '1px solid var(--border-color)', borderRadius: '6px', padding: '20px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <h3 style={{ fontSize: '14px', fontWeight: 700, margin: '0 0 16px 0', alignSelf: 'flex-start' }}>📊 Visual Distribution</h3>
                <svg width="200" height="200" viewBox="0 0 200 200">
                  <circle cx="100" cy="100" r="80" fill="none" stroke="#f1f5f9" strokeWidth="20" />
                  {/* Simplistic mock representation using stroke offsets */}
                  <circle cx="100" cy="100" r="80" fill="none" stroke="#10b981" strokeWidth="20"
                    strokeDasharray="502"
                    strokeDashoffset={502 - (502 * (followups.completed / (followups.completed + followups.scheduled + 1)))}
                  />
                </svg>
                <div style={{ display: 'flex', gap: '12px', marginTop: '12px', fontSize: '11px' }}>
                  <span>🟢 Completed</span>
                  <span>⚪ Remaining</span>
                </div>
              </div>
            </div>
          )}

          {/* Documents Tab */}
          {activeTab === 'documents' && documents && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
              <div style={{ backgroundColor: '#fff', border: '1px solid var(--border-color)', borderRadius: '6px', padding: '20px' }}>
                <h3 style={{ fontSize: '14px', fontWeight: 700, margin: '0 0 16px 0' }}>📄 Document Auditing Status</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {[
                    { label: 'Pending Verification', count: documents.pending, color: '#f59e0b' },
                    { label: 'Verified & Approved', count: documents.verified, color: '#10b981' },
                    { label: 'Rejected Documents', count: documents.rejected, color: '#ef4444' }
                  ].map((item, idx) => (
                    <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '8px', borderBottom: '1px solid var(--background-light)' }}>
                      <span style={{ fontSize: '13px', fontWeight: 600 }}>{item.label}</span>
                      <span style={{ fontSize: '13px', fontWeight: 700, color: item.color }}>{item.count}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ backgroundColor: '#fff', border: '1px solid var(--border-color)', borderRadius: '6px', padding: '20px', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}>
                <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Average Student Document Readiness</span>
                <div style={{ fontSize: '32px', fontWeight: 800, color: '#10b981', marginTop: '8px' }}>
                  {documents.avgReadinessScore}%
                </div>
                <div style={{ width: '80%', height: '8px', backgroundColor: '#e2e8f0', borderRadius: '4px', marginTop: '12px', overflow: 'hidden' }}>
                  <div style={{ width: `${documents.avgReadinessScore}%`, height: '100%', backgroundColor: '#10b981' }} />
                </div>
              </div>
            </div>
          )}

          {/* Communications Tab */}
          {activeTab === 'comms' && comms && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
                <div style={{ backgroundColor: '#fff', border: '1px solid var(--border-color)', borderRadius: '6px', padding: '16px' }}>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Emails Dispatched</span>
                  <div style={{ fontSize: '20px', fontWeight: 700, color: '#10b981', marginTop: '4px' }}>{comms.sent}</div>
                </div>
                <div style={{ backgroundColor: '#fff', border: '1px solid var(--border-color)', borderRadius: '6px', padding: '16px' }}>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Delivery Failures</span>
                  <div style={{ fontSize: '20px', fontWeight: 700, color: '#ef4444', marginTop: '4px' }}>{comms.failed}</div>
                </div>
                <div style={{ backgroundColor: '#fff', border: '1px solid var(--border-color)', borderRadius: '6px', padding: '16px' }}>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Queue Pending</span>
                  <div style={{ fontSize: '20px', fontWeight: 700, color: '#f59e0b', marginTop: '4px' }}>{comms.pending}</div>
                </div>
              </div>

              <div style={{ backgroundColor: '#fff', border: '1px solid var(--border-color)', borderRadius: '6px', padding: '20px' }}>
                <h3 style={{ fontSize: '14px', fontWeight: 700, margin: '0 0 12px 0' }}>💬 Trigger Template Usage</h3>
                <table className="table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--border-color)' }}>
                      <th style={{ padding: '8px', fontSize: '12px', color: 'var(--text-muted)' }}>Template Name</th>
                      <th style={{ padding: '8px', fontSize: '12px', color: 'var(--text-muted)' }}>Usage Count</th>
                    </tr>
                  </thead>
                  <tbody>
                    {comms.templateUsage.length === 0 ? (
                      <tr>
                        <td colSpan={2} style={{ padding: '12px', textAlign: 'center', color: 'var(--text-muted)' }}>
                          No template usages recorded in this period.
                        </td>
                      </tr>
                    ) : (
                      comms.templateUsage.map((u: any, idx: number) => (
                        <tr key={idx} style={{ borderBottom: '1px solid var(--border-color)' }}>
                          <td style={{ padding: '8px', fontSize: '13px', fontWeight: 600 }}>{u.templateName}</td>
                          <td style={{ padding: '8px', fontSize: '13px' }}>{u.count}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Brochures Tab */}
          {activeTab === 'brochures' && brochures && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '16px' }}>
                <div style={{ backgroundColor: '#fff', border: '1px solid var(--border-color)', borderRadius: '6px', padding: '16px' }}>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Sent Brochures</span>
                  <div style={{ fontSize: '20px', fontWeight: 700, marginTop: '4px', color: 'var(--text-color)' }}>{brochures.sent}</div>
                </div>
                <div style={{ backgroundColor: '#fff', border: '1px solid var(--border-color)', borderRadius: '6px', padding: '16px' }}>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Opened count</span>
                  <div style={{ fontSize: '20px', fontWeight: 700, marginTop: '4px', color: '#3b82f6' }}>{brochures.opened}</div>
                </div>
                <div style={{ backgroundColor: '#fff', border: '1px solid var(--border-color)', borderRadius: '6px', padding: '16px' }}>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Downloads</span>
                  <div style={{ fontSize: '20px', fontWeight: 700, marginTop: '4px', color: '#10b981' }}>{brochures.downloads}</div>
                </div>
                <div style={{ backgroundColor: '#fff', border: '1px solid var(--border-color)', borderRadius: '6px', padding: '16px' }}>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Avg Read Time</span>
                  <div style={{ fontSize: '20px', fontWeight: 700, marginTop: '4px', color: 'var(--text-color)' }}>{brochures.avgReadingTime}s</div>
                </div>
                <div style={{ backgroundColor: '#fff', border: '1px solid var(--border-color)', borderRadius: '6px', padding: '16px' }}>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Avg Completion</span>
                  <div style={{ fontSize: '20px', fontWeight: 700, marginTop: '4px', color: '#14b8a6' }}>{brochures.completionPercentage}%</div>
                </div>
              </div>

              {/* Lead engagement label break down */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
                <div style={{ backgroundColor: '#fff', border: '1px solid var(--border-color)', borderRadius: '6px', padding: '20px' }}>
                  <h3 style={{ fontSize: '14px', fontWeight: 700, margin: '0 0 16px 0' }}>🔥 Engagement Temperature Split</h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {[
                      { label: '🔴 Hot (Score >= 70)', count: brochures.hotLeads, color: '#ef4444' },
                      { label: '🟡 Warm (Score 30-69)', count: brochures.warmLeads, color: '#f59e0b' },
                      { label: '🔵 Cold (Score < 30)', count: brochures.coldLeads, color: '#3b82f6' }
                    ].map((item, idx) => (
                      <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '8px', borderBottom: '1px solid var(--background-light)' }}>
                        <span style={{ fontSize: '13px', fontWeight: 600 }}>{item.label}</span>
                        <span style={{ fontSize: '13px', fontWeight: 700, color: item.color }}>{item.count} leads</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Funnel Tab */}
          {activeTab === 'funnel' && (
            <div style={{ backgroundColor: '#fff', border: '1px solid var(--border-color)', borderRadius: '6px', padding: '24px' }}>
              <h3 style={{ fontSize: '14px', fontWeight: 700, margin: '0 0 20px 0' }}>⏳ Conversion Funnel Progression</h3>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', maxWidth: '600px', margin: '0 auto' }}>
                {funnel.map((item, idx) => (
                  <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    {/* Stage Label */}
                    <div style={{ width: '160px', fontSize: '12px', fontWeight: 600, textAlign: 'right' }}>{item.stage}</div>
                    
                    {/* Funnel Bar */}
                    <div style={{ flex: 1, height: '32px', backgroundColor: '#f1f5f9', borderRadius: '4px', overflow: 'hidden', position: 'relative' }}>
                      <div style={{
                        width: `${item.pct}%`,
                        height: '100%',
                        backgroundColor: '#6366f1',
                        opacity: 1 - idx * 0.1, // step gradient opacity
                        transition: 'width 0.5s ease-out'
                      }} />
                      <div style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '0 12px',
                        fontSize: '11px',
                        fontWeight: 700,
                        color: item.pct > 40 ? '#fff' : '#1e293b'
                      }}>
                        <span>{item.count} leads</span>
                        <span>{item.pct}%</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Revenue Tab */}
          {activeTab === 'revenue' && revenue && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              <div style={{ backgroundColor: '#fff', border: '1px solid var(--border-color)', borderRadius: '6px', padding: '24px', textAlign: 'center' }}>
                <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Estimated Total Enrolled Revenue Value</span>
                <div style={{ fontSize: '36px', fontWeight: 800, color: '#10b981', marginTop: '8px' }}>
                  ₹{revenue.totalRevenue.toLocaleString()} INR
                </div>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Calculated from visa grants and training package enrollments</span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
                <div style={{ backgroundColor: '#fff', border: '1px solid var(--border-color)', borderRadius: '6px', padding: '20px' }}>
                  <h3 style={{ fontSize: '14px', fontWeight: 700, margin: '0 0 16px 0' }}>💰 Revenue Stream Breakdown</h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {[
                      { label: 'Study Abroad (Approved Visas)', val: revenue.studyAbroadRevenue },
                      { label: 'IELTS Course Enrollments', val: revenue.ieltsRevenue },
                      { label: 'PTE Course Enrollments', val: revenue.pteRevenue },
                      { label: 'Computer Courses', val: revenue.computerCourseRevenue },
                      { label: 'Digital Marketing package', val: revenue.digitalMarketingRevenue },
                      { label: 'Other courses', val: revenue.otherRevenue }
                    ].map((item, idx) => (
                      <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '8px', borderBottom: '1px solid var(--background-light)' }}>
                        <span style={{ fontSize: '13px', fontWeight: 600 }}>{item.label}</span>
                        <span style={{ fontSize: '13px', fontWeight: 700, color: '#10b981' }}>₹{item.val.toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Counsellors Tab */}
          {activeTab === 'counsellors' && (
            <div style={{ backgroundColor: '#fff', border: '1px solid var(--border-color)', borderRadius: '6px', padding: '20px' }}>
              <h3 style={{ fontSize: '14px', fontWeight: 700, margin: '0 0 12px 0' }}>🧑‍💼 Counselor Performance Leaderboard</h3>
              <div style={{ overflowX: 'auto' }}>
                <table className="table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--border-color)', backgroundColor: '#f8fafc' }}>
                      <th style={{ padding: '10px 12px', fontSize: '12px', color: 'var(--text-muted)' }}>Counsellor</th>
                      <th style={{ padding: '10px 12px', fontSize: '12px', color: 'var(--text-muted)' }}>Assigned</th>
                      <th style={{ padding: '10px 12px', fontSize: '12px', color: 'var(--text-muted)' }}>Active</th>
                      <th style={{ padding: '10px 12px', fontSize: '12px', color: 'var(--text-muted)' }}>Converted</th>
                      <th style={{ padding: '10px 12px', fontSize: '12px', color: 'var(--text-muted)' }}>Applications</th>
                      <th style={{ padding: '10px 12px', fontSize: '12px', color: 'var(--text-muted)' }}>Offers</th>
                      <th style={{ padding: '10px 12px', fontSize: '12px', color: 'var(--text-muted)' }}>Visas</th>
                      <th style={{ padding: '10px 12px', fontSize: '12px', color: 'var(--text-muted)' }}>Conversion Rate</th>
                    </tr>
                  </thead>
                  <tbody>
                    {counsellors.length === 0 ? (
                      <tr>
                        <td colSpan={8} style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)' }}>
                          No active counsellor records or assignments found.
                        </td>
                      </tr>
                    ) : (
                      counsellors.map((c, idx) => (
                        <tr key={idx} style={{ borderBottom: '1px solid var(--border-color)' }}>
                          <td style={{ padding: '10px 12px', fontSize: '13px', fontWeight: 600 }}>{c.name}</td>
                          <td style={{ padding: '10px 12px', fontSize: '13px' }}>{c.assignedLeads}</td>
                          <td style={{ padding: '10px 12px', fontSize: '13px' }}>{c.activeLeads}</td>
                          <td style={{ padding: '10px 12px', fontSize: '13px' }}>{c.convertedLeads}</td>
                          <td style={{ padding: '10px 12px', fontSize: '13px' }}>{c.applicationsSubmitted}</td>
                          <td style={{ padding: '10px 12px', fontSize: '13px' }}>{c.offerLetters}</td>
                          <td style={{ padding: '10px 12px', fontSize: '13px' }}>{c.visaApproved}</td>
                          <td style={{ padding: '10px 12px', fontSize: '13px', color: '#10b981', fontWeight: 600 }}>{c.conversionRate}%</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

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
