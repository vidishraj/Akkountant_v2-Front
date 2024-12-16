import React, {ComponentType} from "react";
import Loader from "./Loader";

interface WithLoaderProps {
    isLoading: boolean;
}

const withLoader = <P extends object>(
    WrappedComponent: ComponentType<P>
): React.FC<P & WithLoaderProps> => {
    return ({
                isLoading,
                ...props
            }) => {
        return (
            <div style={{position: "relative"}}>
                {isLoading && <Loader/>}
                <WrappedComponent {...(props as P)} />
            </div>
        );
    };
};

export default withLoader;
