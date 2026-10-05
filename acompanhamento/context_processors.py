"""Contexto compartilhado por todas as telas.

O sistema acompanha um único parque (o IpêTech Paraíso), então em vez de cada
view carregar e repassar o mecanismo e a versão do modelo, esses dados entram
automaticamente no contexto de todo template.
"""

from catalogo.models import VersaoModelo

from .models import Mecanismo

# Permissões que caracterizam alguém que registra o acompanhamento
# (perfis "Gestor" e "Equipe" criados pelo comando criar_perfis).
PERMISSAO_REGISTRO = "acompanhamento.add_evidencia"


def parque_do_usuario():
    """Devolve o parque acompanhado.

    Prioriza o parque real (não marcado como exemplo). Se só existir o registro
    de demonstração, usa ele — assim o sistema nunca fica sem contexto.
    """
    return (
        Mecanismo.objects.filter(ativo=True, eh_exemplo=False).order_by("id").first()
        or Mecanismo.objects.filter(ativo=True).order_by("id").first()
        or Mecanismo.objects.order_by("id").first()
    )


def versao_do_catalogo():
    return (
        VersaoModelo.objects.filter(ativa=True).order_by("-ano").first()
        or VersaoModelo.objects.order_by("-ano").first()
    )


def parque(request):
    """Injeta mecanismo, versão e a permissão de registro em todo template."""
    usuario = getattr(request, "user", None)
    pode_registrar = bool(
        usuario
        and usuario.is_authenticated
        and (usuario.is_superuser or usuario.has_perm(PERMISSAO_REGISTRO))
    )
    return {
        "mecanismo": parque_do_usuario(),
        "versao": versao_do_catalogo(),
        "pode_registrar": pode_registrar,
    }
