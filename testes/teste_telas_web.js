/* Teste de fumaça das telas da versão web (docs/js/app.js).

   Monta um DOM mínimo em memória, carrega o app e renderiza cada tela,
   verificando que nenhuma lança erro e que o conteúdo esperado aparece.

   Rodar da raiz do projeto:  node testes/teste_telas_web.js
*/
const fs = require('fs');
const path = require('path');

const RAIZ_WEB = path.join(__dirname, '..', 'docs');

let falhas = 0;
function verificar(descricao, condicao, extra) {
  if (condicao) {
    console.log('  ok   ' + descricao);
  } else {
    falhas++;
    console.log('  FALHA ' + descricao + (extra ? '  -> ' + String(extra).slice(0, 300) : ''));
  }
}

/* ---------------------------------------------------------- DOM simulado */

function criarElemento(id) {
  return {
    id: id,
    innerHTML: '',
    textContent: '',
    value: '',
    files: null,
    elements: [],
    style: {},
    classList: { add() {}, remove() {}, contains() { return false; } },
    addEventListener() {},
    removeEventListener() {},
    setAttribute() {},
    getAttribute() { return null; },
    focus() {},
    setSelectionRange() {},
    querySelectorAll() { return []; },
    appendChild() {},
    removeChild() {},
    click() {}
  };
}

/* Arquivos carregados no modo local (index antigo / local.html). */
const ARQUIVOS_LOCAL = [
  'js/dados-cerne.js',
  'js/regras.js',
  'js/store.js',
  'js/app.js'
];

/* Modo nuvem: NÃO carrega store.js. Quem publica o Store é o nuvem.js, que é
   um módulo e só roda depois do login — por isso o app.js precisa aguentar
   ser chamado antes de o Store existir. */
const ARQUIVOS_NUVEM = ['js/dados-cerne.js', 'js/regras.js', 'js/app.js'];

function montarAmbiente(arquivos, extras) {
  const elementos = {};
  const documento = {
    readyState: 'complete',
    title: '',
    getElementById(id) {
      if (!elementos[id]) elementos[id] = criarElemento(id);
      return elementos[id];
    },
    querySelectorAll() { return []; },
    createElement(tag) { return criarElemento(tag); },
    addEventListener() {},
    body: criarElemento('body')
  };

  const janela = {
    document: documento,
    location: { hash: '#/' },
    localStorage: (() => {
      const memoria = {};
      return {
        getItem: (k) => (k in memoria ? memoria[k] : null),
        setItem: (k, v) => { memoria[k] = String(v); },
        removeItem: (k) => { delete memoria[k]; }
      };
    })(),
    addEventListener() {},
    scrollTo() {},
    print() {},
    confirm: () => true,
    alert() {},
    setTimeout: (fn) => setTimeout(fn, 0),
    clearTimeout: (t) => clearTimeout(t)
  };

  Object.assign(janela, extras || {});

  for (const arquivo of arquivos || ARQUIVOS_LOCAL) {
    const codigo = fs.readFileSync(path.join(RAIZ_WEB, arquivo), 'utf8');
    new Function('window', 'document', 'globalThis', codigo)(janela, documento, janela);
  }

  return { janela, documento, elementos };
}

/* -------------------------------------------------------------- execução */

const { janela, documento, elementos } = montarAmbiente();
const Store = janela.Store;
const conteudo = documento.getElementById('conteudo');

function renderizarRota(hash) {
  janela.location.hash = hash;
  conteudo.innerHTML = '';
  janela.AppCerne.renderizar();
  return conteudo.innerHTML;
}

function checarTela(hash, descricao, trechosEsperados) {
  const html = renderizarRota(hash);
  const houveErro = html.indexOf('Ocorreu um erro ao montar esta tela') !== -1;
  verificar(descricao + ' renderiza sem erro', !houveErro && html.length > 200,
    houveErro ? html : 'tamanho=' + html.length);
  (trechosEsperados || []).forEach(function (trecho) {
    verificar(descricao + ' contém "' + trecho + '"', html.indexOf(trecho) !== -1);
  });
  return html;
}

console.log('\n1) Telas com o sistema vazio');
checarTela('#/', 'Painel', ['Painel de prontidão', 'Radar de prontidão', 'Prontidão por nível']);
checarTela('#/catalogo', 'Práticas', ['Práticas-chave', 'CERNE 1', 'Sensibilização']);
checarTela('#/empreendimentos', 'Empreendimentos', ['Empreendimentos', 'Nenhum empreendimento']);
checarTela('#/dossie', 'Dossiê', ['Dossiê de certificação', 'Documento gerado em']);
checarTela('#/dados', 'Dados', ['Dados e backup', 'Exportar backup', 'Identificação do mecanismo']);
checarTela('#/guia', 'Guia', ['Guia de uso', 'Para quem preenche', 'Para quem administra']);

console.log('\n2) Detalhe de prática');
checarTela('#/pratica/1.1.1', 'Prática 1.1.1',
  ['1.1.1', 'Situação da prática', 'Evidências por requisito', 'Métricas e metas',
   'Revisões críticas', 'Planos de ação']);

console.log('\n3) Prática inexistente é tratada');
let html = renderizarRota('#/pratica/9.9.9');
verificar('mostra mensagem de não encontrada', html.indexOf('não encontrada') !== -1);

console.log('\n4) Rota desconhecida é tratada');
html = renderizarRota('#/inexistente');
verificar('mostra tela não encontrada', html.indexOf('Tela não encontrada') !== -1);

console.log('\n5) Com dados de exemplo carregados');
Store.carregarExemplo();
html = checarTela('#/', 'Painel (com dados)', ['CERNE 1', 'O que falta para o CERNE']);
verificar('painel mostra que está apto ao CERNE 1', html.indexOf('Apto a solicitar') !== -1);
checarTela('#/empreendimentos', 'Empreendimentos (com dados)', ['AgroSense', 'EducaLab']);
checarTela('#/dossie', 'Dossiê (com dados)', ['Completa', 'Requisitos e evidências']);

console.log('\n6) Detalhe de empreendimento e radar SVG');
const emp = Store.estado().empreendimentos[0];
html = checarTela('#/empreendimento/' + emp.id, 'Empreendimento',
  ['AgroSense', 'Evolução nos cinco eixos', 'Histórico de avaliações']);
verificar('radar é um SVG', html.indexOf('<svg') !== -1);
verificar('radar cita os cinco eixos',
  ['Empreendedor', 'Tecnologia', 'Capital', 'Mercado', 'Gestão']
    .every((e) => html.indexOf(e) !== -1));

console.log('\n7) Empreendimento inexistente é tratado');
html = renderizarRota('#/empreendimento/nao-existe');
verificar('mostra mensagem de não encontrado', html.indexOf('não encontrado') !== -1);

console.log('\n8) Modo consulta bloqueia edição');
Store.definirPerfil('consulta');
html = renderizarRota('#/pratica/1.1.1');
verificar('avisa que está em modo consulta', html.indexOf('Modo consulta') !== -1);
verificar('campos ficam desabilitados', html.indexOf('disabled') !== -1);
verificar('não oferece botão de salvar situação',
  html.indexOf('Salvar situação') === -1);
html = renderizarRota('#/dados');
verificar('modo consulta não oferece importar backup',
  html.indexOf('Importar backup') === -1);
verificar('modo consulta ainda permite exportar backup',
  html.indexOf('Exportar backup') !== -1);
Store.definirPerfil('gestor');
html = renderizarRota('#/pratica/1.1.1');
verificar('modo gestor volta a permitir salvar', html.indexOf('Salvar situação') !== -1);

console.log('\n9) Escape de HTML (não deve injetar tag)');
Store.salvarMecanismo({ nome: '<script>alert(1)</script>Parque' });
html = renderizarRota('#/');
verificar('tag script é escapada', html.indexOf('<script>alert(1)</script>') === -1);
verificar('texto aparece escapado', html.indexOf('&lt;script&gt;') !== -1);

console.log('\n10) Título da página muda por tela');
renderizarRota('#/guia');
verificar('title reflete a tela', documento.title.indexOf('Guia de uso') === 0, documento.title);

/* ---------------------------------------------------------------------------
   Regressão: desenhar antes do Store existir

   No modo nuvem o Store só é publicado depois do login, porque o nuvem.js é
   um módulo e módulos rodam depois dos scripts comuns. Antes da correção, o
   app.js capturava `window.Store` no carregamento (undefined) e guardava essa
   referência vazia para sempre, quebrando a tela com
   "Cannot read properties of undefined (reading 'calcularProntidao')".

   Estes testes garantem que:
     - desenhar sem Store mostra "Carregando", não um erro;
     - quando o Store aparece depois, a tela passa a funcionar.
--------------------------------------------------------------------------- */

console.log('\n11) Desenhar antes de o Store existir (modo nuvem)');

// Ambiente novo, montado exatamente como o index.html do modo nuvem:
// sem store.js, e com CERNE_MODO_NUVEM para o app.js não iniciar sozinho.
const nuvem = montarAmbiente(ARQUIVOS_NUVEM, { CERNE_MODO_NUVEM: true });
const conteudoNuvem = nuvem.documento.getElementById('conteudo');

verificar('app.js não inicia sozinho no modo nuvem', conteudoNuvem.innerHTML === '');
verificar('app.js expõe iniciar() para o nuvem.js chamar',
  typeof nuvem.janela.AppCerne.iniciar === 'function');

// É isto que acontecia na prática: um onSnapshot do Firestore chega e pede
// desenho antes de o login terminar.
nuvem.janela.location.hash = '#/';
nuvem.janela.AppCerne.renderizar();
let htmlNuvem = conteudoNuvem.innerHTML;

verificar('não quebra sem Store',
  htmlNuvem.indexOf('Cannot read properties') === -1 &&
  htmlNuvem.indexOf('Ocorreu um erro') === -1,
  htmlNuvem.slice(0, 220));
verificar('mostra que está carregando', htmlNuvem.indexOf('Carregando') !== -1,
  htmlNuvem.slice(0, 220));

// Agora o nuvem.js publica o Store (reaproveitamos o do ambiente local) e
// chama iniciar(), como faz de verdade depois do login.
nuvem.janela.Store = janela.Store;
nuvem.janela.AppCerne.iniciar();
htmlNuvem = conteudoNuvem.innerHTML;

verificar('desenha o painel depois que o Store aparece',
  htmlNuvem.indexOf('Painel de prontidão') !== -1, htmlNuvem.slice(0, 220));
verificar('sem mensagem de erro depois',
  htmlNuvem.indexOf('Ocorreu um erro ao montar esta tela') === -1);

/* ---------------------------------------------------------------------------
   Regressão: o progresso por nível não pode voltar a ser SVG

   A primeira versão desenhava as barras em SVG com viewBox. Como o texto
   ficava em unidades do viewBox, ao esticar para a largura do cartão a fonte
   escalava junto: "CERNE 1" e "0%" apareciam em tamanho de título, ocupando
   a tela inteira. Agora é barra em HTML, com texto em tamanho real.
--------------------------------------------------------------------------- */

console.log('\n12) Progresso por nível em HTML, não em SVG');

html = renderizarRota('#/');
verificar('painel não usa SVG (evita texto escalando)', html.indexOf('<svg') === -1);
verificar('usa a lista de níveis em HTML', html.indexOf('lista-niveis') !== -1);
verificar('usa barra de progresso com largura percentual',
  html.indexOf('class="barra') !== -1 && html.indexOf('style="width:') !== -1);
verificar('mostra o percentual de cada nível', html.indexOf('numero-pct') !== -1);
verificar('mostra quantas práticas faltam',
  html.indexOf('práticas completas') !== -1);

// O radar do empreendimento CONTINUA sendo SVG — lá é apropriado, porque é
// forma geométrica e o container é estreito.
Store.carregarExemplo();
const empRadar = Store.estado().empreendimentos[0];
html = renderizarRota('#/empreendimento/' + empRadar.id);
verificar('radar dos cinco eixos segue em SVG', html.indexOf('<svg') !== -1);

/* ---------------------------------------------------------------------------
   Campo de anexo: só aparece quando existe armazenamento

   No modo local não há onde guardar arquivo, então oferecer o campo seria
   enganoso — a pessoa escolheria o arquivo e nada aconteceria. O campo é
   condicionado à existência de Store.enviarArquivo, que só o modo nuvem
   publica.
--------------------------------------------------------------------------- */

console.log('\n13) Campo de anexo condicionado ao armazenamento');

html = renderizarRota('#/pratica/1.1.1');
verificar('modo local NÃO mostra campo de arquivo',
  html.indexOf('type="file"') === -1);
verificar('modo local oferece link como alternativa',
  html.indexOf('Link (opcional)') !== -1);

// Simula o modo nuvem: basta o Store expor as funções de anexo.
const extensoesFalsas = ['.pdf', '.jpg', '.xlsx'];
Store.enviarArquivo = function () { return Promise.resolve({}); };
Store.conferirArquivo = function () { return null; };
Store.EXTENSOES_ACEITAS = extensoesFalsas;

html = renderizarRota('#/pratica/1.1.1');
verificar('com armazenamento, mostra campo de arquivo',
  html.indexOf('type="file"') !== -1);
verificar('limita os tipos aceitos no próprio campo',
  html.indexOf('accept=".pdf,.jpg,.xlsx"') !== -1);
verificar('mostra o limite de tamanho para o usuário',
  html.indexOf('20 MB') !== -1);
verificar('tem barra de progresso pronta para o envio',
  html.indexOf('envio-barra') !== -1);
verificar('o texto do link muda para alternativa',
  html.indexOf('Ou link externo') !== -1);

delete Store.enviarArquivo;
delete Store.conferirArquivo;
delete Store.EXTENSOES_ACEITAS;

html = renderizarRota('#/pratica/1.1.1');
verificar('volta a esconder o campo sem armazenamento',
  html.indexOf('type="file"') === -1);

/* ---------------------------------------------------------------------------
   Várias evidências por requisito, e evidências próprias do parque

   Duas coisas são verificadas aqui, e a segunda é a mais importante:

   1. Um requisito aceita várias evidências, e a interface deixa isso visível
      (contagem no título + ação "anexar outra").
   2. Evidência própria do parque NÃO conta para a prontidão. A certificação
      é avaliada pelos requisitos do modelo CERNE; se material próprio
      contasse, o sistema diria que o parque está apto quando não está — o
      pior erro possível neste sistema.
--------------------------------------------------------------------------- */

console.log('\n14) Várias evidências por requisito');

Store.limpar();
const praticaTeste = Store.buscarPratica('1.1.1').pratica;
const reqObrigatorio = praticaTeste.requisitos.filter((r) => r.obrigatorio)[0];

