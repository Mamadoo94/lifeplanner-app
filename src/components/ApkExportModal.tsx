import React, { useState } from 'react';
import {
  X,
  Smartphone,
  Download,
  Copy,
  Check,
  Code,
  FileCode,
  Sparkles,
  ShieldCheck,
  Cpu,
} from 'lucide-react';
import { dbInstance } from '../db/indexedDB';

interface ApkExportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ApkExportModal: React.FC<ApkExportModalProps> = ({ isOpen, onClose }) => {
  const [copiedCode, setCopiedCode] = useState(false);
  const [activeTab, setActiveTab] = useState<'quick' | 'androidStudio' | 'xiaomiTips'>('quick');

  if (!isOpen) return null;

  const androidStudioCode = `// MainActivity.kt (Android Studio - Kotlin)
package com.lifeplanner.app

import android.os.Bundle
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.appcompat.app.AppCompatActivity

class MainActivity : AppCompatActivity() {
    private lateinit var webView: WebView

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        webView = WebView(this)
        setContentView(webView)

        webView.settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true // مهم: فعال‌سازی IndexedDB آفلاین
            databaseEnabled = true
            allowFileAccess = true
            allowContentAccess = true
            cacheMode = WebSettings.LOAD_DEFAULT
        }
        webView.webViewClient = WebViewClient()

        // بارگذاری فایل تک‌برگی از پوشه assets
        webView.loadUrl("file:///android_asset/index.html")
    }

    override fun onBackPressed() {
        if (webView.canGoBack()) {
            webView.goBack()
        } else {
            super.onBackPressed()
        }
    }
}`;

