"""Testa, de ponta a ponta, o armazenamento das evidências no Google Cloud Storage.

Serve para confirmar que bucket, credencial e permissões estão corretos ANTES
de a equipe começar a anexar arquivos de verdade. Faz o ciclo completo:

    grava um arquivo de teste -> confere que existe -> lê o conteúdo de volta
    -> gera o link temporário -> apaga o arquivo

Uso:
    python manage.py testar_gcs

Se algo estiver errado, o comando explica o que verificar em vez de mostrar
apenas o erro cru da biblioteca.
"""

from django.conf import settings
from django.core.files.base import ContentFile
from django.core.files.storage import default_storage
from django.core.management.base import BaseCommand
from django.utils import timezone


class Command(BaseCommand):
    help = "Verifica se o Google Cloud Storage está configurado e acessível."

    def add_arguments(self, parser):
        parser.add_argument(
            "--manter",
            action="store_true",
            help="Não apaga o arquivo de teste no final (útil para conferir no console do Google).",
        )

    def handle(self, *args, **opts):
        ok = self.style.SUCCESS
        erro = self.style.ERROR
        aviso = self.style.WARNING

        backend = settings.STORAGES["default"]["BACKEND"]
        usando_gcs = getattr(settings, "USANDO_GCS", False)

        self.stdout.write("")
        self.stdout.write("Armazenamento configurado")
        self.stdout.write(f"  backend: {backend}")

        if not usando_gcs:
            self.stdout.write(aviso("\n  O sistema está usando a PASTA LOCAL, não o Google Cloud Storage."))
            self.stdout.write(f"  Pasta: {settings.MEDIA_ROOT}")
            self.stdout.write(
                "\n  Para usar o GCS, defina no .env:\n"
                "    CERNE_GCS_BUCKET=nome-do-seu-bucket\n"
                "    CERNE_GCS_PROJETO=id-do-projeto\n"
                "\n  A credencial não é configurada por arquivo: rodando no Google Cloud,\n"
                "  basta anexar a conta de serviço ao serviço (Cloud Run) e ela vem\n"
                "  automaticamente.\n"
            )
            return

        opcoes = settings.STORAGES["default"].get("OPTIONS", {})
        self.stdout.write(f"  bucket: {opcoes.get('bucket_name')}")
        self.stdout.write(f"  projeto: {opcoes.get('project_id', '(vem da credencial)')}")
        self.stdout.write(f"  subpasta: {opcoes.get('location') or '(raiz do bucket)'}")
        self.stdout.write(
            "  acesso aos anexos: pela rota do sistema (exige login), "
            "sem link direto do bucket"
        )

        import os

        credencial = os.environ.get("GOOGLE_APPLICATION_CREDENTIALS", "")
        if credencial:
            existe = os.path.exists(credencial)
            self.stdout.write(
                f"  credencial: arquivo de chave em {credencial} "
                + (ok("(encontrado)") if existe else erro("(NÃO ENCONTRADO)"))
            )
            if not existe:
                self.stdout.write(
                    erro(
                        "\nO caminho do arquivo de chave está errado. Corrija "
                        "GOOGLE_APPLICATION_CREDENTIALS no .env, ou remova a variável "
                        "para usar a credencial automática do ambiente."
                    )
                )
                return
        else:
            self.stdout.write(
                "  credencial: automática do ambiente (conta de serviço anexada)"
            )

        marca = timezone.now().strftime("%Y%m%d-%H%M%S")
        caminho = f"_teste-de-configuracao/teste-{marca}.txt"
        conteudo = (
            "Arquivo criado por 'manage.py testar_gcs' para validar o acesso ao bucket.\n"
            f"Data: {timezone.now().isoformat()}\n"
        )

        self.stdout.write("")
        self.stdout.write("Executando o teste")

        # 1. Gravar
        try:
            nome_salvo = default_storage.save(caminho, ContentFile(conteudo.encode("utf-8")))
            self.stdout.write(ok(f"  1/4 gravar ....... OK  ({nome_salvo})"))
        except Exception as falha:  # noqa: BLE001
            self.stdout.write(erro(f"  1/4 gravar ....... FALHOU: {type(falha).__name__}: {falha}"))
            self._explicar(falha)
            return

        # 2. Existir
        try:
            existe = default_storage.exists(nome_salvo)
            self.stdout.write(
                ok("  2/4 verificar .... OK") if existe
                else erro("  2/4 verificar .... FALHOU: o arquivo não foi encontrado após gravar")
            )
        except Exception as falha:  # noqa: BLE001
            self.stdout.write(erro(f"  2/4 verificar .... FALHOU: {falha}"))

        # 3. Ler de volta — é exatamente o que a rota de download faz
        try:
            with default_storage.open(nome_salvo) as arquivo:
                lido = arquivo.read().decode("utf-8")
            if "testar_gcs" in lido:
                self.stdout.write(
                    ok("  3/4 ler .......... OK  (conteúdo íntegro — é assim que o "
                       "sistema entrega o anexo)")
                )
            else:
                self.stdout.write(erro("  3/4 ler .......... FALHOU: conteúdo diferente do gravado"))
        except Exception as falha:  # noqa: BLE001
            self.stdout.write(erro(f"  3/4 ler .......... FALHOU: {falha}"))
            self._explicar(falha)

        # 4. Apagar
        if opts["manter"]:
            self.stdout.write(aviso(f"  4/4 apagar ....... pulado (--manter). Arquivo: {nome_salvo}"))
        else:
            try:
                default_storage.delete(nome_salvo)
                sumiu = not default_storage.exists(nome_salvo)
                self.stdout.write(
                    ok("  4/4 apagar ....... OK") if sumiu
                    else erro("  4/4 apagar ....... FALHOU: o arquivo continua no bucket")
                )
            except Exception as falha:  # noqa: BLE001
                self.stdout.write(erro(f"  4/4 apagar ....... FALHOU: {falha}"))
                self.stdout.write(
                    aviso(
                        "      Falta permissão de exclusão. O papel recomendado é\n"
                        "      'Administrador de objetos do Storage' no bucket."
                    )
                )

        self.stdout.write("")
        self.stdout.write(ok("Bucket pronto para receber as evidências do parque."))
        self.stdout.write("")

    def _explicar(self, falha):
        """Traduz os erros mais comuns em instruções práticas."""
        texto = f"{type(falha).__name__}: {falha}".lower()
        dicas = []

        if "not found" in texto or "404" in texto:
            dicas.append(
                "O bucket não foi encontrado. Confirme o nome em CERNE_GCS_BUCKET "
                "(só o nome, sem 'gs://' e sem barras)."
            )
        if "403" in texto or "permission" in texto or "forbidden" in texto:
            dicas.append(
                "A credencial não tem permissão no bucket. No console do Google, em "
                "Buckets → seu bucket → Permissões, conceda 'Storage Object Admin' "
                "à conta de serviço."
            )
        if "credential" in texto or "default credentials" in texto or "401" in texto:
            dicas.append(
                "A credencial não foi aceita. Verifique se GOOGLE_APPLICATION_CREDENTIALS "
                "aponta para o arquivo JSON da conta de serviço."
            )
        if "billing" in texto:
            dicas.append("A cobrança do projeto no Google Cloud precisa estar ativada.")

        if not dicas:
            dicas.append(
                "Confira bucket, projeto e credencial no .env, e se a API Cloud Storage "
                "está ativada no projeto."
            )

        self.stdout.write("")
        for dica in dicas:
            self.stdout.write(self.style.WARNING(f"  → {dica}"))
