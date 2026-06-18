'use client';

import React, { useState, useEffect } from 'react';
import { api } from '../../../lib/api';

export default function ActivitiesPage() {
  const [activities, setActivities] = useState<any[]>([]);
  const [leads, setLeads] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters state
  const [leadFilter, setLeadFilter] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');

  const fetchLeadsMetadata = async () => {
    try {
      const res = await api.get('/api/v1/leads');
      setLeads(res || []);
    } catch (err) {
      console.error('Failed to load leads for filter', err);
    }
  };

  const fetchActivities = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (leadFilter) params.set('leadId', leadFilter);
      if (dateFilter) params.set('date', dateFilter);
      if (typeFilter) params.set('activityType', typeFilter);

      const res = await api.get(`/api/v1/leads/meta/activities?${params.toString()}`);
      setActivities(res || []);
    } catch (err) {
      console.error('Failed to load activities', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLeadsMetadata();
  }, []);

  useEffect(() => {
    fetchActivities();
  }, [leadFilter, dateFilter, typeFilter]);

  return (
    <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div>
        <h2 style={{ fontSize: '15px', fontWeight: 700 }}>Global Activity Log Ledger</h2>
        <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
          Chronological audit of candidate pipeline movements, notes addition, and system-wide state changes.
        </p>
      </div>

      {/* Filter Matrix */}
      <section style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center', background: '#fff', padding: '12px', borderRadius: '4px', border: '1px solid var(--border-color)' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <label style={{ fontSize: '10px', fontWeight: 600, color: 'var(--text-muted)' }}>Filter by Student</label>
          <select className="form-control" style={{ width: '180px' }} value={leadFilter} onChange={(e) => setLeadFilter(e.target.value)}>
            <option value="">-- All Candidates --</option>
            {leads.map(l => (
              <option key={l.id} value={l.id}>{l.firstName} {l.lastName || ''}</option>
            ))}
          </select>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <label style={{ fontSize: '10px', fontWeight: 600, color: 'var(--text-muted)' }}>Filter by Date</label>
          <input type="date" className="form-control" value={dateFilter} onChange={(e) => setDateFilter(e.target.value)} />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <label style={{ fontSize: '10px', fontWeight: 600, color: 'var(--text-muted)' }}>Filter by Activity Type</label>
          <select className="form-control" style={{ width: '180px' }} value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
            <option value="">-- All Activity Types --</option>
            <option value="LEAD_CREATED">Lead Created</option>
            <option value="STATUS_CHANGE">Status Changed</option>
            <option value="NOTE_ADDED">Counselor Note Added</option>
            <option value="DOCUMENT_UPLOADED">Document Uploaded</option>
            <option value="DOCUMENT_APPROVED">Document Approved</option>
            <option value="DOCUMENT_REJECTED">Document Rejected</option>
            <option value="FOLLOWUP_SCHEDULED">Followup Scheduled</option>
            <option value="FOLLOWUP_STATUS_CHANGE">Followup Updated</option>
            <option value="FOLLOWUP_RESCHEDULED">Followup Rescheduled</option>
            <option value="LEAD_BULK_ASSIGNED">Bulk Assigned</option>
            <option value="LEAD_UPDATE">Lead Updated</option>
          </select>
        </div>

        {(leadFilter || dateFilter || typeFilter) && (
          <button
            className="btn btn-sm"
            style={{ alignSelf: 'flex-end', height: '28px' }}
            onClick={() => { setLeadFilter(''); setDateFilter(''); setTypeFilter(''); }}
          >
            Clear Filters
          </button>
        )}
      </section>

      {/* Activities Ledger Feed */}
      <div className="table-container" style={{ margin: 0 }}>
        {loading ? (
          <div style={{ padding: '40px', textAlign: 'center', fontWeight: 600 }}>
            Querying activity logs ledger database...
          </div>
        ) : activities.length === 0 ? (
          <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
            No activities recorded matching the selected filter parameters.
          </div>
        ) : (
          <table className="dense-table">
            <thead>
              <tr>
                <th>Date & Time</th>
                <th>Activity Category</th>
                <th>Description Log</th>
                <th>Related Student Candidate</th>
                <th>Actor User</th>
              </tr>
            </thead>
            <tbody>
              {activities.map((act) => (
                <tr key={act.id}>
                  <td>
                    {new Date(act.createdAt).toLocaleString()}
                  </td>
                  <td>
                    <span className="badge" style={{ backgroundColor: '#f1f5f9', color: '#1e293b', border: '1px solid var(--border-color)' }}>
                      {act.type.replace(/_/g, ' ')}
                    </span>
                  </td>
                  <td>
                    <div style={{ fontWeight: 500 }}>{act.description}</div>
                  </td>
                  <td>
                    {act.lead ? (
                      <a href={`/dashboard/leads/${act.lead.id}`} style={{ color: 'var(--primary-color)', fontWeight: 600, textDecoration: 'none' }}>
                        {act.lead.firstName} {act.lead.lastName || ''}
                      </a>
                    ) : (
                      <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>—</span>
                    )}
                  </td>
                  <td>
                    {act.actor ? (
                      <span>{act.actor.firstName} {act.actor.lastName}</span>
                    ) : (
                      <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>System Event</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
