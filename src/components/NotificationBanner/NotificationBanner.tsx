import {useEffect} from 'react'
import {ToastContainer, toast} from 'react-toastify'
import 'react-toastify/dist/ReactToastify.css' // Import the CSS for styling
import './NotificationBanner.css'
import {useMessage} from "../../contexts/MessageContext.tsx"; // Import your CSS file for styling

const NotificationMessage = (props: any) => {
    const {payload} = useMessage()

    const message = payload.message
    const type = payload.type

    const showSuccess = () => {
        toast.success(message, {
            position: 'top-right',
            autoClose: 5000, // Close after 5 seconds
        })
    }

    const showWarning = () => {
        toast.warning(message, {
            position: 'top-right',
            autoClose: 5000,
        })
    }

    const showError = () => {
        toast.error(message, {
            position: 'top-right',
            autoClose: 5000,
        })
    }

    useEffect(() => {
        if (message !== '') {
            if (type === 'error') {
                showError()
            } else if (type === 'success') {
                showSuccess()
            } else {
                showWarning()
            }
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [payload])

    return (
        <>
            <ToastContainer toastStyle={{backgroundColor: "#121c24", color: "white", border: "3px solid #29384D"}}/>
            {props.children}
        </>
    )
}

export default NotificationMessage
