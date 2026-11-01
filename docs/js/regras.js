/* ============================================================================
   regras.js — a metodologia CERNE como código, sem depender de onde os dados
   estão guardados.

   POR QUE ESTE ARQUIVO EXISTE

   A regra que decide se o parque está apto a solicitar a certificação é o
   coração do sistema. Ela precisa existir em UM lugar só.

   Há duas formas de guardar os dados — no navegador (localStorage) e na nuvem
   (Firestore) — e ambas usam exatamente estas funções. Se a regra estivesse
   copiada nas duas, elas divergiriam com o tempo, e o parque descobriria a
   diferença no pior momento possível: na auditoria.

   Tudo aqui é função pura: recebe o `estado` e devolve o resultado, sem ler
   nem gravar nada. É o que torna estas regras testáveis e reaproveitáveis.

   A MESMA regra vale no sistema Django (acompanhamento/services.py).
   ========================================================================== */
(function (global) {
  'use strict';

  var catalogo = global.CERNE_CATALOGO || { versao: {}, niveis: [] };

  /* ---------------------------------------------------------- índice do catálogo */

  var PRATICAS = [];
  catalogo.niveis.forEach(function (nivel) {
    (nivel.processos || []).forEach(function (processo) {
      (processo.praticas || []).forEach(function (pratica) {
        PRATICAS.push({ pratica: pratica, processo: processo, nivel: nivel });
      });
    });
  });

  var INDICE = {};
  PRATICAS.forEach(function (item) {
    INDICE[item.pratica.codigo] = item;
  });

  /* ------------------------------------------------------------------ rótulos */

  var SITUACOES = [
    { valor: 'nao_iniciada', rotulo: 'Não iniciada' },
    { valor: 'em_andamento', rotulo: 'Em andamento' },
    { valor: 'implantada', rotulo: 'Implantada' },
    { valor: 'em_revisao', rotulo: 'Em revisão' }
  ];

  // Maturidade do negócio, independente do vínculo com o parque.
  // "Consolidada" existe para a empresa residente já estabelecida, que não
  // cabe em nenhum dos estágios de quem ainda está construindo o negócio.
  var ESTAGIOS = [
    { valor: 'ideia', rotulo: 'Ideia' },
    { valor: 'prototipo', rotulo: 'Protótipo/MVP' },
    { valor: 'operacao', rotulo: 'Em operação' },
    { valor: 'crescimento', rotulo: 'Em crescimento' },
    { valor: 'consolidada', rotulo: 'Consolidada' }
  ];

  // Vínculo do empreendimento com o parque:
  //   apoiado      — está no programa de incubação;
  //   pre_incubado — participa de um programa de pré-incubação (ex.: Projeto
  //                  MUDA), mas ainda não ingressou formalmente na incubadora;
  //   residente    — empresa instalada no parque fora da incubação: ocupa
  //                  espaço, usa a infraestrutura e participa do ecossistema;
  //   graduado     — concluiu a incubação (pode seguir no parque como residente);
  //   desligado    — saiu sem concluir.
  // A ordem desta lista é a ordem dos menus, e o primeiro item é o padrão dos
  // formulários — por isso "apoiado" continua na frente.
  var SITUACOES_EMPREENDIMENTO = [
    { valor: 'apoiado', rotulo: 'Apoiado (incubado)' },
    { valor: 'pre_incubado', rotulo: 'Pré-incubado' },
    { valor: 'residente', rotulo: 'Residente' },
    { valor: 'graduado', rotulo: 'Graduado' },
    { valor: 'desligado', rotulo: 'Desligado' }
  ];

  var SITUACOES_PLANO = [
    { valor: 'aberto', rotulo: 'Aberto' },
    { valor: 'em_andamento', rotulo: 'Em andamento' },
    { valor: 'concluido', rotulo: 'Concluído' },
    { valor: 'cancelado', rotulo: 'Cancelado' }
  ];

  var EIXOS = [
    { valor: 'empreendedor', rotulo: 'Empreendedor' },
    { valor: 'tecnologia', rotulo: 'Tecnologia' },
    { valor: 'capital', rotulo: 'Capital' },
    { valor: 'mercado', rotulo: 'Mercado' },
    { valor: 'gestao', rotulo: 'Gestão' }
  ];

  var PAPEIS = [
    { valor: 'gestor', rotulo: 'Gestor' },
    { valor: 'equipe', rotulo: 'Equipe' },
    { valor: 'consulta', rotulo: 'Consulta (somente leitura)' }
  ];

  function rotuloDe(lista, valor) {
    for (var i = 0; i < lista.length; i++) {
      if (lista[i].valor === valor) return lista[i].rotulo;
    }
    return valor || '';
  }

  /* -------------------------------------------------------- formato do estado */

  function estadoInicial() {
    return {
      formato: 1,
      mecanismo: {
        nome: 'IpêTech Paraíso',
        tipo: 'parque tecnológico',
        cidade_uf: '',
        nivel_almejado: 1,
        descricao: ''
      },
      perfil: 'gestor',
      praticas: {},
      evidencias: [],
      medicoes: [],
      revisoes: [],
      planos: [],
      empreendimentos: [],
      atualizado_em: null
    };
  }

  /** Normaliza um estado vindo de fora (backup, importação) ao formato atual. */
  function normalizar(bruto) {
    var base = estadoInicial();
    if (!bruto || typeof bruto !== 'object') return base;

    if (bruto.mecanismo && typeof bruto.mecanismo === 'object') {
      Object.keys(base.mecanismo).forEach(function (k) {
        if (bruto.mecanismo[k] !== undefined && bruto.mecanismo[k] !== null) {
          base.mecanismo[k] = bruto.mecanismo[k];
        }
      });
    }
    if (bruto.perfil === 'consulta' || bruto.perfil === 'gestor') {
      base.perfil = bruto.perfil;
    }
    if (bruto.praticas && typeof bruto.praticas === 'object') {
      Object.keys(bruto.praticas).forEach(function (codigo) {
        if (!INDICE[codigo]) return; // ignora prática fora do catálogo
        var st = bruto.praticas[codigo] || {};
        base.praticas[codigo] = {
          situacao: st.situacao || 'nao_iniciada',
          percentual: Number(st.percentual) || 0,
          observacoes: st.observacoes || '',
          atualizado_em: st.atualizado_em || null
        };
      });
    }
    ['evidencias', 'medicoes', 'revisoes', 'planos', 'empreendimentos'].forEach(
      function (lista) {
        if (Array.isArray(bruto[lista])) base[lista] = bruto[lista];
      }
    );
    base.atualizado_em = bruto.atualizado_em || null;
    return base;
  }

  /* ------------------------------------------------------- consultas no estado */

  function statusDe(estado, codigo) {
    return (
      (estado.praticas && estado.praticas[codigo]) || {
        situacao: 'nao_iniciada',
        percentual: 0,
        observacoes: '',
        atualizado_em: null
      }
    );
  }

  function evidenciasDaPratica(estado, codigo) {
    return (estado.evidencias || []).filter(function (e) {
      return e.pratica === codigo;
    });
  }

  function medicoesDaMetrica(estado, metricaId) {
    return (estado.medicoes || [])
      .filter(function (m) { return m.metrica === metricaId; })
      .sort(function (a, b) {
        return String(b.data || '').localeCompare(String(a.data || ''));
      });
  }

  /* =========================================================================
     A REGRA DE PRONTIDÃO

     Uma prática está completa quando, e somente quando:
       1. a situação é 'implantada';
       2. todo requisito de evidência OBRIGATÓRIO tem ao menos uma evidência
          vinculada a ele;
       3. toda métrica OBRIGATÓRIA tem ao menos uma medição.

     O modelo é acumulativo: o parque está apto ao CERNE N quando os níveis
     1 a N estão 100% completos.

     Requisitos e métricas não obrigatórios são sugestões: não bloqueiam.
     ====================================================================== */

  function faltasDaPratica(estado, pratica) {
    var faltas = [];
    var st = statusDe(estado, pratica.codigo);

    if (st.situacao !== 'implantada') {
      faltas.push(
        "Marcar a prática como 'Implantada' (situação atual: " +
          rotuloDe(SITUACOES, st.situacao) + ').'
      );
    }

    var requisitosAtendidos = {};
    (estado.evidencias || []).forEach(function (e) {
      if (e.requisito) requisitosAtendidos[e.requisito] = true;
    });
    (pratica.requisitos || []).forEach(function (req) {
      if (req.obrigatorio && !requisitosAtendidos[req.id]) {
        faltas.push('Anexar evidência para: ' + req.descricao);
      }
    });

    var metricasMedidas = {};
    (estado.medicoes || []).forEach(function (m) {
      if (m.metrica) metricasMedidas[m.metrica] = true;
    });
    (pratica.metricas || []).forEach(function (met) {
      if (met.obrigatoria && !metricasMedidas[met.id]) {
        faltas.push('Registrar medição da métrica obrigatória: ' + met.nome);
      }
    });

    return faltas;
  }

  function praticaCompleta(estado, pratica) {
    return faltasDaPratica(estado, pratica).length === 0;
  }

  function calcularProntidao(estado) {
    var resultado = {
      versao: catalogo.versao,
      niveis: [],
      apto_nivel: 0,
      proximo_nivel: null,
      pendencias_proximo: [],
      total_praticas: 0,
      total_completas: 0
    };

    catalogo.niveis.forEach(function (nivel) {
      var infoNivel = {
        numero: nivel.numero,
        nome: nivel.nome,
        descricao: nivel.descricao,
        processos: [],
        total: 0,
        completas: 0,
        percentual: 0
      };

      (nivel.processos || []).forEach(function (processo) {
        var infoProc = {
          codigo: processo.codigo,
          nome: processo.nome,
          praticas: [],
          total: 0,
          completas: 0,
          percentual: 0
        };

        (processo.praticas || []).forEach(function (pratica) {
          var faltas = faltasDaPratica(estado, pratica);
          var completa = faltas.length === 0;
          var st = statusDe(estado, pratica.codigo);

          infoProc.praticas.push({
            pratica: pratica,
            situacao: st.situacao,
            situacao_rotulo: rotuloDe(SITUACOES, st.situacao),
            percentual: st.percentual,
            completa: completa,
            faltas: faltas,
            n_evidencias: evidenciasDaPratica(estado, pratica.codigo).length
          });

          infoProc.total += 1;
          infoNivel.total += 1;
          if (completa) {
            infoProc.completas += 1;
            infoNivel.completas += 1;
          }
        });

        infoProc.percentual = infoProc.total
          ? Math.round((100 * infoProc.completas) / infoProc.total)
          : 0;
        infoNivel.processos.push(infoProc);
      });

      infoNivel.percentual = infoNivel.total
        ? Math.round((100 * infoNivel.completas) / infoNivel.total)
        : 0;

      resultado.niveis.push(infoNivel);
      resultado.total_praticas += infoNivel.total;
      resultado.total_completas += infoNivel.completas;
    });

    // Acumulativo: só é apto ao nível N se 1..N estiverem 100%.
    var apto = 0;
    for (var i = 0; i < resultado.niveis.length; i++) {
      var n = resultado.niveis[i];
      if (n.total > 0 && n.completas === n.total) apto = n.numero;
      else break;
    }
    resultado.apto_nivel = apto;

    var proximo = apto + 1;
    var existeProximo = resultado.niveis.some(function (n) {
      return n.numero === proximo;
    });
    if (existeProximo) {
      resultado.proximo_nivel = proximo;
      resultado.niveis.forEach(function (n) {
        if (n.numero > proximo) return;
        n.processos.forEach(function (p) {
          p.praticas.forEach(function (info) {
            if (!info.completa) {
              resultado.pendencias_proximo.push({
                pratica: info.pratica,
                faltas: info.faltas
              });
            }
          });
        });
      });
    }

    return resultado;
  }

  function resumo(estado) {
    var planosAbertos = (estado.planos || []).filter(function (p) {
      return p.situacao === 'aberto' || p.situacao === 'em_andamento';
    }).length;
    return {
      evidencias: (estado.evidencias || []).length,
      medicoes: (estado.medicoes || []).length,
      revisoes: (estado.revisoes || []).length,
      planos_abertos: planosAbertos,
      empreendimentos: (estado.empreendimentos || []).length,
      pre_incubados: (estado.empreendimentos || []).filter(function (e) {
        return e.situacao === 'pre_incubado';
      }).length,
      incubados: (estado.empreendimentos || []).filter(function (e) {
        return e.situacao === 'apoiado';
      }).length,
      residentes: (estado.empreendimentos || []).filter(function (e) {
        return e.situacao === 'residente';
      }).length,
      graduados: (estado.empreendimentos || []).filter(function (e) {
        return e.situacao === 'graduado';
      }).length
    };
  }

  /* ===================================================== geração de códigos

     Código do empreendimento (IPE-0001) e protocolo da evidência
     (INB-AAAA-000) são gerados por MELHOR ESFORÇO: pega o maior sequencial
     que já existe e soma 1. Ficam aqui, em regras.js, para os dois modos de
     armazenamento (store.js e nuvem.js) usarem exatamente a mesma geração.

     "Melhor esforço" porque, na nuvem, duas pessoas criando ao mesmo tempo
     podem gerar o mesmo número. Por isso os dois campos são editáveis, para
     corrigir esse caso raro. Nenhum cálculo de prontidão depende deles — são
     identificadores de leitura humana, para localizar registros.

     Registros antigos (sem codigo/protocolo) simplesmente não entram na conta
     e seguem válidos; as telas mostram "—" para eles.
     ====================================================================== */

  /** Ano (AAAA) de uma data ISO; cai no ano atual quando a data é vazia. */
  function anoDe(dataReferencia) {
    var ano = String(dataReferencia || '').slice(0, 4);
    return /^\d{4}$/.test(ano) ? ano : String(new Date().getFullYear());
  }

  function proximoCodigoEmpreendimento(empreendimentos) {
    var maior = 0;
    (empreendimentos || []).forEach(function (e) {
      var m = /^IPE-(\d+)$/i.exec(String((e && e.codigo) || '').trim());
      if (m) {
        var n = parseInt(m[1], 10);
        if (n > maior) maior = n;
      }
    });
    return 'IPE-' + String(maior + 1).padStart(4, '0');
  }

  function proximoProtocoloEvidencia(evidencias, dataReferencia) {
    var ano = anoDe(dataReferencia);
    var maior = 0;
    (evidencias || []).forEach(function (e) {
      var m = /^INB-(\d{4})-(\d+)$/i.exec(String((e && e.protocolo) || '').trim());
      if (m && m[1] === ano) {
        var n = parseInt(m[2], 10);
        if (n > maior) maior = n;
      }
    });
    return 'INB-' + ano + '-' + String(maior + 1).padStart(3, '0');
  }

  /* ------------------------------------------------------------------- API */

  global.Regras = {
    catalogo: catalogo,
    praticas: PRATICAS,
    buscarPratica: function (codigo) { return INDICE[codigo] || null; },

    SITUACOES: SITUACOES,
    ESTAGIOS: ESTAGIOS,
    SITUACOES_EMPREENDIMENTO: SITUACOES_EMPREENDIMENTO,
    SITUACOES_PLANO: SITUACOES_PLANO,
    EIXOS: EIXOS,
    PAPEIS: PAPEIS,
    rotuloDe: rotuloDe,

    estadoInicial: estadoInicial,
    normalizar: normalizar,

    statusDe: statusDe,
    evidenciasDaPratica: evidenciasDaPratica,
    medicoesDaMetrica: medicoesDaMetrica,

    faltasDaPratica: faltasDaPratica,
    praticaCompleta: praticaCompleta,
    calcularProntidao: calcularProntidao,
    resumo: resumo,

    anoDe: anoDe,
    proximoCodigoEmpreendimento: proximoCodigoEmpreendimento,
    proximoProtocoloEvidencia: proximoProtocoloEvidencia
  };
})(window);
