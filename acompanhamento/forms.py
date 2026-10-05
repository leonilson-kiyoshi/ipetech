"""Formulários de registro do acompanhamento CERNE.

Estes formulários existem para que a equipe do parque registre tudo pelo
próprio sistema, com linguagem amigável, sem precisar entrar no admin do
Django. Cada um corresponde a uma ação concreta do dia a dia do técnico:
atualizar a situação de uma prática, anexar uma evidência, lançar a medição
de uma métrica, registrar uma revisão crítica ou abrir um plano de ação.
"""

from django import forms
from django.core.exceptions import ValidationError

from catalogo.models import DefinicaoMetrica, PraticaChave, RequisitoEvidencia

from .models import (
    Aprendizado,
    AvaliacaoEixo,
    Empreendimento,
    Evidencia,
    Mecanismo,
    MedicaoMetrica,
    PlanoAcao,
    StatusPratica,
)

# ---------------------------------------------------------------- utilidades

TAMANHO_MAXIMO_ARQUIVO = 20 * 1024 * 1024  # 20 MB

EXTENSOES_PERMITIDAS = {
    ".pdf", ".doc", ".docx", ".odt", ".rtf", ".txt",
    ".xls", ".xlsx", ".ods", ".csv",
    ".ppt", ".pptx", ".odp",
    ".png", ".jpg", ".jpeg", ".gif", ".webp",
    ".zip",
    ".mp4", ".mp3", ".m4a",
}


def validar_arquivo_evidencia(arquivo):
    """Recusa arquivos grandes demais ou de tipo inesperado.

    Evita que um upload acidental (um vídeo enorme, um executável) entre na
    pasta de evidências do parque.
    """
    if not arquivo:
        return arquivo

    if arquivo.size > TAMANHO_MAXIMO_ARQUIVO:
        limite = TAMANHO_MAXIMO_ARQUIVO // (1024 * 1024)
        raise ValidationError(
            f"O arquivo tem {arquivo.size / (1024 * 1024):.1f} MB e o limite é {limite} MB. "
            "Envie uma versão compactada ou informe um link para o arquivo."
        )

    nome = (getattr(arquivo, "name", "") or "").lower()
    ponto = nome.rfind(".")
    extensao = nome[ponto:] if ponto != -1 else ""
    if extensao not in EXTENSOES_PERMITIDAS:
        raise ValidationError(
            f"Tipo de arquivo não aceito ({extensao or 'sem extensão'}). "
            "Aceitos: PDF, Word, Excel, PowerPoint, imagens, ZIP, áudio e vídeo."
        )
    return arquivo


class FormularioEstilizado(forms.ModelForm):
    """Aplica as classes de estilo do tema em todos os campos automaticamente."""

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        for campo in self.fields.values():
            widget = campo.widget
            if isinstance(widget, forms.CheckboxInput):
                widget.attrs.setdefault("class", "form-check-input")
            elif isinstance(widget, (forms.Select, forms.SelectMultiple)):
                widget.attrs.setdefault("class", "form-select")
            elif isinstance(widget, forms.ClearableFileInput):
                widget.attrs.setdefault("class", "form-control")
            else:
                widget.attrs.setdefault("class", "form-control")
            if campo.required:
                widget.attrs.setdefault("required", "required")


def rotulo_pratica(pratica):
    return f"{pratica.codigo} — {pratica.nome}"


# ------------------------------------------------------------ status da prática


class StatusPraticaForm(FormularioEstilizado):
    """Situação de implantação de uma prática-chave."""

    class Meta:
        model = StatusPratica
        fields = ["situacao", "percentual", "observacoes"]
        labels = {
            "situacao": "Situação da prática",
            "percentual": "Percentual de implantação (0 a 100)",
            "observacoes": "Observações",
        }
        help_texts = {
            "percentual": "Serve para acompanhar o andamento. Não altera o cálculo de prontidão.",
            "observacoes": "Contexto útil para quem for auditar: decisões, responsáveis, pendências.",
        }
        widgets = {
            "observacoes": forms.Textarea(attrs={"rows": 3}),
            "percentual": forms.NumberInput(attrs={"min": 0, "max": 100, "step": 1}),
        }

    def clean_percentual(self):
        valor = self.cleaned_data.get("percentual") or 0
        if valor < 0 or valor > 100:
            raise ValidationError("Informe um valor entre 0 e 100.")
        return valor


# ------------------------------------------------------------------ evidência


