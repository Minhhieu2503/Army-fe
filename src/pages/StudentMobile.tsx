import React, { useState, useEffect } from 'react';
import { User, ShieldAlert, Award, Send, RefreshCw, Clock } from 'lucide-react';
import type { UseSocketReturn } from '../hooks/useSocket';

interface StudentMobileProps {
  socketReturn: UseSocketReturn;
  urlPin?: string;
  onExit: () => void;
  backendUrl: string;
}

export const StudentMobile: React.FC<StudentMobileProps> = ({ socketReturn, urlPin, onExit, backendUrl }) => {
  const { on, off, emit, isConnected } = socketReturn;

  // View state: 'join' | 'lobby' | 'video' | 'situation' | 'quiz_waiting' | 'quiz_answering' | 'quiz_answered' | 'quiz_result' | 'ended'
  const [gameState, setGameState] = useState<'join' | 'lobby' | 'video' | 'situation' | 'quiz_waiting' | 'quiz_answering' | 'quiz_answered' | 'quiz_result' | 'ended'>('join');

  // Input states
  const [pin, setPin] = useState(urlPin || '');
  const [name, setName] = useState('');
  const [classCode, setClassCode] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Active Quiz State
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(-1);
  const [questionText, setQuestionText] = useState('');
  const [options, setOptions] = useState<string[]>([]);
  const [answeredIndex, setAnsweredIndex] = useState<number | null>(null);
  const [questionTimer, setQuestionTimer] = useState(15);
  const [timeLimit, setTimeLimit] = useState(15);
  const [isTimerPaused, setIsTimerPaused] = useState(false);
  const [totalQuestions, setTotalQuestions] = useState(5);
  
  // Video and Situation details
  const [videoUrl, setVideoUrl] = useState('');
  const [storyText, setStoryText] = useState('');
  const [situationTitle, setSituationTitle] = useState('');
  const [situationText, setSituationText] = useState('');
  const [situationQuestion, setSituationQuestion] = useState('');
  
  // Quiz Feedback State
  const [lastResult, setLastResult] = useState<{
    isCorrect: boolean;
    pointsEarned: number;
    totalScore: number;
    correctOption: number;
    explanation: string;
  } | null>(null);
  const [totalScore, setTotalScore] = useState(0);
  const [rank, setRank] = useState<number>(-1);
  const [totalPlayers, setTotalPlayers] = useState<number>(0);

  useEffect(() => {
    // Listen for join confirmation
    on('join-success', () => {
      setGameState('lobby');
      setErrorMsg(null);
    });

    on('join-failed', (msg: string) => {
      setErrorMsg(msg);
    });

    // Listen for phase transitions
    on('phase-change', (data: any) => {
      const { phase } = data;
      if (phase === 'video') {
        setVideoUrl(data.videoUrl || '');
        setStoryText(data.storyText || '');
        setGameState('video');
      } else if (phase === 'situation') {
        setSituationTitle(data.situationTitle || '');
        setSituationText(data.situationText || '');
        setSituationQuestion(data.situationQuestion || '');
        setGameState('situation');
      } else if (phase === 'quiz') {
        setGameState('quiz_waiting');
        if (data.totalQuestions) setTotalQuestions(data.totalQuestions);
      } else if (phase === 'leaderboard') {
        setGameState('ended');
      }
    });

    // Listen for quiz questions
    on('show-question', (data: { questionIndex: number; text: string; options: string[]; timeLimit: number; totalQuestions?: number }) => {
      setCurrentQuestionIndex(data.questionIndex);
      setQuestionText(data.text);
      setOptions(data.options);
      setQuestionTimer(data.timeLimit);
      setTimeLimit(data.timeLimit || 15);
      setIsTimerPaused(false);
      if (data.totalQuestions) setTotalQuestions(data.totalQuestions);
      setAnsweredIndex(null);
      setLastResult(null);
      setGameState('quiz_answering');
    });

    on('timer-tick', (data: { timer: number }) => {
      setQuestionTimer(data.timer);
    });

    on('timer-paused', () => {
      setIsTimerPaused(true);
    });

    on('timer-resumed', () => {
      setIsTimerPaused(false);
    });

    // Listen for answer evaluation
    on('answer-result', (data: any) => {
      setLastResult(data);
      setTotalScore(data.totalScore);
      setGameState('quiz_result');
      if ('vibrate' in navigator) {
        navigator.vibrate(data.isCorrect ? [100, 50, 100] : [250]);
      }
    });

    on('game-over', (data?: { leaderboard: any[] }) => {
      if (data && data.leaderboard) {
        const lb = data.leaderboard;
        setTotalPlayers(lb.length);
        const myIndex = lb.findIndex((player: any) => player.name === name);
        if (myIndex !== -1) {
          setRank(myIndex + 1);
        } else {
          setRank(lb.length);
        }
      }
      setGameState('ended');
    });

    return () => {
      off('join-success');
      off('join-failed');
      off('phase-change');
      off('show-question');
      off('answer-result');
      off('game-over');
      off('timer-tick');
      off('timer-paused');
      off('timer-resumed');
    };
  }, [on, off, name]);

  // Handle local countdown for question on mobile
  useEffect(() => {
    if (gameState !== 'quiz_answering' || questionTimer <= 0 || isTimerPaused) return;

    const interval = setInterval(() => {
      setQuestionTimer((prev) => prev - 1);
    }, 1000);

    return () => clearInterval(interval);
  }, [gameState, questionTimer, isTimerPaused]);

  const handleJoin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!pin || !name || !classCode) {
      setErrorMsg('Vui lòng nhập đầy đủ thông tin.');
      return;
    }
    emit('join-student', { pin, name, classCode });
  };

  const handleAnswerSubmit = (optionIndex: number) => {
    if (answeredIndex !== null) return;
    setAnsweredIndex(optionIndex);
    setGameState('quiz_answered');
    emit('submit-answer', {
      pin,
      questionIndex: currentQuestionIndex,
      answerIndex: optionIndex
    });
  };

  const showHeader = gameState === 'quiz_answering' || gameState === 'quiz_answered' || gameState === 'quiz_result';

  return (
    <div style={{
      maxWidth: '480px',
      margin: '0 auto',
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'space-between',
      padding: '24px 16px 16px',
      background: '#111721',
      color: '#fff',
      position: 'relative',
      fontFamily: 'var(--font-body)'
    }}>
      
      {/* Header Info Area */}
      {showHeader ? (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
          <div>
            <div className="monospace-val" style={{ fontSize: '1.25rem', color: 'var(--color-primary)', fontWeight: 800 }}>
              Q {currentQuestionIndex + 1}/{totalQuestions}
            </div>
            <div style={{ fontSize: '0.85rem', color: 'rgba(255, 255, 255, 0.65)', marginTop: '4px' }}>
              Điểm số: {totalScore.toLocaleString()} điểm
            </div>
          </div>

          {/* SVG Countdown Ring */}
          <div style={{ position: 'relative', width: '50px', height: '50px' }}>
            <svg style={{ transform: 'rotate(-90deg)', width: '50px', height: '50px' }}>
              <circle
                cx="25"
                cy="25"
                r="20"
                fill="#1a242d"
                stroke="rgba(255, 255, 255, 0.05)"
                strokeWidth="3.5"
              />
              <circle
                cx="25"
                cy="25"
                r="20"
                fill="transparent"
                stroke="#00F2FE"
                strokeWidth="3.5"
                strokeDasharray="125.6"
                strokeDashoffset={125.6 - (questionTimer / (timeLimit || 15)) * 125.6}
                strokeLinecap="round"
                style={{ transition: 'stroke-dashoffset 1s linear' }}
              />
            </svg>
            <div style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 800,
              fontSize: '1rem',
              color: '#fff',
              fontFamily: 'var(--font-heading)'
            }}>
              {questionTimer}
            </div>
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <button 
            onClick={onExit} 
            style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 600 }}
          >
            ← RỜI PHÒNG
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', color: 'rgba(255,255,255,0.4)' }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: isConnected ? 'var(--color-success)' : 'var(--color-danger)' }} />
            {isConnected ? 'TRỰC TUYẾN' : 'NGOẠI TUYẾN'}
          </div>
        </div>
      )}

      {/* MAIN VIEW AREA */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
        
        {/* JOIN VIEW */}
        {gameState === 'join' && (
          <div className="glass-panel-glow animate-fade-in" style={{ padding: '32px 24px', border: '1px solid rgba(0, 242, 254, 0.2)' }}>
            <div style={{ textAlign: 'center', marginBottom: '28px' }}>
              <h2 className="text-glow-primary" style={{ fontSize: '1.6rem', fontWeight: 800, color: '#fff', letterSpacing: '1px' }}>
                HỌC TẬP PHÁP LUẬT
              </h2>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginTop: '4px' }}>Trung đoàn 1 - 3 Phút Mỗi Ngày</p>
            </div>

            <form onSubmit={handleJoin} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600 }}>MÃ PIN PHÒNG</label>
                <input 
                  type="text" 
                  required 
                  placeholder="Nhập mã PIN..." 
                  className="input-field monospace-val" 
                  value={pin}
                  disabled={!!urlPin}
                  onChange={(e) => setPin(e.target.value)}
                  style={{ textAlign: 'center', letterSpacing: '4px', fontSize: '1.25rem', color: 'var(--color-primary)' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600 }}>HỌ VÀ TÊN</label>
                <input 
                  type="text" 
                  required 
                  placeholder="Nhập họ tên..." 
                  className="input-field" 
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600 }}>MÃ LỚP / MSSV</label>
                <input 
                  type="text" 
                  required 
                  placeholder="Nhập mã lớp..." 
                  className="input-field" 
                  value={classCode}
                  onChange={(e) => setClassCode(e.target.value)}
                />
              </div>

              {errorMsg && (
                <div style={{ color: 'var(--color-danger)', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '6px', padding: '10px', background: 'rgba(239, 68, 68, 0.1)', borderRadius: '6px', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
                  <ShieldAlert size={14} />
                  {errorMsg}
                </div>
              )}

              <button type="submit" className="btn-primary" style={{ width: '100%', padding: '14px', marginTop: '10px' }}>
                KẾT NỐI PHÒNG THI
              </button>
            </form>
          </div>
        )}

        {/* LOBBY VIEW */}
        {gameState === 'lobby' && (
          <div className="glass-panel animate-fade-in" style={{ padding: '40px 24px', textAlign: 'center', border: '1px solid rgba(0, 242, 254, 0.2)' }}>
            <div className="animate-pulse-glow" style={{ width: '70px', height: '70px', borderRadius: '50%', background: 'rgba(0, 242, 254, 0.08)', display: 'flex', alignItems: 'center', justifySelf: 'center', justifyContent: 'center', marginBottom: '24px', border: '1px solid var(--color-primary)' }}>
              <User size={36} style={{ color: 'var(--color-primary)' }} />
            </div>
            <h2 style={{ fontSize: '1.4rem', marginBottom: '8px', color: '#fff' }}>Báo cáo, {name}!</h2>
            <p className="monospace-val" style={{ color: 'var(--color-primary)', fontSize: '0.9rem', marginBottom: '24px' }}>Mã đơn vị: {classCode}</p>
            
            <div style={{ padding: '20px 16px', background: 'rgba(5,9,21,0.4)', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.03)', marginBottom: '32px' }}>
              <RefreshCw size={24} className="spin-animation" style={{ color: 'var(--color-primary)', margin: '0 auto 12px', display: 'block', animation: 'spin 2.5s linear infinite' }} />
              <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Đang chờ giảng viên khởi chạy bài học...</span>
            </div>
          </div>
        )}

        {/* VIDEO STATE */}
        {gameState === 'video' && (
          <div className="glass-panel animate-fade-in" style={{ padding: '24px 16px', border: '1px solid rgba(0, 242, 254, 0.2)', width: '100%' }}>
            <h3 style={{ fontSize: '1.2rem', marginBottom: '16px', color: '#fff', textAlign: 'center', textTransform: 'uppercase', letterSpacing: '1px' }}>
              📺 BÀI GIẢNG VIDEO DẪN NHẬP
            </h3>
            
            {videoUrl ? (
              <div style={{ position: 'relative', width: '100%', paddingBottom: '56.25%', height: 0, borderRadius: '8px', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.1)', marginBottom: '16px', background: '#000' }}>
                <video 
                  src={videoUrl.startsWith('http') ? videoUrl : `${backendUrl}${videoUrl}`} 
                  controls 
                  playsInline
                  style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'contain' }}
                />
              </div>
            ) : (
              <div style={{ padding: '30px 16px', background: 'rgba(0, 242, 254, 0.05)', borderRadius: '8px', border: '1px dashed rgba(0, 242, 254, 0.2)', textAlign: 'center', marginBottom: '16px' }}>
                <Clock size={36} className="spin-animation" style={{ color: 'var(--color-primary)', margin: '0 auto 12px', display: 'block' }} />
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Đang phát video bài giảng trên máy chiếu lớn...</p>
              </div>
            )}

            {storyText && (
              <div style={{ background: 'rgba(13, 21, 37, 0.5)', padding: '14px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.04)', textAlign: 'left' }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--color-primary)', fontWeight: 700, display: 'block', marginBottom: '6px' }}>TÓM TẮT BÀI HỌC:</span>
                <p style={{ fontSize: '0.85rem', color: '#cbd5e1', lineHeight: '1.5' }}>{storyText}</p>
              </div>
            )}
          </div>
        )}

        {/* SITUATION STATE */}
        {gameState === 'situation' && (
          <div className="glass-panel animate-fade-in" style={{ padding: '24px 16px', border: '1px solid rgba(245, 158, 11, 0.25)', width: '100%' }}>
            <h3 style={{ fontSize: '1.2rem', marginBottom: '16px', color: '#fff', textAlign: 'center', textTransform: 'uppercase', letterSpacing: '1px' }}>
              ⚖️ TÌNH HUỐNG THẢO LUẬN
            </h3>
            
            {situationTitle && (
              <h4 style={{ color: 'var(--color-warning)', fontSize: '1rem', fontWeight: 700, marginBottom: '10px', textAlign: 'left' }}>
                {situationTitle}
              </h4>
            )}

            {situationText && (
              <div style={{ background: 'rgba(245, 158, 11, 0.04)', padding: '16px', borderRadius: '8px', border: '1px solid rgba(245, 158, 11, 0.12)', marginBottom: '16px', textAlign: 'left' }}>
                <p style={{ fontSize: '0.85rem', color: '#e2e8f0', lineHeight: '1.6' }}>{situationText}</p>
              </div>
            )}

            {situationQuestion && (
              <div style={{ background: 'rgba(13, 21, 37, 0.5)', padding: '14px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.04)', textAlign: 'left' }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--color-warning)', fontWeight: 700, display: 'block', marginBottom: '6px' }}>CÂU HỎI TRANH BIỆN:</span>
                <p style={{ fontSize: '0.9rem', color: '#fff', fontWeight: 600, lineHeight: '1.5' }}>{situationQuestion}</p>
              </div>
            )}
          </div>
        )}

        {/* QUIZ WAITING */}
        {gameState === 'quiz_waiting' && (
          <div className="glass-panel animate-fade-in" style={{ padding: '40px 24px', textAlign: 'center', border: '1px solid rgba(0, 242, 254, 0.2)' }}>
            <h3 className="text-glow-primary" style={{ fontSize: '1.35rem', marginBottom: '16px', color: 'var(--color-primary)', textTransform: 'uppercase', letterSpacing: '1px' }}>CHUẨN BỊ ĐẤU TRÍ!</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Câu hỏi sẽ bắt đầu hiển thị trên thiết bị của bạn.</p>
          </div>
        )}

        {/* QUIZ ANSWERING (VERTICAL STACK WITH QUESTION AND OPTIONS) */}
        {gameState === 'quiz_answering' && (
          <div className="animate-fade-in" style={{ 
            display: 'flex', 
            flexDirection: 'column',
            gap: '16px', 
            flex: 1, 
            minHeight: 'calc(100vh - 160px)',
            paddingBottom: '20px',
            width: '100%'
          }}>
            {/* Question display */}
            <div style={{
              background: 'rgba(26, 36, 45, 0.85)',
              border: '1px solid rgba(0, 242, 254, 0.25)',
              borderRadius: '12px',
              padding: '16px 20px',
              color: '#fff',
              fontSize: '1.05rem',
              fontWeight: 700,
              lineHeight: '1.5',
              textAlign: 'center',
              boxShadow: '0 4px 15px rgba(0, 0, 0, 0.25)',
              marginBottom: '4px'
            }}>
              {questionText}
            </div>

            {/* Options list */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', flex: 1 }}>
              {/* Card A (Red, Triangle) */}
              {options[0] && (
                <button
                  onClick={() => handleAnswerSubmit(0)}
                  style={{
                    background: '#800000',
                    border: 'none',
                    borderRadius: '12px',
                    display: 'flex',
                    alignItems: 'center',
                    padding: '16px 20px',
                    gap: '16px',
                    cursor: 'pointer',
                    width: '100%',
                    textAlign: 'left',
                    transition: 'transform 0.1s',
                    boxShadow: '0 4px 10px rgba(0,0,0,0.15)'
                  }}
                  onMouseDown={(e) => (e.currentTarget.style.transform = 'scale(0.98)')}
                  onMouseUp={(e) => (e.currentTarget.style.transform = 'scale(1)')}
                >
                  {/* White Hollow Triangle */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '32px', height: '32px', flexShrink: 0 }}>
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polygon points="12 3 2 21 22 21" />
                    </svg>
                  </div>
                  <div style={{ color: 'white', fontSize: '0.95rem', fontWeight: 600, lineHeight: '1.4' }}>
                    <span style={{ fontWeight: 800, marginRight: '6px' }}>A.</span> {options[0]}
                  </div>
                </button>
              )}

              {/* Card B (Cyan, Diamond Gem) */}
              {options[1] && (
                <button
                  onClick={() => handleAnswerSubmit(1)}
                  style={{
                    background: '#00E5FF',
                    border: 'none',
                    borderRadius: '12px',
                    display: 'flex',
                    alignItems: 'center',
                    padding: '16px 20px',
                    gap: '16px',
                    cursor: 'pointer',
                    width: '100%',
                    textAlign: 'left',
                    transition: 'transform 0.1s',
                    boxShadow: '0 4px 10px rgba(0,0,0,0.15)'
                  }}
                  onMouseDown={(e) => (e.currentTarget.style.transform = 'scale(0.98)')}
                  onMouseUp={(e) => (e.currentTarget.style.transform = 'scale(1)')}
                >
                  {/* Dark teal outline Diamond Gem */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '32px', height: '32px', flexShrink: 0 }}>
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#004D40" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M6 3 H18 L22 9 L12 22 L2 9 Z" />
                      <path d="M2 9 H22" />
                      <path d="M6 3 L12 9 L18 3" />
                    </svg>
                  </div>
                  <div style={{ color: '#004D40', fontSize: '0.95rem', fontWeight: 700, lineHeight: '1.4' }}>
                    <span style={{ fontWeight: 800, marginRight: '6px' }}>B.</span> {options[1]}
                  </div>
                </button>
              )}

              {/* Card C (Peach/Yellow, Circle) */}
              {options[2] && (
                <button
                  onClick={() => handleAnswerSubmit(2)}
                  style={{
                    background: '#FFD1A4',
                    border: 'none',
                    borderRadius: '12px',
                    display: 'flex',
                    alignItems: 'center',
                    padding: '16px 20px',
                    gap: '16px',
                    cursor: 'pointer',
                    width: '100%',
                    textAlign: 'left',
                    transition: 'transform 0.1s',
                    boxShadow: '0 4px 10px rgba(0,0,0,0.15)'
                  }}
                  onMouseDown={(e) => (e.currentTarget.style.transform = 'scale(0.98)')}
                  onMouseUp={(e) => (e.currentTarget.style.transform = 'scale(1)')}
                >
                  {/* Dark brown circle */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '32px', height: '32px', flexShrink: 0 }}>
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#5D4037" strokeWidth="3">
                      <circle cx="12" cy="12" r="9" />
                    </svg>
                  </div>
                  <div style={{ color: '#5D4037', fontSize: '0.95rem', fontWeight: 700, lineHeight: '1.4' }}>
                    <span style={{ fontWeight: 800, marginRight: '6px' }}>C.</span> {options[2]}
                  </div>
                </button>
              )}

              {/* Card D (Green, Square) */}
              {options[3] && (
                <button
                  onClick={() => handleAnswerSubmit(3)}
                  style={{
                    background: '#00A86B',
                    border: 'none',
                    borderRadius: '12px',
                    display: 'flex',
                    alignItems: 'center',
                    padding: '16px 20px',
                    gap: '16px',
                    cursor: 'pointer',
                    width: '100%',
                    textAlign: 'left',
                    transition: 'transform 0.1s',
                    boxShadow: '0 4px 10px rgba(0,0,0,0.15)'
                  }}
                  onMouseDown={(e) => (e.currentTarget.style.transform = 'scale(0.98)')}
                  onMouseUp={(e) => (e.currentTarget.style.transform = 'scale(1)')}
                >
                  {/* Dark green square */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '32px', height: '32px', flexShrink: 0 }}>
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#004D40" strokeWidth="3">
                      <rect x="3" y="3" width="18" height="18" rx="1" />
                    </svg>
                  </div>
                  <div style={{ color: '#004D40', fontSize: '0.95rem', fontWeight: 700, lineHeight: '1.4' }}>
                    <span style={{ fontWeight: 800, marginRight: '6px' }}>D.</span> {options[3]}
                  </div>
                </button>
              )}
            </div>

          </div>
        )}

        {/* QUIZ ANSWERED - WAITING */}
        {gameState === 'quiz_answered' && (
          <div className="glass-panel animate-fade-in" style={{ padding: '40px 24px', textAlign: 'center', border: '1px solid rgba(0, 242, 254, 0.2)' }}>
            <RefreshCw size={36} className="spin-animation" style={{ color: 'var(--color-primary)', margin: '0 auto 20px', display: 'block', animation: 'spin 2s linear infinite' }} />
            <h3 style={{ fontSize: '1.25rem', marginBottom: '10px', color: '#fff' }}>ĐÃ NỘP BÀI THÀNH CÔNG</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
              Đang chờ tính điểm số và tốc độ phản xạ...
            </p>
          </div>
        )}

        {/* QUIZ RESULT FEEDBACK */}
        {gameState === 'quiz_result' && lastResult && (
          <div className="glass-panel animate-fade-in" style={{
            padding: '32px 20px',
            textAlign: 'center',
            border: lastResult.isCorrect ? '2px solid var(--color-success)' : '2px solid var(--color-danger)',
            background: lastResult.isCorrect 
              ? 'linear-gradient(to bottom, rgba(16, 185, 129, 0.12), rgba(13, 21, 37, 0.95))' 
              : 'linear-gradient(to bottom, rgba(239, 68, 68, 0.12), rgba(13, 21, 37, 0.95))'
          }}>
            {lastResult.isCorrect ? (
              <div>
                <span style={{ fontSize: '3.5rem', display: 'block', marginBottom: '12px' }}>🎖️</span>
                <h2 className="text-glow-success" style={{ color: 'var(--color-success)', fontSize: '1.6rem', fontWeight: 800, marginBottom: '6px' }}>CHÍNH XÁC!</h2>
                <p className="monospace-val" style={{ fontSize: '1.2rem', fontWeight: 700, color: '#fff', marginBottom: '20px' }}>+{lastResult.pointsEarned} ĐIỂM</p>
              </div>
            ) : (
              <div>
                <span style={{ fontSize: '3.5rem', display: 'block', marginBottom: '12px' }}>❌</span>
                <h2 className="text-glow-danger" style={{ color: 'var(--color-danger)', fontSize: '1.6rem', fontWeight: 800, marginBottom: '6px' }}>ĐÁP ÁN SAI!</h2>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '20px' }}>
                  Đáp án chính xác là:{' '}
                  <strong className="monospace-val" style={{ color: 'var(--color-success)', fontSize: '1rem', marginLeft: '4px' }}>
                    {String.fromCharCode(65 + lastResult.correctOption)}
                  </strong>
                </p>
              </div>
            )}

            <div style={{ background: 'rgba(5,9,21,0.5)', padding: '14px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.04)', marginBottom: '20px', textAlign: 'left' }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--color-primary)', fontWeight: 700, display: 'block', marginBottom: '6px' }}>GIẢI THÍCH:</span>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: '1.5' }}>{lastResult.explanation}</p>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '14px', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
              <span>Tổng điểm:</span>
              <strong className="monospace-val" style={{ fontSize: '1.05rem', color: '#fff' }}>{totalScore} điểm</strong>
            </div>
          </div>
        )}

        {/* END GAME */}
        {gameState === 'ended' && (
          <div className="glass-panel animate-fade-in" style={{ padding: '32px 24px', textAlign: 'center', border: '1px solid rgba(0, 242, 254, 0.2)' }}>
            <span style={{ fontSize: '4rem', display: 'block', marginBottom: '12px' }}>🏆</span>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 800, marginBottom: '8px', color: '#fff' }}>BÀI TẬP HOÀN THÀNH</h2>
            
            <div style={{ margin: '12px 0 20px' }}>
              {rank !== -1 && (
                <p style={{ fontSize: '1.1rem', fontWeight: 700, color: '#fff' }}>
                  Xếp hạng: <span className="text-glow-primary monospace-val">#{rank}</span> / {totalPlayers}
                </p>
              )}
            </div>

            <div style={{ 
              background: 'rgba(16, 185, 129, 0.08)', 
              border: '1px solid rgba(16, 185, 129, 0.25)', 
              borderRadius: '8px', 
              padding: '10px', 
              marginBottom: '20px',
              color: 'var(--color-success)',
              fontWeight: 700,
              fontSize: '0.85rem'
            }}>
              ✓ ĐÃ GHI NHẬN ĐIỂM DANH CHUYÊN CẦN
            </div>
            
            <div style={{ background: 'rgba(0, 242, 254, 0.05)', border: '1px solid rgba(0, 242, 254, 0.25)', borderRadius: '12px', padding: '16px', marginBottom: '28px' }}>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>TỔNG ĐIỂM SỐ</span>
              <h1 className="text-glow-primary monospace-val" style={{ fontSize: '2.5rem', color: '#fff', fontWeight: 800, marginTop: '4px' }}>
                {totalScore}
              </h1>
            </div>

            <button className="btn-secondary" onClick={onExit} style={{ width: '100%' }}>
              THOÁT PHÒNG HỌC
            </button>
          </div>
        )}
      </div>

      {/* FOOTER BAR WITH BOLT ICON MATCHING SCREENSHOT 2 */}
      {(gameState === 'quiz_answered' || gameState === 'quiz_answering') && (
        <div style={{
          marginTop: '16px',
          padding: '14px 10px',
          borderRadius: '8px',
          background: '#0d131a',
          border: '1px solid rgba(255, 255, 255, 0.03)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '8px',
          fontSize: '0.85rem',
          fontWeight: 700,
          color: '#fff',
          boxShadow: '0 -2px 10px rgba(0,0,0,0.2)'
        }}>
          <span style={{ color: 'var(--color-primary)' }}>⚡</span>
          <span>
            {gameState === 'quiz_answered' 
              ? 'Đã gửi câu trả lời - Đang tính tốc độ' 
              : 'Chọn một đáp án để nộp bài'}
          </span>
        </div>
      )}
    </div>
  );
};
