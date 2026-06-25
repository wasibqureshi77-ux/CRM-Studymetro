'use client';

import React, { useState, useEffect } from 'react';
import { api } from '../../../lib/api';
import { useAuth } from '../../../context/auth-context';

interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  fullName: string;
  designation: string | null;
  phone: string;
  role: string;
  isActive: boolean;
  branchId?: string | null;
  createdAt: string;
  updatedAt: string;
}

export default function UsersPage() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [branches, setBranches] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Modals / Overlays
  const [activeModal, setActiveModal] = useState<'add' | 'edit' | 'password' | null>(null);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);

  // Form states
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [designation, setDesignation] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [role, setRole] = useState('COUNSELLOR');
  const [branchId, setBranchId] = useState('');

  // Toast / Notification banner
  const [toasts, setToasts] = useState<{ id: string; type: 'success' | 'error'; message: string }[]>([]);

  const addToast = (type: 'success' | 'error', message: string) => {
    const id = Math.random().toString(36).substr(2, 9);
    setToasts((prev) => [...prev, { id, type, message }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  };

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const res = await api.get('/api/v1/users');
      if (Array.isArray(res)) {
        setUsers(res);
      }
    } catch (err: any) {
      addToast('error', err.message || 'Failed to fetch users');
    } finally {
      setLoading(false);
    }
  };

  const fetchBranches = async () => {
    try {
      const res = await api.get('/api/v1/leads/meta/branches');
      if (Array.isArray(res)) {
        setBranches(res);
      }
    } catch (err) {
      console.error('Failed to fetch branches', err);
    }
  };

  useEffect(() => {
    fetchUsers();
    fetchBranches();
  }, []);

  const handleOpenAddUser = () => {
    setFullName('');
    setEmail('');
    setPassword('');
    setPhone('');
    setDesignation('');
    setIsActive(true);
    setRole('COUNSELLOR');
    setBranchId('');
    setActiveModal('add');
  };

  const handleOpenEditUser = (user: User) => {
    setSelectedUser(user);
    setFullName(user.fullName);
    setEmail(user.email);
    setPhone(user.phone || '');
    setDesignation(user.designation || '');
    setIsActive(user.isActive);
    setRole(user.role);
    setBranchId(user.branchId || '');
    setActiveModal('edit');
  };

  const handleOpenResetPassword = (user: User) => {
    setSelectedUser(user);
    setPassword('');
    setActiveModal('password');
  };

  const handleAddUserSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/api/v1/users', {
        fullName,
        email,
        password,
        phone,
        designation,
        isActive,
        role,
        branchId: branchId || undefined
      });
      addToast('success', 'User added successfully');
      setActiveModal(null);
      fetchUsers();
    } catch (err: any) {
      addToast('error', err.message || 'Failed to create user');
    }
  };

  const handleEditUserSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;
    try {
      await api.patch(`/api/v1/users/${selectedUser.id}`, {
        fullName,
        phone,
        designation,
        isActive,
        role,
        branchId: branchId || null
      });
      addToast('success', 'User details updated successfully');
      setActiveModal(null);
      fetchUsers();
    } catch (err: any) {
      addToast('error', err.message || 'Failed to update user');
    }
  };

  const handleResetPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;
    try {
      await api.patch(`/api/v1/users/${selectedUser.id}`, {
        password
      });
      addToast('success', 'Password reset successfully');
      setActiveModal(null);
    } catch (err: any) {
      addToast('error', err.message || 'Failed to reset password');
    }
  };

  const handleToggleStatus = async (user: User) => {
    try {
      await api.patch(`/api/v1/users/${user.id}`, {
        isActive: !user.isActive
      });
      addToast('success', `User status ${!user.isActive ? 'activated' : 'deactivated'} successfully`);
      fetchUsers();
    } catch (err: any) {
      addToast('error', err.message || 'Failed to toggle status');
    }
  };

  const handleDeleteUser = async (user: User) => {
    if (!confirm(`Are you sure you want to delete user ${user.fullName}?`)) return;
    try {
      await api.delete(`/api/v1/users/${user.id}`);
      addToast('success', 'User deleted successfully');
      fetchUsers();
    } catch (err: any) {
      addToast('error', err.message || 'Failed to delete user');
    }
  };

  // Filter users by search
  const filteredUsers = users.filter(
    (u) =>
      u.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (u.designation && u.designation.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div style={{ padding: '24px', maxWidth: '1200px', margin: '0 auto' }}>
      
      {/* Toast Notifications */}
      <div style={{ position: 'fixed', top: '20px', right: '20px', zIndex: 9999, display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {toasts.map((toast) => (
          <div
            key={toast.id}
            style={{
              padding: '12px 20px',
              borderRadius: '6px',
              backgroundColor: toast.type === 'success' ? '#10B981' : '#EF4444',
              color: '#fff',
              fontWeight: 600,
              boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
              animation: 'slideIn 0.2s ease-out'
            }}
          >
            {toast.message}
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '24px', fontWeight: 700 }}>👥 Users Management</h1>
          <p style={{ margin: '4px 0 0 0', color: 'var(--text-muted)', fontSize: '14px' }}>Manage administrators and counsellors on the system.</p>
        </div>
        <button className="btn btn-primary" onClick={handleOpenAddUser}>
          ➕ Add User
        </button>
      </div>

      {/* Search and Filters */}
      <div style={{ marginBottom: '20px', display: 'flex', gap: '12px' }}>
        <input
          type="text"
          placeholder="Search by name, email, designation..."
          className="form-control"
          style={{ maxWidth: '400px', backgroundColor: 'var(--bg-card)' }}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      {/* Users List Grid/Table */}
      <div className="card" style={{ overflow: 'hidden', padding: 0 }}>
        {loading ? (
          <div style={{ padding: '40px', textAlign: 'center' }}>
            <p>Loading users...</p>
          </div>
        ) : filteredUsers.length === 0 ? (
          <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
            No users found matching your search.
          </div>
        ) : (
          <table className="table" style={{ width: '100%', borderCollapse: 'collapse', margin: 0 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-color)', textAlign: 'left', backgroundColor: 'rgba(255,255,255,0.02)' }}>
                <th style={{ padding: '16px' }}>Name</th>
                <th style={{ padding: '16px' }}>Email</th>
                <th style={{ padding: '16px' }}>Phone</th>
                <th style={{ padding: '16px' }}>Designation</th>
                <th style={{ padding: '16px' }}>Status</th>
                <th style={{ padding: '16px' }}>Created Date</th>
                <th style={{ padding: '16px', textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.map((u) => (
                <tr key={u.id} style={{ borderBottom: '1px solid var(--border-color)', transition: 'background-color 0.2s' }}>
                  <td style={{ padding: '16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontWeight: 600 }}>{u.fullName}</span>
                      {u.role === 'SUPER_ADMIN' ? (
                        <span style={{ fontSize: '10px', backgroundColor: '#F59E0B', color: '#fff', padding: '2px 6px', borderRadius: '4px', fontWeight: 700 }}>
                          SUPER ADMIN
                        </span>
                      ) : (
                        <span style={{ fontSize: '10px', backgroundColor: '#3B82F6', color: '#fff', padding: '2px 6px', borderRadius: '4px', fontWeight: 700 }}>
                          COUNSELLOR
                        </span>
                      )}
                    </div>
                  </td>
                  <td style={{ padding: '16px', color: 'var(--text-muted)' }}>{u.email}</td>
                  <td style={{ padding: '16px', color: 'var(--text-muted)' }}>{u.phone || '-'}</td>
                  <td style={{ padding: '16px' }}>{u.designation || '-'}</td>
                  <td style={{ padding: '16px' }}>
                    <span
                      style={{
                        padding: '4px 8px',
                        borderRadius: '4px',
                        fontSize: '12px',
                        fontWeight: 600,
                        backgroundColor: u.isActive ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                        color: u.isActive ? '#10B981' : '#EF4444'
                      }}
                    >
                      {u.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td style={{ padding: '16px', color: 'var(--text-muted)' }}>
                    {new Date(u.createdAt).toLocaleDateString()}
                  </td>
                  <td style={{ padding: '16px', textAlign: 'right' }}>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                      <button className="btn btn-sm" onClick={() => handleOpenEditUser(u)}>
                        ✏️ Edit
                      </button>
                      <button className="btn btn-sm" onClick={() => handleOpenResetPassword(u)}>
                        🔑 Reset Pass
                      </button>
                      {u.id !== currentUser?.id && (
                        <>
                          <button
                            className={`btn btn-sm ${u.isActive ? 'btn-warning' : 'btn-success'}`}
                            onClick={() => handleToggleStatus(u)}
                          >
                            {u.isActive ? 'Deactivate' : 'Activate'}
                          </button>
                          <button className="btn btn-danger btn-sm" onClick={() => handleDeleteUser(u)}>
                            🗑️ Delete
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Add User Modal */}
      {activeModal === 'add' && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', backgroundColor: 'rgba(0, 0, 0, 0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div className="card" style={{ width: '450px', padding: '28px', backgroundColor: '#111827', border: '1px solid #374151', borderRadius: '8px', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5), 0 10px 10px -5px rgba(0, 0, 0, 0.4)' }}>
            <h3 style={{ marginTop: 0, color: '#F9FAFB', marginBottom: '20px' }}>Add New User</h3>
            <form onSubmit={handleAddUserSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '6px', fontWeight: 600, color: '#F3F4F6' }}>Full Name</label>
                <input
                  type="text"
                  required
                  className="form-control"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '6px', fontWeight: 600, color: '#F3F4F6' }}>Email</label>
                <input
                  type="email"
                  required
                  className="form-control"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '6px', fontWeight: 600, color: '#F3F4F6' }}>Password</label>
                <input
                  type="password"
                  required
                  className="form-control"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '6px', fontWeight: 600, color: '#F3F4F6' }}>Phone</label>
                <input
                  type="text"
                  className="form-control"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '6px', fontWeight: 600, color: '#F3F4F6' }}>Designation</label>
                <input
                  type="text"
                  className="form-control"
                  value={designation}
                  onChange={(e) => setDesignation(e.target.value)}
                />
              </div>
              <div style={{ display: 'flex', gap: '16px' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', marginBottom: '6px', fontWeight: 600, color: '#F3F4F6' }}>Role</label>
                  <select className="form-control" value={role} onChange={(e) => setRole(e.target.value)}>
                    <option value="COUNSELLOR">Counsellor</option>
                    <option value="SUPER_ADMIN">Super Admin</option>
                  </select>
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', marginBottom: '6px', fontWeight: 600, color: '#F3F4F6' }}>Status</label>
                  <select className="form-control" value={isActive ? 'true' : 'false'} onChange={(e) => setIsActive(e.target.value === 'true')}>
                    <option value="true">Active</option>
                    <option value="false">Inactive</option>
                  </select>
                </div>
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '6px', fontWeight: 600, color: '#F3F4F6' }}>Branch (Optional)</label>
                <select className="form-control" value={branchId} onChange={(e) => setBranchId(e.target.value)}>
                  <option value="">-- No Branch Boundary --</option>
                  {branches.map((b: any) => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '16px' }}>
                <button type="button" className="btn btn-sm" onClick={() => setActiveModal(null)}>Cancel</button>
                <button type="submit" className="btn btn-primary btn-sm">Save User</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit User Modal */}
      {activeModal === 'edit' && selectedUser && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', backgroundColor: 'rgba(0, 0, 0, 0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div className="card" style={{ width: '450px', padding: '28px', backgroundColor: '#111827', border: '1px solid #374151', borderRadius: '8px', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5), 0 10px 10px -5px rgba(0, 0, 0, 0.4)' }}>
            <h3 style={{ marginTop: 0, color: '#F9FAFB', marginBottom: '20px' }}>Edit User: {selectedUser.fullName}</h3>
            <form onSubmit={handleEditUserSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '6px', fontWeight: 600, color: '#F3F4F6' }}>Full Name</label>
                <input
                  type="text"
                  required
                  className="form-control"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '6px', fontWeight: 600, color: '#F3F4F6' }}>Email (Read-Only)</label>
                <input
                  type="email"
                  disabled
                  className="form-control"
                  style={{ backgroundColor: 'rgba(255,255,255,0.05)', cursor: 'not-allowed', color: '#9CA3AF' }}
                  value={email}
                />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '6px', fontWeight: 600, color: '#F3F4F6' }}>Phone</label>
                <input
                  type="text"
                  className="form-control"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '6px', fontWeight: 600, color: '#F3F4F6' }}>Designation</label>
                <input
                  type="text"
                  className="form-control"
                  value={designation}
                  onChange={(e) => setDesignation(e.target.value)}
                />
              </div>
              <div style={{ display: 'flex', gap: '16px' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', marginBottom: '6px', fontWeight: 600, color: '#F3F4F6' }}>Role</label>
                  <select className="form-control" value={role} onChange={(e) => setRole(e.target.value)}>
                    <option value="COUNSELLOR">Counsellor</option>
                    <option value="SUPER_ADMIN">Super Admin</option>
                  </select>
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', marginBottom: '6px', fontWeight: 600, color: '#F3F4F6' }}>Status</label>
                  <select className="form-control" value={isActive ? 'true' : 'false'} onChange={(e) => setIsActive(e.target.value === 'true')}>
                    <option value="true">Active</option>
                    <option value="false">Inactive</option>
                  </select>
                </div>
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '6px', fontWeight: 600, color: '#F3F4F6' }}>Branch (Optional)</label>
                <select className="form-control" value={branchId} onChange={(e) => setBranchId(e.target.value)}>
                  <option value="">-- No Branch Boundary --</option>
                  {branches.map((b: any) => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '16px' }}>
                <button type="button" className="btn btn-sm" onClick={() => setActiveModal(null)}>Cancel</button>
                <button type="submit" className="btn btn-primary btn-sm">Save Changes</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Reset Password Modal */}
      {activeModal === 'password' && selectedUser && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', backgroundColor: 'rgba(0, 0, 0, 0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div className="card" style={{ width: '400px', padding: '28px', backgroundColor: '#111827', border: '1px solid #374151', borderRadius: '8px', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5), 0 10px 10px -5px rgba(0, 0, 0, 0.4)' }}>
            <h3 style={{ marginTop: 0, color: '#F9FAFB' }}>Reset Password</h3>
            <p style={{ fontSize: '13px', color: '#9CA3AF', marginBottom: '20px' }}>Configure a new access password for <strong>{selectedUser.fullName}</strong>.</p>
            <form onSubmit={handleResetPasswordSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '6px', fontWeight: 600, color: '#F3F4F6' }}>New Password</label>
                <input
                  type="password"
                  required
                  className="form-control"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '16px' }}>
                <button type="button" className="btn btn-sm" onClick={() => setActiveModal(null)}>Cancel</button>
                <button type="submit" className="btn btn-primary btn-sm">Confirm Reset</button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
