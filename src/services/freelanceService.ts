import axios from './AxiosConfig.tsx';
import {queueRequest} from './AxiosQueueManager.tsx';
import {withCacheCleared} from './transactionService.ts';
import {
    FreelanceDashboard,
    InvoiceData,
    FreelanceEarning,
    SignatureData,
    CreateInvoiceResponse,
    UpdateInvoiceResponse,
    DeleteInvoiceResponse,
    FetchInvoicesResponse,
    FetchCustomersResponse,
    CreateCustomerRequest,
    CreateCustomerResponse,
    UpdateCustomerRequest,
    UpdateCustomerResponse,
    DeleteCustomerResponse,
    UpdateCustomerTemplateResponse,
    Customer,
    InvoiceTemplate,
    CreateTemplateResponse,
    UpdateTemplateResponse,
    DeleteTemplateResponse,
    Signature,
    UploadSignatureResponse,
    DeleteSignatureResponse
} from '../utils/interfaces';
import {jsPDF} from 'jspdf';

/**
 * Helper to add request ID for tracking or cache invalidation.
 */
function withRequestId(endpoint: string, options: Record<string, unknown> = {}): Record<string, unknown> {
    return {
        ...options,
        id: `${endpoint}-${JSON.stringify(options.params || {})}`,
    };
}

// Dashboard endpoints

/**
 * Fetch freelance dashboard analytics data.
 */
export async function fetchFreelanceDashboard(clearCache = false): Promise<FreelanceDashboard> {
    const options = withRequestId('api/freelance/dashboard', clearCache ? withCacheCleared() : {});
    const response = await queueRequest(() =>
        axios.get('freelance/dashboard', options)
    );
    return response.data;
}

/**
 * Fetch earnings filtered by date range.
 */
export async function fetchEarningsByDateRange(
    startDate: string,
    endDate: string,
    clearCache = false
): Promise<FreelanceEarning[]> {
    const options = withRequestId('api/freelance/earnings', clearCache ? withCacheCleared({
        params: {startDate, endDate}
    }) : {
        params: {startDate, endDate}
    });
    const response = await queueRequest(() =>
        axios.get('freelance/earnings', options)
    );
    return response.data;
}

// Invoice management endpoints

/**
 * Create a new invoice.
 */
export async function createInvoice(invoiceData: InvoiceData): Promise<CreateInvoiceResponse> {
    const options = withRequestId('api/freelance/invoices/create', withCacheCleared());
    const response = await queueRequest(() =>
        axios.post('freelance/invoices', invoiceData, options)
    );
    return response.data;
}

/**
 * Update an existing invoice.
 */
export async function updateInvoice(
    invoiceId: string,
    invoiceData: InvoiceData
): Promise<UpdateInvoiceResponse> {
    const options = withRequestId(`api/freelance/invoices/${invoiceId}`, withCacheCleared());
    const response = await queueRequest(() =>
        axios.put(`freelance/invoices/${invoiceId}`, invoiceData, options)
    );
    return response.data;
}

/**
 * Delete an invoice.
 */
export async function deleteInvoice(invoiceId: string): Promise<DeleteInvoiceResponse> {
    const options = withRequestId(`api/freelance/invoices/${invoiceId}/delete`, withCacheCleared());
    const response = await queueRequest(() =>
        axios.delete(`freelance/invoices/${invoiceId}`, options)
    );
    return response.data;
}

/**
 * Fetch specific invoice by ID.
 */
export async function fetchInvoiceById(
    invoiceId: string,
    clearCache = true
): Promise<InvoiceData> {
    const options = withRequestId(`api/freelance/invoices/${invoiceId}`, clearCache ? withCacheCleared() : {});
    const response = await queueRequest(() =>
        axios.get(`freelance/invoices/${invoiceId}`, options)
    );
    return response.data.invoice;
}

/**
 * Fetch all invoices with pagination.
 */
export async function fetchAllInvoices(
    page = 1,
    limit = 10,
    clearCache = false
): Promise<FetchInvoicesResponse> {
    const options = withRequestId('api/freelance/invoices', clearCache ? withCacheCleared({
        params: {page, limit}
    }) : {
        params: {page, limit}
    });
    const response = await queueRequest(() =>
        axios.get('freelance/invoices', options)
    );
    return response.data;
}

