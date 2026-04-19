// ---------- БАЗА ДАННЫХ ФИЛЬМОВ ----------
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

// Глобальные переменные кинотеатра
let curPage = 'main';
let curTicketCount = 1;
let curErrorType = 'formal';
let curMoviePrice = 500;

// Глобальные переменные калибровки
let faceApiReady = false;
let calibrationPointsCreated = false;
let pointsRemaining = 0;

// ---------- ПЕРЕМЕННЫЕ ДЛЯ ТЕПЛОВОЙ КАРТЫ ----------
let heatmapDataPoints = [];
let isCollectingHeatmap = false;

// ---------- ПЕРЕМЕННЫЕ ДЛЯ СБОРА ЭМОЦИЙ ----------
let emotionRecords = [];           // массив записей эмоций
let emotionCollectionInterval = null; // интервал сбора эмоций
let currentEmotion = 'neutral';    // последняя распознанная эмоция
let errorStartTime = null;         // время входа на страницу ошибки

// ---------- ФУНКЦИИ КИНОТЕАТРА ----------
function showPage(id) {
    // Если уходим со страницы ошибки на главную
    if (curPage !== 'main' && id === 'main' && (curPage === 'formal' || curPage === 'creative')) {
        stopHeatmapCollectionAndOfferDownload(); // тепловая карта
        stopEmotionCollectionAndOfferDownload(); // эмоции + время
    }
    
    curPage = id;
    document.querySelectorAll('#cinema-app .container, #cinema-app .error-container').forEach(el => {
        el.classList.add('hidden');
    });
    
    let targetId;
    if (id === 'movie-detail') targetId = 'movie-detail-page';
    else targetId = id + '-page';
    const target = document.getElementById(targetId);
    if (target) target.classList.remove('hidden');
    
    // Если новая страница — страница ошибки
    if (id === 'formal' || id === 'creative') {
        startHeatmapCollection();   // сбор взгляда
        startEmotionCollection(id); // сбор эмоций
    }
}

function openMovie(title, errorType) {
    const movie = moviesData[title];
    if (!movie) return;
    document.getElementById('selected-movie-title').innerText = title;
    document.getElementById('selected-movie-desc').innerText = movie.desc;
    curTicketCount = 1;
    curErrorType = errorType;
    curMoviePrice = movie.price;
    updateTicketUI();
    document.getElementById('pay-button').onclick = function() { showPage(curErrorType); };
    showPage('movie-detail');
}

function changeTickets(delta) {
    curTicketCount += delta;
    if (curTicketCount < 1) curTicketCount = 1;
    updateTicketUI();
}

function updateTicketUI() {
    document.getElementById('ticket-count').innerText = curTicketCount;
    document.getElementById('total-price').innerText = curTicketCount * curMoviePrice;
}

// ---------- ФУНКЦИИ ТЕПЛОВОЙ КАРТЫ (рабочие) ----------
function startHeatmapCollection() {
    if (isCollectingHeatmap) return;
    heatmapDataPoints = [];
    isCollectingHeatmap = true;
    console.log('Сбор данных тепловой карты начат');
}

function addGazePoint(x, y) {
    if (!isCollectingHeatmap) return;
    if (x === undefined || y === undefined) return;
    if (x < 0 || y < 0 || x > window.innerWidth || y > window.innerHeight) return;
    heatmapDataPoints.push({ x: Math.round(x), y: Math.round(y), value: 1 });
}

function stopHeatmapCollectionAndOfferDownload() {
    if (!isCollectingHeatmap) return;
    isCollectingHeatmap = false;
    
    if (heatmapDataPoints.length < 10) {
        console.log('Слишком мало данных для тепловой карты (меньше 10 точек)');
        clearHeatmapData();
        return;
    }
    
    if (confirm("Сохранить тепловую карту вашего взгляда на ошибку в формате PNG?")) {
        generateHeatmapImage();
    } else {
        clearHeatmapData();
    }
}

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

function clearHeatmapData() {
    heatmapDataPoints = [];
    isCollectingHeatmap = false;
    console.log('Данные тепловой карты очищены');
}

// ---------- НОВЫЕ ФУНКЦИИ ДЛЯ СБОРА ЭМОЦИЙ ----------
function startEmotionCollection(pageType) {
    // Останавливаем предыдущий интервал, если есть
    if (emotionCollectionInterval) clearInterval(emotionCollectionInterval);
    
    // Очищаем массив записей
    emotionRecords = [];
    // Запоминаем время входа
    errorStartTime = Date.now();
    
    // Запускаем интервал: каждые 500 мс записываем текущую эмоцию
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
    
    // Формируем итоговые данные
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
    
    // Очищаем записи после сохранения (или отказа)
    emotionRecords = [];
}

