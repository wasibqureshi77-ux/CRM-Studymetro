'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { api } from '../../../../lib/api';
import { useAuth } from '../../../../context/auth-context';

export default function LeadDetailPage() {
  const { id } = useParams();
  const { hasPermission } = useAuth();
  const router = useRouter();

  const [lead, setLead] = useState<any>(null);
  const [timeline, setTimeline] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [branches, setBranches] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Form states
  const [activeTab, setActiveTab] = useState<'timeline' | 'notes' | 'documents' | 'followups'>('timeline');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Note State
  const [noteContent, setNoteContent] = useState('');

  // Followup State
  const [followupDate, setFollowupDate] = useState('');
  const [followupNotes, setFollowupNotes] = useState('');

  // Document Upload State
  const [uploadType, setUploadType] = useState('Passport');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [expiryDateInput, setExpiryDateInput] = useState('');
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [toasts, setToasts] = useState<{ id: string; type: 'success' | 'error'; message: string }[]>([]);
  const [openRequestIndex, setOpenRequestIndex] = useState<number | null>(0);

  // History modal state
  const [historyDocType, setHistoryDocType] = useState<string | null>(null);
  const [historyList, setHistoryList] = useState<any[]>([]);

  const addToast = (type: 'success' | 'error', message: string) => {
    const id = Math.random().toString(36).substr(2, 9);
    setToasts((prev) => [...prev, { id, type, message }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  };

  // Document Rejection Reason Dialog State
  const [rejectionDocId, setRejectionDocId] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');

  const loadAllData = async () => {
    try {
      const [leadData, timelineData, usersData, branchesData] = await Promise.all([
        api.get(`/api/v1/leads/${id}`),
        api.get(`/api/v1/leads/${id}/timeline`),
        api.get('/api/v1/leads/meta/users'),
        api.get('/api/v1/leads/meta/branches'),
      ]);
      setLead(leadData);
      setTimeline(timelineData || []);
      setUsers(usersData || []);
      setBranches(branchesData || []);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to load details.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (id) {
      loadAllData();
    }
  }, [id]);

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      const updated = await api.patch(`/api/v1/leads/${id}`, {
        firstName: lead.firstName,
        lastName: lead.lastName,
        email: lead.email,
        phone: lead.phone,
        status: lead.status,
        source: lead.source,
        leadCategory: lead.leadCategory,
        preferredCountry: lead.preferredCountry,
        planningTimeline: lead.planningTimeline,
        intendedIntake: lead.intendedIntake,
        englishLevel: lead.englishLevel,
        targetScore: lead.targetScore,
        purpose: lead.purpose,
        courseInterest: lead.courseInterest,
        studentProfile: {
          targetCountry: lead.preferredCountry || lead.studentProfile?.targetCountry || undefined,
          targetCourse: lead.courseInterest || lead.studentProfile?.targetCourse || undefined,
          intake: lead.intendedIntake || lead.studentProfile?.intake || undefined,
          ieltsStatus: lead.studentProfile?.ieltsStatus || 'NOT_TAKEN',
          passportStatus: lead.studentProfile?.passportStatus || 'NO_PASSPORT',
          educationLevel: lead.studentProfile?.educationLevel || undefined,
          percentageGpa: lead.studentProfile?.percentageGpa || undefined,
          budget: lead.studentProfile?.budget || undefined,
          currentQualification: lead.studentProfile?.currentQualification || undefined,
        },
      });
      setSuccessMsg('Candidate record updated successfully.');
      setLead(updated);
      const tl = await api.get(`/api/v1/leads/${id}/timeline`);
      setTimeline(tl || []);
    } catch (err: any) {
      setErrorMsg(err.message || 'Update failed.');
    }
  };

  const handleAssignChange = async (assigneeId: string) => {
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      await api.patch(`/api/v1/leads/${id}/assign`, {
        assigneeId: assigneeId || null,
        branchId: lead.branchId,
      });
      setSuccessMsg('Lead assignee updated.');
      loadAllData();
    } catch (err: any) {
      setErrorMsg(err.message || 'Assignment failed.');
    }
  };

  const handleBranchChange = async (branchId: string) => {
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      await api.patch(`/api/v1/leads/${id}/assign`, {
        assigneeId: lead.assigneeId,
        branchId: branchId || null,
      });
      setSuccessMsg('Lead branch scope updated.');
      loadAllData();
    } catch (err: any) {
      setErrorMsg(err.message || 'Branch update failed.');
    }
  };

  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!noteContent.trim()) return;
    setErrorMsg(null);
    try {
      await api.post(`/api/v1/leads/${id}/notes`, { content: noteContent });
      setNoteContent('');
      setSuccessMsg('Note added successfully.');
      loadAllData();
    } catch (err: any) {
      setErrorMsg(err.message || 'Add note failed.');
    }
  };

  const handleScheduleFollowup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!followupDate) {
      setErrorMsg('Please select a date/time.');
      return;
    }
    setErrorMsg(null);
    try {
      await api.post('/api/v1/followups', {
        leadId: id,
        followupDate: new Date(followupDate).toISOString(),
        notes: followupNotes,
      });
      setFollowupDate('');
      setFollowupNotes('');
      setSuccessMsg('Followup scheduled successfully.');
      loadAllData();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to schedule followup.');
    }
  };

  const handleDocumentUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) {
      addToast('error', 'Please select a file to upload.');
      return;
    }
    setErrorMsg(null);
    setSuccessMsg(null);
    setUploadProgress(0);

    const getCookie = (name: string): string | undefined => {
      if (typeof document === 'undefined') return undefined;
      const value = `; ${document.cookie}`;
      const parts = value.split(`; ${name}=`);
      if (parts.length === 2) return parts.pop()?.split(';').shift();
      return undefined;
    };

    const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
    const formData = new FormData();
    formData.append('file', selectedFile);
    formData.append('documentType', uploadType);
    if (expiryDateInput) {
      formData.append('expiryDate', expiryDateInput);
    }

    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${API_BASE}/api/v1/documents/upload/${id}`, true);

    const token = getCookie('sm_session');
    if (token) {
      xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    }
    const tenantId = getCookie('sm_tenant_id');
    if (tenantId) {
      xhr.setRequestHeader('x-tenant-id', tenantId);
    }

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        const percentage = Math.round((event.loaded / event.total) * 100);
        setUploadProgress(percentage);
      }
    };

    xhr.onload = async () => {
      setUploadProgress(null);
      if (xhr.status >= 200 && xhr.status < 300) {
        addToast('success', 'Document uploaded successfully.');
        setSuccessMsg('Document uploaded successfully.');
        setSelectedFile(null);
        setExpiryDateInput('');
        const fileInput = document.getElementById('document-file-input') as HTMLInputElement;
        if (fileInput) fileInput.value = '';
        await loadAllData();
      } else {
        let errMsg = 'Document upload failed.';
        try {
          const res = JSON.parse(xhr.responseText);
          errMsg = res.message || errMsg;
        } catch (err) {
          errMsg = xhr.responseText || errMsg;
        }
        addToast('error', errMsg);
        setErrorMsg(errMsg);
      }
    };

    xhr.onerror = () => {
      setUploadProgress(null);
      addToast('error', 'Network error occurred during upload.');
      setErrorMsg('Network error occurred during upload.');
    };

    xhr.send(formData);
  };

  const handleDownload = async (docId: string, filename: string) => {
    setErrorMsg(null);
    try {
      const getCookie = (name: string): string | undefined => {
        if (typeof document === 'undefined') return undefined;
        const value = `; ${document.cookie}`;
        const parts = value.split(`; ${name}=`);
        if (parts.length === 2) return parts.pop()?.split(';').shift();
        return undefined;
      };
      const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
      const response = await fetch(`${API_BASE}/api/v1/documents/download/${docId}`, {
        headers: {
          'Authorization': `Bearer ${getCookie('sm_session')}`,
          'x-tenant-id': getCookie('sm_tenant_id') || ''
        }
      });
      if (!response.ok) throw new Error('Download failed');
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(blobUrl);
      addToast('success', 'Document download initiated.');
    } catch (err: any) {
      addToast('error', err.message || 'Failed to download document.');
    }
  };

  const handleView = async (docId: string) => {
    setErrorMsg(null);
    try {
      const getCookie = (name: string): string | undefined => {
        if (typeof document === 'undefined') return undefined;
        const value = `; ${document.cookie}`;
        const parts = value.split(`; ${name}=`);
        if (parts.length === 2) return parts.pop()?.split(';').shift();
        return undefined;
      };
      const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
      const response = await fetch(`${API_BASE}/api/v1/documents/view/${docId}`, {
        headers: {
          'Authorization': `Bearer ${getCookie('sm_session')}`,
          'x-tenant-id': getCookie('sm_tenant_id') || ''
        }
      });
      if (!response.ok) throw new Error('Failed to open document');
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      window.open(blobUrl, '_blank');
      addToast('success', 'Document opened in new window.');
    } catch (err: any) {
      addToast('error', err.message || 'Failed to open document.');
    }
  };

  const handleDelete = async (docId: string) => {
    setErrorMsg(null);
    if (!confirm('Are you sure you want to delete this document file? This resets the status back to PENDING.')) return;
    try {
      await api.delete(`/api/v1/documents/${docId}`);
      addToast('success', 'Document deleted.');
      loadAllData();
    } catch (err: any) {
      addToast('error', err.message || 'Delete failed.');
    }
  };

  const handleApproveDocument = async (docId: string) => {
    setErrorMsg(null);
    try {
      await api.patch(`/api/v1/documents/${docId}/approve`, {
        approvalStatus: 'APPROVED',
      });
      addToast('success', 'Document marked as APPROVED.');
      loadAllData();
    } catch (err: any) {
      addToast('error', err.message || 'Approval action failed.');
    }
  };

  const handleRejectDocument = async () => {
    if (!rejectionDocId || !rejectionReason.trim()) return;
    setErrorMsg(null);
    try {
      await api.patch(`/api/v1/documents/${rejectionDocId}/approve`, {
        approvalStatus: 'REJECTED',
        rejectionReason: rejectionReason,
      });
      addToast('success', 'Document marked as REJECTED.');
      setRejectionDocId(null);
      setRejectionReason('');
      loadAllData();
    } catch (err: any) {
      addToast('error', err.message || 'Rejection action failed.');
    }
  };

  const handleRequestMissing = async () => {
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      const res = await api.post(`/api/v1/documents/request-missing/${id}`);
      if (res && res.length > 0) {
        addToast('success', `Requested missing required documents: ${res.join(', ')}`);
        setSuccessMsg(`Requested missing required documents: ${res.join(', ')}`);
      } else {
        addToast('success', 'No missing required documents found!');
      }
      loadAllData();
    } catch (err: any) {
      addToast('error', err.message || 'Request failed.');
    }
  };

  const handleViewHistory = async (docType: string) => {
    try {
      const list = await api.get(`/api/v1/documents/history/${id}/${docType}`);
      setHistoryDocType(docType);
      setHistoryList(list || []);
    } catch (err: any) {
      addToast('error', 'Failed to retrieve version history.');
    }
  };

  if (loading) {
    return (
      <div style={{ padding: '20px', fontWeight: 600 }}>
        Querying candidate database records...
      </div>
    );
  }

  if (!lead) {
    return (
      <div style={{ padding: '20px', color: 'var(--danger-color)' }}>
        Lead not found or access unauthorized.
      </div>
    );
  }

  const PIPELINES: Record<string, string[]> = {
    STUDY_ABROAD: [
      'NEW_LEAD',
      'CONTACTED',
      'COUNSELLING',
      'DOCUMENTS_PENDING',
      'DOCUMENTS_RECEIVED',
      'UNIVERSITY_APPLIED',
      'OFFER_LETTER',
      'VISA_PROCESS',
      'ADMISSION_CLOSED',
      'LOST'
    ],
    IELTS: [
      'NEW_LEAD',
      'CONTACTED',
      'DEMO_CLASS',
      'ENROLLED',
      'TRAINING',
      'EXAM_BOOKED',
      'COMPLETED',
      'LOST'
    ],
    PTE: [
      'NEW_LEAD',
      'CONTACTED',
      'DEMO_CLASS',
      'ENROLLED',
      'TRAINING',
      'EXAM_BOOKED',
      'COMPLETED',
      'LOST'
    ],
    ENGLISH_SPEAKING: [
      'NEW_LEAD',
      'CONTACTED',
      'DEMO_CLASS',
      'ENROLLED',
      'TRAINING',
      'COMPLETED',
      'LOST'
    ],
    COMPUTER_COURSE: [
      'NEW_LEAD',
      'CONTACTED',
      'COUNSELLING',
      'DEMO_SESSION',
      'ENROLLED',
      'COURSE_ONGOING',
      'COMPLETED',
      'LOST'
    ],
    DIGITAL_MARKETING: [
      'NEW_LEAD',
      'CONTACTED',
      'COUNSELLING',
      'DEMO_SESSION',
      'ENROLLED',
      'COURSE_ONGOING',
      'COMPLETED',
      'LOST'
    ],
    OTHER: [
      'NEW_LEAD',
      'CONTACTED',
      'COUNSELLING',
      'DEMO_SESSION',
      'ENROLLED',
      'COURSE_ONGOING',
      'COMPLETED',
      'LOST'
    ]
  };

  const getPipelineStages = (category: string): string[] => {
    return PIPELINES[category] || PIPELINES.STUDY_ABROAD;
  };

  const getProgressPercentage = (status: string, category: string): number => {
    const stages = getPipelineStages(category || 'STUDY_ABROAD');
    if (status === 'LOST') return 0;
    const nonLostStages = stages.filter(s => s !== 'LOST');
    const nonLostIndex = nonLostStages.indexOf(status);
    if (nonLostIndex === -1) return 0;
    if (nonLostStages.length <= 1) return 100;
    return Math.round((nonLostIndex / (nonLostStages.length - 1)) * 100);
  };

  const getExpiryBadge = (expiryStr: string) => {
    if (!expiryStr) return null;
    const expiry = new Date(expiryStr);
    const today = new Date();
    const diffTime = expiry.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays <= 0) {
      return <span className="badge" style={{ backgroundColor: '#fee2e2', color: '#ef4444', fontWeight: 600 }}>Expired</span>;
    } else if (diffDays <= 30) {
      return <span className="badge" style={{ backgroundColor: '#ffedd5', color: '#ea580c', fontWeight: 600 }}>Expires in {diffDays} Days</span>;
    } else if (diffDays <= 90) {
      return <span className="badge" style={{ backgroundColor: '#fef9c3', color: '#ca8a04', fontWeight: 600 }}>Expires in {diffDays} Days</span>;
    }
    return <span className="badge" style={{ backgroundColor: '#dcfce7', color: '#22c55e', fontWeight: 600 }}>Expires: {expiry.toLocaleDateString()}</span>;
  };

  // Readiness styling
  const readiness = lead.readinessScore ?? 0;
  const readinessColor = readiness >= 80 ? 'var(--success-color)' : readiness >= 50 ? '#eab308' : 'var(--danger-color)';

  // Required vs optional
  const activeChecklist = lead.documents?.filter((d: any) => d.isCurrent) || [];
  const requiredCount = activeChecklist.filter((d: any) => d.isRequired).length;
  const verifiedRequiredCount = activeChecklist.filter((d: any) => d.isRequired && d.status === 'VERIFIED').length;

  return (
    <div className="split-container">
      {/* LEFT PANE: Editable Student Details */}
      <section className="split-left">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <h3 style={{ fontSize: '13px', fontWeight: 700, margin: 0 }}>
              {lead.firstName} {lead.lastName}
            </h3>
            <span style={{
              fontSize: '10px',
              fontWeight: 800,
              padding: '2px 6px',
              borderRadius: '4px',
              backgroundColor: '#e0f2fe',
              color: '#0284c7',
              textTransform: 'uppercase'
            }}>
              {(lead.leadCategory || 'STUDY_ABROAD').replace('_', ' ')}
            </span>
          </div>
          <button onClick={() => router.push('/dashboard/leads')} className="btn btn-sm">
            ← Back to List
          </button>
        </div>

        {/* Student Progress Meter */}
        <div style={{ marginTop: '12px', marginBottom: '12px', background: '#f8fafc', border: '1px solid var(--border-color)', borderRadius: '6px', padding: '12px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <span style={{ fontSize: '11px', fontWeight: 700, color: '#334155' }}>Admission Pipeline Progress</span>
              <span style={{ fontSize: '11px', fontWeight: 800, color: 'var(--primary-color)' }}>{getProgressPercentage(lead.status, lead.leadCategory)}%</span>
            </div>
            <div style={{ width: '100%', height: '6px', backgroundColor: '#e2e8f0', borderRadius: '4px', overflow: 'hidden' }}>
              <div style={{
                width: `${getProgressPercentage(lead.status, lead.leadCategory)}%`,
                height: '100%',
                backgroundColor: getProgressPercentage(lead.status, lead.leadCategory) === 100 ? 'var(--success-color)' : 'var(--primary-color)',
                transition: 'width 0.5s ease-in-out'
              }}></div>
            </div>
          </div>

          <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '8px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <span style={{ fontSize: '11px', fontWeight: 700, color: '#334155' }}>Lead File Readiness Score</span>
              <span style={{ fontSize: '11px', fontWeight: 800, color: readinessColor }}>{readiness}% ({verifiedRequiredCount}/{requiredCount} Verified)</span>
            </div>
            <div style={{ width: '100%', height: '6px', backgroundColor: '#e2e8f0', borderRadius: '4px', overflow: 'hidden' }}>
              <div style={{
                width: `${readiness}%`,
                height: '100%',
                backgroundColor: readinessColor,
                transition: 'width 0.5s ease-in-out'
              }}></div>
            </div>
          </div>
        </div>

        {/* Action responses */}
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

        <form onSubmit={handleUpdateProfile} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div style={{ fontWeight: 700, fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
            Personal Administrative Info
          </div>

          <div style={{ display: 'flex', gap: '8px' }}>
            <div className="form-group" style={{ flex: 1 }}>
              <label>First Name</label>
              <input
                type="text"
                className="form-control"
                value={lead.firstName || ''}
                onChange={(e) => setLead({ ...lead, firstName: e.target.value })}
              />
            </div>
            <div className="form-group" style={{ flex: 1 }}>
              <label>Last Name</label>
              <input
                type="text"
                className="form-control"
                value={lead.lastName || ''}
                onChange={(e) => setLead({ ...lead, lastName: e.target.value })}
              />
            </div>
          </div>

          <div style={{ display: 'flex', gap: '8px' }}>
            <div className="form-group" style={{ flex: 1 }}>
              <label>Email</label>
              <input
                type="email"
                className="form-control"
                value={lead.email || ''}
                onChange={(e) => setLead({ ...lead, email: e.target.value })}
              />
            </div>
            <div className="form-group" style={{ flex: 1 }}>
              <label>Phone</label>
              <input
                type="text"
                className="form-control"
                value={lead.phone || ''}
                onChange={(e) => setLead({ ...lead, phone: e.target.value })}
              />
            </div>
          </div>

          <div style={{ display: 'flex', gap: '8px' }}>
            <div className="form-group" style={{ flex: 1 }}>
              <label>Outreach Stage</label>
              <select className="form-control" value={lead.status} onChange={(e) => setLead({ ...lead, status: e.target.value })}>
                {getPipelineStages(lead.leadCategory || 'STUDY_ABROAD').map((st) => (
                  <option key={st} value={st}>
                    {st === 'NEW_LEAD' && 'New Lead'}
                    {st === 'CONTACTED' && 'Contacted'}
                    {st === 'COUNSELLING' && 'Counselling'}
                    {st === 'DEMO_CLASS' && 'Demo Class'}
                    {st === 'DEMO_SESSION' && 'Demo Session'}
                    {st === 'ENROLLED' && 'Enrolled'}
                    {st === 'TRAINING' && 'Training'}
                    {st === 'EXAM_BOOKED' && 'Exam Booked'}
                    {st === 'COURSE_ONGOING' && 'Course Ongoing'}
                    {st === 'COMPLETED' && 'Completed'}
                    {st === 'DOCUMENTS_PENDING' && 'Documents Pending'}
                    {st === 'DOCUMENTS_RECEIVED' && 'Documents Received'}
                    {st === 'UNIVERSITY_APPLIED' && 'University Applied'}
                    {st === 'OFFER_LETTER' && 'Offer Letter'}
                    {st === 'VISA_PROCESS' && 'Visa Process'}
                    {st === 'ADMISSION_CLOSED' && 'Admission Closed'}
                    {st === 'LOST' && 'Lost / Not Interested'}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group" style={{ flex: 1 }}>
              <label>Lead Category</label>
              <select
                className="form-control"
                value={lead.leadCategory || 'STUDY_ABROAD'}
                onChange={(e) => {
                  const newCategory = e.target.value;
                  const stages = getPipelineStages(newCategory);
                  setLead({
                    ...lead,
                    leadCategory: newCategory,
                    status: stages[0]
                  });
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

            <div className="form-group" style={{ flex: 1 }}>
              <label>Ingress Source</label>
              <select className="form-control" value={lead.source} onChange={(e) => setLead({ ...lead, source: e.target.value })}>
                <option value="WEBSITE_SDK">Website SDK</option>
                <option value="WHATSAPP">WhatsApp</option>
                <option value="TELEPHONY">Telephony</option>
                <option value="MANUAL">Manual Ingress</option>
                <option value="API_IMPORT">API Import</option>
                <option value="FACEBOOK_ADS">Facebook Ads</option>
                <option value="DYNAMIC_FORM">Dynamic Form</option>
              </select>
            </div>
          </div>

          {/* Scopes Assignments */}
          <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
            <div className="form-group" style={{ flex: 1 }}>
              <label>Assignee Agent</label>
              <select
                className="form-control"
                value={lead.assigneeId || ''}
                onChange={(e) => handleAssignChange(e.target.value)}
              >
                <option value="">-- Unassigned --</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>{u.firstName} {u.lastName}</option>
                ))}
              </select>
            </div>

            <div className="form-group" style={{ flex: 1 }}>
              <label>Branch Boundary</label>
              <select
                className="form-control"
                value={lead.branchId || ''}
                onChange={(e) => handleBranchChange(e.target.value)}
              >
                <option value="">-- No Branch Boundary --</option>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div style={{ fontWeight: 700, fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', marginTop: '6px' }}>
            {(lead.leadCategory || 'STUDY_ABROAD').replace('_', ' ')} Profile Details
          </div>

          {/* If Study Abroad */}
          {(lead.leadCategory === 'STUDY_ABROAD' || !lead.leadCategory) && (
            <>
              <div style={{ display: 'flex', gap: '8px' }}>
                <div className="form-group" style={{ flex: 1 }}>
                  <label>Target Country</label>
                  <input
                    type="text"
                    className="form-control"
                    value={lead.preferredCountry || lead.studentProfile?.targetCountry || ''}
                    onChange={(e) =>
                      setLead({
                        ...lead,
                        preferredCountry: e.target.value,
                        studentProfile: { ...lead.studentProfile, targetCountry: e.target.value },
                      })
                    }
                  />
                </div>
                <div className="form-group" style={{ flex: 1 }}>
                  <label>Target Course</label>
                  <input
                    type="text"
                    className="form-control"
                    value={lead.courseInterest || lead.studentProfile?.targetCourse || ''}
                    onChange={(e) =>
                      setLead({
                        ...lead,
                        courseInterest: e.target.value,
                        studentProfile: { ...lead.studentProfile, targetCourse: e.target.value },
                      })
                    }
                  />
                </div>
              </div>

              <div style={{ display: 'flex', gap: '8px' }}>
                <div className="form-group" style={{ flex: 1 }}>
                  <label>Intake Season</label>
                  <input
                    type="text"
                    className="form-control"
                    value={lead.intendedIntake || lead.studentProfile?.intake || ''}
                    onChange={(e) =>
                      setLead({
                        ...lead,
                        intendedIntake: e.target.value,
                        studentProfile: { ...lead.studentProfile, intake: e.target.value },
                      })
                    }
                  />
                </div>
                <div className="form-group" style={{ flex: 1 }}>
                  <label>Planning Timeline</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="e.g. Next 3 months"
                    value={lead.planningTimeline || ''}
                    onChange={(e) =>
                      setLead({
                        ...lead,
                        planningTimeline: e.target.value,
                      })
                    }
                  />
                </div>
              </div>
            </>
          )}

          {/* If IELTS or PTE */}
          {(lead.leadCategory === 'IELTS' || lead.leadCategory === 'PTE') && (
            <div style={{ display: 'flex', gap: '8px' }}>
              <div className="form-group" style={{ flex: 1 }}>
                <label>English Level</label>
                <select
                  className="form-control"
                  value={lead.englishLevel || ''}
                  onChange={(e) => setLead({ ...lead, englishLevel: e.target.value })}
                >
                  <option value="">-- Select Level --</option>
                  <option value="BEGINNER">Beginner</option>
                  <option value="INTERMEDIATE">Intermediate</option>
                  <option value="ADVANCED">Advanced</option>
                </select>
              </div>
              <div className="form-group" style={{ flex: 1 }}>
                <label>Target Score</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="e.g. 7.5 or 79"
                  value={lead.targetScore || ''}
                  onChange={(e) => setLead({ ...lead, targetScore: e.target.value })}
                />
              </div>
            </div>
          )}

          {/* If English Speaking */}
          {lead.leadCategory === 'ENGLISH_SPEAKING' && (
            <div className="form-group">
              <label>Purpose</label>
              <input
                type="text"
                className="form-control"
                placeholder="e.g. Career growth, Study abroad"
                value={lead.purpose || ''}
                onChange={(e) => setLead({ ...lead, purpose: e.target.value })}
              />
            </div>
          )}

          {/* If Computer Course, Digital Marketing, or Other */}
          {(lead.leadCategory === 'COMPUTER_COURSE' || lead.leadCategory === 'DIGITAL_MARKETING' || lead.leadCategory === 'OTHER') && (
            <div className="form-group">
              <label>Course Interest</label>
              <input
                type="text"
                className="form-control"
                placeholder="e.g. Python Web Development"
                value={lead.courseInterest || ''}
                onChange={(e) => setLead({ ...lead, courseInterest: e.target.value })}
              />
            </div>
          )}

          <button type="submit" className="btn btn-primary" style={{ padding: '8px', marginTop: '4px', width: '100%' }}>
            Save Profile Changes
          </button>
        </form>

        {lead.submissions && lead.submissions.length > 0 && (
          <div style={{ marginTop: '20px', borderTop: '1px solid var(--border-color)', paddingTop: '16px' }}>
            <div style={{ fontWeight: 700, fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '10px' }}>
              Submission History ({lead.submissions.length})
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {lead.submissions.map((sub: any, idx: number) => {
                const isLatest = idx === 0;
                const reqNum = lead.submissions.length - idx;
                const isOpen = openRequestIndex === idx;
                return (
                  <div key={sub.id} style={{ border: '1px solid var(--border-color)', borderRadius: '6px', overflow: 'hidden' }}>
                    <button
                      type="button"
                      onClick={() => setOpenRequestIndex(isOpen ? null : idx)}
                      style={{
                        width: '100%',
                        padding: '10px 12px',
                        background: isOpen ? '#f1f5f9' : '#fff',
                        border: 'none',
                        textAlign: 'left',
                        fontWeight: 600,
                        fontSize: '12px',
                        cursor: 'pointer',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        color: '#1e293b'
                      }}
                    >
                      <span>
                        Request #{reqNum} {isLatest ? '(Latest)' : ''}
                      </span>
                      <span>{isOpen ? '▼' : '►'}</span>
                    </button>
                    {isOpen && (
                      <div style={{ padding: '12px', background: '#f8fafc', fontSize: '11px', borderTop: '1px solid var(--border-color)', color: '#334155', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        <div><strong>Submitted At:</strong> {new Date(sub.createdAt).toLocaleString()}</div>
                        <div><strong>Source:</strong> {sub.source || '—'}</div>
                        <div><strong>Target Country:</strong> {sub.country || '—'}</div>
                        <div><strong>Target Course:</strong> {sub.course || '—'}</div>
                        <div><strong>Intake Period:</strong> {sub.intake || '—'}</div>
                        <div><strong>Landing Page:</strong> {sub.landingPage ? <a href={sub.landingPage} target="_blank" rel="noreferrer" style={{ color: '#2563eb' }}>{sub.landingPage}</a> : '—'}</div>
                        <div><strong>Referrer:</strong> {sub.referrer || '—'}</div>
                        { (sub.utmSource || sub.utmMedium || sub.utmCampaign) && (
                          <div style={{ marginTop: '4px', padding: '6px', background: '#fff', border: '1px solid #e2e8f0', borderRadius: '4px' }}>
                            <div style={{ fontWeight: 600, marginBottom: '2px' }}>UTM Attribution:</div>
                            <div>Source: {sub.utmSource || '—'} | Medium: {sub.utmMedium || '—'} | Campaign: {sub.utmCampaign || '—'}</div>
                            {sub.utmContent && <div>Content: {sub.utmContent}</div>}
                            {sub.utmTerm && <div>Term: {sub.utmTerm}</div>}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </section>

      {/* RIGHT PANE: Chronological Timeline Tabs */}
      <section className="split-right">
        <div className="tab-nav">
          <button
            className={`tab-btn ${activeTab === 'timeline' ? 'active' : ''}`}
            onClick={() => setActiveTab('timeline')}
          >
            📜 Activity Log ({timeline.length})
          </button>
          <button
            className={`tab-btn ${activeTab === 'notes' ? 'active' : ''}`}
            onClick={() => setActiveTab('notes')}
          >
            ✏️ Add Note
          </button>
          <button
            className={`tab-btn ${activeTab === 'documents' ? 'active' : ''}`}
            onClick={() => setActiveTab('documents')}
          >
            📁 Documents checklist
          </button>
          <button
            className={`tab-btn ${activeTab === 'followups' ? 'active' : ''}`}
            onClick={() => setActiveTab('followups')}
          >
            📆 Schedule Followup
          </button>
        </div>

        <div className="tab-content">
          {/* Tab 1: Timeline */}
          {activeTab === 'timeline' && (
            <div className="timeline-list">
              {timeline.length === 0 ? (
                <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '20px' }}>
                  No activity recorded on this student lead.
                </p>
              ) : (
                timeline.map((node, index) => {
                  const dateLabel = new Date(node.date).toLocaleString();
                  const type = node.type;

                  if (type === 'note') {
                    return (
                      <div key={index} className="timeline-node" style={{ borderLeftColor: '#86198f' }}>
                        <div className="timeline-meta">📝 NOTE added by {node.data.author?.firstName || 'User'} at {dateLabel}</div>
                        <div className="timeline-desc" style={{ fontStyle: 'italic', background: '#fdf4ff', padding: '6px', borderRadius: '4px', marginTop: '4px', borderLeft: '3px solid #d946ef' }}>
                          "{node.data.content}"
                        </div>
                      </div>
                    );
                  }

                  if (type === 'document') {
                    return (
                      <div key={index} className="timeline-node" style={{ borderLeftColor: '#0c4a6e' }}>
                        <div className="timeline-meta">📁 DOCUMENT event: {node.data.documentType} (V{node.data.version}) at {dateLabel}</div>
                        <div className="timeline-desc">
                          Status: <span className="badge" style={{ backgroundColor: '#f0f9ff', color: '#0369a1' }}>{node.data.status}</span>
                          {node.data.verificationNote && <div style={{ fontSize: '10px', color: 'var(--danger-color)', fontStyle: 'italic', marginTop: '2px' }}>Reason: {node.data.verificationNote}</div>}
                        </div>
                      </div>
                    );
                  }

                  if (type === 'followup') {
                    return (
                      <div key={index} className="timeline-node" style={{ borderLeftColor: '#ca8a04' }}>
                        <div className="timeline-meta">📆 FOLLOWUP scheduled for {new Date(node.data.followupDate).toLocaleString()}</div>
                        <div className="timeline-desc">
                          Agenda: {node.data.notes || 'No notes'} — Status: <strong>{node.data.status}</strong>
                        </div>
                      </div>
                    );
                  }

                  if (type === 'submission') {
                    return (
                      <div key={index} className="timeline-node" style={{ borderLeftColor: '#2563eb' }}>
                        <div className="timeline-meta">📬 Request #{node.data.requestNumber} Submitted — {dateLabel}</div>
                        <div className="timeline-desc" style={{ background: '#eff6ff', padding: '10px', borderRadius: '6px', marginTop: '4px', borderLeft: '3px solid #3b82f6', fontSize: '11px', color: '#1e293b' }}>
                          <div><strong>Target Country:</strong> {node.data.country || '—'}</div>
                          <div><strong>Target Course:</strong> {node.data.course || '—'}</div>
                          <div><strong>Intake Period:</strong> {node.data.intake || '—'}</div>
                          {node.data.landingPage && <div><strong>Landing Page:</strong> <a href={node.data.landingPage} target="_blank" rel="noreferrer" style={{ color: '#2563eb' }}>{node.data.landingPage}</a></div>}
                        </div>
                      </div>
                    );
                  }

                  return (
                    <div key={index} className="timeline-node">
                      <div className="timeline-meta">⚡ {node.data.type} — {dateLabel}</div>
                      <div className="timeline-desc">{node.data.description}</div>
                    </div>
                  );
                })
              )}
            </div>
          )}

          {/* Tab 2: Notes Editor */}
          {activeTab === 'notes' && (
            <form onSubmit={handleAddNote} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div className="form-group">
                <label>Counselor Note Content</label>
                <textarea
                  className="form-control"
                  rows={4}
                  placeholder="Record summary of counseling, student visa concerns, or qualification remarks..."
                  value={noteContent}
                  onChange={(e) => setNoteContent(e.target.value)}
                  required
                />
              </div>
              <button type="submit" className="btn btn-primary" style={{ width: '120px' }}>
                Save Note
              </button>
            </form>
          )}

          {/* Tab 3: Documents Upload & Verification */}
          {activeTab === 'documents' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)' }}>Checklist Requirements List</span>
                <button type="button" onClick={handleRequestMissing} className="btn btn-primary btn-sm">
                  📢 Request Missing Documents
                </button>
              </div>

              {/* Document upload form */}
              <form onSubmit={handleDocumentUpload} style={{ display: 'flex', flexDirection: 'column', gap: '10px', paddingBottom: '16px', borderBottom: '1px solid var(--border-color)', marginBottom: '16px' }}>
                <div style={{ fontWeight: 700, fontSize: '11px', color: 'var(--text-muted)' }}>
                  Upload File to checklist
                </div>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
                  <div className="form-group" style={{ flex: 1, minWidth: '150px' }}>
                    <label>Document Target Slot</label>
                    <select className="form-control" value={uploadType} onChange={(e) => setUploadType(e.target.value)}>
                      {activeChecklist.map((d: any) => (
                        <option key={d.id} value={d.documentType}>{d.documentType} {d.isRequired ? '*' : '(Optional)'}</option>
                      ))}
                    </select>
                  </div>

                  <div className="form-group" style={{ flex: 1, minWidth: '150px' }}>
                    <label>Expiry Date (if applicable)</label>
                    <input
                      type="date"
                      className="form-control"
                      value={expiryDateInput}
                      onChange={(e) => setExpiryDateInput(e.target.value)}
                    />
                  </div>

                  <div className="form-group" style={{ flex: 2, minWidth: '200px' }}>
                    <label>Choose File</label>
                    <input
                      id="document-file-input"
                      type="file"
                      className="form-control"
                      accept=".pdf,.jpg,.jpeg,.png"
                      onChange={(e) => {
                        if (e.target.files && e.target.files.length > 0) {
                          setSelectedFile(e.target.files[0]);
                        }
                      }}
                      required
                    />
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <button type="submit" className="btn btn-primary" style={{ width: '160px' }}>
                    📤 Upload / Replace
                  </button>
                  {uploadProgress !== null && (
                    <div style={{ flex: 1, backgroundColor: '#e2e8f0', borderRadius: '9999px', height: '8px', overflow: 'hidden' }}>
                      <div style={{ backgroundColor: 'var(--primary-color)', height: '100%', width: `${uploadProgress}%`, transition: 'width 0.1s ease-out' }}></div>
                    </div>
                  )}
                </div>
              </form>

              {/* Active Documents List */}
              {activeChecklist.length === 0 ? (
                <p style={{ color: 'var(--text-muted)', fontStyle: 'italic', fontSize: '12px' }}>
                  No checklist generated yet.
                </p>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table className="dense-table" style={{ width: '100%' }}>
                    <thead>
                      <tr>
                        <th>Document Slot</th>
                        <th>File Info</th>
                        <th>Version</th>
                        <th>Expiry Alert</th>
                        <th>Approval Status</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {activeChecklist.map((doc: any) => (
                        <tr key={doc.id}>
                          <td>
                            <strong>{doc.documentType}</strong>{' '}
                            {doc.isRequired ? (
                              <span style={{ color: 'var(--danger-color)', fontWeight: 800 }}>*</span>
                            ) : (
                              <span style={{ fontSize: '9px', color: 'var(--text-muted)' }}>(Optional)</span>
                            )}
                          </td>
                          <td>
                            {doc.originalFileName ? (
                              <span style={{ fontSize: '11px', fontFamily: 'monospace' }}>
                                {doc.originalFileName} ({ (doc.fileSize / 1024).toFixed(1) } KB)
                              </span>
                            ) : (
                              <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>Pending upload</span>
                            )}
                          </td>
                          <td>
                            {doc.originalFileName ? (
                              <button type="button" onClick={() => handleViewHistory(doc.documentType)} className="btn btn-xs btn-primary">
                                V{doc.version} 📋 History
                              </button>
                            ) : (
                              '—'
                            )}
                          </td>
                          <td>
                            {doc.expiryDate ? getExpiryBadge(doc.expiryDate) : '—'}
                          </td>
                          <td>
                            <span
                              className="badge"
                              style={{
                                backgroundColor:
                                  doc.status === 'VERIFIED' ? '#dcfce7' : doc.status === 'REJECTED' ? '#fee2e2' : doc.status === 'UPLOADED' ? '#eff6ff' : '#f1f5f9',
                                color:
                                  doc.status === 'VERIFIED' ? '#166534' : doc.status === 'REJECTED' ? '#991b1b' : doc.status === 'UPLOADED' ? '#1d4ed8' : '#475569',
                              }}
                            >
                              {doc.status}
                            </span>
                            {doc.verificationNote && (
                              <div style={{ fontSize: '9px', color: 'var(--danger-color)', marginTop: '2px', fontStyle: 'italic' }}>
                                Reason: {doc.verificationNote}
                              </div>
                            )}
                          </td>
                          <td>
                            <div style={{ display: 'flex', gap: '4px' }}>
                              {doc.filePath && (
                                <>
                                  <button onClick={() => handleView(doc.id)} className="btn btn-xs" title="View file">👁️</button>
                                  <button onClick={() => handleDownload(doc.id, doc.originalFileName)} className="btn btn-xs" title="Download file">📥</button>
                                  <button onClick={() => handleDelete(doc.id)} className="btn btn-xs btn-danger" title="Delete file">🗑️</button>
                                </>
                              )}
                              {doc.status === 'UPLOADED' && (
                                <>
                                  <button
                                    onClick={() => handleApproveDocument(doc.id)}
                                    className="btn btn-xs"
                                    style={{ backgroundColor: 'var(--success-color)', color: '#fff' }}
                                  >
                                    Verify
                                  </button>
                                  <button
                                    onClick={() => setRejectionDocId(doc.id)}
                                    className="btn btn-xs btn-danger"
                                  >
                                    Reject
                                  </button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Tab 4: Schedule Followup */}
          {activeTab === 'followups' && (
            <form onSubmit={handleScheduleFollowup} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div className="form-group">
                <label>Follow-up Date / Time</label>
                <input
                  type="datetime-local"
                  className="form-control"
                  value={followupDate}
                  onChange={(e) => setFollowupDate(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label>Action Objective notes</label>
                <textarea
                  className="form-control"
                  rows={3}
                  placeholder="Record call attempt agenda or document reminders..."
                  value={followupNotes}
                  onChange={(e) => setFollowupNotes(e.target.value)}
                />
              </div>

              <button type="submit" className="btn btn-primary" style={{ width: '150px' }}>
                📆 Book Calendar Entry
              </button>
            </form>
          )}
        </div>
      </section>

      {/* Version History Modal */}
      {historyDocType && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15, 23, 42, 0.4)', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="login-card" style={{ width: '500px', maxHeight: '80vh', overflowY: 'auto' }}>
            <h3 style={{ fontSize: '13px', fontWeight: 700, marginBottom: '12px' }}>{historyDocType} Version History</h3>
            <table className="dense-table" style={{ width: '100%' }}>
              <thead>
                <tr>
                  <th>Ver</th>
                  <th>Filename</th>
                  <th>Upload Date</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {historyList.map((h) => (
                  <tr key={h.id} style={{ opacity: h.isCurrent ? 1 : 0.6 }}>
                    <td><strong>V{h.version}</strong> {h.isCurrent && <span style={{ fontSize: '9px', color: 'var(--success-color)' }}>(Current)</span>}</td>
                    <td><span style={{ fontSize: '10px', fontFamily: 'monospace' }}>{h.originalFileName || '—'}</span></td>
                    <td>{h.uploadedAt ? new Date(h.uploadedAt).toLocaleDateString() : '—'}</td>
                    <td>{h.status}</td>
                    <td>
                      {h.filePath && (
                        <div style={{ display: 'flex', gap: '2px' }}>
                          <button onClick={() => handleView(h.id)} className="btn btn-xs">👁️</button>
                          <button onClick={() => handleDownload(h.id, h.originalFileName)} className="btn btn-xs">📥</button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '12px' }}>
              <button className="btn btn-sm" onClick={() => setHistoryDocType(null)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* Rejection Reason Modal */}
      {rejectionDocId && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15, 23, 42, 0.4)', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="login-card" style={{ width: '400px' }}>
            <h3 style={{ fontSize: '13px', fontWeight: 700, marginBottom: '12px' }}>Reject Document Reason</h3>
            <div className="form-group">
              <label>Rejection Reason</label>
              <textarea
                className="form-control"
                rows={3}
                placeholder="Explain the document rejection reason (e.g. invalid date, low resolution)..."
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
              />
            </div>
            <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end', marginTop: '12px' }}>
              <button className="btn" onClick={() => setRejectionDocId(null)}>Cancel</button>
              <button className="btn btn-danger" onClick={handleRejectDocument}>Reject Document</button>
            </div>
          </div>
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
            animation: 'slideIn 0.2s ease-out'
          }}>
            <span>{t.type === 'success' ? '✓' : '⚠️'} {t.message}</span>
            <button onClick={() => setToasts(prev => prev.filter(item => item.id !== t.id))} style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', fontSize: '14px', marginLeft: '10px' }}>×</button>
          </div>
        ))}
      </div>
    </div>
  );
}