// PDF generation and preview endpoints

/**
 * Generate PDF from invoice data.
 */
export async function generateInvoicePDF(invoiceData: InvoiceData): Promise<Blob> {
    const options = withRequestId('api/freelance/invoices/pdf', {
        responseType: 'blob'
    });
    const response = await queueRequest(() =>
        axios.post('freelance/invoices/pdf', invoiceData, options)
    );
    return response.data;
}

/**
 * Generate local PDF fallback using jsPDF when backend is unavailable.
 */
export async function generateInvoicePDFLocal(invoiceData: InvoiceData): Promise<Blob> {
    // Create a new jsPDF instance with A4 format
    const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
    });

    // Set up colors
    const primaryColor = [123, 104, 238]; // #7B68EE
    const textColor = [51, 51, 51]; // #333
    const grayColor = [102, 102, 102]; // #666

    // Currency symbols
    const currencySymbols: Record<string, string> = {
        'USD': '$',
        'INR': '₹',
        'GBP': '£',
        'EUR': '€',
        'AUD': 'A$'
    };
    const currencySymbol = currencySymbols[invoiceData.currency] || '$';

    // Page dimensions
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 20;
    let yPosition = margin;

    // Helper function to add text with automatic line breaks
    const addText = (text: string, x: number, y: number, maxWidth?: number) => {
        if (maxWidth) {
            const lines = doc.splitTextToSize(text, maxWidth);
            doc.text(lines, x, y);
            return y + (lines.length * 5); // 5mm line height
        } else {
            doc.text(text, x, y);
            return y + 7; // Single line height
        }
    };

    // Header - Invoice Title
    doc.setFontSize(28);
    doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.text('INVOICE', pageWidth / 2, yPosition, {align: 'center'});

    yPosition += 12;
    doc.setFontSize(16);
    doc.setTextColor(grayColor[0], grayColor[1], grayColor[2]);
    doc.text(`#${invoiceData.invoiceNumber}`, pageWidth / 2, yPosition, {align: 'center'});

    yPosition += 8;
    if (invoiceData.projectName) {
        doc.setFontSize(12);
        doc.setTextColor(grayColor[0], grayColor[1], grayColor[2]);
        doc.text(`Project: ${invoiceData.projectName}`, pageWidth / 2, yPosition, {align: 'center'});
        yPosition += 8;
    }

    yPosition += 12;

    // Dates section
    doc.setFontSize(10);
    doc.setTextColor(textColor[0], textColor[1], textColor[2]);
    doc.text(`Issue Date: ${new Date(invoiceData.issueDate).toLocaleDateString()}`, margin, yPosition);
    doc.text(`Due Date: ${new Date(invoiceData.dueDate).toLocaleDateString()}`, margin, yPosition + 5);

    yPosition += 20;

    // From and To sections
    const leftColWidth = (pageWidth - 3 * margin) / 2;
    const rightColStart = margin + leftColWidth + margin;

    // From section
    doc.setFontSize(12);
    doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.text('From:', margin, yPosition);

    doc.setFontSize(10);
    doc.setTextColor(textColor[0], textColor[1], textColor[2]);
    let fromY = yPosition + 7;
    doc.setFont('helvetica', 'bold');
    fromY = addText(invoiceData.from.name, margin, fromY, leftColWidth);
    doc.setFont('helvetica', 'normal');
    
    // Check if email should be hidden
    if (!invoiceData.hiddenCoreFields?.['from.email']) {
        fromY = addText(invoiceData.from.email, margin, fromY, leftColWidth);
    }
    
    fromY = addText(invoiceData.from.address, margin, fromY, leftColWidth);
    
    // Check if phone should be hidden
    if (invoiceData.from.phone && !invoiceData.hiddenCoreFields?.['from.phone']) {
        fromY = addText(invoiceData.from.phone, margin, fromY, leftColWidth);
    }

    // To section
    doc.setFontSize(12);
    doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.text('To:', rightColStart, yPosition);

    doc.setFontSize(10);
    doc.setTextColor(textColor[0], textColor[1], textColor[2]);
    let toY = yPosition + 7;
    doc.setFont('helvetica', 'bold');
    toY = addText(invoiceData.to.name, rightColStart, toY, leftColWidth);
    doc.setFont('helvetica', 'normal');
    
    // Check if company should be hidden
    if (invoiceData.to.company && !invoiceData.hiddenCoreFields?.['to.company']) {
        doc.setFont('helvetica', 'italic');
        toY = addText(invoiceData.to.company, rightColStart, toY, leftColWidth);
        doc.setFont('helvetica', 'normal');
    }
    
    // Check if email should be hidden
    if (!invoiceData.hiddenCoreFields?.['to.email']) {
        toY = addText(invoiceData.to.email, rightColStart, toY, leftColWidth);
    }
    
    toY = addText(invoiceData.to.address, rightColStart, toY, leftColWidth);

    yPosition = Math.max(fromY, toY) + 15;

    // Custom Fields section (only non-hidden fields)
    const visibleCustomFields = invoiceData.customFields?.filter(field => !field.hidden) || [];
    if (visibleCustomFields.length > 0) {
        doc.setFontSize(12);
        doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
        doc.text('Additional Information:', margin, yPosition);

        yPosition += 8;
        doc.setFontSize(10);
        doc.setTextColor(textColor[0], textColor[1], textColor[2]);

        // Create a grid layout for custom fields
        const fieldsPerRow = 2;
        const fieldWidth = (pageWidth - 3 * margin) / fieldsPerRow;
        
        visibleCustomFields.forEach((field, index) => {
            const row = Math.floor(index / fieldsPerRow);
            const col = index % fieldsPerRow;
            const fieldX = margin + col * (fieldWidth + margin);
            const fieldY = yPosition + row * 12;

            doc.setFont('helvetica', 'bold');
            doc.text(`${field.key}:`, fieldX, fieldY);
            doc.setFont('helvetica', 'normal');
            doc.text(field.value || '-', fieldX, fieldY + 4, { maxWidth: fieldWidth - 10 });
        });

        yPosition += Math.ceil(visibleCustomFields.length / fieldsPerRow) * 12 + 10;
    }

    // Items table
    const tableStartY = yPosition;
    const colWidths = [70, 25, 35, 35]; // Description, Qty, Rate, Amount
    const tableWidth = colWidths.reduce((sum, width) => sum + width, 0);
    const tableStartX = margin;

    // Table header
    doc.setFillColor(245, 245, 245);
    doc.rect(tableStartX, yPosition, tableWidth, 8, 'F');

    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(textColor[0], textColor[1], textColor[2]);

    let xPos = tableStartX + 2;
    doc.text('Description', xPos, yPosition + 5.5);
    xPos += colWidths[0];
    doc.text('Qty', xPos, yPosition + 5.5, {align: 'right'});
    xPos += colWidths[1] - 2;
    doc.text('Rate', xPos, yPosition + 5.5, {align: 'right'});
    xPos += colWidths[2] - 2;
    doc.text('Amount', xPos, yPosition + 5.5, {align: 'right'});

    yPosition += 8;

    // Table rows
    doc.setFont('helvetica', 'normal');
    invoiceData.items.forEach((item, index) => {
        const rowHeight = 8;

        // Alternate row background
        if (index % 2 === 1) {
            doc.setFillColor(250, 250, 250);
            doc.rect(tableStartX, yPosition, tableWidth, rowHeight, 'F');
        }

        xPos = tableStartX + 2;
        doc.text(item.description, xPos, yPosition + 5.5, {maxWidth: colWidths[0] - 4});
        xPos += colWidths[0];
        doc.text(item.quantity.toString(), xPos - 2, yPosition + 5.5, {align: 'right'});
        xPos += colWidths[1];
        doc.text(`${currencySymbol}${item.rate.toFixed(2)}`, xPos - 2, yPosition + 5.5, {align: 'right'});
        xPos += colWidths[2];
        doc.text(`${currencySymbol}${item.amount.toFixed(2)}`, xPos - 2, yPosition + 5.5, {align: 'right'});

        yPosition += rowHeight;
    });

    // Table border
    doc.setDrawColor(221, 221, 221);
    doc.rect(tableStartX, tableStartY, tableWidth, yPosition - tableStartY);

    // Vertical lines for table
    let currentX = tableStartX;
    for (let i = 0; i < colWidths.length - 1; i++) {
        currentX += colWidths[i];
        doc.line(currentX, tableStartY, currentX, yPosition);
    }

    yPosition += 15;

    // Totals section
    const totalsX = pageWidth - margin - 60;

    doc.setFontSize(10);
    doc.text(`Subtotal:`, totalsX, yPosition);
    doc.text(`${currencySymbol}${invoiceData.subtotal.toFixed(2)}`, pageWidth - margin, yPosition, {align: 'right'});

    if (invoiceData.tax && invoiceData.tax.rate > 0) {
        yPosition += 6;
        doc.text(`Tax (${invoiceData.tax.rate}%):`, totalsX, yPosition);
        doc.text(`${currencySymbol}${invoiceData.tax.amount.toFixed(2)}`, pageWidth - margin, yPosition, {align: 'right'});
    }

    yPosition += 8;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);

    // Total line
    doc.setDrawColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.setLineWidth(0.5);
    doc.line(totalsX, yPosition - 2, pageWidth - margin, yPosition - 2);

    doc.text(`Total:`, totalsX, yPosition + 3);
    doc.text(`${currencySymbol}${invoiceData.total.toFixed(2)}`, pageWidth - margin, yPosition + 3, {align: 'right'});

    yPosition += 20;

    // Notes and Terms
    if (invoiceData.notes || invoiceData.terms) {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10);
        doc.setTextColor(textColor[0], textColor[1], textColor[2]);

        if (invoiceData.notes) {
            doc.setFont('helvetica', 'bold');
            doc.text('Notes:', margin, yPosition);
            doc.setFont('helvetica', 'normal');
            yPosition = addText(invoiceData.notes, margin, yPosition + 6, pageWidth - 2 * margin);
            yPosition += 5;
        }

        if (invoiceData.terms) {
            doc.setFont('helvetica', 'bold');
            doc.text('Terms & Conditions:', margin, yPosition);
            doc.setFont('helvetica', 'normal');
            yPosition = addText(invoiceData.terms, margin, yPosition + 6, pageWidth - 2 * margin);
        }
    }

    // Footer
    doc.setFontSize(8);
    doc.setTextColor(grayColor[0], grayColor[1], grayColor[2]);
    const footerY = pageHeight - 15;
    doc.setDrawColor(238, 238, 238);
    doc.line(margin, footerY - 5, pageWidth - margin, footerY - 5);
    doc.text(
        `Invoice generated on ${new Date().toLocaleDateString()} • Thank you for your business!`,
        pageWidth / 2,
        footerY,
        {align: 'center'}
    );

    // Convert to blob and return
    const pdfBlob = doc.output('blob');
    return Promise.resolve(pdfBlob);
}

