"""Testes do motor de prontidão (radar) e das regras de completude das práticas."""

import datetime

from django.core.management import call_command
from django.test import TestCase

from catalogo.models import PraticaChave
from .models import Evidencia, Mecanismo, MedicaoMetrica, StatusPratica
from .services import calcular_prontidao


def _info_pratica(prontidao, codigo):
    """Localiza o dicionário de uma prática dentro do resultado de calcular_prontidao."""
    for nivel in prontidao["niveis"]:
        for proc in nivel["processos"]:
            for pi in proc["praticas"]:
                if pi["pratica"].codigo == codigo:
                    return pi
    return None


class ProntidaoTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        # Carrega o catálogo CERNE 2025 no banco de teste.
        call_command("seed_cerne")

    def test_catalogo_semeado(self):
        self.assertEqual(PraticaChave.objects.count(), 29)

    def test_mecanismo_novo_nao_esta_apto(self):
        mec = Mecanismo.objects.create(nome="Parque Teste")
        r = calcular_prontidao(mec)
        self.assertEqual(r["apto_nivel"], 0)
        self.assertEqual(r["total_praticas"], 29)
        self.assertEqual(r["total_completas"], 0)

    def test_pratica_so_fica_completa_com_evidencia_e_metrica(self):
        mec = Mecanismo.objects.create(nome="Parque Teste 2")
        p111 = PraticaChave.objects.get(codigo="1.1.1")

        # Só o status "Implantada" não basta.
        StatusPratica.objects.create(
            mecanismo=mec, pratica=p111,
            situacao=StatusPratica.Situacao.IMPLANTADA,
        )
        info = _info_pratica(calcular_prontidao(mec), "1.1.1")
        self.assertFalse(info["completa"])
        self.assertTrue(len(info["faltas"]) > 0)

        # Anexa evidência para cada requisito obrigatório e mede as métricas obrigatórias.
        for req in p111.requisitos_evidencia.filter(obrigatorio=True):
            Evidencia.objects.create(
                mecanismo=mec, pratica=p111, requisito=req, titulo=f"Ev {req.id}"
            )
        for met in p111.metricas.filter(obrigatoria=True):
            MedicaoMetrica.objects.create(
                mecanismo=mec, metrica=met, valor=10, data=datetime.date.today()
            )

        info = _info_pratica(calcular_prontidao(mec), "1.1.1")
        self.assertTrue(info["completa"], info["faltas"])

    def test_regra_acumulativa_exige_nivel_anterior(self):
        """Mesmo com o CERNE 2 completo, não fica apto se o CERNE 1 não estiver."""
        mec = Mecanismo.objects.create(nome="Parque Teste 3")
        for pratica in PraticaChave.objects.filter(processo__nivel__numero=2):
            StatusPratica.objects.create(
                mecanismo=mec, pratica=pratica,
                situacao=StatusPratica.Situacao.IMPLANTADA,
            )
            for req in pratica.requisitos_evidencia.filter(obrigatorio=True):
                Evidencia.objects.create(
                    mecanismo=mec, pratica=pratica, requisito=req, titulo="Ev"
                )
            for met in pratica.metricas.filter(obrigatoria=True):
                MedicaoMetrica.objects.create(
                    mecanismo=mec, metrica=met, valor=1, data=datetime.date.today()
                )
        r = calcular_prontidao(mec)
        self.assertEqual(r["apto_nivel"], 0)

    def test_exemplo_fica_apto_ao_cerne_1(self):
        call_command("seed_exemplo")
        mec = Mecanismo.objects.get(eh_exemplo=True)
        r = calcular_prontidao(mec)
        self.assertEqual(r["apto_nivel"], 1)
        # o nível 1 deve estar 100% completo
        nivel1 = next(n for n in r["niveis"] if n["nivel"].numero == 1)
        self.assertEqual(nivel1["completas"], nivel1["total"])


# ============================================================================
# Testes das telas e dos fluxos de registro
#
# O que importa aqui: o técnico consegue registrar tudo pelo sistema, sem o
# admin do Django; os arquivos vão para a pasta certa; e quem tem perfil de
# consulta não consegue gravar.
# ============================================================================

