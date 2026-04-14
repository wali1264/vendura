export interface ProductBatch {
  id: string; // Unique ID for the batch itself
  lotNumber: string;
  stock: number;
  purchasePrice: number;
  purchaseDate: string; // ISO string, crucial for FIFO
  expiryDate?: string; // Optional ISO string
  companyId?: string; // NEW: Link to company
}


export interface Product {
  id: string;
  name: string;
  // purchasePrice is now per batch
  salePrice: number;
  // stock is now a calculated value from batches
  batches: ProductBatch[];
  barcode?: string;
  manufacturer?: string;
  itemsPerPackage?: number;
  companyId?: string; // NEW: Default company for the product
}

export interface InvoiceItem extends Product {
  quantity: number;
  purchasePrice: number; // This is calculated at the time of sale for profit reporting.
  finalPrice?: number; // Added for individual item discounts
  batchDeductions?: { batchId: string; quantity: number }[]; // Track exactly which batches were used
}

// Service items can also be in an invoice
export interface Service {
    id: string;
    name: string;
    price: number;
    finalPrice?: number;
}

export type CartItem = (InvoiceItem & { type: 'product' }) | (Service & { quantity: number; type: 'service' });


export interface SaleInvoice {
  id: string;
  type: 'sale' | 'return';
  originalInvoiceId?: string; // Present if type is 'return'
  items: CartItem[];
  subtotal: number; // Total before discount (in transaction currency)
  totalDiscount: number; // Total discount amount (in transaction currency)
  totalAmount: number; // Final amount (subtotal - totalDiscount) (in transaction currency)
  totalAmountAFN: number; // NEW: Equivalent in AFN for inventory and reports
  timestamp: string;
  cashier: string;
  customerId?: string; // Optional: for credit sales
  supplierIntermediaryId?: string; // Optional: for sales to suppliers
  currency: 'AFN' | 'USD' | 'IRT'; // Multi-currency support
  exchangeRate: number;            // Rate to base currency (AFN)
  receivedAmount?: number;         // NEW: Amount received at the time of sale
  appliedShares?: { [companyId: string]: number };
  activityDepositId?: string;
}

export interface PurchaseInvoiceItem {
    productId: string;
    productName: string; // Denormalized for easier display
    quantity: number;
    purchasePrice: number;
    lotNumber: string;
    expiryDate?: string;
    companyId?: string; // NEW: Link to company
    // Phase 1: Lifecycle Tracking
    atFactoryQty: number;
    inTransitQty: number;
    receivedQty: number;
}

export interface PurchaseInvoice {
  id: string;
  type: 'purchase' | 'return';
  originalInvoiceId?: string; // Present if type is 'return'
  supplierId: string;
  invoiceNumber: string;
  items: PurchaseInvoiceItem[];
  totalAmount: number;
  timestamp: string;
  currency?: 'AFN' | 'USD' | 'IRT'; // Added IRT
  exchangeRate?: number;    
  sourceInTransitId?: string; // Phase 2: Link to parent shipment
  additionalCost?: number;
  costDescription?: string;
  companyId?: string;
}

export interface InTransitInvoice extends Omit<PurchaseInvoice, 'type'> {
    type: 'in_transit';
    expectedArrivalDate?: string;
    paidAmount?: number; // Phase 2: Track prepayments specifically for this order
    status?: 'active' | 'closed'; // Phase 2: Archiving support
}

export interface ActivityLog {
  id: string;
  type: 'sale' | 'purchase' | 'inventory' | 'login' | 'payroll' | 'deposit' | 'wastage';
  description: string;
  timestamp: string;
  user: string;
  refId?: string; // ID of the related entity (invoice, product, etc.)
  refType?: 'saleInvoice' | 'purchaseInvoice' | 'product' | 'depositHolder' | 'wastageRecord'; // To know what to look for
}

export interface WastageRecord {
  id: string;
  productId: string;
  productName: string;
  quantity: number;
  totalCost: number; // Value of wastage based on purchase price
  reason: string;
  timestamp: string;
  user: string;
  companyId?: string; // NEW: Link to company
}

// --- Orders Module Types (Isolated) ---
export type OrderStatus = 'pending' | 'ready' | 'delivered' | 'cancelled';

export interface OrderPayment {
    id: string;
    amount: number;
    date: string;
}

export interface Order {
    id: string;
    customerId: string;
    title: string;
    description: string;
    totalAmount: number;
    currency: 'AFN' | 'USD' | 'IRT';
    status: OrderStatus;
    payments: OrderPayment[];
    createdAt: string;
}

