import {useEffect} from "react";
import {useSearchParams} from "react-router-dom";
import {makeDriveTokenRequest, makeTokenRequest} from "../services/GoogleApiUtils.tsx";

const HomePage = () => {
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

        <div style={{backgroundColor: 'palegoldenrod'}}>
        </div>
    )
}


export default HomePage;