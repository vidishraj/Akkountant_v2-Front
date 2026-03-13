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
import {useAuth} from '../contexts/AuthContext';
import {useMessage} from '../contexts/MessageContext.tsx';

const Container = styled(Box)(({theme}) => ({
    display: 'flex',
    flexWrap: 'nowrap',
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
    height: '84vh',
    backgroundColor: 'beige',
    [theme.breakpoints.down('md')]: {
        display: 'block'
    }
}));


const LottieContainers = styled(Box)(({theme}) => ({
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: '60vh',
    flexBasis: '30%',
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
    color: '#333',
    borderRadius: '10%',
    boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
    padding: '24px',
    maxWidth: '300px',
    maxHeight: 'fit-content',
    [theme.breakpoints.down('md')]: {
        boxShadow: 'none',
        position: 'absolute',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        width: '250px'
    },
}));


const Login = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const {setUser} = useUser();
    const {setPayload} = useMessage();
    const navigate = useNavigate();
    const {currentUser, loading: authLoading} = useAuth();
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
        } catch (error: unknown) {
            const msg = error instanceof Error ? error.message : 'Login failed';
            setPayload({type: 'error', message: msg.replace('Firebase: ', '')});
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (!authLoading && currentUser) {
            setUser(currentUser);
            navigate(returnUrl ? decodeURIComponent(returnUrl) : '/home');
        }
    }, [currentUser, authLoading, navigate, returnUrl, setUser]);
    
    // Show loading while checking authentication
    if (authLoading) {
        return (
            <Box 
                sx={{ 
                    display: 'flex', 
                    justifyContent: 'center', 
                    alignItems: 'center', 
                    minHeight: '100vh',
                    backgroundColor: 'beige',
                    color: '#333'
                }}
            >
                Loading...
            </Box>
        );
    }

    return (
        <Container>
            <LottieContainers>
                <Lottie animationData={loginAnimation} loop style={{width: 300, height: 300}}/>
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
                        sx={{
                            '& label': {color: '#666 !important'},
                            '& label.Mui-focused': {color: '#1976d2 !important'},
                            '& input': {color: '#333 !important'},
                            '& .MuiOutlinedInput-notchedOutline': {borderColor: '#ccc !important'},
                            '&:hover .MuiOutlinedInput-notchedOutline': {borderColor: '#999 !important'},
                            '& .Mui-focused .MuiOutlinedInput-notchedOutline': {borderColor: '#1976d2 !important'},
                        }}
                    />
                    <TextField
                        fullWidth
                        label="Password"
                        type="password"
                        variant="outlined"
                        margin="normal"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        sx={{
                            '& label': {color: '#666 !important'},
                            '& label.Mui-focused': {color: '#1976d2 !important'},
                            '& input': {color: '#333 !important'},
                            '& .MuiOutlinedInput-notchedOutline': {borderColor: '#ccc !important'},
                            '&:hover .MuiOutlinedInput-notchedOutline': {borderColor: '#999 !important'},
                            '& .Mui-focused .MuiOutlinedInput-notchedOutline': {borderColor: '#1976d2 !important'},
                        }}
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
            </LoginBox>
        </Container>
    )
}


export default Login;

