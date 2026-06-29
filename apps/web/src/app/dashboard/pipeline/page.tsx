'use client';

import React, { useState, useEffect } from 'react';
import { api } from '../../../lib/api';
import { useAuth } from '../../../context/auth-context';

interface StudentProfile {
  targetCountry?: string;
  targetCourse?: string;
  intake?: string;
}

interface Followup {
  id: string;
  followupDate: string;
  notes?: string;
  status: string;
}

interface Lead {
  id: string;
  firstName: string;
  lastName?: string;
  email?: string;
  phone?: string;
  status: string;
  leadCategory?: string;
  studentProfile?: StudentProfile;
  followups?: Followup[];
  readinessScore?: number;
  assignedToUser?: { id: string; name: string };
  source?: string;
  priority?: string;
  createdAt?: string;
  leadNumber?: string;
}

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

export default function PipelinePage() {
  const { user } = useAuth();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('STUDY_ABROAD');
  const [searchQuery, setSearchQuery] = useState('');
  const [toasts, setToasts] = useState<{ id: string; type: 'success' | 'error'; message: string }[]>([]);

  // Mobile pipeline state hooks
  const [activeStageIndex, setActiveStageIndex] = useState(0);
  const [showMobileSearch, setShowMobileSearch] = useState(false);
  const [showFilterBottomSheet, setShowFilterBottomSheet] = useState(false);
  const [showMoveStageBottomSheet, setShowMoveStageBottomSheet] = useState<Lead | null>(null);

  const [filterCounsellor, setFilterCounsellor] = useState('');
  const [filterSource, setFilterSource] = useState('');
  const [filterPriority, setFilterPriority] = useState('');
  const [filterDate, setFilterDate] = useState('');

  // Mobile search enhancements
  const [searchInput, setSearchInput] = useState('');
  const [highlightedLeadId, setHighlightedLeadId] = useState<string | null>(null);

  const currentStages = PIPELINE_CONFIG[selectedCategory] || PIPELINE_CONFIG.STUDY_ABROAD;

  // University capture modal states on drag-to-applied
  const [showUniModal, setShowUniModal] = useState(false);
  const [modalLeadId, setModalLeadId] = useState('');
  const [modalLeadName, setModalLeadName] = useState('');
  const [uniName, setUniName] = useState('');
  const [uniCountry, setUniCountry] = useState('');
  const [uniCourse, setUniCourse] = useState('');
  const [uniIntake, setUniIntake] = useState('');
  const [uniNotes, setUniNotes] = useState('');
  const [isSubmittingUni, setIsSubmittingUni] = useState(false);

  // Debounce search input
  useEffect(() => {
    const handler = setTimeout(() => {
      setSearchQuery(searchInput);
    }, 250);
    return () => clearTimeout(handler);
  }, [searchInput]);

  const addToast = (type: 'success' | 'error', message: string) => {
    const id = Math.random().toString(36).substr(2, 9);
    setToasts((prev) => [...prev, { id, type, message }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  };

  const fetchLeads = async () => {
    try {
      const res = await api.get('/api/v1/leads');
      if (Array.isArray(res)) {
        setLeads(res);
      }
    } catch (err: any) {
      console.error('Failed to load leads', err);
      addToast('error', 'Failed to retrieve candidate list.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLeads();
  }, []);

  const handleDragStart = (e: React.DragEvent, id: string) => {
    e.dataTransfer.setData('text/plain', id);
    setDraggingId(id);
  };

  const handleDragEnd = () => {
    setDraggingId(null);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = async (e: React.DragEvent, targetStatus: string) => {
    e.preventDefault();
    setDraggingId(null);
    const leadId = e.dataTransfer.getData('text/plain');
    if (!leadId) return;

    const matchedLead = leads.find((l) => l.id === leadId);
    if (!matchedLead) return;

    // Check if status is actually changing
    if (matchedLead.status === targetStatus) return;

    const RESTRICTED_STAGES = [
      'DOCUMENTS_RECEIVED',
      'UNIVERSITY_APPLIED',
      'OFFER_LETTER',
      'VISA_PROCESS',
      'ADMISSION_CLOSED'
    ];
    if (RESTRICTED_STAGES.includes(targetStatus)) {
      const readiness = matchedLead.readinessScore ?? 0;
      if (readiness < 100) {
        addToast('error', `Cannot move ${matchedLead.firstName} to ${targetStatus.replace(/_/g, ' ')} until all required documents are 100% verified.`);
        return;
      }
    }

    // Intercept Study Abroad leads moving to University Applied
    if ((matchedLead.leadCategory || 'STUDY_ABROAD') === 'STUDY_ABROAD' && targetStatus === 'UNIVERSITY_APPLIED') {
      setModalLeadId(leadId);
      setModalLeadName(`${matchedLead.firstName} ${matchedLead.lastName || ''}`);
      setUniName('');
      setUniCountry('');
      setUniCourse('');
      setUniIntake('');
      setUniNotes('');
      setShowUniModal(true);
      return;
    }

    const originalStatus = matchedLead.status;

    // Optimistic UI Update
    setLeads((prevLeads) =>
      prevLeads.map((l) => (l.id === leadId ? { ...l, status: targetStatus } : l))
    );

    try {
      // Find the specific stage label
      const currentStages = PIPELINE_CONFIG[selectedCategory] || PIPELINE_CONFIG.STUDY_ABROAD;
      const stageObj = currentStages.find((s) => s.code === targetStatus);
      const stageLabel = stageObj ? stageObj.label : targetStatus;

      // API update status call
      await api.patch(`/api/v1/leads/${leadId}`, { status: targetStatus });
      addToast('success', `Moved ${matchedLead.firstName} ${matchedLead.lastName || ''} to ${stageLabel}.`);
    } catch (err: any) {
      console.error('Failed to update stage', err);
      addToast('error', err.message || 'Failed to update student pipeline stage.');
      
      // Rollback UI update
      setLeads((prevLeads) =>
        prevLeads.map((l) => (l.id === leadId ? { ...l, status: originalStatus } : l))
      );
    }
  };

  const handleMoveStage = async (leadId: string, targetStatus: string) => {
    const matchedLead = leads.find((l) => l.id === leadId);
    if (!matchedLead) return;
    if (matchedLead.status === targetStatus) return;

    const RESTRICTED_STAGES = [
      'DOCUMENTS_RECEIVED',
      'UNIVERSITY_APPLIED',
      'OFFER_LETTER',
      'VISA_PROCESS',
      'ADMISSION_CLOSED'
    ];
    if (RESTRICTED_STAGES.includes(targetStatus)) {
      const readiness = matchedLead.readinessScore ?? 0;
      if (readiness < 100) {
        addToast('error', `Cannot move ${matchedLead.firstName} to ${targetStatus.replace(/_/g, ' ')} until all required documents are 100% verified.`);
        return;
      }
    }

    if ((matchedLead.leadCategory || 'STUDY_ABROAD') === 'STUDY_ABROAD' && targetStatus === 'UNIVERSITY_APPLIED') {
      setModalLeadId(leadId);
      setModalLeadName(`${matchedLead.firstName} ${matchedLead.lastName || ''}`);
      setUniName('');
      setUniCountry('');
      setUniCourse('');
      setUniIntake('');
      setUniNotes('');
      setShowUniModal(true);
      return;
    }

    const originalStatus = matchedLead.status;

    setLeads((prevLeads) =>
      prevLeads.map((l) => (l.id === leadId ? { ...l, status: targetStatus } : l))
    );

    try {
      const currentStages = PIPELINE_CONFIG[selectedCategory] || PIPELINE_CONFIG.STUDY_ABROAD;
      const stageObj = currentStages.find((s) => s.code === targetStatus);
      const stageLabel = stageObj ? stageObj.label : targetStatus;

      await api.patch(`/api/v1/leads/${leadId}`, { status: targetStatus });
      addToast('success', `Moved ${matchedLead.firstName} ${matchedLead.lastName || ''} to ${stageLabel}.`);
    } catch (err: any) {
      console.error('Failed to update stage', err);
      addToast('error', err.message || 'Failed to update student pipeline stage.');
      setLeads((prevLeads) =>
        prevLeads.map((l) => (l.id === leadId ? { ...l, status: originalStatus } : l))
      );
    }
  };

  const handleUniModalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uniName.trim() || !uniCountry.trim() || !uniCourse.trim() || !uniIntake.trim()) {
      addToast('error', 'Please fill in all required fields.');
      return;
    }
    setIsSubmittingUni(true);
    try {
      // 1. Create shortlisted application
      const app = await api.post('/api/v1/applications', {
        leadId: modalLeadId,
        universityName: uniName,
        country: uniCountry,
        courseName: uniCourse,
        intake: uniIntake,
        notes: uniNotes
      });

      // 2. Set application status to APPLICATION_STARTED
      await api.patch(`/api/v1/applications/${app.id}`, {
        applicationStatus: 'APPLICATION_STARTED'
      });

      // 3. Move Lead status
      await api.patch(`/api/v1/leads/${modalLeadId}`, {
        status: 'UNIVERSITY_APPLIED'
      });

      addToast('success', `Shortlisted ${uniName} and moved ${modalLeadName} to University Applied.`);
      setShowUniModal(false);
      await fetchLeads();
    } catch (err: any) {
      addToast('error', err.message || 'Failed to shortlist university.');
    } finally {
      setIsSubmittingUni(false);
    }
  };

  if (loading) {
    return (
      <div style={{ padding: '20px', fontWeight: 600 }}>
        Initializing study abroad candidate pipeline metrics board...
      </div>
    );
  }

  // Filter leads for columns (desktop or mobile category display context)
  const filteredLeads = leads.filter((l) => {
    const matchesCategory = (l.leadCategory || 'STUDY_ABROAD') === selectedCategory;
    
    // In mobile view, global search is managed via overlay.
    // In desktop view, we still filter standard grid leads by the name search query.
    const fullName = `${l.firstName} ${l.lastName || ''}`.toLowerCase();
    const matchesSearch = fullName.includes(searchQuery.toLowerCase());
    
    const matchesCounsellor = !filterCounsellor || l.assignedToUser?.name?.toLowerCase().includes(filterCounsellor.toLowerCase());
    const matchesSource = !filterSource || l.source?.toLowerCase() === filterSource.toLowerCase();
    const matchesPriority = !filterPriority || l.priority?.toLowerCase() === filterPriority.toLowerCase();
    
    let matchesDate = true;
    if (filterDate && l.createdAt) {
      const createdDate = new Date(l.createdAt).toDateString();
      const filterDateStr = new Date(filterDate).toDateString();
      matchesDate = createdDate === filterDateStr;
    }
    
    return matchesCategory && matchesSearch && matchesCounsellor && matchesSource && matchesPriority && matchesDate;
  });

  return (
    <>
      {/* DESKTOP PIPELINE VIEW */}
      <div className="desktop-only-pipeline" style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 65px)', overflow: 'hidden', padding: '16px' }}>
        {/* Header section */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div>
            <h2 style={{ fontSize: '16px', fontWeight: 700, margin: 0 }}>Admission Pipeline Board</h2>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '4px 0 0 0' }}>
              Drag and drop students to transition them across phase stages. Operations are automatically synchronized.
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
              <label style={{ fontSize: '12px', fontWeight: 600, color: '#475569' }}>Category:</label>
              <select
                value={selectedCategory}
                onChange={(e) => { setSelectedCategory(e.target.value); setActiveStageIndex(0); }}
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

        {/* Horizontally scrollable board columns container */}
        <div style={{
          display: 'flex',
          flex: 1,
          gap: '12px',
          overflowX: 'auto',
          overflowY: 'hidden',
          paddingBottom: '8px',
          alignItems: 'stretch'
        }}>
          {currentStages.map((stage) => {
            const stageLeads = filteredLeads.filter((l) => 
              l.status === stage.code || (stage.code === 'ADMISSION_CLOSED' && l.status === 'ENROLLED')
            );
            return (
              <div
                key={stage.code}
                onDragOver={handleDragOver}
                onDrop={(e) => handleDrop(e, stage.code)}
                style={{
                  width: '280px',
                  minWidth: '280px',
                  display: 'flex',
                  flexDirection: 'column',
                  background: '#f8fafc',
                  border: '1px solid var(--border-color)',
                  borderRadius: '8px',
                  padding: '8px',
                  maxHeight: '100%',
                  boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.05)'
                }}
              >
                {/* Column Header */}
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '4px 8px 12px 8px',
                  borderBottom: `2px solid ${stage.color}`
                }}>
                  <span style={{ fontSize: '12px', fontWeight: 700, color: '#334155', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', backgroundColor: stage.color }}></span>
                    {stage.label}
                  </span>
                  <span style={{
                    fontSize: '11px',
                    fontWeight: 600,
                    backgroundColor: '#e2e8f0',
                    color: '#475569',
                    borderRadius: '12px',
                    padding: '2px 8px'
                  }}>
                    {stageLeads.length}
                  </span>
                </div>

                {/* Column Cards Container */}
                <div style={{
                  flex: 1,
                  overflowY: 'auto',
                  padding: '8px 0',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                  minHeight: '150px'
                }}>
                  {stageLeads.map((lead) => {
                    const progress = getProgressPercentage(lead.status, selectedCategory);
                    const nextFollowup = lead.followups?.find(f => f.status === 'SCHEDULED');
                    return (
                      <div
                        key={lead.id}
                        draggable
                        onDragStart={(e) => handleDragStart(e, lead.id)}
                        onDragEnd={handleDragEnd}
                        style={{
                          background: '#ffffff',
                          border: '1px solid var(--border-color)',
                          borderRadius: '6px',
                          padding: '12px',
                          cursor: 'grab',
                          opacity: draggingId === lead.id ? 0.4 : 1,
                          boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
                          transition: 'transform 0.15s ease, box-shadow 0.15s ease',
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.transform = 'translateY(-2px)';
                          e.currentTarget.style.boxShadow = '0 4px 6px -1px rgba(0,0,0,0.08)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.transform = 'translateY(0)';
                          e.currentTarget.style.boxShadow = '0 1px 2px 0 rgba(0, 0, 0, 0.05)';
                        }}
                      >
                        {/* Student Name */}
                        <div style={{ marginBottom: '6px' }}>
                          <a
                            href={`/dashboard/leads/${lead.id}`}
                            style={{
                              fontSize: '13px',
                              fontWeight: 600,
                              color: 'var(--primary-color)',
                              textDecoration: 'none'
                            }}
                          >
                            {lead.firstName} {lead.lastName || ''}
                          </a>
                        </div>

                        {/* Course / Country Badges */}
                        {(lead.studentProfile?.targetCountry || lead.studentProfile?.targetCourse) && (
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginBottom: '8px' }}>
                            {lead.studentProfile?.targetCountry && (
                              <span style={{
                                fontSize: '9px',
                                fontWeight: 600,
                                background: '#eff6ff',
                                color: '#2563eb',
                                padding: '2px 6px',
                                borderRadius: '4px',
                                border: '1px solid #bfdbfe'
                              }}>
                                🌍 {lead.studentProfile.targetCountry}
                              </span>
                            )}
                            {lead.studentProfile?.targetCourse && (
                              <span style={{
                                fontSize: '9px',
                                fontWeight: 600,
                                background: '#fdf2f8',
                                color: '#db2777',
                                padding: '2px 6px',
                                borderRadius: '4px',
                                border: '1px solid #fbcfe8',
                                maxWidth: '100%',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap'
                              }} title={lead.studentProfile.targetCourse}>
                                🎓 {lead.studentProfile.targetCourse}
                              </span>
                            )}
                          </div>
                        )}

                        {/* Next Followup */}
                        {nextFollowup && (
                          <div style={{ fontSize: '10px', color: '#d97706', backgroundColor: '#fffbeb', border: '1px solid #fef3c7', padding: '4px 6px', borderRadius: '4px', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <span>📅</span>
                            <span>Next: {new Date(nextFollowup.followupDate).toLocaleDateString()}</span>
                          </div>
                        )}

                        {/* Progress Meter bar */}
                        <div style={{ marginTop: '8px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '2px' }}>
                            <span>Progress</span>
                            <span>{progress}%</span>
                          </div>
                          <div style={{ width: '100%', height: '4px', backgroundColor: '#e2e8f0', borderRadius: '2px', overflow: 'hidden' }}>
                            <div style={{
                              width: `${progress}%`,
                              height: '100%',
                              backgroundColor: progress === 100 ? 'var(--success-color)' : 'var(--primary-color)',
                              transition: 'width 0.3s ease'
                            }}></div>
                          </div>
                        </div>

                      </div>
                    );
                  })}
                  {stageLeads.length === 0 && (
                    <div style={{
                      flex: 1,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      border: '2px dashed #e2e8f0',
                      borderRadius: '6px',
                      color: 'var(--text-muted)',
                      fontSize: '11px',
                      padding: '20px',
                      textAlign: 'center'
                    }}>
                      Drag students here
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* MOBILE PIPELINE VIEW */}
      <div className="mobile-only-pipeline" style={{ paddingBottom: '80px', display: 'flex', flexDirection: 'column', height: 'calc(100vh - 65px)' }}>
        {/* Mobile Sticky Header */}
        <div style={{
          position: 'sticky',
          top: 0,
          backgroundColor: '#fff',
          borderBottom: '1px solid var(--border-color)',
          padding: '12px 16px',
          zIndex: 100,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}>
          <div>
            <h2 style={{ fontSize: '15px', fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: '6px' }}>
              💼 Pipeline
              <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', backgroundColor: '#f1f5f9', padding: '2px 6px', borderRadius: '10px' }}>
                {filteredLeads.length}
              </span>
            </h2>
          </div>
          <div style={{ display: 'flex', gap: '12px' }}>
            <button 
              onClick={() => {
                setShowMobileSearch(true);
                setSearchInput('');
              }} 
              style={{ background: 'none', border: 'none', fontSize: '18px', cursor: 'pointer', color: '#475569' }}
              title="Search Leads"
            >
              🔍
            </button>
            <button 
              onClick={() => setShowFilterBottomSheet(true)} 
              style={{ background: 'none', border: 'none', fontSize: '18px', cursor: 'pointer', color: '#475569' }}
              title="Filter Leads"
            >
              ⚙️
            </button>
          </div>
        </div>

        {/* Sticky Stage Navigation */}
        <div style={{
          position: 'sticky',
          top: '49px',
          backgroundColor: '#f8fafc',
          borderBottom: '1px solid var(--border-color)',
          padding: '10px 16px',
          zIndex: 90,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          boxShadow: '0 1px 2px 0 rgba(0,0,0,0.02)'
        }}>
          <button 
            onClick={() => setActiveStageIndex(prev => Math.max(0, prev - 1))}
            disabled={activeStageIndex === 0}
            style={{
              background: '#fff',
              border: '1px solid var(--border-color)',
              borderRadius: '50%',
              width: '28px',
              height: '28px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '12px',
              cursor: 'pointer',
              boxShadow: '0 1px 2px 0 rgba(0,0,0,0.05)',
              opacity: activeStageIndex === 0 ? 0.3 : 1
            }}
          >
            ◀
          </button>
          <div style={{ textAlign: 'center', flex: 1, padding: '0 8px' }}>
            <span style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '13px',
              fontWeight: 700,
              color: '#1e293b'
            }}>
              <span style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', backgroundColor: currentStages[activeStageIndex]?.color }}></span>
              {currentStages[activeStageIndex]?.label}
            </span>
            <div style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 600, marginTop: '2px' }}>
              {filteredLeads.filter(l => l.status === currentStages[activeStageIndex]?.code || (currentStages[activeStageIndex]?.code === 'ADMISSION_CLOSED' && l.status === 'ENROLLED')).length} candidates
            </div>
          </div>
          <button 
            onClick={() => setActiveStageIndex(prev => Math.min(currentStages.length - 1, prev + 1))}
            disabled={activeStageIndex === currentStages.length - 1}
            style={{
              background: '#fff',
              border: '1px solid var(--border-color)',
              borderRadius: '50%',
              width: '28px',
              height: '28px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '12px',
              cursor: 'pointer',
              boxShadow: '0 1px 2px 0 rgba(0,0,0,0.05)',
              opacity: activeStageIndex === currentStages.length - 1 ? 0.3 : 1
            }}
          >
            ▶
          </button>
        </div>

        {/* Lead Cards List Container */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {(() => {
            const activeStage = currentStages[activeStageIndex];
            if (!activeStage) return null;
            const stageLeads = filteredLeads.filter(l => 
              l.status === activeStage.code || (activeStage.code === 'ADMISSION_CLOSED' && l.status === 'ENROLLED')
            );

            if (stageLeads.length === 0) {
              return (
                <div style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '64px 20px',
                  color: 'var(--text-muted)',
                  textAlign: 'center',
                }}>
                  <span style={{ fontSize: '48px', marginBottom: '16px' }}>📂</span>
                  <h3 style={{ fontSize: '14px', fontWeight: 700, color: '#475569', margin: '0 0 4px 0' }}>No Leads in this Stage</h3>
                  <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '0 0 16px 0' }}>There are no candidates currently in transition here.</p>
                  <a
                    href="/dashboard/leads"
                    style={{
                      display: 'inline-block',
                      padding: '8px 16px',
                      backgroundColor: 'var(--primary-color)',
                      color: '#fff',
                      borderRadius: '6px',
                      fontSize: '12px',
                      fontWeight: 600,
                      textDecoration: 'none'
                    }}
                  >
                    Add New Lead
                  </a>
                </div>
              );
            }

            return stageLeads.map((lead) => {
              const progress = getProgressPercentage(lead.status, selectedCategory);
              const nextFollowup = lead.followups?.find(f => f.status === 'SCHEDULED');
              return (
                <div
                  key={lead.id}
                  id={`lead-card-${lead.id}`}
                  className={`fade-in ${highlightedLeadId === lead.id ? 'highlight-pulse-card' : ''}`}
                  style={{
                    backgroundColor: '#fff',
                    border: '1px solid var(--border-color)',
                    borderRadius: '12px',
                    padding: '16px',
                    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.02), 0 2px 4px -1px rgba(0, 0, 0, 0.01)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '12px',
                    transition: 'all 0.3s ease'
                  }}
                >
                  {/* Name and stage transition */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <a
                        href={`/dashboard/leads/${lead.id}`}
                        style={{
                          fontSize: '14px',
                          fontWeight: 700,
                          color: '#1e293b',
                          textDecoration: 'none'
                        }}
                      >
                        {lead.firstName} {lead.lastName || ''}
                      </a>
                      {lead.leadNumber && (
                        <div style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 600, marginTop: '2px' }}>
                          Ref: {lead.leadNumber}
                        </div>
                      )}
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '6px' }}>
                        {lead.studentProfile?.targetCountry && (
                          <span style={{ fontSize: '10px', backgroundColor: '#f1f5f9', color: '#475569', padding: '2px 6px', borderRadius: '4px', border: '1px solid #e2e8f0' }}>
                            🌍 {lead.studentProfile.targetCountry}
                          </span>
                        )}
                        {lead.studentProfile?.targetCourse && (
                          <span style={{ fontSize: '10px', backgroundColor: '#fdf2f8', color: '#db2777', padding: '2px 6px', borderRadius: '4px', border: '1px solid #fbcfe8' }}>
                            🎓 {lead.studentProfile.targetCourse}
                          </span>
                        )}
                      </div>
                    </div>
                    <span style={{
                      fontSize: '10px',
                      fontWeight: 700,
                      backgroundColor: activeStage.color + '15',
                      color: activeStage.color,
                      padding: '4px 8px',
                      borderRadius: '6px',
                      border: `1px solid ${activeStage.color}30`
                    }}>
                      {activeStage.label}
                    </span>
                  </div>

                  {/* Meta Details */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '12px', color: '#475569', borderTop: '1px solid #f1f5f9', paddingTop: '10px' }}>
                    {lead.phone && (
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <span style={{ opacity: 0.6 }}>📞</span>
                        <span>{lead.phone}</span>
                      </div>
                    )}
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <span style={{ opacity: 0.6 }}>👤</span>
                      <span>Counsellor: {lead.assignedToUser?.name || 'Unassigned'}</span>
                    </div>
                    {nextFollowup && (
                      <div style={{ display: 'flex', gap: '6px', color: '#d97706' }}>
                        <span>📅</span>
                        <span>Next Followup: {new Date(nextFollowup.followupDate).toLocaleDateString()}</span>
                      </div>
                    )}
                    {/* Progress Meter */}
                    <div style={{ marginTop: '4px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: 'var(--text-muted)', marginBottom: '4px' }}>
                        <span>Stage Progress</span>
                        <span>{progress}%</span>
                      </div>
                      <div style={{ width: '100%', height: '5px', backgroundColor: '#f1f5f9', borderRadius: '3px', overflow: 'hidden' }}>
                        <div style={{ width: `${progress}%`, height: '100%', backgroundColor: progress === 100 ? 'var(--success-color)' : 'var(--primary-color)' }}></div>
                      </div>
                    </div>
                  </div>

                  {/* Actions buttons footer */}
                  <div style={{ display: 'flex', gap: '8px', borderTop: '1px solid #f1f5f9', paddingTop: '12px', flexWrap: 'wrap' }}>
                    {lead.phone && (
                      <>
                        <a 
                          href={`tel:${lead.phone}`} 
                          style={{ flex: 1, minWidth: '70px', padding: '8px', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: '#fff', color: '#334155', fontSize: '11px', fontWeight: 600, textDecoration: 'none', textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}
                        >
                          📞 Call
                        </a>
                        <a 
                          href={`https://wa.me/${lead.phone.replace(/[^0-9]/g, '')}`} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          style={{ flex: 1, minWidth: '70px', padding: '8px', borderRadius: '8px', border: '1px solid #22c55e', backgroundColor: 'rgba(34, 197, 94, 0.05)', color: '#15803d', fontSize: '11px', fontWeight: 600, textDecoration: 'none', textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}
                        >
                          💬 WhatsApp
                        </a>
                      </>
                    )}
                    <a 
                      href={`/dashboard/leads/${lead.id}`}
                      style={{ flex: 1, minWidth: '70px', padding: '8px', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: '#fff', color: '#334155', fontSize: '11px', fontWeight: 600, textDecoration: 'none', textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}
                    >
                      ✏️ Edit
                    </a>
                    <button 
                      onClick={() => setShowMoveStageBottomSheet(lead)}
                      style={{ flex: 1.3, minWidth: '100px', padding: '8px', borderRadius: '8px', border: 'none', backgroundColor: 'var(--primary-color)', color: '#fff', fontSize: '11px', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}
                    >
                      🔄 Move Stage
                    </button>
                  </div>
                </div>
              );
            });
          })()}
        </div>

        {/* Floating Action Button */}
        <a
          href="/dashboard/leads"
          style={{
            position: 'fixed',
            bottom: '24px',
            right: '24px',
            backgroundColor: 'var(--primary-color)',
            color: '#fff',
            width: '56px',
            height: '56px',
            borderRadius: '50%',
            boxShadow: '0 4px 10px rgba(59, 130, 246, 0.3)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '24px',
            textDecoration: 'none',
            zIndex: 200,
          }}
          title="Add New Lead"
        >
          ➕
        </a>
      </div>

      {/* MOBILE FULL-SCREEN SEARCH OVERLAY */}
      {showMobileSearch && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: '#ffffff',
          zIndex: 500,
          display: 'flex',
          flexDirection: 'column'
        }} className="fade-in">
          {/* Header with input */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            padding: '12px 16px',
            borderBottom: '1px solid var(--border-color)',
            backgroundColor: '#ffffff'
          }}>
            <div style={{ position: 'relative', flex: 1 }}>
              <input
                type="text"
                autoFocus
                placeholder="Search name, phone, email, course, country..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px 36px 10px 12px',
                  fontSize: '13px',
                  borderRadius: '8px',
                  border: '1px solid var(--border-color)',
                  outline: 'none',
                  backgroundColor: '#f8fafc'
                }}
              />
              {searchInput && (
                <button
                  onClick={() => setSearchInput('')}
                  style={{
                    position: 'absolute',
                    right: '10px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    fontSize: '14px',
                    color: 'var(--text-muted)',
                    cursor: 'pointer'
                  }}
                >
                  ✕
                </button>
              )}
            </div>
            <button
              onClick={() => {
                setShowMobileSearch(false);
                setSearchInput('');
                setSearchQuery('');
              }}
              style={{
                background: 'none',
                border: 'none',
                fontSize: '14px',
                fontWeight: 600,
                color: 'var(--primary-color)',
                cursor: 'pointer'
              }}
            >
              Cancel
            </button>
          </div>

          {/* Results List */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '16px', backgroundColor: '#f8fafc' }}>
            {(() => {
              if (!searchQuery.trim()) {
                return (
                  <div style={{ textAlign: 'center', color: 'var(--text-muted)', marginTop: '48px', fontSize: '13px' }}>
                    <span style={{ fontSize: '36px', display: 'block', marginBottom: '12px' }}>🔍</span>
                    Type at least 1 character to search...
                  </div>
                );
              }

              const query = searchQuery.trim().toLowerCase();
              const searchResults = leads.filter((lead) => {
                const matchesCategory = (lead.leadCategory || 'STUDY_ABROAD') === selectedCategory;
                if (!matchesCategory) return false;
                
                const fullName = `${lead.firstName} ${lead.lastName || ''}`.toLowerCase();
                const email = (lead.email || '').toLowerCase();
                const phone = (lead.phone || '').toLowerCase();
                const leadNum = (lead.leadNumber || '').toLowerCase();
                const course = (lead.studentProfile?.targetCourse || '').toLowerCase();
                const country = (lead.studentProfile?.targetCountry || '').toLowerCase();
                
                return fullName.includes(query) ||
                       email.includes(query) ||
                       phone.includes(query) ||
                       leadNum.includes(query) ||
                       course.includes(query) ||
                       country.includes(query);
              });

              if (searchResults.length === 0) {
                return (
                  <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '64px 20px',
                    textAlign: 'center',
                    color: 'var(--text-muted)'
                  }}>
                    <span style={{ fontSize: '48px', marginBottom: '16px' }}>🔍</span>
                    <h3 style={{ fontSize: '15px', fontWeight: 700, color: '#475569', margin: '0 0 8px 0' }}>No matching leads found</h3>
                    <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: 0, maxWidth: '280px' }}>
                      Try another name, phone number or email.
                    </p>
                  </div>
                );
              }

              return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {searchResults.map((lead) => {
                    const stageObj = currentStages.find(s => s.code === lead.status || (s.code === 'ADMISSION_CLOSED' && lead.status === 'ENROLLED'));
                    const stageLabel = stageObj ? stageObj.label : lead.status;
                    const stageColor = stageObj ? stageObj.color : '#64748b';

                    return (
                      <div
                        key={lead.id}
                        onClick={() => {
                          const idx = currentStages.findIndex(s => s.code === lead.status || (s.code === 'ADMISSION_CLOSED' && lead.status === 'ENROLLED'));
                          if (idx !== -1) {
                            setActiveStageIndex(idx);
                          }
                          setHighlightedLeadId(lead.id);
                          setTimeout(() => {
                            setHighlightedLeadId(null);
                          }, 3000);
                          
                          setShowMobileSearch(false);
                          setSearchInput('');
                          setSearchQuery('');
                          
                          setTimeout(() => {
                            const el = document.getElementById(`lead-card-${lead.id}`);
                            if (el) {
                              el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                            }
                          }, 350);
                        }}
                        style={{
                          backgroundColor: '#ffffff',
                          border: '1px solid var(--border-color)',
                          borderRadius: '12px',
                          padding: '16px',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '8px',
                          cursor: 'pointer',
                          boxShadow: '0 2px 4px rgba(0,0,0,0.02)',
                          WebkitTapHighlightColor: 'transparent'
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                          <div>
                            <span style={{ fontSize: '14px', fontWeight: 700, color: '#1e293b' }}>
                              👤 {lead.firstName} {lead.lastName || ''}
                            </span>
                            {lead.leadNumber && (
                              <div style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 600, marginTop: '2px' }}>
                                Ref: {lead.leadNumber}
                              </div>
                            )}
                          </div>
                          <span style={{
                            fontSize: '9px',
                            fontWeight: 700,
                            backgroundColor: stageColor + '15',
                            color: stageColor,
                            padding: '3px 8px',
                            borderRadius: '6px',
                            border: `1px solid ${stageColor}30`
                          }}>
                            {stageLabel}
                          </span>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '12px', color: '#475569', borderTop: '1px solid #f1f5f9', paddingTop: '8px' }}>
                          {(lead.studentProfile?.targetCourse || lead.studentProfile?.targetCountry) && (
                            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '2px' }}>
                              {lead.studentProfile?.targetCourse && (
                                <span style={{ fontSize: '10px', backgroundColor: '#fdf2f8', color: '#db2777', padding: '2px 6px', borderRadius: '4px' }}>
                                  📘 {lead.studentProfile.targetCourse}
                                </span>
                              )}
                              {lead.studentProfile?.targetCountry && (
                                <span style={{ fontSize: '10px', backgroundColor: '#eff6ff', color: '#2563eb', padding: '2px 6px', borderRadius: '4px' }}>
                                  🌍 {lead.studentProfile.targetCountry}
                                </span>
                              )}
                            </div>
                          )}
                          {lead.phone && (
                            <div style={{ display: 'flex', gap: '6px' }}>
                              <span style={{ opacity: 0.6 }}>📞</span>
                              <span>{lead.phone}</span>
                            </div>
                          )}
                          {lead.email && (
                            <div style={{ display: 'flex', gap: '6px' }}>
                              <span style={{ opacity: 0.6 }}>✉️</span>
                              <span>{lead.email}</span>
                            </div>
                          )}
                          <div style={{ display: 'flex', gap: '6px' }}>
                            <span style={{ opacity: 0.6 }}>👤</span>
                            <span>Counsellor: {lead.assignedToUser?.name || 'Unassigned'}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* FILTER BOTTOM SHEET */}
      {showFilterBottomSheet && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15, 23, 42, 0.4)', zIndex: 400, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }} onClick={() => setShowFilterBottomSheet(false)}>
          <div className="bottom-sheet" style={{ width: '100%', maxWidth: '480px', backgroundColor: '#fff', borderTopLeftRadius: '16px', borderTopRightRadius: '16px', padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
              <h3 style={{ fontSize: '15px', fontWeight: 700, margin: 0 }}>Filter Candidates</h3>
              <button onClick={() => setShowFilterBottomSheet(false)} style={{ background: 'none', border: 'none', fontSize: '18px', color: 'var(--text-muted)', cursor: 'pointer' }}>✕</button>
            </div>
            <div className="form-group">
              <label style={{ fontSize: '12px', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '6px' }}>Category</label>
              <select value={selectedCategory} onChange={e => { setSelectedCategory(e.target.value); setActiveStageIndex(0); }} style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--border-color)', fontSize: '13px' }}>
                <option value="STUDY_ABROAD">Study Abroad</option>
                <option value="IELTS">IELTS</option>
                <option value="PTE">PTE</option>
                <option value="ENGLISH_SPEAKING">English Speaking</option>
                <option value="COMPUTER_COURSE">Computer Course</option>
                <option value="DIGITAL_MARKETING">Digital Marketing</option>
                <option value="OTHER">Other</option>
              </select>
            </div>
            <div className="form-group">
              <label style={{ fontSize: '12px', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '6px' }}>Counsellor Name</label>
              <input type="text" placeholder="e.g. John Doe" value={filterCounsellor} onChange={e => setFilterCounsellor(e.target.value)} style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--border-color)', fontSize: '13px' }} />
            </div>
            <div className="form-group">
              <label style={{ fontSize: '12px', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '6px' }}>Lead Source</label>
              <select value={filterSource} onChange={e => setFilterSource(e.target.value)} style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--border-color)', fontSize: '13px' }}>
                <option value="">All Sources</option>
                <option value="WALK_IN">Walk In</option>
                <option value="ONLINE">Online / Website</option>
                <option value="REFERRAL">Referral</option>
                <option value="SOCIAL_MEDIA">Social Media</option>
              </select>
            </div>
            <div className="form-group">
              <label style={{ fontSize: '12px', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '6px' }}>Priority</label>
              <select value={filterPriority} onChange={e => setFilterPriority(e.target.value)} style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--border-color)', fontSize: '13px' }}>
                <option value="">All Priorities</option>
                <option value="HIGH">High</option>
                <option value="MEDIUM">Medium</option>
                <option value="LOW">Low</option>
              </select>
            </div>
            <div className="form-group">
              <label style={{ fontSize: '12px', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '6px' }}>Date Created</label>
              <input type="date" value={filterDate} onChange={e => setFilterDate(e.target.value)} style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--border-color)', fontSize: '13px' }} />
            </div>
            <div style={{ display: 'flex', gap: '12px', marginTop: '12px' }}>
              <button onClick={() => { setFilterCounsellor(''); setFilterSource(''); setFilterPriority(''); setFilterDate(''); }} style={{ flex: 1, padding: '12px', borderRadius: '8px', border: '1px solid var(--border-color)', background: '#fff', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>Reset All</button>
              <button onClick={() => setShowFilterBottomSheet(false)} style={{ flex: 1, padding: '12px', borderRadius: '8px', border: 'none', background: 'var(--primary-color)', color: '#fff', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>Apply Filters</button>
            </div>
          </div>
        </div>
      )}

      {/* MOVE STAGE BOTTOM SHEET */}
      {showMoveStageBottomSheet && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15, 23, 42, 0.4)', zIndex: 400, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }} onClick={() => setShowMoveStageBottomSheet(null)}>
          <div className="bottom-sheet" style={{ width: '100%', maxWidth: '480px', backgroundColor: '#fff', borderTopLeftRadius: '16px', borderTopRightRadius: '16px', padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px', maxHeight: '80vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
              <h3 style={{ fontSize: '15px', fontWeight: 700, margin: 0 }}>Move {showMoveStageBottomSheet.firstName} to Stage</h3>
              <button onClick={() => setShowMoveStageBottomSheet(null)} style={{ background: 'none', border: 'none', fontSize: '18px', color: 'var(--text-muted)', cursor: 'pointer' }}>✕</button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {currentStages.map(stage => (
                <button
                  key={stage.code}
                  onClick={() => {
                    handleMoveStage(showMoveStageBottomSheet.id, stage.code);
                    setShowMoveStageBottomSheet(null);
                  }}
                  style={{
                    width: '100%',
                    padding: '14px',
                    borderRadius: '8px',
                    border: '1px solid ' + (showMoveStageBottomSheet.status === stage.code ? 'var(--primary-color)' : 'var(--border-color)'),
                    background: showMoveStageBottomSheet.status === stage.code ? 'rgba(59, 130, 246, 0.05)' : '#fff',
                    color: showMoveStageBottomSheet.status === stage.code ? 'var(--primary-color)' : 'var(--text-main)',
                    fontSize: '13px',
                    fontWeight: 600,
                    textAlign: 'left',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <span>{stage.label}</span>
                  {showMoveStageBottomSheet.status === stage.code && <span>✓</span>}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* University Application Modal */}
      {showUniModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15, 23, 42, 0.4)', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <form onSubmit={handleUniModalSubmit} className="login-card" style={{ width: '400px', display: 'flex', flexDirection: 'column', gap: '12px', textAlign: 'left' }}>
            <h3 style={{ fontSize: '13px', fontWeight: 700, borderBottom: '1px solid var(--border-color)', paddingBottom: '8px', margin: 0 }}>
              Apply to University for {modalLeadName}
            </h3>
            
            <div className="form-group">
              <label>University Name *</label>
              <input
                type="text"
                className="form-control"
                required
                value={uniName}
                onChange={(e) => setUniName(e.target.value)}
                placeholder="e.g. University of Toronto"
              />
            </div>

            <div className="form-group">
              <label>Country *</label>
              <input
                type="text"
                className="form-control"
                required
                value={uniCountry}
                onChange={(e) => setUniCountry(e.target.value)}
                placeholder="e.g. Canada"
              />
            </div>

            <div className="form-group">
              <label>Course *</label>
              <input
                type="text"
                className="form-control"
                required
                value={uniCourse}
                onChange={(e) => setUniCourse(e.target.value)}
                placeholder="e.g. M.S. in Computer Science"
              />
            </div>

            <div className="form-group">
              <label>Intake *</label>
              <input
                type="text"
                className="form-control"
                required
                value={uniIntake}
                onChange={(e) => setUniIntake(e.target.value)}
                placeholder="e.g. Fall 2026"
              />
            </div>

            <div className="form-group">
              <label>Notes / Remarks</label>
              <textarea
                className="form-control"
                rows={3}
                value={uniNotes}
                onChange={(e) => setUniNotes(e.target.value)}
                placeholder="Any special remarks..."
              />
            </div>

            <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end', marginTop: '6px' }}>
              <button type="button" className="btn" disabled={isSubmittingUni} onClick={() => setShowUniModal(false)}>Cancel</button>
              <button type="submit" className="btn btn-primary" disabled={isSubmittingUni}>
                {isSubmittingUni ? 'Submitting...' : 'Apply university'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Toast container */}
      <div style={{ position: 'fixed', bottom: '20px', right: '20px', display: 'flex', flexDirection: 'column', gap: '10px', zIndex: 9999 }}>
        {toasts.map((t) => (
          <div key={t.id} style={{
            padding: '12px 16px',
            borderRadius: '6px',
            color: '#fff',
            backgroundColor: t.type === 'success' ? '#10b981' : '#ef4444',
            boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -1px rgba(0,0,0,0.06)',
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
    </>
  );
}
