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
import TemplateDropdown from './TemplateDropdown';
import styles from '../../pages/Freelance/Freelance.module.scss';

interface InvoiceCreationTabProps {
    onInvoiceDataChange: (data: InvoiceData | null) => void;
    invoiceData: InvoiceData | null;
    editingInvoiceId?: string;
    onEditComplete?: () => void;
    onInvoiceUpdated?: (invoiceId?: string) => void;
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

    // Function to create JSON with inline comments
    const createCommentedJsonString = (data: InvoiceData) => {
        return `{
  "invoiceNumber": "${data.invoiceNumber}",                    // REQUIRED: Unique identifier (e.g., "INV-2024-001")
  "projectName": "${data.projectName}",                        // REQUIRED: Brief description of project/work
  "issueDate": "${data.issueDate}",                            // Date issued - format: YYYY-MM-DD (auto-set to today)
  "dueDate": "${data.dueDate}",                                // Payment due date - format: YYYY-MM-DD (e.g., "2024-12-31")
  "customerId": "${data.customerId}",                          // REQUIRED: Customer ID from database (select from dropdown)
  "currency": "${data.currency}",                              // ENUM: "USD" | "INR" | "GBP" | "EUR" | "AUD"
  "from": {                                                     // Your business information (sender details)
    "name": "${data.from.name}",                               // REQUIRED: Your business name or full name
    "email": "${data.from.email}",                             // Your email (can hide with "*from.email": "email@domain.com")
    "address": "${data.from.address}",                         // Your complete address (can include \\n for line breaks)
    "phone": "${data.from.phone}"                              // Your phone (can hide with "*from.phone": "+1234567890")
  },
  "to": {                                                       // Customer information (recipient details)
    "name": "${data.to.name}",                                 // REQUIRED: Client contact person name
    "email": "${data.to.email}",                               // Client email (can hide with "*to.email": "client@domain.com")
    "address": "${data.to.address}",                           // Client address (can include \\n for line breaks)
    "company": "${data.to.company}"                            // Client company (can hide with "*to.company": "Company Name")
  },
  "customFields": [                                             // Optional fields (max 8) - prefix key with "*" to hide from PDF
    {
      "key": "${data.customFields?.[0]?.key || 'Purchase Order'}",          // Field label (max 50 chars) - visible on invoice
      "value": "${data.customFields?.[0]?.value || ''}"                     // Field value (max 200 chars) - can be empty
    },
    {
      "key": "${data.customFields?.[1]?.key || '*Internal Reference'}",     // Hidden field - prefix with "*" to hide from PDF
      "value": "${data.customFields?.[1]?.value || ''}"                     // Internal notes/references not shown to client
    }
  ],
  "items": [                                                    // REQUIRED: Invoice line items (at least 1 required)
    {
      "description": "${data.items[0]?.description || ''}",               // REQUIRED: Description of service/product
      "quantity": ${data.items[0]?.quantity || 1},                        // Quantity as number (e.g., 1, 2.5, 10)
      "rate": ${data.items[0]?.rate || 0},                                // Rate per unit (e.g., 50, 75.50, 1000)
      "amount": ${data.items[0]?.amount || 0}                             // AUTO-CALCULATED: quantity × rate (do not set manually)
    }
  ],
  "subtotal": ${data.subtotal},                                // AUTO-CALCULATED: Sum of all item amounts (do not set manually)
  "tax": {                                                      // Tax configuration
    "rate": ${data.tax?.rate || 0},                                             // Tax rate as percentage (e.g., 8.5 for 8.5%, 0 for no tax)
    "amount": ${data.tax?.amount || 0}                                          // AUTO-CALCULATED: subtotal × (rate ÷ 100) (do not set manually)
  },
  "total": ${data.total},                                      // AUTO-CALCULATED: subtotal + tax.amount (do not set manually)
  "notes": "${data.notes}",                                    // Additional notes to appear on invoice (optional)
  "terms": "${data.terms}",                                    // Payment terms and conditions (optional)
  "status": "${data.status}",                                  // ENUM: "draft" | "sent" | "paid" | "overdue"
  "payment": {                                                  // Payment info - REQUIRED if status is "paid"
    "paymentMethod": "${data.payment?.paymentMethod || ''}",                     // Examples: "bank_transfer", "check", "cash", "paypal"
    "amountReceived": ${data.payment?.amountReceived || 0},                     // Amount received - must be > 0 if status is "paid"
    "breakdown": ${JSON.stringify(data.payment?.breakdown || {}, null, 4).replace(/\n/g, '\n    ')},     // Optional payment breakdown for partial payments
    "paymentDate": "${data.payment?.paymentDate || ''}",                        // Date received - format: YYYY-MM-DD (required for paid status)
    "notes": "${data.payment?.notes || ''}"                                      // Payment-related notes (optional)
  }
}`;
    };

