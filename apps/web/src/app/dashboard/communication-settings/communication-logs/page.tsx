'use client';

import React, { useState, useEffect } from 'react';
import { api } from '../../../../lib/api';
import Link from 'next/link';

interface Lead { id: string; firstName: string; lastName: string; email?: string }
interface AutomationRule { id: string; name: string }

interface CommunicationLog {
  id: string;
  channel: 'EMAIL' | 'WHATSAPP' | 'SMS';
  eventType: string;
  status: 'SENT' | 'FAILED' | 'PENDING';
  recipient: string;
  message: string;
  failedReason?: string | null;
  createdAt: string;
  lead: Lead;
  automation?: AutomationRule | null;
}

export default function CommunicationLogsPage() {
  const [logs, setLogs] = useState<CommunicationLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [channelFilter, setChannelFilter] = useState('');
  const [search, setSearch] = useState('');
  const [toasts, setToasts] = useState<Array<{ id: string; type: 'success' | 'error'; message: string }>>([]);

  // Detail Modal State
  const [selectedLog, setSelectedLog] = useState<CommunicationLog | null>(null);

  const addToast = (type: 'success' | 'error', message: string) => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, type, message }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 4000);
  };

  const fetchLogs = async () => {
    try {
      setLoading(true);
      const res = await api.get('/api/v1/communication/logs');
      if (Array.isArray(res)) setLogs(res);
    } catch (err: any) {
      addToast('error', err.message || 'Failed to load logs');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  const filteredLogs = logs.filter((l) => {
    const matchesStatus = statusFilter ? l.status === statusFilter : true;
    const matchesChannel = channelFilter ? l.channel === channelFilter : true;
    const matchesSearch =
      l.recipient.toLowerCase().includes(search.toLowerCase()) ||
      l.eventType.toLowerCase().includes(search.toLowerCase()) ||
      l.message.toLowerCase().includes(search.toLowerCase()) ||
      `${l.lead?.firstName || ''} ${l.lead?.lastName || ''}`.toLowerCase().includes(search.toLowerCase());
    return matchesStatus && matchesChannel && matchesSearch;
  });

  return (
    <div style={{ padding: '24px', maxWidth: '1200px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <Link href="/dashboard/communication-settings" style={{ fontSize: '13px', color: '#3b82f6', textDecoration: 'none' }}>
            ← Back to Settings
          </Link>
          <h1 style={{ fontSize: '24px', fontWeight: 800, margin: '8px 0 0 0' }}>📊 Outbound Communication Logs</h1>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: '4px 0 0 0' }}>
            Inspect outbound dispatch records, delivery statuses, payload payloads, and detailed gateway failure errors.
          </p>
        </div>
        <button onClick={fetchLogs} style={{
          backgroundColor: '#fff', color: '#374151', border: '1px solid var(--border-color)', borderRadius: '6px',
          padding: '8px 14px', fontWeight: 600, cursor: 'pointer', fontSize: '13px'
        }}>
          🔄 Refresh Logs
        </button>
      </div>

      {/* Filters bar */}
      <div style={{ display: 'flex', gap: '16px', marginBottom: '20px' }}>
        <input
          type="text"
          placeholder="Search by student name, recipient destination, or trigger..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{
            flex: 1, padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--border-color)',
            fontSize: '13px'
          }}
        />
        <select
          value={channelFilter}
          onChange={(e) => setChannelFilter(e.target.value)}
          style={{
            padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--border-color)',
            fontSize: '13px', minWidth: '150px'
          }}
        >
          <option value="">All Channels</option>
          <option value="EMAIL">✉️ Email</option>
          <option value="WHATSAPP">💬 WhatsApp</option>
          <option value="SMS">📱 SMS</option>
        </select>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          style={{
            padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--border-color)',
            fontSize: '13px', minWidth: '150px'
          }}
        >
          <option value="">All Statuses</option>
          <option value="SENT">Sent Successfully</option>
          <option value="FAILED">Failed Dispatches</option>
          <option value="PENDING">Pending Queue</option>
        </select>
      </div>

      {/* Logs Table */}
      {loading ? (
        <div style={{ padding: '40px', textAlign: 'center', fontWeight: 600 }}>Loading logs...</div>
      ) : filteredLogs.length === 0 ? (
        <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)', border: '1px dashed var(--border-color)', borderRadius: '8px' }}>
          No communication history matching current filter criteria.
        </div>
      ) : (
        <div style={{ backgroundColor: '#fff', border: '1px solid var(--border-color)', borderRadius: '8px', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
            <thead>
              <tr style={{ backgroundColor: '#f9fafb', borderBottom: '1px solid var(--border-color)', fontWeight: 600, color: '#374151' }}>
                <th style={{ padding: '12px 16px' }}>Timestamp</th>
                <th style={{ padding: '12px 16px' }}>Student</th>
                <th style={{ padding: '12px 16px' }}>Channel</th>
                <th style={{ padding: '12px 16px' }}>Trigger / Event</th>
                <th style={{ padding: '12px 16px' }}>Recipient</th>
                <th style={{ padding: '12px 16px' }}>Status</th>
                <th style={{ padding: '12px 16px', textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredLogs.map((log) => (
                <tr key={log.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                  <td style={{ padding: '12px 16px', color: 'var(--text-muted)' }}>
                    {new Date(log.createdAt).toLocaleString()}
                  </td>
                  <td style={{ padding: '12px 16px', fontWeight: 600 }}>
                    {log.lead ? `${log.lead.firstName || ''} ${log.lead.lastName || ''}`.trim() : 'Direct Test'}
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <span style={{
                      fontSize: '11px', fontWeight: 700,
                      backgroundColor: log.channel === 'WHATSAPP' ? '#e8f5e9' : '#eff6ff',
                      color: log.channel === 'WHATSAPP' ? '#2e7d32' : '#1e40af',
                      padding: '2px 6px', borderRadius: '4px'
                    }}>{log.channel}</span>
                  </td>
                  <td style={{ padding: '12px 16px', fontFamily: 'monospace' }}>{log.eventType}</td>
                  <td style={{ padding: '12px 16px', color: '#4b5563' }}>{log.recipient}</td>
                  <td style={{ padding: '12px 16px' }}>
                    <span style={{
                      fontSize: '11px', fontWeight: 700,
                      backgroundColor: log.status === 'SENT' ? '#d1fae5' : '#fee2e2',
                      color: log.status === 'SENT' ? '#065f46' : '#991b1b',
                      padding: '2px 6px', borderRadius: '4px'
                    }}>{log.status}</span>
                  </td>
                  <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                    <button onClick={() => setSelectedLog(log)} style={{
                      padding: '4px 8px', borderRadius: '4px', border: '1px solid var(--border-color)',
                      background: '#fff', fontSize: '11px', cursor: 'pointer', fontWeight: 600
                    }}>
                      View Message
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Log Detail Modal */}
      {selectedLog && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}>
          <div style={{ backgroundColor: '#fff', padding: '24px', borderRadius: '8px', width: '90%', maxWidth: '600px' }}>
            <h2 style={{ margin: '0 0 12px 0', fontSize: '16px', fontWeight: 700 }}>Outbound Dispatch Details</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '13px' }}>
              <div>
                <strong>Destination Recipient:</strong> {selectedLog.recipient}
              </div>
              <div>
                <strong>Trigger Context:</strong> {selectedLog.eventType}
              </div>
              {selectedLog.automation && (
                <div>
                  <strong>Resolved Rule:</strong> {selectedLog.automation.name}
                </div>
              )}
              {selectedLog.failedReason && (
                <div style={{ padding: '10px', backgroundColor: '#fef2f2', border: '1px solid #fee2e2', borderRadius: '4px', color: '#991b1b' }}>
                  <strong>Gateway Error Reason:</strong> {selectedLog.failedReason}
                </div>
              )}
              <div>
                <strong>Rendered Text Content:</strong>
                <pre style={{
                  padding: '12px', backgroundColor: '#f9fafb', border: '1px solid var(--border-color)',
                  borderRadius: '4px', whiteSpace: 'pre-wrap', fontFamily: 'monospace', maxHeight: '200px',
                  overflowY: 'auto', margin: '4px 0 0 0', fontSize: '12px'
                }}>{selectedLog.message}</pre>
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '20px' }}>
              <button type="button" onClick={() => setSelectedLog(null)} style={{ padding: '8px 16px', border: '1px solid var(--border-color)', background: '#fff', borderRadius: '4px', cursor: 'pointer' }}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* Toasts Panel */}
      <div style={{ position: 'fixed', bottom: '20px', right: '20px', display: 'flex', flexDirection: 'column', gap: '10px', zIndex: 9999 }}>
        {toasts.map((t) => (
          <div key={t.id} style={{
            padding: '12px 16px', borderRadius: '6px', color: '#fff',
            backgroundColor: t.type === 'success' ? '#10b981' : '#ef4444',
            boxShadow: '0 4px 6px rgba(0,0,0,0.1)', fontSize: '13px', fontWeight: 500
          }}>
            {t.message}
          </div>
        ))}
      </div>
    </div>
  );
}
