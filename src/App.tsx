import './App.css'
import Login from "./pages/Login.tsx";
import {Route, Routes} from 'react-router-dom';
import {useAxiosSetup} from "./services/transactionService.ts";
import HomePage from "./pages/HomePage.tsx";

function App() {

    useAxiosSetup(); // Set up the axios interceptors
    return (
        <Routes>
            <Route path="*" element={<Login/>}/>
            <Route path="/login" element={<Login/>}/>
            <Route path="/home" element={<HomePage/>}/>
        </Routes>
    )
}

export default App;
