import { useState, useEffect } from 'react';
import { InvoiceData } from '../../utils/interfaces';
import { fetchInvoiceById } from '../../services/freelanceService';
import InvoiceFormTab from './InvoiceFormTab';
import InvoicePDFPreview from './InvoicePDFPreview';
import styles from '../../pages/Freelance/Freelance.module.scss';

type InvoiceSubTab = 'creation' | 'pdf-preview';

interface InvoiceCreatorProps {
    editingInvoiceId?: string;
    duplicatingInvoiceData?: InvoiceData;
    onEditComplete?: () => void;
    onInvoiceUpdated?: () => void;
    onDuplicateComplete?: () => void;
    initialSubTab?: InvoiceSubTab;
}

const InvoiceCreator = ({ editingInvoiceId, duplicatingInvoiceData, onEditComplete, onInvoiceUpdated, onDuplicateComplete, initialSubTab }: InvoiceCreatorProps) => {
    const [activeSubTab, setActiveSubTab] = useState<InvoiceSubTab>(initialSubTab || 'creation');

    useEffect(() => {
        if (initialSubTab) setActiveSubTab(initialSubTab);
    }, [initialSubTab]);
    const [invoiceData, setInvoiceData] = useState<InvoiceData | null>(null);

    // Load invoice data directly when navigating to pdf-preview with an editingInvoiceId
    // (InvoiceFormTab won't be rendered on this sub-tab to load it)
    useEffect(() => {
        if (activeSubTab === 'pdf-preview' && editingInvoiceId) {
            fetchInvoiceById(editingInvoiceId)
                .then(data => setInvoiceData(data))
                .catch(err => console.error('Failed to load invoice for preview:', err));
        }
    }, [activeSubTab, editingInvoiceId]);

    const handleInvoiceDataChange = (data: InvoiceData | null) => {
        setInvoiceData(data);
    };

    const renderSubTabContent = () => {
        switch (activeSubTab) {
            case 'creation':
                return (
                    <InvoiceFormTab
                        onInvoiceDataChange={handleInvoiceDataChange}
                        invoiceData={invoiceData}
                        editingInvoiceId={editingInvoiceId}
                        duplicatingInvoiceData={duplicatingInvoiceData}
                        onEditComplete={onEditComplete}
                        onInvoiceUpdated={onInvoiceUpdated}
                        onDuplicateComplete={onDuplicateComplete}
                    />
                );
            case 'pdf-preview':
                return <InvoicePDFPreview invoiceData={invoiceData} />;
            default:
                return (
                    <InvoiceFormTab
                        onInvoiceDataChange={handleInvoiceDataChange}
                        invoiceData={invoiceData}
                        editingInvoiceId={editingInvoiceId}
                        duplicatingInvoiceData={duplicatingInvoiceData}
                        onEditComplete={onEditComplete}
                        onInvoiceUpdated={onInvoiceUpdated}
                        onDuplicateComplete={onDuplicateComplete}
                    />
                );
        }
    };

    const subTabs = [
        { key: 'creation' as InvoiceSubTab, label: 'Create Invoice', icon: '✏️' },
        { key: 'pdf-preview' as InvoiceSubTab, label: 'PDF Preview', icon: '📄' }
    ];

    return (
        <div>
            {/* Sub-tabs for invoice creation */}
            <div className={styles.tabContainer}>
                {subTabs.map(tab => (
                    <button
                        key={tab.key}
                        className={`${styles.tab} ${activeSubTab === tab.key ? styles.active : ''}`}
                        onClick={() => setActiveSubTab(tab.key)}
                        data-tab={tab.key}
                    >
                        <span style={{ marginRight: '8px' }}>{tab.icon}</span>
                        {tab.label}
                    </button>
                ))}
            </div>

            <div className={styles.tabContent}>
                {renderSubTabContent()}
            </div>
        </div>
    );
};

export default InvoiceCreator;
