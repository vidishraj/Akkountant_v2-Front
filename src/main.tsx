import {createRoot} from "react-dom/client";
import "./index.css";
import App from "./App.tsx";
import {AuthProvider} from "./contexts/AuthContext.tsx";
import {LoadingProvider} from "./contexts/LoadingContext.tsx";
import {UserProvider} from "./contexts/GlobalContext.tsx";

import {BrowserRouter as Router} from "react-router-dom";
import {FilterProvider} from "./contexts/FilterContext.tsx";
import {FileFilterProvider} from "./contexts/FileFilterContext.tsx";
import Header from "./components/Header/Header.tsx";
import {MSNProvider} from "./contexts/MSNContext.tsx";

createRoot(document.getElementById("root")!).render(
    <Router>
        <LoadingProvider>
            <AuthProvider>
                <UserProvider>
                    <FilterProvider>
                        <FileFilterProvider>
                            <MSNProvider>
                                <div className="layout">
                                    <div className="header"><Header/></div>
                                    <div className="content">
                                        <App/>
                                    </div>
                                    <div className="footer">© 2023 Akkountant</div>
                                </div>
                            </MSNProvider>
                        </FileFilterProvider>
                    </FilterProvider>
                </UserProvider>
            </AuthProvider>
        </LoadingProvider>
    </Router>
);
