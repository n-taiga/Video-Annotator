# Copyright (c) Meta Platforms, Inc. and affiliates.
# All rights reserved.

# This source code is licensed under the license found in the
# LICENSE file in the root directory of this source tree.

from hydra import initialize_config_module
from hydra.core.global_hydra import GlobalHydra

if not GlobalHydra.instance().is_initialized():
    initialize_config_module("sam2", version_base="1.2")

# Try to expose the compiled extension as `sam2._C` for backwards compatibility.
# The build places the compiled shared object under `sam2/csrc/_C.so`, which
# is importable as `sam2.csrc._C`. Some call sites do `from sam2 import _C`, so
# we re-export the compiled extension (if present) as the `_C` attribute on the
# `sam2` package module. If the extension isn't built, we silently skip it and
# let the rest of the code handle the absence (the repo already warns/falls
# back in that case).
try:
    import importlib
    _ext = None
    # First try direct import (works if sam2.csrc is importable)
    try:
        _ext = importlib.import_module("sam2.csrc._C")
    except Exception:
        try:
            _ext = importlib.import_module("sam2.csrc.sam2_C")
        except Exception:
            _ext = None

    # If direct import failed but a compiled .so exists under sam2/csrc/, load
    # it explicitly by file path. This handles cases where sam2.csrc isn't a
    # proper package or import machinery doesn't detect the extension.
    if _ext is None:
        try:
            import os
            import glob
            import importlib.util
            import sys

            pkg_dir = os.path.dirname(__file__)
            csrc_dir = os.path.join(pkg_dir, "csrc")
            if os.path.isdir(csrc_dir):
                # look for likely extension filenames
                candidates = []
                candidates += glob.glob(os.path.join(csrc_dir, "_C.*.so"))
                candidates += glob.glob(os.path.join(csrc_dir, "sam2_C.*.so"))
                candidates += glob.glob(os.path.join(csrc_dir, "_C.so"))
                candidates += glob.glob(os.path.join(csrc_dir, "sam2_C.so"))
                # take the first existing candidate
                for path in candidates:
                    if os.path.isfile(path):
                        try:
                            spec = importlib.util.spec_from_file_location("sam2._C", path)
                            if spec is None:
                                continue
                            mod = importlib.util.module_from_spec(spec)
                            # register in sys.modules before executing to handle recursive imports
                            sys.modules["sam2._C"] = mod
                            spec.loader.exec_module(mod)
                            _ext = mod
                            break
                        except Exception:
                            # try next candidate
                            _ext = None
                            continue
        except Exception:
            _ext = None

    if _ext is not None:
        globals()["_C"] = _ext
except Exception:
    # Never fail import of the package if extension import fails; callers
    # already handle missing functionality with warnings/fallbacks.
    pass
