"""Views do acompanhamento CERNE do IpêTech Paraíso.

O sistema acompanha um único parque, então não há seletor de mecanismo: o
parque é resolvido automaticamente (ver context_processors.parque).

A regra de ouro destas views: o técnico registra tudo aqui, sem precisar do
admin do Django. Toda gravação é feita por POST e responde com redirecionamento
e mensagem de confirmação, para que atualizar a página não duplique registros.
"""

import io
import mimetypes
from pathlib import Path, PurePosixPath

from django.conf import settings
from django.contrib import messages
from django.contrib.auth.decorators import login_required
from django.core.exceptions import PermissionDenied
from django.db.models import Count
from django.http import FileResponse, Http404, HttpResponse
from django.shortcuts import get_object_or_404, redirect, render
from django.template.loader import render_to_string
from django.utils import timezone
from django.utils.text import slugify

from catalogo.models import PraticaChave

from .context_processors import (
    PERMISSAO_REGISTRO,
    parque_do_usuario,
    versao_do_catalogo,
)
from .forms import (
    AprendizadoForm,
    AvaliacaoEixoForm,
    EmpreendimentoForm,
    EscolherPraticaForm,
    EvidenciaForm,
    MecanismoForm,
    MedicaoMetricaForm,
    PlanoAcaoForm,
    RegistrarAcaoForm,
    StatusPraticaForm,
)
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
from .services import calcular_prontidao, montar_dossie

# --------------------------------------------------------------- utilidades


def _exigir_registro(request):
    """Bloqueia gravação para quem tem perfil somente leitura (Auditor)."""
    usuario = request.user
    if not (usuario.is_superuser or usuario.has_perm(PERMISSAO_REGISTRO)):
        raise PermissionDenied(
            "Seu perfil é de consulta. Para registrar, peça ao gestor para "
            "incluir seu usuário no grupo 'Equipe'."
        )


def _parque_ou_aviso(request):
    """Devolve o parque; se não houver nenhum cadastrado, devolve None."""
    return parque_do_usuario()


def _sem_parque(request):
    return render(request, "acompanhamento/sem_mecanismo.html", {})


def _pratica_ou_404(codigo):
    return get_object_or_404(
        PraticaChave.objects.select_related("processo__nivel"), codigo=codigo
    )


def _dados_da_pratica(mecanismo, pratica):
    """Reúne o que já foi registrado nesta prática, para a tela de detalhe."""
    evidencias = list(
        Evidencia.objects.filter(mecanismo=mecanismo, pratica=pratica)
        .select_related("requisito")
        .order_by("-data_referencia", "-criado_em")
    )
    medicoes = list(
        MedicaoMetrica.objects.filter(mecanismo=mecanismo, metrica__pratica=pratica)
        .select_related("metrica")
        .order_by("-data")
    )
    return {
        "status": StatusPratica.objects.filter(
            mecanismo=mecanismo, pratica=pratica
        ).first(),
        "evidencias": evidencias,
        "evidencias_por_requisito": _agrupar_por_requisito(evidencias),
        "requisitos_atendidos": {e.requisito_id for e in evidencias if e.requisito_id},
        "medicoes": medicoes,
        "medicoes_por_metrica": _agrupar_por_metrica(medicoes),
        "metricas_medidas": {m.metrica_id for m in medicoes},
        "revisoes": list(
            Aprendizado.objects.filter(mecanismo=mecanismo, pratica=pratica).order_by("-data")
        ),
        "planos": list(
            PlanoAcao.objects.filter(mecanismo=mecanismo, pratica=pratica).order_by(
                "situacao", "prazo"
            )
        ),
    }


def _agrupar_por_requisito(evidencias):
    mapa = {}
    for evidencia in evidencias:
        mapa.setdefault(evidencia.requisito_id, []).append(evidencia)
    return mapa


def _agrupar_por_metrica(medicoes):
    mapa = {}
    for medicao in medicoes:
        mapa.setdefault(medicao.metrica_id, []).append(medicao)
    return mapa


# ------------------------------------------------------------------- painel


