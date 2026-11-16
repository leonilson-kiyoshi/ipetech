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

/* ---------------------------------------------------------------------------
   Edição de atividades e pendências documentais (melhoria)

   Lógica pura em regras.js. Tudo aqui é INFORMATIVO: nada disso pode mexer na
   regra de prontidão.
--------------------------------------------------------------------------- */
const Regras = janela.Regras;

/** Procura `undefined` em qualquer nível de um valor (Firestore o rejeita). */
function temUndefined(valor) {
  if (valor === undefined) return true;
  if (valor && typeof valor === 'object') {
    return Object.keys(valor).some((k) => temUndefined(valor[k]));
  }
  return false;
}

const atvBase = {
  id: 'atv1', tipo: 'evento', titulo: 'Palestra', local: 'Auditório',
  responsavel: 'Ana', pratica: '1.1.1', protocolo: 'ATV-2026-001',
  data_realizacao: '2026-03-10'
};
const estadoSemEv = { evidencias: [] };
const ev = (tipo, extra) => Object.assign(
  { id: 'e' + Math.random(), atividade: 'atv1', tipo_documento: tipo }, extra || {}
);

console.log('\n12) diferencasDeRegistro: só o que mudou, texto curto, sem undefined');
let dif = Regras.diferencasDeRegistro(
  { titulo: 'A', local: 'X', pratica: '1.1.1' },
  { titulo: 'B', local: 'X', pratica: '1.1.1' }
);
verificar('devolve só os campos que mudaram',
  dif.length === 1 && dif[0].campo === 'titulo' && dif[0].de === 'A' && dif[0].para === 'B',
  JSON.stringify(dif));
verificar('campo ausente trocado por vazio não é mudança',
  Regras.diferencasDeRegistro({}, { local: '' }).length === 0);
verificar('nada mudou => lista vazia',
  Regras.diferencasDeRegistro({ a: 1 }, { a: 1 }).length === 0);

dif = Regras.diferencasDeRegistro({ descricao: 'curta' }, { descricao: 'x'.repeat(300) });
verificar('trunca o texto em no máximo 80 caracteres',
  dif.length === 1 && dif[0].para.length <= 80 && dif[0].para.length > 0, dif[0].para.length);

dif = Regras.diferencasDeRegistro(
  { a: undefined, c: 'x', lista: [1, 2] },
  { a: 'novo', b: undefined, c: null, d: undefined, lista: [1, 2, 3] }
);
verificar('nunca devolve undefined (nem em de/para)',
  !temUndefined(dif) && dif.every((x) => typeof x.de === 'string' && typeof x.para === 'string'),
  JSON.stringify(dif));
verificar('campo undefined em "depois" é ignorado',
  !dif.some((x) => x.campo === 'b' || x.campo === 'd'));
verificar('null vira texto vazio', dif.some((x) => x.campo === 'c' && x.de === 'x' && x.para === ''));
verificar('listas viram "N item(ns)"',
  dif.some((x) => x.campo === 'lista' && x.de === '2 item(ns)' && x.para === '3 item(ns)'));

dif = Regras.diferencasDeRegistro({}, { obj: { a: 1, b: 2 } });
verificar('objetos viram resumo curto', dif[0].para === '2 campo(s)', JSON.stringify(dif));

dif = Regras.diferencasDeRegistro(
  { titulo: 'A' },
  { titulo: 'B', atualizado_em: 'x', atualizado_por: 'u', atualizado_por_nome: 'N', id: 'z' }
);
verificar('ignora campos atualizado_* e id',
  dif.length === 1 && dif[0].campo === 'titulo', JSON.stringify(dif));

const muitos = {};
const muitosAntes = {};
for (let i = 0; i < 30; i++) { muitos['c' + i] = 'novo' + i; muitosAntes['c' + i] = 'velho'; }
verificar('limita a 12 mudanças',
  Regras.diferencasDeRegistro(muitosAntes, muitos).length === 12);
verificar('respeita a lista de campos pedida',
  Regras.diferencasDeRegistro(
    { a: 1, b: 1 }, { a: 2, b: 2 }, ['b']
  ).map((x) => x.campo).join(',') === 'b');
