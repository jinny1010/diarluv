// SumOne Phone (썸원 폰) Extension for SillyTavern
// 스마트폰 스타일 UI - 자동 AI 답변 생성 + 블러 처리

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
let isBackgroundGenerating = false;
let todayQuestion = null;
let todayMyAnswer = null;
let todayAiAnswer = null;
let todayAiAnswerRevealed = false;
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

function loadSettings() {
    extension_settings[extensionName] = extension_settings[extensionName] || {};
    const settings = extension_settings[extensionName];
    if (!settings.apps) settings.apps = { ...defaultSettings.apps };
    if (!settings.sumoneHistory) settings.sumoneHistory = {};
    if (!settings.questionPool) settings.questionPool = [...initialQuestions];
    if (!settings.usedQuestions) settings.usedQuestions = [];
    if (settings.wallpaper === undefined) settings.wallpaper = '';
}

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

/**
 * 캐릭터 정보 + 로어북 + 채팅 히스토리 전부 가져오기
 */
function getFullContext() {
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
    
    // 그룹 멤버 정보
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
            if (entry.content) context += `${entry.content}\n`;
        });
        context += '\n';
    }
    
    // 채팅 히스토리 (최근 30개)
    const chat = ctx.chat || [];
    if (chat.length > 0) {
        const userName = ctx.name1 || 'User';
        const charName = ctx.name2 || 'Character';
        context += `[Recent Chat History]\n`;
        const recentChat = chat.slice(-30);
        recentChat.forEach(msg => {
            const name = msg.is_user ? userName : charName;
            const text = msg.mes?.substring(0, 500) || '';
            if (text) context += `${name}: ${text}\n`;
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
    
    if (!settings.questionPool || settings.questionPool.length === 0) {
        settings.questionPool = [...initialQuestions];
        settings.usedQuestions = [];
    }
    
    const randomIndex = Math.floor(Math.random() * settings.questionPool.length);
    const question = settings.questionPool[randomIndex];
    
    settings.questionPool.splice(randomIndex, 1);
    settings.usedQuestions.push(question);
    saveSettingsDebounced();
    
    if (settings.questionPool.length <= 10 && !isUpdatingQuestions) {
        generateMoreQuestions();
    }
    
    return question;
}

function showUpdatingStatus(show) {
    const statusEl = document.getElementById('phone-updating-status');
    if (statusEl) statusEl.style.display = show ? 'flex' : 'none';
}

async function generateMoreQuestions() {
    if (isUpdatingQuestions) return;
    isUpdatingQuestions = true;
    showUpdatingStatus(true);
    console.log('[SumOne] Generating new questions...');
    
    const settings = extension_settings[extensionName];
    const usedList = settings.usedQuestions.slice(-50).join('\n- ');
    
    const prompt = `Generate 100 unique romantic couple Q&A questions in Korean.
Already used (avoid): ${usedList}
Rules: 15-40 chars each, one per line, no numbering, topics: feelings/memories/future/preferences
Output ONLY questions.`;

    try {
        const ctx = getContext();
        if (ctx.generateQuietPrompt) {
            const result = await ctx.generateQuietPrompt(prompt, false, true);
            const newQuestions = result.split('\n')
                .map(q => q.trim())
                .filter(q => q.length >= 10 && q.length <= 60 && !q.match(/^\d/) && !q.startsWith('-'))
                .filter(q => !settings.usedQuestions.includes(q) && !settings.questionPool.includes(q));
            
            if (newQuestions.length > 0) {
                settings.questionPool.push(...newQuestions);
                saveSettingsDebounced();
                console.log(`[SumOne] Added ${newQuestions.length} questions`);
            }
        }
    } catch (e) {
        console.error('[SumOne] Question generation failed:', e);
    } finally {
        isUpdatingQuestions = false;
        showUpdatingStatus(false);
    }
}

/**
 * AI 답변 생성 (작가노트 스타일 강제 지시)
 */
async function generateAiAnswerForQuestion(question) {
    const ctx = getContext();
    const charName = ctx.name2 || '캐릭터';
    const userName = ctx.name1 || '사용자';
    
    // 디스크립션 + 로어북 + 채팅 히스토리 전부 포함
    const fullContext = getFullContext();
    
    // 작가노트 스타일: 프롬프트 끝에 강제 지시 (롤플레이 이어가지 말고 질문에만 답하라)
    const prompt = `${fullContext}
---
[System Note / Author's Note - CRITICAL INSTRUCTION]
⚠️ STOP! This is NOT a roleplay continuation. This is a special Q&A task.

You are answering a question for "SumOne", a couple's Q&A app.
The question is: "${question}"

As ${charName}, provide ONLY a short answer to this specific question.

STRICT RULES:
✗ DO NOT continue the story or roleplay
✗ DO NOT write actions, descriptions, or narration
✗ DO NOT use asterisks (*), brackets ([]), parentheses for actions
✗ DO NOT output HTML, CSS, code, or any formatting
✗ DO NOT write more than 2 sentences

✓ Answer ONLY the question "${question}"
✓ Stay in character as ${charName}
✓ Use Korean language
✓ Keep it 30-150 characters
✓ Output ONLY plain text answer

${charName}'s answer:`;

    try {
        console.log('[SumOne] Generating AI answer for:', question);
        if (ctx.generateQuietPrompt) {
            const result = await ctx.generateQuietPrompt(prompt, false, false);
            
            // 클리닝: HTML, 코드, 액션 등 제거
            let clean = result
                .replace(/<[^>]*>/g, '')           // HTML 태그
                .replace(/```[\s\S]*?```/g, '')    // 코드블록
                .replace(/\*[^*]*\*/g, '')         // *액션*
                .replace(/\[[^\]]*\]/g, '')        // [설명]
                .replace(/\([^)]*\)/g, '')         // (행동)
                .replace(/^["']|["']$/g, '')       // 앞뒤 따옴표
                .replace(/^(Answer:|답변:|A:|답:|${charName}:)/gi, '')
                .trim();
            
            // 첫 줄만 (긴 응답 방지)
            clean = clean.split('\n')[0].trim();
            
            // 길이 제한
            if (clean.length > 200) clean = clean.substring(0, 200) + '...';
            
            console.log('[SumOne] AI Answer:', clean);
            return clean;
        }
    } catch (e) {
        console.error('[SumOne] AI answer failed:', e);
    }
    return null;
}

/**
 * 백그라운드에서 오늘 질문 + AI 답변 자동 생성
 */
async function backgroundGenerateToday() {
    const ctx = getContext();
    
    // 캐릭터 없으면 패스
    if (ctx.characterId === undefined && !ctx.groupId) {
        console.log('[SumOne] No character selected, skipping');
        return;
    }
    
    const todayKey = getTodayKey();
    const settings = extension_settings[extensionName];
    const todayData = settings.sumoneHistory?.[todayKey];
    
    // 이미 오늘 데이터 완성됨
    if (todayData?.question && todayData?.aiAnswer) {
        console.log('[SumOne] Today already prepared');
        return;
    }
    
    if (isBackgroundGenerating) return;
    isBackgroundGenerating = true;
    
    console.log('[SumOne] Background generating...');
    
    try {
        // 질문 선택 (기존 질문 있으면 사용)
        const question = todayData?.question || getQuestionFromPool();
        
        // AI 답변 생성
        const aiAnswer = await generateAiAnswerForQuestion(question);
        
        if (aiAnswer) {
            settings.sumoneHistory[todayKey] = {
                question: question,
                myAnswer: todayData?.myAnswer || null,
                aiAnswer: aiAnswer,
                revealed: todayData?.revealed || false,
                charName: ctx.name2 || '캐릭터',
            };
            saveSettingsDebounced();
            console.log('[SumOne] Background generation complete!');
        }
    } catch (e) {
        console.error('[SumOne] Background generation failed:', e);
    } finally {
        isBackgroundGenerating = false;
    }
}

/**
 * 오늘 데이터 불러오기
 */
function loadTodayData() {
    const todayKey = getTodayKey();
    const history = extension_settings[extensionName]?.sumoneHistory || {};
    const data = history[todayKey];
    
    if (data?.question) {
        todayQuestion = data.question;
        todayMyAnswer = data.myAnswer;
        todayAiAnswer = data.aiAnswer;
        todayAiAnswerRevealed = data.revealed || false;
        
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
                if (todayAiAnswerRevealed) {
                    aiAnswerEl.textContent = todayAiAnswer;
                    aiAnswerEl.classList.remove('blurred');
                } else {
                    aiAnswerEl.textContent = todayAiAnswer;
                    aiAnswerEl.classList.add('blurred');
                }
            } else {
                aiAnswerEl.innerHTML = '<span class="sumone-loading">답변 준비 중...</span>';
            }
        }
        
        if (submitBtn) {
            if (todayMyAnswer) {
                submitBtn.disabled = true;
                submitBtn.textContent = '완료';
            } else {
                submitBtn.disabled = false;
                submitBtn.textContent = '제출하고 답변 보기';
            }
        }
        
        return true;
    }
    return false;
}