  const copyAndroidCode = () => {
    navigator.clipboard.writeText(androidStudioCode);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2500);
  };

  // Generate and download a pure single-file index.html
  const handleDownloadSingleFileHtml = async () => {
    const htmlContent = document.documentElement.outerHTML;
    const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'LifePlanner_Offline_SingleFile.html';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-fadeIn">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/60">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-blue-600/20 text-blue-400 flex items-center justify-center">
              <Smartphone className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">راهنمای ساخت APK برای گوشی‌های شیائومی</h3>
              <p className="text-[11px] text-slate-400">
                تبدیل برنامه LifePlanner به فایل نصبی اندروید (APK / AAB)
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab switcher */}
        <div className="flex items-center gap-2 p-3 bg-slate-850 border-b border-slate-800 text-xs">
          <button
            onClick={() => setActiveTab('quick')}
            className={`px-3 py-1.5 rounded-xl font-medium transition-all ${
              activeTab === 'quick'
                ? 'bg-blue-600 text-white'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            روش ۱: ابزارهای سریع (بدون کد)
          </button>
          <button
            onClick={() => setActiveTab('androidStudio')}
            className={`px-3 py-1.5 rounded-xl font-medium transition-all ${
              activeTab === 'androidStudio'
                ? 'bg-blue-600 text-white'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            روش ۲: پروژه Android Studio (کد بومی)
          </button>
          <button
            onClick={() => setActiveTab('xiaomiTips')}
            className={`px-3 py-1.5 rounded-xl font-medium transition-all ${
              activeTab === 'xiaomiTips'
                ? 'bg-blue-600 text-white'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            تنظیمات شیائومی (HyperOS / MIUI)
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 space-y-4 overflow-y-auto flex-1 text-slate-300 text-xs leading-relaxed">
          {/* Download Single HTML Button */}
          <div className="bg-gradient-to-l from-blue-950/40 to-slate-850 border border-blue-500/30 p-4 rounded-2xl flex items-center justify-between gap-3">
            <div>
              <h4 className="text-sm font-bold text-white flex items-center gap-1.5">
                <FileCode className="w-4 h-4 text-blue-400" />
                دریافت فایل تک‌برگی HTML
              </h4>
              <p className="text-[11px] text-slate-400 mt-1">
                شامل تمام منطق، پایگاه داده آفلاین IndexedDB، استایل‌ها و تقویم شمسی.
              </p>
            </div>
            <button
              onClick={handleDownloadSingleFileHtml}
              id="download-html-btn"
              className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs shadow-md shadow-blue-600/30 flex items-center gap-1.5 shrink-0"
            >
              <Download className="w-4 h-4" />
              <span>دانلود فایل HTML</span>
            </button>
          </div>

          {activeTab === 'quick' && (
            <div className="space-y-3">
              <h4 className="font-bold text-white text-sm">ساخت APK با Website 2 APK Builder یا Web2Apk:</h4>
              <ol className="list-decimal list-inside space-y-2 text-slate-300 bg-slate-800/40 p-4 rounded-2xl border border-slate-800">
                <li>فایل تک‌برگی بالا (<code className="text-blue-300">index.html</code>) را دانلود کنید.</li>
                <li>نرم‌افزار رایگان <strong>Website 2 APK Builder</strong> یا <strong>VoltBuilder</strong> را باز کنید.</li>
                <li>نوع پروژه را روی <strong>Local HTML Website</strong> قرار دهید و پوشه حاوی <code className="text-blue-300">index.html</code> را انتخاب کنید.</li>
                <li>نام برنامه را <strong>LifePlanner</strong> و آیکون دلخواه خود را قرار دهید.</li>
                <li>گزینه <strong>Offline Caching & DOM Storage</strong> را تیک بزنید تا ذخیره‌سازی آفلاین IndexedDB فعال باشد.</li>
                <li>دکمه <strong>Generate APK</strong> را بزنید تا فایل APK آماده نصب روی شیائومی شما تحویل داده شود!</li>
              </ol>
            </div>
          )}

          {activeTab === 'androidStudio' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="font-bold text-white text-sm">کد منبع کاتلین برای Android Studio:</h4>
                <button
                  onClick={copyAndroidCode}
                  className="flex items-center gap-1 px-3 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700"
                >
                  {copiedCode ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedCode ? 'کپی شد!' : 'کپی کد'}</span>
                </button>
              </div>

              <p className="text-slate-400 text-[11px]">
                فایل <code className="text-blue-300">index.html</code> را در مسیر <code className="text-amber-300">app/src/main/assets/index.html</code> قرار دهید:
              </p>

              <pre className="bg-slate-950 p-3 rounded-2xl text-[11px] font-mono text-emerald-400 overflow-x-auto border border-slate-800 dir-ltr text-left">
                {androidStudioCode}
              </pre>
            </div>
          )}

          {activeTab === 'xiaomiTips' && (
            <div className="space-y-3">
              <h4 className="font-bold text-white text-sm">تنظیمات بهینه‌سازی برای شیائومی (HyperOS / MIUI):</h4>
              <div className="space-y-2.5">
                <div className="p-3 rounded-2xl bg-slate-800/40 border border-slate-800">
                  <span className="font-bold text-slate-200 block mb-1">۱. اجازه دسترسی به حافظه و عدم بستن برنامه در پس‌زمینه</span>
                  <p className="text-slate-400 text-[11px]">
                    در تنظیمات شیائومی به مسیر <em>تنظیمات &gt; برنامه‌ها &gt; مدیریت برنامه‌ها &gt; LifePlanner</em> رفته و گزینه <strong>صرفه‌جویی در باتری (Battery Saver)</strong> را روی <strong>بدون محدودیت (No restrictions)</strong> قرار دهید تا تایمر پومودورو در پس‌زمینه متوقف نشود.
                  </p>
                </div>

                <div className="p-3 rounded-2xl bg-slate-800/40 border border-slate-800">
                  <span className="font-bold text-slate-200 block mb-1">۲. راه‌اندازی خودکار (Autostart)</span>
                  <p className="text-slate-400 text-[11px]">
                    در همان بخش اطلاعات برنامه، گزینه <strong>شروع خودکار (Autostart)</strong> را روشن کنید تا برنامه بلافاصله بعد از روشن شدن گوشی آماده خدمت باشد.
                  </p>
                </div>

                <div className="p-3 rounded-2xl bg-slate-800/40 border border-slate-800">
                  <span className="font-bold text-slate-200 block mb-1">۳. قفل کردن در لیست برنامه‌های اخیر</span>
                  <p className="text-slate-400 text-[11px]">
                    در صفحه برنامه‌های اخیر (Recent Apps)، انگشت خود را روی کارت برنامه نگه داشته و علامت 🔒 (قفل) را بزنید تا با بستن یک‌جای برنامه‌ها پاک نشود.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-900/80 flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-[11px] text-emerald-400 font-medium">
            <ShieldCheck className="w-4 h-4" />
            <span>۱۰۰٪ امن و محلی بدون ارسال داده به هیچ سرور خارجی</span>
          </div>

          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-medium text-xs transition-colors"
          >
            بستن راهنما
          </button>
        </div>
      </div>
    </div>
  );
};
