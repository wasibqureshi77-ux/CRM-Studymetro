'use client';

import React, { useState, useEffect } from 'react';
import { api } from '../../../lib/api';
import { useAuth } from '../../../context/auth-context';

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
  ],
};

function getProgressPercentage(status: string, category: string): number {
  let activeStatus = status;
  if (status === 'ENROLLED' && (!category || category === 'STUDY_ABROAD')) {
    activeStatus = 'ADMISSION_CLOSED';
  }
  const stages = PIPELINE_CONFIG[category || 'STUDY_ABROAD'] || PIPELINE_CONFIG.STUDY_ABROAD;
  if (activeStatus === 'LOST') return 0;
  const nonLostStages = stages.filter(s => s.code !== 'LOST');
  const nonLostIndex = nonLostStages.findIndex(s => s.code === activeStatus);
  if (nonLostIndex === -1) return 0;
  if (nonLostStages.length <= 1) return 100;
  return Math.round((nonLostIndex / (nonLostStages.length - 1)) * 100);
}

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
  const [targetScoreFilter, setTargetScoreFilter] = useState('');
  const [planningTimelineFilter, setPlanningTimelineFilter] = useState('');
  const [purposeFilter, setPurposeFilter] = useState('');
  const [courseInterestFilter, setCourseInterestFilter] = useState('');

  // University Applications Filters
  const [appUniversityFilter, setAppUniversityFilter] = useState('');
  const [appCountryFilter, setAppCountryFilter] = useState('');
  const [appCourseFilter, setAppCourseFilter] = useState('');
  const [appIntakeFilter, setAppIntakeFilter] = useState('');
  const [appStatusFilter, setAppStatusFilter] = useState('');
  const [appOfferStatusFilter, setAppOfferStatusFilter] = useState('');
  const [appVisaStatusFilter, setAppVisaStatusFilter] = useState('');

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 12;

  // Bulk Selection State
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Mobile state hooks
  const [showMobileFilters, setShowMobileFilters] = useState(false);
  const [isMobileSelectionMode, setIsMobileSelectionMode] = useState(false);
  const [mobileItemsLimit, setMobileItemsLimit] = useState(12);

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
      if (targetScoreFilter) params.set('targetScore', targetScoreFilter);
      if (planningTimelineFilter) params.set('planningTimeline', planningTimelineFilter);
      if (purposeFilter) params.set('purpose', purposeFilter);
      if (courseInterestFilter) params.set('courseInterest', courseInterestFilter);

      // Bind university application filters
      if (categoryFilter === 'STUDY_ABROAD') {
        if (appUniversityFilter) params.set('appUniversity', appUniversityFilter);
        if (appCountryFilter) params.set('appCountry', appCountryFilter);
        if (appCourseFilter) params.set('appCourse', appCourseFilter);
        if (appIntakeFilter) params.set('appIntake', appIntakeFilter);
        if (appStatusFilter) params.set('applicationStatus', appStatusFilter);
        if (appOfferStatusFilter) params.set('offerStatus', appOfferStatusFilter);
        if (appVisaStatusFilter) params.set('visaStatus', appVisaStatusFilter);
      }

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
    setCountryFilter('');
    setIntakeFilter('');
    setTargetScoreFilter('');
    setPlanningTimelineFilter('');
    setPurposeFilter('');
    setCourseInterestFilter('');
    
    // Clear application filters
    setAppUniversityFilter('');
    setAppCountryFilter('');
    setAppCourseFilter('');
    setAppIntakeFilter('');
    setAppStatusFilter('');
    setAppOfferStatusFilter('');
    setAppVisaStatusFilter('');
  }, [categoryFilter]);

  useEffect(() => {
    fetchLeads();
  }, [q, statusFilter, sourceFilter, branchFilter, countryFilter, intakeFilter, categoryFilter, targetScoreFilter, planningTimelineFilter, purposeFilter, courseInterestFilter, appUniversityFilter, appCountryFilter, appCourseFilter, appIntakeFilter, appStatusFilter, appOfferStatusFilter, appVisaStatusFilter]);

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

    const RESTRICTED_STAGES = [
      'DOCUMENTS_RECEIVED',
      'UNIVERSITY_APPLIED',
      'OFFER_LETTER',
      'VISA_PROCESS',
      'ADMISSION_CLOSED'
    ];
    if (RESTRICTED_STAGES.includes(bulkStatus)) {
      const unreadyLeads = leads.filter(l => selectedIds.includes(l.id) && (l.readinessScore ?? 0) < 100);
      if (unreadyLeads.length > 0) {
        const names = unreadyLeads.map(l => `${l.firstName} ${l.lastName || ''}`.trim()).join(', ');
        setOperationError(`Cannot update status. The following leads do not have 100% verified documents: ${names}`);
        return;
      }
    }

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
    <>
      {/* DESKTOP LEADS VIEW */}
      <div className="desktop-only-leads">
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
            placeholder="Search Ref ID, Name, Phone, Email..."
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

          {categoryFilter === 'STUDY_ABROAD' && (
            <>
              <input
                type="text"
                placeholder="Pref Country"
                className="form-control"
                style={{ width: '110px' }}
                value={countryFilter}
                onChange={(e) => setCountryFilter(e.target.value)}
              />
              <input
                type="text"
                placeholder="Pref Intake"
                className="form-control"
                style={{ width: '100px' }}
                value={intakeFilter}
                onChange={(e) => setIntakeFilter(e.target.value)}
              />
              <input
                type="text"
                placeholder="Timeline"
                className="form-control"
                style={{ width: '90px' }}
                value={planningTimelineFilter}
                onChange={(e) => setPlanningTimelineFilter(e.target.value)}
              />
              <input
                type="text"
                placeholder="University"
                className="form-control"
                style={{ width: '120px' }}
                value={appUniversityFilter}
                onChange={(e) => setAppUniversityFilter(e.target.value)}
              />
              <input
                type="text"
                placeholder="App Course"
                className="form-control"
                style={{ width: '110px' }}
                value={appCourseFilter}
                onChange={(e) => setAppCourseFilter(e.target.value)}
              />
              <input
                type="text"
                placeholder="App Country"
                className="form-control"
                style={{ width: '110px' }}
                value={appCountryFilter}
                onChange={(e) => setAppCountryFilter(e.target.value)}
              />
              <input
                type="text"
                placeholder="App Intake"
                className="form-control"
                style={{ width: '100px' }}
                value={appIntakeFilter}
                onChange={(e) => setAppIntakeFilter(e.target.value)}
              />
              <select
                className="form-control"
                value={appStatusFilter}
                onChange={(e) => setAppStatusFilter(e.target.value)}
              >
                <option value="">-- App Status --</option>
                <option value="SHORTLISTED">Shortlisted</option>
                <option value="APPLICATION_STARTED">App Started</option>
                <option value="APPLICATION_SUBMITTED">App Submitted</option>
                <option value="UNDER_REVIEW">Under Review</option>
                <option value="DECISION_RECEIVED">Decision Received</option>
              </select>
              <select
                className="form-control"
                value={appOfferStatusFilter}
                onChange={(e) => setAppOfferStatusFilter(e.target.value)}
              >
                <option value="">-- Offer Status --</option>
                <option value="NONE">None</option>
                <option value="CONDITIONAL_OFFER">Conditional</option>
                <option value="UNCONDITIONAL_OFFER">Unconditional</option>
                <option value="OFFER_ACCEPTED">Accepted</option>
                <option value="OFFER_REJECTED">Rejected</option>
              </select>
              <select
                className="form-control"
                value={appVisaStatusFilter}
                onChange={(e) => setAppVisaStatusFilter(e.target.value)}
              >
                <option value="">-- Visa Status --</option>
                <option value="NOT_STARTED">Not Started</option>
                <option value="VISA_APPLIED">Visa Applied</option>
                <option value="VISA_BIOMETRICS">Biometrics</option>
                <option value="VISA_APPROVED">Visa Approved</option>
                <option value="VISA_REJECTED">Visa Rejected</option>
              </select>
            </>
          )}

          {(categoryFilter === 'IELTS' || categoryFilter === 'PTE') && (
            <input
              type="text"
              placeholder="Target Score"
              className="form-control"
              style={{ width: '110px' }}
              value={targetScoreFilter}
              onChange={(e) => setTargetScoreFilter(e.target.value)}
            />
          )}

          {categoryFilter === 'ENGLISH_SPEAKING' && (
            <input
              type="text"
              placeholder="Purpose"
              className="form-control"
              style={{ width: '120px' }}
              value={purposeFilter}
              onChange={(e) => setPurposeFilter(e.target.value)}
            />
          )}

          {categoryFilter === 'COMPUTER_COURSE' && (
            <input
              type="text"
              placeholder="Course Interest"
              className="form-control"
              style={{ width: '135px' }}
              value={courseInterestFilter}
              onChange={(e) => setCourseInterestFilter(e.target.value)}
            />
          )}
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
                    <th>Ref ID</th>
                    <th>Name</th>
                    <th>Progress</th>
                    <th>Phone</th>
                    <th>Category</th>
                    <th>Program Details</th>
                    <th>Status</th>
                    <th>Next Followup</th>
                    <th>Created Date</th>
                    <th>Source</th>
                  </tr>
                </thead>
                <tbody>
                  {(() => {
                    const getProgramDetails = (lead: any) => {
                      const cat = lead.leadCategory || 'STUDY_ABROAD';
                      switch (cat) {
                        case 'STUDY_ABROAD':
                          const country = lead.preferredCountry || lead.studentProfile?.targetCountry || '—';
                          const courseStr = lead.preferredCourse || lead.studentProfile?.targetCourse || '—';
                          return `${country} | ${courseStr}`;
                        case 'IELTS':
                        case 'PTE':
                          return `Target ${lead.targetScore || '—'}`;
                        case 'ENGLISH_SPEAKING':
                          return lead.purpose || '—';
                        case 'COMPUTER_COURSE':
                          return lead.courseInterest || '—';
                        case 'DIGITAL_MARKETING':
                          return 'Digital Marketing';
                        case 'OTHER':
                        default:
                          return 'Other';
                      }
                    };

                    return currentLeads.map((lead) => {
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
                          <td style={{ fontWeight: 600 }}>{lead.leadNumber || '—'}</td>
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
                            {(() => {
                              const progressVal = getProgressPercentage(lead.status, lead.leadCategory || 'STUDY_ABROAD');
                              return (
                                <span
                                  className="badge"
                                  style={{
                                    backgroundColor:
                                      progressVal >= 80 ? '#dcfce7' : progressVal >= 50 ? '#fef9c3' : '#fee2e2',
                                    color:
                                      progressVal >= 80 ? '#166534' : progressVal >= 50 ? '#854d0e' : '#991b1b',
                                    fontWeight: 700
                                  }}
                                >
                                  {progressVal}%
                                </span>
                              );
                            })()}
                          </td>
                          <td>{lead.phone || '—'}</td>
                          <td>
                            <span className="badge" style={{ backgroundColor: '#f1f5f9', color: '#334155', border: '1px solid var(--border-color)' }}>
                              {lead.leadCategory ? lead.leadCategory.replace(/_/g, ' ') : 'STUDY_ABROAD'}
                            </span>
                          </td>
                          <td>{getProgramDetails(lead)}</td>
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
                    });
                  })()}
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
      </div>

      {/* MOBILE LEADS VIEW */}
      <div className="mobile-only-leads" style={{ paddingBottom: '80px', display: 'flex', flexDirection: 'column' }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', borderBottom: '1px solid var(--border-color)', backgroundColor: '#fff' }}>
          <div>
            <h2 style={{ fontSize: '15px', fontWeight: 700, margin: 0 }}>Candidates</h2>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{leads.length} total profiles</span>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button 
              onClick={() => setIsMobileSelectionMode(!isMobileSelectionMode)}
              style={{
                padding: '6px 12px',
                borderRadius: '6px',
                border: '1px solid var(--border-color)',
                backgroundColor: isMobileSelectionMode ? 'var(--primary-color)' : '#fff',
                color: isMobileSelectionMode ? '#fff' : '#475569',
                fontSize: '11px',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              {isMobileSelectionMode ? 'Cancel' : 'Select'}
            </button>
            <button 
              onClick={() => { setOperationError(null); setShowCreateModal(true); }}
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
              ➕ Add
            </button>
          </div>
        </div>

        {/* Notifications */}
        {(operationError || operationSuccess) && (
          <div style={{ padding: '8px 16px' }}>
            {operationError && (
              <div style={{ backgroundColor: '#fee2e2', color: '#991b1b', padding: '8px 12px', borderRadius: '6px', fontSize: '11px' }}>
                ⚠️ {operationError}
              </div>
            )}
            {operationSuccess && (
              <div style={{ backgroundColor: '#dcfce7', color: '#166534', padding: '8px 12px', borderRadius: '6px', fontSize: '11px' }}>
                ✓ {operationSuccess}
              </div>
            )}
          </div>
        )}

        {/* Search & Filter Toolbar */}
        <div style={{ display: 'flex', gap: '8px', padding: '12px 16px', backgroundColor: '#fff', borderBottom: '1px solid var(--border-color)' }}>
          <input
            type="text"
            placeholder="Search leads by name, phone..."
            className="form-control"
            style={{ flex: 1, height: '36px', fontSize: '13px' }}
            value={q}
            onChange={(e) => setQ(e.target.value)}
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
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            ⚙️ Filters
          </button>
        </div>

        {/* Mobile Bulk actions overlay bar */}
        {isMobileSelectionMode && selectedIds.length > 0 && (
          <div style={{ backgroundColor: '#eff6ff', borderBottom: '1px solid #bfdbfe', padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontWeight: 700, fontSize: '11px', color: '#1e3a8a' }}>
                Selected: {selectedIds.length} candidate(s)
              </span>
              <button 
                onClick={() => setSelectedIds(leads.map(l => l.id))}
                style={{ background: 'none', border: 'none', color: 'var(--primary-color)', fontSize: '11px', fontWeight: 600, cursor: 'pointer' }}
              >
                Select All
              </button>
            </div>
            <div style={{ display: 'flex', gap: '6px' }}>
              <button 
                className="btn btn-sm" 
                style={{ flex: 1, padding: '8px', fontSize: '11px', backgroundColor: '#fff', border: '1px solid #cbd5e1' }}
                onClick={() => setBulkActionType(bulkActionType === 'assign' ? null : 'assign')}
              >
                Allocations
              </button>
              <button 
                className="btn btn-sm" 
                style={{ flex: 1, padding: '8px', fontSize: '11px', backgroundColor: '#fff', border: '1px solid #cbd5e1' }}
                onClick={() => setBulkActionType(bulkActionType === 'status' ? null : 'status')}
              >
                Change Status
              </button>
              {selectedIds.length === 2 && (
                <button 
                  className="btn btn-sm btn-danger" 
                  style={{ flex: 1, padding: '8px', fontSize: '11px' }}
                  onClick={() => setBulkActionType(bulkActionType === 'merge' ? null : 'merge')}
                >
                  Merge
                </button>
              )}
            </div>

            {bulkActionType === 'assign' && (
              <div style={{ display: 'flex', gap: '6px', marginTop: '4px' }}>
                <select className="form-control" style={{ flex: 1, padding: '6px' }} value={bulkAssignee} onChange={(e) => setBulkAssignee(e.target.value)}>
                  <option value="">Agent</option>
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>{u.firstName} {u.lastName}</option>
                  ))}
                </select>
                <select className="form-control" style={{ flex: 1, padding: '6px' }} value={bulkBranch} onChange={(e) => setBulkBranch(e.target.value)}>
                  <option value="">Branch</option>
                  {branches.map((b) => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
                <button className="btn btn-primary" style={{ padding: '6px 12px' }} onClick={handleBulkAssign}>
                  Apply
                </button>
              </div>
            )}

            {bulkActionType === 'status' && (
              <div style={{ display: 'flex', gap: '6px', marginTop: '4px' }}>
                <select className="form-control" style={{ flex: 1, padding: '6px' }} value={bulkStatus} onChange={(e) => setBulkStatus(e.target.value)}>
                  <option value="">Status</option>
                  <option value="NEW_LEAD">New Lead</option>
                  <option value="CONTACTED">Contacted</option>
                  <option value="COUNSELLING">Counselling</option>
                  <option value="DOCUMENTS_PENDING">Documents Pending</option>
                  <option value="DOCUMENTS_RECEIVED">Documents Received</option>
                  <option value="UNIVERSITY_APPLIED">University Applied</option>
                  <option value="OFFER_LETTER">Offer Letter</option>
                  <option value="VISA_PROCESS">Visa Process</option>
                  <option value="ADMISSION_CLOSED">Admission Closed</option>
                  <option value="LOST">Lost</option>
                </select>
                <button className="btn btn-primary" style={{ padding: '6px 12px' }} onClick={handleBulkStatusUpdate}>
                  Apply
                </button>
              </div>
            )}

            {bulkActionType === 'merge' && (
              <div style={{ display: 'flex', gap: '6px', marginTop: '4px', alignItems: 'center' }}>
                <span style={{ fontSize: '11px', color: '#1e3a8a', flex: 1 }}>Confirm merging duplicate into primary lead profile.</span>
                <button className="btn btn-danger" style={{ padding: '6px 12px' }} onClick={handleMergeLeads}>
                  Merge
                </button>
              </div>
            )}
          </div>
        )}

        {/* Lead Cards List Container */}
        <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {(() => {
            if (loading) {
              return (
                <div style={{ padding: '40px', textAlign: 'center', fontWeight: 600, color: 'var(--text-muted)' }}>
                  Loading database leads...
                </div>
              );
            }

            const mobileLeads = leads.slice(0, mobileItemsLimit);

            if (leads.length === 0) {
              return (
                <div style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '64px 20px',
                  backgroundColor: '#fff',
                  borderRadius: '12px',
                  border: '1px solid var(--border-color)',
                  textAlign: 'center',
                  color: 'var(--text-muted)'
                }}>
                  <span style={{ fontSize: '48px', marginBottom: '16px' }}>📂</span>
                  <h3 style={{ fontSize: '15px', fontWeight: 700, color: '#475569', margin: '0 0 6px 0' }}>No Leads Found</h3>
                  <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '0 0 16px 0', maxWidth: '250px' }}>
                    There are no lead candidate profiles in registry.
                  </p>
                  <button 
                    onClick={() => { setOperationError(null); setShowCreateModal(true); }}
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
                    Add Lead
                  </button>
                </div>
              );
            }

            const getProgramDetails = (lead: any) => {
              const cat = lead.leadCategory || 'STUDY_ABROAD';
              switch (cat) {
                case 'STUDY_ABROAD':
                  return lead.preferredCountry || lead.studentProfile?.targetCountry || '';
                case 'IELTS':
                case 'PTE':
                  return `Target ${lead.targetScore || ''}`;
                case 'ENGLISH_SPEAKING':
                  return lead.purpose || '';
                case 'COMPUTER_COURSE':
                  return lead.courseInterest || '';
                case 'DIGITAL_MARKETING':
                  return 'Digital Marketing';
                default:
                  return '';
              }
            };

            return (
              <>
                {mobileLeads.map((lead) => {
                  const progressVal = getProgressPercentage(lead.status, lead.leadCategory || 'STUDY_ABROAD');
                  
                  // Re-use PIPELINE_CONFIG stage colors dynamically
                  const catConfig = PIPELINE_CONFIG[lead.leadCategory || 'STUDY_ABROAD'] || PIPELINE_CONFIG.STUDY_ABROAD;
                  const matchedStage = catConfig.find(s => s.code === lead.status);
                  const stageColor = matchedStage ? matchedStage.color : '#64748b';

                  return (
                    <div
                      key={lead.id}
                      onClick={() => {
                        if (isMobileSelectionMode) {
                          const isSelected = selectedIds.includes(lead.id);
                          handleSelectOne(lead.id, !isSelected);
                        }
                      }}
                      style={{
                        backgroundColor: '#fff',
                        border: '1px solid ' + (selectedIds.includes(lead.id) ? 'var(--primary-color)' : 'var(--border-color)'),
                        borderRadius: '12px',
                        padding: '16px',
                        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.02), 0 2px 4px -1px rgba(0, 0, 0, 0.01)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '12px',
                        position: 'relative'
                      }}
                    >
                      {/* Selection Checkbox */}
                      {isMobileSelectionMode && (
                        <div style={{ position: 'absolute', top: '16px', right: '16px', zIndex: 10 }}>
                          <input 
                            type="checkbox" 
                            checked={selectedIds.includes(lead.id)} 
                            onChange={(e) => handleSelectOne(lead.id, e.target.checked)}
                            onClick={e => e.stopPropagation()}
                            style={{ width: '18px', height: '18px' }}
                          />
                        </div>
                      )}

                      {/* Header details */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', paddingRight: isMobileSelectionMode ? '28px' : '0' }}>
                        <div>
                          <a
                            href={`/dashboard/leads/${lead.id}`}
                            onClick={e => {
                              if (isMobileSelectionMode) {
                                e.preventDefault();
                              }
                            }}
                            style={{
                              fontSize: '14px',
                              fontWeight: 700,
                              color: '#1e293b',
                              textDecoration: 'none'
                            }}
                          >
                            👤 {lead.firstName} {lead.lastName || ''}
                          </a>
                          {lead.leadNumber && (
                            <div style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 600, marginTop: '2px' }}>
                              Ref: {lead.leadNumber}
                            </div>
                          )}
                        </div>
                        <span style={{
                          fontSize: '10px',
                          fontWeight: 700,
                          backgroundColor: progressVal >= 80 ? '#dcfce7' : progressVal >= 50 ? '#fef9c3' : '#fee2e2',
                          color: progressVal >= 80 ? '#166534' : progressVal >= 50 ? '#854d0e' : '#991b1b',
                          padding: '3px 8px',
                          borderRadius: '6px'
                        }}>
                          {progressVal}% Done
                        </span>
                      </div>

                      {/* Card Meta Content */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '12px', color: '#475569', borderTop: '1px solid #f1f5f9', paddingTop: '10px' }}>
                        {lead.phone && (
                          <div style={{ display: 'flex', gap: '6px' }}>
                            <span style={{ opacity: 0.6 }}>📞</span>
                            <span>{lead.phone}</span>
                          </div>
                        )}
                        <div style={{ display: 'flex', gap: '6px' }}>
                          <span style={{ opacity: 0.6 }}>💼</span>
                          <span>Category: {lead.leadCategory ? lead.leadCategory.replace(/_/g, ' ') : 'STUDY_ABROAD'}</span>
                        </div>
                        {getProgramDetails(lead) && (
                          <div style={{ display: 'flex', gap: '6px' }}>
                            <span style={{ opacity: 0.6 }}>🎯</span>
                            <span>Details: {getProgramDetails(lead)}</span>
                          </div>
                        )}
                        <div style={{ display: 'flex', gap: '6px' }}>
                          <span style={{ opacity: 0.6 }}>👤</span>
                          <span>Counsellor: {lead.assignedToUser?.name || 'Unassigned'}</span>
                        </div>
                        <div style={{ display: 'flex', gap: '6px' }}>
                          <span style={{ opacity: 0.6 }}>📅</span>
                          <span>Created: {new Date(lead.createdAt).toLocaleDateString()}</span>
                        </div>
                        {/* Status Badge */}
                        <div style={{ display: 'flex', gap: '6px', alignItems: 'center', marginTop: '4px' }}>
                          <span style={{ opacity: 0.6 }}>📍</span>
                          <span style={{
                            fontSize: '9px',
                            fontWeight: 700,
                            backgroundColor: stageColor + '15',
                            color: stageColor,
                            padding: '3px 8px',
                            borderRadius: '6px',
                            border: `1px solid ${stageColor}30`
                          }}>
                            {lead.status}
                          </span>
                        </div>
                      </div>

                      {/* Quick Action Footer buttons */}
                      <div 
                        style={{ display: 'flex', gap: '6px', borderTop: '1px solid #f1f5f9', paddingTop: '12px', flexWrap: 'wrap' }}
                        onClick={e => e.stopPropagation()}
                      >
                        <a
                          href={`/dashboard/leads/${lead.id}`}
                          style={{ flex: 1, minWidth: '55px', padding: '6px 4px', borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: '#fff', color: '#475569', fontSize: '10px', fontWeight: 600, textDecoration: 'none', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}
                        >
                          <span>👁️</span>
                          <span>View</span>
                        </a>
                        <a
                          href={`/dashboard/leads/${lead.id}`}
                          style={{ flex: 1, minWidth: '55px', padding: '6px 4px', borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: '#fff', color: '#475569', fontSize: '10px', fontWeight: 600, textDecoration: 'none', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}
                        >
                          <span>✏️</span>
                          <span>Edit</span>
                        </a>
                        <a
                          href={`/dashboard/leads/${lead.id}`}
                          style={{ flex: 1, minWidth: '55px', padding: '6px 4px', borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: '#fff', color: '#475569', fontSize: '10px', fontWeight: 600, textDecoration: 'none', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}
                        >
                          <span>📅</span>
                          <span>Follow-up</span>
                        </a>
                        {lead.phone && (
                          <>
                            <a
                              href={`tel:${lead.phone}`}
                              style={{ flex: 1, minWidth: '55px', padding: '6px 4px', borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: '#fff', color: '#475569', fontSize: '10px', fontWeight: 600, textDecoration: 'none', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}
                            >
                              <span>📞</span>
                              <span>Call</span>
                            </a>
                            <a
                              href={`https://wa.me/${lead.phone.replace(/[^0-9]/g, '')}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              style={{ flex: 1, minWidth: '55px', padding: '6px 4px', borderRadius: '6px', border: '1px solid #22c55e', backgroundColor: 'rgba(34, 197, 94, 0.05)', color: '#15803d', fontSize: '10px', fontWeight: 600, textDecoration: 'none', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}
                            >
                              <span>💬</span>
                              <span>WhatsApp</span>
                            </a>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}

                {/* Mobile pagination: Load More */}
                {leads.length > mobileItemsLimit && (
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
                    Load More Leads ({leads.length - mobileItemsLimit} left)
                  </button>
                )}
              </>
            );
          })()}
        </div>
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
              <h3 style={{ fontSize: '15px', fontWeight: 700, margin: 0 }}>Filter Leads Registry</h3>
              <button onClick={() => setShowMobileFilters(false)} style={{ background: 'none', border: 'none', fontSize: '18px', color: 'var(--text-muted)', cursor: 'pointer' }}>✕</button>
            </div>

            <div className="form-group">
              <label style={{ fontSize: '12px', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '6px' }}>Category</label>
              <select value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)} style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--border-color)', fontSize: '13px' }}>
                <option value="">All Categories</option>
                <option value="STUDY_ABROAD">Study Abroad</option>
                <option value="IELTS">IELTS</option>
                <option value="PTE">PTE</option>
                <option value="ENGLISH_SPEAKING">English Speaking</option>
                <option value="COMPUTER_COURSE">Computer Course</option>
                <option value="DIGITAL_MARKETING">Digital Marketing</option>
              </select>
            </div>

            <div className="form-group">
              <label style={{ fontSize: '12px', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '6px' }}>Status</label>
              <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--border-color)', fontSize: '13px' }}>
                <option value="">All Statuses</option>
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
            </div>

            <div className="form-group">
              <label style={{ fontSize: '12px', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '6px' }}>Source</label>
              <select value={sourceFilter} onChange={e => setSourceFilter(e.target.value)} style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--border-color)', fontSize: '13px' }}>
                <option value="">All Sources</option>
                <option value="WEBSITE_SDK">Website SDK</option>
                <option value="WHATSAPP">WhatsApp</option>
                <option value="TELEPHONY">Telephony</option>
                <option value="MANUAL">Manual Ingress</option>
                <option value="API_IMPORT">API Import</option>
                <option value="FACEBOOK_ADS">Facebook Ads</option>
              </select>
            </div>

            <div className="form-group">
              <label style={{ fontSize: '12px', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '6px' }}>Branch</label>
              <select value={branchFilter} onChange={e => setBranchFilter(e.target.value)} style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--border-color)', fontSize: '13px' }}>
                <option value="">All Branches</option>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            </div>

            <div style={{ display: 'flex', gap: '12px', marginTop: '12px' }}>
              <button 
                onClick={() => { setCategoryFilter(''); setStatusFilter(''); setSourceFilter(''); setBranchFilter(''); }} 
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
    </>
  );
}
