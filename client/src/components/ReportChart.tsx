/**
 * مكون الرسوم البيانية للتقارير
 * يدعم أنواع متعددة من الرسوم البيانية
 */

import React, { useMemo } from 'react';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

interface ReportDataItem {
  label: string;
  value: number;
  percentage?: number;
  count?: number;
  quantity?: number;
  suffix?: string;
}

interface ReportChartProps {
  data: ReportDataItem[];
  chartType: string;
  title?: string;
}

// ألوان الرسوم البيانية
const COLORS = [
  '#3B82F6', // blue-500
  '#10B981', // emerald-500
  '#F59E0B', // amber-500
  '#EF4444', // red-500
  '#8B5CF6', // violet-500
  '#EC4899', // pink-500
  '#06B6D4', // cyan-500
  '#84CC16', // lime-500
  '#F97316', // orange-500
  '#6366F1', // indigo-500
];

// تنسيق الأرقام للعرض
const formatValue = (value: number) => {
  if (value >= 1000000) {
    return `${(value / 1000000).toFixed(1)}M`;
  }
  if (value >= 1000) {
    return `${(value / 1000).toFixed(1)}K`;
  }
  return value.toLocaleString('ar-SA');
};

// تنسيق التلميحات
const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white dark:bg-slate-800 p-3 rounded-lg shadow-lg border border-slate-200 dark:border-slate-700">
        <p className="font-medium text-slate-800 dark:text-white mb-1">{label || payload[0]?.payload?.label}</p>
        {payload.map((entry: any, index: number) => (
          <p key={index} className="text-sm" style={{ color: entry.color }}>
            {entry.name || 'القيمة'}: {formatValue(entry.value)} ر.س.
          </p>
        ))}
      </div>
    );
  }
  return null;
};

// تنسيق تلميحات الدائري
const PieTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="bg-white dark:bg-slate-800 p-3 rounded-lg shadow-lg border border-slate-200 dark:border-slate-700">
        <p className="font-medium text-slate-800 dark:text-white mb-1">{data.label}</p>
        <p className="text-sm text-slate-600 dark:text-slate-300">
          القيمة: {formatValue(data.value)} ر.س.
        </p>
        {data.percentage !== undefined && (
          <p className="text-sm text-slate-600 dark:text-slate-300">
            النسبة: {data.percentage.toFixed(1)}%
          </p>
        )}
      </div>
    );
  }
  return null;
};

// تسمية الدائري
const renderCustomLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent, label }: any) => {
  if (percent < 0.05) return null; // لا تعرض التسميات الصغيرة جداً
  
  const RADIAN = Math.PI / 180;
  const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);

  return (
    <text
      x={x}
      y={y}
      fill="white"
      textAnchor={x > cx ? 'start' : 'end'}
      dominantBaseline="central"
      className="text-xs font-medium"
    >
      {`${(percent * 100).toFixed(0)}%`}
    </text>
  );
};

