import React, { useState } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Area,
  AreaChart
} from 'recharts';
import MagnetLink from './MagnetLink';
import { useTheme } from '../contexts/ThemeContext';

interface ChartData {
  date: string;
  value: number;              // Balance
  cumulativeInterest?: number; // Intérêts cumulés sur la période
  formattedDate: string;
  type?: string;
  amount?: number;
  timestamp?: number;
  isSynthetic?: boolean;
}

// Format a unix timestamp as dd/mm/yyyy
const formatTimestamp = (timestamp: number): string => {
  const d = new Date(timestamp * 1000);
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
};

interface ChartProps {
  data: ChartData[];
  title: string;
  color: string;
  interestColor?: string;     // Couleur pour la courbe des intérêts
  currentBalance?: string;
  periodInterest?: string;    // Intérêts de la période affichée
  height?: number;
  type?: 'line' | 'area';
  tokenAddress?: string;
  userAddress?: string;
  showInterestCurve?: boolean; // Afficher ou non la courbe des intérêts
  compressDate?: boolean;      // true = equal spacing (categorical), false = proportional time spacing
}

// Custom dot renderer to show synthetic points with different style
const CustomDot = (props: any) => {
  const { cx, cy, payload, fill, stroke } = props;

  if (!cx || !cy) return null;

  if (payload?.isSynthetic) {
    // Synthetic point: hollow circle with dashed border
    return (
      <g>
        <circle
          cx={cx}
          cy={cy}
          r={5}
          fill="white"
          stroke={stroke || fill}
          strokeWidth={2}
          strokeDasharray="3 2"
        />
        <circle
          cx={cx}
          cy={cy}
          r={2}
          fill={stroke || fill}
        />
      </g>
    );
  }

  // Regular point
  return (
    <circle
      cx={cx}
      cy={cy}
      r={3}
      fill={fill || stroke}
      stroke={stroke || fill}
      strokeWidth={2}
    />
  );
};

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    const balanceData = payload.find((p: any) => p.dataKey === 'value');
    const interestData = payload.find((p: any) => p.dataKey === 'cumulativeInterest');
    const data = balanceData?.payload || interestData?.payload;
    const isSynthetic = data?.isSynthetic;

    return (
      <div className={`p-3 rounded-lg shadow-lg border ${isSynthetic
        ? 'bg-amber-50 dark:bg-amber-900/30 border-amber-200 dark:border-amber-700'
        : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700'
        }`}>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">{data?.formattedDate || label}</p>

        {balanceData && (
          <p className="text-base font-semibold text-gray-900 dark:text-white">
            Balance: {balanceData.value.toFixed(2)}
          </p>
        )}

        {interestData && interestData.value !== undefined && (
          <p className="text-sm font-medium text-emerald-600 dark:text-emerald-400 mt-1">
            Interest: +{interestData.value.toFixed(2)}
          </p>
        )}

        {isSynthetic && (
          <p className="text-xs text-amber-600 dark:text-amber-400 mt-1 flex items-center gap-1">
            <span>~</span> Estimated value
          </p>
        )}
        {data && data.type && !isSynthetic && (
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            Type: {data.type} | Amount: {data.amount?.toFixed(2) || 'N/A'}
          </p>
        )}
      </div>
    );
  }
  return null;
};

