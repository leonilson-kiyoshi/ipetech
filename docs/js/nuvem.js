/* ============================================================================
   nuvem.js — guarda o acompanhamento NO FIRESTORE, com login por pessoa

   É o par do store.js (que guarda no navegador). Os dois usam a MESMA regra
   de prontidão, que vive em regras.js.

   COMO FUNCIONA

   1. Carrega o SDK do Firebase e espera o login (conta Google).
   2. Descobre o papel de quem entrou lendo `usuarios/{uid}`.
   3. Assina as coleções do Firestore com onSnapshot e mantém um ESPELHO em
      memória no mesmo formato que o store.js usa.
   4. Publica `window.Store` com a mesma interface do modo local.

   É o passo 3 que evita reescrever as telas: o app.js continua lendo os
   dados de forma síncrona, do espelho. Quando algo muda — por você ou por
   outra pessoa da equipe — o onSnapshot atualiza o espelho e a tela é
   redesenhada sozinha.

   As gravações aparecem na hora, antes de o servidor confirmar, porque o
   Firestore aplica a mudança no cache local primeiro. Se a internet cair, o
   registro fica guardado e sobe quando a conexão voltar.

   Este arquivo é um módulo (type="module"): ele carrega depois dos scripts
   comuns e é ele quem dá a partida no app, após o login.
   ========================================================================== */

import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.4.0/firebase-app.js';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  setPersistence,
  browserLocalPersistence
} from 'https://www.gstatic.com/firebasejs/12.4.0/firebase-auth.js';
import {
  getFirestore,
  collection,
  doc,
  onSnapshot,
  setDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  getDoc,
  serverTimestamp,
  enableIndexedDbPersistence
} from 'https://www.gstatic.com/firebasejs/12.4.0/firebase-firestore.js';
import {
  getStorage,
  ref as refArmazenamento,
  uploadBytesResumable,
  getDownloadURL,
  deleteObject
} from 'https://www.gstatic.com/firebasejs/12.4.0/firebase-storage.js';

/* ------------------------------------------------- conferência de dependências

   Este módulo depende de três scripts comuns que precisam ter rodado antes.
   Se algum faltar, a falha aparecia disfarçada — por exemplo, `Regras` vazio
   produz "Cannot read properties of undefined (reading 'calcularProntidao')",
   que não diz nada sobre a causa real.

   Então conferimos na entrada e mostramos na tela o que está faltando.
-------------------------------------------------------------------------- */

function falhaFatal(titulo, detalhe) {
  console.error(titulo, detalhe);
  const alvo = document.getElementById('portao') || document.body;
  alvo.hidden = false;
  alvo.innerHTML =
    '<div class="portao-caixa" style="text-align:left">' +
    '<div class="portao-aviso"><strong>' + titulo + '</strong></div>' +
    '<p class="portao-texto">' + detalhe + '</p>' +
    '</div>';
  throw new Error(titulo + ' ' + detalhe);
}

(function conferirDependencias() {
  const faltando = [];
  if (!window.CERNE_CATALOGO) faltando.push('dados-cerne.js (catálogo CERNE)');
  if (!window.Regras) faltando.push('regras.js (regra de prontidão)');
  if (!window.FIREBASE_CONFIG) faltando.push('firebase-config.js (projeto Firebase)');
  if (!window.AppCerne) faltando.push('app.js (as telas)');

  if (faltando.length) {
    falhaFatal(
      'Arquivos não carregaram',
      'Faltou: ' + faltando.join(', ') +
      '. Verifique a ordem das tags &lt;script&gt; no index.html e se há erro ' +
      'anterior no console (F12).'
    );
  }
})();

const Regras = window.Regras;
const CONFIG = window.FIREBASE_CONFIG;

/* Coleções espelhadas como lista. A chave é o nome usado no estado e também
   o nome da coleção no Firestore — mantidos iguais de propósito. */
const COLECOES = ['evidencias', 'medicoes', 'revisoes', 'planos', 'empreendimentos'];

/* Coleções novas da Fase 2. Ficam à parte porque são OPCIONAIS: enquanto as
   regras novas não forem publicadas no console, a leitura é NEGADA, e isso não
   pode derrubar as telas antigas. O erro de permissão é engolido e a coleção
   segue vazia (degradação graciosa). */
const COLECOES_NOVAS = ['atividades', 'historico'];

/* ----------------------------------------------------------------- estado */

let estado = Regras.estadoInicial();
let usuario = null;        // usuário autenticado (Firebase)
let papel = 'nenhum';      // gestor | equipe | consulta | nenhum

// "Ver o sistema como": o gestor pode rebaixar o próprio papel NA INTERFACE
// para conferir o que a equipe e a auditoria enxergam. É só simulação, e de
// propósito só existe em memória: recarregar a página volta ao papel real,
// então não há como ficar preso nela.
//
// IMPORTANTE: isto NÃO reduz o poder de gravar no servidor. As regras do
// Firestore continuam vendo o gestor como gestor. Serve para testar a
// INTERFACE, não as permissões — para testar permissão de verdade é preciso
// entrar com outra conta.
let papelSimulado = null;  // null | equipe | consulta
let ouvintes = [];
let desinscrever = [];
let carregadas = new Set();
let erroNuvem = null;

