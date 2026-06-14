import {useEffect, useState} from "react";
import {Navigate, useParams} from "react-router-dom";
import style from "./Investments.module.scss";
import MSNHome from "../../components/MSNHome/MSNHome.tsx";
import EPGHome from "../../components/EPGHomeComponent/EPGHome.tsx";
import {useMSNContext} from "../../contexts/MSNContext.tsx";

type AssetSlug = "stocks" | "mf" | "nps" | "epf" | "ppf" | "gold";
const MSN_SLUGS = new Set<AssetSlug>(["stocks", "mf", "nps"]);
const EPG_SLUGS = new Set<AssetSlug>(["epf", "ppf", "gold"]);

const isValidAsset = (s: string | undefined): s is AssetSlug =>
    !!s && (MSN_SLUGS.has(s as AssetSlug) || EPG_SLUGS.has(s as AssetSlug));

/**
 * Detail view at `/investments/:asset` (the dynamic child of the Investments shell).
 *
 * Reads the asset slug from the URL and syncs it into the legacy
 * `state.selectedCard` boolean record so existing readers (MSNHome, EPGHome,
 * MSNSummary, MSNContext.getContextKey, MSNCard, etc.) keep working without a
 * full state-rewire. Unknown slugs redirect back to the landing route.
 *
 * The asset slug is the single source of truth: refresh / deep-link / browser
 * back all flow through this sync.
 *
 * Render of MSNHome/EPGHome is gated on `syncedAsset` so that their mount-time
 * fetches (which call `getServiceType()` → reads `selectedCard`) only fire
 * AFTER the dispatch has landed. Without this gate, a direct nav to
 * `/investments/stocks` would fire the per-asset fetch with the wrong type on
 * first mount (the initial selectedCard is all-false, which collapses to
 * "NPS" in getServiceType).
 */
const InvestmentDetail = () => {
    const {asset} = useParams<{asset: string}>();
    const {state, dispatch} = useMSNContext();
    const [syncedAsset, setSyncedAsset] = useState<AssetSlug | null>(null);

    useEffect(() => {
        if (!isValidAsset(asset)) return;
        dispatch({
            type: "CardSelector",
            payload: {
                stocks: asset === "stocks",
                mf: asset === "mf",
                nps: asset === "nps",
                epf: asset === "epf",
                ppf: asset === "ppf",
                gold: asset === "gold",
            },
        });
    }, [asset, dispatch]);

    // Mark synced only once the context actually reflects the URL — this is what
    // prevents the wrong-type fetch on direct nav (see component-level comment).
    useEffect(() => {
        if (isValidAsset(asset) && state.selectedCard[asset]) {
            setSyncedAsset(asset);
        }
    }, [asset, state.selectedCard]);

    if (!isValidAsset(asset)) {
        return <Navigate to="/investments" replace/>;
    }
    if (syncedAsset !== asset) {
        // Brief blank until sync; MSNHome/EPGHome would otherwise mount with
        // wrong-asset context and fire a stray fetch.
        return <div className={style.detailLayout}/>;
    }

    return (
        <div className={style.detailLayout}>
            {MSN_SLUGS.has(asset) ? <MSNHome/> : <EPGHome/>}
        </div>
    );
};

export default InvestmentDetail;
