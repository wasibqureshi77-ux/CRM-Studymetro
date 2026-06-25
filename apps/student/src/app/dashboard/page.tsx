'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

interface StudentProfile {
  id: string;
  portalId: string;
  firstName: string;
  lastName: string;
  fullName: string;
  email: string;
  phone: string;
  address: string;
  country: string;
  course: string;
  currentStage: string;
  emergencyContact?: string;
  photo?: string;
}

interface Followup {
  id: string;
  date: string;
  notes: string;
  status: string;
}

interface DocumentItem {
  id: string;
  documentType: string;
  status: 'PENDING' | 'UPLOADED' | 'VERIFIED' | 'REJECTED';
  isRequired: boolean;
  verificationNote?: string;
  originalFileName?: string;
  filePath?: string;
  version: number;
  uploadedAt?: string;
}

interface Notification {
  id: string;
  title: string;
  message: string;
  createdAt: string;
  type: 'success' | 'error' | 'warning' | 'info';
}

interface TimelineEvent {
  id: string;
  type: string;
  description: string;
  createdAt: string;
}

interface BrochureTracking {
  opened: boolean;
  readingTime: number;
  pageViews: number;
  completionPercentage: number;
  lastPageViewed: number;
  downloadCount: number;
}

interface BrochureAssignment {
  id: string;
  assignedAt: string;
  token: string;
  brochure: {
    id: string;
    title: string;
    description?: string;
    fileUrl: string;
  };
  tracking?: BrochureTracking;
}

interface CommunicationLog {
  id: string;
  channel: string;
  eventType: string;
  status: string;
  recipient: string;
  message: string;
  sentAt: string;
}

const STAGES = [
  { key: 'NEW_LEAD', label: 'Lead Created' },
  { key: 'COUNSELLING', label: 'Counselling' },
  { key: 'DOCUMENTS_PENDING', label: 'Documents Pending' },
  { key: 'UNIVERSITY_APPLIED', label: 'Application Submitted' },
  { key: 'OFFER_LETTER', label: 'Offer Received' },
  { key: 'VISA_PROCESS', label: 'Visa Applied' },
  { key: 'COMPLETED', label: 'Enrolled' }
];

