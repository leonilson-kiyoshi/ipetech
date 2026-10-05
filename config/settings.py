"""Configuração do Sistema de Acompanhamento CERNE — IpêTech Paraíso.

Tudo que muda entre o computador de desenvolvimento e o servidor de produção
é lido de variáveis de ambiente (ou de um arquivo `.env` na raiz do projeto),
para que nenhum segredo fique escrito no código e o repositório possa ser
publicado com segurança.

Sem nenhuma variável definida, o sistema roda em modo de desenvolvimento:
SQLite, arquivos na pasta `media/` e DEBUG ligado. Basta `runserver`.

As variáveis disponíveis estão documentadas em `.env.example`.
"""

import os
from pathlib import Path

from django.core.exceptions import ImproperlyConfigured

BASE_DIR = Path(__file__).resolve().parent.parent


# ============================================================================
# Leitura da configuração de ambiente
# ============================================================================

def _carregar_arquivo_env(caminho):
    """Carrega pares CHAVE=valor de um arquivo .env para o ambiente.

    Implementação mínima e sem dependências: ignora linhas vazias e
    comentários, aceita aspas ao redor do valor e nunca sobrescreve uma
    variável que já exista no ambiente (o ambiente real tem prioridade,
    que é o comportamento esperado em servidores e contêineres).
    """
    if not caminho.exists():
        return
    for linha in caminho.read_text(encoding="utf-8").splitlines():
        linha = linha.strip()
        if not linha or linha.startswith("#") or "=" not in linha:
            continue
        chave, _, valor = linha.partition("=")
        chave = chave.strip()
        valor = valor.strip().strip('"').strip("'")
        if chave and chave not in os.environ:
            os.environ[chave] = valor


_carregar_arquivo_env(BASE_DIR / ".env")


def env(nome, padrao=""):
    """Texto vindo do ambiente."""
    return os.environ.get(nome, padrao).strip()


def env_bool(nome, padrao=False):
    """Booleano vindo do ambiente. Aceita 1/true/sim/on."""
    bruto = os.environ.get(nome)
    if bruto is None or not bruto.strip():
        return padrao
    return bruto.strip().lower() in {"1", "true", "t", "sim", "s", "yes", "y", "on"}


def env_lista(nome, padrao=None):
    """Lista separada por vírgulas vinda do ambiente."""
    bruto = env(nome)
    if not bruto:
        return list(padrao or [])
    return [item.strip() for item in bruto.split(",") if item.strip()]


# ============================================================================
# Segurança básica
# ============================================================================

# Chave usada apenas em desenvolvimento. Em produção, defina CERNE_SECRET_KEY.
_CHAVE_DESENVOLVIMENTO = "django-insecure-apenas-para-desenvolvimento-local-nao-use-em-producao"

SECRET_KEY = env("CERNE_SECRET_KEY", _CHAVE_DESENVOLVIMENTO)

DEBUG = env_bool("CERNE_DEBUG", True)

# A suíte de testes precisa rodar em qualquer máquina, inclusive no servidor
# (onde CERNE_DEBUG=0). Sem esta detecção, os ajustes de produção atrapalham os
# testes: o redirecionamento para HTTPS transforma toda resposta em 301, e o
# armazenamento com manifest exige um `collectstatic` prévio.
# Os testes verificam a lógica do sistema, não a infraestrutura de entrega.
import sys  # noqa: E402

RODANDO_TESTES = "test" in sys.argv or sys.argv[0].endswith("pytest")

# Em desenvolvimento, apenas a própria máquina. Em produção, informe o
# domínio do sistema em CERNE_ALLOWED_HOSTS (separado por vírgulas).
ALLOWED_HOSTS = env_lista(
    "CERNE_ALLOWED_HOSTS", ["localhost", "127.0.0.1", "[::1]", "testserver"]
)

# Necessário quando o sistema roda atrás de HTTPS em um domínio:
# ex.: CERNE_CSRF_TRUSTED_ORIGINS=https://cerne.ipetech.org.br
CSRF_TRUSTED_ORIGINS = env_lista("CERNE_CSRF_TRUSTED_ORIGINS")

# Trava de segurança: impede subir em produção com a chave de desenvolvimento.
# É melhor o sistema recusar a iniciar do que rodar com sessões vulneráveis.
if not DEBUG and SECRET_KEY == _CHAVE_DESENVOLVIMENTO:
    raise ImproperlyConfigured(
        "CERNE_SECRET_KEY não foi definida e DEBUG está desligado. "
        "Gere uma chave com:\n"
        '  python -c "from django.core.management.utils import get_random_secret_key; '
        'print(get_random_secret_key())"\n'
        "e informe em CERNE_SECRET_KEY (no .env do servidor ou nas variáveis de ambiente)."
    )


# Application definition

INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    # Apps do projeto
    'catalogo',
    'acompanhamento',
]

MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
    # WhiteNoise serve os arquivos estáticos (CSS, ícones) direto pelo Django.
    # Precisa vir logo depois do SecurityMiddleware.
    'whitenoise.middleware.WhiteNoiseMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

ROOT_URLCONF = 'config.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
                # Disponibiliza o parque acompanhado e a versão do CERNE
                # em todos os templates.
                'acompanhamento.context_processors.parque',
            ],
        },
    },
]

WSGI_APPLICATION = 'config.wsgi.application'


# ============================================================================
# Banco de dados
#
# Padrão: SQLite, que já vem com o Python e basta para desenvolvimento.
# Em produção, defina CERNE_DB_ENGINE=postgres e as variáveis de conexão.
#
# Por que Postgres no servidor: SQLite guarda tudo em um arquivo só, e em
# hospedagem com disco efêmero (a maioria das plataformas) esse arquivo é
# perdido a cada reinício. Postgres também aguenta vários acessos simultâneos
# sem travar o banco.
# ============================================================================

if env("CERNE_DB_ENGINE").lower() in {"postgres", "postgresql"}:
    DATABASES = {
        "default": {
            "ENGINE": "django.db.backends.postgresql",
            "NAME": env("CERNE_DB_NAME", "cerne"),
            "USER": env("CERNE_DB_USER", "cerne"),
            "PASSWORD": env("CERNE_DB_PASSWORD"),
            "HOST": env("CERNE_DB_HOST", "localhost"),
            "PORT": env("CERNE_DB_PORT", "5432"),
            "CONN_MAX_AGE": 60,
        }
    }
else:
    # O caminho do arquivo pode ser movido para fora de pasta sincronizada
    # (OneDrive, Drive) com CERNE_DB_PATH: banco SQLite dentro de pasta de
    # sincronização pode corromper quando duas máquinas mexem ao mesmo tempo.
    DATABASES = {
        "default": {
            "ENGINE": "django.db.backends.sqlite3",
            "NAME": Path(env("CERNE_DB_PATH", str(BASE_DIR / "db.sqlite3"))),
        }
    }


# Password validation
# https://docs.djangoproject.com/en/5.2/ref/settings/#auth-password-validators

AUTH_PASSWORD_VALIDATORS = [
    {
        'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator',
    },
]


# Internationalization
# https://docs.djangoproject.com/en/5.2/topics/i18n/

LANGUAGE_CODE = 'pt-br'

TIME_ZONE = 'America/Sao_Paulo'

USE_I18N = True

USE_TZ = True


# ============================================================================
# Arquivos estáticos (CSS, ícones, JavaScript do próprio sistema)
# ============================================================================

STATIC_URL = "static/"

# Pasta onde `collectstatic` reúne os estáticos para o servidor entregar.
STATIC_ROOT = Path(env("CERNE_STATIC_ROOT", str(BASE_DIR / "staticfiles")))


# ============================================================================
# Arquivos de evidência enviados pela equipe (PDFs, imagens, planilhas...)
#
# Dois modos, escolhidos pela presença de CERNE_GCS_BUCKET:
#
#   sem a variável  -> pasta local (MEDIA_ROOT). É o modo de desenvolvimento,
#                      e também serve para rodar numa máquina do parque.
#   com a variável  -> Google Cloud Storage, para o sistema hospedado.
#
# Em qualquer um dos modos, a organização das pastas é a mesma
# (evidencias/CERNE1/1.1.1/2026/arquivo.pdf), porque ela é definida em
# acompanhamento.models.evidencia_upload_path.
# ============================================================================

MEDIA_URL = "media/"
MEDIA_ROOT = Path(env("CERNE_MEDIA_ROOT", str(BASE_DIR / "media")))

GCS_BUCKET = env("CERNE_GCS_BUCKET")

# Durante os testes, SEMPRE pasta local — mesmo que o bucket esteja
# configurado no ambiente. Teste automatizado não deve gravar em
# armazenamento de verdade: sujaria o bucket do parque, exigiria credencial
# e falharia sem rede. A suíte precisa rodar em qualquer lugar, inclusive no
# servidor de produção.
USANDO_GCS = bool(GCS_BUCKET) and not RODANDO_TESTES

