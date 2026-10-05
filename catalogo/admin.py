"""Admin do catálogo CERNE.

Permite navegar e editar a metodologia: versão → níveis → processos → práticas,
e, dentro de cada prática, os requisitos de evidência, métricas e recomendações.
"""

from django.contrib import admin

from .models import (
    DefinicaoMetrica,
    Nivel,
    PraticaChave,
    ProcessoChave,
    Recomendacao,
    RequisitoEvidencia,
    VersaoModelo,
)


class NivelInline(admin.TabularInline):
    model = Nivel
    extra = 0


class ProcessoChaveInline(admin.TabularInline):
    model = ProcessoChave
    extra = 0
    fields = ("codigo", "nome", "ordem")


class PraticaChaveInline(admin.TabularInline):
    model = PraticaChave
    extra = 0
    fields = ("codigo", "nome", "ordem")
    show_change_link = True


class RequisitoEvidenciaInline(admin.TabularInline):
    model = RequisitoEvidencia
    extra = 0


class DefinicaoMetricaInline(admin.TabularInline):
    model = DefinicaoMetrica
    extra = 0


class RecomendacaoInline(admin.TabularInline):
    model = Recomendacao
    extra = 0


@admin.register(VersaoModelo)
class VersaoModeloAdmin(admin.ModelAdmin):
    list_display = ("nome", "ano", "ativa")
    list_filter = ("ativa",)
    search_fields = ("nome",)
    inlines = [NivelInline]


@admin.register(Nivel)
class NivelAdmin(admin.ModelAdmin):
    list_display = ("__str__", "versao", "numero")
    list_filter = ("versao",)
    ordering = ("versao", "numero")
    inlines = [ProcessoChaveInline]


@admin.register(ProcessoChave)
class ProcessoChaveAdmin(admin.ModelAdmin):
    list_display = ("codigo", "nome", "nivel")
    list_filter = ("nivel__versao", "nivel__numero")
    search_fields = ("codigo", "nome")
    ordering = ("codigo",)
    inlines = [PraticaChaveInline]


@admin.register(PraticaChave)
class PraticaChaveAdmin(admin.ModelAdmin):
    list_display = ("codigo", "nome", "processo")
    list_filter = (
        "processo__nivel__versao",
        "processo__nivel__numero",
        "processo",
    )
    search_fields = ("codigo", "nome", "objetivo", "descricao")
    ordering = ("codigo",)
    inlines = [
        RequisitoEvidenciaInline,
        DefinicaoMetricaInline,
        RecomendacaoInline,
    ]


@admin.register(DefinicaoMetrica)
class DefinicaoMetricaAdmin(admin.ModelAdmin):
    list_display = ("nome", "pratica", "unidade", "meta", "obrigatoria")
    list_filter = ("obrigatoria", "pratica__processo__nivel__numero")
    search_fields = ("nome", "pratica__codigo")


@admin.register(RequisitoEvidencia)
class RequisitoEvidenciaAdmin(admin.ModelAdmin):
    list_display = ("__str__", "obrigatorio")
    list_filter = ("obrigatorio", "pratica__processo__nivel__numero")
    search_fields = ("descricao", "pratica__codigo")