// ---------- ФУНКЦИИ КАЛИБРОВКИ И FACEAPI (с обновлением currentEmotion) ----------
async function startCalibration() {
    if (typeof webgazer === 'undefined') {
        alert('WebGazer не загрузился. Проверьте интернет-соединение.');
        return;
    }
    
    webgazer.params.moveTickSize = 1;
    webgazer.params.stablizeOutlier = false;
    webgazer.params.waitFramesCount = 0;
    webgazer.params.ridgeParameter = 0.0001;
    webgazer.params.storageLength = 1;
    webgazer.params.kalmanFilter = false;
    
    document.getElementById('calibrationOverlay').style.display = 'none';
    document.getElementById('videoMonitor').style.display = 'flex';
    
    try {
        await webgazer.setRegression('ridge')
            .setGazeListener((data, timestamp) => {
                if (data) {
                    if (document.getElementById('gazeValues')) {
                        document.getElementById('gazeValues').innerHTML = `👁️ x:${Math.round(data.x)} y:${Math.round(data.y)}`;
                    }
                    if (isCollectingHeatmap && data.x && data.y) {
                        addGazePoint(data.x, data.y);
                    }
                }
            })
            .begin();
        
        webgazer.showVideo(true).showPredictionPoints(false);
        
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
        
        setupVideoLayout();
        await startFaceAPI();
        createCalibrationPoints();
    } catch(err) {
        console.error(err);
        alert('Ошибка запуска калибровки: ' + err);
    }
}

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

async function startFaceAPI() {
    const MODEL_URL = '/models';
    await faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL);
    await faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL);
    await faceapi.nets.faceExpressionNet.loadFromUri(MODEL_URL);
    
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
    
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        video.srcObject = stream;
        video.play();
        faceApiReady = true;
    } catch(err) {
        console.warn('FaceAPI video error', err);
        document.getElementById('faceValues').innerHTML = '❌ нет доступа к камере';
    }
    
    // Запускаем детекцию эмоций и обновляем currentEmotion
    setInterval(async () => {
        if (video.videoWidth && video.videoHeight && faceApiReady) {
            const detection = await faceapi.detectSingleFace(video, new faceapi.TinyFaceDetectorOptions()).withFaceExpressions();
            if (detection) {
                const expressions = detection.expressions;
                const dominant = Object.entries(expressions).reduce((a,b) => a[1] > b[1] ? a : b)[0];
                const emoji = getEmotionEmoji(dominant);
                document.getElementById('faceValues').innerHTML = `${emoji} ${dominant}: ${Math.round(expressions[dominant]*100)}%`;
                // Сохраняем текущую эмоцию в глобальную переменную для сбора
                currentEmotion = dominant;
            } else {
                document.getElementById('faceValues').innerHTML = '😶 лицо не обнаружено';
                currentEmotion = 'no_face';
            }
        }
    }, 200);
}

function getEmotionEmoji(emotion) {
    const map = { neutral:'😐', happy:'😊', sad:'😢', angry:'😠', fearful:'😨', disgusted:'🤢', surprised:'😲' };
    return map[emotion] || '😐';
}

// ---------- КАЛИБРОВОЧНЫЕ ТОЧКИ ----------
function createCalibrationPoints() {
    if (calibrationPointsCreated) return;
    const points = [
        {t:'10%', l:'10%'}, {t:'10%', l:'50%'}, {t:'10%', l:'90%'},
        {t:'50%', l:'10%'}, {t:'50%', l:'50%'}, {t:'50%', l:'90%'},
        {t:'90%', l:'10%'}, {t:'90%', l:'50%'}, {t:'90%', l:'90%'}
    ];
    pointsRemaining = points.length;
    points.forEach(pos => {
        const pt = document.createElement('div');
        pt.className = 'CalibrationPoint';
        pt.dataset.clicks = 0;
        pt.style.top = pos.t;
        pt.style.left = pos.l;
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
                checkCalibrationStatus();
            }
        };
        document.body.appendChild(pt);
    });
    calibrationPointsCreated = true;
}

function checkCalibrationStatus() {
    if (pointsRemaining === 0) {
        startFinalValidation();
    } else {
        const statusDiv = document.getElementById('calibrationStatus');
        if (statusDiv) statusDiv.innerText = `Осталось точек: ${pointsRemaining}`;
    }
}

function startFinalValidation() {
    document.querySelectorAll('.CalibrationPoint').forEach(p => p.remove());
    const status = document.getElementById('calibrationStatus');
    if (status) status.innerText = "Посмотрите на синюю точку в центре (валидация)";
    const vPoint = document.createElement('div');
    vPoint.className = 'FinalPoint';
    vPoint.style.top = '50%';
    vPoint.style.left = '50%';
    vPoint.style.transform = 'translate(-50%,-50%)';
    document.body.appendChild(vPoint);
    setTimeout(() => {
        vPoint.remove();
        finishCalibration();
    }, 2500);
}

function finishCalibration() {
    document.getElementById('videoMonitor').style.display = 'none'; // Скрываем мониторы
    document.getElementById('cinema-app').classList.remove('hidden');
    const overlay = document.getElementById('calibrationOverlay');
    if (overlay) overlay.style.display = 'none';
    console.log('Калибровка завершена. Айтрекинг и эмоции активны.');
    const toast = document.createElement('div');
    toast.innerText = '✅ Калибровка успешна! Добро пожаловать в кинотеатр.';
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

// Глобальный доступ для onclick
window.openMovie = openMovie;
window.changeTickets = changeTickets;
window.showPage = showPage;
window.startCalibration = startCalibration;

// При загрузке страницы
window.addEventListener('load', () => {
    if (typeof webgazer === 'undefined') {
        document.getElementById('calibrationStatus').innerHTML = '⚠️ Библиотека WebGazer не загружена. Проверьте интернет.';
    }
});