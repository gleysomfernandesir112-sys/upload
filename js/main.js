document.addEventListener('DOMContentLoaded', async () => {
    // 1. Obter dados da sessão e definir usuário ativo
    const playlistDataString = sessionStorage.getItem('user_playlist_data');
    if (!playlistDataString) {
        window.location.href = 'login.html';
        return;
    }
    activeUser = JSON.parse(playlistDataString);

    // Adicionar um loader global simples ao corpo
    const globalLoader = document.createElement('div');
    globalLoader.innerHTML = '<div style="position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); z-index: 1000;" class="loader"></div>';
    document.body.appendChild(globalLoader);

    // 2. Buscar dados da playlist (Xtream ou M3U)
    try {
        if (activeUser.type === 'xtream') {
            const [liveStreams, vodStreams, series] = await Promise.all([
                fetchXtreamData(activeUser.url, activeUser.user, activeUser.pass, 'get_live_streams'),
                fetchXtreamData(activeUser.url, activeUser.user, activeUser.pass, 'get_vod_streams'),
                fetchXtreamData(activeUser.url, activeUser.user, activeUser.pass, 'get_series'),
            ]);
            appData = { liveStreams, vodStreams, series };
        } else if (activeUser.type === 'm3u') {
            const response = await fetchAPI(activeUser.url);
            const m3uText = await response.text();
            const content = parseM3U(m3uText);
            appData = { liveStreams: content.live, vodStreams: content.vod, series: content.series };
        }

        // 3. Renderizar a aplicação
        renderAllPages();
        showPage('home');

    } catch (error) {
        console.error("Erro ao carregar dados da lista:", error);
        alert("Falha ao carregar os dados da sua lista. Verifique a configuração.");
        window.location.href = 'setup.html';
    } finally {
        // Remover o loader global
        document.body.removeChild(globalLoader);
    }

    // 4. Configurar event listeners restantes
    const searchInput = document.getElementById('search-input');
    if (searchInput) {
        searchInput.addEventListener('input', () => {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => {
                performSearch(searchInput.value);
            }, 300);
        });
    }

    const desktopLinks = document.querySelectorAll('.navbar-desktop .nav-links .nav-link');
    const mobileLinks = document.querySelectorAll('.navbar-mobile .nav-item');
    [...desktopLinks, ...mobileLinks].forEach(link => {
        const pageId = link.dataset.page;
        if (!pageId) return;
        const target = link.tagName === 'LI' ? link.querySelector('a') : link;
        target.addEventListener('click', (e) => {
            e.preventDefault();
            showPage(pageId);
        });
    });

    const mainContent = document.querySelector('.main-content');
    if (mainContent) {
        mainContent.addEventListener('click', (event) => {
            const card = event.target.closest('.media-card, .episode-item');
            if (!card) return;
            
            if (card.dataset.seriesId) {
                if (activeUser.type === 'xtream') {
                    renderSeriesDetailsPage(card.dataset.seriesId);
                } else {
                    renderM3USeriesDetailsPage(card.dataset.seriesId);
                }
            } else if (card.dataset.streamUrl) {
                openPlayer(card.dataset.streamUrl);
            }
        });
    }

    const backFromPlayerBtn = document.querySelector('.back-from-player');
    if (backFromPlayerBtn) {
        backFromPlayerBtn.addEventListener('click', () => {
            const videoPlayer = document.querySelector('#page-player video');
            const videoSource = videoPlayer.querySelector('source');
            const isSeriesDetailsActive = document.getElementById('page-series-details').classList.contains('active');
            
            showPage(isSeriesDetailsActive ? 'series-details' : lastPageId);
            
            videoPlayer.pause();
            videoPlayer.removeAttribute('src');
            if(videoSource) videoSource.setAttribute('src', '');

            if (hls) {
                hls.destroy();
                hls = null;
            }
            videoPlayer.load();
        });
    }

    const logoutBtn = document.getElementById('logout-btn');
    if(logoutBtn) logoutBtn.addEventListener('click', logout);

    const mobileLogoutBtn = document.getElementById('mobile-logout-btn');
    if(mobileLogoutBtn) mobileLogoutBtn.addEventListener('click', logout);
});