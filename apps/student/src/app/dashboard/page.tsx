'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '../../lib/api';

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
  overallProgress?: number;
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

  // Extended States
  const [counsellor, setCounsellor] = useState<any>(null);
  const [assignedBrochures, setAssignedBrochures] = useState<any[]>([]);
  const [branding, setBranding] = useState<any>(null);
  const [sessions, setSessions] = useState<any[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showDrawer, setShowDrawer] = useState(false);

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

  const fetchBranding = async () => {
    try {
      const data = await api.get('/api/v1/student-portal/auth/branding');
      if (data) {
        setBranding(data);
        if (data.primaryColor) {
          document.documentElement.style.setProperty('--primary', data.primaryColor);
        }
        if (data.secondaryColor) {
          document.documentElement.style.setProperty('--primary-hover', data.secondaryColor);
        }
      }
    } catch (err) {
      console.error('Error loading branding', err);
    }
  };

  const fetchSessions = async () => {
    try {
      const data = await api.get('/api/v1/student-portal/sessions');
      setSessions(data || []);
    } catch (err) {
      console.error('Error loading sessions', err);
    }
  };

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      setError('');
      
      await fetchBranding();

      const data = await api.get('/api/v1/student-portal/dashboard');
      setProfile(data.student);
      setFollowup(data.upcomingFollowup);
      setDashboardPendingDocs(data.pendingDocuments || []);
      setNotifications(data.notifications || []);
      setTimeline(data.timeline || []);
      setCounsellor(data.counsellor);
      setAssignedBrochures(data.brochures || []);

      // Pre-fill profile edit fields
      if (data.student) {
        setEditPhone(data.student.phone || '');
        setEditAddress(data.student.address || '');
        setEditEmergency(data.student.emergencyContact || '');
        setEditPhoto(data.student.photo || '');
      }
    } catch (err: any) {
      if (err.status === 401 || err.status === 403) {
        localStorage.removeItem('student_token');
        router.push('/login');
        return;
      }
      setError(err.message || 'Failed to retrieve dashboard details');
    } finally {
      setLoading(false);
    }
  };

  const fetchAllDocuments = async () => {
    try {
      setDocsLoading(true);
      const data = await api.get('/api/v1/student-portal/documents');
      setAllDocuments(data || []);
    } catch (err) {
      console.error('Error fetching documents checklist', err);
    } finally {
      setDocsLoading(false);
    }
  };

  const fetchBrochures = async () => {
    try {
      setBrochuresLoading(true);
      const data = await api.get('/api/v1/student-portal/brochures');
      setBrochures(data || []);
    } catch (err) {
      console.error('Error fetching brochures', err);
    } finally {
      setBrochuresLoading(false);
    }
  };

  const fetchMessages = async () => {
    try {
      setMessagesLoading(true);
      const data = await api.get('/api/v1/student-portal/communications');
      setMessages(data || []);
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
    } else if (activeTab === 'profile') {
      fetchSessions();
    }
  }, [activeTab]);

  const handleLogoutSession = async (sessionId: string) => {
    try {
      await api.post('/api/v1/student-portal/sessions/logout', { sessionId });
      fetchSessions();
    } catch (err) {
      console.error(err);
    }
  };

  const handleLogoutAllOtherSessions = async () => {
    try {
      await api.post('/api/v1/student-portal/sessions/logout-all');
      fetchSessions();
    } catch (err) {
      console.error(err);
    }
  };

  const handleLogout = async () => {
    try {
      await api.post('/api/v1/student-portal/auth/logout');
    } catch (err) {
      console.error('Logout error', err);
    } finally {
      localStorage.removeItem('student_token');
      localStorage.removeItem('student_user');
      router.push('/login');
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
      await api.post('/api/v1/student-portal/documents/upload', formData);
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
      await api.patch('/api/v1/student-portal/profile', {
        phone: editPhone,
        address: editAddress,
        emergencyContact: editEmergency,
        photo: editPhoto
      });

      setProfileMsg({ text: 'Profile updated successfully!', type: 'success' });
      setProfile(prev => prev ? {
        ...prev,
        phone: editPhone,
        address: editAddress,
        emergencyContact: editEmergency,
        photo: editPhoto
      } : null);
    } catch (err: any) {
      setProfileMsg({ text: err.message || 'Failed to save profile changes', type: 'error' });
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
      {/* DESKTOP HEADER */}
      <div className="desktop-only">
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
            {branding?.logo ? (
              <img src={branding.logo} alt="Logo" style={{ height: '32px', width: 'auto' }} />
            ) : (
              <span style={{ fontSize: '24px' }}>🎓</span>
            )}
            <div>
              <h1 style={{ fontSize: '16px', fontWeight: 700, color: '#fff' }}>{branding?.portalName || 'Student Portal'}</h1>
              <p style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{branding?.footerText || 'Study Metro Admissions'}</p>
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

          <div style={{ display: 'flex', alignItems: 'center', gap: '20px', position: 'relative' }}>
            {/* Notification Bell */}
            <div style={{ position: 'relative' }}>
              <button
                onClick={() => setShowNotifications(!showNotifications)}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: '20px',
                  cursor: 'pointer',
                  position: 'relative',
                  padding: '4px',
                }}
              >
                🔔
                {notifications.length > 0 && (
                  <span style={{
                    position: 'absolute',
                    top: '-4px',
                    right: '-4px',
                    backgroundColor: 'var(--danger)',
                    color: '#fff',
                    fontSize: '9px',
                    fontWeight: 700,
                    borderRadius: '50%',
                    width: '16px',
                    height: '16px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}>
                    {notifications.length}
                  </span>
                )}
              </button>

              {showNotifications && (
                <div style={{
                  position: 'absolute',
                  top: '36px',
                  right: 0,
                  width: '320px',
                  backgroundColor: 'rgba(16, 22, 42, 0.95)',
                  border: '1px solid var(--border-glass-hover)',
                  borderRadius: '8px',
                  padding: '16px',
                  boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.5)',
                  zIndex: 1000,
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                    <h4 style={{ fontSize: '13px', fontWeight: 700, color: '#fff' }}>Notifications</h4>
                    <button
                      onClick={async () => {
                        await api.post('/api/v1/student-portal/notifications/read-all');
                        setNotifications([]);
                      }}
                      style={{ background: 'none', border: 'none', fontSize: '10px', color: 'var(--primary)', cursor: 'pointer', fontWeight: 600 }}
                    >
                      Clear All
                    </button>
                  </div>
                  {notifications.length === 0 ? (
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', textAlign: 'center', padding: '16px 0' }}>
                      No unread notifications.
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '240px', overflowY: 'auto' }}>
                      {notifications.map(n => (
                        <div key={n.id} style={{
                          padding: '8px',
                          backgroundColor: 'rgba(255,255,255,0.02)',
                          borderLeft: '3px solid ' + (n.type === 'error' ? 'var(--danger)' : n.type === 'success' ? 'var(--success)' : 'var(--primary)'),
                          borderRadius: '4px',
                        }}>
                          <div style={{ fontSize: '11px', fontWeight: 700, color: '#fff' }}>{n.title}</div>
                          <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '2px' }}>{n.message}</div>
                          <button
                            onClick={async () => {
                              await api.patch(`/api/v1/student-portal/notifications/${n.id}/read`);
                              setNotifications(prev => prev.filter(x => x.id !== n.id));
                            }}
                            style={{
                              background: 'none',
                              border: 'none',
                              fontSize: '9px',
                              color: 'var(--text-dim)',
                              cursor: 'pointer',
                              marginTop: '4px',
                              padding: 0,
                            }}
                            onMouseEnter={(e) => e.currentTarget.style.color = '#fff'}
                            onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-dim)'}
                          >
                            Mark as read
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

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
      </div>

      {/* MOBILE HEADER */}
      <div className="mobile-only" style={{ position: 'sticky', top: 0, zIndex: 100 }}>
        <header style={{
          backgroundColor: 'rgba(10, 14, 26, 0.8)',
          backdropFilter: 'blur(16px)',
          borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
          padding: '12px 16px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.25)',
        }}>
          {/* Hamburger Menu Toggle */}
          <button
            onClick={() => setShowDrawer(true)}
            style={{
              background: 'none',
              border: 'none',
              fontSize: '20px',
              color: '#fff',
              cursor: 'pointer',
              padding: '6px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            ☰
          </button>

          {/* Centered Brand Title & Subtitle */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {branding?.logo ? (
              <img src={branding.logo} alt="Logo" style={{ height: '24px', width: 'auto' }} />
            ) : (
              <span style={{ fontSize: '18px' }}>🎓</span>
            )}
            <div style={{ textAlign: 'left' }}>
              <h1 style={{ fontSize: '14px', fontWeight: 800, color: '#fff', letterSpacing: '-0.02em', margin: 0 }}>
                {branding?.portalName || 'Study Metro'}
              </h1>
              <p style={{ fontSize: '9px', color: 'var(--text-muted)', margin: 0, fontWeight: 500 }}>
                Student Portal
              </p>
            </div>
          </div>

          {/* Right Action - Notification trigger */}
          <div style={{ position: 'relative' }}>
            <button
              onClick={() => setShowNotifications(!showNotifications)}
              style={{
                background: 'none',
                border: 'none',
                fontSize: '18px',
                cursor: 'pointer',
                padding: '6px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                position: 'relative'
              }}
            >
              🔔
              {notifications.length > 0 && (
                <span style={{
                  position: 'absolute',
                  top: '2px',
                  right: '2px',
                  backgroundColor: 'var(--danger)',
                  color: '#fff',
                  fontSize: '8px',
                  fontWeight: 700,
                  borderRadius: '50%',
                  width: '14px',
                  height: '14px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                  {notifications.length}
                </span>
              )}
            </button>

            {showNotifications && (
              <div style={{
                position: 'absolute',
                top: '36px',
                right: 0,
                width: '280px',
                backgroundColor: 'rgba(16, 22, 42, 0.98)',
                border: '1px solid var(--border-glass-hover)',
                borderRadius: '8px',
                padding: '12px',
                boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.6)',
                zIndex: 1000,
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <h4 style={{ fontSize: '11px', fontWeight: 700, color: '#fff' }}>Notifications</h4>
                  <button
                    onClick={async () => {
                      await api.post('/api/v1/student-portal/notifications/read-all');
                      setNotifications([]);
                    }}
                    style={{ background: 'none', border: 'none', fontSize: '9px', color: 'var(--primary)', cursor: 'pointer', fontWeight: 600 }}
                  >
                    Clear All
                  </button>
                </div>
                {notifications.length === 0 ? (
                  <div style={{ fontSize: '10px', color: 'var(--text-muted)', textAlign: 'center', padding: '12px 0' }}>
                    No unread notifications.
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '200px', overflowY: 'auto' }}>
                    {notifications.map(n => (
                      <div key={n.id} style={{
                        padding: '6px',
                        backgroundColor: 'rgba(255,255,255,0.02)',
                        borderLeft: '2px solid ' + (n.type === 'error' ? 'var(--danger)' : n.type === 'success' ? 'var(--success)' : 'var(--primary)'),
                        borderRadius: '4px',
                      }}>
                        <div style={{ fontSize: '10px', fontWeight: 700, color: '#fff' }}>{n.title}</div>
                        <div style={{ fontSize: '9px', color: 'var(--text-muted)', marginTop: '2px' }}>{n.message}</div>
                        <button
                          onClick={async () => {
                            await api.patch(`/api/v1/student-portal/notifications/${n.id}/read`);
                            setNotifications(prev => prev.filter(x => x.id !== n.id));
                          }}
                          style={{
                            background: 'none',
                            border: 'none',
                            fontSize: '8px',
                            color: 'var(--text-dim)',
                            cursor: 'pointer',
                            marginTop: '2px',
                            padding: 0,
                          }}
                        >
                          Mark as read
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </header>
      </div>

      {/* MOBILE LEFT DRAWER */}
      {showDrawer && (
        <div
          onClick={() => setShowDrawer(false)}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.6)',
            backdropFilter: 'blur(4px)',
            zIndex: 600,
            display: 'flex',
            justifyContent: 'flex-start',
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '280px',
              height: '100%',
              backgroundColor: 'rgba(10, 14, 26, 0.98)',
              borderRight: '1px solid rgba(255, 255, 255, 0.08)',
              padding: '24px 16px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              boxShadow: '4px 0 30px rgba(0, 0, 0, 0.5)',
            }}
          >
            <div>
              {/* Drawer Brand */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', paddingBottom: '16px', borderBottom: '1px solid rgba(255, 255, 255, 0.08)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '20px' }}>🎓</span>
                  <span style={{ fontSize: '15px', fontWeight: 700, color: '#fff' }}>Study Metro</span>
                </div>
                <button
                  onClick={() => setShowDrawer(false)}
                  style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '18px', cursor: 'pointer' }}
                >
                  ✕
                </button>
              </div>

              {/* Student Metadata Card */}
              <div style={{
                backgroundColor: 'rgba(255, 255, 255, 0.02)',
                border: '1px solid rgba(255, 255, 255, 0.06)',
                borderRadius: '8px',
                padding: '12px',
                marginBottom: '20px',
              }}>
                <div style={{ fontSize: '13px', fontWeight: 700, color: '#fff' }}>{profile?.fullName}</div>
                <div style={{ fontSize: '10px', color: 'var(--primary)', marginTop: '2px', fontWeight: 600 }}>ID: {profile?.portalId}</div>
              </div>

              {/* Drawer Links */}
              <nav style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {[
                  { key: 'dashboard', label: 'Dashboard', icon: '📊' },
                  { key: 'documents', label: 'Documents', icon: '📁' },
                  { key: 'brochures', label: 'Brochures', icon: '📖' },
                  { key: 'messages', label: 'Messages', icon: '✉️' },
                  { key: 'profile', label: 'Profile', icon: '👤' },
                ].map((item) => {
                  const active = activeTab === item.key;
                  return (
                    <button
                      key={item.key}
                      onClick={() => {
                        setActiveTab(item.key as any);
                        setShowDrawer(false);
                      }}
                      style={{
                        width: '100%',
                        padding: '12px 16px',
                        borderRadius: '8px',
                        border: 'none',
                        background: active ? 'rgba(59, 130, 246, 0.15)' : 'transparent',
                        color: active ? '#fff' : 'var(--text-muted)',
                        fontSize: '13px',
                        fontWeight: 600,
                        textAlign: 'left',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px',
                        transition: 'all 0.2s',
                      }}
                    >
                      <span>{item.icon}</span>
                      <span>{item.label}</span>
                    </button>
                  );
                })}
              </nav>
            </div>

            {/* Logout button in drawer bottom */}
            <button
              onClick={() => {
                setShowDrawer(false);
                handleLogout();
              }}
              style={{
                width: '100%',
                padding: '12px',
                borderRadius: '8px',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                backgroundColor: 'rgba(239, 68, 68, 0.05)',
                color: '#f87171',
                fontSize: '13px',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                transition: 'background-color 0.2s',
              }}
            >
              <span>🚪</span>
              <span>Logout</span>
            </button>
          </div>
        </div>
      )}

      {/* Main Content */}
      <main style={{ flex: 1, padding: '32px', display: 'flex', flexDirection: 'column', gap: '28px', maxWidth: '1200px', margin: '0 auto', width: '100%' }}>
        
        {activeTab === 'dashboard' && (
          <>
            {/* Progress Tracker Card - DESKTOP ONLY */}
            <div className="desktop-only-tracker">
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
            </div>

            {/* Progress Tracker Card - MOBILE ONLY */}
            <div className="mobile-only-tracker">
              {/* Progress Percentage Card */}
              <div style={{
                backgroundColor: 'var(--bg-glass)',
                border: '1px solid var(--border-glass)',
                borderRadius: '12px',
                padding: '20px',
                marginBottom: '16px',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                  <span style={{ fontSize: '13px', fontWeight: 650, color: '#fff' }}>Overall Admission Progress</span>
                  <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--success)' }}>{profile?.overallProgress || 0}%</span>
                </div>
                <div style={{ width: '100%', height: '8px', backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: '4px', overflow: 'hidden' }}>
                  <div style={{ width: `${profile?.overallProgress || 0}%`, height: '100%', backgroundColor: 'var(--success)', transition: 'width 0.4s' }}></div>
                </div>
              </div>

              {/* Vertical Mobile Stepper */}
              <section style={{
                backgroundColor: 'var(--bg-glass)',
                border: '1px solid var(--border-glass)',
                borderRadius: '12px',
                padding: '20px',
              }}>
                <h2 style={{ fontSize: '14px', fontWeight: 700, color: '#fff', marginBottom: '20px' }}>Your Admission Journey</h2>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  {STAGES.map((stage, idx) => {
                    const isCompleted = idx < currentStageIndex;
                    const isCurrent = idx === currentStageIndex;

                    return (
                      <div key={stage.key} style={{ display: 'flex', gap: '16px', position: 'relative' }}>
                        {/* Left Circle + Connecting Line column */}
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: '32px' }}>
                          <div style={{
                            width: isCurrent ? '34px' : '26px',
                            height: isCurrent ? '34px' : '26px',
                            borderRadius: '50%',
                            backgroundColor: isCompleted ? 'rgba(16, 185, 129, 0.12)' : isCurrent ? 'var(--primary)' : 'rgba(255, 255, 255, 0.03)',
                            border: '2px solid ' + (isCompleted ? 'var(--success)' : isCurrent ? 'var(--primary)' : 'rgba(255, 255, 255, 0.12)'),
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontWeight: 700,
                            fontSize: '11px',
                            color: isCurrent || isCompleted ? '#fff' : 'var(--text-muted)',
                            boxShadow: isCurrent ? '0 0 12px var(--primary)' : 'none',
                            position: 'relative',
                            zIndex: 2,
                            transition: 'all 0.3s',
                          }}>
                            {isCompleted ? '✓' : idx + 1}
                            {isCurrent && (
                              <span style={{
                                position: 'absolute',
                                top: '-2px',
                                left: '-2px',
                                right: '-2px',
                                bottom: '-2px',
                                borderRadius: '50%',
                                border: '2px solid var(--primary)',
                                animation: 'pulse 1.8s infinite',
                                opacity: 0.6
                              }} />
                            )}
                          </div>

                          {idx < STAGES.length - 1 && (
                            <div style={{
                              width: '2px',
                              flexGrow: 1,
                              minHeight: '28px',
                              backgroundColor: isCompleted ? 'var(--success)' : 'rgba(255, 255, 255, 0.08)',
                              zIndex: 1,
                              marginTop: '2px',
                              marginBottom: '2px',
                            }} />
                          )}
                        </div>

                        {/* Label Details */}
                        <div style={{
                          paddingBottom: idx < STAGES.length - 1 ? '16px' : '0',
                          paddingTop: isCurrent ? '8px' : '4px',
                          flex: 1
                        }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                            <span style={{
                              fontSize: '12px',
                              fontWeight: isCurrent || isCompleted ? 700 : 500,
                              color: isCurrent ? '#fff' : isCompleted ? 'var(--text-main)' : 'var(--text-dim)',
                              lineHeight: '1.4'
                            }}>
                              {stage.label}
                            </span>
                            {isCurrent && (
                              <span style={{
                                fontSize: '8px',
                                fontWeight: 700,
                                backgroundColor: 'rgba(59, 130, 246, 0.12)',
                                color: 'var(--primary)',
                                padding: '2px 6px',
                                borderRadius: '4px',
                                border: '1px solid rgba(59, 130, 246, 0.2)',
                                textTransform: 'uppercase',
                                letterSpacing: '0.05em'
                              }}>
                                Active
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>

              {/* Current Stage Card */}
              <div style={{
                backgroundColor: 'rgba(59, 130, 246, 0.06)',
                border: '1px solid rgba(59, 130, 246, 0.15)',
                borderRadius: '12px',
                padding: '20px',
                marginTop: '16px',
              }}>
                <span style={{ fontSize: '10px', color: 'var(--primary)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Current Stage</span>
                <h4 style={{ fontSize: '15px', fontWeight: 700, color: '#fff', marginTop: '4px' }}>{STAGES[currentStageIndex]?.label}</h4>
                <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '6px', lineHeight: '1.4' }}>
                  {STAGES[currentStageIndex]?.key === 'NEW_LEAD' && 'Your lead has been successfully registered. We are assigning a counsellor for you.'}
                  {STAGES[currentStageIndex]?.key === 'COUNSELLING' && 'Your counsellor is currently guiding you through the admission process.'}
                  {STAGES[currentStageIndex]?.key === 'DOCUMENTS_PENDING' && 'Please upload all requested files in the Documents tab for verification.'}
                  {STAGES[currentStageIndex]?.key === 'UNIVERSITY_APPLIED' && 'Your university applications have been submitted and are under review.'}
                  {STAGES[currentStageIndex]?.key === 'OFFER_LETTER' && 'Congratulations! You have received your university offer letter.'}
                  {STAGES[currentStageIndex]?.key === 'VISA_PROCESS' && 'Your student visa application is currently being prepared/submitted.'}
                  {STAGES[currentStageIndex]?.key === 'COMPLETED' && 'Congratulations! Your admission process is complete and you are ready to enroll.'}
                </p>
              </div>
            </div>

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

                {/* Overall Admission Progress Card */}
                <div style={{
                  backgroundColor: 'var(--bg-glass)',
                  border: '1px solid var(--border-glass)',
                  borderRadius: '12px',
                  padding: '24px',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <span style={{ fontSize: '13px', fontWeight: 600, color: '#fff' }}>Overall Admission Progress</span>
                    <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--success)' }}>{(profile as any)?.overallProgress || 0}%</span>
                  </div>
                  <div style={{ width: '100%', height: '8px', backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: '4px', overflow: 'hidden' }}>
                    <div style={{ width: `${(profile as any)?.overallProgress || 0}%`, height: '100%', backgroundColor: 'var(--success)', transition: 'width 0.4s' }}></div>
                  </div>
                </div>

                {/* Assigned Brochures Grid */}
                <div style={{
                  backgroundColor: 'var(--bg-glass)',
                  border: '1px solid var(--border-glass)',
                  borderRadius: '12px',
                  padding: '24px',
                }}>
                  <h3 style={{ fontSize: '15px', fontWeight: 600, color: '#fff', marginBottom: '16px' }}>📖 Assigned Brochures</h3>
                  {assignedBrochures.length === 0 ? (
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>No brochures assigned yet.</div>
                  ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                      {assignedBrochures.map(b => (
                        <div key={b.id} style={{
                          padding: '16px',
                          borderRadius: '8px',
                          backgroundColor: 'rgba(255,255,255,0.02)',
                          border: '1px solid var(--border-glass)',
                        }}>
                          <div style={{ fontSize: '13px', fontWeight: 700, color: '#fff', marginBottom: '8px' }}>{b.title}</div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px' }}>
                            <span>Reading Progress</span>
                            <span>{b.completionPercentage}%</span>
                          </div>
                          <div style={{ width: '100%', height: '6px', backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: '3px', overflow: 'hidden', marginBottom: '8px' }}>
                            <div style={{ width: `${b.completionPercentage}%`, height: '100%', backgroundColor: 'var(--primary)' }}></div>
                          </div>
                          <a
                            href={`/brochure/view/${b.token}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{
                              display: 'inline-block',
                              fontSize: '11px',
                              color: 'var(--primary)',
                              textDecoration: 'none',
                              fontWeight: 600,
                            }}
                          >
                            Read Guide →
                          </a>
                        </div>
                      ))}
                    </div>
                  )}
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
                
                {/* My Counsellor Card */}
                <div style={{
                  backgroundColor: 'var(--bg-glass)',
                  border: '1px solid var(--border-glass)',
                  borderRadius: '12px',
                  padding: '24px',
                }}>
                  <h3 style={{ fontSize: '15px', fontWeight: 600, color: '#fff', marginBottom: '16px' }}>👤 My Counsellor</h3>
                  {counsellor ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <div style={{ fontSize: '14px', fontWeight: 700, color: '#fff' }}>{counsellor.name}</div>
                      <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>✉️ {counsellor.email}</div>
                      <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>📞 {counsellor.phone}</div>
                    </div>
                  ) : (
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>No counsellor assigned yet.</div>
                  )}
                </div>

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
                          href={`${process.env.NEXT_PUBLIC_CRM_URL || 'http://localhost:3000'}/brochure/view/${assignment.token}`}
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

            {/* Active Sessions Manager */}
            <div style={{
              marginTop: '32px',
              borderTop: '1px solid var(--border-glass)',
              paddingTop: '24px',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <div>
                  <h3 style={{ fontSize: '15px', fontWeight: 600, color: '#fff' }}>My Active Devices</h3>
                  <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>Sessions currently logged in to your account.</p>
                </div>
                {sessions.length > 1 && (
                  <button
                    type="button"
                    onClick={handleLogoutAllOtherSessions}
                    style={{
                      padding: '6px 12px',
                      borderRadius: '6px',
                      backgroundColor: 'rgba(239, 68, 68, 0.1)',
                      color: 'var(--danger)',
                      border: '1px solid rgba(239, 68, 68, 0.2)',
                      fontSize: '11px',
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    Logout All Other Sessions
                  </button>
                )}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {sessions.map(s => (
                  <div key={s.id} style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '12px 16px',
                    borderRadius: '8px',
                    backgroundColor: 'rgba(255,255,255,0.01)',
                    border: '1px solid var(--border-glass)',
                  }}>
                    <div>
                      <div style={{ fontSize: '13px', fontWeight: 700, color: '#fff' }}>
                        {s.os || 'Unknown OS'} • {s.browser || 'Unknown Browser'}
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--text-dim)', marginTop: '4px' }}>
                        IP: {s.ipAddress || 'Unknown'} • Last active: {new Date(s.lastActivity).toLocaleString()}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleLogoutSession(s.id)}
                      style={{
                        padding: '4px 10px',
                        borderRadius: '4px',
                        border: '1px solid var(--border-glass-hover)',
                        backgroundColor: 'transparent',
                        color: 'var(--text-muted)',
                        fontSize: '11px',
                        cursor: 'pointer',
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--danger)'; e.currentTarget.style.borderColor = 'rgba(239,68,68,0.3)'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.borderColor = 'var(--border-glass-hover)'; }}
                    >
                      Revoke
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

      </main>

      {/* MOBILE BOTTOM NAVIGATION BAR */}
      <div className="mobile-only" style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        height: '64px',
        backgroundColor: 'rgba(10, 14, 26, 0.85)',
        backdropFilter: 'blur(20px)',
        borderTop: '1px solid rgba(255, 255, 255, 0.08)',
        boxShadow: '0 -4px 30px rgba(0, 0, 0, 0.4)',
        display: 'flex',
        justifyContent: 'space-around',
        alignItems: 'center',
        zIndex: 90,
      }}>
        {[
          { key: 'dashboard', label: 'Home', icon: '🏠' },
          { key: 'documents', label: 'Docs', icon: '📄' },
          { key: 'brochures', label: 'Guides', icon: '📚' },
          { key: 'messages', label: 'Chats', icon: '💬' },
          { key: 'profile', label: 'Me', icon: '👤' },
        ].map((tab) => {
          const active = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as any)}
              style={{
                background: 'none',
                border: 'none',
                color: active ? 'var(--primary)' : 'var(--text-dim)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '4px',
                cursor: 'pointer',
                fontSize: '10px',
                fontWeight: active ? 700 : 500,
                padding: '4px 8px',
                transition: 'all 0.2s',
              }}
            >
              <span style={{ fontSize: '18px', filter: active ? 'none' : 'grayscale(100%) opacity(0.7)' }}>{tab.icon}</span>
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
