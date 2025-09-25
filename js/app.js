let lastPageId = 'home';
let activeUser = null;
let appData = { vodStreams: [], series: [], liveStreams: [] };
let renderState = {};
const RENDER_BATCH_SIZE = 100;
let lazyLoadObserver;
let searchTimeout;
let hls = null;



function initializeLazyLoader() {
    if (lazyLoadObserver) lazyLoadObserver.disconnect();
    const options = { root: null, rootMargin: '0px 0px 500px 0px', threshold: 0 };
    lazyLoadObserver = new IntersectionObserver((entries, observer) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const sentinel = entry.target;
                const { stateKey, pageId } = sentinel.dataset;
                loadMoreItems(document.getElementById(`${pageId}-content`), sentinel, stateKey, pageId, observer);
            }
        });
    }, options);
}

async function fetchAPI(url) {
    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        return response;
    } catch (error) {
        if (error instanceof TypeError) throw new Error(`Falha na rede ou erro de CORS.`);
        throw error;
    }
}

async function fetchXtreamData(url, user, pass, action) {
    const targetUrl = `${url}/player_api.php?username=${user}&password=${pass}&action=${action}`;
    const response = await fetchAPI(targetUrl);
    const textData = await response.text();
    try {
        if (textData.trim() === '[]') return [];
        const data = JSON.parse(textData);
        if (data.user_info && data.user_info.auth === 0) throw new Error('Credenciais inválidas.');
        return data;
    } catch(e) {
        throw new Error('Resposta inválida do servidor (não é JSON).');
    }
}

async function loginWithXtream(url, user, pass) {
    document.getElementById('login-loader').style.display = 'block';
    document.getElementById('login-error').textContent = '';
    try {
        await fetchXtreamData(url, user, pass, 'get_user_info');
        const [liveStreams, vodStreams, series] = await Promise.all([
            fetchXtreamData(url, user, pass, 'get_live_streams'),
            fetchXtreamData(url, user, pass, 'get_vod_streams'),
            fetchXtreamData(url, user, pass, 'get_series'),
        ]);
        appData = { liveStreams, vodStreams, series };
        activeUser = { type: 'xtream', url, user, pass };
        localStorage.setItem('streamflix_session', JSON.stringify(activeUser));
        renderAllPages();
        showApp('xtream');
    } catch (error) {
        showLoginError(error.message || 'Falha ao carregar dados.');
    }
}

async function loginWithM3U(url) {
    document.getElementById('login-loader').style.display = 'block';
    document.getElementById('login-error').textContent = '';
    try {
        const response = await fetchAPI(url);
        const m3uText = await response.text();
        const content = parseM3U(m3uText);
        if (content.live.length === 0 && content.vod.length === 0 && content.series.length === 0) throw new Error('Nenhum conteúdo válido encontrado na lista M3U.');
        appData = { liveStreams: content.live, vodStreams: content.vod, series: content.series };
        activeUser = { type: 'm3u', url };
        localStorage.setItem('streamflix_session', JSON.stringify(activeUser));
        renderAllPages();
        showApp('m3u');
    } catch (error) {
        showLoginError(error.message);
    }
}

function renderAllPages() {
    renderState = {};
    initializeLazyLoader();
    renderHomePage();
    renderGridPage('movies', appData.vodStreams);
    renderGridPage('series', appData.series);
    renderGridPage('iptv', appData.liveStreams);
}

function renderHomePage() {
    const homeContent = document.getElementById('home-content');
    const firstItem = appData.vodStreams?.[0] || appData.series?.[0] || appData.liveStreams?.[0];
    if (!firstItem) {
        homeContent.innerHTML = '<div class="generic-page"><h1>Bem-vindo!</h1><p>Navegue pelas seções para encontrar conteúdo.</p></div>';
        return;
    }
    const title = firstItem.name;
    const image = firstItem.stream_icon || firstItem.cover;
    homeContent.innerHTML = `
        <header class="hero-section" style="background-image: linear-gradient(to top, #141414 10%, transparent 50%), url('${image}');">
            <div class="hero-content">
                <h1 class="hero-title">${title}</h1>
            </div>
        </header>
    `;
}