@login_required
def dashboard(request):
    mecanismo = _parque_ou_aviso(request)
    if not mecanismo:
        return _sem_parque(request)

    prontidao = calcular_prontidao(mecanismo)

    # Últimos registros: dá ao técnico a sensação de que o trabalho rende.
    ultimas_evidencias = list(
        Evidencia.objects.filter(mecanismo=mecanismo)
        .select_related("pratica")
        .order_by("-criado_em")[:6]
    )
    ultimas_medicoes = list(
        MedicaoMetrica.objects.filter(mecanismo=mecanismo)
        .select_related("metrica__pratica")
        .order_by("-criado_em")[:5]
    )

    total = prontidao["total_praticas"] or 1
    contexto = {
        "prontidao": prontidao,
        "percentual_geral": round(100 * prontidao["total_completas"] / total),
        "total_evidencias": Evidencia.objects.filter(mecanismo=mecanismo).count(),
        "total_medicoes": MedicaoMetrica.objects.filter(mecanismo=mecanismo).count(),
        "total_arquivos": Evidencia.objects.filter(mecanismo=mecanismo)
        .exclude(arquivo="")
        .count(),
        "planos_abertos": PlanoAcao.objects.filter(mecanismo=mecanismo)
        .exclude(situacao=PlanoAcao.Situacao.CONCLUIDO)
        .exclude(situacao=PlanoAcao.Situacao.CANCELADO)
        .count(),
        "total_empreendimentos": Empreendimento.objects.filter(
            mecanismo=mecanismo
        ).count(),
        "ultimas_evidencias": ultimas_evidencias,
        "ultimas_medicoes": ultimas_medicoes,
    }
    return render(request, "acompanhamento/dashboard.html", contexto)


# ------------------------------------------------------- registrar (central)


@login_required
def registrar(request):
    """Central de registro: o ponto de partida do técnico.

    Mostra as práticas que ainda têm pendência (o trabalho a fazer) e um
    seletor para começar o registro de qualquer prática.
    """
    mecanismo = _parque_ou_aviso(request)
    if not mecanismo:
        return _sem_parque(request)

    if request.method == "POST":
        formulario = EscolherPraticaForm(request.POST)
        if formulario.is_valid():
            codigo = formulario.cleaned_data["pratica"].codigo
            return redirect("registrar_acao", codigo=codigo)
    else:
        formulario = EscolherPraticaForm()

    prontidao = calcular_prontidao(mecanismo)

    # Pendências do próximo nível, que é onde o esforço tem efeito imediato.
    pendencias = prontidao["pendencias_proximo"][:8]

    return render(
        request,
        "acompanhamento/registrar.html",
        {
            "form_escolher": formulario,
            "prontidao": prontidao,
            "pendencias": pendencias,
            "total_pendencias": len(prontidao["pendencias_proximo"]),
        },
    )


@login_required
def registrar_acao(request, codigo):
    """Registro rápido: descreve a ação, anexa o arquivo e já lança a métrica."""
    mecanismo = _parque_ou_aviso(request)
    if not mecanismo:
        return _sem_parque(request)
    _exigir_registro(request)

    pratica = _pratica_ou_404(codigo)

    if request.method == "POST":
        formulario = RegistrarAcaoForm(request.POST, request.FILES, pratica=pratica)
        if formulario.is_valid():
            dados = formulario.cleaned_data

            evidencia = Evidencia(
                mecanismo=mecanismo,
                pratica=pratica,
                requisito=dados.get("requisito"),
                titulo=dados["titulo"],
                link=dados.get("link") or "",
                descricao=dados.get("descricao") or "",
                data_referencia=dados["data_referencia"],
                responsavel=dados.get("responsavel") or "",
                criado_por=request.user,
            )
            if dados.get("arquivo"):
                evidencia.arquivo = dados["arquivo"]
            evidencia.save()

            partes = ["Ação registrada."]

            if dados.get("metrica") and dados.get("valor") is not None:
                MedicaoMetrica.objects.create(
                    mecanismo=mecanismo,
                    metrica=dados["metrica"],
                    valor=dados["valor"],
                    data=dados["data_referencia"],
                    observacao=dados["titulo"],
                    criado_por=request.user,
                )
                partes.append("Medição lançada.")

            if dados.get("marcar_implantada"):
                status, _ = StatusPratica.objects.get_or_create(
                    mecanismo=mecanismo, pratica=pratica
                )
                status.situacao = StatusPratica.Situacao.IMPLANTADA
                status.percentual = 100
                status.atualizado_por = request.user
                status.save()
                partes.append("Prática marcada como implantada.")

            if evidencia.arquivo:
                partes.append(f"Arquivo salvo em {evidencia.arquivo.name}")

            messages.success(request, " ".join(partes))
            return redirect("pratica_detail", codigo=pratica.codigo)
    else:
        formulario = RegistrarAcaoForm(
            pratica=pratica,
            initial={
                "data_referencia": timezone.localdate(),
                "responsavel": request.user.get_full_name() or request.user.get_username(),
            },
        )

    dados = _dados_da_pratica(mecanismo, pratica)
    faltas = _faltas_da_pratica_view(pratica, dados)

    return render(
        request,
        "acompanhamento/registrar_acao.html",
        {
            "pratica": pratica,
            "processo": pratica.processo,
            "nivel": pratica.processo.nivel,
            "form": formulario,
            "faltas": faltas,
            **dados,
        },
    )


