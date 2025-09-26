import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Customer } from '../../utils/interfaces';
import { fetchCustomers } from '../../services/freelanceService';
import styles from './CustomerDropdown.module.scss';

// Debounce hook
const useDebounce = (value: string, delay: number) => {
    const [debouncedValue, setDebouncedValue] = useState(value);

    useEffect(() => {
        const handler = setTimeout(() => {
            setDebouncedValue(value);
        }, delay);

        return () => {
            clearTimeout(handler);
        };
    }, [value, delay]);

    return debouncedValue;
};

interface CustomerDropdownProps {
    value: string;
    onChange: (customerId: string) => void;
    className?: string;
    disabled?: boolean;
}

const CustomerDropdown: React.FC<CustomerDropdownProps> = ({
    value,
    onChange,
    className = '',
    disabled = false
}) => {
    const [customers, setCustomers] = useState<Customer[]>([]);
    const [loading, setLoading] = useState(false);
    const [hasMore, setHasMore] = useState(true);
    const [page, setPage] = useState(1);
    const [searchTerm, setSearchTerm] = useState('');
    const [isOpen, setIsOpen] = useState(false);
    const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
    
    const dropdownRef = useRef<HTMLDivElement>(null);
    const listRef = useRef<HTMLDivElement>(null);
    const searchInputRef = useRef<HTMLInputElement>(null);
    const observer = useRef<IntersectionObserver | null>(null);

    const ITEMS_PER_PAGE = 20;
    const debouncedSearchTerm = useDebounce(searchTerm, 300);

    // Load initial customers
    useEffect(() => {
        loadCustomers(1, true);
    }, []);

    // Handle search with debounce
    useEffect(() => {
        if (debouncedSearchTerm !== searchTerm) return; // Only proceed if debounced value matches current search term
        
        // Reset pagination and load customers with search
        setPage(1);
        setHasMore(true);
        loadCustomers(1, true, debouncedSearchTerm);
    }, [debouncedSearchTerm]);

    // Update selected customer when value changes
    useEffect(() => {
        if (value) {
            const customer = customers.find(c => c.id === value);
            setSelectedCustomer(customer || null);
        } else {
            setSelectedCustomer(null);
        }
    }, [value, customers]);

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

    const loadCustomers = async (pageNum: number, reset = false, search = '') => {
        if (loading) return;

        try {
            setLoading(true);
            const response = await fetchCustomers(pageNum, ITEMS_PER_PAGE, search);
            
            if (reset) {
                setCustomers(response.customers);
            } else {
                setCustomers(prev => [...prev, ...response.customers]);
            }
            
            setHasMore(response.customers.length === ITEMS_PER_PAGE);
            setPage(pageNum);
        } catch (error) {
            console.error('Error loading customers:', error);
        } finally {
            setLoading(false);
        }
    };

    // Infinite scroll callback
    const lastCustomerElementRef = useCallback((node: HTMLDivElement | null) => {
        if (loading) return;
        if (observer.current) observer.current.disconnect();
        
        observer.current = new IntersectionObserver(entries => {
            if (entries[0].isIntersecting && hasMore) {
                loadCustomers(page + 1, false, debouncedSearchTerm);
            }
        });
        
        if (node) observer.current.observe(node);
    }, [loading, hasMore, page, debouncedSearchTerm]);

    const handleToggleDropdown = () => {
        if (disabled) return;
        setIsOpen(!isOpen);
        if (!isOpen) {
            // Focus search input when opening
            setTimeout(() => {
                searchInputRef.current?.focus();
            }, 100);
        }
    };

    const handleCustomerSelect = (customer: Customer) => {
        setSelectedCustomer(customer);
        onChange(customer.id);
        setIsOpen(false);
        setSearchTerm('');
    };

    const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setSearchTerm(e.target.value);
    };

    const clearSelection = () => {
        setSelectedCustomer(null);
        onChange('');
    };

    return (
        <div className={`${styles.customerDropdown} ${className}`} ref={dropdownRef}>
            <div 
                className={`${styles.dropdownTrigger} ${isOpen ? styles.open : ''} ${disabled ? styles.disabled : ''}`}
                onClick={handleToggleDropdown}
            >
                <div className={styles.selectedValue}>
                    {selectedCustomer ? (
                        <div className={styles.customerInfo}>
                            <span className={styles.customerName}>{selectedCustomer.name}</span>
                            {selectedCustomer.company && (
                                <span className={styles.customerCompany}>({selectedCustomer.company})</span>
                            )}
                        </div>
                    ) : (
                        <span className={styles.placeholder}>-- Select a customer to continue --</span>
                    )}
                </div>
                <div className={styles.dropdownActions}>
                    {selectedCustomer && (
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
                    <div className={styles.searchContainer}>
                        <input
                            ref={searchInputRef}
                            type="text"
                            className={styles.searchInput}
                            placeholder="Search customers..."
                            value={searchTerm}
                            onChange={handleSearchChange}
                        />
                    </div>
                    
                    <div className={styles.customersList} ref={listRef}>
                        {customers.length === 0 && !loading ? (
                            <div className={styles.noResults}>
                                {searchTerm.trim() ? 'No customers found matching your search' : 'No customers available'}
                            </div>
                        ) : (
                            customers.map((customer, index) => (
                                <div
                                    key={customer.id}
                                    className={`${styles.customerItem} ${customer.id === value ? styles.selected : ''}`}
                                    onClick={() => handleCustomerSelect(customer)}
                                    ref={index === customers.length - 1 ? lastCustomerElementRef : null}
                                >
                                    <div className={styles.customerInfo}>
                                        <div className={styles.customerName}>{customer.name}</div>
                                        {customer.company && (
                                            <div className={styles.customerCompany}>{customer.company}</div>
                                        )}
                                        <div className={styles.customerEmail}>{customer.email}</div>
                                    </div>
                                    {customer.defaultTemplate && (
                                        <div className={styles.templateIndicator} title="Has default template">
                                            📋
                                        </div>
                                    )}
                                </div>
                            ))
                        )}
                        
                        {loading && (
                            <div className={styles.loadingItem}>
                                <div className={styles.spinner}></div>
                                Loading more customers...
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default CustomerDropdown;