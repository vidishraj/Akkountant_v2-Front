import './App.css'
import Login from "./pages/Login.tsx";
import {Route, Routes} from 'react-router-dom';
import {setupAxiosInterceptors} from "./services/AxiosConfig.tsx";
import HomePage from "./pages/HomePage.tsx";
import Transactions from "./pages/Transactions.tsx";
import PrivateRoute from "./utils/PrivateRoute.tsx";
import Investments from './pages/Investments/Investments.tsx';

function App() {

    setupAxiosInterceptors();
    return (
        <Routes>
            <Route path="*" element={<Login/>}/>
            <Route path="/login" element={<Login/>}/>
            <Route path="/home" element={<PrivateRoute><HomePage/></PrivateRoute>}/>
            <Route path="/transactions" element={<PrivateRoute><Transactions/></PrivateRoute>}/>
            <Route path="/investments" element={<PrivateRoute><Investments/></PrivateRoute>}/>
        </Routes>
    )
}

export default App;
