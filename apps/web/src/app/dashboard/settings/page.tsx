'use client';

import React, { useState } from 'react';

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<'sources' | 'countries' | 'courses' | 'intakes' | 'statuses'>('sources');

  // Configuration Lists (State initialized with system defaults)
  const [sources, setSources] = useState<string[]>([
    'MANUAL',
    'WEBSITE_SDK',
    'WHATSAPP',
    'TELEPHONY',
    'FACEBOOK_ADS',
    'DYNAMIC_FORM',
    'API_IMPORT'
  ]);
  const [countries, setCountries] = useState<string[]>([
    'United States',
    'United Kingdom',
    'Canada',
    'Australia',
    'Germany',
    'Ireland',
    'New Zealand',
    'Singapore'
  ]);
  const [courses, setCourses] = useState<string[]>([
    'MSc Computer Science',
    'MBA Business Management',
    'MSc Data Science',
    'BSc Information Technology',
    'BBA Finance',
    'MPH Public Health'
  ]);
  const [intakes, setIntakes] = useState<string[]>([
    'Fall 2026',
    'Spring 2026',
    'Winter 2027',
    'Summer 2026',
    'Fall 2027'
  ]);

  const [statuses, setStatuses] = useState<{ code: string; label: string; active: boolean }[]>([
    { code: 'NEW_LEAD', label: 'New Lead', active: true },
    { code: 'CONTACTED', label: 'Contacted', active: true },
    { code: 'COUNSELLING', label: 'Counselling', active: true },
    { code: 'DEMO_CLASS', label: 'Demo Class', active: true },
    { code: 'DEMO_SESSION', label: 'Demo Session', active: true },
    { code: 'ENROLLED', label: 'Enrolled', active: true },
    { code: 'TRAINING', label: 'Training', active: true },
    { code: 'EXAM_BOOKED', label: 'Exam Booked', active: true },
    { code: 'COURSE_ONGOING', label: 'Course Ongoing', active: true },
    { code: 'COMPLETED', label: 'Completed', active: true },
    { code: 'DOCUMENTS_PENDING', label: 'Documents Pending', active: true },
    { code: 'DOCUMENTS_RECEIVED', label: 'Documents Received', active: true },
    { code: 'UNIVERSITY_APPLIED', label: 'University Applied', active: true },
    { code: 'OFFER_LETTER', label: 'Offer Letter Received', active: true },
    { code: 'VISA_PROCESS', label: 'Visa Process', active: true },
    { code: 'ADMISSION_CLOSED', label: 'Admission Closed', active: true },
    { code: 'LOST', label: 'Lost / Not Interested', active: true }
  ]);

  // Input states for adding values
  const [newValue, setNewValue] = useState('');
  const [newStatusCode, setNewStatusCode] = useState('');
  const [newStatusLabel, setNewStatusLabel] = useState('');

  const handleAddItem = (type: 'sources' | 'countries' | 'courses' | 'intakes') => {
    if (!newValue.trim()) return;
    const item = newValue.trim();

    if (type === 'sources') {
      const upper = item.toUpperCase().replace(/\s+/g, '_');
      if (!sources.includes(upper)) setSources([...sources, upper]);
    } else if (type === 'countries') {
      if (!countries.includes(item)) setCountries([...countries, item]);
    } else if (type === 'courses') {
      if (!courses.includes(item)) setCourses([...courses, item]);
    } else if (type === 'intakes') {
      if (!intakes.includes(item)) setIntakes([...intakes, item]);
    }

    setNewValue('');
  };

  const handleDeleteItem = (type: 'sources' | 'countries' | 'courses' | 'intakes', val: string) => {
    if (type === 'sources') {
      setSources(sources.filter((s) => s !== val));
    } else if (type === 'countries') {
      setCountries(countries.filter((c) => c !== val));
    } else if (type === 'courses') {
      setCourses(courses.filter((c) => c !== val));
    } else if (type === 'intakes') {
      setIntakes(intakes.filter((i) => i !== val));
    }
  };

  const handleAddStatus = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStatusCode.trim() || !newStatusLabel.trim()) return;
    const code = newStatusCode.trim().toUpperCase().replace(/\s+/g, '_');
    const label = newStatusLabel.trim();

    if (!statuses.some((s) => s.code === code)) {
      setStatuses([...statuses, { code, label, active: true }]);
    }

    setNewStatusCode('');
    setNewStatusLabel('');
  };

  const toggleStatusActive = (code: string) => {
    setStatuses(
      statuses.map((s) => (s.code === code ? { ...s, active: !s.active } : s))
    );
  };

  return (
    <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '20px', paddingBottom: '50px' }}>
      <div>
        <h2 style={{ fontSize: '15px', fontWeight: 700 }}>Study Metro CRM Platform Settings</h2>
        <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
          Configure organizational parameters, candidate taxonomy lists, and pipeline funnel stages.
        </p>
      </div>

      <div style={{ display: 'flex', gap: '20px', minHeight: '500px' }}>
        
        {/* Left Side: Config Tabs Navigation */}
        <div style={{ width: '200px', display: 'flex', flexDirection: 'column', gap: '4px', borderRight: '1px solid var(--border-color)', paddingRight: '16px' }}>
          <button
            onClick={() => setActiveTab('sources')}
            className={`tab-btn ${activeTab === 'sources' ? 'active' : ''}`}
            style={{ textAlign: 'left', width: '100%', borderRadius: '4px', borderBottom: 'none', padding: '8px 12px' }}
          >
            📣 Lead Sources
          </button>
          <button
            onClick={() => setActiveTab('countries')}
            className={`tab-btn ${activeTab === 'countries' ? 'active' : ''}`}
            style={{ textAlign: 'left', width: '100%', borderRadius: '4px', borderBottom: 'none', padding: '8px 12px' }}
          >
            🌍 Target Countries
          </button>
          <button
            onClick={() => setActiveTab('courses')}
            className={`tab-btn ${activeTab === 'courses' ? 'active' : ''}`}
            style={{ textAlign: 'left', width: '100%', borderRadius: '4px', borderBottom: 'none', padding: '8px 12px' }}
          >
            🎓 Course Preferences
          </button>
          <button
            onClick={() => setActiveTab('intakes')}
            className={`tab-btn ${activeTab === 'intakes' ? 'active' : ''}`}
            style={{ textAlign: 'left', width: '100%', borderRadius: '4px', borderBottom: 'none', padding: '8px 12px' }}
          >
            📅 Intake Sessions
          </button>
          <button
            onClick={() => setActiveTab('statuses')}
            className={`tab-btn ${activeTab === 'statuses' ? 'active' : ''}`}
            style={{ textAlign: 'left', width: '100%', borderRadius: '4px', borderBottom: 'none', padding: '8px 12px' }}
          >
            📊 Pipeline Statuses
          </button>
        </div>

        {/* Right Side: Tab Work Panels */}
        <div style={{ flex: 1, background: '#fff', border: '1px solid var(--border-color)', borderRadius: '4px', padding: '20px' }}>
          
          {/* Tab Panel 1: Lead Sources */}
          {activeTab === 'sources' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <h3 style={{ fontSize: '13px', fontWeight: 700 }}>📣 Ingress Lead Channels Configuration</h3>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input
                  type="text"
                  placeholder="e.g. TIKTOK_ADS"
                  className="form-control"
                  style={{ width: '220px' }}
                  value={newValue}
                  onChange={(e) => setNewValue(e.target.value)}
                />
                <button onClick={() => handleAddItem('sources')} className="btn btn-primary">
                  Add Source
                </button>
              </div>
              <div className="table-container" style={{ margin: 0, border: 'none' }}>
                <table className="dense-table" style={{ width: '100%' }}>
                  <thead>
                    <tr>
                      <th>Source Code</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sources.map((s, idx) => (
                      <tr key={idx}>
                        <td><strong>{s}</strong></td>
                        <td style={{ width: '100px' }}>
                          <button onClick={() => handleDeleteItem('sources', s)} className="btn btn-sm btn-danger">
                            Delete
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Tab Panel 2: Target Countries */}
          {activeTab === 'countries' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <h3 style={{ fontSize: '13px', fontWeight: 700 }}>🌍 Destination Countries Config</h3>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input
                  type="text"
                  placeholder="e.g. France"
                  className="form-control"
                  style={{ width: '220px' }}
                  value={newValue}
                  onChange={(e) => setNewValue(e.target.value)}
                />
                <button onClick={() => handleAddItem('countries')} className="btn btn-primary">
                  Add Country
                </button>
              </div>
              <div className="table-container" style={{ margin: 0, border: 'none' }}>
                <table className="dense-table" style={{ width: '100%' }}>
                  <thead>
                    <tr>
                      <th>Country Name</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {countries.map((c, idx) => (
                      <tr key={idx}>
                        <td><strong>{c}</strong></td>
                        <td style={{ width: '100px' }}>
                          <button onClick={() => handleDeleteItem('countries', c)} className="btn btn-sm btn-danger">
                            Delete
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Tab Panel 3: Course Preferences */}
          {activeTab === 'courses' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <h3 style={{ fontSize: '13px', fontWeight: 700 }}>🎓 Study Programs / Course Taxonomy</h3>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input
                  type="text"
                  placeholder="e.g. MS Cybersecurity"
                  className="form-control"
                  style={{ width: '220px' }}
                  value={newValue}
                  onChange={(e) => setNewValue(e.target.value)}
                />
                <button onClick={() => handleAddItem('courses')} className="btn btn-primary">
                  Add Course
                </button>
              </div>
              <div className="table-container" style={{ margin: 0, border: 'none', maxHeight: '380px', overflowY: 'auto' }}>
                <table className="dense-table" style={{ width: '100%' }}>
                  <thead>
                    <tr>
                      <th>Course Title</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {courses.map((c, idx) => (
                      <tr key={idx}>
                        <td><strong>{c}</strong></td>
                        <td style={{ width: '100px' }}>
                          <button onClick={() => handleDeleteItem('courses', c)} className="btn btn-sm btn-danger">
                            Delete
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Tab Panel 4: Intake Sessions */}
          {activeTab === 'intakes' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <h3 style={{ fontSize: '13px', fontWeight: 700 }}>📅 Admission Intake Semesters</h3>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input
                  type="text"
                  placeholder="e.g. Spring 2027"
                  className="form-control"
                  style={{ width: '220px' }}
                  value={newValue}
                  onChange={(e) => setNewValue(e.target.value)}
                />
                <button onClick={() => handleAddItem('intakes')} className="btn btn-primary">
                  Add Intake
                </button>
              </div>
              <div className="table-container" style={{ margin: 0, border: 'none' }}>
                <table className="dense-table" style={{ width: '100%' }}>
                  <thead>
                    <tr>
                      <th>Semester Intake</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {intakes.map((i, idx) => (
                      <tr key={idx}>
                        <td><strong>{i}</strong></td>
                        <td style={{ width: '100px' }}>
                          <button onClick={() => handleDeleteItem('intakes', i)} className="btn btn-sm btn-danger">
                            Delete
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Tab Panel 5: Pipeline Statuses */}
          {activeTab === 'statuses' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <h3 style={{ fontSize: '13px', fontWeight: 700 }}>📊 Pipeline Stage Funnel Stages Config</h3>
              
              <form onSubmit={handleAddStatus} style={{ display: 'flex', gap: '8px', borderBottom: '1px solid var(--border-color)', paddingBottom: '16px', marginBottom: '8px' }}>
                <input
                  type="text"
                  placeholder="CODE (e.g. VISA_GRANTED)"
                  className="form-control"
                  style={{ width: '180px' }}
                  required
                  value={newStatusCode}
                  onChange={(e) => setNewStatusCode(e.target.value)}
                />
                <input
                  type="text"
                  placeholder="Friendly Label (e.g. Visa Granted)"
                  className="form-control"
                  style={{ width: '220px' }}
                  required
                  value={newStatusLabel}
                  onChange={(e) => setNewStatusLabel(e.target.value)}
                />
                <button type="submit" className="btn btn-primary">
                  Add Pipeline Stage
                </button>
              </form>

              <div className="table-container" style={{ margin: 0, border: 'none', maxHeight: '350px', overflowY: 'auto' }}>
                <table className="dense-table" style={{ width: '100%' }}>
                  <thead>
                    <tr>
                      <th>Pipeline Stage Code</th>
                      <th>Friendly Name Label</th>
                      <th>Funnel Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {statuses.map((s, idx) => (
                      <tr key={idx} style={{ opacity: s.active ? 1 : 0.5 }}>
                        <td><code><strong>{s.code}</strong></code></td>
                        <td>{s.label}</td>
                        <td>
                          <button
                            type="button"
                            onClick={() => toggleStatusActive(s.code)}
                            className="btn btn-sm"
                            style={{
                              backgroundColor: s.active ? 'var(--success-color)' : '#f1f5f9',
                              color: s.active ? '#fff' : 'var(--text-muted)',
                              borderColor: s.active ? 'var(--success-color)' : 'var(--border-color)'
                            }}
                          >
                            {s.active ? '✓ Active Stage' : '✕ Disabled Stage'}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

        </div>

      </div>
    </div>
  );
}
