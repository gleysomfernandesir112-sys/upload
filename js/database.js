
// --- Funções do Realtime Database ---

/**
 * Busca os dados do usuário no Realtime Database.
 * @param {string} userId O ID do usuário do Firebase.
 * @returns {Promise<object|null>} Os dados do usuário ou null se não houver.
 */
function getUserData(userId) {
    const db = firebase.database();
    const userRef = db.ref(`app_users/${userId}`);
    
    return userRef.get().then(snapshot => {
        if (snapshot.exists()) {
            return snapshot.val();
        } else {
            return null;
        }
    }).catch(error => {
        console.error("Erro ao buscar dados do usuário:", error);
        showFirebaseError("Erro ao buscar seus dados.");
        return null;
    });
}

/**
 * Salva os dados da playlist do usuário no Realtime Database.
 * @param {string} userId O ID do usuário do Firebase.
 * @param {object} data Os dados da playlist para salvar (ex: {type: 'xtream', url: '...', user: '...', pass: '...'}).
 * @returns {Promise<void>}
 */
function setUserData(userId, data) {
    const db = firebase.database();
    const userRef = db.ref(`app_users/${userId}`);
    
    return userRef.set(data).catch(error => {
        console.error("Erro ao salvar dados do usuário:", error);
        showFirebaseError("Erro ao salvar sua configuração.");
    });
}

// Função genérica para mostrar erros na tela. 
// As páginas (login.html, setup.html) devem ter um elemento com id="message".
function showFirebaseError(message) {
    const messageEl = document.getElementById('message');
    if (messageEl) {
        messageEl.textContent = message;
    }
    const loader = document.getElementById('loader');
    if(loader) loader.style.display = 'none';
}
