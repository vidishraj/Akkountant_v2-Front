import {Component, ErrorInfo, ReactNode} from 'react';

interface Props {
    children: ReactNode;
}

interface State {
    hasError: boolean;
    error: Error | null;
}

class ErrorBoundary extends Component<Props, State> {
    constructor(props: Props) {
        super(props);
        this.state = {hasError: false, error: null};
    }

    static getDerivedStateFromError(error: Error): State {
        return {hasError: true, error};
    }

    componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error('ErrorBoundary caught:', error, errorInfo);
    }

    render() {
        if (this.state.hasError) {
            return (
                <div style={{padding: '2rem', textAlign: 'center'}}>
                    <h2>Something went wrong.</h2>
                    <p style={{color: '#666'}}>{this.state.error?.message}</p>
                    <button
                        onClick={() => this.setState({hasError: false, error: null})}
                        style={{
                            marginTop: '1rem',
                            padding: '0.5rem 1.5rem',
                            cursor: 'pointer',
                            borderRadius: '4px',
                            border: '1px solid #ccc',
                            background: '#f5f5f5',
                        }}
                    >
                        Try Again
                    </button>
                </div>
            );
        }

        return this.props.children;
    }
}

export default ErrorBoundary;