export default function ReportChart({ data, chartType, title }: ReportChartProps) {
  // تحضير البيانات للرسم البياني
  const chartData = useMemo(() => {
    return data.map((item, index) => ({
      ...item,
      name: item.label,
      fill: COLORS[index % COLORS.length],
    }));
  }, [data]);

  // رسم بياني عمودي
  const renderBarChart = () => (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={chartData} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
        <XAxis type="number" tickFormatter={formatValue} />
        <YAxis 
          type="category" 
          dataKey="label" 
          width={100}
          tick={{ fontSize: 12 }}
        />
        <Tooltip content={<CustomTooltip />} />
        <Bar dataKey="value" fill="#3B82F6" radius={[0, 4, 4, 0]}>
          {chartData.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );

  // رسم بياني خطي
  const renderLineChart = () => (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
        <XAxis dataKey="label" tick={{ fontSize: 11 }} />
        <YAxis tickFormatter={formatValue} />
        <Tooltip content={<CustomTooltip />} />
        <Legend />
        <Line 
          type="monotone" 
          dataKey="value" 
          stroke="#3B82F6" 
          strokeWidth={2}
          dot={{ fill: '#3B82F6', strokeWidth: 2 }}
          activeDot={{ r: 8 }}
          name="القيمة"
        />
      </LineChart>
    </ResponsiveContainer>
  );

  // رسم بياني دائري
  const renderPieChart = () => (
    <ResponsiveContainer width="100%" height={300}>
      <PieChart>
        <Pie
          data={chartData}
          cx="50%"
          cy="50%"
          labelLine={false}
          label={renderCustomLabel}
          outerRadius={100}
          fill="#8884d8"
          dataKey="value"
        >
          {chartData.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
          ))}
        </Pie>
        <Tooltip content={<PieTooltip />} />
        <Legend 
          layout="horizontal" 
          verticalAlign="bottom" 
          align="center"
          formatter={(value, entry: any) => (
            <span className="text-xs text-slate-600 dark:text-slate-300">
              {entry.payload.label}
            </span>
          )}
        />
      </PieChart>
    </ResponsiveContainer>
  );

  // رسم بياني حلقي
  const renderDoughnutChart = () => (
    <ResponsiveContainer width="100%" height={300}>
      <PieChart>
        <Pie
          data={chartData}
          cx="50%"
          cy="50%"
          labelLine={false}
          label={renderCustomLabel}
          innerRadius={60}
          outerRadius={100}
          fill="#8884d8"
          dataKey="value"
        >
          {chartData.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
          ))}
        </Pie>
        <Tooltip content={<PieTooltip />} />
        <Legend 
          layout="horizontal" 
          verticalAlign="bottom" 
          align="center"
          formatter={(value, entry: any) => (
            <span className="text-xs text-slate-600 dark:text-slate-300">
              {entry.payload.label}
            </span>
          )}
        />
      </PieChart>
    </ResponsiveContainer>
  );

  // رسم بياني مساحة
  const renderAreaChart = () => (
    <ResponsiveContainer width="100%" height={300}>
      <AreaChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
        <XAxis dataKey="label" tick={{ fontSize: 11 }} />
        <YAxis tickFormatter={formatValue} />
        <Tooltip content={<CustomTooltip />} />
        <Legend />
        <defs>
          <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.8}/>
            <stop offset="95%" stopColor="#3B82F6" stopOpacity={0.1}/>
          </linearGradient>
        </defs>
        <Area 
          type="monotone" 
          dataKey="value" 
          stroke="#3B82F6" 
          fillOpacity={1}
          fill="url(#colorValue)"
          name="القيمة"
        />
      </AreaChart>
    </ResponsiveContainer>
  );

  // مؤشرات KPI
  const renderKPIChart = () => (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-4 p-4">
      {chartData.map((item, index) => (
        <div
          key={index}
          className="bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-800 dark:to-slate-700 p-4 rounded-xl border border-slate-200 dark:border-slate-600"
        >
          <div className="text-sm text-slate-500 dark:text-slate-400 mb-1">
            {item.label}
          </div>
          <div className="text-2xl font-bold" style={{ color: COLORS[index % COLORS.length] }}>
            {item.suffix ? `${formatValue(item.value)}${item.suffix}` : formatValue(item.value)}
          </div>
        </div>
      ))}
    </div>
  );

  // اختيار نوع الرسم البياني
  const renderChart = () => {
    switch (chartType) {
      case 'bar':
        return renderBarChart();
      case 'line':
        return renderLineChart();
      case 'pie':
        return renderPieChart();
      case 'doughnut':
        return renderDoughnutChart();
      case 'area':
        return renderAreaChart();
      case 'kpi':
        return renderKPIChart();
      default:
        return renderBarChart();
    }
  };

  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-[200px] text-slate-500">
        لا توجد بيانات للعرض
      </div>
    );
  }

  return (
    <div className="w-full">
      {title && (
        <h3 className="text-sm font-medium text-slate-600 dark:text-slate-300 mb-4 text-center">
          {title}
        </h3>
      )}
      {renderChart()}
    </div>
  );
}
