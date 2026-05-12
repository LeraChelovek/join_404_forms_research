// небольшая база данных для фильмов, где ключ - название фильма
const moviesData = {
    'Назад в будущее': {
        desc: 'Легендарная история о путешествии во времени, которая полюбилась многим',
        price: 450
    },
    'Титаник': {
        desc: 'Роза и Джек снова отправляются в своё первое и последнее совместное путешествие. Что может пойти не так?',
        price: 500
    },
    'Люди в чёрном': {
        desc: 'Неофициальное правительственное агентство, которое уже много лет контролирует инопланетян. Лучший фильм для параноиков',
        price: 600
    }
};

// глобальные переменные кинотеатра
let curPage = 'main'; // текущая открытая страница
let curTicketCount = 1; // количество выбранных билетов
let curErrorType = 'formal'; // текущий тип ошибки
let curMoviePrice = 500; // стоимость одного билета для текущего фильма

// глобальные переменные калибровки
let faceApiReady = false; // флаг загрузки FaceAPI (модели успешно загружены и камера работает)
let calibrationPointsCreated = false; // флаг для отслеживания созданных точек калибровки на экране
let pointsRemaining = 0; // счётчик оставшихся калибровочных точек (на каждую нужно кликнуть по 5 раз)

// переменные для тепловой карты
let heatmapDataPoints = []; // массив точек взгяда (x, y, values)
let isCollectingHeatmap = false; // флаг для отслеживания, идёт ли сейчас сбор точек для тепловой карты

// переменные для сбора эмоций
let emotionRecords = []; // массив записей эмоций (timestamp, page, emotion)
let emotionCollectionInterval = null; // ID интервала для периодического сбора эмоций
let currentEmotion = 'neutral'; // последняя распознанная эмоция (обновление каждый 200 мс)
let errorStartTime = null; // время входа на страницу ошибки (нужно для расчёта длительности)




// --- функции кинотеатра --- 
// функция для переключения между страницами кинотеатра
function showPage(id) {
    console.log('showPage вызван с id:', id);
    
    // если уходим со страницы ошибки на главную
    if (curPage !== 'main' && id === 'main' && (curPage === 'formal' || curPage === 'creative')) {
        stopHeatmapCollectionAndOfferDownload(); // сохраняем тепловую карту
        stopEmotionCollectionAndOfferDownload(); // сохраняем записи об эмоциях в json-файл
    }
    
    // обновляем глобальную переменную текущей страницы
    curPage = id;
    
    // скрываем все контейнеры
    document.querySelectorAll('#cinema-app .container, #cinema-app .error-container').forEach(el => {
        el.classList.add('hidden');
    });
    
    // показывается нужная страница
    let targetId;
    if (id === 'movie-detail') targetId = 'movie-detail-page';
    else targetId = id + '-page';
    
    const target = document.getElementById(targetId);
    if (target) {
        target.classList.remove('hidden'); // показываем целевую страницу
        console.log('Показана страница:', targetId);
    } else {
        console.error('Страница не найдена:', targetId);
    }
    
    // если пользователь перешёл на страницу с ошибкой
    if (id === 'formal' || id === 'creative') {
        console.log('Начинаем сбор данных для страницы ошибки:', id);
        startHeatmapCollection();
        startEmotionCollection(id);
    }
}


// --- вспомогательные функции (загрузка скриптов, инициализация) ---
function loadScript(src) {
    return new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = src;
        script.onload = resolve;
        script.onerror = () => reject(new Error(`Не удалось загрузить ${src}`));
        document.head.appendChild(script);
    });
}

// --- проверка загрузки библиотеки WebGazer ---
async function ensureWebGazer() {
    if (typeof webgazer !== 'undefined') return true;
    console.warn('WebGazer не загружен, пробуем загрузить из:', WEBGAZER_FALLBACK_URL);
    try {
        await loadScript(WEBGAZER_FALLBACK_URL);
        // даём время на инициализацию
        await new Promise(r => setTimeout(r, 500));
        return typeof webgazer !== 'undefined';
    } catch (e) {
        console.error(e);
        return false;
    }
}


// --- обработка кнопки "пройти опрос" ---
function initSurveyButton() {
    const surveyBtn = document.getElementById('startSurveyBtn');
    if (surveyBtn) {
        surveyBtn.addEventListener('click', () => {
            console.log('Нажата кнопка "Пройти опрос"');
            if (typeof window.startSurvey === 'function') {
                window.startSurvey(); // запуск опроса, определён в survey.js
            } else {
                console.error('startSurvey не найдена');
                alert('Опрос ещё не загружен. Проверьте подключение survey.js');
            }
        });
        console.log('Кнопка опроса готова');
    } else {
        console.error('Кнопка startSurveyBtn не найдена в DOM');
    }
}