const app = initializeApp(CONFIG);
const auth = getAuth(app);
const db = getFirestore(app);
const armazenamento = getStorage(app);

/* ====================================================== anexos (arquivos)

   Limites conferidos aqui E nas regras do Storage. A conferência no
   navegador existe para dar mensagem clara antes de gastar a internet do
   usuário; a que vale de verdade é a do servidor, porque esta pode ser
   burlada.
   ===================================================================== */

const TAMANHO_MAXIMO = 20 * 1024 * 1024; // 20 MB

const EXTENSOES_ACEITAS = [
  '.pdf', '.doc', '.docx', '.odt', '.rtf', '.txt',
  '.xls', '.xlsx', '.ods', '.csv',
  '.ppt', '.pptx', '.odp',
  '.png', '.jpg', '.jpeg', '.gif', '.webp',
  '.zip',
  '.mp4', '.mp3', '.m4a'
];

/** Tira acentos, espaços e qualquer coisa que atrapalhe em nome de arquivo.
 *  O nome vai para o caminho no bucket, então precisa ser previsível. */
function nomeSeguro(nome) {
  const limpo = String(nome || 'arquivo').replace(/^.*[\\/]/, '');
  const ponto = limpo.lastIndexOf('.');
  const base = ponto > 0 ? limpo.slice(0, ponto) : limpo;
  const ext = ponto > 0 ? limpo.slice(ponto).toLowerCase() : '';
  const baseLimpa = base
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'arquivo';
  return baseLimpa + ext;
}

function extensaoDe(nome) {
  const limpo = String(nome || '').toLowerCase();
  const ponto = limpo.lastIndexOf('.');
  return ponto > 0 ? limpo.slice(ponto) : '';
}

/** Confere o arquivo antes de enviar. Devolve a mensagem de erro, ou null. */
function conferirArquivo(arquivo) {
  if (!arquivo) return 'Nenhum arquivo escolhido.';
  if (arquivo.size === 0) return 'O arquivo está vazio.';
  if (arquivo.size > TAMANHO_MAXIMO) {
    const mb = (arquivo.size / 1024 / 1024).toFixed(1);
    return 'O arquivo tem ' + mb + ' MB e o limite é 20 MB. ' +
      'Compacte o arquivo ou registre um link para ele.';
  }
  const ext = extensaoDe(arquivo.name);
  if (EXTENSOES_ACEITAS.indexOf(ext) === -1) {
    return 'Tipo de arquivo não aceito (' + (ext || 'sem extensão') + '). ' +
      'Aceitos: PDF, Word, Excel, PowerPoint, imagens, ZIP, áudio e vídeo.';
  }
  return null;
}

/** Monta o caminho do anexo no bucket.
 *
 *  A estrutura é a mesma do sistema Django, de propósito: quem abrir o
 *  bucket encontra os documentos na ordem em que a auditoria pede.
 *
 *      evidencias/CERNE1/1.1.1/2026/lista-de-presenca.pdf
 */
function caminhoDoAnexo(codigoPratica, dataReferencia, nomeArquivo) {
  const item = Regras.buscarPratica(codigoPratica);
  const nivel = item ? 'CERNE' + item.nivel.numero : 'sem-nivel';
  const ano = String(dataReferencia || '').slice(0, 4) ||
    String(new Date().getFullYear());
  // Prefixo de tempo evita que dois arquivos de mesmo nome se sobreponham.
  const marca = Date.now().toString(36);
  return (
    'evidencias/' + nivel + '/' + codigoPratica + '/' + ano + '/' +
    marca + '-' + nomeSeguro(nomeArquivo)
  );
}

/** Caminho do anexo de um documento do empreendimento (Fase 2).
 *
 *      empreendimentos/IPE-abc123/2026/pitch-de-selecao.pdf
 *
 *  Estrutura espelhada nas regras do Storage (empreendimentos/{id}/{ano}/
 *  {arquivo}), com as mesmas validações de tamanho e tipo das evidências. */
function caminhoDoDocumentoEmpreendimento(idEmpreendimento, dataReferencia, nomeArquivo) {
  const ano = String(dataReferencia || '').slice(0, 4) ||
    String(new Date().getFullYear());
  const marca = Date.now().toString(36);
  return (
    'empreendimentos/' + idEmpreendimento + '/' + ano + '/' +
    marca + '-' + nomeSeguro(nomeArquivo)
  );
}

/** Núcleo do envio: sobe o arquivo para um caminho do bucket e devolve os
 *  dados do anexo. Compartilhado pelos dois destinos (evidências e documentos
 *  de empreendimento) para a lógica de progresso e de travamento ser uma só. */
