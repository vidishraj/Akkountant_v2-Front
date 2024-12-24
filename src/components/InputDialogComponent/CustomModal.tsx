import React, {useState} from "react";
import {
    Box,
    Button,
    Dialog,
    DialogContent,
    DialogTitle,
    FormControl,
    InputLabel,
    MenuItem,
    Select,
    TextField,
} from "@mui/material";
import styles from "./CustomModal.module.scss";

type Props = {
    title: string;
    open: boolean;
    onCancel: () => void;
    onSubmit: (formData: FormDataType) => void;
    cardType: "mf" | "gold" | string | undefined;
    maxNav?: number;
};

type FormDataType = {
    date: string;
    nav: string;
    quantity: string;
    description: string;
    amount: string;
    goldCarat: string;
};

const CustomModal: React.FC<Props> = ({
                                          title,
                                          open,
                                          onCancel,
                                          onSubmit,
                                          cardType,
                                          maxNav,
                                      }) => {
    const [formData, setFormData] = useState<FormDataType>({
        date: "",
        nav: "",
        quantity: "",
        description: "",
        amount: "",
        goldCarat: "18 carat",
    });

    const [errors, setErrors] = useState<Partial<FormDataType>>({});

    const handleInputChange = (field: keyof FormDataType, value: string) => {
        setFormData((prev) => ({...prev, [field]: value}));
        setErrors((prev) => ({...prev, [field]: ""})); // Clear error on input change
    };

    const validateForm = () => {
        const newErrors: Partial<FormDataType> = {};

        if (!formData.date) newErrors.date = "Date is required.";

        if (cardType === "mf") {
            if (!formData.nav) newErrors.nav = "NAV is required.";
            if (!formData.quantity) newErrors.quantity = "Quantity is required.";
        } else {
            if (!formData.description) newErrors.description = "Description is required.";
            if (cardType === "gold" && !formData.quantity) {
                newErrors.quantity = "Quantity is required.";
            }
            if (!formData.amount) newErrors.amount = "Amount is required.";
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleFormSubmit = () => {
        if (validateForm()) {
            const formattedDate = new Date(formData.date)
                .toISOString()
                .split("T")[0]
                .split("-")
                .reverse()
                .join("-");
            onSubmit({...formData, date: formattedDate});
        }
    };

    return (
        <Dialog
            open={open}
            onClose={(e: any) => {
                e.stopPropagation();
                onCancel()
            }}
            fullWidth
            maxWidth="sm"
            className={styles.dialog}
        >
            <DialogTitle className={styles.dialogTitle}>{title}</DialogTitle>
            <DialogContent className={styles.dialogContent}>
                <Box className={styles.formContainer}>
                    {/* Common Date Field */}
                    <TextField
                        label="Date"
                        type="date"
                        value={formData.date}
                        onChange={(e) => handleInputChange("date", e.target.value)}
                        InputLabelProps={{shrink: true}}
                        fullWidth
                        InputProps={{style: {color: 'white'}}}
                        className={styles.inputField}
                        error={!!errors.date}
                        helperText={errors.date}
                    />

                    {cardType === "mf" && (
                        <>
                            {/* NAV Field */}
                            <TextField
                                label="NAV"
                                type="number"
                                value={formData.nav}
                                onChange={(e) => handleInputChange("nav", e.target.value)}
                                InputProps={{inputProps: {min: 0, max: maxNav, style: {color: 'white'}}}}
                                fullWidth
                                className={styles.inputField}
                                error={!!errors.nav}
                                helperText={errors.nav}
                            />

                            {/* Quantity Field */}
                            <TextField
                                label="Quantity"
                                type="number"
                                value={formData.quantity}
                                onChange={(e) => handleInputChange("quantity", e.target.value)}
                                InputProps={{inputProps: {min: 0, step: 0.01}, style: {color: 'white'}}}
                                fullWidth
                                className={styles.inputField}
                                error={!!errors.quantity}
                                helperText={errors.quantity}
                            />
                        </>
                    )}

                    {cardType !== "mf" && (
                        <>
                            {/* Description Field */}
                            <TextField
                                label="Description"
                                type="text"
                                value={formData.description}
                                onChange={(e) => handleInputChange("description", e.target.value)}
                                fullWidth
                                InputProps={{style: {color: 'white'}}}
                                className={styles.inputField}
                                error={!!errors.description}
                                helperText={errors.description}
                            />

                            {/* Amount Field */}
                            <TextField
                                label="Amount"
                                type="number"
                                value={formData.amount}
                                onChange={(e) => handleInputChange("amount", e.target.value)}
                                InputProps={{inputProps: {min: 0, step: 0.01}, style: {color: 'white'}}}
                                fullWidth
                                className={styles.inputField}
                                error={!!errors.amount}
                                helperText={errors.amount}
                            />

                            {/* Gold-Specific Fields */}
                            {cardType === "gold" && (
                                <>
                                    <TextField
                                        label="Quantity"
                                        type="number"
                                        value={formData.quantity}
                                        onChange={(e) => handleInputChange("quantity", e.target.value)}
                                        InputProps={{inputProps: {min: 0, step: 0.01}, style: {color: 'white'}}}
                                        fullWidth
                                        className={styles.inputField}
                                        error={!!errors.quantity}
                                        helperText={errors.quantity}
                                    />

                                    <FormControl fullWidth className={styles.inputField}>
                                        <InputLabel id="gold-carat-label">Gold Carat</InputLabel>
                                        <Select
                                            labelId="gold-carat-label"
                                            value={formData.goldCarat}
                                            onChange={(e) => handleInputChange("goldCarat", e.target.value)}
                                        >
                                            <MenuItem value="18 carat">18 carat</MenuItem>
                                            <MenuItem value="22 carat">22 carat</MenuItem>
                                            <MenuItem value="24 carat">24 carat</MenuItem>
                                        </Select>
                                    </FormControl>
                                </>
                            )}
                        </>
                    )}
                </Box>
            </DialogContent>
            <Box className={styles.dialogActions}>
                <Button
                    variant="outlined"
                    onClick={(e) => {

                        e.stopPropagation();
                        onCancel()
                    }}
                    className={styles.cancelButton}
                >
                    Cancel
                </Button>
                <Button
                    variant="contained"
                    color="primary"
                    onClick={(e: any) => {
                        e.stopPropagation();
                        handleFormSubmit();
                    }}
                    className={styles.submitButton}
                >
                    Submit
                </Button>
            </Box>
        </Dialog>
    );
};

export default CustomModal;
