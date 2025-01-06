import {
    AppBar,
    Toolbar,
    Typography,
    Button,
    Box,
    IconButton,
    Avatar,
    MenuItem,
    ListItemText,
    Divider,
    List,
    ListItem,
    Drawer,
    FormControl,
    FormControlLabel,
    Checkbox,
    FormGroup,
    DialogTitle,
    DialogContent,
    Dialog,
    DialogActions,
    TextField,
} from '@mui/material';
import {Link, useNavigate} from 'react-router-dom';
// import MenuIcon from '@mui/icons-material/Menu';
import styles from './Header.module.scss';
import {auth} from "../FirebaseConfig.tsx"
import Menu from '@mui/material/Menu';
import {useEffect, useState} from "react";
import {getAuth, signOut} from "firebase/auth";
import SettingsIcon from '@mui/icons-material/Settings';
import AssuredWorkloadIcon from '@mui/icons-material/AssuredWorkload';
import LockResetIcon from '@mui/icons-material/LockReset';
import ChangepasswordDialog from '../ChangePasswordDialog/ChangepasswordDialog.tsx';
import {fetchOptedBanks, fetchOptedBanksPassword} from '../../services/transactionService.ts';
import {useMessage} from '../../contexts/MessageContext.tsx';
import JobsDialog from '../JobsDialog/JobsDialog.tsx';
import WorkHistoryIcon from '@mui/icons-material/WorkHistory';

