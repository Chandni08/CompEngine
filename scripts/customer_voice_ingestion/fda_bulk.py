"""Official FDA bulk-data adapter for warning-letter/483 signals (execution order 5).

The adapter downloads XLSX data directly from FDA-published bulk endpoints.  It
does not scrape the rendered Warning Letters, inspection, or Reading Room pages.
"""

from __future__ import annotations

import io
import logging
import os
import re
from datetime import date, datetime
from pathlib import PurePosixPath
from typing import Any
from urllib.parse import urlsplit
from xml.etree import ElementTree as ET
from zipfile import BadZipFile, ZipFile

from .common import EvidenceRecord, RobotsAwareClient, enabled, unique_keywords


LOGGER = logging.getLogger(__name__)
ENV_NAME = "CUSTOMER_VOICE_FDA_ENABLED"
WARNING_LETTERS_XLSX = (
    "https://www.fda.gov/inspections-compliance-enforcement-and-criminal-investigations/"
    "compliance-actions-and-activities/warning-letters/datatables-data?_format=xlsx&page=0"
)
FORM_483_XLSX = "https://www.fda.gov/media/190190/download?attachment"
ALLOWED_HOSTS = {"fda.gov", "www.fda.gov"}
NS = {"a": "http://schemas.openxmlformats.org/spreadsheetml/2006/main", "r": "http://schemas.openxmlformats.org/officeDocument/2006/relationships"}
REGULATORY_TERMS = (
    "laboratory controls", "test procedures", "analytical methods", "method validation", "data integrity",
    "audit trail", "computer", "electronic records", "chromatography", "HPLC", "LC-MS", "mass spectrometry",
    "equipment", "calibration", "qualification", "out-of-specification", "investigation", "specifications",
)


def in_scope(url: str) -> bool:
    parts = urlsplit(url)
    if parts.scheme != "https" or parts.hostname not in ALLOWED_HOSTS:
        return False
    path = parts.path.lower()
    if path == "/media/190190/download":
        return True
    return path.endswith("/warning-letters/datatables-data") and "_format=xlsx" in parts.query


def _column_index(reference: str) -> int:
    letters = re.match(r"[A-Z]+", reference.upper())
    result = 0
    for char in letters.group(0) if letters else "A":
        result = result * 26 + ord(char) - 64
    return result - 1


def _xlsx_sheets(content: bytes) -> dict[str, list[list[str]]]:
    """Read plain cell values from FDA XLSX files without adding a heavy dependency."""
    with ZipFile(io.BytesIO(content)) as archive:
        shared: list[str] = []
        if "xl/sharedStrings.xml" in archive.namelist():
            root = ET.fromstring(archive.read("xl/sharedStrings.xml"))
            for item in root.findall("a:si", NS):
                shared.append("".join(node.text or "" for node in item.findall(".//a:t", NS)))
        workbook = ET.fromstring(archive.read("xl/workbook.xml"))
        relationships = ET.fromstring(archive.read("xl/_rels/workbook.xml.rels"))
        relation_targets = {item.attrib["Id"]: item.attrib["Target"] for item in relationships}
        output: dict[str, list[list[str]]] = {}
        for sheet in workbook.findall("a:sheets/a:sheet", NS):
            relation_id = sheet.attrib.get(f"{{{NS['r']}}}id", "")
            target = relation_targets.get(relation_id, "")
            if not target:
                continue
            normalized = str(PurePosixPath("xl") / target.lstrip("/"))
            normalized = normalized.replace("xl/xl/", "xl/")
            root = ET.fromstring(archive.read(normalized))
            rows: list[list[str]] = []
            for row in root.findall(".//a:sheetData/a:row", NS):
                cells: dict[int, str] = {}
                for cell in row.findall("a:c", NS):
                    reference = cell.attrib.get("r", "A1")
                    value_node = cell.find("a:v", NS)
                    value = "" if value_node is None else value_node.text or ""
                    if cell.attrib.get("t") == "s" and value:
                        value = shared[int(value)]
                    elif cell.attrib.get("t") == "inlineStr":
                        value = "".join(node.text or "" for node in cell.findall(".//a:t", NS))
                    cells[_column_index(reference)] = re.sub(r"\s+", " ", value.replace("_x000D_", " ")).strip()
                if cells:
                    width = max(cells) + 1
                    rows.append([cells.get(index, "") for index in range(width)])
            output[sheet.attrib.get("name", "Sheet")] = rows
        return output


def _row_dicts(rows: list[list[str]]) -> list[dict[str, str]]:
    if not rows:
        return []
    headers = [str(item).strip() for item in rows[0]]
    return [
        {headers[index]: row[index] if index < len(row) else "" for index in range(len(headers)) if headers[index]}
        for row in rows[1:]
    ]


def _parse_date(value: str) -> str:
    for pattern in ("%m/%d/%Y", "%Y-%m-%d"):
        try:
            return datetime.strptime(value.strip(), pattern).date().isoformat()
        except ValueError:
            continue
    return ""


