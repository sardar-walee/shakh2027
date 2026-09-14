import React, { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
  ReferenceLine,
} from 'recharts';
import {
  TrendingUp,
  TrendingDown,
  BarChart3,
  LineChart as LineChartIcon,
  Wallet,
  ArrowDownLeft,
  ArrowUpRight,
  Filter,
  Calendar,
  Layers,
  Sparkles,
  Info,
  DollarSign,
  Receipt,
  Scale,
} from 'lucide-react';
import { CaptainOrder, SettlementRecord } from '../../types/captainFinance';

export interface WalletTransactionPoint {
  id: string;
  date: string;
  rawDate: Date;
  timeStr: string;
  displayDate: string;
  type: 'INFLOW_ORDER' | 'OUTFLOW_SETTLEMENT' | 'NET_EARNING';
  typeLabelKu: string;
  typeLabelEn: string;
  title: string;
  reference: string;
  amount: number;
  inflow: number; // Cash received from customer
  outflow: number; // Cash handed over/settled to company
  captainEarning: number; // Delivery fee earned
  runningBalance: number; // Wallet balance / cash-in-hand balance at this point
  category?: string;
  paymentMethod?: string;
}

interface Props {
  orders: CaptainOrder[];
  settlements: SettlementRecord[];
  initialBalance?: number;
  captainName?: string;
  currency?: string;
}

