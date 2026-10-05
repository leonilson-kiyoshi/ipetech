"""Configuração de URLs do projeto.

A raiz é o painel do acompanhamento (app `acompanhamento`). O admin do Django
fica em /admin/ e serve apenas para manutenção: corrigir o catálogo CERNE e
gerenciar usuários e grupos. O trabalho do dia a dia é feito nas telas do
sistema.
"""

from django.contrib import admin
from django.contrib.auth import views as auth_views
from django.urls import include, path

# Personalização do admin
admin.site.site_header = "Sistema de Acompanhamento CERNE"
admin.site.site_title = "Acompanhamento CERNE"
admin.site.index_title = "Painel de gestão"

# Fluxo de recuperação de senha com nossos templates (inclusive o e-mail e o
# assunto), definido antes de incluir django.contrib.auth.urls para ter
# prioridade sobre as views padrão.
password_reset_urls = [
    path(
        "accounts/password_reset/",
        auth_views.PasswordResetView.as_view(
            template_name="registration/password_reset_form.html",
            email_template_name="registration/password_reset_email.html",
            subject_template_name="registration/password_reset_subject.txt",
        ),
        name="password_reset",
    ),
]

urlpatterns = [
    path("admin/", admin.site.urls),
    *password_reset_urls,
    path("accounts/", include("django.contrib.auth.urls")),
    path("", include("acompanhamento.urls")),
]

# Os arquivos de evidência NÃO são servidos diretamente, nem em
# desenvolvimento. Eles saem pela rota 'evidencia_arquivo', que exige login.
#
# Antes havia aqui um `static(settings.MEDIA_URL, ...)`, que expunha a pasta
# media/ inteira para quem soubesse a URL. Foi removido de propósito: assim
# desenvolvimento e produção se comportam igual, e documento do parque não
# fica acessível sem autenticação em nenhum dos dois.
