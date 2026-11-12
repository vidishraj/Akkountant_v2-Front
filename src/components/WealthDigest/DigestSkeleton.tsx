import React from "react";
import style from "./WealthDigest.module.scss";

/**
 * FE-6 (ak-jhy8) Nocturne-skinned skeleton fallback. MUI Skeleton replaced
 * with CSS-driven shimmer bars via the `.skeletonBar` class (defined in
 * WealthDigest.module.scss with a `@keyframes` pulse).
 */
const DigestSkeleton: React.FC = () => {
    return (
        <div className={style.skeletonRoot}>
            <div className={style.skeletonHeader}>
                <span className={style.skeletonBar} style={{width: 180, height: 28}}/>
                <span className={style.skeletonBar} style={{width: 140, height: 22}}/>
            </div>
            <div className={style.skeletonTileRow}>
                {[0, 1, 2, 3, 4].map((i) => (
                    <span key={i} className={`${style.skeletonBar} ${style.skeletonTile}`}/>
                ))}
            </div>
            <div className={style.skeletonBody}>
                {[90, 95, 80, 88, 70].map((w, i) => (
                    <span key={i} className={style.skeletonBar} style={{width: `${w}%`, height: 24}}/>
                ))}
            </div>
        </div>
    );
};

export default DigestSkeleton;