function resetTodayUI() {
    todayQuestion = null;
    todayMyAnswer = null;
    todayAiAnswer = null;
    todayAiAnswerRevealed = false;
    
    const myAnswerEl = document.getElementById('phone-sumone-my-answer');
    const aiAnswerEl = document.getElementById('phone-sumone-ai-answer');
    const submitBtn = document.getElementById('phone-sumone-submit');
    
    if (myAnswerEl) { myAnswerEl.value = ''; myAnswerEl.disabled = false; }
    if (aiAnswerEl) { aiAnswerEl.innerHTML = '<span class="sumone-loading">답변 준비 중...</span>'; aiAnswerEl.classList.remove('blurred'); }
    if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = '제출하고 답변 보기'; }
}

/**
 * 제출 처리 - 블러 해제
 */
async function handleSubmit() {
    const myAnswerEl = document.getElementById('phone-sumone-my-answer');
    const submitBtn = document.getElementById('phone-sumone-submit');
    const aiAnswerEl = document.getElementById('phone-sumone-ai-answer');
    
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
    
    const todayKey = getTodayKey();
    const settings = extension_settings[extensionName];
    
    // AI 답변 없으면 지금 생성
    if (!todayAiAnswer) {
        submitBtn.textContent = '답변 생성 중...';
        isGenerating = true;
        if (aiAnswerEl) aiAnswerEl.innerHTML = '<span class="sumone-loading">답변 생성 중...</span>';
        
        const generated = await generateAiAnswerForQuestion(todayQuestion);
        if (generated) {
            todayAiAnswer = generated;
        } else {
            toastr.error('답변 생성 실패');
            isGenerating = false;
            submitBtn.disabled = false;
            submitBtn.textContent = '제출하고 답변 보기';
            return;
        }
        isGenerating = false;
    }
    
    // 블러 해제!
    todayAiAnswerRevealed = true;
    
    // 저장
    settings.sumoneHistory[todayKey] = {
        question: todayQuestion,
        myAnswer: todayMyAnswer,
        aiAnswer: todayAiAnswer,
        revealed: true,
        charName: getContext().name2 || '캐릭터',
    };
    saveSettingsDebounced();
    
    // UI 업데이트
    if (aiAnswerEl) {
        aiAnswerEl.textContent = todayAiAnswer;
        aiAnswerEl.classList.remove('blurred');
    }
    submitBtn.textContent = '완료';
    
    toastr.success('💕 답변이 공개되었습니다!');
}

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
                            <button id="phone-sumone-submit" class="sumone-submit-btn">제출하고 답변 보기</button>
                        </div>
                        <div class="sumone-ai-box">
                            <div class="sumone-label"><span class="sumone-char-name"></span>의 답변</div>
                            <div class="sumone-ai-answer blurred" id="phone-sumone-ai-answer">
                                <span class="sumone-loading">답변 준비 중...</span>
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
    </div>`;
}

function renderAppGrid() {
    const grid = document.getElementById('phone-app-grid');
    if (!grid) return;
    const apps = extension_settings[extensionName]?.apps || {};
    let html = '';
    for (const [appId, app] of Object.entries(apps)) {
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
            
            // 백그라운드에서 AI 답변 생성 시작
            backgroundGenerateToday();
        }
    }
}

function updateCharacterName() {
    const ctx = getContext();
    const charName = ctx.name2 || '캐릭터';
    document.querySelectorAll('.sumone-char-name').forEach(el => el.textContent = charName);
}

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
    for (let i = 0; i < startDay; i++) html += '<span class="cal-day empty"></span>';
    for (let day = 1; day <= totalDays; day++) {
        const dateKey = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const hasRecord = history[dateKey]?.revealed;
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
    const history = extension_settings[extensionName]?.sumoneHistory || {};
    const record = history[dateKey];
    const date = parseDate(dateKey);
    
    if (!record?.question || !record?.revealed) {
        detail.innerHTML = `<div class="history-date">${date.getMonth() + 1}월 ${date.getDate()}일</div><div class="history-placeholder">기록이 없습니다</div>`;
        return;
    }
    detail.innerHTML = `
        <div class="history-date">${date.getMonth() + 1}월 ${date.getDate()}일</div>
        <div class="history-item"><span class="history-label">Q</span><span class="history-text">${escapeHtml(record.question)}</span></div>
        <div class="history-item"><span class="history-label">나</span><span class="history-text">${escapeHtml(record.myAnswer)}</span></div>
        <div class="history-item"><span class="history-label">${escapeHtml(record.charName || '캐릭터')}</span><span class="history-text">${escapeHtml(record.aiAnswer)}</span></div>`;
}

function updateTime() {
    const timeEl = document.querySelector('.phone-time');
    if (timeEl) timeEl.textContent = getCurrentTime();
}

function setWallpaper(dataUrl) {
    extension_settings[extensionName].wallpaper = dataUrl;
    saveSettingsDebounced();
    const screen = document.querySelector('.phone-screen');
    if (screen) {
        screen.style.backgroundImage = dataUrl ? `url(${dataUrl})` : '';
        screen.style.backgroundSize = 'cover';
        screen.style.backgroundPosition = 'center';
    }
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
                            </label>`).join('')}
                    </div>
                    <div style="margin: 15px 0;">
                        <b>질문 풀</b>
                        <p style="margin:5px 0; opacity:0.7; font-size:12px;">남은 질문: <span id="phone-pool-count">${poolSize}</span>개</p>
                    </div>
                    <div style="margin: 15px 0;">
                        <b>배경화면</b>
                        <div style="margin-top: 8px;">
                            <input type="file" id="phone-wallpaper-input" accept="image/*" style="display:none;">
                            <button id="phone-wallpaper-btn" class="menu_button" style="width:100%;"><i class="fa-solid fa-image"></i> 이미지 선택</button>
                            <button id="phone-wallpaper-reset" class="menu_button" style="width:100%; margin-top:5px;"><i class="fa-solid fa-rotate-left"></i> 기본으로 복원</button>
                        </div>
                    </div>
                </div>
            </div>
        </div>`;
    
    $('#extensions_settings').append(settingsHtml);
    
    $('.phone-app-toggle').on('change', function() {
        extension_settings[extensionName].apps[$(this).data('app')].enabled = this.checked;
        saveSettingsDebounced();
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
    $('#phone-wallpaper-reset').on('click', () => { setWallpaper(''); toastr.info('배경화면 복원'); });
}

function addMenuButton() {
    $('#sumone-phone-container').remove();
    const buttonHtml = `
        <div id="sumone-phone-container" class="extension_container interactable" tabindex="0">
            <div id="sumone-phone-btn" class="list-group-item flex-container flexGap5 interactable" tabindex="0" role="listitem">
                <div class="fa-solid fa-mobile-screen extensionsMenuExtensionButton" style="color: #ff6b9d;"></div>
                <span>썸원 폰</span>
            </div>
        </div>`;
    $('#extensionsMenu').prepend(buttonHtml);
    $('#sumone-phone-btn').on('click', openPhoneModal);
}

// 초기화
jQuery(async () => {
    console.log('[SumOne Phone] Loading...');
    loadSettings();
    createSettingsUI();
    $('body').append(createPhoneHTML());
    setupEvents();
    setTimeout(addMenuButton, 1000);
    
    // 캐릭터/채팅 변경시
    eventSource.on(event_types.CHAT_CHANGED, () => {
        updateCharacterName();
        // 채팅 변경 후 백그라운드 Q&A 준비
        setTimeout(backgroundGenerateToday, 2000);
    });
    
    // 초기 로드시 백그라운드 생성 (3초 후)
    setTimeout(backgroundGenerateToday, 3000);
    
    console.log('[SumOne Phone] Loaded!');
});
