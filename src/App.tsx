import './App.css'
import Login from "./pages/Login.tsx";
import {Route, Routes} from 'react-router-dom';
import {setupAxiosInterceptors} from "./services/AxiosConfig.tsx";
import Home from "./pages/Home/Home.tsx";
import Transactions from "./pages/Transactions/Transactions.tsx";
import PrivateRoute from "./utils/PrivateRoute.tsx";
import Investments from './pages/Investments/Investments.tsx';
import InvestmentsLanding from './pages/Investments/InvestmentsLanding.tsx';
import InvestmentDetail from './pages/Investments/InvestmentDetail.tsx';
import Freelance from './pages/Freelance/Freelance.tsx';
import Files from './pages/Files/Files.tsx';

import {useLoading} from "./contexts/LoadingContext.tsx";
import {getAuth, onAuthStateChanged} from "firebase/auth";
import {useEffect} from "react";
import {generateKiteSession, syncKiteHoldings} from "./services/investmentService.ts";
import {useMessage} from "./contexts/MessageContext.tsx";
import {useNavigate} from "react-router-dom";
import Hero from './pages/Hero/Hero.tsx';

function App() {

    setupAxiosInterceptors();
    const {loading, setLoading} = useLoading();
    const {setPayload} = useMessage();
    const navigate = useNavigate();
    const auth = getAuth();

    useEffect(() => {
        // Listen for authentication state changes
        const unsubscribe = onAuthStateChanged(auth, (user) => {
            if (user) {
            } else {
            }
            setLoading(false);
        });

        // Cleanup the listener on unmount
        return () => unsubscribe();
    }, [auth, setLoading]);

    // Handle Kite callback
    useEffect(() => {
        const handleKiteCallback = async () => {
            const urlParams = new URLSearchParams(window.location.search);
            const requestToken = urlParams.get('request_token');
            const status = urlParams.get('status');
            
            if (requestToken && status === 'success') {
                try {
                    setLoading(true);
                    
                    // Generate session with request token
                    const sessionResponse = await generateKiteSession(requestToken);
                    
                    setPayload({
                        type: 'success',
                        message: `Kite authentication successful! Welcome ${sessionResponse.user_name}`
                    });

                    // Sync holdings
                    await syncKiteHoldings();
                    
                    setPayload({
                        type: 'success',
                        message: 'Holdings synced successfully!'
                    });
                    
                    // Clean up URL and redirect to investments
                    window.history.replaceState({}, document.title, window.location.pathname);
                    navigate('/investments');
                    
                } catch (error) {
                    console.error('Error processing Kite callback:', error);
                    setPayload({
                        type: 'error',
                        message: 'Failed to authenticate with Kite. Please try again.'
                    });
                } finally {
                    setLoading(false);
                }
            } else if (status === 'error') {
                setPayload({
                    type: 'error',
                    message: 'Kite authentication failed'
                });
                // Clean up URL
                window.history.replaceState({}, document.title, window.location.pathname);
            }
        };

        handleKiteCallback();
    }, [navigate, setLoading, setPayload]);

    return (
        <Routes>
            {
                loading ? <>Loading.....</> : <>
                    <Route path="/" element={<Hero />} />
                    <Route path="/login" element={<Login/>}/>
                    <Route path="/home" element={<PrivateRoute><Home/></PrivateRoute>}/>
                    <Route path="/transactions" element={<PrivateRoute><Transactions/></PrivateRoute>}/>
                    <Route path="/investments" element={<PrivateRoute><Investments/></PrivateRoute>}>
                        <Route index element={<InvestmentsLanding/>}/>
                        <Route path=":asset" element={<InvestmentDetail/>}/>
                    </Route>
                    <Route path="/freelance" element={<PrivateRoute><Freelance/></PrivateRoute>}/>
                    <Route path="/files" element={<PrivateRoute><Files/></PrivateRoute>}/>
                </>
            }
        </Routes>
    )
}

export default App;
