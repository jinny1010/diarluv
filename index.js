// SumOne Phone (썸원 폰) Extension for SillyTavern
// 스마트폰 스타일 UI로 다양한 앱 제공

import {
    saveSettingsDebounced,
    eventSource,
    event_types,
} from '../../../../script.js';

import { extension_settings } from '../../../extensions.js';

// SillyTavern context
const getContext = () => SillyTavern.getContext();

// generateQuietPrompt 가져오기 (답변 생성용 - 컨텍스트 포함)
async function generateWithContext(prompt) {
    const context = getContext();
    if (context.generateQuietPrompt) {
        return await context.generateQuietPrompt(prompt, false, false);
    }
    if (context.generate) {
        return await context.generate(prompt, { quiet: true });
    }
    throw new Error('generate function not available');
}

// 컨텍스트 없이 간단한 생성 (질문 생성용)
async function generateSimple(prompt) {
    const context = getContext();
    // generateRaw 또는 간단한 요청
    if (context.generateQuietPrompt) {
        // 빈 컨텍스트로 생성하도록 시스템 프롬프트만 사용
        return await context.generateQuietPrompt(prompt, false, true); // skipWIAN = true
    }
    throw new Error('generate function not available');
}

const extensionName = 'sumone-phone';

// 기본 설정
const defaultSettings = {
    apps: {
        sumone: { enabled: true, name: '썸원', icon: '💕' },
        // 나중에 추가할 앱들...
    },
    wallpaper: '', // base64 이미지
    sumoneHistory: {}, // { "2026-01-25": { question, myAnswer, aiAnswer, charName } }
};

// 현재 상태
let currentScreen = 'home'; // 'home' | 'sumone' | 'sumone-history'
let selectedDate = null;
let isGenerating = false;
let todayQuestion = null;
let todayMyAnswer = null;
let todayAiAnswer = null;
let currentCalendarYear;
let currentCalendarMonth;

// 보편적인 연애 질문 목록 (AI 생성 실패시 fallback)
const defaultQuestions = [
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
];

/**
 * 설정 초기화
 */
function loadSettings() {
    extension_settings[extensionName] = extension_settings[extensionName] || {};
    
    if (!extension_settings[extensionName].apps) {
        extension_settings[extensionName].apps = { ...defaultSettings.apps };
    }
    if (!extension_settings[extensionName].sumoneHistory) {
        extension_settings[extensionName].sumoneHistory = {};
    }
    if (extension_settings[extensionName].wallpaper === undefined) {
        extension_settings[extensionName].wallpaper = '';
    }
}

/**
 * 현재 시간 문자열
 */
function getCurrentTime() {
    const now = new Date();
    return `${now.getHours()}:${String(now.getMinutes()).padStart(2, '0')}`;
}

/**
 * 오늘 날짜 키
 */
