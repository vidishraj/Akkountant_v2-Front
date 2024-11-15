import {useEffect} from "react";
import {useAuth} from "../contexts/AuthContext.tsx";

const HomePage = () => {
    const {currentUser} = useAuth()
    useEffect(() => {

    }, [])
    return (

        <div style={{backgroundColor: 'palegoldenrod'}}>
            {
                currentUser ? <div>User logged in</div> : <div>Not logged in </div>
            }
        </div>
    )
}


export default HomePage;