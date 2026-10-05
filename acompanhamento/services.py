"""Cálculo de prontidão CERNE (o "radar").

Regra (acumulativa): o parque está apto a solicitar o CERNE N quando TODAS as
práticas-chave dos níveis 1 a N estão "completas".

Uma prática-chave é considerada completa quando:
  1. seu status é "Implantada";
  2. todos os requisitos de evidência OBRIGATÓRIOS têm ao menos uma evidência
     anexada (vinculada ao requisito);
  3. todas as métricas OBRIGATÓRIAS têm ao menos uma medição registrada.

Métricas/requisitos marcados como não obrigatórios (sugestões) não bloqueiam.
"""

from catalogo.models import Nivel, VersaoModelo

from .models import (
    Aprendizado,
    Evidencia,
    MedicaoMetrica,
    PlanoAcao,
    StatusPratica,
)


def versao_ativa():
    return (
        VersaoModelo.objects.filter(ativa=True).order_by("-ano").first()
        or VersaoModelo.objects.order_by("-ano").first()
    )


def _coletar_mapas(mecanismo, versao):
    """Pré-carrega, em memória, os dados do mecanismo para evitar N+1 queries."""
    status_map = {
        s.pratica_id: s
        for s in StatusPratica.objects.filter(mecanismo=mecanismo)
    }
    req_atendidos = set(
        Evidencia.objects.filter(mecanismo=mecanismo, requisito__isnull=False)
        .values_list("requisito_id", flat=True)
    )
    evid_por_pratica = {}
    for pid in Evidencia.objects.filter(mecanismo=mecanismo).values_list(
        "pratica_id", flat=True
    ):
        evid_por_pratica[pid] = evid_por_pratica.get(pid, 0) + 1
    metricas_medidas = set(
        MedicaoMetrica.objects.filter(mecanismo=mecanismo).values_list(
            "metrica_id", flat=True
        )
    )
    return status_map, req_atendidos, evid_por_pratica, metricas_medidas


def _faltas_da_pratica(pratica, status_map, req_atendidos, metricas_medidas):
    """Retorna a lista de pendências (strings) que impedem a prática de estar completa."""
    faltas = []
    st = status_map.get(pratica.id)
    if not st or st.situacao != StatusPratica.Situacao.IMPLANTADA:
        atual = st.get_situacao_display() if st else "Não iniciada"
        faltas.append(f"Marcar a prática como 'Implantada' (situação atual: {atual}).")

    for req in pratica.requisitos_evidencia.all():
        if req.obrigatorio and req.id not in req_atendidos:
            faltas.append(f"Anexar evidência para: {req.descricao[:80]}")

    for met in pratica.metricas.all():
        if met.obrigatoria and met.id not in metricas_medidas:
            faltas.append(f"Registrar medição da métrica obrigatória: {met.nome}")

    return faltas


def calcular_prontidao(mecanismo):
    """Monta a estrutura completa de prontidão para o dashboard e o radar."""
    versao = versao_ativa()
    resultado = {
        "versao": versao,
        "mecanismo": mecanismo,
        "niveis": [],
        "apto_nivel": 0,
        "proximo_nivel": None,
        "pendencias_proximo": [],
        "total_praticas": 0,
        "total_completas": 0,
    }
    if not versao or not mecanismo:
        return resultado

    status_map, req_atendidos, evid_por_pratica, metricas_medidas = _coletar_mapas(
        mecanismo, versao
    )

    niveis_qs = (
        Nivel.objects.filter(versao=versao)
        .order_by("numero")
        .prefetch_related(
            "processos__praticas__requisitos_evidencia",
            "processos__praticas__metricas",
        )
    )

    completas_por_nivel = {}
    for nivel in niveis_qs:
        nivel_info = {
            "nivel": nivel,
            "processos": [],
            "total": 0,
            "completas": 0,
            "percentual": 0,
        }
        for processo in nivel.processos.all():
            proc_info = {"processo": processo, "praticas": [], "total": 0, "completas": 0, "percentual": 0}
            for pratica in processo.praticas.all():
                faltas = _faltas_da_pratica(
                    pratica, status_map, req_atendidos, metricas_medidas
                )
                completa = len(faltas) == 0
                st = status_map.get(pratica.id)
                proc_info["praticas"].append(
                    {
                        "pratica": pratica,
                        "status": st,
                        "situacao": st.situacao if st else "nao_iniciada",
                        "situacao_display": st.get_situacao_display() if st else "Não iniciada",
                        "completa": completa,
                        "faltas": faltas,
                        "n_evidencias": evid_por_pratica.get(pratica.id, 0),
                    }
                )
                proc_info["total"] += 1
                nivel_info["total"] += 1
                if completa:
                    proc_info["completas"] += 1
                    nivel_info["completas"] += 1
            proc_info["percentual"] = (
                round(100 * proc_info["completas"] / proc_info["total"])
                if proc_info["total"]
                else 0
            )
            nivel_info["processos"].append(proc_info)

        nivel_info["percentual"] = (
            round(100 * nivel_info["completas"] / nivel_info["total"])
            if nivel_info["total"]
            else 0
        )
        completas_por_nivel[nivel.numero] = (
            nivel_info["completas"],
            nivel_info["total"],
        )
        resultado["niveis"].append(nivel_info)
        resultado["total_praticas"] += nivel_info["total"]
        resultado["total_completas"] += nivel_info["completas"]

    # Radar: maior nível N cujos níveis 1..N estão 100% completos (acumulativo).
    apto = 0
    for numero in sorted(completas_por_nivel):
        comp, total = completas_por_nivel[numero]
        if total > 0 and comp == total:
            apto = numero
        else:
            break
    resultado["apto_nivel"] = apto

    # Próximo nível e suas pendências.
    proximo = apto + 1
    if any(n["nivel"].numero == proximo for n in resultado["niveis"]):
        resultado["proximo_nivel"] = proximo
        pend = []
        for nivel_info in resultado["niveis"]:
            if nivel_info["nivel"].numero > proximo:
                continue
            for proc in nivel_info["processos"]:
                for pinfo in proc["praticas"]:
                    if not pinfo["completa"]:
                        pend.append(
                            {
                                "pratica": pinfo["pratica"],
                                "faltas": pinfo["faltas"],
                            }
                        )
        resultado["pendencias_proximo"] = pend

    return resultado


