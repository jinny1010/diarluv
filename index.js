// ========================================
// SumOne Phone v1.8.0
// 캐릭터가 먼저 행동하는 기능 추가
// ========================================

import { saveSettingsDebounced, eventSource, event_types } from '../../../../script.js';
import { extension_settings } from '../../../extensions.js';

const extensionName = 'sumone-phone';
const getContext = () => SillyTavern.getContext();

// ========================================
// 유틸리티
// ========================================
const Utils = {
    getTodayKey() {
        const now = new Date();
        return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    },
    formatDate(dateKey) {
        const [y, m, d] = dateKey.split('-').map(Number);
        return `${m}월 ${d}일`;
    },
    escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    },
    generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    },
    // 확률 체크 (0~100)
    chance(percent) {
        return Math.random() * 100 < percent;
    },
};

// ========================================
// 썸원 앱
// ========================================
const SumOneApp = {
    id: 'sumone',
    name: '썸원',
    icon: '💕',
    
    initialQuestions: [
        "처음 만났을 때 첫인상이 어땠어?", "나의 어떤 점이 제일 좋아?",
        "우리 사이에서 가장 행복했던 순간은?", "나한테 바라는 게 있어?",
        "같이 꼭 가보고 싶은 곳이 있어?", "나의 습관 중에 귀여운 거 있어?",
        "우리 10년 후에는 뭐 하고 있을까?", "내가 없으면 제일 먼저 뭐가 생각나?",
        "우리만의 특별한 기념일 만들까?", "나한테 고마운 점이 있어?",
        "같이 도전해보고 싶은 게 있어?", "내가 아플 때 어떻게 해줄 거야?",
        "우리 첫 데이트 기억나?", "나의 목소리 어때?", "같이 늙어가는 거 어때?",
        "나한테 하고 싶은 말 있어?", "우리 처음 손 잡았을 때 기억나?",
        "내가 제일 예뻐 보일 때가 언제야?", "나랑 있을 때 제일 행복해?",
        "우리 첫 키스 기억나?", "나의 어떤 모습이 제일 사랑스러워?",
        "같이 살면 어떨 것 같아?", "나한테 서운했던 적 있어?",
        "내가 요리해주면 뭐 먹고 싶어?", "나의 단점은 뭐라고 생각해?",
        "내가 울면 어떻게 해줄 거야?", "같이 보고 싶은 영화 있어?",
        "나한테 반한 순간이 있어?", "우리 결혼하면 어디서 살고 싶어?",
        "내가 없는 하루는 어때?", "나의 향기 좋아해?", "같이 듣고 싶은 노래 있어?",
        "나를 한 단어로 표현한다면?", "제일 기억에 남는 선물이 뭐야?",
        "내가 화났을 때 어떻게 할 거야?", "같이 먹고 싶은 음식 있어?",
        "나의 잠버릇 알아?", "내가 갑자기 사라지면 어떡할 거야?",
        "나의 가장 좋아하는 표정은?", "같이 배우고 싶은 거 있어?",
        "나한테 질투 느낀 적 있어?", "우리 늙으면 뭐 하고 싶어?",
        "나의 웃음소리 좋아해?", "같이 키우고 싶은 동물 있어?",
        "나한테 숨기는 거 있어?", "우리 다음 여행은 어디로 갈까?",
        "나를 처음 좋아하게 된 이유는?",
    ],
    
    state: { isGenerating: false, currentQuestion: null, selectedDate: null, calYear: null, calMonth: null },
    
    getData(settings, charId) {
        const key = `sumone_${charId}`;
        if (!settings.appData) settings.appData = {};
        if (!settings.appData[key]) {
            settings.appData[key] = { history: {}, questionPool: [...this.initialQuestions], usedQuestions: [] };
        }
        return settings.appData[key];
    },
    
    getQuestion(data) {
        if (data.questionPool.length === 0) {
            data.questionPool = [...this.initialQuestions];
            data.usedQuestions = [];
        }
        const idx = Math.floor(Math.random() * data.questionPool.length);
        return data.questionPool.splice(idx, 1)[0];
    },
    
    getTodayData(settings, charId, charName) {
        const data = this.getData(settings, charId);
        const today = Utils.getTodayKey();
        if (!data.history[today]?.question) {
            data.history[today] = { question: this.getQuestion(data), myAnswer: null, aiAnswer: null, comment: null, revealed: false, charName };
        }
        return data.history[today];
    },
    
    async generateResponse(question, userAnswer, charName, userName) {
        const ctx = getContext();
        const prompt = `[커플 Q&A "썸원"] 질문: "${question}" / ${userName}: "${userAnswer}"
${charName}로서 답변(1-2문장)과 코멘트(1문장, 달달하게) 작성.
형식 - 답변: / 코멘트: / 한국어, 액션(*) 없이:`;
        try {
            const result = await ctx.generateQuietPrompt(prompt, false, false);
            let answer = '', comment = '';
            for (const line of result.split('\n').filter(l => l.trim())) {
                if (line.match(/^답변?:/)) answer = line.replace(/^답변?:\s*/, '').replace(/\*[^*]*\*/g, '').trim();
                else if (line.match(/^(코멘트|반응):/)) comment = line.replace(/^(코멘트|반응):\s*/, '').replace(/\*[^*]*\*/g, '').trim();
            }
            if (!answer) answer = result.split('\n')[0]?.replace(/\*[^*]*\*/g, '').trim() || '';
            return { answer: answer.substring(0, 150), comment: comment.substring(0, 100) };
        } catch (e) { return { answer: null, comment: null }; }
    },
    
    render(charName) {
        return `
        <div class="app-header">
            <button class="app-back-btn" data-back="home">◀</button>
            <span class="app-title">썸원</span>
            <button class="app-nav-btn" id="sumone-history-btn">📅</button>
        </div>
        <div class="app-content">
            <div class="card pink"><div class="card-label">오늘의 질문</div><div id="sumone-question">로딩 중...</div></div>
            <div class="card"><div class="card-label">나의 답변</div>
                <textarea id="sumone-input" placeholder="답변을 입력하세요..."></textarea>
                <button id="sumone-submit" class="btn-primary">제출하기</button>
            </div>
            <div class="card" id="sumone-ai-box" style="display:none;"><div class="card-label"><span class="char-name">${charName}</span>의 답변</div><div id="sumone-ai-answer"></div></div>
            <div class="card pink-light" id="sumone-comment-box" style="display:none;"><div class="card-label">💬 코멘트</div><div id="sumone-comment"></div></div>
            <div id="sumone-typing" class="typing-box" style="display:none;"><span class="char-name">${charName}</span> 님이 답변 중<span class="dots"><span>.</span><span>.</span><span>.</span></span></div>
        </div>`;
    },
    
    renderHistory() {
        return `
        <div class="app-header">
            <button class="app-back-btn" data-back="sumone">◀</button>
            <span class="app-title">히스토리</span><span></span>
        </div>
        <div class="app-content">
            <div class="calendar-nav"><button id="sumone-cal-prev">◀</button><span id="sumone-cal-title"></span><button id="sumone-cal-next">▶</button></div>
            <div class="calendar" id="sumone-calendar"></div>
            <div class="card" id="sumone-history-detail"><div class="empty-state">날짜를 선택하세요</div></div>
        </div>`;
    },
    
    loadUI(settings, charId, charName) {
        const data = this.getTodayData(settings, charId, charName);
        this.state.currentQuestion = data.question;
        document.getElementById('sumone-question').textContent = data.question;
        
        if (data.revealed) {
            document.getElementById('sumone-input').value = data.myAnswer || '';
            document.getElementById('sumone-input').disabled = true;
            document.getElementById('sumone-submit').disabled = true;
            document.getElementById('sumone-submit').textContent = '오늘 완료 ✓';
            document.getElementById('sumone-ai-box').style.display = 'block';
            document.getElementById('sumone-ai-answer').textContent = data.aiAnswer || '';
            if (data.comment) {
                document.getElementById('sumone-comment-box').style.display = 'block';
                document.getElementById('sumone-comment').textContent = data.comment;
            }
        } else if (this.state.isGenerating) {
            document.getElementById('sumone-input').disabled = true;
            document.getElementById('sumone-submit').disabled = true;
            document.getElementById('sumone-typing').style.display = 'block';
        }
    },
    
    async handleSubmit(Core) {
        if (this.state.isGenerating) return;
        const input = document.getElementById('sumone-input');
        const answer = input?.value.trim();
        if (!answer) { toastr.warning('답변을 입력해주세요!'); return; }
        
        const ctx = getContext();
        const settings = Core.getSettings();
        const charId = Core.getCharId();
        const charName = ctx.name2 || '캐릭터';
        
        this.state.isGenerating = true;
        input.disabled = true;
        document.getElementById('sumone-submit').disabled = true;
        document.getElementById('sumone-typing').style.display = 'block';
        
        const { answer: aiAnswer, comment } = await this.generateResponse(this.state.currentQuestion, answer, charName, ctx.name1 || '나');
        this.state.isGenerating = false;
        
        if (!aiAnswer) {
            toastr.error('생성 실패');
            input.disabled = false;
            document.getElementById('sumone-submit').disabled = false;
            document.getElementById('sumone-typing').style.display = 'none';
            return;
        }
        
        const data = this.getData(settings, charId);
        data.history[Utils.getTodayKey()] = { question: this.state.currentQuestion, myAnswer: answer, aiAnswer, comment, revealed: true, charName };
        Core.saveSettings();
        
        document.getElementById('sumone-typing').style.display = 'none';
        document.getElementById('sumone-ai-box').style.display = 'block';
        document.getElementById('sumone-ai-answer').textContent = aiAnswer;
        if (comment) {
            document.getElementById('sumone-comment-box').style.display = 'block';
            document.getElementById('sumone-comment').textContent = comment;
        }
        document.getElementById('sumone-submit').textContent = '오늘 완료 ✓';
        toastr.success('💕 답변이 도착했습니다!');
    },
    
    renderCalendar(settings, charId, year, month) {
        this.state.calYear = year;
        this.state.calMonth = month;
        document.getElementById('sumone-cal-title').textContent = `${year}년 ${month + 1}월`;
        const data = this.getData(settings, charId);
        const startDay = new Date(year, month, 1).getDay();
        const totalDays = new Date(year, month + 1, 0).getDate();
        const today = Utils.getTodayKey();
        
        let html = '<div class="cal-week"><span>일</span><span>월</span><span>화</span><span>수</span><span>목</span><span>금</span><span>토</span></div><div class="cal-days">';
        for (let i = 0; i < startDay; i++) html += '<span class="cal-day empty"></span>';
        for (let d = 1; d <= totalDays; d++) {
            const key = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
            const cls = ['cal-day', data.history[key]?.revealed ? 'has-data' : '', key === today ? 'today' : '', key === this.state.selectedDate ? 'selected' : ''].filter(Boolean).join(' ');
            html += `<span class="${cls}" data-date="${key}">${d}</span>`;
        }
        document.getElementById('sumone-calendar').innerHTML = html + '</div>';
    },
    
    showDetail(settings, charId, dateKey) {
        this.state.selectedDate = dateKey;
        const data = this.getData(settings, charId);
        const record = data.history[dateKey];
        const detail = document.getElementById('sumone-history-detail');
        
        if (!record?.revealed) {
            detail.innerHTML = `<div class="detail-date">${Utils.formatDate(dateKey)}</div><div class="empty-state">기록이 없습니다</div>`;
            return;
        }
        detail.innerHTML = `
            <div class="detail-date">${Utils.formatDate(dateKey)}</div>
            <div class="detail-row"><span class="label">Q</span><span>${Utils.escapeHtml(record.question)}</span></div>
            <div class="detail-row"><span class="label">나</span><span>${Utils.escapeHtml(record.myAnswer)}</span></div>
            <div class="detail-row"><span class="label">${Utils.escapeHtml(record.charName)}</span><span>${Utils.escapeHtml(record.aiAnswer)}</span></div>
            ${record.comment ? `<div class="detail-row comment"><span class="label">💬</span><span>${Utils.escapeHtml(record.comment)}</span></div>` : ''}`;
    },
    
    bindEvents(Core) {
        document.getElementById('sumone-submit')?.addEventListener('click', () => this.handleSubmit(Core));
        document.getElementById('sumone-input')?.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); this.handleSubmit(Core); } });
        document.getElementById('sumone-history-btn')?.addEventListener('click', () => {
            Core.openPage('sumone-history', this.renderHistory());
            const now = new Date();
            this.renderCalendar(Core.getSettings(), Core.getCharId(), now.getFullYear(), now.getMonth());
            this.state.selectedDate = Utils.getTodayKey();
            this.showDetail(Core.getSettings(), Core.getCharId(), this.state.selectedDate);
            this.bindHistoryEvents(Core);
        });
    },
    
    bindHistoryEvents(Core) {
        const settings = Core.getSettings(), charId = Core.getCharId();
        document.getElementById('sumone-cal-prev')?.addEventListener('click', () => {
            if (--this.state.calMonth < 0) { this.state.calMonth = 11; this.state.calYear--; }
            this.renderCalendar(settings, charId, this.state.calYear, this.state.calMonth);
            this.bindCalendarDays(Core);
        });
        document.getElementById('sumone-cal-next')?.addEventListener('click', () => {
            if (++this.state.calMonth > 11) { this.state.calMonth = 0; this.state.calYear++; }
            this.renderCalendar(settings, charId, this.state.calYear, this.state.calMonth);
            this.bindCalendarDays(Core);
        });
        this.bindCalendarDays(Core);
    },
    
    bindCalendarDays(Core) {
        document.querySelectorAll('#sumone-calendar .cal-day:not(.empty)').forEach(el => {
            el.onclick = () => {
                this.showDetail(Core.getSettings(), Core.getCharId(), el.dataset.date);
                this.renderCalendar(Core.getSettings(), Core.getCharId(), this.state.calYear, this.state.calMonth);
                this.bindCalendarDays(Core);
            };
        });
    },
};

