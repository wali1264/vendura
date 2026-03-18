import React, { useState, useMemo } from 'react';
import { useAppContext } from '../AppContext';
import type { DepositHolder, DepositTransaction } from '../types';
import { PlusIcon, XIcon, EyeIcon, TrashIcon, SafeIcon, SearchIcon, CheckIcon, EditIcon } from '../components/icons';
import Toast from '../components/Toast';
import DepositHistoryModal from '../components/DepositHistoryModal';
import JalaliDateInput from '../components/JalaliDateInput';
import { toEnglishDigits } from '../utils/formatters';

const Modal: React.FC<{ title: string, onClose: () => void, children: React.ReactNode }> = ({ title, onClose, children }) => (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-start justify-center z-[100] p-4 pt-12 md:pt-20 overflow-y-auto modal-animate">
        <div className="bg-white rounded-2xl shadow-2xl border border-indigo-200 w-full max-w-lg overflow-hidden my-0">
            <div className="flex justify-between items-center p-4 border-b border-indigo-50 bg-indigo-50 sticky top-0 z-10">
                <h2 className="text-xl font-bold text-indigo-800">{title}</h2>
                <button onClick={onClose} className="p-1 rounded-full text-indigo-400 hover:bg-red-100 hover:text-red-600 transition-colors"><XIcon className="w-6 h-6" /></button>
            </div>
            <div className="p-6 bg-white">{children}</div>
        </div>
    </div>
);