async function enviarParaCaminho(caminho, arquivo, aoProgresso, metadados) {
  const problema = conferirArquivo(arquivo);
  if (problema) throw new Error(problema);

  const alvo = refArmazenamento(armazenamento, caminho);
  const tarefa = uploadBytesResumable(alvo, arquivo, {
    contentType: arquivo.type || 'application/octet-stream',
    customMetadata: metadados || {}
  });

  // Vigia de travamento.
  //
  // Quando o Storage não está ativado no projeto, o balde não existe e o SDK
  // fica tentando por minutos, sem erro e sem progresso: a tela mostra
  // "Enviando... 0%" para sempre. Isso é péssimo de diagnosticar.
  //
  // Então, se os bytes enviados não avançarem por 25 segundos, cancelamos e
  // explicamos a causa provável em vez de deixar a pessoa esperando.
  await new Promise((resolve, reject) => {
    let ultimoTotal = -1;
    let paradoDesde = Date.now();

    const vigia = setInterval(() => {
      if (Date.now() - paradoDesde < 25000) return;
      clearInterval(vigia);
      try { tarefa.cancel(); } catch (e) { /* já encerrada */ }
      reject(
        new Error(
          'O envio não saiu do lugar. A causa mais comum é o armazenamento ' +
          'de arquivos ainda não estar ativado no projeto Firebase.\n\n' +
          'Confira em: Firebase → Bancos de dados e armazenamento → Storage. ' +
          'Se aparecer o botão "Começar", é porque ainda não foi ativado.\n\n' +
          'Enquanto isso, você pode registrar a evidência com um link em vez ' +
          'de arquivo.'
        )
      );
    }, 2000);

    tarefa.on(
      'state_changed',
      (estadoEnvio) => {
        if (estadoEnvio.bytesTransferred !== ultimoTotal) {
          ultimoTotal = estadoEnvio.bytesTransferred;
          paradoDesde = Date.now();
        }
        if (typeof aoProgresso === 'function' && estadoEnvio.totalBytes) {
          aoProgresso(
            Math.round((100 * estadoEnvio.bytesTransferred) / estadoEnvio.totalBytes)
          );
        }
      },
      (erro) => { clearInterval(vigia); reject(erro); },
      () => { clearInterval(vigia); resolve(); }
    );
  });

  const url = await getDownloadURL(alvo);
  return {
    caminho: caminho,
    url: url,
    nome: arquivo.name,
    tamanho: arquivo.size,
    tipo: arquivo.type || ''
  };
}

/** Envia o arquivo de uma EVIDÊNCIA e devolve os dados para guardar junto dela.
 *  `aoProgresso` recebe o percentual (0 a 100), para a tela dar sinal de vida. */
async function enviarArquivo(codigoPratica, dataReferencia, arquivo, aoProgresso) {
  const caminho = caminhoDoAnexo(codigoPratica, dataReferencia, arquivo.name);
  return enviarParaCaminho(caminho, arquivo, aoProgresso, { pratica: codigoPratica });
}

/** Envia o arquivo de um DOCUMENTO de empreendimento (Fase 2) e devolve os
 *  dados do anexo no formato {url, nome, path, tamanho, tipo}. */
async function enviarArquivoEmpreendimento(idEmpreendimento, dataReferencia, arquivo, aoProgresso) {
  const caminho = caminhoDoDocumentoEmpreendimento(idEmpreendimento, dataReferencia, arquivo.name);
  const anexo = await enviarParaCaminho(
    caminho, arquivo, aoProgresso, { empreendimento: idEmpreendimento }
  );
  return {
    url: anexo.url,
    nome: anexo.nome,
    path: anexo.caminho,
    tamanho: anexo.tamanho,
    tipo: anexo.tipo
  };
}

/** Apaga o arquivo do bucket. Usado quando a evidência é removida, para o
 *  parque não pagar armazenamento de coisa que ninguém mais vê. */
async function removerArquivo(caminho) {
  if (!caminho) return;
  try {
    await deleteObject(refArmazenamento(armazenamento, caminho));
  } catch (erro) {
    // Arquivo já ausente não é problema: o objetivo era não existir mais.
    if (String(erro && erro.code) !== 'storage/object-not-found') {
      console.warn('Não foi possível apagar o arquivo:', caminho, erro);
    }
  }
}

/* ----------------------------------------------------------- utilidades */

/** Converte valores do Firestore para o formato que as telas esperam.
 *  Datas vêm como Timestamp; o app.js trabalha com texto ISO. */
function converter(valor) {
  if (valor === null || valor === undefined) return valor;
  if (typeof valor.toDate === 'function') return valor.toDate().toISOString();
  if (Array.isArray(valor)) return valor.map(converter);
  if (typeof valor === 'object') {
    const saida = {};
    Object.keys(valor).forEach((k) => { saida[k] = converter(valor[k]); });
    return saida;
  }
  return valor;
}

function daDoc(documento) {
  return Object.assign({ id: documento.id }, converter(documento.data()));
}

function avisarOuvintes() {
  ouvintes.forEach((fn) => {
    try { fn(estado); } catch (e) { console.error(e); }
  });
}