function getTodayKey() {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

/**
 * 날짜 파싱
 */
function parseDate(dateKey) {
    const [year, month, day] = dateKey.split('-').map(Number);
    return new Date(year, month - 1, day);
}

/**
 * HTML 이스케이프
 */
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

/**
 * 폰 모달 HTML 생성
 */
function createPhoneHTML() {
    const wallpaper = extension_settings[extensionName]?.wallpaper || '';
    const wallpaperStyle = wallpaper ? `background-image: url(${wallpaper}); background-size: cover; background-position: center;` : '';
    
    return `
    <div id="phone-modal" class="phone-modal" style="display: none;">
        <div class="phone-device">
            <!-- 노치 -->
            <div class="phone-notch"></div>
            
            <!-- 상단 바 -->
            <div class="phone-status-bar">
                <span class="phone-time">${getCurrentTime()}</span>
                <div class="phone-status-icons">
                    <span class="phone-signal">●●●●○</span>
                    <span class="phone-battery">100%🔋</span>
                </div>
            </div>
            
            <!-- 메인 스크린 -->
            <div class="phone-screen" style="${wallpaperStyle}">
                <!-- 홈 화면 -->
                <div class="phone-page active" data-page="home">
                    <div class="phone-app-grid" id="phone-app-grid">
                        <!-- 앱 아이콘들 -->
                    </div>
                </div>
                
                <!-- 썸원 앱 -->
                <div class="phone-page" data-page="sumone">
                    <div class="app-header">
                        <button class="app-back-btn" data-back="home">◀</button>
                        <span class="app-title">썸원</span>
                        <button class="sumone-history-btn">📅</button>
                    </div>
                    <div class="app-content sumone-app">
                        <div class="sumone-question-box">
                            <div class="sumone-label">오늘의 질문</div>
                            <div class="sumone-question" id="phone-sumone-question">질문 생성 중...</div>
                        </div>
                        
                        <div class="sumone-answer-box">
                            <div class="sumone-label">나의 답변</div>
                            <textarea id="phone-sumone-my-answer" placeholder="답변을 입력하세요..."></textarea>
                            <button id="phone-sumone-submit" class="sumone-submit-btn">제출</button>
                        </div>
                        
                        <div class="sumone-ai-box">
                            <div class="sumone-label"><span class="sumone-char-name"></span>의 답변</div>
                            <div class="sumone-ai-answer" id="phone-sumone-ai-answer">
                                <div class="sumone-hidden">???</div>
                            </div>
                        </div>
                    </div>
                </div>
                
                <!-- 썸원 히스토리 -->
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
            
            <!-- 홈 버튼 -->
            <div class="phone-home-bar"></div>
        </div>
    </div>
    `;
}

/**
 * 앱 그리드 렌더링
 */
function renderAppGrid() {
    const grid = document.getElementById('phone-app-grid');
    if (!grid) return;
    
    const apps = extension_settings[extensionName]?.apps || {};
    
    let html = '';
    for (const [appId, app] of Object.entries(apps)) {
        if (app.enabled) {
            html += `
                <div class="phone-app-icon" data-app="${appId}">
                    <div class="app-icon-image">${app.icon}</div>
                    <div class="app-icon-label">${app.name}</div>
                </div>
            `;
        }
    }
    
    grid.innerHTML = html;
    
    // 앱 클릭 이벤트
    grid.querySelectorAll('.phone-app-icon').forEach(el => {
        el.addEventListener('click', () => {
            const appId = el.dataset.app;
            openApp(appId);
        });
    });
}

/**
 * 페이지 전환
 */
function switchPage(pageName) {
    currentScreen = pageName;
    document.querySelectorAll('.phone-page').forEach(el => {
        el.classList.toggle('active', el.dataset.page === pageName);
    });
}

/**
 * 앱 열기
 */
async function openApp(appId) {
    if (appId === 'sumone') {
        const ctx = getContext();
        if (ctx.characterId === undefined && !ctx.groupId) {
            toastr.warning('먼저 캐릭터를 선택해주세요.');
            return;
        }
        
        switchPage('sumone');
        updateCharacterName();
        
        const hasToday = loadTodayData();
        if (!hasToday) {
            resetTodayUI();
            await generateQuestion();
        }
    }
}

/**
 * 캐릭터 이름 업데이트
 */
function updateCharacterName() {
    const ctx = getContext();
    const charName = ctx.name2 || '캐릭터';
    document.querySelectorAll('.sumone-char-name').forEach(el => {
        el.textContent = charName;
    });
}

/**
 * 질문 생성 (보편적인 연애 질문 - 컨텍스트 없음)
 */
async function generateQuestion() {
    const questionEl = document.getElementById('phone-sumone-question');
    if (!questionEl) return;
    
    questionEl.textContent = '질문 생성 중...';
    
    // 이전 질문들 (중복 방지)
    const history = extension_settings[extensionName]?.sumoneHistory || {};
    const previousQuestions = Object.values(history)
        .filter(h => h.question)
        .map(h => h.question)
        .slice(-10);
    
    // 간단한 프롬프트 - 컨텍스트 없이 그냥 연애 질문만
    const prompt = `Generate ONE romantic/relationship question in Korean for a couple's Q&A app.

${previousQuestions.length > 0 ? `Avoid these recent questions:\n- ${previousQuestions.join('\n- ')}\n` : ''}

Rules:
- Question must be in Korean
- 15-40 characters only
- About: feelings, memories, future, preferences, hypotheticals
- Generic couple question (not character-specific)
- Output ONLY the question, nothing else
- No quotes around the question

Examples of good questions:
- 처음 만났을 때 첫인상이 어땠어?
- 나의 어떤 점이 제일 좋아?
- 같이 꼭 가보고 싶은 곳이 있어?`;

    try {
        console.log('[SumOne] Generating question...');
        const result = await generateSimple(prompt);
        todayQuestion = result.trim().replace(/^["'"""]+|["'"""]+$/g, '');
        
        // 너무 길거나 이상하면 fallback
        if (todayQuestion.length > 100 || todayQuestion.length < 5) {
            throw new Error('Invalid question generated');
        }
        
        questionEl.textContent = todayQuestion;
        console.log('[SumOne] Question:', todayQuestion);
    } catch (error) {
        console.error('[SumOne] Question generation failed, using fallback:', error);
        // Fallback: 미리 정의된 질문에서 랜덤 선택
        const availableQuestions = defaultQuestions.filter(q => !previousQuestions.includes(q));
        const pool = availableQuestions.length > 0 ? availableQuestions : defaultQuestions;
        todayQuestion = pool[Math.floor(Math.random() * pool.length)];
        questionEl.textContent = todayQuestion;
    }
}

/**
 * AI 답변 생성 (캐릭터 컨텍스트 포함)
 */
async function generateAiAnswer(question, myAnswer) {
    const ctx = getContext();
    const charName = ctx.name2 || '캐릭터';
    const userName = ctx.name1 || '사용자';
    
    const aiAnswerEl = document.getElementById('phone-sumone-ai-answer');
    if (!aiAnswerEl) return;
    
    aiAnswerEl.innerHTML = '<span class="sumone-loading">답변 생성 중...</span>';
    isGenerating = true;
    
    const prompt = `[SumOne Q&A - Answer this question as ${charName}]

Question: "${question}"
${userName}'s answer: "${myAnswer}"

Now ${charName} must answer the same question. Rules:
- Answer in Korean as ${charName} would
- Stay completely in character
- Be genuine and emotional
- 30-150 characters
- Just the answer, no meta commentary`;

    try {
        console.log('[SumOne] Generating AI answer...');
        const result = await generateWithContext(prompt);
        todayAiAnswer = result.trim().replace(/^["'"""]+|["'"""]+$/g, '');
        aiAnswerEl.textContent = todayAiAnswer;
        console.log('[SumOne] AI Answer:', todayAiAnswer);
        
        saveTodayData();
    } catch (error) {
        console.error('[SumOne] AI answer failed:', error);
        aiAnswerEl.textContent = '답변 생성에 실패했습니다.';
        toastr.error('답변 생성 실패: ' + error.message);
    } finally {
        isGenerating = false;
    }
}

/**
 * 오늘 데이터 저장
 */
function saveTodayData() {
    const todayKey = getTodayKey();
    const ctx = getContext();
    
    if (!extension_settings[extensionName].sumoneHistory) {
        extension_settings[extensionName].sumoneHistory = {};
    }
    
    extension_settings[extensionName].sumoneHistory[todayKey] = {
        question: todayQuestion,
        myAnswer: todayMyAnswer,
        aiAnswer: todayAiAnswer,
        charName: ctx.name2 || '캐릭터',
    };
    
    saveSettingsDebounced();
}

/**
 * 오늘 데이터 불러오기
 */
function loadTodayData() {
    const todayKey = getTodayKey();
    const history = extension_settings[extensionName]?.sumoneHistory || {};
    const data = history[todayKey];
    
    if (data && data.question) {
        todayQuestion = data.question;
        todayMyAnswer = data.myAnswer;
        todayAiAnswer = data.aiAnswer;
        
        const questionEl = document.getElementById('phone-sumone-question');
        const myAnswerEl = document.getElementById('phone-sumone-my-answer');
        const aiAnswerEl = document.getElementById('phone-sumone-ai-answer');
        const submitBtn = document.getElementById('phone-sumone-submit');
        
        if (questionEl) questionEl.textContent = todayQuestion;
        if (myAnswerEl) {
            myAnswerEl.value = todayMyAnswer || '';
            if (todayMyAnswer) myAnswerEl.disabled = true;
        }
        if (aiAnswerEl) {
            aiAnswerEl.textContent = todayAiAnswer || '';
            if (!todayAiAnswer) aiAnswerEl.innerHTML = '<div class="sumone-hidden">???</div>';
        }
        if (submitBtn && todayMyAnswer) {
            submitBtn.disabled = true;
            submitBtn.textContent = '완료';
        }
        
        return true;
    }
    return false;
}

/**
 * 오늘 UI 리셋
 */
function resetTodayUI() {
    todayQuestion = null;
    todayMyAnswer = null;
    todayAiAnswer = null;
    
    const myAnswerEl = document.getElementById('phone-sumone-my-answer');
    const aiAnswerEl = document.getElementById('phone-sumone-ai-answer');
    const submitBtn = document.getElementById('phone-sumone-submit');
    
    if (myAnswerEl) {
        myAnswerEl.value = '';
        myAnswerEl.disabled = false;
    }
    if (aiAnswerEl) {
        aiAnswerEl.innerHTML = '<div class="sumone-hidden">???</div>';
    }
    if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = '제출';
    }
}

