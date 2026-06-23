'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useParams } from 'next/navigation';

export default function PublicBrochureViewerPage() {
  const { token } = useParams() as { token: string };
  const [meta, setMeta] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  
  // PDF.js State
  const [pdf, setPdf] = useState<any>(null);
  const [pageNum, setPageNum] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [scale, setScale] = useState(1.0);
  const [rendering, setRendering] = useState(false);

  // Stats tracked locally
  const viewedPagesRef = useRef<Set<number>>(new Set());
  const heartbeatIntervalRef = useRef<any>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Initialize and load brochure meta
  useEffect(() => {
    if (!token) return;

    const initViewer = async () => {
      try {
        setLoading(true);
        const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
        
        // Fetch assignment metadata
        const res = await fetch(`${apiBase}/api/v1/brochures/public/view/${token}`);
        if (!res.ok) throw new Error('Brochure link is invalid or has expired.');
        
        const data = await res.json();
        setMeta(data);
        setTotalPages(data.brochure.totalPages);

        // Load PDF.js from CDN
        await loadPdfJsCDN();

        // Fetch and load the PDF document using window.pdfjsLib
        const pdfUrl = `${apiBase}/api/v1/brochures/public/pdf/${token}`;
        const loadingTask = (window as any).pdfjsLib.getDocument({
          url: pdfUrl,
          withCredentials: false
        });
        
        const loadedPdf = await loadingTask.promise;
        setPdf(loadedPdf);
        setTotalPages(loadedPdf.numPages);

        // Record initial Open event
        await trackEvent('OPEN');

        // Start heartbeat tracker
        startHeartbeat();

      } catch (err: any) {
        console.error(err);
        setErrorMsg(err.message || 'Failed to load brochure document.');
      } finally {
        setLoading(false);
      }
    };

    initViewer();

    return () => {
      if (heartbeatIntervalRef.current) {
        clearInterval(heartbeatIntervalRef.current);
      }
    };
  }, [token]);

  // Render PDF page whenever pageNum, scale, or pdf changes
  useEffect(() => {
    if (!pdf) return;
    renderPage(pageNum);
  }, [pdf, pageNum, scale]);

  const loadPdfJsCDN = (): Promise<void> => {
    return new Promise((resolve, reject) => {
      if ((window as any).pdfjsLib) {
        resolve();
        return;
      }

      // Add PDF.js core library
      const script = document.createElement('script');
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.min.js';
      script.onload = () => {
        // Set worker src
        (window as any).pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js';
        resolve();
      };
      script.onerror = () => reject(new Error('Failed to load PDF.js viewer library.'));
      document.head.appendChild(script);
    });
  };

  const renderPage = async (num: number) => {
    if (!pdf || rendering || !canvasRef.current) return;

    try {
      setRendering(true);
      const page = await pdf.getPage(num);
      const canvas = canvasRef.current;
      const context = canvas.getContext('2d');
      if (!context) return;

      const viewport = page.getViewport({ scale });
      canvas.height = viewport.height;
      canvas.width = viewport.width;

      const renderContext = {
        canvasContext: context,
        viewport: viewport
      };

      await page.render(renderContext).promise;

      // Register this page view
      if (!viewedPagesRef.current.has(num)) {
        viewedPagesRef.current.add(num);
        await trackEvent('PAGE_VIEW', { pageNumber: num });
      }

    } catch (err) {
      console.error('Error rendering page:', err);
    } finally {
      setRendering(false);
    }
  };

  const trackEvent = async (eventType: 'OPEN' | 'PAGE_VIEW' | 'HEARTBEAT' | 'DOWNLOAD', payload?: any) => {
    try {
      const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
      await fetch(`${apiBase}/api/v1/brochures/public/track/${token}/event`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ eventType, payload })
      });
    } catch (err) {
      console.error('Failed to report tracking metric:', err);
    }
  };

  const startHeartbeat = () => {
    if (heartbeatIntervalRef.current) clearInterval(heartbeatIntervalRef.current);
    heartbeatIntervalRef.current = setInterval(async () => {
      await trackEvent('HEARTBEAT', { seconds: 10 });
    }, 10000);
  };

  const handlePrevPage = () => {
    if (pageNum > 1) {
      setPageNum(prev => prev - 1);
    }
  };

  const handleNextPage = () => {
    if (pdf && pageNum < pdf.numPages) {
      setPageNum(prev => prev + 1);
    }
  };

  const handleZoomIn = () => setScale(prev => Math.min(2.5, prev + 0.2));
  const handleZoomOut = () => setScale(prev => Math.max(0.5, prev - 0.2));

  const handleDownload = async () => {
    await trackEvent('DOWNLOAD');
    const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
    const link = document.createElement('a');
    link.href = `${apiBase}/api/v1/brochures/public/pdf/${token}`;
    link.download = meta?.brochure?.title ? `${meta.brochure.title}.pdf` : 'Brochure.pdf';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (loading) {
    return (
      <div style={{
        height: '100vh',
        backgroundColor: '#0f172a',
        color: '#f8fafc',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: 'system-ui, sans-serif'
      }}>
        <div style={{
          border: '4px solid rgba(255,255,255,0.1)',
          borderTop: '4px solid #3b82f6',
          borderRadius: '50%',
          width: '40px',
          height: '40px',
          animation: 'spin 1s linear infinite'
        }} />
        <style dangerouslySetInnerHTML={{__html: `
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}} />
        <p style={{ marginTop: '16px', fontSize: '14px', color: '#94a3b8' }}>Loading program details...</p>
      </div>
    );
  }

  if (errorMsg) {
    return (
      <div style={{
        height: '100vh',
        backgroundColor: '#0f172a',
        color: '#f8fafc',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: 'system-ui, sans-serif',
        padding: '24px',
        textAlign: 'center'
      }}>
        <div style={{ fontSize: '48px', marginBottom: '16px' }}>⚠️</div>
        <h2 style={{ fontSize: '18px', fontWeight: 600 }}>Unable to Open Link</h2>
        <p style={{ marginTop: '8px', fontSize: '14px', color: '#94a3b8', maxWidth: '400px' }}>{errorMsg}</p>
      </div>
    );
  }

  const completionPct = pdf ? Math.round((viewedPagesRef.current.size / pdf.numPages) * 100) : 0;

  return (
    <div style={{
      height: '100vh',
      backgroundColor: '#0f172a',
      color: '#f8fafc',
      display: 'flex',
      flexDirection: 'column',
      fontFamily: 'system-ui, sans-serif',
      overflow: 'hidden'
    }}>
      {/* Premium Header */}
      <header style={{
        padding: '12px 24px',
        backgroundColor: '#1e293b',
        borderBottom: '1px solid #334155',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)'
      }}>
        <div>
          <h1 style={{ fontSize: '15px', fontWeight: 600, margin: 0, color: '#f8fafc' }}>{meta?.brochure?.title}</h1>
          <span style={{ fontSize: '11px', color: '#94a3b8', textTransform: 'lowercase' }}>{meta?.brochure?.category}</span>
        </div>

        {/* Progress & Stats */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
            <span style={{ fontSize: '12px', color: '#94a3b8' }}>Completion</span>
            <span style={{ fontSize: '13px', fontWeight: 600, color: '#10b981' }}>{completionPct}%</span>
          </div>
          <button
            onClick={handleDownload}
            style={{
              backgroundColor: '#2563eb',
              color: '#fff',
              border: 'none',
              borderRadius: '6px',
              padding: '8px 14px',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              transition: 'background-color 0.2s'
            }}
            onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#1d4ed8'}
            onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#2563eb'}
          >
            📥 Download PDF
          </button>
        </div>
      </header>

      {/* Main Viewport */}
      <div style={{
        flex: 1,
        overflow: 'auto',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'flex-start',
        padding: '24px 16px',
        backgroundColor: '#0f172a'
      }}>
        <div style={{
          boxShadow: '0 10px 15px -3px rgba(0,0,0,0.3)',
          borderRadius: '8px',
          overflow: 'hidden',
          backgroundColor: '#1e293b',
          border: '1px solid #334155'
        }}>
          <canvas ref={canvasRef} />
        </div>
      </div>

      {/* Floating Glassmorphism Controls */}
      <footer style={{
        position: 'absolute',
        bottom: '24px',
        left: '50%',
        transform: 'translateX(-50%)',
        backgroundColor: 'rgba(30, 41, 59, 0.8)',
        backdropFilter: 'blur(8px)',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        padding: '8px 16px',
        borderRadius: '30px',
        display: 'flex',
        alignItems: 'center',
        gap: '16px',
        boxShadow: '0 10px 25px -5px rgba(0,0,0,0.3)'
      }}>
        {/* Navigation */}
        <button
          onClick={handlePrevPage}
          disabled={pageNum <= 1}
          style={{
            background: 'none',
            border: 'none',
            color: pageNum <= 1 ? '#475569' : '#fff',
            cursor: pageNum <= 1 ? 'not-allowed' : 'pointer',
            fontSize: '16px'
          }}
        >
          ◀
        </button>
        <span style={{ fontSize: '13px', fontWeight: 600 }}>
          Page {pageNum} of {totalPages}
        </span>
        <button
          onClick={handleNextPage}
          disabled={!pdf || pageNum >= pdf.numPages}
          style={{
            background: 'none',
            border: 'none',
            color: (!pdf || pageNum >= pdf.numPages) ? '#475569' : '#fff',
            cursor: (!pdf || pageNum >= pdf.numPages) ? 'not-allowed' : 'pointer',
            fontSize: '16px'
          }}
        >
          ▶
        </button>

        <div style={{ height: '16px', width: '1px', backgroundColor: 'rgba(255,255,255,0.1)' }} />

        {/* Zoom */}
        <button onClick={handleZoomOut} style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', fontSize: '15px' }}>🔍-</button>
        <span style={{ fontSize: '12px', color: '#94a3b8' }}>{Math.round(scale * 100)}%</span>
        <button onClick={handleZoomIn} style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', fontSize: '15px' }}>🔍+</button>
      </footer>
    </div>
  );
}
