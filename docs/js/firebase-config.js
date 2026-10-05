/* ============================================================================
   firebase-config.js — identificação do projeto Firebase

   ESTE ARQUIVO É PÚBLICO DE PROPÓSITO.

   Estes valores viajam dentro do JavaScript que roda no navegador de cada
   usuário: qualquer pessoa pode lê-los vendo o código-fonte da página. Não há
   como esconder, e não é necessário.

   A `apiKey` do Firebase NÃO é uma senha. Ela apenas identifica qual projeto
   o navegador está chamando. Quem realmente protege os dados são:

     1. As REGRAS DO FIRESTORE (docs/firestore.rules), aplicadas no servidor
        do Google: decidem quem pode ler e escrever cada coisa.
     2. Os DOMÍNIOS AUTORIZADOS, configurados no console do Firebase: só os
        endereços liberados conseguem fazer login.

   É o oposto da chave de conta de serviço, que dá acesso amplo e por isso
   nunca entra no repositório.

   Projeto: ipetechcerne (IpêTech Paraíso)
   ========================================================================== */

window.FIREBASE_CONFIG = {
  apiKey: "AIzaSyCtZJmH8v9NKqMLsCkrtFy35_LvBiNx3qc",
  authDomain: "ipetechcerne.firebaseapp.com",
  projectId: "ipetechcerne",
  storageBucket: "ipetechcerne.firebasestorage.app",
  messagingSenderId: "147937973937",
  appId: "1:147937973937:web:8c97d55b428765d9a3f490",
};

/* Versão do SDK do Firebase carregada do CDN do Google (gstatic).
   Mantida em um lugar só para facilitar a atualização. */
window.FIREBASE_SDK_VERSAO = "12.4.0";

/* Sinaliza ao app.js que os dados vêm da nuvem, e que ele NÃO deve iniciar
   sozinho: quem dá a partida é o nuvem.js, depois do login. */
window.CERNE_MODO_NUVEM = true;

/* Bucket onde os anexos serão guardados.
   Por padrão o Firebase sugere o bucket dele (`...firebasestorage.app`).
   O parque já tem um bucket próprio em São Paulo (`ipetechcerne`), que é o
   preferido — mas ele precisa ser vinculado ao Firebase Storage antes de ser
   usado pelo navegador. Enquanto isso não for resolvido, este valor manda. */
window.CERNE_BUCKET_ANEXOS = window.FIREBASE_CONFIG.storageBucket;