class EvidenciaForm(FormularioEstilizado):
    """Registro de uma evidência (o arquivo em si, ou o link de onde ele está)."""

    class Meta:
        model = Evidencia
        fields = [
            "requisito",
            "titulo",
            "arquivo",
            "link",
            "descricao",
            "data_referencia",
            "responsavel",
        ]
        labels = {
            "requisito": "Qual requisito esta evidência atende?",
            "titulo": "Título da evidência",
            "arquivo": "Arquivo",
            "link": "Ou link externo",
            "descricao": "Descrição",
            "data_referencia": "Data a que se refere",
            "responsavel": "Responsável",
        }
        help_texts = {
            "requisito": "Vincular ao requisito é o que faz a prática avançar para 'completa'.",
            "arquivo": "PDF, Word, Excel, imagem, ZIP... até 20 MB.",
            "link": "Use se o arquivo já está no Drive, na rede do parque ou num site.",
            "descricao": "Explique brevemente o que o documento comprova.",
            "responsavel": "Quem produziu ou conduziu a ação.",
        }
        widgets = {
            "descricao": forms.Textarea(attrs={"rows": 2}),
            "data_referencia": forms.DateInput(attrs={"type": "date"}, format="%Y-%m-%d"),
            "titulo": forms.TextInput(
                attrs={"placeholder": "ex.: Palestra de sensibilização no IFSULDEMINAS"}
            ),
            "link": forms.URLInput(attrs={"placeholder": "https://..."}),
        }

    def __init__(self, *args, pratica=None, **kwargs):
        super().__init__(*args, **kwargs)
        self.pratica = pratica
        if pratica is not None:
            self.fields["requisito"].queryset = RequisitoEvidencia.objects.filter(
                pratica=pratica
            ).order_by("ordem")
        else:
            self.fields["requisito"].queryset = RequisitoEvidencia.objects.none()
        self.fields["requisito"].required = False
        self.fields["requisito"].empty_label = "— não vincular a um requisito específico —"
        self.fields["requisito"].label_from_instance = lambda obj: (
            ("[obrigatório] " if obj.obrigatorio else "[opcional] ") + obj.descricao
        )

    def clean_arquivo(self):
        return validar_arquivo_evidencia(self.cleaned_data.get("arquivo"))

    def clean(self):
        dados = super().clean()
        if not dados.get("arquivo") and not (dados.get("link") or "").strip():
            raise ValidationError(
                "Anexe um arquivo ou informe um link. A evidência precisa de um dos dois "
                "para ser localizável na auditoria."
            )
        return dados


# ------------------------------------------------------------------- medição


class MedicaoMetricaForm(FormularioEstilizado):
    """Medição de uma métrica exigida pela prática."""

    class Meta:
        model = MedicaoMetrica
        fields = ["metrica", "valor", "data", "observacao"]
        labels = {
            "metrica": "Métrica",
            "valor": "Valor medido",
            "data": "Data da medição",
            "observacao": "Observação",
        }
        widgets = {
            "valor": forms.NumberInput(attrs={"step": "any"}),
            "data": forms.DateInput(attrs={"type": "date"}, format="%Y-%m-%d"),
            "observacao": forms.Textarea(attrs={"rows": 2}),
        }

    def __init__(self, *args, pratica=None, **kwargs):
        super().__init__(*args, **kwargs)
        if pratica is not None:
            self.fields["metrica"].queryset = DefinicaoMetrica.objects.filter(
                pratica=pratica
            ).order_by("ordem")
        self.fields["metrica"].label_from_instance = lambda obj: (
            f"{obj.nome}" + (f" ({obj.unidade})" if obj.unidade else "")
            + (f" · meta: {obj.meta}" if obj.meta else "")
        )


# ------------------------------------------------------- revisão crítica


class AprendizadoForm(FormularioEstilizado):
    """Revisão crítica da prática: eficiência, eficácia e efetividade."""

    class Meta:
        model = Aprendizado
        fields = [
            "data",
            "periodo",
            "eficiencia",
            "eficacia",
            "efetividade",
            "necessita_ajustes",
            "observacoes",
        ]
        labels = {
            "data": "Data da revisão",
            "periodo": "Período avaliado",
            "eficiencia": "Eficiência — produtividade",
            "eficacia": "Eficácia — qualidade",
            "efetividade": "Efetividade — resultados e impacto",
            "necessita_ajustes": "Esta prática precisa de ajustes",
            "observacoes": "Observações",
        }
        help_texts = {
            "eficiencia": "Conseguimos executar com os recursos e o tempo previstos?",
            "eficacia": "O que foi entregue atingiu a qualidade planejada?",
            "efetividade": "A prática gerou o resultado esperado para o parque?",
            "periodo": "ex.: 2º semestre de 2025",
        }
        widgets = {
            "data": forms.DateInput(attrs={"type": "date"}, format="%Y-%m-%d"),
            "eficiencia": forms.Textarea(attrs={"rows": 2}),
            "eficacia": forms.Textarea(attrs={"rows": 2}),
            "efetividade": forms.Textarea(attrs={"rows": 2}),
            "observacoes": forms.Textarea(attrs={"rows": 2}),
        }