function renderGridPage(pageId, items) {
    const container = document.getElementById(`${pageId}-content`);
    container.innerHTML = '';
    if (!items || items.length === 0) return;
    
    const sentinel = document.createElement('div');
    sentinel.className = 'load-sentinel';
    container.after(sentinel);
    
    const stateKey = `${pageId}-grid`;
    renderState[stateKey] = { items: items, nextIndex: 0 };
    
    sentinel.dataset.stateKey = stateKey;
    sentinel.dataset.pageId = pageId;

    lazyLoadObserver.observe(sentinel);
}

function loadMoreItems(container, sentinel, stateKey, pageId, observer) {
    const state = renderState[stateKey];
    if (!state) return;
    observer.unobserve(sentinel);

    const itemsToRender = state.items.slice(state.nextIndex, state.nextIndex + RENDER_BATCH_SIZE);
    let cardsHtml = '';
    itemsToRender.forEach(item => {
        cardsHtml += createCardHtml(item, pageId);
    });

    container.insertAdjacentHTML('beforeend', cardsHtml);
    state.nextIndex += itemsToRender.length;
    
    if (state.nextIndex < state.items.length) {
        observer.observe(sentinel);
    } else {
        sentinel.remove();
    }
}

function createCardHtml(item, pageId) {
    const streamId = item.stream_id || item.series_id;
    const title = item.name;
    const image = item.stream_icon || item.cover || item.logo;
    let streamUrl = '';
    let seriesId = '';
    
    if (activeUser.type === 'xtream') {
        const extension = item.container_extension || 'mp4'; // Fallback para mp4
        streamUrl = pageId === 'movies' ? `${activeUser.url}/movie/${activeUser.user}/${activeUser.pass}/${streamId}.${extension}` : (pageId === 'iptv' ? `${activeUser.url}/live/${activeUser.user}/${activeUser.pass}/${streamId}.m3u8` : '');
        seriesId = pageId === 'series' ? streamId : '';
    } else { // M3U
        if (pageId === 'series') {
            seriesId = item.name;
        } else {
            streamUrl = item.url;
        }
    }

    return `
        <div class="media-card" data-stream-url="${streamUrl}" data-series-id="${seriesId}">
            <img src="${image}" alt="${title}" onerror="this.onerror=null;this.src='https://placehold.co/400x600/222/fff?text=${encodeURIComponent(title)}';">
            <div class="media-card-title">${title}</div>
        </div>`;
}

function performSearch(query) {
    const searchResultsContainer = document.getElementById('search-results');
    if (!query) {
        searchResultsContainer.innerHTML = '';
        return;
    }
    const lowerQuery = query.toLowerCase();
    const results = {
        Filmes: appData.vodStreams.filter(i => i.name.toLowerCase().includes(lowerQuery)),
        Séries: appData.series.filter(i => i.name.toLowerCase().includes(lowerQuery)),
        "Canais Ao Vivo": appData.liveStreams.filter(i => i.name.toLowerCase().includes(lowerQuery)),
    };
    
    searchResultsContainer.innerHTML = '';
    for (const [category, items] of Object.entries(results)) {
        if (items.length > 0) {
            let cardsHtml = items.map(item => {
                const pageId = category === 'Filmes' ? 'movies' : (category === 'Séries' ? 'series' : 'iptv');
                return createCardHtml(item, pageId);
            }).join('');
            searchResultsContainer.innerHTML += `<h2>${category} (${items.length})</h2><div class="media-grid">${cardsHtml}</div>`;
        }
    }
    if (searchResultsContainer.innerHTML === '') {
        searchResultsContainer.innerHTML = `<p>Nenhum resultado encontrado para "${query}"</p>`;
    }
}

