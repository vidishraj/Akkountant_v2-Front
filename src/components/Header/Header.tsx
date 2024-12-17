import {AppBar, Toolbar, Typography, Button, Box, IconButton, Avatar, MenuItem} from '@mui/material';
import {Link, useNavigate} from 'react-router-dom';
// import MenuIcon from '@mui/icons-material/Menu';
import {auth} from "../FirebaseConfig.tsx"

import Menu from '@mui/material/Menu';
import {useState} from "react";
import {getAuth, signOut} from "firebase/auth";

const Header = () => {
    const [anchorElUser, setAnchorElUser] = useState(null);
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
        logOut()
    }
    const LoggedinSettings = ['Logout'];
    const LoggedOutSettings = ['Login'];
    return (
        <AppBar position="static" sx={{backgroundColor: 'inherit'}}>
            <Toolbar sx={{justifyContent: 'space-between'}}>
                {/* Logo and title */}
                <Box display="flex" alignItems="center" gap={5}>
                    {/*<IconButton edge="start" color="inherit" aria-label="menu" sx={{mr: 2}}>*/}
                    {/*    <MenuIcon/>*/}
                    {/*</IconButton>*/}
                    <IconButton onClick={() => {
                        navigate('/home')
                    }}>
                        <Typography variant="h6" sx={{fontWeight: 'bold', color: 'white'}}>
                            Akkountant
                        </Typography>
                    </IconButton>

                    {/* Center Navigation Buttons */}
                    <Box>
                        <Button sx={{mx: 1}}><Link style={{color: "#FAFAFA"}} to={'/home'}> Home</Link></Button>
                        <Button color="inherit" sx={{mx: 1}}><Link style={{color: "#FAFAFA"}}
                                                                   to={'/transactions'}> Transactions</Link></Button>
                        <Button sx={{mx: 1}}><Link style={{color: "#FAFAFA"}}
                                                   to={'/investments'}> Investments</Link></Button>
                        {/*<Button color="inherit" sx={{mx: 1}}>Settings</Button>*/}
                    </Box>
                </Box>

                {/* Search and Profile */}
                <Box display="flex" alignItems="center">
                    <IconButton onClick={handleOpenUserMenu}>
                        <Avatar
                            sx={{bgcolor: '#5B5B7B'}}>{auth.currentUser ? auth.currentUser.email?.at(0) : ""}</Avatar>
                    </IconButton>
                </Box>
            </Toolbar>
            <Menu
                sx={{
                    mt: '45px'
                }}

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
                {auth.currentUser ? LoggedinSettings.map((setting) => (
                    <MenuItem style={{backgroundColor: "#121C24", color: "#FAFAFA"}} key={setting}
                              onClick={handleLogOut}>
                        <Typography sx={{textAlign: 'center'}}>{setting}</Typography>
                    </MenuItem>
                )) : LoggedOutSettings.map((setting) => (
                    <MenuItem style={{backgroundColor: "#121C24", color: "#FAFAFA"}} key={setting}
                              onClick={() => {
                                  navigate('/login')
                              }}>
                        <Typography sx={{textAlign: 'center'}}>{setting}</Typography>
                    </MenuItem>
                ))}
            </Menu>
        </AppBar>
    );
};

export default Header;
