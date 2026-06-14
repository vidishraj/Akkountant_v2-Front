import {useEffect, useState} from "react";
import style from "./Investments.module.scss";
import MSNCard from "../../components/MSNCardComponent/MSNCard.tsx";
import BasicCard from "../../components/BasicCard.tsx";
import GlobalSummary from "../../components/GlobalSummary.tsx";
import GlobalInvestmentsCharts from "../../components/InvestmentChartsComponent/GlobalInvestmentsCharts.tsx";
import ExtendablePage from "../../components/ExtendableComponent/ExtendablePageComponent.tsx";
import {useMSNContext} from "../../contexts/MSNContext.tsx";

/**
 * Landing route at `/investments` (index of the Investments shell).
 *
 * Layout: dashboard (GlobalSummary + GlobalInvestmentsCharts) stacked ABOVE
 * the asset card grid. Pre-Option-B this was a 50/50 master-detail flex; the
 * sub-route migration drops the detail half from this view entirely — detail
 * now lives at `/investments/:asset`. Personal's stacked-chart layout (no
 * Slick carousel) is preserved verbatim.
 *
 * The mobile collapse via ExtendablePage is kept — small-screen users want
 * the dashboard collapsible so the card grid stays in viewport.
 *
 * ResetCardSelector on mount drains any legacy boolean state from
 * `state.selectedCard` so downstream readers that haven't been migrated to
 * URL-driven asset selection see a coherent "no asset chosen" state. Without
 * this reset, navigating Back from a detail page would briefly leave a stale
 * boolean asserted.
 */
const InvestmentsLanding = () => {
    const {state, dispatch} = useMSNContext();
    const [isSmallScreen, setIsSmallScreen] = useState(window.innerWidth <= 900);

    useEffect(() => {
        dispatch({type: "ResetCardSelector"});
    }, [dispatch]);

    useEffect(() => {
        const handleResize = () => setIsSmallScreen(window.innerWidth <= 900);
        window.addEventListener("resize", handleResize);
        return () => window.removeEventListener("resize", handleResize);
    }, []);

    const renderCards = () => (
        <>
            <MSNCard isLoading={state.loadingState.stocks.summary} title="Stocks" className={style.stockContainer}
                     cardType="stocks"/>
            <MSNCard isLoading={state.loadingState.mf.summary} title="Mutual Funds" className={style.mfContainer}
                     cardType="mf"/>
            <MSNCard isLoading={state.loadingState.nps.summary} title="NPS" className={style.npsContainer}
                     cardType="nps"/>
            <MSNCard isLoading={state.loadingState.epf.summary} title="EPF" className={style.epfContainer}
                     cardType2="epf"/>
            <MSNCard isLoading={state.loadingState.ppf.summary} title="PPF" className={style.epfContainer}
                     cardType2="ppf"/>
            <MSNCard isLoading={state.loadingState.gold.summary} title="Gold" className={style.epfContainer}
                     cardType2="gold"/>
        </>
    );

    return (
        <div className={style.landingLayout}>
            <BasicCard className={style.landingDashboard}>
                {isSmallScreen ? (
                    <ExtendablePage>
                        <GlobalSummary/>
                        <GlobalInvestmentsCharts/>
                    </ExtendablePage>
                ) : (
                    <>
                        <GlobalSummary/>
                        <GlobalInvestmentsCharts/>
                    </>
                )}
            </BasicCard>

            <div className={style.cardContainer}>
                {renderCards()}
            </div>
        </div>
    );
};

export default InvestmentsLanding;