# ------------------------------------------------------------ plano de ação


class PlanoAcaoForm(FormularioEstilizado):
    """Ação de melhoria vinculada a uma prática."""

    class Meta:
        model = PlanoAcao
        fields = ["descricao", "responsavel", "prazo", "situacao"]
        labels = {
            "descricao": "O que precisa ser feito",
            "responsavel": "Responsável",
            "prazo": "Prazo",
            "situacao": "Situação",
        }
        widgets = {
            "descricao": forms.Textarea(attrs={"rows": 2}),
            "prazo": forms.DateInput(attrs={"type": "date"}, format="%Y-%m-%d"),
        }


# --------------------------------------------------------- empreendimentos


class EmpreendimentoForm(FormularioEstilizado):
    """Empreendimento apoiado pelo parque."""

    class Meta:
        model = Empreendimento
        fields = [
            "nome",
            "setor",
            "estagio",
            "situacao",
            "data_entrada",
            "data_graduacao",
            "responsavel",
            "descricao",
        ]
        labels = {
            "nome": "Nome do empreendimento",
            "setor": "Setor",
            "estagio": "Estágio",
            "situacao": "Situação",
            "data_entrada": "Data de entrada",
            "data_graduacao": "Data de graduação",
            "responsavel": "Responsável / contato",
            "descricao": "O que a empresa faz",
        }
        help_texts = {
            "setor": "ex.: TIC, agronegócio, saúde, energia",
            "data_graduacao": "Preencha apenas quando a empresa graduar.",
        }
        widgets = {
            "data_entrada": forms.DateInput(attrs={"type": "date"}, format="%Y-%m-%d"),
            "data_graduacao": forms.DateInput(attrs={"type": "date"}, format="%Y-%m-%d"),
            "descricao": forms.Textarea(attrs={"rows": 3}),
        }

    def clean(self):
        dados = super().clean()
        entrada = dados.get("data_entrada")
        graduacao = dados.get("data_graduacao")
        if entrada and graduacao and graduacao < entrada:
            self.add_error(
                "data_graduacao",
                "A graduação não pode ser anterior à entrada no parque.",
            )
        return dados


class AvaliacaoEixoForm(FormularioEstilizado):
    """Nota de 0 a 5 em um dos cinco eixos do CERNE."""

    class Meta:
        model = AvaliacaoEixo
        fields = ["eixo", "nota", "data", "observacao"]
        labels = {
            "eixo": "Eixo",
            "nota": "Nota (0 a 5)",
            "data": "Data da avaliação",
            "observacao": "Observação",
        }
        widgets = {
            "nota": forms.NumberInput(attrs={"min": 0, "max": 5, "step": 1}),
            "data": forms.DateInput(attrs={"type": "date"}, format="%Y-%m-%d"),
            "observacao": forms.Textarea(attrs={"rows": 2}),
        }

    def clean_nota(self):
        nota = self.cleaned_data.get("nota")
        if nota is None or nota < 0 or nota > 5:
            raise ValidationError("A nota vai de 0 (inicial) a 5 (maduro).")
        return nota


# ------------------------------------------------------------- o parque


class MecanismoForm(FormularioEstilizado):
    """Dados do próprio parque (usado pelo gestor)."""

    class Meta:
        model = Mecanismo
        fields = ["nome", "tipo", "cidade_uf", "nivel_almejado", "descricao"]
        labels = {
            "nome": "Nome do parque",
            "tipo": "Tipo de mecanismo",
            "cidade_uf": "Cidade/UF",
            "nivel_almejado": "Nível CERNE almejado",
            "descricao": "Descrição",
        }
        widgets = {
            "descricao": forms.Textarea(attrs={"rows": 3}),
            "nivel_almejado": forms.NumberInput(attrs={"min": 1, "max": 4}),
        }


# ------------------------------------------------- registro rápido de ação


