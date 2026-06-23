'use client';

import React, { useState, useEffect } from 'react';
import { api } from '../../../lib/api';

export default function DocumentsPage() {
  const [documents, setDocuments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  // Rejection modal state
  const [rejectionDocId, setRejectionDocId] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchDocuments = async () => {
    setLoading(true);
    try {
      const res = await api.get('/api/v1/documents');
      setDocuments(res || []);
    } catch (err: any) {
      console.error('Failed to load documents', err);
      setErrorMsg(err.message || 'Failed to load documents registry.');
    } finally {
      setLoading(false);
    }
  };

  const filteredDocuments = documents.filter((doc) => {
    const leadName = doc.lead ? `${doc.lead.firstName} ${doc.lead.lastName || ''}`.toLowerCase() : '';
    return leadName.includes(searchQuery.toLowerCase());
  });

  useEffect(() => {
    fetchDocuments();
  }, []);

  const handleApprove = async (docId: string) => {
    setErrorMsg('');
    setSuccessMsg('');
    try {
      await api.patch(`/api/v1/documents/${docId}/approve`, {
        approvalStatus: 'APPROVED'
      });
      setSuccessMsg('Document successfully approved.');
      await fetchDocuments();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to approve document.');
    }
  };

  const handleRejectSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rejectionDocId || !rejectionReason.trim()) {
      setErrorMsg('Rejection reason is required.');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg('');
    setSuccessMsg('');
    try {
      await api.patch(`/api/v1/documents/${rejectionDocId}/approve`, {
        approvalStatus: 'REJECTED',
        rejectionReason: rejectionReason
      });
      setSuccessMsg('Document successfully rejected.');
      setRejectionDocId(null);
      setRejectionReason('');
      await fetchDocuments();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to reject document.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDownload = async (docId: string, filename: string) => {
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
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to download document.');
    }
  };

  const handleView = async (docId: string) => {
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
      if (!response.ok) throw new Error('View failed');
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      window.open(blobUrl, '_blank');
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to open document.');
    }
  };

  return (
    <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div>
        <h2 style={{ fontSize: '15px', fontWeight: 700 }}>Documents Verification Registry</h2>
        <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
          Review, approve, or reject student documentation uploads for applications.
        </p>
      </div>

      {/* Search Input Bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#fff', border: '1px solid var(--border-color)', borderRadius: '4px', padding: '12px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', width: '100%' }}>
          <span style={{ fontSize: '10px', fontWeight: 600, color: 'var(--text-muted)' }}>Search Student Document Registry</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <input
              type="text"
              placeholder="Search by student name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                padding: '6px 12px',
                fontSize: '12px',
                borderRadius: '6px',
                border: '1px solid var(--border-color)',
                backgroundColor: '#fff',
                outline: 'none',
                width: '280px',
                height: '28px'
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
        </div>
      </div>

      {(errorMsg || successMsg) && (
        <div>
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
        </div>
      )}

      <div className="table-container" style={{ margin: 0 }}>
        {loading ? (
          <div style={{ padding: '40px', textAlign: 'center', fontWeight: 600 }}>
            Querying documents database...
          </div>
        ) : filteredDocuments.length === 0 ? (
          <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
            No documents found matching the search query.
          </div>
        ) : (
          <table className="dense-table">
            <thead>
              <tr>
                <th>Student</th>
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
              {filteredDocuments.map((doc) => (
                <tr key={doc.id}>
                  <td>
                    {doc.lead ? (
                      <a href={`/dashboard/leads/${doc.lead.id}`} style={{ color: 'var(--primary-color)', fontWeight: 600, textDecoration: 'none' }}>
                        {doc.lead.firstName} {doc.lead.lastName || ''}
                      </a>
                    ) : (
                      <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>Unknown</span>
                    )}
                  </td>
                  <td>
                    <strong>{doc.documentType}</strong>
                  </td>
                  <td>
                    <span style={{ fontFamily: 'monospace', fontSize: '11px' }}>{doc.originalFileName}</span>
                  </td>
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
                      <div style={{ fontSize: '10px', color: 'var(--danger-color)', marginTop: '2px', fontStyle: 'italic' }}>
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
                        onClick={() => handleApprove(doc.id)}
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

      {/* Rejection Reason popup modal */}
      {rejectionDocId && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <form onSubmit={handleRejectSubmit} style={{ backgroundColor: '#fff', borderRadius: '4px', border: '1px solid var(--border-color)', padding: '20px', width: '400px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <h3 style={{ fontSize: '14px', fontWeight: 700, margin: 0, borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>Reject Document</h3>
            
            <div className="form-group">
              <label>Rejection Reason *</label>
              <textarea
                className="form-control"
                rows={3}
                required
                placeholder="Specify the reason (e.g. low resolution, blurred bio page, expired visa etc.)..."
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '8px' }}>
              <button type="button" className="btn" disabled={isSubmitting} onClick={() => { setRejectionDocId(null); setRejectionReason(''); }}>
                Cancel
              </button>
              <button type="submit" className="btn btn-danger" disabled={isSubmitting}>
                {isSubmitting ? 'Rejecting...' : 'Reject Document'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
