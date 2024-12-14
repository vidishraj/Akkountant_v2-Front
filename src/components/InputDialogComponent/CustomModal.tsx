import React, {useState} from "react";
import {
    Box,
    Button,
    Dialog,
    DialogContent,
    DialogTitle,
    FormControl, InputLabel, MenuItem, Select,
    TextField,
} from "@mui/material";
import styles from "./CustomModal.module.scss";

type Props = {
    title: string;
    open: boolean;
    onCancel: () => void;
    onSubmit: (formData: any) => void;
    cardType: "mf" | string;
    maxNav?: number;
};

const CustomModal = ({title, open, onCancel, onSubmit, cardType, maxNav}: Props) => {
    const [formData, setFormData] = useState({
        date: "",
        nav: "",
        quantity: "",
        description: "",
        amount: "",
        goldCarat: "18 carat"
    });

    const [errors, setErrors] = useState({
        date: "",
        nav: "",
        quantity: "",
        description: "",
        amount: "",
        goldCarat: "18 carat"
    });

    const handleInputChange = (field: string, value: string) => {
        setFormData((prev) => ({...prev, [field]: value}));
        setErrors((prev) => ({...prev, [field]: ""})); // Clear error on input change
    };

    const validateForm = () => {
        const newErrors: any = {};
        if (!formData.date) newErrors.date = "Date is required.";

        if (cardType === "mf") {
            if (!formData.nav) newErrors.nav = "NAV is required.";
            if (!formData.quantity) newErrors.quantity = "Quantity is required.";
        } else {
            if (!formData.description) newErrors.description = "Description is required.";
            if (!formData.quantity) newErrors.quantity = "Quantity is required.";
            if (!formData.amount) newErrors.amount = "Amount is required.";
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleFormSubmit = () => {
        if (validateForm()) {
            onSubmit(formData);
        }
    };

    return (
        <Dialog open={open} onClose={onCancel} fullWidth maxWidth="sm" className={styles.dialog}>
            <DialogTitle className={styles.dialogTitle}>{title}</DialogTitle>
            <DialogContent className={styles.dialogContent}>
                <Box className={styles.formContainer}>
                    {/* Common Date Field */}
                    <TextField
                        label="Date"
                        type="date"
                        value={formData.date}
                        onChange={(e) => handleInputChange("date", e.target.value)}
                        InputLabelProps={{className: styles.inputFi, shrink: true}}
                        fullWidth
                        className={styles.inputField}
                        error={!!errors.date}
                        helperText={errors.date}
                        InputProps={{className: styles.inputFi,}}
                    />

                    {cardType === "mf" ? (
                        <>
                            {/* NAV Field */}
                            <TextField
                                label="NAV"
                                type="number"
                                value={formData.nav}
                                onChange={(e) => handleInputChange("nav", e.target.value)}
                                InputProps={{className: styles.inputFi, inputProps: {min: 0, max: maxNav}}}
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
                                InputProps={{className: styles.inputFi, inputProps: {min: 0, step: 0.01}}}
                                fullWidth
                                className={styles.inputField}
                                error={!!errors.quantity}
                                helperText={errors.quantity}
                            />
                        </>
                    ) : (
                        <>
                            {/* Description Field */}
                            <TextField
                                label="Description"
                                type="text"
                                value={formData.description}
                                onChange={(e) => handleInputChange("description", e.target.value)}
                                fullWidth
                                className={styles.inputField}
                                error={!!errors.description}
                                InputProps={{className: styles.inputFi}}
                                helperText={errors.description}
                            />

                            {/* Amount Field */}
                            <TextField
                                label="Amount"
                                type="number"
                                value={formData.amount}
                                onChange={(e) => handleInputChange("amount", e.target.value)}
                                InputProps={{className: styles.inputFi, inputProps: {min: 0, step: 0.01}}}
                                fullWidth
                                className={styles.inputField}
                                error={!!errors.amount}
                                helperText={errors.amount}
                            />
                            <TextField
                                label="Quantity"
                                type="number"
                                value={formData.quantity}
                                onChange={(e) => handleInputChange("quantity", e.target.value)}
                                InputProps={{className: styles.inputFi, inputProps: {min: 0, step: 0.01}}}
                                fullWidth
                                className={styles.inputField}
                                error={!!errors.quantity}
                                helperText={errors.quantity}
                            />
                            {/* Gold Carat Dropdown */}
                            {
                                cardType === "gold" &&
                                <FormControl fullWidth className={styles.inputField}>
                                    <InputLabel id="gold-carat-label">Gold Carat</InputLabel>
                                    <Select
                                        labelId="gold-carat-label"
                                        value={formData.goldCarat}
                                        style={{color: "white"}}
                                        onChange={(e) => handleInputChange("goldCarat", e.target.value)}
                                    >
                                        <MenuItem value="18 carat">18 carat</MenuItem>
                                        <MenuItem value="22 carat">22 carat</MenuItem>
                                        <MenuItem value="24 carat">24 carat</MenuItem>
                                    </Select>
                                </FormControl>
                            }
                        </>
                    )}
                </Box>
            </DialogContent>
            <Box className={styles.dialogActions}>
                <Button variant="outlined" onClick={onCancel} className={styles.cancelButton}>
                    Cancel
                </Button>
                <Button
                    variant="contained"
                    color="primary"
                    onClick={handleFormSubmit}
                    className={styles.submitButton}
                >
                    Submit
                </Button>
            </Box>
        </Dialog>
    );
};

export default CustomModal;