/**
 * Generate preview URL for invoice PDF.
 */
export async function previewInvoicePDF(invoiceData: InvoiceData): Promise<string> {
    const pdfBlob = await generateInvoicePDF(invoiceData);
    return URL.createObjectURL(pdfBlob);
}

// Signature management endpoints

/**
 * Upload new signature image.
 */
export async function uploadSignature(
    signatureFile: File
): Promise<UploadSignatureResponse> {
    const formData = new FormData();
    formData.append('signature', signatureFile);

    const options = withRequestId('api/freelance/signatures/upload', withCacheCleared());
    const response = await queueRequest(() =>
        axios.post('freelance/signatures', formData, {
            ...options,
            headers: {
                'Content-Type': 'multipart/form-data',
            },
        })
    );
    return response.data;
}

/**
 * Fetch all user signatures.
 */
export async function fetchUserSignatures(
    clearCache = false
): Promise<Signature[]> {
    const options = withRequestId('api/freelance/signatures', clearCache ? withCacheCleared() : {});
    const response = await queueRequest(() =>
        axios.get('freelance/signatures', options)
    );
    return response.data;
}

/**
 * Delete a signature.
 */
export async function deleteSignature(signatureId: string): Promise<DeleteSignatureResponse> {
    const options = withRequestId(`api/freelance/signatures/${signatureId}/delete`, withCacheCleared());
    const response = await queueRequest(() =>
        axios.delete(`freelance/signatures/${signatureId}`, options)
    );
    return response.data;
}

