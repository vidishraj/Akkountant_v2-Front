import {
  AppBar,
  Toolbar,
  Typography,
  Button,
  Box,
  IconButton,
  Avatar,
  MenuItem,
  Divider,
  List,
  ListItem,
  Drawer,
  ListItemText,
} from "@mui/material";
import { Link, useNavigate } from "react-router-dom";
import styles from "./Header.module.scss";
import Menu from "@mui/material/Menu";
import { useEffect, useState } from "react";
import { getAuth } from "firebase/auth";
import { useAuth } from "../../contexts/AuthContext";
import SettingsIcon from "@mui/icons-material/Settings";
import AssuredWorkloadIcon from "@mui/icons-material/AssuredWorkload";
import LockResetIcon from "@mui/icons-material/LockReset";
import ChangepasswordDialog from "../ChangePasswordDialog/ChangepasswordDialog.tsx";
import { fetchOptedBanks } from "../../services/transactionService.ts";
import { useMessage } from "../../contexts/MessageContext.tsx";
import SavingsIcon from "@mui/icons-material/Savings";
import AccessTimeIcon from "@mui/icons-material/AccessTime";
import WorkIcon from "@mui/icons-material/Work";
import OptBanksDialog from "../OptBanksDialogComponent/OptBanksDialog.tsx";
import ObjectDetailsDialog from "../MSNHome/ObjectDetailsDialog.tsx";
import { getFileTimeStamps } from "../../services/investmentService.ts";
import JobsDialog from "../JobsDialogComponent/JobsDialogComponent.tsx";

