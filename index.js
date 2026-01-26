// SumOne Phone (썸원 폰) Extension for SillyTavern
// v1.5.0 - 제출 시 AI답변+코멘트 동시 생성

import {
    saveSettingsDebounced,
    eventSource,
    event_types,
} from '../../../../script.js';

import { extension_settings } from '../../../extensions.js';

const getContext = () => SillyTavern.getContext();
const extensionName = 'sumone-phone';

// 기본 설정
const defaultSettings = {
    apps: {
        sumone: { enabled: true, name: '썸원', icon: '💕' },
    },
    wallpaper: '',
    sumoneHistory: {},
    questionPool: [],
    usedQuestions: [],
};

// 상태
let currentScreen = 'home';
let selectedDate = null;
let isGenerating = false;
let isUpdatingQuestions = false;
let todayQuestion = null;
let todayMyAnswer = null;
let todayAiAnswer = null;
let todayComment = null;
let todayRevealed = false;
let currentCalendarYear;
let currentCalendarMonth;

// 초기 질문 풀
const initialQuestions = [
    "처음 만났을 때 첫인상이 어땠어?",
    "나의 어떤 점이 제일 좋아?",
    "우리 사이에서 가장 행복했던 순간은?",
    "나한테 바라는 게 있어?",
    "같이 꼭 가보고 싶은 곳이 있어?",
    "나의 습관 중에 귀여운 거 있어?",
    "우리 10년 후에는 뭐 하고 있을까?",
    "내가 없으면 제일 먼저 뭐가 생각나?",
    "우리만의 특별한 기념일 만들까?",
    "나한테 고마운 점이 있어?",
    "같이 도전해보고 싶은 게 있어?",
    "내가 아플 때 어떻게 해줄 거야?",
    "우리 첫 데이트 기억나?",
    "나의 목소리 어때?",
    "같이 늙어가는 거 어때?",
    "나한테 하고 싶은 말 있어?",
    "우리 처음 손 잡았을 때 기억나?",
    "내가 제일 예뻐 보일 때가 언제야?",
    "나랑 있을 때 제일 행복해?",
    "우리 첫 키스 기억나?",
    "나의 어떤 모습이 제일 사랑스러워?",
    "같이 살면 어떨 것 같아?",
    "나한테 서운했던 적 있어?",
    "내가 요리해주면 뭐 먹고 싶어?",
    "우리 아이가 생기면 어떨 것 같아?",
    "나의 단점은 뭐라고 생각해?",
    "내가 울면 어떻게 해줄 거야?",
    "같이 보고 싶은 영화 있어?",
    "나한테 반한 순간이 있어?",
    "우리 결혼하면 어디서 살고 싶어?",
    "내가 없는 하루는 어때?",
    "나의 향기 좋아해?",
    "같이 듣고 싶은 노래 있어?",
    "나를 한 단어로 표현한다면?",
    "제일 기억에 남는 선물이 뭐야?",
    "내가 화났을 때 어떻게 할 거야?",
    "같이 먹고 싶은 음식 있어?",
    "나의 잠버릇 알아?",
    "우리 100일 때 뭐 했었지?",
    "내가 갑자기 사라지면 어떡할 거야?",
    "나의 가장 좋아하는 표정은?",
    "같이 배우고 싶은 거 있어?",
    "나한테 질투 느낀 적 있어?",
    "우리 늙으면 뭐 하고 싶어?",
    "내가 만든 음식 어땠어?",
    "나의 웃음소리 좋아해?",
    "같이 키우고 싶은 동물 있어?",
    "나한테 숨기는 거 있어?",
    "우리 다음 여행은 어디로 갈까?",
    "나를 처음 좋아하게 된 이유는?",
];

// ==================== 설정 ====================