def _faltas_da_pratica_view(pratica, dados):
    """Mesma regra do services.py, calculada com os dados já carregados."""
    faltas = []
    status = dados["status"]
    if not status or status.situacao != StatusPratica.Situacao.IMPLANTADA:
        atual = status.get_situacao_display() if status else "Não iniciada"
        faltas.append(f"Marcar a prática como 'Implantada' (situação atual: {atual}).")
    for requisito in pratica.requisitos_evidencia.all():
        if requisito.obrigatorio and requisito.id not in dados["requisitos_atendidos"]:
            faltas.append(f"Anexar evidência para: {requisito.descricao}")
    for metrica in pratica.metricas.all():
        if metrica.obrigatoria and metrica.id not in dados["metricas_medidas"]:
            faltas.append(f"Registrar medição da métrica obrigatória: {metrica.nome}")
    return faltas


# ---------------------------------------------------------------- catálogo


@login_required
def catalogo(request):
    mecanismo = _parque_ou_aviso(request)
    if not mecanismo:
        return _sem_parque(request)

    prontidao = calcular_prontidao(mecanismo)
    busca = (request.GET.get("q") or "").strip()
    filtro = request.GET.get("situacao") or ""
    nivel_sel = request.GET.get("nivel") or ""

    niveis = []
    total_listadas = 0
    for info_nivel in prontidao["niveis"]:
        if nivel_sel and str(info_nivel["nivel"].numero) != nivel_sel:
            continue
        processos = []
        for info_proc in info_nivel["processos"]:
            praticas = []
            for item in info_proc["praticas"]:
                pratica = item["pratica"]
                if filtro == "completa" and not item["completa"]:
                    continue
                if filtro == "pendente" and item["completa"]:
                    continue
                if filtro in {"nao_iniciada", "em_andamento", "implantada", "em_revisao"}:
                    if item["situacao"] != filtro:
                        continue
                if busca:
                    alvo = " ".join(
                        [
                            pratica.codigo,
                            pratica.nome,
                            pratica.descricao or "",
                            pratica.objetivo or "",
                        ]
                    ).lower()
                    if busca.lower() not in alvo:
                        continue
                praticas.append(item)
            if praticas:
                processos.append({**info_proc, "praticas_filtradas": praticas})
                total_listadas += len(praticas)
        if processos:
            niveis.append({**info_nivel, "processos_filtrados": processos})

    return render(
        request,
        "acompanhamento/catalogo.html",
        {
            "prontidao": prontidao,
            "niveis_filtrados": niveis,
            "busca": busca,
            "filtro": filtro,
            "nivel_sel": nivel_sel,
            "total_listadas": total_listadas,
            "situacoes": StatusPratica.Situacao.choices,
        },
    )


# ----------------------------------------------------- detalhe de uma prática


@login_required
def pratica_detail(request, codigo):
    """Tela de trabalho da prática: consulta e registro no mesmo lugar.

    Todos os formulários desta página enviam para cá, identificados pelo campo
    oculto `tipo`. Depois de gravar, redireciona de volta (padrão POST/redirect)
    para que recarregar a página não repita o registro.
    """
    mecanismo = _parque_ou_aviso(request)
    if not mecanismo:
        return _sem_parque(request)

    pratica = _pratica_ou_404(codigo)

    if request.method == "POST":
        _exigir_registro(request)
        resposta = _processar_post_pratica(request, mecanismo, pratica)
        if resposta:
            return resposta

    dados = _dados_da_pratica(mecanismo, pratica)

    contexto = {
        "pratica": pratica,
        "processo": pratica.processo,
        "nivel": pratica.processo.nivel,
        "requisitos": list(pratica.requisitos_evidencia.all()),
        "metricas": list(pratica.metricas.all()),
        "recomendacoes": list(pratica.recomendacoes.all()),
        "faltas": _faltas_da_pratica_view(pratica, dados),
        "form_status": StatusPraticaForm(instance=dados["status"]),
        "form_evidencia": EvidenciaForm(
            pratica=pratica, initial={"data_referencia": timezone.localdate()}
        ),
        "form_medicao": MedicaoMetricaForm(
            pratica=pratica, initial={"data": timezone.localdate()}
        ),
        "form_revisao": AprendizadoForm(initial={"data": timezone.localdate()}),
        "form_plano": PlanoAcaoForm(),
        **dados,
    }
    contexto["completa"] = not contexto["faltas"]
    return render(request, "acompanhamento/pratica_detail.html", contexto)


