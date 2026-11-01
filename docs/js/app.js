/* ============================================================================
   app.js — interface do Acompanhamento CERNE (versão web estática)

   Navegação por hash (#/tela), telas renderizadas em JavaScript puro e
   gráficos desenhados em SVG. Nenhuma biblioteca externa: o app abre offline.
   ========================================================================== */
(function (global) {
  'use strict';

  var doc = global.document;

  /* No modo local, o store.js já publicou o Store antes deste arquivo rodar.
     No modo nuvem, não: o nuvem.js é um módulo (type="module"), e módulos
     executam DEPOIS dos scripts comuns. Guardar `global.Store` aqui captura
     `undefined` e essa referência vazia nunca mais seria atualizada.

     Por isso a referência é reavaliada antes de cada desenho. */
  var Store = global.Store;

  function atualizarStore() {
    Store = global.Store || Store;
    return Store;
  }

  /* =========================================================== utilitários */

  /** Escapa texto para inserção segura em HTML (evita quebra de layout e XSS). */
  function esc(valor) {
    if (valor === null || valor === undefined) return '';
    return String(valor)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  /** Aceita apenas URLs http(s) em atributos href. */
  function urlSegura(valor) {
    var texto = String(valor || '').trim();
    return /^https?:\/\//i.test(texto) ? texto : '';
  }

  /** "2026-09-23" -> "23/09/2026" (sem passar por Date, para não deslocar o dia). */
  function dataBR(iso) {
    if (!iso) return '—';
    var partes = String(iso).slice(0, 10).split('-');
    if (partes.length !== 3) return esc(iso);
    return partes[2] + '/' + partes[1] + '/' + partes[0];
  }

  function dataHoraBR(iso) {
    if (!iso) return '—';
    var d = new Date(iso);
    if (isNaN(d.getTime())) return '—';
    return d.toLocaleString('pt-BR', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
  }

  function hoje() { return new Date().toISOString().slice(0, 10); }

  function numeroBR(valor) {
    var n = Number(valor);
    if (isNaN(n)) return esc(valor);
    return n.toLocaleString('pt-BR', { maximumFractionDigits: 2 });
  }

  function classeProgresso(pct) {
    if (pct >= 100) return 'completa';
    if (pct > 0) return 'parcial';
    return 'vazia';
  }

  function barra(pct) {
    var p = Math.max(0, Math.min(100, Number(pct) || 0));
    return (
      '<div class="barra ' + classeProgresso(p) + '" role="progressbar" ' +
      'aria-valuenow="' + p + '" aria-valuemin="0" aria-valuemax="100">' +
      '<span style="width:' + p + '%"></span></div>'
    );
  }

  function opcoes(lista, selecionado) {
    return lista
      .map(function (o) {
        return (
          '<option value="' + esc(o.valor) + '"' +
          (o.valor === selecionado ? ' selected' : '') +
          '>' + esc(o.rotulo) + '</option>'
        );
      })
      .join('');
  }

  var torradaTempo = null;
  function avisar(mensagem) {
    var caixa = doc.getElementById('torrada');
    if (!caixa) return;
    caixa.textContent = mensagem;
    caixa.classList.add('aparece');
    if (torradaTempo) clearTimeout(torradaTempo);
    torradaTempo = setTimeout(function () {
      caixa.classList.remove('aparece');
    }, 2600);
  }

  /** Atributo disabled quando o perfil é somente leitura. */
  function trava() { return Store.podeEditar() ? '' : ' disabled'; }

  /** Há armazenamento de arquivos? Só no modo nuvem. */
  function podeAnexar() {
    return !!(Store && typeof Store.enviarArquivo === 'function');
  }

  /** Lista de extensões para o atributo accept do campo de arquivo. */
  function aceitaArquivos() {
    var lista = (Store && Store.EXTENSOES_ACEITAS) || [];
    return lista.join(',');
  }

  function tamanhoLegivel(bytes) {
    var n = Number(bytes);
    if (!n || isNaN(n)) return '';
    if (n < 1024) return n + ' B';
    if (n < 1024 * 1024) return (n / 1024).toFixed(0) + ' KB';
    return (n / 1024 / 1024).toFixed(1) + ' MB';
  }

  function avisoConsulta() {
    if (Store.podeEditar()) return '';

    // Quem está simulando já tem a faixa de teste no topo, com a explicação e
    // o caminho de volta. Repetir aqui só ocuparia espaço.
    if (papelSimulado()) return '';

    if (naNuvem()) {
      return (
        '<div class="aviso info nao-imprimir">' +
        '<strong>Modo consulta.</strong> Os campos estão bloqueados: este perfil ' +
        'visualiza e gera o dossiê, mas não altera registros. Quem libera outro ' +
        'perfil é o gestor do parque.' +
        '</div>'
      );
    }

    return (
      '<div class="aviso info nao-imprimir">' +
      '<strong>Modo consulta.</strong> Os campos estão bloqueados para evitar ' +
      'alterações acidentais. Para editar, troque para <em>Gestor</em> no topo da página.' +
      '</div>'
    );
  }

  /** Papel que o gestor está simulando, ou '' se não há simulação. */
  function papelSimulado() {
    return (Store && Store.papelSimulado && Store.papelSimulado()) || '';
  }

  /** Faixa mostrada em TODAS as telas enquanto o gestor vê o sistema como
   *  outro papel.
   *
   *  Ela carrega o botão de volta por necessidade, não por enfeite: ao simular
   *  "consulta" o gestor deixa de ver a tela de Equipe — que é de onde a
   *  simulação é ligada. Sem a faixa, o único jeito de voltar seria recarregar
   *  a página, e quem não sabe disso acharia que travou o sistema. */
  function faixaSimulacao() {
    var p = papelSimulado();
    if (!p) return '';
    return (
      '<div class="aviso atencao nao-imprimir faixa-teste">' +
      '<div><strong>Modo de teste:</strong> você está vendo o sistema como ' +
      '<strong>' + esc(Store.rotuloDe(Store.PAPEIS, p)) + '</strong>. ' +
      'Seu papel de verdade continua sendo gestor; isto muda apenas o que a ' +
      'tela oferece.</div>' +
      '<button type="button" class="botao secundario pequeno" id="btn-voltar-gestor">' +
      'Voltar a ser gestor</button>' +
      '</div>'
    );
  }

  function ligarFaixaSimulacao() {
    var botao = doc.getElementById('btn-voltar-gestor');
    if (!botao) return;
    botao.addEventListener('click', function () {
      Store.simularPapel(null);
      avisar('De volta ao papel de gestor.');
      renderizar();
    });
  }

  function ir(hash) { global.location.hash = hash; }

  /* =============================================================== gráficos */

  var Grafico = {
    /** Progresso de cada nível — em HTML, não em SVG.
     *
     *  Isto já foi um SVG com viewBox, e o resultado era ruim: o texto ficava
     *  em unidades do viewBox, então ao esticar o gráfico para a largura do
     *  cartão a fonte escalava junto e virava um título gigante.
     *
     *  Barra em HTML não tem esse problema: o texto fica no tamanho real da
     *  página e a barra tem altura fixa, independente da largura da tela.
     *  Também é mais acessível, porque o leitor de tela lê o texto de verdade
     *  em vez de depender do rótulo do SVG. */
    barrasNiveis: function (niveis) {
      if (!niveis.length) return '';
      return (
        '<ul class="lista-niveis">' +
        niveis.map(function (n) {
          return (
            '<li>' +
            '<div class="lista-niveis-topo">' +
            '<span class="negrito">CERNE ' + n.numero + '</span>' +
            '<span class="suave pequeno">' + esc(n.nome) + '</span>' +
            '<span class="numero-pct">' + n.percentual + '%</span>' +
            '</div>' +
            barra(n.percentual) +
            '<div class="pequeno suave" style="margin-top:.25rem">' +
            n.completas + ' de ' + n.total + ' práticas completas</div>' +
            '</li>'
          );
        }).join('') +
        '</ul>'
      );
    },

    /** Radar (pentágono) com as notas de 0 a 5 dos cinco eixos. */
    radarEixos: function (notasPorEixo) {
      var eixos = Store.EIXOS;
      var centro = 100, raio = 66, maximo = 5;
      var passos = 5;

      function ponto(indice, valor) {
        var ang = (Math.PI * 2 * indice) / eixos.length - Math.PI / 2;
        var r = (raio * Math.max(0, Math.min(maximo, valor))) / maximo;
        return [centro + r * Math.cos(ang), centro + r * Math.sin(ang)];
      }

      var grades = '';
      for (var passo = 1; passo <= passos; passo++) {
        var pts = eixos.map(function (_, i) {
          var p = ponto(i, (maximo * passo) / passos);
          return p[0].toFixed(1) + ',' + p[1].toFixed(1);
        });
        grades +=
          '<polygon points="' + pts.join(' ') + '" fill="none" stroke="#e2e8f0" stroke-width="1"></polygon>';
      }

      var raios = eixos.map(function (_, i) {
        var p = ponto(i, maximo);
        return '<line x1="' + centro + '" y1="' + centro + '" x2="' + p[0].toFixed(1) +
          '" y2="' + p[1].toFixed(1) + '" stroke="#e2e8f0" stroke-width="1"></line>';
      }).join('');

      var valores = eixos.map(function (eixo, i) {
        var p = ponto(i, Number(notasPorEixo[eixo.valor]) || 0);
        return p[0].toFixed(1) + ',' + p[1].toFixed(1);
      });

      var marcas = eixos.map(function (eixo, i) {
        var p = ponto(i, maximo);
        var dx = p[0] - centro, dy = p[1] - centro;
        var norma = Math.sqrt(dx * dx + dy * dy) || 1;
        var x = centro + (dx / norma) * (raio + 17);
        var y = centro + (dy / norma) * (raio + 15);
        var ancora = Math.abs(x - centro) < 8 ? 'middle' : x > centro ? 'start' : 'end';
        var nota = Number(notasPorEixo[eixo.valor]) || 0;
        return (
          '<text x="' + x.toFixed(1) + '" y="' + (y + 3).toFixed(1) + '" font-size="8.5" ' +
          'text-anchor="' + ancora + '" font-weight="600">' + esc(eixo.rotulo) + ' ' + nota + '</text>'
        );
      }).join('');

      var descricao = eixos.map(function (e) {
        return e.rotulo + ': ' + (Number(notasPorEixo[e.valor]) || 0);
      }).join(', ');

      return (
        '<svg class="grafico" viewBox="0 0 200 200" role="img" ' +
        'aria-label="Radar dos cinco eixos. ' + esc(descricao) + '">' +
        grades + raios +
        '<polygon points="' + valores.join(' ') + '" fill="rgba(11,94,215,.22)" ' +
        'stroke="#0b5ed7" stroke-width="2"></polygon>' +
        marcas + '</svg>'
      );
    }
  };

  /* ================================================================= telas */

  var Telas = {};

  /* ------------------------------------------------------------- dashboard */

  Telas.dashboard = function () {
    var pront = Store.calcularProntidao();
    var res = Store.resumo();
    var mec = Store.mecanismo();

    var cabecalhoProntidao = pront.apto_nivel > 0
      ? '<div class="numerao verde">CERNE ' + pront.apto_nivel + '</div>' +
        '<p class="negrito" style="color:var(--verde)">Apto a solicitar</p>' +
        '<p class="pequeno suave sem-margem">Todas as práticas dos níveis 1 a ' +
        pront.apto_nivel + ' estão completas.</p>'
      : '<div class="numerao cinza">—</div>' +
        '<p class="negrito suave">Ainda não apto ao CERNE 1</p>' +
        '<p class="pequeno suave sem-margem">Complete todas as práticas do nível 1 ' +
        'para ficar apto.</p>';

    var pctGeral = pront.total_praticas
      ? Math.round((100 * pront.total_completas) / pront.total_praticas)
      : 0;

    var cartoesNivel = pront.niveis.map(function (n) {
      var processos = n.processos.map(function (p) {
        var marca = p.percentual >= 100 ? 'ok' : p.percentual > 0 ? 'parcial' : 'pendente';
        var simbolo = p.percentual >= 100 ? '●' : p.percentual > 0 ? '◐' : '○';
        return (
          '<li><span><span class="marcador ' + marca + '" aria-hidden="true">' + simbolo +
          '</span> ' + esc(p.codigo) + ' ' + esc(p.nome) + '</span>' +
          '<span class="suave pequeno">' + p.completas + '/' + p.total + '</span></li>'
        );
      }).join('');

      var etiqueta = n.percentual >= 100 ? 'verde' : n.percentual > 0 ? 'amarela' : 'cinza';

      return (
        '<div class="cartao">' +
        '<div class="cartao-titulo">' +
        '<h3>CERNE ' + n.numero + ' — ' + esc(n.nome) + '</h3>' +
        '<span class="etiqueta ' + etiqueta + '">' + n.percentual + '%</span>' +
        '</div>' +
        barra(n.percentual) +
        '<p class="pequeno suave" style="margin:.45rem 0 .6rem">' +
        n.completas + ' de ' + n.total + ' práticas completas</p>' +
        '<ul class="lista pequeno">' + processos + '</ul>' +
        '</div>'
      );
    }).join('');

    var pendencias = '';
    if (pront.proximo_nivel) {
      var itens = pront.pendencias_proximo.map(function (item) {
        var faltas = item.faltas.map(function (f) {
          return '<li>' + esc(f) + '</li>';
        }).join('');
        return (
          '<div class="dossie-pratica">' +
          '<a class="negrito" href="#/pratica/' + encodeURIComponent(item.pratica.codigo) + '">' +
          esc(item.pratica.codigo) + ' ' + esc(item.pratica.nome) + '</a>' +
          '<ul class="lista-faltas">' + faltas + '</ul>' +
          '</div>'
        );
      }).join('');

      pendencias =
        '<div class="cartao">' +
        '<div class="cartao-titulo"><h2>O que falta para o CERNE ' + pront.proximo_nivel + '</h2>' +
        '<span class="etiqueta ' + (pront.pendencias_proximo.length ? 'amarela' : 'verde') + '">' +
        pront.pendencias_proximo.length + ' prática(s) com pendência</span></div>' +
        (pront.pendencias_proximo.length
          ? '<div class="grade grade-2">' + itens + '</div>'
          : '<div class="aviso ok sem-margem">Tudo pronto para este nível.</div>') +
        '</div>';
    }

    return (
      '<div class="cartao-titulo">' +
      '<div><h1>Painel de prontidão</h1>' +
      '<p class="suave sem-margem">' + esc(mec.nome) +
      (mec.cidade_uf ? ' · ' + esc(mec.cidade_uf) : '') +
      ' · ' + esc(Store.catalogo.versao.nome || 'CERNE') + '</p></div>' +
      '<div class="acoes nao-imprimir">' +
      '<a class="botao secundario" href="#/catalogo">Ver práticas</a>' +
      '<a class="botao" href="#/dossie">Gerar dossiê</a>' +
      '</div></div>' +

      '<div class="grade grade-radar">' +
      '<div class="cartao centro">' +
      '<p class="rotulo-secao">Radar de prontidão</p>' + cabecalhoProntidao +
      '</div>' +
      '<div class="cartao">' +
      '<p class="rotulo-secao">Prontidão por nível</p>' +
      Grafico.barrasNiveis(pront.niveis) +
      '<p class="pequeno suave" style="margin:.6rem 0 0">Progresso geral: <strong>' +
      pront.total_completas + ' de ' + pront.total_praticas + '</strong> práticas completas (' +
      pctGeral + '%).</p>' +
      '</div></div>' +

      '<div class="grade grade-4">' +
      indicador('Práticas completas', pront.total_completas + ' / ' + pront.total_praticas) +
      indicador('Evidências registradas', res.evidencias) +
      indicador('Medições lançadas', res.medicoes) +
      indicador('Planos de ação abertos', res.planos_abertos) +
      '</div>' +

      '<h2 class="espaco-acima">Níveis</h2>' +
      '<div class="grade grade-2">' + cartoesNivel + '</div>' +
      pendencias +

      '<div class="aviso info nao-imprimir espaco-acima">' +
      'Primeira vez aqui? Veja o <a href="#/guia">guia de preenchimento</a> ou carregue ' +
      'dados de demonstração em <a href="#/dados">Dados e backup</a>.' +
      '</div>'
    );
  };

  function indicador(nome, valor) {
    return (
      '<div class="cartao indicador">' +
      '<div class="nome">' + esc(nome) + '</div>' +
      '<div class="valor">' + esc(valor) + '</div>' +
      '</div>'
    );
  }

  /* -------------------------------------------------------------- catálogo */

  var filtroCatalogo = { texto: '', nivel: '', situacao: '' };

  Telas.catalogo = function () {
    var pront = Store.calcularProntidao();
    var texto = filtroCatalogo.texto.trim().toLowerCase();

    var blocos = [];
    var mostradas = 0;

    pront.niveis.forEach(function (n) {
      if (filtroCatalogo.nivel && String(n.numero) !== filtroCatalogo.nivel) return;

      var processosHtml = [];
      n.processos.forEach(function (p) {
        var itens = p.praticas.filter(function (info) {
          var pr = info.pratica;
          if (filtroCatalogo.situacao === 'completa' && !info.completa) return false;
          if (filtroCatalogo.situacao === 'pendente' && info.completa) return false;
          if (filtroCatalogo.situacao && filtroCatalogo.situacao !== 'completa' &&
              filtroCatalogo.situacao !== 'pendente' &&
              info.situacao !== filtroCatalogo.situacao) return false;
          if (!texto) return true;
          return (
            (pr.codigo + ' ' + pr.nome + ' ' + (pr.descricao || '') + ' ' + (pr.objetivo || ''))
              .toLowerCase().indexOf(texto) !== -1
          );
        });

        if (!itens.length) return;
        mostradas += itens.length;

        var lista = itens.map(function (info) {
          var simbolo = info.completa ? '●' : info.situacao !== 'nao_iniciada' ? '◐' : '○';
          var marca = info.completa ? 'ok' : info.situacao !== 'nao_iniciada' ? 'parcial' : 'pendente';
          var etiqueta = info.completa
            ? '<span class="etiqueta verde">Completa</span>'
            : '<span class="etiqueta ' +
              (info.situacao === 'nao_iniciada' ? 'cinza' : 'amarela') + '">' +
              esc(info.situacao_rotulo) + '</span>';
          return (
            '<a class="item-pratica" href="#/pratica/' + encodeURIComponent(info.pratica.codigo) + '">' +
            '<span class="marcador ' + marca + '" aria-hidden="true">' + simbolo + '</span>' +
            '<span class="codigo">' + esc(info.pratica.codigo) + '</span>' +
            '<span style="flex:1;min-width:0">' +
            '<span class="nome">' + esc(info.pratica.nome) + '</span><br>' +
            '<span class="meta">' + info.n_evidencias + ' evidência(s)' +
            (info.pratica.metricas.length ? ' · ' + info.pratica.metricas.length + ' métrica(s)' : '') +
            '</span></span>' +
            etiqueta + '</a>'
          );
        }).join('');

        processosHtml.push(
          '<details class="bloco" open>' +
          '<summary>' + esc(p.codigo) + ' ' + esc(p.nome) +
          ' <span class="etiqueta ' + (p.percentual >= 100 ? 'verde' : p.percentual > 0 ? 'amarela' : 'cinza') +
          '">' + p.completas + '/' + p.total + '</span></summary>' +
          lista + '</details>'
        );
      });

      if (!processosHtml.length) return;

      blocos.push(
        '<div class="cartao">' +
        '<div class="cartao-titulo">' +
        '<h2><span class="pilula-nivel">' + n.numero + '</span> CERNE ' + n.numero + ' — ' + esc(n.nome) + '</h2>' +
        '<span class="etiqueta ' + (n.percentual >= 100 ? 'verde' : n.percentual > 0 ? 'amarela' : 'cinza') +
        '">' + n.percentual + '%</span></div>' +
        (n.descricao ? '<p class="pequeno suave">' + esc(n.descricao) + '</p>' : '') +
        processosHtml.join('') +
        '</div>'
      );
    });

    var situacoesFiltro = [{ valor: '', rotulo: 'Todas as situações' }]
      .concat(Store.SITUACOES)
      .concat([
        { valor: 'completa', rotulo: '✓ Completas (prontas)' },
        { valor: 'pendente', rotulo: '! Com pendências' }
      ]);

    var niveisFiltro = [{ valor: '', rotulo: 'Todos os níveis' }].concat(
      Store.catalogo.niveis.map(function (n) {
        return { valor: String(n.numero), rotulo: 'CERNE ' + n.numero + ' — ' + n.nome };
      })
    );

    return (
      '<h1>Práticas-chave</h1>' +
      '<p class="suave">Clique em uma prática para registrar situação, evidências e métricas.</p>' +

      '<div class="cartao nao-imprimir">' +
      '<div class="filtros">' +
      '<div class="campo sem-margem"><label for="f-texto">Buscar</label>' +
      '<input type="text" id="f-texto" placeholder="código, nome ou palavra-chave" value="' +
      esc(filtroCatalogo.texto) + '"></div>' +
      '<div class="campo sem-margem"><label for="f-nivel">Nível</label>' +
      '<select id="f-nivel">' + opcoes(niveisFiltro, filtroCatalogo.nivel) + '</select></div>' +
      '<div class="campo sem-margem"><label for="f-situacao">Situação</label>' +
      '<select id="f-situacao">' + opcoes(situacoesFiltro, filtroCatalogo.situacao) + '</select></div>' +
      '</div></div>' +

      (blocos.length
        ? blocos.join('')
        : '<div class="vazio">Nenhuma prática encontrada com esses filtros.</div>') +

      (mostradas ? '<p class="pequeno suave">' + mostradas + ' prática(s) listada(s).</p>' : '')
    );
  };

  Telas.catalogo.ligar = function () {
    var campoTexto = doc.getElementById('f-texto');
    if (campoTexto) {
      var temporizador = null;
      campoTexto.addEventListener('input', function () {
        filtroCatalogo.texto = campoTexto.value;
        if (temporizador) clearTimeout(temporizador);
        temporizador = setTimeout(function () {
          var posicao = campoTexto.selectionStart;
          renderizar();
          var novo = doc.getElementById('f-texto');
          if (novo) { novo.focus(); novo.setSelectionRange(posicao, posicao); }
        }, 250);
      });
    }
    var fn = doc.getElementById('f-nivel');
    if (fn) fn.addEventListener('change', function () {
      filtroCatalogo.nivel = fn.value; renderizar();
    });
    var fs = doc.getElementById('f-situacao');
    if (fs) fs.addEventListener('change', function () {
      filtroCatalogo.situacao = fs.value; renderizar();
    });
  };

  /* ------------------------------------------------- detalhe de uma prática */

  var praticaAtual = null;
  // Filtro de exibição das evidências na tela da prática. Afeta só o que é
  // mostrado; a contagem e o cálculo de prontidão continuam sobre todos os
  // registros. Começa vazio (mostra tudo) e é zerado ao trocar de prática.
  var filtroEvidencias = { ano: '', tipo: '' };

  /** A evidência passa pelo filtro atual da tela da prática?
   *  `tipoDoItem` é 'requisito' (vinculada a um requisito do CERNE) ou
   *  'propria' (material próprio do parque). */
  function passaFiltroEvid(e, tipoDoItem) {
    if (filtroEvidencias.tipo && filtroEvidencias.tipo !== tipoDoItem) return false;
    if (filtroEvidencias.ano && anoDaEvidencia(e) !== filtroEvidencias.ano) return false;
    return true;
  }

  Telas.pratica = function (codigo) {
    var item = Store.buscarPratica(codigo);
    if (!item) {
      return '<div class="aviso erro">Prática <strong>' + esc(codigo) +
        '</strong> não encontrada no catálogo. <a href="#/catalogo">Voltar às práticas</a>.</div>';
    }
    // Ao abrir outra prática, zera o filtro de evidências: os anos disponíveis
    // mudam de uma prática para outra.
    if (praticaAtual !== codigo) filtroEvidencias = { ano: '', tipo: '' };
    praticaAtual = codigo;

    var pr = item.pratica;
    var st = Store.statusDe(codigo);
    var faltas = Store.faltasDaPratica(pr);
    var completa = faltas.length === 0;
    var somenteLeitura = !Store.podeEditar();

    /* ---- requisitos de evidência ---- */
    var evidencias = Store.evidenciasDaPratica(codigo);
    var requisitosHtml = (pr.requisitos || []).map(function (req) {
      var doRequisito = evidencias.filter(function (e) { return e.requisito === req.id; });
      var atendido = doRequisito.length > 0;

      var listaEvid = doRequisito.filter(function (e) {
        return passaFiltroEvid(e, 'requisito');
      }).map(function (e) {
        var link = urlSegura(e.link);
        var anexo = e.arquivo && e.arquivo.url ? e.arquivo : null;
        var vinc = vinculoEvidencia(e);
        return (
          '<li><span style="flex:1;min-width:0">' +
          (e.protocolo ? '<span class="etiqueta azul">' + esc(e.protocolo) + '</span> ' : '') +
          '<strong>' + esc(e.titulo) + '</strong>' +
          (anexo
            ? ' · <a href="' + esc(urlSegura(anexo.url)) + '" target="_blank" ' +
              'rel="noopener noreferrer" class="quebra">' +
              'baixar arquivo</a>'
            : '') +
          (link ? ' · <a href="' + esc(link) + '" target="_blank" rel="noopener noreferrer" class="quebra">abrir link</a>' : '') +
          '<br><span class="pequeno suave quebra">' +
          (anexo ? esc(anexo.nome) + ' · ' + tamanhoLegivel(anexo.tamanho) + ' · ' : '') +
          (e.descricao ? esc(e.descricao) + ' · ' : '') +
          'ref. ' + dataBR(e.data_referencia) +
          (e.responsavel ? ' · ' + esc(e.responsavel) : '') +
          (vinc ? ' · ' + vinc : '') +
          '</span></span>' +
          (somenteLeitura ? '' :
            '<button type="button" class="botao secundario pequeno nao-imprimir" ' +
            'data-remover-evidencia="' + esc(e.id) + '">Remover</button>') +
          '</li>'
        );
      }).join('');

      return (
        '<details class="bloco"' + (atendido ? '' : ' open') + '>' +
        '<summary>' +
        '<span class="marcador ' + (atendido ? 'ok' : 'pendente') + '" aria-hidden="true">' +
        (atendido ? '●' : '○') + '</span>' +
        '<span style="flex:1;min-width:0">' + esc(req.descricao) + '</span>' +
        // A contagem deixa claro que o requisito aceita VÁRIAS evidências.
        // Antes só aparecia "Atendido", o que dava a impressão de que era
        // uma por requisito e que o item estava encerrado.
        (doRequisito.length
          ? '<span class="etiqueta azul">' + doRequisito.length +
            ' anexada' + (doRequisito.length > 1 ? 's' : '') + '</span>'
          : '') +
        (req.obrigatorio
          ? '<span class="etiqueta ' + (atendido ? 'verde' : 'vermelha') + '">' +
            (atendido ? 'Atendido' : 'Obrigatório') + '</span>'
          : '<span class="etiqueta cinza">Opcional</span>') +
        '</summary>' +
        (req.exemplo ? '<p class="pequeno suave"><strong>Exemplo:</strong> ' + esc(req.exemplo) + '</p>' : '') +
        (listaEvid ? '<ul class="lista">' + listaEvid + '</ul>' : '<p class="pequeno suave">Nenhuma evidência registrada.</p>') +
        // O formulário fica dentro de um bloco próprio, com rótulo explícito.
        // Assim, mesmo num requisito já atendido, existe uma ação visível
        // convidando a anexar OUTRA evidência — um requisito pode ser
        // comprovado por vários documentos.
        (somenteLeitura ? '' :
          '<details class="bloco-adicionar nao-imprimir"' + (atendido ? '' : ' open') + '>' +
          '<summary>' +
          (atendido ? '+ Anexar outra evidência' : '+ Anexar evidência') +
          '</summary>' +
          '<form data-form-evidencia="' + esc(req.id) + '">' +
          '<div class="linha-campos">' +
          '<div class="campo"><label>Título da evidência</label>' +
          '<input type="text" name="titulo" required placeholder="ex.: Procedimento de sensibilização v2"></div>' +
          '<div class="campo"><label>Data de referência</label>' +
          '<input type="date" name="data_referencia" value="' + hoje() + '"></div>' +
          '</div>' +

          // O campo de arquivo só aparece quando há armazenamento (modo
          // nuvem). No modo local não há onde guardar o arquivo, então
          // oferecer o campo seria enganoso.
          (podeAnexar()
            ? '<div class="campo campo-arquivo">' +
              '<label>Anexar arquivo</label>' +
              '<input type="file" name="arquivo" accept="' + aceitaArquivos() + '">' +
              '<span class="ajuda">PDF, Word, Excel, imagem, ZIP... até 20 MB. ' +
              'O arquivo fica guardado no sistema.</span>' +
              '<div class="envio-barra" hidden><div class="envio-trilha">' +
              '<span></span></div><span class="envio-texto"></span></div>' +
              '</div>'
            : '') +

          '<div class="linha-campos tres">' +
          '<div class="campo"><label>' +
          (podeAnexar() ? 'Ou link externo' : 'Link (opcional)') + '</label>' +
          '<input type="url" name="link" placeholder="https://... ou link da pasta compartilhada"></div>' +
          '<div class="campo"><label>Responsável</label>' +
          '<input type="text" name="responsavel" placeholder="quem produziu"></div>' +
          '<div class="campo"><label>Observação</label>' +
          '<input type="text" name="descricao" placeholder="o que este documento comprova"></div>' +
          '</div>' +
          camposVinculoForm() +
          '<button type="submit" class="botao pequeno">Registrar evidência</button>' +
          '</form></details>') +
        '</details>'
      );
    }).join('');

    /* ---- evidências próprias do parque, fora da lista do CERNE ---- */
    var proprias = evidencias.filter(function (e) { return !e.requisito; });
    var propriasHtml = proprias.filter(function (e) {
      return passaFiltroEvid(e, 'propria');
    }).map(function (e) {
      var link = urlSegura(e.link);
      var anexo = e.arquivo && e.arquivo.url ? e.arquivo : null;
      var vinc = vinculoEvidencia(e);
      return (
        '<li><span style="flex:1;min-width:0">' +
        (e.protocolo ? '<span class="etiqueta azul">' + esc(e.protocolo) + '</span> ' : '') +
        '<strong>' + esc(e.titulo) + '</strong>' +
        (e.refere_a ? ' <span class="etiqueta cinza">' + esc(e.refere_a) + '</span>' : '') +
        (anexo
          ? ' · <a href="' + esc(urlSegura(anexo.url)) + '" target="_blank" ' +
            'rel="noopener noreferrer" class="quebra">baixar arquivo</a>'
          : '') +
        (link ? ' · <a href="' + esc(link) + '" target="_blank" rel="noopener noreferrer" class="quebra">abrir link</a>' : '') +
        '<br><span class="pequeno suave quebra">' +
        (anexo ? esc(anexo.nome) + ' · ' + tamanhoLegivel(anexo.tamanho) + ' · ' : '') +
        (e.descricao ? esc(e.descricao) + ' · ' : '') +
        'ref. ' + dataBR(e.data_referencia) +
        (e.responsavel ? ' · ' + esc(e.responsavel) : '') +
        (vinc ? ' · ' + vinc : '') +
        '</span></span>' +
        (somenteLeitura ? '' :
          '<button type="button" class="botao secundario pequeno nao-imprimir" ' +
          'data-remover-evidencia="' + esc(e.id) + '">Remover</button>') +
        '</li>'
      );
    }).join('');

    /* ---- métricas ---- */
    var metricasHtml = (pr.metricas || []).map(function (met) {
      var medicoes = Store.medicoesDaMetrica(met.id);
      var temMedicao = medicoes.length > 0;

      var linhas = medicoes.map(function (m) {
        return (
          '<tr><td class="numero">' + numeroBR(m.valor) + (met.unidade ? ' ' + esc(met.unidade) : '') + '</td>' +
          '<td>' + dataBR(m.data) + '</td>' +
          '<td>' + esc(m.observacao || '') + '</td>' +
          (somenteLeitura ? '' :
            '<td class="numero nao-imprimir"><button type="button" class="botao secundario pequeno" ' +
            'data-remover-medicao="' + esc(m.id) + '">Remover</button></td>') +
          '</tr>'
        );
      }).join('');

      return (
        '<details class="bloco"' + (temMedicao ? '' : ' open') + '>' +
        '<summary>' +
        '<span class="marcador ' + (temMedicao ? 'ok' : 'pendente') + '" aria-hidden="true">' +
        (temMedicao ? '●' : '○') + '</span>' +
        '<span style="flex:1;min-width:0">' + esc(met.nome) +
        (met.unidade ? ' <span class="suave pequeno">(' + esc(met.unidade) + ')</span>' : '') + '</span>' +
        (met.obrigatoria
          ? '<span class="etiqueta ' + (temMedicao ? 'verde' : 'vermelha') + '">' +
            (temMedicao ? 'Medida' : 'Obrigatória') + '</span>'
          : '<span class="etiqueta cinza">Opcional</span>') +
        '</summary>' +
        (met.meta ? '<p class="pequeno"><strong>Meta:</strong> ' + esc(met.meta) + '</p>' : '') +
        (met.descricao ? '<p class="pequeno suave">' + esc(met.descricao) + '</p>' : '') +
        (met.exemplo ? '<p class="pequeno suave"><strong>Exemplo:</strong> ' + esc(met.exemplo) + '</p>' : '') +
        (linhas
          ? '<div class="tabela-rolagem"><table class="tabela"><thead><tr>' +
            '<th class="numero">Valor</th><th>Data</th><th>Observação</th>' +
            (somenteLeitura ? '' : '<th class="numero nao-imprimir">Ações</th>') +
            '</tr></thead><tbody>' + linhas + '</tbody></table></div>'
          : '<p class="pequeno suave">Nenhuma medição registrada.</p>') +
        (somenteLeitura ? '' :
          '<form class="nao-imprimir" data-form-medicao="' + esc(met.id) + '" ' +
          'style="border-top:1px solid var(--cinza-200);margin-top:.6rem;padding-top:.7rem">' +
          '<div class="linha-campos tres">' +
          '<div class="campo"><label>Valor medido</label>' +
          '<input type="number" name="valor" step="any" required></div>' +
          '<div class="campo"><label>Data da medição</label>' +
          '<input type="date" name="data" value="' + hoje() + '" required></div>' +
          '<div class="campo"><label>Observação</label>' +
          '<input type="text" name="observacao" placeholder="opcional"></div>' +
          '</div>' +
          '<button type="submit" class="botao pequeno">Lançar medição</button>' +
          '</form>') +
        '</details>'
      );
    }).join('');

    /* ---- revisões críticas ---- */
    var revisoes = Store.revisoesDaPratica(codigo);
    var revisoesHtml = revisoes.length
      ? revisoes.map(function (r) {
          return (
            '<details class="bloco"><summary>Revisão de ' + dataBR(r.data) +
            (r.periodo ? ' · ' + esc(r.periodo) : '') +
            (r.necessita_ajustes ? ' <span class="etiqueta amarela">Requer ajustes</span>' : '') +
            '</summary>' +
            '<p class="pequeno"><strong>Eficiência:</strong> ' + esc(r.eficiencia || '—') + '</p>' +
            '<p class="pequeno"><strong>Eficácia:</strong> ' + esc(r.eficacia || '—') + '</p>' +
            '<p class="pequeno"><strong>Efetividade:</strong> ' + esc(r.efetividade || '—') + '</p>' +
            (r.observacoes ? '<p class="pequeno suave">' + esc(r.observacoes) + '</p>' : '') +
            (somenteLeitura ? '' :
              '<button type="button" class="botao secundario pequeno nao-imprimir" ' +
              'data-remover-revisao="' + esc(r.id) + '">Remover</button>') +
            '</details>'
          );
        }).join('')
      : '<p class="pequeno suave">Nenhuma revisão crítica registrada.</p>';

    var formRevisao = somenteLeitura ? '' :
      '<details class="bloco nao-imprimir"><summary>+ Registrar revisão crítica</summary>' +
      '<form id="form-revisao">' +
      '<div class="linha-campos">' +
      '<div class="campo"><label>Data da revisão</label>' +
      '<input type="date" name="data" value="' + hoje() + '" required></div>' +
      '<div class="campo"><label>Período avaliado</label>' +
      '<input type="text" name="periodo" placeholder="ex.: 2º semestre de 2025"></div>' +
      '</div>' +
      '<div class="campo"><label>Eficiência (produtividade: fizemos com os recursos previstos?)</label>' +
      '<textarea name="eficiencia"></textarea></div>' +
      '<div class="campo"><label>Eficácia (qualidade: atingimos o que planejamos?)</label>' +
      '<textarea name="eficacia"></textarea></div>' +
      '<div class="campo"><label>Efetividade (impacto: gerou o resultado esperado?)</label>' +
      '<textarea name="efetividade"></textarea></div>' +
      '<div class="campo caixa-marcar">' +
      '<input type="checkbox" id="rev-ajustes" name="necessita_ajustes">' +
      '<label for="rev-ajustes">Necessita ajustes</label></div>' +
      '<div class="campo"><label>Observações</label><textarea name="observacoes"></textarea></div>' +
      '<button type="submit" class="botao">Salvar revisão</button>' +
      '</form></details>';

    /* ---- planos de ação ---- */
    var planos = Store.planosDaPratica(codigo);
    var planosHtml = planos.length
      ? '<ul class="lista">' + planos.map(function (p) {
          var cor = p.situacao === 'concluido' ? 'verde'
            : p.situacao === 'cancelado' ? 'cinza'
            : p.situacao === 'em_andamento' ? 'amarela' : 'azul';
          return (
            '<li><span style="flex:1;min-width:0">' + esc(p.descricao) +
            '<br><span class="pequeno suave">' +
            (p.responsavel ? esc(p.responsavel) + ' · ' : '') +
            'prazo ' + dataBR(p.prazo) + '</span></span>' +
            '<span class="etiqueta ' + cor + '">' +
            esc(Store.rotuloDe(Store.SITUACOES_PLANO, p.situacao)) + '</span>' +
            (somenteLeitura ? '' :
              '<button type="button" class="botao secundario pequeno nao-imprimir" ' +
              'data-remover-plano="' + esc(p.id) + '">Remover</button>') +
            '</li>'
          );
        }).join('') + '</ul>'
      : '<p class="pequeno suave">Nenhum plano de ação.</p>';

    var formPlano = somenteLeitura ? '' :
      '<details class="bloco nao-imprimir"><summary>+ Novo plano de ação</summary>' +
      '<form id="form-plano">' +
      '<div class="campo"><label>Descrição da ação</label>' +
      '<textarea name="descricao" required></textarea></div>' +
      '<div class="linha-campos tres">' +
      '<div class="campo"><label>Responsável</label><input type="text" name="responsavel"></div>' +
      '<div class="campo"><label>Prazo</label><input type="date" name="prazo"></div>' +
      '<div class="campo"><label>Situação</label>' +
      '<select name="situacao">' + opcoes(Store.SITUACOES_PLANO, 'aberto') + '</select></div>' +
      '</div>' +
      '<button type="submit" class="botao">Salvar plano</button>' +
      '</form></details>';

    var recomendacoes = (pr.recomendacoes || []).length
      ? '<div class="cartao"><p class="rotulo-secao">Recomendações da metodologia</p>' +
        '<ul>' + pr.recomendacoes.map(function (t) {
          return '<li>' + esc(t) + '</li>';
        }).join('') + '</ul></div>'
      : '';

    /* ---- filtros de exibição das evidências (ano e tipo) ---- */
    var anosDisponiveis = {};
    evidencias.forEach(function (e) {
      var a = anoDaEvidencia(e);
      if (a) anosDisponiveis[a] = true;
    });
    var anosFiltro = [{ valor: '', rotulo: 'Todos os anos' }].concat(
      Object.keys(anosDisponiveis).sort().reverse().map(function (a) {
        return { valor: a, rotulo: a };
      })
    );
    var tiposFiltro = [
      { valor: '', rotulo: 'Todos os tipos' },
      { valor: 'requisito', rotulo: 'Por requisito do CERNE' },
      { valor: 'propria', rotulo: 'Própria do parque' }
    ];
    var filtrosEvidenciaHtml =
      '<div class="filtros nao-imprimir">' +
      '<div class="campo sem-margem"><label for="f-ev-ano">Filtrar por ano</label>' +
      '<select id="f-ev-ano">' + opcoes(anosFiltro, filtroEvidencias.ano) + '</select></div>' +
      '<div class="campo sem-margem"><label for="f-ev-tipo">Filtrar por tipo</label>' +
      '<select id="f-ev-tipo">' + opcoes(tiposFiltro, filtroEvidencias.tipo) + '</select></div>' +
      '</div>';

    return (
      '<p class="trilha nao-imprimir">' +
      '<a href="#/catalogo">Práticas</a> › CERNE ' + item.nivel.numero + ' › ' +
      esc(item.processo.codigo) + ' ' + esc(item.processo.nome) + '</p>' +

      '<div class="cartao-titulo">' +
      '<div><h1>' + esc(pr.codigo) + ' ' + esc(pr.nome) + '</h1>' +
      '<p class="suave sem-margem">CERNE ' + item.nivel.numero + ' — ' + esc(item.nivel.nome) + '</p></div>' +
      (completa
        ? '<span class="etiqueta verde">Completa</span>'
        : '<span class="etiqueta amarela">' + faltas.length + ' pendência(s)</span>') +
      '</div>' +

      avisoConsulta() +

      (completa
        ? '<div class="aviso ok">Esta prática está completa: implantada, com todas as ' +
          'evidências obrigatórias e todas as métricas obrigatórias medidas.</div>'
        : '<div class="aviso atencao"><strong>Para esta prática ficar completa:</strong>' +
          '<ul class="lista-faltas">' + faltas.map(function (f) {
            return '<li>' + esc(f) + '</li>';
          }).join('') + '</ul></div>') +

      '<div class="cartao">' +
      (pr.objetivo ? '<p class="rotulo-secao">Objetivo</p><p>' + esc(pr.objetivo) + '</p>' : '') +
      (pr.descricao ? '<p class="rotulo-secao">Descrição</p><p>' + esc(pr.descricao) + '</p>' : '') +
      (pr.orientacao
        ? '<div class="aviso info sem-margem"><strong>Como preencher:</strong> ' +
          esc(pr.orientacao) + '</div>'
        : '') +
      '</div>' +

      '<div class="cartao">' +
      '<div class="cartao-titulo"><h2>Situação da prática</h2>' +
      '<span class="pequeno suave">' +
      (st.atualizado_em ? 'atualizado em ' + dataHoraBR(st.atualizado_em) : 'nunca preenchido') +
      '</span></div>' +
      '<form id="form-status">' +
      '<div class="linha-campos">' +
      '<div class="campo"><label for="st-situacao">Situação</label>' +
      '<select id="st-situacao" name="situacao"' + trava() + '>' +
      opcoes(Store.SITUACOES, st.situacao) + '</select></div>' +
      '<div class="campo"><label for="st-percentual">Percentual de implantação</label>' +
      '<input type="number" id="st-percentual" name="percentual" min="0" max="100" value="' +
      st.percentual + '"' + trava() + '>' +
      '<span class="ajuda">0 a 100. Serve para acompanhar o andamento; não afeta o cálculo de prontidão.</span></div>' +
      '</div>' +
      '<div class="campo"><label for="st-obs">Observações</label>' +
      '<textarea id="st-obs" name="observacoes"' + trava() + '>' + esc(st.observacoes) + '</textarea></div>' +
      (somenteLeitura ? '' : '<button type="submit" class="botao">Salvar situação</button>') +
      '</form></div>' +

      '<div class="cartao">' +
      '<div class="cartao-titulo"><h2>Evidências por requisito</h2>' +
      '<span class="pequeno suave">' + evidencias.length + ' registrada(s)</span></div>' +
      '<p class="pequeno suave">Cada requisito obrigatório precisa de pelo menos uma evidência ' +
      'para a prática contar como completa. Um requisito aceita <strong>quantas ' +
      'evidências você quiser</strong> — use uma para cada ação ou documento.</p>' +
      filtrosEvidenciaHtml +
      (requisitosHtml || '<p class="pequeno suave">Esta prática não tem requisitos cadastrados.</p>') +
      '</div>' +

      /* Evidências do próprio parque, que não correspondem a um requisito da
         lista do CERNE. Ficam separadas de propósito: aparecem no dossiê,
         mas NÃO contam para a prontidão — a certificação é avaliada pelos
         requisitos do modelo, não pelos que o parque define. */
      '<div class="cartao">' +
      '<div class="cartao-titulo"><h2>Outras evidências desta prática</h2>' +
      '<span class="pequeno suave">' + proprias.length + ' registrada(s)</span></div>' +
      '<p class="pequeno suave">Para material próprio do parque que se encaixa nesta ' +
      'prática, mas não corresponde a um requisito da lista acima. Aparece no dossiê ' +
      'como contexto, e <strong>não altera o cálculo de prontidão</strong> — a ' +
      'certificação é avaliada pelos requisitos do modelo CERNE.</p>' +
      (propriasHtml
        ? '<ul class="lista">' + propriasHtml + '</ul>'
        : '<p class="pequeno suave">Nenhuma registrada.</p>') +
      (somenteLeitura ? '' :
        '<details class="bloco-adicionar nao-imprimir">' +
        '<summary>+ Registrar evidência própria</summary>' +
        '<form data-form-evidencia-propria="1">' +
        '<div class="linha-campos">' +
        '<div class="campo"><label>Título</label>' +
        '<input type="text" name="titulo" required ' +
        'placeholder="ex.: Programa de mentoria do IpêTech"></div>' +
        '<div class="campo"><label>A que se refere</label>' +
        '<input type="text" name="refere_a" ' +
        'placeholder="ex.: iniciativa própria do parque"></div>' +
        '</div>' +
        '<div class="linha-campos">' +
        '<div class="campo"><label>Data de referência</label>' +
        '<input type="date" name="data_referencia" value="' + hoje() + '"></div>' +
        '<div class="campo"><label>Responsável</label>' +
        '<input type="text" name="responsavel"></div>' +
        '</div>' +
        (podeAnexar()
          ? '<div class="campo campo-arquivo">' +
            '<label>Anexar arquivo</label>' +
            '<input type="file" name="arquivo" accept="' + aceitaArquivos() + '">' +
            '<span class="ajuda">Até 20 MB.</span>' +
            '<div class="envio-barra" hidden><div class="envio-trilha">' +
            '<span></span></div><span class="envio-texto"></span></div>' +
            '</div>'
          : '') +
        '<div class="linha-campos">' +
        '<div class="campo"><label>' +
        (podeAnexar() ? 'Ou link externo' : 'Link') + '</label>' +
        '<input type="url" name="link" placeholder="https://..."></div>' +
        '<div class="campo"><label>Observação</label>' +
        '<input type="text" name="descricao" ' +
        'placeholder="o que este material demonstra"></div>' +
        '</div>' +
        camposVinculoForm() +
        '<button type="submit" class="botao pequeno">Registrar evidência</button>' +
        '</form></details>') +
      '</div>' +

      '<div class="cartao">' +
      '<div class="cartao-titulo"><h2>Métricas e metas</h2></div>' +
      (metricasHtml || '<p class="pequeno suave">Esta prática não exige métricas.</p>') +
      '</div>' +

      '<div class="cartao">' +
      '<div class="cartao-titulo"><h2>Revisões críticas (aprendizado)</h2></div>' +
      revisoesHtml + formRevisao +
      '</div>' +

      '<div class="cartao">' +
      '<div class="cartao-titulo"><h2>Planos de ação</h2></div>' +
      planosHtml + formPlano +
      '</div>' +

      recomendacoes
    );
  };

  function dadosDoForm(form) {
    var saida = {};
    Array.prototype.forEach.call(form.elements, function (campo) {
      if (!campo.name) return;
      if (campo.type === 'checkbox') saida[campo.name] = campo.checked;
      else if (campo.type === 'file') saida[campo.name] = campo.files;
      else saida[campo.name] = campo.value;
    });
    return saida;
  }

  /** Registra a evidência, enviando o arquivo primeiro quando houver.
   *
   *  O envio é assíncrono, então a tela precisa dar sinal de vida: o botão
   *  trava, aparece a barra de progresso, e só depois o registro é criado.
   *  A ordem importa — o documento só é gravado se o arquivo subir, para não
   *  existir evidência apontando para arquivo que não chegou. */
  function enviarEvidencia(form, codigo) {
    var d = dadosDoForm(form);
    if (!d.titulo || !d.titulo.trim()) return;

    var arquivos = d.arquivo;
    var arquivo = arquivos && arquivos.length ? arquivos[0] : null;

    // Evidência própria do parque não tem requisito do modelo: o atributo
    // fica ausente e guardamos `requisito: null`. É isso que faz o cálculo
    // de prontidão ignorá-la, de propósito.
    var requisito = form.getAttribute('data-form-evidencia') || null;

    var registro = {
      pratica: codigo,
      requisito: requisito,
      titulo: d.titulo.trim(),
      link: (d.link || '').trim(),
      descricao: (d.descricao || '').trim(),
      data_referencia: d.data_referencia || '',
      responsavel: (d.responsavel || '').trim(),
      empreendimento: (d.empreendimento || '').trim(),
      programa: (d.programa || '').trim()
    };
    if (!requisito) {
      registro.refere_a = (d.refere_a || '').trim();
    }

    // Sem arquivo: comportamento de sempre, direto.
    if (!arquivo || !podeAnexar()) {
      Store.criarEm('evidencias', registro);
      avisar('Evidência registrada.');
      renderizar();
      return;
    }

    var problema = Store.conferirArquivo(arquivo);
    if (problema) {
      global.alert(problema);
      return;
    }

    var botao = form.querySelector('button[type="submit"]');
    var caixaBarra = form.querySelector('.envio-barra');
    var preenchimento = caixaBarra && caixaBarra.querySelector('.envio-trilha > span');
    var textoBarra = caixaBarra && caixaBarra.querySelector('.envio-texto');

    function mostrarProgresso(pct) {
      if (caixaBarra) caixaBarra.hidden = false;
      if (preenchimento) preenchimento.style.width = pct + '%';
      if (textoBarra) textoBarra.textContent = 'Enviando... ' + pct + '%';
    }

    if (botao) {
      botao.disabled = true;
      botao.textContent = 'Enviando arquivo...';
    }
    mostrarProgresso(0);

    Store.enviarArquivo(codigo, registro.data_referencia, arquivo, mostrarProgresso)
      .then(function (anexo) {
        registro.arquivo = anexo;
        Store.criarEm('evidencias', registro);
        avisar('Evidência registrada com o arquivo anexado.');
        renderizar();
      })
      .catch(function (erro) {
        console.error('Falha ao enviar o arquivo:', erro);
        if (botao) {
          botao.disabled = false;
          botao.textContent = 'Registrar evidência';
        }
        if (textoBarra) textoBarra.textContent = '';
        if (caixaBarra) caixaBarra.hidden = true;

        var codigoErro = String(erro && erro.code);
        if (codigoErro === 'storage/unauthorized') {
          global.alert(
            'Sem permissão para enviar arquivos.\n\n' +
            'Confirme que as regras do Storage foram publicadas e que seu ' +
            'perfil permite registrar.'
          );
        } else if (codigoErro === 'storage/retry-limit-exceeded') {
          global.alert('O envio demorou demais. Verifique a conexão e tente de novo.');
        } else if (codigoErro === 'storage/unknown') {
          global.alert(
            'O armazenamento de arquivos ainda não está ativo neste projeto.\n\n' +
            'Ative o Storage no console do Firebase e publique as regras.'
          );
        } else {
          global.alert('Não foi possível enviar o arquivo:\n\n' + (erro && erro.message));
        }
      });
  }

  Telas.pratica.ligar = function () {
    var codigo = praticaAtual;

    var fEvAno = doc.getElementById('f-ev-ano');
    if (fEvAno) fEvAno.addEventListener('change', function () {
      filtroEvidencias.ano = fEvAno.value; renderizar();
    });
    var fEvTipo = doc.getElementById('f-ev-tipo');
    if (fEvTipo) fEvTipo.addEventListener('change', function () {
      filtroEvidencias.tipo = fEvTipo.value; renderizar();
    });

    var formStatus = doc.getElementById('form-status');
    if (formStatus) {
      formStatus.addEventListener('submit', function (ev) {
        ev.preventDefault();
        var d = dadosDoForm(formStatus);
        Store.salvarStatus(codigo, d);
        avisar('Situação salva.');
        renderizar();
      });
    }

    // evidências vinculadas a um requisito do CERNE
    Array.prototype.forEach.call(
      doc.querySelectorAll('[data-form-evidencia]'),
      function (form) {
        form.addEventListener('submit', function (ev) {
          ev.preventDefault();
          enviarEvidencia(form, codigo);
        });
      }
    );

    // evidências próprias do parque (sem requisito do modelo)
    Array.prototype.forEach.call(
      doc.querySelectorAll('[data-form-evidencia-propria]'),
      function (form) {
        form.addEventListener('submit', function (ev) {
          ev.preventDefault();
          enviarEvidencia(form, codigo);
        });
      }
    );

    // medições
    Array.prototype.forEach.call(
      doc.querySelectorAll('[data-form-medicao]'),
      function (form) {
        form.addEventListener('submit', function (ev) {
          ev.preventDefault();
          var d = dadosDoForm(form);
          if (d.valor === '' || d.valor === undefined) return;
          Store.criarEm('medicoes', {
            pratica: codigo,
            metrica: form.getAttribute('data-form-medicao'),
            valor: Number(d.valor),
            data: d.data || hoje(),
            observacao: (d.observacao || '').trim()
          });
          avisar('Medição lançada.');
          renderizar();
        });
      }
    );

    var formRevisao = doc.getElementById('form-revisao');
    if (formRevisao) {
      formRevisao.addEventListener('submit', function (ev) {
        ev.preventDefault();
        var d = dadosDoForm(formRevisao);
        Store.criarEm('revisoes', {
          pratica: codigo,
          data: d.data || hoje(),
          periodo: (d.periodo || '').trim(),
          eficiencia: d.eficiencia || '',
          eficacia: d.eficacia || '',
          efetividade: d.efetividade || '',
          necessita_ajustes: !!d.necessita_ajustes,
          observacoes: d.observacoes || ''
        });
        avisar('Revisão crítica salva.');
        renderizar();
      });
    }

    var formPlano = doc.getElementById('form-plano');
    if (formPlano) {
      formPlano.addEventListener('submit', function (ev) {
        ev.preventDefault();
        var d = dadosDoForm(formPlano);
        if (!d.descricao || !d.descricao.trim()) return;
        Store.criarEm('planos', {
          pratica: codigo,
          descricao: d.descricao.trim(),
          responsavel: (d.responsavel || '').trim(),
          prazo: d.prazo || '',
          situacao: d.situacao || 'aberto'
        });
        avisar('Plano de ação salvo.');
        renderizar();
      });
    }

    ligarRemocoes();
  };

  function ligarRemocoes() {
    var mapa = [
      ['data-remover-evidencia', 'evidencias', 'Remover esta evidência?'],
      ['data-remover-medicao', 'medicoes', 'Remover esta medição?'],
      ['data-remover-revisao', 'revisoes', 'Remover esta revisão crítica?'],
      ['data-remover-plano', 'planos', 'Remover este plano de ação?']
    ];
    mapa.forEach(function (cfg) {
      Array.prototype.forEach.call(
        doc.querySelectorAll('[' + cfg[0] + ']'),
        function (botao) {
          botao.addEventListener('click', function () {
            if (!global.confirm(cfg[2])) return;
            Store.removerEm(cfg[1], botao.getAttribute(cfg[0]));
            avisar('Registro removido.');
            renderizar();
          });
        }
      );
    });
  }

  /* -------------------------------------------------------- empreendimentos */

  // Filtro da lista por situação no parque. Vazio = mostra todos.
  var filtroEmpreendimentos = { situacao: '' };

  Telas.empreendimentos = function () {
    var lista = Store.estado().empreendimentos;
    var somenteLeitura = !Store.podeEditar();

    var filtrados = lista.filter(function (e) {
      return !filtroEmpreendimentos.situacao || e.situacao === filtroEmpreendimentos.situacao;
    });

    var linhas = filtrados.map(function (e) {
      var notas = mediaEixos(e);
      var cor = corDaSituacao(e.situacao);
      return (
        '<tr>' +
        '<td class="pequeno">' + esc(e.codigo || '—') + '</td>' +
        '<td><a href="#/empreendimento/' + encodeURIComponent(e.id) + '" class="negrito">' +
        esc(e.nome) + '</a><br><span class="pequeno suave">' + esc(e.setor || '—') +
        (e.programa ? ' · ' + esc(e.programa) : '') + '</span></td>' +
        '<td class="pequeno">' + esc(e.local || '—') + '</td>' +
        '<td>' + esc(Store.rotuloDe(Store.ESTAGIOS, e.estagio)) + '</td>' +
        '<td><span class="etiqueta ' + cor + '">' +
        esc(Store.rotuloDe(Store.SITUACOES_EMPREENDIMENTO, e.situacao)) + '</span></td>' +
        '<td class="numero">' + (notas.media !== null ? notas.media.toFixed(1) : '—') + '</td>' +
        '<td>' + dataBR(e.data_entrada) + '</td>' +
        '</tr>'
      );
    }).join('');

    var situacoesFiltroEmp = [{ valor: '', rotulo: 'Todas as situações' }]
      .concat(Store.SITUACOES_EMPREENDIMENTO);

    var form = somenteLeitura ? '' :
      '<details class="bloco nao-imprimir"><summary>+ Cadastrar empreendimento</summary>' +
      '<form id="form-empreendimento">' +
      '<div class="linha-campos tres">' +
      '<div class="campo"><label>Nome</label><input type="text" name="nome" required></div>' +
      '<div class="campo"><label>Setor</label>' +
      '<input type="text" name="setor" placeholder="ex.: TIC, agro, saúde"></div>' +
      '<div class="campo"><label>Local onde está instalado</label>' +
      '<input type="text" name="local" placeholder="ex.: Prédio 2, sala 12"></div>' +
      '</div>' +
      '<div class="linha-campos tres">' +
      '<div class="campo"><label>Estágio do negócio</label>' +
      '<select name="estagio">' + opcoes(Store.ESTAGIOS, 'ideia') + '</select></div>' +
      '<div class="campo"><label>Situação no parque</label>' +
      '<select name="situacao">' + opcoes(Store.SITUACOES_EMPREENDIMENTO, 'apoiado') + '</select></div>' +
      '<div class="campo"><label>Data de entrada</label>' +
      '<input type="date" name="data_entrada" value="' + hoje() + '"></div>' +
      '</div>' +
      '<div class="linha-campos tres">' +
      '<div class="campo"><label>Programa de origem</label>' +
      '<input type="text" name="programa" placeholder="ex.: Projeto MUDA 2026/1"></div>' +
      '<div class="campo"><label>Responsável / contato</label><input type="text" name="responsavel"></div>' +
      '<div class="campo"><label>Descrição</label><input type="text" name="descricao"></div>' +
      '</div>' +
      '<p class="pequeno suave sem-margem">O código (IPE-0000) é gerado ' +
      'automaticamente ao cadastrar e pode ser ajustado no detalhe.</p>' +
      '<button type="submit" class="botao">Cadastrar</button>' +
      '</form></details>';

    var res = Store.resumo();

    return (
      '<h1>Empreendimentos</h1>' +
      '<p class="suave">Empreendimentos incubados, empresas residentes e graduados do ' +
      'parque, e a evolução deles nos cinco eixos do CERNE (empreendedor, tecnologia, ' +
      'capital, mercado e gestão).</p>' +

      avisoConsulta() +

      '<div class="grade grade-4">' +
      indicador('Cadastrados', res.empreendimentos) +
      indicador('Pré-incubados', res.pre_incubados) +
      indicador('Incubados', res.incubados) +
      indicador('Residentes', res.residentes) +
      indicador('Graduados', res.graduados) +
      '</div>' +

      '<div class="cartao nao-imprimir">' +
      '<div class="filtros">' +
      '<div class="campo sem-margem"><label for="f-emp-situacao">Situação no parque</label>' +
      '<select id="f-emp-situacao">' +
      opcoes(situacoesFiltroEmp, filtroEmpreendimentos.situacao) + '</select></div>' +
      '</div></div>' +

      '<div class="cartao">' + form +
      (linhas
        ? '<div class="tabela-rolagem"><table class="tabela"><thead><tr>' +
          '<th>Código</th><th>Empreendimento</th><th>Local</th><th>Estágio</th><th>Situação</th>' +
          '<th class="numero">Média eixos</th><th>Entrada</th>' +
          '</tr></thead><tbody>' + linhas + '</tbody></table></div>'
        : '<div class="vazio">' +
          (filtroEmpreendimentos.situacao && lista.length
            ? 'Nenhum empreendimento com essa situação.'
            : 'Nenhum empreendimento cadastrado ainda.') +
          '</div>') +
      '</div>'
    );
  };

  Telas.empreendimentos.ligar = function () {
    var fSit = doc.getElementById('f-emp-situacao');
    if (fSit) fSit.addEventListener('change', function () {
      filtroEmpreendimentos.situacao = fSit.value; renderizar();
    });

    var form = doc.getElementById('form-empreendimento');
    if (!form) return;
    form.addEventListener('submit', function (ev) {
      ev.preventDefault();
      var d = dadosDoForm(form);
      if (!d.nome || !d.nome.trim()) return;
      Store.criarEm('empreendimentos', {
        nome: d.nome.trim(),
        setor: (d.setor || '').trim(),
        local: (d.local || '').trim(),
        programa: (d.programa || '').trim(),
        estagio: d.estagio || 'ideia',
        situacao: d.situacao || 'apoiado',
        data_entrada: d.data_entrada || '',
        data_graduacao: '',
        responsavel: (d.responsavel || '').trim(),
        descricao: (d.descricao || '').trim(),
        avaliacoes: []
      });
      avisar('Empreendimento cadastrado.');
      renderizar();
    });
  };

  /** Está rodando no modo com login (dados compartilhados no Firestore)?
   *  Vários textos de ajuda mudam de sentido entre os dois modos — dizer
   *  "fica salvo neste navegador" para quem usa a nuvem seria mentira, e numa
   *  auditoria o manual não pode contradizer o sistema. */
  function naNuvem() {
    return !!(Store && Store.naNuvem);
  }

  /** Cor da etiqueta de situação. Fica numa função só para a lista e o
   *  detalhe não divergirem quando a lista de situações mudar. */
  function corDaSituacao(situacao) {
    if (situacao === 'graduado') return 'verde';
    if (situacao === 'residente') return 'amarela';
    if (situacao === 'pre_incubado') return 'roxa';
    if (situacao === 'desligado') return 'cinza';
    return 'azul';   // apoiado (incubado)
  }

  /** Vínculo opcional de uma evidência: a startup e/ou o programa a que ela se
   *  refere. Devolve texto já escapado, pronto para a linha de meta. Registros
   *  antigos (sem os campos) devolvem string vazia. */
  function vinculoEvidencia(e) {
    var partes = [];
    if (e && e.empreendimento) {
      var emp = Store.empreendimentoPorId && Store.empreendimentoPorId(e.empreendimento);
      partes.push('Startup: ' + (emp ? esc(emp.nome) : 'empreendimento removido'));
    }
    if (e && e.programa) partes.push('Programa: ' + esc(e.programa));
    return partes.join(' · ');
  }

  /** Ano de referência de uma evidência, para o filtro por ano. Usa a data de
   *  referência e, se faltar, tenta o ano embutido no protocolo (INB-AAAA-...). */
  function anoDaEvidencia(e) {
    var a = String((e && e.data_referencia) || '').slice(0, 4);
    if (/^\d{4}$/.test(a)) return a;
    var m = /^INB-(\d{4})-/i.exec(String((e && e.protocolo) || ''));
    return m ? m[1] : '';
  }

  /** Linha de formulário para vincular a evidência a um empreendimento e/ou
   *  programa. Os dois campos são opcionais; o dropdown lista as startups já
   *  cadastradas. Usada nos dois formulários de evidência da tela da prática. */
  function camposVinculoForm() {
    var emps = (Store.estado().empreendimentos) || [];
    var opcoesEmp = '<option value="">— nenhum —</option>' + emps.map(function (e) {
      return '<option value="' + esc(e.id) + '">' + esc(e.nome) +
        (e.codigo ? ' (' + esc(e.codigo) + ')' : '') + '</option>';
    }).join('');
    return (
      '<div class="linha-campos">' +
      '<div class="campo"><label>Vincular a empreendimento (opcional)</label>' +
      '<select name="empreendimento">' + opcoesEmp + '</select></div>' +
      '<div class="campo"><label>Programa (opcional)</label>' +
      '<input type="text" name="programa" placeholder="ex.: Projeto MUDA 2026/1"></div>' +
      '</div>'
    );
  }

  /** Última nota de cada eixo + média geral. */
  function mediaEixos(empreendimento) {
    var porEixo = {};
    (empreendimento.avaliacoes || []).forEach(function (a) {
      var atual = porEixo[a.eixo];
      if (!atual || String(a.data || '') >= String(atual.data || '')) porEixo[a.eixo] = a;
    });
    var notas = Store.EIXOS.map(function (e) {
      return porEixo[e.valor] ? Number(porEixo[e.valor].nota) : null;
    });
    var validas = notas.filter(function (n) { return n !== null && !isNaN(n); });
    var mapa = {};
    Store.EIXOS.forEach(function (e, i) { mapa[e.valor] = notas[i] === null ? 0 : notas[i]; });
    return {
      porEixo: mapa,
      media: validas.length
        ? validas.reduce(function (a, b) { return a + b; }, 0) / validas.length
        : null
    };
  }

  var empreendimentoAtual = null;

  Telas.empreendimento = function (id) {
    var e = Store.empreendimentoPorId(id);
    if (!e) {
      return '<div class="aviso erro">Empreendimento não encontrado. ' +
        '<a href="#/empreendimentos">Voltar à lista</a>.</div>';
    }
    empreendimentoAtual = id;
    var somenteLeitura = !Store.podeEditar();
    var notas = mediaEixos(e);

    var historico = (e.avaliacoes || [])
      .slice()
      .sort(function (a, b) { return String(b.data || '').localeCompare(String(a.data || '')); })
      .map(function (a) {
        return (
          '<tr><td>' + esc(Store.rotuloDe(Store.EIXOS, a.eixo)) + '</td>' +
          '<td class="numero">' + esc(a.nota) + '</td>' +
          '<td>' + dataBR(a.data) + '</td>' +
          '<td>' + esc(a.observacao || '') + '</td>' +
          (somenteLeitura ? '' :
            '<td class="numero nao-imprimir"><button type="button" class="botao secundario pequeno" ' +
            'data-remover-avaliacao="' + esc(a.id) + '">Remover</button></td>') +
          '</tr>'
        );
      }).join('');

    var formAvaliacao = somenteLeitura ? '' :
      '<form id="form-avaliacao" class="nao-imprimir" ' +
      'style="border-top:1px solid var(--cinza-200);margin-top:.7rem;padding-top:.8rem">' +
      '<p class="rotulo-secao">Registrar avaliação de eixo</p>' +
      '<div class="linha-campos tres">' +
      '<div class="campo"><label for="av-eixo">Eixo</label>' +
      '<select id="av-eixo" name="eixo">' + opcoes(Store.EIXOS, 'empreendedor') + '</select></div>' +
      '<div class="campo"><label for="av-nota">Nota (0 a 5)</label>' +
      '<input type="number" id="av-nota" name="nota" min="0" max="5" step="1" value="3" required></div>' +
      '<div class="campo"><label for="av-data">Data</label>' +
      '<input type="date" id="av-data" name="data" value="' + hoje() + '" required></div>' +
      '</div>' +
      '<div class="campo"><label for="av-obs">Observação</label>' +
      '<input type="text" id="av-obs" name="observacao"></div>' +
      '<button type="submit" class="botao">Salvar avaliação</button>' +
      '</form>';

    return (
      '<p class="trilha nao-imprimir"><a href="#/empreendimentos">Empreendimentos</a> › ' +
      esc(e.nome) + '</p>' +

      '<div class="cartao-titulo">' +
      '<div><h1>' + esc(e.nome) + '</h1>' +
      '<p class="suave sem-margem">' + esc(e.setor || 'setor não informado') + ' · ' +
      esc(Store.rotuloDe(Store.ESTAGIOS, e.estagio)) + '</p></div>' +
      '<span class="etiqueta ' + corDaSituacao(e.situacao) + '">' +
      esc(Store.rotuloDe(Store.SITUACOES_EMPREENDIMENTO, e.situacao)) + '</span>' +
      '</div>' +

      avisoConsulta() +

      '<div class="grade grade-radar">' +
      '<div class="cartao">' +
      '<p class="rotulo-secao">Evolução nos cinco eixos</p>' +
      Grafico.radarEixos(notas.porEixo) +
      '<p class="centro pequeno suave sem-margem">Média: <strong>' +
      (notas.media !== null ? notas.media.toFixed(1) : '—') + '</strong> de 5</p>' +
      '</div>' +
      '<div class="cartao">' +
      '<p class="rotulo-secao">Dados do empreendimento</p>' +
      '<ul class="lista pequeno">' +
      '<li><span class="suave">Código</span><span>' + esc(e.codigo || '—') + '</span></li>' +
      '<li><span class="suave">Programa de origem</span><span>' + esc(e.programa || '—') + '</span></li>' +
      '<li><span class="suave">Local</span><span>' + esc(e.local || '—') + '</span></li>' +
      '<li><span class="suave">Responsável</span><span>' + esc(e.responsavel || '—') + '</span></li>' +
      '<li><span class="suave">Entrada</span><span>' + dataBR(e.data_entrada) + '</span></li>' +
      '<li><span class="suave">Graduação</span><span>' + dataBR(e.data_graduacao) + '</span></li>' +
      '<li><span class="suave">Cadastrado em</span><span>' + dataHoraBR(e.criado_em) + '</span></li>' +
      '</ul>' +
      (e.descricao ? '<p class="pequeno">' + esc(e.descricao) + '</p>' : '') +
      (somenteLeitura ? '' :
        '<form id="form-dados-emp" class="nao-imprimir espaco-acima">' +
        '<div class="linha-campos">' +
        '<div class="campo"><label for="emp-codigo">Código</label>' +
        '<input type="text" id="emp-codigo" name="codigo" value="' + esc(e.codigo) + '" ' +
        'placeholder="IPE-0001"></div>' +
        '<div class="campo"><label for="emp-programa">Programa de origem</label>' +
        '<input type="text" id="emp-programa" name="programa" value="' + esc(e.programa) + '" ' +
        'placeholder="ex.: Projeto MUDA 2026/1"></div>' +
        '</div>' +
        '<div class="campo"><label for="emp-local">Local onde está instalado</label>' +
        '<input type="text" id="emp-local" name="local" value="' + esc(e.local) + '" ' +
        'placeholder="ex.: Prédio 2, sala 12"></div>' +
        '<div class="linha-campos">' +
        '<div class="campo"><label for="emp-estagio">Estágio do negócio</label>' +
        '<select id="emp-estagio" name="estagio">' +
        opcoes(Store.ESTAGIOS, e.estagio) + '</select></div>' +
        '<div class="campo"><label for="emp-situacao">Situação no parque</label>' +
        '<select id="emp-situacao" name="situacao">' +
        opcoes(Store.SITUACOES_EMPREENDIMENTO, e.situacao) + '</select></div>' +
        '</div>' +
        '<div class="acoes">' +
        '<button type="submit" class="botao secundario pequeno">Salvar alteração</button>' +
        '<button type="button" class="botao perigo pequeno" id="btn-excluir-emp">Excluir</button>' +
        '</div></form>') +
      '</div></div>' +

      '<div class="cartao">' +
      '<div class="cartao-titulo"><h2>Histórico de avaliações</h2></div>' +
      (historico
        ? '<div class="tabela-rolagem"><table class="tabela"><thead><tr>' +
          '<th>Eixo</th><th class="numero">Nota</th><th>Data</th><th>Observação</th>' +
          (somenteLeitura ? '' : '<th class="numero nao-imprimir">Ações</th>') +
          '</tr></thead><tbody>' + historico + '</tbody></table></div>'
        : '<p class="pequeno suave">Nenhuma avaliação registrada.</p>') +
      formAvaliacao +
      '</div>'
    );
  };

  Telas.empreendimento.ligar = function () {
    var id = empreendimentoAtual;
    var e = Store.empreendimentoPorId(id);
    if (!e) return;

    var form = doc.getElementById('form-avaliacao');
    if (form) {
      form.addEventListener('submit', function (ev) {
        ev.preventDefault();
        var d = dadosDoForm(form);
        var nota = Math.max(0, Math.min(5, Number(d.nota)));
        e.avaliacoes = e.avaliacoes || [];
        e.avaliacoes.push({
          id: Store.novoId(),
          eixo: d.eixo,
          nota: nota,
          data: d.data || hoje(),
          observacao: (d.observacao || '').trim()
        });
        Store.atualizarEm('empreendimentos', id, { avaliacoes: e.avaliacoes });
        avisar('Avaliação registrada.');
        renderizar();
      });
    }

    Array.prototype.forEach.call(
      doc.querySelectorAll('[data-remover-avaliacao]'),
      function (botao) {
        botao.addEventListener('click', function () {
          if (!global.confirm('Remover esta avaliação?')) return;
          var alvo = botao.getAttribute('data-remover-avaliacao');
          Store.atualizarEm('empreendimentos', id, {
            avaliacoes: (e.avaliacoes || []).filter(function (a) { return a.id !== alvo; })
          });
          avisar('Avaliação removida.');
          renderizar();
        });
      }
    );

    // Local, estágio e situação mudam ao longo da vida do empreendimento: a
    // empresa troca de sala, a incubada gradua, a graduada pode continuar no
    // parque como residente. Antes só existia o botão "marcar como graduado",
    // que não dava conta de quatro situações nem de mudança de espaço.
    var formDados = doc.getElementById('form-dados-emp');
    if (formDados) {
      formDados.addEventListener('submit', function (ev) {
        ev.preventDefault();
        var d = dadosDoForm(formDados);
        var nova = d.situacao || e.situacao;
        var mudancas = {
          codigo: (d.codigo || '').trim(),
          programa: (d.programa || '').trim(),
          local: (d.local || '').trim(),
          estagio: d.estagio || e.estagio,
          situacao: nova
        };

        // A data de graduação acompanha a situação: é preenchida ao graduar e
        // só é apagada se a graduação for desfeita (volta a ser incubada).
        // Quem gradua e segue como residente mantém a data — graduou mesmo.
        if (nova === 'graduado' && !e.data_graduacao) mudancas.data_graduacao = hoje();
        if (nova === 'apoiado') mudancas.data_graduacao = '';

        Store.atualizarEm('empreendimentos', id, mudancas);
        avisar('Empreendimento atualizado.');
        renderizar();
      });
    }

    var btnExcluir = doc.getElementById('btn-excluir-emp');
    if (btnExcluir) {
      btnExcluir.addEventListener('click', function () {
        if (!global.confirm('Excluir "' + e.nome + '" e todas as avaliações dele?')) return;
        Store.removerEm('empreendimentos', id);
        avisar('Empreendimento excluído.');
        ir('#/empreendimentos');
      });
    }
  };

  /* ----------------------------------------------------------------- dossiê */

  var nivelDossie = '';

  Telas.dossie = function () {
    var pront = Store.calcularProntidao();
    var mec = Store.mecanismo();

    var niveis = pront.niveis.filter(function (n) {
      return !nivelDossie || String(n.numero) === nivelDossie;
    });

    var corpo = niveis.map(function (n) {
      var processos = n.processos.map(function (p) {
        var praticas = p.praticas.map(function (info) {
          var pr = info.pratica;
          var evid = Store.evidenciasDaPratica(pr.codigo);
          var st = Store.statusDe(pr.codigo);

          var requisitos = (pr.requisitos || []).map(function (req) {
            var doReq = evid.filter(function (x) { return x.requisito === req.id; });
            var itens = doReq.map(function (x) {
              var link = urlSegura(x.link);
              var vinc = vinculoEvidencia(x);
              return (
                '<li><span style="flex:1;min-width:0">' +
                (x.protocolo ? '<strong>' + esc(x.protocolo) + '</strong> — ' : '') +
                esc(x.titulo) +
                '<span class="pequeno suave"> — ref. ' + dataBR(x.data_referencia) +
                (x.responsavel ? ' · ' + esc(x.responsavel) : '') +
                (x.descricao ? ' · ' + esc(x.descricao) : '') +
                (vinc ? ' · ' + vinc : '') + '</span>' +
                (link ? ' <a href="' + esc(link) + '" class="quebra">' + esc(link) + '</a>' : '') +
                '</span></li>'
              );
            }).join('');
            return (
              '<li><span style="flex:1;min-width:0">' +
              '<span class="marcador ' + (doReq.length ? 'ok' : 'pendente') + '" aria-hidden="true">' +
              (doReq.length ? '●' : '○') + '</span> ' + esc(req.descricao) +
              (req.obrigatorio ? '' : ' <span class="etiqueta cinza">opcional</span>') +
              (itens ? '<ul class="lista">' + itens + '</ul>' : '<br><span class="pequeno suave">sem evidência</span>') +
              '</span></li>'
            );
          }).join('');

          var metricas = (pr.metricas || []).map(function (met) {
            var med = Store.medicoesDaMetrica(met.id);
            var valores = med.length
              ? med.map(function (m) {
                  return numeroBR(m.valor) + (met.unidade ? ' ' + esc(met.unidade) : '') +
                    ' (' + dataBR(m.data) + ')';
                }).join('; ')
              : 'sem medição';
            return (
              '<li><span style="flex:1;min-width:0">' +
              '<span class="marcador ' + (med.length ? 'ok' : 'pendente') + '" aria-hidden="true">' +
              (med.length ? '●' : '○') + '</span> <strong>' + esc(met.nome) + '</strong>' +
              (met.meta ? ' <span class="pequeno suave">meta: ' + esc(met.meta) + '</span>' : '') +
              '<br><span class="pequeno">' + valores + '</span></span></li>'
            );
          }).join('');

          var revisoes = Store.revisoesDaPratica(pr.codigo).map(function (r) {
            return (
              '<li><span style="flex:1;min-width:0"><strong>' + dataBR(r.data) + '</strong>' +
              (r.periodo ? ' · ' + esc(r.periodo) : '') +
              '<br><span class="pequeno">Eficiência: ' + esc(r.eficiencia || '—') +
              ' | Eficácia: ' + esc(r.eficacia || '—') +
              ' | Efetividade: ' + esc(r.efetividade || '—') + '</span></span></li>'
            );
          }).join('');

          var planos = Store.planosDaPratica(pr.codigo).map(function (pl) {
            return (
              '<li><span style="flex:1;min-width:0">' + esc(pl.descricao) +
              '<span class="pequeno suave"> — ' +
              esc(Store.rotuloDe(Store.SITUACOES_PLANO, pl.situacao)) +
              (pl.prazo ? ', prazo ' + dataBR(pl.prazo) : '') + '</span></span></li>'
            );
          }).join('');

          return (
            '<div class="dossie-pratica">' +
            '<h4>' + esc(pr.codigo) + ' ' + esc(pr.nome) +
            (info.completa
              ? ' <span class="etiqueta verde">Completa</span>'
              : ' <span class="etiqueta amarela">Pendente</span>') +
            '</h4>' +
            '<p class="pequeno suave sem-margem">Situação: ' + esc(info.situacao_rotulo) +
            ' · ' + st.percentual + '% · ' +
            (st.atualizado_em ? 'atualizado em ' + dataHoraBR(st.atualizado_em) : 'sem atualização') +
            '</p>' +
            (st.observacoes ? '<p class="pequeno">' + esc(st.observacoes) + '</p>' : '') +
            (requisitos ? '<p class="rotulo-secao" style="margin-top:.6rem">Requisitos e evidências</p>' +
              '<ul class="lista">' + requisitos + '</ul>' : '') +

            /* Evidências próprias do parque. Sem este bloco elas ficariam
               invisíveis no dossiê, porque a listagem acima percorre os
               requisitos do modelo. Aparecem identificadas, para o auditor
               saber que são material adicional do parque. */
            (function () {
              var outras = evid.filter(function (x) { return !x.requisito; });
              if (!outras.length) return '';
              return (
                '<p class="rotulo-secao" style="margin-top:.6rem">' +
                'Outras evidências do parque</p>' +
                '<ul class="lista">' +
                outras.map(function (x) {
                  var l = urlSegura(x.link);
                  var a = x.arquivo && x.arquivo.url ? urlSegura(x.arquivo.url) : '';
                  var vinc = vinculoEvidencia(x);
                  return (
                    '<li><span style="flex:1;min-width:0">' +
                    (x.protocolo ? '<strong>' + esc(x.protocolo) + '</strong> — ' : '') +
                    '<strong>' + esc(x.titulo) + '</strong>' +
                    (x.refere_a
                      ? ' <span class="etiqueta cinza">' + esc(x.refere_a) + '</span>'
                      : '') +
                    '<span class="pequeno suave"> — ref. ' +
                    dataBR(x.data_referencia) +
                    (x.responsavel ? ' · ' + esc(x.responsavel) : '') +
                    (x.descricao ? ' · ' + esc(x.descricao) : '') +
                    (vinc ? ' · ' + vinc : '') +
                    '</span>' +
                    (a ? '<br><a href="' + esc(a) + '" class="quebra">' +
                      esc(x.arquivo.nome || 'arquivo') + '</a>' : '') +
                    (l ? '<br><a href="' + esc(l) + '" class="quebra">' + esc(l) + '</a>' : '') +
                    '</span></li>'
                  );
                }).join('') +
                '</ul>'
              );
            })() +
            (metricas ? '<p class="rotulo-secao" style="margin-top:.6rem">Métricas</p>' +
              '<ul class="lista">' + metricas + '</ul>' : '') +
            (revisoes ? '<p class="rotulo-secao" style="margin-top:.6rem">Revisões críticas</p>' +
              '<ul class="lista">' + revisoes + '</ul>' : '') +
            (planos ? '<p class="rotulo-secao" style="margin-top:.6rem">Planos de ação</p>' +
              '<ul class="lista">' + planos + '</ul>' : '') +
            (info.completa ? '' :
              '<div class="aviso atencao" style="margin:.6rem 0 0"><strong>Pendências:</strong>' +
              '<ul class="lista-faltas">' + info.faltas.map(function (f) {
                return '<li>' + esc(f) + '</li>';
              }).join('') + '</ul></div>') +
            '</div>'
          );
        }).join('');

        return (
          '<h3 style="margin-top:1rem">' + esc(p.codigo) + ' ' + esc(p.nome) +
          ' <span class="etiqueta ' + (p.percentual >= 100 ? 'verde' : p.percentual > 0 ? 'amarela' : 'cinza') +
          '">' + p.completas + '/' + p.total + '</span></h3>' + praticas
        );
      }).join('');

      return (
        '<div class="cartao quebra-pagina">' +
        '<div class="cartao-titulo">' +
        '<h2>CERNE ' + n.numero + ' — ' + esc(n.nome) + '</h2>' +
        '<span class="etiqueta ' + (n.percentual >= 100 ? 'verde' : n.percentual > 0 ? 'amarela' : 'cinza') +
        '">' + n.completas + ' de ' + n.total + ' completas (' + n.percentual + '%)</span>' +
        '</div>' + processos + '</div>'
      );
    }).join('');

    var niveisFiltro = [{ valor: '', rotulo: 'Todos os níveis' }].concat(
      Store.catalogo.niveis.map(function (n) {
        return { valor: String(n.numero), rotulo: 'Somente CERNE ' + n.numero };
      })
    );

    return (
      '<div class="cartao-titulo">' +
      '<div><h1>Dossiê de certificação</h1>' +
      '<p class="suave sem-margem">Documento consolidado para apresentar à auditoria.</p></div>' +
      '<div class="acoes nao-imprimir">' +
      '<select id="dossie-nivel" aria-label="Filtrar nível do dossiê" style="width:auto">' +
      opcoes(niveisFiltro, nivelDossie) + '</select>' +
      '<button type="button" class="botao" id="btn-imprimir">Imprimir / salvar PDF</button>' +
      '</div></div>' +

      '<div class="cartao">' +
      '<h2 class="sem-margem">' + esc(mec.nome) + '</h2>' +
      '<p class="suave">' +
      esc(mec.tipo || '') + (mec.cidade_uf ? ' · ' + esc(mec.cidade_uf) : '') +
      ' · ' + esc(Store.catalogo.versao.nome || '') + '</p>' +
      '<ul class="lista pequeno">' +
      '<li><span class="suave">Nível pelo qual está apto</span><span class="negrito">' +
      (pront.apto_nivel > 0 ? 'CERNE ' + pront.apto_nivel : 'ainda não apto ao CERNE 1') + '</span></li>' +
      '<li><span class="suave">Práticas completas</span><span>' +
      pront.total_completas + ' de ' + pront.total_praticas + '</span></li>' +
      '<li><span class="suave">Nível almejado</span><span>CERNE ' +
      esc(mec.nivel_almejado || '—') + '</span></li>' +
      '<li><span class="suave">Documento gerado em</span><span>' +
      dataHoraBR(new Date().toISOString()) + '</span></li>' +
      '</ul></div>' +

      corpo +

      '<p class="pequeno suave nao-imprimir">Dica: use “Imprimir / salvar PDF” e escolha ' +
      '“Salvar como PDF” no destino da impressão.</p>'
    );
  };

  Telas.dossie.ligar = function () {
    var sel = doc.getElementById('dossie-nivel');
    if (sel) sel.addEventListener('change', function () {
      nivelDossie = sel.value; renderizar();
    });
    var btn = doc.getElementById('btn-imprimir');
    if (btn) btn.addEventListener('click', function () { global.print(); });
  };

  /* ------------------------------------------------------------------ dados */

  Telas.dados = function () {
    var mec = Store.mecanismo();
    var est = Store.estado();
    var res = Store.resumo();
    var somenteLeitura = !Store.podeEditar();

    return (
      '<h1>Dados e backup</h1>' +

      (naNuvem()
        ? '<p class="suave">O acompanhamento fica salvo na nuvem do Google e é o mesmo para ' +
          'toda a equipe com acesso. Use o backup para guardar uma cópia fora do sistema.</p>'
        : '<p class="suave">O acompanhamento fica salvo neste navegador, neste computador. ' +
          'Use o backup para levar os dados para outra máquina ou guardar uma cópia.</p>') +

      avisoConsulta() +

      (naNuvem()
        ? '<div class="aviso info">' +
          '<strong>Dados compartilhados:</strong> o que você registra aparece para as outras ' +
          'pessoas com acesso, e o que elas registram aparece aqui, sem precisar recarregar a ' +
          'página. O backup serve como cópia fora do Google e como retrato do acompanhamento ' +
          'numa data — por exemplo, antes de uma auditoria.' +
          '</div>'
        : '<div class="aviso atencao">' +
          '<strong>Importante:</strong> como este é um site estático (sem servidor), os dados ' +
          'não são compartilhados automaticamente entre pessoas ou computadores. Exporte o ' +
          'backup com regularidade e guarde o arquivo em local seguro (rede do Parque, Drive, etc.).' +
          '</div>') +

      '<div class="cartao">' +
      '<div class="cartao-titulo"><h2>Identificação do mecanismo</h2></div>' +
      '<form id="form-mecanismo">' +
      '<div class="linha-campos">' +
      '<div class="campo"><label for="me-nome">Nome</label>' +
      '<input type="text" id="me-nome" name="nome" value="' + esc(mec.nome) + '" required' + trava() + '></div>' +
      '<div class="campo"><label for="me-tipo">Tipo</label>' +
      '<input type="text" id="me-tipo" name="tipo" value="' + esc(mec.tipo) + '" ' +
      'placeholder="parque tecnológico, incubadora..."' + trava() + '></div>' +
      '</div>' +
      '<div class="linha-campos">' +
      '<div class="campo"><label for="me-cidade">Cidade/UF</label>' +
      '<input type="text" id="me-cidade" name="cidade_uf" value="' + esc(mec.cidade_uf) + '"' + trava() + '></div>' +
      '<div class="campo"><label for="me-nivel">Nível CERNE almejado</label>' +
      '<input type="number" id="me-nivel" name="nivel_almejado" min="1" max="4" value="' +
      esc(mec.nivel_almejado) + '"' + trava() + '></div>' +
      '</div>' +
      '<div class="campo"><label for="me-desc">Descrição</label>' +
      '<textarea id="me-desc" name="descricao"' + trava() + '>' + esc(mec.descricao) + '</textarea></div>' +
      (somenteLeitura ? '' : '<button type="submit" class="botao">Salvar identificação</button>') +
      '</form></div>' +

      '<div class="cartao">' +
      '<div class="cartao-titulo"><h2>Backup</h2>' +
      '<span class="pequeno suave">' +
      // No modo nuvem não existe "última alteração" do conjunto: cada registro
      // tem a sua, e o espelho é atualizado de forma contínua. Mostrar a data
      // do documento do parque aqui daria a entender outra coisa.
      (naNuvem()
        ? 'salvo na nuvem'
        : (est.atualizado_em
          ? 'última alteração: ' + dataHoraBR(est.atualizado_em)
          : 'nada salvo ainda')) +
      '</span></div>' +
      '<ul class="lista pequeno">' +
      '<li><span class="suave">Práticas preenchidas</span><span>' +
      Object.keys(est.praticas).length + '</span></li>' +
      '<li><span class="suave">Evidências</span><span>' + res.evidencias + '</span></li>' +
      '<li><span class="suave">Medições</span><span>' + res.medicoes + '</span></li>' +
      '<li><span class="suave">Revisões críticas</span><span>' + res.revisoes + '</span></li>' +
      '<li><span class="suave">Empreendimentos</span><span>' + res.empreendimentos + '</span></li>' +
      '</ul>' +
      '<div class="acoes espaco-acima">' +
      '<button type="button" class="botao" id="btn-exportar">Exportar backup (.json)</button>' +
      // Importar substitui TODO o acompanhamento. No modo nuvem isso apagaria
      // o trabalho da equipe inteira, então a função não é oferecida lá.
      (somenteLeitura || !Store.importarObjeto ? '' :
        '<label class="botao secundario" for="arq-importar" style="cursor:pointer">' +
        'Importar backup' +
        '<input type="file" id="arq-importar" accept="application/json,.json" ' +
        'class="oculto-visual"></label>') +
      '</div>' +
      '</div>' +

      (somenteLeitura || !Store.carregarExemplo ? '' :
        '<div class="cartao">' +
        '<div class="cartao-titulo"><h2>Recomeçar</h2></div>' +
        '<p class="pequeno suave">“Carregar exemplo” substitui tudo por dados de demonstração, ' +
        'úteis para treinar a equipe. “Limpar tudo” apaga o acompanhamento e começa do zero. ' +
        'Nos dois casos, exporte um backup antes se quiser preservar o que existe hoje.</p>' +
        '<div class="acoes">' +
        '<button type="button" class="botao secundario" id="btn-exemplo">Carregar dados de exemplo</button>' +
        '<button type="button" class="botao perigo" id="btn-limpar">Limpar tudo</button>' +
        '</div></div>') +

      '<div class="cartao">' +
      '<div class="cartao-titulo"><h2>Catálogo CERNE carregado</h2></div>' +
      '<ul class="lista pequeno">' +
      '<li><span class="suave">Versão</span><span>' + esc(Store.catalogo.versao.nome || '—') + '</span></li>' +
      '<li><span class="suave">Níveis</span><span>' + Store.catalogo.niveis.length + '</span></li>' +
      '<li><span class="suave">Práticas-chave</span><span>' + Store.praticas.length + '</span></li>' +
      '</ul>' +
      '<p class="pequeno suave sem-margem">O catálogo vem do arquivo ' +
      '<code>js/dados-cerne.js</code> e é somente leitura. Para atualizá-lo, rode ' +
      '<code>python manage.py exportar_web</code> no projeto Django.</p>' +
      '</div>'
    );
  };

  Telas.dados.ligar = function () {
    var formMec = doc.getElementById('form-mecanismo');
    if (formMec) {
      formMec.addEventListener('submit', function (ev) {
        ev.preventDefault();
        var d = dadosDoForm(formMec);
        Store.salvarMecanismo({
          nome: (d.nome || '').trim() || 'Meu Parque Tecnológico',
          tipo: (d.tipo || '').trim(),
          cidade_uf: (d.cidade_uf || '').trim(),
          nivel_almejado: Number(d.nivel_almejado) || 1,
          descricao: d.descricao || ''
        });
        avisar('Identificação salva.');
        renderizar();
      });
    }

    var btnExportar = doc.getElementById('btn-exportar');
    if (btnExportar) {
      btnExportar.addEventListener('click', function () {
        Store.baixarBackup();
        avisar('Backup gerado.');
      });
    }

    var arq = doc.getElementById('arq-importar');
    if (arq) {
      arq.addEventListener('change', function () {
        var arquivo = arq.files && arq.files[0];
        if (!arquivo) return;
        var leitor = new FileReader();
        leitor.onload = function () {
          try {
            var obj = JSON.parse(String(leitor.result));
            if (!global.confirm(
              'Importar este backup? Todo o acompanhamento atual deste navegador será substituído.'
            )) { arq.value = ''; return; }
            Store.importarObjeto(obj);
            avisar('Backup importado.');
            renderizar();
          } catch (erro) {
            global.alert('Não foi possível ler o arquivo. Verifique se é um backup .json válido.');
          }
          arq.value = '';
        };
        leitor.readAsText(arquivo);
      });
    }

    var btnExemplo = doc.getElementById('btn-exemplo');
    if (btnExemplo) {
      btnExemplo.addEventListener('click', function () {
        if (!global.confirm(
          'Substituir o acompanhamento atual por dados de EXEMPLO? Isso apaga o que está preenchido.'
        )) return;
        Store.carregarExemplo();
        avisar('Dados de exemplo carregados.');
        ir('#/');
        renderizar();
      });
    }

    var btnLimpar = doc.getElementById('btn-limpar');
    if (btnLimpar) {
      btnLimpar.addEventListener('click', function () {
        if (!global.confirm('Apagar TODO o acompanhamento deste navegador? Esta ação não pode ser desfeita.')) return;
        if (!global.confirm('Confirma? Exporte um backup antes se quiser guardar os dados.')) return;
        Store.limpar();
        avisar('Dados apagados.');
        ir('#/');
        renderizar();
      });
    }
  };

  /* ---------------------------------------------------------------- pessoas */

  var pessoasCarregadas = null;   // cache da última leitura
  var pessoasCarregando = false;

  Telas.pessoas = function () {
    if (!Store.listarPessoas) {
      return (
        '<div class="aviso info">Esta tela existe apenas no modo com login. ' +
        'No modo local não há equipe: os dados ficam só neste navegador.</div>'
      );
    }
    if (!Store.ehGestor || !Store.ehGestor()) {
      return (
        '<h1>Equipe</h1>' +
        '<div class="aviso atencao">Apenas o gestor do parque pode ver e alterar ' +
        'quem tem acesso ao sistema.</div>'
      );
    }

    // A lista é buscada sob demanda; enquanto não chega, mostramos aviso.
    if (pessoasCarregadas === null) {
      if (!pessoasCarregando) {
        pessoasCarregando = true;
        Store.listarPessoas()
          .then(function (lista) {
            pessoasCarregadas = lista;
            pessoasCarregando = false;
            renderizar();
          })
          .catch(function (erro) {
            console.error(erro);
            pessoasCarregadas = [];
            pessoasCarregando = false;
            avisar('Não foi possível carregar a equipe.');
            renderizar();
          });
      }
      return '<h1>Equipe</h1><div class="aviso info">Carregando a equipe...</div>';
    }

    var meuEmail = '';
    var u = Store.usuario && Store.usuario();
    if (u && u.email) meuEmail = String(u.email).toLowerCase();

    var linhas = pessoasCarregadas.map(function (p) {
      var email = String(p.email || p.id || '').toLowerCase();
      var souEu = email === meuEmail;
      var cor = p.papel === 'gestor' ? 'verde'
        : p.papel === 'equipe' ? 'azul' : 'cinza';
      return (
        '<tr>' +
        '<td><strong class="quebra">' + esc(email) + '</strong>' +
        (souEu ? ' <span class="etiqueta cinza">você</span>' : '') +
        (p.nome ? '<br><span class="pequeno suave">' + esc(p.nome) + '</span>' : '') +
        '</td>' +
        '<td><span class="etiqueta ' + cor + '">' +
        esc(Store.rotuloDe(Store.PAPEIS || [], p.papel)) + '</span></td>' +
        '<td class="pequeno suave">' +
        (p.atualizado_em ? dataHoraBR(p.atualizado_em) : '—') + '</td>' +
        '<td style="text-align:right">' +
        (souEu
          ? '<span class="pequeno suave">—</span>'
          : '<button type="button" class="botao secundario pequeno" ' +
            'data-remover-pessoa="' + esc(email) + '">Remover acesso</button>') +
        '</td></tr>'
      );
    }).join('');

    return (
      '<h1>Equipe</h1>' +
      '<p class="suave">Quem pode entrar no sistema, e o que cada pessoa pode fazer.</p>' +

      '<div class="cartao">' +
      '<div class="cartao-titulo"><h2>Liberar acesso</h2></div>' +
      '<p class="pequeno suave">Informe o e-mail da <strong>conta Google</strong> da ' +
      'pessoa. Você pode liberar antes do primeiro acesso dela — quando ela entrar, ' +
      'já vai funcionar.</p>' +
      '<form id="form-pessoa">' +
      '<div class="linha-campos tres">' +
      '<div class="campo"><label for="p-email">E-mail da conta Google</label>' +
      '<input type="email" id="p-email" name="email" required ' +
      'placeholder="pessoa@gmail.com"></div>' +
      '<div class="campo"><label for="p-nome">Nome (opcional)</label>' +
      '<input type="text" id="p-nome" name="nome" placeholder="para você identificar"></div>' +
      '<div class="campo"><label for="p-papel">Pode fazer o quê</label>' +
      '<select id="p-papel" name="papel">' +
      opcoes(Store.PAPEIS || [], 'equipe') + '</select></div>' +
      '</div>' +
      '<button type="submit" class="botao">Liberar acesso</button>' +
      '</form>' +
      '</div>' +

      '<div class="cartao">' +
      '<div class="cartao-titulo"><h2>Com acesso hoje</h2>' +
      '<span class="pequeno suave">' + pessoasCarregadas.length + ' pessoa(s)</span></div>' +
      (linhas
        ? '<div class="tabela-rolagem"><table class="tabela"><thead><tr>' +
          '<th>E-mail</th><th>Papel</th><th>Atualizado</th><th></th>' +
          '</tr></thead><tbody>' + linhas + '</tbody></table></div>'
        : '<div class="vazio">Ninguém liberado ainda além de você.</div>') +
      '</div>' +

      (Store.simularPapel
        ? '<div class="cartao">' +
          '<div class="cartao-titulo"><h2>Ver o sistema como</h2></div>' +
          '<p class="pequeno suave">Para conferir o que a equipe e a auditoria enxergam, ' +
          'sem precisar de uma segunda conta. Vale só nesta aba: recarregar a página ' +
          'devolve o seu papel de gestor.</p>' +
          '<div class="acoes">' +
          '<button type="button" class="botao secundario" data-ver-como="equipe">' +
          'Ver como Equipe</button>' +
          '<button type="button" class="botao secundario" data-ver-como="consulta">' +
          'Ver como Consulta</button>' +
          '</div>' +
          '<p class="pequeno suave" style="margin:.8rem 0 0">' +
          '<strong>O que isto não faz:</strong> não reduz a sua permissão no servidor do ' +
          'Google. A tela passa a esconder o que aquele perfil não teria, e é isso que ' +
          'você está testando. Para conferir a permissão em si, entre com outra conta já ' +
          'liberada com aquele papel.</p>' +
          '</div>'
        : '') +

      '<div class="cartao">' +
      '<div class="rotulo-secao">O que cada papel pode fazer</div>' +
      '<table class="tabela"><tbody>' +
      '<tr><td><span class="etiqueta verde">Gestor</span></td>' +
      '<td>Tudo: registra, configura o parque e gerencia esta lista.</td></tr>' +
      '<tr><td><span class="etiqueta azul">Equipe</span></td>' +
      '<td>Registra ações, evidências, métricas e empreendimentos. ' +
      'É o papel do técnico.</td></tr>' +
      '<tr><td><span class="etiqueta cinza">Consulta</span></td>' +
      '<td>Só visualiza e gera o dossiê. Não altera nada.</td></tr>' +
      '</tbody></table>' +
      '<p class="pequeno suave" style="margin:.8rem 0 0">' +
      'Essas permissões são aplicadas no servidor do Google, não no navegador: ' +
      'quem tem perfil de consulta não consegue gravar nem alterando a página.' +
      '</p>' +
      '</div>'
    );
  };

  Telas.pessoas.ligar = function () {
    var form = doc.getElementById('form-pessoa');
    if (form) {
      form.addEventListener('submit', function (ev) {
        ev.preventDefault();
        var d = dadosDoForm(form);
        var botao = form.querySelector('button[type="submit"]');
        if (botao) { botao.disabled = true; botao.textContent = 'Liberando...'; }

        Store.salvarPessoa((d.email || '').trim(), {
          nome: (d.nome || '').trim(),
          papel: d.papel || 'equipe'
        })
          .then(function () {
            pessoasCarregadas = null;   // força recarregar a lista
            avisar('Acesso liberado para ' + (d.email || '').trim());
            renderizar();
          })
          .catch(function (erro) {
            console.error(erro);
            if (botao) { botao.disabled = false; botao.textContent = 'Liberar acesso'; }
            global.alert(
              String(erro && erro.code) === 'permission-denied'
                ? 'Sem permissão para alterar a equipe. Apenas o gestor pode.'
                : 'Não foi possível liberar o acesso:\n\n' + (erro && erro.message)
            );
          });
      });
    }

    Array.prototype.forEach.call(
      doc.querySelectorAll('[data-ver-como]'),
      function (botao) {
        botao.addEventListener('click', function () {
          var alvo = botao.getAttribute('data-ver-como');
          if (!Store.simularPapel(alvo)) {
            global.alert('Apenas o gestor pode usar o modo de teste.');
            return;
          }
          avisar('Vendo o sistema como ' +
            Store.rotuloDe(Store.PAPEIS, alvo) + '. A faixa no topo volta ao normal.');
          ir('#/');
          renderizar();
        });
      }
    );

    Array.prototype.forEach.call(
      doc.querySelectorAll('[data-remover-pessoa]'),
      function (botao) {
        botao.addEventListener('click', function () {
          var email = botao.getAttribute('data-remover-pessoa');
          if (!global.confirm(
            'Remover o acesso de ' + email + '?\n\n' +
            'A pessoa deixa de entrar no sistema. Os registros que ela já fez ' +
            'continuam no histórico.'
          )) return;

          Store.removerPessoa(email)
            .then(function () {
              pessoasCarregadas = null;
              avisar('Acesso removido.');
              renderizar();
            })
            .catch(function (erro) {
              console.error(erro);
              global.alert('Não foi possível remover:\n\n' + (erro && erro.message));
            });
        });
      }
    );
  };

  /* ------------------------------------------------------------------- guia */

  Telas.guia = function () {
    return (
      '<h1>Guia de uso</h1>' +
      '<p class="suave">Passo a passo para quem vai preencher e para quem vai administrar.</p>' +

      '<div class="cartao">' +
      '<h2>Em resumo</h2>' +
      '<p>O CERNE avalia a <strong>capacidade do mecanismo de gerar empreendimentos ' +
      'inovadores bem-sucedidos</strong>. Ele é organizado em 4 níveis acumulativos: para ' +
      'pedir o CERNE 2, todas as práticas do CERNE 1 <em>e</em> do 2 precisam estar prontas.</p>' +
      '<p class="sem-margem">Neste sistema, uma prática só conta como <strong>completa</strong> quando:</p>' +
      '<ol>' +
      '<li>está marcada como <strong>Implantada</strong>;</li>' +
      '<li>todos os <strong>requisitos de evidência obrigatórios</strong> têm pelo menos uma evidência;</li>' +
      '<li>todas as <strong>métricas obrigatórias</strong> têm pelo menos uma medição.</li>' +
      '</ol>' +
      '</div>' +

      '<div class="cartao">' +
      '<h2>Para quem preenche</h2>' +
      '<ol>' +
      '<li>Abra <a href="#/catalogo">Práticas</a> e escolha uma prática. Use o filtro ' +
      '“Com pendências” para focar no que falta.</li>' +
      '<li>Leia o <strong>objetivo</strong> e o bloco <strong>Como preencher</strong>.</li>' +
      '<li>Ajuste a <strong>situação</strong> e salve.</li>' +
      '<li>Em <strong>Evidências por requisito</strong>, registre uma evidência para cada ' +
      'requisito obrigatório. Informe onde o arquivo está (link ou caminho da pasta).</li>' +
      '<li>Em <strong>Métricas</strong>, lance o valor medido e a data.</li>' +
      '<li>Periodicamente, registre uma <strong>revisão crítica</strong> (eficiência, eficácia, ' +
      'efetividade) e abra <strong>planos de ação</strong> para o que precisa melhorar.</li>' +
      '</ol>' +
      (naNuvem()
        ? '<p class="sem-margem"><strong>Sobre arquivos:</strong> você pode anexar o arquivo ' +
          'da evidência direto no sistema. Ele vai para o armazenamento do parque na nuvem, ' +
          'organizado por nível, prática e ano, e fica disponível para quem tem acesso. ' +
          'Se o documento já estiver no Drive ou na rede do Parque, basta informar o link.</p>'
        : '<p class="sem-margem"><strong>Sobre arquivos:</strong> este sistema guarda o ' +
          '<em>registro</em> da evidência (título, data, responsável e onde encontrá-la), não o ' +
          'arquivo em si. Mantenha os arquivos numa pasta organizada por código de prática e ' +
          'aponte o caminho ou link aqui.</p>') +
      '</div>' +

      '<div class="cartao">' +
      '<h2>Para quem administra</h2>' +
      '<ul>' +
      (naNuvem()
        ? '<li><strong>Quem tem acesso:</strong> em <a href="#/pessoas">Equipe</a> você libera ' +
          'o e-mail da conta Google de cada pessoa e escolhe o que ela pode fazer (gestor, ' +
          'equipe ou consulta). O papel vem do servidor: ninguém muda o próprio nível de ' +
          'acesso pela página.</li>'
        : '<li><strong>Perfil no topo da página:</strong> <em>Gestor</em> edita, <em>Consulta</em> ' +
          'apenas visualiza. Útil para apresentar em reunião sem risco de alterar algo. ' +
          'Não é uma senha: é uma proteção contra engano, não contra acesso.</li>') +
      '<li><strong>Identificação do parque:</strong> em <a href="#/dados">Dados e backup</a>.</li>' +
      (naNuvem()
        ? '<li><strong>Backup:</strong> exporte o .json de vez em quando. Os dados já estão ' +
          'guardados na nuvem; o backup é a sua cópia fora do Google e o retrato do ' +
          'acompanhamento numa data.</li>'
        : '<li><strong>Backup:</strong> exporte o .json com regularidade. É assim que se leva o ' +
          'acompanhamento de um computador para outro, e é a sua cópia de segurança.</li>' +
          '<li><strong>Treinamento:</strong> “Carregar dados de exemplo” preenche o nível 1 quase ' +
          'todo, para a equipe ver o sistema funcionando antes de usar de verdade.</li>') +
      '<li><strong>Dossiê:</strong> em <a href="#/dossie">Dossiê</a>, filtre o nível e use ' +
      '“Imprimir / salvar PDF” para gerar o documento da auditoria.</li>' +
      '</ul>' +
      '</div>' +

      '<div class="cartao">' +
      '<h2>Onde os dados ficam</h2>' +
      (naNuvem()
        ? '<p>Os registros ficam no <strong>Firestore</strong> e os anexos no ' +
          '<strong>Storage</strong>, serviços do Google Cloud, em servidores de São Paulo. ' +
          'Consequências práticas:</p>' +
          '<ul>' +
          '<li>Toda a equipe vê o mesmo acompanhamento, atualizado na hora.</li>' +
          '<li>Trocar de computador ou de navegador não muda nada: entre com a mesma conta ' +
          'Google e o acompanhamento está lá.</li>' +
          '<li>Limpar os dados de navegação não apaga o acompanhamento — só desconecta você.</li>' +
          '<li>Com internet instável o sistema continua usável, porque guarda uma cópia local ' +
          'do que já foi carregado. Para gravar e para anexar arquivo, é preciso conexão.</li>' +
          '<li>Quem pode entrar e o que cada um pode fazer se define em ' +
          '<a href="#/pessoas">Equipe</a>, e é o servidor do Google que aplica a regra: ' +
          'alterar o site no navegador não dá acesso a nada.</li>' +
          '</ul>' +
          '<p class="sem-margem">Mesmo assim, exporte o backup em .json de vez em quando. ' +
          'É a sua cópia fora do Google.</p>'
        : '<p>Tudo é salvo no <strong>armazenamento local do navegador</strong> (localStorage), ' +
          'no computador em que você está. Consequências práticas:</p>' +
          '<ul>' +
          '<li>Funciona sem internet e sem servidor.</li>' +
          '<li>Cada computador (e cada navegador) tem seus próprios dados.</li>' +
          '<li>Limpar os dados de navegação do site apaga o acompanhamento. ' +
          '<strong>Tenha backup.</strong></li>' +
          '<li>Não use a janela anônima/privada para trabalhar: ela esquece tudo ao fechar.</li>' +
          '</ul>' +
          '<p class="sem-margem">Se o Parque precisar que várias pessoas registrem ao mesmo ' +
          'tempo, com login por pessoa, use a versão com login deste mesmo sistema: é o ' +
          '<code>index.html</code>, que guarda os dados na nuvem do Google. As duas versões ' +
          'compartilham o mesmo catálogo CERNE e as mesmas telas.</p>') +
      '</div>' +

      '<div class="cartao">' +
      '<h2>Os cinco eixos dos empreendimentos</h2>' +
      '<p>Em <a href="#/empreendimentos">Empreendimentos</a>, cada negócio apoiado é avaliado ' +
      'de 0 a 5 em cinco eixos, e o radar mostra o equilíbrio entre eles:</p>' +
      '<ul class="sem-margem">' +
      '<li><strong>Empreendedor</strong> — capacidade da equipe fundadora.</li>' +
      '<li><strong>Tecnologia</strong> — maturidade da solução.</li>' +
      '<li><strong>Capital</strong> — acesso a recursos financeiros.</li>' +
      '<li><strong>Mercado</strong> — validação e tração comercial.</li>' +
      '<li><strong>Gestão</strong> — organização e processos internos.</li>' +
      '</ul>' +
      '</div>'
    );
  };

  /* ============================================================== roteador */

  var MENU = [
    { hash: '#/', rotulo: 'Painel', icone: '◈' },
    { hash: '#/catalogo', rotulo: 'Práticas', icone: '☰' },
    { hash: '#/empreendimentos', rotulo: 'Empreendimentos', icone: '◉' },
    { hash: '#/dossie', rotulo: 'Dossiê', icone: '▤' },
    { grupo: 'Configuração' },
    { hash: '#/pessoas', rotulo: 'Equipe', icone: '◎', soGestorNaNuvem: true },
    { hash: '#/dados', rotulo: 'Dados e backup', icone: '⇅' },
    { hash: '#/guia', rotulo: 'Guia de uso', icone: '?' }
  ];

  /** A tela de equipe só faz sentido no modo com login, e só para o gestor.
   *  Isto é conveniência de navegação: quem manda de verdade são as regras
   *  do Firestore, no servidor do Google. */
  function itemDoMenuVisivel(item) {
    if (!item.soGestorNaNuvem) return true;
    return !!(Store && Store.listarPessoas && Store.ehGestor && Store.ehGestor());
  }

  function rotaAtual() {
    var hash = global.location.hash || '#/';
    var partes = hash.replace(/^#\/?/, '').split('/');
    return {
      nome: partes[0] || 'dashboard',
      parametro: partes[1] ? decodeURIComponent(partes[1]) : null
    };
  }

  function renderizarMenu(nomeRota) {
    var atalhos = { '': 'dashboard', 'catalogo': 'catalogo', 'pratica': 'catalogo',
      'empreendimentos': 'empreendimentos', 'empreendimento': 'empreendimentos',
      'dossie': 'dossie', 'dados': 'dados', 'guia': 'guia' };
    var ativo = atalhos[nomeRota] || nomeRota;

    var html = MENU.filter(itemDoMenuVisivel).map(function (item) {
      if (item.grupo) {
        return '<hr><div class="titulo-grupo">' + esc(item.grupo) + '</div>';
      }
      var alvo = item.hash.replace(/^#\/?/, '') || 'dashboard';
      var atual = alvo === ativo ? ' aria-current="page"' : '';
      return (
        '<a href="' + item.hash + '"' + atual + '>' +
        '<span class="icone" aria-hidden="true">' + item.icone + '</span>' +
        esc(item.rotulo) + '</a>'
      );
    }).join('');

    var menu = doc.getElementById('menu');
    if (menu) menu.innerHTML = '<nav aria-label="Menu principal">' + html + '</nav>';
  }

  function renderizarTopo() {
    var mec = Store.mecanismo();
    var alvo = doc.getElementById('topo-parque');
    if (alvo) alvo.textContent = mec.nome;

    var gestor = Store.podeEditar();
    var bg = doc.getElementById('perfil-gestor');
    var bc = doc.getElementById('perfil-consulta');
    if (bg) bg.setAttribute('aria-pressed', gestor ? 'true' : 'false');
    if (bc) bc.setAttribute('aria-pressed', gestor ? 'false' : 'true');
  }

  function renderizar() {
    atualizarStore();

    var rota = rotaAtual();
    var alvo = doc.getElementById('conteudo');
    if (!alvo) return;

    // Pode acontecer no modo nuvem, se algo pedir desenho antes do login
    // terminar. Não é erro: é só esperar.
    if (!Store) {
      alvo.innerHTML =
        '<div class="aviso info">Carregando o acompanhamento...</div>';
      return;
    }

    var tela = Telas[rota.nome] || (rota.nome === 'dashboard' ? Telas.dashboard : null);

    if (!tela) {
      alvo.innerHTML =
        '<div class="aviso erro">Tela não encontrada. <a href="#/">Ir ao painel</a>.</div>';
      renderizarMenu(rota.nome);
      return;
    }

    try {
      alvo.innerHTML = faixaSimulacao() + tela(rota.parametro);
    } catch (erro) {
      console.error(erro);
      alvo.innerHTML =
        '<div class="aviso erro"><strong>Ocorreu um erro ao montar esta tela.</strong>' +
        '<p class="pequeno sem-margem">' + esc(erro && erro.message) + '</p></div>';
      return;
    }

    ligarFaixaSimulacao();
    if (typeof tela.ligar === 'function') tela.ligar();

    renderizarMenu(rota.nome);
    renderizarTopo();

    if (rota.nome !== 'catalogo') global.scrollTo(0, 0);

    var titulos = {
      dashboard: 'Painel', catalogo: 'Práticas', pratica: 'Prática',
      empreendimentos: 'Empreendimentos', empreendimento: 'Empreendimento',
      dossie: 'Dossiê', dados: 'Dados e backup', guia: 'Guia de uso',
      pessoas: 'Equipe'
    };
    doc.title = (titulos[rota.nome] || 'Acompanhamento') + ' · Acompanhamento CERNE';
  }

  /* ------------------------------------------------------------- inicialização */

  function iniciar() {
    atualizarStore();

    // Modo nuvem antes do login: sem Store não há o que montar. O nuvem.js
    // chama iniciar() de novo quando os dados chegarem.
    if (!Store) {
      renderizar();
      return;
    }

    if (!global.CERNE_CATALOGO) {
      doc.getElementById('conteudo').innerHTML =
        '<div class="aviso erro"><strong>Catálogo CERNE não carregado.</strong>' +
        '<p>O arquivo <code>js/dados-cerne.js</code> não foi encontrado. Confirme que a ' +
        'pasta <code>js/</code> está junto do <code>index.html</code>.</p></div>';
      return;
    }

    Store.carregar();

    var bg = doc.getElementById('perfil-gestor');
    var bc = doc.getElementById('perfil-consulta');
    if (bg) bg.addEventListener('click', function () {
      Store.definirPerfil('gestor'); avisar('Modo gestor: edição liberada.'); renderizar();
    });
    if (bc) bc.addEventListener('click', function () {
      Store.definirPerfil('consulta'); avisar('Modo consulta: somente leitura.'); renderizar();
    });

    global.addEventListener('hashchange', renderizar);

    renderizar();

    if (Store.falhaPersistencia()) {
      avisar(naNuvem()
        ? 'Atenção: não foi possível salvar na nuvem. Verifique a conexão.'
        : 'Atenção: não foi possível salvar neste navegador.');
    }
  }

  global.AppCerne = { renderizar: renderizar, avisar: avisar, iniciar: iniciar };

  // No modo nuvem, quem dá a partida é o nuvem.js — depois do login e da
  // primeira carga dos dados. Iniciar antes disso mostraria a tela vazia.
  // No modo local (localStorage) o app começa sozinho, como sempre.
  if (!global.CERNE_MODO_NUVEM) {
    if (doc.readyState === 'loading') {
      doc.addEventListener('DOMContentLoaded', iniciar);
    } else {
      iniciar();
    }
  }
})(window);