/**
 * Sign invoice PDF with signature data.
 */
export async function signInvoicePDF(
    invoiceId: string,
    signatureData: SignatureData
): Promise<Blob> {
    const options = withRequestId(`api/freelance/invoices/${invoiceId}/sign`, {
        responseType: 'blob'
    });
    const response = await queueRequest(() =>
        axios.post(`freelance/invoices/${invoiceId}/sign`, signatureData, options)
    );
    return response.data;
}

// Customer management endpoints

/**
 * Fetch all customers for the authenticated user.
 */
export async function fetchCustomers(
    page = 1,
    limit = 10,
    clearCache = false,
    search = ''
): Promise<FetchCustomersResponse> {
    const params: Record<string, string | number> = { page, limit };
    if (search) {
        params.search = search;
    }
    
    const options = withRequestId('api/freelance/customers', clearCache ? withCacheCleared({
        params
    }) : {
        params
    });
    const response = await queueRequest(() =>
        axios.get('freelance/customers', options)
    );
    return response.data;
}

/**
 * Fetch all customers as array (backward compatibility).
 */
export async function fetchAllCustomers(clearCache = false): Promise<Customer[]> {
    const response = await fetchCustomers(1, 1000, clearCache); // Get a large page to fetch all
    return response.customers;
}

/**
 * Create a new customer.
 */