function redesenhar() {
  avisarOuvintes();
  if (window.AppCerne && typeof window.AppCerne.renderizar === 'function') {
    window.AppCerne.renderizar();
  }
}

function aviso(mensagem) {
  if (window.AppCerne && typeof window.AppCerne.avisar === 'function') {
    window.AppCerne.avisar(mensagem);
  }
}

/** Mostra o erro de gravação em vez de deixar o registro sumir em silêncio. */
function tratarErro(acao, erro) {
  console.error(acao, erro);
  erroNuvem = erro;
  const negado = String(erro && erro.code) === 'permission-denied';
  aviso(
    negado
      ? 'Sem permissão para ' + acao + '. Seu perfil permite apenas consulta.'
      : 'Falha ao ' + acao + '. Verifique a conexão; o registro será reenviado.'
  );
}

/* ------------------------------------------------------- papel do usuário */

/** Chave da ficha de acesso: o e-mail em minúsculas.
 *  A mesma chave usada nas regras do Firestore e do Storage. */
function chaveDoEmail(email) {
  return String(email || '').trim().toLowerCase();
}

async function descobrirPapel(u) {
  // O gestor raiz está fixado nas regras do Firestore. Reproduzimos a mesma
  // verificação aqui só para a interface já liberar os botões; quem decide
  // de fato é o servidor.
  try {
    const ficha = await getDoc(doc(db, 'usuarios', chaveDoEmail(u.email)));
    if (ficha.exists()) {
      const dados = ficha.data();
      return dados.papel || 'consulta';
    }
  } catch (erro) {
    console.warn('Não foi possível ler a ficha do usuário:', erro);
  }
  return 'nenhum';
}

function ehGestorRaiz(u) {
  return !!u && u.emailVerified && u.email === 'leonilsonk@gmail.com';
}

/** Papel que o servidor reconhece. É o que vale para segurança. */
function papelReal() {
  return ehGestorRaiz(usuario) || papel === 'gestor' ? 'gestor' : papel;
}

/** Papel que a interface deve obedecer: o real, ou o simulado pelo gestor. */
function papelEmUso() {
  return papelSimulado || papelReal();
}

// Entrar no sistema depende do papel REAL: simular "consulta" não pode
// derrubar ninguém para a tela de "acesso não liberado".
function autorizado() {
  return papelReal() !== 'nenhum';
}

function podeRegistrar() {
  const p = papelEmUso();
  return p === 'gestor' || p === 'equipe';
}

function ehGestor() {
  return papelEmUso() === 'gestor';
}

/** Troca o papel simulado. Só o gestor de verdade pode, e só para baixo:
 *  isto é ferramenta de conferência, não caminho para ganhar permissão. */
function simularPapel(novo) {
  if (papelReal() !== 'gestor') return false;
  papelSimulado = novo === 'equipe' || novo === 'consulta' ? novo : null;
  mostrarUsuario();
  return true;
}

/* --------------------------------------------------------- assinar dados */

function pararAssinaturas() {
  desinscrever.forEach((fn) => { try { fn(); } catch (e) { /* ignora */ } });
  desinscrever = [];
  carregadas = new Set();
}

/** Liga os ouvintes do Firestore e devolve uma promessa que resolve quando
 *  a primeira carga de todas as coleções chegou. */
function assinarDados() {
  return new Promise((resolve) => {
    const total = COLECOES.length + 2; // + config/parque + praticas

    function marcar(nome) {
      carregadas.add(nome);
      if (carregadas.size >= total) resolve();
    }

    // dados do parque
    desinscrever.push(
      onSnapshot(
        doc(db, 'config', 'parque'),
        (instantaneo) => {
          if (instantaneo.exists()) {
            Object.assign(estado.mecanismo, converter(instantaneo.data()));
          }
          marcar('config');
          redesenhar();
        },
        (erro) => { tratarErro('ler os dados do parque', erro); marcar('config'); }
      )
    );

    // situação das práticas (id do documento = código da prática)
    desinscrever.push(
      onSnapshot(
        collection(db, 'praticas'),
        (instantaneo) => {
          const mapa = {};
          instantaneo.forEach((documento) => {
            if (!Regras.buscarPratica(documento.id)) return; // fora do catálogo
            mapa[documento.id] = converter(documento.data());
          });
          estado.praticas = mapa;
          marcar('praticas');
          redesenhar();
        },
        (erro) => { tratarErro('ler as práticas', erro); marcar('praticas'); }
      )
    );

    // coleções em lista
    COLECOES.forEach((nome) => {
      desinscrever.push(
        onSnapshot(
          collection(db, nome),
          (instantaneo) => {
            estado[nome] = instantaneo.docs.map(daDoc);
            marcar(nome);
            redesenhar();
          },
          (erro) => { tratarErro('ler ' + nome, erro); marcar(nome); }
        )
      );
    });

    // coleções novas (Fase 2): NÃO entram na contagem do carregamento inicial
    // e o erro de permissão é silenciado. Assim, se as regras novas ainda não
    // foram publicadas, as telas antigas continuam funcionando normalmente.
    COLECOES_NOVAS.forEach((nome) => {
      desinscrever.push(
        onSnapshot(
          collection(db, nome),
          (instantaneo) => {
            estado[nome] = instantaneo.docs.map(daDoc);
            redesenhar();
          },
          (erro) => {
            if (String(erro && erro.code) === 'permission-denied') {
              console.warn(
                'Coleção "' + nome + '" ainda sem permissão. Publique as ' +
                'regras novas do Firestore para habilitá-la.'
              );
            } else {
              console.warn('Não foi possível ler ' + nome + ':', erro);
            }
          }
        )
      );
    });
  });
}