import shutil
import tempfile
from pathlib import Path

from django.contrib.auth.models import Group, Permission, User
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase, override_settings
from django.urls import reverse

from catalogo.models import DefinicaoMetrica, RequisitoEvidencia

from .models import Aprendizado, AvaliacaoEixo, Empreendimento, PlanoAcao

# Cada teste que sobe arquivo usa uma pasta temporária, para não sujar media/.
PASTA_TEMPORARIA = tempfile.mkdtemp(prefix="cerne-teste-")


@override_settings(MEDIA_ROOT=PASTA_TEMPORARIA)
class TelasTests(TestCase):
    """Todas as telas respondem e renderizam sem erro de template."""

    @classmethod
    def setUpTestData(cls):
        call_command("seed_cerne")
        cls.parque = Mecanismo.objects.create(
            nome="IpêTech Paraíso (teste)", cidade_uf="Paraíso/SP", nivel_almejado=2
        )
        cls.tecnico = User.objects.create_user("tecnico", password="senha-de-teste-123")
        # perfil Equipe: pode registrar
        call_command("criar_perfis")
        cls.tecnico.groups.add(Group.objects.get(name="Equipe"))

        cls.auditor = User.objects.create_user("auditor", password="senha-de-teste-123")
        cls.auditor.groups.add(Group.objects.get(name="Auditor"))

        cls.gestor = User.objects.create_superuser(
            "gestora", "gestora@exemplo.test", "senha-de-teste-123"
        )

    @classmethod
    def tearDownClass(cls):
        super().tearDownClass()
        shutil.rmtree(PASTA_TEMPORARIA, ignore_errors=True)

    def setUp(self):
        self.client.force_login(self.tecnico)

    def test_todas_as_telas_abrem(self):
        rotas = [
            ("dashboard", {}),
            ("registrar", {}),
            ("catalogo", {}),
            ("empreendimentos", {}),
            ("arquivos", {}),
            ("auditoria", {}),
            ("dossie", {}),
            ("guia", {}),
            ("manual", {}),
            ("pratica_detail", {"codigo": "1.1.1"}),
            ("registrar_acao", {"codigo": "1.1.1"}),
        ]
        for nome, kwargs in rotas:
            with self.subTest(rota=nome):
                resposta = self.client.get(reverse(nome, kwargs=kwargs))
                self.assertEqual(resposta.status_code, 200, f"{nome} não abriu")
                # o layout novo tem que estar presente
                self.assertContains(resposta, "IpêTech Paraíso")

    def test_configuracao_exige_equipe_gestora(self):
        # técnico não é is_staff: não entra
        self.assertEqual(self.client.get(reverse("configuracao")).status_code, 403)
        self.client.force_login(self.gestor)
        self.assertEqual(self.client.get(reverse("configuracao")).status_code, 200)

    def test_telas_exigem_login(self):
        self.client.logout()
        resposta = self.client.get(reverse("dashboard"))
        self.assertEqual(resposta.status_code, 302)
        self.assertIn("/accounts/login/", resposta["Location"])

    def test_catalogo_filtra_por_busca(self):
        resposta = self.client.get(reverse("catalogo"), {"q": "sensibilização"})
        self.assertEqual(resposta.status_code, 200)
        self.assertContains(resposta, "1.1.1")

    def test_catalogo_filtra_por_nivel(self):
        resposta = self.client.get(reverse("catalogo"), {"nivel": "4"})
        self.assertEqual(resposta.status_code, 200)
        self.assertNotContains(resposta, ">1.1.1<")

    def test_dossie_pdf_gera_arquivo(self):
        resposta = self.client.get(reverse("dossie_pdf"), {"nivel": "1"})
        self.assertEqual(resposta.status_code, 200)
        self.assertEqual(resposta["Content-Type"], "application/pdf")
        self.assertTrue(resposta["Content-Disposition"].startswith("attachment;"))
        self.assertGreater(len(resposta.content), 1000)
        self.assertTrue(resposta.content.startswith(b"%PDF"))