export async function createCustomer(customerData: CreateCustomerRequest): Promise<CreateCustomerResponse> {
    const options = withRequestId('api/freelance/customers/create', withCacheCleared());
    const response = await queueRequest(() =>
        axios.post('freelance/customers', customerData, options)
    );
    return response.data;
}

/**
 * Update existing customer.
 */
export async function updateCustomer(
    customerId: string,
    customerData: UpdateCustomerRequest
): Promise<UpdateCustomerResponse> {
    const options = withRequestId(`api/freelance/customers/${customerId}`, withCacheCleared());
    const response = await queueRequest(() =>
        axios.put(`freelance/customers/${customerId}`, customerData, options)
    );
    return response.data;
}

/**
 * Delete customer.
 */
export async function deleteCustomer(customerId: string): Promise<DeleteCustomerResponse> {
    const options = withRequestId(`api/freelance/customers/${customerId}/delete`, withCacheCleared());
    const response = await queueRequest(() =>
        axios.delete(`freelance/customers/${customerId}`, options)
    );
    return response.data;
}

/**
 * Update customer's default invoice template.
 */
export async function updateCustomerTemplate(
    customerId: string,
    template: Partial<InvoiceData>
): Promise<UpdateCustomerTemplateResponse> {
    const options = withRequestId(`api/freelance/customers/${customerId}/template`, withCacheCleared());
    const response = await queueRequest(() =>
        axios.put(`freelance/customers/${customerId}/template`, {template}, options)
    );
    return response.data;
}

// Template management endpoints

/**
 * Fetch all invoice templates for the authenticated user.
 */
export async function fetchInvoiceTemplates(clearCache = false): Promise<InvoiceTemplate[]> {
    const options = withRequestId('api/freelance/templates', clearCache ? withCacheCleared() : {});
    const response = await queueRequest(() =>
        axios.get('freelance/templates', options)
    );
    return response.data.templates;
}

/**
 * Save new invoice template.
 */
export async function saveInvoiceTemplate(
    templateName: string,
    invoiceData: InvoiceData,
    customerId?: string,
    isCustomerDefault?: boolean
): Promise<CreateTemplateResponse> {
    const options = withRequestId('api/freelance/templates/create', withCacheCleared());
    const response = await queueRequest(() =>
        axios.post('freelance/templates', {
            name: templateName,
            templateData: invoiceData,
            customerId,
            isCustomerDefault
        }, options)
    );
    return response.data;
}

/**
 * Update existing invoice template.
 */
export async function updateInvoiceTemplate(
    templateId: string,
    templateData: Partial<InvoiceTemplate>
): Promise<UpdateTemplateResponse> {
    const options = withRequestId(`api/freelance/templates/${templateId}`, withCacheCleared());
    const response = await queueRequest(() =>
        axios.put(`freelance/templates/${templateId}`, templateData, options)
    );
    return response.data;
}

/**
 * Delete invoice template.
 */
export async function deleteInvoiceTemplate(templateId: string): Promise<DeleteTemplateResponse> {
    const options = withRequestId(`api/freelance/templates/${templateId}/delete`, withCacheCleared());
    const response = await queueRequest(() =>
        axios.delete(`freelance/templates/${templateId}`, options)
    );
    return response.data;
}