/* ------------------------------------------------------------- gravações */

function salvarMecanismo(dados) {
  Object.keys(dados).forEach((k) => { estado.mecanismo[k] = dados[k]; });
  setDoc(
    doc(db, 'config', 'parque'),
    Object.assign({}, estado.mecanismo, { atualizado_em: serverTimestamp() }),
    { merge: true }
  ).catch((e) => tratarErro('salvar os dados do parque', e));
}

function salvarStatus(codigo, dados) {
  if (!Regras.buscarPratica(codigo)) return;
  const atual = Regras.statusDe(estado, codigo);
  const continua =
    dados.continua !== undefined ? !!dados.continua : !!atual.continua;
  // Prática contínua não usa percentual: o campo fica escondido na interface e
  // o dado gravado recebe 100. Continuamos SEMPRE enviando percentual (0..100)
  // e situacao válidos, como a regra JÁ PUBLICADA de /praticas exige.
  let percentual =
    dados.percentual !== undefined
      ? Math.max(0, Math.min(100, Number(dados.percentual) || 0))
      : atual.percentual;
  if (continua) percentual = 100;
  const novo = {
    situacao: dados.situacao !== undefined ? dados.situacao : atual.situacao,
    percentual: percentual,
    observacoes:
      dados.observacoes !== undefined ? dados.observacoes : atual.observacoes,
    // Campo aditivo da Fase 2. Vai junto da situação da prática; o bloco de
    // regras existente de /praticas permite campos extras, então não muda.
    responsavel_pendencia:
      dados.responsavel_pendencia !== undefined
        ? dados.responsavel_pendencia
        : (atual.responsavel_pendencia || ''),
    // Marcador aditivo de "prática contínua" (booleano). Também um campo extra
    // para as regras de /praticas, que só validam percentual/situacao/autoria.
    continua: continua,
    atualizado_em: serverTimestamp(),
    atualizado_por: usuario ? usuario.uid : null,
    atualizado_por_nome: usuario ? (usuario.displayName || usuario.email) : ''
  };
  setDoc(doc(db, 'praticas', codigo), novo, { merge: true })
    .catch((e) => tratarErro('salvar a situação da prática', e));
}

function criarEm(lista, registro) {
  // Códigos de leitura humana, gerados por melhor esforço a partir do espelho
  // em memória (regra única em regras.js). Na nuvem, duas criações simultâneas
  // podem colidir; o campo é editável para corrigir, e nenhum cálculo depende
  // dele. Um valor já presente no registro é respeitado.
  const extra = {
    criado_em: serverTimestamp(),
    criado_por: usuario ? usuario.uid : null,
    criado_por_nome: usuario ? (usuario.displayName || usuario.email) : ''
  };
  if (lista === 'empreendimentos' && !registro.codigo) {
    extra.codigo = Regras.proximoCodigoEmpreendimento(estado.empreendimentos);
  }
  if (lista === 'evidencias' && !registro.protocolo) {
    extra.protocolo = Regras.proximoProtocoloEvidencia(
      estado.evidencias, registro.data_referencia
    );
  }
  if (lista === 'atividades' && !registro.protocolo) {
    extra.protocolo = Regras.proximoProtocoloAtividade(
      estado.atividades, registro.data_realizacao
    );
  }
  const completo = Object.assign({}, registro, extra);
  addDoc(collection(db, lista), completo)
    .then((ref) => registrarHistorico(lista, ref.id, 'criar', resumoHistorico(lista, completo)))
    .catch((e) => tratarErro('registrar em ' + lista, e));
  return completo;
}

function atualizarEm(lista, id, dados) {
  const alvo = (estado[lista] || []).filter((r) => r.id === id)[0];
  updateDoc(doc(db, lista, id), dados)
    .then(() => registrarHistorico(lista, id, 'editar', resumoHistorico(lista, alvo || dados)))
    .catch((e) => tratarErro('atualizar ' + lista, e));
  return dados;
}

