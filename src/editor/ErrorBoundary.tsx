import { Component, type ReactNode } from 'react';

/** Keeps a crash inside one dialog from taking down the whole editor. */
export class ErrorBoundary extends Component<{ children: ReactNode; onReset: () => void }, { error: Error | null }> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="modal-back">
        <div className="modal">
          <header>
            <h2>Something went wrong</h2>
          </header>
          <div className="modal-body">
            <p>This window hit an error. Your project is safe — close it and try again.</p>
            <pre className="error">{String(this.state.error.stack ?? this.state.error)}</pre>
          </div>
          <footer>
            <button
              className="primary"
              onClick={() => {
                this.setState({ error: null });
                this.props.onReset();
              }}
            >
              Close
            </button>
          </footer>
        </div>
      </div>
    );
  }
}
