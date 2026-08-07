import React, { useState, useEffect } from 'react';
import { Play, Plus, Trash2, Edit2, BookOpen, HelpCircle, History, Video, Award, Shield, User, FileText, RefreshCw, Sliders, Settings, Users, Activity, LogOut } from 'lucide-react';

interface Question {
  id: string;
  text: string;
  options: string[];
  correctOption: number;
  explanation: string;
}

interface Playlist {
  id: string;
  day: number;
  title: string;
  videoUrl: string;
  storyText: string;
  situationTitle: string;
  situationText: string;
  situationQuestion: string;
  questionIds: string[];
}

interface HistoryLog {
  id: string;
  pin: string;
  playlistId: string;
  playlistTitle: string;
  date: string;
  participantsCount: number;
  leaderboard: {
    name: string;
    class: string;
    score: number;
    correctCount?: number;
    answersCount?: number;
  }[];
}

interface AdminDashboardProps {
  onLaunchSession: (pin: string) => void;
  backendUrl: string;
  userRole?: 'presenter' | 'student' | null;
  token?: string;
  onLogout?: () => void;
  userName?: string;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  onLaunchSession,
  backendUrl,
  userRole = 'admin',
  token,
  onLogout,
  userName = 'GIẢNG VIÊN'
}) => {
  const [activeTab, setActiveTab] = useState<'playlists' | 'questions' | 'history' | 'users'>('playlists');

  // Data States
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [history, setHistory] = useState<HistoryLog[]>([]);
  const [users, setUsers] = useState<{ username: string; email?: string; role: string; googleId?: string }[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [expandedHistoryId, setExpandedHistoryId] = useState<string | null>(null);

  // Pagination State for Questions
  const [questionsCurrentPage, setQuestionsCurrentPage] = useState(1);

  // Selected playlist for active view
  const [selectedPlaylistId, setSelectedPlaylistId] = useState<string | null>(null);

  // Form States (Quick create/edit)
  const [isPlaylistFormOpen, setIsPlaylistFormOpen] = useState(false);
  const [editingPlaylistId, setEditingPlaylistId] = useState<string | null>(null);
  const [videoSourceType, setVideoSourceType] = useState<'youtube' | 'upload'>('youtube');
  const [isUploading, setIsUploading] = useState(false);
  const [playlistForm, setPlaylistForm] = useState<Partial<Playlist>>({
    day: 1,
    title: '',
    videoUrl: 'https://www.youtube.com/embed/dQw4w9WgXcQ',
    storyText: '',
    situationTitle: '',
    situationText: '',
    situationQuestion: '',
    questionIds: []
  });

  const [isQuestionFormOpen, setIsQuestionFormOpen] = useState(false);
  const [questionForm, setQuestionForm] = useState<Partial<Question>>({
    text: '',
    options: ['', '', '', ''],
    correctOption: 0,
    explanation: ''
  });

  // System Time State (HHMM.SS)
  const [sysTime, setSysTime] = useState('0743.00');

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const hh = now.getHours().toString().padStart(2, '0');
      const mm = now.getMinutes().toString().padStart(2, '0');
      const ss = now.getSeconds().toString().padStart(2, '0');
      setSysTime(`${hh}${mm}.${ss}`);
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const plRes = await fetch(`${backendUrl}/api/playlists`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const plData = await plRes.json();
      setPlaylists(plData);
      if (plData.length > 0 && !selectedPlaylistId) {
        setSelectedPlaylistId(plData[0].id);
      }

      const qRes = await fetch(`${backendUrl}/api/questions`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const qData = await qRes.json();
      setQuestions(qData);

      const histRes = await fetch(`${backendUrl}/api/histories`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const histData = await histRes.json();
      setHistory(histData);

      // Fetch users list
      const usersRes = await fetch(`${backendUrl}/api/users`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (usersRes.ok) {
        const usersData = await usersRes.json();
        setUsers(usersData);
      }
    } catch (error) {
      console.error('Error fetching admin dashboard data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdateUserRole = async (targetUsername: string, newRole: string) => {
    try {
      const res = await fetch(`${backendUrl}/api/users/${targetUsername}/role`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ role: newRole })
      });
      const data = await res.json();
      if (res.ok) {
        alert(data.message);
        fetchData();
      } else {
        alert(data.message || 'Lỗi khi cập nhật vai trò.');
      }
    } catch (error) {
      console.error('Error updating user role:', error);
      alert('Không thể kết nối đến máy chủ.');
    }
  };

  useEffect(() => {
    fetchData();
  }, [backendUrl]);

  const handleLaunch = async (playlistId: string) => {
    try {
      const res = await fetch(`${backendUrl}/api/sessions/launch`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ playlistId })
      });
      const data = await res.json();
      if (res.ok && data.session?.pin) {
        onLaunchSession(data.session.pin);
      } else {
        alert(data.message || 'Lỗi khởi chạy phòng.');
      }
    } catch (error) {
      console.error('Error launching session:', error);
      alert('Không thể kết nối đến máy chủ.');
    }
  };

  const handleVideoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    const formData = new FormData();
    formData.append('video', file);

    try {
      const res = await fetch(`${backendUrl}/api/upload`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });
      if (res.ok) {
        const data = await res.json();
        setPlaylistForm((prev) => ({ ...prev, videoUrl: data.url }));
      } else {
        alert('Tải lên video thất bại.');
      }
    } catch (error) {
      console.error('Error uploading video:', error);
      alert('Không thể kết nối máy chủ để tải video.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleClosePlaylistForm = () => {
    setIsPlaylistFormOpen(false);
    setEditingPlaylistId(null);
    setPlaylistForm({
      day: playlists.length + 1,
      title: '',
      videoUrl: 'https://www.youtube.com/embed/dQw4w9WgXcQ',
      storyText: '',
      situationTitle: '',
      situationText: '',
      situationQuestion: '',
      questionIds: []
    });
  };

  const handleEditPlaylist = (pl: Playlist) => {
    setEditingPlaylistId(pl.id);
    setPlaylistForm({
      day: pl.day,
      title: pl.title,
      videoUrl: pl.videoUrl,
      storyText: pl.storyText,
      situationTitle: pl.situationTitle,
      situationText: pl.situationText,
      situationQuestion: pl.situationQuestion,
      questionIds: pl.questionIds || []
    });
    setVideoSourceType(pl.videoUrl.startsWith('/uploads/') ? 'upload' : 'youtube');
    setIsPlaylistFormOpen(true);
  };

  const handleCreatePlaylist = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const isEdit = !!editingPlaylistId;
      const url = isEdit ? `${backendUrl}/api/playlists/${editingPlaylistId}` : `${backendUrl}/api/playlists`;
      const method = isEdit ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(playlistForm)
      });
      if (res.ok) {
        handleClosePlaylistForm();
        fetchData();
      }
    } catch (error) {
      console.error(error);
    }
  };

  const handleDeletePlaylist = async (id: string) => {
    if (!confirm('Bạn chắc chắn muốn xóa bài học này?')) return;
    try {
      const res = await fetch(`${backendUrl}/api/playlists/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (res.ok) {
        if (selectedPlaylistId === id) {
          setSelectedPlaylistId(null);
        }
        fetchData();
      }
    } catch (error) {
      console.error(error);
    }
  };

  const handleCreateQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch(`${backendUrl}/api/questions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(questionForm)
      });
      if (res.ok) {
        setIsQuestionFormOpen(false);
        fetchData();
        setQuestionForm({
          text: '',
          options: ['', '', '', ''],
          correctOption: 0,
          explanation: ''
        });
      }
    } catch (error) {
      console.error(error);
    }
  };

  const handleExportCSV = () => {
    const headers = ['Câu hỏi', 'Đáp án A', 'Đáp án B', 'Đáp án C', 'Đáp án D', 'Đáp án đúng (A/B/C/D)', 'Giải thích'];
    const rows = [headers];

    // If questions array is empty, we export one sample question as a template
    const listToExport = questions.length > 0 ? questions : [
      {
        id: '',
        text: 'Ví dụ: Công dân đủ bao nhiêu tuổi được gọi nhập ngũ?',
        options: ['Đủ 16 tuổi', 'Đủ 17 tuổi', 'Đủ 18 tuổi', 'Đủ 20 tuổi'],
        correctOption: 2,
        explanation: 'Theo Luật Nghĩa vụ quân sự, độ tuổi nhập ngũ là đủ 18 tuổi.'
      }
    ];

    listToExport.forEach(q => {
      const correctLetter = String.fromCharCode(65 + q.correctOption); // 0 -> A, 1 -> B, etc.
      rows.push([
        q.text || '',
        q.options[0] || '',
        q.options[1] || '',
        q.options[2] || '',
        q.options[3] || '',
        correctLetter,
        q.explanation || ''
      ]);
    });

    // Use UTF-8 BOM so Excel displays Vietnamese correctly
    const csvContent = "\uFEFF" + rows.map(row =>
      row.map(val => {
        const escaped = String(val).replace(/"/g, '""');
        return `"${escaped}"`;
      }).join(',')
    ).join('\r\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", "ngan_hang_cau_hoi.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Robust CSV parser supporting quotes and line breaks within fields
  const parseCSV = (text: string): string[][] => {
    const lines: string[][] = [];
    let row: string[] = [''];
    let inQuotes = false;

    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      const nextChar = text[i + 1];

      if (char === '"') {
        if (inQuotes && nextChar === '"') {
          row[row.length - 1] += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        row.push('');
      } else if ((char === '\r' || char === '\n') && !inQuotes) {
        if (char === '\r' && nextChar === '\n') {
          i++;
        }
        lines.push(row);
        row = [''];
      } else {
        row[row.length - 1] += char;
      }
    }
    if (row.length > 1 || row[0] !== '') {
      lines.push(row);
    }
    return lines;
  };

  const handleImportCSV = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const text = event.target?.result as string;
        if (!text) return;

        const rawRows = parseCSV(text);
        if (rawRows.length <= 1) {
          alert('File CSV trống hoặc không đúng cấu trúc.');
          return;
        }

        // Skip header row
        const dataRows = rawRows.slice(1);
        const parsedQuestions: any[] = [];

        for (const row of dataRows) {
          // A valid row must have at least the question text and some options
          if (row.length < 6 || !row[0].trim()) continue;

          // Map correct option letter to index
          const letter = row[5]?.trim().toUpperCase() || 'A';
          let correctOption = 0;
          if (letter === 'B') correctOption = 1;
          else if (letter === 'C') correctOption = 2;
          else if (letter === 'D') correctOption = 3;

          parsedQuestions.push({
            text: row[0].trim(),
            options: [
              row[1]?.trim() || '',
              row[2]?.trim() || '',
              row[3]?.trim() || '',
              row[4]?.trim() || ''
            ],
            correctOption,
            explanation: row[6]?.trim() || ''
          });
        }

        if (parsedQuestions.length === 0) {
          alert('Không tìm thấy câu hỏi hợp lệ nào trong file.');
          return;
        }

        const confirmMsg = `Hệ thống tìm thấy ${parsedQuestions.length} câu hỏi hợp lệ từ file Excel/CSV. Bạn có chắc chắn muốn nhập loạt câu hỏi này vào cơ sở dữ liệu?`;
        if (!window.confirm(confirmMsg)) {
          return;
        }

        // Send batch request
        const res = await fetch(`${backendUrl}/api/questions/batch`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify(parsedQuestions)
        });

        if (res.ok) {
          alert(`Đã nhập thành công ${parsedQuestions.length} câu hỏi vào ngân hàng!`);
          fetchData();
        } else {
          const errData = await res.json();
          alert(`Lỗi khi nhập câu hỏi: ${errData.message || 'Không xác định'}`);
        }
      } catch (err) {
        console.error('Error importing CSV:', err);
        alert('Lỗi định dạng file hoặc lỗi đọc file.');
      } finally {
        // Reset file input value so user can import the same file again
        e.target.value = '';
      }
    };
    reader.readAsText(file, 'UTF-8');
  };


  const handleDeleteQuestion = async (id: string) => {
    if (!confirm('Bạn chắc chắn muốn xóa câu hỏi này?')) return;
    try {
      const res = await fetch(`${backendUrl}/api/questions/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (res.ok) fetchData();
    } catch (error) {
      console.error(error);
    }
  };

  const toggleQuestionSelection = (qid: string) => {
    const current = playlistForm.questionIds || [];
    if (current.includes(qid)) {
      setPlaylistForm({ ...playlistForm, questionIds: current.filter(id => id !== qid) });
    } else {
      if (current.length >= 5) {
        alert('Chỉ chọn tối đa 5 câu hỏi cho một bài học.');
        return;
      }
      setPlaylistForm({ ...playlistForm, questionIds: [...current, qid] });
    }
  };

  // Helper for generating difficulty properties based on lesson day
  const getDifficulty = (day: number) => {
    const d = day % 3;
    if (d === 1) return { label: 'LOW', class: 'diff-easy', value: 1 };
    if (d === 2) return { label: 'MEDIUM', class: 'diff-medium', value: 2 };
    return { label: 'HIGH', class: 'diff-hard', value: 3 };
  };

  // Find currently selected playlist
  const activePlaylist = playlists.find(p => p.id === selectedPlaylistId) || playlists[0];
  const activePlaylistDiff = activePlaylist ? getDifficulty(activePlaylist.day) : { label: 'HIGH', class: 'diff-hard', value: 3 };

  // Other playlists (queued/archived)
  const remainingPlaylists = playlists.filter(p => p.id !== (activePlaylist?.id));
  const queuedPlaylist = remainingPlaylists[0];
  const archivedPlaylist = remainingPlaylists[1];

  // Pagination calculations for Questions tab
  const totalQuestionsPages = Math.ceil(questions.length / 5) || 1;
  const currentQuestionsPageSafe = Math.min(questionsCurrentPage, totalQuestionsPages);
  const indexOfLastQuestion = currentQuestionsPageSafe * 5;
  const indexOfFirstQuestion = indexOfLastQuestion - 5;
  const currentQuestions = questions.slice(indexOfFirstQuestion, indexOfLastQuestion);

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: '260px 1fr',
      height: '100vh',
      width: '100%',
      background: '#080d16',
      color: '#f8fafc',
      fontFamily: 'var(--font-body)',
      overflow: 'hidden'
    }}>

      {/* LEFT SIDEBAR NAVIGATION PANEL */}
      <aside style={{
        background: '#0a0f1d',
        padding: '30px 20px',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        borderRight: '1px solid rgba(0, 242, 254, 0.1)'
      }}>
        <div>
          {/* LOGO */}
          <div style={{ marginBottom: '40px', paddingLeft: '8px' }}>
            <h1 style={{
              fontSize: '1.4rem',
              fontWeight: 800,
              color: 'var(--color-primary)',
              letterSpacing: '2px',
              lineHeight: '1.2',
              fontFamily: 'var(--font-heading)'
            }}>
              PHÁP CHẾ<br />QUÂN SỰ
            </h1>
          </div>

          {/* OFFICER INFO CARD */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            padding: '12px',
            background: 'rgba(255, 255, 255, 0.02)',
            borderRadius: '8px',
            border: '1px solid rgba(0, 242, 254, 0.05)',
            marginBottom: '32px'
          }}>
            {/* SVG Officer Avatar */}
            <svg width="42" height="42" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ borderRadius: '6px', flexShrink: 0 }}>
              <rect width="64" height="64" fill="#0A1120" />
              <path d="M0 16 H64 M0 32 H64 M0 48 H64 M16 0 V64 M32 0 V64 M48 0 V64" stroke="#00F2FE" strokeWidth="0.5" strokeOpacity="0.2" />
              <path d="M12 60 C12 48 20 40 32 40 C44 40 52 48 52 60" fill="#1A2D4C" stroke="#00F2FE" strokeWidth="1" />
              <path d="M26 40 L32 50 L38 40" stroke="#00F2FE" strokeWidth="1" />
              <path d="M24 24 C24 16 30 14 32 14 C34 14 40 16 40 24 C40 32 36 34 32 34 C28 34 24 32 24 24 Z" fill="#FCE2C6" />
              <path d="M22 23 H42 L40 28 H24 Z" fill="#00F2FE" />
              <line x1="32" y1="23" x2="32" y2="28" stroke="#080D16" strokeWidth="1" />
              <path d="M20 16 C22 10 42 10 44 16 Z" fill="#0E1726" stroke="#00F2FE" strokeWidth="1" />
              <path d="M18 16 H46" stroke="#f59e0b" strokeWidth="1.5" />
            </svg>
            <div style={{ overflow: 'hidden' }}>
              <div style={{ fontSize: '0.85rem', fontWeight: 800, color: '#fff', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>{userName.toUpperCase()}</div>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>{userRole === 'admin' ? 'Đoàn JAG • Quản trị viên' : 'Đoàn JAG • Giảng viên'}</div>
            </div>
          </div>

          {/* Navigation Links */}
          <nav style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <button
              onClick={() => setActiveTab('playlists')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '12px 16px',
                width: '100%',
                background: activeTab === 'playlists' ? '#00b894' : 'transparent',
                border: 'none',
                borderRadius: '6px',
                color: activeTab === 'playlists' ? '#050915' : 'var(--text-secondary)',
                fontWeight: activeTab === 'playlists' ? 700 : 500,
                fontSize: '0.9rem',
                cursor: 'pointer',
                textAlign: 'left',
                transition: 'all 0.2s'
              }}
            >
              <Activity size={18} />
              Bảng điều khiển
            </button>

            <button
              onClick={() => setActiveTab('history')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '12px 16px',
                width: '100%',
                background: activeTab === 'history' ? '#00b894' : 'transparent',
                border: 'none',
                borderRadius: '6px',
                color: activeTab === 'history' ? '#050915' : 'var(--text-secondary)',
                fontWeight: activeTab === 'history' ? 700 : 500,
                fontSize: '0.9rem',
                cursor: 'pointer',
                textAlign: 'left',
                transition: 'all 0.2s'
              }}
            >
              <History size={18} />
              Hồ sơ chuyên đề
            </button>

            <button
              onClick={() => setActiveTab('users')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '12px 16px',
                width: '100%',
                background: activeTab === 'users' ? '#00b894' : 'transparent',
                border: 'none',
                borderRadius: '6px',
                color: activeTab === 'users' ? '#050915' : 'var(--text-secondary)',
                fontWeight: activeTab === 'users' ? 700 : 500,
                fontSize: '0.9rem',
                cursor: 'pointer',
                textAlign: 'left',
                transition: 'all 0.2s',
                marginBottom: '8px'
              }}
            >
              <Users size={18} />
              Quản lý tài khoản
            </button>

            <button
              onClick={() => setActiveTab('questions')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '12px 16px',
                width: '100%',
                background: activeTab === 'questions' ? '#00b894' : 'transparent',
                border: 'none',
                borderRadius: '6px',
                color: activeTab === 'questions' ? '#050915' : 'var(--text-secondary)',
                fontWeight: activeTab === 'questions' ? 700 : 500,
                fontSize: '0.9rem',
                cursor: 'pointer',
                textAlign: 'left',
                transition: 'all 0.2s'
              }}
            >
              <BookOpen size={18} />
              Điều luật pháp lý
            </button>
            {/* 637: Removed Lịch sử đơn vị and Cài đặt buttons */}
            <button
              onClick={onLogout}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '12px 16px',
                width: '100%',
                background: 'rgba(239, 68, 68, 0.1)',
                border: 'none',
                borderRadius: '6px',
                color: '#f87171',
                fontWeight: 600,
                fontSize: '0.9rem',
                cursor: 'pointer',
                textAlign: 'left',
                marginTop: '16px',
                transition: 'all 0.2s'
              }}
            >
              <LogOut size={18} />
              Đăng xuất
            </button>
          </nav>
        </div>

      </aside>

      {/* MAIN PANEL CONTENT */}
      <main style={{ padding: '40px', overflowY: 'auto' }}>

        {/* HEADER */}
        <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
          <div>
            <h2 style={{ fontSize: '1.8rem', fontWeight: 800, color: '#fff', letterSpacing: '0.5px' }}>
              {activeTab === 'playlists'
                ? 'Quản Lý Bài Học Pháp Luật Hàng Ngày'
                : activeTab === 'questions'
                  ? 'Ngân Hàng Câu Hỏi Pháp Lý'
                  : activeTab === 'history'
                    ? 'Nhật Ký Chiến Báo Lớp Học'
                    : 'Quản Lý Tài Khoản Người Dùng'}
            </h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginTop: '4px' }}>
              {activeTab === 'playlists'
                ? 'Trung tâm chỉ huy: Tổng quan mô-đun pháp luật hàng ngày'
                : activeTab === 'questions'
                  ? 'Cơ sở dữ liệu: Hệ thống điều luật pháp lý quân đội'
                  : activeTab === 'history'
                    ? 'Nhật ký: Nhật ký học tập quân sự & Điểm danh học viên'
                    : 'Quản lý: Duyệt kích hoạt hoặc nâng hạ quyền hạn Giảng viên'}
            </p>
          </div>

          <div className="monospace-val" style={{ color: 'var(--color-primary)', fontSize: '1.05rem', border: '1px solid rgba(0, 242, 254, 0.25)', padding: '6px 14px', borderRadius: '4px', background: 'rgba(0, 242, 254, 0.05)', letterSpacing: '1px' }}>
            HỆ THỐNG: {sysTime}
          </div>
        </header>

        {/* TAB 1: PLAYLISTS / DASHBOARD CONTAINER */}
        {activeTab === 'playlists' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '40px' }}>

            {/* TOP ROW GRID (Active protocol + Queue/Archived stack) */}
            <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: '32px' }}>

              {/* Left Column: Active protocol today (Large card) */}
              {activePlaylist ? (
                <div className="glass-panel-glow" style={{
                  padding: '32px',
                  border: '1px solid rgba(0, 242, 254, 0.35)',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  boxShadow: '0 0 30px rgba(0, 242, 254, 0.15)',
                  position: 'relative'
                }}>
                  <div>
                    {/* Badge header & Shield */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                      <span style={{
                        background: '#990000',
                        color: '#fff',
                        padding: '4px 10px',
                        fontSize: '0.75rem',
                        fontWeight: 800,
                        borderRadius: '3px',
                        letterSpacing: '1px'
                      }}>
                        CHUYÊN ĐỀ HOẠT ĐỘNG: HÔM NAY
                      </span>
                      <Shield size={18} style={{ color: 'var(--color-primary)' }} />
                    </div>

                    {/* Playlist details */}
                    <h3 style={{ fontSize: '1.6rem', color: '#fff', marginBottom: '12px', fontWeight: 800 }}>{activePlaylist.title}</h3>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: '1.6', marginBottom: '32px' }}>
                      {activePlaylist.storyText || 'Nội dung kể chuyện dẫn nhập của bài học.'}
                    </p>

                    {/* Specifications list */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr 1fr', gap: '16px', marginBottom: '32px' }}>
                      <div style={{ background: 'rgba(5, 9, 21, 0.5)', padding: '12px 16px', borderRadius: '6px', border: '1px solid rgba(0,242,254,0.05)' }}>
                        <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', display: 'block', textTransform: 'uppercase', marginBottom: '4px' }}>CÂU HỎI</span>
                        <strong className="monospace-val" style={{ fontSize: '1.3rem', color: '#fff' }}>
                          {activePlaylist.questionIds?.length || 0}
                        </strong>
                      </div>
                      <div style={{ background: 'rgba(5, 9, 21, 0.5)', padding: '12px 16px', borderRadius: '6px', border: '1px solid rgba(0,242,254,0.05)' }}>
                        <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', display: 'block', textTransform: 'uppercase', marginBottom: '4px' }}>ĐỘ PHỨC TẠP</span>
                        <strong className="monospace-val" style={{ fontSize: '1.3rem', color: '#f59e0b' }}>
                          {activePlaylistDiff.label}
                        </strong>
                      </div>
                      <div style={{ background: 'rgba(5, 9, 21, 0.5)', padding: '12px 16px', borderRadius: '6px', border: '1px solid rgba(0,242,254,0.05)' }}>
                        <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', display: 'block', textTransform: 'uppercase', marginBottom: '4px' }}>T.G ƯỚC TÍNH</span>
                        <strong className="monospace-val" style={{ fontSize: '1.3rem', color: 'var(--color-primary)' }}>
                          3 phút
                        </strong>
                      </div>
                    </div>
                  </div>

                  {/* 1-Click Launch Button */}
                  <div style={{ display: 'flex', gap: '12px' }}>
                    <button
                      className="btn-primary animate-pulse-glow"
                      onClick={() => handleLaunch(activePlaylist.id)}
                      style={{
                        flex: 1,
                        padding: '16px',
                        fontSize: '1rem',
                        background: 'linear-gradient(90deg, #00F2FE 0%, #4FACFE 100%)',
                        boxShadow: '0 0 20px rgba(0, 242, 254, 0.35)'
                      }}
                    >
                      🚀 KÍCH HOẠT PHÒNG HỌC 1-CLICK
                    </button>
                    {userRole === 'admin' && (
                      <button
                        className="btn-secondary"
                        onClick={() => handleEditPlaylist(activePlaylist)}
                        style={{ padding: '16px', color: 'var(--color-primary)', borderColor: 'rgba(0, 242, 254, 0.2)' }}
                      >
                        <Edit2 size={16} />
                      </button>
                    )}
                  </div>
                </div>
              ) : (
                <div className="glass-panel" style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
                  Không có dữ liệu bài học hôm nay.
                </div>
              )}

              {/* Right Column: Queued / Archived stack */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                {/* Card 1: QUEUED */}
                <div className="glass-panel" style={{ padding: '24px', border: '1px solid rgba(255,255,255,0.04)', background: 'rgba(14, 23, 39, 0.4)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                    <span style={{ background: '#334155', color: '#94a3b8', padding: '3px 8px', fontSize: '0.65rem', fontWeight: 800, borderRadius: '3px' }}>
                      BÀI TIẾP THEO: NGÀY MAI
                    </span>
                    <Award size={16} style={{ color: '#f59e0b' }} />
                  </div>
                  {queuedPlaylist ? (
                    <div onClick={() => setSelectedPlaylistId(queuedPlaylist.id)} style={{ cursor: 'pointer' }}>
                      <h4 style={{ fontSize: '1.1rem', color: '#fff', marginBottom: '8px' }}>{queuedPlaylist.title}</h4>
                      <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '16px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {queuedPlaylist.storyText}
                      </p>
                      {/* Fake timeline tracker */}
                      <div className="timeline-track" style={{ background: 'rgba(255,255,255,0.05)' }}>
                        <div className="timeline-fill" style={{ width: '40%', background: '#f59e0b', boxShadow: 'none' }} />
                      </div>
                    </div>
                  ) : (
                    <div>
                      <h4 style={{ fontSize: '1.1rem', color: '#fff', marginBottom: '8px' }}>Military Orders & Insubordination</h4>
                      <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '16px' }}>
                        Chain of command legalities and consequences of refusing lawful...
                      </p>
                      <div className="timeline-track" style={{ background: 'rgba(255,255,255,0.05)' }}>
                        <div className="timeline-fill" style={{ width: '35%', background: '#b45309', boxShadow: 'none' }} />
                      </div>
                    </div>
                  )}
                </div>

                {/* Card 2: ARCHIVED */}
                <div className="glass-panel" style={{ padding: '24px', border: '1px solid rgba(255,255,255,0.04)', background: 'rgba(14, 23, 39, 0.4)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                    <span style={{ background: '#334155', color: '#94a3b8', padding: '3px 8px', fontSize: '0.65rem', fontWeight: 800, borderRadius: '3px' }}>
                      ĐÃ LƯU TRỮ
                    </span>
                    <Shield size={16} style={{ color: 'var(--color-success)' }} />
                  </div>
                  {archivedPlaylist ? (
                    <div onClick={() => setSelectedPlaylistId(archivedPlaylist.id)} style={{ cursor: 'pointer' }}>
                      <h4 style={{ fontSize: '1.1rem', color: '#fff', marginBottom: '8px' }}>{archivedPlaylist.title}</h4>
                      <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '16px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {archivedPlaylist.storyText}
                      </p>
                      <div style={{ display: 'flex', gap: '4px' }}>
                        <div style={{ width: '20%', height: '4px', background: 'var(--color-success)', borderRadius: '2px' }} />
                        <div style={{ width: '20%', height: '4px', background: 'var(--color-success)', borderRadius: '2px' }} />
                        <div style={{ width: '20%', height: '4px', background: 'var(--color-success)', borderRadius: '2px' }} />
                        <div style={{ width: '20%', height: '4px', background: 'var(--color-success)', borderRadius: '2px' }} />
                      </div>
                    </div>
                  ) : (
                    <div>
                      <h4 style={{ fontSize: '1.1rem', color: '#fff', marginBottom: '8px' }}>An toàn giao thông hành quân chiến thuật</h4>
                      <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '16px' }}>
                        Quy định giao thông khi vận tải quân sự và tương tác với dân sự...
                      </p>
                      <div style={{ display: 'flex', gap: '4px' }}>
                        <div style={{ width: '20%', height: '4px', background: '#10b981', borderRadius: '2px' }} />
                        <div style={{ width: '20%', height: '4px', background: '#10b981', borderRadius: '2px' }} />
                        <div style={{ width: '20%', height: '4px', background: '#10b981', borderRadius: '2px' }} />
                        <div style={{ width: '20%', height: '4px', background: '#10b981', borderRadius: '2px' }} />
                        <div style={{ width: '20%', height: '4px', background: '#10b981', borderRadius: '2px' }} />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* PLAYLIST FORMS MODAL / EXPANDABLE (for admins) */}
            {isPlaylistFormOpen && (
              <form onSubmit={handleCreatePlaylist} className="glass-panel animate-fade-in" style={{ padding: '24px', border: '1px solid var(--color-primary-glow)' }}>
                <h3 style={{ marginBottom: '20px', color: 'var(--color-primary)', fontSize: '1.1rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  {editingPlaylistId ? 'CHỈNH SỬA HỒ SƠ BÀI HỌC' : 'THIẾT LẬP BÀI HỌC MỚI'}
                </h3>

                <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: '16px', marginBottom: '16px' }}>
                  <div>
                    <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Ngày số (Day)</label>
                    <input
                      type="number"
                      required
                      className="input-field monospace-val"
                      value={playlistForm.day || ''}
                      onChange={(e) => setPlaylistForm({ ...playlistForm, day: Number(e.target.value) })}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Tiêu đề bài học</label>
                    <input
                      type="text"
                      required
                      placeholder="Tiêu đề bài học..."
                      className="input-field"
                      value={playlistForm.title || ''}
                      onChange={(e) => setPlaylistForm({ ...playlistForm, title: e.target.value })}
                    />
                  </div>
                </div>

                <div style={{ marginBottom: '16px' }}>
                  <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Nguồn Video</label>
                  <div style={{ display: 'flex', gap: '20px', marginBottom: '12px' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', cursor: 'pointer', color: '#fff' }}>
                      <input
                        type="radio"
                        name="videoSourceType"
                        checked={videoSourceType === 'youtube'}
                        onChange={() => {
                          setVideoSourceType('youtube');
                          setPlaylistForm(prev => ({ ...prev, videoUrl: 'https://www.youtube.com/embed/dQw4w9WgXcQ' }));
                        }}
                      />
                      YouTube Link
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', cursor: 'pointer', color: '#fff' }}>
                      <input
                        type="radio"
                        name="videoSourceType"
                        checked={videoSourceType === 'upload'}
                        onChange={() => {
                          setVideoSourceType('upload');
                          setPlaylistForm(prev => ({ ...prev, videoUrl: '' }));
                        }}
                      />
                      Tải lên file video (.mp4)
                    </label>
                  </div>

                  {videoSourceType === 'youtube' ? (
                    <input
                      type="text"
                      required
                      placeholder="Ví dụ: https://www.youtube.com/embed/..."
                      className="input-field"
                      value={playlistForm.videoUrl || ''}
                      onChange={(e) => setPlaylistForm({ ...playlistForm, videoUrl: e.target.value })}
                    />
                  ) : (
                    <div className="glass-panel" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '10px', alignItems: 'flex-start', border: '1px dashed rgba(0, 242, 254, 0.3)' }}>
                      <input
                        type="file"
                        accept="video/*"
                        style={{ display: 'none' }}
                        id="local-video-file"
                        onChange={handleVideoUpload}
                      />
                      <label
                        htmlFor="local-video-file"
                        className="btn-secondary"
                        style={{ cursor: 'pointer', display: 'inline-flex', padding: '8px 16px', fontSize: '0.85rem' }}
                      >
                        Chọn tệp video MP4
                      </label>
                      {isUploading && <span style={{ fontSize: '0.8rem', color: 'var(--color-primary)' }}>Đang xử lý tải lên...</span>}
                      {playlistForm.videoUrl && !isUploading && (
                        <span style={{ fontSize: '0.8rem', color: 'var(--color-success)', wordBreak: 'break-all' }}>
                          Đã tải file lên: <strong>{playlistForm.videoUrl}</strong>
                        </span>
                      )}
                    </div>
                  )}
                </div>

                <div style={{ marginBottom: '16px' }}>
                  <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Câu chuyện Bác Hồ / Lời kể chuyện dẫn nhập</label>
                  <textarea
                    required
                    rows={3}
                    placeholder="Nội dung lời kể dẫn nhập câu chuyện pháp lý..."
                    className="input-field"
                    style={{ resize: 'vertical' }}
                    value={playlistForm.storyText || ''}
                    onChange={(e) => setPlaylistForm({ ...playlistForm, storyText: e.target.value })}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                  <div>
                    <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Tiêu đề tình huống</label>
                    <input
                      type="text"
                      required
                      placeholder="Tiêu đề tình huống..."
                      className="input-field"
                      value={playlistForm.situationTitle || ''}
                      onChange={(e) => setPlaylistForm({ ...playlistForm, situationTitle: e.target.value })}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Câu hỏi suy ngẫm</label>
                    <input
                      type="text"
                      required
                      placeholder="Nội dung câu hỏi thảo luận..."
                      className="input-field"
                      value={playlistForm.situationQuestion || ''}
                      onChange={(e) => setPlaylistForm({ ...playlistForm, situationQuestion: e.target.value })}
                    />
                  </div>
                </div>

                <div style={{ marginBottom: '20px' }}>
                  <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Chi tiết nội dung tình huống</label>
                  <textarea
                    required
                    rows={3}
                    placeholder="Tóm tắt tình huống pháp lý xảy ra..."
                    className="input-field"
                    style={{ resize: 'vertical' }}
                    value={playlistForm.situationText || ''}
                    onChange={(e) => setPlaylistForm({ ...playlistForm, situationText: e.target.value })}
                  />
                </div>

                <div style={{ marginBottom: '24px' }}>
                  <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 700 }}>
                    Chọn 5 câu hỏi trắc nghiệm ({playlistForm.questionIds?.length || 0}/5 đã chọn)
                  </label>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', maxHeight: '200px', overflowY: 'auto', padding: '10px', border: '1px solid rgba(0, 242, 254, 0.1)', borderRadius: '8px', background: 'rgba(5, 9, 21, 0.4)' }}>
                    {questions.map((q) => {
                      const isSelected = playlistForm.questionIds?.includes(q.id);
                      return (
                        <div
                          key={q.id}
                          onClick={() => toggleQuestionSelection(q.id)}
                          style={{
                            padding: '10px 14px',
                            borderRadius: '6px',
                            border: isSelected ? '1px solid var(--color-primary)' : '1px solid transparent',
                            background: isSelected ? 'rgba(0, 242, 254, 0.08)' : 'rgba(255,255,255,0.01)',
                            cursor: 'pointer',
                            fontSize: '0.8rem',
                            color: isSelected ? '#fff' : 'var(--text-secondary)',
                            transition: 'all 0.2s'
                          }}
                        >
                          <strong>Q:</strong> {q.text}
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                  <button type="button" className="btn-secondary" onClick={handleClosePlaylistForm}>Hủy</button>
                  <button type="submit" className="btn-primary" disabled={(playlistForm.questionIds?.length || 0) !== 5}>
                    Lưu bài học
                  </button>
                </div>
              </form>
            )}

            {/* BOTTOM AREA: Cyber Security Question Matrix (Screenshot 1 matching table) */}
            <div className="glass-panel" style={{ padding: '28px', border: '1px solid rgba(0, 242, 254, 0.12)' }}>

              {/* Table Header Controls */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                <h3 style={{ fontSize: '1.25rem', color: '#fff', fontWeight: 800, fontFamily: 'var(--font-heading)' }}>
                  {activePlaylist ? `Ma trận câu hỏi: ${activePlaylist.title}` : 'Ma trận câu hỏi'}
                </h3>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button className="btn-secondary" style={{ padding: '8px', borderRadius: '4px', borderColor: 'rgba(255,255,255,0.08)' }}>
                    <Sliders size={16} />
                  </button>
                  <button
                    onClick={() => {
                      setEditingPlaylistId(null);
                      setIsPlaylistFormOpen(true);
                    }}
                    className="btn-secondary"
                    style={{ padding: '8px', borderRadius: '4px', borderColor: 'rgba(255,255,255,0.08)' }}
                  >
                    <Plus size={16} />
                  </button>
                </div>
              </div>

              {/* Data Table */}
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem', textAlign: 'left' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)', color: 'var(--text-muted)', textTransform: 'uppercase', fontSize: '0.75rem', letterSpacing: '1px' }}>
                      <th style={{ padding: '12px 8px', width: '90px' }}>Mã câu hỏi</th>
                      <th style={{ padding: '12px 8px' }}>Nội dung câu hỏi</th>
                      <th style={{ padding: '12px 8px', width: '130px' }}>Loại câu hỏi</th>
                      <th style={{ padding: '12px 8px', width: '110px' }}>Độ khó</th>
                      <th style={{ padding: '12px 8px', width: '90px', textAlign: 'right' }}>Thao tác</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(() => {
                      // Filter questions for active playlist, or show all if none
                      const activeQIds = activePlaylist?.questionIds || [];
                      const displayQs = questions.filter(q => activeQIds.includes(q.id));
                      const finalQs = displayQs.length > 0 ? displayQs : questions.slice(0, 3);

                      if (finalQs.length === 0) {
                        return (
                          <tr>
                            <td colSpan={5} style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)' }}>
                              Chưa có câu hỏi nào trong ngân hàng dữ liệu.
                            </td>
                          </tr>
                        );
                      }

                      return finalQs.map((q, idx) => {
                        // Generate mock cyber ID style: Q-011A, Q-012B, Q-013C
                        const alph = ['A', 'B', 'C', 'D', 'E'];
                        const customId = `Q-01${idx + 1}${alph[idx % 5]}`;

                        // Determine Type: Yes/No or True/False vs Multiple Choice
                        const isTrueFalse = q.options.length === 2 || q.options.some(o => o.toLowerCase() === 'đúng' || o.toLowerCase() === 'sai');
                        const typeLabel = isTrueFalse ? 'Đúng/Sai' : 'Trắc nghiệm';

                        // Determine Difficulty Bars representation (1 to 4 segments)
                        const diffValue = (idx % 3) + 1; // 1, 2, or 3
                        const diffColor = diffValue === 1 ? '#10b981' : diffValue === 2 ? '#f59e0b' : '#ef4444';

                        return (
                          <tr key={q.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)', transition: 'background 0.2s' }}>
                            <td className="monospace-val" style={{ padding: '16px 8px', color: 'var(--color-primary)', fontWeight: 600 }}>{customId}</td>
                            <td style={{ padding: '16px 8px', color: '#e2e8f0', fontWeight: 500 }}>{q.text}</td>
                            <td style={{ padding: '16px 8px' }}>
                              <span style={{
                                background: 'rgba(5, 9, 21, 0.6)',
                                border: '1px solid rgba(255, 255, 255, 0.05)',
                                color: 'var(--text-secondary)',
                                padding: '4px 8px',
                                borderRadius: '4px',
                                fontSize: '0.75rem',
                                fontWeight: 600
                              }}>
                                {typeLabel}
                              </span>
                            </td>
                            <td style={{ padding: '16px 8px' }}>
                              {/* 4 segments rendering */}
                              <div style={{ display: 'flex', gap: '3px' }}>
                                {[1, 2, 3, 4].map((bar) => {
                                  const isActive = bar <= diffValue;
                                  return (
                                    <div
                                      key={bar}
                                      style={{
                                        width: '6px',
                                        height: '14px',
                                        borderRadius: '1px',
                                        backgroundColor: isActive ? diffColor : '#1e293b',
                                        boxShadow: isActive ? `0 0 6px ${diffColor}` : 'none'
                                      }}
                                    />
                                  );
                                })}
                              </div>
                            </td>
                            <td style={{ padding: '16px 8px', textAlign: 'right' }}>
                              <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                                <button onClick={() => handleDeleteQuestion(q.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px' }} title="Xóa">
                                  <Trash2 size={14} style={{ color: '#ef4444' }} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      });
                    })()}
                  </tbody>
                </table>
              </div>

              {/* Table Footer Pagination */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '20px', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                <span>Hiển thị 1-{playlists.length} trên tổng số {playlists.length} mục</span>
                <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
                  <span style={{ cursor: 'pointer' }}>TRƯỚC</span>
                  <strong className="monospace-val" style={{ color: 'var(--color-primary)' }}>01</strong>
                  <span style={{ cursor: 'pointer' }}>SAU</span>
                </div>
              </div>

            </div>

          </div>
        )}

        {/* TAB 2: HISTORY (ACTIVE BRIEFS) */}
        {activeTab === 'history' && (
          <div>
            {/* Tiêu đề đã được hiển thị trên Header chung */}

            {history.length === 0 ? (
              <div className="glass-panel" style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
                Chưa ghi nhận chiến báo lịch sử từ các phòng học.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                {history.map((hist) => (
                  <div key={hist.id} className="glass-panel" style={{ padding: '24px', border: '1px solid rgba(0, 242, 254, 0.12)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '14px', marginBottom: '16px' }}>
                      <div>
                        <h4 style={{ fontSize: '1.15rem', color: 'var(--color-primary)', fontWeight: 700 }}>{hist.playlistTitle}</h4>
                        <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                          Ngày: {hist.date} | PIN phòng: <strong className="monospace-val">{hist.pin}</strong>
                        </span>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <span className="monospace-val text-glow-primary" style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--color-primary)' }}>
                          {hist.participantsCount}
                        </span>
                        <span style={{ display: 'block', fontSize: '0.7rem', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Học viên thi đấu</span>
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '12px', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                      <Award size={14} style={{ color: 'var(--color-warning)' }} />
                      <strong>Bảng Xếp Hạng Top 3:</strong>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px', marginBottom: '16px' }}>
                      {hist.leaderboard.slice(0, 3).map((item, idx) => (
                        <div
                          key={idx}
                          style={{
                            padding: '10px 14px',
                            background: 'rgba(5, 9, 21, 0.3)',
                            border: '1px solid rgba(255, 255, 255, 0.03)',
                            borderRadius: '6px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '12px'
                          }}
                        >
                          <span style={{
                            width: '22px',
                            height: '22px',
                            borderRadius: '50%',
                            background: idx === 0 ? '#f59e0b' : idx === 1 ? '#94a3b8' : '#b45309',
                            color: '#000',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontWeight: 800,
                            fontSize: '0.75rem'
                          }}>
                            {idx + 1}
                          </span>
                          <div>
                            <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#fff' }}>{item.name}</div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Lớp {item.class} | <strong className="monospace-val">{item.score} pts</strong></div>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Expandable Class Statistics */}
                    <button
                      className="btn-secondary"
                      onClick={() => setExpandedHistoryId(expandedHistoryId === hist.id ? null : hist.id)}
                      style={{ width: '100%', padding: '10px', fontSize: '0.8rem', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                    >
                      <FileText size={14} />
                      {expandedHistoryId === hist.id ? 'ẨN CHI TIẾT THỐNG KÊ' : 'XEM BẢNG ĐIỂM CHI TIẾT CẢ LỚP'}
                    </button>

                    {expandedHistoryId === hist.id && (
                      <div className="animate-fade-in" style={{ marginTop: '16px', background: 'rgba(5, 9, 21, 0.6)', padding: '20px', borderRadius: '8px', border: '1px solid rgba(0, 242, 254, 0.15)', overflowX: 'auto' }}>
                        <h5 style={{ fontSize: '0.9rem', marginBottom: '12px', color: 'var(--color-primary)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                          BẢNG ĐIỂM CHUYÊN CẦN VÀ TRẢ LỜI CỦA HỌC VIÊN
                        </h5>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem', textAlign: 'left', minWidth: '500px' }}>
                          <thead>
                            <tr style={{ borderBottom: '1px solid rgba(0, 242, 254, 0.2)', color: 'var(--text-secondary)' }}>
                              <th style={{ padding: '8px' }}>Hạng</th>
                              <th style={{ padding: '8px' }}>Họ và tên</th>
                              <th style={{ padding: '8px' }}>Lớp</th>
                              <th style={{ padding: '8px', textAlign: 'center' }}>Điểm số</th>
                              <th style={{ padding: '8px', textAlign: 'center' }}>Số câu đúng</th>
                              <th style={{ padding: '8px', textAlign: 'center' }}>Tỷ lệ đúng</th>
                            </tr>
                          </thead>
                          <tbody>
                            {hist.leaderboard.map((item, idx) => {
                              const correct = item.correctCount ?? 0;
                              const total = item.answersCount ?? 5;
                              const rate = total > 0 ? Math.round((correct / total) * 100) : 0;
                              return (
                                <tr key={idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)', transition: 'background 0.2s' }}>
                                  <td style={{ padding: '8px', fontWeight: 'bold' }}>{idx + 1}</td>
                                  <td style={{ padding: '8px', color: '#fff', fontWeight: 600 }}>{item.name}</td>
                                  <td style={{ padding: '8px' }}>{item.class}</td>
                                  <td className="monospace-val" style={{ padding: '8px', textAlign: 'center', color: 'var(--color-primary)', fontWeight: 'bold' }}>{item.score} pts</td>
                                  <td className="monospace-val" style={{ padding: '8px', textAlign: 'center', fontWeight: '500' }}>
                                    {item.correctCount !== undefined ? `${correct}/${total}` : 'N/A'}
                                  </td>
                                  <td style={{ padding: '8px', textAlign: 'center' }}>
                                    {item.correctCount !== undefined ? (
                                      <span style={{
                                        padding: '2px 8px',
                                        borderRadius: '4px',
                                        fontSize: '0.75rem',
                                        background: rate >= 80 ? 'rgba(16, 185, 129, 0.15)' : rate >= 50 ? 'rgba(245, 158, 11, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                                        color: rate >= 80 ? 'var(--color-success)' : rate >= 50 ? 'var(--color-warning)' : 'var(--color-danger)',
                                        fontWeight: 'bold'
                                      }}>
                                        {rate}%
                                      </span>
                                    ) : (
                                      <span style={{ color: 'var(--text-muted)' }}>N/A</span>
                                    )}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 3: QUESTIONS BANK (LEGAL CODES) */}
        {activeTab === 'questions' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', marginBottom: '24px' }}>
              <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                <button className="btn-secondary" onClick={handleExportCSV} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', padding: '10px 16px' }}>
                  📥 Xuất Excel (CSV)
                </button>
                <label className="btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', cursor: 'pointer', padding: '10px 16px' }}>
                  📤 Nhập Excel (CSV)
                  <input
                    type="file"
                    accept=".csv"
                    onChange={handleImportCSV}
                    style={{ display: 'none' }}
                  />
                </label>
                <button className="btn-primary" onClick={() => setIsQuestionFormOpen(!isQuestionFormOpen)} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '10px 16px' }}>
                  <Plus size={16} />
                  Thêm câu hỏi mới
                </button>
              </div>
            </div>

            {isQuestionFormOpen && (
              <form onSubmit={handleCreateQuestion} className="glass-panel animate-fade-in" style={{ padding: '24px', marginBottom: '32px', border: '1px solid var(--color-primary-glow)' }}>
                <h3 style={{ marginBottom: '20px', color: 'var(--color-primary)', fontSize: '1.1rem', textTransform: 'uppercase' }}>TẠO CÂU HỎI TRẮC NGHIỆM MỚI</h3>

                <div style={{ marginBottom: '16px' }}>
                  <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Câu hỏi</label>
                  <input
                    type="text"
                    required
                    placeholder="Nhập nội dung câu hỏi..."
                    className="input-field"
                    value={questionForm.text || ''}
                    onChange={(e) => setQuestionForm({ ...questionForm, text: e.target.value })}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                  {questionForm.options?.map((opt, idx) => (
                    <div key={idx}>
                      <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                        Đáp án {String.fromCharCode(65 + idx)}
                      </label>
                      <input
                        type="text"
                        required
                        placeholder={`Đáp án ${idx + 1}`}
                        className="input-field"
                        value={opt}
                        onChange={(e) => {
                          const newOpts = [...(questionForm.options || [])];
                          newOpts[idx] = e.target.value;
                          setQuestionForm({ ...questionForm, options: newOpts });
                        }}
                      />
                    </div>
                  ))}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '150px 1fr', gap: '16px', marginBottom: '20px' }}>
                  <div>
                    <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Đáp án ĐÚNG</label>
                    <select
                      className="input-field"
                      style={{ height: '47px', background: '#050915' }}
                      value={questionForm.correctOption}
                      onChange={(e) => setQuestionForm({ ...questionForm, correctOption: Number(e.target.value) })}
                    >
                      <option value={0}>A</option>
                      <option value={1}>B</option>
                      <option value={2}>C</option>
                      <option value={3}>D</option>
                    </select>
                  </div>
                  <div>
                    <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Giải thích pháp lý</label>
                    <input
                      type="text"
                      required
                      placeholder="Giải thích vì sao đúng..."
                      className="input-field"
                      value={questionForm.explanation || ''}
                      onChange={(e) => setQuestionForm({ ...questionForm, explanation: e.target.value })}
                    />
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                  <button type="button" className="btn-secondary" onClick={() => setIsQuestionFormOpen(false)}>Hủy</button>
                  <button type="submit" className="btn-primary">Lưu câu hỏi</button>
                </div>
              </form>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {currentQuestions.map((q) => (
                <div key={q.id} className="glass-panel" style={{ padding: '20px', border: '1px solid rgba(0, 242, 254, 0.12)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                    <h4 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#fff', maxWidth: '90%' }}>{q.text}</h4>
                    <button onClick={() => handleDeleteQuestion(q.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px' }}>
                      <Trash2 size={14} style={{ color: '#ef4444' }} />
                    </button>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px', marginBottom: '16px' }}>
                    {q.options.map((opt, oIdx) => {
                      const isCorrect = q.correctOption === oIdx;
                      return (
                        <div
                          key={oIdx}
                          style={{
                            padding: '10px 14px',
                            borderRadius: '6px',
                            background: isCorrect ? 'rgba(16, 185, 129, 0.08)' : 'rgba(5, 9, 21, 0.3)',
                            border: isCorrect ? '1px solid var(--color-success)' : '1px solid rgba(255,255,255,0.03)',
                            fontSize: '0.8rem',
                            color: isCorrect ? '#fff' : 'var(--text-secondary)'
                          }}
                        >
                          <strong style={{ color: isCorrect ? 'var(--color-success)' : 'var(--text-muted)', marginRight: '6px' }}>
                            {String.fromCharCode(65 + oIdx)}.
                          </strong>{' '}
                          {opt}
                        </div>
                      );
                    })}
                  </div>

                  <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', background: 'rgba(5,9,21,0.4)', padding: '10px 14px', borderRadius: '6px', borderLeft: '3px solid var(--color-primary)' }}>
                    <strong>Giải thích điều luật:</strong> {q.explanation}
                  </p>
                </div>
              ))}
            </div>

            {/* Pagination Controls */}
            {totalQuestionsPages > 1 && (
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginTop: '24px',
                fontSize: '0.85rem',
                color: 'var(--text-muted)',
                background: 'rgba(10, 15, 30, 0.4)',
                padding: '12px 20px',
                borderRadius: '6px',
                border: '1px solid rgba(0, 242, 254, 0.08)'
              }}>
                <span>
                  Hiển thị <strong style={{ color: '#fff' }}>{indexOfFirstQuestion + 1}-{Math.min(indexOfLastQuestion, questions.length)}</strong> trên tổng số <strong style={{ color: '#fff' }}>{questions.length}</strong> câu hỏi
                </span>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <button
                    onClick={() => setQuestionsCurrentPage(prev => Math.max(prev - 1, 1))}
                    disabled={currentQuestionsPageSafe === 1}
                    style={{
                      background: currentQuestionsPageSafe === 1 ? 'transparent' : 'rgba(0, 242, 254, 0.1)',
                      border: '1px solid rgba(0, 242, 254, 0.2)',
                      color: currentQuestionsPageSafe === 1 ? 'rgba(255,255,255,0.2)' : 'var(--color-primary)',
                      padding: '6px 12px',
                      borderRadius: '4px',
                      cursor: currentQuestionsPageSafe === 1 ? 'not-allowed' : 'pointer',
                      fontSize: '0.85rem',
                      fontWeight: 700,
                      transition: 'all 0.2s'
                    }}
                  >
                    TRƯỚC
                  </button>

                  {Array.from({ length: totalQuestionsPages }, (_, i) => i + 1).map(page => (
                    <button
                      key={page}
                      onClick={() => setQuestionsCurrentPage(page)}
                      style={{
                        background: page === currentQuestionsPageSafe ? 'var(--color-primary)' : 'rgba(255,255,255,0.03)',
                        border: '1px solid rgba(255,255,255,0.05)',
                        color: page === currentQuestionsPageSafe ? '#080d16' : '#fff',
                        padding: '6px 12px',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontSize: '0.85rem',
                        fontWeight: 700,
                        transition: 'all 0.2s'
                      }}
                    >
                      {page.toString().padStart(2, '0')}
                    </button>
                  ))}

                  <button
                    onClick={() => setQuestionsCurrentPage(prev => Math.min(prev + 1, totalQuestionsPages))}
                    disabled={currentQuestionsPageSafe === totalQuestionsPages}
                    style={{
                      background: currentQuestionsPageSafe === totalQuestionsPages ? 'transparent' : 'rgba(0, 242, 254, 0.1)',
                      border: '1px solid rgba(0, 242, 254, 0.2)',
                      color: currentQuestionsPageSafe === totalQuestionsPages ? 'rgba(255,255,255,0.2)' : 'var(--color-primary)',
                      padding: '6px 12px',
                      borderRadius: '4px',
                      cursor: currentQuestionsPageSafe === totalQuestionsPages ? 'not-allowed' : 'pointer',
                      fontSize: '0.85rem',
                      fontWeight: 700,
                      transition: 'all 0.2s'
                    }}
                  >
                    SAU
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 4: USERS MANAGEMENT */}
        {activeTab === 'users' && (
          <div>
            {/* Tiêu đề đã được hiển thị trên Header chung */}

            <div className="glass-panel" style={{ padding: '28px', border: '1px solid rgba(0, 242, 254, 0.12)' }}>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem', textAlign: 'left' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)', color: 'var(--text-muted)', textTransform: 'uppercase', fontSize: '0.75rem', letterSpacing: '1px' }}>
                      <th style={{ padding: '12px 8px' }}>Tên đăng nhập</th>
                      <th style={{ padding: '12px 8px' }}>Email</th>
                      <th style={{ padding: '12px 8px' }}>Hình thức đăng ký</th>
                      <th style={{ padding: '12px 8px' }}>Vai trò hiện tại</th>
                      <th style={{ padding: '12px 8px', textAlign: 'right' }}>Thao tác nâng cấp</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.length === 0 ? (
                      <tr>
                        <td colSpan={5} style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)' }}>
                          Chưa có tài khoản nào đăng ký trong hệ thống.
                        </td>
                      </tr>
                    ) : (
                      users.map((u) => {
                        const isGoogle = !!u.googleId;
                        const registerType = isGoogle ? 'Google Login' : 'Mật khẩu thường';
                        const roleLabel = u.role === 'presenter' ? 'Giảng viên' : 'Học viên';
                        const roleColor = u.role === 'presenter' ? '#00f2fe' : '#a1a1aa';

                        return (
                          <tr key={u.username} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)', transition: 'background 0.2s' }}>
                            <td className="monospace-val" style={{ padding: '16px 8px', color: '#fff', fontWeight: 600 }}>{u.username}</td>
                            <td style={{ padding: '16px 8px', color: 'var(--text-secondary)' }}>{u.email || 'Không có'}</td>
                            <td style={{ padding: '16px 8px' }}>
                              <span style={{
                                background: 'rgba(5, 9, 21, 0.6)',
                                border: '1px solid rgba(255, 255, 255, 0.05)',
                                color: isGoogle ? '#4facfe' : 'var(--text-secondary)',
                                padding: '4px 8px',
                                borderRadius: '4px',
                                fontSize: '0.75rem',
                                fontWeight: 600
                              }}>
                                {registerType}
                              </span>
                            </td>
                            <td style={{ padding: '16px 8px' }}>
                              <span style={{ color: roleColor, fontWeight: 'bold' }}>{roleLabel}</span>
                            </td>
                            <td style={{ padding: '16px 8px', textAlign: 'right' }}>
                              {u.username.toLowerCase() === 'admin' ? (
                                <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem', fontStyle: 'italic' }}>Mặc định hệ thống</span>
                              ) : (
                                <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                                  {u.role === 'student' ? (
                                    <button
                                      className="btn-primary"
                                      onClick={() => handleUpdateUserRole(u.username, 'presenter')}
                                      style={{ padding: '6px 12px', fontSize: '0.75rem', background: '#00b894', color: '#000', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
                                    >
                                      Nâng cấp lên Giảng viên
                                    </button>
                                  ) : (
                                    <button
                                      className="btn-secondary"
                                      onClick={() => handleUpdateUserRole(u.username, 'student')}
                                      style={{ padding: '6px 12px', fontSize: '0.75rem', color: '#ef4444', borderColor: 'rgba(239, 68, 68, 0.2)', background: 'transparent', cursor: 'pointer' }}
                                    >
                                      Hạ cấp xuống Học viên
                                    </button>
                                  )}
                                </div>
                              )}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};
