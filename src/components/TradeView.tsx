import React, { useState, useEffect, useRef } from 'react';
import {
  TrendingUp,
  TrendingDown,
  ShieldAlert,
  FileText,
  CheckSquare,
  Plus,
  Trash2,
  Edit2,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  RotateCcw,
  GripVertical,
  Award,
  Zap,
  Tag,
  Clock,
  Calendar,
  X,
  Check,
  Percent,
  DollarSign,
  Activity,
  Smile,
  Frown,
  Meh,
  Eye,
  ArrowUpRight,
  ArrowDownRight,
  Sparkles,
  Layers,
  HelpCircle,
  AlertTriangle,
  Upload,
  Camera,
  Image as ImageIcon,
  Maximize2,
  Download,
  Loader2,
  Link2,
  ImagePlus,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
} from 'lucide-react';
import {
  Trade,
  TradeChecklistItem,
  TradeRiskSettings,
  TradeDirection,
  TradeOutcome,
  TradePsychology,
  TradeAccordionState,
  TradeScreenshot,
} from '../types';
import { getTodayJalali, getTodayJalaliWithTime, toPersianDigits } from '../utils/jalali';
import { soundFx } from '../utils/audio';
import { JalaliDatePickerField } from './JalaliDatePickerModal';
import { dbInstance } from '../db/indexedDB';
import { ConfirmDeleteModal } from './ConfirmDeleteModal';

interface TradeViewProps {
  trades: Trade[];
  checklistItems: TradeChecklistItem[];
  strategyContent: string;
  riskSettings: TradeRiskSettings;
  onAddTrade: (trade: Omit<Trade, 'id'>) => Promise<void>;
  onUpdateTrade: (trade: Trade) => Promise<void>;
  onDeleteTrade: (tradeId: number) => Promise<void>;
  onReorderTrades: (trades: Trade[]) => Promise<void>;
  onSaveStrategy: (content: string) => Promise<void>;
  onAddChecklistItem: (title: string) => Promise<void>;
  onUpdateChecklistItem: (item: TradeChecklistItem) => Promise<void>;
  onDeleteChecklistItem: (id: number) => Promise<void>;
  onToggleChecklistItem: (id: number) => Promise<void>;
  onResetChecklist: () => Promise<void>;
  onReorderChecklist?: (items: TradeChecklistItem[]) => Promise<void>;
  onSaveRiskSettings: (settings: TradeRiskSettings) => Promise<void>;
}

const DEFAULT_ACCORDION_STATES: TradeAccordionState = {
  strategy: false,
  checklist: true,
  newTrade: true,
  analytics: true,
  history: true,
};

const ACCORDION_STORAGE_KEY = 'lifeplanner_trade_accordion_states';