// --- Security Deposit Module Types ---
export interface DepositHolder {
    id: string;
    name: string;
    phone?: string;
    balance: number; // Total equivalent in base currency (AFN)
    balanceAFN: number;
    balanceUSD: number;
    balanceIRT: number;
    createdAt: string;
}

export interface DepositTransaction {
    id: string;
    holderId: string;
    type: 'deposit' | 'withdrawal';
    amount: number;
    currency: 'AFN' | 'USD' | 'IRT';
    description: string;
    date: string;
    exchangeRate?: number; // Rate to base currency at time of transaction
    isCash?: boolean; // NEW: To distinguish physical cash from intermediary settlements
    isHistorical?: boolean; // NEW: To record past transactions without affecting current cash
    isManual?: boolean; // NEW: To distinguish direct entries from system-generated ones
}

// --- Accounting Module Types ---

export interface Supplier {
    id:string;
    name: string;
    contactPerson?: string;
    phone?: string;
    address?: string;
    balance: number; // Total approximate balance in AFN (for reports)
    balanceAFN: number; // Precise AFN balance
    balanceUSD: number; // Precise USD balance
    balanceIRT: number; // Precise IRT balance (New)
    initialBalanceDate?: string;
    initialBalanceDescription?: string;
    initialBalance?: number;
    initialBalanceCurrency?: 'AFN' | 'USD' | 'IRT';
    initialBalanceExchangeRate?: number;
}

export interface SupplierTransaction {
    id: string;
    supplierId: string;
    type: 'purchase' | 'payment' | 'receipt' | 'purchase_return';
    amount: number;
    date: string;
    description: string; // e.g., Invoice # or Payment to X
    invoiceId?: string; // Link to the purchase invoice
    currency?: 'AFN' | 'USD' | 'IRT'; // Track specific currency
    exchangeRate?: number; // Rate to base currency at time of transaction
    isCash?: boolean; // NEW: To distinguish physical cash from intermediary settlements
    isManual?: boolean;
    isInitial?: boolean;
    isHistorical?: boolean;
}


export interface Employee {
    id: string;
    name: string;
    position: string;
    basicSalary: number;
    otherBenefits: number;
    monthlySalary: number; // Total (Basic + Benefits)
    salaryCurrency: 'AFN' | 'USD' | 'IRT'; // Base currency for salary
    isActive: boolean;
    balance: number; // Total in base currency
    balanceAFN: number;
    balanceUSD: number;
    balanceIRT: number;
}

export interface PayrollTransaction {
    id: string;
    employeeId: string;
    type: 'advance' | 'salary_payment';
    amount: number;
    currency: 'AFN' | 'USD' | 'IRT';
    exchangeRate: number;
    date: string;
    description: string;
}

export interface Customer {
    id: string;
    name: string;
    phone?: string;
    creditLimit?: number;
    balance: number;    // Positive means they owe us (Total in AFN)
    balanceAFN: number; // Positive means they owe us AFN
    balanceUSD: number; // Positive means they owe us USD
    balanceIRT: number; // Positive means they owe us IRT
    linkedDepositHolderId?: string;
    activityConfig?: {
        depositHolderId: string;
        companyShares: { [companyId: string]: number };
    };
    initialBalanceDate?: string;
    initialBalanceDescription?: string;
    initialBalance?: number;
    initialBalanceCurrency?: 'AFN' | 'USD' | 'IRT';
    initialBalanceExchangeRate?: number;
    companyId?: string; // NEW: Link to company
}

export interface CustomerTransaction {
    id: string;
    customerId: string;
    type: 'credit_sale' | 'payment' | 'receipt' | 'sale_return';
    amount: number;
    date: string;
    description: string; // e.g., Invoice # or Payment received
    invoiceId?: string; // Link to the sale invoice
    currency?: 'AFN' | 'USD' | 'IRT'; // Added currency tracking
    exchangeRate?: number; // Rate to base currency at time of transaction
    isCash?: boolean; // NEW: To distinguish physical cash from intermediary settlements
    isManual?: boolean;
    isInitial?: boolean;
    isHistorical?: boolean;
}

export type AnyTransaction = CustomerTransaction | SupplierTransaction | PayrollTransaction | DepositTransaction;

export interface Expense {
    id: string;
    category: string;
    description: string;
    amount: number;
    currency: 'AFN' | 'USD' | 'IRT';
    exchangeRate: number;
    amountBase?: number; // Equivalent in base currency
    date: string;
    relatedId?: string; // Link to purchase invoices or other entities
    isHistorical?: boolean; // NEW: To record past expenses without affecting current cash
    companyId?: string; // NEW: Link to company for specific expense tracking
    partnerId?: string; // NEW: Link to partner for withdrawals
}

