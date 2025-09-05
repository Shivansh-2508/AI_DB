import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

export type ChartConfig = {
  type: string;
  x: string;
  y: string;
  data: Array<Record<string, string | number>>;
};

export default function ChartRenderer({ config }: { config: ChartConfig }) {
  if (!config || !config.data || !config.x || !config.y) {
    return (
      <div className="relative group">
        <div className="absolute inset-0 bg-gradient-to-r from-red-600/5 to-orange-600/5 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"></div>
        <div className="relative bg-[#0A0F16]/80 ring-1 ring-gray-800/30 rounded-xl p-5 my-4 text-center backdrop-blur-xl transition-all duration-200">
          <div className="text-red-400/90 text-sm font-medium">Chart configuration invalid or missing.</div>
        </div>
      </div>
    );
  }

  const { type, x, y, data } = config;
  const xKey = x.toLowerCase();
  const yKey = y.toLowerCase();

  return (
    <div className="relative group">
      <div className="absolute inset-0 bg-gradient-to-r from-indigo-600/5 to-violet-600/5 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"></div>
      <div className="relative bg-[#0A0F16]/80 ring-1 ring-gray-800/30 rounded-xl p-5 my-4 backdrop-blur-xl transition-all duration-200">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="text-sm font-medium text-gray-300">Visualization</div>
            <div className="px-2 py-1 text-xs font-medium text-indigo-400/90 bg-indigo-600/10 rounded-md ring-1 ring-indigo-500/20">
              {type === 'bar' ? 'Bar Chart' : type === 'line' ? 'Line Chart' : type}
            </div>
          </div>
        </div>
        <div className="w-full h-[280px]">
          {type === 'bar' && (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" opacity={0.3} />
                <XAxis 
                  dataKey={xKey} 
                  tick={{ fill: '#9ca3af', fontSize: 12 }}
                  stroke="#374151"
                />
                <YAxis 
                  tick={{ fill: '#9ca3af', fontSize: 12 }}
                  stroke="#374151"
                />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: '#1f2937', 
                    border: 'none',
                    borderRadius: '0.5rem',
                    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                  }}
                  itemStyle={{ color: '#e5e7eb' }}
                  labelStyle={{ color: '#9ca3af' }}
                />
                <Legend 
                  wrapperStyle={{ fontSize: 12, color: '#9ca3af' }}
                  iconType="circle"
                />
                <Bar 
                  dataKey={yKey} 
                  fill="#4f46e5" 
                  radius={[4, 4, 0, 0]}
                  opacity={0.8}
                />
              </BarChart>
            </ResponsiveContainer>
          )}
          {type === 'line' && (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" opacity={0.3} />
                <XAxis 
                  dataKey={xKey} 
                  tick={{ fill: '#9ca3af', fontSize: 12 }}
                  stroke="#374151"
                />
                <YAxis 
                  tick={{ fill: '#9ca3af', fontSize: 12 }}
                  stroke="#374151"
                />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: '#1f2937', 
                    border: 'none',
                    borderRadius: '0.5rem',
                    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                  }}
                  itemStyle={{ color: '#e5e7eb' }}
                  labelStyle={{ color: '#9ca3af' }}
                />
                <Legend 
                  wrapperStyle={{ fontSize: 12, color: '#9ca3af' }}
                  iconType="circle"
                />
                <Line 
                  type="monotone" 
                  dataKey={yKey} 
                  stroke="#4f46e5"
                  strokeWidth={2}
                  dot={{ r: 3, fill: '#4f46e5', strokeWidth: 0 }}
                  activeDot={{ r: 5, fill: '#4f46e5' }}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
          {type !== 'bar' && type !== 'line' && (
            <div className="flex items-center justify-center h-full">
              <div className="text-amber-400/90 text-sm font-medium">
                Chart type &apos;{type}&apos; not supported.
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
