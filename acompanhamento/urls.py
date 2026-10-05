"""Rotas do acompanhamento CERNE.

As rotas de registro (POST) não têm URL própria: cada tela de trabalho recebe
os próprios envios e identifica a ação por um campo oculto `tipo`. Isso mantém
o endereço estável ao gravar e permite recarregar a página sem duplicar dados.
"""

from django.urls import path

from . import views

urlpatterns = [
    # Painel
    path("", views.dashboard, name="dashboard"),
    # Registro (o fluxo principal do técnico)
    path("registrar/", views.registrar, name="registrar"),
    path("registrar/<str:codigo>/", views.registrar_acao, name="registrar_acao"),
    # Práticas-chave
    path("praticas/", views.catalogo, name="catalogo"),
    path("praticas/<str:codigo>/", views.pratica_detail, name="pratica_detail"),
    # Empreendimentos
    path("empreendimentos/", views.empreendimentos, name="empreendimentos"),
    path(
        "empreendimentos/<int:pk>/",
        views.empreendimento_detail,
        name="empreendimento_detail",
    ),
    # Arquivos das evidências
    path("arquivos/", views.arquivos, name="arquivos"),
    # Entrega de um anexo. Passa pelo sistema de propósito: só usuário logado
    # baixa, e assim não dependemos de link assinado do armazenamento.
    path(
        "evidencias/<int:pk>/arquivo/",
        views.evidencia_arquivo,
        name="evidencia_arquivo",
    ),
    # Acompanhamento e auditoria
    path("o-que-falta/", views.auditoria, name="auditoria"),
    path("dossie/", views.dossie, name="dossie"),
    path("dossie/pdf/", views.dossie_pdf, name="dossie_pdf"),
    # Ajuda e configuração
    path("como-preencher/", views.guia, name="guia"),
    path("manual/", views.manual, name="manual"),
    path("configuracao/", views.configuracao, name="configuracao"),
]
