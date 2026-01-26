// ========================================
// SumOne Phone - 메인 코어
// v1.6.0 - 모듈화, 캐릭터별 배경, 백그라운드 생성
// ========================================

import {
    saveSettingsDebounced,
    eventSource,
    event_types,
} from '../../../../script.js';

import { extension_settings } from '../../../extensions.js';

const extensionName = 'sumone-phone';

// ========================================
// 썸원 앱 모듈 (인라인)
// ========================================
const SumOneApp = {
    id: 'sumone',
    name: '썸원',
    icon: '💕',
    
    initialQuestions: [
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
    ],
    
    state: {
        isGenerating: false,
        currentQuestion: null,
        selectedDate: null,
        calendarYear: null,
        calendarMonth: null,
    },
    
    getDataKey(charId) { return `sumone_${charId || 'default'}`; },
    
    getData(settings, charId) {
        const key = this.getDataKey(charId);
        if (!settings.appData) settings.appData = {};
        if (!settings.appData[key]) {
            settings.appData[key] = { history: {}, questionPool: [...this.initialQuestions], usedQuestions: [] };
        }
        return settings.appData[key];
    },
    
    getTodayKey() {
        const now = new Date();
        return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    },
    
    getQuestion(data) {
        if (data.questionPool.length === 0) {
            data.questionPool = [...this.initialQuestions];
            data.usedQuestions = [];
        }
        const idx = Math.floor(Math.random() * data.questionPool.length);
        const q = data.questionPool.splice(idx, 1)[0];
        data.usedQuestions.push(q);
        return q;
    },
    
    getTodayData(settings, charId, charName) {
        const data = this.getData(settings, charId);
        const todayKey = this.getTodayKey();
        if (!data.history[todayKey] || !data.history[todayKey].question) {
            data.history[todayKey] = {
                question: this.getQuestion(data),
                myAnswer: null, aiAnswer: null, comment: null,
                revealed: false, charName: charName,
            };
        }
        return data.history[todayKey];
    },
    
    async generateResponse(ctx, question, userAnswer, charName, userName) {
        const prompt = `[커플 Q&A 앱 "썸원"]
질문: "${question}"
${userName}의 답변: "${userAnswer}"

${charName}(으)로서 두 가지를 작성:
1. 질문에 대한 ${charName}의 답변 (1-2문장)
2. ${userName}의 답변에 대한 반응 (1문장, 달달하게)

형식:
답변: (내용)
코멘트: (내용)

한국어로, 액션(*) 없이:`;

        try {
            if (ctx.generateQuietPrompt) {
                const result = await ctx.generateQuietPrompt(prompt, false, false);
                let answer = '', comment = '';
                for (const line of result.split('\n').map(l => l.trim()).filter(l => l)) {
                    if (line.match(/^답변?:/)) answer = line.replace(/^답변?:\s*/, '').replace(/\*[^*]*\*/g, '').trim();
                    else if (line.match(/^(코멘트|반응):/)) comment = line.replace(/^(코멘트|반응):\s*/, '').replace(/\*[^*]*\*/g, '').trim();
                }
                if (!answer) answer = result.split('\n')[0]?.replace(/\*[^*]*\*/g, '').trim() || '';
                if (answer.length > 150) answer = answer.substring(0, 150);
                if (comment.length > 100) comment = comment.substring(0, 100);
                return { answer, comment };
            }
        } catch (e) { console.error('[SumOne] Generate failed:', e); }
        return { answer: null, comment: null };
    },
    
    render(charName) {
        return `
        <div class="app-header">
            <button class="app-back-btn" data-back="home">◀</button>
            <span class="app-title">썸원</span>
            <button class="sumone-history-btn" id="sumone-history-btn">📅</button>
        </div>
        <div class="app-content sumone-app">
            <div class="sumone-question-box">
                <div class="sumone-label">오늘의 질문</div>
                <div class="sumone-question" id="sumone-question">로딩 중...</div>
            </div>
            <div class="sumone-answer-box">
                <div class="sumone-label">나의 답변</div>
                <textarea id="sumone-my-answer" placeholder="답변을 입력하세요..."></textarea>
                <button id="sumone-submit" class="sumone-submit-btn">제출하기</button>
            </div>
            <div class="sumone-ai-box" id="sumone-ai-box" style="display:none;">
                <div class="sumone-label"><span class="sumone-char-name">${charName}</span>의 답변</div>
                <div class="sumone-ai-answer" id="sumone-ai-answer"></div>
            </div>
            <div class="sumone-comment-box" id="sumone-comment-box" style="display:none;">
                <div class="sumone-label"><span class="sumone-char-name">${charName}</span>의 코멘트</div>
                <div class="sumone-comment" id="sumone-comment"></div>
            </div>
            <div class="sumone-typing" id="sumone-typing" style="display:none;">
                <span class="typing-indicator">
                    <span class="sumone-char-name">${charName}</span> 님이 답변 중
                    <span class="typing-dots"><span>.</span><span>.</span><span>.</span></span>
                </span>
            </div>
        </div>`;
    },
    
    renderHistory() {
        return `
        <div class="app-header">
            <button class="app-back-btn" data-back="sumone">◀</button>
            <span class="app-title">히스토리</span>
            <span></span>
        </div>
        <div class="app-content sumone-history">
            <div class="calendar-header">
                <button id="sumone-cal-prev">◀</button>
                <span id="sumone-cal-title">2026년 1월</span>
                <button id="sumone-cal-next">▶</button>
            </div>
            <div class="calendar-grid" id="sumone-calendar"></div>
            <div class="history-detail" id="sumone-history-detail">
                <div class="history-placeholder">날짜를 선택하세요</div>
            </div>
        </div>`;
    },
    
    loadUI(settings, charId, charName) {
        const todayData = this.getTodayData(settings, charId, charName);
        this.state.currentQuestion = todayData.question;
        
        const questionEl = document.getElementById('sumone-question');
        const myAnswerEl = document.getElementById('sumone-my-answer');
        const submitBtn = document.getElementById('sumone-submit');
        const aiBox = document.getElementById('sumone-ai-box');
        const aiAnswerEl = document.getElementById('sumone-ai-answer');
        const commentBox = document.getElementById('sumone-comment-box');
        const commentEl = document.getElementById('sumone-comment');
        const typingEl = document.getElementById('sumone-typing');
        
        if (questionEl) questionEl.textContent = todayData.question;
        
        if (todayData.revealed) {
            if (myAnswerEl) { myAnswerEl.value = todayData.myAnswer || ''; myAnswerEl.disabled = true; }
            if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = '오늘 완료 ✓'; }
            if (aiBox) aiBox.style.display = 'block';
            if (aiAnswerEl) aiAnswerEl.textContent = todayData.aiAnswer || '';
            if (todayData.comment && commentBox && commentEl) {
                commentEl.textContent = todayData.comment;
                commentBox.style.display = 'block';
            }
            if (typingEl) typingEl.style.display = 'none';
            return;
        }
        
        if (this.state.isGenerating) {
            if (myAnswerEl) myAnswerEl.disabled = true;
            if (submitBtn) submitBtn.disabled = true;
            if (typingEl) typingEl.style.display = 'block';
            return;
        }
        
        if (myAnswerEl) { myAnswerEl.value = ''; myAnswerEl.disabled = false; }
        if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = '제출하기'; }
        if (aiBox) aiBox.style.display = 'none';
        if (commentBox) commentBox.style.display = 'none';
        if (typingEl) typingEl.style.display = 'none';
    },
    
    async handleSubmit(PhoneCore) {
        if (this.state.isGenerating) return;
        
        const ctx = PhoneCore.getContext();
        const settings = PhoneCore.getSettings();
        const charId = PhoneCore.getCharId();
        const charName = ctx.name2 || '캐릭터';
        const userName = ctx.name1 || '나';
        
        const myAnswerEl = document.getElementById('sumone-my-answer');
        const submitBtn = document.getElementById('sumone-submit');
        const typingEl = document.getElementById('sumone-typing');
        
        const answer = myAnswerEl?.value.trim();
        if (!answer) { toastr.warning('답변을 입력해주세요!'); return; }
        
        this.state.isGenerating = true;
        if (myAnswerEl) myAnswerEl.disabled = true;
        if (submitBtn) submitBtn.disabled = true;
        if (typingEl) typingEl.style.display = 'block';
        
        const { answer: aiAnswer, comment } = await this.generateResponse(ctx, this.state.currentQuestion, answer, charName, userName);
        
        this.state.isGenerating = false;
        
        if (!aiAnswer) {
            toastr.error('생성 실패. 다시 시도해주세요.');
            if (myAnswerEl) myAnswerEl.disabled = false;
            if (submitBtn) submitBtn.disabled = false;
            if (typingEl) typingEl.style.display = 'none';
            return;
        }
        
        const data = this.getData(settings, charId);
        data.history[this.getTodayKey()] = {
            question: this.state.currentQuestion,
            myAnswer: answer, aiAnswer, comment,
            revealed: true, charName,
        };
        PhoneCore.saveSettings();
        
        // UI 업데이트
        if (typingEl) typingEl.style.display = 'none';
        const aiBox = document.getElementById('sumone-ai-box');
        const aiAnswerEl = document.getElementById('sumone-ai-answer');
        const commentBox = document.getElementById('sumone-comment-box');
        const commentEl = document.getElementById('sumone-comment');
        
        if (aiBox) aiBox.style.display = 'block';
        if (aiAnswerEl) aiAnswerEl.textContent = aiAnswer;
        if (comment && commentBox && commentEl) {
            commentEl.textContent = comment;
            commentBox.style.display = 'block';
        }
        if (submitBtn) submitBtn.textContent = '오늘 완료 ✓';
        
        toastr.success('💕 답변이 도착했습니다!');
    },
    
    renderCalendar(settings, charId, year, month) {
        const calendar = document.getElementById('sumone-calendar');
        const title = document.getElementById('sumone-cal-title');
        if (!calendar || !title) return;
        
        const data = this.getData(settings, charId);
        this.state.calendarYear = year;
        this.state.calendarMonth = month;
        
        title.textContent = `${year}년 ${month + 1}월`;
        const startDay = new Date(year, month, 1).getDay();
        const totalDays = new Date(year, month + 1, 0).getDate();
        const todayKey = this.getTodayKey();
        
        let html = '<div class="cal-weekdays"><span>일</span><span>월</span><span>화</span><span>수</span><span>목</span><span>금</span><span>토</span></div><div class="cal-days">';
        for (let i = 0; i < startDay; i++) html += '<span class="cal-day empty"></span>';
        for (let day = 1; day <= totalDays; day++) {
            const dateKey = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            let cls = 'cal-day';
            if (data.history[dateKey]?.revealed) cls += ' has-record';
            if (dateKey === todayKey) cls += ' today';
            if (dateKey === this.state.selectedDate) cls += ' selected';
            html += `<span class="${cls}" data-date="${dateKey}">${day}</span>`;
        }
        html += '</div>';
        calendar.innerHTML = html;
    },
    
    showHistoryDetail(settings, charId, dateKey) {
        const detail = document.getElementById('sumone-history-detail');
        if (!detail) return;
        this.state.selectedDate = dateKey;
        const data = this.getData(settings, charId);
        const record = data.history[dateKey];
        const [y, m, d] = dateKey.split('-').map(Number);
        
        if (!record?.revealed) {
            detail.innerHTML = `<div class="history-date">${m}월 ${d}일</div><div class="history-placeholder">기록이 없습니다</div>`;
            return;
        }
        
        const esc = t => { const d = document.createElement('div'); d.textContent = t; return d.innerHTML; };
        let html = `<div class="history-date">${m}월 ${d}일</div>
            <div class="history-item"><span class="history-label">Q</span><span class="history-text">${esc(record.question)}</span></div>
            <div class="history-item"><span class="history-label">나</span><span class="history-text">${esc(record.myAnswer)}</span></div>
            <div class="history-item"><span class="history-label">${esc(record.charName||'캐릭터')}</span><span class="history-text">${esc(record.aiAnswer)}</span></div>`;
        if (record.comment) html += `<div class="history-item history-comment"><span class="history-label">💬</span><span class="history-text">${esc(record.comment)}</span></div>`;
        detail.innerHTML = html;
    },
    
    bindEvents(PhoneCore) {
        document.getElementById('sumone-submit')?.addEventListener('click', () => this.handleSubmit(PhoneCore));
        document.getElementById('sumone-my-answer')?.addEventListener('keydown', e => {
            if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); this.handleSubmit(PhoneCore); }
        });
        document.getElementById('sumone-history-btn')?.addEventListener('click', () => {
            PhoneCore.switchPage('sumone-history');
            const now = new Date();
            this.state.calendarYear = now.getFullYear();
            this.state.calendarMonth = now.getMonth();
            this.renderCalendar(PhoneCore.getSettings(), PhoneCore.getCharId(), this.state.calendarYear, this.state.calendarMonth);
            this.state.selectedDate = this.getTodayKey();
            this.showHistoryDetail(PhoneCore.getSettings(), PhoneCore.getCharId(), this.state.selectedDate);
            this.bindHistoryEvents(PhoneCore);
        });
    },
    
    bindHistoryEvents(PhoneCore) {
        document.getElementById('sumone-cal-prev')?.addEventListener('click', () => {
            this.state.calendarMonth--;
            if (this.state.calendarMonth < 0) { this.state.calendarMonth = 11; this.state.calendarYear--; }
            this.renderCalendar(PhoneCore.getSettings(), PhoneCore.getCharId(), this.state.calendarYear, this.state.calendarMonth);
            this.bindCalendarDays(PhoneCore);
        });
        document.getElementById('sumone-cal-next')?.addEventListener('click', () => {
            this.state.calendarMonth++;
            if (this.state.calendarMonth > 11) { this.state.calendarMonth = 0; this.state.calendarYear++; }
            this.renderCalendar(PhoneCore.getSettings(), PhoneCore.getCharId(), this.state.calendarYear, this.state.calendarMonth);
            this.bindCalendarDays(PhoneCore);
        });
        this.bindCalendarDays(PhoneCore);
    },
    
    bindCalendarDays(PhoneCore) {
        document.querySelectorAll('#sumone-calendar .cal-day:not(.empty)').forEach(el => {
            el.addEventListener('click', () => {
                this.state.selectedDate = el.dataset.date;
                this.renderCalendar(PhoneCore.getSettings(), PhoneCore.getCharId(), this.state.calendarYear, this.state.calendarMonth);
                this.showHistoryDetail(PhoneCore.getSettings(), PhoneCore.getCharId(), this.state.selectedDate);
                this.bindCalendarDays(PhoneCore);
            });
        });
    },
};

