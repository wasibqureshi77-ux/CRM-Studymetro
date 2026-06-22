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
  const [uploadType, setUploadType] = useState('PASSPORT');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [pdfPassword, setPdfPassword] = useState('');
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [toasts, setToasts] = useState<{ id: string; type: 'success' | 'error'; message: string }[]>([]);
  const [openRequestIndex, setOpenRequestIndex] = useState<number | null>(0);

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
        studentProfile: {
          targetCountry: lead.studentProfile?.targetCountry || undefined,
          targetCourse: lead.studentProfile?.targetCourse || undefined,
          intake: lead.studentProfile?.intake || undefined,
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
      // Refresh timeline to reflect activities
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

  // Add Note
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

  // Schedule Followup
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

  // Upload Document
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
    if (pdfPassword) {
      formData.append('pdfPassword', pdfPassword);
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
        setPdfPassword('');
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

  // Download Document
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
      setErrorMsg(err.message || 'Failed to download document.');
    }
  };

  // View Document
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
      addToast('success', 'Document opened in new tab.');
    } catch (err: any) {
      addToast('error', err.message || 'Failed to open document.');
      setErrorMsg(err.message || 'Failed to open document.');
    }
  };

  // Approve Document
  const handleApproveDocument = async (docId: string) => {
    setErrorMsg(null);
    try {
      await api.patch(`/api/v1/documents/${docId}/approve`, {
        approvalStatus: 'APPROVED',
      });
      addToast('success', 'Document marked as APPROVED.');
      setSuccessMsg('Document marked as APPROVED.');
      loadAllData();
    } catch (err: any) {
      addToast('error', err.message || 'Approval action failed.');
      setErrorMsg(err.message || 'Approval action failed.');
    }
  };

  // Reject Document
  const handleRejectDocument = async () => {
    if (!rejectionDocId || !rejectionReason.trim()) return;
    setErrorMsg(null);
    try {
      await api.patch(`/api/v1/documents/${rejectionDocId}/approve`, {
        approvalStatus: 'REJECTED',
        rejectionReason: rejectionReason,
      });
      addToast('success', 'Document marked as REJECTED.');
      setSuccessMsg('Document marked as REJECTED.');
      setRejectionDocId(null);
      setRejectionReason('');
      loadAllData();
    } catch (err: any) {
      addToast('error', err.message || 'Rejection action failed.');
      setErrorMsg(err.message || 'Rejection action failed.');
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

  return (
    <div className="split-container">
      {/* LEFT PANE: Editable Student Details */}
      <section className="split-left">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>
          <h3 style={{ fontSize: '13px', fontWeight: 700 }}>Student Information Profile</h3>
          <button onClick={() => router.push('/dashboard/leads')} className="btn btn-sm">
            ← Back to List
          </button>
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
                <option value="NEW">New</option>
                <option value="CONTACTED">Contacted</option>
                <option value="COUNSELLING">Counselling</option>
                <option value="COUNTRY_SELECTION">Country Selection</option>
                <option value="UNIVERSITY_SHORTLISTING">University Shortlisting</option>
                <option value="APPLICATION_SUBMITTED">Application Submitted</option>
                <option value="OFFER_LETTER_RECEIVED">Offer Received</option>
                <option value="VISA_PROCESSING">Visa Processing</option>
                <option value="ENROLLED">Enrolled</option>
                <option value="LOST">Lost</option>
                <option value="JUNK">Junk</option>
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
            Study Abroad Academic Profile
          </div>

          <div style={{ display: 'flex', gap: '8px' }}>
            <div className="form-group" style={{ flex: 1 }}>
              <label>Target Country</label>
              <input
                type="text"
                className="form-control"
                value={lead.studentProfile?.targetCountry || ''}
                onChange={(e) =>
                  setLead({
                    ...lead,
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
                value={lead.studentProfile?.targetCourse || ''}
                onChange={(e) =>
                  setLead({
                    ...lead,
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
                value={lead.studentProfile?.intake || ''}
                onChange={(e) =>
                  setLead({
                    ...lead,
                    studentProfile: { ...lead.studentProfile, intake: e.target.value },
                  })
                }
              />
            </div>
            <div className="form-group" style={{ flex: 1 }}>
              <label>Current Qualification</label>
              <input
                type="text"
                className="form-control"
                value={lead.studentProfile?.currentQualification || ''}
                onChange={(e) =>
                  setLead({
                    ...lead,
                    studentProfile: { ...lead.studentProfile, currentQualification: e.target.value },
                  })
                }
              />
            </div>
          </div>

          <div style={{ display: 'flex', gap: '8px' }}>
            <div className="form-group" style={{ flex: 1 }}>
              <label>IELTS Exam</label>
              <select
                className="form-control"
                value={lead.studentProfile?.ieltsStatus || 'NOT_TAKEN'}
                onChange={(e) =>
                  setLead({
                    ...lead,
                    studentProfile: { ...lead.studentProfile, ieltsStatus: e.target.value },
                  })
                }
              >
                <option value="NOT_TAKEN">Not Taken</option>
                <option value="TAKEN_PASSED">Passed Exam</option>
                <option value="BOOKED">Booked Exam</option>
                <option value="WAIVED">Waived</option>
              </select>
            </div>
            <div className="form-group" style={{ flex: 1 }}>
              <label>Passport</label>
              <select
                className="form-control"
                value={lead.studentProfile?.passportStatus || 'NO_PASSPORT'}
                onChange={(e) =>
                  setLead({
                    ...lead,
                    studentProfile: { ...lead.studentProfile, passportStatus: e.target.value },
                  })
                }
              >
                <option value="NO_PASSPORT">No Passport</option>
                <option value="VALID">Valid Passport</option>
                <option value="EXPIRED">Expired</option>
                <option value="APPLIED">Applied</option>
              </select>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '8px' }}>
            <div className="form-group" style={{ flex: 1 }}>
              <label>Education Level</label>
              <input
                type="text"
                className="form-control"
                placeholder="e.g. Undergraduate"
                value={lead.studentProfile?.educationLevel || ''}
                onChange={(e) =>
                  setLead({
                    ...lead,
                    studentProfile: { ...lead.studentProfile, educationLevel: e.target.value },
                  })
                }
              />
            </div>
            <div className="form-group" style={{ flex: 1 }}>
              <label>Percentage / GPA</label>
              <input
                type="text"
                className="form-control"
                placeholder="e.g. 78% or 3.2"
                value={lead.studentProfile?.percentageGpa || ''}
                onChange={(e) =>
                  setLead({
                    ...lead,
                    studentProfile: { ...lead.studentProfile, percentageGpa: e.target.value },
                  })
                }
              />
            </div>
          </div>

          <div className="form-group">
            <label>Budget Limit</label>
            <input
              type="text"
              className="form-control"
              value={lead.studentProfile?.budget || ''}
              onChange={(e) =>
                setLead({
                  ...lead,
                  studentProfile: { ...lead.studentProfile, budget: e.target.value },
                })
              }
            />
          </div>

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
            📁 Documents Upload
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
                        <div className="timeline-meta">📁 DOCUMENT upload: {node.data.documentType} ({node.data.originalFileName}) at {dateLabel}</div>
                        <div className="timeline-desc">
                          Status: <span className="badge" style={{ backgroundColor: '#f0f9ff', color: '#0369a1' }}>{node.data.approvalStatus}</span>
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

                  // Fallback to generic activity log
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
              {/* Document upload form */}
              <form onSubmit={handleDocumentUpload} style={{ display: 'flex', flexDirection: 'column', gap: '10px', paddingBottom: '16px', borderBottom: '1px solid var(--border-color)', marginBottom: '16px' }}>
                  <div style={{ fontWeight: 700, fontSize: '11px', color: 'var(--text-muted)' }}>
                    Local File Ingestion
                  </div>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-end' }}>
                    <div className="form-group" style={{ flex: 1 }}>
                      <label>Document Class Type</label>
                      <select className="form-control" value={uploadType} onChange={(e) => setUploadType(e.target.value)}>
                        <option value="PASSPORT">Passport Bio Page</option>
                        <option value="IELTS">IELTS Scorecard</option>
                        <option value="MARKSHEET_10TH">10th Grade Sheet</option>
                        <option value="MARKSHEET_12TH">12th Grade Sheet</option>
                        <option value="DEGREE">Degree Certificate</option>
                        <option value="SOP">Statement of Purpose</option>
                        <option value="LOR">Letter of Recommendation</option>
                        <option value="OFFER_LETTER">University Offer</option>
                        <option value="VISA_DOCUMENT">Visa Paper</option>
                        <option value="OTHER">Other</option>
                      </select>
                    </div>

                    <div className="form-group" style={{ flex: 2 }}>
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

                  {selectedFile && (selectedFile.type === 'application/pdf' || selectedFile.name.toLowerCase().endsWith('.pdf')) && (
                    <div className="form-group" style={{ marginBottom: '10px' }}>
                      <label>PDF Password (Optional)</label>
                      <input
                        type="password"
                        className="form-control"
                        placeholder="Enter PDF password if file is protected..."
                        value={pdfPassword}
                        onChange={(e) => setPdfPassword(e.target.value)}
                      />
                    </div>
                  )}

                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <button type="submit" className="btn btn-primary" style={{ width: '160px' }}>
                      📤 Upload Document
                    </button>
                    {uploadProgress !== null && (
                      <div style={{ flex: 1, backgroundColor: '#e2e8f0', borderRadius: '9999px', height: '8px', overflow: 'hidden' }}>
                        <div style={{ backgroundColor: 'var(--primary-color)', height: '100%', width: `${uploadProgress}%`, transition: 'width 0.1s ease-out' }}></div>
                      </div>
                    )}
                  </div>
                </form>

              {/* Active Documents List */}
              <div style={{ fontWeight: 700, fontSize: '11px', color: 'var(--text-muted)', marginBottom: '8px' }}>
                Active Documents List
              </div>
              {lead.documents?.length === 0 ? (
                <p style={{ color: 'var(--text-muted)', fontStyle: 'italic', fontSize: '12px' }}>
                  No documents uploaded for this candidate.
                </p>
              ) : (
                <table className="dense-table" style={{ width: '100%' }}>
                  <thead>
                    <tr>
                      <th>Document Type</th>
                      <th>File Name</th>
                      <th>Upload Date</th>
                      <th>File Size</th>
                      <th>Approval Status</th>
                      <th>View</th>
                      <th>Download</th>
                      <th>Approve</th>
                      <th>Reject</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lead.documents?.map((doc: any) => (
                      <tr key={doc.id}>
                        <td><strong>{doc.documentType}</strong></td>
                        <td><span style={{ fontFamily: 'monospace', fontSize: '11px' }}>{doc.originalFileName}</span></td>
                        <td>{new Date(doc.uploadedAt).toLocaleDateString()}</td>
                        <td>{(doc.fileSize / 1024).toFixed(1)} KB</td>
                        <td>
                          <span
                            className="badge"
                            style={{
                              backgroundColor:
                                doc.approvalStatus === 'APPROVED' ? '#dcfce7' : doc.approvalStatus === 'REJECTED' ? '#fee2e2' : '#fef9c3',
                              color:
                                doc.approvalStatus === 'APPROVED' ? '#166534' : doc.approvalStatus === 'REJECTED' ? '#991b1b' : '#854d0e',
                            }}
                          >
                            {doc.approvalStatus}
                          </span>
                          {doc.rejectionReason && (
                            <div style={{ fontSize: '9px', color: 'var(--danger-color)', marginTop: '2px', fontStyle: 'italic' }}>
                              Reason: {doc.rejectionReason}
                            </div>
                          )}
                        </td>
                        <td>
                          <button onClick={() => handleView(doc.id)} className="btn btn-sm">
                            👁️ View
                          </button>
                        </td>
                        <td>
                          <button onClick={() => handleDownload(doc.id, doc.originalFileName)} className="btn btn-sm">
                            📥 Download
                          </button>
                        </td>
                        <td>
                          {doc.approvalStatus === 'PENDING' ? (
                            <button
                              onClick={() => handleApproveDocument(doc.id)}
                              className="btn btn-sm"
                              style={{ backgroundColor: 'var(--success-color)', color: '#fff', borderColor: 'var(--success-color)' }}
                            >
                              Approve
                            </button>
                          ) : (
                            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>—</span>
                          )}
                        </td>
                        <td>
                          {doc.approvalStatus === 'PENDING' ? (
                            <button
                              onClick={() => setRejectionDocId(doc.id)}
                              className="btn btn-sm btn-danger"
                            >
                              Reject
                            </button>
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

      {/* Rejection Reason Modal */}
      {rejectionDocId && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.4)',
            zIndex: 200,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
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
              <button className="btn" onClick={() => setRejectionDocId(null)}>
                Cancel
              </button>
              <button className="btn btn-danger" onClick={handleRejectDocument}>
                Reject Document
              </button>
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
