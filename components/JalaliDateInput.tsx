
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
        const sixMonthsAgo = new Date();
        sixMonthsAgo.setMonth(now.getMonth() - 6);
        
        // Ensure day is valid for the month
        let maxDays = jm <= 6 ? 31 : 30;
        if (jm === 12) maxDays = 30; // Approximation for UI
        
        const safeDay = Math.min(Math.max(1, jd), maxDays);
        const safeMonth = Math.min(Math.max(1, jm), 12);
        const safeYear = Math.min(Math.max(1300, jy), 1500);

        let targetDate = jalaliToDate(safeYear, safeMonth, safeDay);
        
        // Enforce boundaries: No future, max 6 months past
        if (targetDate > now) targetDate = now;
        if (targetDate < sixMonthsAgo) targetDate = sixMonthsAgo;
        
        const finalJalali = getJalaliDate(targetDate);
        
        setDateParts(finalJalali);
        setYearInput(finalJalali.jy.toString());
        setDayInput(finalJalali.jd.toString());
        onChange(targetDate.toISOString().split('T')[0]);
    };

    const handleYearChange = (val: string) => {
        const clean = toEnglishDigits(val).replace(/[^0-9]/g, '');
        setYearInput(clean);
        if (clean.length === 4) {
            validateAndEmit(parseInt(clean, 10), dateParts.jm, dateParts.jd);
        }
    };

    const handleDayChange = (val: string) => {
        const clean = toEnglishDigits(val).replace(/[^0-9]/g, '');
        setDayInput(clean);
        const num = parseInt(clean, 10);
        if (!isNaN(num) && num > 0 && num <= 31) {
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

    return (
        <div className="flex flex-col gap-1 w-full">
            {label && <span className="text-[10px] font-bold text-slate-400 mr-1 mb-1">{label}</span>}
            <div className="flex items-center gap-1 dir-ltr" dir="ltr">
                {/* Year */}
                <input
                    type="text"
                    inputMode="numeric"
                    value={yearInput}
                    onChange={(e) => handleYearChange(e.target.value)}
                    onBlur={handleBlur}
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
                    className="w-10 p-2 border border-slate-200 rounded-lg text-center font-bold text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                    placeholder="روز"
                />
            </div>
        </div>
    );
};

export default JalaliDateInput;
