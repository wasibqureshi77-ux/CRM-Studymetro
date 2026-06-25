'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { api } from '../../../../lib/api';
import { useAuth } from '../../../../context/auth-context';

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

export default function LeadDetailPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const router = useRouter();

  const isLockedWorkflow = user?.role === 'COUNSELLOR' && [
    'DOCUMENTS_PENDING',
    'DOCUMENTS_RECEIVED',
    'UNIVERSITY_APPLIED',
    'OFFER_LETTER',
    'VISA_PROCESS',
    'ADMISSION_CLOSED',
    'COMPLETED'
  ].includes(lead?.status);

  const minDateTime = (() => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  })();

  const [lead, setLead] = useState<any>(null);
  const [timeline, setTimeline] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [branches, setBranches] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Form states
  const [activeTab, setActiveTab] = useState<'timeline' | 'notes' | 'documents' | 'followups' | 'applications' | 'communications' | 'brochures'>('timeline');
  const [commLogs, setCommLogs] = useState<any[]>([]);
  const [brochuresList, setBrochuresList] = useState<any[]>([]);
  const [brochureAssignments, setBrochureAssignments] = useState<any[]>([]);
  const [showSendBrochureModal, setShowSendBrochureModal] = useState(false);
  const [selectedBrochureId, setSelectedBrochureId] = useState('');
  const [sendingBrochure, setSendingBrochure] = useState(false);
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

  // University Application States
  const [applications, setApplications] = useState<any[]>([]);
  const [showAddUniModal, setShowAddUniModal] = useState(false);
  const [newUniName, setNewUniName] = useState('');
  const [newUniCountry, setNewUniCountry] = useState('');
  const [newUniCourse, setNewUniCourse] = useState('');
  const [newUniIntake, setNewUniIntake] = useState('');
  const [newUniNotes, setNewUniNotes] = useState('');
  const [isSubmittingUni, setIsSubmittingUni] = useState(false);

  // Update University States
  const [showUpdateUniModal, setShowUpdateUniModal] = useState(false);
  const [updateUniId, setUpdateUniId] = useState('');
  const [updateUniName, setUpdateUniName] = useState('');
  const [updateUniTuitionFee, setUpdateUniTuitionFee] = useState('');
  const [updateUniScholarship, setUpdateUniScholarship] = useState('');
  const [updateUniNotes, setUpdateUniNotes] = useState('');
  const [isSubmittingUpdateUni, setIsSubmittingUpdateUni] = useState(false);

  const addToast = (type: 'success' | 'error', message: string) => {
    const id = Math.random().toString(36).substr(2, 9);
    setToasts((prev) => [...prev, { id, type, message }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  };

  const handleSendBrochureSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBrochureId) {
      alert('Please select a brochure');
      return;
    }
    setSendingBrochure(true);
    try {
      const res = await api.post('/api/v1/brochures/assign', {
        leadId: id,
        brochureId: selectedBrochureId
      });
      addToast('success', 'Brochure assigned and secure link generated!');
      setShowSendBrochureModal(false);
      setSelectedBrochureId('');
      
      // Copy secure link to clipboard
      const publicBase = window.location.origin;
      const secureLink = `${publicBase}/brochure/view/${res.token}`;
      navigator.clipboard.writeText(secureLink);
      addToast('success', 'Secure view link copied to clipboard!');

      // Refresh assignments and timeline
      const [newAssignments, newTimeline, updatedLead] = await Promise.all([
        api.get(`/api/v1/brochures/assignments/lead/${id}`),
        api.get(`/api/v1/leads/${id}/timeline`),
        api.get(`/api/v1/leads/${id}`)
      ]);
      setBrochureAssignments(newAssignments || []);
      setTimeline(newTimeline || []);
      setLead(updatedLead);
    } catch (err: any) {
      addToast('error', err.message || 'Failed to send brochure');
    } finally {
      setSendingBrochure(false);
    }
  };

  // Document Rejection Reason Dialog State
  const [rejectionDocId, setRejectionDocId] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');

  const loadAllData = async () => {
    try {
      const [leadData, timelineData, usersData, branchesData, appsData, commLogsData, brochuresData, assignmentsData] = await Promise.all([
        api.get(`/api/v1/leads/${id}`),
        api.get(`/api/v1/leads/${id}/timeline`),
        api.get('/api/v1/leads/meta/users'),
        api.get('/api/v1/leads/meta/branches'),
        api.get(`/api/v1/applications/lead/${id}`).catch(() => []),
        api.get(`/api/v1/communication/logs/lead/${id}`).catch(() => []),
        api.get('/api/v1/brochures').catch(() => []),
        api.get(`/api/v1/brochures/assignments/lead/${id}`).catch(() => []),
      ]);
      setLead(leadData);
      setTimeline(timelineData || []);
      setUsers(usersData || []);
      setBranches(branchesData || []);
      setApplications(appsData || []);
      setCommLogs(commLogsData || []);
      setBrochuresList(brochuresData || []);
      setBrochureAssignments(assignmentsData || []);
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

  const handleDocumentsTabClick = async () => {
    setActiveTab('documents');
    try {
      const res = await api.get(`/api/v1/documents/lead/${id}`);
      setLead((prev: any) => {
        if (!prev) return prev;
        return { ...prev, documents: res };
      });
    } catch (err) {
      console.error('Failed to load/generate checklist', err);
    }
  };

  const handleCommunicationsTabClick = async () => {
    setActiveTab('communications');
    try {
      const res = await api.get(`/api/v1/communication/logs/lead/${id}`);
      setCommLogs(res || []);
    } catch (err) {
      console.error('Failed to load communication logs', err);
    }
  };

  const handleRetryLog = async (logId: string) => {
    try {
      await api.post(`/api/v1/communication/logs/${logId}/retry`);
      addToast('success', 'Email enqueued for retry!');
      setTimeout(handleCommunicationsTabClick, 1000); // Reload logs after a brief moment
    } catch (err: any) {
      addToast('error', err.message || 'Failed to retry email');
    }
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    const RESTRICTED_STAGES = [
      'DOCUMENTS_RECEIVED',
      'UNIVERSITY_APPLIED',
      'OFFER_LETTER',
      'VISA_PROCESS',
      'ADMISSION_CLOSED'
    ];
    if (!isLockedWorkflow && RESTRICTED_STAGES.includes(lead.status)) {
      const score = lead.readinessScore ?? 0;
      if (score < 100) {
        setErrorMsg(`Cannot change outreach stage to ${lead.status.replace(/_/g, ' ')} until all required documents are 100% verified.`);
        return;
      }
    }

    try {
      const payload = isLockedWorkflow
        ? {
            firstName: lead.firstName,
            lastName: lead.lastName,
            email: lead.email,
            phone: lead.phone,
            address: lead.address,
          }
        : {
            firstName: lead.firstName,
            lastName: lead.lastName,
            email: lead.email,
            phone: lead.phone,
            address: lead.address,
            status: lead.status,
            source: lead.source,
            leadCategory: lead.leadCategory,
            preferredCountry: lead.preferredCountry,
            preferredCourse: lead.preferredCourse,
            planningTimeline: lead.planningTimeline,
            intendedIntake: lead.intendedIntake,
            englishLevel: lead.englishLevel,
            targetScore: lead.targetScore,
            purpose: lead.purpose,
            courseInterest: lead.courseInterest,
            studentProfile: {
              targetCountry: lead.preferredCountry || lead.studentProfile?.targetCountry || undefined,
              targetCourse: lead.preferredCourse || lead.studentProfile?.targetCourse || undefined,
              intake: lead.intendedIntake || lead.studentProfile?.intake || undefined,
              ieltsStatus: lead.studentProfile?.ieltsStatus || 'NOT_TAKEN',
              passportStatus: lead.studentProfile?.passportStatus || 'NO_PASSPORT',
              educationLevel: lead.studentProfile?.educationLevel || undefined,
              percentageGpa: lead.studentProfile?.percentageGpa || undefined,
              budget: lead.studentProfile?.budget || undefined,
              currentQualification: lead.studentProfile?.currentQualification || undefined,
            },
          };

      const updated = await api.patch(`/api/v1/leads/${id}`, payload);
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

    const validation = validateFollowupDateTime(followupDate);
    if (!validation.isValid) {
      setErrorMsg(validation.errorMsg);
      return;
    }

    setErrorMsg(null);
    try {
      await api.post('/api/v1/followups', {
        leadId: id,
        followupDate: parseLocalISOString(followupDate).toISOString(),
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

  const handleAddUniversity = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUniName || !newUniCountry || !newUniCourse || !newUniIntake) {
      addToast('error', 'Please fill in all required fields.');
      return;
    }
    setIsSubmittingUni(true);
    try {
      await api.post('/api/v1/applications', {
        leadId: id,
        universityName: newUniName,
        country: newUniCountry,
        courseName: newUniCourse,
        intake: newUniIntake,
        notes: newUniNotes,
      });
      addToast('success', 'University application shortlisted successfully.');
      setShowAddUniModal(false);
      setNewUniName('');
      setNewUniCountry('');
      setNewUniCourse('');
      setNewUniIntake('');
      setNewUniNotes('');
      await loadAllData();
    } catch (err: any) {
      addToast('error', err.message || 'Failed to shortlist university.');
    } finally {
      setIsSubmittingUni(false);
    }
  };

  const handleUpdateUniversityDetails = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmittingUpdateUni(true);
    try {
      const tuitionFeeNum = updateUniTuitionFee ? parseFloat(updateUniTuitionFee) : null;
      const scholarshipNum = updateUniScholarship ? parseFloat(updateUniScholarship) : null;
      
      await api.patch(`/api/v1/applications/${updateUniId}`, {
        tuitionFee: tuitionFeeNum,
        scholarshipAmount: scholarshipNum,
        notes: updateUniNotes || null
      });
      addToast('success', 'Application details updated successfully.');
      setShowUpdateUniModal(false);
      await loadAllData();
    } catch (err: any) {
      addToast('error', err.message || 'Failed to update application details.');
    } finally {
      setIsSubmittingUpdateUni(false);
    }
  };

  const handleUpdateApplicationStatus = async (appId: string, updates: any) => {
    try {
      await api.patch(`/api/v1/applications/${appId}`, updates);
      addToast('success', 'Application updated successfully.');
      await loadAllData();
    } catch (err: any) {
      addToast('error', err.message || 'Failed to update application.');
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
    let activeStatus = status;
    if (status === 'ENROLLED' && (!category || category === 'STUDY_ABROAD')) {
      activeStatus = 'ADMISSION_CLOSED';
    }
    const stages = getPipelineStages(category || 'STUDY_ABROAD');
    if (activeStatus === 'LOST') return 0;
    const nonLostStages = stages.filter(s => s !== 'LOST');
    const nonLostIndex = nonLostStages.indexOf(activeStatus);
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

  const visaStatusLabel = (() => {
    if (!applications || applications.length === 0) return '—';
    const visaOrder = ['VISA_APPROVED', 'VISA_REJECTED', 'VISA_BIOMETRICS', 'VISA_APPLIED', 'NOT_STARTED'];
    for (const status of visaOrder) {
      if (applications.some(a => a.visaStatus === status)) {
        return status.replace(/_/g, ' ');
      }
    }
    return '—';
  })();

  const finalUniversityLabel = (() => {
    if (!applications || applications.length === 0) return '—';
    const approved = applications.find(a => a.visaStatus === 'VISA_APPROVED');
    if (approved) return approved.universityName;
    const accepted = applications.find(a => a.offerStatus === 'OFFER_ACCEPTED');
    if (accepted) return accepted.universityName;
    return '—';
  })();

  const offersCount = applications ? applications.filter(a => a.offerStatus !== 'NONE').length : 0;

  return (
    <div className="split-container">
      {/* LEFT PANE: Editable Student Details */}
      <section className="split-left">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <h3 style={{ fontSize: '13px', fontWeight: 700, margin: 0 }}>
              {lead.firstName} {lead.lastName} {lead.leadNumber ? `(Ref: ${lead.leadNumber})` : ''}
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

        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '8px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)' }}>Assigned Counsellor:</span>
          <span className="badge" style={{ backgroundColor: '#e0f2fe', color: '#0369a1', fontWeight: 700, fontSize: '11px', borderRadius: '4px', padding: '2px 6px' }}>
            {lead.assignee ? `${lead.assignee.firstName} ${lead.assignee.lastName}` : 'Unassigned'}
          </span>
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
        {/* Dynamic Information Card */}
        <div style={{ margin: '12px 0', padding: '16px', background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)', color: '#fff', borderRadius: '6px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }}>
          <div style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#94a3b8', fontWeight: 700, marginBottom: '8px' }}>
            🎯 Category-Specific Intel
          </div>
          {lead.leadCategory === 'STUDY_ABROAD' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', fontSize: '12px' }}>
              <div><span style={{ color: '#94a3b8' }}>Preferred Country:</span> <strong style={{ color: '#38bdf8' }}>{lead.preferredCountry || '—'}</strong></div>
              <div><span style={{ color: '#94a3b8' }}>Preferred Course:</span> <strong style={{ color: '#38bdf8' }}>{lead.preferredCourse || '—'}</strong></div>
              <div><span style={{ color: '#94a3b8' }}>Intake:</span> <strong style={{ color: '#38bdf8' }}>{lead.intendedIntake || '—'}</strong></div>
              <div><span style={{ color: '#94a3b8' }}>Applications Count:</span> <strong style={{ color: '#38bdf8' }}>{applications.length}</strong></div>
              <div><span style={{ color: '#94a3b8' }}>Offers Count:</span> <strong style={{ color: '#38bdf8' }}>{offersCount}</strong></div>
              <div><span style={{ color: '#94a3b8' }}>Visa Status:</span> <strong style={{ color: '#38bdf8' }}>{visaStatusLabel}</strong></div>
              <div style={{ gridColumn: 'span 2' }}><span style={{ color: '#94a3b8' }}>Final University:</span> <strong style={{ color: '#38bdf8' }}>{finalUniversityLabel}</strong></div>
            </div>
          )}
          {(lead.leadCategory === 'IELTS' || lead.leadCategory === 'PTE') && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', fontSize: '12px' }}>
              <div><span style={{ color: '#94a3b8' }}>Current English Level:</span> <strong style={{ color: '#38bdf8' }}>{lead.englishLevel || '—'}</strong></div>
              <div><span style={{ color: '#94a3b8' }}>Target Score:</span> <strong style={{ color: '#38bdf8' }}>{lead.targetScore || '—'}</strong></div>
            </div>
          )}
          {lead.leadCategory === 'ENGLISH_SPEAKING' && (
            <div style={{ fontSize: '12px' }}>
              <span style={{ color: '#94a3b8' }}>Purpose:</span> <strong style={{ color: '#38bdf8' }}>{lead.purpose || '—'}</strong>
            </div>
          )}
          {lead.leadCategory === 'COMPUTER_COURSE' && (
            <div style={{ fontSize: '12px' }}>
              <span style={{ color: '#94a3b8' }}>Course Interested In:</span> <strong style={{ color: '#38bdf8' }}>{lead.courseInterest || '—'}</strong>
            </div>
          )}
          {lead.leadCategory === 'DIGITAL_MARKETING' && (
            <div style={{ fontSize: '12px' }}>
              <span style={{ color: '#94a3b8' }}>Category:</span> <strong style={{ color: '#38bdf8' }}>Digital Marketing</strong>
            </div>
          )}
          {lead.leadCategory === 'OTHER' && (
            <div style={{ fontSize: '12px' }}>
              <span style={{ color: '#94a3b8' }}>Category:</span> <strong style={{ color: '#38bdf8' }}>Other / General</strong>
            </div>
          )}
        </div>

        {errorMsg && (
          <div style={{ backgroundColor: '#fee2e2', color: '#991b1b', border: '1px solid #fca5a5', padding: '8px 12px', borderRadius: '4px', fontSize: '11px', marginBottom: '8px' }}>
            ⚠️ {errorMsg}
          </div>
        )}
        {successMsg && (
          <div style={{ backgroundColor: '#dcfce7', color: '#166534', border: '1px solid #86efac', padding: '8px 12px', borderRadius: '4px', fontSize: '11px', marginBottom: '8px' }}>
            ✓ {successMsg}
          </div>
        )}

        {isLockedWorkflow && (
          <div style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', color: '#EF4444', border: '1px solid rgba(239, 68, 68, 0.2)', padding: '10px', borderRadius: '6px', fontSize: '11px', marginBottom: '12px', fontWeight: 600 }}>
            ⚠️ Lead workflow is locked (Documents Pending or later). Counsellors can only update name, phone, email, address, notes, and followups.
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

          <div className="form-group">
            <label>Address</label>
            <input
              type="text"
              className="form-control"
              value={lead.address || ''}
              onChange={(e) => setLead({ ...lead, address: e.target.value })}
            />
          </div>

          <div style={{ display: 'flex', gap: '8px' }}>
            <div className="form-group" style={{ flex: 1 }}>
              <label>Outreach Stage</label>
              <select className="form-control" value={lead.status === 'ENROLLED' && lead.leadCategory === 'STUDY_ABROAD' ? 'ADMISSION_CLOSED' : lead.status} onChange={(e) => setLead({ ...lead, status: e.target.value })} disabled={isLockedWorkflow}>
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
                disabled={isLockedWorkflow}
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
              <select className="form-control" value={lead.source} onChange={(e) => setLead({ ...lead, source: e.target.value })} disabled={isLockedWorkflow}>
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
                disabled={user?.role === 'COUNSELLOR'}
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
                disabled={user?.role === 'COUNSELLOR'}
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
                    disabled={isLockedWorkflow}
                  />
                </div>
                <div className="form-group" style={{ flex: 1 }}>
                  <label>Target Course</label>
                  <input
                    type="text"
                    className="form-control"
                    value={lead.preferredCourse || lead.studentProfile?.targetCourse || ''}
                    onChange={(e) =>
                      setLead({
                        ...lead,
                        preferredCourse: e.target.value,
                        studentProfile: { ...lead.studentProfile, targetCourse: e.target.value },
                      })
                    }
                    disabled={isLockedWorkflow}
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
                    disabled={isLockedWorkflow}
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
                    disabled={isLockedWorkflow}
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
                  disabled={isLockedWorkflow}
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
                  disabled={isLockedWorkflow}
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
                disabled={isLockedWorkflow}
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
                disabled={isLockedWorkflow}
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
                        <div><strong>Submission Date:</strong> {new Date(sub.createdAt).toLocaleString()}</div>
                        <div><strong>Category:</strong> {lead.leadCategory ? lead.leadCategory.replace(/_/g, ' ') : '—'}</div>
                        
                        <div style={{ margin: '6px 0', padding: '8px', background: '#fff', border: '1px solid #e2e8f0', borderRadius: '4px' }}>
                          <div style={{ fontWeight: 700, marginBottom: '4px', color: 'var(--primary-color)' }}>Category Specific Data:</div>
                          {lead.leadCategory === 'STUDY_ABROAD' && (
                            <>
                              <div>Preferred Country: {sub.preferredCountry || '—'}</div>
                              <div>Preferred Course: {sub.preferredCourse || '—'}</div>
                              <div>Intended Intake: {sub.intendedIntake || '—'}</div>
                              <div>Planning Timeline: {sub.planningTimeline || '—'}</div>
                            </>
                          )}
                          {(lead.leadCategory === 'IELTS' || lead.leadCategory === 'PTE') && (
                            <>
                              <div>English Level: {sub.englishLevel || '—'}</div>
                              <div>Target Score: {sub.targetScore || '—'}</div>
                            </>
                          )}
                          {lead.leadCategory === 'ENGLISH_SPEAKING' && (
                            <div>Purpose: {sub.purpose || '—'}</div>
                          )}
                          {lead.leadCategory === 'COMPUTER_COURSE' && (
                            <div>Course Interested In: {sub.courseInterest || '—'}</div>
                          )}
                          {lead.leadCategory === 'DIGITAL_MARKETING' && (
                            <div>Digital Marketing</div>
                          )}
                          {lead.leadCategory === 'OTHER' && (
                            <div>Other</div>
                          )}
                        </div>

                        <div><strong>UTM Source:</strong> {sub.utmSource || '—'}</div>
                        <div><strong>Landing Page:</strong> {sub.landingPage ? <a href={sub.landingPage} target="_blank" rel="noreferrer" style={{ color: '#2563eb' }}>{sub.landingPage}</a> : '—'}</div>
                        <div><strong>Referrer:</strong> {sub.referrer || '—'}</div>
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
            onClick={handleDocumentsTabClick}
          >
            📁 Documents checklist
          </button>
          <button
            className={`tab-btn ${activeTab === 'followups' ? 'active' : ''}`}
            onClick={() => setActiveTab('followups')}
          >
            📆 Schedule Followup
          </button>
          {lead && lead.leadCategory === 'STUDY_ABROAD' && (
            <button
              className={`tab-btn ${activeTab === 'applications' ? 'active' : ''}`}
              onClick={() => setActiveTab('applications')}
            >
              🎓 University Applications ({applications.length})
            </button>
          )}
          <button
            className={`tab-btn ${activeTab === 'communications' ? 'active' : ''}`}
            onClick={handleCommunicationsTabClick}
          >
            💬 Communications ({commLogs.length})
          </button>
          <button
            className={`tab-btn ${activeTab === 'brochures' ? 'active' : ''}`}
            onClick={() => setActiveTab('brochures')}
          >
            📚 Brochures ({brochureAssignments.length})
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
                {!isLockedWorkflow && (
                  <button type="button" onClick={handleRequestMissing} className="btn btn-primary btn-sm">
                    📢 Request Missing Documents
                  </button>
                )}
              </div>

              {/* Document upload form */}
              {!isLockedWorkflow && (
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
                        onClick={(e) => e.currentTarget.showPicker?.()}
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
              )}

              {/* Active Documents List */}
              {activeChecklist.length === 0 ? (
                <div style={{ padding: '24px', textAlign: 'center', border: '2px dashed var(--border-color)', borderRadius: '6px', background: '#f8fafc' }}>
                  <p style={{ color: 'var(--text-muted)', fontStyle: 'italic', fontSize: '12px', marginBottom: '12px' }}>
                    No checklist generated yet for this student.
                  </p>
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        const res = await api.get(`/api/v1/documents/lead/${id}`);
                        setLead((prev: any) => ({ ...prev, documents: res }));
                        addToast('success', 'Documents checklist generated successfully.');
                      } catch (err: any) {
                        addToast('error', err.message || 'Failed to generate checklist.');
                      }
                    }}
                    className="btn btn-primary"
                  >
                    ⚙️ Generate Document Checklist
                  </button>
                </div>
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
                                  {!isLockedWorkflow && (
                                    <button onClick={() => handleDelete(doc.id)} className="btn btn-xs btn-danger" title="Delete file">🗑️</button>
                                  )}
                                </>
                              )}
                              {!isLockedWorkflow && doc.status === 'UPLOADED' && (
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
                  onClick={(e) => e.currentTarget.showPicker?.()}
                  required
                  min={minDateTime}
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

          {/* Tab 5: University Applications */}
           {activeTab === 'applications' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ fontSize: '13px', fontWeight: 700, margin: 0 }}>Shortlisted Universities & Applications</h3>
                {!isLockedWorkflow && (
                  <button
                    type="button"
                    className="btn btn-sm btn-primary"
                    onClick={() => setShowAddUniModal(true)}
                  >
                    ➕ Shortlist University
                  </button>
                )}
              </div>

              {applications.length === 0 ? (
                <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '20px' }}>
                  No universities shortlisted yet. Click "Shortlist University" to begin.
                </p>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '12px' }}>
                  {applications.map((app) => {
                    const appStatuses = ['SHORTLISTED', 'APPLICATION_STARTED', 'APPLICATION_SUBMITTED', 'UNDER_REVIEW', 'DECISION_RECEIVED'];
                    const currentAppIdx = appStatuses.indexOf(app.applicationStatus);
                    const nextAppStatus = currentAppIdx < appStatuses.length - 1 ? appStatuses[currentAppIdx + 1] : null;

                    const offerStatuses = ['NONE', 'CONDITIONAL_OFFER', 'UNCONDITIONAL_OFFER', 'OFFER_ACCEPTED', 'OFFER_REJECTED'];
                    const visaStatuses = ['NOT_STARTED', 'VISA_APPLIED', 'VISA_BIOMETRICS', 'VISA_APPROVED', 'VISA_REJECTED'];

                    return (
                      <div key={app.id} style={{ border: '1px solid var(--border-color)', borderRadius: '6px', padding: '16px', backgroundColor: '#fff', display: 'flex', flexDirection: 'column', gap: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '8px' }}>
                          <div>
                            <h4 style={{ margin: 0, fontSize: '14px', fontWeight: 700, color: 'var(--text-color)' }}>{app.universityName}</h4>
                            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>📍 {app.country} | 📚 {app.courseName} | 📅 Intake: {app.intake}</span>
                          </div>
                          <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Added on {new Date(app.createdAt).toLocaleDateString()}</span>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '12px', background: '#f8fafc', padding: '12px', borderRadius: '4px', border: '1px solid #e2e8f0' }}>
                          <div>
                            <div style={{ fontSize: '10px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '4px' }}>Application Status</div>
                            <span className="badge" style={{ backgroundColor: '#e0f2fe', color: '#0369a1' }}>{app.applicationStatus.replace(/_/g, ' ')}</span>
                          </div>
                          <div>
                            <div style={{ fontSize: '10px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '4px' }}>Offer Status</div>
                            <span className="badge" style={{ backgroundColor: '#fef3c7', color: '#d97706' }}>{app.offerStatus.replace(/_/g, ' ')}</span>
                          </div>
                          <div>
                            <div style={{ fontSize: '10px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '4px' }}>Visa Status</div>
                            <span className="badge" style={{ backgroundColor: '#dcfce7', color: '#15803d' }}>{app.visaStatus.replace(/_/g, ' ')}</span>
                          </div>
                          {(app.tuitionFee !== null || app.scholarshipAmount !== null) && (
                            <div style={{ gridColumn: 'span 3', display: 'flex', gap: '16px', borderTop: '1px solid #e2e8f0', paddingTop: '8px', marginTop: '4px' }}>
                              {app.tuitionFee !== null && <span style={{ fontSize: '11px' }}>💵 Tuition Fee: <strong>${app.tuitionFee}</strong></span>}
                              {app.scholarshipAmount !== null && <span style={{ fontSize: '11px' }}>🎁 Scholarship: <strong>${app.scholarshipAmount}</strong></span>}
                            </div>
                          )}
                        </div>

                        {app.notes && (
                          <div style={{ fontSize: '11px', color: '#475569', fontStyle: 'italic', borderLeft: '2px solid var(--border-color)', paddingLeft: '8px' }}>
                            "{app.notes}"
                          </div>
                        )}

                        {!isLockedWorkflow && (
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', borderTop: '1px solid var(--border-color)', paddingTop: '12px' }}>
                            {nextAppStatus && (
                              <button
                                type="button"
                                className="btn btn-xs btn-primary"
                                onClick={() => handleUpdateApplicationStatus(app.id, { applicationStatus: nextAppStatus })}
                              >
                                ➡️ Mark {nextAppStatus.replace(/_/g, ' ')}
                              </button>
                            )}

                            {app.applicationStatus === 'DECISION_RECEIVED' && app.offerStatus === 'NONE' && (
                              <>
                                <button
                                  type="button"
                                  className="btn btn-xs"
                                  style={{ backgroundColor: '#f59e0b', color: '#fff' }}
                                  onClick={() => handleUpdateApplicationStatus(app.id, { offerStatus: 'CONDITIONAL_OFFER' })}
                                >
                                  📜 Cond. Offer
                                </button>
                                <button
                                  type="button"
                                  className="btn btn-xs"
                                  style={{ backgroundColor: '#d97706', color: '#fff' }}
                                  onClick={() => handleUpdateApplicationStatus(app.id, { offerStatus: 'UNCONDITIONAL_OFFER' })}
                                >
                                  📜 Uncond. Offer
                                </button>
                                <button
                                  type="button"
                                  className="btn btn-xs btn-danger"
                                  onClick={() => handleUpdateApplicationStatus(app.id, { offerStatus: 'OFFER_REJECTED' })}
                                >
                                  ❌ Reject Offer
                                </button>
                              </>
                            )}

                            {app.offerStatus === 'CONDITIONAL_OFFER' && (
                              <>
                                <button
                                  type="button"
                                  className="btn btn-xs"
                                  style={{ backgroundColor: '#d97706', color: '#fff' }}
                                  onClick={() => handleUpdateApplicationStatus(app.id, { offerStatus: 'UNCONDITIONAL_OFFER' })}
                                >
                                  📜 Uncond. Offer
                                </button>
                                <button
                                  type="button"
                                  className="btn btn-xs btn-success"
                                  onClick={() => handleUpdateApplicationStatus(app.id, { offerStatus: 'OFFER_ACCEPTED' })}
                                >
                                  ✓ Accept Offer
                                </button>
                                <button
                                  type="button"
                                  className="btn btn-xs btn-danger"
                                  onClick={() => handleUpdateApplicationStatus(app.id, { offerStatus: 'OFFER_REJECTED' })}
                                >
                                  ❌ Reject Offer
                                </button>
                              </>
                            )}

                            {app.offerStatus === 'UNCONDITIONAL_OFFER' && (
                              <>
                                <button
                                  type="button"
                                  className="btn btn-xs btn-success"
                                  onClick={() => handleUpdateApplicationStatus(app.id, { offerStatus: 'OFFER_ACCEPTED' })}
                                >
                                  ✓ Accept Offer
                                </button>
                                <button
                                  type="button"
                                  className="btn btn-xs btn-danger"
                                  onClick={() => handleUpdateApplicationStatus(app.id, { offerStatus: 'OFFER_REJECTED' })}
                                >
                                  ❌ Reject Offer
                                </button>
                              </>
                            )}

                            {app.offerStatus === 'OFFER_ACCEPTED' && app.visaStatus === 'NOT_STARTED' && (
                              <button
                                type="button"
                                className="btn btn-xs btn-primary"
                                onClick={() => handleUpdateApplicationStatus(app.id, { visaStatus: 'VISA_APPLIED' })}
                              >
                                ✈️ Apply Visa
                              </button>
                            )}
                            {app.visaStatus === 'VISA_APPLIED' && (
                              <button
                                type="button"
                                className="btn btn-xs btn-primary"
                                onClick={() => handleUpdateApplicationStatus(app.id, { visaStatus: 'VISA_BIOMETRICS' })}
                              >
                                🧬 Book Biometrics
                              </button>
                            )}
                            {app.visaStatus === 'VISA_BIOMETRICS' && (
                              <>
                                <button
                                  type="button"
                                  className="btn btn-xs btn-success"
                                  onClick={() => handleUpdateApplicationStatus(app.id, { visaStatus: 'VISA_APPROVED' })}
                                >
                                  ✓ Visa Approved
                                </button>
                                <button
                                  type="button"
                                  className="btn btn-xs btn-danger"
                                  onClick={() => handleUpdateApplicationStatus(app.id, { visaStatus: 'VISA_REJECTED' })}
                                >
                                  ❌ Visa Rejected
                                </button>
                              </>
                            )}

                            <button
                              type="button"
                              className="btn btn-xs"
                              style={{ backgroundColor: '#475569', color: '#fff', marginLeft: 'auto' }}
                              onClick={() => {
                                setUpdateUniId(app.id);
                                setUpdateUniName(app.universityName);
                                setUpdateUniTuitionFee(app.tuitionFee !== null ? String(app.tuitionFee) : '');
                                setUpdateUniScholarship(app.scholarshipAmount !== null ? String(app.scholarshipAmount) : '');
                                setUpdateUniNotes(app.notes || '');
                                setShowUpdateUniModal(true);
                              }}
                            >
                              ✏️ Edit Details
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {activeTab === 'communications' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h3 style={{ fontSize: '14px', fontWeight: 700, margin: 0 }}>💬 Communication Logs & Queue</h3>
                  <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '2px 0 0 0' }}>
                    View email and WhatsApp communication history for this lead.
                  </p>
                </div>
                <button
                  onClick={handleCommunicationsTabClick}
                  className="btn btn-xs btn-outline"
                  style={{ display: 'flex', gap: '4px', alignItems: 'center' }}
                >
                  🔄 Refresh History
                </button>
              </div>

              {commLogs.length === 0 ? (
                <div style={{ padding: '30px', textAlign: 'center', backgroundColor: '#f8fafc', border: '1px dashed var(--border-color)', borderRadius: '6px', color: 'var(--text-muted)' }}>
                  No communication logs found for this lead. Actions like registration, scheduled follow-ups, and university status changes will trigger automated messages.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {commLogs.map((log) => (
                    <div
                      key={log.id}
                      style={{
                        padding: '16px',
                        border: '1px solid var(--border-color)',
                        borderRadius: '6px',
                        backgroundColor: '#fff',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '10px'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                          <span style={{
                            display: 'inline-flex',
                            padding: '2px 6px',
                            borderRadius: '4px',
                            fontSize: '10px',
                            fontWeight: 700,
                            backgroundColor: log.channel === 'EMAIL' ? '#e0f2fe' : '#dcfce7',
                            color: log.channel === 'EMAIL' ? '#0369a1' : '#15803d'
                          }}>
                            {log.channel}
                          </span>
                          <span style={{ fontSize: '12px', fontWeight: 600 }}>{log.eventType}</span>
                        </div>
                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', fontSize: '11px', color: 'var(--text-muted)' }}>
                          <span><strong>To:</strong> {log.recipient}</span>
                          <span>•</span>
                          <span>{new Date(log.sentAt).toLocaleString()}</span>
                          <span style={{
                            display: 'inline-flex',
                            padding: '2px 6px',
                            borderRadius: '4px',
                            fontSize: '10px',
                            fontWeight: 700,
                            backgroundColor:
                              log.status === 'SENT' ? '#dcfce7' :
                              log.status === 'FAILED' ? '#fee2e2' :
                              log.status === 'PROCESSING' ? '#fef9c3' : '#f1f5f9',
                            color:
                              log.status === 'SENT' ? '#15803d' :
                              log.status === 'FAILED' ? '#b91c1c' :
                              log.status === 'PROCESSING' ? '#854d0e' : '#475569',
                          }}>
                            {log.status}
                          </span>
                          {log.status === 'FAILED' && (
                            <button
                              onClick={() => handleRetryLog(log.id)}
                              className="btn btn-xs"
                              style={{
                                padding: '2px 6px',
                                fontSize: '10px',
                                fontWeight: 700,
                                marginLeft: '6px',
                                cursor: 'pointer',
                                backgroundColor: '#fee2e2',
                                color: '#b91c1c',
                                borderColor: '#fca5a5'
                              }}
                            >
                              🔄 Retry
                            </button>
                          )}
                        </div>
                      </div>

                      <div style={{
                        padding: '10px 12px',
                        backgroundColor: '#f8fafc',
                        borderRadius: '4px',
                        fontFamily: 'monospace',
                        fontSize: '12px',
                        whiteSpace: 'pre-wrap',
                        borderLeft: '3px solid #cbd5e1',
                        lineHeight: '1.4'
                      }}>
                        {log.message}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'brochures' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
                <div>
                  <h3 style={{ fontSize: '14px', fontWeight: 700, margin: 0 }}>📚 Brochure Analytics & Assignments</h3>
                  <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '2px 0 0 0' }}>
                    Send customized brochures and track student reading activities, completion rates, and temperature rating.
                  </p>
                </div>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button
                    onClick={async () => {
                      try {
                        const data = await api.get(`/api/v1/brochures/assignments/lead/${id}`);
                        setBrochureAssignments(data || []);
                      } catch (err) {
                        console.error(err);
                      }
                    }}
                    className="btn btn-xs btn-outline"
                  >
                    🔄 Refresh Stats
                  </button>
                  <button
                    onClick={() => {
                      if (brochuresList.length === 0) {
                        alert('No active brochures in the library. Go to Brochure Library to upload brochures first.');
                        return;
                      }
                      setShowSendBrochureModal(true);
                    }}
                    className="btn btn-xs btn-primary"
                  >
                    🚀 Send Brochure
                  </button>
                </div>
              </div>

              {/* Lead Engagement Overview */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
                gap: '16px',
                padding: '16px',
                backgroundColor: '#f8fafc',
                borderRadius: '6px',
                border: '1px solid var(--border-color)'
              }}>
                <div>
                  <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Lead Temperature</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
                    <span style={{
                      fontSize: '13px',
                      fontWeight: 700,
                      color: lead?.engagementLabel === 'Hot' ? '#ea580c' : lead?.engagementLabel === 'Warm' ? '#d97706' : '#2563eb',
                      backgroundColor: lead?.engagementLabel === 'Hot' ? '#ffedd5' : lead?.engagementLabel === 'Warm' ? '#fef3c7' : '#dbeafe',
                      padding: '2px 8px',
                      borderRadius: '12px'
                    }}>{lead?.engagementLabel || 'Cold'}</span>
                  </div>
                </div>
                <div>
                  <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Engagement Score</span>
                  <div style={{ fontSize: '14px', fontWeight: 700, marginTop: '4px', color: 'var(--text-color)' }}>
                    🔥 {lead?.engagementScore || 0} pts
                  </div>
                </div>
                <div>
                  <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Brochures Assigned</span>
                  <div style={{ fontSize: '14px', fontWeight: 700, marginTop: '4px', color: 'var(--text-color)' }}>
                    📄 {brochureAssignments.length}
                  </div>
                </div>
              </div>

              {/* Assigned brochures List */}
              {brochureAssignments.length === 0 ? (
                <div style={{ padding: '30px', textAlign: 'center', backgroundColor: '#fff', border: '1px dashed var(--border-color)', borderRadius: '6px', color: 'var(--text-muted)' }}>
                  No brochures have been sent to this student yet. Click "Send Brochure" to generate tracking links.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {brochureAssignments.map((assignment) => {
                    const tracking = assignment.tracking || {};
                    const readTimeMin = Math.floor((tracking.readingTime || 0) / 60);
                    const readTimeSec = (tracking.readingTime || 0) % 60;
                    const trackingLink = `${window.location.origin}/brochure/view/${assignment.token}`;

                    return (
                      <div
                        key={assignment.id}
                        style={{
                          padding: '16px',
                          border: '1px solid var(--border-color)',
                          borderRadius: '6px',
                          backgroundColor: '#fff',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '12px'
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
                          <div>
                            <h4 style={{ fontSize: '13px', fontWeight: 700, margin: 0 }}>{assignment.brochure.title}</h4>
                            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Category: {assignment.brochure.category} • Sent: {new Date(assignment.assignedAt).toLocaleDateString()}</span>
                          </div>
                          
                          <button
                            onClick={() => {
                              navigator.clipboard.writeText(trackingLink);
                              alert('Secure link copied to clipboard!');
                            }}
                            className="btn btn-xs btn-outline"
                          >
                            🔗 Copy Tracking Link
                          </button>
                        </div>

                        {/* Metrics grid */}
                        <div style={{
                          display: 'grid',
                          gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))',
                          gap: '8px',
                          backgroundColor: '#f8fafc',
                          padding: '10px',
                          borderRadius: '4px',
                          border: '1px solid var(--border-color)'
                        }}>
                          <div style={{ textAlign: 'center' }}>
                            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Opened</span>
                            <div style={{ fontSize: '12px', fontWeight: 600, color: tracking.opened ? 'var(--success-color)' : 'var(--danger-color)', marginTop: '2px' }}>
                              {tracking.opened ? '🟢 Yes' : '🔴 No'}
                            </div>
                          </div>
                          <div style={{ textAlign: 'center' }}>
                            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Reading Time</span>
                            <div style={{ fontSize: '12px', fontWeight: 600, marginTop: '2px', color: 'var(--text-color)' }}>
                              {readTimeMin}m {readTimeSec}s
                            </div>
                          </div>
                          <div style={{ textAlign: 'center' }}>
                            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Page Views</span>
                            <div style={{ fontSize: '12px', fontWeight: 600, marginTop: '2px', color: 'var(--text-color)' }}>
                              {tracking.pageViews || 0} views
                            </div>
                          </div>
                          <div style={{ textAlign: 'center' }}>
                            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Completion</span>
                            <div style={{ fontSize: '12px', fontWeight: 600, color: '#10b981', marginTop: '2px' }}>
                              {Math.round(tracking.completionPercentage || 0)}%
                            </div>
                          </div>
                          <div style={{ textAlign: 'center' }}>
                            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Last Page</span>
                            <div style={{ fontSize: '12px', fontWeight: 600, marginTop: '2px', color: 'var(--text-color)' }}>
                              Pg {tracking.lastPageViewed || 0}
                            </div>
                          </div>
                          <div style={{ textAlign: 'center' }}>
                            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Downloads</span>
                            <div style={{ fontSize: '12px', fontWeight: 600, marginTop: '2px', color: 'var(--text-color)' }}>
                              📥 {tracking.downloadCount || 0}
                            </div>
                          </div>
                        </div>

                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </section>

      {/* Send Brochure Modal */}
      {showSendBrochureModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15, 23, 42, 0.4)', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="login-card" style={{ width: '450px' }}>
            <h3 style={{ fontSize: '14px', fontWeight: 700, marginBottom: '16px' }}>Send Brochure Link to Lead</h3>
            <form onSubmit={handleSendBrochureSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div className="form-group" style={{ margin: 0 }}>
                <label>Select Brochure from Library</label>
                <select
                  className="form-control"
                  value={selectedBrochureId}
                  onChange={(e) => setSelectedBrochureId(e.target.value)}
                  required
                >
                  <option value="">-- Choose Brochure --</option>
                  {brochuresList.map((b: any) => (
                    <option key={b.id} value={b.id} disabled={!b.isActive}>
                      {b.title} ({b.category}) {!b.isActive ? '[Disabled]' : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '12px' }}>
                <button type="button" className="btn" onClick={() => { setShowSendBrochureModal(false); setSelectedBrochureId(''); }}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={sendingBrochure}>
                  {sendingBrochure ? 'Assigning...' : 'Assign & Copy Link'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

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

      {/* Add University Modal */}
      {showAddUniModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15, 23, 42, 0.4)', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <form onSubmit={handleAddUniversity} className="login-card" style={{ width: '400px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <h3 style={{ fontSize: '13px', fontWeight: 700, borderBottom: '1px solid var(--border-color)', paddingBottom: '8px', margin: 0 }}>Shortlist University</h3>
            
            <div className="form-group">
              <label>University Name *</label>
              <input
                type="text"
                className="form-control"
                required
                value={newUniName}
                onChange={(e) => setNewUniName(e.target.value)}
                placeholder="e.g. University of Toronto"
              />
            </div>

            <div className="form-group">
              <label>Country *</label>
              <input
                type="text"
                className="form-control"
                required
                value={newUniCountry}
                onChange={(e) => setNewUniCountry(e.target.value)}
                placeholder="e.g. Canada"
              />
            </div>

            <div className="form-group">
              <label>Course *</label>
              <input
                type="text"
                className="form-control"
                required
                value={newUniCourse}
                onChange={(e) => setNewUniCourse(e.target.value)}
                placeholder="e.g. M.S. in Computer Science"
              />
            </div>

            <div className="form-group">
              <label>Intake *</label>
              <input
                type="text"
                className="form-control"
                required
                value={newUniIntake}
                onChange={(e) => setNewUniIntake(e.target.value)}
                placeholder="e.g. Fall 2026"
              />
            </div>

            <div className="form-group">
              <label>Notes / Remarks</label>
              <textarea
                className="form-control"
                rows={3}
                value={newUniNotes}
                onChange={(e) => setNewUniNotes(e.target.value)}
                placeholder="Any special counselor notes..."
              />
            </div>

            <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end', marginTop: '6px' }}>
              <button type="button" className="btn" disabled={isSubmittingUni} onClick={() => setShowAddUniModal(false)}>Cancel</button>
              <button type="submit" className="btn btn-primary" disabled={isSubmittingUni}>
                {isSubmittingUni ? 'Saving...' : 'Save University'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Update University Modal */}
      {showUpdateUniModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15, 23, 42, 0.4)', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <form onSubmit={handleUpdateUniversityDetails} className="login-card" style={{ width: '400px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <h3 style={{ fontSize: '13px', fontWeight: 700, borderBottom: '1px solid var(--border-color)', paddingBottom: '8px', margin: 0 }}>Update Details: {updateUniName}</h3>
            
            <div className="form-group">
              <label>Tuition Fee ($)</label>
              <input
                type="number"
                step="any"
                className="form-control"
                value={updateUniTuitionFee}
                onChange={(e) => setUpdateUniTuitionFee(e.target.value)}
                placeholder="e.g. 15000"
              />
            </div>

            <div className="form-group">
              <label>Scholarship Amount ($)</label>
              <input
                type="number"
                step="any"
                className="form-control"
                value={updateUniScholarship}
                onChange={(e) => setUpdateUniScholarship(e.target.value)}
                placeholder="e.g. 2000"
              />
            </div>

            <div className="form-group">
              <label>Notes / Remarks</label>
              <textarea
                className="form-control"
                rows={3}
                value={updateUniNotes}
                onChange={(e) => setUpdateUniNotes(e.target.value)}
                placeholder="Update counselor notes..."
              />
            </div>

            <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end', marginTop: '6px' }}>
              <button type="button" className="btn" disabled={isSubmittingUpdateUni} onClick={() => setShowUpdateUniModal(false)}>Cancel</button>
              <button type="submit" className="btn btn-primary" disabled={isSubmittingUpdateUni}>
                {isSubmittingUpdateUni ? 'Updating...' : 'Update Details'}
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