@override_settings(MEDIA_ROOT=PASTA_TEMPORARIA)
class RegistroTests(TestCase):
    """O técnico registra pelo sistema e os dados chegam ao banco."""

    @classmethod
    def setUpTestData(cls):
        call_command("seed_cerne")
        call_command("criar_perfis")
        cls.parque = Mecanismo.objects.create(nome="IpêTech Paraíso (teste)")
        cls.tecnico = User.objects.create_user("tecnico2", password="senha-de-teste-123")
        cls.tecnico.groups.add(Group.objects.get(name="Equipe"))
        cls.pratica = PraticaChave.objects.get(codigo="1.1.1")

    @classmethod
    def tearDownClass(cls):
        super().tearDownClass()
        shutil.rmtree(PASTA_TEMPORARIA, ignore_errors=True)

    def setUp(self):
        self.client.force_login(self.tecnico)
        self.url = reverse("pratica_detail", kwargs={"codigo": "1.1.1"})

    # ------------------------------------------------------------- situação

    def test_salvar_situacao_da_pratica(self):
        resposta = self.client.post(
            self.url,
            {
                "tipo": "status",
                "situacao": StatusPratica.Situacao.EM_ANDAMENTO,
                "percentual": 45,
                "observacoes": "Documentação em elaboração.",
            },
        )
        self.assertRedirects(resposta, self.url)
        status = StatusPratica.objects.get(mecanismo=self.parque, pratica=self.pratica)
        self.assertEqual(status.situacao, StatusPratica.Situacao.EM_ANDAMENTO)
        self.assertEqual(status.percentual, 45)
        # a autoria é registrada: é isso que dá rastreabilidade ao dossiê
        self.assertEqual(status.atualizado_por, self.tecnico)

    def test_percentual_fora_da_faixa_e_recusado(self):
        self.client.post(
            self.url,
            {"tipo": "status", "situacao": StatusPratica.Situacao.IMPLANTADA, "percentual": 150},
        )
        self.assertFalse(
            StatusPratica.objects.filter(mecanismo=self.parque, pratica=self.pratica).exists()
        )

    # ------------------------------------------------------------ evidência

    def test_anexar_evidencia_com_arquivo_salva_na_pasta_organizada(self):
        requisito = self.pratica.requisitos_evidencia.filter(obrigatorio=True).first()
        arquivo = SimpleUploadedFile(
            "Lista de Presença Palestra.pdf", b"%PDF-1.4 conteudo de teste",
            content_type="application/pdf",
        )
        resposta = self.client.post(
            self.url,
            {
                "tipo": "evidencia",
                "requisito": requisito.pk,
                "titulo": "Palestra no IFSULDEMINAS",
                "data_referencia": "2026-03-10",
                "responsavel": "Equipe de gestão",
                "descricao": "Lista de presença",
                "link": "",
                "arquivo": arquivo,
            },
        )
        self.assertRedirects(resposta, self.url)

        evidencia = Evidencia.objects.get(mecanismo=self.parque, pratica=self.pratica)
        self.assertEqual(evidencia.requisito, requisito)
        self.assertEqual(evidencia.criado_por, self.tecnico)

        # pasta: evidencias/CERNE1/1.1.1/2026/<nome-saneado>.pdf
        caminho = evidencia.arquivo.name
        self.assertTrue(caminho.startswith("evidencias/CERNE1/1.1.1/2026/"), caminho)
        self.assertTrue(caminho.endswith(".pdf"), caminho)
        # nome saneado: sem espaços nem acentos
        self.assertNotIn(" ", caminho)
        self.assertIn("lista-de-presenca-palestra", caminho)

    def test_evidencia_so_com_link_e_aceita(self):
        requisito = self.pratica.requisitos_evidencia.first()
        resposta = self.client.post(
            self.url,
            {
                "tipo": "evidencia",
                "requisito": requisito.pk,
                "titulo": "Procedimento no Drive",
                "data_referencia": "2026-03-10",
                "link": "https://drive.exemplo.test/procedimento",
            },
        )
        self.assertRedirects(resposta, self.url)
        self.assertTrue(Evidencia.objects.filter(titulo="Procedimento no Drive").exists())

    def test_evidencia_sem_arquivo_nem_link_e_recusada(self):
        requisito = self.pratica.requisitos_evidencia.first()
        self.client.post(
            self.url,
            {
                "tipo": "evidencia",
                "requisito": requisito.pk,
                "titulo": "Sem comprovação",
                "data_referencia": "2026-03-10",
            },
        )
        self.assertFalse(Evidencia.objects.filter(titulo="Sem comprovação").exists())

    def test_arquivo_de_tipo_proibido_e_recusado(self):
        requisito = self.pratica.requisitos_evidencia.first()
        malicioso = SimpleUploadedFile(
            "script.exe", b"MZ binario", content_type="application/octet-stream"
        )
        self.client.post(
            self.url,
            {
                "tipo": "evidencia",
                "requisito": requisito.pk,
                "titulo": "Executável",
                "data_referencia": "2026-03-10",
                "arquivo": malicioso,
            },
        )
        self.assertFalse(Evidencia.objects.filter(titulo="Executável").exists())

    def test_excluir_evidencia_remove_registro(self):
        requisito = self.pratica.requisitos_evidencia.first()
        evidencia = Evidencia.objects.create(
            mecanismo=self.parque, pratica=self.pratica, requisito=requisito,
            titulo="Para remover", link="https://exemplo.test/x",
        )
        resposta = self.client.post(
            self.url, {"tipo": "excluir_evidencia", "id": evidencia.pk}
        )
        self.assertRedirects(resposta, self.url)
        self.assertFalse(Evidencia.objects.filter(pk=evidencia.pk).exists())

    # -------------------------------------------------------------- medição

    def test_lancar_medicao(self):
        metrica = self.pratica.metricas.first()
        resposta = self.client.post(
            self.url,
            {"tipo": "medicao", "metrica": metrica.pk, "valor": "80", "data": "2026-03-10",
             "observacao": "Palestra"},
        )
        self.assertRedirects(resposta, self.url)
        medicao = MedicaoMetrica.objects.get(mecanismo=self.parque, metrica=metrica)
        self.assertEqual(int(medicao.valor), 80)
        self.assertEqual(medicao.criado_por, self.tecnico)

    # ------------------------------------------------- revisão e plano

    def test_registrar_revisao_critica(self):
        resposta = self.client.post(
            self.url,
            {
                "tipo": "revisao", "data": "2026-03-10", "periodo": "1º semestre",
                "eficiencia": "Dentro do previsto", "eficacia": "Boa",
                "efetividade": "Aumentou as propostas", "observacoes": "",
            },
        )
        self.assertRedirects(resposta, self.url)
        revisao = Aprendizado.objects.get(mecanismo=self.parque, pratica=self.pratica)
        self.assertEqual(revisao.periodo, "1º semestre")
        self.assertEqual(revisao.criado_por, self.tecnico)

    def test_criar_e_concluir_plano_de_acao(self):
        self.client.post(
            self.url,
            {"tipo": "plano", "descricao": "Documentar o procedimento",
             "responsavel": "Coordenação", "prazo": "2026-06-30", "situacao": "aberto"},
        )
        plano = PlanoAcao.objects.get(mecanismo=self.parque, pratica=self.pratica)
        self.assertEqual(plano.situacao, PlanoAcao.Situacao.ABERTO)

        self.client.post(self.url, {"tipo": "concluir_plano", "id": plano.pk})
        plano.refresh_from_db()
        self.assertEqual(plano.situacao, PlanoAcao.Situacao.CONCLUIDO)

    # ------------------------------------------------- registro rápido

    def test_registro_rapido_cria_evidencia_medicao_e_status(self):
        """O fluxo do dia a dia: uma ação que gera tudo de uma vez."""
        requisito = self.pratica.requisitos_evidencia.filter(obrigatorio=True).first()
        metrica = self.pratica.metricas.filter(obrigatoria=True).first()
        arquivo = SimpleUploadedFile(
            "fotos.jpg", b"\xff\xd8\xff conteudo", content_type="image/jpeg"
        )

        resposta = self.client.post(
            reverse("registrar_acao", kwargs={"codigo": "1.1.1"}),
            {
                "titulo": "Palestra de sensibilização no IFSULDEMINAS",
                "data_referencia": "2026-04-02",
                "responsavel": "Coordenação",
                "descricao": "80 alunos de engenharia",
                "requisito": requisito.pk,
                "arquivo": arquivo,
                "link": "",
                "metrica": metrica.pk,
                "valor": "80",
                "marcar_implantada": "on",
            },
        )
        self.assertRedirects(resposta, self.url)

        evidencia = Evidencia.objects.get(titulo__startswith="Palestra de sensibilização")
        self.assertEqual(evidencia.requisito, requisito)
        self.assertTrue(evidencia.arquivo.name.startswith("evidencias/CERNE1/1.1.1/2026/"))

        medicao = MedicaoMetrica.objects.get(metrica=metrica)
        self.assertEqual(int(medicao.valor), 80)
        # a medição herda a data da ação, não a data de hoje
        self.assertEqual(medicao.data.isoformat(), "2026-04-02")

        status = StatusPratica.objects.get(mecanismo=self.parque, pratica=self.pratica)
        self.assertEqual(status.situacao, StatusPratica.Situacao.IMPLANTADA)

    def test_registro_rapido_exige_comprovacao(self):
        resposta = self.client.post(
            reverse("registrar_acao", kwargs={"codigo": "1.1.1"}),
            {"titulo": "Ação sem prova", "data_referencia": "2026-04-02"},
        )
        self.assertEqual(resposta.status_code, 200)  # volta com erro, não redireciona
        self.assertFalse(Evidencia.objects.filter(titulo="Ação sem prova").exists())

    def test_registro_rapido_exige_valor_quando_escolhe_metrica(self):
        metrica = self.pratica.metricas.first()
        resposta = self.client.post(
            reverse("registrar_acao", kwargs={"codigo": "1.1.1"}),
            {
                "titulo": "Ação com métrica sem valor",
                "data_referencia": "2026-04-02",
                "link": "https://exemplo.test/x",
                "metrica": metrica.pk,
            },
        )
        self.assertEqual(resposta.status_code, 200)
        self.assertFalse(MedicaoMetrica.objects.filter(metrica=metrica).exists())

    # ------------------------------------------------- empreendimentos

    def test_cadastrar_empreendimento_e_avaliar_eixo(self):
        resposta = self.client.post(
            reverse("empreendimentos"),
            {
                "nome": "AgroSense", "setor": "Agro", "estagio": "operacao",
                "situacao": "apoiado", "data_entrada": "2026-01-15",
                "data_graduacao": "", "responsavel": "Ana", "descricao": "Sensores",
            },
        )
        empreendimento = Empreendimento.objects.get(nome="AgroSense")
        self.assertRedirects(
            resposta, reverse("empreendimento_detail", kwargs={"pk": empreendimento.pk})
        )
        self.assertEqual(empreendimento.mecanismo, self.parque)

        url = reverse("empreendimento_detail", kwargs={"pk": empreendimento.pk})
        self.client.post(
            url,
            {"tipo": "avaliacao", "eixo": "tecnologia", "nota": 4,
             "data": "2026-03-01", "observacao": "MVP validado"},
        )
        avaliacao = AvaliacaoEixo.objects.get(empreendimento=empreendimento)
        self.assertEqual(avaliacao.nota, 4)

        # o radar precisa ser desenhável com a nota registrada
        resposta = self.client.get(url)
        self.assertEqual(resposta.status_code, 200)
        self.assertContains(resposta, "<svg")

    def test_graduacao_antes_da_entrada_e_recusada(self):
        self.client.post(
            reverse("empreendimentos"),
            {
                "nome": "Data Invertida", "estagio": "ideia", "situacao": "graduado",
                "data_entrada": "2026-05-01", "data_graduacao": "2026-01-01",
            },
        )
        self.assertFalse(Empreendimento.objects.filter(nome="Data Invertida").exists())

    def test_nota_de_eixo_fora_da_faixa_e_recusada(self):
        empreendimento = Empreendimento.objects.create(
            mecanismo=self.parque, nome="Teste Nota"
        )
        self.client.post(
            reverse("empreendimento_detail", kwargs={"pk": empreendimento.pk}),
            {"tipo": "avaliacao", "eixo": "capital", "nota": 9, "data": "2026-03-01"},
        )
        self.assertFalse(AvaliacaoEixo.objects.filter(empreendimento=empreendimento).exists())

    # ------------------------------------------------- prontidão ponta a ponta

    def test_completar_pratica_pelo_sistema_reflete_na_prontidao(self):
        """Registrando pela interface, a prática fica completa de verdade."""
        info = _info_pratica(calcular_prontidao(self.parque), "1.1.1")
        self.assertFalse(info["completa"])

        for requisito in self.pratica.requisitos_evidencia.filter(obrigatorio=True):
            self.client.post(
                self.url,
                {
                    "tipo": "evidencia", "requisito": requisito.pk,
                    "titulo": f"Evidência {requisito.pk}",
                    "data_referencia": "2026-03-10",
                    "link": "https://exemplo.test/doc",
                },
            )
        for metrica in self.pratica.metricas.filter(obrigatoria=True):
            self.client.post(
                self.url,
                {"tipo": "medicao", "metrica": metrica.pk, "valor": "10",
                 "data": "2026-03-10"},
            )
        self.client.post(
            self.url,
            {"tipo": "status", "situacao": StatusPratica.Situacao.IMPLANTADA,
             "percentual": 100},
        )

        info = _info_pratica(calcular_prontidao(self.parque), "1.1.1")
        self.assertTrue(info["completa"], info["faltas"])