def _processar_post_pratica(request, mecanismo, pratica):
    """Trata os envios da tela da prática. Devolve um redirect ou None."""
    tipo = request.POST.get("tipo")
    destino = redirect("pratica_detail", codigo=pratica.codigo)

    if tipo == "status":
        instancia = StatusPratica.objects.filter(
            mecanismo=mecanismo, pratica=pratica
        ).first()
        formulario = StatusPraticaForm(request.POST, instance=instancia)
        if formulario.is_valid():
            status = formulario.save(commit=False)
            status.mecanismo = mecanismo
            status.pratica = pratica
            status.atualizado_por = request.user
            status.save()
            messages.success(
                request, f"Situação da prática {pratica.codigo} atualizada."
            )
            return destino
        messages.error(request, "Não foi possível salvar a situação. Verifique os campos.")

    elif tipo == "evidencia":
        formulario = EvidenciaForm(request.POST, request.FILES, pratica=pratica)
        if formulario.is_valid():
            evidencia = formulario.save(commit=False)
            evidencia.mecanismo = mecanismo
            evidencia.pratica = pratica
            evidencia.criado_por = request.user
            evidencia.save()
            if evidencia.arquivo:
                messages.success(
                    request,
                    f"Evidência registrada. Arquivo salvo em {evidencia.arquivo.name}",
                )
            else:
                messages.success(request, "Evidência registrada.")
            return destino
        messages.error(request, _primeiro_erro(formulario, "Não foi possível anexar a evidência."))

    elif tipo == "medicao":
        formulario = MedicaoMetricaForm(request.POST, pratica=pratica)
        if formulario.is_valid():
            medicao = formulario.save(commit=False)
            medicao.mecanismo = mecanismo
            medicao.criado_por = request.user
            medicao.save()
            messages.success(request, f"Medição de “{medicao.metrica.nome}” registrada.")
            return destino
        messages.error(request, _primeiro_erro(formulario, "Não foi possível lançar a medição."))

    elif tipo == "revisao":
        formulario = AprendizadoForm(request.POST)
        if formulario.is_valid():
            revisao = formulario.save(commit=False)
            revisao.mecanismo = mecanismo
            revisao.pratica = pratica
            revisao.criado_por = request.user
            revisao.save()
            messages.success(request, "Revisão crítica registrada.")
            return destino
        messages.error(request, _primeiro_erro(formulario, "Não foi possível salvar a revisão."))

    elif tipo == "plano":
        formulario = PlanoAcaoForm(request.POST)
        if formulario.is_valid():
            plano = formulario.save(commit=False)
            plano.mecanismo = mecanismo
            plano.pratica = pratica
            plano.criado_por = request.user
            plano.save()
            messages.success(request, "Plano de ação criado.")
            return destino
        messages.error(request, _primeiro_erro(formulario, "Não foi possível criar o plano."))

    elif tipo == "excluir_evidencia":
        evidencia = Evidencia.objects.filter(
            pk=request.POST.get("id"), mecanismo=mecanismo, pratica=pratica
        ).first()
        if evidencia:
            evidencia.arquivo.delete(save=False)  # remove o arquivo do disco
            evidencia.delete()
            messages.success(request, "Evidência removida.")
        return destino

    elif tipo == "excluir_medicao":
        medicao = MedicaoMetrica.objects.filter(
            pk=request.POST.get("id"), mecanismo=mecanismo, metrica__pratica=pratica
        ).first()
        if medicao:
            medicao.delete()
            messages.success(request, "Medição removida.")
        return destino

    elif tipo == "excluir_revisao":
        revisao = Aprendizado.objects.filter(
            pk=request.POST.get("id"), mecanismo=mecanismo, pratica=pratica
        ).first()
        if revisao:
            revisao.delete()
            messages.success(request, "Revisão removida.")
        return destino

    elif tipo == "concluir_plano":
        plano = PlanoAcao.objects.filter(
            pk=request.POST.get("id"), mecanismo=mecanismo, pratica=pratica
        ).first()
        if plano:
            plano.situacao = PlanoAcao.Situacao.CONCLUIDO
            plano.save()
            messages.success(request, "Plano de ação concluído.")
        return destino

    elif tipo == "excluir_plano":
        plano = PlanoAcao.objects.filter(
            pk=request.POST.get("id"), mecanismo=mecanismo, pratica=pratica
        ).first()
        if plano:
            plano.delete()
            messages.success(request, "Plano de ação removido.")
        return destino

    return None


