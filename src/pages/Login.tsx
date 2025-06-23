// src/Login.tsx
import React, {useEffect, useState} from 'react';
import {signInWithEmailAndPassword} from 'firebase/auth';
import {useNavigate, useSearchParams} from 'react-router-dom';
import {
    Box,
    Button,
    TextField,
    CircularProgress,
} from '@mui/material';
import {styled} from '@mui/system';
import Lottie from 'lottie-react';
import loginAnimation from '../assets/loginAnimation.json';
import {useUser} from '../contexts/GlobalContext';
import {auth} from '../components/FirebaseConfig.tsx';
// import SignupDialog from '../components/Signup';
import {useAuth} from '../contexts/AuthContext';

const Container = styled(Box)(({theme}) => ({
    display: 'flex',
    flexWrap: 'nowrap',
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
    height: '84vh',
    backgroundColor: 'beige',
    [theme.breakpoints.down('sm')]: {
        display: 'block'
    }, [theme.breakpoints.down('md')]: {
        display: 'block'
    }
}));


const LottieContainers = styled(Box)(({theme}) => ({
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: '60vh',
    flexBasis: '30%', // Default space taken
    [theme.breakpoints.down('sm')]: {
        position: 'absolute',
        display: 'block',
        backgroundColor: 'beige',
        zIndex: '-1',
        maxHeight: '50vh',
        '&:first-of-type': {
            top: 0,
            left: 0,
        },
        '&:last-of-type': {
            top: '50%',
        },
    },
    [theme.breakpoints.down('md')]: {
        position: 'absolute',
        backgroundColor: 'beige',
        overflow: 'hidden',
        zIndex: '-1',
        maxHeight: '70vh',
        '&:first-of-type': {
            top: 0,
            left: 0,
        },
        '&:last-of-type': {
            top: '50%',
        },
    },
}));

const LoginBox = styled(Box)(({theme}) => ({
    backgroundColor: 'white',
    borderRadius: '10%',
    boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
    padding: '24px',
    maxWidth: '300px',
    maxHeight: 'fit-content',
    [theme.breakpoints.down('sm')]: {
        boxShadow: 'none',
        position: 'absolute',
        top: '50%',
        left: '50%',
        transform: 'translate(-40%, -50%)',
        width: '250px'
    },
    [theme.breakpoints.down('md')]: {
        boxShadow: 'none',
        position: 'absolute',
        top: '50%',
        left: '50%',
        transform: 'translate(-40%, -50%)',
        width: '250px'
    },
}));


const Login = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    // const [openSignup, setOpenSignup] = useState(false);
    const {setUser} = useUser();
    const navigate = useNavigate();
    const {currentUser} = useAuth();
    const [searchParams] = useSearchParams();
    const returnUrl = searchParams.get('returnUrl');

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            const userCredential = await signInWithEmailAndPassword(
                auth,
                email,
                password
            );
            setUser(userCredential.user);
            navigate(returnUrl ? decodeURIComponent(returnUrl) : '/home');
        } catch (error) {
            console.error('Error logging in:', error);
        } finally {
            setLoading(false);
        }
    };

    // const handleOpenSignup = () => {
    //     setOpenSignup(true);
    // };
    //
    // const handleCloseSignup = () => {
    //     setOpenSignup(false);
    // };
    useEffect(() => {
        if (currentUser) {
            setUser(currentUser);
            navigate(returnUrl ? decodeURIComponent(returnUrl) : '/home');
        } // eslint-disable-next-line
    }, [currentUser]);

    return (<>
        <Container>
            <LottieContainers>
                <Lottie animationData={loginAnimation} loop={true} height={300} width={300}/>
            </LottieContainers>
            <LoginBox>
                <form onSubmit={handleLogin}>
                    <TextField
                        fullWidth
                        label="Email"
                        variant="outlined"
                        margin="normal"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                    />
                    <TextField
                        fullWidth
                        label="Password"
                        type="password"
                        variant="outlined"
                        margin="normal"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                    />
                    <Button
                        fullWidth
                        variant="contained"
                        color="primary"
                        type="submit"
                        disabled={loading}
                        sx={{mt: 2}}
                    >
                        {loading ? <CircularProgress size={24}/> : 'Login'}
                    </Button>
                </form>
                {/*<Button*/}
                {/*    variant="text"*/}
                {/*    color="secondary"*/}
                {/*    fullWidth*/}
                {/*    onClick={handleOpenSignup}*/}
                {/*    style={{marginTop: '8px'}}*/}
                {/*>*/}
                {/*    Don't have an account? Sign Up*/}
                {/*</Button>*/}
            </LoginBox>
            {/*<SignupDialog open={openSignup} onClose={handleCloseSignup}/>*/}
        </Container>
    </>)
}


export default Login;

