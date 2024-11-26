import {useEffect} from "react";
import {Link, useNavigate, useSearchParams} from "react-router-dom";
import {makeDriveTokenRequest, makeTokenRequest} from "../../services/GoogleApiUtils.tsx";
import style from "../Home/Home.module.scss";
import Lottie from "lottie-react";
import homeInvestmentsAnimation from "../../assets/lottieFiles/homeInvestmentsAnimation.json";
import homeTransactionsAnimation from "../../assets/lottieFiles/homeTransactionsAnimation.json";
import {styled} from '@mui/system';
import {
    Box
} from '@mui/material';

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
     const navigate=useNavigate();

    return (

        <div className={style.homeContainer}>
            <div className={style.investmentsContainer} onClick={()=>{navigate('/investments')}}>
               
               <Lottie animationData={homeInvestmentsAnimation} loop={true} autoPlay={true} height={100} width={100} />
               <div className={style.investmentsTag}>Investments</div>
            </div>
            <div className={style.transactionsContainer} onClick={()=>{navigate('/transactions')}}>
                <Lottie animationData={homeTransactionsAnimation} loop={true} autoPlay={true} height={100} width={100} />
                <div className={style.transactionsTag}>Transactions</div>
               
            </div>

        </div>
    )
}


export default Home;