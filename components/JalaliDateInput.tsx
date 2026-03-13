
import React, { useState, useEffect, useMemo } from 'react';
import { getJalaliDate, jalaliToDate, JALALI_MONTHS } from '../utils/jalali';
import { toEnglishDigits } from '../utils/formatters';

interface JalaliDateInputProps {
    value: string; // Gregorian ISO string (YYYY-MM-DD)
    onChange: (value: string) => void;
    label?: string;
    disableRestriction?: boolean; // Kept for compatibility, but logic is now global for past
}

const JalaliDateInput: React.FC<JalaliDateInputProps> = ({ value, onChange, label, disableRestriction }) => {
    const [dateParts, setDateParts] = useState(() => {
        const d = value ? new Date(value) : new Date();
        return getJalaliDate(isNaN(d.getTime()) ? new Date() : d);
    });

    const [yearInput, setYearInput] = useState(dateParts.jy.toString());
    const [dayInput, setDayInput] = useState(dateParts.jd.toString());

    // Update internal state when external value changes
    useEffect(() => {
        const d = value ? new Date(value) : new Date();
        if (!isNaN(d.getTime())) {
            const jalali = getJalaliDate(d);
            setDateParts(prev => {
                if (prev.jy === jalali.jy && prev.jm === jalali.jm && prev.jd === jalali.jd) return prev;
                setYearInput(jalali.jy.toString());
                setDayInput(jalali.jd.toString());
                return jalali;
            });
        }
    }, [value]);

    const validateAndEmit = (jy: number, jm: number, jd: number) => {
        const now = new Date();
        
        // Ensure day is valid for the month
        let maxDays = jm <= 6 ? 31 : 30;
        if (jm === 12) maxDays = 30; // Approximation for UI
        
        const safeDay = Math.min(Math.max(1, jd), maxDays);
        const safeMonth = Math.min(Math.max(1, jm), 12);
        const safeYear = Math.min(Math.max(1300, jy), 1500);

        let targetDate = jalaliToDate(safeYear, safeMonth, safeDay);
        
        // Enforce boundaries: No future
        if (targetDate > now) targetDate = now;
        
        const finalJalali = getJalaliDate(targetDate);
        
        setDateParts(finalJalali);
        setYearInput(finalJalali.jy.toString());
        setDayInput(finalJalali.jd.toString());

        // Format manually to avoid timezone shifts (YYYY-MM-DD)
        const y = targetDate.getFullYear();
        const m = String(targetDate.getMonth() + 1).padStart(2, '0');
        const d = String(targetDate.getDate()).padStart(2, '0');
        onChange(`${y}-${m}-${d}`);
    };

    const handleYearChange = (val: string) => {
        const clean = toEnglishDigits(val).replace(/[^0-9]/g, '');
        setYearInput(clean);
        // Only auto-emit if we have a full valid year
        if (clean.length === 4) {
            const num = parseInt(clean, 10);
            if (num >= 1300 && num <= 1500) {
                validateAndEmit(num, dateParts.jm, dateParts.jd);
            }
        }
    };

    const handleDayChange = (val: string) => {
        const clean = toEnglishDigits(val).replace(/[^0-9]/g, '');
        setDayInput(clean);
        // Don't auto-emit immediately on every digit to avoid jumping
        // We will rely on Blur or full valid input
        const num = parseInt(clean, 10);
        if (clean.length === 2 && !isNaN(num) && num > 0 && num <= 31) {
            validateAndEmit(dateParts.jy, dateParts.jm, num);
        }
    };

    const handleMonthChange = (jm: number) => {
        validateAndEmit(dateParts.jy, jm, dateParts.jd);
    };

    const handleBlur = () => {
        validateAndEmit(
            parseInt(yearInput, 10) || dateParts.jy,
            dateParts.jm,
            parseInt(dayInput, 10) || dateParts.jd
        );
    };

    const handleKeyDown = (e: React.KeyboardEvent, type: 'year' | 'day') => {
        if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
            e.preventDefault();
            const step = e.key === 'ArrowUp' ? 1 : -1;
            if (type === 'year') {
                validateAndEmit(dateParts.jy + step, dateParts.jm, dateParts.jd);
            } else {
                validateAndEmit(dateParts.jy, dateParts.jm, dateParts.jd + step);
            }
        }
    };

    const isOldDate = useMemo(() => {
        const d = new Date(value);
        const oneYearAgo = new Date();
        oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
        return d < oneYearAgo;
    }, [value]);

    return (
        <div className="flex flex-col gap-1 w-full">
            <div className="flex justify-between items-center mr-1 mb-1">
                {label && <span className="text-[10px] font-bold text-slate-400">{label}</span>}
                {isOldDate && (
                    <span className="text-[9px] font-black text-orange-500 animate-pulse">
                        ⚠️ تاریخ قدیمی (بیش از ۱ سال)
                    </span>
                )}
            </div>
            <div className={`flex items-center gap-1 dir-ltr p-1 rounded-xl transition-colors ${isOldDate ? 'bg-orange-50 border border-orange-100' : ''}`} dir="ltr">
                {/* Year */}
                <input
                    type="text"
                    inputMode="numeric"
                    value={yearInput}
                    onChange={(e) => handleYearChange(e.target.value)}
                    onBlur={handleBlur}
                    onKeyDown={(e) => handleKeyDown(e, 'year')}
                    className="w-16 p-2 border border-slate-200 rounded-lg text-center font-bold text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                    placeholder="سال"
                />
                <span className="text-slate-300">/</span>
                {/* Month */}
                <select
                    value={dateParts.jm}
                    onChange={(e) => handleMonthChange(parseInt(e.target.value, 10))}
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
                    value={dayInput}
                    onChange={(e) => handleDayChange(e.target.value)}
                    onBlur={handleBlur}
                    onKeyDown={(e) => handleKeyDown(e, 'day')}
                    className="w-10 p-2 border border-slate-200 rounded-lg text-center font-bold text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                    placeholder="روز"
                />
            </div>
        </div>
    );
};

export default JalaliDateInput;