// ========================================
// 편지 앱 (캐릭터가 먼저 보내기 기능)
// ========================================
const LetterApp = {
    id: 'letter',
    name: '편지',
    icon: '💌',
    state: { currentLetter: null, viewMode: 'list', isGenerating: false },
    
    getData(settings, charId) {
        const key = `letter_${charId}`;
        if (!settings.appData) settings.appData = {};
        if (!settings.appData[key]) settings.appData[key] = { letters: [], lastCharLetterDate: null };
        return settings.appData[key];
    },
    
    // 캐릭터가 먼저 편지 보내기 (30% 확률, 하루 1번)
    async tryCharacterLetter(settings, charId, charName, userName) {
        const data = this.getData(settings, charId);
        const today = Utils.getTodayKey();
        
        // 오늘 이미 캐릭터 편지 있으면 스킵
        if (data.lastCharLetterDate === today) return null;
        
        // 30% 확률
        if (!Utils.chance(30)) {
            data.lastCharLetterDate = today; // 확률 실패해도 오늘은 더 이상 시도 안 함
            return null;
        }
        
        const ctx = getContext();
        const prompt = `[편지 쓰기] ${charName}가 ${userName}에게 보내는 짧은 편지를 써줘.
일상적인 안부, 보고싶다는 말, 오늘 있었던 일, 고마운 마음 중 하나를 골라서.
2-4문장, 한국어, 자연스럽게, 액션(*) 없이:`;
        
        try {
            const result = await ctx.generateQuietPrompt(prompt, false, false);
            const content = result.replace(/\*[^*]*\*/g, '').trim().substring(0, 300);
            
            if (content && content.length > 10) {
                data.letters.push({
                    id: Utils.generateId(),
                    date: today,
                    content: content,
                    fromMe: false,
                    charName: charName,
                    read: false,
                });
                data.lastCharLetterDate = today;
                return content;
            }
        } catch (e) {
            console.error('[Letter] Character letter failed:', e);
        }
        return null;
    },
    
    getUnreadCount(data) {
        return data.letters.filter(l => !l.fromMe && !l.read).length;
    },
    
    render(charName) {
        return `
        <div class="app-header">
            <button class="app-back-btn" data-back="home">◀</button>
            <span class="app-title">편지</span>
            <button class="app-nav-btn" id="letter-write-btn">✏️</button>
        </div>
        <div class="app-content" id="letter-content"></div>`;
    },
    
    renderList(data, charName) {
        const unread = this.getUnreadCount(data);
        let header = unread > 0 ? `<div class="notification-banner">💌 새 편지가 ${unread}통 도착했어요!</div>` : '';
        
        if (data.letters.length === 0) {
            return header + `<div class="empty-state">💌<br>아직 편지가 없어요<br><small>✏️ 버튼으로 편지를 써보세요</small></div>`;
        }
        
        return header + data.letters.map((l, i) => `
            <div class="list-item ${!l.fromMe && !l.read ? 'unread' : ''}" data-idx="${i}">
                <div class="list-icon">${l.fromMe ? '📤' : '📩'}</div>
                <div class="list-content">
                    <div class="list-title">${l.fromMe ? `To. ${charName}` : `From. ${l.charName || charName}`}${!l.fromMe && !l.read ? ' 🆕' : ''}</div>
                    <div class="list-preview">${Utils.escapeHtml(l.content.substring(0, 30))}...</div>
                </div>
                <div class="list-date">${Utils.formatDate(l.date)}</div>
            </div>
        `).reverse().join('');
    },
    
    renderWrite(charName) {
        return `
        <div class="letter-paper">
            <div class="letter-to">To. ${charName}</div>
            <textarea id="letter-textarea" placeholder="마음을 담아 편지를 써보세요..."></textarea>
            <div class="letter-from">From. 나</div>
            <button id="letter-send" class="btn-primary">💌 편지 보내기</button>
        </div>`;
    },
    
    renderView(letter, charName, isFromChar) {
        return `
        <div class="letter-paper ${isFromChar ? 'received' : ''}">
            <div class="letter-to">${letter.fromMe ? `To. ${charName}` : 'To. 나'}</div>
            <div class="letter-body">${Utils.escapeHtml(letter.content)}</div>
            <div class="letter-from">${letter.fromMe ? 'From. 나' : `From. ${letter.charName || charName}`}</div>
            ${letter.reply ? `<div class="letter-reply"><div class="reply-label">💕 답장</div><div class="reply-content">${Utils.escapeHtml(letter.reply)}</div></div>` : ''}
            <button id="letter-back-list" class="btn-secondary">목록으로</button>
        </div>`;
    },
    
    async generateReply(content, charName) {
        const ctx = getContext();
        const prompt = `[편지 답장] ${ctx.name1 || '나'}가 보낸 편지: "${content}"
${charName}(으)로서 진심어린 답장 작성 (2-3문장, 한국어, 액션 없이):`;
        try {
            let result = await ctx.generateQuietPrompt(prompt, false, false);
            return result.replace(/\*[^*]*\*/g, '').trim().substring(0, 200);
        } catch { return null; }
    },
    
    async loadUI(settings, charId, charName) {
        const data = this.getData(settings, charId);
        const userName = getContext().name1 || '나';
        
        // 캐릭터 편지 시도
        if (!this.state.isGenerating) {
            this.state.isGenerating = true;
            document.getElementById('letter-content').innerHTML = '<div class="loading-state">💌 우편함 확인 중...</div>';
            
            const charLetter = await this.tryCharacterLetter(settings, charId, charName, userName);
            if (charLetter) {
                saveSettingsDebounced();
                toastr.info(`💌 ${charName}에게서 편지가 도착했어요!`);
            }
            this.state.isGenerating = false;
        }
        
        document.getElementById('letter-content').innerHTML = this.renderList(data, charName);
        this.bindListEvents(settings, charId, charName);
    },
    
    bindEvents(Core) {
        document.getElementById('letter-write-btn')?.addEventListener('click', () => {
            const charName = getContext().name2 || '캐릭터';
            this.state.viewMode = 'write';
            document.getElementById('letter-content').innerHTML = this.renderWrite(charName);
            this.bindWriteEvents(Core);
        });
    },
    
    bindListEvents(settings, charId, charName) {
        document.querySelectorAll('#letter-content .list-item').forEach(el => {
            el.onclick = () => {
                const data = this.getData(settings, charId);
                const idx = parseInt(el.dataset.idx);
                const letter = data.letters[idx];
                
                // 읽음 처리
                if (!letter.fromMe && !letter.read) {
                    letter.read = true;
                    saveSettingsDebounced();
                }
                
                this.state.viewMode = 'view';
                document.getElementById('letter-content').innerHTML = this.renderView(letter, charName, !letter.fromMe);
                document.getElementById('letter-back-list')?.addEventListener('click', () => {
                    this.state.viewMode = 'list';
                    document.getElementById('letter-content').innerHTML = this.renderList(data, charName);
                    this.bindListEvents(settings, charId, charName);
                });
            };
        });
    },
    
    bindWriteEvents(Core) {
        document.getElementById('letter-send')?.addEventListener('click', async () => {
            const content = document.getElementById('letter-textarea')?.value.trim();
            if (!content) { toastr.warning('편지 내용을 입력해주세요!'); return; }
            
            const ctx = getContext();
            const settings = Core.getSettings();
            const charId = Core.getCharId();
            const charName = ctx.name2 || '캐릭터';
            const data = this.getData(settings, charId);
            
            document.getElementById('letter-send').disabled = true;
            document.getElementById('letter-send').textContent = `${charName} 님이 읽는 중...`;
            
            const reply = await this.generateReply(content, charName);
            
            data.letters.push({ id: Utils.generateId(), date: Utils.getTodayKey(), content, reply, fromMe: true });
            Core.saveSettings();
            
            toastr.success('💌 편지를 보냈습니다!');
            this.state.viewMode = 'list';
            document.getElementById('letter-content').innerHTML = this.renderList(data, charName);
            this.bindListEvents(settings, charId, charName);
        });
    },
};

