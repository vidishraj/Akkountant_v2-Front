import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from "react";
import { auth } from "../components/FirebaseConfig";
import { onAuthStateChanged } from "firebase/auth";
import {
  WealthDigest,
  WealthDigestError,
  fetchLatestDigest,
} from "../services/wealthDigestService";

/**
 * Bootstraps and holds the *latest* wealth digest for nav-badge purposes and
 * for the WealthDigest page to consume without a duplicate initial fetch.
 *
 * Fetch lifecycle:
 * - On auth-ready (signed-in user): kick one `fetchLatestDigest`. Cache the
 *   result until the user reloads the page (~SPA session).
 * - On sign-out: clear everything.
 * - `refresh()` re-fetches on demand — the page uses this after a successful
 *   mark-read to keep the shared record in sync.
 *
 * We deliberately do NOT poll here. The digest is generated once per day; a
 * page reload catches any newly-arrived digest, and this is a "check once at
 * app-boot" surface, not a live feed.
 */
interface WealthDigestContextType {
  digest: WealthDigest | null;
  loading: boolean;
  error: WealthDigestError | null;
  /** True when there's a digest and the user hasn't read it yet. Nav uses this. */
  hasUnread: boolean;
  /** Re-fetch the latest digest (used after mark-read to sync state). */
  refresh: () => Promise<void>;
  /**
   * Locally suppress the badge until the next fetch — useful for optimistic
   * mark-read so the badge disappears immediately even before the POST returns.
   */
  markReadLocal: () => void;
}

const WealthDigestContext = createContext<WealthDigestContextType | undefined>(
  undefined
);

interface WealthDigestProviderProps {
  children: ReactNode;
}

export const WealthDigestProvider: React.FC<WealthDigestProviderProps> = ({
  children,
}) => {
  const [digest, setDigest] = useState<WealthDigest | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<WealthDigestError | null>(null);
  const [locallyRead, setLocallyRead] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const d = await fetchLatestDigest();
      setDigest(d);
    } catch (err) {
      if (err instanceof WealthDigestError) {
        setError(err);
      } else {
        // Coerce anything unexpected into a transient error so the UI still
        // has a discriminated code to render against.
        setError(new WealthDigestError(0, "transient", String(err)));
      }
      setDigest(null);
    } finally {
      setLoading(false);
    }
  }, []);

  const refresh = useCallback(async () => {
    // Do NOT reset locallyRead before the fetch resolves — otherwise the
    // badge briefly re-appears while the request is in flight (nav-dot
    // flicker after mark-read). We let the fetched digest's own read_at
    // field carry the truth: if BE returns read_at populated, the
    // computed hasUnread will already be false; if not, locallyRead's
    // still-true value keeps the badge suppressed until the next full
    // reset (sign-out, or an explicit second markReadLocal(false) — which
    // we currently don't ship because there's no "mark unread" affordance).
    await load();
  }, [load]);

  const markReadLocal = useCallback(() => setLocallyRead(true), []);

  // Fetch once on auth-ready; clear on sign-out.
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        void load();
      } else {
        setDigest(null);
        setError(null);
        setLocallyRead(false);
      }
    });
    return unsubscribe;
  }, [load]);

  const hasUnread =
    !!digest && !digest.read_at && !locallyRead;

  return (
    <WealthDigestContext.Provider
      value={{ digest, loading, error, hasUnread, refresh, markReadLocal }}
    >
      {children}
    </WealthDigestContext.Provider>
  );
};

export const useWealthDigest = (): WealthDigestContextType => {
  const ctx = useContext(WealthDigestContext);
  if (!ctx) {
    throw new Error(
      "useWealthDigest must be used within a WealthDigestProvider"
    );
  }
  return ctx;
};