def _primeiro_erro(formulario, padrao):
    """Extrai a primeira mensagem de erro para mostrar ao usuário."""
    for erros in formulario.errors.values():
        if erros:
            return erros[0]
    return padrao


# ----------------------------------------------------------------- arquivos


@login_required
def arquivos(request):
    """Mostra onde as evidências estão guardadas, no sistema e no disco.

    Existe para responder à pergunta prática do gestor: "e os arquivos, ficam
    onde?". Lista por nível e prática, com o caminho real da pasta.
    """
    mecanismo = _parque_ou_aviso(request)
    if not mecanismo:
        return _sem_parque(request)

    evidencias = list(
        Evidencia.objects.filter(mecanismo=mecanismo)
        .select_related("pratica__processo__nivel")
        .order_by("pratica__codigo", "-data_referencia")
    )

    grupos = {}
    total_bytes = 0
    com_arquivo = 0
    for evidencia in evidencias:
        nivel = evidencia.pratica.processo.nivel
        chave = (nivel.numero, nivel.nome)
        grupos.setdefault(chave, {})
        grupos[chave].setdefault(evidencia.pratica, []).append(evidencia)
        if evidencia.arquivo:
            com_arquivo += 1
            try:
                total_bytes += evidencia.arquivo.size
            except (OSError, ValueError):
                # arquivo registrado no banco mas ausente no disco
                pass

    grupos_ordenados = [
        {
            "numero": numero,
            "nome": nome,
            "praticas": sorted(praticas.items(), key=lambda par: par[0].codigo),
        }
        for (numero, nome), praticas in sorted(grupos.items())
    ]

    pasta_media = Path(settings.MEDIA_ROOT)
    return render(
        request,
        "acompanhamento/arquivos.html",
        {
            "grupos": grupos_ordenados,
            "total_evidencias": len(evidencias),
            "total_com_arquivo": com_arquivo,
            "total_links": len(evidencias) - com_arquivo,
            "total_mb": round(total_bytes / (1024 * 1024), 2),
            "usando_gcs": getattr(settings, "USANDO_GCS", False),
            "bucket": getattr(settings, "GCS_BUCKET", ""),
            "pasta_media": str(pasta_media),
            "pasta_existe": pasta_media.exists(),
        },
    )


# Tipos que o navegador exibe na própria aba. O resto vai como download.
# Importante não incluir html/svg aqui: conteúdo enviado por usuário não deve
# ser renderizado como página no domínio do sistema.
TIPOS_EXIBIR_NA_ABA = {
    "application/pdf",
    "image/png",
    "image/jpeg",
    "image/gif",
    "image/webp",
    "text/plain",
}


