
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useAppContext } from '../AppContext';
import type { Supplier, Employee, Customer, Expense, AnyTransaction, CustomerTransaction, SupplierTransaction, PayrollTransaction, DepositHolder, Partner } from '../types';
import { PlusIcon, XIcon, EyeIcon, TrashIcon, UserGroupIcon, AccountingIcon, TruckIcon, ChevronDownIcon, CheckIcon, EditIcon, FilterIcon, SettingsIcon, ArchiveBoxXMarkIcon, CheckCircleIcon, BuildingIcon, ZapIcon, HistoryIcon, PrintIcon } from '../components/icons';
import Toast from '../components/Toast';
import { formatCurrency, toEnglishDigits, formatBalance } from '../utils/formatters';
import TransactionHistoryModal from '../components/TransactionHistoryModal';
import ReceiptPreviewModal from '../components/ReceiptPreviewModal';
import JalaliDateInput from '../components/JalaliDateInput';
import { ActivitySettingsModal } from '../components/ActivitySettingsModal';

const Modal: React.FC<{ title: string, onClose: () => void, children: React.ReactNode, headerAction?: React.ReactNode }> = ({ title, onClose, children, headerAction }) => (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-start justify-center z-[100] p-4 pt-12 md:pt-20 overflow-y-auto modal-animate">
        <div className="bg-white rounded-2xl shadow-2xl border border-gray-200 w-full max-w-lg overflow-hidden my-0">
            <div className="flex justify-between items-center p-4 border-b border-slate-100 bg-slate-50 sticky top-0 z-10">
                <h2 className="text-xl font-bold text-slate-800">{title}</h2>
                <div className="flex items-center gap-2">
                    {headerAction}
                    <button onClick={onClose} className="p-1 rounded-full text-slate-500 hover:bg-red-100 hover:text-red-600 transition-colors"><XIcon className="w-6 h-6" /></button>
                </div>
            </div>
            <div className="p-6 bg-white">{children}</div>
        </div>
    </div>
);

