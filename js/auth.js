
// --- Funções de Autenticação do Firebase ---

let auth;

/**
 * Inicializa o Firebase e configura o listener de estado de autenticação.
 */
function initializeApp() {
    try {
        firebase.initializeApp(firebaseConfig);
        auth = firebase.auth();
        handleAuthStateChange();
    } catch (error) {
        console.error("Erro ao inicializar o Firebase:", error);
        showFirebaseError("Erro de configuração. Verifique suas chaves do Firebase.");
    }
}

/**
 * Observador principal do estado de autenticação.
 * Decide o que fazer quando o usuário faz login, logout ou ainda não verificou o e-mail.
 */
function handleAuthStateChange() {
    auth.onAuthStateChanged(user => {
        const loader = document.getElementById('loader');
        if (user) {
            // Usuário está logado
            if (user.emailVerified) {
                // Email verificado, buscar dados da playlist
                loader.style.display = 'block';
                getUserData(user.uid).then(data => {
                    if (data) {
                        // Dados encontrados, salvar na sessão e ir para o app
                        sessionStorage.setItem('user_playlist_data', JSON.stringify(data));
                        window.location.href = isMobileDevice() ? 'mobile.html' : 'desktop.html';
                    } else {
                        // Nenhum dado, ir para a página de configuração
                        window.location.href = 'setup.html';
                    }
                });
            } else {
                // Email não verificado
                showFirebaseError('Por favor, verifique seu e-mail para continuar. Clique no link que enviamos para você.');
                loader.style.display = 'none';
            }
        } else {
            // Usuário está deslogado, não faz nada, permanece na página de login.
            console.log("Usuário deslogado.");
        }
    });
}

/**
 * Cria um novo usuário com e-mail e senha e envia um e-mail de verificação.
 * @param {string} email 
 * @param {string} password 
 */
function createUserWithEmail(email, password) {
    const loader = document.getElementById('loader');
    loader.style.display = 'block';
    showFirebaseError('');

    auth.createUserWithEmailAndPassword(email, password)
        .then(userCredential => {
            // Envia e-mail de verificação
            userCredential.user.sendEmailVerification();
            showFirebaseError('Cadastro realizado! Enviamos um link de confirmação para o seu e-mail.');
            loader.style.display = 'none';
        })
        .catch(error => {
            showFirebaseError(getFirebaseAuthErrorMessage(error.code));
            loader.style.display = 'none';
        });
}

/**
 * Autentica um usuário com e-mail e senha.
 * @param {string} email 
 * @param {string} password 
 */
function signInWithEmail(email, password) {
    const loader = document.getElementById('loader');
    loader.style.display = 'block';
    showFirebaseError('');

    auth.signInWithEmailAndPassword(email, password)
        .catch(error => {
            showFirebaseError(getFirebaseAuthErrorMessage(error.code));
            loader.style.display = 'none';
        });
}

/**
 * Inicia o fluxo de login com a conta do Google.
 */
function signInWithGoogle() {
    const loader = document.getElementById('loader');
    loader.style.display = 'block';
    showFirebaseError('');
    const provider = new firebase.auth.GoogleAuthProvider();

    auth.signInWithPopup(provider)
        .catch(error => {
            showFirebaseError(getFirebaseAuthErrorMessage(error.code));
            loader.style.display = 'none';
        });
}

/**
 * Desloga o usuário.
 */
function signOutUser() {
    auth.signOut();
}

/**
 * Traduz códigos de erro do Firebase Auth para mensagens amigáveis.
 * @param {string} errorCode O código de erro do Firebase.
 * @returns {string} A mensagem de erro traduzida.
 */
function getFirebaseAuthErrorMessage(errorCode) {
    switch (errorCode) {
        case 'auth/invalid-email':
            return 'Endereço de e-mail inválido.';
        case 'auth/user-disabled':
            return 'Este usuário foi desativado.';
        case 'auth/user-not-found':
            return 'Usuário não encontrado.';
        case 'auth/wrong-password':
            return 'Senha incorreta.';
        case 'auth/email-already-in-use':
            return 'Este e-mail já está em uso por outra conta.';
        case 'auth/weak-password':
            return 'A senha é muito fraca. Use pelo menos 6 caracteres.';
        case 'auth/popup-closed-by-user':
            return 'A janela de login foi fechada. Tente novamente.';
        default:
            return 'Ocorreu um erro. Tente novamente.';
    }
}

/**
 * Verifica se o dispositivo é móvel.
 * @returns {boolean}
 */
function isMobileDevice() {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
}
