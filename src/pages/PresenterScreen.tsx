import React, { useState, useEffect } from 'react';
import { Play, Pause, FastForward, Users, Clock, Award, CheckCircle, HelpCircle, LogOut, Video, BookOpen, Check, Shield, Bell, User, Lock, Unlock, BarChart2, CornerDownRight } from 'lucide-react';
import type { UseSocketReturn } from '../hooks/useSocket';

interface PresenterScreenProps {
  pin: string;
  socketReturn: UseSocketReturn;
  onExit: () => void;
}

interface Student {
  socketId: string;
  name: string;
  classCode: string;
}

export const PresenterScreen: React.FC<PresenterScreenProps> = ({ pin, socketReturn, onExit }) => {
  const { on, off, emit } = socketReturn;

  // Sync state
  const [participants, setParticipants] = useState<Student[]>([]);
  const [sessionPhase, setSessionPhase] = useState<'lobby' | 'video' | 'situation' | 'quiz' | 'leaderboard'>('lobby');
  const [timer, setTimer] = useState(0);
  const [isTimerRunning, setIsTimerRunning] = useState(true);

  // Content Data
  const [playlistTitle, setPlaylistTitle] = useState('');
  const [videoUrl, setVideoUrl] = useState('');
  const [storyText, setStoryText] = useState('');
  const [situationTitle, setSituationTitle] = useState('');
  const [situationText, setSituationText] = useState('');
  const [situationQuestion, setSituationQuestion] = useState('');

  // Quiz questions State
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(-1);
  const [questionText, setQuestionText] = useState('');
  const [options, setOptions] = useState<string[]>([]);
  const [questionTimer, setQuestionTimer] = useState(15);
  const [totalQuestions, setTotalQuestions] = useState(5);
  
  // Real-time answers state for the chart
  const [totalAnswered, setTotalAnswered] = useState(0);
  const [answerDistribution, setAnswerDistribution] = useState<number[]>([0, 0, 0, 0]);
  const [showQuestionResult, setShowQuestionResult] = useState(false);
  const [correctOption, setCorrectOption] = useState(-1);
  const [explanation, setExplanation] = useState('');

  // Final Leaderboard
  const [leaderboard, setLeaderboard] = useState<{ name: string; class: string; score: number }[]>([]);
  const [serverIp, setServerIp] = useState('');

  // Calculate join URL using computer's local IP address
  const protocol = window.location.protocol;
  const port = window.location.port ? `:${window.location.port}` : '';
  const currentHost = serverIp && serverIp !== 'localhost' ? `${serverIp}${port}` : window.location.host;
  const joinUrl = `${protocol}//${currentHost}/?pin=${pin}`;
  const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(joinUrl)}`;

  useEffect(() => {
    // Register as host
    emit('join-host', { pin });

    on('host-joined-success', (session: any) => {
      setPlaylistTitle(session.playlistTitle || 'Đang tải...');
      if (session.serverIp) {
        setServerIp(session.serverIp);
      }
      // Sync participants if reconnected
      if (session.participants) {
        const list = Object.entries(session.participants).map(([sid, p]: [string, any]) => ({
          socketId: sid,
          name: p.name,
          classCode: p.class
        }));
        setParticipants(list);
      }
    });

    on('student-joined', (student: Student) => {
      setParticipants((prev) => {
        if (prev.some((s) => s.socketId === student.socketId)) return prev;
        return [...prev, student];
      });
    });

    on('student-left', (data: { socketId: string }) => {
      setParticipants((prev) => prev.filter((s) => s.socketId !== data.socketId));
    });

    on('timer-tick', (data: { timer: number }) => {
      setTimer(data.timer);
    });

    on('timer-paused', () => {
      setIsTimerRunning(false);
    });

    // Listen for phase change from server
    on('phase-change', (data: any) => {
      const { phase } = data;
      setSessionPhase(phase);
      setIsTimerRunning(true);

      if (phase === 'video') {
        setTimer(data.timer);
        setPlaylistTitle(data.playlistTitle);
        setVideoUrl(data.videoUrl);
        setStoryText(data.storyText);
      } else if (phase === 'situation') {
        setTimer(data.timer);
        setSituationTitle(data.situationTitle);
        setSituationText(data.situationText);
        setSituationQuestion(data.situationQuestion);
      } else if (phase === 'quiz') {
        setTotalQuestions(data.totalQuestions);
        setShowQuestionResult(false);
      } else if (phase === 'leaderboard') {
        setLeaderboard(data.leaderboard);
      }
    });

    // Show quiz question
    on('show-question', (data: { questionIndex: number; text: string; options: string[]; timeLimit: number }) => {
      setSessionPhase('quiz');
      setCurrentQuestionIndex(data.questionIndex);
      setQuestionText(data.text);
      setOptions(data.options);
      setQuestionTimer(data.timeLimit);
      setTotalAnswered(0);
      setAnswerDistribution([0, 0, 0, 0]);
      setShowQuestionResult(false);
    });

    // Student answered update
    on('student-answered-update', (data: { totalAnswered: number; answerDistribution: number[] }) => {
      setTotalAnswered(data.totalAnswered);
      setAnswerDistribution(data.answerDistribution);
    });

    // Listen for intermediate or final answers to display
    on('answer-result', (data: any) => {
      setCorrectOption(data.correctOption);
      setExplanation(data.explanation);
    });

    on('show-explanation', (data: any) => {
      setCorrectOption(data.correctOption);
      setExplanation(data.explanation);
      setShowQuestionResult(true);
    });

    on('game-over', (data: { leaderboard: any[] }) => {
      setSessionPhase('leaderboard');
      setLeaderboard(data.leaderboard);
    });

    return () => {
      off('host-joined-success');
      off('student-joined');
      off('student-left');
      off('timer-tick');
      off('timer-paused');
      off('phase-change');
      off('show-question');
      off('student-answered-update');
      off('answer-result');
      off('show-explanation');
      off('game-over');
    };
  }, [pin, on, off, emit]);

  // Quiz timer count down in React
  useEffect(() => {
    if (sessionPhase !== 'quiz' || showQuestionResult || questionTimer <= 0) {
      if (questionTimer === 0 && !showQuestionResult) {
        setShowQuestionResult(true);
      }
      return;
    }

    const qInterval = setInterval(() => {
      setQuestionTimer((prev) => prev - 1);
    }, 1000);

    return () => clearInterval(qInterval);
  }, [sessionPhase, questionTimer, showQuestionResult]);

  const handleStart = () => {
    emit('start-session', { pin });
  };

  const handleNextQuestion = () => {
    emit('next-question', { pin });
  };

  const handleSkipToLeaderboard = () => {
    emit('skip-to-leaderboard', { pin });
  };

  const handleTimerControl = (action: 'pause' | 'resume' | 'skip') => {
    emit('control-timer', { pin, action });
    if (action === 'pause') setIsTimerRunning(false);
    if (action === 'resume') setIsTimerRunning(true);
  };

  // Format PIN code: 123456 -> 123-456
  const formatPin = (rawPin: string) => {
    if (rawPin.length === 6) {
      return `${rawPin.slice(0, 3)}-${rawPin.slice(3)}`;
    }
    return rawPin;
  };

  // Circular Countdown Ring Parameters
  const ringRadius = 70;
  const ringCircumference = 2 * Math.PI * ringRadius;
  const maxSituationTime = 45; // 45s
  const strokeDashoffset = ringCircumference - (Math.min(timer, maxSituationTime) / maxSituationTime) * ringCircumference;

  return (
    <div style={{ 
      minHeight: '100vh', 
      display: 'flex', 
      flexDirection: 'column', 
      background: '#070c14',
      backgroundImage: 'radial-gradient(circle at center, #0B132B 0%, #070B16 100%)',
      paddingBottom: '100px',
      color: '#fff',
      fontFamily: 'var(--font-body)'
    }}>
      
      {/* Dynamic Scanline Grid Decorative */}
      <div style={{
        position: 'fixed',
        inset: 0,
        background: 'linear-gradient(rgba(18, 16, 16, 0) 50%, rgba(0, 0, 0, 0.15) 50%), linear-gradient(90deg, rgba(0, 242, 254, 0.03), rgba(0, 0, 0, 0), rgba(0, 242, 254, 0.03))',
        backgroundSize: '100% 4px, 6px 100%',
        zIndex: 999,
        pointerEvents: 'none',
        opacity: 0.3
      }} />

      {/* TOP HEADER BAR (Matching Screenshot 3) */}
      <header style={{ 
        padding: '16px 24px', 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        borderBottom: '1px solid rgba(0, 242, 254, 0.15)',
        background: '#090f1a'
      }}>
        {/* Left Scales Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {/* Scales Icon */}
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 3V21M12 3L6 8M12 3L18 8M3 13C3 13 6 12 9 13M9 13L9 19C9 20 8 21 6 21C4 21 3 20 3 19L3 13ZM15 13C15 13 18 12 21 13M21 13L21 19C21 20 20 21 18 21C16 21 15 20 15 19L15 13Z" stroke="var(--color-primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          <h2 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#fff', letterSpacing: '0.5px' }}>
            PHÁP LUẬT 3 PHÚT - TRUNG ĐOÀN 1
          </h2>
        </div>

        {/* Center Progress Timeline Bar (Matching Screenshot 3) */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px', width: '40%', position: 'relative' }}>
          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            width: '100%', 
            fontSize: '0.75rem', 
            color: 'var(--text-secondary)', 
            fontWeight: 700,
            position: 'absolute',
            top: '-20px',
            left: 0
          }}>
            <span style={{ color: sessionPhase === 'video' ? 'var(--color-primary)' : 'var(--text-secondary)' }}>Video 01:30</span>
            <span style={{ color: sessionPhase === 'situation' ? 'var(--color-primary)' : 'var(--text-secondary)' }}>Tình huống 00:45</span>
            <span style={{ color: sessionPhase === 'quiz' ? 'var(--color-primary)' : 'var(--text-secondary)' }}>Trắc nghiệm 00:45</span>
          </div>
          <div className="timeline-track" style={{ background: 'rgba(255,255,255,0.06)' }}>
            <div className="timeline-fill" style={{ 
              width: sessionPhase === 'lobby' ? '0%' : sessionPhase === 'video' ? '30%' : sessionPhase === 'situation' ? '65%' : '100%',
              background: 'var(--color-primary)'
            }} />
          </div>
        </div>

        {/* Right Status Info */}
        <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
          {/* PIN */}
          <div className="monospace-val" style={{ 
            fontSize: '0.85rem', 
            border: '1px solid rgba(0, 242, 254, 0.25)', 
            padding: '4px 10px', 
            borderRadius: '4px', 
            background: 'rgba(0, 242, 254, 0.05)',
            color: 'var(--color-primary)',
            fontWeight: 800
          }}>
            PIN: {formatPin(pin)}
          </div>
          
          {/* Online count */}
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '6px', 
            fontSize: '0.8rem', 
            fontWeight: 700, 
            background: 'rgba(16, 185, 129, 0.1)', 
            border: '1px solid rgba(16, 185, 129, 0.25)',
            padding: '4px 10px',
            borderRadius: '12px',
            color: 'var(--color-success)'
          }}>
            <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: 'var(--color-success)' }} />
            {participants.length} Học viên
          </div>

          <Bell size={18} style={{ color: 'var(--text-secondary)', cursor: 'pointer' }} />
          <User size={18} style={{ color: 'var(--text-secondary)', cursor: 'pointer' }} />
        </div>
      </header>

      {/* MAIN PROJECTOR CONTENT VIEW */}
      <main style={{ flex: 1, padding: '40px 24px 24px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
        
        {/* PHASE 0: LOBBY */}
        {sessionPhase === 'lobby' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '40px', alignItems: 'center', maxWidth: '1200px', margin: '0 auto', width: '100%' }}>
            {/* Left QR instructions */}
            <div className="glass-panel-glow animate-fade-in" style={{ padding: '40px', textAlign: 'center', border: '1px solid var(--border-color-glow)' }}>
              <h1 className="text-glow-primary" style={{ fontSize: '2.5rem', marginBottom: '8px', color: '#fff', letterSpacing: '1px' }}>KẾT NỐI HỌC VIÊN</h1>
              <p style={{ color: 'var(--text-secondary)', marginBottom: '32px', fontSize: '0.95rem' }}>
                Quét mã QR bằng Camera điện thoại để đăng nhập tham gia huấn luyện nhanh.
              </p>

              <div style={{ background: '#fff', padding: '16px', borderRadius: '10px', display: 'inline-block', marginBottom: '28px', border: '2px solid var(--color-primary)' }}>
                <img src={qrCodeUrl} alt="QR Code" style={{ width: '220px', height: '220px', display: 'block' }} />
              </div>

              <div style={{ fontSize: '1rem', color: 'var(--text-secondary)' }}>
                ĐƯỜNG DẪN TRỰC TIẾP:
                <div className="monospace-val" style={{ color: 'var(--color-primary)', fontSize: '1.15rem', marginTop: '8px', letterSpacing: '0.5px' }}>
                  {joinUrl}
                </div>
              </div>
            </div>

            {/* Right student waiting list */}
            <div className="glass-panel" style={{ padding: '32px', height: '480px', display: 'flex', flexDirection: 'column', border: '1px solid rgba(0, 242, 254, 0.15)' }}>
              <h3 style={{ borderBottom: '1px solid rgba(0, 242, 254, 0.2)', paddingBottom: '16px', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '1.2rem', color: 'var(--color-primary)' }}>
                <Users size={20} />
                HỌC VIÊN ĐÃ ĐIỂM DANH ({participants.length})
              </h3>
              
              {participants.length === 0 ? (
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', gap: '16px' }}>
                  <div className="animate-pulse-glow" style={{ width: '12px', height: '12px', borderRadius: '50%', backgroundColor: 'var(--color-primary)' }} />
                  <span style={{ fontSize: '0.95rem', letterSpacing: '1px', textTransform: 'uppercase' }}>Đang chờ kết nối từ binh sĩ...</span>
                </div>
              ) : (
                <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexWrap: 'wrap', gap: '10px', alignContent: 'flex-start' }}>
                  {participants.map((student) => (
                    <div 
                      key={student.socketId} 
                      className="glass-panel animate-fade-in" 
                      style={{ 
                        padding: '10px 16px', 
                        borderRadius: '6px', 
                        background: 'rgba(0, 242, 254, 0.05)', 
                        border: '1px solid rgba(0, 242, 254, 0.2)',
                        fontSize: '0.85rem',
                        fontWeight: 600,
                        color: '#fff',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px'
                      }}
                    >
                      <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: 'var(--color-success)' }} />
                      {student.name} <span style={{ color: 'var(--color-primary)', fontSize: '0.75rem', fontWeight: 700 }}>[{student.classCode}]</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* PHASE 1: VIDEO */}
        {sessionPhase === 'video' && (() => {
          const backendHost = window.location.hostname;
          const backendUrl = `http://${backendHost}:5000`;
          const isLocalVideo = videoUrl ? videoUrl.startsWith('/uploads/') : false;
          const resolvedVideoUrl = isLocalVideo ? `${backendUrl}${videoUrl}` : videoUrl;

          return (
            <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: '32px', height: '520px', maxWidth: '1200px', margin: '0 auto', width: '100%' }}>
              {/* Video Box */}
              <div className="glass-panel" style={{ padding: '16px', overflow: 'hidden', display: 'flex', flexDirection: 'column', justifyContent: 'center', background: '#050915', border: '1px solid rgba(0, 242, 254, 0.2)' }}>
                {videoUrl ? (
                  isLocalVideo ? (
                    <video
                      src={resolvedVideoUrl}
                      controls
                      autoPlay
                      style={{ width: '100%', height: '100%', borderRadius: '8px', flex: 1, objectFit: 'contain' }}
                    />
                  ) : (
                    <iframe
                      width="100%"
                      height="100%"
                      src={resolvedVideoUrl}
                      title="YouTube video player"
                      frameBorder="0"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                      allowFullScreen
                      style={{ borderRadius: '8px', flex: 1 }}
                    />
                  )
                ) : (
                  <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', color: 'var(--text-muted)' }}>
                    Trình phát Video tư liệu
                  </div>
                )}
              </div>
  
              {/* Story narration */}
              <div className="glass-panel" style={{ padding: '32px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', borderLeft: '4px solid var(--color-primary)' }}>
                <div>
                  <span style={{ fontSize: '0.8rem', color: 'var(--color-primary)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                    PHÚT 1: CÂU CHUYỆN BÁC HỒ & DẪN NHẬP
                  </span>
                  <h3 style={{ fontSize: '1.6rem', margin: '12px 0 20px', fontWeight: 700, color: '#fff' }}>{playlistTitle || 'Thông điệp học tập'}</h3>
                  <div style={{ maxHeight: '300px', overflowY: 'auto', paddingRight: '8px' }}>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '1rem', lineHeight: '1.8', whiteSpace: 'pre-line' }}>
                      {storyText}
                    </p>
                  </div>
                </div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', borderTop: '1px solid rgba(0,242,254,0.15)', paddingTop: '16px' }}>
                  <span>* Video dẫn nhập (90 giây). Học viên quan sát trước khi thảo luận tình huống.</span>
                </div>
              </div>
            </div>
          );
        })()}

        {/* PHASE 2: LEGAL SITUATION (MATCHING SCREENSHOT 3 EXACTLY) */}
        {sessionPhase === 'situation' && (
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: '1.5fr 1fr', 
            gap: '32px', 
            height: '520px', 
            maxWidth: '1200px', 
            margin: '0 auto', 
            width: '100%',
            border: '1.5px solid rgba(0, 242, 254, 0.3)',
            borderRadius: '12px',
            padding: '32px',
            background: 'rgba(10, 18, 36, 0.8)',
            // Cyber Grid Lines matching Screenshot 3 background
            backgroundImage: 'linear-gradient(rgba(0,242,254,0.015) 1px, transparent 1px), linear-gradient(90deg, rgba(0,242,254,0.015) 1px, transparent 1px)',
            backgroundSize: '20px 20px'
          }}>
            
            {/* Left Column (Situation Texts) */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', justifyContent: 'center' }}>
              {/* Red warning warning badge */}
              <div style={{ display: 'inline-flex', alignSelf: 'flex-start', border: '1px solid rgba(239, 68, 68, 0.4)', color: '#ef4444', padding: '4px 10px', fontSize: '0.75rem', fontWeight: 800, borderRadius: '4px', background: 'rgba(239, 68, 68, 0.1)', gap: '6px', alignItems: 'center' }}>
                <span>⚠</span> TÌNH HUỐNG THỰC TẾ
              </div>

              {/* Title */}
              <h2 style={{ fontSize: '1.55rem', fontWeight: 700, color: '#fff', lineHeight: '1.45', fontFamily: 'var(--font-heading)' }}>
                {situationTitle || 'Binh nhì Nguyễn Văn A rời khỏi đơn vị trong giờ nghỉ mà không báo cáo chỉ huy trực tiếp.'}
              </h2>

              {/* Case Details Box */}
              <div style={{ 
                borderLeft: '4px solid #f87171', 
                background: 'rgba(255,255,255,0.02)', 
                padding: '16px 20px', 
                borderRadius: '0 8px 8px 0',
                border: '1px solid rgba(255,255,255,0.02)',
                borderLeftWidth: '4px'
              }}>
                <span style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 700, display: 'block', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  CHI TIẾT SỰ VIỆC
                </span>
                <p style={{ fontSize: '0.9rem', color: '#cbd5e1', lineHeight: '1.6' }}>
                  {situationText || 'Vào lúc 14h00 ngày Chủ Nhật, trong khung giờ tự do tại doanh trại, Binh nhì A đã tự ý ra ngoài cổng gác để gặp người nhà nhận đồ tiếp tế trong 15 phút. Khi quay lại, A bị Vệ binh phát hiện lập biên bản.'}
                </p>
              </div>

              {/* Debate Question Box */}
              <div style={{ 
                borderLeft: '4px solid #f87171', 
                background: 'rgba(255,255,255,0.02)', 
                padding: '16px 20px', 
                borderRadius: '0 8px 8px 0',
                border: '1px solid rgba(255,255,255,0.02)',
                borderLeftWidth: '4px'
              }}>
                <span style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 700, display: 'block', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  CÂU HỎI TRANH BIỆN:
                </span>
                <p style={{ fontSize: '1.05rem', color: '#fff', fontWeight: 700, lineHeight: '1.5' }}>
                  {situationQuestion || 'Hành vi của Binh nhì A có cấu thành hành vi phạm kỷ luật "Vắng mặt trái phép" hay không? Vì sao?'}
                </p>
              </div>
            </div>

            {/* Right Column (Countdown Arc & Discussion stats) */}
            <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', alignItems: 'stretch', paddingLeft: '24px' }}>
              
              {/* Sys lock / Phase info text */}
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600, letterSpacing: '0.5px' }}>
                <span>HỆ THỐNG: KHÓA</span>
                <span>GIAI ĐOẠN: 02/03</span>
              </div>

              {/* Large Timer Countdown Circle Ring */}
              <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', flex: 1 }}>
                <div style={{ position: 'relative', width: '180px', height: '180px' }}>
                  <svg style={{ transform: 'rotate(-90deg)', width: '180px', height: '180px' }}>
                    {/* Gray back circle */}
                    <circle
                      cx="90"
                      cy="90"
                      r="76"
                      fill="transparent"
                      stroke="rgba(255, 255, 255, 0.05)"
                      strokeWidth="6"
                    />
                    {/* Cyan progress arc */}
                    <circle
                      cx="90"
                      cy="90"
                      r="76"
                      fill="transparent"
                      stroke="#00F2FE"
                      strokeWidth="6"
                      strokeDasharray="477.5"
                      strokeDashoffset={477.5 - (Math.min(timer, 45) / 45) * 477.5}
                      strokeLinecap="round"
                      style={{ transition: 'stroke-dashoffset 1s linear', filter: 'drop-shadow(0 0 6px rgba(0, 242, 254, 0.45))' }}
                    />
                  </svg>
                  {/* Values in center */}
                  <div style={{
                    position: 'absolute',
                    inset: 0,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    <span className="monospace-val" style={{ fontSize: '3.6rem', color: '#fff', fontWeight: 800, lineHeight: 1 }}>
                      {timer}
                    </span>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', textTransform: 'uppercase', marginTop: '6px', letterSpacing: '1px' }}>
                      GIÂY
                    </span>
                  </div>
                </div>
              </div>

              {/* Discussion stats Glass Card */}
              <div>
                <div style={{ 
                  background: 'rgba(5, 9, 21, 0.4)', 
                  border: '1px solid rgba(0, 242, 254, 0.15)', 
                  padding: '12px 18px', 
                  borderRadius: '6px', 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  alignItems: 'center',
                  marginBottom: '10px'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                    <Users size={16} />
                    <span>Đang thảo luận</span>
                  </div>
                  <strong style={{ color: 'var(--color-success)', fontSize: '0.9rem' }}>
                    {Math.floor(participants.length * 0.9) || 0}/{participants.length} Sẵn sàng
                  </strong>
                </div>

                <div style={{ textAlign: 'center', fontSize: '0.75rem', color: 'rgba(255,255,255,0.3)', letterSpacing: '0.5px' }}>
                  ĐANG GHI NHẬN Ý KIẾN TỪ THIẾT BỊ HỌC VIÊN...
                </div>
              </div>

            </div>

          </div>
        )}

        {/* PHASE 3: LIVE QUIZ */}
        {sessionPhase === 'quiz' && (
          <div style={{ display: 'flex', flexDirection: 'column', height: '100%', justifyContent: 'space-between', minHeight: '520px', maxWidth: '1200px', margin: '0 auto', width: '100%' }}>
            
            {/* Question Panel */}
            <div className="glass-panel" style={{ padding: '24px 32px', textAlign: 'center', marginBottom: '20px', border: '1px solid rgba(0, 242, 254, 0.25)' }}>
              <span style={{ fontSize: '0.8rem', background: 'rgba(0, 242, 254, 0.1)', border: '1px solid rgba(0, 242, 254, 0.25)', padding: '6px 14px', borderRadius: '4px', color: 'var(--color-primary)', fontWeight: 700 }}>
                CÂU HỎI {currentQuestionIndex + 1}/{totalQuestions}
              </span>
              <h2 style={{ fontSize: '1.65rem', marginTop: '16px', fontWeight: 700, color: '#fff' }}>{questionText}</h2>
            </div>

            {/* Answer Options & Chart Display */}
            <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '30px', flex: 1, alignItems: 'stretch' }}>
              
              {/* Option Blocks */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                {options.map((opt, idx) => {
                  const shapes = ['▲', '♦', '●', '■'];
                  const colors = ['#800000', '#00E5FF', '#FFD1A4', '#00A86B'];
                  const textColors = ['#fff', '#004D40', '#5D4037', '#004D40'];
                  const isCorrect = correctOption === idx;

                  return (
                    <div 
                      key={idx} 
                      style={{ 
                        padding: '24px', 
                        borderRadius: '12px', 
                        display: 'flex', 
                        alignItems: 'center', 
                        gap: '16px',
                        background: colors[idx],
                        color: textColors[idx],
                        fontSize: '1.1rem',
                        fontWeight: 700,
                        border: showQuestionResult && isCorrect ? '3px solid #fff' : '1px solid transparent',
                        boxShadow: showQuestionResult && isCorrect ? '0 0 20px rgba(255,255,255,0.4)' : '',
                        opacity: showQuestionResult && !isCorrect ? 0.25 : 1,
                        transition: 'all 0.3s ease'
                      }}
                    >
                      <span style={{ 
                        width: '38px', 
                        height: '38px', 
                        borderRadius: '6px', 
                        background: 'rgba(0,0,0,0.15)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '1.25rem',
                        color: textColors[idx]
                      }}>
                        {shapes[idx]}
                      </span>
                      <span>{opt}</span>
                    </div>
                  );
                })}
              </div>

              {/* Real-time stats Chart */}
              <div className="glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', border: '1px solid rgba(0, 242, 254, 0.2)' }}>
                
                {!showQuestionResult ? (
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}>
                    <div style={{ fontSize: '1rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px' }}>
                      Số câu trả lời đã thu nhận
                    </div>
                    <div className="monospace-val text-glow-primary" style={{ fontSize: '5rem', fontWeight: 800, color: 'var(--color-primary)' }}>
                      {totalAnswered}
                    </div>
                    <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>trong tổng số {participants.length} binh sĩ trực tuyến</div>
                  </div>
                ) : (
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                    
                    {/* Vertical Bar Chart */}
                    <div style={{ display: 'flex', height: '150px', alignItems: 'flex-end', justifyContent: 'space-around', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '12px', marginBottom: '16px' }}>
                      {answerDistribution.map((count, idx) => {
                        const colors = ['#ef4444', '#3b82f6', '#f59e0b', '#10b981'];
                        const labels = ['A', 'B', 'C', 'D'];
                        const maxVal = Math.max(...answerDistribution, 1);
                        const percentHeight = (count / maxVal) * 100;

                        return (
                          <div key={idx} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '40px' }}>
                            <span className="monospace-val" style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>{count}</span>
                            <div style={{ 
                              width: '24px', 
                              height: `${percentHeight}px`, 
                              backgroundColor: colors[idx], 
                              borderRadius: '4px',
                              minHeight: count > 0 ? '8px' : '2px',
                              transition: 'height 0.8s cubic-bezier(0.16, 1, 0.3, 1)',
                              boxShadow: count > 0 ? `0 0 10px ${colors[idx]}` : 'none'
                            }} />
                            <span style={{ fontSize: '0.9rem', fontWeight: 'bold', marginTop: '6px', color: colors[idx] }}>{labels[idx]}</span>
                          </div>
                        );
                      })}
                    </div>

                    {/* Explanation */}
                    <div style={{ background: 'rgba(16, 185, 129, 0.05)', border: '1px solid rgba(16, 185, 129, 0.25)', padding: '14px', borderRadius: '8px', display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                      <CheckCircle size={20} style={{ color: 'var(--color-success)', flexShrink: 0, marginTop: '2px' }} />
                      <div>
                        <strong style={{ color: 'var(--color-success)', fontSize: '0.85rem', display: 'block', marginBottom: '4px', letterSpacing: '0.5px' }}>
                          GIẢI THÍCH LUẬT ÁP DỤNG:
                        </strong>
                        <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: '1.45' }}>
                          {explanation || 'Đang đồng bộ giải thích...'}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Host Control Actions */}
                <div style={{ borderTop: '1px solid rgba(0, 242, 254, 0.15)', paddingTop: '16px', display: 'flex', gap: '12px' }}>
                  {showQuestionResult ? (
                    <button className="btn-primary" onClick={handleNextQuestion} style={{ flex: 1 }}>
                      CÂU HỎI TIẾP THEO
                      <FastForward size={16} />
                    </button>
                  ) : (
                    <button className="btn-secondary" onClick={() => setShowQuestionResult(true)} style={{ flex: 1, color: 'var(--color-warning)', borderColor: 'rgba(245, 158, 11, 0.4)' }}>
                      KẾT THÚC CÂU HỎI
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* PHASE 4: LEADERBOARD / PODIUMS */}
        {sessionPhase === 'leaderboard' && (
          <div className="glass-panel-glow animate-fade-in" style={{ padding: '40px', maxWidth: '800px', margin: '0 auto', width: '100%', textAlign: 'center', border: '1px solid var(--border-color-glow)' }}>
            <span style={{ fontSize: '3.5rem', display: 'block', marginBottom: '8px' }}>🏆</span>
            <h1 className="text-glow-primary" style={{ fontSize: '2.5rem', marginBottom: '32px', textTransform: 'uppercase', letterSpacing: '1px' }}>BẢNG VÀNG CHIẾN BINH</h1>

            {leaderboard.length === 0 ? (
              <div style={{ padding: '40px', color: 'var(--text-muted)' }}>Chưa có kết quả học viên.</div>
            ) : (
              <div>
                {/* 3D-like Podiums for Top 3 */}
                <div className="podium-container">
                  {/* 2nd Place */}
                  {leaderboard[1] && (
                    <div className="podium-step podium-2nd">
                      <div className="podium-badge badge-2nd">2</div>
                      <div className="podium-name" style={{ color: '#fff' }}>{leaderboard[1].name}</div>
                      <div className="podium-class">{leaderboard[1].class}</div>
                      <div className="podium-score monospace-val">{leaderboard[1].score} điểm</div>
                    </div>
                  )}

                  {/* 1st Place */}
                  {leaderboard[0] && (
                    <div className="podium-step podium-1st">
                      <div className="podium-badge badge-1st">1</div>
                      <div className="podium-name" style={{ fontSize: '1.15rem', color: '#fef08a', fontWeight: 'bold' }}>{leaderboard[0].name}</div>
                      <div className="podium-class">{leaderboard[0].class}</div>
                      <div className="podium-score monospace-val" style={{ fontSize: '1rem', color: '#fff' }}>{leaderboard[0].score} điểm</div>
                    </div>
                  )}

                  {/* 3rd Place */}
                  {leaderboard[2] && (
                    <div className="podium-step podium-3rd">
                      <div className="podium-badge badge-3rd">3</div>
                      <div className="podium-name" style={{ color: '#fff' }}>{leaderboard[2].name}</div>
                      <div className="podium-class">{leaderboard[2].class}</div>
                      <div className="podium-score monospace-val">{leaderboard[2].score} điểm</div>
                    </div>
                  )}
                </div>

                {/* List for 4th and 5th places */}
                {leaderboard.length > 3 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxWidth: '400px', margin: '20px auto 32px', textAlign: 'left' }}>
                    {leaderboard.slice(3, 5).map((player, idx) => (
                      <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 18px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(0, 242, 254, 0.1)', borderRadius: '8px', fontSize: '0.85rem' }}>
                        <span>
                          <strong style={{ color: 'var(--text-muted)', marginRight: '8px' }}>#{idx + 4}</strong>
                          <span style={{ color: '#fff', fontWeight: 600 }}>{player.name}</span> <span style={{ color: 'var(--text-secondary)', fontSize: '0.75rem' }}>({player.class})</span>
                        </span>
                        <strong className="monospace-val" style={{ color: 'var(--color-primary)' }}>{player.score} điểm</strong>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            <button className="btn-primary" onClick={onExit} style={{ marginTop: '24px', padding: '14px 40px' }}>
              KẾT THÚC HUẤN LUYỆN
            </button>
          </div>
        )}
      </main>

      {/* FLOATING CONTROL DOCK (MATCHING SCREENSHOT 3 EXACTLY) */}
      <footer className="glass-panel" style={{
        position: 'fixed',
        bottom: '20px',
        left: '50%',
        transform: 'translateX(-50%)',
        width: 'auto',
        padding: '10px 24px',
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        borderColor: 'rgba(0, 242, 254, 0.3)',
        boxShadow: '0 0 25px rgba(0, 242, 254, 0.25)',
        zIndex: 1000,
        background: 'rgba(10, 18, 30, 0.95)',
        borderRadius: '10px'
      }}>
        
        {/* Rewind (Lùi lại) */}
        <button 
          onClick={() => {
            if (sessionPhase === 'situation') {
              emit('control-timer', { pin, action: 'pause' });
              emit('join-host', { pin }); // refetch / re-sync
              setSessionPhase('video');
            }
          }}
          style={{
            background: 'transparent',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: '6px',
            color: 'rgba(255,255,255,0.7)',
            padding: '8px 14px',
            fontSize: '0.75rem',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}
        >
          <span>⏮</span> Lùi lại
        </button>

        {/* Pause/Resume (Tạm dừng - Active/Hover highlight style in Screenshot 3) */}
        {isTimerRunning ? (
          <button 
            onClick={() => handleTimerControl('pause')}
            style={{
              background: '#e6fffa',
              border: 'none',
              borderRadius: '6px',
              color: '#080d16',
              padding: '8px 14px',
              fontSize: '0.75rem',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <span>⏸</span> Tạm dừng
          </button>
        ) : (
          <button 
            onClick={() => handleTimerControl('resume')}
            style={{
              background: 'var(--color-primary)',
              border: 'none',
              borderRadius: '6px',
              color: '#080d16',
              padding: '8px 14px',
              fontSize: '0.75rem',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <span>▶</span> Tiếp tục
          </button>
        )}

        {/* Forward (Tiếp theo) */}
        <button 
          onClick={() => {
            if (sessionPhase === 'lobby') {
              handleStart();
            } else {
              handleTimerControl('skip');
            }
          }}
          style={{
            background: 'transparent',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: '6px',
            color: 'rgba(255,255,255,0.7)',
            padding: '8px 14px',
            fontSize: '0.75rem',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}
        >
          Tiếp theo <span>⏭</span>
        </button>

        {/* Divider */}
        <div style={{ width: '1px', height: '24px', backgroundColor: 'rgba(255,255,255,0.15)', margin: '0 4px' }} />

        {/* Padlock Icon */}
        <button 
          style={{
            background: 'transparent',
            border: 'none',
            color: 'rgba(255,255,255,0.6)',
            cursor: 'pointer',
            padding: '6px',
            display: 'flex',
            alignItems: 'center'
          }}
          title="Khóa bảo mật"
        >
          <Lock size={15} />
        </button>

        {/* Chart Icon */}
        <button 
          style={{
            background: 'transparent',
            border: 'none',
            color: 'rgba(255,255,255,0.6)',
            cursor: 'pointer',
            padding: '6px',
            display: 'flex',
            alignItems: 'center'
          }}
          title="Hiển thị ma trận kết quả"
        >
          <BarChart2 size={15} />
        </button>

        {/* Divider */}
        <div style={{ width: '1px', height: '24px', backgroundColor: 'rgba(255,255,255,0.15)', margin: '0 4px' }} />

        {/* Power Icon (Kết thúc) */}
        <button 
          onClick={onExit}
          style={{
            background: '#800000',
            border: 'none',
            borderRadius: '6px',
            color: '#fff',
            padding: '8px 14px',
            fontSize: '0.75rem',
            fontWeight: 700,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}
        >
          <span>⏻</span> Kết thúc
        </button>

      </footer>
    </div>
  );
};