function getSettings() {
    if (!extension_settings[extensionName]) {
        extension_settings[extensionName] = JSON.parse(JSON.stringify(defaultSettings));
    }
    const s = extension_settings[extensionName];
    if (!s.apps) s.apps = { ...defaultSettings.apps };
    if (!s.sumoneHistory) s.sumoneHistory = {};
    if (!s.questionPool || s.questionPool.length === 0) s.questionPool = [...initialQuestions];
    if (!s.usedQuestions) s.usedQuestions = [];
    if (s.wallpaper === undefined) s.wallpaper = '';
    return s;
}

function saveSettings() {
    saveSettingsDebounced();
}

// ==================== 유틸리티 ====================

function getCurrentTime() {
    const now = new Date();
    return `${now.getHours()}:${String(now.getMinutes()).padStart(2, '0')}`;
}

function getTodayKey() {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

function parseDate(dateKey) {
    const [year, month, day] = dateKey.split('-').map(Number);
    return new Date(year, month - 1, day);
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// ==================== 컨텍스트 ====================

function getFullContext() {
    const ctx = getContext();
    let context = '';
    
    if (ctx.characters && ctx.characterId !== undefined) {
        const char = ctx.characters[ctx.characterId];
        if (char) {
            if (char.description) context += `[Character]\n${char.description}\n\n`;
            if (char.personality) context += `[Personality]\n${char.personality}\n\n`;
            if (char.scenario) context += `[Scenario]\n${char.scenario}\n\n`;
        }
    }
    
    const chat = ctx.chat || [];
    if (chat.length > 0) {
        const userName = ctx.name1 || 'User';
        const charName = ctx.name2 || 'Character';
        context += `[Chat]\n`;
        chat.slice(-15).forEach(msg => {
            const name = msg.is_user ? userName : charName;
            const text = msg.mes?.substring(0, 200) || '';
            if (text) context += `${name}: ${text}\n`;
        });
    }
    
    return context;
}

// ==================== 질문 관리 ====================

function getQuestionFromPool() {
    const settings = getSettings();
    
    if (settings.questionPool.length === 0) {
        settings.questionPool = [...initialQuestions];
        settings.usedQuestions = [];
    }
    
    const idx = Math.floor(Math.random() * settings.questionPool.length);
    const question = settings.questionPool.splice(idx, 1)[0];
    settings.usedQuestions.push(question);
    saveSettings();
    
    if (settings.questionPool.length <= 10 && !isUpdatingQuestions) {
        generateMoreQuestions();
    }
    
    return question;
}

function showUpdatingStatus(show) {
    const el = document.getElementById('phone-updating-status');
    if (el) el.style.display = show ? 'flex' : 'none';
}

async function generateMoreQuestions() {
    if (isUpdatingQuestions) return;
    isUpdatingQuestions = true;
    showUpdatingStatus(true);
    
    const settings = getSettings();
    const prompt = `Generate 50 romantic couple Q&A questions in Korean. 10-30 chars each, one per line, no numbers. Output ONLY questions.`;

    try {
        const ctx = getContext();
        if (ctx.generateQuietPrompt) {
            const result = await ctx.generateQuietPrompt(prompt, false, true);
            const newQ = result.split('\n')
                .map(q => q.trim().replace(/^\d+[\.\)]\s*/, '').replace(/^[-•]\s*/, ''))
                .filter(q => q.length >= 8 && q.length <= 50 && q.includes('?'))
                .filter(q => !settings.usedQuestions.includes(q) && !settings.questionPool.includes(q));
            
            if (newQ.length > 0) {
                settings.questionPool.push(...newQ);
                saveSettings();
            }
        }
    } catch (e) {
        console.error('[SumOne] Question gen failed:', e);
    } finally {
        isUpdatingQuestions = false;
        showUpdatingStatus(false);
    }
}

// ==================== AI 생성 ====================

async function generateAiAnswerAndComment(question, userAnswer) {
    const ctx = getContext();
    const charName = ctx.name2 || '캐릭터';
    const userName = ctx.name1 || '사용자';
    const fullContext = getFullContext();
    
    const prompt = `${fullContext}
[커플 Q&A 앱 "썸원"]
질문: "${question}"
${userName}의 답변: "${userAnswer}"

${charName}(으)로서 두 가지를 작성하세요:
1. 질문에 대한 ${charName}의 답변 (1-2문장)
2. ${userName}의 답변에 대한 짧은 반응/코멘트 (1문장, 달달하거나 장난스럽게)

형식:
답변: (질문에 대한 답)
코멘트: (상대방 답변에 대한 반응)

액션(*), 괄호, 영어 없이 한국어로만:`;

    try {
        if (ctx.generateQuietPrompt) {
            const result = await ctx.generateQuietPrompt(prompt, false, false);
            
            // 파싱
            let answer = '';
            let comment = '';
            
            const lines = result.split('\n').map(l => l.trim()).filter(l => l);
            for (const line of lines) {
                if (line.startsWith('답변:') || line.startsWith('답:')) {
                    answer = line.replace(/^답변?:\s*/, '').replace(/\*[^*]*\*/g, '').trim();
                } else if (line.startsWith('코멘트:') || line.startsWith('반응:')) {
                    comment = line.replace(/^(코멘트|반응):\s*/, '').replace(/\*[^*]*\*/g, '').trim();
                }
            }
            
            // 형식 못 찾으면 전체를 답변으로
            if (!answer && lines.length > 0) {
                answer = lines[0].replace(/\*[^*]*\*/g, '').trim();
            }
            
            if (answer.length > 150) answer = answer.substring(0, 150);
            if (comment.length > 100) comment = comment.substring(0, 100);
            
            return { answer, comment };
        }
    } catch (e) {
        console.error('[SumOne] AI gen failed:', e);
    }
    return { answer: null, comment: null };
}

// ==================== 오늘 데이터 ====================

function getTodayData() {
    const settings = getSettings();
    const todayKey = getTodayKey();
    
    if (!settings.sumoneHistory[todayKey] || !settings.sumoneHistory[todayKey].question) {
        settings.sumoneHistory[todayKey] = {
            question: getQuestionFromPool(),
            myAnswer: null,
            aiAnswer: null,
            comment: null,
            revealed: false,
            charName: getContext().name2 || '캐릭터',
        };
        saveSettings();
    }
    
    return settings.sumoneHistory[todayKey];
}

function loadTodayUI() {
    const data = getTodayData();
    
    todayQuestion = data.question;
    todayMyAnswer = data.myAnswer;
    todayAiAnswer = data.aiAnswer;
    todayComment = data.comment;
    todayRevealed = data.revealed || false;
    
    const questionEl = document.getElementById('phone-sumone-question');
    const myAnswerEl = document.getElementById('phone-sumone-my-answer');
    const aiAnswerEl = document.getElementById('phone-sumone-ai-answer');
    const commentEl = document.getElementById('phone-sumone-comment');
    const commentBox = document.querySelector('.sumone-comment-box');
    const submitBtn = document.getElementById('phone-sumone-submit');
    const aiBox = document.querySelector('.sumone-ai-box');
    
    if (questionEl) questionEl.textContent = todayQuestion;
    
    // 이미 완료
    if (todayRevealed && todayMyAnswer) {
        if (myAnswerEl) {
            myAnswerEl.value = todayMyAnswer;
            myAnswerEl.disabled = true;
        }
        if (aiBox) aiBox.style.display = 'block';
        if (aiAnswerEl) aiAnswerEl.textContent = todayAiAnswer || '';
        if (commentEl && commentBox) {
            if (todayComment) {
                commentEl.textContent = todayComment;
                commentBox.style.display = 'block';
            } else {
                commentBox.style.display = 'none';
            }
        }
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.textContent = '오늘 완료 ✓';
        }
        return;
    }
    
    // 미완료 - 입력 대기
    if (myAnswerEl) {
        myAnswerEl.value = '';
        myAnswerEl.disabled = false;
    }
    if (aiBox) aiBox.style.display = 'none';
    if (commentBox) commentBox.style.display = 'none';
    if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = '제출하기';
    }
}

