import {useState} from 'react';
import {Sidebar, Menu, MenuItem} from 'react-pro-sidebar';
import {Link, useNavigate} from 'react-router-dom';
import AccountBalanceIcon from '@mui/icons-material/AccountBalance';
import PaidIcon from '@mui/icons-material/Paid';
import LogoutIcon from '@mui/icons-material/Logout';
import {getAuth, signOut} from 'firebase/auth';
import HomeIcon from '@mui/icons-material/Home';

const SideBar = () => {
    const [collapsed, setCollapsed] = useState(true);
    const navigate = useNavigate()

    async function logOut() {
        const auth = getAuth();
        try {
            await signOut(auth);
            navigate('/')
        } catch (error) {
            console.error('Error logging out:', error);
        }
    }

    return (
        <div
            onMouseEnter={() => setCollapsed(false)}
            onMouseLeave={() => setCollapsed(true)}
        >
            <Sidebar collapsed={collapsed} collapsedWidth={'60px'}>
                <Menu
                    menuItemStyles={{
                        button: {
                            [`&.active`]: {
                                backgroundColor: '#13395e',
                                color: '#b6c8d9',
                            },
                        },
                    }}
                >
                    <MenuItem icon={<HomeIcon/>} component={<Link to="/home"/>}>
                        Home
                    </MenuItem>
                    <MenuItem icon={<AccountBalanceIcon/>} component={<Link to="/transactions"/>}>
                        Transaction
                    </MenuItem>
                    <MenuItem icon={<PaidIcon/>} component={<Link to="/investments"/>}>
                        Investments
                    </MenuItem>
                    <MenuItem icon={<LogoutIcon/>} onClick={logOut} component={<Link to="/"/>}>
                        Log Out
                    </MenuItem>
                </Menu>
            </Sidebar>
        </div>
    );
};

export default SideBar;
