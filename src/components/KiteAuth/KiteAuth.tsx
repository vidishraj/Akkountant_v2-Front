import React, { useState } from 'react';
import { Button, Dialog, DialogTitle, DialogContent, DialogActions, Typography, Alert, CircularProgress } from '@mui/material';
import { Link as LinkIcon } from '@mui/icons-material';
import { getKiteLoginUrl } from '../../services/investmentService';
import styles from './KiteAuth.module.scss';

const KiteAuth: React.FC = () => {
    const [open, setOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const [step, setStep] = useState<'initial' | 'login'>('initial');
    const [error, setError] = useState<string>('');

    const handleKiteLogin = async () => {
        try {
            setLoading(true);
            setError('');
            
            const response = await getKiteLoginUrl();
            
            // Redirect to Kite login URL directly
            window.location.href = response.login_url;
            
        } catch (error) {
            console.error('Error getting Kite login URL:', error);
            setError('Failed to get Kite login URL');
            setStep('initial');
        } finally {
            setLoading(false);
        }
    };

    const handleClose = () => {
        if (!loading) {
            setOpen(false);
            setStep('initial');
            setError('');
        }
    };

    const renderContent = () => {
        switch (step) {
            case 'initial':
                return (
                    <>
                        <DialogContent>
                            <Typography variant="body1" paragraph>
                                Connect your Zerodha account to automatically sync your stock holdings and positions.
                            </Typography>
                            <Typography variant="body2" color="text.secondary" paragraph>
                                You'll be redirected to Zerodha Kite for secure authentication.
                            </Typography>
                            {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}
                        </DialogContent>
                        <DialogActions>
                            <Button onClick={handleClose} disabled={loading}>
                                Cancel
                            </Button>
                            <Button 
                                variant="contained" 
                                onClick={handleKiteLogin}
                                disabled={loading}
                                startIcon={loading ? <CircularProgress size={20} /> : <LinkIcon />}
                            >
                                {loading ? 'Connecting...' : 'Connect to Kite'}
                            </Button>
                        </DialogActions>
                    </>
                );

            case 'login':
                return (
                    <>
                        <DialogContent>
                            <Typography variant="body1" paragraph>
                                Redirecting to Zerodha Kite for authentication...
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                                You will be redirected back to this page after authentication.
                            </Typography>
                        </DialogContent>
                        <DialogActions>
                            <Button onClick={handleClose}>Cancel</Button>
                        </DialogActions>
                    </>
                );


            default:
                return null;
        }
    };

    return (
        <>
            <Button
                className={styles.kiteButton}
                variant="contained"
                onClick={() => setOpen(true)}
            >
                <LinkIcon style={{color: "black"}}/>
            </Button>

            <Dialog 
                open={open} 
                onClose={handleClose}
                maxWidth="sm"
                fullWidth
                disableEscapeKeyDown={loading}
            >
                <DialogTitle>
                    Connect to Zerodha Kite
                </DialogTitle>
                {renderContent()}
            </Dialog>
        </>
    );
};

export default KiteAuth;