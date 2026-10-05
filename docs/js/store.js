/* ============================================================================
   store.js — guarda o acompanhamento NO NAVEGADOR (localStorage)

   Este é um dos dois modos de armazenamento do app:

     store.js  -> localStorage. Funciona sem internet e sem conta, mas os
                  dados ficam só naquele navegador. Bom para uso individual,
                  demonstração e trabalho em campo.
     nuvem.js  -> Firestore. Dados compartilhados entre pessoas, com login.

   A REGRA DE PRONTIDÃO NÃO ESTÁ AQUI.
   Ela vive em regras.js, usada pelos dois modos, para não haver duas versões
   da regra que decide se o parque está apto à certificação. Este arquivo
   cuida apenas de: guardar, recuperar, criar, alterar e remover registros.

   Carregue regras.js ANTES deste arquivo.
   ========================================================================== */
(function (global) {
  'use strict';

  var Regras = global.Regras;
  if (!Regras) {
    throw new Error(
      'store.js depende de regras.js. Verifique a ordem das tags <script> ' +
      'no index.html: regras.js precisa vir antes.'
    );
  }

  var CHAVE = 'cerne.acompanhamento.v1';

  /* ------------------------------------------------------------------ estado */

  var estado = Regras.estadoInicial();
  var ouvintes = [];
  var falhaPersistencia = null;

  function carregar() {
    try {
      var cru = global.localStorage.getItem(CHAVE);
      estado = cru ? Regras.normalizar(JSON.parse(cru)) : Regras.estadoInicial();
    } catch (erro) {
      // localStorage indisponível (file:// em alguns navegadores, modo
      // restrito) ou JSON corrompido: segue com estado em memória.
      console.warn('Não foi possível ler os dados salvos:', erro);
      estado = Regras.estadoInicial();
    }
    return estado;
  }

  function salvar() {
    estado.atualizado_em = new Date().toISOString();
    try {
      global.localStorage.setItem(CHAVE, JSON.stringify(estado));
    } catch (erro) {
      console.warn('Não foi possível salvar no navegador:', erro);
      falhaPersistencia = erro;
    }
    ouvintes.forEach(function (fn) {
      try { fn(estado); } catch (e) { console.error(e); }
    });
  }

  function aoMudar(fn) {
    ouvintes.push(fn);
  }

  function novoId() {
    return 'id' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  /* -------------------------------------------------------- status da prática */

  function statusDe(codigo) {
    return Regras.statusDe(estado, codigo);
  }

  function salvarStatus(codigo, dados) {
    if (!Regras.buscarPratica(codigo)) return;
    var atual = statusDe(codigo);
    estado.praticas[codigo] = {
      situacao: dados.situacao !== undefined ? dados.situacao : atual.situacao,
      percentual:
        dados.percentual !== undefined
          ? Math.max(0, Math.min(100, Number(dados.percentual) || 0))
          : atual.percentual,
      observacoes:
        dados.observacoes !== undefined ? dados.observacoes : atual.observacoes,
      atualizado_em: new Date().toISOString()
    };
    salvar();
  }

  /* ------------------------------------------------- coleções (CRUD simples) */

  function criarEm(lista, registro) {
    registro.id = novoId();
    registro.criado_em = new Date().toISOString();
    estado[lista].push(registro);
    salvar();
    return registro;
  }

  function atualizarEm(lista, id, dados) {
    var alvo = estado[lista].filter(function (r) { return r.id === id; })[0];
    if (!alvo) return null;
    Object.keys(dados).forEach(function (k) { alvo[k] = dados[k]; });
    salvar();
    return alvo;
  }

  function removerEm(lista, id) {
    var antes = estado[lista].length;
    estado[lista] = estado[lista].filter(function (r) { return r.id !== id; });
    if (estado[lista].length !== antes) salvar();
  }

  function porPratica(lista, codigo) {
    return estado[lista].filter(function (r) { return r.pratica === codigo; });
  }

  function empreendimentoPorId(id) {
    return estado.empreendimentos.filter(function (e) { return e.id === id; })[0] || null;
  }

  /* --------------------------------------------------------- backup / restore */

  function exportarObjeto() {
    return JSON.parse(JSON.stringify(estado));
  }

  function nomeArquivoBackup() {
    var d = new Date();
    var pad = function (v) { return String(v).padStart(2, '0'); };
    var nome = (estado.mecanismo.nome || 'parque')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 40);
    return (
      'cerne-' + nome + '-' +
      d.getFullYear() + pad(d.getMonth() + 1) + pad(d.getDate()) + '-' +
      pad(d.getHours()) + pad(d.getMinutes()) + '.json'
    );
  }

  /** Dispara o download do backup .json. */
  function baixarBackup() {
    var conteudo = JSON.stringify(exportarObjeto(), null, 2);
    var blob = new Blob([conteudo], { type: 'application/json;charset=utf-8' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = nomeArquivoBackup();
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }

  /** Substitui todo o acompanhamento pelo conteúdo de um backup. */
  function importarObjeto(bruto) {
    estado = Regras.normalizar(bruto);
    salvar();
    return estado;
  }

  function limpar() {
    estado = Regras.estadoInicial();
    salvar();
    return estado;
  }

  /* -------------------------------------------------------- dados de exemplo */

  /** Cenário realista para a equipe conhecer o sistema: nível 1 completo
   *  (o painel mostra "apto ao CERNE 1") e nível 2 em andamento (a lista de
   *  pendências tem o que mostrar). */
  function carregarExemplo() {
    estado = Regras.estadoInicial();
    estado.mecanismo = {
      nome: 'Parque Tecnológico (dados de EXEMPLO)',
      tipo: 'parque tecnológico',
      cidade_uf: 'Paraíso/SP',
      nivel_almejado: 2,
      descricao:
        'Registro de demonstração para conhecer o sistema. Substitua pelos dados reais ' +
        'ou use "Limpar tudo" na aba Dados e backup antes de começar de verdade.'
    };

    var hoje = new Date().toISOString().slice(0, 10);
    var agora = new Date().toISOString();

    function praticasDoNivel(numero) {
      var nivel = Regras.catalogo.niveis.filter(function (n) {
        return n.numero === numero;
      })[0];
      var saida = [];
      if (!nivel) return saida;
      (nivel.processos || []).forEach(function (p) {
        (p.praticas || []).forEach(function (pr) { saida.push(pr); });
      });
      return saida;
    }

    /** Marca a prática como implantada e atende tudo que é obrigatório. */
    function completar(pratica) {
      estado.praticas[pratica.codigo] = {
        situacao: 'implantada',
        percentual: 100,
        observacoes: 'Prática implantada e documentada.',
        atualizado_em: agora
      };

      (pratica.requisitos || []).forEach(function (req, i) {
        estado.evidencias.push({
          id: novoId(),
          pratica: pratica.codigo,
          requisito: req.id,
          titulo: 'Evidência ' + (i + 1) + ' — ' + pratica.nome,
          link: '',
          descricao: req.exemplo || req.descricao,
          data_referencia: hoje,
          responsavel: 'Equipe de gestão',
          criado_em: agora
        });
      });

      (pratica.metricas || []).forEach(function (met) {
        estado.medicoes.push({
          id: novoId(),
          pratica: pratica.codigo,
          metrica: met.id,
          valor: 120,
          data: hoje,
          observacao: 'Medição de exemplo.',
          criado_em: agora
        });
      });

      estado.revisoes.push({
        id: novoId(),
        pratica: pratica.codigo,
        data: hoje,
        periodo: 'Último semestre',
        eficiencia: 'Ações executadas conforme o planejado, com a equipe disponível.',
        eficacia: 'Entregas dentro da qualidade esperada.',
        efetividade: 'Resultados contribuíram para o aumento de propostas recebidas.',
        necessita_ajustes: false,
        observacoes: 'Revisão crítica de exemplo.',
        criado_em: agora
      });
    }

    /** Deixa a prática começada, mas com pendências de propósito. */
    function comecar(pratica) {
      estado.praticas[pratica.codigo] = {
        situacao: 'em_andamento',
        percentual: 40,
        observacoes: 'Em andamento: documentação sendo organizada.',
        atualizado_em: agora
      };
      // Atende só o primeiro requisito, para a barra não ficar zerada.
      var primeiro = (pratica.requisitos || [])[0];
      if (primeiro) {
        estado.evidencias.push({
          id: novoId(),
          pratica: pratica.codigo,
          requisito: primeiro.id,
          titulo: 'Rascunho — ' + pratica.nome,
          link: '',
          descricao: 'Documento em elaboração.',
          data_referencia: hoje,
          responsavel: 'Equipe de gestão',
          criado_em: agora
        });
      }
      estado.planos.push({
        id: novoId(),
        pratica: pratica.codigo,
        descricao: 'Concluir a documentação de "' + pratica.nome + '" e anexar as evidências.',
        responsavel: 'Coordenação',
        prazo: hoje,
        situacao: 'em_andamento',
        criado_em: agora
      });
    }

    // Nível 1 inteiro completo -> fica apto ao CERNE 1.
    praticasDoNivel(1).forEach(completar);

    // Nível 2 pela metade -> gera a lista "o que falta para o CERNE 2".
    var praticasNivel2 = praticasDoNivel(2);
    var metade = Math.ceil(praticasNivel2.length / 2);
    praticasNivel2.forEach(function (pratica, indice) {
      if (indice < metade) completar(pratica);
      else comecar(pratica);
    });

    estado.empreendimentos = [
      {
        id: novoId(),
        nome: 'AgroSense (exemplo)',
        setor: 'Agro / IoT',
        local: 'Prédio 1, sala 4',
        estagio: 'operacao',
        situacao: 'apoiado',
        data_entrada: hoje,
        data_graduacao: '',
        responsavel: 'Ana Souza',
        descricao: 'Sensores de umidade de solo para pequenos produtores.',
        criado_em: agora,
        avaliacoes: [
          { id: novoId(), eixo: 'empreendedor', nota: 4, data: hoje, observacao: '' },
          { id: novoId(), eixo: 'tecnologia', nota: 4, data: hoje, observacao: '' },
          { id: novoId(), eixo: 'capital', nota: 2, data: hoje, observacao: '' },
          { id: novoId(), eixo: 'mercado', nota: 3, data: hoje, observacao: '' },
          { id: novoId(), eixo: 'gestao', nota: 3, data: hoje, observacao: '' }
        ]
      },
      {
        id: novoId(),
        nome: 'EducaLab (exemplo)',
        setor: 'Edtech',
        local: 'Prédio 1, sala 7',
        estagio: 'prototipo',
        situacao: 'apoiado',
        data_entrada: hoje,
        data_graduacao: '',
        responsavel: 'Bruno Lima',
        descricao: 'Plataforma de trilhas de aprendizagem para escolas públicas.',
        criado_em: agora,
        avaliacoes: [
          { id: novoId(), eixo: 'empreendedor', nota: 3, data: hoje, observacao: '' },
          { id: novoId(), eixo: 'tecnologia', nota: 2, data: hoje, observacao: '' },
          { id: novoId(), eixo: 'capital', nota: 1, data: hoje, observacao: '' },
          { id: novoId(), eixo: 'mercado', nota: 2, data: hoje, observacao: '' },
          { id: novoId(), eixo: 'gestao', nota: 2, data: hoje, observacao: '' }
        ]
      },
      {
        // Empresa residente: instalada no parque fora da incubação. Está no
        // exemplo para mostrar que o parque acompanha os dois vínculos.
        id: novoId(),
        nome: 'Ipê Sistemas (exemplo)',
        setor: 'TIC / software',
        local: 'Prédio 2, módulo 3',
        estagio: 'consolidada',
        situacao: 'residente',
        data_entrada: hoje,
        data_graduacao: '',
        responsavel: 'Carla Dias',
        descricao: 'Empresa de software instalada no parque, fora da incubação.',
        criado_em: agora,
        avaliacoes: [
          { id: novoId(), eixo: 'empreendedor', nota: 4, data: hoje, observacao: '' },
          { id: novoId(), eixo: 'tecnologia', nota: 5, data: hoje, observacao: '' },
          { id: novoId(), eixo: 'capital', nota: 4, data: hoje, observacao: '' },
          { id: novoId(), eixo: 'mercado', nota: 4, data: hoje, observacao: '' },
          { id: novoId(), eixo: 'gestao', nota: 4, data: hoje, observacao: '' }
        ]
      }
    ];

    salvar();
    return estado;
  }

  /* ------------------------------------------------------------------ perfil */

  function perfil() { return estado.perfil; }
  function podeEditar() { return estado.perfil === 'gestor'; }
  function definirPerfil(novo) {
    estado.perfil = novo === 'consulta' ? 'consulta' : 'gestor';
    salvar();
  }

  /* --------------------------------------------------------------------- API
     Mantida idêntica à versão anterior: o app.js e os testes não mudam.
     As funções de regra apenas repassam para o Regras, com o estado atual.
  --------------------------------------------------------------------------- */

  global.Store = {
    // catálogo e rótulos (vêm das regras)
    catalogo: Regras.catalogo,
    praticas: Regras.praticas,
    buscarPratica: Regras.buscarPratica,
    SITUACOES: Regras.SITUACOES,
    ESTAGIOS: Regras.ESTAGIOS,
    SITUACOES_EMPREENDIMENTO: Regras.SITUACOES_EMPREENDIMENTO,
    SITUACOES_PLANO: Regras.SITUACOES_PLANO,
    EIXOS: Regras.EIXOS,
    PAPEIS: Regras.PAPEIS,
    rotuloDe: Regras.rotuloDe,

    // ciclo de vida
    carregar: carregar,
    aoMudar: aoMudar,
    estado: function () { return estado; },
    mecanismo: function () { return estado.mecanismo; },
    salvarMecanismo: function (dados) {
      Object.keys(dados).forEach(function (k) { estado.mecanismo[k] = dados[k]; });
      salvar();
    },
    falhaPersistencia: function () { return falhaPersistencia; },

    // status
    statusDe: statusDe,
    salvarStatus: salvarStatus,

    // coleções
    criarEm: criarEm,
    atualizarEm: atualizarEm,
    removerEm: removerEm,
    evidenciasDaPratica: function (codigo) { return porPratica('evidencias', codigo); },
    revisoesDaPratica: function (codigo) { return porPratica('revisoes', codigo); },
    planosDaPratica: function (codigo) { return porPratica('planos', codigo); },
    medicoesDaMetrica: function (metricaId) {
      return Regras.medicoesDaMetrica(estado, metricaId);
    },
    empreendimentoPorId: empreendimentoPorId,

    // prontidão (regra única, em regras.js)
    faltasDaPratica: function (pratica) {
      return Regras.faltasDaPratica(estado, pratica);
    },
    praticaCompleta: function (pratica) {
      return Regras.praticaCompleta(estado, pratica);
    },
    calcularProntidao: function () { return Regras.calcularProntidao(estado); },
    resumo: function () { return Regras.resumo(estado); },

    // backup
    baixarBackup: baixarBackup,
    exportarObjeto: exportarObjeto,
    importarObjeto: importarObjeto,
    limpar: limpar,
    carregarExemplo: carregarExemplo,

    // perfil
    perfil: perfil,
    podeEditar: podeEditar,
    definirPerfil: definirPerfil,

    novoId: novoId
  };
})(window);
