"""Modelos do catálogo CERNE.

Representam a *metodologia* CERNE como dado: versão do modelo, níveis de
maturidade, processos-chave, práticas-chave e, para cada prática, os requisitos
de evidência, as métricas exigidas (com metas) e as recomendações.

Esta é a "espinha dorsal" do sistema. Os dados reais do parque (status,
evidências, medições) ficam no app `acompanhamento` e apontam para cá.
"""

from django.db import models


class VersaoModelo(models.Model):
    """Versão do modelo CERNE (ex.: 'CERNE 2025')."""

    nome = models.CharField("nome", max_length=100, unique=True)
    ano = models.PositiveIntegerField("ano", null=True, blank=True)
    descricao = models.TextField("descrição", blank=True)
    ativa = models.BooleanField("ativa", default=True)

    class Meta:
        verbose_name = "versão do modelo"
        verbose_name_plural = "versões do modelo"
        ordering = ["-ano", "nome"]

    def __str__(self):
        return self.nome


class Nivel(models.Model):
    """Nível de maturidade CERNE (1 a 4). São acumulativos."""

    versao = models.ForeignKey(
        VersaoModelo,
        on_delete=models.CASCADE,
        related_name="niveis",
        verbose_name="versão",
    )
    numero = models.PositiveSmallIntegerField("número")  # 1..4
    nome = models.CharField("nome", max_length=120)  # ex.: "Empreendimento"
    descricao = models.TextField("descrição", blank=True)

    class Meta:
        verbose_name = "nível de maturidade"
        verbose_name_plural = "níveis de maturidade"
        ordering = ["versao", "numero"]
        constraints = [
            models.UniqueConstraint(
                fields=["versao", "numero"], name="uniq_nivel_por_versao"
            ),
        ]

    def __str__(self):
        return f"CERNE {self.numero} — {self.nome}"


class ProcessoChave(models.Model):
    """Processo-chave dentro de um nível (ex.: '1.1 Sensibilização e Prospecção')."""

    nivel = models.ForeignKey(
        Nivel,
        on_delete=models.CASCADE,
        related_name="processos",
        verbose_name="nível",
    )
    codigo = models.CharField("código", max_length=10)  # ex.: "1.1"
    nome = models.CharField("nome", max_length=200)
    descricao = models.TextField("descrição", blank=True)
    ordem = models.PositiveSmallIntegerField("ordem", default=0)

    class Meta:
        verbose_name = "processo-chave"
        verbose_name_plural = "processos-chave"
        ordering = ["codigo"]
        constraints = [
            models.UniqueConstraint(
                fields=["nivel", "codigo"], name="uniq_processo_por_nivel"
            ),
        ]

    def __str__(self):
        return f"{self.codigo} {self.nome}"


class PraticaChave(models.Model):
    """Prática-chave (ex.: '1.1.1 Sensibilização'). Unidade avaliada na certificação."""

    processo = models.ForeignKey(
        ProcessoChave,
        on_delete=models.CASCADE,
        related_name="praticas",
        verbose_name="processo-chave",
    )
    codigo = models.CharField("código", max_length=12)  # ex.: "1.1.1"
    nome = models.CharField("nome", max_length=200)
    descricao = models.TextField("descrição", blank=True)
    objetivo = models.TextField("objetivo", blank=True)
    orientacao_preenchimento = models.TextField(
        "como preencher / orientação",
        blank=True,
        help_text="Explicação amigável de como registrar o acompanhamento desta prática.",
    )
    ordem = models.PositiveSmallIntegerField("ordem", default=0)

    class Meta:
        verbose_name = "prática-chave"
        verbose_name_plural = "práticas-chave"
        ordering = ["codigo"]
        constraints = [
            models.UniqueConstraint(
                fields=["processo", "codigo"], name="uniq_pratica_por_processo"
            ),
        ]

    def __str__(self):
        return f"{self.codigo} {self.nome}"

    @property
    def nivel(self):
        return self.processo.nivel


class RequisitoEvidencia(models.Model):
    """O que a certificadora espera como evidência de uma prática-chave."""

    pratica = models.ForeignKey(
        PraticaChave,
        on_delete=models.CASCADE,
        related_name="requisitos_evidencia",
        verbose_name="prática-chave",
    )
    descricao = models.TextField("descrição")
    exemplo = models.TextField(
        "exemplo de evidência",
        blank=True,
        help_text="Exemplo concreto do que anexar para atender a este requisito.",
    )
    obrigatorio = models.BooleanField("obrigatório", default=True)
    ordem = models.PositiveSmallIntegerField("ordem", default=0)

    class Meta:
        verbose_name = "requisito de evidência"
        verbose_name_plural = "requisitos de evidência"
        ordering = ["pratica", "ordem"]

    def __str__(self):
        return f"{self.pratica.codigo} · {self.descricao[:60]}"


class DefinicaoMetrica(models.Model):
    """Métrica exigida por uma prática. No CERNE 2025 as metas são obrigatórias."""

    pratica = models.ForeignKey(
        PraticaChave,
        on_delete=models.CASCADE,
        related_name="metricas",
        verbose_name="prática-chave",
    )
    nome = models.CharField("nome", max_length=200)
    unidade = models.CharField(
        "unidade", max_length=50, blank=True, help_text="ex.: pessoas, %, R$, eventos"
    )
    meta = models.CharField(
        "meta", max_length=100, blank=True, help_text="meta obrigatória (valor ou descrição)"
    )
    obrigatoria = models.BooleanField("obrigatória", default=True)
    descricao = models.TextField("descrição", blank=True)
    exemplo = models.CharField(
        "exemplo de medição",
        max_length=200,
        blank=True,
        help_text="Ex.: '120 pessoas em 2024' — ajuda a entender como preencher.",
    )
    ordem = models.PositiveSmallIntegerField("ordem", default=0)

    class Meta:
        verbose_name = "definição de métrica"
        verbose_name_plural = "definições de métrica"
        ordering = ["pratica", "ordem"]

    def __str__(self):
        return f"{self.pratica.codigo} · {self.nome}"


class Recomendacao(models.Model):
    """Recomendação da metodologia para a prática (no futuro pode virar obrigatória)."""

    pratica = models.ForeignKey(
        PraticaChave,
        on_delete=models.CASCADE,
        related_name="recomendacoes",
        verbose_name="prática-chave",
    )
    texto = models.TextField("texto")
    ordem = models.PositiveSmallIntegerField("ordem", default=0)

    class Meta:
        verbose_name = "recomendação"
        verbose_name_plural = "recomendações"
        ordering = ["pratica", "ordem"]

    def __str__(self):
        return f"{self.pratica.codigo} · recomendação {self.ordem}"
