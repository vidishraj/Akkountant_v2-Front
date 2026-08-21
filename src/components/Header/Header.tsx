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
  useMediaQuery,
  useTheme,
} from "@mui/material";
import { Link, useNavigate, useLocation } from "react-router-dom";
import AgentHeaderInput from "./AgentHeaderInput";
import { AgentType } from "../../services/agentService";
import styles from "./Header.module.scss";
import Menu from "@mui/material/Menu";
import { useEffect, useState } from "react";
import { getAuth } from "firebase/auth";
import { useAuth } from "../../contexts/AuthContext";
import SettingsIcon from "@mui/icons-material/Settings";
import LockResetIcon from "@mui/icons-material/LockReset";
import ChangepasswordDialog from "../ChangePasswordDialog/ChangepasswordDialog.tsx";
import { useMessage } from "../../contexts/MessageContext.tsx";
import AccessTimeIcon from "@mui/icons-material/AccessTime";
import WorkIcon from "@mui/icons-material/Work";
import PublicIcon from "@mui/icons-material/Public";
import MenuIcon from "@mui/icons-material/Menu";
import ObjectDetailsDialog from "../MSNHome/ObjectDetailsDialog.tsx";
import { getFileTimeStamps } from "../../services/investmentService.ts";
import JobsDialog from "../JobsDialogComponent/JobsDialogComponent.tsx";
import PortfolioVisitorsModal from "../PortfolioVisitorsModal/PortfolioVisitorsModal.tsx";
import InsightsIcon from "@mui/icons-material/Insights";
import Badge from "@mui/material/Badge";
import { useWealthDigest } from "../../contexts/WealthDigestContext.tsx";

