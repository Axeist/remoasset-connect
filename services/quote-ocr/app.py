"""Quotation OCR extract: Docling tables + markdown. No LLM."""

from __future__ import annotations

import os
import tempfile
from pathlib import Path

from fastapi import FastAPI, File, Header, HTTPException, UploadFile
from fastapi.responses import JSONResponse

MAX_BYTES = 10 * 1024 * 1024
MAX_PAGES = 4
MIN_TEXT_CHARS = 180
SECRET = os.environ.get("QUOTE_OCR_SECRET", "")

app = FastAPI(title="quote-ocr")

_converters: dict[bool, object] = {}


def _authorized(authorization: str | None, x_secret: str | None) -> bool:
    if not SECRET:
        return True
    bearer = (authorization or "").removeprefix("Bearer ").strip()
    header = (x_secret or "").strip()
    return bearer == SECRET or header == SECRET


def converter(do_ocr: bool):
    cached = _converters.get(do_ocr)
    if cached is not None:
        return cached
    from docling.datamodel.base_models import InputFormat
    from docling.datamodel.pipeline_options import PdfPipelineOptions
    from docling.document_converter import DocumentConverter, PdfFormatOption

    opts = PdfPipelineOptions()
    opts.do_ocr = do_ocr
    opts.do_table_structure = True
    conv = DocumentConverter(
        format_options={
            InputFormat.PDF: PdfFormatOption(pipeline_options=opts),
        }
    )
    _converters[do_ocr] = conv
    return conv


def _tables_markdown(doc) -> list[str]:
    out: list[str] = []
    tables = getattr(doc, "tables", None) or []
    for table in tables:
        try:
            df = table.export_to_dataframe()
            md = df.to_markdown(index=False)
            if md and md.strip():
                out.append(md.strip())
                continue
        except Exception:
            pass
        try:
            md = table.export_to_markdown()
            if md and str(md).strip():
                out.append(str(md).strip())
        except Exception:
            continue
    return out


def _convert_path(path: str, do_ocr: bool):
        conv = converter(do_ocr)
        try:
            result = conv.convert(path, max_num_pages=MAX_PAGES, max_file_size=MAX_BYTES)
        except TypeError:
            result = conv.convert(path)
    doc = result.document
    markdown = (doc.export_to_markdown() or "").strip()
    tables = _tables_markdown(doc)
    return markdown, tables


@app.on_event("startup")
def _warmup():
    try:
        converter(False)
    except Exception:
        pass


@app.get("/health")
def health():
    return {"ok": True}


@app.post("/convert")
async def convert(
    file: UploadFile = File(...),
    authorization: str | None = Header(default=None),
    x_quote_ocr_secret: str | None = Header(default=None, alias="X-Quote-Ocr-Secret"),
):
    if not _authorized(authorization, x_quote_ocr_secret):
        raise HTTPException(status_code=401, detail="Unauthorized")

    name = file.filename or "quote.bin"
    suffix = Path(name).suffix.lower() or ".bin"
    raw = await file.read()
    if not raw:
        raise HTTPException(status_code=400, detail="Empty file")
    if len(raw) > MAX_BYTES:
        raise HTTPException(status_code=413, detail="File exceeds 10MB")

    is_image = suffix in {".png", ".jpg", ".jpeg", ".webp", ".tif", ".tiff", ".gif"} or (
        (file.content_type or "").startswith("image/")
    )
    is_pdf = suffix == ".pdf" or file.content_type == "application/pdf"

    tmp = tempfile.NamedTemporaryFile(delete=False, suffix=suffix)
    try:
        tmp.write(raw)
        tmp.close()
        used_ocr = bool(is_image or not is_pdf)
        markdown, tables = _convert_path(tmp.name, do_ocr=used_ocr)
        if is_pdf and not used_ocr:
            body_len = len(markdown) + sum(len(t) for t in tables)
            if body_len < MIN_TEXT_CHARS:
                used_ocr = True
                markdown, tables = _convert_path(tmp.name, do_ocr=True)
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=422, detail=f"Docling failed: {exc}") from exc
    finally:
        try:
            os.unlink(tmp.name)
        except OSError:
            pass

    excerpt_parts = []
    if tables:
        excerpt_parts.append("TABLES:\n" + "\n\n".join(tables[:8]))
    if markdown:
        excerpt_parts.append(markdown[:8000])
    excerpt = "\n\n".join(excerpt_parts)[:12000]

    return JSONResponse(
        {
            "ocr_used": used_ocr,
            "markdown": markdown[:8000],
            "tables": tables[:8],
            "excerpt": excerpt,
        }
    )
