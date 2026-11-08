#!/usr/bin/env python3
"""Nome antigo, mantido por compatibilidade: agora o script é gerar_dados.py,
que gera os dados do Henrique e da Beatriz."""
import runpy
from pathlib import Path

runpy.run_path(str(Path(__file__).with_name("gerar_dados.py")), run_name="__main__")
