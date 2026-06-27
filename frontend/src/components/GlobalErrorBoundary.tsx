import React from 'react';

/**
 * Top-level safety net. Any render error that escapes the per-page boundaries
 * (CareerBuilderPage, SuperAdminDashboard, etc.) is caught here so the app
 * shows a friendly fallback + reload instead of white-screening to a blank
 * page. This is the outermost boundary — defense in depth, not a replacement
 * for the existing scoped boundaries.
 */
export class GlobalErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { error: Error | null }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // eslint-disable-next-line no-console
    console.error('[App] unhandled render crash:', error, info?.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '24px',
          background: '#f8fafc',
          fontFamily:
            'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
        }}
      >
        <div
          style={{
            maxWidth: '460px',
            width: '100%',
            textAlign: 'center',
            background: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: '16px',
            padding: '32px 28px',
            boxShadow: '0 10px 30px rgba(15, 23, 42, 0.08)',
          }}
        >
          <h1 style={{ fontSize: '18px', fontWeight: 600, color: '#0f172a', margin: 0 }}>
            Something went wrong
          </h1>
          <p
            style={{
              fontSize: '14px',
              color: '#475569',
              lineHeight: 1.5,
              margin: '10px 0 0',
            }}
          >
            We hit an unexpected error and couldn’t display this screen. Reloading
            usually fixes it.
          </p>
          {this.state.error?.message && (
            <details
              style={{
                marginTop: '14px',
                textAlign: 'left',
                fontSize: '12px',
                color: '#b91c1c',
                background: '#fef2f2',
                border: '1px solid #fecaca',
                borderRadius: '8px',
                padding: '10px 12px',
              }}
            >
              <summary style={{ cursor: 'pointer', userSelect: 'all' }}>
                {this.state.error.message}
              </summary>
              {this.state.error.stack && (
                <pre
                  style={{
                    marginTop: '8px',
                    whiteSpace: 'pre-wrap',
                    fontSize: '10px',
                    color: 'rgba(127, 29, 29, 0.8)',
                    maxHeight: '240px',
                    overflow: 'auto',
                  }}
                >
                  {this.state.error.stack}
                </pre>
              )}
            </details>
          )}
          <button
            type="button"
            onClick={() => window.location.reload()}
            style={{
              marginTop: '20px',
              padding: '10px 22px',
              borderRadius: '10px',
              border: 'none',
              background: '#1e3a8a',
              color: '#ffffff',
              fontSize: '14px',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Reload
          </button>
        </div>
      </div>
    );
  }
}

export default GlobalErrorBoundary;