class EscolherPraticaForm(forms.Form):
    """Passo 1 do registro rápido: a qual prática a ação se refere."""

    pratica = forms.ModelChoiceField(
        queryset=PraticaChave.objects.select_related("processo__nivel").order_by("codigo"),
        label="A qual prática-chave esta ação se refere?",
        empty_label="— escolha a prática —",
        widget=forms.Select(attrs={"class": "form-select form-select-lg"}),
    )

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.fields["pratica"].label_from_instance = rotulo_pratica


class RegistrarAcaoForm(forms.Form):
    """Registro em um passo: descreve a ação, anexa o arquivo e, se quiser, já
    lança a medição da métrica no mesmo envio.

    É o formulário do dia a dia: "fizemos uma palestra para 80 alunos, aqui
    está a lista de presença".
    """

    titulo = forms.CharField(
        label="O que foi feito",
        max_length=200,
        widget=forms.TextInput(
            attrs={
                "class": "form-control form-control-lg",
                "placeholder": "ex.: Palestra de sensibilização no IFSULDEMINAS",
                "autofocus": "autofocus",
            }
        ),
    )
    data_referencia = forms.DateField(
        label="Quando aconteceu",
        widget=forms.DateInput(attrs={"type": "date", "class": "form-control"}),
    )
    responsavel = forms.CharField(
        label="Quem conduziu",
        max_length=150,
        required=False,
        widget=forms.TextInput(attrs={"class": "form-control"}),
    )
    descricao = forms.CharField(
        label="Detalhes",
        required=False,
        help_text="Onde foi, quem participou, qual foi o resultado.",
        widget=forms.Textarea(attrs={"rows": 3, "class": "form-control"}),
    )
    requisito = forms.ModelChoiceField(
        queryset=RequisitoEvidencia.objects.none(),
        label="Qual requisito de evidência isso atende?",
        required=False,
        empty_label="— não vincular agora —",
        widget=forms.Select(attrs={"class": "form-select"}),
    )
    arquivo = forms.FileField(
        label="Anexar comprovação",
        required=False,
        help_text="Lista de presença, fotos, ata, relatório... até 20 MB.",
        widget=forms.ClearableFileInput(attrs={"class": "form-control"}),
    )
    link = forms.URLField(
        label="Ou link da comprovação",
        required=False,
        widget=forms.URLInput(attrs={"class": "form-control", "placeholder": "https://..."}),
    )
    metrica = forms.ModelChoiceField(
        queryset=DefinicaoMetrica.objects.none(),
        label="Já quer lançar uma métrica?",
        required=False,
        empty_label="— não lançar agora —",
        widget=forms.Select(attrs={"class": "form-select"}),
    )
    valor = forms.DecimalField(
        label="Valor medido",
        required=False,
        max_digits=14,
        decimal_places=2,
        widget=forms.NumberInput(attrs={"class": "form-control", "step": "any"}),
    )
    marcar_implantada = forms.BooleanField(
        label="Marcar esta prática como implantada",
        required=False,
        help_text="Use quando a prática já está rodando e documentada.",
        widget=forms.CheckboxInput(attrs={"class": "form-check-input"}),
    )

    def __init__(self, *args, pratica=None, **kwargs):
        super().__init__(*args, **kwargs)
        self.pratica = pratica
        if pratica is not None:
            self.fields["requisito"].queryset = RequisitoEvidencia.objects.filter(
                pratica=pratica
            ).order_by("ordem")
            self.fields["metrica"].queryset = DefinicaoMetrica.objects.filter(
                pratica=pratica
            ).order_by("ordem")
        self.fields["requisito"].label_from_instance = lambda obj: (
            ("[obrigatório] " if obj.obrigatorio else "[opcional] ") + obj.descricao
        )
        self.fields["metrica"].label_from_instance = lambda obj: (
            f"{obj.nome}" + (f" ({obj.unidade})" if obj.unidade else "")
            + (f" · meta: {obj.meta}" if obj.meta else "")
        )

    def clean_arquivo(self):
        return validar_arquivo_evidencia(self.cleaned_data.get("arquivo"))

    def clean(self):
        dados = super().clean()

        if not dados.get("arquivo") and not (dados.get("link") or "").strip():
            raise ValidationError(
                "Anexe um arquivo ou informe um link com a comprovação da ação."
            )

        metrica = dados.get("metrica")
        valor = dados.get("valor")
        if metrica and valor is None:
            self.add_error("valor", "Informe o valor medido para esta métrica.")
        if valor is not None and not metrica:
            self.add_error("metrica", "Escolha a métrica correspondente a este valor.")

        return dados
