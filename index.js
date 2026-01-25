import {
    extension_settings,
    getContext,
    saveSettingsDebounced,
} from '../../../extensions.js';

import {
    generateQuietPrompt,
} from '../../../../script.js';

import {
    eventSource,
    event_types,
} from '../../../../script.js';

const extensionName = 'sumone';
const extensionFolderPath = `scripts/extensions/third_party/${extensionName}`;

// 기본 설정
const defaultSettings = {
    enabled: true,
    history: {}, // { "2026-01-25": { question: "...", myAnswer: "...", aiAnswer: "..." } }
};

// 현재 상태
let currentTab = 'today';
let selectedDate = null;
let isGenerating = false;
let todayQuestion = null;
let todayMyAnswer = null;
let todayAiAnswer = null;

// 초기화
async function loadSettings() {
    extension_settings[extensionName] = extension_settings[extensionName] || {};
    Object.assign(extension_settings[extensionName], {
        ...defaultSettings,
        ...extension_settings[extensionName],
    });
}

// 오늘 날짜 키 생성
function getTodayKey() {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

// 날짜 파싱
function parseDate(dateKey) {
    const [year, month, day] = dateKey.split('-').map(Number);
    return new Date(year, month - 1, day);
}

// 모달 HTML 생성
function createModalHTML() {
    return `
    <div id="sumone-modal" class="sumone-modal" style="display: none;">
        <div class="sumone-container">
            <div class="sumone-header">
                <div class="sumone-tabs">
                    <button class="sumone-tab active" data-tab="today">오늘</button>
                    <button class="sumone-tab" data-tab="history">히스토리</button>
                </div>
                <button class="sumone-close">✕</button>
            </div>
            
            <div class="sumone-content">
                <!-- 오늘 탭 -->
                <div class="sumone-panel active" data-panel="today">
                    <div class="sumone-today-content">
                        <div class="sumone-question-area">
                            <div class="sumone-label">오늘의 질문</div>
                            <div class="sumone-question" id="sumone-question">
                                <span class="sumone-loading">질문 생성 중...</span>
                            </div>
                        </div>
                        
                        <div class="sumone-answer-area">
                            <div class="sumone-label">나의 답변</div>
                            <div class="sumone-my-answer-wrapper">
                                <textarea id="sumone-my-answer" placeholder="답변을 입력하세요..." rows="3"></textarea>
                                <button id="sumone-submit" class="sumone-submit-btn">제출</button>
                            </div>
                        </div>
                        
                        <div class="sumone-ai-area">
                            <div class="sumone-label" id="sumone-ai-label">
                                <span class="sumone-char-name"></span>의 답변
                            </div>
                            <div class="sumone-ai-answer" id="sumone-ai-answer">
                                <div class="sumone-hidden-answer">???</div>
                            </div>
                        </div>
                    </div>
                </div>
                
                <!-- 히스토리 탭 -->
                <div class="sumone-panel" data-panel="history">
                    <div class="sumone-calendar-wrapper">
                        <div class="sumone-calendar-header">
                            <button class="sumone-cal-nav" id="sumone-prev-month">◀</button>
                            <span class="sumone-cal-title" id="sumone-cal-title">2026년 1월</span>
                            <button class="sumone-cal-nav" id="sumone-next-month">▶</button>
                        </div>
                        <div class="sumone-calendar" id="sumone-calendar">
                            <!-- 달력 렌더링 -->
                        </div>
                    </div>
                    <div class="sumone-history-detail" id="sumone-history-detail">
                        <div class="sumone-no-selection">날짜를 선택하세요</div>
                    </div>
                </div>
            </div>
        </div>
    </div>
    `;
}

// 달력 렌더링
function renderCalendar(year, month) {
    const calendar = document.getElementById('sumone-calendar');
    const title = document.getElementById('sumone-cal-title');
    
    if (!calendar || !title) return;
    
    title.textContent = `${year}년 ${month + 1}월`;
    
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startDay = firstDay.getDay();
    const totalDays = lastDay.getDate();
    
    const today = new Date();
    const todayKey = getTodayKey();
    const history = extension_settings[extensionName]?.history || {};
    
    let html = `
        <div class="sumone-cal-weekdays">
            <span>일</span><span>월</span><span>화</span><span>수</span><span>목</span><span>금</span><span>토</span>
        </div>
        <div class="sumone-cal-days">
    `;
    
    // 빈 칸
    for (let i = 0; i < startDay; i++) {
        html += `<span class="sumone-cal-day empty"></span>`;
    }
    
    // 날짜
    for (let day = 1; day <= totalDays; day++) {
        const dateKey = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const hasRecord = history[dateKey] && history[dateKey].question;
        const isToday = dateKey === todayKey;
        const isSelected = dateKey === selectedDate;
        
        let classes = 'sumone-cal-day';
        if (hasRecord) classes += ' has-record';
        if (isToday) classes += ' today';
        if (isSelected) classes += ' selected';
        
        html += `<span class="${classes}" data-date="${dateKey}">${day}</span>`;
    }
    
    html += '</div>';
    calendar.innerHTML = html;
    
    // 날짜 클릭 이벤트
    calendar.querySelectorAll('.sumone-cal-day:not(.empty)').forEach(el => {
        el.addEventListener('click', () => {
            const dateKey = el.dataset.date;
            selectedDate = dateKey;
            renderCalendar(year, month);
            showHistoryDetail(dateKey);
        });
    });
}

// 히스토리 상세 표시
function showHistoryDetail(dateKey) {
    const detail = document.getElementById('sumone-history-detail');
    if (!detail) return;
    
    const history = extension_settings[extensionName]?.history || {};
    const record = history[dateKey];
    
    if (!record || !record.question) {
        const date = parseDate(dateKey);
        detail.innerHTML = `
            <div class="sumone-history-date">${date.getMonth() + 1}월 ${date.getDate()}일</div>
            <div class="sumone-no-record">기록이 없습니다</div>
        `;
        return;
    }
    
    const date = parseDate(dateKey);
    const context = getContext();
    const charName = context.name2 || '캐릭터';
    
    detail.innerHTML = `
        <div class="sumone-history-date">${date.getMonth() + 1}월 ${date.getDate()}일</div>
        <div class="sumone-history-item">
            <div class="sumone-history-label">Q</div>
            <div class="sumone-history-text">${escapeHtml(record.question)}</div>
        </div>
        <div class="sumone-history-item">
            <div class="sumone-history-label">나</div>
            <div class="sumone-history-text">${escapeHtml(record.myAnswer)}</div>
        </div>
        <div class="sumone-history-item">
            <div class="sumone-history-label">${escapeHtml(charName)}</div>
            <div class="sumone-history-text">${escapeHtml(record.aiAnswer)}</div>
        </div>
    `;
}

// HTML 이스케이프
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// 캐릭터 이름 업데이트
function updateCharacterName() {
    const context = getContext();
    const charName = context.name2 || '캐릭터';
    const nameEl = document.querySelector('.sumone-char-name');
    if (nameEl) {
        nameEl.textContent = charName;
    }
}

// 질문 생성
async function generateQuestion() {
    const context = getContext();
    const charName = context.name2 || '캐릭터';
    const userName = context.name1 || '사용자';
    
    const questionEl = document.getElementById('sumone-question');
    if (!questionEl) return;
    
    questionEl.innerHTML = '<span class="sumone-loading">질문 생성 중...</span>';
    
    // 이전 질문들 가져오기 (중복 방지)
    const history = extension_settings[extensionName]?.history || {};
    const previousQuestions = Object.values(history)
        .filter(h => h.question)
        .map(h => h.question)
        .slice(-10)
        .join('\n- ');
    
    // generateQuietPrompt는 자동으로 캐릭터 카드, 로어북, 페르소나, 전체 채팅 히스토리를 컨텍스트에 포함함
    const prompt = `[SumOne Q&A: Generate ONE intimate question for ${userName} and ${charName} to answer about each other or their relationship. Consider their history, personality, and story context.

${previousQuestions ? `Already asked (avoid repeats):\n- ${previousQuestions}\n` : ''}

Rules:
- Question in Korean only
- 20-50 characters
- No quotes, no explanation, just the question
- Topics: feelings, memories, dreams, hypotheticals, preferences, relationship thoughts]`;

    try {
        // skipWIAN=false: 로어북(World Info) 포함
        const result = await generateQuietPrompt(prompt, false, false);
        todayQuestion = result.trim().replace(/^["']|["']$/g, '').replace(/^["""]+|["""]+$/g, '');
        questionEl.textContent = todayQuestion;
    } catch (error) {
        console.error('SumOne: Failed to generate question', error);
        questionEl.textContent = '질문을 생성하지 못했습니다. 다시 시도해주세요.';
    }
}

// AI 답변 생성
async function generateAiAnswer(question, myAnswer) {
    const context = getContext();
    const charName = context.name2 || '캐릭터';
    const userName = context.name1 || '사용자';
    
    const aiAnswerEl = document.getElementById('sumone-ai-answer');
    if (!aiAnswerEl) return;
    
    aiAnswerEl.innerHTML = '<span class="sumone-loading">답변 생성 중...</span>';
    isGenerating = true;
    
    // generateQuietPrompt는 자동으로 캐릭터 카드, 로어북, 페르소나, 전체 채팅 히스토리를 컨텍스트에 포함함
    // 그래서 캐릭터가 "자기답게" 답변할 수 있음
    const prompt = `[SumOne Q&A: ${userName} answered a relationship question. Now ${charName} must answer the same question IN CHARACTER.

Question: "${question}"
${userName}'s answer: "${myAnswer}"

Rules for ${charName}:
- Answer in Korean as ${charName} would
- Stay completely in character (personality, speech patterns, feelings)
- Be genuine and emotional
- 30-150 characters
- Just the answer, no meta commentary about this being a Q&A]`;

    try {
        // skipWIAN=false: 로어북(World Info) 포함
        const result = await generateQuietPrompt(prompt, false, false);
        todayAiAnswer = result.trim().replace(/^["']|["']$/g, '').replace(/^["""]+|["""]+$/g, '');
        aiAnswerEl.textContent = todayAiAnswer;
        
        // 저장
        saveToday();
    } catch (error) {
        console.error('SumOne: Failed to generate AI answer', error);
        aiAnswerEl.textContent = '답변을 생성하지 못했습니다.';
    } finally {
        isGenerating = false;
    }
}

// 오늘 데이터 저장
function saveToday() {
    const todayKey = getTodayKey();
    
    if (!extension_settings[extensionName].history) {
        extension_settings[extensionName].history = {};
    }
    
    extension_settings[extensionName].history[todayKey] = {
        question: todayQuestion,
        myAnswer: todayMyAnswer,
        aiAnswer: todayAiAnswer,
    };
    
    saveSettingsDebounced();
}

// 오늘 데이터 불러오기
function loadToday() {
    const todayKey = getTodayKey();
    const history = extension_settings[extensionName]?.history || {};
    const todayData = history[todayKey];
    
    if (todayData && todayData.question) {
        todayQuestion = todayData.question;
        todayMyAnswer = todayData.myAnswer;
        todayAiAnswer = todayData.aiAnswer;
        
        const questionEl = document.getElementById('sumone-question');
        const myAnswerEl = document.getElementById('sumone-my-answer');
        const aiAnswerEl = document.getElementById('sumone-ai-answer');
        const submitBtn = document.getElementById('sumone-submit');
        
        if (questionEl) questionEl.textContent = todayQuestion;
        if (myAnswerEl) {
            myAnswerEl.value = todayMyAnswer || '';
            if (todayMyAnswer) myAnswerEl.disabled = true;
        }
        if (aiAnswerEl) {
            if (todayAiAnswer) {
                aiAnswerEl.textContent = todayAiAnswer;
            } else {
                aiAnswerEl.innerHTML = '<div class="sumone-hidden-answer">???</div>';
            }
        }
        if (submitBtn && todayMyAnswer) {
            submitBtn.disabled = true;
            submitBtn.textContent = '완료';
        }
        
        return true;
    }
    
    return false;
}

// 모달 열기
async function openModal() {
    const modal = document.getElementById('sumone-modal');
    if (!modal) return;
    
    modal.style.display = 'flex';
    updateCharacterName();
    
    // 오늘 탭으로 전환
    switchTab('today');
    
    // 오늘 데이터가 있으면 불러오기, 없으면 새 질문 생성
    const hasToday = loadToday();
    if (!hasToday) {
        todayQuestion = null;
        todayMyAnswer = null;
        todayAiAnswer = null;
        
        const myAnswerEl = document.getElementById('sumone-my-answer');
        const submitBtn = document.getElementById('sumone-submit');
        const aiAnswerEl = document.getElementById('sumone-ai-answer');
        
        if (myAnswerEl) {
            myAnswerEl.value = '';
            myAnswerEl.disabled = false;
        }
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.textContent = '제출';
        }
        if (aiAnswerEl) {
            aiAnswerEl.innerHTML = '<div class="sumone-hidden-answer">???</div>';
        }
        
        await generateQuestion();
    }
}

// 모달 닫기
function closeModal() {
    const modal = document.getElementById('sumone-modal');
    if (modal) {
        modal.style.display = 'none';
    }
}

// 탭 전환
function switchTab(tab) {
    currentTab = tab;
    
    document.querySelectorAll('.sumone-tab').forEach(el => {
        el.classList.toggle('active', el.dataset.tab === tab);
    });
    
    document.querySelectorAll('.sumone-panel').forEach(el => {
        el.classList.toggle('active', el.dataset.panel === tab);
    });
    
    if (tab === 'history') {
        const now = new Date();
        renderCalendar(now.getFullYear(), now.getMonth());
    }
}

// 제출 처리
async function handleSubmit() {
    const myAnswerEl = document.getElementById('sumone-my-answer');
    const submitBtn = document.getElementById('sumone-submit');
    
    if (!myAnswerEl || !submitBtn || isGenerating) return;
    
    const answer = myAnswerEl.value.trim();
    if (!answer) {
        alert('답변을 입력해주세요!');
        return;
    }
    
    if (!todayQuestion) {
        alert('질문이 아직 준비되지 않았습니다.');
        return;
    }
    
    todayMyAnswer = answer;
    myAnswerEl.disabled = true;
    submitBtn.disabled = true;
    submitBtn.textContent = '생성 중...';
    
    await generateAiAnswer(todayQuestion, todayMyAnswer);
    
    submitBtn.textContent = '완료';
}

// 달력 네비게이션 상태
let currentCalendarYear;
let currentCalendarMonth;

// 이벤트 설정
function setupEvents() {
    const modal = document.getElementById('sumone-modal');
    if (!modal) return;
    
    // 닫기 버튼
    modal.querySelector('.sumone-close')?.addEventListener('click', closeModal);
    
    // 모달 바깥 클릭시 닫기
    modal.addEventListener('click', (e) => {
        if (e.target === modal) closeModal();
    });
    
    // 탭 전환
    modal.querySelectorAll('.sumone-tab').forEach(el => {
        el.addEventListener('click', () => switchTab(el.dataset.tab));
    });
    
    // 제출 버튼
    document.getElementById('sumone-submit')?.addEventListener('click', handleSubmit);
    
    // Enter 키로 제출
    document.getElementById('sumone-my-answer')?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSubmit();
        }
    });
    
    // 달력 네비게이션
    const now = new Date();
    currentCalendarYear = now.getFullYear();
    currentCalendarMonth = now.getMonth();
    
    document.getElementById('sumone-prev-month')?.addEventListener('click', () => {
        currentCalendarMonth--;
        if (currentCalendarMonth < 0) {
            currentCalendarMonth = 11;
            currentCalendarYear--;
        }
        renderCalendar(currentCalendarYear, currentCalendarMonth);
    });
    
    document.getElementById('sumone-next-month')?.addEventListener('click', () => {
        currentCalendarMonth++;
        if (currentCalendarMonth > 11) {
            currentCalendarMonth = 0;
            currentCalendarYear++;
        }
        renderCalendar(currentCalendarYear, currentCalendarMonth);
    });
}

// Extensions 설정 패널에 UI 추가
function addExtensionSettings() {
    const settingsContainer = document.getElementById('extensions_settings2');
    if (!settingsContainer) return;
    
    // 이미 있으면 추가 안함
    if (document.getElementById('sumone-settings')) return;
    
    const settingsHtml = `
    <div id="sumone-settings" class="extension_settings">
        <div class="inline-drawer">
            <div class="inline-drawer-toggle inline-drawer-header">
                <b>썸원 (SumOne)</b>
                <div class="inline-drawer-icon fa-solid fa-circle-chevron-down down"></div>
            </div>
            <div class="inline-drawer-content">
                <div class="sumone-settings-content">
                    <p style="margin-bottom: 10px; color: var(--SmartThemeBodyColor);">
                        매일 새로운 질문에 답하고, 캐릭터의 답변을 확인하세요!
                    </p>
                    <div class="flex-container">
                        <input id="sumone-enabled" type="checkbox" checked />
                        <label for="sumone-enabled">활성화</label>
                    </div>
                    <div style="margin-top: 10px;">
                        <button id="sumone-open-btn" class="menu_button">
                            <i class="fa-solid fa-heart"></i>
                            <span>썸원 열기</span>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    </div>
    `;
    
    settingsContainer.insertAdjacentHTML('beforeend', settingsHtml);
    
    // 열기 버튼 이벤트
    document.getElementById('sumone-open-btn')?.addEventListener('click', () => {
        openModal();
    });
    
    // 활성화 체크박스
    document.getElementById('sumone-enabled')?.addEventListener('change', (e) => {
        extension_settings[extensionName].enabled = e.target.checked;
        saveSettingsDebounced();
    });
}

// 채팅 입력창 옆에 빠른 접근 버튼 추가
function addQuickAccessButton() {
    const sendForm = document.getElementById('send_form');
    if (!sendForm) return;
    
    // 이미 있으면 추가 안함
    if (document.getElementById('sumone-quick-btn')) return;
    
    const button = document.createElement('div');
    button.id = 'sumone-quick-btn';
    button.className = 'mes_button interactable';
    button.title = '썸원 (SumOne)';
    button.innerHTML = '<i class="fa-solid fa-heart"></i>';
    button.style.cssText = 'color: #ff6b9d; cursor: pointer;';
    button.addEventListener('click', openModal);
    
    // send_but 버튼 앞에 삽입
    const sendButton = document.getElementById('send_but');
    if (sendButton) {
        sendButton.parentNode.insertBefore(button, sendButton);
    }
}

// 메인 초기화
jQuery(async () => {
    await loadSettings();
    
    // 모달 HTML 추가
    $('body').append(createModalHTML());
    
    // 이벤트 설정
    setupEvents();
    
    // Extensions 설정 패널에 UI 추가
    addExtensionSettings();
    
    // 채팅 입력창 옆에 빠른 접근 버튼 추가
    addQuickAccessButton();
    
    // 채팅 변경시 캐릭터 이름 업데이트 및 버튼 재추가
    eventSource.on(event_types.CHAT_CHANGED, () => {
        updateCharacterName();
        addQuickAccessButton();
    });
    
    console.log('SumOne extension loaded!');
});
