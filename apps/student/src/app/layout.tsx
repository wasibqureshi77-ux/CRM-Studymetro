import React from 'react';

export const metadata = {
  title: 'Study Metro Student Portal',
  description: 'Manage your study abroad applications, track progress, and submit documents.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800&family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&display=swap" rel="stylesheet" />
        <style>{`
          :root {
            --font-outfit: 'Outfit', sans-serif;
            --font-jakarta: 'Plus Jakarta Sans', sans-serif;
            --bg-primary: #0a0e1a;
            --bg-glass: rgba(16, 22, 42, 0.6);
            --bg-glass-hover: rgba(23, 31, 58, 0.85);
            --border-glass: rgba(255, 255, 255, 0.08);
            --border-glass-hover: rgba(255, 255, 255, 0.15);
            --text-main: #f3f4f6;
            --text-muted: #9ca3af;
            --text-dim: #6b7280;
            --primary-glow: rgba(37, 99, 235, 0.15);
            --primary: #3b82f6;
            --primary-hover: #2563eb;
            --success: #10b981;
            --warning: #f59e0b;
            --danger: #ef4444;
            --accent: #8b5cf6;
          }

          * {
            box-sizing: border-box;
            margin: 0;
            padding: 0;
          }

          body {
            background-color: var(--bg-primary);
            color: var(--text-main);
            font-family: var(--font-jakarta);
            min-height: 100vh;
            overflow-x: hidden;
            display: flex;
            flex-direction: column;
          }

          h1, h2, h3, h4, h5, h6 {
            font-family: var(--font-outfit);
            font-weight: 700;
          }

          /* Premium scrollbar */
          ::-webkit-scrollbar {
            width: 8px;
          }
          ::-webkit-scrollbar-track {
            background: var(--bg-primary);
          }
          ::-webkit-scrollbar-thumb {
            background: rgba(255, 255, 255, 0.15);
            border-radius: 4px;
          }
          ::-webkit-scrollbar-thumb:hover {
            background: rgba(255, 255, 255, 0.3);
          }
        `}</style>
      </head>
      <body>
        {children}
      </body>
    </html>
  );
}
