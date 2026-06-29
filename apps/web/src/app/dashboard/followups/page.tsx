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
  const [counsellorFilter, setCounsellorFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [users, setUsers] = useState<any[]>([]);

  // Mobile state hooks
  const [mobileViewMode, setMobileViewMode] = useState<'cards' | 'timeline'>('cards');
  const [showMobileFilters, setShowMobileFilters] = useState(false);
  const [mobileItemsLimit, setMobileItemsLimit] = useState(12);
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({});
  
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
    const fetchUsers = async () => {
      try {
        const usersData = await api.get('/api/v1/leads/meta/users');
        setUsers(usersData || []);
      } catch (err) {
        console.error('Failed to load users metadata', err);
      }
    };
    fetchUsers();
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
      await api.post(`/api/v1/followups/${completeId}/complete`, {
        remarks: completeRemarks || undefined,
        scheduleNext: scheduleNextFollowup,
        nextFollowupDate: scheduleNextFollowup ? nextFollowupDate : undefined,
        nextNotes: scheduleNextFollowup ? nextFollowupNotes : undefined,
      });

      setSuccessMsg('Follow-up marked as completed.');
      setShowCompleteModal(false);
      setCompleteId(null);
      setCompleteLeadId(null);
      fetchFollowups();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to complete follow-up.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRescheduleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rescheduleId || !rescheduleDate) return;

    const validation = validateFollowupDateTime(rescheduleDate);
    if (!validation.isValid) {
      setErrorMsg(validation.errorMsg);
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      await api.post(`/api/v1/followups/${rescheduleId}/reschedule`, {
        followupDate: rescheduleDate,
        notes: rescheduleNotes || undefined,
      });

      setSuccessMsg('Follow-up rescheduled successfully.');
      setShowRescheduleModal(false);
      setRescheduleId(null);
      fetchFollowups();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to reschedule.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = async (id: string) => {
    if (!confirm('Are you sure you want to cancel this scheduled follow-up reminder?')) return;
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      await api.post(`/api/v1/followups/${id}/cancel`);
      setSuccessMsg('Follow-up cancelled.');
      fetchFollowups();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to cancel follow-up.');
    }
  };

  const matchDateFilter = (followup: any) => {
    if (dateFilter === 'ALL') return true;
    const fDate = new Date(followup.followupDate);
    const now = new Date();

    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

    const startOfTomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    const endOfTomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 23, 59, 59, 999);

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
      return (followup.status === 'SCHEDULED' && fDate < now) || followup.status === 'MISSED';
    }
    return true;
  };

  const filteredFollowups = followups.filter((f) => {
    const matchesStatus = statusFilter === 'ALL' || f.status === statusFilter;
    const matchesDate = matchDateFilter(f);
    
    const query = searchQuery.toLowerCase();
    const leadName = f.lead ? `${f.lead.firstName} ${f.lead.lastName || ''}`.toLowerCase() : '';
    const leadId = f.lead?.leadNumber ? String(f.lead.leadNumber).toLowerCase() : '';
    const phone = f.lead?.phone ? String(f.lead.phone).toLowerCase() : '';
    const email = f.lead?.email ? String(f.lead.email).toLowerCase() : '';
    const matchesSearch = 
      leadName.includes(query) || 
      leadId.includes(query) || 
      phone.includes(query) || 
      email.includes(query);

    const matchesCounsellor = !counsellorFilter || f.lead?.assignedToId === counsellorFilter;
    const leadPriority = f.lead?.priority || 'MEDIUM';
    const matchesPriority = !priorityFilter || leadPriority === priorityFilter;

    return matchesStatus && matchesDate && matchesSearch && matchesCounsellor && matchesPriority;
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

  const todayCount = followups.filter(f => {
    if (f.status !== 'SCHEDULED') return false;
    const fDate = new Date(f.followupDate);
    const now = new Date();
    return fDate.toDateString() === now.toDateString();
  }).length;

  const getPriorityColor = (f: any) => {
    const priority = f.lead?.priority || 'MEDIUM';
    if (priority === 'HIGH') return '#ef4444';
    if (priority === 'LOW') return '#22c55e';
    return '#f97316';
  };

  const getTimeRemaining = (dateStr: string, status: string) => {
    if (status === 'COMPLETED') return 'Completed';
    if (status === 'CANCELLED') return 'Cancelled';
    const fDate = new Date(dateStr);
    const now = new Date();
    const diffMs = fDate.getTime() - now.getTime();
    if (diffMs < 0) {
      const absDiff = Math.abs(diffMs);
      const hours = Math.floor(absDiff / 3600000);
      if (hours < 1) return 'Overdue';
      return `${hours} hrs overdue`;
    }
    const mins = Math.floor(diffMs / 60000);
    if (mins < 60) return `In ${mins} mins`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `In ${hours} hrs`;
    const days = Math.floor(hours / 24);
    return `In ${days} days`;
  };

  const getGroupedFollowups = () => {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
    
    const startOfTomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    const endOfTomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 23, 59, 59, 999);
    
    const overdueList: any[] = [];
    const todayList: any[] = [];
    const tomorrowList: any[] = [];
    const upcomingList: any[] = [];
    const completedList: any[] = [];
    
    filteredFollowups.forEach((f) => {
      if (f.status === 'COMPLETED' || f.status === 'CANCELLED') {
        completedList.push(f);
        return;
      }
      
      const fDate = new Date(f.followupDate);
      if (fDate < now && f.status === 'SCHEDULED') {
        overdueList.push(f);
        return;
      }
      
      if (fDate >= startOfToday && fDate <= endOfToday) {
        todayList.push(f);
      } else if (fDate >= startOfTomorrow && fDate <= endOfTomorrow) {
        tomorrowList.push(f);
      } else if (fDate > endOfTomorrow) {
        upcomingList.push(f);
      } else {
        overdueList.push(f);
      }
    });
    
    return {
      overdue: overdueList,
      today: todayList,
      tomorrow: tomorrowList,
      upcoming: upcomingList,
      completed: completedList
    };
  };

  const grouped = getGroupedFollowups();

  return (
    <>
      {/* DESKTOP VIEW */}
      <div className="desktop-only-followups" style={{ paddingBottom: '30px' }}>
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
        <div className="table-container" style={{ margin: 0, overflowY: 'auto' }}>
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
      </div>

      {/* MOBILE VIEW */}
      <div className="mobile-only-followups" style={{ paddingBottom: '80px' }}>
        {/* Mobile Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', borderBottom: '1px solid var(--border-color)', backgroundColor: '#fff' }}>
          <div>
            <h2 style={{ fontSize: '15px', fontWeight: 700, margin: 0 }}>Follow-ups</h2>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{todayCount} scheduled for today</span>
          </div>
          <button 
            onClick={() => window.location.href = '/dashboard/leads'}
            style={{
              padding: '6px 12px',
              borderRadius: '6px',
              border: 'none',
              backgroundColor: 'var(--primary-color)',
              color: '#fff',
              fontSize: '11px',
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            ➕ Follow-up
          </button>
        </div>

        {/* Mobile Notification Banner */}
        {(errorMsg || successMsg) && (
          <div style={{ padding: '8px 16px' }}>
            {errorMsg && (
              <div style={{ backgroundColor: '#fee2e2', color: '#991b1b', padding: '8px 12px', borderRadius: '6px', fontSize: '11px' }}>
                ⚠️ {errorMsg}
              </div>
            )}
            {successMsg && (
              <div style={{ backgroundColor: '#dcfce7', color: '#166534', padding: '8px 12px', borderRadius: '6px', fontSize: '11px' }}>
                ✓ {successMsg}
              </div>
            )}
          </div>
        )}

        {/* Search, Toggle, Filter bar */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '12px 16px', backgroundColor: '#fff', borderBottom: '1px solid var(--border-color)' }}>
          <div style={{ display: 'flex', gap: '8px' }}>
            <input
              type="text"
              placeholder="Search by student, ID, phone..."
              className="form-control"
              style={{ flex: 1, height: '36px', fontSize: '13px' }}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            <button
              onClick={() => setShowMobileFilters(true)}
              style={{
                padding: '0 14px',
                borderRadius: '6px',
                border: '1px solid var(--border-color)',
                backgroundColor: '#fff',
                color: '#334155',
                fontSize: '13px',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              ⚙️ Filters
            </button>
          </div>

          {/* Cards / Timeline Toggle */}
          <div style={{ display: 'flex', backgroundColor: '#f1f5f9', borderRadius: '8px', padding: '2px' }}>
            <button
              onClick={() => setMobileViewMode('cards')}
              style={{
                flex: 1,
                padding: '6px',
                borderRadius: '6px',
                border: 'none',
                backgroundColor: mobileViewMode === 'cards' ? '#fff' : 'transparent',
                boxShadow: mobileViewMode === 'cards' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                color: mobileViewMode === 'cards' ? '#0f172a' : '#64748b',
                fontSize: '12px',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              📋 Cards
            </button>
            <button
              onClick={() => setMobileViewMode('timeline')}
              style={{
                flex: 1,
                padding: '6px',
                borderRadius: '6px',
                border: 'none',
                backgroundColor: mobileViewMode === 'timeline' ? '#fff' : 'transparent',
                boxShadow: mobileViewMode === 'timeline' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                color: mobileViewMode === 'timeline' ? '#0f172a' : '#64748b',
                fontSize: '12px',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              🕒 Timeline
            </button>
          </div>
        </div>

        {/* Empty State */}
        {filteredFollowups.length === 0 ? (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '64px 20px',
            margin: '16px',
            backgroundColor: '#fff',
            borderRadius: '12px',
            border: '1px solid var(--border-color)',
            textAlign: 'center',
            color: 'var(--text-muted)'
          }}>
            <span style={{ fontSize: '48px', marginBottom: '16px' }}>📅</span>
            <h3 style={{ fontSize: '15px', fontWeight: 700, color: '#475569', margin: '0 0 6px 0' }}>No Follow-ups Scheduled</h3>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '0 0 16px 0', maxWidth: '240px' }}>
              Create or reschedule follow-up reminders on candidates profiles.
            </p>
            <button 
              onClick={() => window.location.href = '/dashboard/leads'}
              style={{
                padding: '10px 20px',
                borderRadius: '8px',
                border: 'none',
                backgroundColor: 'var(--primary-color)',
                color: '#fff',
                fontSize: '13px',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              Schedule Follow-up
            </button>
          </div>
        ) : mobileViewMode === 'cards' ? (
          /* Cards Grouped List */
          <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {(() => {
              const sections = [
                { id: 'overdue', label: '⚠️ Overdue Tasks', list: grouped.overdue, accent: '#ef4444' },
                { id: 'today', label: '🔵 Today\'s Agenda', list: grouped.today, accent: '#3b82f6' },
                { id: 'tomorrow', label: '📅 Tomorrow', list: grouped.tomorrow, accent: '#f59e0b' },
                { id: 'upcoming', label: '✨ Upcoming', list: grouped.upcoming, accent: '#6366f1' },
                { id: 'completed', label: '✅ Completed & Cancelled', list: grouped.completed, accent: '#10b981' }
              ];

              return sections.map((sec) => {
                if (sec.list.length === 0) return null;
                const isCollapsed = collapsedSections[sec.id] || false;

                return (
                  <div key={sec.id} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {/* Collapsible Header */}
                    <div 
                      onClick={() => setCollapsedSections(prev => ({ ...prev, [sec.id]: !isCollapsed }))}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '10px 14px',
                        backgroundColor: '#fff',
                        borderRadius: '8px',
                        border: '1px solid var(--border-color)',
                        borderLeft: `4px solid ${sec.accent}`,
                        cursor: 'pointer'
                      }}
                    >
                      <span style={{ fontSize: '13px', fontWeight: 700, color: '#334155' }}>
                        {sec.label} ({sec.list.length})
                      </span>
                      <span style={{ fontSize: '12px', color: '#64748b' }}>
                        {isCollapsed ? '➕ Expand' : '➖ Collapse'}
                      </span>
                    </div>

                    {/* Cards Render list */}
                    {!isCollapsed && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        {sec.list.slice(0, mobileItemsLimit).map((f) => {
                          const priorityColor = getPriorityColor(f);
                          const isOverdue = sec.id === 'overdue';
                          const isDone = f.status === 'COMPLETED';

                          return (
                            <div
                              key={f.id}
                              style={{
                                backgroundColor: '#fff',
                                borderRadius: '12px',
                                border: '1px solid var(--border-color)',
                                borderLeft: isOverdue ? '4px solid #ef4444' : isDone ? '4px solid #10b981' : '1px solid var(--border-color)',
                                padding: '16px',
                                boxShadow: '0 4px 6px -1px rgba(0,0,0,0.02), 0 2px 4px -1px rgba(0,0,0,0.01)',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '10px',
                                position: 'relative'
                              }}
                            >
                              {/* Priority Strip Indicator */}
                              <div style={{ position: 'absolute', top: 0, right: '16px', width: '24px', height: '4px', backgroundColor: priorityColor, borderBottomLeftRadius: '4px', borderBottomRightRadius: '4px' }} />

                              {/* Title / Student details */}
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                <div>
                                  {f.lead ? (
                                    <a
                                      href={`/dashboard/leads/${f.lead.id}`}
                                      style={{ fontSize: '14px', fontWeight: 700, color: 'var(--primary-color)', textDecoration: 'none' }}
                                    >
                                      👤 {f.lead.firstName} {f.lead.lastName || ''}
                                    </a>
                                  ) : (
                                    <span style={{ fontSize: '14px', fontWeight: 700, color: '#64748b' }}>Unknown Candidate</span>
                                  )}
                                  {f.lead?.leadNumber && (
                                    <div style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 600, marginTop: '2px' }}>
                                      Ref: {f.lead.leadNumber}
                                    </div>
                                  )}
                                </div>
                                <span style={{
                                  fontSize: '9px',
                                  fontWeight: 700,
                                  backgroundColor: isOverdue ? '#fee2e2' : isDone ? '#dcfce7' : '#e0f2fe',
                                  color: isOverdue ? '#b91c1c' : isDone ? '#166534' : '#0369a1',
                                  padding: '3px 8px',
                                  borderRadius: '6px'
                                }}>
                                  {isOverdue && '⚠️ '}{f.status}
                                </span>
                              </div>

                              {/* Metadata list */}
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '12px', color: '#475569', borderTop: '1px solid #f1f5f9', paddingTop: '8px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                  <span>📅 Due Date:</span>
                                  <span style={{ fontWeight: 600 }}>{new Date(f.followupDate).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}</span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                  <span>⏰ Time Remaining:</span>
                                  <span style={{ fontWeight: 600, color: isOverdue ? '#ef4444' : '#475569' }}>
                                    {getTimeRemaining(f.followupDate, f.status)}
                                  </span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                  <span>🏷️ Follow-up Type:</span>
                                  <span style={{ fontWeight: 600 }}>{f.lead?.leadCategory?.replace(/_/g, ' ') || '—'}</span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                  <span>📍 Lead Stage:</span>
                                  <span style={{ fontWeight: 600 }}>{f.lead?.status || '—'}</span>
                                </div>
                                {f.lead?.assignedToUser?.name && (
                                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                    <span>👨 Counsellor:</span>
                                    <span style={{ fontWeight: 600 }}>{f.lead.assignedToUser.name}</span>
                                  </div>
                                )}
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '4px', padding: '8px', backgroundColor: '#f8fafc', borderRadius: '6px' }}>
                                  <span style={{ fontSize: '10px', fontWeight: 600, opacity: 0.6 }}>Agenda / Notes</span>
                                  <span style={{ fontSize: '11px', color: '#334155' }}>{f.notes || 'No notes specified.'}</span>
                                </div>
                              </div>

                              {/* Quick actions buttons footer */}
                              <div style={{ display: 'flex', gap: '4px', borderTop: '1px solid #f1f5f9', paddingTop: '10px', flexWrap: 'wrap' }}>
                                {f.lead?.id && (
                                  <a
                                    href={`/dashboard/leads/${f.lead.id}`}
                                    style={{ flex: 1, minWidth: '55px', padding: '6px 4px', borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: '#fff', color: '#475569', fontSize: '9px', fontWeight: 600, textDecoration: 'none', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}
                                  >
                                    <span>👁️</span>
                                    <span>Open</span>
                                  </a>
                                )}
                                {(f.status === 'SCHEDULED' || f.status === 'MISSED') ? (
                                  <>
                                    <button
                                      onClick={() => handleCompleteClick(f.id, f.lead?.id || null)}
                                      style={{ flex: 1, minWidth: '55px', padding: '6px 4px', borderRadius: '6px', border: 'none', backgroundColor: '#10b981', color: '#fff', fontSize: '9px', fontWeight: 600, cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}
                                    >
                                      <span>✅</span>
                                      <span>Complete</span>
                                    </button>
                                    <button
                                      onClick={() => { setRescheduleId(f.id); setRescheduleDate(''); setRescheduleNotes(f.notes || ''); setShowRescheduleModal(true); }}
                                      style={{ flex: 1, minWidth: '55px', padding: '6px 4px', borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: '#fff', color: '#475569', fontSize: '9px', fontWeight: 600, cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}
                                    >
                                      <span>✏️</span>
                                      <span>Resched</span>
                                    </button>
                                  </>
                                ) : null}
                                {f.lead?.phone && (
                                  <>
                                    <a
                                      href={`tel:${f.lead.phone}`}
                                      style={{ flex: 1, minWidth: '55px', padding: '6px 4px', borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: '#fff', color: '#475569', fontSize: '9px', fontWeight: 600, textDecoration: 'none', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}
                                    >
                                      <span>📞</span>
                                      <span>Call</span>
                                    </a>
                                    <a
                                      href={`https://wa.me/${f.lead.phone.replace(/[^0-9]/g, '')}`}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      style={{ flex: 1, minWidth: '55px', padding: '6px 4px', borderRadius: '6px', border: '1px solid #22c55e', backgroundColor: 'rgba(34, 197, 94, 0.05)', color: '#15803d', fontSize: '9px', fontWeight: 600, textDecoration: 'none', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}
                                    >
                                      <span>💬</span>
                                      <span>WA</span>
                                    </a>
                                  </>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              });
            })()}

            {/* Load more button */}
            {filteredFollowups.length > mobileItemsLimit && (
              <button
                onClick={() => setMobileItemsLimit(prev => prev + 12)}
                style={{
                  width: '100%',
                  padding: '12px',
                  backgroundColor: '#fff',
                  border: '1px solid var(--border-color)',
                  borderRadius: '8px',
                  color: 'var(--primary-color)',
                  fontWeight: 700,
                  fontSize: '13px',
                  cursor: 'pointer',
                  textAlign: 'center',
                  marginTop: '8px'
                }}
              >
                Load More Follow-ups
              </button>
            )}
          </div>
        ) : (
          /* Timeline view representation */
          <div style={{ padding: '24px 16px', display: 'flex', flexDirection: 'column', position: 'relative' }}>
            {/* Timeline vertical bar */}
            <div style={{ position: 'absolute', top: '24px', bottom: '24px', left: '23px', width: '2px', backgroundColor: '#e2e8f0', zIndex: 1 }} />

            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', zIndex: 10 }}>
              {[...filteredFollowups]
                .sort((a, b) => new Date(a.followupDate).getTime() - new Date(b.followupDate).getTime())
                .slice(0, mobileItemsLimit)
                .map((f) => {
                  const fDate = new Date(f.followupDate);
                  const timeStr = fDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                  const dateStr = fDate.toLocaleDateString([], { month: 'short', day: 'numeric' });
                  const priorityColor = getPriorityColor(f);
                  const isDone = f.status === 'COMPLETED';

                  return (
                    <div key={f.id} style={{ display: 'flex', gap: '16px', alignItems: 'flex-start' }}>
                      {/* Timeline dot */}
                      <div style={{
                        width: '16px',
                        height: '16px',
                        borderRadius: '50%',
                        backgroundColor: isDone ? '#10b981' : priorityColor,
                        border: '4px solid #fff',
                        boxShadow: '0 0 0 1px #cbd5e1',
                        marginTop: '4px',
                        flexShrink: 0
                      }} />

                      {/* Content block */}
                      <div 
                        onClick={() => { if (f.lead?.id) window.location.href = `/dashboard/leads/${f.lead.id}`; }}
                        style={{
                          flex: 1,
                          backgroundColor: '#fff',
                          border: '1px solid var(--border-color)',
                          borderRadius: '8px',
                          padding: '12px',
                          boxShadow: '0 2px 4px rgba(0,0,0,0.01)',
                          cursor: 'pointer'
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--primary-color)' }}>
                            {timeStr} — {dateStr}
                          </span>
                          <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{f.status}</span>
                        </div>
                        <h4 style={{ fontSize: '13px', fontWeight: 700, margin: '4px 0 2px 0', color: '#1e293b' }}>
                          👤 {f.lead?.firstName || 'Unknown'} {f.lead?.lastName || ''}
                        </h4>
                        <p style={{ fontSize: '11px', color: '#64748b', margin: 0 }}>
                          📝 {f.notes || 'No agenda notes.'}
                        </p>
                        {f.lead?.status && (
                          <div style={{ marginTop: '6px' }}>
                            <span style={{ fontSize: '9px', fontWeight: 600, backgroundColor: '#f1f5f9', color: '#475569', padding: '2px 6px', borderRadius: '4px' }}>
                              📍 Stage: {f.lead.status}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
            </div>

            {/* Load more button */}
            {filteredFollowups.length > mobileItemsLimit && (
              <button
                onClick={() => setMobileItemsLimit(prev => prev + 12)}
                style={{
                  width: '100%',
                  padding: '12px',
                  backgroundColor: '#fff',
                  border: '1px solid var(--border-color)',
                  borderRadius: '8px',
                  color: 'var(--primary-color)',
                  fontWeight: 700,
                  fontSize: '13px',
                  cursor: 'pointer',
                  textAlign: 'center',
                  marginTop: '16px',
                  zIndex: 10
                }}
              >
                Load More Items
              </button>
            )}
          </div>
        )}
      </div>

      {/* MOBILE FILTERS BOTTOM SHEET */}
      {showMobileFilters && (
        <div 
          style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15, 23, 42, 0.4)', zIndex: 600, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}
          onClick={() => setShowMobileFilters(false)}
        >
          <div 
            className="bottom-sheet" 
            style={{ width: '100%', maxWidth: '480px', backgroundColor: '#fff', borderTopLeftRadius: '16px', borderTopRightRadius: '16px', padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px', maxHeight: '85vh', overflowY: 'auto' }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
              <h3 style={{ fontSize: '15px', fontWeight: 700, margin: 0 }}>Filter Agenda Items</h3>
              <button onClick={() => setShowMobileFilters(false)} style={{ background: 'none', border: 'none', fontSize: '18px', color: 'var(--text-muted)', cursor: 'pointer' }}>✕</button>
            </div>

            <div className="form-group">
              <label style={{ fontSize: '12px', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '6px' }}>Task Status</label>
              <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--border-color)', fontSize: '13px' }}>
                <option value="ALL">All Statuses</option>
                <option value="SCHEDULED">Scheduled</option>
                <option value="COMPLETED">Completed</option>
                <option value="CANCELLED">Cancelled</option>
              </select>
            </div>

            <div className="form-group">
              <label style={{ fontSize: '12px', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '6px' }}>Due Date Horizon</label>
              <select value={dateFilter} onChange={e => setDateFilter(e.target.value as any)} style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--border-color)', fontSize: '13px' }}>
                <option value="ALL">Any Time</option>
                <option value="TODAY">Due Today</option>
                <option value="TOMORROW">Due Tomorrow</option>
                <option value="WEEK">Due This Week</option>
                <option value="OVERDUE">Overdue Reminders</option>
              </select>
            </div>

            <div className="form-group">
              <label style={{ fontSize: '12px', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '6px' }}>Counsellor / Agent</label>
              <select value={counsellorFilter} onChange={e => setCounsellorFilter(e.target.value)} style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--border-color)', fontSize: '13px' }}>
                <option value="">All Counsellors</option>
                {users.map(u => (
                  <option key={u.id} value={u.id}>{u.firstName} {u.lastName}</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label style={{ fontSize: '12px', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '6px' }}>Priority Level</label>
              <select value={priorityFilter} onChange={e => setPriorityFilter(e.target.value)} style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--border-color)', fontSize: '13px' }}>
                <option value="">All Priorities</option>
                <option value="HIGH">High Priority</option>
                <option value="MEDIUM">Medium Priority</option>
                <option value="LOW">Low Priority</option>
              </select>
            </div>

            <div style={{ display: 'flex', gap: '12px', marginTop: '12px' }}>
              <button 
                onClick={() => { setStatusFilter('ALL'); setDateFilter('ALL'); setCounsellorFilter(''); setPriorityFilter(''); }} 
                style={{ flex: 1, padding: '12px', borderRadius: '8px', border: '1px solid var(--border-color)', background: '#fff', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}
              >
                Reset All
              </button>
              <button 
                onClick={() => setShowMobileFilters(false)} 
                style={{ flex: 1, padding: '12px', borderRadius: '8px', border: 'none', background: 'var(--primary-color)', color: '#fff', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}
              >
                Apply Filters
              </button>
            </div>
          </div>
        </div>
      )}

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
    </>
  );
}