// ========================================
// 독서기록 앱 (캐릭터 추천 기능)
// ========================================
const BookApp = {
    id: 'book',
    name: '독서',
    icon: '📚',
    state: { isGenerating: false },
    
    getData(settings, charId) {
        const key = `book_${charId}`;
        if (!settings.appData) settings.appData = {};
        if (!settings.appData[key]) settings.appData[key] = { books: [], lastCharRecommendDate: null };
        return settings.appData[key];
    },
    
    // 캐릭터가 책 추천 (25% 확률)
    async tryCharacterRecommend(settings, charId, charName, userName) {
        const data = this.getData(settings, charId);
        const today = Utils.getTodayKey();
        
        if (data.lastCharRecommendDate === today) return null;
        if (!Utils.chance(25)) {
            data.lastCharRecommendDate = today;
            return null;
        }
        
        const ctx = getContext();
        const prompt = `[책 추천] ${charName}가 ${userName}에게 책을 추천해줘.
형식:
제목: (책 제목)
이유: (왜 추천하는지 1-2문장)
한국어로, 실제 존재하거나 그럴듯한 책으로:`;
        
        try {
            const result = await ctx.generateQuietPrompt(prompt, false, false);
            let title = '', reason = '';
            for (const line of result.split('\n')) {
                if (line.includes('제목:')) title = line.replace(/.*제목:\s*/, '').trim();
                if (line.includes('이유:')) reason = line.replace(/.*이유:\s*/, '').trim();
            }
            if (!title) title = result.split('\n')[0]?.trim() || '추천 도서';
            
            if (title) {
                data.books.push({
                    date: today,
                    title: title.substring(0, 50),
                    author: charName + ' 추천',
                    rating: 0,
                    review: '',
                    charComment: reason.substring(0, 150) || `${userName}이 좋아할 것 같아서!`,
                    fromChar: true,
                    read: false,
                });
                data.lastCharRecommendDate = today;
                return title;
            }
        } catch (e) {
            console.error('[Book] Character recommend failed:', e);
        }
        return null;
    },
    
    render() {
        return `
        <div class="app-header">
            <button class="app-back-btn" data-back="home">◀</button>
            <span class="app-title">독서기록</span>
            <button class="app-nav-btn" id="book-add-btn">➕</button>
        </div>
        <div class="app-content" id="book-content"></div>`;
    },
    
    renderList(data, charName) {
        const unread = data.books.filter(b => b.fromChar && !b.read).length;
        let header = unread > 0 ? `<div class="notification-banner">📚 ${charName}의 새 추천이 ${unread}개 있어요!</div>` : '';
        
        if (data.books.length === 0) {
            return header + `<div class="empty-state">📚<br>아직 기록이 없어요<br><small>➕ 버튼으로 책을 추가해보세요</small></div>`;
        }
        return header + data.books.map((b, i) => `
            <div class="list-item ${b.fromChar && !b.read ? 'unread' : ''}" data-idx="${i}">
                <div class="list-icon">${b.fromChar ? '🎁' : '📖'}</div>
                <div class="list-content">
                    <div class="list-title">${Utils.escapeHtml(b.title)}${b.fromChar && !b.read ? ' 🆕' : ''}</div>
                    <div class="list-preview">${Utils.escapeHtml(b.author)} ${b.rating ? '· ' + '⭐'.repeat(b.rating) : ''}</div>
                </div>
                <div class="list-date">${Utils.formatDate(b.date)}</div>
            </div>
        `).reverse().join('');
    },
    
    renderAdd() {
        return `
        <div class="form-card">
            <div class="form-group"><label>책 제목</label><input type="text" id="book-title" placeholder="책 제목"></div>
            <div class="form-group"><label>저자</label><input type="text" id="book-author" placeholder="저자"></div>
            <div class="form-group"><label>평점</label>
                <div class="rating" id="book-rating">${[1,2,3,4,5].map(n => `<span data-n="${n}">☆</span>`).join('')}</div>
            </div>
            <div class="form-group"><label>감상</label><textarea id="book-review" placeholder="책에 대한 감상을 적어보세요..."></textarea></div>
            <div class="form-group"><label>💬 캐릭터에게 물어보기</label>
                <button id="book-recommend" class="btn-secondary">이 책에 대해 물어보기</button>
                <div id="book-recommend-result" class="recommend-result"></div>
            </div>
            <button id="book-save" class="btn-primary">저장하기</button>
        </div>`;
    },
    
    renderView(book, charName) {
        return `
        <div class="detail-card">
            <div class="detail-header">${book.fromChar ? '🎁 ' : '📖 '}${Utils.escapeHtml(book.title)}</div>
            <div class="detail-sub">${Utils.escapeHtml(book.author)} ${book.rating ? '· ' + '⭐'.repeat(book.rating) : ''}</div>
            ${book.review ? `<div class="detail-body">${Utils.escapeHtml(book.review)}</div>` : ''}
            ${book.charComment ? `<div class="char-comment"><span class="char-name">${charName}</span>의 한마디<br>"${Utils.escapeHtml(book.charComment)}"</div>` : ''}
            <button id="book-back-list" class="btn-secondary">목록으로</button>
        </div>`;
    },
    
    async getRecommendation(title, charName) {
        const ctx = getContext();
        const prompt = `[독서 토크] ${ctx.name1}가 "${title}" 책 읽는다고 함.
${charName}(으)로서 이 책에 대한 생각이나 반응 (1-2문장, 한국어):`;
        try {
            let result = await ctx.generateQuietPrompt(prompt, false, false);
            return result.replace(/\*[^*]*\*/g, '').trim().substring(0, 150);
        } catch { return null; }
    },
    
    async loadUI(settings, charId, charName) {
        const data = this.getData(settings, charId);
        const userName = getContext().name1 || '나';
        
        if (!this.state.isGenerating) {
            this.state.isGenerating = true;
            document.getElementById('book-content').innerHTML = '<div class="loading-state">📚 책장 확인 중...</div>';
            
            const charBook = await this.tryCharacterRecommend(settings, charId, charName, userName);
            if (charBook) {
                saveSettingsDebounced();
                toastr.info(`📚 ${charName}가 책을 추천해줬어요!`);
            }
            this.state.isGenerating = false;
        }
        
        document.getElementById('book-content').innerHTML = this.renderList(data, charName);
        this.bindListEvents(settings, charId, charName);
    },
    
    bindEvents(Core) {
        document.getElementById('book-add-btn')?.addEventListener('click', () => {
            document.getElementById('book-content').innerHTML = this.renderAdd();
            this.bindAddEvents(Core);
        });
    },
    
    bindListEvents(settings, charId, charName) {
        document.querySelectorAll('#book-content .list-item').forEach(el => {
            el.onclick = () => {
                const data = this.getData(settings, charId);
                const idx = parseInt(el.dataset.idx);
                const book = data.books[idx];
                
                if (book.fromChar && !book.read) {
                    book.read = true;
                    saveSettingsDebounced();
                }
                
                document.getElementById('book-content').innerHTML = this.renderView(book, charName);
                document.getElementById('book-back-list')?.addEventListener('click', () => {
                    document.getElementById('book-content').innerHTML = this.renderList(data, charName);
                    this.bindListEvents(settings, charId, charName);
                });
            };
        });
    },
    
    bindAddEvents(Core) {
        let rating = 0;
        let charComment = null;
        
        document.querySelectorAll('#book-rating span').forEach(el => {
            el.onclick = () => {
                rating = parseInt(el.dataset.n);
                document.querySelectorAll('#book-rating span').forEach((s, i) => s.textContent = i < rating ? '⭐' : '☆');
            };
        });
        
        document.getElementById('book-recommend')?.addEventListener('click', async () => {
            const title = document.getElementById('book-title')?.value.trim();
            if (!title) { toastr.warning('책 제목을 먼저 입력해주세요!'); return; }
            document.getElementById('book-recommend').disabled = true;
            document.getElementById('book-recommend-result').innerHTML = '<span class="loading">생각 중...</span>';
            charComment = await this.getRecommendation(title, getContext().name2 || '캐릭터');
            document.getElementById('book-recommend-result').innerHTML = charComment ? `"${Utils.escapeHtml(charComment)}"` : '응답 실패';
            document.getElementById('book-recommend').disabled = false;
        });
        
        document.getElementById('book-save')?.addEventListener('click', () => {
            const title = document.getElementById('book-title')?.value.trim();
            const author = document.getElementById('book-author')?.value.trim();
            const review = document.getElementById('book-review')?.value.trim();
            if (!title) { toastr.warning('책 제목을 입력해주세요!'); return; }
            
            const settings = Core.getSettings();
            const charId = Core.getCharId();
            const data = this.getData(settings, charId);
            data.books.push({ date: Utils.getTodayKey(), title, author, rating, review, charComment, fromChar: false });
            Core.saveSettings();
            toastr.success('📚 저장되었습니다!');
            document.getElementById('book-content').innerHTML = this.renderList(data, getContext().name2 || '캐릭터');
            this.bindListEvents(settings, charId, getContext().name2 || '캐릭터');
        });
    },
};

