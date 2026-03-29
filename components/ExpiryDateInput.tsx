
import React, { useState, useEffect } from 'react';
import { toEnglishDigits } from '../utils/formatters';

interface ExpiryDateInputProps {
    value?: string; // ISO format YYYY-MM-DD
    onChange: (value: string) => void;
    label?: string;
    error?: string;
    disabled?: boolean;
    onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
    className?: string;
}

export const ExpiryDateInput: React.FC<ExpiryDateInputProps> = ({
    value,
    onChange,
    label,
    error,
    disabled,
    onKeyDown,
    className = ""
}) => {
    const [displayValue, setDisplayValue] = useState('');

    // Convert ISO YYYY-MM-DD to MM/YYYY for display
    useEffect(() => {
        if (value && value.includes('-')) {
            const [year, month] = value.split('-');
            setDisplayValue(`${month}/${year}`);
        } else if (!value) {
            setDisplayValue('');
        }
    }, [value]);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        let input = toEnglishDigits(e.target.value).replace(/\D/g, ''); // Remove non-digits
        
        if (input.length > 6) input = input.slice(0, 6); // Limit to MMYYYY

        let formatted = '';
        if (input.length > 0) {
            let month = input.slice(0, 2);
            
            // Validate month
            if (month.length === 2) {
                const m = parseInt(month);
                if (m < 1) month = '01';
                if (m > 12) month = '12';
            } else if (month.length === 1 && parseInt(month) > 1) {
                // If user types 2-9, auto-prefix with 0
                month = '0' + month;
            }

            formatted = month;
            if (input.length > 2 || (month.length === 2 && input.length === 2)) {
                formatted += '/' + input.slice(2);
            }
        }

        setDisplayValue(formatted);

        // If we have a full MM/YYYY (6 digits total in input)
        if (input.length === 6) {
            const monthNum = parseInt(input.slice(0, 2));
            const yearNum = parseInt(input.slice(2));
            
            if (monthNum >= 1 && monthNum <= 12 && yearNum > 2000) {
                // Calculate last day of the month
                const lastDay = new Date(yearNum, monthNum, 0).getDate();
                const isoDate = `${yearNum}-${String(monthNum).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
                onChange(isoDate);
            } else {
                onChange('');
            }
        } else {
            // Incomplete or empty input
            onChange('');
        }
    };

    return (
        <div className="w-full">
            {label && <label className="block text-xs font-bold text-slate-500 mb-2">{label}</label>}
            <div className="relative">
                <input
                    type="text"
                    inputMode="numeric"
                    placeholder="MM/YYYY (مثال: 12/2027)"
                    value={displayValue}
                    onChange={handleInputChange}
                    onKeyDown={onKeyDown}
                    disabled={disabled}
                    className={`w-full h-12 p-3 bg-white border ${error ? 'border-red-500 ring-2 ring-red-50' : 'border-slate-300'} rounded-lg shadow-sm focus:ring-4 focus:ring-blue-100 transition-all placeholder:text-slate-300 font-bold text-center ltr-input ${className}`}
                />
                {displayValue && displayValue.length < 7 && !error && (
                    <div className="absolute left-3 top-1/2 -translate-y-1/2 text-[10px] text-blue-400 font-bold animate-pulse">
                        تکمیل کنید...
                    </div>
                )}
            </div>
            {error && <p className="text-red-500 text-[10px] mt-1 font-bold">{error}</p>}
        </div>
    );
};
