"""Modelos de acompanhamento.

Guardam os dados reais do parque tecnológico na jornada CERNE: o mecanismo, o
status de cada prática-chave, as evidências enviadas, as medições das métricas,
as revisões críticas (aprendizado) e os planos de ação.

Todos os registros que compõem a trilha de auditoria carregam data e autor
(`criado_em`/`criado_por`), para que a equipe do CERNE consiga auditar com
facilidade quando a certificação for solicitada.
"""

from django.conf import settings
from django.core.exceptions import ObjectDoesNotExist
from django.db import models
from django.utils import timezone

from catalogo.models import DefinicaoMetrica, PraticaChave, RequisitoEvidencia


class Mecanismo(models.Model):
    """O mecanismo de inovação acompanhado (o parque tecnológico)."""

    nome = models.CharField("nome", max_length=200)
    tipo = models.CharField(
        "tipo",
        max_length=100,
        blank=True,
        help_text="ex.: parque tecnológico, incubadora, aceleradora",
    )
    cidade_uf = models.CharField("cidade/UF", max_length=120, blank=True)
    nivel_almejado = models.PositiveSmallIntegerField(
        "nível CERNE almejado", null=True, blank=True, help_text="1 a 4"
    )
    descricao = models.TextField("descrição", blank=True)
    ativo = models.BooleanField("ativo", default=True)
    eh_exemplo = models.BooleanField(
        "é registro de exemplo/demonstração",
        default=False,
        help_text="Marque para dados de demonstração; facilita distinguir do parque real.",
    )
    criado_em = models.DateTimeField("criado em", auto_now_add=True)

    class Meta:
        verbose_name = "mecanismo de inovação"
        verbose_name_plural = "mecanismos de inovação"
        ordering = ["nome"]

    def __str__(self):
        return self.nome


class StatusPratica(models.Model):
    """Situação de implantação de uma prática-chave para um mecanismo."""

    class Situacao(models.TextChoices):
        NAO_INICIADA = "nao_iniciada", "Não iniciada"
        EM_ANDAMENTO = "em_andamento", "Em andamento"
        IMPLANTADA = "implantada", "Implantada"
        EM_REVISAO = "em_revisao", "Em revisão"

    mecanismo = models.ForeignKey(
        Mecanismo,
        on_delete=models.CASCADE,
        related_name="status_praticas",
        verbose_name="mecanismo",
    )
    pratica = models.ForeignKey(
        PraticaChave,
        on_delete=models.CASCADE,
        related_name="status",
        verbose_name="prática-chave",
    )
    situacao = models.CharField(
        "situação",
        max_length=20,
        choices=Situacao.choices,
        default=Situacao.NAO_INICIADA,
    )
    percentual = models.PositiveSmallIntegerField(
        "percentual de implantação", default=0, help_text="0 a 100"
    )
    observacoes = models.TextField("observações", blank=True)
    atualizado_em = models.DateTimeField("atualizado em", auto_now=True)
    atualizado_por = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="+",
        verbose_name="atualizado por",
    )

    class Meta:
        verbose_name = "status de prática"
        verbose_name_plural = "status de práticas"
        ordering = ["pratica__codigo"]
        constraints = [
            models.UniqueConstraint(
                fields=["mecanismo", "pratica"],
                name="uniq_status_por_mecanismo_pratica",
            ),
        ]

    def __str__(self):
        return f"{self.pratica.codigo} — {self.get_situacao_display()}"

    @property
    def implantada(self):
        return self.situacao == self.Situacao.IMPLANTADA


def evidencia_upload_path(instance, filename):
    """Monta o caminho do arquivo dentro de MEDIA_ROOT.

    O objetivo é que a pasta de evidências seja navegável por uma pessoa, sem
    depender do sistema: quem abrir o disco encontra os arquivos na mesma
    ordem em que a auditoria pede.

        media/evidencias/CERNE1/1.1.1/2026/lista-de-presenca.pdf

    O nome do arquivo é saneado (sem acentos, espaços ou caracteres de
    caminho) para não quebrar em servidores Linux nem permitir escapar da
    pasta de destino.
    """
    from django.utils.text import slugify

    codigo = "sem-pratica"
    nivel = "sem-nivel"
    if instance.pratica_id:
        pratica = instance.pratica
        codigo = pratica.codigo
        try:
            nivel = f"CERNE{pratica.processo.nivel.numero}"
        except (AttributeError, ObjectDoesNotExist):
            nivel = "sem-nivel"

    referencia = getattr(instance, "data_referencia", None)
    ano = referencia.year if referencia else timezone.now().year

    nome_original = (filename or "arquivo").rsplit("/", 1)[-1].rsplit("\\", 1)[-1]
    if "." in nome_original:
        base, _, extensao = nome_original.rpartition(".")
        extensao = "." + slugify(extensao)[:10]
    else:
        base, extensao = nome_original, ""
    base_segura = slugify(base)[:80] or "arquivo"

    # slugify já remove separadores de caminho, então o nome final é seguro.
    return f"evidencias/{nivel}/{codigo}/{ano}/{base_segura}{extensao}"


