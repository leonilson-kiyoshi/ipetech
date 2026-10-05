"""Exporta o catálogo CERNE para a versão web estática (pasta `docs/`).

Gera `docs/js/dados-cerne.js` com toda a metodologia (níveis, processos,
práticas, requisitos de evidência, métricas e recomendações) em um arquivo
JavaScript que é carregado via <script src>.

Por que JS e não JSON?
    Um arquivo .json precisaria ser lido com fetch(), e o fetch é bloqueado
    pelo navegador quando a página é aberta direto do disco (file://).
    Embutindo os dados como JS, o app funciona tanto no GitHub Pages quanto
    abrindo o index.html com dois cliques, sem servidor nenhum.

Os identificadores de requisitos e métricas são gerados de forma estável
(ex.: "1.1.1-r1", "1.1.1-m2") e não dependem dos ids do banco, para que o
acompanhamento salvo no navegador continue válido se o catálogo for
reexportado.

Uso:
    python manage.py exportar_web
"""

import json
from pathlib import Path

from django.conf import settings
from django.core.management.base import BaseCommand

from catalogo.models import Nivel, VersaoModelo


class Command(BaseCommand):
    help = "Exporta o catálogo CERNE para docs/js/dados-cerne.js (versão web estática)."

    def add_arguments(self, parser):
        parser.add_argument(
            "--saida",
            default=None,
            help="Caminho do arquivo .js gerado (padrão: docs/js/dados-cerne.js).",
        )

    def handle(self, *args, **opts):
        versao = (
            VersaoModelo.objects.filter(ativa=True).order_by("-ano").first()
            or VersaoModelo.objects.order_by("-ano").first()
        )
        if not versao:
            self.stderr.write(
                "Nenhuma versão do modelo encontrada. Rode antes: python manage.py seed_cerne"
            )
            return

        niveis_out = []
        total_praticas = total_req = total_met = 0

        niveis = (
            Nivel.objects.filter(versao=versao)
            .order_by("numero")
            .prefetch_related(
                "processos__praticas__requisitos_evidencia",
                "processos__praticas__metricas",
                "processos__praticas__recomendacoes",
            )
        )

        for nivel in niveis:
            processos_out = []
            for processo in nivel.processos.all():
                praticas_out = []
                for pratica in processo.praticas.all():
                    requisitos_out = []
                    for i, req in enumerate(pratica.requisitos_evidencia.all(), start=1):
                        requisitos_out.append(
                            {
                                "id": f"{pratica.codigo}-r{i}",
                                "descricao": req.descricao,
                                "exemplo": req.exemplo,
                                "obrigatorio": req.obrigatorio,
                            }
                        )
                    metricas_out = []
                    for i, met in enumerate(pratica.metricas.all(), start=1):
                        metricas_out.append(
                            {
                                "id": f"{pratica.codigo}-m{i}",
                                "nome": met.nome,
                                "unidade": met.unidade,
                                "meta": met.meta,
                                "obrigatoria": met.obrigatoria,
                                "descricao": met.descricao,
                                "exemplo": met.exemplo,
                            }
                        )
                    praticas_out.append(
                        {
                            "codigo": pratica.codigo,
                            "nome": pratica.nome,
                            "descricao": pratica.descricao,
                            "objetivo": pratica.objetivo,
                            "orientacao": pratica.orientacao_preenchimento,
                            "requisitos": requisitos_out,
                            "metricas": metricas_out,
                            "recomendacoes": [
                                r.texto for r in pratica.recomendacoes.all()
                            ],
                        }
                    )
                    total_praticas += 1
                    total_req += len(requisitos_out)
                    total_met += len(metricas_out)

                processos_out.append(
                    {
                        "codigo": processo.codigo,
                        "nome": processo.nome,
                        "descricao": processo.descricao,
                        "praticas": praticas_out,
                    }
                )

            niveis_out.append(
                {
                    "numero": nivel.numero,
                    "nome": nivel.nome,
                    "descricao": nivel.descricao,
                    "processos": processos_out,
                }
            )

        catalogo = {
            "versao": {
                "nome": versao.nome,
                "ano": versao.ano,
                "descricao": versao.descricao,
            },
            "niveis": niveis_out,
        }

        base_dir = Path(settings.BASE_DIR)
        destino = (
            Path(opts["saida"])
            if opts["saida"]
            else base_dir / "docs" / "js" / "dados-cerne.js"
        )
        destino.parent.mkdir(parents=True, exist_ok=True)

        corpo = json.dumps(catalogo, ensure_ascii=False, indent=2)
        conteudo = (
            "/* ATENÇÃO: arquivo gerado automaticamente.\n"
            "   Não edite à mão — rode: python manage.py exportar_web\n"
            f"   Catálogo: {versao.nome}\n"
            "*/\n"
            f"window.CERNE_CATALOGO = {corpo};\n"
        )
        destino.write_text(conteudo, encoding="utf-8")

        self.stdout.write(
            self.style.SUCCESS(
                f"Catálogo exportado para {destino}\n"
                f"  {len(niveis_out)} níveis · {total_praticas} práticas · "
                f"{total_req} requisitos · {total_met} métricas"
            )
        )