verificar('aceita entradas nulas sem quebrar',
  Regras.diferencasDeRegistro(null, null).length === 0 &&
  Regras.diferencasDeRegistro(undefined, { a: 'x' }).length === 1);

console.log('\n13) prepararEdicaoAtividade: protocolo fixo e só campos alterados');
let ed = Regras.prepararEdicaoAtividade(atvBase, {
  titulo: 'Palestra', tipo: 'evento', data_realizacao: '2027-01-05', local: 'Auditório',
  responsavel: 'Ana', programa: '', pratica: '1.1.1', empreendimento: '',
  descricao: '', responsavel_pendencia: '', protocolo: 'ATV-2027-999'
});
verificar('só a data mudou => só a data vai nos dados',
  ed.mudou && Object.keys(ed.dados).join(',') === 'data_realizacao' &&
  ed.dados.data_realizacao === '2027-01-05', JSON.stringify(ed));
verificar('o protocolo nunca vai nos dados, mesmo mudando de ano',
  !('protocolo' in ed.dados));
ed = Regras.prepararEdicaoAtividade(atvBase, {
  titulo: ' Palestra ', tipo: 'evento', data_realizacao: '2026-03-10', local: 'Auditório',
  responsavel: 'Ana', programa: '', pratica: '1.1.1', empreendimento: '',
  descricao: '', responsavel_pendencia: ''
});
verificar('nada mudou => mudou=false e dados vazios',
  ed.mudou === false && Object.keys(ed.dados).length === 0 && ed.erro === '', JSON.stringify(ed));
ed = Regras.prepararEdicaoAtividade(atvBase, { titulo: '   ', local: 'Outro' });
verificar('título vazio é recusado', !!ed.erro && ed.mudou === false && !('local' in ed.dados));
ed = Regras.prepararEdicaoAtividade(atvBase, { titulo: 'Palestra', tipo: 'invalido' });
verificar('tipo inválido é ignorado (mantém o atual)', !('tipo' in ed.dados) && !ed.mudou);
ed = Regras.prepararEdicaoAtividade(atvBase, { titulo: 'Palestra', tipo: 'reuniao' });
verificar('tipo válido novo é aceito', ed.dados.tipo === 'reuniao');
ed = Regras.prepararEdicaoAtividade(atvBase, {
  titulo: 'Palestra', responsavel_pendencia: ' Bruno '
});
verificar('responsavel_pendencia é editável (e vem aparado)',
  ed.dados.responsavel_pendencia === 'Bruno');
verificar('os dados de edição nunca têm undefined',
  !temUndefined(Regras.prepararEdicaoAtividade({}, { titulo: 'x', local: undefined })));

console.log('\n14) situacaoDocumentalDaAtividade');
let sit = Regras.situacaoDocumentalDaAtividade(estadoSemEv, atvBase);
verificar('evento sem documentos => pendente com 3 faltantes',
  sit.situacao === 'pendente' && sit.faltantes.length === 3 &&
  sit.faltantes.join(',') === 'lista_presenca,registro_fotografico,relatorio', JSON.stringify(sit));
verificar('devolve os esperados e nenhum atendido/dispensado',
  sit.esperados.length === 3 && sit.atendidos.length === 0 &&
  sit.dispensados.length === 0 && sit.campos_faltando.length === 0);

sit = Regras.situacaoDocumentalDaAtividade(
  { evidencias: [ev('lista_presenca')] }, atvBase);
verificar('evidência com o tipo correto reduz os faltantes',
  sit.faltantes.length === 2 && sit.atendidos.join(',') === 'lista_presenca' &&
  sit.situacao === 'pendente', JSON.stringify(sit));

sit = Regras.situacaoDocumentalDaAtividade(
  { evidencias: [ev('')] }, atvBase);
verificar('evidência SEM tipo não satisfaz nenhum documento',
  sit.faltantes.length === 3 && sit.atendidos.length === 0);
sit = Regras.situacaoDocumentalDaAtividade(
  { evidencias: [{ id: 'e', atividade: 'atv1' }] }, atvBase);
verificar('evidência antiga (sem o campo tipo_documento) não satisfaz nada',
  sit.faltantes.length === 3);
sit = Regras.situacaoDocumentalDaAtividade(
  { evidencias: [ev('ata'), ev('outro')] }, atvBase);