class Evidencia(models.Model):
    """Arquivo/registro que comprova uma prática-chave (auditável)."""

    mecanismo = models.ForeignKey(
        Mecanismo,
        on_delete=models.CASCADE,
        related_name="evidencias",
        verbose_name="mecanismo",
    )
    pratica = models.ForeignKey(
        PraticaChave,
        on_delete=models.CASCADE,
        related_name="evidencias",
        verbose_name="prática-chave",
    )
    requisito = models.ForeignKey(
        RequisitoEvidencia,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="evidencias",
        verbose_name="requisito atendido",
    )
    titulo = models.CharField("título", max_length=200)
    arquivo = models.FileField(
        "arquivo", upload_to=evidencia_upload_path, blank=True
    )
    link = models.URLField(
        "link externo",
        blank=True,
        help_text="use se a evidência for um link em vez de arquivo",
    )
    descricao = models.TextField("descrição", blank=True)
    data_referencia = models.DateField(
        "data de referência",
        null=True,
        blank=True,
        help_text="data a que a evidência se refere",
    )
    responsavel = models.CharField("responsável", max_length=150, blank=True)
    criado_em = models.DateTimeField("registrado em", auto_now_add=True)
    criado_por = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="+",
        verbose_name="registrado por",
    )

    class Meta:
        verbose_name = "evidência"
        verbose_name_plural = "evidências"
        ordering = ["-criado_em"]

    def __str__(self):
        return self.titulo


class MedicaoMetrica(models.Model):
    """Medição de uma métrica em uma data (série histórica, comparada à meta)."""

    mecanismo = models.ForeignKey(
        Mecanismo,
        on_delete=models.CASCADE,
        related_name="medicoes",
        verbose_name="mecanismo",
    )
    metrica = models.ForeignKey(
        DefinicaoMetrica,
        on_delete=models.CASCADE,
        related_name="medicoes",
        verbose_name="métrica",
    )
    valor = models.DecimalField("valor", max_digits=14, decimal_places=2)
    data = models.DateField("data da medição")
    observacao = models.TextField("observação", blank=True)
    criado_em = models.DateTimeField("registrado em", auto_now_add=True)
    criado_por = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="+",
        verbose_name="registrado por",
    )

    class Meta:
        verbose_name = "medição de métrica"
        verbose_name_plural = "medições de métrica"
        ordering = ["-data"]

    def __str__(self):
        return f"{self.metrica.nome}: {self.valor} ({self.data})"


class Aprendizado(models.Model):
    """Revisão crítica de uma prática: eficiência, eficácia e efetividade."""

    mecanismo = models.ForeignKey(
        Mecanismo,
        on_delete=models.CASCADE,
        related_name="aprendizados",
        verbose_name="mecanismo",
    )
    pratica = models.ForeignKey(
        PraticaChave,
        on_delete=models.CASCADE,
        related_name="aprendizados",
        verbose_name="prática-chave",
    )
    data = models.DateField("data da revisão")
    periodo = models.CharField("período avaliado", max_length=100, blank=True)
    eficiencia = models.TextField("eficiência (produtividade)", blank=True)
    eficacia = models.TextField("eficácia (qualidade)", blank=True)
    efetividade = models.TextField("efetividade (resultados/impacto)", blank=True)
    necessita_ajustes = models.BooleanField("necessita ajustes?", default=False)
    observacoes = models.TextField("observações", blank=True)
    criado_em = models.DateTimeField("registrado em", auto_now_add=True)
    criado_por = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="+",
        verbose_name="registrado por",
    )

    class Meta:
        verbose_name = "revisão crítica (aprendizado)"
        verbose_name_plural = "revisões críticas (aprendizado)"
        ordering = ["-data"]

    def __str__(self):
        return f"Revisão {self.pratica.codigo} ({self.data})"