@override_settings(MEDIA_ROOT=PASTA_TEMPORARIA)
class PermissaoTests(TestCase):
    """Perfil de consulta (Auditor) lê tudo, mas não grava nada."""

    @classmethod
    def setUpTestData(cls):
        call_command("seed_cerne")
        call_command("criar_perfis")
        cls.parque = Mecanismo.objects.create(nome="IpêTech Paraíso (teste)")
        cls.auditor = User.objects.create_user("auditor2", password="senha-de-teste-123")
        cls.auditor.groups.add(Group.objects.get(name="Auditor"))
        cls.pratica = PraticaChave.objects.get(codigo="1.1.1")

    @classmethod
    def tearDownClass(cls):
        super().tearDownClass()
        shutil.rmtree(PASTA_TEMPORARIA, ignore_errors=True)

    def setUp(self):
        self.client.force_login(self.auditor)

    def test_auditor_consulta_as_telas(self):
        for nome in ["dashboard", "catalogo", "auditoria", "dossie", "arquivos"]:
            with self.subTest(rota=nome):
                self.assertEqual(self.client.get(reverse(nome)).status_code, 200)

    def test_auditor_nao_ve_formulario_de_registro(self):
        resposta = self.client.get(
            reverse("pratica_detail", kwargs={"codigo": "1.1.1"})
        )
        self.assertEqual(resposta.status_code, 200)
        self.assertNotContains(resposta, "Salvar situação")

    def test_auditor_nao_consegue_gravar_status(self):
        resposta = self.client.post(
            reverse("pratica_detail", kwargs={"codigo": "1.1.1"}),
            {"tipo": "status", "situacao": StatusPratica.Situacao.IMPLANTADA,
             "percentual": 100},
        )
        self.assertEqual(resposta.status_code, 403)
        self.assertFalse(StatusPratica.objects.exists())

    def test_auditor_nao_consegue_anexar_evidencia(self):
        requisito = self.pratica.requisitos_evidencia.first()
        resposta = self.client.post(
            reverse("pratica_detail", kwargs={"codigo": "1.1.1"}),
            {"tipo": "evidencia", "requisito": requisito.pk, "titulo": "X",
             "link": "https://exemplo.test/x", "data_referencia": "2026-03-10"},
        )
        self.assertEqual(resposta.status_code, 403)
        self.assertFalse(Evidencia.objects.exists())

    def test_auditor_nao_consegue_cadastrar_empreendimento(self):
        resposta = self.client.post(
            reverse("empreendimentos"),
            {"nome": "Proibido", "estagio": "ideia", "situacao": "apoiado"},
        )
        self.assertEqual(resposta.status_code, 403)
        self.assertFalse(Empreendimento.objects.exists())


