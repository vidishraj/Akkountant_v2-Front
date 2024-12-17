import {useEffect} from "react";
import {TablePagination} from "@mui/material";
import BasicCard from "../../components/BasicCard.tsx";
import TransactionCard from "../../components/TransactionCardComponent/TransactionCard.tsx";
import TransactionFilters from "../../components/TransactionFilterComponent/TransactionFilters.tsx";
import {
    fetchFileDetails,
    fetchOptedBanks,
    fetchTransactions,
} from "../../services/transactionService.ts";
import {useFilterContext} from "../../contexts/FilterContext.tsx";
import CalendarComponent from "../../components/CalendarComponent/Calendar.tsx";
import style from "./Transaction.module.scss";
import FieldSelector from "../../components/ModeSelectorComponent/FieldSelector.tsx";
import {useUser} from "../../contexts/GlobalContext.tsx";
import {useFileFilterContext} from "../../contexts/FileFilterContext.tsx";
import FileDetailsCard from "../../components/FileDetailsCardComponent/FileDetailsCard.tsx";
import FileFilterCompact from "../../components/FileFilterComponent/FileFilterCompact.tsx";
import SortedBy from "../../components/SortComponent.tsx";
import TransactionSummary from "../../components/TransactionSummaryComponent/TransactionSummary.tsx";
import FileSummary from "../../components/FileSummaryComponent/FileSummary.tsx";
import {FileDetails, Transaction} from "../../utils/interfaces.ts";
import {ToastContainer, toast} from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import GoogleComponent from "../../components/GoogleComponent /GoogleComponent.tsx";