def _download(client: RobotsAwareClient, url: str) -> bytes | None:
    response = client.get(
        url,
        in_scope,
        accept="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/octet-stream;q=0.9",
    )
    if response is None:
        return None
    if not response.content.startswith(b"PK\x03\x04"):
        LOGGER.warning("FDA bulk endpoint did not return an XLSX archive; skipping %s", url)
        return None
    return response.content


def _warning_record(content: bytes) -> EvidenceRecord | None:
    sheets = _xlsx_sheets(content)
    rows = _row_dicts(next(iter(sheets.values()), []))
    candidates: list[dict[str, str]] = []
    for row in rows:
        company = row.get("Company Name", "")
        subject = row.get("Subject", "")
        office = row.get("Issuing Office", "")
        combined = f"{company} {subject} {office}".lower()
        # The index is metadata, so include only entries that explicitly identify
        # an analytical/laboratory operator or GLP finding. Generic CGMP rows do
        # not substantiate an instrument or data-integrity claim and are omitted.
        if not any(term in combined for term in ("analytical", "laboratory", "good laboratory practice", "data integrity")):
            continue
        issued = _parse_date(row.get("Letter Issue Date", ""))
        if not issued:
            continue
        candidates.append({**row, "date": issued})
    if not candidates:
        return None
    candidates.sort(key=lambda row: row["date"], reverse=True)
    latest = candidates[0]
    summaries = [f"{row.get('Company Name')} — {row.get('Subject')} ({row['date']})" for row in candidates[:8]]
    text = " | ".join(summaries)
    source_text = " | ".join(" ".join(str(value) for value in row.values()) for row in candidates[:20])
    return EvidenceRecord(
        label="FDA Warning Letter index: analytical and laboratory operators",
        url=WARNING_LETTERS_XLSX,
        source_keywords=unique_keywords(source_text, REGULATORY_TERMS + ("analytical", "laboratory", "Good Laboratory Practice")),
        record_type="Official FDA Warning Letter bulk index",
        source_date=latest["date"],
        source_type="regulatory",
        source_name="U.S. FDA Warning Letters bulk download",
        excerpt=text,
        metadata={"regulatoryEntries": candidates[:20], "regulatoryDataset": "warning_letters"},
    )


def _form_483_record(content: bytes) -> EvidenceRecord | None:
    sheets = _xlsx_sheets(content)
    findings: list[dict[str, Any]] = []
    for program in ("Drugs", "Biologics"):
        for row in _row_dicts(sheets.get(program, [])):
            short = row.get("Short Description", "")
            long = row.get("Long Description", "")
            combined = f"{short} {long}".lower()
            if not any(term in combined for term in (
                "laboratory control", "test procedure", "computer", "record", "equipment", "calibrat",
                "specification", "investigation", "data", "validation", "quality control",
            )):
                continue
            try:
                frequency = int(float(row.get("Frequency", "0") or 0))
            except ValueError:
                frequency = 0
            findings.append({
                "programArea": program,
                "citeId": row.get("Cite ID", ""),
                "reference": row.get("Reference Number", ""),
                "finding": short,
                "description": long,
                "frequency": frequency,
            })
    if not findings:
        return None
    findings.sort(key=lambda item: item["frequency"], reverse=True)
    top = findings[:20]
    text = " | ".join(f"{item['finding']} ({item['frequency']} citations)" for item in top[:8])
    source_text = " | ".join(" ".join(str(value) for value in item.values()) for item in top)
    return EvidenceRecord(
        label="FDA FY2025 Form 483: regulated laboratory and data-control findings",
        url=FORM_483_XLSX,
        source_keywords=unique_keywords(source_text, REGULATORY_TERMS),
        record_type="Official FDA Form 483 bulk observations",
        source_date="2025-09-30",
        source_type="regulatory",
        source_name="U.S. FDA Inspectional Observations bulk download",
        excerpt=text,
        metadata={"regulatoryFindings": top, "regulatoryDataset": "form_483", "fiscalYear": 2025},
    )


def collect(client: RobotsAwareClient | None = None) -> list[EvidenceRecord]:
    if not enabled(ENV_NAME):
        LOGGER.info("FDA bulk-data adapter disabled by %s", ENV_NAME)
        return []
    client = client or RobotsAwareClient()
    warning_url = os.getenv("FDA_WARNING_LETTERS_BULK_URL", WARNING_LETTERS_XLSX).strip()
    form_483_url = os.getenv("FDA_FORM_483_BULK_URL", FORM_483_XLSX).strip()
    records: list[EvidenceRecord] = []
    for url, parser in ((warning_url, _warning_record), (form_483_url, _form_483_record)):
        if not in_scope(url):
            LOGGER.warning("FDA bulk URL falls outside approved official endpoints; skipping %s", url)
            continue
        content = _download(client, url)
        if not content:
            continue
        try:
            record = parser(content)
            if record:
                records.append(record)
        except (BadZipFile, ET.ParseError, KeyError, ValueError) as error:
            LOGGER.warning("FDA bulk file could not be parsed; skipping %s: %s", url, error)
    return records
