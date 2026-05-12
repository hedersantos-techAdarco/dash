import React, { useState, useMemo } from 'react';
import Papa from 'papaparse';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  Cell, TooltipProps, PieChart, Pie
} from 'recharts';
import { 
  Phone, PhoneCall, PhoneIncoming, PhoneOutgoing, 
  TrendingUp, Filter, Upload,
  Users, CheckCircle2, XCircle, Search, Calendar,
  ChevronDown, ArrowUpRight, ArrowDownRight, Menu, X
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { parse } from 'date-fns';
import { ptBR } from 'date-fns/locale';

import { CallRecord, TeamName } from './types.ts';
import { CONSULTANT_MAPPING } from './constants.ts';
import { cn, formatDuration } from './lib/utils.ts';

// --- Components ---

interface StatCardProps {
  title: string;
  value: string | number;
  subtext?: string;
  icon: React.ElementType;
  trend?: number;
  colorClass?: "primary" | "secondary";
}

const StatCard = ({ title, value, subtext, icon: Icon, trend, colorClass = "primary" }: StatCardProps) => (
  <motion.div 
    initial={{ opacity: 0, y: 20 }}
    whileHover={{ y: -4, transition: { duration: 0.2 } }}
    animate={{ opacity: 1, y: 0 }}
    className={cn(
      "bg-white/70 backdrop-blur-lg p-7 rounded-[1.25rem] shadow-soft border flex items-start justify-between transition-all hover:shadow-lg",
      colorClass === "primary" ? "border-adarco-light/30" : "border-slate-100/50"
    )}
  >
    <div className="flex flex-col h-full justify-between">
      <div>
        <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">{title}</p>
        <h3 className={cn(
          "text-2xl md:text-3xl font-bold tracking-tight",
          colorClass === "primary" ? "text-adarco-dark" : "text-slate-800"
        )}>{value}</h3>
      </div>
      
      <div className="mt-4 flex flex-wrap items-center gap-2">
        {trend !== undefined && (
          <span className={cn(
            "inline-flex items-center gap-1 text-[11px] font-extrabold px-2.5 py-1 rounded-lg",
            trend >= 0 ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"
          )}>
            {trend >= 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
            {Math.abs(trend)}%
          </span>
        )}
        {subtext && <p className="text-[10px] font-semibold text-slate-400 uppercase">{subtext}</p>}
      </div>
    </div>
    <div className={cn(
      "p-4 rounded-2xl",
      colorClass === "primary" ? "bg-adarco-soft" : "bg-slate-50"
    )}>
      <Icon className={cn(
        "w-6 h-6",
        colorClass === "primary" ? "text-adarco-primary" : "text-slate-400"
      )} />
    </div>
  </motion.div>
);

const EmptyState = ({ onUpload, onSync, isSyncing }: { onUpload: () => void, onSync: () => void, isSyncing: boolean }) => (
  <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
    <div className="w-16 h-16 md:w-20 md:h-20 bg-adarco-light/30 rounded-full flex items-center justify-center mb-6">
      <Users className="w-8 h-8 md:w-10 md:h-10 text-adarco-dark" />
    </div>
    <h2 className="text-2xl md:text-3xl font-black text-adarco-dark tracking-tighter mb-2 text-center md:text-left">Dashboard Inside Sales</h2>
    <p className="text-slate-500 max-w-md mb-8 font-medium text-center md:text-left text-sm md:text-base">
      Sincronize os dados diretamente da API de telefonia ou carregue um relatório CSV manualmente.
    </p>
    <div className="flex flex-col sm:flex-row gap-4">
      <button 
        onClick={onSync}
        disabled={isSyncing}
        className={cn(
          "flex items-center justify-center gap-2 bg-adarco-dark hover:bg-black text-white px-8 py-3 rounded-xl font-semibold transition-all shadow-lg active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed min-w-[220px]",
          isSyncing && "animate-pulse"
        )}
      >
        {isSyncing ? "Sincronizando..." : <><TrendingUp size={20} /> Sincronizar API</>}
      </button>
      <button 
        onClick={onUpload}
        className="flex items-center justify-center gap-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 px-8 py-3 rounded-xl font-semibold transition-all shadow-sm active:scale-95"
      >
        <Upload size={20} />
        Carregar CSV
      </button>
    </div>
  </div>
);

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white p-3 border border-gray-100 shadow-xl rounded-lg">
        <p className="text-sm font-bold text-gray-800 mb-1">{label}</p>
        {payload.map((entry, index) => (
          <div key={index} className="flex items-center gap-2 text-xs">
            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
            <span className="text-gray-500">{entry.name}:</span>
            <span className="font-bold text-gray-900">{entry.value}</span>
          </div>
        ))}
      </div>
    );
  }
  return null;
};

