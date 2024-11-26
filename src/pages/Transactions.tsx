import {useEffect} from "react";
import {TablePagination} from "@mui/material";
import BasicCard from "../components/BasicCard";
import TransactionCard from "../components/TransactionCardComponent/TransactionCard.tsx";
import TransactionFilters from "../components/TransactionFilterComponent/TransactionFilters.tsx";
import {
    fetchFileDetails,
    fetchOptedBanks,
    fetchTransactions,
} from "../services/transactionService";
import {useFilterContext} from "../contexts/FilterContext";
import GoogleComponent from "../components/GoogleComponent /GoogleComponent.tsx";
import CalendarComponent from "../components/CalendarComponent/Calendar.tsx";
import style from "./Transaction.module.scss";
import FieldSelector from "../components/ModeSelectorComponent/FieldSelector.tsx";
import {useUser} from "../contexts/GlobalContext.tsx";
import {useFileFilterContext} from "../contexts/FileFilterContext.tsx";
import FileDetailsCard from "../components/FileDetailsCardComponent/FileDetailsCard.tsx";
import FileFilterCompact from "../components/FileFilterComponent/FileFilterCompact.tsx";
import SortedBy from "../components/SortComponent.tsx";
import TransactionSummary from "../components/TransactionSummaryComponent/TransactionSummary.tsx";
import FileSummary from "../components/FileSummaryComponent/FileSummary.tsx";
import {FileDetails, Transaction} from "../utils/interfaces.ts"; // Import the SortedBy component
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

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
                dateRange: {
                    dateFrom: state.startDate || undefined,
                    dateTo: state.endDate || undefined,
                },
                sorted: {column: state.sortBy.sortBy, order: state.sortBy.sortDirection},
                limit: state.limit
            },
        };

        if (!requestBody.Filter.dateRange.dateFrom && !requestBody.Filter.dateRange.dateTo) {
            //@ts-ignore
            delete requestBody.Filter.dateRange;
        }

        fetchTransactions(requestBody).then((result) => {
            dispatch({
                type: "SET_TRANSACTIONS",
                payload: {transaction: result.results, credits: result.credit_sum, debits: result.debit_sum}
            });
            dispatch({type: "SET_TRANSACTION_COUNT", payload: result.total_count});
        })
        .catch((error)=>{
            toast.error("Failed to load transactions. Please try again!",{
                position:"top-right"
            });
            console.error("Error fetching the trasactions", error);
        })
    };

    const refreshFileDetails = () => {
        const requestBody = {
            Page: fileState.filePage + 1,
            Filter: {
                bank: fileState.bank || undefined,
                fileName: fileState.fileName || undefined,
                dateRange: {
                    dateFrom: fileState.startDate || undefined,
                    dateTo: fileState.endDate || undefined,
                },
                sorted: {column: fileState.sortBy.sortBy, order: fileState.sortBy.sortDirection},
                limit: state.limit
            },
        };

        if (!requestBody.Filter.dateRange.dateFrom && !requestBody.Filter.dateRange.dateTo) {
            //@ts-ignore
            delete requestBody.Filter.dateRange;
        }

        fetchFileDetails(requestBody).then((result) => {
            fileDispatch({type: "SET_FILE_DETAILS", payload: result.results});
            fileDispatch({type: "SET_FILE_COUNT", payload: result.total_count});
        })
        .catch((error)=>{
            toast.error("Failed to fetch file details. Please try again!",{
                position:"top-right"
            });
            console.error("Error fetching the file details", error);
        })
    };
    useEffect(() => {
        refreshTransactions();
    }, [state.transactionCount, state.page, state.sortBy, state.limit, state.source]);

    useEffect(() => {
        refreshFileDetails();
    }, [fileState.filePage, fileState.sortBy, fileState.limit]);

    useEffect(() => {
        fetchOptedBanks().then((response) => {
            setOptedBanks(response);
        })
        .catch((error)=>{
            toast.error("Failed to fetch opted banks. Please try again!",{
                position:"top-right"
            });
            console.error("Error fetching opted banks", error);
        })
    }, [user]);

    const showToast = () => {
        toast.success('This is a success toast!', {
          position: "top-right",
        });
        console.log("Toast clicked");
      };

    return (
        <div className={style.transactionContainer}>
            <ToastContainer toastClassName={style.customToast} bodyClassName={style.customToast}/>
           
            <BasicCard className={style.summaryCard}>
                <CalendarComponent/>
                <GoogleComponent/>
                <FieldSelector setTransactionMode={setTransactionMode}/>
            </BasicCard>

            <BasicCard className={style.transactionListContainer}>
                {transactionModeSelection ? (
                    <>
                        <div className={style.transactionFilters}>
                            <TransactionFilters apply={refreshTransactions}/>
                            <TransactionSummary/>
                        </div>
                        <div className={style.transactionCards}>
                            {state.transactions.transaction.map((transaction: Transaction) => (
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
                        <div style={{
                            display: 'flex',
                            flexDirection: 'row',
                            alignItems: 'flex-end',
                            justifyContent: 'flex-end'
                        }}>
                            <SortedBy
                                columns={['date', 'amount', 'bank', 'tag']}
                                column={state.sortBy.sortBy}
                                order={state.sortBy.sortDirection}

                                orderSetter={(item) => {
                                    dispatch({
                                        type: 'SET_SORT_BY',
                                        payload: {...state.sortBy, sortDirection: item}
                                    })
                                }}
                                columnSetter={(item) => {
                                    dispatch({
                                        type: 'SET_SORT_BY',
                                        payload: {...state.sortBy, sortBy: item}
                                    })
                                }}
                            />
                            <TablePagination
                                onRowsPerPageChange={(item) => {
                                    const limit = parseInt(item.target.value);
                                    console.log(limit)
                                    dispatch({
                                        type: "SET_LIMIT",
                                        payload: limit ? limit : 100
                                    })
                                }}
                                component={'div'}
                                className={style.pagination}
                                page={state.page}
                                count={state.transactionCount}
                                rowsPerPage={state.limit}
                                onPageChange={(_, newPage) => dispatch({type: "SET_PAGE", payload: newPage})}
                            />
                        </div>
                    </>
                ) : (
                    <>
                        <div className={style.transactionFilters}>
                            <FileFilterCompact apply={refreshFileDetails}/>
                            <FileSummary/>
                        </div>
                        <div className={style.transactionCards}>
                            {fileState.fileDetails.map((file: FileDetails) => (
                                <FileDetailsCard
                                    key={`${file.fileID}`}
                                    bank={file.bank}
                                    fileName={file.fileName}
                                    uploadDate={file.uploadDate}
                                    statementCount={file.statementCount}
                                    onDownload={() => console.log("Download clicked")}
                                    onDelete={() => console.log("Delete clicked")}
                                />
                            ))}
                        </div>
                        <div style={{
                            display: 'flex',
                            flexDirection: 'row',
                            alignItems: 'flex-end',
                            justifyContent: 'flex-end'
                        }}>
                            <SortedBy
                                columns={['uploadDate', 'fileName', 'bank']}
                                column={fileState.sortBy.sortBy}
                                order={fileState.sortBy.sortDirection}
                                orderSetter={(item) => {
                                    fileDispatch({
                                        type: 'SET_SORT_BY',
                                        payload: {...fileState.sortBy, sortDirection: item}
                                    })
                                }}
                                columnSetter={(item) => {
                                    fileDispatch({
                                        type: 'SET_SORT_BY',
                                        payload: {...fileState.sortBy, sortBy: item}
                                    })
                                }}
                            />
                            <TablePagination
                                onRowsPerPageChange={(item) => {
                                    const limit = parseInt(item.target.value);
                                    fileDispatch({
                                        type: "SET_LIMIT",
                                        payload: limit ? limit : 100
                                    })
                                }}
                                component={'div'}
                                className={style.pagination}
                                page={fileState.filePage}
                                count={fileState.fileCount}
                                rowsPerPage={fileState.limit}
                                onPageChange={(_, newPage) => fileDispatch({type: "SET_FILE_PAGE", payload: newPage})}
                            />
                        </div>
                    </>
                )}
            </BasicCard>
        </div>
    );
};

export default Transactions;
