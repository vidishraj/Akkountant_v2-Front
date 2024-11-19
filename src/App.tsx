import './App.css'
import Login from "./pages/Login.tsx";
import {Route, Routes} from 'react-router-dom';
import {useAxiosSetup} from "./services/transactionService.ts";
import HomePage from "./pages/HomePage.tsx";
import Transactions from "./pages/Transactions.tsx";

function App() {

    useAxiosSetup(); // Set up the axios interceptors
    return (
        <Routes>
            <Route path="*" element={<Login/>}/>
            <Route path="/login" element={<Login/>}/>
            <Route path="/home" element={<HomePage/>}/>
            <Route path="/transactions" element={<Transactions/>}/>
        </Routes>
    )
}

export default App;
