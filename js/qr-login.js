
let qrCodeListener = null;
let qrCodeId = null;
let qrCodeTimeout = null;

/**
 * Gera um UUID v4 simples.
 * @returns {string} O UUID gerado.
 */
function generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

/**
 * Gera um QR code, salva no Firebase e escuta por aprovação.
 */
function generateAndListenForQRCode() {
    // Limpa qualquer sessão de QR code anterior
    cancelQRCode();

    const qrElement = document.getElementById('qrcode');
    const qrMessage = document.getElementById('qr-message');
    qrElement.innerHTML = ''; // Limpa o QR code anterior
    qrMessage.textContent = 'Aponte a câmera do seu celular para escanear o código.';

    qrCodeId = generateUUID();
    const db = firebase.database();
    const qrRef = db.ref(`qrcodes/${qrCodeId}`);

    // Gera o QR code com o ID
    new QRCode(qrElement, {
        text: qrCodeId,
        width: 224, // Tamanho ajustado para o padding
        height: 224,
        colorDark : "#000000",
        colorLight : "#ffffff",
        correctLevel : QRCode.CorrectLevel.H
    });

    // Define o listener
    qrCodeListener = qrRef.on('value', (snapshot) => {
        if (snapshot.exists()) {
            const data = snapshot.val();
            if (data.status === 'APPROVED' && data.customToken) {
                // QR Code aprovado, tenta fazer login
                firebase.auth().signInWithCustomToken(data.customToken)
                    .then(() => {
                        // O onAuthStateChanged em auth.js cuidará do redirecionamento
                        cancelQRCode(); // Limpa a sessão do QR code
                    })
                    .catch((error) => {
                        console.error("Erro ao logar com custom token:", error);
                        showFirebaseError("Erro ao validar o QR code.");
                        cancelQRCode();
                    });
            }
        }
    });

    // Define o dado inicial no Firebase
    qrRef.set({ 
        status: 'PENDING',
        createdAt: firebase.database.ServerValue.TIMESTAMP
    });

    // Define um timeout para expirar o QR code
    qrCodeTimeout = setTimeout(() => {
        qrMessage.textContent = 'QR code expirado. Por favor, gere um novo.';
        qrElement.innerHTML = ''; // Limpa a imagem do QR code
        cancelQRCode();
    }, 120000); // 2 minutos
}

/**
 * Cancela a sessão de login por QR code atual.
 */
function cancelQRCode() {
    if (qrCodeId) {
        const db = firebase.database();
        const qrRef = db.ref(`qrcodes/${qrCodeId}`);
        if (qrCodeListener) {
            qrRef.off('value', qrCodeListener);
        }
        qrRef.remove(); // Remove o registro do Firebase
    }
    if (qrCodeTimeout) {
        clearTimeout(qrCodeTimeout);
    }
    qrCodeListener = null;
    qrCodeId = null;
    qrCodeTimeout = null;
}