function removerEm(lista, id) {
  const alvo = (estado[lista] || []).filter((r) => r.id === id)[0];
  // Ao remover uma evidência, o arquivo anexado também sai do bucket.
  // Sem isso o parque continuaria pagando armazenamento de arquivo órfão,
  // que ninguém mais alcança pelo sistema.
  if (lista === 'evidencias' && alvo && alvo.arquivo && alvo.arquivo.caminho) {
    removerArquivo(alvo.arquivo.caminho);
  }
  deleteDoc(doc(db, lista, id))
    .then(() => registrarHistorico(lista, id, 'remover', resumoHistorico(lista, alvo)))
    .catch((e) => tratarErro('remover de ' + lista, e));
}

/* --------------------------------------------------------------- histórico

   Trilha append-only das alterações de acompanhamento (Fase 2). Gravada de
   forma central aqui, a cada criar/editar/remover, para que uma tela só de
   leitura possa mostrar quem mudou o quê e quando.

   É sempre MELHOR ESFORÇO: se as regras do /historico ainda não foram
   publicadas, a gravação é negada — e isso NÃO pode interromper o fluxo
   principal, porque o registro de acompanhamento em si já foi salvo. */

const ROTULO_COLECAO = {
  evidencias: 'Evidência', medicoes: 'Medição', revisoes: 'Revisão crítica',
  planos: 'Plano de ação', empreendimentos: 'Empreendimento', atividades: 'Atividade'
};

/** Texto curto que descreve o registro, para a linha do histórico. */
function resumoHistorico(lista, registro) {
  const rotulo = ROTULO_COLECAO[lista] || lista;
  const titulo = registro &&
    (registro.titulo || registro.nome || registro.descricao || '');
  const protocolo = registro && (registro.protocolo || registro.codigo || '');
  return (
    rotulo +
    (titulo ? ' — ' + String(titulo).slice(0, 80) : '') +
    (protocolo ? ' (' + protocolo + ')' : '')
  );
}

function registrarHistorico(colecao, registroId, acao, resumo) {
  if (!usuario) return;
  addDoc(collection(db, 'historico'), {
    colecao: colecao,
    registro_id: registroId || '',
    acao: acao,
    resumo: resumo || '',
    quando: serverTimestamp(),
    quem: usuario.uid,
    quem_nome: usuario.displayName || usuario.email || ''
  }).catch((e) => {
    console.warn(
      'Não foi possível registrar no histórico (as regras do /historico ' +
      'já foram publicadas?).', e
    );
  });
}

/* ------------------------------------------------- pessoas com acesso */

async function listarPessoas() {
  // Lida sob demanda (não no espelho) porque muda pouco.
  const { getDocs } = await import(
    'https://www.gstatic.com/firebasejs/12.4.0/firebase-firestore.js'
  );
  const instantaneo = await getDocs(collection(db, 'usuarios'));
  return instantaneo.docs
    .map(daDoc)
    .sort((a, b) => String(a.email || a.id).localeCompare(String(b.email || b.id)));
}

/** Libera o acesso de uma pessoa. A chave é o e-mail, então funciona ANTES
 *  do primeiro login dela — ela entra e já tem acesso. */
async function salvarPessoa(email, dados) {
  const chave = chaveDoEmail(email);
  if (!chave || chave.indexOf('@') === -1) {
    throw new Error('Informe um e-mail válido.');
  }
  await setDoc(
    doc(db, 'usuarios', chave),
    Object.assign({}, dados, {
      email: chave,
      atualizado_em: serverTimestamp(),
      atualizado_por: usuario ? chaveDoEmail(usuario.email) : ''
    }),
    { merge: true }
  );
}

async function removerPessoa(email) {
  const chave = chaveDoEmail(email);
  if (usuario && chave === chaveDoEmail(usuario.email)) {
    throw new Error('Você não pode remover o seu próprio acesso.');
  }
  await deleteDoc(doc(db, 'usuarios', chave));
}

/* ------------------------------------------------------------ autenticação */

async function entrar() {
  const provedor = new GoogleAuthProvider();
  provedor.setCustomParameters({ prompt: 'select_account' });
  try {
    await setPersistence(auth, browserLocalPersistence);
    await signInWithPopup(auth, provedor);
  } catch (erro) {
    console.error('Falha no login:', erro);
    const codigo = String(erro && erro.code);
    if (codigo === 'auth/popup-blocked') {
      alert('O navegador bloqueou a janela de login. Libere os pop-ups para este site.');
    } else if (codigo === 'auth/unauthorized-domain') {
      alert(
        'Este endereço não está liberado no Firebase.\n\n' +
        'Adicione o domínio em Authentication → Configurações → Domínios autorizados.'
      );
    } else if (codigo !== 'auth/cancelled-popup-request' &&
               codigo !== 'auth/popup-closed-by-user') {
      alert('Não foi possível entrar: ' + (erro && erro.message));
    }
  }
}

async function sair() {
  pararAssinaturas();
  estado = Regras.estadoInicial();
  await signOut(auth);
}

/* ------------------------------------------------------------- tela de login */