verificar('tipo que não é esperado para a atividade não satisfaz',
  sit.faltantes.length === 3);
sit = Regras.situacaoDocumentalDaAtividade(
  { evidencias: [ev('lista_presenca', { atividade: 'outra-atv' })] }, atvBase);
verificar('evidência de outra atividade não conta', sit.faltantes.length === 3);

sit = Regras.situacaoDocumentalDaAtividade(estadoSemEv, Object.assign({}, atvBase, {
  docs_dispensados: [{ tipo: 'registro_fotografico', motivo: 'sem fotos', por_nome: '', em: 'x' }]
}));
verificar('dispensa remove o tipo da pendência',
  sit.faltantes.length === 2 && sit.faltantes.indexOf('registro_fotografico') === -1 &&
  sit.dispensados.join(',') === 'registro_fotografico' && sit.situacao === 'pendente',
  JSON.stringify(sit));

sit = Regras.situacaoDocumentalDaAtividade(
  { evidencias: [ev('lista_presenca'), ev('relatorio')] },
  Object.assign({}, atvBase, {
    docs_dispensados: [{ tipo: 'registro_fotografico', motivo: 'm' }]
  }));
verificar('tudo atendido ou dispensado => completa',
  sit.situacao === 'completa' && sit.faltantes.length === 0, JSON.stringify(sit));

sit = Regras.situacaoDocumentalDaAtividade(
  { evidencias: [ev('lista_presenca'), ev('registro_fotografico'), ev('relatorio')] },
  Object.assign({}, atvBase, { local: '  ' }));
verificar('sem faltantes mas com campo faltando => incompleta',
  sit.situacao === 'incompleta' && sit.campos_faltando.join(',') === 'local', JSON.stringify(sit));

sit = Regras.situacaoDocumentalDaAtividade(
  estadoSemEv, Object.assign({}, atvBase, { responsavel: '', pratica: '' }));
verificar('pendente prevalece mesmo faltando campos',
  sit.situacao === 'pendente' && sit.campos_faltando.join(',') === 'responsavel,pratica');

sit = Regras.situacaoDocumentalDaAtividade(
  estadoSemEv, Object.assign({}, atvBase, { tipo: 'outra' }));
verificar("tipo 'outra' sem campos faltando => completa",
  sit.situacao === 'completa' && sit.esperados.length === 0);
sit = Regras.situacaoDocumentalDaAtividade(
  estadoSemEv, Object.assign({}, atvBase, { tipo: 'outra', local: '' }));
verificar("tipo 'outra' só com campo faltando => incompleta", sit.situacao === 'incompleta');

sit = Regras.situacaoDocumentalDaAtividade(
  estadoSemEv, Object.assign({}, atvBase, { tipo: 'reuniao' }));
verificar('reunião espera ata e lista de presença',
  sit.faltantes.join(',') === 'ata,lista_presenca');
sit = Regras.situacaoDocumentalDaAtividade(
  estadoSemEv, Object.assign({}, atvBase, { tipo: 'capacitacao' }));
verificar('capacitação espera os mesmos 3 documentos do evento', sit.faltantes.length === 3);

let quebrou = null;
try {
  sit = Regras.situacaoDocumentalDaAtividade({}, { id: 'velha', titulo: 'Atividade antiga' });
  Regras.situacaoDocumentalDaAtividade(undefined, undefined);
  Regras.situacaoDocumentalDaAtividade({ evidencias: [null, {}] }, { tipo: 'constructor' });
  Regras.situacaoDocumentalDaAtividade(estadoSemEv, Object.assign({}, atvBase, { docs_dispensados: 'lixo' }));
} catch (e) { quebrou = e; }
verificar('atividade antiga/sem campos novos não quebra', quebrou === null, quebrou);
verificar('atividade antiga sem nada: incompleta pelos campos do cadastro',
  sit.situacao === 'incompleta' && sit.campos_faltando.length === 3 && sit.esperados.length === 0);

console.log('\n15) Dispensa: listas novas, sem undefined, sem duplicar');
let lst = Regras.comDispensa(atvBase, 'relatorio', '  sem relatório  ', undefined, '2026-04-01T00:00:00.000Z');
verificar('dispensa guarda tipo, motivo aparado, por_nome vazio e data',
  lst.length === 1 && lst[0].tipo === 'relatorio' && lst[0].motivo === 'sem relatório' &&
  lst[0].por_nome === '' && lst[0].em === '2026-04-01T00:00:00.000Z' && !temUndefined(lst));
