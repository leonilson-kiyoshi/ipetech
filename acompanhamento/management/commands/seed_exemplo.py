# -*- coding: utf-8 -*-
"""Cria um mecanismo de DEMONSTRAÇÃO com o CERNE 1 totalmente preenchido.

Serve para você ver como fica o dashboard/radar e como preencher cada item.
É idempotente: limpa e recria os dados de exemplo a cada execução.

Uso:
    python manage.py seed_exemplo

Para remover depois, basta excluir o mecanismo "(EXEMPLO)" no admin.
"""

import datetime

from django.core.management.base import BaseCommand
from django.db import transaction

from catalogo.models import Nivel, PraticaChave

from acompanhamento.models import (
    Aprendizado,
    AvaliacaoEixo,
    Empreendimento,
    Evidencia,
    Mecanismo,
    MedicaoMetrica,
    PlanoAcao,
    StatusPratica,
)


class Command(BaseCommand):
    help = "Cria/atualiza um mecanismo de exemplo com o CERNE 1 preenchido."

    @transaction.atomic
    def handle(self, *args, **options):
        mec, _ = Mecanismo.objects.get_or_create(
            nome="Parque Tecnológico (EXEMPLO)",
            defaults={
                "tipo": "parque tecnológico",
                "cidade_uf": "Lavras/MG",
                "nivel_almejado": 2,
                "eh_exemplo": True,
                "descricao": "Mecanismo de demonstração — mostra o CERNE 1 preenchido.",
            },
        )
        mec.eh_exemplo = True
        mec.save()

        # limpa dados anteriores do exemplo (idempotência)
        StatusPratica.objects.filter(mecanismo=mec).delete()
        Evidencia.objects.filter(mecanismo=mec).delete()
        MedicaoMetrica.objects.filter(mecanismo=mec).delete()
        Aprendizado.objects.filter(mecanismo=mec).delete()
        PlanoAcao.objects.filter(mecanismo=mec).delete()
        Empreendimento.objects.filter(mecanismo=mec).delete()

        hoje = datetime.date.today()

        nivel1 = Nivel.objects.filter(numero=1).order_by("versao").first()
        if not nivel1:
            self.stderr.write("Catálogo não encontrado. Rode 'python manage.py seed_cerne' antes.")
            return

        praticas_n1 = PraticaChave.objects.filter(
            processo__nivel=nivel1
        ).prefetch_related("requisitos_evidencia", "metricas")

        n_evid = n_med = 0
        for pratica in praticas_n1:
            StatusPratica.objects.create(
                mecanismo=mec,
                pratica=pratica,
                situacao=StatusPratica.Situacao.IMPLANTADA,
                percentual=100,
                observacoes="Preenchido no exemplo de demonstração.",
            )
            # uma evidência por requisito obrigatório
            for req in pratica.requisitos_evidencia.all():
                if not req.obrigatorio:
                    continue
                Evidencia.objects.create(
                    mecanismo=mec,
                    pratica=pratica,
                    requisito=req,
                    titulo=f"[Exemplo] {req.descricao[:60]}",
                    descricao="Evidência de demonstração. Substitua pelo documento real.",
                    data_referencia=hoje,
                    responsavel="Equipe de gestão",
                )
                n_evid += 1
            # uma medição por métrica obrigatória
            for met in pratica.metricas.all():
                if not met.obrigatoria:
                    continue
                valor = 27 if "%" in (met.unidade or "") else 150
                MedicaoMetrica.objects.create(
                    mecanismo=mec,
                    metrica=met,
                    valor=valor,
                    data=hoje,
                    observacao="Medição de demonstração.",
                )
                n_med += 1

        # uma revisão crítica e um plano de ação de exemplo
        p111 = praticas_n1.filter(codigo="1.1.1").first()
        if p111:
            Aprendizado.objects.create(
                mecanismo=mec,
                pratica=p111,
                data=hoje,
                periodo="2024 (anual)",
                eficiencia="Ações realizadas dentro do previsto.",
                eficacia="Bom público nas palestras.",
                efetividade="Aumento de propostas qualificadas.",
                necessita_ajustes=False,
                observacoes="Exemplo de revisão crítica.",
            )
            PlanoAcao.objects.create(
                mecanismo=mec,
                pratica=p111,
                descricao="[Exemplo] Ampliar ações de sensibilização em cidades vizinhas.",
                responsavel="Coordenação",
                prazo=hoje + datetime.timedelta(days=90),
                situacao=PlanoAcao.Situacao.EM_ANDAMENTO,
            )

        # Empreendimentos de exemplo, avaliados nos 5 eixos
        exemplos_emp = [
            {
                "nome": "EcoSense (exemplo)", "setor": "TIC",
                "estagio": Empreendimento.Estagio.OPERACAO,
                "situacao": Empreendimento.Situacao.APOIADO,
                "notas": {"empreendedor": 4, "tecnologia": 3, "capital": 2, "mercado": 3, "gestao": 3},
            },
            {
                "nome": "AgroData (exemplo)", "setor": "Agrotech",
                "estagio": Empreendimento.Estagio.CRESCIMENTO,
                "situacao": Empreendimento.Situacao.GRADUADO,
                "notas": {"empreendedor": 5, "tecnologia": 4, "capital": 4, "mercado": 4, "gestao": 4},
            },
        ]
        n_emp = 0
        for d in exemplos_emp:
            emp = Empreendimento.objects.create(
                mecanismo=mec, nome=d["nome"], setor=d["setor"],
                estagio=d["estagio"], situacao=d["situacao"], data_entrada=hoje,
                responsavel="Equipe de gestão",
            )
            for eixo, nota in d["notas"].items():
                AvaliacaoEixo.objects.create(
                    empreendimento=emp, eixo=eixo, nota=nota, data=hoje,
                    observacao="Avaliação de demonstração.",
                )
            n_emp += 1

        self.stdout.write(
            self.style.SUCCESS(
                f"Exemplo criado: {mec.nome} — CERNE 1 preenchido "
                f"({praticas_n1.count()} práticas, {n_evid} evidências, {n_med} medições, "
                f"{n_emp} empreendimentos)."
            )
        )