export const TradeView: React.FC<TradeViewProps> = ({
  trades = [],
  checklistItems = [],
  strategyContent = '',
  riskSettings = {
    balance: 10000,
    risk_percent: 1,
    prop_max_daily_risk_percent: 4,
    default_symbol: 'XAUUSD',
    golden_rules: '',
  } as TradeRiskSettings,
  onAddTrade,
  onUpdateTrade,
  onDeleteTrade,
  onReorderTrades,
  onSaveStrategy,
  onAddChecklistItem,
  onUpdateChecklistItem,
  onDeleteChecklistItem,
  onToggleChecklistItem,
  onResetChecklist,
  onReorderChecklist,
  onSaveRiskSettings,
}) => {
  // -------------------------------------------------------------
  // ACCORDION EXPAND / COLLAPSE PERSISTENCE
  // -------------------------------------------------------------
  const [accordion, setAccordion] = useState<TradeAccordionState>(() => {
    try {
      const cached = localStorage.getItem(ACCORDION_STORAGE_KEY);
      if (cached) return { ...DEFAULT_ACCORDION_STATES, ...JSON.parse(cached) };
    } catch {
      // ignore
    }
    return DEFAULT_ACCORDION_STATES;
  });

  // Load from IndexedDB on mount
  useEffect(() => {
    dbInstance.getTradeAccordionStates().then((states) => {
      if (states) {
        setAccordion((prev) => ({ ...prev, ...states }));
        try {
          localStorage.setItem(ACCORDION_STORAGE_KEY, JSON.stringify(states));
        } catch {
          // ignore
        }
      }
    });
  }, []);

  const toggleSection = (sectionKey: keyof TradeAccordionState) => {
    setAccordion((prev) => {
      const updated = { ...prev, [sectionKey]: !prev[sectionKey] };
      try {
        localStorage.setItem(ACCORDION_STORAGE_KEY, JSON.stringify(updated));
      } catch {
        // ignore
      }
      dbInstance.saveTradeAccordionStates(updated).catch(() => {});
      return updated;
    });
  };

  // -------------------------------------------------------------
  // ① STRATEGY AND PLAN EDITOR STATES & GOLDEN RULES
  // -------------------------------------------------------------
  const DEFAULT_GOLDEN_RULES = `• External Structure → جهت کلی و Bias تایم‌فریم بالاتر (HTF) را مشخص می‌کند.
• Internal Structure → نقطه ورود دقیق‌تر (LTF) و مدیریت ریسک معامله را می‌دهد.
• مدیریت سرمایه: ریسک مجاز در هر معامله حداکثر ۱٪ و دراودان مجاز روزانه حداکثر ۴٪ است.
• بعد از ۲ باخت پیاپی در یک روز، سشن معاملاتی متوقف می‌شود.`;

  const [goldenRulesText, setGoldenRulesText] = useState(riskSettings.golden_rules || DEFAULT_GOLDEN_RULES);
  const [isEditingGoldenRules, setIsEditingGoldenRules] = useState(false);
  const [goldenRulesSavedNotice, setGoldenRulesSavedNotice] = useState(false);

  useEffect(() => {
    if (riskSettings.golden_rules) {
      setGoldenRulesText(riskSettings.golden_rules);
    }
  }, [riskSettings.golden_rules]);

  const handleSaveGoldenRulesClick = async () => {
    await onSaveRiskSettings({
      ...riskSettings,
      golden_rules: goldenRulesText,
    });
    setIsEditingGoldenRules(false);
    setGoldenRulesSavedNotice(true);
    soundFx.playCheckmark();
    setTimeout(() => setGoldenRulesSavedNotice(false), 3000);
  };

  const [strategyText, setStrategyText] = useState(strategyContent || '');
  const [isEditingStrategy, setIsEditingStrategy] = useState(false);
  const [strategySavedNotice, setStrategySavedNotice] = useState(false);

  // Global Delete Confirm States
  const [tradeToDelete, setTradeToDelete] = useState<Trade | null>(null);
  const [checklistToDelete, setChecklistToDelete] = useState<TradeChecklistItem | null>(null);

  useEffect(() => {
    if (strategyContent) {
      setStrategyText(strategyContent);
    }
  }, [strategyContent]);

  const handleSaveStrategyClick = async () => {
    await onSaveStrategy(strategyText);
    setIsEditingStrategy(false);
    setStrategySavedNotice(true);
    soundFx.playCheckmark();
    setTimeout(() => setStrategySavedNotice(false), 3000);
  };

  // -------------------------------------------------------------
  // ② PRE-TRADE CHECKLIST STATES
  // -------------------------------------------------------------
  const [newChecklistText, setNewChecklistText] = useState('');
  const [editingChecklistId, setEditingChecklistId] = useState<number | null>(null);
  const [editingChecklistText, setEditingChecklistText] = useState('');
  const [draggedChecklistId, setDraggedChecklistId] = useState<number | null>(null);
  const [dragOverChecklistId, setDragOverChecklistId] = useState<number | null>(null);

  const safeChecklistItems = checklistItems || [];
  const totalChecklist = safeChecklistItems.length;
  const checkedCount = safeChecklistItems.filter((item) => item && item.is_checked).length;
  const checklistProgress = totalChecklist > 0 ? Math.round((checkedCount / totalChecklist) * 100) : 0;

  const sortedChecklistItems = [...safeChecklistItems].sort(
    (a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)
  );

  const handleAddChecklist = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newChecklistText.trim()) return;
    await onAddChecklistItem(newChecklistText.trim());
    setNewChecklistText('');
    soundFx.playCheckmark();
  };

  const handleSaveEditChecklist = async (item: TradeChecklistItem) => {
    if (!editingChecklistText.trim()) return;
    await onUpdateChecklistItem({
      ...item,
      title: editingChecklistText.trim(),
    });
    setEditingChecklistId(null);
    setEditingChecklistText('');
  };

  const handleMoveChecklist = async (id: number, direction: 'up' | 'down') => {
    const currentIdx = sortedChecklistItems.findIndex((it) => it.id === id);
    if (currentIdx === -1) return;
    const targetIdx = direction === 'up' ? currentIdx - 1 : currentIdx + 1;
    if (targetIdx < 0 || targetIdx >= sortedChecklistItems.length) return;

    const newItems = [...sortedChecklistItems];
    const [moved] = newItems.splice(currentIdx, 1);
    newItems.splice(targetIdx, 0, moved);

    const reordered = newItems.map((item, idx) => ({ ...item, sort_order: idx }));
    if (onReorderChecklist) {
      await onReorderChecklist(reordered);
      soundFx.playCheckmark();
    }
  };

  const handleDropChecklist = async (targetId: number) => {
    if (!draggedChecklistId || draggedChecklistId === targetId) {
      setDraggedChecklistId(null);
      setDragOverChecklistId(null);
      return;
    }
    const currentIdx = sortedChecklistItems.findIndex((it) => it.id === draggedChecklistId);
    const targetIdx = sortedChecklistItems.findIndex((it) => it.id === targetId);
    if (currentIdx === -1 || targetIdx === -1) {
      setDraggedChecklistId(null);
      setDragOverChecklistId(null);
      return;
    }
    const newItems = [...sortedChecklistItems];
    const [moved] = newItems.splice(currentIdx, 1);
    newItems.splice(targetIdx, 0, moved);

    setDraggedChecklistId(null);
    setDragOverChecklistId(null);

    const reordered = newItems.map((item, idx) => ({ ...item, sort_order: idx }));
    if (onReorderChecklist) {
      await onReorderChecklist(reordered);
      soundFx.playCheckmark();
    }
  };

  // -------------------------------------------------------------
  // ③ NEW TRADE FORM WITH INTEGRATED CALCULATOR LOGIC
  // -------------------------------------------------------------
  const formSectionRef = useRef<HTMLDivElement>(null);
  const [editingTrade, setEditingTrade] = useState<Trade | null>(null);
  const [formDate, setFormDate] = useState(getTodayJalali());
  const [formTime, setFormTime] = useState(() => {
    const now = new Date();
    return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  });

  // Primary trade inputs
  const [formSymbol, setFormSymbol] = useState(riskSettings.default_symbol || 'XAUUSD');
  const [formDirection, setFormDirection] = useState<TradeDirection>('long');
  const [formBalance, setFormBalance] = useState<number>(riskSettings.balance || 10000);
  const [formRiskPercent, setFormRiskPercent] = useState<number>(riskSettings.risk_percent || 1);
  const [formEntry, setFormEntry] = useState<string>('2500.00');
  const [formSL, setFormSL] = useState<string>('2495.00');
  const [formTP, setFormTP] = useState<string>('2515.00');

  // Outcome & Psychology
  const [formOutcome, setFormOutcome] = useState<TradeOutcome>('open');
  const [formNetPnL, setFormNetPnL] = useState('');
  const [formRealizedRR, setFormRealizedRR] = useState('2.0');
  const [formPsychology, setFormPsychology] = useState<TradePsychology>('disciplined');
  const [formConfluences, setFormConfluences] = useState<string[]>([]);
  const [customConfluenceInput, setCustomConfluenceInput] = useState('');
  const [formScreenshots, setFormScreenshots] = useState<TradeScreenshot[]>([]);
  const [newLinkUrl, setNewLinkUrl] = useState('');
  const [newLinkTitle, setNewLinkTitle] = useState('');
  const [activeUploadTab, setActiveUploadTab] = useState<'files' | 'link'>('files');
  const [formIsDraft, setFormIsDraft] = useState(false);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [lightboxImage, setLightboxImage] = useState<{ url: string; title?: string; trade?: Trade } | null>(null);
  const [lightboxGallery, setLightboxGallery] = useState<TradeScreenshot[]>([]);
  const [lightboxCurrentIndex, setLightboxCurrentIndex] = useState(0);
  const [lightboxZoom, setLightboxZoom] = useState(1);
  const [lightboxPan, setLightboxPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [formNotes, setFormNotes] = useState('');
  const [formSubmitSuccess, setFormSubmitSuccess] = useState(false);

  // Helper to convert an image file to server URL or local Data URL
  const processImageFile = (file: File): Promise<string> => {
    return new Promise(async (resolve, reject) => {
      try {
        const formData = new FormData();
        formData.append('image', file);
        const res = await fetch('/api/upload', { method: 'POST', body: formData });
        if (res.ok) {
          const data = await res.json();
          if (data.success && data.url) {
            return resolve(data.url);
          }
        }
      } catch {
        // Fallback to local Base64 reading for offline PWA operation
      }

      const reader = new FileReader();
      reader.onload = (event) => {
        const base64Url = event.target?.result as string;
        if (base64Url) resolve(base64Url);
        else reject(new Error('Failed to read file data'));
      };
      reader.onerror = () => reject(new Error('FileReader error'));
      reader.readAsDataURL(file);
    });
  };

  // Handle multiple chart screenshot files
  const handleMultipleImageFiles = async (files: FileList | File[]) => {
    const list = Array.from(files);
    if (!list || list.length === 0) return;
    const valid = list.filter((f) => f.type.startsWith('image/'));
    if (valid.length === 0) {
      setUploadError('لطفاً فقط فایل‌های تصویری انتخاب کنید.');
      return;
    }

    const oversized = valid.find((f) => f.size > 25 * 1024 * 1024);
    if (oversized) {
      setUploadError(`حجم تصویر "${oversized.name}" بیش از حد مجاز (۲۵ مگابایت) است.`);
      return;
    }

    setIsUploadingImage(true);
    setUploadError(null);

    const uploadedScreens: TradeScreenshot[] = [];
    for (const file of valid) {
      try {
        const url = await processImageFile(file);
        uploadedScreens.push({
          id: `up_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          url,
          title: file.name.replace(/\.[^/.]+$/, ''),
          type: 'upload',
        });
      } catch (err) {
        console.error('File upload error:', file.name, err);
      }
    }

    if (uploadedScreens.length > 0) {
      setFormScreenshots((prev) => [...prev, ...uploadedScreens]);
      soundFx.playCheckmark();
    }
    setIsUploadingImage(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Add screenshot via external URL (TradingView, CDN, etc.)
  const handleAddLinkScreenshot = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const url = newLinkUrl.trim();
    if (!url) return;
    if (!url.startsWith('http://') && !url.startsWith('https://') && !url.startsWith('data:')) {
      setUploadError('آدرس اینترنتی تصویر باید با http:// یا https:// آغاز شود.');
      return;
    }

    const newScreen: TradeScreenshot = {
      id: `link_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      url,
      title: newLinkTitle.trim() || 'لینک چارت خارجی',
      type: 'link',
    };

    setFormScreenshots((prev) => [...prev, newScreen]);
    setNewLinkUrl('');
    setNewLinkTitle('');
    setUploadError(null);
    soundFx.playCheckmark();
  };

  const handleRemoveScreenshot = (id: string) => {
    setFormScreenshots((prev) => prev.filter((s) => s.id !== id));
  };

  // Open Lightbox with gallery support
  const openLightboxWithGallery = (
    itemUrl: string,
    itemTitle?: string,
    trade?: Trade,
    gallery?: TradeScreenshot[],
    initialIdx?: number
  ) => {
    const gal =
      gallery && gallery.length > 0
        ? gallery
        : [{ id: 'single', url: itemUrl, title: itemTitle || 'چارت', type: 'upload' as const }];

    let idx = initialIdx ?? 0;
    if (initialIdx === undefined) {
      const found = gal.findIndex((g) => g.url === itemUrl);
      idx = found >= 0 ? found : 0;
    }

    setLightboxGallery(gal);
    setLightboxCurrentIndex(idx);
    setLightboxImage({
      url: gal[idx]?.url || itemUrl,
      title: gal[idx]?.title || itemTitle,
      trade,
    });
    setLightboxZoom(1);
    setLightboxPan({ x: 0, y: 0 });
  };

  const navigateLightbox = (dir: 'next' | 'prev') => {
    if (lightboxGallery.length <= 1) return;
    const total = lightboxGallery.length;
    // In RTL Persian: next is previous logically or right/left
    const nextIdx =
      dir === 'next'
        ? (lightboxCurrentIndex + 1) % total
        : (lightboxCurrentIndex - 1 + total) % total;
    setLightboxCurrentIndex(nextIdx);
    const target = lightboxGallery[nextIdx];
    setLightboxImage((prev) => ({
      ...prev,
      url: target.url,
      title: target.title,
    }));
    setLightboxZoom(1);
    setLightboxPan({ x: 0, y: 0 });
  };

  // Sync initial risk settings if props update
  useEffect(() => {
    if (riskSettings.balance && !editingTrade) setFormBalance(riskSettings.balance);
    if (riskSettings.risk_percent && !editingTrade) setFormRiskPercent(riskSettings.risk_percent);
    if (riskSettings.default_symbol && !editingTrade) setFormSymbol(riskSettings.default_symbol);
  }, [riskSettings, editingTrade]);

  // Integrated Position Size Calculation
  const entryNum = parseFloat(formEntry) || 0;
  const slNum = parseFloat(formSL) || 0;
  const tpNum = parseFloat(formTP) || 0;

  const autoRiskUSD = (formBalance * formRiskPercent) / 100;
  const slDistance = Math.abs(entryNum - slNum);
  const tpDistance = Math.abs(tpNum - entryNum);

  let calculatedLotSize = 0;
  let pipsAtRisk = 0;
  const pipValuePerLot = 10; // default for 1 standard lot (forex)

  if (formSymbol === 'XAUUSD') {
    // Gold contract size: 100 ounces per lot ($1 move = $100 per 1.00 lot, or $1 per 0.01 lot)
    if (slDistance > 0) {
      calculatedLotSize = autoRiskUSD / (slDistance * 100);
      pipsAtRisk = slDistance * 10; // 1 pip in gold = $0.10
    }
  } else if (formSymbol === 'BTCUSD') {
    // Crypto BTC: 1 lot = 1 BTC
    if (slDistance > 0) {
      calculatedLotSize = autoRiskUSD / slDistance;
      pipsAtRisk = slDistance;
    }
  } else if (formSymbol.includes('JPY')) {
    // 1 pip = 0.01
    if (slDistance > 0) {
      pipsAtRisk = slDistance / 0.01;
      calculatedLotSize = autoRiskUSD / (pipsAtRisk * pipValuePerLot);
    }
  } else if (formSymbol === 'US30' || formSymbol === 'NAS100') {
    // Indices: 1 point = $1 per contract
    if (slDistance > 0) {
      calculatedLotSize = autoRiskUSD / slDistance;
      pipsAtRisk = slDistance;
    }
  } else {
    // Standard Forex (EURUSD, GBPUSD, etc.): 1 pip = 0.0001
    if (slDistance > 0) {
      pipsAtRisk = slDistance / 0.0001;
      calculatedLotSize = autoRiskUSD / (pipsAtRisk * pipValuePerLot);
    }
  }

  // Format to standard 2 decimal places (min 0.01)
  calculatedLotSize = Math.max(0.01, Math.round(calculatedLotSize * 100) / 100);
  if (isNaN(calculatedLotSize) || !isFinite(calculatedLotSize) || slDistance === 0) {
    calculatedLotSize = 0;
  }

  // Exact Actual Dollar Risk based on lot size and SL distance:
  // Actual Risk ($) = Lot Size * SL Distance (in pips/ticks) * Pip Value
  // e.g. 0.04 Lot on Gold with 70-pip SL (slDistance = 7.0) = 0.04 * 7.0 * 100 = $28
  let actualDollarRisk = 0;
  if (calculatedLotSize > 0 && slDistance > 0) {
    if (formSymbol === 'XAUUSD') {
      actualDollarRisk = calculatedLotSize * slDistance * 100;
    } else if (formSymbol === 'BTCUSD' || formSymbol === 'US30' || formSymbol === 'NAS100') {
      actualDollarRisk = calculatedLotSize * slDistance;
    } else {
      actualDollarRisk = calculatedLotSize * pipsAtRisk * pipValuePerLot;
    }
    actualDollarRisk = Math.round(actualDollarRisk * 100) / 100;
  } else {
    actualDollarRisk = autoRiskUSD;
  }

  const expectedRR = slDistance > 0 ? tpDistance / slDistance : 0;
  const potentialProfitUSD = actualDollarRisk * expectedRR;

  // Prop challenge drawdown safeguard
  const propLimitPercent = riskSettings.prop_max_daily_risk_percent || 4;
  const isHighRiskForProp = formRiskPercent >= propLimitPercent / 2;
  const isExceedingProp = formRiskPercent >= propLimitPercent;

  // Default Smart Money Confluences tags
  const DEFAULT_CONFLUENCES = [
    'Liquidity Sweep',
    'BOS / CHoCH',
    'HTF Structure',
    'OB / FVG',
    'Premium / Discount',
    'External Structure (جهت و Bias کلی)',
    'Internal Structure (نقطه ورود دقیق)',
    'London Kill Zone',
    'NY Kill Zone',
    'Asia High/Low Sweep',
    'Wyckoff Accumulation',
    'DXY Divergence',
    'Order Flow Shift',
    'FVG Inversion',
  ];

  const [availableConfluences, setAvailableConfluences] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('lifeplanner_trade_confluences');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {
      // ignore
    }
    return DEFAULT_CONFLUENCES;
  });

  const [editingConfluenceTag, setEditingConfluenceTag] = useState<{
    original: string;
    text: string;
  } | null>(null);

  // Persist available confluences
  useEffect(() => {
    try {
      localStorage.setItem('lifeplanner_trade_confluences', JSON.stringify(availableConfluences));
    } catch (e) {
      console.error('Failed to save confluences to localStorage:', e);
    }
  }, [availableConfluences]);

  const handleToggleConfluenceTag = (tag: string) => {
    if (formConfluences.includes(tag)) {
      setFormConfluences(formConfluences.filter((c) => c !== tag));
    } else {
      setFormConfluences([...formConfluences, tag]);
    }
  };

  const handleAddCustomConfluence = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const tag = customConfluenceInput.trim();
    if (!tag) return;

    if (!availableConfluences.includes(tag)) {
      setAvailableConfluences((prev) => [...prev, tag]);
    }
    if (!formConfluences.includes(tag)) {
      setFormConfluences((prev) => [...prev, tag]);
    }
    setCustomConfluenceInput('');
    soundFx.playCheckmark();
  };

  const handleStartEditConfluence = (tag: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setEditingConfluenceTag({ original: tag, text: tag });
  };

  const handleSaveEditConfluence = (e?: React.FormEvent | React.MouseEvent) => {
    if (e) e.preventDefault();
    if (!editingConfluenceTag) return;
    const newText = editingConfluenceTag.text.trim();
    const oldText = editingConfluenceTag.original;

    if (newText && newText !== oldText) {
      setAvailableConfluences((prev) => prev.map((t) => (t === oldText ? newText : t)));
      setFormConfluences((prev) => prev.map((t) => (t === oldText ? newText : t)));
      soundFx.playCheckmark();
    }
    setEditingConfluenceTag(null);
  };

  const handleDeleteConfluenceTag = (tagToDelete: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setAvailableConfluences((prev) => prev.filter((t) => t !== tagToDelete));
    setFormConfluences((prev) => prev.filter((t) => t !== tagToDelete));
    if (editingConfluenceTag?.original === tagToDelete) {
      setEditingConfluenceTag(null);
    }
    soundFx.playCheckmark();
  };

  const handleResetConfluencesToDefault = () => {
    setAvailableConfluences(DEFAULT_CONFLUENCES);
    soundFx.playCheckmark();
  };

  const resetTradeForm = () => {
    setEditingTrade(null);
    setFormDate(getTodayJalali());
    const now = new Date();
    setFormTime(`${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`);
    setFormSymbol(riskSettings.default_symbol || 'XAUUSD');
    setFormDirection('long');
    setFormBalance(riskSettings.balance || 10000);
    setFormRiskPercent(riskSettings.risk_percent || 1);
    setFormEntry('2500.00');
    setFormSL('2495.00');
    setFormTP('2515.00');
    setFormOutcome('open');
    setFormNetPnL('');
    setFormRealizedRR(expectedRR > 0 ? expectedRR.toFixed(1) : '2.0');
    setFormPsychology('disciplined');
    setFormConfluences([]);
    setFormScreenshots([]);
    setNewLinkUrl('');
    setNewLinkTitle('');
    setUploadError(null);
    setFormIsDraft(false);
    setFormNotes('');
  };

  // Auto-fill Net PnL and Realized R:R when outcome changes if blank
  const handleOutcomeChange = (newOutcome: TradeOutcome) => {
    setFormOutcome(newOutcome);
    if (newOutcome === 'win' && (!formNetPnL || formNetPnL === '0')) {
      setFormNetPnL(potentialProfitUSD > 0 ? potentialProfitUSD.toFixed(0) : (autoRiskUSD * 2).toFixed(0));
      setFormRealizedRR(expectedRR > 0 ? expectedRR.toFixed(1) : '2.0');
    } else if (newOutcome === 'loss' && (!formNetPnL || formNetPnL === '0')) {
      setFormNetPnL(`-${autoRiskUSD.toFixed(0)}`);
      setFormRealizedRR('-1.0');
    } else if (newOutcome === 'breakeven') {
      setFormNetPnL('0');
      setFormRealizedRR('0.0');
    }
  };

  const handleTradeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const lotsVal = calculatedLotSize > 0 ? calculatedLotSize : 0.01;
    const riskVal = actualDollarRisk > 0 ? actualDollarRisk : (autoRiskUSD > 0 ? autoRiskUSD : 100);
    const pnlVal = parseFloat(formNetPnL) || 0;
    const rrVal = parseFloat(formRealizedRR) || (formOutcome === 'win' ? expectedRR : 0);
    const primaryScreenshotUrl = formScreenshots[0]?.url || undefined;

    // Save risk settings to DB permanently
    await onSaveRiskSettings({
      ...riskSettings,
      balance: formBalance,
      risk_percent: formRiskPercent,
      default_symbol: formSymbol,
    });

    if (editingTrade && editingTrade.id) {
      await onUpdateTrade({
        ...editingTrade,
        date_jalali: formDate,
        time: formTime,
        symbol: formSymbol.trim().toUpperCase(),
        direction: formDirection,
        entry_price: entryNum,
        stop_loss: slNum,
        take_profit: tpNum,
        lot_size: lotsVal,
        risk_usd: riskVal,
        outcome: formOutcome,
        net_pnl: pnlVal,
        realized_rr: rrVal,
        psychology: formPsychology,
        confluences: formConfluences,
        screenshots: formScreenshots,
        screenshot_url: primaryScreenshotUrl,
        notes: formNotes.trim() || undefined,
        is_draft: formIsDraft,
      });
      soundFx.playCheckmark();
    } else {
      await onAddTrade({
        date_jalali: formDate,
        time: formTime,
        symbol: formSymbol.trim().toUpperCase() || 'XAUUSD',
        direction: formDirection,
        entry_price: entryNum,
        stop_loss: slNum,
        take_profit: tpNum,
        lot_size: lotsVal,
        risk_usd: riskVal,
        outcome: formOutcome,
        net_pnl: pnlVal,
        realized_rr: rrVal,
        psychology: formPsychology,
        confluences: formConfluences,
        screenshots: formScreenshots,
        screenshot_url: primaryScreenshotUrl,
        notes: formNotes.trim() || undefined,
        created_at: getTodayJalaliWithTime(),
        is_draft: formIsDraft,
      });
      soundFx.playCheckmark();
    }

    setFormSubmitSuccess(true);
    setTimeout(() => setFormSubmitSuccess(false), 3000);
    resetTradeForm();
  };

  const startEditTrade = (trade: Trade) => {
    setEditingTrade(trade);
    setFormDate(trade.date_jalali);
    setFormTime(trade.time);
    setFormSymbol(trade.symbol);
    setFormDirection(trade.direction);
    setFormEntry(trade.entry_price.toString());
    setFormSL(trade.stop_loss.toString());
    setFormTP(trade.take_profit.toString());
    setFormOutcome(trade.outcome);
    setFormNetPnL(trade.net_pnl !== undefined ? trade.net_pnl.toString() : '');
    setFormRealizedRR(trade.realized_rr !== undefined ? trade.realized_rr.toString() : '0');
    setFormPsychology(trade.psychology);
    setFormConfluences(trade.confluences || []);

    // Ensure trade's custom confluences are in availableConfluences library
    if (trade.confluences && trade.confluences.length > 0) {
      setAvailableConfluences((prev) => {
        const missing = trade.confluences!.filter((c) => !prev.includes(c));
        if (missing.length > 0) return [...prev, ...missing];
        return prev;
      });
    }

    // Load multi-screenshots with fallback to legacy screenshot_url
    if (trade.screenshots && trade.screenshots.length > 0) {
      setFormScreenshots(trade.screenshots);
    } else if (trade.screenshot_url) {
      setFormScreenshots([
        {
          id: `legacy_${trade.id}`,
          url: trade.screenshot_url,
          title: 'اسکرین‌شات چارت ستاپ',
          type: 'upload',
        },
      ]);
    } else {
      setFormScreenshots([]);
    }

    setFormIsDraft(!!trade.is_draft);
    setFormNotes(trade.notes || '');

    // Ensure Section ③ is expanded
    if (!accordion.newTrade) {
      setAccordion((prev) => ({ ...prev, newTrade: true }));
    }

    // Smooth scroll into form view
    setTimeout(() => {
      formSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
  };

  // -------------------------------------------------------------
  // ④ TRADING ANALYTICS & CANVAS EQUITY CURVE (EXCLUDES DRAFTS)
  // -------------------------------------------------------------
  const equityCanvasRef = useRef<HTMLCanvasElement>(null);

  // Exclude draft setups from performance analytics, win-rate & equity curve
  const safeTrades = trades || [];
  const liveTrades = safeTrades.filter((t) => t && !t.is_draft);
  const completedTrades = liveTrades.filter((t) => t.outcome !== 'open');
  const totalTradesCount = completedTrades.length;
  const winTrades = completedTrades.filter((t) => t.outcome === 'win');
  const lossTrades = completedTrades.filter((t) => t.outcome === 'loss');
  const beTrades = completedTrades.filter((t) => t.outcome === 'breakeven');

  const winCount = winTrades.length;
  const lossCount = lossTrades.length;
  const beCount = beTrades.length;
  const winRate = totalTradesCount > 0 ? Math.round((winCount / totalTradesCount) * 100) : 0;

  const totalNetPnL = completedTrades.reduce((acc, t) => acc + (t.net_pnl || 0), 0);
  const grossProfit = winTrades.reduce((acc, t) => acc + (t.net_pnl || 0), 0);
  const grossLoss = Math.abs(lossTrades.reduce((acc, t) => acc + (t.net_pnl || 0), 0));
  const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? 99 : 0;

  const avgWinningRR =
    winTrades.length > 0
      ? winTrades.reduce((acc, t) => acc + (t.realized_rr || 0), 0) / winTrades.length
      : 0;

  // Psychology statistics
  const disciplinedTrades = completedTrades.filter((t) => t.psychology === 'disciplined');
  const emotionalTrades = completedTrades.filter(
    (t) => t.psychology === 'emotional' || t.psychology === 'revenge' || t.psychology === 'fomo'
  );

  const disciplinedWinRate =
    disciplinedTrades.length > 0
      ? Math.round(
          (disciplinedTrades.filter((t) => t.outcome === 'win').length / disciplinedTrades.length) * 100
        )
      : 0;

  const emotionalWinRate =
    emotionalTrades.length > 0
      ? Math.round(
          (emotionalTrades.filter((t) => t.outcome === 'win').length / emotionalTrades.length) * 100
        )
      : 0;

  // Draw Equity Curve on Canvas
  useEffect(() => {
    if (!accordion.analytics) return;
    const canvas = equityCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set high-DPI scaling
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    const width = rect.width || 600;
    const height = 220;

    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);

    ctx.clearRect(0, 0, width, height);

    // Build equity curve data points
    const initialCapital = formBalance || riskSettings.balance || 10000;
    let currentEquity = initialCapital;

    const points: { label: string; equity: number }[] = [
      { label: 'شروع', equity: initialCapital },
    ];

    const sortedChronological = [...completedTrades].reverse();
    sortedChronological.forEach((t, idx) => {
      currentEquity += t.net_pnl || 0;
      points.push({
        label: t.symbol || `#${idx + 1}`,
        equity: currentEquity,
      });
    });

    if (points.length < 2) {
      ctx.fillStyle = '#64748b';
      ctx.font = '12px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(
        'پس از ثبت اولین معامله بسته، نمودار رشد سرمایه در این قسمت ترسیم می‌شود.',
        width / 2,
        height / 2
      );
      return;
    }

    const equities = points.map((p) => p.equity);
    const minVal = Math.min(...equities) * 0.98;
    const maxVal = Math.max(...equities) * 1.02;
    const range = maxVal - minVal || 1;

    const padding = { top: 25, right: 25, bottom: 35, left: 55 };
    const chartW = width - padding.left - padding.right;
    const chartH = height - padding.top - padding.bottom;

    const getX = (index: number) => padding.left + (index / (points.length - 1)) * chartW;
    const getY = (val: number) => padding.top + chartH - ((val - minVal) / range) * chartH;

    // Background Grid lines
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 1;
    const gridSteps = 4;
    for (let i = 0; i <= gridSteps; i++) {
      const gVal = minVal + (range / gridSteps) * i;
      const gy = getY(gVal);
      ctx.beginPath();
      ctx.moveTo(padding.left, gy);
      ctx.lineTo(width - padding.right, gy);
      ctx.stroke();

      // Axis labels (USD)
      ctx.fillStyle = '#64748b';
      ctx.font = '10px monospace';
      ctx.textAlign = 'right';
      ctx.fillText(`$${Math.round(gVal).toLocaleString()}`, padding.left - 6, gy + 3);
    }

    // Baseline (Initial Balance)
    const baselineY = getY(initialCapital);
    ctx.setLineDash([4, 4]);
    ctx.strokeStyle = '#475569';
    ctx.beginPath();
    ctx.moveTo(padding.left, baselineY);
    ctx.lineTo(width - padding.right, baselineY);
    ctx.stroke();
    ctx.setLineDash([]);

    // Fill gradient under curve
    const isProfitable = currentEquity >= initialCapital;
    const gradient = ctx.createLinearGradient(0, padding.top, 0, height - padding.bottom);
    if (isProfitable) {
      gradient.addColorStop(0, 'rgba(16, 185, 129, 0.35)');
      gradient.addColorStop(1, 'rgba(16, 185, 129, 0.0)');
    } else {
      gradient.addColorStop(0, 'rgba(244, 63, 94, 0.35)');
      gradient.addColorStop(1, 'rgba(244, 63, 94, 0.0)');
    }

    ctx.beginPath();
    points.forEach((p, idx) => {
      const x = getX(idx);
      const y = getY(p.equity);
      if (idx === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.lineTo(getX(points.length - 1), height - padding.bottom);
    ctx.lineTo(getX(0), height - padding.bottom);
    ctx.closePath();
    ctx.fillStyle = gradient;
    ctx.fill();

    // Draw main curve stroke
    ctx.beginPath();
    ctx.strokeStyle = isProfitable ? '#10b981' : '#f43f5e';
    ctx.lineWidth = 2.5;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    points.forEach((p, idx) => {
      const x = getX(idx);
      const y = getY(p.equity);
      if (idx === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();

    // Draw point markers
    points.forEach((p, idx) => {
      const x = getX(idx);
      const y = getY(p.equity);
      ctx.beginPath();
      ctx.arc(x, y, 3.5, 0, Math.PI * 2);
      ctx.fillStyle = isProfitable ? '#10b981' : '#f43f5e';
      ctx.fill();
      ctx.strokeStyle = '#020617';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Label on X-axis
      if (idx === 0 || idx === points.length - 1 || idx % Math.ceil(points.length / 5) === 0) {
        ctx.fillStyle = '#94a3b8';
        ctx.font = '9px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(p.label, x, height - 12);
      }
    });
  }, [trades, formBalance, riskSettings.balance, accordion.analytics]);

  // -------------------------------------------------------------
  // ⑤ TRADE HISTORY LOGS STATES & FILTERING
  // -------------------------------------------------------------
  const [tradeFilter, setTradeFilter] = useState<'all' | 'win' | 'loss' | 'breakeven' | 'open'>('all');
  const [setupStateFilter, setSetupStateFilter] = useState<'all' | 'live' | 'draft'>('all');
  const [psychologyFilter, setPsychologyFilter] = useState<'all' | TradePsychology>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [draggedTradeId, setDraggedTradeId] = useState<number | null>(null);
  const [dragOverTradeId, setDragOverTradeId] = useState<number | null>(null);

  const filteredTrades = safeTrades.filter((trade) => {
    if (!trade) return false;
    if (setupStateFilter === 'live' && trade.is_draft) return false;
    if (setupStateFilter === 'draft' && !trade.is_draft) return false;
    if (tradeFilter !== 'all' && trade.outcome !== tradeFilter) return false;
    if (psychologyFilter !== 'all' && trade.psychology !== psychologyFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchSymbol = trade.symbol.toLowerCase().includes(q);
      const matchNotes = (trade.notes || '').toLowerCase().includes(q);
      const matchConfluences = (trade.confluences || []).some((c) => c.toLowerCase().includes(q));
      if (!matchSymbol && !matchNotes && !matchConfluences) return false;
    }
    return true;
  });

  // Drag and Drop reordering
  const handleDragStart = (e: React.DragEvent, id: number) => {
    setDraggedTradeId(id);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent, id: number) => {
    e.preventDefault();
    if (id !== dragOverTradeId) {
      setDragOverTradeId(id);
    }
  };

  const handleDrop = async (e: React.DragEvent, targetId: number) => {
    e.preventDefault();
    if (draggedTradeId === null || draggedTradeId === targetId) {
      setDraggedTradeId(null);
      setDragOverTradeId(null);
      return;
    }

    const curIndex = trades.findIndex((t) => t.id === draggedTradeId);
    const targetIndex = trades.findIndex((t) => t.id === targetId);

    if (curIndex !== -1 && targetIndex !== -1) {
      const reordered = [...trades];
      const [moved] = reordered.splice(curIndex, 1);
      reordered.splice(targetIndex, 0, moved);
      await onReorderTrades(reordered);
    }

    setDraggedTradeId(null);
    setDragOverTradeId(null);
  };

  return (
    <div className="space-y-5 pb-24">
      {/* ========================================================= */}
      {/* ① TRADE STRATEGY & PLAN EDITOR (استراتژی و پلان معاملاتی - Collapsible) */}
      {/* ========================================================= */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-lg transition-all duration-300">
        <div
          onClick={() => toggleSection('strategy')}
          className="p-4 bg-slate-850/80 border-b border-slate-800 flex items-center justify-between cursor-pointer select-none"
        >
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-purple-500/20 text-purple-400 flex items-center justify-center border border-purple-500/30">
              <FileText className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <span>استراتژی و پلان معاملاتی (Trading Strategy & Rules)</span>
                {strategySavedNotice && (
                  <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded-full border border-emerald-500/30 animate-pulse">
                    ذخیره شد ✓
                  </span>
                )}
              </h3>
              <p className="text-[11px] text-slate-400">
                قوانین ورود به معامله، مدیریت ریسک اسمارت مانی (SMC) و خط قرمزها
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              aria-label="تغییر وضعیت نمایش استراتژی"
            >
              {accordion.strategy ? (
                <ChevronUp className="w-5 h-5 text-purple-400" />
              ) : (
                <ChevronDown className="w-5 h-5 text-slate-400" />
              )}
            </button>
          </div>
        </div>

        {accordion.strategy && (
          <div className="p-4 space-y-3">
            {/* Core SMC Structure & Bias Principle Card (Editable & Saveable Golden Rules) */}
            <div className="p-3.5 rounded-2xl bg-gradient-to-r from-purple-950/40 via-slate-850 to-indigo-950/40 border border-purple-500/30 text-xs text-slate-300 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span className="font-bold text-purple-300 flex items-center gap-1.5 text-xs">
                  <Sparkles className="w-3.5 h-3.5 text-purple-400" />
                  قوانین طلایی ترید و ساختار بازار (Golden Trading Rules):
                </span>
                <div className="flex items-center gap-2">
                  {goldenRulesSavedNotice && (
                    <span className="text-[11px] text-emerald-400 font-bold flex items-center gap-1">
                      <Check className="w-3.5 h-3.5" />
                      ذخیره شد
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      if (isEditingGoldenRules) {
                        handleSaveGoldenRulesClick();
                      } else {
                        setIsEditingGoldenRules(true);
                      }
                    }}
                    className="px-2.5 py-1 rounded-xl bg-purple-600/30 hover:bg-purple-600/50 text-purple-300 border border-purple-500/40 text-xs font-semibold flex items-center gap-1.5 transition-colors"
                  >
                    {isEditingGoldenRules ? (
                      <>
                        <Check className="w-3 h-3 text-emerald-400" />
                        <span>ذخیره قوانین طلایی</span>
                      </>
                    ) : (
                      <>
                        <Edit2 className="w-3 h-3" />
                        <span>ویرایش قوانین طلایی</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {isEditingGoldenRules ? (
                <div className="space-y-2 pt-1">
                  <textarea
                    value={goldenRulesText}
                    onChange={(e) => setGoldenRulesText(e.target.value)}
                    rows={4}
                    placeholder="قوانین طلایی معاملات خود را وارد کنید..."
                    className="w-full bg-slate-950 border border-purple-500/40 text-white text-xs rounded-xl p-2.5 focus:outline-none focus:border-purple-400 leading-relaxed font-mono"
                  />
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setGoldenRulesText(riskSettings.golden_rules || DEFAULT_GOLDEN_RULES);
                        setIsEditingGoldenRules(false);
                      }}
                      className="px-2.5 py-1 rounded-lg bg-slate-800 text-slate-400 text-xs hover:text-white"
                    >
                      انصراف
                    </button>
                    <button
                      type="button"
                      onClick={handleSaveGoldenRulesClick}
                      className="px-3 py-1 rounded-lg bg-purple-600 text-white text-xs font-bold hover:bg-purple-500 shadow-sm"
                    >
                      ذخیره تغییرات
                    </button>
                  </div>
                </div>
              ) : (
                <div className="text-[11px] text-slate-200 whitespace-pre-line leading-relaxed font-medium bg-slate-950/40 p-2.5 rounded-xl border border-purple-500/20">
                  {goldenRulesText}
                </div>
              )}
            </div>

            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-400">
                متن استراتژی و قوانین ترید خود را بنویسید یا ویرایش کنید:
              </span>
              <button
                type="button"
                onClick={() => setIsEditingStrategy(!isEditingStrategy)}
                className="text-xs text-purple-400 hover:text-purple-300 font-medium flex items-center gap-1"
              >
                <Edit2 className="w-3.5 h-3.5" />
                <span>{isEditingStrategy ? 'حالت مطالعه' : 'ویرایش متن استراتژی'}</span>
              </button>
            </div>

            {isEditingStrategy ? (
              <div className="space-y-2">
                <textarea
                  value={strategyText}
                  onChange={(e) => setStrategyText(e.target.value)}
                  rows={8}
                  className="w-full bg-slate-950 border border-slate-750 text-white rounded-2xl p-3.5 text-xs leading-relaxed font-sans focus:outline-none focus:border-purple-500 resize-y"
                  placeholder="اصول استراتژی، قوانین ورود، مدیریت سرمایه و سشن‌های معاملاتی را اینجا یادداشت کنید..."
                />
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setStrategyText(strategyContent);
                      setIsEditingStrategy(false);
                    }}
                    className="px-3 py-1.5 text-xs text-slate-400 hover:text-slate-200 bg-slate-800 rounded-xl"
                  >
                    انصراف
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveStrategyClick}
                    className="px-4 py-1.5 text-xs font-bold text-white bg-purple-600 hover:bg-purple-500 rounded-xl shadow transition-colors flex items-center gap-1.5"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>ذخیره تغییرات استراتژی</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="bg-slate-950/70 border border-slate-800/80 rounded-2xl p-3.5 text-xs text-slate-300 leading-relaxed whitespace-pre-line max-h-60 overflow-y-auto">
                {strategyText ? (
                  strategyText
                ) : (
                  <p className="text-slate-500 italic">
                    هنوز استراتژی ثبت نشده است. روی دکمه ویرایش کلیک کنید تا قوانین معاملاتی خود را بنویسید.
                  </p>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ========================================================= */}
      {/* ② PRE-TRADE CHECKLIST (چک‌لیست قبل از معامله - Collapsible) */}
      {/* ========================================================= */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-lg transition-all duration-300">
        <div
          onClick={() => toggleSection('checklist')}
          className="p-4 bg-slate-850/80 border-b border-slate-800 flex items-center justify-between cursor-pointer select-none"
        >
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center border border-emerald-500/30">
              <CheckSquare className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <span>چک‌لیست تاییدیه‌های قبل از معامله (Pre-Trade Checklist)</span>
                <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded-full font-mono border border-emerald-500/30">
                  {toPersianDigits(checkedCount)} از {toPersianDigits(totalChecklist)} تاییدیه
                </span>
              </h3>
              <p className="text-[11px] text-slate-400">
                تاییدیه‌های ستاپ اسمارت مانی (SMC)، نقدینگی و ساختار قبل از ورود
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              aria-label="تغییر وضعیت نمایش چک‌لیست"
            >
              {accordion.checklist ? (
                <ChevronUp className="w-5 h-5 text-emerald-400" />
              ) : (
                <ChevronDown className="w-5 h-5 text-slate-400" />
              )}
            </button>
          </div>
        </div>

        {accordion.checklist && (
          <div className="p-4 space-y-3.5">
            {/* Readiness progress bar & Reset button */}
            <div className="flex items-center justify-between gap-3 bg-slate-950/60 p-3 rounded-2xl border border-slate-800">
              <div className="flex-1 space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-400 font-medium">میزان آمادگی و اعتبار ستاپ:</span>
                  <span
                    className={`font-bold font-mono ${
                      checklistProgress >= 80
                        ? 'text-emerald-400'
                        : checklistProgress >= 50
                        ? 'text-amber-400'
                        : 'text-rose-400'
                    }`}
                  >
                    {toPersianDigits(checklistProgress)}٪
                  </span>
                </div>
                <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-300 ${
                      checklistProgress >= 80
                        ? 'bg-emerald-500'
                        : checklistProgress >= 50
                        ? 'bg-amber-500'
                        : 'bg-rose-500'
                    }`}
                    style={{ width: `${checklistProgress}%` }}
                  />
                </div>
              </div>

              <button
                type="button"
                onClick={async () => {
                  await onResetChecklist();
                  soundFx.playCheckmark();
                }}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs flex items-center gap-1.5 transition-colors border border-slate-700 shrink-0"
                title="پاک کردن تیک تمام تاییدیه‌ها برای ترید جدید"
              >
                <RotateCcw className="w-3.5 h-3.5 text-slate-400" />
                <span>ریست تیک‌ها</span>
              </button>
            </div>

            {/* Checklist items list with Drag & Drop Reordering */}
            <div className="space-y-2" id="pretrade-checklist-items-container">
              {sortedChecklistItems.map((item, index) => {
                const isEditing = editingChecklistId === item.id;
                const isDragging = draggedChecklistId === item.id;
                const isOver = dragOverChecklistId === item.id;

                return (
                  <div
                    key={item.id}
                    draggable={!isEditing}
                    onDragStart={(e) => {
                      if (item.id) {
                        e.dataTransfer.setData('text/plain', String(item.id));
                        e.dataTransfer.effectAllowed = 'move';
                        setDraggedChecklistId(item.id);
                      }
                    }}
                    onDragOver={(e) => {
                      e.preventDefault();
                      e.dataTransfer.dropEffect = 'move';
                      if (item.id && draggedChecklistId !== item.id) {
                        setDragOverChecklistId(item.id);
                      }
                    }}
                    onDragLeave={() => {
                      if (dragOverChecklistId === item.id) {
                        setDragOverChecklistId(null);
                      }
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      if (item.id) {
                        handleDropChecklist(item.id);
                      }
                    }}
                    onDragEnd={() => {
                      setDraggedChecklistId(null);
                      setDragOverChecklistId(null);
                    }}
                    className={`p-2.5 rounded-2xl border transition-all flex items-center justify-between gap-2 ${
                      isDragging
                        ? 'opacity-40 scale-[0.98] border-dashed border-indigo-500 bg-slate-900'
                        : isOver
                        ? 'border-emerald-400 bg-emerald-950/30 scale-[1.01] shadow-md'
                        : item.is_checked
                        ? 'bg-emerald-950/20 border-emerald-500/40 text-emerald-100 shadow-sm'
                        : 'bg-slate-850/60 border-slate-800 text-slate-300 hover:border-slate-700'
                    }`}
                  >
                    {isEditing ? (
                      <div className="flex items-center gap-2 flex-1">
                        <input
                          type="text"
                          value={editingChecklistText}
                          onChange={(e) => setEditingChecklistText(e.target.value)}
                          className="w-full bg-slate-900 border border-blue-500 text-white text-xs rounded-xl px-2.5 py-1 focus:outline-none"
                          autoFocus
                        />
                        <button
                          type="button"
                          onClick={() => handleSaveEditChecklist(item)}
                          className="p-1 rounded-lg bg-emerald-600 text-white"
                        >
                          <Check className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingChecklistId(null)}
                          className="p-1 rounded-lg bg-slate-700 text-slate-300"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : (
                      <>
                        {/* Drag Handle & Checkbox */}
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          <div
                            className="cursor-grab active:cursor-grabbing p-1 text-slate-500 hover:text-slate-300 transition-colors shrink-0 rounded-lg hover:bg-slate-800/60"
                            title="برای تغییر ترتیب بکشید (Drag & Drop)"
                          >
                            <GripVertical className="w-4 h-4" />
                          </div>

                          <div
                            onClick={async () => {
                              if (item.id) {
                                await onToggleChecklistItem(item.id);
                                soundFx.playCheckmark();
                              }
                            }}
                            className="flex items-center gap-2.5 flex-1 cursor-pointer select-none min-w-0"
                          >
                            <div
                              className={`w-5 h-5 rounded-lg flex items-center justify-center border transition-colors shrink-0 ${
                                item.is_checked
                                  ? 'bg-emerald-500 border-emerald-400 text-slate-950 font-bold'
                                  : 'bg-slate-900 border-slate-700 text-transparent hover:border-slate-500'
                              }`}
                            >
                              <Check className="w-3.5 h-3.5 stroke-[3]" />
                            </div>
                            <span
                              className={`text-xs truncate ${
                                item.is_checked ? 'line-through text-slate-400' : 'text-slate-200'
                              }`}
                            >
                              {item.title}
                            </span>
                          </div>
                        </div>

                        {/* Order Buttons & Action Controls */}
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => item.id && handleMoveChecklist(item.id, 'up')}
                            disabled={index === 0}
                            className="p-1 text-slate-500 hover:text-slate-200 disabled:opacity-20 disabled:hover:text-slate-500 rounded-lg transition-colors"
                            title="انتقال به بالا"
                          >
                            <ChevronUp className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => item.id && handleMoveChecklist(item.id, 'down')}
                            disabled={index === sortedChecklistItems.length - 1}
                            className="p-1 text-slate-500 hover:text-slate-200 disabled:opacity-20 disabled:hover:text-slate-500 rounded-lg transition-colors"
                            title="انتقال به پایین"
                          >
                            <ChevronDown className="w-3.5 h-3.5" />
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              setEditingChecklistId(item.id ?? null);
                              setEditingChecklistText(item.title);
                            }}
                            className="p-1 text-slate-400 hover:text-blue-400 rounded-lg transition-colors ml-1"
                            title="ویرایش عنوان"
                          >
                            <Edit2 className="w-3 h-3" />
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              if (item.id) {
                                setChecklistToDelete(item);
                              }
                            }}
                            className="p-1 text-slate-400 hover:text-rose-400 rounded-lg transition-colors"
                            title="حذف تاییدیه"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Add new checklist item form */}
            <form onSubmit={handleAddChecklist} className="flex gap-2 pt-2">
              <input
                type="text"
                value={newChecklistText}
                onChange={(e) => setNewChecklistText(e.target.value)}
                placeholder="+ افزودن تاییدیه جدید به چک‌لیست..."
                className="flex-1 bg-slate-950 border border-slate-750 text-white text-xs rounded-xl px-3 py-2 focus:outline-none focus:border-emerald-500"
              />
              <button
                type="submit"
                disabled={!newChecklistText.trim()}
                className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-xl text-xs font-medium flex items-center gap-1 transition-colors shrink-0"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>افزودن</span>
              </button>
            </form>
          </div>
        )}
      </div>

      {/* ========================================================= */}
      {/* ③ NEW TRADE FORM WITH INTEGRATED CALCULATOR (معامله جدید + ماشین حساب ادغام‌شده - Collapsible) */}
      {/* ========================================================= */}
      <div
        ref={formSectionRef}
        className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-xl transition-all duration-300"
      >
        <div
          onClick={() => toggleSection('newTrade')}
          className="p-4 bg-gradient-to-r from-blue-950/60 via-slate-850 to-indigo-950/60 border-b border-slate-800 flex items-center justify-between cursor-pointer select-none"
        >
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-blue-500/20 text-blue-400 flex items-center justify-center border border-blue-500/30">
              <TrendingUp className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <span>{editingTrade ? 'ویرایش معامله' : 'معامله جدید + ماشین‌حساب ادغام‌شده'}</span>
                {editingTrade && (
                  <span className="text-[10px] bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded-full border border-amber-500/30">
                    در حال ویرایش معامله #{editingTrade.id}
                  </span>
                )}
                {formSubmitSuccess && (
                  <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded-full border border-emerald-500/30 animate-pulse">
                    با موفقیت در ژورنال ثبت شد ✓
                  </span>
                )}
              </h3>
              <p className="text-[11px] text-slate-400">
                محاسبه خودکار حجم لات و ریوراد، مدیریت ریسک و ثبت مستقیم معامله در ژورنال
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {!accordion.newTrade && (
              <div className="hidden sm:flex items-center gap-2 text-xs font-mono bg-slate-800/80 px-2.5 py-1 rounded-xl border border-slate-700">
                <span className="text-slate-400">{formSymbol}:</span>
                <span className="text-emerald-400 font-bold">{calculatedLotSize.toFixed(2)} Lot</span>
                <span className="text-slate-500">|</span>
                <span className="text-slate-400">R:R:</span>
                <span className="text-amber-400 font-bold">{expectedRR > 0 ? `1:${expectedRR.toFixed(2)}` : '-'}</span>
              </div>
            )}
            <button
              type="button"
              className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              aria-label="تغییر وضعیت نمایش فرم معامله"
            >
              {accordion.newTrade ? (
                <ChevronUp className="w-5 h-5 text-blue-400" />
              ) : (
                <ChevronDown className="w-5 h-5 text-slate-400" />
              )}
            </button>
          </div>
        </div>

        {accordion.newTrade && (
          <form onSubmit={handleTradeSubmit} className="p-4 space-y-4">
            {/* Prop Firm Drawdown Safeguard Alert */}
            {isHighRiskForProp && (
              <div
                className={`p-3 rounded-2xl flex items-center gap-2.5 text-xs border ${
                  isExceedingProp
                    ? 'bg-rose-950/50 border-rose-500/60 text-rose-200'
                    : 'bg-amber-950/50 border-amber-500/60 text-amber-200'
                }`}
              >
                <ShieldAlert className="w-5 h-5 shrink-0 text-rose-400" />
                <div className="flex-1">
                  <span className="font-bold">
                    {isExceedingProp
                      ? 'هشدار جدی سقف دراودان روزانه چالش پراپ!'
                      : 'توجه به ریسک مجاز روزانه پراپ:'}
                  </span>{' '}
                  ریسک این ترید ({formRiskPercent}٪ معادل ${autoRiskUSD.toFixed(0)}) به سقف دراودان روزانه نزدیک یا از آن فراتر است (سقف روزانه: {propLimitPercent}٪).
                </div>
              </div>
            )}

            {/* Row 0: Live Trade vs Draft Setup Toggle */}
            <div className="bg-slate-950/60 p-3 rounded-2xl border border-slate-800 flex items-center justify-between gap-3">
              <div>
                <span className="text-xs font-bold text-slate-200 block">وضعیت ستاپ (Setup State):</span>
                <span className="text-[11px] text-slate-400">
                  {formIsDraft
                    ? 'پیش‌نویس استراتژی (از محاسبات وین‌ریت و رشد سرمایه استثنا می‌شود)'
                    : 'معامله واقعی / زنده (در آمار عملکرد و سود/زیان لحاظ می‌شود)'}
                </span>
              </div>
              <div className="flex items-center gap-1.5 bg-slate-900 p-1 rounded-xl border border-slate-750">
                <button
                  type="button"
                  onClick={() => setFormIsDraft(false)}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                    !formIsDraft
                      ? 'bg-blue-600 text-white shadow-md'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  معامله زنده (Live)
                </button>
                <button
                  type="button"
                  onClick={() => setFormIsDraft(true)}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                    formIsDraft
                      ? 'bg-amber-600 text-white shadow-md'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  پیش‌نویس (Draft)
                </button>
              </div>
            </div>

            {/* Row 1: Symbol & Direction (Long / Short) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-slate-400 mb-1.5 font-medium">نماد معاملاتی (Symbol)</label>
                <select
                  value={formSymbol}
                  onChange={(e) => setFormSymbol(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-750 text-white font-mono text-xs rounded-xl px-3 py-2 focus:outline-none focus:border-blue-500"
                >
                  <option value="XAUUSD">XAUUSD (انس جهانی طلا)</option>
                  <option value="EURUSD">EURUSD</option>
                  <option value="GBPUSD">GBPUSD</option>
                  <option value="USDJPY">USDJPY</option>
                  <option value="BTCUSD">BTCUSD (بیت‌کوین)</option>
                  <option value="US30">US30 (داوجونز)</option>
                  <option value="NAS100">NAS100 (نزدک)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-1.5 font-medium">جهت پوزیشن (Direction)</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setFormDirection('long')}
                    className={`py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
                      formDirection === 'long'
                        ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-950 border border-emerald-400'
                        : 'bg-slate-950 text-slate-400 border border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <ArrowUpRight className="w-4 h-4" />
                    <span>خرید (BUY / LONG)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormDirection('short')}
                    className={`py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
                      formDirection === 'short'
                        ? 'bg-rose-600 text-white shadow-lg shadow-rose-950 border border-rose-400'
                        : 'bg-slate-950 text-slate-400 border border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <ArrowDownRight className="w-4 h-4" />
                    <span>فروش (SELL / SHORT)</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Row 2: Account Balance & Risk % */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-slate-950/40 p-3 rounded-2xl border border-slate-800/80">
              <div>
                <label className="block text-xs text-slate-400 mb-1.5 font-medium">بالانس حساب ترید ($)</label>
                <div className="relative">
                  <input
                    type="number"
                    dir="ltr"
                    value={formBalance}
                    onChange={(e) => setFormBalance(parseFloat(e.target.value) || 0)}
                    className="w-full bg-slate-950 border border-slate-750 text-white font-mono text-xs rounded-xl px-3 py-2 focus:outline-none focus:border-blue-500 text-left pl-8"
                    placeholder="10000"
                  />
                  <DollarSign className="w-4 h-4 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-1.5 font-medium">درصد ریسک در معامله (%)</label>
                <div className="relative">
                  <input
                    type="number"
                    dir="ltr"
                    step="0.1"
                    min="0.1"
                    max="10"
                    value={formRiskPercent}
                    onChange={(e) => setFormRiskPercent(parseFloat(e.target.value) || 0)}
                    className={`w-full bg-slate-950 border text-white font-mono text-xs rounded-xl px-3 py-2 focus:outline-none text-left pl-8 ${
                      isExceedingProp
                        ? 'border-rose-500 text-rose-300'
                        : isHighRiskForProp
                        ? 'border-amber-500'
                        : 'border-slate-750 focus:border-blue-500'
                    }`}
                    placeholder="1.0"
                  />
                  <Percent className="w-4 h-4 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
              </div>
            </div>

            {/* Row 3: Price Levels (Entry, Stop Loss, Take Profit) */}
            <div className="grid grid-cols-3 gap-2.5">
              <div>
                <label className="block text-[11px] text-slate-400 mb-1 font-medium">نقطه ورود (Entry)</label>
                <input
                  type="number"
                  dir="ltr"
                  step="any"
                  value={formEntry}
                  onChange={(e) => setFormEntry(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-750 text-white font-mono text-xs rounded-xl px-2.5 py-2 focus:outline-none focus:border-blue-500 text-left"
                  placeholder="2500.00"
                />
              </div>

              <div>
                <label className="block text-[11px] text-slate-400 mb-1 font-medium">حد ضرر (SL)</label>
                <input
                  type="number"
                  dir="ltr"
                  step="any"
                  value={formSL}
                  onChange={(e) => setFormSL(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-750 text-white font-mono text-xs rounded-xl px-2.5 py-2 focus:outline-none focus:border-rose-500 text-left"
                  placeholder="2495.00"
                />
              </div>

              <div>
                <label className="block text-[11px] text-slate-400 mb-1 font-medium">حد سود (TP)</label>
                <input
                  type="number"
                  dir="ltr"
                  step="any"
                  value={formTP}
                  onChange={(e) => setFormTP(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-750 text-white font-mono text-xs rounded-xl px-2.5 py-2 focus:outline-none focus:border-emerald-500 text-left"
                  placeholder="2515.00"
                />
              </div>
            </div>

            {/* Row 4: AUTO-CALCULATED DYNAMIC FIELDS (Live Highlight Cards) */}
            <div className="bg-slate-950/70 border border-blue-500/30 p-3.5 rounded-2xl space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-blue-400 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5" />
                  خروجی‌های خودکار ماشین‌حساب حجم و ریسک:
                </span>
                <span className="text-[10px] text-slate-400">
                  قرارداد: {formSymbol === 'XAUUSD' ? '100 انس طلا' : 'استاندارد'}
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 pt-1">
                {/* 1. Auto Lot Size */}
                <div className="bg-slate-900/90 p-2.5 rounded-xl border border-slate-800">
                  <span className="text-[10px] text-slate-400 block">حجم محاسبه‌شده</span>
                  <span className="text-sm font-bold text-emerald-400 font-mono block mt-0.5">
                    {calculatedLotSize > 0 ? calculatedLotSize.toFixed(2) : '0.00'}{' '}
                    <span className="text-[10px] text-slate-400 font-normal">Lot</span>
                  </span>
                </div>

                {/* 2. Risk USD */}
                <div className="bg-slate-900/90 p-2.5 rounded-xl border border-slate-800">
                  <span className="text-[10px] text-slate-400 block">ریسک دلاری واقعی ($)</span>
                  <span className={`text-sm font-bold font-mono block mt-0.5 ${isExceedingProp ? 'text-rose-400' : 'text-rose-300'}`}>
                    ${actualDollarRisk > 0 ? actualDollarRisk.toFixed(actualDollarRisk % 1 === 0 ? 0 : 2) : autoRiskUSD.toFixed(0)}{' '}
                    <span className="text-[10px] text-slate-400 font-normal">
                      ({formBalance > 0 ? ((actualDollarRisk / formBalance) * 100).toFixed(2) : formRiskPercent}٪)
                    </span>
                  </span>
                </div>

                {/* 3. Pips at Risk */}
                <div className="bg-slate-900/90 p-2.5 rounded-xl border border-slate-800">
                  <span className="text-[10px] text-slate-400 block">فاصله حد ضرر</span>
                  <span className="text-sm font-bold text-amber-400 font-mono block mt-0.5">
                    {pipsAtRisk.toFixed(1)}{' '}
                    <span className="text-[10px] text-slate-400 font-normal">پیپ</span>
                  </span>
                </div>

                {/* 4. Expected R:R Ratio */}
                <div className="bg-slate-900/90 p-2.5 rounded-xl border border-slate-800">
                  <span className="text-[10px] text-slate-400 block">نسبت R:R انتظاری</span>
                  <span
                    className={`text-sm font-bold font-mono block mt-0.5 ${
                      expectedRR >= 2 ? 'text-emerald-400' : expectedRR >= 1 ? 'text-amber-400' : 'text-rose-400'
                    }`}
                  >
                    {expectedRR > 0 ? `1 : ${expectedRR.toFixed(2)}` : '-'}
                  </span>
                </div>

                {/* 5. Potential Profit */}
                <div className="col-span-2 sm:col-span-1 bg-slate-900/90 p-2.5 rounded-xl border border-slate-800">
                  <span className="text-[10px] text-slate-400 block">سود بالقوه در تارگت</span>
                  <span className="text-sm font-bold text-cyan-400 font-mono block mt-0.5">
                    +${potentialProfitUSD > 0 ? potentialProfitUSD.toFixed(0) : '0'}
                  </span>
                </div>
              </div>
            </div>

            {/* Row 5: Date, Time, Outcome Status, Realized PnL & Realized R:R */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <div>
                <label className="block text-xs text-slate-400 mb-1.5 font-medium">تاریخ و ساعت معامله</label>
                <div className="grid grid-cols-2 gap-2">
                  <JalaliDatePickerField value={formDate} onChange={setFormDate} />
                  <div className="relative">
                    <input
                      type="time"
                      value={formTime}
                      onChange={(e) => setFormTime(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-750 text-white font-mono text-xs rounded-xl px-2.5 py-2 focus:outline-none focus:border-blue-500 text-left pl-8"
                    />
                    <Clock className="w-4 h-4 text-slate-500 absolute left-2 top-1/2 -translate-y-1/2 pointer-events-none" />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-1.5 font-medium">وضعیت نتیجه معامله (Trade Outcome)</label>
                <div className="grid grid-cols-4 gap-1.5">
                  {(
                    [
                      { key: 'open', label: 'باز', color: 'bg-blue-600 border-blue-400' },
                      { key: 'win', label: 'برد', color: 'bg-emerald-600 border-emerald-400' },
                      { key: 'loss', label: 'باخت', color: 'bg-rose-600 border-rose-400' },
                      { key: 'breakeven', label: 'سربه‌سر', color: 'bg-amber-600 border-amber-400' },
                    ] as const
                  ).map((opt) => (
                    <button
                      key={opt.key}
                      type="button"
                      onClick={() => handleOutcomeChange(opt.key)}
                      className={`py-2 px-1 rounded-xl text-xs font-bold transition-all text-center border ${
                        formOutcome === opt.key
                          ? `${opt.color} text-white shadow-md`
                          : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Row 6: Realized PnL & Realized R:R (when outcome is not open) */}
            {formOutcome !== 'open' && (
              <div className="grid grid-cols-2 gap-3 p-3 bg-slate-950/60 rounded-2xl border border-slate-800 animate-fadeIn">
                <div>
                  <label className="block text-xs text-slate-400 mb-1 font-medium">سود/زیان خالص دلاری (Net PnL $)</label>
                  <input
                    type="number"
                    dir="ltr"
                    step="any"
                    value={formNetPnL}
                    onChange={(e) => setFormNetPnL(e.target.value)}
                    className={`w-full bg-slate-950 border font-mono text-xs rounded-xl px-3 py-2 focus:outline-none text-left ${
                      parseFloat(formNetPnL) > 0
                        ? 'text-emerald-400 border-emerald-500/60'
                        : parseFloat(formNetPnL) < 0
                        ? 'text-rose-400 border-rose-500/60'
                        : 'text-white border-slate-750'
                    }`}
                    placeholder="مثال: 250 یا -100"
                  />
                </div>

                <div>
                  <label className="block text-xs text-slate-400 mb-1 font-medium">نسبت R:R محقق‌شده</label>
                  <input
                    type="number"
                    dir="ltr"
                    step="0.1"
                    value={formRealizedRR}
                    onChange={(e) => setFormRealizedRR(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-750 text-white font-mono text-xs rounded-xl px-3 py-2 focus:outline-none text-left"
                    placeholder="2.0"
                  />
                </div>
              </div>
            )}

            {/* Row 7: Psychological State Tags */}
            <div>
              <label className="block text-xs text-slate-400 mb-1.5 font-medium">
                وضعیت روانی و روانشناسی هنگام ورود:
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                {[
                  { key: 'disciplined', label: 'منضبط (Disciplined)', icon: Smile, color: 'text-emerald-400 border-emerald-500/40 bg-emerald-950/20' },
                  { key: 'emotional', label: 'هیجانی (Emotional)', icon: Frown, color: 'text-amber-400 border-amber-500/40 bg-amber-950/20' },
                  { key: 'revenge', label: 'انتقامی (Revenge)', icon: AlertTriangle, color: 'text-rose-400 border-rose-500/40 bg-rose-950/20' },
                  { key: 'fomo', label: 'فومو (FOMO)', icon: Zap, color: 'text-purple-400 border-purple-500/40 bg-purple-950/20' },
                  { key: 'fear', label: 'ترس (Fear)', icon: ShieldAlert, color: 'text-indigo-400 border-indigo-500/40 bg-indigo-950/20' },
                ].map((item) => {
                  const Icon = item.icon;
                  const isSelected = formPsychology === item.key;
                  return (
                    <button
                      key={item.key}
                      type="button"
                      onClick={() => setFormPsychology(item.key as TradePsychology)}
                      className={`p-2 rounded-xl text-xs flex items-center justify-center gap-1.5 border transition-all ${
                        isSelected
                          ? `${item.color} font-bold shadow-sm`
                          : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                      }`}
                    >
                      <Icon className="w-3.5 h-3.5" />
                      <span>{item.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Row 8: Dynamic & Editable SMC Confluences Tags */}
            <div className="space-y-2.5 p-3 rounded-2xl bg-slate-950/60 border border-slate-800">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <label className="text-xs text-slate-300 font-semibold flex items-center gap-1.5">
                  <Tag className="w-3.5 h-3.5 text-blue-400" />
                  <span>تاییدیه‌ها و دلایل ورود اسمارت مانی (Smart Money Confluences)</span>
                  {formConfluences.length > 0 && (
                    <span className="bg-blue-950/80 border border-blue-500/40 text-blue-300 text-[10px] font-bold px-2 py-0.5 rounded-full font-mono">
                      {formConfluences.length} تاییدیه انتخاب شده
                    </span>
                  )}
                </label>
                <button
                  type="button"
                  onClick={handleResetConfluencesToDefault}
                  className="text-[11px] text-slate-500 hover:text-slate-300 flex items-center gap-1 transition-colors"
                  title="بازنشانی تگ‌ها به تاییدیه‌های پیش‌فرض اسمارت مانی"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>پیش‌فرض</span>
                </button>
              </div>

              {/* Dynamic Confluences Tags List */}
              <div className="flex flex-wrap gap-1.5">
                {availableConfluences.map((tag) => {
                  const isSelected = formConfluences.includes(tag);
                  const isEditingThis = editingConfluenceTag?.original === tag;

                  if (isEditingThis) {
                    return (
                      <div
                        key={tag}
                        className="flex items-center gap-1 bg-slate-900 border border-blue-500 p-1 rounded-xl shadow-md animate-fadeIn"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <input
                          type="text"
                          autoFocus
                          value={editingConfluenceTag.text}
                          onChange={(e) =>
                            setEditingConfluenceTag((prev) =>
                              prev ? { ...prev, text: e.target.value } : null
                            )
                          }
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              handleSaveEditConfluence();
                            } else if (e.key === 'Escape') {
                              setEditingConfluenceTag(null);
                            }
                          }}
                          className="bg-slate-950 text-white text-xs px-2 py-1 rounded-lg border border-slate-700 focus:outline-none focus:border-blue-400 min-w-[120px]"
                        />
                        <button
                          type="button"
                          onClick={handleSaveEditConfluence}
                          className="p-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white transition-colors"
                          title="ذخیره عنوان تگ"
                        >
                          <Check className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingConfluenceTag(null)}
                          className="p-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
                          title="انصراف"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    );
                  }

                  return (
                    <div
                      key={tag}
                      className={`group inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs transition-all border select-none ${
                        isSelected
                          ? 'bg-blue-600/30 border-blue-400 text-blue-100 font-semibold shadow-sm'
                          : 'bg-slate-900/90 border-slate-750 text-slate-300 hover:border-slate-600 hover:text-white'
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => handleToggleConfluenceTag(tag)}
                        className="flex items-center gap-1.5 focus:outline-none text-right"
                      >
                        <span
                          className={`w-2 h-2 rounded-full transition-colors shrink-0 ${
                            isSelected ? 'bg-blue-400 shadow-sm shadow-blue-400' : 'bg-slate-600'
                          }`}
                        />
                        <span>{tag}</span>
                      </button>

                      <div className="flex items-center gap-0.5 opacity-60 group-hover:opacity-100 transition-opacity mr-0.5">
                        <button
                          type="button"
                          onClick={(e) => handleStartEditConfluence(tag, e)}
                          className="p-0.5 hover:text-blue-300 text-slate-400 transition-colors"
                          title="ویرایش تگ"
                        >
                          <Edit2 className="w-3 h-3" />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => handleDeleteConfluenceTag(tag, e)}
                          className="p-0.5 hover:text-rose-400 text-slate-400 transition-colors"
                          title="حذف تگ"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Add Custom Confluence Input */}
              <div className="flex gap-2 pt-1">
                <input
                  type="text"
                  value={customConfluenceInput}
                  onChange={(e) => setCustomConfluenceInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddCustomConfluence();
                    }
                  }}
                  placeholder="تگ تاییدیه جدید (مثلاً: Liquidity Sweep, MSS, FVG, SMT Divergence)..."
                  className="flex-1 bg-slate-900 border border-slate-750 text-white text-xs rounded-xl px-3 py-2 focus:outline-none focus:border-blue-500 placeholder:text-slate-500"
                />
                <button
                  type="button"
                  onClick={() => handleAddCustomConfluence()}
                  disabled={!customConfluenceInput.trim()}
                  className="px-3.5 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white rounded-xl text-xs font-semibold transition-colors flex items-center gap-1.5 shrink-0"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>افزودن تاییدیه</span>
                </button>
              </div>
            </div>

            {/* Row 9: Chart Screenshot Multi-File Upload & Web Links */}
            <div className="space-y-3" id="trade-screenshots-manager-card">
              <div>
                <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                  <label className="text-xs text-slate-300 font-semibold flex items-center gap-1.5">
                    <ImageIcon className="w-4 h-4 text-blue-400" />
                    <span>تصاویر و اسکرین‌شات‌های چارت تحلیلی (Chart Screenshots)</span>
                    {formScreenshots.length > 0 && (
                      <span className="bg-blue-950/80 border border-blue-500/40 text-blue-300 text-[10px] font-bold px-2 py-0.5 rounded-full font-mono">
                        {formScreenshots.length} تصویر پیوست شده
                      </span>
                    )}
                  </label>

                  {/* Mode Tabs: Files upload vs External Link */}
                  <div className="flex items-center p-0.5 bg-slate-950 rounded-xl border border-slate-800">
                    <button
                      type="button"
                      onClick={() => setActiveUploadTab('files')}
                      className={`px-2.5 py-1 rounded-lg text-xs font-medium flex items-center gap-1 transition-all ${
                        activeUploadTab === 'files'
                          ? 'bg-blue-600 text-white shadow-sm'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      <Upload className="w-3.5 h-3.5" />
                      <span>آپلود فایل‌ها (چندگانه)</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveUploadTab('link')}
                      className={`px-2.5 py-1 rounded-lg text-xs font-medium flex items-center gap-1 transition-all ${
                        activeUploadTab === 'link'
                          ? 'bg-blue-600 text-white shadow-sm'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      <Link2 className="w-3.5 h-3.5" />
                      <span>لینک TradingView / اینترنتی</span>
                    </button>
                  </div>
                </div>

                {/* Hidden Native File Input (multiple enabled) */}
                <input
                  type="file"
                  ref={fileInputRef}
                  accept="image/*"
                  multiple
                  onChange={(e) => {
                    if (e.target.files && e.target.files.length > 0) {
                      handleMultipleImageFiles(e.target.files);
                    }
                  }}
                  className="hidden"
                  id="trade-chart-multiple-file-input"
                />

                {/* TAB 1: Multiple Local File Drag & Drop Zone */}
                {activeUploadTab === 'files' && (
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    onDragOver={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                        handleMultipleImageFiles(e.dataTransfer.files);
                      }
                    }}
                    className="border-2 border-dashed border-slate-750 hover:border-blue-500/70 bg-slate-950/60 hover:bg-slate-900/80 rounded-2xl p-4 text-center cursor-pointer transition-all group select-none"
                  >
                    <div className="flex flex-col items-center justify-center gap-2">
                      <div className="w-10 h-10 rounded-2xl bg-blue-500/10 group-hover:bg-blue-500/20 text-blue-400 flex items-center justify-center border border-blue-500/20 transition-all group-hover:scale-110">
                        {isUploadingImage ? (
                          <Loader2 className="w-5 h-5 animate-spin text-blue-400" />
                        ) : (
                          <Upload className="w-5 h-5" />
                        )}
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-slate-200 group-hover:text-blue-300">
                          {isUploadingImage
                            ? 'در حال ذخیره و پردازش تصاویر...'
                            : 'برای انتخاب یا انداختن یک یا چند اسکرین‌شات کلیک کنید'}
                        </p>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          پشتیبانی از انتخاب همزمان چندین عکس از گالری، دوربین یا کامپیوتر (PNG, JPG, WEBP)
                        </p>
                      </div>
                      <div className="flex items-center gap-2 pt-1 text-[10px] text-slate-400">
                        <span className="px-2 py-0.5 bg-slate-800 rounded-lg flex items-center gap-1">
                          <Camera className="w-3 h-3 text-blue-400" /> دوربین مستقیم
                        </span>
                        <span className="px-2 py-0.5 bg-slate-800 rounded-lg flex items-center gap-1">
                          <ImageIcon className="w-3 h-3 text-emerald-400" /> گالری موبایل
                        </span>
                        <span className="px-2 py-0.5 bg-slate-800 rounded-lg flex items-center gap-1">
                          <Plus className="w-3 h-3 text-indigo-400" /> افزودن چندتایی
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {/* TAB 2: External Link Input Form */}
                {activeUploadTab === 'link' && (
                  <div className="p-3 bg-slate-950/70 border border-slate-800 rounded-2xl space-y-2.5">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <div className="relative">
                        <input
                          type="url"
                          dir="ltr"
                          value={newLinkUrl}
                          onChange={(e) => setNewLinkUrl(e.target.value)}
                          placeholder="https://www.tradingview.com/x/... یا آدرس عکس"
                          className="w-full bg-slate-900 border border-slate-750 text-white font-mono text-xs rounded-xl px-3 py-2 pl-8 focus:outline-none focus:border-blue-500 text-left"
                        />
                        <Link2 className="w-4 h-4 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                      </div>
                      <input
                        type="text"
                        value={newLinkTitle}
                        onChange={(e) => setNewLinkTitle(e.target.value)}
                        placeholder="عنوان تصویر (مثلاً: چارت ۴ ساعته، تاییدیه حجم)"
                        className="w-full bg-slate-900 border border-slate-750 text-white text-xs rounded-xl px-3 py-2 focus:outline-none focus:border-blue-500"
                      />
                    </div>
                    <div className="flex justify-end">
                      <button
                        type="button"
                        onClick={handleAddLinkScreenshot}
                        disabled={!newLinkUrl.trim()}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-semibold rounded-xl flex items-center gap-1.5 transition-colors"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>افزودن لینک به گالری معامله</span>
                      </button>
                    </div>
                  </div>
                )}

                {/* Error Banner */}
                {uploadError && (
                  <p className="text-[11px] text-rose-400 mt-1.5 flex items-center gap-1 bg-rose-950/20 border border-rose-500/30 p-2 rounded-xl">
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                    <span>{uploadError}</span>
                  </p>
                )}

                {/* Attached Screenshots Gallery / List Preview */}
                {formScreenshots.length > 0 && (
                  <div className="mt-3 space-y-2">
                    <span className="text-[11px] text-slate-400 block font-medium">
                      لیست تصاویر ضمیمه شده به این معامله (برای مشاهده بزرگنمایی روی عکس کلیک کنید):
                    </span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                      {formScreenshots.map((item, idx) => (
                        <div
                          key={item.id}
                          className="p-2 bg-slate-950/90 border border-slate-750 hover:border-slate-650 rounded-2xl flex items-center justify-between gap-2.5 transition-all group"
                        >
                          <div
                            onClick={() =>
                              openLightboxWithGallery(
                                item.url,
                                item.title,
                                undefined,
                                formScreenshots,
                                idx
                              )
                            }
                            className="flex items-center gap-2.5 flex-1 min-w-0 cursor-pointer"
                          >
                            <div className="w-14 h-11 rounded-xl overflow-hidden bg-slate-900 border border-slate-700 shrink-0 relative">
                              <img
                                src={item.url}
                                alt={item.title || 'چارت'}
                                className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                                referrerPolicy="no-referrer"
                              />
                              <div className="absolute inset-0 bg-slate-950/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                                <Maximize2 className="w-3.5 h-3.5 text-white" />
                              </div>
                            </div>

                            <div className="truncate">
                              <span className="text-xs font-semibold text-slate-200 group-hover:text-blue-300 block truncate">
                                {item.title || `تصویر شماره ${idx + 1}`}
                              </span>
                              <div className="flex items-center gap-1.5 mt-0.5">
                                <span
                                  className={`text-[9px] px-1.5 py-0.5 rounded-md font-medium ${
                                    item.type === 'link'
                                      ? 'bg-cyan-950/60 text-cyan-300 border border-cyan-500/30'
                                      : 'bg-emerald-950/60 text-emerald-300 border border-emerald-500/30'
                                  }`}
                                >
                                  {item.type === 'link' ? 'لینک وب' : 'فایل آپلود'}
                                </span>
                                <span className="text-[10px] text-slate-500 font-mono">
                                  #{idx + 1}
                                </span>
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              type="button"
                              onClick={() =>
                                openLightboxWithGallery(
                                  item.url,
                                  item.title,
                                  undefined,
                                  formScreenshots,
                                  idx
                                )
                              }
                              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
                              title="مشاهده بزرگنمایی"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleRemoveScreenshot(item.id)}
                              className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 transition-colors"
                              title="حذف تصویر"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-1 font-medium">یادداشت‌ها و درس‌های معامله</label>
                <textarea
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  rows={2}
                  placeholder="نکات مهم ستاپ، خطاهای احتمالی، رفتار قیمت یا احساسات حین ترید..."
                  className="w-full bg-slate-950 border border-slate-750 text-white text-xs rounded-xl p-2.5 focus:outline-none focus:border-blue-500 resize-y"
                />
              </div>
            </div>

            {/* Action Buttons: Submit / Cancel Edit */}
            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-800">
              {editingTrade && (
                <button
                  type="button"
                  onClick={resetTradeForm}
                  className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-2xl text-xs font-medium transition-colors"
                >
                  انصراف از ویرایش
                </button>
              )}

              <button
                type="submit"
                className="px-6 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl text-xs font-bold shadow-lg shadow-blue-900/30 flex items-center gap-2 transition-all"
              >
                <Check className="w-4 h-4" />
                <span>{editingTrade ? 'ذخیره تغییرات معامله' : 'ثبت معامله در ژورنال'}</span>
              </button>
            </div>
          </form>
        )}
      </div>

      {/* ========================================================= */}
      {/* ④ TRADING PERFORMANCE ANALYTICS (داشبورد آمار عملکرد - Collapsible) */}
      {/* ========================================================= */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-lg transition-all duration-300">
        <div
          onClick={() => toggleSection('analytics')}
          className="p-4 bg-slate-850/80 border-b border-slate-800 flex items-center justify-between cursor-pointer select-none"
        >
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-cyan-500/20 text-cyan-400 flex items-center justify-center border border-cyan-500/30">
              <Activity className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <span>داشبورد آمار عملکرد و منحنی بازدهی (Performance Analytics)</span>
                <span className="text-[10px] bg-cyan-500/20 text-cyan-300 px-2 py-0.5 rounded-full font-mono border border-cyan-500/30">
                  {totalTradesCount} معامله بسته
                </span>
              </h3>
              <p className="text-[11px] text-slate-400">
                نرخ برد (Win Rate)، سود/زیان خالص، میانگین R:R و نمودار رشد سرمایه (Equity Curve)
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              aria-label="تغییر وضعیت نمایش آمار"
            >
              {accordion.analytics ? (
                <ChevronUp className="w-5 h-5 text-cyan-400" />
              ) : (
                <ChevronDown className="w-5 h-5 text-slate-400" />
              )}
            </button>
          </div>
        </div>

        {accordion.analytics && (
          <div className="p-4 space-y-4">
            {/* 4 Summary Stat Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              {/* 1. Win Rate */}
              <div className="bg-slate-950/70 p-3 rounded-2xl border border-slate-800">
                <span className="text-[11px] text-slate-400 block font-medium">نرخ پیروزی (Win Rate)</span>
                <span className="text-xl font-bold text-emerald-400 font-mono block mt-1">
                  {winRate}٪
                </span>
                <span className="text-[10px] text-slate-500 block mt-0.5">
                  {winCount} برد / {lossCount} باخت / {beCount} بی‌زیان
                </span>
              </div>

              {/* 2. Total Net PnL */}
              <div className="bg-slate-950/70 p-3 rounded-2xl border border-slate-800">
                <span className="text-[11px] text-slate-400 block font-medium">مجموع سود/زیان خالص</span>
                <span
                  className={`text-xl font-bold font-mono block mt-1 ${
                    totalNetPnL >= 0 ? 'text-emerald-400' : 'text-rose-400'
                  }`}
                >
                  {totalNetPnL >= 0 ? `+$${totalNetPnL.toLocaleString()}` : `-$${Math.abs(totalNetPnL).toLocaleString()}`}
                </span>
                <span className="text-[10px] text-slate-500 block mt-0.5">
                  بالانس فعلی: ${(formBalance + totalNetPnL).toLocaleString()}
                </span>
              </div>

              {/* 3. Average R:R */}
              <div className="bg-slate-950/70 p-3 rounded-2xl border border-slate-800">
                <span className="text-[11px] text-slate-400 block font-medium">میانگین R:R برنده</span>
                <span className="text-xl font-bold text-amber-400 font-mono block mt-1">
                  {avgWinningRR > 0 ? `1 : ${avgWinningRR.toFixed(2)}` : '-'}
                </span>
                <span className="text-[10px] text-slate-500 block mt-0.5">
                  ریوارد معاملات برنده
                </span>
              </div>

              {/* 4. Profit Factor */}
              <div className="bg-slate-950/70 p-3 rounded-2xl border border-slate-800">
                <span className="text-[11px] text-slate-400 block font-medium">ضریب سود (Profit Factor)</span>
                <span className="text-xl font-bold text-cyan-400 font-mono block mt-1">
                  {profitFactor > 0 ? profitFactor.toFixed(2) : '-'}
                </span>
                <span className="text-[10px] text-slate-500 block mt-0.5">
                  سود کل: ${grossProfit.toLocaleString()}
                </span>
              </div>
            </div>

            {/* Canvas Dynamic Equity Curve Chart */}
            <div className="bg-slate-950/80 p-3.5 rounded-2xl border border-slate-800 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                  <TrendingUp className="w-3.5 h-3.5 text-blue-400" />
                  منحنی داینامیک رشد سرمایه (Canvas Equity Curve):
                </span>
                <span className="text-[10px] text-slate-500 font-mono">
                  خط‌چین: سرمایه مبدا (${formBalance.toLocaleString()})
                </span>
              </div>

              <div className="w-full h-52 relative">
                <canvas
                  ref={equityCanvasRef}
                  className="w-full h-full block rounded-xl"
                  style={{ width: '100%', height: '100%' }}
                />
              </div>
            </div>

            {/* Psychology & Discipline Impact comparison */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
              <div className="p-3 rounded-2xl bg-emerald-950/20 border border-emerald-500/30 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Smile className="w-4 h-4 text-emerald-400" />
                  <div>
                    <span className="font-bold text-emerald-300 block">معاملات منضبط (طبق پلان):</span>
                    <span className="text-[11px] text-slate-400">{disciplinedTrades.length} معامله</span>
                  </div>
                </div>
                <div className="text-left font-mono">
                  <span className="text-base font-bold text-emerald-400">{disciplinedWinRate}٪</span>
                  <span className="text-[10px] text-slate-400 block">وین‌ریت</span>
                </div>
              </div>

              <div className="p-3 rounded-2xl bg-rose-950/20 border border-rose-500/30 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Frown className="w-4 h-4 text-rose-400" />
                  <div>
                    <span className="font-bold text-rose-300 block">معاملات هیجانی / انتقامی / FOMO:</span>
                    <span className="text-[11px] text-slate-400">{emotionalTrades.length} معامله</span>
                  </div>
                </div>
                <div className="text-left font-mono">
                  <span className="text-base font-bold text-rose-400">{emotionalWinRate}٪</span>
                  <span className="text-[10px] text-slate-400 block">وین‌ریت</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ========================================================= */}
      {/* ⑤ TRADE HISTORY LOGS (تاریخچه معاملات ثبت‌شده - Collapsible) */}
      {/* ========================================================= */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-lg transition-all duration-300">
        <div
          onClick={() => toggleSection('history')}
          className="p-4 bg-slate-850/80 border-b border-slate-800 flex items-center justify-between cursor-pointer select-none"
        >
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center border border-amber-500/30">
              <Clock className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <span>تاریخچه معاملات ثبت‌شده (Trade History Logs)</span>
                <span className="text-[10px] bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded-full font-mono border border-amber-500/30">
                  {trades.length} معامله
                </span>
              </h3>
              <p className="text-[11px] text-slate-400">
                مرور جزئیات پوزیشن‌ها، تگ‌های SMC، یادداشت‌ها، ویرایش و حذف
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              aria-label="تغییر وضعیت نمایش تاریخچه معاملات"
            >
              {accordion.history ? (
                <ChevronUp className="w-5 h-5 text-amber-400" />
              ) : (
                <ChevronDown className="w-5 h-5 text-slate-400" />
              )}
            </button>
          </div>
        </div>

        {accordion.history && (
          <div className="p-4 space-y-3.5">
            {/* Filter and Search Bar */}
            <div className="flex flex-col gap-2.5">
              <div className="flex flex-col sm:flex-row gap-2.5">
                {/* Setup Mode Filter (All / Live / Draft) */}
                <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-2xl border border-slate-800 text-xs overflow-x-auto">
                  {[
                    { key: 'all', label: 'همه ستاپ‌ها' },
                    { key: 'live', label: 'معاملات زنده' },
                    { key: 'draft', label: 'پیش‌نویس‌ها' },
                  ].map((s) => (
                    <button
                      key={s.key}
                      type="button"
                      onClick={() => setSetupStateFilter(s.key as any)}
                      className={`px-3 py-1.5 rounded-xl whitespace-nowrap transition-colors ${
                        setupStateFilter === s.key
                          ? 'bg-indigo-600 text-white font-bold'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>

                {/* Filter tabs */}
                <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-2xl border border-slate-800 text-xs overflow-x-auto">
                  {[
                    { key: 'all', label: 'همه' },
                    { key: 'win', label: 'بردها' },
                    { key: 'loss', label: 'باخت‌ها' },
                    { key: 'breakeven', label: 'سربه‌سر' },
                    { key: 'open', label: 'معاملات باز' },
                  ].map((f) => (
                    <button
                      key={f.key}
                      type="button"
                      onClick={() => setTradeFilter(f.key as any)}
                      className={`px-2.5 py-1.5 rounded-xl whitespace-nowrap transition-colors ${
                        tradeFilter === f.key
                          ? 'bg-blue-600 text-white font-bold'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>

                {/* Search input */}
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="جستجو در نماد، یادداشت، تگ‌ها..."
                  className="flex-1 bg-slate-950 border border-slate-750 text-white text-xs rounded-2xl px-3 py-2 focus:outline-none focus:border-blue-500"
                />
              </div>

              {/* Emotional State Filters (فیلتر بر اساس حالات روحی و روانشناسی) */}
              <div className="flex items-center gap-1.5 overflow-x-auto py-0.5">
                <span className="text-[11px] text-slate-400 font-medium whitespace-nowrap shrink-0">
                  حالت روانی:
                </span>
                {[
                  { key: 'all', label: 'همه حالات' },
                  { key: 'disciplined', label: 'منضبط' },
                  { key: 'emotional', label: 'هیجانی' },
                  { key: 'revenge', label: 'انتقامی' },
                  { key: 'fomo', label: 'فومو' },
                  { key: 'fear', label: 'ترس' },
                ].map((p) => {
                  const isSelected = psychologyFilter === p.key;
                  return (
                    <button
                      key={p.key}
                      type="button"
                      onClick={() => setPsychologyFilter(p.key as any)}
                      className={`px-2.5 py-1 rounded-xl text-[11px] whitespace-nowrap font-medium transition-all border ${
                        isSelected
                          ? 'bg-purple-600 text-white border-purple-400 font-bold shadow-sm'
                          : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-slate-200 hover:border-slate-700'
                      }`}
                    >
                      {p.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* List of Trades */}
            {filteredTrades.length === 0 ? (
              <div className="text-center py-10 bg-slate-950/40 rounded-2xl border border-slate-800/80">
                <Clock className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                <p className="text-xs text-slate-400">معامله‌ای با فیلتر انتخابی یافت نشد.</p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {filteredTrades.map((trade) => {
                  const isLong = trade.direction === 'long';
                  const isWin = trade.outcome === 'win';
                  const isLoss = trade.outcome === 'loss';
                  const isBe = trade.outcome === 'breakeven';
                  const isOpen = trade.outcome === 'open';

                  return (
                    <div
                      key={trade.id}
                      draggable
                      onDragStart={(e) => trade.id && handleDragStart(e, trade.id)}
                      onDragOver={(e) => trade.id && handleDragOver(e, trade.id)}
                      onDrop={(e) => trade.id && handleDrop(e, trade.id)}
                      className={`p-3.5 rounded-2xl border transition-all ${
                        dragOverTradeId === trade.id
                          ? 'border-blue-500 bg-blue-950/30'
                          : 'bg-slate-950/70 border-slate-800/90 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        {/* Drag grip + Symbol + Direction + Outcome */}
                        <div className="flex items-center gap-2.5">
                          <div className="cursor-grab active:cursor-grabbing text-slate-600 hover:text-slate-400 p-0.5">
                            <GripVertical className="w-4 h-4" />
                          </div>

                          <div
                            className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-xs ${
                              isLong
                                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                                : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                            }`}
                          >
                            {isLong ? <ArrowUpRight className="w-5 h-5" /> : <ArrowDownRight className="w-5 h-5" />}
                          </div>

                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-sm text-white font-mono">{trade.symbol}</span>
                              <span
                                className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${
                                  isLong ? 'bg-emerald-500/20 text-emerald-300' : 'bg-rose-500/20 text-rose-300'
                                }`}
                              >
                                {trade.direction}
                              </span>
                              {trade.is_draft && (
                                <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                                  پیش‌نویس
                                </span>
                              )}
                              <span
                                className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                                  isWin
                                    ? 'bg-emerald-600 text-white'
                                    : isLoss
                                    ? 'bg-rose-600 text-white'
                                    : isBe
                                    ? 'bg-amber-600 text-white'
                                    : 'bg-blue-600 text-white'
                                }`}
                              >
                                {isWin ? 'برد' : isLoss ? 'باخت' : isBe ? 'سربه‌سر' : 'معامله باز'}
                              </span>
                            </div>
                            <span className="text-[11px] text-slate-400 flex items-center gap-1.5 mt-0.5">
                              <span>{trade.date_jalali}</span>
                              <span>•</span>
                              <span className="font-mono">{trade.time}</span>
                            </span>
                          </div>
                        </div>

                        {/* PnL and Actions */}
                        <div className="flex items-center gap-3">
                          <div className="text-left font-mono">
                            {trade.outcome !== 'open' && (
                              <span
                                className={`text-sm font-bold block ${
                                  trade.net_pnl > 0
                                    ? 'text-emerald-400'
                                    : trade.net_pnl < 0
                                    ? 'text-rose-400'
                                    : 'text-slate-300'
                                }`}
                              >
                                {trade.net_pnl > 0 ? `+$${trade.net_pnl}` : `$${trade.net_pnl}`}
                              </span>
                            )}
                            <span className="text-[10px] text-slate-500 block">
                              حجم: {trade.lot_size} Lot
                            </span>
                          </div>

                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => startEditTrade(trade)}
                              className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-blue-400 transition-colors"
                              title="ویرایش این معامله"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                if (trade.id) {
                                  setTradeToDelete(trade);
                                }
                              }}
                              className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-rose-400 transition-colors"
                              title="حذف این معامله"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* Price levels info line */}
                      <div className="grid grid-cols-3 gap-2 mt-2.5 pt-2 border-t border-slate-800/80 text-[11px] font-mono">
                        <div>
                          <span className="text-slate-500">ورود: </span>
                          <span className="text-slate-300">{trade.entry_price}</span>
                        </div>
                        <div>
                          <span className="text-slate-500">حد ضرر: </span>
                          <span className="text-rose-400">{trade.stop_loss}</span>
                        </div>
                        <div>
                          <span className="text-slate-500">تارگت: </span>
                          <span className="text-emerald-400">{trade.take_profit}</span>
                        </div>
                      </div>

                      {/* Confluences and Psychology */}
                      <div className="flex flex-wrap items-center gap-1.5 mt-2.5">
                        {/* Psychology Badge */}
                        <span className="text-[10px] bg-slate-800 text-slate-300 px-2 py-0.5 rounded-lg">
                          روانشناسی:{' '}
                          {trade.psychology === 'disciplined'
                            ? 'منضبط'
                            : trade.psychology === 'emotional'
                            ? 'هیجانی'
                            : trade.psychology === 'revenge'
                            ? 'انتقامی'
                            : 'فومو'}
                        </span>

                        {trade.realized_rr !== undefined && trade.realized_rr !== 0 && (
                          <span className="text-[10px] bg-blue-950/60 border border-blue-500/30 text-blue-300 px-2 py-0.5 rounded-lg font-mono">
                            R:R = {trade.realized_rr}
                          </span>
                        )}

                        {trade.confluences?.map((tag) => (
                          <span
                            key={tag}
                            className="text-[10px] bg-slate-900 border border-slate-750 text-slate-400 px-2 py-0.5 rounded-lg"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>

                      {/* Notes and Multi-Screenshot Gallery in History Card */}
                      {(trade.notes || (trade.screenshots && trade.screenshots.length > 0) || trade.screenshot_url) && (() => {
                        const tradeScreenshots: TradeScreenshot[] =
                          trade.screenshots && trade.screenshots.length > 0
                            ? trade.screenshots
                            : trade.screenshot_url
                            ? [
                                {
                                  id: `legacy_${trade.id}`,
                                  url: trade.screenshot_url,
                                  title: 'اسکرین‌شات چارت ستاپ',
                                  type: 'upload',
                                },
                              ]
                            : [];

                        return (
                          <div className="mt-2.5 pt-2 border-t border-slate-800/80 space-y-2">
                            {trade.notes && (
                              <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed">
                                {trade.notes}
                              </p>
                            )}

                            {tradeScreenshots.length > 0 && (
                              <div className="space-y-1.5">
                                <div className="flex items-center justify-between text-[11px] text-slate-400">
                                  <span className="flex items-center gap-1 font-medium">
                                    <ImageIcon className="w-3.5 h-3.5 text-blue-400" />
                                    <span>اسکرین‌شات‌های تحلیلی</span>
                                    <span className="text-[10px] bg-blue-950 border border-blue-500/30 text-blue-300 px-1.5 py-0.2 rounded-full font-mono">
                                      {tradeScreenshots.length}
                                    </span>
                                  </span>
                                  <span className="text-[10px] text-slate-500">
                                    کلیک برای باز کردن گالری
                                  </span>
                                </div>

                                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                                  {tradeScreenshots.map((sc, scIdx) => (
                                    <div
                                      key={sc.id || scIdx}
                                      onClick={() =>
                                        openLightboxWithGallery(
                                          sc.url,
                                          sc.title,
                                          trade,
                                          tradeScreenshots,
                                          scIdx
                                        )
                                      }
                                      className="p-1.5 rounded-xl bg-slate-900/90 border border-slate-800 hover:border-blue-500/50 cursor-pointer group transition-all"
                                    >
                                      <div className="h-16 rounded-lg overflow-hidden bg-slate-950 relative border border-slate-800">
                                        <img
                                          src={sc.url}
                                          alt={sc.title || 'اسکرین‌شات'}
                                          className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                                          referrerPolicy="no-referrer"
                                        />
                                        <div className="absolute inset-0 bg-slate-950/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                                          <Maximize2 className="w-3.5 h-3.5 text-white" />
                                        </div>
                                        <span className="absolute bottom-1 right-1 bg-slate-950/80 text-white text-[9px] px-1 py-0.2 rounded font-mono border border-slate-750">
                                          #{scIdx + 1}
                                        </span>
                                      </div>
                                      <p className="text-[10px] text-slate-300 font-medium truncate mt-1 group-hover:text-blue-300">
                                        {sc.title || `تصویر ${scIdx + 1}`}
                                      </p>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })()}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ========================================================= */}
      {/* ⑥ LIGHTBOX MODAL FOR CHART SCREENSHOT PREVIEW (ZOOM & PAN) */}
      {/* ========================================================= */}
      {lightboxImage && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-950/90 backdrop-blur-md animate-fadeIn select-none"
          onClick={() => {
            setLightboxImage(null);
            setLightboxZoom(1);
            setLightboxPan({ x: 0, y: 0 });
          }}
        >
          <div
            className="w-full max-w-5xl bg-slate-900 border border-slate-750 rounded-3xl overflow-hidden shadow-2xl flex flex-col animate-slideUp max-h-[92vh]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Lightbox Header with Interactive Zoom Controls & Gallery Index */}
            <div className="p-3.5 sm:p-4 bg-gradient-to-r from-slate-900 via-slate-850 to-slate-900 border-b border-slate-750 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-8 h-8 rounded-xl bg-blue-500/20 text-blue-400 flex items-center justify-center border border-blue-500/30 shrink-0">
                  <ImageIcon className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <h4 className="text-sm font-bold text-white flex items-center gap-2 truncate">
                    <span>{lightboxImage.title || 'اسکرین‌شات چارت معامله'}</span>
                    {lightboxGallery.length > 1 && (
                      <span className="bg-blue-950 border border-blue-500/40 text-blue-300 font-mono text-xs px-2 py-0.5 rounded-full shrink-0">
                        {lightboxCurrentIndex + 1} / {lightboxGallery.length}
                      </span>
                    )}
                    {lightboxImage.trade && (
                      <span className="font-mono text-xs text-emerald-400 shrink-0">
                        ({lightboxImage.trade.symbol} - {lightboxImage.trade.direction.toUpperCase()})
                      </span>
                    )}
                  </h4>
                  {lightboxImage.trade && (
                    <p className="text-[11px] text-slate-400 font-mono truncate">
                      {lightboxImage.trade.date_jalali} • ساعت {lightboxImage.trade.time} • حجم: {lightboxImage.trade.lot_size} Lot
                    </p>
                  )}
                </div>
              </div>

              {/* Zoom & Pan Toolbar */}
              <div className="flex items-center gap-1.5 bg-slate-950/80 px-2.5 py-1.5 rounded-2xl border border-slate-750">
                <button
                  type="button"
                  onClick={() => setLightboxZoom((z) => Math.min(z + 0.25, 4))}
                  className="w-7 h-7 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 flex items-center justify-center text-sm font-bold transition-colors"
                  title="بزرگنمایی (Zoom In)"
                >
                  +
                </button>
                <span className="text-xs font-mono font-bold text-blue-400 px-2 min-w-[45px] text-center">
                  {Math.round(lightboxZoom * 100)}٪
                </span>
                <button
                  type="button"
                  onClick={() => setLightboxZoom((z) => Math.max(z - 0.25, 0.5))}
                  className="w-7 h-7 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 flex items-center justify-center text-sm font-bold transition-colors"
                  title="کوچک‌نمایی (Zoom Out)"
                >
                  -
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setLightboxZoom(1);
                    setLightboxPan({ x: 0, y: 0 });
                  }}
                  className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] font-medium transition-colors ml-1"
                  title="بازنشانی اندازه"
                >
                  بازنشانی
                </button>
              </div>

              <div className="flex items-center gap-2">
                <a
                  href={lightboxImage.url}
                  download={`trade-chart-${Date.now()}.png`}
                  target="_blank"
                  rel="noreferrer"
                  className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-semibold flex items-center gap-1.5 transition-colors border border-slate-700"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">دانلود تصویر</span>
                </a>
                <button
                  type="button"
                  onClick={() => {
                    setLightboxImage(null);
                    setLightboxZoom(1);
                    setLightboxPan({ x: 0, y: 0 });
                  }}
                  className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
                  aria-label="بستن پیش‌نمایش"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Lightbox Body: Interactive Zoomable & Pannable Stage with Gallery Navigation */}
            <div
              className="p-2 sm:p-4 bg-slate-950 flex items-center justify-center overflow-hidden flex-1 min-h-[340px] relative"
              onMouseDown={(e) => {
                if (lightboxZoom > 1) {
                  setIsPanning(true);
                  setPanStart({ x: e.clientX - lightboxPan.x, y: e.clientY - lightboxPan.y });
                }
              }}
              onMouseMove={(e) => {
                if (isPanning && lightboxZoom > 1) {
                  setLightboxPan({ x: e.clientX - panStart.x, y: e.clientY - panStart.y });
                }
              }}
              onMouseUp={() => setIsPanning(false)}
              onMouseLeave={() => setIsPanning(false)}
              style={{
                cursor: lightboxZoom > 1 ? (isPanning ? 'grabbing' : 'grab') : 'default',
              }}
            >
              {/* Previous Image Arrow */}
              {lightboxGallery.length > 1 && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    navigateLightbox('prev');
                  }}
                  className="absolute right-3 z-10 w-10 h-10 rounded-full bg-slate-900/80 hover:bg-blue-600 text-white flex items-center justify-center border border-slate-700 transition-all shadow-xl backdrop-blur-sm"
                  title="تصویر قبلی"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              )}

              {/* Main Image */}
              <div
                style={{
                  transform: `translate(${lightboxPan.x}px, ${lightboxPan.y}px) scale(${lightboxZoom})`,
                  transition: isPanning ? 'none' : 'transform 0.15s ease-out',
                }}
                className="max-w-full max-h-[64vh] flex items-center justify-center pointer-events-auto"
              >
                <img
                  src={lightboxImage.url}
                  alt={lightboxImage.title || 'بزرگنمایی چارت معامله'}
                  className="max-w-full max-h-[64vh] object-contain rounded-xl shadow-2xl border border-slate-800 select-none pointer-events-none"
                  referrerPolicy="no-referrer"
                  draggable={false}
                />
              </div>

              {/* Next Image Arrow */}
              {lightboxGallery.length > 1 && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    navigateLightbox('next');
                  }}
                  className="absolute left-3 z-10 w-10 h-10 rounded-full bg-slate-900/80 hover:bg-blue-600 text-white flex items-center justify-center border border-slate-700 transition-all shadow-xl backdrop-blur-sm"
                  title="تصویر بعدی"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
              )}

              {lightboxZoom > 1 && (
                <div className="absolute bottom-3 left-1/2 -translate-x-1/2 bg-slate-900/90 border border-slate-750 px-3 py-1 rounded-full text-[11px] text-slate-300 pointer-events-none shadow-lg backdrop-blur-sm">
                  برای جابجایی تصویر، ماوس را کلیک کرده و بکشید
                </div>
              )}
            </div>

            {/* Bottom Gallery Thumbnail Bar */}
            {lightboxGallery.length > 1 && (
              <div className="p-2.5 bg-slate-900 border-t border-slate-800 flex items-center justify-center gap-2 overflow-x-auto">
                {lightboxGallery.map((thumb, tIdx) => (
                  <button
                    key={thumb.id || tIdx}
                    type="button"
                    onClick={() => {
                      setLightboxCurrentIndex(tIdx);
                      setLightboxImage((prev) => ({
                        ...prev,
                        url: thumb.url,
                        title: thumb.title,
                      }));
                      setLightboxZoom(1);
                      setLightboxPan({ x: 0, y: 0 });
                    }}
                    className={`w-14 h-10 rounded-lg overflow-hidden border-2 transition-all shrink-0 relative ${
                      lightboxCurrentIndex === tIdx
                        ? 'border-blue-500 scale-105 shadow-md shadow-blue-500/20'
                        : 'border-slate-750 opacity-60 hover:opacity-100'
                    }`}
                  >
                    <img
                      src={thumb.url}
                      alt={thumb.title || 'تصویر'}
                      className="w-full h-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Delete Trade Confirm Modal */}
      <ConfirmDeleteModal
        isOpen={!!tradeToDelete}
        title="حذف معامله"
        message={`آیا از حذف معامله "${tradeToDelete?.symbol || ''}" مورخ ${tradeToDelete?.date_jalali ? toPersianDigits(tradeToDelete.date_jalali) : ''} اطمینان دارید؟ این عملیات قابل بازگشت نیست.`}
        confirmText="حذف معامله"
        cancelText="انصراف"
        onConfirm={async () => {
          if (tradeToDelete?.id) {
            await onDeleteTrade(tradeToDelete.id);
            soundFx.playDelete();
            setTradeToDelete(null);
          }
        }}
        onCancel={() => setTradeToDelete(null)}
      />

      {/* Delete Checklist Item Confirm Modal */}
      <ConfirmDeleteModal
        isOpen={!!checklistToDelete}
        title="حذف تاییدیه چک‌لیست"
        message={`آیا از حذف آیتم چک‌لیست "${checklistToDelete?.title || ''}" اطمینان دارید؟`}
        confirmText="حذف آیتم"
        cancelText="انصراف"
        onConfirm={async () => {
          if (checklistToDelete?.id) {
            await onDeleteChecklistItem(checklistToDelete.id);
            soundFx.playDelete();
            setChecklistToDelete(null);
          }
        }}
        onCancel={() => setChecklistToDelete(null)}
      />
    </div>
  );
};
