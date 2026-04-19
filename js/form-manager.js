// js/form-manager.js 

class FormManager {
    constructor(gazeRecorder, scenario) {
        this.gazeRecorder = gazeRecorder;
        this.scenario = scenario;
        
        if (scenario === 'with') {
            this.forms = [
                { 
                    name: 'small_with', 
                    file: 'form-small-with.html', 
                    fields: ['lastNameWith', 'firstNameWith', 'patronymicWith', 'cityWith'], 
                    autocomplete: true,
                    hasProgressBar: true
                },
                { 
                    name: 'large_with', 
                    file: 'form-large-with.html', 
                    fields: ['lastNameWith', 'firstNameWith', 'patronymicWith', 'genreWith', 'citizenshipWith', 'genderWith', 'ageWith', 'birthPlaceWith', 'cityWith', 'positionWith', 'hairColorWith', 'raceWith', 'eyeColorWith', 'bodyTypeWith', 'featureWith', 'nicknameWith'], 
                    autocomplete: true,
                    hasProgressBar: true
                }
            ];
        } else {
            this.forms = [
                { 
                    name: 'small_without', 
                    file: 'form-small-without.html', 
                    fields: ['lastName', 'firstName', 'patronymic', 'city'], 
                    autocomplete: false,
                    hasProgressBar: true
                },
                { 
                    name: 'large_without', 
                    file: 'form-large-without.html', 
                    fields: ['lastName', 'firstName', 'patronymic', 'genre', 'citizenship', 'gender', 'age', 'birthPlace', 'city', 'position', 'hairColor', 'race', 'eyeColor', 'bodyType', 'feature', 'nickname'], 
                    autocomplete: false,
                    hasProgressBar: true
                }
            ];
        }
        
        this.currentFormIndex = 0;
        this.participantId = null;
        this.webgazerReady = false;
    }
    
    setParticipantId(id) {
        this.participantId = id;
    }
    
    async loadForm(formFile) {
        const response = await fetch(`templates/${formFile}`);
        return response.text();
    }
    
    async renderForm(index) {
        if (index >= this.forms.length) {
            this.completeExperiment();
            return;
        }
        
        const form = this.forms[index];
        this.currentFormIndex = index;
        this.currentForm = form;
        const html = await this.loadForm(form.file);
        
        const container = document.getElementById('experimentContainer');
        if (container) container.innerHTML = html;
        
        await this.waitForWebGazer();
        
        this.startRecordingForForm(form, index);
        this.attachFormEvents(form, index);
        this.applyAutocompleteSettings(form);
        this.setupValidation();
        
        if (form.hasProgressBar) {
            this.updateProgressBar(form);
        }
    }
    
    async waitForWebGazer() {
        if (this.webgazerReady) return true;
        
        for (let i = 0; i < 50; i++) {
            if (window.webgazer && window.webgazer.isReady) {
                this.webgazerReady = true;
                console.log('WebGazer готов к записи');
                return true;
            }
            await new Promise(resolve => setTimeout(resolve, 200));
        }
        
        console.warn('WebGazer не готов, но продолжаем');
        return false;
    }
    
    startRecordingForForm(form, formIndex) {
        console.log('form-manager.startRecordingForForm', form.name, formIndex);
        
        this.gazeRecorder.startRecordingForForm(formIndex, form.name, {
            formName: form.name,
            formIndex: formIndex,
            autocomplete: form.autocomplete ? 'enabled' : 'disabled'
        });
    }
    
    attachFormEvents(form, formIndex) {
        const submitBtn = document.getElementById('submitFormBtn');
        if (!submitBtn) return;
        
        const inputs = document.querySelectorAll('.field-input');
        
        const checkFormValid = () => {
            let allFilled = true;
            inputs.forEach(input => {
                if (input.tagName === 'SELECT') {
                    if (!input.value || input.value === '') allFilled = false;
                } else {
                    if (!input.value.trim()) allFilled = false;
                }
            });
            submitBtn.disabled = !allFilled;
            return allFilled;
        };
        
        inputs.forEach(input => {
            input.addEventListener('input', checkFormValid);
            input.addEventListener('change', checkFormValid);
        });
        
        submitBtn.addEventListener('click', () => {
            if (this.hasValidationErrors && this.hasValidationErrors()) {
                this.showValidationModal();
                return;
            }
            
            this.saveGazeDataForCurrentForm(form, formIndex);
            this.nextForm();
        });
        
        checkFormValid();
    }
    
