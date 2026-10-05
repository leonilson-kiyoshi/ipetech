"""Filtros de template do acompanhamento.

O template do Django não acessa dicionário por chave variável nem faz conta,
então o mínimo necessário para as telas fica aqui.
"""

from pathlib import PurePosixPath

from django import template

register = template.Library()


@register.filter
def buscar(dicionario, chave):
    """Acessa `dicionario[chave]` no template. Devolve lista vazia se não houver.

    Uso: {{ evidencias_por_requisito|buscar:req.id }}
    """
    if not hasattr(dicionario, "get"):
        return []
    return dicionario.get(chave) or []


@register.filter
def contem(colecao, item):
    """Testa pertencimento (útil com conjuntos de ids).

    Uso: {% if requisitos_atendidos|contem:req.id %}
    """
    try:
        return item in colecao
    except TypeError:
        return False


@register.filter
def classe_progresso(percentual):
    """Classe CSS da barra conforme o percentual."""
    try:
        valor = float(percentual)
    except (TypeError, ValueError):
        return "vazio"
    if valor >= 100:
        return "completo"
    if valor > 0:
        return "parcial"
    return "vazio"


@register.filter
def pill_progresso(percentual):
    """Classe da etiqueta conforme o percentual."""
    try:
        valor = float(percentual)
    except (TypeError, ValueError):
        return "parado"
    if valor >= 100:
        return "ok"
    if valor > 0:
        return "andamento"
    return "parado"


@register.filter
def tipo_arquivo(nome):
    """Classifica o arquivo para escolher o ícone: pdf, imagem, planilha, doc."""
    extensao = PurePosixPath(str(nome or "").lower()).suffix
    if extensao == ".pdf":
        return "pdf"
    if extensao in {".png", ".jpg", ".jpeg", ".gif", ".webp"}:
        return "imagem"
    if extensao in {".xls", ".xlsx", ".ods", ".csv"}:
        return "planilha"
    if extensao in {".zip"}:
        return "zip"
    return "doc"


@register.filter
def icone_arquivo(nome):
    """Ícone Bootstrap correspondente ao tipo do arquivo."""
    return {
        "pdf": "bi-file-earmark-pdf",
        "imagem": "bi-file-earmark-image",
        "planilha": "bi-file-earmark-spreadsheet",
        "zip": "bi-file-earmark-zip",
        "doc": "bi-file-earmark-text",
    }.get(tipo_arquivo(nome), "bi-file-earmark")


@register.filter
def nome_do_arquivo(caminho):
    """Só o nome do arquivo, sem as pastas."""
    return PurePosixPath(str(caminho or "")).name


@register.filter
def pasta_do_arquivo(caminho):
    """Só as pastas, sem o nome do arquivo."""
    return str(PurePosixPath(str(caminho or "")).parent)


@register.filter
def sem_requisito(evidencias):
    """Filtra as evidências que não foram vinculadas a nenhum requisito.

    Usado no dossiê: a listagem principal percorre os requisitos, então uma
    evidência sem vínculo ficaria de fora do documento da auditoria.
    """
    return [e for e in (evidencias or []) if not e.requisito_id]