/** Cabeçalho com a logo do parque, reaproveitado nas telas do portão. */
function marcaDoPortao() {
  return (
    '<img class="portao-logo" src="img/logo-256.jpg" width="108" height="108" ' +
    'alt="IpêTech — Parque Tecnológico dos Ipês">' +
    '<div class="portao-marca">' +
    '<div class="portao-nome">IpêTech</div>' +
    '<div class="portao-sub">Acompanhamento CERNE</div>' +
    '<div class="portao-instituicao">Parque Tecnológico dos Ipês<br>' +
    'UFLA — Câmpus Paraíso</div>' +
    '</div>'
  );
}

function telaLogin(mensagem) {
  const alvo = document.getElementById('portao');
  if (!alvo) return;
  alvo.hidden = false;
  alvo.innerHTML =
    '<div class="portao-caixa">' +
    marcaDoPortao() +
    (mensagem
      ? '<div class="portao-aviso">' + mensagem + '</div>'
      : '<p class="portao-texto">Entre com sua conta Google para registrar e ' +
        'consultar o acompanhamento do parque.</p>') +
    '<button type="button" class="portao-botao" id="btn-entrar">' +
    'Entrar com Google</button>' +
    '<p class="portao-pe">Acesso restrito à equipe do parque.</p>' +
    '</div>';

  const botao = document.getElementById('btn-entrar');
  if (botao) botao.addEventListener('click', entrar);
}

function telaSemAcesso(u) {
  const alvo = document.getElementById('portao');
  if (!alvo) return;
  alvo.hidden = false;
  alvo.innerHTML =
    '<div class="portao-caixa">' +
    marcaDoPortao() +
    '<div class="portao-aviso">' +
    '<strong>Acesso ainda não liberado.</strong><br>' +
    'Você entrou como <strong>' + (u.email || '') + '</strong>, mas este ' +
    'e-mail não está na lista da equipe do parque.' +
    '</div>' +
    '<p class="portao-texto">Peça ao gestor para liberar o acesso. ' +
    'Basta informar o e-mail abaixo — não é preciso nenhum código.</p>' +
    '<p class="portao-uid">' + (u.email || '') + '</p>' +
    '<button type="button" class="portao-botao secundario" id="btn-sair-portao">' +
    'Sair</button>' +
    '</div>';

  const botao = document.getElementById('btn-sair-portao');
  if (botao) botao.addEventListener('click', sair);
}

function esconderPortao() {
  const alvo = document.getElementById('portao');
  if (alvo) { alvo.hidden = true; alvo.innerHTML = ''; }
}

/* -------------------------------------------------- interface do usuário logado */

function mostrarUsuario() {
  const caixa = document.getElementById('usuario-caixa');
  if (!caixa || !usuario) return;
  const nome = usuario.displayName || usuario.email || 'usuário';
  // Rótulo curto: o do catálogo ("Consulta (somente leitura)") não cabe na
  // etiqueta do topo.
  const CURTOS = { gestor: 'Gestor', equipe: 'Equipe', consulta: 'Consulta' };
  const rotuloPapel = CURTOS[papelEmUso()] || 'Sem acesso';

  caixa.innerHTML =
    '<span class="usuario-nome" title="' + (usuario.email || '') + '">' +
    nome + '</span>' +
    '<span class="usuario-papel' + (papelSimulado ? ' simulado' : '') + '"' +
    (papelSimulado ? ' title="Simulação: seu papel real é Gestor"' : '') + '>' +
    rotuloPapel + (papelSimulado ? ' (teste)' : '') + '</span>' +
    '<button type="button" class="usuario-sair" id="btn-sair">Sair</button>';

  const botao = document.getElementById('btn-sair');
  if (botao) botao.addEventListener('click', sair);
}

/* ------------------------------------------------------------------ Store */

/** Mesma interface do modo local, para as telas não precisarem saber onde os
 *  dados estão guardados. */
