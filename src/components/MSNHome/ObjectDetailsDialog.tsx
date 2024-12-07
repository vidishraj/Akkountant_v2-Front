import React from "react";
import {
    Dialog,
    DialogTitle,
    DialogContent,
    Grid,
    Typography,
    IconButton,
    useMediaQuery,
    useTheme,
    Box,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";

interface ObjectDetailsDialogProps {
    open: boolean;
    onClose: () => void;
    title: string;
    data: Record<string, string | number | boolean>; // Accepts key-value pairs
}

const ObjectDetailsDialog: React.FC<ObjectDetailsDialogProps> = ({
                                                                     open,
                                                                     onClose,
                                                                     title,
                                                                     data,
                                                                 }) => {
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down("sm"));

    return (
        <Dialog
            open={open}
            onClose={onClose}
            maxWidth="md"
            fullWidth
            PaperProps={{
                style: {
                    padding: isMobile ? "16px" : "24px",
                    borderRadius: theme.shape.borderRadius,
                    backgroundColor: "#121C24",
                    color: "#FAFAFA"
                },
            }}
        >
            <DialogTitle
                sx={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    paddingBottom: isMobile ? "8px" : "16px",
                }}
            >
                <Typography
                    variant="h6"
                    sx={{
                        fontWeight: "bold",
                        textAlign: "center",
                        flexGrow: 1,
                        marginRight: isMobile ? 0 : "40px",
                    }}
                >
                    {title}
                </Typography>
                <IconButton
                    onClick={onClose}
                    sx={{
                        position: isMobile ? "absolute" : "static",
                        top: isMobile ? "8px" : "auto",
                        right: isMobile ? "8px" : "auto",
                    }}
                >
                    <CloseIcon/>
                </IconButton>
            </DialogTitle>
            <DialogContent>
                <Box
                    sx={{
                        display: "flex",
                        justifyContent: "center",
                        alignItems: "center",
                        height: "100%",
                        minHeight: isMobile ? "200px" : "300px",
                    }}
                >
                    <Grid container spacing={2} sx={{maxWidth: "100%"}}>
                        {Object.entries(data).map(([key, value]) => (
                            <React.Fragment key={key}>
                                <Grid item xs={6}>
                                    <Typography
                                        variant="subtitle2"
                                        sx={{
                                            fontWeight: "bold",
                                            color: "#FAFAFA",
                                            wordWrap: "break-word",
                                        }}
                                    >
                                        {key}
                                    </Typography>
                                </Grid>
                                <Grid item xs={6}>
                                    <Typography
                                        variant="body2"
                                        sx={{
                                            color: "#FAFAFA",
                                            wordWrap: "break-word",
                                        }}
                                    >
                                        {String(value)}
                                    </Typography>
                                </Grid>
                            </React.Fragment>
                        ))}
                    </Grid>
                </Box>
            </DialogContent>
        </Dialog>
    );
};

export default ObjectDetailsDialog;