    saveGazeDataForCurrentForm(form, formIndex) {
        const gazeData = this.gazeRecorder.stopRecordingForForm();
        
        // ❌ ЗДЕСЬ НЕ БЫЛО КОДА ДЛЯ СОХРАНЕНИЯ ЖАНРА
        
        if (gazeData.length > 0) {
            console.log(`   Первая точка: time=${gazeData[0].time_from_form_ms} мс`);
            console.log(`   Последняя точка: time=${gazeData[gazeData.length-1].time_from_form_ms} мс`);
        }
        
        if (gazeData.length === 0) {
            console.warn(`Нет данных взгляда для формы ${formIndex + 1}`);
            return;
        }
        
        this.exportGazeDataToCSV(gazeData, formIndex, form.name);
    }
    
    exportGazeDataToCSV(gazeData, formIndex, formName) {
        const headers = [
            'participantId',
            'formIndex',
            'formName',
            'autocomplete',
            'time_from_form_ms',
            'time_from_form',
            'x',
            'y',
            'timestamp'
        ];
        
        const rows = gazeData.map(point => [
            this.participantId || 'unknown',
            point.formIndex,
            point.formName,
            point.autocomplete,
            point.time_from_form_ms,
            point.time_from_form,
            point.x,
            point.y,
            point.timestamp
        ].join(','));
        
        const csv = [headers.join(','), ...rows].join('\n');
        
        const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `gaze_form${formIndex + 1}_${this.participantId || 'unknown'}_${Date.now()}.csv`;
        a.click();
        URL.revokeObjectURL(url);
        
        console.log(`Скачан файл: gaze_form${formIndex + 1}_${Date.now()}.csv (${gazeData.length} точек)`);
    }
    
    // ========== ВАЛИДАЦИЯ ==========
    
    validateTextField(value) {
        const regex = /^[a-zA-Zа-яА-ЯёЁ\s\-\.]*$/;
        return regex.test(value);
    }
    
    validateAndHighlightField(input) {
        const fieldId = input.id;
        
        const textFields = [
            'lastName', 'lastNameWith',
            'firstName', 'firstNameWith', 
            'patronymic', 'patronymicWith',
            'city', 'cityWith',
            'birthPlace', 'birthPlaceWith',
            'citizenship', 'citizenshipWith',
            'position', 'positionWith',
            'hairColor', 'hairColorWith',
            'eyeColor', 'eyeColorWith',
            'bodyType', 'bodyTypeWith',
            'feature', 'featureWith',
            'race', 'raceWith'
        ];
        
        if (!textFields.includes(fieldId)) {
            return true;
        }
        
        const value = input.value;
        const isValid = this.validateTextField(value);
        
        const existingError = input.parentElement.querySelector('.error-message');
        if (existingError) existingError.remove();
        
        if (!isValid && value !== '') {
            input.classList.add('error');
            
            const errorMsg = document.createElement('span');
            errorMsg.className = 'error-message';
            errorMsg.textContent = '❌ Нельзя использовать цифры и спец.символы';
            input.parentElement.appendChild(errorMsg);
            
            return false;
        } else {
            input.classList.remove('error');
            return true;
        }
    }
    
    setupValidation() {
        const textFields = [
            'lastName', 'lastNameWith',
            'firstName', 'firstNameWith', 
            'patronymic', 'patronymicWith',
            'city', 'cityWith',
            'birthPlace', 'birthPlaceWith',
            'citizenship', 'citizenshipWith',
            'position', 'positionWith',
            'hairColor', 'hairColorWith',
            'eyeColor', 'eyeColorWith',
            'bodyType', 'bodyTypeWith',
            'feature', 'featureWith',
            'race', 'raceWith'
        ];
        
        textFields.forEach(fieldId => {
            const input = document.getElementById(fieldId);
            if (input) {
                input.addEventListener('input', () => {
                    this.validateAndHighlightField(input);
                });
                
                input.addEventListener('blur', () => {
                    this.validateAndHighlightField(input);
                });
            }
        });
    }
    
