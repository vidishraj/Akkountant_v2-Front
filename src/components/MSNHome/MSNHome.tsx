import {useEffect, useState} from "react";
import {ReactSearchAutocomplete} from "react-search-autocomplete";
import {Button, IconButton, Tabs, Tab} from "@mui/material";
import DeleteForeverIcon from '@mui/icons-material/DeleteForever';
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import style from "./MSNHome.module.scss";
import MSNSummary from "./MSNSummary.tsx";
import MSNList from "./MSNList.tsx";
import MSNDetails from "./MSNDetails.tsx";
import RealizedPnL from "./RealizedPnL.tsx";
import FOSection from "./FOSection.tsx";
import ObjectDetailsDialog from "./ObjectDetailsDialog.tsx";
import {useMSNContext} from "../../contexts/MSNContext.tsx";
import {fetchSecurityScheme} from "../../services/investmentService.ts";
import {MSNListResponse, MSNSummaryResponse} from "../../utils/interfaces.ts";
import ConfirmationDialog from "../ConfirmationDialogComponent.tsx";

const MSNHome = () => {

    const {
        state,
        dispatch,
        fetchAndSetUserSecurities,
        fetchAndSetSearchItems,
        deleteComplete, getServiceType, getContextKey,
        fetchAndSetRealizedPnL,
        fetchAndSetFOSummary,
    } = useMSNContext();
    const [searchItems, setSearchItems] = useState<MSNListResponse[]>([]);
    const [detailState, setDetailState] = useState<MSNListResponse | undefined>(undefined);
    const [summaryState, setSummaryState] = useState<MSNSummaryResponse | undefined>(undefined);
    const [listState, setListState] = useState<MSNListResponse[] | undefined>(undefined);
    const [open, setOpen] = useState(false);
    const [schemeData, setSchemeData] = useState<any>({});
    const [showDetails, setShowDetails] = useState(false);
    const [deleteConfirmation, setDeleteConfirmation] = useState(false);
    const [stocksTab, setStocksTab] = useState(0);

    // Effect to set state based on selected card
    useEffect(() => {
        const contextKey = getContextKey();
        setSummaryState(state.summaries[contextKey]);
        setListState(state.lists[contextKey]);
    }, [state]);

    // Fetch and set user securities and search items
    useEffect(() => {
        fetchAndSetUserSecurities();
        fetchAndSetSearchItems().then((response) => {
            setSearchItems(response)
        }).catch(() => {
            setSearchItems([]);
        })
    }, []);

    // Fetch historical data when stocks card is selected
    useEffect(() => {
        if (state.selectedCard.stocks) {
            fetchAndSetRealizedPnL();
            fetchAndSetFOSummary();
        }
    }, [state.selectedCard.stocks]);

    // Handlers
    const handleOnSelect = async (searchItem: any) => {
        try {
            const contextKey = getContextKey();
            const response = await fetchSecurityScheme(getServiceType(), contextKey === "mf" || contextKey === "nps" ? searchItem.code : searchItem.name);
            setOpen(true);
            setSchemeData(response.data);
        } catch (error) {
            console.error("Error fetching security scheme:", error);
        }
    };

    const renderSearchBar = () => (
        <div style={{minWidth: 300, color: "white", width: "100%", display: "flex", alignItems: "center", gap: 8}}>
            <Button
                startIcon={<ArrowBackIcon/>}
                onClick={() => {
                    if (showDetails) {
                        setShowDetails(false);
                    } else {
                        dispatch({type: "ResetCardSelector"});
                        setStocksTab(0);
                    }
                }}
                className={style.backButton}
            >
                Back
            </Button>
            <div style={{flex: 1}}>
                <ReactSearchAutocomplete
                    styling={{
                        backgroundColor: "#29384D",
                        color: "#FAFAFA !important",
                        border: "0",
                        iconColor: "white",
                        borderRadius: '15px',
                        lineColor: "white",
                        hoverBackgroundColor: "#121c24",
                        zIndex: 50
                    }}
                    resultStringKeyName="name"
                    items={searchItems}
                    onSelect={handleOnSelect}
                />
            </div>
            <IconButton style={{backgroundColor: "#121c24", color: "#FAFAFA", border: "2px #29384D solid"}}
                        onClick={() => setDeleteConfirmation(true)}>
                <DeleteForeverIcon/>
            </IconButton>
        </div>
    );

    const renderStocksTabContent = () => {
        switch (stocksTab) {
            case 0:
                return (
                    <MSNList
                        isLoading={state.loadingState[getContextKey()].list}
                        list={listState || []}
                        onClick={(stockCode: string) => {
                            setShowDetails(true)
                            setDetailState(listState?.find((item) => item.buyCode === stockCode));
                        }}
                    />
                );
            case 1:
                return <RealizedPnL />;
            case 2:
                return <FOSection />;
            default:
                return null;
        }
    };

    const renderDetails = () =>
        showDetails && detailState ? (
            <div style={{minWidth: '320px'}} className={style.listBackButton}>
                <MSNDetails isLoading={false} details={detailState}/>
            </div>
        ) : (
            <div style={{minWidth: '320px'}} className={style.listBackButton}>
                {state.selectedCard.stocks ? (
                    <>
                        <Tabs
                            value={stocksTab}
                            onChange={(_e, newValue) => setStocksTab(newValue)}
                            className={style.stocksTabs}
                            variant="fullWidth"
                        >
                            <Tab label="Holdings" />
                            <Tab label="Equity History" />
                            <Tab label="F&O History" />
                        </Tabs>
                        {renderStocksTabContent()}
                    </>
                ) : (
                    <MSNList
                        isLoading={state.loadingState[getContextKey()].list}
                        list={listState || []}
                        onClick={(stockCode: string) => {
                            setShowDetails(true)
                            if (state.selectedCard.nps) {
                                setDetailState(listState?.find((item) => item.info.name === stockCode));
                            } else if (state.selectedCard.mf) {
                                setDetailState(listState?.find((item) => item.info.companyName === stockCode));
                            } else {
                                setDetailState(listState?.find((item) => item.buyCode === stockCode));
                            }
                        }}
                    />
                )}
            </div>
        );

    return (
        <div className={style.container}>
            {summaryState && listState ? (
                <>
                    {renderSearchBar()}
                    {/*<Divider sx={{borderColor: "#E5E8EB", borderWidth: 0.5, width: "100%"}}/>*/}
                    <div className={style.innerSummary}>
                        <MSNSummary isLoading={false}/>
                    </div>
                    {/*<Divider sx={{borderColor: "#E5E8EB", borderWidth: 0.5, width: "100%"}}/>*/}
                    <div style={{width: '100%', height: '100%'}}>
                        {renderDetails()}
                    </div>
                </>
            ) : null}
            <ObjectDetailsDialog
                open={open}
                onClose={() => setOpen(false)}
                title={schemeData?.companyName || ""}
                data={schemeData}
            />
            <ConfirmationDialog
                open={deleteConfirmation}
                onCancel={() => setDeleteConfirmation(false)}
                onSubmit={() => {
                    setDeleteConfirmation(false)
                    deleteComplete()
                }}
                message={"Are you sure you want to delete all data?"}
            />
        </div>
    );
};

export default MSNHome;