// ========================================
// 영화기록 앱 (캐릭터 추천 기능)
// ========================================
const MovieApp = {
    id: 'movie',
    name: '영화',
    icon: '🎬',
    state: { isGenerating: false },
    
    getData(settings, charId) {
        const key = `movie_${charId}`;
        if (!settings.appData) settings.appData = {};
        if (!settings.appData[key]) settings.appData[key] = { movies: [], lastCharRecommendDate: null };
        return settings.appData[key];
    },
    
    // 캐릭터가 영화 추천 (25% 확률)
    async tryCharacterRecommend(settings, charId, charName, userName) {
        const data = this.getData(settings, charId);
        const today = Utils.getTodayKey();
        
        if (data.lastCharRecommendDate === today) return null;
        if (!Utils.chance(25)) {
            data.lastCharRecommendDate = today;
            return null;
        }
        
        const ctx = getContext();
        const prompt = `[영화 추천] ${charName}가 ${userName}에게 같이 보고 싶은 영화를 추천해줘.
형식:
제목: (영화 제목)
장르: (장르)
이유: (왜 같이 보고 싶은지 1문장)
한국어로:`;
        
        try {
            const result = await ctx.generateQuietPrompt(prompt, false, false);
            let title = '', genre = '', reason = '';
            for (const line of result.split('\n')) {
                if (line.includes('제목:')) title = line.replace(/.*제목:\s*/, '').trim();
                if (line.includes('장르:')) genre = line.replace(/.*장르:\s*/, '').trim();
                if (line.includes('이유:')) reason = line.replace(/.*이유:\s*/, '').trim();
            }
            if (!title) title = result.split('\n')[0]?.trim() || '추천 영화';
            
            if (title) {
                data.movies.push({
                    date: today,
                    title: title.substring(0, 50),
                    genre: genre.substring(0, 20) || '',
                    rating: 0,
                    review: '',
                    charComment: reason.substring(0, 150) || `${userName}이랑 같이 보고 싶어!`,
                    fromChar: true,
                    read: false,
                });
                data.lastCharRecommendDate = today;
                return title;
            }
        } catch (e) {
            console.error('[Movie] Character recommend failed:', e);
        }
        return null;
    },
    
    render() {
        return `
        <div class="app-header">
            <button class="app-back-btn" data-back="home">◀</button>
            <span class="app-title">영화기록</span>
            <button class="app-nav-btn" id="movie-add-btn">➕</button>
        </div>
        <div class="app-content" id="movie-content"></div>`;
    },
    
    renderList(data, charName) {
        const unread = data.movies.filter(m => m.fromChar && !m.read).length;
        let header = unread > 0 ? `<div class="notification-banner">🎬 ${charName}의 새 추천이 ${unread}개 있어요!</div>` : '';
        
        if (data.movies.length === 0) {
            return header + `<div class="empty-state">🎬<br>아직 기록이 없어요<br><small>➕ 버튼으로 영화를 추가해보세요</small></div>`;
        }
        return header + data.movies.map((m, i) => `
            <div class="list-item ${m.fromChar && !m.read ? 'unread' : ''}" data-idx="${i}">
                <div class="list-icon">${m.fromChar ? '🎁' : '🎥'}</div>
                <div class="list-content">
                    <div class="list-title">${Utils.escapeHtml(m.title)}${m.fromChar && !m.read ? ' 🆕' : ''}</div>
                    <div class="list-preview">${m.genre || ''} ${m.rating ? '· ' + '⭐'.repeat(m.rating) : ''}</div>
                </div>
                <div class="list-date">${Utils.formatDate(m.date)}</div>
            </div>
        `).reverse().join('');
    },
    
    renderAdd() {
        return `
        <div class="form-card">
            <div class="form-group"><label>영화 제목</label><input type="text" id="movie-title" placeholder="영화 제목"></div>
            <div class="form-group"><label>장르</label><input type="text" id="movie-genre" placeholder="장르 (로맨스, 액션 등)"></div>
            <div class="form-group"><label>평점</label>
                <div class="rating" id="movie-rating">${[1,2,3,4,5].map(n => `<span data-n="${n}">☆</span>`).join('')}</div>
            </div>
            <div class="form-group"><label>감상</label><textarea id="movie-review" placeholder="영화에 대한 감상..."></textarea></div>
            <div class="form-group"><label>💬 같이 본 소감</label>
                <button id="movie-discuss" class="btn-secondary">캐릭터와 이야기하기</button>
                <div id="movie-discuss-result" class="recommend-result"></div>
            </div>
            <button id="movie-save" class="btn-primary">저장하기</button>
        </div>`;
    },
    
    renderView(movie, charName) {
        return `
        <div class="detail-card">
            <div class="detail-header">${movie.fromChar ? '🎁 ' : '🎬 '}${Utils.escapeHtml(movie.title)}</div>
            <div class="detail-sub">${movie.genre || ''} ${movie.rating ? '· ' + '⭐'.repeat(movie.rating) : ''}</div>
            ${movie.review ? `<div class="detail-body">${Utils.escapeHtml(movie.review)}</div>` : ''}
            ${movie.charComment ? `<div class="char-comment"><span class="char-name">${charName}</span>의 한마디<br>"${Utils.escapeHtml(movie.charComment)}"</div>` : ''}
            <button id="movie-back-list" class="btn-secondary">목록으로</button>
        </div>`;
    },
    
    async getDiscussion(title, charName) {
        const ctx = getContext();
        const prompt = `[영화 감상] ${ctx.name1}와 "${title}" 영화를 같이 봤어.
${charName}(으)로서 이 영화 감상 (1-2문장, 한국어):`;
        try {
            let result = await ctx.generateQuietPrompt(prompt, false, false);
            return result.replace(/\*[^*]*\*/g, '').trim().substring(0, 150);
        } catch { return null; }
    },
    
    async loadUI(settings, charId, charName) {
        const data = this.getData(settings, charId);
        const userName = getContext().name1 || '나';
        
        if (!this.state.isGenerating) {
            this.state.isGenerating = true;
            document.getElementById('movie-content').innerHTML = '<div class="loading-state">🎬 영화관 확인 중...</div>';
            
            const charMovie = await this.tryCharacterRecommend(settings, charId, charName, userName);
            if (charMovie) {
                saveSettingsDebounced();
                toastr.info(`🎬 ${charName}가 영화를 추천해줬어요!`);
            }
            this.state.isGenerating = false;
        }
        
        document.getElementById('movie-content').innerHTML = this.renderList(data, charName);
        this.bindListEvents(settings, charId, charName);
    },
    
    bindEvents(Core) {
        document.getElementById('movie-add-btn')?.addEventListener('click', () => {
            document.getElementById('movie-content').innerHTML = this.renderAdd();
            this.bindAddEvents(Core);
        });
    },
    
    bindListEvents(settings, charId, charName) {
        document.querySelectorAll('#movie-content .list-item').forEach(el => {
            el.onclick = () => {
                const data = this.getData(settings, charId);
                const idx = parseInt(el.dataset.idx);
                const movie = data.movies[idx];
                
                if (movie.fromChar && !movie.read) {
                    movie.read = true;
                    saveSettingsDebounced();
                }
                
                document.getElementById('movie-content').innerHTML = this.renderView(movie, charName);
                document.getElementById('movie-back-list')?.addEventListener('click', () => {
                    document.getElementById('movie-content').innerHTML = this.renderList(data, charName);
                    this.bindListEvents(settings, charId, charName);
                });
            };
        });
    },
    
    bindAddEvents(Core) {
        let rating = 0;
        let charComment = null;
        
        document.querySelectorAll('#movie-rating span').forEach(el => {
            el.onclick = () => {
                rating = parseInt(el.dataset.n);
                document.querySelectorAll('#movie-rating span').forEach((s, i) => s.textContent = i < rating ? '⭐' : '☆');
            };
        });
        
        document.getElementById('movie-discuss')?.addEventListener('click', async () => {
            const title = document.getElementById('movie-title')?.value.trim();
            if (!title) { toastr.warning('영화 제목을 먼저 입력해주세요!'); return; }
            document.getElementById('movie-discuss').disabled = true;
            document.getElementById('movie-discuss-result').innerHTML = '<span class="loading">생각 중...</span>';
            charComment = await this.getDiscussion(title, getContext().name2 || '캐릭터');
            document.getElementById('movie-discuss-result').innerHTML = charComment ? `"${Utils.escapeHtml(charComment)}"` : '응답 실패';
            document.getElementById('movie-discuss').disabled = false;
        });
        
        document.getElementById('movie-save')?.addEventListener('click', () => {
            const title = document.getElementById('movie-title')?.value.trim();
            const genre = document.getElementById('movie-genre')?.value.trim();
            const review = document.getElementById('movie-review')?.value.trim();
            if (!title) { toastr.warning('영화 제목을 입력해주세요!'); return; }
            
            const settings = Core.getSettings();
            const charId = Core.getCharId();
            const data = this.getData(settings, charId);
            data.movies.push({ date: Utils.getTodayKey(), title, genre, rating, review, charComment, fromChar: false });
            Core.saveSettings();
            toastr.success('🎬 저장되었습니다!');
            document.getElementById('movie-content').innerHTML = this.renderList(data, getContext().name2 || '캐릭터');
            this.bindListEvents(settings, charId, getContext().name2 || '캐릭터');
        });
    },
};

