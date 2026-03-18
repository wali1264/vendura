import React, { useState, useMemo } from 'react';
import type { DepositHolder, DepositTransaction } from '../types';
import { XIcon, PrintIcon, EditIcon, CalendarIcon, SearchIcon } from './icons';

interface DepositHistoryModalProps {
    holder: DepositHolder;
    transactions: DepositTransaction[];
    onClose: () => void;
    onEdit?: (tx: DepositTransaction) => void;
}

const DepositHistoryModal: React.FC<DepositHistoryModalProps> = ({ holder, transactions, onClose, onEdit }) => {
    const [dateFilterType, setDateFilterType] = useState<'today' | 'all' | 'custom'>('today');
    const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
    const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);

    const filteredTransactions = useMemo(() => {
        let filtered = [...transactions];
        
        if (dateFilterType === 'today') {
            const today = new Date().toISOString().split('T')[0];
            filtered = filtered.filter(t => t.date.split('T')[0] === today);
        } else if (dateFilterType === 'custom') {
            filtered = filtered.filter(t => {
                const txDate = t.date.split('T')[0];
                return txDate >= startDate && txDate <= endDate;
            });
        }
        
        return filtered.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }, [transactions, dateFilterType, startDate, endDate]);

    const handlePrint = () => {
        window.print();
    };

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[150] p-0 md:p-4 modal-animate">
            <div className="bg-white w-full h-full md:max-w-5xl md:h-[90vh] md:rounded-3xl shadow-2xl flex flex-col overflow-hidden">
                {/* Header */}
                <div className="flex-shrink-0 p-6 bg-indigo-600 text-white flex justify-between items-center">
                    <div>
                        <h2 className="text-xl md:text-2xl font-black">صورت‌حساب امانی: {holder.name}</h2>
                        <p className="text-[10px] md:text-xs opacity-80 font-bold mt-1 uppercase tracking-widest">Security Deposit Ledger</p>
                    </div>
                    <div className="flex items-center gap-2">
                        <button onClick={handlePrint} className="p-2.5 bg-white/20 rounded-xl hover:bg-white/30 transition-colors no-print" title="چاپ صورت‌حساب">
                            <PrintIcon className="w-6 h-6" />
                        </button>
                        <button onClick={onClose} className="p-2.5 bg-white/20 rounded-xl hover:bg-red-500 transition-colors no-print">
                            <XIcon className="w-6 h-6" />
                        </button>
                    </div>
                </div>

                {/* Filters & Summary */}
                <div className="flex-shrink-0 bg-indigo-50 border-b border-indigo-100 no-print">
                    <div className="p-4 flex flex-col md:flex-row gap-4 items-center justify-between">
                        <div className="flex items-center gap-2 bg-white p-1 rounded-xl border border-indigo-100 shadow-sm">
                            <button 
                                onClick={() => setDateFilterType('today')}
                                className={`px-4 py-2 rounded-lg text-xs font-black transition-all ${dateFilterType === 'today' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:bg-slate-50'}`}
                            >امروز</button>
                            <button 
                                onClick={() => setDateFilterType('all')}
                                className={`px-4 py-2 rounded-lg text-xs font-black transition-all ${dateFilterType === 'all' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:bg-slate-50'}`}
                            >همه زمان‌ها</button>
                            <button 
                                onClick={() => setDateFilterType('custom')}
                                className={`px-4 py-2 rounded-lg text-xs font-black transition-all ${dateFilterType === 'custom' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:bg-slate-50'}`}
                            >سفارشی</button>
                        </div>

                        {dateFilterType === 'custom' && (
                            <div className="flex items-center gap-2 animate-in fade-in slide-in-from-top-1">
                                <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-xl border border-indigo-100">
                                    <span className="text-[10px] font-black text-slate-400">از:</span>
                                    <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="text-xs font-bold outline-none bg-transparent" />
                                </div>
                                <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-xl border border-indigo-100">
                                    <span className="text-[10px] font-black text-slate-400">تا:</span>
                                    <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="text-xs font-bold outline-none bg-transparent" />
                                </div>
                            </div>
                        )}

                        <div className="flex gap-2 md:gap-4">
                            <div className="bg-white px-4 py-2 rounded-xl border border-indigo-200 text-center shadow-sm min-w-[100px]">
                                <p className="text-[8px] font-black text-slate-400 mb-0.5">افغانی</p>
                                <p className="font-black text-indigo-700 text-sm" dir="ltr">{Math.round(holder.balanceAFN).toLocaleString()} AFN</p>
                            </div>
                            <div className="bg-white px-4 py-2 rounded-xl border border-indigo-200 text-center shadow-sm min-w-[100px]">
                                <p className="text-[8px] font-black text-slate-400 mb-0.5">دلار</p>
                                <p className="font-black text-indigo-700 text-sm" dir="ltr">{holder.balanceUSD.toLocaleString()} $</p>
                            </div>
                            <div className="bg-white px-4 py-2 rounded-xl border border-indigo-200 text-center shadow-sm min-w-[100px]">
                                <p className="text-[8px] font-black text-slate-400 mb-0.5">تومان</p>
                                <p className="font-black text-indigo-700 text-sm" dir="ltr">{holder.balanceIRT.toLocaleString()} IRT</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Ledger Content */}
                <div className="flex-grow overflow-y-auto p-4 md:p-6 bg-white printable-area">
                    <div className="hidden print:block text-center mb-8 border-b pb-4">
                        <h1 className="text-3xl font-black text-indigo-600 mb-2">گزارش امانات</h1>
                        <p className="text-lg font-bold text-slate-700">مشتری: {holder.name}</p>
                        <p className="text-sm text-slate-400 mt-1">تاریخ گزارش: {new Date().toLocaleDateString('fa-IR')}</p>
                    </div>
                    
                    <table className="min-w-full text-center border-collapse">
                        <thead>
                            <tr className="bg-slate-50 border-y border-slate-200">
                                <th className="p-3 font-black text-slate-500 text-sm">تاریخ</th>
                                <th className="p-3 font-black text-slate-500 text-sm">شرح تراکنش</th>
                                <th className="p-3 font-black text-slate-500 text-sm">واریز (+)</th>
                                <th className="p-3 font-black text-slate-500 text-sm">برداشت (-)</th>
                                <th className="p-3 font-black text-slate-500 text-sm">ارز</th>
                                <th className="p-3 font-black text-slate-500 text-sm no-print">عملیات</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredTransactions.map(t => (
                                <tr key={t.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors group">
                                    <td className="p-3 text-xs font-bold text-slate-400">
                                        {new Date(t.date).toLocaleDateString('fa-IR')}
                                        {t.isHistorical && <span className="block text-[8px] text-orange-400 font-black mt-0.5">(تاریخی)</span>}
                                    </td>
                                    <td className="p-3 text-sm font-semibold text-slate-700 text-right">{t.description || (t.type === 'deposit' ? 'واریز وجه امانی' : 'برداشت از امانت')}</td>
                                    <td className="p-3 font-black text-emerald-600" dir="ltr">{t.type === 'deposit' ? t.amount.toLocaleString() : '-'}</td>
                                    <td className="p-3 font-black text-orange-600" dir="ltr">{t.type === 'withdrawal' ? t.amount.toLocaleString() : '-'}</td>
                                    <td className="p-3 font-black text-indigo-800 text-xs">{t.currency}</td>
                                    <td className="p-3 no-print">
                                        {t.isManual && onEdit && (
                                            <button 
                                                onClick={() => {
                                                    onClose();
                                                    onEdit(t);
                                                }}
                                                className="p-1.5 text-slate-300 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                                                title="ویرایش تراکنش دستی"
                                            >
                                                <EditIcon className="w-4 h-4" />
                                            </button>
                                        )}
                                    </td>
                                </tr>
                            ))}
                            {filteredTransactions.length === 0 && (
                                <tr><td colSpan={6} className="p-10 text-slate-300 font-bold">هیچ تراکنشی در این بازه زمانی یافت نشد.</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Print Footer */}
                <div className="hidden print:block p-6 border-t mt-auto text-xs text-slate-400 italic">
                    این گزارش صرفاً جهت اطلاع از وضعیت امانات صادر شده و فاقد ارزش معاملاتی دیگر است.
                </div>
            </div>
        </div>
    );
};

export default DepositHistoryModal;
