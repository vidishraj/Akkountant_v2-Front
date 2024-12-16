import CircularProgress from "@mui/material/CircularProgress";
import Box from "@mui/material/Box";

const Loader: React.FC = () => {
    return (
        <Box
            sx={{
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                height: "100%",
                width: "100%",
                position: "absolute",
                top: 0,
                left: 0,
                backgroundColor: "rgba(255, 255, 255, 0.8)", // Semi-transparent background
                zIndex: 10, // Ensure it appears above the container
                
            }}
        >
            <CircularProgress/>
        </Box>
    );
};

export default Loader;