/**
 * 제출 처리
 */
async function handleSubmit() {
    const myAnswerEl = document.getElementById('phone-sumone-my-answer');
    const submitBtn = document.getElementById('phone-sumone-submit');
    
    if (!myAnswerEl || !submitBtn || isGenerating) return;
    
    const answer = myAnswerEl.value.trim();
    if (!answer) {
        toastr.warning('답변을 입력해주세요!');
        return;
    }
    
    if (!todayQuestion) {
        toastr.warning('질문이 준비되지 않았습니다.');
        return;
    }
    
    todayMyAnswer = answer;
    myAnswerEl.disabled = true;
    submitBtn.disabled = true;
    submitBtn.textContent = '생성 중...';
    
    await generateAiAnswer(todayQuestion, todayMyAnswer);
    
    submitBtn.textContent = '완료';
}

/**
 * 달력 렌더링
 */
function renderCalendar(year, month) {
    const calendar = document.getElementById('phone-calendar');
    const title = document.getElementById('phone-cal-title');
    
    if (!calendar || !title) return;
    
    title.textContent = `${year}년 ${month + 1}월`;
    
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startDay = firstDay.getDay();
    const totalDays = lastDay.getDate();
    const todayKey = getTodayKey();
    const history = extension_settings[extensionName]?.sumoneHistory || {};
    
    let html = '<div class="cal-weekdays"><span>일</span><span>월</span><span>화</span><span>수</span><span>목</span><span>금</span><span>토</span></div><div class="cal-days">';
    
    for (let i = 0; i < startDay; i++) {
        html += '<span class="cal-day empty"></span>';
    }
    
    for (let day = 1; day <= totalDays; day++) {
        const dateKey = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const hasRecord = history[dateKey]?.question;
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

/**
 * 히스토리 상세
 */
function showHistoryDetail(dateKey) {
    const detail = document.getElementById('phone-history-detail');
    if (!detail) return;
    
    const history = extension_settings[extensionName]?.sumoneHistory || {};
    const record = history[dateKey];
    const date = parseDate(dateKey);
    
    if (!record?.question) {
        detail.innerHTML = `<div class="history-date">${date.getMonth() + 1}월 ${date.getDate()}일</div><div class="history-placeholder">기록이 없습니다</div>`;
        return;
    }
    
    detail.innerHTML = `
        <div class="history-date">${date.getMonth() + 1}월 ${date.getDate()}일</div>
        <div class="history-item"><span class="history-label">Q</span><span class="history-text">${escapeHtml(record.question)}</span></div>
        <div class="history-item"><span class="history-label">나</span><span class="history-text">${escapeHtml(record.myAnswer)}</span></div>
        <div class="history-item"><span class="history-label">${escapeHtml(record.charName || '캐릭터')}</span><span class="history-text">${escapeHtml(record.aiAnswer)}</span></div>
    `;
}

/**
 * 시간 업데이트
 */
function updateTime() {
    const timeEl = document.querySelector('.phone-time');
    if (timeEl) {
        timeEl.textContent = getCurrentTime();
    }
}

/**
 * 배경화면 변경
 */
function setWallpaper(dataUrl) {
    extension_settings[extensionName].wallpaper = dataUrl;
    saveSettingsDebounced();
    
    const screen = document.querySelector('.phone-screen');
    if (screen) {
        if (dataUrl) {
            screen.style.backgroundImage = `url(${dataUrl})`;
            screen.style.backgroundSize = 'cover';
            screen.style.backgroundPosition = 'center';
        } else {
            screen.style.backgroundImage = '';
        }
    }
}

/**
 * 모달 열기/닫기
 */
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
    if (modal) {
        modal.style.display = 'none';
    }
}

/**
 * 이벤트 설정
 */
function setupEvents() {
    const modal = document.getElementById('phone-modal');
    if (!modal) return;
    
    // 모달 바깥 클릭시 닫기
    modal.addEventListener('click', (e) => {
        if (e.target === modal) closePhoneModal();
    });
    
    // 뒤로가기 버튼들
    modal.querySelectorAll('.app-back-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const backTo = btn.dataset.back;
            switchPage(backTo);
        });
    });
    
    // 썸원 히스토리 버튼
    modal.querySelector('.sumone-history-btn')?.addEventListener('click', () => {
        const now = new Date();
        currentCalendarYear = now.getFullYear();
        currentCalendarMonth = now.getMonth();
        switchPage('sumone-history');
        renderCalendar(currentCalendarYear, currentCalendarMonth);
    });
    
    // 제출 버튼
    document.getElementById('phone-sumone-submit')?.addEventListener('click', handleSubmit);
    
    // Enter 키
    document.getElementById('phone-sumone-my-answer')?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSubmit();
        }
    });
    
    // 달력 네비게이션
    document.getElementById('phone-cal-prev')?.addEventListener('click', () => {
        currentCalendarMonth--;
        if (currentCalendarMonth < 0) {
            currentCalendarMonth = 11;
            currentCalendarYear--;
        }
        renderCalendar(currentCalendarYear, currentCalendarMonth);
    });
    
    document.getElementById('phone-cal-next')?.addEventListener('click', () => {
        currentCalendarMonth++;
        if (currentCalendarMonth > 11) {
            currentCalendarMonth = 0;
            currentCalendarYear++;
        }
        renderCalendar(currentCalendarYear, currentCalendarMonth);
    });
    
    // 시간 업데이트 (1분마다)
    setInterval(updateTime, 60000);
}