// --- запускаем инициализацию кнопки опроса после полной загрузки DOM ---
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initSurveyButton);
} else {
    initSurveyButton();
}

// --- функция управления фильмами и билетами ---
function openMovie(title, errorType) {
    const movie = moviesData[title];
    if (!movie) return;
    // заполняем заголовок и описание фильма на странице деталей
    document.getElementById('selected-movie-title').innerText = title;
    document.getElementById('selected-movie-desc').innerText = movie.desc;
    
    curTicketCount = 1; // сбрасываем количество билетов до 1
    curMoviePrice = movie.price;
    updateTicketUI(); // обновляем отображение цены и счётчика
    
    // берём тип из localStorage (для чередования formal/creative)
    const sessionErrorType = getCurrentSessionErrorType();
    console.log(`Фильм: ${title}, тип ошибки: ${sessionErrorType}`);
    
    document.getElementById('pay-button').onclick = function() { 
        console.log(`Оплата, показываем: ${sessionErrorType}`);
        showPage('creative'); // вот тут вот меняем (если не работает изменение типов)
    };
    
    showPage('movie-detail'); // переход на страницу деталей фильма
}

// --- функция для получения следующего типа ошибки ---
function getNextErrorType() {
    // чётное число - formal, нечётное - creative
    const errorType = (errorTypeCounter % 2 === 0) ? 'formal' : 'creative';
    
    // увеличиваем счётчик
    errorTypeCounter++;
    localStorage.setItem('errorTypeCounter', errorTypeCounter);
    
    console.log(`Тип ошибки: ${errorType} (счётчик: ${errorTypeCounter})`);
    
    return errorType;
}

// --- функция для сброса счётчика ---
function resetErrorTypeCounter() {
    errorTypeCounter = 0;
    localStorage.setItem('errorTypeCounter', 0);
    console.log('Счётчик ошибок сброшен');
}

// --- функция для изменения количества выбранных билетов --- 
function changeTickets(delta) {
    curTicketCount += delta;
    if (curTicketCount < 1) curTicketCount = 1; // не может быть меньше 1 билета
    updateTicketUI();
}

// --- обновление отображения количества билетов и итоговой цены на странице деталей ---
function updateTicketUI() {
    document.getElementById('ticket-count').innerText = curTicketCount;
    document.getElementById('total-price').innerText = curTicketCount * curMoviePrice;
}

// --- функции для тепловой карты ---
function startHeatmapCollection() {
    if (isCollectingHeatmap) return; // если сбор уже идёт, то ничего не меняем
    heatmapDataPoints = [];
    isCollectingHeatmap = true;
    console.log('Сбор данных тепловой карты начат');
}

// --- добавляет точку взгляда в массив для тепловой карты ---
function addGazePoint(x, y) {
    if (!isCollectingHeatmap) return;
    if (x === undefined || y === undefined) return;
    if (x < 0 || y < 0 || x > window.innerWidth || y > window.innerHeight) return;
    heatmapDataPoints.push({ x: Math.round(x), y: Math.round(y), value: 1 });
}

// --- останавливает сбор точек и предлагает пользоателю сохранить тепловую карту
function stopHeatmapCollectionAndOfferDownload() {
    if (!isCollectingHeatmap) return;
    isCollectingHeatmap = false;
    
    if (heatmapDataPoints.length < 10) {
        console.log('Слишком мало данных для тепловой карты (меньше 10 точек)');
        clearHeatmapData();
        return;
    }
    
    // запрашиваем согласие на сохранение данных
    if (confirm("Сохранить тепловую карту вашего взгляда на ошибку в формате PNG?")) {
        generateHeatmapImage();
    } else {
        clearHeatmapData();
    }
}


// --- функция для смены типа ошибки (вызывается после завершения эксперимента) ---
function switchSessionErrorType() {
    let currentType = getCurrentSessionErrorType();
    let newType = currentType === 'formal' ? 'creative' : 'formal';
    localStorage.setItem('currentSessionErrorType', newType);
    console.log(`Тип ошибки сессии переключён: ${currentType} → ${newType}`);
    return newType;
}

