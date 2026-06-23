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

  const currentStages = PIPELINE_CONFIG[selectedCategory] || PIPELINE_CONFIG.STUDY_ABROAD;
  const filteredLeads = leads.filter((l) => {
    const matchesCategory = (l.leadCategory || 'STUDY_ABROAD') === selectedCategory;
    const fullName = `${l.firstName} ${l.lastName || ''}`.toLowerCase();
    return matchesCategory && fullName.includes(searchQuery.toLowerCase());
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 65px)', overflow: 'hidden', padding: '16px' }}>
      
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
                  // Find next scheduled followup
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

    </div>
  );
}
