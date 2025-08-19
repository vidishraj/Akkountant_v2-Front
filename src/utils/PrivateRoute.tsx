import {Navigate, useLocation} from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { ReactNode } from 'react';

interface PrivateRouteProps {
    children: ReactNode;
}

const PrivateRoute = (props: PrivateRouteProps) => {
    const { currentUser, loading } = useAuth();
    const location = useLocation();

    // Show loading while checking authentication
    if (loading) {
        return (
            <div style={{ 
                display: 'flex', 
                justifyContent: 'center', 
                alignItems: 'center', 
                minHeight: '100vh',
                backgroundColor: '#121C24',
                color: '#FAFAFA'
            }}>
                Loading...
            </div>
        );
    }

    if (!currentUser) {
        const returnUrl = encodeURIComponent(location.pathname + location.search);
        return <Navigate to={`/login?returnUrl=${returnUrl}`} replace />;
    }

    return props.children;
};

export default PrivateRoute;
