#!/usr/bin/env python3
"""Actualiza data/draws.json y data/meta.json con los últimos sorteos de Baloto y Revancha.

Fuente: resultadobaloto.com (páginas públicas). Se ejecuta desde GitHub Actions
después de cada sorteo (lunes, miércoles y sábado, 11:00 p. m. hora Colombia).
Solo usa la biblioteca estándar de Python.
"""
import datetime as dt
import html
import json
import re
import sys
import time
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DRAWS = ROOT / "data" / "draws.json"
META = ROOT / "data" / "meta.json"
BASE = "https://www.resultadobaloto.com"
DAY_PAGE = {0: "lunes", 2: "miercoles", 5: "sabado"}
MESES = {m: i + 1 for i, m in enumerate(
    ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto",
     "septiembre", "octubre", "noviembre", "diciembre"])}
BOGOTA = dt.timezone(dt.timedelta(hours=-5))
UA = "Mozilla/5.0 (LotoMaster; +https://github.com)"


def fetch(url: str) -> str:
    for intento in range(3):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": UA})
            with urllib.request.urlopen(req, timeout=30) as r:
                return r.read().decode("utf-8", errors="ignore")
        except Exception as e:  # noqa: BLE001
            print(f"  aviso: {url} falló ({e}), reintento {intento + 1}", file=sys.stderr)
            time.sleep(3)
    return ""


def texto(page: str) -> str:
    page = re.sub(r"<(script|style)[\s\S]*?</\1>", " ", page)
    return html.unescape(re.sub(r"\s+", " ", re.sub(r"<[^>]+>", " ", page)))


RESULT_RE = re.compile(
    r"Baloto (\d{3,5}) [^0-9]*?(\d{1,2}) de ([a-záéíóú]+) de (\d{4})[^0-9]*?"
    r"((?:\d{2} ){6})Revancha de Baloto ((?:\d{2} ){6})", re.I)


def parse_results(t: str) -> list[dict]:
    out = []
    for sorteo, d, mes, y, b, r in RESULT_RE.findall(t):
        m = MESES.get(mes.lower())
        if not m:
            continue
        b = [int(x) for x in b.split()]
        r = [int(x) for x in r.split()]
        row = {"fecha": dt.date(int(y), m, int(d)).isoformat(), "sorteo": int(sorteo),
               "baloto": sorted(b[:5]), "sb": b[5], "revancha": sorted(r[:5]), "rsb": r[5]}
        if valid(row):
            out.append(row)
    return out


def valid(row: dict) -> bool:
    ok = lambda xs: len(set(xs)) == 5 and all(1 <= x <= 43 for x in xs)  # noqa: E731
    return ok(row["baloto"]) and ok(row["revancha"]) and 1 <= row["sb"] <= 16 and 1 <= row["rsb"] <= 16


def next_draw(now: dt.datetime) -> dt.date:
    d = now.date()
    if now.weekday() in DAY_PAGE and now.time() < dt.time(23, 0):
        return d
    d += dt.timedelta(days=1)
    while d.weekday() not in DAY_PAGE:
        d += dt.timedelta(days=1)
    return d


def main() -> int:
    draws = json.loads(DRAWS.read_text())
    by_date = {r["fecha"]: r for r in draws}
    antes = len(by_date)

    home_raw = html.unescape(fetch(BASE + "/"))
    home = texto(home_raw)
    for row in parse_results(home):
        by_date.setdefault(row["fecha"], row)

    # Recupera sorteos faltantes de los últimos 21 días desde sus páginas propias.
    hoy = dt.datetime.now(BOGOTA)
    d = max(dt.date.fromisoformat(draws[-1]["fecha"]), hoy.date() - dt.timedelta(days=21))
    while d < hoy.date() or (d == hoy.date() and hoy.time() > dt.time(23, 15)):
        if d.weekday() in DAY_PAGE and d.isoformat() not in by_date:
            url = f"{BASE}/baloto-{DAY_PAGE[d.weekday()]}.php?del-dia={d.isoformat()}"
            for row in parse_results(texto(fetch(url))):
                if row["fecha"] == d.isoformat():
                    by_date[row["fecha"]] = row
            time.sleep(1)
        d += dt.timedelta(days=1)

    draws = sorted(by_date.values(), key=lambda r: r["fecha"])
    DRAWS.write_text(json.dumps(draws, separators=(",", ":")))

    meta = json.loads(META.read_text()) if META.exists() else {}
    m = re.search(r"Baloto: \$ ?([\d.,]+) millones, Revancha: \$ ?([\d.,]+) millones", home_raw)
    if m:
        to_pesos = lambda s: int(float(s.replace(",", "")) * 1_000_000)  # noqa: E731
        meta["acumulado_baloto"] = to_pesos(m.group(1))
        meta["acumulado_revancha"] = to_pesos(m.group(2))
        meta["acumulado_para"] = next_draw(hoy).isoformat()
    meta["ultimo_sorteo"] = draws[-1]["fecha"]
    meta["total_sorteos"] = len(draws)
    meta["actualizado"] = hoy.isoformat(timespec="minutes")
    META.write_text(json.dumps(meta, ensure_ascii=False, indent=1))
    print(f"Sorteos: {antes} -> {len(draws)}. Último: {draws[-1]['fecha']}. "
          f"Acumulados: {meta.get('acumulado_baloto')} / {meta.get('acumulado_revancha')}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
