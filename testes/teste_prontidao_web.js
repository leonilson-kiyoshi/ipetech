/* Confere se a regra de prontidão da versão web (docs/js/store.js) é a mesma
   regra do sistema Django (acompanhamento/services.py):

     prática completa = situação 'implantada'
                        + todo requisito OBRIGATÓRIO com >= 1 evidência
                        + toda métrica OBRIGATÓRIA com >= 1 medição
     apto ao nível N  = níveis 1..N com 100% das práticas completas

   Rodar da raiz do projeto:  node testes/teste_prontidao_web.js
*/
const fs = require('fs');
const path = require('path');

const RAIZ_WEB = path.join(__dirname, '..', 'docs');

function carregarNoFalsoNavegador() {
  const memoria = {};
  const janela = {
    localStorage: {
      getItem: (k) => (k in memoria ? memoria[k] : null),
      setItem: (k, v) => { memoria[k] = String(v); },
      removeItem: (k) => { delete memoria[k]; }
    }
  };
  for (const arquivo of ['js/dados-cerne.js', 'js/regras.js', 'js/store.js']) {
    const codigo = fs.readFileSync(path.join(RAIZ_WEB, arquivo), 'utf8');
    new Function('window', 'globalThis', codigo)(janela, janela);
  }
  return janela;
}

let falhas = 0;
function verificar(descricao, condicao, extra) {
  if (condicao) {
    console.log('  ok   ' + descricao);
  } else {
    falhas++;
    console.log('  FALHA ' + descricao + (extra ? '  -> ' + extra : ''));
  }
}

const janela = carregarNoFalsoNavegador();
const Store = janela.Store;
Store.carregar();

console.log('\n1) Estado vazio');
let p = Store.calcularProntidao();
verificar('não apto a nenhum nível', p.apto_nivel === 0, 'apto=' + p.apto_nivel);
verificar('próximo nível é 1', p.proximo_nivel === 1, 'proximo=' + p.proximo_nivel);
verificar('nenhuma prática completa', p.total_completas === 0, 'completas=' + p.total_completas);
verificar('total de práticas é 29', p.total_praticas === 29, 'total=' + p.total_praticas);
verificar('há pendências listadas', p.pendencias_proximo.length > 0);

console.log('\n2) Só marcar como implantada NÃO basta (faltam evidências/métricas)');
const nivel1 = Store.catalogo.niveis.find((n) => n.numero === 1);
const praticasN1 = [];
nivel1.processos.forEach((pr) => pr.praticas.forEach((x) => praticasN1.push(x)));
praticasN1.forEach((pratica) => {
  Store.salvarStatus(pratica.codigo, { situacao: 'implantada', percentual: 100 });
});
p = Store.calcularProntidao();
verificar('ainda não apto ao nível 1', p.apto_nivel === 0, 'apto=' + p.apto_nivel);

console.log('\n3) Completar evidências obrigatórias + métricas obrigatórias do nível 1');
praticasN1.forEach((pratica) => {
  pratica.requisitos.filter((r) => r.obrigatorio).forEach((req) => {
    Store.criarEm('evidencias', {
      pratica: pratica.codigo, requisito: req.id, titulo: 'ev', link: '',
      descricao: '', data_referencia: '2026-01-10', responsavel: 'teste'
    });
  });
  pratica.metricas.filter((m) => m.obrigatoria).forEach((met) => {
    Store.criarEm('medicoes', {
      pratica: pratica.codigo, metrica: met.id, valor: 10,
      data: '2026-01-10', observacao: ''
    });
  });
});
p = Store.calcularProntidao();
const infoN1 = p.niveis.find((n) => n.numero === 1);
verificar('nível 1 em 100%', infoN1.percentual === 100, 'pct=' + infoN1.percentual);
verificar('apto ao CERNE 1', p.apto_nivel === 1, 'apto=' + p.apto_nivel);
verificar('próximo nível é 2', p.proximo_nivel === 2, 'proximo=' + p.proximo_nivel);

