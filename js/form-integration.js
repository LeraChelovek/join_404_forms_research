// js/form-integration.js - адаптер

// Объявляем переменные в самом начале
let myFormManager = null;
let myGazeRecorder = null;

// Функция для смены типа ошибки (объявляем до использования)
function switchSessionErrorType() {
    const newType = currentSessionErrorType === 'formal' ? 'creative' : 'formal';
    currentSessionErrorType = newType;
    localStorage.setItem('currentSessionErrorType', currentSessionErrorType);
    console.log(`🔄 Тип ошибки сессии переключён на: ${currentSessionErrorType}`);
    return currentSessionErrorType;
}

// Делаем функцию глобальной
window.switchSessionErrorType = switchSessionErrorType;

function loadMyScripts() {
    return new Promise((resolve, reject) => {
        const scripts = [
            'js/gaze-recorder.js',
            'js/form-manager.js'
        ];
        
        let loaded = 0;
        
        function loadNext(index) {
            if (index >= scripts.length) {
                resolve();
                return;
            }
            
            if (typeof GazeRecorder !== 'undefined' && typeof FormManager !== 'undefined') {
                resolve();
                return;
            }
            
            const script = document.createElement('script');
            script.src = scripts[index];
            script.onload = () => {
                console.log(`✅ Загружен: ${scripts[index]}`);
                loaded++;
                loadNext(index + 1);
            };
            script.onerror = () => {
                console.error(`❌ Ошибка загрузки: ${scripts[index]}`);
                reject(new Error(`Не удалось загрузить ${scripts[index]}`));
            };
            document.head.appendChild(script);
        }
        
        loadNext(0);
    });
}

async function showMyForms() {
    console.log('📋 [Интеграция] Запуск твоих форм');
    
    const container = document.getElementById('my-forms-container');
    if (!container) {
        console.error('❌ Контейнер my-forms-container не найден');
        return;
    }
    
    container.classList.add('my-forms-wrapper');
    container.innerHTML = '<div id="experimentContainer"></div>';
    container.style.display = 'block';
    
    const monitor = document.getElementById('videoMonitor');
    if (monitor) monitor.style.display = 'none';
    const overlay = document.getElementById('calibrationOverlay');
    if (overlay) overlay.style.display = 'none';
    
    document.querySelectorAll('.container, .error-container').forEach(el => {
        el.classList.add('hidden');
    });
    
    try {
        await loadMyScripts();
        await startMyForms();
    } catch(err) {
        console.error('❌ Ошибка загрузки:', err);
        container.innerHTML = '<div style="color: red; padding: 20px;">Ошибка загрузки анкеты. Проверьте консоль.</div>';
    }
}

