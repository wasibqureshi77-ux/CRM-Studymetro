'use client';

import React, { useState, useEffect } from 'react';
import { api } from '../../../lib/api';

const parseLocalISOString = (s: string) => {
  if (!s) return new Date();
  const [datePart, timePart] = s.split('T');
  if (!datePart || !timePart) return new Date(s);
  const [year, month, day] = datePart.split('-').map(Number);
  const [hours, minutes] = timePart.split(':').map(Number);
  return new Date(year, month - 1, day, hours, minutes);
};

const validateFollowupDateTime = (dateTimeStr: string): { isValid: boolean; errorMsg: string } => {
  if (!dateTimeStr) {
    return { isValid: false, errorMsg: 'Please select a date and time.' };
  }
  const selectedDate = parseLocalISOString(dateTimeStr);
  const now = new Date();
  
  const selectedDateOnly = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate());
  const todayDateOnly = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  
  if (selectedDateOnly < todayDateOnly) {
    return { isValid: false, errorMsg: 'Follow-up date cannot be in the past.' };
  }
  
  if (selectedDateOnly.getTime() === todayDateOnly.getTime()) {
    if (selectedDate.getTime() <= now.getTime()) {
      return { isValid: false, errorMsg: 'Follow-up time must be later than the current time.' };
    }
  }
  
  return { isValid: true, errorMsg: '' };
};

