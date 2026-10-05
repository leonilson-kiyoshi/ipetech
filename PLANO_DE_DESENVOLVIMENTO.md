# Plano de Desenvolvimento — Sistema de Acompanhamento CERNE 2025

> **Documento histórico.** Registra o plano da primeira versão, em Django e rodando
> localmente. O caminho escolhido depois foi outro: aplicativo web estático no GitHub
> Pages com Firebase, sem servidor para manter. Veja o [README](README.md) para como o
> sistema está montado hoje.

Guia passo a passo para sair do zero e chegar a uma plataforma interna, rodando
localmente, que permita **acompanhar, documentar, guardar evidências e metrificar**
tudo o que é necessário para solicitar a certificação **CERNE 2025** de um parque
tecnológico.

> Este é um documento vivo. Marque os passos conforme concluir. Você vai
> desenvolver com a ajuda do Kiro: em cada fase há o que **você faz** (rodar
> comandos, decidir) e o que você **pede ao Kiro** (gerar o código).

> **Decisões confirmadas (jun/2025):**
> - Stack: **Django + SQLite** (confirmado).
> - Escopo do catálogo: **os 4 níveis CERNE (1 a 4)**, todos metrificáveis. Uma
>   ação pode pertencer a qualquer nível; a plataforma aceita registros de níveis
>   diferentes ao mesmo tempo.
> - **Radar de prontidão:** o sistema calcula automaticamente até qual CERNE
>   (1→4) o parque já está apto a solicitar, com base no que foi registrado
>   (regra acumulativa: apto ao CERNE N = práticas dos níveis 1..N implantadas,
>   com evidências e métricas satisfeitas).
> - **Auditabilidade:** cada evidência e medição carrega data e responsável, com
>   trilha de auditoria (quem alterou o quê e quando) e uma visão/dossiê por
>   prática e nível, prontos para a equipe do CERNE auditar.

> **✅ Progresso atual (já construído pelo Kiro):**
> - **Fase 0 concluída** — ambiente virtual `.venv`, Django 5.2 + Pillow, projeto
>   `config`, apps `catalogo` e `acompanhamento`, `settings` em pt-br, `MEDIA`
>   configurado, `.gitignore` e `requirements.txt`.
> - **Fase 1 concluída** — modelos do catálogo (VersaoModelo, Nivel,
>   ProcessoChave, PraticaChave, RequisitoEvidencia, DefinicaoMetrica,
>   Recomedacao) e de acompanhamento (Mecanismo, StatusPratica, Evidencia,
>   MedicaoMetrica, Aprendizado, PlanoAcao), com admin navegável e trilha de
>   autoria. Banco migrado; servidor sobe e o admin abre em `/admin/`.
> - **Fase 2 concluída** — catálogo CERNE 2025 semeado com os **4 níveis, 12
>   processos-chave e 29 práticas-chave**, agora com **orientação de preenchimento
>   em todas as práticas** e métricas/evidências com exemplos no CERNE 1
>   (`python manage.py seed_cerne`, idempotente).
> - **Fase 5 concluída (Dashboard + Radar)** — páginas web amigáveis (Bootstrap):
>   Dashboard com **radar de prontidão** (até qual CERNE você está apto), gráficos
>   por nível, semáforos por processo e pendências do próximo nível; Catálogo
>   navegável; página de cada prática com "**Como preencher**", evidências
>   exigidas (com exemplos) e métricas; e um **Guia de preenchimento**.
> - **Exemplo pronto** — `python manage.py seed_exemplo` cria o mecanismo
>   "Parque Tecnológico (EXEMPLO)" com o CERNE 1 totalmente preenchido, para você
>   ver o radar positivo e como preencher. Pode excluí-lo no admin quando quiser.
> - **Enriquecimento dos níveis 2–4 concluído** — todas as 15 práticas dos CERNE
>   2, 3 e 4 receberam objetivo, orientação de preenchimento, a **métrica oficial**
>   (obrigatória, conforme o Manual) e os **requisitos de evidência** com exemplos.
>   Catálogo agora com **33 métricas e 78 requisitos de evidência**.
> - **Fase 6 concluída (Auditoria + Dossiê)** — página de **Auditoria interna**
>   (relatório de lacunas: o que está completo e o que falta por nível) e
>   **Dossiê** consolidado por nível/prática (objetivo, status, evidências com
>   data/responsável, métricas com medições e pendências), com filtro por nível e
>   botão **Imprimir / Salvar PDF** (layout com CSS de impressão).
> - **Fase 7 concluída (Usuários e papéis)** — as páginas web exigem **login**;
>   perfis **Gestor / Equipe / Auditor** criados via `python manage.py criar_perfis`;
>   a base mostra o usuário logado e "Sair", e os botões de edição só aparecem para
>   quem tem acesso ao admin. Página de login amigável.
> - **Manual/tutorial criado** — página **Manual** in-app (administrador +
>   registrador, com exemplos e o porquê de cada campo) e o arquivo
>   **MANUAL_DO_USUARIO.md** para impressão/compartilhamento.
> - **Fase 8 concluída (Qualidade + Backup)** — 5 **testes automatizados** do motor
>   de prontidão/radar (`python manage.py test`) e comando **`backup`** (copia
>   `db.sqlite3` + `media/` para pasta datada; opções `--zip` e `--dir`).
> - **Download de PDF do dossiê** — botão "Baixar PDF" (via xhtml2pdf), além do
>   Imprimir/Salvar PDF do navegador.
> - **Módulo de Empreendimentos concluído** — cadastro de empreendimentos apoiados
>   e avaliação nos **5 eixos** (Empreendedor, Tecnologia, Capital, Mercado, Gestão),
>   com página de lista e detalhe com **radar** (Chart.js) e histórico. Exemplo
>   populado via `seed_exemplo`.
> - **Sistema completo** conforme o plano. Evoluções futuras possíveis: metas por
>   métrica, notificações de prazos, e acesso em rede (hospedagem) com HTTPS.

