import {useEffect} from "react";
import style from "../Investments/Investments.module.scss";
import MSNCard from "../../components/MSNCardComponent/MSNCard.tsx";
import BasicCard from "../../components/BasicCard.tsx";
import MSNHome from "../../components/MSNHome/MSNHome.tsx";
import {useMSNContext} from "../../contexts/MSNContext.tsx";
import {fetchSummary} from "../../services/investmentService.ts";

const Investments = () => {
    const {state, dispatch} = useMSNContext();

    // Helper function to fetch and dispatch summaries
    const fetchAndSetSummary = (serviceType: string, key: keyof typeof state.summaries) => {
        fetchSummary(serviceType)
            .then((response) => {
                dispatch({
                    type: "MSNSummarySetter",
                    payload: {[key]: response.data},
                });
            })
            .catch((err) => console.error(`Error fetching ${serviceType} summary:`, err));
    };

    useEffect(() => {
        fetchAndSetSummary("Stocks", "stocks");
        fetchAndSetSummary("NPS", "nps");
        fetchAndSetSummary("Mutual_Funds", "mf");
    }, []);

    const renderCards = () => (
        <>
            <MSNCard title="Stocks" className={style.stockContainer} cardType="stocks"/>
            <MSNCard title="Mutual Funds" className={style.mfContainer} cardType="mf"/>
            <MSNCard title="NPS" className={style.npsContainer} cardType="nps"/>
        </>
    );

    return (
        <div className={style.investmentsParentContainer}>
            <BasicCard className={style.dashboard}>Dashboard</BasicCard>
            <div className={style.cardContainer}>
                {state.selectedCard.stocks || state.selectedCard.mf || state.selectedCard.nps ? (
                    <MSNHome/>
                ) : (
                    renderCards()
                )}
            </div>
        </div>
    );
};

export default Investments;
