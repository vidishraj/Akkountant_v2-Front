import {useState, useEffect, useCallback} from 'react';
import {InvoiceData, InvoiceTemplate, CustomField, InvoiceItem, Customer} from '../../utils/interfaces';
import {
    createInvoice,
    updateInvoice,
    fetchInvoiceById,
    fetchInvoiceTemplates,
    saveInvoiceTemplate,
    updateInvoiceTemplate,
    deleteInvoiceTemplate,
} from '../../services/freelanceService';
import {useMessage} from '../../contexts/MessageContext';
import {useUser} from '../../contexts/GlobalContext';
import CustomerDropdown from './CustomerDropdown';
import TemplateDropdown from './TemplateDropdown';
import styles from '../../pages/Freelance/Freelance.module.scss';
import formStyles from './InvoiceForm.module.scss';

interface InvoiceFormTabProps {
    onInvoiceDataChange: (data: InvoiceData | null) => void;
    invoiceData: InvoiceData | null;
    editingInvoiceId?: string;
    duplicatingInvoiceData?: InvoiceData;
    onEditComplete?: () => void;
    onInvoiceUpdated?: (invoiceId?: string) => void;
    onDuplicateComplete?: () => void;
}

const generateInvoiceNumber = () => {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    return `INV-${year}${month}-${random}`;
};

const getDefaultFormData = (): InvoiceData => ({
    invoiceNumber: generateInvoiceNumber(),
    projectName: '',
    issueDate: new Date().toISOString().split('T')[0],
    dueDate: '',
    customerId: '',
    currency: 'USD',
    from: {name: '', email: '', address: '', phone: ''},
    to: {name: '', email: '', address: '', company: ''},
    customFields: [],
    hiddenCoreFields: {},
    items: [{description: '', quantity: 1, rate: 0, amount: 0}],
    subtotal: 0,
    tax: {rate: 0, amount: 0},
    total: 0,
    notes: '',
    terms: '',
    status: 'draft',
    payment: {paymentMethod: '', amountReceived: 0, breakdown: {}, paymentDate: '', notes: ''}
});

