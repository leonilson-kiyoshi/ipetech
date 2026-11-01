# Backlog — Acompanhamento CERNE (IpêTech)

Prioridade de trabalho: **foco no CERNE 1**. Princípio permanente: mudanças
**aditivas**, sem impactar os dados já salvos.

## ✅ Já entregue (Fases 1 e 2)

- Empreendimentos: código `IPE-0001`, situação **Pré-incubado**, **programa de
  origem**, **anexos** de documentos no próprio empreendimento.
- **Atividades** (nova área): eventos/reuniões/capacitações com protocolo
  `ATV-AAAA-000`, data de realização × cadastro, e vínculo a prática/empreendimento/
  programa.
- Evidências com protocolo `INB-AAAA-000`, vínculo a empreendimento/programa, e
  **filtros** por ano/tipo.
- **Dossiê por nível** (gerar só o CERNE 1, por exemplo).
- Pendências com **responsável por complementar**.
- **Histórico** de alterações (quem/o quê/quando) e **índice de anexos** no backup.

## 🔜 Próximas melhorias

### Prioridade alta (P1)
- [ ] **Vincular evidência a uma atividade específica** — associar fotos, relatórios
  e listas de presença à atividade correspondente (hoje a atividade aponta para
  prática/empreendimento/programa; falta o elo evidência → atividade). *A validar se
  já cobre o caso de uso.*
- [ ] **Exportar anexos em lote** — botão para baixar todos os arquivos do
  armazenamento (o backup `.json` já leva o índice; falta baixar os arquivos em si).
- [ ] **Rotina de backup** — como o sistema é estático (sem servidor para agendar),
  definir uma **cadência** (ex.: mensal) com **lembrete** na tela de Dados e backup.

### Prioridade média (P2)
- [ ] **Lembretes de prazo** dos planos de ação e das revisões críticas periódicas.
- [ ] **Metas quantitativas por métrica** com **alerta de desvio** (hoje a meta é
  texto livre; permitir valor-alvo e sinalizar quando a medição ficar abaixo).
- [ ] **Resumo de pendências documentais por responsável** (quem precisa complementar
  o quê), e filtro por período no painel.

### Prioridade baixa / futuro (P3)
- [ ] Aprofundar o conteúdo e o acompanhamento dos **níveis CERNE 2, 3 e 4** quando o
  parque avançar.
- [ ] Notificações por e-mail e relatórios exportáveis adicionais.

## Como cada item será tratado
1. Implementação em **branch separada**, de forma **aditiva**, com os testes do repo
   (`node testes/...`) passando.
2. Se exigir nova coleção/caminho, entrego o **texto das regras** para publicar no
   console do Firebase **antes** do deploy.
3. Deploy (merge na `main`) só após sua revisão/aprovação.