export default function WalletTrendVisualizer({
  orders,
  settlements,
  initialBalance = 0,
  captainName,
  currency = 'IQD',
}: Props) {
  const { t, i18n } = useTranslation();
  const isRtl = i18n.language === 'ku' || i18n.language === 'ar';

  // Visualization Controls
  const [chartType, setChartType] = useState<'area_trend' | 'bar_flow' | 'balance_line'>('area_trend');
  const [timeFilter, setTimeFilter] = useState<'all' | '7d' | '30d'>('all');
  const [transactionTypeFilter, setTransactionTypeFilter] = useState<'ALL' | 'INFLOW' | 'OUTFLOW'>('ALL');

  // Synthesize and sort chronologically all wallet timeline events
  const timelineData = useMemo<WalletTransactionPoint[]>(() => {
    const events: {
      id: string;
      rawDate: Date;
      type: 'INFLOW_ORDER' | 'OUTFLOW_SETTLEMENT';
      title: string;
      reference: string;
      inflow: number;
      outflow: number;
      captainEarning: number;
      amount: number;
      category?: string;
      paymentMethod?: string;
    }[] = [];

    // 1. Inflow from completed orders (Cash on delivery / total collection)
    orders.forEach((o) => {
      const date = new Date(o.completedAt);
      events.push({
        id: o.id,
        rawDate: isNaN(date.getTime()) ? new Date() : date,
        type: 'INFLOW_ORDER',
        title: `${o.categoryLabelKu || o.category} - ${o.storeName}`,
        reference: o.orderNumber,
        inflow: o.totalCashCollected || o.orderAmount + o.deliveryFee,
        outflow: 0,
        captainEarning: o.captainDeliveryFee ?? Math.max(0, o.deliveryFee - (o.platformFee || 1000)),
        amount: o.totalCashCollected || o.orderAmount + o.deliveryFee,
        category: o.category,
        paymentMethod: o.paymentMethod,
      });
    });

    // 2. Outflow from settlements (Money brought down / deposited)
    settlements.forEach((s) => {
      const date = new Date(s.createdAt);
      events.push({
        id: s.id,
        rawDate: isNaN(date.getTime()) ? new Date() : date,
        type: 'OUTFLOW_SETTLEMENT',
        title: `سێتڵمێنت (${s.paymentMethodLabelKu || s.paymentMethod})`,
        reference: s.referenceCode,
        inflow: 0,
        outflow: s.amountReturned,
        captainEarning: 0,
        amount: s.amountReturned,
        paymentMethod: s.paymentMethod,
      });
    });

    // Sort ascending by time
    events.sort((a, b) => a.rawDate.getTime() - b.rawDate.getTime());

    // Calculate chronological running wallet balance
    let currentBalance = initialBalance;
    const points: WalletTransactionPoint[] = events.map((ev, index) => {
      currentBalance = currentBalance + ev.inflow - ev.outflow;
      const monthNamesKu = ['کانوونی دووەم', 'شوبات', 'ئازار', 'نیسان', 'ئایار', 'حوزەیران', 'تەمووز', 'ئاب', 'ئەیلوول', 'تشرینی یەکەم', 'تشرینی دووەم', 'کانوونی یەکەم'];
      const m = ev.rawDate.getMonth();
      const d = ev.rawDate.getDate();
      const timeStr = ev.rawDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

      return {
        id: ev.id,
        date: `${d}/${m + 1}`,
        rawDate: ev.rawDate,
        timeStr,
        displayDate: isRtl ? `${d}ی ${monthNamesKu[m]} (${timeStr})` : `${ev.rawDate.toLocaleDateString()} ${timeStr}`,
        type: ev.type,
        typeLabelKu: ev.type === 'INFLOW_ORDER' ? 'داهاتی ئۆردەر (کاش)' : 'گەڕاندنەوە (سێتڵمێنت)',
        typeLabelEn: ev.type === 'INFLOW_ORDER' ? 'Cash Inflow' : 'Cash Returned',
        title: ev.title,
        reference: ev.reference,
        amount: ev.amount,
        inflow: ev.inflow,
        outflow: ev.outflow,
        captainEarning: ev.captainEarning,
        runningBalance: Math.max(0, currentBalance),
        category: ev.category,
        paymentMethod: ev.paymentMethod,
      };
    });

    return points;
  }, [orders, settlements, initialBalance, isRtl]);

  // Filtered dataset for charts
  const filteredData = useMemo(() => {
    let result = [...timelineData];

    if (timeFilter !== 'all') {
      const days = timeFilter === '7d' ? 7 : 30;
      const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
      result = result.filter((pt) => pt.rawDate >= cutoff);
    }

    if (transactionTypeFilter === 'INFLOW') {
      result = result.filter((pt) => pt.inflow > 0);
    } else if (transactionTypeFilter === 'OUTFLOW') {
      result = result.filter((pt) => pt.outflow > 0);
    }

    return result;
  }, [timelineData, timeFilter, transactionTypeFilter]);

  // Aggregate Metrics
  const aggregateMetrics = useMemo(() => {
    const totalInflow = timelineData.reduce((sum, p) => sum + p.inflow, 0);
    const totalOutflow = timelineData.reduce((sum, p) => sum + p.outflow, 0);
    const totalEarnings = timelineData.reduce((sum, p) => sum + p.captainEarning, 0);
    const currentBalance = timelineData.length > 0 ? timelineData[timelineData.length - 1].runningBalance : 0;
    const maxBalance = timelineData.reduce((max, p) => Math.max(max, p.runningBalance), 0);

    return {
      totalInflow,
      totalOutflow,
      totalEarnings,
      currentBalance,
      maxBalance,
      inflowCount: timelineData.filter((p) => p.inflow > 0).length,
      outflowCount: timelineData.filter((p) => p.outflow > 0).length,
    };
  }, [timelineData]);

  // Custom Chart Tooltip
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data: WalletTransactionPoint = payload[0].payload;
      return (
        <div
          className="p-3.5 rounded-2xl bg-white/95 dark:bg-slate-900/95 shadow-xl border border-slate-200 dark:border-slate-800 backdrop-blur-md text-xs space-y-2 min-w-[220px]"
          dir={isRtl ? 'rtl' : 'ltr'}
        >
          <div className="flex items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-2">
            <span className="font-bold text-slate-800 dark:text-slate-200 font-mono">
              #{data.reference}
            </span>
            <span
              className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                data.type === 'INFLOW_ORDER'
                  ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
                  : 'bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300'
              }`}
            >
              {isRtl ? data.typeLabelKu : data.typeLabelEn}
            </span>
          </div>

          <p className="text-[11px] text-slate-600 dark:text-slate-300 font-medium truncate">
            {data.title}
          </p>

          <div className="space-y-1 pt-1 font-mono">
            {data.inflow > 0 && (
              <div className="flex justify-between text-emerald-600 dark:text-emerald-400">
                <span className="text-slate-400 font-sans">{isRtl ? 'کاشی وەرگیراو:' : 'Inflow:'}</span>
                <span className="font-bold">+{data.inflow.toLocaleString()} {currency}</span>
              </div>
            )}

            {data.captainEarning > 0 && (
              <div className="flex justify-between text-primary-600 dark:text-primary-400 text-[11px]">
                <span className="text-slate-400 font-sans">{isRtl ? 'کرێی دەست:' : 'Earning:'}</span>
                <span>+{data.captainEarning.toLocaleString()} {currency}</span>
              </div>
            )}

            {data.outflow > 0 && (
              <div className="flex justify-between text-rose-600 dark:text-rose-400">
                <span className="text-slate-400 font-sans">{isRtl ? 'گەڕێنراوە بۆ کۆمپانیا:' : 'Settled:'}</span>
                <span className="font-bold">-{data.outflow.toLocaleString()} {currency}</span>
              </div>
            )}

            <div className="pt-1.5 mt-1 border-t border-slate-100 dark:border-slate-800 flex justify-between font-bold text-slate-900 dark:text-white">
              <span className="text-slate-500 font-sans">{isRtl ? 'باڵانسی دوای جووڵە:' : 'Balance:'}</span>
              <span className="text-primary-600 dark:text-primary-400 font-extrabold">
                {data.runningBalance.toLocaleString()} {currency}
              </span>
            </div>
          </div>

          <div className="text-[10px] text-slate-400 pt-1 flex items-center gap-1 border-t border-slate-100 dark:border-slate-800">
            <Calendar className="w-3 h-3 text-slate-400" />
            <span>{data.displayDate}</span>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div
      id="wallet-trend-visualizer-container"
      className="card p-5 sm:p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-5"
      dir={isRtl ? 'rtl' : 'ltr'}
    >
      {/* Visualizer Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-primary-100 dark:bg-primary-950/70 text-primary-600 dark:text-primary-400 flex items-center justify-center">
              <TrendingUp className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-slate-900 dark:text-white flex items-center gap-2">
                <span>{isRtl ? 'ڕەوتی پارەدان و جووڵەی باڵانسی کاش' : 'Wallet Transaction & Cash Flow Trend'}</span>
                {captainName && (
                  <span className="text-xs font-normal text-slate-400 font-mono">
                    ({captainName})
                  </span>
                )}
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                {isRtl
                  ? 'شیکاری ڕاستەوخۆی هەژمارکردنی کاشی وەرگیراو لە کڕیاران و هێنانە خوارەوەی باڵانس لە کاتی وەرگرتنەوە'
                  : 'Live visual history of cash collected from customers vs. settlement deduction trends'}
              </p>
            </div>
          </div>
        </div>

        {/* Chart View Switcher Controls */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Chart Type Toggle */}
          <div className="p-1 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center gap-1">
            <button
              id="chart-type-area-btn"
              type="button"
              onClick={() => setChartType('area_trend')}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                chartType === 'area_trend'
                  ? 'bg-white dark:bg-slate-900 text-primary-600 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
              title={isRtl ? 'هێڵی ڕووبەری باڵانس' : 'Area Balance Trend'}
            >
              <TrendingUp className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{isRtl ? 'ڕەوت (Area)' : 'Trend'}</span>
            </button>

            <button
              id="chart-type-bar-btn"
              type="button"
              onClick={() => setChartType('bar_flow')}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                chartType === 'bar_flow'
                  ? 'bg-white dark:bg-slate-900 text-primary-600 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
              title={isRtl ? 'ستوونی هاتوو و ڕۆیشتوو' : 'Inflow vs. Outflow Bars'}
            >
              <BarChart3 className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{isRtl ? 'ستوونی (Bar)' : 'Flow Bar'}</span>
            </button>

            <button
              id="chart-type-line-btn"
              type="button"
              onClick={() => setChartType('balance_line')}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                chartType === 'balance_line'
                  ? 'bg-white dark:bg-slate-900 text-primary-600 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
              title={isRtl ? 'هێڵی باڵانس' : 'Line Balance'}
            >
              <LineChartIcon className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{isRtl ? 'هێڵ (Line)' : 'Line'}</span>
            </button>
          </div>

          {/* Time Filter */}
          <div className="flex items-center gap-1 text-xs">
            <button
              type="button"
              onClick={() => setTimeFilter('all')}
              className={`px-2 py-1 rounded-lg font-bold transition-colors ${
                timeFilter === 'all'
                  ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
              }`}
            >
              {isRtl ? 'هەموو' : 'All'}
            </button>
            <button
              type="button"
              onClick={() => setTimeFilter('7d')}
              className={`px-2 py-1 rounded-lg font-bold transition-colors ${
                timeFilter === '7d'
                  ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
              }`}
            >
              7D
            </button>
          </div>
        </div>
      </div>

      {/* Snapshot Cards for Inflow vs Outflow vs Net Holding */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Total Inflow */}
        <div className="p-3.5 rounded-xl bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200/60 dark:border-emerald-900/50">
          <div className="flex items-center justify-between text-emerald-700 dark:text-emerald-300 text-xs font-bold">
            <span className="flex items-center gap-1">
              <ArrowDownLeft className="w-3.5 h-3.5" />
              {isRtl ? 'کۆی کاشی وەرگیراو' : 'Total Inflow'}
            </span>
            <span className="font-mono text-[11px] px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-900/60">
              {aggregateMetrics.inflowCount}
            </span>
          </div>
          <div className="text-lg sm:text-xl font-bold font-mono text-emerald-600 dark:text-emerald-400 mt-1">
            +{aggregateMetrics.totalInflow.toLocaleString()}{' '}
            <span className="text-xs font-normal font-sans">{currency}</span>
          </div>
          <span className="text-[10px] text-slate-400 block mt-0.5">
            {isRtl ? 'پارەی کۆکراوەی ئۆردەرەکان' : 'Customer payments received'}
          </span>
        </div>

        {/* Total Returned / Deducted */}
        <div className="p-3.5 rounded-xl bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200/60 dark:border-amber-900/50">
          <div className="flex items-center justify-between text-amber-700 dark:text-amber-300 text-xs font-bold">
            <span className="flex items-center gap-1">
              <ArrowUpRight className="w-3.5 h-3.5" />
              {isRtl ? 'گەڕێنراوە بۆ کۆمپانیا' : 'Total Returned'}
            </span>
            <span className="font-mono text-[11px] px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-900/60">
              {aggregateMetrics.outflowCount}
            </span>
          </div>
          <div className="text-lg sm:text-xl font-bold font-mono text-amber-600 dark:text-amber-400 mt-1">
            -{aggregateMetrics.totalOutflow.toLocaleString()}{' '}
            <span className="text-xs font-normal font-sans">{currency}</span>
          </div>
          <span className="text-[10px] text-slate-400 block mt-0.5">
            {isRtl ? 'هێنراوەتە خوارەوە (سێتڵمێنت)' : 'Brought down via settlements'}
          </span>
        </div>

        {/* Current Balance in Hand */}
        <div className="p-3.5 rounded-xl bg-primary-50/50 dark:bg-primary-950/20 border border-primary-200/60 dark:border-primary-900/50">
          <div className="flex items-center justify-between text-primary-700 dark:text-primary-300 text-xs font-bold">
            <span className="flex items-center gap-1">
              <Wallet className="w-3.5 h-3.5" />
              {isRtl ? 'کاشی ئێستا لە دەستدا' : 'Current In-Hand'}
            </span>
            <span className="font-mono text-[11px] px-1.5 py-0.5 rounded bg-primary-100 dark:bg-primary-900/60">
              باڵانس
            </span>
          </div>
          <div className="text-lg sm:text-xl font-black font-mono text-slate-900 dark:text-white mt-1">
            {aggregateMetrics.currentBalance.toLocaleString()}{' '}
            <span className="text-xs font-bold text-primary-600 font-sans">{currency}</span>
          </div>
          <span className="text-[10px] text-slate-400 block mt-0.5">
            {isRtl ? 'ماوەتەوە بۆ گەڕاندنەوە' : 'Pending company return'}
          </span>
        </div>

        {/* Captain Net Delivery Earnings */}
        <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
          <div className="flex items-center justify-between text-slate-700 dark:text-slate-300 text-xs font-bold">
            <span className="flex items-center gap-1">
              <DollarSign className="w-3.5 h-3.5 text-emerald-500" />
              {isRtl ? 'کرێی دەستی کاپتن' : 'Captain Earnings'}
            </span>
            <span className="font-mono text-[11px] px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-700">
              قازانج
            </span>
          </div>
          <div className="text-lg sm:text-xl font-bold font-mono text-emerald-600 dark:text-emerald-400 mt-1">
            +{aggregateMetrics.totalEarnings.toLocaleString()}{' '}
            <span className="text-xs font-normal font-sans text-slate-400">{currency}</span>
          </div>
          <span className="text-[10px] text-slate-400 block mt-0.5">
            {isRtl ? 'پشکی کاپتن لە کرێی گەیاندن' : 'Net delivery fee earned'}
          </span>
        </div>
      </div>

      {/* Main Chart Canvas */}
      <div className="h-72 w-full pt-2">
        {filteredData.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-slate-400 space-y-2 border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl">
            <Info className="w-8 h-8 opacity-40" />
            <p className="text-xs font-medium">
              {isRtl ? 'هیچ داتایەکی گونجاو لەم مەودایەدا نییە.' : 'No transactions recorded for this period.'}
            </p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            {chartType === 'area_trend' ? (
              <AreaChart data={filteredData} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                <defs>
                  <linearGradient id="balanceGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#0284c7" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#0284c7" stopOpacity={0.0} />
                  </linearGradient>
                  <linearGradient id="inflowGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#94a3b8" opacity={0.15} />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 11, fill: '#94a3b8' }}
                  tickLine={false}
                  axisLine={{ stroke: '#94a3b8', opacity: 0.2 }}
                />
                <YAxis
                  tick={{ fontSize: 10, fill: '#94a3b8' }}
                  tickLine={false}
                  axisLine={{ stroke: '#94a3b8', opacity: 0.2 }}
                  tickFormatter={(val) => `${(val / 1000).toFixed(0)}k`}
                />
                <Tooltip content={<CustomTooltip />} />
                <Legend
                  wrapperStyle={{ fontSize: 11, paddingTop: 8 }}
                  formatter={(value) => {
                    if (value === 'runningBalance') return isRtl ? 'باڵانسی ماوە لای کاپتن (IQD)' : 'Running Cash In Hand';
                    if (value === 'inflow') return isRtl ? 'کاشی وەرگیراو لە ئۆردەر' : 'Order Cash Inflow';
                    return value;
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="runningBalance"
                  stroke="#0284c7"
                  strokeWidth={2.5}
                  fillOpacity={1}
                  fill="url(#balanceGradient)"
                  name="runningBalance"
                  dot={{ r: 3, fill: '#0284c7', strokeWidth: 1, stroke: '#fff' }}
                  activeDot={{ r: 6, fill: '#0369a1' }}
                />
                <Area
                  type="monotone"
                  dataKey="inflow"
                  stroke="#10b981"
                  strokeWidth={1.5}
                  strokeDasharray="4 4"
                  fillOpacity={1}
                  fill="url(#inflowGradient)"
                  name="inflow"
                />
              </AreaChart>
            ) : chartType === 'bar_flow' ? (
              <BarChart data={filteredData} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#94a3b8" opacity={0.15} />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 11, fill: '#94a3b8' }}
                  tickLine={false}
                  axisLine={{ stroke: '#94a3b8', opacity: 0.2 }}
                />
                <YAxis
                  tick={{ fontSize: 10, fill: '#94a3b8' }}
                  tickLine={false}
                  axisLine={{ stroke: '#94a3b8', opacity: 0.2 }}
                  tickFormatter={(val) => `${(val / 1000).toFixed(0)}k`}
                />
                <Tooltip content={<CustomTooltip />} />
                <Legend
                  wrapperStyle={{ fontSize: 11, paddingTop: 8 }}
                  formatter={(value) => {
                    if (value === 'inflow') return isRtl ? 'کاشی وەرگیراو (Inflow)' : 'Cash Inflow';
                    if (value === 'outflow') return isRtl ? 'گەڕاندنەوە (Outflow)' : 'Settled to Company';
                    return value;
                  }}
                />
                <Bar
                  dataKey="inflow"
                  fill="#10b981"
                  radius={[4, 4, 0, 0]}
                  name="inflow"
                  maxBarSize={40}
                />
                <Bar
                  dataKey="outflow"
                  fill="#f59e0b"
                  radius={[4, 4, 0, 0]}
                  name="outflow"
                  maxBarSize={40}
                />
              </BarChart>
            ) : (
              <LineChart data={filteredData} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#94a3b8" opacity={0.15} />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 11, fill: '#94a3b8' }}
                  tickLine={false}
                  axisLine={{ stroke: '#94a3b8', opacity: 0.2 }}
                />
                <YAxis
                  tick={{ fontSize: 10, fill: '#94a3b8' }}
                  tickLine={false}
                  axisLine={{ stroke: '#94a3b8', opacity: 0.2 }}
                  tickFormatter={(val) => `${(val / 1000).toFixed(0)}k`}
                />
                <Tooltip content={<CustomTooltip />} />
                <Legend
                  wrapperStyle={{ fontSize: 11, paddingTop: 8 }}
                  formatter={(value) => {
                    if (value === 'runningBalance') return isRtl ? 'باڵانسی کاش (IQD)' : 'Wallet Balance';
                    if (value === 'captainEarning') return isRtl ? 'کرێی دەست (قازانج)' : 'Captain Earning';
                    return value;
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="runningBalance"
                  stroke="#0284c7"
                  strokeWidth={3}
                  dot={{ r: 4, fill: '#0284c7', strokeWidth: 1.5, stroke: '#fff' }}
                  activeDot={{ r: 7, fill: '#0369a1' }}
                  name="runningBalance"
                />
                <Line
                  type="monotone"
                  dataKey="captainEarning"
                  stroke="#10b981"
                  strokeWidth={2}
                  strokeDasharray="3 3"
                  dot={{ r: 3, fill: '#10b981' }}
                  name="captainEarning"
                />
              </LineChart>
            )}
          </ResponsiveContainer>
        )}
      </div>

      {/* Interactive Micro Ledger of Last 4 Events */}
      <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
        <div className="flex items-center justify-between text-xs text-slate-500">
          <span className="font-bold flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5 text-primary-500" />
            <span>{isRtl ? 'دواین جووڵەکانی هێڵکارییەکە' : 'Recent Timeline Milestones'}</span>
          </span>
          <span className="font-mono text-[11px]">
            {filteredData.length} {isRtl ? 'جووڵە' : 'points'}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
          {filteredData.slice(-4).reverse().map((pt) => {
            const isInflow = pt.type === 'INFLOW_ORDER';
            return (
              <div
                key={pt.id}
                className={`p-2.5 rounded-xl border text-xs flex items-center justify-between gap-2 transition-all ${
                  isInflow
                    ? 'border-emerald-200/70 bg-emerald-50/40 dark:bg-emerald-950/20 dark:border-emerald-900/50'
                    : 'border-amber-200/70 bg-amber-50/40 dark:bg-amber-950/20 dark:border-amber-900/50'
                }`}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1 font-mono font-bold text-[11px] text-slate-800 dark:text-slate-200 truncate">
                    <span>#{pt.reference}</span>
                  </div>
                  <span className="text-[10px] text-slate-400 block truncate">
                    {pt.timeStr} • {pt.title}
                  </span>
                </div>

                <div className="text-end shrink-0 font-mono">
                  <span
                    className={`font-bold block text-xs ${
                      isInflow ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'
                    }`}
                  >
                    {isInflow ? '+' : '-'}{pt.amount.toLocaleString()}
                  </span>
                  <span className="text-[10px] text-slate-400 block">
                    {isRtl ? 'باڵانس:' : 'Bal:'} {pt.runningBalance.toLocaleString()}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
