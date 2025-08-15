import { InvoiceData } from '../../utils/interfaces';
import styles from '../../pages/Freelance/Freelance.module.scss';

interface InvoiceHTMLPreviewProps {
    invoiceData: InvoiceData | null;
}

const InvoiceHTMLPreview = ({ invoiceData }: InvoiceHTMLPreviewProps) => {
    if (!invoiceData) {
        return (
            <div className={styles.emptyState}>
                <h3 style={{ color: '#B0B0B0', marginBottom: '10px' }}>No Invoice Data</h3>
                <p>Create a valid invoice in the Creation tab to see the HTML preview here.</p>
            </div>
        );
    }

    // Currency symbols
    const currencySymbols: Record<string, string> = {
        'USD': '$',
        'INR': '₹',
        'GBP': '£',
        'EUR': '€',
        'AUD': 'A$'
    };
    const currencySymbol = currencySymbols[invoiceData.currency] || '$';

    return (
        <div>
            <h2 className={styles.sectionTitle}>📄 HTML Preview</h2>
            
            <div className={styles.invoiceForm}>
                <div style={{ padding: '20px', backgroundColor: '#29384D', borderRadius: '8px', marginBottom: '20px' }}>
                    <div style={{ color: '#FAFAFA', fontSize: '1.2rem', fontWeight: 'bold', marginBottom: '8px' }}>
                        Invoice #{invoiceData.invoiceNumber}
                    </div>
                    {invoiceData.projectName && (
                        <div style={{ color: '#7B68EE', fontSize: '1rem', fontWeight: '500', marginBottom: '15px' }}>
                            Project: {invoiceData.projectName}
                        </div>
                    )}
                    
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '20px' }}>
                        <div>
                            <h4 style={{ color: '#7B68EE', marginBottom: '10px' }}>From:</h4>
                            <div style={{ color: '#B0B0B0', fontSize: '0.9rem' }}>
                                <div style={{ fontWeight: 'bold' }}>{invoiceData.from.name}</div>
                                <div>{invoiceData.from.email}</div>
                                <div style={{ whiteSpace: 'pre-line' }}>{invoiceData.from.address}</div>
                                {invoiceData.from.phone && <div>{invoiceData.from.phone}</div>}
                            </div>
                        </div>
                        
                        <div>
                            <h4 style={{ color: '#7B68EE', marginBottom: '10px' }}>To:</h4>
                            <div style={{ color: '#B0B0B0', fontSize: '0.9rem' }}>
                                <div style={{ fontWeight: 'bold' }}>{invoiceData.to.name}</div>
                                {invoiceData.to.company && <div style={{ fontStyle: 'italic' }}>{invoiceData.to.company}</div>}
                                <div>{invoiceData.to.email}</div>
                                <div style={{ whiteSpace: 'pre-line' }}>{invoiceData.to.address}</div>
                            </div>
                        </div>
                    </div>

                    {/* Custom Fields */}
                    {invoiceData.customFields && invoiceData.customFields.length > 0 && (
                        <div style={{ marginBottom: '20px' }}>
                            <h4 style={{ color: '#7B68EE', marginBottom: '10px' }}>📋 Additional Information:</h4>
                            <div style={{ 
                                display: 'grid', 
                                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', 
                                gap: '10px',
                                backgroundColor: 'rgba(123, 104, 238, 0.05)',
                                padding: '15px',
                                borderRadius: '6px',
                                border: '1px solid rgba(123, 104, 238, 0.2)'
                            }}>
                                {invoiceData.customFields
                                    .filter(field => !field.hidden) // Only show non-hidden fields
                                    .map((field, index) => (
                                    <div key={index} style={{ 
                                        backgroundColor: 'rgba(123, 104, 238, 0.1)',
                                        padding: '8px 12px',
                                        borderRadius: '4px',
                                        border: '1px solid rgba(123, 104, 238, 0.3)'
                                    }}>
                                        <div style={{ 
                                            color: '#7B68EE', 
                                            fontSize: '0.8rem', 
                                            fontWeight: 'bold',
                                            marginBottom: '2px'
                                        }}>
                                            {field.key}
                                        </div>
                                        <div style={{ 
                                            color: '#B0B0B0', 
                                            fontSize: '0.85rem',
                                            wordBreak: 'break-word'
                                        }}>
                                            {field.value || '-'}
                                        </div>
                                    </div>
                                ))}
                            </div>
                            {invoiceData.customFields.some(field => field.hidden) && (
                                <div style={{ 
                                    marginTop: '8px', 
                                    fontSize: '0.75rem', 
                                    color: '#6B7280',
                                    fontStyle: 'italic'
                                }}>
                                    ℹ️ {invoiceData.customFields.filter(field => field.hidden).length} hidden field(s) not displayed
                                </div>
                            )}
                        </div>
                    )}

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '20px' }}>
                        <div>
                            <h4 style={{ color: '#7B68EE', marginBottom: '10px' }}>Invoice Details:</h4>
                            <div style={{ color: '#B0B0B0', fontSize: '0.9rem' }}>
                                <div><strong>Issue Date:</strong> {new Date(invoiceData.issueDate).toLocaleDateString()}</div>
                                <div><strong>Due Date:</strong> {new Date(invoiceData.dueDate).toLocaleDateString()}</div>
                                <div><strong>Currency:</strong> {invoiceData.currency}</div>
                            </div>
                        </div>
                        
                        <div>
                            <h4 style={{ color: '#7B68EE', marginBottom: '10px' }}>Payment Summary:</h4>
                            <div style={{ color: '#B0B0B0', fontSize: '0.9rem' }}>
                                <div><strong>Subtotal:</strong> {currencySymbol}{invoiceData.subtotal.toFixed(2)}</div>
                                {invoiceData.tax && invoiceData.tax.rate > 0 && (
                                    <div><strong>Tax ({invoiceData.tax.rate}%):</strong> {currencySymbol}{invoiceData.tax.amount.toFixed(2)}</div>
                                )}
                                <div style={{ color: '#7B68EE', fontWeight: 'bold', fontSize: '1.1rem', marginTop: '5px' }}>
                                    <strong>Total: {currencySymbol}{invoiceData.total.toFixed(2)}</strong>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div style={{ marginBottom: '20px' }}>
                        <h4 style={{ color: '#7B68EE', marginBottom: '10px' }}>Line Items:</h4>
                        <div style={{ overflowX: 'auto' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                <thead>
                                    <tr style={{ borderBottom: '2px solid #5B5B7B' }}>
                                        <th style={{ color: '#FAFAFA', padding: '12px 8px', textAlign: 'left', backgroundColor: 'rgba(123, 104, 238, 0.1)' }}>Description</th>
                                        <th style={{ color: '#FAFAFA', padding: '12px 8px', textAlign: 'right', backgroundColor: 'rgba(123, 104, 238, 0.1)' }}>Qty</th>
                                        <th style={{ color: '#FAFAFA', padding: '12px 8px', textAlign: 'right', backgroundColor: 'rgba(123, 104, 238, 0.1)' }}>Rate</th>
                                        <th style={{ color: '#FAFAFA', padding: '12px 8px', textAlign: 'right', backgroundColor: 'rgba(123, 104, 238, 0.1)' }}>Amount</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {invoiceData.items.map((item, index) => (
                                        <tr key={index} style={{ 
                                            borderBottom: '1px solid #5B5B7B',
                                            backgroundColor: index % 2 === 1 ? 'rgba(91, 91, 123, 0.1)' : 'transparent'
                                        }}>
                                            <td style={{ color: '#B0B0B0', padding: '12px 8px' }}>{item.description}</td>
                                            <td style={{ color: '#B0B0B0', padding: '12px 8px', textAlign: 'right' }}>{item.quantity}</td>
                                            <td style={{ color: '#B0B0B0', padding: '12px 8px', textAlign: 'right' }}>{currencySymbol}{item.rate.toFixed(2)}</td>
                                            <td style={{ color: '#B0B0B0', padding: '12px 8px', textAlign: 'right', fontWeight: '500' }}>{currencySymbol}{item.amount.toFixed(2)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Payment Information */}
                    {invoiceData.payment && (
                        <div style={{ marginBottom: '20px' }}>
                            <h4 style={{ color: '#7B68EE', marginBottom: '10px' }}>💳 Payment Information:</h4>
                            <div style={{ 
                                backgroundColor: 'rgba(50, 205, 50, 0.1)', 
                                padding: '15px', 
                                borderRadius: '6px',
                                border: '1px solid rgba(50, 205, 50, 0.3)'
                            }}>
                                <div style={{ color: '#B0B0B0', fontSize: '0.9rem' }}>
                                    <div style={{ marginBottom: '8px' }}>
                                        <strong style={{ color: '#32CD32' }}>Payment Method:</strong> {invoiceData.payment.paymentMethod}
                                    </div>
                                    <div style={{ marginBottom: '8px' }}>
                                        <strong style={{ color: '#32CD32' }}>Amount Received:</strong> {currencySymbol}{invoiceData.payment.amountReceived.toFixed(2)}
                                    </div>
                                    {invoiceData.payment.paymentDate && (
                                        <div style={{ marginBottom: '8px' }}>
                                            <strong style={{ color: '#32CD32' }}>Payment Date:</strong> {new Date(invoiceData.payment.paymentDate).toLocaleDateString()}
                                        </div>
                                    )}
                                    {Object.keys(invoiceData.payment.breakdown).length > 0 && (
                                        <div style={{ marginTop: '10px' }}>
                                            <strong style={{ color: '#32CD32' }}>Payment Breakdown:</strong>
                                            <div style={{ marginTop: '5px', paddingLeft: '10px' }}>
                                                {Object.entries(invoiceData.payment.breakdown).map(([key, value]) => (
                                                    <div key={key} style={{ marginBottom: '3px' }}>
                                                        • {key}: {currencySymbol}{value.toFixed(2)}
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                    {invoiceData.payment.notes && (
                                        <div style={{ marginTop: '10px' }}>
                                            <strong style={{ color: '#32CD32' }}>Payment Notes:</strong>
                                            <div style={{ 
                                                marginTop: '5px', 
                                                fontStyle: 'italic',
                                                backgroundColor: 'rgba(50, 205, 50, 0.05)',
                                                padding: '8px',
                                                borderRadius: '4px'
                                            }}>
                                                {invoiceData.payment.notes}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    {(invoiceData.notes || invoiceData.terms) && (
                        <div style={{ marginTop: '30px', paddingTop: '20px', borderTop: '2px solid #5B5B7B' }}>
                            {invoiceData.notes && (
                                <div style={{ marginBottom: '15px' }}>
                                    <h4 style={{ color: '#7B68EE', marginBottom: '8px' }}>Notes:</h4>
                                    <div style={{ 
                                        color: '#B0B0B0', 
                                        fontSize: '0.9rem', 
                                        whiteSpace: 'pre-line',
                                        backgroundColor: 'rgba(123, 104, 238, 0.05)',
                                        padding: '12px',
                                        borderRadius: '4px',
                                        border: '1px solid rgba(123, 104, 238, 0.2)'
                                    }}>
                                        {invoiceData.notes}
                                    </div>
                                </div>
                            )}
                            {invoiceData.terms && (
                                <div>
                                    <h4 style={{ color: '#7B68EE', marginBottom: '8px' }}>Terms & Conditions:</h4>
                                    <div style={{ 
                                        color: '#B0B0B0', 
                                        fontSize: '0.9rem', 
                                        whiteSpace: 'pre-line',
                                        backgroundColor: 'rgba(123, 104, 238, 0.05)',
                                        padding: '12px',
                                        borderRadius: '4px',
                                        border: '1px solid rgba(123, 104, 238, 0.2)'
                                    }}>
                                        {invoiceData.terms}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* Responsive Layout Info */}
            <div style={{ 
                marginTop: '20px', 
                padding: '15px', 
                backgroundColor: '#29384D', 
                borderRadius: '8px',
                border: '1px solid #5B5B7B'
            }}>
                <h4 style={{ color: '#FAFAFA', marginBottom: '10px' }}>📱 HTML Preview Features:</h4>
                <ul style={{ color: '#B0B0B0', fontSize: '0.9rem', lineHeight: '1.6', margin: 0, paddingLeft: '20px' }}>
                    <li>Responsive design that adapts to different screen sizes</li>
                    <li>Clean, professional styling matching your brand colors</li>
                    <li>Structured layout with clear sections for easy reading</li>
                    <li>Mobile-friendly table design with horizontal scrolling</li>
                    <li>Highlighted totals and important information</li>
                </ul>
            </div>
        </div>
    );
};

export default InvoiceHTMLPreview;