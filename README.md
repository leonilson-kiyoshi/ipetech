# Acompanhamento CERNE — IpêTech

Sistema de acompanhamento da implantação do modelo **CERNE** (Centro de Referência para
Apoio a Novos Empreendimentos) no **IpêTech — Parque Tecnológico dos Ipês**
(UFLA, Câmpus Paraíso, São Sebastião do Paraíso/MG).

Registra as práticas-chave, as evidências com os arquivos de comprovação, as métricas
com metas, as revisões críticas, os planos de ação e os empreendimentos — e monta o
**dossiê de certificação** para a auditoria.

**Endereço do sistema:** <https://leonilson-kiyoshi.github.io/ipetech/>

---

## Como está montado

O sistema é um aplicativo **estático** servido pelo GitHub Pages, com os dados no
Firebase. Não existe servidor de aplicação para manter.

| Peça | Onde | Para quê |
|---|---|---|
| Interface | GitHub Pages (pasta `docs/`) | as telas |
| Login | Firebase Authentication (conta Google) | identificar a pessoa |
| Dados | Cloud Firestore (São Paulo) | registros compartilhados pela equipe |
| Anexos | Firebase Storage (São Paulo) | os arquivos de evidência |
| Permissões | `docs/firestore.rules` e `docs/storage.rules` | aplicadas pelo servidor do Google |

A consequência prática: toda a equipe vê o mesmo acompanhamento, atualizado na hora, e
cada registro guarda quem fez e quando. Isso é o que dá rastreabilidade ao dossiê.

### Dois modos, o mesmo código

| | `index.html` — com login | `local.html` — offline |
|---|---|---|
| Dados | Firestore, compartilhados | só naquele navegador |
| Login por pessoa | sim, conta Google | não |
| Anexar arquivo | sim, vai para o Storage | não, apenas link |
| Quem fez o quê | registrado | não |
| Precisa de internet | sim | não |
| Para quê | o trabalho real do parque | demonstração, treinamento, campo |

As telas são as mesmas nos dois modos. O que muda é de onde vêm os dados: `store.js`
(navegador) ou `nuvem.js` (Firestore). A **regra de prontidão** mora em um só lugar,
`docs/js/regras.js`, usada pelos dois — de propósito: se divergisse, o sistema poderia
dizer que o parque está apto quando não está.

---

## Dar acesso a uma pessoa

Quem faz isso é o gestor, dentro do sistema: **Equipe → Liberar acesso**. Informe o
e-mail da **conta Google** dela e escolha o papel. Pode ser feito antes do primeiro
acesso: quando a pessoa entrar, já funciona.

| Papel | Pode fazer |
|---|---|
| **Gestor** | tudo, inclusive configurar o parque e gerenciar esta lista |
| **Equipe** | registrar ações, evidências, métricas e empreendimentos |
| **Consulta** | somente visualizar e gerar o dossiê |

Quem fizer login sem estar liberado entra, mas não lê nenhum dado do parque: vê a tela
de "acesso não liberado".

O gestor tem ainda **Ver o sistema como**, na mesma tela, para conferir o que a equipe e
a auditoria enxergam sem precisar de uma segunda conta. É simulação de interface: não
reduz a permissão no servidor, e recarregar a página devolve o papel de gestor.

---

## Onde ficam os anexos

No Firebase Storage, organizados por nível, prática e ano:

```
evidencias/CERNE1/1.1.1/2026/lista-de-presenca.pdf
```

A estrutura é intencional: quem auditar encontra os documentos na mesma ordem em que a
certificação pede. Nenhum anexo é público — para abrir um arquivo é preciso estar
logado e autorizado, e é o servidor do Google que verifica isso.

---

## Publicar as regras de segurança

**As regras são o que protege os dados.** Não são verificação do navegador: mesmo que
alguém altere o JavaScript da página ou chame a API direto, o Firestore e o Storage
recusam o que não estiver liberado nelas.

Elas vivem neste repositório e são publicadas pelo console, uma vez e a cada alteração:

1. Abra `docs/firestore.rules`, copie todo o conteúdo, cole em
   **Console do Firebase → Firestore → Regras** e clique em **Publicar**.
2. Abra `docs/storage.rules`, copie, cole em
   **Console do Firebase → Storage → Regras** e **Publicar**.

São duas abas diferentes: publicar uma não publica a outra.

O **gestor raiz** está fixado nos dois arquivos pelo e-mail. Ele já nasce autorizado e é
quem libera as outras pessoas — existe para resolver o primeiro acesso, quando ainda não
há lista de autorizados. Para trocar o responsável, altere o e-mail nos dois arquivos e
publique de novo.

### Sobre o `firebase-config.js`

O arquivo `docs/js/firebase-config.js` tem a identificação pública do projeto Firebase
(`apiKey`, `appId`, `projectId`). **Isso não é segredo** — em aplicativos web esses
valores são sempre visíveis no navegador, e servem para endereçar o projeto, não para
autenticar. Quem protege os dados são três coisas:

1. o login obrigatório (conta Google);
2. as regras do Firestore e do Storage;
3. a lista de **domínios autorizados** em *Authentication → Configurações*, que impede
   outro site de usar este projeto.