@login_required
def evidencia_arquivo(request, pk):
    """Entrega o arquivo de uma evidência ao usuário autenticado.

    Por que o sistema serve o arquivo em vez de apontar para o armazenamento:

    1. **Controle de acesso de verdade.** O arquivo só sai para quem está
       logado. Um link direto do bucket, mesmo assinado, funciona para
       qualquer pessoa que receba a URL enquanto ela não expirar.
    2. **Não depende de chave.** Gerar link assinado exige chave de conta de
       serviço, que a política da organização bloqueia. Lendo o objeto pela
       credencial do ambiente, nada disso é necessário.
    3. **Funciona igual nos dois armazenamentos** — pasta local em
       desenvolvimento, Google Cloud Storage em produção — porque usa a API de
       arquivos do Django, não a URL do provedor.

    O arquivo é transmitido em blocos (FileResponse), sem carregar tudo na
    memória do servidor.
    """
    mecanismo = _parque_ou_aviso(request)
    if not mecanismo:
        raise Http404("Nenhum parque cadastrado.")

    # O filtro por mecanismo impede que alguém acesse evidência de outro
    # registro trocando o número na URL.
    evidencia = get_object_or_404(
        Evidencia.objects.select_related("pratica"), pk=pk, mecanismo=mecanismo
    )

    if not evidencia.arquivo:
        raise Http404(
            "Esta evidência não tem arquivo anexado (pode ter sido registrada como link)."
        )

    try:
        conteudo = evidencia.arquivo.open("rb")
    except (FileNotFoundError, OSError):
        # Registro no banco sem o arquivo correspondente no armazenamento.
        # Acontece, por exemplo, ao restaurar um backup do banco sem os arquivos.
        raise Http404(
            "O arquivo desta evidência não foi encontrado no armazenamento. "
            "Verifique se o backup dos arquivos foi restaurado junto com o banco."
        )

    nome = PurePosixPath(evidencia.arquivo.name).name
    tipo, _ = mimetypes.guess_type(nome)
    tipo = tipo or "application/octet-stream"

    resposta = FileResponse(
        conteudo,
        content_type=tipo,
        as_attachment=tipo not in TIPOS_EXIBIR_NA_ABA,
        filename=nome,
    )
    # Impede o navegador de "adivinhar" um tipo diferente do declarado.
    resposta["X-Content-Type-Options"] = "nosniff"
    # Conteúdo interno do parque: não deve ser guardado por intermediários.
    resposta["Cache-Control"] = "private, max-age=0, no-store"
    return resposta


# ------------------------------------------------------------- empreendimentos


@login_required
def empreendimentos(request):
    mecanismo = _parque_ou_aviso(request)
    if not mecanismo:
        return _sem_parque(request)

    if request.method == "POST":
        _exigir_registro(request)
        formulario = EmpreendimentoForm(request.POST)
        if formulario.is_valid():
            empreendimento = formulario.save(commit=False)
            empreendimento.mecanismo = mecanismo
            empreendimento.criado_por = request.user
            empreendimento.save()
            messages.success(request, f"Empreendimento “{empreendimento.nome}” cadastrado.")
            return redirect("empreendimento_detail", pk=empreendimento.pk)
        messages.error(request, _primeiro_erro(formulario, "Verifique os campos."))
    else:
        formulario = EmpreendimentoForm(initial={"data_entrada": timezone.localdate()})

    lista = list(
        Empreendimento.objects.filter(mecanismo=mecanismo)
        .prefetch_related("avaliacoes")
        .annotate(n_avaliacoes=Count("avaliacoes"))
    )

    # média da última nota de cada eixo, para dar uma leitura rápida na lista
    for empreendimento in lista:
        empreendimento.medias = _media_dos_eixos(empreendimento)

    return render(
        request,
        "acompanhamento/empreendimentos_list.html",
        {
            "empreendimentos": lista,
            "form": formulario,
            "abrir_form": request.method == "POST",
            "total_apoiados": sum(
                1 for e in lista if e.situacao == Empreendimento.Situacao.APOIADO
            ),
            "total_graduados": sum(
                1 for e in lista if e.situacao == Empreendimento.Situacao.GRADUADO
            ),
        },
    )


def _media_dos_eixos(empreendimento):
    """Última nota de cada eixo, a média geral e o desenho do radar."""
    ultima = {}
    for avaliacao in sorted(
        empreendimento.avaliacoes.all(), key=lambda a: (a.data, a.id)
    ):
        ultima[avaliacao.eixo] = avaliacao.nota
    notas = [ultima.get(valor) for valor, _ in AvaliacaoEixo.Eixo.choices]
    validas = [n for n in notas if n is not None]
    por_eixo = [ultima.get(valor, 0) for valor, _ in AvaliacaoEixo.Eixo.choices]
    return {
        "por_eixo": por_eixo,
        "detalhado": [
            {"valor": valor, "rotulo": rotulo, "nota": ultima.get(valor)}
            for valor, rotulo in AvaliacaoEixo.Eixo.choices
        ],
        "media": round(sum(validas) / len(validas), 1) if validas else None,
        "avaliados": len(validas),
        "radar": _desenhar_radar(por_eixo),
    }