Store.criarEm('evidencias', {
  pratica: '1.1.1', requisito: reqObrigatorio.id,
  titulo: 'Primeira palestra', data_referencia: '2026-03-01'
});
Store.criarEm('evidencias', {
  pratica: '1.1.1', requisito: reqObrigatorio.id,
  titulo: 'Segunda palestra', data_referencia: '2026-04-01'
});

html = renderizarRota('#/pratica/1.1.1');
verificar('as duas evidências aparecem',
  html.indexOf('Primeira palestra') !== -1 && html.indexOf('Segunda palestra') !== -1);
verificar('mostra a contagem no título do requisito',
  html.indexOf('2 anexadas') !== -1);
verificar('oferece anexar outra mesmo já atendido',
  html.indexOf('Anexar outra evidência') !== -1);

console.log('\n15) Evidência própria não conta para a prontidão');

// Estado de partida: a prática tem pendências.
let info = _info('1.1.1');
const faltasAntes = info.faltas.length;
verificar('a prática começa com pendências', faltasAntes > 0);

// Registra material próprio do parque, SEM requisito do modelo.
Store.criarEm('evidencias', {
  pratica: '1.1.1', requisito: null, refere_a: 'iniciativa própria',
  titulo: 'Programa de mentoria do IpêTech', data_referencia: '2026-05-01'
});

info = _info('1.1.1');
verificar('o número de pendências NÃO muda', info.faltas.length === faltasAntes,
  faltasAntes + ' -> ' + info.faltas.length);
verificar('a prática continua incompleta', info.completa === false);

html = renderizarRota('#/pratica/1.1.1');
verificar('aparece na seção de evidências próprias',
  html.indexOf('Programa de mentoria do IpêTech') !== -1);
verificar('avisa que não altera a prontidão',
  html.indexOf('não altera o cálculo de prontidão') !== -1);
verificar('mostra o rótulo informado pelo parque',
  html.indexOf('iniciativa própria') !== -1);

html = renderizarRota('#/dossie');
verificar('aparece no dossiê, separada das do modelo',
  html.indexOf('Outras evidências do parque') !== -1 &&
  html.indexOf('Programa de mentoria do IpêTech') !== -1);

function _info(codigo) {
  const p = Store.calcularProntidao();
  for (const n of p.niveis) {
    for (const proc of n.processos) {
      for (const item of proc.praticas) {
        if (item.pratica.codigo === codigo) return item;
      }
    }
  }
  return null;
}

/* ---------------------------------------------------------------------------
   Tela de equipe (quem pode entrar no sistema)

   Só existe no modo com login, e só para o gestor. A verificação no navegador
   é conveniência de navegação; quem decide de verdade são as regras do
   Firestore. Mesmo assim o menu não deve oferecer a tela a quem não pode
   usá-la, e a tela não deve vazar a lista para quem não é gestor.

   A lista de pessoas é lida sob demanda (promessa), por isso esta seção é
   assíncrona: o primeiro desenho mostra "Carregando" e o segundo, já com a
   resposta, mostra a tabela.
--------------------------------------------------------------------------- */

function menuHtml() {
  return documento.getElementById('menu').innerHTML;
}

