# Manual do Usuário — Sistema de Acompanhamento CERNE 2025

> **Documento histórico.** Este manual descreve a primeira versão do sistema, feita
> em Django com banco local e instalação própria. O sistema em uso hoje é o
> aplicativo web em `docs/`, que roda no GitHub Pages com login por conta Google.
> Veja o [README](README.md) e, dentro do próprio sistema, a tela **Guia de uso**.

Este manual explica como usar o sistema mesmo sem nunca ter tido contato com o
modelo CERNE. Ele serve para dois públicos:

- **Administrador (Gestor)** — instala, configura, cria usuários e cuida do sistema.
- **Registrador (Equipe)** — registra o dia a dia: status, evidências e métricas.

> Dica: o mesmo conteúdo está disponível dentro do sistema, na página **Manual**
> (menu superior), com links clicáveis.

---

## Sumário

1. [O que é este sistema](#1-o-que-é-este-sistema)
2. [Conceitos em 2 minutos](#2-conceitos-em-2-minutos)
3. [Perfis de acesso](#3-perfis-de-acesso)
4. [Como abrir o sistema](#4-como-abrir-o-sistema)
5. [Para o Administrador (Gestor)](#5-para-o-administrador-gestor)
6. [Para quem registra as ações (Equipe)](#6-para-quem-registra-as-ações-equipe)
7. [Exemplo preenchido](#7-exemplo-preenchido)
8. [Como acompanhar (Dashboard, Auditoria, Dossiê)](#8-como-acompanhar)
9. [Erros comuns](#9-erros-comuns)
10. [Glossário](#10-glossário)

---

## 1. O que é este sistema

O sistema ajuda o parque tecnológico a se organizar para solicitar a
**certificação CERNE 2025**. Em vez de deixar documentos espalhados, você registra
num só lugar:

- **o que já faz** (as práticas),
- **as provas disso** (evidências),
- **os números de resultado** (métricas).

Com isso, o sistema calcula automaticamente **até qual nível do CERNE (1 a 4) o
parque já está apto a solicitar** e mostra **o que ainda falta**.

> Pense nele como um "checklist inteligente": você vai preenchendo e ele mostra o
> que falta para conseguir o selo.

---

## 2. Conceitos em 2 minutos

O CERNE é um "selo de qualidade" para ambientes de inovação, organizado assim:

- **Nível (CERNE 1 a 4):** etapas de maturidade. São **acumulativas** — só se chega
  ao 2 completando o 1, e assim por diante.
- **Processo-chave:** grupo de temas dentro de um nível (ex.: *1.1 Sensibilização e
  Prospecção*).
- **Prática-chave:** a atividade concreta avaliada (ex.: *1.1.1 Sensibilização*). É
  onde você registra tudo.
- **Evidência:** a **prova** de que a prática acontece (procedimento escrito, fotos,
  planilha, contrato...).
- **Métrica:** um **número** de resultado (ex.: "150 pessoas sensibilizadas no ano").
- **Revisão crítica (aprendizado):** avaliar periodicamente se está dando certo e o
  que melhorar.

> **Analogia:** a prática é "fazer exercício"; a evidência é a "foto na academia +
> ficha de treino"; a métrica é "quantos dias treinei no mês".

---

## 3. Perfis de acesso

| Perfil | O que faz | Precisa de "Membro da equipe" (is_staff)? |
|---|---|---|
| **Gestor (Administrador)** | Tudo: cria usuários, cadastra o parque, edita catálogo e registra | Sim |
| **Equipe (Registrador)** | Registra status, evidências, medições, revisões e planos | Sim |
| **Auditor (Leitura)** | Só visualiza dashboard, auditoria e dossiê | Não |

**Por que perfis?** Para proteger os dados: quem audita não altera nada e cada
pessoa acessa apenas o que precisa.

---

## 4. Como abrir o sistema

No computador onde o sistema está instalado, no terminal, dentro da pasta do
projeto:

```powershell
.\.venv\Scripts\Activate.ps1
python manage.py runserver
```

Abra o navegador em `http://127.0.0.1:8000` e faça login com seu usuário e senha.

> A primeira conta de administrador é criada uma única vez com
> `python manage.py createsuperuser`.

---

## 5. Para o Administrador (Gestor)

Configuração inicial (feita uma vez):

1. **Cadastrar o parque (mecanismo):** menu *Cadastrar (admin) → Mecanismos de
   inovação → Adicionar*. Informe nome, tipo (parque tecnológico), cidade/UF e o
   nível CERNE almejado. Deixe "é registro de exemplo" **desmarcado**.
2. **Criar os perfis:** os grupos *Gestor*, *Equipe* e *Auditor* já vêm prontos. Se
   precisar recriá-los, rode `python manage.py criar_perfis`.
3. **Criar usuários:** *admin → Usuários → Adicionar*. Defina usuário e senha e, na
   edição do usuário:
   - adicione a pessoa ao **grupo** correto (Gestor / Equipe / Auditor);
   - para quem vai **editar** (Gestor/Equipe), marque **"Membro da equipe" (is_staff)**;
   - Auditor **não** precisa de "Membro da equipe".
4. **Backup:** guarde cópias periódicas do arquivo `db.sqlite3` e da pasta `media/`
   (onde ficam os arquivos de evidência).

---

## 6. Para quem registra as ações (Equipe)

O trabalho é **abrir uma prática e preencher**. Passo a passo:

1. No topo, selecione o **mecanismo** (seu parque).
2. Vá em **Catálogo** e clique numa prática (comece pelo **CERNE 1**).
3. Leia o quadro **"Como preencher esta prática"** e siga abaixo.

### 6.1 Definir o status da prática

| Campo | O que preencher | Por que importa |
|---|---|---|
| **Situação** | Não iniciada · Em andamento · Implantada · Em revisão | Só práticas **Implantadas** contam para a prontidão |
| **Percentual** | 0 a 100 (estimativa de avanço) | Mostra o progresso parcial |
| **Observações** | Notas internas (opcional) | Contexto para a equipe |

### 6.2 Anexar uma evidência

Cada evidência é uma **prova**. Campos:

| Campo | Exemplo | Por que importa |
|---|---|---|
| **Título** | "Procedimento de sensibilização 2024" | Nome claro para achar depois |
| **Requisito atendido** | escolha o item da lista | **Essencial:** marca o requisito como cumprido no radar |
| **Arquivo** ou **Link** | PDF, foto, planilha — ou link do Drive | É a prova em si |
| **Data de referência** | data a que a prova se refere | Mostra atualidade e dá rastreabilidade |
| **Responsável** | quem fez/possui a evidência | Auditoria: quem responde por aquilo |
| **Descrição** | 1–2 linhas explicando a prova | Ajuda o auditor a entender rápido |

> **Sempre** escolha o **Requisito atendido**. Uma evidência sem requisito vinculado
> não "marca o quadradinho" da prontidão.

### 6.3 Registrar uma medição de métrica

Informe o **valor** (número) e a **data**. Exemplo: métrica "pessoas sensibilizadas"
→ valor **150**, data 20/12/2024. Registre novamente a cada período para ter
histórico e comparar com a **meta**.

### 6.4 Revisão crítica e plano de ação

Periodicamente, registre uma **revisão crítica** (avalie eficiência, eficácia e
efetividade) e, se algo precisa melhorar, crie um **plano de ação** com responsável
e prazo. O CERNE 2025 valoriza esse ciclo de melhoria contínua.

---

## 7. Exemplo preenchido

**Prática 1.1.1 — Sensibilização**

- **Situação:** Implantada · **Percentual:** 100%
- **Evidências anexadas:**
  - "Procedimento de sensibilização" (requisito: *Procedimento...*) — PDF, 10/01/2024, resp. Coordenação.
  - "Fotos e lista de presença da palestra na UFLA" (requisito: *Registros das ações...*) — 15/03/2024.
  - "Plano de ações de sensibilização 2024" (requisito: *Plano...*) — 05/01/2024.
- **Métrica:** Pessoas sensibilizadas = **150** (20/12/2024).
- **Revisão crítica:** "Boa adesão; ampliar para cidades vizinhas em 2025" → plano de ação criado.

Resultado: a prática aparece como **Completa** e contribui para a prontidão do CERNE 1.

---

## 8. Como acompanhar

- **Dashboard:** o **radar** mostra até qual CERNE você está apto e o que falta para
  o próximo nível.
- **Auditoria:** lista, prática por prática, o que está completo e o que falta.
- **Dossiê:** documento consolidado por nível, com botão **Imprimir / Salvar PDF**,
  pronto para entregar à equipe certificadora.

---

## 9. Erros comuns

- Anexar evidência **sem vincular ao requisito** → o radar não conta.
- Marcar a prática como **Implantada** sem anexar as evidências obrigatórias.
- Definir métrica obrigatória e **não lançar nenhuma medição**.
- Usar o mecanismo **(EXEMPLO)** para dados reais — crie o seu próprio e desmarque
  "é registro de exemplo".

---

## 10. Glossário

- **Mecanismo de inovação:** termo do CERNE para incubadoras, parques, aceleradoras
  (aqui, o seu parque tecnológico).
- **Nível de maturidade (CERNE 1–4):** etapas acumulativas de certificação.
- **Processo-chave:** grupo de práticas dentro de um nível (ex.: 1.1).
- **Prática-chave:** unidade avaliada (ex.: 1.1.1 Sensibilização).
- **Evidência:** procedimento, registro ou plano que comprova a prática.
- **Métrica:** número que mede o resultado; pode ter **meta**.
- **Prontidão / Radar:** cálculo automático de até qual CERNE o parque está apto a
  solicitar.
- **Dossiê:** documento consolidado por nível para a auditoria da certificação.

---

*Sistema interno de acompanhamento da certificação CERNE 2025. Para orientações de
preenchimento específicas de cada prática, veja a página "Como preencher" e o quadro
"Como preencher esta prática" dentro de cada prática.*
