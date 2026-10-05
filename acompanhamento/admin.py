"""Admin de acompanhamento.

Telas para registrar status, evidências, medições, revisões críticas e planos de
ação. Preenche automaticamente os campos de autoria (`criado_por`/`atualizado_por`)
para sustentar a trilha de auditoria.
"""

from django.contrib import admin

from .models import (
    Aprendizado,
    AvaliacaoEixo,
    Empreendimento,
    Evidencia,
    Mecanismo,
    MedicaoMetrica,
    PlanoAcao,
    StatusPratica,
)


class AutoAutorAdmin(admin.ModelAdmin):
    """Preenche `criado_por` (na criação) e `atualizado_por` (sempre) com o usuário logado."""

    def save_model(self, request, obj, form, change):
        if not change and hasattr(obj, "criado_por") and obj.criado_por_id is None:
            obj.criado_por = request.user
        if hasattr(obj, "atualizado_por"):
            obj.atualizado_por = request.user
        super().save_model(request, obj, form, change)


@admin.register(Mecanismo)
class MecanismoAdmin(admin.ModelAdmin):
    list_display = ("nome", "tipo", "cidade_uf", "nivel_almejado", "ativo")
    list_filter = ("ativo", "nivel_almejado")
    search_fields = ("nome", "cidade_uf")


@admin.register(StatusPratica)
class StatusPraticaAdmin(AutoAutorAdmin):
    list_display = ("pratica", "mecanismo", "situacao", "percentual", "atualizado_em")
    list_filter = (
        "situacao",
        "mecanismo",
        "pratica__processo__nivel__numero",
        "pratica__processo",
    )
    search_fields = ("pratica__codigo", "pratica__nome")
    list_editable = ("situacao", "percentual")
    autocomplete_fields = ("pratica",)
    readonly_fields = ("atualizado_em", "atualizado_por")


@admin.register(Evidencia)
class EvidenciaAdmin(AutoAutorAdmin):
    list_display = (
        "titulo",
        "pratica",
        "mecanismo",
        "data_referencia",
        "responsavel",
        "criado_em",
        "criado_por",
    )
    list_filter = (
        "mecanismo",
        "pratica__processo__nivel__numero",
        "pratica__processo",
    )
    search_fields = ("titulo", "descricao", "pratica__codigo")
    autocomplete_fields = ("pratica",)
    readonly_fields = ("criado_em", "criado_por")
    date_hierarchy = "criado_em"


@admin.register(MedicaoMetrica)
class MedicaoMetricaAdmin(AutoAutorAdmin):
    list_display = ("metrica", "mecanismo", "valor", "data", "criado_por")
    list_filter = ("mecanismo", "metrica__pratica__processo__nivel__numero")
    search_fields = ("metrica__nome", "metrica__pratica__codigo")
    readonly_fields = ("criado_em", "criado_por")
    date_hierarchy = "data"


@admin.register(Aprendizado)
class AprendizadoAdmin(AutoAutorAdmin):
    list_display = ("pratica", "mecanismo", "data", "necessita_ajustes", "criado_por")
    list_filter = ("mecanismo", "necessita_ajustes", "pratica__processo__nivel__numero")
    search_fields = ("pratica__codigo", "observacoes")
    autocomplete_fields = ("pratica",)
    readonly_fields = ("criado_em", "criado_por")
    date_hierarchy = "data"


@admin.register(PlanoAcao)
class PlanoAcaoAdmin(AutoAutorAdmin):
    list_display = ("descricao", "pratica", "mecanismo", "responsavel", "prazo", "situacao")
    list_filter = ("situacao", "mecanismo")
    search_fields = ("descricao", "responsavel", "pratica__codigo")
    autocomplete_fields = ("pratica",)
    readonly_fields = ("criado_em", "criado_por")


class AvaliacaoEixoInline(admin.TabularInline):
    model = AvaliacaoEixo
    extra = 5
    fields = ("eixo", "nota", "data", "observacao")


@admin.register(Empreendimento)
class EmpreendimentoAdmin(AutoAutorAdmin):
    list_display = ("nome", "mecanismo", "setor", "estagio", "situacao", "data_entrada")
    list_filter = ("mecanismo", "situacao", "estagio")
    search_fields = ("nome", "setor", "responsavel")
    readonly_fields = ("criado_em", "criado_por")
    inlines = [AvaliacaoEixoInline]


@admin.register(AvaliacaoEixo)
class AvaliacaoEixoAdmin(AutoAutorAdmin):
    list_display = ("empreendimento", "eixo", "nota", "data", "criado_por")
    list_filter = ("eixo", "empreendimento__mecanismo")
    search_fields = ("empreendimento__nome",)
    readonly_fields = ("criado_em", "criado_por")
    date_hierarchy = "data"
