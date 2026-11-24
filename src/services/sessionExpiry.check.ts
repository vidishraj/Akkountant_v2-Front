// Checks for services/sessionExpiry.ts (ak-p612). No test runner; run:
//   npx esbuild src/services/sessionExpiry.check.ts --bundle --platform=node \
//     --format=esm --outfile=node_modules/.cache/sessionExpiry.check.mjs \
//     && node node_modules/.cache/sessionExpiry.check.mjs
import {
    clearSessionExpired,
    currentSessionExpiry,
    isSessionUnauthorized,
    notifySessionExpired,
    onSessionExpired,
    reportIfSessionUnauthorized,
    resolveIdToken,
} from "./sessionExpiry.ts";

let failures = 0;
const check = (label: string, actual: unknown, expected: unknown): void => {
    if (JSON.stringify(actual) === JSON.stringify(expected)) {
        console.log(`ok   ${label}`);
        return;
    }
    failures += 1;
    console.log(`FAIL ${label}: got ${JSON.stringify(actual)}, want ${JSON.stringify(expected)}`);
};

const UID = "uid-SYNTHETIC-123";
// Fake Firebase user: `script` says how each getIdToken(force) call behaves.
const fakeUser = (script: ("ok" | "fail")[]) => {
    const calls: boolean[] = [];
    return {
        uid: UID,
        calls,
        getIdToken: async (force?: boolean) => {
            calls.push(!!force);
            const step = script[calls.length - 1] ?? "fail";
            if (step === "fail") throw new Error("auth/network-request-failed");
            return force ? "jwt-fresh" : "jwt-cached";
        },
    };
};

(async () => {
    let unavailable = 0;
    const onUnavail = () => { unavailable += 1; };

    const u1 = fakeUser(["ok"]);
    check("cached token used", await resolveIdToken(u1, onUnavail), "jwt-cached");
    check("no forced refresh when cached works", u1.calls, [false]);

    const u2 = fakeUser(["fail", "ok"]);
    check("one forced refresh after a failure", await resolveIdToken(u2, onUnavail), "jwt-fresh");
    check("refresh sequence = cached then forced", u2.calls, [false, true]);

    const u3 = fakeUser(["fail", "fail"]);
    const r3 = await resolveIdToken(u3, onUnavail);
    check("both fail → null", r3, null);
    check("both fail → NEVER the uid", r3 === UID, false);
    check("exactly one forced retry (no loop)", u3.calls, [false, true]);
    check("session-expired raised once", unavailable, 1);

    // Default handler raises the app-wide state; repeated failures don't spam.
    clearSessionExpired();
    let fired = 0;
    const off = onSessionExpired(() => { fired += 1; });
    await resolveIdToken(fakeUser(["fail", "fail"]));
    await resolveIdToken(fakeUser(["fail", "fail"]));
    check("default handler sets token_unavailable", currentSessionExpiry(), "token_unavailable");
    check("listeners notified once while already expired", fired, 1);
    clearSessionExpired();
    notifySessionExpired("unauthorized");
    check("after clear, a new expiry fires again", fired, 2);
    off();
    clearSessionExpired();

    // 401 classification.
    check("401 → session expired", isSessionUnauthorized(401, {detail: "invalid token"}), true);
    check("401 with no body → session expired", isSessionUnauthorized(401, undefined), true);
    check("Kite reconnect 401 is NOT session expiry", isSessionUnauthorized(401, {reconnect_required: true, login_url: "x"}), false);
    // Review MINOR-1b: exemption is the reconnect_required flag only.
    check("plain 401 (any endpoint, incl. kite) with a credential → session", isSessionUnauthorized(401, {error: "Unauthorized - expired"}), true);
    // Review MINOR-1: no credential sent → never a session expiry.
    check("401 for a request without X-Firebase-ID → NOT session", isSessionUnauthorized(401, {error: "Unauthorized"}, false), false);
    clearSessionExpired();
    reportIfSessionUnauthorized(401, {reconnect_required: true});
    check("reportIf…: Kite reconnect 401 does not latch", currentSessionExpiry(), null);
    reportIfSessionUnauthorized(401);
    check("reportIf…: plain 401 latches 'unauthorized'", currentSessionExpiry(), "unauthorized");
    clearSessionExpired();
    reportIfSessionUnauthorized(500);
    check("reportIf…: 500 does not latch", currentSessionExpiry(), null);
    check("403 is not 401", isSessionUnauthorized(403, {}), false);
    check("500 is not 401", isSessionUnauthorized(500, {}), false);

    if (failures > 0) {
        console.log(`\n${failures} session check(s) FAILED`);
        process.exit(1);
    }
    console.log("\nAll session checks passed");
})();
