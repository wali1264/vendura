
import React, { useState, useEffect } from 'react';
import { getJalaliDate, jalaliToDate, JALALI_MONTHS } from '../utils/jalali';
import { toEnglishDigits } from '../utils/formatters';

interface JalaliDateInputProps {
    value: string; // Gregorian ISO string (YYYY-MM-DD)
    onChange: (value: string) => void;
    label?: string;
}

const JalaliDateInput: React.FC<JalaliDateInputProps> = ({ value, onChange, label }) => {
    const [dateParts, setDateParts] = useState(() => {
        const d = value ? new Date(value) : new Date();
        return getJalaliDate(isNaN(d.getTime()) ? new Date() : d);
    });

    // Update internal state when external value changes
    useEffect(() => {
        const d = value ? new Date(value) : new Date();
        if (!isNaN(d.getTime())) {
            const jalali = getJalaliDate(d);
            setDateParts(prev => {
                if (prev.jy === jalali.jy && prev.jm === jalali.jm && prev.jd === jalali.jd) return prev;
                return jalali;
            });
        }
    }, [value]);

    const handleChange = (updates: Partial<{ jy: number; jm: number; jd: number }>) => {
        const newParts = { ...dateParts, ...updates };
        
        // Basic validation for days in month
        let maxDays = 31;
        if (newParts.jm > 6) maxDays = 30;
        if (newParts.jm === 12) {
            // Simple leap year check for Jalali (approximate or use existing logic if available)
            // For simplicity in this UI, we'll allow up to 30 and the converter handles the rest
            maxDays = 30; 
        }
        
        if (newParts.jd > maxDays) newParts.jd = maxDays;
        if (newParts.jd < 1) newParts.jd = 1;

        const gregorianDate = jalaliToDate(newParts.jy, newParts.jm, newParts.jd);
        const now = new Date();
        now.setHours(23, 59, 59, 999);

        if (gregorianDate > now) {
            // Prevent future dates
            return;
        }

        setDateParts(newParts);
        onChange(gregorianDate.toISOString().split('T')[0]);
    };

    return (
        <div className="flex flex-col gap-1 w-full">
            {label && <span className="text-[10px] font-bold text-slate-400 mr-1 mb-1">{label}</span>}
            <div className="flex items-center gap-1 dir-ltr" dir="ltr">
                {/* Year */}
                <input
                    type="text"
                    inputMode="numeric"
                    value={dateParts.jy}
                    onChange={(e) => {
                        const val = parseInt(toEnglishDigits(e.target.value), 10);
                        if (!isNaN(val)) handleChange({ jy: val });
                    }}
                    className="w-16 p-2 border border-slate-200 rounded-lg text-center font-bold text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                    placeholder="سال"
                />
                <span className="text-slate-300">/</span>
                {/* Month */}
                <select
                    value={dateParts.jm}
                    onChange={(e) => handleChange({ jm: parseInt(e.target.value, 10) })}
                    className="flex-grow p-2 border border-slate-200 rounded-lg text-center font-bold text-sm bg-white focus:ring-2 focus:ring-blue-500 outline-none appearance-none"
                >
                    {JALALI_MONTHS.map(m => (
                        <option key={m.value} value={m.value}>{m.name}</option>
                    ))}
                </select>
                <span className="text-slate-300">/</span>
                {/* Day */}
                <input
                    type="text"
                    inputMode="numeric"
                    value={dateParts.jd}
                    onChange={(e) => {
                        const val = parseInt(toEnglishDigits(e.target.value), 10);
                        if (!isNaN(val)) handleChange({ jd: val });
                    }}
                    className="w-10 p-2 border border-slate-200 rounded-lg text-center font-bold text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                    placeholder="روز"
                />
            </div>
        </div>
    );
};

export default JalaliDateInput;
