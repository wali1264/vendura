
import React, { useState, useEffect } from 'react';
import { getJalaliDate, jalaliToDate, JALALI_MONTHS } from '../utils/jalali';

type FilterType = 'today' | 'yesterday' | 'custom';

interface DateRangeFilterProps {
    onFilterChange: (startDate: Date, endDate: Date) => void;
}

const DateRangeFilter: React.FC<DateRangeFilterProps> = ({ onFilterChange }) => {
    const [filterType, setFilterType] = useState<FilterType>('today');
    
    const currentJalaliDate = getJalaliDate(new Date());
    const currentJalaliYear = currentJalaliDate.jy;

    const [startDate, setStartDate] = useState({ day: 1, month: 1, year: currentJalaliYear });
    const [endDate, setEndDate] = useState({ day: currentJalaliDate.jd, month: currentJalaliDate.jm, year: currentJalaliYear });

    useEffect(() => {
        const now = new Date();
        let start = new Date();
        let end = new Date();

        switch (filterType) {
            case 'today':
                start.setHours(0, 0, 0, 0);
                end.setHours(23, 59, 59, 999);
                break;
            case 'yesterday':
                start.setDate(start.getDate() - 1);
                start.setHours(0, 0, 0, 0);
                end.setDate(end.getDate() - 1);
                end.setHours(23, 59, 59, 999);
                break;
            case 'custom':
                start = jalaliToDate(startDate.year, startDate.month, startDate.day);
                start.setHours(0, 0, 0, 0);
                end = jalaliToDate(endDate.year, endDate.month, endDate.day);
                end.setHours(23, 59, 59, 999);
                break;
        }
        onFilterChange(start, end);
    }, [filterType, startDate, endDate, onFilterChange]);

    const handleFilterClick = (type: FilterType) => {
        setFilterType(type);
    };

    return (
        <div className="flex flex-col sm:flex-row items-center gap-4">
            <div className="flex items-center gap-2 p-1 bg-slate-100/70 rounded-lg">
                <button onClick={() => handleFilterClick('today')} className={`px-3 py-1.5 rounded-md text-sm font-semibold ${filterType === 'today' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-600'}`}>امروز</button>
                <button onClick={() => handleFilterClick('yesterday')} className={`px-3 py-1.5 rounded-md text-sm font-semibold ${filterType === 'yesterday' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-600'}`}>دیروز</button>
                <button onClick={() => handleFilterClick('custom')} className={`px-3 py-1.5 rounded-md text-sm font-semibold ${filterType === 'custom' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-600'}`}>بازه سفارشی</button>
            </div>
            {filterType === 'custom' && (
                <div className="flex flex-wrap items-center gap-2 text-sm">
                    <span className="font-semibold">از:</span>
                    <input
                        type="number"
                        value={startDate.day}
                        onChange={e => setStartDate(p => ({ ...p, day: parseInt(e.target.value, 10) || 1 }))}
                        className="w-14 p-2 border rounded-md"
                        min="1" max="31"
                        placeholder="روز"
                    />
                    <select
                        value={startDate.month}
                        onChange={e => setStartDate(p => ({ ...p, month: parseInt(e.target.value, 10) }))}
                        className="p-2 border rounded-md bg-white"
                    >
                        {JALALI_MONTHS.map(m => <option key={m.value} value={m.value}>{m.name}</option>)}
                    </select>
                    <input
                        type="number"
                        value={startDate.year}
                        onChange={e => setStartDate(p => ({ ...p, year: parseInt(e.target.value, 10) || currentJalaliYear }))}
                        className="w-20 p-2 border rounded-md"
                        placeholder="سال"
                    />
                    
                    <span className="font-semibold mx-1">تا:</span>
                    <input
                        type="number"
                        value={endDate.day}
                        onChange={e => setEndDate(p => ({ ...p, day: parseInt(e.target.value, 10) || 1 }))}
                        className="w-14 p-2 border rounded-md"
                        min="1" max="31"
                        placeholder="روز"
                    />
                    <select
                        value={endDate.month}
                        onChange={e => setEndDate(p => ({ ...p, month: parseInt(e.target.value, 10) }))}
                        className="p-2 border rounded-md bg-white"
                    >
                        {JALALI_MONTHS.map(m => <option key={m.value} value={m.value}>{m.name}</option>)}
                    </select>
                    <input
                        type="number"
                        value={endDate.year}
                        onChange={e => setEndDate(p => ({ ...p, year: parseInt(e.target.value, 10) || currentJalaliYear }))}
                        className="w-20 p-2 border rounded-md"
                        placeholder="سال"
                    />
                </div>
            )}
        </div>
    );
};

export default DateRangeFilter;