export default function FollowupsPage() {
  const [followups, setFollowups] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [dateFilter, setDateFilter] = useState<'ALL' | 'TODAY' | 'TOMORROW' | 'WEEK' | 'OVERDUE'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Reschedule modal state
  const [showRescheduleModal, setShowRescheduleModal] = useState(false);
  const [rescheduleId, setRescheduleId] = useState<string | null>(null);
  const [rescheduleDate, setRescheduleDate] = useState('');
  const [rescheduleNotes, setRescheduleNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Complete modal state
  const [showCompleteModal, setShowCompleteModal] = useState(false);
  const [completeId, setCompleteId] = useState<string | null>(null);
  const [completeLeadId, setCompleteLeadId] = useState<string | null>(null);
  const [completeRemarks, setCompleteRemarks] = useState('');
  const [scheduleNextFollowup, setScheduleNextFollowup] = useState(false);
  const [nextFollowupDate, setNextFollowupDate] = useState('');
  const [nextFollowupNotes, setNextFollowupNotes] = useState('');

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

  const handleCompleteClick = (id: string, leadId: string | null) => {
    setCompleteId(id);
    setCompleteLeadId(leadId);
    setCompleteRemarks('');
    setScheduleNextFollowup(false);
    setNextFollowupDate('');
    setNextFollowupNotes('');
    setShowCompleteModal(true);
  };

  const handleCompleteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!completeId) return;

    if (scheduleNextFollowup && nextFollowupDate) {
      const validation = validateFollowupDateTime(nextFollowupDate);
      if (!validation.isValid) {
        setErrorMsg(validation.errorMsg);
        return;
      }
    }

    setIsSubmitting(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      // 1. Complete the current followup
      await api.patch(`/api/v1/followups/${completeId}/status`, {
        status: 'COMPLETED',
        notes: completeRemarks.trim() || undefined,
      });

      // 2. Schedule next one if selected and date is filled
      if (scheduleNextFollowup && completeLeadId && nextFollowupDate) {
        await api.post('/api/v1/followups', {
          leadId: completeLeadId,
          followupDate: parseLocalISOString(nextFollowupDate).toISOString(),
          notes: nextFollowupNotes,
        });
      }

      setSuccessMsg(scheduleNextFollowup ? 'Followup completed and next one scheduled successfully.' : 'Followup marked as COMPLETED.');
      setShowCompleteModal(false);
      setCompleteId(null);
      setCompleteLeadId(null);
      await fetchFollowups();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to complete followup.');
    } finally {
      setIsSubmitting(false);
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

    const validation = validateFollowupDateTime(rescheduleDate);
    if (!validation.isValid) {
      setErrorMsg(validation.errorMsg);
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      await api.patch(`/api/v1/followups/${rescheduleId}/reschedule`, {
        followupDate: parseLocalISOString(rescheduleDate).toISOString(),
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
    // Search Filter
    const leadName = f.lead ? `${f.lead.firstName} ${f.lead.lastName || ''}`.toLowerCase() : '';
    const matchesSearch = leadName.includes(searchQuery.toLowerCase());

    return matchesStatus && matchesDate && matchesSearch;
  });

  const minDateTime = (() => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  })();

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
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '20px', background: '#fff', border: '1px solid var(--border-color)', borderRadius: '4px', padding: '12px', marginBottom: '16px', alignItems: 'center' }}>
        
        {/* Search input */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <span style={{ fontSize: '10px', fontWeight: 600, color: 'var(--text-muted)' }}>Search Student</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <input
              type="text"
              placeholder="Search by name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                padding: '6px 12px',
                fontSize: '12px',
                borderRadius: '6px',
                border: '1px solid var(--border-color)',
                backgroundColor: '#fff',
                outline: 'none',
                width: '180px',
                height: '28px'
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
        </div>
        
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
                <th>Created Date & Time</th>
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
                  <td>{new Date(f.createdAt).toLocaleString()}</td>
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
                          onClick={() => handleCompleteClick(f.id, f.lead?.id || null)}
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
            {errorMsg && <div style={{ backgroundColor: '#fee2e2', color: '#991b1b', border: '1px solid #fca5a5', padding: '8px 12px', borderRadius: '4px', fontSize: '11px' }}>⚠️ {errorMsg}</div>}
            
            <div className="form-group">
              <label>New Date & Time *</label>
              <input
                type="datetime-local"
                className="form-control"
                required
                value={rescheduleDate}
                onChange={(e) => setRescheduleDate(e.target.value)}
                onClick={(e) => e.currentTarget.showPicker?.()}
                min={minDateTime}
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
      {/* Complete popup modal */}
      {showCompleteModal && completeId && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <form onSubmit={handleCompleteSubmit} style={{ backgroundColor: '#fff', borderRadius: '4px', border: '1px solid var(--border-color)', padding: '20px', width: '450px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <h3 style={{ fontSize: '14px', fontWeight: 700, margin: 0, borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>Complete Followup</h3>
            {errorMsg && <div style={{ backgroundColor: '#fee2e2', color: '#991b1b', border: '1px solid #fca5a5', padding: '8px 12px', borderRadius: '4px', fontSize: '11px' }}>⚠️ {errorMsg}</div>}
            
            <div className="form-group">
              <label>Completion Remarks (Optional)</label>
              <textarea
                className="form-control"
                rows={2}
                placeholder="What was the outcome of this followup?"
                value={completeRemarks}
                onChange={(e) => setCompleteRemarks(e.target.value)}
              />
            </div>

            <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '10px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontWeight: 600, fontSize: '12px' }}>
                <input
                  type="checkbox"
                  checked={scheduleNextFollowup}
                  onChange={(e) => setScheduleNextFollowup(e.target.checked)}
                />
                Schedule another follow-up for future
              </label>

              {scheduleNextFollowup && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '4px', paddingLeft: '20px', borderLeft: '2px solid var(--primary-color)' }}>
                  <div className="form-group">
                    <label>Next Follow-up Date & Time *</label>
                    <input
                      type="datetime-local"
                      className="form-control"
                      required={scheduleNextFollowup}
                      value={nextFollowupDate}
                      onChange={(e) => setNextFollowupDate(e.target.value)}
                      onClick={(e) => e.currentTarget.showPicker?.()}
                      min={minDateTime}
                    />
                  </div>
                  <div className="form-group">
                    <label>Next Agenda / Notes</label>
                    <textarea
                      className="form-control"
                      rows={2}
                      placeholder="What should be discussed next?"
                      value={nextFollowupNotes}
                      onChange={(e) => setNextFollowupNotes(e.target.value)}
                    />
                  </div>
                </div>
              )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '8px' }}>
              <button type="button" className="btn" disabled={isSubmitting} onClick={() => { setShowCompleteModal(false); setCompleteId(null); setCompleteLeadId(null); }}>
                Cancel
              </button>
              <button type="submit" className="btn btn-primary" style={{ backgroundColor: 'var(--success-color)', borderColor: 'var(--success-color)' }} disabled={isSubmitting}>
                {isSubmitting ? 'Saving...' : 'Complete Followup'}
              </button>
            </div>
          </form>
        </div>
      )}

    </div>
  );
}