// ==================== 제출 ====================

async function handleSubmit() {
    const myAnswerEl = document.getElementById('phone-sumone-my-answer');
    const submitBtn = document.getElementById('phone-sumone-submit');
    const aiAnswerEl = document.getElementById('phone-sumone-ai-answer');
    const aiBox = document.querySelector('.sumone-ai-box');
    const commentEl = document.getElementById('phone-sumone-comment');
    const commentBox = document.querySelector('.sumone-comment-box');
    
    if (!myAnswerEl || !submitBtn || isGenerating) return;
    
    const answer = myAnswerEl.value.trim();
    if (!answer) {
        toastr.warning('답변을 입력해주세요!');
        return;
    }
    
    todayMyAnswer = answer;
    myAnswerEl.disabled = true;
    submitBtn.disabled = true;
    submitBtn.textContent = '생성 중...';
    
    isGenerating = true;
    
    // AI 답변 + 코멘트 동시 생성
    const { answer: aiAnswer, comment } = await generateAiAnswerAndComment(todayQuestion, todayMyAnswer);
    
    isGenerating = false;
    
    if (!aiAnswer) {
        toastr.error('생성 실패. 다시 시도해주세요.');
        myAnswerEl.disabled = false;
        submitBtn.disabled = false;
        submitBtn.textContent = '제출하기';
        return;
    }
    
    todayAiAnswer = aiAnswer;
    todayComment = comment;
    todayRevealed = true;
    
    // 저장
    const settings = getSettings();
    const todayKey = getTodayKey();
    settings.sumoneHistory[todayKey] = {
        question: todayQuestion,
        myAnswer: todayMyAnswer,
        aiAnswer: todayAiAnswer,
        comment: todayComment,
        revealed: true,
        charName: getContext().name2 || '캐릭터',
    };
    saveSettings();
    
    // UI
    if (aiBox) aiBox.style.display = 'block';
    if (aiAnswerEl) aiAnswerEl.textContent = todayAiAnswer;
    if (commentEl && commentBox && todayComment) {
        commentEl.textContent = todayComment;
        commentBox.style.display = 'block';
    }
    submitBtn.textContent = '오늘 완료 ✓';
    
    toastr.success('💕 답변이 공개되었습니다!');
}

