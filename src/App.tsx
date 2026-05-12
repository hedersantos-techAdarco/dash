import React, { useState, useMemo } from 'react';
import Papa from 'papaparse';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  LineChart, Line, Cell, PieChart, Pie, Legend
} from 'recharts';
import { 
  Phone, PhoneCall, PhoneIncoming, PhoneOutgoing, 
  Clock, TrendingUp, Filter, Upload, Download,
  Users, CheckCircle2, XCircle, Search, Calendar
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { format, parse, startOfDay, endOfDay, isWithinInterval, subDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';

import { CallRecord, DashboardFilters, KPIStats } from './types.ts';
import { cn, formatDuration, formatDateTime } from './lib/utils.ts';

// --- Components ---

const StatCard = ({ title, value, subtext, icon: Icon, trend }: any) => (
  <motion.div 
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    className="bg-white p-6 rounded-2xl shadow-sm border border-emerald-100 flex items-start justify-between"
  >
    <div>
      <p className="text-sm font-medium text-gray-500 mb-1">{title}</p>
      <h3 className="text-2xl font-bold text-emerald-900">{value}</h3>
      {subtext && <p className="text-xs text-gray-400 mt-1">{subtext}</p>}
      {trend && (
        <span className={cn(
          "inline-flex items-center text-xs font-semibold px-2 py-0.5 rounded-full mt-2",
          trend > 0 ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"
        )}>
          {trend > 0 ? '+' : ''}{trend}%
        </span>
      )}
    </div>
    <div className="p-3 bg-emerald-50 rounded-xl">
      <Icon className="w-6 h-6 text-emerald-600" />
    </div>
  </motion.div>
);

const EmptyState = ({ onUpload }: { onUpload: () => void }) => (
  <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
    <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mb-6">
      <Phone className="w-10 h-10 text-emerald-600" />
    </div>
    <h2 className="text-2xl font-bold text-gray-900 mb-2">Bem-vindo ao Dashboard de Telefonia</h2>
    <p className="text-gray-500 max-w-md mb-8">
      Carregue sua planilha de chamadas (CSV) para começar a analisar a performance da sua equipe.
    </p>
    <button 
      onClick={onUpload}
      className="flex items-center gap-2 bg-emerald-700 hover:bg-emerald-800 text-white px-6 py-3 rounded-xl font-semibold transition-all shadow-lg active:scale-95"
    >
      <Upload size={20} />
      Selecionar Relatório CSV
    </button>
  </div>
);

// --- Main App ---

export default function App() {
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [serverStatus, setServerStatus] = useState<'online' | 'offline' | 'checking'>('checking');

  React.useEffect(() => {
    fetch('/api/health')
      .then(res => res.json())
      .then(data => setServerStatus(data.status === 'ok' ? 'online' : 'offline'))
      .catch(() => setServerStatus('offline'));
  }, []);

  const [isDragging, setIsDragging] = useState(false);
  const [data, setData] = useState<CallRecord[]>([]);
  const [filters, setFilters] = useState<DashboardFilters>({
    dateRange: [null, null],
    agent: 'Todos',
    status: 'Todos',
    type: 'Todos'
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const triggerFileUpload = () => {
    console.log("Triggering file upload click...");
    setErrorMsg(null);
    if (fileInputRef.current) {
      fileInputRef.current.click();
    } else {
      console.error("File input ref is null!");
    }
  };

  const processFile = (file: File) => {
    console.log("Processing file:", file.name, file.size, file.type);
    setErrorMsg(null);
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        if (!results.data || results.data.length === 0) {
          setErrorMsg("O arquivo parece estar vazio ou em formato inválido.");
          return;
        }

        const parsedData: CallRecord[] = results.data
          .filter((row: any) => row['Data'] || row['Date'] || row['timestamp']) 
          .map((row: any, index) => {
            const timestampStr = row['Data'] || row['Date'] || row['timestamp'] || '';
            let timestamp = new Date();
            
            // Tentativa de parsing flexível
            const formats = [
              'yyyy-MM-dd HH:mm:ss',
              'dd/MM/yyyy HH:mm:ss',
              'dd/MM/yyyy HH:mm',
              'MM/dd/yyyy HH:mm:ss',
              'yyyy-MM-dd'
            ];

            for (const fmt of formats) {
              try {
                const p = parse(timestampStr, fmt, new Date(), { locale: ptBR });
                if (!isNaN(p.getTime())) {
                  timestamp = p;
                  break;
                }
              } catch (e) {}
            }

            // Fallback para Date nativo se falhar
            if (isNaN(timestamp.getTime())) {
              timestamp = new Date(timestampStr);
            }
            
            if (isNaN(timestamp.getTime())) {
              timestamp = new Date();
            }

            const extension = row['Origem'] || row['Source'] || row['Extension'] || 'N/A';
            const fila = row['Fila'] || row['Queue'] || '';
            const agent = fila ? `${fila} (${extension})` : `Ramal ${extension}`;
            
            const durationRaw = row['Duracao'] || row['Duração'] || row['Duration'] || '0';
            
            return {
              id: index.toString(),
              timestamp,
              extension,
              agent,
              duration: parseInt(durationRaw) || 0,
              status: (row['Status'] || '').toLowerCase().includes('atend') ? 'Atendida' : 'Perdida',
              type: (row['Tipo'] || row['Type'] || '').toLowerCase().includes('entr') ? 'Destino' : 'Origem'
            };
          });

        if (parsedData.length > 0) {
          setData(parsedData);
        }
      },
      error: (error) => {
        console.error("Erro ao processar CSV:", error);
      }
    });
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    processFile(file);
    // Limpar o valor para permitir re-upload do mesmo arquivo
    if (event.target) event.target.value = '';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file && file.type === "text/csv" || file.name.endsWith('.csv')) {
      processFile(file);
    }
  };

  const dashboardData = useMemo(() => {
    return data.filter(item => {
      const matchesAgent = filters.agent === 'Todos' || item.agent === filters.agent;
      const matchesStatus = filters.status === 'Todos' || item.status === filters.status;
      const matchesType = filters.type === 'Todos' || item.type === filters.type;
      
      let matchesRange = true;
      if (filters.dateRange[0] && filters.dateRange[1]) {
        matchesRange = isWithinInterval(item.timestamp, {
          start: startOfDay(filters.dateRange[0]),
          end: endOfDay(filters.dateRange[1])
        });
      }

      const matchesSearch = searchQuery === '' || 
        item.agent.toLowerCase().includes(searchQuery.toLowerCase()) || 
        item.extension.includes(searchQuery);

      return matchesAgent && matchesStatus && matchesType && matchesRange && matchesSearch;
    });
  }, [data, filters, searchQuery]);

  const stats = useMemo((): KPIStats => {
    const total = dashboardData.length;
    const handled = dashboardData.filter(d => d.status === 'Atendida');
    const lost = dashboardData.filter(d => d.status === 'Perdida');
    const incoming = dashboardData.filter(d => d.type === 'Destino');
    const outgoing = dashboardData.filter(d => d.type === 'Origem');
    
    const totalDuration = handled.reduce((acc, curr) => acc + curr.duration, 0);
    const tma = handled.length > 0 ? totalDuration / handled.length : 0;

    return {
      totalCalls: total,
      totalReceived: incoming.length,
      totalMade: outgoing.length,
      tma,
      successRate: total > 0 ? (handled.length / total) * 100 : 0,
      lostRate: total > 0 ? (lost.length / total) * 100 : 0
    };
  }, [dashboardData]);

  const topAgents = useMemo(() => {
    const counts: Record<string, number> = {};
    dashboardData.forEach(d => {
      counts[d.agent] = (counts[d.agent] || 0) + 1;
    });
    return Object.entries(counts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }, [dashboardData]);

  const callsByDay = useMemo(() => {
    const groups: Record<string, { date: string, count: number }> = {};
    dashboardData.forEach(d => {
      const day = format(d.timestamp, 'dd/MM', { locale: ptBR });
      if (!groups[day]) groups[day] = { date: day, count: 0 };
      groups[day].count++;
    });
    return Object.values(groups).sort((a, b) => a.date.localeCompare(b.date));
  }, [dashboardData]);

  const durationDistribution = useMemo(() => {
    const dist = [
      { name: 'Curta (<1m)', count: 0 },
      { name: 'Média (1-5m)', count: 0 },
      { name: 'Longa (>5m)', count: 0 }
    ];
    dashboardData.filter(d => d.status === 'Atendida').forEach(d => {
      if (d.duration < 60) dist[0].count++;
      else if (d.duration < 300) dist[1].count++;
      else dist[2].count++;
    });
    return dist;
  }, [dashboardData]);

  const agentsList = useMemo(() => {
    return ['Todos', ...Array.from(new Set(data.map(d => d.agent)))].sort();
  }, [data]);

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <header className="bg-emerald-900 text-white px-6 py-4 flex items-center justify-between shadow-lg sticky top-0 z-50">
          <div className="flex items-center gap-3">
            <div className="bg-emerald-500 p-2 rounded-lg">
              <PhoneCall className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight">Adarco</h1>
              <div className="flex items-center gap-2">
                <p className="text-[10px] text-emerald-300 uppercase font-semibold tracking-widest">Inside Sales Performance</p>
                <div className={cn(
                  "w-1.5 h-1.5 rounded-full animate-pulse",
                  serverStatus === 'online' ? "bg-emerald-400" : "bg-red-400"
                )} />
              </div>
            </div>
          </div>

        <input 
          type="file" 
          ref={fileInputRef} 
          accept=".csv" 
          className="hidden" 
          onChange={handleFileUpload} 
        />

        {data.length > 0 && (
          <div className="flex items-center gap-4">
            <div className="hidden md:flex relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-emerald-400 w-4 h-4" />
              <input 
                type="text" 
                placeholder="Buscar agente ou ramal..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="bg-emerald-800/50 border border-emerald-700 rounded-lg pl-10 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all w-64"
              />
            </div>
            <button 
              onClick={triggerFileUpload}
              className="bg-emerald-500 hover:bg-emerald-400 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-all flex items-center gap-2 shadow-md active:scale-95"
            >
              <Upload size={16} />
              <span>Novo Log</span>
            </button>
          </div>
        )}
      </header>

      <main 
        className={cn(
          "flex-1 p-6 max-w-[1600px] mx-auto w-full transition-all duration-300",
          isDragging && "bg-emerald-50 scale-[0.99] rounded-3xl"
        )}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {isDragging && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-emerald-900/20 backdrop-blur-sm pointer-events-none">
            <div className="bg-white p-8 rounded-3xl shadow-2xl border-4 border-dashed border-emerald-500 flex flex-col items-center gap-4 animate-in zoom-in duration-300">
              <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center">
                <Upload className="w-8 h-8 text-emerald-600 animate-bounce" />
              </div>
              <p className="text-xl font-bold text-emerald-900">Solte para importar o CSV</p>
            </div>
          </div>
        )}
        {errorMsg && (
          <motion.div 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6 p-4 bg-red-50 border border-red-100 text-red-700 rounded-xl flex items-center justify-between"
          >
            <div className="flex items-center gap-3">
              <XCircle className="w-5 h-5" />
              <p className="text-sm font-medium">{errorMsg}</p>
            </div>
            <button onClick={() => setErrorMsg(null)} className="text-red-400 hover:text-red-600 transition-colors">
              <XCircle className="w-4 h-4" />
            </button>
          </motion.div>
        )}
        {data.length === 0 ? (
          <EmptyState onUpload={triggerFileUpload} />
        ) : (
          <div className="space-y-6">
            {/* Filters Row */}
            <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 rounded-lg border border-gray-100">
                <Filter size={16} className="text-emerald-600" />
                <span className="text-sm font-semibold text-gray-700">Filtros:</span>
              </div>
              
              <div className="flex flex-col">
                <label className="text-[10px] font-bold text-gray-400 uppercase ml-1">Agente</label>
                <select 
                  className="bg-white border-none text-sm font-medium focus:ring-0 p-0 cursor-pointer"
                  value={filters.agent}
                  onChange={(e) => setFilters({...filters, agent: e.target.value})}
                >
                  {agentsList.map(a => <option key={a} value={a}>{a}</option>)}
                </select>
              </div>

              <div className="w-px h-8 bg-gray-100 hidden sm:block" />

              <div className="flex flex-col">
                <label className="text-[10px] font-bold text-gray-400 uppercase ml-1">Status</label>
                <select 
                  className="bg-white border-none text-sm font-medium focus:ring-0 p-0 cursor-pointer"
                  value={filters.status}
                  onChange={(e) => setFilters({...filters, status: e.target.value})}
                >
                  <option value="Todos">Todos</option>
                  <option value="Atendida">Atendidas</option>
                  <option value="Perdida">Perdidas</option>
                </select>
              </div>

              <div className="w-px h-8 bg-gray-100 hidden sm:block" />

              <div className="flex flex-col">
                <label className="text-[10px] font-bold text-gray-400 uppercase ml-1">Tipo</label>
                <select 
                  className="bg-white border-none text-sm font-medium focus:ring-0 p-0 cursor-pointer"
                  value={filters.type}
                  onChange={(e) => setFilters({...filters, type: e.target.value})}
                >
                  <option value="Todos">Todos</option>
                  <option value="Origem">Originadas</option>
                  <option value="Destino">Recebidas</option>
                </select>
              </div>

              <button 
                onClick={() => setFilters({
                  dateRange: [null, null],
                  agent: 'Todos',
                  status: 'Todos',
                  type: 'Todos'
                })}
                className="ml-auto text-xs font-bold text-emerald-600 hover:text-emerald-700 px-3 py-1 bg-emerald-50 rounded-full"
              >
                Limpar Filtros
              </button>
            </div>

            {/* KPIs */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard 
                title="Total de Chamadas" 
                value={stats.totalCalls} 
                subtext={`${stats.totalReceived} rec. / ${stats.totalMade} orig.`}
                icon={Phone} 
              />
              <StatCard 
                title="TMA (Média Atend.)" 
                value={formatDuration(stats.tma)} 
                subtext="Tempo total segmentado"
                icon={Clock} 
              />
              <StatCard 
                title="Taxa de Atendimento" 
                value={`${stats.successRate.toFixed(1)}%`}
                trend={stats.successRate > 80 ? 5 : -2}
                icon={CheckCircle2} 
              />
              <StatCard 
                title="Chamadas Perdidas" 
                value={`${stats.lostRate.toFixed(1)}%`}
                trend={stats.lostRate < 10 ? -12 : 8}
                icon={XCircle} 
              />
            </div>

            {/* Charts Section */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Ranking Colunas */}
              <div className="lg:col-span-2 bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="font-bold text-gray-800 flex items-center gap-2">
                    <Users className="w-5 h-5 text-emerald-600" />
                    Ranking de Produtividade por Agente
                  </h3>
                </div>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={topAgents} layout="vertical" margin={{ left: 40, right: 30 }}>
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                      <XAxis type="number" hide />
                      <YAxis 
                        dataKey="name" 
                        type="category" 
                        axisLine={false} 
                        tickLine={false} 
                        style={{ fontSize: '12px', fontWeight: 500, fill: '#64748b' }}
                      />
                      <Tooltip 
                        cursor={{ fill: '#f8fafc' }}
                        contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                      />
                      <Bar dataKey="count" fill="#10b981" radius={[0, 4, 4, 0]} barSize={24} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Distribuição Duração */}
              <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                <h3 className="font-bold text-gray-800 mb-6 flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-emerald-600" />
                  Perfil de Duração
                </h3>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={durationDistribution}
                        innerRadius={60}
                        outerRadius={80}
                        paddingAngle={5}
                        dataKey="count"
                      >
                        {[0, 1, 2].map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={['#d1fae5', '#34d399', '#064e3b'][index]} />
                        ))}
                      </Pie>
                      <Tooltip 
                        contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                      />
                      <Legend verticalAlign="bottom" height={36}/>
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Volume Temporal */}
              <div className="lg:col-span-3 bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                <h3 className="font-bold text-gray-800 mb-6 flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-emerald-600" />
                  Evolução do Volume de Chamadas
                </h3>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={callsByDay}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis 
                        dataKey="date" 
                        axisLine={false} 
                        tickLine={false}
                        style={{ fontSize: '11px', fill: '#94a3b8' }} 
                      />
                      <YAxis 
                        axisLine={false} 
                        tickLine={false}
                        style={{ fontSize: '11px', fill: '#94a3b8' }}
                      />
                      <Tooltip 
                        contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                      />
                      <Line 
                        type="monotone" 
                        dataKey="count" 
                        stroke="#10b981" 
                        strokeWidth={4} 
                        dot={{ r: 4, strokeWidth: 2, fill: '#fff' }}
                        activeDot={{ r: 6, strokeWidth: 0 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            {/* Detailed Table */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="p-6 border-bottom border-gray-100 flex items-center justify-between">
                <h3 className="font-bold text-gray-800">Detalhamento de Chamadas</h3>
                <span className="text-xs font-medium text-gray-400">{dashboardData.length} registros encontrados</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="bg-gray-50 border-y border-gray-100">
                    <tr>
                      <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Data / Hora</th>
                      <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Agente</th>
                      <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Ramal</th>
                      <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Duração</th>
                      <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Tipo</th>
                      <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-wider text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {dashboardData.slice(0, 50).map((call) => (
                      <tr key={call.id} className="hover:bg-emerald-50/30 transition-colors">
                        <td className="px-6 py-4 text-xs font-medium text-gray-600">{formatDateTime(call.timestamp)}</td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 bg-emerald-100 rounded-full flex items-center justify-center text-[10px] font-bold text-emerald-700">
                              {call.agent.substring(0, 2).toUpperCase()}
                            </div>
                            <span className="text-sm font-semibold text-gray-800">{call.agent}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-500 font-mono">{call.extension}</td>
                        <td className="px-6 py-4 text-sm text-gray-500">{formatDuration(call.duration)}</td>
                        <td className="px-6 py-4">
                          <span className={cn(
                            "px-2 py-1 rounded text-[10px] font-bold uppercase",
                            call.type === 'Origem' ? "bg-blue-50 text-blue-600" : "bg-purple-50 text-purple-600"
                          )}>
                            {call.type}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <span className={cn(
                            "inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold",
                            call.status === 'Atendida' ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"
                          )}>
                            {call.status === 'Atendida' ? <CheckCircle2 size={12} /> : <XCircle size={12} />}
                            {call.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {dashboardData.length > 50 && (
                <div className="p-4 bg-gray-50 text-center border-t border-gray-100">
                  <p className="text-xs text-gray-400 italic">Mostrando os primeiros 50 registros. Use filtros para refinar os resultados.</p>
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      <footer className="bg-white border-t border-gray-100 py-6 px-6 text-center">
        <p className="text-xs text-gray-400 font-medium">Dashboard Analytics • Telefonia BI & Performance</p>
      </footer>
    </div>
  );
}
