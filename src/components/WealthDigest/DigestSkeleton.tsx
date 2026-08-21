import React from "react";
import { Box, Skeleton } from "@mui/material";
import style from "./WealthDigest.module.scss";

/**
 * Skeleton fallback for the WealthDigest page while both the digest fetch
 * and the MSNContext bootstrap are pending. Matches the final layout closely
 * (tile row + text block) so the transition to real content doesn't feel
 * jumpy.
 *
 * Uses MUI Skeleton's default wave animation. If perf-sensitive contexts
 * later show up (throttled mobile), swap to `variant="text" animation={false}`.
 */
const DigestSkeleton: React.FC = () => {
  return (
    <Box className={style.skeletonRoot}>
      <Box className={style.skeletonHeader}>
        <Skeleton variant="text" width={180} height={28} />
        <Skeleton variant="text" width={140} height={22} />
      </Box>
      <Box className={style.skeletonTileRow}>
        {[0, 1, 2, 3, 4].map((i) => (
          <Skeleton
            key={i}
            variant="rectangular"
            className={style.skeletonTile}
          />
        ))}
      </Box>
      <Box className={style.skeletonBody}>
        <Skeleton variant="text" width="90%" height={24} />
        <Skeleton variant="text" width="95%" height={24} />
        <Skeleton variant="text" width="80%" height={24} />
        <Skeleton variant="text" width="88%" height={24} />
        <Skeleton variant="text" width="70%" height={24} />
      </Box>
    </Box>
  );
};

export default DigestSkeleton;