// ==================== HTML ====================

function createPhoneHTML() {
    return `
    <div id="phone-modal" class="phone-modal" style="display: none;">
        <div class="phone-device">
            <div class="phone-inner">
                <div class="phone-status-bar">
                    <span class="phone-time">${getCurrentTime()}</span>
                    <div class="phone-notch-area"></div>
                    <div class="phone-status-icons">
                        <span class="phone-signal">●●●●○</span>
                        <span class="phone-battery">🔋</span>
                    </div>
                </div>
                <div id="phone-updating-status" class="phone-updating-status" style="display: none;">
                    <span>🔄 질문 업데이트 중...</span>
                </div>
                <div class="phone-screen">
                    <div class="phone-page active" data-page="home">
                        <div class="phone-app-grid" id="phone-app-grid"></div>
                    </div>
                    <div class="phone-page" data-page="sumone">
                        <div class="app-header">
                            <button class="app-back-btn" data-back="home">◀</button>
                            <span class="app-title">썸원</span>
                            <button class="sumone-history-btn">📅</button>
                        </div>
                        <div class="app-content sumone-app">
                            <div class="sumone-question-box">
                                <div class="sumone-label">오늘의 질문</div>
                                <div class="sumone-question" id="phone-sumone-question">로딩 중...</div>
                            </div>
                            <div class="sumone-answer-box">
                                <div class="sumone-label">나의 답변</div>
                                <textarea id="phone-sumone-my-answer" placeholder="답변을 입력하세요..."></textarea>
                                <button id="phone-sumone-submit" class="sumone-submit-btn">제출하기</button>
                            </div>
                            <div class="sumone-ai-box" style="display: none;">
                                <div class="sumone-label"><span class="sumone-char-name"></span>의 답변</div>
                                <div class="sumone-ai-answer" id="phone-sumone-ai-answer"></div>
                            </div>
                            <div class="sumone-comment-box" style="display: none;">
                                <div class="sumone-label"><span class="sumone-char-name"></span>의 코멘트</div>
                                <div class="sumone-comment" id="phone-sumone-comment"></div>
                            </div>
                        </div>
                    </div>
                    <div class="phone-page" data-page="sumone-history">
                        <div class="app-header">
                            <button class="app-back-btn" data-back="sumone">◀</button>
                            <span class="app-title">히스토리</span>
                            <span></span>
                        </div>
                        <div class="app-content sumone-history">
                            <div class="calendar-header">
                                <button id="phone-cal-prev">◀</button>
                                <span id="phone-cal-title">2026년 1월</span>
                                <button id="phone-cal-next">▶</button>
                            </div>
                            <div class="calendar-grid" id="phone-calendar"></div>
                            <div class="history-detail" id="phone-history-detail">
                                <div class="history-placeholder">날짜를 선택하세요</div>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="phone-home-bar"></div>
            </div>
        </div>
    </div>`;
}

