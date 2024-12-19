import {AppBar, Toolbar, Typography, Button, Box, IconButton, Avatar, MenuItem, ListItemText, Divider, List, ListItem, Drawer, FormControl, FormControlLabel, Checkbox, FormGroup, Select, Dialog, DialogTitle, DialogContent, DialogActions, TextField} from '@mui/material';
import {Link, useNavigate} from 'react-router-dom';
// import MenuIcon from '@mui/icons-material/Menu';
import {auth} from "../FirebaseConfig.tsx"
import Menu from '@mui/material/Menu';
import {useState} from "react";
import {getAuth, signOut} from "firebase/auth";
import SettingsIcon from '@mui/icons-material/Settings';
import AssuredWorkloadIcon from '@mui/icons-material/AssuredWorkload';
import LockResetIcon from '@mui/icons-material/LockReset';
import styles from "../Header/Header.module.scss";
import ChangepasswordDialog from '../ChangePasswordDialog/ChangepasswordDialog.tsx';

const Header = () => {
    const [anchorElUser, setAnchorElUser] = useState(null);
    const [isDrawerOpen, setDrawerOpen] = useState(false); // State for the sidebar
    const [selectedBanks, setSelectedBanks]= useState<string[]>([]);
    const banks= ["Millenia_Credit", "HDFC_DEBIT","ICICI_AMAZON_PAY", "YES_BANK_DEBIT", "YES_BANK_ACE", "BOI"]
    const [isDialogOpen, setDialogOpen]= useState<boolean>(false);
    const [isBankDialogOpen, setBankDialogOpen]= useState<boolean>(false);
    const [bankPasswords, setBankPasswords]=useState<{[key:string]:string}>({});


    const handleBankDialogOpen = ()=>{
        setBankDialogOpen(true);
    }
    const handleBankDialogClose =()=>{
        setBankDialogOpen(false);
    }

    const handleDialogOpen = ()=>{
        setDialogOpen(true);
    }
    const handleDialogClose = ()=>{
        setDialogOpen(false);
    }

    const handleBankToggle = (bank: string) => {
        setSelectedBanks((prevSelected) =>
            prevSelected.includes(bank)
                ? prevSelected.filter((b) => b !== bank) 
                : [...prevSelected, bank] 
        );
    };
    console.log(selectedBanks);
    console.log(bankPasswords);

    const handleSelectedBankPassword=(bank:string, password:string)=>{
        setBankPasswords((prev)=>(
            {
                ...prev,
                [bank]:password,
            }
        ))
    }

    const toggleDrawer = (open: boolean) => () => {
        setDrawerOpen(open);
        if(open){
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
            <AppBar position="static" sx={{backgroundColor: 'inherit'}}>
                <Toolbar sx={{justifyContent: 'space-between'}}>
                    <Box display="flex" alignItems="center" gap={5}>
                        <Typography variant="h6" sx={{fontWeight: 'bold'}}>
                            Akkountant
                        </Typography>
                        <Box>
                            <Button sx={{mx: 1}}>
                                <Link style={{color: "#FAFAFA"}} to={'/home'}>
                                    Home
                                </Link>
                            </Button>
                            <Button sx={{mx: 1}}>
                                <Link style={{color: "#FAFAFA"}} to={'/transactions'}>
                                    Transactions
                                </Link>
                            </Button>
                            <Button sx={{mx: 1}}>
                                <Link style={{color: "#FAFAFA"}} to={'/investments'}>
                                    Investments
                                </Link>
                            </Button>
                        </Box>
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
                        backgroundColor:"#121C24",
                        height: "100%",
                        color: "#FAFAFA",
                        p: 2,
                        boxShadow: "-5px 0 10px rgba(0, 0, 0, 0.5)",
                    }}
                >
                    <Typography variant="h6" sx={{fontWeight: 'bold', mb: 2}}>
                        <SettingsIcon style={{verticalAlign:"middle"}}/> Settings
                    </Typography>
                    <Divider />
                    <List>

                        <ListItem sx={{ padding: 0, alignItems: "center" }} onClick={handleBankDialogOpen}>
                            <AssuredWorkloadIcon
                                style={{ verticalAlign: "middle", marginRight: "0.5rem" }}
                            />
                            <Typography
                                sx={{ color: "white", cursor: "pointer" }}
                            >
                                Select Banks
                            </Typography>
                        </ListItem>

                        <ListItem sx={{padding:0, marginTop:"1rem"}} onClick={handleDialogOpen}>
                            <LockResetIcon style={{verticalAlign:"middle", marginRight:"0.5rem"}}/><ListItemText primary="Change Password" sx={{color:"white", cursor: "pointer"}}/>
                        </ListItem>
                        <ChangepasswordDialog open={isDialogOpen} onClose={handleDialogClose}/>
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
                <>
                <FormControlLabel
                  key={bank}
                  sx={{
                    display:"flex",
                    flexWrap:"wrap",
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
                        placeholder="Enter password"
                        type="password"
                        size="small"
                        variant="outlined"
                        sx={{
                        backgroundColor: "#1E2A36",
                        borderRadius: 1,
                        input: { color: "#FAFAFA" },

                        }}
                    />
                    )}
                </>
              ))}
            </FormGroup>
          </FormControl>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleBankDialogClose} color="primary">
            Done
          </Button>
        </DialogActions>
      </Dialog>
        </>
    );
};

export default Header;
