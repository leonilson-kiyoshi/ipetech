# -*- coding: utf-8 -*-
"""Dados de carga do catálogo CERNE 2025.

Estrutura completa: 4 níveis, 12 processos-chave e 29 práticas-chave, com
descrições, objetivos, orientações de preenchimento, métricas (com a métrica
oficial de cada prática marcada como obrigatória) e requisitos de evidência,
fiéis ao Termo de Referência e ao Manual de Implantação 2025 (Anprotec/Sebrae).

Sobre as métricas:
  - `obrigatoria=True`  → métrica indicada oficialmente para a prática.
  - `obrigatoria=False` → sugestão adicional (não bloqueia o radar de prontidão).

O comando `seed_cerne` é idempotente: re-execute a cada enriquecimento.
"""

# Bloco de evidências padrão que se repete ao final de quase toda prática.
_EV_RESULTADOS = {
    "descricao": "Registro dos resultados obtidos, utilizando a(s) métrica(s) estabelecida(s).",
    "exemplo": "Tabela/painel com o valor da métrica no período.",
}
_EV_EFETIVIDADE = {
    "descricao": "Registros da avaliação da efetividade das ações, com plano de melhoria quando necessário.",
    "exemplo": "Ata de revisão crítica com decisões e plano de ação.",
}