const Header = () => {
  const [anchorElUser, setAnchorElUser] = useState<null | HTMLElement>(null);
  const [isDrawerOpen, setDrawerOpen] = useState(false);
  const [isMobileMenuOpen, setMobileMenuOpen] = useState(false);
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const [isChangePasswordOpen, setChangePasswordOpen] = useState(false);
  const [fileStamps, setFileStamps] = useState<any>({});
  const { setPayload } = useMessage();
  const { currentUser, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const activeAgentType: AgentType | null = (() => {
    const p = location.pathname;
    if (p.startsWith("/transactions")) return "transaction";
    if (p.startsWith("/investments")) return "investment";
    if (p.startsWith("/freelance")) return "freelance";
    return null;
  })();

  const [isTimeStampDialogOpen, setTimeStampsDialog] = useState<boolean>(false);
  const [jobsDialogOpen, setJobsDialogOpen] = useState<boolean>(false);
  const [visitorsModalOpen, setVisitorsModalOpen] = useState<boolean>(false);
  const { hasUnread: hasUnreadDigest } = useWealthDigest();
  useEffect(() => {
    if (currentUser) {
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
        sx={{ backgroundColor: "inherit", borderBottom: "0.7px solid white", zIndex: 1100, overflow: "visible" }}
      >
        <Toolbar sx={{ justifyContent: "space-between", overflow: "visible" }}>
          <Box className={styles.linkContainer}>
            <Typography sx={{ fontWeight: "bold" }} className={styles.icon}>
              <Link style={{ color: "#FAFAFA", fontWeight: "700" }} to={"/"}>
                Akkountant
              </Link>
            </Typography>
            {!loading && currentUser && !isMobile && (
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
                <Button
                  sx={{ mx: 1 }}
                  onClick={() => {
                    navigate("/files");
                  }}
                  className={styles.links}
                >
                  <Link style={{ color: "#FAFAFA" }} to={"/files"}>
                    Files
                  </Link>
                </Button>
                <Button
                  sx={{ mx: 1 }}
                  onClick={() => {
                    navigate("/wealth-digest");
                  }}
                  className={styles.links}
                >
                  <Badge
                    color="error"
                    variant="dot"
                    invisible={!hasUnreadDigest}
                    overlap="rectangular"
                    anchorOrigin={{ vertical: "top", horizontal: "right" }}
                    sx={{ "& .MuiBadge-dot": { transform: "translate(6px, -4px)" } }}
                  >
                    <Link style={{ color: "#FAFAFA" }} to={"/wealth-digest"}>
                      Wealth Digest
                    </Link>
                  </Badge>
                </Button>
              </>
            )}
          </Box>
          {!loading && currentUser && !isMobile && activeAgentType && (
            <AgentHeaderInput agentType={activeAgentType} />
          )}
          <Box display="flex" alignItems="center">
            {!loading && currentUser && isMobile && (
              <IconButton
                onClick={() => setMobileMenuOpen(true)}
                sx={{ color: "#FAFAFA", mr: 1 }}
              >
                <MenuIcon />
              </IconButton>
            )}
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

      {/* Mobile Navigation Menu */}
      <Drawer
        anchor="left"
        open={isMobileMenuOpen}
        onClose={() => setMobileMenuOpen(false)}
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
            Navigation
          </Typography>
          <Divider sx={{ backgroundColor: "#FAFAFA", mb: 2 }} />
          <List>
            <ListItem
              onClick={() => {
                navigate("/transactions");
                setMobileMenuOpen(false);
              }}
              sx={{ cursor: "pointer", "&:hover": { backgroundColor: "rgb(50, 62, 74)" } }}
            >
              <ListItemText primary="Transactions" sx={{ color: "white" }} />
            </ListItem>
            <ListItem
              onClick={() => {
                navigate("/investments");
                setMobileMenuOpen(false);
              }}
              sx={{ cursor: "pointer", "&:hover": { backgroundColor: "rgb(50, 62, 74)" } }}
            >
              <ListItemText primary="Investments" sx={{ color: "white" }} />
            </ListItem>
            <ListItem
              onClick={() => {
                navigate("/freelance");
                setMobileMenuOpen(false);
              }}
              sx={{ cursor: "pointer", "&:hover": { backgroundColor: "rgb(50, 62, 74)" } }}
            >
              <ListItemText primary="Freelance" sx={{ color: "white" }} />
            </ListItem>
            <ListItem
              onClick={() => {
                navigate("/files");
                setMobileMenuOpen(false);
              }}
              sx={{ cursor: "pointer", "&:hover": { backgroundColor: "rgb(50, 62, 74)" } }}
            >
              <ListItemText primary="Files" sx={{ color: "white" }} />
            </ListItem>
            <ListItem
              onClick={() => {
                navigate("/wealth-digest");
                setMobileMenuOpen(false);
              }}
              sx={{ cursor: "pointer", "&:hover": { backgroundColor: "rgb(50, 62, 74)" } }}
            >
              <Badge
                color="error"
                variant="dot"
                invisible={!hasUnreadDigest}
                sx={{ "& .MuiBadge-dot": { transform: "translate(4px, 4px)" } }}
              >
                <InsightsIcon fontSize="small" sx={{ mr: 1, color: "white" }} />
              </Badge>
              <ListItemText primary="Wealth Digest" sx={{ color: "white" }} />
            </ListItem>
          </List>
          {activeAgentType && (
            <>
              <Divider sx={{ backgroundColor: "#FAFAFA", my: 2 }} />
              <Typography variant="body2" sx={{ color: "#7a7d85", mb: 1 }}>
                Ask AI Assistant
              </Typography>
              <AgentHeaderInput agentType={activeAgentType} />
            </>
          )}
        </Box>
      </Drawer>

      {/* Settings Drawer */}
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
            <ListItem
              sx={{
                cursor: "pointer",
                "&:hover": {
                  backgroundColor: "rgb(50, 62, 74)",
                },
              }}
              onClick={() => setVisitorsModalOpen(true)}
            >
              <PublicIcon style={{ marginRight: "0.5rem" }} />
              <ListItemText
                primary="Visitors"
                sx={{ color: "white", cursor: "pointer" }}
              />
            </ListItem>
            <ChangepasswordDialog
              open={isChangePasswordOpen}
              onClose={() => setChangePasswordOpen(false)}
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
            <PortfolioVisitorsModal
              open={visitorsModalOpen}
              onClose={() => setVisitorsModalOpen(false)}
            />
          </List>
        </Box>
      </Drawer>
    </>
  );
};

export default Header;
