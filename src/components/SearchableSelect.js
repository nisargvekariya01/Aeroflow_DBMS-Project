'use client';
import { useState, useRef, useEffect } from 'react';

/**
 * SearchableSelect - A premium, searchable dropdown component.
 * @param {Array} options - Array of objects like { value: string|number, label: string, extra: object }
 * @param {string|number} value - Currently selected value
 * @param {Function} onChange - Callback when selection changes
 * @param {string} placeholder - Placeholder text
 * @param {Array} disabledOptions - Array of values to disable/grey out
 * @param {Function} renderOption - Optional custom render function for list items
 */
export default function SearchableSelect({ 
  options = [], 
  value = '', 
  onChange, 
  onSearch,
  placeholder = 'Select option...', 
  label,
  disabledOptions = [],
  isOptionDisabled,
  renderOption,
  isLoading = false,
  disabled = false,
  className = ''
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const dropdownRef = useRef(null);

  // Filter options based on search term
  // Search matches label or IATA code if available in extra
  const filteredOptions = options
    .filter(opt => {
      const labelMatch = opt.label.toLowerCase().includes(searchTerm.toLowerCase());
      const codeMatch = opt.extra?.code?.toLowerCase().includes(searchTerm.toLowerCase());
      return labelMatch || codeMatch;
    })
    .sort((a, b) => {
      // Logic to move available (non-disabled) items to the top
      const aDisabled = (disabledOptions.includes(Number(a.value)) || disabledOptions.includes(String(a.value))) || (isOptionDisabled ? isOptionDisabled(a) : false);
      const bDisabled = (disabledOptions.includes(Number(b.value)) || disabledOptions.includes(String(b.value))) || (isOptionDisabled ? isOptionDisabled(b) : false);
      
      if (!aDisabled && bDisabled) return -1;
      if (aDisabled && !bDisabled) return 1;
      return 0; // Maintain original order if both are same state
    });

  const selectedOption = options.find(opt => String(opt.value) === String(value));

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className={`form-group ${className}`} style={{ position: 'relative', marginBottom: 0 }} ref={dropdownRef}>
      <div 
        className={`select-input-container ${disabled ? 'disabled' : ''}`}
        style={{
          position: 'relative',
          background: disabled ? 'rgba(255, 255, 255, 0.02)' : 'rgba(255, 255, 255, 0.05)',
          border: '1px solid var(--glass-border)',
          borderRadius: '10px',
          padding: '0.75rem 1rem',
          cursor: disabled ? 'not-allowed' : 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          transition: 'all 0.2s',
          borderColor: isOpen ? 'var(--primary)' : 'var(--glass-border)',
          boxShadow: isOpen ? '0 0 10px rgba(10, 132, 255, 0.2)' : 'none',
          opacity: disabled ? 0.6 : 1,
        }}
        onClick={() => !disabled && setIsOpen(!isOpen)}
      >
        <div style={{ 
          color: selectedOption ? 'white' : 'var(--text-dim)', 
          flex: 1, 
          overflow: 'hidden', 
          textOverflow: 'ellipsis', 
          whiteSpace: 'nowrap',
          fontSize: '0.95rem'
        }}>
          {isLoading ? (
            <span style={{ fontStyle: 'italic', opacity: 0.7 }}>Loading data...</span>
          ) : (
            selectedOption ? (renderOption ? renderOption(selectedOption) : selectedOption.label) : placeholder
          )}
        </div>
        <span style={{ 
          color: 'var(--text-dim)', 
          fontSize: '0.7rem',
          marginLeft: '8px',
          transition: 'transform 0.2s', 
          transform: isOpen ? 'rotate(180deg)' : 'rotate(0)' 
        }}>▼</span>
      </div>

      {isOpen && (
        <div 
          className="dropdown-menu"
          style={{
            position: 'absolute',
            top: 'calc(100% + 8px)',
            left: 0,
            right: 0,
            background: 'rgba(15, 15, 15, 0.98)',
            backdropFilter: 'blur(25px)',
            border: '1px solid var(--glass-border)',
            borderRadius: '16px',
            boxShadow: '0 20px 40px rgba(0,0,0,0.6)',
            zIndex: 2000,
            maxHeight: '320px',
            display: 'flex',
            flexDirection: 'column',
            padding: '10px',
            animation: 'fadeIn 0.2s ease-out',
          }}
        >
          <div style={{ padding: '4px' }}>
            <input 
              type="text" 
              placeholder="Search..." 
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                if (onSearch) onSearch(e.target.value);
              }}
              onClick={(e) => e.stopPropagation()}
              style={{
                width: '100%',
                background: 'rgba(255, 255, 255, 0.08)',
                border: '1px solid var(--glass-border)',
                borderRadius: '8px',
                padding: '10px 14px',
                marginBottom: '10px',
                color: 'white',
                outline: 'none',
                fontSize: '0.9rem',
              }}
              autoFocus
            />
          </div>
          <ul style={{ 
            listStyle: 'none', 
            padding: 0, 
            margin: 0, 
            overflowY: 'auto',
            flex: 1
          }}>
            {filteredOptions.length > 0 ? (
              filteredOptions.map((opt) => {
                const isExplicitlyDisabled = disabledOptions.includes(Number(opt.value)) || disabledOptions.includes(String(opt.value));
                const isDisabled = isExplicitlyDisabled || (isOptionDisabled ? isOptionDisabled(opt) : false);
                const isSelected = String(value) === String(opt.value);
                return (
                  <li 
                    key={opt.value}
                    onClick={() => {
                      if (!isDisabled) {
                        onChange(opt.value);
                        setIsOpen(false);
                        setSearchTerm('');
                      }
                    }}
                    style={{
                      padding: '12px 14px',
                      borderRadius: '10px',
                      cursor: isDisabled ? 'not-allowed' : 'pointer',
                      background: isSelected ? 'rgba(10, 132, 255, 0.15)' : 'transparent',
                      color: isDisabled ? 'rgba(255, 255, 255, 0.2)' : (isSelected ? 'var(--primary)' : '#ffffff'),
                      marginBottom: '2px',
                      transition: 'all 0.2s',
                      fontSize: '0.9rem',
                      fontWeight: isDisabled ? 'normal' : '500', // Make available ones stand out slightly more
                      borderLeft: isSelected ? '3px solid var(--primary)' : '3px solid transparent',
                    }}
                    onMouseEnter={(e) => {
                      if (!isDisabled) {
                        e.currentTarget.style.background = isSelected ? 'rgba(10, 132, 255, 0.2)' : 'rgba(255, 255, 255, 0.05)';
                        if (!isSelected) e.currentTarget.style.transform = 'translateX(4px)';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!isDisabled) {
                        e.currentTarget.style.background = isSelected ? 'rgba(10, 132, 255, 0.15)' : 'transparent';
                        e.currentTarget.style.transform = 'translateX(0)';
                      }
                    }}
                  >
                    {renderOption ? renderOption(opt) : (
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span>{opt.label}</span>
                        {opt.extra?.code && (
                          <span style={{ 
                            fontSize: '0.75rem', 
                            background: 'rgba(255,255,255,0.1)', 
                            padding: '2px 6px', 
                            borderRadius: '4px',
                            color: 'var(--text-dim)'
                          }}>
                            {opt.extra.code}
                          </span>
                        )}
                      </div>
                    )}
                  </li>
                );
              })
            ) : (
              <li style={{ padding: '20px', color: 'var(--text-dim)', textAlign: 'center', fontSize: '0.9rem' }}>
                No results found
              </li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
