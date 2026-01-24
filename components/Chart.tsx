import React from 'react';
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
  value: number;
  formattedDate: string;
  type?: string;
  amount?: number;
  timestamp?: number;
  isSynthetic?: boolean;
}

interface ChartProps {
  data: ChartData[];
  title: string;
  color: string;
  currentBalance?: string;
  height?: number;
  type?: 'line' | 'area';
  tokenAddress?: string;
  userAddress?: string;
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
    const dataPoint = payload[0];
    const value = dataPoint.value;
    const data = dataPoint.payload;
    const isSynthetic = data?.isSynthetic;

    return (
      <div className={`p-3 rounded-lg shadow-lg border ${isSynthetic
          ? 'bg-amber-50 dark:bg-amber-900/30 border-amber-200 dark:border-amber-700'
          : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700'
        }`}>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">{label}</p>
        <p className="text-lg font-semibold text-gray-900 dark:text-white">
          {value.toFixed(2)}
        </p>
        {isSynthetic && (
          <p className="text-xs text-amber-600 dark:text-amber-400 mt-1 flex items-center gap-1">
            <span>~</span> Estimated start value
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
  currentBalance,
  height = 320,
  type = 'line',
  tokenAddress,
  userAddress,
}) => {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const gridColor = isDark ? '#374151' : '#f0f0f0';
  const axisColor = isDark ? '#9ca3af' : '#6b7280';

  // Vérifier si toutes les valeurs sont à 0 (ou très proches de 0)
  // Cela inclut le cas d'un seul point à 0 ou plusieurs points tous à 0
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

  // Check if there's a synthetic point
  const hasSyntheticPoint = data.some(point => point.isSynthetic);

  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-8">
      <div className="flex items-center justify-between mb-4">
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
                dataKey="formattedDate"
                stroke={axisColor}
                fontSize={12}
                tickLine={false}
                axisLine={false}
                tick={{ fill: axisColor }}
              />
              <YAxis
                stroke={axisColor}
                fontSize={12}
                tickLine={false}
                axisLine={false}
                tick={{ fill: axisColor }}
                tickFormatter={(value) => {
                  if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
                  if (value >= 1000) return `${(value / 1000).toFixed(1)}K`;
                  return value.toFixed(2);
                }}
              />
              <Tooltip content={<CustomTooltip />} />
              <Area
                type="monotone"
                dataKey="value"
                stroke={color}
                strokeWidth={2}
                fill={`url(#gradient-${color})`}
                dot={<CustomDot fill={color} stroke={color} />}
                activeDot={{ r: 6, stroke: color, strokeWidth: 2 }}
              />
            </AreaChart>
          ) : (
            <LineChart data={data} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
              <XAxis
                dataKey="formattedDate"
                stroke={axisColor}
                fontSize={12}
                tickLine={false}
                axisLine={false}
                tick={{ fill: axisColor }}
              />
              <YAxis
                stroke={axisColor}
                fontSize={12}
                tickLine={false}
                axisLine={false}
                tick={{ fill: axisColor }}
                tickFormatter={(value) => {
                  if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
                  if (value >= 1000) return `${(value / 1000).toFixed(1)}K`;
                  return value.toFixed(2);
                }}
              />
              <Tooltip content={<CustomTooltip />} />
              <Line
                type="monotone"
                dataKey="value"
                stroke={color}
                strokeWidth={2}
                dot={<CustomDot fill={color} stroke={color} />}
                activeDot={{ r: 6, stroke: color, strokeWidth: 2 }}
              />
            </LineChart>
          )}
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default Chart; 