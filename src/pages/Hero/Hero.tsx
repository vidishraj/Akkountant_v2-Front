import { Box, Button, Container, Typography, Paper, useTheme, useMediaQuery } from '@mui/material';
import { styled } from '@mui/system';
import { useNavigate } from 'react-router-dom';
import AccountBalanceWalletIcon from '@mui/icons-material/AccountBalanceWallet';
import EmailIcon from '@mui/icons-material/Email';
import WorkIcon from '@mui/icons-material/Work';
import styles from './Hero.module.scss';

const HeroSection = styled(Box)(({ theme }) => ({
  minHeight: '100vh',
  position: 'relative',
  color: '#FAFAFA',
  padding: theme.spacing(4),
  background: '#121C24',
  '&::before': {
    content: '""',
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundImage: 'url(/hero.jpg)',
    backgroundSize: 'cover',
    backgroundPosition: 'center',
    backgroundRepeat: 'no-repeat',
    opacity: 0.15,
    mixBlendMode: 'overlay',
  }
}));

const FeatureCard = styled(Paper)(({ theme }) => ({
  background: 'rgba(255, 255, 255, 0.03)',
  backdropFilter: 'blur(10px)',
  borderRadius: theme.spacing(2),
  padding: theme.spacing(4),
  height: '100%',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  textAlign: 'center',
  transition: 'all 0.3s ease-in-out',
  border: '2px solid rgba(255, 255, 255, 0.1)',
  boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
  '&:hover': {
    transform: 'translateY(-8px)',
    border: '2px solid rgba(74, 144, 226, 0.5)',
    boxShadow: '0 12px 48px rgba(74, 144, 226, 0.2)',
  },
}));

const StyledButton = styled(Button)(({ theme }) => ({
  borderRadius: '50px',
  padding: '14px 36px',
  fontSize: '1.2rem',
  fontWeight: 600,
  textTransform: 'none',
  transition: 'all 0.3s ease',
  boxShadow: '0 4px 12px rgba(0, 0, 0, 0.2)',
  letterSpacing: '0.5px',
  '&:hover': {
    transform: 'translateY(-2px)',
    boxShadow: '0 6px 16px rgba(0, 0, 0, 0.3)',
  },
}));

const IconWrapper = styled(Box)(({ theme }) => ({
  background: 'rgba(74, 144, 226, 0.15)',
  borderRadius: '50%',
  padding: theme.spacing(3),
  marginBottom: theme.spacing(3),
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  transition: 'all 0.3s ease',
  border: '2px solid rgba(74, 144, 226, 0.3)',
  '&:hover': {
    transform: 'rotate(5deg) scale(1.05)',
    background: 'rgba(74, 144, 226, 0.2)',
  },
}));

