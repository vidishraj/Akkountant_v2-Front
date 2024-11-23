import {createRoot} from "react-dom/client";
import "./index.css";
import App from "./App.tsx";
import {AuthProvider} from "./contexts/AuthContext.tsx";
import {LoadingProvider} from "./contexts/LoadingContext.tsx";
import {UserProvider} from "./contexts/GlobalContext.tsx";

import {BrowserRouter as Router} from "react-router-dom";
// import SideBar from "./components/SideBar.tsx";
import {FilterProvider} from "./contexts/FilterContext.tsx";
import {FileFilterProvider} from "./contexts/FileFilterContext.tsx";

createRoot(document.getElementById("root")!).render(
    <Router>
        <LoadingProvider>
            <AuthProvider>
                <UserProvider>
                    <FilterProvider>
                        <FileFilterProvider>
                            <div className="layout">
                                <div className="header">Header</div>
                                <div className="content">
                                    <App/>
                                </div>
                                <div className="footer">Footer</div>
                            </div>
                        </FileFilterProvider>
                    </FilterProvider>
                </UserProvider>
            </AuthProvider>
        </LoadingProvider>
    </Router>
);
