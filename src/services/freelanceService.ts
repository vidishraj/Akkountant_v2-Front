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
    const margin = 20;
    let yPosition = margin;

    // Add rounded image in top left corner (hardcoded path - replace with your image)
    const logoImagePath = 'img.png'; // Replace with your base64 image
    const logoSize = 25; // Size in mm
    const logoX = margin;
    const logoY = margin;

    try {
        // Add the image (you'll need to replace logoImagePath with your actual image data)
        doc.addImage(logoImagePath, 'PNG', logoX, logoY, logoSize, logoSize);

        // Create rounded corners effect by adding a white border mask
        doc.setDrawColor(255, 255, 255);
        doc.setLineWidth(2);

        // Draw rounded rectangle outline to create the rounded effect
        const radius = 3;
        doc.roundedRect(logoX - 1, logoY - 1, logoSize + 2, logoSize + 2, radius, radius, 'S');

        // Adjust yPosition to account for the logo
        yPosition = Math.max(yPosition, logoY + logoSize + 10);
    } catch (error) {
        console.warn('Failed to add logo image to PDF:', error);
        // Continue without logo if image fails to load
    }

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

    // Helper function to add right-aligned text
    const addRightAlignedText = (text: string, y: number, maxWidth?: number) => {
        if (maxWidth) {
            const lines = doc.splitTextToSize(text, maxWidth);
            lines.forEach((line: string, index: number) => {
                doc.text(line, pageWidth - margin, y + (index * 5), {align: 'right'});
            });
            return y + (lines.length * 5);
        } else {
            doc.text(text, pageWidth - margin, y, {align: 'right'});
            return y + 7;
        }
    };

    // Add "From" section in top right, parallel to logo - RIGHT ALIGNED
    const fromSectionY = logoY; // Same Y position as logo
    const fromSectionWidth = 80; // Max width for text wrapping

    doc.setFontSize(12);
    doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.text('From:', pageWidth - margin, fromSectionY, {align: 'right'});

    doc.setFontSize(10);
    doc.setTextColor(textColor[0], textColor[1], textColor[2]);
    let fromY = fromSectionY + 7;
    doc.setFont('helvetica', 'bold');
    fromY = addRightAlignedText(invoiceData.from.name, fromY, fromSectionWidth);
    doc.setFont('helvetica', 'normal');

    // Check if email should be hidden
    if (!invoiceData.hiddenCoreFields?.['from.email']) {
        fromY = addRightAlignedText(invoiceData.from.email, fromY, fromSectionWidth);
    }

    fromY = addRightAlignedText(invoiceData.from.address, fromY, fromSectionWidth);

    // Check if phone should be hidden
    if (invoiceData.from.phone && !invoiceData.hiddenCoreFields?.['from.phone']) {
        fromY = addRightAlignedText(invoiceData.from.phone, fromY, fromSectionWidth);
    }

    // Update yPosition to account for both logo and from section
    yPosition = Math.max(yPosition, fromY + 10);

    // Add horizontal separating line below logo and from section
    doc.setDrawColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.setLineWidth(0.5);
    doc.line(margin, yPosition, pageWidth - margin, yPosition);

    yPosition += 15; // Add space after the line

    // Create two columns below the separator line
    const leftColumnWidth = (pageWidth - 3 * margin) / 2;
    const sectionStartY = yPosition;

    // LEFT COLUMN: To section
    doc.setFontSize(12);
    doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.text('To:', margin, sectionStartY);

    doc.setFontSize(10);
    doc.setTextColor(textColor[0], textColor[1], textColor[2]);
    let toY = sectionStartY + 7;
    doc.setFont('helvetica', 'bold');
    toY = addText(invoiceData.to.name, margin, toY, leftColumnWidth);
    doc.setFont('helvetica', 'normal');

    // Check if company should be hidden
    if (invoiceData.to.company && !invoiceData.hiddenCoreFields?.['to.company']) {
        doc.setFont('helvetica', 'italic');
        toY = addText(invoiceData.to.company, margin, toY, leftColumnWidth);
        doc.setFont('helvetica', 'normal');
    }

    // Check if email should be hidden
    if (!invoiceData.hiddenCoreFields?.['to.email']) {
        toY = addText(invoiceData.to.email, margin, toY, leftColumnWidth);
    }

    toY = addText(invoiceData.to.address, margin, toY, leftColumnWidth);

    // RIGHT COLUMN: Invoice details (invoice number, dates, custom fields) - RIGHT ALIGNED
    let detailsY = sectionStartY;

    // Invoice Number
    doc.setFontSize(12);
    const invoiceLabel = 'Invoice#: ';
    const invoiceValue = `${invoiceData.invoiceNumber}`;

    // Calculate total width to position correctly when right-aligned
    doc.setFont('helvetica', 'normal');
    const invoiceLabelWidth = doc.getTextWidth(invoiceLabel);
    doc.setFont('helvetica', 'bold');
    const invoiceValueWidth = doc.getTextWidth(invoiceValue);
    const totalWidth = invoiceLabelWidth + invoiceValueWidth;

    // Draw label in purple
    doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.setFont('helvetica', 'normal');
    doc.text(invoiceLabel, pageWidth - margin - totalWidth, detailsY);

    // Draw value in black (bold)
    doc.setTextColor(textColor[0], textColor[1], textColor[2]);
    doc.setFont('helvetica', 'bold');
    doc.text(invoiceValue, pageWidth - margin - invoiceValueWidth, detailsY);

    detailsY += 8; // spacing

    // Issue Date
    doc.setFontSize(10);
    const issueDateLabel = 'Issue Date: ';
    const issueDateValue = new Date(invoiceData.issueDate).toLocaleDateString();

    // Calculate total width to position correctly when right-aligned
    doc.setFont('helvetica', 'normal');
    const issueDateLabelWidth = doc.getTextWidth(issueDateLabel);
    const issueDateValueWidth = doc.getTextWidth(issueDateValue);
    const issueDateTotalWidth = issueDateLabelWidth + issueDateValueWidth;

    // Draw label in purple
    doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.text(issueDateLabel, pageWidth - margin - issueDateTotalWidth, detailsY);

    // Draw value in black
    doc.setTextColor(textColor[0], textColor[1], textColor[2]);
    doc.text(issueDateValue, pageWidth - margin - issueDateValueWidth, detailsY);

    detailsY += 6; // spacing

    // Due Date
    doc.setFontSize(10);
    const dueDateLabel = 'Due Date: ';
    const dueDateValue = new Date(invoiceData.dueDate).toLocaleDateString();

    // Calculate total width to position correctly when right-aligned
    doc.setFont('helvetica', 'normal');
    const dueDateLabelWidth = doc.getTextWidth(dueDateLabel);
    const dueDateValueWidth = doc.getTextWidth(dueDateValue);
    const dueDateTotalWidth = dueDateLabelWidth + dueDateValueWidth;

    // Draw label in purple
    doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.text(dueDateLabel, pageWidth - margin - dueDateTotalWidth, detailsY);

    // Draw value in black
    doc.setTextColor(textColor[0], textColor[1], textColor[2]);
    doc.text(dueDateValue, pageWidth - margin - dueDateValueWidth, detailsY);

    detailsY += 8; // spacing before custom fields

    // Custom Fields (Additional Information) in right column - RIGHT ALIGNED
    const visibleCustomFields = invoiceData.customFields?.filter(field => !field.hidden) || [];
    if (visibleCustomFields.length > 0) {
        visibleCustomFields.forEach((field) => {
            doc.setFontSize(10);
            const fieldLabel = `${field.key}: `;
            const fieldValue = field.value || '-';

            // Calculate total width to position correctly when right-aligned
            doc.setFont('helvetica', 'normal');
            const fieldLabelWidth = doc.getTextWidth(fieldLabel);
            const fieldValueWidth = doc.getTextWidth(fieldValue);
            const fieldTotalWidth = fieldLabelWidth + fieldValueWidth;

            // Draw label in purple
            doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
            doc.text(fieldLabel, pageWidth - margin - fieldTotalWidth, detailsY);

            // Draw value in black
            doc.setTextColor(textColor[0], textColor[1], textColor[2]);
            doc.text(fieldValue, pageWidth - margin - fieldValueWidth, detailsY);

            detailsY += 6; // spacing between fields
        });
    }

    // Set yPosition to the bottom of both columns
    yPosition = Math.max(toY, detailsY) + 15;

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

    // Column positions
    const col1X = tableStartX + 2; // Description
    const col2X = tableStartX + colWidths[0]; // Qty
    const col3X = tableStartX + colWidths[0] + colWidths[1]; // Rate
    const col4X = tableStartX + colWidths[0] + colWidths[1] + colWidths[2]; // Amount

    doc.text('Description', col1X, yPosition + 5.5);
    doc.text('Qty', col2X + colWidths[1] - 2, yPosition + 5.5, {align: 'right'});
    doc.text('Rate', col3X + colWidths[2] - 2, yPosition + 5.5, {align: 'right'});
    doc.text('Amount', col4X + colWidths[3] - 2, yPosition + 5.5, {align: 'right'});

    yPosition += 8;

    // Table rows
    doc.setFont('helvetica', 'normal');
    invoiceData.items.forEach((item, index) => {
        // Calculate dynamic row height based on description text wrapping
        const descriptionLines = doc.splitTextToSize(item.description, colWidths[0] - 4);
        const minRowHeight = 8;
        const lineHeight = 5;
        const rowHeight = Math.max(minRowHeight, descriptionLines.length * lineHeight + 4);

        // Alternate row background
        if (index % 2 === 1) {
            doc.setFillColor(250, 250, 250);
            doc.rect(tableStartX, yPosition, tableWidth, rowHeight, 'F');
        }

        // Description column (with text wrapping)
        doc.text(descriptionLines, col1X, yPosition + 5.5);

        // Qty column (right-aligned)
        doc.text(item.quantity.toString(), col2X + colWidths[1] - 2, yPosition + 5.5, {align: 'right'});

        // Rate column (right-aligned)
        doc.text(`${currencySymbol}${item.rate.toFixed(2)}`, col3X + colWidths[2] - 2, yPosition + 5.5, {align: 'right'});

        // Amount column (right-aligned)
        doc.text(`${currencySymbol}${item.amount.toFixed(2)}`, col4X + colWidths[3] - 2, yPosition + 5.5, {align: 'right'});

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

    // Add signature line
    yPosition += 15; // Reduced space before signature
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(textColor[0], textColor[1], textColor[2]);
    doc.text('Authorized Signature:', margin, yPosition);

    // Draw signature line
    const signatureLineY = yPosition + 15;
    const signatureLineWidth = 60; // 60mm wide line
    doc.setDrawColor(textColor[0], textColor[1], textColor[2]);
    doc.setLineWidth(0.5);
    doc.line(margin, signatureLineY, margin + signatureLineWidth, signatureLineY);

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
    const params: Record<string, string | number> = {page, limit};
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