    hasValidationErrors() {
        const errorMessages = document.querySelectorAll('.error-message');
        const errorInputs = document.querySelectorAll('.field-input.error');
        return errorMessages.length > 0 || errorInputs.length > 0;
    }
    
    showValidationModal() {
        const existingModal = document.querySelector('.modal-overlay');
        if (existingModal) existingModal.remove();
        
        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.innerHTML = `
            <div class="modal-container">
                <div class="modal-icon">⚠️</div>
                <div class="modal-title">Ошибка валидации</div>
                <div class="modal-message">
                    Нельзя продолжить пока не будут введены корректные данные<br>
                    <small style="color: #ffaaaa;">(только буквы, пробелы, дефисы и точка)</small>
                </div>
                <button class="modal-button" id="modalCloseBtn">Понятно</button>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        const closeBtn = document.getElementById('modalCloseBtn');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                modal.remove();
            });
        }
        
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.remove();
            }
        });
    }
    
    // ========== ПРОГРЕСС-БАР ==========
    
    updateProgressBar(form) {
        const allInputs = document.querySelectorAll('.field-input');
        const totalFields = allInputs.length;
        
        const totalSpan = document.getElementById('totalFields');
        const filledSpan = document.getElementById('filledFields');
        const progressFill = document.getElementById('progressFill');
        
        if (totalSpan) totalSpan.textContent = totalFields;
        
        const countFilledFields = () => {
            let filled = 0;
            allInputs.forEach(input => {
                if (input.tagName === 'SELECT') {
                    if (input.value && input.value !== '') filled++;
                } else {
                    if (input.value && input.value.trim() !== '') filled++;
                }
            });
            return filled;
        };
        
        const updateProgressUI = () => {
            const filled = countFilledFields();
            if (filledSpan) filledSpan.textContent = filled;
            if (progressFill) {
                const percent = (filled / totalFields) * 100;
                progressFill.style.width = `${percent}%`;
            }
        };
        
        allInputs.forEach(input => {
            input.addEventListener('input', updateProgressUI);
            input.addEventListener('change', updateProgressUI);
        });
        
        updateProgressUI();
    }
    
    applyAutocompleteSettings(form) {
        const allInputs = document.querySelectorAll('.field-input');
        
        if (!form.autocomplete) {
            allInputs.forEach(input => {
                input.setAttribute('autocomplete', 'off');
                input.setAttribute('autocorrect', 'off');
                input.setAttribute('autocapitalize', 'off');
                input.setAttribute('spellcheck', 'false');
            });
        }
    }
    
    nextForm() {
        this.currentFormIndex++;
        
        if (this.currentFormIndex < this.forms.length) {
            this.renderForm(this.currentFormIndex);
        } else {
            this.completeExperiment();
        }
    }
    
    // В form-manager.js, в методе completeExperiment
completeExperiment() {
    console.log('✅ Все формы заполнены! Эксперимент завершён.');
    
    // Останавливаем запись взгляда
    this.gazeRecorder.stopRecordingForForm();
    
    // Переключаем сценарий для следующего участника
    if (window.switchScenario) {
        window.switchScenario();
    }
    
    // ✅ Переключаем тип ошибки для следующей сессии
    if (window.switchSessionErrorType) {
        window.switchSessionErrorType();
    }
    
    // Очищаем контейнер
    const container = document.getElementById('my-forms-container');
    if (container) {
        container.style.display = 'none';
        container.innerHTML = '';
    }
    
    // Возвращаемся в кинотеатр
    if (typeof showCinema === 'function') {
        showCinema();
    }
}
    
    async start(participantId) {
        this.participantId = participantId;
        await this.renderForm(0);
    }
}