# ============================================================================
# Entrega dos anexos
#
# Os arquivos de evidência saem pela rota 'evidencia_arquivo', e não por link
# direto do armazenamento. Estes testes garantem as duas promessas disso:
# só usuário logado baixa, e ninguém alcança arquivo de outro parque.
# ============================================================================


@override_settings(MEDIA_ROOT=PASTA_TEMPORARIA)
class EntregaDeArquivoTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        call_command("seed_cerne")
        call_command("criar_perfis")
        cls.parque = Mecanismo.objects.create(nome="IpêTech Paraíso (teste)")
        # Segundo parque, só para provar o isolamento entre registros.
        cls.outro_parque = Mecanismo.objects.create(
            nome="Outro parque", eh_exemplo=True
        )
        cls.pratica = PraticaChave.objects.get(codigo="1.1.1")

        cls.tecnico = User.objects.create_user("tecnico3", password="senha-de-teste-123")
        cls.tecnico.groups.add(Group.objects.get(name="Equipe"))
        cls.auditor = User.objects.create_user("auditor3", password="senha-de-teste-123")
        cls.auditor.groups.add(Group.objects.get(name="Auditor"))

    @classmethod
    def tearDownClass(cls):
        super().tearDownClass()
        shutil.rmtree(PASTA_TEMPORARIA, ignore_errors=True)

    def _criar_evidencia(
        self, mecanismo=None, conteudo=b"%PDF-1.4 teste", nome="doc.pdf", requisito=None
    ):
        evidencia = Evidencia(
            mecanismo=mecanismo or self.parque,
            pratica=self.pratica,
            requisito=requisito
            or self.pratica.requisitos_evidencia.filter(obrigatorio=True).first(),
            titulo="Documento de teste",
            data_referencia=datetime.date(2026, 3, 10),
        )
        evidencia.arquivo.save(nome, SimpleUploadedFile(nome, conteudo), save=False)
        evidencia.save()
        return evidencia

    def _baixar(self, resposta):
        """FileResponse é transmitido em blocos; junta tudo para comparar."""
        return b"".join(resposta.streaming_content)

    # ----------------------------------------------------------- sem login

    def test_sem_login_nao_baixa(self):
        evidencia = self._criar_evidencia()
        resposta = self.client.get(
            reverse("evidencia_arquivo", kwargs={"pk": evidencia.pk})
        )
        self.assertEqual(resposta.status_code, 302)
        self.assertIn("/accounts/login/", resposta["Location"])

    def test_pasta_media_nao_e_servida_diretamente(self):
        """A pasta dos anexos não pode ser alcançada por URL, nem em DEBUG."""
        evidencia = self._criar_evidencia()
        resposta = self.client.get(f"/media/{evidencia.arquivo.name}")
        self.assertIn(resposta.status_code, (404, 301, 302))
        self.assertNotEqual(resposta.status_code, 200)

    # ----------------------------------------------------------- com login

    def test_com_login_baixa_e_conteudo_confere(self):
        evidencia = self._criar_evidencia(conteudo=b"%PDF-1.4 conteudo exato")
        self.client.force_login(self.tecnico)
        resposta = self.client.get(
            reverse("evidencia_arquivo", kwargs={"pk": evidencia.pk})
        )
        self.assertEqual(resposta.status_code, 200)
        self.assertEqual(self._baixar(resposta), b"%PDF-1.4 conteudo exato")
        self.assertEqual(resposta["Content-Type"], "application/pdf")

    def test_auditor_tambem_baixa(self):
        """Perfil de consulta não registra, mas precisa ler para auditar."""
        evidencia = self._criar_evidencia()
        self.client.force_login(self.auditor)
        resposta = self.client.get(
            reverse("evidencia_arquivo", kwargs={"pk": evidencia.pk})
        )
        self.assertEqual(resposta.status_code, 200)

    # ------------------------------------------------------------ cabeçalhos

    def test_pdf_abre_na_aba_e_planilha_baixa(self):
        pdf = self._criar_evidencia(nome="relatorio.pdf", conteudo=b"%PDF-1.4 x")
        planilha = self._criar_evidencia(
            nome="planilha.xlsx", conteudo=b"PK conteudo-xlsx"
        )
        self.client.force_login(self.tecnico)

        resposta = self.client.get(reverse("evidencia_arquivo", kwargs={"pk": pdf.pk}))
        self.assertIn("inline", resposta["Content-Disposition"])

        resposta = self.client.get(
            reverse("evidencia_arquivo", kwargs={"pk": planilha.pk})
        )
        self.assertIn("attachment", resposta["Content-Disposition"])

    def test_cabecalhos_de_protecao(self):
        evidencia = self._criar_evidencia()
        self.client.force_login(self.tecnico)
        resposta = self.client.get(
            reverse("evidencia_arquivo", kwargs={"pk": evidencia.pk})
        )
        self.assertEqual(resposta["X-Content-Type-Options"], "nosniff")
        self.assertIn("no-store", resposta["Cache-Control"])

    # -------------------------------------------------------- isolamento

    def test_evidencia_de_outro_parque_nao_e_alcancavel(self):
        """Trocar o número na URL não dá acesso a registro de outro parque."""
        alheia = self._criar_evidencia(mecanismo=self.outro_parque)
        self.client.force_login(self.tecnico)
        resposta = self.client.get(
            reverse("evidencia_arquivo", kwargs={"pk": alheia.pk})
        )
        self.assertEqual(resposta.status_code, 404)

    def test_evidencia_inexistente_da_404(self):
        self.client.force_login(self.tecnico)
        resposta = self.client.get(reverse("evidencia_arquivo", kwargs={"pk": 999999}))
        self.assertEqual(resposta.status_code, 404)

    def test_evidencia_so_com_link_da_404(self):
        """Evidência registrada como link não tem arquivo para entregar."""
        evidencia = Evidencia.objects.create(
            mecanismo=self.parque,
            pratica=self.pratica,
            titulo="Somente link",
            link="https://exemplo.test/documento",
        )
        self.client.force_login(self.tecnico)
        resposta = self.client.get(
            reverse("evidencia_arquivo", kwargs={"pk": evidencia.pk})
        )
        self.assertEqual(resposta.status_code, 404)

    def test_arquivo_ausente_no_disco_da_404_em_vez_de_erro_500(self):
        """Banco restaurado sem os arquivos não deve derrubar a página."""
        evidencia = self._criar_evidencia()
        caminho = Path(PASTA_TEMPORARIA) / evidencia.arquivo.name
        caminho.unlink()

        self.client.force_login(self.tecnico)
        resposta = self.client.get(
            reverse("evidencia_arquivo", kwargs={"pk": evidencia.pk})
        )
        self.assertEqual(resposta.status_code, 404)

    # ------------------------------------------------ uso nos templates

    def test_telas_usam_a_rota_e_nao_link_direto(self):
        """Nenhuma tela deve apontar para a URL do armazenamento."""
        evidencia = self._criar_evidencia()
        esperado = reverse("evidencia_arquivo", kwargs={"pk": evidencia.pk})
        self.client.force_login(self.tecnico)

        for nome, kwargs in [
            ("pratica_detail", {"codigo": "1.1.1"}),
            ("arquivos", {}),
            ("dossie", {}),
        ]:
            with self.subTest(tela=nome):
                resposta = self.client.get(reverse(nome, kwargs=kwargs))
                self.assertContains(resposta, esperado)
                # não deve existir link apontando para a pasta de mídia
                self.assertNotContains(resposta, f'href="/media/')

    def test_evidencia_sem_requisito_aparece_no_dossie(self):
        """Anexo sem vínculo não pode desaparecer do documento da auditoria."""
        solta = Evidencia(
            mecanismo=self.parque,
            pratica=self.pratica,
            requisito=None,
            titulo="Anexo sem vinculo",
            data_referencia=datetime.date(2026, 3, 10),
        )
        solta.arquivo.save(
            "solto.pdf", SimpleUploadedFile("solto.pdf", b"%PDF-1.4 x"), save=False
        )
        solta.save()

        self.client.force_login(self.tecnico)
        resposta = self.client.get(reverse("dossie"))
        self.assertEqual(resposta.status_code, 200)
        self.assertContains(resposta, "Anexo sem vinculo")
        self.assertContains(resposta, "sem requisito vinculado")
        self.assertContains(
            resposta, reverse("evidencia_arquivo", kwargs={"pk": solta.pk})
        )
