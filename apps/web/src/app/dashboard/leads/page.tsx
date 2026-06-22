'use client';

import React, { useState, useEffect } from 'react';
import { api } from '../../../lib/api';
import { useAuth } from '../../../context/auth-context';

export default function LeadsPage() {
  const [leads, setLeads] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [branches, setBranches] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Search & Filters State
  const [q, setQ] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [sourceFilter, setSourceFilter] = useState('');
  const [branchFilter, setBranchFilter] = useState('');
  const [countryFilter, setCountryFilter] = useState('');
  const [intakeFilter, setIntakeFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 12;

  // Bulk Selection State
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Bulk Operations Actions
  const [bulkAssignee, setBulkAssignee] = useState('');
  const [bulkBranch, setBulkBranch] = useState('');
  const [bulkStatus, setBulkStatus] = useState('');
  const [bulkActionType, setBulkActionType] = useState<'assign' | 'status' | 'merge' | null>(null);

  // Create Lead Modal
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createForm, setCreateForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    source: 'MANUAL',
    branchId: '',
    leadCategory: 'STUDY_ABROAD',
    preferredCountry: '',
    planningTimeline: '',
    intendedIntake: '',
    englishLevel: '',
    targetScore: '',
    purpose: '',
    courseInterest: ''
  });

  const [operationError, setOperationError] = useState<string | null>(null);
  const [operationSuccess, setOperationSuccess] = useState<string | null>(null);

  const fetchMetadata = async () => {
    try {
      const [usersData, branchesData] = await Promise.all([
        api.get('/api/v1/leads/meta/users'),
        api.get('/api/v1/leads/meta/branches')
      ]);
      setUsers(usersData || []);
      setBranches(branchesData || []);
    } catch (err) {
      console.error('Failed to load metadata', err);
    }
  };

  const fetchLeads = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (q) params.set('q', q);
      if (statusFilter) params.set('status', statusFilter);
      if (sourceFilter) params.set('source', sourceFilter);
      if (branchFilter) params.set('branchId', branchFilter);
      if (countryFilter) params.set('targetCountry', countryFilter);
      if (intakeFilter) params.set('intake', intakeFilter);
      if (categoryFilter) params.set('leadCategory', categoryFilter);

      const res = await api.get(`/api/v1/leads?${params.toString()}`);
      setLeads(res || []);
      setSelectedIds([]); // clear selection
      setCurrentPage(1); // reset to page 1
    } catch (err) {
      console.error('Failed to load leads', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMetadata();
  }, []);

  useEffect(() => {
    fetchLeads();
  }, [q, statusFilter, sourceFilter, branchFilter, countryFilter, intakeFilter, categoryFilter]);

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedIds(leads.map((l) => l.id));
    } else {
      setSelectedIds([]);
    }
  };

  const handleSelectOne = (id: string, checked: boolean) => {
    if (checked) {
      setSelectedIds((prev) => [...prev, id]);
    } else {
      setSelectedIds((prev) => prev.filter((item) => item !== id));
    }
  };

  // Bulk Actions
  const handleBulkAssign = async () => {
    if (!bulkAssignee || !bulkBranch) {
      setOperationError('Please select both assignee and branch.');
      return;
    }
    setOperationError(null);
    setOperationSuccess(null);
    try {
      await api.patch('/api/v1/leads/bulk-assign', {
        leadIds: selectedIds,
        assigneeId: bulkAssignee,
        branchId: bulkBranch,
      });
      setOperationSuccess(`Successfully allocated ${selectedIds.length} leads.`);
      setBulkActionType(null);
      setSelectedIds([]);
      fetchLeads();
    } catch (err: any) {
      setOperationError(err.message || 'Bulk assignment failed.');
    }
  };

  const handleBulkStatusUpdate = async () => {
    if (!bulkStatus) {
      setOperationError('Please select a status.');
      return;
    }
    setOperationError(null);
    setOperationSuccess(null);
    try {
      await api.patch('/api/v1/leads/bulk-status', {
        leadIds: selectedIds,
        status: bulkStatus,
      });
      setOperationSuccess(`Successfully updated status for ${selectedIds.length} leads.`);
      setBulkActionType(null);
      setSelectedIds([]);
      fetchLeads();
    } catch (err: any) {
      setOperationError(err.message || 'Bulk status update failed.');
    }
  };

  const handleMergeLeads = async () => {
    if (selectedIds.length !== 2) {
      setOperationError('Merging requires exactly two duplicate leads.');
      return;
    }
    setOperationError(null);
    setOperationSuccess(null);
    try {
      await api.post('/api/v1/leads/merge', {
        primaryId: selectedIds[0],
        duplicateId: selectedIds[1],
      });
      setOperationSuccess('Leads merged successfully.');
      setBulkActionType(null);
      setSelectedIds([]);
      fetchLeads();
    } catch (err: any) {
      setOperationError(err.message || 'Merging leads failed.');
    }
  };

  // Create Lead
  const handleCreateLead = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createForm.firstName || !createForm.phone) {
      setOperationError('First Name and Phone are required.');
      return;
    }
    setOperationError(null);
    setOperationSuccess(null);
    try {
      const payload: any = {
        firstName: createForm.firstName,
        lastName: createForm.lastName || undefined,
        email: createForm.email || undefined,
        phone: createForm.phone,
        source: createForm.source,
        branchId: createForm.branchId || undefined,
        leadCategory: createForm.leadCategory,
        preferredCountry: createForm.preferredCountry || undefined,
        planningTimeline: createForm.planningTimeline || undefined,
        intendedIntake: createForm.intendedIntake || undefined,
        englishLevel: createForm.englishLevel || undefined,
        targetScore: createForm.targetScore || undefined,
        purpose: createForm.purpose || undefined,
        courseInterest: createForm.courseInterest || undefined,
      };

      if (createForm.preferredCountry || createForm.leadCategory || createForm.intendedIntake) {
        payload.studentProfile = {
          targetCountry: createForm.preferredCountry || undefined,
          targetCourse: createForm.leadCategory || undefined,
          intake: createForm.intendedIntake || undefined,
        };
      }

      await api.post('/api/v1/leads', payload);
      setOperationSuccess('Lead created successfully.');
      setShowCreateModal(false);
      // Reset form
      setCreateForm({
        firstName: '',
        lastName: '',
        email: '',
        phone: '',
        source: 'MANUAL',
        branchId: '',
        leadCategory: 'STUDY_ABROAD',
        preferredCountry: '',
        planningTimeline: '',
        intendedIntake: '',
        englishLevel: '',
        targetScore: '',
        purpose: '',
        courseInterest: ''
      });
      fetchLeads();
    } catch (err: any) {
      setOperationError(err.message || 'Failed to create lead.');
    }
  };

  // Slice leads for pagination
  const totalPages = Math.ceil(leads.length / itemsPerPage);
  const currentLeads = leads.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', paddingBottom: '30px' }}>
      
      {/* Action Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px 10px 20px' }}>
        <div>
          <h2 style={{ fontSize: '15px', fontWeight: 700 }}>Students & Leads Registry</h2>
          <p style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
            Search, filter, view and manage all student candidate profiles.
          </p>
        </div>
        <button onClick={() => { setOperationError(null); setShowCreateModal(true); }} className="btn btn-primary">
          ➕ New Lead
        </button>
      </div>

      {/* Notifications banner */}
      {(operationError || operationSuccess) && (
        <div style={{ padding: '0 20px 10px 20px' }}>
          {operationError && (
            <div style={{ backgroundColor: '#fee2e2', color: '#991b1b', border: '1px solid #fca5a5', padding: '8px 12px', borderRadius: '4px', fontSize: '11px' }}>
              ⚠️ {operationError}
            </div>
          )}
          {operationSuccess && (
            <div style={{ backgroundColor: '#dcfce7', color: '#166534', border: '1px solid #86efac', padding: '8px 12px', borderRadius: '4px', fontSize: '11px' }}>
              ✓ {operationSuccess}
            </div>
          )}
        </div>
      )}

      {/* Search & Advanced Filters Row */}
      <section style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', padding: '0 20px 12px 20px', alignItems: 'center', borderBottom: '1px solid var(--border-color)' }}>
        <input
          type="text"
          placeholder="Search Name, Phone, Email..."
          className="form-control"
          style={{ width: '200px' }}
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />

        <select className="form-control" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="">-- All Statuses --</option>
          <option value="NEW_LEAD">New Lead</option>
          <option value="CONTACTED">Contacted</option>
          <option value="COUNSELLING">Counselling</option>
          <option value="DEMO_CLASS">Demo Class</option>
          <option value="DEMO_SESSION">Demo Session</option>
          <option value="ENROLLED">Enrolled</option>
          <option value="TRAINING">Training</option>
          <option value="EXAM_BOOKED">Exam Booked</option>
          <option value="COURSE_ONGOING">Course Ongoing</option>
          <option value="COMPLETED">Completed</option>
          <option value="DOCUMENTS_PENDING">Documents Pending</option>
          <option value="DOCUMENTS_RECEIVED">Documents Received</option>
          <option value="UNIVERSITY_APPLIED">University Applied</option>
          <option value="OFFER_LETTER">Offer Letter</option>
          <option value="VISA_PROCESS">Visa Process</option>
          <option value="ADMISSION_CLOSED">Admission Closed</option>
          <option value="LOST">Lost</option>
        </select>

        <select className="form-control" value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
          <option value="">-- All Categories --</option>
          <option value="STUDY_ABROAD">Study Abroad</option>
          <option value="IELTS">IELTS</option>
          <option value="PTE">PTE</option>
          <option value="ENGLISH_SPEAKING">English Speaking</option>
          <option value="COMPUTER_COURSE">Computer Course</option>
          <option value="DIGITAL_MARKETING">Digital Marketing</option>
          <option value="OTHER">Other</option>
        </select>

        <select className="form-control" value={sourceFilter} onChange={(e) => setSourceFilter(e.target.value)}>
          <option value="">-- All Sources --</option>
          <option value="WEBSITE_SDK">Website SDK</option>
          <option value="WHATSAPP">WhatsApp</option>
          <option value="TELEPHONY">Telephony</option>
          <option value="MANUAL">Manual Ingress</option>
          <option value="API_IMPORT">API Import</option>
          <option value="FACEBOOK_ADS">Facebook Ads</option>
          <option value="DYNAMIC_FORM">Dynamic Form</option>
        </select>

        <select className="form-control" value={branchFilter} onChange={(e) => setBranchFilter(e.target.value)}>
          <option value="">-- All Branches --</option>
          {branches.map((b) => (
            <option key={b.id} value={b.id}>{b.name}</option>
          ))}
        </select>

        <input
          type="text"
          placeholder="Country"
          className="form-control"
          style={{ width: '100px' }}
          value={countryFilter}
          onChange={(e) => setCountryFilter(e.target.value)}
        />

        <input
          type="text"
          placeholder="Intake"
          className="form-control"
          style={{ width: '90px' }}
          value={intakeFilter}
          onChange={(e) => setIntakeFilter(e.target.value)}
        />
      </section>

      {/* Bulk Actions Panel */}
      {selectedIds.length > 0 && (
        <div style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid var(--border-color)', padding: '8px 20px', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ fontWeight: 600, fontSize: '11px', color: 'var(--text-muted)' }}>
            Selected: {selectedIds.length} candidate(s)
          </span>

          <div style={{ display: 'flex', gap: '6px' }}>
            <button className={`btn btn-sm ${bulkActionType === 'assign' ? 'btn-primary' : ''}`} onClick={() => setBulkActionType('assign')}>
              Allocations
            </button>
            <button className={`btn btn-sm ${bulkActionType === 'status' ? 'btn-primary' : ''}`} onClick={() => setBulkActionType('status')}>
              Change Status
            </button>
            {selectedIds.length === 2 && (
              <button className={`btn btn-sm ${bulkActionType === 'merge' ? 'btn-primary' : ''}`} onClick={() => setBulkActionType('merge')}>
                Merge Duplicates
              </button>
            )}
          </div>

          {bulkActionType === 'assign' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginLeft: '20px' }}>
              <select className="form-control" style={{ padding: '2px 6px' }} value={bulkAssignee} onChange={(e) => setBulkAssignee(e.target.value)}>
                <option value="">-- Agent --</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>{u.firstName} {u.lastName}</option>
                ))}
              </select>
              <select className="form-control" style={{ padding: '2px 6px' }} value={bulkBranch} onChange={(e) => setBulkBranch(e.target.value)}>
                <option value="">-- Branch --</option>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
              <button className="btn btn-primary btn-sm" onClick={handleBulkAssign}>
                Apply
              </button>
            </div>
          )}

          {bulkActionType === 'status' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginLeft: '20px' }}>
              <select className="form-control" style={{ padding: '2px 6px' }} value={bulkStatus} onChange={(e) => setBulkStatus(e.target.value)}>
                <option value="">-- Status --</option>
                <option value="NEW_LEAD">New Lead</option>
                <option value="CONTACTED">Contacted</option>
                <option value="COUNSELLING_SCHEDULED">Counselling Scheduled</option>
                <option value="COUNSELLING_COMPLETED">Counselling Completed</option>
                <option value="DOCUMENTS_PENDING">Documents Pending</option>
                <option value="DOCUMENTS_RECEIVED">Documents Received</option>
                <option value="UNIVERSITY_APPLIED">University Applied</option>
                <option value="OFFER_LETTER_RECEIVED">Offer Letter Received</option>
                <option value="OFFER_ACCEPTED">Offer Accepted</option>
                <option value="VISA_PROCESS">Visa Process</option>
                <option value="VISA_APPROVED">Visa Approved</option>
                <option value="ADMISSION_CLOSED">Admission Closed</option>
                <option value="LOST_NOT_INTERESTED">Lost / Not Interested</option>
              </select>
              <button className="btn btn-primary btn-sm" onClick={handleBulkStatusUpdate}>
                Apply
              </button>
            </div>
          )}

          {bulkActionType === 'merge' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginLeft: '20px' }}>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                Merge duplicate (ID 2) into primary (ID 1).
              </span>
              <button className="btn btn-danger btn-sm" onClick={handleMergeLeads}>
                Confirm Merge
              </button>
            </div>
          )}
        </div>
      )}

      {/* Main Leads Table */}
      <div style={{ flexGrow: 1, overflowY: 'auto' }}>
        <div className="table-container" style={{ margin: '16px 20px 0 20px', maxHeight: '580px', overflowY: 'auto', borderBottom: 'none', borderBottomLeftRadius: 0, borderBottomRightRadius: 0 }}>
          {loading ? (
            <div style={{ padding: '40px', textAlign: 'center', fontWeight: 600 }}>
              Querying database leads records...
            </div>
          ) : leads.length === 0 ? (
            <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
              No leads match the filters.
            </div>
          ) : (
            <table className="dense-table" style={{ position: 'relative' }}>
              <thead style={{ position: 'sticky', top: 0, zIndex: 10, background: '#f8fafc', boxShadow: '0 1px 0 var(--border-color)' }}>
                <tr>
                  <th style={{ width: '40px' }}>
                    <input
                      type="checkbox"
                      checked={selectedIds.length === leads.length && leads.length > 0}
                      onChange={handleSelectAll}
                    />
                  </th>
                  <th>Name</th>
                  <th>Readiness</th>
                  <th>Phone</th>
                  <th>Category</th>
                  <th>Country</th>
                  <th>Course</th>
                  <th>Status</th>
                  <th>Next Followup</th>
                  <th>Created Date</th>
                  <th>Source</th>
                </tr>
              </thead>
              <tbody>
                {currentLeads.map((lead) => {
                  const nextFollowup = lead.followups?.[0];
                  return (
                    <tr key={lead.id}>
                      <td>
                        <input
                          type="checkbox"
                          checked={selectedIds.includes(lead.id)}
                          onChange={(e) => handleSelectOne(lead.id, e.target.checked)}
                        />
                      </td>
                      <td>
                        <a
                          href={`/dashboard/leads/${lead.id}`}
                          style={{ color: 'var(--primary-color)', fontWeight: 600, textDecoration: 'none' }}
                        >
                          {lead.firstName || '—'} {lead.lastName || ''}
                          {lead.submissionCount && (
                            <span style={{ marginLeft: '6px', fontSize: '11px', color: '#475569', backgroundColor: '#f1f5f9', border: '1px solid #cbd5e1', padding: '1px 5px', borderRadius: '4px', fontWeight: 600 }}>
                              [{lead.submissionCount}]
                            </span>
                          )}
                        </a>
                      </td>
                      <td>
                        <span
                          className="badge"
                          style={{
                            backgroundColor:
                              (lead.readinessScore ?? 0) >= 80 ? '#dcfce7' : (lead.readinessScore ?? 0) >= 50 ? '#fef9c3' : '#fee2e2',
                            color:
                              (lead.readinessScore ?? 0) >= 80 ? '#166534' : (lead.readinessScore ?? 0) >= 50 ? '#854d0e' : '#991b1b',
                            fontWeight: 700
                          }}
                        >
                          {lead.readinessScore ?? 0}%
                        </span>
                      </td>
                      <td>{lead.phone || '—'}</td>
                      <td>
                        <span className="badge" style={{ backgroundColor: '#f1f5f9', color: '#334155', border: '1px solid var(--border-color)' }}>
                          {lead.leadCategory ? lead.leadCategory.replace(/_/g, ' ') : 'STUDY ABROAD'}
                        </span>
                      </td>
                      <td>{lead.studentProfile?.targetCountry || '—'}</td>
                      <td>{lead.studentProfile?.targetCourse || '—'}</td>
                      <td>
                        <span className={`badge badge-${lead.status.toLowerCase()}`}>
                          {lead.status}
                        </span>
                      </td>
                      <td>
                        {nextFollowup ? (
                          <span style={{ fontSize: '11px', fontWeight: 500 }}>
                            {new Date(nextFollowup.followupDate).toLocaleDateString()}
                          </span>
                        ) : (
                          <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>—</span>
                        )}
                      </td>
                      <td>
                        {new Date(lead.createdAt).toLocaleDateString()}
                      </td>
                      <td>{lead.source}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Pagination Controls */}
        {!loading && leads.length > 0 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 16px', background: '#f8fafc', border: '1px solid var(--border-color)', borderTop: 'none', margin: '0 20px 20px 20px', borderBottomLeftRadius: '4px', borderBottomRightRadius: '4px', fontSize: '12px' }}>
            <div>
              Showing {Math.min((currentPage - 1) * itemsPerPage + 1, leads.length)} to {Math.min(currentPage * itemsPerPage, leads.length)} of {leads.length} candidates
            </div>
            <div style={{ display: 'flex', gap: '4px' }}>
              <button disabled={currentPage === 1} onClick={() => setCurrentPage(p => Math.max(p - 1, 1))} className="btn btn-sm">
                Previous
              </button>
              <span style={{ padding: '4px 8px', alignSelf: 'center', fontWeight: 600 }}>
                Page {currentPage} of {totalPages || 1}
              </span>
              <button disabled={currentPage === totalPages || totalPages === 0} onClick={() => setCurrentPage(p => Math.min(p + 1, totalPages))} className="btn btn-sm">
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ================= NEW LEAD MODAL POPUP ================= */}
      {showCreateModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <form onSubmit={handleCreateLead} style={{ backgroundColor: '#fff', borderRadius: '4px', border: '1px solid var(--border-color)', padding: '20px', width: '450px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <h3 style={{ fontSize: '14px', fontWeight: 700, margin: 0, borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>➕ Add New Candidate Lead</h3>
            
            {operationError && <div style={{ color: 'var(--danger-color)', fontSize: '11px', fontWeight: 600 }}>{operationError}</div>}

            <div style={{ display: 'flex', gap: '10px' }}>
              <div className="form-group" style={{ flex: 1 }}>
                <label>First Name *</label>
                <input
                  type="text"
                  className="form-control"
                  required
                  value={createForm.firstName}
                  onChange={(e) => setCreateForm({ ...createForm, firstName: e.target.value })}
                />
              </div>
              <div className="form-group" style={{ flex: 1 }}>
                <label>Last Name</label>
                <input
                  type="text"
                  className="form-control"
                  value={createForm.lastName}
                  onChange={(e) => setCreateForm({ ...createForm, lastName: e.target.value })}
                />
              </div>
            </div>

            <div style={{ display: 'flex', gap: '10px' }}>
              <div className="form-group" style={{ flex: 1 }}>
                <label>Phone Number *</label>
                <input
                  type="text"
                  className="form-control"
                  required
                  placeholder="+12345..."
                  value={createForm.phone}
                  onChange={(e) => setCreateForm({ ...createForm, phone: e.target.value })}
                />
              </div>
              <div className="form-group" style={{ flex: 1 }}>
                <label>Email Address</label>
                <input
                  type="email"
                  className="form-control"
                  value={createForm.email}
                  onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })}
                />
              </div>
            </div>

            <div style={{ display: 'flex', gap: '10px' }}>
              <div className="form-group" style={{ flex: 1 }}>
                <label>Lead Category *</label>
                <select className="form-control" value={createForm.leadCategory} onChange={(e) => setCreateForm({ ...createForm, leadCategory: e.target.value })}>
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
                <select className="form-control" value={createForm.source} onChange={(e) => setCreateForm({ ...createForm, source: e.target.value })}>
                  <option value="MANUAL">Manual</option>
                  <option value="WEBSITE_SDK">Website SDK</option>
                  <option value="WHATSAPP">WhatsApp</option>
                  <option value="TELEPHONY">Telephony</option>
                  <option value="FACEBOOK_ADS">Facebook Ads</option>
                </select>
              </div>
            </div>

            {/* Category-Specific Fields */}
            {createForm.leadCategory === 'STUDY_ABROAD' && (
              <>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <div className="form-group" style={{ flex: 1 }}>
                    <label>Preferred Country</label>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="e.g. Canada"
                      value={createForm.preferredCountry}
                      onChange={(e) => setCreateForm({ ...createForm, preferredCountry: e.target.value })}
                    />
                  </div>
                  <div className="form-group" style={{ flex: 1 }}>
                    <label>Intended Intake</label>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="e.g. Fall 2026"
                      value={createForm.intendedIntake}
                      onChange={(e) => setCreateForm({ ...createForm, intendedIntake: e.target.value })}
                    />
                  </div>
                </div>
                <div className="form-group">
                  <label>Planning Timeline</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="e.g. Within 3 Months"
                    value={createForm.planningTimeline}
                    onChange={(e) => setCreateForm({ ...createForm, planningTimeline: e.target.value })}
                  />
                </div>
              </>
            )}

            {(createForm.leadCategory === 'IELTS' || createForm.leadCategory === 'PTE') && (
              <div style={{ display: 'flex', gap: '10px' }}>
                <div className="form-group" style={{ flex: 1 }}>
                  <label>English Level</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="e.g. Intermediate"
                    value={createForm.englishLevel}
                    onChange={(e) => setCreateForm({ ...createForm, englishLevel: e.target.value })}
                  />
                </div>
                <div className="form-group" style={{ flex: 1 }}>
                  <label>Target Score</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="e.g. 7.5 or 70"
                    value={createForm.targetScore}
                    onChange={(e) => setCreateForm({ ...createForm, targetScore: e.target.value })}
                  />
                </div>
              </div>
            )}

            {createForm.leadCategory === 'ENGLISH_SPEAKING' && (
              <div className="form-group">
                <label>Purpose</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="e.g. Interview preparation"
                  value={createForm.purpose}
                  onChange={(e) => setCreateForm({ ...createForm, purpose: e.target.value })}
                />
              </div>
            )}

            {(createForm.leadCategory === 'COMPUTER_COURSE' || createForm.leadCategory === 'DIGITAL_MARKETING') && (
              <div className="form-group">
                <label>Course Interested In</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="e.g. Full Stack Development"
                  value={createForm.courseInterest}
                  onChange={(e) => setCreateForm({ ...createForm, courseInterest: e.target.value })}
                />
              </div>
            )}

            <div className="form-group">
              <label>Scoping Branch</label>
              <select className="form-control" value={createForm.branchId} onChange={(e) => setCreateForm({ ...createForm, branchId: e.target.value })}>
                <option value="">-- None --</option>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '12px' }}>
              <button type="button" className="btn" onClick={() => setShowCreateModal(false)}>Cancel</button>
              <button type="submit" className="btn btn-primary">Save Lead</button>
            </div>
          </form>
        </div>
      )}

    </div>
  );
}