export default function StudentDashboard() {
  const router = useRouter();
  
  const [profile, setProfile] = useState<StudentProfile | null>(null);
  const [followup, setFollowup] = useState<Followup | null>(null);
  const [dashboardPendingDocs, setDashboardPendingDocs] = useState<any[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [timeline, setTimeline] = useState<TimelineEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Tabs navigation
  const [activeTab, setActiveTab] = useState<'dashboard' | 'documents' | 'brochures' | 'messages' | 'profile'>('dashboard');

  // Dedicated states for tabs
  const [allDocuments, setAllDocuments] = useState<DocumentItem[]>([]);
  const [docsLoading, setDocsLoading] = useState(false);
  const [uploadingDocType, setUploadingDocType] = useState<string | null>(null);
  const [selectedFiles, setSelectedFiles] = useState<{ [key: string]: File }>({});
  const [uploadProgress, setUploadProgress] = useState<{ [key: string]: string }>({});
  const [uploadError, setUploadError] = useState<{ [key: string]: string }>({});

  const [brochures, setBrochures] = useState<BrochureAssignment[]>([]);
  const [brochuresLoading, setBrochuresLoading] = useState(false);

  const [messages, setMessages] = useState<CommunicationLog[]>([]);
  const [messagesLoading, setMessagesLoading] = useState(false);

  // Profile Edit fields
  const [editPhone, setEditPhone] = useState('');
  const [editAddress, setEditAddress] = useState('');
  const [editEmergency, setEditEmergency] = useState('');
  const [editPhoto, setEditPhoto] = useState('');
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileMsg, setProfileMsg] = useState({ text: '', type: '' });

  const getHeaders = () => {
    const token = localStorage.getItem('student_token');
    return {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    };
  };

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      setError('');
      const token = localStorage.getItem('student_token');
      if (!token) {
        router.push('/login');
        return;
      }

      const res = await fetch('/api/v1/student-portal/dashboard', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (res.status === 401 || res.status === 403) {
        localStorage.removeItem('student_token');
        router.push('/login');
        return;
      }

      if (!res.ok) throw new Error('Failed to retrieve dashboard details');

      const data = await res.json();
      setProfile(data.student);
      setFollowup(data.upcomingFollowup);
      setDashboardPendingDocs(data.pendingDocuments || []);
      setNotifications(data.notifications || []);
      setTimeline(data.timeline || []);

      // Pre-fill profile edit fields
      if (data.student) {
        setEditPhone(data.student.phone || '');
        setEditAddress(data.student.address || '');
        setEditEmergency(data.student.emergencyContact || '');
        setEditPhoto(data.student.photo || '');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchAllDocuments = async () => {
    try {
      setDocsLoading(true);
      const res = await fetch('/api/v1/student-portal/documents', {
        headers: getHeaders()
      });
      if (res.ok) {
        const data = await res.json();
        setAllDocuments(data);
      }
    } catch (err) {
      console.error('Error fetching documents checklist', err);
    } finally {
      setDocsLoading(false);
    }
  };

  const fetchBrochures = async () => {
    try {
      setBrochuresLoading(true);
      const res = await fetch('/api/v1/student-portal/brochures', {
        headers: getHeaders()
      });
      if (res.ok) {
        const data = await res.json();
        setBrochures(data);
      }
    } catch (err) {
      console.error('Error fetching brochures', err);
    } finally {
      setBrochuresLoading(false);
    }
  };

  const fetchMessages = async () => {
    try {
      setMessagesLoading(true);
      const res = await fetch('/api/v1/student-portal/communications', {
        headers: getHeaders()
      });
      if (res.ok) {
        const data = await res.json();
        setMessages(data);
      }
    } catch (err) {
      console.error('Error fetching communications log', err);
    } finally {
      setMessagesLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  useEffect(() => {
    if (activeTab === 'documents') {
      fetchAllDocuments();
    } else if (activeTab === 'brochures') {
      fetchBrochures();
    } else if (activeTab === 'messages') {
      fetchMessages();
    }
  }, [activeTab]);

  const handleLogout = async () => {
    try {
      await fetch('/api/v1/student-portal/auth/logout', { method: 'POST' });
      localStorage.removeItem('student_token');
      localStorage.removeItem('student_user');
      router.push('/login');
    } catch (err) {
      console.error('Logout error', err);
    }
  };

  const handleFileChange = (docType: string, file: File) => {
    setSelectedFiles(prev => ({ ...prev, [docType]: file }));
    setUploadError(prev => ({ ...prev, [docType]: '' }));
  };

  const handleFileUpload = async (docType: string) => {
    const file = selectedFiles[docType];
    if (!file) {
      setUploadError(prev => ({ ...prev, [docType]: 'Please choose a file first' }));
      return;
    }

    setUploadingDocType(docType);
    setUploadProgress(prev => ({ ...prev, [docType]: 'Uploading...' }));

    const formData = new FormData();
    formData.append('documentType', docType);
    formData.append('file', file);

    try {
      const token = localStorage.getItem('student_token');
      const res = await fetch('/api/v1/student-portal/documents/upload', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });

      const result = await res.json();
      if (!res.ok) {
        throw new Error(result.message || 'Failed to upload document');
      }

      setUploadProgress(prev => ({ ...prev, [docType]: 'Uploaded successfully!' }));
      setSelectedFiles(prev => {
        const copy = { ...prev };
        delete copy[docType];
        return copy;
      });
      // Refresh documents list
      fetchAllDocuments();
      fetchDashboardData();
    } catch (err: any) {
      setUploadError(prev => ({ ...prev, [docType]: err.message }));
      setUploadProgress(prev => ({ ...prev, [docType]: '' }));
    } finally {
      setUploadingDocType(null);
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileSaving(true);
    setProfileMsg({ text: '', type: '' });

    try {
      const res = await fetch('/api/v1/student-portal/profile', {
        method: 'PATCH',
        headers: getHeaders(),
        body: JSON.stringify({
          phone: editPhone,
          address: editAddress,
          emergencyContact: editEmergency,
          photo: editPhoto
        })
      });

      const result = await res.json();
      if (!res.ok) {
        throw new Error(result.message || 'Failed to save profile changes');
      }

      setProfileMsg({ text: 'Profile updated successfully!', type: 'success' });
      setProfile(prev => prev ? {
        ...prev,
        phone: editPhone,
        address: editAddress,
        emergencyContact: editEmergency,
        photo: editPhoto
      } : null);
    } catch (err: any) {
      setProfileMsg({ text: err.message, type: 'error' });
    } finally {
      setProfileSaving(false);
    }
  };

  const getDocStatusBadgeColor = (status: string) => {
    switch (status) {
      case 'VERIFIED':
        return { bg: 'rgba(16, 185, 129, 0.1)', text: 'var(--success)', label: 'Approved' };
      case 'REJECTED':
        return { bg: 'rgba(239, 68, 68, 0.1)', text: 'var(--danger)', label: 'Rejected' };
      case 'UPLOADED':
        return { bg: 'rgba(59, 130, 246, 0.1)', text: 'var(--primary)', label: 'Waiting Verification' };
      default:
        return { bg: 'rgba(245, 158, 11, 0.1)', text: 'var(--warning)', label: 'Pending Upload' };
    }
  };

  const formatReadingTime = (sec: number) => {
    if (!sec) return '0 secs';
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    if (m === 0) return `${s} secs`;
    return `${m}m ${s}s`;
  };

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        backgroundColor: '#0a0e1a',
        color: 'var(--text-muted)'
      }}>
        Loading your applications profile...
      </div>
    );
  }

  if (error) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        backgroundColor: '#0a0e1a',
        gap: '16px',
        padding: '24px',
      }}>
        <div style={{ color: 'var(--danger)', fontSize: '18px', fontWeight: 600 }}>⚠️ {error}</div>
        <button
          onClick={fetchDashboardData}
          style={{
            padding: '10px 20px',
            borderRadius: '6px',
            border: 'none',
            backgroundColor: 'var(--primary)',
            color: '#fff',
            cursor: 'pointer',
          }}
        >
          Retry
        </button>
      </div>
    );
  }

  const currentStageIndex = STAGES.findIndex((s) => s.key === profile?.currentStage) === -1
    ? STAGES.findIndex((s) => s.key === 'NEW_LEAD')
    : STAGES.findIndex((s) => s.key === profile?.currentStage);

  return (
    <div style={{ minHeight: '100vh', backgroundColor: 'var(--bg-primary)', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <header style={{
        backgroundColor: 'var(--bg-glass)',
        backdropFilter: 'blur(12px)',
        borderBottom: '1px solid var(--border-glass)',
        padding: '16px 32px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        position: 'sticky',
        top: 0,
        zIndex: 100,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ fontSize: '24px' }}>🎓</span>
          <div>
            <h1 style={{ fontSize: '16px', fontWeight: 700, color: '#fff' }}>Student Portal</h1>
            <p style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Study Metro Admissions</p>
          </div>
        </div>

        {/* Tab Navigation Menu */}
        <nav style={{ display: 'flex', gap: '8px' }}>
          {[
            { key: 'dashboard', label: 'Dashboard', icon: '📊' },
            { key: 'documents', label: 'Documents', icon: '📁' },
            { key: 'brochures', label: 'Brochures', icon: '📖' },
            { key: 'messages', label: 'Messages', icon: '✉️' },
            { key: 'profile', label: 'Profile', icon: '👤' }
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as any)}
              style={{
                background: activeTab === tab.key ? 'rgba(59, 130, 246, 0.15)' : 'transparent',
                border: '1px solid ' + (activeTab === tab.key ? 'var(--primary)' : 'transparent'),
                color: activeTab === tab.key ? '#fff' : 'var(--text-muted)',
                padding: '8px 16px',
                borderRadius: '8px',
                cursor: 'pointer',
                fontSize: '13px',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                transition: 'all 0.2s',
              }}
            >
              <span>{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </nav>

        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '13px', fontWeight: 600, color: '#fff' }}>{profile?.fullName}</div>
            <div style={{ fontSize: '11px', color: 'var(--primary)', fontWeight: 600 }}>ID: {profile?.portalId}</div>
          </div>
          <button
            onClick={handleLogout}
            style={{
              padding: '6px 12px',
              borderRadius: '6px',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              backgroundColor: 'rgba(239, 68, 68, 0.05)',
              color: '#f87171',
              fontSize: '12px',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'background-color 0.2s',
            }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.15)'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.05)'}
          >
            Logout
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main style={{ flex: 1, padding: '32px', display: 'flex', flexDirection: 'column', gap: '28px', maxWidth: '1200px', margin: '0 auto', width: '100%' }}>
        
        {activeTab === 'dashboard' && (
          <>
            {/* Progress Tracker Card */}
            <section style={{
              backgroundColor: 'var(--bg-glass)',
              border: '1px solid var(--border-glass)',
              borderRadius: '12px',
              padding: '24px',
            }}>
              <h2 style={{ fontSize: '15px', fontWeight: 600, color: '#fff', marginBottom: '24px' }}>Your Admission Progress Tracker</h2>
              
              <div style={{ display: 'flex', justifyContent: 'space-between', position: 'relative', width: '100%' }}>
                {/* Connecting bar */}
                <div style={{
                  position: 'absolute',
                  top: '15px',
                  left: '5%',
                  right: '5%',
                  height: '4px',
                  backgroundColor: 'rgba(255,255,255,0.06)',
                  zIndex: 0,
                }}></div>
                <div style={{
                  position: 'absolute',
                  top: '15px',
                  left: '5%',
                  width: `${(currentStageIndex / (STAGES.length - 1)) * 90}%`,
                  height: '4px',
                  backgroundColor: 'var(--success)',
                  zIndex: 0,
                  transition: 'width 0.4s ease-in-out',
                }}></div>

                {STAGES.map((stage, idx) => {
                  const isActive = idx <= currentStageIndex;
                  const isCurrent = idx === currentStageIndex;

                  return (
                    <div key={stage.key} style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      zIndex: 1,
                      width: '12%',
                      textAlign: 'center',
                    }}>
                      <div style={{
                        width: '32px',
                        height: '32px',
                        borderRadius: '50%',
                        backgroundColor: isCurrent ? 'var(--success)' : (isActive ? 'rgba(16, 185, 129, 0.2)' : 'rgba(255, 255, 255, 0.05)'),
                        border: '2px solid ' + (isActive ? 'var(--success)' : 'rgba(255, 255, 255, 0.15)'),
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: 700,
                        fontSize: '12px',
                        color: isActive ? '#fff' : 'var(--text-muted)',
                        boxShadow: isCurrent ? '0 0 16px var(--success)' : 'none',
                        transition: 'all 0.3s',
                      }}>
                        {idx + 1}
                      </div>
                      <div style={{
                        fontSize: '11px',
                        fontWeight: isCurrent ? 700 : 500,
                        color: isCurrent ? '#fff' : (isActive ? 'var(--text-main)' : 'var(--text-dim)'),
                        marginTop: '8px',
                        lineHeight: '1.3',
                      }}>
                        {stage.label}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>

            {/* Dashboard Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: '7fr 5fr', gap: '28px' }}>
              
              {/* Left Column */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
                
                {/* Academic profile metadata */}
                <div style={{
                  backgroundColor: 'var(--bg-glass)',
                  border: '1px solid var(--border-glass)',
                  borderRadius: '12px',
                  padding: '24px',
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: '16px',
                }}>
                  <div>
                    <span style={{ fontSize: '11px', color: 'var(--text-dim)', fontWeight: 600, textTransform: 'uppercase' }}>Target Destination</span>
                    <div style={{ fontSize: '16px', fontWeight: 700, color: '#fff', marginTop: '4px' }}>🇬🇧 {profile?.country}</div>
                  </div>
                  <div>
                    <span style={{ fontSize: '11px', color: 'var(--text-dim)', fontWeight: 600, textTransform: 'uppercase' }}>Selected Course</span>
                    <div style={{ fontSize: '16px', fontWeight: 700, color: '#fff', marginTop: '4px' }}>📘 {profile?.course}</div>
                  </div>
                </div>

                {/* Document Checklist Summary */}
                <div style={{
                  backgroundColor: 'var(--bg-glass)',
                  border: '1px solid var(--border-glass)',
                  borderRadius: '12px',
                  padding: '24px',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                    <h3 style={{ fontSize: '15px', fontWeight: 600, color: '#fff' }}>Pending Checklist Documents</h3>
                    <button
                      onClick={() => setActiveTab('documents')}
                      style={{ fontSize: '12px', color: 'var(--primary)', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}
                    >
                      View All Documents →
                    </button>
                  </div>
                  {dashboardPendingDocs.length === 0 ? (
                    <div style={{ fontSize: '13px', color: 'var(--success)', padding: '12px 0' }}>
                      ✓ All documents successfully verified! You are good to go.
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      {dashboardPendingDocs.map((doc) => (
                        <div key={doc.id} style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          padding: '12px 16px',
                          borderRadius: '8px',
                          backgroundColor: 'rgba(255, 255, 255, 0.02)',
                          borderLeft: '4px solid ' + (doc.status === 'REJECTED' ? 'var(--danger)' : 'var(--warning)'),
                        }}>
                          <div>
                            <div style={{ fontSize: '13px', fontWeight: 600, color: '#fff' }}>
                              {doc.documentType.replace(/_/g, ' ')}
                            </div>
                            {doc.verificationNote && (
                              <div style={{ fontSize: '11px', color: '#fca5a5', marginTop: '4px' }}>
                                Feedback: {doc.verificationNote}
                              </div>
                            )}
                          </div>
                          <span style={{
                            padding: '4px 8px',
                            borderRadius: '4px',
                            fontSize: '10px',
                            fontWeight: 600,
                            backgroundColor: doc.status === 'REJECTED' ? 'rgba(239,68,68,0.1)' : 'rgba(245,158,11,0.1)',
                            color: doc.status === 'REJECTED' ? 'var(--danger)' : 'var(--warning)',
                          }}>
                            {doc.status}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Timeline */}
                <div style={{
                  backgroundColor: 'var(--bg-glass)',
                  border: '1px solid var(--border-glass)',
                  borderRadius: '12px',
                  padding: '24px',
                }}>
                  <h3 style={{ fontSize: '15px', fontWeight: 600, color: '#fff', marginBottom: '16px' }}>Application Action Timeline</h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', position: 'relative' }}>
                    <div style={{
                      position: 'absolute',
                      top: '8px',
                      bottom: '8px',
                      left: '11px',
                      width: '2px',
                      backgroundColor: 'rgba(255,255,255,0.06)',
                    }}></div>

                    {timeline.map((event) => (
                      <div key={event.id} style={{ display: 'flex', gap: '16px', position: 'relative' }}>
                        <div style={{
                          width: '24px',
                          height: '24px',
                          borderRadius: '50%',
                          backgroundColor: 'var(--bg-primary)',
                          border: '2px solid rgba(255,255,255,0.2)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '10px',
                          zIndex: 1,
                        }}>
                          ⚡
                        </div>
                        <div>
                          <div style={{ fontSize: '13px', fontWeight: 600, color: '#fff' }}>{event.description}</div>
                          <div style={{ fontSize: '10px', color: 'var(--text-dim)', marginTop: '2px' }}>
                            {new Date(event.createdAt).toLocaleString()}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

              </div>

              {/* Right Column */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
                
                {/* Upcoming Appointments */}
                <div style={{
                  backgroundColor: 'var(--bg-glass)',
                  border: '1px solid var(--border-glass)',
                  borderRadius: '12px',
                  padding: '24px',
                  background: 'linear-gradient(135deg, rgba(59,130,246,0.08) 0%, rgba(37,99,235,0.02) 100%)',
                }}>
                  <h3 style={{ fontSize: '14px', fontWeight: 700, color: '#fff', marginBottom: '12px' }}>📅 Upcoming Meetings</h3>
                  {followup ? (
                    <div>
                      <div style={{ fontSize: '13px', color: '#fff', fontWeight: 600 }}>
                        {new Date(followup.date).toLocaleDateString()} at {new Date(followup.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                      <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '6px', lineHeight: '1.4' }}>
                        {followup.notes || 'Routine consultation call'}
                      </p>
                    </div>
                  ) : (
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                      No upcoming appointments scheduled yet.
                    </div>
                  )}
                </div>

                {/* Notifications Hub */}
                <div style={{
                  backgroundColor: 'var(--bg-glass)',
                  border: '1px solid var(--border-glass)',
                  borderRadius: '12px',
                  padding: '24px',
                }}>
                  <h3 style={{ fontSize: '15px', fontWeight: 600, color: '#fff', marginBottom: '16px' }}>🔔 Alerts & Notifications</h3>
                  {notifications.length === 0 ? (
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>No unread alerts or updates.</div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      {notifications.map((notif) => (
                        <div key={notif.id} style={{
                          padding: '12px',
                          borderRadius: '8px',
                          backgroundColor: 'rgba(255, 255, 255, 0.01)',
                          border: '1px solid rgba(255,255,255,0.03)',
                        }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div style={{ fontSize: '12px', fontWeight: 700, color: '#fff' }}>{notif.title}</div>
                            <span style={{
                              fontSize: '8px',
                              padding: '2px 6px',
                              borderRadius: '30px',
                              textTransform: 'uppercase',
                              fontWeight: 700,
                              backgroundColor: notif.type === 'error' ? 'rgba(239,68,68,0.1)' : 'rgba(59,130,246,0.1)',
                              color: notif.type === 'error' ? 'var(--danger)' : 'var(--primary)',
                            }}>
                              {notif.type}
                            </span>
                          </div>
                          <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px', lineHeight: '1.4' }}>
                            {notif.message}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

              </div>

            </div>
          </>
        )}

        {/* Tab 2: My Documents */}
        {activeTab === 'documents' && (
          <section style={{
            backgroundColor: 'var(--bg-glass)',
            border: '1px solid var(--border-glass)',
            borderRadius: '12px',
            padding: '24px',
          }}>
            <h2 style={{ fontSize: '18px', fontWeight: 700, color: '#fff', marginBottom: '8px' }}>Documents Checklist</h2>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '24px' }}>
              Upload and manage files required for your application process. Max size 10MB per document (Supported: PDF, JPG, JPEG, PNG, DOCX).
            </p>

            {docsLoading ? (
              <div style={{ color: 'var(--text-muted)' }}>Loading documents checklist...</div>
            ) : allDocuments.length === 0 ? (
              <div style={{ color: 'var(--text-muted)' }}>No document requirements registered for your application stage.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {allDocuments.map((doc) => {
                  const badge = getDocStatusBadgeColor(doc.status);
                  const canUpload = doc.status === 'PENDING' || doc.status === 'REJECTED';

                  return (
                    <div key={doc.id} style={{
                      backgroundColor: 'rgba(255,255,255,0.02)',
                      border: '1px solid var(--border-glass)',
                      borderRadius: '8px',
                      padding: '20px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '12px',
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ fontSize: '15px', fontWeight: 700, color: '#fff' }}>
                              {doc.documentType.replace(/_/g, ' ')}
                            </span>
                            {doc.isRequired && (
                              <span style={{ fontSize: '10px', backgroundColor: 'rgba(239,68,68,0.15)', color: 'var(--danger)', padding: '2px 6px', borderRadius: '4px', fontWeight: 600 }}>
                                Required
                              </span>
                            )}
                          </div>
                          {doc.originalFileName && (
                            <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
                              File: {doc.originalFileName} (Version {doc.version})
                            </p>
                          )}
                          {doc.uploadedAt && (
                            <p style={{ fontSize: '11px', color: 'var(--text-dim)', marginTop: '2px' }}>
                              Last active: {new Date(doc.uploadedAt).toLocaleString()}
                            </p>
                          )}
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '6px' }}>
                          <span style={{
                            padding: '6px 12px',
                            borderRadius: '4px',
                            fontSize: '11px',
                            fontWeight: 700,
                            backgroundColor: badge.bg,
                            color: badge.text,
                          }}>
                            {badge.label}
                          </span>
                        </div>
                      </div>

                      {doc.verificationNote && (
                        <div style={{
                          backgroundColor: doc.status === 'REJECTED' ? 'rgba(239,68,68,0.05)' : 'rgba(255,255,255,0.02)',
                          border: '1px solid ' + (doc.status === 'REJECTED' ? 'rgba(239,68,68,0.2)' : 'var(--border-glass)'),
                          padding: '10px 14px',
                          borderRadius: '6px',
                          fontSize: '12px',
                          color: doc.status === 'REJECTED' ? '#fca5a5' : 'var(--text-muted)'
                        }}>
                          <strong>Counsellor Feedback:</strong> {doc.verificationNote}
                        </div>
                      )}

                      {canUpload && (
                        <div style={{
                          marginTop: '8px',
                          borderTop: '1px dashed var(--border-glass)',
                          paddingTop: '14px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '12px',
                          flexWrap: 'wrap'
                        }}>
                          <input
                            type="file"
                            id={`file-${doc.documentType}`}
                            accept=".pdf,.jpg,.jpeg,.png,.docx"
                            onChange={(e) => {
                              if (e.target.files && e.target.files[0]) {
                                handleFileChange(doc.documentType, e.target.files[0]);
                              }
                            }}
                            style={{ display: 'none' }}
                          />
                          <label
                            htmlFor={`file-${doc.documentType}`}
                            style={{
                              padding: '8px 16px',
                              backgroundColor: 'rgba(255,255,255,0.05)',
                              border: '1px solid var(--border-glass)',
                              borderRadius: '6px',
                              color: '#fff',
                              fontSize: '13px',
                              cursor: 'pointer',
                              fontWeight: 600,
                              transition: 'all 0.2s',
                            }}
                            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.1)'}
                            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.05)'}
                          >
                            Choose File
                          </label>

                          <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                            {selectedFiles[doc.documentType]?.name || 'No file selected'}
                          </span>

                          <button
                            onClick={() => handleFileUpload(doc.documentType)}
                            disabled={uploadingDocType === doc.documentType || !selectedFiles[doc.documentType]}
                            style={{
                              padding: '8px 20px',
                              backgroundColor: selectedFiles[doc.documentType] ? 'var(--primary)' : 'rgba(59,130,246,0.3)',
                              border: 'none',
                              borderRadius: '6px',
                              color: selectedFiles[doc.documentType] ? '#fff' : 'rgba(255,255,255,0.3)',
                              fontSize: '13px',
                              cursor: selectedFiles[doc.documentType] ? 'pointer' : 'not-allowed',
                              fontWeight: 600,
                              marginLeft: 'auto'
                            }}
                          >
                            {uploadingDocType === doc.documentType ? 'Uploading...' : 'Upload Document'}
                          </button>

                          {uploadProgress[doc.documentType] && (
                            <div style={{ width: '100%', fontSize: '12px', color: 'var(--success)', marginTop: '4px' }}>
                              {uploadProgress[doc.documentType]}
                            </div>
                          )}

                          {uploadError[doc.documentType] && (
                            <div style={{ width: '100%', fontSize: '12px', color: 'var(--danger)', marginTop: '4px' }}>
                              Error: {uploadError[doc.documentType]}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        )}

        {/* Tab 3: Brochures Tracking */}
        {activeTab === 'brochures' && (
          <section style={{
            backgroundColor: 'var(--bg-glass)',
            border: '1px solid var(--border-glass)',
            borderRadius: '12px',
            padding: '24px',
          }}>
            <h2 style={{ fontSize: '18px', fontWeight: 700, color: '#fff', marginBottom: '8px' }}>Assigned Study Brochures</h2>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '24px' }}>
              Browse educational materials and track your reading metrics below.
            </p>

            {brochuresLoading ? (
              <div style={{ color: 'var(--text-muted)' }}>Loading brochures...</div>
            ) : brochures.length === 0 ? (
              <div style={{ color: 'var(--text-muted)' }}>No educational brochures have been shared with you yet.</div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                {brochures.map((assignment) => {
                  const tracking = assignment.tracking;
                  const percent = tracking?.completionPercentage || 0;

                  return (
                    <div key={assignment.id} style={{
                      backgroundColor: 'rgba(255,255,255,0.02)',
                      border: '1px solid var(--border-glass)',
                      borderRadius: '8px',
                      padding: '20px',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      gap: '16px',
                    }}>
                      <div>
                        <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#fff', marginBottom: '6px' }}>
                          {assignment.brochure.title}
                        </h3>
                        <p style={{ fontSize: '12px', color: 'var(--text-muted)', lineHeight: '1.4' }}>
                          {assignment.brochure.description || 'Information booklet detailing programs and options.'}
                        </p>
                      </div>

                      {/* Metrics grid */}
                      <div style={{
                        display: 'grid',
                        gridTemplateColumns: '1fr 1fr 1fr',
                        gap: '10px',
                        backgroundColor: 'rgba(0,0,0,0.2)',
                        padding: '12px',
                        borderRadius: '6px',
                        textAlign: 'center',
                      }}>
                        <div>
                          <div style={{ fontSize: '10px', color: 'var(--text-dim)', fontWeight: 600 }}>Reading Time</div>
                          <div style={{ fontSize: '13px', color: '#fff', fontWeight: 700, marginTop: '4px' }}>
                            {formatReadingTime(tracking?.readingTime || 0)}
                          </div>
                        </div>
                        <div>
                          <div style={{ fontSize: '10px', color: 'var(--text-dim)', fontWeight: 600 }}>Completed</div>
                          <div style={{ fontSize: '13px', color: '#fff', fontWeight: 700, marginTop: '4px' }}>
                            {percent.toFixed(0)}%
                          </div>
                        </div>
                        <div>
                          <div style={{ fontSize: '10px', color: 'var(--text-dim)', fontWeight: 600 }}>Downloads</div>
                          <div style={{ fontSize: '13px', color: '#fff', fontWeight: 700, marginTop: '4px' }}>
                            {tracking?.downloadCount || 0}
                          </div>
                        </div>
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '11px', color: 'var(--text-dim)' }}>
                          Shared on: {new Date(assignment.assignedAt).toLocaleDateString()}
                        </span>
                        
                        <a
                          href={`http://localhost:3000/brochure/view/${assignment.token}`}
                          target="_blank"
                          rel="noreferrer"
                          style={{
                            padding: '8px 16px',
                            backgroundColor: 'rgba(59,130,246,0.1)',
                            border: '1px solid var(--primary)',
                            borderRadius: '6px',
                            color: 'var(--primary)',
                            textDecoration: 'none',
                            fontSize: '12px',
                            fontWeight: 700,
                            transition: 'all 0.2s',
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.backgroundColor = 'var(--primary)';
                            e.currentTarget.style.color = '#fff';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.backgroundColor = 'rgba(59,130,246,0.1)';
                            e.currentTarget.style.color = 'var(--primary)';
                          }}
                        >
                          Read Brochure
                        </a>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        )}

        {/* Tab 4: Messages History */}
        {activeTab === 'messages' && (
          <section style={{
            backgroundColor: 'var(--bg-glass)',
            border: '1px solid var(--border-glass)',
            borderRadius: '12px',
            padding: '24px',
          }}>
            <h2 style={{ fontSize: '18px', fontWeight: 700, color: '#fff', marginBottom: '8px' }}>Communication Logs</h2>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '24px' }}>
              Read-only archive of notifications, documents request alerts, and emails dispatched to you.
            </p>

            {messagesLoading ? (
              <div style={{ color: 'var(--text-muted)' }}>Loading communication logs...</div>
            ) : messages.length === 0 ? (
              <div style={{ color: 'var(--text-muted)' }}>No messages logged.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                {messages.map((log) => (
                  <div key={log.id} style={{
                    backgroundColor: 'rgba(255,255,255,0.01)',
                    border: '1px solid var(--border-glass)',
                    borderRadius: '8px',
                    padding: '16px',
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{
                          fontSize: '10px',
                          textTransform: 'uppercase',
                          fontWeight: 700,
                          backgroundColor: 'rgba(139, 92, 246, 0.15)',
                          color: 'var(--accent)',
                          padding: '2px 8px',
                          borderRadius: '4px'
                        }}>
                          {log.channel}
                        </span>
                        <span style={{ fontSize: '13px', fontWeight: 700, color: '#fff' }}>
                          {log.eventType.replace(/_/g, ' ')}
                        </span>
                      </div>
                      <span style={{ fontSize: '11px', color: 'var(--text-dim)' }}>
                        {new Date(log.sentAt).toLocaleString()}
                      </span>
                    </div>

                    <div style={{
                      backgroundColor: 'rgba(0,0,0,0.15)',
                      padding: '12px',
                      borderRadius: '6px',
                      fontSize: '12px',
                      lineHeight: '1.5',
                      color: 'var(--text-main)',
                      whiteSpace: 'pre-wrap',
                    }}>
                      {log.message}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {/* Tab 5: Profile Update */}
        {activeTab === 'profile' && (
          <section style={{
            backgroundColor: 'var(--bg-glass)',
            border: '1px solid var(--border-glass)',
            borderRadius: '12px',
            padding: '24px',
          }}>
            <h2 style={{ fontSize: '18px', fontWeight: 700, color: '#fff', marginBottom: '8px' }}>Personal Profile & Identity</h2>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '24px' }}>
              Keep your contact details up to date. Security credentials and system identifiers are read-only.
            </p>

            <form onSubmit={handleSaveProfile} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {profileMsg.text && (
                <div style={{
                  padding: '12px 16px',
                  borderRadius: '6px',
                  fontSize: '13px',
                  backgroundColor: profileMsg.type === 'success' ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)',
                  color: profileMsg.type === 'success' ? 'var(--success)' : 'var(--danger)',
                  border: '1px solid ' + (profileMsg.type === 'success' ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.2)'),
                }}>
                  {profileMsg.text}
                </div>
              )}

              {/* Form Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-muted)', marginBottom: '6px', fontWeight: 600 }}>
                    First Name (Read-Only)
                  </label>
                  <input
                    type="text"
                    disabled
                    value={profile?.firstName || ''}
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      borderRadius: '6px',
                      backgroundColor: 'rgba(255,255,255,0.02)',
                      border: '1px solid var(--border-glass)',
                      color: 'var(--text-muted)',
                      cursor: 'not-allowed',
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-muted)', marginBottom: '6px', fontWeight: 600 }}>
                    Last Name (Read-Only)
                  </label>
                  <input
                    type="text"
                    disabled
                    value={profile?.lastName || ''}
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      borderRadius: '6px',
                      backgroundColor: 'rgba(255,255,255,0.02)',
                      border: '1px solid var(--border-glass)',
                      color: 'var(--text-muted)',
                      cursor: 'not-allowed',
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-muted)', marginBottom: '6px', fontWeight: 600 }}>
                    Email Address (Read-Only)
                  </label>
                  <input
                    type="email"
                    disabled
                    value={profile?.email || ''}
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      borderRadius: '6px',
                      backgroundColor: 'rgba(255,255,255,0.02)',
                      border: '1px solid var(--border-glass)',
                      color: 'var(--text-muted)',
                      cursor: 'not-allowed',
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-muted)', marginBottom: '6px', fontWeight: 600 }}>
                    Portal Identifier (Read-Only)
                  </label>
                  <input
                    type="text"
                    disabled
                    value={profile?.portalId || ''}
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      borderRadius: '6px',
                      backgroundColor: 'rgba(255,255,255,0.02)',
                      border: '1px solid var(--border-glass)',
                      color: 'var(--text-muted)',
                      cursor: 'not-allowed',
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', color: '#fff', marginBottom: '6px', fontWeight: 600 }}>
                    Phone Number
                  </label>
                  <input
                    type="text"
                    value={editPhone}
                    onChange={(e) => setEditPhone(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      borderRadius: '6px',
                      backgroundColor: 'rgba(255,255,255,0.05)',
                      border: '1px solid var(--border-glass)',
                      color: '#fff',
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', color: '#fff', marginBottom: '6px', fontWeight: 600 }}>
                    Emergency Contact Number
                  </label>
                  <input
                    type="text"
                    value={editEmergency}
                    onChange={(e) => setEditEmergency(e.target.value)}
                    placeholder="e.g. +91 99999 99999"
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      borderRadius: '6px',
                      backgroundColor: 'rgba(255,255,255,0.05)',
                      border: '1px solid var(--border-glass)',
                      color: '#fff',
                    }}
                  />
                </div>

                <div style={{ gridColumn: 'span 2' }}>
                  <label style={{ display: 'block', fontSize: '12px', color: '#fff', marginBottom: '6px', fontWeight: 600 }}>
                    Postal Address
                  </label>
                  <textarea
                    value={editAddress}
                    onChange={(e) => setEditAddress(e.target.value)}
                    rows={3}
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      borderRadius: '6px',
                      backgroundColor: 'rgba(255,255,255,0.05)',
                      border: '1px solid var(--border-glass)',
                      color: '#fff',
                      fontFamily: 'inherit',
                      resize: 'none',
                    }}
                  />
                </div>

                <div style={{ gridColumn: 'span 2' }}>
                  <label style={{ display: 'block', fontSize: '12px', color: '#fff', marginBottom: '6px', fontWeight: 600 }}>
                    Photo URL (Profile Photo link)
                  </label>
                  <input
                    type="text"
                    value={editPhoto}
                    onChange={(e) => setEditPhoto(e.target.value)}
                    placeholder="https://example.com/photo.jpg"
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      borderRadius: '6px',
                      backgroundColor: 'rgba(255,255,255,0.05)',
                      border: '1px solid var(--border-glass)',
                      color: '#fff',
                    }}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '10px' }}>
                <button
                  type="submit"
                  disabled={profileSaving}
                  style={{
                    padding: '10px 24px',
                    backgroundColor: 'var(--primary)',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '6px',
                    fontSize: '13px',
                    fontWeight: 700,
                    cursor: profileSaving ? 'not-allowed' : 'pointer',
                    boxShadow: '0 4px 12px rgba(59,130,246,0.3)',
                    transition: 'all 0.2s',
                  }}
                  onMouseEnter={(e) => { if(!profileSaving) e.currentTarget.style.backgroundColor = 'var(--primary-hover)'; }}
                  onMouseLeave={(e) => { if(!profileSaving) e.currentTarget.style.backgroundColor = 'var(--primary)'; }}
                >
                  {profileSaving ? 'Saving Changes...' : 'Save Profile Changes'}
                </button>
              </div>
            </form>
          </section>
        )}

      </main>
    </div>
  );
}