def _desenhar_radar(notas, maximo=5, centro=100.0, raio=64.0):
    """Calcula as coordenadas do radar dos cinco eixos para desenhar em SVG.

    O template não faz trigonometria, então a geometria é resolvida aqui e
    entregue pronta: as malhas de fundo, os raios e o polígono das notas.
    """
    import math

    quantidade = len(notas) or 1
    rotulos = [rotulo for _, rotulo in AvaliacaoEixo.Eixo.choices]

    def ponto(indice, valor):
        angulo = (2 * math.pi * indice) / quantidade - math.pi / 2
        distancia = raio * max(0, min(maximo, valor)) / maximo
        return (
            centro + distancia * math.cos(angulo),
            centro + distancia * math.sin(angulo),
        )

    malhas = []
    for passo in range(1, maximo + 1):
        pontos = [ponto(i, passo) for i in range(quantidade)]
        malhas.append(" ".join(f"{x:.1f},{y:.1f}" for x, y in pontos))

    raios = []
    marcas = []
    for indice in range(quantidade):
        x, y = ponto(indice, maximo)
        raios.append({"x": f"{x:.1f}", "y": f"{y:.1f}"})

        dx, dy = x - centro, y - centro
        norma = math.hypot(dx, dy) or 1
        rx = centro + (dx / norma) * (raio + 20)
        ry = centro + (dy / norma) * (raio + 16)
        if abs(rx - centro) < 8:
            ancora = "middle"
        elif rx > centro:
            ancora = "start"
        else:
            ancora = "end"
        marcas.append(
            {
                "x": f"{rx:.1f}",
                "y": f"{ry + 3:.1f}",
                "ancora": ancora,
                "rotulo": rotulos[indice] if indice < len(rotulos) else "",
                "nota": notas[indice],
            }
        )

    poligono = " ".join(
        f"{x:.1f},{y:.1f}"
        for x, y in (ponto(i, notas[i]) for i in range(quantidade))
    )

    return {
        "malhas": malhas,
        "raios": raios,
        "marcas": marcas,
        "poligono": poligono,
        "centro": f"{centro:.0f}",
    }


@login_required
def empreendimento_detail(request, pk):
    mecanismo = _parque_ou_aviso(request)
    if not mecanismo:
        return _sem_parque(request)

    empreendimento = get_object_or_404(Empreendimento, pk=pk, mecanismo=mecanismo)

    if request.method == "POST":
        _exigir_registro(request)
        tipo = request.POST.get("tipo")

        if tipo == "avaliacao":
            formulario = AvaliacaoEixoForm(request.POST)
            if formulario.is_valid():
                avaliacao = formulario.save(commit=False)
                avaliacao.empreendimento = empreendimento
                avaliacao.criado_por = request.user
                avaliacao.save()
                messages.success(
                    request, f"Avaliação de {avaliacao.get_eixo_display()} registrada."
                )
                return redirect("empreendimento_detail", pk=pk)
            messages.error(request, _primeiro_erro(formulario, "Verifique os campos."))

        elif tipo == "editar":
            formulario = EmpreendimentoForm(request.POST, instance=empreendimento)
            if formulario.is_valid():
                formulario.save()
                messages.success(request, "Dados do empreendimento atualizados.")
                return redirect("empreendimento_detail", pk=pk)
            messages.error(request, _primeiro_erro(formulario, "Verifique os campos."))

        elif tipo == "excluir_avaliacao":
            avaliacao = AvaliacaoEixo.objects.filter(
                pk=request.POST.get("id"), empreendimento=empreendimento
            ).first()
            if avaliacao:
                avaliacao.delete()
                messages.success(request, "Avaliação removida.")
            return redirect("empreendimento_detail", pk=pk)

        elif tipo == "excluir":
            nome = empreendimento.nome
            empreendimento.delete()
            messages.success(request, f"Empreendimento “{nome}” excluído.")
            return redirect("empreendimentos")

    medias = _media_dos_eixos(empreendimento)
    return render(
        request,
        "acompanhamento/empreendimento_detail.html",
        {
            "emp": empreendimento,
            "medias": medias,
            "eixos": AvaliacaoEixo.Eixo.choices,
            "historico": list(empreendimento.avaliacoes.order_by("-data", "-id")),
            "form_avaliacao": AvaliacaoEixoForm(initial={"data": timezone.localdate()}),
            "form_editar": EmpreendimentoForm(instance=empreendimento),
        },
    )


