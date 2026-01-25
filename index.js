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
let currentCalendarYear;
let currentCalendarMonth;

// 초기 질문 풀 (50개)
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

/**
 * 설정 초기화
 */
function loadSettings() {
    extension_settings[extensionName] = extension_settings[extensionName] || {};
    
    const settings = extension_settings[extensionName];
    if (!settings.apps) settings.apps = { ...defaultSettings.apps };
    if (!settings.sumoneHistory) settings.sumoneHistory = {};
    if (!settings.questionPool) settings.questionPool = [...initialQuestions];
    if (!settings.usedQuestions) settings.usedQuestions = [];
    if (settings.wallpaper === undefined) settings.wallpaper = '';
}

/**
 * 현재 시간
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
 * 캐릭터 정보 + 로어북 가져오기 (채팅 히스토리 제외)
 */
function getCharacterContext() {
    const ctx = getContext();
    let context = '';
    
    // 캐릭터 카드 정보
    if (ctx.characters && ctx.characterId !== undefined) {
        const char = ctx.characters[ctx.characterId];
        if (char) {
            if (char.description) context += `[Character Description]\n${char.description}\n\n`;
            if (char.personality) context += `[Personality]\n${char.personality}\n\n`;
            if (char.scenario) context += `[Scenario]\n${char.scenario}\n\n`;
            if (char.mes_example) context += `[Example Messages]\n${char.mes_example}\n\n`;
        }
    }
    
    // 그룹이면 그룹 멤버들 정보
    if (ctx.groupId && ctx.groups) {
        const group = ctx.groups.find(g => g.id === ctx.groupId);
        if (group && group.members) {
            context += `[Group Members]\n`;
            group.members.forEach(memberId => {
                const member = ctx.characters?.find(c => c.avatar === memberId);
                if (member) {
                    context += `- ${member.name}: ${member.personality || member.description || ''}\n`;
                }
            });
            context += '\n';
        }
    }
    
    // 로어북 (World Info)
    if (ctx.worldInfo && ctx.worldInfo.length > 0) {
        context += `[World Info / Lorebook]\n`;
        ctx.worldInfo.forEach(entry => {
            if (entry.content) {
                context += `${entry.content}\n`;
            }
        });
        context += '\n';
    }
    
    return context;
}

/**
 * 질문 풀에서 질문 가져오기
 */
function getQuestionFromPool() {
    const settings = extension_settings[extensionName];
    
    // 풀이 비어있으면 초기 질문으로 리셋
    if (!settings.questionPool || settings.questionPool.length === 0) {
        settings.questionPool = [...initialQuestions];
        settings.usedQuestions = [];
    }
    
    // 랜덤으로 하나 선택
    const randomIndex = Math.floor(Math.random() * settings.questionPool.length);
    const question = settings.questionPool[randomIndex];
    
    // 풀에서 제거하고 사용 목록에 추가
    settings.questionPool.splice(randomIndex, 1);
    settings.usedQuestions.push(question);
    
    saveSettingsDebounced();
    
    // 10개 이하 남으면 백그라운드에서 질문 생성 시작
    if (settings.questionPool.length <= 10 && !isUpdatingQuestions) {
        generateMoreQuestions();
    }
    
    return question;
}

/**
 * 질문 업데이트 상태 표시
 */
function showUpdatingStatus(show) {
    const statusEl = document.getElementById('phone-updating-status');
    if (statusEl) {
        statusEl.style.display = show ? 'flex' : 'none';
    }
}

/**
 * 백그라운드에서 질문 100개 생성
 */
