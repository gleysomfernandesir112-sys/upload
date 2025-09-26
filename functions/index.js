const functions = require("firebase-functions");
const admin = require("firebase-admin");

admin.initializeApp();

exports.createUser = functions.https.onCall(async (data, context) => {
  // Check if the user is an admin.
  if (!context.auth || !context.auth.token.admin) {
    throw new functions.https.HttpsError(
      "permission-denied",
      "Apenas administradores podem criar novos usuários."
    );
  }

  const { username, password, xtreamUrl, xtreamUser, xtreamPass } = data;

  if (!username || !password) {
    throw new functions.https.HttpsError(
      "invalid-argument",
      "Nome de usuário e senha são obrigatórios."
    );
  }

  const email = `${username}@appfast.cloud`;

  try {
    const userRecord = await admin.auth().createUser({
      email: email,
      password: password,
    });

    await admin.firestore().collection("users").doc(userRecord.uid).set({
      username: username,
      email: email,
      xtreamUrl: xtreamUrl,
      xtreamUser: xtreamUser,
      xtreamPass: xtreamPass,
    });

    return { result: `Usuário ${username} criado com sucesso.` };
  } catch (error) {
    console.error("Erro ao criar novo usuário:", error);
    if (error.code === 'auth/email-already-exists') {
        throw new functions.https.HttpsError('already-exists', 'Este nome de usuário já está em uso.');
    }
    throw new functions.https.HttpsError("internal", error.message);
  }
});
