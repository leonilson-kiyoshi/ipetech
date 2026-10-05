# -*- coding: utf-8 -*-
"""Backup do sistema: copia o banco (db.sqlite3) e as evidências (media/).

Uso:
    python manage.py backup
    python manage.py backup --dir "D:\\backups_cerne"     # destino personalizado
    python manage.py backup --zip                          # compacta em .zip

Gera uma pasta (ou .zip) datada, fácil de guardar em pen drive/nuvem.
Para restaurar: pare o servidor e substitua db.sqlite3 e a pasta media/ pelos do backup.
"""

import datetime
import shutil
from pathlib import Path

from django.conf import settings
from django.core.management.base import BaseCommand


class Command(BaseCommand):
    help = "Faz backup do banco de dados e das evidências em uma pasta (ou .zip) datada."

    def add_arguments(self, parser):
        parser.add_argument(
            "--dir", default=None,
            help="Pasta de destino (padrão: <projeto>/backups).",
        )
        parser.add_argument(
            "--zip", action="store_true",
            help="Compacta o backup em um único arquivo .zip.",
        )

    def handle(self, *args, **options):
        base = Path(settings.BASE_DIR)
        destino_base = Path(options["dir"]) if options["dir"] else base / "backups"
        ts = datetime.datetime.now().strftime("%Y-%m-%d_%H%M%S")
        pasta = destino_base / f"backup_{ts}"
        pasta.mkdir(parents=True, exist_ok=True)

        copiados = []

        db = Path(settings.DATABASES["default"]["NAME"])
        if db.exists():
            shutil.copy2(db, pasta / db.name)
            copiados.append(db.name)

        media = Path(settings.MEDIA_ROOT)
        if media.exists() and any(media.iterdir()):
            shutil.copytree(media, pasta / "media", dirs_exist_ok=True)
            copiados.append("media/ (evidências)")

        destino_final = pasta
        if options["zip"]:
            zip_path = shutil.make_archive(str(pasta), "zip", root_dir=pasta)
            shutil.rmtree(pasta)
            destino_final = Path(zip_path)

        self.stdout.write(self.style.SUCCESS(f"Backup criado em: {destino_final}"))
        self.stdout.write(
            "Conteúdo: " + (", ".join(copiados) if copiados else "nada ainda (banco/evidências vazios)")
        )
        self.stdout.write(
            "Guarde esta cópia em local seguro (pen drive, nuvem). "
            "Para restaurar, substitua db.sqlite3 e a pasta media/ pelos do backup."
        )
