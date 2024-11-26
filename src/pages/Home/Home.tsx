import {useEffect} from "react";
import {useSearchParams} from "react-router-dom";
import {makeDriveTokenRequest, makeTokenRequest} from "../../services/GoogleApiUtils.tsx";
import style from "../Home/Home.module.scss";
import Lottie from "lottie-react";
import homeInvestmentsAnimation from "../../assets/lottieFiles/homeInvestmentsAnimation.json";
import homeTransactionsAnimation from "../../assets/lottieFiles/homeTransactionsAnimation.json";
import {styled} from '@mui/system';
import {
    Box
} from '@mui/material';

const LottieContainers = styled(Box)(({ theme }) => ({
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: '60vh',
    width:"60vh",
    overflow:"visible",
    objectFit:"contain",
    [theme.breakpoints.down('sm')]: {
      display: 'flex',
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
      display: 'flex',
    maxHeight: '70vh',
    overflow: 'hidden',
      '&:first-of-type': {
        top: 0,
        left: 0,
      },
      '&:last-of-type': {
        top: '50%',
      },
    },
  }));

const Home = () => {
    const [searchParams] = useSearchParams()
    useEffect(() => {
        const scope: string | null = searchParams.get('scope')
        const code: string | null = searchParams.get('code');
        if (code && scope && code.length > 0) {
            if (scope.endsWith('drive.file')) {
                makeDriveTokenRequest(code).catch((error) => {
                    console.log(error);
                })
            } else {
                makeTokenRequest(code).catch((error) => {
                    console.log(error);
                })
            }
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    return (

        <div className={style.homeContainer}>
            <div className={style.investmentsContainer}>
                <Lottie animationData={homeInvestmentsAnimation} loop={true} autoPlay={true} height={100} width={100} />
                <div className={style.investmentsTag}>Investments</div>
            </div>
            <div className={style.transactionsContainer}>
                <Lottie animationData={homeTransactionsAnimation} loop={true} autoPlay={true} height={100} width={100} />
                <div className={style.transactionsTag}>Transactions</div>
            </div>

        </div>
    )
}


export default Home;