// ==================== 앱 ====================

function renderAppGrid() {
    const grid = document.getElementById('phone-app-grid');
    if (!grid) return;
    const settings = getSettings();
    
    const homeScreen = document.querySelector('.phone-page[data-page="home"]');
    if (homeScreen) {
        homeScreen.style.backgroundImage = settings.wallpaper ? `url(${settings.wallpaper})` : '';
        homeScreen.style.backgroundSize = 'cover';
        homeScreen.style.backgroundPosition = 'center';
    }
    
    let html = '';
    for (const [appId, app] of Object.entries(settings.apps)) {
        if (app.enabled) {
            html += `<div class="phone-app-icon" data-app="${appId}">
                <div class="app-icon-image">${app.icon}</div>
                <div class="app-icon-label">${app.name}</div>
            </div>`;
        }
    }
    grid.innerHTML = html;
    grid.querySelectorAll('.phone-app-icon').forEach(el => {
        el.addEventListener('click', () => openApp(el.dataset.app));
    });
}

function switchPage(pageName) {
    currentScreen = pageName;
    document.querySelectorAll('.phone-page').forEach(el => {
        el.classList.toggle('active', el.dataset.page === pageName);
    });
}

function openApp(appId) {
    if (appId === 'sumone') {
        const ctx = getContext();
        if (ctx.characterId === undefined && !ctx.groupId) {
            toastr.warning('먼저 캐릭터를 선택해주세요.');
            return;
        }
        switchPage('sumone');
        updateCharacterName();
        loadTodayUI();
    }
}

function updateCharacterName() {
    const charName = getContext().name2 || '캐릭터';
    document.querySelectorAll('.sumone-char-name').forEach(el => el.textContent = charName);
}

// ==================== 캘린더 ====================

