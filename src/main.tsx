import {createRoot} from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import {AuthProvider} from "./contexts/AuthContext.tsx";
import {LoadingProvider} from "./contexts/LoadingContext.tsx";
import {UserProvider} from "./contexts/GlobalContext.tsx";

import {BrowserRouter as Router} from 'react-router-dom';
import SideBar from "./components/SideBar.tsx";

createRoot(document.getElementById('root')!).render(
    <Router>
        <LoadingProvider>
            <AuthProvider>
                <UserProvider>
                    <div style={{
                        width: '100vw',
                        height: '100vh',
                    }}>
                        <div style={{
                            position: 'absolute', zIndex: 100, top: '30%',
                        }}>
                            <SideBar/>
                        </div>
                        <App/>
                    </div>
                </UserProvider>
            </AuthProvider>
        </LoadingProvider>
    </Router>
)
