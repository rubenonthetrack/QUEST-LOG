import { useState, useEffect, FormEvent, useRef, ChangeEvent } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { GoogleGenAI, Type } from "@google/genai";
import { 
  Plus, 
  Trash2, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  StickyNote, 
  Target,
  AlertCircle,
  Sparkles,
  Trophy,
  ChevronDown,
  ChevronUp,
  Check,
  Moon,
  Sun,
  Download,
  Upload,
  Palette,
  Edit3,
  Save
} from 'lucide-react';

const ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_GEMINI_API_KEY || '' });

interface Subtask {
  id: number;
  title: string;
  completed: number;
  color: string;
}

interface Note {
  id: number;
  content: string;
  created_at: string;
}

interface Goal {
  id: number;
  title: string;
  description: string;
  status: 'pending' | 'completed' | 'failed';
  color: string;
  created_at: string;
  subtasks: Subtask[];
}

interface UserStats {
  xp: number;
  level: number;
}

type Tab = 'notes' | 'goals';

const PRESET_COLORS = [
  '#10b981', // Emerald
  '#3b82f6', // Blue
  '#f59e0b', // Amber
  '#ef4444', // Red
  '#8b5cf6', // Violet
  '#ec4899', // Pink
  '#06b6d4', // Cyan
];