const SecurityDeposits: React.FC = () => {
    const { depositHolders, depositTransactions, addDepositHolder, deleteDepositHolder, processDepositTransaction, updateDepositTransaction, hasPermission, storeSettings } = useAppContext();
    
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [isTransactionModalOpen, setIsTransactionModalOpen] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedHolder, setSelectedHolder] = useState<DepositHolder | null>(null);
    const [transactionType, setTransactionType] = useState<'deposit' | 'withdrawal'>('deposit');
    const [selectedCurrency, setSelectedCurrency] = useState<'AFN' | 'USD' | 'IRT'>('AFN');
    const [transactionAmount, setTransactionAmount] = useState<string>('');
    const [exchangeRate, setExchangeRate] = useState<string>('1');
    const [transactionDate, setTransactionDate] = useState<string>(new Date().toISOString().split('T')[0]);
    const [isHistorical, setIsHistorical] = useState(false);
    const [transactionDescription, setTransactionDescription] = useState('');
    const [editingTransaction, setEditingTransaction] = useState<DepositTransaction | null>(null);
    const [historyModalHolder, setHistoryModalHolder] = useState<DepositHolder | null>(null);
    const [toast, setToast] = useState('');

    const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 3000); };

    const handleOpenTransactionModal = (holder: DepositHolder, type: 'deposit' | 'withdrawal') => {
        setSelectedHolder(holder);
        setTransactionType(type);
        setTransactionAmount('');
        setExchangeRate('1');
        setTransactionDate(new Date().toISOString().split('T')[0]);
        setIsHistorical(false);
        setTransactionDescription('');
        setEditingTransaction(null);
        setSelectedCurrency(storeSettings.baseCurrency as any);
        setIsTransactionModalOpen(true);
    };

    const handleOpenEditModal = (tx: DepositTransaction) => {
        const holder = depositHolders.find(h => h.id === tx.holderId);
        if (!holder) return;
        
        setSelectedHolder(holder);
        setEditingTransaction(tx);
        setTransactionType(tx.type);
        setTransactionAmount(tx.amount.toString());
        setExchangeRate(tx.exchangeRate?.toString() || '1');
        setTransactionDate(tx.date.split('T')[0]);
        setIsHistorical(!!tx.isHistorical);
        setTransactionDescription(tx.description);
        setSelectedCurrency(tx.currency as any);
        setIsTransactionModalOpen(true);
    };

    const handleAddHolder = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const formData = new FormData(e.currentTarget);
        const name = formData.get('name') as string;
        if (!name.trim()) return;

        setIsProcessing(true);
        try {
            await addDepositHolder({
                name,
                phone: formData.get('phone') as string,
            });
            setIsAddModalOpen(false);
            showToast("✅ پرونده امانی جدید با موفقیت باز شد.");
        } finally {
            setIsProcessing(false);
        }
    };

    const handleTransaction = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (!selectedHolder || isProcessing) return;
        
        const amount = Number(toEnglishDigits(transactionAmount).replace(/[^0-9.]/g, ''));
        const rate = Number(toEnglishDigits(exchangeRate || '1').replace(/[^0-9.]/g, '')) || 1;
        const description = transactionDescription;

        if (!amount || amount <= 0) return showToast("⚠️ مبلغ معتبر وارد کنید.");
        if (transactionType === 'withdrawal' && !description.trim()) return showToast("⚠️ ثبت توضیحات برای برداشت الزامی است.");

        setIsProcessing(true);
        try {
            if (editingTransaction) {
                const updatedTx: DepositTransaction = {
                    ...editingTransaction,
                    type: transactionType,
                    amount,
                    currency: selectedCurrency,
                    exchangeRate: rate,
                    description,
                    date: new Date(transactionDate).toISOString(),
                    isHistorical
                };
                const res = await updateDepositTransaction(updatedTx);
                if (res.success) {
                    setIsTransactionModalOpen(false);
                    showToast(`✅ تراکنش با موفقیت بروزرسانی شد.`);
                } else {
                    showToast(`❌ ${res.message}`);
                }
            } else {
                const res = await processDepositTransaction(
                    selectedHolder.id, 
                    transactionType, 
                    amount, 
                    selectedCurrency, 
                    description, 
                    rate, 
                    true, 
                    transactionDate, 
                    isHistorical,
                    true // isManual
                );
                if (res.success) {
                    setIsTransactionModalOpen(false);
                    showToast(`✅ ${transactionType === 'deposit' ? 'واریز' : 'برداشت'} مبلغ ${amount.toLocaleString()} ${selectedCurrency} با موفقیت ثبت شد.`);
                } else {
                    showToast(`❌ ${res.message}`);
                }
            }
        } catch (error) {
            showToast("❌ خطای غیرمنتظره در ثبت تراکنش.");
        } finally {
            setIsProcessing(false);
        }
    };

    const handleDelete = (holder: DepositHolder) => {
        if (holder.balanceAFN !== 0 || holder.balanceUSD !== 0 || holder.balanceIRT !== 0) {
            showToast("⚠️ حذف فقط برای حساب‌های با مانده صفر مجاز است.");
            return;
        }
        if (window.confirm(`آیا از حذف پرونده امانی "${holder.name}" اطمینان دارید؟`)) {
            deleteDepositHolder(holder.id);
            showToast("🗑️ پرونده حذف شد.");
        }
    };

    const filteredHolders = useMemo(() => {
        return depositHolders.filter(h => 
            h.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
            (h.phone && h.phone.includes(searchTerm))
        );
    }, [depositHolders, searchTerm]);

    return (
        <div className="p-4 md:p-8 max-7xl mx-auto">
            {toast && <Toast message={toast} onClose={() => setToast('')} />}
            
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
                <h1 className="text-3xl md:text-4xl font-black text-indigo-900 flex items-center gap-3">
                    <SafeIcon className="w-10 h-10 text-indigo-600" />
                    مدیریت صندوق امانات
                </h1>
                {hasPermission('accounting:manage_deposits') && (
                    <button onClick={() => setIsAddModalOpen(true)} className="w-full md:w-auto flex items-center justify-center bg-indigo-600 text-white px-6 py-3.5 rounded-2xl shadow-xl shadow-indigo-100 hover:bg-indigo-700 transition-all btn-primary">
                        <PlusIcon className="w-5 h-5 ml-2" />
                        <span className="font-bold">تعریف شخص جدید</span>
                    </button>
                )}
            </div>

            {/* Search Bar */}
            <div className="relative mb-6">
                <input
                    type="text"
                    placeholder="جستجوی نام یا شماره تماس امانت‌گذار..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full p-4 pr-12 rounded-2xl bg-white border-2 border-indigo-50 shadow-sm focus:border-indigo-500 outline-none font-bold transition-all"
                />
                <SearchIcon className="absolute right-4 top-1/2 -translate-y-1/2 text-indigo-300 w-6 h-6" />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 space-y-4">
                    <div className="bg-white rounded-3xl shadow-xl border border-indigo-50 overflow-hidden">
                        <div className="hidden md:block">
                            <table className="min-w-full text-center table-zebra">
                                <thead className="bg-indigo-50/50">
                                    <tr>
                                        <th className="p-4 font-black text-indigo-900">شخص امانت‌گذار</th>
                                        <th className="p-4 font-black text-indigo-900">موجودی امانی (۳ ارز)</th>
                                        <th className="p-4 font-black text-indigo-900">عملیات</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredHolders.map(h => (
                                        <tr key={h.id} className="border-t border-indigo-50 hover:bg-indigo-50/30 transition-colors">
                                            <td className="p-4">
                                                <p className="font-black text-slate-800 text-lg">{h.name}</p>
                                                <p className="text-xs text-slate-400 font-medium">{h.phone || 'بدون شماره'}</p>
                                            </td>
                                            <td className="p-4">
                                                <div className="flex justify-center gap-4 text-xs font-black" dir="ltr">
                                                    <div className="bg-white px-2 py-1 rounded-lg border border-indigo-100"><span className="text-indigo-600">{h.balanceAFN.toLocaleString(undefined, {maximumFractionDigits: 3})}</span> {storeSettings.currencyConfigs['AFN']?.name || 'AFN'}</div>
                                                    <div className="bg-white px-2 py-1 rounded-lg border border-indigo-100"><span className="text-indigo-600">{h.balanceUSD.toLocaleString(undefined, {maximumFractionDigits: 3})}</span> {storeSettings.currencyConfigs['USD']?.name || 'USD'}</div>
                                                    <div className="bg-white px-2 py-1 rounded-lg border border-indigo-100"><span className="text-indigo-600">{h.balanceIRT.toLocaleString(undefined, {maximumFractionDigits: 3})}</span> {storeSettings.currencyConfigs['IRT']?.name || 'IRT'}</div>
                                                </div>
                                            </td>
                                            <td className="p-4">
                                                <div className="flex justify-center gap-2">
                                                    <button onClick={() => setHistoryModalHolder(h)} className="p-2 rounded-xl text-indigo-600 hover:bg-indigo-100 transition-colors" title="ریز تراکنش‌ها"><EyeIcon className="w-6 h-6"/></button>
                                                    <button onClick={() => handleOpenTransactionModal(h, 'deposit')} className="bg-emerald-500 text-white px-3 py-2 rounded-xl text-xs font-black shadow-md hover:shadow-emerald-100 transition-all">واریز</button>
                                                    <button onClick={() => handleOpenTransactionModal(h, 'withdrawal')} className="bg-orange-500 text-white px-3 py-2 rounded-xl text-xs font-black shadow-md hover:shadow-orange-100 transition-all">برداشت</button>
                                                    <button onClick={() => handleDelete(h)} className={`p-2 rounded-xl transition-all ${(h.balanceAFN===0 && h.balanceUSD===0 && h.balanceIRT===0) ? 'text-red-400 hover:bg-red-50' : 'text-slate-200 cursor-not-allowed'}`} disabled={h.balanceAFN!==0 || h.balanceUSD!==0 || h.balanceIRT!==0}><TrashIcon className="w-5 h-5"/></button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                    {filteredHolders.length === 0 && (
                                        <tr><td colSpan={3} className="p-20 text-slate-400 font-bold">موردی یافت نشد.</td></tr>
                                    )}
                                </tbody>
                            </table>
                        </div>

                        {/* Mobile List */}
                        <div className="md:hidden space-y-4 p-4">
                            {filteredHolders.map(h => (
                                <div key={h.id} className="bg-white p-5 rounded-2xl border border-indigo-50 shadow-md">
                                    <div className="flex justify-between items-start mb-4">
                                        <div>
                                            <h3 className="font-black text-xl text-indigo-900">{h.name}</h3>
                                            <p className="text-xs text-slate-400">{h.phone}</p>
                                        </div>
                                        <div className="flex gap-1">
                                            <button onClick={() => setHistoryModalHolder(h)} className="p-2 bg-indigo-50 rounded-xl text-indigo-600"><EyeIcon className="w-5 h-5"/></button>
                                            <button onClick={() => handleDelete(h)} className={`p-2 bg-slate-50 rounded-xl ${h.balanceAFN===0 ? 'text-red-400' : 'text-slate-200'}`}><TrashIcon className="w-5 h-5"/></button>
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-3 gap-2 mb-4">
                                        <div className="text-center p-2 bg-slate-50 rounded-xl border">
                                            <p className="text-[8px] font-black text-slate-400 uppercase">{storeSettings.currencyConfigs['AFN']?.name || 'AFN'}</p>
                                            <p className="font-black text-indigo-700">{h.balanceAFN.toLocaleString(undefined, {maximumFractionDigits: 3})}</p>
                                        </div>
                                        <div className="text-center p-2 bg-slate-50 rounded-xl border">
                                            <p className="text-[8px] font-black text-slate-400 uppercase">{storeSettings.currencyConfigs['USD']?.name || 'USD'}</p>
                                            <p className="font-black text-indigo-700">{h.balanceUSD.toLocaleString(undefined, {maximumFractionDigits: 3})}</p>
                                        </div>
                                        <div className="text-center p-2 bg-slate-50 rounded-xl border">
                                            <p className="text-[8px] font-black text-slate-400 uppercase">{storeSettings.currencyConfigs['IRT']?.name || 'IRT'}</p>
                                            <p className="font-black text-indigo-700">{h.balanceIRT.toLocaleString(undefined, {maximumFractionDigits: 3})}</p>
                                        </div>
                                    </div>
                                    <div className="flex gap-2 pt-3 border-t border-dashed">
                                        <button onClick={() => handleOpenTransactionModal(h, 'deposit')} className="flex-1 py-3 bg-emerald-500 text-white rounded-xl font-black text-sm active:scale-95 transition-transform">واریز امانت</button>
                                        <button onClick={() => handleOpenTransactionModal(h, 'withdrawal')} className="flex-1 py-3 bg-orange-500 text-white rounded-xl font-black text-sm active:scale-95 transition-transform">برداشت</button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                <div className="space-y-6">
                    <div className="p-6 bg-white rounded-3xl border border-indigo-100 shadow-lg">
                        <h4 className="font-black text-indigo-900 mb-6 flex items-center gap-2">
                            <div className="w-2 h-5 bg-indigo-500 rounded-full"></div>
                            آخرین فعالیت‌های امانی
                        </h4>
                        <div className="space-y-4 max-h-[500px] overflow-y-auto custom-scrollbar pr-2">
                            {depositTransactions.slice(0, 15).map(t => {
                                const holder = depositHolders.find(h => h.id === t.holderId);
                                return (
                                    <div key={t.id} className="p-4 bg-slate-50/50 rounded-2xl border border-slate-100 hover:bg-white transition-all shadow-sm group">
                                        <div className="flex justify-between items-center mb-2">
                                            <span className="font-black text-slate-700 text-sm">{holder?.name}</span>
                                            <span className={`text-[10px] font-black px-3 py-1 rounded-full ${t.type === 'deposit' ? 'bg-emerald-100 text-emerald-700' : 'bg-orange-100 text-orange-700'}`}>
                                                {t.type === 'deposit' ? 'واریز' : 'برداشت'}
                                            </span>
                                        </div>
                                        <div className="flex justify-between items-end">
                                            <div className="text-right">
                                                <p className="font-black text-indigo-800 text-base" dir="ltr">{t.amount.toLocaleString(undefined, {maximumFractionDigits: 3})} {storeSettings.currencyConfigs[t.currency as 'AFN'|'USD'|'IRT']?.name || t.currency}</p>
                                                {t.description && <p className="text-[10px] text-slate-400 mt-1 italic line-clamp-1">{t.description}</p>}
                                            </div>
                                            <span className="text-[9px] text-slate-300 font-bold">{new Date(t.date).toLocaleDateString('fa-IR')}</span>
                                        </div>
                                    </div>
                                );
                            })}
                            {depositTransactions.length === 0 && (
                                <p className="text-center py-10 text-slate-300 font-bold">تراکنشی ثبت نشده است.</p>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {isAddModalOpen && (
                <Modal title="افتتاح پرونده امانی جدید" onClose={() => setIsAddModalOpen(false)}>
                    <form onSubmit={handleAddHolder} className="space-y-4">
                        <div>
                            <label className="block text-sm font-bold text-indigo-900 mb-2">نام و نام خانوادگی شخص</label>
                            <input name="name" className="w-full p-4 border-2 border-slate-100 rounded-2xl focus:border-indigo-500 outline-none font-bold" placeholder="مثلاً: محمد کریمی" required disabled={isProcessing} />
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-indigo-900 mb-2">شماره تماس (اختیاری)</label>
                            <input name="phone" className="w-full p-4 border-2 border-slate-100 rounded-2xl focus:border-indigo-500 outline-none" placeholder="۰۹..." dir="ltr" disabled={isProcessing} />
                        </div>
                        <button 
                            type="submit" 
                            disabled={isProcessing}
                            className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-black text-lg shadow-xl shadow-indigo-100 active:scale-95 transition-all mt-4 disabled:bg-indigo-300 flex items-center justify-center gap-2"
                        >
                            {isProcessing && <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>}
                            {isProcessing ? 'در حال ایجاد پرونده...' : 'ایجاد پرونده امانی'}
                        </button>
                    </form>
                </Modal>
            )}

            {isTransactionModalOpen && selectedHolder && (
                <Modal title={editingTransaction ? `ویرایش تراکنش: ${selectedHolder.name}` : `${transactionType === 'deposit' ? 'ثبت دریافت وجه / رسید از' : 'ثبت پرداخت وجه / برد به'}: ${selectedHolder.name}`} onClose={() => setIsTransactionModalOpen(false)}>
                    <form onSubmit={handleTransaction} className="space-y-4">
                        <div className="flex gap-4 p-3 bg-blue-50 rounded-xl">
                            {['AFN', 'USD', 'IRT'].map(c => {
                                const label = storeSettings.currencyConfigs[c as 'AFN'|'USD'|'IRT'].name;
                                const color = c === 'USD' ? 'text-green-600' : (c === 'IRT' ? 'text-orange-600' : 'text-blue-600');
                                return (
                                    <label key={c} className="flex items-center gap-2 cursor-pointer">
                                        <input 
                                            type="radio" 
                                            checked={selectedCurrency === c} 
                                            onChange={() => {setSelectedCurrency(c as any); setExchangeRate('1');}} 
                                            className={color} 
                                            disabled={isProcessing}
                                        />
                                        <span className={`text-xs font-bold ${color}`}>{label}</span>
                                    </label>
                                );
                            })}
                        </div>

                        {selectedCurrency !== storeSettings.baseCurrency && (
                            <div className="flex items-center gap-3">
                                <span className="text-xs whitespace-nowrap font-bold text-slate-400">نرخ تبدیل ({storeSettings.currencyConfigs[storeSettings.baseCurrency].name} به {selectedCurrency}):</span>
                                <input 
                                    name="exchangeRate" 
                                    type="text" 
                                    inputMode="decimal" 
                                    value={exchangeRate}
                                    onChange={(e:any) => setExchangeRate(toEnglishDigits(e.target.value).replace(/[^0-9.]/g, ''))} 
                                    className="w-full p-2.5 border border-slate-200 rounded-xl font-mono text-center" 
                                    placeholder="نرخ" 
                                    required 
                                    disabled={isProcessing} 
                                />
                            </div>
                        )}

                        <div className="flex items-center gap-3">
                            <span className="text-xs whitespace-nowrap font-bold text-slate-400">تاریخ تراکنش:</span>
                            <JalaliDateInput value={transactionDate} onChange={setTransactionDate} disableRestriction />
                            <input type="hidden" name="transactionDate" value={transactionDate} />
                        </div>

                        <div className="relative">
                            <input 
                                name="amount" 
                                type="text" 
                                inputMode="decimal" 
                                value={transactionAmount}
                                onChange={(e:any) => setTransactionAmount(toEnglishDigits(e.target.value).replace(/[^0-9.]/g, ''))} 
                                className={`w-full p-4 border border-slate-200 rounded-xl outline-none focus:ring-4 ${transactionType === 'deposit' ? 'focus:ring-emerald-50' : 'focus:ring-red-50'} font-black text-xl text-center`} 
                                placeholder={`${transactionType === 'deposit' ? 'مبلغ دریافتی / رسید' : 'مبلغ پرداختی / برد'} (${selectedCurrency})`}
                                required 
                                disabled={isProcessing} 
                            />
                            {selectedCurrency !== storeSettings.baseCurrency && transactionAmount && !isNaN(Number(transactionAmount)) && !isNaN(Number(exchangeRate)) && Number(exchangeRate) > 0 && (
                                <p className={`text-[10px] font-black mt-1 ${transactionType === 'deposit' ? 'text-emerald-600' : 'text-red-600'} text-left`}>
                                    {transactionType === 'deposit' ? 'معادل دریافتی / رسید' : 'معادل پرداختی / برد'}: {(() => {
                                        const amount = Number(transactionAmount);
                                        const rate = Number(exchangeRate);
                                        const config = storeSettings.currencyConfigs[selectedCurrency];
                                        const baseAmount = config.method === 'multiply' ? amount / rate : amount * rate;
                                        return baseAmount < 1 ? baseAmount.toFixed(4) : baseAmount.toLocaleString(undefined, { maximumFractionDigits: 2 });
                                    })()} {storeSettings.currencyConfigs[storeSettings.baseCurrency].name}
                                </p>
                            )}
                        </div>

                        <input 
                            name="description" 
                            value={transactionDescription}
                            onChange={(e) => setTransactionDescription(e.target.value)}
                            className="w-full p-4 border border-slate-200 rounded-xl outline-none focus:ring-4 focus:ring-indigo-50" 
                            placeholder={transactionType === 'withdrawal' ? "علت برداشت (الزامی)" : "بابت... (اختیاری)"} 
                            required={transactionType === 'withdrawal'} 
                            disabled={isProcessing}
                        />

                        <div className="flex items-center gap-2 p-3 bg-amber-50 rounded-xl border border-amber-100">
                            <input 
                                type="checkbox" 
                                id="isHistoricalDeposit" 
                                checked={isHistorical} 
                                onChange={(e) => setIsHistorical(e.target.checked)}
                                className="w-5 h-5 text-amber-600 rounded"
                                disabled={isProcessing}
                            />
                            <label htmlFor="isHistoricalDeposit" className="text-sm font-bold text-amber-800 cursor-pointer">
                                ثبت به عنوان داده‌های تاریخی (بدون تأثیر بر صندوق)
                            </label>
                        </div>

                        <button 
                            type="submit" 
                            disabled={isProcessing}
                            className={`w-full py-4 rounded-xl font-black text-lg shadow-xl active:scale-[0.98] transition-all mt-4 text-white flex items-center justify-center gap-2 ${transactionType === 'deposit' ? 'bg-emerald-600 shadow-emerald-100 disabled:bg-emerald-300' : 'bg-red-600 shadow-red-100 disabled:bg-red-300'}`}
                        >
                            {isProcessing && <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>}
                            {isProcessing ? 'در حال ثبت...' : (editingTransaction ? 'بروزرسانی تراکنش' : (transactionType === 'deposit' ? 'ثبت نهایی و چاپ رسید' : 'تأیید و ثبت نهایی برداشت'))}
                        </button>
                    </form>
                </Modal>
            )}

            {historyModalHolder && (
                <DepositHistoryModal 
                    holder={historyModalHolder} 
                    transactions={depositTransactions.filter(t => t.holderId === historyModalHolder.id)}
                    onClose={() => setHistoryModalHolder(null)}
                    onEdit={handleOpenEditModal}
                />
            )}
        </div>
    );
};

export default SecurityDeposits;