const SuppliersTab = () => {
    const { suppliers, addSupplier, updateSupplier, deleteSupplier, addSupplierPayment, supplierTransactions, storeSettings, inTransitInvoices } = useAppContext();
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [isPayModalOpen, setIsPayModalOpen] = useState(false);
    const [transactionType, setTransactionType] = useState<'payment' | 'receipt'>('payment');
    const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);
    const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
    const [toast, setToast] = useState('');
    const [historyModalData, setHistoryModalData] = useState<{ person: Supplier, transactions: SupplierTransaction[] } | null>(null);
    const [receiptModalData, setReceiptModalData] = useState<{ person: Supplier, transaction: SupplierTransaction } | null>(null);
    
    const baseCurrency = storeSettings.baseCurrency || 'AFN';
    const baseCurrencyName = storeSettings.currencyConfigs[baseCurrency]?.name || 'AFN';

    const [addSupplierCurrency, setAddSupplierCurrency] = useState<'AFN' | 'USD' | 'IRT'>(baseCurrency);
    const [addSupplierRate, setAddSupplierRate] = useState('');
    const [addSupplierAmount, setAddSupplierAmount] = useState('');
    const [addSupplierDate, setAddSupplierDate] = useState(new Date().toISOString().split('T')[0]);
    const [addSupplierDescription, setAddSupplierDescription] = useState('');

    const [paymentCurrency, setPaymentCurrency] = useState<'AFN' | 'USD' | 'IRT'>(baseCurrency);
    const [exchangeRate, setExchangeRate] = useState('');
    const [paymentAmount, setPaymentAmount] = useState('');
    const [transactionDate, setTransactionDate] = useState(new Date().toISOString().split('T')[0]);
    const [isHistorical, setIsHistorical] = useState(false);

    const showToast = (message: string) => { setToast(message); setTimeout(() => setToast(''), 3000); };

    const logisticsCapital = useMemo(() => {
        return inTransitInvoices.filter(inv => inv.status !== 'closed').reduce((sum, inv) => {
            const rate = inv.exchangeRate || 1;
            const paidBase = (inv.paidAmount || 0) * rate;
            return sum + paidBase;
        }, 0);
    }, [inTransitInvoices]);

    const handleAddSupplierForm = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const formData = new FormData(e.currentTarget);
        const initialAmount = Number(addSupplierAmount);
        const initialType = formData.get('balanceType') as 'creditor' | 'debtor';
        if (addSupplierCurrency !== baseCurrency && initialAmount > 0 && (!addSupplierRate || Number(addSupplierRate) <= 0)) { showToast("لطفا نرخ ارز را وارد کنید."); return; }
        
        const supplierData = { 
            name: formData.get('name') as string, 
            contactPerson: formData.get('contactPerson') as string, 
            phone: formData.get('phone') as string, 
        };

        const initialBalance = { 
            amount: initialAmount, 
            type: initialType, 
            currency: addSupplierCurrency, 
            exchangeRate: addSupplierCurrency === baseCurrency ? 1 : Number(addSupplierRate),
            date: addSupplierDate,
            description: addSupplierDescription
        };

        if (editingSupplier) {
            const updatedSupplier = { 
                ...editingSupplier, 
                ...supplierData,
                initialBalance: initialType === 'creditor' ? initialAmount : -initialAmount,
                initialBalanceCurrency: addSupplierCurrency,
                initialBalanceExchangeRate: addSupplierCurrency === baseCurrency ? 1 : Number(addSupplierRate),
                initialBalanceDate: addSupplierDate,
                initialBalanceDescription: addSupplierDescription
            };
            await updateSupplier(updatedSupplier, initialBalance);
            showToast("اطلاعات تأمین‌کننده با موفقیت بروزرسانی شد.");
        } else {
            addSupplier(supplierData, initialBalance);
            showToast("تأمین‌کننده جدید با موفقیت ثبت شد.");
        }

        setAddSupplierCurrency(baseCurrency); 
        setAddSupplierRate(''); 
        setAddSupplierAmount(''); 
        setAddSupplierDate(new Date().toISOString().split('T')[0]); 
        setAddSupplierDescription(''); 
        setEditingSupplier(null);
        setIsAddModalOpen(false);
    };
    
    const handleDelete = (supplier: Supplier) => {
        if (Math.abs(supplier.balanceAFN) > 0 || Math.abs(supplier.balanceUSD) > 0 || Math.abs(supplier.balanceIRT) > 0) { showToast("حذف فقط برای حساب‌های با موجودی صفر امکان‌پذیر است."); return; }
        if (window.confirm(`آیا از حذف تأمین‌کننده "${supplier.name}" اطمینان دارید؟`)) deleteSupplier(supplier.id);
    };

    const handleOpenPayModal = (supplier: Supplier, type: 'payment' | 'receipt' = 'payment') => { 
        setSelectedSupplier(supplier); 
        setTransactionType(type);
        setPaymentCurrency(storeSettings.baseCurrency || 'AFN'); 
        setExchangeRate(''); 
        setPaymentAmount(''); 
        setTransactionDate(new Date().toISOString().split('T')[0]);
        setIsHistorical(false);
        setIsPayModalOpen(true); 
    };

    const handleAddPaymentForm = async (e: React.FormEvent<HTMLDivElement> | React.FormEvent<HTMLFormElement>) => {
        e.preventDefault(); if (!selectedSupplier) return;
        const formData = new FormData(e.currentTarget as HTMLFormElement);
        const amount = Number(paymentAmount);
        const description = formData.get('description') as string || (transactionType === 'payment' ? 'پرداخت وجه' : 'دریافت وجه');
        const customDate = formData.get('transactionDate') as string;
        if (!amount || amount <= 0) { showToast("مبلغ باید بزرگتر از صفر باشد."); return; }
        if (paymentCurrency !== baseCurrency && (!exchangeRate || Number(exchangeRate) <= 0)) { showToast("لطفاً نرخ ارز را وارد کنید."); return; }
        
        const newTransaction = await addSupplierPayment(selectedSupplier.id, amount, description, paymentCurrency, paymentCurrency === baseCurrency ? 1 : Number(exchangeRate), transactionType, customDate, isHistorical);
        
        if (newTransaction) { 
            setIsPayModalOpen(false); 
            setReceiptModalData({ person: selectedSupplier, transaction: newTransaction }); 
            setSelectedSupplier(null); 
        }
    };
    
    const handleViewHistory = (supplier: Supplier) => { const transactions = supplierTransactions.filter(t => t.supplierId === supplier.id); setHistoryModalData({ person: supplier, transactions }); };

    const convertedInitialBalance = useMemo(() => { 
        if (!addSupplierAmount || !addSupplierRate || Number(addSupplierRate) <= 0) return 0; 
        const config = storeSettings.currencyConfigs[addSupplierCurrency];
        return config.method === 'multiply' ? Number(addSupplierAmount) / Number(addSupplierRate) : Number(addSupplierAmount) * Number(addSupplierRate); 
    }, [addSupplierAmount, addSupplierRate, addSupplierCurrency, storeSettings.currencyConfigs]);

    const convertedPayment = useMemo(() => { 
        if (!paymentAmount || !exchangeRate || Number(exchangeRate) <= 0) return 0; 
        const config = storeSettings.currencyConfigs[paymentCurrency];
        return config.method === 'multiply' ? Number(paymentAmount) / Number(exchangeRate) : Number(paymentAmount) * Number(exchangeRate); 
    }, [paymentAmount, exchangeRate, paymentCurrency, storeSettings.currencyConfigs]);

    return (
        <div>
            {toast && <Toast message={toast} onClose={() => setToast('')} />}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
                <div className="bg-gradient-to-r from-blue-600 to-indigo-700 p-6 rounded-3xl text-white shadow-xl flex items-center justify-between">
                    <div>
                        <p className="text-xs font-black text-blue-100 uppercase tracking-widest mb-1 opacity-80">سرمایه در گردش لجستیک ({baseCurrency})</p>
                        <h4 className="text-2xl font-black drop-shadow-sm">{logisticsCapital.toLocaleString()}</h4>
                        <p className="text-[10px] text-blue-200 mt-1 font-bold">مجموع مبالغ پیش‌پرداخت کالاهای در راه</p>
                    </div>
                    <div className="p-4 bg-white/20 rounded-2xl backdrop-blur-md"><TruckIcon className="w-8 h-8" /></div>
                </div>
                <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex items-center justify-between">
                    <div>
                        <p className="text-xs font-black text-slate-400 uppercase mb-1">تعداد تأمین‌کنندگان فعال</p>
                        <h4 className="text-2xl font-black text-slate-800">{suppliers.length} مجموعه</h4>
                    </div>
                    <button onClick={() => setIsAddModalOpen(true)} className="bg-blue-600 text-white p-4 rounded-2xl hover:bg-blue-700 transition-all shadow-lg active:scale-95"><PlusIcon className="w-6 h-6"/></button>
                </div>
            </div>

            <div className="overflow-hidden rounded-2xl border border-gray-200/60 shadow-lg hidden md:block bg-white/40">
                 <table className="min-w-full text-center table-zebra">
                    <thead className="bg-slate-50/80 backdrop-blur-md sticky top-0 z-10">
                        <tr>
                            <th className="p-4 font-bold text-slate-700">نام</th>
                            <th className="p-4 font-bold text-slate-700">تلفن</th>
                            <th className="p-4 font-bold text-slate-700">موجودی حساب (بدهی ما)</th>
                            <th className="p-4 font-bold text-slate-700">عملیات</th>
                        </tr>
                    </thead>
                    <tbody>
                        {suppliers.map(s => (
                            <tr key={s.id} className="border-t border-gray-200/60 transition-colors hover:bg-blue-50/30">
                                <td className="p-4 text-lg font-semibold text-slate-800">{s.name}</td>
                                <td className="p-4 text-lg text-slate-600">{s.phone}</td>
                                <td className="p-4 text-md font-black" dir="ltr">
                                    <div className="flex flex-col gap-1 items-center">
                                        {[
                                            { val: s.balanceAFN || 0, name: storeSettings.currencyConfigs['AFN']?.name || 'افغانی' },
                                            { val: s.balanceUSD || 0, name: storeSettings.currencyConfigs['USD']?.symbol || '$' },
                                            { val: s.balanceIRT || 0, name: storeSettings.currencyConfigs['IRT']?.name || 'تومان' }
                                        ].map((item, idx) => (
                                            <div key={idx} className={`flex items-center gap-2 ${idx > 0 ? 'border-t border-slate-100 pt-0.5 w-full justify-center' : ''}`}>
                                                <span className={item.val > 0 ? 'text-red-600' : (item.val < 0 ? 'text-emerald-600' : 'text-slate-400')}>
                                                    {formatBalance(item.val)} {item.name}
                                                </span>
                                                <span className="text-[10px] font-bold opacity-60">
                                                    {item.val > 0 ? '(بدهکاریم / برد)' : (item.val < 0 ? '(طلبکاریم / رسید)' : '(تسویه)')}
                                                </span>
                                            </div>
                                        ))}
                                        {Math.abs(s.balanceAFN || 0) === 0 && Math.abs(s.balanceUSD || 0) === 0 && Math.abs(s.balanceIRT || 0) === 0 && (
                                            <span className="text-[10px] font-black text-emerald-600 mt-1">تسویه کامل</span>
                                        )}
                                    </div>
                                </td>
                                <td className="p-4">
                                    <div className="flex justify-center items-center gap-2">
                                        <button onClick={() => {
                                            setEditingSupplier(s);
                                            setAddSupplierAmount(Math.abs(s.initialBalance || 0).toString());
                                            setAddSupplierCurrency(s.initialBalanceCurrency || baseCurrency);
                                            setAddSupplierRate(s.initialBalanceExchangeRate?.toString() || '');
                                            setAddSupplierDate(s.initialBalanceDate || new Date().toISOString().split('T')[0]);
                                            setAddSupplierDescription(s.initialBalanceDescription || '');
                                            setIsAddModalOpen(true);
                                        }} className="p-2.5 rounded-xl text-blue-500 hover:text-blue-600 hover:bg-blue-100 transition-all" title="ویرایش اطلاعات"><EditIcon className="w-6 h-6"/></button>
                                        <button onClick={() => handleViewHistory(s)} className="p-2.5 rounded-xl text-slate-500 hover:text-blue-600 hover:bg-blue-100 transition-all" title="مشاهده صورت حساب"><EyeIcon className="w-6 h-6"/></button>
                                        <button onClick={() => handleDelete(s)} className={`p-2.5 rounded-xl transition-all ${(Math.abs(s.balanceAFN || 0) === 0 && Math.abs(s.balanceUSD || 0) === 0 && Math.abs(s.balanceIRT || 0) === 0) ? 'text-red-500 hover:bg-red-50 cursor-pointer' : 'text-slate-300 cursor-not-allowed'}`} disabled={Math.abs(s.balanceAFN || 0) > 0 || Math.abs(s.balanceUSD || 0) > 0 || Math.abs(s.balanceIRT || 0) > 0}><TrashIcon className="w-6 h-6" /></button>
                                        <div className="flex flex-col gap-1">
                                            <button onClick={() => handleOpenPayModal(s, 'payment')} className="bg-emerald-500 text-white px-4 py-1.5 rounded-xl text-xs font-bold shadow-md hover:shadow-emerald-200 transition-all active:scale-95">ثبت پرداخت / برد</button>
                                            <button onClick={() => handleOpenPayModal(s, 'receipt')} className="bg-blue-500 text-white px-4 py-1.5 rounded-xl text-xs font-bold shadow-md hover:shadow-blue-200 transition-all active:scale-95">ثبت دریافت / رسید</button>
                                        </div>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            <div className="md:hidden space-y-4">
                {suppliers.map(s => (
                    <div key={s.id} className="bg-white/80 backdrop-blur-xl p-5 rounded-2xl shadow-md border border-gray-200/60 active:scale-[0.98] transition-all">
                        <div className="flex justify-between items-start mb-1">
                           <div className="flex flex-col"><h3 className="font-black text-xl text-slate-800">{s.name}</h3><p className="text-xs text-slate-400 font-medium">{s.phone || 'بدون شماره'}</p></div>
                           <div className="flex gap-2"><button onClick={() => handleViewHistory(s)} className="p-2.5 bg-slate-100 rounded-xl text-slate-600 active:bg-blue-100"><EyeIcon className="w-5 h-5" /></button><button onClick={() => handleDelete(s)} className={`p-2.5 bg-slate-100 rounded-xl transition-colors ${(Math.abs(s.balanceAFN || 0) === 0 && Math.abs(s.balanceUSD || 0) === 0 && Math.abs(s.balanceIRT || 0) === 0) ? 'text-red-500' : 'text-slate-300'}`} disabled={Math.abs(s.balanceAFN || 0) > 0 || Math.abs(s.balanceUSD || 0) > 0 || Math.abs(s.balanceIRT || 0) > 0}><TrashIcon className="w-5 h-5" /></button></div>
                        </div>
                        <div className="mt-4 pt-4 border-t border-dashed border-slate-200 flex justify-between items-center">
                            <div className="text-right">
                                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-tighter">وضعیت حساب</p>
                                <div className="flex flex-col items-start font-black text-sm" dir="ltr">
                                    {[
                                        { val: s.balanceAFN || 0, name: storeSettings.currencyConfigs['AFN']?.name || 'افغانی' },
                                        { val: s.balanceUSD || 0, name: storeSettings.currencyConfigs['USD']?.symbol || '$' },
                                        { val: s.balanceIRT || 0, name: storeSettings.currencyConfigs['IRT']?.name || 'تومان' }
                                    ].map((item, idx) => (
                                        <div key={idx} className="flex items-center gap-2">
                                            <span className={item.val > 0 ? 'text-red-600' : (item.val < 0 ? 'text-emerald-600' : 'text-slate-400')}>
                                                {formatBalance(item.val)} {item.name}
                                            </span>
                                            <span className="text-[10px] font-bold opacity-60">
                                                {item.val > 0 ? '(بدهکاریم / برد)' : (item.val < 0 ? '(طلبکاریم / رسید)' : '(تسویه)')}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                            <div className="flex flex-col gap-2">
                                <button onClick={() => handleOpenPayModal(s, 'payment')} className="bg-emerald-500 text-white px-5 py-2 rounded-xl text-xs font-black shadow-lg active:shadow-none transition-all">ثبت پرداخت / برد</button>
                                <button onClick={() => handleOpenPayModal(s, 'receipt')} className="bg-blue-500 text-white px-5 py-2 rounded-xl text-xs font-black shadow-lg active:shadow-none transition-all">ثبت دریافت / رسید</button>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {isAddModalOpen && (
                <Modal title={editingSupplier ? "ویرایش تأمین‌کننده" : "افزودن تأمین‌کننده جدید"} onClose={() => { setIsAddModalOpen(false); setEditingSupplier(null); }}>
                    <form onSubmit={handleAddSupplierForm} className="space-y-4">
                        <input name="name" defaultValue={editingSupplier?.name} placeholder="نام تأمین‌کننده" className="w-full p-3.5 border border-slate-200 rounded-xl focus:ring-4 focus:ring-blue-50 outline-none transition-all" required/>
                        <input name="contactPerson" defaultValue={editingSupplier?.contactPerson} placeholder="فرد مسئول" className="w-full p-3.5 border border-slate-200 rounded-xl focus:ring-4 focus:ring-blue-50 outline-none transition-all" />
                        <input name="phone" defaultValue={editingSupplier?.phone} placeholder="شماره تلفن" className="w-full p-3.5 border border-slate-200 rounded-xl focus:ring-4 focus:ring-blue-50 outline-none transition-all" dir="ltr" />
                        <div className="p-4 bg-blue-50 rounded-2xl border border-blue-100 space-y-4">
                            <p className="text-sm font-black text-blue-800">تراز اول دوره (اختیاری)</p>
                            <div className="flex gap-4">
                                {['AFN', 'USD', 'IRT'].map(cur => (
                                    <label key={cur} className="flex items-center gap-2 cursor-pointer group">
                                        <input type="radio" checked={addSupplierCurrency === cur} onChange={() => {setAddSupplierCurrency(cur as any); setAddSupplierRate('');}} className="w-4 h-4 text-blue-600" /><span className="text-sm font-semibold text-slate-700">{storeSettings.currencyConfigs[cur as 'AFN'|'USD'|'IRT']?.name || cur}</span>
                                    </label>
                                ))}
                            </div>
                            {addSupplierCurrency !== baseCurrency && (
                                <div className="flex items-center gap-3">
                                    <span className="text-xs whitespace-nowrap font-bold text-slate-500">نرخ تبدیل ({baseCurrencyName} به {addSupplierCurrency}):</span>
                                    <input type="text" inputMode="decimal" value={addSupplierRate} onChange={e => setAddSupplierRate(toEnglishDigits(e.target.value).replace(/[^0-9.]/g, ''))} placeholder="نرخ" className="w-full p-2.5 border border-slate-200 rounded-xl font-mono text-center outline-none" />
                                </div>
                            )}
                            <div className="flex gap-2">
                                <input name="initialBalance" type="text" inputMode="decimal" value={addSupplierAmount} onChange={e => setAddSupplierAmount(toEnglishDigits(e.target.value).replace(/[^0-9.]/g, ''))} placeholder="مبلغ" className="w-2/3 p-2.5 border border-slate-200 rounded-xl outline-none" />
                                <select name="balanceType" defaultValue={editingSupplier ? (editingSupplier.initialBalance && editingSupplier.initialBalance > 0 ? 'creditor' : 'debtor') : 'creditor'} className="w-1/3 p-2.5 border border-slate-200 rounded-xl bg-white text-xs font-bold">
                                    <option value="creditor">ما بدهکاریم / برد</option>
                                    <option value="debtor">او بدهکار است / رسید</option>
                                </select>
                            </div>
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-slate-500">تاریخ تراز:</label>
                                <JalaliDateInput value={addSupplierDate} onChange={setAddSupplierDate} disableRestriction />
                            </div>
                            <textarea value={addSupplierDescription} onChange={e => setAddSupplierDescription(e.target.value)} placeholder="توضیحات تراز (مثلاً: بابت فاکتورهای سال قبل)" className="w-full p-3 border border-slate-200 rounded-xl text-sm h-20 resize-none" />
                            {addSupplierCurrency !== baseCurrency && convertedInitialBalance > 0 && <p className="text-[10px] font-black text-blue-600 text-left">معادل تقریبی: {convertedInitialBalance < 1 ? convertedInitialBalance.toFixed(4) : convertedInitialBalance.toLocaleString(undefined, { maximumFractionDigits: 2 })} {baseCurrencyName}</p>}
                        </div>
                        <button type="submit" className="w-full bg-blue-600 text-white p-4 rounded-xl shadow-xl hover:bg-blue-700 transition-all font-black text-lg">{editingSupplier ? 'بروزرسانی اطلاعات' : 'ذخیره نهایی'}</button>
                    </form>
                </Modal>
            )}

            {isPayModalOpen && selectedSupplier && (
                 <Modal title={`${transactionType === 'payment' ? 'ثبت پرداخت / برد' : 'ثبت دریافت / رسید'}: ${selectedSupplier.name}`} onClose={() => setIsPayModalOpen(false)}>
                    <form onSubmit={handleAddPaymentForm} className="space-y-4">
                        <div className="flex gap-4 p-3 bg-blue-50 rounded-xl">
                            {['AFN', 'USD', 'IRT'].map(c => (
                                <label key={c} className="flex items-center gap-2 cursor-pointer">
                                    <input type="radio" checked={paymentCurrency === c} onChange={() => {setPaymentCurrency(c as any); setExchangeRate('');}} className="text-blue-600" /><span className="text-xs font-bold">{storeSettings.currencyConfigs[c as 'AFN'|'USD'|'IRT']?.name || c}</span>
                                </label>
                            ))}
                        </div>
                        {paymentCurrency !== baseCurrency && (
                            <div className="flex items-center gap-3">
                                <span className="text-xs whitespace-nowrap font-bold text-slate-400">نرخ تبدیل ({baseCurrencyName} به {paymentCurrency}):</span>
                                <input type="text" inputMode="decimal" value={exchangeRate} onChange={e => setExchangeRate(toEnglishDigits(e.target.value).replace(/[^0-9.]/g, ''))} placeholder="نرخ" className="w-full p-2.5 border border-slate-200 rounded-xl font-mono text-center" />
                            </div>
                        )}
                        <div className="flex items-center gap-3">
                            <span className="text-xs whitespace-nowrap font-bold text-slate-400">تاریخ تراکنش:</span>
                            <JalaliDateInput value={transactionDate} onChange={setTransactionDate} disableRestriction />
                            <input type="hidden" name="transactionDate" value={transactionDate} />
                        </div>
                        <input name="amount" type="text" inputMode="decimal" value={paymentAmount} onChange={e => setPaymentAmount(toEnglishDigits(e.target.value).replace(/[^0-9.]/g, ''))} placeholder={`مبلغ (${paymentCurrency})`} className="w-full p-4 border border-slate-200 rounded-xl font-bold text-center text-xl" required />
                        {paymentCurrency !== baseCurrency && convertedPayment > 0 && <p className="text-[10px] font-black text-emerald-600 text-left">معادل از حساب کل: {convertedPayment < 1 ? convertedPayment.toFixed(4) : convertedPayment.toLocaleString(undefined, { maximumFractionDigits: 2 })} {baseCurrencyName}</p>}
                        <input name="description" placeholder="توضیحات (اختیاری)" className="w-full p-4 border border-slate-200 rounded-xl" />
                        
                        <div className="flex items-center gap-2 p-3 bg-amber-50 rounded-xl border border-amber-100">
                            <input 
                                type="checkbox" 
                                id="isHistoricalSupplier" 
                                checked={isHistorical} 
                                onChange={(e) => setIsHistorical(e.target.checked)}
                                className="w-5 h-5 text-amber-600 rounded"
                            />
                            <label htmlFor="isHistoricalSupplier" className="text-sm font-bold text-amber-800 cursor-pointer">
                                ثبت به عنوان داده‌های تاریخی (بدون تأثیر بر صندوق)
                            </label>
                        </div>

                        <button type="submit" className={`w-full ${transactionType === 'payment' ? 'bg-emerald-600' : 'bg-blue-600'} text-white p-4 rounded-xl shadow-xl font-black text-lg active:scale-[0.98]`}>ثبت و چاپ رسید</button>
                    </form>
                </Modal>
            )}
            {historyModalData && <TransactionHistoryModal person={historyModalData.person} transactions={historyModalData.transactions} type="supplier" onClose={() => setHistoryModalData(null)} onReprint={(tid) => { const tx = supplierTransactions.find(t=>t.id===tid); if(tx) { setHistoryModalData(null); setReceiptModalData({person: historyModalData.person, transaction: tx}); } }} />}
            {receiptModalData && <ReceiptPreviewModal person={receiptModalData.person} transaction={receiptModalData.transaction} type="supplier" onClose={() => setReceiptModalData(null)} />}
        </div>
    );
};

const PayrollTab = () => {
    const { employees, addEmployee, updateEmployee, deleteEmployee, toggleEmployeeActive, addEmployeeAdvance, payrollTransactions, processAndPaySalaries, storeSettings } = useAppContext();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
    const [showInactive, setShowInactive] = useState(false);
    const [toast, setToast] = useState('');
    const [historyModalData, setHistoryModalData] = useState<{ person: Employee, transactions: PayrollTransaction[] } | null>(null);

    const showToast = (message: string) => { setToast(message); setTimeout(() => setToast(''), 3000); };
    
    const handleAddEmployeeForm = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const formData = new FormData(e.currentTarget);
        const basic = Number(toEnglishDigits(formData.get('basicSalary') as string).replace(/[^0-9.]/g, ''));
        const benefits = Number(toEnglishDigits(formData.get('otherBenefits') as string).replace(/[^0-9.]/g, ''));
        const currency = formData.get('salaryCurrency') as 'AFN' | 'USD' | 'IRT';
        
        addEmployee({
            name: formData.get('name') as string,
            position: formData.get('position') as string,
            basicSalary: basic,
            otherBenefits: benefits,
            monthlySalary: basic + benefits,
            salaryCurrency: currency,
            isActive: true
        });
        setIsModalOpen(false);
    };

    const handleEditEmployeeForm = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (!selectedEmployee) return;
        const formData = new FormData(e.currentTarget);
        const basic = Number(toEnglishDigits(formData.get('basicSalary') as string).replace(/[^0-9.]/g, ''));
        const benefits = Number(toEnglishDigits(formData.get('otherBenefits') as string).replace(/[^0-9.]/g, ''));
        const currency = formData.get('salaryCurrency') as 'AFN' | 'USD' | 'IRT';
        
        updateEmployee({
            ...selectedEmployee,
            name: formData.get('name') as string,
            position: formData.get('position') as string,
            basicSalary: basic,
            otherBenefits: benefits,
            monthlySalary: basic + benefits,
            salaryCurrency: currency
        });
        setIsEditModalOpen(false);
        setSelectedEmployee(null);
    };
    
    const [advanceCurrency, setAdvanceCurrency] = useState<'AFN' | 'USD' | 'IRT'>(storeSettings.baseCurrency);
    const [advanceRate, setAdvanceRate] = useState('');
    const [advanceAmount, setAdvanceAmount] = useState('');
    const [transactionDate, setTransactionDate] = useState(new Date().toISOString().split('T')[0]);

    const filteredEmployees = useMemo(() => {
        return employees.filter(e => e.isActive !== showInactive);
    }, [employees, showInactive]);

    const convertedAdvance = useMemo(() => {
        if (!advanceAmount || !advanceRate || Number(advanceRate) <= 0) return 0;
        const config = storeSettings.currencyConfigs[advanceCurrency];
        return config.method === 'multiply' ? Number(advanceAmount) / Number(advanceRate) : Number(advanceAmount) * Number(advanceRate);
    }, [advanceAmount, advanceRate, advanceCurrency, storeSettings.currencyConfigs]);

    const handleAddAdvanceForm = (ev: React.FormEvent<HTMLFormElement>, employeeId: string) => {
        ev.preventDefault();
        const formData = new FormData(ev.currentTarget);
        const amount = Number(toEnglishDigits(advanceAmount).replace(/[^0-9.]/g, ''));
        const description = formData.get('description') as string || 'مساعده';
        
        if (!amount || amount <= 0) return;
        
        if (advanceCurrency !== storeSettings.baseCurrency && (!advanceRate || Number(advanceRate) <= 0)) {
            showToast("لطفا نرخ ارز را وارد کنید.");
            return;
        }

        const customDate = formData.get('transactionDate') as string;
        addEmployeeAdvance(employeeId, amount, description, advanceCurrency, advanceCurrency === storeSettings.baseCurrency ? 1 : Number(advanceRate), customDate);
        (ev.target as HTMLFormElement).reset();
        setAdvanceRate('');
        setAdvanceAmount('');
        setTransactionDate(new Date().toISOString().split('T')[0]);
        showToast("تراکنش با موفقیت ثبت شد.");
    };

    const handleProcessSalaries = () => {
        if (window.confirm("آیا از پردازش و افزودن حقوق ماهانه تمام کارمندان فعال اطمینان دارید؟")) {
            const result = processAndPaySalaries();
            showToast(result.message);
        }
    };
    
    const handleViewHistory = (employee: Employee) => {
        const transactions = payrollTransactions.filter(t => t.employeeId === employee.id);
        setHistoryModalData({ person: employee, transactions });
    };

    const handleDeleteEmployee = (e: Employee) => {
        if (Math.abs(e.balance) > 0.01) {
            showToast("حذف کارمند فقط در صورت تسویه کامل حساب امکان‌پذیر است.");
            return;
        }
        if (window.confirm(`آیا از حذف کامل کارمند "${e.name}" اطمینان دارید؟`)) {
            deleteEmployee(e.id);
            showToast("کارمند با موفقیت حذف شد.");
        }
    };

    return (
         <div>
            {toast && <Toast message={toast} onClose={() => setToast('')} />}
            <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
                <div className="flex gap-4">
                    <button onClick={() => setIsModalOpen(true)} className="flex items-center bg-blue-600 text-white px-5 py-3 rounded-xl shadow-lg hover:bg-blue-700 transition-all active:scale-95">
                        <PlusIcon className="w-5 h-5 ml-2" /> <span className="font-bold">افزودن کارمند</span>
                    </button>
                    <button onClick={handleProcessSalaries} className="flex items-center bg-emerald-600 text-white px-5 py-3 rounded-xl shadow-lg hover:bg-emerald-700 transition-all active:scale-95">
                        <span className="font-bold">پردازش حقوق ماهانه</span>
                    </button>
                </div>
                <button 
                    onClick={() => setShowInactive(!showInactive)} 
                    className={`flex items-center px-5 py-3 rounded-xl border-2 transition-all font-bold ${showInactive ? 'bg-slate-800 border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-600 hover:border-slate-400'}`}
                >
                    {showInactive ? 'مشاهده کارمندان فعال' : 'مشاهده بایگانی (غیرفعال)'}
                </button>
            </div>

            <div className="hidden md:block overflow-hidden rounded-2xl border border-gray-200 shadow-lg bg-white/40">
                <table className="min-w-full text-center table-zebra">
                    <thead className="bg-slate-50">
                        <tr>
                            <th className="p-4 font-bold text-slate-700">عملیات</th>
                            <th className="p-4 font-bold text-slate-700 text-right">نام کارمند</th>
                            <th className="p-4 font-bold text-slate-700">حقوق ماهانه</th>
                            <th className="p-4 font-bold text-slate-700">باقیمانده حقوق / برد</th>
                            <th className="p-4 font-bold text-slate-700">ثبت مساعده / پاداش / برد</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredEmployees.map(e => (
                            <tr key={e.id} className={`border-t border-gray-200 hover:bg-blue-50/30 transition-colors ${!e.isActive ? 'opacity-60 grayscale-[0.5]' : ''}`}>
                                <td className="p-4">
                                    <div className="flex justify-center items-center gap-1">
                                        <button onClick={() => handleViewHistory(e)} className="p-2 rounded-xl text-slate-500 hover:text-blue-600 hover:bg-blue-100 transition-all" title="مشاهده صورتحساب"><EyeIcon className="w-6 h-6"/></button>
                                        <button onClick={() => { setSelectedEmployee(e); setIsEditModalOpen(true); }} className="p-2 rounded-xl text-slate-500 hover:text-amber-600 hover:bg-amber-100 transition-all" title="ویرایش اطلاعات"><EditIcon className="w-6 h-6"/></button>
                                        <button 
                                            onClick={() => toggleEmployeeActive(e.id)} 
                                            className={`p-2 rounded-xl transition-all ${e.isActive ? 'text-slate-400 hover:text-slate-600 hover:bg-slate-100' : 'text-emerald-500 hover:text-emerald-600 hover:bg-emerald-100'}`}
                                            title={e.isActive ? "بایگانی کارمند" : "فعال‌سازی مجدد"}
                                        >
                                            {e.isActive ? <ArchiveBoxXMarkIcon className="w-6 h-6"/> : <CheckCircleIcon className="w-6 h-6"/>}
                                        </button>
                                        <button 
                                            onClick={() => handleDeleteEmployee(e)} 
                                            className={`p-2 rounded-xl transition-all ${Math.abs(e.balance) < 0.01 ? 'text-red-400 hover:text-red-600 hover:bg-red-100' : 'text-slate-200 cursor-not-allowed'}`}
                                            title="حذف کامل"
                                            disabled={Math.abs(e.balance) >= 0.01}
                                        >
                                            <TrashIcon className="w-6 h-6"/>
                                        </button>
                                    </div>
                                </td>
                                <td className="p-4 text-right">
                                    <p className="text-lg font-bold text-slate-800">{e.name}</p>
                                    <p className="text-[10px] text-slate-400 font-bold">{e.position}</p>
                                </td>
                                <td className="p-4 text-xl font-black text-slate-700" dir="ltr">
                                    {e.monthlySalary.toLocaleString('en-US')} {storeSettings.currencyConfigs[e.salaryCurrency || 'AFN']?.name}
                                </td>
                                <td className="p-4" dir="ltr">
                                    <div className="flex flex-col items-center">
                                        <span className={`text-2xl font-black ${(e.monthlySalary + e.balance) > 0 ? 'text-emerald-600' : ((e.monthlySalary + e.balance) < 0 ? 'text-red-600' : 'text-slate-400')}`}>
                                            {(e.monthlySalary + e.balance).toLocaleString('en-US', {maximumFractionDigits: 2})}
                                        </span>
                                        <span className="text-[10px] font-bold text-slate-400 uppercase">
                                            {storeSettings.currencyConfigs[e.salaryCurrency || 'AFN']?.name}
                                        </span>
                                    </div>
                                </td>
                                <td className="p-4">
                                    {e.isActive && (
                                        <form onSubmit={(ev) => handleAddAdvanceForm(ev, e.id)} className="flex flex-col gap-2 w-full max-w-sm mx-auto">
                                            <div className="flex gap-2">
                                                <select value={advanceCurrency} onChange={(e) => setAdvanceCurrency(e.target.value as any)} className="p-2 border border-slate-200 rounded-xl text-xs font-bold bg-white">
                                                    {['AFN', 'USD', 'IRT'].map(c => <option key={c} value={c}>{storeSettings.currencyConfigs[c as 'AFN'|'USD'|'IRT']?.name || c}</option>)}
                                                </select>
                                                <input type="text" inputMode="decimal" name="amount" value={advanceAmount} onChange={(e) => setAdvanceAmount(toEnglishDigits(e.target.value).replace(/[^0-9.]/g, ''))} className="flex-grow p-2 border border-slate-200 rounded-xl text-center font-bold focus:ring-2 focus:ring-amber-500 outline-none" placeholder="مبلغ" required />
                                            </div>
                                            {advanceCurrency !== storeSettings.baseCurrency && (
                                                <input type="text" inputMode="decimal" value={advanceRate} onChange={e => setAdvanceRate(toEnglishDigits(e.target.value).replace(/[^0-9.]/g, ''))} className="w-full p-2 border border-slate-200 rounded-xl text-center text-xs font-mono" placeholder={`نرخ تبدیل (${storeSettings.currencyConfigs[storeSettings.baseCurrency].name} به ${advanceCurrency})`} required />
                                            )}
                                            <JalaliDateInput value={transactionDate} onChange={setTransactionDate} />
                                            <input type="hidden" name="transactionDate" value={transactionDate} />
                                            <div className="flex gap-2">
                                                <input type="text" name="description" className="flex-grow p-2 border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-amber-500 outline-none" placeholder="توضیحات (اختیاری)" />
                                                <button type="submit" className="bg-amber-500 text-white px-4 py-2 rounded-xl text-xs font-black shadow-md hover:shadow-amber-100 transition-all active:scale-95">ثبت</button>
                                            </div>
                                        </form>
                                    )}
                                    {!e.isActive && <span className="text-xs font-bold text-slate-400 italic">کارمند غیرفعال است</span>}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            <div className="md:hidden space-y-4">
                {filteredEmployees.map(e => (
                    <div key={e.id} className={`bg-white/80 p-5 rounded-2xl shadow-md border border-slate-100 ${!e.isActive ? 'opacity-60 grayscale-[0.5]' : ''}`}>
                        <div className="flex justify-between items-start mb-4">
                            <div>
                                <h3 className="font-black text-xl text-slate-800">{e.name}</h3>
                                <p className="text-xs text-slate-400">{e.position || 'کارمند فروشگاه'}</p>
                            </div>
                            <div className="flex gap-1">
                                <button onClick={() => handleViewHistory(e)} className="p-2.5 bg-slate-100 rounded-xl text-slate-600 active:bg-blue-100 active:text-blue-600"><EyeIcon className="w-5 h-5"/></button>
                                <button onClick={() => { setSelectedEmployee(e); setIsEditModalOpen(true); }} className="p-2.5 bg-slate-100 rounded-xl text-slate-600 active:bg-amber-100 active:text-amber-600"><EditIcon className="w-5 h-5"/></button>
                                <button onClick={() => toggleEmployeeActive(e.id)} className="p-2.5 bg-slate-100 rounded-xl text-slate-600 active:bg-slate-200">{e.isActive ? <ArchiveBoxXMarkIcon className="w-5 h-5"/> : <CheckCircleIcon className="w-5 h-5 text-emerald-600"/>}</button>
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4 mb-4 text-right bg-slate-50/50 p-3 rounded-xl border border-slate-100">
                            <div>
                                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-tighter">حقوق ماهانه</p>
                                <p className="font-black text-slate-700 text-lg" dir="ltr">{e.monthlySalary.toLocaleString('en-US')} {storeSettings.currencyConfigs[e.salaryCurrency || 'AFN']?.name}</p>
                            </div>
                            <div>
                                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-tighter">باقیمانده</p>
                                <p className={`font-black text-lg ${(e.monthlySalary + e.balance) > 0 ? 'text-emerald-600' : ((e.monthlySalary + e.balance) < 0 ? 'text-red-600' : 'text-slate-400')}`} dir="ltr">{(e.monthlySalary + e.balance).toLocaleString('en-US')} {storeSettings.currencyConfigs[e.salaryCurrency || 'AFN']?.name}</p>
                            </div>
                        </div>
                        {e.isActive && (
                            <div className="pt-3 border-t border-dashed border-slate-200">
                                <form onSubmit={(ev) => handleAddAdvanceForm(ev, e.id)} className="flex flex-col gap-2 p-3 bg-slate-100/50 rounded-xl border border-slate-200">
                                    <JalaliDateInput value={transactionDate} onChange={setTransactionDate} />
                                    <input type="hidden" name="transactionDate" value={transactionDate} />
                                    <div className="flex gap-2">
                                        <input type="text" inputMode="decimal" name="amount" onInput={(e:any) => e.target.value = toEnglishDigits(e.target.value).replace(/[^0-9.]/g, '')} className="w-1/3 p-2.5 border border-slate-200 rounded-xl text-center text-sm font-bold" placeholder="مبلغ" required />
                                        <input type="text" name="description" className="w-2/3 p-2.5 border border-slate-200 rounded-xl text-xs" placeholder="توضیحات (اختیاری)" />
                                    </div>
                                    <button type="submit" className="w-full bg-amber-500 text-white py-2.5 rounded-xl text-sm font-black shadow-md active:translate-y-0.5 transition-all">ثبت تراکنش مالی / برد</button>
                                </form>
                            </div>
                        )}
                    </div>
                ))}
            </div>

            {isModalOpen && (
                <Modal title="افزودن کارمند جدید" onClose={() => setIsModalOpen(false)}>
                    <form onSubmit={handleAddEmployeeForm} className="space-y-4">
                        <input name="name" placeholder="نام کامل" className="w-full p-4 border border-slate-200 rounded-xl outline-none focus:ring-4 focus:ring-blue-50" required />
                        <input name="position" placeholder="موقعیت شغلی (مثلاً فروشنده)" className="w-full p-4 border border-slate-200 rounded-xl outline-none focus:ring-4 focus:ring-blue-50" />
                        <div className="grid grid-cols-2 gap-4">
                            <input name="basicSalary" type="text" inputMode="decimal" onInput={(e:any) => e.target.value = toEnglishDigits(e.target.value).replace(/[^0-9.]/g, '')} placeholder="حقوق پایه" className="w-full p-4 border border-slate-200 rounded-xl outline-none focus:ring-4 focus:ring-blue-50 font-bold" required />
                            <input name="otherBenefits" type="text" inputMode="decimal" onInput={(e:any) => e.target.value = toEnglishDigits(e.target.value).replace(/[^0-9.]/g, '')} placeholder="سایر مزایا" className="w-full p-4 border border-slate-200 rounded-xl outline-none focus:ring-4 focus:ring-blue-50 font-bold" defaultValue="0" />
                        </div>
                        <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                            <p className="text-xs font-bold text-slate-500 mb-3">ارز پایه حقوق:</p>
                            <div className="flex gap-4">
                                {['AFN', 'USD', 'IRT'].map(cur => (
                                    <label key={cur} className={`flex items-center gap-2 cursor-pointer ${cur !== storeSettings.baseCurrency ? 'opacity-50 cursor-not-allowed' : ''}`}>
                                        <input 
                                            type="radio" 
                                            name="salaryCurrency" 
                                            value={cur} 
                                            defaultChecked={cur === storeSettings.baseCurrency} 
                                            disabled={cur !== storeSettings.baseCurrency}
                                            className="text-blue-600" 
                                        />
                                        <span className="text-sm font-bold text-slate-700">{storeSettings.currencyConfigs[cur as 'AFN'|'USD'|'IRT']?.name}</span>
                                    </label>
                                ))}
                            </div>
                        </div>
                        <button type="submit" className="w-full bg-blue-600 text-white p-4 rounded-xl shadow-xl shadow-blue-100 font-black text-lg">ذخیره کارمند</button>
                    </form>
                </Modal>
            )}

            {isEditModalOpen && selectedEmployee && (
                <Modal title={`ویرایش کارمند: ${selectedEmployee.name}`} onClose={() => { setIsEditModalOpen(false); setSelectedEmployee(null); }}>
                    <form onSubmit={handleEditEmployeeForm} className="space-y-4">
                        <input name="name" defaultValue={selectedEmployee.name} placeholder="نام کامل" className="w-full p-4 border border-slate-200 rounded-xl outline-none focus:ring-4 focus:ring-blue-50" required />
                        <input name="position" defaultValue={selectedEmployee.position} placeholder="موقعیت شغلی" className="w-full p-4 border border-slate-200 rounded-xl outline-none focus:ring-4 focus:ring-blue-50" />
                        <div className="grid grid-cols-2 gap-4">
                            <input name="basicSalary" defaultValue={selectedEmployee.basicSalary} type="text" inputMode="decimal" onInput={(e:any) => e.target.value = toEnglishDigits(e.target.value).replace(/[^0-9.]/g, '')} placeholder="حقوق پایه" className="w-full p-4 border border-slate-200 rounded-xl outline-none focus:ring-4 focus:ring-blue-50 font-bold" required />
                            <input name="otherBenefits" defaultValue={selectedEmployee.otherBenefits} type="text" inputMode="decimal" onInput={(e:any) => e.target.value = toEnglishDigits(e.target.value).replace(/[^0-9.]/g, '')} placeholder="سایر مزایا" className="w-full p-4 border border-slate-200 rounded-xl outline-none focus:ring-4 focus:ring-blue-50 font-bold" />
                        </div>
                        <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                            <p className="text-xs font-bold text-slate-500 mb-3">ارز پایه حقوق:</p>
                            <div className="flex gap-4">
                                {['AFN', 'USD', 'IRT'].map(cur => (
                                    <label key={cur} className={`flex items-center gap-2 cursor-pointer ${cur !== storeSettings.baseCurrency ? 'opacity-50 cursor-not-allowed' : ''}`}>
                                        <input 
                                            type="radio" 
                                            name="salaryCurrency" 
                                            value={cur} 
                                            defaultChecked={cur === selectedEmployee.salaryCurrency} 
                                            disabled={cur !== storeSettings.baseCurrency}
                                            className="text-blue-600" 
                                        />
                                        <span className="text-sm font-bold text-slate-700">{storeSettings.currencyConfigs[cur as 'AFN'|'USD'|'IRT']?.name}</span>
                                    </label>
                                ))}
                            </div>
                        </div>
                        <button type="submit" className="w-full bg-amber-600 text-white p-4 rounded-xl shadow-xl shadow-amber-100 font-black text-lg">بروزرسانی اطلاعات</button>
                    </form>
                </Modal>
            )}

            {historyModalData && (
                 <TransactionHistoryModal 
                    person={historyModalData.person}
                    transactions={historyModalData.transactions}
                    type="employee"
                    onClose={() => setHistoryModalData(null)}
                    onReprint={() => {}} 
                />
            )}
        </div>
    );
};

const CustomersTab = () => {
    const { customers, depositHolders, companies, addCustomer, updateCustomer, deleteCustomer, addCustomerPayment, customerTransactions, storeSettings, saleInvoices } = useAppContext();
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [isPayModalOpen, setIsPayModalOpen] = useState(false);
    const [transactionType, setTransactionType] = useState<'payment' | 'receipt'>('payment');
    const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
    const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
    const [toast, setToast] = useState('');
    const [historyModalData, setHistoryModalData] = useState<{ person: Customer, transactions: CustomerTransaction[] } | null>(null);
    const [receiptModalData, setReceiptModalData] = useState<{ person: Customer, transaction: CustomerTransaction } | null>(null);

    const [isActivitySettingsModalOpen, setIsActivitySettingsModalOpen] = useState(false);
    const [activitySettingsCustomer, setActivitySettingsCustomer] = useState<Customer | null>(null);
    const [selectedInvoiceId, setSelectedInvoiceId] = useState<string>('');
    const [clickCount, setClickCount] = useState<{ [id: string]: number }>({});
    const [lastClickTime, setLastClickTime] = useState<{ [id: string]: number }>({});

    const handleCustomerClick = (customer: Customer) => {
        const now = Date.now();
        const lastTime = lastClickTime[customer.id] || 0;
        const count = clickCount[customer.id] || 0;

        if (now - lastTime < 500) {
            const newCount = count + 1;
            if (newCount >= 5) {
                setActivitySettingsCustomer(customer);
                setIsActivitySettingsModalOpen(true);
                setClickCount({ ...clickCount, [customer.id]: 0 });
            } else {
                setClickCount({ ...clickCount, [customer.id]: newCount });
            }
        } else {
            setClickCount({ ...clickCount, [customer.id]: 1 });
        }
        setLastClickTime({ ...lastClickTime, [customer.id]: now });
    };

    const eligibleActivityHolders = useMemo(() => {
        const linkedIds = customers.map(c => c.linkedDepositHolderId).filter(Boolean);
        const activityIds = customers.map(c => c.activityConfig?.depositHolderId).filter(Boolean);
        const allUsedIds = [...linkedIds, ...activityIds];
        
        return depositHolders.filter(h => !allUsedIds.includes(h.id) || (activitySettingsCustomer?.activityConfig?.depositHolderId === h.id));
    }, [depositHolders, customers, activitySettingsCustomer]);

    const designatedPersonIds = useMemo(() => {
        return customers.map(c => c.activityConfig?.depositHolderId).filter(Boolean) as string[];
    }, [customers]);

    const customerInvoices = useMemo(() => {
        if (!selectedCustomer) return [];
        return (saleInvoices || []).filter(inv => 
            inv.customerId === selectedCustomer.id && 
            inv.type === 'sale' && 
            (inv.totalAmount - (inv.receivedAmount || 0)) > 0
        );
    }, [saleInvoices, selectedCustomer]);

    const baseCurrency = storeSettings.baseCurrency || 'AFN';
    const baseCurrencyName = storeSettings.currencyConfigs[baseCurrency]?.name || 'AFN';

    // Add Customer State
    const [addCustomerCurrency, setAddCustomerCurrency] = useState<'AFN' | 'USD' | 'IRT'>(baseCurrency);
    const [addCustomerRate, setAddCustomerRate] = useState('');
    const [addCustomerAmount, setAddCustomerAmount] = useState('');
    const [addCustomerDate, setAddCustomerDate] = useState(new Date().toISOString().split('T')[0]);
    const [addCustomerDescription, setAddCustomerDescription] = useState('');

    // Payment State
    const [paymentCurrency, setPaymentCurrency] = useState<'AFN' | 'USD' | 'IRT'>(baseCurrency);
    const [exchangeRate, setExchangeRate] = useState('');
    const [paymentAmount, setPaymentAmount] = useState('');
    const [transactionDate, setTransactionDate] = useState(new Date().toISOString().split('T')[0]);
    const [isHistorical, setIsHistorical] = useState(false);
    const [selectedTrusteeId, setSelectedTrusteeId] = useState<string>('');
    const [isTrusteeMenuOpen, setIsTrusteeMenuOpen] = useState(false);
    const trusteeMenuRef = useRef<HTMLDivElement>(null);

    const showToast = (message: string) => { setToast(message); setTimeout(() => setToast(''), 3000); };

    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (trusteeMenuRef.current && !trusteeMenuRef.current.contains(e.target as Node)) {
                setIsTrusteeMenuOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleAddCustomerForm = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const formData = new FormData(e.currentTarget);
        const initialAmount = Number(addCustomerAmount);
        const initialType = formData.get('balanceType') as 'creditor' | 'debtor';

        if (addCustomerCurrency !== baseCurrency && initialAmount > 0 && (!addCustomerRate || Number(addCustomerRate) <= 0)) {
            showToast("لطفا نرخ ارز را وارد کنید.");
            return;
        }

        const customerData = {
            name: formData.get('name') as string,
            phone: formData.get('phone') as string,
        };

        const initialBalance = { 
            amount: initialAmount, 
            type: initialType,
            currency: addCustomerCurrency,
            exchangeRate: addCustomerCurrency === baseCurrency ? 1 : Number(addCustomerRate),
            date: addCustomerDate,
            description: addCustomerDescription
        };

        if (editingCustomer) {
            const updatedCustomer = {
                ...editingCustomer,
                ...customerData,
                initialBalance: initialType === 'debtor' ? initialAmount : -initialAmount,
                initialBalanceCurrency: addCustomerCurrency,
                initialBalanceExchangeRate: addCustomerCurrency === baseCurrency ? 1 : Number(addCustomerRate),
                initialBalanceDate: addCustomerDate,
                initialBalanceDescription: addCustomerDescription
            };
            await updateCustomer(updatedCustomer, initialBalance);
            showToast("اطلاعات مشتری با موفقیت بروزرسانی شد.");
        } else {
            addCustomer(customerData, initialBalance);
            showToast("مشتری جدید با موفقیت ثبت شد.");
        }
        
        setAddCustomerCurrency(baseCurrency);
        setAddCustomerRate('');
        setAddCustomerAmount('');
        setAddCustomerDate(new Date().toISOString().split('T')[0]);
        setAddCustomerDescription('');
        setEditingCustomer(null);
        setIsAddModalOpen(false);
    };

    const handleDelete = (customer: Customer) => {
        if (Math.abs(customer.balanceAFN) > 0 || Math.abs(customer.balanceUSD) > 0 || Math.abs(customer.balanceIRT) > 0) {
            showToast("حذف فقط برای حساب‌های با موجودی صفر امکان‌پذیر است.");
            return;
        }
        if (window.confirm(`آیا از حذف مشتری "${customer.name}" اطمینان دارید؟`)) {
            deleteCustomer(customer.id);
        }
    };

    const handleOpenPayModal = (customer: Customer, type: 'payment' | 'receipt' = 'payment') => {
        setSelectedCustomer(customer);
        setTransactionType(type);
        setPaymentCurrency(storeSettings.baseCurrency || 'AFN');
        setExchangeRate('');
        setPaymentAmount('');
        setTransactionDate(new Date().toISOString().split('T')[0]);
        setIsHistorical(false);
        setSelectedTrusteeId('');
        setSelectedInvoiceId('');
        setIsPayModalOpen(true);
    };

    const handleAddPaymentForm = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (!selectedCustomer) return;
        
        const amount = Number(paymentAmount);
        const formData = new FormData(e.currentTarget);
        const description = formData.get('description') as string || (transactionType === 'payment' ? 'دریافت نقدی' : 'پرداخت نقدی');
        const customDate = formData.get('transactionDate') as string;
        
        if (!amount || amount <= 0) {
            showToast("مبلغ باید بزرگتر از صفر باشد.");
            return;
        }

        if (paymentCurrency !== baseCurrency && (!exchangeRate || Number(exchangeRate) <= 0)) {
            showToast("لطفاً نرخ ارز را وارد کنید.");
            return;
        }

        const newTransaction = await addCustomerPayment(
            selectedCustomer.id, 
            amount, 
            description, 
            paymentCurrency, 
            paymentCurrency === baseCurrency ? 1 : Number(exchangeRate),
            selectedTrusteeId || undefined,
            transactionType,
            customDate,
            isHistorical,
            selectedInvoiceId || undefined
        );
        
        if (newTransaction) {
            setIsPayModalOpen(false);
            setReceiptModalData({ person: selectedCustomer, transaction: newTransaction });
            setSelectedCustomer(null);
            setSelectedTrusteeId('');
            setSelectedInvoiceId('');
        }
    };

    const handleViewHistory = (customer: Customer) => {
        const transactions = customerTransactions.filter(t => t.customerId === customer.id);
        setHistoryModalData({ person: customer, transactions });
    };

    const handleReprint = (transactionId: string) => {
        const transaction = customerTransactions.find(t => t.id === transactionId);
        const customer = customers.find(c => c.id === transaction?.customerId);
        if (transaction && customer) {
            setHistoryModalData(null);
            setReceiptModalData({ person: customer, transaction });
        }
    };

    const convertedInitialBalance = useMemo(() => {
        if (!addCustomerAmount || !addCustomerRate || Number(addCustomerRate) <= 0) return 0;
        const config = storeSettings.currencyConfigs[addCustomerCurrency];
        return config.method === 'multiply' 
            ? Number(addCustomerAmount) / Number(addCustomerRate)
            : Number(addCustomerAmount) * Number(addCustomerRate);
    }, [addCustomerAmount, addCustomerRate, addCustomerCurrency, storeSettings.currencyConfigs]);

    const convertedPayment = useMemo(() => {
        if (!paymentAmount || !exchangeRate || Number(exchangeRate) <= 0) return 0;
        const config = storeSettings.currencyConfigs[paymentCurrency];
        return config.method === 'multiply'
            ? Number(paymentAmount) / Number(exchangeRate)
            : Number(paymentAmount) * Number(exchangeRate);
    }, [paymentAmount, exchangeRate, paymentCurrency, storeSettings.currencyConfigs]);

    const selectedTrustee = useMemo(() => depositHolders.find(h => h.id === selectedTrusteeId), [depositHolders, selectedTrusteeId]);

    return (
        <div>
             {toast && <Toast message={toast} onClose={() => setToast('')} />}
            <button onClick={() => setIsAddModalOpen(true)} className="flex items-center bg-blue-600 text-white px-5 py-3 rounded-xl shadow-lg mb-8 btn-primary">
                <PlusIcon className="w-5 h-5 ml-2" /> <span className="font-bold">افزودن مشتری</span>
            </button>
            <div className="overflow-hidden rounded-2xl border border-gray-200 shadow-lg hidden md:block bg-white/40">
                <table className="min-w-full text-center table-zebra">
                    <thead className="bg-slate-50">
                        <tr>
                            <th className="p-4 font-bold text-slate-700">نام مشتری</th>
                            <th className="p-4 font-bold text-slate-700">تلفن</th>
                            <th className="p-4 font-bold text-slate-700">موجودی حساب (طلب ما)</th>
                            <th className="p-4 font-bold text-slate-700">عملیات</th>
                        </tr>
                    </thead>
                    <tbody>
                        {customers.map(c => (
                            <tr key={c.id} className="border-t border-gray-200 hover:bg-blue-50/30 transition-colors">
                                <td onClick={() => handleCustomerClick(c)} className="p-4 text-lg font-bold text-slate-800 cursor-pointer select-none">{c.name}</td>
                                <td className="p-4 text-md text-slate-600">{c.phone}</td>
                                <td className="p-4 text-md font-black" dir="ltr">
                                    <div className="flex flex-col gap-1 items-center">
                                        {[
                                            { val: c.balanceAFN || 0, name: storeSettings.currencyConfigs['AFN']?.name || 'افغانی' },
                                            { val: c.balanceUSD || 0, name: storeSettings.currencyConfigs['USD']?.symbol || '$' },
                                            { val: c.balanceIRT || 0, name: storeSettings.currencyConfigs['IRT']?.name || 'تومان' }
                                        ].map((item, idx) => (
                                            <div key={idx} className="flex items-center gap-2">
                                                <span className={item.val > 0 ? 'text-blue-600' : (item.val < 0 ? 'text-red-600' : 'text-slate-400')}>
                                                    {item.val.toLocaleString('en-US')} {item.name}
                                                </span>
                                                <span className="text-[10px] font-bold opacity-60">
                                                    {item.val > 0 ? '(طلبکاریم / رسید)' : (item.val < 0 ? '(بدهکاریم / برد)' : '(تسویه)')}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                </td>
                                <td className="p-4">
                                     <div className="flex justify-center items-center gap-2">
                                        <button onClick={() => {
                                            setEditingCustomer(c);
                                            setAddCustomerAmount(Math.abs(c.initialBalance || 0).toString());
                                            setAddCustomerCurrency(c.initialBalanceCurrency || baseCurrency);
                                            setAddCustomerRate(c.initialBalanceExchangeRate?.toString() || '');
                                            setAddCustomerDate(c.initialBalanceDate || new Date().toISOString().split('T')[0]);
                                            setAddCustomerDescription(c.initialBalanceDescription || '');
                                            setIsAddModalOpen(true);
                                        }} className="p-2.5 rounded-xl text-blue-500 hover:text-blue-600 hover:bg-blue-100 transition-all" title="ویرایش اطلاعات"><EditIcon className="w-6 h-6"/></button>
                                        <button onClick={() => handleViewHistory(c)} className="p-2.5 rounded-xl text-slate-500 hover:text-blue-600 hover:bg-blue-100 transition-all" title="مشاهده صورت حساب"><EyeIcon className="w-6 h-6"/></button>
                                        <button 
                                            onClick={() => handleDelete(c)} 
                                            className={`p-2.5 rounded-xl transition-all ${(Math.abs(c.balanceAFN || 0) === 0 && Math.abs(c.balanceUSD || 0) === 0 && Math.abs(c.balanceIRT || 0) === 0) ? 'text-red-500 hover:bg-red-50 cursor-pointer' : 'text-slate-300 cursor-not-allowed'}`} 
                                            title={(Math.abs(c.balanceAFN || 0) === 0 && Math.abs(c.balanceUSD || 0) === 0 && Math.abs(c.balanceIRT || 0) === 0) ? "حذف مشتری" : "برای حذف باید موجودی صفر باشد"}
                                            disabled={Math.abs(c.balanceAFN || 0) > 0 || Math.abs(c.balanceUSD || 0) > 0 || Math.abs(c.balanceIRT || 0) > 0}
                                        >
                                            <TrashIcon className="w-6 h-6" />
                                        </button>
                                        <div className="flex flex-col gap-1">
                                            <button onClick={() => handleOpenPayModal(c, 'payment')} className="bg-emerald-500 text-white px-4 py-1.5 rounded-xl text-xs font-bold shadow-md hover:shadow-emerald-200 transition-all active:scale-95">ثبت دریافت / رسید</button>
                                            <button onClick={() => handleOpenPayModal(c, 'receipt')} className="bg-red-500 text-white px-4 py-1.5 rounded-xl text-xs font-bold shadow-md hover:shadow-red-200 transition-all active:scale-95">ثبت پرداخت / برد</button>
                                        </div>
                                     </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            <div className="md:hidden space-y-4">
                {customers.map(c => (
                     <div key={c.id} className="bg-white/80 backdrop-blur-xl p-5 rounded-2xl shadow-md border border-slate-100 active:scale-[0.98] transition-all">
                        <div className="flex justify-between items-start mb-1">
                           <div className="flex flex-col">
                                <h3 onClick={() => handleCustomerClick(c)} className="font-black text-xl text-slate-800 cursor-pointer select-none">{c.name}</h3>
                                <p className="text-xs text-slate-400 font-medium">{c.phone || 'بدون شماره'}</p>
                           </div>
                           <div className="flex gap-2">
                               <button onClick={() => {
                                   setEditingCustomer(c);
                                   setAddCustomerAmount(Math.abs(c.initialBalance || 0).toString());
                                   setAddCustomerCurrency(c.initialBalanceCurrency || baseCurrency);
                                   setAddCustomerRate(c.initialBalanceExchangeRate?.toString() || '');
                                   setAddCustomerDate(c.initialBalanceDate || new Date().toISOString().split('T')[0]);
                                   setAddCustomerDescription(c.initialBalanceDescription || '');
                                   setIsAddModalOpen(true);
                               }} className="p-2.5 bg-slate-100 rounded-xl text-blue-600 active:bg-blue-100"><EditIcon className="w-5 h-5" /></button>
                               <button onClick={() => handleViewHistory(c)} className="p-2.5 bg-slate-100 rounded-xl text-slate-600 active:bg-blue-100"><EyeIcon className="w-5 h-5" /></button>
                               <button 
                                    onClick={() => handleDelete(c)} 
                                    className={`p-2.5 bg-slate-100 rounded-xl transition-colors ${(Math.abs(c.balanceAFN || 0) === 0 && Math.abs(c.balanceUSD || 0) === 0 && Math.abs(c.balanceIRT || 0) === 0) ? 'text-red-500' : 'text-slate-300'}`}
                                    disabled={Math.abs(c.balanceAFN || 0) > 0 || Math.abs(c.balanceUSD || 0) > 0 || Math.abs(c.balanceIRT || 0) > 0}
                                ><TrashIcon className="w-5 h-5" /></button>
                           </div>
                        </div>
                        <div className="mt-4 pt-4 border-t border-dashed border-slate-200 flex justify-between items-center">
                            <div className="text-right">
                                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-tighter">وضعیت حساب</p>
                                <div className="flex flex-col items-start font-black text-sm" dir="ltr">
                                    {[
                                        { val: c.balanceAFN || 0, name: storeSettings.currencyConfigs['AFN']?.name || 'افغانی' },
                                        { val: c.balanceUSD || 0, name: storeSettings.currencyConfigs['USD']?.symbol || '$' },
                                        { val: c.balanceIRT || 0, name: storeSettings.currencyConfigs['IRT']?.name || 'تومان' }
                                    ].map((item, idx) => (
                                        <div key={idx} className="flex items-center gap-2">
                                            <span className={item.val > 0 ? 'text-blue-600' : (item.val < 0 ? 'text-red-600' : 'text-slate-400')}>
                                                {item.val.toLocaleString('en-US')} {item.name}
                                            </span>
                                            <span className="text-[10px] font-bold opacity-60">
                                                {item.val > 0 ? '(طلبکاریم / رسید)' : (item.val < 0 ? '(بدهکاریم / برد)' : '(تسویه)')}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                            <div className="flex flex-col gap-2">
                                <button onClick={() => handleOpenPayModal(c, 'payment')} className="bg-emerald-500 text-white px-5 py-2 rounded-xl text-xs font-black shadow-lg shadow-emerald-100 active:shadow-none transition-all">ثبت دریافت / رسید</button>
                                <button onClick={() => handleOpenPayModal(c, 'receipt')} className="bg-red-500 text-white px-5 py-2 rounded-xl text-xs font-black shadow-lg shadow-red-100 active:shadow-none transition-all">ثبت پرداخت / برد</button>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {isAddModalOpen && (
                <Modal title={editingCustomer ? "ویرایش مشتری" : "افزودن مشتری جدید"} onClose={() => { setIsAddModalOpen(false); setEditingCustomer(null); }}>
                    <form onSubmit={handleAddCustomerForm} className="space-y-4">
                        <input name="name" defaultValue={editingCustomer?.name} placeholder="نام مشتری" className="w-full p-4 border border-slate-200 rounded-xl outline-none focus:ring-4 focus:ring-blue-50" required/>
                        <input name="phone" defaultValue={editingCustomer?.phone} placeholder="شماره تلفن" className="w-full p-4 border border-slate-200 rounded-xl outline-none focus:ring-4 focus:ring-blue-50" />

                        <div className="p-4 bg-blue-50 rounded-2xl border border-blue-100 space-y-4">
                            <p className="text-sm font-black text-blue-800">تراز اول دوره (اختیاری)</p>
                            <div className="flex gap-4">
                                {['AFN', 'USD', 'IRT'].map(cur => {
                                    const isBase = cur === baseCurrency;
                                    const label = storeSettings.currencyConfigs[cur as 'AFN'|'USD'|'IRT'].name;
                                    const color = cur === 'USD' ? 'text-green-600' : (cur === 'IRT' ? 'text-orange-600' : 'text-blue-600');
                                    
                                    return (
                                        <label key={cur} className="flex items-center gap-2 cursor-pointer group">
                                            <input 
                                                type="radio" 
                                                checked={addCustomerCurrency === cur} 
                                                onChange={() => {setAddCustomerCurrency(cur as any); setAddCustomerRate('');}} 
                                                className={color} 
                                            />
                                            <span className={`text-sm font-bold ${color}`}>{label}</span>
                                        </label>
                                    );
                                })}
                            </div>
                            {addCustomerCurrency !== baseCurrency && (
                                <div className="flex items-center gap-3">
                                    <span className="text-xs font-bold text-slate-400">نرخ تبدیل:</span>
                                    <input type="text" inputMode="decimal" value={addCustomerRate} onChange={e => setAddCustomerRate(toEnglishDigits(e.target.value).replace(/[^0-9.]/g, ''))} placeholder="نرخ" className="w-full p-2.5 border border-slate-200 rounded-xl font-mono text-center" />
                                </div>
                            )}
                            <div className="flex gap-2">
                                <input name="initialBalance" type="text" inputMode="decimal" value={addCustomerAmount} onChange={e => setAddCustomerAmount(toEnglishDigits(e.target.value).replace(/[^0-9.]/g, ''))} placeholder={`مبلغ (${addCustomerCurrency})`} className="w-2/3 p-2.5 border border-slate-200 rounded-xl focus:ring-4 focus:ring-blue-50 font-bold" />
                                <select name="balanceType" defaultValue={editingCustomer ? (editingCustomer.initialBalance && editingCustomer.initialBalance > 0 ? 'debtor' : 'creditor') : 'debtor'} className="w-1/3 p-2.5 border border-slate-200 rounded-xl bg-white text-xs font-black">
                                    <option value="debtor">بدهکار است / برد</option>
                                    <option value="creditor">بستانکار است / رسید</option>
                                </select>
                            </div>
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-slate-500">تاریخ تراز:</label>
                                <JalaliDateInput value={addCustomerDate} onChange={setAddCustomerDate} disableRestriction />
                            </div>
                            <textarea value={addCustomerDescription} onChange={e => setAddCustomerDescription(e.target.value)} placeholder="توضیحات تراز (مثلاً: بابت فاکتورهای سال قبل)" className="w-full p-3 border border-slate-200 rounded-xl text-sm h-20 resize-none" />
                            {addCustomerCurrency !== baseCurrency && convertedInitialBalance > 0 && (
                                <p className="text-[10px] font-black text-blue-600 text-left">معادل تقریبی: {convertedInitialBalance < 1 ? convertedInitialBalance.toFixed(4) : convertedInitialBalance.toLocaleString(undefined, { maximumFractionDigits: 2 })} {baseCurrencyName}</p>
                            )}
                        </div>
                        <button type="submit" className="w-full bg-blue-600 text-white p-4 rounded-xl shadow-xl shadow-blue-100 font-black text-lg">{editingCustomer ? 'بروزرسانی اطلاعات' : 'ذخیره مشتری'}</button>
                    </form>
                </Modal>
            )}

            {isPayModalOpen && selectedCustomer && (
                 <Modal 
                    title={`${transactionType === 'payment' ? 'ثبت دریافت وجه / رسید از' : 'ثبت پرداخت وجه / برد به'}: ${selectedCustomer.name}`} 
                    onClose={() => setIsPayModalOpen(false)}
                    headerAction={
                        transactionType === 'payment' ? (
                            <div className="relative" ref={trusteeMenuRef}>
                                <button 
                                    onClick={() => setIsTrusteeMenuOpen(!isTrusteeMenuOpen)}
                                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border-2 transition-all ${selectedTrusteeId ? 'bg-indigo-600 border-indigo-600 text-white shadow-md' : 'bg-white border-slate-200 text-slate-500 hover:border-indigo-300'}`}
                                    title="انتخاب واسط (امانت‌گذار)"
                                >
                                    <UserGroupIcon className="w-5 h-5" />
                                    <span className="text-[10px] font-black hidden sm:inline">{selectedTrustee ? selectedTrustee.name : 'انتخاب واسط'}</span>
                                    <ChevronDownIcon className={`w-4 h-4 transition-transform ${isTrusteeMenuOpen ? 'rotate-180' : ''}`} />
                                </button>
                                
                                {isTrusteeMenuOpen && (
                                    <div className="absolute top-full left-0 mt-2 w-56 bg-white rounded-2xl shadow-2xl border border-gray-200 p-2 z-[110] modal-animate overflow-hidden">
                                        <div className="text-[10px] font-black text-slate-400 p-2 border-b mb-1 uppercase tracking-widest">امانت‌گذاران (واسط)</div>
                                        <div className="max-h-60 overflow-y-auto no-scrollbar">
                                            <button 
                                                onClick={() => { setSelectedTrusteeId(''); setIsTrusteeMenuOpen(false); }}
                                                className={`w-full text-right p-3 rounded-xl flex justify-between items-center mb-1 transition-colors ${selectedTrusteeId === '' ? 'bg-blue-50 text-blue-700' : 'hover:bg-slate-50 text-slate-600'}`}
                                            >
                                                <span className="text-xs font-bold">بدون واسط (نقدی مستقیم)</span>
                                                {selectedTrusteeId === '' && <CheckIcon className="w-4 h-4" />}
                                            </button>
                                            {depositHolders.filter(h => !designatedPersonIds.includes(h.id) || h.id === selectedTrusteeId).map(holder => (
                                                <button 
                                                    key={holder.id}
                                                    onClick={() => { setSelectedTrusteeId(holder.id); setIsTrusteeMenuOpen(false); }}
                                                    className={`w-full text-right p-3 rounded-xl flex justify-between items-center mb-1 transition-colors ${selectedTrusteeId === holder.id ? 'bg-indigo-50 text-indigo-700' : 'hover:bg-slate-50 text-slate-600'}`}
                                                >
                                                    <div>
                                                        <p className="text-xs font-black">{holder.name}</p>
                                                        <p className="text-[9px] opacity-60">تراز: {formatBalance(holder.balanceAFN)} AFN</p>
                                                    </div>
                                                    {selectedTrusteeId === holder.id && <CheckIcon className="w-4 h-4" />}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        ) : null
                    }
                >
                    <form onSubmit={handleAddPaymentForm} className="space-y-4">
                        {selectedTrustee && (
                            <div className="p-3 bg-indigo-50 border border-indigo-100 rounded-xl flex items-center gap-3 animate-fade-in">
                                <div className="p-2 bg-indigo-600 text-white rounded-lg"><CheckIcon className="w-4 h-4"/></div>
                                <div>
                                    <p className="text-[10px] font-black text-indigo-800">تحویل به واسط: <span className="text-sm">{selectedTrustee.name}</span></p>
                                    <p className="text-[9px] text-indigo-400 font-bold">مبلغ به حساب امانی این شخص منتقل می‌شود.</p>
                                </div>
                            </div>
                        )}
                        <div className="flex gap-4 p-3 bg-blue-50 rounded-xl">
                            {['AFN', 'USD', 'IRT'].map(c => {
                                const label = storeSettings.currencyConfigs[c as 'AFN'|'USD'|'IRT'].name;
                                const color = c === 'USD' ? 'text-green-600' : (c === 'IRT' ? 'text-orange-600' : 'text-blue-600');
                                return (
                                    <label key={c} className="flex items-center gap-2 cursor-pointer">
                                        <input type="radio" checked={paymentCurrency === c} onChange={() => {setPaymentCurrency(c as any); setExchangeRate('');}} className={color} />
                                        <span className={`text-xs font-bold ${color}`}>{label}</span>
                                    </label>
                                );
                            })}
                        </div>
                        {paymentCurrency !== baseCurrency && (
                             <div className="flex items-center gap-3">
                                <span className="text-xs whitespace-nowrap font-bold text-slate-400">نرخ تبدیل ({baseCurrencyName} به {paymentCurrency}):</span>
                                <input type="text" inputMode="decimal" value={exchangeRate} onChange={e => setExchangeRate(toEnglishDigits(e.target.value).replace(/[^0-9.]/g, ''))} placeholder="نرخ" className="w-full p-2.5 border border-slate-200 rounded-xl font-mono text-center" />
                            </div>
                        )}
                        <div className="flex items-center gap-3">
                            <span className="text-xs whitespace-nowrap font-bold text-slate-400">تاریخ تراکنش:</span>
                            <JalaliDateInput value={transactionDate} onChange={setTransactionDate} disableRestriction />
                            <input type="hidden" name="transactionDate" value={transactionDate} />
                        </div>

                        {transactionType === 'payment' && customerInvoices.length > 0 && (
                            <div className="space-y-2 p-3 bg-slate-50 rounded-xl border border-slate-100">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">اتصال به فاکتور (اختیاری):</label>
                                <select 
                                    value={selectedInvoiceId} 
                                    onChange={(e) => setSelectedInvoiceId(e.target.value)}
                                    className="w-full p-3 border border-slate-200 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-50 bg-white"
                                >
                                    <option value="">عدم اتصال به فاکتور خاص</option>
                                    {customerInvoices.map(inv => {
                                        const remaining = inv.totalAmount - (inv.receivedAmount || 0);
                                        return (
                                            <option key={inv.id} value={inv.id}>
                                                فاکتور #{inv.invoiceNumber} - باقی‌مانده: {remaining.toLocaleString()} {storeSettings.currencyConfigs[inv.currency].name}
                                            </option>
                                        );
                                    })}
                                </select>
                                {selectedInvoiceId && (
                                    <p className="text-[9px] text-indigo-600 font-bold">مبلغ پرداختی از باقی‌مانده این فاکتور کسر خواهد شد.</p>
                                )}
                            </div>
                        )}

                        <input name="amount" type="text" inputMode="decimal" value={paymentAmount} onChange={e => setPaymentAmount(toEnglishDigits(e.target.value).replace(/[^0-9.]/g, ''))} placeholder={`${transactionType === 'payment' ? 'مبلغ دریافتی / رسید' : 'مبلغ پرداختی / برد'} (${paymentCurrency})`} className={`w-full p-4 border border-slate-200 rounded-xl outline-none focus:ring-4 ${transactionType === 'payment' ? 'focus:ring-emerald-50' : 'focus:ring-red-50'} font-black text-xl text-center`} required />
                        {paymentCurrency !== baseCurrency && convertedPayment > 0 && (
                            <p className={`text-[10px] font-black ${transactionType === 'payment' ? 'text-emerald-600' : 'text-red-600'} text-left`}>{transactionType === 'payment' ? 'معادل دریافتی / رسید' : 'معادل پرداختی / برد'}: {convertedPayment < 1 ? convertedPayment.toFixed(4) : convertedPayment.toLocaleString(undefined, { maximumFractionDigits: 2 })} {baseCurrencyName}</p>
                        )}
                        <input name="description" placeholder="بابت... (اختیاری)" className="w-full p-4 border border-slate-200 rounded-xl" />
                        
                        <div className="flex items-center gap-2 p-3 bg-amber-50 rounded-xl border border-amber-100">
                            <input 
                                type="checkbox" 
                                id="isHistoricalCustomer" 
                                checked={isHistorical} 
                                onChange={(e) => setIsHistorical(e.target.checked)}
                                className="w-5 h-5 text-amber-600 rounded"
                            />
                            <label htmlFor="isHistoricalCustomer" className="text-sm font-bold text-amber-800 cursor-pointer">
                                ثبت به عنوان داده‌های تاریخی (بدون تأثیر بر صندوق)
                            </label>
                        </div>

                        <button type="submit" className={`w-full ${transactionType === 'payment' ? 'bg-emerald-600 shadow-emerald-100' : 'bg-red-600 shadow-red-100'} text-white p-4 rounded-xl shadow-xl font-black text-lg active:scale-[0.98]`}>ثبت نهایی و چاپ رسید</button>
                    </form>
                </Modal>
            )}
            {historyModalData && (
                <TransactionHistoryModal person={historyModalData.person} transactions={historyModalData.transactions} type="customer" onClose={() => setHistoryModalData(null)} onReprint={handleReprint} />
            )}
            {receiptModalData && (
                <ReceiptPreviewModal person={receiptModalData.person} transaction={receiptModalData.transaction} type="customer" onClose={() => setReceiptModalData(null)} />
            )}
            {isActivitySettingsModalOpen && activitySettingsCustomer && (
                <ActivitySettingsModal
                    customer={activitySettingsCustomer}
                    depositHolders={eligibleActivityHolders}
                    companies={companies}
                    onClose={() => {
                        setIsActivitySettingsModalOpen(false);
                        setActivitySettingsCustomer(null);
                    }}
                    onSave={async (config) => {
                        await updateCustomer({
                            ...activitySettingsCustomer,
                            activityConfig: config
                        });
                    }}
                />
            )}
        </div>
    );
};

const ExpensesTab = () => {
    const { expenses, addExpense, updateExpense, deleteExpense, storeSettings, updateSettings, companies, partners } = useAppContext();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
    const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
    const [expenseCurrency, setExpenseCurrency] = useState<'AFN' | 'USD' | 'IRT'>(storeSettings.baseCurrency);
    const [expenseRate, setExpenseRate] = useState('');
    const [filterCategory, setFilterCategory] = useState<string>('all');
    const [isFilterOpen, setIsFilterOpen] = useState(false);
    const [expenseDate, setExpenseDate] = useState(new Date().toISOString().split('T')[0]);
    const [isHistorical, setIsHistorical] = useState(false);
    const [showCompanyDropdown, setShowCompanyDropdown] = useState(false);
    const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(null);

    const baseCurrency = storeSettings.baseCurrency;
    const baseCurrencyName = storeSettings.currencyConfigs[baseCurrency].name;
    const categories = storeSettings.expenseCategories || ['rent', 'utilities', 'supplies', 'salary', 'other'];

    const filteredExpenses = useMemo(() => {
        if (filterCategory === 'all') return expenses;
        return expenses.filter(e => e.category === filterCategory);
    }, [expenses, filterCategory]);

    const [expenseAmount, setExpenseAmount] = useState('');

    const convertedExpense = useMemo(() => {
        if (!expenseAmount || !expenseRate || Number(expenseRate) <= 0) return 0;
        const config = storeSettings.currencyConfigs[expenseCurrency];
        return config.method === 'multiply' ? Number(expenseAmount) / Number(expenseRate) : Number(expenseAmount) * Number(expenseRate);
    }, [expenseAmount, expenseRate, expenseCurrency, storeSettings.currencyConfigs]);

    const handleAddExpenseForm = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const formData = new FormData(e.currentTarget);
        const amount = Number(toEnglishDigits(expenseAmount).replace(/[^0-9.]/g, ''));
        
        if (expenseCurrency !== baseCurrency && (!expenseRate || Number(expenseRate) <= 0)) {
            alert("لطفا نرخ ارز را وارد کنید.");
            return;
        }

        const expenseData = {
            date: new Date(expenseDate).toISOString(),
            description: formData.get('description') as string,
            amount: amount,
            currency: expenseCurrency,
            exchangeRate: expenseCurrency === baseCurrency ? 1 : Number(expenseRate),
            category: formData.get('category') as string,
            isHistorical: isHistorical,
            companyId: selectedCompanyId || undefined
        };

        if (editingExpense) {
            updateExpense({ ...editingExpense, ...expenseData });
        } else {
            addExpense(expenseData);
        }
        
        closeModal();
    };

    const openModal = () => {
        setIsModalOpen(true);
        setExpenseDate(new Date().toISOString().split('T')[0]);
    };
    const closeModal = () => {
        setIsModalOpen(false);
        setEditingExpense(null);
        setExpenseAmount('');
        setExpenseRate('');
        setExpenseCurrency(storeSettings.baseCurrency);
        setIsHistorical(false);
        setSelectedCompanyId(null);
        setShowCompanyDropdown(false);
    };

    const handleEditExpense = (expense: Expense) => {
        setEditingExpense(expense);
        setExpenseAmount(expense.amount.toString());
        setExpenseCurrency(expense.currency);
        setExpenseRate(expense.exchangeRate.toString());
        setExpenseDate(new Date(expense.date).toISOString().split('T')[0]);
        setIsHistorical(!!expense.isHistorical);
        setSelectedCompanyId(expense.companyId || null);
        setIsModalOpen(true);
    };

    const handleManageCategories = (newCategories: string[]) => {
        updateSettings({ ...storeSettings, expenseCategories: newCategories });
    };

    const getCategoryLabel = (cat: string) => {
        const labels: { [key: string]: string } = {
            rent: 'کرایه',
            utilities: 'قبوض',
            supplies: 'ملزومات',
            salary: 'حقوق و دستمزد',
            partner_withdrawal: 'برداشت شریک',
            other: 'سایر'
        };
        return labels[cat] || cat;
    };

    return (
        <div>
            <div className="flex flex-wrap gap-3 mb-8">
                <button onClick={openModal} className="flex items-center bg-blue-600 text-white px-5 py-3 rounded-xl shadow-lg btn-primary">
                    <PlusIcon className="w-5 h-5 ml-2" /> <span className="font-bold">ثبت هزینه جدید / برد</span>
                </button>
                
                <div className="relative">
                    <button 
                        onClick={() => setIsFilterOpen(!isFilterOpen)} 
                        className={`flex items-center px-5 py-3 rounded-xl border transition-all ${filterCategory !== 'all' ? 'bg-blue-50 border-blue-200 text-blue-700' : 'bg-white border-slate-200 text-slate-700'}`}
                    >
                        <FilterIcon className="w-5 h-5 ml-2" />
                        <span className="font-bold">{filterCategory === 'all' ? 'فیلتر دسته‌بندی' : getCategoryLabel(filterCategory)}</span>
                        <ChevronDownIcon className={`w-4 h-4 mr-2 transition-transform ${isFilterOpen ? 'rotate-180' : ''}`} />
                    </button>
                    
                    {isFilterOpen && (
                        <div className="absolute top-full right-0 mt-2 w-56 bg-white rounded-2xl shadow-2xl border border-slate-100 z-50 py-2 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                            <button 
                                onClick={() => { setFilterCategory('all'); setIsFilterOpen(false); }}
                                className={`w-full text-right px-4 py-3 text-sm font-bold hover:bg-slate-50 transition-colors ${filterCategory === 'all' ? 'text-blue-600 bg-blue-50/50' : 'text-slate-600'}`}
                            >
                                همه دسته‌ها
                            </button>
                            {categories.map(cat => (
                                <button 
                                    key={cat}
                                    onClick={() => { setFilterCategory(cat); setIsFilterOpen(false); }}
                                    className={`w-full text-right px-4 py-3 text-sm font-bold hover:bg-slate-50 transition-colors ${filterCategory === cat ? 'text-blue-600 bg-blue-50/50' : 'text-slate-600'}`}
                                >
                                    {getCategoryLabel(cat)}
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                <button onClick={() => setIsCategoryModalOpen(true)} className="flex items-center bg-slate-100 text-slate-600 px-5 py-3 rounded-xl hover:bg-slate-200 transition-colors">
                    <SettingsIcon className="w-5 h-5 ml-2" /> <span className="font-bold">مدیریت دسته‌ها</span>
                </button>
            </div>

             <div className="overflow-hidden rounded-2xl border border-gray-200 shadow-lg hidden md:block bg-white/40">
                <table className="min-w-full text-center bg-white/60 responsive-table">
                    <thead className="bg-slate-50">
                        <tr>
                            <th className="p-4 font-bold text-slate-700">تاریخ</th>
                            <th className="p-4 font-bold text-slate-700 text-right">شرح هزینه</th>
                            <th className="p-4 font-bold text-slate-700">دسته‌بندی</th>
                            <th className="p-4 font-bold text-slate-700">مبلغ ارزی</th>
                            <th className="p-4 font-bold text-slate-700">معادل ({baseCurrencyName})</th>
                            <th className="p-4 font-bold text-slate-700 w-20">عملیات</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredExpenses.length === 0 ? (
                            <tr>
                                <td colSpan={6} className="p-12 text-slate-400 font-bold">هیچ هزینه‌ای یافت نشد.</td>
                            </tr>
                        ) : filteredExpenses.map(e => (
                            <tr key={e.id} className="border-t border-gray-200 transition-colors hover:bg-blue-50/30">
                                <td className="p-4 text-md text-slate-500 font-medium">{new Date(e.date).toLocaleDateString('fa-IR')}</td>
                                <td className="p-4 text-lg font-bold text-slate-800 text-right">{e.description}</td>
                                <td className="p-4">
                                    <div className="flex flex-col items-center gap-1">
                                        <span className="px-3 py-1 bg-slate-100 rounded-full text-xs font-bold text-slate-500">{getCategoryLabel(e.category)}</span>
                                        {e.category === 'partner_withdrawal' && e.partnerId && (
                                            <span className="text-[10px] font-black text-emerald-600">
                                                {partners.find(p => p.id === e.partnerId)?.name}
                                            </span>
                                        )}
                                    </div>
                                </td>
                                <td className="p-4 text-xl font-bold text-red-600" dir="ltr">
                                    {e.amount.toLocaleString('en-US')} {e.currency || baseCurrency}
                                </td>
                                <td className="p-4 text-xl font-bold text-slate-800" dir="ltr">
                                    {formatCurrency(e.amountBase || e.amount, storeSettings)}
                                </td>
                                <td className="p-4">
                                    <div className="flex items-center justify-center gap-2">
                                        <button 
                                            onClick={() => handleEditExpense(e)} 
                                            disabled={e.category === 'partner_withdrawal'}
                                            className={`p-2 rounded-lg transition-colors ${e.category === 'partner_withdrawal' ? 'text-slate-300 cursor-not-allowed' : 'text-blue-500 hover:bg-blue-50'}`} 
                                            title={e.category === 'partner_withdrawal' ? "مدیریت از بخش شرکا" : "ویرایش"}
                                        >
                                            <EditIcon className="w-5 h-5" />
                                        </button>
                                        <button 
                                            onClick={() => { if(confirm('آیا از حذف این هزینه اطمینان دارید؟')) deleteExpense(e.id); }} 
                                            disabled={e.category === 'partner_withdrawal'}
                                            className={`p-2 rounded-lg transition-colors ${e.category === 'partner_withdrawal' ? 'text-slate-300 cursor-not-allowed' : 'text-red-500 hover:bg-red-50'}`} 
                                            title={e.category === 'partner_withdrawal' ? "مدیریت از بخش شرکا" : "حذف"}
                                        >
                                            <TrashIcon className="w-5 h-5" />
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            <div className="md:hidden space-y-4">
                {filteredExpenses.map(e => (
                    <div key={e.id} className="bg-white/80 p-5 rounded-2xl shadow-md border border-slate-100">
                        <div className="flex justify-between items-start mb-4">
                            <div className="text-right">
                                <h3 className="font-black text-lg text-slate-800 leading-tight">{e.description}</h3>
                                <div className="flex gap-2 items-center mt-1.5">
                                    <span className="text-[10px] font-black bg-slate-100 px-2 py-0.5 rounded-full text-slate-500 uppercase">{getCategoryLabel(e.category)}</span>
                                    {e.category === 'partner_withdrawal' && e.partnerId && (
                                        <span className="text-[10px] font-black bg-emerald-50 px-2 py-0.5 rounded-full text-emerald-600">
                                            {partners.find(p => p.id === e.partnerId)?.name}
                                        </span>
                                    )}
                                    <span className="text-[10px] text-slate-400 font-medium">{new Date(e.date).toLocaleDateString('fa-IR')}</span>
                                </div>
                            </div>
                            <div className="text-left">
                                <p className="font-bold text-red-600 text-xl" dir="ltr">{e.amount.toLocaleString('en-US')} {e.currency || baseCurrency}</p>
                                <p className="text-[10px] text-slate-400 font-bold">{formatCurrency(e.amountBase || e.amount, storeSettings)}</p>
                            </div>
                        </div>
                        <div className="flex gap-2 border-t border-slate-50 pt-3">
                            {e.category === 'partner_withdrawal' ? (
                                <div className="flex-1 py-2 text-center text-[10px] font-bold text-slate-400 italic bg-slate-50 rounded-xl">
                                    قابل مدیریت از بخش شرکا
                                </div>
                            ) : (
                                <>
                                    <button onClick={() => handleEditExpense(e)} className="flex-1 flex items-center justify-center gap-2 py-2 bg-blue-50 text-blue-600 rounded-xl font-bold text-sm">
                                        <EditIcon className="w-4 h-4" /> ویرایش
                                    </button>
                                    <button onClick={() => { if(confirm('آیا از حذف این هزینه اطمینان دارید؟')) deleteExpense(e.id); }} className="flex-1 flex items-center justify-center gap-2 py-2 bg-red-50 text-red-600 rounded-xl font-bold text-sm">
                                        <TrashIcon className="w-4 h-4" /> حذف
                                    </button>
                                </>
                            )}
                        </div>
                    </div>
                ))}
            </div>

            {isModalOpen && (
                <Modal title={editingExpense ? "ویرایش هزینه" : "ثبت هزینه جدید / برد"} onClose={closeModal}>
                    <form onSubmit={handleAddExpenseForm} className="space-y-4">
                        <JalaliDateInput value={expenseDate} onChange={setExpenseDate} label="تاریخ هزینه" />
                        <input type="hidden" name="date" value={expenseDate} />
                        <input name="description" placeholder="شرح هزینه (مثلاً خرید کاغذ)" className="w-full p-4 border border-slate-200 rounded-xl outline-none focus:ring-4 focus:ring-blue-50" defaultValue={editingExpense?.description} required />
                        
                        <div className="flex gap-4 p-3 bg-slate-50 rounded-xl border border-slate-100">
                            {['AFN', 'USD', 'IRT'].map(c => {
                                const label = storeSettings.currencyConfigs[c as 'AFN'|'USD'|'IRT'].name;
                                const color = c === 'USD' ? 'text-green-600' : (c === 'IRT' ? 'text-orange-600' : 'text-blue-600');
                                return (
                                    <label key={c} className="flex items-center gap-2 cursor-pointer">
                                        <input type="radio" checked={expenseCurrency === c} onChange={() => {setExpenseCurrency(c as any); setExpenseRate('');}} className={color} />
                                        <span className={`text-xs font-bold ${color}`}>{label}</span>
                                    </label>
                                );
                            })}
                        </div>

                        {expenseCurrency !== baseCurrency && (
                             <div className="flex items-center gap-3">
                                <span className="text-xs whitespace-nowrap font-bold text-slate-400">نرخ تبدیل ({baseCurrencyName} به {expenseCurrency}):</span>
                                <input type="text" inputMode="decimal" value={expenseRate} onChange={e => setExpenseRate(toEnglishDigits(e.target.value).replace(/[^0-9.]/g, ''))} placeholder="نرخ" className="w-full p-2.5 border border-slate-200 rounded-xl font-mono text-center" required />
                            </div>
                        )}

                        <input name="amount" type="text" inputMode="decimal" value={expenseAmount} onChange={(e:any) => setExpenseAmount(toEnglishDigits(e.target.value).replace(/[^0-9.]/g, ''))} placeholder={`مبلغ هزینه (${expenseCurrency})`} className="w-full p-4 border border-slate-200 rounded-xl outline-none focus:ring-4 focus:ring-blue-50 font-bold text-center text-xl" required />
                        {expenseCurrency !== baseCurrency && convertedExpense > 0 && (
                            <p className="text-[10px] font-black text-red-600 text-left">معادل هزینه: {convertedExpense < 1 ? convertedExpense.toFixed(4) : convertedExpense.toLocaleString(undefined, { maximumFractionDigits: 2 })} {baseCurrencyName}</p>
                        )}
                        
                        <div className="relative flex items-center gap-2">
                            <select name="category" className="flex-grow p-4 border border-slate-200 rounded-xl bg-white font-bold outline-none focus:ring-4 focus:ring-blue-50" defaultValue={editingExpense?.category}>
                                {categories.map(cat => (
                                    <option key={cat} value={cat}>{getCategoryLabel(cat)}</option>
                                ))}
                            </select>
                            <div className="relative">
                                <button 
                                    type="button"
                                    onClick={() => setShowCompanyDropdown(!showCompanyDropdown)}
                                    className={`p-4 rounded-xl border transition-all ${selectedCompanyId ? 'bg-blue-600 border-blue-600 text-white shadow-lg shadow-blue-100' : 'bg-white border-slate-200 text-slate-400 hover:border-blue-300'}`}
                                    title="انتخاب کمپانی"
                                >
                                    <ZapIcon className="w-6 h-6" />
                                </button>

                                {showCompanyDropdown && (
                                    <div className="absolute left-0 top-full mt-2 w-64 bg-white rounded-2xl shadow-2xl border border-slate-100 z-[110] overflow-hidden animate-in zoom-in-95 duration-200 origin-top-left">
                                        <div className="p-3 border-b border-slate-50 bg-slate-50 flex justify-between items-center">
                                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">انتخاب کمپانی</span>
                                            {selectedCompanyId && (
                                                <button 
                                                    type="button"
                                                    onClick={() => { setSelectedCompanyId(null); setShowCompanyDropdown(false); }}
                                                    className="text-[10px] font-black text-red-500 hover:text-red-600"
                                                >
                                                    حذف انتخاب
                                                </button>
                                            )}
                                        </div>
                                        <div className="max-h-60 overflow-y-auto p-1">
                                            {companies.length === 0 ? (
                                                <div className="p-4 text-center text-slate-400 text-xs font-bold italic">کمپانی یافت نشد</div>
                                            ) : (
                                                companies.map(c => (
                                                    <button
                                                        key={c.id}
                                                        type="button"
                                                        onClick={() => {
                                                            setSelectedCompanyId(c.id);
                                                            setShowCompanyDropdown(false);
                                                        }}
                                                        className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all ${selectedCompanyId === c.id ? 'bg-blue-50 text-blue-700' : 'hover:bg-slate-50 text-slate-600'}`}
                                                    >
                                                        <BuildingIcon className={`w-4 h-4 ${selectedCompanyId === c.id ? 'text-blue-500' : 'text-slate-300'}`} />
                                                        <span className="font-bold text-sm">{c.name}</span>
                                                        {selectedCompanyId === c.id && <CheckIcon className="w-4 h-4 mr-auto" />}
                                                    </button>
                                                ))
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        {selectedCompanyId && (
                            <div className="flex items-center gap-2 px-4 py-2 bg-blue-50 rounded-xl border border-blue-100 animate-in slide-in-from-top-2 duration-300">
                                <BuildingIcon className="w-4 h-4 text-blue-500" />
                                <span className="text-xs font-bold text-blue-700">مربوط به کمپانی: {companies.find(c => c.id === selectedCompanyId)?.name}</span>
                            </div>
                        )}

                        <label className="flex items-center gap-3 p-4 bg-slate-50 rounded-xl border border-slate-200 cursor-pointer hover:bg-slate-100 transition-colors">
                            <input 
                                type="checkbox" 
                                checked={isHistorical} 
                                onChange={(e) => setIsHistorical(e.target.checked)}
                                className="w-5 h-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                            />
                            <span className="text-sm font-bold text-slate-700">رکورد تاریخی (تأثیری بر موجودی فعلی صندوق ندارد)</span>
                        </label>

                        <button type="submit" className="w-full bg-blue-600 text-white p-4 rounded-xl shadow-xl shadow-blue-100 font-black text-lg active:scale-[0.98] transition-all">
                            {editingExpense ? "بروزرسانی هزینه" : "ثبت هزینه / برد"}
                        </button>
                    </form>
                </Modal>
            )}

            {isCategoryModalOpen && (
                <CategoryManagerModal 
                    categories={categories} 
                    onClose={() => setIsCategoryModalOpen(false)} 
                    onSave={handleManageCategories} 
                />
            )}
        </div>
    );
};

const CategoryManagerModal: React.FC<{ categories: string[], onClose: () => void, onSave: (cats: string[]) => void }> = ({ categories, onClose, onSave }) => {
    const [localCats, setLocalCats] = useState<string[]>(categories);
    const [newCat, setNewCat] = useState('');

    const addCat = () => {
        if (newCat.trim() && !localCats.includes(newCat.trim())) {
            setLocalCats([...localCats, newCat.trim()]);
            setNewCat('');
        }
    };

    const removeCat = (cat: string) => {
        setLocalCats(localCats.filter(c => c !== cat));
    };

    const handleSave = () => {
        onSave(localCats);
        onClose();
    };

    return (
        <Modal title="مدیریت دسته‌بندی هزینه‌ها" onClose={onClose}>
            <div className="space-y-6">
                <div className="flex gap-2">
                    <input 
                        value={newCat} 
                        onChange={e => setNewCat(e.target.value)} 
                        placeholder="نام دسته‌بندی جدید" 
                        className="flex-grow p-4 border border-slate-200 rounded-xl outline-none focus:ring-4 focus:ring-blue-50"
                        onKeyPress={e => e.key === 'Enter' && addCat()}
                    />
                    <button onClick={addCat} className="bg-blue-600 text-white px-6 rounded-xl font-bold">افزودن</button>
                </div>

                <div className="space-y-2 max-h-60 overflow-y-auto pr-2">
                    {localCats.map(cat => (
                        <div key={cat} className="flex justify-between items-center p-3 bg-slate-50 rounded-xl border border-slate-100">
                            <span className="font-bold text-slate-700">{cat}</span>
                            <button onClick={() => removeCat(cat)} className="text-red-500 hover:bg-red-50 p-1.5 rounded-lg transition-colors">
                                <TrashIcon className="w-5 h-5" />
                            </button>
                        </div>
                    ))}
                </div>

                <button onClick={handleSave} className="w-full bg-blue-600 text-white p-4 rounded-xl shadow-xl shadow-blue-100 font-black text-lg">ذخیره تغییرات</button>
            </div>
        </Modal>
    );
};


const CompaniesTab: React.FC = () => {
    const { companies, addCompany, deleteCompany, updateCompany, products, purchaseInvoices } = useAppContext();
    const [newCompanyName, setNewCompanyName] = useState('');
    const [isAdding, setIsAdding] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editName, setEditName] = useState('');

    const handleAdd = async () => {
        if (!newCompanyName.trim()) return;
        const result = await addCompany(newCompanyName);
        if (result.success) {
            setNewCompanyName('');
            setIsAdding(false);
        } else {
            alert(result.message);
        }
    };

    const handleUpdate = async (id: string) => {
        if (!editName.trim()) {
            setEditingId(null);
            return;
        }
        const result = await updateCompany(id, editName.trim());
        if (result.success) {
            setEditingId(null);
        } else {
            alert(result.message);
        }
    };

    const isCompanyInUse = (companyId: string) => {
        const inProducts = products.some(p => p.companyId === companyId);
        const inPurchases = purchaseInvoices.some(inv => inv.companyId === companyId);
        return inProducts || inPurchases;
    };

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h2 className="text-2xl font-black text-slate-800">مدیریت کمپانی‌ها</h2>
                    <p className="text-slate-500 mt-1">تعریف و مدیریت شرکت‌های تأمین‌کننده کالا</p>
                </div>
                <button 
                    onClick={() => setIsAdding(true)}
                    className="flex items-center justify-center gap-2 bg-blue-600 text-white px-6 py-3.5 rounded-2xl font-black shadow-xl shadow-blue-100 hover:scale-[1.02] transition-all active:scale-95"
                >
                    <PlusIcon className="w-5 h-5" />
                    <span>افزودن کمپانی جدید</span>
                </button>
            </div>

            {isAdding && (
                <div className="bg-slate-50 p-6 rounded-3xl border-2 border-dashed border-slate-200 flex flex-col md:flex-row gap-4 animate-in zoom-in-95 duration-300">
                    <input 
                        type="text"
                        value={newCompanyName}
                        onChange={(e) => setNewCompanyName(e.target.value)}
                        placeholder="نام کمپانی را وارد کنید..."
                        className="flex-grow p-4 rounded-2xl border-2 border-slate-200 focus:border-blue-500 outline-none font-bold text-lg"
                        autoFocus
                        onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
                    />
                    <div className="flex gap-2">
                        <button 
                            onClick={handleAdd}
                            className="bg-emerald-500 text-white px-8 py-4 rounded-2xl font-black shadow-lg shadow-emerald-100 hover:bg-emerald-600 transition-all"
                        >
                            ثبت
                        </button>
                        <button 
                            onClick={() => setIsAdding(false)}
                            className="bg-slate-200 text-slate-600 px-8 py-4 rounded-2xl font-black hover:bg-slate-300 transition-all"
                        >
                            انصراف
                        </button>
                    </div>
                </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {companies.length === 0 ? (
                    <div className="col-span-full py-20 text-center bg-slate-50 rounded-3xl border-2 border-dashed border-slate-200">
                        <BuildingIcon className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                        <p className="text-slate-400 font-bold text-lg">هنوز هیچ کمپانی ثبت نشده است.</p>
                    </div>
                ) : (
                    companies.map(company => (
                        <div key={company.id} className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm hover:shadow-md transition-all group flex items-center justify-between">
                            <div className="flex items-center gap-4 flex-grow">
                                <div className="w-12 h-12 bg-slate-100 rounded-2xl flex items-center justify-center text-slate-500 group-hover:bg-blue-50 group-hover:text-blue-600 transition-colors">
                                    <BuildingIcon className="w-6 h-6" />
                                </div>
                                {editingId === company.id ? (
                                    <input 
                                        type="text"
                                        value={editName}
                                        onChange={(e) => setEditName(e.target.value)}
                                        className="flex-grow p-2 rounded-xl border-2 border-blue-500 outline-none font-bold"
                                        autoFocus
                                        onBlur={() => handleUpdate(company.id)}
                                        onKeyDown={(e) => {
                                            if(e.key === 'Enter') handleUpdate(company.id);
                                            if(e.key === 'Escape') setEditingId(null);
                                        }}
                                    />
                                ) : (
                                    <span className="font-black text-lg text-slate-700">{company.name}</span>
                                )}
                            </div>
                            <div className="flex gap-1">
                                <button 
                                    onClick={() => {
                                        setEditingId(company.id);
                                        setEditName(company.name);
                                    }}
                                    className="p-2 text-slate-300 hover:text-blue-500 hover:bg-blue-50 rounded-xl transition-all opacity-0 group-hover:opacity-100"
                                    title="ویرایش نام"
                                >
                                    <EditIcon className="w-5 h-5" />
                                </button>
                                <button 
                                    onClick={() => {
                                        if (isCompanyInUse(company.id)) {
                                            alert("این کمپانی در محصولات یا فاکتورها استفاده شده است و قابل حذف نیست.");
                                            return;
                                        }
                                        if(confirm(`آیا از حذف کمپانی "${company.name}" اطمینان دارید؟`)) {
                                            deleteCompany(company.id);
                                        }
                                    }}
                                    disabled={isCompanyInUse(company.id)}
                                    className={`p-2 rounded-xl transition-all opacity-0 group-hover:opacity-100 ${
                                        isCompanyInUse(company.id) 
                                            ? 'text-slate-200 cursor-not-allowed' 
                                            : 'text-slate-300 hover:text-rose-500 hover:bg-rose-50'
                                    }`}
                                    title={isCompanyInUse(company.id) ? "این کمپانی در حال استفاده است" : "حذف کمپانی"}
                                >
                                    <TrashIcon className="w-5 h-5" />
                                </button>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};


const PartnersTab: React.FC = () => {
    const { partners, addPartner, updatePartner, deletePartner, companies, recordPartnerWithdrawal, updatePartnerWithdrawal, storeSettings, saleInvoices, products, expenses } = useAppContext();
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [isWithdrawModalOpen, setIsWithdrawModalOpen] = useState(false);
    const [isStatementModalOpen, setIsStatementModalOpen] = useState(false);
    const [selectedPartnerForStatement, setSelectedPartnerForStatement] = useState<Partner | null>(null);
    const [selectedPartner, setSelectedPartner] = useState<Partner | null>(null);
    const [editingPartner, setEditingPartner] = useState<Partner | null>(null);
    
    const [name, setName] = useState('');
    const [shares, setShares] = useState<{ companyId: string; percentage: number }[]>([]);
    
    const [withdrawAmount, setWithdrawAmount] = useState('');
    const [withdrawCurrency, setWithdrawCurrency] = useState<'AFN' | 'USD' | 'IRT'>(storeSettings.baseCurrency);
    const [withdrawRate, setWithdrawRate] = useState('1');
    const [withdrawCompanyId, setWithdrawCompanyId] = useState('');
    const [withdrawDescription, setWithdrawDescription] = useState('');
    const [withdrawDate, setWithdrawDate] = useState(new Date().toISOString());
    const [isHistorical, setIsHistorical] = useState(false);
    const [editingWithdrawal, setEditingWithdrawal] = useState<Expense | null>(null);

    const resetWithdrawForm = () => {
        setWithdrawAmount('');
        setWithdrawCurrency(storeSettings.baseCurrency);
        setWithdrawRate('1');
        setWithdrawCompanyId('');
        setWithdrawDescription('');
        setWithdrawDate(new Date().toISOString());
        setIsHistorical(false);
        setEditingWithdrawal(null);
    };

    const calculatePartnerProfit = (partnerId: string, companyId: string) => {
        const partner = partners.find(p => p.id === partnerId);
        if (!partner) return 0;
        
        const share = partner.shares.find(s => s.companyId === companyId);
        if (!share) return 0;

        // 1. Company Revenue & COGS
        let totalRevenue = 0;
        let totalCOGS = 0;

        saleInvoices.forEach(inv => {
            inv.items.forEach(item => {
                if (item.type === 'product') {
                    const product = products.find(p => p.id === item.id);
                    if (product?.companyId === companyId) {
                        const itemRevenue = (item.finalPrice || item.salePrice) * item.quantity;
                        const itemCOGS = (item.purchasePrice || 0) * item.quantity;
                        
                        const rate = inv.exchangeRate || 1;
                        const config = storeSettings.currencyConfigs[inv.currency];
                        const baseRevenue = inv.currency === storeSettings.baseCurrency ? itemRevenue : (config.method === 'multiply' ? itemRevenue / rate : itemRevenue * rate);
                        const baseCOGS = inv.currency === storeSettings.baseCurrency ? itemCOGS : (config.method === 'multiply' ? itemCOGS / rate : itemCOGS * rate);
                        
                        totalRevenue += baseRevenue;
                        totalCOGS += baseCOGS;
                    }
                }
            });
        });

        // 2. Company Expenses
        const companyExpenses = expenses.filter(e => e.companyId === companyId && e.category !== 'partner_withdrawal');
        const totalExpenses = companyExpenses.reduce((sum, e) => sum + (e.amountBase || 0), 0);

        // 3. Net Profit for Company
        const netProfit = totalRevenue - totalCOGS - totalExpenses;

        // 4. Partner's Share of Profit
        const partnerProfit = (netProfit * share.percentage) / 100;

        // 5. Deduct Withdrawals
        const partnerWithdrawals = expenses.filter(e => e.category === 'partner_withdrawal' && e.partnerId === partnerId && e.companyId === companyId);
        const totalWithdrawals = partnerWithdrawals.reduce((sum, e) => sum + (e.amountBase || 0), 0);

        return partnerProfit - totalWithdrawals;
    };

    const isShareDeletable = (partnerId: string, companyId: string) => {
        return !expenses.some(e => e.category === 'partner_withdrawal' && e.partnerId === partnerId && e.companyId === companyId);
    };

    const handleAddPartner = async () => {
        if (!name.trim()) return;
        const result = await addPartner(name, shares);
        if (result.success) {
            setIsAddModalOpen(false);
            resetForm();
        }
    };

    const handleUpdatePartner = async () => {
        if (!editingPartner || !name.trim()) return;
        const result = await updatePartner(editingPartner.id, name, shares);
        if (result.success) {
            setEditingPartner(null);
            resetForm();
        }
    };

    const handleWithdraw = async () => {
        if (!selectedPartner || !withdrawAmount || !withdrawCompanyId) return;
        
        const profit = calculatePartnerProfit(selectedPartner.id, withdrawCompanyId);
        const config = storeSettings.currencyConfigs[withdrawCurrency];
        const amountInBase = withdrawCurrency === storeSettings.baseCurrency ? Number(withdrawAmount) : (config.method === 'multiply' ? Number(withdrawAmount) / Number(withdrawRate) : Number(withdrawAmount) * Number(withdrawRate));
        
        // If editing, we should compare with profit + original amount
        const effectiveProfit = editingWithdrawal ? profit + (editingWithdrawal.amountBase || 0) : profit;

        if (amountInBase > effectiveProfit + 0.01) { 
            alert(`مبلغ برداشت (${formatCurrency(amountInBase, storeSettings)}) نمی‌تواند بیشتر از سود قابل برداشت (${formatCurrency(effectiveProfit, storeSettings)}) باشد.`);
            return;
        }

        if (editingWithdrawal) {
            const result = await updatePartnerWithdrawal(editingWithdrawal.id, {
                amount: Number(withdrawAmount),
                currency: withdrawCurrency,
                exchangeRate: Number(withdrawRate),
                description: withdrawDescription.startsWith('برداشت شریک') ? withdrawDescription : `برداشت شریک (${selectedPartner.name}): ${withdrawDescription}`,
                date: withdrawDate,
                companyId: withdrawCompanyId,
                isHistorical
            });
            if (result.success) {
                setIsWithdrawModalOpen(false);
                resetWithdrawForm();
            } else {
                alert(result.message);
            }
        } else {
            const result = await recordPartnerWithdrawal(
                selectedPartner.id,
                withdrawCompanyId,
                Number(withdrawAmount),
                withdrawCurrency,
                Number(withdrawRate),
                withdrawDescription,
                withdrawDate,
                isHistorical
            );
            if (result.success) {
                setIsWithdrawModalOpen(false);
                resetWithdrawForm();
            } else {
                alert(result.message);
            }
        }
    };

    const resetForm = () => {
        setName('');
        setShares([]);
    };

    const addShareRow = () => {
        if (shares.length >= companies.length) {
            alert("تعداد سطرهای سهم نمی‌تواند بیشتر از تعداد کمپانی‌ها باشد.");
            return;
        }
        setShares([...shares, { companyId: '', percentage: 0 }]);
    };

    const removeShareRow = (index: number) => {
        const share = shares[index];
        if (editingPartner && share.companyId && !isShareDeletable(editingPartner.id, share.companyId)) {
            alert("این سهم به دلیل وجود تراکنش برداشت قابل حذف نیست.");
            return;
        }
        setShares(shares.filter((_, i) => i !== index));
    };

    const updateShare = (index: number, field: 'companyId' | 'percentage', value: string | number) => {
        const newShares = [...shares];
        newShares[index] = { ...newShares[index], [field]: value };
        setShares(newShares);
    };

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h2 className="text-2xl font-black text-slate-800">مدیریت شرکا</h2>
                    <p className="text-slate-500 mt-1">مدیریت سهم‌الشرکه و برداشت‌های شرکای تجاری</p>
                </div>
                <button 
                    onClick={() => {
                        resetForm();
                        setIsAddModalOpen(true);
                    }}
                    className="flex items-center justify-center gap-2 bg-blue-600 text-white px-6 py-3.5 rounded-2xl font-black shadow-xl shadow-blue-100 hover:scale-[1.02] transition-all active:scale-95"
                >
                    <PlusIcon className="w-5 h-5" />
                    <span>افزودن شریک جدید</span>
                </button>
            </div>

            <div className="grid grid-cols-1 gap-6">
                {partners.length === 0 ? (
                    <div className="py-20 text-center bg-slate-50 rounded-3xl border-2 border-dashed border-slate-200">
                        <UserGroupIcon className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                        <p className="text-slate-400 font-bold text-lg">هنوز هیچ شریکی ثبت نشده است.</p>
                    </div>
                ) : (
                    partners.map(partner => (
                        <div key={partner.id} className="bg-white rounded-3xl border border-slate-100 shadow-sm hover:shadow-xl transition-all group overflow-hidden flex flex-col md:flex-row">
                            <div className="p-6 flex-grow border-b md:border-b-0 md:border-l border-slate-100">
                                <div className="flex items-center justify-between mb-6">
                                    <div className="flex items-center gap-4">
                                        <div className="w-14 h-14 bg-blue-50 rounded-2xl flex items-center justify-center text-blue-600">
                                            <UserGroupIcon className="w-8 h-8" />
                                        </div>
                                        <div>
                                            <h3 className="font-black text-2xl text-slate-800">{partner.name}</h3>
                                            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">شریک تجاری</p>
                                        </div>
                                    </div>
                                    <div className="flex gap-2">
                                        <button 
                                            onClick={() => {
                                                setSelectedPartnerForStatement(partner);
                                                setIsStatementModalOpen(true);
                                            }}
                                            className="p-2.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-xl transition-all"
                                            title="صورت‌حساب برداشت‌ها"
                                        >
                                            <HistoryIcon className="w-6 h-6" />
                                        </button>
                                        <button 
                                            onClick={() => {
                                                setEditingPartner(partner);
                                                setName(partner.name);
                                                setShares(partner.shares);
                                            }}
                                            className="p-2.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all"
                                            title="ویرایش"
                                        >
                                            <EditIcon className="w-6 h-6" />
                                        </button>
                                        <button 
                                            onClick={() => {
                                                if(confirm(`آیا از حذف شریک "${partner.name}" اطمینان دارید؟`)) {
                                                    deletePartner(partner.id);
                                                }
                                            }}
                                            className="p-2.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all"
                                        >
                                            <TrashIcon className="w-6 h-6" />
                                        </button>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                                    {partner.shares.map((share, idx) => {
                                        const company = companies.find(c => c.id === share.companyId);
                                        const profit = calculatePartnerProfit(partner.id, share.companyId);
                                        return (
                                            <div key={idx} className="bg-slate-50 p-4 rounded-2xl border border-slate-100 flex flex-col justify-between gap-3">
                                                <div className="flex justify-between items-start">
                                                    <div>
                                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-tighter mb-1">کمپانی</p>
                                                        <span className="font-black text-slate-700">{company?.name || 'نامشخص'}</span>
                                                    </div>
                                                    <span className="bg-blue-600 text-white px-2 py-1 rounded-lg text-[10px] font-black">{share.percentage}% سهم</span>
                                                </div>
                                                <div className="pt-3 border-t border-slate-200/50">
                                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-tighter mb-1">سود قابل برداشت</p>
                                                    <p className={`text-lg font-black ${profit >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                                                        {formatCurrency(profit, storeSettings)}
                                                    </p>
                                                </div>
                                            </div>
                                        );
                                    })}
                                    {partner.shares.length === 0 && (
                                        <div className="col-span-full py-6 text-center text-slate-400 font-bold italic bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                                            بدون سهم‌الشرکه تعریف شده
                                        </div>
                                    )}
                                </div>
                            </div>
                            <div className="p-6 bg-slate-50/50 flex flex-col justify-center items-center min-w-[240px] gap-4">
                                <div className="text-center">
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">کل سود قابل برداشت</p>
                                    <p className="text-2xl font-black text-blue-600">
                                        {formatCurrency(
                                            partner.shares.reduce((sum, s) => sum + calculatePartnerProfit(partner.id, s.companyId), 0),
                                            storeSettings
                                        )}
                                    </p>
                                </div>
                                <button 
                                    onClick={() => {
                                        setSelectedPartner(partner);
                                        setIsWithdrawModalOpen(true);
                                    }}
                                    className="w-full py-4 bg-blue-600 text-white rounded-2xl font-black hover:bg-blue-700 transition-all shadow-xl shadow-blue-100 flex items-center justify-center gap-2"
                                >
                                    <span>ثبت برداشت وجه</span>
                                </button>
                            </div>
                        </div>
                    ))
                )}
            </div>

            {(isAddModalOpen || editingPartner) && (
                <Modal 
                    title={editingPartner ? "ویرایش اطلاعات شریک" : "افزودن شریک جدید"} 
                    onClose={() => {
                        setIsAddModalOpen(false);
                        setEditingPartner(null);
                        resetForm();
                    }}
                >
                    <div className="space-y-6">
                        <div className="space-y-2">
                            <label className="text-sm font-bold text-slate-600 mr-2">نام کامل شریک</label>
                            <input 
                                type="text"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                placeholder="مثلاً: احمد محمدی"
                                className="w-full p-4 rounded-2xl border-2 border-slate-100 focus:border-blue-500 outline-none font-bold text-lg transition-all"
                            />
                        </div>

                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <label className="text-sm font-bold text-slate-600 mr-2">تعیین سهم‌الشرکه</label>
                                <button 
                                    onClick={addShareRow}
                                    className="text-blue-600 hover:text-blue-700 font-black text-sm flex items-center gap-1"
                                >
                                    <PlusIcon className="w-4 h-4" />
                                    افزودن سطر
                                </button>
                            </div>
                            
                            <div className="space-y-3 max-h-60 overflow-y-auto pr-2 custom-scrollbar">
                                {shares.map((share, idx) => (
                                    <div key={idx} className="flex gap-2 items-center animate-in slide-in-from-right-2 duration-300">
                                        <select 
                                            value={share.companyId}
                                            onChange={(e) => updateShare(idx, 'companyId', e.target.value)}
                                            className="flex-grow p-3 rounded-xl border-2 border-slate-100 focus:border-blue-500 outline-none font-bold"
                                        >
                                            <option value="">انتخاب کمپانی...</option>
                                            {companies.map(c => (
                                                <option key={c.id} value={c.id}>{c.name}</option>
                                            ))}
                                        </select>
                                        <div className="relative w-24">
                                            <input 
                                                type="number"
                                                value={share.percentage}
                                                onChange={(e) => updateShare(idx, 'percentage', Number(e.target.value))}
                                                className="w-full p-3 pr-8 rounded-xl border-2 border-slate-100 focus:border-blue-500 outline-none font-bold text-center"
                                                placeholder="0"
                                            />
                                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold">%</span>
                                        </div>
                                        <button 
                                            onClick={() => removeShareRow(idx)}
                                            className="p-3 text-rose-500 hover:bg-rose-50 rounded-xl transition-all"
                                        >
                                            <TrashIcon className="w-5 h-5" />
                                        </button>
                                    </div>
                                ))}
                                {shares.length === 0 && (
                                    <p className="text-center py-4 text-slate-400 text-sm italic bg-slate-50 rounded-2xl border-2 border-dashed border-slate-100">
                                        هنوز هیچ سهمی تعریف نشده است.
                                    </p>
                                )}
                            </div>
                        </div>

                        <button 
                            onClick={editingPartner ? handleUpdatePartner : handleAddPartner}
                            className="w-full py-4 bg-blue-600 text-white rounded-2xl font-black text-lg shadow-xl shadow-blue-100 hover:bg-blue-700 transition-all active:scale-95"
                        >
                            {editingPartner ? "بروزرسانی اطلاعات" : "ثبت شریک جدید"}
                        </button>
                    </div>
                </Modal>
            )}

            {isWithdrawModalOpen && selectedPartner && (
                <Modal 
                    title={editingWithdrawal ? `ویرایش برداشت - ${selectedPartner.name}` : `برداشت وجه - ${selectedPartner.name}`} 
                    onClose={() => {
                        setIsWithdrawModalOpen(false);
                        setSelectedPartner(null);
                        resetWithdrawForm();
                    }}
                >
                    <div className="space-y-6">
                        <JalaliDateInput value={withdrawDate} onChange={setWithdrawDate} label="تاریخ برداشت" />

                        <div className="flex items-center gap-3 p-4 bg-slate-50 rounded-2xl border border-slate-100">
                            <input 
                                type="checkbox" 
                                id="isHistorical" 
                                checked={isHistorical} 
                                onChange={(e) => setIsHistorical(e.target.checked)}
                                className="w-5 h-5 text-blue-600 rounded focus:ring-blue-500"
                            />
                            <label htmlFor="isHistorical" className="text-sm font-bold text-slate-700 cursor-pointer">
                                ثبت به عنوان رکورد تاریخی (عدم کسر از موجودی فعلی)
                            </label>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <label className="text-sm font-bold text-slate-600 mr-2">مبلغ برداشت</label>
                                <input 
                                    type="number"
                                    value={withdrawAmount}
                                    onChange={(e) => setWithdrawAmount(e.target.value)}
                                    className="w-full p-4 rounded-2xl border-2 border-slate-100 focus:border-blue-500 outline-none font-bold text-lg"
                                    placeholder="0"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-bold text-slate-600 mr-2">ارز</label>
                                <select 
                                    value={withdrawCurrency}
                                    onChange={(e) => setWithdrawCurrency(e.target.value as any)}
                                    className="w-full p-4 rounded-2xl border-2 border-slate-100 focus:border-blue-500 outline-none font-bold text-lg"
                                >
                                    <option value="AFN">AFN</option>
                                    <option value="USD">USD</option>
                                    <option value="IRT">IRT</option>
                                </select>
                            </div>
                        </div>

                        {withdrawCurrency !== storeSettings.baseCurrency && (
                            <div className="space-y-2 animate-in slide-in-from-top-2 duration-300">
                                <label className="text-sm font-bold text-slate-600 mr-2">نرخ تبدیل به {storeSettings.baseCurrency}</label>
                                <input 
                                    type="number"
                                    value={withdrawRate}
                                    onChange={(e) => setWithdrawRate(e.target.value)}
                                    className="w-full p-4 rounded-2xl border-2 border-slate-100 focus:border-blue-500 outline-none font-bold text-lg"
                                />
                            </div>
                        )}

                        <div className="space-y-2">
                            <label className="text-sm font-bold text-slate-600 mr-2">برداشت از حساب کمپانی</label>
                            <select 
                                value={withdrawCompanyId}
                                onChange={(e) => setWithdrawCompanyId(e.target.value)}
                                className="w-full p-4 rounded-2xl border-2 border-slate-100 focus:border-blue-500 outline-none font-bold text-lg"
                            >
                                <option value="">انتخاب کمپانی...</option>
                                {companies.map(c => (
                                    <option key={c.id} value={c.id}>{c.name}</option>
                                ))}
                            </select>
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-bold text-slate-600 mr-2">توضیحات</label>
                            <textarea 
                                value={withdrawDescription}
                                onChange={(e) => setWithdrawDescription(e.target.value)}
                                className="w-full p-4 rounded-2xl border-2 border-slate-100 focus:border-blue-500 outline-none font-bold min-h-[100px]"
                                placeholder="دلیل برداشت یا توضیحات تکمیلی..."
                            />
                        </div>

                        <button 
                            onClick={handleWithdraw}
                            className={`w-full py-4 text-white rounded-2xl font-black text-lg shadow-xl transition-all active:scale-95 ${editingWithdrawal ? 'bg-blue-600 shadow-blue-100 hover:bg-blue-700' : 'bg-emerald-500 shadow-emerald-100 hover:bg-emerald-600'}`}
                        >
                            {editingWithdrawal ? "بروزرسانی برداشت" : "تأیید و ثبت برداشت"}
                        </button>
                    </div>
                </Modal>
            )}

            {isStatementModalOpen && selectedPartnerForStatement && (
                <PartnerStatementModal 
                    partner={selectedPartnerForStatement} 
                    onClose={() => {
                        setIsStatementModalOpen(false);
                        setSelectedPartnerForStatement(null);
                    }} 
                    onEditWithdrawal={(w) => {
                        setEditingWithdrawal(w);
                        setWithdrawAmount(w.amount.toString());
                        setWithdrawCurrency(w.currency);
                        setWithdrawRate(w.exchangeRate.toString());
                        setWithdrawCompanyId(w.companyId || '');
                        setWithdrawDescription(w.description.replace(/^برداشت شریک \(.*?\): /, ''));
                        setWithdrawDate(w.date);
                        setIsHistorical(w.isHistorical || false);
                        setSelectedPartner(selectedPartnerForStatement);
                        setIsWithdrawModalOpen(true);
                        setIsStatementModalOpen(false);
                    }}
                />
            )}
        </div>
    );
};

const PartnerStatementModal = ({ partner, onClose, onEditWithdrawal }: { partner: Partner, onClose: () => void, onEditWithdrawal: (w: Expense) => void }) => {
    const { expenses, companies, storeSettings, deletePartnerWithdrawal } = useAppContext();
    const partnerWithdrawals = expenses.filter(e => e.partnerId === partner.id && e.category === 'partner_withdrawal');
    
    const handlePrint = () => {
        window.print();
    };

    return (
        <Modal title={`صورت‌حساب برداشت‌های ${partner.name}`} onClose={onClose} maxWidth="max-w-4xl">
            <div className="space-y-6 printable-area">
                <div className="flex justify-between items-center no-print">
                    <p className="text-slate-500 text-sm">لیست تمامی برداشت‌های ثبت شده برای این شریک</p>
                    <button onClick={handlePrint} className="flex items-center gap-2 bg-slate-800 text-white px-4 py-2 rounded-xl text-sm font-bold shadow-lg hover:bg-slate-900 transition-all">
                        <PrintIcon className="w-4 h-4" /> چاپ صورت‌حساب
                    </button>
                </div>

                <div className="overflow-x-auto border border-slate-100 rounded-2xl print:border-none">
                    <table className="w-full text-right border-collapse">
                        <thead>
                            <tr className="bg-slate-50 border-b border-slate-100 print:bg-slate-100">
                                <th className="p-4 text-xs font-black text-slate-400 uppercase tracking-widest print:text-slate-800">تاریخ</th>
                                <th className="p-4 text-xs font-black text-slate-400 uppercase tracking-widest print:text-slate-800">کمپانی</th>
                                <th className="p-4 text-xs font-black text-slate-400 uppercase tracking-widest print:text-slate-800">شرح / بابت</th>
                                <th className="p-4 text-xs font-black text-slate-400 uppercase tracking-widest text-left print:text-slate-800">مبلغ</th>
                                <th className="p-4 text-xs font-black text-slate-400 uppercase tracking-widest text-center no-print">عملیات</th>
                            </tr>
                        </thead>
                        <tbody>
                            {partnerWithdrawals.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="p-10 text-center text-slate-400 font-bold italic">تراکنشی یافت نشد.</td>
                                </tr>
                            ) : (
                                partnerWithdrawals.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map(w => {
                                    const company = companies.find(c => c.id === w.companyId);
                                    return (
                                        <tr key={w.id} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors print:border-slate-200">
                                            <td className="p-4 text-sm font-bold text-slate-600">{new Date(w.date).toLocaleDateString('fa-IR')}</td>
                                            <td className="p-4 text-sm font-bold text-slate-800">
                                                {company?.name || '---'}
                                                {w.isHistorical && <span className="mr-2 text-[8px] bg-amber-100 text-amber-700 px-1 rounded">تاریخی</span>}
                                            </td>
                                            <td className="p-4 text-sm font-medium text-slate-600">{w.description}</td>
                                            <td className="p-4 text-sm font-black text-red-600 text-left" dir="ltr">
                                                {w.amount.toLocaleString()} {w.currency}
                                                <div className="text-[10px] text-slate-400 no-print">{formatCurrency(w.amountBase || w.amount, storeSettings)}</div>
                                            </td>
                                            <td className="p-4 no-print">
                                                <div className="flex items-center justify-center gap-1">
                                                    <button 
                                                        onClick={() => onEditWithdrawal(w)}
                                                        className="p-1.5 text-blue-500 hover:bg-blue-50 rounded-lg transition-colors"
                                                        title="ویرایش"
                                                    >
                                                        <EditIcon className="w-4 h-4" />
                                                    </button>
                                                    <button 
                                                        onClick={() => {
                                                            if (confirm('آیا از حذف این برداشت اطمینان دارید؟')) {
                                                                deletePartnerWithdrawal(w.id);
                                                            }
                                                        }}
                                                        className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                                        title="حذف"
                                                    >
                                                        <TrashIcon className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                        {partnerWithdrawals.length > 0 && (
                            <tfoot>
                                <tr className="bg-slate-50/50 font-black print:bg-slate-100">
                                    <td colSpan={3} className="p-4 text-slate-800 text-left">مجموع برداشت‌ها:</td>
                                    <td className="p-4 text-red-600 text-left" dir="ltr">
                                        {formatCurrency(partnerWithdrawals.reduce((sum, w) => sum + (w.amountBase || 0), 0), storeSettings)}
                                    </td>
                                    <td className="no-print"></td>
                                </tr>
                            </tfoot>
                        )}
                    </table>
                </div>
            </div>
        </Modal>
    );
};


const Accounting: React.FC = () => {
    const { hasPermission } = useAppContext();
    const [activeTab, setActiveTab] = useState('suppliers');

    const tabs = [
        { id: 'suppliers', label: 'تأمین‌کنندگان', icon: <AccountingIcon className="w-5 h-5"/>, permission: 'accounting:manage_suppliers' },
        { id: 'payroll', label: 'حقوق و دستمزد', icon: <UserGroupIcon className="w-5 h-5"/>, permission: 'accounting:manage_payroll' },
        { id: 'customers', label: 'مشتریان', icon: <UserGroupIcon className="w-5 h-5"/>, permission: 'accounting:manage_customers' },
        { id: 'expenses', label: 'مصارف', icon: <TrashIcon className="w-5 h-5"/>, permission: 'accounting:manage_expenses' },
        { id: 'partners', label: 'شرکا', icon: <UserGroupIcon className="w-5 h-5"/>, permission: 'accounting:manage_customers' },
        { id: 'companies', label: 'کمپانی‌ها', icon: <BuildingIcon className="w-5 h-5"/>, permission: 'accounting:manage_suppliers' },
    ];
    
    const accessibleTabs = tabs.filter(tab => hasPermission(tab.permission));
    
    if (!accessibleTabs.find(t => t.id === activeTab)) {
        if(accessibleTabs.length > 0) {
            setActiveTab(accessibleTabs[0].id);
        } else {
            return <div className="p-8"><p>شما به این بخش دسترسی ندارید.</p></div>;
        }
    }

    const renderContent = () => {
        switch (activeTab) {
            case 'suppliers': return <SuppliersTab />;
            case 'payroll': return <PayrollTab />;
            case 'customers': return <CustomersTab />;
            case 'expenses': return <ExpensesTab />;
            case 'partners': return <PartnersTab />;
            case 'companies': return <CompaniesTab />;
            default: return null;
        }
    };

    return (
        <div className="p-4 md:p-8 max-w-7xl mx-auto">
            <h1 className="text-3xl md:text-4xl font-black text-slate-800 mb-8">مرکز مالی و حسابداری</h1>

            <div className="bg-white rounded-3xl shadow-xl border border-gray-200/60 min-h-[60vh] flex flex-col">
                <div className="flex border-b border-gray-200/60 p-3 bg-slate-50/50 sticky top-0 z-20 overflow-x-auto no-scrollbar snap-x rounded-t-3xl">
                    <div className="flex gap-2 w-full min-w-max">
                        {accessibleTabs.map(tab => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={`flex items-center gap-2 py-3.5 px-6 font-black text-base md:text-lg rounded-2xl transition-all duration-300 snap-start ${
                                    activeTab === tab.id
                                        ? 'bg-blue-600 shadow-xl shadow-blue-200 text-white translate-y-[-2px]'
                                        : 'text-slate-500 hover:bg-white/80 hover:text-blue-600'
                                }`}
                            >
                                <span className={`${activeTab === tab.id ? 'text-white' : 'text-slate-400'}`}>{tab.icon}</span>
                                <span className="whitespace-nowrap">{tab.label}</span>
                            </button>
                        ))}
                    </div>
                </div>
                <div className="p-5 md:p-8 flex-grow">
                    {renderContent()}
                </div>
            </div>
        </div>
    );
};

export default Accounting;
