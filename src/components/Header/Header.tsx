import {AppBar, Toolbar, Typography, Button, Box, IconButton, Avatar, MenuItem, ListItemText, Divider, List, ListItem, Drawer} from '@mui/material';
import {Link, useNavigate} from 'react-router-dom';
// import MenuIcon from '@mui/icons-material/Menu';
import {auth} from "../FirebaseConfig.tsx"

import Menu from '@mui/material/Menu';
import {useState} from "react";
import {getAuth, signOut} from "firebase/auth";
const Header = () => {
    const [anchorElUser, setAnchorElUser] = useState(null);
    const [isDrawerOpen, setDrawerOpen] = useState(false); 

    const toggleDrawer = (open: boolean) => () => {
        setDrawerOpen(open);
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

    const LoggedinSettings = ['Logout', 'Settings']; // Add "Settings" here
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

                                onClick={()=>{
                                    
                                    if(setting==="Settings"){
                                        handleCloseUserMenu();
                                        toggleDrawer(true);
                                    }
                                    else if (setting==="Logout"){
                                        handleCloseUserMenu();
                                        handleLogOut();
                                    }
                                }}
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
                    }}
                >
                    <Typography variant="h6" sx={{fontWeight: 'bold', mb: 2}}>
                        Settings
                    </Typography>
                    <Divider />
                    {/* <List>
                        <ListItem button onClick={() => navigate('/select-banks')} component="a">
                            <ListItemText primary="Select Banks" />
                        </ListItem>
                        <ListItem button onClick={() => navigate('/change-password')} compo>
                            <ListItemText primary="Change Password" />
                        </ListItem>
                    </List> */}
                </Box>
            </Drawer>
        </>
    );
};

export default Header;