const Hero = () => {
  const navigate = useNavigate();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  const handleLearnMore = () => {
    window.location.href = 'https://docs.vidish.space/search/?q=akkountant';
  };

  return (
    <HeroSection className={styles.heroSection}>
      <Container maxWidth="lg">
        <Box 
          sx={{ 
            textAlign: 'center', 
            mb: { xs: 6, md: 10 }, 
            pt: { xs: 6, md: 10 },
            maxWidth: '900px',
            mx: 'auto'
          }}
        >
          <Typography 
            variant="h1" 
            component="h1" 
            sx={{ 
              fontWeight: 800, 
              mb: 3,
              fontSize: { xs: '2.5rem', sm: '3.5rem', md: '4.5rem' },
              color: '#FFFFFF',
              textShadow: '0 2px 4px rgba(0,0,0,0.2)',
              letterSpacing: '1px',
              lineHeight: 1.2
            }}
          >
            Your Personal Finance Guardian
          </Typography>
          <Typography 
            variant="h5" 
            sx={{ 
              mb: 5, 
              color: 'rgba(255, 255, 255, 0.9)',
              fontSize: { xs: '1.2rem', sm: '1.4rem', md: '1.6rem' },
              lineHeight: 1.6,
              fontWeight: 500,
              maxWidth: '800px',
              mx: 'auto',
              textShadow: '0 1px 2px rgba(0,0,0,0.1)'
            }}
          >
            Track investments, monitor transactions, and manage job applications - all in one powerful, intelligent platform
          </Typography>
          <Box sx={{ display: 'flex', gap: 3, justifyContent: 'center', flexWrap: 'wrap' }}>
            <StyledButton
              variant="contained"
              onClick={() => navigate('/login')}
              sx={{
                background: 'linear-gradient(135deg, #4A90E2 0%, #357ABD 100%)',
                color: '#FFFFFF',
                '&:hover': {
                  background: 'linear-gradient(135deg, #357ABD 0%, #2A6298 100%)',
                }
              }}
            >
              Get Started Now
            </StyledButton>
            <StyledButton
              variant="outlined"
              onClick={handleLearnMore}
              sx={{
                borderColor: '#4A90E2',
                borderWidth: '2px',
                color: '#FFFFFF',
                '&:hover': {
                  borderColor: '#4A90E2',
                  background: 'rgba(74, 144, 226, 0.1)',
                  borderWidth: '2px',
                }
              }}
            >
              Learn More
            </StyledButton>
          </Box>
        </Box>

        <Box sx={{ 
          display: 'grid', 
          gridTemplateColumns: { xs: '1fr', md: 'repeat(3, 1fr)' }, 
          gap: 4,
          mt: { xs: 6, md: 10 }
        }}>
          <FeatureCard elevation={0}>
            <IconWrapper>
              <AccountBalanceWalletIcon sx={{ fontSize: 48, color: '#4A90E2' }} />
            </IconWrapper>
            <Typography 
              variant="h5" 
              sx={{ 
                mb: 2, 
                fontWeight: 700,
                color: '#FFFFFF',
                letterSpacing: '0.5px'
              }}
            >
              Investment Tracking
            </Typography>
            <Typography 
              sx={{ 
                color: 'rgba(255, 255, 255, 0.9)',
                lineHeight: 1.8,
                fontSize: '1.1rem'
              }}
            >
              Automatically track your NPS, PPF, EF, Stocks, and Mutual funds through web parsing and free APIs. Stay on top of your investment portfolio effortlessly.
            </Typography>
          </FeatureCard>

          <FeatureCard elevation={0}>
            <IconWrapper>
              <EmailIcon sx={{ fontSize: 48, color: '#4A90E2' }} />
            </IconWrapper>
            <Typography 
              variant="h5" 
              sx={{ 
                mb: 2, 
                fontWeight: 700,
                color: '#FFFFFF',
                letterSpacing: '0.5px'
              }}
            >
              Smart Transaction Tracking
            </Typography>
            <Typography 
              sx={{ 
                color: 'rgba(255, 255, 255, 0.9)',
                lineHeight: 1.8,
                fontSize: '1.1rem'
              }}
            >
              Never miss a transaction with our intelligent email and bank statement parsing. Get a clear view of your spending patterns and financial health.
            </Typography>
          </FeatureCard>

          <FeatureCard elevation={0}>
            <IconWrapper>
              <WorkIcon sx={{ fontSize: 48, color: '#4A90E2' }} />
            </IconWrapper>
            <Typography 
              variant="h5" 
              sx={{ 
                mb: 2, 
                fontWeight: 700,
                color: '#FFFFFF',
                letterSpacing: '0.5px'
              }}
            >
              Job Application Manager
            </Typography>
            <Typography 
              sx={{ 
                color: 'rgba(255, 255, 255, 0.9)',
                lineHeight: 1.8,
                fontSize: '1.1rem'
              }}
            >
              Keep track of your job applications through automated email scanning. Stay organized in your job search with minimal effort.
            </Typography>
          </FeatureCard>
        </Box>
      </Container>
    </HeroSection>
  );
};

export default Hero; 