const Header = () => {
  const [anchorElUser, setAnchorElUser] = useState<null | HTMLElement>(null);
  const [isDrawerOpen, setDrawerOpen] = useState(false);
  const [isChangePasswordOpen, setChangePasswordOpen] = useState(false);
  const [isBankDialogOpen, setBankDialogOpen] = useState(false);
  const [optedBanks, setOptedBanks] = useState<any>({});
  const [fileStamps, setFileStamps] = useState<any>({});
  const { setPayload } = useMessage();
  const { currentUser, loading } = useAuth();
  const navigate = useNavigate();

  const [isTimeStampDialogOpen, setTimeStampsDialog] = useState<boolean>(false);
  const [optedBanksDialog, setOptedBanksDialog] = useState<boolean>(false);
  const [jobsDialogOpen, setJobsDialogOpen] = useState<boolean>(false);
  useEffect(() => {
    if (currentUser) {
      fetchOptedBanks()
        .then((data) => {
          if (Array.isArray(data)) {
            const obj: any = {};
            data.forEach(
              (bank, index) =>
                (obj[`Bank ${index + 1}`] = bank.replace(/_/g, " "))
            );
            setOptedBanks(obj);
          }
        })
        .catch(() =>
          setPayload({
            type: "error",
            message: "Failed to fetch opted banks. Please try again!",
          })
        );
      getFileTimeStamps()
        .then((res) => {
          setFileStamps(res);
        })
        .catch(() =>
          setPayload({
            type: "error",
            message: "Failed to fetch file stamps. Please try again!",
          })
        );
    }
  }, [currentUser]);

  return (
    <>
      <AppBar
        position="static"
        sx={{ backgroundColor: "inherit", borderBottom: "0.7px solid white" }}
      >
        <Toolbar sx={{ justifyContent: "space-between" }}>
          <Box className={styles.linkContainer}>
            <Typography sx={{ fontWeight: "bold" }} className={styles.icon}>
              <Link style={{ color: "#FAFAFA", fontWeight: "700" }} to={"/"}>
                Akkountant
              </Link>
            </Typography>
            {!loading && currentUser && (
              <>
                <Button
                  sx={{ mx: 1 }}
                  onClick={() => {
                    navigate("/transactions");
                  }}
                  className={styles.links}
                >
                  <Link style={{ color: "#FAFAFA" }} to={"/transactions"}>
                    Transactions
                  </Link>
                </Button>
                <Button
                  sx={{ mx: 1 }}
                  onClick={() => {
                    navigate("/investments");
                  }}
                  className={styles.links}
                >
                  <Link style={{ color: "#FAFAFA" }} to={"/investments"}>
                    Investments
                  </Link>
                </Button>
                <Button
                  sx={{ mx: 1 }}
                  onClick={() => {
                    navigate("/freelance");
                  }}
                  className={styles.links}
                >
                  <Link style={{ color: "#FAFAFA" }} to={"/freelance"}>
                    Freelance
                  </Link>
                </Button>
              </>
            )}
          </Box>
          <Box display="flex" alignItems="center">
            {loading ? (
              // Show nothing or a loading indicator during auth check
              <Box sx={{ width: 40, height: 40 }} />
            ) : currentUser ? (
              <IconButton onClick={(e) => setAnchorElUser(e.currentTarget)}>
                <Avatar sx={{ bgcolor: "#5B5B7B" }}>
                  {currentUser?.email?.[0] || ""}
                </Avatar>
              </IconButton>
            ) : (
              <Button
                variant="contained"
                onClick={() => navigate("/login")}
                sx={{
                  backgroundColor: "#4A90E2",
                  "&:hover": { backgroundColor: "#357ABD" },
                }}
              >
                Login
              </Button>
            )}
          </Box>
        </Toolbar>
        <Menu
          sx={{ mt: "45px" }}
          MenuListProps={{ sx: { py: 0 } }}
          anchorOrigin={{
            vertical: "top",
            horizontal: "right",
          }}
          transformOrigin={{
            vertical: "top",
            horizontal: "right",
          }}
          id="menu-appbar"
          anchorEl={anchorElUser}
          open={Boolean(anchorElUser)}
          onClose={() => setAnchorElUser(null)}
        >
          {["Logout", "Settings"].map((setting) => (
            <MenuItem
              key={setting}
              style={{ backgroundColor: "#121C24", color: "#FAFAFA" }}
              onClick={
                setting === "Settings"
                  ? () => {
                      setDrawerOpen(true);
                      setAnchorElUser(null);
                    }
                  : () => {
                      setAnchorElUser(null);
                      getAuth()
                        .signOut()
                        .then(() => navigate("/"))
                        .catch(() =>
                          setPayload({
                            type: "error",
                            message: "Error logging out.",
                          })
                        );
                    }
              }
            >
              <Typography sx={{ textAlign: "center" }}>{setting}</Typography>
            </MenuItem>
          ))}
        </Menu>
      </AppBar>

      <Drawer
        anchor="right"
        open={isDrawerOpen}
        onClose={() => setDrawerOpen(false)}
      >
        <Box
          sx={{
            width: 250,
            backgroundColor: "#121C24",
            height: "100%",
            color: "#FAFAFA",
            p: 2,
          }}
        >
          <Typography variant="h6" sx={{ fontWeight: "bold", mb: 2 }}>
            <SettingsIcon style={{ verticalAlign: "middle" }} /> Settings
          </Typography>
          <Divider />
          <List>
            <ListItem
              onClick={() => setBankDialogOpen(true)}
              sx={{ cursor: "pointer" }}
            >
              <AssuredWorkloadIcon style={{ marginRight: "0.5rem" }} />
              <Typography>Select Banks</Typography>
            </ListItem>
            <ListItem
              onClick={() => setChangePasswordOpen(true)}
              sx={{ cursor: "pointer" }}
            >
              <LockResetIcon style={{ marginRight: "0.5rem" }} />
              <Typography>Change Password</Typography>
            </ListItem>
            <ListItem
              sx={{
                cursor: "pointer",
                "&:hover": {
                  backgroundColor: "rgb(50, 62, 74)",
                },
              }}
              onClick={() => setOptedBanksDialog(true)}
            >
              <SavingsIcon style={{ marginRight: "0.5rem" }} />
              <ListItemText
                primary="OptedBanks"
                sx={{ color: "white", cursor: "pointer" }}
              />
            </ListItem>
            <ListItem
              sx={{
                cursor: "pointer",
                "&:hover": {
                  backgroundColor: "rgb(50, 62, 74)",
                },
              }}
              onClick={() => setTimeStampsDialog(true)}
            >
              <AccessTimeIcon style={{ marginRight: "0.5rem" }} />
              <ListItemText
                primary="File Timestamps"
                sx={{ color: "white", cursor: "pointer" }}
              />
            </ListItem>
            <ListItem
              sx={{
                cursor: "pointer",
                "&:hover": {
                  backgroundColor: "rgb(50, 62, 74)",
                },
              }}
              onClick={() => setJobsDialogOpen(true)}
            >
              <WorkIcon style={{ marginRight: "0.5rem" }} />
              <ListItemText
                primary="Jobs"
                sx={{ color: "white", cursor: "pointer" }}
              />
            </ListItem>
            <ChangepasswordDialog
              open={isChangePasswordOpen}
              onClose={() => setChangePasswordOpen(false)}
            />
            <OptBanksDialog
              isBankDialogOpen={isBankDialogOpen}
              setBankDialogOpen={setBankDialogOpen}
            />
            <ObjectDetailsDialog
              open={optedBanksDialog}
              onClose={() => setOptedBanksDialog(false)}
              title="Opted Banks"
              data={optedBanks}
            />
            <ObjectDetailsDialog
              open={isTimeStampDialogOpen}
              onClose={() => setTimeStampsDialog(false)}
              title="File Timestamps"
              data={fileStamps}
            />
            <JobsDialog 
              open={jobsDialogOpen} 
              onClose={() => setJobsDialogOpen(false)}
            />
          </List>
        </Box>
      </Drawer>
    </>
  );
};

export default Header;
