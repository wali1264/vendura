
import React, { useEffect } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';

const UpdatePrompt: React.FC = () => {
  const {
    offlineReady: [offlineReady, setOfflineReady],
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegistered(r) {
      // Check for updates every hour
      if (r) {
        setInterval(() => {
          r.update();
        }, 60 * 60 * 1000);
      }
    },
    onRegisterError(error) {
      console.error('SW registration error', error);
    },
  });

  const close = () => {
    setOfflineReady(false);
    setNeedRefresh(false);
  };

  if (!needRefresh && !offlineReady) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 md:left-auto md:right-8 md:bottom-8 z-[9999] animate-bounce-in">
      <div className="bg-white rounded-2xl shadow-2xl border border-blue-100 p-4 md:p-6 max-w-sm flex flex-col gap-4">
        <div className="flex items-start gap-4">
          <div className="bg-blue-100 p-3 rounded-xl">
            <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </div>
          <div>
            <h3 className="font-bold text-slate-800 text-lg">
              {needRefresh ? 'نسخه جدید آماده است' : 'برنامه آماده استفاده آفلاین'}
            </h3>
            <p className="text-sm text-slate-500 leading-relaxed">
              {needRefresh 
                ? 'قابلیت‌های جدید و اصلاحات امنیتی اضافه شده است. برای اعمال تغییرات، برنامه را بروزرسانی کنید.' 
                : 'اکنون می‌توانید بدون نیاز به اینترنت از برنامه استفاده کنید.'}
            </p>
          </div>
        </div>
        
        <div className="flex gap-2 justify-end">
          <button 
            onClick={close}
            className="px-4 py-2 text-sm font-medium text-slate-400 hover:text-slate-600 transition-colors"
          >
            بعداً
          </button>
          {needRefresh && (
            <button
              onClick={() => updateServiceWorker(true)}
              className="px-6 py-2 bg-blue-600 text-white rounded-xl font-bold text-sm shadow-lg shadow-blue-100 hover:bg-blue-700 transition-all active:scale-95"
            >
              بروزرسانی فوری
            </button>
          )}
          {!needRefresh && offlineReady && (
            <button
              onClick={close}
              className="px-6 py-2 bg-emerald-600 text-white rounded-xl font-bold text-sm shadow-lg shadow-emerald-100 hover:bg-emerald-700 transition-all active:scale-95"
            >
              متوجه شدم
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default UpdatePrompt;