async function renderSeriesDetailsPage(seriesId) {
    try {
        const seriesInfo = await fetchXtreamData(activeUser.url, activeUser.user, activeUser.pass, `get_series_info&series_id=${seriesId}`);
        
        document.getElementById('series-details-backdrop').style.backgroundImage = `url('${seriesInfo.info.backdrop_path?.[0] || ''}')`;
        document.getElementById('series-details-title').textContent = seriesInfo.info.name;
        document.getElementById('series-details-plot').textContent = seriesInfo.info.plot;
        
        const seasonSelect = document.getElementById('season-select');
        seasonSelect.innerHTML = '';
        if (seriesInfo.episodes) {
            Object.keys(seriesInfo.episodes).forEach(seasonNum => {
                const option = document.createElement('option');
                option.value = seasonNum;
                option.textContent = `Temporada ${seasonNum}`;
                seasonSelect.appendChild(option);
            });

            const renderEpisodes = (seasonNum) => {
                const episodeList = document.getElementById('episode-list');
                episodeList.innerHTML = '';
                seriesInfo.episodes[seasonNum].forEach(ep => {
                    const epUrl = `${activeUser.url}/series/${activeUser.user}/${activeUser.pass}/${ep.id}.${ep.container_extension}`;
                    const item = document.createElement('div');
                    item.className = 'episode-item';
                    item.dataset.streamUrl = epUrl;
                    item.innerHTML = `
                        <img src="${ep.info.movie_image}" onerror="this.onerror=null;this.style.display='none';">
                        <div>
                            <strong>${ep.episode_num}. ${ep.title}</strong>
                            <p>${ep.info.plot || ''}</p>
                        </div>
                    `;
                    episodeList.appendChild(item);
                });
            };

            seasonSelect.onchange = () => renderEpisodes(seasonSelect.value);
            renderEpisodes(Object.keys(seriesInfo.episodes)[0]);
        }
        showPage('series-details');
    } catch (error) {
        console.error('Error fetching series details:', error);
    }
}

async function renderM3USeriesDetailsPage(seriesName) {
    const seriesData = appData.series.find(s => s.name === seriesName);
    if (!seriesData) return;

    document.getElementById('series-details-backdrop').style.backgroundImage = `url('${seriesData.cover || ''}')`;
    document.getElementById('series-details-title').textContent = seriesData.name;
    document.getElementById('series-details-plot').textContent = '';

    const seasonSelect = document.getElementById('season-select');
    seasonSelect.innerHTML = '';
    
    const seasons = {};
    seriesData.episodes.forEach(ep => {
        if (!seasons[ep.season]) {
            seasons[ep.season] = [];
        }
        seasons[ep.season].push(ep);
    });

    Object.keys(seasons).sort((a, b) => a - b).forEach(seasonNum => {
        const option = document.createElement('option');
        option.value = seasonNum;
        option.textContent = `Temporada ${seasonNum}`;
        seasonSelect.appendChild(option);
    });

    const renderEpisodes = (seasonNum) => {
        const episodeList = document.getElementById('episode-list');
        episodeList.innerHTML = '';
        if (!seasons[seasonNum]) return;
        
        seasons[seasonNum].sort((a,b) => a.episode - b.episode).forEach(ep => {
            const item = document.createElement('div');
            item.className = 'episode-item';
            item.dataset.streamUrl = ep.url;
            item.innerHTML = `
                <img src="${ep.logo || seriesData.cover}" onerror="this.onerror=null;this.style.display='none';">
                <div>
                    <strong>Episódio ${ep.episode}</strong>
                    <p>${ep.title}</p>
                </div>
            `;
            episodeList.appendChild(item);
        });
    };

    seasonSelect.onchange = () => renderEpisodes(seasonSelect.value);
    if (Object.keys(seasons).length > 0) {
        renderEpisodes(Object.keys(seasons)[0]);
    }
    
    showPage('series-details');
}

function logout() {
    // Inicializa o Firebase se ainda não foi inicializado
    if (!firebase.apps.length) {
        firebase.initializeApp(firebaseConfig);
    } 
    firebase.auth().signOut().then(() => {
        sessionStorage.removeItem('user_playlist_data');
        window.location.href = 'login.html';
    }).catch(error => {
        console.error('Erro ao fazer logout:', error);
    });
}

