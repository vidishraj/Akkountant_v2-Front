import { useState } from 'react';
import { InvoiceData } from '../../utils/interfaces';
import InvoiceCreationTab from './InvoiceCreationTab';
import InvoiceHTMLPreview from './InvoiceHTMLPreview';
import InvoicePDFPreview from './InvoicePDFPreview';
import styles from '../../pages/Freelance/Freelance.module.scss';

type InvoiceSubTab = 'creation' | 'html-preview' | 'pdf-preview';

interface InvoiceCreatorProps {
    editingInvoiceId?: string;
    onEditComplete?: () => void;
    onInvoiceUpdated?: () => void;
}

const InvoiceCreator = ({ editingInvoiceId, onEditComplete, onInvoiceUpdated }: InvoiceCreatorProps) => {
    const [activeSubTab, setActiveSubTab] = useState<InvoiceSubTab>('creation');
    const [invoiceData, setInvoiceData] = useState<InvoiceData | null>(null);

    const handleInvoiceDataChange = (data: InvoiceData | null) => {
        setInvoiceData(data);
    };

    const renderSubTabContent = () => {
        switch (activeSubTab) {
            case 'creation':
                return (
                    <InvoiceCreationTab 
                        onInvoiceDataChange={handleInvoiceDataChange}
                        invoiceData={invoiceData}
                        editingInvoiceId={editingInvoiceId}
                        onEditComplete={onEditComplete}
                        onInvoiceUpdated={onInvoiceUpdated}
                    />
                );
            case 'html-preview':
                return <InvoiceHTMLPreview invoiceData={invoiceData} />;
            case 'pdf-preview':
                return <InvoicePDFPreview invoiceData={invoiceData} />;
            default:
                return (
                    <InvoiceCreationTab 
                        onInvoiceDataChange={handleInvoiceDataChange}
                        invoiceData={invoiceData}
                        editingInvoiceId={editingInvoiceId}
                        onEditComplete={onEditComplete}
                        onInvoiceUpdated={onInvoiceUpdated}
                    />
                );
        }
    };

    const subTabs = [
        { key: 'creation' as InvoiceSubTab, label: 'Create Invoice', icon: '✏️' },
        { key: 'html-preview' as InvoiceSubTab, label: 'HTML Preview', icon: '🌐' },
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