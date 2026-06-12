'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';

interface JobSummary {
  id: string;
  status: string;
  total: number;
  processed: number;
  success: number;
  failed: number;
  timestamp: string;
}

export default function Home() {
  const [emailsInput, setEmailsInput] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [historyJobs, setHistoryJobs] = useState<JobSummary[]>([]);
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const [activeJobDetails, setActiveJobDetails] = useState<JobSummary | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Load history from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem('bulk_email_jobs');
    if (stored) {
      try {
        setHistoryJobs(JSON.parse(stored));
      } catch (e) {
        console.error('Failed to parse history from localStorage', e);
      }
    }
  }, []);

  // Save history helper
  const saveHistory = (newHistory: JobSummary[]) => {
    setHistoryJobs(newHistory);
    localStorage.setItem('bulk_email_jobs', JSON.stringify(newHistory));
  };

  // Fetch individual job details
  const fetchJobStatus = useCallback(async (jobId: string): Promise<JobSummary | null> => {
    try {
      const res = await fetch(`/api/job-status/${jobId}`);
      if (!res.ok) {
        throw new Error('Failed to fetch job status');
      }
      const data = await res.json();
      return {
        id: jobId,
        status: data.status,
        total: data.total,
        processed: data.processed,
        success: data.success,
        failed: data.failed,
        timestamp: new Date().toLocaleTimeString(), // temporary internal timestamp
      };
    } catch (err) {
      console.error(err);
      return null;
    }
  }, []);

  // Update history items with newly fetched progress
  const updateJobInHistory = useCallback((updatedJob: JobSummary) => {
    setHistoryJobs(prev => {
      const idx = prev.findIndex(j => j.id === updatedJob.id);
      if (idx === -1) return prev;
      const copy = [...prev];
      // Preserve the original creation timestamp
      copy[idx] = {
        ...copy[idx],
        status: updatedJob.status,
        total: updatedJob.total,
        processed: updatedJob.processed,
        success: updatedJob.success,
        failed: updatedJob.failed,
      };
      localStorage.setItem('bulk_email_jobs', JSON.stringify(copy));
      return copy;
    });
  }, []);

  // Clear polling interval
  const stopPolling = () => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }
  };

  // Poll job status
  const startPolling = useCallback((jobId: string) => {
    stopPolling();
    
    // Immediate initial fetch
    fetchJobStatus(jobId).then(details => {
      if (details) {
        setActiveJobDetails(details);
        updateJobInHistory(details);
        
        // Stop if it's already in a final state
        if (details.status === 'COMPLETED' || details.status === 'FAILED') {
          return;
        }
      }
      
      // Start interval
      pollingIntervalRef.current = setInterval(async () => {
        const latest = await fetchJobStatus(jobId);
        if (latest) {
          setActiveJobDetails(latest);
          updateJobInHistory(latest);
          
          if (latest.status === 'COMPLETED' || latest.status === 'FAILED') {
            stopPolling();
          }
        }
      }, 1500);
    });
  }, [fetchJobStatus, updateJobInHistory]);

  // Clean up polling on unmount
  useEffect(() => {
    return () => stopPolling();
  }, []);

  // Handle active job selection changes
  useEffect(() => {
    if (activeJobId) {
      startPolling(activeJobId);
    } else {
      setActiveJobDetails(null);
      stopPolling();
    }
  }, [activeJobId, startPolling]);

  // Form Submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    
    // Parse emails from textarea (split by comma, whitespace, or newlines)
    const emails = emailsInput
      .split(/[,\n\s]+/)
      .map(email => email.trim())
      .filter(email => email.length > 0 && email.includes('@')); // basic validation

    if (emails.length === 0) {
      setErrorMsg('Please enter at least one valid email address.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch('/api/send-bulk', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ emails }),
      });

      if (!res.ok) {
        throw new Error('Failed to dispatch bulk email job.');
      }

      const data = (await res.json()) as { jobId: string };
      
      // Create new job summary
      const newJob: JobSummary = {
        id: data.jobId,
        status: 'PROCESSING',
        total: emails.length,
        processed: 0,
        success: 0,
        failed: 0,
        timestamp: new Date().toLocaleTimeString(),
      };

      // Add to list and set as active to trigger immediate polling & view switch
      const updatedHistory = [newJob, ...historyJobs];
      saveHistory(updatedHistory);
      setActiveJobId(data.jobId);
      setEmailsInput('');
    } catch (err: any) {
      setErrorMsg(err.message || 'An error occurred while submitting.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClearHistory = () => {
    saveHistory([]);
    setActiveJobId(null);
  };

  const handleNewBatchClick = () => {
    setActiveJobId(null);
    setActiveJobDetails(null);
    setErrorMsg(null);
  };

  // Progress Bar Width computations
  const total = activeJobDetails?.total || 0;
  const successCount = activeJobDetails?.success || 0;
  const failedCount = activeJobDetails?.failed || 0;
  const processedCount = activeJobDetails?.processed || 0;

  const successWidth = total > 0 ? (successCount / total) * 100 : 0;
  const failedWidth = total > 0 ? (failedCount / total) * 100 : 0;

  return (
    <div className="dashboard-container">
      {/* Sidebar: Navigation, Action button, and Recent Runs history list */}
      <aside className="sidebar">
        <div className="sidebar-header">
          <div className="sidebar-logo">
            <h1>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="m22 2-7 20-4-9-9-4Z"/>
                <path d="M22 2 11 13"/>
              </svg>
              Mail Dispatcher
            </h1>
            <p>Distributed Queue System</p>
          </div>
          <div className="status-indicator">
            <div className="pulse-dot"></div>
            Worker Online
          </div>
        </div>

        {/* Dispatch Action */}
        <div className="sidebar-actions">
          <button className="new-batch-btn" onClick={handleNewBatchClick}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19"/>
              <line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
            Create New Batch
          </button>
        </div>

        {/* History List */}
        <div className="sidebar-history">
          <div className="sidebar-history-title">
            <span>Recent Batches</span>
            {historyJobs.length > 0 && (
              <button 
                onClick={handleClearHistory}
                style={{ 
                  background: 'none', 
                  border: 'none', 
                  color: 'var(--text-muted)', 
                  cursor: 'pointer', 
                  fontSize: '0.7rem', 
                  fontWeight: 600,
                  textDecoration: 'underline' 
                }}
              >
                Clear
              </button>
            )}
          </div>

          {historyJobs.length === 0 ? (
            <div className="section-empty" style={{ padding: '2rem 1rem' }}>
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 8v4l3 3"/>
                <circle cx="12" cy="12" r="10"/>
              </svg>
              <p style={{ fontSize: '0.75rem' }}>No history yet</p>
            </div>
          ) : (
            <div className="history-list">
              {historyJobs.map((job) => {
                const isActive = job.id === activeJobId;
                const formattedPercent = job.total > 0 ? Math.round(((job.success + job.failed) / job.total) * 100) : 0;
                
                return (
                  <div
                    key={job.id}
                    className={`history-item ${isActive ? 'active' : ''}`}
                    onClick={() => setActiveJobId(job.id)}
                  >
                    <div className="history-details">
                      <div className="history-meta">
                        {job.id.substring(0, 8)}...
                      </div>
                      <div className="history-timestamp">
                        {job.total} emails • {formattedPercent}%
                      </div>
                    </div>
                    <div>
                      <span className={`badge badge-${job.status.toLowerCase()}`} style={{ fontSize: '0.65rem', padding: '0.125rem 0.375rem' }}>
                        {job.status}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="sidebar-footer">
          Bulk Email Dispatcher v1.0.0
        </div>
      </aside>

      {/* Main Workspace: dynamically changes depending on whether activeJobId is selected */}
      <main className="main-workspace">
        <div className="workspace-content">
          
          {activeJobId === null ? (
            /* Dispatcher Form Card */
            <div className="card">
              <h2 className="card-title">New Dispatch Batch</h2>
              <form onSubmit={handleSubmit}>
                <div className="form-group">
                  <label className="form-label">Recipient Email Addresses</label>
                  <textarea
                    className="textarea-input"
                    placeholder="Enter email addresses (separated by commas or newlines)&#13;Example:&#13;john@example.com, jane@example.com&#13;alex@domain.org"
                    value={emailsInput}
                    onChange={(e) => setEmailsInput(e.target.value)}
                    disabled={isSubmitting}
                  />
                </div>

                {errorMsg && (
                  <div style={{ color: 'var(--status-failed-text)', fontSize: '0.875rem', marginBottom: '1rem', fontWeight: 500 }}>
                    ⚠️ {errorMsg}
                  </div>
                )}

                <button type="submit" className="btn" disabled={isSubmitting}>
                  {isSubmitting ? (
                    <>
                      <div className="spinner"></div>
                      Queueing Jobs...
                    </>
                  ) : (
                    <>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="22" y1="2" x2="11" y2="13"/>
                        <polygon points="22 2 15 22 11 13 2 9 22 2"/>
                      </svg>
                      Dispatch Emails
                    </>
                  )}
                </button>
              </form>
            </div>
          ) : (
            /* Active Status Monitor Card */
            <div className="card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                <h2 className="card-title" style={{ margin: 0 }}>Active Job Monitor</h2>
                {activeJobDetails && (
                  <span className={`badge badge-${activeJobDetails.status.toLowerCase()}`}>
                    {activeJobDetails.status}
                  </span>
                )}
              </div>

              {!activeJobDetails ? (
                <div className="section-empty">
                  <div className="spinner" style={{ margin: '0 auto 1rem auto', borderColor: 'rgba(0,0,0,0.1)', borderTopColor: 'var(--primary)' }}></div>
                  <p>Loading job parameters...</p>
                </div>
              ) : (
                <div>
                  <div className="monitor-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>JOB ID:</span>
                      <div className="monitor-id">{activeJobDetails.id}</div>
                    </div>
                  </div>

                  <div className="metrics-grid">
                    <div className="metric-card">
                      <div className="metric-label">Total</div>
                      <div className="metric-value">{total}</div>
                    </div>
                    <div className="metric-card processing">
                      <div className="metric-label">Pending</div>
                      <div className="metric-value">{total - processedCount}</div>
                    </div>
                    <div className="metric-card success">
                      <div className="metric-label">Success</div>
                      <div className="metric-value">{successCount}</div>
                    </div>
                    <div className="metric-card failed">
                      <div className="metric-label">Failed</div>
                      <div className="metric-value">{failedCount}</div>
                    </div>
                  </div>

                  <div className="progress-container">
                    <div className="progress-label-row">
                      <span>Dispatch Progress</span>
                      <span>{processedCount} / {total} ({total > 0 ? Math.round((processedCount / total) * 100) : 0}%)</span>
                    </div>
                    <div className="progress-bar-wrapper">
                      <div 
                        className="progress-bar-segment progress-bar-success" 
                        style={{ width: `${successWidth}%` }}
                      />
                      <div 
                        className="progress-bar-segment progress-bar-failed" 
                        style={{ width: `${failedWidth}%` }}
                      />
                    </div>
                  </div>

                  {activeJobDetails.status === 'PROCESSING' && (
                    <div className="info-box">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="10"/>
                        <line x1="12" y1="8" x2="12" y2="12"/>
                        <line x1="12" y1="16" x2="12.01" y2="16"/>
                      </svg>
                      <span>Queue is processing. Every 5th email fails deterministically, triggering up to 3 retries with exponential backoff (1s, 2s, 4s).</span>
                    </div>
                  )}

                  <div style={{ marginTop: '2rem', display: 'flex', gap: '1rem' }}>
                    <button className="btn" onClick={handleNewBatchClick} style={{ background: '#f1f5f9', color: 'var(--text-primary)', border: '1px solid var(--border-color)' }}>
                      Back to Creator
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

        </div>
      </main>
    </div>
  );
}