function publicarStore() {
  window.Store = {
    // catálogo e rótulos
    catalogo: Regras.catalogo,
    praticas: Regras.praticas,
    buscarPratica: Regras.buscarPratica,
    PRATICAS_CONTINUAS_SUGERIDAS: Regras.PRATICAS_CONTINUAS_SUGERIDAS,
    SITUACOES: Regras.SITUACOES,
    ESTAGIOS: Regras.ESTAGIOS,
    SITUACOES_EMPREENDIMENTO: Regras.SITUACOES_EMPREENDIMENTO,
    SITUACOES_PLANO: Regras.SITUACOES_PLANO,
    EIXOS: Regras.EIXOS,
    PAPEIS: Regras.PAPEIS,
    TIPOS_ATIVIDADE: Regras.TIPOS_ATIVIDADE,
    rotuloDe: Regras.rotuloDe,

    // ciclo de vida
    carregar: function () { return estado; },
    aoMudar: function (fn) { ouvintes.push(fn); },
    estado: function () { return estado; },
    mecanismo: function () { return estado.mecanismo; },
    salvarMecanismo: salvarMecanismo,
    falhaPersistencia: function () { return erroNuvem; },

    // status
    statusDe: function (codigo) { return Regras.statusDe(estado, codigo); },
    salvarStatus: salvarStatus,

    // coleções
    criarEm: criarEm,
    atualizarEm: atualizarEm,
    removerEm: removerEm,
    evidenciasDaPratica: function (codigo) {
      return estado.evidencias.filter((e) => e.pratica === codigo);
    },
    revisoesDaPratica: function (codigo) {
      return estado.revisoes.filter((r) => r.pratica === codigo);
    },
    planosDaPratica: function (codigo) {
      return estado.planos.filter((p) => p.pratica === codigo);
    },
    medicoesDaMetrica: function (metricaId) {
      return Regras.medicoesDaMetrica(estado, metricaId);
    },
    empreendimentoPorId: function (id) {
      return estado.empreendimentos.filter((e) => e.id === id)[0] || null;
    },

    // prontidão (regra única, em regras.js)
    faltasDaPratica: function (pratica) {
      return Regras.faltasDaPratica(estado, pratica);
    },
    praticaCompleta: function (pratica) {
      return Regras.praticaCompleta(estado, pratica);
    },
    calcularProntidao: function () { return Regras.calcularProntidao(estado); },
    resumo: function () { return Regras.resumo(estado); },

    // backup: exportar continua valendo; importar em massa não é oferecido na
    // nuvem de propósito, para não sobrescrever o trabalho de outra pessoa.
    baixarBackup: baixarBackup,
    exportarObjeto: function () {
      const obj = JSON.parse(JSON.stringify(estado));
      obj.anexos_indice = Regras.indiceDeAnexos(estado);
      return obj;
    },
    importarObjeto: null,
    limpar: null,
    carregarExemplo: null,

    // perfil: vem do servidor, não é escolha do usuário. A exceção é o
    // "ver como" do gestor, que só mexe na interface.
    perfil: function () { return papelEmUso(); },
    podeEditar: podeRegistrar,
    ehGestor: ehGestor,
    definirPerfil: null,
    papelReal: papelReal,
    papelSimulado: function () { return papelSimulado; },
    simularPapel: simularPapel,

    // anexos (só existem no modo nuvem; no modo local estas funções não
    // são publicadas, e a interface esconde o campo de arquivo)
    enviarArquivo: enviarArquivo,
    enviarArquivoEmpreendimento: enviarArquivoEmpreendimento,
    removerArquivo: removerArquivo,
    conferirArquivo: conferirArquivo,
    EXTENSOES_ACEITAS: EXTENSOES_ACEITAS,
    TAMANHO_MAXIMO: TAMANHO_MAXIMO,

    // nuvem
    naNuvem: true,
    usuario: function () { return usuario; },
    listarPessoas: listarPessoas,
    salvarPessoa: salvarPessoa,
    removerPessoa: removerPessoa,
    sair: sair,

    novoId: function () {
      return 'id' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
    }
  };
}

function baixarBackup() {
  const obj = JSON.parse(JSON.stringify(estado));
  // Índice dos anexos (empreendimento -> títulos/URLs). Os arquivos ficam no
  // Storage; o backup leva só o mapa, para rastreabilidade.
  obj.anexos_indice = Regras.indiceDeAnexos(estado);
  const conteudo = JSON.stringify(obj, null, 2);
  const blob = new Blob([conteudo], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const d = new Date();
  const pad = (v) => String(v).padStart(2, '0');
  a.href = url;
  a.download =
    'cerne-ipetech-' + d.getFullYear() + pad(d.getMonth() + 1) + pad(d.getDate()) + '.json';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/* ------------------------------------------------------------- inicialização */

function carregando(texto) {
  const alvo = document.getElementById('portao');
  if (!alvo) return;
  alvo.hidden = false;
  alvo.innerHTML =
    '<div class="portao-caixa"><div class="portao-carregando">' +
    '<span class="portao-girando" aria-hidden="true"></span>' +
    (texto || 'Carregando...') +
    '</div></div>';
}

// Cache local: permite trabalhar com a internet instável e abrir mais rápido.
// Falha quando há várias abas abertas, e isso não é problema — só não cacheia.
enableIndexedDbPersistence(db).catch((erro) => {
  if (erro && erro.code !== 'failed-precondition' && erro.code !== 'unimplemented') {
    console.warn('Cache local indisponível:', erro);
  }
});

carregando('Verificando acesso...');

onAuthStateChanged(auth, async (u) => {
  pararAssinaturas();

  if (!u) {
    usuario = null;
    papel = 'nenhum';
    papelSimulado = null;
    estado = Regras.estadoInicial();
    publicarStore();
    telaLogin();
    return;
  }

  usuario = u;
  carregando('Carregando o acompanhamento...');
  papel = await descobrirPapel(u);

  if (!autorizado()) {
    telaSemAcesso(u);
    return;
  }

  publicarStore();
  await assinarDados();
  esconderPortao();
  mostrarUsuario();

  if (window.AppCerne && typeof window.AppCerne.iniciar === 'function') {
    window.AppCerne.iniciar();
  } else {
    redesenhar();
  }
});