// ========================================
// Phone Core
// ========================================
const PhoneCore = {
    apps: { sumone: SumOneApp },
    currentPage: 'home',
    
    getContext: () => SillyTavern.getContext(),
    
    getSettings() {
        if (!extension_settings[extensionName]) {
            extension_settings[extensionName] = {
                enabledApps: { sumone: true },
                wallpapers: {},  // 캐릭터별 배경
                appData: {},
            };
        }
        return extension_settings[extensionName];
    },
    
    saveSettings: () => saveSettingsDebounced(),
    
    getCharId() {
        const ctx = this.getContext();
        return ctx.characterId ?? ctx.groupId ?? 'default';
    },
    
    getWallpaper() {
        const settings = this.getSettings();
        const charId = this.getCharId();
        return settings.wallpapers?.[charId] || '';
    },
    
    setWallpaper(dataUrl) {
        const settings = this.getSettings();
        const charId = this.getCharId();
        if (!settings.wallpapers) settings.wallpapers = {};
        settings.wallpapers[charId] = dataUrl;
        this.saveSettings();
        this.applyWallpaper();
    },
    
    applyWallpaper() {
        const homeScreen = document.querySelector('.phone-page[data-page="home"]');
        if (homeScreen) {
            const wp = this.getWallpaper();
            homeScreen.style.backgroundImage = wp ? `url(${wp})` : '';
            homeScreen.style.backgroundSize = 'cover';
            homeScreen.style.backgroundPosition = 'center';
        }
    },
    
    getCurrentTime() {
        const now = new Date();
        return `${now.getHours()}:${String(now.getMinutes()).padStart(2, '0')}`;
    },
    
    createHTML() {
        return `
        <div id="phone-modal" class="phone-modal" style="display:none;">
            <div class="phone-device">
                <div class="phone-inner">
                    <div class="phone-status-bar">
                        <span class="phone-time">${this.getCurrentTime()}</span>
                        <div class="phone-notch-area"></div>
                        <div class="phone-status-icons"><span>●●●●○</span><span>🔋</span></div>
                    </div>
                    <div class="phone-screen">
                        <div class="phone-page active" data-page="home">
                            <div class="phone-app-grid" id="phone-app-grid"></div>
                        </div>
                        <div class="phone-page" data-page="sumone"></div>
                        <div class="phone-page" data-page="sumone-history"></div>
                    </div>
                    <div class="phone-home-bar"></div>
                </div>
            </div>
        </div>`;
    },
    
    renderAppGrid() {
        const grid = document.getElementById('phone-app-grid');
        if (!grid) return;
        const settings = this.getSettings();
        
        let html = '';
        for (const [id, app] of Object.entries(this.apps)) {
            if (settings.enabledApps?.[id] !== false) {
                html += `<div class="phone-app-icon" data-app="${id}">
                    <div class="app-icon-image">${app.icon}</div>
                    <div class="app-icon-label">${app.name}</div>
                </div>`;
            }
        }
        grid.innerHTML = html;
        
        grid.querySelectorAll('.phone-app-icon').forEach(el => {
            el.addEventListener('click', () => this.openApp(el.dataset.app));
        });
        
        this.applyWallpaper();
    },
    
    switchPage(pageName) {
        this.currentPage = pageName;
        document.querySelectorAll('.phone-page').forEach(el => {
            el.classList.toggle('active', el.dataset.page === pageName);
        });
    },
    
    openApp(appId) {
        const app = this.apps[appId];
        if (!app) return;
        
        const ctx = this.getContext();
        if (ctx.characterId === undefined && !ctx.groupId) {
            toastr.warning('먼저 캐릭터를 선택해주세요.');
            return;
        }
        
        const charName = ctx.name2 || '캐릭터';
        const charId = this.getCharId();
        const settings = this.getSettings();
        
        // 앱 페이지 렌더링
        const page = document.querySelector(`.phone-page[data-page="${appId}"]`);
        if (page) {
            page.innerHTML = app.render(charName);
            this.switchPage(appId);
            app.loadUI(settings, charId, charName);
            app.bindEvents(this);
            
            // 뒤로가기 버튼
            page.querySelectorAll('.app-back-btn').forEach(btn => {
                btn.addEventListener('click', () => this.switchPage(btn.dataset.back));
            });
        }
        
        // 히스토리 페이지도 준비
        if (appId === 'sumone') {
            const histPage = document.querySelector('.phone-page[data-page="sumone-history"]');
            if (histPage) histPage.innerHTML = app.renderHistory();
        }
    },
    
    openModal() {
        const modal = document.getElementById('phone-modal');
        if (modal) {
            modal.style.display = 'flex';
            this.switchPage('home');
            this.renderAppGrid();
            document.querySelector('.phone-time').textContent = this.getCurrentTime();
        }
    },
    
    closeModal() {
        const modal = document.getElementById('phone-modal');
        if (modal) modal.style.display = 'none';
    },
    
    setupEvents() {
        const modal = document.getElementById('phone-modal');
        if (!modal) return;
        
        modal.addEventListener('click', e => { if (e.target === modal) this.closeModal(); });
        setInterval(() => {
            const el = document.querySelector('.phone-time');
            if (el) el.textContent = this.getCurrentTime();
        }, 60000);
    },
    
    createSettingsUI() {
        const settings = this.getSettings();
        const ctx = this.getContext();
        const charName = ctx.name2 || '(캐릭터 없음)';
        
        const html = `
        <div class="sumone-phone-settings">
            <div class="inline-drawer">
                <div class="inline-drawer-toggle inline-drawer-header">
                    <b>📱 썸원 폰</b>
                    <div class="inline-drawer-icon fa-solid fa-circle-chevron-down down"></div>
                </div>
                <div class="inline-drawer-content">
                    <p style="margin:10px 0;opacity:0.7;">v1.6.0 - 캐릭터별 배경</p>
                    <div style="margin:15px 0;">
                        <b>앱 표시</b>
                        ${Object.entries(this.apps).map(([id, app]) => `
                        <label style="display:flex;align-items:center;gap:8px;margin:8px 0;cursor:pointer;">
                            <input type="checkbox" class="phone-app-toggle" data-app="${id}" ${settings.enabledApps?.[id] !== false ? 'checked' : ''}>
                            <span>${app.icon} ${app.name}</span>
                        </label>`).join('')}
                    </div>
                    <div style="margin:15px 0;">
                        <b>배경화면</b> <span style="opacity:0.6;font-size:12px;">(현재: ${charName})</span>
                        <input type="file" id="phone-wallpaper-input" accept="image/*" style="display:none;">
                        <button id="phone-wallpaper-btn" class="menu_button" style="width:100%;margin-top:5px;">🖼️ 이미지 선택</button>
                        <button id="phone-wallpaper-reset" class="menu_button" style="width:100%;margin-top:5px;">↩️ 기본으로</button>
                    </div>
                </div>
            </div>
        </div>`;
        
        $('#extensions_settings').append(html);
        
        $('.phone-app-toggle').on('change', function() {
            const s = PhoneCore.getSettings();
            if (!s.enabledApps) s.enabledApps = {};
            s.enabledApps[$(this).data('app')] = this.checked;
            PhoneCore.saveSettings();
        });
        
        $('#phone-wallpaper-btn').on('click', () => $('#phone-wallpaper-input').click());
        $('#phone-wallpaper-input').on('change', function() {
            const file = this.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = e => { PhoneCore.setWallpaper(e.target.result); toastr.success('배경화면 변경!'); };
                reader.readAsDataURL(file);
            }
        });
        $('#phone-wallpaper-reset').on('click', () => { PhoneCore.setWallpaper(''); toastr.info('기본으로 복원'); });
    },
    
    addMenuButton() {
        $('#sumone-phone-container').remove();
        const html = `
        <div id="sumone-phone-container" class="extension_container interactable" tabindex="0">
            <div id="sumone-phone-btn" class="list-group-item flex-container flexGap5 interactable" tabindex="0">
                <div class="fa-solid fa-mobile-screen extensionsMenuExtensionButton" style="color:#ff6b9d;"></div>
                <span>썸원 폰</span>
            </div>
        </div>`;
        $('#extensionsMenu').prepend(html);
        $('#sumone-phone-btn').on('click', () => this.openModal());
    },
    
    init() {
        console.log('[SumOne Phone] Loading v1.6.0...');
        this.getSettings();
        this.createSettingsUI();
        $('body').append(this.createHTML());
        this.setupEvents();
        setTimeout(() => this.addMenuButton(), 1000);
        
        eventSource.on(event_types.CHAT_CHANGED, () => {
            // 캐릭터 바뀌면 배경도 바뀜
            this.applyWallpaper();
        });
        
        console.log('[SumOne Phone] Loaded!');
    },
};

jQuery(() => PhoneCore.init());
