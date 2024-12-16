import {useEffect} from "react";
import style from "../Investments/Investments.module.scss";
import MSNCard from "../../components/MSNCardComponent/MSNCard.tsx";
import BasicCard from "../../components/BasicCard.tsx";
import MSNHome from "../../components/MSNHome/MSNHome.tsx";
import {useMSNContext} from "../../contexts/MSNContext.tsx";
import EPGHome from "../../components/EPGHomeComponent/EPGHome.tsx";

const Investments = () => {
    const {state, fetchAndSetSummary, AllInfoForEpf} = useMSNContext();

    useEffect(() => {
        fetchAndSetSummary("Stocks", false);
        fetchAndSetSummary("NPS", false);
        fetchAndSetSummary("Mutual_Funds", false);
        AllInfoForEpf("EPF", false)
        AllInfoForEpf("Gold", false)
        AllInfoForEpf("PF", false)
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
        <div className={style.investmentsParentContainer}>
            <BasicCard className={style.dashboard}>Dashboard</BasicCard>
            <div className={style.cardContainer}>
                {state.selectedCard.stocks || state.selectedCard.mf || state.selectedCard.nps ? (
                    <MSNHome/>
                ) : state.selectedCard.gold || state.selectedCard.epf || state.selectedCard.ppf ? <EPGHome/> : (
                    renderCards()
                )}
            </div>
        </div>
    );
};

export default Investments;