// ========================================
// 일기장 앱 (캐릭터 일기 기능)
// ========================================
const DiaryApp = {
    id: 'diary',
    name: '일기장',
    icon: '📔',
    state: { selectedDate: null, calYear: null, calMonth: null, isGenerating: false },
    
    getData(settings, charId) {
        const key = `diary_${charId}`;
        if (!settings.appData) settings.appData = {};
        if (!settings.appData[key]) settings.appData[key] = { entries: {}, lastCharDiaryDate: null };
        return settings.appData[key];
    },
    
    // 캐릭터가 일기 쓰기 (20% 확률)
    async tryCharacterDiary(settings, charId, charName, userName) {
        const data = this.getData(settings, charId);
        const today = Utils.getTodayKey();
        
        if (data.lastCharDiaryDate === today) return null;
        if (data.entries[today]?.charDiary) return null; // 이미 있으면 스킵
        if (!Utils.chance(20)) {
            data.lastCharDiaryDate = today;
            return null;
        }
        
        const ctx = getContext();
        const moods = ['😊', '🥰', '😴', '🤔', '😎'];
        const mood = moods[Math.floor(Math.random() * moods.length)];
        
        const prompt = `[일기 쓰기] ${charName}가 오늘 하루를 일기로 써줘.
${userName}에 대한 이야기나 오늘 있었던 일, 생각 등.
2-3문장, 한국어, 자연스럽게, 액션(*) 없이:`;
        
        try {
            const result = await ctx.generateQuietPrompt(prompt, false, false);
            const content = result.replace(/\*[^*]*\*/g, '').trim().substring(0, 300);
            
            if (content && content.length > 10) {
                if (!data.entries[today]) data.entries[today] = {};
                data.entries[today].charDiary = {
                    content: content,
                    mood: mood,
                    date: today,
                    read: false,
                };
                data.lastCharDiaryDate = today;
                return content;
            }
        } catch (e) {
            console.error('[Diary] Character diary failed:', e);
        }
        return null;
    },
    
    render() {
        return `
        <div class="app-header">
            <button class="app-back-btn" data-back="home">◀</button>
            <span class="app-title">일기장</span>
            <button class="app-nav-btn" id="diary-today-btn">오늘</button>
        </div>
        <div class="app-content">
            <div class="calendar-nav"><button id="diary-cal-prev">◀</button><span id="diary-cal-title"></span><button id="diary-cal-next">▶</button></div>
            <div class="calendar" id="diary-calendar"></div>
            <div id="diary-entry-area"></div>
        </div>`;
    },
    
    renderEntry(entry, dateKey, charName, userName) {
        const hasMyEntry = entry?.content;
        const hasCharEntry = entry?.charDiary;
        
        let html = '';
        
        // 캐릭터 일기 (있으면)
        if (hasCharEntry) {
            const charEntry = entry.charDiary;
            html += `
            <div class="card pink-light">
                <div class="card-label">📔 ${charName}의 일기 ${charEntry.mood || ''} ${!charEntry.read ? '🆕' : ''}</div>
                <div class="diary-content">${Utils.escapeHtml(charEntry.content)}</div>
            </div>`;
        }
        
        // 내 일기
        if (hasMyEntry) {
            html += `
            <div class="card">
                <div class="card-label">📔 나의 일기 ${entry.mood || ''}</div>
                <div class="diary-content">${Utils.escapeHtml(entry.content)}</div>
                ${entry.charReply ? `<div class="char-comment"><span class="char-name">${charName}</span>의 답장<br>"${Utils.escapeHtml(entry.charReply)}"</div>` : ''}
            </div>`;
        } else {
            // 일기 쓰기 폼
            html += `
            <div class="card">
                <div class="card-label">${Utils.formatDate(dateKey)} 일기</div>
                <div class="mood-selector" id="diary-mood">${['😊','😢','😡','😴','🥰','😎'].map(m => `<span data-mood="${m}">${m}</span>`).join('')}</div>
                <textarea id="diary-content" placeholder="오늘 하루는 어땠나요?"></textarea>
                <button id="diary-save" class="btn-primary">저장하기</button>
            </div>`;
        }
        
        return html;
    },
    
    async generateReply(content, mood, charName) {
        const ctx = getContext();
        const prompt = `[일기 답장] ${ctx.name1}의 오늘 일기 (기분: ${mood}): "${content}"
${charName}(으)로서 따뜻한 답장 (1-2문장, 한국어, 위로/응원/공감):`;
        try {
            let result = await ctx.generateQuietPrompt(prompt, false, false);
            return result.replace(/\*[^*]*\*/g, '').trim().substring(0, 150);
        } catch { return null; }
    },
    
    async loadUI(settings, charId, charName) {
        const now = new Date();
        this.state.calYear = now.getFullYear();
        this.state.calMonth = now.getMonth();
        this.state.selectedDate = Utils.getTodayKey();
        
        const data = this.getData(settings, charId);
        const userName = getContext().name1 || '나';
        
        // 캐릭터 일기 시도
        if (!this.state.isGenerating) {
            this.state.isGenerating = true;
            
            const charDiary = await this.tryCharacterDiary(settings, charId, charName, userName);
            if (charDiary) {
                saveSettingsDebounced();
                toastr.info(`📔 ${charName}가 일기를 썼어요!`);
            }
            this.state.isGenerating = false;
        }
        
        this.renderCalendar(settings, charId, charName);
        this.showEntry(settings, charId, charName);
        this.bindCalendarNav(settings, charId, charName);
    },
    
    renderCalendar(settings, charId, charName) {
        const { calYear: year, calMonth: month } = this.state;
        document.getElementById('diary-cal-title').textContent = `${year}년 ${month + 1}월`;
        const data = this.getData(settings, charId);
        const startDay = new Date(year, month, 1).getDay();
        const totalDays = new Date(year, month + 1, 0).getDate();
        const today = Utils.getTodayKey();
        
        let html = '<div class="cal-week"><span>일</span><span>월</span><span>화</span><span>수</span><span>목</span><span>금</span><span>토</span></div><div class="cal-days">';
        for (let i = 0; i < startDay; i++) html += '<span class="cal-day empty"></span>';
        for (let d = 1; d <= totalDays; d++) {
            const key = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
            const entry = data.entries[key];
            const hasData = entry?.content || entry?.charDiary;
            const hasUnread = entry?.charDiary && !entry.charDiary.read;
            const mood = entry?.mood || entry?.charDiary?.mood || '';
            const cls = ['cal-day', hasData ? 'has-data' : '', key === today ? 'today' : '', key === this.state.selectedDate ? 'selected' : '', hasUnread ? 'unread' : ''].filter(Boolean).join(' ');
            html += `<span class="${cls}" data-date="${key}">${d}${mood ? `<small>${mood}</small>` : ''}</span>`;
        }
        document.getElementById('diary-calendar').innerHTML = html + '</div>';
        this.bindCalendarDays(settings, charId, charName);
    },
    
    showEntry(settings, charId, charName) {
        const data = this.getData(settings, charId);
        const entry = data.entries[this.state.selectedDate];
        const userName = getContext().name1 || '나';
        
        // 캐릭터 일기 읽음 처리
        if (entry?.charDiary && !entry.charDiary.read) {
            entry.charDiary.read = true;
            saveSettingsDebounced();
        }
        
        document.getElementById('diary-entry-area').innerHTML = this.renderEntry(entry, this.state.selectedDate, charName, userName);
        
        if (!entry?.content) this.bindEntryEvents(settings, charId, charName);
    },
    
    bindEvents(Core) {
        document.getElementById('diary-today-btn')?.addEventListener('click', () => {
            const now = new Date();
            this.state.calYear = now.getFullYear();
            this.state.calMonth = now.getMonth();
            this.state.selectedDate = Utils.getTodayKey();
            const settings = Core.getSettings();
            const charId = Core.getCharId();
            const charName = getContext().name2 || '캐릭터';
            this.renderCalendar(settings, charId, charName);
            this.showEntry(settings, charId, charName);
        });
    },
    
    bindCalendarNav(settings, charId, charName) {
        document.getElementById('diary-cal-prev')?.addEventListener('click', () => {
            if (--this.state.calMonth < 0) { this.state.calMonth = 11; this.state.calYear--; }
            this.renderCalendar(settings, charId, charName);
        });
        document.getElementById('diary-cal-next')?.addEventListener('click', () => {
            if (++this.state.calMonth > 11) { this.state.calMonth = 0; this.state.calYear++; }
            this.renderCalendar(settings, charId, charName);
        });
    },
    
    bindCalendarDays(settings, charId, charName) {
        document.querySelectorAll('#diary-calendar .cal-day:not(.empty)').forEach(el => {
            el.onclick = () => {
                this.state.selectedDate = el.dataset.date;
                this.renderCalendar(settings, charId, charName);
                this.showEntry(settings, charId, charName);
            };
        });
    },
    
    bindEntryEvents(settings, charId, charName) {
        let selectedMood = '';
        document.querySelectorAll('#diary-mood span').forEach(el => {
            el.onclick = () => {
                selectedMood = el.dataset.mood;
                document.querySelectorAll('#diary-mood span').forEach(s => s.classList.remove('selected'));
                el.classList.add('selected');
            };
        });
        
        document.getElementById('diary-save')?.addEventListener('click', async () => {
            const content = document.getElementById('diary-content')?.value.trim();
            if (!content) { toastr.warning('일기 내용을 입력해주세요!'); return; }
            
            const btn = document.getElementById('diary-save');
            btn.disabled = true;
            btn.textContent = `${charName} 님이 읽는 중...`;
            
            const charReply = await this.generateReply(content, selectedMood, charName);
            
            const data = this.getData(settings, charId);
            if (!data.entries[this.state.selectedDate]) data.entries[this.state.selectedDate] = {};
            data.entries[this.state.selectedDate].content = content;
            data.entries[this.state.selectedDate].mood = selectedMood;
            data.entries[this.state.selectedDate].charReply = charReply;
            data.entries[this.state.selectedDate].date = this.state.selectedDate;
            saveSettingsDebounced();
            
            toastr.success('📔 저장되었습니다!');
            this.renderCalendar(settings, charId, charName);
            this.showEntry(settings, charId, charName);
        });
    },
};

