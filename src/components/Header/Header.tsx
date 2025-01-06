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
    ListItemText
} from '@mui/material';
import {Link, useNavigate} from 'react-router-dom';
import styles from './Header.module.scss';
import {auth} from "../FirebaseConfig.tsx";
import Menu from '@mui/material/Menu';
import {useEffect, useState} from "react";
import {getAuth} from "firebase/auth";
import SettingsIcon from '@mui/icons-material/Settings';
import AssuredWorkloadIcon from '@mui/icons-material/AssuredWorkload';
import LockResetIcon from '@mui/icons-material/LockReset';
import ChangepasswordDialog from '../ChangePasswordDialog/ChangepasswordDialog.tsx';
import {fetchOptedBanks} from '../../services/transactionService.ts';
import {useMessage} from '../../contexts/MessageContext.tsx';
import JobsDialog from "../JobsDialogComponent/JobsDialogComponent.tsx";

import WorkHistoryIcon from '@mui/icons-material/WorkHistory';
import OptBanksDialog from "../OptBanksDialogComponent/OptBanksDialog.tsx";

const Header = () => {
    const [anchorElUser, setAnchorElUser] = useState<any>(null);
    const [isDrawerOpen, setDrawerOpen] = useState(false);
    const [isDialogOpen, setDialogOpen] = useState(false);
    const [isBankDialogOpen, setBankDialogOpen] = useState(false);
    const [optedBanks, setOptedBanks] = useState<string[]>([]);
    const {setPayload} = useMessage();
    const navigate = useNavigate();

    const [isJobsDialogOpen, setJobsDialogOpen] = useState<boolean>(false);
    useEffect(() => {
        if (auth.currentUser) {
            fetchOptedBanks()
                .then((data) => Array.isArray(data) && setOptedBanks(data))
                .catch(() => setPayload({type: "error", message: "Failed to fetch opted banks. Please try again!"}));
        }
    }, [auth.currentUser]);


    return (
        <>
            <AppBar position="static" sx={{backgroundColor: 'inherit', borderBottom: '0.7px solid white'}}>
                <Toolbar sx={{justifyContent: 'space-between'}}>
                    <Box className={styles.linkContainer}>
                        <Typography sx={{fontWeight: 'bold'}} className={styles.icon}>
                            <Link style={{color: "#FAFAFA", fontWeight: "700"}} to={'/home'}>Akkountant</Link>
                        </Typography>
                        <Button sx={{mx: 1}} className={styles.links}>
                            <Link style={{color: "#FAFAFA"}} to={'/transactions'}>Transactions</Link>
                        </Button>
                        <Button sx={{mx: 1}} className={styles.links}>
                            <Link style={{color: "#FAFAFA"}} to={'/investments'}>Investments</Link>
                        </Button>
                    </Box>
                    <Box display="flex" alignItems="center">
                        <IconButton onClick={(e) => setAnchorElUser(e.currentTarget)}>
                            <Avatar sx={{bgcolor: '#5B5B7B'}}>{auth.currentUser?.email?.[0] || ""}</Avatar>
                        </IconButton>
                    </Box>
                </Toolbar>
                <Menu
                    sx={{mt: '45px'}}
                    MenuListProps={{sx: {py: 0}}}
                    anchorOrigin={{
                        vertical: 'top',
                        horizontal: 'right',
                    }}
                    transformOrigin={{
                        vertical: 'top',
                        horizontal: 'right',
                    }}
                    id="menu-appbar"
                    anchorEl={anchorElUser}
                    open={Boolean(anchorElUser)}
                    onClose={() => setAnchorElUser(null)}
                >
                    {auth.currentUser
                        ? ['Logout', 'Settings'].map((setting) => (
                            <MenuItem
                                key={setting}
                                style={{backgroundColor: "#121C24", color: "#FAFAFA"}}
                                onClick={setting === 'Settings' ? () => {
                                    setDrawerOpen(true);
                                    setAnchorElUser(null);
                                } : () => {
                                    setAnchorElUser(null);
                                    getAuth().signOut().then(() => navigate('/')).catch(() => setPayload({
                                        type: "error",
                                        message: "Error logging out."
                                    }));
                                }}
                            >
                                <Typography sx={{textAlign: 'center'}}>{setting}</Typography>
                            </MenuItem>
                        ))
                        : ["Login"].map((setting) => (
                            <MenuItem
                                key={setting}
                                style={{backgroundColor: "#121C24", color: "#FAFAFA"}}
                                onClick={() => navigate('/login')}
                            >
                                <Typography sx={{textAlign: 'center'}}>{setting}</Typography>
                            </MenuItem>
                        ))}
                </Menu>
            </AppBar>

            <Drawer anchor="right" open={isDrawerOpen} onClose={() => setDrawerOpen(false)}>
                <Box sx={{width: 250, backgroundColor: "#121C24", height: "100%", color: "#FAFAFA", p: 2}}>
                    <Typography variant="h6" sx={{fontWeight: 'bold', mb: 2}}>
                        <SettingsIcon style={{verticalAlign: "middle"}}/> Settings
                    </Typography>
                    <Divider/>
                    <List>
                        <ListItem onClick={() => setBankDialogOpen(true)} sx={{cursor: "pointer"}}>
                            <AssuredWorkloadIcon style={{marginRight: "0.5rem"}}/>
                            <Typography>Select Banks</Typography>
                        </ListItem>
                        <ListItem onClick={() => setDialogOpen(true)} sx={{cursor: "pointer"}}>
                            <LockResetIcon style={{marginRight: "0.5rem"}}/>
                            <Typography>Change Password</Typography>
                        </ListItem>
                        <ListItem sx={{
                            cursor: "pointer", "&:hover": {
                                backgroundColor: "rgb(50, 62, 74)"
                            }
                        }} onClick={() => setJobsDialogOpen(true)}>
                            <WorkHistoryIcon style={{marginRight: "0.5rem"}}/><ListItemText
                            primary="Jobs" sx={{color: "white", cursor: "pointer"}}/>
                        </ListItem>
                        {optedBanks.length > 0 && (
                            <Box sx={{mt: 15, pl: 2}}>
                                <Typography sx={{fontWeight: "bold"}}>Opted Banks</Typography>
                                <List>
                                    {optedBanks.map((bank, index) => (
                                        <ListItem key={index} sx={{padding: 0}}>
                                            <Typography>{bank.replace(/_/g, " ")}</Typography>
                                        </ListItem>
                                    ))}
                                </List>
                            </Box>
                        )}
                        <ChangepasswordDialog open={isDialogOpen} onClose={() => setDialogOpen(false)}/>
                        <JobsDialog open={isJobsDialogOpen} onClose={() => setJobsDialogOpen(false)}/>
                        <OptBanksDialog isBankDialogOpen={isBankDialogOpen} setBankDialogOpen={setBankDialogOpen}/>
                    </List>
                </Box>
            </Drawer>


        </>
    );
};

export default Header;