function renderCalendar(year, month) {
    const calendar = document.getElementById('phone-calendar');
    const title = document.getElementById('phone-cal-title');
    if (!calendar || !title) return;
    
    const settings = getSettings();
    title.textContent = `${year}년 ${month + 1}월`;
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startDay = firstDay.getDay();
    const totalDays = lastDay.getDate();
    const todayKey = getTodayKey();
    
    let html = '<div class="cal-weekdays"><span>일</span><span>월</span><span>화</span><span>수</span><span>목</span><span>금</span><span>토</span></div><div class="cal-days">';
    for (let i = 0; i < startDay; i++) html += '<span class="cal-day empty"></span>';
    for (let day = 1; day <= totalDays; day++) {
        const dateKey = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const hasRecord = settings.sumoneHistory[dateKey]?.revealed;
        const isToday = dateKey === todayKey;
        const isSelected = dateKey === selectedDate;
        let cls = 'cal-day';
        if (hasRecord) cls += ' has-record';
        if (isToday) cls += ' today';
        if (isSelected) cls += ' selected';
        html += `<span class="${cls}" data-date="${dateKey}">${day}</span>`;
    }
    html += '</div>';
    calendar.innerHTML = html;
    
    calendar.querySelectorAll('.cal-day:not(.empty)').forEach(el => {
        el.addEventListener('click', () => {
            selectedDate = el.dataset.date;
            renderCalendar(year, month);
            showHistoryDetail(selectedDate);
        });
    });
}

function showHistoryDetail(dateKey) {
    const detail = document.getElementById('phone-history-detail');
    if (!detail) return;
    const settings = getSettings();
    const record = settings.sumoneHistory[dateKey];
    const date = parseDate(dateKey);
    const charName = record?.charName || '캐릭터';
    
    if (!record?.revealed) {
        detail.innerHTML = `<div class="history-date">${date.getMonth() + 1}월 ${date.getDate()}일</div><div class="history-placeholder">기록이 없습니다</div>`;
        return;
    }
    
    let html = `
        <div class="history-date">${date.getMonth() + 1}월 ${date.getDate()}일</div>
        <div class="history-item"><span class="history-label">Q</span><span class="history-text">${escapeHtml(record.question)}</span></div>
        <div class="history-item"><span class="history-label">나</span><span class="history-text">${escapeHtml(record.myAnswer)}</span></div>
        <div class="history-item"><span class="history-label">${escapeHtml(charName)}</span><span class="history-text">${escapeHtml(record.aiAnswer)}</span></div>`;
    
    if (record.comment) {
        html += `<div class="history-item history-comment"><span class="history-label">💬</span><span class="history-text">${escapeHtml(record.comment)}</span></div>`;
    }
    
    detail.innerHTML = html;
}

// ==================== 기타 ====================

function updateTime() {
    const el = document.querySelector('.phone-time');
    if (el) el.textContent = getCurrentTime();
}

function setWallpaper(dataUrl) {
    getSettings().wallpaper = dataUrl;
    saveSettings();
    renderAppGrid();
}

function openPhoneModal() {
    const modal = document.getElementById('phone-modal');
    if (modal) {
        modal.style.display = 'flex';
        switchPage('home');
        renderAppGrid();
        updateTime();
    }
}

function closePhoneModal() {
    const modal = document.getElementById('phone-modal');
    if (modal) modal.style.display = 'none';
}

// ==================== 이벤트 ====================

function setupEvents() {
    const modal = document.getElementById('phone-modal');
    if (!modal) return;
    
    modal.addEventListener('click', (e) => { if (e.target === modal) closePhoneModal(); });
    
    modal.querySelectorAll('.app-back-btn').forEach(btn => {
        btn.addEventListener('click', () => switchPage(btn.dataset.back));
    });
    
    modal.querySelector('.sumone-history-btn')?.addEventListener('click', () => {
        const now = new Date();
        currentCalendarYear = now.getFullYear();
        currentCalendarMonth = now.getMonth();
        switchPage('sumone-history');
        renderCalendar(currentCalendarYear, currentCalendarMonth);
        selectedDate = getTodayKey();
        showHistoryDetail(selectedDate);
    });
    
    document.getElementById('phone-sumone-submit')?.addEventListener('click', handleSubmit);
    document.getElementById('phone-sumone-my-answer')?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSubmit(); }
    });
    
    document.getElementById('phone-cal-prev')?.addEventListener('click', () => {
        currentCalendarMonth--;
        if (currentCalendarMonth < 0) { currentCalendarMonth = 11; currentCalendarYear--; }
        renderCalendar(currentCalendarYear, currentCalendarMonth);
    });
    document.getElementById('phone-cal-next')?.addEventListener('click', () => {
        currentCalendarMonth++;
        if (currentCalendarMonth > 11) { currentCalendarMonth = 0; currentCalendarYear++; }
        renderCalendar(currentCalendarYear, currentCalendarMonth);
    });
    
    setInterval(updateTime, 60000);
}

