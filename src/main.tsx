import {createRoot} from "react-dom/client";
// Nocturne primitives — MUST come before any other stylesheet so :root tokens
// are available before anything reads them (ak-abic, FE-0). nocturne.css is
// byte-identical to the upstream `_ds/nocturne-*/styles.css` so a design-
// system refresh is a straight recopy. nocturne-root.css adds the `.nocturne`
// wrapper class that re-applies the body-level base at a scoped selector so
// the legacy `.layout` ancestor doesn't mask Nocturne's dark ground.
import "./styles/nocturne.css";
import "./styles/nocturne-root.css";
// Phosphor icon fonts — classes `ph ph-<name>` / `ph-fill ph-<name>`. Both
// regular and fill weights are imported so Nocturne markup copied verbatim
// from the .dc.html artifacts renders without per-screen extras.
import "@phosphor-icons/web/regular";
import "@phosphor-icons/web/fill";
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
                                                    {/* Nocturne root wrapper (FE-0): background + text
                                                        defaults flip to Nocturne tokens for the App
                                                        subtree. Header/footer keep the legacy chrome
                                                        until FE-1 moves them under this wrapper. */}
                                                    <div className="nocturne">
                                                        <App/>
                                                    </div>
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