async function startMyForms() {
    console.log('📋 startMyForms начат');
    
    if (typeof GazeRecorder === 'undefined') {
        throw new Error('GazeRecorder не загружен');
    }
    if (typeof FormManager === 'undefined') {
        throw new Error('FormManager не загружен');
    }
    
    let scenario = localStorage.getItem('my_next_scenario');
    if (!scenario) {
        scenario = 'without';
        localStorage.setItem('my_next_scenario', 'with');
    } else {
        scenario = scenario === 'with' ? 'without' : 'with';
        localStorage.setItem('my_next_scenario', scenario);
    }
    console.log(`📋 Сценарий: ${scenario === 'with' ? 'с прогресс-баром' : 'без прогресс-бара'}`);
    
    // Получаем ID из localStorage
    const participantData = JSON.parse(localStorage.getItem('participantData') || '{}');
    let participantId = participantData.participantId;
    
    if (!participantId) {
        participantId = prompt('Введите ID участника:');
        sessionStorage.setItem('my_participant_id', participantId);
    }
    
    console.log(`📋 ID участника: ${participantId}`);
    
    // Создаём GazeRecorder
    myGazeRecorder = new GazeRecorder();
    
    // Добавляем метод initWithoutBegin если его нет
    if (!myGazeRecorder.initWithoutBegin) {
        GazeRecorder.prototype.initWithoutBegin = function() {
            if (typeof webgazer === 'undefined') {
                console.error('❌ WebGazer не загружен');
                return Promise.reject('WebGazer не загружен');
            }
            webgazer.setRegression('ridge')
                .showVideo(true)
                .showPredictionPoints(true)
                .applyKalmanFilter(true);
            this.webgazerReady = true;
            console.log('✅ GazeRecorder привязан к существующему WebGazer');
            return Promise.resolve();
        };
    }
    
    await myGazeRecorder.initWithoutBegin();
    
    myFormManager = new FormManager(myGazeRecorder, scenario);
    
    // Сохраняем оригинальную функцию
    const originalComplete = myFormManager.completeExperiment;
    
    // Переопределяем completeExperiment
    myFormManager.completeExperiment = function() {
        console.log('📋 Формы завершены, возвращаемся в кинотеатр');
        
        // Скрываем контейнер с формами
        const container = document.getElementById('my-forms-container');
        if (container) {
            container.style.display = 'none';
        }
        
        // ✅ ПЕРЕКЛЮЧАЕМ ТИП ОШИБКИ ДЛЯ СЛЕДУЮЩЕЙ СЕССИИ
        if (typeof window.switchSessionErrorType === 'function') {
            const newType = window.switchSessionErrorType();
            console.log(`🎭 Тип ошибки переключён на: ${newType}`);
        } else {
            console.error('❌ switchSessionErrorType не найдена');
            // Запасной вариант: переключаем вручную
            let currentType = localStorage.getItem('currentSessionErrorType');
            if (!currentType) currentType = 'formal';
            const newType = currentType === 'formal' ? 'creative' : 'formal';
            localStorage.setItem('currentSessionErrorType', newType);
            console.log(`🎭 Ручное переключение: ${currentType} → ${newType}`);
        }
        
        // Показываем главную страницу кинотеатра
        if (typeof showMainPage === 'function') {
            showMainPage();
        } else {
            console.error('❌ showMainPage не найдена');
            // Запасной вариант
            const mainPage = document.getElementById('main-page');
            if (mainPage) mainPage.classList.remove('hidden');
        }
        
        // Вызываем оригинальную функцию completeExperiment, если она есть
        if (originalComplete && typeof originalComplete === 'function') {
            originalComplete.call(this);
        }
    };
    
    // Запускаем формы
    myFormManager.start(participantId);
}

function showMainPage() {
    console.log('🎬 showMainPage вызван');
    
    const mainPage = document.getElementById('main-page');
    if (mainPage) mainPage.classList.remove('hidden');
    
    const movieDetail = document.getElementById('movie-detail-page');
    if (movieDetail) movieDetail.classList.add('hidden');
    
    const formalPage = document.getElementById('formal-page');
    if (formalPage) formalPage.classList.add('hidden');
    
    const creativePage = document.getElementById('creative-page');
    if (creativePage) creativePage.classList.add('hidden');
    
    if (typeof curPage !== 'undefined') {
        curPage = 'main';
    }
    
    console.log('🎬 Возврат в кинотеатр, главная страница');
}

function showCinema() {
    console.log('🎬 Переход в кинотеатр');
    
    const mainPage = document.getElementById('main-page');
    if (mainPage) mainPage.classList.remove('hidden');
    
    const movieDetail = document.getElementById('movie-detail-page');
    if (movieDetail) movieDetail.classList.add('hidden');
    
    const formalPage = document.getElementById('formal-page');
    if (formalPage) formalPage.classList.add('hidden');
    
    const creativePage = document.getElementById('creative-page');
    if (creativePage) creativePage.classList.add('hidden');
    
    const cinemaApp = document.getElementById('cinema-app');
    if (cinemaApp) cinemaApp.classList.remove('hidden');
    
    if (typeof curPage !== 'undefined') {
        curPage = 'main';
    }
    
    console.log('✅ Кинотеатр открыт, главная страница');
}

// Делаем функции глобальными
window.showMyForms = showMyForms;
window.showCinema = showCinema;

console.log('✅ [Интеграция] Адаптер загружен, функция showMyForms() готова');