CERNE_2025 = {
    "versao": {
        "nome": "CERNE 2025",
        "ano": 2025,
        "descricao": (
            "Centro de Referência para Apoio a Novos Empreendimentos — versão "
            "2025. Modelo de maturidade da capacidade do mecanismo de inovação "
            "em gerar, sistematicamente, empreendimentos inovadores bem-sucedidos."
        ),
    },
    "niveis": [
        {
            "numero": 1,
            "nome": "Empreendimento",
            "descricao": (
                "Processos e práticas diretamente relacionados ao desenvolvimento "
                "dos empreendimentos, da sensibilização, prospecção e seleção até a "
                "graduação e o relacionamento com as graduadas, além de uma "
                "estrutura mínima de gestão."
            ),
            "processos": [
                {
                    "codigo": "1.1",
                    "nome": "Sensibilização e Prospecção",
                    "descricao": (
                        "Processo documentado e contínuo para sensibilizar a "
                        "comunidade quanto ao empreendedorismo e à inovação e para "
                        "prospectar ativamente novos empreendimentos inovadores."
                    ),
                    "praticas": [
                        {
                            "codigo": "1.1.1",
                            "nome": "Sensibilização",
                            "descricao": (
                                "Execução de ações que promovam a difusão do "
                                "empreendedorismo e da inovação, estimulando "
                                "potenciais empreendedores a criarem e submeterem "
                                "propostas ao mecanismo de inovação."
                            ),
                            "objetivo": (
                                "Estimular a cultura de empreendedorismo e inovação "
                                "no território, a fim de ampliar, gradativamente, a "
                                "quantidade e a qualidade das propostas apresentadas."
                            ),
                            "orientacao_preenchimento": (
                                "1) Marque a situação da prática. 2) Anexe como "
                                "evidência o procedimento de sensibilização e os "
                                "registros das ações (fotos, listas de presença, "
                                "vídeos). 3) Lance a medição da métrica 'pessoas "
                                "sensibilizadas'. 4) Registre uma revisão crítica "
                                "periódica avaliando a efetividade das ações."
                            ),
                            "metricas": [
                                {
                                    "nome": "Quantidade de pessoas sensibilizadas",
                                    "unidade": "pessoas",
                                    "meta": "",
                                    "obrigatoria": True,
                                    "exemplo": "Ex.: 150 pessoas no ano de 2024",
                                },
                            ],
                            "requisitos_evidencia": [
                                {
                                    "descricao": "Procedimento explicitando como o mecanismo promove a difusão do empreendedorismo e da inovação, com o meio utilizado e o público-alvo.",
                                    "exemplo": "Documento de 1 página: público-alvo (ex.: alunos de graduação), meios (palestras, redes) e responsável.",
                                },
                                {
                                    "descricao": "Registros das ações de sensibilização (texto, gráficos, tabelas, imagens, fotos, vídeos).",
                                    "exemplo": "Fotos da palestra + lista de presença + print da divulgação.",
                                },
                                {
                                    "descricao": "Plano com as ações de sensibilização a serem realizadas nos próximos períodos.",
                                    "exemplo": "Planilha com ações, público-alvo, meio e data prevista.",
                                },
                                {
                                    "descricao": "Registros que demonstrem a execução das ações previstas (com justificativa quando não realizadas).",
                                    "exemplo": "Relatório comparando o plano x o executado.",
                                },
                                _EV_RESULTADOS,
                                _EV_EFETIVIDADE,
                            ],
                            "recomendacoes": [
                                "Priorizar ações que estimulem empreendimentos de impacto social, ambiental ou econômico e de alto crescimento.",
                                "Padronizar os conteúdos de sensibilização (apresentação, texto, vídeo).",
                                "Acompanhar por qual canal o empreendedor conheceu o mecanismo, para otimizar investimentos.",
                            ],
                        },
                        {
                            "codigo": "1.1.2",
                            "nome": "Prospecção",
                            "descricao": (
                                "Busca ativa por empreendimentos com potencial de "
                                "impacto social, ambiental ou econômico e alto "
                                "crescimento, que contribuam para o desenvolvimento "
                                "da região."
                            ),
                            "objetivo": (
                                "Ampliar a quantidade e a qualidade de propostas de "
                                "empreendimentos geradas a partir da busca ativa pela "
                                "equipe de gestão."
                            ),
                            "orientacao_preenchimento": (
                                "Documente COMO você busca ativamente novos "
                                "empreendimentos (workshops com empresas, reuniões "
                                "com grupos de pesquisa, concursos de ideias), anexe "
                                "os registros e meça quantos foram prospectados."
                            ),
                            "metricas": [
                                {
                                    "nome": "Quantidade de empreendimentos prospectados",
                                    "unidade": "empreendimentos",
                                    "obrigatoria": False,
                                    "descricao": "Sugestão — confirme a métrica oficial no Manual de Implantação.",
                                    "exemplo": "Ex.: 12 empreendimentos prospectados no ano",
                                },
                            ],
                            "requisitos_evidencia": [
                                {
                                    "descricao": "Procedimento de prospecção ativa (como e onde busca empreendimentos).",
                                    "exemplo": "Descrição das frentes: reuniões com grupos de pesquisa, concurso de ideias, canal com empresas.",
                                },
                                {
                                    "descricao": "Registros das ações de prospecção realizadas.",
                                    "exemplo": "Lista de empreendimentos contatados e origem.",
                                },
                            ],
                        },
                        {
                            "codigo": "1.1.3",
                            "nome": "Qualificação de Potenciais Empreendedores",
                            "descricao": (
                                "Ações para qualificar potenciais empreendedores, "
                                "preparando-os para gerar e submeter propostas "
                                "consistentes ao mecanismo de inovação."
                            ),
                            "orientacao_preenchimento": (
                                "Registre as ações de qualificação (cursos de modelo "
                                "e de plano de negócios, orientação para validar "
                                "ideias), anexe materiais e listas e meça quantos "
                                "potenciais empreendedores foram qualificados."
                            ),
                            "metricas": [
                                {
                                    "nome": "Quantidade de potenciais empreendedores qualificados",
                                    "unidade": "pessoas",
                                    "obrigatoria": False,
                                    "descricao": "Sugestão — confirme a métrica oficial no Manual de Implantação.",
                                    "exemplo": "Ex.: 40 pessoas qualificadas no ano",
                                },
                            ],
                        },
                    ],
                },
                {
                    "codigo": "1.2",
                    "nome": "Seleção",
                    "descricao": (
                        "Processo para recepção, avaliação e contratação de "
                        "propostas, selecionando os empreendimentos com maior "
                        "potencial e alinhados ao foco do mecanismo de inovação."
                    ),
                    "praticas": [
                        {
                            "codigo": "1.2.1",
                            "nome": "Recepção de Propostas",
                            "descricao": "Recebimento formal e protocolado das propostas de empreendimentos.",
                            "orientacao_preenchimento": (
                                "Tenha um modelo de proposta e um protocolo de "
                                "recebimento. Anexe o modelo e os registros/protocolos "
                                "das propostas recebidas."
                            ),
                            "metricas": [
                                {
                                    "nome": "Quantidade de propostas recebidas",
                                    "unidade": "propostas",
                                    "obrigatoria": False,
                                    "descricao": "Sugestão — confirme a métrica oficial no Manual de Implantação.",
                                    "exemplo": "Ex.: 30 propostas recebidas no processo",
                                },
                            ],
                            "requisitos_evidencia": [
                                {"descricao": "Modelo para apresentação de propostas.", "exemplo": "Formulário/edital de submissão."},
                                {"descricao": "Registros/protocolos das propostas encaminhadas.", "exemplo": "Planilha de protocolo com data de recebimento."},
                            ],
                        },
                        {
                            "codigo": "1.2.2",
                            "nome": "Avaliação",
                            "descricao": "Avaliação das propostas segundo critérios definidos, considerando os cinco eixos do empreendimento.",
                            "orientacao_preenchimento": (
                                "Documente os critérios de avaliação (considerando os "
                                "5 eixos) e anexe os registros das avaliações. Meça o "
                                "número de selecionados e o percentual sobre o total."
                            ),
                            "metricas": [
                                {"nome": "Número de empreendimentos selecionados em cada processo de seleção", "unidade": "empreendimentos", "obrigatoria": True, "exemplo": "Ex.: 8 selecionados no processo 2024/1"},
                                {"nome": "Percentual de empreendimentos selecionados sobre o total de propostas submetidas", "unidade": "%", "obrigatoria": True, "exemplo": "Ex.: 8 de 30 = 27%"},
                            ],
                            "requisitos_evidencia": [
                                {"descricao": "Registro das avaliações realizadas, indicando o desempenho dos empreendimentos em cada critério definido.", "exemplo": "Planilha de notas por critério + parecer da banca."},
                            ],
                        },
                        {
                            "codigo": "1.2.3",
                            "nome": "Contratação",
                            "descricao": "Formalização da relação entre o mecanismo de inovação e o empreendimento selecionado.",
                            "orientacao_preenchimento": "Anexe o modelo de contrato/termo e os contratos assinados. Registre quantos empreendimentos foram contratados.",
                            "metricas": [
                                {"nome": "Quantidade de empreendimentos contratados", "unidade": "empreendimentos", "obrigatoria": False, "descricao": "Sugestão — confirme no Manual.", "exemplo": "Ex.: 8 contratados no ano"},
                            ],
                            "requisitos_evidencia": [
                                {"descricao": "Modelo de contrato/termo de compromisso.", "exemplo": "Minuta com cláusulas de uso de marca e obrigações."},
                            ],
                        },
                    ],
                },
                {
                    "codigo": "1.3",
                    "nome": "Desenvolvimento do Empreendimento",
                    "descricao": (
                        "Planejamento, agregação de valor e monitoramento do "
                        "desenvolvimento dos empreendimentos nos cinco eixos: "
                        "empreendedor, tecnologia, capital, mercado e gestão."
                    ),
                    "praticas": [
                        {"codigo": "1.3.1", "nome": "Planejamento", "descricao": "Planejamento do desenvolvimento de cada empreendimento apoiado.", "orientacao_preenchimento": "Anexe o plano de desenvolvimento de cada empreendimento e registre o percentual de apoiados com plano.", "metricas": [{"nome": "Percentual de apoiados com plano de desenvolvimento", "unidade": "%", "obrigatoria": False, "descricao": "Sugestão — confirme no Manual.", "exemplo": "Ex.: 100% dos apoiados"}]},
                        {"codigo": "1.3.2", "nome": "Agregação de Valor", "descricao": "Oferta de serviços e apoios que agreguem valor ao desenvolvimento dos empreendimentos.", "orientacao_preenchimento": "Documente os serviços/apoios oferecidos (capacitações, mentorias, acesso a capital) e anexe os registros. Meça as atividades de agregação de valor realizadas.", "metricas": [{"nome": "Quantidade de atividades de agregação de valor", "unidade": "atividades", "obrigatoria": False, "descricao": "Sugestão — confirme no Manual.", "exemplo": "Ex.: 24 mentorias no ano"}]},
                        {"codigo": "1.3.3", "nome": "Monitoramento", "descricao": "Monitoramento sistemático da evolução dos empreendimentos apoiados.", "orientacao_preenchimento": "Registre como monitora a evolução dos empreendimentos (indicadores, reuniões) e anexe os registros. Meça o percentual monitorado no período.", "metricas": [{"nome": "Percentual de empreendimentos monitorados no período", "unidade": "%", "obrigatoria": False, "descricao": "Sugestão — confirme no Manual.", "exemplo": "Ex.: 100% a cada trimestre"}]},
                    ],
                },
                {
                    "codigo": "1.4",
                    "nome": "Graduação e Relacionamento com as Graduadas",
                    "descricao": "Processo para graduação dos empreendimentos e manutenção do relacionamento com as empresas graduadas.",
                    "praticas": [
                        {"codigo": "1.4.1", "nome": "Graduação", "descricao": "Processo de graduação dos empreendimentos que atingem os critérios definidos.", "orientacao_preenchimento": "Documente os critérios e o processo de graduação. Anexe registros das graduações e meça quantos empreendimentos graduaram.", "metricas": [{"nome": "Quantidade de empreendimentos graduados", "unidade": "empreendimentos", "obrigatoria": False, "descricao": "Sugestão — confirme no Manual.", "exemplo": "Ex.: 5 graduados no ano"}]},
                        {"codigo": "1.4.2", "nome": "Relacionamento com Graduadas", "descricao": "Manutenção do relacionamento com as empresas graduadas.", "orientacao_preenchimento": "Registre as ações de relacionamento com graduadas (eventos, pesquisas de acompanhamento) e meça quantas mantêm relacionamento ativo.", "metricas": [{"nome": "Quantidade de graduadas com relacionamento ativo", "unidade": "empresas", "obrigatoria": False, "descricao": "Sugestão — confirme no Manual.", "exemplo": "Ex.: 10 graduadas ativas"}]},
                    ],
                },
                {
                    "codigo": "1.5",
                    "nome": "Gerenciamento Básico",
                    "descricao": (
                        "Estrutura mínima de gestão do mecanismo de inovação: "
                        "estrutura organizacional, gestão da operação e comunicação "
                        "e marketing."
                    ),
                    "praticas": [
                        {"codigo": "1.5.1", "nome": "Estrutura Organizacional", "descricao": "Definição da estrutura organizacional do mecanismo de inovação.", "orientacao_preenchimento": "Anexe o organograma e a descrição de papéis e responsabilidades da equipe."},
                        {"codigo": "1.5.2", "nome": "Gestão do Mecanismo de Inovação", "descricao": "Gestão da operação do mecanismo de inovação.", "orientacao_preenchimento": "Documente os procedimentos de operação e gestão (rotinas, controles, indicadores) e anexe os registros."},
                        {"codigo": "1.5.3", "nome": "Comunicação e Marketing", "descricao": "Ações de comunicação e marketing do mecanismo de inovação.", "orientacao_preenchimento": "Registre o plano e as ações de comunicação/marketing e anexe exemplos (site, redes sociais, materiais).", "metricas": [{"nome": "Quantidade de ações de comunicação", "unidade": "ações", "obrigatoria": False, "descricao": "Sugestão — confirme no Manual.", "exemplo": "Ex.: 48 posts + 4 releases no ano"}]},
                    ],
                },
            ],
        },
        {
            "numero": 2,
            "nome": "Mecanismo de Inovação",
            "descricao": (
                "Estruturação da governança do mecanismo de inovação, implantando "
                "processos que viabilizem a gestão estratégica, a ampliação dos "
                "serviços e do público-alvo e a avaliação dos resultados e impactos."
            ),
            "processos": [
                {
                    "codigo": "2.1",
                    "nome": "Gestão Estratégica",
                    "descricao": "Processo sistemático e documentado de governança que viabilize o planejamento e a administração estratégica, estruturando e acompanhando identidade, objetivos, ações e metas.",
                    "praticas": [
                        {
                            "codigo": "2.1.1", "nome": "Planejamento Estratégico",
                            "descricao": "Processo sistemático e documentado que estabelece o propósito, a identidade organizacional, os objetivos, as ações e as metas do mecanismo de inovação.",
                            "objetivo": "Viabilizar a efetividade (eficiência e eficácia) das ações realizadas em direção ao alcance das metas para a realização da visão de futuro do mecanismo de inovação.",
                            "orientacao_preenchimento": "Anexe o planejamento estratégico documentado (propósito, identidade, objetivos, ações e metas) e a estrutura de governança. Meça o percentual de membros da governança/parceiros que participaram da elaboração.",
                            "metricas": [{"nome": "Percentual de membros da governança e parceiros que participaram da elaboração do planejamento estratégico", "unidade": "%", "obrigatoria": True, "exemplo": "Ex.: 80% da governança participou"}],
                            "requisitos_evidencia": [
                                {"descricao": "Procedimento explicitando como o mecanismo realiza seu planejamento estratégico.", "exemplo": "Fluxo/roteiro do processo de planejamento."},
                                {"descricao": "Planejamento estratégico do mecanismo de inovação.", "exemplo": "Documento com propósito, identidade, objetivos, ações e metas."},
                                {"descricao": "Documento que demonstre a estrutura da governança do mecanismo de inovação.", "exemplo": "Organograma da governança / regimento."},
                                {"descricao": "Registros da participação dos stakeholders na elaboração do planejamento estratégico.", "exemplo": "Lista de presença e atas das oficinas de planejamento."},
                                _EV_RESULTADOS, _EV_EFETIVIDADE,
                            ],
                        },
                        {
                            "codigo": "2.1.2", "nome": "Administração Estratégica",
                            "descricao": "Processo sistemático e documentado de administração da estratégia, monitorando a agenda de ações e metas e gerenciando instrumentos e equipe.",
                            "objetivo": "Gerenciar a execução do planejamento estratégico a fim de garantir a assertividade, rapidez e maximização dos recursos para a realização da visão de futuro.",
                            "orientacao_preenchimento": "Registre o acompanhamento do previsto x realizado (reuniões, painel) e anexe os relatórios. Meça o percentual de ações previstas realizadas com êxito.",
                            "metricas": [{"nome": "Percentual das ações previstas no planejamento estratégico realizadas com êxito", "unidade": "%", "obrigatoria": True, "exemplo": "Ex.: 70% das ações concluídas no ano"}],
                            "requisitos_evidencia": [
                                {"descricao": "Procedimento explicitando como o mecanismo realiza a administração estratégica.", "exemplo": "Rotina de reuniões de acompanhamento da estratégia."},
                                {"descricao": "Registros que demonstrem a execução das ações de administração estratégica.", "exemplo": "Atas de reuniões e painel de acompanhamento (previsto x realizado)."},
                                _EV_RESULTADOS, _EV_EFETIVIDADE,
                            ],
                        },
                    ],
                },
                {
                    "codigo": "2.2",
                    "nome": "Ampliação de Limites",
                    "descricao": "Ações sistemáticas e formais para ampliar o público-alvo e/ou os serviços prestados pelo mecanismo de inovação.",
                    "praticas": [
                        {
                            "codigo": "2.2.1", "nome": "Estímulo à Ideação",
                            "descricao": "Processo sistemático para estimular a operação de ambientes de networking e compartilhamento de conhecimentos para a geração de novas ideias.",
                            "objetivo": "Estimular a interação entre pessoas interessadas em criar negócios, visando a geração de novos empreendimentos inovadores e a difusão do empreendedorismo na região.",
                            "orientacao_preenchimento": "Documente como estimula o networking/ideação e anexe registros dos ambientes em operação. Meça o número de ambientes de ideação em parceria.",
                            "metricas": [{"nome": "Número de ambientes de ideação que atuam em parceria com o mecanismo de inovação", "unidade": "ambientes", "obrigatoria": True, "exemplo": "Ex.: 3 ambientes (laboratório de ideias, coworking parceiro, sala de criatividade)"}],
                            "requisitos_evidencia": [
                                {"descricao": "Procedimento explicitando como o mecanismo estimula o networking e o compartilhamento de conhecimentos para a geração de novas ideias.", "exemplo": "Descrição dos ambientes e da dinâmica de ideação."},
                                {"descricao": "Registros que demonstrem que ambientes de interação estão em operação.", "exemplo": "Fotos/agenda dos laboratórios de ideias e eventos."},
                                _EV_RESULTADOS, _EV_EFETIVIDADE,
                            ],
                        },
                        {
                            "codigo": "2.2.2", "nome": "Serviços a Organizações",
                            "descricao": "Processo sistemático para prestação de serviços a organizações, utilizando o know-how do mecanismo de inovação e/ou da rede de parceiros.",
                            "objetivo": "Fortalecer a imagem e ampliar as fontes de receitas próprias do mecanismo de inovação.",
                            "orientacao_preenchimento": "Anexe o portfólio de serviços e os registros dos serviços prestados. Meça a receita total (financeira ou econômica) com serviços a organizações.",
                            "metricas": [{"nome": "Receita total (financeira ou econômica) com serviços executados para organizações públicas e privadas", "unidade": "R$", "obrigatoria": True, "exemplo": "Ex.: R$ 120.000 no ano"}],
                            "requisitos_evidencia": [
                                {"descricao": "Procedimento explicitando como o mecanismo presta serviços a organizações.", "exemplo": "Fluxo de contratação e execução de serviços."},
                                {"descricao": "Portfólio de serviços a serem oferecidos às organizações.", "exemplo": "Catálogo de serviços (open innovation, laboratórios, P&D)."},
                                {"descricao": "Registros dos serviços prestados.", "exemplo": "Contratos/ordens de serviço executadas."},
                                _EV_RESULTADOS, _EV_EFETIVIDADE,
                            ],
                        },
                    ],
                },
                {
                    "codigo": "2.3",
                    "nome": "Avaliação do Mecanismo de Inovação",
                    "descricao": "Ações sistemáticas e formais para a avaliação dos resultados e impactos do mecanismo de inovação.",
                    "praticas": [
                        {
                            "codigo": "2.3.1", "nome": "Avaliação da Qualidade",
                            "descricao": "Processo sistemático de avaliação da qualidade dos empreendimentos apoiados.",
                            "objetivo": "Demonstrar a qualidade dos empreendimentos apoiados e/ou graduados.",
                            "orientacao_preenchimento": "Documente como avalia a qualidade dos empreendimentos, anexe o plano e os registros das avaliações. Meça prêmios, editais e aportes obtidos.",
                            "metricas": [
                                {"nome": "Número de prêmios associados à inovação recebidos pelos empreendimentos apoiados e/ou graduados", "unidade": "prêmios", "obrigatoria": True, "exemplo": "Ex.: 2 prêmios no ano"},
                                {"nome": "Número de empreendimentos contemplados por editais de inovação", "unidade": "empreendimentos", "obrigatoria": True, "exemplo": "Ex.: 4 empreendimentos"},
                                {"nome": "Número de empreendimentos que receberam aporte de capital", "unidade": "empreendimentos", "obrigatoria": True, "exemplo": "Ex.: 3 empreendimentos"},
                            ],
                            "requisitos_evidencia": [
                                {"descricao": "Procedimento explicitando como o mecanismo avalia a qualidade dos empreendimentos apoiados.", "exemplo": "Método e critérios de avaliação da qualidade."},
                                {"descricao": "Plano contendo as avaliações da qualidade que serão realizadas ao longo do período.", "exemplo": "Cronograma de avaliações."},
                                {"descricao": "Registros das avaliações realizadas (critérios, especialistas responsáveis e resultados).", "exemplo": "Relatórios de avaliação assinados."},
                                _EV_RESULTADOS, _EV_EFETIVIDADE,
                            ],
                        },
                        {
                            "codigo": "2.3.2", "nome": "Avaliação dos Impactos",
                            "descricao": "Processo sistemático de avaliação dos impactos da atuação do mecanismo de inovação sobre o desenvolvimento da região.",
                            "objetivo": "Posicionar o mecanismo de inovação como instrumento efetivo de desenvolvimento do Ecossistema de Inovação.",
                            "orientacao_preenchimento": "Defina indicadores de impacto na região, anexe o relatório de impactos e divulgue-o. Meça o número de pessoas que tiveram acesso ao relatório.",
                            "metricas": [{"nome": "Número de pessoas que tiveram acesso ao relatório dos impactos gerados pelo mecanismo sobre o desenvolvimento da região", "unidade": "pessoas", "obrigatoria": True, "exemplo": "Ex.: 500 acessos ao relatório publicado"}],
                            "requisitos_evidencia": [
                                {"descricao": "Procedimento explicitando como o mecanismo avalia os efeitos da sua operação sobre o desenvolvimento da região.", "exemplo": "Metodologia e indicadores de impacto."},
                                {"descricao": "Registros com os resultados das avaliações de impacto realizadas com base nos indicadores propostos.", "exemplo": "Relatório de impactos (empregos, faturamento, impostos)."},
                                _EV_RESULTADOS, _EV_EFETIVIDADE,
                            ],
                        },
                    ],
                },
            ],
        },
        {
            "numero": 3,
            "nome": "Rede de Parceiros",
            "descricao": (
                "Formalização de uma rede de parceiros para ampliar a atuação do "
                "mecanismo de inovação, reforçando sua atuação como um dos 'nós' da "
                "rede de atores da promoção da inovação."
            ),
            "processos": [
                {
                    "codigo": "3.1",
                    "nome": "Relacionamento Institucional",
                    "descricao": "Ações sistemáticas e documentadas sobre o posicionamento do mecanismo como agente proativo em uma rede de atores para a proposição de políticas públicas de empreendedorismo e inovação.",
                    "praticas": [
                        {
                            "codigo": "3.1.1", "nome": "Interação com o Entorno",
                            "descricao": "Processo sistemático de interação do mecanismo de inovação com os atores do ecossistema de inovação da região.",
                            "objetivo": "Ampliar o reconhecimento do mecanismo de inovação, pelos atores do Ecossistema de Inovação da região, como um ator ativo no apoio à geração de empreendimentos inovadores.",
                            "orientacao_preenchimento": "Registre as parcerias e projetos com atores do ecossistema e anexe acordos/registros. Meça o número de projetos executados em parceria.",
                            "metricas": [{"nome": "Número de projetos executados em parceria com os atores do ecossistema de inovação da região", "unidade": "projetos", "obrigatoria": True, "exemplo": "Ex.: 5 projetos em parceria no ano"}],
                            "requisitos_evidencia": [
                                {"descricao": "Procedimento explicitando como o mecanismo realiza a interação com os demais atores do Ecossistema de Inovação.", "exemplo": "Estratégia de parcerias institucionais."},
                                {"descricao": "Registros dos resultados das interações com os demais atores do Ecossistema de Inovação.", "exemplo": "Convênios/termos de parceria e resultados dos projetos."},
                                _EV_RESULTADOS, _EV_EFETIVIDADE,
                            ],
                        },
                        {
                            "codigo": "3.1.2", "nome": "Participação na Proposição de Políticas Públicas",
                            "descricao": "Participação planejada do mecanismo de inovação em fóruns que propõem políticas públicas de empreendedorismo e inovação.",
                            "objetivo": "Ampliar a participação do mecanismo de inovação no processo de definição de políticas públicas voltadas para a promoção do empreendedorismo e da inovação.",
                            "orientacao_preenchimento": "Registre a participação em fóruns e as proposições apresentadas; anexe convites/atas. Meça o número de fóruns e de proposições.",
                            "metricas": [
                                {"nome": "Número de fóruns dos quais o mecanismo de inovação participa", "unidade": "fóruns", "obrigatoria": True, "exemplo": "Ex.: 3 fóruns"},
                                {"nome": "Número de proposições apresentadas nos fóruns", "unidade": "proposições", "obrigatoria": True, "exemplo": "Ex.: 5 proposições no ano"},
                            ],
                            "requisitos_evidencia": [
                                {"descricao": "Procedimento explicitando como o mecanismo participa de fóruns voltados à proposição de políticas públicas.", "exemplo": "Plano de participação em fóruns."},
                                {"descricao": "Registros que demonstrem a participação do mecanismo nos fóruns.", "exemplo": "Convites, atas e listas de presença."},
                                {"descricao": "Registros de proposições feitas nos fóruns de políticas públicas.", "exemplo": "Documentos das propostas encaminhadas."},
                                _EV_RESULTADOS, _EV_EFETIVIDADE,
                            ],
                        },
                    ],
                },
                {
                    "codigo": "3.2",
                    "nome": "Desenvolvimento em Rede",
                    "descricao": "Ações sistemáticas e documentadas para ampliar os limites de atuação por meio de uma rede de atores com interesses comuns, compartilhando competências e recursos.",
                    "praticas": [
                        {
                            "codigo": "3.2.1", "nome": "Rede de Apoio aos Empreendimentos",
                            "descricao": "Processo sistemático e documentado para operar uma rede de apoio formada por profissionais e instituições que orientam o desenvolvimento dos empreendimentos.",
                            "objetivo": "Aumentar a taxa de sucesso dos empreendimentos apoiados.",
                            "orientacao_preenchimento": "Documente a rede de mentores/instituições e anexe registros da atuação. Meça o % de empresas com profissional apoiador e o nº de parceiros no banco.",
                            "metricas": [
                                {"nome": "Percentual de empresas que possuem um profissional apoiador", "unidade": "%", "obrigatoria": True, "exemplo": "Ex.: 60% das apoiadas"},
                                {"nome": "Número de profissionais e instituições apoiadores no banco de parceiros", "unidade": "parceiros", "obrigatoria": True, "exemplo": "Ex.: 25 no banco de parceiros"},
                            ],
                            "requisitos_evidencia": [
                                {"descricao": "Procedimento explicitando como o mecanismo cria e opera sua rede de apoio e instituições parceiras.", "exemplo": "Regras de credenciamento de mentores."},
                                {"descricao": "Registros que demonstrem a execução do apoio aos empreendedores.", "exemplo": "Agendas de mentoria realizadas."},
                                {"descricao": "Registros da relação entre o mecanismo e os profissionais especializados/instituições parceiras.", "exemplo": "Banco de mentores/parceiros e termos."},
                                _EV_RESULTADOS, _EV_EFETIVIDADE,
                            ],
                        },
                        {
                            "codigo": "3.2.2", "nome": "Gestão de Oferta e Demanda",
                            "descricao": "Processo sistemático e documentado para aproximar oferta e demanda, apoiando a inovação aberta em empresas estabelecidas.",
                            "objetivo": "Facilitar o acesso ao mercado por parte dos empreendimentos apoiados e graduados.",
                            "orientacao_preenchimento": "Registre os projetos de conexão entre oferta e demanda (inovação aberta) e anexe registros. Meça o nº de projetos e de empreendimentos participantes.",
                            "metricas": [
                                {"nome": "Número de projetos de conexão entre oferta e demanda realizados", "unidade": "projetos", "obrigatoria": True, "exemplo": "Ex.: 4 projetos de inovação aberta"},
                                {"nome": "Número de empreendimentos apoiados e graduados que participaram de projetos de conexão entre oferta e demanda", "unidade": "empreendimentos", "obrigatoria": True, "exemplo": "Ex.: 9 empreendimentos"},
                            ],
                            "requisitos_evidencia": [
                                {"descricao": "Procedimento explicitando como o mecanismo realiza a conexão entre oferta e demanda.", "exemplo": "Fluxo de matchmaking / inovação aberta."},
                                {"descricao": "Registros que demonstrem a execução das ações de gestão de ofertas e demandas.", "exemplo": "Relatórios dos projetos de conexão."},
                                _EV_RESULTADOS, _EV_EFETIVIDADE,
                            ],
                        },
                        {
                            "codigo": "3.2.3", "nome": "Expansão da Atuação Territorial",
                            "descricao": "Metodologia definida de expansão da atuação territorial para ampliar o número de empreendimentos apoiados.",
                            "objetivo": "Ampliar o número de empreendimentos apoiados que estejam instalados fora da região do mecanismo de inovação.",
                            "orientacao_preenchimento": "Anexe a metodologia de expansão territorial e os registros de apoio a empreendimentos de fora da região. Meça o nº desses empreendimentos.",
                            "metricas": [{"nome": "Número de empreendimentos apoiados instalados fora da região do mecanismo de inovação", "unidade": "empreendimentos", "obrigatoria": True, "exemplo": "Ex.: 6 empreendimentos de outras cidades"}],
                            "requisitos_evidencia": [
                                {"descricao": "Procedimento explicitando como o mecanismo realiza a expansão de atuação territorial.", "exemplo": "Metodologia de expansão (postos avançados, parcerias)."},
                                {"descricao": "Registros que demonstrem apoio a empreendimentos sediados fora da região.", "exemplo": "Lista de apoiados por município."},
                                _EV_RESULTADOS, _EV_EFETIVIDADE,
                            ],
                        },
                    ],
                },
                {
                    "codigo": "3.3",
                    "nome": "Responsabilidade Social e Ambiental",
                    "descricao": "Estabelecimento de uma política voltada à adoção de boas práticas de gestão social e ambiental.",
                    "praticas": [
                        {
                            "codigo": "3.3.1", "nome": "Gestão Ambiental",
                            "descricao": "Processos sistemáticos e documentados para mitigação dos impactos ambientais da atuação do mecanismo e/ou dos empreendimentos apoiados.",
                            "objetivo": "Reduzir o impacto ambiental do mecanismo de inovação e dos empreendimentos apoiados.",
                            "orientacao_preenchimento": "Anexe a política/ações ambientais e os registros de execução. Meça o número de ações de gestão ambiental operacionalizadas.",
                            "metricas": [{"nome": "Número de ações de gestão ambiental operacionalizadas pelo mecanismo de inovação", "unidade": "ações", "obrigatoria": True, "exemplo": "Ex.: 4 ações (reciclagem, energia renovável, etc.)"}],
                            "requisitos_evidencia": [
                                {"descricao": "Procedimento explicitando como o mecanismo realiza a gestão ambiental.", "exemplo": "Política ambiental do mecanismo."},
                                {"descricao": "Registros que demonstrem a execução das ações de gestão ambiental.", "exemplo": "Fotos/relatórios das ações de reciclagem, uso de água etc."},
                                _EV_RESULTADOS, _EV_EFETIVIDADE,
                            ],
                        },
                        {
                            "codigo": "3.3.2", "nome": "Responsabilidade Social",
                            "descricao": "Política formalizada de responsabilidade social para o bem-estar do público interno e externo do mecanismo de inovação.",
                            "objetivo": "Ampliar o bem-estar dos colaboradores, empreendedores e do público externo do mecanismo de inovação.",
                            "orientacao_preenchimento": "Anexe a política de responsabilidade social e os registros das ações. Meça o número de ações de responsabilidade social operacionalizadas.",
                            "metricas": [{"nome": "Número de ações de responsabilidade social operacionalizadas pelo mecanismo de inovação", "unidade": "ações", "obrigatoria": True, "exemplo": "Ex.: 6 ações no ano"}],
                            "requisitos_evidencia": [
                                {"descricao": "Procedimento explicitando como o mecanismo realiza ações de responsabilidade social.", "exemplo": "Política de responsabilidade social / código de ética."},
                                {"descricao": "Registros que demonstrem a execução das ações de responsabilidade social.", "exemplo": "Fotos/relatórios de cursos, campanhas e ações com a comunidade."},
                                _EV_RESULTADOS, _EV_EFETIVIDADE,
                            ],
                        },
                    ],
                },
            ],
        },
        {
            "numero": 4,
            "nome": "Posicionamento Global",
            "descricao": (
                "Foco na internacionalização dos empreendimentos apoiados e do "
                "próprio mecanismo de inovação, estabelecendo parcerias para "
                "viabilizar presença internacional."
            ),
            "processos": [
                {
                    "codigo": "4.1",
                    "nome": "Atuação Internacional",
                    "descricao": "Processos sistemáticos e documentados para a atuação internacional, ampliando recursos, conhecimentos e mercados para o mecanismo de inovação e para os empreendimentos.",
                    "praticas": [
                        {
                            "codigo": "4.1.1", "nome": "Internacionalização do Mecanismo de Inovação",
                            "descricao": "Processo sistematizado e documentado de atuação em rede com parceiros internacionais para captar recursos, compartilhar conhecimentos e acessar novos mercados.",
                            "objetivo": "Ampliar a atuação internacional do mecanismo de inovação.",
                            "orientacao_preenchimento": "Registre parcerias internacionais e projetos conjuntos; anexe acordos e registros. Meça o número de projetos executados com parceiros internacionais.",
                            "metricas": [{"nome": "Número de projetos executados com parceiros internacionais", "unidade": "projetos", "obrigatoria": True, "exemplo": "Ex.: 2 projetos internacionais no ano"}],
                            "requisitos_evidencia": [
                                {"descricao": "Procedimento explicitando como o mecanismo realiza ações que viabilizem sua internacionalização.", "exemplo": "Estratégia de internacionalização e rede internacional."},
                                {"descricao": "Registros que demonstrem a execução das ações de internacionalização do mecanismo.", "exemplo": "Acordos internacionais e relatórios de projetos conjuntos."},
                                _EV_RESULTADOS, _EV_EFETIVIDADE,
                            ],
                        },
                        {
                            "codigo": "4.1.2", "nome": "Internacionalização dos Empreendimentos",
                            "descricao": "Processo para promover a internacionalização dos empreendimentos apoiados, preparando-os para atuar no mercado global.",
                            "objetivo": "Ampliar a atuação internacional dos empreendimentos apoiados e graduados.",
                            "orientacao_preenchimento": "Registre as ações de apoio à internacionalização dos empreendimentos (rodadas, softlanding) e anexe resultados. Meça o número de empreendimentos em projetos de internacionalização.",
                            "metricas": [{"nome": "Número de empreendimentos participando de projetos de internacionalização", "unidade": "empreendimentos", "obrigatoria": True, "exemplo": "Ex.: 4 empreendimentos"}],
                            "requisitos_evidencia": [
                                {"descricao": "Procedimento explicitando como o mecanismo viabiliza a internacionalização dos empreendimentos apoiados e graduados.", "exemplo": "Programa de internacionalização (rodadas, softlanding)."},
                                {"descricao": "Registros que demonstrem a execução das ações e a participação efetiva do mecanismo no apoio ao empreendimento no exterior.", "exemplo": "Relatórios das rodadas internacionais de negócios."},
                                _EV_RESULTADOS, _EV_EFETIVIDADE,
                            ],
                        },
                    ],
                },
            ],
        },
    ],
}
