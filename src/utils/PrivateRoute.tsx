import {Navigate, useLocation} from "react-router-dom"
import {auth} from '../components/FirebaseConfig.tsx';

const PrivateRoute = (props: any) => {
    let location = useLocation();

    if (!auth.currentUser) {
        return <Navigate to="/login" state={{from: location}} replace/>
    }
    return props.children;

};

export default PrivateRoute;