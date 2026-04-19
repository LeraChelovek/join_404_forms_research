// js/survey.js

class SurveyManager {
    constructor() {
        this.answers = {};
        this.questions = [
            {
                id: 'q1',
                text: 'Позволил ли вам прогресс бар чувствовать контроль над заполнением формы?',
                hint: '(если прогресс бара не было, напишите: "не было прогресс бара")',
                type: 'text'
            },
            {
                id: 'q2',
                text: 'Позволило ли это вам лучше ориентироваться в форме?',
                hint: '(если прогресс бара не было, напишите: "не было прогресс бара")',
                type: 'text'
            },
            {
                id: 'q3',
                text: 'Повлияли ли как-то на вас уведомления об ошибках (если они были) при заполнении анкеты?',
                hint: '',
                type: 'text'
            },
            {
                id: 'q4',
                text: 'Раздражало ли это вас и в какой степени?',
                hint: 'Оцените от 1 до 10 (1 — совсем нет, 10 — очень сильно)',
                type: 'rating',
                min: 1,
                max: 10
            },
            {
                id: 'q5',
                text: 'Оцените страницу с ошибкой 404',
                hint: 'Оцените от 1 до 10 (1 — ужасно, 10 — отлично)',
                type: 'rating',
                min: 1,
                max: 10
            },
            {
                id: 'q6',
                text: 'Опишите, что было изображено на странице с ошибкой 404 (текст, окружение и т.д.)',
                hint: '',
                type: 'text'
            },
            {
                id: 'q7',
                text: 'Попытались ли вы снова купить билеты на этом сайте?',
                hint: '',
                type: 'radio',
                options: ['Да', 'Нет', 'Не помню']
            },
            {
                id: 'q8',
                text: 'Что вы думаете о креативных окнах ошибок?',
                hint: '',
                type: 'text'
            }
        ];
    }
    
    show() {
        // Создаём overlay
        const overlay = document.createElement('div');
        overlay.className = 'survey-overlay';
        overlay.id = 'surveyOverlay';
        
        // Создаём контейнер
        const container = document.createElement('div');
        container.className = 'survey-container';
        
        // Заголовок
        container.innerHTML = `
            <h2 class="survey-title">📋 Опрос</h2>
            <div class="survey-subtitle">Пожалуйста, ответьте на несколько вопросов о вашем опыте</div>
            <div id="surveyQuestions"></div>
            <div class="survey-buttons">
                <button id="surveyCancelBtn" class="survey-btn survey-btn-secondary">Отмена</button>
                <button id="surveySubmitBtn" class="survey-btn survey-btn-primary">Завершить эксперимент</button>
            </div>
        `;
        
        overlay.appendChild(container);
        document.body.appendChild(overlay);
        
        this.renderQuestions();
        this.attachEvents();
    }
    