console.log('\n4) Regra acumulativa: nível 2 incompleto impede apto=2');
verificar('não é apto ao 2', p.apto_nivel < 2, 'apto=' + p.apto_nivel);

console.log('\n5) Remover UMA medição obrigatória derruba a prontidão');
const praticaComMetrica = praticasN1.find((x) => x.metricas.some((m) => m.obrigatoria));
const metricaAlvo = praticaComMetrica.metricas.find((m) => m.obrigatoria);
const medicao = Store.medicoesDaMetrica(metricaAlvo.id)[0];
Store.removerEm('medicoes', medicao.id);
p = Store.calcularProntidao();
verificar('volta a não ser apto ao 1', p.apto_nivel === 0, 'apto=' + p.apto_nivel);
const faltas = Store.faltasDaPratica(praticaComMetrica);
verificar('a falta aponta a métrica', faltas.some((f) => f.indexOf(metricaAlvo.nome) !== -1),
  JSON.stringify(faltas));

console.log('\n6) Requisito OPCIONAL não bloqueia');
const praticaOpcional = Store.praticas
  .map((i) => i.pratica)
  .find((x) => x.requisitos.some((r) => !r.obrigatorio));
if (praticaOpcional) {
  const opcional = praticaOpcional.requisitos.find((r) => !r.obrigatorio);
  const f = Store.faltasDaPratica(praticaOpcional);
  verificar('falta não cita requisito opcional',
    !f.some((t) => t.indexOf(opcional.descricao) !== -1));
} else {
  console.log('  (catálogo não tem requisito opcional — nada a testar)');
}

console.log('\n7) Backup: exportar e importar de volta');
Store.carregarExemplo();
const antes = Store.calcularProntidao();
const copia = JSON.parse(JSON.stringify(Store.exportarObjeto()));
const nEvidenciasAntes = Store.estado().evidencias.length;
Store.limpar();
verificar('após limpar, não há evidências', Store.estado().evidencias.length === 0);
Store.importarObjeto(copia);
const depois = Store.calcularProntidao();
verificar('evidências restauradas',
  Store.estado().evidencias.length === nEvidenciasAntes,
  Store.estado().evidencias.length + ' vs ' + nEvidenciasAntes);
verificar('prontidão idêntica após restaurar',
  depois.total_completas === antes.total_completas,
  depois.total_completas + ' vs ' + antes.total_completas);

console.log('\n8) Dados de exemplo: nível 1 completo e nível 2 em andamento');
Store.carregarExemplo();
p = Store.calcularProntidao();
verificar('exemplo tem práticas completas', p.total_completas > 0, 'completas=' + p.total_completas);
verificar('exemplo fica apto ao CERNE 1', p.apto_nivel === 1, 'apto=' + p.apto_nivel);
verificar('nível 1 em 100%',
  p.niveis.find((n) => n.numero === 1).percentual === 100);
verificar('nível 2 começado mas incompleto', (() => {
  const n2 = p.niveis.find((n) => n.numero === 2);
  return n2.percentual > 0 && n2.percentual < 100;
})(), 'pct2=' + p.niveis.find((n) => n.numero === 2).percentual);
verificar('próximo nível é 2', p.proximo_nivel === 2, 'proximo=' + p.proximo_nivel);
verificar('exemplo deixa pendência para mostrar',
  p.pendencias_proximo.length > 0, 'pendencias=' + p.pendencias_proximo.length);
verificar('exemplo cadastra empreendimentos',
  Store.estado().empreendimentos.length === 3);

// O exemplo precisa cobrir os dois vínculos que o parque tem: empresa em
// incubação e empresa residente. Se o exemplo só tivesse incubadas, a
// contagem de residentes nunca apareceria para quem está conhecendo o sistema.
const resumoExemplo = Store.resumo();
verificar('exemplo conta incubados e residentes separadamente',
  resumoExemplo.incubados === 2 && resumoExemplo.residentes === 1,
  'incubados=' + resumoExemplo.incubados + ' residentes=' + resumoExemplo.residentes);