async function generateMoreQuestions() {
    if (isUpdatingQuestions) return;
    
    isUpdatingQuestions = true;
    showUpdatingStatus(true);
    console.log('[SumOne] Generating 100 new questions...');
    
    const settings = extension_settings[extensionName];
    const usedList = settings.usedQuestions.slice(-50).join('\n- ');
    
    const prompt = `Generate 100 unique romantic couple Q&A questions in Korean.

These are already used (DO NOT repeat):
- ${usedList}

Rules:
- Each question 15-40 characters
- One question per line
- No numbering, no quotes, just questions
- Topics: feelings, memories, future plans, preferences, hypotheticals, daily life, dreams
- Make them intimate but appropriate
- Output ONLY the questions, nothing else

Example format:
처음 만났을 때 뭐가 제일 기억나?
나랑 있을 때 제일 행복한 순간은?
같이 해보고 싶은 버킷리스트 있어?`;

    try {
        const ctx = getContext();
        if (ctx.generateQuietPrompt) {
            const result = await ctx.generateQuietPrompt(prompt, false, true);
            
            const newQuestions = result
                .split('\n')
                .map(q => q.trim())
                .filter(q => q.length >= 10 && q.length <= 60)
                .filter(q => !q.match(/^\d+[\.\)]/))
                .filter(q => !q.startsWith('-'))
                .filter(q => !settings.usedQuestions.includes(q))
                .filter(q => !settings.questionPool.includes(q));
            
            if (newQuestions.length > 0) {
                settings.questionPool.push(...newQuestions);
                saveSettingsDebounced();
                console.log(`[SumOne] Added ${newQuestions.length} new questions. Pool size: ${settings.questionPool.length}`);
                
                // 설정 UI 업데이트
                const countEl = document.getElementById('phone-pool-count');
                if (countEl) countEl.textContent = settings.questionPool.length;
            }
        }
    } catch (error) {
        console.error('[SumOne] Failed to generate questions:', error);
    } finally {
        isUpdatingQuestions = false;
        showUpdatingStatus(false);
    }
}

/**
 * AI 답변 생성 (캐릭터 카드 + 로어북만, 채팅 히스토리 제외)
 */