const Transactions = () => {
    const {state, dispatch} = useFilterContext();
    const {state: fileState, dispatch: fileDispatch} = useFileFilterContext();
    const {transactionModeSelection, setTransactionMode, setOptedBanks, user} = useUser();

    const refreshTransactions = () => {
        const requestBody = {
            Page: state.page + 1,
            Filter: {
                bank: state.bank || undefined,
                details: state.searchTerm || undefined,
                tag: state.month || undefined,
                source: state.source || undefined,
                dateRange: state.startDate || state.endDate
                    ? {
                        dateFrom: state.startDate,
                        dateTo: state.endDate,
                    }
                    : undefined,
                sorted: {
                    column: state.sortBy.sortBy,
                    order: state.sortBy.sortDirection,
                },
                limit: state.limit,
            },
        };

        fetchTransactions(requestBody)
            .then((result) => {
                dispatch({
                    type: "SET_TRANSACTIONS",
                    payload: {
                        transaction: result.results,
                        credits: result.credit_sum,
                        debits: result.debit_sum,
                    },
                });
                dispatch({type: "SET_TRANSACTION_COUNT", payload: result.total_count});
            })
            .catch((error) => {
                toast.error("Failed to load transactions. Please try again!", {
                    position: "top-right",
                });
                console.error("Error fetching transactions:", error);
            });
    };

    const transactionLengthCheck = () => {
        return state.transactions.transaction.length
    }
    const refreshFileDetails = () => {
        const requestBody = {
            Page: fileState.filePage + 1,
            Filter: {
                bank: fileState.bank || undefined,
                fileName: fileState.fileName || undefined,
                dateRange: fileState.startDate || fileState.endDate
                    ? {
                        dateFrom: fileState.startDate,
                        dateTo: fileState.endDate,
                    }
                    : undefined,
                sorted: {
                    column: fileState.sortBy.sortBy,
                    order: fileState.sortBy.sortDirection,
                },
                limit: fileState.limit,
            },
        };

        fetchFileDetails(requestBody)
            .then((result) => {
                fileDispatch({type: "SET_FILE_DETAILS", payload: result.results});
                fileDispatch({type: "SET_FILE_COUNT", payload: result.total_count});
            })
            .catch((error) => {
                toast.error("Failed to fetch file details. Please try again!", {
                    position: "top-right",
                });
                console.error("Error fetching file details:", error);
            });
    };

    useEffect(() => {
        refreshTransactions();
    }, [state.page, state.sortBy, state.limit, state.source]);

    useEffect(() => {
        refreshFileDetails();
    }, [fileState.filePage, fileState.sortBy, fileState.limit]);

    useEffect(() => {
        fetchOptedBanks()
            .then((response) => setOptedBanks(response))
            .catch((error) => {
                toast.error("Failed to fetch opted banks. Please try again!", {
                    position: "top-right",
                });
                console.error("Error fetching opted banks:", error);
            });
    }, [user]);

    const emptyTransactionBox = () => {
        return (
            <div style={{
                color: "white",
                backgroundColor: "#29384D",
                minHeight: "400px",
                width: "100%",
                display: "flex",
                justifyContent: "center",
                alignItems: "center"

            }}>
                No Transactions Found. Please trigger email checks!
            </div>
        )
    }
    const renderTransactionMode = () => (
        <>
            <div className={style.transactionFilters}>
                <TransactionFilters apply={refreshTransactions}/>
                <TransactionSummary/>
            </div>
            <div className={style.transactionCards}>
                {transactionLengthCheck() === 0 ? emptyTransactionBox() : state.transactions.transaction.map((transaction: Transaction) => (
                    <TransactionCard
                        key={transaction.referenceID}
                        date={transaction.date}
                        description={transaction.details}
                        amount={parseFloat(transaction.amount)}
                        tag={transaction.tag}
                        bank={transaction.bank}
                    />
                ))}
            </div>
            <div className={style.paginationContainer}>
                <SortedBy
                    columns={["date", "amount", "bank", "tag"]}
                    column={state.sortBy.sortBy}
                    order={state.sortBy.sortDirection}
                    orderSetter={(order) =>
                        dispatch({type: "SET_SORT_BY", payload: {...state.sortBy, sortDirection: order}})
                    }
                    columnSetter={(column) =>
                        dispatch({type: "SET_SORT_BY", payload: {...state.sortBy, sortBy: column}})
                    }
                />
                <TablePagination
                    component="div"
                    className={style.pagination}
                    page={state.page}
                    count={state.transactionCount}
                    rowsPerPage={state.limit}
                    onPageChange={(_, newPage) => dispatch({type: "SET_PAGE", payload: newPage})}
                    onRowsPerPageChange={(e) =>
                        dispatch({type: "SET_LIMIT", payload: parseInt(e.target.value) || 100})
                    }
                />
            </div>
        </>
    );

    const renderFileMode = () => (
        <>
            <div className={style.transactionFilters}>
                <FileFilterCompact apply={refreshFileDetails}/>
                <FileSummary/>
            </div>
            <div className={style.transactionCards}>
                {fileState.fileDetails.length === 0 ? emptyTransactionBox() : fileState.fileDetails.map((file: FileDetails) => (
                    <FileDetailsCard
                        key={file.fileID}
                        bank={file.bank}
                        fileName={file.fileName}
                        uploadDate={file.uploadDate}
                        statementCount={file.statementCount}
                        onDownload={() => console.log("Download clicked")}
                        onDelete={() => console.log("Delete clicked")}
                    />
                ))}
            </div>
            <div className={style.paginationContainer}>
                <SortedBy
                    columns={["uploadDate", "fileName", "bank"]}
                    column={fileState.sortBy.sortBy}
                    order={fileState.sortBy.sortDirection}
                    orderSetter={(order) =>
                        fileDispatch({
                            type: "SET_SORT_BY",
                            payload: {...fileState.sortBy, sortDirection: order},
                        })
                    }
                    columnSetter={(column) =>
                        fileDispatch({
                            type: "SET_SORT_BY",
                            payload: {...fileState.sortBy, sortBy: column},
                        })
                    }
                />
                <TablePagination
                    component="div"
                    className={style.pagination}
                    page={fileState.filePage}
                    count={fileState.fileCount}
                    rowsPerPage={fileState.limit}
                    onPageChange={(_, newPage) =>
                        fileDispatch({type: "SET_FILE_PAGE", payload: newPage})
                    }
                    onRowsPerPageChange={(e) =>
                        fileDispatch({type: "SET_LIMIT", payload: parseInt(e.target.value) || 100})
                    }
                />
            </div>
        </>
    );

    return (
        <div className={style.transactionContainer}>
            <ToastContainer toastClassName={style.customToast} bodyClassName={style.customToast}/>
            <BasicCard className={style.summaryCard}>
                <CalendarComponent/>
                <GoogleComponent/>
                <FieldSelector setTransactionMode={setTransactionMode}/>
            </BasicCard>
            <BasicCard className={style.transactionListContainer}>
                {transactionModeSelection ? renderTransactionMode() : renderFileMode()}
            </BasicCard>
        </div>
    );
};

export default Transactions;