/**
 * 설정 UI 생성
 */
function createSettingsUI() {
    const apps = extension_settings[extensionName]?.apps || {};
    
    const settingsHtml = `
        <div class="sumone-phone-settings">
            <div class="inline-drawer">
                <div class="inline-drawer-toggle inline-drawer-header">
                    <b>📱 썸원 폰</b>
                    <div class="inline-drawer-icon fa-solid fa-circle-chevron-down down"></div>
                </div>
                <div class="inline-drawer-content">
                    <p style="margin: 10px 0; opacity: 0.8;">스마트폰 스타일 앱 모음</p>
                    
                    <div style="margin: 15px 0;">
                        <b>앱 표시 설정</b>
                        ${Object.entries(apps).map(([id, app]) => `
                            <label style="display:flex; align-items:center; gap:8px; margin:8px 0; cursor:pointer;">
                                <input type="checkbox" class="phone-app-toggle" data-app="${id}" ${app.enabled ? 'checked' : ''}>
                                <span>${app.icon} ${app.name}</span>
                            </label>
                        `).join('')}
                    </div>
                    
                    <div style="margin: 15px 0;">
                        <b>배경화면</b>
                        <div style="margin-top: 8px;">
                            <input type="file" id="phone-wallpaper-input" accept="image/*" style="display:none;">
                            <button id="phone-wallpaper-btn" class="menu_button" style="width:100%;">
                                <i class="fa-solid fa-image"></i> 이미지 선택
                            </button>
                            <button id="phone-wallpaper-reset" class="menu_button" style="width:100%; margin-top:5px;">
                                <i class="fa-solid fa-rotate-left"></i> 기본으로 복원
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    $('#extensions_settings').append(settingsHtml);
    
    // 앱 토글
    $('.phone-app-toggle').on('change', function() {
        const appId = $(this).data('app');
        extension_settings[extensionName].apps[appId].enabled = this.checked;
        saveSettingsDebounced();
        renderAppGrid();
    });
    
    // 배경화면 선택
    $('#phone-wallpaper-btn').on('click', () => {
        $('#phone-wallpaper-input').click();
    });
    
    $('#phone-wallpaper-input').on('change', function() {
        const file = this.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (e) => {
                setWallpaper(e.target.result);
                toastr.success('배경화면이 변경되었습니다!');
            };
            reader.readAsDataURL(file);
        }
    });
    
    $('#phone-wallpaper-reset').on('click', () => {
        setWallpaper('');
        toastr.info('배경화면이 기본으로 복원되었습니다.');
    });
}

/**
 * 메뉴 버튼 추가
 */
function addMenuButton() {
    $('#sumone-phone-container').remove();
    
    const buttonHtml = `
        <div id="sumone-phone-container" class="extension_container interactable" tabindex="0">
            <div id="sumone-phone-btn" class="list-group-item flex-container flexGap5 interactable" tabindex="0" role="listitem">
                <div class="fa-solid fa-mobile-screen extensionsMenuExtensionButton" style="color: #ff6b9d;"></div>
                <span>썸원 폰</span>
            </div>
        </div>
    `;
    
    $('#extensionsMenu').prepend(buttonHtml);
    $('#sumone-phone-btn').on('click', openPhoneModal);
}

/**
 * 초기화
 */
jQuery(async () => {
    console.log('[SumOne Phone] Loading...');
    
    loadSettings();
    createSettingsUI();
    
    $('body').append(createPhoneHTML());
    setupEvents();
    
    setTimeout(addMenuButton, 1000);
    
    eventSource.on(event_types.CHAT_CHANGED, () => {
        updateCharacterName();
    });
    
    console.log('[SumOne Phone] Loaded!');
});
