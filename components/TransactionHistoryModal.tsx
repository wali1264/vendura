import React, { useState, useMemo } from 'react';
import type { Supplier, Customer, Employee, AnyTransaction, PayrollTransaction } from '../types';
import { XIcon, PrintIcon, EditIcon, TrashIcon } from './icons';
import { useAppContext } from '../AppContext';
import { formatCurrency, formatBalance, toEnglishDigits } from '../utils/formatters';
import DateRangeFilter from './DateRangeFilter';
import ReportPrintPreviewModal from './ReportPrintPreviewModal';
import JalaliDateInput from './JalaliDateInput';

interface TransactionHistoryModalProps {
    person: Supplier | Customer | Employee;
    transactions: AnyTransaction[];
    type: 'supplier' | 'customer' | 'employee';
    onClose: () => void;
    onReprint: (transactionId: string) => void;
}

const TransactionHistoryModal: React.FC<TransactionHistoryModalProps> = ({ person, transactions, type, onClose, onReprint }) => {
    const { storeSettings, updateCustomerTransaction, deleteCustomerTransaction, updateSupplierTransaction, deleteSupplierTransaction } = useAppContext();
    const [dateRange, setDateRange] = useState<{ start: Date, end: Date }>({ start: new Date(), end: new Date() });
    const [isPrintPreviewOpen, setIsPrintPreviewOpen] = useState(false);
    const [showGregorianDate, setShowGregorianDate] = useState(false);
    const [editingTransaction, setEditingTransaction] = useState<any>(null);
    const [editAmount, setEditAmount] = useState('');
    const [editDescription, setEditDescription] = useState('');
    const [editDate, setEditDate] = useState('');
    const [editCurrency, setEditCurrency] = useState<'AFN'|'USD'|'IRT'>('AFN');
    const [editRate, setEditRate] = useState('');
    const [editIsHistorical, setEditIsHistorical] = useState(false);

    // Safety check
    if (!person) return null;

    const filteredTransactions = useMemo(() => {
        if (!dateRange.start || !dateRange.end) return [];
        const startTime = dateRange.start.getTime();
        const endTime = dateRange.end.getTime();

        return transactions
            .filter(t => {
                const tTime = new Date(t.date).getTime();
                return tTime >= startTime && tTime <= endTime;
            })
            .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    }, [transactions, dateRange]);

    // Calculate separated balances for Suppliers and Customers
    const balances = useMemo(() => {
        if (type === 'employee') return null;
        
        let debtAFN = 0, paidAFN = 0;
        let debtUSD = 0, paidUSD = 0;
        let debtIRT = 0, paidIRT = 0;

        filteredTransactions.forEach(t => {
            const currency = (t as any).currency || 'AFN';
            if (type === 'supplier') {
                if (t.type === 'purchase' || t.type === 'receipt') {
                    if (currency === 'USD') debtUSD += t.amount; 
                    else if (currency === 'IRT') debtIRT += t.amount;
                    else debtAFN += t.amount;
                } else if (t.type === 'payment' || t.type === 'purchase_return') {
                    if (currency === 'USD') paidUSD += t.amount; 
                    else if (currency === 'IRT') paidIRT += t.amount;
                    else paidAFN += t.amount;
                }
            } else if (type === 'customer') {
                if (t.type === 'credit_sale' || t.type === 'receipt') {
                    if (currency === 'USD') debtUSD += t.amount; 
                    else if (currency === 'IRT') debtIRT += t.amount;
                    else debtAFN += t.amount;
                } else if (t.type === 'payment' || t.type === 'sale_return') {
                    if (currency === 'USD') paidUSD += t.amount; 
                    else if (currency === 'IRT') paidIRT += t.amount;
                    else paidAFN += t.amount;
                }
            }
        });

        return {
            afn: debtAFN - paidAFN,
            usd: debtUSD - paidUSD,
            irt: debtIRT - paidIRT
        };
    }, [filteredTransactions, type]);


    const handleEditClick = (t: any) => {
        setEditingTransaction(t);
        setEditAmount((t.amount ?? 0).toString());
        setEditDescription(t.description || '');
        setEditDate(t.date ? t.date.split('T')[0] : new Date().toISOString().split('T')[0]);
        setEditCurrency(t.currency || 'AFN');
        setEditRate(t.exchangeRate?.toString() || '');
        setEditIsHistorical(!!t.isHistorical);
    };

    const handleSaveEdit = async () => {
        if (!editingTransaction) return;
        const updatedTx = {
            ...editingTransaction,
            amount: Number(editAmount),
            description: editDescription,
            date: new Date(editDate).toISOString(),
            currency: editCurrency,
            exchangeRate: editCurrency === storeSettings.baseCurrency ? 1 : Number(editRate),
            isHistorical: editIsHistorical
        };

        if (type === 'customer') {
            await updateCustomerTransaction(updatedTx);
        } else if (type === 'supplier') {
            await updateSupplierTransaction(updatedTx);
        }
        setEditingTransaction(null);
    };

    const handleDeleteClick = async (t: any) => {
        if (!window.confirm('آیا از حذف این تراکنش اطمینان دارید؟ این عمل باعث تغییر در مانده حساب می‌شود.')) return;
        
        if (type === 'customer') {
            await deleteCustomerTransaction(t.id);
        } else if (type === 'supplier') {
            await deleteSupplierTransaction(t.id);
        }
    };

    const transactionTable = (
        <table className="min-w-full text-center responsive-table border-collapse">
            <thead className="bg-slate-100 sticky top-0 z-10 shadow-sm">
                <tr>
                    <th className="p-3 font-bold text-slate-700 border-b">تاریخ</th>
                    <th className="p-3 font-bold text-slate-700 border-b">شرح</th>
                    <th className="p-3 font-bold text-slate-700 border-b">بدهکار / برد</th>
                    <th className="p-3 font-bold text-slate-700 border-b">بستانکار / رسید</th>
                    <th className="p-3 font-bold text-slate-700 border-b"></th>
                </tr>
            </thead>
            <tbody className="bg-white">
                {filteredTransactions.map(t => {
                    let debit = 0;
                    let credit = 0;
                    const currency = (t as any).currency || 'AFN';
                    if (type === 'supplier') {
                        // خرید یا دریافت وجه از او باعث بستانکار شدن تأمین‌کننده می‌شود (بدهی ما زیاد می‌شود)
                        if (t.type === 'purchase' || t.type === 'receipt') credit = t.amount;
                        // پرداخت به او یا برگشت از خرید باعث بدهکار شدن او می‌شود (بدهی ما کم می‌شود)
                        else if (t.type === 'payment' || t.type === 'purchase_return') debit = t.amount;
                    } else if (type === 'customer') {
                        // فروش به مشتری یا پرداخت وجه به او باعث بدهکار شدن او می‌شود
                        if (t.type === 'credit_sale' || t.type === 'receipt') debit = t.amount;
                        // دریافت وجه یا برگشت از فروش باعث بستانکار شدن او می‌شود
                        else if (t.type === 'payment' || t.type === 'sale_return') credit = t.amount;
                    } else if (type === 'employee') {
                        const payrollTx = t as PayrollTransaction;
                        if (payrollTx.type === 'advance' || payrollTx.type === 'salary_payment') debit = payrollTx.amount;
                    }

                    return (
                        <tr key={t.id} className="hover:bg-blue-50 transition-colors border-b last:border-0">
                            <td data-label="تاریخ" className="p-3 text-slate-600">
                                <div className="flex flex-col items-center leading-tight">
                                    {showGregorianDate && (
                                        <span className="text-[9px] text-slate-400 font-medium mb-0.5">
                                            {new Date(t.date).toLocaleDateString('en-US')}
                                        </span>
                                    )}
                                    <span className={showGregorianDate ? "mt-0.5" : ""}>
                                        {new Date(t.date).toLocaleDateString('fa-IR')}
                                    </span>
                                </div>
                            </td>
                            <td data-label="شرح" className="p-3 text-slate-800 font-semibold">
                                <div className="flex items-center gap-2">
                                    {t.description}
                                    {(t as any).isHistorical && (
                                        <span className="text-[9px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-md border border-amber-200 font-black">تاریخی</span>
                                    )}
                                </div>
                            </td>
                            <td data-label="بدهکار / برد" className="p-3 text-blue-600 font-bold text-xl" dir="ltr">{debit > 0 ? `${debit.toLocaleString('en-US')} ${storeSettings.currencyConfigs[currency as 'AFN'|'USD'|'IRT']?.name || currency}` : '-'}</td>
                            <td data-label="بستانکار / رسید" className="p-3 text-red-600 font-bold text-xl" dir="ltr">{credit > 0 ? `${credit.toLocaleString('en-US')} ${storeSettings.currencyConfigs[currency as 'AFN'|'USD'|'IRT']?.name || currency}` : '-'}</td>
                            <td className="p-3 actions-cell">
                                <div className="flex items-center gap-1 justify-center">
                                    {(t.type === 'payment' || t.type === 'receipt') && (
                                        <button onClick={() => onReprint(t.id)} className="p-2 rounded-full text-gray-500 hover:text-green-600 hover:bg-green-100 transition-colors" title="چاپ مجدد رسید">
                                            <PrintIcon className="w-5 h-5" />
                                        </button>
                                    )}
                                    {(t as any).isManual && (
                                        <>
                                            <button onClick={() => handleEditClick(t)} className="p-2 rounded-full text-blue-500 hover:text-blue-700 hover:bg-blue-100 transition-colors" title="ویرایش">
                                                <EditIcon className="w-5 h-5" />
                                            </button>
                                            <button onClick={() => handleDeleteClick(t)} className="p-2 rounded-full text-red-500 hover:text-red-700 hover:bg-red-100 transition-colors" title="حذف">
                                                <TrashIcon className="w-5 h-5" />
                                            </button>
                                        </>
                                    )}
                                </div>
                            </td>
                        </tr>
                    );
                })}
            </tbody>
        </table>
    );


    return (
        <>
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-start justify-center z-[110] p-0 md:p-4 md:pt-16 overflow-y-auto modal-animate">
                <div className="bg-white md:rounded-2xl shadow-2xl border border-gray-200 w-full h-full md:max-w-5xl md:h-[85vh] flex flex-col overflow-hidden">
                    {/* Header */}
                    <div className="flex flex-shrink-0 justify-between items-center p-5 border-b border-gray-200 bg-slate-50 sticky top-0 z-20">
                        <div className="flex flex-col gap-1">
                            <h2 className="text-xl md:text-2xl font-bold text-slate-800">صورت حساب: {person.name}</h2>
                            {type !== 'employee' && balances ? (
                                <div className="flex gap-2 md:gap-3 mt-1 flex-wrap">
                                    <div className="bg-white border px-3 py-1 rounded-xl shadow-sm flex flex-col items-center">
                                        <span className="text-[10px] font-black text-slate-400 block uppercase">افغانی</span>
                                        <span dir="ltr" className={`font-black ${balances.afn > 0 ? 'text-red-600' : (balances.afn < 0 ? 'text-green-600' : 'text-slate-400')}`}>{formatBalance(balances.afn)}</span>
                                        <span className="text-[8px] font-bold opacity-60">{balances.afn > 0 ? 'بدهکاریم' : (balances.afn < 0 ? 'طلبکاریم' : 'تسویه')}</span>
                                    </div>
                                    <div className="bg-white border px-3 py-1 rounded-xl shadow-sm flex flex-col items-center">
                                        <span className="text-[10px] font-black text-slate-400 block uppercase">دلار</span>
                                        <span dir="ltr" className={`font-black ${balances.usd > 0 ? 'text-red-600' : (balances.usd < 0 ? 'text-green-600' : 'text-slate-400')}`}>{formatBalance(balances.usd)}</span>
                                        <span className="text-[8px] font-bold opacity-60">{balances.usd > 0 ? 'بدهکاریم' : (balances.usd < 0 ? 'طلبکاریم' : 'تسویه')}</span>
                                    </div>
                                    <div className="bg-white border px-3 py-1 rounded-xl shadow-sm flex flex-col items-center">
                                        <span className="text-[10px] font-black text-slate-400 block uppercase">تومان</span>
                                        <span dir="ltr" className={`font-black ${balances.irt > 0 ? 'text-red-600' : (balances.irt < 0 ? 'text-green-600' : 'text-slate-400')}`}>{formatBalance(balances.irt)}</span>
                                        <span className="text-[8px] font-bold opacity-60">{balances.irt > 0 ? 'بدهکاریم' : (balances.irt < 0 ? 'طلبکاریم' : 'تسویه')}</span>
                                    </div>
                                </div>
                            ) : (
                                <p className="text-sm md:text-md text-slate-600 mt-1">
                                    موجودی نهایی: <span dir="ltr" className={`font-black text-base md:text-lg ${person.balance > 0 ? 'text-red-600' : 'text-emerald-600'}`}>{formatCurrency(Math.abs(person.balance), storeSettings)}</span>
                                </p>
                            )}
                        </div>
                        <div className="flex items-center gap-2">
                            <label className="flex items-center gap-2 cursor-pointer bg-white border border-slate-200 px-3 py-2 rounded-xl hover:bg-slate-50 transition-colors no-print">
                                <input 
                                    type="checkbox" 
                                    checked={showGregorianDate} 
                                    onChange={(e) => setShowGregorianDate(e.target.checked)}
                                    className="w-4 h-4 text-blue-600 rounded"
                                />
                                <span className="text-[10px] font-black text-slate-600">نمایش تاریخ میلادی</span>
                            </label>
                            <button onClick={() => setIsPrintPreviewOpen(true)} className="p-2.5 bg-blue-50 text-blue-600 border border-blue-100 rounded-xl hover:bg-blue-100 transition-colors" title="چاپ گزارش">
                                <PrintIcon className="w-6 h-6" /> 
                            </button>
                            <button onClick={onClose} className="p-2.5 rounded-xl bg-slate-100 text-slate-600 hover:bg-red-50 hover:text-red-600 transition-colors">
                                <XIcon className="w-6 h-6" />
                            </button>
                        </div>
                    </div>
                    
                    {/* Filters */}
                    <div className="flex-shrink-0 p-4 bg-white border-b border-gray-100">
                        <DateRangeFilter onFilterChange={(start, end) => setDateRange({ start, end })} />
                    </div>

                    {/* Table Content */}
                    <div className="flex-grow overflow-y-auto p-0 bg-slate-50">
                        <div className="bg-white shadow-sm min-h-full">
                            {transactionTable}
                            {filteredTransactions.length === 0 && (
                                <div className="flex flex-col items-center justify-center py-20 text-slate-400">
                                    <p className="text-lg font-bold">تراکنشی یافت نشد.</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
            
            {isPrintPreviewOpen && (
                <ReportPrintPreviewModal
                    title={`صورت حساب ${person.name}`}
                    dateRange={dateRange}
                    onClose={() => setIsPrintPreviewOpen(false)}
                >
                    {transactionTable}
                     <div className="mt-6 pt-4 border-t text-left font-bold text-xl">
                        {type !== 'employee' && balances ? (
                            <div className="flex flex-col gap-2">
                                <div>مانده {storeSettings.currencyConfigs['AFN']?.name || 'افغانی'}: <span dir="ltr" className={balances.afn > 0 ? 'text-red-600' : (balances.afn < 0 ? 'text-green-600' : '')}>{formatBalance(balances.afn)} {storeSettings.currencyConfigs['AFN']?.name || 'AFN'}</span> <span className="text-sm opacity-60">{balances.afn > 0 ? '(بدهکاریم)' : (balances.afn < 0 ? '(طلبکاریم)' : '(تسویه)')}</span></div>
                                <div>مانده {storeSettings.currencyConfigs['USD']?.name || 'دلار'}: <span dir="ltr" className={balances.usd > 0 ? 'text-red-600' : (balances.usd < 0 ? 'text-green-600' : '')}>{formatBalance(balances.usd)} {storeSettings.currencyConfigs['USD']?.name || '$'}</span> <span className="text-sm opacity-60">{balances.usd > 0 ? '(بدهکاریم)' : (balances.usd < 0 ? '(طلبکاریم)' : '(تسویه)')}</span></div>
                                <div>مانده {storeSettings.currencyConfigs['IRT']?.name || 'تومان'}: <span dir="ltr" className={balances.irt > 0 ? 'text-red-600' : (balances.irt < 0 ? 'text-green-600' : '')}>{formatBalance(balances.irt)} {storeSettings.currencyConfigs['IRT']?.name || 'IRT'}</span> <span className="text-sm opacity-60">{balances.irt > 0 ? '(بدهکاریم)' : (balances.irt < 0 ? '(طلبکاریم)' : '(تسویه)')}</span></div>
                            </div>
                        ) : (
                            <>موجودی نهایی: {formatCurrency(person.balance, storeSettings)}</>
                        )}
                    </div>
                </ReportPrintPreviewModal>
            )}

            {editingTransaction && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[150] p-4">
                    <div className="bg-white rounded-2xl shadow-2xl border border-gray-200 w-full max-w-md overflow-hidden">
                        <div className="flex justify-between items-center p-4 border-b border-slate-100 bg-slate-50">
                            <h2 className="text-lg font-bold text-slate-800">ویرایش تراکنش</h2>
                            <button onClick={() => setEditingTransaction(null)} className="p-1 rounded-full text-slate-500 hover:bg-red-100 hover:text-red-600 transition-colors"><XIcon className="w-6 h-6" /></button>
                        </div>
                        <div className="p-6 space-y-4">
                            <div className="space-y-1">
                                <label className="text-xs font-bold text-slate-500">تاریخ:</label>
                                <JalaliDateInput value={editDate} onChange={setEditDate} disableRestriction />
                            </div>
                            <div className="space-y-1">
                                <label className="text-xs font-bold text-slate-500">مبلغ ({editCurrency}):</label>
                                <input type="text" inputMode="decimal" value={editAmount} onChange={e => setEditAmount(toEnglishDigits(e.target.value).replace(/[^0-9.]/g, ''))} className="w-full p-3 border border-slate-200 rounded-xl font-bold text-lg" />
                            </div>
                            {editCurrency !== storeSettings.baseCurrency && (
                                <div className="space-y-1">
                                    <label className="text-xs font-bold text-slate-500">نرخ تبدیل:</label>
                                    <input type="text" inputMode="decimal" value={editRate} onChange={e => setEditRate(toEnglishDigits(e.target.value).replace(/[^0-9.]/g, ''))} className="w-full p-3 border border-slate-200 rounded-xl font-mono" />
                                </div>
                            )}
                            <div className="space-y-1">
                                <label className="text-xs font-bold text-slate-500">شرح:</label>
                                <textarea value={editDescription} onChange={e => setEditDescription(e.target.value)} className="w-full p-3 border border-slate-200 rounded-xl h-24 resize-none" />
                            </div>
                            
                            <div className="flex items-center gap-2 p-3 bg-amber-50 rounded-xl border border-amber-100">
                                <input 
                                    type="checkbox" 
                                    id="editIsHistorical" 
                                    checked={editIsHistorical} 
                                    onChange={(e) => setEditIsHistorical(e.target.checked)}
                                    className="w-5 h-5 text-amber-600 rounded"
                                />
                                <label htmlFor="editIsHistorical" className="text-sm font-bold text-amber-800 cursor-pointer">
                                    ثبت به عنوان داده‌های تاریخی (بدون تأثیر بر صندوق)
                                </label>
                            </div>

                            <button onClick={handleSaveEdit} className="w-full bg-blue-600 text-white p-4 rounded-xl font-black text-lg shadow-lg hover:bg-blue-700 transition-all">ذخیره تغییرات</button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};

export default TransactionHistoryModal;