    // Default invoice structure with comprehensive field explanations
    const defaultInvoiceStructure: InvoiceData = {
        invoiceNumber: '',
        projectName: '',
        issueDate: new Date().toISOString().split('T')[0],
        dueDate: '',
        customerId: '',
        currency: 'USD',
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
        status: 'draft',
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
            loadInvoiceForEdit(editingInvoiceId);
            setIsEditMode(true);
        } else if (!invoiceJsonDraft) {
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

            const initialJsonString = createCommentedJsonString(initialData);
            setInvoiceJsonDraft(initialJsonString);
            validateAndSetJson(initialJsonString);
        }
        loadTemplates();
    }, [editingInvoiceId]);

    useEffect(() => {
        if (invoiceJsonDraft) {
            validateAndSetJson(invoiceJsonDraft);
        }
    }, [invoiceJsonDraft]);

    const loadTemplates = async () => {
        try {
            const templatesData = await fetchInvoiceTemplates();
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
            const cleanJsonStr = jsonStr.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
            const parsed = JSON.parse(cleanJsonStr);
            const errors: string[] = [];

            if (!parsed.invoiceNumber) errors.push('invoiceNumber is required');
            if (!parsed.projectName) errors.push('projectName is required');
            if (!parsed.from?.name) errors.push('from.name is required');
            if (!parsed.to?.name) errors.push('to.name is required');
            if (!parsed.currency) errors.push('currency is required');

            if (!parsed.customerId) {
                errors.push('customerId is required - Please select a customer before creating an invoice');
            }

            const validCurrencies = ['USD', 'INR', 'GBP', 'EUR', 'AUD'];
            if (parsed.currency && !validCurrencies.includes(parsed.currency)) {
                errors.push(`currency must be one of: ${validCurrencies.join(', ')}`);
            }

            const validStatuses = ['draft', 'sent', 'paid', 'overdue'];
            if (parsed.status && !validStatuses.includes(parsed.status)) {
                errors.push(`status must be one of: ${validStatuses.join(', ')}`);
            }

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

            if (parsed.customFields) {
                if (!Array.isArray(parsed.customFields)) {
                    errors.push('customFields must be an array');
                } else {
                    if (parsed.customFields.length > 8) {
                        errors.push('customFields cannot exceed 8 items (current limit)');
                    }

                    parsed.customFields = parsed.customFields.map((field: { key: string; value: string }) => {
                        if (typeof field.key === 'string' && field.key.startsWith('*')) {
                            return {
                                ...field,
                                key: field.key.substring(1),
                                hidden: true
                            };
                        }
                        return {
                            ...field,
                            hidden: false
                        };
                    });

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

            if (errors.length > 0) {
                setJsonError(`Validation errors:\n• ${errors.join('\n• ')}`);
                setIsValidJson(false);
                onInvoiceDataChange(null);
                return;
            }

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

            const hiddenCoreFields: { [key: string]: boolean } = {};
            const coreFieldsToCheck = ['from.email', 'from.phone', 'to.email', 'to.company'];

            coreFieldsToCheck.forEach(fieldPath => {
                const hiddenFieldKey = `*${fieldPath}`;
                const [section, field] = fieldPath.split('.');

                if (parsed[hiddenFieldKey]) {
                    hiddenCoreFields[fieldPath] = true;
                    if (!parsed[section]) parsed[section] = {};
                    parsed[section][field] = parsed[hiddenFieldKey];
                    delete parsed[hiddenFieldKey];
                }
                else if (parsed[`*${section}`] && parsed[`*${section}`][field]) {
                    hiddenCoreFields[fieldPath] = true;
                    if (!parsed[section]) parsed[section] = {};
                    parsed[section][field] = parsed[`*${section}`][field];
                    delete parsed[`*${section}`][field];
                    if (Object.keys(parsed[`*${section}`]).length === 0) {
                        delete parsed[`*${section}`];
                    }
                }
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

            await loadTemplates();
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
                status: 'draft' as const
            };

            const templateJsonString = createCommentedJsonString(templateWithNewInvoiceNumber);
            setInvoiceJsonDraft(templateJsonString);
            validateAndSetJson(templateJsonString);
            setShowTemplateActions(true);

            if (template.customerId) {
                setSelectedCustomerForDefault(template.customerId);
            } else if (templateWithNewInvoiceNumber.customerId) {
                setSelectedCustomerForDefault(templateWithNewInvoiceNumber.customerId);
            }
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
                await loadTemplates();
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

            await loadTemplates();
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
        const newJsonString = createCommentedJsonString(newData);
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
            const invoice = await fetchInvoiceById(invoiceId);
            const invoiceJsonString = JSON.stringify(invoice, null, 2);
            setInvoiceJsonDraft(invoiceJsonString);
            validateAndSetJson(invoiceJsonString);

            if (invoice.customerId) {
                setSelectedCustomerForDefault(invoice.customerId);
            }
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
            const currentData = invoiceJsonDraft ? JSON.parse(invoiceJsonDraft.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '')) : defaultInvoiceStructure;
            const updatedData = {
                ...currentData,
                customerId: customerId
            };

            const updatedJsonString = createCommentedJsonString(updatedData);
            setInvoiceJsonDraft(updatedJsonString);
            validateAndSetJson(updatedJsonString);
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
                onInvoiceUpdated?.();
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

    return (
        <div>
            {/* Quick Start & Actions */}
            <div className={styles.invoiceForm} style={{marginBottom: '15px'}}>
                <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    marginBottom: '10px',
                    flexWrap: 'wrap',
                    gap: '10px'
                }}>
                    <h3 style={{color: '#FAFAFA', margin: 0}}>Quick Start & Actions</h3>
                    <div style={{display: 'flex', gap: '6px', flexWrap: 'wrap'}}>
                        <button
                            className={styles.secondaryBtn}
                            onClick={() => setShowSaveTemplate(!showSaveTemplate)}
                            style={{padding: '6px 10px', fontSize: '0.85rem'}}
                        >
                            Save Template
                        </button>
                        <button
                            className={styles.secondaryBtn}
                            onClick={resetToDefault}
                            style={{padding: '6px 10px', fontSize: '0.85rem'}}
                        >
                            Reset
                        </button>
                        <button
                            className={styles.secondaryBtn}
                            onClick={formatJson}
                            disabled={!isValidJson}
                            style={{padding: '6px 10px', fontSize: '0.85rem'}}
                        >
                            Format
                        </button>
                    </div>
                </div>

                {/* Template and Customer Selection Row */}
                <div className={styles.formRow}>
                    <div className={styles.formGroup} style={{flex: 1, minWidth: 0}}>
                        <label className={styles.formLabel}>Load Saved Template</label>
                        <TemplateDropdown
                            value={selectedTemplate}
                            onChange={(templateId) => {
                                setSelectedTemplate(templateId);
                                if (templateId) {
                                    loadTemplate(templateId);
                                }
                            }}
                            templates={templates}
                            className={styles.formInput}
                            placeholder="Select a template..."
                        />
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

                    <div className={styles.formGroup} style={{flex: 1, minWidth: 0}}>
                        <label className={styles.formLabel}>🏢 Select Customer (Required) *</label>
                        <CustomerDropdown
                            value={selectedCustomerForDefault}
                            onChange={handleCustomerSelection}
                            className={styles.formInput}
                        />
                    </div>
                </div>

                {/* Template Actions */}
                {selectedTemplate && showTemplateActions && (
                    <div style={{marginTop: '15px', paddingTop: '15px', borderTop: '1px solid rgba(255, 255, 255, 0.2)'}}>
                        <div className={styles.formRow}>
                            <div className={styles.formGroup}>
                                <label className={styles.formLabel}>Template Actions</label>
                                <div style={{display: 'flex', gap: '6px', flexWrap: 'wrap'}}>
                                    <button
                                        className={styles.secondaryBtn}
                                        onClick={() => handleEditTemplate(selectedTemplate)}
                                        style={{padding: '6px 10px', fontSize: '0.85rem'}}
                                        disabled={loading}
                                    >
                                        Edit Template
                                    </button>
                                    <button
                                        className={styles.dangerBtn}
                                        onClick={() => handleDeleteTemplate(selectedTemplate)}
                                        style={{padding: '6px 10px', fontSize: '0.85rem'}}
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
                        </div>
                    </div>
                )}

                {/* Edit Template Modal */}
                {editingTemplate && (
                    <div style={{
                        marginTop: '10px',
                        padding: '12px',
                        backgroundColor: '#29384D',
                        borderRadius: '6px',
                        border: '1px solid #5B5B7B'
                    }}>
                        <h4 style={{color: '#FAFAFA', marginBottom: '10px', fontSize: '1rem'}}>Edit
                            Template: {editingTemplate.name}</h4>

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

                        <div style={{display: 'flex', gap: '10px', marginTop: '15px'}}>
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
                        <h4 style={{color: '#FAFAFA', marginBottom: '10px', fontSize: '1rem'}}>Save as Template</h4>

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

                        <div style={{marginBottom: '15px'}}>
                            <label style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                                color: '#FAFAFA',
                                cursor: 'pointer'
                            }}>
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
                                    style={{accentColor: '#7B68EE'}}
                                />
                                Link to specific customer
                            </label>
                            {isCustomerTemplate && (
                                <label style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '8px',
                                    color: '#FAFAFA',
                                    cursor: 'pointer',
                                    marginLeft: '26px',
                                    marginTop: '8px'
                                }}>
                                    <input
                                        type="checkbox"
                                        checked={saveAsDefault}
                                        onChange={(e) => setSaveAsDefault(e.target.checked)}
                                        style={{accentColor: '#7B68EE'}}
                                    />
                                    Set as customer default template
                                </label>
                            )}
                            <p style={{color: '#B0B0B0', fontSize: '0.85rem', margin: '5px 0 0 26px'}}>
                                Each customer can have multiple templates but only one default template which is
                                auto-loaded when creating invoices.
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
                                        💡 Select a customer to link this template to
                                        them{saveAsDefault ? ' and set as their default' : ' specifically'}
                                    </div>
                                </div>
                            </div>
                        )}

                        <div style={{display: 'flex', gap: '10px', marginTop: '20px'}}>
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
                        border: !isValidJson ? '2px solid #ff6b6b' : '1px solid #5B5B7B',
                        borderRadius: '4px',
                        overflow: 'hidden'
                    }}>
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
                            {invoiceJsonDraft?.split('\n').map((_, index) => (
                                <div key={index}>{index + 1}</div>
                            ))}
                        </div>

                        <textarea
                            className={`${styles.formInput}`}
                            value={invoiceJsonDraft || ''}
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
                            <div style={{color: '#7B68EE', fontWeight: 'bold', marginBottom: '6px'}}>Enum Field
                                Values:
                            </div>
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
                            <div style={{color: '#FF6B6B', fontWeight: 'bold', marginBottom: '6px'}}>Hidden Fields:
                            </div>
                            <ul style={{color: '#B0B0B0', margin: 0, paddingLeft: '16px', lineHeight: '1.5'}}>
                                <li><strong>Custom fields:</strong> Prefix key with "*"</li>
                                <li><strong>Example:</strong> "*Internal Note"</li>
                                <li><strong>Core fields:</strong> "*from.email", "*to.phone"</li>
                                <li><strong>Note:</strong> Hidden fields won't appear in PDF</li>
                            </ul>
                        </div>
                    </div>
                    <div style={{
                        marginTop: '12px',
                        padding: '10px',
                        backgroundColor: '#2A2A3E',
                        borderRadius: '4px',
                        overflow: 'hidden'
                    }}>
                        <div style={{color: '#FFD700', fontWeight: 'bold', marginBottom: '6px', fontSize: '0.85rem'}}>💫
                            Examples:
                        </div>
                        <div style={{
                            color: '#B0B0B0',
                            fontSize: '0.75rem',
                            fontFamily: 'monospace',
                            wordWrap: 'break-word',
                            overflowWrap: 'break-word',
                            whiteSpace: 'pre-wrap'
                        }}>
                            <div style={{
                                marginBottom: '4px',
                                wordBreak: 'break-all'
                            }}>{`"customFields": [{"key": "PO Number", "value": "PO-123"}]`}</div>
                            <div style={{marginBottom: '4px'}}>{`"*from.email": "hide@email.com"`}</div>
                            <div style={{marginBottom: '4px'}}>{`"*to.phone": "+1234567890"`}</div>
                            <div>{`"currency": "EUR", "status": "sent"`}</div>
                        </div>
                    </div>
                </div>
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