class PlanoAcao(models.Model):
    """Ação de melhoria vinculada (ou não) a uma prática-chave."""

    class Situacao(models.TextChoices):
        ABERTO = "aberto", "Aberto"
        EM_ANDAMENTO = "em_andamento", "Em andamento"
        CONCLUIDO = "concluido", "Concluído"
        CANCELADO = "cancelado", "Cancelado"

    mecanismo = models.ForeignKey(
        Mecanismo,
        on_delete=models.CASCADE,
        related_name="planos_acao",
        verbose_name="mecanismo",
    )
    pratica = models.ForeignKey(
        PraticaChave,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="planos_acao",
        verbose_name="prática-chave",
    )
    descricao = models.TextField("descrição da ação")
    responsavel = models.CharField("responsável", max_length=150, blank=True)
    prazo = models.DateField("prazo", null=True, blank=True)
    situacao = models.CharField(
        "situação", max_length=20, choices=Situacao.choices, default=Situacao.ABERTO
    )
    criado_em = models.DateTimeField("criado em", auto_now_add=True)
    criado_por = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="+",
        verbose_name="criado por",
    )

    class Meta:
        verbose_name = "plano de ação"
        verbose_name_plural = "planos de ação"
        ordering = ["prazo"]

    def __str__(self):
        return self.descricao[:60]


class Empreendimento(models.Model):
    """Empreendimento apoiado pelo mecanismo (incubado/residente ou graduado)."""

    class Estagio(models.TextChoices):
        IDEIA = "ideia", "Ideia"
        PROTOTIPO = "prototipo", "Protótipo/MVP"
        OPERACAO = "operacao", "Em operação"
        CRESCIMENTO = "crescimento", "Em crescimento"

    class Situacao(models.TextChoices):
        APOIADO = "apoiado", "Apoiado (incubado)"
        GRADUADO = "graduado", "Graduado"
        DESLIGADO = "desligado", "Desligado"

    mecanismo = models.ForeignKey(
        Mecanismo,
        on_delete=models.CASCADE,
        related_name="empreendimentos",
        verbose_name="mecanismo",
    )
    nome = models.CharField("nome", max_length=200)
    setor = models.CharField(
        "setor", max_length=120, blank=True, help_text="ex.: TIC, biotecnologia, agro"
    )
    estagio = models.CharField(
        "estágio", max_length=20, choices=Estagio.choices, default=Estagio.IDEIA
    )
    situacao = models.CharField(
        "situação", max_length=20, choices=Situacao.choices, default=Situacao.APOIADO
    )
    data_entrada = models.DateField("data de entrada", null=True, blank=True)
    data_graduacao = models.DateField("data de graduação", null=True, blank=True)
    responsavel = models.CharField("responsável/contato", max_length=150, blank=True)
    descricao = models.TextField("descrição", blank=True)
    criado_em = models.DateTimeField("criado em", auto_now_add=True)
    criado_por = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="+",
        verbose_name="criado por",
    )

    class Meta:
        verbose_name = "empreendimento"
        verbose_name_plural = "empreendimentos"
        ordering = ["nome"]

    def __str__(self):
        return self.nome


class AvaliacaoEixo(models.Model):
    """Avaliação (0 a 5) da evolução de um empreendimento em um dos 5 eixos do CERNE."""

    class Eixo(models.TextChoices):
        EMPREENDEDOR = "empreendedor", "Empreendedor"
        TECNOLOGIA = "tecnologia", "Tecnologia"
        CAPITAL = "capital", "Capital"
        MERCADO = "mercado", "Mercado"
        GESTAO = "gestao", "Gestão"

    empreendimento = models.ForeignKey(
        Empreendimento,
        on_delete=models.CASCADE,
        related_name="avaliacoes",
        verbose_name="empreendimento",
    )
    eixo = models.CharField("eixo", max_length=20, choices=Eixo.choices)
    nota = models.PositiveSmallIntegerField(
        "nota (0 a 5)", help_text="0 = inicial, 5 = maduro"
    )
    data = models.DateField("data da avaliação")
    observacao = models.TextField("observação", blank=True)
    criado_em = models.DateTimeField("registrado em", auto_now_add=True)
    criado_por = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="+",
        verbose_name="registrado por",
    )

    class Meta:
        verbose_name = "avaliação de eixo"
        verbose_name_plural = "avaliações de eixo"
        ordering = ["-data"]

    def __str__(self):
        return f"{self.empreendimento.nome} · {self.get_eixo_display()}: {self.nota}"
