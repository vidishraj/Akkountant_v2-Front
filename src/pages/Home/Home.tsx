import {useEffect} from "react";
import {useNavigate, useSearchParams} from "react-router-dom";
import {makeDriveTokenRequest, makeTokenRequest} from "../../services/GoogleApiUtils.tsx";
import style from "../Home/Home.module.scss";
import Lottie from "lottie-react";
import homeInvestmentsAnimation from "../../assets/lottieFiles/homeInvestmentsAnimation.json";
import homeTransactionsAnimation from "../../assets/lottieFiles/homeTransactionsAnimation.json";
import homeJobsAnimation from "../../assets/lottieFiles/homeJobsAnimation.json";
import homeFilesAnimation from "../../assets/lottieFiles/files.json";


const Home = () => {
    const [searchParams] = useSearchParams()
    useEffect(() => {
        const scope: string | null = searchParams.get('scope')
        const code: string | null = searchParams.get('code');
        if (code && scope && code.length > 0) {
            if (scope.endsWith('drive.file')) {
                makeDriveTokenRequest(code).catch((error) => {
                    console.error('Drive token request error:', error);
                })
            } else {
                makeTokenRequest(code).catch((error) => {
                    console.error('Token request error:', error);
                })
            }
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])
    const navigate = useNavigate();

    const lottieStyle = { width: 150, height: 150 };

    return (
      <div className={style.homeContainer}>
        <div
          className={style.investmentsContainer}
          onClick={() => navigate("/investments")}
        >
          <Lottie animationData={homeInvestmentsAnimation} loop autoPlay style={lottieStyle} />
          <div className={style.investmentsTag}>Investments</div>
        </div>
        <div
          className={style.transactionsContainer}
          onClick={() => navigate("/transactions")}
        >
          <Lottie animationData={homeTransactionsAnimation} loop autoPlay style={lottieStyle} />
          <div className={style.transactionsTag}>Transactions</div>
        </div>
        <div
          className={style.freelanceContainer}
          onClick={() => navigate("/freelance")}
        >
          <Lottie animationData={homeJobsAnimation} loop autoPlay style={lottieStyle} />
          <div className={style.freelanceTag}>Freelance</div>
        </div>
        <div
          className={style.filesContainer}
          onClick={() => navigate("/files")}
        >
          <Lottie animationData={homeFilesAnimation} loop autoPlay style={lottieStyle} />
          <div className={style.filesTag}>Files</div>
        </div>
      </div>
    );
}

export default Home;