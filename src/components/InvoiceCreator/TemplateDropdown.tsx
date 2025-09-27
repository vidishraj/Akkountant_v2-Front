import React, { useState, useRef, useEffect } from 'react';
import { InvoiceTemplate } from '../../utils/interfaces';
import styles from './CustomerDropdown.module.scss'; // Reuse the same styles

interface TemplateDropdownProps {
    value: string;
    onChange: (templateId: string) => void;
    templates: InvoiceTemplate[];
    className?: string;
    disabled?: boolean;
    placeholder?: string;
}

const TemplateDropdown: React.FC<TemplateDropdownProps> = ({
    value,
    onChange,
    templates,
    className = '',
    disabled = false,
    placeholder = "Select a template..."
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const [selectedTemplate, setSelectedTemplate] = useState<InvoiceTemplate | null>(null);
    
    const dropdownRef = useRef<HTMLDivElement>(null);

    // Update selected template when value changes
    useEffect(() => {
        if (value) {
            const template = templates.find(t => t.id === value);
            setSelectedTemplate(template || null);
        } else {
            setSelectedTemplate(null);
        }
    }, [value, templates]);

    // Handle clicks outside dropdown
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };

        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isOpen]);

    const handleToggleDropdown = () => {
        if (disabled) return;
        setIsOpen(!isOpen);
    };

    const handleTemplateSelect = (template: InvoiceTemplate) => {
        setSelectedTemplate(template);
        onChange(template.id);
        setIsOpen(false);
    };

    const clearSelection = () => {
        setSelectedTemplate(null);
        onChange('');
    };

    const formatTemplateName = (template: InvoiceTemplate) => {
        const displayName = template.name.length > 30 
            ? `${template.name.substring(0, 30)}...` 
            : template.name;
        return `${displayName}${template.customerId ? ' (CT)' : ''}`;
    };

    const getTemplateTitle = (template: InvoiceTemplate) => {
        return `${template.name}${template.customerId ? ' (Customer Template)' : ''} - ${new Date(template.createdAt).toLocaleDateString()}`;
    };

    return (
        <div className={`${styles.customerDropdown} ${className}`} ref={dropdownRef}>
            <div 
                className={`${styles.dropdownTrigger} ${isOpen ? styles.open : ''} ${disabled ? styles.disabled : ''}`}
                onClick={handleToggleDropdown}
                tabIndex={disabled ? -1 : 0}
                onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        handleToggleDropdown();
                    }
                }}
            >
                <div className={styles.selectedValue}>
                    {selectedTemplate ? (
                        <div className={styles.customerInfo}>
                            <span className={styles.customerName}>{formatTemplateName(selectedTemplate)}</span>
                        </div>
                    ) : (
                        <span className={styles.placeholder}>{placeholder}</span>
                    )}
                </div>
                <div className={styles.dropdownActions}>
                    {selectedTemplate && (
                        <button
                            type="button"
                            className={styles.clearButton}
                            onClick={(e) => {
                                e.stopPropagation();
                                clearSelection();
                            }}
                            disabled={disabled}
                        >
                            ×
                        </button>
                    )}
                    <div className={`${styles.dropdownArrow} ${isOpen ? styles.rotated : ''}`}>
                        ▼
                    </div>
                </div>
            </div>

            {isOpen && (
                <div className={styles.dropdownMenu}>
                    <div className={styles.customersList}>
                        {templates.length === 0 ? (
                            <div className={styles.noResults}>
                                No templates available
                            </div>
                        ) : (
                            templates.map((template) => (
                                <div
                                    key={template.id}
                                    className={`${styles.customerItem} ${template.id === value ? styles.selected : ''}`}
                                    onClick={() => handleTemplateSelect(template)}
                                    title={getTemplateTitle(template)}
                                >
                                    <div className={styles.customerInfo}>
                                        <div className={styles.customerName}>{template.name}</div>
                                        <div className={styles.customerEmail}>
                                            {template.customerId ? '🔗 Customer Template' : '📄 General Template'}
                                        </div>
                                        <div className={styles.customerCompany}>
                                            Created: {new Date(template.createdAt).toLocaleDateString()}
                                        </div>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default TemplateDropdown;