async function generateAiAnswer(question, myAnswer) {
    const ctx = getContext();
    const charName = ctx.name2 || '캐릭터';
    const userName = ctx.name1 || '사용자';
    
    const aiAnswerEl = document.getElementById('phone-sumone-ai-answer');
    if (!aiAnswerEl) return;
    
    aiAnswerEl.innerHTML = '<span class="sumone-loading">답변 생성 중...</span>';
    isGenerating = true;
    
    // 캐릭터 정보 + 로어북 (채팅 히스토리 제외)
    const characterContext = getCharacterContext();
    
    const prompt = `${characterContext}
---
[SUMONE Q&A TASK - STRICT FORMAT]
You are ${charName}. Answer this couple Q&A question in character.

Question: "${question}"
${userName}'s answer: "${myAnswer}"

STRICT RULES:
1. Answer ONLY as ${charName} would
2. Stay in character (personality, speech patterns)
3. Korean language only
4. 30-150 characters maximum
5. Output ONLY the answer text - nothing else
6. FORBIDDEN: HTML, CSS, code, markdown, formatting
7. FORBIDDEN: Roleplay actions, asterisks, brackets, parentheses for actions
8. FORBIDDEN: Continuing any story or scene
9. This is ONLY a simple Q&A text answer

${charName}'s answer:`;

    try {
        console.log('[SumOne] Generating AI answer...');
        
        if (ctx.generateQuietPrompt) {
            const result = await ctx.generateQuietPrompt(prompt, false, true);
            
            // 정리: HTML, 코드, 특수문자 제거
            let cleanAnswer = result
                .replace(/<[^>]*>/g, '')
                .replace(/```[\s\S]*?```/g, '')
                .replace(/\*[^*]*\*/g, '')
                .replace(/\[[^\]]*\]/g, '')
                .replace(/\([^)]*행동[^)]*\)/g, '')
                .replace(/^(Answer:|답변:|A:|답:)/i, '')
                .replace(/^["']|["']$/g, '')
                .trim();
            
            // 첫 문단만
            cleanAnswer = cleanAnswer.split('\n')[0].trim();
            
            // 너무 길면 자르기
            if (cleanAnswer.length > 200) {
                cleanAnswer = cleanAnswer.substring(0, 200) + '...';
            }
            
            todayAiAnswer = cleanAnswer;
            aiAnswerEl.textContent = todayAiAnswer;
            console.log('[SumOne] AI Answer:', todayAiAnswer);
            
            saveTodayData();
        }
    } catch (error) {
        console.error('[SumOne] AI answer failed:', error);
        aiAnswerEl.textContent = '답변 생성에 실패했습니다.';
        toastr.error('답변 생성 실패');
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
            if (todayAiAnswer) {
                aiAnswerEl.textContent = todayAiAnswer;
            } else {
                aiAnswerEl.innerHTML = '<div class="sumone-hidden">???</div>';
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
 * 폰 HTML 생성
 */
function createPhoneHTML() {
    const wallpaper = extension_settings[extensionName]?.wallpaper || '';
    const wallpaperStyle = wallpaper ? `background-image: url(${wallpaper}); background-size: cover; background-position: center;` : '';
    
    return `
    <div id="phone-modal" class="phone-modal" style="display: none;">
        <div class="phone-device">
            <div class="phone-notch"></div>
            
            <div class="phone-status-bar">
                <span class="phone-time">${getCurrentTime()}</span>
                <div class="phone-status-icons">
                    <span class="phone-signal">●●●●○</span>
                    <span class="phone-battery">100%🔋</span>
                </div>
            </div>
            
            <div id="phone-updating-status" class="phone-updating-status" style="display: none;">
                <span>🔄 질문 업데이트 중...</span>
            </div>
            
            <div class="phone-screen" style="${wallpaperStyle}">
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
                            <div class="sumone-question" id="phone-sumone-question">질문을 불러오는 중...</div>
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
    
    grid.querySelectorAll('.phone-app-icon').forEach(el => {
        el.addEventListener('click', () => openApp(el.dataset.app));
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
            todayQuestion = getQuestionFromPool();
            const questionEl = document.getElementById('phone-sumone-question');
            if (questionEl) questionEl.textContent = todayQuestion;
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
    if (timeEl) timeEl.textContent = getCurrentTime();
}

/**
 * 배경화면 설정
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
    if (modal) modal.style.display = 'none';
}

/**
 * 이벤트 설정
 */
function setupEvents() {
    const modal = document.getElementById('phone-modal');
    if (!modal) return;
    
    modal.addEventListener('click', (e) => {
        if (e.target === modal) closePhoneModal();
    });
    
    modal.querySelectorAll('.app-back-btn').forEach(btn => {
        btn.addEventListener('click', () => switchPage(btn.dataset.back));
    });
    
    modal.querySelector('.sumone-history-btn')?.addEventListener('click', () => {
        const now = new Date();
        currentCalendarYear = now.getFullYear();
        currentCalendarMonth = now.getMonth();
        switchPage('sumone-history');
        renderCalendar(currentCalendarYear, currentCalendarMonth);
    });
    
    document.getElementById('phone-sumone-submit')?.addEventListener('click', handleSubmit);
    
    document.getElementById('phone-sumone-my-answer')?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSubmit();
        }
    });
    
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
    
    setInterval(updateTime, 60000);
}

/**
 * 설정 UI
 */
function createSettingsUI() {
    const apps = extension_settings[extensionName]?.apps || {};
    const poolSize = extension_settings[extensionName]?.questionPool?.length || 0;
    
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
                        <b>질문 풀</b>
                        <p style="margin:5px 0; opacity:0.7; font-size:12px;">
                            남은 질문: <span id="phone-pool-count">${poolSize}</span>개
                        </p>
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
    
    $('.phone-app-toggle').on('change', function() {
        const appId = $(this).data('app');
        extension_settings[extensionName].apps[appId].enabled = this.checked;
        saveSettingsDebounced();
        renderAppGrid();
    });
    
    $('#phone-wallpaper-btn').on('click', () => $('#phone-wallpaper-input').click());
    
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
    
    eventSource.on(event_types.CHAT_CHANGED, updateCharacterName);
    
    console.log('[SumOne Phone] Loaded!');
});
