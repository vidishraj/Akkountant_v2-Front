// ak-tduq / FE-23: Nocturne dark-theme rewrite of the sign-in surface.
// Pre-ak-tduq Login used MUI (Container/Box/TextField/Button + Lottie) on a
// `backgroundColor:'beige'` ground with a white rounded card — a jarring
// handoff into the Nocturne dark app. Rewrite:
//   - MUI + Lottie removed entirely (no runtime deps consumed)
//   - Native HTML form + Nocturne global classes (`field`, `input`,
//     `btn btn-primary btn-block`) from `styles/nocturne.css`
//   - Brand mark (Ak chip + 'Akkountant' wordmark) matches Header's
//     `.brandChip` / `.brandWord` tokens so the sign-in moment uses the
//     same visual vocabulary as the authed app
//   - Radial accent glow on a dark ground mirrors the Home.dc.html
//     top-left-glow pattern (centered here since the Login card itself
//     is centered rather than left-aligned like the Home hero).
//
// Firebase wire UNCHANGED per bead: signInWithEmailAndPassword(auth,
// email, password) → setUser(...) → navigate(returnUrl || '/home');
// errors routed through setPayload with the 'Firebase: ' prefix stripped.
// The authLoading guard + currentUser redirect effect are preserved
// byte-equivalent.
import React, {useEffect, useState} from 'react';
import {signInWithEmailAndPassword} from 'firebase/auth';
import {useNavigate, useSearchParams} from 'react-router-dom';
import {useUser} from '../contexts/GlobalContext';
import {auth} from '../components/FirebaseConfig.tsx';
import {useAuth} from '../contexts/AuthContext';
import {useMessage} from '../contexts/MessageContext.tsx';
import style from './Login.module.scss';

const Login = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const {setUser} = useUser();
    const {setPayload} = useMessage();
    const navigate = useNavigate();
    const {currentUser, loading: authLoading} = useAuth();
    const [searchParams] = useSearchParams();
    const returnUrl = searchParams.get('returnUrl');

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            const userCredential = await signInWithEmailAndPassword(
                auth,
                email,
                password
            );
            setUser(userCredential.user);
            navigate(returnUrl ? decodeURIComponent(returnUrl) : '/home');
        } catch (error: unknown) {
            const msg = error instanceof Error ? error.message : 'Login failed';
            setPayload({type: 'error', message: msg.replace('Firebase: ', '')});
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (!authLoading && currentUser) {
            setUser(currentUser);
            navigate(returnUrl ? decodeURIComponent(returnUrl) : '/home');
        }
    }, [currentUser, authLoading, navigate, returnUrl, setUser]);

    // Show the Nocturne-grounded loader while Firebase resolves the
    // persisted session on first paint — prevents the pre-auth flash.
    if (authLoading) {
        return (
            <div className={style.page}>
                <span className={style.loading}>Loading…</span>
            </div>
        );
    }

    return (
        <div className={style.page}>
            <div className={style.card}>
                <div className={style.brand}>
                    <span className={style.brandChip} aria-hidden="true">Ak</span>
                    <span className={style.brandWord}>Akkountant</span>
                </div>
                <h3 className={style.heading}>Sign in</h3>
                <p className={style.sub}>Enter your credentials to continue.</p>
                <form onSubmit={handleLogin} className={style.form} noValidate>
                    <div className="field">
                        <label htmlFor="login-email">Email</label>
                        <input
                            id="login-email"
                            type="email"
                            autoComplete="email"
                            autoFocus
                            required
                            className="input"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                        />
                    </div>
                    <div className="field">
                        <label htmlFor="login-password">Password</label>
                        <input
                            id="login-password"
                            type="password"
                            autoComplete="current-password"
                            required
                            className="input"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                        />
                    </div>
                    <button
                        type="submit"
                        disabled={loading || !email || !password}
                        className={`btn btn-primary btn-block ${style.submitBtn}`}
                    >
                        {loading ? (
                            <>
                                <i
                                    className={`ph ph-circle-notch ${style.spin}`}
                                    aria-hidden="true"
                                />
                                <span>Signing in…</span>
                            </>
                        ) : (
                            <>
                                <i className="ph ph-sign-in" aria-hidden="true"/>
                                <span>Sign in</span>
                            </>
                        )}
                    </button>
                </form>
            </div>
        </div>
    );
};

export default Login;