if USANDO_GCS:
    _armazenamento_evidencias = {
        "BACKEND": "storages.backends.gcloud.GoogleCloudStorage",
        "OPTIONS": {
            "bucket_name": GCS_BUCKET,
            # O objeto NÃO é público e NÃO recebe ACL própria: o bucket usa
            # controle de acesso uniforme, e quem autoriza é o IAM.
            "default_acl": None,
            # Não geramos link direto para o bucket. O acesso ao anexo passa
            # pela rota 'evidencia_arquivo', que exige login e lê o objeto
            # usando a credencial do ambiente.
            #
            # Isso resolve dois problemas de uma vez:
            #  - link assinado exigiria chave de conta de serviço, que a
            #    política da organização bloqueia;
            #  - link assinado funciona para qualquer um que receba a URL,
            #    enquanto a rota do sistema exige usuário autenticado.
            "querystring_auth": False,
            # Não sobrescreve silenciosamente: se dois arquivos tiverem o mesmo
            # nome, o segundo recebe um sufixo em vez de apagar o primeiro.
            "file_overwrite": False,
            "location": env("CERNE_GCS_PREFIXO", ""),
        },
    }
    if env("CERNE_GCS_PROJETO"):
        _armazenamento_evidencias["OPTIONS"]["project_id"] = env("CERNE_GCS_PROJETO")
else:
    _armazenamento_evidencias = {
        "BACKEND": "django.core.files.storage.FileSystemStorage",
    }

# O armazenamento com "manifest" versiona cada arquivo pelo seu conteúdo
# (tema.a1b2c3.css), o que permite cache longo no navegador com segurança.
# A contrapartida: exige que `collectstatic` tenha rodado antes, senão qualquer
# página quebra ao resolver {% static %}.
_USAR_MANIFEST = not DEBUG and not RODANDO_TESTES

STORAGES = {
    "default": _armazenamento_evidencias,
    "staticfiles": {
        "BACKEND": (
            "whitenoise.storage.CompressedManifestStaticFilesStorage"
            if _USAR_MANIFEST
            else "django.contrib.staticfiles.storage.StaticFilesStorage"
        ),
    },
}


# Default primary key field type
# https://docs.djangoproject.com/en/5.2/ref/settings/#default-auto-field

DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

# Autenticação
LOGIN_URL = '/accounts/login/'
LOGIN_REDIRECT_URL = '/'
LOGOUT_REDIRECT_URL = '/accounts/login/'

# ============================================================================
# E-mail (usado na recuperação de senha)
#
# Em desenvolvimento, o e-mail é impresso no terminal do servidor — o link de
# redefinição aparece lá, sem precisar de SMTP.
# Em produção, informe os dados do servidor de e-mail em CERNE_EMAIL_*.
# ============================================================================

if env("CERNE_EMAIL_HOST"):
    EMAIL_BACKEND = "django.core.mail.backends.smtp.EmailBackend"
    EMAIL_HOST = env("CERNE_EMAIL_HOST")
    EMAIL_PORT = int(env("CERNE_EMAIL_PORT", "587"))
    EMAIL_HOST_USER = env("CERNE_EMAIL_USUARIO")
    EMAIL_HOST_PASSWORD = env("CERNE_EMAIL_SENHA")
    EMAIL_USE_TLS = env_bool("CERNE_EMAIL_TLS", True)
    EMAIL_USE_SSL = env_bool("CERNE_EMAIL_SSL", False)
else:
    EMAIL_BACKEND = "django.core.mail.backends.console.EmailBackend"

DEFAULT_FROM_EMAIL = env(
    "CERNE_EMAIL_REMETENTE", "nao-responder@acompanhamento-cerne.local"
)


# ============================================================================
# Segurança em produção
#
# Só entra em vigor fora do modo de desenvolvimento. Com o sistema exposto na
# internet e com login por pessoa, estes ajustes evitam que a sessão do usuário
# trafegue em claro.
#
# Desligue com CERNE_HTTPS=0 caso o sistema fique numa rede interna sem HTTPS —
# mas o recomendado é ter HTTPS.
# ============================================================================

if not DEBUG and not RODANDO_TESTES:
    USAR_HTTPS = env_bool("CERNE_HTTPS", True)

    # A plataforma de hospedagem normalmente encerra o HTTPS e repassa a
    # informação neste cabeçalho.
    SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")

    SECURE_SSL_REDIRECT = USAR_HTTPS
    SESSION_COOKIE_SECURE = USAR_HTTPS
    CSRF_COOKIE_SECURE = USAR_HTTPS

    if USAR_HTTPS:
        # 1 ano. Comece com um valor baixo (ex.: 3600) se estiver testando.
        SECURE_HSTS_SECONDS = int(env("CERNE_HSTS_SEGUNDOS", "31536000"))
        SECURE_HSTS_INCLUDE_SUBDOMAINS = True
        SECURE_HSTS_PRELOAD = True

    SECURE_CONTENT_TYPE_NOSNIFF = True
    X_FRAME_OPTIONS = "DENY"
    SESSION_COOKIE_HTTPONLY = True

    # Encerra a sessão após 12 horas de inatividade.
    SESSION_COOKIE_AGE = int(env("CERNE_SESSAO_SEGUNDOS", str(12 * 60 * 60)))
    SESSION_SAVE_EVERY_REQUEST = True