export interface Partner {
    id: string;
    name: string;
    shares: { companyId: string; percentage: number }[]; // companyId 'global' for all-company share
}

export interface Company {
    id: string;
    name: string;
    initialProfit?: number; // Positive for profit, negative for loss
    initialProfitCurrency?: 'AFN' | 'USD' | 'IRT';
    initialProfitExchangeRate?: number;
    initialProfitDate?: string;
    initialProfitDescription?: string;
}

export interface SalesMemoImage {
    id: number;
    imageData: string;
}

// --- Settings Module Types ---
export interface CurrencyConfig {
    code: 'AFN' | 'USD' | 'IRT';
    name: string;
    symbol: string;
    method: 'multiply' | 'divide'; // 'multiply' for weaker currencies (Base * Rate), 'divide' for stronger (Base / Rate)
}

export interface StoreSettings {
    storeName: string;
    address: string;
    phone: string;
    lowStockThreshold: number;
    expiryThresholdMonths: number;
    currencyName: string; // Legacy support
    currencySymbol: string; // Legacy support
    packageLabel?: string;
    unitLabel?: string;
    baseCurrency: 'AFN' | 'USD' | 'IRT';
    logoLeft?: string;
    logoRight?: string;
    logoLeftSize?: number;
    logoRightSize?: number;
    currencyConfigs: {
        AFN: CurrencyConfig;
        USD: CurrencyConfig;
        IRT: CurrencyConfig;
    };
    expenseCategories: string[]; // Dynamic categories
}

// --- Package/Unit Management ---
export interface PackageUnits {
    packages: number;
    units: number;
}

// --- Auth & RBAC Types ---
export type Permission = string; // e.g., 'pos:create_invoice'

export interface Role {
    id: string;
    name: string;
    permissions: Permission[];
}

export interface User {
    id: string;
    username: string;
    password?: string; // Should be hashed in a real app
    roleId: string;
}

// --- Backup Module Types ---
export interface BackupRecord {
    id: string;
    user_id: string;
    data?: AppState; // Optional because we might only fetch metadata for the list
    created_at: string;
    is_cloud: boolean;
    is_local: boolean;
    status: 'success' | 'failed';
    errorMessage?: string;
}

export interface AppState {
    products: Product[];
    saleInvoices: SaleInvoice[];
    purchaseInvoices: PurchaseInvoice[];
    inTransitInvoices: InTransitInvoice[];
    customers: Customer[];
    suppliers: Supplier[];
    employees: Employee[];
    expenses: Expense[];
    services: Service[];
    depositHolders: DepositHolder[];
    depositTransactions: DepositTransaction[];
    storeSettings: StoreSettings;
    cart: CartItem[];
    customerTransactions: CustomerTransaction[];
    supplierTransactions: SupplierTransaction[];
    payrollTransactions: PayrollTransaction[];
    activities: ActivityLog[];
    wastageRecords: WastageRecord[];
    orders: Order[];
    companies: Company[];
    partners: Partner[];
    saleInvoiceCounter: number;
    editingSaleInvoiceId: string | null;
    editingPurchaseInvoiceId: string | null;
    selectedCompanyId: string | null;
    // Auth State
    isAuthenticated: boolean;
    currentUser: User | null;
    users: User[];
    roles: Role[];
}

// --- Types for Web Speech API ---
export interface SpeechRecognitionResult {
    isFinal: boolean;
    [key: number]: {
        transcript: string;
    };
    length: number;
}

export interface SpeechRecognitionEvent {
    resultIndex: number;
    results: SpeechRecognitionResult[];
}

export interface SpeechRecognitionErrorEvent {
    error: 'not-allowed' | 'no-speech' | 'audio-capture' | 'network' | 'aborted' | 'language-not-supported' | 'service-not-allowed' | 'bad-grammar';
}

export interface SpeechRecognition {
    continuous: boolean;
    interimResults: boolean;
    lang: string;
    onresult: (event: SpeechRecognitionEvent) => void;
    onerror: (event: SpeechRecognitionErrorEvent) => void;
    onend: () => void;
    start: () => void;
    stop: () => void;
}

declare global {
    interface Window {
        SpeechRecognition: new () => SpeechRecognition;
        webkitSpeechRecognition: new () => SpeechRecognition;
    }
}