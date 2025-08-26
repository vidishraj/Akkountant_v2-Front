import {useState, useEffect} from 'react';
import {InvoiceData, InvoiceTemplate} from '../../utils/interfaces';
import {
    createInvoice,
    updateInvoice,
    fetchInvoiceById,
    fetchInvoiceTemplates,
    saveInvoiceTemplate,
    updateInvoiceTemplate,
    deleteInvoiceTemplate
} from '../../services/freelanceService';
import {useMessage} from '../../contexts/MessageContext';
import {useUser} from '../../contexts/GlobalContext';
import CustomerDropdown from './CustomerDropdown';
import styles from '../../pages/Freelance/Freelance.module.scss';


interface InvoiceCreationTabProps {
    onInvoiceDataChange: (data: InvoiceData | null) => void;
    invoiceData: InvoiceData | null;
    editingInvoiceId?: string; // For editing existing invoices
    onEditComplete?: () => void; // Callback when editing is complete
    onInvoiceUpdated?: (invoiceId?: string) => void; // Callback to refresh dashboard data after create/update
}

const InvoiceCreationTab = ({
                                onInvoiceDataChange,
                                invoiceData,
                                editingInvoiceId,
                                onEditComplete,
                                onInvoiceUpdated
                            }: InvoiceCreationTabProps) => {
    const [isValidJson, setIsValidJson] = useState(true);
    const [jsonError, setJsonError] = useState('');
    const [loading, setLoading] = useState(false);
    const [templates, setTemplates] = useState<InvoiceTemplate[]>([]);
    const [selectedTemplate, setSelectedTemplate] = useState<string>('');
    const [templateName, setTemplateName] = useState('');
    const [showSaveTemplate, setShowSaveTemplate] = useState(false);
    const [selectedCustomerForTemplate, setSelectedCustomerForTemplate] = useState<string>('');
    const [isCustomerTemplate, setIsCustomerTemplate] = useState(false);
    const [isEditMode, setIsEditMode] = useState(false);
    const [showTemplateActions, setShowTemplateActions] = useState(false);
    const [editingTemplate, setEditingTemplate] = useState<InvoiceTemplate | null>(null);
    const [editTemplateName, setEditTemplateName] = useState('');
    const [selectedCustomerForDefault, setSelectedCustomerForDefault] = useState<string>('');
    const [saveAsDefault, setSaveAsDefault] = useState(false);
    const {setPayload} = useMessage();
    const {invoiceJsonDraft, setInvoiceJsonDraft} = useUser();

    // Default invoice structure with helper comments
    const defaultInvoiceStructure: InvoiceData = {
        invoiceNumber: '',
        projectName: '',
        issueDate: new Date().toISOString().split('T')[0],
        dueDate: '',
        customerId: '', // Required - must select customer first
        currency: 'USD', // Options: USD, INR, GBP, EUR, AUD
        from: {
            name: '',
            email: '',
            address: '',
            phone: ''
        },
        to: {
            name: '',
            email: '',
            address: '',
            company: ''
        },
        customFields: [
            {
                key: 'Purchase Order',
                value: ''
            },
            {
                key: '*Internal Reference',
                value: ''
            }
        ],
        items: [
            {
                description: '',
                quantity: 1,
                rate: 0,
                amount: 0
            }
        ],
        subtotal: 0,
        tax: {
            rate: 0,
            amount: 0
        },
        total: 0,
        notes: '',
        terms: '',
        status: 'draft', // Options: draft, sent, paid, overdue
        payment: {
            paymentMethod: '',
            amountReceived: 0,
            breakdown: {},
            paymentDate: '',
            notes: ''
        }
    };

    useEffect(() => {
        if (editingInvoiceId) {
            // Load existing invoice for editing
            loadInvoiceForEdit(editingInvoiceId);
            setIsEditMode(true);
        } else if (!invoiceJsonDraft) {
            // Generate invoice number on mount only if jsonString is empty
            const generateInvoiceNumber = () => {
                const date = new Date();
                const year = date.getFullYear();
                const month = String(date.getMonth() + 1).padStart(2, '0');
                const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
                return `INV-${year}${month}-${random}`;
            };

            const initialData = {
                ...defaultInvoiceStructure,
                invoiceNumber: generateInvoiceNumber()
            };

            const initialJsonString = JSON.stringify(initialData, null, 2);
            setInvoiceJsonDraft(initialJsonString);
            validateAndSetJson(initialJsonString);
        }
        loadTemplates();
    }, [editingInvoiceId]);

    // Separate effect to validate jsonString when it changes from context
    useEffect(() => {
        if (invoiceJsonDraft) {
            validateAndSetJson(invoiceJsonDraft);
        }
    }, [invoiceJsonDraft]);

    const loadTemplates = async (clearCache = false) => {
        try {
            console.log('Loading templates with clearCache:', clearCache);
            const templatesData = await fetchInvoiceTemplates(clearCache);
            console.log('Templates loaded:', templatesData.length, 'templates');
            setTemplates(templatesData);
        } catch (error) {
            console.error('Error loading templates:', error);
            setPayload({
                type: 'error',
                message: 'Failed to load invoice templates'
            });
        }
    };


    const validateAndSetJson = (jsonStr: string) => {
        try {
            const parsed = JSON.parse(jsonStr);
            const errors: string[] = [];
            
            // Basic validation for required fields with specific errors
            if (!parsed.invoiceNumber) errors.push('invoiceNumber is required');
            if (!parsed.projectName) errors.push('projectName is required'); 
            if (!parsed.from?.name) errors.push('from.name is required');
            if (!parsed.to?.name) errors.push('to.name is required');
            if (!parsed.currency) errors.push('currency is required');

            // Validate customer selection requirement
            if (!parsed.customerId) {
                errors.push('customerId is required - Please select a customer before creating an invoice');
            }

            // Validate currency with specific values
            const validCurrencies = ['USD', 'INR', 'GBP', 'EUR', 'AUD'];
            if (parsed.currency && !validCurrencies.includes(parsed.currency)) {
                errors.push(`currency must be one of: ${validCurrencies.join(', ')}`);
            }
            
            // Validate status if provided
            const validStatuses = ['draft', 'sent', 'paid', 'overdue'];
            if (parsed.status && !validStatuses.includes(parsed.status)) {
                errors.push(`status must be one of: ${validStatuses.join(', ')}`);
            }

            // Validate payment info for paid invoices
            if (parsed.status === 'paid') {
                if (!parsed.payment) {
                    errors.push('payment object is required for invoices marked as paid');
                } else {
                    if (!parsed.payment.paymentMethod || parsed.payment.paymentMethod.trim() === '') {
                        errors.push('payment.paymentMethod is required for paid invoices');
                    }
                    if (!parsed.payment.amountReceived || parsed.payment.amountReceived <= 0) {
                        errors.push('payment.amountReceived must be greater than 0 for paid invoices');
                    }
                }
            }
            
            // Validate items array
            if (!parsed.items || !Array.isArray(parsed.items) || parsed.items.length === 0) {
                errors.push('items array is required and must contain at least one item');
            } else {
                parsed.items.forEach((item: any, index: number) => {
                    if (!item.description) errors.push(`items[${index}].description is required`);
                    if (typeof item.quantity !== 'number' && isNaN(parseFloat(item.quantity))) {
                        errors.push(`items[${index}].quantity must be a valid number`);
                    }
                    if (typeof item.rate !== 'number' && isNaN(parseFloat(item.rate))) {
                        errors.push(`items[${index}].rate must be a valid number`);
                    }
                });
            }

            // Validate and process custom fields
            if (parsed.customFields) {
                if (!Array.isArray(parsed.customFields)) {
                    errors.push('customFields must be an array');
                } else {
                    if (parsed.customFields.length > 8) {
                        errors.push('customFields cannot exceed 8 items (current limit)');
                    }

                    // Process custom fields to handle asterisk prefix
                    parsed.customFields = parsed.customFields.map((field: { key: string; value: string }) => {
                        if (typeof field.key === 'string' && field.key.startsWith('*')) {
                            return {
                                ...field,
                                key: field.key.substring(1), // Remove asterisk
                                hidden: true
                            };
                        }
                        return {
                            ...field,
                            hidden: false
                        };
                    });

                    // Validate each custom field
                    parsed.customFields.forEach((field: any, index: number) => {
                        if (!field.key || typeof field.key !== 'string') {
                            errors.push(`customFields[${index}].key is required and must be a string`);
                        } else if (field.key.length > 50) {
                            errors.push(`customFields[${index}].key must be 50 characters or less (current: ${field.key.length})`);
                        }
                        if (field.value && typeof field.value !== 'string') {
                            errors.push(`customFields[${index}].value must be a string`);
                        } else if (field.value && field.value.length > 200) {
                            errors.push(`customFields[${index}].value must be 200 characters or less (current: ${field.value.length})`);
                        }
                    });
                }
            }
            
            // Set detailed error message
            if (errors.length > 0) {
                setJsonError(`Validation errors:\n• ${errors.join('\n• ')}`);
                setIsValidJson(false);
                onInvoiceDataChange(null);
                return;
            }

            // Calculate totals
            if (parsed.items && Array.isArray(parsed.items)) {
                let subtotal = 0;
                parsed.items.forEach((item: { quantity: number; rate: number; amount: number }) => {
                    if (item.quantity && item.rate) {
                        item.amount = item.quantity * item.rate;
                        subtotal += item.amount;
                    }
                });
                parsed.subtotal = subtotal;

                if (parsed.tax && parsed.tax.rate) {
                    parsed.tax.amount = subtotal * (parsed.tax.rate / 100);
                } else {
                    parsed.tax = {rate: 0, amount: 0};
                }

                parsed.total = parsed.subtotal + (parsed.tax?.amount || 0);
            }

            // Handle hidden core fields (check if JSON contains fields with * prefix)
            const hiddenCoreFields: { [key: string]: boolean } = {};
            const coreFieldsToCheck = ['from.email', 'from.phone', 'to.email', 'to.company'];
            
            coreFieldsToCheck.forEach(fieldPath => {
                const hiddenFieldKey = `*${fieldPath}`;
                const [section, field] = fieldPath.split('.');
                
                // Check for flat field format like "*from.email": "value"
                if (parsed[hiddenFieldKey]) {
                    hiddenCoreFields[fieldPath] = true;
                    
                    // Move the value to the normal location
                    if (!parsed[section]) parsed[section] = {};
                    parsed[section][field] = parsed[hiddenFieldKey];
                    delete parsed[hiddenFieldKey];
                }
                // Check for nested format like "*from": { "email": "value" }
                else if (parsed[`*${section}`] && parsed[`*${section}`][field]) {
                    hiddenCoreFields[fieldPath] = true;
                    
                    // Move the value to the normal location
                    if (!parsed[section]) parsed[section] = {};
                    parsed[section][field] = parsed[`*${section}`][field];
                    
                    // Clean up the nested structure if it's now empty
                    delete parsed[`*${section}`][field];
                    if (Object.keys(parsed[`*${section}`]).length === 0) {
                        delete parsed[`*${section}`];
                    }
                }
                // Also check if it exists in the JSON string for cases where the value is empty
                else if (jsonStr.includes(`"${hiddenFieldKey}"`)) {
                    hiddenCoreFields[fieldPath] = true;
                }
            });
            
            if (Object.keys(hiddenCoreFields).length > 0) {
                parsed.hiddenCoreFields = hiddenCoreFields;
            }

            onInvoiceDataChange(parsed);
            setIsValidJson(true);
            setJsonError('');
        } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : 'Invalid JSON format - Please check for syntax errors like missing commas, quotes, or brackets';
            setJsonError(errorMessage);
            setIsValidJson(false);
            onInvoiceDataChange(null);
        }
    };

    const handleJsonChange = (value: string) => {
        setInvoiceJsonDraft(value);
        validateAndSetJson(value);
    };


    const saveTemplate = async () => {
        if (!templateName.trim()) {
            setPayload({
                type: 'error',
                message: 'Please enter a template name'
            });
            return;
        }

        if (!invoiceData) {
            setPayload({
                type: 'error',
                message: 'No invoice data to save'
            });
            return;
        }

        if ((isCustomerTemplate || saveAsDefault) && !selectedCustomerForTemplate) {
            setPayload({
                type: 'error',
                message: 'Please select a customer for the template'
            });
            return;
        }

        try {
            setLoading(true);

            const result = await saveInvoiceTemplate(
                templateName, 
                invoiceData, 
                (isCustomerTemplate || saveAsDefault) ? selectedCustomerForTemplate : undefined,
                saveAsDefault
            );

            setTemplateName('');
            setSelectedCustomerForTemplate('');
            setIsCustomerTemplate(false);
            setSaveAsDefault(false);
            setShowSaveTemplate(false);

            setPayload({
                type: 'success',
                message: saveAsDefault ? 'Template saved and set as customer default' : result.message
            });

            // Reload templates to get the updated list
            await loadTemplates(true); // Clear cache to get fresh data
        } catch (error) {
            setPayload({
                type: 'error',
                message: 'Failed to save template'
            });
            console.error('Error saving template:', error);
        } finally {
            setLoading(false);
        }
    };

    const loadTemplate = (templateId: string) => {
        const template = templates.find(t => t.id === templateId);
        if (template) {
            const templateWithNewInvoiceNumber = {
                ...defaultInvoiceStructure,
                ...template.templateData,
                invoiceNumber: `INV-${new Date().getFullYear()}${String(new Date().getMonth() + 1).padStart(2, '0')}-${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`,
                issueDate: new Date().toISOString().split('T')[0],
                status: 'draft'
            };

            const templateJsonString = JSON.stringify(templateWithNewInvoiceNumber, null, 2);
            setInvoiceJsonDraft(templateJsonString);
            validateAndSetJson(templateJsonString);
            setShowTemplateActions(true);
            
            // Auto-select the customer if the template has a customerId
            if (template.customerId) {
                setSelectedCustomerForDefault(template.customerId);
            } else if (templateWithNewInvoiceNumber.customerId) {
                setSelectedCustomerForDefault(templateWithNewInvoiceNumber.customerId);
            }
            
            // Template loading feedback is provided by UI changes, no toast needed
        }
    };

    const handleDeleteTemplate = async (templateId: string) => {
        const template = templates.find(t => t.id === templateId);
        if (!template) return;

        if (window.confirm(`Are you sure you want to delete template "${template.name}"? This action cannot be undone.`)) {
            try {
                setLoading(true);
                const result = await deleteInvoiceTemplate(templateId);
                setPayload({
                    type: 'success',
                    message: result.message
                });
                setSelectedTemplate('');
                setShowTemplateActions(false);
                await loadTemplates(true); // Clear cache to get fresh data
            } catch (error) {
                setPayload({
                    type: 'error',
                    message: 'Failed to delete template'
                });
                console.error('Error deleting template:', error);
            } finally {
                setLoading(false);
            }
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
            setPayload({
                type: 'error',
                message: 'Please enter a template name'
            });
            return;
        }

        if (!invoiceData) {
            setPayload({
                type: 'error',
                message: 'No invoice data to update template with'
            });
            return;
        }

        try {
            setLoading(true);
            const result = await updateInvoiceTemplate(editingTemplate.id, {
                name: editTemplateName,
                templateData: invoiceData
            });

            setEditingTemplate(null);
            setEditTemplateName('');
            setPayload({
                type: 'success',
                message: result.message
            });

            await loadTemplates(true); // Clear cache to get fresh data
        } catch (error) {
            setPayload({
                type: 'error',
                message: 'Failed to update template'
            });
            console.error('Error updating template:', error);
        } finally {
            setLoading(false);
        }
    };


    const resetToDefault = () => {
        const newData = {
            ...defaultInvoiceStructure,
            invoiceNumber: `INV-${new Date().getFullYear()}${String(new Date().getMonth() + 1).padStart(2, '0')}-${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`
        };
        const newJsonString = JSON.stringify(newData, null, 2);
        setInvoiceJsonDraft(newJsonString);
        validateAndSetJson(newJsonString);
    };

    const formatJson = () => {
        if (isValidJson && invoiceData) {
            setInvoiceJsonDraft(JSON.stringify(invoiceData, null, 2));
        }
    };

    const loadInvoiceForEdit = async (invoiceId: string) => {
        try {
            setLoading(true);
            const invoice = await fetchInvoiceById(invoiceId, true); // Force cache clear to get fresh data
            const invoiceJsonString = JSON.stringify(invoice, null, 2);
            setInvoiceJsonDraft(invoiceJsonString);
            validateAndSetJson(invoiceJsonString);
            
            // Auto-select the customer from the loaded invoice
            if (invoice.customerId) {
                setSelectedCustomerForDefault(invoice.customerId);
            }
            
            // Invoice loading feedback is provided by UI changes, no toast needed
        } catch (error) {
            setPayload({
                type: 'error',
                message: 'Failed to load invoice for editing'
            });
            console.error('Invoice loading error:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleCustomerSelection = (customerId: string) => {
        setSelectedCustomerForDefault(customerId);
        
        if (customerId) {
            // Update the invoice data with the selected customer ID
            const currentData = invoiceJsonDraft ? JSON.parse(invoiceJsonDraft) : defaultInvoiceStructure;
            const updatedData = {
                ...currentData,
                customerId: customerId
            };
            
            const updatedJsonString = JSON.stringify(updatedData, null, 2);
            setInvoiceJsonDraft(updatedJsonString);
            validateAndSetJson(updatedJsonString);
            
            // Customer selection feedback is provided by UI changes, no toast needed
        }
    };

    const handleCreateOrUpdateInvoice = async () => {
        if (!isValidJson || !invoiceData) {
            setPayload({
                type: 'error',
                message: 'Please fix JSON errors before saving invoice'
            });
            return;
        }

        try {
            setLoading(true);
            if (isEditMode && editingInvoiceId) {
                await updateInvoice(editingInvoiceId, invoiceData);
                setPayload({
                    type: 'success',
                    message: 'Invoice updated successfully!'
                });
                
                // Trigger refresh to get updated invoice data
                if (onInvoiceUpdated) {
                    onInvoiceUpdated(editingInvoiceId);
                }
                
                onEditComplete?.();
            } else {
                await createInvoice(invoiceData);
                setPayload({
                    type: 'success',
                    message: 'Invoice created successfully!'
                });
                // Trigger dashboard refresh for new invoices
                onInvoiceUpdated?.();
                // Reset to new invoice
                resetToDefault();
            }
        } catch (error) {
            setPayload({
                type: 'error',
                message: `Failed to ${isEditMode ? 'update' : 'create'} invoice`
            });
            console.error('Invoice save error:', error);
        } finally {
            setLoading(false);
        }
    };
    console.log(templates)
    return (
        <div>
            {/* Quick Start & Actions */}
            <div className={styles.invoiceForm} style={{ marginBottom: '15px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px', flexWrap: 'wrap', gap: '10px' }}>
                    <h3 style={{color: '#FAFAFA', margin: 0}}>Quick Start & Actions</h3>
                    <div style={{display: 'flex', gap: '6px', flexWrap: 'wrap'}}>
                        <button
                            className={styles.secondaryBtn}
                            onClick={() => setShowSaveTemplate(!showSaveTemplate)}
                            style={{ padding: '6px 10px', fontSize: '0.85rem' }}
                        >
                            Save Template
                        </button>
                        <button
                            className={styles.secondaryBtn}
                            onClick={resetToDefault}
                            style={{ padding: '6px 10px', fontSize: '0.85rem' }}
                        >
                            Reset
                        </button>
                        <button
                            className={styles.secondaryBtn}
                            onClick={formatJson}
                            disabled={!isValidJson}
                            style={{ padding: '6px 10px', fontSize: '0.85rem' }}
                        >
                            Format
                        </button>
                    </div>
                </div>

                <div className={styles.formRow}>
                    <div className={styles.formGroup}>
                        <label className={styles.formLabel}>Load Saved Template</label>
                        <select
                            className={styles.formInput}
                            value={selectedTemplate}
                            onChange={(e) => {
                                setSelectedTemplate(e.target.value);
                                if (e.target.value) {
                                    loadTemplate(e.target.value);
                                }
                            }}
                            style={{ width: '100%', minWidth: 0 }}
                        >
                            <option value="">Select a template...</option>
                            {templates.map(template => (
                                <option key={template.id} value={template.id} title={`${template.name}${template.customerId ? ' (Customer Template)' : ''} - ${new Date(template.createdAt).toLocaleDateString()}`}>
                                    {template.name.length > 30 ? `${template.name.substring(0, 30)}...` : template.name}
                                    {template.customerId && ' (CT)'}
                                </option>
                            ))}
                        </select>
                        {templates.length === 0 && (
                            <div style={{ 
                                marginTop: '6px', 
                                padding: '6px', 
                                backgroundColor: 'rgba(123, 104, 238, 0.1)', 
                                borderRadius: '4px',
                                fontSize: '0.8rem',
                                color: '#7B68EE'
                            }}>
                                💡 No templates found. Use "Save Template" to create one.
                            </div>
                        )}
                    </div>
                    
                    {/* Template Actions */}
                    {selectedTemplate && showTemplateActions && (
                        <div className={styles.formGroup}>
                            <label className={styles.formLabel}>Template Actions</label>
                            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                                <button
                                    className={styles.secondaryBtn}
                                    onClick={() => handleEditTemplate(selectedTemplate)}
                                    style={{ padding: '6px 10px', fontSize: '0.85rem' }}
                                    disabled={loading}
                                >
                                    Edit Template
                                </button>
                                <button
                                    className={styles.dangerBtn}
                                    onClick={() => handleDeleteTemplate(selectedTemplate)}
                                    style={{ padding: '6px 10px', fontSize: '0.85rem' }}
                                    disabled={loading}
                                >
                                    Delete Template
                                </button>
                            </div>
                            {templates.find(t => t.id === selectedTemplate)?.customerId && (
                                <div style={{ 
                                    marginTop: '6px', 
                                    padding: '6px', 
                                    backgroundColor: 'rgba(50, 205, 50, 0.1)', 
                                    borderRadius: '4px',
                                    fontSize: '0.8rem',
                                    color: '#32CD32'
                                }}>
                                    🔗 This is a customer-specific template
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Edit Template Modal */}
                {editingTemplate && (
                    <div style={{ 
                        marginTop: '10px', 
                        padding: '12px', 
                        backgroundColor: '#29384D', 
                        borderRadius: '6px',
                        border: '1px solid #5B5B7B'
                    }}>
                        <h4 style={{ color: '#FAFAFA', marginBottom: '10px', fontSize: '1rem' }}>Edit Template: {editingTemplate.name}</h4>
                        
                        <div className={styles.formRow}>
                            <div className={styles.formGroup}>
                                <label className={styles.formLabel}>Template Name *</label>
                                <input
                                    type="text"
                                    className={styles.formInput}
                                    value={editTemplateName}
                                    onChange={(e) => setEditTemplateName(e.target.value)}
                                    placeholder="Enter template name..."
                                />
                            </div>
                        </div>
                        
                        <div style={{ display: 'flex', gap: '10px', marginTop: '15px' }}>
                            <button
                                className={styles.primaryBtn}
                                onClick={handleUpdateTemplate}
                                disabled={loading}
                            >
                                {loading ? 'Updating...' : 'Update Template'}
                            </button>
                            <button
                                className={styles.secondaryBtn}
                                onClick={() => {
                                    setEditingTemplate(null);
                                    setEditTemplateName('');
                                }}
                                disabled={loading}
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                )}

                {showSaveTemplate && (
                    <div style={{ 
                        marginTop: '10px', 
                        padding: '12px', 
                        backgroundColor: '#29384D', 
                        borderRadius: '6px',
                        border: '1px solid #5B5B7B'
                    }}>
                        <h4 style={{ color: '#FAFAFA', marginBottom: '10px', fontSize: '1rem' }}>Save as Template</h4>
                        
                        <div className={styles.formRow}>
                            <div className={styles.formGroup}>
                                <label className={styles.formLabel}>Template Name *</label>
                                <input
                                    type="text"
                                    className={styles.formInput}
                                    value={templateName}
                                    onChange={(e) => setTemplateName(e.target.value)}
                                    placeholder="Enter template name..."
                                />
                            </div>
                        </div>
                        
                        <div style={{ marginBottom: '15px' }}>
                            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#FAFAFA', cursor: 'pointer' }}>
                                <input
                                    type="checkbox"
                                    checked={isCustomerTemplate}
                                    onChange={(e) => {
                                        setIsCustomerTemplate(e.target.checked);
                                        if (!e.target.checked) {
                                            setSelectedCustomerForTemplate('');
                                            setSaveAsDefault(false);
                                        }
                                    }}
                                    style={{ accentColor: '#7B68EE' }}
                                />
                                Link to specific customer
                            </label>
                            {isCustomerTemplate && (
                                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#FAFAFA', cursor: 'pointer', marginLeft: '26px', marginTop: '8px' }}>
                                    <input
                                        type="checkbox"
                                        checked={saveAsDefault}
                                        onChange={(e) => setSaveAsDefault(e.target.checked)}
                                        style={{ accentColor: '#7B68EE' }}
                                    />
                                    Set as customer default template
                                </label>
                            )}
                            <p style={{ color: '#B0B0B0', fontSize: '0.85rem', margin: '5px 0 0 26px' }}>
                                Each customer can have multiple templates but only one default template which is auto-loaded when creating invoices.
                            </p>
                        </div>
                        
                        {isCustomerTemplate && (
                            <div className={styles.formRow}>
                                <div className={styles.formGroup}>
                                    <label className={styles.formLabel}>Select Customer *</label>
                                    <CustomerDropdown
                                        value={selectedCustomerForTemplate}
                                        onChange={(customerId: string) => setSelectedCustomerForTemplate(customerId)}
                                        className={styles.formInput}
                                    />
                                    <div style={{ 
                                        marginTop: '6px', 
                                        fontSize: '0.8rem',
                                        color: '#B0B0B0'
                                    }}>
                                        💡 Select a customer to link this template to them{saveAsDefault ? ' and set as their default' : ' specifically'}
                                    </div>
                                </div>
                            </div>
                        )}
                        
                        <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
                            <button
                                className={styles.primaryBtn}
                                onClick={saveTemplate}
                                disabled={loading}
                            >
                                {loading ? 'Saving...' : 'Save Template'}
                            </button>
                            <button
                                className={styles.secondaryBtn}
                                onClick={() => {
                                    setShowSaveTemplate(false);
                                    setTemplateName('');
                                    setSelectedCustomerForTemplate('');
                                    setIsCustomerTemplate(false);
                                    setSaveAsDefault(false);
                                }}
                                disabled={loading}
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                )}

            </div>

            {/* Customer Selection - Required */}
            <div className={styles.invoiceForm} style={{ marginBottom: '15px' }}>
                <h3 style={{ color: '#FAFAFA', marginBottom: '12px' }}>🏢 Customer Selection (Required)</h3>
                <div className={styles.formRow}>
                    <div className={styles.formGroup} style={{ flex: 1 }}>
                        <label className={styles.formLabel}>Select Customer *</label>
                        <CustomerDropdown
                            value={selectedCustomerForDefault}
                            onChange={handleCustomerSelection}
                            className={`${styles.formInput} ${!selectedCustomerForDefault ? 'error' : ''}`}
                        />
                        {!selectedCustomerForDefault && (
                            <div style={{ color: '#DC143C', fontSize: '0.8rem', marginTop: '4px' }}>
                                Customer selection is required to create an invoice
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <div className={styles.invoiceForm}>
                <h3 style={{color: '#FAFAFA', marginBottom: '15px'}}>Invoice JSON Editor</h3>

                {!isValidJson && (
                    <div className={styles.errorMessage}>
                        <strong>JSON Error:</strong> {jsonError}
                    </div>
                )}

                {isValidJson && invoiceData && (
                    <div className={styles.successMessage}>
                        ✅ Valid JSON - Invoice Total: ${invoiceData.total.toFixed(2)}
                    </div>
                )}

                <div style={{position: 'relative'}}>
                    <div style={{ 
                        display: 'flex', 
                        border: !isValidJson ? '2px solid #DC143C' : '1px solid #5B5B7B',
                        borderRadius: '4px',
                        overflow: 'hidden'
                    }}>
                        {/* Line numbers */}
                        <div style={{
                            backgroundColor: '#1E1E2E',
                            padding: '12px 8px',
                            fontFamily: 'Monaco, Consolas, "Lucida Console", monospace',
                            fontSize: '13px',
                            lineHeight: '1.4',
                            color: '#6B7280',
                            textAlign: 'right',
                            borderRight: '1px solid #5B5B7B',
                            userSelect: 'none',
                            minWidth: '50px'
                        }}>
                            {invoiceJsonDraft.split('\n').map((_, index) => (
                                <div key={index}>{index + 1}</div>
                            ))}
                        </div>
                        
                        <textarea
                            className={`${styles.formInput}`}
                            value={invoiceJsonDraft}
                            onChange={(e) => handleJsonChange(e.target.value)}
                            rows={25}
                            style={{
                                fontFamily: 'Monaco, Consolas, "Lucida Console", monospace',
                                fontSize: '13px',
                                lineHeight: '1.4',
                                resize: 'vertical',
                                width: '100%',
                                border: 'none',
                                outline: 'none',
                                paddingLeft: '12px',
                                backgroundColor: '#29384D'
                            }}
                            placeholder="Enter invoice JSON here..."
                        />
                    </div>
                </div>

                {/* JSON Helper Guide */}
                <div style={{
                    marginTop: '15px', 
                    padding: '15px', 
                    backgroundColor: '#1E1E2E', 
                    borderRadius: '6px',
                    border: '1px solid #5B5B7B'
                }}>
                    <h4 style={{color: '#FAFAFA', marginBottom: '12px', fontSize: '0.95rem'}}>💡 JSON Helper Guide:</h4>
                    <div style={{
                        display: 'grid', 
                        gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', 
                        gap: '15px', 
                        fontSize: '0.8rem'
                    }}>
                        <div>
                            <div style={{color: '#7B68EE', fontWeight: 'bold', marginBottom: '6px'}}>Enum Field Values:</div>
                            <ul style={{color: '#B0B0B0', margin: 0, paddingLeft: '16px', lineHeight: '1.5'}}>
                                <li><strong>currency:</strong> USD, INR, GBP, EUR, AUD</li>
                                <li><strong>status:</strong> draft, sent, paid, overdue</li>
                                <li><strong>paymentMethod:</strong> bank_transfer, check, cash, etc.</li>
                            </ul>
                        </div>
                        <div>
                            <div style={{color: '#32CD32', fontWeight: 'bold', marginBottom: '6px'}}>Field Limits:</div>
                            <ul style={{color: '#B0B0B0', margin: 0, paddingLeft: '16px', lineHeight: '1.5'}}>
                                <li><strong>customFields:</strong> Max 8 items</li>
                                <li><strong>customField.key:</strong> Max 50 chars</li>
                                <li><strong>customField.value:</strong> Max 200 chars</li>
                                <li><strong>items:</strong> At least 1 required</li>
                            </ul>
                        </div>
                        <div>
                            <div style={{color: '#FF6B6B', fontWeight: 'bold', marginBottom: '6px'}}>Hidden Fields:</div>
                            <ul style={{color: '#B0B0B0', margin: 0, paddingLeft: '16px', lineHeight: '1.5'}}>
                                <li><strong>Custom fields:</strong> Prefix key with "*"</li>
                                <li><strong>Example:</strong> "*Internal Note"</li>
                                <li><strong>Core fields:</strong> "*from.email", "*to.phone"</li>
                                <li><strong>Note:</strong> Hidden fields won't appear in PDF</li>
                            </ul>
                        </div>
                    </div>
                    <div style={{marginTop: '12px', padding: '10px', backgroundColor: '#2A2A3E', borderRadius: '4px', overflow: 'hidden'}}>
                        <div style={{color: '#FFD700', fontWeight: 'bold', marginBottom: '6px', fontSize: '0.85rem'}}>💫 Examples:</div>
                        <div style={{
                            color: '#B0B0B0', 
                            fontSize: '0.75rem', 
                            fontFamily: 'monospace',
                            wordWrap: 'break-word',
                            overflowWrap: 'break-word',
                            whiteSpace: 'pre-wrap'
                        }}>
                            <div style={{marginBottom: '4px', wordBreak: 'break-all'}}>{`"customFields": [{"key": "PO Number", "value": "PO-123"}]`}</div>
                            <div style={{marginBottom: '4px'}}>{`"*from.email": "hide@email.com"`}</div>
                            <div style={{marginBottom: '4px'}}>{`"*to.phone": "+1234567890"`}</div>
                            <div>{`"currency": "EUR", "status": "sent"`}</div>
                        </div>
                    </div>
                </div>

                {/* <div style={{marginTop: '10px', padding: '10px', backgroundColor: '#29384D', borderRadius: '4px'}}>
                    <h4 style={{color: '#FAFAFA', marginBottom: '8px', fontSize: '0.95rem'}}>JSON Structure Guide:</h4>
                    <ul style={{color: '#B0B0B0', fontSize: '0.8rem', margin: 0, paddingLeft: '18px', lineHeight: '1.4'}}>
                        <li><strong>invoiceNumber:</strong> Unique invoice identifier (required)</li>
                        <li><strong>projectName:</strong> Name of the project/work being invoiced (required)</li>
                        <li><strong>issueDate, dueDate:</strong> Dates in YYYY-MM-DD format</li>
                        <li><strong>from:</strong> Your details (name, email, address, phone)</li>
                        <li><strong>to:</strong> Client details (name, email, address, company)</li>
                        <li><strong>items:</strong> Array of line items with description, quantity, rate</li>
                        <li><strong>tax:</strong> Tax rate as percentage (e.g., 8.5 for 8.5%)</li>
                        <li><strong>notes, terms:</strong> Additional text for the invoice</li>
                    </ul>
                </div> */}
            </div>

            {/* Action Buttons */}
            <div className={styles.actionButtons}>
                <button
                    className={styles.primaryBtn}
                    onClick={handleCreateOrUpdateInvoice}
                    disabled={loading || !isValidJson}
                >
                    {loading ? (isEditMode ? 'Updating...' : 'Creating...') : (isEditMode ? 'Update Invoice' : 'Save Invoice')}
                </button>
                {isEditMode && (
                    <button
                        className={styles.secondaryBtn}
                        onClick={() => {
                            setIsEditMode(false);
                            onEditComplete?.();
                        }}
                        disabled={loading}
                    >
                        Cancel Edit
                    </button>
                )}
            </div>
        </div>
    );
};

export default InvoiceCreationTab;