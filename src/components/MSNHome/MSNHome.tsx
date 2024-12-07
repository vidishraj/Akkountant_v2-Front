import {useEffect, useState} from "react";
import {ReactSearchAutocomplete} from "react-search-autocomplete";
import {Button, Divider} from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import style from "./MSNHome.module.scss";
import MSNSummary from "./MSNSummary.tsx";
import MSNList from "./MSNList.tsx";
import MSNDetails from "./MSNDetails.tsx";
import ObjectDetailsDialog from "./ObjectDetailsDialog.tsx";
import {useMSNContext} from "../../contexts/MSNContext.tsx";
import {fetchSecuritiesList, fetchSecurityScheme, fetchUserSecurities} from "../../services/investmentService.ts";
import {MSNListResponse, MSNSummaryResponse} from "../../utils/interfaces.ts";

const MSNHome = () => {
    const {state, dispatch} = useMSNContext();
    const [searchItems, setSearchItems] = useState<[]>([]);
    const [detailState, setDetailState] = useState<MSNListResponse | undefined>(undefined);
    const [summaryState, setSummaryState] = useState<MSNSummaryResponse | undefined>(undefined);
    const [listState, setListState] = useState<MSNListResponse[] | undefined>(undefined);
    const [open, setOpen] = useState(false);
    const [schemeData, setSchemeData] = useState<any>({});
    const [showDetails, setShowDetails] = useState(false);

    // Utility functions
    const getServiceType = () => (state.selectedCard.mf ? "Mutual_Funds" : state.selectedCard.stocks ? "Stocks" : "NPS");
    const getContextKey = () => (state.selectedCard.mf ? "mf" : state.selectedCard.stocks ? "stocks" : "nps");

    // Effect to set state based on selected card
    useEffect(() => {
        const contextKey = getContextKey();
        setSummaryState(state.summaries[contextKey]);
        setListState(state.lists[contextKey]);
    }, []);

    // Fetch and set user securities and search items
    useEffect(() => {
        const serviceType = getServiceType();
        const contextKey = getContextKey();

        const fetchAndSetUserSecurities = async () => {
            try {
                const response = await fetchUserSecurities(serviceType);
                dispatch({
                    type: "MSNListSetter",
                    payload: {...state.lists, [contextKey]: response.data},
                });
            } catch (error) {
                console.error(`Error fetching user securities for ${serviceType}:`, error);
            }
        };

        const fetchAndSetSearchItems = async () => {
            try {
                const response = await fetchSecuritiesList(serviceType);
                if (response.status === 200 && Array.isArray(response.data.data)) {
                    const searchTypeList = response.data.data.map((item: any, index: number) => ({
                        id: index,
                        name: contextKey === "stocks" ? item.stockCode : contextKey === "nps" ? item.name : item.schemeName,
                        code: contextKey === "mf" ? item.schemeCode : undefined,
                    }));
                    setSearchItems(searchTypeList);
                }
            } catch (error) {
                console.error(`Error fetching securities list for ${serviceType}:`, error);
            }
        };

        fetchAndSetUserSecurities();
        fetchAndSetSearchItems();
    }, []);

    // Handlers
    const handleOnSelect = async (searchItem: any) => {
        try {
            const response = await fetchSecurityScheme(getServiceType(), getContextKey() === "mf" ? searchItem.code : searchItem.name);
            setOpen(true);
            setSchemeData(response.data);
        } catch (error) {
            console.error("Error fetching security scheme:", error);
        }
    };

    const renderSearchBar = () => (
        <div style={{width: 300, color: "white"}}>
            <ReactSearchAutocomplete
                styling={{
                    backgroundColor: "#29384D",
                    color: "#FAFAFA !important",
                    border: "0",
                    iconColor: "white",
                    lineColor: "white",
                    hoverBackgroundColor: "#121c24",
                }}
                resultStringKeyName="name"
                items={searchItems}
                onSelect={handleOnSelect}
            />
        </div>
    );

    const renderDetails = () =>
        showDetails && detailState ? (
            <MSNDetails goBack={() => setShowDetails(false)} details={detailState}/>
        ) : (
            <div style={{width: "100%"}} onClick={() => setShowDetails(true)}>
                <MSNList
                    list={listState || []}
                    onClick={(stockCode: string) => {
                        setDetailState(listState?.find((item) => item.buyCode === stockCode));
                    }}
                />
                <Button
                    startIcon={<ArrowBackIcon/>}
                    onClick={() => dispatch({type: "ResetCardSelector"})}
                    className={style.backButton}
                >
                    Back
                </Button>
            </div>
        );

    return (
        <div className={style.container}>
            {summaryState && listState ? (
                <>
                    {renderSearchBar()}
                    <Divider sx={{borderColor: "#E5E8EB", borderWidth: 0.5, width: "100%"}}/>
                    <div className={style.summary}>
                        <MSNSummary/>
                    </div>
                    <Divider sx={{borderColor: "#E5E8EB", borderWidth: 0.5, width: "100%"}}/>
                    {renderDetails()}
                </>
            ) : null}
            <ObjectDetailsDialog
                open={open}
                onClose={() => setOpen(false)}
                title={schemeData?.companyName || ""}
                data={schemeData}
            />
        </div>
    );
};

export default MSNHome;
