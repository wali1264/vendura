
import React, { useState, useEffect, useRef, useMemo } from 'react';
import type { SaleInvoice, StoreSettings, CartItem, InvoiceItem, Customer } from '../types';
import { XIcon, EditIcon, CheckIcon } from './icons';
import { useAppContext } from '../AppContext';
import { numberToPersianWords } from '../utils/formatters';

interface PrintPreviewModalProps {
    invoice: SaleInvoice;
    onClose: () => void;
}

const PrintPreviewModal: React.FC<PrintPreviewModalProps> = ({ invoice, onClose }) => {
    const { storeSettings, customers, suppliers, setInvoiceTransientCustomer } = useAppContext();
    const [customCustomerName, setCustomCustomerName] = useState('');
    const [isEditingName, setIsEditingName] = useState(false);
    const [showBalances, setShowBalances] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);

    const customer = useMemo(() => {
        if (invoice.customerId) return customers.find(c => c.id === invoice.customerId);
        if (invoice.supplierIntermediaryId) return suppliers.find(s => s.id === invoice.supplierIntermediaryId);
        return null;
    }, [invoice.customerId, invoice.supplierIntermediaryId, customers, suppliers]);

    const prevBalances = useMemo(() => {
        if (!customer || !('balanceAFN' in customer)) return { AFN: 0, USD: 0, IRT: 0 };
        
        const isSale = invoice.type === 'sale';
        const multiplier = isSale ? 1 : -1;
        
        const prev = {
            AFN: (customer as Customer).balanceAFN,
            USD: (customer as Customer).balanceUSD,
            IRT: (customer as Customer).balanceIRT
        };

        if (invoice.currency === 'USD') prev.USD -= (invoice.totalAmount * multiplier);
        else if (invoice.currency === 'IRT') prev.IRT -= (invoice.totalAmount * multiplier);
        else prev.AFN -= (invoice.totalAmount * multiplier);

        return prev;
    }, [customer, invoice]);

    useEffect(() => {
        if (customer) {
            setCustomCustomerName(customer.name);
        } else if (invoice.supplierIntermediaryId) {
            const s = suppliers.find(sup => sup.id === invoice.supplierIntermediaryId);
            if (s) setCustomCustomerName(s.name);
        } else if (invoice.type === 'sale') {
            setCustomCustomerName(invoice.originalInvoiceId || '');
        }
    }, [customer, invoice, suppliers]);

    useEffect(() => {
        if (isEditingName && inputRef.current) {
            inputRef.current.focus();
        }
    }, [isEditingName]);

    const saveCustomerName = async () => {
        if (!invoice.customerId && invoice.type === 'sale') {
            const nameToSave = customCustomerName.trim();
            const currentSavedName = invoice.originalInvoiceId || '';
            if (nameToSave !== currentSavedName) {
                await setInvoiceTransientCustomer(invoice.id, nameToSave);
            }
        }
    };

    const handlePrint = async () => {
        setIsEditingName(false);
        await saveCustomerName();
        setTimeout(() => {
            window.print();
        }, 100);
    };

    const handleClose = async () => {
        setIsEditingName(false);
        await saveCustomerName();
        onClose();
    };
    
    const currencySuffix = invoice.currency === 'USD' ? '$' : (invoice.currency === 'IRT' ? 'تومان' : storeSettings.currencyName);

    const getItemDetails = (item: CartItem) => {
        const isService = item.type === 'service';
        let itemsPerPack = !isService && (item as InvoiceItem).itemsPerPackage ? (item as InvoiceItem).itemsPerPackage! : 1;
        if (itemsPerPack < 1) itemsPerPack = 1;
        const totalQty = item.quantity;
        
        let pkgCount = 0, unitCount = 0;
        if (itemsPerPack === 1 || isService) {
            unitCount = totalQty;
        } else {
            pkgCount = Math.floor(totalQty / itemsPerPack);
            unitCount = totalQty % itemsPerPack;
        }

        const rate = invoice.exchangeRate || 1;
        const currency = invoice.currency;

        const baseCurrency = storeSettings.baseCurrency;
        const currencyConfig = storeSettings.currencyConfigs[invoice.currency];
        let priceBase = (item.finalPrice !== undefined) ? item.finalPrice : (item.type === 'product' ? item.salePrice : item.price);
        
        let unitPriceDisplay = 0;
        if (invoice.currency === baseCurrency) {
            unitPriceDisplay = priceBase;
        } else if (currencyConfig) {
            unitPriceDisplay = currencyConfig.method === 'multiply' ? priceBase * rate : priceBase / rate;
        } else {
            unitPriceDisplay = priceBase;
        }

        return {
            isService, itemsPerPackage: itemsPerPack, pkgCount, unitCount, 
            unitPrice: unitPriceDisplay,
            pkgPrice: unitPriceDisplay * itemsPerPack,
            totalPrice: unitPriceDisplay * totalQty
        };
    };

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white p-4 md:p-6 print:p-0 rounded-lg shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col">
                <div className="printable-area text-gray-900 flex-grow flex flex-col min-h-0">
                    <div className="text-center mb-2 pb-2 print:mb-6 print:pb-4 border-b">
                        <h1 className="text-xl print:text-3xl font-extrabold text-blue-600">{storeSettings.storeName}</h1>
                        <p className="text-xs print:text-sm text-slate-500">{storeSettings.address}</p>
                        <p className="text-xs print:text-sm text-slate-500">تلفن: {storeSettings.phone}</p>
                        <p className="text-sm print:text-lg text-slate-800 mt-1 print:mt-2 font-bold bg-slate-100 inline-block px-4 py-1 rounded-full border">فاکتور فروش</p>
                    </div>
                    
                    <div className="flex flex-wrap justify-between gap-2 text-xs print:text-[10px] mb-2 print:mb-4 bg-slate-50 p-2 print:p-2 rounded-lg border">
                        <div className="space-y-0.5 print:space-y-1 w-full md:w-1/2">
                            <div className="text-sm print:text-md border-b border-slate-300 pb-1 mb-1 flex items-center flex-wrap gap-2 min-h-[24px] print:min-h-[30px]">
                                <strong>نام مشتری:</strong> 
                                {isEditingName ? (
                                    <input 
                                        ref={inputRef}
                                        value={customCustomerName}
                                        onChange={(e) => setCustomCustomerName(e.target.value)}
                                        className="border-b-2 border-blue-500 outline-none px-2 py-1 text-blue-800 font-bold bg-blue-50 rounded flex-grow max-w-[200px]"
                                        placeholder="نام مشتری..."
                                    />
                                ) : (
                                    <span className="font-bold text-base print:text-lg text-blue-800">{customCustomerName || 'مشتری گذری'}</span>
                                )}
                            </div>
                            <p><strong>شماره فاکتور:</strong> <span className="font-mono font-bold">{invoice.id}</span></p>
                        </div>
                        <div className="text-left space-y-0.5 print:space-y-1 w-full md:w-auto">
                            <p><strong>تاریخ:</strong> {new Date(invoice.timestamp).toLocaleDateString('fa-IR')}</p>
                            <p><strong>ارز معامله:</strong> <span className="font-bold">{invoice.currency}</span></p>
                        </div>
                    </div>

                    <div className="flex-grow overflow-y-auto border-t border-b min-h-0">
                        <table className="min-w-full text-xs print:text-sm border-collapse">
                            <thead className="bg-slate-100 sticky top-0">
                                <tr>
                                    <th rowSpan={2} className="p-1 print:p-2 text-center font-bold border border-slate-400 w-6 print:hidden">#</th>
                                    <th rowSpan={2} className="p-1 print:p-2 text-right font-bold border border-slate-400 print:w-[50%]">شرح کالا</th>
                                    <th colSpan={2} className="p-1 print:p-2 text-center font-bold border border-slate-400 bg-blue-50 text-blue-900">تعداد</th>
                                    <th colSpan={2} className="p-1 print:p-2 text-center font-bold border border-slate-400">قیمت (فی - {invoice.currency})</th>
                                    <th rowSpan={2} className="p-1 print:p-2 text-center font-bold border border-slate-400 w-16">قیمت کل</th>
                                </tr>
                                <tr>
                                    <th className="p-1 text-center font-bold border border-slate-400 bg-blue-50">{storeSettings.packageLabel || 'بسته'}</th>
                                    <th className="p-1 text-center font-bold border border-slate-400 bg-blue-50">{storeSettings.unitLabel || 'عدد'}</th>
                                    <th className="p-1 text-center font-bold border border-slate-400">فی {storeSettings.packageLabel || 'بسته'}</th>
                                    <th className="p-1 text-center font-bold border border-slate-400">فی {storeSettings.unitLabel || 'عدد'}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {invoice.items.map((item, index) => {
                                    const details = getItemDetails(item);
                                    return (
                                        <tr key={`${item.id}-${item.type}`} className="border-b border-slate-300">
                                            <td className="p-1 print:p-2 text-center border border-slate-300 font-mono text-slate-500 print:hidden">{index + 1}</td>
                                            <td className="p-1 print:p-2 text-right border border-slate-300">
                                                <p className="font-semibold text-slate-800 print:text-[8px] print:leading-none print:whitespace-nowrap">{item.name}</p>
                                            </td>
                                            <td className="p-1 print:p-2 text-center border border-slate-300 font-bold bg-blue-50/30">{details.pkgCount > 0 ? details.pkgCount.toLocaleString('fa-IR') : '-'}</td>
                                            <td className="p-1 print:p-2 text-center border border-slate-300 font-bold bg-blue-50/30">{details.unitCount > 0 ? details.unitCount.toLocaleString('fa-IR') : '-'}</td>
                                            <td className="p-1 print:p-2 text-center border border-slate-300" dir="ltr">{details.pkgCount > 0 ? details.pkgPrice.toLocaleString('fa-IR', { maximumFractionDigits: 3 }) : '-'}</td>
                                            <td className="p-1 print:p-2 text-center border border-slate-300" dir="ltr">{details.unitCount > 0 ? details.unitPrice.toLocaleString('fa-IR', { maximumFractionDigits: 3 }) : '-'}</td>
                                            <td className="p-1 print:p-2 text-center border border-slate-300 font-bold text-slate-800" dir="ltr">{details.totalPrice.toLocaleString('fa-IR', { maximumFractionDigits: 3 })}</td>
                                        </tr>
                                    )
                                })}
                            </tbody>
                        </table>
                    </div>

                    <div className="mt-2 pt-2 print:mt-4 flex justify-between items-start border-t border-black">
                        <div className="w-1/2 space-y-1 text-right">
                            {showBalances && customer && 'balanceAFN' in customer && (
                                <div className="text-[10px] print:text-[8px] space-y-0.5 bg-slate-50 p-2 rounded border border-slate-200">
                                    <p className="font-bold border-b border-slate-300 pb-0.5 mb-1 text-slate-700">وضعیت حساب قبلی مشتری:</p>
                                    
                                    <div className="flex justify-between gap-4">
                                        <span className="text-slate-600">{storeSettings.currencyConfigs['AFN']?.name || 'افغانی'}:</span>
                                        <span className={`font-bold ${prevBalances.AFN > 0 ? 'text-red-600' : prevBalances.AFN < 0 ? 'text-green-600' : 'text-slate-500'}`}>
                                            {Math.abs(prevBalances.AFN).toLocaleString('fa-IR')} {prevBalances.AFN > 0 ? 'بدهکار' : prevBalances.AFN < 0 ? 'طلبکار' : 'تسویه'}
                                        </span>
                                    </div>
                                    
                                    <div className="flex justify-between gap-4">
                                        <span className="text-slate-600">{storeSettings.currencyConfigs['USD']?.name || 'دلار'}:</span>
                                        <span className={`font-bold ${prevBalances.USD > 0 ? 'text-red-600' : prevBalances.USD < 0 ? 'text-green-600' : 'text-slate-500'}`}>
                                            {Math.abs(prevBalances.USD).toLocaleString('fa-IR')} {prevBalances.USD > 0 ? 'بدهکار' : prevBalances.USD < 0 ? 'طلبکار' : 'تسویه'}
                                        </span>
                                    </div>
                                    
                                    <div className="flex justify-between gap-4">
                                        <span className="text-slate-600">{storeSettings.currencyConfigs['IRT']?.name || 'تومان'}:</span>
                                        <span className={`font-bold ${prevBalances.IRT > 0 ? 'text-red-600' : prevBalances.IRT < 0 ? 'text-green-600' : 'text-slate-500'}`}>
                                            {Math.abs(prevBalances.IRT).toLocaleString('fa-IR')} {prevBalances.IRT > 0 ? 'بدهکار' : prevBalances.IRT < 0 ? 'طلبکار' : 'تسویه'}
                                        </span>
                                    </div>
                                </div>
                            )}
                        </div>
                        <div className="w-1/2 flex flex-col items-center justify-center text-center px-2">
                            <div className="flex items-center justify-center gap-2 text-lg print:text-xl font-bold text-slate-900">
                                <span className="text-sm print:text-xs font-black">مبلغ نهایی:</span>
                                <span className="text-blue-700 font-black" dir="ltr">({invoice.totalAmount.toLocaleString('fa-IR', { maximumFractionDigits: 3 })} {currencySuffix})</span>
                            </div>
                            <div className="text-[10px] print:text-[9px] text-slate-500 font-bold mt-1 border-t border-slate-100 pt-1 w-full line-clamp-2 leading-tight">
                                مبلغ به حروف: {numberToPersianWords(invoice.totalAmount)} {currencySuffix}
                            </div>
                        </div>
                    </div>
                </div>
                <div className="flex justify-between items-center mt-4 print:hidden pt-2 border-t no-print">
                    <button onClick={() => setIsEditingName(true)} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-yellow-100 text-yellow-800 font-semibold text-xs hover:bg-yellow-200 transition-colors">
                        <EditIcon className="w-4 h-4" />
                        <span>ویرایش نام مشتری</span>
                    </button>
                    
                    <div className="flex items-center gap-3">
                        {customer && 'balanceAFN' in customer && (
                            <label className="flex items-center gap-2 cursor-pointer bg-slate-100 px-3 py-2 rounded-lg hover:bg-slate-200 transition-colors border border-slate-200">
                                <input 
                                    type="checkbox" 
                                    checked={showBalances} 
                                    onChange={(e) => setShowBalances(e.target.checked)}
                                    className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 cursor-pointer"
                                />
                                <span className="text-xs font-bold text-slate-700">نمایش مانده قبلی</span>
                            </label>
                        )}
                        <div className="flex space-x-3 space-x-reverse">
                            <button onClick={handleClose} className="px-6 py-3 rounded-lg bg-gray-200 font-semibold hover:bg-gray-300 transition-colors">بستن</button>
                            <button onClick={handlePrint} className="px-6 py-3 rounded-lg bg-blue-600 text-white shadow-lg btn-primary font-semibold hover:bg-blue-700 transition-colors">چاپ نهایی</button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default PrintPreviewModal;
