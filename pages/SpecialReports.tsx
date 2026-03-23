import React, { useState, useMemo } from 'react';
import { useAppContext } from '../AppContext';
import { 
    FilterIcon, 
    DownloadIcon, 
    InventoryIcon, 
    POSIcon, 
    PurchaseIcon, 
    AccountingIcon,
    BuildingIcon,
    ZapIcon,
    SearchIcon,
    XIcon
} from '../components/icons';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';
import html2canvas from 'html2canvas';

// Extend jsPDF type for autotable
declare module 'jspdf' {
    interface jsPDF {
        autoTable: (options: any) => jsPDF;
    }
}

type ReportFormat = 'excel' | 'pdf' | 'txt';

interface ReportCategory {
    id: string;
    label: string;
    icon: React.ReactNode;
    reports: {
        id: string;
        label: string;
        description: string;
    }[];
}

const SpecialReports: React.FC = () => {
    const { 
        products, 
        saleInvoices, 
        purchaseInvoices, 
        customers, 
        suppliers, 
        expenses, 
        companies, 
        wastageRecords,
        storeSettings
    } = useAppContext();

    const [selectedCategoryId, setSelectedCategoryId] = useState('inventory');
    const [selectedReportId, setSelectedReportId] = useState('total_inventory');
    const [format, setFormat] = useState<ReportFormat>('excel');
    
    // Filters
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [selectedCompanyId, setSelectedCompanyId] = useState('');
    const [selectedProductId, setSelectedProductId] = useState('');
    const [selectedCustomerId, setSelectedCustomerId] = useState('');
    const [selectedSupplierId, setSelectedSupplierId] = useState('');

    const categories: ReportCategory[] = [
        {
            id: 'inventory',
            label: 'انبار و موجودی',
            icon: <InventoryIcon className="w-5 h-5" />,
            reports: [
                { id: 'total_inventory', label: 'موجودی کل انبار', description: 'لیست تمام کالاها با موجودی فعلی و ارزش ریالی' },
                { id: 'company_inventory', label: 'موجودی به تفکیک کمپانی', description: 'مشاهده موجودی محصولات متعلق به یک شرکت خاص' },
                { id: 'expiry_report', label: 'گزارش انقضا', description: 'کالاهایی که تاریخ انقضای آن‌ها نزدیک است' },
                { id: 'product_flow', label: 'ردیابی کالا (ورود و خروج)', description: 'تاریخچه کامل تراکنش‌های یک کالای خاص' },
            ]
        },
        {
            id: 'sales',
            label: 'فروش و مشتریان',
            icon: <POSIcon className="w-5 h-5" />,
            reports: [
                { id: 'sales_by_customer', label: 'فروش به تفکیک مشتری', description: 'چه کالاهایی به کدام مشتریان فروخته شده است' },
                { id: 'customer_balances', label: 'صورت‌حساب جامع مشتریان', description: 'لیست مانده حساب تمام مشتریان' },
                { id: 'wastage_report', label: 'گزارش ضایعات', description: 'کالاهای ضایع شده به تفکیک علت و شرکت' },
            ]
        },
        {
            id: 'purchases',
            label: 'خرید و تأمین‌کنندگان',
            icon: <PurchaseIcon className="w-5 h-5" />,
            reports: [
                { id: 'supplier_balances', label: 'صورت‌حساب جامع تأمین‌کنندگان', description: 'میزان بدهی و بستانکاری به شرکت‌ها' },
                { id: 'purchase_history', label: 'تاریخچه خرید از کمپانی', description: 'لیست فاکتورهای خرید از یک شرکت خاص' },
            ]
        },
        {
            id: 'financial',
            label: 'مالی و هزینه‌ها',
            icon: <AccountingIcon className="w-5 h-5" />,
            reports: [
                { id: 'expense_summary', label: 'گزارش جامع هزینه‌ها', description: 'هزینه‌های جاری به تفکیک دسته و شرکت' },
            ]
        }
    ];

    const activeCategory = categories.find(c => c.id === selectedCategoryId);
    const activeReport = activeCategory?.reports.find(r => r.id === selectedReportId);

    const generateReportData = () => {
        let data: any[] = [];
        let headers: string[] = [];
        let title = activeReport?.label || 'گزارش';

        switch (selectedReportId) {
            case 'total_inventory':
                headers = ['نام کالا', 'کمپانی', 'موجودی کل', 'قیمت فروش', 'ارزش کل (فروش)'];
                data = products.map(p => {
                    const company = companies.find(c => c.id === p.companyId)?.name || 'نامشخص';
                    const totalStock = p.batches.reduce((sum, b) => sum + b.stock, 0);
                    return [
                        p.name,
                        company,
                        totalStock,
                        p.salePrice.toLocaleString(),
                        (totalStock * p.salePrice).toLocaleString()
                    ];
                });
                break;

            case 'company_inventory':
                if (!selectedCompanyId) return { data: [], headers: [], title: 'لطفاً کمپانی را انتخاب کنید' };
                const companyName = companies.find(c => c.id === selectedCompanyId)?.name || '';
                title = `موجودی کمپانی ${companyName}`;
                headers = ['نام کالا', 'موجودی', 'قیمت فروش'];
                data = products
                    .filter(p => p.companyId === selectedCompanyId)
                    .map(p => [
                        p.name,
                        p.batches.reduce((sum, b) => sum + b.stock, 0),
                        p.salePrice.toLocaleString()
                    ]);
                break;

            case 'expiry_report':
                headers = ['نام کالا', 'سری ساخت', 'موجودی', 'تاریخ انقضا'];
                data = products.flatMap(p => 
                    p.batches
                        .filter(b => b.expiryDate)
                        .map(b => [
                            p.name,
                            b.lotNumber,
                            b.stock,
                            b.expiryDate
                        ])
                ).sort((a, b) => (a[3] as string).localeCompare(b[3] as string));
                break;

            case 'product_flow':
                if (!selectedProductId) return { data: [], headers: [], title: 'لطفاً کالا را انتخاب کنید' };
                const prod = products.find(p => p.id === selectedProductId);
                title = `ردیابی کالا: ${prod?.name}`;
                headers = ['تاریخ', 'نوع تراکنش', 'تعداد', 'جزئیات'];
                
                // Sales
                const sales = saleInvoices.flatMap(inv => 
                    inv.items
                        .filter(item => item.id === selectedProductId)
                        .map(item => [
                            inv.timestamp.split('T')[0],
                            inv.type === 'sale' ? 'فروش' : 'مرجوعی فروش',
                            item.quantity,
                            `فاکتور #${inv.id.slice(-6)}`
                        ])
                );

                // Purchases
                const purchases = purchaseInvoices.flatMap(inv => 
                    inv.items
                        .filter(item => item.productId === selectedProductId)
                        .map(item => [
                            inv.timestamp.split('T')[0],
                            inv.type === 'purchase' ? 'خرید' : 'مرجوعی خرید',
                            item.quantity,
                            `فاکتور #${inv.invoiceNumber}`
                        ])
                );

                data = [...sales, ...purchases].sort((a, b) => (b[0] as string).localeCompare(a[0] as string));
                break;

            case 'sales_by_customer':
                headers = ['تاریخ', 'مشتری', 'نام کالا', 'تعداد', 'قیمت واحد', 'جمع کل'];
                let filteredSales = saleInvoices;
                if (startDate) filteredSales = filteredSales.filter(inv => inv.timestamp.split('T')[0] >= startDate);
                if (endDate) filteredSales = filteredSales.filter(inv => inv.timestamp.split('T')[0] <= endDate);
                if (selectedCustomerId) filteredSales = filteredSales.filter(inv => inv.customerId === selectedCustomerId);

                data = filteredSales.flatMap(inv => {
                    const customerName = customers.find(c => c.id === inv.customerId)?.name || 'مشتری گذری';
                    return inv.items.map(item => {
                        const price = item.type === 'product' ? item.salePrice : item.price;
                        const finalPrice = item.finalPrice || price;
                        return [
                            inv.timestamp.split('T')[0],
                            customerName,
                            item.name,
                            item.quantity,
                            finalPrice.toLocaleString(),
                            (finalPrice * item.quantity).toLocaleString()
                        ];
                    });
                });
                break;

            case 'purchase_history':
                headers = ['تاریخ', 'شماره فاکتور', 'نام کالا', 'تعداد', 'قیمت خرید', 'جمع کل'];
                let filteredPurchases = purchaseInvoices;
                if (startDate) filteredPurchases = filteredPurchases.filter(inv => inv.timestamp.split('T')[0] >= startDate);
                if (endDate) filteredPurchases = filteredPurchases.filter(inv => inv.timestamp.split('T')[0] <= endDate);
                if (selectedSupplierId) filteredPurchases = filteredPurchases.filter(inv => inv.supplierId === selectedSupplierId);

                data = filteredPurchases.flatMap(inv => {
                    return inv.items.map(item => [
                        inv.timestamp.split('T')[0],
                        inv.invoiceNumber,
                        item.productName,
                        item.quantity,
                        item.purchasePrice.toLocaleString(),
                        (item.purchasePrice * item.quantity).toLocaleString()
                    ]);
                });
                break;

            case 'customer_balances':
                headers = ['نام مشتری', 'تلفن', 'مانده (AFN)', 'مانده (USD)', 'مانده (IRT)'];
                data = customers.map(c => [
                    c.name,
                    c.phone || '-',
                    c.balanceAFN.toLocaleString(),
                    c.balanceUSD.toLocaleString(),
                    c.balanceIRT.toLocaleString()
                ]);
                break;

            case 'supplier_balances':
                headers = ['نام تأمین‌کننده', 'شرکت', 'مانده (AFN)', 'مانده (USD)', 'مانده (IRT)'];
                data = suppliers.map(s => [
                    s.name,
                    s.contactPerson || '-',
                    s.balanceAFN.toLocaleString(),
                    s.balanceUSD.toLocaleString(),
                    s.balanceIRT.toLocaleString()
                ]);
                break;

            case 'expense_summary':
                headers = ['تاریخ', 'دسته', 'شرح', 'مبلغ', 'ارز'];
                let filteredExpenses = expenses;
                if (startDate) filteredExpenses = filteredExpenses.filter(e => e.date >= startDate);
                if (endDate) filteredExpenses = filteredExpenses.filter(e => e.date <= endDate);
                if (selectedCompanyId) filteredExpenses = filteredExpenses.filter(e => e.companyId === selectedCompanyId);
                
                data = filteredExpenses.map(e => [
                    e.date,
                    e.category,
                    e.description,
                    e.amount.toLocaleString(),
                    e.currency
                ]);
                break;

            case 'wastage_report':
                headers = ['تاریخ', 'نام کالا', 'تعداد', 'ارزش (خرید)', 'علت'];
                let filteredWastage = wastageRecords;
                if (startDate) filteredWastage = filteredWastage.filter(w => w.timestamp.split('T')[0] >= startDate);
                if (endDate) filteredWastage = filteredWastage.filter(w => w.timestamp.split('T')[0] <= endDate);
                
                data = filteredWastage.map(w => [
                    w.timestamp.split('T')[0],
                    w.productName,
                    w.quantity,
                    w.totalCost.toLocaleString(),
                    w.reason
                ]);
                break;

            default:
                headers = ['دیتا'];
                data = [['گزارش انتخاب نشده است']];
        }

        return { data, headers, title };
    };

    const handleDownload = async () => {
        const { data, headers, title } = generateReportData();
        if (data.length === 0) return;

        const fileName = `${title}_${new Date().toISOString().split('T')[0]}`;

        if (format === 'excel') {
            const ws = XLSX.utils.aoa_to_sheet([headers, ...data]);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, "Report");
            XLSX.writeFile(wb, `${fileName}.xlsx`);
        } else if (format === 'pdf') {
            // Create a temporary hidden container for rendering the report
            const tempDiv = document.createElement('div');
            tempDiv.style.position = 'absolute';
            tempDiv.style.left = '-9999px';
            tempDiv.style.top = '0';
            tempDiv.dir = 'rtl';
            tempDiv.style.fontFamily = 'Vazirmatn, sans-serif';
            tempDiv.style.padding = '40px';
            tempDiv.style.backgroundColor = 'white';
            tempDiv.style.width = '1000px'; 
            
            // Build the table structure for PDF
            tempDiv.innerHTML = `
                <div style="text-align: center; margin-bottom: 40px; direction: rtl; width: 100%;">
                    <div style="font-size: 28px; font-weight: 900; color: #1e293b; margin-bottom: 15px; letter-spacing: 0;">
                        ${title}
                    </div>
                    <div style="font-size: 16px; color: #64748b; letter-spacing: 0;">
                        تاریخ گزارش: ${new Date().toLocaleDateString('fa-IR')}
                    </div>
                </div>
                <table style="width: 100%; border-collapse: collapse; text-align: right; font-size: 12px; direction: rtl;">
                    <thead style="background-color: #f8fafc;">
                        <tr>
                            ${headers.map(h => `<th style="border: 1px solid #e2e8f0; padding: 12px; font-weight: bold; color: #475569; letter-spacing: 0;">${h}</th>`).join('')}
                        </tr>
                    </thead>
                    <tbody>
                        ${data.map(row => `
                            <tr>
                                ${row.map(cell => `<td style="border: 1px solid #e2e8f0; padding: 10px; color: #334155; letter-spacing: 0;">${cell}</td>`).join('')}
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
                <div style="margin-top: 40px; text-align: left; font-size: 11px; color: #94a3b8; direction: ltr;">
                    Generated by Vendura Smart Management System
                </div>
            `;
            
            document.body.appendChild(tempDiv);
            
            try {
                // Ensure fonts are loaded before capturing
                await document.fonts.ready;

                // Convert container to image and then place in PDF
                const canvas = await html2canvas(tempDiv, { 
                    scale: 2,
                    useCORS: true,
                    logging: false,
                    backgroundColor: '#ffffff'
                });
                
                const imgData = canvas.toDataURL('image/png');
                const pdf = new jsPDF('p', 'mm', 'a4');
                const pdfWidth = pdf.internal.pageSize.getWidth();
                const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
                
                // If the content is longer than one page, we might need to handle pagination
                // For now, we'll scale it to fit or handle simple multi-page if needed
                // But for most reports, a single long image in PDF is a good start or we can split it
                
                pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
                pdf.save(`${fileName}.pdf`);
            } catch (error) {
                console.error('Error generating PDF:', error);
            } finally {
                document.body.removeChild(tempDiv);
            }
        } else if (format === 'txt') {
            const content = [
                title,
                '='.repeat(title.length * 2),
                headers.join('\t'),
                '-'.repeat(headers.join('\t').length),
                ...data.map(row => row.join('\t'))
            ].join('\n');
            const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `${fileName}.txt`;
            link.click();
        }
    };

    return (
        <div className="p-4 md:p-6 bg-slate-50 min-h-full">
            <div className="max-w-7xl mx-auto">
                <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
                    <div>
                        <h1 className="text-3xl font-black text-slate-800 flex items-center gap-3">
                            <ZapIcon className="w-8 h-8 text-amber-500" />
                            دانلود گزارشات
                        </h1>
                        <p className="text-slate-500 mt-1">تحلیل دقیق و خروجی هوشمند از تمام بخش‌های سیستم</p>
                    </div>

                    <div className="flex items-center gap-3 bg-white p-2 rounded-2xl shadow-sm border border-slate-200">
                        <select 
                            value={format} 
                            onChange={(e) => setFormat(e.target.value as ReportFormat)}
                            className="bg-transparent border-none focus:ring-0 font-bold text-slate-700 cursor-pointer"
                        >
                            <option value="excel">Excel (اکسل)</option>
                            <option value="pdf">PDF (پی‌دی‌اف)</option>
                            <option value="txt">Text (متنی)</option>
                        </select>
                        <button 
                            onClick={handleDownload}
                            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-xl font-bold flex items-center gap-2 transition-all shadow-lg shadow-blue-500/20 active:scale-95"
                        >
                            <DownloadIcon className="w-5 h-5" />
                            دریافت گزارش
                        </button>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                    {/* Sidebar: Categories */}
                    <div className="lg:col-span-1 space-y-4">
                        <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
                            <div className="p-4 bg-slate-50 border-b border-slate-200">
                                <h2 className="font-bold text-slate-800 flex items-center gap-2">
                                    <FilterIcon className="w-4 h-4" />
                                    دسته‌بندی گزارش‌ها
                                </h2>
                            </div>
                            <div className="p-2">
                                {categories.map(cat => (
                                    <button
                                        key={cat.id}
                                        onClick={() => {
                                            setSelectedCategoryId(cat.id);
                                            setSelectedReportId(cat.reports[0].id);
                                        }}
                                        className={`w-full flex items-center gap-3 p-3 rounded-2xl transition-all mb-1 ${
                                            selectedCategoryId === cat.id 
                                            ? 'bg-blue-50 text-blue-700 font-bold' 
                                            : 'text-slate-600 hover:bg-slate-50'
                                        }`}
                                    >
                                        <div className={`p-2 rounded-xl ${selectedCategoryId === cat.id ? 'bg-blue-600 text-white' : 'bg-slate-100'}`}>
                                            {cat.icon}
                                        </div>
                                        {cat.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Filters Panel */}
                        <div className="bg-white rounded-3xl shadow-sm border border-slate-200 p-5 space-y-4">
                            <h3 className="font-bold text-slate-800 border-b pb-2 mb-4">فیلترهای گزارش</h3>
                            
                            <div className="space-y-3">
                                <div>
                                    <label className="text-xs font-bold text-slate-400 block mb-1">از تاریخ</label>
                                    <input 
                                        type="date" 
                                        value={startDate}
                                        onChange={(e) => setStartDate(e.target.value)}
                                        className="w-full bg-slate-50 border-slate-200 rounded-xl text-sm focus:ring-blue-500"
                                    />
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-slate-400 block mb-1">تا تاریخ</label>
                                    <input 
                                        type="date" 
                                        value={endDate}
                                        onChange={(e) => setEndDate(e.target.value)}
                                        className="w-full bg-slate-50 border-slate-200 rounded-xl text-sm focus:ring-blue-500"
                                    />
                                </div>

                                {selectedReportId.includes('company') || selectedReportId === 'expense_summary' ? (
                                    <div>
                                        <label className="text-xs font-bold text-slate-400 block mb-1">انتخاب کمپانی</label>
                                        <select 
                                            value={selectedCompanyId}
                                            onChange={(e) => setSelectedCompanyId(e.target.value)}
                                            className="w-full bg-slate-50 border-slate-200 rounded-xl text-sm focus:ring-blue-500"
                                        >
                                            <option value="">همه کمپانی‌ها</option>
                                            {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                        </select>
                                    </div>
                                ) : null}

                                {selectedReportId === 'product_flow' ? (
                                    <div>
                                        <label className="text-xs font-bold text-slate-400 block mb-1">انتخاب کالا</label>
                                        <select 
                                            value={selectedProductId}
                                            onChange={(e) => setSelectedProductId(e.target.value)}
                                            className="w-full bg-slate-50 border-slate-200 rounded-xl text-sm focus:ring-blue-500"
                                        >
                                            <option value="">انتخاب کنید...</option>
                                            {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                                        </select>
                                    </div>
                                ) : null}
                                {selectedReportId === 'sales_by_customer' ? (
                                    <div>
                                        <label className="text-xs font-bold text-slate-400 block mb-1">انتخاب مشتری</label>
                                        <select 
                                            value={selectedCustomerId}
                                            onChange={(e) => setSelectedCustomerId(e.target.value)}
                                            className="w-full bg-slate-50 border-slate-200 rounded-xl text-sm focus:ring-blue-500"
                                        >
                                            <option value="">همه مشتریان</option>
                                            {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                        </select>
                                    </div>
                                ) : null}

                                {selectedReportId === 'purchase_history' ? (
                                    <div>
                                        <label className="text-xs font-bold text-slate-400 block mb-1">انتخاب تأمین‌کننده</label>
                                        <select 
                                            value={selectedSupplierId}
                                            onChange={(e) => setSelectedSupplierId(e.target.value)}
                                            className="w-full bg-slate-50 border-slate-200 rounded-xl text-sm focus:ring-blue-500"
                                        >
                                            <option value="">همه تأمین‌کنندگان</option>
                                            {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                        </select>
                                    </div>
                                ) : null}
                            </div>

                            <button 
                                onClick={() => {
                                    setStartDate('');
                                    setEndDate('');
                                    setSelectedCompanyId('');
                                    setSelectedProductId('');
                                    setSelectedCustomerId('');
                                    setSelectedSupplierId('');
                                }}
                                className="w-full py-2 text-xs text-slate-400 hover:text-red-500 flex items-center justify-center gap-1 transition-colors"
                            >
                                <XIcon className="w-3 h-3" />
                                پاکسازی فیلترها
                            </button>
                        </div>
                    </div>

                    {/* Main Content: Reports List & Preview */}
                    <div className="lg:col-span-3 space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {activeCategory?.reports.map(report => (
                                <button
                                    key={report.id}
                                    onClick={() => setSelectedReportId(report.id)}
                                    className={`text-right p-5 rounded-3xl border-2 transition-all ${
                                        selectedReportId === report.id
                                        ? 'bg-white border-blue-600 shadow-xl shadow-blue-500/10'
                                        : 'bg-white border-transparent hover:border-slate-200 shadow-sm'
                                    }`}
                                >
                                    <h4 className={`font-black text-lg ${selectedReportId === report.id ? 'text-blue-600' : 'text-slate-800'}`}>
                                        {report.label}
                                    </h4>
                                    <p className="text-slate-400 text-sm mt-1">{report.description}</p>
                                </button>
                            ))}
                        </div>

                        {/* Preview Section */}
                        <div className="bg-white rounded-[2rem] shadow-xl border border-slate-200 overflow-hidden">
                            <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                                <h3 className="font-black text-xl text-slate-800">پیش‌نمایش داده‌ها</h3>
                                <div className="text-xs text-slate-400 bg-white px-3 py-1 rounded-full border border-slate-200">
                                    نمایش ۱۰ ردیف اول جهت بررسی
                                </div>
                            </div>
                            <div className="overflow-x-auto">
                                <table className="w-full text-right">
                                    <thead>
                                        <tr className="bg-slate-100/50 text-slate-500 text-sm uppercase tracking-wider">
                                            {generateReportData().headers.map((h, i) => (
                                                <th key={i} className="px-6 py-4 font-bold">{h}</th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {generateReportData().data.length > 0 ? (
                                            generateReportData().data.slice(0, 10).map((row, rowIndex) => (
                                                <tr key={rowIndex} className="hover:bg-slate-50 transition-colors">
                                                    {row.map((cell: any, cellIndex: number) => (
                                                        <td key={cellIndex} className="px-6 py-4 text-slate-600 font-medium">
                                                            {cell}
                                                        </td>
                                                    ))}
                                                </tr>
                                            ))
                                        ) : (
                                            <tr>
                                                <td colSpan={10} className="px-6 py-12 text-center text-slate-400 italic">
                                                    دیتایی برای نمایش وجود ندارد. فیلترها را بررسی کنید.
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                            {generateReportData().data.length > 10 && (
                                <div className="p-4 text-center bg-slate-50 border-t border-slate-100 text-slate-400 text-xs">
                                    ... و {generateReportData().data.length - 10} ردیف دیگر در فایل نهایی
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SpecialReports;