# ------------------------------------------------------- auditoria e dossiê


@login_required
def auditoria(request):
    """O que falta: lista acionável, organizada por nível."""
    mecanismo = _parque_ou_aviso(request)
    if not mecanismo:
        return _sem_parque(request)
    prontidao = calcular_prontidao(mecanismo)
    return render(
        request, "acompanhamento/auditoria.html", {"prontidao": prontidao}
    )


@login_required
def dossie(request):
    mecanismo = _parque_ou_aviso(request)
    if not mecanismo:
        return _sem_parque(request)

    nivel = request.GET.get("nivel")
    nivel_num = int(nivel) if nivel and nivel.isdigit() else None

    contexto = {"nivel_sel": nivel_num, "gerado_em": timezone.now()}
    contexto.update(montar_dossie(mecanismo, nivel_num))
    contexto["prontidao"] = calcular_prontidao(mecanismo)
    contexto["niveis_disponiveis"] = [
        n["nivel"].numero for n in contexto["prontidao"]["niveis"]
    ]
    return render(request, "acompanhamento/dossie.html", contexto)


@login_required
def dossie_pdf(request):
    """Gera o dossiê em PDF para download (xhtml2pdf)."""
    from xhtml2pdf import pisa  # import local: só carrega quando exporta

    mecanismo = _parque_ou_aviso(request)
    if not mecanismo:
        return _sem_parque(request)

    nivel = request.GET.get("nivel")
    nivel_num = int(nivel) if nivel and nivel.isdigit() else None

    contexto = {
        "mecanismo": mecanismo,
        "versao": versao_do_catalogo(),
        "nivel_sel": nivel_num,
        "gerado_em": timezone.now(),
    }
    contexto.update(montar_dossie(mecanismo, nivel_num))
    contexto["prontidao"] = calcular_prontidao(mecanismo)

    html = render_to_string("acompanhamento/dossie_pdf.html", contexto)
    buffer = io.BytesIO()
    resultado = pisa.CreatePDF(html, dest=buffer, encoding="utf-8")
    if resultado.err:
        messages.error(
            request, "Não foi possível gerar o PDF. Use a opção de imprimir do navegador."
        )
        return redirect("dossie")
    buffer.seek(0)

    nome = slugify(mecanismo.nome) or "parque"
    sufixo = f"-cerne{nivel_num}" if nivel_num else "-completo"
    data = timezone.localdate().strftime("%Y%m%d")
    resposta = HttpResponse(buffer.getvalue(), content_type="application/pdf")
    resposta["Content-Disposition"] = (
        f'attachment; filename="dossie-{nome}{sufixo}-{data}.pdf"'
    )
    return resposta


# ------------------------------------------------------------ ajuda e config


@login_required
def guia(request):
    exemplar = PraticaChave.objects.filter(codigo="1.1.1").first()
    return render(request, "acompanhamento/guia.html", {"exemplar": exemplar})


@login_required
def manual(request):
    exemplar = PraticaChave.objects.filter(codigo="1.1.1").first()
    return render(request, "acompanhamento/manual.html", {"exemplar": exemplar})


@login_required
def configuracao(request):
    """Dados do parque. Restrito a quem administra (is_staff)."""
    if not request.user.is_staff:
        raise PermissionDenied("Apenas a equipe gestora acessa a configuração.")

    mecanismo = _parque_ou_aviso(request)
    if not mecanismo:
        return _sem_parque(request)

    if request.method == "POST":
        formulario = MecanismoForm(request.POST, instance=mecanismo)
        if formulario.is_valid():
            formulario.save()
            messages.success(request, "Dados do parque atualizados.")
            return redirect("configuracao")
        messages.error(request, _primeiro_erro(formulario, "Verifique os campos."))
    else:
        formulario = MecanismoForm(instance=mecanismo)

    return render(
        request,
        "acompanhamento/configuracao.html",
        {
            "form": formulario,
            "pasta_media": str(Path(settings.MEDIA_ROOT)),
            "total_evidencias": Evidencia.objects.filter(mecanismo=mecanismo).count(),
            "total_medicoes": MedicaoMetrica.objects.filter(mecanismo=mecanismo).count(),
            "outros_mecanismos": list(
                Mecanismo.objects.exclude(pk=mecanismo.pk).order_by("nome")
            ),
        },
    )
