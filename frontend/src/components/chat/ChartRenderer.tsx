import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

export type ChartConfig = {
  type: string;
  x: string;
  y: string;
  data: Array<Record<string, string | number>>;
};

export default function ChartRenderer({ config }: { config: ChartConfig }) {
  if (!config || !config.data || !config.x || !config.y) {
    return <div className="text-red-500">Chart config invalid or missing.</div>;
  }

  // Always use lowercase keys for axes and data
  const { type, x, y, data } = config;
  const xKey = x.toLowerCase();
  const yKey = y.toLowerCase();

  if (type === 'bar') {
    return (
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={data} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey={xKey} />
          <YAxis />
          <Tooltip />
          <Legend />
          <Bar dataKey={yKey} fill="#14B8A6" />
        </BarChart>
      </ResponsiveContainer>
    );
  }
  if (type === 'line') {
    return (
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={data} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey={xKey} />
          <YAxis />
          <Tooltip />
          <Legend />
          <Line type="monotone" dataKey={yKey} stroke="#E91E63" />
        </LineChart>
      </ResponsiveContainer>
    );
  }
  return <div className="text-yellow-500">Chart type {`&apos;${type}&apos;`} not supported.</div>;
}