// ========================================
// Phone Core
// ========================================
const PhoneCore = {
    apps: { sumone: SumOneApp, letter: LetterApp, book: BookApp, movie: MovieApp, diary: DiaryApp },
    pageHistory: [],
    currentPage: 'home',
    
    getContext,
    getSettings() {
        if (!extension_settings[extensionName]) {
            extension_settings[extensionName] = { enabledApps: {}, wallpapers: {}, appData: {} };
        }
        return extension_settings[extensionName];
    },
    saveSettings: () => saveSettingsDebounced(),
    getCharId() { const ctx = getContext(); return ctx.characterId ?? ctx.groupId ?? 'default'; },
    
    getWallpaper() { return this.getSettings().wallpapers?.[this.getCharId()] || ''; },
    setWallpaper(url) {
        const s = this.getSettings();
        if (!s.wallpapers) s.wallpapers = {};
        s.wallpapers[this.getCharId()] = url;
        this.saveSettings();
        this.applyWallpaper();
    },
    applyWallpaper() {
        const home = document.querySelector('.phone-page[data-page="home"]');
        if (home) {
            const wp = this.getWallpaper();
            home.style.backgroundImage = wp ? `url(${wp})` : '';
        }
    },
    
    createHTML() {
        const time = new Date();
        return `
        <div id="phone-modal" class="phone-modal" style="display:none;">
            <div class="phone-device">
                <div class="phone-inner">
                    <div class="phone-status-bar">
                        <span class="phone-time">${time.getHours()}:${String(time.getMinutes()).padStart(2, '0')}</span>
                        <div class="phone-notch"></div>
                        <div class="phone-status-icons">●●●●○ 🔋</div>
                    </div>
                    <div class="phone-screen">
                        <div class="phone-page active" data-page="home"><div class="phone-app-grid" id="phone-app-grid"></div></div>
                        <div class="phone-page" data-page="app" id="phone-app-page"></div>
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
        grid.innerHTML = Object.entries(this.apps).filter(([id]) => settings.enabledApps?.[id] !== false)
            .map(([id, app]) => `<div class="phone-app-icon" data-app="${id}"><div class="app-icon-img">${app.icon}</div><div class="app-icon-name">${app.name}</div></div>`).join('');
        grid.querySelectorAll('.phone-app-icon').forEach(el => el.onclick = () => this.openApp(el.dataset.app));
        this.applyWallpaper();
    },
    
    switchPage(pageName) {
        this.currentPage = pageName;
        document.querySelectorAll('.phone-page').forEach(p => p.classList.toggle('active', p.dataset.page === pageName || (pageName !== 'home' && p.dataset.page === 'app')));
    },
    
    openPage(pageId, html) {
        this.pageHistory.push(this.currentPage);
        const appPage = document.getElementById('phone-app-page');
        appPage.innerHTML = html;
        appPage.dataset.currentPage = pageId;
        this.switchPage(pageId);
        this.bindBackButtons();
    },
    
    goBack() {
        if (this.pageHistory.length > 0) {
            const prev = this.pageHistory.pop();
            if (prev === 'home') {
                this.switchPage('home');
            } else {
                const app = this.apps[prev];
                if (app) this.openApp(prev);
                else this.switchPage('home');
            }
        } else {
            this.switchPage('home');
        }
    },
    
    bindBackButtons() {
        document.querySelectorAll('.app-back-btn').forEach(btn => {
            btn.onclick = () => {
                const target = btn.dataset.back;
                if (target === 'home') {
                    this.pageHistory = [];
                    this.switchPage('home');
                } else if (this.apps[target]) {
                    this.pageHistory = [];
                    this.openApp(target);
                } else {
                    this.goBack();
                }
            };
        });
    },
    
    async openApp(appId) {
        const ctx = getContext();
        if (ctx.characterId === undefined && !ctx.groupId) { toastr.warning('먼저 캐릭터를 선택해주세요.'); return; }
        
        const app = this.apps[appId];
        if (!app) return;
        
        this.pageHistory = [];
        const charName = ctx.name2 || '캐릭터';
        const appPage = document.getElementById('phone-app-page');
        appPage.innerHTML = app.render(charName);
        appPage.dataset.currentPage = appId;
        this.switchPage(appId);
        
        await app.loadUI(this.getSettings(), this.getCharId(), charName);
        app.bindEvents(this);
        this.bindBackButtons();
    },
    
    openModal() {
        document.getElementById('phone-modal').style.display = 'flex';
        this.switchPage('home');
        this.pageHistory = [];
        this.renderAppGrid();
    },
    closeModal() { document.getElementById('phone-modal').style.display = 'none'; },
    
    setupEvents() {
        document.getElementById('phone-modal')?.addEventListener('click', e => { if (e.target.id === 'phone-modal') this.closeModal(); });
        setInterval(() => { const t = new Date(); document.querySelector('.phone-time').textContent = `${t.getHours()}:${String(t.getMinutes()).padStart(2, '0')}`; }, 60000);
    },
    
    createSettingsUI() {
        const settings = this.getSettings();
        const html = `
        <div class="sumone-phone-settings">
            <div class="inline-drawer">
                <div class="inline-drawer-toggle inline-drawer-header"><b>📱 썸원 폰</b><div class="inline-drawer-icon fa-solid fa-circle-chevron-down down"></div></div>
                <div class="inline-drawer-content">
                    <p style="margin:10px 0;opacity:0.7;">v1.8.0 - 캐릭터 자동 생성</p>
                    <div style="margin:15px 0;"><b>앱 표시</b>
                        ${Object.entries(this.apps).map(([id, app]) => `<label style="display:flex;align-items:center;gap:8px;margin:8px 0;"><input type="checkbox" class="phone-app-toggle" data-app="${id}" ${settings.enabledApps?.[id] !== false ? 'checked' : ''}><span>${app.icon} ${app.name}</span></label>`).join('')}
                    </div>
                    <div style="margin:15px 0;"><b>배경화면</b> <small>(캐릭터별)</small>
                        <input type="file" id="phone-wp-input" accept="image/*" style="display:none;">
                        <button id="phone-wp-btn" class="menu_button" style="width:100%;margin-top:5px;">🖼️ 이미지 선택</button>
                        <button id="phone-wp-reset" class="menu_button" style="width:100%;margin-top:5px;">↩️ 기본으로</button>
                    </div>
                </div>
            </div>
        </div>`;
        $('#extensions_settings').append(html);
        
        $('.phone-app-toggle').on('change', function() { const s = PhoneCore.getSettings(); if (!s.enabledApps) s.enabledApps = {}; s.enabledApps[$(this).data('app')] = this.checked; PhoneCore.saveSettings(); });
        $('#phone-wp-btn').on('click', () => $('#phone-wp-input').click());
        $('#phone-wp-input').on('change', function() { if (this.files[0]) { const r = new FileReader(); r.onload = e => { PhoneCore.setWallpaper(e.target.result); toastr.success('배경 변경!'); }; r.readAsDataURL(this.files[0]); } });
        $('#phone-wp-reset').on('click', () => { PhoneCore.setWallpaper(''); toastr.info('기본으로'); });
    },
    
    addMenuButton() {
        $('#sumone-phone-btn-container').remove();
        $('#extensionsMenu').prepend(`<div id="sumone-phone-btn-container" class="extension_container interactable"><div id="sumone-phone-btn" class="list-group-item flex-container flexGap5 interactable"><div class="fa-solid fa-mobile-screen extensionsMenuExtensionButton" style="color:#ff6b9d;"></div><span>썸원 폰</span></div></div>`);
        $('#sumone-phone-btn').on('click', () => this.openModal());
    },
    
    init() {
        console.log('[SumOne Phone] v1.8.0 로딩...');
        this.getSettings();
        this.createSettingsUI();
        $('body').append(this.createHTML());
        this.setupEvents();
        setTimeout(() => this.addMenuButton(), 1000);
        eventSource.on(event_types.CHAT_CHANGED, () => this.applyWallpaper());
        console.log('[SumOne Phone] 로딩 완료!');
    },
};

jQuery(() => PhoneCore.init());
