import React, { useState, useEffect } from 'react';
import { XIcon, CheckIcon, UserGroupIcon, BuildingIcon, ZapIcon } from './icons';
import { Customer, DepositHolder, Company } from '../types';

interface ActivitySettingsModalProps {
    customer: Customer;
    depositHolders: DepositHolder[];
    companies: Company[];
    onClose: () => void;
    onSave: (config: { depositHolderId: string; companyShares: { [companyId: string]: number } }) => Promise<void>;
}

export const ActivitySettingsModal: React.FC<ActivitySettingsModalProps> = ({
    customer,
    depositHolders,
    companies,
    onClose,
    onSave
}) => {
    const [selectedHolderId, setSelectedHolderId] = useState(customer.activityConfig?.depositHolderId || '');
    const [shares, setShares] = useState<{ [companyId: string]: number }>(
        customer.activityConfig?.companyShares || 
        companies.reduce((acc, c) => ({ ...acc, [c.id]: 0 }), {})
    );
    const [isSaving, setIsSaving] = useState(false);

    // Ensure all companies are present in shares
    useEffect(() => {
        const newShares = { ...shares };
        let changed = false;
        companies.forEach(c => {
            if (newShares[c.id] === undefined) {
                newShares[c.id] = 0;
                changed = true;
            }
        });
        if (changed) setShares(newShares);
    }, [companies]);

    const handleSave = async () => {
        if (!selectedHolderId) {
            alert("لطفاً یک شخص امانی را انتخاب کنید.");
            return;
        }
        setIsSaving(true);
        try {
            await onSave({
                depositHolderId: selectedHolderId,
                companyShares: shares
            });
            onClose();
        } catch (error) {
            console.error(error);
            alert("خطا در ذخیره تنظیمات.");
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[200] flex items-center justify-center p-4 modal-animate">
            <div className="bg-white w-full max-w-4xl rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
                <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-amber-50/50">
                    <div className="flex items-center gap-3">
                        <div className="p-3 bg-amber-100 text-amber-600 rounded-2xl">
                            <ZapIcon className="w-6 h-6" />
                        </div>
                        <div>
                            <h2 className="text-xl font-black text-slate-800">تنظیمات اکتیویتی: {customer.name}</h2>
                            <p className="text-xs text-amber-600 font-bold">مدیریت سهم کمپانی‌ها و شخص امانی متصل</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-white rounded-xl transition-colors">
                        <XIcon className="w-6 h-6 text-slate-400" />
                    </button>
                </div>

                <div className="flex-1 overflow-hidden flex flex-col md:flex-row">
                    {/* Right Side: Deposit Holders */}
                    <div className="w-full md:w-1/3 border-l border-slate-100 p-6 overflow-y-auto bg-slate-50/30">
                        <h3 className="text-sm font-black text-slate-500 mb-4 flex items-center gap-2">
                            <UserGroupIcon className="w-4 h-4" />
                            انتخاب شخص امانی
                        </h3>
                        <div className="space-y-2">
                            {depositHolders.length === 0 ? (
                                <p className="text-xs text-slate-400 text-center py-8">هیچ شخص امانی واجد شرایطی یافت نشد.</p>
                            ) : (
                                depositHolders.map(holder => (
                                    <button
                                        key={holder.id}
                                        onClick={() => setSelectedHolderId(holder.id)}
                                        className={`w-full p-4 rounded-2xl border-2 transition-all flex items-center justify-between ${
                                            selectedHolderId === holder.id 
                                            ? 'border-amber-500 bg-amber-50 text-amber-700 shadow-md' 
                                            : 'border-white bg-white text-slate-600 hover:border-slate-200'
                                        }`}
                                    >
                                        <span className="font-bold text-sm">{holder.name}</span>
                                        {selectedHolderId === holder.id && <CheckIcon className="w-5 h-5" />}
                                    </button>
                                ))
                            )}
                        </div>
                    </div>

                    {/* Left Side: Companies & Shares */}
                    <div className="flex-1 p-6 overflow-y-auto">
                        <h3 className="text-sm font-black text-slate-500 mb-4 flex items-center gap-2">
                            <BuildingIcon className="w-4 h-4" />
                            تعیین درصد سهم از هر کمپانی
                        </h3>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            {companies.map(company => (
                                <div key={company.id} className="p-4 bg-white border border-slate-100 rounded-2xl shadow-sm space-y-3">
                                    <div className="flex justify-between items-center">
                                        <span className="font-bold text-slate-700 text-sm">{company.name}</span>
                                        <span className="text-[10px] font-black text-amber-600 bg-amber-50 px-2 py-1 rounded-lg">درصد سهم</span>
                                    </div>
                                    <div className="relative">
                                        <input
                                            type="number"
                                            min="0"
                                            max="100"
                                            value={shares[company.id] || 0}
                                            onChange={e => setShares({ ...shares, [company.id]: Number(e.target.value) })}
                                            className="w-full p-3 pr-10 border border-slate-200 rounded-xl outline-none focus:ring-4 focus:ring-amber-50 font-bold text-center"
                                        />
                                        <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">%</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                <div className="p-6 border-t border-slate-100 bg-slate-50 flex justify-end gap-3">
                    <button
                        onClick={onClose}
                        className="px-6 py-3 rounded-xl font-bold text-slate-500 hover:bg-white transition-all"
                    >
                        انصراف
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={isSaving}
                        className="px-8 py-3 bg-amber-500 text-white rounded-xl font-black shadow-lg shadow-amber-100 hover:bg-amber-600 transition-all disabled:opacity-50 flex items-center gap-2"
                    >
                        {isSaving ? 'در حال ذخیره...' : 'ذخیره تنظیمات اکتیویتی'}
                        {!isSaving && <CheckIcon className="w-5 h-5" />}
                    </button>
                </div>
            </div>
        </div>
    );
};
