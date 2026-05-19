import { useState, useMemo, useCallback } from "react";

const DEFAULT_INSPECTORS = ['황오미', '박수미', '최은숙'];
const ROOMS = ['DVD 1','DVD 2','북/휴게실','멀티/보드','교육실','댄스연습','음악연습','노래 1','노래 2','노래 3','동아리 1','동아리 2','사무실','기타'];
const CHECK_LIST = [
  {id:'lock',     label:'출입문/창문 잠금장치 이상무'},
  {id:'clean',    label:'청소 및 정리 상태 양호'},
  {id:'electric', label:'냉난방/전등/전기기구 확인'},
  {id:'position', label:'시설물 및 비품 원위치'},
  {id:'fire',     label:'소화기 비치 위치 이상무'},
  {id:'leak',     label:'천정/벽체/바닥 환경 확인'},
  {id:'device',   label:'각종 기기 작동상태 양호'},
];
const SPOT_LIST = [
  {id:'damage', label:'시설물 파손 발견'},
  {id:'safety', label:'안전사고 위험 요소'},
  {id:'broken', label:'기기 고장/오작동'},
  {id:'dirty',  label:'청결 불량'},
  {id:'fire2',  label:'소방/안전장치 이상'},
  {id:'other',  label:'기타 긴급 상황'},
];
const URGENCY = [
  {id:'normal',  label:'🟢 일반',  cls:'bg-green-50 border-green-400 text-green-700'},
  {id:'caution', label:'🟡 주의',  cls:'bg-yellow-50 border-yellow-400 text-yellow-700'},
  {id:'urgent',  label:'🔴 긴급',  cls:'bg-red-50 border-red-400 text-red-700'},
];
const ALL_CHECKS = [...CHECK_LIST, ...SPOT_LIST];

/* ── localStorage 헬퍼 ── */
const loadJSON = (key, fallback) => { try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; } catch { return fallback; } };
const saveJSON = (key, val) => { try { localStorage.setItem(key, JSON.stringify(val)); } catch {} };
const loadStr  = (key, fallback) => { try { return localStorage.getItem(key) || fallback; } catch { return fallback; } };
const saveStr  = (key, val) => { try { localStorage.setItem(key, val); } catch {} };

/* ── 다운로드 헬퍼 ── */
const downloadFile = (content, filename, type) => {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
};

const urgencyLabel = u => { if(u==='urgent') return '긴급'; if(u==='caution') return '주의'; return '일반'; };
const checkLabel = id => ALL_CHECKS.find(x=>x.id===id)?.label || id;

const generateCSV = (data) => {
  const header = '날짜,구분,점검자,긴급도,점검구역,체크항목,메모';
  const rows = data.map(i => [
    `"${i.dateString||''}"`, i.shift, i.inspector,
    i.urgency ? urgencyLabel(i.urgency) : '-',
    `"${(i.rooms||[]).join(', ')}"`,
    `"${(i.checks||[]).map(checkLabel).join(', ')}"`,
    `"${(i.memo||'').replace(/"/g,'""')}"`
  ].join(','));
  return '\uFEFF' + [header, ...rows].join('\n');
};

const generateHTMLTable = (data) => `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>시설점검 이력</title>
<style>
  body{font-family:-apple-system,sans-serif;padding:20px;color:#1e293b}
  h1{font-size:20px;text-align:center;margin-bottom:4px}
  .sub{text-align:center;color:#94a3b8;font-size:12px;margin-bottom:20px}
  table{width:100%;border-collapse:collapse;font-size:12px}
  th{background:#1d4ed8;color:white;padding:10px 6px;text-align:left}
  td{padding:8px 6px;border-bottom:1px solid #e2e8f0;vertical-align:top}
  tr:nth-child(even){background:#f8fafc}
  .urgent{color:#dc2626;font-weight:bold}
  .caution{color:#d97706;font-weight:bold}
  .badge{display:inline-block;padding:2px 6px;border-radius:4px;font-size:10px;font-weight:bold;margin:1px}
  .room{background:#eff6ff;color:#1d4ed8}
  @media print{body{padding:0}table{font-size:10px}}
</style></head><body>
<h1>✅ 고령군청소년문화의집 시설점검 이력</h1>
<p class="sub">출력일: ${new Date().toLocaleString('ko-KR')} | 총 ${data.length}건</p>
<table><thead><tr><th>날짜</th><th>구분</th><th>점검자</th><th>긴급도</th><th>점검구역</th><th>체크항목</th><th>메모</th></tr></thead><tbody>
${data.map(i => `<tr>
  <td>${i.dateString||''}</td>
  <td>${i.shift}</td>
  <td>${i.inspector}</td>
  <td class="${i.urgency==='urgent'?'urgent':i.urgency==='caution'?'caution':''}">${i.urgency?urgencyLabel(i.urgency):'-'}</td>
  <td>${(i.rooms||[]).map(r=>`<span class="badge room">${r}</span>`).join(' ')}</td>
  <td>${(i.checks||[]).map(checkLabel).join(', ')}</td>
  <td>${i.memo||''}</td>
</tr>`).join('')}
</tbody></table></body></html>`;