function showPage(pageId) {
    if (pageId !== 'player' && pageId !== 'series-details') lastPageId = pageId;
    document.querySelectorAll('.page').forEach(page => page.classList.remove('active'));
    const newPage = document.getElementById(`page-${pageId}`);
    if (newPage) newPage.classList.add('active');

    const titleMap = {
        home: 'Início',
        series: 'Séries',
        movies: 'Filmes',
        iptv: 'Canais Ao Vivo',
        search: 'Pesquisar',
        profile: 'Perfil'
    };
    
    const mobilePageTitle = document.getElementById('mobile-page-title');
    if(mobilePageTitle) {
        mobilePageTitle.textContent = titleMap[pageId] || 'Início';
    }

    if (pageId !== 'player') {
        window.scrollTo(0, 0);
        document.querySelectorAll('.navbar-desktop .nav-links .nav-link').forEach(link => {
            link.querySelector('a').classList.toggle('active', link.dataset.page === pageId);
        });
        document.querySelectorAll('.navbar-mobile .nav-item').forEach(link => {
             link.classList.toggle('active', link.dataset.page === pageId)
        });
    }
}

function updateNavigation() {
    const navLinks = [...document.querySelectorAll('.navbar-desktop .nav-links .nav-link'), ...document.querySelectorAll('.navbar-mobile .nav-item')];
    navLinks.forEach(link => {
        const page = link.dataset.page;
        let shouldShow = true;
        link.style.display = shouldShow ? '' : 'none';
    });
}

function openPlayer(streamUrl) {
    const videoPlayer = document.querySelector('#page-player video');
    if (!streamUrl || !videoPlayer) return;

    if (hls) {
        hls.destroy();
        hls = null;
    }

    const isHls = streamUrl.includes('.m3u8');

    if (isHls && Hls.isSupported()) {
        console.log('Playing HLS stream:', streamUrl);
        hls = new Hls();
        hls.loadSource(streamUrl);
        hls.attachMedia(videoPlayer);
    } else {
        console.log('Playing direct stream:', streamUrl);
        videoPlayer.src = streamUrl;
    }
    
    videoPlayer.load();
    showPage('player');
    videoPlayer.play().catch(e => console.error("Erro ao tentar tocar o vídeo:", e));
}

function parseM3U(text) {
    const lines = text.split('\n');
    const result = { live: [], vod: [], series: [] };
    const seriesMap = new Map();
    let currentItem = {};

    for (const line of lines) {
        if (line.startsWith('#EXTINF:')) {
            const commaIndex = line.lastIndexOf(',');
            const title = commaIndex !== -1 ? line.substring(commaIndex + 1).trim() : '';
            const infoLine = commaIndex !== -1 ? line.substring(0, commaIndex) : line;

            const getAttribute = (attr, str) => {
                const match = str.match(new RegExp(`${attr}="([^"]*)"`));
                return match ? match[1].replace(/"/g, '') : null;
            };
            
            currentItem = {
                name: getAttribute('tvg-name', infoLine) || title,
                logo: getAttribute('tvg-logo', infoLine),
                group: getAttribute('group-title', infoLine) || 'Geral',
                raw_title: title
            };
        } else if (line.trim() && !line.startsWith('#')) {
            const url = line.trim();
            currentItem.url = url;
            if (!currentItem.name || !currentItem.url) {
                currentItem = {}; continue;
            }

            const seriesMatch = currentItem.raw_title.match(/^(.*?)(?:[ ._-]S(\d+)[ ._-]?E(\d+)|[ ._-](\d+)ª Temporada[ ._-]Episódio (\d+))/i);
            
            const isLive = url.includes('/live/') || !(/\.(mp4|mkv|avi|mov)$/i.test(url));
            
            if(seriesMatch) {
               const seriesName = seriesMatch[1].replace(/\[.*?\]/g, '').trim();
               const seasonNum = seriesMatch[2] || seriesMatch[4];
               const episodeNum = seriesMatch[3] || seriesMatch[5];

               if (!seriesMap.has(seriesName)) {
                   seriesMap.set(seriesName, {
                       name: seriesName,
                       series_id: seriesName,
                       cover: currentItem.logo,
                       episodes: []
                   });
               }
               
               seriesMap.get(seriesName).episodes.push({
                   title: currentItem.raw_title,
                   url: currentItem.url,
                   season: parseInt(seasonNum, 10),
                   episode: parseInt(episodeNum, 10),
                   logo: currentItem.logo
               });

            } else if (isLive) {
                result.live.push(currentItem);
            } else { 
                currentItem.stream_icon = currentItem.logo;
                currentItem.container_extension = url.split('.').pop();
                result.vod.push(currentItem);
            }
            currentItem = {};
        }
    }
    result.series = Array.from(seriesMap.values());
    return result;
}