---

## 0. Visão geral

**O que vamos construir:** uma aplicação web local (abre no navegador) onde o
parque tecnológico registra sua jornada rumo ao CERNE 2025 — o modelo da
metodologia vira dado no sistema, e você preenche status, evidências, métricas e
planos de ação, visualizando tudo em um dashboard de prontidão.

**Stack assumida (ajuste se quiser antes de começar):**

| Camada | Escolha | Por quê |
|---|---|---|
| Linguagem | **Python 3.11+** | Já instalado na sua máquina |
| Framework | **Django 5.x** | Admin pronto p/ cadastro e evidências, upload de arquivos nativo, auth embutida |
| Banco de dados | **SQLite** | Um arquivo só, zero configuração, backup = copiar o arquivo |
| Dashboard/gráficos | **Chart.js** (via navegador) | Sem instalação, gráficos simples e bonitos |
| Telas dinâmicas | **HTMX** (opcional) | Interatividade sem front-end pesado |
| PDF do dossiê | **xhtml2pdf** ou "imprimir → PDF" do navegador | Puro Python, funciona no Windows |

**Resultado final (Definição de Pronto):** ver a [seção 12](#12-definição-de-pronto-checklist-final).

---

## Como usar este guia

Legenda dos passos:

- 👤 **VOCÊ** — comando que você roda no terminal do Kiro ou uma decisão sua.
- 🤖 **KIRO** — peça para eu gerar/editar o código descrito.
- ✅ **CHECKPOINT** — como confirmar que a fase funcionou antes de seguir.
- 📦 **ENTREGÁVEL** — o que você tem de concreto ao fim da fase.

**Ordem das fases (índice):**

1. [Pré-requisitos](#1-pré-requisitos)
2. [Fase 0 — Ambiente e projeto](#2-fase-0--ambiente-e-projeto)
3. [Fase 1 — Modelagem do catálogo CERNE](#3-fase-1--modelagem-do-catálogo-cerne)
4. [Fase 2 — Semear o catálogo CERNE 2025](#4-fase-2--semear-o-catálogo-cerne-2025)
5. [Fase 3 — Núcleo de acompanhamento e evidências](#5-fase-3--núcleo-de-acompanhamento-e-evidências)
6. [Fase 4 — Métricas e metas](#6-fase-4--métricas-e-metas)
7. [Fase 5 — Dashboard](#7-fase-5--dashboard)
8. [Fase 6 — Auditoria interna e dossiê](#8-fase-6--auditoria-interna-e-dossiê)
9. [Fase 7 — Usuários e papéis](#9-fase-7--usuários-e-papéis)
10. [Fase 8 — Qualidade e backup](#10-fase-8--qualidade-e-backup)
11. [Fase 9 (opcional) — Expansão](#11-fase-9-opcional--expansão)
12. [Definição de Pronto](#12-definição-de-pronto-checklist-final)
13. [Como trabalharemos juntos](#13-como-trabalharemos-juntos)
14. [Glossário](#14-glossário)

**Estimativa de esforço** (trabalhando comigo, algumas horas por fase): Fases 0–2
são a fundação; Fase 3 é o coração do sistema; Fases 4–6 entregam o valor de
acompanhamento; Fases 7–8 profissionalizam. Fase 9 é futuro.

---

## 1. Pré-requisitos

Confira o que já existe e instale o que faltar.

- [ ] 👤 **Python 3.11+** — verifique no terminal:
  ```powershell
  python --version
  ```
  (Você já tem 3.11 e 3.13 instalados.)
- [ ] 👤 **Git** (controle de versão / histórico do código):
  ```powershell
  git --version
  ```
  Se não tiver, instale de https://git-scm.com/download/win
- [ ] 👤 **Kiro / VS Code** — já é onde você está.
- [ ] 👤 Conhecimento: **você não precisa ser programador experiente.** Eu gero o
  código; você roda comandos, testa no navegador e decide as regras de negócio.

> ⚠️ **Nota sobre o OneDrive:** o projeto fica dentro de uma pasta do OneDrive.
> Isso é ok, mas o ambiente virtual (`.venv`), caches e o banco não precisam ser
> sincronizados. Vamos colocá-los no `.gitignore`; se notar lentidão de sync,
> peça ao Kiro para te orientar a excluir `.venv/` da sincronização do OneDrive.

---

## 2. Fase 0 — Ambiente e projeto

**Objetivo:** ter um projeto Django em branco rodando no navegador.

- [ ] 👤 Abra o terminal integrado do Kiro na pasta do projeto.
- [ ] 👤 Crie e ative o ambiente virtual (isola as bibliotecas do projeto):
  ```powershell
  python -m venv .venv
  .\.venv\Scripts\Activate.ps1
  ```
  > Se aparecer erro de "execution policy", rode antes:
  > ```powershell
  > Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
  > ```
  > Deu certo quando o terminal mostra `(.venv)` no início da linha.
- [ ] 👤 Instale as dependências iniciais:
  ```powershell
  pip install django pillow
  pip freeze > requirements.txt
  ```
- [ ] 👤 Crie o projeto Django (o `.` no final evita uma subpasta extra):
  ```powershell
  django-admin startproject config .
  ```
- [ ] 👤 Rode as migrações iniciais e suba o servidor:
  ```powershell
  python manage.py migrate
  python manage.py runserver
  ```
- [ ] 🤖 **KIRO:** peça para eu criar um `.gitignore` adequado (Python/Django,
  ignorando `.venv/`, `__pycache__/`, `db.sqlite3`, `media/`) e fazer o primeiro
  commit do git.

- ✅ **CHECKPOINT:** abra `http://127.0.0.1:8000` no navegador e veja a página de
  boas-vindas do Django ("The install worked successfully!").
- 📦 **ENTREGÁVEL:** projeto Django funcional, versionado no git.

> Para parar o servidor: `Ctrl + C` no terminal. Para religar:
> `python manage.py runserver`. Sempre com o `(.venv)` ativo.

---

## 3. Fase 1 — Modelagem do catálogo CERNE

**Objetivo:** transformar a estrutura da metodologia CERNE em tabelas do banco —
esta é a espinha dorsal e já resolve o "não tenho a metodologia estruturada".

Estrutura a modelar (hierarquia):

```
VersaoModelo (CERNE 2025)
 └─ Nivel (1..4)
     └─ ProcessoChave (ex.: "1.1 Sensibilização e Prospecção")
         └─ PraticaChave (ex.: "1.1.1 Sensibilização")  → descrição, objetivo
             ├─ RequisitoEvidencia   (o que a certificadora espera)
             ├─ DefinicaoMetrica     (métrica + meta obrigatória)
             └─ Recomendacao
```

- [ ] 👤 Crie o app do catálogo:
  ```powershell
  python manage.py startapp catalogo
  ```
- [ ] 🤖 **KIRO:** peça para eu:
  - registrar o app `catalogo` em `config/settings.py` (`INSTALLED_APPS`);
  - criar os *models* acima em `catalogo/models.py` (com relações e `__str__`);
  - registrar todos no **Django admin** (`catalogo/admin.py`), com boa navegação
    (inlines de práticas dentro do processo, etc.).
- [ ] 👤 Gere e aplique as migrações:
  ```powershell
  python manage.py makemigrations
  python manage.py migrate
  ```
- [ ] 👤 Crie seu usuário administrador:
  ```powershell
  python manage.py createsuperuser
  ```

- ✅ **CHECKPOINT:** acesse `http://127.0.0.1:8000/admin`, faça login e confirme
  que consegue criar manualmente um Nível, um Processo e uma Prática.
- 📦 **ENTREGÁVEL:** modelo de dados do catálogo CERNE pronto e editável no admin.

---

## 4. Fase 2 — Semear o catálogo CERNE 2025

**Objetivo:** preencher o catálogo automaticamente com **todos** os processos,
práticas, objetivos, métricas e evidências exigidas do CERNE 2025 — sem digitar à mão.

> Eu já extraí o texto dos 14 PDFs da pasta (inclusive o Manual de Implantação
> 2025), então consigo montar esse conteúdo estruturado.

- [ ] 🤖 **KIRO:** peça para eu extrair do **Manual de Implantação 2025** o conteúdo
  de cada prática-chave (descrição, objetivo, métricas/metas, evidências,
  recomendações) e gerar um arquivo de carga (*fixture* JSON ou script de seed).
- [ ] 🤖 **KIRO:** peça para eu criar um comando de carga
  (`python manage.py seed_cerne`) que popula o banco a partir desse conteúdo.
- [ ] 👤 Rode a carga:
  ```powershell
  python manage.py seed_cerne
  ```
- [x] 👤 **Decisão tomada:** semear os **4 níveis (CERNE 1 a 4)**. Começamos pela
  estrutura completa (níveis → processos → práticas) e enriquecemos com
  objetivo/métricas/evidências a partir do Manual de Implantação 2025.

- ✅ **CHECKPOINT:** no admin, navegue pelo catálogo e confira se os processos
  (1.1 a 1.5, etc.) e suas práticas apareceram com objetivo e evidências.
- 📦 **ENTREGÁVEL:** metodologia CERNE 2025 disponível como dado no sistema.

---

## 5. Fase 3 — Núcleo de acompanhamento e evidências

**Objetivo:** o coração do sistema — registrar o **status** de cada prática, anexar
**evidências** (arquivos) e vinculá-las aos requisitos.

Novas tabelas:

```
Mecanismo            (seu parque: nome, nível almejado, nível atual)
StatusPratica        (por prática: Não iniciada / Em andamento / Implantada / Em revisão + %)
Evidencia            (arquivo + título + data + responsável + prática/requisito vinculado)
Aprendizado          (revisão crítica: eficiência/eficácia/efetividade + observações)
PlanoAcao            (ação, responsável, prazo, status)
```

- [ ] 👤 Crie o app:
  ```powershell
  python manage.py startapp acompanhamento
  ```
- [ ] 🤖 **KIRO:** peça para eu:
  - criar os models acima (com `FileField`/`ImageField` para evidências);
  - configurar `MEDIA_URL` e `MEDIA_ROOT` em `settings.py` e servir arquivos em
    desenvolvimento;
  - registrar tudo no admin com filtros por nível/processo/status;
  - criar telas simples (fora do admin) para **listar práticas por processo** e,
    em cada prática, **mudar status, subir evidência e anexar plano de ação**.
- [ ] 👤 Migre:
  ```powershell
  python manage.py makemigrations
  python manage.py migrate
  ```

- ✅ **CHECKPOINT:** suba um arquivo de teste (um PDF qualquer) como evidência de
  uma prática, mude o status para "Em andamento" e confirme que ficou salvo e
  reaparece ao recarregar a página.
- 📦 **ENTREGÁVEL:** você já consegue **documentar e guardar evidências** por prática.

> 🔒 **Segurança:** como é uso local e interno, começamos sem login nas telas.
> Se um dia expor na rede da instituição, é obrigatório ativar autenticação e
> controle de acesso (tratamos isso na Fase 6). As evidências podem conter dados
> sensíveis — mantenha o backup (Fase 8) protegido.

---

## 6. Fase 4 — Métricas e metas

**Objetivo:** metrificar. Cada prática do CERNE 2025 tem métricas com **metas
obrigatórias** — precisamos registrar medições ao longo do tempo e comparar com a meta.

```
DefinicaoMetrica  (nome, unidade, meta) — já vem do catálogo (Fase 2)
MedicaoMetrica    (valor + data)        — série histórica que você alimenta
```

- [ ] 🤖 **KIRO:** peça para eu:
  - garantir o vínculo entre `DefinicaoMetrica` (catálogo) e `MedicaoMetrica`;
  - criar tela para **lançar medições** (valor + data) por métrica;
  - calcular automaticamente **atingimento da meta** (ex.: verde/amarelo/vermelho).
- [ ] 👤 Lance algumas medições de teste.

- ✅ **CHECKPOINT:** registre 2–3 medições de uma métrica e veja o indicador de
  meta mudar de cor conforme o valor.
- 📦 **ENTREGÁVEL:** histórico de métricas versus metas por prática.

---

## 7. Fase 5 — Dashboard

**Objetivo:** visualização fácil do todo — o painel que você pediu.

O dashboard mostra:

- **RADAR DE PRONTIDÃO** — o destaque: até qual CERNE (1→4) o parque já está apto
  a solicitar, calculado automaticamente pela regra acumulativa. Mostra também o
  que ainda falta para atingir o próximo nível.
- **% de prontidão** (geral e por nível 1–4);
- **Semáforo por processo-chave** (implantado / em andamento / parado);
- **Evidências pendentes** (o que falta anexar);
- **Métricas x metas** (gráficos de série histórica);
- **Planos de ação** com prazos próximos/vencidos.

> **Regra do radar:** o parque está "apto ao CERNE N" quando **todas** as
> práticas dos níveis 1 até N estão com status *Implantada*, com as evidências
> obrigatórias anexadas e as métricas obrigatórias medidas. O radar aponta o
> maior N que satisfaz essa regra.

- [ ] 🤖 **KIRO:** peça para eu:
  - criar a *view* e o template do dashboard como página inicial do sistema;
  - calcular os percentuais de prontidão a partir dos `StatusPratica`;
  - integrar **Chart.js** (via CDN) para os gráficos;
  - deixar o layout limpo e navegável (menu para Catálogo, Práticas, Métricas,
    Evidências, Auditoria).

- ✅ **CHECKPOINT:** abra a home e veja os percentuais e gráficos refletindo os
  dados que você cadastrou nas fases anteriores.
- 📦 **ENTREGÁVEL:** dashboard de acompanhamento funcionando.

---

## 8. Fase 6 — Auditoria interna e dossiê

**Objetivo:** preparar a solicitação da certificação — o passo "auditoria interna"
da metodologia CERNE, e a exportação de um dossiê **auditável pela equipe do CERNE**.

> A auditabilidade é requisito central: para cada prática o sistema mostra, de
> forma rastreável, o status, as evidências anexadas (com data e responsável), as
> medições das métricas e os registros de aprendizado. A trilha de auditoria
> (quem alterou o quê e quando) fica disponível, e o dossiê consolida tudo por
> nível para facilitar a conferência externa.

- [ ] 🤖 **KIRO:** peça para eu:
  - criar um **relatório de lacunas** (checklist): para cada prática, listar o que
    falta (evidência ausente, meta não atingida, sem plano de ação);
  - criar a exportação de um **dossiê** por nível (prática → objetivo → evidências
    anexadas → métricas → status), em HTML pronto para "imprimir → PDF" e, se
    quiser, geração de PDF no servidor (`pip install xhtml2pdf`).

- ✅ **CHECKPOINT:** gere o relatório de lacunas do CERNE 1 e o dossiê; confirme
  que ele lista corretamente pendências e evidências.
- 📦 **ENTREGÁVEL:** você consegue enxergar exatamente o que falta para solicitar a
  certificação e exportar um documento consolidado.

---

## 9. Fase 7 — Usuários e papéis

**Objetivo:** controle de acesso para a equipe (gestor, equipe, auditor).

- [ ] 🤖 **KIRO:** peça para eu:
  - proteger as telas com login (autenticação do Django);
  - criar grupos/papéis (ex.: **Gestor**, **Equipe**, **Auditor/leitura**);
  - restringir edição conforme o papel.
- [ ] 👤 Crie os usuários da equipe no admin.

- ✅ **CHECKPOINT:** faça login com um usuário "somente leitura" e confirme que ele
  visualiza, mas não edita.
- 📦 **ENTREGÁVEL:** sistema multiusuário com papéis.

---

## 10. Fase 8 — Qualidade e backup

**Objetivo:** confiabilidade e não perder dados/evidências.

- [ ] 🤖 **KIRO:** peça para eu criar **testes automatizados** dos cálculos
  principais (prontidão, atingimento de meta) e rodar:
  ```powershell
  python manage.py test
  ```
- [ ] 🤖 **KIRO:** peça para eu criar um **script de backup** que copia
  `db.sqlite3` + a pasta `media/` (evidências) para uma pasta datada.
- [ ] 👤 Faça um backup de teste e guarde em local seguro.

- ✅ **CHECKPOINT:** os testes passam e o backup gera uma cópia utilizável.
- 📦 **ENTREGÁVEL:** plataforma testada e com rotina de backup.

---

## 11. Fase 9 (opcional) — Expansão

Quando o núcleo estiver maduro, dá para evoluir:

- [ ] **Módulo de empreendimentos incubados** — acompanhar cada empreendimento nos
  **5 eixos** (Empreendedor, Tecnologia, Capital, Mercado, Gestão).
- [ ] **Acesso em rede** para a equipe (sair do "só local") — exige revisar
  segurança, HTTPS e hospedagem.
- [ ] **Notificações/alertas** de prazos de planos de ação e revisões críticas.
- [ ] **Semear os níveis CERNE 2, 3 e 4** completos, se começou só pelo 1.
- [ ] **Migrar de SQLite para PostgreSQL** se virar multiusuário pesado/hospedado.

---

## 12. Definição de Pronto (checklist final)

A plataforma está "pronta" para uso quando:

- [ ] O catálogo CERNE 2025 está carregado (ao menos o nível-alvo).
- [ ] É possível registrar status, subir evidências e vincular às práticas.
- [ ] Métricas têm metas e histórico de medições.
- [ ] O dashboard mostra % de prontidão, semáforos e gráficos.
- [ ] O relatório de lacunas aponta o que falta para a certificação.
- [ ] O dossiê exporta um documento consolidado por nível.
- [ ] Há login com papéis para a equipe.
- [ ] Testes passam e há backup do banco + evidências.
- [ ] O sistema sobe com um comando (`python manage.py runserver`) e abre no navegador.

---

## 13. Como trabalharemos juntos

Fluxo recomendado, fase a fase:

1. Você lê a fase aqui e roda os comandos marcados com 👤.
2. Você me pede (🤖) para gerar/editar o código daquela fase — sempre reviso e
   explico o que fiz.
3. Você testa no navegador (✅ checkpoint) e me diz se algo não bateu.
4. Seguimos para a próxima fase.

> 💡 **Dica:** como isto é um sistema completo, podemos formalizar tudo em um
> **Spec do Kiro** (requisitos → design → tarefas), que transforma este plano em
> tarefas rastreáveis e executáveis. Se quiser, é só pedir: "cria o spec do
> sistema CERNE".

---

## 14. Glossário

- **Mecanismo de inovação** — termo do CERNE 2025 para incubadoras, parques,
  aceleradoras etc. (no seu caso, o parque tecnológico).
- **Nível de maturidade (CERNE 1–4)** — etapas acumulativas de certificação.
- **Processo-chave** — grupo de práticas dentro de um nível (ex.: 1.1 Sensibilização
  e Prospecção).
- **Prática-chave** — unidade avaliada (ex.: 1.1.1 Sensibilização).
- **Elementos-chave** — o que comprova uma prática: Ações, Métricas, Aprendizado e
  Evidências.
- **Evidência** — procedimento, registro ou plano que comprova a prática à
  certificadora.
- **Django** — framework web em Python que usaremos.
- **SQLite** — banco de dados em arquivo único.
- **Migração** — comando que cria/atualiza as tabelas do banco a partir dos models.
- **Fixture / seed** — carga inicial de dados (aqui, o catálogo CERNE).
- **Ambiente virtual (`.venv`)** — pasta isolada com as bibliotecas do projeto.

---

*Próximo passo sugerido: concluir a Fase 0 (ambiente e projeto). Quando você der o
"ok" e responder qual escopo de níveis semear (só CERNE 1 ou os 4), eu começo a
gerar o código.*
