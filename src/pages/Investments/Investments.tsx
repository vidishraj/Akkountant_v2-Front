import {useCallback, useEffect} from "react";
import {Outlet} from "react-router-dom";
import style from "../Investments/Investments.module.scss";
import {useMSNContext} from "../../contexts/MSNContext.tsx";
import {useInvestmentSummaries} from "../../hooks/useInvestmentSummaries.ts";
import AgentChat from "../../components/AgentChat/AgentChat.tsx";

/**
 * Shell for the /investments route tree (hq-6hos Option B, re-ported onto
 * Personal — bc52120 was the master-line version).
 *
 * Owns three things that must persist across landing ↔ detail navigation:
 *   1. The initial summary fetches (Stocks/NPS/MF/EPF/Gold/PF/FO/RealizedPnL)
 *   2. The AgentChat overlay (otherwise drawer state resets on every nav)
 *   3. The investments-page-level container className (so SCSS scope is stable)
 *
 * Renders <Outlet/> for the matched child route:
 *   index           → InvestmentsLanding (dashboard + asset card grid)
 *   :asset          → InvestmentDetail   (single-asset drill-in, URL-driven)
 *
 * Note: the small-screen scroll-into-view effect from the pre-Option-B
 * in-place pattern is intentionally dropped — under sub-routing each view is
 * its own page; the browser handles scroll position natively on navigation.
 */
const Investments = () => {
    const {fetchAndSetSummary, AllInfoForEpf, fetchAndSetFOSummary, fetchAndSetRealizedPnL} = useMSNContext();

    // ak-s74k: the six asset summaries load through the shared hook so Home,
    // Wealth Digest and Investments track the same per-asset load status.
    // refreshOnMount keeps this page's existing fetch-all-on-visit behaviour.
    useInvestmentSummaries({refreshOnMount: true});

    useEffect(() => {
        fetchAndSetFOSummary(false);
        fetchAndSetRealizedPnL(false);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const handleAgentMutation = useCallback(() => {
        fetchAndSetSummary("Stocks", false);
        fetchAndSetSummary("NPS", false);
        fetchAndSetSummary("Mutual_Funds", false);
        AllInfoForEpf("EPF", false);
        AllInfoForEpf("Gold", false);
        AllInfoForEpf("PF", false);
    }, [fetchAndSetSummary, AllInfoForEpf]);

    return (
        <div className={style.investmentsParentContainer}>
            <Outlet/>
            <AgentChat agentType="investment" onMutation={handleAgentMutation}/>
        </div>
    );
};

export default Investments;
