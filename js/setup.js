
document.addEventListener('DOMContentLoaded', () => {
    // Inicializa Firebase e verifica o estado de autenticação
    let currentUser = null;
    try {
        firebase.initializeApp(firebaseConfig);
        firebase.auth().onAuthStateChanged(user => {
            if (user) {
                currentUser = user;
            } else {
                // Se não houver usuário logado, volta para a página de login
                window.location.href = 'login.html';
            }
        });
    } catch (error) {
        showFirebaseError("Erro de configuração. Verifique suas chaves do Firebase.");
        return;
    }

    const xtreamForm = document.getElementById('xtream-form');
    const m3uForm = document.getElementById('m3u-form');
    const loginTabs = document.querySelectorAll('.login-tab');
    const loader = document.getElementById('loader');

    // Lógica para alternar abas
    loginTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            loginTabs.forEach(t => t.classList.remove('active'));
            document.querySelectorAll('.login-form').forEach(f => f.style.display = 'none');
            
            tab.classList.add('active');
            document.getElementById(tab.dataset.form + '-form').style.display = 'flex';
        });
    });
    // Ativa a primeira aba por padrão
    document.querySelector(".login-tab[data-form='xtream']").classList.add('active');


    // Salvar dados do formulário Xtream
    xtreamForm.addEventListener('submit', (e) => {
        e.preventDefault();
        if (!currentUser) return;

        loader.style.display = 'block';
        const playlistData = {
            type: 'xtream',
            url: document.getElementById('xtream-url').value.trim(),
            user: document.getElementById('xtream-user').value.trim(),
            pass: document.getElementById('xtream-pass').value.trim(),
        };

        setUserData(currentUser.uid, playlistData).then(() => {
            sessionStorage.setItem('user_playlist_data', JSON.stringify(playlistData));
            window.location.href = isMobileDevice() ? 'mobile.html' : 'desktop.html';
        });
    });

    // Salvar dados do formulário M3U
    m3uForm.addEventListener('submit', (e) => {
        e.preventDefault();
        if (!currentUser) return;

        loader.style.display = 'block';
        const playlistData = {
            type: 'm3u',
            url: document.getElementById('m3u-url-input').value.trim(),
        };

        setUserData(currentUser.uid, playlistData).then(() => {
            sessionStorage.setItem('user_playlist_data', JSON.stringify(playlistData));
            window.location.href = isMobileDevice() ? 'mobile.html' : 'desktop.html';
        });
    });
});

// Função auxiliar para detectar dispositivo móvel (pode ser movida para um arquivo utilitário)
function isMobileDevice() {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
}
