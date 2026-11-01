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

  console.log('\n' + (falhas === 0 ? 'TODOS OS TESTES PASSARAM' : falhas + ' TESTE(S) FALHARAM'));
  process.exit(falhas === 0 ? 0 : 1);
})();