verificar('a atividade original não é alterada', atvBase.docs_dispensados === undefined);
const comUma = Object.assign({}, atvBase, { docs_dispensados: lst });
lst = Regras.comDispensa(comUma, 'relatorio', 'novo motivo', 'Maria', '2026-05-01T00:00:00.000Z');
verificar('dispensar de novo o mesmo tipo troca a justificativa',
  lst.length === 1 && lst[0].motivo === 'novo motivo' && lst[0].por_nome === 'Maria');
lst = Regras.comDispensa(comUma, 'ata', 'outra', 'Maria');
verificar('tipos diferentes se acumulam', lst.length === 2);
verificar('desfazer remove só o tipo pedido',
  Regras.semDispensa(Object.assign({}, atvBase, { docs_dispensados: lst }), 'ata')
    .map((d) => d.tipo).join(',') === 'relatorio');
verificar('desfazer em atividade sem dispensas devolve lista vazia',
  Regras.semDispensa(atvBase, 'ata').length === 0);

console.log('\n16) Constantes e exposição no Store');
verificar('TIPOS_DOCUMENTO tem os 5 tipos, na ordem pedida',
  Regras.TIPOS_DOCUMENTO.map((t) => t.valor).join(',') ===
    'lista_presenca,registro_fotografico,relatorio,ata,outro');
verificar('rótulos dos tipos de documento',
  Regras.rotuloDe(Regras.TIPOS_DOCUMENTO, 'lista_presenca') === 'Lista de presença' &&
  Regras.rotuloDe(Regras.TIPOS_DOCUMENTO, 'registro_fotografico') === 'Registro fotográfico' &&
  Regras.rotuloDe(Regras.TIPOS_DOCUMENTO, 'relatorio') === 'Relatório' &&
  Regras.rotuloDe(Regras.TIPOS_DOCUMENTO, 'ata') === 'Ata' &&
  Regras.rotuloDe(Regras.TIPOS_DOCUMENTO, 'outro') === 'Outro');
verificar('documentos esperados por tipo de atividade',
  JSON.stringify(Regras.DOCUMENTOS_ESPERADOS_POR_TIPO_ATIVIDADE) === JSON.stringify({
    evento: ['lista_presenca', 'registro_fotografico', 'relatorio'],
    capacitacao: ['lista_presenca', 'registro_fotografico', 'relatorio'],
    reuniao: ['ata', 'lista_presenca'],
    outra: []
  }));
verificar('o Store expõe TIPOS_DOCUMENTO', Store.TIPOS_DOCUMENTO === Regras.TIPOS_DOCUMENTO);
verificar('rótulo amigável de campo conhecido e fallback para desconhecido',
  Regras.rotuloDoCampo('data_realizacao') === 'Data de realização' &&
  Regras.rotuloDoCampo('titulo') === 'Título' &&
  Regras.rotuloDoCampo('campo_inventado') === 'campo_inventado' &&
  Regras.rotuloDoCampo('constructor') === 'constructor');

console.log('\n17) Offline: atualizarEm de atividade registra atualizado_em e mantém o protocolo');
Store.limpar();
Store.criarEm('atividades', {
  tipo: 'evento', titulo: 'Oficina', data_realizacao: '2026-12-20',
  local: 'Sala', responsavel: 'Ana', pratica: ''
});
const atvOff = Store.estado().atividades[0];
const protocoloOriginal = atvOff.protocolo;
verificar('cadastro recebe protocolo do ano da data', /^ATV-2026-\d{3}$/.test(protocoloOriginal));
verificar('cadastro ainda não tem atualizado_em', atvOff.atualizado_em === undefined);
Store.atualizarEm('atividades', atvOff.id, { data_realizacao: '2027-01-10' });
const atvOff2 = Store.estado().atividades[0];
verificar('editar grava atualizado_em (ISO)',
  typeof atvOff2.atualizado_em === 'string' && !isNaN(Date.parse(atvOff2.atualizado_em)));
verificar('editar a data para outro ano NÃO recalcula o protocolo',
  atvOff2.protocolo === protocoloOriginal && atvOff2.data_realizacao === '2027-01-10');