const Chart: React.FC<ChartProps> = ({
  data,
  title,
  color,
  interestColor = '#10b981', // emerald-500 par défaut
  currentBalance,
  periodInterest,
  height = 320,
  type = 'line',
  tokenAddress,
  userAddress,
  showInterestCurve = true,
  compressDate = false,
}) => {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const gridColor = isDark ? '#374151' : '#f0f0f0';
  const axisColor = isDark ? '#9ca3af' : '#6b7280';

  // États pour les toggles d'affichage
  const [showBalance, setShowBalance] = useState(true);
  const [showInterest, setShowInterest] = useState(true);

  // Vérifier si on a des données d'intérêts
  const hasInterestData = data.some(point => point.cumulativeInterest !== undefined && point.cumulativeInterest > 0);

  // Vérifier si toutes les valeurs sont à 0 (ou très proches de 0)
  const allValuesZero = data && data.length > 0 && data.every(point => Math.abs(point.value) < 0.0001);

  // Cas 1: Aucune donnée
  if (!data || data.length === 0) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-8">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <h3 className="text-xl font-bold text-gray-900 dark:text-white">{title}</h3>
            {tokenAddress && userAddress && (
              <MagnetLink
                tokenAddress={tokenAddress}
                userAddress={userAddress}
                className="ml-2"
              />
            )}
          </div>
          {currentBalance && (
            <div className="text-sm text-gray-600 dark:text-gray-400">
              Balance actuelle: <span className="font-semibold" style={{ color }}>{currentBalance}</span>
            </div>
          )}
        </div>
        <div className="text-center py-12">
          <div className="text-gray-400 dark:text-gray-500 text-4xl mb-4">📊</div>
          <p className="text-gray-600 dark:text-gray-400 text-sm">Never used</p>
        </div>
      </div>
    );
  }

  // Cas 2: Données filtrées mais toutes à 0 (ou un seul point à 0)
  if (allValuesZero) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-8">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <h3 className="text-xl font-bold text-gray-900 dark:text-white">{title}</h3>
            {tokenAddress && userAddress && (
              <MagnetLink
                tokenAddress={tokenAddress}
                userAddress={userAddress}
                className="ml-2"
              />
            )}
          </div>
          {currentBalance && (
            <div className="text-sm text-gray-600 dark:text-gray-400">
              Balance actuelle: <span className="font-semibold" style={{ color }}>{currentBalance}</span>
            </div>
          )}
        </div>
        <div className="text-center py-12">
          <div className="text-gray-400 dark:text-gray-500 text-4xl mb-4">📅</div>
          <p className="text-gray-600 dark:text-gray-400 text-sm">Not used in this period</p>
        </div>
      </div>
    );
  }

  // Formatter pour les axes Y
  const formatYAxis = (value: number) => {
    if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
    if (value >= 1000) return `${(value / 1000).toFixed(1)}K`;
    return value.toFixed(0);
  };

  const formatInterestAxis = (value: number) => {
    if (value >= 1000) return `+${(value / 1000).toFixed(1)}K`;
    return `+${value.toFixed(0)}`;
  };

  // Toggle button component
  const ToggleButton = ({
    active,
    onClick,
    label,
    activeColor
  }: {
    active: boolean;
    onClick: () => void;
    label: string;
    activeColor: string;
  }) => (
    <button
      onClick={onClick}
      className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${active
        ? 'text-white shadow-sm'
        : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
        }`}
      style={active ? { backgroundColor: activeColor } : {}}
    >
      {label}
    </button>
  );

  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-8">
      <div className="flex flex-col gap-3 mb-4">
        {/* Header row */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div className="flex items-center gap-2">
            <h3 className="text-xl font-bold text-gray-900 dark:text-white">{title}</h3>
            {tokenAddress && userAddress && (
              <MagnetLink
                tokenAddress={tokenAddress}
                userAddress={userAddress}
                className="ml-2"
              />
            )}
          </div>
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 text-sm">
            {currentBalance && (
              <div className="text-gray-600 dark:text-gray-400">
                Balance: <span className="font-semibold" style={{ color }}>{currentBalance}</span>
              </div>
            )}
            {periodInterest && parseFloat(periodInterest) > 0 && (
              <div className="text-gray-600 dark:text-gray-400">
                Interest: <span className="font-semibold text-emerald-600 dark:text-emerald-400">+{periodInterest}</span>
              </div>
            )}
          </div>
        </div>

        {/* Toggle buttons row - only show if we have interest data */}
        {showInterestCurve && hasInterestData && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500 dark:text-gray-400">Show:</span>
            <ToggleButton
              active={showBalance}
              onClick={() => setShowBalance(!showBalance)}
              label="Balance"
              activeColor={color}
            />
            <ToggleButton
              active={showInterest}
              onClick={() => setShowInterest(!showInterest)}
              label="Interest"
              activeColor={interestColor}
            />
          </div>
        )}
      </div>

      <div style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          {type === 'area' ? (
            <AreaChart data={data} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id={`gradient-${color}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={color} stopOpacity={0.3} />
                  <stop offset="95%" stopColor={color} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
              <XAxis
                dataKey={compressDate ? "formattedDate" : "timestamp"}
                type={compressDate ? "category" : "number"}
                domain={compressDate ? undefined : ['dataMin', 'dataMax']}
                tickFormatter={compressDate ? undefined : formatTimestamp}
                stroke={axisColor}
                fontSize={12}
                tickLine={false}
                axisLine={false}
                tick={{ fill: axisColor }}
              />
              {showBalance && (
                <YAxis
                  yAxisId="balance"
                  stroke={axisColor}
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                  tick={{ fill: axisColor }}
                  tickFormatter={formatYAxis}
                />
              )}
              {showInterestCurve && hasInterestData && showInterest && (
                <YAxis
                  yAxisId="interest"
                  orientation={showBalance ? "right" : "left"}
                  stroke={interestColor}
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                  tick={{ fill: interestColor }}
                  tickFormatter={formatInterestAxis}
                />
              )}
              <Tooltip content={<CustomTooltip />} />
              {showBalance && (
                <Area
                  yAxisId="balance"
                  type="monotone"
                  dataKey="value"
                  stroke={color}
                  strokeWidth={2}
                  fill={`url(#gradient-${color})`}
                  dot={<CustomDot fill={color} stroke={color} />}
                  activeDot={{ r: 6, stroke: color, strokeWidth: 2 }}
                  name="Balance"
                />
              )}
              {showInterestCurve && hasInterestData && showInterest && (
                <Line
                  yAxisId="interest"
                  type="monotone"
                  dataKey="cumulativeInterest"
                  stroke={interestColor}
                  strokeWidth={2}
                  strokeDasharray="5 5"
                  dot={false}
                  name="Interest"
                />
              )}
            </AreaChart>
          ) : (
            <LineChart data={data} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
              <XAxis
                dataKey={compressDate ? "formattedDate" : "timestamp"}
                type={compressDate ? "category" : "number"}
                domain={compressDate ? undefined : ['dataMin', 'dataMax']}
                tickFormatter={compressDate ? undefined : formatTimestamp}
                stroke={axisColor}
                fontSize={12}
                tickLine={false}
                axisLine={false}
                tick={{ fill: axisColor }}
              />
              {showBalance && (
                <YAxis
                  yAxisId="balance"
                  stroke={axisColor}
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                  tick={{ fill: axisColor }}
                  tickFormatter={formatYAxis}
                />
              )}
              {showInterestCurve && hasInterestData && showInterest && (
                <YAxis
                  yAxisId="interest"
                  orientation={showBalance ? "right" : "left"}
                  stroke={interestColor}
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                  tick={{ fill: interestColor }}
                  tickFormatter={formatInterestAxis}
                />
              )}
              <Tooltip content={<CustomTooltip />} />
              {showBalance && (
                <Line
                  yAxisId="balance"
                  type="monotone"
                  dataKey="value"
                  stroke={color}
                  strokeWidth={2}
                  dot={<CustomDot fill={color} stroke={color} />}
                  activeDot={{ r: 6, stroke: color, strokeWidth: 2 }}
                  name="Balance"
                />
              )}
              {showInterestCurve && hasInterestData && showInterest && (
                <Line
                  yAxisId="interest"
                  type="monotone"
                  dataKey="cumulativeInterest"
                  stroke={interestColor}
                  strokeWidth={2}
                  strokeDasharray="5 5"
                  dot={false}
                  name="Interest"
                />
              )}
            </LineChart>
          )}
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default Chart;