interface FilterSelectProps {
  label: string;
  value: string;
  onChange: (val: string) => void;
  options: { label: string; value: string }[];
  icon?: React.ElementType;
}

const FilterSelect = ({ label, value, onChange, options, icon: Icon }: FilterSelectProps) => (
  <div className="space-y-2">
    <p className="text-xs font-bold text-white/70 pl-1 flex items-center gap-2">
      {Icon && <Icon className="w-3.5 h-3.5" />} {label}
    </p>
    <div className="relative">
      <select 
        className="w-full bg-white/10 border border-white/20 rounded-xl py-3 pl-4 pr-10 text-sm font-bold appearance-none focus:ring-2 focus:ring-white/20 focus:bg-[#004D2C] outline-none transition-all cursor-pointer text-white backdrop-blur-xl"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        {options.map(opt => (
          <option key={opt.value} className="bg-[#004D2C]" value={opt.value}>{opt.label}</option>
        ))}
      </select>
      <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/50 pointer-events-none" />
    </div>
  </div>
);

// --- Main App ---

export default function App() {
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [data, setData] = useState<CallRecord[]>([]);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [selectedTeam, setSelectedTeam] = useState<string>('Todos');
  const [selectedConsultant, setSelectedConsultant] = useState<string>('Todos');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedType, setSelectedType] = useState<string>('Todos');
  const [startDate, setStartDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(1); // Primeiro dia do mês atual
    return d.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  // Sincroniza automaticamente ao abrir o sistema e a cada 5 minutos
  React.useEffect(() => {
    syncWithAPI();
    
    const interval = setInterval(() => {
      console.log("[Auto-Refresh] Iniciando atualização programada (5 min)...");
      syncWithAPI();
    }, 5 * 60 * 1000); // 5 minutos

    return () => clearInterval(interval);
  }, [startDate, endDate]);

  React.useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 768) {
        setIsSidebarOpen(false);
      } else {
        setIsSidebarOpen(true);
      }
    };
    handleResize(); 
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const syncWithAPI = async () => {
    setIsSyncing(true);
    setErrorMsg(null);
    try {
      const params = new URLSearchParams();
      
      // Se tiver data, garante que pega o dia inteiro (00:00 até 23:59)
      if (startDate) {
        const start = new Date(startDate);
        start.setHours(0, 0, 0, 0);
        params.append("startDate", start.toISOString());
      }
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        params.append("endDate", end.toISOString());
      }
      
      params.append("limit", "1000");

      console.log("[App] Sincronizando com params:", params.toString());
      const response = await fetch(`/api/telephony/calls?${params.toString()}`);
      
      if (!response.ok) {
        let errorInfo;
        try {
          errorInfo = await response.json();
        } catch {
          errorInfo = { error: "Erro desconhecido na rede." };
        }
        
        const detail = errorInfo.detail ? (typeof errorInfo.detail === 'object' ? JSON.stringify(errorInfo.detail) : errorInfo.detail) : "";
        throw new Error(`${errorInfo.error || "Falha na API"} ${detail}`);
      }

      const result = await response.json();
      console.log("[App] Resultado bruto da API:", result);
      
      // Verificando se é array ou tem campo data
      // Algumas APIs paginadas retornam { data: [], total: ... } ou { calls: [], ... }
      const rawCalls = Array.isArray(result) 
        ? result 
        : (result.data || result.calls || result.ligacoes || []);

      console.log(`[App] Total de chamadas brutas recebidas: ${rawCalls.length}`);

      if (rawCalls.length === 0) {
        setErrorMsg("A API retornou zero chamadas para este período. Verifique se há dados no painel da Bem Melhor ou tente aumentar o intervalo de datas.");
        return;
      }

      const processedData: CallRecord[] = rawCalls.map((call: any) => {
        const origin = String(call.origin || '');
        const destiny = String(call.destiny || '');
        const mappingOrig = CONSULTANT_MAPPING[origin];
        const mappingDest = CONSULTANT_MAPPING[destiny];
        
        const consultant = mappingOrig || mappingDest;
        const typeRaw = String(call.type || '').toLowerCase();
        
        let type = '';
        if (typeRaw.includes('sainte') || typeRaw.includes('outbound')) {
          type = 'Ativa';
        } else if (typeRaw.includes('entrante') || typeRaw.includes('inbound')) {
          type = 'Receptiva';
        }

        const disposition = String(call.disposition || call.status || '').toUpperCase();
        // Critério técnico Adarco: Bilhetagem > 0 significa que houve atendimento real
        const billablesec = Number(call.billablesec || 0);
        const isAttended = disposition.includes('ANSWER') || disposition.includes('ATEND') || billablesec > 0;
        const status = isAttended ? 'Atendida' : 'Perdida';

        return {
          timestamp: new Date(call.startDate || call.date || Date.now()).toISOString(),
          status,
          duration: billablesec, // Usamos o tempo de fala como duração principal
          consultantName: consultant?.name,
          team: consultant?.team,
          extension: consultant?.extension || origin || destiny,
          type: type as any
        };
      }).filter((d: any) => d.type !== ''); 

      setData(processedData);
      setLastUpdated(new Date());
    } catch (error: any) {
      console.error("Erro na sincronização:", error);
      setErrorMsg(error.message || "Erro ao conectar com a API de telefonia.");
    } finally {
      setIsSyncing(false);
    }
  };

  const triggerFileUpload = () => {
    setErrorMsg(null);
    fileInputRef.current?.click();
  };

  const processFile = (file: File) => {
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
          .map((row: any) => {
            // Busca o ramal tanto na origem quanto no destino (comum em chamadas Receptivas)
            const orig = String(row['Origem'] || row['Ramal'] || row['Extension'] || '').trim();
            const dest = String(row['Destino'] || row['Destination'] || row['Número discado'] || row['Discado'] || '').trim();
            
            const mappingOrig = CONSULTANT_MAPPING[orig];
            const mappingDest = CONSULTANT_MAPPING[dest];
            
            // Log para debug de ramais ignorados
            if (!mappingOrig && !mappingDest) {
              console.log(`[CSV] Ramal ignorado: Orig=${orig}, Dest=${dest}`);
            }

            const mapping = mappingOrig || mappingDest;
            if (!mapping) return null;

            const extensionIdentified = mappingOrig ? orig : dest;

            const timestampStr = row['Data'] || row['timestamp'] || '';
            let timestamp = new Date();
            const formats = ['yyyy-MM-dd HH:mm:ss', 'dd/MM/yyyy HH:mm:ss', 'dd/MM/yyyy HH:mm', 'MM/dd/yyyy HH:mm:ss'];

            for (const fmt of formats) {
              try {
                const p = parse(timestampStr, fmt, new Date(), { locale: ptBR });
                if (!isNaN(p.getTime())) {
                  timestamp = p;
                  break;
                }
              } catch (e) {}
            }

            const bilhetagemRaw = row['Bilhetagem'] || row['billablesec'] || '0';
            const bilhetagem = parseInt(bilhetagemRaw) || 0;

            const statusRaw = String(row['Status'] || row['status'] || row['disposition'] || '').toUpperCase();
            // Critério técnico Adarco: Bilhetagem > 0 significa que houve atendimento real
            const isAttended = statusRaw.includes('ANSWER') || statusRaw.includes('ATEND') || bilhetagem > 0;
            const status = isAttended ? 'Atendida' : 'Perdida';
            
            const typeRaw = String(row['Tipo'] || row['tipo'] || row['type'] || '').toLowerCase();
            
            // Filtros solicitados: ignorar 'internal' e aceitar apenas 'sainte'/'outbound' ou 'entrante'/'inbound'
            if (typeRaw.includes('internal')) return null;

            let type = '';
            if (typeRaw.includes('sainte') || typeRaw.includes('outbound')) {
              type = 'Ativa';
            } else if (typeRaw.includes('entrante') || typeRaw.includes('inbound')) {
              type = 'Receptiva';
            } else {
              return null;
            }

            return {
              extension: extensionIdentified,
              type,
              status,
              duration: bilhetagem,
              timestamp: timestamp.toISOString(),
              consultantName: mapping.name,
              team: mapping.team
            };
          })
          .filter((item): item is CallRecord => item !== null);

        if (parsedData.length > 0) {
          setData(parsedData);
          
          // Set initial date range
          const dates = parsedData.map(d => new Date(d.timestamp).getTime());
          const minDate = new Date(Math.min(...dates)).toISOString().split('T')[0];
          const maxDate = new Date(Math.max(...dates)).toISOString().split('T')[0];
          setStartDate(minDate);
          setEndDate(maxDate);
        } else {
          setErrorMsg("Nenhum dado de Inside Sales (Débora/Marília) foi encontrado no arquivo.");
        }
      },
      error: (error) => {
        setErrorMsg("Erro ao processar CSV: " + error.message);
      }
    });
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) processFile(file);
    if (event.target) event.target.value = '';
  };

  const availableConsultants = useMemo(() => {
    const baseList = Object.values(CONSULTANT_MAPPING);
    if (selectedTeam === 'Todos') return ['Todos', ...Array.from(new Set(baseList.map(c => c.name)))].sort();
    return ['Todos', ...baseList.filter(c => c.team === selectedTeam).map(c => c.name)].sort();
  }, [selectedTeam]);

  const dateFilteredData = useMemo(() => {
    return data.filter(item => {
      const itemDate = (item.timestamp || '').split('T')[0];
      const matchesStartDate = !startDate || itemDate >= startDate;
      const matchesEndDate = !endDate || itemDate <= endDate;
      return matchesStartDate && matchesEndDate;
    });
  }, [data, startDate, endDate]);

  const filteredData = useMemo(() => {
    return dateFilteredData.filter(item => {
      const matchesTeam = selectedTeam === 'Todos' || item.team === selectedTeam;
      const matchesConsultant = selectedConsultant === 'Todos' || item.consultantName === selectedConsultant;
      const matchesType = selectedType === 'Todos' || item.type === selectedType;
      const matchesSearch = searchQuery === '' || 
        item.consultantName?.toLowerCase().includes(searchQuery.toLowerCase()) || 
        item.extension.includes(searchQuery);
      
      return matchesTeam && matchesConsultant && matchesType && matchesSearch;
    });
  }, [dateFilteredData, selectedTeam, selectedConsultant, selectedType, searchQuery]);

  const dashboardStats = useMemo(() => {
    const activeCounts: Record<string, { name: string, count: number, team: string }> = {};
    const successCounts: Record<string, { name: string, count: number, team: string }> = {};
    const summary: Record<string, { 
      name: string, 
      team: TeamName, 
      extension: string,
      total: number, 
      success: number, 
      totalDuration: number 
    }> = {};

    // Initialize counts for all consultants in selected team
    Object.values(CONSULTANT_MAPPING).forEach(c => {
      if (selectedTeam === 'Todos' || c.team === selectedTeam) {
        activeCounts[c.name] = { name: c.name, count: 0, team: c.team };
        successCounts[c.name] = { name: c.name, count: 0, team: c.team };
      }
    });

    let activeCountTotal = 0;
    let successCountTotal = 0;

    filteredData.forEach(call => {
      const { consultantName, type, status, duration, team, extension } = call;
      if (!consultantName) return;

      // Update active/success counts if consultant is in the selected set
      if (activeCounts[consultantName]) {
        if (type === 'Ativa') {
          activeCounts[consultantName].count++;
        }
      }
      if (successCounts[consultantName]) {
        if (status === 'Atendida') {
          successCounts[consultantName].count++;
        }
      }

      // Update global KPI counters
      if (type === 'Ativa') activeCountTotal++;
      if (status === 'Atendida') successCountTotal++;

      // Update Summary table data
      if (!summary[consultantName]) {
        summary[consultantName] = {
          name: consultantName,
          team: team as TeamName,
          extension: extension,
          total: 0,
          success: 0,
          totalDuration: 0
        };
      }
      const s = summary[consultantName];
      s.total++;
      if (status === 'Atendida') {
        s.success++;
        s.totalDuration += duration;
      }
    });

    const activeCallsByConsultant = Object.values(activeCounts).sort((a, b) => b.count - a.count);
    const successCallsByConsultant = Object.values(successCounts).sort((a, b) => b.count - a.count);
    const consultantSummary = Object.values(summary).map(s => ({
      ...s,
      tma: s.success > 0 ? Math.round(s.totalDuration / s.success) : 0
    })).sort((a, b) => b.total - a.total);

    const total = filteredData.length;
    const successRate = total > 0 ? (successCountTotal / total) * 100 : 0;

    return {
      activeCallsByConsultant,
      successCallsByConsultant,
      consultantSummary,
      kpis: {
        total,
        active: activeCountTotal,
        success: successCountTotal,
        successRate
      }
    };
  }, [filteredData, selectedTeam]);

  const { activeCallsByConsultant, successCallsByConsultant, consultantSummary, kpis } = dashboardStats;

  const teamComparison = useMemo(() => {
    const statsArr = {
      [TeamName.DEBORA]: { name: TeamName.DEBORA, total: 0, success: 0 },
      [TeamName.MARILIA]: { name: TeamName.MARILIA, total: 0, success: 0 }
    };
    dateFilteredData.forEach(d => {
      if (d.team && statsArr[d.team as keyof typeof statsArr]) {
        statsArr[d.team as keyof typeof statsArr].total++;
        if (d.status === 'Atendida') statsArr[d.team as keyof typeof statsArr].success++;
      }
    });
    return Object.values(statsArr);
  }, [dateFilteredData]);

  return (
    <div className="min-h-screen bg-offwhite flex text-graphite font-sans selection:bg-adarco-light selection:text-adarco-dark border-none">
      <input 
        type="file" 
        ref={fileInputRef} 
        accept=".csv" 
        className="hidden" 
        onChange={handleFileUpload} 
      />

      {/* Mobile Sidebar Overlay */}
      <AnimatePresence>
        {isSidebarOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsSidebarOpen(false)}
            className="fixed inset-0 bg-adarco-dark/60 backdrop-blur-sm z-30 md:hidden"
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <motion.aside 
        initial={false}
        animate={{ 
          width: isSidebarOpen ? 300 : 0, 
          x: isSidebarOpen ? 0 : -300,
          opacity: 1
        }}
        transition={{ type: "spring", damping: 25, stiffness: 200 }}
        className={cn(
          "bg-gradient-to-b from-[#00F58A]/40 via-[#004D2C]/90 to-[#003B22] text-white shadow-2xl z-40 sticky top-0 h-screen backdrop-blur-3xl border-r border-white/20 relative overflow-hidden",
          "fixed inset-y-0 left-0 md:sticky transition-width duration-300"
        )}
      >
        {/* Close button for mobile inside sidebar */}
        <button 
          onClick={() => setIsSidebarOpen(false)}
          className="absolute top-4 right-4 p-2 bg-white/10 rounded-lg md:hidden z-50"
        >
          <X className="w-5 h-5 text-white" />
        </button>

        {/* Laminated Effect Shine */}
        <div className="absolute top-0 left-0 right-0 h-[300px] bg-gradient-to-br from-white/10 to-transparent pointer-events-none" />
        
        <div className="relative p-8 w-[300px] h-full flex flex-col z-10">
          <div className="flex items-center gap-4 mb-12">
            <div className="w-12 h-12 bg-white/20 backdrop-blur-2xl rounded-2xl flex items-center justify-center border border-white/30 shadow-xl relative overflow-hidden group">
              <div className="absolute inset-0 bg-gradient-to-tr from-white/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              <PhoneCall className="w-7 h-7 text-white" />
            </div>
            <div 
              onClick={() => {
                setData([]);
                setErrorMsg(null);
                setSelectedTeam('Todos');
                setSelectedConsultant('Todos');
                setSelectedType('Todos');
                setSearchQuery('');
                setStartDate('');
                setEndDate('');
              }}
              className="cursor-pointer group select-none"
            >
              <h1 className="font-black text-xl tracking-tighter text-white drop-shadow-sm group-hover:text-adarco-primary transition-colors">ADARCO</h1>
              <p className="text-[10px] text-white/60 font-black uppercase tracking-widest leading-none mt-1">Inside Sales BI</p>
            </div>
          </div>

          <div className="flex-1 space-y-10">
            <div>
              <label className="text-[11px] font-black text-white/50 uppercase tracking-[0.2em] mb-4 block drop-shadow-sm">Navigation</label>
              <nav className="space-y-2">
                <button className="w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-white/10 text-white font-bold text-sm border border-white/20 shadow-inner backdrop-blur-md">
                  <TrendingUp className="w-4 h-4 text-white" />
                  Inside Sales
                </button>
              </nav>
            </div>

            <div className="space-y-6">
              <label className="text-[11px] font-black text-white/50 uppercase tracking-[0.2em] block drop-shadow-sm">Data Filters</label>
              
              <FilterSelect 
                label="Supervisão"
                value={selectedTeam}
                onChange={(val) => {
                  setSelectedTeam(val);
                  setSelectedConsultant('Todos');
                }}
                options={[
                  { label: 'Todos os Times', value: 'Todos' },
                  { label: 'Time Débora', value: TeamName.DEBORA },
                  { label: 'Time Marília', value: TeamName.MARILIA },
                ]}
              />

              <FilterSelect 
                label="Consultor"
                value={selectedConsultant}
                onChange={setSelectedConsultant}
                options={availableConsultants.map(c => ({ label: c, value: c }))}
                icon={Users}
              />

              <div className="space-y-3 pt-6 border-t border-white/20">
                <p className="text-xs font-bold text-white/80 pl-1 flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-white" /> Período Temporal
                </p>
                <div className="grid grid-cols-1 gap-2">
                  <input 
                    type="date"
                    className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-xs font-bold focus:ring-2 focus:ring-white/20 outline-none text-white color-scheme-dark shadow-inner"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                  />
                  <input 
                    type="date"
                    className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-xs font-bold focus:ring-2 focus:ring-white/20 outline-none text-white color-scheme-dark shadow-inner"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="pt-8 border-t border-white/10 mt-auto opacity-40 hover:opacity-100 transition-opacity">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center">
                <Users className="w-4 h-4 text-adarco-light" />
              </div>
              <div>
                <p className="text-[10px] font-black text-white/60 uppercase tracking-tighter">Powered by</p>
                <p className="text-xs font-black text-white tracking-tight">Inside Sales BI</p>
              </div>
            </div>
          </div>
        </div>
      </motion.aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto px-4 md:px-10 py-8">
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-12">
          <div>
            <h2 className="text-2xl md:text-3xl font-black tracking-tighter text-adarco-dark">Performance Inside Sales</h2>
            <div className="flex items-center gap-3 mt-2">
              <span className="flex items-center gap-1 text-xs font-bold text-slate-400 uppercase tracking-tight">
                <Calendar className="w-3.5 h-3.5" />
                {data.length > 0 ? "Dados Ativos" : "Aguardando Importação"}
              </span>
              {lastUpdated && (
                <>
                  <div className="w-1.5 h-1.5 bg-slate-200 rounded-full" />
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">
                    Atualizado às {lastUpdated.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </>
              )}
              <div className="w-1.5 h-1.5 bg-adarco-light rounded-full shadow-sm" />
              <span className="text-[10px] font-black text-white bg-adarco-primary px-3 py-1 rounded-lg uppercase tracking-widest shadow-sm">
                Foco em Resultados
              </span>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center gap-4 w-full md:w-auto">
             <div className="flex bg-white/60 backdrop-blur-md border border-white/50 shadow-soft rounded-2xl p-1.5 w-full sm:w-auto overflow-x-auto no-scrollbar">
                {['Todos', 'Ativa', 'Receptiva'].map((type) => (
                  <button
                    key={type}
                    onClick={() => setSelectedType(type)}
                    className={cn(
                      "flex-1 sm:flex-none px-4 md:px-5 py-2 text-[11px] font-black uppercase tracking-widest rounded-xl transition-all whitespace-nowrap",
                      selectedType === type 
                        ? "bg-adarco-dark text-white shadow-lg" 
                        : "text-slate-400 hover:text-slate-600 hover:bg-slate-50"
                    )}
                  >
                    {type}
                  </button>
                ))}
             </div>
             <div className="flex items-center gap-2 w-full sm:w-auto">
                <button 
                    onClick={syncWithAPI}
                    disabled={isSyncing}
                    title="Sincronizar com API"
                    className={cn(
                      "p-3 bg-adarco-dark text-white rounded-2xl hover:bg-black transition-all shadow-soft flex items-center justify-center min-w-[48px] h-[48px]",
                      isSyncing && "animate-spin"
                    )}
                >
                    <TrendingUp className="w-5 h-5" />
                </button>
                <button 
                    onClick={triggerFileUpload}
                    title="Carregar CSV"
                    className="p-3 bg-white border border-slate-200 rounded-2xl text-slate-600 hover:bg-slate-50 transition-all shadow-soft flex items-center justify-center min-w-[48px] h-[48px]"
                >
                    <Upload className="w-5 h-5" />
                </button>
                <div className="relative group flex-1 sm:flex-none">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4 transition-colors group-focus-within:text-adarco-primary" />
                    <input 
                      type="text" 
                      placeholder="Pesquisar consultor..."
                      className="bg-white/80 backdrop-blur-md border border-white/50 rounded-2xl pl-11 pr-5 py-3 text-sm font-bold focus:ring-4 focus:ring-adarco-primary/20 focus:border-adarco-primary outline-none w-full sm:w-[200px] md:w-[320px] shadow-neon transition-all placeholder:text-slate-400"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>
                <button 
                    onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                    className="p-3 bg-white border border-slate-200 rounded-2xl text-slate-600 hover:bg-slate-50 transition-all shadow-soft md:hidden flex items-center justify-center min-w-[48px] h-[48px]"
                >
                    {isSidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
                </button>
             </div>
          </div>
        </header>

        <AnimatePresence mode="wait">
          {data.length === 0 ? (
            <motion.div
              key="empty"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
            >
              <EmptyState onUpload={triggerFileUpload} onSync={syncWithAPI} isSyncing={isSyncing} />
              {errorMsg && (
                <p className="mt-4 text-center text-sm font-bold text-red-500 bg-red-50 py-2 rounded-lg max-w-sm mx-auto">
                  {errorMsg}
                </p>
              )}
            </motion.div>
          ) : (
            <motion.div 
              key="dashboard"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="space-y-8 pb-20"
            >
              {/* KPIs Row */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                <StatCard 
                  title="Total de Ligações" 
                  value={kpis.total} 
                  subtext="Volume bruto identificado"
                  icon={Phone}
                  colorClass="secondary"
                />
                <StatCard 
                  title="Ligações Ativas" 
                  value={kpis.active} 
                  subtext="Prospecção direta"
                  icon={PhoneOutgoing}
                  colorClass="secondary"
                />
                <StatCard 
                  title="Sucesso (Atendidas)" 
                  value={kpis.success} 
                  subtext="Contatos efetivos"
                  icon={CheckCircle2}
                  colorClass="primary"
                />
                <StatCard 
                  title="Efetividade de Contato" 
                  value={`${kpis.successRate.toFixed(1)}%`}
                  subtext="Taxa de sucesso global"
                  icon={TrendingUp}
                  trend={kpis.successRate > 70 ? 4 : -2}
                  colorClass="primary"
                />
              </div>

              {/* Central Charts Grid */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Gráfico A */}
                <div className="bg-white/70 backdrop-blur-lg p-8 rounded-3xl shadow-soft border border-white/40">
                  <div className="flex items-center justify-between mb-8">
                    <div>
                      <h3 className="font-bold text-slate-800 text-lg">Volume de Ligações Ativas</h3>
                      <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mt-1">Por Consultor</p>
                    </div>
                    <div className="p-3 bg-adarco-soft rounded-2xl">
                      <PhoneOutgoing className="w-5 h-5 text-adarco-dark" />
                    </div>
                  </div>
                  <div className="h-[300px] md:h-[400px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart 
                        data={activeCallsByConsultant} 
                        layout="vertical" 
                        margin={{ left: 60, right: 20 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#E2E8F0" />
                        <XAxis type="number" hide />
                        <YAxis 
                          dataKey="name" 
                          type="category" 
                          axisLine={false} 
                          tickLine={false} 
                          style={{ fontSize: '12px', fontWeight: 600, fill: '#475569' }}
                          width={100}
                        />
                        <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(20, 61, 45, 0.05)' }} />
                        <Bar 
                          dataKey="count" 
                          name="Ligações Ativas"
                          radius={[0, 8, 8, 0]} 
                          barSize={32}
                        >
                           {activeCallsByConsultant.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.team === TeamName.DEBORA ? '#064E3B' : '#10B981'} />
                           ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Gráfico B */}
                <div className="bg-white/70 backdrop-blur-lg p-8 rounded-3xl shadow-soft border border-white/40">
                  <div className="flex items-center justify-between mb-8">
                    <div>
                      <h3 className="font-bold text-slate-800 text-lg">Chamadas Atendidas (Sucesso)</h3>
                      <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mt-1">Contatos Efetivos</p>
                    </div>
                    <div className="p-3 bg-adarco-light/20 rounded-2xl">
                      <CheckCircle2 className="w-5 h-5 text-adarco-primary" />
                    </div>
                  </div>
                  <div className="h-[300px] md:h-[400px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart 
                        data={successCallsByConsultant} 
                        layout="vertical" 
                        margin={{ left: 60, right: 20 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#E2E8F0" />
                        <XAxis type="number" hide />
                        <YAxis 
                          dataKey="name" 
                          type="category" 
                          axisLine={false} 
                          tickLine={false} 
                          style={{ fontSize: '12px', fontWeight: 600, fill: '#475569' }}
                          width={100}
                        />
                        <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(16, 185, 129, 0.05)' }} />
                        <Bar 
                          dataKey="count" 
                          name="Contatos Efetivos"
                          radius={[0, 8, 8, 0]} 
                          barSize={32}
                        >
                           {successCallsByConsultant.map((entry, index) => {
                             // Lógica Visual: Verde para quem está acima da meta (ex: > 10 chamadas)
                             // ou uma cor mais neutra para quem está abaixo
                             const isHighPerformance = entry.count > 10; 
                             return (
                               <Cell 
                                 key={`cell-${index}`} 
                                 fill={isHighPerformance ? '#004D2C' : '#94A3B8'} 
                                 fillOpacity={isHighPerformance ? 1 : 0.6}
                               />
                             );
                           })}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>

              {/* Performance Comparativa */}
              <div className="bg-white/70 backdrop-blur-lg p-8 rounded-3xl shadow-soft border border-white/40">
                <div className="flex items-center justify-between mb-8">
                  <div>
                    <h3 className="font-bold text-slate-800 text-lg">Performance Comparativa de Times</h3>
                    <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mt-1">Débora vs Marília</p>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                  {teamComparison.map(team => {
                    const pieData = [
                      { name: 'Atendidas', value: team.success },
                      { name: 'Perdidas', value: Math.max(0, team.total - team.success) }
                    ];
                    const color = team.name === TeamName.DEBORA ? "#064E3B" : "#00F58A";
                    const efficiency = team.total > 0 ? ((team.success / team.total) * 100).toFixed(1) : 0;

                    return (
                      <div key={team.name} className="flex flex-col items-center">
                        <div className="h-[220px] w-full relative">
                          <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                              <Pie
                                data={pieData}
                                cx="50%"
                                cy="50%"
                                innerRadius={65}
                                outerRadius={85}
                                paddingAngle={5}
                                dataKey="value"
                                stroke="none"
                              >
                                <Cell fill={color} />
                                <Cell fill="#F1F5F9" />
                              </Pie>
                              <Tooltip />
                            </PieChart>
                          </ResponsiveContainer>
                          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                            <span className="text-2xl font-black text-slate-800 leading-none">{efficiency}%</span>
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Eficiência</span>
                          </div>
                        </div>
                        <div className="mt-2 text-center">
                          <h4 className="font-extrabold text-slate-700 uppercase tracking-tight">{team.name}</h4>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-xs font-bold text-slate-400">
                              {team.success} <span className="font-medium text-slate-300">atendidas de</span> {team.total}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Table */}
              <div className="bg-white/70 backdrop-blur-lg rounded-[2rem] shadow-soft border border-white/40 overflow-hidden">
                <div className="p-8 border-b border-slate-100/50 flex items-center justify-between bg-white/40">
                  <div>
                    <h3 className="font-bold text-slate-800">Resumo de Performance</h3>
                    <p className="text-xs text-slate-400 font-medium">Métricas consolidadas por consultor no período</p>
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="bg-white border-b border-slate-100">
                        <th className="px-8 py-5 text-[11px] font-bold text-slate-400 uppercase tracking-widest">Consultor</th>
                        <th className="px-8 py-5 text-[11px] font-bold text-slate-400 uppercase tracking-widest text-center">Ligações</th>
                        <th className="px-8 py-5 text-[11px] font-bold text-slate-400 uppercase tracking-widest text-center">Sucesso</th>
                        <th className="px-8 py-5 text-[11px] font-bold text-slate-400 uppercase tracking-widest text-center">Efet. %</th>
                        <th className="px-8 py-5 text-[11px] font-bold text-slate-400 uppercase tracking-widest text-right">TMA</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {consultantSummary.map((item, idx) => (
                        <tr key={idx} className="hover:bg-slate-50/50 transition-colors group">
                          <td className="px-8 py-5">
                            <div className="flex items-center gap-3">
                              <div className={cn(
                                "w-9 h-9 rounded-full flex items-center justify-center text-[10px] font-bold shadow-sm transition-transform group-hover:scale-110",
                                item.team === TeamName.DEBORA ? "bg-adarco-dark text-white" : "bg-adarco-light text-adarco-dark"
                              )}>
                                {item.name[0]}
                              </div>
                              <div>
                                <p className="text-sm font-bold text-slate-700">{item.name}</p>
                                <p className="text-[10px] font-bold text-slate-400 uppercase">{item.team}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-8 py-5 text-center font-mono text-sm font-bold text-slate-600">{item.total}</td>
                          <td className="px-8 py-5 text-center">
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 text-xs font-bold font-mono">
                              {item.success}
                            </span>
                          </td>
                          <td className="px-8 py-5 text-center">
                            <div className="flex flex-col items-center gap-1">
                              <span className="text-xs font-bold text-slate-600">
                                {item.total > 0 ? ((item.success / item.total) * 100).toFixed(0) : 0}%
                              </span>
                              <div className="w-12 h-1 bg-slate-100 rounded-full overflow-hidden">
                                <div 
                                  className="h-full bg-adarco-primary rounded-full" 
                                  style={{ width: `${item.total > 0 ? (item.success / item.total) * 100 : 0}%` }}
                                />
                              </div>
                            </div>
                          </td>
                          <td className="px-8 py-5 text-right font-mono text-sm font-extrabold text-adarco-dark">
                            {formatDuration(item.tma)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