const generateHTMLJournal = (data) => {
  const grouped = {};
  data.forEach(i => { const d = (i.dateString||'').split('.').slice(0,3).join('.').trim(); if(!grouped[d]) grouped[d]=[]; grouped[d].push(i); });
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>시설점검 일지</title>
<style>
  body{font-family:-apple-system,sans-serif;padding:20px;color:#1e293b;max-width:800px;margin:0 auto}
  h1{font-size:20px;text-align:center;margin-bottom:4px}
  .sub{text-align:center;color:#94a3b8;font-size:12px;margin-bottom:24px}
  .day{margin-bottom:24px;page-break-inside:avoid}
  .day-title{font-size:15px;font-weight:900;color:#1d4ed8;border-bottom:2px solid #1d4ed8;padding-bottom:6px;margin-bottom:12px}
  .entry{background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:16px;margin-bottom:10px}
  .entry-header{display:flex;justify-content:space-between;margin-bottom:8px}
  .shift{font-size:12px;font-weight:900;padding:2px 8px;border-radius:20px}
  .shift-출근{background:#dcfce7;color:#15803d}
  .shift-퇴근{background:#fef3c7;color:#92400e}
  .shift-수시{background:#f3e8ff;color:#6b21a8}
  .time{font-size:11px;color:#94a3b8}
  .inspector{font-size:13px;font-weight:900;margin-bottom:6px}
  .rooms{margin-bottom:6px}
  .room-tag{display:inline-block;background:#eff6ff;color:#1d4ed8;padding:2px 8px;border-radius:6px;font-size:11px;font-weight:bold;margin:2px}
  .checks{font-size:11px;color:#64748b;margin-bottom:6px}
  .memo{background:white;border-left:3px solid #93c5fd;padding:8px 12px;font-size:12px;color:#475569;font-style:italic;border-radius:0 8px 8px 0}
  .urgent-tag{color:#dc2626;font-weight:bold;font-size:11px}
  @media print{body{padding:0}.entry{break-inside:avoid}}
</style></head><body>
<h1>📋 고령군청소년문화의집 시설점검 일지</h1>
<p class="sub">출력일: ${new Date().toLocaleString('ko-KR')} | 총 ${data.length}건</p>
${Object.entries(grouped).map(([date, items]) => `
<div class="day">
  <div class="day-title">📅 ${date}</div>
  ${items.map(i => `
  <div class="entry">
    <div class="entry-header">
      <span class="shift shift-${i.shift}">${i.shift}${i.urgency?' · '+urgencyLabel(i.urgency):''}</span>
      <span class="time">${i.dateString||''}</span>
    </div>
    <div class="inspector">👤 ${i.inspector}</div>
    <div class="rooms">${(i.rooms||[]).map(r=>`<span class="room-tag">#${r}</span>`).join(' ')}</div>
    <div class="checks">✅ ${(i.checks||[]).map(checkLabel).join(' | ')}</div>
    ${i.memo?`<div class="memo">"${i.memo}"</div>`:''}
  </div>`).join('')}
</div>`).join('')}
</body></html>`;
};

const ConfirmModal = ({ msg, subMsg, onOk, onCancel }) => (
  <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.5)',zIndex:9998,display:'flex',alignItems:'center',justifyContent:'center',padding:'20px'}}>
    <div className="bg-white rounded-3xl p-6 w-full max-w-sm shadow-2xl">
      <p className="text-sm font-black text-slate-800 mb-2">{msg}</p>
      {subMsg && <p className="text-xs text-slate-500 mb-5">{subMsg}</p>}
      <div className="flex gap-3 mt-5">
        <button onClick={onCancel} className="flex-1 py-3 rounded-2xl bg-slate-100 text-slate-600 font-bold text-sm active:bg-slate-200">취소</button>
        <button onClick={onOk} className="flex-1 py-3 rounded-2xl bg-red-500 text-white font-bold text-sm active:bg-red-600">삭제</button>
      </div>
    </div>
  </div>
);

export default function App() {
  /* ── 모든 useState 훅 ── */
  const [view,         setView]         = useState('form');
  const [shift,        setShift]        = useState('출근');
  const [inspector,    setInspector]    = useState('');
  const [selRooms,     setSelRooms]     = useState([]);
  const [selChecks,    setSelChecks]    = useState([]);
  const [urgency,      setUrgency]      = useState('normal');
  const [memo,         setMemo]         = useState('');
  const [photoPreview, setPhotoPreview] = useState(null);
  const [history,      setHistory]      = useState(() => loadJSON('insp_history', []));
  const [inspectors,   setInspectors]   = useState(() => loadJSON('insp_members', DEFAULT_INSPECTORS));
  const [inspInput,    setInspInput]    = useState('');
  const [isAdmin,      setIsAdmin]      = useState(false);
  const [adminInput,   setAdminInput]   = useState('');
  const [showLogin,    setShowLogin]    = useState(false);
  const [clickCount,   setClickCount]   = useState(0);
  const [changingPw,   setChangingPw]   = useState(false);
  const [managingInsp, setManagingInsp] = useState(false);
  const [selMonth,     setSelMonth]     = useState('');
  const [toast,        setToast]        = useState('');
  const [showDlAuth,   setShowDlAuth]   = useState(false);
  const [dlAuthInput,  setDlAuthInput]  = useState('');
  const [showDlMenu,   setShowDlMenu]   = useState(false);
  const [confirm,      setConfirm]      = useState(null);
  const [appUnlocked,  setAppUnlocked]  = useState(false);
  const [appPwInput,   setAppPwInput]   = useState('');
  const [appPwError,   setAppPwError]   = useState(false);

  // ── 3가지 비밀번호 (localStorage 영구 저장) ──
  const [pwApp,   setPwApp]   = useState(() => loadStr('pw_app',   '1234'));
  const [pwAdmin, setPwAdmin] = useState(() => loadStr('pw_admin', '1234'));
  const [pwDl,    setPwDl]    = useState(() => loadStr('pw_dl',    '1234'));

  const [pwEditApp,   setPwEditApp]   = useState('');
  const [pwEditAdmin, setPwEditAdmin] = useState('');
  const [pwEditDl,    setPwEditDl]    = useState('');

  /* ── localStorage 연동 업데이트 함수 ── */
  const updateHistory = useCallback((updater) => {
    setHistory(prev => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      saveJSON('insp_history', next);
      return next;
    });
  }, []);

  const updateInspectors = useCallback((updater) => {
    setInspectors(prev => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      saveJSON('insp_members', next);
      return next;
    });
  }, []);

  /* ── 모든 useCallback / useMemo 훅 ── */
  const showToast = useCallback((msg) => {
    setToast(msg);
    setTimeout(() => setToast(''), 2500);
  }, []);

  const isSpot = shift === '수시';
  const activeChecklist = isSpot ? SPOT_LIST : CHECK_LIST;

  const todayStatus = useMemo(() => {
    const today = new Date().toLocaleDateString('ko-KR');
    const t = history.filter(i => i.dateString?.startsWith(today));
    return { morning: t.some(i=>i.shift==='출근'), evening: t.some(i=>i.shift==='퇴근') };
  }, [history]);

  const monthOptions = useMemo(() => {
    const s = new Set();
    history.forEach(i => {
      const m = i.dateString?.match(/(\d{4})\.\s*(\d{1,2})\./);
      if (m) s.add(`${m[1]}-${m[2].padStart(2,'0')}`);
    });
    return Array.from(s).sort().reverse();
  }, [history]);

  const filtered = useMemo(() => {
    if (!selMonth) return history;
    return history.filter(i => {
      const m = i.dateString?.match(/(\d{4})\.\s*(\d{1,2})\./);
      return m && `${m[1]}-${m[2].padStart(2,'0')}` === selMonth;
    });
  }, [history, selMonth]);

  const stats = useMemo(() => {
    const rc={}, ic={};
    filtered.forEach(i => {
      i.rooms?.forEach(r => { rc[r]=(rc[r]||0)+1; });
      if (i.inspector) ic[i.inspector]=(ic[i.inspector]||0)+1;
    });
    return {
      total:   filtered.length,
      morning: filtered.filter(i=>i.shift==='출근').length,
      evening: filtered.filter(i=>i.shift==='퇴근').length,
      spot:    filtered.filter(i=>i.shift==='수시').length,
      urgent:  filtered.filter(i=>i.urgency==='urgent').length,
      rooms:   Object.entries(rc).sort((a,b)=>b[1]-a[1]),
      insps:   Object.entries(ic).sort((a,b)=>b[1]-a[1]),
    };
  }, [filtered]);

  /* ── 일반 함수들 ── */
  const unlockApp = () => {
    if (appPwInput === pwApp) { setAppUnlocked(true); setAppPwError(false); }
    else { setAppPwError(true); setAppPwInput(''); }
  };

  const verifyDlAuth = () => {
    if (dlAuthInput === pwDl) { setShowDlAuth(false); setDlAuthInput(''); setShowDlMenu(true); }
    else { showToast('❌ 비밀번호가 일치하지 않습니다.'); }
  };

  const askConfirm = (msg, subMsg) => new Promise(resolve => {
    setConfirm({ msg, subMsg, onOk: () => { setConfirm(null); resolve(true); }, onCancel: () => { setConfirm(null); resolve(false); } });
  });

  const deleteItem = async id => {
    const ok1 = await askConfirm('이 기록을 삭제하시겠습니까?', '');
    if (!ok1) return;
    const ok2 = await askConfirm('정말로 삭제하시겠습니까?', '삭제된 데이터는 복구할 수 없습니다.');
    if (!ok2) return;
    updateHistory(p => p.filter(i => i.id !== id));
    showToast('🗑️ 삭제되었습니다.');
  };

  const clearAll = async () => {
    const ok1 = await askConfirm('모든 기록을 삭제하시겠습니까?', '');
    if (!ok1) return;
    const ok2 = await askConfirm('⚠️ 최종 확인!', '삭제된 데이터는 복구할 수 없습니다. 정말 삭제하시겠습니까?');
    if (!ok2) return;
    updateHistory([]);
    showToast('🗑️ 전체 삭제되었습니다.');
  };

  const submit = () => {
    if (!inspector)        return showToast('⚠️ 점검자를 선택해주세요');
    if (!selRooms.length)  return showToast('⚠️ 구역을 선택해주세요');
    if (!selChecks.length) return showToast('⚠️ 체크리스트를 확인해주세요');
    const item = {
      id: Date.now().toString(), shift, inspector,
      rooms: selRooms, checks: selChecks, memo,
      urgency: isSpot ? urgency : null,
      timestamp: Date.now(),
      dateString: new Date().toLocaleString('ko-KR'),
    };
    updateHistory(p => [item, ...p]);
    showToast('✅ 점검 완료! 저장되었습니다.');
    setSelRooms([]); setSelChecks([]); setMemo('');
    setPhotoPreview(null); setInspector(''); setUrgency('normal');
    setView('history');
  };

  const handleTitleClick = () => {
    if (isAdmin) return;
    const n = clickCount + 1;
    if (n >= 5) { setShowLogin(true); setClickCount(0); }
    else { setClickCount(n); setTimeout(() => setClickCount(0), 3000); }
  };

  const handlePwChange = (type) => {
    const val = type === 'app' ? pwEditApp : type === 'admin' ? pwEditAdmin : pwEditDl;
    if (!val || val.length < 4) return showToast('⚠️ 4자리 이상 입력해주세요');
    if (type === 'app')   { setPwApp(val);   setPwEditApp('');   saveStr('pw_app', val); }
    if (type === 'admin') { setPwAdmin(val); setPwEditAdmin(''); saveStr('pw_admin', val); }
    if (type === 'dl')    { setPwDl(val);    setPwEditDl('');    saveStr('pw_dl', val); }
    const labels = { app: '🔒 앱 접속', admin: '🔑 관리자', dl: '📥 다운로드' };
    showToast(`✅ ${labels[type]} 비밀번호 변경 완료!`);
  };

  /* ── 다운로드 함수들 ── */
  const downloadCSV = () => {
    downloadFile(generateCSV(filtered), `시설점검_${new Date().toLocaleDateString('ko-KR').replace(/\./g,'').replace(/\s/g,'_')}.csv`, 'text/csv;charset=utf-8');
    showToast('⬇️ CSV 다운로드 완료');
  };
  const downloadExcel = () => {
    // CSV를 .xls 확장자로 저장하면 Excel에서 바로 열 수 있음
    downloadFile(generateCSV(filtered), `시설점검_${new Date().toLocaleDateString('ko-KR').replace(/\./g,'').replace(/\s/g,'_')}.xls`, 'application/vnd.ms-excel;charset=utf-8');
    showToast('📊 엑셀 다운로드 완료');
  };
  const downloadTableHTML = () => {
    downloadFile(generateHTMLTable(filtered), `시설점검_표_${new Date().toLocaleDateString('ko-KR').replace(/\./g,'').replace(/\s/g,'_')}.html`, 'text/html;charset=utf-8');
    showToast('📋 표 형식 다운로드 완료');
  };
  const downloadJournalHTML = () => {
    downloadFile(generateHTMLJournal(filtered), `시설점검_일지_${new Date().toLocaleDateString('ko-KR').replace(/\./g,'').replace(/\s/g,'_')}.html`, 'text/html;charset=utf-8');
    showToast('📓 일지 형식 다운로드 완료');
  };

  const shiftColor = s => {
    if (s==='출근') return 'bg-green-100 text-green-700';
    if (s==='퇴근') return 'bg-amber-100 text-amber-700';
    return 'bg-purple-100 text-purple-700';
  };

  const urgencyBadge = u => {
    if (u==='urgent') return '🔴 긴급';
    if (u==='caution') return '🟡 주의';
    return '🟢 일반';
  };

  const MonthFilter = () => (
    <select value={selMonth} onChange={e => setSelMonth(e.target.value)}
      className="text-xs font-bold bg-white border border-slate-200 rounded-xl px-3 py-2 outline-none shadow-sm">
      <option value="">전체 기간</option>
      {monthOptions.map(m => <option key={m} value={m}>{m.replace('-','년 ')}월</option>)}
    </select>
  );

  /* ═══ 잠금 화면 ═══ */
  if (!appUnlocked) return (
    <div style={{minHeight:'100vh',background:'linear-gradient(135deg,#1e3a5f 0%,#1d4ed8 100%)',display:'flex',alignItems:'center',justifyContent:'center',padding:'20px',fontFamily:'-apple-system,sans-serif'}}>
      <div style={{background:'white',borderRadius:'28px',padding:'32px 28px',width:'100%',maxWidth:'360px',boxShadow:'0 24px 80px rgba(0,0,0,0.3)',textAlign:'center'}}>
        <div style={{fontSize:'48px',marginBottom:'12px'}}>✅</div>
        <p style={{fontSize:'11px',color:'#94a3b8',fontWeight:'700',marginBottom:'4px'}}>고령군청소년문화의집</p>
        <h1 style={{fontSize:'20px',fontWeight:'900',color:'#1e293b',marginBottom:'8px'}}>시설점검</h1>
        <p style={{fontSize:'12px',color:'#94a3b8',marginBottom:'24px'}}>접속 비밀번호를 입력하세요</p>
        <input type="password" placeholder="비밀번호" value={appPwInput}
          onChange={e=>{setAppPwInput(e.target.value);setAppPwError(false);}}
          onKeyDown={e=>e.key==='Enter'&&unlockApp()} autoFocus
          style={{width:'100%',padding:'14px',borderRadius:'14px',border:`2px solid ${appPwError?'#ef4444':'#e2e8f0'}`,fontSize:'16px',outline:'none',boxSizing:'border-box',textAlign:'center',letterSpacing:'4px',marginBottom:'8px'}}/>
        {appPwError && <p style={{fontSize:'12px',color:'#ef4444',marginBottom:'8px',fontWeight:'700'}}>❌ 비밀번호가 틀렸습니다</p>}
        <button onClick={unlockApp}
          style={{width:'100%',padding:'14px',borderRadius:'14px',background:'#1d4ed8',color:'white',fontWeight:'900',fontSize:'16px',border:'none',cursor:'pointer',marginTop:'4px'}}>
          입장
        </button>
      </div>
    </div>
  );

  /* ═══ 메인 화면 ═══ */
  return (
    <div className="min-h-screen bg-slate-50 pb-24 select-none" style={{fontFamily:'-apple-system,sans-serif'}}>

      {/* 다운로드 비번 모달 */}
      {showDlAuth && (
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.5)',zIndex:9998,display:'flex',alignItems:'center',justifyContent:'center',padding:'20px'}}>
          <div style={{background:'white',borderRadius:'24px',padding:'24px',width:'100%',maxWidth:'360px',boxShadow:'0 20px 60px rgba(0,0,0,0.3)'}}>
            <p style={{fontSize:'15px',fontWeight:'900',color:'#1e293b',marginBottom:'8px'}}>📥 다운로드</p>
            <p style={{fontSize:'12px',color:'#64748b',marginBottom:'12px'}}>비밀번호를 입력하세요</p>
            <input type="password" placeholder="비밀번호" value={dlAuthInput} onChange={e=>setDlAuthInput(e.target.value)}
              onKeyDown={e=>e.key==='Enter'&&verifyDlAuth()} autoFocus
              style={{width:'100%',padding:'12px',borderRadius:'12px',border:'1.5px solid #cbd5e1',fontSize:'14px',outline:'none',boxSizing:'border-box',marginBottom:'12px'}}/>
            <div style={{display:'flex',gap:'8px'}}>
              <button onClick={()=>{setShowDlAuth(false);setDlAuthInput('');}}
                style={{flex:1,padding:'12px',borderRadius:'14px',background:'#f1f5f9',color:'#475569',fontWeight:'700',fontSize:'14px',border:'none',cursor:'pointer'}}>취소</button>
              <button onClick={verifyDlAuth}
                style={{flex:1,padding:'12px',borderRadius:'14px',background:'#1d4ed8',color:'white',fontWeight:'700',fontSize:'14px',border:'none',cursor:'pointer'}}>확인</button>
            </div>
          </div>
        </div>
      )}

      {/* 다운로드 메뉴 */}
      {showDlMenu && (
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.4)',zIndex:9990}} onClick={()=>setShowDlMenu(false)}>
          <div style={{position:'absolute',top:'50%',left:'50%',transform:'translate(-50%,-50%)',background:'white',borderRadius:'24px',padding:'20px',width:'300px',boxShadow:'0 20px 60px rgba(0,0,0,0.3)'}} onClick={e=>e.stopPropagation()}>
            <p style={{fontSize:'15px',fontWeight:'900',color:'#1e293b',marginBottom:'4px'}}>📥 다운로드 형식 선택</p>
            <p style={{fontSize:'11px',color:'#94a3b8',marginBottom:'16px'}}>{history.length}건 (전체 기간)</p>
            <div style={{display:'flex',flexDirection:'column',gap:'8px'}}>
              <button onClick={()=>{downloadTableHTML();setShowDlMenu(false);}}
                style={{padding:'12px 16px',borderRadius:'14px',border:'1.5px solid #93c5fd',background:'#eff6ff',textAlign:'left',cursor:'pointer',display:'flex',flexDirection:'column',gap:'2px'}}>
                <span style={{fontSize:'13px',fontWeight:'700',color:'#1d4ed8'}}>📋 표 형식 (HTML)</span>
                <span style={{fontSize:'11px',color:'#94a3b8'}}>깔끔한 표 — 인쇄/저장용</span>
              </button>
              <button onClick={()=>{downloadJournalHTML();setShowDlMenu(false);}}
                style={{padding:'12px 16px',borderRadius:'14px',border:'1.5px solid #c4b5fd',background:'#faf5ff',textAlign:'left',cursor:'pointer',display:'flex',flexDirection:'column',gap:'2px'}}>
                <span style={{fontSize:'13px',fontWeight:'700',color:'#6d28d9'}}>📓 일지 형식 (HTML)</span>
                <span style={{fontSize:'11px',color:'#94a3b8'}}>날짜별 상세 일지</span>
              </button>
            </div>
            <button onClick={()=>setShowDlMenu(false)} style={{marginTop:'12px',width:'100%',padding:'10px',borderRadius:'12px',background:'#f1f5f9',border:'none',fontWeight:'700',fontSize:'13px',color:'#64748b',cursor:'pointer'}}>취소</button>
          </div>
        </div>
      )}

      {confirm && <ConfirmModal msg={confirm.msg} subMsg={confirm.subMsg} onOk={confirm.onOk} onCancel={confirm.onCancel}/>}

      {/* 토스트 */}
      {toast && (
        <div style={{position:'fixed',top:'50px',left:'50%',transform:'translateX(-50%)',background:'#1e293b',color:'white',padding:'14px 24px',borderRadius:'16px',fontSize:'14px',fontWeight:'bold',zIndex:9997,boxShadow:'0 4px 20px rgba(0,0,0,0.3)',whiteSpace:'nowrap'}}>
          {toast}
        </div>
      )}

      {/* 헤더 */}
      <header className="bg-blue-700 text-white p-5 shadow-lg sticky top-0 z-20 cursor-pointer active:opacity-80" onClick={handleTitleClick}>
        <div className="max-w-md mx-auto flex items-center justify-between">
          <h1 className="text-base font-black">✅ 고령군청소년문화의집 시설점검</h1>
          <div className="flex items-center gap-2">
            {isAdmin && <span className="text-blue-200 animate-pulse">🔓</span>}
            <button onClick={(e)=>{e.stopPropagation();setShowDlAuth(true);}}
              style={{background:'rgba(255,255,255,0.2)',border:'1px solid rgba(255,255,255,0.3)',borderRadius:'10px',padding:'6px 10px',color:'white',fontSize:'13px',fontWeight:'700',cursor:'pointer',whiteSpace:'nowrap'}}>
              📥 다운
            </button>
          </div>
        </div>
      </header>

      <main className="p-4 max-w-md mx-auto space-y-4">

        {/* ── FORM ── */}
        {view === 'form' && (
          <div className="space-y-4">
            {(!todayStatus.morning || !todayStatus.evening) && (
              <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex gap-3 items-start">
                <span>⚠️</span>
                <div className="flex-1">
                  <div className="flex items-center justify-between gap-4 mb-1">
                    <p className="text-xs font-black text-amber-800 whitespace-nowrap">미완료 점검이 있어요</p>
                    <p className="text-[11px] font-bold text-amber-600 whitespace-nowrap">📅 {new Date().toLocaleDateString('ko-KR', {month:'long', day:'numeric', weekday:'short'})}</p>
                  </div>
                  <p className="text-[11px] text-amber-600">
                    {!todayStatus.morning && '· 출근 점검 미제출  '}
                    {!todayStatus.evening && '· 퇴근 점검 미제출'}
                  </p>
                </div>
              </div>
            )}

            <section className="bg-white p-5 rounded-3xl shadow-sm border border-slate-200">
              <div className="flex gap-1.5 mb-4 bg-slate-100 p-1 rounded-2xl">
                {['출근','퇴근','수시'].map(s => (
                  <button key={s} onClick={() => { setShift(s); setSelChecks([]); setUrgency('normal'); }}
                    className={`flex-1 py-2.5 rounded-xl font-bold text-xs transition-all ${shift===s?`bg-white shadow-sm ${s==='출근'?'text-green-700':s==='퇴근'?'text-amber-700':'text-purple-700'}`:'text-slate-400'}`}>
                    {s==='출근'?`출근 ${todayStatus.morning?'✓':''}`:s==='퇴근'?`퇴근 ${todayStatus.evening?'✓':''}` :'🚨 수시'}
                  </button>
                ))}
              </div>
              <select value={inspector} onChange={e => setInspector(e.target.value)}
                className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none text-sm font-bold appearance-none">
                <option value="">점검자 선택</option>
                {inspectors.map(n => <option key={n} value={n}>{n}</option>)}
              </select>
            </section>

            {isSpot && (
              <div className="bg-purple-50 border border-purple-200 rounded-2xl p-4 flex gap-3">
                <span>🚨</span>
                <div>
                  <p className="text-xs font-black text-purple-800">수시점검 모드</p>
                  <p className="text-[11px] text-purple-600 mt-0.5">문제 발견 시 즉시 기록하세요.</p>
                </div>
              </div>
            )}

            {isSpot && (
              <section className="bg-white p-5 rounded-3xl shadow-sm border border-slate-200">
                <h2 className="text-sm font-bold text-slate-700 mb-3">⚡ 긴급도 선택</h2>
                <div className="flex gap-2">
                  {URGENCY.map(u => (
                    <button key={u.id} onClick={() => setUrgency(u.id)}
                      className={`flex-1 py-3 rounded-xl text-xs font-black border-2 transition-all ${urgency===u.id?u.cls+' scale-105 shadow-md':'bg-slate-50 border-slate-100 text-slate-400'}`}>
                      {u.label}
                    </button>
                  ))}
                </div>
              </section>
            )}

            <section className="bg-white p-5 rounded-3xl shadow-sm border border-slate-200">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-sm font-bold text-slate-700">📍 점검 구역</h2>
                <button onClick={() => setSelRooms(p => p.length===ROOMS.length?[]:[...ROOMS])}
                  className="text-[10px] font-black text-blue-600 bg-blue-50 px-3 py-1.5 rounded-lg">전체 선택</button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {ROOMS.map(r => (
                  <button key={r} onClick={() => setSelRooms(p => p.includes(r)?p.filter(x=>x!==r):[...p,r])}
                    className={`p-3 rounded-xl text-xs font-bold border transition-all ${selRooms.includes(r)?'bg-blue-600 border-blue-600 text-white shadow-md':'bg-slate-50 border-slate-100 text-slate-500'}`}>
                    {r}
                  </button>
                ))}
              </div>
            </section>

            <section className="bg-white p-5 rounded-3xl shadow-sm border border-slate-200">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-sm font-bold text-slate-700">{isSpot?'🚨 문제 항목 선택':'🛡️ 필수 체크리스트'}</h2>
                <button onClick={() => setSelChecks(p => p.length===activeChecklist.length?[]:activeChecklist.map(c=>c.id))}
                  className={`text-[10px] font-black px-3 py-1.5 rounded-lg ${isSpot?'text-purple-600 bg-purple-50':'text-green-600 bg-green-50'}`}>
                  {isSpot?'전체 선택':'모두 확인'}
                </button>
              </div>
              <div className="space-y-2">
                {activeChecklist.map(item => (
                  <button key={item.id} onClick={() => setSelChecks(p => p.includes(item.id)?p.filter(x=>x!==item.id):[...p,item.id])}
                    className={`w-full flex items-center justify-between p-3.5 rounded-xl border text-sm font-bold transition-all ${
                      selChecks.includes(item.id)
                        ? isSpot?'bg-purple-50 border-purple-500 text-purple-700':'bg-green-50 border-green-500 text-green-700'
                        : 'bg-slate-50 border-slate-100 text-slate-400'
                    }`}>
                    <span>{item.label}</span>
                    <span>{selChecks.includes(item.id)?(isSpot?'⚠️':'✅'):'○'}</span>
                  </button>
                ))}
              </div>
            </section>

            <section className="bg-white p-5 rounded-3xl shadow-sm border border-slate-200 space-y-4">
              <div className="relative flex flex-col items-center justify-center w-full h-36 border-2 border-dashed border-slate-200 rounded-2xl bg-slate-50 overflow-hidden cursor-pointer active:bg-slate-100">
                {photoPreview
                  ? <img src={photoPreview} className="w-full h-full object-cover"/>
                  : <div className="text-center"><div className="text-3xl mb-1">📷</div><p className="text-xs text-slate-400 font-bold">{isSpot?'문제 현장 사진 촬영':'현장 사진 촬영'}</p></div>}
                <input type="file" accept="image/*" capture="environment"
                  onChange={e => { const f=e.target.files[0]; if(f) setPhotoPreview(URL.createObjectURL(f)); }}
                  className="absolute inset-0 opacity-0 cursor-pointer"/>
              </div>
              <textarea value={memo} onChange={e => setMemo(e.target.value)}
                placeholder={isSpot?'발견한 문제 상황을 상세히 기록해주세요...':'시설 특이사항 기록...'}
                className="w-full h-24 p-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm outline-none focus:ring-2 focus:ring-blue-500"/>
            </section>

            <button onClick={submit}
              className={`w-full p-5 rounded-3xl text-white font-black text-lg shadow-xl active:scale-95 transition-all ${isSpot?'bg-purple-600':'bg-blue-600'}`}>
              {isSpot?'🚨 수시점검 기록 제출':`${shift} 점검 완료`}
            </button>
          </div>
        )}

        {/* ── HISTORY ── */}
        {view === 'history' && (
          <div className="space-y-4">
            <div className="space-y-3 px-1">
              <div className="flex justify-between items-center">
                <h2 className="text-lg font-black text-slate-800 whitespace-nowrap">📋 점검이력</h2>
                {isAdmin && (
                  <div className="flex gap-1 flex-wrap justify-end">
                    <button onClick={downloadExcel} className="p-2 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-700 font-bold">📊 엑셀</button>
                    <button onClick={downloadCSV} className="p-2 bg-white border border-slate-200 rounded-lg text-xs font-bold">⬇️ CSV</button>
                    <button onClick={downloadTableHTML} className="p-2 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-700 font-bold">📄 보고서</button>
                    <button onClick={() => { setChangingPw(p=>!p); setManagingInsp(false); setPwEditApp(''); setPwEditAdmin(''); setPwEditDl(''); }}
                      className={`p-2 rounded-lg text-xs ${changingPw?'bg-amber-600 text-white':'bg-amber-50 border border-amber-200 text-amber-700'}`}>🔑</button>
                    <button onClick={() => { setManagingInsp(p=>!p); setChangingPw(false); }}
                      className={`p-2 rounded-lg text-xs ${managingInsp?'bg-purple-600 text-white':'bg-purple-50 border border-purple-200 text-purple-700'}`}>👤</button>
                    <button onClick={() => { setIsAdmin(false); setChangingPw(false); setManagingInsp(false); setView('form'); }}
                      className="p-2 bg-slate-200 text-slate-700 rounded-lg text-xs">🚪</button>
                  </div>
                )}
              </div>

              {/* 비밀번호 관리 패널 */}
              {isAdmin && changingPw && (
                <div className="bg-amber-50 p-4 rounded-2xl border border-amber-200 space-y-4">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-lg">🔐</span>
                    <p className="text-sm font-black text-amber-800">비밀번호 관리</p>
                  </div>
                  <p className="text-[10px] text-amber-600 -mt-2">각 비밀번호를 개별적으로 변경할 수 있습니다 (4자리 이상)</p>

                  <div className="bg-white p-3.5 rounded-xl border border-amber-200">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-sm">🔒</span>
                      <p className="text-[11px] font-black text-slate-700">앱 접속 비밀번호</p>
                      <span className="text-[9px] bg-amber-100 text-amber-600 px-2 py-0.5 rounded-full font-bold ml-auto">현재: {pwApp}</span>
                    </div>
                    <div className="flex gap-2">
                      <input type="password" placeholder="새 비밀번호 입력" value={pwEditApp} onChange={e=>setPwEditApp(e.target.value)}
                        onKeyDown={e=>e.key==='Enter'&&handlePwChange('app')}
                        className="flex-1 p-2.5 rounded-lg text-sm outline-none border border-slate-200 bg-slate-50"/>
                      <button onClick={()=>handlePwChange('app')}
                        className="bg-amber-500 text-white px-4 rounded-lg text-xs font-bold whitespace-nowrap active:bg-amber-600">변경</button>
                    </div>
                  </div>

                  <div className="bg-white p-3.5 rounded-xl border border-amber-200">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-sm">🔑</span>
                      <p className="text-[11px] font-black text-slate-700">관리자 비밀번호</p>
                      <span className="text-[9px] bg-blue-100 text-blue-600 px-2 py-0.5 rounded-full font-bold ml-auto">현재: {pwAdmin}</span>
                    </div>
                    <div className="flex gap-2">
                      <input type="password" placeholder="새 비밀번호 입력" value={pwEditAdmin} onChange={e=>setPwEditAdmin(e.target.value)}
                        onKeyDown={e=>e.key==='Enter'&&handlePwChange('admin')}
                        className="flex-1 p-2.5 rounded-lg text-sm outline-none border border-slate-200 bg-slate-50"/>
                      <button onClick={()=>handlePwChange('admin')}
                        className="bg-blue-500 text-white px-4 rounded-lg text-xs font-bold whitespace-nowrap active:bg-blue-600">변경</button>
                    </div>
                  </div>

                  <div className="bg-white p-3.5 rounded-xl border border-amber-200">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-sm">📥</span>
                      <p className="text-[11px] font-black text-slate-700">다운로드 비밀번호</p>
                      <span className="text-[9px] bg-purple-100 text-purple-600 px-2 py-0.5 rounded-full font-bold ml-auto">현재: {pwDl}</span>
                    </div>
                    <div className="flex gap-2">
                      <input type="password" placeholder="새 비밀번호 입력" value={pwEditDl} onChange={e=>setPwEditDl(e.target.value)}
                        onKeyDown={e=>e.key==='Enter'&&handlePwChange('dl')}
                        className="flex-1 p-2.5 rounded-lg text-sm outline-none border border-slate-200 bg-slate-50"/>
                      <button onClick={()=>handlePwChange('dl')}
                        className="bg-purple-500 text-white px-4 rounded-lg text-xs font-bold whitespace-nowrap active:bg-purple-600">변경</button>
                    </div>
                  </div>

                  <button onClick={() => setChangingPw(false)}
                    className="w-full py-2.5 rounded-xl bg-slate-100 text-slate-500 text-xs font-bold active:bg-slate-200">닫기</button>
                </div>
              )}

              {isAdmin && managingInsp && (
                <div className="bg-purple-50 p-4 rounded-2xl border border-purple-200">
                  <p className="text-[11px] font-bold text-purple-800 mb-2">점검자 관리</p>
                  <div className="flex gap-2 mb-3">
                    <input type="text" placeholder="이름 입력" value={inspInput} onChange={e=>setInspInput(e.target.value)}
                      onKeyDown={e=>{if(e.key==='Enter'&&inspInput.trim()){updateInspectors(p=>[...p,inspInput.trim()]);setInspInput('');}}}
                      className="flex-1 p-3 rounded-xl text-sm outline-none border border-purple-300"/>
                    <button onClick={()=>{if(inspInput.trim()){updateInspectors(p=>[...p,inspInput.trim()]);setInspInput('');}}} className="bg-purple-600 text-white px-4 rounded-xl text-sm font-bold">+ 추가</button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {inspectors.map(n => (
                      <span key={n} className="flex items-center gap-1 bg-white border border-purple-200 rounded-xl px-3 py-1.5 text-xs font-bold text-purple-700">
                        {n} <button onClick={() => updateInspectors(p=>p.filter(i=>i!==n))} className="text-red-400 ml-1">✕</button>
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {showLogin && (
                <div className="bg-blue-50 p-4 rounded-2xl border border-blue-100 flex gap-2">
                  <input type="password" placeholder="관리자 비밀번호" value={adminInput} onChange={e=>setAdminInput(e.target.value)}
                    onKeyDown={e=>{if(e.key==='Enter'){if(adminInput===pwAdmin){setIsAdmin(true);setShowLogin(false);setAdminInput('');showToast('🔓 관리자 인증됨');}else showToast('❌ 비밀번호 오류');}}}
                    className="flex-1 p-3 rounded-xl text-sm outline-none border border-blue-200" autoFocus/>
                  <button onClick={()=>{if(adminInput===pwAdmin){setIsAdmin(true);setShowLogin(false);setAdminInput('');showToast('🔓 관리자 인증됨');}else showToast('❌ 비밀번호 오류');}}
                    className="bg-blue-600 text-white px-5 rounded-xl text-sm font-bold whitespace-nowrap">인증</button>
                  <button onClick={()=>setShowLogin(false)} className="text-slate-400 px-2 text-lg">✕</button>
                </div>
              )}

              <div className="flex items-center justify-between">
                <MonthFilter/>
                <span className="text-xs text-slate-400 font-bold">{filtered.length}건</span>
              </div>

              {isAdmin && history.length > 0 && (
                <button onClick={clearAll}
                  className="w-full flex items-center justify-center gap-2 bg-red-50 p-4 rounded-2xl border border-red-100 text-red-600 text-[11px] font-black active:bg-red-100">
                  🗑️ 모든 기록 영구 삭제 (시스템 초기화)
                </button>
              )}
            </div>

            <div className="space-y-3">
              {filtered.length===0
                ? <div className="text-center py-20 bg-white rounded-3xl text-slate-300 italic text-sm border border-dashed">데이터 없음</div>
                : filtered.map(item => (
                  <div key={item.id} className={`bg-white p-5 rounded-3xl shadow-sm border relative ${item.shift==='수시'&&item.urgency==='urgent'?'border-red-200':item.shift==='수시'&&item.urgency==='caution'?'border-yellow-200':'border-slate-100'}`}>
                    {isAdmin && (
                      <button onClick={() => deleteItem(item.id)}
                        className="absolute top-4 right-4 p-2 bg-red-50 rounded-full text-sm active:scale-125 transition-all">🗑️</button>
                    )}
                    <div className="flex justify-between items-center mb-3 pr-10">
                      <div className="flex gap-2 items-center">
                        <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${shiftColor(item.shift)}`}>{item.shift}</span>
                        {item.urgency && <span className="text-[10px] font-black">{urgencyBadge(item.urgency)}</span>}
                      </div>
                      <span className="text-[10px] text-slate-400">{item.dateString}</span>
                    </div>
                    <p className="text-sm font-black text-slate-700 mb-3">{item.inspector}</p>
                    <div className="flex flex-wrap gap-1 mb-2">
                      {item.rooms?.map(r => <span key={r} className="text-[9px] bg-blue-50 text-blue-600 px-2 py-0.5 rounded-md font-bold">#{r}</span>)}
                    </div>
                    <div className="bg-slate-50 p-3 rounded-xl mb-2 flex flex-wrap gap-1">
                      {item.checks?.map(c => {
                        const found = ALL_CHECKS.find(x=>x.id===c);
                        return <span key={c} className="text-[9px] bg-white border border-slate-200 text-slate-500 px-2 py-1 rounded-lg">{found?.label}</span>;
                      })}
                    </div>
                    {item.memo && <p className="p-3 bg-blue-50/30 rounded-xl text-[11px] text-slate-600 italic border-l-4 border-blue-200">"{item.memo}"</p>}
                  </div>
                ))
              }
            </div>
          </div>
        )}

        {/* ── STATS ── */}
        {view === 'stats' && isAdmin && (
          <div className="space-y-4">
            <div className="flex justify-between items-center px-1">
              <h2 className="text-lg font-black text-slate-800">📊 점검 통계</h2>
              <MonthFilter/>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {[
                {l:'총 점검',   v:stats.total,   bg:'bg-blue-50',   t:'text-blue-700'},
                {l:'출근 완료', v:stats.morning, bg:'bg-green-50',  t:'text-green-700'},
                {l:'퇴근 완료', v:stats.evening, bg:'bg-amber-50',  t:'text-amber-700'},
                {l:'수시 점검', v:stats.spot,    bg:'bg-purple-50', t:'text-purple-700'},
              ].map(({l,v,bg,t}) => (
                <div key={l} className={`${bg} rounded-2xl p-4 text-center shadow-sm`}>
                  <p className={`text-2xl font-black ${t}`}>{v}</p>
                  <p className={`text-[10px] font-bold ${t} opacity-70 mt-1`}>{l}</p>
                </div>
              ))}
            </div>
            {stats.urgent > 0 && (
              <div className="bg-red-50 border border-red-200 rounded-2xl p-4 flex items-center gap-3">
                <span className="text-2xl">🔴</span>
                <div>
                  <p className="text-sm font-black text-red-700">긴급 수시점검 {stats.urgent}건</p>
                  <p className="text-[11px] text-red-500 mt-0.5">즉각적인 조치가 필요한 항목이 있어요!</p>
                </div>
              </div>
            )}
            {stats.rooms.length > 0 && (
              <section className="bg-white p-5 rounded-3xl shadow-sm border border-slate-200">
                <h3 className="text-sm font-black text-slate-700 mb-4">📍 구역별 점검 현황</h3>
                <div className="space-y-2.5">
                  {stats.rooms.map(([r,c]) => {
                    const p = Math.round((c/stats.rooms[0][1])*100);
                    return (
                      <div key={r} className="flex items-center gap-3">
                        <span className="text-[11px] font-bold text-slate-500 w-16 text-right shrink-0">{r}</span>
                        <div className="flex-1 bg-slate-100 rounded-full h-4 overflow-hidden">
                          <div className="bg-blue-500 h-full rounded-full transition-all duration-500" style={{width:`${p}%`}}/>
                        </div>
                        <span className="text-[11px] font-black text-slate-700 w-5 text-right">{c}</span>
                      </div>
                    );
                  })}
                </div>
              </section>
            )}
            {stats.insps.length > 0 && (
              <section className="bg-white p-5 rounded-3xl shadow-sm border border-slate-200">
                <h3 className="text-sm font-black text-slate-700 mb-4">✅ 점검자별 현황</h3>
                <div className="space-y-2.5">
                  {stats.insps.map(([n,c]) => {
                    const p = Math.round((c/stats.insps[0][1])*100);
                    return (
                      <div key={n} className="flex items-center gap-3">
                        <span className="text-[11px] font-bold text-slate-500 w-16 text-right shrink-0">{n}</span>
                        <div className="flex-1 bg-slate-100 rounded-full h-4 overflow-hidden">
                          <div className="bg-green-500 h-full rounded-full transition-all duration-500" style={{width:`${p}%`}}/>
                        </div>
                        <span className="text-[11px] font-black text-slate-700 w-5 text-right">{c}</span>
                      </div>
                    );
                  })}
                </div>
              </section>
            )}
          </div>
        )}
      </main>

      <nav className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-xl border-t border-slate-100 h-20 flex items-center justify-around z-30 shadow-2xl">
        <button onClick={() => setView('form')}
          className={`relative flex flex-col items-center gap-1 transition-all ${view==='form'?'text-blue-700 scale-110':'text-slate-300'}`}>
          <span className="text-2xl">✅</span>
          {(!todayStatus.morning||!todayStatus.evening) && <span className="absolute top-0 right-0 w-3 h-3 bg-amber-400 rounded-full border-2 border-white"/>}
          <span className="text-[10px] font-black">시설점검</span>
        </button>
        <button onClick={() => setView('history')}
          className={`flex flex-col items-center gap-1 transition-all ${view==='history'?'text-blue-700 scale-110':'text-slate-300'}`}>
          <span className="text-2xl">📋</span>
          <span className="text-[10px] font-black">점검이력</span>
        </button>
        {isAdmin && (
          <button onClick={() => setView('stats')}
            className={`flex flex-col items-center gap-1 transition-all ${view==='stats'?'text-purple-700 scale-110':'text-slate-300'}`}>
            <span className="text-2xl">📊</span>
            <span className="text-[10px] font-black">통계</span>
          </button>
        )}
      </nav>
    </div>
  );
}