verificar('o cadastro (criado_em) é preservado', !!atvOff2.criado_em);
Store.criarEm('medicoes', { pratica: '1.1.1', metrica: 'm', valor: 1, data: '2026-01-01' });
const med = Store.estado().medicoes[0];
Store.atualizarEm('medicoes', med.id, { valor: 2 });
verificar('outras coleções NÃO ganham atualizado_em',
  Store.estado().medicoes[0].atualizado_em === undefined);

console.log('\n18) Pendências de atividades NÃO mudam a prontidão');
Store.limpar();
const praticaP = praticasN1[0];
praticaP.requisitos.filter((r) => r.obrigatorio).forEach((req) => {
  Store.criarEm('evidencias', {
    pratica: praticaP.codigo, requisito: req.id, titulo: 'ev', data_referencia: '2026-01-10'
  });
});
const prontAntes = JSON.stringify(Store.calcularProntidao());
const faltasAntes = JSON.stringify(Store.faltasDaPratica(praticaP));
const resAntes = Store.resumo();
verificar('sem atividades, resumo traz atividades_pendentes = 0',
  resAntes.atividades_pendentes === 0);

Store.criarEm('atividades', { tipo: 'evento', titulo: 'Sem nada', responsavel: '', local: '' });
Store.criarEm('atividades', { tipo: 'outra', titulo: 'Incompleta', responsavel: 'A', local: '', pratica: '1.1.1' });
Store.criarEm('atividades', { tipo: 'outra', titulo: 'Completa', responsavel: 'A', local: 'L', pratica: '1.1.1' });
const idPend = Store.estado().atividades[0].id;
// Vincula uma evidência JÁ existente (que conta para a prontidão) à atividade e
// lhe dá um tipo: o número de evidências da prática não muda.
Store.atualizarEm('evidencias', Store.estado().evidencias[0].id, {
  atividade: idPend, tipo_documento: 'relatorio'
});
Store.atualizarEm('atividades', idPend, {
  docs_dispensados: Regras.comDispensa(Store.estado().atividades[0], 'registro_fotografico', 'm')
});
const prontDepois = JSON.stringify(Store.calcularProntidao());
verificar('calcularProntidao idêntico com atividades pendentes/dispensadas',
  prontAntes === prontDepois);
verificar('faltasDaPratica idêntico', faltasAntes === JSON.stringify(Store.faltasDaPratica(praticaP)));
const resDepois = Store.resumo();
verificar('resumo conta pendentes + incompletas (1 pendente, 1 incompleta)',
  resDepois.atividades_pendentes === 2 &&
  resDepois.atividades_com_documentos_faltando === 1 &&
  resDepois.atividades_incompletas === 1, JSON.stringify(resDepois));
verificar('indicadores existentes do resumo ficam iguais',
  ['evidencias', 'medicoes', 'revisoes', 'planos_abertos', 'empreendimentos',
   'pre_incubados', 'incubados', 'residentes', 'graduados'].every((k) =>
    resDepois[k] === resAntes[k]));
verificar('Store.situacaoDocumentalDaAtividade usa o estado atual',
  Store.situacaoDocumentalDaAtividade(Store.estado().atividades[0]).faltantes.join(',') === 'lista_presenca');
const fonteRegra = [Regras.faltasDaPratica, Regras.praticaCompleta, Regras.calcularProntidao]
  .map((f) => f.toString()).join('\n');
verificar('a regra de prontidão não menciona atividades nem tipo_documento',
  !/atividade|tipo_documento|docs_dispensados/i.test(fonteRegra));

console.log('\n19) anexosDoRegistro / caminhosDeAnexos: vários arquivos, registros antigos');

const anexoA = { url: 'https://x/a', nome: 'a.pdf', caminho: 'evidencias/CERNE1/1.1.1/2026/a.pdf', tamanho: 10, tipo: 'application/pdf' };
const anexoB = { url: 'https://x/b', nome: 'b.pdf', caminho: 'evidencias/CERNE1/1.1.1/2026/b.pdf', tamanho: 20, tipo: 'application/pdf' };