const InvoiceFormTab = ({
    onInvoiceDataChange,
    editingInvoiceId,
    duplicatingInvoiceData,
    onEditComplete,
    onInvoiceUpdated,
    onDuplicateComplete
}: InvoiceFormTabProps) => {
    const [formData, setFormData] = useState<InvoiceData>(getDefaultFormData());
    const [errors, setErrors] = useState<string[]>([]);
    const [loading, setLoading] = useState(false);
    const [templates, setTemplates] = useState<InvoiceTemplate[]>([]);
    const [selectedTemplate, setSelectedTemplate] = useState('');
    const [templateName, setTemplateName] = useState('');
    const [showSaveTemplate, setShowSaveTemplate] = useState(false);
    const [selectedCustomerForTemplate, setSelectedCustomerForTemplate] = useState('');
    const [isCustomerTemplate, setIsCustomerTemplate] = useState(false);
    const [isEditMode, setIsEditMode] = useState(false);
    const [showTemplateActions, setShowTemplateActions] = useState(false);
    const [editingTemplate, setEditingTemplate] = useState<InvoiceTemplate | null>(null);
    const [editTemplateName, setEditTemplateName] = useState('');
    const [saveAsDefault, setSaveAsDefault] = useState(false);
    const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({});
    const {setPayload} = useMessage();
    const {setInvoiceJsonDraft} = useUser();

    useEffect(() => {
        if (editingInvoiceId) {
            loadInvoiceForEdit(editingInvoiceId);
            setIsEditMode(true);
        } else if (duplicatingInvoiceData) {
            const duplicated = {
                ...duplicatingInvoiceData,
                invoiceNumber: generateInvoiceNumber(),
                issueDate: new Date().toISOString().split('T')[0],
                status: 'draft' as const,
                payment: {paymentMethod: '', amountReceived: 0, breakdown: {}, paymentDate: '', notes: ''}
            };
            updateFormData(duplicated);
            setIsEditMode(false);
        } else {
            updateFormData(getDefaultFormData());
        }
        loadTemplates();
    }, [editingInvoiceId, duplicatingInvoiceData]);

    const loadTemplates = async () => {
        try {
            const data = await fetchInvoiceTemplates();
            setTemplates(data);
        } catch {
            setPayload({type: 'error', message: 'Failed to load invoice templates'});
        }
    };

    /**
     * DISPLAY-ONLY money math (Arc A / ak-lvu FE-1). Runs on every field
     * change so the user sees an immediate preview of subtotal, tax, and
     * total while typing. The values it produces are NOT trusted for
     * persistence — `freelanceService.createInvoice/updateInvoice` strip
     * them before send and the server returns authoritative 2dp
     * recomputes that overwrite these preview values.
     *
     * IEEE-754 float artefacts (3 × 10.10 → 30.299999999999997) are
     * acceptable here because they never persist; the backend uses
     * Decimal arithmetic for the source-of-truth values.
     */
    const recalculate = useCallback((data: InvoiceData): InvoiceData => {
        let subtotal = 0;
        const items = data.items.map(item => {
            const amount = (item.quantity || 0) * (item.rate || 0);
            subtotal += amount;
            return {...item, amount};
        });
        const taxAmount = data.tax ? subtotal * ((data.tax.rate || 0) / 100) : 0;
        return {
            ...data,
            items,
            subtotal,
            tax: {rate: data.tax?.rate || 0, amount: taxAmount},
            total: subtotal + taxAmount
        };
    }, []);

    const validate = useCallback((data: InvoiceData): string[] => {
        const errs: string[] = [];
        if (!data.invoiceNumber) errs.push('Invoice number is required');
        if (!data.projectName) errs.push('Project name is required');
        if (!data.from?.name) errs.push('Sender name is required');
        if (!data.to?.name) errs.push('Recipient name is required');
        if (!data.currency) errs.push('Currency is required');
        if (!data.customerId) errs.push('Please select a customer');

        if (!data.items || data.items.length === 0) {
            errs.push('At least one line item is required');
        } else {
            data.items.forEach((item, i) => {
                if (!item.description) errs.push(`Item ${i + 1}: description is required`);
            });
        }

        if (data.status === 'paid') {
            if (!data.payment?.paymentMethod) errs.push('Payment method is required for paid invoices');
            if (!data.payment?.amountReceived || data.payment.amountReceived <= 0)
                errs.push('Amount received must be > 0 for paid invoices');
        }

        if (data.customFields) {
            if (data.customFields.length > 8) errs.push('Max 8 custom fields allowed');
            data.customFields.forEach((f, i) => {
                if (!f.key) errs.push(`Custom field ${i + 1}: key is required`);
                if (f.key && f.key.length > 50) errs.push(`Custom field ${i + 1}: key max 50 chars`);
                if (f.value && f.value.length > 200) errs.push(`Custom field ${i + 1}: value max 200 chars`);
            });
        }

        return errs;
    }, []);

    const updateFormData = useCallback((data: InvoiceData) => {
        const recalculated = recalculate(data);
        setFormData(recalculated);
        const validationErrors = validate(recalculated);
        setErrors(validationErrors);

        if (validationErrors.length === 0) {
            onInvoiceDataChange(recalculated);
            setInvoiceJsonDraft(JSON.stringify(recalculated, null, 2));
        } else {
            onInvoiceDataChange(null);
        }
    }, [recalculate, validate, onInvoiceDataChange, setInvoiceJsonDraft]);

    const updateField = (path: string, value: any) => {
        const next = {...formData};
        const parts = path.split('.');
        let obj: any = next;
        for (let i = 0; i < parts.length - 1; i++) {
            if (obj[parts[i]] === undefined || obj[parts[i]] === null) obj[parts[i]] = {};
            obj[parts[i]] = {...obj[parts[i]]};
            obj = obj[parts[i]];
        }
        obj[parts[parts.length - 1]] = value;
        updateFormData(next);
    };

    const toggleSection = (section: string) => {
        setCollapsedSections(prev => ({...prev, [section]: !prev[section]}));
    };

    const toggleHiddenCoreField = (field: string) => {
        setFormData(prev => {
            const next = {...prev};
            const hidden = {...(next.hiddenCoreFields || {})};
            if (hidden[field]) {
                delete hidden[field];
            } else {
                hidden[field] = true;
            }
            next.hiddenCoreFields = hidden;
            updateFormData(next);
            return next;
        });
    };

    // Line items
    const addItem = () => {
        setFormData(prev => {
            const next = {...prev, items: [...prev.items, {description: '', quantity: 1, rate: 0, amount: 0}]};
            updateFormData(next);
            return next;
        });
    };

    const removeItem = (index: number) => {
        if (formData.items.length <= 1) return;
        setFormData(prev => {
            const next = {...prev, items: prev.items.filter((_, i) => i !== index)};
            updateFormData(next);
            return next;
        });
    };

    const updateItem = (index: number, field: keyof InvoiceItem, value: string | number) => {
        setFormData(prev => {
            const items = [...prev.items];
            items[index] = {...items[index], [field]: value};
            const next = {...prev, items};
            updateFormData(next);
            return next;
        });
    };

    // Custom fields
    const addCustomField = () => {
        if ((formData.customFields?.length || 0) >= 8) return;
        setFormData(prev => {
            const next = {...prev, customFields: [...(prev.customFields || []), {key: '', value: '', hidden: false}]};
            updateFormData(next);
            return next;
        });
    };

    const removeCustomField = (index: number) => {
        setFormData(prev => {
            const fields = [...(prev.customFields || [])];
            fields.splice(index, 1);
            const next = {...prev, customFields: fields};
            updateFormData(next);
            return next;
        });
    };

    const updateCustomField = (index: number, field: keyof CustomField, value: string | boolean) => {
        setFormData(prev => {
            const fields = [...(prev.customFields || [])];
            fields[index] = {...fields[index], [field]: value};
            const next = {...prev, customFields: fields};
            updateFormData(next);
            return next;
        });
    };

    // Payment breakdown
    const addBreakdownEntry = () => {
        setFormData(prev => {
            const breakdown = {...(prev.payment?.breakdown || {})};
            breakdown[`Item ${Object.keys(breakdown).length + 1}`] = 0;
            const next = {...prev, payment: {...(prev.payment || {paymentMethod: '', amountReceived: 0, breakdown: {}}), breakdown}};
            updateFormData(next);
            return next;
        });
    };

    const removeBreakdownEntry = (key: string) => {
        setFormData(prev => {
            const breakdown = {...(prev.payment?.breakdown || {})};
            delete breakdown[key];
            const next = {...prev, payment: {...(prev.payment || {paymentMethod: '', amountReceived: 0, breakdown: {}}), breakdown}};
            updateFormData(next);
            return next;
        });
    };

    const updateBreakdownEntry = (oldKey: string, newKey: string, value: number) => {
        setFormData(prev => {
            const breakdown = {...(prev.payment?.breakdown || {})};
            if (oldKey !== newKey) delete breakdown[oldKey];
            breakdown[newKey] = value;
            const next = {...prev, payment: {...(prev.payment || {paymentMethod: '', amountReceived: 0, breakdown: {}}), breakdown}};
            updateFormData(next);
            return next;
        });
    };

    // Customer selection
    const handleCustomerSelection = (customerId: string, customer?: Customer) => {
        if (!customerId) {
            updateField('customerId', '');
            return;
        }

        setFormData(prev => {
            const next = {
                ...prev,
                customerId,
                to: {
                    name: customer?.name || prev.to.name,
                    email: customer?.email || prev.to.email,
                    address: customer?.address || prev.to.address,
                    company: customer?.company || prev.to.company
                }
            };

            // Auto-load customer default template if available
            if (customer?.defaultTemplate) {
                const tmpl = customer.defaultTemplate;
                const merged = {
                    ...next,
                    ...tmpl,
                    invoiceNumber: next.invoiceNumber,
                    issueDate: next.issueDate,
                    customerId,
                    to: {
                        name: customer.name || next.to.name,
                        email: customer.email || next.to.email,
                        address: customer.address || next.to.address,
                        company: customer.company || next.to.company
                    },
                    status: 'draft' as const
                };
                updateFormData(merged);
                return merged;
            }

            updateFormData(next);
            return next;
        });
    };

    // Template operations
    const loadTemplate = (templateId: string) => {
        const template = templates.find(t => t.id === templateId);
        if (!template) return;
        const merged: InvoiceData = {
            ...getDefaultFormData(),
            ...template.templateData,
            invoiceNumber: generateInvoiceNumber(),
            issueDate: new Date().toISOString().split('T')[0],
            status: 'draft'
        };
        updateFormData(merged);
        setShowTemplateActions(true);
    };

    const saveTemplate = async () => {
        if (!templateName.trim()) {
            setPayload({type: 'error', message: 'Please enter a template name'});
            return;
        }
        const validationErrors = validate(formData);
        if (validationErrors.length > 0) {
            setPayload({type: 'error', message: 'Fix validation errors before saving template'});
            return;
        }
        if ((isCustomerTemplate || saveAsDefault) && !selectedCustomerForTemplate) {
            setPayload({type: 'error', message: 'Please select a customer for the template'});
            return;
        }

        try {
            setLoading(true);
            // Arc A / FE-3 — strip payment, status, and dueDate before
            // persisting the template. A template is the reusable skeleton;
            // payment history, status, and the invoice-specific dueDate
            // belong to the individual invoice that used the template, not
            // the template itself. Without this strip, a template saved
            // from a paid invoice would seed every new draft with phantom
            // payment metadata + a stale "paid" status.
            const {
                payment: _p,
                status: _st,
                dueDate: _dd,
                ...templateBody
            } = formData;
            void _p; void _st; void _dd;
            const templateData: InvoiceData = {
                ...templateBody,
                // dueDate is required by the InvoiceData type; leave it
                // empty so the caller supplies a fresh one on next draft.
                dueDate: "",
            };
            const result = await saveInvoiceTemplate(
                templateName,
                templateData,
                (isCustomerTemplate || saveAsDefault) ? selectedCustomerForTemplate : undefined,
                saveAsDefault
            );
            setTemplateName('');
            setSelectedCustomerForTemplate('');
            setIsCustomerTemplate(false);
            setSaveAsDefault(false);
            setShowSaveTemplate(false);
            setPayload({type: 'success', message: saveAsDefault ? 'Template saved and set as customer default' : result.message});
            await loadTemplates();
        } catch {
            setPayload({type: 'error', message: 'Failed to save template'});
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteTemplate = async (templateId: string) => {
        const template = templates.find(t => t.id === templateId);
        if (!template) return;
        if (!window.confirm(`Delete template "${template.name}"? This cannot be undone.`)) return;
        try {
            setLoading(true);
            const result = await deleteInvoiceTemplate(templateId);
            setPayload({type: 'success', message: result.message});
            setSelectedTemplate('');
            setShowTemplateActions(false);
            await loadTemplates();
        } catch {
            setPayload({type: 'error', message: 'Failed to delete template'});
        } finally {
            setLoading(false);
        }
    };

    const handleEditTemplate = (templateId: string) => {
        const template = templates.find(t => t.id === templateId);
        if (template) {
            setEditingTemplate(template);
            setEditTemplateName(template.name);
        }
    };

    const handleUpdateTemplate = async () => {
        if (!editingTemplate || !editTemplateName.trim()) {
            setPayload({type: 'error', message: 'Please enter a template name'});
            return;
        }
        const validationErrors = validate(formData);
        if (validationErrors.length > 0) {
            setPayload({type: 'error', message: 'Fix validation errors before updating template'});
            return;
        }
        try {
            setLoading(true);
            const result = await updateInvoiceTemplate(editingTemplate.id, {
                name: editTemplateName,
                templateData: formData
            });
            setEditingTemplate(null);
            setEditTemplateName('');
            setPayload({type: 'success', message: result.message});
            await loadTemplates();
        } catch {
            setPayload({type: 'error', message: 'Failed to update template'});
        } finally {
            setLoading(false);
        }
    };

    const resetToDefault = () => {
        updateFormData(getDefaultFormData());
        setSelectedTemplate('');
        setShowTemplateActions(false);
    };

    const loadInvoiceForEdit = async (invoiceId: string) => {
        try {
            setLoading(true);
            const invoice = await fetchInvoiceById(invoiceId);
            updateFormData(invoice);
        } catch {
            setPayload({type: 'error', message: 'Failed to load invoice for editing'});
        } finally {
            setLoading(false);
        }
    };

    const handleCreateOrUpdateInvoice = async () => {
        const validationErrors = validate(formData);
        if (validationErrors.length > 0) {
            setErrors(validationErrors);
            setPayload({type: 'error', message: 'Please fix validation errors before saving'});
            return;
        }

        try {
            setLoading(true);
            if (isEditMode && editingInvoiceId) {
                await updateInvoice(editingInvoiceId, formData);
                setPayload({type: 'success', message: 'Invoice updated successfully!'});
                onInvoiceUpdated?.(editingInvoiceId);
                onEditComplete?.();
            } else {
                await createInvoice(formData);
                setPayload({type: 'success', message: 'Invoice created successfully!'});
                onInvoiceUpdated?.();
                if (duplicatingInvoiceData) {
                    onDuplicateComplete?.();
                } else {
                    resetToDefault();
                }
            }
        } catch {
            setPayload({type: 'error', message: `Failed to ${isEditMode ? 'update' : 'create'} invoice`});
        } finally {
            setLoading(false);
        }
    };

    const getCurrencySymbol = (currency: string) => {
        const symbols: Record<string, string> = {USD: '$', INR: '₹', GBP: '£', EUR: '€', AUD: 'A$'};
        return symbols[currency] || '$';
    };

    const sectionHeader = (title: string, key: string) => (
        <div
            className={formStyles.collapsibleSectionHeader}
            onClick={() => toggleSection(key)}
        >
            <span>{title}</span>
            <span className={formStyles.collapseIcon}>{collapsedSections[key] ? '▶' : '▼'}</span>
        </div>
    );

    const isFieldError = (field: string) => errors.some(e => e.toLowerCase().includes(field.toLowerCase()));

    return (
        <div>
            {/* Quick Start & Actions */}
            <div className={styles.invoiceForm} style={{marginBottom: '15px'}}>
                <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px', flexWrap: 'wrap', gap: '10px'}}>
                    <h3 style={{color: '#FAFAFA', margin: 0}}>
                        {isEditMode ? 'Edit Invoice' : duplicatingInvoiceData ? 'Duplicate Invoice' : 'Create Invoice'}
                    </h3>
                    <div style={{display: 'flex', gap: '6px', flexWrap: 'wrap'}}>
                        <button className={styles.secondaryBtn} onClick={() => setShowSaveTemplate(!showSaveTemplate)} style={{padding: '6px 10px', fontSize: '0.85rem'}}>
                            Save Template
                        </button>
                        <button className={styles.secondaryBtn} onClick={resetToDefault} style={{padding: '6px 10px', fontSize: '0.85rem'}}>
                            Reset
                        </button>
                    </div>
                </div>

                {/* Template and Customer Selection */}
                <div className={styles.formRow}>
                    <div className={styles.formGroup} style={{flex: 1, minWidth: 0}}>
                        <label className={styles.formLabel}>Load Saved Template</label>
                        <TemplateDropdown
                            value={selectedTemplate}
                            onChange={(templateId) => {
                                setSelectedTemplate(templateId);
                                if (templateId) loadTemplate(templateId);
                            }}
                            templates={templates}
                            className={styles.formInput}
                            placeholder="Select a template..."
                        />
                    </div>
                    <div className={styles.formGroup} style={{flex: 1, minWidth: 0}}>
                        <label className={styles.formLabel}>Select Customer (Required) *</label>
                        <CustomerDropdown
                            value={formData.customerId || ''}
                            onChange={handleCustomerSelection}
                            className={styles.formInput}
                        />
                    </div>
                </div>

                {/* Template Actions */}
                {selectedTemplate && showTemplateActions && (
                    <div style={{marginTop: '15px', paddingTop: '15px', borderTop: '1px solid rgba(255,255,255,0.2)'}}>
                        <div className={styles.formRow}>
                            <div className={styles.formGroup}>
                                <label className={styles.formLabel}>Template Actions</label>
                                <div style={{display: 'flex', gap: '6px', flexWrap: 'wrap'}}>
                                    <button className={styles.secondaryBtn} onClick={() => handleEditTemplate(selectedTemplate)} style={{padding: '6px 10px', fontSize: '0.85rem'}} disabled={loading}>Edit Template</button>
                                    <button className={styles.dangerBtn} onClick={() => handleDeleteTemplate(selectedTemplate)} style={{padding: '6px 10px', fontSize: '0.85rem'}} disabled={loading}>Delete Template</button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Edit Template Modal */}
                {editingTemplate && (
                    <div style={{marginTop: '10px', padding: '12px', backgroundColor: '#29384D', borderRadius: '6px', border: '1px solid #5B5B7B'}}>
                        <h4 style={{color: '#FAFAFA', marginBottom: '10px', fontSize: '1rem'}}>Edit Template: {editingTemplate.name}</h4>
                        <div className={styles.formRow}>
                            <div className={styles.formGroup}>
                                <label className={styles.formLabel}>Template Name *</label>
                                <input type="text" className={styles.formInput} value={editTemplateName} onChange={e => setEditTemplateName(e.target.value)} placeholder="Enter template name..." />
                            </div>
                        </div>
                        <div style={{display: 'flex', gap: '10px', marginTop: '15px'}}>
                            <button className={styles.primaryBtn} onClick={handleUpdateTemplate} disabled={loading}>{loading ? 'Updating...' : 'Update Template'}</button>
                            <button className={styles.secondaryBtn} onClick={() => {setEditingTemplate(null); setEditTemplateName('');}} disabled={loading}>Cancel</button>
                        </div>
                    </div>
                )}

                {/* Save Template Panel */}
                {showSaveTemplate && (
                    <div style={{marginTop: '10px', padding: '12px', backgroundColor: '#29384D', borderRadius: '6px', border: '1px solid #5B5B7B'}}>
                        <h4 style={{color: '#FAFAFA', marginBottom: '10px', fontSize: '1rem'}}>Save as Template</h4>
                        <div className={styles.formRow}>
                            <div className={styles.formGroup}>
                                <label className={styles.formLabel}>Template Name *</label>
                                <input type="text" className={styles.formInput} value={templateName} onChange={e => setTemplateName(e.target.value)} placeholder="Enter template name..." />
                            </div>
                        </div>
                        <div style={{marginBottom: '15px'}}>
                            <label style={{display: 'flex', alignItems: 'center', gap: '8px', color: '#FAFAFA', cursor: 'pointer'}}>
                                <input type="checkbox" checked={isCustomerTemplate} onChange={e => {setIsCustomerTemplate(e.target.checked); if (!e.target.checked) {setSelectedCustomerForTemplate(''); setSaveAsDefault(false);}}} style={{accentColor: '#7B68EE'}} />
                                Link to specific customer
                            </label>
                            {isCustomerTemplate && (
                                <label style={{display: 'flex', alignItems: 'center', gap: '8px', color: '#FAFAFA', cursor: 'pointer', marginLeft: '26px', marginTop: '8px'}}>
                                    <input type="checkbox" checked={saveAsDefault} onChange={e => setSaveAsDefault(e.target.checked)} style={{accentColor: '#7B68EE'}} />
                                    Set as customer default template
                                </label>
                            )}
                        </div>
                        {isCustomerTemplate && (
                            <div className={styles.formRow}>
                                <div className={styles.formGroup}>
                                    <label className={styles.formLabel}>Select Customer *</label>
                                    <CustomerDropdown value={selectedCustomerForTemplate} onChange={id => setSelectedCustomerForTemplate(id)} className={styles.formInput} />
                                </div>
                            </div>
                        )}
                        <div style={{display: 'flex', gap: '10px', marginTop: '20px'}}>
                            <button className={styles.primaryBtn} onClick={saveTemplate} disabled={loading}>{loading ? 'Saving...' : 'Save Template'}</button>
                            <button className={styles.secondaryBtn} onClick={() => {setShowSaveTemplate(false); setTemplateName(''); setSelectedCustomerForTemplate(''); setIsCustomerTemplate(false); setSaveAsDefault(false);}} disabled={loading}>Cancel</button>
                        </div>
                    </div>
                )}
            </div>

            {/* Validation Errors */}
            {errors.length > 0 && (
                <div className={styles.errorMessage} style={{marginBottom: '15px'}}>
                    <strong>Validation Errors:</strong>
                    <ul style={{margin: '5px 0 0', paddingLeft: '18px'}}>
                        {errors.map((err, i) => <li key={i}>{err}</li>)}
                    </ul>
                </div>
            )}

            {errors.length === 0 && (
                <div className={styles.successMessage} style={{marginBottom: '15px'}}>
                    Valid Invoice - Total: {getCurrencySymbol(formData.currency)}{formData.total.toFixed(2)}
                </div>
            )}

            {/* Invoice Details Section */}
            <div className={styles.invoiceForm} style={{marginBottom: '15px'}}>
                {sectionHeader('Invoice Details', 'details')}
                {!collapsedSections.details && (
                    <div className={styles.formRow} style={{marginTop: '10px', flexWrap: 'wrap'}}>
                        <div className={styles.formGroup} style={{flex: 1, minWidth: '180px'}}>
                            <label className={styles.formLabel}>Invoice Number *</label>
                            <input type="text" className={`${styles.formInput} ${isFieldError('invoice number') ? styles.errorInput : ''}`} value={formData.invoiceNumber} onChange={e => updateField('invoiceNumber', e.target.value)} />
                        </div>
                        <div className={styles.formGroup} style={{flex: 1, minWidth: '180px'}}>
                            <label className={styles.formLabel}>Project Name *</label>
                            <input type="text" className={`${styles.formInput} ${isFieldError('project name') ? styles.errorInput : ''}`} value={formData.projectName} onChange={e => updateField('projectName', e.target.value)} />
                        </div>
                        <div className={styles.formGroup} style={{flex: 1, minWidth: '140px'}}>
                            <label className={styles.formLabel}>Issue Date</label>
                            <input type="date" className={styles.formInput} value={formData.issueDate} onChange={e => updateField('issueDate', e.target.value)} />
                        </div>
                        <div className={styles.formGroup} style={{flex: 1, minWidth: '140px'}}>
                            <label className={styles.formLabel}>Due Date</label>
                            <input type="date" className={styles.formInput} value={formData.dueDate} onChange={e => updateField('dueDate', e.target.value)} />
                        </div>
                        <div className={styles.formGroup} style={{flex: 1, minWidth: '120px'}}>
                            <label className={styles.formLabel}>Currency</label>
                            <select className={styles.formInput} value={formData.currency} onChange={e => updateField('currency', e.target.value)}>
                                <option value="USD">USD ($)</option>
                                <option value="INR">INR (₹)</option>
                                <option value="GBP">GBP (£)</option>
                                <option value="EUR">EUR (€)</option>
                                <option value="AUD">AUD (A$)</option>
                            </select>
                        </div>
                        <div className={styles.formGroup} style={{flex: 1, minWidth: '120px'}}>
                            <label className={styles.formLabel}>Status</label>
                            <select className={styles.formInput} value={formData.status || 'draft'} onChange={e => updateField('status', e.target.value)}>
                                <option value="draft">Draft</option>
                                <option value="sent">Sent</option>
                                <option value="paid">Paid</option>
                                <option value="overdue">Overdue</option>
                            </select>
                        </div>
                    </div>
                )}
            </div>

            {/* From (Sender) Section */}
            <div className={styles.invoiceForm} style={{marginBottom: '15px'}}>
                {sectionHeader('From (Sender)', 'from')}
                {!collapsedSections.from && (
                    <div style={{marginTop: '10px'}}>
                        <div className={styles.formRow} style={{flexWrap: 'wrap'}}>
                            <div className={styles.formGroup} style={{flex: 1, minWidth: '200px'}}>
                                <label className={styles.formLabel}>Name *</label>
                                <input type="text" className={`${styles.formInput} ${isFieldError('sender name') ? styles.errorInput : ''}`} value={formData.from.name} onChange={e => updateField('from.name', e.target.value)} />
                            </div>
                            <div className={styles.formGroup} style={{flex: 1, minWidth: '200px'}}>
                                <div style={{display: 'flex', alignItems: 'center', gap: '8px'}}>
                                    <label className={styles.formLabel}>Email</label>
                                    <label className={formStyles.fieldVisibilityToggle} title="Hide from PDF">
                                        <input type="checkbox" checked={!!formData.hiddenCoreFields?.['from.email']} onChange={() => toggleHiddenCoreField('from.email')} />
                                        <span>Hide</span>
                                    </label>
                                </div>
                                <input type="email" className={styles.formInput} value={formData.from.email} onChange={e => updateField('from.email', e.target.value)} />
                            </div>
                        </div>
                        <div className={styles.formRow} style={{flexWrap: 'wrap', marginTop: '10px'}}>
                            <div className={styles.formGroup} style={{flex: 2, minWidth: '200px'}}>
                                <label className={styles.formLabel}>Address</label>
                                <textarea className={styles.formInput} value={formData.from.address} onChange={e => updateField('from.address', e.target.value)} rows={2} />
                            </div>
                            <div className={styles.formGroup} style={{flex: 1, minWidth: '150px'}}>
                                <div style={{display: 'flex', alignItems: 'center', gap: '8px'}}>
                                    <label className={styles.formLabel}>Phone</label>
                                    <label className={formStyles.fieldVisibilityToggle} title="Hide from PDF">
                                        <input type="checkbox" checked={!!formData.hiddenCoreFields?.['from.phone']} onChange={() => toggleHiddenCoreField('from.phone')} />
                                        <span>Hide</span>
                                    </label>
                                </div>
                                <input type="text" className={styles.formInput} value={formData.from.phone || ''} onChange={e => updateField('from.phone', e.target.value)} />
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* To (Recipient) Section */}
            <div className={styles.invoiceForm} style={{marginBottom: '15px'}}>
                {sectionHeader('To (Recipient)', 'to')}
                {!collapsedSections.to && (
                    <div style={{marginTop: '10px'}}>
                        <div className={styles.formRow} style={{flexWrap: 'wrap'}}>
                            <div className={styles.formGroup} style={{flex: 1, minWidth: '200px'}}>
                                <label className={styles.formLabel}>Name *</label>
                                <input type="text" className={`${styles.formInput} ${isFieldError('recipient name') ? styles.errorInput : ''}`} value={formData.to.name} onChange={e => updateField('to.name', e.target.value)} />
                            </div>
                            <div className={styles.formGroup} style={{flex: 1, minWidth: '200px'}}>
                                <div style={{display: 'flex', alignItems: 'center', gap: '8px'}}>
                                    <label className={styles.formLabel}>Email</label>
                                    <label className={formStyles.fieldVisibilityToggle} title="Hide from PDF">
                                        <input type="checkbox" checked={!!formData.hiddenCoreFields?.['to.email']} onChange={() => toggleHiddenCoreField('to.email')} />
                                        <span>Hide</span>
                                    </label>
                                </div>
                                <input type="email" className={styles.formInput} value={formData.to.email} onChange={e => updateField('to.email', e.target.value)} />
                            </div>
                        </div>
                        <div className={styles.formRow} style={{flexWrap: 'wrap', marginTop: '10px'}}>
                            <div className={styles.formGroup} style={{flex: 2, minWidth: '200px'}}>
                                <label className={styles.formLabel}>Address</label>
                                <textarea className={styles.formInput} value={formData.to.address} onChange={e => updateField('to.address', e.target.value)} rows={2} />
                            </div>
                            <div className={styles.formGroup} style={{flex: 1, minWidth: '150px'}}>
                                <div style={{display: 'flex', alignItems: 'center', gap: '8px'}}>
                                    <label className={styles.formLabel}>Company</label>
                                    <label className={formStyles.fieldVisibilityToggle} title="Hide from PDF">
                                        <input type="checkbox" checked={!!formData.hiddenCoreFields?.['to.company']} onChange={() => toggleHiddenCoreField('to.company')} />
                                        <span>Hide</span>
                                    </label>
                                </div>
                                <input type="text" className={styles.formInput} value={formData.to.company || ''} onChange={e => updateField('to.company', e.target.value)} />
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Line Items Section */}
            <div className={styles.invoiceForm} style={{marginBottom: '15px'}}>
                {sectionHeader('Line Items', 'items')}
                {!collapsedSections.items && (
                    <div style={{marginTop: '10px'}}>
                        <div className={formStyles.lineItemsTable}>
                            <div className={formStyles.lineItemHeader}>
                                <span style={{flex: 3}}>Description *</span>
                                <span style={{flex: 1}}>Qty</span>
                                <span style={{flex: 1}}>Rate</span>
                                <span style={{flex: 1}}>Amount</span>
                                <span style={{width: '40px'}}></span>
                            </div>
                            {formData.items.map((item, index) => (
                                <div key={index} className={formStyles.lineItemRow}>
                                    <div style={{flex: 3}}>
                                        <input type="text" className={styles.formInput} value={item.description} onChange={e => updateItem(index, 'description', e.target.value)} placeholder="Service description..." />
                                    </div>
                                    <div style={{flex: 1}}>
                                        <input type="number" className={styles.formInput} value={item.quantity} onChange={e => updateItem(index, 'quantity', parseFloat(e.target.value) || 0)} min={0} step="0.5" />
                                    </div>
                                    <div style={{flex: 1}}>
                                        <input type="number" className={styles.formInput} value={item.rate} onChange={e => updateItem(index, 'rate', parseFloat(e.target.value) || 0)} min={0} step="0.01" />
                                    </div>
                                    <div style={{flex: 1}} className={formStyles.computedField}>
                                        {getCurrencySymbol(formData.currency)}{item.amount.toFixed(2)}
                                    </div>
                                    <button className={formStyles.removeItemBtn} onClick={() => removeItem(index)} disabled={formData.items.length <= 1} style={{width: '40px', padding: '4px'}}>
                                        ×
                                    </button>
                                </div>
                            ))}
                        </div>
                        <button className={formStyles.addItemBtn} onClick={addItem} style={{marginTop: '10px'}}>
                            + Add Item
                        </button>
                    </div>
                )}
            </div>

            {/* Tax & Totals Section */}
            <div className={styles.invoiceForm} style={{marginBottom: '15px'}}>
                {sectionHeader('Tax & Totals', 'totals')}
                {!collapsedSections.totals && (
                    <div style={{marginTop: '10px'}}>
                        <div className={styles.formRow} style={{flexWrap: 'wrap'}}>
                            <div className={styles.formGroup} style={{flex: 1, minWidth: '150px'}}>
                                <label className={styles.formLabel}>Tax Rate (%)</label>
                                <input type="number" className={styles.formInput} value={formData.tax?.rate || 0} onChange={e => updateField('tax.rate', parseFloat(e.target.value) || 0)} min={0} step="0.1" />
                            </div>
                            <div className={styles.formGroup} style={{flex: 1, minWidth: '150px'}}>
                                <label className={styles.formLabel}>Tax Amount</label>
                                <div className={formStyles.computedField} style={{padding: '10px', minHeight: '38px', display: 'flex', alignItems: 'center'}}>
                                    {getCurrencySymbol(formData.currency)}{(formData.tax?.amount || 0).toFixed(2)}
                                </div>
                            </div>
                        </div>
                        <div className={formStyles.totalSection} style={{marginTop: '15px'}}>
                            <div className={formStyles.totalRow}>
                                <span>Subtotal</span>
                                <span>{getCurrencySymbol(formData.currency)}{formData.subtotal.toFixed(2)}</span>
                            </div>
                            {(formData.tax?.amount || 0) > 0 && (
                                <div className={formStyles.totalRow}>
                                    <span>Tax ({formData.tax?.rate || 0}%)</span>
                                    <span>{getCurrencySymbol(formData.currency)}{(formData.tax?.amount || 0).toFixed(2)}</span>
                                </div>
                            )}
                            <div className={`${formStyles.totalRow} ${formStyles.final}`}>
                                <span>Total</span>
                                <span>{getCurrencySymbol(formData.currency)}{formData.total.toFixed(2)}</span>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Custom Fields Section */}
            <div className={styles.invoiceForm} style={{marginBottom: '15px'}}>
                {sectionHeader(`Custom Fields (${formData.customFields?.length || 0}/8)`, 'customFields')}
                {!collapsedSections.customFields && (
                    <div style={{marginTop: '10px'}}>
                        {(formData.customFields || []).map((field, index) => (
                            <div key={index} className={styles.formRow} style={{marginBottom: '8px', flexWrap: 'wrap'}}>
                                <div className={styles.formGroup} style={{flex: 1, minWidth: '150px'}}>
                                    <input type="text" className={styles.formInput} value={field.key} onChange={e => updateCustomField(index, 'key', e.target.value)} placeholder="Field name" />
                                </div>
                                <div className={styles.formGroup} style={{flex: 2, minWidth: '200px'}}>
                                    <input type="text" className={styles.formInput} value={field.value} onChange={e => updateCustomField(index, 'value', e.target.value)} placeholder="Field value" />
                                </div>
                                <label className={formStyles.fieldVisibilityToggle}>
                                    <input type="checkbox" checked={!!field.hidden} onChange={e => updateCustomField(index, 'hidden', e.target.checked)} />
                                    <span>Hide</span>
                                </label>
                                <button className={formStyles.removeItemBtn} onClick={() => removeCustomField(index)} style={{padding: '4px 8px'}}>×</button>
                            </div>
                        ))}
                        {(formData.customFields?.length || 0) < 8 && (
                            <button className={formStyles.addItemBtn} onClick={addCustomField} style={{marginTop: '8px'}}>
                                + Add Custom Field
                            </button>
                        )}
                    </div>
                )}
            </div>

            {/* Payment Info */}
            {(
                <div className={styles.invoiceForm} style={{marginBottom: '15px'}}>
                    {sectionHeader('Payment Information', 'payment')}
                    {!collapsedSections.payment && (
                        <div style={{marginTop: '10px'}}>
                            <div className={styles.formRow} style={{flexWrap: 'wrap'}}>
                                <div className={styles.formGroup} style={{flex: 1, minWidth: '180px'}}>
                                    <label className={styles.formLabel}>Payment Method *</label>
                                    <select className={styles.formInput} value={formData.payment?.paymentMethod || ''} onChange={e => updateField('payment.paymentMethod', e.target.value)}>
                                        <option value="">Select method...</option>
                                        <option value="bank_transfer">Bank Transfer</option>
                                        <option value="check">Check</option>
                                        <option value="cash">Cash</option>
                                        <option value="paypal">PayPal</option>
                                        <option value="credit_card">Credit Card</option>
                                        <option value="upi">UPI</option>
                                        <option value="other">Other</option>
                                    </select>
                                </div>
                                <div className={styles.formGroup} style={{flex: 1, minWidth: '150px'}}>
                                    <label className={styles.formLabel}>Amount Received *</label>
                                    <input type="number" className={styles.formInput} value={formData.payment?.amountReceived || 0} onChange={e => updateField('payment.amountReceived', parseFloat(e.target.value) || 0)} min={0} step="0.01" />
                                </div>
                                <div className={styles.formGroup} style={{flex: 1, minWidth: '150px'}}>
                                    <label className={styles.formLabel}>Payment Date</label>
                                    <input type="date" className={styles.formInput} value={formData.payment?.paymentDate || ''} onChange={e => updateField('payment.paymentDate', e.target.value)} />
                                </div>
                            </div>
                            <div className={styles.formRow} style={{marginTop: '10px'}}>
                                <div className={styles.formGroup} style={{flex: 1}}>
                                    <label className={styles.formLabel}>Payment Notes</label>
                                    <textarea className={styles.formInput} value={formData.payment?.notes || ''} onChange={e => updateField('payment.notes', e.target.value)} rows={2} placeholder="Payment notes..." />
                                </div>
                            </div>

                            {/* Payment Breakdown */}
                            <div style={{marginTop: '15px'}}>
                                <label className={styles.formLabel}>Payment Breakdown (optional)</label>
                                {Object.entries(formData.payment?.breakdown || {}).map(([key, val]) => (
                                    <div key={key} className={styles.formRow} style={{marginTop: '5px'}}>
                                        <div className={styles.formGroup} style={{flex: 1}}>
                                            <input type="text" className={styles.formInput} value={key} onChange={e => updateBreakdownEntry(key, e.target.value, val)} placeholder="Label" />
                                        </div>
                                        <div className={styles.formGroup} style={{flex: 1}}>
                                            <input type="number" className={styles.formInput} value={val} onChange={e => updateBreakdownEntry(key, key, parseFloat(e.target.value) || 0)} min={0} step="0.01" />
                                        </div>
                                        <button className={formStyles.removeItemBtn} onClick={() => removeBreakdownEntry(key)} style={{padding: '4px 8px'}}>×</button>
                                    </div>
                                ))}
                                <button className={formStyles.addItemBtn} onClick={addBreakdownEntry} style={{marginTop: '8px', padding: '6px 12px', fontSize: '0.85rem'}}>
                                    + Add Breakdown Entry
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Notes & Terms Section */}
            <div className={styles.invoiceForm} style={{marginBottom: '15px'}}>
                {sectionHeader('Notes & Terms', 'notes')}
                {!collapsedSections.notes && (
                    <div style={{marginTop: '10px'}}>
                        <div className={styles.formRow} style={{flexWrap: 'wrap'}}>
                            <div className={styles.formGroup} style={{flex: 1, minWidth: '200px'}}>
                                <label className={styles.formLabel}>Notes</label>
                                <textarea className={styles.formInput} value={formData.notes || ''} onChange={e => updateField('notes', e.target.value)} rows={3} placeholder="Additional notes for the client..." />
                            </div>
                            <div className={styles.formGroup} style={{flex: 1, minWidth: '200px'}}>
                                <label className={styles.formLabel}>Terms & Conditions</label>
                                <textarea className={styles.formInput} value={formData.terms || ''} onChange={e => updateField('terms', e.target.value)} rows={3} placeholder="Payment terms and conditions..." />
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Action Buttons */}
            <div className={styles.actionButtons}>
                <button
                    className={styles.primaryBtn}
                    onClick={handleCreateOrUpdateInvoice}
                    disabled={loading || errors.length > 0}
                >
                    {loading ? (isEditMode ? 'Updating...' : 'Creating...') : (isEditMode ? 'Update Invoice' : duplicatingInvoiceData ? 'Save Duplicate' : 'Save Invoice')}
                </button>
                {isEditMode && (
                    <button className={styles.secondaryBtn} onClick={() => {setIsEditMode(false); onEditComplete?.();}} disabled={loading}>
                        Cancel Edit
                    </button>
                )}
                {duplicatingInvoiceData && !isEditMode && (
                    <button className={styles.secondaryBtn} onClick={() => onDuplicateComplete?.()} disabled={loading}>
                        Cancel Duplicate
                    </button>
                )}
            </div>
        </div>
    );
};

export default InvoiceFormTab;