console.log('\n9) Importar lixo não quebra o estado');
Store.importarObjeto({ praticas: { 'inexistente.9.9': { situacao: 'implantada' } }, evidencias: 'nao-e-lista' });
p = Store.calcularProntidao();
verificar('prática fora do catálogo é ignorada',
  Object.keys(Store.estado().praticas).length === 0);
verificar('campo inválido virou lista vazia', Array.isArray(Store.estado().evidencias));
verificar('cálculo segue funcionando', p.total_praticas === 29);

console.log('\n10) Marcador de prática contínua NÃO muda a regra de prontidão');
Store.limpar();
// Uma prática do nível 1 com métrica obrigatória (logo, exigente).
const praticaCont = praticasN1.find((x) => x.metricas.some((m) => m.obrigatoria));
// Só marcar contínua, sem mais nada, não completa nada.
Store.salvarStatus(praticaCont.codigo, { continua: true });
let stCont = Store.statusDe(praticaCont.codigo);
verificar('marcar contínua grava o campo continua=true', stCont.continua === true);
verificar('contínua força percentual 100 no dado gravado', stCont.percentual === 100,
  'pct=' + stCont.percentual);
verificar('contínua sem implantada/evidências/métricas NÃO conta',
  Store.praticaCompleta(praticaCont) === false);
// Contínua + implantada, mas ainda sem evidências/métricas => incompleta.
Store.salvarStatus(praticaCont.codigo, { continua: true, situacao: 'implantada' });
verificar('contínua implantada sem evidências/métricas continua incompleta',
  Store.praticaCompleta(praticaCont) === false);
// Agora atende evidências obrigatórias + métricas obrigatórias.
praticaCont.requisitos.filter((r) => r.obrigatorio).forEach((req) => {
  Store.criarEm('evidencias', {
    pratica: praticaCont.codigo, requisito: req.id, titulo: 'ev', link: '',
    descricao: '', data_referencia: '2026-01-10', responsavel: 'teste'
  });
});
praticaCont.metricas.filter((m) => m.obrigatoria).forEach((met) => {
  Store.criarEm('medicoes', {
    pratica: praticaCont.codigo, metrica: met.id, valor: 10, data: '2026-01-10', observacao: ''
  });
});
verificar('contínua SÓ fica completa com implantada + evidências + métricas',
  Store.praticaCompleta(praticaCont) === true);
// A regra não mudou: contínua fora de "implantada" volta a não contar.
Store.salvarStatus(praticaCont.codigo, { continua: true, situacao: 'em_andamento' });
verificar('contínua em "em_andamento" não conta (regra inalterada)',
  Store.praticaCompleta(praticaCont) === false);

console.log('\n11) O estado "continua" sobrevive a backup/normalizar');
Store.limpar();
Store.salvarStatus('1.1.1', { continua: true, situacao: 'implantada' });
const copiaCont = JSON.parse(JSON.stringify(Store.exportarObjeto()));
Store.limpar();
verificar('após limpar, 1.1.1 deixa de ser contínua',
  Store.statusDe('1.1.1').continua === false);
Store.importarObjeto(copiaCont);
verificar('backup restaura continua=true', Store.statusDe('1.1.1').continua === true);
verificar('restaurado mantém percentual 100', Store.statusDe('1.1.1').percentual === 100);
// Dado antigo (sem o campo) => continua=false, funcionando normalmente.
Store.importarObjeto({ praticas: { '1.1.2': { situacao: 'implantada', percentual: 100 } } });
verificar('dado antigo sem o campo vira continua=false',
  Store.statusDe('1.1.2').continua === false);
verificar('dado antigo preserva a situação salva',
  Store.statusDe('1.1.2').situacao === 'implantada');

console.log('\n' + (falhas === 0 ? 'TODOS OS TESTES PASSARAM' : falhas + ' TESTE(S) FALHARAM'));
process.exit(falhas === 0 ? 0 : 1);