// функция для получения текущего типа ошибки
function getCurrentSessionErrorType() {
    let type = localStorage.getItem('currentSessionErrorType');
    console.log(`getCurrentSessionErrorType: ${type}`);
    if (!type || (type !== 'formal' && type !== 'creative')) {
        type = 'formal';
        localStorage.setItem('currentSessionErrorType', type);
        console.log(`Инициализация: ${type}`);
    }
    return type;
}

window.switchSessionErrorType = switchSessionErrorType;
window.getCurrentSessionErrorType = getCurrentSessionErrorType;

// Инициализация
console.log(`Текущий тип ошибки сессии: ${getCurrentSessionErrorType()}`);

// --- генерация тепловой карты ---
function generateHeatmapImage() {
    const container = document.createElement('div');
    container.style.width = window.innerWidth + 'px';
    container.style.height = window.innerHeight + 'px';
    container.style.position = 'absolute';
    container.style.top = '-9999px';
    container.style.left = '-9999px';
    document.body.appendChild(container);
    
    const heatmap = h337.create({
        container: container,
        radius: 60,
        maxOpacity: 0.6,
        minOpacity: 0.2,
        blur: 0.8,
        gradient: {
            0.2: 'blue',
            0.4: 'cyan',
            0.6: 'lime',
            0.8: 'yellow',
            1.0: 'red'
        }
    });
    
    heatmap.setData({ max: 5, data: heatmapDataPoints });
    if (heatmap._renderer && heatmap._renderer._resize) heatmap._renderer._resize();
    
    setTimeout(() => {
        const canvas = container.querySelector('canvas');
        if (canvas) {
            const link = document.createElement('a');
            link.download = `heatmap_${curPage}_${Date.now()}.png`;
            link.href = canvas.toDataURL('image/png');
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            console.log("Тепловая карта сохранена");
        } else {
            console.error("Canvas не создался");
        }
        container.remove();
        clearHeatmapData();
    }, 500);
}

// --- очистка данных тепловой карты ---
function clearHeatmapData() {
    heatmapDataPoints = [];
    isCollectingHeatmap = false;
    console.log('Данные тепловой карты очищены');
}

// --- функции для сбора эмоций
function startEmotionCollection(pageType) {
    // останавливаем предыдущий интервал, если есть
    if (emotionCollectionInterval) clearInterval(emotionCollectionInterval);
    
    // очищаем массив записей
    emotionRecords = [];
    // запоминаем время входа
    errorStartTime = Date.now();
    
    // запускаем интервал и каждые 500 мс записываем текущую эмоцию
    emotionCollectionInterval = setInterval(() => {
        if (currentEmotion) {
            const now = new Date();
            const timestamp = now.toLocaleTimeString('ru-RU', { hour12: false }) + '.' + String(now.getMilliseconds()).padStart(3, '0');
            emotionRecords.push({
                timestamp: timestamp,
                page: pageType,
                emotion: currentEmotion
            });
            console.log(`Эмоция записана: ${currentEmotion} на ${pageType}`);
        }
    }, 500);
    
    console.log('Сбор эмоций начат');
}

