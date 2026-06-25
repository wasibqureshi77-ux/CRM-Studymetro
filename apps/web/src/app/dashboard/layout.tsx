'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/navigation';
import { usePathname } from 'next/navigation';
import { useAuth } from '../../context/auth-context';
import { api } from '../../lib/api';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, logout, hasPermission, tenantId, loading } = useAuth();
  const pathname = usePathname();
  const [notifications, setNotifications] = useState<any[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);

  // Fetch notifications
  const fetchNotifications = async () => {
    try {
      const res = await api.get('/api/v1/notifications');
      if (Array.isArray(res)) {
        setNotifications(res);
      }
    } catch (err) {
      console.error('Failed to load notifications', err);
    }
  };

  useEffect(() => {
    if (user) {
      fetchNotifications();
      // Poll notifications every 30 seconds
      const timer = setInterval(fetchNotifications, 30000);
      return () => clearInterval(timer);
    }
  }, [user]);

  const handleMarkAsRead = async (id: string) => {
    try {
      await api.patch(`/api/v1/notifications/${id}/read`);
      // Update list locally
      setNotifications((prev) =>
        prev.map((notif) => (notif.id === id ? { ...notif, isRead: true } : notif))
      );
    } catch (err) {
      console.error('Failed to mark notification as read', err);
    }
  };

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  if (loading) {
    return (
      <div style={{ display: 'flex', minHeight: '100vh', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ fontWeight: 600 }}>Loading workspace context...</p>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="app-container">
      {/* 1. Sidebar Navigation */}
      <aside className="sidebar">
        <div className="sidebar-brand">
          <span>Study Metro CRM</span>
        </div>
        <ul className="sidebar-menu">
          {hasPermission('Dashboard.View') && (
            <li className={`sidebar-item ${pathname === '/dashboard' ? 'active' : ''}`}>
              <a href="/dashboard">🏠 Dashboard</a>
            </li>
          )}
          {hasPermission('Lead.View') && (
            <li className={`sidebar-item ${pathname === '/dashboard/pipeline' ? 'active' : ''}`}>
              <a href="/dashboard/pipeline">📋 Pipeline Board</a>
            </li>
          )}
          {hasPermission('Lead.View') && (
            <li className={`sidebar-item ${pathname?.startsWith('/dashboard/leads') ? 'active' : ''}`}>
              <a href="/dashboard/leads">👨‍🎓 Leads</a>
            </li>
          )}
          {hasPermission('Followup.View') && (
            <li className={`sidebar-item ${pathname?.startsWith('/dashboard/followups') ? 'active' : ''}`}>
              <a href="/dashboard/followups">📅 Followups</a>
            </li>
          )}
          {hasPermission('Document.View') && (
            <li className={`sidebar-item ${pathname?.startsWith('/dashboard/documents') ? 'active' : ''}`}>
              <a href="/dashboard/documents">📄 Documents</a>
            </li>
          )}
          {hasPermission('Activities.View') && (
            <li className={`sidebar-item ${pathname?.startsWith('/dashboard/activities') ? 'active' : ''}`}>
              <a href="/dashboard/activities">📞 Activities</a>
            </li>
          )}
          {hasPermission('Reports.View') && (
            <li className={`sidebar-item ${pathname?.startsWith('/dashboard/reports') ? 'active' : ''}`}>
              <a href="/dashboard/reports">📊 Reports</a>
            </li>
          )}
          {hasPermission('Users.View') && (
            <li className={`sidebar-item ${pathname?.startsWith('/dashboard/users') ? 'active' : ''}`}>
              <a href="/dashboard/users">👥 Users</a>
            </li>
          )}
          {hasPermission('Settings.View') && (
            <li className={`sidebar-item ${pathname?.startsWith('/dashboard/settings') ? 'active' : ''}`}>
              <a href="/dashboard/settings">⚙️ Settings</a>
            </li>
          )}
          {hasPermission('Communication.Template') && (
            <li className={`sidebar-item ${pathname?.startsWith('/dashboard/communication-templates') ? 'active' : ''}`}>
              <a href="/dashboard/communication-templates">💬 Communication Templates</a>
            </li>
          )}
          {hasPermission('Communication.Settings') && (
            <li className={`sidebar-item ${pathname?.startsWith('/dashboard/communication-settings') ? 'active' : ''}`}>
              <a href="/dashboard/communication-settings">⚙️ Communication Settings</a>
            </li>
          )}
          {hasPermission('Brochure.View') && (
            <li className={`sidebar-item ${pathname?.startsWith('/dashboard/brochure-library') ? 'active' : ''}`}>
              <a href="/dashboard/brochure-library">📚 Brochure Library</a>
            </li>
          )}
          {hasPermission('Analytics.View') && (
            <li className={`sidebar-item ${pathname?.startsWith('/dashboard/reports-analytics') ? 'active' : ''}`}>
              <a href="/dashboard/reports-analytics">📊 Reports & Analytics</a>
            </li>
          )}
        </ul>
        <div style={{ marginTop: 'auto', padding: '16px', borderTop: '1px solid rgba(255, 255, 255, 0.08)' }}>
          <button onClick={logout} className="btn btn-danger btn-sm" style={{ width: '100%' }}>
            🚪 Sign Out
          </button>
        </div>
      </aside>

      {/* 2. Main Work Area */}
      <div className="main-content">
        <header className="main-header">
          <div className="header-title">
            <span><strong>Study Metro CRM</strong></span>
          </div>

          <div className="header-right">
            {/* Notification Bell */}
            <button
              onClick={() => setShowNotifications(!showNotifications)}
              className="btn btn-sm"
              style={{ position: 'relative', display: 'flex', gap: '4px', alignItems: 'center' }}
            >
              🔔 Alerts
              {unreadCount > 0 && (
                <span
                  style={{
                    backgroundColor: 'var(--danger-color)',
                    color: '#fff',
                    borderRadius: '50%',
                    padding: '2px 6px',
                    fontSize: '9px',
                    fontWeight: 700,
                  }}
                >
                  {unreadCount}
                </span>
              )}
            </button>

            {/* Profile info */}
            <div className="user-info" style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '1px' }}>
              <span style={{ fontWeight: 600 }}>
                {user.firstName} {user.lastName}
              </span>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                {user.role === 'SUPER_ADMIN' ? 'Super Admin' : 'Counsellor'}
              </span>
            </div>
          </div>
        </header>

        <main style={{ flexGrow: 1, overflowY: 'auto', minHeight: 0 }}>
          {children}
        </main>
      </div>

      {/* 3. Global Notification Panel drawer overlay */}
      {showNotifications && (
        <div className="notification-drawer">
          <div className="notification-header">
            <span>Recent Alerts</span>
            <button className="btn btn-sm" onClick={() => setShowNotifications(false)}>
              ✕ Close
            </button>
          </div>
          <ul className="notification-list">
            {notifications.length === 0 ? (
              <li style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)' }}>
                No active notifications
              </li>
            ) : (
              notifications.map((notif) => (
                <li key={notif.id} className={`notification-item ${!notif.isRead ? 'unread' : ''}`}>
                  <div className="notification-item-title">{notif.title}</div>
                  <div className="notification-item-msg">{notif.message}</div>
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      marginTop: '6px',
                    }}
                  >
                    <span style={{ fontSize: '9px', color: 'var(--text-muted)' }}>
                      {new Date(notif.createdAt).toLocaleTimeString()}
                    </span>
                    {!notif.isRead && (
                      <button
                        onClick={() => handleMarkAsRead(notif.id)}
                        className="btn btn-sm"
                        style={{ fontSize: '9px', padding: '2px 6px' }}
                      >
                        ✓ Mark read
                      </button>
                    )}
                  </div>
                </li>
              ))
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
