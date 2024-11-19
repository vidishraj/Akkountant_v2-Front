/*
* Summary box on the right side along with info about statements parsed
* and statments saved.
* it will also have a summary Box
* '2023-06-18', '', '260.00', '', '1WwEjSUzbHhu3TBhLcflp0l_NruCgydW_', 'statement', 'HDFC_DEBIT', 'AwKnpKEPmEhQnpc2kJAnsEikOBK2'

* */
import BasicCard from "../components/BasicCard.tsx";
import TransactionCard from "../components/TransactionCard.tsx";
import TransactionFilters from "../components/TransactionFilters.tsx";
import {useEffect, useState} from "react";
import {TablePagination} from "@mui/material";
import {fetchTransactions, Transaction} from "../services/transactionService.ts";
import {useFilterContext} from "../contexts/FilterContext.tsx";


const Transactions = () => {

    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [page, setPage] = useState(0);
    const [count, setCount] = useState<number>(0);
    const {state} = useFilterContext();

    function checkInput(input: string) {
        return input === "" || input === undefined ? undefined : input

    }

    function refreshTransactions() {
        let requestBody = {
            Page: page + 1,
            Filter: {
                bank: checkInput(state.bank),
                details: checkInput(state.searchTerm),
                tag: checkInput(state.month),
                dateRange: {
                    dateFrom: checkInput(state.startDate),
                    dateTo: checkInput(state.endDate),
                },
            },
        }
        if (!requestBody.Filter.dateRange.dateTo && !requestBody.Filter.dateRange.dateFrom) {
            // @ts-ignore
            delete requestBody.Filter.dateRange;
        }

        requestBody.Page = page + 1
        fetchTransactions(requestBody).then((result) => {
            console.log(result);
            setTransactions(result.results);
            setCount(result.total_count);
        })

    }

    useEffect(() => {
        refreshTransactions()
    }, [page]);

    return (
        <div style={{display: 'flex', flexWrap: 'nowrap', height: '100vh'}}>
            <BasicCard style={{flexBasis: '50%'}}>
                Check
            </BasicCard>
            <BasicCard style={{
                display: 'flex',
                flexDirection: 'column',
                flexWrap: 'nowrap',
                height: '100vh',
                flexBasis: '50%'
            }}>
                <BasicCard style={{flexBasis: '20%'}}>
                    <TransactionFilters apply={() => {
                        refreshTransactions()
                    }}/>
                </BasicCard>
                <div style={{overflow: 'scroll', flexBasis: '80%'}}>
                    {
                        transactions && transactions.map((transaction: Transaction) => (
                            <TransactionCard
                                date={transaction.date}
                                description={transaction.details}
                                amount={parseFloat(transaction.amount)}
                                tag={transaction.tag}
                                bank={transaction.bank}
                            />
                        ))
                    }

                </div>
                <BasicCard style={{}}>
                    <TablePagination page={page} count={count} rowsPerPage={100} onPageChange={(_event, page) => {
                        setPage(page)
                    }}/>
                </BasicCard>
            </BasicCard>
        </div>
    )
}

export default Transactions;