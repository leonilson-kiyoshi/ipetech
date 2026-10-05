# -*- coding: utf-8 -*-
"""Comando de carga do catálogo CERNE 2025.

Uso:
    python manage.py seed_cerne

É idempotente: cria ou atualiza (nunca duplica). Pode ser re-executado sempre
que os dados em `_dados_cerne_2025.py` forem enriquecidos.
"""

from django.core.management.base import BaseCommand
from django.db import transaction

from catalogo.models import (
    DefinicaoMetrica,
    Nivel,
    PraticaChave,
    ProcessoChave,
    Recomendacao,
    RequisitoEvidencia,
    VersaoModelo,
)

from ._dados_cerne_2025 import CERNE_2025


class Command(BaseCommand):
    help = "Carrega/atualiza o catálogo do modelo CERNE 2025 (idempotente)."

    @transaction.atomic
    def handle(self, *args, **options):
        contadores = {
            "niveis": 0,
            "processos": 0,
            "praticas": 0,
            "metricas": 0,
            "requisitos": 0,
            "recomendacoes": 0,
        }

        dados = CERNE_2025
        versao, _ = VersaoModelo.objects.update_or_create(
            nome=dados["versao"]["nome"],
            defaults={
                "ano": dados["versao"].get("ano"),
                "descricao": dados["versao"].get("descricao", ""),
                "ativa": True,
            },
        )

        for nivel_d in dados["niveis"]:
            nivel, _ = Nivel.objects.update_or_create(
                versao=versao,
                numero=nivel_d["numero"],
                defaults={
                    "nome": nivel_d["nome"],
                    "descricao": nivel_d.get("descricao", ""),
                },
            )
            contadores["niveis"] += 1

            for ip, proc_d in enumerate(nivel_d["processos"]):
                processo, _ = ProcessoChave.objects.update_or_create(
                    nivel=nivel,
                    codigo=proc_d["codigo"],
                    defaults={
                        "nome": proc_d["nome"],
                        "descricao": proc_d.get("descricao", ""),
                        "ordem": ip,
                    },
                )
                contadores["processos"] += 1

                for ipr, prat_d in enumerate(proc_d["praticas"]):
                    pratica, _ = PraticaChave.objects.update_or_create(
                        processo=processo,
                        codigo=prat_d["codigo"],
                        defaults={
                            "nome": prat_d["nome"],
                            "descricao": prat_d.get("descricao", ""),
                            "objetivo": prat_d.get("objetivo", ""),
                            "orientacao_preenchimento": prat_d.get("orientacao_preenchimento", ""),
                            "ordem": ipr,
                        },
                    )
                    contadores["praticas"] += 1

                    for im, met_d in enumerate(prat_d.get("metricas", [])):
                        DefinicaoMetrica.objects.update_or_create(
                            pratica=pratica,
                            nome=met_d["nome"],
                            defaults={
                                "unidade": met_d.get("unidade", ""),
                                "meta": met_d.get("meta", ""),
                                "obrigatoria": met_d.get("obrigatoria", True),
                                "descricao": met_d.get("descricao", ""),
                                "exemplo": met_d.get("exemplo", ""),
                                "ordem": im,
                            },
                        )
                        contadores["metricas"] += 1

                    for ir, req in enumerate(prat_d.get("requisitos_evidencia", [])):
                        # aceita string simples ou dict {descricao, exemplo, obrigatorio}
                        if isinstance(req, str):
                            req = {"descricao": req}
                        RequisitoEvidencia.objects.update_or_create(
                            pratica=pratica,
                            ordem=ir,
                            defaults={
                                "descricao": req["descricao"],
                                "exemplo": req.get("exemplo", ""),
                                "obrigatorio": req.get("obrigatorio", True),
                            },
                        )
                        contadores["requisitos"] += 1

                    for irec, rec_txt in enumerate(prat_d.get("recomendacoes", [])):
                        Recomendacao.objects.update_or_create(
                            pratica=pratica,
                            ordem=irec,
                            defaults={"texto": rec_txt},
                        )
                        contadores["recomendacoes"] += 1

        self.stdout.write(self.style.SUCCESS("Catálogo CERNE 2025 carregado/atualizado:"))
        for chave, valor in contadores.items():
            self.stdout.write(f"  - {chave}: {valor}")
