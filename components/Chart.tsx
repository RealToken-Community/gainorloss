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

interface ChartData {
  date: string;
  value: number;
  formattedDate: string;
  type?: string;
  amount?: number;
  timestamp?: number;
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

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    const dataPoint = payload[0];
    const value = dataPoint.value;
    const data = dataPoint.payload;
    
    return (
      <div className="bg-white p-3 rounded-lg shadow-lg border border-gray-200">
        <p className="text-sm text-gray-600 mb-1">{label}</p>
        <p className="text-lg font-semibold text-gray-900">
          {value.toFixed(2)}
        </p>
        {/* Afficher des informations supplémentaires si disponibles */}
        {data && data.type && (
          <p className="text-xs text-gray-500 mt-1">
            Type: {data.type} | Montant: {data.amount?.toFixed(2) || 'N/A'}
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
  // Vérifier si toutes les valeurs sont à 0 (ou très proches de 0)
  // Cela inclut le cas d'un seul point à 0 ou plusieurs points tous à 0
  const allValuesZero = data && data.length > 0 && data.every(point => Math.abs(point.value) < 0.0001);
  
  // Cas 1: Aucune donnée
  if (!data || data.length === 0) {
    return (
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <h3 className="text-xl font-bold text-gray-900">{title}</h3>
            {tokenAddress && userAddress && (
              <MagnetLink 
                tokenAddress={tokenAddress} 
                userAddress={userAddress}
                className="ml-2"
              />
            )}
          </div>
          {currentBalance && (
            <div className="text-sm text-gray-600">
              Balance actuelle: <span className="font-semibold" style={{ color }}>{currentBalance}</span>
            </div>
          )}
        </div>
        <div className="text-center py-12">
          <div className="text-gray-400 text-4xl mb-4">📊</div>
          <p className="text-gray-600 text-sm">Never used</p>
        </div>
      </div>
    );
  }

  // Cas 2: Données filtrées mais toutes à 0 (ou un seul point à 0)
  if (allValuesZero) {
    return (
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <h3 className="text-xl font-bold text-gray-900">{title}</h3>
            {tokenAddress && userAddress && (
              <MagnetLink 
                tokenAddress={tokenAddress} 
                userAddress={userAddress}
                className="ml-2"
              />
            )}
          </div>
          {currentBalance && (
            <div className="text-sm text-gray-600">
              Balance actuelle: <span className="font-semibold" style={{ color }}>{currentBalance}</span>
            </div>
          )}
        </div>
        <div className="text-center py-12">
          <div className="text-gray-400 text-4xl mb-4">📅</div>
          <p className="text-gray-600 text-sm">Not used in this period</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <h3 className="text-xl font-bold text-gray-900">{title}</h3>
          {tokenAddress && userAddress && (
            <MagnetLink 
              tokenAddress={tokenAddress} 
              userAddress={userAddress}
              className="ml-2"
            />
          )}
        </div>
        {currentBalance && (
          <div className="text-sm text-gray-600">
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
                  <stop offset="5%" stopColor={color} stopOpacity={0.3}/>
                  <stop offset="95%" stopColor={color} stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis 
                dataKey="formattedDate" 
                stroke="#6b7280"
                fontSize={12}
                tickLine={false}
                axisLine={false}
              />
              <YAxis 
                stroke="#6b7280"
                fontSize={12}
                tickLine={false}
                axisLine={false}
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
                dot={{ fill: color, strokeWidth: 2, r: 2 }}
                activeDot={{ r: 6, stroke: color, strokeWidth: 2 }}
              />
            </AreaChart>
          ) : (
            <LineChart data={data} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis 
                dataKey="formattedDate" 
                stroke="#6b7280"
                fontSize={12}
                tickLine={false}
                axisLine={false}
              />
              <YAxis 
                stroke="#6b7280"
                fontSize={12}
                tickLine={false}
                axisLine={false}
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
                dot={{ fill: color, strokeWidth: 2, r: 2 }}
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