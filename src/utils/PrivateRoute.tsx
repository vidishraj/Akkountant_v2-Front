import {useEffect, useState} from 'react';
import {Navigate, useLocation} from 'react-router-dom';
import {auth} from '../components/FirebaseConfig.tsx';
import {onAuthStateChanged} from 'firebase/auth';

const PrivateRoute = (props: any) => {
    const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
    const location = useLocation();

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (user) => {
            setIsAuthenticated(user ? true : false);
        });

        return () => unsubscribe();
    }, []);

    //app will pause till firebase checks and populates user
    if (isAuthenticated === null) {
        return null;
    }

    if (!isAuthenticated) {
        const returnUrl = encodeURIComponent(location.pathname + location.search);
        return <Navigate to={`/login?returnUrl=${returnUrl}`} replace />;
    }

    return props.children;
};

export default PrivateRoute;
