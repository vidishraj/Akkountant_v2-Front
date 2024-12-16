import './App.css'
import Login from "./pages/Login.tsx";
import {Route, Routes} from 'react-router-dom';
import {setupAxiosInterceptors} from "./services/AxiosConfig.tsx";
import Home from "./pages/Home/Home.tsx";
import Transactions from "./pages/Transactions/Transactions.tsx";
import PrivateRoute from "./utils/PrivateRoute.tsx";
import Investments from './pages/Investments/Investments.tsx';
import {useLoading} from "./contexts/LoadingContext.tsx";
import {getAuth, onAuthStateChanged} from "firebase/auth";
import {useEffect} from "react";

function App() {

    setupAxiosInterceptors();
    const {loading, setLoading} = useLoading()
    const auth = getAuth();
    const currentUser = auth.currentUser;
    auth.beforeAuthStateChanged((auth) => {
        console.log("Refresh attempted", auth)
    })
    auth.onAuthStateChanged((user) => {
        if (user) {
            console.log("User logged in:", user);
        } else {
            console.log("User logged out or not logged in.");
        }
    })
    useEffect(() => {
        // Listen for authentication state changes
        const unsubscribe = onAuthStateChanged(auth, (user) => {
            if (user) {
                console.log("User logged in:", user);
            } else {
                console.log("User logged out or not logged in.");
            }
            setLoading(false);
        });

        // Cleanup the listener on unmount
        return () => unsubscribe();
    }, [currentUser]);

    return (
        <Routes>
            {
                loading ? <>Loading.....</> : <>
                    <Route path="*" element={<Login/>}/>
                    <Route path="/login" element={<Login/>}/>
                    <Route path="/home" element={<PrivateRoute><Home/></PrivateRoute>}/>
                    <Route path="/transactions" element={<PrivateRoute><Transactions/></PrivateRoute>}/>
                    <Route path="/investments" element={<PrivateRoute><Investments/></PrivateRoute>}/>
                </>
            }
        </Routes>
    )
}

export default App;