function stopEmotionCollectionAndOfferDownload() {
    if (emotionCollectionInterval) {
        clearInterval(emotionCollectionInterval);
        emotionCollectionInterval = null;
    }
    
    if (!errorStartTime) return;
    
    const durationSeconds = Math.round((Date.now() - errorStartTime) / 1000);
    errorStartTime = null;
    
    if (emotionRecords.length === 0) {
        console.log('Нет записей эмоций для сохранения');
        return;
    }
    
    // формируем итоговые данные
    const reportData = {
        page: curPage, // страница, с которой уходим (formal или creative)
        total_duration_seconds: durationSeconds,
        emotion_log: emotionRecords
    };
    
    if (confirm(`Сохранить данные об эмоциях (всего ${emotionRecords.length} записей, время на странице: ${durationSeconds} сек) в формате JSON?`)) {
        const dataStr = JSON.stringify(reportData, null, 2);
        const blob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `emotions_${curPage}_${Date.now()}.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        console.log("JSON с эмоциями сохранён");
    }
    
    // очищаем записи после сохранения (или отказа)
    emotionRecords = [];
}

// --- функция калибровки и FaceAPI ---
async function startCalibration() {
    // загрузка WebGazer
    const webgazerLoaded = await ensureWebGazer();
    if (!webgazerLoaded) {
        alert('WebGazer не загрузился. Проверьте интернет-соединение или наличие файла по указанному пути.');
        return;
    }
    // настройка параметров WebGazer
    webgazer.params.moveTickSize = 1;
    webgazer.params.stablizeOutlier = false;
    webgazer.params.waitFramesCount = 0;
    webgazer.params.ridgeParameter = 0.0001;
    webgazer.params.storageLength = 1;
    webgazer.params.kalmanFilter = false;
    
    // переключение интерфейса
    // скрываем оверлей калибровки
    document.getElementById('calibrationOverlay').style.display = 'none';
    // панель мониторов
    document.getElementById('videoMonitor').style.display = 'flex';
    
    // запуск WebGazer
    try {
        await webgazer.setRegression('ridge')
            .setGazeListener((data, timestamp) => {
                if (data) {
                    // обновляем текстовое отображение координат в мониторе взгляда
                    if (document.getElementById('gazeValues')) {
                        document.getElementById('gazeValues').innerHTML = "x:${Math.round(data.x)} y:${Math.round(data.y)}";
                    }
                    // добавляем текущую точку взгяда в массив
                    if (isCollectingHeatmap && data.x && data.y) {
                        addGazePoint(data.x, data.y);
                    }
                }
            })
            .begin();
        
        // настройка отображения 
        webgazer.showVideo(true).showPredictionPoints(false); // скрытие точки взгляда
        // стилизация для точки взгляда
        setTimeout(() => {
            const dot = document.getElementById('webgazerGazeDot');
            if (dot) {
                dot.style.width = '16px';
                dot.style.height = '16px';
                dot.style.backgroundColor = 'red';
                dot.style.borderRadius = '50%';
                dot.style.border = '2px solid white';
                dot.style.boxShadow = '0 0 8px red';
            }
        }, 500);
        
        // настройка видео контейнера
        setupVideoLayout();
        // запуск FaceAPI
        await startFaceAPI();
        // создание калибровочных точек
        createCalibrationPoints();
    } catch(err) {
        console.error(err);
        alert('Ошибка запуска калибровки: ' + err);
    }
}

// --- настройка расположения видео WebGAzer ---
function setupVideoLayout() {
    setTimeout(() => {
        const wgContainer = document.getElementById('webgazerVideoContainer');
        const parent = document.getElementById('webgazerVideoParent');
        if (wgContainer && parent) {
            wgContainer.style.position = 'relative';
            wgContainer.style.width = '100%';
            wgContainer.style.height = '100%';
            parent.appendChild(wgContainer);
        }
    }, 500);
}


// --- запуск FaceAPI ---
async function startFaceAPI() {
    // берём модели
    const MODEL_URL = '/models';
    await faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL);
    await faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL);
    await faceapi.nets.faceExpressionNet.loadFromUri(MODEL_URL);
    
    // создание и настройка видео-элемента
    const faceContainer = document.getElementById('faceVideoContainer');
    const video = document.createElement('video');
    video.autoplay = true;
    video.muted = true;
    video.playsInline = true;
    video.style.width = '100%';
    video.style.height = '100%';
    video.style.objectFit = 'cover';
    faceContainer.innerHTML = '';
    faceContainer.appendChild(video);
    
    // получение доступа к камере
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        video.srcObject = stream; // передаём поток в видео элементы
        video.play(); // запускаем воспроизвдение
        faceApiReady = true;
    } catch(err) {
        console.warn('FaceAPI video error', err);
        document.getElementById('faceValues').innerHTML = 'нет доступа к камере';
    }
    
    // запускаем детекцию эмоций и обновляем currentEmotion
    setInterval(async () => {
        if (video.videoWidth && video.videoHeight && faceApiReady) {
            const detection = await faceapi.detectSingleFace(video, new faceapi.TinyFaceDetectorOptions()).withFaceExpressions();
            if (detection) {
                const expressions = detection.expressions;
                const dominant = Object.entries(expressions).reduce((a,b) => a[1] > b[1] ? a : b)[0];
                const emoji = getEmotionEmoji(dominant);
                document.getElementById('faceValues').innerHTML = `${emoji} ${dominant}: ${Math.round(expressions[dominant]*100)}%`;
                // сохраняем текущую эмоцию в глобальную переменную для сбора
                currentEmotion = dominant;
            } else {
                document.getElementById('faceValues').innerHTML = '😶 лицо не обнаружено';
                currentEmotion = 'no_face';
            }
        }
    }, 200);
}

// --- функция для стикеров для эмоций ---
function getEmotionEmoji(emotion) {
    const map = { neutral:'😐', happy:'😊', sad:'😢', angry:'😠', fearful:'😨', disgusted:'🤢', surprised:'😲' };
    return map[emotion] || '😐';
}

// --- создание калибровочных точек ---
function createCalibrationPoints() {
    if (calibrationPointsCreated) return;
    const points = [
        {t:'10%', l:'10%'}, {t:'10%', l:'50%'}, {t:'10%', l:'90%'},
        {t:'50%', l:'10%'}, {t:'50%', l:'50%'}, {t:'50%', l:'90%'},
        {t:'90%', l:'10%'}, {t:'90%', l:'50%'}, {t:'90%', l:'90%'}
    ];
    // устанавливаем глобальный счётчик оставщихся точек
    pointsRemaining = points.length;
    // перебираем все точки и создаём точки
    points.forEach(pos => {
        const pt = document.createElement('div');
        pt.className = 'CalibrationPoint'; // класс для стилизации
        pt.dataset.clicks = 0; // счётчик кликов по этой точке
        pt.style.top = pos.t; // вертикальная позиция
        pt.style.left = pos.l; // горизонтальная позиция
        pt.style.position = 'fixed';
        pt.onclick = function(e) {
            e.stopPropagation();
            let clicks = parseInt(this.dataset.clicks) + 1;
            this.dataset.clicks = clicks;
            this.style.opacity = 1 - (clicks * 0.15);
            if (clicks >= 5) {
                this.style.background = 'yellow';
                this.style.pointerEvents = 'none';
                pointsRemaining--;
                checkCalibrationStatus(); // проверяем все ли точки пройдены
            }
        };
        // добавляем точки на страницу
        document.body.appendChild(pt);
    });
    // устанавливаем флаг, что все точки созданы
    calibrationPointsCreated = true;
}

// --- проверка статуса калбровки ---
function checkCalibrationStatus() {
    if (pointsRemaining === 0) {
        startFinalValidation();
    } else {
        const statusDiv = document.getElementById('calibrationStatus');
        if (statusDiv) statusDiv.innerText = `Осталось точек: ${pointsRemaining}`;
    }
}

// --- финальная валидация после калибровки ---
function startFinalValidation() {
    // удаляем все калибровочные точки с экрана
    document.querySelectorAll('.CalibrationPoint').forEach(p => p.remove());
    const status = document.getElementById('calibrationStatus');
    if (status) status.innerText = "Посмотрите на синюю точку в центре (валидация)";
    // создаём синюю точку в центре экрана для валидации
    const vPoint = document.createElement('div');
    vPoint.className = 'FinalPoint';
    vPoint.style.top = '50%';
    vPoint.style.left = '50%';
    vPoint.style.transform = 'translate(-50%,-50%)';
    document.body.appendChild(vPoint);
    // через 2.5 секунды удаляем синюю точку и завершаем калибровку
    setTimeout(() => {
        vPoint.remove();
        finishCalibration();
    }, 2500);
}


// --- завершение калибровки ---
function finishCalibration() {
    // скрываем панель мониторов 
    document.getElementById('videoMonitor').style.display = 'none';
    const overlay = document.getElementById('calibrationOverlay');
    if (overlay) overlay.style.display = 'none';
    
    if (typeof showMyForms === 'function') {
        showMyForms(); // переход к анкете персонажа
    } else {
        console.error('Функция showMyForms не найдена!');
        // запасной вариант: показать кинотеатр
        document.getElementById('cinema-app').classList.remove('hidden');
    }

    console.log('Калибровка завершена. Айтрекинг и эмоции активны.');
    const toast = document.createElement('div');
    toast.innerText = 'Калибровка успешна! Добро пожаловать в кинотеатр.';
    toast.style.position = 'fixed';
    toast.style.bottom = '20px';
    toast.style.left = '20px';
    toast.style.backgroundColor = '#CE3032';
    toast.style.color = 'white';
    toast.style.padding = '10px 20px';
    toast.style.borderRadius = '8px';
    toast.style.zIndex = '9999';
    toast.style.fontFamily = 'Georgia';
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 4000);
}



// глобальный доступ для onclick
window.openMovie = openMovie;
window.changeTickets = changeTickets;
window.showPage = showPage;
window.startCalibration = startCalibration;

// при загрузке страницы
window.addEventListener('load', () => {
    if (typeof webgazer === 'undefined') {
        document.getElementById('calibrationStatus').innerHTML = 'Библиотека WebGazer не загружена. Проверьте интернет.';
    }
});


