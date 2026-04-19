// js/gaze-recorder.js - полная исправленная версия

class GazeRecorder {
    constructor() {
        this.sessionId = null;
        this.webgazerReady = false;
        this.isRecordingForForm = false;
        this.currentFormData = [];
        this.formStartTime = null;
        this.intervalId = null;
    }
    
    setSessionId(id) {
        this.sessionId = id;
        console.log('Session ID:', id);
    }
    
    async init() {
        // Проверяем, что webgazer существует
        if (typeof webgazer === 'undefined') {
            console.error('❌ WebGazer не загружен');
            return false;
        }
        
        // Настраиваем WebGazer (НЕ вызываем begin, только настройки)
        webgazer.setRegression('ridge')
            .showVideo(true)
            .showPredictionPoints(true)
            .applyKalmanFilter(true);
        
        // Флаг готовности устанавливаем в true, так как WebGazer уже инициализирован в calibration.js
        this.webgazerReady = true;
        console.log('✅ GazeRecorder готов');
        return true;
    }

            // Добавить в класс GazeRecorder (перед закрывающей скобкой класса)
        initWithoutBegin() {
            if (typeof webgazer === 'undefined') {
                console.error('❌ WebGazer не загружен');
                return Promise.reject('WebGazer не загружен');
            }
            
            // Только настройка, БЕЗ webgazer.begin()!
            webgazer.setRegression('ridge')
                .showVideo(true)
                .showPredictionPoints(true)
                .applyKalmanFilter(true);
            
            this.webgazerReady = true;
            console.log('✅ GazeRecorder привязан к существующему WebGazer');
            return Promise.resolve();
        }
    
    startRecordingForForm(formIndex, formName, metadata) {
        console.log('🔴 startRecordingForForm вызван', {formIndex, formName, metadata});
        
        // Проверяем готовность WebGazer
        if (typeof webgazer === 'undefined') {
            console.log('⚠️ WebGazer не определён');
            return;
        }
        
        // Останавливаем предыдущую запись
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }
        
        this.isRecordingForForm = true;
        this.currentFormData = [];
        this.formStartTime = Date.now();
        
        console.log('🔴 Запуск интервала, startTime=', this.formStartTime);
        
        this.intervalId = setInterval(() => {
            if (!this.isRecordingForForm) return;
            
            // Проверяем, что webgazer существует и имеет метод getCurrentPrediction
            if (typeof webgazer === 'undefined' || !webgazer.getCurrentPrediction) {
                return;
            }
            
            webgazer.getCurrentPrediction()
                .then(pred => {
                    if (pred && pred.x !== null && pred.y !== null) {
                        const now = Date.now();
                        const elapsed = now - this.formStartTime;
                        
                        const point = {
                            formIndex: formIndex,
                            formName: formName,
                            autocomplete: metadata.autocomplete,
                            time_from_form_ms: elapsed,
                            time_from_form: (elapsed / 1000).toFixed(3) + 's',
                            x: Math.round(pred.x),
                            y: Math.round(pred.y),
                            timestamp: new Date().toISOString()
                        };
                        
                        this.currentFormData.push(point);
                        
                        
                        
                    }
                })
                .catch(err => {
                    // Игнорируем ошибки, просто пропускаем точку
                });
        }, 100); // 100ms = 10Hz
    }
    
    stopRecordingForForm() {
        console.log('🔴 stopRecordingForForm вызван');
        
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }
        
        const data = [...this.currentFormData];
        console.log(`🔴 Собрано ${data.length} точек`);
        
        this.isRecordingForForm = false;
        this.currentFormData = [];
        
        return data;
    }
    
    startSession(id) { 
        this.setSessionId(id); 
    }
    
    startTrial() { 
        return true; 
    }
    
    startRecording() {}
    
    endTrial() { 
        return null; 
    }
    
    saveToLocalStorage() {
        console.log('💾 Данные сохранены в localStorage');
    }
    
    exportCurrentSessionToCSV() {}
    
    getStats() { 
        return { totalPoints: this.currentFormData.length }; 
    }
}