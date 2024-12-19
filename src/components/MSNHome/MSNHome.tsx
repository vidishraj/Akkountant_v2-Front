import {useEffect, useState} from "react";
import {ReactSearchAutocomplete} from "react-search-autocomplete";
import {Button, IconButton} from "@mui/material";
import DeleteForeverIcon from '@mui/icons-material/DeleteForever';
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import style from "./MSNHome.module.scss";
import MSNSummary from "./MSNSummary.tsx";
import MSNList from "./MSNList.tsx";
import MSNDetails from "./MSNDetails.tsx";
import ObjectDetailsDialog from "./ObjectDetailsDialog.tsx";
import {useMSNContext} from "../../contexts/MSNContext.tsx";
import {fetchSecurityScheme} from "../../services/investmentService.ts";
import {MSNListResponse, MSNSummaryResponse} from "../../utils/interfaces.ts";
import ConfirmationDialog from "../ConfirmationDialogComponent.tsx";

const MSNHome = () => {

    const {
        state,
        dispatch,
        fetchAndSetSummary,
        fetchAndSetUserSecurities,
        fetchAndSetSearchItems,
        deleteComplete, getServiceType, getContextKey
    } = useMSNContext();
    const [searchItems, setSearchItems] = useState<[]>([]);
    const [detailState, setDetailState] = useState<MSNListResponse | undefined>(undefined);
    const [summaryState, setSummaryState] = useState<MSNSummaryResponse | undefined>(undefined);
    const [listState, setListState] = useState<MSNListResponse[] | undefined>(undefined);
    const [open, setOpen] = useState(false);
    const [schemeData, setSchemeData] = useState<any>({});
    const [showDetails, setShowDetails] = useState(false);
    const [deleteConfirmation, setDeleteConfirmation] = useState(false);

    const deleteAll = () => {
        deleteComplete()
    }
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
        <div style={{minWidth: 300, color: "white", width: "100%", display: "flex", justifyContent: "space-evenly"}}>
            <div style={{width: '80%'}}>
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
            <IconButton style={{backgroundColor: "#121c24", color: "#FAFAFA", border: "2px #29384D solid",}}
                        onClick={() => setDeleteConfirmation(true)}>
                <DeleteForeverIcon/>
            </IconButton>
        </div>
    );

    const renderDetails = () =>
        showDetails && detailState ? (

            <div style={{minWidth: '320px', width: "100%"}} className={style.listBackButton}>
                <div style={{flexBasis: '70%'}}>
                    <MSNDetails isLoading={false} details={detailState}/>
                    {/* Back Button */}
                </div>
                <Button
                    startIcon={<ArrowBackIcon/>}
                    onClick={() => setShowDetails(false)}
                    className={style.backButton}
                >
                    Back
                </Button>
            </div>
        ) : (
            <div style={{minWidth: '320px', width: "100%"}} className={style.listBackButton}>
                <MSNList
                    isLoading={state.loadingState[getContextKey()].list}
                    list={listState || []}
                    onClick={(stockCode: string) => {
                        setShowDetails(true)
                        if (state.selectedCard.nps) {
                            setDetailState(listState?.find((item) => item.info.name === stockCode));
                        } else if (state.selectedCard.mf) {
                            setDetailState(listState?.find((item) => item.info.schemeType === stockCode));
                        } else {
                            setDetailState(listState?.find((item) => item.buyCode === stockCode));
                        }
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
                    {/*<Divider sx={{borderColor: "#E5E8EB", borderWidth: 0.5, width: "100%"}}/>*/}
                    <div className={style.innerSummary}>
                        <MSNSummary isLoading={false}/>
                    </div>
                    {/*<Divider sx={{borderColor: "#E5E8EB", borderWidth: 0.5, width: "100%"}}/>*/}
                    {renderDetails()}
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
                    deleteAll()
                }}
                message={"Are you sure you want to delete all data?"}
            />
        </div>
    );
};

export default MSNHome;