---

## Backup

Em **Dados e backup → Exportar backup (.json)**. Os dados já estão guardados na nuvem do
Google; o backup é a cópia fora dele e o retrato do acompanhamento numa data — útil
antes de uma auditoria.

Os anexos não entram no `.json`. Para uma cópia completa, exporte o backup **e** baixe os
arquivos do bucket.

---

## Custo

O projeto está no plano **Blaze** (pago por uso), exigido para o Storage. O volume deste
sistema cabe com folga na franquia gratuita mensal do Firestore e do Storage, então o
valor esperado é próximo de zero.

Mesmo assim, deixe um **orçamento com alerta** configurado em *Google Cloud → Faturamento
→ Orçamentos e alertas*. Alerta avisa; não impede cobrança.

---

## Desenvolvimento

### Rodar localmente

A pasta `docs/` é estática, mas o modo com login precisa ser servido por HTTP (módulos
JavaScript não carregam por `file://`):

```powershell
cd docs
python -m http.server 8080 --bind 127.0.0.1
```

Acesse <http://127.0.0.1:8080/>. Para o modo offline, basta abrir `docs/local.html`
com dois cliques.

> O endereço `127.0.0.1` já está nos domínios autorizados do Firebase por padrão.

### Testes

```powershell
node testes/teste_prontidao_web.js
node testes/teste_telas_web.js
```

O primeiro confere a regra de prontidão. O segundo renderiza todas as telas em um DOM
simulado — inclusive os casos que já quebraram antes e não podem voltar: desenhar antes
do login terminar, o progresso por nível em HTML (e não em SVG, que escalava a fonte),
os textos de ajuda coerentes com o modo, e a faixa de saída do "ver o sistema como".

### Cache do navegador

Os arquivos em `index.html` são carregados com `?v=N`. **Ao publicar uma correção,
aumente esse número**, senão o navegador reaproveita a versão guardada e a correção não
aparece.

### Regra de prontidão

Uma prática só conta como **completa** quando:

1. está marcada como **Implantada**;
2. todos os **requisitos de evidência obrigatórios** têm ao menos uma evidência;
3. todas as **métricas obrigatórias** têm ao menos uma medição.

O modelo é acumulativo: o parque está apto ao **CERNE N** quando os níveis 1 a N estão
100% completos.

Evidência registrada como "outra evidência do parque" (material próprio, fora dos
requisitos do modelo) aparece no dossiê mas **não** entra nessa conta. A certificação é
avaliada pelos requisitos do CERNE; se material próprio contasse, o sistema diria que o
parque está apto quando não está.

### Estrutura

```
docs/                     o sistema (é o que o GitHub Pages publica)
├── index.html            modo com login (Firebase)
├── local.html            modo offline
├── firestore.rules       permissões dos dados
├── storage.rules         permissões dos anexos
├── css/app.css
└── js/
    ├── regras.js         catálogo + regra de prontidão (fonte única)
    ├── store.js          dados no navegador (modo offline)
    ├── nuvem.js          login, Firestore e Storage (modo com login)
    ├── app.js            telas e navegação
    ├── firebase-config.js
    └── dados-cerne.js    catálogo CERNE (gerado — não edite à mão)

testes/                   testes do aplicativo web
catalogo/ acompanhamento/ config/   projeto Django (legado, veja abaixo)
```

---

## Versão Django (legado)

A primeira versão deste sistema era um projeto Django com banco próprio. Ela foi
substituída pelo aplicativo acima, que não precisa de servidor, mas continua no
repositório por dois motivos:

1. **Gera o catálogo CERNE.** Os níveis, processos, práticas, requisitos e métricas são
   dados do Django, e o arquivo `docs/js/dados-cerne.js` é exportado dele:

   ```powershell
   py -3.11 -m venv .venv
   .\.venv\Scripts\python.exe -m pip install -r requirements.txt
   .\.venv\Scripts\python.exe manage.py migrate
   .\.venv\Scripts\python.exe manage.py seed_cerne
   .\.venv\Scripts\python.exe manage.py exportar_web
   ```

2. **Histórico.** Formulários, dossiê em PDF e testes já escritos, úteis como referência.

O Django **não** roda no GitHub Pages, e não é mais o caminho de uso. As situações e
estágios de empreendimento adicionados depois da migração (empresa *residente*, estágio
*consolidada*, campo *local de instalação*) existem só no aplicativo web.

Para rodá-lo, copie `.env.example` para `.env` e preencha. Sem nenhuma variável
definida, ele sobe com SQLite e `DEBUG` ligado, o que serve para desenvolvimento.

---

## Sobre os PDFs do CERNE

Os PDFs da metodologia (manuais e termos de referência da ANPROTEC) ficam nesta pasta
para consulta, mas **não são versionados** — estão no `.gitignore`. São material de
terceiros, e republicá-los em repositório público seria risco de licenciamento. São
também cerca de 46 MB, contra pouco mais de 1 MB do sistema inteiro.

O sistema não depende deles: o catálogo CERNE está em `docs/js/dados-cerne.js`.
