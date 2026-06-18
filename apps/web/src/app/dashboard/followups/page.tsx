'use client';

import React, { useState, useEffect } from 'react';
import { api } from '../../../lib/api';

export default function FollowupsPage() {
  const [followups, setFollowups] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [dateFilter, setDateFilter] = useState<'ALL' | 'TODAY' | 'TOMORROW' | 'WEEK' | 'OVERDUE'>('ALL');
  
  // Reschedule modal state
  const [showRescheduleModal, setShowRescheduleModal] = useState(false);
  const [rescheduleId, setRescheduleId] = useState<string | null>(null);
  const [rescheduleDate, setRescheduleDate] = useState('');
  const [rescheduleNotes, setRescheduleNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const fetchFollowups = async () => {
    setLoading(true);
    try {
      // Use the global followups endpoint so we fetch all organization activities
      const res = await api.get('/api/v1/followups');
      setFollowups(res || []);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to load followups.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFollowups();
  }, []);

  const handleComplete = async (id: string) => {
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      await api.patch(`/api/v1/followups/${id}/status`, {
        status: 'COMPLETED',
      });
      setSuccessMsg('Followup marked as COMPLETED.');
      await fetchFollowups();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to complete followup.');
    }
  };

  const handleCancel = async (id: string) => {
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      await api.patch(`/api/v1/followups/${id}/status`, {
        status: 'CANCELLED',
      });
      setSuccessMsg('Followup marked as CANCELLED.');
      await fetchFollowups();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to cancel followup.');
    }
  };

  const handleRescheduleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rescheduleId || !rescheduleDate) {
      setErrorMsg('Please select a date and time.');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      await api.patch(`/api/v1/followups/${rescheduleId}/reschedule`, {
        followupDate: new Date(rescheduleDate).toISOString(),
        notes: rescheduleNotes,
      });
      setSuccessMsg('Followup successfully rescheduled.');
      setShowRescheduleModal(false);
      setRescheduleId(null);
      setRescheduleDate('');
      setRescheduleNotes('');
      await fetchFollowups();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to reschedule followup.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Date boundary filtering logic
  const matchDateFilter = (followup: any) => {
    if (dateFilter === 'ALL') return true;

    const fDate = new Date(followup.followupDate);
    const now = new Date();

    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const endOfToday = new Date();
    endOfToday.setHours(23, 59, 59, 999);

    const startOfTomorrow = new Date();
    startOfTomorrow.setDate(now.getDate() + 1);
    startOfTomorrow.setHours(0, 0, 0, 0);

    const endOfTomorrow = new Date();
    endOfTomorrow.setDate(now.getDate() + 1);
    endOfTomorrow.setHours(23, 59, 59, 999);

    const endOfWeek = new Date();
    endOfWeek.setDate(now.getDate() + 7);
    endOfWeek.setHours(23, 59, 59, 999);

    if (dateFilter === 'TODAY') {
      return fDate >= startOfToday && fDate <= endOfToday;
    }
    if (dateFilter === 'TOMORROW') {
      return fDate >= startOfTomorrow && fDate <= endOfTomorrow;
    }
    if (dateFilter === 'WEEK') {
      return fDate >= startOfToday && fDate <= endOfWeek;
    }
    if (dateFilter === 'OVERDUE') {
      // Scheduled followup whose date is in the past
      return (followup.status === 'SCHEDULED' && fDate < now) || followup.status === 'MISSED';
    }
    return true;
  };

  const filteredFollowups = followups.filter((f) => {
    // Status Filter
    const matchesStatus = statusFilter === 'ALL' || f.status === statusFilter;
    // Date/Time Filter
    const matchesDate = matchDateFilter(f);

    return matchesStatus && matchesDate;
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: '20px 20px 40px 20px' }}>
      
      {/* Title */}
      <div style={{ marginBottom: '16px' }}>
        <h2 style={{ fontSize: '15px', fontWeight: 700 }}>Followups & Tasks Agenda</h2>
        <p style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
          Review and update candidate follow-up reminders, outreach dates, and completion status.
        </p>
      </div>

      {/* Action responses */}
      {(errorMsg || successMsg) && (
        <div style={{ marginBottom: '16px' }}>
          {errorMsg && (
            <div style={{ backgroundColor: '#fee2e2', color: '#991b1b', border: '1px solid #fca5a5', padding: '8px 12px', borderRadius: '4px', fontSize: '11px' }}>
              ⚠️ {errorMsg}
            </div>
          )}
          {successMsg && (
            <div style={{ backgroundColor: '#dcfce7', color: '#166534', border: '1px solid #86efac', padding: '8px 12px', borderRadius: '4px', fontSize: '11px' }}>
              ✓ {successMsg}
            </div>
          )}
        </div>
      )}

      {/* Filter Matrix Section */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '20px', background: '#fff', border: '1px solid var(--border-color)', borderRadius: '4px', padding: '12px', marginBottom: '16px' }}>
        
        {/* Status filters */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <span style={{ fontSize: '10px', fontWeight: 600, color: 'var(--text-muted)' }}>Task Status</span>
          <div style={{ display: 'flex', gap: '4px' }}>
            <button className={`btn btn-sm ${statusFilter === 'ALL' ? 'btn-primary' : ''}`} onClick={() => setStatusFilter('ALL')}>
              All ({followups.length})
            </button>
            <button className={`btn btn-sm ${statusFilter === 'SCHEDULED' ? 'btn-primary' : ''}`} onClick={() => setStatusFilter('SCHEDULED')}>
              Scheduled ({followups.filter(f => f.status === 'SCHEDULED').length})
            </button>
            <button className={`btn btn-sm ${statusFilter === 'COMPLETED' ? 'btn-primary' : ''}`} onClick={() => setStatusFilter('COMPLETED')}>
              Completed ({followups.filter(f => f.status === 'COMPLETED').length})
            </button>
            <button className={`btn btn-sm ${statusFilter === 'CANCELLED' ? 'btn-primary' : ''}`} onClick={() => setStatusFilter('CANCELLED')}>
              Cancelled ({followups.filter(f => f.status === 'CANCELLED').length})
            </button>
          </div>
        </div>

        {/* Date Time filters */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <span style={{ fontSize: '10px', fontWeight: 600, color: 'var(--text-muted)' }}>Time Horizon Filter</span>
          <div style={{ display: 'flex', gap: '4px' }}>
            <button className={`btn btn-sm ${dateFilter === 'ALL' ? 'btn-primary' : ''}`} onClick={() => setDateFilter('ALL')}>
              Any Time
            </button>
            <button className={`btn btn-sm ${dateFilter === 'TODAY' ? 'btn-primary' : ''}`} onClick={() => setDateFilter('TODAY')}>
              Today
            </button>
            <button className={`btn btn-sm ${dateFilter === 'TOMORROW' ? 'btn-primary' : ''}`} onClick={() => setDateFilter('TOMORROW')}>
              Tomorrow
            </button>
            <button className={`btn btn-sm ${dateFilter === 'WEEK' ? 'btn-primary' : ''}`} onClick={() => setDateFilter('WEEK')}>
              This Week
            </button>
            <button className={`btn btn-sm ${dateFilter === 'OVERDUE' ? 'btn-primary' : ''}`} onClick={() => setDateFilter('OVERDUE')}>
              Overdue / Missed
            </button>
          </div>
        </div>

      </div>

      {/* Dense Table */}
      <div className="table-container" style={{ margin: 0, flexGrow: 1, overflowY: 'auto' }}>
        {loading ? (
          <div style={{ padding: '40px', textAlign: 'center', fontWeight: 600 }}>
            Querying organization agenda entries...
          </div>
        ) : filteredFollowups.length === 0 ? (
          <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
            No followups booked under selected filter parameters.
          </div>
        ) : (
          <table className="dense-table">
            <thead>
              <tr>
                <th>Student Candidate</th>
                <th>Candidate Status</th>
                <th>Due Date & Time</th>
                <th>Agenda / Task Notes</th>
                <th>Task Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredFollowups.map((f) => (
                <tr key={f.id}>
                  <td>
                    {f.lead ? (
                      <a
                        href={`/dashboard/leads/${f.lead.id}`}
                        style={{ color: 'var(--primary-color)', fontWeight: 600, textDecoration: 'none' }}
                      >
                        {f.lead.firstName || ''} {f.lead.lastName || ''}
                      </a>
                    ) : (
                      <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>Unknown</span>
                    )}
                  </td>
                  <td>
                    {f.lead ? (
                      <span className={`badge badge-${f.lead.status.toLowerCase()}`}>
                        {f.lead.status}
                      </span>
                    ) : (
                      <span>—</span>
                    )}
                  </td>
                  <td>{new Date(f.followupDate).toLocaleString()}</td>
                  <td>{f.notes || '—'}</td>
                  <td>
                    <span
                      className="badge"
                      style={{
                        backgroundColor:
                          f.status === 'COMPLETED'
                            ? '#dcfce7'
                            : f.status === 'MISSED'
                            ? '#fee2e2'
                            : f.status === 'CANCELLED'
                            ? '#f1f5f9'
                            : '#e0f2fe',
                        color:
                          f.status === 'COMPLETED'
                            ? '#166534'
                            : f.status === 'MISSED'
                            ? '#991b1b'
                            : f.status === 'CANCELLED'
                            ? '#475569'
                            : '#0369a1',
                      }}
                    >
                      {f.status}
                    </span>
                  </td>
                  <td>
                    {(f.status === 'SCHEDULED' || f.status === 'MISSED') ? (
                      <div style={{ display: 'flex', gap: '4px' }}>
                        <button
                          onClick={() => handleComplete(f.id)}
                          className="btn btn-sm"
                          style={{ backgroundColor: 'var(--success-color)', color: '#fff', borderColor: 'var(--success-color)' }}
                        >
                          ✓ Complete
                        </button>
                        <button
                          onClick={() => { setRescheduleId(f.id); setRescheduleDate(''); setRescheduleNotes(f.notes || ''); setShowRescheduleModal(true); }}
                          className="btn btn-sm"
                          style={{ backgroundColor: 'var(--primary-color)', color: '#fff', borderColor: 'var(--primary-color)' }}
                        >
                          📅 Reschedule
                        </button>
                        <button
                          onClick={() => handleCancel(f.id)}
                          className="btn btn-sm btn-danger"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Reschedule popup modal */}
      {showRescheduleModal && rescheduleId && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <form onSubmit={handleRescheduleSubmit} style={{ backgroundColor: '#fff', borderRadius: '4px', border: '1px solid var(--border-color)', padding: '20px', width: '400px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <h3 style={{ fontSize: '14px', fontWeight: 700, margin: 0, borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>Reschedule Followup</h3>
            
            <div className="form-group">
              <label>New Date & Time *</label>
              <input
                type="datetime-local"
                className="form-control"
                required
                value={rescheduleDate}
                onChange={(e) => setRescheduleDate(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label>Update Agenda / Notes</label>
              <textarea
                className="form-control"
                rows={3}
                placeholder="Details of the rescheduled reminder..."
                value={rescheduleNotes}
                onChange={(e) => setRescheduleNotes(e.target.value)}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '8px' }}>
              <button type="button" className="btn" disabled={isSubmitting} onClick={() => { setShowRescheduleModal(false); setRescheduleId(null); }}>
                Cancel
              </button>
              <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
                {isSubmitting ? 'Rescheduling...' : 'Reschedule'}
              </button>
            </div>
          </form>
        </div>
      )}

    </div>
  );
}
