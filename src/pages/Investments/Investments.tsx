import {useEffect, useRef, useState} from "react";
import style from "../Investments/Investments.module.scss";
import MSNCard from "../../components/MSNCardComponent/MSNCard.tsx";
import BasicCard from "../../components/BasicCard.tsx";
import MSNHome from "../../components/MSNHome/MSNHome.tsx";
import {useMSNContext} from "../../contexts/MSNContext.tsx";
import EPGHome from "../../components/EPGHomeComponent/EPGHome.tsx";
import GlobalSummary from "../../components/GlobalSummary.tsx";
import GlobalInvestmentsCharts from "../../components/InvestmentChartsComponent/GlobalInvestmentsCharts.tsx";
import ExtendablePage from "../../components/ExtendableComponent/ExtendablePageComponent.tsx";

const Investments = () => {
    const {state, fetchAndSetSummary, AllInfoForEpf} = useMSNContext();
    const [isSmallScreen, setIsSmallScreen] = useState(window.innerWidth <= 900);

    useEffect(() => {
        fetchAndSetSummary("Stocks", false);
        fetchAndSetSummary("NPS", false);
        fetchAndSetSummary("Mutual_Funds", false);
        AllInfoForEpf("EPF", false);
        AllInfoForEpf("Gold", false);
        AllInfoForEpf("PF", false);

        // Add a resize event listener to handle screen size changes
        const handleResize = () => {
            setIsSmallScreen(window.innerWidth <= 900);
        };

        window.addEventListener("resize", handleResize);

        // Clean up the event listener
        return () => {
            window.removeEventListener("resize", handleResize);
        };
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

    const homeRef = useRef<any>(null);
    const dashboard = useRef<any>(null);
    useEffect(() => {
        if (isSmallScreen) {
            const oneSelected = (state.selectedCard.stocks || state.selectedCard.mf || state.selectedCard.nps ||
                state.selectedCard.epf || state.selectedCard.gold || state.selectedCard.ppf)
            if (homeRef.current && oneSelected) {
                homeRef.current?.scrollIntoView({behavior: 'smooth'});
            } else if (!oneSelected) {
                dashboard.current?.scrollIntoView({behavior: 'smooth'});
            }
        }
    }, [state]);
    return (
        <div className={style.investmentsParentContainer} ref={dashboard}>
            <BasicCard className={style.dashboard}>
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

            <div className={style.cardContainer} ref={homeRef}>
                {state.selectedCard.stocks || state.selectedCard.mf || state.selectedCard.nps ? (
                    <MSNHome/>
                ) : state.selectedCard.gold || state.selectedCard.epf || state.selectedCard.ppf ? (
                    <EPGHome/>
                ) : (
                    renderCards()
                )}
            </div>
        </div>
    );
};

export default Investments;
