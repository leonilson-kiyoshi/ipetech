# -*- coding: utf-8 -*-
"""Cria os perfis de acesso (grupos) do sistema, com suas permissões.

Perfis:
  - Gestor  : acesso total (todas as permissões de catálogo e acompanhamento).
  - Equipe  : registra o acompanhamento (adicionar/editar/ver em acompanhamento;
              apenas visualizar o catálogo).
  - Auditor : somente leitura (visualizar).

Uso:
    python manage.py criar_perfis

Depois, no admin (Autenticação → Usuários), adicione cada pessoa ao grupo
correspondente. Para quem vai EDITAR pelo admin, marque também "Membro da
equipe" (is_staff). Auditores não precisam de is_staff: usam apenas as telas web.
"""

import operator
from functools import reduce

from django.contrib.auth.models import Group, Permission
from django.core.management.base import BaseCommand
from django.db.models import Q

APPS_PROJETO = ["catalogo", "acompanhamento"]


class Command(BaseCommand):
    help = "Cria/atualiza os perfis Gestor, Equipe e Auditor."

    def _perms(self, app_labels=None, prefixos=None):
        qs = Permission.objects.filter(content_type__app_label__in=APPS_PROJETO)
        if app_labels:
            qs = qs.filter(content_type__app_label__in=app_labels)
        if prefixos:
            q = reduce(operator.or_, [Q(codename__startswith=p) for p in prefixos])
            qs = qs.filter(q)
        return list(qs)

    def handle(self, *args, **options):
        # Gestor: tudo
        gestor, _ = Group.objects.get_or_create(name="Gestor")
        gestor.permissions.set(self._perms())

        # Equipe: acompanhamento (add/change/view) + catálogo (view)
        equipe, _ = Group.objects.get_or_create(name="Equipe")
        equipe.permissions.set(
            self._perms(["acompanhamento"], ["add_", "change_", "view_"])
            + self._perms(["catalogo"], ["view_"])
        )

        # Auditor: somente leitura
        auditor, _ = Group.objects.get_or_create(name="Auditor")
        auditor.permissions.set(self._perms(prefixos=["view_"]))

        self.stdout.write(self.style.SUCCESS("Perfis criados/atualizados:"))
        for g in (gestor, equipe, auditor):
            self.stdout.write(f"  - {g.name}: {g.permissions.count()} permissões")
        self.stdout.write(
            "Dica: adicione os usuários aos grupos no admin. Para editar pelo admin, "
            "marque também 'Membro da equipe' (is_staff)."
        )