export default function App() {
  const [activeTab, setActiveTab] = useState<Tab>('notes');
  const [notes, setNotes] = useState<Note[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [stats, setStats] = useState<UserStats>({ xp: 0, level: 1 });
  const [newNote, setNewNote] = useState('');
  const [newGoalTitle, setNewGoalTitle] = useState('');
  const [newGoalDesc, setNewGoalDesc] = useState('');
  const [newGoalColor, setNewGoalColor] = useState(PRESET_COLORS[0]);
  const [isLoading, setIsLoading] = useState(true);
  const [isBreakingDown, setIsBreakingDown] = useState<number | null>(null);
  const [expandedGoal, setExpandedGoal] = useState<number | null>(null);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [editingGoal, setEditingGoal] = useState<number | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [newSubtaskTitle, setNewSubtaskTitle] = useState<{ [key: number]: string }>({});
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchData();
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'dark') setIsDarkMode(true);
  }, []);

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [isDarkMode]);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [notesRes, goalsRes, statsRes] = await Promise.all([
        fetch('/api/notes'),
        fetch('/api/goals'),
        fetch('/api/stats')
      ]);

      if (!notesRes.ok || !goalsRes.ok || !statsRes.ok) {
        throw new Error('Failed to fetch data from server');
      }

      const notesData = await notesRes.json();
      const goalsData = await goalsRes.json();
      const statsData = await statsRes.json();
      setNotes(notesData);
      setGoals(goalsData);
      setStats(statsData);
    } catch (error) {
      console.error('Failed to fetch data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const addXp = async (amount: number) => {
    try {
      const res = await fetch('/api/stats/add-xp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount })
      });
      const newStats = await res.json();
      setStats(newStats);
    } catch (error) {
      console.error('Failed to add XP:', error);
    }
  };

  const addNote = async (e: FormEvent) => {
    e.preventDefault();
    if (!newNote.trim()) return;

    try {
      const res = await fetch('/api/notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: newNote })
      });
      if (res.ok) {
        setNewNote('');
        addXp(5);
        fetchData();
      }
    } catch (error) {
      console.error('Failed to add note:', error);
    }
  };

  const deleteNote = async (id: number) => {
    try {
      await fetch(`/api/notes/${id}`, { method: 'DELETE' });
      fetchData();
    } catch (error) {
      console.error('Failed to delete note:', error);
    }
  };

  const addGoal = async (e: FormEvent) => {
    e.preventDefault();
    if (!newGoalTitle.trim()) return;

    try {
      const res = await fetch('/api/goals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          title: newGoalTitle, 
          description: newGoalDesc,
          color: newGoalColor
        })
      });
      if (res.ok) {
        setNewGoalTitle('');
        setNewGoalDesc('');
        addXp(10);
        fetchData();
      }
    } catch (error) {
      console.error('Failed to add goal:', error);
    }
  };

  const updateGoal = async (id: number, updates: Partial<Goal>) => {
    try {
      const res = await fetch(`/api/goals/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
      });
      if (res.ok) {
        if (updates.status === 'completed') addXp(50);
        fetchData();
        setEditingGoal(null);
      }
    } catch (error) {
      console.error('Failed to update goal:', error);
    }
  };

  const deleteGoal = async (id: number) => {
    try {
      await fetch(`/api/goals/${id}`, { method: 'DELETE' });
      fetchData();
    } catch (error) {
      console.error('Failed to delete goal:', error);
    }
  };

  const toggleSubtask = async (subtask: Subtask) => {
    try {
      await fetch(`/api/subtasks/${subtask.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ completed: !subtask.completed })
      });
      if (!subtask.completed) addXp(10);
      fetchData();
    } catch (error) {
      console.error('Failed to toggle subtask:', error);
    }
  };

  const deleteSubtask = async (id: number) => {
    try {
      await fetch(`/api/subtasks/${id}`, { method: 'DELETE' });
      fetchData();
    } catch (error) {
      console.error('Failed to delete subtask:', error);
    }
  };

  const breakdownGoal = async (goal: Goal) => {
    if (isBreakingDown) return;
    setIsBreakingDown(goal.id);
    setExpandedGoal(goal.id);

    try {
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `Break down the following goal into 3-5 actionable sub-tasks. Return only a JSON array of strings. Goal: "${goal.title}" Description: "${goal.description}"`,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.ARRAY,
            items: { type: Type.STRING }
          }
        }
      });

      const subtasks: string[] = JSON.parse(response.text || "[]");
      
      for (const title of subtasks) {
        await fetch(`/api/goals/${goal.id}/subtasks`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title, color: goal.color })
        });
      }
      
      addXp(20);
      fetchData();
    } catch (error) {
      console.error('AI Breakdown failed:', error);
    } finally {
      setIsBreakingDown(null);
    }
  };

  const addManualSubtask = async (goalId: number) => {
    const title = newSubtaskTitle[goalId];
    if (!title?.trim()) return;

    try {
      const goal = goals.find(g => g.id === goalId);
      await fetch(`/api/goals/${goalId}/subtasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, color: goal?.color || PRESET_COLORS[0] })
      });
      setNewSubtaskTitle(prev => ({ ...prev, [goalId]: '' }));
      addXp(5);
      fetchData();
    } catch (error) {
      console.error('Failed to add subtask:', error);
    }
  };

  const exportData = async () => {
    try {
      const res = await fetch('/api/export');
      const data = await res.json();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `questlog-backup-${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Export failed:', error);
    }
  };

  const importData = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const data = JSON.parse(event.target?.result as string);
        const res = await fetch('/api/import', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data)
        });
        if (res.ok) {
          fetchData();
          alert('Data imported successfully!');
        }
      } catch (error) {
        console.error('Import failed:', error);
        alert('Invalid backup file.');
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className={`min-h-screen transition-colors duration-300 ${isDarkMode ? 'bg-[#0F0F0F] text-[#E0E0E0]' : 'bg-[#F5F5F0] text-[#1A1A1A]'} font-sans selection:bg-stone-200`}>
      {/* Stats Bar */}
      <div className={`border-b sticky top-0 z-50 transition-colors duration-300 ${isDarkMode ? 'bg-[#1A1A1A] border-stone-800' : 'bg-white border-stone-200'}`}>
        <div className="max-w-4xl mx-auto px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="bg-stone-600 text-white w-10 h-10 rounded-xl flex items-center justify-center font-bold shadow-lg shadow-stone-600/20">
              Lvl {stats.level}
            </div>
            <div className="flex-1 min-w-[200px]">
              <div className="flex justify-between text-[10px] font-bold uppercase tracking-widest text-stone-400 mb-1">
                <span>Experience</span>
                <span>{stats.xp} / 100 XP</span>
              </div>
              <div className={`h-2 rounded-full overflow-hidden ${isDarkMode ? 'bg-stone-800' : 'bg-stone-100'}`}>
                <motion.div 
                  initial={{ width: 0 }}
                  animate={{ width: `${stats.xp}%` }}
                  className="h-full bg-stone-500"
                />
              </div>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setIsDarkMode(!isDarkMode)}
              className={`p-2 rounded-xl transition-colors ${isDarkMode ? 'bg-stone-800 text-amber-400' : 'bg-stone-100 text-stone-600'}`}
            >
              {isDarkMode ? <Sun size={20} /> : <Moon size={20} />}
            </button>
            <div className="flex items-center gap-2 text-stone-400">
              <Trophy size={18} className={stats.level > 1 ? 'text-amber-500' : ''} />
              <span className="text-sm font-medium hidden sm:inline"></span>
            </div>
          </div>
        </div>
      </div>

      {/* Header */}
      <header className="max-w-4xl mx-auto pt-12 px-6 pb-8">
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col sm:flex-row items-center justify-between gap-6"
        >
          <div>
            <h1 className="text-4xl font-serif italic font-medium tracking-tight">QuestLog</h1>
            <p className="text-sm text-stone-500 mt-1 uppercase tracking-widest font-semibold">Adventure Journal</p>
          </div>
          
          <div className="flex items-center gap-4">
            <div className={`flex p-1 rounded-full border transition-colors ${isDarkMode ? 'bg-stone-800 border-stone-700' : 'bg-stone-200/50 border-stone-200'}`}>
              <button 
                onClick={() => setActiveTab('notes')}
                className={`px-6 py-2 rounded-full text-sm font-medium transition-all ${activeTab === 'notes' ? (isDarkMode ? 'bg-stone-700 text-stone-400' : 'bg-white shadow-sm text-stone-700') : 'text-stone-500 hover:text-stone-300'}`}
              >
                Notes
              </button>
              <button 
                onClick={() => setActiveTab('goals')}
                className={`px-6 py-2 rounded-full text-sm font-medium transition-all ${activeTab === 'goals' ? (isDarkMode ? 'bg-stone-700 text-stone-400' : 'bg-white shadow-sm text-stone-700') : 'text-stone-500 hover:text-stone-300'}`}
              >
                Quests
              </button>
            </div>
            
            <div className="flex gap-2">
              <button 
                onClick={exportData}
                className={`p-2 rounded-xl transition-colors ${isDarkMode ? 'bg-stone-800 text-stone-400 hover:text-white' : 'bg-white text-stone-600 hover:text-stone-900 border border-stone-200 shadow-sm'}`}
                title="Export Backup"
              >
                <Download size={20} />
              </button>
              <button 
                onClick={() => fileInputRef.current?.click()}
                className={`p-2 rounded-xl transition-colors ${isDarkMode ? 'bg-stone-800 text-stone-400 hover:text-white' : 'bg-white text-stone-600 hover:text-stone-900 border border-stone-200 shadow-sm'}`}
                title="Import Backup"
              >
                <Upload size={20} />
              </button>
              <input 
                type="file" 
                ref={fileInputRef} 
                onChange={importData} 
                accept=".json" 
                className="hidden" 
              />
            </div>
          </div>
        </motion.div>
      </header>

      <main className="max-w-4xl mx-auto px-6 pb-24">
        <AnimatePresence mode="wait">
          {activeTab === 'notes' ? (
            <motion.div
              key="notes-tab"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="space-y-8"
            >
              <form onSubmit={addNote} className={`rounded-3xl p-6 shadow-sm border transition-colors ${isDarkMode ? 'bg-[#1A1A1A] border-stone-800' : 'bg-white border-stone-200'}`}>
                <div className="flex gap-4">
                  <div className="flex-1">
                    <textarea
                      value={newNote}
                      onChange={(e) => setNewNote(e.target.value)}
                      placeholder="Record your findings..."
                      className={`w-full bg-transparent border-none focus:ring-0 text-lg placeholder:text-stone-500 resize-none min-h-[100px] ${isDarkMode ? 'text-white' : 'text-stone-800'}`}
                    />
                  </div>
                  <button 
                    type="submit"
                    className="self-end bg-stone-600 hover:bg-stone-700 text-white p-3 rounded-2xl transition-colors shadow-lg shadow-stone-600/20"
                  >
                    <Plus size={24} />
                  </button>
                </div>
              </form>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {isLoading ? (
                  Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className={`h-40 animate-pulse rounded-3xl ${isDarkMode ? 'bg-stone-800' : 'bg-stone-200'}`} />
                  ))
                ) : notes.length > 0 ? (
                  notes.map((note) => (
                    <motion.div
                      layout
                      key={note.id}
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className={`group p-6 rounded-3xl border transition-all hover:shadow-md relative ${isDarkMode ? 'bg-[#1A1A1A] border-stone-800 hover:border-stone-700' : 'bg-white border-stone-200 hover:border-stone-300'}`}
                    >
                      <button 
                        onClick={() => deleteNote(note.id)}
                        className="absolute top-4 right-4 text-stone-500 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"
                      >
                        <Trash2 size={18} />
                      </button>
                      <div className="flex items-start gap-3 mb-4">
                        <StickyNote size={18} className="text-stone-600 mt-1 shrink-0" />
                        <p className={`leading-relaxed whitespace-pre-wrap ${isDarkMode ? 'text-stone-300' : 'text-stone-800'}`}>{note.content}</p>
                      </div>
                      <div className="flex items-center gap-2 text-[10px] text-stone-500 uppercase tracking-widest font-bold">
                        <Clock size={12} />
                        {new Date(note.created_at).toLocaleDateString()}
                      </div>
                    </motion.div>
                  ))
                ) : (
                  <div className="col-span-full py-20 text-center">
                    <AlertCircle size={48} className="mx-auto text-stone-300 mb-4" />
                    <p className="text-stone-500 font-medium">The journal is empty. Write your first entry!</p>
                  </div>
                )}
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="goals-tab"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-8"
            >
              <form onSubmit={addGoal} className={`rounded-3xl p-8 shadow-sm border transition-colors ${isDarkMode ? 'bg-[#1A1A1A] border-stone-800' : 'bg-white border-stone-200'}`}>
                <div className="space-y-4">
                  <input
                    type="text"
                    value={newGoalTitle}
                    onChange={(e) => setNewGoalTitle(e.target.value)}
                    placeholder="Main Quest"
                    className={`w-full bg-transparent border-none focus:ring-0 text-2xl font-serif italic placeholder:text-stone-500 ${isDarkMode ? 'text-white' : 'text-stone-800'}`}
                  />
                  <textarea
                    value={newGoalDesc}
                    onChange={(e) => setNewGoalDesc(e.target.value)}
                    placeholder="Quest details..."
                    className={`w-full bg-transparent border-none focus:ring-0 placeholder:text-stone-500 resize-none min-h-[60px] ${isDarkMode ? 'text-stone-400' : 'text-stone-600'}`}
                  />
                  
                  <div className="flex flex-wrap items-center justify-between gap-4 pt-2">
                    <div className="flex items-center gap-2">
                      <Palette size={16} className="text-stone-500" />
                      <div className="flex gap-1.5">
                        {PRESET_COLORS.map(color => (
                          <button
                            key={color}
                            type="button"
                            onClick={() => setNewGoalColor(color)}
                            className={`w-6 h-6 rounded-full border-2 transition-transform ${newGoalColor === color ? 'scale-125 border-white shadow-sm' : 'border-transparent scale-100'}`}
                            style={{ backgroundColor: color }}
                          />
                        ))}
                      </div>
                    </div>
                    
                    <button 
                      type="submit"
                      className="bg-stone-600 hover:bg-stone-700 text-white px-8 py-3 rounded-2xl transition-all shadow-lg shadow-stone-600/20 font-medium flex items-center gap-2"
                    >
                      <Plus size={20} />
                      Accept Quest
                    </button>
                  </div>
                </div>
              </form>

              <div className="space-y-4">
                {isLoading ? (
                  Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className={`h-32 animate-pulse rounded-3xl ${isDarkMode ? 'bg-stone-800' : 'bg-stone-200'}`} />
                  ))
                ) : goals.length > 0 ? (
                  goals.map((goal) => (
                    <motion.div
                      layout
                      key={goal.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className={`group rounded-3xl border transition-all overflow-hidden ${
                        goal.status === 'completed' ? (isDarkMode ? 'border-stone-800 bg-stone-800/10' : 'border-stone-200 bg-stone-100/30') : 
                        goal.status === 'failed' ? (isDarkMode ? 'border-red-900 bg-red-900/10' : 'border-red-100 bg-red-50/30') : 
                        (isDarkMode ? 'bg-[#1A1A1A] border-stone-800 hover:border-stone-700' : 'bg-white border-stone-200 hover:border-stone-300')
                      }`}
                    >
                      <div className="p-6">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex gap-4 flex-1">
                            <div 
                              onClick={() => updateGoal(goal.id, { status: goal.status === 'completed' ? 'pending' : 'completed' })}
                              className={`mt-1 p-2 rounded-xl shrink-0 cursor-pointer transition-all border-2 ${
                                goal.status === 'completed' ? 'bg-stone-500 border-stone-500 text-white' : 
                                goal.status === 'failed' ? 'bg-red-500 border-red-500 text-white' : 
                                (isDarkMode ? 'bg-stone-800 border-stone-700 text-stone-500 hover:bg-stone-700 hover:border-stone-600' : 'bg-stone-100 border-stone-200 text-stone-400 hover:bg-stone-200 hover:border-stone-300')
                              }`}
                              style={goal.status === 'pending' ? { color: goal.color, borderColor: goal.color + '40' } : {}}
                              title={goal.status === 'completed' ? "Mark as Pending" : "Mark as Completed"}
                            >
                              {goal.status === 'completed' ? <Check size={20} /> : <Target size={20} />}
                            </div>
                            
                            <div className="flex-1">
                              {editingGoal === goal.id ? (
                                <div className="space-y-2">
                                  <input 
                                    value={editTitle}
                                    onChange={(e) => setEditTitle(e.target.value)}
                                    className={`w-full bg-transparent border-b border-stone-500 focus:ring-0 text-xl font-medium ${isDarkMode ? 'text-white' : 'text-stone-800'}`}
                                  />
                                  <textarea 
                                    value={editDesc}
                                    onChange={(e) => setEditDesc(e.target.value)}
                                    className={`w-full bg-transparent border-none focus:ring-0 text-sm ${isDarkMode ? 'text-stone-400' : 'text-stone-500'}`}
                                  />
                                  <div className="flex gap-2">
                                    <button 
                                      onClick={() => updateGoal(goal.id, { title: editTitle, description: editDesc })}
                                      className="text-xs bg-stone-600 text-white px-3 py-1 rounded-lg"
                                    >
                                      Save
                                    </button>
                                    <button 
                                      onClick={() => setEditingGoal(null)}
                                      className="text-xs bg-stone-500 text-white px-3 py-1 rounded-lg"
                                    >
                                      Cancel
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <>
                                  <h3 className={`text-xl font-medium transition-all ${goal.status !== 'pending' ? 'line-through opacity-50' : (isDarkMode ? 'text-white' : 'text-stone-800')}`}>
                                    {goal.title}
                                  </h3>
                                  {goal.description && (
                                    <p className={`mt-1 text-sm leading-relaxed ${isDarkMode ? 'text-stone-500' : 'text-stone-500'}`}>{goal.description}</p>
                                  )}
                                </>
                              )}
                              
                              <div className="flex flex-wrap items-center gap-4 mt-4">
                                <span 
                                  className={`text-[10px] font-bold uppercase tracking-widest px-2 py-1 rounded-md text-white`}
                                  style={{ backgroundColor: goal.color }}
                                >
                                  {goal.status}
                                </span>
                                
                                {goal.subtasks.length === 0 && goal.status === 'pending' && (
                                  <div className="hidden"></div>
                                )}
                                
                                <div className="flex gap-1">
                                  {PRESET_COLORS.map(c => (
                                    <button
                                      key={c}
                                      onClick={() => updateGoal(goal.id, { color: c })}
                                      className={`w-3 h-3 rounded-full border border-white/20 transition-transform hover:scale-125 ${goal.color === c ? 'scale-125 ring-1 ring-stone-500' : ''}`}
                                      style={{ backgroundColor: c }}
                                    />
                                  ))}
                                </div>

                                <div className="flex items-center gap-4">
                                  {goal.subtasks.length > 0 && (
                                    <button 
                                      onClick={() => setExpandedGoal(expandedGoal === goal.id ? null : goal.id)}
                                      className="text-[10px] font-bold uppercase tracking-widest flex items-center gap-1 text-stone-500 hover:text-stone-400 transition-colors"
                                    >
                                      {expandedGoal === goal.id ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                                      {goal.subtasks.filter(s => s.completed).length}/{goal.subtasks.length} Steps
                                    </button>
                                  )}
                                  
                                  <button 
                                    onClick={() => setExpandedGoal(expandedGoal === goal.id ? null : goal.id)}
                                    className="text-[10px] font-bold uppercase tracking-widest flex items-center gap-1 text-stone-500 hover:text-stone-400 transition-colors"
                                  >
                                    <Plus size={12} />
                                    Add Mission
                                  </button>
                                </div>
                              </div>
                            </div>
                          </div>

                          <div className="flex flex-col gap-2">
                            {goal.status === 'pending' && (
                              <button 
                                onClick={() => {
                                  setEditingGoal(goal.id);
                                  setEditTitle(goal.title);
                                  setEditDesc(goal.description);
                                }}
                                className={`p-2 rounded-xl transition-all ${isDarkMode ? 'text-stone-500 hover:text-white hover:bg-stone-800' : 'text-stone-400 hover:text-stone-900 hover:bg-stone-100'}`}
                              >
                                <Edit3 size={20} />
                              </button>
                            )}
                            <button 
                              onClick={() => updateGoal(goal.id, { status: goal.status === 'failed' ? 'pending' : 'failed' })}
                              className={`p-2 rounded-xl transition-all ${goal.status === 'failed' ? 'text-red-500 bg-red-500/10' : (isDarkMode ? 'text-stone-500 hover:text-red-400 hover:bg-stone-800' : 'text-stone-400 hover:text-red-600 hover:bg-red-50')}`}
                            >
                              <XCircle size={20} />
                            </button>
                            <button 
                              onClick={() => deleteGoal(goal.id)}
                              className={`p-2 rounded-xl transition-all ${isDarkMode ? 'text-stone-500 hover:text-red-400 hover:bg-stone-800' : 'text-stone-300 hover:text-red-500 hover:bg-red-50'}`}
                            >
                              <Trash2 size={20} />
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* Subtasks Section */}
                      <AnimatePresence>
                        {expandedGoal === goal.id && (
                          <motion.div 
                            initial={{ height: 0 }}
                            animate={{ height: 'auto' }}
                            exit={{ height: 0 }}
                            className={`border-t transition-colors ${isDarkMode ? 'bg-stone-900/50 border-stone-800' : 'bg-stone-50/50 border-stone-100'}`}
                          >
                            <div className="p-6 space-y-4">
                              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                <div className="flex items-center gap-2">
                                  <h4 className="text-[10px] font-bold uppercase tracking-widest text-stone-500">Sub-Quests</h4>
                                  {goal.status === 'pending' && (
                                    <button 
                                      onClick={() => breakdownGoal(goal)}
                                      disabled={isBreakingDown === goal.id}
                                      className="text-[9px] font-bold uppercase tracking-widest flex items-center gap-1 px-2 py-0.5 rounded-full bg-stone-200 dark:bg-stone-800 text-stone-600 dark:text-stone-400 hover:bg-stone-300 dark:hover:bg-stone-700 transition-colors"
                                    >
                                      <Sparkles size={10} className={isBreakingDown === goal.id ? 'animate-spin' : ''} />
                                      AI Auto-Fill
                                    </button>
                                  )}
                                </div>
                                
                                {goal.status === 'pending' && (
                                  <div className="flex-1 max-w-md flex gap-2">
                                    <input 
                                      type="text"
                                      value={newSubtaskTitle[goal.id] || ''}
                                      onChange={(e) => setNewSubtaskTitle(prev => ({ ...prev, [goal.id]: e.target.value }))}
                                      placeholder="New mission title..."
                                      onKeyDown={(e) => e.key === 'Enter' && addManualSubtask(goal.id)}
                                      className={`flex-1 bg-transparent border-b border-stone-300 dark:border-stone-700 focus:border-stone-500 focus:ring-0 text-sm py-1 ${isDarkMode ? 'text-stone-300' : 'text-stone-700'}`}
                                    />
                                    <button 
                                      onClick={() => addManualSubtask(goal.id)}
                                      className="bg-stone-600 text-white p-1.5 rounded-lg hover:bg-stone-700 transition-colors"
                                    >
                                      <Plus size={16} />
                                    </button>
                                  </div>
                                )}
                              </div>

                              <div className="space-y-2">
                                {goal.subtasks.map((subtask) => (
                                  <div 
                                    key={subtask.id}
                                    className="flex items-center justify-between group/task-row"
                                  >
                                    <div 
                                      onClick={() => toggleSubtask(subtask)}
                                      className="flex items-center gap-3 cursor-pointer flex-1"
                                    >
                                      <div className={`w-5 h-5 rounded-md border flex items-center justify-center transition-all ${
                                        subtask.completed ? 'bg-stone-500 border-stone-500 text-white' : (isDarkMode ? 'border-stone-700 hover:border-stone-600' : 'border-stone-300 hover:border-stone-400')
                                      }`}>
                                        {subtask.completed ? <Check size={12} /> : null}
                                      </div>
                                      <span className={`text-sm transition-all ${subtask.completed ? 'text-stone-500 line-through' : (isDarkMode ? 'text-stone-300' : 'text-stone-700')}`}>
                                        {subtask.title}
                                      </span>
                                    </div>
                                    <button 
                                      onClick={() => deleteSubtask(subtask.id)}
                                      className="text-stone-400 hover:text-red-500 opacity-0 group-hover/task-row:opacity-100 transition-all p-1"
                                    >
                                      <Trash2 size={14} />
                                    </button>
                                  </div>
                                ))}
                                {goal.subtasks.length === 0 && !newSubtaskTitle[goal.id] && (
                                  <p className="text-[10px] text-stone-500 italic">No missions yet. Add your first mission above.</p>
                                )}
                              </div>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </motion.div>
                  ))
                ) : (
                  <div className="py-20 text-center">
                    <Target size={48} className="mx-auto text-stone-300 mb-4" />
                    <p className="text-stone-500 font-medium">No quests active. Adventure awaits!</p>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      <footer className="max-w-4xl mx-auto px-6 py-12 text-center">
        <p className="text-[10px] text-stone-500 uppercase tracking-[0.2em] font-medium opacity-50">
          © {new Date().getFullYear()} Ruben-Élie TOUITOU — All Rights Reserved
        </p>
      </footer>

      <footer className="fixed bottom-0 left-0 w-full h-1 bg-gradient-to-r from-stone-500 via-stone-400 to-stone-500 opacity-30" />
    </div>
  );
}