verificar('MAX_ARQUIVOS_POR_REGISTRO vale 10', Regras.MAX_ARQUIVOS_POR_REGISTRO === 10);
verificar('registro antigo (só `arquivo`) vira lista com 1 anexo',
  JSON.stringify(Regras.anexosDoRegistro({ arquivo: anexoA })) === JSON.stringify([anexoA]));
verificar('usa `arquivos` quando há itens, na ordem',
  Regras.anexosDoRegistro({ arquivos: [anexoA, anexoB], arquivo: anexoA })
    .map((a) => a.nome).join(',') === 'a.pdf,b.pdf');
verificar('deduplica por caminho (o primeiro está em `arquivo` e em `arquivos`)',
  Regras.anexosDoRegistro({ arquivos: [anexoA, anexoB, Object.assign({}, anexoA)], arquivo: anexoA }).length === 2);
verificar('deduplica por url quando não há caminho',
  Regras.anexosDoRegistro({ arquivos: [{ url: 'https://x/z', nome: 'z' }, { url: 'https://x/z', nome: 'z2' }] }).length === 1);

const docEmp = { url: 'https://x/d', nome: 'd.pdf', path: 'empreendimentos/IPE-1/2026/d.pdf', tamanho: 5, tipo: '' };
const normEmp = Regras.anexosDoRegistro({ arquivo: docEmp });
verificar('aceita `path` (documento de empreendimento) e devolve sempre `caminho`',
  normEmp.length === 1 && normEmp[0].caminho === docEmp.path && !('path' in normEmp[0]));
verificar('aceita `caminho` e `path` misturados e deduplica entre eles',
  Regras.anexosDoRegistro({
    arquivos: [docEmp, { url: 'https://x/d', nome: 'd.pdf', caminho: docEmp.path }]
  }).length === 1);
verificar('o anexo normalizado tem exatamente as chaves url, nome, caminho, tamanho, tipo',
  Object.keys(normEmp[0]).sort().join(',') === 'caminho,nome,tamanho,tipo,url');

verificar('tolera registro nulo, indefinido e vazio',
  Regras.anexosDoRegistro(null).length === 0 && Regras.anexosDoRegistro(undefined).length === 0 &&
  Regras.anexosDoRegistro({}).length === 0 && Regras.anexosDoRegistro('texto').length === 0);
verificar('tolera `arquivos` que não é lista e itens inválidos',
  Regras.anexosDoRegistro({ arquivos: 'x', arquivo: null }).length === 0 &&
  Regras.anexosDoRegistro({ arquivos: [null, 3, 'a', {}, { nome: 'sem url nem caminho' }] }).length === 0);
verificar('`arquivos` vazio cai no `arquivo` antigo',
  Regras.anexosDoRegistro({ arquivos: [], arquivo: anexoA }).length === 1);
verificar('itens inválidos em `arquivos` são ignorados, os válidos ficam',
  Regras.anexosDoRegistro({ arquivos: [null, anexoB] }).length === 1);
verificar('a saída não contém undefined',
  !temUndefined(Regras.anexosDoRegistro({ arquivos: [{ url: 'https://x/u' }] })));

verificar('caminhosDeAnexos: registro antigo devolve o caminho único',
  JSON.stringify(Regras.caminhosDeAnexos({ arquivo: anexoA })) === JSON.stringify([anexoA.caminho]));
verificar('caminhosDeAnexos não repete o primeiro (em `arquivo` e em `arquivos`)',
  JSON.stringify(Regras.caminhosDeAnexos({ arquivos: [anexoA, anexoB], arquivo: anexoA })) ===
  JSON.stringify([anexoA.caminho, anexoB.caminho]));
verificar('caminhosDeAnexos lê `path` do documento de empreendimento',
  JSON.stringify(Regras.caminhosDeAnexos({ arquivos: [docEmp], arquivo: docEmp })) ===
  JSON.stringify([docEmp.path]));
verificar('caminhosDeAnexos ignora anexos sem caminho e tolera nulo',
  Regras.caminhosDeAnexos({ arquivos: [{ url: 'https://x/u' }] }).length === 0 &&
  Regras.caminhosDeAnexos(null).length === 0 && Regras.caminhosDeAnexos({}).length === 0);
verificar('caminhosDeAnexos inclui o `arquivo` mesmo que falte em `arquivos` (não deixa órfão)',
  JSON.stringify(Regras.caminhosDeAnexos({ arquivos: [anexoB], arquivo: anexoA })) ===
  JSON.stringify([anexoB.caminho, anexoA.caminho]));

