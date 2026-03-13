import { useState, useCallback, useRef } from 'react';
import { ProcessedEmail } from '../../utils/interfaces';
import { searchProcessedEmails, linkEmailToCustomer } from '../../services/freelanceService';
import styles from './CustomerManager.module.scss';
import sharedStyles from '../../pages/Freelance/Freelance.module.scss';

interface EmailLinkModalProps {
    customerId: string;
    open: boolean;
    onClose: () => void;
    onLinked: () => void;
}

const EmailLinkModal: React.FC<EmailLinkModalProps> = ({ customerId, open, onClose, onLinked }) => {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<ProcessedEmail[]>([]);
    const [loading, setLoading] = useState(false);
    const [linking, setLinking] = useState<number | null>(null);
    const [error, setError] = useState('');
    const contentRef = useRef<HTMLDivElement>(null);
    const debounceRef = useRef<ReturnType<typeof setTimeout>>();

    const handleSearch = useCallback((searchQuery: string) => {
        setQuery(searchQuery);
        setError('');

        if (debounceRef.current) clearTimeout(debounceRef.current);

        if (searchQuery.length < 2) {
            setResults([]);
            return;
        }

        debounceRef.current = setTimeout(async () => {
            try {
                setLoading(true);
                const emails = await searchProcessedEmails(searchQuery);
                setResults(emails);
            } catch {
                setError('Failed to search emails');
            } finally {
                setLoading(false);
            }
        }, 400);
    }, []);

    const handleLink = async (emailId: number) => {
        try {
            setLinking(emailId);
            setError('');
            await linkEmailToCustomer(customerId, emailId);
            // Remove from results
            setResults(prev => prev.filter(e => e.id !== emailId));
            onLinked();
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : 'Failed to link email';
            setError(message);
        } finally {
            setLinking(null);
        }
    };

    const handleBackdropClick = (e: React.MouseEvent) => {
        if (contentRef.current && !contentRef.current.contains(e.target as Node)) {
            onClose();
        }
    };

    if (!open) return null;

    return (
        <div className={sharedStyles.modal} onClick={handleBackdropClick}>
            <div className={sharedStyles.modalContent} ref={contentRef} style={{ maxWidth: '650px' }}>
                <h3>Link Email to Customer</h3>

                <div className={sharedStyles.formGroup}>
                    <input
                        className={sharedStyles.input}
                        type="text"
                        placeholder="Search by subject or sender..."
                        value={query}
                        onChange={e => handleSearch(e.target.value)}
                        autoFocus
                    />
                </div>

                {error && <div className={sharedStyles.errorMessage}>{error}</div>}

                {loading && <div className={styles.detailLoading}>Searching...</div>}

                {!loading && results.length > 0 && (
                    <div className={styles.emailSearchResults}>
                        {results.map(email => (
                            <div key={email.id} className={styles.emailSearchRow}>
                                <div className={styles.emailSearchInfo}>
                                    <div className={styles.emailSearchSubject}>{email.subject || '(No subject)'}</div>
                                    <div className={styles.emailSearchMeta}>
                                        <span>{email.sender}</span>
                                        {email.received_date && (
                                            <span>{new Date(email.received_date).toLocaleDateString()}</span>
                                        )}
                                        {email.category && (
                                            <span className={styles.emailCategoryBadge}>{email.category}</span>
                                        )}
                                    </div>
                                </div>
                                <button
                                    className={sharedStyles.primaryBtn}
                                    style={{ padding: '6px 14px', fontSize: '0.8rem' }}
                                    onClick={() => handleLink(email.id)}
                                    disabled={linking === email.id}
                                >
                                    {linking === email.id ? 'Linking...' : 'Link'}
                                </button>
                            </div>
                        ))}
                    </div>
                )}

                {!loading && query.length >= 2 && results.length === 0 && (
                    <div className={styles.detailEmpty}>No emails found matching "{query}"</div>
                )}

                <div className={sharedStyles.modalActions}>
                    <button className={sharedStyles.secondaryBtn} onClick={onClose}>Close</button>
                </div>
            </div>
        </div>
    );
};

export default EmailLinkModal;
