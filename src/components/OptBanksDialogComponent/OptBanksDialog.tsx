import {
    Dialog,
    DialogTitle,
    DialogContent,
    FormControl,
    Checkbox,
    FormGroup,
    TextField,
    DialogActions,
    FormControlLabel, Button, Box,
} from "@mui/material";
import {fetchOptedBanksPassword} from "../../services/transactionService.ts";
import {useState} from "react";
import {useMessage} from "../../contexts/MessageContext.tsx";

interface OptBanksDialogProps {
    isBankDialogOpen: boolean
    setBankDialogOpen: any
}

const OptBanksDialog: React.FC<OptBanksDialogProps> = (props) => {
    const {isBankDialogOpen, setBankDialogOpen} = props
    const {setPayload} = useMessage();
    const [bankPasswords, setBankPasswords] = useState<{ [key: string]: string }>({});
    const [selectedBanks, setSelectedBanks] = useState<string[]>([]);
    const handleSubmit = async () => {
        const payload = {
            banks: selectedBanks.reduce((acc: any, bank) => {
                if (bankPasswords[bank]) acc[bank] = bankPasswords[bank];
                return acc;
            }, {}),
        };

        try {
            await fetchOptedBanksPassword(payload);
            setPayload({type: "success", message: "Bank passwords submitted successfully!"});
            setBankDialogOpen(false);
        } catch {
            setPayload({type: "error", message: "Failed to submit bank passwords. Please try again."});
        }
    };
    const handleBankToggle = (bank: string) => {
        setSelectedBanks((prevSelected) => {
            const isSelected = prevSelected.includes(bank);

            const updatedBanks = isSelected
                ? prevSelected.filter((b) => b !== bank)
                : [...prevSelected, bank];

            setBankPasswords((prevPasswords) => {
                const updatedPasswords = {...prevPasswords};
                if (!isSelected) {
                    updatedPasswords[bank] = "";
                } else {
                    delete updatedPasswords[bank];
                }
                return updatedPasswords;
            });

            return updatedBanks;
        });
    };
    const handleSelectedBankPassword = (bank: string, password: string) => {
        setBankPasswords((prev) => (
            {
                ...prev,
                [bank]: password,
            }
        ))
    }
    const allPasswordsFilled = selectedBanks.every((bank) => bankPasswords[bank]?.trim() !== "");
    const banks = ["Millenia_Credit", "HDFC_DEBIT", "ICICI_AMAZON_PAY", "YES_BANK_DEBIT", "YES_BANK_ACE", "BOI"];
    return (
        <Dialog open={isBankDialogOpen} onClose={() => setBankDialogOpen(false)} fullWidth PaperProps={{
            sx: {
                backgroundColor: "#121C24",
                color: "#FAFAFA",
                borderRadius: 2,
                padding: 3,
            },
        }}>
            <><DialogTitle>Select Banks</DialogTitle><DialogContent>
                <FormControl component="fieldset">
                    <FormGroup sx={{
                        display: "flex",
                        flexDirection: "column",
                        gap: 1,
                    }}>
                        {banks.map((bank) => (
                            <Box key={bank} sx={{
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "space-between",
                                gap: 1,
                                color: "#FAFAFA",
                                margin: 0
                            }}>
                                <FormControlLabel
                                    key={bank}
                                    sx={{
                                        display: "flex",
                                        alignItems: "center",
                                        color: "#FAFAFA",
                                        margin: 0
                                    }}
                                    control={<Checkbox
                                        checked={selectedBanks.includes(bank)}
                                        onChange={() => handleBankToggle(bank)}
                                        sx={{color: "#FAFAFA"}}/>}
                                    label={bank}/>
                                {selectedBanks.includes(bank) && (
                                    <TextField
                                        value={bankPasswords[bank] || ""}
                                        onChange={(e) => handleSelectedBankPassword(bank, e.target.value)}
                                        placeholder="Enter password *"
                                        type="password"
                                        size="small"
                                        variant="outlined"
                                        sx={{
                                            backgroundColor: "#1E2A36",
                                            borderRadius: 1,
                                            fontSize: "0.5rem",
                                            marginLeft: "2rem",
                                            width: "250px",
                                            input: {color: "#FAFAFA"},
                                        }}/>
                                )}
                            </Box>
                        ))}
                    </FormGroup>
                </FormControl>
            </DialogContent><DialogActions>
                <Button onClick={handleSubmit} variant="contained" disabled={!allPasswordsFilled} sx={{
                    backgroundColor: !allPasswordsFilled ? "red" : "primary.main",
                    '&.Mui-disabled': {
                        backgroundColor: "#1E2A36 !important",
                        color: "grey !important"
                    },
                }}>
                    Done
                </Button>
            </DialogActions></>
        </Dialog>
    )
}

export default OptBanksDialog;