console.log('\n20) indiceDeAnexos: todos os arquivos e bloco de evidências (aditivo)');

const estadoIndice = {
  empreendimentos: [
    {
      nome: 'Empresa Um', codigo: 'IPE-0001',
      documentos: [
        // antigo: um arquivo só, com `path`
        { titulo: 'Pitch', arquivo: docEmp, data_referencia: '2026-02-01' },
        // novo: vários arquivos
        {
          titulo: 'Entregas', data_referencia: '2026-03-01',
          arquivo: { url: 'https://x/e1', nome: 'e1.pdf', path: 'empreendimentos/IPE-1/2026/e1.pdf' },
          arquivos: [
            { url: 'https://x/e1', nome: 'e1.pdf', path: 'empreendimentos/IPE-1/2026/e1.pdf' },
            { url: 'https://x/e2', nome: 'e2.pdf', path: 'empreendimentos/IPE-1/2026/e2.pdf' }
          ]
        },
        // só link
        { titulo: 'Pasta', link: 'https://drive/x', data_referencia: '2026-04-01' }
      ]
    },
    { nome: 'Sem docs', codigo: 'IPE-0002', documentos: [] }
  ],
  evidencias: [
    { protocolo: 'EVD-2026-001', titulo: 'Lista', pratica: '1.1.1', arquivo: anexoA },
    { protocolo: 'EVD-2026-002', titulo: 'Fotos', pratica: '1.1.2', arquivo: anexoA, arquivos: [anexoA, anexoB] },
    { protocolo: 'EVD-2026-003', titulo: 'So link', pratica: '1.1.1', link: 'https://x' }
  ]
};
const indice = Regras.indiceDeAnexos(estadoIndice);
verificar('mantém as chaves de sempre (observacao e empreendimentos)',
  typeof indice.observacao === 'string' && Array.isArray(indice.empreendimentos));
verificar('empreendimento sem documentos continua fora do índice',
  indice.empreendimentos.length === 1 && indice.empreendimentos[0].codigo === 'IPE-0001');
const docsIdx = indice.empreendimentos[0].documentos;
verificar('documento antigo mantém titulo, url, path e data_referencia',
  docsIdx[0].titulo === 'Pitch' && docsIdx[0].url === docEmp.url &&
  docsIdx[0].path === docEmp.path && docsIdx[0].data_referencia === '2026-02-01');
verificar('documento antigo ganha `arquivos` com o único arquivo',
  JSON.stringify(docsIdx[0].arquivos) ===
  JSON.stringify([{ nome: 'd.pdf', url: docEmp.url, path: docEmp.path }]));
verificar('documento com vários arquivos lista todos (nome, url, path)',
  docsIdx[1].arquivos.length === 2 && docsIdx[1].arquivos[1].nome === 'e2.pdf' &&
  docsIdx[1].arquivos[1].url === 'https://x/e2' &&
  docsIdx[1].arquivos[1].path === 'empreendimentos/IPE-1/2026/e2.pdf');
verificar('url e path do documento seguem sendo os do primeiro arquivo',
  docsIdx[1].url === 'https://x/e1' && docsIdx[1].path === 'empreendimentos/IPE-1/2026/e1.pdf');
verificar('documento só com link: url é o link, path vazio, sem arquivos',
  docsIdx[2].url === 'https://drive/x' && docsIdx[2].path === '' && docsIdx[2].arquivos.length === 0);
verificar('bloco `evidencias` traz só evidências com anexo',
  Array.isArray(indice.evidencias) && indice.evidencias.length === 2 &&
  indice.evidencias.map((x) => x.protocolo).join(',') === 'EVD-2026-001,EVD-2026-002');
verificar('evidência no índice: protocolo, titulo, pratica e arquivos {nome,url,path}',
  JSON.stringify(Object.keys(indice.evidencias[1]).sort()) ===
  JSON.stringify(['arquivos', 'pratica', 'protocolo', 'titulo']) &&
  indice.evidencias[1].pratica === '1.1.2' && indice.evidencias[1].arquivos.length === 2 &&
  JSON.stringify(Object.keys(indice.evidencias[1].arquivos[0]).sort()) ===
  JSON.stringify(['nome', 'path', 'url']) && indice.evidencias[1].arquivos[1].path === anexoB.caminho);