    renderQuestions() {
        const container = document.getElementById('surveyQuestions');
        if (!container) return;
        
        container.innerHTML = '';
        
        this.questions.forEach((q, idx) => {
            const questionDiv = document.createElement('div');
            questionDiv.className = 'survey-question';
            questionDiv.id = `question_${q.id}`;
            
            let inputHtml = '';
            
            if (q.type === 'text') {
                inputHtml = `<textarea id="answer_${q.id}" class="survey-input" rows="3" placeholder="Введите ваш ответ..."></textarea>`;
            } else if (q.type === 'rating') {
                let ratingHtml = '<div class="rating-container">';
                for (let i = q.min; i <= q.max; i++) {
                    ratingHtml += `<button type="button" data-value="${i}" class="rating-btn">${i}</button>`;
                }
                ratingHtml += '</div>';
                ratingHtml += `<input type="hidden" id="answer_${q.id}" value="">`;
                inputHtml = ratingHtml;
            } else if (q.type === 'radio') {
                let radioHtml = '<div class="radio-group">';
                q.options.forEach(opt => {
                    radioHtml += `
                        <label style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px; cursor: pointer;">
                            <input type="radio" name="radio_${q.id}" value="${opt}" style="width: 18px; height: 18px;">
                            <span>${opt}</span>
                        </label>
                    `;
                });
                radioHtml += '</div>';
                radioHtml += `<input type="hidden" id="answer_${q.id}" value="">`;
                inputHtml = radioHtml;
            }
            
            questionDiv.innerHTML = `
                <div class="question-text">${idx + 1}. ${q.text}</div>
                ${q.hint ? `<div class="question-hint">${q.hint}</div>` : ''}
                ${inputHtml}
            `;
            
            container.appendChild(questionDiv);
        });
        
        // Навешиваем обработчики для rating кнопок
        document.querySelectorAll('.rating-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const value = btn.dataset.value;
                const questionDiv = btn.closest('.survey-question');
                const hiddenInput = questionDiv.querySelector('input[type="hidden"]');
                if (hiddenInput) hiddenInput.value = value;
                
                // Визуальное выделение
                questionDiv.querySelectorAll('.rating-btn').forEach(b => b.classList.remove('selected'));
                btn.classList.add('selected');
            });
        });
        
        // Обработчики для radio
        document.querySelectorAll('input[type="radio"]').forEach(radio => {
            radio.addEventListener('change', (e) => {
                const questionDiv = radio.closest('.survey-question');
                const hiddenInput = questionDiv.querySelector('input[type="hidden"]');
                if (hiddenInput) hiddenInput.value = radio.value;
            });
        });
    }
    
    attachEvents() {
        const cancelBtn = document.getElementById('surveyCancelBtn');
        const submitBtn = document.getElementById('surveySubmitBtn');
        
        if (cancelBtn) {
            cancelBtn.addEventListener('click', () => this.close());
        }
        
        if (submitBtn) {
            submitBtn.addEventListener('click', () => this.submit());
        }
    }
    
    collectAnswers() {
        const answers = {};
        
        this.questions.forEach(q => {
            const input = document.getElementById(`answer_${q.id}`);
            if (input) {
                answers[q.id] = input.value || '';
            }
        });
        
        return answers;
    }
    
    validateAnswers(answers) {
        let isValid = true;
        
        this.questions.forEach(q => {
            const answer = answers[q.id];
            if (!answer || answer.trim() === '') {
                isValid = false;
                const questionDiv = document.getElementById(`question_${q.id}`);
                if (questionDiv) {
                    questionDiv.style.border = '1px solid #ff4444';
                    questionDiv.style.borderRadius = '8px';
                    questionDiv.style.padding = '10px';
                }
            }
        });
        
        return isValid;
    }
    
    downloadCSV(answers) {
        // Добавляем ID участника
        const participantData = JSON.parse(localStorage.getItem('participantData') || '{}');
        const participantId = participantData.participantId || 'unknown';
        
        // Заголовки
        const headers = ['participant_id', 'timestamp', 'q1_progress_bar_control', 'q2_progress_bar_orientation', 'q3_errors_influence', 'q4_errors_annoyance', 'q5_404_rating', 'q6_404_description', 'q7_buy_again', 'q8_creative_errors'];
        
        // Данные
        const row = [
            participantId,
            new Date().toISOString(),
            answers.q1 || '',
            answers.q2 || '',
            answers.q3 || '',
            answers.q4 || '',
            answers.q5 || '',
            answers.q6 || '',
            answers.q7 || '',
            answers.q8 || ''
        ];
        
        const csv = [headers.join(','), row.join(',')].join('\n');
        const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `survey_${participantId}_${Date.now()}.csv`;
        a.click();
        URL.revokeObjectURL(url);
        
        console.log('📥 Опрос сохранён в CSV');
    }
    
    submit() {
        const answers = this.collectAnswers();
        
        if (!this.validateAnswers(answers)) {
            alert('Пожалуйста, ответьте на все вопросы!');
            return;
        }
        
        this.downloadCSV(answers);
        this.close();
        
        // Завершаем эксперимент
        alert('🎉 Спасибо за участие! Эксперимент завершён.');
        
        // Сбрасываем всё и перезагружаем
        localStorage.removeItem('participantData');
        localStorage.removeItem('currentSessionErrorType');
        localStorage.removeItem('my_next_scenario');
        
        setTimeout(() => {
            location.reload();
        }, 2000);
    }
    
    close() {
        const overlay = document.getElementById('surveyOverlay');
        if (overlay) overlay.remove();
    }
}

// Глобальная функция для запуска опроса
window.startSurvey = function() {
    const survey = new SurveyManager();
    survey.show();
};