const Header = () => {
    const [anchorElUser, setAnchorElUser] = useState(null);
    const [isDrawerOpen, setDrawerOpen] = useState(false); // State for the sidebar
    const [selectedBanks, setSelectedBanks] = useState<string[]>([]);
    const banks = ["Millenia_Credit", "HDFC_DEBIT", "ICICI_AMAZON_PAY", "YES_BANK_DEBIT", "YES_BANK_ACE", "BOI"]
    const [isDialogOpen, setDialogOpen] = useState<boolean>(false);
    const [isBankDialogOpen, setBankDialogOpen] = useState<boolean>(false);
    const [bankPasswords, setBankPasswords] = useState<{ [key: string]: string }>({});
    const [optedBanks, setOptedBanks] = useState<string[]>([]);
    const [isJobsDialogOpen, setJobsDialogOpen]=useState<boolean>(false);
    const {setPayload} = useMessage();

    const handleBankDialogClose = () => {
        setBankDialogOpen(false);
    }

    useEffect(() => {
        const fetchBanks = async () => {
            try {
                const banks = await fetchOptedBanks();
                if (Array.isArray(banks)) {
                    setOptedBanks(banks);
                }
            } catch (err) {
                setPayload({
                    type: "error",
                    message: "Failed to fetch opted banks. Please try again!"
                })
            }
        }
        if (auth.currentUser) {
            fetchBanks();
        }
    }, [selectedBanks]);

    const handleBankToggle = (bank: string) => {
        setSelectedBanks((prevSelected) => {
            const isSelected = prevSelected.includes(bank);

            const updatedBanks = isSelected
                ? prevSelected.filter((b) => b !== bank)
                : [...prevSelected, bank];

            // Update bankPasswords based on updated selection
            setBankPasswords((prevPasswords) => {
                const updatedPasswords = {...prevPasswords};
                if (!isSelected) {
                    // Initialize password (empty placeholder) for newly selected bank till password is set within handleSelectedBankPassword()
                    updatedPasswords[bank] = "";
                } else {
                    // Remove password for deselected bank
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

    const handleSubmit = async () => {
        const payload = {
            banks: selectedBanks.reduce((acc, bank) => {
                if (bankPasswords[bank]) {
                    acc[bank] = bankPasswords[bank];
                }
                return acc;
            }, {} as { [key: string]: string }),

        };

        try {
            const response = await fetchOptedBanksPassword(payload);

            setPayload({
                type: "success",
                message: "Bank passwords submitted successfully!",
            });

            handleBankDialogClose();
        } catch (err) {
            console.error("Error submitting bank passwords:", err);

            setPayload({
                type: "error",
                message: "Failed to submit bank passwords. Please try again.",
            });
        }

    };

    const allPasswordsFilled = selectedBanks.every((bank) => bankPasswords[bank]?.trim() !== "");

    const toggleDrawer = (open: boolean) => () => {
        setDrawerOpen(open);
        if (open) {
            handleCloseUserMenu();
        }
    };

    const handleCloseUserMenu = () => {
        setAnchorElUser(null);
    };

    const navigate = useNavigate();

    const handleOpenUserMenu = (event: any) => {
        setAnchorElUser(event.currentTarget);
    };

    async function logOut() {
        const auth = getAuth();
        try {
            await signOut(auth);
            navigate('/')
        } catch (error) {
            console.error('Error logging out:', error);
        }
    }

    const handleLogOut = () => {
        setAnchorElUser(null);
        logOut();
    };

    const LoggedinSettings = ['Logout', 'Settings'];
    const LoggedOutSettings = ['Login'];

    return (
        <>
            {/* Main Header */}
            <AppBar position="static" sx={{backgroundColor: 'inherit', borderBottom: '0.7px solid white'}}>
                <Toolbar sx={{justifyContent: 'space-between'}}>
                    <Box className={styles.linkContainer}>
                        <Typography sx={{fontWeight: 'bold'}} className={styles.icon}>
                            <Link style={{color: "#FAFAFA", fontWeight: "700"}} to={'/home'}>Akkountant</Link>
                        </Typography>
                        <Button sx={{mx: 1}} className={styles.links}>
                            <Link style={{color: "#FAFAFA"}} to={'/transactions'}>
                                Transactions
                            </Link>
                        </Button>
                        <Button sx={{mx: 1}} className={styles.links}>
                            <Link style={{color: "#FAFAFA"}} to={'/investments'}>
                                Investments
                            </Link>
                        </Button>
                    </Box>
                    <Box display="flex" alignItems="center">
                        <IconButton onClick={handleOpenUserMenu}>
                            <Avatar sx={{bgcolor: '#5B5B7B'}}>
                                {auth.currentUser ? auth.currentUser.email?.at(0) : ""}
                            </Avatar>
                        </IconButton>
                    </Box>
                </Toolbar>
                <Menu
                    sx={{mt: '45px'}}
                    MenuListProps={{sx: {py: 0}}}
                    id="menu-appbar"
                    anchorEl={anchorElUser}
                    anchorOrigin={{
                        vertical: 'top',
                        horizontal: 'right',
                    }}
                    keepMounted
                    transformOrigin={{
                        vertical: 'top',
                        horizontal: 'right',
                    }}
                    open={Boolean(anchorElUser)}
                    onClose={handleCloseUserMenu}
                >
                    {auth.currentUser
                        ? LoggedinSettings.map((setting) => (
                            <MenuItem
                                style={{backgroundColor: "#121C24", color: "#FAFAFA"}}
                                key={setting}
                                onClick={
                                    setting === 'Settings'
                                        ? toggleDrawer(true)
                                        : handleLogOut
                                }
                            >
                                <Typography sx={{textAlign: 'center'}}>{setting}</Typography>
                            </MenuItem>
                        ))
                        : LoggedOutSettings.map((setting) => (
                            <MenuItem
                                style={{backgroundColor: "#121C24", color: "#FAFAFA"}}
                                key={setting}
                                onClick={() => {
                                    navigate('/login');
                                }}
                            >
                                <Typography sx={{textAlign: 'center'}}>{setting}</Typography>
                            </MenuItem>
                        ))}
                </Menu>
            </AppBar>

            {/* Sidebar (Drawer) */}
            <Drawer
                anchor="right"
                open={isDrawerOpen}
                onClose={toggleDrawer(false)}
            >
                <Box
                    sx={{
                        width: 250,
                        backgroundColor: "#121C24",
                        height: "100%",
                        color: "#FAFAFA",
                        p: 2,
                        boxShadow: "-5px 0 10px rgba(0, 0, 0, 0.5)",
                    }}
                >
                    <Typography variant="h6" sx={{fontWeight: 'bold', mb: 2}}>
                        <SettingsIcon style={{verticalAlign: "middle"}}/> Settings
                    </Typography>
                    <Divider/>
                    <List>

                        <ListItem sx={{ padding: "1rem 0", alignItems: "center", cursor:"pointer","&:hover":{
                            backgroundColor:"rgb(50, 62, 74)"
                        } }} onClick={()=>setBankDialogOpen(true)}>
                            <AssuredWorkloadIcon
                                style={{verticalAlign: "middle", marginRight: "0.5rem"}}
                            />
                            <Typography
                                sx={{color: "white", cursor: "pointer"}}
                            >
                                Select Banks
                            </Typography>
                        </ListItem>

                        <ListItem sx={{padding: "1rem 0", cursor:"pointer","&:hover":{
                            backgroundColor:"rgb(50, 62, 74)"}}} onClick={()=>setDialogOpen(true)}>
                            <LockResetIcon style={{verticalAlign: "middle", marginRight: "0.5rem"}}/><ListItemText
                            primary="Change Password" sx={{color: "white", cursor: "pointer"}}/>
                        </ListItem>

                        <ListItem sx={{padding: "1rem 0", cursor:"pointer","&:hover":{
                            backgroundColor:"rgb(50, 62, 74)"}}} onClick={()=>setJobsDialogOpen(true)}>
                            <WorkHistoryIcon style={{verticalAlign: "middle", marginRight: "0.5rem"}}/><ListItemText
                            primary="Jobs" sx={{color: "white", cursor: "pointer"}}/>
                        </ListItem>

                        {/* Show fetched opted banks */}
                        {Array.isArray(optedBanks) && optedBanks.length > 0 && (
                            <Box sx={{mt: 15, pl: 2}}>
                                <Typography sx={{color: "#FAFAFA", fontWeight: "bold"}}>
                                    Fetched Opted Banks:
                                </Typography>
                                <List>
                                    {optedBanks.map((bank, index) => (
                                        <ListItem key={index} sx={{padding: 0}}>
                                            <Typography sx={{color: "#FAFAFA"}}>
                                            {bank.replace(/_/g," ")}
                                            </Typography>
                                        </ListItem>
                                    ))}
                                </List>
                            </Box>
                        )}
                        <ChangepasswordDialog open={isDialogOpen} onClose={() => setDialogOpen(false)}/>
                        <JobsDialog open={isJobsDialogOpen} onClose={()=>setJobsDialogOpen(false)}/>
                    </List>

                </Box>
            </Drawer>

            {/* Opt banks dialog */}

        <Dialog open={isBankDialogOpen} onClose={handleBankDialogClose} fullWidth PaperProps={{
        sx: {
            backgroundColor: "#121C24",
            color: "#FAFAFA",
            borderRadius: 2,
            padding: 3,
        },
    }} >
        <DialogTitle>Select Banks</DialogTitle>
        <DialogContent>
          <FormControl component="fieldset">
            <FormGroup sx={{
                display: "flex",
                flexDirection: "column", 
                gap: 1,
            }}>
              {banks.map((bank) => (
                <Box key={bank} sx={{
                  display:"flex",
                  alignItems:"center",
                  justifyContent:"space-between",
                  gap:1,
                  color:"#FAFAFA",
                  margin:0
                }}>
                <FormControlLabel
                  key={bank}
                  sx={{
                    display:"flex",
                    alignItems:"center",
                    color:"#FAFAFA",
                    margin:0
                  }}
                  control={
                    <Checkbox
                      checked={selectedBanks.includes(bank)}
                      onChange={() => handleBankToggle(bank)}
                      sx={{ color: "#FAFAFA" }}
                    />
                  }
                  label={bank}
                />
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
                        fontSize:"0.5rem",
                        marginLeft:"2rem",
                        width:"250px",
                        input: { color: "#FAFAFA" },

                        }}
                    />
                    )}
                </Box>
              ))}
            </FormGroup>
          </FormControl>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleSubmit}  variant="contained" disabled={!allPasswordsFilled} sx={{backgroundColor:!allPasswordsFilled?"red":"primary.main",
                '&.Mui-disabled': {
                    backgroundColor:  "#1E2A36 !important",
                    color:"grey !important"
                  },
          }}>
            Done
          </Button>
        </DialogActions>
      </Dialog>
        </>
    );
};

export default Header;