// ==================== 설정 UI ====================

function createSettingsUI() {
    const settings = getSettings();
    
    const html = `
        <div class="sumone-phone-settings">
            <div class="inline-drawer">
                <div class="inline-drawer-toggle inline-drawer-header">
                    <b>📱 썸원 폰</b>
                    <div class="inline-drawer-icon fa-solid fa-circle-chevron-down down"></div>
                </div>
                <div class="inline-drawer-content">
                    <p style="margin:10px 0;opacity:0.7;">v1.5.0</p>
                    <div style="margin:15px 0;">
                        <b>앱 표시</b>
                        ${Object.entries(settings.apps).map(([id, app]) => `
                            <label style="display:flex;align-items:center;gap:8px;margin:8px 0;cursor:pointer;">
                                <input type="checkbox" class="phone-app-toggle" data-app="${id}" ${app.enabled ? 'checked' : ''}>
                                <span>${app.icon} ${app.name}</span>
                            </label>`).join('')}
                    </div>
                    <div style="margin:15px 0;">
                        <b>질문 풀:</b> ${settings.questionPool.length}개
                    </div>
                    <div style="margin:15px 0;">
                        <b>배경화면</b>
                        <input type="file" id="phone-wallpaper-input" accept="image/*" style="display:none;">
                        <button id="phone-wallpaper-btn" class="menu_button" style="width:100%;margin-top:5px;">이미지 선택</button>
                        <button id="phone-wallpaper-reset" class="menu_button" style="width:100%;margin-top:5px;">기본으로</button>
                    </div>
                </div>
            </div>
        </div>`;
    
    $('#extensions_settings').append(html);
    
    $('.phone-app-toggle').on('change', function() {
        getSettings().apps[$(this).data('app')].enabled = this.checked;
        saveSettings();
        renderAppGrid();
    });
    
    $('#phone-wallpaper-btn').on('click', () => $('#phone-wallpaper-input').click());
    $('#phone-wallpaper-input').on('change', function() {
        const file = this.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (e) => { setWallpaper(e.target.result); toastr.success('배경화면 변경!'); };
            reader.readAsDataURL(file);
        }
    });
    $('#phone-wallpaper-reset').on('click', () => { setWallpaper(''); toastr.info('기본으로 복원'); });
}

// ==================== 메뉴 버튼 ====================

function addMenuButton() {
    $('#sumone-phone-container').remove();
    const html = `
        <div id="sumone-phone-container" class="extension_container interactable" tabindex="0">
            <div id="sumone-phone-btn" class="list-group-item flex-container flexGap5 interactable" tabindex="0">
                <div class="fa-solid fa-mobile-screen extensionsMenuExtensionButton" style="color:#ff6b9d;"></div>
                <span>썸원 폰</span>
            </div>
        </div>`;
    $('#extensionsMenu').prepend(html);
    $('#sumone-phone-btn').on('click', openPhoneModal);
}

// ==================== 초기화 ====================

jQuery(() => {
    console.log('[SumOne Phone] Loading v1.5.0...');
    getSettings();
    createSettingsUI();
    $('body').append(createPhoneHTML());
    setupEvents();
    setTimeout(addMenuButton, 1000);
    eventSource.on(event_types.CHAT_CHANGED, updateCharacterName);
    console.log('[SumOne Phone] Loaded!');
});
