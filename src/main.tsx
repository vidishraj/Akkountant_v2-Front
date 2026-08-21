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
import {MessageProvider} from "./contexts/MessageContext.tsx";
import {AgentChatBridgeProvider} from "./contexts/AgentChatBridgeContext.tsx";
import {WealthDigestProvider} from "./contexts/WealthDigestContext.tsx";
import {KiteProvider} from "./contexts/KiteContext.tsx";
import NotificationMessage from "./components/NotificationBanner/NotificationBanner.tsx";
import ErrorBoundary from "./components/ErrorBoundary.tsx";

createRoot(document.getElementById("root")!).render(
    <Router>
        <AgentChatBridgeProvider>
        <MessageProvider>
            <LoadingProvider>
                <AuthProvider>
                    <UserProvider>
                        <FilterProvider>
                            <FileFilterProvider>
                                <MSNProvider>
                                    <KiteProvider>
                                        <WealthDigestProvider>
                                        <NotificationMessage>
                                        <div className="layout">
                                            <div className="header"><Header/></div>
                                            <div className="content">
                                                <ErrorBoundary>
                                                    <App/>
                                                </ErrorBoundary>
                                            </div>
                                            <div className="footer">© 2025 Akkountant</div>
                                        </div>
                                    </NotificationMessage>
                                    </WealthDigestProvider>
                                    </KiteProvider>
                                </MSNProvider>
                            </FileFilterProvider>
                        </FilterProvider>
                    </UserProvider>
                </AuthProvider>
            </LoadingProvider>
        </MessageProvider>
        </AgentChatBridgeProvider>
    </Router>
);
