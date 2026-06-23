'use client';

import React, { useState, useEffect } from 'react';
import { api } from '../../../lib/api';

const LEAD_CATEGORIES = [
  'STUDY_ABROAD',
  'IELTS',
  'PTE',
  'ENGLISH_SPEAKING',
  'COMPUTER_COURSE',
  'DIGITAL_MARKETING',
  'OTHER'
];

export default function BrochureLibraryPage() {
  const [brochures, setBrochures] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Upload state
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('STUDY_ABROAD');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  // Edit state
  const [showEditModal, setShowEditModal] = useState(false);
  const [editId, setEditId] = useState('');
  const [editTitle, setEditTitle] = useState('');
  const [editCategory, setEditCategory] = useState('');
  const [editIsActive, setEditIsActive] = useState(true);

  // Toast state
  const [toasts, setToasts] = useState<{ id: string; type: 'success' | 'error'; message: string }[]>([]);

  const addToast = (type: 'success' | 'error', message: string) => {
    const id = Math.random().toString(36).substr(2, 9);
    setToasts((prev) => [...prev, { id, type, message }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  };

  const fetchBrochures = async () => {
    try {
      setLoading(true);
      const data = await api.get('/api/v1/brochures');
      setBrochures(data || []);
    } catch (err: any) {
      console.error(err);
      addToast('error', 'Failed to fetch brochures list');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBrochures();
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setSelectedFile(e.target.files[0]);
    }
  };

  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !selectedFile) {
      alert('Please fill in title and select a PDF file');
      return;
    }
    setSaving(true);
    try {
      const formData = new FormData();
      formData.append('title', title);
      formData.append('category', category);
      formData.append('file', selectedFile);

      // Using raw fetch since standard api helper might not support FormData easily
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'}/api/v1/brochures`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: formData
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to upload brochure');
      }

      addToast('success', 'Brochure uploaded successfully!');
      setShowUploadModal(false);
      setTitle('');
      setSelectedFile(null);
      fetchBrochures();
    } catch (err: any) {
      addToast('error', err.message || 'Error uploading brochure');
    } finally {
      setSaving(false);
    }
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.patch(`/api/v1/brochures/${editId}`, {
        title: editTitle,
        category: editCategory,
        isActive: editIsActive
      });
      addToast('success', 'Brochure updated successfully!');
      setShowEditModal(false);
      fetchBrochures();
    } catch (err: any) {
      addToast('error', err.message || 'Error updating brochure');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this brochure? All assignment references will be deleted.')) {
      return;
    }
    try {
      await api.delete(`/api/v1/brochures/${id}`);
      addToast('success', 'Brochure deleted successfully');
      fetchBrochures();
    } catch (err: any) {
      addToast('error', err.message || 'Error deleting brochure');
    }
  };

  const handleToggleStatus = async (id: string, currentStatus: boolean) => {
    try {
      await api.patch(`/api/v1/brochures/${id}`, { isActive: !currentStatus });
      addToast('success', 'Brochure status updated');
      fetchBrochures();
    } catch (err: any) {
      addToast('error', 'Failed to update status');
    }
  };

  if (loading) {
    return <div style={{ padding: '24px', fontWeight: 600 }}>Loading Brochure Library...</div>;
  }

  return (
    <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontSize: '20px', fontWeight: 700, margin: 0 }}>Brochure Library</h1>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: '4px 0 0 0' }}>
            Upload and manage study abroad / training program brochures. Generate assignment links per student.
          </p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowUploadModal(true)}>
          ➕ Upload Brochure
        </button>
      </div>

      <div style={{ backgroundColor: '#fff', border: '1px solid var(--border-color)', borderRadius: '6px', overflow: 'hidden' }}>
        <table className="table" style={{ width: '100%', borderCollapse: 'collapse', margin: 0 }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border-color)', backgroundColor: 'var(--background-light)', textAlign: 'left' }}>
              <th style={{ padding: '12px 16px', fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)' }}>Title</th>
              <th style={{ padding: '12px 16px', fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)' }}>Category</th>
              <th style={{ padding: '12px 16px', fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)' }}>Pages</th>
              <th style={{ padding: '12px 16px', fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)' }}>Status</th>
              <th style={{ padding: '12px 16px', fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)' }}>Upload Date</th>
              <th style={{ padding: '12px 16px', fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {brochures.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)' }}>
                  No brochures found in the library. Upload your first PDF to get started!
                </td>
              </tr>
            ) : (
              brochures.map((b) => (
                <tr key={b.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                  <td style={{ padding: '12px 16px', fontSize: '13px', fontWeight: 600 }}>{b.title}</td>
                  <td style={{ padding: '12px 16px', fontSize: '13px' }}>
                    <span className="badge badge-secondary" style={{ textTransform: 'lowercase' }}>{b.category}</span>
                  </td>
                  <td style={{ padding: '12px 16px', fontSize: '13px' }}>{b.totalPages}</td>
                  <td style={{ padding: '12px 16px', fontSize: '13px' }}>
                    <span
                      onClick={() => handleToggleStatus(b.id, b.isActive)}
                      style={{
                        padding: '4px 8px',
                        borderRadius: '12px',
                        fontSize: '11px',
                        fontWeight: 600,
                        cursor: 'pointer',
                        backgroundColor: b.isActive ? '#e6f4ea' : '#fce8e6',
                        color: b.isActive ? '#137333' : '#c5221f'
                      }}
                    >
                      {b.isActive ? 'Active' : 'Disabled'}
                    </span>
                  </td>
                  <td style={{ padding: '12px 16px', fontSize: '13px', color: 'var(--text-muted)' }}>
                    {new Date(b.createdAt).toLocaleDateString()}
                  </td>
                  <td style={{ padding: '12px 16px', fontSize: '13px', textAlign: 'right' }}>
                    <div style={{ display: 'inline-flex', gap: '8px' }}>
                      <button
                        className="btn btn-sm btn-outline"
                        onClick={() => {
                          setEditId(b.id);
                          setEditTitle(b.title);
                          setEditCategory(b.category);
                          setEditIsActive(b.isActive);
                          setShowEditModal(true);
                        }}
                      >
                        ✏️ Edit
                      </button>
                      <button
                        className="btn btn-sm btn-danger"
                        onClick={() => handleDelete(b.id)}
                      >
                        🗑️ Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Upload Brochure Modal */}
      {showUploadModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div style={{ backgroundColor: '#fff', borderRadius: '6px', width: '450px', padding: '24px', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }}>
            <h3 style={{ fontSize: '15px', fontWeight: 700, margin: '0 0 16px 0' }}>Upload New Program Brochure</h3>
            <form onSubmit={handleUploadSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div className="form-group" style={{ margin: 0 }}>
                <label>Brochure Title</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="e.g. Canada Student visa Guide"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                />
              </div>

              <div className="form-group" style={{ margin: 0 }}>
                <label>Category Mapping</label>
                <select
                  className="form-control"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                >
                  {LEAD_CATEGORIES.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>

              <div className="form-group" style={{ margin: 0 }}>
                <label>Brochure PDF File</label>
                <input
                  type="file"
                  accept=".pdf"
                  className="form-control"
                  onChange={handleFileChange}
                  required
                />
              </div>

              <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '12px' }}>
                <button type="button" className="btn" onClick={() => setShowUploadModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? 'Uploading...' : 'Upload PDF'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Brochure Modal */}
      {showEditModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div style={{ backgroundColor: '#fff', borderRadius: '6px', width: '450px', padding: '24px', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }}>
            <h3 style={{ fontSize: '15px', fontWeight: 700, margin: '0 0 16px 0' }}>Edit Brochure Metadata</h3>
            <form onSubmit={handleEditSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div className="form-group" style={{ margin: 0 }}>
                <label>Brochure Title</label>
                <input
                  type="text"
                  className="form-control"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  required
                />
              </div>

              <div className="form-group" style={{ margin: 0 }}>
                <label>Category Mapping</label>
                <select
                  className="form-control"
                  value={editCategory}
                  onChange={(e) => setEditCategory(e.target.value)}
                >
                  {LEAD_CATEGORIES.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <input
                  type="checkbox"
                  id="editIsActive"
                  checked={editIsActive}
                  onChange={(e) => setEditIsActive(e.target.checked)}
                />
                <label htmlFor="editIsActive" style={{ fontWeight: 600, cursor: 'pointer' }}>
                  Enable brochure assignments
                </label>
              </div>

              <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '12px' }}>
                <button type="button" className="btn" onClick={() => setShowEditModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? 'Updating...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Toast Alert panel */}
      <div style={{ position: 'fixed', bottom: '20px', right: '20px', display: 'flex', flexDirection: 'column', gap: '10px', zIndex: 9999 }}>
        {toasts.map((t) => (
          <div key={t.id} style={{
            padding: '12px 16px',
            borderRadius: '6px',
            color: '#fff',
            backgroundColor: t.type === 'success' ? '#10b981' : '#ef4444',
            boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
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
