import { Component } from 'react';
import localforage from 'localforage';
import { C, STORE_KEYS } from '../lib/constants';
import { todayISO } from '../lib/format';

/**
 * React's default reaction to an error thrown while rendering is to unmount
 * the whole tree, leaving a blank page. That is especially bad here: the data
 * is still safe in IndexedDB, but with nothing on screen there is no way to
 * get it out, and the obvious "fix" — clearing site data — destroys it.
 *
 * This catches the crash and offers a way to download the data instead.
 * It has to be a class: componentDidCatch has no hook equivalent.
 */
export default class ErrorBoundary extends Component {
  state = { error: null, saving: false };

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    // Keeps the real stack reachable in the console for debugging.
    console.error('Render failed:', error, info);
  }

  // Reads storage directly rather than component state, since the tree that
  // held that state is exactly what just failed.
  handleDownload = async () => {
    this.setState({ saving: true });
    try {
      const entries = await Promise.all(
        Object.entries(STORE_KEYS).map(async ([name, key]) => [name, await localforage.getItem(key)]),
      );
      const blob = new Blob([JSON.stringify(Object.fromEntries(entries), null, 2)], {
        type: 'application/json',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `finance-rescue-${todayISO()}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      window.alert('Could not read the saved data from this browser.');
    } finally {
      this.setState({ saving: false });
    }
  };

  render() {
    const { error, saving } = this.state;
    if (!error) return this.props.children;

    return (
      <div style={{
        minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 24, background: C.bg,
      }}>
        <div className="card" style={{ padding: '28px 30px', maxWidth: 460 }}>
          <h1 className="serif" style={{
            fontSize: 24, fontWeight: 600, color: C.textBright, margin: '0 0 10px',
          }}>
            Something went wrong
          </h1>
          <p style={{ fontSize: 13, color: C.text, margin: '0 0 6px', lineHeight: 1.6 }}>
            The app could not display your data. Nothing has been deleted — it is still
            stored in this browser.
          </p>
          <p style={{ fontSize: 13, color: C.muted, margin: '0 0 20px', lineHeight: 1.6 }}>
            Download a copy before doing anything else, then reload. If the same thing
            happens again, that file can be imported once the problem is fixed.
          </p>

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button
              className="btn"
              onClick={this.handleDownload}
              disabled={saving}
              style={{ padding: '9px 14px', fontSize: 13, color: C.accent }}
            >
              {saving ? 'Preparing…' : 'Download my data'}
            </button>
            <button
              className="btn"
              onClick={() => window.location.reload()}
              style={{ padding: '9px 14px', fontSize: 13 }}
            >
              Reload
            </button>
          </div>

          <p style={{
            fontSize: 11, color: C.faint, margin: '20px 0 0', fontFamily: 'monospace',
            wordBreak: 'break-word',
          }}>
            {error.message || String(error)}
          </p>
        </div>
      </div>
    );
  }
}