def montar_dossie(mecanismo, nivel_numero=None):
    """Monta o dossiê consolidado (auditável) por nível → processo → prática.

    Para cada prática reúne: status, requisitos de evidência e o que já foi
    atendido, evidências anexadas (com data/responsável), medições das métricas,
    revisões críticas e planos de ação. Use `nivel_numero` para restringir a um nível.
    """
    versao = versao_ativa()
    dados = {"versao": versao, "mecanismo": mecanismo, "niveis": [], "req_atendidos": set()}
    if not versao or not mecanismo:
        return dados

    status_map, req_atendidos, _evid_cnt, metricas_medidas = _coletar_mapas(
        mecanismo, versao
    )
    dados["req_atendidos"] = req_atendidos

    evid_map = {}
    for e in Evidencia.objects.filter(mecanismo=mecanismo).select_related("requisito"):
        evid_map.setdefault(e.pratica_id, []).append(e)
    med_map = {}
    for m in (
        MedicaoMetrica.objects.filter(mecanismo=mecanismo)
        .select_related("metrica")
        .order_by("-data")
    ):
        med_map.setdefault(m.metrica_id, []).append(m)
    apr_map = {}
    for a in Aprendizado.objects.filter(mecanismo=mecanismo):
        apr_map.setdefault(a.pratica_id, []).append(a)
    plano_map = {}
    for pl in PlanoAcao.objects.filter(mecanismo=mecanismo):
        plano_map.setdefault(pl.pratica_id, []).append(pl)

    niveis_qs = Nivel.objects.filter(versao=versao)
    if nivel_numero:
        niveis_qs = niveis_qs.filter(numero=nivel_numero)
    niveis_qs = niveis_qs.order_by("numero").prefetch_related(
        "processos__praticas__requisitos_evidencia",
        "processos__praticas__metricas",
    )

    for nivel in niveis_qs:
        procs = []
        n_total = n_ok = 0
        for processo in nivel.processos.all():
            prats = []
            for pratica in processo.praticas.all():
                st = status_map.get(pratica.id)
                faltas = _faltas_da_pratica(
                    pratica, status_map, req_atendidos, metricas_medidas
                )
                mets = [
                    {"metrica": met, "medicoes": med_map.get(met.id, [])}
                    for met in pratica.metricas.all()
                ]
                prats.append(
                    {
                        "pratica": pratica,
                        "status": st,
                        "situacao_display": st.get_situacao_display() if st else "Não iniciada",
                        "completa": len(faltas) == 0,
                        "faltas": faltas,
                        "requisitos": list(pratica.requisitos_evidencia.all()),
                        "evidencias": evid_map.get(pratica.id, []),
                        "metricas": mets,
                        "aprendizados": apr_map.get(pratica.id, []),
                        "planos": plano_map.get(pratica.id, []),
                    }
                )
                n_total += 1
                if not faltas:
                    n_ok += 1
            procs.append({"processo": processo, "praticas": prats})
        dados["niveis"].append(
            {
                "nivel": nivel,
                "processos": procs,
                "total": n_total,
                "completas": n_ok,
                "percentual": round(100 * n_ok / n_total) if n_total else 0,
            }
        )
    return dados