/** Deixa as promessas pendentes terminarem antes de ler a tela de novo. */
function esperarPromessas() {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

(async function () {
  console.log('\n16) Tela de equipe');

  // --- modo local: a tela não se aplica, e o menu não deve oferecê-la
  html = renderizarRota('#/pessoas');
  verificar('modo local avisa que a tela é só do modo com login',
    html.indexOf('apenas no modo com login') !== -1, html.slice(0, 220));
  verificar('modo local não mostra "Equipe" no menu',
    menuHtml().indexOf('Equipe') === -1);

  // --- simula o modo nuvem, como nas seções anteriores: basta o Store
  //     publicar as funções que só o nuvem.js tem.
  const equipe = [
    { id: 'leonilsonk@gmail.com', email: 'leonilsonk@gmail.com',
      nome: 'Leonilson', papel: 'gestor', atualizado_em: '2026-09-20T10:00:00.000Z' },
    { id: 'tecnico@ipetech.br', email: 'tecnico@ipetech.br',
      nome: 'Técnico do Parque', papel: 'equipe',
      atualizado_em: '2026-09-21T13:30:00.000Z' }
  ];
  const salvos = [];
  const removidos = [];

  Store.listarPessoas = () => Promise.resolve(equipe.slice());
  Store.salvarPessoa = (email, dados) => { salvos.push([email, dados]); return Promise.resolve(); };
  Store.removerPessoa = (email) => { removidos.push(email); return Promise.resolve(); };
  Store.usuario = () => ({ email: 'leonilsonk@gmail.com', emailVerified: true });
  Store.ehGestor = () => true;

  // --- gestor: vê a lista e o formulário
  html = renderizarRota('#/pessoas');
  verificar('primeiro desenho avisa que está carregando',
    html.indexOf('Carregando a equipe') !== -1, html.slice(0, 220));

  await esperarPromessas();
  html = conteudo.innerHTML;

  verificar('gestor vê a tela sem erro',
    html.indexOf('Ocorreu um erro ao montar esta tela') === -1, html.slice(0, 300));
  verificar('gestor vê o formulário de liberar acesso',
    html.indexOf('Liberar acesso') !== -1);
  verificar('pede o e-mail da conta Google',
    html.indexOf('E-mail da conta Google') !== -1);
  verificar('lista quem já tem acesso',
    html.indexOf('tecnico@ipetech.br') !== -1 &&
    html.indexOf('Técnico do Parque') !== -1);
  verificar('mostra o papel de cada pessoa',
    html.indexOf('>Equipe<') !== -1 && html.indexOf('>Gestor<') !== -1);
  verificar('marca qual linha é a do próprio gestor',
    html.indexOf('você') !== -1);
  verificar('não oferece remover o próprio acesso',
    html.indexOf('data-remover-pessoa="leonilsonk@gmail.com"') === -1);
  verificar('oferece remover o acesso dos outros',
    html.indexOf('data-remover-pessoa="tecnico@ipetech.br"') !== -1);
  verificar('explica o que cada papel pode fazer',
    html.indexOf('O que cada papel pode fazer') !== -1);
  verificar('gestor vê "Equipe" no menu', menuHtml().indexOf('Equipe') !== -1);

  // --- quem não é gestor: nada de lista, nada de menu
  Store.ehGestor = () => false;
  html = renderizarRota('#/pessoas');

  verificar('não-gestor recebe aviso de permissão',
    html.indexOf('Apenas o gestor do parque') !== -1, html.slice(0, 220));
  verificar('não-gestor NÃO vê a lista de pessoas',
    html.indexOf('tecnico@ipetech.br') === -1);
  verificar('não-gestor NÃO vê o formulário',
    html.indexOf('form-pessoa') === -1);
  verificar('não-gestor não vê "Equipe" no menu',
    menuHtml().indexOf('Equipe') === -1);

  delete Store.listarPessoas;
  delete Store.salvarPessoa;
  delete Store.removerPessoa;
  delete Store.usuario;
  delete Store.ehGestor;

  /* -------------------------------------------------------------------------
     Empresa residente e local de instalação

     Um parque tecnológico tem dois vínculos diferentes: a empresa em
     incubação e a empresa residente, instalada no parque fora do programa.
     Eram tratadas como a mesma coisa ("apoiado"), o que escondia a contagem
     de residentes e impedia registrar onde cada uma fica.
  ------------------------------------------------------------------------- */

  console.log('\n17) Empresa residente e local de instalação');

  Store.carregarExemplo();
  const emps = Store.estado().empreendimentos;
  const residente = emps.filter((x) => x.situacao === 'residente')[0];
  const incubada = emps.filter((x) => x.situacao === 'apoiado')[0];

  verificar('o exemplo traz uma empresa residente', !!residente);

  html = renderizarRota('#/empreendimentos');
  verificar('lista separa incubados de residentes nos indicadores',
    html.indexOf('Incubados') !== -1 && html.indexOf('Residentes') !== -1);
  verificar('a residente aparece com a etiqueta certa',
    html.indexOf('>Residente<') !== -1);
  verificar('a lista tem coluna de local',
    html.indexOf('<th>Local</th>') !== -1);
  verificar('o local de cada empresa aparece na lista',
    html.indexOf('Prédio 2, módulo 3') !== -1 && html.indexOf('Prédio 1, sala 4') !== -1);
  verificar('o cadastro oferece a situação residente',
    html.indexOf('value="residente"') !== -1);
  verificar('o cadastro tem campo de local',
    html.indexOf('name="local"') !== -1 &&
    html.indexOf('Local onde está instalado') !== -1);
  verificar('o cadastro oferece o estágio de empresa consolidada',
    html.indexOf('value="consolidada"') !== -1);

  // --- detalhe: mostra e deixa editar local, estágio e situação
  html = renderizarRota('#/empreendimento/' + residente.id);
  verificar('detalhe da residente abre sem erro',
    html.indexOf('Ocorreu um erro ao montar esta tela') === -1, html.slice(0, 300));
  verificar('detalhe mostra o local nos dados',
    html.indexOf('Prédio 2, módulo 3') !== -1);
  verificar('detalhe permite editar local, estágio e situação',
    html.indexOf('form-dados-emp') !== -1 &&
    html.indexOf('id="emp-local"') !== -1 &&
    html.indexOf('id="emp-estagio"') !== -1 &&
    html.indexOf('id="emp-situacao"') !== -1);
  verificar('a situação atual vem marcada no menu',
    html.indexOf('value="residente" selected') !== -1);

  // O manipulador de envio não dá para acionar neste DOM de mentira, então a
  // verificação é da camada de dados + desenho, que é o que importa: gravou e
  // a tela passou a mostrar.
  Store.atualizarEm('empreendimentos', residente.id, { local: 'Prédio 3, galpão 1' });
  html = renderizarRota('#/empreendimento/' + residente.id);
  verificar('mudança de local é gravada e aparece',
    html.indexOf('Prédio 3, galpão 1') !== -1);

  // Uma incubada que gradua e depois fica como residente mantém a data de
  // graduação: a graduação aconteceu de fato.
  Store.atualizarEm('empreendimentos', incubada.id, {
    situacao: 'graduado', data_graduacao: '2026-09-01'
  });
  Store.atualizarEm('empreendimentos', incubada.id, { situacao: 'residente' });
  const graduadaResidente = Store.empreendimentoPorId(incubada.id);
  verificar('graduada que segue no parque como residente mantém a data',
    graduadaResidente.situacao === 'residente' &&
    graduadaResidente.data_graduacao === '2026-09-01',
    graduadaResidente.situacao + ' / ' + graduadaResidente.data_graduacao);

  /* -------------------------------------------------------------------------
     Os textos de ajuda têm que dizer a verdade no modo em que estão rodando

     As telas "Dados e backup" e "Guia de uso" foram escritas quando só existia
     o modo local, e afirmavam coisas que são FALSAS no modo com login: que os
     dados ficam só neste navegador, que não são compartilhados entre pessoas,
     e que o sistema não guarda o arquivo da evidência. Num sistema que serve
     de base para auditoria, o manual não pode contradizer o sistema.
  ------------------------------------------------------------------------- */

  console.log('\n18) Textos de ajuda coerentes com o modo');

  // --- modo local: os textos antigos continuam valendo
  html = renderizarRota('#/dados');
  verificar('modo local avisa que os dados ficam neste navegador',
    html.indexOf('fica salvo neste navegador') !== -1);
  verificar('modo local avisa que não há compartilhamento',
    html.indexOf('não são compartilhados automaticamente') !== -1);

  html = renderizarRota('#/guia');
  verificar('modo local explica o localStorage',
    html.indexOf('localStorage') !== -1);
  verificar('modo local diz que guarda o registro, não o arquivo',
    html.indexOf('não o arquivo em si') !== -1);

  // --- modo com login: basta o Store marcar naNuvem, como o nuvem.js faz
  Store.naNuvem = true;

  html = renderizarRota('#/dados');
  verificar('modo nuvem NÃO diz que os dados ficam só neste navegador',
    html.indexOf('fica salvo neste navegador') === -1, html.slice(0, 300));
  verificar('modo nuvem NÃO diz que os dados não são compartilhados',
    html.indexOf('não são compartilhados automaticamente') === -1);
  verificar('modo nuvem explica que os dados são compartilhados',
    html.indexOf('Dados compartilhados') !== -1);
  verificar('modo nuvem não mostra "nada salvo ainda"',
    html.indexOf('nada salvo ainda') === -1 && html.indexOf('salvo na nuvem') !== -1);

  html = renderizarRota('#/guia');
  verificar('modo nuvem NÃO explica localStorage',
    html.indexOf('localStorage') === -1, html.slice(0, 300));
  verificar('modo nuvem diz onde os dados realmente ficam',
    html.indexOf('Firestore') !== -1 && html.indexOf('São Paulo') !== -1);
  verificar('modo nuvem diz que o arquivo pode ser anexado',
    html.indexOf('anexar o arquivo') !== -1 &&
    html.indexOf('não o arquivo em si') === -1);
  verificar('modo nuvem manda o gestor para a tela de Equipe',
    html.indexOf('#/pessoas') !== -1);
  verificar('modo nuvem não repete o conselho da janela anônima',
    html.indexOf('janela anônima') === -1);

  delete Store.naNuvem;

  /* -------------------------------------------------------------------------
     "Ver o sistema como": o gestor rebaixa o próprio papel para conferir

     O risco desta função é o gestor ficar preso: ao simular "consulta" ele
     deixa de ver a tela de Equipe, que é exatamente de onde a simulação é
     ligada. Por isso a faixa de aviso tem que aparecer em TODAS as telas e
     carregar o botão de volta. Estes testes existem para garantir isso.
  ------------------------------------------------------------------------- */

  console.log('\n19) Ver o sistema como outro papel');

  // --- modo local: a função não existe, e a interface não deve inventá-la
  html = renderizarRota('#/');
  verificar('modo local não mostra faixa de teste',
    html.indexOf('faixa-teste') === -1);

  // --- modo nuvem: o Store expõe a simulação, como o nuvem.js faz
  let simulado = null;
  Store.naNuvem = true;
  Store.listarPessoas = () => Promise.resolve([]);
  Store.usuario = () => ({ email: 'leonilsonk@gmail.com', emailVerified: true });
  Store.papelReal = () => 'gestor';
  Store.papelSimulado = () => simulado;
  Store.simularPapel = (novo) => {
    simulado = novo === 'equipe' || novo === 'consulta' ? novo : null;
    return true;
  };
  Store.ehGestor = () => (simulado || 'gestor') === 'gestor';
  const podeEditarReal = Store.podeEditar;
  Store.podeEditar = () => {
    const p = simulado || 'gestor';
    return p === 'gestor' || p === 'equipe';
  };

  // A lista de pessoas já está no cache desde a seção 16, então o desenho é
  // imediato e não precisa esperar promessa.
  html = renderizarRota('#/pessoas');
  verificar('gestor encontra o controle na tela de Equipe',
    html.indexOf('Ver o sistema como') !== -1 &&
    html.indexOf('data-ver-como="equipe"') !== -1 &&
    html.indexOf('data-ver-como="consulta"') !== -1, html.slice(0, 300));
  verificar('o controle avisa que não muda a permissão no servidor',
    html.indexOf('não reduz a sua permissão no servidor') !== -1);
  verificar('sem simulação não há faixa', html.indexOf('faixa-teste') === -1);

  // --- simulando consulta: o pior caso, porque é quando a tela de Equipe sai
  Store.simularPapel('consulta');

  ['#/', '#/catalogo', '#/empreendimentos', '#/dossie', '#/dados', '#/pessoas']
    .forEach(function (rota) {
      const h = renderizarRota(rota);
      verificar('faixa de teste aparece em ' + rota,
        h.indexOf('faixa-teste') !== -1, h.slice(0, 200));
      verificar('caminho de volta disponível em ' + rota,
        h.indexOf('btn-voltar-gestor') !== -1 &&
        h.indexOf('Voltar a ser gestor') !== -1);
    });

  html = renderizarRota('#/pessoas');
  verificar('simulando consulta, a tela de Equipe fica bloqueada',
    html.indexOf('Apenas o gestor do parque') !== -1);
  verificar('mesmo bloqueada, a tela traz a saída da simulação',
    html.indexOf('btn-voltar-gestor') !== -1);

  html = renderizarRota('#/pratica/1.1.1');
  verificar('simulando consulta, os campos ficam travados',
    html.indexOf('disabled') !== -1);
  verificar('não repete o aviso de modo consulta junto da faixa',
    html.indexOf('Modo consulta.') === -1, html.slice(0, 300));

  // --- simulando equipe: registra, mas não administra
  Store.simularPapel('equipe');
  html = renderizarRota('#/');
  verificar('simulando equipe, a faixa continua visível',
    html.indexOf('faixa-teste') !== -1);
  verificar('simulando equipe, "Equipe" sai do menu',
    menuHtml().indexOf('Equipe') === -1);

  // --- de volta ao normal
  Store.simularPapel(null);
  html = renderizarRota('#/');
  verificar('ao voltar a gestor a faixa desaparece',
    html.indexOf('faixa-teste') === -1);
  verificar('ao voltar a gestor o menu traz "Equipe" de novo',
    menuHtml().indexOf('Equipe') !== -1);

  Store.podeEditar = podeEditarReal;
  delete Store.naNuvem;
  delete Store.listarPessoas;
  delete Store.usuario;
  delete Store.papelReal;
  delete Store.papelSimulado;
  delete Store.simularPapel;
  delete Store.ehGestor;

  /* -------------------------------------------------------------------------
     Fase 2 — Atividades

     Coleção nova de eventos, reuniões, capacitações e outras ações. A tela
     precisa abrir vazia sem erro, oferecer o cadastro com os tipos, gerar o
     protocolo ATV-AAAA-000 e listar o que foi registrado, com os vínculos.
  ------------------------------------------------------------------------- */

  console.log('\n20) Tela de Atividades (Fase 2)');

  Store.limpar();
  html = renderizarRota('#/atividades');
  verificar('Atividades renderiza sem erro',
    html.indexOf('Ocorreu um erro ao montar esta tela') === -1 && html.length > 200,
    html.slice(0, 220));
  verificar('Atividades mostra vazio quando não há nada',
    html.indexOf('Nenhuma atividade registrada') !== -1);
  verificar('Atividades oferece o formulário de cadastro',
    html.indexOf('id="form-atividade"') !== -1);
  verificar('o cadastro traz os tipos de atividade',
    html.indexOf('value="evento"') !== -1 && html.indexOf('value="reuniao"') !== -1 &&
    html.indexOf('value="capacitacao"') !== -1 && html.indexOf('value="outra"') !== -1);
  verificar('o menu oferece Atividades', menuHtml().indexOf('Atividades') !== -1);

  Store.criarEm('atividades', {
    tipo: 'evento', titulo: 'Palestra de inovação', descricao: 'Abertura do semestre',
    data_realizacao: '2026-03-10', local: 'Auditório', responsavel: 'Equipe',
    pratica: '1.1.1', empreendimento: '', programa: 'Projeto MUDA 2026/1'
  });
  const atvCriada = Store.estado().atividades[0];
  verificar('a atividade recebe protocolo ATV-AAAA-000',
    /^ATV-2026-\d{3}$/.test(atvCriada.protocolo), atvCriada.protocolo);

  html = renderizarRota('#/atividades');
  verificar('a atividade cadastrada aparece na lista',
    html.indexOf('Palestra de inovação') !== -1);
  verificar('a lista mostra o protocolo', html.indexOf(atvCriada.protocolo) !== -1);
  verificar('a lista mostra os vínculos (prática e programa)',
    html.indexOf('Prática 1.1.1') !== -1 && html.indexOf('Projeto MUDA 2026/1') !== -1);

  /* -------------------------------------------------------------------------
     Fase 2 — Documentos/anexos no empreendimento + índice no backup

     Empreendimentos antigos (sem a lista `documentos`) abrem com a seção
     vazia. No modo local, só link; no modo nuvem, campo de arquivo. O backup
     ganha um índice dos anexos para rastreabilidade.
  ------------------------------------------------------------------------- */

  console.log('\n21) Anexos de documentos no empreendimento (Fase 2)');

  Store.carregarExemplo();
  const empAnexo = Store.estado().empreendimentos[0];

  html = renderizarRota('#/empreendimento/' + empAnexo.id);
  verificar('o detalhe tem a seção de documentos',
    html.indexOf('Documentos e anexos') !== -1, html.slice(0, 220));
  verificar('empreendimento sem documentos mostra lista vazia',
    html.indexOf('Nenhum documento anexado') !== -1);
  verificar('modo local oferece o formulário de documento sem campo de arquivo',
    html.indexOf('id="form-documento-emp"') !== -1 && html.indexOf('type="file"') === -1);

  // Grava um documento por link (modo local) e confere que aparece.
  Store.atualizarEm('empreendimentos', empAnexo.id, {
    documentos: [{
      id: Store.novoId(), titulo: 'Pitch de seleção',
      link: 'https://exemplo.org/pitch.pdf', descricao: 'Apresentação',
      data_referencia: '2026-02-01', criado_em: '2026-02-01T00:00:00.000Z'
    }]
  });
  html = renderizarRota('#/empreendimento/' + empAnexo.id);
  verificar('o documento anexado aparece', html.indexOf('Pitch de seleção') !== -1);
  verificar('o documento por link tem "abrir link"', html.indexOf('abrir link') !== -1);

  // Backup inclui o índice de anexos (empreendimento -> títulos/URLs).
  const backup = Store.exportarObjeto();
  verificar('o backup inclui índice de anexos',
    !!backup.anexos_indice && Array.isArray(backup.anexos_indice.empreendimentos));
  verificar('o índice lista o documento do empreendimento',
    JSON.stringify(backup.anexos_indice).indexOf('Pitch de seleção') !== -1);

  // Modo nuvem simulado: com enviarArquivo publicado, aparece o campo de arquivo.
  Store.enviarArquivoEmpreendimento = function () {
    return Promise.resolve({ url: '', nome: '', path: '', tamanho: 0, tipo: '' });
  };
  Store.enviarArquivo = function () { return Promise.resolve({}); };
  Store.conferirArquivo = function () { return null; };
  Store.EXTENSOES_ACEITAS = ['.pdf', '.jpg'];
  html = renderizarRota('#/empreendimento/' + empAnexo.id);
  verificar('modo nuvem mostra campo de arquivo no documento',
    html.indexOf('type="file"') !== -1);
  delete Store.enviarArquivoEmpreendimento;
  delete Store.enviarArquivo;
  delete Store.conferirArquivo;
  delete Store.EXTENSOES_ACEITAS;

  /* -------------------------------------------------------------------------
     Marcador de prática contínua (melhoria)

     Para práticas sempre em operação (sensibilização, monitoramento,
     comunicação), pedir percentual não faz sentido. Marcar "contínua" esconde
     o campo de percentual e mostra o selo "Em operação contínua". É só
     apresentação + conveniência: a regra de prontidão não muda (isso é
     coberto em teste_prontidao_web.js).
  ------------------------------------------------------------------------- */

  console.log('\n22) Marcador de prática contínua na tela');

  Store.limpar();

  // Estado comum (não contínua): o percentual aparece e o selo fica escondido.
  html = renderizarRota('#/pratica/1.1.1');
  verificar('prática comum mostra o campo de percentual',
    html.indexOf('name="percentual"') !== -1 &&
    html.indexOf('id="campo-percentual" hidden') === -1);
  verificar('prática comum mantém o selo de contínua escondido',
    html.indexOf('id="campo-selo-continua" hidden') !== -1);
  verificar('tela oferece o checkbox de prática contínua',
    html.indexOf('id="st-continua"') !== -1 && html.indexOf('name="continua"') !== -1);
  verificar('prática sugerida mostra a dica de contínua com atalho',
    html.indexOf('costuma ser contínua') !== -1 &&
    html.indexOf('id="btn-marcar-continua"') !== -1);

  // Marca como contínua (o store força percentual=100) e redesenha.
  Store.salvarStatus('1.1.1', { continua: true, situacao: 'implantada' });
  html = renderizarRota('#/pratica/1.1.1');
  verificar('marcar contínua esconde o campo de percentual',
    html.indexOf('id="campo-percentual" hidden') !== -1);
  verificar('marcar contínua mostra o selo "Em operação contínua"',
    html.indexOf('selo-continua') !== -1 &&
    html.indexOf('Em operação contínua') !== -1 &&
    html.indexOf('id="campo-selo-continua" hidden') === -1);
  verificar('o checkbox de contínua fica marcado',
    html.indexOf('id="st-continua" name="continua" checked') !== -1);
  verificar('prática já contínua não repete a dica',
    html.indexOf('id="btn-marcar-continua"') === -1);

  // O selo também aparece no catálogo, onde a situação da prática é exibida.
  html = renderizarRota('#/catalogo');
  verificar('catálogo marca a prática contínua com o selo',
    html.indexOf('selo-continua') !== -1 && html.indexOf('Em operação contínua') !== -1);

  /* -------------------------------------------------------------------------
     Vínculo EVIDÊNCIA ↔ ATIVIDADE (melhoria)

     Uma evidência (foto, relatório, lista de presença) pode apontar para uma
     atividade já cadastrada. O campo `atividade` é EXTRA e OPCIONAL: evidências
     antigas sem ele seguem válidas, o vínculo aparece na linha da evidência e
     na tela de Atividades, e NÃO toca na regra de prontidão.
  ------------------------------------------------------------------------- */

  console.log('\n23) Vínculo de evidência a atividade');

  Store.limpar();

  // (a) O formulário de evidência oferece o vínculo a atividade.
  html = renderizarRota('#/pratica/1.1.1');
  verificar('formulário de evidência oferece vincular a atividade',
    html.indexOf('Vincular a atividade (opcional)') !== -1 &&
    html.indexOf('name="atividade"') !== -1, html.slice(0, 220));

  // Cadastra uma atividade e duas evidências: uma vinculada a ela e uma ANTIGA
  // (sem o campo `atividade`), ambas no mesmo requisito obrigatório.
  Store.criarEm('atividades', {
    tipo: 'evento', titulo: 'Oficina de pitch', descricao: 'Treino de apresentação',
    data_realizacao: '2026-05-20', local: 'Sala 2', responsavel: 'Equipe',
    pratica: '1.1.1', empreendimento: '', programa: 'Projeto MUDA 2026/1'
  });
  const atvVinc = Store.estado().atividades[0];
  const reqObrigAtv = Store.buscarPratica('1.1.1').pratica.requisitos
    .filter((r) => r.obrigatorio)[0];

  Store.criarEm('evidencias', {
    pratica: '1.1.1', requisito: reqObrigAtv.id, titulo: 'Fotos da oficina',
    data_referencia: '2026-05-20', atividade: atvVinc.id
  });
  Store.criarEm('evidencias', {
    pratica: '1.1.1', requisito: reqObrigAtv.id, titulo: 'Relatório sem vínculo',
    data_referencia: '2026-05-21' // (c) evidência antiga: sem o campo `atividade`
  });

  // (b) Na tela de Atividades a evidência vinculada aparece sob a atividade.
  html = renderizarRota('#/atividades');
  verificar('a tela de Atividades reúne documentos por atividade',
    html.indexOf('Documentos por atividade') !== -1, html.slice(0, 220));
  verificar('a evidência vinculada aparece sob a atividade',
    html.indexOf('Fotos da oficina') !== -1);
  verificar('mostra a contagem de documentos da atividade',
    html.indexOf('1 documento</span>') !== -1, html.slice(0, 300));
  verificar('evidência sem vínculo NÃO aparece sob a atividade',
    html.indexOf('Relatório sem vínculo') === -1);

  // O vínculo também aparece na linha da evidência, na tela da prática, e a
  // evidência antiga (sem `atividade`) continua visível e funcionando.
  html = renderizarRota('#/pratica/1.1.1');
  verificar('a linha da evidência mostra "Atividade: <protocolo>"',
    html.indexOf('Atividade: ' + atvVinc.protocolo) !== -1, html.slice(0, 300));
  verificar('(c) evidência antiga sem atividade continua aparecendo',
    html.indexOf('Relatório sem vínculo') !== -1);

  // Atividade removida: o vínculo da evidência passa a dizer "atividade removida".
  Store.removerEm('atividades', atvVinc.id);
  html = renderizarRota('#/pratica/1.1.1');
  verificar('evidência de atividade removida mostra "atividade removida"',
    html.indexOf('atividade removida') !== -1);

  // (d) O vínculo NÃO muda a prontidão: a mesma evidência conta igual, com ou
  //     sem o campo `atividade` (faltasDaPratica ignora o campo).
  Store.limpar();
  const praticaVinc = Store.buscarPratica('1.1.1').pratica;
  const reqVinc = praticaVinc.requisitos.filter((r) => r.obrigatorio)[0];
  Store.criarEm('evidencias', {
    pratica: '1.1.1', requisito: reqVinc.id, titulo: 'Sem vínculo',
    data_referencia: '2026-01-01'
  });
  const faltasSemVinculo = _info('1.1.1').faltas.length;
  Store.limpar();
  Store.criarEm('evidencias', {
    pratica: '1.1.1', requisito: reqVinc.id, titulo: 'Com vínculo',
    data_referencia: '2026-01-01', atividade: 'id-qualquer'
  });
  const faltasComVinculo = _info('1.1.1').faltas.length;
  verificar('(d) o campo atividade não altera a prontidão',
    faltasComVinculo === faltasSemVinculo,
    faltasSemVinculo + ' vs ' + faltasComVinculo);

  /* -------------------------------------------------------------------------
     Edição de atividades e controle de pendências (melhoria)

     O DOM simulado não dispara eventos, então estas seções criam "botões" e
     "formulários" falsos que guardam o manipulador registrado pelo app.js
     (ao_click, ao_submit, ao_change) e o acionam à mão. Assim o fluxo real
     (clique -> formulário -> Store.atualizarEm) é exercitado de ponta a ponta.
  ------------------------------------------------------------------------- */

  const consultaOriginal = documento.querySelectorAll;

  function botaoFalso(atributos) {
    const el = criarElemento('falso');
    el.getAttribute = (k) => (k in atributos ? atributos[k] : null);
    el.addEventListener = (evento, fn) => { el['ao_' + evento] = fn; };
    return el;
  }
  function simularElementos(mapa) {
    documento.querySelectorAll = (seletor) => mapa[seletor] || [];
  }
  function pararSimulacao() { documento.querySelectorAll = consultaOriginal; }
  /** Formulário do DOM simulado: `elements` no formato que dadosDoForm lê. */
  function formFalso(id, valores) {
    const f = documento.getElementById(id);
    f.elements = Object.keys(valores).map((nome) => ({ name: nome, value: valores[nome] }));
    f.addEventListener = (evento, fn) => { f['ao_' + evento] = fn; };
    return f;
  }
  function semUndefined(valor) {
    if (valor === undefined) return false;
    if (valor && typeof valor === 'object') {
      return Object.keys(valor).every((k) => semUndefined(valor[k]));
    }
    return true;
  }
  const evento = { preventDefault() {} };
  const torrada = () => documento.getElementById('torrada').textContent;
  const valoresEdicao = (a, mudancas) => Object.assign({
    titulo: a.titulo || '', tipo: a.tipo || '', data_realizacao: a.data_realizacao || '',
    local: a.local || '', responsavel: a.responsavel || '', programa: a.programa || '',
    pratica: a.pratica || '', empreendimento: a.empreendimento || '',
    descricao: a.descricao || '', responsavel_pendencia: a.responsavel_pendencia || ''
  }, mudancas || {});

  // Espia as gravações: registra o que o app mandou para o Store.
  const chamadas = [];
  const atualizarOriginal = Store.atualizarEm;
  Store.atualizarEm = function (lista, id, dados) {
    chamadas.push({ lista: lista, id: id, bruto: dados, dados: JSON.parse(JSON.stringify(dados)) });
    return atualizarOriginal.apply(Store, arguments);
  };

  console.log('\n24) Edição de atividades');

  Store.limpar();
  Store.criarEm('atividades', {
    tipo: 'evento', titulo: 'Palestra de abertura', descricao: '',
    data_realizacao: '2026-12-20', local: 'Auditório', responsavel: 'Ana',
    pratica: '1.1.1', empreendimento: '', programa: ''
  });
  const atvE = Store.estado().atividades[0];
  const protoE = atvE.protocolo;

  html = renderizarRota('#/atividades');
  verificar('gestor vê o botão Editar em cada linha',
    html.indexOf('data-editar-atividade="' + atvE.id + '"') !== -1 &&
    html.indexOf('>Editar<') !== -1);
  verificar('sem edição aberta não há formulário de edição',
    html.indexOf('form-atividade-editar') === -1);
  verificar('o cadastro ganhou o campo de responsável pela complementação',
    html.indexOf('name="responsavel_pendencia"') !== -1);

  const botEditar = botaoFalso({ 'data-editar-atividade': atvE.id });
  const formEd = formFalso('form-atividade-editar', valoresEdicao(atvE));
  const btnCancelar = documento.getElementById('btn-atv-cancelar');
  btnCancelar.addEventListener = (ev, fn) => { btnCancelar['ao_' + ev] = fn; };
  simularElementos({ '[data-editar-atividade]': [botEditar] });

  renderizarRota('#/atividades');
  botEditar.ao_click();
  html = conteudo.innerHTML;
  verificar('clicar em Editar abre o formulário pré-preenchido',
    html.indexOf('id="form-atividade-editar"') !== -1 &&
    html.indexOf('value="Palestra de abertura"') !== -1 &&
    html.indexOf('value="Auditório"') !== -1 &&
    html.indexOf('value="2026-12-20"') !== -1 &&
    html.indexOf('<option value="evento" selected>') !== -1 &&
    html.indexOf('<option value="1.1.1" selected>') !== -1);
  verificar('o formulário traz Salvar e Cancelar',
    html.indexOf('Salvar alterações') !== -1 && html.indexOf('id="btn-atv-cancelar"') !== -1);
  verificar('o formulário traz o responsável pela complementação',
    html.indexOf('Responsável pela complementação (opcional)') !== -1);
  verificar('o protocolo aparece como texto somente leitura, com a nota',
    html.indexOf(protoE) !== -1 && html.indexOf('não muda') !== -1 &&
    html.indexOf('name="protocolo"') === -1);

  // (a)+(b) muda a data para OUTRO ANO e o título: só esses dois campos vão
  // para o Store, e o protocolo permanece.
  formEd.elements = Object.keys(valoresEdicao(atvE, {
    titulo: 'Palestra de abertura 2027', data_realizacao: '2027-01-08'
  })).map((n) => ({
    name: n,
    value: valoresEdicao(atvE, { titulo: 'Palestra de abertura 2027', data_realizacao: '2027-01-08' })[n]
  }));
  chamadas.length = 0;
  formEd.ao_submit(evento);
  const atvDepois = Store.estado().atividades[0];
  verificar('(b) só os campos alterados são enviados ao Store',
    chamadas.length === 1 && chamadas[0].lista === 'atividades' && chamadas[0].id === atvE.id &&
    Object.keys(chamadas[0].dados).sort().join(',') === 'data_realizacao,titulo',
    JSON.stringify(chamadas));
  verificar('(b) o que foi enviado não tem undefined', semUndefined(chamadas[0].bruto));
  verificar('(a) mudar a data para outro ano mantém o protocolo',
    atvDepois.protocolo === protoE && atvDepois.data_realizacao === '2027-01-08' &&
    atvDepois.titulo === 'Palestra de abertura 2027', atvDepois.protocolo + ' vs ' + protoE);
  verificar('o protocolo não foi enviado', !('protocolo' in chamadas[0].dados));
  verificar('o formulário fecha depois de salvar',
    conteudo.innerHTML.indexOf('form-atividade-editar') === -1);
  verificar('avisa que a atividade foi atualizada', torrada() === 'Atividade atualizada.', torrada());
  verificar('a edição grava atualizado_em', !!atvDepois.atualizado_em);
  verificar('a lista mostra o novo título e o mesmo protocolo',
    conteudo.innerHTML.indexOf('Palestra de abertura 2027') !== -1 &&
    conteudo.innerHTML.indexOf(protoE) !== -1);
  verificar('a lista mostra quando foi cadastrada e quando foi editada',
    conteudo.innerHTML.indexOf('Cadastrada em') !== -1 &&
    conteudo.innerHTML.indexOf('Editada em') !== -1);

  // (b) nada alterado: não grava e avisa.
  botEditar.ao_click();
  formEd.elements = Object.keys(valoresEdicao(atvDepois)).map((n) => ({
    name: n, value: valoresEdicao(atvDepois)[n]
  }));
  chamadas.length = 0;
  formEd.ao_submit(evento);
  verificar('(b) nada alterado: não grava', chamadas.length === 0);
  verificar('(b) nada alterado: avisa "Nada foi alterado."',
    torrada() === 'Nada foi alterado.', torrada());
  verificar('(b) nada alterado: o formulário continua aberto',
    conteudo.innerHTML.indexOf('form-atividade-editar') !== -1);

  // título vazio
  formEd.elements = Object.keys(valoresEdicao(atvDepois)).map((n) => ({
    name: n, value: valoresEdicao(atvDepois, { titulo: '   ', local: 'Mudou' })[n]
  }));
  formEd.ao_submit(evento);
  verificar('título vazio não grava e avisa', chamadas.length === 0 &&
    torrada() === 'Informe o título da atividade.', torrada());

  // responsável pela complementação é editável e tem prioridade na exibição
  formEd.elements = Object.keys(valoresEdicao(atvDepois)).map((n) => ({
    name: n, value: valoresEdicao(atvDepois, { responsavel_pendencia: 'Bruno' })[n]
  }));
  formEd.ao_submit(evento);
  verificar('responsavel_pendencia é editado e enviado sozinho',
    chamadas.length === 1 && Object.keys(chamadas[0].dados).join(',') === 'responsavel_pendencia' &&
    Store.estado().atividades[0].responsavel_pendencia === 'Bruno');
  verificar('o protocolo segue o mesmo depois de várias edições',
    Store.estado().atividades[0].protocolo === protoE);

  // cancelar
  renderizarRota('#/atividades');
  botEditar.ao_click();
  verificar('reabre o formulário', conteudo.innerHTML.indexOf('form-atividade-editar') !== -1);
  chamadas.length = 0;
  btnCancelar.ao_click();
  verificar('Cancelar fecha o formulário sem gravar',
    conteudo.innerHTML.indexOf('form-atividade-editar') === -1 && chamadas.length === 0);

  // (i) modo consulta não vê os botões nem o formulário
  botEditar.ao_click();
  Store.definirPerfil('consulta');
  html = renderizarRota('#/atividades');
  verificar('(i) consulta: sem botão Editar nem Remover',
    html.indexOf('data-editar-atividade') === -1 &&
    html.indexOf('data-remover-atividade') === -1);
  verificar('(i) consulta: sem formulário de edição, mesmo com edição aberta antes',
    html.indexOf('form-atividade-editar') === -1 && html.indexOf('Salvar alterações') === -1);
  verificar('(i) consulta: continua vendo a situação da documentação',
    html.indexOf('Pendente (') !== -1 && html.indexOf('Faltam:') !== -1);
  chamadas.length = 0;
  formEd.ao_submit(evento);
  verificar('(i) consulta: um envio atrasado do formulário não grava', chamadas.length === 0);
  botEditar.ao_click();
  verificar('(i) consulta: clicar num botão antigo não abre edição',
    conteudo.innerHTML.indexOf('form-atividade-editar') === -1);
  Store.definirPerfil('gestor');
  btnCancelar.ao_click(); // zera a edição pendente
  verificar('gestor de volta: sem edição aberta',
    conteudo.innerHTML.indexOf('form-atividade-editar') === -1);

  // autoria na lista
  Store.estado().atividades[0].criado_por_nome = 'Maria <b>';
  Store.estado().atividades[0].atualizado_por_nome = 'João';
  html = renderizarRota('#/atividades');
  verificar('mostra "Cadastrada por <nome> em <data>"',
    html.indexOf('Cadastrada por Maria &lt;b&gt; em ') !== -1, html.slice(0, 200));
  verificar('mostra "Editada por <nome> em <data>"', html.indexOf('Editada por João em ') !== -1);
  verificar('nome de autor é escapado', html.indexOf('Maria <b>') === -1);

  // dado antigo, sem autoria nenhuma
  Store.limpar();
  Store.estado().atividades.push({
    id: 'velha1', tipo: 'evento', titulo: 'Atividade antiga sem autoria',
    data_realizacao: '2024-05-01'
  });
  html = renderizarRota('#/atividades');
  verificar('atividade antiga renderiza sem erro',
    html.indexOf('Ocorreu um erro ao montar esta tela') === -1 &&
    html.indexOf('Atividade antiga sem autoria') !== -1);
  verificar('atividade antiga: omite as linhas de autoria',
    html.indexOf('Cadastrada') === -1 && html.indexOf('Editada') === -1);
  verificar('atividade antiga: aparece como Pendente/Incompleta sem quebrar',
    html.indexOf('Incompleta') !== -1 || html.indexOf('Pendente (') !== -1);

  console.log('\n25) Controle de pendências das atividades');

  Store.limpar();
  const novaAtv = (extra) => {
    Store.criarEm('atividades', Object.assign({
      tipo: 'evento', titulo: 'x', descricao: '', data_realizacao: '2026-05-10',
      local: 'Sala 1', responsavel: 'Ana', pratica: '1.1.1', empreendimento: '', programa: ''
    }, extra));
    const todas = Store.estado().atividades;
    return todas[todas.length - 1];
  };
  const aPend = novaAtv({ titulo: 'Evento Pendente' });
  const aComp = novaAtv({ titulo: 'Acao Completa', tipo: 'outra' });
  const aInc = novaAtv({ titulo: 'Acao Incompleta', tipo: 'outra', local: '' });
  const aSemResp = novaAtv({ titulo: 'Sem Responsavel', tipo: 'outra', responsavel: '' });
  const faltasAntesAtv = JSON.stringify(_info('1.1.1').faltas);
  const aptoAntes = Store.calcularProntidao().apto_nivel;

  html = renderizarRota('#/atividades');
  verificar('a tabela tem a coluna Documentação', html.indexOf('<th>Documentação</th>') !== -1);
  verificar('evento sem documentos: etiqueta amarela "Pendente (3)"',
    html.indexOf('<span class="etiqueta amarela">Pendente (3)</span>') !== -1);
  verificar('ação sem pendência: etiqueta verde "Completa"',
    html.indexOf('<span class="etiqueta verde">Completa</span>') !== -1);
  verificar('cadastro com campo faltando: etiqueta vermelha "Incompleta"',
    html.indexOf('<span class="etiqueta vermelha">Incompleta</span>') !== -1);
  verificar('o filtro Documentação existe com as 4 opções',
    html.indexOf('id="f-atv-doc"') !== -1 && html.indexOf('>Todas<') !== -1 &&
    html.indexOf('<option value="completa">') !== -1 &&
    html.indexOf('<option value="pendente">') !== -1 &&
    html.indexOf('<option value="incompleta">') !== -1);

  // detalhe das pendências (gestor)
  verificar('detalhe: "Faltam:" com botão Dispensar ao lado de cada documento',
    html.indexOf('<strong>Faltam:</strong> Lista de presença <button') !== -1 &&
    html.indexOf('data-dispensar-doc="' + aPend.id + '" data-tipo-doc="lista_presenca"') !== -1 &&
    html.indexOf('data-dispensar-doc="' + aPend.id + '" data-tipo-doc="relatorio"') !== -1);
  verificar('detalhe: "Cadastro incompleto: sem local"',
    html.indexOf('<strong>Cadastro incompleto:</strong> sem local') !== -1);
  verificar('detalhe: sem responsável nem complementação mostra "—"',
    html.indexOf('Responsável pela complementação: <strong>—</strong>') !== -1);
  verificar('detalhe: sem responsavel_pendencia usa o responsável do cadastro',
    html.indexOf('Responsável pela complementação: <strong>Ana</strong>') !== -1);
  Store.atualizarEm('atividades', aPend.id, { responsavel_pendencia: 'Carlos' });
  html = renderizarRota('#/atividades');
  verificar('detalhe: responsavel_pendencia tem prioridade sobre o responsável',
    html.indexOf('Responsável pela complementação: <strong>Carlos</strong>') !== -1);
  verificar('atividade completa não mostra responsável pela complementação',
    (html.match(/Responsável pela complementação: <strong>/g) || []).length === 3);
  verificar('tipo "outra" explica que não há documento específico',
    html.indexOf('Nenhum documento específico') !== -1);

  // filtro Documentação (mesmo padrão dos outros filtros)
  const fDoc = documento.getElementById('f-atv-doc');
  fDoc.addEventListener = (ev, fn) => { fDoc['ao_' + ev] = fn; };
  renderizarRota('#/atividades');
  const titulosNaTela = () => ['Evento Pendente', 'Acao Completa', 'Acao Incompleta', 'Sem Responsavel']
    .filter((t) => conteudo.innerHTML.indexOf('<strong>' + t + '</strong>') !== -1).join('|');
  fDoc.value = 'pendente'; fDoc.ao_change();
  verificar('(e) filtro Pendente mostra só a pendente', titulosNaTela() === 'Evento Pendente', titulosNaTela());
  verificar('(e) o filtro fica marcado no menu', conteudo.innerHTML.indexOf('value="pendente" selected') !== -1);
  fDoc.value = 'completa'; fDoc.ao_change();
  verificar('(e) filtro Completa mostra só a completa', titulosNaTela() === 'Acao Completa', titulosNaTela());
  fDoc.value = 'incompleta'; fDoc.ao_change();
  verificar('(e) filtro Incompleta mostra as incompletas',
    titulosNaTela() === 'Acao Incompleta|Sem Responsavel', titulosNaTela());
  fDoc.value = ''; fDoc.ao_change();
  verificar('(e) filtro Todas mostra tudo', titulosNaTela().split('|').length === 4, titulosNaTela());

  // classificar uma evidência vinculada, sem tipo
  Store.criarEm('evidencias', {
    pratica: '1.1.1', requisito: null, refere_a: 'x', titulo: 'Foto da turma',
    data_referencia: '2026-05-10', atividade: aPend.id, tipo_documento: ''
  });
  const evSemTipo = Store.estado().evidencias[0];
  html = renderizarRota('#/atividades');
  verificar('evidência sem tipo: gestor vê o seletor de classificação',
    html.indexOf('data-classificar-evidencia="' + evSemTipo.id + '"') !== -1 &&
    html.indexOf('Classificar documento') !== -1);
  verificar('evidência sem tipo NÃO reduz as pendências',
    html.indexOf('<span class="etiqueta amarela">Pendente (3)</span>') !== -1);

  Store.definirPerfil('consulta');
  html = renderizarRota('#/atividades');
  verificar('(i) consulta: não vê o seletor, mas vê "tipo não informado"',
    html.indexOf('data-classificar-evidencia') === -1 &&
    html.indexOf('tipo não informado') !== -1);
  verificar('(i) consulta: não vê Dispensar nem Desfazer dispensa',
    html.indexOf('data-dispensar-doc') === -1 && html.indexOf('data-desfazer-dispensa') === -1);
  verificar('(i) consulta: vê "Faltam:" sem botões',
    html.indexOf('<strong>Faltam:</strong> Lista de presença, Registro fotográfico, Relatório') !== -1);
  Store.definirPerfil('gestor');

  const seletor = botaoFalso({ 'data-classificar-evidencia': evSemTipo.id });
  simularElementos({ '[data-classificar-evidencia]': [seletor] });
  renderizarRota('#/atividades');
  chamadas.length = 0;
  seletor.value = '';
  seletor.ao_change();
  verificar('escolher "Classificar documento…" (vazio) não grava', chamadas.length === 0);
  seletor.value = 'lista_presenca';
  seletor.ao_change();
  verificar('classificar chama atualizarEm em evidencias só com tipo_documento',
    chamadas.length === 1 && chamadas[0].lista === 'evidencias' &&
    chamadas[0].id === evSemTipo.id &&
    JSON.stringify(chamadas[0].dados) === '{"tipo_documento":"lista_presenca"}',
    JSON.stringify(chamadas));
  html = conteudo.innerHTML;
  verificar('a evidência classificada reduz as pendências (3 -> 2)',
    html.indexOf('<span class="etiqueta amarela">Pendente (2)</span>') !== -1);
  verificar('a evidência classificada mostra o tipo e perde o seletor',
    html.indexOf('data-classificar-evidencia') === -1 &&
    html.indexOf('<span class="etiqueta cinza">Lista de presença</span>') !== -1);

  // dispensa com motivo
  const botDisp = botaoFalso({
    'data-dispensar-doc': aPend.id, 'data-tipo-doc': 'registro_fotografico'
  });
  simularElementos({ '[data-dispensar-doc]': [botDisp] });
  renderizarRota('#/atividades');
  let perguntou = null;
  janela.prompt = (texto) => { perguntou = texto; return '   '; };
  chamadas.length = 0;
  botDisp.ao_click();
  verificar('dispensar pergunta o motivo', perguntou !== null && perguntou.indexOf('Registro fotográfico') !== -1);
  verificar('motivo em branco não dispensa e avisa',
    chamadas.length === 0 && torrada() === 'Informe o motivo para dispensar o documento.', torrada());
  janela.prompt = () => null;
  botDisp.ao_click();
  verificar('cancelar o prompt não dispensa', chamadas.length === 0);

  janela.prompt = () => '  Evento interno, sem fotos <b>  ';
  botDisp.ao_click();
  const dispensas = Store.estado().atividades.filter((x) => x.id === aPend.id)[0].docs_dispensados;
  verificar('dispensa grava só docs_dispensados (lista completa) via atualizarEm',
    chamadas.length === 1 && chamadas[0].lista === 'atividades' &&
    Object.keys(chamadas[0].dados).join(',') === 'docs_dispensados' &&
    Array.isArray(dispensas) && dispensas.length === 1);
  verificar('a dispensa guarda tipo, motivo aparado, por_nome e data ISO, sem undefined',
    dispensas[0].tipo === 'registro_fotografico' &&
    dispensas[0].motivo === 'Evento interno, sem fotos <b>' &&
    dispensas[0].por_nome === '' && !isNaN(Date.parse(dispensas[0].em)) &&
    semUndefined(chamadas[0].bruto), JSON.stringify(dispensas));
  html = conteudo.innerHTML;
  verificar('dispensado deixa de contar como pendente (2 -> 1)',
    html.indexOf('<span class="etiqueta amarela">Pendente (1)</span>') !== -1);
  verificar('mostra "Dispensados:" com o motivo (escapado)',
    html.indexOf('<strong>Dispensados:</strong> Registro fotográfico (Evento interno, sem fotos &lt;b&gt;)') !== -1 &&
    html.indexOf('Evento interno, sem fotos <b>') === -1);
  verificar('oferece "Desfazer dispensa"',
    html.indexOf('data-desfazer-dispensa="' + aPend.id + '" data-tipo-doc="registro_fotografico"') !== -1);

  // por_nome vem do usuário logado (nuvem) quando disponível
  Store.usuario = () => ({ displayName: 'Fulana', email: 'f@x.org' });
  const botDisp2 = botaoFalso({ 'data-dispensar-doc': aPend.id, 'data-tipo-doc': 'relatorio' });
  simularElementos({ '[data-dispensar-doc]': [botDisp2] });
  renderizarRota('#/atividades');
  janela.prompt = () => 'Sem relatório neste caso';
  botDisp2.ao_click();
  delete Store.usuario;
  const dispensas2 = Store.estado().atividades.filter((x) => x.id === aPend.id)[0].docs_dispensados;
  verificar('por_nome recebe o nome do usuário quando há login',
    dispensas2.length === 2 && dispensas2[1].tipo === 'relatorio' && dispensas2[1].por_nome === 'Fulana' &&
    dispensas2[0].tipo === 'registro_fotografico', JSON.stringify(dispensas2));
  verificar('tudo atendido/dispensado => Completa',
    Store.situacaoDocumentalDaAtividade(
      Store.estado().atividades.filter((x) => x.id === aPend.id)[0]
    ).situacao === 'completa');

  // dispensar tipo que não está faltando é ignorado
  const botDisp3 = botaoFalso({ 'data-dispensar-doc': aPend.id, 'data-tipo-doc': 'lista_presenca' });
  simularElementos({ '[data-dispensar-doc]': [botDisp3] });
  renderizarRota('#/atividades');
  chamadas.length = 0;
  botDisp3.ao_click();
  verificar('dispensar documento que já está atendido é ignorado', chamadas.length === 0);

  // desfazer
  const botDes = botaoFalso({
    'data-desfazer-dispensa': aPend.id, 'data-tipo-doc': 'registro_fotografico'
  });
  simularElementos({ '[data-desfazer-dispensa]': [botDes] });
  renderizarRota('#/atividades');
  chamadas.length = 0;
  botDes.ao_click();
  const dispensas3 = Store.estado().atividades.filter((x) => x.id === aPend.id)[0].docs_dispensados;
  verificar('desfazer dispensa grava a lista sem o tipo',
    chamadas.length === 1 && dispensas3.length === 1 && dispensas3[0].tipo === 'relatorio' &&
    semUndefined(chamadas[0].bruto));
  verificar('o documento volta a ser pendente (Pendente (1))',
    conteudo.innerHTML.indexOf('<span class="etiqueta amarela">Pendente (1)</span>') !== -1);

  // consulta nunca dispensa, mesmo com botão antigo na mão
  Store.definirPerfil('consulta');
  chamadas.length = 0;
  botDes.ao_click();
  botDisp.ao_click();
  verificar('(i) consulta: botões antigos não gravam nada', chamadas.length === 0);
  Store.definirPerfil('gestor');

  // (f) as pendências não mexem na prontidão
  verificar('(f) as pendências de atividades não mudam as faltas da prática',
    JSON.stringify(_info('1.1.1').faltas) === faltasAntesAtv);
  verificar('(f) nem o nível de aptidão', Store.calcularProntidao().apto_nivel === aptoAntes);

  // formulário de evidência: tipo do documento
  html = renderizarRota('#/pratica/1.1.1');
  verificar('o formulário de evidência oferece o tipo do documento (opcional)',
    html.indexOf('Tipo do documento (opcional)') !== -1 &&
    html.indexOf('name="tipo_documento"') !== -1 &&
    html.indexOf('— não informado —') !== -1);
  verificar('o seletor lista os 5 tipos de documento',
    ['lista_presenca', 'registro_fotografico', 'relatorio', 'ata', 'outro']
      .every((v) => html.indexOf('<option value="' + v + '">') !== -1));

  const formEv = botaoFalso({});
  formEv.elements = [
    { name: 'titulo', value: 'Lista assinada' }, { name: 'refere_a', value: 'x' },
    { name: 'data_referencia', value: '2026-05-10' }, { name: 'atividade', value: aPend.id },
    { name: 'tipo_documento', value: ' lista_presenca ' }
  ];
  simularElementos({ '[data-form-evidencia-propria]': [formEv] });
  renderizarRota('#/pratica/1.1.1');
  formEv.ao_submit(evento);
  let evNova = Store.estado().evidencias.filter((x) => x.titulo === 'Lista assinada')[0];
  verificar('enviarEvidencia grava tipo_documento aparado',
    !!evNova && evNova.tipo_documento === 'lista_presenca' && evNova.atividade === aPend.id);
  formEv.elements = [{ name: 'titulo', value: 'Sem tipo' }, { name: 'refere_a', value: 'x' }];
  formEv.ao_submit(evento);
  evNova = Store.estado().evidencias.filter((x) => x.titulo === 'Sem tipo')[0];
  verificar('sem tipo informado grava string vazia (nunca undefined)',
    !!evNova && evNova.tipo_documento === '' && semUndefined(evNova));

  // (g) painel
  pararSimulacao();
  const resPainel = Store.resumo();
  html = renderizarRota('#/');
  const achouPainel = /Atividades com documentação pendente<\/div><div class="valor">(\d+)<\/div>/.exec(html);
  verificar('(g) o painel mostra o indicador "Atividades com documentação pendente"',
    !!achouPainel, html.slice(0, 200));
  verificar('(g) o valor é pendentes + incompletas',
    !!achouPainel && Number(achouPainel[1]) === resPainel.atividades_pendentes &&
    // 1 pendente (Evento Pendente: falta só o registro fotográfico) + 2
    // incompletas (Acao Incompleta e Sem Responsavel) = 3.
    resPainel.atividades_com_documentos_faltando === 1 &&
    resPainel.atividades_incompletas === 2 && resPainel.atividades_pendentes === 3,
    achouPainel && achouPainel[1]);
  verificar('(g) o indicador leva para as atividades', html.indexOf('href="#/atividades"') !== -1);
  verificar('(g) os indicadores existentes continuam',
    ['Práticas completas', 'Evidências registradas', 'Medições lançadas', 'Planos de ação abertos']
      .every((t) => html.indexOf(t) !== -1));

  console.log('\n26) Histórico mostra o que mudou');

  Store.naNuvem = true;
  Store.estado().historico = [
    {
      id: 'h1', colecao: 'atividades', registro_id: 'a', acao: 'editar',
      resumo: 'Atividade — Palestra (ATV-2026-001)', quando: '2026-04-01T12:00:00.000Z',
      quem: 'u1', quem_nome: 'Maria',
      alteracoes: [
        { campo: 'titulo', de: 'Palestra', para: 'Palestra <b>2</b>' },
        { campo: 'data_realizacao', de: '2026-12-20', para: '2027-01-08' },
        { campo: 'tipo', de: 'evento', para: 'reuniao' },
        { campo: 'local', de: '', para: 'Sala 3' },
        { campo: 'campo_inventado', de: 'a', para: 'b' }
      ]
    },
    {
      id: 'h2', colecao: 'evidencias', registro_id: 'e', acao: 'editar',
      resumo: 'Evidência antiga sem alteracoes', quando: '2026-03-01T09:00:00.000Z',
      quem: 'u2', quem_nome: 'João'
    },
    {
      id: 'h3', colecao: 'planos', registro_id: 'p', acao: 'editar',
      resumo: 'Plano com alteracoes malformadas', quando: '2026-02-01T09:00:00.000Z',
      quem: 'u2', quem_nome: 'João', alteracoes: 'lixo'
    },
    {
      id: 'h4', colecao: 'planos', registro_id: 'p', acao: 'editar',
      resumo: 'Plano com itens vazios', quando: '2026-01-01T09:00:00.000Z',
      quem: 'u2', quem_nome: 'João', alteracoes: [null, {}, { campo: '' }]
    }
  ];
  html = renderizarRota('#/historico');
  verificar('(h) histórico renderiza sem erro',
    html.indexOf('Ocorreu um erro ao montar esta tela') === -1 &&
    html.indexOf('Histórico de alterações') !== -1, html.slice(0, 200));
  verificar('(h) mostra "campo: de → para" com rótulos amigáveis',
    html.indexOf('<strong>Título:</strong> Palestra → Palestra &lt;b&gt;2&lt;/b&gt;') !== -1 &&
    html.indexOf('<strong>Data de realização:</strong> 2026-12-20 → 2027-01-08') !== -1,
    html.slice(0, 300));
  verificar('(h) o tipo aparece pelo rótulo (Evento → Reunião)',
    html.indexOf('<strong>Tipo:</strong> Evento → Reunião') !== -1);
  verificar('(h) valor vazio aparece como (vazio)',
    html.indexOf('<strong>Local:</strong> (vazio) → Sala 3') !== -1);
  verificar('(h) campo desconhecido mostra o nome do campo',
    html.indexOf('<strong>campo_inventado:</strong> a → b') !== -1);
  verificar('(h) valores são escapados', html.indexOf('<b>2</b>') === -1);
  verificar('(h) item antigo, sem alteracoes, continua aparecendo',
    html.indexOf('Evidência antiga sem alteracoes') !== -1);
  verificar('(h) alteracoes malformadas não quebram nem geram lista',
    html.indexOf('Plano com alteracoes malformadas') !== -1 &&
    html.indexOf('Plano com itens vazios') !== -1 &&
    (html.match(/<ul class="alteracoes">/g) || []).length === 1);
  Store.estado().historico = [];
  delete Store.naNuvem;

  /* -------------------------------------------------------------------------
     Vários arquivos por evidência e por documento de empreendimento

     Os arquivos sobem um por vez e viram UM registro (`arquivos` com todos,
     `arquivo` com o primeiro). Se um falhar, nada é registrado e os já
     enviados são apagados. Registros antigos (só `arquivo`) seguem iguais.

     O armazenamento é simulado: Store.enviarArquivo & cia. gravam cada
     chamada, e o formulário falso guarda botão, barra e lista de escolhidos.
  ------------------------------------------------------------------------- */

  /** Espera (em ciclos do laço de eventos) até a condição valer. */
  async function aguardar(condicao) {
    for (let i = 0; i < 300 && !condicao(); i++) await esperarPromessas();
    return condicao();
  }

  const arqFalso = (nome, tamanho) => ({ name: nome, size: tamanho || 2048, type: 'application/pdf' });

  // Armazenamento simulado (o modo nuvem publica estas funções no Store).
  const envios = [];
  const removidosDoBucket = [];
  let ativos = 0;
  let maxAtivos = 0;
  let formAtual = null;
  let falharNoEnvio = -1; // índice (0-based) do envio que deve falhar; -1 = nenhum
  const alertas = [];
  const alertOriginal = janela.alert;
  janela.alert = (m) => { alertas.push(String(m)); };

  function simularEnvio(tipo) {
    return function (alvo, data, arquivo, aoProgresso, indice) {
      const chamada = {
        tipo: tipo, alvo: alvo, data: data, arquivo: arquivo, indice: indice,
        botaoTravado: formAtual.fake.botao.disabled,
        rotuloBotao: formAtual.fake.botao.textContent,
        textoAntes: formAtual.fake.texto.textContent
      };
      envios.push(chamada);
      ativos++;
      maxAtivos = Math.max(maxAtivos, ativos);
      return new Promise((resolve, reject) => {
        setTimeout(() => {
          aoProgresso(50);
          chamada.texto50 = formAtual.fake.texto.textContent;
          chamada.largura50 = formAtual.fake.preenchimento.style.width;
          setTimeout(() => {
            ativos--;
            if (envios.indexOf(chamada) === falharNoEnvio) {
              reject(new Error('rede caiu em ' + arquivo.name));
              return;
            }
            const nomeNoBucket = 'm-' + (indice + 1) + '-' + arquivo.name;
            const base = {
              url: 'https://armazem.test/' + nomeNoBucket,
              nome: arquivo.name, tamanho: arquivo.size, tipo: arquivo.type
            };
            resolve(tipo === 'evidencia'
              ? Object.assign({ caminho: 'evidencias/CERNE1/1.1.1/2026/' + nomeNoBucket }, base)
              : Object.assign({ path: 'empreendimentos/' + alvo + '/2026/' + nomeNoBucket }, base));
          }, 0);
        }, 0);
      });
    };
  }

  function instalarArmazenamentoFalso() {
    Store.EXTENSOES_ACEITAS = ['.pdf', '.jpg'];
    Store.conferirArquivo = (arq) => {
      if (/\.exe$/.test(arq.name)) return 'Tipo de arquivo não aceito (.exe).';
      if (arq.size > 20 * 1024 * 1024) return 'O arquivo tem 25.0 MB e o limite é 20 MB.';
      return null;
    };
    Store.enviarArquivo = simularEnvio('evidencia');
    Store.enviarArquivoEmpreendimento = simularEnvio('empreendimento');
    Store.removerArquivo = (c) => { removidosDoBucket.push(c); return Promise.resolve(); };
  }
  function removerArmazenamentoFalso() {
    delete Store.EXTENSOES_ACEITAS;
    delete Store.conferirArquivo;
    delete Store.enviarArquivo;
    delete Store.enviarArquivoEmpreendimento;
    delete Store.removerArquivo;
  }
  function zerarRegistros() {
    envios.length = 0; removidosDoBucket.length = 0; alertas.length = 0;
    ativos = 0; maxAtivos = 0; falharNoEnvio = -1;
  }

  /** Formulário com campo de arquivo, botão, barra de progresso e lista de escolhidos. */
  function formularioDeAnexos(atributos, valores, arquivos, rotuloBotao, elementoReal) {
    const f = elementoReal || botaoFalso(atributos);
    const botao = { disabled: false, textContent: rotuloBotao };
    const preenchimento = { style: {} };
    const texto = { textContent: '' };
    const barra = {
      hidden: true,
      querySelector: (s) => (s === '.envio-trilha > span' ? preenchimento : s === '.envio-texto' ? texto : null)
    };
    const lista = { innerHTML: '' };
    f.querySelector = (s) => (s === 'button[type="submit"]' ? botao
      : s === '.envio-barra' ? barra : s === '.arquivos-escolhidos' ? lista : null);
    f.elements = Object.keys(valores).map((nome) => ({ name: nome, value: valores[nome] }))
      .concat([{ name: 'arquivo', type: 'file', files: arquivos }]);
    f.fake = { botao, preenchimento, texto, barra, lista };
    return f;
  }

  const evidenciasDe = (titulo) => Store.estado().evidencias.filter((x) => x.titulo === titulo);
  const contaDe = (html, trecho) => html.split(trecho).length - 1;

  console.log('\n27) Anexar vários arquivos: campos com `multiple`');

  Store.limpar();
  html = renderizarRota('#/pratica/1.1.1');
  verificar('(a) sem armazenamento (modo local) nenhum campo de arquivo aparece',
    html.indexOf('type="file"') === -1);

  instalarArmazenamentoFalso();
  html = renderizarRota('#/pratica/1.1.1');
  const camposPratica = html.match(/<input type="file"[^>]*>/g) || [];
  const nRequisitos = (praticaTeste.requisitos || []).length;
  verificar('(a) tela da prática: um campo por requisito + o da evidência própria',
    camposPratica.length === nRequisitos + 1, camposPratica.length + ' vs ' + (nRequisitos + 1));
  verificar('(a) TODOS os campos da prática têm `multiple`',
    camposPratica.length > 0 && camposPratica.every((c) => / multiple[ >]/.test(c)), camposPratica[0]);
  verificar('(a) o `accept` continua nos campos',
    camposPratica.every((c) => c.indexOf('accept=".pdf,.jpg"') !== -1));
  verificar('(a) texto de ajuda informa o máximo de 10 arquivos de até 20 MB',
    contaDe(html, 'Você pode selecionar vários arquivos (até 10, cada um com até 20 MB).') === nRequisitos + 1);
  verificar('(a) cada campo tem a área da lista de escolhidos e a barra de progresso',
    contaDe(html, 'class="arquivos-escolhidos"') === nRequisitos + 1 &&
    contaDe(html, 'class="envio-barra"') === nRequisitos + 1);

  Store.criarEm('empreendimentos', {
    nome: 'Empresa Anexos', setor: 'Software', estagio: 'pre_incubado', situacao: 'ativo'
  });
  const empAnexos = Store.estado().empreendimentos[0];
  html = renderizarRota('#/empreendimento/' + empAnexos.id);
  const camposEmp = html.match(/<input type="file"[^>]*>/g) || [];
  verificar('(a) o formulário de documento do empreendimento tem `multiple`',
    camposEmp.length === 1 && / multiple[ >]/.test(camposEmp[0]) &&
    camposEmp[0].indexOf('accept=".pdf,.jpg"') !== -1, camposEmp.join(' | '));

  html = renderizarRota('#/dados');
  const camposDados = html.match(/<input type="file"[^>]*>/g) || [];
  verificar('(a) a importação de backup continua sendo de 1 arquivo (sem `multiple`)',
    html.indexOf('id="arq-importar"') !== -1 && camposDados.length === 1 &&
    camposDados[0].indexOf('arq-importar') !== -1 && camposDados[0].indexOf('multiple') === -1,
    camposDados.join(' | '));

  console.log('\n28) Lista dos arquivos escolhidos (evento change)');

  const formLista = formularioDeAnexos({ 'data-form-evidencia': reqObrigatorio.id },
    { titulo: 'x' }, [], 'Registrar evidência');
  simularElementos({ '[data-form-evidencia]': [formLista] });
  renderizarRota('#/pratica/1.1.1');
  verificar('o formulário escuta o `change` do campo de arquivo', typeof formLista.ao_change === 'function');
  formLista.ao_change({ target: { type: 'file', files: [arqFalso('ata.pdf', 2048), arqFalso('foto <b>1</b>.jpg', 5 * 1024 * 1024)] } });
  verificar('mostra nome e tamanho de cada arquivo escolhido',
    formLista.fake.lista.innerHTML.indexOf('ata.pdf') !== -1 &&
    formLista.fake.lista.innerHTML.indexOf('(2 KB)') !== -1 &&
    formLista.fake.lista.innerHTML.indexOf('(5.0 MB)') !== -1 &&
    formLista.fake.lista.innerHTML.indexOf('2 arquivos escolhidos') !== -1,
    formLista.fake.lista.innerHTML);
  verificar('o nome do arquivo é escapado',
    formLista.fake.lista.innerHTML.indexOf('<b>1</b>') === -1 &&
    formLista.fake.lista.innerHTML.indexOf('&lt;b&gt;1&lt;/b&gt;') !== -1);
  verificar('dentro do limite não há aviso', formLista.fake.lista.innerHTML.indexOf('máximo') === -1);
  formLista.ao_change({ target: { type: 'file', files: Array.from({ length: 11 }, (_, i) => arqFalso('a' + i + '.pdf')) } });
  verificar('passou de 10: avisa o máximo', formLista.fake.lista.innerHTML.indexOf('o máximo é 10') !== -1 &&
    formLista.fake.lista.innerHTML.indexOf('11 arquivos escolhidos') !== -1);
  formLista.ao_change({ target: { type: 'file', files: [] } });
  verificar('sem arquivos a lista é esvaziada', formLista.fake.lista.innerHTML === '');
  formLista.fake.lista.innerHTML = 'intacto';
  formLista.ao_change({ target: { type: 'text', value: 'x' } });
  verificar('mudança em campo que não é de arquivo é ignorada', formLista.fake.lista.innerHTML === 'intacto');

  console.log('\n29) Enviar 3 arquivos: um por vez, UM registro');

  Store.limpar();
  zerarRegistros();
  const tresArquivos = [arqFalso('ata.pdf', 1000), arqFalso('lista.pdf', 2000), arqFalso('foto.jpg', 3000)];
  const formReq = formularioDeAnexos({ 'data-form-evidencia': reqObrigatorio.id }, {
    titulo: 'Tres anexos', data_referencia: '2026-05-10', link: '', responsavel: 'Ana', descricao: 'obs'
  }, tresArquivos, 'Registrar evidência');
  formAtual = formReq;
  simularElementos({ '[data-form-evidencia]': [formReq] });
  renderizarRota('#/pratica/1.1.1');
  conteudo.innerHTML = 'MARCADOR';
  const criarOriginal = Store.criarEm;
  const criacoes = [];
  Store.criarEm = function (lista, registro) {
    criacoes.push({ lista: lista, registro: registro });
    return criarOriginal.apply(Store, arguments);
  };

  formReq.ao_submit(evento);
  verificar('o botão trava e o texto muda assim que o envio começa',
    formReq.fake.botao.disabled === true && formReq.fake.botao.textContent === 'Enviando arquivos...');
  verificar('nada é gravado antes de todos subirem', evidenciasDe('Tres anexos').length === 0);
  await aguardar(() => evidenciasDe('Tres anexos').length > 0);

  verificar('(b) Store.enviarArquivo foi chamado 3 vezes', envios.length === 3, envios.length);
  verificar('(b) um de cada vez, nunca em paralelo', maxAtivos === 1, maxAtivos);
  verificar('(b) na ordem escolhida',
    envios.map((x) => x.arquivo.name).join(',') === 'ata.pdf,lista.pdf,foto.jpg');
  verificar('(b) cada chamada leva prática, data e o índice do arquivo no lote',
    envios.every((x, i) => x.alvo === '1.1.1' && x.data === '2026-05-10' && x.indice === i));
  verificar('(b) o botão fica travado durante todos os envios',
    envios.every((x) => x.botaoTravado === true && x.rotuloBotao === 'Enviando arquivos...'));
  verificar('(b) texto geral: "Enviando arquivo N de 3…"',
    envios[0].textoAntes.indexOf('Enviando arquivo 1 de 3… 0%') === 0 &&
    envios[1].textoAntes.indexOf('Enviando arquivo 2 de 3… 33%') === 0 &&
    envios[2].textoAntes.indexOf('Enviando arquivo 3 de 3… 67%') === 0,
    envios.map((x) => x.textoAntes).join(' | '));
  verificar('(b) a barra é geral: (concluídos + % do atual) / total',
    envios[0].largura50 === '17%' && envios[1].largura50 === '50%' && envios[2].largura50 === '83%',
    envios.map((x) => x.largura50).join(' | '));
  verificar('(b) termina em 100%', formReq.fake.preenchimento.style.width === '100%');

  const criadasEv = criacoes.filter((c) => c.lista === 'evidencias');
  verificar('(b) Store.criarEm foi chamado UMA vez (um registro por envio)', criadasEv.length === 1, criadasEv.length);
  const evTres = evidenciasDe('Tres anexos')[0];
  verificar('(b) a evidência tem arquivos.length === 3',
    !!evTres && Array.isArray(evTres.arquivos) && evTres.arquivos.length === 3);
  verificar('(b) `arquivo` é o primeiro de `arquivos`',
    !!evTres && JSON.stringify(evTres.arquivo) === JSON.stringify(evTres.arquivos[0]) &&
    evTres.arquivo.nome === 'ata.pdf');
  verificar('(b) os anexos guardam url, nome, caminho, tamanho e tipo, na ordem',
    !!evTres && evTres.arquivos.map((a) => a.nome).join(',') === 'ata.pdf,lista.pdf,foto.jpg' &&
    evTres.arquivos.every((a) => a.url && a.caminho && a.tamanho && a.tipo));
  verificar('(b) os caminhos são distintos', !!evTres && new Set(evTres.arquivos.map((a) => a.caminho)).size === 3);
  verificar('(b) o registro não tem undefined e tem protocolo',
    !!evTres && semUndefined(criadasEv[0].registro) && /^[A-Z]+-\d{4}-\d+$/.test(evTres.protocolo || ''), evTres && evTres.protocolo);
  verificar('(b) continua sendo evidência do requisito (conta para a prontidão)',
    !!evTres && evTres.requisito === reqObrigatorio.id && evTres.pratica === '1.1.1');
  verificar('(b) botão volta ao normal e a barra some',
    formReq.fake.botao.disabled === false && formReq.fake.botao.textContent === 'Registrar evidência' &&
    formReq.fake.barra.hidden === true);
  verificar('(b) avisa o sucesso com a quantidade',
    torrada() === 'Evidência registrada com 3 arquivos anexados.', torrada());
  verificar('(b) a tela é redesenhada', conteudo.innerHTML !== 'MARCADOR');
  verificar('(b) nenhum alerta de erro', alertas.length === 0, alertas.join('|'));
  const faltasComTres = JSON.stringify(_info('1.1.1').faltas);

  console.log('\n30) Lote inválido: nada é enviado');

  // (c1) um arquivo inválido no meio
  zerarRegistros();
  formReq.fake.botao.disabled = false;
  formReq.fake.botao.textContent = 'Registrar evidência';
  formReq.elements = formReq.elements.filter((c) => c.name !== 'arquivo')
    .map((c) => (c.name === 'titulo' ? { name: 'titulo', value: 'Lote ruim' } : c))
    .concat([{ name: 'arquivo', type: 'file', files: [arqFalso('ok.pdf'), arqFalso('virus.exe'), arqFalso('ok2.pdf')] }]);
  renderizarRota('#/pratica/1.1.1');
  conteudo.innerHTML = 'MARCADOR';
  const totalEvAntes = Store.estado().evidencias.length;
  formReq.ao_submit(evento);
  await esperarPromessas();
  verificar('(c) arquivo inválido: NENHUM envio é feito', envios.length === 0, envios.length);
  verificar('(c) arquivo inválido: o registro não é criado',
    Store.estado().evidencias.length === totalEvAntes && evidenciasDe('Lote ruim').length === 0);
  verificar('(c) o alerta diz QUAL arquivo e POR QUÊ',
    alertas.length === 1 && alertas[0].indexOf('virus.exe') !== -1 &&
    alertas[0].indexOf('Tipo de arquivo não aceito') !== -1 && alertas[0].indexOf('Nada foi enviado') !== -1,
    alertas.join('|'));
  verificar('(c) o formulário permanece como está (sem redesenhar, botão livre)',
    conteudo.innerHTML === 'MARCADOR' && formReq.fake.botao.disabled === false);

  // (c2) arquivo grande demais
  zerarRegistros();
  formReq.elements = formReq.elements.filter((c) => c.name !== 'arquivo')
    .concat([{ name: 'arquivo', type: 'file', files: [arqFalso('ok.pdf'), arqFalso('enorme.pdf', 25 * 1024 * 1024)] }]);
  formReq.ao_submit(evento);
  await esperarPromessas();
  verificar('(c) arquivo grande demais: nada enviado, alerta cita o arquivo e o limite',
    envios.length === 0 && evidenciasDe('Lote ruim').length === 0 &&
    alertas.length === 1 && alertas[0].indexOf('enorme.pdf') !== -1 && alertas[0].indexOf('20 MB') !== -1,
    alertas.join('|'));

  // (c3) mais de 10 arquivos
  zerarRegistros();
  formReq.elements = formReq.elements.filter((c) => c.name !== 'arquivo')
    .concat([{ name: 'arquivo', type: 'file', files: Array.from({ length: 11 }, (_, i) => arqFalso('f' + i + '.pdf')) }]);
  formReq.ao_submit(evento);
  await esperarPromessas();
  verificar('(c) mais de 10 arquivos é recusado: nada enviado nem registrado',
    envios.length === 0 && evidenciasDe('Lote ruim').length === 0 &&
    alertas.length === 1 && alertas[0].indexOf('11 arquivos') !== -1 && alertas[0].indexOf('10') !== -1,
    alertas.join('|'));

  // (c4) exatamente 10 arquivos passa
  zerarRegistros();
  formReq.elements = formReq.elements.filter((c) => c.name !== 'arquivo')
    .map((c) => (c.name === 'titulo' ? { name: 'titulo', value: 'Dez arquivos' } : c))
    .concat([{ name: 'arquivo', type: 'file', files: Array.from({ length: 10 }, (_, i) => arqFalso('d' + i + '.pdf')) }]);
  formReq.ao_submit(evento);
  await aguardar(() => evidenciasDe('Dez arquivos').length > 0);
  verificar('(c) exatamente 10 arquivos é aceito: 10 envios e um registro',
    envios.length === 10 && maxAtivos === 1 && evidenciasDe('Dez arquivos').length === 1 &&
    evidenciasDe('Dez arquivos')[0].arquivos.length === 10);

  console.log('\n31) Falha no meio do lote: rollback e nenhum registro');

  // (d1) falha no 2º de 3
  zerarRegistros();
  formReq.elements = formReq.elements.filter((c) => c.name !== 'arquivo')
    .map((c) => (c.name === 'titulo' ? { name: 'titulo', value: 'Falha no meio' } : c))
    .concat([{ name: 'arquivo', type: 'file', files: tresArquivos }]);
  renderizarRota('#/pratica/1.1.1');
  conteudo.innerHTML = 'MARCADOR';
  falharNoEnvio = 1;
  formReq.ao_submit(evento);
  await aguardar(() => alertas.length > 0);
  verificar('(d) o 3º arquivo nem é tentado', envios.length === 2, envios.length);
  verificar('(d) o 1º arquivo enviado é removido do armazenamento (rollback)',
    removidosDoBucket.length === 1 && removidosDoBucket[0] === 'evidencias/CERNE1/1.1.1/2026/m-1-ata.pdf', removidosDoBucket.join('|'));
  verificar('(d) NÃO cria o registro', evidenciasDe('Falha no meio').length === 0);
  verificar('(d) mostra o erro, qual arquivo falhou e que nada foi registrado',
    alertas.length === 1 && alertas[0].indexOf('rede caiu em lista.pdf') !== -1 &&
    alertas[0].indexOf('arquivo 2 de 3') !== -1 && alertas[0].indexOf('nada foi registrado') !== -1,
    alertas.join('|'));
  verificar('(d) o formulário é mantido e o botão volta a funcionar',
    conteudo.innerHTML === 'MARCADOR' && formReq.fake.botao.disabled === false &&
    formReq.fake.botao.textContent === 'Registrar evidência' && formReq.fake.barra.hidden === true);

  // (d2) falha no 1º: nada a desfazer
  zerarRegistros();
  falharNoEnvio = 0;
  formReq.ao_submit(evento);
  await aguardar(() => alertas.length > 0);
  verificar('(d) falha no 1º arquivo: nada a remover e nenhum registro',
    removidosDoBucket.length === 0 && envios.length === 1 && evidenciasDe('Falha no meio').length === 0);

  // (d3) falha no último: remove os dois anteriores
  zerarRegistros();
  falharNoEnvio = 2;
  formReq.ao_submit(evento);
  await aguardar(() => alertas.length > 0);
  verificar('(d) falha no 3º: os 2 anteriores são removidos',
    removidosDoBucket.join('|') === 'evidencias/CERNE1/1.1.1/2026/m-1-ata.pdf|evidencias/CERNE1/1.1.1/2026/m-2-lista.pdf' &&
    evidenciasDe('Falha no meio').length === 0, removidosDoBucket.join('|'));

  // (d4) se a própria remoção falhar, nada quebra
  zerarRegistros();
  const removerOriginal = Store.removerArquivo;
  Store.removerArquivo = () => { throw new Error('sem rede'); };
  falharNoEnvio = 1;
  formReq.ao_submit(evento);
  await aguardar(() => alertas.length > 0);
  verificar('(d) remoção que falha é só melhor esforço: o erro do envio chega à pessoa',
    alertas.length === 1 && alertas[0].indexOf('rede caiu em lista.pdf') !== -1);
  Store.removerArquivo = removerOriginal;

  console.log('\n32) Evidência própria do parque e fluxos de 1 arquivo / sem arquivo');

  // (k) 1 arquivo
  zerarRegistros();
  const formProp = formularioDeAnexos({}, {
    titulo: 'Um anexo', refere_a: 'iniciativa', data_referencia: '2026-06-01'
  }, [arqFalso('so-um.pdf', 4096)], 'Registrar evidência');
  formAtual = formProp;
  simularElementos({ '[data-form-evidencia-propria]': [formProp] });
  renderizarRota('#/pratica/1.1.1');
  formProp.ao_submit(evento);
  verificar('(k) com 1 arquivo o texto do botão e da barra são os de sempre',
    formProp.fake.botao.textContent === 'Enviando arquivo...' &&
    formProp.fake.texto.textContent === 'Enviando... 0%', formProp.fake.texto.textContent);
  await aguardar(() => evidenciasDe('Um anexo').length > 0);
  const evUm = evidenciasDe('Um anexo')[0];
  verificar('(k) 1 arquivo: 1 envio, índice 0, 1 registro',
    envios.length === 1 && envios[0].indice === 0 && !!evUm);
  verificar('(k) grava `arquivos` com 1 item e `arquivo` igual a ele',
    !!evUm && evUm.arquivos.length === 1 && JSON.stringify(evUm.arquivo) === JSON.stringify(evUm.arquivos[0]));
  verificar('(k) é evidência própria (sem requisito) e mantém o rótulo',
    !!evUm && evUm.requisito === null && evUm.refere_a === 'iniciativa');
  verificar('(k) mensagem de sucesso de sempre', torrada() === 'Evidência registrada com o arquivo anexado.', torrada());
  verificar('(k) 1 arquivo: o progresso é "Enviando... N%"', envios[0].texto50 === 'Enviando... 50%', envios[0].texto50);

  // própria com vários arquivos
  zerarRegistros();
  formProp.elements = formProp.elements.filter((c) => c.name !== 'arquivo')
    .map((c) => (c.name === 'titulo' ? { name: 'titulo', value: 'Proprios varios' } : c))
    .concat([{ name: 'arquivo', type: 'file', files: [arqFalso('p1.pdf'), arqFalso('p2.pdf')] }]);
  renderizarRota('#/pratica/1.1.1');
  formProp.ao_submit(evento);
  await aguardar(() => evidenciasDe('Proprios varios').length > 0);
  const evProp = evidenciasDe('Proprios varios')[0];
  verificar('evidência própria aceita vários arquivos (um registro, 2 anexos)',
    envios.length === 2 && !!evProp && evProp.arquivos.length === 2 && evProp.arquivo.nome === 'p1.pdf' &&
    evProp.requisito === null);

  // sem arquivo
  zerarRegistros();
  formProp.elements = [{ name: 'titulo', value: 'Sem anexo' }, { name: 'refere_a', value: 'x' }];
  formProp.ao_submit(evento);
  const evSem = evidenciasDe('Sem anexo')[0];
  verificar('(k) sem arquivo: registra direto, sem `arquivo` nem `arquivos`',
    envios.length === 0 && !!evSem && !('arquivo' in evSem) && !('arquivos' in evSem) &&
    torrada() === 'Evidência registrada.');

  // (j) a prontidão não muda com a quantidade de arquivos
  Store.limpar();
  zerarRegistros();
  formReq.elements = formReq.elements.filter((c) => c.name !== 'arquivo')
    .map((c) => (c.name === 'titulo' ? { name: 'titulo', value: 'Um so' } : c))
    .concat([{ name: 'arquivo', type: 'file', files: [arqFalso('um.pdf')] }]);
  formAtual = formReq;
  simularElementos({ '[data-form-evidencia]': [formReq] });
  renderizarRota('#/pratica/1.1.1');
  formReq.ao_submit(evento);
  await aguardar(() => evidenciasDe('Um so').length > 0);
  verificar('(j) 1 arquivo ou 3 arquivos: as faltas da prática são as mesmas',
    JSON.stringify(_info('1.1.1').faltas) === faltasComTres);
  verificar('(j) a regra de prontidão não menciona anexos',
    !/arquivo|anexo/i.test([janela.Regras.faltasDaPratica, janela.Regras.praticaCompleta,
      janela.Regras.calcularProntidao].map((f) => f.toString()).join('\n')));

  console.log('\n33) Listas, atividades e dossiê mostram TODOS os arquivos');

  Store.limpar();
  const anexoAntigo = {
    url: 'https://armazem.test/velho.pdf', nome: 'velho.pdf', tamanho: 2048, tipo: 'application/pdf',
    caminho: 'evidencias/CERNE1/1.1.1/2026/velho.pdf'
  };
  const tres = [
    { url: 'https://armazem.test/a.pdf', nome: 'a.pdf', tamanho: 1024, tipo: 'application/pdf', caminho: 'c/a.pdf' },
    { url: 'https://armazem.test/b.pdf', nome: 'b <b>1</b>.pdf', tamanho: 2048, tipo: 'application/pdf', caminho: 'c/b.pdf' },
    { url: 'https://armazem.test/c.jpg', nome: 'c.jpg', tamanho: 3 * 1024 * 1024, tipo: 'image/jpeg', caminho: 'c/c.jpg' }
  ];
  Store.criarEm('atividades', {
    tipo: 'evento', titulo: 'Oficina', descricao: '', data_realizacao: '2026-06-10', local: 'Sala 1',
    responsavel: 'Ana', pratica: '1.1.1', empreendimento: '', programa: ''
  });
  const atvAnexos = Store.estado().atividades[0];
  Store.criarEm('evidencias', {
    pratica: '1.1.1', requisito: reqObrigatorio.id, titulo: 'Evid antiga', data_referencia: '2026-01-02',
    arquivo: anexoAntigo
  });
  Store.criarEm('evidencias', {
    pratica: '1.1.1', requisito: reqObrigatorio.id, titulo: 'Evid varios', data_referencia: '2026-01-03',
    arquivo: tres[0], arquivos: tres
  });
  Store.criarEm('evidencias', {
    pratica: '1.1.1', requisito: null, refere_a: 'proprio', titulo: 'Propria varios',
    data_referencia: '2026-01-04', arquivo: tres[0], arquivos: tres
  });
  Store.criarEm('evidencias', {
    pratica: '1.1.1', requisito: null, refere_a: 'proprio', titulo: 'Propria antiga',
    data_referencia: '2026-01-05', arquivo: anexoAntigo
  });
  Store.criarEm('evidencias', {
    pratica: '1.1.1', requisito: reqObrigatorio.id, titulo: 'Da atividade', data_referencia: '2026-01-06',
    atividade: atvAnexos.id, arquivo: tres[0], arquivos: tres
  });
  Store.criarEm('evidencias', {
    pratica: '1.1.1', requisito: reqObrigatorio.id, titulo: 'Url estranha', data_referencia: '2026-01-07',
    arquivo: { url: 'javascript:alert(1)', nome: 'mau.pdf', caminho: 'c/mau.pdf' }
  });

  const abrir = (url) => '<a href="' + url + '" target="_blank" rel="noopener noreferrer" class="quebra">';
  simularElementos({});
  html = renderizarRota('#/pratica/1.1.1');

  verificar('(e) evidência antiga (só `arquivo`) segue com o link "baixar arquivo", exatamente como antes',
    html.indexOf(' · ' + abrir('https://armazem.test/velho.pdf') + 'baixar arquivo</a>') !== -1);
  verificar('(e) ...e com nome e tamanho na linha de detalhes',
    html.indexOf('velho.pdf · 2 KB · ') !== -1);
  verificar('(e) registro antigo NÃO mostra o indicador "N arquivos"',
    html.indexOf('1 arquivos') === -1 && html.indexOf('1 arquivo</span>') === -1);
  verificar('(e) evidência própria antiga também',
    html.indexOf('Propria antiga') !== -1 &&
    contaDe(html, abrir('https://armazem.test/velho.pdf') + 'baixar arquivo</a>') === 2);
  verificar('(h) evidência de requisito com 3 arquivos: um link por arquivo, com nome',
    tres.every((a) => html.indexOf(abrir(a.url)) !== -1) &&
    html.indexOf('>a.pdf</a>') !== -1 && html.indexOf('>c.jpg</a>') !== -1);
  verificar('(h) mostra o tamanho de cada arquivo', html.indexOf('(1 KB)') !== -1 && html.indexOf('(3.0 MB)') !== -1);
  verificar('(h) mostra o indicador "3 arquivos"', html.indexOf('<span class="etiqueta cinza">3 arquivos</span>') !== -1);
  verificar('(h) nome do arquivo é escapado',
    html.indexOf('b <b>1</b>.pdf') === -1 && html.indexOf('b &lt;b&gt;1&lt;/b&gt;.pdf') !== -1);
  verificar('(h) com vários arquivos não aparece "baixar arquivo" para esse registro',
    contaDe(html, 'baixar arquivo</a>') === 2);
  verificar('(h) URL que não é http(s) nunca vira link',
    html.indexOf('javascript:alert') === -1);
  verificar('(h) evidência própria com 3 arquivos lista todos',
    contaDe(html, abrir('https://armazem.test/c.jpg')) >= 3);

  html = renderizarRota('#/atividades');
  verificar('(h) "Documentos por atividade" lista todos os arquivos da evidência vinculada',
    html.indexOf('Da atividade') !== -1 && tres.every((a) => html.indexOf(abrir(a.url)) !== -1) &&
    html.indexOf('<span class="etiqueta cinza">3 arquivos</span>') !== -1);

  html = renderizarRota('#/dossie');
  const dossieOutras = html.slice(html.indexOf('Outras evidências do parque'));
  verificar('(h) o dossiê lista todos os arquivos da evidência própria',
    html.indexOf('Outras evidências do parque') !== -1 && html.indexOf('Propria varios') !== -1 &&
    tres.every((a) => dossieOutras.indexOf('href="' + a.url + '"') !== -1) &&
    dossieOutras.indexOf('<span class="etiqueta cinza">3 arquivos</span>') !== -1);
  verificar('(h) o dossiê mostra o arquivo único da evidência antiga como antes',
    dossieOutras.indexOf('href="https://armazem.test/velho.pdf"') !== -1 &&
    dossieOutras.indexOf('>velho.pdf</a>') !== -1);
  verificar('(h) o dossiê escapa o nome', html.indexOf('b <b>1</b>.pdf') === -1);

  console.log('\n34) Documento de empreendimento com vários arquivos');

  Store.limpar();
  zerarRegistros();
  Store.criarEm('empreendimentos', {
    nome: 'Empresa Docs', setor: 'Software', estagio: 'pre_incubado', situacao: 'ativo'
  });
  const empDocs = Store.estado().empreendimentos[0];
  const formDocEmp = formularioDeAnexos({}, {
    titulo: 'Entregas', data_referencia: '2026-07-01', link: '', descricao: 'varios'
  }, [arqFalso('e1.pdf', 1024), arqFalso('e2.pdf', 2048), arqFalso('e3.jpg', 4096)], 'Anexar documento',
  documento.getElementById('form-documento-emp'));
  formDocEmp.addEventListener = (ev, fn) => { formDocEmp['ao_' + ev] = fn; };
  formAtual = formDocEmp;
  renderizarRota('#/empreendimento/' + empDocs.id);
  verificar('(g) o formulário do documento escuta submit e change',
    typeof formDocEmp.ao_submit === 'function' && typeof formDocEmp.ao_change === 'function');
  formDocEmp.ao_change({ target: { type: 'file', files: [arqFalso('e1.pdf', 1024), arqFalso('e2.pdf', 2048)] } });
  verificar('(g) o formulário do documento mostra os arquivos escolhidos',
    formDocEmp.fake.lista.innerHTML.indexOf('e2.pdf') !== -1 &&
    formDocEmp.fake.lista.innerHTML.indexOf('2 arquivos escolhidos') !== -1);

  formDocEmp.ao_submit(evento);
  verificar('(g) botão trava durante o envio', formDocEmp.fake.botao.disabled === true);
  await aguardar(() => (Store.estado().empreendimentos[0].documentos || []).length > 0);
  const docsEmp = Store.estado().empreendimentos[0].documentos;
  verificar('(g) 3 envios em sequência e UM documento',
    envios.length === 3 && maxAtivos === 1 && docsEmp.length === 1 &&
    envios.every((x, i) => x.tipo === 'empreendimento' && x.alvo === empDocs.id && x.indice === i &&
      x.data === '2026-07-01'));
  const docNovo = docsEmp[0];
  verificar('(g) documento com arquivos.length === 3 e `arquivo` = primeiro',
    docNovo.arquivos.length === 3 && JSON.stringify(docNovo.arquivo) === JSON.stringify(docNovo.arquivos[0]) &&
    docNovo.arquivo.nome === 'e1.pdf');
  verificar('(g) anexos de documento usam `path` (não `caminho`), como sempre',
    docNovo.arquivos.every((a) => a.path && !('caminho' in a)) && semUndefined(docNovo));
  verificar('(g) botão volta ao normal', formDocEmp.fake.botao.disabled === false &&
    formDocEmp.fake.botao.textContent === 'Anexar documento');
  verificar('(g) avisa a quantidade', torrada() === 'Documento anexado com 3 arquivos.', torrada());

  html = renderizarRota('#/empreendimento/' + empDocs.id);
  verificar('(g)(h) a lista de documentos mostra todos os arquivos',
    docNovo.arquivos.every((a) => html.indexOf(abrir(a.url)) !== -1) &&
    html.indexOf('<span class="etiqueta cinza">3 arquivos</span>') !== -1);

  // documento antigo (só `arquivo` com `path`) e documento só com link
  const docAntigo = {
    id: 'docvelho', titulo: 'Pitch antigo', data_referencia: '2026-01-01', criado_em: '2026-01-01T00:00:00.000Z',
    arquivo: { url: 'https://armazem.test/pitch.pdf', nome: 'pitch.pdf', path: 'empreendimentos/x/2026/pitch.pdf', tamanho: 2048, tipo: 'application/pdf' }
  };
  const docLink = { id: 'doclink', titulo: 'So link', link: 'https://drive.test/x', data_referencia: '2026-01-02' };
  Store.atualizarEm('empreendimentos', empDocs.id, { documentos: [docAntigo, docLink].concat(docsEmp) });
  html = renderizarRota('#/empreendimento/' + empDocs.id);
  verificar('(e)(g) documento antigo segue com "baixar arquivo", nome e tamanho',
    html.indexOf(' · ' + abrir('https://armazem.test/pitch.pdf') + 'baixar arquivo</a>') !== -1 &&
    html.indexOf('pitch.pdf · 2 KB · ') !== -1);
  verificar('(g) documento só com link continua sem arquivo',
    html.indexOf('So link') !== -1 && html.indexOf('https://drive.test/x') !== -1);

  // remoção apaga TODOS os caminhos, sem repetir o primeiro
  const removerDoc = (id) => botaoFalso({ 'data-remover-documento': id });
  const botNovo = removerDoc(docNovo.id);
  const botAntigo = removerDoc('docvelho');
  const botLink = removerDoc('doclink');
  simularElementos({ '[data-remover-documento]': [botNovo, botAntigo, botLink] });
  renderizarRota('#/empreendimento/' + empDocs.id);
  removidosDoBucket.length = 0;
  botNovo.ao_click();
  verificar('(g) remover documento com 3 arquivos apaga os 3 caminhos, sem duplicar o primeiro',
    removidosDoBucket.length === 3 && new Set(removidosDoBucket).size === 3 &&
    removidosDoBucket.join('|') === docNovo.arquivos.map((a) => a.path).join('|'), removidosDoBucket.join('|'));
  verificar('(g) o documento sai da lista',
    Store.estado().empreendimentos[0].documentos.every((x) => x.id !== docNovo.id) &&
    Store.estado().empreendimentos[0].documentos.length === 2);
  renderizarRota('#/empreendimento/' + empDocs.id);
  removidosDoBucket.length = 0;
  botAntigo.ao_click();
  verificar('(e) remover documento antigo apaga o seu único arquivo',
    removidosDoBucket.length === 1 && removidosDoBucket[0] === 'empreendimentos/x/2026/pitch.pdf', removidosDoBucket.join('|'));
  renderizarRota('#/empreendimento/' + empDocs.id);
  removidosDoBucket.length = 0;
  botLink.ao_click();
  verificar('(g) remover documento só com link não apaga nada', removidosDoBucket.length === 0);

  // falha no meio do lote de um documento: rollback com `path` e nada gravado
  zerarRegistros();
  simularElementos({});
  const antesDocs = (Store.estado().empreendimentos[0].documentos || []).length;
  formDocEmp.elements = formDocEmp.elements.filter((c) => c.name !== 'arquivo')
    .concat([{ name: 'arquivo', type: 'file', files: [arqFalso('f1.pdf'), arqFalso('f2.pdf'), arqFalso('f3.pdf')] }]);
  renderizarRota('#/empreendimento/' + empDocs.id);
  falharNoEnvio = 1;
  formDocEmp.ao_submit(evento);
  await aguardar(() => alertas.length > 0);
  verificar('(g)(d) falha no 2º arquivo do documento: remove o 1º (pelo `path`) e não grava',
    removidosDoBucket.join('|') === 'empreendimentos/' + empDocs.id + '/2026/m-1-f1.pdf' &&
    (Store.estado().empreendimentos[0].documentos || []).length === antesDocs &&
    alertas[0].indexOf('rede caiu em f2.pdf') !== -1 && alertas[0].indexOf('arquivo 2 de 3') !== -1 &&
    formDocEmp.fake.botao.disabled === false, alertas.join('|'));

  // lote inválido no documento
  zerarRegistros();
  formDocEmp.elements = formDocEmp.elements.filter((c) => c.name !== 'arquivo')
    .concat([{ name: 'arquivo', type: 'file', files: [arqFalso('f1.pdf'), arqFalso('x.exe')] }]);
  formDocEmp.ao_submit(evento);
  await esperarPromessas();
  verificar('(g)(c) lote inválido no documento: nada enviado nem gravado',
    envios.length === 0 && (Store.estado().empreendimentos[0].documentos || []).length === antesDocs &&
    alertas.length === 1 && alertas[0].indexOf('x.exe') !== -1);

  // um único arquivo no documento: fluxo de sempre
  zerarRegistros();
  formDocEmp.elements = formDocEmp.elements.filter((c) => c.name !== 'arquivo')
    .map((c) => (c.name === 'titulo' ? { name: 'titulo', value: 'Documento unico' } : c))
    .concat([{ name: 'arquivo', type: 'file', files: [arqFalso('unico.pdf')] }]);
  formDocEmp.ao_submit(evento);
  await aguardar(() => (Store.estado().empreendimentos[0].documentos || []).some((x) => x.titulo === 'Documento unico'));
  const docUnico = Store.estado().empreendimentos[0].documentos.filter((x) => x.titulo === 'Documento unico')[0];
  verificar('(k)(g) documento com 1 arquivo: `arquivos` com 1 item e `arquivo` igual',
    envios.length === 1 && !!docUnico && docUnico.arquivos.length === 1 &&
    JSON.stringify(docUnico.arquivo) === JSON.stringify(docUnico.arquivos[0]) &&
    torrada() === 'Documento anexado com o arquivo.', torrada());

  // documento só com link, sem arquivo
  zerarRegistros();
  formDocEmp.elements = [{ name: 'titulo', value: 'Apenas link' }, { name: 'link', value: 'https://drive.test/y' }];
  formDocEmp.ao_submit(evento);
  const docSoLink = Store.estado().empreendimentos[0].documentos.filter((x) => x.titulo === 'Apenas link')[0];
  verificar('(k)(g) documento sem arquivo: grava só o link, sem `arquivo` nem `arquivos`',
    envios.length === 0 && !!docSoLink && !('arquivo' in docSoLink) && !('arquivos' in docSoLink) &&
    docSoLink.link === 'https://drive.test/y' && torrada() === 'Documento anexado.');

  removerArmazenamentoFalso();
  Store.criarEm = criarOriginal;
  janela.alert = alertOriginal;
  pararSimulacao();
  html = renderizarRota('#/pratica/1.1.1');
  verificar('sem armazenamento, os campos de arquivo somem de novo', html.indexOf('type="file"') === -1);

  Store.atualizarEm = atualizarOriginal;
  pararSimulacao();
  delete janela.prompt;

  console.log('\n' + (falhas === 0 ? 'TODOS OS TESTES PASSARAM' : falhas + ' TESTE(S) FALHARAM'));
  process.exit(falhas === 0 ? 0 : 1);
})();