verificar('evidência antiga entra no índice com o arquivo único',
  indice.evidencias[0].arquivos.length === 1 && indice.evidencias[0].arquivos[0].path === anexoA.caminho);
verificar('o índice não contém undefined', !temUndefined(indice));
verificar('sem evidências nem empreendimentos: estrutura vazia válida',
  JSON.stringify(Regras.indiceDeAnexos({}).evidencias) === '[]' &&
  JSON.stringify(Regras.indiceDeAnexos({}).empreendimentos) === '[]');

// O backup exportado leva o índice, e importar um backup (com ou sem o índice) continua igual.
Store.limpar();
Store.criarEm('evidencias', {
  pratica: '1.1.1', requisito: null, titulo: 'Com varios', data_referencia: '2026-01-10',
  arquivo: anexoA, arquivos: [anexoA, anexoB]
});
Store.criarEm('evidencias', {
  pratica: '1.1.1', requisito: null, titulo: 'Antiga', data_referencia: '2026-01-11', arquivo: anexoB
});
const backupNovo = JSON.parse(JSON.stringify(Store.exportarObjeto()));
verificar('exportarObjeto leva o índice com o bloco de evidências',
  backupNovo.anexos_indice && backupNovo.anexos_indice.evidencias.length === 2 &&
  backupNovo.anexos_indice.evidencias[0].arquivos.length === 2);
Store.limpar();
Store.importarObjeto(backupNovo);
const evImportadas = Store.estado().evidencias;
verificar('importar o backup novo restaura os anexos (arquivo e arquivos) intactos',
  evImportadas.length === 2 && evImportadas[0].arquivos.length === 2 &&
  evImportadas[0].arquivo.caminho === anexoA.caminho && evImportadas[1].arquivo.caminho === anexoB.caminho &&
  evImportadas[1].arquivos === undefined);
const backupAntigo = JSON.parse(JSON.stringify(backupNovo));
delete backupAntigo.anexos_indice;
Store.limpar();
Store.importarObjeto(backupAntigo);
verificar('importar backup sem o índice continua funcionando', Store.estado().evidencias.length === 2);

console.log('\n21) Vários arquivos NÃO mudam a prontidão');
Store.limpar();
const praticaQ = praticasN1[0];
const reqQ = praticaQ.requisitos.filter((r) => r.obrigatorio)[0];
const faltasSemEv = JSON.stringify(Store.faltasDaPratica(praticaQ));
Store.criarEm('evidencias', {
  pratica: praticaQ.codigo, requisito: reqQ.id, titulo: 'um', data_referencia: '2026-01-10',
  arquivo: anexoA, arquivos: [anexoA]
});
const faltasUmArquivo = JSON.stringify(Store.faltasDaPratica(praticaQ));
Store.limpar();
Store.criarEm('evidencias', {
  pratica: praticaQ.codigo, requisito: reqQ.id, titulo: 'muitos', data_referencia: '2026-01-10',
  arquivo: anexoA, arquivos: [anexoA, anexoB, docEmp, anexoB]
});
const faltasMuitos = JSON.stringify(Store.faltasDaPratica(praticaQ));
verificar('a mesma evidência com 1 ou vários arquivos dá as mesmas faltas',
  faltasUmArquivo === faltasMuitos);
verificar('o anexo atende o requisito como qualquer evidência (faltas diminuem)',
  faltasSemEv !== faltasMuitos);
Store.limpar();
Store.criarEm('evidencias', {
  pratica: praticaQ.codigo, requisito: reqQ.id, titulo: 'sem arquivo', data_referencia: '2026-01-10'
});
verificar('evidência sem arquivo conta igual à com arquivos',
  JSON.stringify(Store.faltasDaPratica(praticaQ)) === faltasMuitos);
verificar('a regra de prontidão não menciona anexos nem arquivos',
  !/anexo|arquivo/i.test(fonteRegra));

console.log('\n' + (falhas === 0 ? 'TODOS OS TESTES PASSARAM' : falhas + ' TESTE(S) FALHARAM'));
process.exit(falhas === 0 ? 0 : 1);
